-- =====================================================================
-- Patient Insurance Tracking ERP — Database Schema (Step 1)
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles: extends auth.users with role + per-user permissions
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  full_name             text,
  role                  text not null default 'staff' check (role in ('admin','staff')),
  can_view_financials   boolean not null default false,
  can_view_statistics   boolean not null default false,
  can_delete            boolean not null default false,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. patients: the core "patient case" entity
-- ---------------------------------------------------------------------
create table if not exists public.patients (
  id                 uuid primary key default gen_random_uuid(),
  case_id            bigint generated always as identity unique,   -- shown to staff
  patient_erp_id     text,                                 -- manual ID typed by staff; required by the app on create, nullable for legacy rows, duplicates allowed
  patient_name       text    not null,
  phone_number       text,                                 -- optional; text (may have +964, leading zeros)
  age                integer not null,
  case_type          text    not null check (case_type in ('Medical','Surgical')),
  treating_doctor    text    not null,
  diagnosis          text    not null,
  procedure_type     text    not null,
  total_cost         numeric(14,2) not null default 0,
  materials_share    numeric(14,2) not null default 0,
  hospital_share     numeric(14,2) not null default 0,
  doctor_share       numeric(14,2) not null default 0,
  -- Revenue Collection: independent from the cost-share breakdown above.
  revenue_total        numeric(14,2) not null default 0,
  revenue_patient_paid numeric(14,2) not null default 0,   -- resolved amount (a "%" input is converted to an amount by the app)
  revenue_insurance_due numeric(14,2) generated always as (revenue_total - revenue_patient_paid) stored,  -- always total − patient paid; never written directly
  status_code        integer not null default 0 check (status_code in (0,1,2,3)),
  invoice_submitted_at timestamptz,                               -- auto-set the first time status reaches >= 2 (invoice submitted); never cleared
  first_visit_date   date        not null default (now() at time zone 'Asia/Baghdad')::date,  -- Baghdad-local date, set on create, not edited
  last_updated       timestamptz not null default now(),          -- auto on every edit
  entered_by         uuid references public.profiles(id),
  lab_investigations text,
  imaging_studies    text,
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists patients_status_idx      on public.patients(status_code);
create index if not exists patients_doctor_idx      on public.patients(treating_doctor);
create index if not exists patients_case_type_idx   on public.patients(case_type);
create index if not exists patients_first_visit_idx on public.patients(first_visit_date);
create index if not exists patients_last_updated_idx on public.patients(last_updated desc);
create index if not exists patients_invoice_submitted_idx on public.patients(invoice_submitted_at);
-- Composite index so the list ORDER BY (first_visit_date desc, case_id desc) is
-- served straight from the index — no per-page sort as the table grows.
create index if not exists patients_list_order_idx on public.patients(first_visit_date desc, case_id desc);

-- Trigram indexes so the ILIKE '%term%' search box is index-backed
-- (a plain btree cannot serve a leading-wildcard ILIKE).
create extension if not exists pg_trgm;
create index if not exists patients_name_trgm   on public.patients using gin (patient_name gin_trgm_ops);
create index if not exists patients_doctor_trgm on public.patients using gin (treating_doctor gin_trgm_ops);
create index if not exists patients_phone_trgm  on public.patients using gin (phone_number gin_trgm_ops);
create index if not exists patients_erp_id_trgm on public.patients using gin (patient_erp_id gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3. Auto-update last_updated on every edit
-- ---------------------------------------------------------------------
create or replace function public.set_last_updated()
returns trigger language plpgsql as $$
begin
  new.last_updated := now();
  return new;
end;
$$;

drop trigger if exists trg_patients_last_updated on public.patients;
create trigger trg_patients_last_updated
  before update on public.patients
  for each row execute function public.set_last_updated();

-- Stamp invoice_submitted_at the first time a case reaches status >= 2.
create or replace function public.set_invoice_submitted_at()
returns trigger language plpgsql as $$
begin
  if new.status_code >= 2 and new.invoice_submitted_at is null then
    new.invoice_submitted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_submitted_at on public.patients;
create trigger trg_invoice_submitted_at
  before insert or update on public.patients
  for each row execute function public.set_invoice_submitted_at();

-- ---------------------------------------------------------------------
-- 4. Auto-create a profile row when a new auth user signs up
--    New users default to role 'staff' with no extra permissions.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 5. Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_delete_cases()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((
    select role = 'admin' or can_delete
    from public.profiles where id = auth.uid()
  ), false);
$$;

-- Distinct doctors for the filter dropdown (avoids scanning all rows in the app).
create or replace function public.distinct_doctors()
returns table(name text)
language sql stable security invoker set search_path = public as $$
  select distinct treating_doctor
  from public.patients
  where treating_doctor is not null and treating_doctor <> ''
  order by treating_doctor;
$$;

-- Dashboard aggregation in one round-trip (SQL does the counting/summing).
create or replace function public.dashboard_summary()
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from public.patients),
    'status_counts', (
      select coalesce(jsonb_object_agg(status_code::text, n), '{}'::jsonb)
      from (select status_code, count(*) n from public.patients group by status_code) s
    ),
    'type_counts', (
      select coalesce(jsonb_object_agg(case_type, n), '{}'::jsonb)
      from (select case_type, count(*) n from public.patients group by case_type) t
    ),
    'doctors', (
      select coalesce(jsonb_agg(jsonb_build_object('name', treating_doctor, 'n', n) order by n desc), '[]'::jsonb)
      from (select treating_doctor, count(*) n from public.patients
            where treating_doctor is not null and treating_doctor <> '' group by treating_doctor) d
    ),
    'volume', (
      select coalesce(jsonb_agg(jsonb_build_object('y', y, 'm', m, 'n', n)), '[]'::jsonb)
      from (select extract(year from first_visit_date)::int y,
                   extract(month from first_visit_date)::int m, count(*) n
            from public.patients group by 1, 2) v
    ),
    'fin', (
      select coalesce(jsonb_agg(jsonb_build_object('y', y, 'm', m, 'billed', billed, 'received', received)), '[]'::jsonb)
      from (select extract(year from first_visit_date)::int y,
                   extract(month from first_visit_date)::int m,
                   coalesce(sum(total_cost) filter (where status_code = 2), 0) billed,
                   coalesce(sum(total_cost) filter (where status_code = 3), 0) received
            from public.patients group by 1, 2) f
    ),
    'billed_total', (select coalesce(sum(total_cost) filter (where status_code = 2), 0) from public.patients),
    'received_total', (select coalesce(sum(total_cost) filter (where status_code = 3), 0) from public.patients)
  );
$$;

-- Financials page aggregation, grouped by invoice submission month
-- (invoice_submitted_at), plus the headline totals.
create or replace function public.financials_summary()
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'outstanding',      (select coalesce(sum(total_cost) filter (where status_code = 2), 0) from public.patients),
    'amount_collected', (select coalesce(sum(total_cost) filter (where status_code = 3), 0) from public.patients),
    'submitted_count',  (select count(*) from public.patients where status_code = 2),
    'received_count',   (select count(*) from public.patients where status_code = 3),
    'months', (
      select coalesce(jsonb_agg(
        jsonb_build_object('y', y, 'm', m, 'total_billed', total_billed,
          'hospital_share', hospital_share, 'all_paid', all_paid, 'count', cnt,
          's2', s2, 's3', s3)
        order by y, m), '[]'::jsonb)
      from (select extract(year from invoice_submitted_at)::int y,
                   extract(month from invoice_submitted_at)::int m,
                   coalesce(sum(total_cost), 0) total_billed,
                   coalesce(sum(hospital_share), 0) hospital_share,
                   bool_and(status_code = 3) all_paid,
                   count(*) cnt,
                   count(*) filter (where status_code = 2) s2,
                   count(*) filter (where status_code = 3) s3
            from public.patients
            where invoice_submitted_at is not null
            group by 1, 2) mm
    )
  );
$$;

-- Per-month counts for every status, grouped by first_visit_date (Statistics).
create or replace function public.statistics_monthly()
returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('y', y, 'm', m, 'total', total,
      's0', s0, 's1', s1, 's2', s2, 's3', s3)
    order by y, m), '[]'::jsonb)
  from (select extract(year from first_visit_date)::int y,
               extract(month from first_visit_date)::int m,
               count(*) total,
               count(*) filter (where status_code = 0) s0,
               count(*) filter (where status_code = 1) s1,
               count(*) filter (where status_code = 2) s2,
               count(*) filter (where status_code = 3) s3
        from public.patients
        where first_visit_date is not null
        group by 1, 2) mm;
$$;

-- Doctor page aggregation (status counts + paid/expected shares + monthly),
-- computed in SQL so totals are correct at any scale (never truncated).
create or replace function public.doctor_summary(doc text)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from public.patients where treating_doctor = doc),
    'status_counts', (
      select coalesce(jsonb_object_agg(status_code::text, n), '{}'::jsonb)
      from (select status_code, count(*) n from public.patients
            where treating_doctor = doc group by status_code) s
    ),
    'paid', (
      select jsonb_build_object(
        'doctor_share',   coalesce(sum(doctor_share)   filter (where status_code = 3), 0),
        'hospital_share', coalesce(sum(hospital_share) filter (where status_code = 3), 0),
        'materials_share',coalesce(sum(materials_share)filter (where status_code = 3), 0),
        'total_cost',     coalesce(sum(total_cost)     filter (where status_code = 3), 0))
      from public.patients where treating_doctor = doc
    ),
    'expected', (
      select jsonb_build_object(
        'doctor_share',   coalesce(sum(doctor_share), 0),
        'hospital_share', coalesce(sum(hospital_share), 0),
        'materials_share',coalesce(sum(materials_share), 0),
        'total_cost',     coalesce(sum(total_cost), 0))
      from public.patients where treating_doctor = doc
    ),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'y', y, 'm', m,
        'paid',     jsonb_build_object('doctor_share', pd, 'hospital_share', ph, 'materials_share', pm, 'total_cost', pt),
        'expected', jsonb_build_object('doctor_share', ed, 'hospital_share', eh, 'materials_share', em, 'total_cost', et))
        order by y desc, m), '[]'::jsonb)
      from (
        select extract(year from first_visit_date)::int y,
               extract(month from first_visit_date)::int m,
               coalesce(sum(doctor_share)   filter (where status_code = 3), 0) pd,
               coalesce(sum(hospital_share) filter (where status_code = 3), 0) ph,
               coalesce(sum(materials_share)filter (where status_code = 3), 0) pm,
               coalesce(sum(total_cost)     filter (where status_code = 3), 0) pt,
               coalesce(sum(doctor_share), 0)    ed,
               coalesce(sum(hospital_share), 0)  eh,
               coalesce(sum(materials_share), 0) em,
               coalesce(sum(total_cost), 0)      et
        from public.patients
        where treating_doctor = doc and first_visit_date is not null
        group by 1, 2
      ) mm
    )
  );
$$;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.patients enable row level security;

-- profiles: any authenticated user can read all profiles (needed to show
-- who entered a case, staff lists, etc.). Only admins can modify profiles
-- (this powers the permission-management page in a later step).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated with check (public.is_admin());

-- patients: all authenticated users can read + create + edit.
-- Only admins (or staff granted can_delete) may delete.
--
-- SECURITY NOTE (reviewed 2026-07-10, decision: accept):
-- This policy exposes ALL columns — including total_cost and the share
-- fields — to every authenticated user. RLS is row-level and cannot hide
-- individual columns per-user, so `can_view_financials` is enforced only in
-- the UI (dashboard aggregate totals + doctor money page). Per-case financials
-- are intentionally visible to staff because staff enter those numbers on the
-- intake form and the case list shows the per-case Total. A logged-in staff
-- user can therefore read total_cost/shares directly via the REST API. If this
-- is ever unacceptable, move the money columns to a separate `patient_financials`
-- table with its own RLS gated on a can_view_financials() function. See SECURITY.md.
-- Anonymous (unauthenticated) access is fully blocked — this policy is `to authenticated`.
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
  for select to authenticated using (true);

drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert to authenticated with check (entered_by = auth.uid());

drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients
  for update to authenticated using (true) with check (true);

drop policy if exists patients_delete on public.patients;
create policy patients_delete on public.patients
  for delete to authenticated using (public.can_delete_cases());

-- =====================================================================
-- Done. Next: create your first admin user (see setup notes).
-- =====================================================================
