import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { getAggregate, getMonthlyStatusByFirstVisit } from "@/lib/dashboard-data";
import StatsGrid, { type StatsData } from "./stats-grid";
import MonthlyCountTable, { type MonthRow } from "../monthly-count-table";
import { statisticsMonthNames } from "./actions";

const cardCls =
  "rounded-2xl bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 p-5 shadow-sm";

export default async function StatisticsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  // Gated by the can_view_statistics permission (admins implicitly have it).
  if (!permissions(profile).canViewStatistics) redirect("/dashboard");

  const locale = await getLocale();
  const t = getT(locale);
  const supabase = await createClient();

  const agg = await getAggregate(supabase);
  const data: StatsData = {
    total: agg.total,
    statusCounts: agg.statusCounts,
    typeCounts: agg.typeCounts,
    doctors: agg.doctors,
    years: agg.years,
    volumeByYear: agg.volumeByYear,
  };

  // Monthly status-count table (by first visit month; all statuses, no colors).
  const monthCountRows: MonthRow[] = (await getMonthlyStatusByFirstVisit(supabase)).map((m) => ({
    key: m.key,
    year: m.year,
    month: m.month,
    total: m.total,
    counts: m.counts,
  }));

  return (
    <main className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t("statistics")}</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">{t("statsDesc")}</p>
      </header>

      <StatsGrid locale={locale} data={data} />

      {/* Monthly status counts (all statuses), by first visit month */}
      <section className={`${cardCls} mt-4`}>
        <h2 className="font-bold">{t("statMonthlyStatus")}</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mb-4">{t("statMonthlyStatusDesc")}</p>
        <MonthlyCountTable
          locale={locale}
          months={monthCountRows}
          statuses={[0, 1, 2, 3]}
          colored={false}
          fetchNames={statisticsMonthNames}
        />
      </section>
    </main>
  );
}
