import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, MapPin, RefreshCw } from "lucide-react";
import { LoadingBlock, PA_RANKED_LIST_BODY_CLASS } from "./pa.shared";
import { fmtTmt, growthColor, FALLBACK_COLORS } from "./pa.utils";
import type { TwoFyRow, PAFilterState } from "./pa.types";
import type { CompareMode } from "./pa.shared";
import PARegionDrillSheet from "./PARegionDrillSheet";

interface Props {
  rows:        TwoFyRow[];
  loading:     boolean;
  currentFY:   string;
  prevFY:      string;
  filters:     PAFilterState;
  compareMode?: CompareMode;
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

type SortKey = "volume" | "growth";
type SortDir = "asc" | "desc";

const REGION_LIST_GRID =
  "grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-1.5 sm:grid-cols-[1.25rem_minmax(0,1fr)_6rem_4.5rem_1.25rem]";

const PARegionPerformance: React.FC<Props> = ({
  rows, loading, currentFY, prevFY, filters, compareMode = "fy", onRefresh, refreshing,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetRegion, setSheetRegion] = useState<TwoFyRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const rankByName = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.name, index + 1));
    return map;
  }, [rows]);

  const sortedRows = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "volume") return mult * (a.currentTotal - b.currentTotal);
      return mult * (a.growthPct - b.growthPct);
    });
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <ArrowUpDown className="h-2.5 w-2.5 shrink-0 opacity-40" />;
    }
    return sortDir === "asc"
      ? <ArrowUp className="h-2.5 w-2.5 shrink-0 text-blue-600" />
      : <ArrowDown className="h-2.5 w-2.5 shrink-0 text-blue-600" />;
  };

  const openSheet = (row: TwoFyRow) => {
    setSheetRegion(row);
    setSheetOpen(true);
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
              <MapPin className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-700">Region performance</h2>
              {!loading && rows.length > 0 && (
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {rows.length} regions · {fmtTmt(total)} TMT · FY {shortFY(currentFY)} vs {shortFY(prevFY)}
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
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {/* Column labels */}
        {!loading && rows.length > 0 && (
          <div className={`${REGION_LIST_GRID} border-b border-slate-50 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-slate-400`}>
            <span>#</span>
            <span>Region</span>
            <button
              type="button"
              title="Sort by volume"
              onClick={() => handleSort("volume")}
              className="hidden items-center justify-end gap-0.5 sm:inline-flex hover:text-slate-600"
            >
              Volume
              <SortIcon column="volume" />
            </button>
            <button
              type="button"
              title="Sort by growth %"
              onClick={() => handleSort("growth")}
              className="hidden items-center justify-end gap-0.5 sm:inline-flex hover:text-slate-600"
            >
              Growth %
              <SortIcon column="growth" />
            </button>
            <span className="sr-only sm:not-sr-only sm:text-center">Drill</span>
          </div>
        )}

        <div className={PA_RANKED_LIST_BODY_CLASS}>
          {loading ? (
            <LoadingBlock rows={6} />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No region data</p>
          ) : (
            <div className="space-y-0.5">
              {sortedRows.map((row) => {
                const rank = rankByName.get(row.name) ?? 0;
                const rankIndex = rank - 1;
                const barPct = (row.currentTotal / maxTotal) * 100;
                const barColor = FALLBACK_COLORS[rankIndex % FALLBACK_COLORS.length];
                const positiveGrowth = row.growthPct >= 0;

                return (
                  <div
                    key={row.name}
                    className="group rounded border border-slate-100 bg-slate-50/50 px-1.5 py-1 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <div className={REGION_LIST_GRID}>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ring-1 ${rankStyle(rankIndex)}`}
                      >
                        {rank}
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
                        title={`Drill into ${row.name}`}
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
              Avg growth %{" "}
              <span className="font-semibold" style={{ color: growthColor(avgGrowth) }}>
                {avgGrowth > 0 ? "+" : ""}{avgGrowth.toFixed(1)}%
              </span>
            </span>
          </div>
        )}
      </div>

      <PARegionDrillSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        region={sheetRegion}
        currentFY={currentFY}
        prevFY={prevFY}
        filters={filters}
        compareMode={compareMode}
      />
    </div>
  );
};

export default PARegionPerformance;
