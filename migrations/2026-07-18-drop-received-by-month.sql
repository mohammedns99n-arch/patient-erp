-- =====================================================================
-- Remove received_by_month from financials_summary(): it existed only to feed
-- the "Revenue received per month" chart, which has been removed. No other
-- caller reads it. Everything else (outstanding, amount_collected, counts, and
-- the invoice-month `months` aggregation) is unchanged.
-- Idempotent (create or replace).
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
      from (select extract(year  from (invoice_submitted_at at time zone 'Asia/Baghdad'))::int y,
                   extract(month from (invoice_submitted_at at time zone 'Asia/Baghdad'))::int m,
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
