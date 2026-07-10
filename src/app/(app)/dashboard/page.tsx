import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS, STATUS_CODES, CASE_TYPES, type StatusCode } from "@/lib/constants";
import { getT, statusLabel, caseTypeLabel, monthName } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { formatDateTime } from "@/lib/dates";

function iqd(n: number) {
  return n.toLocaleString("en-US");
}

const cardCls =
  "rounded-2xl bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 p-5 shadow-sm";

/** Donut of patients-by-status using the circumference-100 trick. */
function StatusDonut({
  counts,
  total,
  centerLabel,
}: {
  counts: Record<number, number>;
  total: number;
  centerLabel: string;
}) {
  let acc = 0;
  const segments = STATUS_CODES.map((c) => {
    const value = counts[c] ?? 0;
    const pct = total ? (value / total) * 100 : 0;
    const seg = { color: STATUS[c].strong, pct, offset: 25 - acc };
    acc += pct;
    return seg;
  });

  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" className="text-black/10 dark:text-white/10" strokeWidth="4" />
        {total > 0 &&
          segments.map((s, i) =>
            s.pct > 0 ? (
              <circle
                key={i}
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke={s.color}
                strokeWidth="4"
                strokeDasharray={`${s.pct} ${100 - s.pct}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
              />
            ) : null
          )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-black/50 dark:text-white/50">{centerLabel}</span>
      </div>
    </div>
  );
}

type Row = {
  id: string;
  case_id: number;
  patient_name: string;
  status_code: number;
  case_type: string;
  treating_doctor: string;
  total_cost: number | string | null;
  first_visit_date: string;
  last_updated: string;
};

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const perms = permissions(profile);

  const locale = await getLocale();
  const t = getT(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select(
      "id, case_id, patient_name, status_code, case_type, treating_doctor, total_cost, first_visit_date, last_updated"
    );
  const rows = (data ?? []) as Row[];

  const total = rows.length;
  const statusCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const typeCounts: Record<string, number> = { Medical: 0, Surgical: 0 };
  const doctorCounts = new Map<string, number>();
  const volume = new Map<string, number[]>();
  const fin = new Map<string, { billed: number; received: number }[]>();
  let billedTotal = 0;
  let receivedTotal = 0;

  const blankMonths = () => Array.from({ length: 12 }, () => 0);
  const blankFin = () => Array.from({ length: 12 }, () => ({ billed: 0, received: 0 }));

  for (const r of rows) {
    statusCounts[r.status_code] = (statusCounts[r.status_code] ?? 0) + 1;
    if (r.case_type in typeCounts) typeCounts[r.case_type] += 1;
    if (r.treating_doctor) doctorCounts.set(r.treating_doctor, (doctorCounts.get(r.treating_doctor) ?? 0) + 1);

    const year = (r.first_visit_date ?? "").slice(0, 4);
    const month = Number((r.first_visit_date ?? "").slice(5, 7)) - 1;
    const cost = Number(r.total_cost ?? 0) || 0;
    if (year && month >= 0 && month <= 11) {
      if (!volume.has(year)) volume.set(year, blankMonths());
      volume.get(year)![month] += 1;
      if (!fin.has(year)) fin.set(year, blankFin());
      if (r.status_code === 2) fin.get(year)![month].billed += cost;
      if (r.status_code === 3) fin.get(year)![month].received += cost;
    }
    if (r.status_code === 2) billedTotal += cost;
    if (r.status_code === 3) receivedTotal += cost;
  }
  const outstandingTotal = billedTotal - receivedTotal;
  const doctors = Array.from(doctorCounts.entries()).sort((a, b) => b[1] - a[1]);
  const years = Array.from(new Set([...volume.keys(), ...fin.keys()])).sort((a, b) => b.localeCompare(a));

  const recent = [...rows]
    .sort((a, b) => (b.last_updated ?? "").localeCompare(a.last_updated ?? ""))
    .slice(0, 5);

  return (
    <main className="max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("dashboard")}</h1>
        <a href="/patients" className="text-sm rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10">
          {t("viewAllPatients")}
        </a>
      </header>

      {total === 0 && (
        <p className="mb-6 rounded-2xl border border-black/10 dark:border-white/10 p-6 text-black/60 dark:text-white/60">
          {t("noPatientsYet")} <a href="/patients/new" className="text-emerald-600 hover:underline">{t("addTheFirst")}</a>.
        </p>
      )}

      {/* Status shortcut cards (folder-style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STATUS_CODES.map((c) => (
          <a
            key={c}
            href={`/patients?status=${c}`}
            className="relative rounded-2xl p-5 text-white shadow-sm hover:brightness-105 transition"
            style={{ backgroundColor: STATUS[c].strong }}
          >
            <div className="text-xs font-semibold text-white/70">0{c + 1}</div>
            <div className="mt-6 text-3xl font-bold tabular-nums">{statusCounts[c] ?? 0}</div>
            <div className="text-sm text-white/90">{statusLabel(locale, c)}</div>
          </a>
        ))}
      </div>

      {/* Donut + recently updated */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <section className={cardCls}>
          <h2 className="font-bold mb-4">{t("patientsByStatus")}</h2>
          <div className="flex items-center gap-6">
            <StatusDonut counts={statusCounts} total={total} centerLabel={t("patientsWord")} />
            <ul className="flex-1 space-y-2.5">
              {STATUS_CODES.map((c) => (
                <li key={c} className="flex items-center gap-2.5 text-sm">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: STATUS[c].strong }} />
                  <span className="flex-1 text-black/70 dark:text-white/70">{statusLabel(locale, c)}</span>
                  <span className="font-semibold tabular-nums">{statusCounts[c] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={cardCls}>
          <h2 className="font-bold mb-3">{t("recentlyUpdated")}</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">{t("noPatientsYet")}</p>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {recent.map((r) => (
                <li key={r.id}>
                  <a href={`/patients/${r.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className="h-9 w-9 rounded-lg shrink-0 ring-1 ring-black/10" style={{ backgroundColor: STATUS[(r.status_code as StatusCode) ?? 0].rowBg }} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{r.patient_name}</span>
                      <span className="block text-xs text-black/50 dark:text-white/50">#{r.case_id} · {statusLabel(locale, r.status_code)}</span>
                    </span>
                    <span className="text-xs text-black/50 dark:text-white/50 whitespace-nowrap">{formatDateTime(r.last_updated)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Case type + doctors */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <section className={cardCls}>
          <h2 className="font-bold mb-3">{t("byCaseType")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {CASE_TYPES.map((ct) => (
              <a key={ct} href={`/patients?case_type=${ct}`} className="rounded-xl border border-black/10 dark:border-white/10 p-4 hover:border-emerald-500 transition-colors">
                <div className="text-2xl font-bold">{typeCounts[ct] ?? 0}</div>
                <div className="text-sm text-black/60 dark:text-white/60">{caseTypeLabel(locale, ct)}</div>
              </a>
            ))}
          </div>
        </section>

        <section className={cardCls}>
          <h2 className="font-bold mb-3">{t("doctorsClick")}</h2>
          {doctors.length === 0 ? (
            <p className="text-sm text-black/50">{t("noDoctorsYet")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {doctors.map(([name, count]) => (
                <a key={name} href={`/doctors/${encodeURIComponent(name)}`} className="inline-flex items-center gap-2 rounded-full border border-black/15 dark:border-white/15 px-3 py-1.5 text-sm hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
                  {name}
                  <span className="text-xs font-semibold rounded-full bg-black/10 dark:bg-white/15 px-1.5 py-0.5">{count}</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Monthly patient volume */}
      {years.length > 0 && (
        <section className={`${cardCls} mb-6`}>
          <h2 className="font-bold mb-3">{t("monthlyVolume")}</h2>
          <div className="space-y-4">
            {years.map((y) => {
              const months = volume.get(y) ?? [];
              const yearTotal = months.reduce((a, b) => a + b, 0);
              const peak = Math.max(...months, 1);
              return (
                <div key={y} className="rounded-xl border border-black/10 dark:border-white/10 overflow-x-auto">
                  <div className="flex items-center justify-between px-4 py-2 bg-black/5 dark:bg-white/5">
                    <span className="font-semibold">{y}</span>
                    <span className="text-sm text-black/60 dark:text-white/60">{yearTotal} {t("patientsWord")}</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {months.map((count, m) =>
                        count > 0 ? (
                          <tr key={m} className="border-t border-black/5 dark:border-white/5">
                            <td className="px-4 py-2 w-24 text-black/60 dark:text-white/60">{monthName(locale, m)} {y}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.max(6, (count / peak) * 100)}%` }} />
                                <span className="tabular-nums">{count}</span>
                              </div>
                            </td>
                          </tr>
                        ) : null
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Financial summary — gated */}
      {perms.canViewFinancials ? (
        <section id="financials" className={`${cardCls} mb-6`}>
          <h2 className="font-bold mb-3">{t("financialSummary")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
              <div className="text-sm text-black/60 dark:text-white/60">{t("totalBilled")}</div>
              <div className="text-2xl font-bold tabular-nums">{iqd(billedTotal)}</div>
            </div>
            <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
              <div className="text-sm text-black/60 dark:text-white/60">{t("totalReceived")}</div>
              <div className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">{iqd(receivedTotal)}</div>
            </div>
            <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
              <div className="text-sm text-black/60 dark:text-white/60">{t("outstanding")}</div>
              <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{iqd(outstandingTotal)}</div>
            </div>
          </div>

          {years.map((y) => {
            const months = fin.get(y) ?? [];
            const yb = months.reduce((a, b) => a + b.billed, 0);
            const yr = months.reduce((a, b) => a + b.received, 0);
            if (yb === 0 && yr === 0) return null;
            return (
              <div key={y} className="mb-4 rounded-xl border border-black/10 dark:border-white/10 overflow-x-auto">
                <div className="flex items-center justify-between px-4 py-2 bg-black/5 dark:bg-white/5">
                  <span className="font-semibold">{y}</span>
                  <span className="text-sm text-black/60 dark:text-white/60">
                    {t("billedWord")} {iqd(yb)} · {t("receivedWord")} {iqd(yr)} · {t("outstandingWord")} {iqd(yb - yr)}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-black/60 dark:text-white/60">
                    <tr className="border-t border-black/5 dark:border-white/5">
                      <th className="text-start px-4 py-2 font-medium">{t("colMonth")}</th>
                      <th className="text-end px-4 py-2 font-medium">{t("colBilled")}</th>
                      <th className="text-end px-4 py-2 font-medium">{t("colReceived")}</th>
                      <th className="text-end px-4 py-2 font-medium">{t("colOutstanding")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((mv, m) =>
                      mv.billed !== 0 || mv.received !== 0 ? (
                        <tr key={m} className="border-t border-black/5 dark:border-white/5">
                          <td className="px-4 py-2 text-black/60 dark:text-white/60">{monthName(locale, m)} {y}</td>
                          <td className="px-4 py-2 text-end tabular-nums">{iqd(mv.billed)}</td>
                          <td className="px-4 py-2 text-end tabular-nums">{iqd(mv.received)}</td>
                          <td className="px-4 py-2 text-end tabular-nums">{iqd(mv.billed - mv.received)}</td>
                        </tr>
                      ) : null
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="mb-6 rounded-2xl border border-dashed border-black/15 dark:border-white/15 p-6 text-sm text-black/50 dark:text-white/50">
          {t("financialsHidden")}
        </section>
      )}
    </main>
  );
}
