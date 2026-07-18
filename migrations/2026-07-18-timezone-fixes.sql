-- =====================================================================
-- Timezone correctness fixes.
--
-- first_visit_date is a plain `date` in Baghdad local time; invoice_submitted_at
-- and payment_received_at are timestamptz (UTC). Casting the timestamps to
-- ::date used the session TZ (UTC), so a Baghdad-evening event landed on the
-- previous UTC day -> off-by-one (same-day showed -1).
--
-- Fix: convert every timestamp to the Asia/Baghdad calendar date BEFORE any
-- date math or month bucketing.
--
-- 1. processing_time_summary(): durations use Baghdad-local dates; each per-row
--    duration is clamped to >= 0 (greatest), and negatives are counted (neg_*)
--    so the app can log genuine data problems (e.g. payment before invoice).
-- 2. financials_summary(): month buckets for invoice_submitted_at and
--    payment_received_at use the Baghdad month, not the UTC month.
-- Idempotent (create or replace).
-- =====================================================================

create or replace function public.processing_time_summary()
returns jsonb
language sql stable security invoker set search_path = public as $$
  with base as (
    select
      first_visit_date as fv,
      (invoice_submitted_at at time zone 'Asia/Baghdad')::date as inv,
      (payment_received_at  at time zone 'Asia/Baghdad')::date as pay
    from public.patients
  )
  select jsonb_build_object(
    'overall', jsonb_build_object(
      'visit_to_invoice',   (select avg(greatest(0, inv - fv)) from base where inv is not null and fv is not null),
      'n_vi',               (select count(*) from base where inv is not null and fv is not null),
      'invoice_to_payment', (select avg(greatest(0, pay - inv)) from base where pay is not null and inv is not null),
      'n_ip',               (select count(*) from base where pay is not null and inv is not null),
      'visit_to_payment',   (select avg(greatest(0, pay - fv)) from base where pay is not null and fv is not null),
      'n_vp',               (select count(*) from base where pay is not null and fv is not null),
      -- raw-negative counts (before clamping) so the app can flag data issues
      'neg_vi', (select count(*) from base where inv is not null and fv is not null  and inv - fv < 0),
      'neg_ip', (select count(*) from base where pay is not null and inv is not null and pay - inv < 0),
      'neg_vp', (select count(*) from base where pay is not null and fv is not null  and pay - fv < 0)
    ),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object('y', y, 'm', m,
        'visit_to_invoice', vi, 'invoice_to_payment', ip, 'visit_to_payment', vp,
        'n_vi', nvi, 'n_ip', nip, 'n_vp', nvp) order by y, m), '[]'::jsonb)
      from (
        select extract(year from fv)::int y, extract(month from fv)::int m,
               avg(greatest(0, inv - fv)) filter (where inv is not null) vi,
               avg(greatest(0, pay - inv)) filter (where pay is not null and inv is not null) ip,
               avg(greatest(0, pay - fv)) filter (where pay is not null) vp,
               count(*) filter (where inv is not null) nvi,
               count(*) filter (where pay is not null and inv is not null) nip,
               count(*) filter (where pay is not null) nvp
        from base
        where fv is not null
        group by 1, 2
      ) mm
    )
  );
$$;

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
    ),
    'received_by_month', (
      select coalesce(jsonb_agg(
        jsonb_build_object('y', y, 'm', m, 'received', received) order by y, m), '[]'::jsonb)
      from (select extract(year  from (payment_received_at at time zone 'Asia/Baghdad'))::int y,
                   extract(month from (payment_received_at at time zone 'Asia/Baghdad'))::int m,
                   coalesce(sum(total_cost), 0) received
            from public.patients
            where status_code = 3 and payment_received_at is not null
            group by 1, 2) rm
    )
  );
$$;
