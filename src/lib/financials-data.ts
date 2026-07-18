import type { createClient } from "@/lib/supabase/server";

/** One invoice-submission month (grouped by invoice_submitted_at). */
export type MonthFin = {
  key: string; // "YYYY-MM"
  year: number;
  month: number; // 0-11
  totalBilled: number; // sum(total_cost)
  hospitalShare: number; // sum(hospital_share)
  allPaid: boolean; // every case that month is status 3
  count: number;
  s2: number; // count status 2 (submitted, pending)
  s3: number; // count status 3 (received)
};

export type FinancialsData = {
  outstanding: number; // sum(total_cost) where status 2 (billed, not received)
  amountCollected: number; // sum(total_cost) where status 3 (received)
  submittedCount: number; // count status 2
  receivedCount: number; // count status 3
  months: MonthFin[]; // by invoice_submitted_at, sorted ascending
};

const num = (v: unknown) => Number(v ?? 0) || 0;
const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

// Baghdad is a fixed UTC+3 (Iraq has no DST). Bucket a UTC timestamp by its
// Baghdad calendar month so it matches the SQL (`at time zone 'Asia/Baghdad'`).
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;
function baghdadYM(iso: string): { y: number; m: number } {
  const dt = new Date(Date.parse(iso) + BAGHDAD_OFFSET_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() };
}

function parse(d: Record<string, unknown>): FinancialsData {
  const months = ((d.months ?? []) as {
    y: number; m: number; total_billed: number; hospital_share: number; all_paid: boolean; count: number; s2: number; s3: number;
  }[]).map((r) => ({
    key: monthKey(r.y, r.m),
    year: r.y,
    month: r.m - 1,
    totalBilled: num(r.total_billed),
    hospitalShare: num(r.hospital_share),
    allPaid: Boolean(r.all_paid),
    count: num(r.count),
    s2: num(r.s2),
    s3: num(r.s3),
  }));
  months.sort((a, b) => a.key.localeCompare(b.key));

  return {
    outstanding: num(d.outstanding),
    amountCollected: num(d.amount_collected),
    submittedCount: num(d.submitted_count),
    receivedCount: num(d.received_count),
    months,
  };
}

/** Fallback if the financials_summary RPC isn't present (dev only). */
async function fromRows(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<FinancialsData> {
  const { data } = await supabase
    .from("patients")
    .select("status_code, total_cost, hospital_share, invoice_submitted_at");
  const rows = (data ?? []) as {
    status_code: number; total_cost: number | string | null;
    hospital_share: number | string | null; invoice_submitted_at: string | null;
  }[];

  let outstanding = 0;
  let amountCollected = 0;
  let submittedCount = 0;
  let receivedCount = 0;
  const byMonth = new Map<string, MonthFin>();

  for (const r of rows) {
    const cost = num(r.total_cost);
    if (r.status_code === 2) { outstanding += cost; submittedCount += 1; }
    if (r.status_code === 3) { amountCollected += cost; receivedCount += 1; }
    if (r.invoice_submitted_at) {
      const { y, m } = baghdadYM(r.invoice_submitted_at);
      const key = monthKey(y, m + 1);
      const cur = byMonth.get(key) ?? { key, year: y, month: m, totalBilled: 0, hospitalShare: 0, allPaid: true, count: 0, s2: 0, s3: 0 };
      cur.totalBilled += cost;
      cur.hospitalShare += num(r.hospital_share);
      cur.allPaid = cur.allPaid && r.status_code === 3;
      cur.count += 1;
      if (r.status_code === 2) cur.s2 += 1;
      if (r.status_code === 3) cur.s3 += 1;
      byMonth.set(key, cur);
    }
  }

  return {
    outstanding,
    amountCollected,
    submittedCount,
    receivedCount,
    months: Array.from(byMonth.values()).sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export async function getFinancials(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<FinancialsData> {
  const res = await supabase.rpc("financials_summary");
  return !res.error && res.data
    ? parse(res.data as Record<string, unknown>)
    : fromRows(supabase);
}

// --- Processing time (average lifecycle durations, in days) ---------------

/** Average durations; null when no case has both relevant dates. */
export type Durations = {
  visitToInvoice: number | null; // first visit -> invoice submitted
  invoiceToPayment: number | null; // invoice submitted -> payment received
  visitToPayment: number | null; // first visit -> payment received (full cycle)
  nVi: number;
  nIp: number;
  nVp: number;
};
export type ProcessingMonth = Durations & { key: string; year: number; month: number };
export type ProcessingTime = { overall: Durations; monthly: ProcessingMonth[] };

// Guard: a duration can never be negative. If one somehow computes below 0
// (the DB already clamps per row), treat it as 0 and log it so we can spot
// data problems.
const dur = (v: unknown) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) {
    console.warn(`[processing-time] negative duration ${n} clamped to 0`);
    return 0;
  }
  return n;
};

function parseDurations(o: Record<string, unknown> | undefined | null): Durations {
  return {
    visitToInvoice: dur(o?.visit_to_invoice),
    invoiceToPayment: dur(o?.invoice_to_payment),
    visitToPayment: dur(o?.visit_to_payment),
    nVi: num(o?.n_vi),
    nIp: num(o?.n_ip),
    nVp: num(o?.n_vp),
  };
}

export async function getProcessingTime(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ProcessingTime> {
  const res = await supabase.rpc("processing_time_summary");
  if (res.error || !res.data) return { overall: parseDurations(null), monthly: [] };
  const d = res.data as Record<string, unknown>;

  // Surface genuine data problems: the DB clamps negative durations to 0 for the
  // averages but reports how many raw negatives it saw (e.g. payment before
  // invoice, or a first_visit_date after the invoice date).
  const o = (d.overall ?? {}) as Record<string, unknown>;
  const negVi = num(o.neg_vi), negIp = num(o.neg_ip), negVp = num(o.neg_vp);
  if (negVi || negIp || negVp) {
    console.warn(
      `[processing-time] negative raw durations detected (clamped to 0) — possible data issue: ` +
      `visit→invoice=${negVi}, invoice→payment=${negIp}, visit→payment=${negVp}`
    );
  }

  const monthly = ((d.monthly ?? []) as (Record<string, unknown> & { y: number; m: number })[])
    .map((r) => ({ ...parseDurations(r), key: monthKey(r.y, r.m), year: r.y, month: r.m - 1 }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return { overall: parseDurations(d.overall as Record<string, unknown>), monthly };
}
