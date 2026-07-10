import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CASE_TYPES, STATUS_CODES } from "@/lib/constants";
import { getT, statusLabel, caseTypeLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import PatientTable, { type PatientRow } from "./patient-table";
import ExportButton, { type ExportRow } from "./export-button";

type Search = {
  q?: string;
  doctor?: string;
  status?: string;
  case_type?: string;
  from?: string;
  to?: string;
  deleted?: string;
};

const controlCls =
  "rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const locale = await getLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const supabase = await createClient();

  // Distinct doctors for the filter dropdown (all rows, unfiltered).
  const { data: docRows } = await supabase.from("patients").select("treating_doctor");
  const doctors = Array.from(
    new Set((docRows ?? []).map((d) => d.treating_doctor).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Build the filtered query.
  let query = supabase
    .from("patients")
    .select(
      "id, case_id, patient_name, phone_number, age, case_type, treating_doctor, diagnosis, procedure_type, total_cost, materials_share, hospital_share, doctor_share, status_code, first_visit_date, last_updated"
    );

  if (sp.status && sp.status !== "") query = query.eq("status_code", Number(sp.status));
  if (sp.case_type) query = query.eq("case_type", sp.case_type);
  if (sp.doctor) query = query.eq("treating_doctor", sp.doctor);
  if (sp.from) query = query.gte("first_visit_date", sp.from);
  if (sp.to) query = query.lte("first_visit_date", sp.to);
  if (sp.q) {
    // Strip characters that would break PostgREST's or() filter grammar.
    const safe = sp.q.replace(/[,()]/g, " ").trim();
    if (safe) {
      query = query.or(
        `patient_name.ilike.%${safe}%,treating_doctor.ilike.%${safe}%,phone_number.ilike.%${safe}%`
      );
    }
  }

  query = query
    .order("first_visit_date", { ascending: false })
    .order("case_id", { ascending: false });

  const { data, error } = await query;
  const rows = (data ?? []) as PatientRow[];
  const exportRows = (data ?? []) as unknown as ExportRow[];

  const hasFilters = Boolean(
    sp.q || sp.doctor || sp.status || sp.case_type || sp.from || sp.to
  );

  return (
    <main className="max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <a href="/" className="text-sm text-black/60 dark:text-white/60 hover:underline">← {t("home")}</a>
          <h1 className="text-xl font-bold mt-1">{t("patients")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton rows={exportRows} locale={locale} />
          <a
            href="/patients/new"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + {t("newPatient")}
          </a>
        </div>
      </header>

      {sp.deleted && (
        <div className="mb-4 rounded-lg border border-green-300/60 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 px-4 py-3 text-sm">
          ✓ {t("caseDeleted")}
        </div>
      )}

      {/* Filters */}
      <form method="get" action="/patients" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs text-black/60 dark:text-white/60">{t("searchLabel")}</label>
          <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder={t("searchPlaceholder")} className={`${controlCls} w-48`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="doctor" className="text-xs text-black/60 dark:text-white/60">{t("doctor")}</label>
          <select id="doctor" name="doctor" defaultValue={sp.doctor ?? ""} className={controlCls}>
            <option value="">{t("all")}</option>
            {doctors.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs text-black/60 dark:text-white/60">{t("statusWord")}</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className={controlCls}>
            <option value="">{t("all")}</option>
            {STATUS_CODES.map((c) => (
              <option key={c} value={c}>{c} — {statusLabel(locale, c)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="case_type" className="text-xs text-black/60 dark:text-white/60">{t("typeWord")}</label>
          <select id="case_type" name="case_type" defaultValue={sp.case_type ?? ""} className={controlCls}>
            <option value="">{t("all")}</option>
            {CASE_TYPES.map((ct) => (
              <option key={ct} value={ct}>{caseTypeLabel(locale, ct)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs text-black/60 dark:text-white/60">{t("visitFrom")}</label>
          <input id="from" name="from" type="date" defaultValue={sp.from ?? ""} className={controlCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs text-black/60 dark:text-white/60">{t("visitTo")}</label>
          <input id="to" name="to" type="date" defaultValue={sp.to ?? ""} className={controlCls} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-black/80 dark:bg-white/90 dark:text-black text-white px-4 py-2 text-sm font-medium">
            {t("apply")}
          </button>
          {hasFilters && (
            <a href="/patients" className="rounded-lg border border-black/15 dark:border-white/15 px-4 py-2 text-sm">
              {t("clear")}
            </a>
          )}
        </div>
      </form>

      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        {error ? `${t("errorWord")}: ${error.message}` : `${rows.length} ${t("patientsWord")}`}
      </p>

      <PatientTable rows={rows} locale={locale} />
    </main>
  );
}
