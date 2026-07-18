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

// ---------------------------------------------------------------------------
// Baghdad calendar helpers for GROUPING and COMPARING UTC timestamps.
// Route all timestamp→Baghdad date logic through these so it can't drift.
//
// Iraq observes a FIXED UTC+3 with no daylight saving, so Baghdad's offset is a
// constant. (The display helpers above use Intl for robustness; these need the
// numeric offset to compute month boundaries, which Intl can't express.)
// ---------------------------------------------------------------------------
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;

const toMs = (value: string | Date) =>
  value instanceof Date ? value.getTime() : Date.parse(value);

/** Year (full) and 0-based month of a UTC instant, in the Baghdad calendar. */
export function baghdadYearMonth(value: string | Date): { year: number; month: number } {
  const d = new Date(toMs(value) + BAGHDAD_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/** Baghdad calendar day index (days since epoch) of a UTC instant. */
function baghdadDayNumber(value: string | Date): number {
  return Math.floor((toMs(value) + BAGHDAD_OFFSET_MS) / 86_400_000);
}

/**
 * Whole days between two instants, counted in Baghdad calendar days. Same
 * Baghdad day → 0; never affected by the time of day. Clamped to >= 0.
 */
export function daysBetweenBaghdad(
  from: string | Date,
  to: string | Date = new Date()
): number {
  return Math.max(0, baghdadDayNumber(to) - baghdadDayNumber(from));
}

/**
 * UTC ISO instants bounding a Baghdad calendar month [start, end). `month` is
 * 0-based. Use to filter a timestamptz column by Baghdad month.
 */
export function baghdadMonthRangeUtc(year: number, month: number): { startISO: string; endISO: string } {
  return {
    startISO: new Date(Date.UTC(year, month, 1) - BAGHDAD_OFFSET_MS).toISOString(),
    endISO: new Date(Date.UTC(year, month + 1, 1) - BAGHDAD_OFFSET_MS).toISOString(),
  };
}

/**
 * UTC ISO instant for Baghdad-local midnight `months` calendar months before
 * today. Filtering `ts < cutoff` means "older than `months` Baghdad months".
 */
export function baghdadMonthsAgoCutoffISO(months: number): string {
  const [y, m, d] = todayInBaghdad().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - months, d) - BAGHDAD_OFFSET_MS).toISOString();
}
