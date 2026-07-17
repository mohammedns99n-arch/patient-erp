import { getSessionProfile, permissions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import PatientForm from "../patient-form";
import { createPatient } from "../actions";

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const perms = permissions(profile);

  const locale = await getLocale();
  const t = getT(locale);
  const { created } = await searchParams;

  return (
    <main className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("newPatientTitle")}</h1>
        <a href="/patients" className="text-sm text-black/60 dark:text-white/60 hover:underline">
          ← {t("allPatients")}
        </a>
      </div>

      {created && (
        <div className="mb-6 rounded-lg border border-green-300/60 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 px-4 py-3 text-sm">
          ✓ {t("savedBannerA")} <b>#{created}</b> {t("savedBannerB")}
        </div>
      )}

      <PatientForm
        mode="create"
        action={createPatient}
        locale={locale}
        canViewFinancials={perms.canViewFinancials}
      />
    </main>
  );
}
