"use client";

import { usePathname } from "next/navigation";

type IconKey = "dashboard" | "patients" | "new" | "statistics" | "financials" | "users";

function Icon({ name }: { name: IconKey }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "dashboard":
      return (<svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>);
    case "patients":
      return (<svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
    case "new":
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>);
    case "statistics":
      return (<svg {...common}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" rx="0.5" /><rect x="12" y="8" width="3" height="10" rx="0.5" /><rect x="17" y="5" width="3" height="13" rx="0.5" /></svg>);
    case "financials":
      return (<svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 1.2-1 1.7-2.5 2s-2.5.8-2.5 2a2.5 2 0 0 0 5 0" /></svg>);
    case "users":
      return (<svg {...common}><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>);
  }
}

export type NavItem = { href: string; label: string; icon: IconKey };

export type SidebarProps = {
  appName: string;
  displayName: string;
  initials: string;
  roleLabel: string;
  items: NavItem[];
  totalPatients: number;
  patientsWord: string;
};

/** Full sidebar inner content, shared by the desktop rail and mobile drawer. */
export function SidebarContent({
  appName,
  displayName,
  initials,
  roleLabel,
  items,
  totalPatients,
  patientsWord,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/patients/new") return pathname === href;
    if (href === "/patients") {
      return pathname === "/patients" || (pathname.startsWith("/patients/") && pathname !== "/patients/new");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8 px-1">
        <span className="relative inline-flex h-7 w-9 items-center">
          <span className="absolute left-0 h-6 w-6 rounded-full bg-emerald-400/90" />
          <span className="absolute left-3 h-6 w-6 rounded-full bg-white/80 mix-blend-screen" />
        </span>
        <span className="font-semibold truncate">{appName}</span>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="h-16 w-16 rounded-full bg-emerald-400/90 text-slate-800 flex items-center justify-center text-lg font-bold ring-4 ring-white/10">
          {initials}
        </div>
        <div className="mt-3 font-semibold text-sm truncate max-w-full">{displayName}</div>
        <div className="text-xs text-white/50">{roleLabel}</div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active ? "bg-white/15 text-white font-semibold" : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* Bottom stat card */}
      <a href="/patients" onClick={onNavigate} className="mt-auto rounded-2xl bg-white/10 hover:bg-white/15 transition-colors p-4 text-center">
        <div className="text-2xl font-bold">{totalPatients}</div>
        <div className="text-xs text-white/60">{patientsWord}</div>
      </a>
    </>
  );
}
