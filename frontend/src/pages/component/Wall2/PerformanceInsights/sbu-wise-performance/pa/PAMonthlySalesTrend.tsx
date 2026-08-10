import React, { useMemo, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { LoadingBlock, PaChartTooltip } from "./pa.shared";
import { fmtBarPct, fmtBarTmt, fmtTooltipPct, fmtTooltipTmt, getMonthMapValue, getVisibleFiscalMonths, monthYoyPct } from "./pa.utils";

interface Props {
  current:     Map<string, number>;
  previous:    Map<string, number>;
  loading:     boolean;
  currentFY:   string;
  prevFY:      string;
  showGrowth?: boolean;
  onRefresh?:  () => void;
  refreshing?: boolean;
}

const SALES_BAR_H = 136;
const GROWTH_BAR_H = 58;
const SALES_LABEL_H = 14;
const GROWTH_LABEL_H = 12;
const SALES_BAR_MAX_H = SALES_BAR_H - SALES_LABEL_H;
const GROWTH_BAR_MAX_H = GROWTH_BAR_H - GROWTH_LABEL_H;

const barValueClass =
  "pointer-events-none mb-0.5 max-w-full truncate text-center text-[7px] font-semibold leading-none tabular-nums text-slate-600";
const growthValueClass =
  "pointer-events-none max-w-full truncate text-center text-[7px] font-semibold leading-none tabular-nums";

const barSlotClass = "relative flex flex-1 min-w-0 items-end justify-center";
const chartRowClass = "flex w-full items-end gap-2";
const labelRowClass = "mt-1 flex w-full gap-2";
const labelSlotClass = "flex-1 min-w-0 text-center text-[10px] font-medium text-slate-500";
const barGroupClass = "flex h-full w-full max-w-[5.5rem] items-end justify-center gap-0";

const shortFY = (fy: string) => {
  const [a, b] = fy.split("-");
  return `${a.slice(2)}–${b.slice(2)}`;
};

const PAMonthlySalesTrend: React.FC<Props> = ({
  current, previous, loading, currentFY, prevFY, showGrowth = true, onRefresh, refreshing,
}) => {
  const [hoveredSales, setHoveredSales] = useState<string | null>(null);
  const [hoveredGrowth, setHoveredGrowth] = useState<string | null>(null);

  const visibleMonths = useMemo(
    () => getVisibleFiscalMonths(currentFY),
    [currentFY],
  );

  const months = useMemo(
    () => visibleMonths.map((m) => {
      const total = getMonthMapValue(current, m);
      const prevTotal = getMonthMapValue(previous, m);
      return { month: m, total, prevTotal };
    }),
    [current, previous, visibleMonths],
  );

  const maxSales = useMemo(
    () => Math.max(...months.map((d) => Math.max(d.total, d.prevTotal)), 1),
    [months],
  );

  const growthMonths = useMemo(
    () => visibleMonths.map((m) => {
      const total = getMonthMapValue(current, m);
      const prevTotal = getMonthMapValue(previous, m);
      return { month: m, growthPct: monthYoyPct(total, prevTotal) };
    }),
    [current, previous, visibleMonths],
  );

  const maxGrowthAbs = useMemo(() => {
    if (!showGrowth) return 1;
    const values = growthMonths.map((d) => d.growthPct);
    return Math.max(...values.map(Math.abs), 1);
  }, [growthMonths, showGrowth]);

  return (
    <div className="flex h-full min-w-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-slate-700">
            Monthly sales trend — TMT
          </h2>
        </div>
        {onRefresh && (
          <button
            type="button"
            title="Refresh"
            disabled={loading || refreshing}
            onClick={onRefresh}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center px-2 py-3 pt-4">
        {loading ? (
          <LoadingBlock rows={2} />
        ) : (
          <>
            {/* Curr FY + Hist FY paired bars */}
            <div className={chartRowClass} style={{ height: SALES_BAR_H }}>
              {months.map(({ month, total, prevTotal }) => {
                const hCur = total > 0 ? Math.max(2, (total / maxSales) * SALES_BAR_MAX_H) : 0;
                const hPrev = prevTotal > 0 ? Math.max(2, (prevTotal / maxSales) * SALES_BAR_MAX_H) : 0;
                const isHov = hoveredSales === month;
                const yoyPct = monthYoyPct(total, prevTotal);
                const hasData = total > 0 || prevTotal > 0;
                return (
                  <div
                    key={month}
                    className={barSlotClass}
                    onMouseEnter={() => setHoveredSales(month)}
                    onMouseLeave={() => setHoveredSales(null)}
                  >
                    {isHov && hasData && (
                      <PaChartTooltip>
                        <div className="font-semibold">{month}</div>
                        <div>
                          Curr ({shortFY(currentFY)}): {fmtTooltipTmt(total)} TMT · Hist ({shortFY(prevFY)}): {fmtTooltipTmt(prevTotal)} TMT
                        </div>
                        <div>YoY: {fmtTooltipPct(yoyPct)}</div>
                      </PaChartTooltip>
                    )}
                    <div className={barGroupClass}>
                      <div className="flex min-w-[1.125rem] flex-1 flex-col items-center justify-end">
                        {total > 0 && (
                          <span className={barValueClass}>{fmtBarTmt(total)}</span>
                        )}
                        <div
                          className="w-full rounded-t transition-opacity duration-150"
                          style={{
                            height: hCur,
                            backgroundColor: "#1A5FB4",
                            opacity: isHov ? 1 : 0.88,
                          }}
                        />
                      </div>
                      <div className="flex min-w-[1.125rem] flex-1 flex-col items-center justify-end">
                        {prevTotal > 0 && (
                          <span className={barValueClass}>{fmtBarTmt(prevTotal)}</span>
                        )}
                        <div
                          className="w-full rounded-t transition-opacity duration-150"
                          style={{
                            height: hPrev,
                            backgroundColor: "#C9C6BC",
                            opacity: isHov ? 1 : 0.75,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={labelRowClass}>
              {months.map(({ month }) => (
                <span key={month} className={labelSlotClass}>
                  {month}
                </span>
              ))}
            </div>

            {showGrowth && (
              <>
            {/* Growth % vs same month previous FY */}
            <div className={`mt-3 ${chartRowClass}`} style={{ height: GROWTH_BAR_H }}>
              {growthMonths.map(({ month, growthPct }) => {
                if (growthPct === 0) {
                  return <div key={month} className={barSlotClass} />;
                }
                const h = Math.max(4, (Math.abs(growthPct) / maxGrowthAbs) * GROWTH_BAR_MAX_H);
                const isPositive = growthPct > 0;
                const isHov = hoveredGrowth === month;
                return (
                  <div
                    key={month}
                    className={barSlotClass}
                    onMouseEnter={() => setHoveredGrowth(month)}
                    onMouseLeave={() => setHoveredGrowth(null)}
                  >
                    {isHov && (
                      <PaChartTooltip>
                        <div className="font-semibold">{month}</div>
                        <div>YoY vs prev FY: {fmtTooltipPct(growthPct)}</div>
                      </PaChartTooltip>
                    )}
                    <div className="flex min-w-[1.125rem] flex-1 max-w-[5.5rem] flex-col items-center justify-end">
                      <span
                        className={`${growthValueClass} mb-0.5 ${isPositive ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {fmtBarPct(growthPct)}
                      </span>
                      <div
                        className="w-full rounded-sm transition-opacity duration-150"
                        style={{
                          height: h,
                          backgroundColor: isPositive ? "#1D7A52" : "#C0392B",
                          opacity: isHov ? 1 : 0.85,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={labelRowClass}>
              {growthMonths.map(({ month }) => (
                <span key={month} className={labelSlotClass}>
                  {month}
                </span>
              ))}
            </div>
              </>
            )}

            <div className="mt-2 flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#1A5FB4]" />
                Current FY ({shortFY(currentFY)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#C9C6BC]" />
                Historical FY ({shortFY(prevFY)})
              </span>
              {showGrowth && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 shrink-0 text-slate-300" />
                Growth % vs same month previous FY
              </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PAMonthlySalesTrend;
