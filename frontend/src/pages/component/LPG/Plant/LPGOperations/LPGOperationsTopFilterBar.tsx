import React, { useMemo, type ReactNode } from "react";
import LPGOperationsFilters from "./LPGGlobalFilter";
import { DateRangePickerFilter } from "../../Sales/FilterDropdown";
import { Button } from "@/@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { FilterOption, TimeRangePreset } from "./useLPGOperationsFilters";

export type LPGOperationsTopFilterBarProps = {
  filterOptions: FilterOption[];
  filterData: Record<string, any[]>;
  selectedFilters: Record<string, string>;
  isLoadingFilters: boolean;
  onFilterChange: (key: string, value: string) => void;
  fromDate: unknown;
  toDate: unknown;
  onFromDateChange: (date: unknown) => void;
  onToDateChange: (date: unknown) => void;
  timeRangePreset: TimeRangePreset;
  onApplyTimeRangePreset: (preset: TimeRangePreset) => void;
  onResetFilters: () => void;
  /** Hide these filter keys (e.g. `zone`, `plant`, `filling_head`). */
  hiddenFilterKeys?: string[];
  /** Renders before the LPG filter dropdowns (e.g. ticketing zone/plant in place of carousel). */
  beforeFilters?: ReactNode;
};

/**
 * Same top filter row as LPG Operations: zone / plant / carousel, TDY–1M presets, date range, reset.
 */
const LPGOperationsTopFilterBar = ({
  filterOptions,
  filterData,
  selectedFilters,
  isLoadingFilters,
  onFilterChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  timeRangePreset,
  onApplyTimeRangePreset,
  onResetFilters,
  hiddenFilterKeys,
  beforeFilters,
}: LPGOperationsTopFilterBarProps) => {
  const visibleFilterOptions = useMemo(
    () =>
      hiddenFilterKeys?.length
        ? filterOptions.filter((o) => !hiddenFilterKeys.includes(o.key))
        : filterOptions,
    [filterOptions, hiddenFilterKeys]
  );

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 py-1">
      {beforeFilters}
      <LPGOperationsFilters
        filterOptions={visibleFilterOptions}
        filterData={filterData}
        selectedFilters={selectedFilters}
        isLoadingFilters={isLoadingFilters}
        onFilterChange={onFilterChange}
      />
      {(["tdy", "ydy", "1w", "15d", "1m"] as const).map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onApplyTimeRangePreset(preset)}
          className={`px-2 py-0.5 text-xs font-medium rounded transition-all ${
            timeRangePreset === preset
              ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
              : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 border border-gray-300"
          }`}
          title={
            preset === "tdy"
              ? "Today"
              : preset === "ydy"
                ? "Yesterday"
                : preset === "1w"
                  ? "Last 7 days"
                  : preset === "15d"
                    ? "Last 15 days"
                    : "Last 30 days"
          }
        >
          {preset === "tdy" ? "TDY" : preset === "ydy" ? "YDY" : preset === "1w" ? "1W" : preset === "15d" ? "15D" : "1M"}
        </button>
      ))}
      <DateRangePickerFilter
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={onFromDateChange}
        onToDateChange={onToDateChange}
        disabled={isLoadingFilters}
        isCustomRangeActive={timeRangePreset === null}
      />
      <Button
        onClick={onResetFilters}
        disabled={isLoadingFilters}
        className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shrink-0"
        title="Reset All Filters"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default LPGOperationsTopFilterBar;
