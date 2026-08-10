import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { PopoverContent } from "@/@/components/ui/popover";
import { Checkbox } from "@/@/components/ui/checkbox";
import type { PeriodFilter, PeriodViewMode } from "./lubesSalesPerformance.types";
import {
  FILTER_PERIOD_VIEW_OPTIONS,
  FilterCompactCheckboxGrid,
} from "./lubesSalesPerformance.shared";
import { LUBES_UI } from "./lubesSalesPerformance.theme";
import {
  type LubesConnectedFilterDraft,
  togglePeriodFilterDraft,
} from "./lubesSalesPerformance.utils";

export type LubesFiltersDraft = {
  periodFilters: PeriodFilter[];
  segments: string[];
  productCategories: string[];
  regionalOfficers: string[];
  salesAreas: string[];
};

export type LubesFiltersPopoverProps = {
  open: boolean;
  appliedPeriodFilters: PeriodFilter[];
  appliedSegments: string[];
  appliedProductCategories: string[];
  appliedRegionalOfficers: string[];
  appliedSalesAreas: string[];
  periodView: PeriodViewMode;
  periodOptionsByMode: Record<PeriodViewMode, { id: string; label: string }[]>;
  segmentOptions: string[];
  productCategoryOptions: string[];
  regionalOfficerOptions: string[];
  salesAreaOptions: string[];
  connectedFiltersLoading: boolean;
  onConnectedFiltersDraftChange?: (draft: LubesConnectedFilterDraft) => void;
  onApply: (draft: LubesFiltersDraft) => void;
  onClose?: () => void;
};

const toggleListValue = (value: string, selected: string[]) =>
  selected.includes(value)
    ? selected.filter((entry) => entry !== value)
    : [...selected, value];

const selectionListsMatch = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value) => right.includes(value));

const FilterSectionDone: React.FC<{ disabled: boolean; onDone: () => void; onClear: () => void }> = ({
  disabled,
  onDone,
  onClear,
}) => (
  <div className="mt-1.5 flex gap-1.5 border-t border-slate-100 pt-1.5">
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-6 flex-1 border-slate-200 px-2.5 text-[10px] hover:bg-slate-50"
      onClick={onClear}
    >
      Clear
    </Button>
    <Button
      type="button"
      size="sm"
      className={`h-6 flex-1 px-2.5 text-[10px] ${LUBES_UI.filterApply}`}
      disabled={disabled}
      onClick={onDone}
    >
      Apply
    </Button>
  </div>
);

const FilterAccordion: React.FC<{
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, count = 0, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={LUBES_UI.filterAccordion}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="text-[11px] font-semibold text-slate-800">{title}</span>
        <span className="flex items-center gap-1.5">
          {count > 0 && (
            <span className={LUBES_UI.filterBadge}>
              {count}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && <div className={LUBES_UI.filterAccordionBody}>{children}</div>}
    </div>
  );
};

const LubesFiltersPopover: React.FC<LubesFiltersPopoverProps> = ({
  open,
  appliedPeriodFilters,
  appliedSegments,
  appliedProductCategories,
  appliedRegionalOfficers,
  appliedSalesAreas,
  periodView,
  periodOptionsByMode,
  segmentOptions,
  productCategoryOptions,
  regionalOfficerOptions,
  salesAreaOptions,
  connectedFiltersLoading,
  onConnectedFiltersDraftChange,
  onApply,
  onClose,
}) => {
  const [draftPeriodFilters, setDraftPeriodFilters] = useState<PeriodFilter[]>([]);
  const [draftPeriodView, setDraftPeriodView] = useState<PeriodViewMode>("month");
  const [pendingSegments, setPendingSegments] = useState<string[]>([]);
  const [draftSegments, setDraftSegments] = useState<string[]>([]);
  const [pendingProductCategories, setPendingProductCategories] = useState<string[]>([]);
  const [draftProductCategories, setDraftProductCategories] = useState<string[]>([]);
  const [pendingRegionalOfficers, setPendingRegionalOfficers] = useState<string[]>([]);
  const [draftRegionalOfficers, setDraftRegionalOfficers] = useState<string[]>([]);
  const [pendingSalesAreas, setPendingSalesAreas] = useState<string[]>([]);
  const [draftSalesAreas, setDraftSalesAreas] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDraftPeriodFilters([...appliedPeriodFilters]);
    setDraftPeriodView(periodView);
    setPendingSegments([...appliedSegments]);
    setDraftSegments([...appliedSegments]);
    setPendingProductCategories([...appliedProductCategories]);
    setDraftProductCategories([...appliedProductCategories]);
    setPendingRegionalOfficers([...appliedRegionalOfficers]);
    setDraftRegionalOfficers([...appliedRegionalOfficers]);
    setPendingSalesAreas([...appliedSalesAreas]);
    setDraftSalesAreas([...appliedSalesAreas]);
  }, [
    open,
    appliedPeriodFilters,
    periodView,
    appliedSegments,
    appliedProductCategories,
    appliedRegionalOfficers,
    appliedSalesAreas,
  ]);

  const connectedFiltersDraft = useMemo<LubesConnectedFilterDraft>(
    () => ({
      companies: [],
      segments: draftSegments,
      productCategories: draftProductCategories,
      regionalOfficers: draftRegionalOfficers,
      salesAreas: draftSalesAreas,
      periodFilters: draftPeriodFilters,
    }),
    [
      draftSegments,
      draftProductCategories,
      draftRegionalOfficers,
      draftSalesAreas,
      draftPeriodFilters,
    ]
  );

  useEffect(() => {
    if (!open) return;
    onConnectedFiltersDraftChange?.(connectedFiltersDraft);
  }, [open, connectedFiltersDraft, onConnectedFiltersDraftChange]);

  const pruneDraftSelection = (prev: string[], options: string[]) => {
    const next = prev.filter((value) => options.includes(value));
    if (next.length === prev.length && next.every((value, index) => value === prev[index])) {
      return prev;
    }
    return next;
  };

  useEffect(() => {
    setDraftSegments((prev) => pruneDraftSelection(prev, segmentOptions));
  }, [segmentOptions]);

  const segmentSelectionDirty = !selectionListsMatch(pendingSegments, draftSegments);
  const productCategorySelectionDirty = !selectionListsMatch(
    pendingProductCategories,
    draftProductCategories
  );
  const regionalOfficerSelectionDirty = !selectionListsMatch(
    pendingRegionalOfficers,
    draftRegionalOfficers
  );
  const salesAreaSelectionDirty = !selectionListsMatch(pendingSalesAreas, draftSalesAreas);

  useEffect(() => {
    setDraftProductCategories((prev) => pruneDraftSelection(prev, productCategoryOptions));
  }, [productCategoryOptions]);

  useEffect(() => {
    setDraftRegionalOfficers((prev) => pruneDraftSelection(prev, regionalOfficerOptions));
  }, [regionalOfficerOptions]);

  useEffect(() => {
    setDraftSalesAreas((prev) => pruneDraftSelection(prev, salesAreaOptions));
  }, [salesAreaOptions]);

  const draftPeriodOptions = periodOptionsByMode[draftPeriodView] ?? [];


  const selectedPeriodIds = useMemo(
    () =>
      draftPeriodFilters
        .filter((filter) => filter.mode === draftPeriodView)
        .map((filter) => filter.id),
    [draftPeriodFilters, draftPeriodView]
  );

  const selectedPeriodIdSet = useMemo(() => new Set(selectedPeriodIds), [selectedPeriodIds]);

  const draftSelectionCount =
    draftPeriodFilters.length +
    pendingSegments.length +
    pendingProductCategories.length +
    pendingRegionalOfficers.length +
    pendingSalesAreas.length;

  const handleDraftPeriodViewChange = (mode: PeriodViewMode) => {
    if (mode === draftPeriodView) return;
    setDraftPeriodView(mode);
    setDraftPeriodFilters([]);
  };

  const toggleDraftPeriod = (id: string) => {
    const filter: PeriodFilter = { mode: draftPeriodView, id };
    setDraftPeriodFilters((prev) => togglePeriodFilterDraft(prev, filter));
  };

  const resetDraftFilters = () => {
    onApply({
      periodFilters: [],
      segments: [],
      productCategories: [],
      regionalOfficers: [],
      salesAreas: [],
    });
  };

  const togglePendingSegments = useCallback((value: string) => {
    setPendingSegments((prev) => toggleListValue(value, prev));
  }, []);

  const togglePendingProductCategories = useCallback((value: string) => {
    setPendingProductCategories((prev) => toggleListValue(value, prev));
  }, []);

  const togglePendingRegionalOfficers = useCallback((value: string) => {
    setPendingRegionalOfficers((prev) => toggleListValue(value, prev));
  }, []);

  const togglePendingSalesAreas = useCallback((value: string) => {
    setPendingSalesAreas((prev) => toggleListValue(value, prev));
  }, []);

  const applyAll = (overrides: Partial<{
    segments: string[];
    productCategories: string[];
    regionalOfficers: string[];
    salesAreas: string[];
  }> = {}) => {
    onApply({
      periodFilters: draftPeriodFilters,
      segments: overrides.segments ?? pendingSegments,
      productCategories: overrides.productCategories ?? pendingProductCategories,
      regionalOfficers: overrides.regionalOfficers ?? pendingRegionalOfficers,
      salesAreas: overrides.salesAreas ?? pendingSalesAreas,
    });
  };

  const handleSegmentDone = () => {
    const committed = [...pendingSegments];
    setDraftSegments(committed);
    applyAll({ segments: committed });
  };
  const handleSegmentClear = () => {
    setPendingSegments([]);
    setDraftSegments([]);
    applyAll({ segments: [] });
  };

  const handleProductCategoryDone = () => {
    const committed = [...pendingProductCategories];
    setDraftProductCategories(committed);
    applyAll({ productCategories: committed });
  };
  const handleProductCategoryClear = () => {
    setPendingProductCategories([]);
    setDraftProductCategories([]);
    applyAll({ productCategories: [] });
  };

  const handleRegionalOfficerDone = () => {
    const committed = [...pendingRegionalOfficers];
    setDraftRegionalOfficers(committed);
    applyAll({ regionalOfficers: committed });
  };
  const handleRegionalOfficerClear = () => {
    setPendingRegionalOfficers([]);
    setDraftRegionalOfficers([]);
    applyAll({ regionalOfficers: [] });
  };

  const handleSalesAreaDone = () => {
    const committed = [...pendingSalesAreas];
    setDraftSalesAreas(committed);
    applyAll({ salesAreas: committed });
  };
  const handleSalesAreaClear = () => {
    setPendingSalesAreas([]);
    setDraftSalesAreas([]);
    applyAll({ salesAreas: [] });
  };

  const loadingNode = (
    <div className="flex items-center gap-1 py-1 text-[10px] text-slate-400">
      <Loader2 className={LUBES_UI.loaderSm} />
      Loading...
    </div>
  );

  return (
    <PopoverContent
      align="end"
      className={`${LUBES_UI.filterPopover} flex max-h-[80dvh] flex-col`}
      onFocusOutside={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2">
        <p className="text-[11px] font-semibold text-slate-800">Filters</p>
        <div className="flex items-center gap-2">
          {draftSelectionCount > 0 && (
            <span className="text-[10px] text-slate-400">{draftSelectionCount} selected</span>
          )}
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">

        {/* Period */}
        <FilterAccordion title="Period" count={draftPeriodFilters.length} defaultOpen>
          <div className={`mb-1.5 flex rounded border border-slate-200 ${LUBES_UI.tabGroup} p-0.5`}>
            {FILTER_PERIOD_VIEW_OPTIONS.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleDraftPeriodViewChange(mode)}
                className={`flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  draftPeriodView === mode ? LUBES_UI.filterModeActive : LUBES_UI.tabIdle
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {draftPeriodOptions.length === 0 ? (
            <p className="text-[10px] text-slate-400">No periods available</p>
          ) : (
            <div
              className={`grid gap-0.5 ${
                draftPeriodView === "month" ? "grid-cols-3" : "grid-cols-2"
              } max-h-24 overflow-y-auto [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent`}
            >
              {draftPeriodOptions.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-1 rounded px-0.5 py-0.5 hover:bg-slate-50"
                >
                  <Checkbox
                    checked={selectedPeriodIdSet.has(item.id)}
                    onCheckedChange={() => toggleDraftPeriod(item.id)}
                    className="h-3 w-3 rounded-[3px]"
                  />
                  <span className="truncate text-[10px] text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>
          )}
        </FilterAccordion>

        {/* Segment */}
        <FilterAccordion title="Segment" count={pendingSegments.length} defaultOpen>
          {connectedFiltersLoading ? loadingNode : segmentOptions.length === 0 ? (
            <p className="text-[10px] text-slate-400">None available</p>
          ) : (
            <>
              <FilterCompactCheckboxGrid
                options={segmentOptions}
                selected={pendingSegments}
                onToggle={togglePendingSegments}
                columns={1}
                maxHeightClass="max-h-24"
                searchable
                searchPlaceholder="Search segment..."
              />
              <FilterSectionDone disabled={!segmentSelectionDirty} onDone={handleSegmentDone} onClear={handleSegmentClear} />
            </>
          )}
        </FilterAccordion>

        {/* Product Category */}
        <FilterAccordion title="Product Category" count={pendingProductCategories.length} defaultOpen>
          {connectedFiltersLoading ? loadingNode : productCategoryOptions.length === 0 ? (
            <p className="text-[10px] text-slate-400">None available</p>
          ) : (
            <>
              <FilterCompactCheckboxGrid
                options={productCategoryOptions}
                selected={pendingProductCategories}
                onToggle={togglePendingProductCategories}
                columns={1}
                maxHeightClass="max-h-24"
                searchable
                searchPlaceholder="Search category..."
              />
              <FilterSectionDone disabled={!productCategorySelectionDirty} onDone={handleProductCategoryDone} onClear={handleProductCategoryClear} />
            </>
          )}
        </FilterAccordion>

        {/* Regional Officer */}
        <FilterAccordion title="Regional Officer" count={pendingRegionalOfficers.length} defaultOpen>
          {connectedFiltersLoading ? loadingNode : regionalOfficerOptions.length === 0 ? (
            <p className="text-[10px] text-slate-400">None available</p>
          ) : (
            <>
              <FilterCompactCheckboxGrid
                options={regionalOfficerOptions}
                selected={pendingRegionalOfficers}
                onToggle={togglePendingRegionalOfficers}
                columns={1}
                maxHeightClass="max-h-24"
                searchable
                searchPlaceholder="Search officer..."
              />
              <FilterSectionDone disabled={!regionalOfficerSelectionDirty} onDone={handleRegionalOfficerDone} onClear={handleRegionalOfficerClear} />
            </>
          )}
        </FilterAccordion>

        {/* Sales Area */}
        <FilterAccordion title="Sales Area" count={pendingSalesAreas.length} defaultOpen>
          {connectedFiltersLoading ? loadingNode : salesAreaOptions.length === 0 ? (
            <p className="text-[10px] text-slate-400">None available</p>
          ) : (
            <>
              <FilterCompactCheckboxGrid
                options={salesAreaOptions}
                selected={pendingSalesAreas}
                onToggle={togglePendingSalesAreas}
                columns={1}
                maxHeightClass="max-h-24"
                searchable
                searchPlaceholder="Search area..."
              />
              <FilterSectionDone disabled={!salesAreaSelectionDirty} onDone={handleSalesAreaDone} onClear={handleSalesAreaClear} />
            </>
          )}
        </FilterAccordion>

      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-100 px-2 py-2 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 flex-1 border-slate-200 text-[11px] hover:bg-slate-50"
          onClick={resetDraftFilters}
        >
          Clear all
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 flex-1 bg-slate-800 text-[11px] text-white hover:bg-slate-900"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </PopoverContent>
  );
};

export default LubesFiltersPopover;
