"use client";

import { Fragment, useState, useTransition } from "react";
import { getT, monthName, type Locale } from "@/lib/i18n";
import { fmtMoney } from "@/lib/revenue";
import type { ReceivedMonth } from "@/lib/financials-data";
import type { NameRow } from "../monthly-count-table";

type FetchNames = (year: number, month: number) => Promise<{ rows: NameRow[]; error: string | null }>;

/**
 * "Money received by month" — one row per Baghdad month of payment_received_at,
 * newest first. The case count is clickable to reveal that month's patients.
 * (Grouped by payment date, intentionally distinct from the invoice-date tables.)
 */
export default function MoneyReceivedTable({
  locale,
  months,
  fetchNames,
}: {
  locale: Locale;
  months: ReceivedMonth[];
  fetchNames: FetchNames;
}) {
  const t = getT(locale);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, NameRow[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (months.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">{t("statNoData")}</p>;
  }

  function toggle(mo: ReceivedMonth) {
    if (openKey === mo.key) { setOpenKey(null); return; }
    setOpenKey(mo.key);
    if (!cache[mo.key]) {
      setLoadingKey(mo.key);
      startTransition(async () => {
        const res = await fetchNames(mo.year, mo.month);
        setCache((c) => ({ ...c, [mo.key]: res.rows }));
        setLoadingKey(null);
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
          <tr>
            <th className="text-start px-4 py-2 font-medium">{t("colMonth")}</th>
            <th className="text-end px-4 py-2 font-medium whitespace-nowrap">{t("colAmountReceived")} ({t("iqd")})</th>
            <th className="text-end px-4 py-2 font-medium whitespace-nowrap">{t("finHospitalShare")} ({t("iqd")})</th>
            <th className="text-end px-4 py-2 font-medium">{t("colCases")}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((mo) => {
            const open = openKey === mo.key;
            const rows = cache[mo.key];
            return (
              <Fragment key={mo.key}>
                <tr className="border-t border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5 whitespace-nowrap font-medium">{monthName(locale, mo.month)} {mo.year}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums whitespace-nowrap" dir="ltr">{fmtMoney(mo.received)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums whitespace-nowrap" dir="ltr">{fmtMoney(mo.hospitalShare)}</td>
                  <td className="px-4 py-2.5 text-end">
                    <button
                      type="button"
                      onClick={() => toggle(mo)}
                      aria-expanded={open}
                      className={`rounded-md px-2 py-1 font-semibold tabular-nums transition-colors ${
                        open ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 underline underline-offset-2"
                      }`}
                    >
                      {mo.count}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr className="border-t border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <td colSpan={4} className="px-4 py-3">
                      {loadingKey === mo.key ? (
                        <p className="text-sm text-black/50 dark:text-white/50">{t("loadingWord")}</p>
                      ) : (rows?.length ?? 0) === 0 ? (
                        <p className="text-sm text-black/50 dark:text-white/50">—</p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {rows!.map((r) => (
                            <li key={r.id}>
                              <a href={`/patients/${r.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-black/15 dark:border-white/15 px-3 py-1.5 text-sm hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                                <span className="text-xs text-black/40 dark:text-white/40">#{r.case_id}</span>
                                {r.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
