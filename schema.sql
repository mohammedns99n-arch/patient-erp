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
  can_delete            boolean not null default false,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. patients: the core "patient case" entity
-- ---------------------------------------------------------------------
create table if not exists public.patients (
  id                 uuid primary key default gen_random_uuid(),
  case_id            bigint generated always as identity unique,   -- shown to staff
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
  status_code        integer not null default 0 check (status_code in (0,1,2,3)),
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
