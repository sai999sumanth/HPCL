import React, { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {
  ColDef,
  ColGroupDef,
  ValueFormatterParams,
  RowClassParams,
  GridReadyEvent,
  CellClassParams,
  ICellRendererParams,
} from "ag-grid-community";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/@/components/ui/button";
import TimeFilterButtons from "@/pages/component/RetailOutletHome/TimeFilterButtons";
import { apiClient } from "@/services/apiClient";
import { useConsReportExternalScrollbars } from "./utils/useConsReportExternalScrollbars";
import { downloadConsolidatedReportExcel } from "./utils/exportConsolidatedExcel";

// ─── Types ───────────────────────────────────────────────────────────────────
type ExportRowWithGroupAndParam = Record<string, unknown> & {
    group: string;
    param: string;
  };
  
interface CarData {
  carName: string | string[];
  bottlingSummary?: Record<string, unknown>;
  normalHours?: Record<string, unknown>;
  breakHours?: Record<string, unknown>;
  overtimeHours?: Record<string, unknown>;
  checkScaleSummary?: Record<string, unknown>;
  electronicLeakDetectorSummary?: Record<string, unknown>;
  "O-RingTesterSummary"?: Record<string, unknown>;
  [key: string]: unknown;
}

interface PlantData {
  plantName: string | string[];
  cars?: CarData[];
}

interface ApiResponse {
  plants?: PlantData[];
}

interface RowDef {
  group: string;
  param: string;
  accessor: (car: CarData) => unknown;
}

interface GridRow {
  group: string;
  _span: number;
  _isLastInGroup: boolean;
  param: string;
  _ri: number;
  _band: number;
  [key: string]: unknown;
}

// ─── Section config ───────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  bottlingSummary: "Bottling Summary",
  normalHours: "Productivity - Normal Hours",
  breakHours: "Productivity - Break Hours",
  overtimeHours: "Productivity - Overtime Hours",
  checkScaleSummary: "Check Scale Summary",
  electronicLeakDetectorSummary: "Electronic Leak Detector",
  "O-RingTesterSummary": "O-Ring Tester",
};

const CAR_METADATA_KEYS = new Set(["carName"]);

function isSectionObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeApiResponse(raw: unknown): ApiResponse {
  if (!raw || typeof raw !== "object") return { plants: [] };
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.plants)) {
    return { plants: obj.plants as PlantData[] };
  }

  if (obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    if (Array.isArray(data.plants)) {
      return { plants: data.plants as PlantData[] };
    }
    if (Array.isArray(data)) {
      return { plants: data as PlantData[] };
    }
  }

  if (Array.isArray(raw)) {
    return { plants: raw as PlantData[] };
  }

  return { plants: [] };
}

function getOrderedSectionKeys(plants: PlantData[]): string[] {
  const discovered = new Set<string>();
  plants.forEach((plant) => {
    (plant.cars ?? []).forEach((car) => {
      Object.keys(car).forEach((key) => {
        if (CAR_METADATA_KEYS.has(key)) return;
        if (isSectionObject(car[key])) discovered.add(key);
      });
    });
  });

  const knownOrder = Object.keys(SECTION_LABELS);
  const ordered = knownOrder.filter((key) => discovered.has(key));
  discovered.forEach((key) => {
    if (!ordered.includes(key)) ordered.push(key);
  });
  return ordered;
}

function getOrderedSubKeys(plants: PlantData[], sectionKey: string): string[] {
  const discovered = new Set<string>();
  let ordered: string[] = [];

  plants.forEach((plant) => {
    (plant.cars ?? []).forEach((car) => {
      const section = car[sectionKey];
      if (!isSectionObject(section)) return;
      const keys = Object.keys(section);
      if (ordered.length === 0) ordered = [...keys];
      keys.forEach((key) => discovered.add(key));
    });
  });

  discovered.forEach((key) => {
    if (!ordered.includes(key)) ordered.push(key);
  });
  return ordered;
}

// ─── Row builder ─────────────────────────────────────────────────────────────

function fmtParamLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/^14 2kg/i, "14.2kg")
    .replace(/Cyl Hr$/i, "(Cyl/hr)")
    .replace(/Cylinders\s*\/\s*hour/i, "(Cyl/hr)")
    .replace(/Percentage$/i, "%")
    .replace(/Stoppages Hours/i, "Stoppages (Hours)")
    .replace(/Rejection Underweight/i, "Rejection - Underweight")
    .replace(/Rejection Overweight/i, "Rejection - Overweight")
    .replace(/Rejection Other Errors/i, "Rejection - Other Errors");
}

function buildRowDefs(apiResponse: ApiResponse): RowDef[] {
  const plants = apiResponse?.plants ?? [];
  if (plants.length === 0) return [];

  const rows: RowDef[] = [];
  for (const sectionKey of getOrderedSectionKeys(plants)) {
    const subKeys = getOrderedSubKeys(plants, sectionKey);
    if (subKeys.length === 0) continue;

    const groupLabel = SECTION_LABELS[sectionKey] ?? fmtParamLabel(sectionKey);
    for (const subKey of subKeys) {
      const _subKey = subKey;
      const _sectionKey = sectionKey;
      rows.push({
        group: groupLabel,
        param: fmtParamLabel(_subKey),
        accessor: (car: CarData) => {
          const section = car[_sectionKey] as Record<string, unknown> | undefined;
          return section?.[_subKey];
        },
      });
    }
  }
  return rows;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFieldKey(plantName: string, carNum: string | number): string {
  return `col_${String(plantName).replace(/[^a-zA-Z0-9]/g, "_")}_car${carNum}`;
}

function fmt(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    if (val === 0) return "0";
    return Number.isInteger(val) ? val.toLocaleString() : parseFloat(val.toFixed(2)).toString();
  }
  return String(val);
}

function formatLocalDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return formatLocalDateStr(new Date());
}

function getDateRangeFromFilter(
  timeFilter: string | null,
  dateRangeFilter: { value: string } | null
): { fromDate: string; toDate: string } {
  if (dateRangeFilter?.value) {
    const [from, to] = dateRangeFilter.value.split(",");
    return { fromDate: from, toDate: to };
  }

  const today = todayStr();
  if (!timeFilter || timeFilter === "t") {
    return { fromDate: today, toDate: today };
  }

  const now = new Date();
  switch (timeFilter) {
    case "1d": {
      const ydy = new Date(now);
      ydy.setDate(ydy.getDate() - 1);
      const s = formatLocalDateStr(ydy);
      return { fromDate: s, toDate: s };
    }
    case "1w": {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { fromDate: formatLocalDateStr(start), toDate: today };
    }
    case "15d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      return { fromDate: formatLocalDateStr(start), toDate: today };
    }
    case "1m": {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      return { fromDate: formatLocalDateStr(start), toDate: today };
    }
    case "3m": {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      return { fromDate: formatLocalDateStr(start), toDate: today };
    }
    default:
      return { fromDate: today, toDate: today };
  }
}

// ─── Grid border / colour tokens ─────────────────────────────────────────────

const GRID_BORDER = {
  group: "1px solid #c5d0de",
  pinned: "1px solid #d1dae6",
} as const;

const GROUP_CELL_BG = "#f0f5fb";

/** Category separator only — no lines between rows within a group */
function categoryBottomBorder(isLastInGroup: boolean): string {
  return isLastInGroup ? GRID_BORDER.group : "none";
}

/** Spanned group label sits over all rows — draw separator at the bottom of the block */
function groupLabelBottomBorder(isLastInGroup: boolean, span: number): string {
  return isLastInGroup || span > 1 ? GRID_BORDER.group : "none";
}

// ─── Grid data builder ────────────────────────────────────────────────────────

function buildGridData(apiResponse: ApiResponse) {
  const plants = apiResponse?.plants ?? [];
  const rowDefs = buildRowDefs(apiResponse);
  if (rowDefs.length === 0) return { colDefs: [], rowData: [] };

  // Group spans
  const groupSpans: number[] = new Array(rowDefs.length).fill(1);
  let gi = 0;
  while (gi < rowDefs.length) {
    let count = 0;
    const g = rowDefs[gi].group;
    while (gi + count < rowDefs.length && rowDefs[gi + count].group === g) count++;
    groupSpans[gi] = count;
    gi += count;
  }

  // Alternating band
  const rowBand: number[] = [];
  let band = 0, bi = 0;
  while (bi < rowDefs.length) {
    const span = groupSpans[bi];
    for (let j = 0; j < span; j++) rowBand.push(band);
    band = 1 - band;
    bi += span;
  }

  // Flatten cars
  interface CarMeta { plantName: string; carNum: string | number; carObj: CarData; fieldKey: string; }
  const allCars: CarMeta[] = [];
  plants.forEach((plant) => {
    const plantName = Array.isArray(plant.plantName) ? plant.plantName[0] : String(plant.plantName);
    (plant.cars ?? []).forEach((carObj) => {
      const carNum = Array.isArray(carObj.carName) ? carObj.carName[0] : carObj.carName;
      allCars.push({ plantName, carNum, carObj, fieldKey: makeFieldKey(plantName, carNum) });
    });
  });

  // ── Column defs ──
  const colDefs: (ColDef<GridRow> | ColGroupDef<GridRow>)[] = [
    // Group column — rowSpan so label spans all rows in the section
    {
      headerName: "Group",
      field: "group",
      pinned: "left" as const,
      suppressMovable: true,
      headerClass: "pinned-label-header",
      width: 130,
      minWidth: 100,
      rowSpan: (params) => {
        const row = params.data as GridRow;
        return row?._span ?? 1;
      },
      cellStyle: (params: CellClassParams<GridRow>) => {
        const row = params.data as GridRow;
        const isSpanned = (row?._span ?? 1) > 1;
        const isEmpty = row?.group === "";
        const span = row._span ?? 1;
        if (isEmpty) {
          return {
            padding: 0,
            borderTop: "none",
            borderLeft: "none",
            borderRight: GRID_BORDER.pinned,
            borderBottom: "none",
            background: GROUP_CELL_BG,
            zIndex: 0,
          };
        }
        return {
          fontWeight: 600,
          fontSize: "10.5px",
          color: "#1e3a5f",
          background: GROUP_CELL_BG,
          borderRight: GRID_BORDER.pinned,
          borderBottom: groupLabelBottomBorder(row._isLastInGroup, span),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center" as const,
          whiteSpace: "normal" as const,
          lineHeight: "1.3",
          padding: "4px 6px",
          zIndex: isSpanned ? 3 : 1,
          overflow: "visible",
        };
      },
    } as ColDef<GridRow>,

    // Parameters column — plain text, no renderer
    {
      headerName: "Parameters",
      field: "param",
      pinned: "left" as const,
      suppressMovable: true,
      headerClass: "pinned-label-header",
      width: 200,
      minWidth: 160,
      cellStyle: (params: CellClassParams<GridRow>) => {
        const row = params.data as GridRow;
        return {
          fontSize: "11px",
          color: "#475569",
          background: "#fafbfc",
          paddingLeft: "10px",
          paddingRight: "6px",
          borderRight: GRID_BORDER.pinned,
          borderBottom: categoryBottomBorder(row._isLastInGroup),
          display: "flex",
          alignItems: "center",
          whiteSpace: "normal" as const,
          lineHeight: "1.3",
        };
      },
    } as ColDef<GridRow>,
  ];

  // Plant grouped car columns
  const plantMap = new Map<string, ColDef<GridRow>[]>();
  allCars.forEach(({ plantName, carNum, fieldKey }) => {
    if (!plantMap.has(plantName)) plantMap.set(plantName, []);
    plantMap.get(plantName)!.push({
      headerName: `Car ${carNum}`,
      field: fieldKey,
      width: 88,
      minWidth: 65,
      headerClass: "car-col-header",
      cellStyle: (params: CellClassParams<GridRow>) => {
        const row = params.data as GridRow;
        return {
          textAlign: "right" as const,
          fontSize: "11px",
          paddingRight: "8px",
          color: "#334155",
          borderBottom: categoryBottomBorder(row._isLastInGroup),
        };
      },
      valueFormatter: (p: ValueFormatterParams<GridRow>) => fmt(p.value),
    } as ColDef<GridRow>);
  });

  plantMap.forEach((carCols, plantName) => {
    colDefs.push({
      headerName: plantName,
      headerClass: "plant-col-header",
      children: carCols,
      marryChildren: true,
    } as ColGroupDef<GridRow>);
  });

  // Row data
  const rowData: GridRow[] = [];
  let i = 0;
  while (i < rowDefs.length) {
    const span = groupSpans[i];
    for (let j = 0; j < span; j++) {
      const { group, param, accessor } = rowDefs[i + j];
      const row: GridRow = {
        group: j === 0 ? group : "",
        _span: j === 0 ? span : 1,
        _isLastInGroup: j === span - 1,
        param,
        _ri: i + j,
        _band: rowBand[i + j],
      };
      allCars.forEach(({ carObj, fieldKey }) => {
        const val = accessor(carObj);
        row[fieldKey] = val === undefined || val === null ? "" : val;
      });
      rowData.push(row);
    }
    i += span;
  }

  return { colDefs, rowData };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConsolidatedPlantReport() {
  const gridRef = useRef<AgGridReact<GridRow>>(null);

  const [timeFilter, setTimeFilter] = useState<string | null>("t");
  const [dateRangeFilter, setDateRangeFilter] = useState<{ value: string } | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [apiData, setApiData] = useState<ApiResponse>({ plants: [] });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { fromDate, toDate } = useMemo(
    () => getDateRangeFromFilter(timeFilter, dateRangeFilter),
    [timeFilter, dateRangeFilter]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApiData({ plants: [] });
    try {
      const payload = {
        filters: [],
        cross_filters: [
          {
            key: "DATE",
            cond: "equals",
            val: `${fromDate},${toDate}`,
          },
        ],
        drill_state: "",
      };
      const response = await apiClient.post(`/api/lpgoperationsinsights/lpg_car_download`, payload);
      setApiData(normalizeApiResponse(response.data ?? response));
    } catch (_err: unknown) {
      setError("No data available for the selected date range.");
      setApiData({ plants: [] });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleTimeFilterChange = useCallback((filter: string | null) => {
    // TimeFilterButtons calls onFilterChange(null) after custom Apply — do not clear the range
    if (filter === null) return;
    setDateRangeFilter(null);
    setTimeFilter(filter);
  }, []);

  const handleDateRangeChange = useCallback((dateFilter: { value: string }) => {
    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
  }, []);

  const handleRefresh = useCallback(() => {
    setTimeFilter("t");
    setDateRangeFilter(null);
    setResetTrigger((prev) => prev + 1);
  }, []);

  const { colDefs, rowData } = useMemo(() => buildGridData(apiData), [apiData]);
  const hasTableData = colDefs.length > 0 && rowData.length > 0;

  const { tableWrapRef, retryScrollbars } = useConsReportExternalScrollbars([
    loading,
    hasTableData,
    colDefs.length,
    rowData.length,
  ]);

  useEffect(() => {
    if (hasTableData) {
      retryScrollbars();
    }
  }, [hasTableData, colDefs, rowData, retryScrollbars]);

  const handleDownload = useCallback(() => {
    if (colDefs.length === 0 || rowData.length === 0) {
      toast.error("No data available to download.");
      return;
    }
    setDownloading(true);
    try {
      downloadConsolidatedReportExcel(
        colDefs,
        rowData.map((row: Record<string, unknown>) => ({
          group: row.group,
          param: row.param,
          ...row,
        })) as ExportRowWithGroupAndParam[],
        fromDate,
        toDate
      );
      toast.success("Report downloaded.");
    } catch {
      toast.error("Failed to download report.");
    } finally {
      setDownloading(false);
    }
  }, [colDefs, rowData, fromDate, toDate]);
  
  const defaultColDef = useMemo<ColDef<GridRow>>(
    () => ({ sortable: false, filter: false, resizable: true, suppressMovable: false }),
    []
  );

  const getRowStyle = useCallback((params: RowClassParams<GridRow>) => {
    const band = (params.data as GridRow)?._band ?? 0;
    return {
      background: band === 0 ? "#ffffff" : "#f8fafc",
      borderBottom: "none",
    };
  }, []);

  const onGridReady = useCallback(
    (_e: GridReadyEvent) => {
      retryScrollbars();
    },
    [retryScrollbars]
  );

  return (
    <>
      <style>{`
        .cons-report-grid {
          --ag-font-size: 12px;
        }
        .cons-report-grid .ag-header-group-cell.plant-col-header .ag-header-group-cell-label {
          justify-content: center; font-weight: 700; font-size: 11px; color: #1a3a5c;
        }
        .cons-report-grid .car-col-header .ag-header-cell-label {
          justify-content: center; font-size: 10.5px; color: #334155;
        }
        .cons-report-grid .ag-header-cell-text {
          font-size: 12px;
          font-weight: 600;
        }
        .cons-report-grid .ag-header-cell {
          background-color: #f9fafb !important;
        }
        .cons-report-grid .ag-header-group-cell {
          background-color: #f3f4f6 !important;
          font-weight: 600;
        }
        .cons-report-grid .ag-header-cell,
        .cons-report-grid .ag-header-group-cell {
          border-right: 1px solid #cbd5e1 !important;
        }
        /* Bottom border only on the leaf header row — avoids line through spanning Group/Parameters */
        .cons-report-grid .ag-header-row-column .ag-header-cell,
        .cons-report-grid .ag-header-row-column .ag-header-group-cell,
        .cons-report-grid .ag-header-row-column-group .ag-header-group-cell {
          border-bottom: 1px solid #cbd5e1 !important;
        }
        .cons-report-grid .ag-header-row-column-group .ag-header-cell {
          border-bottom: none !important;
          background: transparent !important;
        }
        .cons-report-grid .pinned-label-header {
          z-index: 2;
        }
        .cons-report-grid .pinned-label-header .ag-header-cell-label {
          justify-content: center;
        }
        .cons-report-grid .ag-cell {
          border-right: 1px solid #eef2f6 !important;
          line-height: normal !important;
        }
        /* Group col: overflow visible so spanning cell covers empty slots cleanly */
        .cons-report-grid [col-id="group"] {
          overflow: visible !important;
        }
        .cons-report-grid .ag-row { border-bottom: none !important; }
        .cons-report-grid .ag-pinned-left-header {
          background-color: #f9fafb !important;
          border-right: 1px solid #d1dae6 !important;
        }
        .cons-report-grid .ag-pinned-left-cols-container .ag-cell:last-child {
          border-right: 1px solid #d1dae6 !important;
        }
        .cons-report-grid .ag-root-wrapper {
          border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;
        }
        .cons-report-grid .ag-body-viewport,
        .cons-report-grid .ag-center-cols-viewport {
          background: #ffffff;
        }
        /* Outer wrap: external scrollbars outside table border */
        .cons-report-scroll-wrap {
          flex: 1;
          min-height: 0;
          position: relative;
          padding-right: 12px;
          padding-bottom: 14px;
          box-sizing: border-box;
        }
        .cons-report-scroll-wrap .ag-center-cols-viewport {
          overflow-x: auto !important;
          scrollbar-width: none !important;
        }
        .cons-report-scroll-wrap .ag-center-cols-viewport::-webkit-scrollbar {
          display: none !important;
          height: 0 !important;
        }
        .cons-report-scroll-wrap .ag-body-viewport {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scrollbar-width: none !important;
        }
        .cons-report-scroll-wrap .ag-body-viewport::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
        }
        .cons-report-scroll-wrap .ag-body-horizontal-scroll,
        .cons-report-scroll-wrap .ag-body-vertical-scroll {
          display: none !important;
        }
        /* Bottom scrollbar — starts after pinned Group + Parameters columns */
        .cons-report-scroll-wrap .cons-report-h-scroll-mirror {
          position: absolute;
          right: 12px;
          bottom: 2px;
          height: 10px;
          background: #cbd5e1;
          border-radius: 6px;
          z-index: 25;
          cursor: pointer;
          user-select: none;
        }
        .cons-report-scroll-wrap .cons-report-h-scroll-mirror > div {
          position: absolute;
          top: 1px;
          bottom: 1px;
          left: 0;
          min-width: 40px;
          background: #64748b;
          border-radius: 5px;
        }
        /* Right scrollbar — outside table, aligned with data rows */
        .cons-report-scroll-wrap .cons-report-v-scroll-mirror {
          position: absolute;
          right: 0;
          bottom: 14px;
          width: 10px;
          background: #cbd5e1;
          border-radius: 6px;
          z-index: 25;
          cursor: pointer;
          user-select: none;
        }
        .cons-report-scroll-wrap .cons-report-v-scroll-mirror > div {
          position: absolute;
          left: 1px;
          right: 1px;
          top: 0;
          min-height: 40px;
          background: #64748b;
          border-radius: 5px;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>

        {/* ── Header bar: title left, controls right ── */}
        <div style={{
          background: "#fff",
          padding: "10px 16px",
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          {/* Title */}
          <div style={{ flex: "1 1 auto", minWidth: 200 }}>
            <h2 style={{ margin: 0, color: "#0f2540", fontSize: "14px", fontWeight: 700, lineHeight: 1.3 }}>
              Consolidated Plant Performance Report
            </h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "10.5px" }}>
              Bottling &amp; Productivity Summary by Plant &amp; CAR
            </p>
          </div>

          {/* Controls — right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <TimeFilterButtons
              selectedFilter={timeFilter}
              onFilterChange={handleTimeFilterChange}
              onDateRangeChange={handleDateRangeChange}
              resetTrigger={resetTrigger}
            />
            <Button
              onClick={handleRefresh}
              className="h-7 px-2 py-1 text-xs font-medium rounded-lg transition-all bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-gray-200 hover:to-gray-300 border border-gray-300"
              disabled={loading || downloading}
              title="Reset filters"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={handleDownload}
              className="h-7 w-7 p-0 rounded-lg bg-green-600 text-white hover:bg-green-700"
              disabled={loading || downloading || !hasTableData}
              title="Download report as Excel"
            >
              <Download className={`h-4 w-4 ${downloading ? "animate-pulse" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Table area ── */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            margin: "12px 16px 16px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            minHeight: 200,
          }}
        >
          {loading && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                fontSize: "12px",
              }}
            >
              Loading report…
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 16px",
                textAlign: "center",
              }}
            >
              <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                {error}
              </span>
            </div>
          )}

          {!loading && !error && !hasTableData && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                fontSize: "12px",
              }}
            >
              No data available for the selected date range.
            </div>
          )}

          {!loading && !error && hasTableData && (
            <div
              ref={tableWrapRef}
              className="ag-theme-alpine cons-report-grid cons-report-scroll-wrap"
              style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
            >
              <AgGridReact<GridRow>
                ref={gridRef}
                columnDefs={colDefs}
                rowData={rowData}
                defaultColDef={defaultColDef}
                suppressRowTransform={true}
                suppressCellFocus={true}
                enableCellTextSelection={true}
                domLayout="normal"
                headerHeight={30}
                groupHeaderHeight={30}
                rowHeight={30}
                suppressContextMenu={true}
                suppressRowClickSelection={true}
                pagination={false}
                onGridReady={onGridReady}
                getRowStyle={getRowStyle}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}