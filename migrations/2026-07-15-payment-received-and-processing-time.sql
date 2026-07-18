-- =====================================================================
-- 1. payment_received_at: timestamp a case reached status 3 (payment received),
--    mirroring invoice_submitted_at (status 2). Set by a trigger the first time
--    status hits 3; never cleared. Backfilled for existing status-3 rows from
--    last_updated (closest available proxy for when it was marked paid).
-- 2. financials_summary(): add received_by_month grouped by payment_received_at
--    (money attributed to the month it actually arrived).
-- 3. processing_time_summary(): average lifecycle durations (in days), overall
--    and per first-visit month.
-- Idempotent; safe to run more than once.
-- =====================================================================

alter table public.patients
  add column if not exists payment_received_at timestamptz;

create or replace function public.set_payment_received_at()
returns trigger language plpgsql as $$
begin
  if new.status_code >= 3 and new.payment_received_at is null then
    new.payment_received_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_received_at on public.patients;
create trigger trg_payment_received_at
  before insert or update on public.patients
  for each row execute function public.set_payment_received_at();

-- Backfill existing paid rows (proxy: last_updated).
update public.patients
  set payment_received_at = last_updated
  where status_code = 3 and payment_received_at is null;

create index if not exists patients_payment_received_idx
  on public.patients(payment_received_at);

-- financials_summary(): keep everything grouped by invoice_submitted_at, and add
-- received_by_month grouped by PAYMENT date.
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
    ),
    'received_by_month', (
      select coalesce(jsonb_agg(
        jsonb_build_object('y', y, 'm', m, 'received', received) order by y, m), '[]'::jsonb)
      from (select extract(year from payment_received_at)::int y,
                   extract(month from payment_received_at)::int m,
                   coalesce(sum(total_cost), 0) received
            from public.patients
            where status_code = 3 and payment_received_at is not null
            group by 1, 2) rm
    )
  );
$$;

-- Average lifecycle durations (whole days), overall + per first-visit month.
create or replace function public.processing_time_summary()
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'overall', jsonb_build_object(
      'visit_to_invoice',   (select avg(invoice_submitted_at::date - first_visit_date) from public.patients where invoice_submitted_at is not null and first_visit_date is not null),
      'n_vi',               (select count(*) from public.patients where invoice_submitted_at is not null and first_visit_date is not null),
      'invoice_to_payment', (select avg(payment_received_at::date - invoice_submitted_at::date) from public.patients where payment_received_at is not null and invoice_submitted_at is not null),
      'n_ip',               (select count(*) from public.patients where payment_received_at is not null and invoice_submitted_at is not null),
      'visit_to_payment',   (select avg(payment_received_at::date - first_visit_date) from public.patients where payment_received_at is not null and first_visit_date is not null),
      'n_vp',               (select count(*) from public.patients where payment_received_at is not null and first_visit_date is not null)
    ),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object('y', y, 'm', m,
        'visit_to_invoice', vi, 'invoice_to_payment', ip, 'visit_to_payment', vp,
        'n_vi', nvi, 'n_ip', nip, 'n_vp', nvp) order by y, m), '[]'::jsonb)
      from (
        select extract(year from first_visit_date)::int y,
               extract(month from first_visit_date)::int m,
               avg(invoice_submitted_at::date - first_visit_date) filter (where invoice_submitted_at is not null) vi,
               avg(payment_received_at::date - invoice_submitted_at::date) filter (where payment_received_at is not null and invoice_submitted_at is not null) ip,
               avg(payment_received_at::date - first_visit_date) filter (where payment_received_at is not null) vp,
               count(*) filter (where invoice_submitted_at is not null) nvi,
               count(*) filter (where payment_received_at is not null and invoice_submitted_at is not null) nip,
               count(*) filter (where payment_received_at is not null) nvp
        from public.patients
        where first_visit_date is not null
        group by 1, 2
      ) mm
    )
  );
$$;
