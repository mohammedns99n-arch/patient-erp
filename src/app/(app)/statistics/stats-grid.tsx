"use client";

import { useState, type ReactNode } from "react";
import { getT, statusLabel, caseTypeLabel, monthName, type Locale } from "@/lib/i18n";
import { STATUS, STATUS_CODES } from "@/lib/constants";
import { Donut, HBarChart, LineChart } from "../charts";

export type StatsData = {
  total: number;
  statusCounts: Record<number, number>;
  typeCounts: Record<string, number>;
  doctors: [string, number][];
  years: string[];
  volumeByYear: Record<string, number[]>;
};

const PALETTE = ["#10b981", "#5B8DEF", "#F2994A", "#9B51E0", "#EB5757", "#2D9CDB"];
const cardCls = "rounded-2xl bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 shadow-sm";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Card({
  title,
  summary,
  open,
  onToggle,
  toggleLabel,
  children,
}: {
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  toggleLabel: string;
  children: ReactNode;
}) {
  return (
    <section className={`${cardCls} ${open ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-start p-5 flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <h2 className="font-bold">{title}</h2>
          <div className="mt-1 text-sm text-black/60 dark:text-white/60">{summary}</div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-xs text-black/50 dark:text-white/50">
          <span className="hidden sm:inline">{toggleLabel}</span>
          <Chevron open={open} />
        </span>
      </button>
      {open && <div className="px-5 pb-5 -mt-1">{children}</div>}
    </section>
  );
}

export default function StatsGrid({ locale, data }: { locale: Locale; data: StatsData }) {
  const t = getT(locale);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = (k: string) => setOpenKey((cur) => (cur === k ? null : k));
  const toggleLabel = (k: string) => (openKey === k ? t("showLess") : t("showDetails"));

  if (data.total === 0) {
    return (
      <p className="rounded-2xl border border-black/10 dark:border-white/10 p-6 text-black/60 dark:text-white/60">
        {t("statNoData")} <a href="/patients/new" className="text-emerald-600 hover:underline">{t("addTheFirst")}</a>.
      </p>
    );
  }

  const months = Array.from({ length: 12 }, (_, i) => monthName(locale, i));
  const surgical = data.typeCounts.Surgical ?? 0;
  const medical = data.typeCounts.Medical ?? 0;

  // Years ascending for time-based charts (oldest → newest).
  const yearsAsc = [...data.years].sort((a, b) => a.localeCompare(b));
  const yearTotal = (y: string) => (data.volumeByYear[y] ?? []).reduce((a, b) => a + b, 0);
  const latestYear = data.years[0];
  const prevYear = data.years[1];
  const latestTotal = latestYear ? yearTotal(latestYear) : 0;
  const prevTotal = prevYear ? yearTotal(prevYear) : 0;
  const yoyDelta = prevTotal ? Math.round(((latestTotal - prevTotal) / prevTotal) * 100) : null;

  const topDoctor = data.doctors[0];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Surgical vs Medical */}
      <Card
        title={t("statSurgicalVsMedical")}
        summary={<span className="tabular-nums">{caseTypeLabel(locale, "Surgical")} {surgical} · {caseTypeLabel(locale, "Medical")} {medical}</span>}
        open={openKey === "type"}
        onToggle={() => toggle("type")}
        toggleLabel={toggleLabel("type")}
      >
        <div className="flex flex-wrap items-center gap-6">
          <Donut
            segments={[
              { value: surgical, color: "#5B8DEF" },
              { value: medical, color: "#10b981" },
            ]}
            total={surgical + medical}
            centerValue={surgical + medical}
            centerLabel={t("patientsWord")}
          />
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#5B8DEF" }} /><span className="flex-1">{caseTypeLabel(locale, "Surgical")}</span><b className="tabular-nums">{surgical}</b></li>
            <li className="flex items-center gap-2.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#10b981" }} /><span className="flex-1">{caseTypeLabel(locale, "Medical")}</span><b className="tabular-nums">{medical}</b></li>
          </ul>
        </div>
      </Card>

      {/* Patients per month */}
      <Card
        title={t("statPatientsPerMonth")}
        summary={<span className="tabular-nums">{latestYear ? `${latestTotal} · ${latestYear}` : "—"} <span className="text-black/40 dark:text-white/40">({t("thisYear")})</span></span>}
        open={openKey === "month"}
        onToggle={() => toggle("month")}
        toggleLabel={toggleLabel("month")}
      >
        <LineChart
          xLabels={months}
          series={yearsAsc.map((y, i) => ({
            name: y,
            color: PALETTE[i % PALETTE.length],
            points: data.volumeByYear[y] ?? Array(12).fill(0),
          }))}
        />
      </Card>

      {/* Year-over-year */}
      <Card
        title={t("statYoY")}
        summary={
          yoyDelta === null ? (
            <span className="tabular-nums">{latestTotal} · {latestYear ?? "—"}</span>
          ) : (
            <span className={`tabular-nums ${yoyDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(yoyDelta)}% <span className="text-black/40 dark:text-white/40">{t("vsPrevYear")}</span>
            </span>
          )
        }
        open={openKey === "yoy"}
        onToggle={() => toggle("yoy")}
        toggleLabel={toggleLabel("yoy")}
      >
        <HBarChart data={yearsAsc.map((y) => ({ label: y, value: yearTotal(y) }))} />
      </Card>

      {/* Patients per doctor */}
      <Card
        title={t("statPerDoctor")}
        summary={topDoctor ? <span>{t("topDoctor")}: <b>{topDoctor[0]}</b> <span className="tabular-nums text-black/40 dark:text-white/40">({topDoctor[1]})</span></span> : "—"}
        open={openKey === "doctor"}
        onToggle={() => toggle("doctor")}
        toggleLabel={toggleLabel("doctor")}
      >
        <HBarChart data={data.doctors.slice(0, 12).map(([name, n]) => ({ label: name, value: n }))} />
      </Card>

      {/* Patients by status */}
      <Card
        title={t("statByStatus")}
        summary={<span className="tabular-nums">{STATUS_CODES.map((c) => `${statusLabel(locale, c)} ${data.statusCounts[c] ?? 0}`).join(" · ")}</span>}
        open={openKey === "status"}
        onToggle={() => toggle("status")}
        toggleLabel={toggleLabel("status")}
      >
        <div className="flex flex-wrap items-center gap-6">
          <Donut
            segments={STATUS_CODES.map((c) => ({ value: data.statusCounts[c] ?? 0, color: STATUS[c].strong }))}
            total={data.total}
            centerValue={data.total}
            centerLabel={t("patientsWord")}
          />
          <ul className="space-y-2 text-sm">
            {STATUS_CODES.map((c) => (
              <li key={c} className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS[c].strong }} />
                <span className="flex-1">{statusLabel(locale, c)}</span>
                <b className="tabular-nums">{data.statusCounts[c] ?? 0}</b>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
