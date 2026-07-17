// Pure inline-SVG chart primitives — no hooks, no external library, no
// "use client", so they render on the server AND can be imported by Client
// Components. Charts stay dir="ltr" (time/number axes read left→right) even in
// the Arabic RTL UI, which is the conventional way to show them.

import type { ReactNode } from "react";

const fmtDefault = (n: number) => n.toLocaleString("en-US");

/** Doughnut chart with an optional centre label. */
export function Donut({
  segments,
  total,
  centerValue,
  centerLabel,
  size = 176,
}: {
  segments: { value: number; color: string; label?: string }[];
  total: number;
  centerValue?: ReactNode;
  centerLabel?: string;
  size?: number;
}) {
  let acc = 0;
  const arcs = segments.map((s) => {
    const pct = total ? (s.value / total) * 100 : 0;
    const arc = { color: s.color, pct, offset: 25 - acc };
    acc += pct;
    return arc;
  });
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }} dir="ltr">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" className="text-black/10 dark:text-white/10" strokeWidth="4" />
        {total > 0 &&
          arcs.map((s, i) =>
            s.pct > 0 ? (
              <circle key={i} cx="18" cy="18" r="15.9155" fill="none" stroke={s.color} strokeWidth="4" strokeDasharray={`${s.pct} ${100 - s.pct}`} strokeDashoffset={s.offset} strokeLinecap="butt" />
            ) : null
          )}
      </svg>
      {(centerValue !== undefined || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue !== undefined && <span className="text-3xl font-bold tabular-nums">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-black/50 dark:text-white/50">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

/** Horizontal bar chart — good for "per doctor", "per year", category counts. */
export function HBarChart({
  data,
  formatValue = fmtDefault,
  barColor = "#10b981",
}: {
  data: { label: string; value: number; color?: string }[];
  formatValue?: (n: number) => string;
  barColor?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-black/70 dark:text-white/70" title={d.label}>{d.label}</span>
          <div className="relative flex-1 h-6 rounded bg-black/5 dark:bg-white/5 overflow-hidden">
            <div className="absolute inset-y-0 start-0 rounded" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: d.color ?? barColor }} />
          </div>
          <span className="w-20 shrink-0 text-end font-semibold tabular-nums">{formatValue(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Multi-series line chart with gridlines + y-axis labels. */
export function LineChart({
  series,
  xLabels,
  formatY = fmtDefault,
  height = 220,
}: {
  series: { name: string; color: string; points: (number | null)[] }[];
  xLabels: string[];
  formatY?: (n: number) => string;
  height?: number;
}) {
  const W = 640;
  const H = height;
  const padL = 56;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const allVals = series.flatMap((s) => s.points.filter((p): p is number => p != null));
  const rawMax = Math.max(1, ...allVals);
  // Round the axis max up to a "nice" number.
  const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const niceMax = Math.ceil(rawMax / pow) * pow;
  const n = xLabels.length;

  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / niceMax) * plotH;

  const gridLines = 4;
  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => (niceMax / gridLines) * i);

  return (
    <div dir="ltr">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} role="img">
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(tv)} y2={y(tv)} stroke="currentColor" className="text-black/10 dark:text-white/10" strokeWidth={1} />
            <text x={padL - 8} y={y(tv) + 4} textAnchor="end" className="fill-black/50 dark:fill-white/50" fontSize={11}>{formatY(tv)}</text>
          </g>
        ))}
        {xLabels.map((lbl, i) =>
          n <= 12 || i % 2 === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-black/50 dark:fill-white/50" fontSize={11}>{lbl}</text>
          ) : null
        )}
        {series.map((s) => {
          const pts = s.points
            .map((p, i) => (p == null ? null : `${x(i)},${y(p)}`))
            .filter((p): p is string => p != null)
            .join(" ");
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) =>
                p == null ? null : <circle key={i} cx={x(i)} cy={y(p)} r={3} fill={s.color} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
