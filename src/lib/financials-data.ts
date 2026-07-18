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
  months: MonthFin[]; // sorted ascending
};

const num = (v: unknown) => Number(v ?? 0) || 0;
const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

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
      const dt = new Date(r.invoice_submitted_at);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
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
