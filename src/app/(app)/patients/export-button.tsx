"use client";

import { useState } from "react";
import { STATUS, type StatusCode } from "@/lib/constants";
import { formatDateTime, todayInBaghdad } from "@/lib/dates";
import { getT, type Locale } from "@/lib/i18n";

export type ExportRow = {
  case_id: number;
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
  status_code: number;
  first_visit_date: string;
  last_updated: string;
};

const n = (v: number | string | null) => Number(v ?? 0) || 0;

export default function ExportButton({ rows, locale }: { rows: ExportRow[]; locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const t = getT(locale);

  async function onExport() {
    if (rows.length === 0 || busy) return;
    setBusy(true);
    try {
      // Load SheetJS only when the user actually exports.
      const XLSX = await import("xlsx");

      const data = rows.map((r) => ({
        "Case ID": r.case_id,
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
        "Status Code": r.status_code,
        Status: STATUS[(r.status_code as StatusCode) ?? 0].label,
        "First Visit Date": r.first_visit_date,
        "Last Updated (Baghdad)": formatDateTime(r.last_updated),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [
        { wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 5 }, { wch: 10 },
        { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 14 },
        { wch: 20 },
      ];

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
      disabled={rows.length === 0 || busy}
      title={rows.length === 0 ? t("noRowsToExport") : t("exportTitle")}
      className="rounded-lg border border-black/15 dark:border-white/15 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? t("exporting") : `${t("exportExcel")} (${rows.length})`}
    </button>
  );
}
