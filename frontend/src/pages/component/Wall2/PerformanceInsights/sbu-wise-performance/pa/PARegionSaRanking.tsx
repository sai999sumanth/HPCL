import React, { useMemo } from "react";
import { MapPinned, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { LoadingBlock } from "./pa.shared";
import { fmtTmt } from "./pa.utils";
import type { RegionSaRow } from "./pa.types";

interface Props {
  rows:        RegionSaRow[];
  loading:     boolean;
  onRefresh?:  () => void;
  refreshing?: boolean;
}

const rankBadge = (index: number) => {
  if (index === 0) return "bg-amber-400 text-amber-950";
  if (index === 1) return "bg-slate-300 text-slate-700";
  if (index === 2) return "bg-orange-300 text-orange-950";
  return "text-slate-500";
};

const TH =
  "px-1.5 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap";
const TD = "px-1.5 py-1 text-[11px] leading-none text-slate-700 border-t border-slate-100";

const PARegionSaRanking: React.FC<Props> = ({ rows, loading, onRefresh, refreshing }) => {
  const displayRows = useMemo(() => rows.slice(0, 20), [rows]);

  const { total, regionCount } = useMemo(() => {
    const sum = displayRows.reduce((s, r) => s + r.total, 0);
    const regions = new Set(displayRows.map((r) => r.ro));
    return { total: sum, regionCount: regions.size };
  }, [displayRows]);

  const maxTotal = Math.max(...displayRows.map((r) => r.total), 1);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
            <MapPinned className="h-3 w-3" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-semibold leading-tight text-slate-800">
              Region-wise sales area ranking
            </h2>
            {!loading && displayRows.length > 0 && (
              <p className="text-[10px] leading-tight text-slate-400">
                Top {displayRows.length} of {rows.length} · {regionCount} regions · {fmtTmt(total)} TMT
              </p>
            )}
          </div>
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

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-2">
            <LoadingBlock rows={5} />
          </div>
        ) : displayRows.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">No sales area data</p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <table className="w-full min-w-[32rem] border-collapse">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className={`${TH} w-8 text-center`}>#</th>
                  <th className={TH}>Region</th>
                  <th className={TH}>Sales area</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-right`}>Share</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => {
                  const sharePct = total > 0 ? (row.total / total) * 100 : 0;
                  const barPct = (row.total / maxTotal) * 100;

                  return (
                    <tr
                      key={`${row.ro}_${row.sa}`}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className={`${TD} text-center`}>
                        {i < 3 ? (
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${rankBadge(i)}`}
                          >
                            {i + 1}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500">{i + 1}</span>
                        )}
                      </td>
                      <td className={`${TD} max-w-[7rem]`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block cursor-default truncate font-medium text-slate-700">
                              {row.ro}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            {row.ro}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className={`${TD} max-w-[8rem]`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block cursor-default truncate font-semibold text-slate-800">
                              {row.sa}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            {row.sa}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className={`${TD} text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap`}>
                        {fmtTmt(row.total)}
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-slate-500">
                            {sharePct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};

export default PARegionSaRanking;
