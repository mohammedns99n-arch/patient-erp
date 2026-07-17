import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import { getAggregate } from "@/lib/dashboard-data";
import StatsGrid, { type StatsData } from "./stats-grid";

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

  return (
    <main className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t("statistics")}</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">{t("statsDesc")}</p>
      </header>

      <StatsGrid locale={locale} data={data} />
    </main>
  );
}
