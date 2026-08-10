
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

import TASTrendChart, { TASTrendChartHandle } from "./TASTrendChart";
import SafetyProcessGantryTable from "../../alertsTable/SafetyProcessGantryTable";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";
import { DateRangePickerFilter } from "./DateRangePickerFilter";
import { Loader2, RotateCcw, Download, Maximize2, Minimize2 } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef } from "ag-grid-community";
import * as XLSX from "xlsx";

dayjs.extend(customParseFormat);

interface SeverityFilter {
  severity: string | null;
  section: string | null;
  interlockName: string | null;
  bu: string;
}

interface TitleFilter {
  id: number | null;
  title: string | null;
  bu: string;
  alert_section: string | null;
}

interface LocationFilter {
  zone: string | null;
  plant: string | null;
}

interface FilterValue {
  key: string;
  cond: string;
  value: string;
}

interface ChartProps {
  filters: FilterValue[];
  zone?: string | null;
  plant?: string | null;
  /** 0 = Safety, 1 = Process. When set, opens that tab by default (e.g. when used as "Safety Trend" or "Process Trend" main tab). */
  initialTabIndex?: 0 | 1;
}

const INTERLOCK_MAPPINGS = {
  'VFT': ['HHH alarm from VFT', 'Proof Test_VFT_Success'],
  'Radar': ['Proof Test_Secondary Radar Guage_Success', 'HHH alarm from Secondary Radar guage'],
  'Esd': ['Plant ESD activated'],
  'Hcd': ['HCD_40% LEL activated', 'HCD_20% LEL activated'],
  'Dyke': ['Dykevalve_Activated'],
  'Primary Level': ['Primary Radar Guage_H alarm', 'Primary Radar Guage_HH alarm'],
  'Tank Leakage': ['Tank leakage alarm'],
  'Lrc Switchover': ['LRC Master Switchover required in 30 days'],
  'Plc': ['SafetyPLC_Communication fail', 'ProcessPLC_Communication fail'],
  'Ups': ['UPS_Fail'],
  'ROSOV STATUS': ['ROSOV_STATUS'],
  'Hooter': ['Hooter_Activated'],
  'BCU': ['BCU_Alarm'],
  'Barrier Gate': ['Barrier_Gate_Alarm'],
  'Loading Point': ['Loading_Point_Alarm'],
  'Fire Pump': ['Fire_Pump_Alarm'],
  'Fire Engine': ['Fire_Engine_Alarm'],
  'MOV STATUS': ['MOV_STATUS'],
  'Gantry Override': ['Gantry Permissive_Override']
};

// ── Summary table data shape (real API) ──────────────────────────────────────
// Month columns are dynamic keys like "Feb 2026" with count for that month
interface SummaryData {
  zone: string;
  location_name: string;
  sap_id: string;
  alert_category: string;
  device_name: string;
  alert_status?: string;
  interlock_name?: string;
  count: number;
  [monthKey: string]: string | number | undefined;
}

const SUMMARY_ZONE_TAB_COLS: ColDef<SummaryData>[] = [
  { headerName: "Zone", field: "zone", minWidth: 80, sortable: true, filter: true, pinned: "left" },
  { headerName: "Equipment", field: "device_name", minWidth: 100, sortable: true, filter: true },
];

/** When Zone toggle is on: merge rows with same (zone, device_name), sum count and each month column. */
function aggregateSummaryRowsByZone(rows: SummaryData[], monthColumns: string[]): SummaryData[] {
  const byKey = new Map<string, SummaryData>();
  rows.forEach((row) => {
    const key = `${(row.zone ?? "").toString()}||${(row.device_name ?? "").toString()}`;
    if (byKey.has(key)) {
      const agg = byKey.get(key)!;
      agg.count += row.count ?? 0;
      monthColumns.forEach((m) => {
        const prev = (agg[m] as number) ?? 0;
        agg[m] = prev + ((row[m] as number) ?? 0);
      });
    } else {
      const base: SummaryData = {
        zone: row.zone ?? "",
        location_name: row.location_name ?? "",
        sap_id: row.sap_id ?? "",
        alert_category: row.alert_category ?? "",
        device_name: row.device_name ?? "",
        count: row.count ?? 0,
      };
      monthColumns.forEach((m) => { base[m] = (row[m] as number) ?? 0; });
      byKey.set(key, base);
    }
  });
  return Array.from(byKey.values()).sort((a, b) => b.count - a.count);
}
const SUMMARY_PLANT_TAB_COLS: ColDef<SummaryData>[] = [
  {
    headerName: "Plant",
    field: "location_name",
    width: 180,
    minWidth: 180,
    flex: 0,
    sortable: true,
    filter: true,
    pinned: "left",
    cellRenderer: (params: any) => (
      <span className="text-black-600 cursor-pointer hover:text-black-800">{params.value}</span>
    ),
  },
  { headerName: "Equipment", field: "device_name", width: 140, minWidth: 140, flex: 0, sortable: true, filter: true },
];

function sortMonthColumns(months: string[]): string[] {
  return [...months].sort((a, b) => {
    const dA = dayjs(a, "MMM YYYY");
    const dB = dayjs(b, "MMM YYYY");
    if (dA.isValid() && dB.isValid()) return dA.valueOf() - dB.valueOf();
    return String(a).localeCompare(String(b));
  });
}

/** Sort period columns: for weekly (YYYY-MM-DD) sort by date; for yearly (MMM YYYY) use sortMonthColumns. */
function sortPeriodColumns(columns: string[], viewMode: "yearly" | "weekly"): string[] {
  if (viewMode === "weekly") {
    return [...columns].sort((a, b) => {
      const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (isDate(a) && isDate(b)) return a.localeCompare(b);
      return String(a).localeCompare(String(b));
    });
  }
  return sortMonthColumns(columns);
}

const CATEGORIES = ["Safety", "Process"];
const DEFAULT_EQUIPMENT = {
  Safety: "Radar",
  Process: "Tank Leakage",
  Gantry: "BCU",
};

const HIDDEN_EQUIPMENT = ["ROSOV STATUS", "Hooter", "Fire Pump", "MOV STATUS"];

// Pill background colors for equipment tabs (no red/green)
const TAB_PILL_COLORS = [
  "bg-blue-600 text-white",
  // "bg-slate-600 text-white",
  // "bg-indigo-600 text-white",
  //   "bg-fuchsia-600 text-white",
    
    
  
  // "bg-amber-500 text-white",
  // "bg-violet-600 text-white",
  // "bg-yellow-500 text-gray-900",
  // "bg-cyan-600 text-white",
  // "bg-orange-500 text-white",
  // "bg-sky-600 text-white",
  // "bg-indigo-600 text-white",
  // "bg-zinc-600 text-white",
  // "bg-amber-600 text-white",
  // "bg-fuchsia-600 text-white",
];

const EQUIPMENT_CATEGORIES: Record<string, string[]> = {
  Safety: ["Radar", "MOV STATUS", "VFT", "Hcd", "Esd", "Dyke", "ROSOV STATUS", "Hooter", "Fire Pump", "Gantry Override"],
  Process: ["Tank Leakage", "Ups", "Plc", "Primary Level", "Lrc Switchover"],
  Gantry: ["BCU", "Loading Point"],
};

// ── Normalize API response: support flat array (e.g. Process/Plc) ─────────────────────────────
/** If API returns a flat array, group by device_name so buildSummaryRows gets object shape. */
function normalizeSummaryRawData(raw: any): Record<string, any[]> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const byDevice: Record<string, any[]> = {};
    raw.forEach((row: any) => {
      const name = (row.device_name ?? row.equipment_name ?? row.alert_category ?? "Unknown").toString().trim();
      const key = name;
      if (!byDevice[key]) byDevice[key] = [];
      byDevice[key].push(row);
    });
    return byDevice;
  }
  return raw;
}

// ── Helper: transform raw API data into summary rows with per-month counts ───
/**
 * `rawData` is either `result.monthly_data` or `result.daily_data`:
 *   { [equipmentName]: Array<{ zone, location_name, sap_id, count, alert_category, date|month }> }
 * or (after normalizeSummaryRawData) same shape when API returns a flat array.
 *
 * We aggregate per (equipment × zone × location_name × sap_id) and add a column per month
 * (e.g. "Feb 2026" with that month's count). Total count in `count`.
 */
function buildSummaryRows(
  rawData: Record<string, any[]>,
  category: string,
  viewMode: "yearly" | "weekly"
): { rows: SummaryData[]; monthColumns: string[] } {
  if (!rawData) return { rows: [], monthColumns: [] };

  const aggregated: Record<string, SummaryData> = {};
  const periodSet = new Set<string>();

  function getPeriodKey(row: any): string {
    if (viewMode === "weekly" && row.date) return dayjs(row.date).format("YYYY-MM-DD");
    if (viewMode !== "weekly" && row.date) return dayjs(row.date).format("MMM YYYY");
    if (row.month != null && row.month !== "") {
      const m = String(row.month).trim();
      const formats = [
        "MMM YYYY",
        "MMM-YYYY",
        "MMM_YYYY",
        "YYYY-MM",
        "YYYY-MM-DD",
        "MMMM YYYY",
        "MMM",
        "MMMM",
      ];
      let parsed = dayjs(m, formats, true);
      if (!parsed.isValid() && /[A-Za-z]{3,}[-\s]\d{4}/.test(m)) {
        parsed = dayjs(m.replace(/-/g, " "), ["MMM YYYY"], true);
      }
      if (!parsed.isValid()) parsed = dayjs(m);
      if (parsed.isValid()) return parsed.format("MMM YYYY");
      if (/^\d{4}-\d{2}$/.test(m)) return dayjs(`${m}-01`).format("MMM YYYY");
    }
    return "";
  }

  // For Safety summary, include Gantry alert_category so "Gantry Override" (Gantry Permissive_Override) appears
  const matchesCategory = (row: any) =>
    row.alert_category === category || (category === "Safety" && row.alert_category === "Gantry");
  // Process tab: API may return flat array with alert_category "Safety" or "Process" for equipment like Plc
  const processEquipment = EQUIPMENT_CATEGORIES.Process ?? [];
  const isProcessEquipment = (equip: string) =>
    processEquipment.some((e) => String(e).toLowerCase() === String(equip).toLowerCase());
  const displayDeviceName = (equip: string) =>
    category === "Safety" && equip === "Gantry Permissive_Override" ? "Gantry Override" : equip;

  Object.entries(rawData).forEach(([equipmentName, rows]) => {
    if (!Array.isArray(rows)) return;
    const filterRows =
      category === "Process" && isProcessEquipment(equipmentName)
        ? rows
        : rows.filter(matchesCategory);
    filterRows.forEach((row) => {
        const key = `${equipmentName}||${row.zone}||${row.sap_id}`;
        const periodKey = getPeriodKey(row);
        const add = row.count ?? 0;

        if (periodKey) periodSet.add(periodKey);


        if (aggregated[key]) {
          aggregated[key].count += add;
          if (periodKey) {
            const prev = (aggregated[key][periodKey] as number) ?? 0;
            aggregated[key][periodKey] = prev + add;
          }
        } else {
          const base: SummaryData = {
            zone: row.zone ?? "",
            location_name: row.location_name ?? "",
            sap_id: row.sap_id ?? "",
            alert_category: category,
            device_name: displayDeviceName(equipmentName),
            count: add,
          };
          if (periodKey) base[periodKey] = add;
          aggregated[key] = base;
        }
      });
  });

  const monthColumns = sortPeriodColumns(Array.from(periodSet), viewMode);
  const rows = Object.values(aggregated).sort((a, b) => b.count - a.count);
  return { rows, monthColumns };
}

const TASTrendDashboard: React.FC<ChartProps> = ({ filters, zone, plant, initialTabIndex = 0 }) => {
  const [activeTab, setActiveTab] = useState<number>(initialTabIndex);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([initialTabIndex]));
  const tableRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Lifted state from TASTrendChart
  const [viewMode, setViewMode] = useState<"yearly" | "weekly">("weekly");
  const [isExpanded, setIsExpanded] = useState(false);
  const [fromDate, setFromDate] = useState(dayjs().subtract(6, "day"));
  const [toDate, setToDate] = useState(dayjs());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData[]>([]);

  // Per-tab chart refs (when using single chart) or per-equipment (when using accordions)
  const chartRefs = useRef<Record<number, TASTrendChartHandle | null>>({});
  const chartRefsByEquipment = useRef<Record<string, TASTrendChartHandle | null>>({});
  const [activeEquipmentTab, setActiveEquipmentTab] = useState<Record<string, number>>({
    Safety: 0,
    Process: 0,
  });

  // Keep in sync with fromDate/toDate so table and date picker show correct range (weekly default)
  const [selectedFromDate, setSelectedFromDate] = useState(() =>
    dayjs().subtract(6, "day").format("YYYY-MM-DD")
  );
  const [selectedToDate, setSelectedToDate] = useState(() =>
    dayjs().format("YYYY-MM-DD")
  );
  const [selectedRowDate, setSelectedRowDate] = useState<string | null>(null);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  const [userInfo, setUserInfo] = useState<any>({});
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);

  const [selectedEquipment, setSelectedEquipment] = useState<{ [key: string]: string }>({
    Safety: DEFAULT_EQUIPMENT.Safety,
    Process: DEFAULT_EQUIPMENT.Process,
    Gantry: DEFAULT_EQUIPMENT.Gantry,
  });

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    severity: null,
    section: null,
    interlockName: null,
    bu: "TAS",
  });

  const [titleFilter, setTitleFilter] = useState<TitleFilter>({
    id: null,
    title: null,
    bu: "TAS",
    alert_section: null,
  });

  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: null,
  });

  const [currentAlertStatus, setCurrentAlertStatus] = useState<"All" | "Open" | "Close">("All");

  // ── Summary table state (real API) ────────────────────────────────────────
  const [summaryDataByCategory, setSummaryDataByCategory] = useState<Record<string, SummaryData[]>>({
    Safety: [],
    Process: [],
    Gantry: [],
  });
  const [summaryMonthColumns, setSummaryMonthColumns] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryLocationTab, setSummaryLocationTab] = useState<"zone" | "plant">("zone");
  const [summarySearchText, setSummarySearchText] = useState("");
  const [isSummaryTableDownloading, setIsSummaryTableDownloading] = useState(false);

  const summaryColDefs = useMemo<ColDef<SummaryData>[]>(() => {
    const monthColumnsOrder = summaryMonthColumns;
    const monthCols: ColDef<SummaryData>[] = summaryMonthColumns.map((periodKey) => ({
      headerName: /^\d{4}-\d{2}-\d{2}$/.test(periodKey) ? dayjs(periodKey).format("MMM D") : periodKey,
      field: periodKey,
      minWidth: 100,
      flex: 1,
      sortable: true,
      filter: false,
      valueGetter: (params) => params.data?.[periodKey] ?? 0,
      cellRenderer: (params: any) => {
        const currentVal = Number(params.value ?? 0);
        // Total row at bottom: plain bold number, no badge/arrows
        if (params.node?.rowPinned === "bottom") {
          return <span style={{ fontWeight: 600 }}>{currentVal}</span>;
        }
        const currentKey = params.colDef?.field as string;
        const idx = monthColumnsOrder.indexOf(currentKey);
        const prevKey = idx > 0 ? monthColumnsOrder[idx - 1] : null;
        const prevVal = prevKey != null ? Number(params.data?.[prevKey] ?? 0) : null;
        let badgeStyle: React.CSSProperties;
        let arrow: React.ReactNode = null;
        if (currentVal === 0) {
          if (prevKey != null && prevVal > 0) {
            badgeStyle = { backgroundColor: "#dcfce7", color: "#16a34a" };
            arrow = <span style={{ marginLeft: 4, color: "#16a34a" }}>↓</span>;
          } else {
            badgeStyle = { backgroundColor: "#f3f4f6", color: "#374151" };
            arrow = null;
          }
        } else if (prevKey == null) {
          badgeStyle = { backgroundColor: "#f3f4f6", color: "#374151" };
          arrow = null;
        } else if (currentVal > prevVal) {
          if (prevVal === 0) {
            badgeStyle = { backgroundColor: "#f3f4f6", color: "#374151" };
            arrow = null;
          } else {
            badgeStyle = { backgroundColor: "#fee2e2", color: "#dc2626" };
            arrow = <span style={{ marginLeft: 4, color: "#dc2626" }}>↑</span>;
          }
        } else {
          badgeStyle = { backgroundColor: "#dcfce7", color: "#16a34a" };
          arrow = <span style={{ marginLeft: 4, color: "#16a34a" }}>↓</span>;
        }
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 6px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.4,
              width: 40,
              ...badgeStyle,
            }}
          >
            {currentVal}
            {arrow}
          </span>
        );
      },
    }));
    const locationCols = summaryLocationTab === "zone" ? SUMMARY_ZONE_TAB_COLS : SUMMARY_PLANT_TAB_COLS;
    return [
      ...locationCols,
      ...monthCols,
      { headerName: "Total", field: "count", width: 90, maxWidth: 90, flex: 0, sortable: true, filter: false, pinned: "right", sort: "desc" },
    ];
  }, [summaryMonthColumns, summaryLocationTab]);

  const handleDownloadSummaryTable = (category: string, equipment: string) => {
    const filtered = (summaryDataByCategory[category] ?? []).filter(
      (row) =>
        (row.device_name && equipment && String(row.device_name).toLowerCase() === String(equipment).toLowerCase()) ||
        (equipment === "Gantry Override" && row.device_name === "Gantry Permissive_Override")
    );
    const rows =
      summaryLocationTab === "zone"
        ? aggregateSummaryRowsByZone(filtered, summaryMonthColumns)
        : filtered;
    if (rows.length === 0) return;
    setIsSummaryTableDownloading(true);
    try {
      const numericFields = new Set<string>(["count", ...summaryMonthColumns]);
      const headers = summaryColDefs.map((c) => ({
        headerName: (c.headerName as string) ?? (c.field as string) ?? "",
        field: c.field as string,
      }));
      const excelRows = rows.map((row: SummaryData) => {
        const obj: Record<string, unknown> = {};
        headers.forEach(({ headerName, field }) => {
          if (!field) return;
          const val = row[field];
          obj[headerName] = numericFields.has(field) ? (Number(val) ?? 0) : (val ?? "");
        });
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Alert Summary");
      const filename = `AlertSummary_${category}_${equipment}_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`;
      XLSX.writeFile(wb, filename);
    } finally {
      setIsSummaryTableDownloading(false);
    }
  };

  // ── Fetch summary data from the same API as TASTrendChart ─────────────────
  const fetchSummaryData = useCallback(async () => {
    setSummaryLoading(true);
    try {
      // Build filters — same transform as TASTrendChart
      const otherFilters = filters.map((f) =>
        f.key === "plant" ? { ...f, key: "sap_id" } : f
      );
      if (currentAlertStatus && currentAlertStatus !== "All") {
        otherFilters.push({ key: "status", cond: "equals", value: currentAlertStatus });
      }

      // Date cross-filters
      const dateFilters: FilterValue[] = [];
      if (viewMode === "weekly" && fromDate && toDate) {
        dateFilters.push({
          key: '"DATE"',
          cond: "equals",
          value: `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`,
        });
      }

      const requestBody = {
        action: "tas_normal_count",
        drill_state: viewMode === "yearly" ? "" : "date",
        cross_filters: dateFilters,
        filters: otherFilters,
        limit: 0,
        time_grain: viewMode === "weekly" ? "week" : "",
        resp_format: "",
        resp_level: "",
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", requestBody);
      const result = response.data;

      const raw =
        viewMode === "yearly"
          ? result.monthly_data ?? {}
          : result.daily_data ?? {};
      const rawData = normalizeSummaryRawData(raw);

      // Build summary rows: per-month columns for yearly, per-date columns for weekly
      const newSummary: Record<string, SummaryData[]> = {};
      const allPeriods = new Set<string>();
      ["Safety", "Process", "Gantry"].forEach((cat) => {
        const { rows, monthColumns } = buildSummaryRows(rawData, cat, viewMode);
        newSummary[cat] = rows;
        monthColumns.forEach((p) => allPeriods.add(p));
      });
      setSummaryDataByCategory(newSummary);
      setSummaryMonthColumns(sortPeriodColumns(Array.from(allPeriods), viewMode));
    } catch (err) {
      console.error("Error fetching summary data:", err);
      setSummaryDataByCategory({ Safety: [], Process: [], Gantry: [] });
      setSummaryMonthColumns([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [filters, viewMode, fromDate, toDate, currentAlertStatus]);

  // Re-fetch summary whenever the key dependencies change
  useEffect(() => {
    fetchSummaryData();
  }, [fetchSummaryData, refreshTrigger]);

  const fetchUserInfo = async () => {
    try {
      const response = await apiClient.get("/api/session/me");
      setUserInfo(response.data);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  // Compute available equipment for the active tab
  const currentCategory = CATEGORIES[activeTab];
  const availableEquipment = (EQUIPMENT_CATEGORIES[currentCategory] || []).filter(
    (e) => !HIDDEN_EQUIPMENT.includes(e)
  );

  const generateEquipmentInterlockQuery = (equipment: string): string => {
    if (!equipment) return "";
    if (!INTERLOCK_MAPPINGS[equipment]) {
      return `interlock_name='${equipment}'`;
    }
    const interlockNames = INTERLOCK_MAPPINGS[equipment];
    if (interlockNames.length === 1) {
      return `interlock_name='${interlockNames[0]}'`;
    }
    return `interlock_name IN (${interlockNames.map((name) => `'${name}'`).join(", ")})`;
  };

  const getQuery = (
    baseStatus: string,
    tabIndex: number,
    fromDate?: string,
    toDate?: string,
    selectedRowDate?: string,
    equipmentOverride?: string
  ): string => {
    const currentCategory = CATEGORIES[tabIndex];
    let baseQuery = `bu='TAS' AND alert_section='TAS'`;

    const equipment = equipmentOverride ?? selectedEquipment[currentCategory];
    if (equipment) {
      const interlockQuery = generateEquipmentInterlockQuery(equipment);
      if (interlockQuery) {
        baseQuery += ` AND ${interlockQuery}`;
      }
      // VFT tab: exclude Proof Test rows in query so pagination total and pages are correct
      if (equipment === "VFT") {
        baseQuery += ` AND interlock_name NOT LIKE 'Proof Test%'`;
      }
    }

    if (fromDate && toDate) {
      baseQuery += ` AND created_at::DATE BETWEEN '${fromDate}' AND '${toDate}'`;
    }

    if (selectedRowDate) {
      const monYearRegex = /^[A-Z][a-z]{2}-\d{4}$/;
      if (monYearRegex.test(selectedRowDate)) {
        baseQuery += ` AND TO_CHAR(created_at, 'Mon-YYYY') = '${selectedRowDate}'`;
      } else {
        baseQuery += ` AND created_at::DATE = '${selectedRowDate}'`;
      }
    }

    if (titleFilter.alert_section) {
      baseQuery += ` AND alert_section='${titleFilter.alert_section}'`;
    } else if (severityFilter.section) {
      baseQuery += ` AND alert_section='${severityFilter.section}'`;
    }

    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`;
    }

    if (severityFilter.interlockName) {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`;
    }

    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`;
    }

    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`;
    }

    return baseQuery;
  };

  const handleAlertStatusChange = useCallback((alertStatus: "All" | "Open" | "Close") => {
    setCurrentAlertStatus(alertStatus);
  }, []);

  const fetchSummaryDataForCurrentTab = async () => {
    try {
      const currentCategory = CATEGORIES[activeTab];
      const dateFormat = "YYYY-MM-DD";
      const fromStr = fromDate ? fromDate.format(dateFormat) : "";
      const toStr = toDate ? toDate.format(dateFormat) : "";

      const filtersList: any[] = [];

      // Add date filter if in weekly mode
      const dateFilters: any[] = [];
      if (viewMode === "weekly" && fromStr && toStr) {
        dateFilters.push({
          key: '"DATE"',
          cond: "equals",
          value: `${fromStr},${toStr}`
        });
      }

      // Add location filters
      if (zone) filtersList.push({ key: "zone", cond: "equals", value: zone });
      if (plant) filtersList.push({ key: "sap_id", cond: "equals", value: plant });

      if (locationFilter.zone) filtersList.push({ key: "zone", cond: "equals", value: locationFilter.zone });
      if (locationFilter.plant) filtersList.push({ key: "sap_id", cond: "equals", value: locationFilter.plant });

      // Add alert status filter
      if (currentAlertStatus && currentAlertStatus !== 'All') {
        filtersList.push({
          key: "status",
          cond: "equals",
          value: currentAlertStatus
        });
      }

      const requestBody = {
        action: "tas_normal_count",
        drill_state: viewMode === "yearly" ? "" : "date",
        cross_filters: dateFilters,
        filters: filtersList,
        limit: 0,
        time_grain: viewMode === "weekly" ? "week" : "",
        resp_format: "",
        resp_level: "",
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", requestBody);
      const result = await response.data;

      const dataToProcess = viewMode === "yearly" ? (result.monthly_data || {}) : (result.daily_data || {});

      // Process data: Flatten the object structure
      const flattenedData: SummaryData[] = [];

      Object.entries(dataToProcess).forEach(([equipment, items]: [string, any]) => {
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            // Only include items for the current category
            if (item.alert_category === currentCategory) {
              flattenedData.push({
                zone: item.zone,
                location_name: item.location_name,
                sap_id: item.sap_id,
                alert_category: item.alert_category,
                device_name: equipment,
                alert_status: item.alert_status || "Open", // Assuming default or available in item
                interlock_name: item.interlock_name || item.alert_name || "Unknown",
                count: item.count
              });
            }
          });
        }
      });

      setSummaryData(flattenedData);

    } catch (error) {
      console.error("Error fetching summary data:", error);
      setSummaryData([]);
    }
  };

  const getTableKey = (category: string, index: number) => {
    return `${category.toLowerCase()}-${tableRefreshKey}-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${selectedZone}-${selectedPlant}-${selectedFromDate}-${selectedToDate}`;
  };

  // --- Controls handlers ---
  const handleViewModeChange = (value: "yearly" | "weekly") => {
    setViewMode(value);
    if (value === "weekly") {
      const newFrom = dayjs().subtract(6, "day");
      const newTo = dayjs();
      setFromDate(newFrom);
      setToDate(newTo);
      setSelectedFromDate(newFrom.format("YYYY-MM-DD"));
      setSelectedToDate(newTo.format("YYYY-MM-DD"));
    } else {
      setFromDate(null);
      setToDate(null);
      setSelectedFromDate("");
      setSelectedToDate("");
    }
    setSelectedRowDate(null);
  };

  const handleDateApply = (startDate: any, endDate: any) => {
    if (!startDate || !endDate) return;
    const today = dayjs().endOf("day");
    const start = startDate.isAfter(today) ? today : startDate;
    const end = endDate.isAfter(today) ? today : endDate;
    setFromDate(start);
    setToDate(end);
    setSelectedFromDate(start.format("YYYY-MM-DD"));
    setSelectedToDate(end.format("YYYY-MM-DD"));
    setSelectedRowDate(null);
  };

  const handleRefresh = () => {
    const newFrom = dayjs().subtract(6, "day");
    const newTo = dayjs();
    setViewMode("weekly");
    setFromDate(newFrom);
    setToDate(newTo);
    setSelectedFromDate(newFrom.format("YYYY-MM-DD"));
    setSelectedToDate(newTo.format("YYYY-MM-DD"));
    setSelectedRowDate(null);
    setSelectedEquipment({
      Safety: DEFAULT_EQUIPMENT.Safety,
      Process: DEFAULT_EQUIPMENT.Process,
      Gantry: DEFAULT_EQUIPMENT.Gantry,
    });
    setRefreshTrigger((prev) => prev + 1);
    setTableRefreshKey((prev) => prev + 1);
  };

  const handleDownloadExcel = async () => {
    const category = CATEGORIES[activeTab];
    const eqIndex = activeEquipmentTab[category] ?? 0;
    const equipment = availableEquipment[eqIndex];
    const refKey = equipment ? `${category}-${equipment}` : null;
    const chartRef = refKey ? chartRefsByEquipment.current[refKey] : chartRefs.current[activeTab];
    if (chartRef) {
      setIsDownloading(true);
      try {
        await chartRef.handleDownloadExcel();
      } finally {
        setIsDownloading(false);
      }
    }
  };

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  const singleCategoryMode = typeof initialTabIndex === "number" && (initialTabIndex === 0 || initialTabIndex === 1);
  const displayIndex = singleCategoryMode ? (initialTabIndex as number) : activeTab;

  return (
    <div className="bg-white p-1 pt-0">
      <style>{`
        @keyframes tasTabPanelEnter {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .tas-tab-panel-enter {
          animation: tasTabPanelEnter 0.25s ease-out forwards;
        }
      `}</style>
      <div ref={tableRef} className="rounded-md border border-gray-200 text-sm shadow">
        <Tabs
          variant="unstyled"
          className="w-full"
          index={singleCategoryMode ? displayIndex : activeTab}
          onChange={(index) => {
            if (!singleCategoryMode) {
            setActiveTab(index);
            setLoadedTabs((prev) => new Set([...prev, index]));
            setSelectedRowDate(null);
            }
          }}
        >
          {/* Tab header row (no filters here; filters are inside each equipment tab) */}
          <div className="flex items-center px-2 py-1">
            {!singleCategoryMode ? (
            <TabList className="flex">
              {CATEGORIES.map((category, index) => (
                <Tab
                  key={category}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors ${activeTab === index ? "text-blue-500" : "text-gray-600"
                    }`}
                >
                  {category}
                  {activeTab === index && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                  )}
                </Tab>
              ))}
            </TabList>
            ) : (
              <span className="flex-1" />
            )}
          </div>

          <TabPanels className="px-2 pt-0 pb-1">
            {CATEGORIES.map((category, index) => (
              <TabPanel key={category}>
                {loadedTabs.has(index) && (
                  <>
                    {/* Equipment tabs: one tab per equipment (VFT, Radar, etc.) */}
                    <Tabs
                      variant="unstyled"
                      className="w-full"
                      index={activeEquipmentTab[category] ?? 0}
                      onChange={(eqIndex) =>
                        setActiveEquipmentTab((prev) => ({ ...prev, [category]: eqIndex }))
                      }
                    >
                      <TabList className="flex w-full flex-wrap gap-1 border-b border-gray-200 pb-1 mb-0 min-h-0">
                        {availableEquipment.map((equipment, eqIndex) => {
                          const isActive = (activeEquipmentTab[category] ?? 0) === eqIndex;
                          const pillColor = TAB_PILL_COLORS[eqIndex % TAB_PILL_COLORS.length];
                          return (
                            <Tab
                              key={equipment}
                              className={`flex-1 min-w-[72px]  -mt-1 px-2.5 py-2.5 text-xs font-bold leading-tight transition-all rounded-full truncate min-h-[20px] flex items-center justify-center ${
                                isActive ? `${pillColor} ring-2 ring-offset-1 ring-blue-400 shadow-sm` : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                              }`}
                            >
                      {equipment}
                            </Tab>
                          );
                        })}
                      </TabList>
                      <TabPanels className="mt-0 overflow-hidden">
                        {availableEquipment.map((equipment, eqIndex) => {
                          const refKey = `${category}-${equipment}`;
                          const isActivePanel = (activeEquipmentTab[category] ?? 0) === eqIndex;
                          return (
                            <TabPanel key={equipment} className="p-0 space-y-3">
                              {isActivePanel && (
                              <div className="tas-tab-panel-enter">
                              <>
                              {/* Alert Summary: heading + search + Zone/Plant toggle + filters on same row */}
                              <div className="mb-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap py-2.5 -mb-1 -mt-1 px-1">
                                  <span className="text-xs font-semibold text-gray-600">
                                    {equipment} Alert Summary
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Input
                                      placeholder={summaryLocationTab === "zone" ? "Search zone..." : "Search location..."}
                                      value={summarySearchText}
                                      onChange={(e) => setSummarySearchText(e.target.value)}
                                      className="h-7 w-[650px] text-xs"
                                    />
                                    {/* {summaryLoading && (
                                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                    )} */}
                                    <div className="flex rounded-full bg-gray-200 p-0.5 shadow-inner">
                                      <button
                                        type="button"
                                        onClick={() => setSummaryLocationTab("zone")}
                                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${summaryLocationTab === "zone" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
                                      >
                                        Zone
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSummaryLocationTab("plant")}
                                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${summaryLocationTab === "plant" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
                                      >
                                        Plant
                                      </button>
                                    </div>
              <Select value={viewMode} onValueChange={handleViewModeChange}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="text-xs" value="yearly">Monthly</SelectItem>
                  <SelectItem className="text-xs" value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              {/* Date filter: disable for yearly/monthly + tooltip; weekly: maxDate=today */}
              {viewMode !== "weekly" ? (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <DateRangePickerFilter
                          fromDate={fromDate}
                          toDate={toDate}
                          onApply={handleDateApply}
                          disabled
                          maxDate={dayjs()}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      sideOffset={6}
                      className="max-w-[280px] rounded-lg px-4 py-3 text-xs shadow-sm z-[99999]"
                    >
                      Day-wise data is only available for weekly view.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <DateRangePickerFilter
                  fromDate={fromDate}
                  toDate={toDate}
                  onApply={handleDateApply}
                  disabled={isLoading}
                  maxDate={dayjs()}
                />
              )}
              <Button
                onClick={() => handleDownloadSummaryTable(category, equipment)}
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
                disabled={isSummaryTableDownloading || (() => {
                  const filtered = (summaryDataByCategory[category] ?? []).filter(
                    (row) =>
                      (row.device_name && equipment && String(row.device_name).toLowerCase() === String(equipment).toLowerCase()) ||
                      (equipment === "Gantry Override" && row.device_name === "Gantry Permissive_Override")
                  );
                  const rows = summaryLocationTab === "zone"
                    ? aggregateSummaryRowsByZone(filtered, summaryMonthColumns)
                    : filtered;
                  return rows.length === 0;
                })()}
                title="Download Alert Summary (Excel)"
              >
                {isSummaryTableDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={handleRefresh}
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
                                      title="Refresh"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
                                    {/* <Button
                onClick={toggleExpand}
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                                      title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
                                    </Button> */}
            </div>
                      </div>
                      <div
                                  className="ag-theme-alpine alert-summary-grid alert-summary-grid-with-total [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell]:[--ag-header-cell-hover-background-color:theme(colors.gray.200)]"
                                  style={{ height: "300px", width: "100%" } as React.CSSProperties}
                                >
                                  <style>{`
                                    .alert-summary-grid-with-total.ag-theme-alpine .ag-floating-bottom .ag-row .ag-cell { font-weight: 600; background-color: #f9fafb; }
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell,
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell .ag-header-cell-text,
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell .ag-header-cell-label,
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell .ag-header-cell-comp-wrapper { white-space: nowrap !important; overflow: visible !important; text-overflow: unset !important; }
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell .ag-sort-indicator-icon,
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell .ag-icon-asc,
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell .ag-icon-desc { display: none !important; }
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell .ag-sort-indicator-container { display: flex !important; align-items: center !important; min-width: 16px; }
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell .ag-sort-indicator-container::before { content: none !important; }
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell-sorted-asc .ag-sort-indicator-container::before { content: "↑" !important; color: #374151; font-size: 12px; line-height: 1; font-family: inherit; font-weight: normal; }
                                    .alert-summary-grid.ag-theme-alpine .ag-header-cell-sorted-desc .ag-sort-indicator-container::before { content: "↓" !important; color: #374151; font-size: 12px; line-height: 1; font-family: inherit; font-weight: normal; }
                                  `}</style>
                        <AgGridReact
                                    key={`summary-${refKey}-${viewMode}-${summaryMonthColumns.length}-${summaryMonthColumns.join("·")}`}
                                    rowData={(() => {
                                      const filtered = (summaryDataByCategory[category] ?? []).filter(
                                        (row) =>
                                          (row.device_name && equipment && String(row.device_name).toLowerCase() === String(equipment).toLowerCase()) ||
                                          (equipment === "Gantry Override" && row.device_name === "Gantry Permissive_Override")
                                      );
                                      return summaryLocationTab === "zone"
                                        ? aggregateSummaryRowsByZone(filtered, summaryMonthColumns)
                                        : filtered;
                                    })()}
                                    pinnedBottomRowData={(() => {
                                      const filtered = (summaryDataByCategory[category] ?? []).filter(
                                        (row) =>
                                          (row.device_name && equipment && String(row.device_name).toLowerCase() === String(equipment).toLowerCase()) ||
                                          (equipment === "Gantry Override" && row.device_name === "Gantry Permissive_Override")
                                      );
                                      const rows = summaryLocationTab === "zone"
                                        ? aggregateSummaryRowsByZone(filtered, summaryMonthColumns)
                                        : filtered;
                                      if (rows.length === 0) return [];
                                      const totalRow: SummaryData = {
                                        zone: "Total",
                                        location_name: "Total",
                                        sap_id: "",
                                        alert_category: "",
                                        device_name: "",
                                        count: 0,
                                      };
                                      summaryMonthColumns.forEach((m) => { totalRow[m] = 0; });
                                      rows.forEach((r) => {
                                        totalRow.count += r.count ?? 0;
                                        summaryMonthColumns.forEach((m) => {
                                          totalRow[m] = (Number(totalRow[m]) || 0) + (Number(r[m]) || 0);
                                        });
                                      });
                                      return [totalRow];
                                    })()}
                                    columnDefs={summaryColDefs}
                          defaultColDef={{
                            minWidth: 100,
                            resizable: true,
                            sortable: true,
                            filter: false,
                            suppressMenu: true,
                            suppressSizeToFit: true,
                          }}
                                    // wrapHeaderText={false}
                                    headerHeight={28}
                          rowHeight={25}
                                    pagination={true}
                                    paginationPageSize={10}
                                    paginationPageSizeSelector={[10, 20, 50]}
                                    quickFilterText={summarySearchText}
                          suppressCellFocus={true}
                          enableCellTextSelection={true}
                          domLayout="normal"
                          overlayNoRowsTemplate={
                            summaryLoading
                              ? '<span class="text-gray-400 text-xs">Loading...</span>'
                              : '<span class="text-gray-400 text-xs">No data available</span>'
                          }
                        />
                      </div>
                    </div>

                    <TASTrendChart
                      ref={(el) => {
                                  chartRefsByEquipment.current[refKey] = el;
                      }}
                      filters={filters}
                                selectedEquipment={equipment}
                      alertCategory={category}
                      onDateRangeSelect={(from, to) => {
                        setSelectedFromDate(from);
                        setSelectedToDate(to);
                      }}
                                onEquipmentChange={() => {}}
                      onRowDateSelect={setSelectedRowDate}
                      alertStatus={currentAlertStatus}
                      viewMode={viewMode}
                      isExpanded={isExpanded}
                      refreshTrigger={refreshTrigger}
                      fromDate={fromDate}
                      toDate={toDate}
                      onLoadingChange={(loading) => {
                        if (index === activeTab) setIsLoading(loading);
                      }}
                      onHasDataChange={(hd) => {
                        if (index === activeTab) setHasData(hd);
                      }}
                      onToggleExpand={toggleExpand}
                    />

                    <SafetyProcessGantryTable
                      query={getQuery(
                        "Open",
                        index,
                                  viewMode === "weekly" && fromDate && toDate
                                    ? fromDate.format("YYYY-MM-DD")
                                    : "",
                                  viewMode === "weekly" && fromDate && toDate
                                    ? toDate.format("YYYY-MM-DD")
                                    : "",
                                  selectedRowDate || undefined,
                                  equipment
                      )}
                      filters={filters}
                      onLocationChange={(plantId) =>
                        setLocationFilter((prev) => ({
                          ...prev,
                          plant: plantId,
                        }))
                      }
                      zone={zone}
                      plant={plant}
                      onAlertStatusChange={handleAlertStatusChange}
                      excludeProofTestRows={equipment === "VFT"}
                                key={`${getTableKey(category, index)}-${equipment}-${selectedRowDate ?? ''}`}
                              />
                              </>
                              </div>
                              )}
                            </TabPanel>
                          );
                        })}
                      </TabPanels>
                    </Tabs>
                  </>
                )}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};

export default TASTrendDashboard;