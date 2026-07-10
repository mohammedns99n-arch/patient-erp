-- =====================================================================
-- Fix: first_visit_date was stamped in UTC (current_date), causing an
-- off-by-one for cases entered between 00:00–02:59 Baghdad time.
-- Run this once in the Supabase SQL Editor.
-- =====================================================================

-- 1. Future inserts: stamp the Baghdad-local calendar date.
alter table public.patients
  alter column first_visit_date
  set default (now() at time zone 'Asia/Baghdad')::date;

-- 2. Backfill existing rows to the correct Baghdad date, reconstructed
--    from each row's true insert instant (created_at is a timestamptz).
--    Rows already correct are left unchanged by this assignment.
update public.patients
  set first_visit_date = (created_at at time zone 'Asia/Baghdad')::date;
