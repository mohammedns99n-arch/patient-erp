"use client";

import { useActionState, useState } from "react";
import type { SaveState } from "./actions";
import { CASE_TYPES, STATUS_CODES } from "@/lib/constants";
import { getT, statusLabel, caseTypeLabel, type Locale } from "@/lib/i18n";
import { resolvePatientPaid, insuranceDue, fmtMoney } from "@/lib/revenue";

const initialState: SaveState = { error: null };

const inputCls =
  "w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3.5 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "text-sm font-medium";

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export type PatientInitial = {
  id?: string;
  patient_erp_id?: string | null;
  patient_name?: string;
  phone_number?: string | null;
  age?: number | string;
  case_type?: string;
  treating_doctor?: string;
  procedure_type?: string;
  diagnosis?: string;
  status_code?: number;
  total_cost?: number;
  materials_share?: number;
  hospital_share?: number;
  doctor_share?: number;
  revenue_total?: number;
  revenue_patient_paid?: number;
  lab_investigations?: string | null;
  imaging_studies?: string | null;
  notes?: string | null;
};

export default function PatientForm({
  action,
  mode,
  locale,
  canViewFinancials,
  initial = {},
}: {
  action: (state: SaveState, formData: FormData) => Promise<SaveState>;
  mode: "create" | "edit";
  locale: Locale;
  canViewFinancials: boolean;
  initial?: PatientInitial;
}) {
  const t = getT(locale);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [total, setTotal] = useState(Number(initial.total_cost ?? 0));
  const [materials, setMaterials] = useState(Number(initial.materials_share ?? 0));
  const [hospital, setHospital] = useState(Number(initial.hospital_share ?? 0));
  const [doctor, setDoctor] = useState(Number(initial.doctor_share ?? 0));

  // Revenue Collection — independent from the cost-share breakdown above.
  const [revenueTotal, setRevenueTotal] = useState(Number(initial.revenue_total ?? 0));
  const [paidRaw, setPaidRaw] = useState(
    initial.revenue_patient_paid ? String(initial.revenue_patient_paid) : ""
  );
  const resolvedPaid = resolvePatientPaid(paidRaw, revenueTotal);
  const dueAmount = insuranceDue(revenueTotal, resolvedPaid);

  const sum = materials + hospital + doctor;
  const anyMoneyEntered = total > 0 || sum > 0;
  const mismatch = anyMoneyEntered && sum !== total;
  const diff = sum - total;

  const numProps = (setter: (v: number) => void, defaultValue: number | undefined) => ({
    type: "number" as const,
    min: 0,
    step: "any",
    inputMode: "decimal" as const,
    className: inputCls,
    defaultValue: defaultValue ?? 0,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setter(Number(e.target.value) || 0),
  });

  return (
    <form action={formAction} className="space-y-8">
      {mode === "edit" && <input type="hidden" name="id" value={initial.id} />}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold mb-1">{t("secPatient")}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="patient_erp_id" className={labelCls}>
              {t("fErpId")}{mode === "create" ? " *" : ""}
            </label>
            <input
              id="patient_erp_id"
              name="patient_erp_id"
              required={mode === "create"}
              dir="ltr"
              defaultValue={initial.patient_erp_id ?? ""}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="patient_name" className={labelCls}>{t("fPatientName")} *</label>
            <input id="patient_name" name="patient_name" required defaultValue={initial.patient_name} className={inputCls} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="phone_number" className={labelCls}>{t("fPhone")}</label>
            <input
              id="phone_number"
              name="phone_number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="e.g. 0770 123 4567 or +964 770 123 4567"
              defaultValue={initial.phone_number ?? ""}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="age" className={labelCls}>{t("fAge")} *</label>
            <input id="age" name="age" type="number" min={0} max={150} required defaultValue={initial.age} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="case_type" className={labelCls}>{t("fCaseType")} *</label>
            <select id="case_type" name="case_type" required defaultValue={initial.case_type ?? ""} className={inputCls}>
              <option value="" disabled>{t("selectPlaceholder")}</option>
              {CASE_TYPES.map((ct) => (
                <option key={ct} value={ct}>{caseTypeLabel(locale, ct)}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold mb-1">{t("secCase")}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="treating_doctor" className={labelCls}>{t("fDoctor")} *</label>
            <input id="treating_doctor" name="treating_doctor" required defaultValue={initial.treating_doctor} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="procedure_type" className={labelCls}>{t("fProcedure")} *</label>
            <input id="procedure_type" name="procedure_type" required defaultValue={initial.procedure_type} className={inputCls} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="diagnosis" className={labelCls}>{t("fDiagnosis")} *</label>
            <input id="diagnosis" name="diagnosis" required defaultValue={initial.diagnosis} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status_code" className={labelCls}>{t("fStatus")}</label>
            <select id="status_code" name="status_code" defaultValue={initial.status_code ?? 0} className={inputCls}>
              {STATUS_CODES.map((c) => (
                <option key={c} value={c}>{c} — {statusLabel(locale, c)}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold mb-1">{t("secCost")}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="total_cost" className={labelCls}>{t("fTotal")}</label>
            <input id="total_cost" name="total_cost" {...numProps(setTotal, initial.total_cost)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="materials_share" className={labelCls}>{t("fMaterials")}</label>
            <input id="materials_share" name="materials_share" {...numProps(setMaterials, initial.materials_share)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="hospital_share" className={labelCls}>{t("fHospital")}</label>
            <input id="hospital_share" name="hospital_share" {...numProps(setHospital, initial.hospital_share)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="doctor_share" className={labelCls}>{t("fDoctorShare")}</label>
            <input id="doctor_share" name="doctor_share" {...numProps(setDoctor, initial.doctor_share)} />
          </div>
        </div>

        {mismatch && (
          <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/50 px-3.5 py-2.5">
            ⚠ {t("sharesAddUpTo")} <b>{fmt(sum)}</b>، {t("butTotalIs")} <b>{fmt(total)}</b>
            {" "}({diff > 0 ? "+" : ""}{fmt(diff)}). {t("canStillSave")}
          </p>
        )}
        {anyMoneyEntered && !mismatch && (
          <p className="text-sm text-green-700 dark:text-green-400">{t("sharesMatch")}</p>
        )}
      </fieldset>

      {/* Revenue Collection — gated: hidden from users without can_view_financials. */}
      {canViewFinancials && (
        <fieldset className="space-y-4 rounded-xl border border-emerald-300/40 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
          <legend className="text-base font-semibold px-1">{t("secRevenue")}</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="revenue_total" className={labelCls}>{t("fRevenueTotal")}</label>
              <input
                id="revenue_total"
                name="revenue_total"
                {...numProps(setRevenueTotal, initial.revenue_total)}
              />
              <p className="text-xs text-black/50 dark:text-white/50 tabular-nums">
                {fmtMoney(revenueTotal)} {t("iqd")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="revenue_patient_paid" className={labelCls}>{t("fRevenuePatientPaid")}</label>
              <input
                id="revenue_patient_paid"
                name="revenue_patient_paid"
                type="text"
                inputMode="text"
                dir="ltr"
                placeholder="800,000 · 15%"
                defaultValue={paidRaw}
                onChange={(e) => setPaidRaw(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-black/60 dark:text-white/60 tabular-nums">
                = <b>{fmtMoney(resolvedPaid)} {t("iqd")}</b>
                {paidRaw.trim().endsWith("%") && revenueTotal > 0 && (
                  <span className="text-black/45 dark:text-white/45"> · {t("revenuePctOf")} {fmtMoney(revenueTotal)}</span>
                )}
              </p>
            </div>
          </div>

          <p className="text-xs text-black/50 dark:text-white/50">{t("revenueHint")}</p>

          {/* Insurance due — always total − paid, read-only, updates live. */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3.5 py-3">
            <span className={labelCls}>{t("fRevenueInsuranceDue")}</span>
            <span className="text-lg font-semibold tabular-nums" dir="ltr">
              {fmtMoney(dueAmount)} <span className="text-sm font-normal text-black/50 dark:text-white/50">{t("iqd")}</span>
            </span>
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold mb-1">{t("secClinical")}</legend>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="lab_investigations" className={labelCls}>{t("fLab")}</label>
            <textarea id="lab_investigations" name="lab_investigations" rows={3} defaultValue={initial.lab_investigations ?? ""} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="imaging_studies" className={labelCls}>{t("fImaging")}</label>
            <textarea id="imaging_studies" name="imaging_studies" rows={3} defaultValue={initial.imaging_studies ?? ""} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="notes" className={labelCls}>{t("fNotes")}</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ""} className={inputCls} />
          </div>
        </div>
      </fieldset>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3.5 py-2.5">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? t("saving") : mode === "create" ? t("savePatient") : t("saveChanges")}
        </button>
        <a
          href={mode === "create" ? "/" : "/patients"}
          className="rounded-lg border border-black/15 dark:border-white/15 px-6 py-3 font-medium hover:bg-black/5 dark:hover:bg-white/10"
        >
          {t("cancel")}
        </a>
      </div>
    </form>
  );
}
