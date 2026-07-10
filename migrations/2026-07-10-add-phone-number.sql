-- =====================================================================
-- Add an optional phone_number to patients.
-- Text (not numeric) so leading zeros / +964 country codes are preserved.
-- Run once in the Supabase SQL Editor.
-- =====================================================================
alter table public.patients
  add column if not exists phone_number text;
