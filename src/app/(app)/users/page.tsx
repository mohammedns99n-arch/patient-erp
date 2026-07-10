import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import UsersTable, { type UserRow } from "./users-table";

export default async function UsersPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  // Admin-only page (RLS also blocks non-admins from writing profiles).
  if (!permissions(profile).isAdmin) redirect("/");

  const locale = await getLocale();
  const t = getT(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, can_view_financials, can_delete")
    .order("role", { ascending: true }) // admins first
    .order("email", { ascending: true });

  const users = (data ?? []) as UserRow[];

  return (
    <main className="max-w-3xl mx-auto">
      <header className="mb-6">
        <a href="/" className="text-sm text-black/60 dark:text-white/60 hover:underline">← {t("home")}</a>
        <h1 className="text-xl font-bold mt-1">{t("usersPermissions")}</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">{t("usersDesc")}</p>
      </header>

      <UsersTable users={users} currentUserId={profile.id} locale={locale} />

      <p className="mt-4 text-xs text-black/50 dark:text-white/50">{t("usersFooter")}</p>
    </main>
  );
}
