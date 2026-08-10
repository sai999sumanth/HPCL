import React, { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { LoadingBlock, PA_PARETO_LIST_BODY_CLASS } from "./pa.shared";
import { buildParetoSummary, fmtBarTmt } from "./pa.utils";
import type { SimpleRow } from "./pa.types";

interface Props {
  rows:        SimpleRow[];
  loading:     boolean;
  onRefresh?:  () => void;
  refreshing?: boolean;
  className?:  string;
}

const PADistributorPareto: React.FC<Props> = ({
  rows,
  loading,
  onRefresh,
  refreshing,
  className,
}) => {
  const pareto = useMemo(() => buildParetoSummary(rows), [rows]);
  const maxBar = useMemo(
    () => Math.max(...pareto.rows.map((r) => r.total), 1),
    [pareto.rows],
  );

  const top80CutoffIndex = pareto.top80Count > 0 ? pareto.top80Count - 1 : -1;

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className ?? ""}`}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 px-3 pb-1.5 pt-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold leading-tight text-slate-900">
            Distributor Pareto — cumulative sales share
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] bg-blue-500" />
              Top 80% contributors
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] bg-slate-300" />
              Bottom 20% tail
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!loading && pareto.totalCount > 0 && (
            <p className="whitespace-nowrap text-[11px] text-slate-400">
              Top {pareto.top80Count} of {pareto.totalCount} distributors = 80% sales
            </p>
          )}
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
      </div>

      <div className={PA_PARETO_LIST_BODY_CLASS}>
        {loading ? (
          <LoadingBlock rows={8} />
        ) : pareto.rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No distributor data</p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="space-y-0">
              {pareto.rows.map((row, index) => {
                const barPct = (row.total / maxBar) * 100;
                const showCutoffLine =
                  index === top80CutoffIndex && pareto.tailCount > 0;

                return (
                  <React.Fragment key={row.name}>
                    <div className="grid grid-cols-[12rem_minmax(2rem,1fr)_3.25rem_2rem] items-center gap-x-2 py-[2px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block min-w-0 cursor-default truncate text-left text-[11px] leading-none text-slate-700">
                            {row.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {row.name}
                        </TooltipContent>
                      </Tooltip>
                      <div className="relative min-w-0">
                        <div className="h-2 overflow-hidden rounded-sm bg-slate-200">
                          <div
                            className={`h-full rounded-sm ${
                              row.isTop80 ? "bg-blue-500" : "bg-slate-300"
                            }`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-right text-[11px] font-bold tabular-nums leading-none text-slate-900">
                        {fmtBarTmt(row.total)}
                      </span>
                      <span className="w-8 whitespace-nowrap text-right text-[11px] font-medium tabular-nums leading-none text-blue-500">
                        {Math.round(row.cumulativePct)}%
                      </span>
                    </div>
                    {showCutoffLine && (
                      <div
                        className="my-1 border-t border-dashed border-blue-400"
                        aria-hidden
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </div>

      {!loading && pareto.totalCount > 0 && (
        <div className="shrink-0 border-t border-slate-100 px-3 py-2">
          <p className="text-[11px] leading-snug text-slate-500">
            <span className="font-semibold text-slate-600">{pareto.top80Count}</span>
            {" "}distributors contribute{" "}
            <span className="font-semibold text-slate-600">{fmtBarTmt(pareto.top80Sum)} TMT</span>.
            {pareto.tailCount > 0 && (
              <>
                {" "}Remaining{" "}
                <span className="font-semibold text-slate-600">{pareto.tailCount}</span>
                {" "}distributors share the bottom 20% (
                <span className="font-semibold text-slate-600">{fmtBarTmt(pareto.tailSum)} TMT</span>).
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default PADistributorPareto;
