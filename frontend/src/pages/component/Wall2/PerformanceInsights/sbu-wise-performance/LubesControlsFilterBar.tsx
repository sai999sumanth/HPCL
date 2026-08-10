import React, { useMemo } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import type { PeriodFilter, PeriodViewMode } from "./lubesSalesPerformance.types";
import { FILTER_PERIOD_VIEW_OPTIONS } from "./lubesSalesPerformance.shared";
import { formatFilterSummary, periodFilterLabel } from "./lubesSalesPerformance.utils";

const mapSelectOptions = (values: string[]) =>
  values.map((value) => ({ id: value, name: value }));

const ControlSelectField: React.FC<{
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  loading?: boolean;
}> = ({
  label,
  options,
  value,
  onChange,
  placeholder = "All",
  loading = false,
}) => (
  <div className="min-w-0 space-y-1">
    <p className="text-[11px] font-medium text-slate-700">{label}</p>
    <CustomMultiSelect
      options={mapSelectOptions(options)}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      hideSelectAll
      triggerDisplay="firstWithCount"
      loading={loading}
      modalPopover
      maxCount={0}
      className="h-8 min-h-8 w-full border-slate-200 bg-white text-xs shadow-none"
    />
  </div>
);

export type LubesControlsFilterBarProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  selectedFY: string;
  currentFY: string;
  previousFY: string;
  onSelectedFYChange: (value: string) => void;
  allCompanyOptions: string[];
  appliedCompanies: string[];
  onAppliedCompaniesChange: (value: string[]) => void;
  periodView: PeriodViewMode;
  onPeriodViewChange: (mode: PeriodViewMode) => void;
  periodOptions: { id: string; label: string }[];
  appliedPeriodFilters: PeriodFilter[];
  onAppliedPeriodFiltersChange: (filters: PeriodFilter[]) => void;
  segmentOptions: string[];
  productCategoryOptions: string[];
  regionalOfficerOptions: string[];
  salesAreaOptions: string[];
  appliedSegments: string[];
  onAppliedSegmentsChange: (value: string[]) => void;
  appliedProductCategories: string[];
  onAppliedProductCategoriesChange: (value: string[]) => void;
  appliedRegionalOfficers: string[];
  onAppliedRegionalOfficersChange: (value: string[]) => void;
  appliedSalesAreas: string[];
  onAppliedSalesAreasChange: (value: string[]) => void;
  filterOptionsLoading: boolean;
  onClearAll: () => void;
};

const LubesControlsFilterBar: React.FC<LubesControlsFilterBarProps> = ({
  expanded,
  onExpandedChange,
  selectedFY,
  currentFY,
  previousFY,
  onSelectedFYChange,
  allCompanyOptions,
  appliedCompanies,
  onAppliedCompaniesChange,
  periodView,
  onPeriodViewChange,
  periodOptions,
  appliedPeriodFilters,
  onAppliedPeriodFiltersChange,
  segmentOptions,
  productCategoryOptions,
  regionalOfficerOptions,
  salesAreaOptions,
  appliedSegments,
  onAppliedSegmentsChange,
  appliedProductCategories,
  onAppliedProductCategoriesChange,
  appliedRegionalOfficers,
  onAppliedRegionalOfficersChange,
  appliedSalesAreas,
  onAppliedSalesAreasChange,
  filterOptionsLoading,
  onClearAll,
}) => {
  const selectedPeriodIds = useMemo(
    () =>
      appliedPeriodFilters
        .filter((filter) => filter.mode === periodView)
        .map((filter) => filter.id),
    [appliedPeriodFilters, periodView]
  );

  const periodSelectOptions = useMemo(
    () => periodOptions.map((item) => ({ id: item.id, name: item.label })),
    [periodOptions]
  );

  const periodSummaryLabels = useMemo(
    () => appliedPeriodFilters.map(periodFilterLabel),
    [appliedPeriodFilters]
  );

  const fiscalYearSummary =
    selectedFY === currentFY ? `Present (${currentFY})` : `Past (${previousFY})`;

  const summaryItems = [
    { label: "Fiscal Year", value: fiscalYearSummary },
    { label: "Company", value: formatFilterSummary(appliedCompanies) },
    { label: "Segment", value: formatFilterSummary(appliedSegments) },
    { label: "Product Category", value: formatFilterSummary(appliedProductCategories) },
    { label: "Regional Officer", value: formatFilterSummary(appliedRegionalOfficers) },
    { label: "Sales Area", value: formatFilterSummary(appliedSalesAreas) },
    { label: "Period", value: formatFilterSummary(periodSummaryLabels) },
  ];

  const handlePeriodSelectionChange = (ids: string[]) => {
    onAppliedPeriodFiltersChange([
      ...appliedPeriodFilters.filter((filter) => filter.mode !== periodView),
      ...ids.map((id) => ({ mode: periodView, id })),
    ]);
  };

  const handlePeriodViewChange = (mode: PeriodViewMode) => {
    if (mode === periodView) return;
    onPeriodViewChange(mode);
  };

  return (
    <div className="border-t border-slate-200 bg-slate-50/90">
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left sm:px-4"
        aria-expanded={expanded}
      >
        <span className="shrink-0 text-xs font-semibold text-slate-800">Controls</span>
        {!expanded && (
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex w-max items-center gap-x-4 gap-y-1 pr-2">
              {summaryItems.map((item) => (
                <span key={item.label} className="whitespace-nowrap text-xs">
                  <span className="font-semibold text-slate-800">{item.label}</span>{" "}
                  <span className="font-normal text-slate-500">{item.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-200 px-3 pb-3 pt-3 sm:px-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-medium text-slate-700">Fiscal Year</p>
              <Select value={selectedFY} onValueChange={onSelectedFYChange}>
                <SelectTrigger className="h-8 w-full border-slate-200 bg-white text-xs shadow-none">
                  <SelectValue placeholder="Fiscal year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentFY} className="text-xs">
                    Present FY ({currentFY})
                  </SelectItem>
                  <SelectItem value={previousFY} className="text-xs">
                    Past FY ({previousFY})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ControlSelectField
              label="Company"
              options={allCompanyOptions}
              value={appliedCompanies}
              onChange={onAppliedCompaniesChange}
            />

            {filterOptionsLoading ? (
              <div className="col-span-full flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                Loading filter options...
              </div>
            ) : (
              <>
                <ControlSelectField
                  label="Segment"
                  options={segmentOptions}
                  value={appliedSegments}
                  onChange={onAppliedSegmentsChange}
                />
                <ControlSelectField
                  label="Product Category"
                  options={productCategoryOptions}
                  value={appliedProductCategories}
                  onChange={onAppliedProductCategoriesChange}
                />
                <ControlSelectField
                  label="Regional Officer"
                  options={regionalOfficerOptions}
                  value={appliedRegionalOfficers}
                  onChange={onAppliedRegionalOfficersChange}
                />
                <ControlSelectField
                  label="Sales Area"
                  options={salesAreaOptions}
                  value={appliedSalesAreas}
                  onChange={onAppliedSalesAreasChange}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-medium text-slate-700">Period</p>
              <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
                {FILTER_PERIOD_VIEW_OPTIONS.map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handlePeriodViewChange(mode)}
                    className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                      periodView === mode
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <CustomMultiSelect
                options={periodSelectOptions}
                value={selectedPeriodIds}
                onValueChange={handlePeriodSelectionChange}
                placeholder="All"
                hideSelectAll
                triggerDisplay="firstWithCount"
                maxCount={0}
                className="h-8 min-h-8 w-full border-slate-200 bg-white text-xs shadow-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LubesControlsFilterBar;
