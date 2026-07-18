-- =====================================================================
-- Financials revamp support.
--
-- 1. invoice_submitted_at: the timestamp a case reached status 2 (invoice
--    submitted). Set automatically by a trigger the first time a case reaches
--    status >= 2 (covers a direct jump to 3 too). Never cleared, so it stays
--    the original submission date. All month grouping on the Financials page is
--    by this column.
-- 2. financials_summary(): SQL-side aggregation grouped by invoice_submitted_at
--    (avoids the 1000-row REST limit): monthly total_cost + hospital_share, and
--    whether every case that month is fully paid (status 3).
-- Idempotent; safe to run more than once.
-- =====================================================================

alter table public.patients
  add column if not exists invoice_submitted_at timestamptz;

-- Stamp on the first transition into status >= 2 (submitted or paid).
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

-- Backfill any existing already-submitted/paid rows (uses last_updated as the
-- best available proxy for when the status changed).
update public.patients
  set invoice_submitted_at = last_updated
  where status_code >= 2 and invoice_submitted_at is null;

create index if not exists patients_invoice_submitted_idx
  on public.patients(invoice_submitted_at);

-- Financials aggregation, grouped by invoice submission month.
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
        jsonb_build_object(
          'y', y, 'm', m,
          'total_billed', total_billed,
          'hospital_share', hospital_share,
          'all_paid', all_paid,
          'count', cnt
        ) order by y, m), '[]'::jsonb)
      from (
        select extract(year from invoice_submitted_at)::int y,
               extract(month from invoice_submitted_at)::int m,
               coalesce(sum(total_cost), 0) total_billed,
               coalesce(sum(hospital_share), 0) hospital_share,
               bool_and(status_code = 3) all_paid,
               count(*) cnt
        from public.patients
        where invoice_submitted_at is not null
        group by 1, 2
      ) mm
    )
  );
$$;
