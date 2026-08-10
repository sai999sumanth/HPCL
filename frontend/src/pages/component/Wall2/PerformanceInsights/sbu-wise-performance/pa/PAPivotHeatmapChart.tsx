import React, { useMemo, useState } from "react";
import { fmtTmt } from "./pa.utils";
import { SP } from "./pa.shared";
import type { PivotData } from "./pa.types";

export type PivotHeatmapVariant = "blue" | "violet";

interface Props {
  pivot:             PivotData;
  rowLabel:          string;
  colLabel:          string;
  variant?:          PivotHeatmapVariant;
  maxHeight?:        number;
  labelColumnWidth?: string;
}

type HoverCell = { row: string; col: string } | null;

const COLOR_STOPS: Record<PivotHeatmapVariant, { low: [number, number, number]; high: [number, number, number]; accent: string }> = {
  blue:   { low: [239, 246, 255], high: [29, 78, 216],  accent: "blue" },
  violet: { low: [245, 243, 255], high: [109, 40, 217], accent: "violet" },
};

function cellColor(intensity: number, variant: PivotHeatmapVariant) {
  const { low, high } = COLOR_STOPS[variant];
  const t = Math.max(0, Math.min(1, intensity));
  const r = Math.round(low[0] + (high[0] - low[0]) * t);
  const g = Math.round(low[1] + (high[1] - low[1]) * t);
  const b = Math.round(low[2] + (high[2] - low[2]) * t);
  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: t > 0.52 ? "#ffffff" : "#334155",
  };
}

function pct(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function PivotHeatmapLegend({ variant }: { variant: PivotHeatmapVariant }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400">Low</span>
      <div
        className={`h-2 w-20 rounded-full bg-gradient-to-r ${
          variant === "blue"
            ? "from-blue-50 via-blue-400 to-blue-700"
            : "from-violet-50 via-violet-400 to-violet-700"
        }`}
      />
      <span className="text-[10px] text-slate-400">High</span>
      <span className={`hidden text-[10px] font-medium sm:inline ${variant === "blue" ? "text-blue-600" : "text-violet-600"}`}>
        TMT intensity
      </span>
    </div>
  );
}

const PAPivotHeatmapChart: React.FC<Props> = ({
  pivot,
  rowLabel,
  colLabel,
  variant = "blue",
  maxHeight = 420,
  labelColumnWidth = "minmax(7.5rem, 10rem)",
}) => {
  const [hovered, setHovered] = useState<HoverCell>(null);

  const { grandTotal, rowTotals, colTotals } = useMemo(() => {
    const rowTotalsMap: Record<string, number> = {};
    const colTotalsMap: Record<string, number> = {};
    let grand = 0;

    for (const row of pivot.rows) {
      let rowSum = 0;
      for (const col of pivot.cols) {
        const val = pivot.cells[row]?.[col] ?? 0;
        rowSum += val;
        colTotalsMap[col] = (colTotalsMap[col] ?? 0) + val;
      }
      rowTotalsMap[row] = rowSum;
      grand += rowSum;
    }

    return { grandTotal: grand, rowTotals: rowTotalsMap, colTotals: colTotalsMap };
  }, [pivot]);

  const dense = pivot.rows.length > 12 || pivot.cols.length > 10;
  const cellValueClass = dense ? "text-[8px] leading-tight" : "text-[10px]";

  if (!pivot.rows.length || !pivot.cols.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-400" style={{ padding: SP.emptyPad }}>
        No data available
      </div>
    );
  }

  const hoveredVal = hovered
    ? pivot.cells[hovered.row]?.[hovered.col] ?? 0
    : 0;

  return (
    <div style={{ padding: SP.panelBodyLg }} className="space-y-3">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
          Total {fmtTmt(grandTotal)} TMT
        </span>
        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
          {pivot.rows.length} {rowLabel.toLowerCase()}s × {pivot.cols.length} {colLabel.toLowerCase()}s
        </span>
        {dense && (
          <span className="text-[10px] text-slate-400">Compact grid — values shown in each cell</span>
        )}
      </div>

      {/* Hover detail bar */}
      <div className="min-h-[2rem] rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-1.5">
        {hovered ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 py-1 text-[11px]">
            <span className="font-semibold text-slate-700">
              {hovered.row} × {hovered.col}
            </span>
            <span className="font-bold text-slate-800">{fmtTmt(hoveredVal)} TMT</span>
            <span className="text-slate-500">{pct(hoveredVal, grandTotal)} of total</span>
            <span className="text-slate-500">{pct(hoveredVal, rowTotals[hovered.row] ?? 0)} of row</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">
            Hover a cell to see {rowLabel.toLowerCase()} × {colLabel.toLowerCase()} breakdown
          </span>
        )}
      </div>

      {/* Grid */}
      <div
        className="overflow-auto rounded-lg border border-slate-200 bg-white"
        style={{ maxHeight }}
      >
        <div
          className="inline-grid min-w-full gap-px bg-slate-200 p-px"
          style={{
            gridTemplateColumns: `${labelColumnWidth} repeat(${pivot.cols.length}, minmax(3.25rem, 1fr)) minmax(3.5rem, 4.5rem)`,
          }}
        >
          {/* Corner */}
          <div className="sticky left-0 top-0 z-20 flex items-end bg-slate-100 px-2 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            {rowLabel} ↓ / {colLabel} →
          </div>

          {/* Column headers */}
          {pivot.cols.map((col) => (
            <div
              key={`h-${col}`}
              className="sticky top-0 z-10 flex items-end justify-center bg-slate-100 px-1 py-2 text-center"
              title={col}
            >
              <span className="max-w-[4.5rem] truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500 [writing-mode:vertical-rl] rotate-180 max-h-24 sm:max-h-none sm:[writing-mode:horizontal-tb] sm:rotate-0">
                {col}
              </span>
            </div>
          ))}

          {/* Col total header */}
          <div className="sticky top-0 z-10 flex items-end justify-center bg-slate-200 px-1 py-2 text-[9px] font-bold uppercase text-slate-600">
            Σ
          </div>

          {/* Data rows */}
          {pivot.rows.map((row) => (
            <React.Fragment key={row}>
              <div
                className="sticky left-0 z-10 flex items-center bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700"
                title={row}
              >
                <span className="truncate">{row}</span>
              </div>

              {pivot.cols.map((col) => {
                const val = pivot.cells[row]?.[col] ?? 0;
                const intensity = pivot.maxVal > 0 ? val / pivot.maxVal : 0;
                const colors = val > 0
                  ? cellColor(intensity, variant)
                  : { backgroundColor: "#f8fafc", color: "#64748b" };
                const isHovered = hovered?.row === row && hovered?.col === col;

                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    className={`relative flex min-h-[2.25rem] items-center justify-center rounded-sm px-0.5 py-1 font-semibold transition-all duration-150 ${
                      isHovered ? "z-[5] ring-2 ring-blue-400 ring-offset-1 scale-[1.03]" : "hover:brightness-95"
                    } cursor-pointer`}
                    style={colors}
                    title={`${row} × ${col}: ${fmtTmt(val)} TMT`}
                    onMouseEnter={() => setHovered({ row, col })}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered({ row, col })}
                    onBlur={() => setHovered(null)}
                  >
                    <span className={cellValueClass}>{fmtTmt(val)}</span>
                  </button>
                );
              })}

              <div className="flex items-center justify-center bg-slate-50 px-1 py-1.5 text-[10px] font-bold text-slate-600">
                {fmtTmt(rowTotals[row] ?? 0)}
              </div>
            </React.Fragment>
          ))}

          {/* Column totals row */}
          <>
            <div className="sticky left-0 z-10 flex items-center bg-slate-100 px-2 py-1.5 text-[10px] font-bold uppercase text-slate-600">
              Total
            </div>
            {pivot.cols.map((col) => (
              <div
                key={`t-${col}`}
                className="flex items-center justify-center bg-slate-50 px-1 py-1.5 text-[10px] font-semibold text-slate-600"
              >
                {fmtTmt(colTotals[col] ?? 0)}
              </div>
            ))}
            <div className="flex items-center justify-center bg-slate-200 px-1 py-1.5 text-[10px] font-bold text-slate-700">
              {fmtTmt(grandTotal)}
            </div>
          </>
        </div>
      </div>

      <PivotHeatmapLegend variant={variant} />
    </div>
  );
};

export default PAPivotHeatmapChart;
