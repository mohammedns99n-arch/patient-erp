import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT, monthName } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { getAggregate } from "@/lib/dashboard-data";
import { fmtMoney } from "@/lib/revenue";
import { formatDate, todayInBaghdad } from "@/lib/dates";
import { LineChart } from "../charts";

const cardCls =
  "rounded-2xl bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 p-5 shadow-sm";

function daysSince(dateStr: string): number {
  const then = Date.parse(dateStr);
  const now = Date.parse(todayInBaghdad());
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

export default async function FinancialsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  // Gated by the existing can_view_financials permission.
  if (!permissions(profile).canViewFinancials) redirect("/dashboard");

  const locale = await getLocale();
  const t = getT(locale);
  const supabase = await createClient();

  const agg = await getAggregate(supabase);
  const outstanding = agg.billedTotal; // status 2: submitted but not yet received
  const submittedCount = agg.statusCounts[2] ?? 0;
  const receivedCount = agg.statusCounts[3] ?? 0;
  const denom = submittedCount + receivedCount;
  const collectionRate = denom ? Math.round((receivedCount / denom) * 100) : null;

  // Oldest pending (status 2) invoices, longest-waiting first.
  const { data: pendingData } = await supabase
    .from("patients")
    .select("id, case_id, patient_erp_id, patient_name, treating_doctor, total_cost, first_visit_date")
    .eq("status_code", 2)
    .order("first_visit_date", { ascending: true })
    .limit(15);
  const pending = (pendingData ?? []) as {
    id: string; case_id: number; patient_erp_id: string | null; patient_name: string;
    treating_doctor: string; total_cost: number | string | null; first_visit_date: string;
  }[];

  const months = Array.from({ length: 12 }, (_, i) => monthName(locale, i));
  const yearsAsc = [...agg.years].sort((a, b) => a.localeCompare(b));
  const PALETTE = ["#10b981", "#5B8DEF", "#F2994A", "#9B51E0", "#EB5757", "#2D9CDB"];
  const hasRevenue = yearsAsc.some((y) => (agg.finByYear[y] ?? []).some((m) => m.received > 0));

  return (
    <main className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t("financials")}</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">{t("finDesc")}</p>
      </header>

      {/* Headline figures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <section className="rounded-2xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-6">
          <div className="text-sm font-medium text-amber-800 dark:text-amber-300">{t("finOutstanding")}</div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-amber-900 dark:text-amber-200" dir="ltr">
            {fmtMoney(outstanding)} <span className="text-lg font-normal">{t("iqd")}</span>
          </div>
          <div className="mt-1 text-xs text-amber-800/70 dark:text-amber-300/70">{t("finOutstandingDesc")}</div>
        </section>

        <section className={cardCls}>
          <div className="text-sm font-medium text-black/60 dark:text-white/60">{t("finCollectionRate")}</div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {collectionRate === null ? "—" : `${collectionRate}%`}
          </div>
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">
            {t("finCollectionDesc")}
            {denom > 0 && (
              <span className="tabular-nums"> · {receivedCount} / {denom} {t("invoicesWord")}</span>
            )}
          </div>
        </section>
      </div>

      {/* Revenue received per month */}
      <section className={`${cardCls} mb-6`}>
        <h2 className="font-bold mb-3">{t("finRevenuePerMonth")}</h2>
        {hasRevenue ? (
          <LineChart
            xLabels={months}
            formatY={(n) => fmtMoney(n)}
            series={yearsAsc
              .filter((y) => (agg.finByYear[y] ?? []).some((m) => m.received > 0))
              .map((y, i) => ({
                name: y,
                color: PALETTE[i % PALETTE.length],
                points: (agg.finByYear[y] ?? Array(12).fill({ received: 0 })).map((m) => m.received),
              }))}
          />
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">{t("statNoData")}</p>
        )}
      </section>

      {/* Oldest pending invoices */}
      <section className={`${cardCls} mb-6`}>
        <h2 className="font-bold">{t("finOldestPending")}</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mb-3">{t("finOldestPendingDesc")}</p>
        {pending.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("noPendingInvoices")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
                <tr>
                  <th className="text-start px-4 py-2 font-medium">{t("colCase")}</th>
                  <th className="text-start px-4 py-2 font-medium">{t("colPatient")}</th>
                  <th className="text-start px-4 py-2 font-medium hidden sm:table-cell">{t("colDoctor")}</th>
                  <th className="text-end px-4 py-2 font-medium">{t("colTotal")}</th>
                  <th className="text-start px-4 py-2 font-medium hidden md:table-cell">{t("colFirstVisit")}</th>
                  <th className="text-end px-4 py-2 font-medium">{t("colDaysWaiting")}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => {
                  const days = daysSince(p.first_visit_date);
                  return (
                    <tr key={p.id} className="border-t border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <a href={`/patients/${p.id}`} className="font-medium text-blue-600 hover:underline">#{p.case_id}</a>
                        {p.patient_erp_id && <span className="ms-2 text-xs text-black/40 dark:text-white/40" dir="ltr">{p.patient_erp_id}</span>}
                      </td>
                      <td className="px-4 py-2.5">{p.patient_name}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">{p.treating_doctor}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums whitespace-nowrap" dir="ltr">{fmtMoney(Number(p.total_cost ?? 0) || 0)}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell whitespace-nowrap">{formatDate(p.first_visit_date)}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums whitespace-nowrap font-semibold">
                        {days} <span className="text-xs font-normal text-black/50 dark:text-white/50">{t("daysWord")}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
