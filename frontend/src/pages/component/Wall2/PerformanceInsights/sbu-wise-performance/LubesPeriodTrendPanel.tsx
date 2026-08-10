import React from "react";
import { CalendarRange, Filter, Loader2, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { Popover, PopoverTrigger } from "@/@/components/ui/popover";
import type { PeriodFilter, PeriodViewMode } from "./lubesSalesPerformance.types";
import LubesFiltersPopover, { type LubesFiltersDraft } from "./LubesFiltersPopover";
import LubesPeriodTrendAmChart from "./LubesPeriodTrendAmChart";
import { ghostIconButtonClass, LoadingBlock, PanelShell } from "./lubesSalesPerformance.shared";
import { LUBES_PAGE, LUBES_UI } from "./lubesSalesPerformance.theme";
import type {
  LubesConnectedFilterDraft,
  LubesPeriodTrendPoint,
} from "./lubesSalesPerformance.utils";

const PERIOD_TOGGLE_OPTIONS: { mode: PeriodViewMode; label: string }[] = [
  { mode: "half", label: "Half" },
  { mode: "quarter", label: "Quarter" },
  { mode: "month", label: "Month" },
];

export type LubesPeriodTrendPanelProps = {
  loading: boolean;
  refreshing: boolean;
  expanded: boolean;
  periodView: PeriodViewMode;
  chartData: LubesPeriodTrendPoint[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  onPeriodViewChange: (mode: PeriodViewMode) => void;
  onRefresh: () => void;
  onToggleExpand: () => void;
  filterPopoverOpen: boolean;
  onFilterPopoverOpenChange: (open: boolean) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  appliedPeriodFilters: PeriodFilter[];
  appliedSegments: string[];
  appliedProductCategories: string[];
  appliedRegionalOfficers: string[];
  appliedSalesAreas: string[];
  periodOptionsByMode: Record<PeriodViewMode, { id: string; label: string }[]>;
  segmentOptions: string[];
  productCategoryOptions: string[];
  regionalOfficerOptions: string[];
  salesAreaOptions: string[];
  connectedFiltersLoading: boolean;
  onConnectedFiltersDraftChange?: (draft: LubesConnectedFilterDraft) => void;
  onApplyFilters: (draft: LubesFiltersDraft) => void;
};

const LubesPeriodTrendPanel: React.FC<LubesPeriodTrendPanelProps> = ({
  loading,
  refreshing,
  expanded,
  periodView,
  chartData,
  displayCurrentFY,
  displayPreviousFY,
  onPeriodViewChange,
  onRefresh,
  onToggleExpand,
  filterPopoverOpen,
  onFilterPopoverOpenChange,
  hasActiveFilters,
  activeFilterCount,
  appliedPeriodFilters,
  appliedSegments,
  appliedProductCategories,
  appliedRegionalOfficers,
  appliedSalesAreas,
  periodOptionsByMode,
  segmentOptions,
  productCategoryOptions,
  regionalOfficerOptions,
  salesAreaOptions,
  connectedFiltersLoading,
  onConnectedFiltersDraftChange,
  onApplyFilters,
}) => {
  const periodViewTabs = (
    <div className={LUBES_UI.tabGroup}>
      {PERIOD_TOGGLE_OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onPeriodViewChange(mode)}
          className={`rounded px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all ${
            periodView === mode ? LUBES_UI.tabActive : LUBES_UI.tabIdle
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const refreshButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Refresh period trend"
      disabled={loading || refreshing}
      onClick={onRefresh}
      className={ghostIconButtonClass}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
    </Button>
  );

  const expandButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={expanded ? "Minimize chart" : "Maximize chart"}
      onClick={onToggleExpand}
      className={ghostIconButtonClass}
    >
      {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
    </Button>
  );

  const filterButton = (
    <Popover open={filterPopoverOpen} onOpenChange={onFilterPopoverOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Filters"
          className={`h-7 gap-1 rounded-md px-2 text-[11px] font-semibold shadow-sm ${
            hasActiveFilters ? LUBES_PAGE.filterActive : LUBES_PAGE.filterIdle
          }`}
        >
          <Filter className="h-3 w-3" />
          {/* Filters */}
          {hasActiveFilters ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[9px] font-bold">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      {filterPopoverOpen ? (
        <LubesFiltersPopover
          open={filterPopoverOpen}
          appliedPeriodFilters={appliedPeriodFilters}
          appliedSegments={appliedSegments}
          appliedProductCategories={appliedProductCategories}
          appliedRegionalOfficers={appliedRegionalOfficers}
          appliedSalesAreas={appliedSalesAreas}
          periodView={periodView}
          periodOptionsByMode={periodOptionsByMode}
          segmentOptions={segmentOptions}
          productCategoryOptions={productCategoryOptions}
          regionalOfficerOptions={regionalOfficerOptions}
          salesAreaOptions={salesAreaOptions}
          connectedFiltersLoading={connectedFiltersLoading}
          onConnectedFiltersDraftChange={onConnectedFiltersDraftChange}
          onApply={onApplyFilters}
        />
      ) : null}
    </Popover>
  );

  const periodLabel =
    periodView === "half" ? "Half Year" : periodView === "quarter" ? "Quarter" : "Month";

  return (
    <PanelShell
      icon={<CalendarRange className="h-4 w-4" />}
      title="Net Weight Trend"
      subtitle={`${periodLabel} wise · FY ${displayPreviousFY} vs ${displayCurrentFY}`}
      action={
        <div className="flex flex-wrap items-center justify-end gap-1">
          {periodViewTabs}
          {filterButton}
          {expandButton}
          {refreshButton}
        </div>
      }
      fillHeight={loading}
      compact
    >
      {loading ? (
        <LoadingBlock fill />
      ) : chartData.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No period trend data available.
        </div>
      ) : (
        <div className="relative">
          {refreshing ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
              <Loader2 className={LUBES_UI.loader} />
            </div>
          ) : null}
          <LubesPeriodTrendAmChart
            data={chartData}
            previousFY={displayPreviousFY}
            currentFY={displayCurrentFY}
            periodView={periodView}
            expanded={expanded}
          />
        </div>
      )}
    </PanelShell>
  );
};

export default LubesPeriodTrendPanel;
