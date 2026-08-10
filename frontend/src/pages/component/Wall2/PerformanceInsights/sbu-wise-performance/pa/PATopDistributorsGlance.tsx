import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Star, RefreshCw } from "lucide-react";
import { LoadingBlock, PA_RANKED_LIST_BODY_CLASS } from "./pa.shared";
import { fmtTmt, growthColor, FALLBACK_COLORS, getPaDateRange } from "./pa.utils";
import { distributorDetailPayload, distributorMonthlyPayload } from "./pa.payloads";
import type { PaVolumeOrder } from "./pa.fetchers";
import type { TwoFyRow, PAFilterState } from "./pa.types";
import type { CompareMode } from "./pa.shared";
import PADetailSummarySheet from "./PADetailSummarySheet";

interface Props {
  rows:        TwoFyRow[];
  loading:     boolean;
  currentFY:   string;
  prevFY:      string;
  filters:     PAFilterState;
  compareMode?: CompareMode;
  volumeOrder?: PaVolumeOrder;
  onVolumeOrderChange?: (order: PaVolumeOrder) => void;
  onRefresh?:  () => void;
  refreshing?: boolean;
}

const shortFY = (fy: string) => {
  const [a, b] = fy.split("-");
  return `${a.slice(2)}–${b.slice(2)}`;
};

const rankStyle = (index: number) => {
  if (index === 0) return "bg-amber-100 text-amber-700 ring-amber-200";
  if (index === 1) return "bg-slate-200 text-slate-600 ring-slate-300";
  if (index === 2) return "bg-orange-100 text-orange-700 ring-orange-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
};

const orderBtnClass = (active: boolean) =>
  `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${
    active
      ? "border-blue-300 bg-blue-50 text-blue-600"
      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
  }`;

const PATopDistributorsGlance: React.FC<Props> = ({
  rows, loading, currentFY, prevFY, filters, compareMode = "fy",
  volumeOrder = "desc", onVolumeOrderChange, onRefresh, refreshing,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<TwoFyRow | null>(null);

  const { total, maxTotal, avgGrowth } = useMemo(() => {
    const sum = rows.reduce((s, r) => s + r.currentTotal, 0);
    return {
      total: sum,
      maxTotal: Math.max(...rows.map((r) => r.currentTotal), 1),
      avgGrowth: rows.length
        ? rows.reduce((s, r) => s + r.growthPct, 0) / rows.length
        : 0,
    };
  }, [rows]);

  const openSheet = (row: TwoFyRow) => {
    setSheetItem(row);
    setSheetOpen(true);
  };

  const buildPayload = sheetItem
    ? (fy: string) => distributorDetailPayload(fy, sheetItem.name, filters, getPaDateRange(fy, compareMode))
    : null;

  const buildMonthlyPayload = sheetItem
    ? (fy: string) => distributorMonthlyPayload(fy, sheetItem.name, filters, getPaDateRange(fy, compareMode))
    : null;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
              <Star className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-700">
                {volumeOrder === "asc" ? "Bottom distributors at a glance" : "Top distributors at a glance"}
              </h2>
              {!loading && rows.length > 0 && (
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {rows.length} distributors · {fmtTmt(total)} TMT · FY {shortFY(currentFY)} vs {shortFY(prevFY)}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onVolumeOrderChange && (
              <>
                <button
                  type="button"
                  title="Top by volume"
                  disabled={loading || refreshing}
                  onClick={() => onVolumeOrderChange("desc")}
                  className={orderBtnClass(volumeOrder === "desc")}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Bottom by volume"
                  disabled={loading || refreshing}
                  onClick={() => onVolumeOrderChange("asc")}
                  className={orderBtnClass(volumeOrder === "asc")}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </>
            )}
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
        </div>

        {!loading && rows.length > 0 && (
          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-1.5 border-b border-slate-50 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-slate-400 sm:grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_3rem_1.25rem]">
            <span>#</span>
            <span>Distributor</span>
            <span className="hidden text-right sm:block">Volume</span>
            <span className="hidden text-right sm:block">YoY</span>
            <span className="sr-only sm:not-sr-only sm:text-center">Drill</span>
          </div>
        )}

        <div className={PA_RANKED_LIST_BODY_CLASS}>
          {loading ? (
            <LoadingBlock rows={6} />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No distributor data</p>
          ) : (
            <div className="space-y-0.5">
              {rows.map((row, i) => {
                const barPct = (row.currentTotal / maxTotal) * 100;
                const barColor = FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                const positiveGrowth = row.growthPct >= 0;

                return (
                  <div
                    key={row.name}
                    className="group rounded border border-slate-100 bg-slate-50/50 px-1.5 py-1 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-1.5 sm:grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_3rem_1.25rem]">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ring-1 ${rankStyle(i)}`}
                      >
                        {i + 1}
                      </span>

                      <div className="min-w-0 leading-none">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-[11px] font-semibold text-slate-700" title={row.name}>
                            {row.name}
                          </p>
                          <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-800 sm:hidden">
                            {fmtTmt(row.currentTotal)}
                          </span>
                        </div>
                        <div className="mt-0.5">
                          <div className="h-1 overflow-hidden rounded-full bg-slate-200/80">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${barPct}%`, backgroundColor: barColor }}
                            />
                          </div>
                        </div>
                      </div>

                      <span className="hidden text-right text-[11px] font-bold leading-none tabular-nums text-slate-800 sm:block">
                        {fmtTmt(row.currentTotal)}
                      </span>

                      <span
                        className={`hidden rounded px-1 py-px text-center text-[9px] font-bold leading-none sm:block ${
                          positiveGrowth
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {row.growthPct > 0 ? "+" : ""}{row.growthPct.toFixed(1)}%
                      </span>

                      <button
                        type="button"
                        title={`View ${row.name}`}
                        onClick={() => openSheet(row)}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 opacity-70 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                      >
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5 text-[10px]">
            <span className="text-slate-500">
              Total <span className="font-semibold text-slate-700">{fmtTmt(total)} TMT</span>
            </span>
            <span className="text-slate-400">
              Avg YoY{" "}
              <span className="font-semibold" style={{ color: growthColor(avgGrowth) }}>
                {avgGrowth > 0 ? "+" : ""}{avgGrowth.toFixed(1)}%
              </span>
            </span>
          </div>
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
};

export default PATopDistributorsGlance;
