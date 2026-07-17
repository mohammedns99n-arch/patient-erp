import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CASE_TYPES, STATUS_CODES } from "@/lib/constants";
import { getT, statusLabel, caseTypeLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { applyPatientFilters, hasAnyFilter, filtersToQuery, type PatientFilters } from "@/lib/patient-filters";
import PatientTable, { type PatientRow } from "./patient-table";
import ExportButton from "./export-button";

type Search = PatientFilters & { deleted?: string; page?: string };

const PAGE_SIZE = 25;

// Only the columns the table actually renders (lighter rows than the export).
const LIST_COLUMNS =
  "id, case_id, patient_erp_id, patient_name, phone_number, age, case_type, treating_doctor, diagnosis, total_cost, status_code, first_visit_date, last_updated";

const controlCls =
  "rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const perms = permissions(profile);

  const locale = await getLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const supabase = await createClient();

  const filters: PatientFilters = {
    q: sp.q,
    doctor: sp.doctor,
    status: sp.status,
    case_type: sp.case_type,
    from: sp.from,
    to: sp.to,
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Distinct doctors via RPC (falls back to a scan if the perf migration
  // hasn't been run yet, so the page never breaks).
  let doctors: string[] = [];
  const docRpc = await supabase.rpc("distinct_doctors");
  if (!docRpc.error && Array.isArray(docRpc.data)) {
    doctors = (docRpc.data as { name: string }[]).map((d) => d.name).filter(Boolean);
  } else {
    const { data: docRows } = await supabase.from("patients").select("treating_doctor");
    doctors = Array.from(
      new Set((docRows ?? []).map((d) => d.treating_doctor).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }

  // Filtered + paginated query, with an exact count for the pager.
  let query = supabase.from("patients").select(LIST_COLUMNS, { count: "exact" });
  query = applyPatientFilters(query, filters);
  query = query
    .order("first_visit_date", { ascending: false })
    .order("case_id", { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  const rows = (data ?? []) as PatientRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : from + 1;
  const showingTo = Math.min(from + PAGE_SIZE, total);

  return (
    <main className="max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("patients")}</h1>
        <div className="flex items-center gap-2">
          <ExportButton filters={filters} count={total} locale={locale} canViewFinancials={perms.canViewFinancials} />
          <a
            href="/patients/new"
            className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
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

      {/* Filters (submitting resets to page 1 since no page field is sent) */}
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
          {hasAnyFilter(filters) && (
            <a href="/patients" className="rounded-lg border border-black/15 dark:border-white/15 px-4 py-2 text-sm">
              {t("clear")}
            </a>
          )}
        </div>
      </form>

      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        {error
          ? `${t("errorWord")}: ${error.message}`
          : `${showingFrom}–${showingTo} / ${total} ${t("patientsWord")}`}
      </p>

      <PatientTable rows={rows} locale={locale} />

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm" aria-label="pagination">
          <PagerLink disabled={page <= 1} href={`/patients${filtersToQuery(filters, page - 1)}`} label={`‹ ${t("prevPage")}`} />
          <span className="px-3 text-black/60 dark:text-white/60 tabular-nums">{page} / {totalPages}</span>
          <PagerLink disabled={page >= totalPages} href={`/patients${filtersToQuery(filters, page + 1)}`} label={`${t("nextPage")} ›`} />
        </nav>
      )}
    </main>
  );
}

function PagerLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  if (disabled) {
    return <span className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-black/30 dark:text-white/30 cursor-not-allowed">{label}</span>;
  }
  return <a href={href} className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">{label}</a>;
}
