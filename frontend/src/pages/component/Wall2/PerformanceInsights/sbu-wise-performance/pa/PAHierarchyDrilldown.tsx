import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronRight, Play, RefreshCw } from "lucide-react";
import { D, LoadingBlock } from "./pa.shared";
import { fmtTmt, growthColor, buildTwoFyFromSingleFyResponses, getPaDateRange } from "./pa.utils";
import { saPayload, distPayload } from "./pa.payloads";
import { postTwoFy } from "./pa.fetchers";
import type { CompareMode } from "./pa.shared";
import type { TwoFyRow, PAFilterState } from "./pa.types";
import PARegionDrillSheet from "./PARegionDrillSheet";

type DrillLevel = "region" | "sa" | "dist";

const LEVEL_LABELS: Record<DrillLevel, string> = {
  region: "Region level",
  sa:     "Sales Area level",
  dist:   "Distributor level",
};

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

interface CardProps {
  row:           TwoFyRow;
  pctOfTotal:    number;
  vsAvg:         number;
  barPct:        number;
  canDrill:      boolean;
  onSheetOpen:   () => void;
  onInlineDrill: () => void;
}

const HierarchyCard: React.FC<CardProps> = ({
  row, pctOfTotal, vsAvg, barPct, canDrill, onSheetOpen, onInlineDrill,
}) => {
  const vsAvgPositive = vsAvg >= 0;
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-xs font-semibold leading-tight text-slate-700">
          {row.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="Open detail panel"
            onClick={onSheetOpen}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          {canDrill && (
            <button
              type="button"
              title="Drill down in cards"
              onClick={onInlineDrill}
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="text-lg font-bold leading-tight text-slate-800">
        {fmtTmt(row.currentTotal)} <span className="text-xs font-semibold text-slate-400">TMT</span>
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Prev: {fmtTmt(row.prevTotal)} TMT
      </p>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">{pctOfTotal.toFixed(0)}% of total</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            vsAvgPositive
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {vsAvg >= 0 ? "+" : ""}{vsAvg.toFixed(0)}% vs avg
        </span>
      </div>

      <p
        className="mt-1.5 text-[10px] font-medium"
        style={{ color: growthColor(row.growthPct) }}
      >
        YoY {row.growthPct > 0 ? "+" : ""}{row.growthPct.toFixed(1)}%
      </p>
    </div>
  );
};

const PAHierarchyDrilldown: React.FC<Props> = ({
  rows, loading, currentFY, prevFY, filters, compareMode = "fy", onRefresh, refreshing,
}) => {
  const [inlineLevel, setInlineLevel]       = useState<DrillLevel>("region");
  const [selectedRegion, setSelectedRegion] = useState<TwoFyRow | null>(null);
  const [selectedSA, setSelectedSA]         = useState<TwoFyRow | null>(null);
  const [inlineSaRows, setInlineSaRows]     = useState<TwoFyRow[]>([]);
  const [inlineDistRows, setInlineDistRows] = useState<TwoFyRow[]>([]);
  const [inlineLoading, setInlineLoading]   = useState(false);

  const [sheetOpen, setSheetOpen]     = useState(false);
  const [sheetRegion, setSheetRegion] = useState<TwoFyRow | null>(null);
  const [sheetInitialSA, setSheetInitialSA] = useState<TwoFyRow | null>(null);

  const displayRows = useMemo(() => {
    if (inlineLevel === "sa") return inlineSaRows;
    if (inlineLevel === "dist") return inlineDistRows;
    return rows;
  }, [inlineLevel, rows, inlineSaRows, inlineDistRows]);

  const totalSum = useMemo(
    () => displayRows.reduce((s, r) => s + r.currentTotal, 0),
    [displayRows],
  );
  const maxTotal = useMemo(
    () => Math.max(...displayRows.map((r) => r.currentTotal), 1),
    [displayRows],
  );
  const avgGrowth = useMemo(
    () => displayRows.length ? displayRows.reduce((s, r) => s + r.growthPct, 0) / displayRows.length : 0,
    [displayRows],
  );

  const fetchSaRows = useCallback(async (region: TwoFyRow) => {
    setInlineLoading(true);
    try {
      const { current, previous } = await postTwoFy(
        (fy) => saPayload(fy, region.name, filters, getPaDateRange(fy, compareMode)),
        currentFY,
        prevFY,
      );
      setInlineSaRows(buildTwoFyFromSingleFyResponses(current, previous, "ORG_SA_NM"));
    } finally {
      setInlineLoading(false);
    }
  }, [currentFY, prevFY, filters, compareMode]);

  const fetchDistRows = useCallback(async (sa: TwoFyRow) => {
    setInlineLoading(true);
    try {
      const { current, previous } = await postTwoFy(
        (fy) => distPayload(fy, sa.name, filters, getPaDateRange(fy, compareMode)),
        currentFY,
        prevFY,
      );
      setInlineDistRows(buildTwoFyFromSingleFyResponses(current, previous, "NAME1"));
    } finally {
      setInlineLoading(false);
    }
  }, [currentFY, prevFY, filters, compareMode]);

  useEffect(() => {
    setInlineLevel("region");
    setSelectedRegion(null);
    setSelectedSA(null);
    setInlineSaRows([]);
    setInlineDistRows([]);
  }, [filters]);

  const goToRegionLevel = () => {
    setInlineLevel("region");
    setSelectedRegion(null);
    setSelectedSA(null);
    setInlineSaRows([]);
    setInlineDistRows([]);
  };

  const goToSaLevel = () => {
    setInlineLevel("sa");
    setSelectedSA(null);
    setInlineDistRows([]);
  };

  const handleInlineDrill = async (row: TwoFyRow) => {
    if (inlineLevel === "region") {
      setSelectedRegion(row);
      setInlineLevel("sa");
      await fetchSaRows(row);
    } else if (inlineLevel === "sa") {
      setSelectedSA(row);
      setInlineLevel("dist");
      await fetchDistRows(row);
    }
  };

  const openSheet = (row: TwoFyRow) => {
    if (inlineLevel === "region") {
      setSheetRegion(row);
      setSheetInitialSA(null);
    } else if (inlineLevel === "sa") {
      setSheetRegion(selectedRegion);
      setSheetInitialSA(row);
    } else if (inlineLevel === "dist") {
      setSheetRegion(selectedRegion);
      setSheetInitialSA(selectedSA);
    } else {
      setSheetRegion(row);
      setSheetInitialSA(null);
    }
    setSheetOpen(true);
  };

  const sectionTitle = useMemo(() => {
    if (inlineLevel === "sa" && selectedRegion) return selectedRegion.name;
    if (inlineLevel === "dist" && selectedSA) return selectedSA.name;
    return "All Regions";
  }, [inlineLevel, selectedRegion, selectedSA]);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-600">
              <Play className="h-3 w-3 fill-current" />
            </span>
            <h2 className="text-sm font-semibold text-slate-700">Hierarchy drill-down</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
              {LEVEL_LABELS[inlineLevel]}
            </span>
            {onRefresh && (
              <button
                type="button"
                title="Refresh"
                disabled={loading || refreshing}
                onClick={onRefresh}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </div>

        <div className="border-b border-slate-50 px-3 py-2">
          <nav className="flex flex-wrap items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={goToRegionLevel}
              className={`font-medium transition-colors ${
                inlineLevel === "region" ? "text-blue-600" : "text-slate-500 hover:text-blue-600"
              }`}
            >
              All Regions
            </button>
            {selectedRegion && (
              <>
                <ChevronRight className="h-3 w-3 text-slate-300" />
                <button
                  type="button"
                  onClick={goToSaLevel}
                  className={`font-medium transition-colors ${
                    inlineLevel === "sa" ? "text-blue-600" : "text-slate-500 hover:text-blue-600"
                  }`}
                >
                  {selectedRegion.name}
                </button>
              </>
            )}
            {selectedSA && inlineLevel === "dist" && (
              <>
                <ChevronRight className="h-3 w-3 text-slate-300" />
                <span className="font-medium text-blue-600">{selectedSA.name}</span>
              </>
            )}
          </nav>
          <p className="mt-1 text-xs font-semibold text-slate-600">{sectionTitle}</p>
        </div>

        <div className="p-3">
          {loading || inlineLoading ? (
            <LoadingBlock rows={6} />
          ) : displayRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No data available</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {displayRows.map((row) => {
                const pctOfTotal = totalSum > 0 ? (row.currentTotal / totalSum) * 100 : 0;
                const barPct = (row.currentTotal / maxTotal) * 100;
                const vsAvg = row.growthPct - avgGrowth;
                return (
                  <HierarchyCard
                    key={row.name}
                    row={row}
                    pctOfTotal={pctOfTotal}
                    vsAvg={vsAvg}
                    barPct={barPct}
                    canDrill={inlineLevel !== "dist"}
                    onSheetOpen={() => openSheet(row)}
                    onInlineDrill={() => void handleInlineDrill(row)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PARegionDrillSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        region={sheetRegion}
        initialSA={sheetInitialSA}
        currentFY={currentFY}
        prevFY={prevFY}
        filters={filters}
        compareMode={compareMode}
      />
    </>
  );
};

export default PAHierarchyDrilldown;
