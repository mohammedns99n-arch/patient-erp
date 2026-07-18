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
  // Baghdad (UTC+3, no DST) month boundaries as UTC instants, so the range
  // matches how financials_summary buckets invoice_submitted_at by Baghdad month.
  const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, month, 1) - BAGHDAD_OFFSET_MS).toISOString();
  const end = new Date(Date.UTC(year, month + 1, 1) - BAGHDAD_OFFSET_MS).toISOString();

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

/**
 * Patient names whose payment was received within a given Baghdad month
 * (grouped by payment_received_at — the "Money received by month" table).
 * Gated by can_view_financials.
 */
export async function financialsReceivedMonthNames(
  year: number,
  month: number // 0-11
): Promise<{ rows: NameRow[]; error: string | null }> {
  const profile = await getSessionProfile();
  if (!profile || !permissions(profile).canViewFinancials) {
    return { rows: [], error: "Not allowed." };
  }

  const supabase = await createClient();
  const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, month, 1) - BAGHDAD_OFFSET_MS).toISOString();
  const end = new Date(Date.UTC(year, month + 1, 1) - BAGHDAD_OFFSET_MS).toISOString();

  const { data, error } = await supabase
    .from("patients")
    .select("id, case_id, patient_name")
    .eq("status_code", 3)
    .gte("payment_received_at", start)
    .lt("payment_received_at", end)
    .order("patient_name", { ascending: true });

  return {
    rows: (data ?? []).map((r) => ({ id: r.id, case_id: r.case_id, name: r.patient_name })),
    error: error ? error.message : null,
  };
}
