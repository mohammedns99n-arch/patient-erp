import type { createClient } from "@/lib/supabase/server";

export type ShareTotals = {
  doctor_share: number;
  hospital_share: number;
  materials_share: number;
  total_cost: number;
};

export type DoctorMonth = { year: number; month: number; paid: ShareTotals; expected: ShareTotals };

export type DoctorSummary = {
  total: number;
  statusCounts: Record<number, number>;
  paid: ShareTotals;
  expected: ShareTotals;
  monthly: DoctorMonth[]; // one entry per (year, month) that has patients
};

const num = (v: unknown) => Number(v ?? 0) || 0;
const zero = (): ShareTotals => ({ doctor_share: 0, hospital_share: 0, materials_share: 0, total_cost: 0 });
const shares = (o: Record<string, unknown> | undefined | null): ShareTotals => ({
  doctor_share: num(o?.doctor_share),
  hospital_share: num(o?.hospital_share),
  materials_share: num(o?.materials_share),
  total_cost: num(o?.total_cost),
});

function parse(d: Record<string, unknown>): DoctorSummary {
  const statusCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const sc = (d.status_counts ?? {}) as Record<string, number>;
  for (const k of Object.keys(sc)) statusCounts[Number(k)] = num(sc[k]);

  const monthly = ((d.monthly ?? []) as { y: number; m: number; paid: Record<string, unknown>; expected: Record<string, unknown> }[]).map(
    (x) => ({ year: x.y, month: x.m - 1, paid: shares(x.paid), expected: shares(x.expected) })
  );

  return {
    total: num(d.total),
    statusCounts,
    paid: shares(d.paid as Record<string, unknown>),
    expected: shares(d.expected as Record<string, unknown>),
    monthly,
  };
}

/** Fallback aggregation if the RPC isn't present (dev only; bounded per doctor). */
async function fromRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  doctor: string
): Promise<DoctorSummary> {
  const { data } = await supabase
    .from("patients")
    .select("status_code, first_visit_date, doctor_share, hospital_share, materials_share, total_cost")
    .eq("treating_doctor", doctor);
  const rows = (data ?? []) as {
    status_code: number; first_visit_date: string;
    doctor_share: number | string | null; hospital_share: number | string | null;
    materials_share: number | string | null; total_cost: number | string | null;
  }[];

  const statusCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const paid = zero();
  const expected = zero();
  const byMonth = new Map<string, DoctorMonth>();
  const keys = ["doctor_share", "hospital_share", "materials_share", "total_cost"] as const;

  for (const r of rows) {
    statusCounts[r.status_code] = (statusCounts[r.status_code] ?? 0) + 1;
    const isPaid = r.status_code === 3;
    for (const k of keys) {
      const v = num(r[k]);
      expected[k] += v;
      if (isPaid) paid[k] += v;
    }
    const y = Number((r.first_visit_date ?? "").slice(0, 4));
    const m = Number((r.first_visit_date ?? "").slice(5, 7)) - 1;
    if (y && m >= 0 && m <= 11) {
      const key = `${y}-${m}`;
      const cell = byMonth.get(key) ?? { year: y, month: m, paid: zero(), expected: zero() };
      for (const k of keys) {
        const v = num(r[k]);
        cell.expected[k] += v;
        if (isPaid) cell.paid[k] += v;
      }
      byMonth.set(key, cell);
    }
  }

  const monthly = Array.from(byMonth.values()).sort(
    (a, b) => b.year - a.year || a.month - b.month
  );
  return { total: rows.length, statusCounts, paid, expected, monthly };
}

export async function getDoctorSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  doctor: string
): Promise<DoctorSummary> {
  const res = await supabase.rpc("doctor_summary", { doc: doctor });
  return !res.error && res.data
    ? parse(res.data as Record<string, unknown>)
    : fromRows(supabase, doctor);
}
