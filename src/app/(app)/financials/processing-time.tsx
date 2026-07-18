"use client";

import { useState } from "react";
import { getT, monthName, type Locale } from "@/lib/i18n";
import type { ProcessingTime, Durations } from "@/lib/financials-data";

const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const fmtDays = (n: number | null, daysWord: string) =>
  n == null ? "—" : `${round1(n)!.toLocaleString("en-US")} ${daysWord}`;

const METRICS = [
  { key: "visitToInvoice", labelKey: "procVisitToInvoice", hintKey: "procVisitToInvoiceHint", nKey: "nVi" },
  { key: "invoiceToPayment", labelKey: "procInvoiceToPayment", hintKey: "procInvoiceToPaymentHint", nKey: "nIp" },
  { key: "visitToPayment", labelKey: "procVisitToPayment", hintKey: "procVisitToPaymentHint", nKey: "nVp" },
] as const;

export default function ProcessingTimeSection({ locale, data }: { locale: Locale; data: ProcessingTime }) {
  const t = getT(locale);
  const [showMonthly, setShowMonthly] = useState(false);
  const days = t("daysWord");

  const dv = (d: Durations, k: (typeof METRICS)[number]["key"]) => d[k];
  const nv = (d: Durations, k: (typeof METRICS)[number]["nKey"]) => d[k];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {METRICS.map((m) => (
          <div key={m.key} className="rounded-xl border border-black/10 dark:border-white/10 p-4">
            <div className="text-xs text-black/60 dark:text-white/60">{t(m.labelKey)}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums" dir="ltr">{fmtDays(dv(data.overall, m.key), days)}</div>
            <div className="mt-0.5 text-xs text-black/45 dark:text-white/45">
              {t(m.hintKey)} · {nv(data.overall, m.nKey)} {t("casesWord")}
            </div>
          </div>
        ))}
      </div>

      {data.monthly.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowMonthly((s) => !s)}
            aria-expanded={showMonthly}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showMonthly ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
            {showMonthly ? t("showLess") : t("procByMonth")}
          </button>

          {showMonthly && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
                  <tr>
                    <th className="text-start px-3 py-2 font-medium">{t("colMonth")}</th>
                    {METRICS.map((m) => (
                      <th key={m.key} className="text-end px-3 py-2 font-medium">{t(m.labelKey)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((row) => (
                    <tr key={row.key} className="border-t border-black/5 dark:border-white/5">
                      <td className="px-3 py-2 whitespace-nowrap text-black/60 dark:text-white/60">{monthName(locale, row.month)} {row.year}</td>
                      {METRICS.map((m) => (
                        <td key={m.key} className="px-3 py-2 text-end tabular-nums whitespace-nowrap" dir="ltr">{fmtDays(dv(row, m.key), days)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-black/45 dark:text-white/45">{t("procMonthlyNote")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
