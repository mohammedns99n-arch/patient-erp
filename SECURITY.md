# Security notes — Supabase RLS

Reviewed 2026-07-10. Summary of the database access model and accepted trade-offs.

## Authentication boundary — ✅ enforced at the DB
Both `patients` and `profiles` have RLS enabled, and every policy is scoped
`to authenticated`. There is **no policy for the `anon` role**, so Postgres
default-denies all anonymous access. Verified with the publishable key and no
user session: reads return `[]` / `content-range: */0`.

- Only signed-in users can read, create, or edit patients.
- Delete is additionally gated: `patients_delete using (public.can_delete_cases())`
  (admin, or staff granted `can_delete`) — enforced at the DB, not just the UI.
- Only admins can modify `profiles` (`profiles_admin_update/insert using is_admin()`).
- New-user profile rows are created by the `handle_new_user` trigger
  (`SECURITY DEFINER`), so signup doesn't need an open insert policy.

## Financial columns — ⚠️ UI-gated only (accepted decision)
`total_cost`, `materials_share`, `hospital_share`, `doctor_share` live on the
`patients` table, and `patients_select` returns all columns to any authenticated
user. **RLS is row-level and cannot hide columns per-user**, so the
`can_view_financials` permission is enforced only in the app UI (the dashboard
aggregate totals and the doctor money page).

**Accepted risk:** a logged-in staff user — even without `can_view_financials` —
can read per-case `total_cost` and the share fields directly via the REST API
(`GET /rest/v1/patients?select=total_cost,...`). This is accepted because staff
enter those numbers on the intake form and the case list already shows the
per-case Total to everyone. The `can_view_financials` flag hides only the
*aggregate* financial reporting, in the UI.

**If this ever needs to be truly enforced:** move the money columns to a separate
`patient_financials` table (1:1 with `patients`) and give it an RLS policy like
`for select to authenticated using (public.can_view_financials())`, where
`can_view_financials()` is a `SECURITY DEFINER` function mirroring `is_admin()`.
The app's case list, export, dashboard, doctor page, and intake/edit form would
then need updating to read/write financials through that gated path.

## Minor observations (low severity, consistent with the spec)
- `patients_update using (true) with check (true)`: any authenticated user can
  edit any patient and could set `entered_by` to another user's id. Matches the
  spec's "all users can edit all patients", but there's no server-side guard on
  `entered_by`. (The app never sends it on update.)
- Admins can change their own `role` at the DB level; the app blocks self-demotion
  in the UI/action but the DB policy (`is_admin()`) does not.
