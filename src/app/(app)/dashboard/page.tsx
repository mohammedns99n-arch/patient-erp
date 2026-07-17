import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS, STATUS_CODES, type StatusCode } from "@/lib/constants";
import { getT, statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { formatDateTime } from "@/lib/dates";
import { getAggregate } from "@/lib/dashboard-data";
import { Donut } from "../charts";

const cardCls =
  "rounded-2xl bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 p-5 shadow-sm";

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const locale = await getLocale();
  const t = getT(locale);
  const supabase = await createClient();

  // Same dashboard for everyone — no financial or admin-only content here.
  const { total, statusCounts, doctors } = await getAggregate(supabase);

  const { data: recentData } = await supabase
    .from("patients")
    .select("id, case_id, patient_name, status_code, last_updated")
    .order("last_updated", { ascending: false })
    .limit(5);
  const recent = (recentData ?? []) as {
    id: string; case_id: number; patient_name: string; status_code: number; last_updated: string;
  }[];

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

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STATUS_CODES.map((c) => (
          <a key={c} href={`/patients?status=${c}`} className="relative rounded-2xl p-5 text-white shadow-sm hover:brightness-105 transition" style={{ backgroundColor: STATUS[c].strong }}>
            <div className="text-xs font-semibold text-white/70">0{c + 1}</div>
            <div className="mt-6 text-3xl font-bold tabular-nums">{statusCounts[c] ?? 0}</div>
            <div className="text-sm text-white/90">{statusLabel(locale, c)}</div>
          </a>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Patients by status: donut + legend */}
        <section className={cardCls}>
          <h2 className="font-bold mb-4">{t("patientsByStatus")}</h2>
          <div className="flex items-center gap-6">
            <Donut
              segments={STATUS_CODES.map((c) => ({ value: statusCounts[c] ?? 0, color: STATUS[c].strong }))}
              total={total}
              centerValue={total}
              centerLabel={t("patientsWord")}
            />
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

        {/* Recently updated */}
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

      {/* Doctors */}
      <section className={`${cardCls} mb-6`}>
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
    </main>
  );
}
