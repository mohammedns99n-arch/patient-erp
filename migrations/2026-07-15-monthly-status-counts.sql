-- =====================================================================
-- Monthly status-count breakdown tables (Financials + Statistics).
--
-- 1. financials_summary(): add per-month status-2 and status-3 counts
--    (s2, s3), grouped by invoice_submitted_at, keeping existing fields.
-- 2. statistics_monthly(): NEW — per-month counts for every status
--    (s0..s3 + total), grouped by first_visit_date.
-- Idempotent (create or replace); safe to run more than once.
-- =====================================================================

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

-- Per-month counts for every status, grouped by first_visit_date.
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
