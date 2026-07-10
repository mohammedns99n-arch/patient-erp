// All date/time display in the app is anchored to Baghdad, regardless of
// where the server runs (local Mac, or Vercel's UTC). This prevents any
// off-by-one between how dates are stored (UTC instants / plain dates) and
// how staff in Baghdad read them.
export const APP_TIMEZONE = "Asia/Baghdad";

/**
 * Format a plain `date` column value (e.g. first_visit_date), which Supabase
 * returns as "YYYY-MM-DD". A plain date has no time or zone, so we format it
 * verbatim (no timezone conversion) to avoid shifting it a day.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value.slice(0, 10);
  // Anchor at UTC and format in UTC so the calendar date is shown as-is.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

/**
 * Format a `timestamptz` column value (e.g. last_updated, created_at), which
 * is a UTC instant, converted to Baghdad local wall-clock time.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(dt);
}

/** The current calendar date in Baghdad, as "YYYY-MM-DD" (e.g. for filters). */
export function todayInBaghdad(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date());
  return parts; // en-CA yields YYYY-MM-DD
}
