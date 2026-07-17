"use client";

import { useState } from "react";
import { STATUS } from "@/lib/constants";
import { formatDateTime, todayInBaghdad } from "@/lib/dates";
import { getT, type Locale } from "@/lib/i18n";
import { fetchPatientsForExport } from "./actions";
import type { PatientFilters } from "@/lib/patient-filters";

export type ExportRow = {
  case_id: number;
  patient_erp_id: string | null;
  patient_name: string;
  phone_number: string | null;
  age: number;
  case_type: string;
  treating_doctor: string;
  diagnosis: string;
  procedure_type: string;
  total_cost: number | string | null;
  materials_share: number | string | null;
  hospital_share: number | string | null;
  doctor_share: number | string | null;
  revenue_total: number | string | null;
  revenue_patient_paid: number | string | null;
  revenue_insurance_due: number | string | null;
  status_code: number;
  first_visit_date: string;
  last_updated: string;
};

const n = (v: number | string | null) => Number(v ?? 0) || 0;

export default function ExportButton({
  filters,
  count,
  locale,
  canViewFinancials,
}: {
  filters: PatientFilters;
  count: number;
  locale: Locale;
  canViewFinancials: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const t = getT(locale);

  async function onExport() {
    if (count === 0 || busy) return;
    setBusy(true);
    try {
      // Fetch the FULL filtered set (not just the visible page), then load
      // SheetJS lazily and build the workbook.
      const res = await fetchPatientsForExport(filters);
      if (res.error) {
        alert(res.error);
        return;
      }
      const rows = res.rows as ExportRow[];
      const XLSX = await import("xlsx");

      const data = rows.map((r) => ({
        "Case ID": r.case_id,
        "ERP ID": r.patient_erp_id ?? "",
        "Patient Name": r.patient_name,
        "Phone Number": r.phone_number ?? "",
        Age: r.age,
        "Case Type": r.case_type,
        "Treating Doctor": r.treating_doctor,
        Diagnosis: r.diagnosis,
        "Procedure Type": r.procedure_type,
        "Total Cost (IQD)": n(r.total_cost),
        "Materials Share (IQD)": n(r.materials_share),
        "Hospital Share (IQD)": n(r.hospital_share),
        "Doctor Share (IQD)": n(r.doctor_share),
        // Revenue Collection is only exported for users who can view financials.
        ...(canViewFinancials
          ? {
              "Revenue Total (IQD)": n(r.revenue_total),
              "Patient Paid (IQD)": n(r.revenue_patient_paid),
              "Insurance Due (IQD)": n(r.revenue_insurance_due),
            }
          : {}),
        "Status Code": r.status_code,
        Status: STATUS[(r.status_code as 0 | 1 | 2 | 3) ?? 0].label,
        "First Visit Date": r.first_visit_date,
        "Last Updated (Baghdad)": formatDateTime(r.last_updated),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      // Column widths sized from the header keys (row set is dynamic).
      ws["!cols"] = Object.keys(data[0] ?? {}).map((k) => ({
        wch: Math.max(10, Math.min(28, k.length + 2)),
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Patients");
      XLSX.writeFile(wb, `patients-${todayInBaghdad()}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={count === 0 || busy}
      title={count === 0 ? t("noRowsToExport") : t("exportTitle")}
      className="rounded-lg border border-black/15 dark:border-white/15 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? t("exporting") : `${t("exportExcel")} (${count})`}
    </button>
  );
}
