import { redirect } from "next/navigation";
import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import LanguageToggle from "../language-toggle";
import { SidebarContent, type NavItem, type SidebarProps } from "./sidebar";
import MobileNav from "./mobile-nav";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const locale = await getLocale();
  const t = getT(locale);
  const perms = permissions(profile);
  const displayName = profile.full_name || profile.email || "—";
  const roleLabel = profile.role === "admin" ? t("roleAdmin") : t("roleStaff");

  const supabase = await createClient();
  const { count } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true });
  const totalPatients = count ?? 0;

  const items: NavItem[] = [
    { href: "/dashboard", label: t("dashboard"), icon: "dashboard" },
    { href: "/patients", label: t("patients"), icon: "patients" },
    { href: "/patients/new", label: t("newPatient"), icon: "new" },
    ...(perms.canManageUsers
      ? [{ href: "/users", label: t("usersPermissions"), icon: "users" as const }]
      : []),
  ];

  const sidebarProps: SidebarProps = {
    appName: t("appName"),
    displayName,
    initials: initialsOf(displayName),
    roleLabel,
    items,
    totalPatients,
    patientsWord: t("patientsWord"),
  };

  return (
    <div className="min-h-screen bg-zinc-300 dark:bg-zinc-950 p-0 sm:p-4">
      <div className="mx-auto flex min-h-screen sm:min-h-[calc(100vh-2rem)] max-w-[1440px] overflow-hidden rounded-none sm:rounded-[28px] shadow-2xl">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col bg-slate-700 dark:bg-slate-800 text-white p-5">
          <SidebarContent {...sidebarProps} />
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 flex flex-col">
          {/* Header */}
          <header className="flex items-center gap-3 p-4 sm:p-6">
            <MobileNav {...sidebarProps} menuLabel={t("menu")} closeLabel={t("close")} />
            <form method="get" action="/patients" className="relative flex-1 max-w-md">
              <svg className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-black/40 dark:text-white/40" style={{ insetInlineStart: "0.75rem" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                name="q"
                placeholder={t("searchPlaceholder")}
                className="w-full rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 py-2.5 ps-9 pe-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ paddingInlineStart: "2.25rem" }}
              />
            </form>

            <div className="ms-auto flex items-center gap-2">
              <LanguageToggle locale={locale} />
              <form action="/auth/signout" method="post">
                <button
                  title={t("signOut")}
                  aria-label={t("signOut")}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
                </button>
              </form>
              <a
                href="/patients/new"
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
              >
                + {t("newPatient")}
              </a>
            </div>
          </header>

          <div className="p-4 sm:p-6 pt-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
