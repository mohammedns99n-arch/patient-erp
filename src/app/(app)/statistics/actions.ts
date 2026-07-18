"use server";

import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { NameRow } from "../monthly-count-table";

/**
 * Patient names for a given status within a first-visit month.
 * Gated by can_view_statistics. All statuses (0-3) allowed.
 */
export async function statisticsMonthNames(
  year: number,
  month: number, // 0-11
  status: number
): Promise<{ rows: NameRow[]; error: string | null }> {
  const profile = await getSessionProfile();
  if (!profile || !permissions(profile).canViewStatistics) {
    return { rows: [], error: "Not allowed." };
  }
  if (![0, 1, 2, 3].includes(status)) return { rows: [], error: "Invalid status." };

  const supabase = await createClient();
  const mm = String(month + 1).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const ny = month === 11 ? year + 1 : year;
  const nm = month === 11 ? 1 : month + 2;
  const end = `${ny}-${String(nm).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("patients")
    .select("id, case_id, patient_name")
    .eq("status_code", status)
    .gte("first_visit_date", start)
    .lt("first_visit_date", end)
    .order("patient_name", { ascending: true });

  return {
    rows: (data ?? []).map((r) => ({ id: r.id, case_id: r.case_id, name: r.patient_name })),
    error: error ? error.message : null,
  };
}
