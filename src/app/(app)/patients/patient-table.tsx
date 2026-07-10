"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { STATUS, STATUS_CODES, type StatusCode } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getT, statusLabel, type Locale } from "@/lib/i18n";
import { updateStatus } from "./actions";

export type PatientRow = {
  id: string;
  case_id: number;
  patient_name: string;
  phone_number: string | null;
  age: number;
  case_type: string;
  treating_doctor: string;
  diagnosis: string;
  total_cost: number;
  status_code: number;
  first_visit_date: string;
  last_updated: string;
};

/**
 * Inline status dropdown. Saves immediately, shows an optimistic value, and
 * stops its clicks/keys from bubbling to the row (which would open the edit
 * page). Reverts on error.
 */
function StatusSelect({ id, value, locale }: { id: string; value: number; locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(value);

  useEffect(() => setCurrent(value), [value]);

  const status = STATUS[(current as StatusCode) ?? 0];

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = Number(e.target.value);
    const prev = current;
    setCurrent(next);
    startTransition(async () => {
      const res = await updateStatus(id, next);
      if (res.error) {
        setCurrent(prev);
        alert(`${res.error}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <select
      value={current}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      disabled={pending}
      aria-label={getT(locale)("changeStatus")}
      className="rounded-md border border-black/20 px-2 py-1.5 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
      style={{ backgroundColor: status.rowBg, color: "#1a1a1a" }}
    >
      {STATUS_CODES.map((c) => (
        <option key={c} value={c}>
          {c} · {statusLabel(locale, c)}
        </option>
      ))}
    </select>
  );
}

const thBase = "text-start font-semibold px-3 py-2 whitespace-nowrap";
const tdBase = "px-3 py-2.5 whitespace-nowrap";

type Col = {
  header: string;
  hide?: string;
  align?: "end";
  cell: (r: PatientRow) => ReactNode;
};

function getColumns(locale: Locale): Col[] {
  const t = getT(locale);
  return [
    { header: t("colCase"), cell: (r) => <span className="font-medium">#{r.case_id}</span> },
    { header: t("colPatient"), cell: (r) => r.patient_name },
    {
      header: t("colPhone"),
      hide: "hidden lg:table-cell",
      cell: (r) =>
        r.phone_number ? (
          <span dir="ltr" className="tabular-nums">{r.phone_number}</span>
        ) : (
          <span className="text-black/30">—</span>
        ),
    },
    { header: t("colAge"), hide: "hidden md:table-cell", cell: (r) => r.age },
    { header: t("colType"), hide: "hidden lg:table-cell", cell: (r) => r.case_type },
    { header: t("colDoctor"), hide: "hidden sm:table-cell", cell: (r) => r.treating_doctor },
    {
      header: t("colDiagnosis"),
      hide: "hidden lg:table-cell",
      cell: (r) => (
        <span className="block max-w-[16rem] truncate" title={r.diagnosis}>{r.diagnosis}</span>
      ),
    },
    {
      header: t("colTotal"),
      hide: "hidden sm:table-cell",
      align: "end",
      cell: (r) => <span className="tabular-nums">{r.total_cost.toLocaleString("en-US")}</span>,
    },
    {
      header: t("colStatus"),
      cell: (r) => <StatusSelect id={r.id} value={r.status_code} locale={locale} />,
    },
    { header: t("colFirstVisit"), hide: "hidden md:table-cell", cell: (r) => formatDate(r.first_visit_date) },
    { header: t("colLastUpdated"), cell: (r) => formatDateTime(r.last_updated) },
  ];
}

export default function PatientTable({ rows, locale }: { rows: PatientRow[]; locale: Locale }) {
  const router = useRouter();
  const t = getT(locale);
  const columns = getColumns(locale);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-10 text-center text-black/60 dark:text-white/60">
        {t("noPatientsMatch")}{" "}
        <a href="/patients/new" className="text-blue-600 hover:underline">{t("addAPatient")}</a>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={`${thBase} ${c.align === "end" ? "text-end" : ""} ${c.hide ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = STATUS[(r.status_code as StatusCode) ?? 0];
            return (
              <tr
                key={r.id}
                onClick={() => router.push(`/patients/${r.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/patients/${r.id}`);
                }}
                tabIndex={0}
                role="link"
                aria-label={`${t("colCase")} ${r.case_id}, ${r.patient_name}`}
                style={{ backgroundColor: status.rowBg, color: "#1a1a1a" }}
                className="cursor-pointer border-t border-black/10 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600"
              >
                {columns.map((c, i) => (
                  <td key={i} className={`${tdBase} ${c.align === "end" ? "text-end" : ""} ${c.hide ?? ""}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
