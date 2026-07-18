-- =====================================================================
-- Timezone audit: single source of truth for Baghdad-local dates in SQL.
--
-- baghdad_date(timestamptz) -> the Asia/Baghdad calendar date of a UTC instant.
-- Every RPC that turns a timestamp into a date (for grouping or differencing)
-- and the first_visit_date default now route through this one function, so the
-- conversion can't drift between call sites.
--
-- Columns unchanged: first_visit_date is a Baghdad-local `date`; last_updated /
-- invoice_submitted_at / payment_received_at are UTC timestamptz. Triggers keep
-- using now() (a correct instant). Only date DERIVATION is centralized here.
-- Idempotent (create or replace / set default).
-- =====================================================================

-- STABLE (not IMMUTABLE): named-timezone conversion depends on the tz database.
create or replace function public.baghdad_date(ts timestamptz)
returns date
language sql stable set search_path = public as $$
  select (ts at time zone 'Asia/Baghdad')::date;
$$;

-- Route the write default through the helper (same value as before).
alter table public.patients
  alter column first_visit_date set default public.baghdad_date(now());

-- financials_summary: month buckets via baghdad_date().
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
      from (select extract(year  from public.baghdad_date(invoice_submitted_at))::int y,
                   extract(month from public.baghdad_date(invoice_submitted_at))::int m,
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
        jsonb_build_object('y', y, 'm', m, 'received', received,
          'hospital_share', hospital_share, 'count', cnt)
        order by y, m), '[]'::jsonb)
      from (select extract(year  from public.baghdad_date(payment_received_at))::int y,
                   extract(month from public.baghdad_date(payment_received_at))::int m,
                   coalesce(sum(total_cost), 0) received,
                   coalesce(sum(hospital_share), 0) hospital_share,
                   count(*) cnt
            from public.patients
            where status_code = 3 and payment_received_at is not null
            group by 1, 2) rm
    )
  );
$$;

-- processing_time_summary: all durations in Baghdad calendar days via baghdad_date().
create or replace function public.processing_time_summary()
returns jsonb
language sql stable security invoker set search_path = public as $$
  with base as (
    select
      first_visit_date as fv,
      public.baghdad_date(invoice_submitted_at) as inv,
      public.baghdad_date(payment_received_at)  as pay
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
