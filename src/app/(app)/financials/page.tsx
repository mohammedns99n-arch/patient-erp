import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { getFinancials, getProcessingTime } from "@/lib/financials-data";
import { fmtMoney } from "@/lib/revenue";
import { formatDateTime } from "@/lib/dates";
import { MonthlyDonut, MonthlyBreakdown } from "./financials-charts";
import MonthlyCountTable, { type MonthRow } from "../monthly-count-table";
import ProcessingTimeSection from "./processing-time";
import { financialsMonthNames } from "./actions";

const cardCls =
  "rounded-2xl bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 p-5 shadow-sm";

function daysSince(iso: string): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export default async function FinancialsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!permissions(profile).canViewFinancials) redirect("/dashboard");

  const locale = await getLocale();
  const t = getT(locale);
  const supabase = await createClient();

  const fin = await getFinancials(supabase);
  const processing = await getProcessingTime(supabase);
  const denom = fin.submittedCount + fin.receivedCount;
  const collectionRate = denom ? Math.round((fin.receivedCount / denom) * 100) : null;

  // Monthly status-count table rows (by invoice submission month; statuses 2 & 3).
  const monthCountRows: MonthRow[] = fin.months.map((m) => ({
    key: m.key,
    year: m.year,
    month: m.month,
    total: m.count,
    counts: { 2: m.s2, 3: m.s3 },
    allPaid: m.allPaid,
  }));

  // Oldest pending (status 2) invoices submitted MORE THAN A MONTH AGO.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 1);
  const { data: pendingData } = await supabase
    .from("patients")
    .select("id, case_id, patient_erp_id, patient_name, treating_doctor, total_cost, invoice_submitted_at")
    .eq("status_code", 2)
    .lt("invoice_submitted_at", cutoff.toISOString())
    .order("invoice_submitted_at", { ascending: true })
    .limit(15);
  const pending = (pendingData ?? []) as {
    id: string; case_id: number; patient_erp_id: string | null; patient_name: string;
    treating_doctor: string; total_cost: number | string | null; invoice_submitted_at: string;
  }[];

  return (
    <main className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t("financials")}</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">{t("finDesc")}</p>
      </header>

      {/* Headline figures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <section className="rounded-2xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-6">
          <div className="text-sm font-medium text-amber-800 dark:text-amber-300">{t("finOutstanding")}</div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-amber-900 dark:text-amber-200" dir="ltr">
            {fmtMoney(fin.outstanding)} <span className="text-lg font-normal">{t("iqd")}</span>
          </div>
          <div className="mt-1 text-xs text-amber-800/70 dark:text-amber-300/70">{t("finOutstandingDesc")}</div>
        </section>

        <section className="rounded-2xl border border-emerald-300/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-6">
          <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{t("finAmountCollected")}</div>
          <div className="mt-2 text-4xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200" dir="ltr">
            {fmtMoney(fin.amountCollected)} <span className="text-lg font-normal">{t("iqd")}</span>
          </div>
          <div className="mt-1 text-xs text-emerald-800/70 dark:text-emerald-300/70">{t("finAmountCollectedDesc")}</div>
        </section>
      </div>

      {/* Collection rate — compact tile */}
      <div className="mb-6">
        <div className="inline-flex flex-wrap items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-4 py-2.5 shadow-sm">
          <span className="text-sm text-black/60 dark:text-white/60">{t("finCollectionRate")}</span>
          <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {collectionRate === null ? "—" : `${collectionRate}%`}
          </span>
          {denom > 0 && (
            <span className="text-xs text-black/50 dark:text-white/50 tabular-nums">{fin.receivedCount} / {denom} {t("invoicesWord")}</span>
          )}
        </div>
      </div>

      {/* Processing time — compact lifecycle averages */}
      <section className={`${cardCls} mb-6`}>
        <h2 className="font-bold">{t("finProcessingTime")}</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mb-4">{t("finProcessingDesc")}</p>
        <ProcessingTimeSection locale={locale} data={processing} />
      </section>

      {/* Billing by month — donut coloured by paid/pending */}
      <section className={`${cardCls} mb-6`}>
        <h2 className="font-bold">{t("finBillingByMonth")}</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mb-4">{t("finBillingByMonthDesc")}</p>
        <MonthlyDonut locale={locale} months={fin.months} />
      </section>

      {/* Monthly breakdown — clickable */}
      <section className={`${cardCls} mb-6`}>
        <h2 className="font-bold">{t("finMonthlyBreakdown")}</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mb-4">{t("finMonthlyBreakdownDesc")}</p>
        <MonthlyBreakdown locale={locale} months={fin.months} />
      </section>

      {/* Monthly status counts (2 & 3), colored picker, drill to patient names */}
      <section className={`${cardCls} mb-6`}>
        <h2 className="font-bold">{t("finMonthlyStatus")}</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mb-4">{t("finMonthlyStatusDesc")}</p>
        <MonthlyCountTable
          locale={locale}
          months={monthCountRows}
          statuses={[2, 3]}
          colored
          fetchNames={financialsMonthNames}
        />
      </section>

      {/* Oldest pending invoices (> 1 month) */}
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
                  <th className="text-start px-4 py-2 font-medium hidden md:table-cell">{t("colInvoiceSubmitted")}</th>
                  <th className="text-end px-4 py-2 font-medium">{t("colDaysWaiting")}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => {
                  const days = daysSince(p.invoice_submitted_at);
                  return (
                    <tr key={p.id} className="border-t border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <a href={`/patients/${p.id}`} className="font-medium text-blue-600 hover:underline">#{p.case_id}</a>
                        {p.patient_erp_id && <span className="ms-2 text-xs text-black/40 dark:text-white/40" dir="ltr">{p.patient_erp_id}</span>}
                      </td>
                      <td className="px-4 py-2.5">{p.patient_name}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">{p.treating_doctor}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums whitespace-nowrap" dir="ltr">{fmtMoney(Number(p.total_cost ?? 0) || 0)}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell whitespace-nowrap">{formatDateTime(p.invoice_submitted_at)}</td>
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
