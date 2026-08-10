import React, { useMemo, useState } from "react";
import { ArrowUpRight, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { LoadingBlock } from "./pa.shared";
import { fmtTmt, getPaDateRange } from "./pa.utils";
import { distributorDetailPayload, distributorMonthlyPayload } from "./pa.payloads";
import type { DistRankRow, PAFilterState } from "./pa.types";
import type { CompareMode } from "./pa.shared";
import PADetailSummarySheet from "./PADetailSummarySheet";

interface Props {
  topRows:      DistRankRow[];
  bottomRows:   DistRankRow[];
  loading:      boolean;
  currentFY:    string;
  prevFY:       string;
  filters:      PAFilterState;
  compareMode?: CompareMode;
  onRefresh?:   () => void;
  refreshing?:  boolean;
}

const rankBadge = (index: number) => {
  if (index === 0) return "bg-amber-400 text-amber-950";
  if (index === 1) return "bg-slate-300 text-slate-700";
  if (index === 2) return "bg-orange-300 text-orange-950";
  return "text-slate-500";
};

const fmtVsAvg = (v: number) => {
  const prefix = v > 0 ? "+" : v < 0 ? "" : "";
  return `${prefix}${fmtTmt(v)}`;
};

const TH =
  "px-1.5 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap";
const TD = "px-1.5 py-1 text-[11px] leading-none text-slate-700 border-t border-slate-100";

interface DistTableProps {
  title:        string;
  rows:         DistRankRow[];
  loading:      boolean;
  variant:      "top" | "bottom";
  currentFY:    string;
  prevFY:       string;
  filters:      PAFilterState;
  compareMode:  CompareMode;
  onRefresh?:   () => void;
  refreshing?:  boolean;
}

function DistTable({
  title, rows, loading, variant, currentFY, prevFY, filters, compareMode, onRefresh, refreshing,
}: DistTableProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<DistRankRow | null>(null);

  const total = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const isTop = variant === "top";
  const Icon = isTop ? TrendingUp : TrendingDown;
  const iconWrap = isTop ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500";

  const buildPayload = sheetItem
    ? (fy: string) => distributorDetailPayload(fy, sheetItem.name, filters, getPaDateRange(fy, compareMode))
    : null;

  const buildMonthlyPayload = sheetItem
    ? (fy: string) => distributorMonthlyPayload(fy, sheetItem.name, filters, getPaDateRange(fy, compareMode))
    : null;

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${iconWrap}`}>
            <Icon className="h-3 w-3" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-semibold leading-tight text-slate-800">{title}</h2>
            {!loading && rows.length > 0 && (
              <p className="text-[10px] leading-tight text-slate-400">
                {rows.length} distributors · {fmtTmt(total)} TMT combined
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
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">No distributor data</p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <table className="w-full min-w-[28rem] border-collapse">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className={`${TH} w-8 text-center`}>#</th>
                  <th className={TH}>Distributor</th>
                  <th className={TH}>Region</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-right`}>Vs avg</th>
                  <th className={`${TH} w-8 text-center`} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={`${row.name}_${row.region}`}
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
                    <td className={`${TD} max-w-[8rem]`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block cursor-default truncate font-semibold text-slate-800">
                            {row.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {row.name}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className={`${TD} max-w-[6rem]`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block cursor-default truncate text-slate-600">
                            {row.region}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {row.region}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className={`${TD} text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap`}>
                      {fmtTmt(row.total)}
                    </td>
                    <td
                      className={`${TD} text-right font-semibold tabular-nums whitespace-nowrap ${
                        row.vsAvg >= 0 ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {fmtVsAvg(row.vsAvg)}
                    </td>
                    <td className={`${TD} text-center`}>
                      <button
                        type="button"
                        title={`View ${row.name}`}
                        onClick={() => { setSheetItem(row); setSheetOpen(true); }}
                        className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        )}
      </div>

      <PADetailSummarySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        categoryLabel="Distributor"
        itemName={sheetItem?.name ?? null}
        currentFY={currentFY}
        prevFY={prevFY}
        groupField="NAME1"
        buildPayload={buildPayload}
        buildMonthlyPayload={buildMonthlyPayload}
      />
    </div>
  );
}

const PATopBottomDistributors: React.FC<Props> = ({
  topRows, bottomRows, loading, currentFY, prevFY, filters, compareMode = "fy", onRefresh, refreshing,
}) => (
  <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
    <DistTable
      title="Top 10 distributors"
      rows={topRows}
      loading={loading}
      variant="top"
      currentFY={currentFY}
      prevFY={prevFY}
      filters={filters}
      compareMode={compareMode}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
    <DistTable
      title="Bottom 10 distributors"
      rows={bottomRows}
      loading={loading}
      variant="bottom"
      currentFY={currentFY}
      prevFY={prevFY}
      filters={filters}
      compareMode={compareMode}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  </div>
);

export default PATopBottomDistributors;
