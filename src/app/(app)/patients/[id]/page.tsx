import { notFound, redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS, type StatusCode } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getT, statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import PatientForm from "../patient-form";
import { updatePatient } from "../actions";
import DeletePatientButton from "./delete-button";

export default async function EditPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const perms = permissions(profile);

  const locale = await getLocale();
  const t = getT(locale);
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) notFound();

  // Look up who entered this case (separate query keeps it robust).
  let enteredByName = "—";
  if (patient.entered_by) {
    const { data: enterer } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", patient.entered_by)
      .single();
    enteredByName = enterer?.full_name || enterer?.email || "—";
  }

  const status = STATUS[(patient.status_code as StatusCode) ?? 0];

  return (
    <main className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <a href="/patients" className="text-sm text-black/60 dark:text-white/60 hover:underline">← {t("allPatients")}</a>
          <h1 className="text-xl font-bold mt-1">
            {t("roCaseId")} #{patient.case_id} · {patient.patient_name}
          </h1>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-black/15"
          style={{ backgroundColor: status.rowBg, color: "#1a1a1a" }}
        >
          {patient.status_code} · {statusLabel(locale, patient.status_code)}
        </span>
      </div>

      {saved && (
        <div className="mb-6 rounded-lg border border-green-300/60 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 px-4 py-3 text-sm">
          ✓ {t("changesSaved")}
        </div>
      )}

      {/* Read-only auto fields */}
      <dl className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm rounded-xl border border-black/10 dark:border-white/10 p-4">
        <div>
          <dt className="text-black/50 dark:text-white/50">{t("roCaseId")}</dt>
          <dd className="font-medium">#{patient.case_id}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">{t("roFirstVisit")}</dt>
          <dd className="font-medium">{formatDate(patient.first_visit_date)}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">{t("roLastUpdated")}</dt>
          <dd className="font-medium">{formatDateTime(patient.last_updated)}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">{t("roEnteredBy")}</dt>
          <dd className="font-medium truncate" title={enteredByName}>{enteredByName}</dd>
        </div>
      </dl>

      <PatientForm
        mode="edit"
        action={updatePatient}
        locale={locale}
        initial={{
          id: patient.id,
          patient_name: patient.patient_name,
          phone_number: patient.phone_number,
          age: patient.age,
          case_type: patient.case_type,
          treating_doctor: patient.treating_doctor,
          procedure_type: patient.procedure_type,
          diagnosis: patient.diagnosis,
          status_code: patient.status_code,
          total_cost: patient.total_cost,
          materials_share: patient.materials_share,
          hospital_share: patient.hospital_share,
          doctor_share: patient.doctor_share,
          lab_investigations: patient.lab_investigations,
          imaging_studies: patient.imaging_studies,
          notes: patient.notes,
        }}
      />

      {perms.canDelete && (
        <section className="mt-10 rounded-xl border border-red-200 dark:border-red-900/50 p-4">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">{t("dangerZone")}</h2>
          <div className="mt-2 flex items-center justify-between gap-4">
            <p className="text-sm text-black/60 dark:text-white/60">{t("deleteDesc")}</p>
            <DeletePatientButton
              id={patient.id}
              label={`${t("roCaseId")} #${patient.case_id} (${patient.patient_name})`}
              buttonText={t("deleteCase")}
              deletingText={t("deleting")}
              confirmPrefix={t("confirmDeletePrefix")}
              confirmSuffix={t("confirmDeleteSuffix")}
            />
          </div>
        </section>
      )}
    </main>
  );
}
