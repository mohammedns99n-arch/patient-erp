import type { createClient } from "@/lib/supabase/server";

/**
 * Aggregated patient metrics, computed once per request and shared by the
 * dashboard, statistics, and financials pages. All plain objects (no Maps) so
 * the shape is safely serializable to Client Components.
 *
 * volumeByYear[year]  = 12 monthly patient counts (index 0 = Jan)
 * finByYear[year]     = 12 monthly { billed, received } totals
 */
export type Aggregate = {
  total: number;
  statusCounts: Record<number, number>;
  typeCounts: Record<string, number>;
  doctors: [string, number][];
  years: string[];
  volumeByYear: Record<string, number[]>;
  finByYear: Record<string, { billed: number; received: number }[]>;
  billedTotal: number;
  receivedTotal: number;
};

const blankMonths = () => Array.from({ length: 12 }, () => 0);
const blankFin = () =>
  Array.from({ length: 12 }, () => ({ billed: 0, received: 0 }));

function sortedYears(
  volumeByYear: Record<string, number[]>,
  finByYear: Record<string, { billed: number; received: number }[]>
): string[] {
  return Array.from(
    new Set([...Object.keys(volumeByYear), ...Object.keys(finByYear)])
  ).sort((a, b) => b.localeCompare(a));
}

/** Parse the dashboard_summary() JSON (SQL-side aggregation) into Aggregate. */
function parseAgg(d: Record<string, unknown>): Aggregate {
  const statusCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const sc = (d.status_counts ?? {}) as Record<string, number>;
  for (const k of Object.keys(sc)) statusCounts[Number(k)] = Number(sc[k]) || 0;

  const typeCounts: Record<string, number> = { Medical: 0, Surgical: 0 };
  const tc = (d.type_counts ?? {}) as Record<string, number>;
  for (const k of Object.keys(tc)) typeCounts[k] = Number(tc[k]) || 0;

  const doctors = ((d.doctors ?? []) as { name: string; n: number }[]).map(
    (x) => [x.name, Number(x.n)] as [string, number]
  );

  const volumeByYear: Record<string, number[]> = {};
  for (const v of (d.volume ?? []) as { y: number; m: number; n: number }[]) {
    const y = String(v.y);
    (volumeByYear[y] ??= blankMonths())[v.m - 1] = Number(v.n) || 0;
  }

  const finByYear: Record<string, { billed: number; received: number }[]> = {};
  for (const f of (d.fin ?? []) as {
    y: number;
    m: number;
    billed: number;
    received: number;
  }[]) {
    const y = String(f.y);
    (finByYear[y] ??= blankFin())[f.m - 1] = {
      billed: Number(f.billed) || 0,
      received: Number(f.received) || 0,
    };
  }

  return {
    total: Number(d.total) || 0,
    statusCounts,
    typeCounts,
    doctors,
    years: sortedYears(volumeByYear, finByYear),
    volumeByYear,
    finByYear,
    billedTotal: Number(d.billed_total) || 0,
    receivedTotal: Number(d.received_total) || 0,
  };
}

/** Fallback aggregation (client-side scan) if the perf RPC isn't present yet. */
async function aggFromRows(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Aggregate> {
  const { data } = await supabase
    .from("patients")
    .select("status_code, case_type, treating_doctor, total_cost, first_visit_date");
  const rows = (data ?? []) as {
    status_code: number;
    case_type: string;
    treating_doctor: string;
    total_cost: number | string | null;
    first_visit_date: string;
  }[];

  const statusCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const typeCounts: Record<string, number> = { Medical: 0, Surgical: 0 };
  const doctorCounts = new Map<string, number>();
  const volumeByYear: Record<string, number[]> = {};
  const finByYear: Record<string, { billed: number; received: number }[]> = {};
  let billedTotal = 0;
  let receivedTotal = 0;

  for (const r of rows) {
    statusCounts[r.status_code] = (statusCounts[r.status_code] ?? 0) + 1;
    if (r.case_type in typeCounts) typeCounts[r.case_type] += 1;
    if (r.treating_doctor)
      doctorCounts.set(r.treating_doctor, (doctorCounts.get(r.treating_doctor) ?? 0) + 1);
    const y = (r.first_visit_date ?? "").slice(0, 4);
    const m = Number((r.first_visit_date ?? "").slice(5, 7)) - 1;
    const cost = Number(r.total_cost ?? 0) || 0;
    if (y && m >= 0 && m <= 11) {
      (volumeByYear[y] ??= blankMonths())[m] += 1;
      const fin = (finByYear[y] ??= blankFin());
      if (r.status_code === 2) fin[m].billed += cost;
      if (r.status_code === 3) fin[m].received += cost;
    }
    if (r.status_code === 2) billedTotal += cost;
    if (r.status_code === 3) receivedTotal += cost;
  }

  return {
    total: rows.length,
    statusCounts,
    typeCounts,
    doctors: Array.from(doctorCounts.entries()).sort((a, b) => b[1] - a[1]),
    years: sortedYears(volumeByYear, finByYear),
    volumeByYear,
    finByYear,
    billedTotal,
    receivedTotal,
  };
}

/** One aggregation per request: SQL RPC if available, else a fallback scan. */
export async function getAggregate(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Aggregate> {
  const summary = await supabase.rpc("dashboard_summary");
  return !summary.error && summary.data
    ? parseAgg(summary.data as Record<string, unknown>)
    : aggFromRows(supabase);
}
