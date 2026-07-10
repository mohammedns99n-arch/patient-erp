import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS, STATUS_CODES, type StatusCode } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { getT, statusLabel, monthName } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";

function iqd(n: number) {
  return n.toLocaleString("en-US");
}

// The four money dimensions, in the order requested. labelKey -> i18n key.
const SHARES = [
  { key: "doctor_share", labelKey: "fDoctorShare" },
  { key: "hospital_share", labelKey: "fHospital" },
  { key: "materials_share", labelKey: "fMaterials" },
  { key: "total_cost", labelKey: "fTotal" },
] as const;
type ShareKey = (typeof SHARES)[number]["key"];

type Row = {
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

const zeroed = (): Record<ShareKey, number> => ({
  doctor_share: 0,
  hospital_share: 0,
  materials_share: 0,
  total_cost: 0,
});

function addShares(acc: Record<ShareKey, number>, r: Row) {
  for (const s of SHARES) acc[s.key] += Number(r[s.key] ?? 0) || 0;
}

export default async function DoctorPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const perms = permissions(profile);
  const canMoney = perms.canViewFinancials;

  const locale = await getLocale();
  const t = getT(locale);

  // Next decodes dynamic segments, so params.name is the plain doctor name.
  const { name } = await params;
  const doctor = decodeURIComponent(name);

  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select(
      "id, case_id, patient_name, status_code, first_visit_date, doctor_share, hospital_share, materials_share, total_cost"
    )
    .eq("treating_doctor", doctor)
    .order("first_visit_date", { ascending: false })
    .order("case_id", { ascending: false });

  const rows = (data ?? []) as Row[];

  // --- Aggregations ---
  const statusCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const paid = zeroed();
  const expected = zeroed();
  // year -> month(0-11) -> { paid, expected }
  const monthly = new Map<
    string,
    { paid: Record<ShareKey, number>; expected: Record<ShareKey, number> }[]
  >();
  const blankYear = () =>
    Array.from({ length: 12 }, () => ({ paid: zeroed(), expected: zeroed() }));

  for (const r of rows) {
    statusCounts[r.status_code] = (statusCounts[r.status_code] ?? 0) + 1;
    const isPaid = r.status_code === 3;
    addShares(expected, r);
    if (isPaid) addShares(paid, r);

    const year = (r.first_visit_date ?? "").slice(0, 4);
    const month = Number((r.first_visit_date ?? "").slice(5, 7)) - 1;
    if (year && month >= 0 && month <= 11) {
      if (!monthly.has(year)) monthly.set(year, blankYear());
      const cell = monthly.get(year)![month];
      addShares(cell.expected, r);
      if (isPaid) addShares(cell.paid, r);
    }
  }

  const years = Array.from(monthly.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <main className="max-w-5xl mx-auto">
      <header className="mb-6">
        <a href="/dashboard" className="text-sm text-black/60 dark:text-white/60 hover:underline">← {t("dashboard")}</a>
        <h1 className="text-2xl font-bold mt-1">{doctor}</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">
          {rows.length} {t("patientsWord")}
          {" · "}
          {STATUS_CODES.map((c) => `${statusCounts[c] ?? 0} ${statusLabel(locale, c)}`).join(" · ")}
        </p>
      </header>

      {rows.length === 0 && (
        <p className="rounded-xl border border-black/10 dark:border-white/10 p-6 text-black/60 dark:text-white/60">
          {t("noPatientsForDoctor")}{" "}
          <a href="/dashboard" className="text-blue-600 hover:underline">{t("backToDashboard")}</a>.
        </p>
      )}

      {/* Summary totals: Paid vs Expected across the four dimensions (gated) */}
      {rows.length > 0 && canMoney && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">
            {t("summaryHeading")}
          </h2>
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
                    <td className="px-4 py-2 text-end tabular-nums text-green-700 dark:text-green-400">{iqd(paid[s.key])}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{iqd(expected[s.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Monthly breakdown (gated) */}
      {rows.length > 0 && canMoney && years.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">
            {t("monthlyBreakdown")}
          </h2>
          <div className="space-y-4">
            {years.map((y) => {
              const cells = monthly.get(y) ?? [];
              const activeMonths = cells
                .map((c, m) => ({ c, m }))
                .filter(({ c }) => SHARES.some((s) => c.paid[s.key] !== 0 || c.expected[s.key] !== 0));
              if (activeMonths.length === 0) return null;
              return (
                <div key={y} className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                  <div className="px-4 py-2 bg-black/5 dark:bg-white/5 font-semibold">{y}</div>
                  <table className="w-full text-sm">
                    <thead className="text-black/60 dark:text-white/60">
                      <tr className="border-t border-black/5 dark:border-white/5">
                        <th rowSpan={2} className="text-start px-4 py-2 font-medium align-bottom">{t("colMonth")}</th>
                        {SHARES.map((s) => (
                          <th key={s.key} colSpan={2} className="text-center px-3 py-1.5 font-medium border-l border-black/5 dark:border-white/5">
                            {t(s.labelKey)}
                          </th>
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
                      {activeMonths.map(({ c, m }) => (
                        <tr key={m} className="border-t border-black/5 dark:border-white/5">
                          <td className="px-4 py-2 whitespace-nowrap text-black/60 dark:text-white/60">{monthName(locale, m)} {y}</td>
                          {SHARES.map((s) => (
                            <Fragment key={s.key}>
                              <td className="px-3 py-2 text-end tabular-nums text-green-700 dark:text-green-400 border-l border-black/5 dark:border-white/5">{iqd(c.paid[s.key])}</td>
                              <td className="px-3 py-2 text-end tabular-nums">{iqd(c.expected[s.key])}</td>
                            </Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Per-patient list (money columns gated) */}
      {rows.length > 0 && (
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
          {!canMoney && (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              {t("moneyHidden")}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
