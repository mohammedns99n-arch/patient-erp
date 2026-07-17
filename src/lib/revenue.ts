// Shared "Revenue Collection" helpers.
// Used by the patient form for a live preview AND by the server action as the
// authoritative calculation, so the two can never disagree.

/**
 * Format a number with thousands separators (Western digits, matching the rest
 * of the app — money is shown the same way in both EN and AR UIs).
 */
export function fmtMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** True if the smart "patient paid" input is expressed as a percentage. */
export function isPercentInput(input: string): boolean {
  return (input ?? "").trim().endsWith("%");
}

/**
 * Resolve the smart "patient paid" field to an IQD amount:
 *  - "15%"              -> 15% of revenueTotal
 *  - "800000" / "800,000" -> that amount, used directly
 * Returns a non-negative amount rounded to 2 decimals. Invalid input -> 0.
 */
export function resolvePatientPaid(input: string, revenueTotal: number): number {
  const raw = (input ?? "").trim();
  if (raw === "") return 0;
  const total = Number.isFinite(revenueTotal) ? revenueTotal : 0;

  let amount: number;
  if (raw.endsWith("%")) {
    const pct = Number(raw.slice(0, -1).replace(/,/g, "").trim());
    if (!Number.isFinite(pct)) return 0;
    amount = (total * pct) / 100;
  } else {
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n)) return 0;
    amount = n;
  }

  amount = Math.round(amount * 100) / 100;
  return amount < 0 ? 0 : amount;
}

/** Insurance due is always revenue_total − revenue_patient_paid (may be 0). */
export function insuranceDue(revenueTotal: number, patientPaid: number): number {
  const t = Number.isFinite(revenueTotal) ? revenueTotal : 0;
  const p = Number.isFinite(patientPaid) ? patientPaid : 0;
  return Math.round((t - p) * 100) / 100;
}
