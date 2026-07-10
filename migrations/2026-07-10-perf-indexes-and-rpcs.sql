-- =====================================================================
-- Performance: indexes + aggregation RPCs. Run once in the SQL Editor.
-- =====================================================================

-- --- Trigram indexes for case-insensitive substring search -----------
-- The search box uses ILIKE '%term%'. A plain btree index CANNOT serve a
-- leading-wildcard ILIKE, so we add GIN trigram indexes for name/doctor/phone.
create extension if not exists pg_trgm;

create index if not exists patients_name_trgm  on public.patients using gin (patient_name gin_trgm_ops);
create index if not exists patients_doctor_trgm on public.patients using gin (treating_doctor gin_trgm_ops);
create index if not exists patients_phone_trgm on public.patients using gin (phone_number gin_trgm_ops);

-- Ordering / recent-list support.
create index if not exists patients_last_updated_idx on public.patients (last_updated desc);

-- (btree indexes on status_code, treating_doctor, case_type, first_visit_date
--  already exist from schema.sql and serve the equality/range filters.)

-- --- Distinct doctors for the filter dropdown ------------------------
-- Avoids pulling every row's treating_doctor to the app on each list load.
create or replace function public.distinct_doctors()
returns table(name text)
language sql stable security invoker set search_path = public as $$
  select distinct treating_doctor
  from public.patients
  where treating_doctor is not null and treating_doctor <> ''
  order by treating_doctor;
$$;

-- --- Dashboard aggregation (one round-trip, computed in SQL) ----------
-- Returns all dashboard counts/sums as JSON so the app never has to fetch
-- and aggregate every row itself. SECURITY INVOKER -> respects RLS.
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
