"use client";

import { useState, useTransition } from "react";
import { getT, statusLabel, monthName, type Locale } from "@/lib/i18n";
import { STATUS, type StatusCode } from "@/lib/constants";

export type MonthRow = {
  key: string; // "YYYY-MM"
  year: number;
  month: number; // 0-11
  total: number;
  counts: Record<number, number>; // status -> count
  allPaid?: boolean; // only used when `colored`
};

export type NameRow = { id: string; case_id: number; name: string };

export type FetchNames = (
  year: number,
  month: number,
  status: number
) => Promise<{ rows: NameRow[]; error: string | null }>;

const BLUE = "#5B8DEF";
const YELLOW = "#F2C94C";

export default function MonthlyCountTable({
  locale,
  months,
  statuses,
  colored,
  fetchNames,
}: {
  locale: Locale;
  months: MonthRow[];
  statuses: number[];
  colored: boolean;
  fetchNames: FetchNames;
}) {
  const t = getT(locale);
  const ordered = [...months].reverse(); // newest first for the picker
  const [selKey, setSelKey] = useState<string | null>(ordered[0]?.key ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openStatus, setOpenStatus] = useState<number | null>(null);
  const [cache, setCache] = useState<Record<string, NameRow[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selected = months.find((m) => m.key === selKey) ?? null;
  const label = (m: MonthRow) => `${monthName(locale, m.month)} ${m.year}`;
  const dot = (m: MonthRow) => (m.allPaid ? BLUE : YELLOW);

  if (months.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">{t("statNoData")}</p>;
  }

  function pick(key: string) {
    setSelKey(key);
    setPickerOpen(false);
    setOpenStatus(null);
  }

  function clickCount(m: MonthRow, status: number) {
    if (openStatus === status) {
      setOpenStatus(null);
      return;
    }
    setOpenStatus(status);
    const ck = `${m.key}:${status}`;
    if (!cache[ck]) {
      setLoadingKey(ck);
      startTransition(async () => {
        const res = await fetchNames(m.year, m.month, status);
        setCache((c) => ({ ...c, [ck]: res.rows }));
        setLoadingKey(null);
      });
    }
  }

  const cellBtn =
    "min-w-[3rem] rounded-md px-2 py-1 font-semibold tabular-nums transition-colors";

  return (
    <div>
      {/* Month picker */}
      <div className="relative inline-block mb-4">
        <span className="text-xs text-black/50 dark:text-white/50 me-2">{t("monthLabel")}</span>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          className="inline-flex items-center gap-2 rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          {colored && selected && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot(selected) }} />}
          <span className="font-medium">{selected ? label(selected) : "—"}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>

        {pickerOpen && (
          <>
            <button type="button" aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={() => setPickerOpen(false)} />
            <ul className="absolute z-20 mt-1 max-h-64 w-48 overflow-auto rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-800 shadow-lg py-1">
              {ordered.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => pick(m.key)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-start hover:bg-black/5 dark:hover:bg-white/10 ${m.key === selKey ? "font-semibold" : ""}`}
                  >
                    {colored && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: dot(m) }} />}
                    <span className="flex-1">{label(m)}</span>
                    <span className="text-xs text-black/40 dark:text-white/40 tabular-nums">{m.total}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Count table for the selected month */}
      {selected && (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
              <tr>
                <th className="text-start px-4 py-2 font-medium">{t("totalCountCol")}</th>
                {statuses.map((s) => (
                  <th key={s} className="text-start px-4 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS[s as StatusCode].strong }} />
                      {s} · {statusLabel(locale, s)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-black/5 dark:border-white/5">
                <td className="px-4 py-2.5 font-bold tabular-nums">{selected.total}</td>
                {statuses.map((s) => {
                  const n = selected.counts[s] ?? 0;
                  const active = openStatus === s;
                  return (
                    <td key={s} className="px-4 py-2.5">
                      {n > 0 ? (
                        <button
                          type="button"
                          onClick={() => clickCount(selected, s)}
                          aria-expanded={active}
                          className={`${cellBtn} ${active ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 underline underline-offset-2"}`}
                        >
                          {n}
                        </button>
                      ) : (
                        <span className="min-w-[3rem] inline-block px-2 py-1 text-black/30 dark:text-white/30 tabular-nums">0</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-down: patient names for the chosen status + month */}
      {selected && openStatus !== null && (
        <div className="mt-3 rounded-xl border border-black/10 dark:border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS[openStatus as StatusCode].strong }} />
            <h4 className="font-semibold text-sm">{statusLabel(locale, openStatus)} · {label(selected)}</h4>
          </div>
          {loadingKey === `${selected.key}:${openStatus}` ? (
            <p className="text-sm text-black/50 dark:text-white/50">{t("loadingWord")}</p>
          ) : (cache[`${selected.key}:${openStatus}`]?.length ?? 0) === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">{t("noPatientsInStatus")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {cache[`${selected.key}:${openStatus}`].map((r) => (
                <li key={r.id}>
                  <a href={`/patients/${r.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-black/15 dark:border-white/15 px-3 py-1.5 text-sm hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                    <span className="text-xs text-black/40 dark:text-white/40">#{r.case_id}</span>
                    {r.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
