'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

export interface TrendPoint {
  /** ISO timestamp */
  time: string;
  /** Primary value — for BP we also pass a secondary value */
  value: number;
  /** Optional second value drawn as a second line (e.g. diastolic BP) */
  value2?: number;
}

export interface VitalTrendChartProps {
  title: string;
  unit: string;
  points: TrendPoint[];
  /** Inclusive normal range [min, max] — shaded band */
  normalRange: [number, number];
  /** Secondary normal range for the second series (diastolic BP) */
  normalRange2?: [number, number];
  /** Labels for the series (legend dots) */
  seriesLabel?: string;
  seriesLabel2?: string;
  /** Fixed y-axis bounds; if omitted, derived from data + normal range */
  yMin?: number;
  yMax?: number;
  height?: number;
  /** Number of days to show — window anchored at now - daysWindow..now */
  daysWindow?: number;
}

/**
 * Inline SVG line chart for a single vital parameter over a rolling window.
 * Draws normal-range band, connected line(s), per-point dots colored red when
 * the value falls outside the band. Hover reveals value + timestamp.
 */
export function VitalTrendChart({
  title,
  unit,
  points,
  normalRange,
  normalRange2,
  seriesLabel,
  seriesLabel2,
  yMin,
  yMax,
  height = 120,
  daysWindow = 7,
}: VitalTrendChartProps) {
  const [hover, setHover] = useState<{ idx: number; series: 1 | 2 } | null>(null);

  const chart = useMemo(() => {
    const now = Date.now();
    // Layout constants
    const W = 720;
    const H = height;
    const padL = 36;
    const padR = 12;
    const padT = 10;
    const padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Time window: now back daysWindow days
    const xMin = now - daysWindow * 24 * 60 * 60 * 1000;
    const xMax = now;

    // Only points within the window
    const windowed = points
      .map((p) => ({ ...p, t: new Date(p.time).getTime() }))
      .filter((p) => p.t >= xMin && p.t <= xMax)
      .sort((a, b) => a.t - b.t);

    // Y range: include normal-range band + data
    const rawYs: number[] = [];
    rawYs.push(normalRange[0], normalRange[1]);
    if (normalRange2) rawYs.push(normalRange2[0], normalRange2[1]);
    for (const p of windowed) {
      rawYs.push(p.value);
      if (p.value2 != null) rawYs.push(p.value2);
    }
    const dataMin = Math.min(...rawYs);
    const dataMax = Math.max(...rawYs);
    const span = Math.max(1, dataMax - dataMin);
    const yLo = yMin ?? dataMin - span * 0.15;
    const yHi = yMax ?? dataMax + span * 0.15;

    const xScale = (t: number) =>
      padL + ((t - xMin) / (xMax - xMin)) * plotW;
    const yScale = (v: number) =>
      padT + (1 - (v - yLo) / (yHi - yLo)) * plotH;

    // Normal-range band rect (primary)
    const bandY1 = yScale(normalRange[1]);
    const bandY2 = yScale(normalRange[0]);
    const bandH = Math.max(1, bandY2 - bandY1);

    // Secondary band
    let band2: { y: number; h: number } | null = null;
    if (normalRange2) {
      const b1 = yScale(normalRange2[1]);
      const b2 = yScale(normalRange2[0]);
      band2 = { y: b1, h: Math.max(1, b2 - b1) };
    }

    // Day gridlines (every day boundary within window)
    const dayTicks: { x: number; label: string }[] = [];
    for (let i = daysWindow; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      d.setHours(0, 0, 0, 0);
      const t = d.getTime();
      if (t >= xMin && t <= xMax) {
        dayTicks.push({
          x: xScale(t),
          label: formatDate(d).slice(0, 5),
        });
      }
    }

    // Y ticks
    const yTicks: { y: number; label: string }[] = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const v = yLo + ((yHi - yLo) * i) / steps;
      yTicks.push({ y: yScale(v), label: v.toFixed(v >= 10 ? 0 : 1) });
    }

    // Polyline paths
    const line1 = windowed
      .filter((p) => p.value != null)
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t)} ${yScale(p.value)}`)
      .join(' ');

    const line2 = normalRange2
      ? windowed
          .filter((p) => p.value2 != null)
          .map(
            (p, i) =>
              `${i === 0 ? 'M' : 'L'} ${xScale(p.t)} ${yScale(p.value2!)}`,
          )
          .join(' ')
      : '';

    // Per-point classification (abnormal vs normal for primary series)
    const dots = windowed.map((p) => ({
      ...p,
      x: xScale(p.t),
      y: yScale(p.value),
      abnormal1: p.value < normalRange[0] || p.value > normalRange[1],
      x2: p.value2 != null ? xScale(p.t) : null,
      y2: p.value2 != null ? yScale(p.value2) : null,
      abnormal2:
        p.value2 != null && normalRange2
          ? p.value2 < normalRange2[0] || p.value2 > normalRange2[1]
          : false,
    }));

    return {
      W,
      H,
      padL,
      padT,
      plotW,
      plotH,
      bandY1,
      bandH,
      band2,
      dayTicks,
      yTicks,
      line1,
      line2,
      dots,
      windowed,
    };
  }, [points, normalRange, normalRange2, height, daysWindow, yMin, yMax]);

  const hasData = chart.windowed.length > 0;

  return (
    <div className="rounded-lg border border-outline-variant/30 p-3 bg-surface-container-lowest">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-semibold text-on-surface">{title}</h3>
          <p className="text-[10px] text-on-surface-variant">
            Normal: {normalRange[0]}–{normalRange[1]}
            {normalRange2 ? ` / ${normalRange2[0]}–${normalRange2[1]}` : ''} {unit}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          {seriesLabel && (
            <span className="inline-flex items-center gap-1 text-on-surface-variant">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {seriesLabel}
            </span>
          )}
          {seriesLabel2 && (
            <span className="inline-flex items-center gap-1 text-on-surface-variant">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              {seriesLabel2}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-emerald-200" />
            Normal band
          </span>
        </div>
      </div>

      {!hasData ? (
        <div
          className="flex items-center justify-center text-[11px] text-on-surface-variant"
          style={{ height }}
        >
          No readings in the last {chart.windowed ? '7' : '7'} days
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${chart.W} ${chart.H}`}
            className="w-full"
            style={{ height }}
            onMouseLeave={() => setHover(null)}
          >
            {/* Normal range band — primary */}
            <rect
              x={chart.padL}
              y={chart.bandY1}
              width={chart.plotW}
              height={chart.bandH}
              fill="rgb(16 185 129 / 0.12)"
              stroke="rgb(16 185 129 / 0.25)"
              strokeDasharray="2 2"
            />
            {/* Secondary band (e.g., BP diastolic) */}
            {chart.band2 && (
              <rect
                x={chart.padL}
                y={chart.band2.y}
                width={chart.plotW}
                height={chart.band2.h}
                fill="rgb(14 165 233 / 0.10)"
                stroke="rgb(14 165 233 / 0.22)"
                strokeDasharray="2 2"
              />
            )}

            {/* Day gridlines */}
            {chart.dayTicks.map((tk, i) => (
              <g key={i}>
                <line
                  x1={tk.x}
                  x2={tk.x}
                  y1={chart.padT}
                  y2={chart.padT + chart.plotH}
                  stroke="rgb(0 0 0 / 0.06)"
                  strokeDasharray="2 2"
                />
                <text
                  x={tk.x}
                  y={chart.padT + chart.plotH + 14}
                  fontSize="9"
                  textAnchor="middle"
                  fill="rgb(100 116 139)"
                >
                  {tk.label}
                </text>
              </g>
            ))}

            {/* Y ticks */}
            {chart.yTicks.map((tk, i) => (
              <g key={i}>
                <line
                  x1={chart.padL - 4}
                  x2={chart.padL}
                  y1={tk.y}
                  y2={tk.y}
                  stroke="rgb(100 116 139 / 0.4)"
                />
                <text
                  x={chart.padL - 6}
                  y={tk.y + 3}
                  fontSize="9"
                  textAnchor="end"
                  fill="rgb(100 116 139)"
                >
                  {tk.label}
                </text>
              </g>
            ))}

            {/* Axes */}
            <line
              x1={chart.padL}
              x2={chart.padL}
              y1={chart.padT}
              y2={chart.padT + chart.plotH}
              stroke="rgb(100 116 139 / 0.4)"
            />
            <line
              x1={chart.padL}
              x2={chart.padL + chart.plotW}
              y1={chart.padT + chart.plotH}
              y2={chart.padT + chart.plotH}
              stroke="rgb(100 116 139 / 0.4)"
            />

            {/* Line 2 (drawn first so line 1 is on top) */}
            {chart.line2 && (
              <path
                d={chart.line2}
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="1.6"
              />
            )}
            {/* Line 1 */}
            {chart.line1 && (
              <path
                d={chart.line1}
                fill="none"
                stroke="rgb(20 184 166)"
                strokeWidth="1.8"
              />
            )}

            {/* Dots */}
            {chart.dots.map((d, i) => (
              <g key={i}>
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={3.5}
                  fill={d.abnormal1 ? 'rgb(220 38 38)' : 'rgb(20 184 166)'}
                  stroke="white"
                  strokeWidth="1"
                  onMouseEnter={() => setHover({ idx: i, series: 1 })}
                  style={{ cursor: 'pointer' }}
                />
                {d.x2 != null && d.y2 != null && (
                  <circle
                    cx={d.x2}
                    cy={d.y2}
                    r={3}
                    fill={d.abnormal2 ? 'rgb(220 38 38)' : 'rgb(14 165 233)'}
                    stroke="white"
                    strokeWidth="1"
                    onMouseEnter={() => setHover({ idx: i, series: 2 })}
                    style={{ cursor: 'pointer' }}
                  />
                )}
              </g>
            ))}
          </svg>

          {/* Tooltip */}
          {hover && chart.dots[hover.idx] && (
            <HoverTooltip
              x={hover.series === 1 ? chart.dots[hover.idx].x : chart.dots[hover.idx].x2 ?? 0}
              y={hover.series === 1 ? chart.dots[hover.idx].y : chart.dots[hover.idx].y2 ?? 0}
              W={chart.W}
              value={
                hover.series === 1
                  ? chart.dots[hover.idx].value
                  : chart.dots[hover.idx].value2 ?? 0
              }
              unit={unit}
              label={
                hover.series === 1 ? seriesLabel ?? title : seriesLabel2 ?? title
              }
              time={chart.dots[hover.idx].time}
              abnormal={
                hover.series === 1
                  ? chart.dots[hover.idx].abnormal1
                  : chart.dots[hover.idx].abnormal2
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function HoverTooltip({
  x,
  y,
  W,
  value,
  unit,
  label,
  time,
  abnormal,
}: {
  x: number;
  y: number;
  W: number;
  value: number;
  unit: string;
  label: string;
  time: string;
  abnormal: boolean;
}) {
  // Position relative to SVG-as-percent so it scales with width
  const leftPct = (x / W) * 100;
  return (
    <div
      className={cn(
        'absolute pointer-events-none z-10 rounded-md border px-2 py-1 text-[10px] shadow-md',
        abnormal
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-surface-container border-outline-variant/40 text-on-surface',
      )}
      style={{
        left: `calc(${leftPct}% + 6px)`,
        top: Math.max(0, y - 28),
        maxWidth: 180,
      }}
    >
      <div className="font-semibold">
        {label}: {value} {unit}
      </div>
      <div className="text-[9px] opacity-70">{formatDateTime(time)}</div>
    </div>
  );
}
