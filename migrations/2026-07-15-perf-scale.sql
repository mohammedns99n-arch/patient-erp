-- =====================================================================
-- Performance / scale hardening.
--
-- 1. Composite index for the patients list ORDER BY (first_visit_date DESC,
--    case_id DESC) so paginated listing is index-ordered (no sort per page).
-- 2. Re-declare the filter/search/sort indexes idempotently (already present;
--    here for the record + fresh installs). Text columns that are searched with
--    ILIKE '%..%' use trigram GIN indexes (a btree can't serve a leading
--    wildcard); equality-filtered columns use btree.
-- 3. doctor_summary(doc): DB-side aggregation for the doctor page so its totals
--    are correct and fast regardless of how many patients a doctor has (the
--    previous JS aggregation silently truncated at the 1000-row REST cap).
-- Idempotent; safe to run more than once.
-- =====================================================================

create extension if not exists pg_trgm;

-- (1) list ordering
create index if not exists patients_list_order_idx
  on public.patients (first_visit_date desc, case_id desc);

-- (2) filter / sort (btree)
create index if not exists patients_status_idx       on public.patients (status_code);
create index if not exists patients_doctor_idx       on public.patients (treating_doctor);
create index if not exists patients_case_type_idx    on public.patients (case_type);
create index if not exists patients_first_visit_idx  on public.patients (first_visit_date);
-- (2) search (trigram GIN, for ILIKE '%term%')
create index if not exists patients_name_trgm   on public.patients using gin (patient_name gin_trgm_ops);
create index if not exists patients_phone_trgm  on public.patients using gin (phone_number gin_trgm_ops);
create index if not exists patients_erp_id_trgm on public.patients using gin (patient_erp_id gin_trgm_ops);
create index if not exists patients_doctor_trgm on public.patients using gin (treating_doctor gin_trgm_ops);

-- (3) doctor page aggregation
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
