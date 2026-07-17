-- =====================================================================
-- Add a new per-user permission: can_view_statistics.
-- Gates the new "Statistics" sidebar page (admins implicitly have it).
-- Default false so nobody sees it until an admin grants it.
-- Idempotent; safe to run more than once.
-- =====================================================================
alter table public.profiles
  add column if not exists can_view_statistics boolean not null default false;
