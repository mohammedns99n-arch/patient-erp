"use client";

import { useRef, useState, type MouseEvent } from "react";
import { getT, monthName, type Locale } from "@/lib/i18n";
import { fmtMoney } from "@/lib/revenue";
import type { MonthFin } from "@/lib/financials-data";

const BLUE = "#5B8DEF"; // fully paid
const YELLOW = "#F2C94C"; // has pending

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** SVG path for a donut segment between two angles (degrees, clockwise). */
function segmentPath(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number) {
  const [x1, y1] = polar(cx, cy, rO, a0);
  const [x2, y2] = polar(cx, cy, rO, a1);
  const [x3, y3] = polar(cx, cy, rI, a1);
  const [x4, y4] = polar(cx, cy, rI, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x1},${y1} A${rO},${rO} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${rI},${rI} 0 ${large} 0 ${x4},${y4} Z`;
}

export function MonthlyDonut({ locale, months }: { locale: Locale; months: MonthFin[] }) {
  const t = getT(locale);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<MonthFin | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const label = (m: MonthFin) => `${monthName(locale, m.month)} ${m.year}`;

  if (months.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">{t("statNoData")}</p>;
  }

  const cx = 100, cy = 100, rO = 92, rI = 56;
  const grandTotal = months.reduce((a, m) => a + m.totalBilled, 0);
  // Segment size by amount billed; if every month is 0, fall back to equal slices.
  const weights = months.map((m) => (grandTotal > 0 ? m.totalBilled : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  let acc = 0;
  const arcs = months.map((m, i) => {
    const frac = weights[i] / weightSum;
    const a0 = acc * 360;
    acc += frac;
    const a1 = acc * 360;
    return { m, a0, a1, color: m.allPaid ? BLUE : YELLOW };
  });

  const single = months.length === 1;

  function onMove(e: MouseEvent) {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div ref={wrapRef} className="relative" onMouseMove={onMove} dir="ltr" style={{ width: 220, height: 220 }}>
        <svg viewBox="0 0 200 200" className="h-full w-full">
          {single ? (
            <circle
              cx={cx} cy={cy} r={(rO + rI) / 2} fill="none"
              stroke={arcs[0].color} strokeWidth={rO - rI}
              onMouseEnter={() => setHover(arcs[0].m)} onMouseLeave={() => setHover(null)}
            />
          ) : (
            arcs.map((a) => (
              <path
                key={a.m.key} d={segmentPath(cx, cy, rO, rI, a.a0, a.a1)}
                fill={a.color} stroke="white" strokeWidth={1.5}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={() => setHover(a.m)} onMouseLeave={() => setHover(null)}
              />
            ))
          )}
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-black dark:fill-white" fontSize={17} fontWeight={700}>
            {fmtMoney(grandTotal)}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" className="fill-black/50 dark:fill-white/50" fontSize={10}>
            {t("iqd")}
          </text>
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-zinc-900 text-white text-xs px-3 py-2 shadow-lg whitespace-nowrap"
            style={{ left: pos.x, top: pos.y, transform: "translate(-50%, calc(-100% - 12px))" }}
          >
            <div className="font-semibold mb-0.5">{label(hover)}</div>
            <div dir="ltr">{t("finHospitalShare")}: {fmtMoney(hover.hospitalShare)} {t("iqd")}</div>
            <div dir="ltr">{t("colTotal")}: {fmtMoney(hover.totalBilled)} {t("iqd")}</div>
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: BLUE }} />{t("legendFullyPaid")}</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: YELLOW }} />{t("legendHasPending")}</div>
      </div>
    </div>
  );
}

export function MonthlyBreakdown({ locale, months }: { locale: Locale; months: MonthFin[] }) {
  const t = getT(locale);
  // Newest first for the chips; default-select the latest month.
  const ordered = [...months].reverse();
  const [sel, setSel] = useState<string | null>(ordered[0]?.key ?? null);
  const selected = months.find((m) => m.key === sel) ?? null;
  const label = (m: MonthFin) => `${monthName(locale, m.month)} ${m.year}`;

  if (months.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">{t("statNoData")}</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {ordered.map((m) => {
          const active = m.key === sel;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSel(m.key)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-semibold"
                  : "border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {label(m)}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
            <div className="text-sm text-black/60 dark:text-white/60">{t("finTotalWorked")}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums" dir="ltr">{fmtMoney(selected.totalBilled)} <span className="text-sm font-normal text-black/50 dark:text-white/50">{t("iqd")}</span></div>
          </div>
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
            <div className="text-sm text-black/60 dark:text-white/60">{t("finHospitalShare")}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400" dir="ltr">{fmtMoney(selected.hospitalShare)} <span className="text-sm font-normal text-black/50 dark:text-white/50">{t("iqd")}</span></div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-black/50 dark:text-white/50">{t("selectMonthPrompt")}</p>
      )}
    </div>
  );
}
