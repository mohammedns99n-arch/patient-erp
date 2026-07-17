"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, permissions } from "@/lib/auth";
import { getT, type TranslateFn } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { applyPatientFilters, type PatientFilters } from "@/lib/patient-filters";
import { resolvePatientPaid } from "@/lib/revenue";

export type SaveState = { error: string | null };

const EXPORT_COLUMNS =
  "case_id, patient_erp_id, patient_name, phone_number, age, case_type, treating_doctor, diagnosis, procedure_type, total_cost, materials_share, hospital_share, doctor_share, revenue_total, revenue_patient_paid, revenue_insurance_due, status_code, first_visit_date, last_updated";

/**
 * Fetch the FULL filtered patient set for Excel export (not just the current
 * page). Runs the same filters as the list, without pagination.
 */
export async function fetchPatientsForExport(filters: PatientFilters) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], error: "Not signed in." };

  let query = supabase.from("patients").select(EXPORT_COLUMNS);
  query = applyPatientFilters(query, filters);
  query = query
    .order("first_visit_date", { ascending: false })
    .order("case_id", { ascending: false });

  const { data, error } = await query;
  return { rows: data ?? [], error: error ? error.message : null };
}

function num(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Shared validation + field extraction for the editable patient fields.
 *
 * @param requireErpId   enforce that patient_erp_id is present (new records only).
 * @param includeRevenue include the Revenue Collection fields. Only true when the
 *   user can view financials — otherwise the fields are omitted entirely so that
 *   a save by a non-financial user never overwrites existing revenue values.
 *   revenue_insurance_due is a generated DB column and is never written here.
 */
function readFields(
  formData: FormData,
  t: TranslateFn,
  { requireErpId, includeRevenue }: { requireErpId: boolean; includeRevenue: boolean }
):
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; error: string } {
  const patient_erp_id = String(formData.get("patient_erp_id") ?? "").trim();
  const patient_name = String(formData.get("patient_name") ?? "").trim();
  const ageRaw = String(formData.get("age") ?? "").trim();
  const case_type = String(formData.get("case_type") ?? "").trim();
  const treating_doctor = String(formData.get("treating_doctor") ?? "").trim();
  const diagnosis = String(formData.get("diagnosis") ?? "").trim();
  const procedure_type = String(formData.get("procedure_type") ?? "").trim();
  const status_code = Number(formData.get("status_code") ?? 0);

  if (
    !patient_name ||
    ageRaw === "" ||
    !case_type ||
    !treating_doctor ||
    !diagnosis ||
    !procedure_type
  ) {
    return { ok: false, error: t("errRequiredFields") };
  }
  if (requireErpId && !patient_erp_id) {
    return { ok: false, error: t("errErpIdRequired") };
  }

  const age = Number(ageRaw);
  if (!Number.isInteger(age) || age < 0 || age > 150) {
    return { ok: false, error: t("errAge") };
  }
  if (!["Medical", "Surgical"].includes(case_type)) {
    return { ok: false, error: t("errCaseType") };
  }

  const fields: Record<string, unknown> = {
    patient_erp_id: patient_erp_id || null,
    patient_name,
    phone_number: String(formData.get("phone_number") ?? "").trim() || null,
    age,
    case_type,
    treating_doctor,
    diagnosis,
    procedure_type,
    total_cost: num(formData, "total_cost"),
    materials_share: num(formData, "materials_share"),
    hospital_share: num(formData, "hospital_share"),
    doctor_share: num(formData, "doctor_share"),
    status_code: [0, 1, 2, 3].includes(status_code) ? status_code : 0,
    lab_investigations:
      String(formData.get("lab_investigations") ?? "").trim() || null,
    imaging_studies:
      String(formData.get("imaging_studies") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };

  if (includeRevenue) {
    const revenue_total = num(formData, "revenue_total");
    const revenue_patient_paid = resolvePatientPaid(
      String(formData.get("revenue_patient_paid") ?? ""),
      revenue_total
    );
    fields.revenue_total = revenue_total;
    fields.revenue_patient_paid = revenue_patient_paid;
  }

  return { ok: true, fields };
}

export async function createPatient(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getSessionProfile();
  const canViewFinancials = profile ? permissions(profile).canViewFinancials : false;

  const t = getT(await getLocale());
  const parsed = readFields(formData, t, {
    requireErpId: true,
    includeRevenue: canViewFinancials,
  });
  if (!parsed.ok) return { error: parsed.error };

  const { data, error } = await supabase
    .from("patients")
    .insert({ ...parsed.fields, entered_by: user.id })
    .select("case_id")
    .single();

  if (error) return { error: error.message };

  redirect(`/patients/new?created=${data.case_id}`);
}

/**
 * Quick status change from the case-list table (the main daily action).
 * Called directly from the client; last_updated auto-bumps via DB trigger.
 */
export async function updateStatus(
  id: string,
  status: number
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (![0, 1, 2, 3].includes(status)) return { error: "Invalid status." };

  const { error } = await supabase
    .from("patients")
    .update({ status_code: status })
    .eq("id", id);

  return { error: error ? error.message : null };
}

/**
 * Delete a patient case. Gated by can_delete (admins implicitly). The
 * patients_delete RLS policy enforces the same rule at the DB level.
 */
export async function deletePatient(
  id: string
): Promise<{ error: string } | void> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!permissions(profile).canDelete) {
    return { error: getT(await getLocale())("errNoDeletePerm") };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) return { error: error.message };

  redirect("/patients?deleted=1");
}

export async function updatePatient(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing patient id." };

  const profile = await getSessionProfile();
  const canViewFinancials = profile ? permissions(profile).canViewFinancials : false;

  const t = getT(await getLocale());
  // ERP ID is not required on edit (legacy rows may not have one yet).
  const parsed = readFields(formData, t, {
    requireErpId: false,
    includeRevenue: canViewFinancials,
  });
  if (!parsed.ok) return { error: parsed.error };

  // Note: first_visit_date, case_id, entered_by are intentionally NOT updated.
  const { error } = await supabase
    .from("patients")
    .update(parsed.fields)
    .eq("id", id);

  if (error) return { error: error.message };

  redirect(`/patients/${id}?saved=1`);
}
