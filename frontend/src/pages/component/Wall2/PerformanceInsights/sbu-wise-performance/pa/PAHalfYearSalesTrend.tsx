import React, { useMemo, useState } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import { LoadingBlock, PaChartTooltip } from "./pa.shared";
import { fmtBarTmt, fmtTooltipPct, fmtTooltipTmt, HALF_YEAR_ORDER, monthYoyPct } from "./pa.utils";
import type { HalfYearRow } from "./pa.types";

interface Props {
  rows:        HalfYearRow[];
  loading:     boolean;
  currentFY:   string;
  prevFY:      string;
  onRefresh?:  () => void;
  refreshing?: boolean;
}

const SALES_BAR_H = 136;
const BAR_LABEL_H = 14;
const BAR_MAX_H = SALES_BAR_H - BAR_LABEL_H;

const barValueClass =
  "pointer-events-none mb-0.5 max-w-full truncate text-center text-[7px] font-semibold leading-none tabular-nums text-slate-600";

const barSlotClass = "relative flex flex-1 min-w-0 items-end justify-center";
const chartRowClass = "flex w-full items-end gap-1.5";
const labelRowClass = "mt-0.5 flex w-full gap-1.5";
const labelSlotClass = "flex-1 min-w-0 text-center text-[10px] font-medium text-slate-500";
const barGroupClass = "flex h-full w-full max-w-[4.5rem] items-end justify-center gap-0";

const shortFY = (fy: string) => {
  const [a, b] = fy.split("-");
  return `${a.slice(2)}–${b.slice(2)}`;
};

const HALF_LABELS: Record<string, string> = {
  H1: "H1",
  H2: "H2",
};

const PAHalfYearSalesTrend: React.FC<Props> = ({
  rows, loading, currentFY, prevFY, onRefresh, refreshing,
}) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const halves = useMemo(() => {
    const lookup = (fy: string, half: string) =>
      rows.find((r) => r.fiscalYear === fy && r.halfYear === half)?.total ?? 0;

    return HALF_YEAR_ORDER.map((half) => {
      const total = lookup(currentFY, half);
      const prevTotal = lookup(prevFY, half);
      return { half, total, prevTotal, growthPct: monthYoyPct(total, prevTotal) };
    });
  }, [rows, currentFY, prevFY]);

  const maxSales = useMemo(
    () => Math.max(...halves.map((d) => Math.max(d.total, d.prevTotal)), 1),
    [halves],
  );

  return (
    <div className="flex h-full w-full max-w-[14rem] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-1 border-b border-slate-100 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-50 text-violet-600">
            <CalendarRange className="h-3 w-3" />
          </span>
          <h2 className="truncate text-xs font-semibold text-slate-700">
            Half-year sales — TMT
          </h2>
        </div>
        {onRefresh && (
          <button
            type="button"
            title="Refresh"
            disabled={loading || refreshing}
            onClick={onRefresh}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center px-2 py-3 pt-4">
        {loading ? (
          <LoadingBlock rows={2} />
        ) : (
          <>
            <div className={chartRowClass} style={{ height: SALES_BAR_H }}>
              {halves.map(({ half, total, prevTotal, growthPct }) => {
                const hCur = total > 0 ? Math.max(3, (total / maxSales) * BAR_MAX_H) : 0;
                const hPrev = prevTotal > 0 ? Math.max(3, (prevTotal / maxSales) * BAR_MAX_H) : 0;
                const isHov = hovered === half;
                const hasData = total > 0 || prevTotal > 0;
                return (
                  <div
                    key={half}
                    className={barSlotClass}
                    onMouseEnter={() => setHovered(half)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {isHov && hasData && (
                      <PaChartTooltip>
                        <div className="font-semibold">{HALF_LABELS[half] ?? half}</div>
                        <div>
                          Curr ({shortFY(currentFY)}): {fmtTooltipTmt(total)} TMT · Hist ({shortFY(prevFY)}): {fmtTooltipTmt(prevTotal)} TMT
                        </div>
                        <div>YoY: {fmtTooltipPct(growthPct)}</div>
                      </PaChartTooltip>
                    )}
                    <div className={barGroupClass}>
                      <div className="flex min-w-[0.875rem] flex-1 flex-col items-center justify-end">
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
                      <div className="flex min-w-[0.875rem] flex-1 flex-col items-center justify-end">
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
              {halves.map(({ half }) => (
                <span key={half} className={labelSlotClass}>
                  {HALF_LABELS[half] ?? half}
                </span>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-[#1A5FB4]" />
                {shortFY(currentFY)}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-[#C9C6BC]" />
                {shortFY(prevFY)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PAHalfYearSalesTrend;
