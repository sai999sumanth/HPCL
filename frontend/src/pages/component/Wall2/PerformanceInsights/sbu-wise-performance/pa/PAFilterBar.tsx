import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { fetchPaFilterOptions } from "./pa.fetchers";
import { EMPTY_PA_FILTERS, paFilterStateToDraft } from "./pa.filters";
import PASearchableSelect from "./PASearchableSelect";
import type { PAFilterOptions, PAFilterState } from "./pa.types";

const PERIOD_OPTIONS = [
  { value: "fy", label: "Full FY" },
  { value: "h1", label: "H1 (Apr–Sep)" },
  { value: "h2", label: "H2 (Oct–Mar)" },
  { value: "q1", label: "Q1" },
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
  { value: "q4", label: "Q4" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

const DIMENSION_FILTERS = [
  { id: "region",    placeholder: "All regions",     optionsKey: "regions"    as const },
  { id: "salesArea", placeholder: "All sales areas", optionsKey: "salesAreas" as const },
  { id: "segment",   placeholder: "All segments",    optionsKey: "segments"   as const },
  { id: "product",   placeholder: "All products",    optionsKey: "products"   as const },
] as const;

type DimensionId = (typeof DIMENSION_FILTERS)[number]["id"];

const EMPTY_OPTIONS: PAFilterOptions = {
  regions: [],
  salesAreas: [],
  segments: [],
  products: [],
};

interface Props {
  currentFY:        string;
  filters:          PAFilterState;
  onFiltersChange:  (filters: PAFilterState) => void;
  onRefresh:        () => void;
  refreshing?:      boolean;
}

const PAFilterBar: React.FC<Props> = ({
  currentFY,
  filters,
  onFiltersChange,
  onRefresh,
  refreshing = false,
}) => {
  const [options, setOptions] = useState<PAFilterOptions>(EMPTY_OPTIONS);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const loadOptions = useCallback(async (fy: string, draft: ReturnType<typeof paFilterStateToDraft>) => {
    const requestId = ++requestIdRef.current;
    setOptionsLoading(true);
    try {
      const next = await fetchPaFilterOptions(fy, draft);
      if (requestId !== requestIdRef.current) return;
      setOptions(next);
    } catch {
      if (requestId === requestIdRef.current) setOptions(EMPTY_OPTIONS);
    } finally {
      if (requestId === requestIdRef.current) setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions(currentFY, paFilterStateToDraft(filters));
  }, [currentFY, filters.region, filters.salesArea, filters.segment, filters.product, loadOptions]);

  const hasActiveFilters = useMemo(
    () => filters.region || filters.salesArea || filters.segment || filters.product || filters.period !== "fy",
    [filters],
  );

  const periodSelectOptions = useMemo(
    () => PERIOD_OPTIONS.map(({ value, label }) => ({ value, label })),
    [],
  );

  const dimensionSelectOptions = useMemo(() => {
    const build = (items: string[], placeholder: string) => [
      { value: "all", label: placeholder },
      ...items.map((item) => ({ value: item, label: item })),
    ];
    return {
      region:    build(options.regions,    "All regions"),
      salesArea: build(options.salesAreas, "All sales areas"),
      segment:   build(options.segments,   "All segments"),
      product:   build(options.products,   "All products"),
    };
  }, [options]);

  const handleReset = () => {
    onFiltersChange({ ...EMPTY_PA_FILTERS });
  };

  const setDimension = (id: DimensionId, value: string) => {
    const next = value === "all" ? "" : value;
    const updated = { ...filters, [id]: next };
    if (id === "region") updated.salesArea = "";
    onFiltersChange(updated);
  };

  const setPeriod = (value: PeriodValue) => {
    onFiltersChange({ ...filters, period: value });
  };

  return (
    <div className="mb-2 flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
      <Filter className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Filter
      </span>
      {optionsLoading && (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" aria-label="Loading filters" />
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {DIMENSION_FILTERS.map(({ id, placeholder, optionsKey }) => {
          const items = options[optionsKey];
          const selectOptions = dimensionSelectOptions[id];

          return (
            <div key={id} className="min-w-0 flex-1">
              <PASearchableSelect
                value={filters[id] || "all"}
                onValueChange={(v) => setDimension(id, v)}
                options={selectOptions}
                placeholder={placeholder}
                disabled={optionsLoading && items.length === 0}
                searchPlaceholder={`Search ${placeholder.toLowerCase()}...`}
              />
            </div>
          );
        })}

        <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-200" />

        <div className="min-w-0 flex-1">
          <PASearchableSelect
            value={filters.period}
            onValueChange={(v) => setPeriod(v as PeriodValue)}
            options={periodSelectOptions}
            placeholder="Full FY"
            searchPlaceholder="Search period..."
          />
        </div>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          title="Clear all filters"
          className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50"
        >
          <X className="h-3 w-3" />
          Reset
        </button>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={refreshing}
        onClick={onRefresh}
        title="Refresh"
        className="h-7 w-7 shrink-0 rounded-md border-slate-200 shadow-none"
      >
        <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
};

export default PAFilterBar;
