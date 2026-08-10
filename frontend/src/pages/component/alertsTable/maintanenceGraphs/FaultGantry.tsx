import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import type { SortDirection, GridReadyEvent } from "ag-grid-community"
import dayjs from "dayjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { Loader2, RotateCcw, Maximize2, Minimize2, X, Search, Info } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Input } from "@/@/components/ui/input"
import { DateRangePickerFilter } from "../../RetailTerminalHome/TASDashboards/DateRangePickerFilter"
import BCUGantryCount from "../maintanenceGraphs/BCUGantryCount"
import BCUGantryChart from "../maintanenceGraphs/BCUGantryChart"
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";
import { Download } from "lucide-react"
import { apiClient } from "@/services/apiClient"
import { saveAs } from 'file-saver';
import * as XLSX from "xlsx";
import { minWidth } from "@mui/system"
interface AggregatedData {
  totalCount: number;
  interlocks: Record<string, number>;
}
interface DataPoint {
  month?: string
  date?: string
  Normal: number
  interlockDetails?: string
}
interface DataContextType {
  date?: string;
}
interface DetailRow {
  sap_id: string
  zone: string
  location_name: string
  equipment_name?: string
  bcu_number?: string
  interlock_name?: string
  count: number
  month?: string
  date?: string
}

/** Yearly pivot: one row per location, month columns (e.g. "Jan 2026") with count per month */
interface PivotRow extends Record<string, string | number | undefined> {
  zone: string
  location_name: string
  sap_id: string
  bcu_number?: string
  interlock_name?: string
  count: number
}

interface FilterValue {
  key: string
  cond: string
  value: string
}
interface EquipmentChartProps {
  filters: FilterValue[];
  zone?: string | null;
  plant?: string | null;
  onInterlockSelect?: (interlockName: string) => void;
  onInterlockOptionsLoaded?: (interlockNames: string[]) => void;
  onDateRangeSelect?: (fromDate: string, toDate: string) => void;
  onBcuNumberSelect?: (bcuNumber: string) => void;
  onRefresh?: () => void;
  // alertStatus?: "All" | "Open" | "Close"; // Add this prop
  onAlertStatusChange?: (status: "All" | "Open" | "Close") => void;

}


const FaultGantry: React.FC<EquipmentChartProps> = ({ onRefresh, onDateRangeSelect, onInterlockSelect, onInterlockOptionsLoaded, filters, zone, plant, onBcuNumberSelect, onAlertStatusChange }) => {
  const rootRef = useRef<am5.Root | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<"yearly" | "weekly">("weekly")
  const [apiData, setApiData] = useState<DetailRow[]>([])
  const [filteredGridData, setFilteredGridData] = useState<DetailRow[]>([])
  const [fromDate, setFromDate] = useState(dayjs().subtract(6, "day"))
  const [toDate, setToDate] = useState(dayjs())
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>([])
  const [selectedZone, setSelectedZone] = useState<string>(zone || "")
  const [selectedPlant, setSelectedPlant] = useState<string>(plant || "")
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string>("count")
  const [selectedName, setSelectedName] = useState(null);
  const [selectedInterlockName, setSelectedInterlockName] = useState(null);
  // const [selectedBcuNumber, setSelectedBcuNumber] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [bcuNumberOptions, setBcuNumberOptions] = useState<string[]>([]);
  // const [bcuNumberOptions, setBcuNumberOptions] = useState<string[]>([]);
  const [selectedBcuNumber, setSelectedBcuNumber] = useState<string>("");
  const [selectedBcu, setSelectedBcu] = useState(undefined);
  const [localFilters, setLocalFilters] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [alertStatus, setAlertStatus] = useState<"All" | "Open" | "Close">("Open"); // Local state for alert status
  const [interlockNameOptions, setInterlockNameOptions] = useState<string[]>([]);
  const [selectedInterlock, setSelectedInterlock] = useState<string>("");
  const [allBcuNumberOptions, setAllBcuNumberOptions] = useState<string[]>([]);
  const [allInterlockNameOptions, setAllInterlockNameOptions] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [tableLocationTab, setTableLocationTab] = useState<"zone" | "plant">("plant");

  const tableGridApiRef = useRef<{ sizeColumnsToFit: () => void } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const fitTableColumns = useCallback(() => {
    const api = tableGridApiRef.current;
    if (!api) return;
    // In yearly/weekly pivot view, don't squeeze columns so full header names show; use horizontal scroll instead
    if (viewMode === "yearly" || viewMode === "weekly") return;
    api.sizeColumnsToFit();
  }, [viewMode]);

  const onTableGridReady = useCallback((params: GridReadyEvent) => {
    tableGridApiRef.current = params.api;
    if (viewMode === "yearly" || viewMode === "weekly") return;
    const fit = () => params.api.sizeColumnsToFit();
    fit();
    requestAnimationFrame(() => {
      fit();
      requestAnimationFrame(fit);
    });
  }, [viewMode]);

  useEffect(() => {
    fitTableColumns();
    const id = requestAnimationFrame(() => fitTableColumns());
    return () => cancelAnimationFrame(id);
  }, [viewMode, tableLocationTab, selectedInterlockName, fitTableColumns]);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fitTableColumns());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitTableColumns]);

  // When user returns to this tab (or chart container gets size), refit grid and refresh chart so component displays correctly
  const refreshLayout = useCallback(() => {
    fitTableColumns();
    requestAnimationFrame(() => fitTableColumns());
    const root = rootRef.current;
    if (root && typeof (root as any).invalidate === "function") {
      (root as any).invalidate();
    }
    try {
      window.dispatchEvent(new Event("resize"));
    } catch (_) {}
  }, [fitTableColumns]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      timeoutId = setTimeout(refreshLayout, 100);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [refreshLayout]);

  // When chart container is resized (e.g. tab shown, panel expanded), refresh chart layout
  useEffect(() => {
    const el = chartDivRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const root = rootRef.current;
      if (root && typeof (root as any).invalidate === "function") {
        (root as any).invalidate();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [refreshKey]);

  const today = dayjs();
  const sevenDaysAgo = today.subtract(6, "day");
  // Create a default date filter for the last 7 days
  const defaultDateFilter = {
    key: '"DATE"',
    cond: "equals",
    value: `${sevenDaysAgo.format("YYYY-MM-DD")},${today.format("YYYY-MM-DD")}`
  };

  const uniqueBcuNumbers = Array.from(new Set(apiData.map(item => item.bcu_number))).filter(Boolean);

  // Cascading filter: update BCU options when interlock is selected, and vice versa
  useEffect(() => {
    if (selectedInterlockName) {
      // Filter BCU options to only those that exist under the selected interlock name
      const filteredBcus = Array.from(
        new Set(apiData.filter(item => item.interlock_name === selectedInterlockName).map(item => item.bcu_number))
      ).filter(Boolean).sort();
      setBcuNumberOptions(filteredBcus);

      // If the currently selected BCU is not in the filtered list, reset it
      if (selectedBcuNumber && !filteredBcus.includes(selectedBcuNumber)) {
        setSelectedBcuNumber(null);
        setSelectedBcu(undefined);
        if (onBcuNumberSelect) {
          onBcuNumberSelect("");
        }
      }
    } else {
      // No interlock selected, show all BCU options
      setBcuNumberOptions(allBcuNumberOptions);
    }
  }, [selectedInterlockName, apiData, allBcuNumberOptions]);

  useEffect(() => {
    if (selectedBcuNumber) {
      // Filter interlock options to only those that exist under the selected BCU
      const filteredInterlocks = Array.from(
        new Set(apiData.filter(item => item.bcu_number === selectedBcuNumber).map(item => item.interlock_name))
      ).filter(Boolean).sort();
      setInterlockNameOptions(filteredInterlocks);

      // If the currently selected interlock is not in the filtered list, reset it
      if (selectedInterlockName && !filteredInterlocks.includes(selectedInterlockName)) {
        setSelectedInterlockName(null);
        setSelectedInterlock("");
        if (onInterlockSelect) {
          onInterlockSelect(null);
        }
      }
    } else {
      // No BCU selected, show all interlock options
      setInterlockNameOptions(allInterlockNameOptions);
    }
  }, [selectedBcuNumber, apiData, allInterlockNameOptions]);

  // Apply BCU and Interlock filters to apiData, and re-apply date filter if active
  useEffect(() => {
    if (activeFilter) {
      // If date filter is active, re-apply both filters
      const timeField = viewMode === "yearly" ? "month" : "date";
      let filtered = apiData.filter(item => {
        const itemTimeValue = item[timeField];
        if (viewMode === "yearly") {
          return itemTimeValue === activeFilter;
        } else {
          const itemDateStr = itemTimeValue ? itemTimeValue.toString().trim() : '';
          const timeValueStr = activeFilter ? activeFilter.toString().trim() : '';
          return itemDateStr === timeValueStr;
        }
      });

      // Apply BCU filter if selected
      if (selectedBcuNumber) {
        filtered = filtered.filter(item => item.bcu_number === selectedBcuNumber);
      }

      // Apply Interlock filter if selected
      if (selectedInterlockName) {
        filtered = filtered.filter(item => item.interlock_name === selectedInterlockName);
      }

      setFilteredGridData(filtered);
    } else {
      // Apply BCU and/or Interlock filter when no date filter is active
      if (selectedBcuNumber || selectedInterlockName) {
        let filteredData = [...apiData];

        if (selectedBcuNumber) {
          filteredData = filteredData.filter(item => item.bcu_number === selectedBcuNumber);
        }

        if (selectedInterlockName) {
          filteredData = filteredData.filter(item => item.interlock_name === selectedInterlockName);
        }

        setFilteredGridData(filteredData);

        // Pass the selected BCU number to the parent component
        if (onBcuNumberSelect && selectedBcuNumber) {
          onBcuNumberSelect(selectedBcuNumber);
        }
      } else {
        setFilteredGridData([]); // Clear filtered data when no filters are active
      }
    }
  }, [selectedBcuNumber, selectedInterlockName, apiData, onBcuNumberSelect, activeFilter, viewMode]);
  const handleInterlockSelect = (interlockName) => {
    setSelectedInterlockName(interlockName);
    setSelectedInterlock(interlockName || "");

    if (onInterlockSelect) {
      onInterlockSelect(interlockName);
    }
  };
  const handleInterlockNameChange = (value) => {
    const interlockValue = value === "All Interlocks" ? null : value;
    setSelectedInterlock(value === "All Interlocks" ? "" : value);
    setSelectedInterlockName(interlockValue);

    // When interlock changes, reset BCU selection since available BCUs will change
    if (interlockValue) {
      // Check if currently selected BCU is valid for the new interlock
      const bcusForInterlock = Array.from(
        new Set(apiData.filter(item => item.interlock_name === interlockValue).map(item => item.bcu_number))
      ).filter(Boolean);

      if (selectedBcuNumber && !bcusForInterlock.includes(selectedBcuNumber)) {
        setSelectedBcuNumber(null);
        setSelectedBcu(undefined);
        if (onBcuNumberSelect) {
          onBcuNumberSelect("");
        }
      }
    }

    // Create a new filters array
    const updatedFilters = [
      ...localFilters.filter(f => f.key !== "interlock_name"), // Remove existing interlock filter
      ...(value && value !== "All Interlocks"
        ? [{
          key: "interlock_name",
          cond: "equals",
          value: value
        }]
        : [])
    ];

    // Also remove BCU filter if it became invalid
    if (interlockValue && selectedBcuNumber) {
      const bcusForInterlock = Array.from(
        new Set(apiData.filter(item => item.interlock_name === interlockValue).map(item => item.bcu_number))
      ).filter(Boolean);

      if (!bcusForInterlock.includes(selectedBcuNumber)) {
        const filtersWithoutBcu = updatedFilters.filter(f => f.key !== "bcu_number");
        setLocalFilters(filtersWithoutBcu);
      } else {
        setLocalFilters(updatedFilters);
      }
    } else {
      setLocalFilters(updatedFilters);
    }

    setRefreshKey(prev => prev + 1);

    if (onInterlockSelect) {
      onInterlockSelect(interlockValue);
    }

    // Ensure date range is maintained when interlock is selected
    if (fromDate && toDate) {
      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      };

      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });
    }
  };

  const handleBcuNumberChange = (value) => {
    setSelectedBcu(value);
    setSelectedBcuNumber(value === "All BCUs" ? null : value);

    // Create a new filters array
    const updatedFilters = [
      ...localFilters.filter(f => f.key !== "bcu_number"), // Remove existing BCU filter
      ...(value && value !== "All BCUs"
        ? [{
          key: "bcu_number",
          cond: "equals",
          value: value
        }]
        : [])
    ];

    setLocalFilters(updatedFilters);
    setRefreshKey(prev => prev + 1);

    if (onBcuNumberSelect) {
      onBcuNumberSelect(value === "All BCUs" ? "" : value);
    }

    // Ensure date range is maintained when BCU is selected
    if (fromDate && toDate) {
      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      };

      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });
    }
  };
  const equipmentOptions = ["Secondary Radar", "VFT", "ESD", "HCD", "Dyke"]

  useEffect(() => {
    const initialFilters: FilterValue[] = [];
    const initialCrossFilters: FilterValue[] = [];

    if (zone) {
      initialFilters.push({
        key: "zone",
        cond: "equals",
        value: zone
      });
      setSelectedZone(zone);
    }

    if (plant) {
      initialFilters.push({
        key: "sap_id",
        cond: "equals",
        value: plant
      });
      setSelectedPlant(plant);
    }

    // Add BCU number filter to regular filters if selected
    if (selectedBcuNumber) {
      initialFilters.push({
        key: "bcu_number",
        cond: "equals",
        value: selectedBcuNumber
      });
    }

    // Add interlock name filter to regular filters if selected
    if (selectedInterlockName) {
      initialFilters.push({
        key: "interlock_name",
        cond: "equals",
        value: selectedInterlockName
      });
    }

    if (alertStatus && alertStatus !== "All") {
      initialFilters.push({
        key: "status",
        cond: "equals",
        value: alertStatus
      });
    }

    // Date filter will be added to crossFilters separately when dates change
    // Preserve existing custom date in crossFilters when only alertStatus/other filters change (e.g. "All" vs "Open")

    setIsInitialized(true);
    setLocalFilters(initialFilters); // Set initial local filters
    setCrossFilters(prev => {
      const existingDateFilter = prev.find(f => f.key === '"DATE"');
      return existingDateFilter ? [existingDateFilter] : initialCrossFilters;
    });
  }, [zone, plant, selectedBcuNumber, selectedInterlockName, alertStatus]);

  const rawTableData = filteredGridData.length > 0 ? filteredGridData : apiData

  // Normalize month string to "MMM YYYY" (e.g. Jan 2026, Dec 2025) for column headers
  const getMonthColumnKey = (monthOrDate: string | undefined): string => {
    if (!monthOrDate) return "";
    const d = dayjs(monthOrDate, ["YYYY-MM-DD", "YYYY-MM", "MMM YYYY", "MMM-DD-YYYY", "MMM"], true);
    if (d.isValid()) return d.format("MMM YYYY");
    if (typeof monthOrDate === "string" && /^\d{4}-\d{2}$/.test(monthOrDate))
      return dayjs(monthOrDate + "-01").format("MMM YYYY");
    return monthOrDate;
  };
  const sortMonthColumnKeys = (keys: string[]): string[] =>
    [...keys].filter(Boolean).sort((a, b) => dayjs(a, "MMM YYYY").valueOf() - dayjs(b, "MMM YYYY").valueOf());

  // Weekly: date column key "Feb 25", "Feb 26", etc. (display); sort by actual date.
  const getDateColumnKey = (dateStr: string | undefined): string => {
    if (!dateStr) return "";
    const d = dayjs(dateStr, ["YYYY-MM-DD", "MMM D", "MMM YYYY"], true);
    return d.isValid() ? d.format("MMM D") : dateStr;
  };
  const sortDateColumnKeys = (keys: string[]): string[] => {
    return [...keys]
      .filter(Boolean)
      .sort((a, b) => dayjs(a, ["MMM D", "YYYY-MM-DD"], true).valueOf() - dayjs(b, ["MMM D", "YYYY-MM-DD"], true).valueOf());
  };

  // Yearly: pivot by location, one column per month (Jan 2026, Feb 2026, Dec 2025, ...)
  const { pivotRows, monthColumns, pivotPinnedRow } = (() => {
    if (viewMode !== "yearly" || rawTableData.length === 0) {
      return { pivotRows: [] as PivotRow[], monthColumns: [] as string[], pivotPinnedRow: null as PivotRow | null };
    }
    const monthSet = new Set<string>();
    rawTableData.forEach((r: DetailRow) => {
      const mk = getMonthColumnKey(r.month ?? r.date);
      if (mk) monthSet.add(mk);
    });
    const monthCols = sortMonthColumnKeys(Array.from(monthSet));
    // Zone view: group by zone only, sum counts per month. Plant view: group by plant + SAP ID.
    const locationKey = (r: DetailRow) =>
      tableLocationTab === "zone"
        ? (r.zone ?? "")
        : `${r.location_name ?? ""}|${r.sap_id ?? ""}`;
    const pivotMap = new Map<string, PivotRow>();
    rawTableData.forEach((r: DetailRow) => {
      const key = locationKey(r);
      const monthKey = getMonthColumnKey(r.month ?? r.date);
      if (!monthKey) return;
      const add = r.count ?? 0;
      if (pivotMap.has(key)) {
        const row = pivotMap.get(key)!;
        const prev = (row[monthKey] as number) ?? 0;
        row[monthKey] = prev + add;
        row.count = (row.count as number) + add;
      } else {
        const row: PivotRow = {
          zone: r.zone ?? "",
          location_name: r.location_name ?? "",
          sap_id: r.sap_id ?? "",
          bcu_number: r.bcu_number ?? "",
          interlock_name: r.interlock_name ?? "",
          count: add,
        };
        row[monthKey] = add;
        pivotMap.set(key, row);
      }
    });
    const rows = Array.from(pivotMap.values()).sort((a, b) => (b.count as number) - (a.count as number));
    const pinned: PivotRow = {
      zone: "Total",
      location_name: "Total",
      sap_id: "",
      bcu_number: "",
      interlock_name: "",
      count: rows.reduce((sum, r) => sum + (r.count as number), 0),
    };
    monthCols.forEach((m) => {
      pinned[m] = rows.reduce((sum, r) => sum + ((r[m] as number) ?? 0), 0);
    });
    return { pivotRows: rows, monthColumns: monthCols, pivotPinnedRow: pinned };
  })();

  // Weekly: pivot by location, one column per date (Feb 25, Feb 26, ...)
  const { weeklyPivotRows, dateColumns, weeklyPivotPinnedRow } = (() => {
    if (viewMode !== "weekly" || rawTableData.length === 0) {
      return { weeklyPivotRows: [] as PivotRow[], dateColumns: [] as string[], weeklyPivotPinnedRow: null as PivotRow | null };
    }
    const dateSet = new Set<string>();
    rawTableData.forEach((r: DetailRow) => {
      const dk = getDateColumnKey(r.date ?? r.month);
      if (dk) dateSet.add(dk);
    });
    const dateCols = sortDateColumnKeys(Array.from(dateSet));
    // Zone view: group by zone only, sum counts per date. Plant view: group by plant + SAP ID.
    const locationKey = (r: DetailRow) =>
      tableLocationTab === "zone"
        ? (r.zone ?? "")
        : `${r.location_name ?? ""}|${r.sap_id ?? ""}`;
    const pivotMap = new Map<string, PivotRow>();
    rawTableData.forEach((r: DetailRow) => {
      const key = locationKey(r);
      const dateKey = getDateColumnKey(r.date ?? r.month);
      if (!dateKey) return;
      const add = r.count ?? 0;
      if (pivotMap.has(key)) {
        const row = pivotMap.get(key)!;
        const prev = (row[dateKey] as number) ?? 0;
        row[dateKey] = prev + add;
        row.count = (row.count as number) + add;
      } else {
        const row: PivotRow = {
          zone: r.zone ?? "",
          location_name: r.location_name ?? "",
          sap_id: r.sap_id ?? "",
          bcu_number: r.bcu_number ?? "",
          interlock_name: r.interlock_name ?? "",
          count: add,
        };
        row[dateKey] = add;
        pivotMap.set(key, row);
      }
    });
    const rows = Array.from(pivotMap.values()).sort((a, b) => (b.count as number) - (a.count as number));
    const pinned: PivotRow = {
      zone: "Total",
      location_name: "Total",
      sap_id: "",
      bcu_number: "",
      interlock_name: "",
      count: rows.reduce((sum, r) => sum + (r.count as number), 0),
    };
    dateCols.forEach((d) => {
      pinned[d] = rows.reduce((sum, r) => sum + ((r[d] as number) ?? 0), 0);
    });
    return { weeklyPivotRows: rows, dateColumns: dateCols, weeklyPivotPinnedRow: pinned };
  })();

  // Fallback: weekly flat list (when no pivot dates)
  const aggregatedByDateAndLocation = (() => {
    if (viewMode === "yearly") return [];
    if (viewMode === "weekly" && dateColumns.length > 0) return [];
    const key = (r: DetailRow) =>
      `${r.date ?? r.month ?? ""}|${r.location_name ?? ""}`;
    const map = new Map<string, { row: DetailRow; count: number }>();
    for (const r of rawTableData) {
      const k = key(r);
      const existing = map.get(k);
      if (existing) {
        existing.count += r.count ?? 0;
      } else {
        map.set(k, { row: { ...r, count: r.count ?? 0 }, count: r.count ?? 0 });
      }
    }
    const rows = Array.from(map.values()).map(({ row, count }) => ({ ...row, count }));
    rows.sort((a, b) => {
      const d = (a.date ?? "").localeCompare(b.date ?? "", undefined, { numeric: true });
      if (d !== 0) return d;
      return (a.location_name ?? "").localeCompare(b.location_name ?? "");
    });
    return rows;
  })();

  const isYearlyPivot = viewMode === "yearly" && monthColumns.length > 0;
  const isWeeklyPivot = viewMode === "weekly" && dateColumns.length > 0;
  const tableRowData = isYearlyPivot
    ? pivotRows
    : isWeeklyPivot
      ? weeklyPivotRows
      : aggregatedByDateAndLocation;
  const tableTotalCount = isYearlyPivot
    ? (pivotPinnedRow?.count as number) ?? 0
    : isWeeklyPivot
      ? (weeklyPivotPinnedRow?.count as number) ?? 0
      : aggregatedByDateAndLocation.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const pinnedBottomRowData = isYearlyPivot
    ? (pivotPinnedRow ? [pivotPinnedRow] : [])
    : isWeeklyPivot
      ? (weeklyPivotPinnedRow ? [weeklyPivotPinnedRow] : [])
      : tableRowData.length > 0
        ? [{
            date: "Total",
            month: "Total",
            zone: "",
            location_name: "",
            sap_id: "",
            equipment_name: "",
            bcu_number: "",
            interlock_name: "",
            count: tableTotalCount,
          } as DetailRow]
        : [];

  const showBcuNumberColumn = !!(selectedBcuNumber || (selectedBcu && selectedBcu !== "All BCUs"));

  const columnDefs = isYearlyPivot
    ? [
        ...(tableLocationTab === "zone"
          ? [{ headerName: "Zone", field: "zone", flex: 1, minWidth: 110, pinned: "left" as const, getQuickFilterText: (params: any) => String(params.value ?? "") }]
          : [{ headerName: "Plant", field: "location_name", flex: 1, minWidth: 200, pinned: "left" as const, getQuickFilterText: (params: any) => String(params.value ?? "") }]),
        ...(showBcuNumberColumn ? [{ headerName: "BCU Number", field: "bcu_number", flex: 1, minWidth: 90 }] : []),
        ...(selectedInterlockName ? [{ headerName: "Interlock Name", field: "interlock_name", flex: 1, minWidth: 140 }] : []),
        ...monthColumns.map((monthKey, idx) => {
          const periodOrder = monthColumns;
          return {
            headerName: monthKey,
            field: monthKey,
            flex: 1,
            minWidth: 100,
            valueGetter: (params: any) => params.data?.[monthKey] ?? 0,
            cellRenderer: (params: any) => {
              if (params.node?.rowPinned === "bottom") return params.value ?? 0;
              const currentVal = Number(params.value ?? 0);
              const prevKey = idx > 0 ? periodOrder[idx - 1] : null;
              const prevVal = prevKey != null ? Number(params.data?.[prevKey] ?? 0) : null;
              const allPrevPeriodsZero = idx === 0 || periodOrder.slice(0, idx).every((k) => Number(params.data?.[k] ?? 0) === 0);
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
              } else if (currentVal > 0 && allPrevPeriodsZero) {
                badgeStyle = { backgroundColor: "#f3f4f6", color: "#374151" };
                arrow = null;
              } else if (prevKey == null) {
                badgeStyle = { backgroundColor: "#f3f4f6", color: "#374151" };
                arrow = null;
              } else if (currentVal > prevVal) {
                badgeStyle = { backgroundColor: "#fee2e2", color: "#dc2626" };
                arrow = <span style={{ marginLeft: 4, color: "#dc2626" }}>↑</span>;
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
                    minWidth: 36,
                    ...badgeStyle,
                  }}
                >
                  {currentVal}
                  {arrow}
                </span>
              );
            },
          };
        }),
        { headerName: "Total", field: "count", flex: 1, minWidth: 96, sort: "desc" as SortDirection, pinned: "right" as const, sortable: true, filter: false },
      ]
    : isWeeklyPivot
      ? [
          ...(tableLocationTab === "zone"
            ? [{ headerName: "Zone", field: "zone", flex: 1, minWidth: 110, pinned: "left" as const }]
            : [{ headerName: "Plant", field: "location_name", flex: 1, minWidth: 200, pinned: "left" as const }]),
          ...(showBcuNumberColumn ? [{ headerName: "BCU Number", field: "bcu_number", flex: 1, minWidth: 90 }] : []),
          ...(selectedInterlockName ? [{ headerName: "Interlock Name", field: "interlock_name", flex: 1, minWidth: 140 }] : []),
          ...dateColumns.map((dateKey, idx) => {
            const periodOrder = dateColumns;
            return {
              headerName: dateKey,
              field: dateKey,
              flex: 1,
              minWidth: 100,
              valueGetter: (params: any) => params.data?.[dateKey] ?? 0,
              cellRenderer: (params: any) => {
                if (params.node?.rowPinned === "bottom") return params.value ?? 0;
                const currentVal = Number(params.value ?? 0);
                const prevKey = idx > 0 ? periodOrder[idx - 1] : null;
                const prevVal = prevKey != null ? Number(params.data?.[prevKey] ?? 0) : null;
                const allPrevPeriodsZero = idx === 0 || periodOrder.slice(0, idx).every((k) => Number(params.data?.[k] ?? 0) === 0);
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
                } else if (currentVal > 0 && allPrevPeriodsZero) {
                  badgeStyle = { backgroundColor: "#f3f4f6", color: "#374151" };
                  arrow = null;
                } else if (prevKey == null) {
                  badgeStyle = { backgroundColor: "#f3f4f6", color: "#374151" };
                  arrow = null;
                } else if (currentVal > prevVal) {
                  badgeStyle = { backgroundColor: "#fee2e2", color: "#dc2626" };
                  arrow = <span style={{ marginLeft: 4, color: "#dc2626" }}>↑</span>;
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
                      minWidth: 32,
                      ...badgeStyle,
                    }}
                  >
                    {currentVal}
                    {arrow}
                  </span>
                );
              },
            };
          }),
          { headerName: "Total", field: "count", flex: 1, minWidth: 96, sort: "desc" as SortDirection, pinned: "right" as const, sortable: true, filter: false },
        ]
      : [
          {
            headerName: "Date",
            field: "date" as keyof DetailRow,
            sort: "desc" as SortDirection,
            flex: 1,
            minWidth: 100,
            pinned: "left" as const,
            valueFormatter: (params: any) => {
              if (params.node?.rowPinned === "bottom") return "Total";
              const val = params.value ?? "";
              if (!val) return "";
              const d = dayjs(val, ["YYYY-MM-DD", "MMM YYYY"], true);
              if (d.isValid()) return d.format("MMM D");
              return String(val);
            },
          },
          ...(tableLocationTab === "zone"
            ? [{ headerName: "Zone", field: "zone" as keyof DetailRow, flex: 1, minWidth: 80, getQuickFilterText: (params: any) => String(params.value ?? "") }]
            : [{ headerName: "Plant", field: "location_name" as keyof DetailRow, flex: 1, minWidth: 120, getQuickFilterText: (params: any) => String(params.value ?? "") }]),
          ...(showBcuNumberColumn ? [{ headerName: "BCU Number", field: "bcu_number" as keyof DetailRow, flex: 1, minWidth: 90 }] : []),
          ...(selectedInterlockName ? [{ headerName: "Interlock Name", field: "interlock_name" as keyof DetailRow, flex: 1, minWidth: 120 }] : []),
          {
            headerName: "Count",
            field: "count" as keyof DetailRow,
            flex: 1,
            minWidth: 100,
          },
        ]

  // Refit columns when table data or period columns change (e.g. after filter/date change)
  useEffect(() => {
    const t = setTimeout(fitTableColumns, 120);
    return () => clearTimeout(t);
  }, [tableRowData.length, dateColumns.length, monthColumns.length, alertStatus, fitTableColumns]);

  const handleDownloadBcuAlertSummary = () => {
    if (tableRowData.length === 0 && pinnedBottomRowData.length === 0) {
      toast.info("No data to export.");
      return;
    }
    setIsBcuSummaryDownloading(true);
    try {
      const numericFields = new Set<string>(["count", ...monthColumns, ...dateColumns]);
      const headers = columnDefs.map((c: { headerName?: string; field?: string }) => ({
        headerName: c.headerName || (c.field as string) || "",
        field: c.field as string,
      }));
      const toExcelRow = (row: DetailRow | PivotRow): Record<string, unknown> => {
        const obj: Record<string, unknown> = {};
        const r = row as Record<string, unknown>;
        headers.forEach(({ headerName, field }) => {
          if (!field) return;
          const val = r[field];
          obj[headerName] = numericFields.has(field) ? (val !== undefined && val !== null ? Number(val) : 0) : (val ?? "");
        });
        return obj;
      };
      const excelRows: Record<string, unknown>[] = [
        ...tableRowData.map(toExcelRow),
        ...pinnedBottomRowData.map(toExcelRow),
      ];
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BCU Alarm Alert Summary");
      const filename = `BCU_Alarm_Alert_Summary_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success("BCU Alarm Alert Summary downloaded.");
    } catch (e) {
      toast.error("Failed to download Excel.");
    } finally {
      setIsBcuSummaryDownloading(false);
    }
  };

  const handleRefresh = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      setIsTransitioning(true);
      setError(null);
      setActiveFilter(null);

      // Reset BCU number selection
      const previousBcuNumber = selectedBcuNumber;
      setSelectedBcuNumber(null);
      setSelectedBcu("");

      // Reset interlock name selection
      setSelectedInterlock("");
      setSelectedInterlockName(null);

      // Reset filtered options back to all
      setBcuNumberOptions(allBcuNumberOptions);
      setInterlockNameOptions(allInterlockNameOptions);

      // Reset alert status to default "Open"
      setAlertStatus("Open");

      // Notify parent of BCU number reset
      if (onBcuNumberSelect && previousBcuNumber) {
        onBcuNumberSelect("");
      }

      // Notify parent of interlock reset
      if (onInterlockSelect) {
        onInterlockSelect(null);
      }

      // Notify parent of alert status reset to default
      if (onAlertStatusChange) {
        onAlertStatusChange("Open");
      }

      // Always set view mode to weekly when refreshing
      setViewMode("weekly");

      // Set date range to default (last 7 days) for weekly view
      const defaultFromDate = dayjs().subtract(6, "day");
      const defaultToDate = dayjs();

      // Update state with the new date range
      setFromDate(defaultFromDate);
      setToDate(defaultToDate);

      // Notify parent of the new date range
      if (onDateRangeSelect) {
        const fromDateStr = defaultFromDate.format("YYYY-MM-DD");
        const toDateStr = defaultToDate.format("YYYY-MM-DD");
        onDateRangeSelect(fromDateStr, toDateStr);
      }

      // Update cross filters with the new date range
      setCrossFilters(prevFilters => {
        const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
        return [...filtersWithoutDate, {
          key: '"DATE"',
          cond: "equals",
          value: `${defaultFromDate.format("YYYY-MM-DD")},${defaultToDate.format("YYYY-MM-DD")}`
        }];
      });

      // Set localFilters so chart fetch uses "Open" filter (avoids donut showing "All" data after refresh)
      const refreshFilters: FilterValue[] = [];
      if (zone) refreshFilters.push({ key: "zone", cond: "equals", value: zone });
      if (plant) refreshFilters.push({ key: "sap_id", cond: "equals", value: plant });
      refreshFilters.push({ key: "status", cond: "equals", value: "Open" });
      setLocalFilters(refreshFilters);

      if (onRefresh) {
        onRefresh();
      }
      setFilteredGridData([]);

      // Force refresh of the chart
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to refresh data");
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };
  // Handle date apply - only applies when Apply button is clicked. Clamp to today so future dates are not used.
  const handleDateApply = (startDate, endDate) => {
    if (!startDate || !endDate) return;

    const today = dayjs().endOf("day");
    const clampedEnd = endDate.isAfter(today) ? today : endDate;
    const clampedStart = startDate.isAfter(today) ? today : startDate;
    const from = clampedStart.isAfter(clampedEnd) ? clampedEnd : clampedStart;
    const to = clampedStart.isAfter(clampedEnd) ? clampedStart : clampedEnd;

    const formatDate = (date) => {
      return date ? date.format("YYYY-MM-DD") : "";
    };

    setFromDate(from);
    setToDate(to);

    // Always notify parent of the current date range selection
    if (onDateRangeSelect) {
      onDateRangeSelect(formatDate(from), formatDate(to));
    }

    // Add date filter for both weekly and monthly views
      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
      value: `${formatDate(from)},${formatDate(to)}`,
      };

      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });

      // Reset active filter
      setActiveFilter(null);
      setFilteredGridData([]);

      // Refresh the data
      setRefreshKey((prev) => prev + 1);
  };


  useEffect(() => {
    // Pass the initial date range to parent component when component mounts
    if (onDateRangeSelect && fromDate && toDate) {
      const formatDate = (date) => date.format("YYYY-MM-DD");
      onDateRangeSelect(formatDate(fromDate), formatDate(toDate));
    }
  }, []);



  const fetchData = async () => {
    if (isFetching) return; // Prevent duplicate API calls

    setIsFetching(true);
    setIsLoading(true);
    setIsTransitioning(true);
    setError(null); // Clear any previous errors

    try {
      const apiEndpoint = "/api/charts/generate_vis_data";

      // Determine which filters to use for cross_filters
      const effectiveCrossFilters =
        viewMode === "yearly"
          ? crossFilters.some(f => f.key === '"DATE"')
            ? crossFilters.filter(f => f.key === '"DATE"')
            : []
          : crossFilters.some(f => f.key === '"DATE"')
            ? crossFilters.filter(f => f.key === '"DATE"')
            : [defaultDateFilter];

      // Create request body
      const requestBody = {
        action: "interlock_name_count",
        drill_state: viewMode === "yearly" ? "" : "date",
        filters: [...localFilters], // Use localFilters for BCU and other non-date filters
        cross_filters: effectiveCrossFilters,
        limit: 0,
        time_grain: viewMode === "yearly" ? "" : "week",
        resp_format: "",
        resp_level: "",
      };
      // Show loading spinner before fetch
      toast.info("Fetching data...", { id: "fetch-toast" });

      const response = await apiClient.post(apiEndpoint, requestBody);

      if (!response.status) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.data;

      // Dismiss the loading toast
      toast.dismiss("fetch-toast");

      if (!result || (!result.monthly_data && !result.daily_data)) {
        toast.info("No data found");
        setError("No data found");
        return { data: {}, mode: viewMode === "yearly" ? "yearly" : "weekly" };
      }

      setError(null);
      toast.success("Data loaded successfully");
      return viewMode === "yearly"
        ? { data: result.monthly_data || {}, mode: "yearly" }
        : { data: result.daily_data || {}, mode: "weekly" };
    } catch (error) {
      toast.error(`Failed to fetch data: ${error instanceof Error ? error.message : "Unknown error"}`);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
      return { data: {}, mode: viewMode === "yearly" ? "yearly" : "weekly" };
    } finally {
      // Only hide loading states when everything is processed
      setTimeout(() => {
        setIsLoading(false);
        setIsTransitioning(false);
        setIsFetching(false); // Reset fetch flag after request completes
      }, 300); // Small delay to ensure UI updates smoothly
    }
  };
  const monthMapping: Record<string, number> = {
    'Jan': 1,
    'Feb': 2,
    'Mar': 3,
    'Apr': 4,
    'May': 5,
    'Jun': 6,
    'Jul': 7,
    'Aug': 8,
    'Sep': 9,
    'Oct': 10,
    'Nov': 11,
    'Dec': 12
  };

  // Parse month string (e.g. "Feb-2025" or "01-Feb-2025") to sort key: year*12 + month (chronological)
  const getMonthSortKey = (monthStr: string): number => {
    if (!monthStr || typeof monthStr !== 'string') return 0;
    const parts = monthStr.trim().split('-');
    let monthPart: string;
    let yearPart: string;
    if (parts.length >= 3) {
      // "01-Feb-2025" or "1-Feb-2025" → month name at index 1, year at index 2
      monthPart = parts[1];
      yearPart = parts[2];
    } else if (parts.length === 2) {
      // "Feb-2025"
      monthPart = parts[0];
      yearPart = parts[1];
    } else {
      return 0;
    }
    const monthNum = monthMapping[monthPart] || 0;
    const yearNum = parseInt(yearPart, 10) || 0;
    return yearNum * 12 + monthNum;
  };

  // Convert month string (e.g. "Feb-2025" or "01-Feb-2025") to first day as YYYY-MM-DD (same format as weekly x-axis)
  const monthStrToDateStr = (monthStr: string): string => {
    if (!monthStr || typeof monthStr !== 'string') return monthStr ?? '';
    const key = getMonthSortKey(monthStr);
    if (key <= 0) return monthStr;
    const year = Math.floor(key / 12);
    const month = key % 12 || 12;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  };

  const processData = (apiResponse: any) => {
    const data = apiResponse.data || {};
    const gantryData = data.gantry || {};
    const processData = data.process || {};
    let graphData: any[] = [];
    let allDetails: any[] = [];
    let allBcuNumbers: Set<string> = new Set(); // Track all BCU numbers from unfiltered data
    let allInterlockNames: Set<string> = new Set(); // Track all interlock names from unfiltered data

    // Create a combined dataset with counts summed by BCU and date/month
    const combinedData: Record<string, Record<string, {
      count: number;
      interlocks: Record<string, number>;
      bcuNumber: string;
    }>> = {};

    // Helper function to process data from either source
    const processSourceData = (sourceData: Record<string, any>, sourceName: string) => {
      Object.entries(sourceData).forEach(([timePeriod, categoryData]) => {
        if (!categoryData || typeof categoryData !== "object") return;

        const categories = categoryData as Record<string, any>;
        const normalData = categories?.Normal || {};
        const details = normalData?.details || [];

        details.forEach((detail: any) => {
          // Track all BCU numbers before any filtering
          if (detail.bcu_number) {
            allBcuNumbers.add(detail.bcu_number);
          }
          // Track all interlock names before any filtering
          if (detail.interlock_name) {
            allInterlockNames.add(detail.interlock_name);
          }

          // Skip if interlock filter is active and doesn't match
          if (selectedInterlockName && detail.interlock_name !== selectedInterlockName) {
            return;
          }

          const detailWithTime = {
            ...detail,
            source: sourceName,
            [apiResponse.mode === "yearly" ? "month" : "date"]: timePeriod
          };
          allDetails.push(detailWithTime);

          const bcuKey = detail.bcu_number || "Unknown";
          const timeKey = timePeriod;

          if (!combinedData[timeKey]) {
            combinedData[timeKey] = {};
          }

          if (!combinedData[timeKey][bcuKey]) {
            combinedData[timeKey][bcuKey] = {
              count: 0,
              interlocks: {},
              bcuNumber: bcuKey
            };
          }

          combinedData[timeKey][bcuKey].count += detail.count || 0;

          const interlockName = detail.bcu_number || "Unknown";
          if (!combinedData[timeKey][bcuKey].interlocks[interlockName]) {
            combinedData[timeKey][bcuKey].interlocks[interlockName] = 0;
          }
          combinedData[timeKey][bcuKey].interlocks[interlockName] += detail.count || 0;
        });
      });
    };

    // Process both data sources
    processSourceData(gantryData, 'gantry');
    processSourceData(processData, 'process');

    // Convert combined data to chart format with detailed tooltips
    Object.entries(combinedData).forEach(([timePeriod, bcuMap]) => {
      // Prepare interlock details for tooltip
      const interlockDetails: string[] = [];

      Object.values(bcuMap).forEach(bcuData => {
        Object.entries(bcuData.interlocks).forEach(([interlockName, count]) => {
          interlockDetails.push(`BCU No.:${interlockName},Alerts: ${count}`);
        });
      });

      // Calculate total count for this time period
      const totalCount = Object.values(bcuMap).reduce((sum, bcuData) => sum + bcuData.count, 0);

      graphData.push({
        [apiResponse.mode === "yearly" ? "month" : "date"]: timePeriod,
        Normal: totalCount,
        interlockDetails: interlockDetails.join('\n')
      });
    });

    // Date filtering logic remains the same as in the previous implementation
    if (apiResponse.mode === "weekly") {
      // Filter out invalid dates and sort
      graphData = graphData.filter(item => item.date && !isNaN(new Date(item.date).getTime()));
      allDetails = allDetails.filter(item => item.date && !isNaN(new Date(item.date).getTime()));
      graphData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Check if a date filter is present in crossFilters
      const hasDateFilter = crossFilters.some(filter => filter.key === '"DATE"');

      // Always show the last 7 days if no explicit date filter is set
      if (!hasDateFilter) {
        const today = dayjs();
        const sevenDaysAgo = today.subtract(6, "day");

        // Filter data to last 7 days
        graphData = graphData.filter(item => {
          const itemDate = dayjs(item.date);
          return itemDate.isAfter(sevenDaysAgo) || itemDate.isSame(sevenDaysAgo, 'day');
        });

        allDetails = allDetails.filter(item => {
          const itemDate = dayjs(item.date);
          return itemDate.isAfter(sevenDaysAgo) || itemDate.isSame(sevenDaysAgo, 'day');
        });
      }
    }
    if (apiResponse.mode === "yearly") {
      // Sort months chronologically (year then month), supporting "Feb-2025" and "01-Feb-2025" formats
      graphData.sort((a, b) => getMonthSortKey(a.month) - getMonthSortKey(b.month));

      allDetails.sort((a, b) => getMonthSortKey(a.month) - getMonthSortKey(b.month));
    }

    return {
      graphData: graphData,
      apiData: allDetails,
      allBcuNumbers: Array.from(allBcuNumbers), // Return all BCU numbers from unfiltered data
      allInterlockNames: Array.from(allInterlockNames), // Return all interlock names from unfiltered data
    };
  };




  const filterGridDataByPoint = (timeValue: string) => {
    const timeField = viewMode === "yearly" ? "month" : "date";
    if (activeFilter === timeValue) {
      setActiveFilter(null);
      setFilteredGridData([]);
      // Clear date filter when clicking the same point again
      if (onDateRangeSelect) {
        onDateRangeSelect("", "");
      }
      return;
    }
    setActiveFilter(timeValue);

    // Filter apiData by the selected date/month
    let filtered = apiData.filter(item => {
      const itemTimeValue = item[timeField];
      // For date comparison, ensure both are in the same format
      if (viewMode === "yearly") {
        return itemTimeValue === timeValue;
      } else {
        // For weekly view, compare dates (handle potential format differences)
        // Normalize both values to strings for comparison
        const itemDateStr = itemTimeValue ? itemTimeValue.toString().trim() : '';
        const timeValueStr = timeValue ? timeValue.toString().trim() : '';
        const matches = itemDateStr === timeValueStr;
        return matches;
      }
    });

    // Also apply BCU filter if one is selected
    if (selectedBcuNumber) {
      filtered = filtered.filter(item => item.bcu_number === selectedBcuNumber);
    }

    // Also apply Interlock filter if one is selected
    if (selectedInterlockName) {
      filtered = filtered.filter(item => item.interlock_name === selectedInterlockName);
    }

    console.log('Filtering data for date:', timeValue, 'BCU:', selectedBcuNumber || 'All', 'Interlock:', selectedInterlockName || 'All', 'Filtered count:', filtered.length, 'Total count:', apiData.length);
    setFilteredGridData(filtered);

    // Convert timeValue to date range format and pass to parent
    if (onDateRangeSelect) {
      if (viewMode === "yearly") {
        // For yearly view, timeValue may be "Mar-2025" or "01-Feb-2025"
        const parts = timeValue.split("-");
        const monthName = parts.length >= 3 ? parts[1] : parts[0];
        const year = parts.length >= 3 ? parts[2] : parts[1];
        const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
        const startDate = dayjs(`${year}-${String(monthIndex + 1).padStart(2, '0')}-01`);
        const daysInMonth = new Date(parseInt(year, 10), monthIndex + 1, 0).getDate();
        const endDate = dayjs(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`);
        onDateRangeSelect(startDate.format("YYYY-MM-DD"), endDate.format("YYYY-MM-DD"));
      } else {
        // For weekly view, timeValue is already a date string like "2025-01-15"
        // Use the same date for both from and to
        onDateRangeSelect(timeValue, timeValue);
      }
    }
  };

  useEffect(() => {
    if (!isInitialized) return;
    let root = null;

    const initChart = async () => {
      if (!chartDivRef.current) {
        // console.error("Chart div not found");
        return;
      }
      if (rootRef.current) {
        rootRef.current.dispose()
        rootRef.current = null;
      }

      const apiResponse = await fetchData()
      if (!apiResponse) return

      const { graphData, apiData, allBcuNumbers, allInterlockNames } = processData(apiResponse)
      setApiData(apiData)

      // Store the full unfiltered BCU and interlock options
      if (allBcuNumbers && allBcuNumbers.length > 0) {
        const sortedBcus = allBcuNumbers.sort();
        setAllBcuNumberOptions(sortedBcus);
        // Only set visible options if no interlock filter is active
        if (!selectedInterlockName) {
          setBcuNumberOptions(sortedBcus);
        } else {
          // Re-derive filtered BCU options based on current interlock selection
          const filteredBcus = Array.from(
            new Set(apiData.filter(item => item.interlock_name === selectedInterlockName).map(item => item.bcu_number))
          ).filter(Boolean).sort();
          setBcuNumberOptions(filteredBcus.length > 0 ? filteredBcus : sortedBcus);
        }
      }

      // Store the full unfiltered interlock options
      if (allInterlockNames && allInterlockNames.length > 0) {
        const sortedInterlocks = allInterlockNames.sort();
        setAllInterlockNameOptions(sortedInterlocks);
        onInterlockOptionsLoaded?.(sortedInterlocks);
        // Only set visible options if no BCU filter is active
        if (!selectedBcuNumber) {
          setInterlockNameOptions(sortedInterlocks);
        } else {
          // Re-derive filtered interlock options based on current BCU selection
          const filteredInterlocks = Array.from(
            new Set(apiData.filter(item => item.bcu_number === selectedBcuNumber).map(item => item.interlock_name))
          ).filter(Boolean).sort();
          setInterlockNameOptions(filteredInterlocks.length > 0 ? filteredInterlocks : sortedInterlocks);
        }
      }

      setFilteredGridData([])
      setActiveFilter(null)

      root = am5.Root.new(chartDivRef.current)
      rootRef.current = root
      root._logo?.dispose()

      root.setThemes([am5themes_Animated.new(root)])

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingTop: 0,
          paddingBottom: 0,
          paddingRight: 30,
          paddingLeft: 50,
        }),
      )
      const maxValue = Math.max(...graphData.map(item => item.Normal))
      const yAxisMax = Math.ceil(maxValue * 1.3)
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: 0,
          max: yAxisMax > 0 ? yAxisMax : 10, // Use default of 10 if no data
          renderer: am5xy.AxisRendererY.new(root, {
            minGridDistance: 30,
            opposite: false // Ensure axis is on the left side
          }),
        }),
      )
      yAxis.children.push(
        am5.Label.new(root, {
          text: "Alert Count",
          rotation: -90,
          fontSize: 12,
          fontWeight: "bold",
          fill: am5.color(0x000000),
          y: am5.p50,
          centerY: am5.p50,
          marginLeft: -75,
          paddingRight: 10
        })
      );
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
        fontWeight: "bold"
      })
      const categoryField = viewMode === "yearly" ? "month" : "date"

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: categoryField,
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 0,
          }),
          start: 0,
          end: 1
        }),
      )

      // Make x-axis labels clickable
      const xRenderer = xAxis.get("renderer");
      xRenderer.labels.template.setAll({
        fontSize: 10,
        paddingTop: 10,
        paddingRight: 0,
        inside: false,
        oversizedBehavior: "none",
        rotation: -90, // Vertical labels for both weekly and monthly
        fill: am5.color(0x000000),
        fontWeight: "bold",
        cursorOverStyle: "pointer",
        centerX: am5.p0,
        centerY: am5.p50,
        dy: 10,
      });
      // For monthly (yearly) view, show month label as-is (e.g. Jul-2025), not first date

      // Get unique dates/months for x-axis in chronological order
      const uniqueTimePoints = [...new Set(graphData.map(item => item[categoryField]))];

      if (viewMode === "weekly") {
        uniqueTimePoints.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      } else {
        // For monthly (yearly) view, sort months chronologically
        uniqueTimePoints.sort((a, b) => getMonthSortKey(a) - getMonthSortKey(b));
      }


      const timeData = uniqueTimePoints.map(timePoint => ({ [categoryField]: timePoint }));
      xAxis.data.setAll(timeData);

      // Group data by BCU
      const bcuGroups = {};
      graphData.forEach(item => {
        if (!bcuGroups[item.bcu]) {
          bcuGroups[item.bcu] = {};
        }
        bcuGroups[item.bcu][item[categoryField]] = {
          value: item.Normal,
          tooltip: item.interlockDetails
        };
      });

      // Create a series for each BCU
      const colors = [
        "#06b6d4", // Cyan
        "#3b82f6", // Blue
        "#8b5cf6", // Purple
        "#ec4899", // Pink
        "#f97316", // Orange
        "#14b8a6", // Teal
        "#22c55e", // Green
        "#f43f5e", // Red
        "#fbbf24", // Yellow
        "#6366f1", // Indigo
        "#a855f7", // Bright Purple
        "#ef4444", // Bright Red
        "#10b981", // Emerald Green
        "#f59e0b", // Amber
        "#0ea5e9", // Sky Blue
        "#84cc16", // Lime Green
        "#d946ef", // Fuchsia
        "#f97316", // Warm Orange
        "#64748b", // Slate Gray
        "#a3e635", // Neon Green
        "#f472b6", // Hot Pink
        "#4f46e5", // Deep Indigo
        "#f97316", // Burnt Orange
      ];

      let colorIndex = 0;
      Object.entries(bcuGroups).forEach(([bcuName, timeValues]: [string, any]) => {
        // Create series data
        const seriesData = uniqueTimePoints.map(timePoint => {
          const timeInfo = timeValues[timePoint] || { value: 0, tooltip: `No data for ${bcuName}` };
          return {
            [categoryField]: timePoint,
            categoryX: timePoint,
            value: timeInfo.value,
            valueY: timeInfo.value,
            tooltip: timeInfo.tooltip,
            bcu: bcuName,
          };
        });

        // Create a series for this BCU
        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: bcuName,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "value",
            categoryXField: categoryField,
            stroke: am5.color(colors[colorIndex % colors.length]),
            fill: am5.color(colors[colorIndex % colors.length]),
            tooltip: am5.Tooltip.new(root, {
              labelText: `[fontSize:12px bold]{tooltip}`,
              // maxWidth: 300,
              forceHidden: false,
              paddingBottom: 2,
              paddingTop: 1,
              background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0xffffff), // White background
                fillOpacity: 0.9, // 70% opacity (semi-transparent)
                strokeOpacity: 0.5, // Slightly transparent border
              })

            }),
            minBulletDistance: 5,
          }),
        );
        // Apply adapter to the tooltip to hide it when value is 0 or not present
        series.get("tooltip").adapters.add("visible", (visible, target) => {
          return target.dataItem?.dataContext["value"] > 0;
        });
        colorIndex++;
        // Add circle bullets with click events
        series.bullets.push((root) => {
          const circle = am5.Circle.new(root, {
            radius: 5,
            fill: series.get("fill"),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 2,
            cursorOverStyle: "pointer",
            interactive: true,
          });

          // Add click events to the bullets
          circle.events.on("click", function (ev) {
            const dataItem = ev.target.dataItem;
            if (dataItem && dataItem.dataContext) {
              const context = dataItem.dataContext;
              const timePoint = context[categoryField] || "";
              filterGridDataByPoint(timePoint);
            }
          });

          return am5.Bullet.new(root, {
            sprite: circle
          });
        });

        // Add label bullets above data points
        series.bullets.push(function (root) {
          const labelBullet = am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: `{value}`, // Show total count
              fill: am5.color(0x000000),
              centerY: am5.p0,
              centerX: am5.p50,
              populateText: true,
              fontSize: 10,
              fontWeight: "bold",
              dy: -25,
            })
          });
          return labelBullet;
        });

        series.data.setAll(seriesData);
      });

      // Add cursor
      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "zoomX",
        }),
      )

      // Add scrollbar
      chart.set(
        "scrollbarX",
        am5.Scrollbar.new(root, {
          orientation: "horizontal",
          paddingTop: 0,
        }),
      )
      chart.set(
        "scrollbarY",
        am5.Scrollbar.new(root, {
          orientation: "vertical"
        })
      );
      chart.set("wheelY", "panY");
      chart.appear(1000, 100)
    }

    initChart()

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    }
  }, [crossFilters, viewMode, selectedInterlockName, refreshKey]) // viewMode, crossFilters, selectedEquipment, isExpanded, isInitialized

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded)
  }

  // Clear chart point filter (X button) – sync parent and chart so table and BCU Alarm Parameter Alert Count both refresh
  const clearChartFilter = () => {
    setActiveFilter(null);
    setFilteredGridData([]);
    setFromDate(null);
    setToDate(null);
    if (onDateRangeSelect) {
      onDateRangeSelect("", "");
    }
    setCrossFilters(prev => prev.filter(f => f.key !== '"DATE"'));
    setRefreshKey(prev => prev + 1);
  }

  const handleViewModeChange = (value: "weekly" | "yearly") => {
    setViewMode(value);

    if (value === "weekly") {
      // Set the date range to the last 7 days
      const defaultFromDate = dayjs().subtract(6, "day");
      const defaultToDate = dayjs();

      setFromDate(defaultFromDate);
      setToDate(defaultToDate);

      // Notify parent component with the new date range
      if (onDateRangeSelect) {
        onDateRangeSelect(defaultFromDate.format("YYYY-MM-DD"), defaultToDate.format("YYYY-MM-DD"));
      }

      // Add date filter for the last 7 days
      setCrossFilters(prevFilters => {
        // Remove existing date filter
        const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');

        // Add new date filter for the last 7 days
        return [...filtersWithoutDate, {
          key: '"DATE"',
          cond: "equals",
          value: `${defaultFromDate.format("YYYY-MM-DD")},${defaultToDate.format("YYYY-MM-DD")}`
        }];
      });
    }

    if (value === "yearly") {
      // Clear the date range
      setFromDate(null);
      setToDate(null);

      // Notify parent component that dates are cleared
      if (onDateRangeSelect) {
        onDateRangeSelect("", "");
      }

      // Remove date filter completely
      setCrossFilters(prevFilters =>
        prevFilters.filter(f => f.key !== '"DATE"')
      );
    }

    // Reset active filter and filtered grid data
    setActiveFilter(null);
    setFilteredGridData([]);

    // Trigger a refresh
    setRefreshKey(prev => prev + 1);
  };

  // Fixed chart title that combines safety and equipment
  // const chartTitle = `BCU Alarm Parameter Alert Count`;
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBcuSummaryDownloading, setIsBcuSummaryDownloading] = useState(false);

  const handleDownloadExcel = async () => {
    if (!apiData || apiData.length === 0) {
      toast.error("No data available to download");
      return;
    }

    setIsDownloading(true);

    try {
      // Create the request body for the download API
      const requestBody = {
        action: "interlock_name_count",
        drill_state: viewMode === "yearly" ? "" : "date",
        filters: [...localFilters], // Use localFilters for BCU and other non-date filters
        cross_filters: crossFilters,
      };

      const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody)

      if (!response.status) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }
      const url = response.data?.file_path;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const viewModeShort = viewMode === 'yearly' ? 'Monthly' : 'Weekly';
      const bcuShort = selectedBcu && selectedBcu !== "All BCUs" ? `_${selectedBcu}` : '_AllBCUs';
      const filename = `BCU_Alert_${viewModeShort}${bcuShort}_${timestamp}.xlsx`;

      saveAs(url, filename);

      toast.success("Excel file downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(`Failed to download Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsDownloading(false);
    }
  };
  const alertStatusOptions = ["All", "Open", "Close"];
  const handleAlertStatusChange = (value: "All" | "Open" | "Close") => {
    setAlertStatus(value); // Update local state
    if (onAlertStatusChange) {
      onAlertStatusChange(value); // Notify parent of the change
    }
  };
 
  return (
    <div className="flex flex-col gap-2 mb-0">
      <div className={`${isTableExpanded ? "hidden" : "w-full"}`}>
        {/* Top toolbar: filters at opposite end (right) above line chart and donut */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-1 -py-1 mb-1 w-full min-w-0">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Select
            value={alertStatus}
            onValueChange={handleAlertStatusChange}
          >
            <SelectTrigger className="h-7 text-xs w-30">
              <SelectValue placeholder="Select Alert Status" />
            </SelectTrigger>
            <SelectContent>
              {alertStatusOptions.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={handleBcuNumberChange}
            value={selectedBcu || ""}
          >
            <SelectTrigger className="h-7 text-xs min-w-0 w-[7.5rem] max-w-full">
              <SelectValue placeholder="Select BCU">
                {selectedBcu || "Select BCU"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All BCUs">All BCUs</SelectItem>
              {bcuNumberOptions.map((bcu) =>
                bcu ? (
                  <SelectItem key={bcu} value={bcu}>
                    {bcu}
                  </SelectItem>
                ) : null
              )}
            </SelectContent>
          </Select>

          <Select
            onValueChange={handleInterlockNameChange}
            value={selectedInterlock || ""}
          >
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="Select Interlock">
                {selectedInterlock || "Select Interlock"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Interlocks">All Interlocks</SelectItem>
              {interlockNameOptions.map((name) =>
                name ? (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ) : null
              )}
            </SelectContent>
          </Select>

          <Select
            value={viewMode}
            onValueChange={handleViewModeChange}
          >
            <SelectTrigger className="min-w-0 w-[100px] h-7 text-xs max-w-full">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-xs" value="yearly">
                Monthly
              </SelectItem>
              <SelectItem className="text-xs" value="weekly">
                Weekly
              </SelectItem>
            </SelectContent>
          </Select>

          {viewMode !== "weekly" ? (
            <TooltipProvider delayDuration={200}>
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
                <TooltipContent side="bottom" className="max-w-[250px] rounded-md">
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
            onClick={handleDownloadExcel}
            className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
            disabled={isDownloading || isLoading || !apiData || apiData.length === 0}
            title="Download Excel"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          <Button
            onClick={handleRefresh}
            className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            onClick={toggleExpand}
            className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 flex-shrink-0"
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          </div>
        </div>

        {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleExpand} />}

        {/* Charts card - line chart and donut above the table */}
        <Card
          className={`transition-all duration-300 ${isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl flex flex-col" : ""}`}
        >
          <CardHeader className="pb-0 p-1 pt-1 relative">
            {isExpanded && (
              <Button
                onClick={toggleExpand}
                className="absolute top-2 right-2 z-10 h-7 w-7 p-0 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white text-gray-600 shadow-md transition-colors"
                variant="ghost"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-0 w-full">
              <div className="flex-1 flex flex-col min-w-0">
                <CardTitle className="text-xs font-bold text-gray-800">
                  BCU Alarm Parameter Alert Count
                  {fromDate && toDate && (
                    <span className=" text-gray-600 text-[10px] font-medium">
                      {' '}({fromDate.format("MMM DD, YYYY")} - {toDate.format("MMM DD, YYYY")})
                    </span>
                  )}
                </CardTitle>
                <p className="text-[10px] text-gray-500 mt-0.5">Click on a point to filter by date</p>
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <span className="text-xs font-bold text-gray-800">BCU Alarm Parameter Alert Count</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className={`p-0 relative ${isExpanded ? "flex-1 overflow-hidden" : ""}`}>
            <div className={`flex flex-col md:flex-row ${isExpanded ? "h-full" : ""}`}>
              {/* Line chart */}
              <div className={`flex-1 min-w-0 relative ${isExpanded ? "h-full" : "h-[310px]"}`}>
                {isTransitioning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-2" />
                    <p className="text-blue-600 font-medium">Loading data...</p>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80 z-10">
                    <p>No Data Available</p>
                  </div>
                )}

                <div
                  ref={chartDivRef}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />

                {activeFilter && (
                  <div className="absolute bottom-2 left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center z-10">
                    <span>{activeFilter}</span>
                    <button
                      className="ml-2 text-blue-600 hover:text-blue-800"
                      onClick={clearChartFilter}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Donut chart */}
              <div className={`flex-1 min-w-0 ${isExpanded ? "h-full" : "h-[310px]"}`}>
                <BCUGantryChart
                  onSelectName={handleInterlockSelect}
                  apiData={activeFilter ? filteredGridData : (selectedBcuNumber ? filteredGridData : apiData)}
                  refreshKey={`${refreshKey}-${activeFilter || 'all'}-${selectedBcuNumber || 'all'}`}
                  dateFilter={activeFilter}
                  viewMode={viewMode}
                  embedded={true}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Zone/Plant toggle - above table, filters at opposite end */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 w-full min-w-0 mt-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold text-gray-800">BCU Alarm Alert Summary</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-help" aria-label="Alert summary info">
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px]">
                  Alert summary table data for plant wise and zone wise.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <div className="relative min-w-[120px] w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                placeholder={tableLocationTab === "zone" ? "Search zone..." : "Search plant..."}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="h-7 text-xs pl-7 w-full min-w-0"
              />
            </div>
            <div className="flex items-stretch shrink-0 gap-1 rounded-full bg-gray-100 p-0.5 border border-gray-200/80">
              <button
                type="button"
                onClick={() => setTableLocationTab("zone")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${tableLocationTab === "zone" ? "bg-white text-blue-600 shadow-sm border border-gray-200" : "text-gray-600 hover:text-gray-800 bg-transparent border border-transparent"}`}
              >
                Zone
              </button>
              <button
                type="button"
                onClick={() => setTableLocationTab("plant")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${tableLocationTab === "plant" ? "bg-white text-blue-600 shadow-sm border border-gray-200" : "text-gray-600 hover:text-gray-800 bg-transparent border border-transparent"}`}
              >
                Plant
              </button>
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 w-7 p-1 shrink-0 text-white bg-green-600 hover:bg-green-700 rounded-sm disabled:opacity-50"
                    disabled={isBcuSummaryDownloading || (tableRowData.length === 0 && pinnedBottomRowData.length === 0)}
                    onClick={handleDownloadBcuAlertSummary}
                  >
                    {isBcuSummaryDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Download BCU Alarm Alert Summary as Excel
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Table card - below search and toggle */}
        <Card className="w-full border border-gray-200 mt-2">
          <CardContent className="p-0 relative w-full overflow-hidden">
            <div className="flex-1 min-w-0 w-full h-[310px] relative" ref={tableContainerRef}>
              <div
                className="ag-theme-alpine tas-trend-grid-with-total w-full h-full"
                style={{
                  "--ag-selected-row-background-color": "#e6f0ff",
                  "--ag-selected-row-border-color": "#1a73e8",
                  width: "100%",
                  height: "100%",
                } as React.CSSProperties & Record<string, string>}
              >
              <style>{`
                .tas-trend-grid-with-total.ag-theme-alpine .ag-header-cell-text {
                  white-space: nowrap;
                  overflow: visible !important;
                  text-overflow: clip !important;
                }
                .tas-trend-grid-with-total.ag-theme-alpine .ag-header-cell-label { overflow: visible !important; }
                .tas-trend-grid-with-total.ag-theme-alpine .ag-pinned-left-cols-container .ag-cell,
                .tas-trend-grid-with-total.ag-theme-alpine .ag-cell[col-id="zone"],
                .tas-trend-grid-with-total.ag-theme-alpine .ag-cell[col-id="location_name"] {
                  overflow: visible !important;
                  text-overflow: clip !important;
                }
              `}</style>
              <AgGridReact
                key={`fault-gantry-table-${viewMode}-${tableLocationTab}-${tableRowData.length}-${activeFilter ?? "all"}`}
                columnDefs={columnDefs}
                onGridReady={onTableGridReady}
                onFirstDataRendered={() => fitTableColumns()}
                onModelUpdated={() => fitTableColumns()}
                rowData={tableRowData}
                quickFilterText={tableSearch}
                pinnedBottomRowData={pinnedBottomRowData}
                alwaysShowVerticalScroll={true}
                alwaysShowHorizontalScroll={true}
                getRowId={(params) => {
                  const r = params.data as DetailRow & PivotRow;
                  if (r?.month === "Total" || ((isYearlyPivot || isWeeklyPivot) && r?.zone === "Total")) return "pinned-total";
                  if (isYearlyPivot || isWeeklyPivot) {
                    const pr = r as PivotRow;
                    return [pr?.zone, pr?.location_name, pr?.sap_id, pr?.bcu_number, pr?.interlock_name].filter(Boolean).join("|") || "pivot-row";
                  }
                  const id = [r?.month, r?.date, r?.zone, r?.location_name, r?.sap_id, r?.bcu_number, r?.interlock_name, r?.count].filter(Boolean).join("|");
                  return id || `row-${r?.count}-${r?.sap_id ?? ""}-${r?.interlock_name ?? ""}`;
                }}
                defaultColDef={{
                  sortable: true,
                  filter: false,
                  resizable: true,
                  flex: 1,
                  minWidth: 120,
                  getQuickFilterText: () => "",
                  wrapHeaderText: false,
                }}
                pagination={tableRowData.length > 10}
                paginationPageSize={10}
                enableCellTextSelection={true}
                suppressCellFocus={true}
                domLayout="normal"
                headerHeight={25}
                rowHeight={28}
                getRowHeight={(params) => (params.node?.rowPinned === "bottom" ? 22 : 28)}
                suppressMovableColumns={false}
                suppressContextMenu={true}
                getRowStyle={(params) => {
                  if (params.node?.rowPinned === "bottom") {
                    return { fontWeight: 600, backgroundColor: "#f1f5f9" };
                  }
                  return null;
                }}
              />
            </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default FaultGantry;

