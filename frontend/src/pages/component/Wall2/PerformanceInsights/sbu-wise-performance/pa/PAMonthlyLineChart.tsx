import React, { useMemo, useState } from "react";
import { D } from "./pa.shared";
import { SHEET } from "./pa.sheet";
import { fmtBarPct, fmtTooltipPct, fmtTooltipTmt, growthColor, monthYoyPct } from "./pa.utils";

export interface MonthlyLinePoint {
  month: string;
  current: number;
  previous: number;
}

interface Props {
  data: MonthlyLinePoint[];
  currentFY: string;
  prevFY: string;
}

const shortFY = (fy: string) => `${fy.slice(2, 4)}-${fy.slice(7, 9)}`;

const CHART_W = 420;
const CHART_H = 88;
const GROWTH_H = 30;
const LABEL_H = 12;
const PAD = { top: 6, right: 6, bottom: 2, left: 28 };
const GROWTH_BASE = CHART_H + 6;
const GROWTH_BAR_MAX = 14;

function scaleY(value: number, max: number, innerH: number): number {
  if (max <= 0) return innerH;
  return innerH - (value / max) * innerH;
}

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function fmtAxisTick(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  if (v === 0) return "0";
  return v.toFixed(0);
}

const PAMonthlyLineChart: React.FC<Props> = ({ data, currentFY, prevFY }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxVal = useMemo(
    () => Math.max(...data.map((d) => Math.max(d.current, d.previous)), 1),
    [data],
  );

  const maxGrowthAbs = useMemo(
    () => Math.max(...data.map((d) => Math.abs(monthYoyPct(d.current, d.previous))), 1),
    [data],
  );

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const totalH = CHART_H + GROWTH_H + LABEL_H;
  const n = data.length;

  const points = useMemo(() => {
    if (n === 0) return [];
    const step = n > 1 ? innerW / (n - 1) : 0;
    return data.map((d, i) => {
      const x = PAD.left + (n === 1 ? innerW / 2 : i * step);
      return {
        month: d.month,
        current: d.current,
        previous: d.previous,
        x,
        curY: PAD.top + scaleY(d.current, maxVal, innerH),
        prevY: PAD.top + scaleY(d.previous, maxVal, innerH),
      };
    });
  }, [data, n, innerW, innerH, maxVal]);

  const curPath = buildPath(points.map((p) => ({ x: p.x, y: p.curY })));
  const prevPath = buildPath(points.map((p) => ({ x: p.x, y: p.prevY })));

  const yTicks = useMemo(() => [maxVal, maxVal * 0.5, 0], [maxVal]);
  const hoveredPt = hovered ? points.find((p) => p.month === hovered) : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${CHART_W} ${totalH}`}
        width="100%"
        height={totalH}
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label="Monthly TMT line chart with YoY growth"
      >
        {yTicks.slice(0, -1).map((tick) => {
          const y = PAD.top + scaleY(tick, maxVal, innerH);
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y}
                x2={CHART_W - PAD.right}
                y2={y}
                stroke={SHEET.borderLight}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={PAD.left - 4}
                y={y + 3}
                textAnchor="end"
                fontSize={7}
                fill={D.text3}
              >
                {fmtAxisTick(tick)}
              </text>
            </g>
          );
        })}

        {prevPath && (
          <path
            d={prevPath}
            fill="none"
            stroke={SHEET.histBar}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {curPath && (
          <path
            d={curPath}
            fill="none"
            stroke={SHEET.accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map(({ month, current, previous, x, curY, prevY }) => {
          const isHov = hovered === month;
          const hasData = current > 0 || previous > 0;
          const growthPct = monthYoyPct(current, previous);
          const growthColorVal = growthColor(growthPct);
          const barH =
            hasData && growthPct !== 0
              ? Math.max(2, (Math.abs(growthPct) / maxGrowthAbs) * GROWTH_BAR_MAX)
              : 0;
          const baselineY = GROWTH_BASE + GROWTH_BAR_MAX;
          const barY = growthPct >= 0 ? baselineY - barH : baselineY;

          return (
            <g
              key={month}
              onMouseEnter={() => setHovered(month)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={x - (n > 1 ? innerW / (n - 1) / 2 : 14)}
                y={PAD.top}
                width={n > 1 ? innerW / (n - 1) : 28}
                height={innerH + GROWTH_H + LABEL_H}
                fill="transparent"
              />
              {hasData && (
                <>
                  <circle cx={x} cy={prevY} r={isHov ? 4 : 2.5} fill="#fff" stroke={SHEET.histBar} strokeWidth={2} />
                  <circle cx={x} cy={curY} r={isHov ? 4 : 2.5} fill="#fff" stroke={SHEET.accent} strokeWidth={2} />
                  <line
                    x1={x - 4}
                    y1={baselineY}
                    x2={x + 4}
                    y2={baselineY}
                    stroke={SHEET.borderLight}
                    strokeWidth={1}
                  />
                  {barH > 0 && (
                    <rect
                      x={x - 3}
                      y={barY}
                      width={6}
                      height={barH}
                      rx={1.5}
                      fill={growthColorVal}
                      opacity={isHov ? 1 : 0.82}
                    />
                  )}
                  <text
                    x={x}
                    y={GROWTH_BASE + GROWTH_BAR_MAX + 10}
                    textAnchor="middle"
                    fontSize={7}
                    fontWeight={600}
                    fill={growthColorVal}
                  >
                    {fmtBarPct(growthPct)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {points.map(({ month, x }) => (
          <text
            key={`lbl-${month}`}
            x={x}
            y={totalH - 1}
            textAnchor="middle"
            fontSize={8}
            fill={hovered === month ? D.text2 : D.text3}
            fontWeight={hovered === month ? 600 : 400}
          >
            {month}
          </text>
        ))}
      </svg>

      {hoveredPt && (hoveredPt.current > 0 || hoveredPt.previous > 0) && (
        <div
          style={{
            position: "absolute",
            top: Math.min(hoveredPt.curY, hoveredPt.prevY) - 4,
            left: `${(hoveredPt.x / CHART_W) * 100}%`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <div
            style={{
              background: "#1e293b",
              color: "#fff",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 10,
              lineHeight: 1.35,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{hoveredPt.month}</div>
            <div>
              Current ({shortFY(currentFY)}): {fmtTooltipTmt(hoveredPt.current)} TMT
            </div>
            <div>
              Historical ({shortFY(prevFY)}): {fmtTooltipTmt(hoveredPt.previous)} TMT
            </div>
            <div>
              YoY: {fmtTooltipPct(monthYoyPct(hoveredPt.current, hoveredPt.previous))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", marginTop: 4, fontSize: 9, color: D.text3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 14,
              height: 2,
              borderRadius: 1,
              backgroundColor: SHEET.accent,
              display: "inline-block",
            }}
          />
          Current {shortFY(currentFY)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 14,
              height: 2,
              borderRadius: 1,
              backgroundColor: SHEET.histBar,
              display: "inline-block",
            }}
          />
          Historical {shortFY(prevFY)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: D.green,
              display: "inline-block",
            }}
          />
          YoY growth %
        </span>
      </div>
    </div>
  );
};

export default PAMonthlyLineChart;
