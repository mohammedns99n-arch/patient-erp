"use server";

import { getSessionProfile, permissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { NameRow } from "../monthly-count-table";

/**
 * Patient names for a given status within an invoice-submission month.
 * Gated by can_view_financials. Only statuses 2 and 3 are exposed here.
 */
export async function financialsMonthNames(
  year: number,
  month: number, // 0-11
  status: number
): Promise<{ rows: NameRow[]; error: string | null }> {
  const profile = await getSessionProfile();
  if (!profile || !permissions(profile).canViewFinancials) {
    return { rows: [], error: "Not allowed." };
  }
  if (![2, 3].includes(status)) return { rows: [], error: "Invalid status." };

  const supabase = await createClient();
  const start = new Date(Date.UTC(year, month, 1)).toISOString();
  const end = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  const { data, error } = await supabase
    .from("patients")
    .select("id, case_id, patient_name")
    .eq("status_code", status)
    .gte("invoice_submitted_at", start)
    .lt("invoice_submitted_at", end)
    .order("patient_name", { ascending: true });

  return {
    rows: (data ?? []).map((r) => ({ id: r.id, case_id: r.case_id, name: r.patient_name })),
    error: error ? error.message : null,
  };
}
