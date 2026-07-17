-- =====================================================================
-- Feature 1: manual Patient ERP ID
--   Text, typed by staff. App requires it on create; nullable here so
--   existing rows don't break. Duplicates are allowed (no unique index).
-- Feature 2: Revenue Collection (independent from the cost-share breakdown)
--   revenue_total          — entered manually
--   revenue_patient_paid   — resolved amount (a "15%" input is converted to
--                            an amount by the app before it is stored)
--   revenue_insurance_due  — generated: always revenue_total − patient_paid
-- Idempotent; safe to run more than once.
-- =====================================================================

alter table public.patients
  add column if not exists patient_erp_id text;

alter table public.patients
  add column if not exists revenue_total numeric(14,2) not null default 0;

alter table public.patients
  add column if not exists revenue_patient_paid numeric(14,2) not null default 0;

alter table public.patients
  add column if not exists revenue_insurance_due numeric(14,2)
  generated always as (revenue_total - revenue_patient_paid) stored;

-- Trigram index so the ILIKE '%term%' search box can match patient_erp_id fast.
create extension if not exists pg_trgm;
create index if not exists patients_erp_id_trgm
  on public.patients using gin (patient_erp_id gin_trgm_ops);
