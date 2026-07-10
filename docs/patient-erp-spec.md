# Patient Insurance Tracking ERP — Project Spec

## Purpose
Internal web app for a private Iraqi hospital to track patients treated under
the Ministry of Interior deferred-payment health insurance contract
("الضمان الصحي"). Replaces a manual Google Sheets process. Tracks each
patient's case details, the 3-stage payment status, and gives financial
summaries for Ministry billing/reporting.

## Users
- 1 admin (coordinator) — full access, can edit/delete any record, sees all
  financial totals, and controls permissions for other users (can grant or
  remove access to specific things like viewing financial totals, etc.)
- 3–5 staff (data entry) — can add and edit patients, cannot delete records
  or see financial totals/other restricted options, unless the admin grants
  that permission
- All users see all patients (no per-user filtering)
- Simple login (email + password) is enough for now — no need for SSO or
  complex role hierarchy beyond admin vs staff

## Language
- UI must support both Arabic and English, toggle switch in the header
- Data itself is entered as typed (no forced translation) — Arabic and
  English patient names/text can mix freely
- Layout must support RTL correctly when Arabic is selected

## Core Entity: Patient Case

| Field | Type | Notes |
|---|---|---|
| case_id | auto-generated | unique identifier, shown to staff |
| patient_name | text | required |
| age | number | required |
| case_type | enum: Medical / Surgical | required |
| treating_doctor | text | required |
| diagnosis | text | required |
| procedure_type | text | required |
| total_cost | number (IQD) | required |
| materials_share | number (IQD) | required |
| hospital_share | number (IQD) | required |
| doctor_share | number (IQD) | required |
| status_code | enum: 0 / 1 / 2 / 3 | 0 = Visit, 1 = Treated, 2 = Invoice Submitted, 3 = Payment Received |
| first_visit_date | date | auto-set when record is created, not editable after |
| last_updated | timestamp | auto-set on every edit |
| entered_by | user reference | auto-set to logged-in user |
| lab_investigations | text (free-form, multi-line) | optional, lab tests/investigations done for the patient |
| imaging_studies | text (free-form, multi-line) | optional, imaging studies (X-ray, CT, MRI, etc.) done for the patient |
| notes | text (free-form, multi-line) | optional, for any extra remarks staff want to record about the case |

**Validation rule:** materials_share + hospital_share + doctor_share must
equal total_cost. If not, show a warning (don't hard-block saving, just flag
it visually) — real-world data entry sometimes needs to be saved incomplete
and fixed later.

## Modules / Pages

### 1. Login page
Email + password, role-based redirect (admin vs staff see same nav, but
staff has fewer buttons — no delete button, no full financial dashboard,
just case-level view).

### 2. Patient intake form
All fields above except case_id, first_visit_date, last_updated, entered_by
(these are automatic). Simple single-page form, big touch-friendly fields
since staff may fill this in quickly between patients.

### 3. Case list / table view
- Table of all patients, color-coded row background by status_code
  (0 = gray #E0E0E0, 1 = yellow #FFF9C4, 2 = green #C8E6C9, 3 = blue #BBDEFB)
- Filters: by doctor, by status, by date range, by case type
- Search by patient name or doctor name
- Click a row to open/edit that patient's full record
- Status can be changed directly from this view (dropdown or button, not
  just inside the edit form) — this is the main daily action for staff

### 4. Dashboard (admin-visible; staff can see patient counts but not
   financial totals)
- Patient count by status (how many at 0 / 1 / 2 / 3 right now)
- Patient count by case type (how many Medical vs Surgical) — visible to
  staff as well
- Doctor list, where clicking a doctor's name opens a filtered view of all
  their patients with full case details, including each patient's current
  status (color-coded same as the case list) — visible to staff as well
- Monthly patient volume (count of first_visit_date, grouped by year then
  subdivided by month within each year)
- Financial summary (shown as an overall total, plus broken down by year
  then subdivided by month):
  - Total billed (sum of total_cost where status = 2)
  - Total received (sum of total_cost where status = 3)
  - Outstanding with Ministry (billed − received)
- Optional: breakdown by doctor, by case type

### 5. Export
Button to export the current filtered case list to Excel (.xlsx) —
needed for physical/email submission to the Ministry.

### 6. User & permission management (admin only)
A simple settings page where the admin can see the list of staff accounts
and toggle specific permissions per user — e.g., allow/deny viewing
financial totals, allow/deny deleting records. Starts with a couple of
toggle switches per user; doesn't need to be a complex permissions matrix
for v1.

## Explicitly out of scope for v1 (add later)
- WhatsApp integration for status updates
- Automatic cost-share calculation (staff enters all 4 numbers manually)
- Multi-hospital / multi-branch support
- Patient-facing portal
- SMS/email notifications

## Suggested tech stack
- Frontend: Next.js (React) + Tailwind CSS
- Backend/DB/Auth: Supabase (Postgres, built-in auth, generous free tier)
- Hosting: Vercel (free tier, auto-deploy from GitHub)
- Excel export: SheetJS (xlsx library)

## Build order (recommended)
1. Supabase project + database schema + auth setup
2. Login page + role-based routing
3. Patient intake form (connect to database)
4. Case list/table view with color coding and filters
5. Status update action from the table view
6. Dashboard with counts and financial totals
7. Excel export button
8. User & permission management page (admin only)
9. Deploy to Vercel, test with real (or dummy) data with the team
