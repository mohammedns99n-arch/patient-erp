"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "./actions/locale";
import type { Locale } from "@/lib/i18n";

export default function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  const base =
    "px-2.5 py-1 text-sm rounded-md transition-colors disabled:opacity-60";
  const active = "bg-black/10 dark:bg-white/15 font-semibold";
  const idle = "hover:bg-black/5 dark:hover:bg-white/10";

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-black/10 dark:border-white/15 p-0.5"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => choose("en")}
        disabled={pending}
        className={`${base} ${locale === "en" ? active : idle}`}
        lang="en"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => choose("ar")}
        disabled={pending}
        className={`${base} ${locale === "ar" ? active : idle}`}
        lang="ar"
      >
        ع
      </button>
    </div>
  );
}
