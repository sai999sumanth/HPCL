import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import type {
  LubesBldCategoryRow,
  SalesAreaTableRow,
} from "./lubesSalesPerformance.types";
import {
  BreakdownChartLegend,
  BreakdownCompareChart,
  BreakdownCompareTable,
  ghostIconButtonClass,
  LoadingBlock,
  PanelShell,
  useBreakdownRowSelection,
  withBreakdownChartPct,
} from "./lubesSalesPerformance.shared";
import {
  buildBldCategoryChartData,
  buildLubesBldCategoryYtdPayload,
  mapLubesBldCategoryRows,
  normalizeAggregationRows,
} from "./lubesSalesPerformance.utils";
import { LUBES_UI } from "./lubesSalesPerformance.theme";

export type BldCategoryBreakdownPanelProps = {
  loading: boolean;
  refreshing: boolean;
  bldCategoryRows: LubesBldCategoryRow[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  ytdActive: boolean;
  ytdExtraFilters?: Record<string, string[]>;
  ytdExtraFiltersKey?: string;
  onYtdChange: (active: boolean) => void;
  onRefresh: () => void;
};

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const BldCategoryBreakdownPanel: React.FC<BldCategoryBreakdownPanelProps> = ({
  loading,
  refreshing,
  bldCategoryRows,
  displayCurrentFY,
  displayPreviousFY,
  ytdActive,
  ytdExtraFilters = {},
  ytdExtraFiltersKey = "",
  onYtdChange,
  onRefresh,
}) => {
  const [ytdLoading, setYtdLoading] = useState(false);
  const [ytdRows, setYtdRows] = useState<LubesBldCategoryRow[] | null>(null);

  const prevFY = useMemo(() => {
    const startYear = parseInt(displayCurrentFY.split("-")[0], 10);
    return `${startYear - 1}-${startYear}`;
  }, [displayCurrentFY]);

  const fetchYtd = useCallback(async () => {
    setYtdLoading(true);
    try {
      const today = new Date();
      const currentDateTo = toYMD(today);
      const prevYearToday = new Date(today);
      prevYearToday.setFullYear(today.getFullYear() - 1);
      const prevDateTo = toYMD(prevYearToday);
      const currentFYStartYear = parseInt(displayCurrentFY.split("-")[0], 10);
      const currentDateFrom = `${currentFYStartYear}0401`;
      const prevDateFrom = `${currentFYStartYear - 1}0401`;

      const [currentRes, prevRes] = await Promise.all([
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesBldCategoryYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, ytdExtraFilters)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesBldCategoryYtdPayload(prevFY, prevDateFrom, prevDateTo, ytdExtraFilters)
        ),
      ]);

      setYtdRows([
        ...mapLubesBldCategoryRows(normalizeAggregationRows(currentRes.data)),
        ...mapLubesBldCategoryRows(normalizeAggregationRows(prevRes.data)),
      ]);
    } catch {
      setYtdRows([]);
    } finally {
      setYtdLoading(false);
    }
  }, [displayCurrentFY, prevFY, ytdExtraFilters]);

  useEffect(() => { setYtdRows(null); }, [displayCurrentFY, ytdExtraFiltersKey]);

  useEffect(() => {
    if (ytdActive && ytdRows === null && !ytdLoading) void fetchYtd();
  }, [ytdActive, ytdRows, ytdLoading, fetchYtd]);

  const activeRows = ytdActive ? (ytdRows ?? []) : bldCategoryRows;
  const activePreviousFY = ytdActive ? prevFY : displayPreviousFY;
  const isActiveLoading = ytdActive ? ytdLoading : loading;

  const chartData = useMemo(
    () => buildBldCategoryChartData(activeRows, displayCurrentFY, activePreviousFY),
    [activeRows, displayCurrentFY, activePreviousFY]
  );

  const tableRows = useMemo<SalesAreaTableRow[]>(() => withBreakdownChartPct(chartData), [chartData]);

  const chartNames = useMemo(() => chartData.map((row) => row.name), [chartData]);
  const [selectedCategories, toggleCategory] = useBreakdownRowSelection(chartNames, refreshing);

  const filteredChartData = useMemo(() => {
    if (selectedCategories.length === 0) return withBreakdownChartPct(chartData);
    const selected = new Set(selectedCategories);
    return withBreakdownChartPct(chartData.filter((row) => selected.has(row.name)));
  }, [chartData, selectedCategories]);

  const chartMinWidth = useMemo(
    () => Math.max(320, filteredChartData.length * 44),
    [filteredChartData.length]
  );

  const headerAction = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={ytdLoading}
        onClick={() => onYtdChange(!ytdActive)}
        className={`flex items-center gap-0.5 rounded border px-1.5 py-px text-[9px] font-semibold transition-colors disabled:opacity-50
          ${ytdActive
            ? "border-blue-400 bg-blue-100 text-blue-700"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
      >
        {ytdLoading ? <Loader2 className="h-2 w-2 animate-spin" /> : <span>YTD</span>}
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Refresh BLD category data"
        disabled={isActiveLoading || refreshing}
        onClick={ytdActive ? () => void fetchYtd() : onRefresh}
        className={ghostIconButtonClass}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${(refreshing || ytdLoading) ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );

  return (
    <PanelShell
      icon={<Building2 className="h-4 w-4" />}
      title="BLD Category Breakdown"
      subtitle={
        ytdActive
          ? `YTD · ${displayCurrentFY} vs prev year · TMT`
          : `Curr (${displayCurrentFY}) vs Hist (${displayPreviousFY}) · TMT`
      }
      action={headerAction}
      denseHeader
    >
      {isActiveLoading ? (
        <LoadingBlock />
      ) : chartData.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          No BLD category breakdown data available.
        </div>
      ) : (
        <div className="relative">
          {!ytdActive && refreshing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
              <Loader2 className={LUBES_UI.loader} />
            </div>
          )}

          <div className={`grid grid-cols-1 gap-3 lg:items-start ${LUBES_UI.breakdownChartTableGrid}`}>
            <div className="min-w-0">
              {filteredChartData.length === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-center text-sm text-slate-500 sm:h-[260px] md:h-[280px]">
                  No data for the selected BLD categories.
                </div>
              ) : (
                <>
                  <BreakdownChartLegend
                    displayCurrentFY={displayCurrentFY}
                    displayPreviousFY={activePreviousFY}
                  />
                  <div className="overflow-x-auto">
                    <div
                      className="h-[220px] w-full sm:h-[260px] md:h-[280px]"
                      style={{ minWidth: filteredChartData.length > 8 ? chartMinWidth : undefined }}
                    >
                      <BreakdownCompareChart
                        data={filteredChartData}
                        displayCurrentFY={displayCurrentFY}
                        displayPreviousFY={activePreviousFY}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <BreakdownCompareTable
              title="BLD Categories"
              nameColumnLabel="BLD"
              rows={tableRows}
              footer={`Curr ${displayCurrentFY} · Hist ${activePreviousFY} · Click to filter chart`}
              selected={selectedCategories}
              onRowClick={toggleCategory}
            />
          </div>
        </div>
      )}
    </PanelShell>
  );
};

export default BldCategoryBreakdownPanel;
