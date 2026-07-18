import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS, STATUS_CODES, type StatusCode } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { getT, statusLabel, monthName } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { getDoctorSummary, type DoctorMonth } from "@/lib/doctor-data";

function iqd(n: number) {
  return n.toLocaleString("en-US");
}

const SHARES = [
  { key: "doctor_share", labelKey: "fDoctorShare" },
  { key: "hospital_share", labelKey: "fHospital" },
  { key: "materials_share", labelKey: "fMaterials" },
  { key: "total_cost", labelKey: "fTotal" },
] as const;

const DPAGE_SIZE = 50;

type ListRow = {
  id: string;
  case_id: number;
  patient_name: string;
  status_code: number;
  first_visit_date: string;
  doctor_share: number | string | null;
  hospital_share: number | string | null;
  materials_share: number | string | null;
  total_cost: number | string | null;
};

export default async function DoctorPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const perms = permissions(profile);
  const canMoney = perms.canViewFinancials;

  const locale = await getLocale();
  const t = getT(locale);

  const { name } = await params;
  const doctor = decodeURIComponent(name);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * DPAGE_SIZE;
  const to = from + DPAGE_SIZE - 1;

  const supabase = await createClient();

  // Aggregates computed in SQL (correct & fast at any scale).
  const summary = await getDoctorSummary(supabase, doctor);

  // Only the current page of this doctor's patients (never all rows at once).
  const { data, count } = await supabase
    .from("patients")
    .select(
      "id, case_id, patient_name, status_code, first_visit_date, doctor_share, hospital_share, materials_share, total_cost",
      { count: "exact" }
    )
    .eq("treating_doctor", doctor)
    .order("first_visit_date", { ascending: false })
    .order("case_id", { ascending: false })
    .range(from, to);
  const rows = (data ?? []) as ListRow[];
  const total = summary.total;
  const listTotal = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(listTotal / DPAGE_SIZE));

  // Group the monthly rows (already ordered year desc, month asc) by year.
  const monthlyByYear = new Map<string, DoctorMonth[]>();
  for (const mo of summary.monthly) {
    const y = String(mo.year);
    if (!monthlyByYear.has(y)) monthlyByYear.set(y, []);
    monthlyByYear.get(y)!.push(mo);
  }
  const years = Array.from(monthlyByYear.keys());

  const pageHref = (p: number) => `/doctors/${encodeURIComponent(doctor)}?page=${p}`;

  return (
    <main className="max-w-5xl mx-auto">
      <header className="mb-6">
        <a href="/dashboard" className="text-sm text-black/60 dark:text-white/60 hover:underline">← {t("dashboard")}</a>
        <h1 className="text-2xl font-bold mt-1">{doctor}</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">
          {total} {t("patientsWord")}
          {" · "}
          {STATUS_CODES.map((c) => `${summary.statusCounts[c] ?? 0} ${statusLabel(locale, c)}`).join(" · ")}
        </p>
      </header>

      {total === 0 && (
        <p className="rounded-xl border border-black/10 dark:border-white/10 p-6 text-black/60 dark:text-white/60">
          {t("noPatientsForDoctor")}{" "}
          <a href="/dashboard" className="text-blue-600 hover:underline">{t("backToDashboard")}</a>.
        </p>
      )}

      {/* Summary totals: Paid vs Expected across the four dimensions (gated) */}
      {total > 0 && canMoney && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">{t("summaryHeading")}</h2>
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10 max-w-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
                <tr>
                  <th className="text-start px-4 py-2 font-medium"> </th>
                  <th className="text-end px-4 py-2 font-medium">{t("paid")}</th>
                  <th className="text-end px-4 py-2 font-medium">{t("expected")}</th>
                </tr>
              </thead>
              <tbody>
                {SHARES.map((s) => (
                  <tr key={s.key} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-4 py-2">{t(s.labelKey)}</td>
                    <td className="px-4 py-2 text-end tabular-nums text-green-700 dark:text-green-400">{iqd(summary.paid[s.key])}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{iqd(summary.expected[s.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Monthly breakdown (gated) */}
      {total > 0 && canMoney && years.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">{t("monthlyBreakdown")}</h2>
          <div className="space-y-4">
            {years.map((y) => (
              <div key={y} className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                <div className="px-4 py-2 bg-black/5 dark:bg-white/5 font-semibold">{y}</div>
                <table className="w-full text-sm">
                  <thead className="text-black/60 dark:text-white/60">
                    <tr className="border-t border-black/5 dark:border-white/5">
                      <th rowSpan={2} className="text-start px-4 py-2 font-medium align-bottom">{t("colMonth")}</th>
                      {SHARES.map((s) => (
                        <th key={s.key} colSpan={2} className="text-center px-3 py-1.5 font-medium border-l border-black/5 dark:border-white/5">{t(s.labelKey)}</th>
                      ))}
                    </tr>
                    <tr className="border-t border-black/5 dark:border-white/5 text-xs">
                      {SHARES.map((s) => (
                        <Fragment key={s.key}>
                          <th className="text-end px-3 py-1 font-medium border-l border-black/5 dark:border-white/5">{t("paid")}</th>
                          <th className="text-end px-3 py-1 font-medium">{t("expected")}</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyByYear.get(y)!.map((cell) => (
                      <tr key={cell.month} className="border-t border-black/5 dark:border-white/5">
                        <td className="px-4 py-2 whitespace-nowrap text-black/60 dark:text-white/60">{monthName(locale, cell.month)} {y}</td>
                        {SHARES.map((s) => (
                          <Fragment key={s.key}>
                            <td className="px-3 py-2 text-end tabular-nums text-green-700 dark:text-green-400 border-l border-black/5 dark:border-white/5">{iqd(cell.paid[s.key])}</td>
                            <td className="px-3 py-2 text-end tabular-nums">{iqd(cell.expected[s.key])}</td>
                          </Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Per-patient list (paginated; money columns gated) */}
      {total > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">{t("patientsHeading")}</h2>
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
                <tr>
                  <th className="text-start px-3 py-2 font-medium">{t("colCase")}</th>
                  <th className="text-start px-3 py-2 font-medium">{t("colPatient")}</th>
                  <th className="text-start px-3 py-2 font-medium">{t("colFirstVisit")}</th>
                  <th className="text-start px-3 py-2 font-medium">{t("colStatus")}</th>
                  {canMoney &&
                    SHARES.map((s) => (
                      <th key={s.key} className="text-end px-3 py-2 font-medium whitespace-nowrap">{t(s.labelKey)}</th>
                    ))}
                  <th className="text-start px-3 py-2 font-medium">{t("colPayment")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = STATUS[(r.status_code as StatusCode) ?? 0];
                  const isPaid = r.status_code === 3;
                  return (
                    <tr key={r.id} className="border-t border-black/5 dark:border-white/5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">#{r.case_id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <a href={`/patients/${r.id}`} className="text-blue-600 hover:underline">{r.patient_name}</a>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-black/60 dark:text-white/60">{formatDate(r.first_visit_date)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-black/15" style={{ backgroundColor: status.rowBg, color: "#1a1a1a" }}>
                          {r.status_code} · {statusLabel(locale, r.status_code)}
                        </span>
                      </td>
                      {canMoney &&
                        SHARES.map((s) => (
                          <td key={s.key} className="px-3 py-2 text-end tabular-nums whitespace-nowrap">{iqd(Number(r[s.key] ?? 0) || 0)}</td>
                        ))}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPaid ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"}`}>
                          {isPaid ? t("paid") : t("expected")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-center gap-2 text-sm" aria-label="pagination">
              {page <= 1 ? (
                <span className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-black/30 dark:text-white/30">‹ {t("prevPage")}</span>
              ) : (
                <a href={pageHref(page - 1)} className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">‹ {t("prevPage")}</a>
              )}
              <span className="px-3 text-black/60 dark:text-white/60 tabular-nums">{page} / {totalPages}</span>
              {page >= totalPages ? (
                <span className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-black/30 dark:text-white/30">{t("nextPage")} ›</span>
              ) : (
                <a href={pageHref(page + 1)} className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">{t("nextPage")} ›</a>
              )}
            </nav>
          )}

          {!canMoney && (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">{t("moneyHidden")}</p>
          )}
        </section>
      )}
    </main>
  );
}
