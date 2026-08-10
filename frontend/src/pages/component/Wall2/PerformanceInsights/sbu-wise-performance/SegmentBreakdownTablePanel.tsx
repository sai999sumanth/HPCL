import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Maximize2, RefreshCw, Table2 } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type { SegmentPivotCell, SegmentPivotTableData } from "./lubesSalesPerformance.types";
import {
  BreakdownTableSearch,
  ghostIconButtonClass,
  LoadingBlock,
  PanelShell,
} from "./lubesSalesPerformance.shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/@/components/ui/sheet";
import {
  buildLubesSegmentTableYtdPayload,
  buildSegmentPivotTable,
  formatShortFiscalYear,
  formatTmtSmart,
  mapLubesSegmentOfficerRows,
  normalizeAggregationRows,
} from "./lubesSalesPerformance.utils";
import { LUBES_UI, lubesGrowthTextClass } from "./lubesSalesPerformance.theme";
import { apiClient } from "@/services/apiClient";

export type SegmentBreakdownTablePanelProps = {
  loading: boolean;
  refreshing: boolean;
  pivotTable: SegmentPivotTableData;
  displayCurrentFY: string;
  displayPreviousFY: string;
  ytdActive: boolean;
  ytdExtraFilters?: Record<string, string[]>;
  ytdExtraFiltersKey?: string;
  onYtdChange: (active: boolean) => void;
  onRefresh: () => void;
};

const SEGMENT_HEADER_COLORS: Record<string, { header: string; sub: string; cell: string }> = {
  MCO: {
    header: "bg-emerald-200 text-emerald-900",
    sub: "bg-emerald-100 text-emerald-800",
    cell: "bg-emerald-50/40",
  },
  PCMO: {
    header: "bg-sky-200 text-sky-900",
    sub: "bg-sky-100 text-sky-800",
    cell: "bg-sky-50/40",
  },
  DEO: {
    header: "bg-cyan-200 text-cyan-900",
    sub: "bg-cyan-100 text-cyan-800",
    cell: "bg-cyan-50/40",
  },
  "GO/ATF/WB": {
    header: "bg-orange-200 text-orange-900",
    sub: "bg-orange-100 text-orange-800",
    cell: "bg-orange-50/40",
  },
  OTHERS: {
    header: "bg-slate-200 text-slate-800",
    sub: "bg-slate-100 text-slate-700",
    cell: "bg-slate-50/40",
  },
  DEF: {
    header: "bg-rose-200 text-rose-900",
    sub: "bg-rose-100 text-rose-800",
    cell: "bg-rose-50/40",
  },
};

const FALLBACK_SEGMENT_COLORS = [
  {
    header: "bg-violet-200 text-violet-900",
    sub: "bg-violet-100 text-violet-800",
    cell: "bg-violet-50/40",
  },
  {
    header: "bg-teal-200 text-teal-900",
    sub: "bg-teal-100 text-teal-800",
    cell: "bg-teal-50/40",
  },
  {
    header: "bg-amber-200 text-amber-900",
    sub: "bg-amber-100 text-amber-800",
    cell: "bg-amber-50/40",
  },
];

const TOTAL_COLORS = {
  header: "bg-slate-300 text-slate-900",
  sub: "bg-slate-200 text-slate-800",
  cell: "bg-slate-50/60",
  row: "bg-slate-100 text-slate-800",
};

const REGION_COLUMN_CLASS =
  "sticky left-0 min-w-[180px] w-[180px] max-w-[180px] border-r border-slate-200 px-2 py-1.5";

const getSegmentColors = (segment: string, index: number) => {
  const key = segment.toUpperCase();
  return (
    SEGMENT_HEADER_COLORS[segment] ??
    SEGMENT_HEADER_COLORS[key] ??
    FALLBACK_SEGMENT_COLORS[index % FALLBACK_SEGMENT_COLORS.length]
  );
};

const formatPivotValue = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return "0";
  return formatTmtSmart(value);
};

const formatPivotPct = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : ""}${rounded}`;
};

const PivotMetricCells: React.FC<{
  cell: SegmentPivotCell;
  cellClass: string;
  isTotalRow?: boolean;
}> = ({ cell, cellClass, isTotalRow = false }) => {
  const pctClass = lubesGrowthTextClass(cell.pct);

  return (
    <>
      <td
        className={`whitespace-nowrap px-1.5 py-1 text-center tabular-nums transition-colors group-hover:bg-slate-200/80 ${cellClass} ${
          isTotalRow ? "font-semibold text-slate-800" : "text-slate-900"
        }`}
      >
        {formatPivotValue(cell.current)}
      </td>
      <td
        className={`whitespace-nowrap px-1.5 py-1 text-center tabular-nums transition-colors group-hover:bg-slate-200/80 ${cellClass} ${
          isTotalRow ? "font-semibold text-slate-600" : "text-slate-600"
        }`}
      >
        {formatPivotValue(cell.hist)}
      </td>
      <td
        className={`whitespace-nowrap px-1.5 py-1 text-center font-semibold tabular-nums transition-colors group-hover:bg-slate-200/80 ${cellClass} ${pctClass}`}
      >
        {formatPivotPct(cell.pct)}
      </td>
    </>
  );
};

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const EMPTY_PIVOT: SegmentPivotTableData = {
  segments: [],
  rows: [],
  segmentTotals: {},
  grandTotal: { current: 0, hist: 0, pct: 0 },
};

const SegmentBreakdownTablePanel: React.FC<SegmentBreakdownTablePanelProps> = ({
  loading,
  refreshing,
  pivotTable,
  displayCurrentFY,
  displayPreviousFY,
  ytdActive,
  ytdExtraFilters = {},
  ytdExtraFiltersKey = "",
  onYtdChange,
  onRefresh,
}) => {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const [ytdLoading, setYtdLoading] = useState(false);
  const [ytdPivotTable, setYtdPivotTable] = useState<SegmentPivotTableData | null>(null);

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
          buildLubesSegmentTableYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, ytdExtraFilters)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesSegmentTableYtdPayload(prevFY, prevDateFrom, prevDateTo, ytdExtraFilters)
        ),
      ]);

      const combinedRows = [
        ...mapLubesSegmentOfficerRows(normalizeAggregationRows(currentRes.data)),
        ...mapLubesSegmentOfficerRows(normalizeAggregationRows(prevRes.data)),
      ];
      setYtdPivotTable(buildSegmentPivotTable(combinedRows, displayCurrentFY, prevFY));
    } catch {
      setYtdPivotTable(EMPTY_PIVOT);
    } finally {
      setYtdLoading(false);
    }
  }, [displayCurrentFY, prevFY, ytdExtraFilters]);

  useEffect(() => {
    setYtdPivotTable(null);
  }, [displayCurrentFY, ytdExtraFiltersKey]);

  // Auto-fetch when activated
  useEffect(() => {
    if (ytdActive && ytdPivotTable === null && !ytdLoading) void fetchYtd();
  }, [ytdActive, ytdPivotTable, ytdLoading, fetchYtd]);

  const activePivot = ytdActive ? (ytdPivotTable ?? EMPTY_PIVOT) : pivotTable;
  const activePreviousFY = ytdActive ? prevFY : displayPreviousFY;
  const isActiveLoading = ytdActive ? ytdLoading : loading;

  const currentFyLabel = formatShortFiscalYear(displayCurrentFY);
  const previousFyLabel = formatShortFiscalYear(activePreviousFY);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activePivot.rows;
    return activePivot.rows.filter(
      (row) =>
        row.region.toLowerCase().includes(query) ||
        row.regionRaw.toLowerCase().includes(query)
    );
  }, [activePivot.rows, search]);

  const hasData = activePivot.rows.length > 0 && activePivot.segments.length > 0;

  const headerAction = (
    <div className="flex items-center gap-1">
      {/* YTD toggle */}
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
        {ytdLoading
          ? <Loader2 className="h-2 w-2 animate-spin" />
          : <span>YTD</span>
        }
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Expand table"
        disabled={isActiveLoading || !hasData}
        onClick={() => setSheetOpen(true)}
        className={ghostIconButtonClass}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Refresh segment table data"
        disabled={isActiveLoading || refreshing}
        onClick={ytdActive ? () => void fetchYtd() : onRefresh}
        className={ghostIconButtonClass}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${(refreshing || ytdLoading) ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );

  const renderPivotTable = (rows: typeof filteredRows, scrollClass = "") => (
    <div className={`overflow-x-auto ${scrollClass} overflow-y-auto [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent`}>
      <table className="min-w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th rowSpan={2} className={`${REGION_COLUMN_CLASS} z-[3] border border-slate-200 bg-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-800`}>
              Region
            </th>
            {activePivot.segments.map((segment, index) => {
              const colors = getSegmentColors(segment, index);
              return (
                <th key={segment} colSpan={3} className={`border border-slate-200 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide ${colors.header}`}>
                  {segment}
                </th>
              );
            })}
            <th colSpan={3} className={`border border-slate-200 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide ${TOTAL_COLORS.header}`}>Total</th>
          </tr>
          <tr>
            {activePivot.segments.map((segment, index) => {
              const colors = getSegmentColors(segment, index);
              return (
                <React.Fragment key={`${segment}-sub`}>
                  <th className={`border border-slate-200 px-1.5 py-1 text-center text-[10px] font-semibold ${colors.sub}`}>{currentFyLabel}</th>
                  <th className={`border border-slate-200 px-1.5 py-1 text-center text-[10px] font-semibold ${colors.sub}`}>{previousFyLabel}</th>
                  <th className={`border border-slate-200 px-1.5 py-1 text-center text-[10px] font-semibold ${colors.sub}`}>Gr%</th>
                </React.Fragment>
              );
            })}
            <th className={`border border-slate-200 px-1.5 py-1 text-center text-[10px] font-semibold ${TOTAL_COLORS.sub}`}>{currentFyLabel}</th>
            <th className={`border border-slate-200 px-1.5 py-1 text-center text-[10px] font-semibold ${TOTAL_COLORS.sub}`}>{previousFyLabel}</th>
            <th className={`border border-slate-200 px-1.5 py-1 text-center text-[10px] font-semibold ${TOTAL_COLORS.sub}`}>Gr%</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={1 + activePivot.segments.length * 3 + 3} className="px-2 py-4 text-center text-slate-400">No matches</td></tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key} className="group cursor-pointer border-t border-slate-200 transition-colors hover:bg-slate-200/80">
                <td className={`${REGION_COLUMN_CLASS} z-[2] bg-white py-1 font-medium text-slate-800 transition-colors group-hover:bg-slate-200 group-hover:font-semibold`}>{row.region}</td>
                {activePivot.segments.map((segment, index) => (
                  <PivotMetricCells key={`${row.key}-${segment}`} cell={row.bySegment[segment]} cellClass={getSegmentColors(segment, index).cell} />
                ))}
                <PivotMetricCells cell={row.total} cellClass={TOTAL_COLORS.cell} />
              </tr>
            ))
          )}
          <tr className={`border-t-2 border-slate-200 ${TOTAL_COLORS.row}`}>
            <td className={`${REGION_COLUMN_CLASS} z-[2] bg-slate-100 py-1 font-bold text-slate-800`}>Total</td>
            {activePivot.segments.map((segment, index) => (
              <PivotMetricCells key={`total-${segment}`} cell={activePivot.segmentTotals[segment]} cellClass={getSegmentColors(segment, index).cell} isTotalRow />
            ))}
            <PivotMetricCells cell={activePivot.grandTotal} cellClass={TOTAL_COLORS.cell} isTotalRow />
          </tr>
        </tbody>
      </table>
    </div>
  );

  const footerText = `${filteredRows.length} region${filteredRows.length === 1 ? "" : "s"} · ${activePivot.segments.length} segment${activePivot.segments.length === 1 ? "" : "s"} · Curr ${displayCurrentFY} · Hist ${activePreviousFY}`;

  return (
    <>
      <PanelShell
        icon={<Table2 className="h-4 w-4" />}
        title="Segment Wise Table"
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
        ) : !hasData ? (
          <div className="py-4 text-center text-sm text-slate-500">No segment table data available.</div>
        ) : (
          <div className="relative">
            {refreshing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
                <Loader2 className={LUBES_UI.loader} />
              </div>
            )}
            <div className={LUBES_UI.breakdownTable}>
              {renderPivotTable(filteredRows)}
              <p className={LUBES_UI.breakdownTableFooter}>{footerText}</p>
            </div>
          </div>
        )}
      </PanelShell>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-[96vw] max-w-[96vw] flex-col gap-0 p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-3">
            <SheetTitle className="text-sm font-semibold text-slate-800">
              Segment Wise Table — {footerText}
            </SheetTitle>
          </SheetHeader>
          <div className="border-b border-slate-100 px-3 py-2">
            <BreakdownTableSearch value={search} onChange={setSearch} placeholder="Search region..." />
          </div>
          <div className="flex-1 overflow-hidden p-3">
            {renderPivotTable(filteredRows, "")}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default SegmentBreakdownTablePanel;
