import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { Checkbox } from "@/@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/@/components/ui/sheet";
import type {
  CompanySummary,
  PeriodCardItem,
  PeriodViewMode,
  SalesAreaChartRow,
  SalesAreaTableRow,
} from "./lubesSalesPerformance.types";
import {
  calcChangePct,
  formatDifference,
  formatPct,
  formatTmt,
  formatTmtSmart,
  splitChartLabelLines,
} from "./lubesSalesPerformance.utils";
import {
  LUBES_CHART,
  LUBES_METRIC_CARD,
  LUBES_UI,
  lubesBreakdownRowClass,
  lubesGrowthHex,
  lubesGrowthTextClass,
} from "./lubesSalesPerformance.theme";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

export const ghostIconButtonClass = LUBES_UI.ghostBtn;

/** After a user-initiated panel refresh completes, reset selection to the first item only. */
export function useRefreshToFirstSelection(
  refreshing: boolean,
  firstKey: string | undefined,
  onSelectFirst: (key: string | null) => void,
  userInitiatedRef?: React.MutableRefObject<boolean>
) {
  const wasRefreshingRef = useRef(false);

  useEffect(() => {
    if (refreshing) {
      wasRefreshingRef.current = true;
      return;
    }
    if (!wasRefreshingRef.current) return;
    wasRefreshingRef.current = false;
    if (userInitiatedRef && !userInitiatedRef.current) return;
    if (userInitiatedRef) userInitiatedRef.current = false;
    onSelectFirst(firstKey ?? null);
  }, [refreshing, firstKey, onSelectFirst, userInitiatedRef]);
}

/** Table row selection for breakdown charts; resets to the first row after refresh. */
export function useBreakdownRowSelection(
  names: string[],
  refreshing: boolean
): [string[], (name: string) => void] {
  const [selected, setSelected] = useState<string[]>([]);
  const wasRefreshingRef = useRef(false);
  const namesKey = names.join("\u0000");

  useEffect(() => {
    if (refreshing) {
      wasRefreshingRef.current = true;
    }
  }, [refreshing]);

  useEffect(() => {
    if (names.length === 0) {
      setSelected((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    if (wasRefreshingRef.current && !refreshing) {
      wasRefreshingRef.current = false;
      const first = names[0];
      setSelected((prev) =>
        prev.length === 1 && prev[0] === first ? prev : [first]
      );
      return;
    }

    setSelected((prev) => {
      const valid = prev.filter((name) => names.includes(name));
      if (valid.length > 0) {
        if (
          valid.length === prev.length &&
          valid.every((name, index) => name === prev[index])
        ) {
          return prev;
        }
        return valid;
      }
      const first = names[0];
      return prev.length === 1 && prev[0] === first ? prev : [first];
    });
    // namesKey tracks content; omit `names` to avoid re-running on unstable array refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey, refreshing]);

  const toggle = useCallback((name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev;
        return prev.filter((entry) => entry !== name);
      }
      return [...prev, name];
    });
  }, []);

  return [selected, toggle];
}

const horizontalScrollClass =
  "min-w-0 flex-1 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type MetricCardVariant = "company" | "period" | "segment";

export const PerformanceMetricCard: React.FC<{
  title: string;
  highlighted?: boolean;
  current: number;
  hist: number;
  pct: number;
  difference: number;
  variant?: MetricCardVariant;
  increaseHeight?: boolean;
  onClick?: () => void;
}> = ({
  title,
  highlighted = false,
  current,
  hist,
  pct,
  difference,
  variant = "company",
  increaseHeight = false,
  onClick,
}) => {
  const isProfit = difference > 0;
  const isLoss = difference < 0;
  const isFlat = difference === 0;
  const isCompact = variant === "period" || variant === "segment";

  const baseClass = onClick
    ? `cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${LUBES_METRIC_CARD.focusRing}`
    : "";

  const surfaceClass = highlighted
    ? isProfit || isFlat
      ? LUBES_METRIC_CARD.highlightProfit
      : LUBES_METRIC_CARD.highlightLoss
    : isFlat
      ? LUBES_METRIC_CARD.flat
      : isProfit
        ? LUBES_METRIC_CARD.profit
        : LUBES_METRIC_CARD.loss;

  const titleClass = highlighted ? "text-white/90" : "text-slate-600";
  const pctClass = highlighted
    ? "text-white"
    : isFlat
      ? "text-slate-600"
      : isProfit
        ? LUBES_METRIC_CARD.pctProfit
        : LUBES_METRIC_CARD.pctLoss;
  const labelClass = highlighted ? "text-white/60" : "text-slate-400";
  const valueClass = highlighted ? "text-white" : "text-slate-900";
  const histValueClass = highlighted ? "text-white/75" : "text-slate-500";
  const diffClass = highlighted
    ? "text-white/90"
    : isFlat
      ? "text-slate-500"
      : isProfit
        ? LUBES_METRIC_CARD.diffProfit
        : LUBES_METRIC_CARD.diffLoss;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${title} · Curr ${formatTmt(current)} · Hist ${formatTmt(hist)} · Growth ${formatPct(pct)} · Diff ${formatDifference(difference)}`}
      className={[
        "group w-full rounded-lg border text-left",
        isCompact && increaseHeight ? "p-3" : isCompact ? "p-1.5" : "p-2.5",
        baseClass,
        surfaceClass,
      ].join(" ")}
    >
      <div className={`flex items-start justify-between gap-1 ${isCompact && increaseHeight ? "mb-2" : isCompact ? "mb-1" : "mb-1.5"}`}>
        <span
          className={`truncate font-bold uppercase tracking-wide ${
            isCompact && increaseHeight ? "text-[12px]" : isCompact ? "text-[11px]" : "text-sm"
          } ${titleClass}`}
        >
          {title}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-extrabold tabular-nums ${
            isCompact && increaseHeight ? "text-[11px]" : isCompact ? "text-[10px]" : "text-xs"
          } ${
            highlighted
              ? "bg-white/15"
              : isProfit
                ? LUBES_METRIC_CARD.badgeProfit
                : isLoss
                  ? LUBES_METRIC_CARD.badgeLoss
                  : "bg-slate-100 text-slate-600"
          } ${diffClass}`}
        >
          {!highlighted && isProfit && <TrendingUp className={isCompact && increaseHeight ? "h-3.5 w-3.5" : "h-3 w-3"} />}
          {!highlighted && isLoss && <TrendingDown className={isCompact && increaseHeight ? "h-3.5 w-3.5" : "h-3 w-3"} />}
          {formatDifference(difference)}
        </span>
      </div>

      {/* For company variant with narrower width, stack vertically */}
      <div className={`${variant === "company" ? "flex flex-col gap-1.5" : `grid grid-cols-3 ${isCompact && increaseHeight ? "gap-2" : isCompact ? "gap-1" : "gap-1.5"}`}`}>
        <div className="min-w-0">
          <p className={`font-semibold uppercase tracking-wider ${isCompact && increaseHeight ? "text-[10px]" : isCompact ? "text-[9px]" : "text-[10px]"} ${labelClass}`}>
            Curr
          </p>
          <p
            className={`mt-0.5 truncate font-bold tabular-nums ${isCompact && increaseHeight ? "text-sm" : isCompact ? "text-xs" : "text-sm"} ${valueClass}`}
            title={formatTmt(current)}
          >
            {formatTmtSmart(current)}
          </p>
        </div>
        <div className="min-w-0">
          <p className={`font-semibold uppercase tracking-wider ${isCompact && increaseHeight ? "text-[10px]" : isCompact ? "text-[9px]" : "text-[10px]"} ${labelClass}`}>
            Hist
          </p>
          <p
            className={`mt-0.5 truncate font-semibold tabular-nums ${isCompact && increaseHeight ? "text-sm" : isCompact ? "text-xs" : "text-sm"} ${histValueClass}`}
            title={formatTmt(hist)}
          >
            {formatTmtSmart(hist)}
          </p>
        </div>
        <div className="min-w-0">
          <p className={`font-semibold uppercase tracking-wider ${isCompact && increaseHeight ? "text-[10px]" : isCompact ? "text-[9px]" : "text-[10px]"} ${labelClass}`}>
            Growth %
          </p>
          <p
            className={`mt-0.5 truncate font-semibold tabular-nums ${isCompact && increaseHeight ? "text-[11px]" : isCompact ? "text-[10px]" : "text-sm"} ${pctClass}`}
          >
            {formatPct(pct)}
          </p>
        </div>
      </div>
    </button>
  );
};

export const PeriodSummaryCard: React.FC<{
  item: PeriodCardItem;
  highlighted?: boolean;
  onClick?: () => void;
  variant?: "period" | "segment";
  increaseHeight?: boolean;
}> = ({ item, highlighted = false, onClick, variant = "period", increaseHeight = false }) => {
  const difference = item.compare.current - item.compare.hist;
  return (
    <PerformanceMetricCard
      title={item.label}
      highlighted={highlighted}
      current={item.compare.current}
      hist={item.compare.hist}
      pct={item.compare.pct}
      difference={difference}
      variant={variant}
      increaseHeight={increaseHeight}
      onClick={onClick}
    />
  );
};

export const ScrollableMetricCards: React.FC<{
  items: PeriodCardItem[];
  cardWidthClass?: string;
  highlightedIds: string[];
  onToggle: (id: string) => void;
  variant?: "period" | "segment";
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollState: { left: boolean; right: boolean };
  onScroll: (direction: "left" | "right") => void;
}> = ({
  items,
  cardWidthClass = "w-[180px] shrink-0 sm:w-[200px] md:w-[220px]",
  highlightedIds,
  onToggle,
  variant = "period",
  scrollRef,
  scrollState,
  onScroll,
}) => (
  <div className="flex w-full items-center gap-0.5">
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Scroll left"
      disabled={!scrollState.left}
      onClick={() => onScroll("left")}
      className={ghostIconButtonClass}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <div ref={scrollRef} className={horizontalScrollClass}>
      <div className="flex w-max min-w-full gap-2">
        {items.map((item) => (
          <div key={item.id} className={cardWidthClass}>
            <PeriodSummaryCard
              item={item}
              highlighted={highlightedIds.includes(item.id)}
              onClick={() => onToggle(item.id)}
              variant={variant}
            />
          </div>
        ))}
      </div>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Scroll right"
      disabled={!scrollState.right}
      onClick={() => onScroll("right")}
      className={ghostIconButtonClass}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);

export const periodCardsGridClass = (mode: PeriodViewMode) => {
  if (mode === "half") return "grid grid-cols-1 gap-2 sm:grid-cols-2";
  return "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4";
};

export const PERIOD_VIEW_OPTIONS: { mode: PeriodViewMode; label: string }[] = [
  { mode: "month", label: "Month" },
  { mode: "quarter", label: "Quarter" },
  { mode: "half", label: "Half Year" },
];

export const FILTER_PERIOD_VIEW_OPTIONS: { mode: PeriodViewMode; label: string }[] = [
  { mode: "month", label: "Month" },
  { mode: "quarter", label: "Quarter" },
  { mode: "half", label: "Half" },
];

export const FilterPopoverSection: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, action, children, className = "" }) => (
  <div className={className}>
    <div className="mb-1 flex items-center justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {action}
    </div>
    {children}
  </div>
);

export const BreakdownTableSearch: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = "Search..." }) => (
  <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5">
    <Search className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-slate-400"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

const BreakdownTableRows: React.FC<{
  rows: SalesAreaTableRow[];
  nameColumnLabel: string;
  selectedSet: Set<string>;
  onRowClick?: (name: string) => void;
  nameColumnClass: string;
}> = ({ rows, nameColumnLabel, selectedSet, onRowClick, nameColumnClass }) => (
  <table className="w-full text-left text-[11px]">
    <thead className={LUBES_UI.breakdownTableHead}>
      <tr>
        <th className="px-2 py-1.5 font-semibold">{nameColumnLabel}</th>
        <th className="px-2 py-1.5 text-right font-semibold">Curr</th>
        <th className="px-2 py-1.5 text-right font-semibold">Hist</th>
        <th className="px-2 py-1.5 text-right font-semibold">Growth %</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 ? (
        <tr>
          <td colSpan={4} className="px-2 py-4 text-center text-slate-400">No matches</td>
        </tr>
      ) : (
        rows.map((row) => {
          const isSelected = selectedSet.has(row.name);
          return (
            <tr
              key={row.name}
              title={`${row.name} · Curr ${formatTmt(row.current)} · Hist ${formatTmt(row.hist)}`}
              onClick={onRowClick ? () => onRowClick(row.name) : undefined}
              className={[lubesBreakdownRowClass(isSelected), onRowClick ? "cursor-pointer" : ""].join(" ")}
            >
              <td className={`truncate px-2 py-1.5 font-medium text-slate-800 ${nameColumnClass}`}>{row.name}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-900">{formatTmtSmart(row.current)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-500">{formatTmtSmart(row.hist)}</td>
              <td className={`whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums ${lubesGrowthTextClass(row.pct)}`}>{formatPct(row.pct)}</td>
            </tr>
          );
        })
      )}
    </tbody>
  </table>
);

export const BreakdownCompareTable: React.FC<{
  title: string;
  nameColumnLabel: string;
  rows: SalesAreaTableRow[];
  footer: string;
  selected?: string[];
  onRowClick?: (name: string) => void;
  maxHeightClass?: string;
  nameColumnClass?: string;
}> = ({
  title,
  nameColumnLabel,
  rows,
  footer,
  selected = [],
  onRowClick,
  maxHeightClass = "max-h-[220px] sm:max-h-[260px] md:max-h-[280px]",
  nameColumnClass = LUBES_UI.breakdownTableNameCol,
}) => {
  const [search, setSearch] = useState("");
  const [sheetSearch, setSheetSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(query));
  }, [rows, search]);

  const sheetFilteredRows = useMemo(() => {
    const query = sheetSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(query));
  }, [rows, sheetSearch]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <>
      <div className={LUBES_UI.breakdownTable}>
        <div className={`${LUBES_UI.breakdownTableBar} flex items-center gap-2`}>
          <p className={`${LUBES_UI.breakdownTableBarTitle} shrink-0`}>{title}</p>
          <BreakdownTableSearch value={search} onChange={setSearch} />
          <button
            type="button"
            aria-label="Expand table"
            onClick={() => { setSheetSearch(""); setSheetOpen(true); }}
            className="ml-auto shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className={`${maxHeightClass} overflow-y-auto [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent`}>
          <BreakdownTableRows rows={filteredRows} nameColumnLabel={nameColumnLabel} selectedSet={selectedSet} onRowClick={onRowClick} nameColumnClass={nameColumnClass} />
        </div>
        <p className={LUBES_UI.breakdownTableFooter}>{footer}</p>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-[90vw] max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-slate-100 px-4 py-3">
            <SheetTitle className="text-sm font-semibold text-slate-800">{title}</SheetTitle>
          </SheetHeader>
          <div className="border-b border-slate-100 px-3 py-2">
            <BreakdownTableSearch value={sheetSearch} onChange={setSheetSearch} />
          </div>
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
            <BreakdownTableRows rows={sheetFilteredRows} nameColumnLabel={nameColumnLabel} selectedSet={selectedSet} onRowClick={(name) => { onRowClick?.(name); }} nameColumnClass={nameColumnClass} />
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">{footer} · {sheetFilteredRows.length} row{sheetFilteredRows.length === 1 ? "" : "s"}</p>
        </SheetContent>
      </Sheet>
    </>
  );
};

export const FilterSectionSearch: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = "Search...", className = "" }) => (
  <div
    className={`mb-1.5 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 ${className}`}
  >
    <Search className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-[11px] outline-none placeholder:text-slate-400"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

export const FilterCompactCheckboxGrid: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  columns?: 1 | 2 | 3;
  maxHeightClass?: string;
  getLabel?: (value: string) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
}> = React.memo(({
  options,
  selected,
  onToggle,
  columns = 2,
  maxHeightClass = "max-h-24",
  getLabel = (value) => value,
  searchable = false,
  searchPlaceholder = "Search...",
}) => {
  const [search, setSearch] = React.useState("");
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const isScrollable = maxHeightClass !== "max-h-none";

  const filteredOptions = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!searchable || !query) return options;
    return options.filter((option) => getLabel(option).toLowerCase().includes(query));
  }, [options, searchable, search, getLabel]);

  return (
    <div>
      {searchable && (
        <FilterSectionSearch
          value={search}
          onChange={setSearch}
          placeholder={searchPlaceholder}
        />
      )}
      {filteredOptions.length === 0 ? (
        <p className="py-1 text-[11px] text-slate-400">
          {searchable && search.trim() ? "No matches found" : "No options available"}
        </p>
      ) : (
        <div
          className={`grid ${
            columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-3" : "grid-cols-2"
          } gap-x-1.5 gap-y-0.5 ${isScrollable ? "overflow-y-auto pr-0.5 [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent" : ""} ${maxHeightClass}`}
        >
          {filteredOptions.map((option) => (
            <label
              key={option}
              title={getLabel(option)}
              className="flex min-w-0 cursor-pointer items-center gap-1 rounded px-0.5 py-0.5 hover:bg-slate-50"
            >
              <Checkbox
                checked={selectedSet.has(option)}
                onCheckedChange={() => onToggle(option)}
                className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
              />
              <span className="truncate text-[11px] leading-tight text-slate-700">
                {getLabel(option)}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
});

FilterCompactCheckboxGrid.displayName = "FilterCompactCheckboxGrid";

export const FilterOptionsLoader: React.FC = () => (
  <div className="flex items-center gap-1.5 py-1 text-[11px] text-slate-500">
    <Loader2 className={LUBES_UI.loaderSm} />
    Loading...
  </div>
);

export const CompanySummaryCard: React.FC<{
  summary: CompanySummary;
  highlighted?: boolean;
  onClick?: () => void;
}> = ({ summary, highlighted = false, onClick }) => {
  const pct = calcChangePct(summary.currentFyTotal, summary.previousFyTotal);
  const difference = summary.difference;
  const isProfit = difference > 0;
  const isLoss = difference < 0;
  const isFlat = difference === 0;

  // Surface classes
  const surfaceClass = highlighted
    ? isProfit || isFlat
      ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-600"
      : "bg-gradient-to-br from-rose-500 to-rose-600 text-white border-rose-600"
    : isFlat
      ? "bg-slate-50 border-slate-200 text-slate-900"
      : isProfit
        ? "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200"
        : "bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200";

  // Text colors
  const titleClass = highlighted ? "text-white" : "text-slate-700";
  const labelClass = highlighted ? "text-white/70" : "text-slate-500";
  const valueClass = highlighted ? "text-white" : "text-slate-900";
  const histValueClass = highlighted ? "text-white/80" : "text-slate-600";
  const pctClass = highlighted
    ? "text-white"
    : isProfit
      ? "text-emerald-700"
      : "text-rose-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-xl border-2 p-4 text-left ${onClick ? "cursor-pointer" : ""} ${surfaceClass}`}
    >
      {/* Company Name */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={`truncate text-sm font-extrabold uppercase tracking-wide ${titleClass}`}>
          {summary.company}
        </span>
      </div>

      {/* Current Value - Large Display */}
      <div className="mb-3">
        <p className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
          Current FY
        </p>
        <p className={`text-2xl font-extrabold tabular-nums ${valueClass}`}>
          {formatTmtSmart(summary.currentFyTotal)}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelClass}`}>
            Previous FY
          </p>
          <p className={`text-sm font-bold tabular-nums ${histValueClass}`}>
            {formatTmtSmart(summary.previousFyTotal)}
          </p>
        </div>

        <div className="text-right">
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelClass}`}>
            Change
          </p>
          <div className="flex items-center justify-end gap-1">
            {isProfit && !highlighted && <TrendingUp className="h-3 w-3 text-emerald-600" />}
            {isLoss && !highlighted && <TrendingDown className="h-3 w-3 text-rose-600" />}
            <p className={`text-sm font-extrabold tabular-nums ${pctClass}`}>
              {formatDifference(difference)}
            </p>
          </div>
        </div>
      </div>

      {/* Growth Percentage Badge */}
      <div className="mt-3 flex justify-center">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold tabular-nums ${highlighted ? "bg-white/20" : isProfit ? "bg-emerald-100 text-emerald-700" : isLoss ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
          {formatPct(pct)}
        </span>
      </div>
    </button>
  );
};

export const PanelShell: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  fillHeight?: boolean;
  compact?: boolean;
  denseHeader?: boolean;
}> = ({
  icon,
  title,
  subtitle,
  action,
  children,
  className = "",
  fillHeight = false,
  compact = false,
  denseHeader = false,
}) => (
  <Card
    className={`${LUBES_UI.panel} ${fillHeight ? "flex h-full min-h-0 flex-col" : ""} ${className}`}
  >
    <CardHeader
      className={
        compact || denseHeader
          ? "shrink-0 border-b border-slate-100 bg-white px-2 py-1.5 sm:px-2.5"
          : LUBES_UI.panelHeader
      }
    >
      {denseHeader ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className={LUBES_UI.panelIcon}>
              {icon}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <CardTitle className={LUBES_UI.panelTitle}>
                {title}
              </CardTitle>
              {subtitle ? (
                <p className="truncate text-[11px] leading-tight text-slate-500">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {action ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {action}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className={LUBES_UI.panelIcon}>
                {icon}
              </div>
              <CardTitle className={LUBES_UI.panelTitle}>
                {title}
              </CardTitle>
            </div>
            {action ? (
              <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
                {action}
              </div>
            ) : null}
          </div>
          {subtitle ? (
            <p className={compact ? "truncate pl-9 text-[11px] leading-tight text-slate-500" : LUBES_UI.panelSubtitle}>{subtitle}</p>
          ) : null}
        </>
      )}
    </CardHeader>
    <CardContent
      className={`${compact ? "p-1.5 pb-1 sm:px-2 sm:pt-1.5 sm:pb-1" : "p-2 sm:p-2"} ${fillHeight ? "flex min-h-0 flex-1 flex-col" : ""}`}
    >
      {children}
    </CardContent>
  </Card>
);

export const LoadingBlock: React.FC<{ label?: string; fill?: boolean }> = ({
  label = "Loading data...",
  fill = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-1.5 text-sm text-slate-500 ${
      fill ? "min-h-[10rem] flex-1 py-12" : "py-8"
    }`}
  >
    <Loader2 className={LUBES_UI.loader} />
    {label}
  </div>
);

export function useHorizontalScroll(
  deps: React.DependencyList,
  enabled = true
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    const syncScrollState = () => {
      requestAnimationFrame(updateScrollState);
    };

    syncScrollState();
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", syncScrollState);

    const observer = new ResizeObserver(syncScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", syncScrollState);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, updateScrollState, ...deps]);

  return { scrollRef, scrollState, scroll };
}

export const withBreakdownChartPct = (rows: SalesAreaChartRow[]): SalesAreaTableRow[] =>
  rows.map((row) => ({
    ...row,
    pct: calcChangePct(row.current, row.hist),
  }));

type BreakdownChartLabelProps = {
  x?: number;
  y?: number;
  width?: number;
  payload?: SalesAreaTableRow;
  dataKey?: string | number;
};

export const BreakdownChartGrowthLabel: React.FC<BreakdownChartLabelProps> = ({
  x,
  y,
  width,
  payload,
  dataKey,
}) => {
  if (x == null || y == null || width == null || !payload) return null;
  if (dataKey !== "current") return null;

  const pct = payload.pct ?? calcChangePct(payload.current, payload.hist);
  if (!Number.isFinite(pct)) return null;

  const color = lubesGrowthHex(pct);
  const centerX = x + width / 2;

  return (
    <text
      x={centerX}
      y={y - 8}
      fill={color}
      textAnchor="middle"
      fontSize={10}
      fontWeight={600}
    >
      {formatPct(pct)}
    </text>
  );
};

export const BreakdownCompareChartTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    name?: string;
    value?: number;
    color?: string;
    payload?: SalesAreaTableRow;
  }>;
  label?: string;
  currentLabel: string;
  histLabel: string;
}> = ({ active, payload, label, currentLabel, histLabel }) => {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const pct = row.pct ?? calcChangePct(row.current, row.hist);
  const pctColor = lubesGrowthHex(pct);
  const title = label ?? row.name;

  return (
    <div className="min-w-[10rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 border-b border-slate-100 pb-1 font-semibold text-slate-800">
        {title}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: LUBES_CHART.current }}
            />
            {currentLabel}
          </span>
          <span className="font-semibold tabular-nums text-slate-900">
            {formatTmt(row.current)} TMT
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: LUBES_CHART.hist }}
            />
            {histLabel}
          </span>
          <span className="font-semibold tabular-nums text-slate-700">
            {formatTmt(row.hist)} TMT
          </span>
        </div>
        <div className=" flex items-center justify-between gap-4 border-t border-slate-100 pt-1">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <svg width="12" height="6" aria-hidden="true" className="shrink-0">
              <line
                x1="0"
                y1="3"
                x2="12"
                y2="3"
                stroke={LUBES_CHART.growthLine}
                strokeWidth="2"
                strokeDasharray="2 2"
              />
            </svg>
            Growth %
          </span>
          <span className="font-bold tabular-nums" style={{ color: pctColor }}>
            {formatPct(pct)}
          </span>
        </div>
      </div>
    </div>
  );
};

const BreakdownGrowthLineDot: React.FC<{
  cx?: number;
  cy?: number;
  payload?: SalesAreaTableRow;
}> = ({ cx, cy, payload }) => {
  if (cx == null || cy == null || !payload) return null;

  const pct = payload.pct ?? calcChangePct(payload.current, payload.hist);
  const fill = lubesGrowthHex(pct);

  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="transparent" />
      <circle cx={cx} cy={cy} r={3.5} fill={fill} stroke="#fff" strokeWidth={1.5} />
    </g>
  );
};

const BreakdownGrowthLineActiveDot: React.FC<{
  cx?: number;
  cy?: number;
  payload?: SalesAreaTableRow;
}> = ({ cx, cy, payload }) => {
  if (cx == null || cy == null || !payload) return null;

  const pct = payload.pct ?? calcChangePct(payload.current, payload.hist);
  const fill = lubesGrowthHex(pct);

  return (
    <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={2} />
  );
};

function getBreakdownValDomain(data: SalesAreaTableRow[]): [number, number] {
  const values = data
    .flatMap((row) => [row.current, row.hist])
    .filter(Number.isFinite);
  if (values.length === 0) return [0, 10];

  const max = Math.max(...values, 0);
  return [0, max <= 0 ? 10 : Math.ceil(max * 1.08)];
}

function getBreakdownPctDomain(data: SalesAreaTableRow[]): [number, number] {
  const values = data.map((row) => row.pct).filter(Number.isFinite);
  if (values.length === 0) return [-10, 10];

  const minPct = Math.min(...values);
  const maxPct = Math.max(...values);
  const padding = 5;
  return [Math.floor(minPct - padding), Math.ceil(maxPct + padding)];
}

export const BreakdownChartLegend: React.FC<{
  displayCurrentFY: string;
  displayPreviousFY: string;
  className?: string;
}> = ({ displayCurrentFY, displayPreviousFY, className = "mb-2" }) => (
  <div className={`${className} flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600`}>
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: LUBES_CHART.current }}
      />
      Curr ({displayCurrentFY})
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: LUBES_CHART.hist }}
      />
      Hist ({displayPreviousFY})
    </span>
    <span className="inline-flex items-center gap-1.5">
      <svg width="16" height="8" aria-hidden="true">
        <line
          x1="0"
          y1="4"
          x2="16"
          y2="4"
          stroke={LUBES_CHART.growthLine}
          strokeWidth="2"
          strokeDasharray="3 2"
        />
      </svg>
      Growth %
    </span>
  </div>
);

const BreakdownChartXAxisTick: React.FC<{
  x?: number;
  y?: number;
  payload?: { value: string };
  maxCharsPerLine?: number;
}> = ({ x = 0, y = 0, payload, maxCharsPerLine = 14 }) => {
  const [line1, line2] = splitChartLabelLines(payload?.value ?? "", maxCharsPerLine);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={8}
        textAnchor="middle"
        fill={LUBES_CHART.axis}
        fontSize={9}
      >
        {line1}
        {line2 ? (
          <tspan x={0} dy={11}>
            {line2}
          </tspan>
        ) : null}
      </text>
    </g>
  );
};

export const BreakdownCompareChart: React.FC<{
  data: SalesAreaTableRow[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  onBarClick?: (row: SalesAreaTableRow) => void;
  scrollable?: boolean;
}> = ({ data, displayCurrentFY, displayPreviousFY, onBarClick, scrollable = false }) => {
  const valDomain = React.useMemo(() => getBreakdownValDomain(data), [data]);
  const pctDomain = React.useMemo(() => getBreakdownPctDomain(data), [data]);

  const handleChartClick = (state: { activePayload?: Array<{ payload?: SalesAreaTableRow }> }) => {
    if (!onBarClick) return;
    const row = state.activePayload?.[0]?.payload;
    if (row) onBarClick(row);
  };

  const barSlotWidth = scrollable ? 104 : 48;
  const needsHorizontalScroll = scrollable;
  const chartWidth = Math.max(scrollable ? 560 : 320, data.length * barSlotWidth);
  const chartHeight = scrollable ? 332 : undefined;
  const xAxisHeight = 34;
  const labelMaxCharsPerLine = scrollable ? 14 : data.length <= 3 ? 16 : 14;

  const chart = (
    <ComposedChart
      data={data}
      width={needsHorizontalScroll ? chartWidth : undefined}
      height={needsHorizontalScroll ? chartHeight : undefined}
      margin={{ top: 18, right: 8, left: 0, bottom: 0 }}
      barGap={2}
      barCategoryGap={scrollable ? "18%" : "18%"}
      onClick={onBarClick ? handleChartClick : undefined}
      style={onBarClick ? { cursor: "pointer" } : undefined}
    >
      <CartesianGrid strokeDasharray="3 3" stroke={LUBES_CHART.grid} vertical={false} />
      <XAxis
        dataKey="name"
        interval={0}
        height={xAxisHeight}
        tickMargin={2}
        axisLine={false}
        tickLine={false}
        tick={(props) => (
          <BreakdownChartXAxisTick
            {...props}
            maxCharsPerLine={labelMaxCharsPerLine}
          />
        )}
      />
        <YAxis
          yAxisId="val"
          domain={valDomain}
          allowDataOverflow
          tick={{ fill: LUBES_CHART.axis, fontSize: 11 }}
          tickFormatter={(value: number) => formatTmtSmart(value)}
          width={64}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={pctDomain}
          allowDataOverflow
          tick={{ fill: LUBES_CHART.axis, fontSize: 10 }}
          tickFormatter={(value: number) => `${value}%`}
          width={40}
          axisLine={false}
          tickLine={false}
        />
        <RechartsTooltip
          shared
          content={
            <BreakdownCompareChartTooltip
              currentLabel={`Curr (${displayCurrentFY})`}
              histLabel={`Hist (${displayPreviousFY})`}
            />
          }
          cursor={{ stroke: LUBES_CHART.cursor, strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Bar
          yAxisId="val"
          dataKey="current"
          name={`Curr (${displayCurrentFY})`}
          fill={LUBES_CHART.current}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        >
          <LabelList content={<BreakdownChartGrowthLabel />} />
        </Bar>
        <Bar
          yAxisId="val"
          dataKey="hist"
          name={`Hist (${displayPreviousFY})`}
          fill={LUBES_CHART.hist}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Line
          yAxisId="pct"
          type="linear"
          dataKey="pct"
          name="Growth %"
          stroke={LUBES_CHART.growthLine}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={<BreakdownGrowthLineDot />}
          activeDot={<BreakdownGrowthLineActiveDot />}
        />
      </ComposedChart>
  );

  if (needsHorizontalScroll) {
    return (
      <div className="h-full min-h-0 overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
        <div className="h-full" style={{ width: chartWidth, minHeight: chartHeight }}>
          {chart}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-0 overflow-visible">
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  );
};
