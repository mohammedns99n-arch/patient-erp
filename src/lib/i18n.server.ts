import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./i18n";

/** Reads the locale from the cookie (Server Components / actions only). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "ar" ? "ar" : "en";
}
