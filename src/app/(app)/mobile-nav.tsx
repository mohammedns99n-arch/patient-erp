"use client";

import { useEffect, useState } from "react";
import { SidebarContent, type SidebarProps } from "./sidebar";

export default function MobileNav(props: SidebarProps & { menuLabel: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const { menuLabel, closeLabel, ...sidebar } = props;

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={menuLabel}
        className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 hover:bg-black/5 dark:hover:bg-white/10"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 max-w-[80%] bg-slate-700 dark:bg-slate-800 text-white p-5 flex flex-col shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="self-end mb-2 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            <SidebarContent {...sidebar} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
