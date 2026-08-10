import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { cn } from "@/@/lib/utils";

/** amCharts packed RGB int → `#rrggbb` for Recharts fills */
export function am5IntToCssHex(rgb: number): string {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function hexLighter(hex: string, amount = 0.22): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = (c: string) =>
    Math.min(255, Math.round(parseInt(c, 16) + (255 - parseInt(c, 16)) * amount));
  const r = n(h.slice(0, 2));
  const g = n(h.slice(2, 4));
  const b = n(h.slice(4, 6));
  return `rgb(${r},${g},${b})`;
}

function contrastTextForBar(bgHex: string): string {
  const h = bgHex.replace("#", "").trim();
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

export type GaHorizontalBarRow = {
  /** Y-axis tick (GA area, disambiguated if needed) */
  name: string;
  value: number;
  fill: string;
  gaArea: string;
  gvName: string;
  /** Share of max value in this dataset, 0–100 */
  scorePct: number;
};

function GaSalesTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as GaHorizontalBarRow;
  const headerColor = row.fill;
  const headerTextColor = contrastTextForBar(headerColor);
  return (
    <div className="w-[min(240px,calc(100vw-2rem))] max-w-[240px] rounded-lg border border-slate-200/90 bg-white text-xs shadow-lg dark:border-slate-600 dark:bg-slate-900">
      <p
        className="whitespace-normal break-words px-3 py-2.5 font-semibold leading-snug"
        style={{ backgroundColor: headerColor, color: headerTextColor }}
      >
        {row.gaArea}
      </p>
      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-2 gap-y-1.5 p-3 pt-2">
        <dt className="shrink-0 text-muted-foreground">Company (GV)</dt>
        <dd className="whitespace-normal break-words text-right font-medium text-foreground">
          {row.gvName || "—"}
        </dd>
        <dt className="text-muted-foreground">Sales</dt>
        <dd className="text-right font-semibold tabular-nums text-foreground">
          {row.value.toLocaleString("en-US")}
        </dd>
        <dt className="text-muted-foreground">Score</dt>
        <dd className="break-words text-right font-medium leading-snug text-foreground">
          <span className="tabular-nums">{row.scorePct}%</span>{" "}
          <span className="font-normal text-muted-foreground">of peak in view</span>
        </dd>
      </dl>
    </div>
  );
}

export function SalesByGaAreaHorizontalBarChart({
  rows,
  xMax,
  className,
  isDark = false,
  /** Omit outer border/radius/shadow when already inside ChartCard (avoids double rounded frame). */
  embeddedInCard = false,
}: {
  rows: GaHorizontalBarRow[];
  /** Upper bound for X-axis (e.g. nice Y max from dashboard) */
  xMax?: number;
  className?: string;
  /** When true, use darker grid/tick colors (no next-themes in this screen — pass from parent if needed) */
  isDark?: boolean;
  embeddedInCard?: boolean;
}) {
  const tickFill = isDark ? "#94a3b8" : "#475569";
  const gridStroke = isDark ? "#334155" : "#e2e8f0";

  const yAxisLabelWidth = useMemo(() => {
    if (!rows.length) return 100;
    const maxLen = Math.max(...rows.map((r) => r.name.length));
    /** Tighter than before: Y-axis labels wrap inside the axis width (see tick width prop). */
    return Math.min(280, Math.max(68, Math.ceil(maxLen * 4.25 + 12)));
  }, [rows]);

  const longLabels = rows.some((r) => r.name.length > 38);
  const rowStep = longLabels ? 28 : 24;
  const chartHeight = Math.min(1200, Math.max(160, rows.length * rowStep + 72));

  if (!rows.length) {
    return (
      <div
        className={cn(
          "flex min-h-[160px] flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200/90 bg-slate-50/50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
          className
        )}
      >
        No GA area data for this selection
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden",
        embeddedInCard
          ? "bg-transparent"
          : "rounded-lg border border-violet-200/70 bg-gradient-to-br from-slate-50 via-violet-50/40 to-cyan-50/35 shadow-sm dark:border-violet-800/45 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/25",
        className
      )}
    >
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <div className="min-w-0" style={{ height: chartHeight, minWidth: yAxisLabelWidth + 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={rows}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              barCategoryGap="12%"
            >
              <CartesianGrid horizontal strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
              <XAxis
                type="number"
                domain={xMax != null ? [0, xMax] : [0, "auto"]}
                tick={{ fill: tickFill, fontSize: 10 }}
                tickFormatter={(v) => (typeof v === "number" ? v.toLocaleString("en-US") : String(v))}
                label={{
                  value: "Sales (count)",
                  position: "insideBottom",
                  offset: -4,
                  fill: tickFill,
                  fontSize: 10,
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={yAxisLabelWidth}
                tick={{
                  fill: tickFill,
                  fontSize: 10,
                  fontWeight: 600,
                }}
                tickMargin={2}
                interval={0}
              />
              <Tooltip
                content={<GaSalesTooltip />}
                cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                wrapperStyle={{ outline: "none" }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
                {rows.map((row, i) => (
                  <Cell
                    key={`${row.name}-${i}`}
                    fill={row.fill}
                    stroke={hexLighter(row.fill, 0.35)}
                    strokeWidth={0.5}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  fill={tickFill}
                  fontSize={10}
                  formatter={(v: number | string) =>
                    typeof v === "number" ? v.toLocaleString("en-US") : String(v)
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
