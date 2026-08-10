import React, { useMemo, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { LoadingBlock, PaChartTooltip } from "./pa.shared";
import { fmtBarPct, fmtTooltipPct, getVisibleFiscalMonths } from "./pa.utils";
import type { MomRow } from "./pa.types";

interface Props {
  rows:        MomRow[];
  loading:     boolean;
  currentFY:   string;
  onRefresh?:  () => void;
  refreshing?: boolean;
}

const CHART_H = 156;
const HALF_H = CHART_H / 2;
const BAR_LABEL_H = 12;
const BAR_MAX_H = HALF_H - BAR_LABEL_H - 6;

const pctLabelClass =
  "pointer-events-none max-w-full truncate text-center text-[7px] font-semibold leading-none tabular-nums";

const barSlotClass = "relative flex min-w-0 flex-1 flex-col";

const PAMomGrowth: React.FC<Props> = ({ rows, loading, currentFY, onRefresh, refreshing }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const visibleMonths = useMemo(
    () => new Set(getVisibleFiscalMonths(currentFY)),
    [currentFY],
  );

  const displayRows = useMemo(
    () => rows.filter((r) => visibleMonths.has(r.month)),
    [rows, visibleMonths],
  );

  const maxGrowthAbs = useMemo(
    () => Math.max(...displayRows.map((r) => Math.abs(r.growth)), 1),
    [displayRows],
  );

  return (
    <div className="flex h-full min-w-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-slate-800">
            Month-on-month growth (%) — current FY
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

      <div className="relative flex flex-1 flex-col justify-center px-3 py-4 pt-5">
        {loading ? (
          <LoadingBlock rows={4} />
        ) : (
          <>
            <div className="flex w-full gap-0.5" style={{ height: CHART_H }}>
              {displayRows.map((r) => {
                const barH =
                  r.growth === 0
                    ? 0
                    : Math.max(4, (Math.abs(r.growth) / maxGrowthAbs) * BAR_MAX_H);
                const isPositive = r.growth > 0;
                const isHov = hovered === r.month;

                return (
                  <div
                    key={r.month}
                    className={barSlotClass}
                    onMouseEnter={() => setHovered(r.month)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {isHov && r.growth !== 0 && (
                      <PaChartTooltip>
                        <div className="font-semibold">{r.month}</div>
                        <div>MoM: {fmtTooltipPct(r.growth)}</div>
                      </PaChartTooltip>
                    )}
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="flex flex-1 items-end justify-center border-b border-slate-200">
                        {isPositive && (
                          <div className="flex w-[70%] max-w-[2.5rem] flex-col items-center justify-end">
                            <span className={`${pctLabelClass} mb-0.5 text-[#1a5f3a]`}>
                              {fmtBarPct(r.growth)}
                            </span>
                            <div
                              className="w-full rounded-t-sm transition-all duration-300"
                              style={{
                                height: barH,
                                backgroundColor: "#1a5f3a",
                                opacity: isHov ? 1 : 0.9,
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 items-start justify-center">
                        {!isPositive && r.growth !== 0 && (
                          <div className="flex w-[70%] max-w-[2.5rem] flex-col items-center justify-start">
                            <div
                              className="w-full rounded-b-sm transition-all duration-300"
                              style={{
                                height: barH,
                                backgroundColor: "#8b2635",
                                opacity: isHov ? 1 : 0.9,
                              }}
                            />
                            <span className={`${pctLabelClass} mt-0.5 text-[#8b2635]`}>
                              {fmtBarPct(r.growth)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-1.5 flex w-full gap-0.5">
              {displayRows.map((r) => (
                <span
                  key={r.month}
                  className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-400"
                >
                  {r.month}
                </span>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#1a5f3a]" />
                Positive MoM
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#8b2635]" />
                Negative MoM
              </span>
              <span className="text-slate-400">FY {currentFY.replace("-", "–")}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PAMomGrowth;
