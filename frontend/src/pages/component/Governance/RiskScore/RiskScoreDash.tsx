import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, Search, ChevronUp, ChevronDown, ChevronsUpDown, Filter, X, Download, MoreVertical, Loader2, Ticket, Minimize2, CheckSquare, XSquare, Plus, AlertCircle, CalendarDays, Info, BarChart3, Table2, Check, Map, ArrowLeft, Sun, Satellite, Layers, Mountain, Globe } from 'lucide-react';
import { Input } from "@/@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { apiClient } from '@/services/apiClient';
import ZonePlantSelections from '../../RetailOutletHome/ZonePlantSelections';
import EnhancedTimeFilter from '../filters/TimeFilterButtons';
import ReusableFilterBar from '../VTS Analytics/ReusableFilterBar';
import VTSVehicleAI from '../VTS/VTSVehicleAI';
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { Checkbox } from "@/@/components/ui/checkbox";
// Sheet components moved to extracted detail sheet files
import { Button } from "@/@/components/ui/button";
import { cn } from "@/@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";
import { TooltipPortal } from "@radix-ui/react-tooltip";
// import { RiskScoreDetailsDialog } from './RiskScoreDetailsDialog';
// import { CreateTicketDialog } from '@/pages/component/Ticketing2/components/CreateTicketDialog';
import TicketDialogModal from '../../Ticketing2/components/TicketDialogModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import useAuthStore from '@/store/authStore';
import TransporterDetailSheet from './TransporterDetailSheet';
import TtNumberDetailSheet from './TtNumberDetailSheet';
import InvoiceDetailSheet from './InvoiceDetailSheet';
import ClusterDetailSheet from './ClusterDetailSheet';
import LocationDetailSheet from './LocationDetailSheet';
import ClusterMapView, { type ClusterMapViewRef, type ClusterMapFilterMeta } from './ClusterMapView';
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from '@/hooks/useAgGridMirrorScrollbar';

type MapViewStyle = 'light' | 'hybrid' | 'satellite' | 'terrain' | 'streets' | 'topo';
const RISK_SCORE_CSV_BLOB_TYPE = "text/csv;charset=utf-8;";
const XLSX_BLOB_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Long timeout for blob downloads (large exports). */
const RISK_SCORE_DOWNLOAD_TIMEOUT_MS = 600_000;
const MAP_VIEW_STYLES: { id: MapViewStyle; label: string; description: string; mapTypeId: 'roadmap' | 'satellite' | 'terrain' | 'hybrid'; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'light', label: 'Light', description: 'Clean minimal basemap', mapTypeId: 'roadmap', Icon: Sun },
  { id: 'hybrid', label: 'Hybrid', description: 'Satellite with labels', mapTypeId: 'hybrid', Icon: Layers },
  { id: 'satellite', label: 'Satellite', description: 'Satellite imagery', mapTypeId: 'satellite', Icon: Satellite },
  { id: 'terrain', label: 'Terrain', description: 'Terrain and elevation', mapTypeId: 'terrain', Icon: Mountain },
  { id: 'streets', label: 'Streets', description: 'Street map', mapTypeId: 'roadmap', Icon: Map },
  { id: 'topo', label: 'Topo', description: 'Topographic map', mapTypeId: 'terrain', Icon: Globe },
];

/** Completed Trips Risk Score grid: colIds that render green violation badges — header filter hidden for these only */
const COMPLETED_GREEN_BADGE_COL_IDS = new Set([
  "dr", "pd", "rd", "st", "ht", "ha", "hb", "nd", "sv",
]);
/** Shortage-VTS Combined (merged_shortage_vts): *_count columns with green badges — header filter hidden for these only */
const MERGED_SHORTAGE_VTS_GREEN_BADGE_COL_IDS = new Set([
  "route_deviation_count",
  "speed_violation_count",
  "main_supply_removal_count",
  "device_tamper_count",
  "stoppage_violations_count",
  "night_driving_count",
  "continuous_driving_count",
]);
/** Route TT Violation summary: total_* violation columns with green badges */
const ROUTE_TT_GREEN_BADGE_COL_IDS = new Set([
  "total_rd",
  "total_st",
  "total_dr",
  "total_pd",
  "total_sv",
  "total_cd",
  "total_nd",
]);
/** TT Violation summary: same total_* green-badge column keys as Route TT */
const TT_VIOLATION_GREEN_BADGE_COL_IDS = ROUTE_TT_GREEN_BADGE_COL_IDS;
/** Customer Violation: total_* violation columns with green badges */
const CUSTOMER_VIOLATION_GREEN_BADGE_COL_IDS = new Set([
  "total_st",
  "total_dr",
  "total_sv",
  "total_cd",
  "total_nd",
]);
/** Narrow width for green-badge violation count columns (Completed + Transport + TT Risk + Shortage tabs) */
const GREEN_BADGE_VIOLATION_COL_WIDTH_PX = 58;
/** TT Violation tab only: same total_* badge columns, slightly wider for readability */
const TT_VIOLATION_GREEN_BADGE_COL_WIDTH_PX = 70;
/** Customer Violation tab only: total_* green-badge columns — same wider spacing as TT Violation */
const CUSTOMER_VIOLATION_GREEN_BADGE_COL_WIDTH_PX = 70;

/** Parse last scheduler / max date from `generate_vis_data` `risk_score_max_date` response */
function extractRiskScoreMaxDate(body: any): string | null {
  if (!body || typeof body !== "object") return null;
  if (typeof body.last_run_at === "string") {
    return body.last_run_at.split("T")[0] ?? body.last_run_at;
  }
  if (typeof body.data === "string") {
    return body.data.split("T")[0] ?? body.data;
  }
  if (Array.isArray(body.data) && body.data.length > 0) {
    const first = body.data[0];
    if (typeof first === "string") {
      return first.split("T")[0] ?? first;
    }
    if (first?.max_date != null) {
      return String(first.max_date).split("T")[0];
    }
    if (first?.date != null) {
      return String(first.date).split("T")[0];
    }
    if (first?.last_run_at != null) {
      return String(first.last_run_at).split("T")[0];
    }
  }
  return null;
}

/** Normalize session `/api/session/me` `bu` (string, array, or object entries). */
function normalizeSessionBuCodes(userBu: unknown): string[] {
  if (userBu == null || userBu === "") return [];
  const list = Array.isArray(userBu) ? userBu : [userBu];
  return list
    .map((raw) => {
      if (typeof raw === "string") return raw.trim().toUpperCase();
      if (raw && typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        if (typeof o.bu === "string") return o.bu.trim().toUpperCase();
        if (typeof o.name === "string") return o.name.trim().toUpperCase();
        if (typeof o.code === "string") return o.code.trim().toUpperCase();
      }
      return String(raw).trim().toUpperCase();
    })
    .filter(Boolean);
}

/** Risk Score `location_type` dropdown: session `TAS`/`SOD` → SOD; `LPG` → LPG. */
function getLocationTypeOptionsFromSession(
  userBu: unknown,
  authChecked: boolean
): { value: string; label: string }[] {
  if (!authChecked) {
    return [{ value: "SOD", label: "SOD" }];
  }
  const codes = normalizeSessionBuCodes(userBu);
  if (codes.length === 0) {
    return [
      { value: "SOD", label: "SOD" },
      { value: "LPG", label: "LPG" },
    ];
  }
  const buSet = new Set(codes);
  const options: { value: string; label: string }[] = [];
  if (buSet.has("TAS") || buSet.has("SOD")) {
    options.push({ value: "SOD", label: "SOD" });
  }
  if (buSet.has("LPG")) {
    options.push({ value: "LPG", label: "LPG" });
  }
  return options.length > 0 ? options : [{ value: "SOD", label: "SOD" }];
}

function defaultLocationTypeFromSession(userBu: unknown): string {
  const buSet = new Set(normalizeSessionBuCodes(userBu));
  if (buSet.has("LPG") && !buSet.has("TAS") && !buSet.has("SOD")) return "LPG";
  return "SOD";
}

const SESSION_FILTER_BU_ITEMS: { value: string; label: string; sessionCodes: string[] }[] = [
  { value: "TAS", label: "SOD", sessionCodes: ["TAS", "SOD"] },
  { value: "LPG", label: "LPG", sessionCodes: ["LPG"] },
];

/** Completed-trip / merged-table filter bar: session `TAS` → SOD label; `LPG` → LPG. */
function getSessionFilterBuOptions(
  userBu: unknown,
  authChecked: boolean
): { value: string; label: string }[] {
  if (!authChecked) {
    return [{ value: "TAS", label: "SOD" }];
  }
  const codes = normalizeSessionBuCodes(userBu);
  if (codes.length === 0) {
    return SESSION_FILTER_BU_ITEMS.map(({ value, label }) => ({ value, label }));
  }
  const buSet = new Set(codes);
  const matched = SESSION_FILTER_BU_ITEMS.filter((item) =>
    item.sessionCodes.some((c) => buSet.has(c))
  );
  return matched.length > 0
    ? matched.map(({ value, label }) => ({ value, label }))
    : [{ value: "TAS", label: "SOD" }];
}

function defaultSessionFilterBu(userBu: unknown): string {
  const buSet = new Set(normalizeSessionBuCodes(userBu));
  if (buSet.has("LPG") && !buSet.has("TAS") && !buSet.has("SOD")) return "LPG";
  return "TAS";
}

/** Shortage Analysis tab → `payload.table_name` for `risk_score_max_date` (align with `tableNameMap.shortageAnalysis`) */
const SHORTAGE_ANALYSIS_TABLE_NAMES: Record<string, string> = {
  ttViolation: "tt_violation_summary",
  customerV: "cust_violation_summary",
  routeTT: "route_tt_violation",
  srcDest: "srcdest_consistency",
  mergedTable: "merged_shortage_vts",
  customerSummary: "customer_hot_summary",
};

/** Shortage-VTS Combined tab only: custom range pickers allow 11 Nov 2025 through today (other dates disabled via min/max). */
const MERGED_TABLE_CUSTOM_DATE_MIN = "2025-11-11";

type MergedShortageVtsTimeFilterProps = {
  selectedFilter: string | null | { key: string; cond: string; value: string };
  onFilterChange: (filter: string | null | { key: string; cond: string; value: string }) => void;
  resetTrigger?: number;
  isLoading?: boolean;
};

function MergedShortageVtsTimeFilter({
  selectedFilter,
  onFilterChange,
  resetTrigger = 0,
  isLoading = false,
}: MergedShortageVtsTimeFilterProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCustomDateSelected, setIsCustomDateSelected] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (resetTrigger > 0) {
      setStartDate("");
      setEndDate("");
      setShowDatePicker(false);
      setIsCustomDateSelected(false);
    }
  }, [resetTrigger]);

  useEffect(() => {
    if (selectedFilter) {
      setIsCustomDateSelected(false);
    }
  }, [selectedFilter]);

  const filters = [
    { label: "TDY", value: "TDY", tooltip: "Today" },
    { label: "YDY", value: "YDY", tooltip: "Yesterday" },
    { label: "1W", value: "1W", tooltip: "Last 1 Week" },
    { label: "15D", value: "15D", tooltip: "Last 15 Days" },
    { label: "1M", value: "1M", tooltip: "Last 1 Month" },
    { label: "3M", value: "3M", tooltip: "Last 3 Months" },
  ];

  const handleDateSubmit = () => {
    if (!startDate || !endDate) return;
    if (
      startDate < MERGED_TABLE_CUSTOM_DATE_MIN ||
      endDate < MERGED_TABLE_CUSTOM_DATE_MIN ||
      startDate > today ||
      endDate > today
    ) {
      return;
    }
    const dateRangeValue = `${startDate},${endDate}`;
    onFilterChange({
      key: "Date",
      cond: "equals",
      value: dateRangeValue,
    });
    setIsCustomDateSelected(true);
    setShowDatePicker(false);
  };

  const handleFilterClick = (filterValue: string) => {
    setIsCustomDateSelected(false);
    setStartDate("");
    setEndDate("");
    onFilterChange(filterValue);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    if (newStart && newStart < MERGED_TABLE_CUSTOM_DATE_MIN) return;
    setStartDate(newStart);
    if (endDate && newStart > endDate) {
      setEndDate("");
    }
  };

  const endMin =
    startDate && startDate >= MERGED_TABLE_CUSTOM_DATE_MIN ? startDate : MERGED_TABLE_CUSTOM_DATE_MIN;

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center justify-end w-max">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            title={filter.tooltip}
            onClick={() => handleFilterClick(filter.value)}
            disabled={isLoading}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all h-7
              ${
                selectedFilter === filter.value
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-300"
              }`}
          >
            {filter.label}
          </button>
        ))}
        <button
          type="button"
          title="Select Date Range"
          onClick={() => setShowDatePicker(!showDatePicker)}
          disabled={isLoading}
          className={`p-1.5 rounded-md transition-all h-7 w-7 border
            ${
              isCustomDateSelected || (selectedFilter && typeof selectedFilter === "object")
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm border-transparent"
                : "bg-white text-gray-600 hover:bg-gray-50 border-gray-300"
            }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      {showDatePicker && (
        <div className="absolute top-10 right-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-auto">
          {/* <p className="mb-2 text-[11px] text-gray-500">
            Custom range: {MERGED_TABLE_CUSTOM_DATE_MIN} — {today} (other dates disabled)
          </p> */}
          <div className="flex justify-between gap-4 mb-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">From</label>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                min={MERGED_TABLE_CUSTOM_DATE_MIN}
                max={today}
                disabled={isLoading}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-9 px-2"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={endMin}
                max={today}
                disabled={isLoading}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-9 px-2"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowDatePicker(false)}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDateSubmit}
              disabled={isLoading || !startDate || !endDate}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-md hover:from-indigo-600 hover:to-purple-600"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiskScoreDash() {
  const navigate = useNavigate();
  const location = useLocation();
  /** DNC cluster map — `/dnc/home/mapview` (route: `dnc.home.mapview`; maps load under DNC path allowlist). */
  const CLUSTER_MAP_VIEW_PATH = '/dnc/home/mapview';
  const showClusterMapViewPage =
    location.pathname === CLUSTER_MAP_VIEW_PATH ||
    location.pathname === `${CLUSTER_MAP_VIEW_PATH}/`;
  const [selectedBu, setSelectedBu] = useState("TAS");
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  // Separate BU/Zone/Plant for Shortage-VTS Combined (mergedTable) so they don't affect Completed Trip Risk Score
  const [mergedTableSelectedBu, setMergedTableSelectedBu] = useState("TAS");
  const [mergedTableSelectedZone, setMergedTableSelectedZone] = useState<string | null>(null);
  const [mergedTableSelectedPlant, setMergedTableSelectedPlant] = useState<string | null>(null);
  // When true, ignore mergedTable zone/plant in filters (used immediately after refresh)
  const [ignoreMergedTableLocationFilters, setIgnoreMergedTableLocationFilters] = useState(false);
  const [selectedLocationType, setSelectedLocationType] = useState("SOD");
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>("15D");
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: Date; end: Date } | null>(null);
  /** Shortage-VTS Combined (mergedTable) only — preset/range filters; not shared with Completed Trip or single-date views */
  const [mergedTableTimeFilter, setMergedTableTimeFilter] = useState<string | null>("15D");
  const [mergedTableDateRangeFilter, setMergedTableDateRangeFilter] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedViolations, setSelectedViolations] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [activeSection, setActiveSection] = useState("riskAnalysis");
  const [activeRiskTab, setActiveRiskTab] = useState("completed");
  const [activeShortageTab, setActiveShortageTab] = useState("ttViolation");
  const [clusterSbu, setClusterSbu] = useState("SOD");
  const [clusterMapViewMapType, setClusterMapViewMapType] = useState('hybrid');
  const [clusterMapViewStyle, setClusterMapViewStyle] = useState<MapViewStyle>('hybrid');
  const [clusterMapViewRadius500m, setClusterMapViewRadius500m] = useState(true);
  const clusterMapViewRef = React.useRef<ClusterMapViewRef>(null);
  const [clusterMapFilterMeta, setClusterMapFilterMeta] = useState<ClusterMapFilterMeta>({
    plants: [],
    clusterTypes: [],
  });
  const [clusterMapPlantFilter, setClusterMapPlantFilter] = useState('');
  const [clusterMapPlantPopoverOpen, setClusterMapPlantPopoverOpen] = useState(false);
  const [clusterMapClusterTypeFilter, setClusterMapClusterTypeFilter] = useState('');
  /** Show “Latest” reset only after user picks a date from the cluster map trend chart (not date input). */
  const [showClusterMapLatestChip, setShowClusterMapLatestChip] = useState(false);
  /** Cluster Map View only — `version_date` from `risk_score_max_date` API, not Cluster Master `selectedDate`. */
  const [clusterMapViewDate, setClusterMapViewDate] = useState<string | null>(null);
  const [clusterMapViewDateLoading, setClusterMapViewDateLoading] = useState(false);
  const fetchClusterMapMaxDate = useCallback(async (opts?: { clearDateUntilLoaded?: boolean }) => {
    if (opts?.clearDateUntilLoaded) setClusterMapViewDate(null);
    setClusterMapViewDateLoading(true);
    try {
      const payload = {
        action: "risk_score_max_date",
        filters: [] as unknown[],
        cross_filters: [] as unknown[],
        drill_state: "",
        payload: {},
      };
      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        headers: { "Content-Type": "application/json" },
      });
      const d = extractRiskScoreMaxDate(response.data);
      if (d) setClusterMapViewDate(d);
      else setClusterMapViewDate(new Date().toISOString().split("T")[0]);
    } catch (e) {
      console.error("risk_score_max_date (cluster map)", e);
      setClusterMapViewDate(new Date().toISOString().split("T")[0]);
    } finally {
      setClusterMapViewDateLoading(false);
    }
  }, []);

  /**
   * When leaving the cluster map route, clear date/loading so a later return cannot paint `ClusterMapView`
   * with a stale date before this effect runs (that caused `risk_score_cluster_map` before `risk_score_max_date`).
   * When entering, force loading + empty date until `fetchClusterMapMaxDate` completes.
   */
  useLayoutEffect(() => {
    if (!showClusterMapViewPage) {
      setClusterMapViewDate(null);
      setClusterMapViewDateLoading(false);
      return;
    }
    setClusterMapViewDate(null);
    setClusterMapViewDateLoading(true);
  }, [showClusterMapViewPage]);

  useEffect(() => {
    if (!showClusterMapViewPage) return;
    void fetchClusterMapMaxDate({ clearDateUntilLoaded: true });
  }, [showClusterMapViewPage, fetchClusterMapMaxDate]);

  const handleClusterMapFilterMeta = useCallback((meta: ClusterMapFilterMeta) => {
    setClusterMapFilterMeta(meta);
  }, []);

  useEffect(() => {
    setClusterMapPlantFilter('');
    setClusterMapClusterTypeFilter('');
  }, [clusterSbu]);

  useEffect(() => {
    if (!showClusterMapViewPage) setShowClusterMapLatestChip(false);
  }, [showClusterMapViewPage]);

  const currentMapStyle = MAP_VIEW_STYLES.find(s => s.id === clusterMapViewStyle) ?? MAP_VIEW_STYLES[0];

  const handleMapViewStyleSelect = useCallback((style: MapViewStyle) => {
    setClusterMapViewStyle(style);
    const entry = MAP_VIEW_STYLES.find(s => s.id === style);
    if (entry) setClusterMapViewMapType(entry.mapTypeId);
  }, []);

  const [riskAnalysisData, setRiskAnalysisData] = useState({
    completed: [],
    transport: [],
    tts: [],
    afterDR: [],
    location: []
  });

  const [shortageAnalysisData, setShortageAnalysisData] = useState({
    ttViolation: [],
    customerV: [],
    routeTT: [],
    srcDest: [],
    mergedTable: [],
    customerSummary: []
  });

  const [clusterMasterData, setClusterMasterData] = useState([]);

  const [loadedTabs, setLoadedTabs] = useState({
    riskAnalysis: { completed: false, transport: false, tts: false, afterDR: false, location: false },
    shortageAnalysis: { ttViolation: false, customerV: false, routeTT: false, srcDest: false, mergedTable: false, customerSummary: false },
    clusterMaster: false
  });
const [totalRecords, setTotalRecords] = useState({
    riskAnalysis: { completed: 0, transport: 0, tts: 0, afterDR: 0, location: 0 },
     shortageAnalysis: { ttViolation: 0, customerV: 0, routeTT: 0, srcDest: 0, mergedTable: 0, customerSummary: 0 },
    clusterMaster: 0
   });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerms, setSearchTerms] = useState({
    riskAnalysis: { completed: "", transport: "", tts: "", afterDR: "", location: "" },
    shortageAnalysis: { ttViolation: "", customerV: "", routeTT: "", srcDest: "", mergedTable: "", customerSummary: "" },
    clusterMaster: ""
  });
  // Local input state for immediate UI updates (not debounced)
  const [searchInputValues, setSearchInputValues] = useState({
    riskAnalysis: { completed: "", transport: "", tts: "", afterDR: "", location: "" },
    shortageAnalysis: { ttViolation: "", customerV: "", routeTT: "", srcDest: "", mergedTable: "", customerSummary: "" },
    clusterMaster: ""
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [columnWidths, setColumnWidths] = useState({});
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [rangeFilters, setRangeFilters] = useState<Array<{ column: string; operator: string; value: number }>>([]);
 
  // State for invoice_no click modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [clickedInvoiceNo, setClickedInvoiceNo] = useState<string | null>(null);
  const [invoiceModalData, setInvoiceModalData] = useState<any>(null);
  const [invoiceModalSearch, setInvoiceModalSearch] = useState("");
  // Sort state moved into InvoiceDetailSheet component

  // State for risk score details dialog
  const [isRiskScoreDetailsOpen, setIsRiskScoreDetailsOpen] = useState(false);
  const [selectedRiskScoreRow, setSelectedRiskScoreRow] = useState<any>(null);

  // State for cluster_id click
  const [clickedClusterId, setClickedClusterId] = useState<string | null>(null);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [clusterDetailsLoading, setClusterDetailsLoading] = useState(false);
  const [clusterDetailsData, setClusterDetailsData] = useState<any>(null);
  const [clusterDetailsError, setClusterDetailsError] = useState<string | null>(null);
  const [clusterModalSearch, setClusterModalSearch] = useState("");
  // Sort state moved into ClusterDetailSheet component

  // State for plant_name location names floating dropdown
  const [locationDropdown, setLocationDropdown] = useState<{ clusterId: string; top: number; bottom: number; left: number; openUp: boolean } | null>(null);
  const [locationNamesMap, setLocationNamesMap] = useState<Record<string, { location_name: string; count: number }[]>>({});
  const [locationNamesLoadingMap, setLocationNamesLoadingMap] = useState<Record<string, boolean>>({});

  // State for location detail slide sheet (on clicking a location in the dropdown)
  const [isLocationDetailOpen, setIsLocationDetailOpen] = useState(false);
  const [locationDetailClusterId, setLocationDetailClusterId] = useState<string | null>(null);
  const [locationDetailName, setLocationDetailName] = useState<string | null>(null);
  const [locationDetailData, setLocationDetailData] = useState<any>(null);
  const [locationDetailLoading, setLocationDetailLoading] = useState(false);
  const [locationDetailError, setLocationDetailError] = useState<string | null>(null);
  const [locationDetailSearch, setLocationDetailSearch] = useState("");

  // State for transporter_code click
  const [clickedTransporterCode, setClickedTransporterCode] = useState<string | null>(null);
  const [isTransporterModalOpen, setIsTransporterModalOpen] = useState(false);
  const [transporterModalLoading, setTransporterModalLoading] = useState(false);
  const [transporterModalData, setTransporterModalData] = useState<any>(null);
  const [transporterModalError, setTransporterModalError] = useState<string | null>(null);
  const [transporterModalSearch, setTransporterModalSearch] = useState("");
  // Sort state moved into TransporterDetailSheet component
  const [transporterLineChartData, setTransporterLineChartData] = useState<any[]>([]);
  const [transporterLineChartLoading, setTransporterLineChartLoading] = useState(false);
  const [transporterLineChartError, setTransporterLineChartError] = useState<string | null>(null);
  // transporterSheetView state removed - was unused

  // State for tt_number click
  const [clickedTtNumber, setClickedTtNumber] = useState<string | null>(null);
  const [isTtModalOpen, setIsTtModalOpen] = useState(false);
  const [ttModalLoading, setTtModalLoading] = useState(false);
  const [ttModalData, setTtModalData] = useState<any>(null);
  const [ttModalError, setTtModalError] = useState<string | null>(null);
  const [ttModalSearch, setTtModalSearch] = useState("");
  // Sort state moved into TtNumberDetailSheet component
  const [ttLineChartData, setTtLineChartData] = useState<any[]>([]);
  const [ttLineChartLoading, setTtLineChartLoading] = useState(false);
  const [ttLineChartError, setTtLineChartError] = useState<string | null>(null);
  // ttSheetView state removed - was unused

  // State for create ticket dialog
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [ticketInitialData, setTicketInitialData] = useState(null);
  const [isTicketFormMinimized, setIsTicketFormMinimized] = useState(false);
  const [invoiceModalLoading, setInvoiceModalLoading] = useState(false);
  const [invoiceModalError, setInvoiceModalError] = useState<string | null>(null);

  // State for multi-select functionality
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const { user, authChecked } = useAuthStore();
  const userBu = user?.bu;
  const locationTypeOptions = useMemo(
    () => getLocationTypeOptionsFromSession(userBu, authChecked),
    [userBu, authChecked]
  );
  const filterBuOptions = useMemo(
    () => getSessionFilterBuOptions(userBu, authChecked),
    [userBu, authChecked]
  );

  useEffect(() => {
    if (!authChecked) return;
    const next = defaultLocationTypeFromSession(userBu);
    setClusterSbu(next);
    const filterBu = defaultSessionFilterBu(userBu);
    setSelectedBu(filterBu);
    setMergedTableSelectedBu(filterBu);
  }, [userBu, authChecked]);

  useEffect(() => {
    if (!filterBuOptions.length) return;
    const allowed = filterBuOptions.map((o) => o.value);
    if (!allowed.includes(selectedBu)) {
      setSelectedBu(allowed[0]);
    }
  }, [filterBuOptions, selectedBu]);

  useEffect(() => {
    if (!filterBuOptions.length) return;
    const allowed = filterBuOptions.map((o) => o.value);
    if (!allowed.includes(mergedTableSelectedBu)) {
      setMergedTableSelectedBu(allowed[0]);
    }
  }, [filterBuOptions, mergedTableSelectedBu]);

  useEffect(() => {
    if (!locationTypeOptions.length) return;
    const allowed = locationTypeOptions.map((o) => o.value);
    if (!allowed.includes(clusterSbu)) {
      setClusterSbu(allowed[0]);
    }
  }, [locationTypeOptions, clusterSbu]);

  useEffect(() => {
    if (!authChecked) return;
    setSelectedLocationType(defaultLocationTypeFromSession(userBu));
  }, [userBu, authChecked]);

  useEffect(() => {
    if (!locationTypeOptions.length) return;
    const allowed = locationTypeOptions.map((o) => o.value);
    if (!allowed.includes(selectedLocationType)) {
      setSelectedLocationType(allowed[0]);
    }
  }, [locationTypeOptions, selectedLocationType]);

  const canCreateTicket = useMemo(
    () =>
      Array.isArray(user?.novex_role) &&
      user.novex_role.some((r) =>
        ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"].includes(String(r).trim())
      ),
    [user?.novex_role]
  );

  // Formatted date range label for sheet badges
  const dateRangeLabel = useMemo(() => {
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const now = new Date();
    if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
      const s = fmt(dateRangeFilter.start);
      const e = fmt(dateRangeFilter.end);
      return s === e ? s : `${s} to ${e}`;
    }
    const presets: Record<string, number> = { TDY: 0, YDY: 1, "1W": 7, "15D": 15, "1M": 30, "3M": 90 };
    const days = presets[selectedTimeFilter || "15D"] || 0;
    if (selectedTimeFilter === "TDY") return fmt(now);
    if (selectedTimeFilter === "YDY") { const y = new Date(now); y.setDate(y.getDate() - 1); return fmt(y); }
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return `${fmt(start)} to ${fmt(now)}`;
  }, [selectedTimeFilter, dateRangeFilter]);

  // Violation types configuration for filter checkboxes
  const violationTypes = {
    'dr': 'DR',
    'pd': 'PD',
    'rd': 'RD',
    'st': 'ST',
    'sv': 'SV',
    'nd': 'ND',
    'ha': 'HA',
    'ht': 'HT',
    'hb': 'HB'
  };

  // Full names for violation type tooltips
  const violationTypeTooltips: Record<string, string> = {
    'DR': 'Device Removed',
    'PD': 'Power Disconnect',
    'RD': 'Route Deviation',
    'ST': 'Stoppage Violation',
    'SV': 'Speed Violation',
    'ND': 'Night Driving',
    'HA': 'Harsh Acceleration',
    'HT': 'Harsh Turn',
    'HB': 'Harsh Brake'
  };

  // Handle violation type toggle
  const handleViolationToggle = (violationKey: string) => {
    setSelectedViolations(prev => {
      if (prev.includes(violationKey)) {
        return prev.filter(v => v !== violationKey);
      } else {
        return [...prev, violationKey];
      }
    });
  };

  // Clear all violation filters
  const clearViolationFilters = () => {
    setSelectedViolations([]);
  };
 
  // Helper function to get current tab key
  const getCurrentTabKey = () => {
    const currentTab = activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeSection === "shortageAnalysis"
        ? activeShortageTab
        : "cluster";
    return `${activeSection}_${currentTab}`;
  };

  // Helper function to check if current tab supports multi-select (has action column)
  const supportsMultiSelect = () => {
    return true;
  };

  // Risk Score Filter - separate input and applied states, tab-specific
  const [riskScoreRangeFilterInput, setRiskScoreRangeFilterInput] = useState<Record<string, { operator: string; value: number | null }>>({});
  const [riskScoreRangeFilter, setRiskScoreRangeFilter] = useState<Record<string, { operator: string; value: number }>>({});
  const [riskScoreFilterOpen, setRiskScoreFilterOpen] = useState(false);
 
  // Range filters for other columns - separate input and applied states, tab-specific
  const [rangeFiltersInputState, setRangeFiltersInputState] = useState<Record<string, Record<string, { operator: string; value: number | null; open: boolean }>>>({});
  const [rangeFiltersState, setRangeFiltersState] = useState<Record<string, Record<string, { operator: string; value: number; open: boolean }>>>({});
 
  // Helper function to get default filter state for a column
  const getDefaultColumnFilter = () => ({
    total_trips: { operator: '>=', value: 0, open: false },
    device_removed: { operator: '>=', value: 0, open: false },
    power_disconnect: { operator: '>=', value: 0, open: false },
    route_deviation: { operator: '>=', value: 0, open: false },
    stoppage_violation: { operator: '>=', value: 0, open: false },
    lrs: { operator: '>=', value: 0, open: false },
    total_alerts: { operator: '>=', value: 0, open: false },
    total_violations_after_dr: { operator: '>=', value: 0, open: false },
    shortage_trips: { operator: '>=', value: 0, open: false },
    trips: { operator: '>=', value: 0, open: false },
    total_shortage_l: { operator: '>=', value: 0, open: false },
    avg_shortage_l: { operator: '>=', value: 0, open: false },
    vts_matched: { operator: '>=', value: 0, open: false },
    total_rd: { operator: '>=', value: 0, open: false },
    total_st: { operator: '>=', value: 0, open: false },
    total_dr: { operator: '>=', value: 0, open: false },
    total_pd: { operator: '>=', value: 0, open: false },
    total_sv: { operator: '>=', value: 0, open: false },
    total_cd: { operator: '>=', value: 0, open: false },
    total_nd: { operator: '>=', value: 0, open: false },
    events_30d: { operator: '>=', value: 0, open: false },
    events_10d: { operator: '>=', value: 0, open: false },
    events_5d: { operator: '>=', value: 0, open: false },
    unique_trucks_30d: { operator: '>=', value: 0, open: false },
    days_since_last: { operator: '>=', value: 0, open: false },
    dr: { operator: '>=', value: 0, open: false },
    pd: { operator: '>=', value: 0, open: false },
    rd: { operator: '>=', value: 0, open: false },
    st: { operator: '>=', value: 0, open: false },
    sv: { operator: '>=', value: 0, open: false },
    nd: { operator: '>=', value: 0, open: false },
    ha: { operator: '>=', value: 0, open: false },
    ht: { operator: '>=', value: 0, open: false },
    hb: { operator: '>=', value: 0, open: false },
  });
 
  // Helper function to get default input filter state for a column
  const getDefaultColumnInputFilter = () => ({
    total_trips: { operator: '>=', value: null, open: false },
    device_removed: { operator: '>=', value: null, open: false },
    power_disconnect: { operator: '>=', value: null, open: false },
    route_deviation: { operator: '>=', value: null, open: false },
    stoppage_violation: { operator: '>=', value: null, open: false },
    lrs: { operator: '>=', value: null, open: false },
    total_alerts: { operator: '>=', value: null, open: false },
    total_violations_after_dr: { operator: '>=', value: null, open: false },
    shortage_trips: { operator: '>=', value: null, open: false },
    trips: { operator: '>=', value: null, open: false },
    total_shortage_l: { operator: '>=', value: null, open: false },
    avg_shortage_l: { operator: '>=', value: null, open: false },
    vts_matched: { operator: '>=', value: null, open: false },
    total_rd: { operator: '>=', value: null, open: false },
    total_st: { operator: '>=', value: null, open: false },
    total_dr: { operator: '>=', value: null, open: false },
    total_pd: { operator: '>=', value: null, open: false },
    total_sv: { operator: '>=', value: null, open: false },
    total_cd: { operator: '>=', value: null, open: false },
    total_nd: { operator: '>=', value: null, open: false },
    events_30d: { operator: '>=', value: null, open: false },
    events_10d: { operator: '>=', value: null, open: false },
    events_5d: { operator: '>=', value: null, open: false },
    unique_trucks_30d: { operator: '>=', value: null, open: false },
    days_since_last: { operator: '>=', value: null, open: false },
    dr: { operator: '>=', value: null, open: false },
    pd: { operator: '>=', value: null, open: false },
    rd: { operator: '>=', value: null, open: false },
    st: { operator: '>=', value: null, open: false },
    sv: { operator: '>=', value: null, open: false },
    nd: { operator: '>=', value: null, open: false },
    ha: { operator: '>=', value: null, open: false },
    ht: { operator: '>=', value: null, open: false },
    hb: { operator: '>=', value: null, open: false },
  });
  const [locationFilter, setLocationFilter] = useState({
    zone: null,
    plant: null
  });
  const [resetTrigger, setResetTrigger] = useState(0);
  // const [totalRecords, setTotalRecords] = useState(0);
  const prevTabRef = useRef({
    section: activeSection,
    tab: activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeSection === "shortageAnalysis"
        ? activeShortageTab
        : "cluster"
  });

  // AG Grid ref
  const gridRef = useRef<AgGridReact>(null);

  const [schedulerDate, setSchedulerDate] = useState<string | null>(null);
  /** Last scheduler run for Location Risk Score tab (API may scope by `location_risk_score_master`) */
  const [locationSchedulerLastRunAt, setLocationSchedulerLastRunAt] = useState<string | null>(null);
  /** Last scheduler run for Shortage Analysis (scoped by active tab table) */
  const [shortageSchedulerLastRunAt, setShortageSchedulerLastRunAt] = useState<string | null>(null);

  // Fetch latest scheduler date from backend (risk_score_max_date)
  useEffect(() => {
    const isRiskScoreContext =
      activeSection === "clusterMaster" ||
      (activeSection === "riskAnalysis" &&
        (activeRiskTab === "transport" || activeRiskTab === "tts"));

    if (!isRiskScoreContext) return;

    const fetchSchedulerDate = async () => {
      try {
        const payload = {
          action: "risk_score_max_date",
          filters: [],
          cross_filters: [],
          drill_state: "",
          payload: {}
        };

        const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
          headers: { "Content-Type": "application/json" }
        });

        const normalized = extractRiskScoreMaxDate(response.data);
        if (normalized) {
          setSchedulerDate(normalized);
          setSelectedDate(normalized);
        }
      } catch (error) {
        console.error("Failed to fetch scheduler date:", error);
      }
    };

    fetchSchedulerDate();
  }, [activeSection, activeRiskTab]);

  // Location Risk Score tab: last scheduler run (table-scoped when backend supports it)
  useEffect(() => {
    if (activeSection !== "riskAnalysis" || activeRiskTab !== "location") return;

    const fetchLocationSchedulerLastRun = async () => {
      try {
        const payload = {
          action: "risk_score_max_date",
          filters: [],
          cross_filters: [],
          drill_state: "",
          payload: { table_name: "location_risk_score_master" }
        };

        const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
          headers: { "Content-Type": "application/json" }
        });

        const normalized = extractRiskScoreMaxDate(response.data);
        setLocationSchedulerLastRunAt(normalized);
      } catch (error) {
        console.error("Failed to fetch location risk score scheduler date:", error);
        setLocationSchedulerLastRunAt(null);
      }
    };

    fetchLocationSchedulerLastRun();
  }, [activeSection, activeRiskTab]);

  // Shortage Analysis: last scheduler run per tab (table_name from SHORTAGE_ANALYSIS_TABLE_NAMES)
  useEffect(() => {
    if (activeSection !== "shortageAnalysis") return;
    // Shortage-VTS Combined (mergedTable): no header line; skip fetch
    if (activeShortageTab === "mergedTable") {
      setShortageSchedulerLastRunAt(null);
      return;
    }

    const tableName = SHORTAGE_ANALYSIS_TABLE_NAMES[activeShortageTab];
    if (!tableName) {
      setShortageSchedulerLastRunAt(null);
      return;
    }

    const fetchShortageSchedulerLastRun = async () => {
      try {
        const payload = {
          action: "risk_score_max_date",
          filters: [],
          cross_filters: [],
          drill_state: "",
          payload: { table_name: tableName },
        };

        const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
          headers: { "Content-Type": "application/json" },
        });

        const normalized = extractRiskScoreMaxDate(response.data);
        setShortageSchedulerLastRunAt(normalized);
      } catch (error) {
        console.error("Failed to fetch shortage analysis scheduler date:", error);
        setShortageSchedulerLastRunAt(null);
      }
    };

    fetchShortageSchedulerLastRun();
  }, [activeSection, activeShortageTab]);

  /** Header “Last scheduler run” date: Location / Shortage tabs use table-scoped API; else cluster/transport/TT */
  const lastSchedulerForHeader = useMemo(() => {
    if (activeSection === "riskAnalysis" && activeRiskTab === "location") {
      return locationSchedulerLastRunAt;
    }
    if (activeSection === "shortageAnalysis") {
      return shortageSchedulerLastRunAt;
    }
    return schedulerDate;
  }, [
    activeSection,
    activeRiskTab,
    activeShortageTab,
    locationSchedulerLastRunAt,
    shortageSchedulerLastRunAt,
    schedulerDate,
  ]);

  // Track which column's search is open
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  // Track search text per column for inline header search
  const [headerSearchTexts, setHeaderSearchTexts] = useState<Record<string, string>>({});
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isDownloadingManual, setIsDownloadingManual] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const lastRiskFetchKeyRef = useRef<string | null>(null);

  // Custom header component: header text + sort (filter temporarily disabled)
  const CustomHeaderComponent = useCallback((props: any) => {
    const field = props.column.getColId();
    const isOpen = openFilterColumn === field;
    const searchText = headerSearchTexts[field] || '';

    const onSortRequested = (e: React.MouseEvent) => {
      const currentSort = props.column.getSort();
      if (!currentSort) props.setSort('asc', e.shiftKey);
      else if (currentSort === 'asc') props.setSort('desc', e.shiftKey);
      else props.setSort(null, e.shiftKey);
    };

    const toggleFilter = (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenFilterColumn(prev => prev === field ? null : field);
    };

    const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHeaderSearchTexts(prev => ({ ...prev, [field]: e.target.value }));
    };

    const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const value = (e.target as HTMLInputElement).value.trim();
        setColumnFilters(prev => {
          const updated = { ...prev };
          if (value) updated[field] = value;
          else delete updated[field];
          return updated;
        });
        setCurrentPage(0);
      }
    };

    const clearSearch = () => {
      setHeaderSearchTexts(prev => ({ ...prev, [field]: '' }));
      setColumnFilters(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
      setCurrentPage(0);
      setOpenFilterColumn(null);
    };

    let sortIcon = '';
    const allDisplayedCols = props.columnApi?.getAllDisplayedColumns?.() || [];
    const isFirstDisplayedColumn =
      allDisplayedCols.length > 0 && allDisplayedCols[0].getColId() === field;

    // Use our own sort state so headers always re-render correctly
    if (sortColumn === field) {
      // Show generic sort indicator for the active sorted column
      sortIcon = '⇅';
    } else if (!sortColumn && isFirstDisplayedColumn) {
      // Before any sort is applied, show default icon only on first column
      sortIcon = '⇅';
    }
    const hasActiveFilter = columnFilters[field] && columnFilters[field].length > 0;
    const isTwoLineHeader = typeof props.displayName === 'string' && props.displayName.includes('\n');
    /** Green-badge violation columns: hide header filter/search (Completed + Transport + TT Risk + Shortage tabs) */
    const hideFilterForThisColumn =
      (activeSection === "riskAnalysis" &&
        (activeRiskTab === "completed" ||
          activeRiskTab === "transport" ||
          activeRiskTab === "tts") &&
        COMPLETED_GREEN_BADGE_COL_IDS.has(field)) ||
      (activeSection === "shortageAnalysis" &&
        activeShortageTab === "mergedTable" &&
        MERGED_SHORTAGE_VTS_GREEN_BADGE_COL_IDS.has(field)) ||
      (activeSection === "shortageAnalysis" &&
        activeShortageTab === "routeTT" &&
        ROUTE_TT_GREEN_BADGE_COL_IDS.has(field)) ||
      (activeSection === "shortageAnalysis" &&
        activeShortageTab === "customerV" &&
        CUSTOMER_VIOLATION_GREEN_BADGE_COL_IDS.has(field)) ||
      (activeSection === "shortageAnalysis" &&
        activeShortageTab === "ttViolation" &&
        TT_VIOLATION_GREEN_BADGE_COL_IDS.has(field));
    const showSearchRow = isOpen && !hideFilterForThisColumn;

    const wrapperStyle: React.CSSProperties = {
      width: '100%',
      lineHeight: '1.2',
      minWidth: 0,
      overflow: isTwoLineHeader ? 'visible' : 'hidden',
      position: 'relative' as const,
    };
    const headerRowStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      cursor: 'pointer',
      minWidth: 0,
      overflow: isTwoLineHeader ? 'visible' : 'hidden',
    };

    return React.createElement('div', { style: wrapperStyle }, [
      // Row 1: Header text (two lines when \n in name) + filter + sort
      React.createElement('div', {
        key: 'header-row',
        style: headerRowStyle,
        onClick: onSortRequested
      }, [
        React.createElement('span', {
          key: 'label',
          style: {
            fontWeight: 'bold',
            fontSize: '12px',
            textTransform: 'uppercase',
            flex: '1 1 0',
            minWidth: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            lineHeight: 1.25,
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          },
          title: props.displayName
        }, props.displayName),
        ...(hideFilterForThisColumn
          ? []
          : [
        React.createElement('span', {
          key: 'filter',
          onClick: toggleFilter,
          style: { display: 'inline-flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer', marginLeft: '2px' },
          title: isOpen ? 'Hide search' : 'Search'
        }, React.createElement(Filter, { size: 12, color: isOpen || hasActiveFilter ? '#2563eb' : '#6b7280' })),
            ]),
        React.createElement('span', { key: 'sort', style: { fontSize: '10px', color: '#6b7280', flexShrink: 0 } }, sortIcon),
      ]),
      // Row 2: Filter/search - absolute when two-line so header height stays fixed and top isn't cut off
      showSearchRow ? React.createElement('div', {
        key: 'search-row',
        style: isTwoLineHeader ? {
          position: 'absolute' as const,
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '2px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          padding: '2px 4px',
          gap: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        } : {
          marginTop: '4px',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          padding: '2px 4px',
          gap: '4px',
        },
        onClick: (e: React.MouseEvent) => e.stopPropagation()
      }, [
        React.createElement(Search, { key: 'search-icon', size: 12, color: '#6b7280', style: { flexShrink: 0 } }),
        React.createElement('input', {
          key: 'input',
          type: 'text',
          placeholder: 'Search...',
          value: searchText,
          autoFocus: true,
          onChange: onSearchChange,
          onKeyDown: onSearchKeyDown,
          style: {
            width: '100%',
            padding: '1px 4px',
            fontSize: '11px',
            border: 'none',
            borderRadius: '2px',
            outline: 'none',
            height: '20px',
            boxSizing: 'border-box' as const,
            backgroundColor: 'transparent',
            color: '#1f2937',
          }
        }),
        React.createElement('span', {
          key: 'clear',
          onClick: clearSearch,
          style: {
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
          },
          title: 'Clear filter'
        }, React.createElement(X, { size: 13, color: '#6b7280' }))
      ]) : null
    ]);
  }, [openFilterColumn, headerSearchTexts, columnFilters, sortColumn, sortDirection, activeSection, activeRiskTab, activeShortageTab]);

  const tableNameMap = {
    riskAnalysis: {
      completed: "completed_trips_risk_score",
      transport: "transporter_risk_score",
      tts: "tt_risk_score",
      afterDR: "tt_after_dr",
      location: "location_risk_score_master"
    },
    shortageAnalysis: {
      ttViolation: "tt_violation_summary",
      customerV: "cust_violation_summary",
      routeTT: "route_tt_violation",
      srcDest: "srcdest_consistency",
      /** Shortage-VTS Combined (UI tab) → API `payload.table_name` */
      mergedTable: "merged_shortage_vts",
      customerSummary: "customer_hot_summary"
    },
    clusterMaster: "cluster_master"
  };

  /** `merged_shortage_vts` — columns sent in API payload for Shortage-VTS Combined (mergedTable). */
  const MERGED_SHORTAGE_VTS_COLUMNS = [
    "sbu_nm",
    "zone_nm",
    "invoice_no",
    "invoice_date",
    "tt_number",
    "qty_shortage (in ltrs)",
    "item_desc",
    "sap_id",
    "plant_nm",
    "destination",
    "route_deviation_count",
    "speed_violation_count",
    "main_supply_removal_count",
    "device_tamper_count",
    "stoppage_violations_count",
    "night_driving_count",
    "continuous_driving_count",
    "load_no2",
    "carrier_no",
    "trip_start_datetime",
    "trip_end_datetime",
    "tt_type",
  ];

  const fetchData = async (section, tab) => {
    // Build a key representing this fetch request; prevents duplicate API calls
    const fetchKey = JSON.stringify({
      section,
      tab,
      selectedDate,
      selectedBu,
      selectedZone,
      selectedPlant,
      ...(section === "shortageAnalysis" && tab === "mergedTable"
        ? {
            mergedTableSelectedBu,
            mergedTableSelectedZone,
            mergedTableSelectedPlant,
            mergedTableTimeFilter,
            mergedTableDateRange:
              mergedTableDateRangeFilter?.start && mergedTableDateRangeFilter?.end
                ? `${mergedTableDateRangeFilter.start.toISOString()}|${mergedTableDateRangeFilter.end.toISOString()}`
                : null,
          }
        : {}),
      selectedLocationType,
      selectedTimeFilter,
      dateRangeFilter,
      currentPage,
      itemsPerPage,
      sortColumn,
      sortDirection,
      columnFilters,
      searchTerms,
    });

    if (lastRiskFetchKeyRef.current === fetchKey) {
      return;
    }
    lastRiskFetchKeyRef.current = fetchKey;

    setLoading(true);
    setError(null);

    try {
      const getDateRangeString = (filter, customRange) => {
        const now = new Date();
        const fmt = (d) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (customRange && customRange.start && customRange.end) {
          return `${fmt(customRange.start)},${fmt(customRange.end)}`;
        }
        const presets = { TDY: 0, YDY: 1, "1W": 7, "15D": 15, "1M": 30, "3M": 90 };
        const s = new Date(now);
        const filterKey = filter != null ? String(filter).toUpperCase() : "";
        s.setDate(s.getDate() - (presets[filterKey] ?? presets[filter] ?? 0));
        // YDY: use same date (yesterday) for both start and end
        if (filterKey === "YDY") {
          return `${fmt(s)},${fmt(s)}`;
        }
        return `${fmt(s)},${fmt(now)}`;
      };

      let tableName;
      if (section === "clusterMaster") {
        tableName = tableNameMap[section];
      } else {
        tableName = tableNameMap[section][tab];
      }
      if (!tableName) return;

      let columns;
      // For completed tab, include specific columns in exact order
      if (tab === "completed") {
        columns = [
          "zone_name",
          "location_name",
          "trip_name",
          "trip_id",
          "invoice_no",
          "invoice_date",
          "tt_number",
          "risk_score",
          "combinational_alert_count",
          "dr",
          "pd",
          "rd",
          "st",
          "ht",
          "ha",
          "hb",
          "nd",
          "sv",
          "scheduled_trip_start_datetime",
          "scheduled_trip_end_datetime",
          "transporter_code",
          "route_no"
        ];
      }

      if (tab === "transport") {
        columns = [
          "transporter_code",
          "transporter_name",
          "risk_score",
          "total_trips",
          "dr",
          "pd",
          "rd",
          "st",
          "sv",
          "nd",
          "ha",
          "ht",
          "hb"
        ]
      }

      if (tab === "mergedTable") {
        columns = MERGED_SHORTAGE_VTS_COLUMNS;
      }

      if (tab === "ttViolation") {
        columns = [
          "tt_number",
          "trips",
          "total_shortage_l",
          "avg_shortage_l",
          "vts_matched",
          "total_rd",
          "total_st",
          "total_dr",
          "total_pd",
          "total_sv",
          "total_cd",
          "total_nd"
        ]
      }

      if (tab === 'customerV') {
        columns = [
          "destination",
          "shortage_events",
          "avg_shortage_l",
          "unique_tts",
          "total_st",
          "total_dr",
          "total_sv",
          "total_cd",
          "total_nd"
        ]
      }

      if (tab === 'routeTT') {
  columns = [
    "src_dest",
    "tt_number",
    "events",
    "total_shortage_l",
    "avg_shortage_l",
    "first_date",
    "last_date",
    "total_rd",
    "total_st",
    "total_dr",
    "total_pd",
    "total_sv",
    "total_cd",
    "total_nd"
  ]
}

      if (tab === 'srcDest') {
  // For srcdest_consistency table, include all specific columns
  columns = [
    "src_dest",
    "months_with_shortage",
    "total_shortage_l",
    "total_events"
  ]
}

      if (tab === 'customerSummary') {
  // For customer_hot_summary table, include all specific columns
  columns = [
    "destination",
    "shortage_events",
    "total_shortage_l",
    "avg_shortage_l",
    "unique_tts",
    "unique_transporters"
  ]
}

      if (tab === 'cluster') {
  // For cluster_master table, include all specific columns
  columns = [
          // "cluster_id",
          // "alert_type",
          // "risk_score",
          // "risk_band",
          // "centroid_lat",
          // "centroid_lon",
          // "first_seen",
          // "last_seen",
          // "events_25d",
          // "events_10d",
          // "events_5d",
          // "unique_trucks_30d",
          // "status",
          // "days_since_last"
    "cluster_id",
          "cluster_type",
    "risk_score",
    "risk_band",
    "centroid_lat_lon",
    "first_seen",
    "last_seen",
          "events_30d",
    "events_10d",
    "events_5d",
    "unique_trucks_30d",
    "status",
    "days_since_last"

  ]
}

      if (tab === 'afterDR') {
  // For tt_after_dr table, include all specific columns
  columns = [
    "invoice_no",
    "tt_number",
    "load_no",
    "route_no",
    "location",
    "destination",
    "transporter_code",
    "transporter_name",
    "last_dr_time",
    "total_trips_after_last_dr",
    "total_violations_after_dr",
    "power_disconnect",
    "route_deviation",
    "stoppage_violation"
  ]
}
      const currentSearchTerm = section === "clusterMaster"
        ? searchTerms[section] || ""
        : searchTerms[section]?.[tab] || "";

      // Build range_filters array for all range filter columns (tab-specific)
      const tabKey = `${section}_${tab}`;
      const buildRangeFilters = () => {
        const filters = [];
        // Get tab-specific risk score filter
        const tabRiskScoreFilter = riskScoreRangeFilter[tabKey] || { operator: '>=', value: 5 };
        // Only add filter if value is set and not the default (5)
        if (tabRiskScoreFilter.value !== null && tabRiskScoreFilter.value !== undefined && tabRiskScoreFilter.value !== 5) {
          filters.push({
            column: "risk_score",
            operator: tabRiskScoreFilter.operator,
            value: tabRiskScoreFilter.value
          });
        }
        // Add filters for other columns if value is set and not default (0)
        const tabRangeFilters = rangeFiltersState[tabKey] || {};
        Object.entries(tabRangeFilters).forEach(([column, filter]) => {
          if (filter.value !== null && filter.value !== undefined && filter.value !== 0) {
            filters.push({
              column: column,
              operator: filter.operator,
              value: filter.value
            });
          }
        });
        return filters;
      };
     
      // For completed tab, use special payload structure
      if (tab === "completed") {
        // Define filterable columns for completed trips
        const filterableColumns = [
          "trip_name",
          "trip_id",
          "invoice_no",
          "tt_number",
          "transporter_code",
          "route_no",
          "zone_name",
          "location_name"
        ];
       
        // Build column_filters object with current filter values or empty strings
        const columnFiltersObj = {};
        filterableColumns.forEach(col => {
          columnFiltersObj[col] = columnFilters[col] || "";
        });
       
        const dateFilterString = getDateRangeString(selectedTimeFilter, dateRangeFilter);

        // Build filters array for BU, zone, and plant
        const filters: Array<{ key: string; cond: string; value: string }> = [];
        // For completed_trips_risk_score, default to SOD, use selectedBu if it's LPG
        const locationTypeValue = selectedBu === "LPG" ? "LPG" : "SOD";
        filters.push({ key: "location_type", cond: "equals", value: locationTypeValue });
        if (selectedZone && selectedZone !== "all") {
          filters.push({ key: "zone_name", cond: "equals", value: selectedZone });
        }
        if (selectedPlant && selectedPlant !== "all") {
          filters.push({ key: "location", cond: "equals", value: String(selectedPlant) });
        }

      const payload = {
        action: "risk_score",
        payload: {
          table_name: tableName,
            columns: columns,
            search: currentSearchTerm || "",
            column_filters: columnFiltersObj,
            range_filters: buildRangeFilters(),
           sort_by: sortColumn || "risk_score",
            sort_direction: sortColumn ? sortDirection : "desc",
          page: currentPage,
          page_size: itemsPerPage,
            download: "false"
          },
          filters: filters,
          cross_filters: dateFilterString ? [{
          key: "DATE",
          cond: "equals",
          value: dateFilterString,
          }] : []
        };
       
        const response = await apiClient.post("/api/charts/generate_vis_data", payload);
        const newData = response.data?.data || [];

        // Extract total_records from API response (checking multiple possible field names)
        const extractTotalRecords = (responseData) => {
          if (typeof responseData?.total_records === 'number') return responseData.total_records;
          if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
          if (typeof responseData?.total === 'number') return responseData.total;
          if (typeof responseData?.count === 'number') return responseData.count;
          if (typeof responseData?.payload?.total_records === 'number') return responseData.payload.total_records;
          if (typeof responseData?.payload?.totalRecords === 'number') return responseData.payload.totalRecords;
          if (typeof responseData?.payload?.total === 'number') return responseData.payload.total;
          // If no total found, use the length of current data as fallback (but this shouldn't happen)
          return newData.length;
        };

        const totalFromApi = extractTotalRecords(response.data);
        console.log("API Response structure:", {
          total_records: response.data?.total_records,
          totalRecords: response.data?.totalRecords,
          total: response.data?.total,
          count: response.data?.count,
          extractedTotal: totalFromApi,
          dataLength: newData.length
        });
       
        setTotalRecords(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [tab]: totalFromApi
          }
        }));
       
        if (section === "riskAnalysis") {
          setRiskAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "shortageAnalysis") {
          setShortageAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "clusterMaster") {
          setClusterMasterData(newData);
        }

        setLoadedTabs(prev => ({
          ...prev,
          [section]: { ...prev[section], [tab]: true }
        }));
       
        setLoading(false);
        return;
      }
     
      // For transport tab, use special payload structure
      if (tab === "transport") {
        // Define columns for transport risk score
        const transportColumns = [
          "transporter_code",
          "transporter_name",
          "risk_score",
          "total_trips",
          "dr",
          "pd",
          "rd",
          "st",
          "sv",
          "nd",
          "ha",
          "ht",
          "hb"
        ];
       
        // Define filterable columns for transport risk score
        const filterableColumns = [
          "transporter_code",
          "transporter_name"
        ];
       
        // Build column_filters object with current filter values or empty strings
        const columnFiltersObj = {};
        filterableColumns.forEach(col => {
          columnFiltersObj[col] = columnFilters[col] || "";
        });
       
        // Build filters array for BU, zone, and plant
        const filters: Array<{ key: string; cond: string; value: string }> = [];
        // Use selectedLocationType for transport tab (same as cluster_master)
        const locationTypeValue = tab === "transport" ? selectedLocationType : (selectedBu || "SOD");
        if (locationTypeValue) {
          filters.push({ key: "location_type", cond: "equals", value: locationTypeValue });
        }
        if (selectedZone && selectedZone !== "all") {
          filters.push({ key: "zone_name", cond: "equals", value: selectedZone });
        }
        if (selectedPlant && selectedPlant !== "all") {
          filters.push({ key: "location", cond: "equals", value: String(selectedPlant) });
        }
       
        const payload = {
          action: "risk_score",
          payload: {
            table_name: tableName,
            columns: transportColumns,
            search: currentSearchTerm || "",
            column_filters: columnFiltersObj,
            range_filters: buildRangeFilters(),
          sort_by: sortColumn || "risk_score",
            sort_direction: sortColumn ? sortDirection : "desc",
            page: currentPage,
            page_size: itemsPerPage
          },
          filters: filters,
          cross_filters: selectedDate ? [{
            key: "DATE",
            cond: "equals",
            value: `${selectedDate},${selectedDate}`,
          }] : []
        };
       
        const response = await apiClient.post("/api/charts/generate_vis_data", payload);
        let newData = response.data?.data || [];

        // Extract total_records from API response (checking multiple possible field names)
        const extractTotalRecords = (responseData) => {
          if (typeof responseData?.total_records === 'number') return responseData.total_records;
          if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
          if (typeof responseData?.total === 'number') return responseData.total;
          if (typeof responseData?.count === 'number') return responseData.count;
          if (typeof responseData?.payload?.total_records === 'number') return responseData.payload.total_records;
          if (typeof responseData?.payload?.totalRecords === 'number') return responseData.payload.totalRecords;
          if (typeof responseData?.payload?.total === 'number') return responseData.payload.total;
          return newData.length;
        };

        const totalFromApi = extractTotalRecords(newData.length > 0 ? (response.data || {}) : {});
       
        setTotalRecords(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [tab]: totalFromApi
          }
        }));
       
        if (section === "riskAnalysis") {
          setRiskAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "shortageAnalysis") {
          setShortageAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "clusterMaster") {
          setClusterMasterData(newData);
        }

        setLoadedTabs(prev => ({
          ...prev,
          [section]: { ...prev[section], [tab]: true }
        }));
       
        setLoading(false);
        return;
      }
     
      // For tts tab, use special payload structure
      if (tab === "tts") {
        // Define columns for tts risk score
        const ttsColumns = [
          "tt_number",
          "transporter_code",
          "transporter_name",
          "risk_score",
          "total_trips",
          "dr",
          "pd",
          "rd",
          "st",
          "sv",
          "nd",
          "ha",
          "ht",
          "hb"
        ];
       
        // Define filterable columns for tts risk score
        const filterableColumns = [
          "tt_number",
          "transporter_code",
          "transporter_name"
        ];
       
        // Build column_filters object with current filter values or empty strings
        const columnFiltersObj = {};
        filterableColumns.forEach(col => {
          columnFiltersObj[col] = columnFilters[col] || "";
        });
       
        // Build filters array for BU, zone, and plant
        const filters: Array<{ key: string; cond: string; value: string }> = [];
        // Use selectedLocationType for tts tab (same as cluster_master)
        const locationTypeValue = tab === "tts" ? selectedLocationType : (selectedBu || "SOD");
        if (locationTypeValue) {
          filters.push({ key: "location_type", cond: "equals", value: locationTypeValue });
        }
        if (selectedZone && selectedZone !== "all") {
          filters.push({ key: "zone_name", cond: "equals", value: selectedZone });
        }
        if (selectedPlant && selectedPlant !== "all") {
          filters.push({ key: "location", cond: "equals", value: String(selectedPlant) });
        }
       
        const payload = {
          action: "risk_score",
          payload: {
            table_name: tableName,
            columns: ttsColumns,
            search: currentSearchTerm || "",
            column_filters: columnFiltersObj,
            range_filters: buildRangeFilters(),
           sort_by: sortColumn || "risk_score",
            sort_direction: sortColumn ? sortDirection : "desc",
            page: currentPage,
            page_size: itemsPerPage
          },
          filters: filters,
          cross_filters: selectedDate ? [{
            key: "DATE",
            cond: "equals",
            value: `${selectedDate},${selectedDate}`,
          }] : []
        };
       
        const response = await apiClient.post("/api/charts/generate_vis_data", payload);
        let newData = response.data?.data || [];

        // Extract total_records from API response
        const extractTotalRecords = (responseData) => {
          if (typeof responseData?.total_records === 'number') return responseData.total_records;
          if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
          if (typeof responseData?.total === 'number') return responseData.total;
          if (typeof responseData?.count === 'number') return responseData.count;
          if (typeof responseData?.payload?.total_records === 'number') return responseData.payload.total_records;
          if (typeof responseData?.payload?.totalRecords === 'number') return responseData.payload.totalRecords;
          if (typeof responseData?.payload?.total === 'number') return responseData.payload.total;
          return newData.length;
        };

        const totalFromApi = extractTotalRecords(response.data);
       
        setTotalRecords(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [tab]: totalFromApi
          }
        }));
       
        if (section === "riskAnalysis") {
          setRiskAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "shortageAnalysis") {
          setShortageAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "clusterMaster") {
          setClusterMasterData(newData);
        }

        setLoadedTabs(prev => ({
          ...prev,
          [section]: { ...prev[section], [tab]: true }
        }));
       
        setLoading(false);
        return;
      }
     
      // For clusterMaster section, use special payload structure
      if (section === "clusterMaster") {
        // Define filterable columns for cluster_master
        const filterableColumns = [
          "cluster_type",
          "status"
        ];
       
        // Build column_filters object with current filter values or empty strings
        const columnFiltersObj = {};
        filterableColumns.forEach(col => {
          columnFiltersObj[col] = columnFilters[col] || "";
        });

        // Specific columns to send for cluster_master - exact order as specified
        const clusterMasterColumns = [
          "cluster_id",
          "cluster_type",
          "plant_name",
          "risk_score",
          "risk_band",
          "centroid_lat_lon",
          "first_seen",
          "last_seen",
          "events_30d",
          "events_10d",
          "events_5d",
          "unique_trucks_30d",
          "status",
          "days_since_last"
        ];
       
        const payload = {
          action: "risk_score",
          payload: {
            table_name: tableName,
            columns: clusterMasterColumns,
            search: currentSearchTerm || "",
            column_filters: columnFiltersObj,
            range_filters: buildRangeFilters(),
           sort_by: sortColumn || "risk_score",
            sort_direction: sortColumn ? sortDirection : "desc",
            page: currentPage,
            page_size: itemsPerPage
          },
          filters: [
            { key: "location_type", cond: "equals", value: selectedLocationType }
          ],
          cross_filters: selectedDate ? [{
            key: "DATE",
            cond: "equals",
            value: `${selectedDate},${selectedDate}`,
          }] : []
        };
       
        const response = await apiClient.post("/api/charts/generate_vis_data", payload);
        let newData = response.data?.data || [];

        // Extract total_records from API response
        const extractTotalRecords = (responseData) => {
          if (typeof responseData?.total_records === 'number') return responseData.total_records;
          if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
          if (typeof responseData?.total === 'number') return responseData.total;
          if (typeof responseData?.count === 'number') return responseData.count;
          if (typeof responseData?.payload?.total_records === 'number') return responseData.payload.total_records;
          if (typeof responseData?.payload?.totalRecords === 'number') return responseData.payload.totalRecords;
          if (typeof responseData?.payload?.total === 'number') return responseData.payload.total;
          return newData.length;
        };

        const totalFromApi = extractTotalRecords(response.data);
       
        // Handle clusterMaster differently since it's not a nested structure
        if (section === "clusterMaster") {
          setTotalRecords(prev => ({
            ...prev,
            [section]: totalFromApi
          }));
          setClusterMasterData(newData);
          setLoadedTabs(prev => ({
            ...prev,
            [section]: true
          }));
        } else {
        setTotalRecords(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [tab]: totalFromApi
          }
        }));
       
        if (section === "riskAnalysis") {
          setRiskAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "shortageAnalysis") {
          setShortageAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        }

        setLoadedTabs(prev => ({
          ...prev,
          [section]: { ...prev[section], [tab]: true }
        }));
        }
       
        setLoading(false);
        return;
      }
     
      // For location tab, use special payload structure
      if (tab === "location" && section === "riskAnalysis") {
        // location_risk_score_master — columns aligned with API contract
        const locationColumns = [
          "sbu_nm",
          "location",
          "location_name",
          "total_trips",
          "total_alerts",
          "shortage_trips",
          "lrs"
        ];
       
        // Build column_filters object (empty as per payload)
        const columnFiltersObj = {};
       
        const payload = {
          action: "risk_score",
          payload: {
            table_name: "location_risk_score_master",
            columns: locationColumns,
            search: currentSearchTerm || "",
            column_filters: columnFiltersObj,
            range_filters: [],
            sort_by: sortColumn || "location",
            sort_direction: sortDirection || "asc",
            page: currentPage,
            page_size: itemsPerPage
          },
          filters: [],
          cross_filters: []
        };
       
        const response = await apiClient.post("/api/charts/generate_vis_data", payload);
        const newData = response.data?.data || [];

        // Extract total_records from API response (checking multiple possible field names and locations)
        const extractTotalRecords = (responseData, fullResponse) => {
          // Check in full response object (response.data)
          if (typeof fullResponse?.total_records === 'number') return fullResponse.total_records;
          if (typeof fullResponse?.totalRecords === 'number') return fullResponse.totalRecords;
          if (typeof fullResponse?.total === 'number') return fullResponse.total;
          if (typeof fullResponse?.count === 'number') return fullResponse.count;

          // Check top level of responseData
          if (typeof responseData?.total_records === 'number') return responseData.total_records;
          if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
          if (typeof responseData?.total === 'number') return responseData.total;
          if (typeof responseData?.count === 'number') return responseData.count;

          // Check in payload
          if (typeof responseData?.payload?.total_records === 'number') return responseData.payload.total_records;
          if (typeof responseData?.payload?.totalRecords === 'number') return responseData.payload.totalRecords;
          if (typeof responseData?.payload?.total === 'number') return responseData.payload.total;

          // Check in data object
          if (typeof responseData?.data?.total_records === 'number') return responseData.data.total_records;
          if (typeof responseData?.data?.totalRecords === 'number') return responseData.data.totalRecords;
          if (typeof responseData?.data?.total === 'number') return responseData.data.total;

          // Check in response object itself (sometimes axios wraps it)
          if (typeof responseData?.response?.total_records === 'number') return responseData.response.total_records;

          // If no total found, use the length of current data as fallback (but this shouldn't happen)
          console.warn("Could not find total_records in response, using data length as fallback:", newData.length);
          return newData.length;
        };

        const totalFromApi = extractTotalRecords(response.data, response.data);
        console.log("Location Risk Score API Response structure:", {
          fullResponse: response,
          responseData: response.data,
          total_records: response.data?.total_records,
          totalRecords: response.data?.totalRecords,
          total: response.data?.total,
          count: response.data?.count,
          payload_total_records: response.data?.payload?.total_records,
          data_total_records: response.data?.data?.total_records,
          extractedTotal: totalFromApi,
          dataLength: newData.length,
          willSetToState: totalFromApi
        });
       
        setTotalRecords(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [tab]: totalFromApi
          }
        }));
       
        if (section === "riskAnalysis") {
          setRiskAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "shortageAnalysis") {
          setShortageAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "clusterMaster") {
          setClusterMasterData(newData);
        }

        setLoadedTabs(prev => ({
          ...prev,
          [section]: { ...prev[section], [tab]: true }
        }));
       
        setLoading(false);
        return;
      }
     
      // For afterDR tab, use special payload structure
      if (tab === "afterDR") {
        // Build column_filters object (empty for now)
        const columnFiltersObj = {};
       
        const payload = {
          action: "risk_score",
          payload: {
            table_name: tableName,
            columns: columns || [],
            search: currentSearchTerm || "",
            column_filters: columnFiltersObj,
            range_filters: buildRangeFilters(),
            sort_by: sortColumn || "invoice_no",
            sort_direction: sortDirection || "desc",
            page: currentPage,
            page_size: itemsPerPage
          },
          filters: [],
          cross_filters: []
        };
       
        const response = await apiClient.post("/api/charts/generate_vis_data", payload);
        const newData = response.data?.data || [];

        // Extract total_records from API response (checking multiple possible field names)
        const extractTotalRecords = (responseData) => {
          if (typeof responseData?.total_records === 'number') return responseData.total_records;
          if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
          if (typeof responseData?.total === 'number') return responseData.total;
          if (typeof responseData?.count === 'number') return responseData.count;
          if (typeof responseData?.payload?.total_records === 'number') return responseData.payload.total_records;
          if (typeof responseData?.payload?.totalRecords === 'number') return responseData.payload.totalRecords;
          if (typeof responseData?.payload?.total === 'number') return responseData.payload.total;
          // If no total found, use the length of current data as fallback (but this shouldn't happen)
          return newData.length;
        };

        const totalFromApi = extractTotalRecords(response.data);
        console.log("API Response structure:", {
          total_records: response.data?.total_records,
          totalRecords: response.data?.totalRecords,
          total: response.data?.total,
          count: response.data?.count,
          extractedTotal: totalFromApi,
          dataLength: newData.length
        });
       
        setTotalRecords(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [tab]: totalFromApi
          }
        }));
       
        if (section === "riskAnalysis") {
          setRiskAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "shortageAnalysis") {
          setShortageAnalysisData((prev) => ({ ...prev, [tab]: newData }));
        } else if (section === "clusterMaster") {
          setClusterMasterData(newData);
        }

        setLoadedTabs(prev => ({
          ...prev,
          [section]: { ...prev[section], [tab]: true }
        }));
       
        setLoading(false);
        return;
      }
     
      // For other tabs (Shortage Analysis), use the existing payload structure
      // Build column_filters object for Shortage Analysis tabs
      const columnFiltersObj = {};

      // For merged_shortage_vts (mergedTable tab), send selected BU/zone/plant via filters (use mergedTable-specific state)
      const filters: Array<{ key: string; cond: string; value: string }> = [];
      if (section === "shortageAnalysis" && tab === "mergedTable") {
        if (mergedTableSelectedBu) {
          filters.push({ key: "sbu_nm", cond: "equals", value: mergedTableSelectedBu });
        }
        // After a global refresh we temporarily ignore zone/plant once,
        // so any default pushed by ZonePlantSelections doesn't leak into filters.
        if (!ignoreMergedTableLocationFilters) {
          if (mergedTableSelectedZone && mergedTableSelectedZone !== "all") {
            filters.push({ key: "zone_nm", cond: "equals", value: String(mergedTableSelectedZone) });
          }
          if (mergedTableSelectedPlant && mergedTableSelectedPlant !== "all") {
            filters.push({ key: "sap_id", cond: "equals", value: String(mergedTableSelectedPlant) });
          }
        }
      }

      // For merged_shortage_vts (mergedTable tab), send preset or custom date range only (not single-date picker)
      const mergedTableDateFilterString =
        section === "shortageAnalysis" && tab === "mergedTable"
          ? getDateRangeString(mergedTableTimeFilter, mergedTableDateRangeFilter)
          : null;
     
      const payload = {
        action: "risk_score",
        payload: {
          table_name: tableName,
          columns: columns || [],
          page: currentPage,
          page_size: itemsPerPage,
          sort_by: sortColumn || (columns && columns.length > 0 ? columns[0] : null),
          sort_direction: sortDirection || "desc",
          ...(currentSearchTerm && { search: currentSearchTerm }),
          column_filters: columnFiltersObj,
          range_filters: buildRangeFilters()
        },
        filters,
        cross_filters:
          mergedTableDateFilterString
            ? [
                {
                  key: "DATE",
                  cond: "equals",
                  value: mergedTableDateFilterString,
                },
              ]
            : []
      };
      console.log("page", currentPage, itemsPerPage)

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
      const newData = response.data?.data || [];

      // Extract total_records from API response (checking multiple possible field names)
      const extractTotalRecords = (responseData) => {
        if (typeof responseData?.total_records === 'number') return responseData.total_records;
        if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
        if (typeof responseData?.total === 'number') return responseData.total;
        if (typeof responseData?.count === 'number') return responseData.count;
        if (typeof responseData?.payload?.total_records === 'number') return responseData.payload.total_records;
        if (typeof responseData?.payload?.totalRecords === 'number') return responseData.payload.totalRecords;
        if (typeof responseData?.payload?.total === 'number') return responseData.payload.total;
        // If no total found, use the length of current data as fallback (but this shouldn't happen)
        return newData.length;
      };

      const totalFromApi = extractTotalRecords(response.data);
      console.log("API Response structure:", {
        total_records: response.data?.total_records,
        totalRecords: response.data?.totalRecords,
        total: response.data?.total,
        count: response.data?.count,
        extractedTotal: totalFromApi,
        dataLength: newData.length
      });
      // setTotalRecords(totalFromApi);
setTotalRecords(prev => ({
     ...prev,
     [section]: {
       ...prev[section],
       [tab]: totalFromApi
     }
   }))
      if (section === "riskAnalysis") {
        setRiskAnalysisData((prev) => ({ ...prev, [tab]: newData }));
      } else {
        setShortageAnalysisData((prev) => ({ ...prev, [tab]: newData }));
      }

      setLoadedTabs(prev => ({
        ...prev,
        [section]: { ...prev[section], [tab]: true }
      }));
    } catch (err) {
      console.error(`Error fetching ${section}:${tab}`, err);
      setError("Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  };

  console.log("page", currentPage, itemsPerPage)
  useEffect(() => {
    const currentTab = activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeSection === "shortageAnalysis"
        ? activeShortageTab
        : "cluster";

    const isRiskScoreContext =
      activeSection === "clusterMaster" ||
      (activeSection === "riskAnalysis" &&
        (currentTab === "transport" || currentTab === "tts"));

    // For TT Risk / Transporter Risk / Cluster Master, wait until we have schedulerDate
    if (isRiskScoreContext && !schedulerDate) {
      return;
    }

    fetchData(activeSection, currentTab);
    // fetchData(activeSection, currentTab);
  }, [currentPage, itemsPerPage, activeSection, activeRiskTab, activeShortageTab, schedulerDate]);

  // Trigger fetch when search term changes for current table
  useEffect(() => {
    const currentTab = activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeSection === "shortageAnalysis"
        ? activeShortageTab
        : "cluster";

    // Check if tab changed - if so, update ref and don't fetch (other useEffect handles tab changes)
    const tabChanged = prevTabRef.current.section !== activeSection ||
                       prevTabRef.current.tab !== currentTab;

    if (tabChanged) {
      prevTabRef.current = { section: activeSection, tab: currentTab };
      return;
    }

    // Only trigger if we have a loaded tab (to avoid duplicate calls on initial load)
    const isTabLoaded = activeSection === "clusterMaster"
      ? loadedTabs[activeSection]
      : loadedTabs[activeSection]?.[currentTab];
    if (!isTabLoaded) {
      return;
    }

    // Debounce search - only fetch after user stops typing for 800ms
    const timeoutId = setTimeout(() => {
      setCurrentPage(0); // Reset to first page when searching
      fetchData(activeSection, currentTab);
    }, 800); // 800ms debounce - wait for user to finish typing

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerms, activeSection, activeRiskTab, activeShortageTab]);


  useEffect(() => {
    const currentTab = activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeSection === "shortageAnalysis"
        ? activeShortageTab
        : "cluster";
   
    // Update ref when tab changes
    prevTabRef.current = { section: activeSection, tab: currentTab };

    if (activeSection === "clusterMaster") {
      if (!loadedTabs[activeSection]) {
        fetchData(activeSection, "cluster");
      }
    } else {
    if (!loadedTabs[activeSection]?.[currentTab]) {
      fetchData(activeSection, currentTab);
    }
    }
  }, [activeSection, activeRiskTab, activeShortageTab]);


  useEffect(() => {
    // Only trigger for completed tab (transport, tts, and clusterMaster use selectedDate instead)
    if (activeSection === "riskAnalysis" && activeRiskTab === "completed") {
      fetchData("riskAnalysis", activeRiskTab);
    }
  }, [selectedTimeFilter, dateRangeFilter]);

  // Trigger fetch when BU, zone, or plant filters change for completed, transport, and tts tabs only (not mergedTable)
  useEffect(() => {
    if (activeSection === "riskAnalysis" && (activeRiskTab === "completed" || activeRiskTab === "transport" || activeRiskTab === "tts")) {
      // Only fetch if tab is already loaded (to avoid duplicate calls on initial load)
      if (loadedTabs[activeSection]?.[activeRiskTab]) {
        setCurrentPage(0); // Reset to first page when filters change
        fetchData(activeSection, activeRiskTab);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBu, selectedZone, selectedPlant]);

  // Trigger fetch when BU, zone, or plant filters change for Shortage-VTS Combined (mergedTable) tab only
  useEffect(() => {
    if (activeSection === "shortageAnalysis" && activeShortageTab === "mergedTable") {
      if (loadedTabs.shortageAnalysis?.mergedTable) {
        setCurrentPage(0);
        fetchData("shortageAnalysis", "mergedTable");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedTableSelectedBu, mergedTableSelectedZone, mergedTableSelectedPlant]);

  // Trigger fetch when location type filter changes for cluster_master, transport, and tts
  useEffect(() => {
    if (activeSection === "clusterMaster") {
      // Only fetch if tab is already loaded (to avoid duplicate calls on initial load)
      if (loadedTabs[activeSection]) {
        setCurrentPage(0); // Reset to first page when filters change
        fetchData(activeSection, "cluster");
      }
    } else if (activeSection === "riskAnalysis") {
      // For transport and tts tabs, trigger fetch when location type changes
      if (loadedTabs.riskAnalysis) {
        if (activeRiskTab === "transport" && loadedTabs.riskAnalysis.transport) {
          setCurrentPage(0);
          fetchData("riskAnalysis", "transport");
        } else if (activeRiskTab === "tts" && loadedTabs.riskAnalysis.tts) {
          setCurrentPage(0);
          fetchData("riskAnalysis", "tts");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationType]);

  // Trigger fetch when date filter changes for cluster_master, transport, and tts (single-date picker)
  useEffect(() => {
    if (activeSection === "clusterMaster") {
      // Only fetch if tab is already loaded (to avoid duplicate calls on initial load)
      if (loadedTabs[activeSection]) {
        setCurrentPage(0); // Reset to first page when filters change
        fetchData(activeSection, "cluster");
      }
    } else if (activeSection === "riskAnalysis") {
      // For transport and tts tabs, trigger fetch when date changes
      if (loadedTabs.riskAnalysis) {
        if (activeRiskTab === "transport" && loadedTabs.riskAnalysis.transport) {
          setCurrentPage(0);
          fetchData("riskAnalysis", "transport");
        } else if (activeRiskTab === "tts" && loadedTabs.riskAnalysis.tts) {
          setCurrentPage(0);
          fetchData("riskAnalysis", "tts");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Shortage-VTS Combined: preset / custom range only (mergedTableTimeFilter)
  useEffect(() => {
    if (activeSection === "shortageAnalysis" && activeShortageTab === "mergedTable") {
      if (loadedTabs.shortageAnalysis?.mergedTable) {
        setCurrentPage(0);
        fetchData("shortageAnalysis", "mergedTable");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedTableTimeFilter, mergedTableDateRangeFilter]);

  // Trigger fetch when sort column or direction changes
  useEffect(() => {
    const currentTab = activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeSection === "shortageAnalysis"
        ? activeShortageTab
        : "cluster";
   
    // Only fetch if tab is already loaded (to avoid duplicate calls on initial load)
    if (activeSection === "clusterMaster") {
      if (loadedTabs[activeSection]) {
        fetchData(activeSection, "cluster");
      }
    } else {
    if (loadedTabs[activeSection]?.[currentTab]) {
      fetchData(activeSection, currentTab);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortColumn, sortDirection]);

  // Trigger fetch when column filters change for completed, transport, and tts tabs
  useEffect(() => {
    if (activeSection === "riskAnalysis" && (activeRiskTab === "completed" || activeRiskTab === "transport" || activeRiskTab === "tts")) {
      // Only trigger if tab is already loaded (to avoid duplicate calls on initial load)
      if (loadedTabs[activeSection]?.[activeRiskTab]) {
        // Debounce column filter changes
        const timeoutId = setTimeout(() => {
          setCurrentPage(0); // Reset to first page when filtering
          fetchData("riskAnalysis", activeRiskTab);
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters]);

  useEffect(() => {
    setCurrentPage(0);
    setSortColumn(null);
    setSortDirection("asc");
    setColumnFilters({});
    setHeaderSearchTexts({});
    setOpenFilterColumn(null);
    setActiveFilterColumn(null);
    // setTotalRecords(0);
  }, [activeSection, activeRiskTab, activeShortageTab]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target;
      if (!target.closest('.filter-dropdown') && !target.closest('.filter-icon')) {
        setActiveFilterColumn(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Download function for modal data
  const downloadModalData = async (tableName: string, clickedField: string, clickedValue: string, fileName: string) => {
    try {
      const dateVal = schedulerDate || selectedDate || new Date().toISOString().split("T")[0];
      const isCompletedTrips = tableName === "completed_trips_risk_score";
      const payload: any = {
        action: "risk_score",
        payload: {
          table_name: tableName,
          [clickedField]: clickedValue,
          download: "true",
        },
        filters: [],
        cross_filters: []
      };

      if (tableName === "tt_risk_score" || tableName === "transporter_risk_score") {
        payload.payload.version_date = dateVal;
      }

      if (
        tableName === "cluster_master" ||
        tableName === "transporter_risk_score" ||
        tableName === "tt_risk_score"
      ) {
        payload.filters.push({ key: "location_type", cond: "equals", value: selectedLocationType });
      }

      if (isCompletedTrips) {
        const locationTypeValue = selectedBu === "LPG" ? "LPG" : "SOD";
        payload.filters.push({ key: "location_type", cond: "equals", value: locationTypeValue });
      }

      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        responseType: "blob",
        timeout: RISK_SCORE_DOWNLOAD_TIMEOUT_MS,
      });

      const blob = new Blob([response.data], {
        type: isCompletedTrips ? RISK_SCORE_CSV_BLOB_TYPE : XLSX_BLOB_TYPE,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      const date = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `${fileName}_${date}.${isCompletedTrips ? "csv" : "xlsx"}`);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const downloadData = async (section, tab) => {
    const downloadKey = `${section}-${tab}`;
    setIsDownloading(downloadKey);
    try {
      const getDateRangeString = (filter, customRange) => {
        const now = new Date();
        const fmt = (d) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (customRange && customRange.start && customRange.end) {
          return `${fmt(customRange.start)},${fmt(customRange.end)}`;
        }
        const presets = { TDY: 0, YDY: 1, "1W": 7, "15D": 15, "1M": 30, "3M": 90 };
        const s = new Date(now);
        const filterKey = filter != null ? String(filter).toUpperCase() : "";
        s.setDate(s.getDate() - (presets[filterKey] ?? presets[filter] ?? 0));
        if (filterKey === "YDY") return `${fmt(s)},${fmt(s)}`;
        return `${fmt(s)},${fmt(now)}`;
      };

      let tableName;
      if (section === "clusterMaster") {
        tableName = tableNameMap[section];
      } else {
        tableName = tableNameMap[section][tab];
      }
      if (!tableName) {
        setIsDownloading(null);
        return;
      }

      let columns;

      if (tab === "completed") {
        columns = [
          "trip_name",
          "trip_id",
          "invoice_no",
          "invoice_date",
          "tt_number",
          "risk_score",
          "combinational_alert_count",
          "dr",
          "pd",
          "rd",
          "st",
          "ht",
          "ha",
          "hb",
          "nd",
          "sv",
          "scheduled_trip_start_datetime",
          "scheduled_trip_end_datetime",
          "transporter_code",
          "route_no",
          "zone",
          "location_name"
        ];
      }

      if (tab === "mergedTable") {
        columns = MERGED_SHORTAGE_VTS_COLUMNS;
      }

      if (tab === "tt_violation_summary") {
        columns = ["tt_number",
          "trips",
          "total_shortage_l",
          "avg_shortage_l",
          "vts_matched",
          "total_rd",
          "total_st_v",
          "total_dr",
          "total_pd",
          "total_sp_v",
          "total_cd",
          "total_nd"]
      }

      let payload: any;

      if (section === "clusterMaster") {
        const dateVal = schedulerDate || selectedDate || new Date().toISOString().split("T")[0];
        payload = {
          action: "risk_score",
          filters: [
            { key: "location_type", cond: "equals", value: selectedLocationType }
          ],
          cross_filters: [{ key: "DATE", cond: "equals", value: `${dateVal},${dateVal}` }],
          drill_state: "",
          payload: {
            table_name: "cluster_master",
            download: "true"
          }
        };
      } else {
        payload = {
          action: "risk_score",
          payload: {
            table_name: tableName,
            columns: columns || [],
            download: "true",
          },
          cross_filters: []
        };

        // Only for Transporter Risk Score and TTs Risk Score: pass version_date = date from date filter (selectedDate), then schedulerDate, then today
        if (tableName === "tt_risk_score" || tableName === "transporter_risk_score") {
          const versionDateForPayload = selectedDate || schedulerDate || new Date().toISOString().split("T")[0];
          payload.payload.version_date = versionDateForPayload;
          payload.filters = [
            { key: "location_type", cond: "equals", value: selectedLocationType }
          ];
        }

        if (tab === "completed") {
          const dateFilterString = getDateRangeString(selectedTimeFilter, dateRangeFilter);
          payload.cross_filters.push({
            key: "DATE",
            cond: "equals",
            value: dateFilterString
          });

          const completedFilters: Array<{ key: string; cond: string; value: string }> = [];
          const locationTypeValue = selectedBu === "LPG" ? "LPG" : "SOD";
          completedFilters.push({ key: "location_type", cond: "equals", value: locationTypeValue });
          if (selectedZone && selectedZone !== "all") {
            completedFilters.push({ key: "zone_name", cond: "equals", value: selectedZone });
          }
          if (selectedPlant && selectedPlant !== "all") {
            completedFilters.push({ key: "location", cond: "equals", value: String(selectedPlant) });
          }
          payload.filters = completedFilters;
        }

        if (tab === "mergedTable" && section === "shortageAnalysis") {
          const dateFilterString = getDateRangeString(mergedTableTimeFilter, mergedTableDateRangeFilter);
          payload.cross_filters.push({
            key: "DATE",
            cond: "equals",
            value: dateFilterString,
          });
          const mf: Array<{ key: string; cond: string; value: string }> = [];
          if (mergedTableSelectedBu) {
            mf.push({ key: "sbu_nm", cond: "equals", value: mergedTableSelectedBu });
          }
          if (!ignoreMergedTableLocationFilters) {
            if (mergedTableSelectedZone && mergedTableSelectedZone !== "all") {
              mf.push({ key: "zone_nm", cond: "equals", value: String(mergedTableSelectedZone) });
            }
            if (mergedTableSelectedPlant && mergedTableSelectedPlant !== "all") {
              mf.push({ key: "sap_id", cond: "equals", value: String(mergedTableSelectedPlant) });
            }
          }
          payload.filters = mf;
        }
      }

      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        responseType: "blob",
        timeout: RISK_SCORE_DOWNLOAD_TIMEOUT_MS,
      });

      const tabFileNames: any = {
        completed: "Completed_Trips_Risk_Score",
        transport: "Transporter_Risk_Score",
        tts: "TTs_Risk_Score",
        cluster: "Cluster_Master",
        afterDR: "TT_After_DR",
        mergedTable: "Shortage_VTS_Combined_Summary",
        ttViolation: "TT_Violation_Summary",
        customerV: "Customer_Violation_Summary",
        routeTT: "Route_TT_Violation_Summary",
        srcDest: "Location_Destination_Consistency",
        customerSummary: "Customer_Summary"
      };

      const isCompletedTripsTab = tab === "completed";
      const blob = new Blob([response.data], {
        type: isCompletedTripsTab ? RISK_SCORE_CSV_BLOB_TYPE : XLSX_BLOB_TYPE,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      const baseName = tabFileNames[tab];
      // For Transporter Risk Score and TTs Risk Score tabs, include version date (date filter) in filename; otherwise use today's date
      const isTransportOrTtsTab = section === "riskAnalysis" && (tab === "transport" || tab === "tts");
      const fileDate = isTransportOrTtsTab ? (selectedDate || schedulerDate || new Date().toISOString().split("T")[0]) : new Date().toISOString().split("T")[0];

      link.href = url;
      link.setAttribute(
        "download",
        `${baseName}_${fileDate}.${isCompletedTripsTab ? "csv" : "xlsx"}`
      );

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Set success state
      setIsDownloading(null);
      setDownloadSuccess(downloadKey);
     
      // Clear success state after animation completes (2 seconds - allows time to see the nice animation)
      setTimeout(() => {
        setDownloadSuccess(null);
      }, 2000);

    } catch (err) {
      console.error("Download failed:", err);
      setIsDownloading(null);
    }
  };

  // Download helper for Cluster Master "Cluster Event" option
  const downloadClusterEvent = async () => {
    const downloadKey = "clusterMaster-clusterEvent";
    setIsDownloading(downloadKey);
    try {
      const date = selectedDate || new Date().toISOString().split("T")[0];

      const payload = {
        action: "risk_score",
        payload: {
          table_name: "clusterwise_event",
          download: "true"
        },
        filters: [
          { key: "location_type", cond: "equals", value: selectedLocationType }
        ],
        cross_filters: [
          {
            key: "DATE",
            cond: "equals",
            value: `${date},${date}`
          }
        ]
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        responseType: "blob",
        timeout: RISK_SCORE_DOWNLOAD_TIMEOUT_MS,
      });

      const blob = new Blob([response.data], { type: XLSX_BLOB_TYPE });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      const safeDate = date || new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `Cluster_Events_${safeDate}.xlsx`);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setIsDownloading(null);
      setDownloadSuccess(downloadKey);
      setTimeout(() => {
        setDownloadSuccess(null);
      }, 2000);
    } catch (err) {
      console.error("Cluster Event download failed:", err);
      setIsDownloading(null);
    }
  };

  const handleTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
    // Check if filter is a date range object
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      // This is a custom date range filter
      const dateRange = filter.value.split(',');
      if (dateRange.length === 2) {
        setDateRangeFilter({
          start: new Date(dateRange[0]),
          end: new Date(dateRange[1])
        });
        setSelectedTimeFilter(null); // Clear time filter when custom date is selected
      }
    } else {
      // This is a standard time filter
      setSelectedTimeFilter(filter as string | null);
      setDateRangeFilter(null); // Clear date range when time filter is selected
    }
  };

  const handleMergedTableTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
    if (filter && typeof filter === "object" && "key" in filter && "value" in filter) {
      const dateRange = filter.value.split(",");
      if (dateRange.length === 2) {
        setMergedTableDateRangeFilter({
          start: new Date(dateRange[0]),
          end: new Date(dateRange[1]),
        });
        setMergedTableTimeFilter(null);
      }
    } else {
      setMergedTableTimeFilter(filter as string | null);
      setMergedTableDateRangeFilter(null);
    }
  };

  const handlePlantChange = (plant) => {
    setLocationFilter(prev => ({
      ...prev,
      plant
    }));
    setCurrentPage(0);
  };

  const handleLocationChange = (locationId, zone) => {
    setLocationFilter((prev) => ({
      ...prev,
      plant: locationId,
      zone: zone || prev.zone,
    }));
  };

  // Handlers for ReusableFilterBar (for completed, transport, and tts tabs)
  const handleZoneChange = (zone: string | null) => {
    setSelectedZone(zone);
    setCurrentPage(0);
  };

  const handlePlantChangeForFilter = (plant: string | null, zone?: string | null) => {
    setSelectedPlant(plant);
    if (zone !== undefined) {
      setSelectedZone(zone);
    }
    setCurrentPage(0);
  };

  const handleTimeFilterChangeForFilter = (filter: string | null | { key: string; cond: string; value: string }) => {
    handleTimeFilterChange(filter);
  };

  const handleRefreshForFilter = () => {
    setSelectedBu(defaultSessionFilterBu(userBu));
    setSelectedZone(null);
    setSelectedPlant(null);
    setSelectedTimeFilter("15D");
    setDateRangeFilter(null);
    setRefreshKey((prev) => prev + 1);
  };

  const handleRefresh = () => {
    const defaultFilterBu = defaultSessionFilterBu(userBu);
    setSelectedBu(defaultFilterBu);
    setSelectedZone(null);
    setSelectedPlant(null);
    // Reset Shortage-VTS Combined (mergedTable) filters
    setMergedTableSelectedBu(defaultFilterBu);
    setMergedTableSelectedZone(null);
    setMergedTableSelectedPlant(null);
    setMergedTableTimeFilter("15D");
    setMergedTableDateRangeFilter(null);
    // After refresh, ignore any default zone/plant that ZonePlantSelections might push on first mount
    setIgnoreMergedTableLocationFilters(true);
    setSelectedLocationType(locationTypeOptions[0]?.value ?? "SOD");
    // Exit multi-select mode on refresh
    setIsMultiSelectMode(false);
    setSelectedRows([]);
    setSelectedTimeFilter("1M");
    setDateRangeFilter(null);
    setRefreshKey((prev) => prev + 1);
    setSearchTerms({
      riskAnalysis: { completed: "", transport: "", tts: "", afterDR: "", location: "" },
      shortageAnalysis: { ttViolation: "", customerV: "", routeTT: "", srcDest: "", mergedTable: "", customerSummary: "" },
      clusterMaster: ""
    });
    setSearchInputValues({
      riskAnalysis: { completed: "", transport: "", tts: "", afterDR: "", location: "" },
      shortageAnalysis: { ttViolation: "", customerV: "", routeTT: "", srcDest: "", mergedTable: "", customerSummary: "" },
      clusterMaster: ""
    });
    setSortColumn(null);
    setSortDirection("asc");
    setColumnFilters({});
    setHeaderSearchTexts({});
    setOpenFilterColumn(null);
    setActiveFilterColumn(null);
    setLocationFilter({ zone: null, plant: null });
    // Clear filters only for current tab
    const tabKey = getCurrentTabKey();
    setRiskScoreRangeFilter(prev => ({
      ...prev,
      [tabKey]: { operator: '>=', value: 5 }
    }));
    setRiskScoreRangeFilterInput(prev => ({
      ...prev,
      [tabKey]: { operator: '>=', value: null }
    }));
    setRangeFiltersState(prev => ({
      ...prev,
      [tabKey]: getDefaultColumnFilter()
    }));
    setRangeFiltersInputState(prev => ({
      ...prev,
      [tabKey]: getDefaultColumnInputFilter()
    }));
    // setTotalRecords(0);

    setLoadedTabs({
      riskAnalysis: { completed: false, transport: false, tts: false, afterDR: false, location: false },
      shortageAnalysis: { ttViolation: false, customerV: false, routeTT: false, srcDest: false, mergedTable: false, customerSummary: false },
      clusterMaster: false
    });
    // Ensure next fetch is not blocked by the last dedupe key
    lastRiskFetchKeyRef.current = null;

    const currentTab = activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeSection === "shortageAnalysis"
        ? activeShortageTab
        : "cluster";
    fetchData(activeSection, currentTab).finally(() => {
      // Once a fresh fetch after refresh is done, re-enable mergedTable zone/plant filters
      setIgnoreMergedTableLocationFilters(false);
    });
  };

  const handleRiskScoreManualDownload = async () => {
    setIsDownloadingManual(true);
    try {
      const filePath = "novex/Risk_score/Risk_Score_Dashboard_User_Manual.pdf";
      const response = await apiClient.post(
        "/api/noticesvts/download_notice",
        { file_path: filePath },
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "Risk_Score_Dashboard_User_Manual.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success("User manual downloaded successfully.");
    } catch (error) {
      console.error("Error downloading Risk Score manual:", error);
      toast.error("Failed to download user manual. Please try again.");
    } finally {
      setIsDownloadingManual(false);
    }
  };

  // const handlePageChange = (page) => setCurrentPage(page);
const handlePageChange = (page) => {
  // Ensure page is within valid range
  const validPage = Math.max(0, Math.min(page, totalPages - 1));
  setCurrentPage(validPage);
};
  const handleItemsPerPageChange = (num) => {
    setItemsPerPage(num);
    setCurrentPage(0);
  };

  const handleCreateTicket = useCallback((rowData?: any, selectedRowsParam?: any[]) => {
    if (!canCreateTicket) {
      toast.error("You are not allowed to create tickets.");
      return;
    }
    // If no rowData provided, use selected rows from parameter or state
    const rowsToUse = rowData ? [rowData] : (selectedRowsParam || selectedRows);

    if (rowsToUse.length === 0) {
      toast.error('Please select at least one row to create a ticket');
      return;
    }

    // Check if multiple rows are selected
    const isMultipleRows = rowsToUse.length > 1;

    // Use the first row for basic ticket data
    const firstRow = rowsToUse[0];

    // Collect unique zones and locations from all selected rows
    // Handle different field names based on tabs (similar to VTS Live handling zone/zone_nm)
    const uniqueZones = [...new Set(rowsToUse.map(row => row.zone_name || row.zone_nm || row.zone).filter(Boolean))];
    const uniqueLocations = [...new Set(rowsToUse.map(row => row.location_name || row.destination || row.plant_nm).filter(Boolean))];

    // Collect sap_id values, filtering out location names and keeping only actual IDs
    // Handle cases where sap_id might be an array, string, or contain mixed values
    const rawSapIds = rowsToUse
      .map(row => {
        let sapIdValue = row.sap_id;

        // If sap_id is a string that looks like it contains multiple values, split it
        if (typeof sapIdValue === 'string' && sapIdValue.includes(',')) {
          sapIdValue = sapIdValue.split(',').map(s => s.trim());
        }

        return sapIdValue;
      })
      .filter(Boolean)
      .flat() // Flatten arrays of sap_ids
      .filter(id => {
        // Keep only values that look like actual IDs (numeric or short alphanumeric)
        // Filter out location names (typically longer strings with spaces or special chars)
        if (!id || typeof id !== 'string') return false;

        // Trim whitespace
        const trimmedId = id.trim();

        // If it contains spaces or common location name patterns, likely a location name
        if (trimmedId.includes(' ') || trimmedId.includes('-') || trimmedId.toUpperCase().includes('TERMINAL') ||
            trimmedId.toUpperCase().includes('OIL') || trimmedId.toUpperCase().includes('DEPOT') ||
            trimmedId.toUpperCase().includes('PLANT') || trimmedId.length > 10) {
          return false;
        }

        // Keep numeric strings or short alphanumeric codes (4-10 digits typical for SAP IDs)
        return /^\d{4,10}$/.test(trimmedId) || /^[A-Z0-9]{1,10}$/.test(trimmedId);
      });

    const uniqueSapIds = [...new Set(rawSapIds)];

    // Determine zone value: single zone if all same, array of zones if different, empty if none
    let zoneValue: string | string[] = '';
    if (uniqueZones.length === 1) {
      zoneValue = uniqueZones[0];
    } else if (uniqueZones.length > 1) {
      zoneValue = uniqueZones;
    }

    // Determine location values: single location if all same, array of locations if different, empty if none
    let locationValue: string | string[] = '';
    let locationIdValue: string | string[] = '';
    if (uniqueLocations.length === 1) {
      locationValue = uniqueLocations[0];
      // Use sap_id as location_id if available, otherwise use the location name as ID
      locationIdValue = firstRow.sap_id || uniqueLocations[0];
    } else if (uniqueLocations.length > 1) {
      locationValue = uniqueLocations;
      // For multiple locations, collect sap_ids if available, otherwise use location names as IDs
      locationIdValue = [...new Set(rowsToUse.map(row => row.sap_id || (row.location_name || row.destination || row.plant_nm)).filter(Boolean))];
    }

    // Determine sap_id value: collect all unique sap_ids from selected rows
    let sapIdValue: string | string[] = '';
    if (uniqueSapIds.length === 1) {
      sapIdValue = uniqueSapIds[0];
    } else if (uniqueSapIds.length > 1) {
      sapIdValue = uniqueSapIds;
    }

    // Extract truck numbers from selected rows when vehicle number is present
    const truckNumbers = rowsToUse
      .map((row: any) => row.trucknumber || row.truck_number || row.truck_no || row.vehicle_number || row.vehicle_no || row.tt_number)
      .filter(Boolean);

    // Transform row data into ticket initial data
    const initialTicketData = {
      // Prefill zone/location: single value if same, array if different, empty if none
      zone: zoneValue,
      location_name: locationValue,
      location_id: locationIdValue,
      bu: isMultipleRows ? "" : (firstRow.bu || selectedBu || 'TAS'),
      region: isMultipleRows ? "" : (firstRow.region || firstRow.state_nm || ""),
      // sap_id should contain actual SAP IDs from all selected rows
      sap_id: sapIdValue,
      alert_section: 'VTS', // Set alert section to VTS for tickets created from Risk Score dashboard
      ticket_section: 'RiskScore', // Set ticket section to RiskScore for tickets created from Risk Score dashboard
      // Set up linked rows for all selected rows (pass full row data for display)
      linked_rows: rowsToUse,
      // Pass truck numbers when vehicle number is present
      truck_no: truckNumbers.length > 0 ? truckNumbers : [],
      // Leave summary and description empty for user to fill
      summary: "",
      description: "",
      // Hide linked alerts section when creating tickets from Risk Score dashboard
      hideLinkedAlerts: true,
    };

    setTicketInitialData(initialTicketData);
    setIsCreateTicketDialogOpen(true);
    setIsTicketFormMinimized(false);
  }, [selectedRows, selectedBu, canCreateTicket]);

  const handleTicketDialogClose = useCallback(() => {
    setIsCreateTicketDialogOpen(false);
    setIsTicketFormMinimized(false);
    setTicketInitialData(null);
    // Exit multi-select mode and clear selections when dialog closes
    setIsMultiSelectMode(false);
    setSelectedRows([]);
  }, []);

  const handleMinimize = useCallback(() => {
    setIsTicketFormMinimized(true);
  }, []);

  const handleRestore = useCallback(() => {
    setIsTicketFormMinimized(false);
  }, []);

  const handleMouseDown = (e, columnKey) => {
    e.preventDefault();
    const startX = e.pageX;
    // Default width for trip_name column - wider to accommodate 2-line text
    const defaultWidth = columnKey === 'trip_name' ? 140 : 100;
    const startWidth = columnWidths[columnKey] || defaultWidth;

    const handleMouseMove = (moveEvent) => {
      const diff = moveEvent.pageX - startX;
      const minWidth = columnKey === 'trip_name' ? 120 : 80;
      const newWidth = Math.max(minWidth, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getCurrentData = () => {
    let data: any[] = [];
    if (activeSection === "riskAnalysis") {
      data = riskAnalysisData[activeRiskTab] || [];
    } else if (activeSection === "shortageAnalysis") {
      data = shortageAnalysisData[activeShortageTab] || [];
    } else if (activeSection === "clusterMaster") {
      data = clusterMasterData || [];
    }

    // Apply violation filters (AND logic - all selected violations must have count > 0)
    if (selectedViolations.length > 0 && (activeSection === "riskAnalysis" && (activeRiskTab === "completed" || activeRiskTab === "transport" || activeRiskTab === "tts"))) {
      data = data.filter((row: any) => {
        return selectedViolations.every((violationKey: string) => {
          const value = row[violationKey];
          return value !== undefined && value !== null && Number(value) > 0;
        });
      });
    }

    return data;
  };

  const columnPermissions = {
    transporter_risk_score: {
      transporter_code: { filter: true },
      transporter_name: { filter: true },
      total_trips: { sort: true },
      risk_score: { sort: true },
      dr: { sort: true },
      pd: { sort: true },
      rd: { sort: true },
      st: { sort: true },
      sv: { sort: true },
      nd: { sort: true },
      ha: { sort: true },
      ht: { sort: true },
      hb: { sort: true },
    },

    tt_risk_score: {
      tt_number: { filter: true },
      transporter_code: { filter: true },
      transporter_name: { filter: true },
      total_trips: { sort: true },
      risk_score: { sort: true },
      dr: { sort: true },
      pd: { sort: true },
      rd: { sort: true },
      st: { sort: true },
      sv: { sort: true },
      nd: { sort: true },
      ha: { sort: true },
      ht: { sort: true },
      hb: { sort: true },
    },

    cluster_master: {
      cluster_type: { filter: true },
      risk_score: { sort: true },
      ZONE: { filter: true },
      events_30d: { sort: true },
      events_10d: { sort: true },
      events_5d: { sort: true },
      unique_trucks_30d: { sort: true },
      days_since_last: { sort: true },
      status: { filter: true },
    },

    completed_trips_risk_score: {
      trip_name: { filter: true },
      trip_id: { filter: true },
      invoice_no: { filter: true },
      invoice_date: { sort: true },
      tt_number: { filter: true },
      transporter_code: { filter: true },
      route_no: { filter: true },
      zone_name: { filter: true },
      location_name: { filter: true },
      risk_score: { sort: true },
      combinational_alert_count: { sort: true },
      dr: { sort: true },
      pd: { sort: true },
      rd: { sort: true },
      st: { sort: true },
      ht: { sort: true },
      ha: { sort: true },
      hb: { sort: true },
      nd: { sort: true },
      sv: { sort: true },
    },
  };

  const currentTableKey = activeSection === "clusterMaster"
    ? tableNameMap[activeSection]
    : tableNameMap[activeSection][
    activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeShortageTab
  ];

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleFilterChange = (column, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
    setCurrentPage(0);
  };

  // Trigger fetch when applied range filter changes (not input changes) - tab-specific
  useEffect(() => {
    const currentTab = activeSection === "riskAnalysis"
      ? activeRiskTab
      : activeSection === "shortageAnalysis"
        ? activeShortageTab
        : "cluster";
    const tabKey = `${activeSection}_${currentTab}`;

    if (activeSection === "clusterMaster") {
      if (loadedTabs[activeSection]) {
        fetchData(activeSection, "cluster");
      }
    } else {
      if (loadedTabs[activeSection]?.[currentTab]) {
        setCurrentPage(0);
        fetchData(activeSection, currentTab);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskScoreRangeFilter, rangeFiltersState, activeSection, activeRiskTab, activeShortageTab]);

  const handleClearFilter = (column) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
    setCurrentPage(0);
    setActiveFilterColumn(null);
  };

  const handleClearAllFilters = () => {
    const tabKey = getCurrentTabKey();
    setColumnFilters({});
    setHeaderSearchTexts({});
    setOpenFilterColumn(null);
    setCurrentPage(0);
    setActiveFilterColumn(null);
    setRiskScoreRangeFilter(prev => ({
      ...prev,
      [tabKey]: { operator: '>=', value: 5 }
    }));
    setRiskScoreRangeFilterInput(prev => ({
      ...prev,
      [tabKey]: { operator: '>=', value: null }
    }));
    setRangeFiltersState(prev => ({
      ...prev,
      [tabKey]: getDefaultColumnFilter()
    }));
    setRangeFiltersInputState(prev => ({
      ...prev,
      [tabKey]: getDefaultColumnInputFilter()
    }));
  };

  // Handle cluster_id click for cluster_master table
  const handleClusterIdClick = async (clusterId: string) => {
    if (!clusterId || activeSection !== "clusterMaster") {
      return;
    }

    setClickedClusterId(clusterId);
    setIsClusterModalOpen(true);
    setClusterDetailsLoading(true);
    setClusterDetailsError(null);
    setClusterDetailsData(null);

    try {
      const payload = {
        action: "risk_score",
        payload: {
          table_name: "cluster_master",
          clicked_cluster_id: clusterId
        },
        filters: [],
        cross_filters: []
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
     
      if (response.data) {
        setClusterDetailsData(response.data);
      } else {
        setClusterDetailsError("No data received from API");
      }
    } catch (error: any) {
      console.error("Error fetching cluster details:", error);
      setClusterDetailsError(error.response?.data?.message || error.message || "Failed to fetch cluster details");
    } finally {
      setClusterDetailsLoading(false);
    }
  };

  // Handle plant_name location names button click — opens floating dropdown anchored to the button
  const handlePlantLocationNamesClick = async (clusterId: string, anchorRect: DOMRect) => {
    if (!clusterId) return;

    // Toggle: close if already open for this cluster
    if (locationDropdown?.clusterId === clusterId) {
      setLocationDropdown(null);
      return;
    }

    setLocationDropdown({ clusterId, top: anchorRect.bottom + 4, bottom: anchorRect.top - 4, left: anchorRect.left, openUp: (window.innerHeight - anchorRect.bottom) < 260 });

    // If already fetched, no need to re-fetch
    if (locationNamesMap[clusterId]) return;

    setLocationNamesLoadingMap(prev => ({ ...prev, [clusterId]: true }));

    try {
      const payload = {
        action: "risk_score",
        payload: {
          table_name: "cluster_master",
          clicked_cluster_id: clusterId,
          location_name: true
        },
        filters: [],
        cross_filters: []
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);

      if (response.data?.data && Array.isArray(response.data.data)) {
        setLocationNamesMap(prev => ({ ...prev, [clusterId]: response.data.data }));
      } else {
        setLocationNamesMap(prev => ({ ...prev, [clusterId]: [] }));
      }
    } catch (error: any) {
      console.error("Error fetching location names:", error);
      setLocationNamesMap(prev => ({ ...prev, [clusterId]: [] }));
    } finally {
      setLocationNamesLoadingMap(prev => ({ ...prev, [clusterId]: false }));
    }
  };

  // Handle clicking a location name in the dropdown — opens slide sheet with event data
  const handleLocationNameClick = async (clusterId: string, locationName: string) => {
    setLocationDropdown(null);
    setLocationDetailClusterId(clusterId);
    setLocationDetailName(locationName);
    setIsLocationDetailOpen(true);
    setLocationDetailLoading(true);
    setLocationDetailError(null);
    setLocationDetailData(null);
    setLocationDetailSearch("");

    try {
      const payload = {
        action: "risk_score",
        payload: {
          table_name: "cluster_master",
          clicked_cluster_id: clusterId,
          location_name: locationName
        },
        filters: [],
        cross_filters: []
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);

      if (response.data) {
        setLocationDetailData(response.data);
      } else {
        setLocationDetailError("No data received");
      }
    } catch (error: any) {
      console.error("Error fetching location detail:", error);
      setLocationDetailError(error.response?.data?.message || error.message || "Failed to fetch location detail");
    } finally {
      setLocationDetailLoading(false);
    }
  };

  // Handle invoice_no click for completed_trips_risk_score table
  const handleInvoiceNoClick = async (invoiceNo: string) => {
    if (!invoiceNo || activeSection !== "riskAnalysis" || activeRiskTab !== "completed") {
      return;
    }

    setClickedInvoiceNo(invoiceNo);
    setIsInvoiceModalOpen(true);
    setInvoiceModalLoading(true);
    setInvoiceModalError(null);
    setInvoiceModalData(null);

    try {
      const payload = {
        action: "risk_score",
        payload: {
          table_name: "completed_trips_risk_score",
          clicked_invoice_no: invoiceNo
        },
        filters: [],
        cross_filters: []
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
     
      if (response.data) {
        setInvoiceModalData(response.data);
      } else {
        setInvoiceModalError("No data received from API");
      }
    } catch (error: any) {
      console.error("Error fetching invoice details:", error);
      setInvoiceModalError(error.response?.data?.message || error.message || "Failed to fetch invoice details");
    } finally {
      setInvoiceModalLoading(false);
    }
  };

  // Handle transporter_code click for transporter_risk_score table
  const handleTransporterCodeClick = async (transporterCode: string) => {
    if (!transporterCode || activeSection !== "riskAnalysis" || activeRiskTab !== "transport") {
      return;
    }

    setClickedTransporterCode(transporterCode);
    setIsTransporterModalOpen(true);
    setTransporterModalLoading(true);
    setTransporterModalError(null);
    setTransporterModalData(null);
    setTransporterLineChartData([]);
    setTransporterLineChartLoading(true);
    setTransporterLineChartError(null);

    // Call both APIs in parallel: one for table data, one for line chart
    const tablePayload = {
      action: "risk_score",
      payload: {
        table_name: "transporter_risk_score",
        clicked_transporter_code: transporterCode
      },
      filters: [],
      cross_filters: []
    };

    const lineChartPayload = {
      action: "risk_score_trends",
      payload: {
        table_name: "transporter_risk_score",
        clicked_transporter_code: transporterCode
      },
      filters: [],
      cross_filters: [],
      drill_state: ""
    };

    // Fetch table data
    apiClient.post("/api/charts/generate_vis_data", tablePayload)
      .then((response) => {
        if (response.data) {
          setTransporterModalData(response.data);
        } else {
          setTransporterModalError("No data received from API");
        }
      })
      .catch((error: any) => {
        console.error("Error fetching transporter details:", error);
        setTransporterModalError(error.response?.data?.message || error.message || "Failed to fetch transporter details");
      })
      .finally(() => {
        setTransporterModalLoading(false);
      });

    // Fetch line chart data
    apiClient.post("/api/charts/generate_vis_data", lineChartPayload)
      .then((response) => {
        if (response.data?.data) {
          setTransporterLineChartData(response.data.data);
        } else {
          setTransporterLineChartError("No chart data received");
        }
      })
      .catch((error: any) => {
        console.error("Error fetching transporter line chart data:", error);
        setTransporterLineChartError(error.response?.data?.message || error.message || "Failed to fetch line chart data");
      })
      .finally(() => {
        setTransporterLineChartLoading(false);
      });
  };

  // Handle tt_number click for tt_risk_score table
  const handleTtNumberClick = async (ttNumber: string) => {
    if (!ttNumber || activeSection !== "riskAnalysis" || activeRiskTab !== "tts") {
      return;
    }

    setClickedTtNumber(ttNumber);
    setIsTtModalOpen(true);
    setTtModalLoading(true);
    setTtModalError(null);
    setTtModalData(null);
    setTtLineChartData([]);
    setTtLineChartLoading(true);
    setTtLineChartError(null);

    // Call both APIs in parallel: one for table data, one for line chart
    const tablePayload = {
      action: "risk_score",
      payload: {
        table_name: "tt_risk_score",
        clicked_tt_number: ttNumber
      },
      filters: [],
      cross_filters: []
    };

    const lineChartPayload = {
      action: "risk_score_trends",
      payload: {
        table_name: "tt_risk_score",
        clicked_tt_number: ttNumber
      },
      filters: [],
      cross_filters: [],
      drill_state: ""
    };

    // Fetch table data
    apiClient.post("/api/charts/generate_vis_data", tablePayload)
      .then((response) => {
        if (response.data) {
          setTtModalData(response.data);
        } else {
          setTtModalError("No data received from API");
        }
      })
      .catch((error: any) => {
        console.error("Error fetching TT details:", error);
        setTtModalError(error.response?.data?.message || error.message || "Failed to fetch TT details");
      })
      .finally(() => {
        setTtModalLoading(false);
      });

    // Fetch line chart data
    apiClient.post("/api/charts/generate_vis_data", lineChartPayload)
      .then((response) => {
        if (response.data?.data) {
          setTtLineChartData(response.data.data);
        } else {
          setTtLineChartError("No chart data received");
        }
      })
      .catch((error: any) => {
        console.error("Error fetching TT line chart data:", error);
        setTtLineChartError(error.response?.data?.message || error.message || "Failed to fetch line chart data");
      })
      .finally(() => {
        setTtLineChartLoading(false);
      });
  };

  const filteredData = getCurrentData().filter((row) => {
    const matchesColumnFilters = Object.entries(columnFilters).every(([column, filterValue]) => {
      if (!filterValue) return true;
      const columnValue = row[column];
      return String(columnValue).toLowerCase().includes(String(filterValue).toLowerCase());
    });

    return matchesColumnFilters;
  });

  const sortedData = sortColumn
    ? [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortDirection === "asc") {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    })
    : filteredData;

  // Use server-side total records for pagination instead of client-side filtered data length
  // const totalItems = totalRecords;
  // const totalPages = Math.ceil(totalItems / itemsPerPage);
  // // const startIndex = (currentPage - 1) * itemsPerPage;
  // // const endIndex = startIndex + itemsPerPage;
  // const startIndex = currentPage * itemsPerPage;
  // const endIndex = Math.min(startIndex + itemsPerPage, totalItems)
  // const currentTab = activeSection === "riskAnalysis" ? activeRiskTab : activeShortageTab;

  const currentTab = activeSection === "riskAnalysis"
    ? activeRiskTab
    : activeSection === "shortageAnalysis"
      ? activeShortageTab
      : "cluster";
  const totalItems = activeSection === "clusterMaster"
    ? totalRecords[activeSection] || 0
    : totalRecords[activeSection][currentTab] || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
const startIndex = currentPage * itemsPerPage;
const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  // API already returns paginated data, but we still apply client-side filtering/sorting on current page
  const paginatedData = sortedData.slice(0, itemsPerPage);

  const { tableWrapRef, retryMirrorScrollbar } = useAgGridMirrorScrollbar(
    [loading, totalItems, activeSection, activeRiskTab, activeShortageTab, currentPage, itemsPerPage],
    { attachToOuterWrap: activeSection === "clusterMaster" },
  );

  const renderTable = (data, tab, section) => {
    const tabKey = `${section}_${tab}`;
    const tabRiskScoreFilter = riskScoreRangeFilter[tabKey] || { operator: '>=', value: 5 };
    const tabRangeFilters = rangeFiltersState[tabKey] || {};

    const activeFiltersCount = Object.keys(columnFilters).filter(key => columnFilters[key]).length +
      (tabRiskScoreFilter.value && tabRiskScoreFilter.value !== 5 ? 1 : 0) +
      Object.values(tabRangeFilters).filter(filter => filter.value !== 0 && filter.value !== null).length;
    const currentSearchTerm = section === "clusterMaster"
      ? searchTerms[section] || ""
      : searchTerms[section]?.[tab] || "";
    const currentInputValue = section === "clusterMaster"
      ? searchInputValues[section] || ""
      : searchInputValues[section]?.[tab] || "";

    /** Cluster Master: fixed grid height — parent card is not in the same flex chain as Risk/Shortage; % height collapses rows */
    const isClusterMasterSection = section === "clusterMaster";

    // Get column keys - use data[0] if available, otherwise try to get from columnPermissions
    let columnKeys = [];
    if (data.length > 0) {
      columnKeys = Object.keys(data[0]);
    } else if (currentTableKey && columnPermissions[currentTableKey]) {
      // If no data, use column keys from permissions configuration
      columnKeys = Object.keys(columnPermissions[currentTableKey]);
    }

    // Shortage-VTS Combined tab (`mergedTable`) → `table_name` merged_shortage_vts — hide Region column
    const isMergedShortageVtsTable =
      section === "shortageAnalysis" &&
      tab === "mergedTable" &&
      tableNameMap.shortageAnalysis.mergedTable === "merged_shortage_vts";

    if (isMergedShortageVtsTable) {
      columnKeys = columnKeys.filter((k) => k?.toLowerCase?.() !== "region");
    }

    // Function to get custom display name for column headers (short names)
    const getColumnDisplayName = (columnKey) => {
      // merged_shortage_vts only: violation-style short headers (same letter codes as violationTypeTooltips keys)
      if (isMergedShortageVtsTable) {
        const mergedVtsShortHeaders: Record<string, string> = {
          route_deviation_count: "RD",
          speed_violation_count: "SV",
          main_supply_removal_count: "PD",
          device_tamper_count: "DR",
          stoppage_violations_count: "ST",
          night_driving_count: "ND",
          continuous_driving_count: "CD",
        };
        if (mergedVtsShortHeaders[columnKey]) return mergedVtsShortHeaders[columnKey];
      }
      const displayNameMap = {
        'scheduled_trip_start_datetime': 'Sch Start Time',
        'scheduled_trip_end_datetime': 'Sch End Time',
        'invoice_date': 'Invoice Date',
        'st': 'ST',
        'pd': 'PD',
        'dr': 'DR',
        'rd': 'RD',
        'transporter_code': 'Transporter',
        'combinational_alert_count': 'Combination Alerts Count',
        'ht': 'HT',
        'ha': 'HA',
        'hb': 'HB',
        'nd': 'ND',
        'sv': 'SV',
        'total_rd': 'RD',
        'total_st': 'ST',
        'total_dr': 'DR',
        'total_pd': 'PD',
        'total_sv': 'SV',
        'total_cd': 'CD',
        'total_nd': 'ND'
      };
      return displayNameMap[columnKey] || columnKey.replace(/_/g, " ");
    };

    // Function to get tooltip (full name) for column headers
    const getColumnTooltip = (columnKey) => {
      if (isMergedShortageVtsTable) {
        const mergedVtsTooltips: Record<string, string> = {
          route_deviation_count: violationTypeTooltips.RD,
          speed_violation_count: violationTypeTooltips.SV,
          main_supply_removal_count: violationTypeTooltips.PD,
          device_tamper_count: "Device Tamper",
          stoppage_violations_count: violationTypeTooltips.ST,
          night_driving_count: violationTypeTooltips.ND,
          continuous_driving_count: "Continuous Driving",
        };
        if (mergedVtsTooltips[columnKey]) return mergedVtsTooltips[columnKey];
      }
      const tooltipMap = {
        'st': 'Stoppage Violation',
        'pd': 'Power Disconnect',
        'dr': 'Device Removed',
        'rd': 'Route Deviation',
        'ht': 'Harsh Turn',
        'ha': 'Harsh Acceleration',
        'hb': 'Harsh Brake',
        'nd': 'Night Driving',
        'sv': 'Speed Violation',
        'total_rd': 'Route Deviation',
        'total_st': 'Stoppage Violation',
        'total_dr': 'Device Removed',
        'total_pd': 'Power Disconnect',
        'total_sv': 'Speed Violation',
        'total_cd': 'Continuous Driving',
        'total_nd': 'Night Driving',
        'combinational_alert_count': 'Combination Alerts count'
      };
      return tooltipMap[columnKey] || null;
    };

    // Get the defined column order for the current tab
    const getColumnOrder = (tab, section) => {
      if (tab === "completed" && section === "riskAnalysis") {
        return ["zone_name", "location_name", "trip_name", "trip_id", "invoice_no", "invoice_date", "tt_number", "risk_score", "combinational_alert_count", "dr", "pd", "rd", "st", "ht", "ha", "hb", "nd", "sv", "scheduled_trip_start_datetime", "scheduled_trip_end_datetime", "transporter_code", "route_no", ""];
      }
      if (tab === "transport" && section === "riskAnalysis") {
        return ["transporter_code", "transporter_name", "risk_score", "total_trips", "dr", "pd", "rd", "st", "sv", "nd", "ha", "ht", "hb", ""];
      }
      if (tab === "tts" && section === "riskAnalysis") {
        return ["tt_number", "transporter_code", "transporter_name", "risk_score", "total_trips", "dr", "pd", "rd", "st", "sv", "nd", "ha", "ht", "hb"];
      }
      if (tab === "afterDR" && section === "riskAnalysis") {
        return ["invoice_no", "tt_number", "load_no", "route_no", "location", "destination", "transporter_code", "transporter_name", "last_dr_time", "total_trips_after_last_dr", "total_violations_after_dr"];
      }
      if (tab === "location" && section === "riskAnalysis") {
        return ["sbu_nm", "location", "location_name", "total_trips", "total_alerts", "shortage_trips", "lrs", "zone", "risk_score", "device_removed", "power_disconnect", "route_deviation", "stoppage_violation", "total_violations_after_dr", "trips", "total_shortage_l", "avg_shortage_l", "vts_matched", "total_rd", "total_st", "total_dr", "total_pd", "total_sv", "total_cd", "total_nd", ""];
      }
      if (tab === "ttViolation" && section === "shortageAnalysis") {
        return ["tt_number", "trips", "total_shortage_l", "avg_shortage_l", "vts_matched", "total_rd", "total_st", "total_dr", "total_pd", "total_sv", "total_cd", "total_nd"];
      }
      if (tab === "customerV" && section === "shortageAnalysis") {
        return ["destination", "shortage_events", "avg_shortage_l", "unique_tts", "total_st", "total_dr", "total_sv", "total_cd", "total_nd"];
      }
      if (tab === "routeTT" && section === "shortageAnalysis") {
        return ["src_dest", "tt_number", "events", "total_shortage_l", "avg_shortage_l", "first_date", "last_date", "total_rd", "total_st", "total_dr", "total_pd", "total_sv", "total_cd", "total_nd"];
      }
      if (tab === "srcDest" && section === "shortageAnalysis") {
        return ["src_dest", "months_with_shortage", "total_shortage_l", "total_events"];
      }
      if (tab === "customerSummary" && section === "shortageAnalysis") {
        return ["destination", "shortage_events", "total_shortage_l", "avg_shortage_l", "unique_tts", "unique_transporters"];
      }
      if (tab === "mergedTable" && section === "shortageAnalysis") {
        return [...MERGED_SHORTAGE_VTS_COLUMNS];
      }
      if (tab === "cluster" && section === "clusterMaster") {
        return ["cluster_id", "cluster_type","plant_name", "risk_score", "risk_band", "centroid_lat_lon", "first_seen", "last_seen", "events_30d", "events_10d", "events_5d", "unique_trucks_30d", "status", "days_since_last"];
      }
      return null;
    };

    // Reorder columnKeys based on the defined column order
    const definedOrder = getColumnOrder(tab, section);
    if (definedOrder && columnKeys.length > 0) {
      // Create a new array with columns in the defined order, then append any extra columns not in the order
      const orderedKeys = definedOrder.filter(col => columnKeys.includes(col));
      const extraKeys = columnKeys.filter(col => !definedOrder.includes(col));
      columnKeys = [...orderedKeys, ...extraKeys];
    }

    // When any column has two-line header, increase header row height so top isn't cut off
    const hasAnyTwoLineHeader = columnKeys.some((key) => {
      if (key === "total_shortage_l" || key === "avg_shortage_l") return true;
      if (key === "vts_matched" && tab === "ttViolation" && section === "shortageAnalysis") return true;
      if (key === "combinational_alert_count" && tab === "completed" && section === "riskAnalysis") return true;
      if (key === "shortage_events" && tab === "customerV" && section === "shortageAnalysis") return true;
      return false;
    });

    // Action column is always visible for history access
   
    const handleSearchChange = (value) => {
      // Update input value immediately for UI responsiveness
      setSearchInputValues(prev => ({
        ...prev,
        [section]: section === "clusterMaster"
          ? value
          : {
              ...prev[section],
              [tab]: value
            }
      }));
    };

    const handleSearchSubmit = () => {
      // Update actual search term which triggers the API call
      setSearchTerms(prev => ({
        ...prev,
        [section]: section === "clusterMaster"
          ? currentInputValue
          : {
              ...prev[section],
              [tab]: currentInputValue
            }
      }));
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearchSubmit();
      }
    };

    const handleClearSearch = () => {
      setSearchInputValues(prev => ({
        ...prev,
        [section]: section === "clusterMaster"
          ? ""
          : {
              ...prev[section],
              [tab]: ""
            }
      }));

      setSearchTerms(prev => ({
        ...prev,
        [section]: section === "clusterMaster"
          ? ""
          : {
              ...prev[section],
              [tab]: ""
            }
      }));
    };

    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="mb-2 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search across all columns... (Press Enter)"
                value={currentInputValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSearchSubmit}
                className="w-full h-8 pl-10 pr-8 text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white hover:border-gray-400 transition-all shadow-sm"
              />
              {(currentInputValue || currentSearchTerm) && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Create Ticket Button - only HQO HSE LPG, HQO HSE SOD, HQO TICKETING */}
            {supportsMultiSelect() && canCreateTicket && (
              <div className="flex gap-2">
                {!isMultiSelectMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMultiSelectMode(true);
                      // Don't clear selectedRows - keep existing selections
                    }}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors shadow-sm whitespace-nowrap"
                  >
                    <Plus className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span>Create-Ticket</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedRows.length === 0) {
                          toast.error('Please select at least one risk score entry to create a ticket');
                          return;
                        }
                        handleCreateTicket(undefined, selectedRows);
                      }}
                      className={`inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors shadow-sm whitespace-nowrap ${
                        selectedRows.length > 0
                          ? "bg-green-600 hover:bg-green-700 text-white border border-green-600 focus:ring-green-500"
                          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500"
                      }`}
                    >
                      <Plus className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span>
                        {selectedRows.length === 0 ? (
                          "Create Ticket"
                        ) : (
                          `Create Ticket (+${selectedRows.length})`
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMultiSelectMode(false);
                        setSelectedRows([]);
                      }}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors shadow-sm whitespace-nowrap"
                    >
                      <span>Cancel</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Download Button */}
            <div className="relative">
              <button
                onClick={() => downloadData(section, tab)}
                disabled={isDownloading === `${section}-${tab}` || downloadSuccess === `${section}-${tab}`}
                className="relative p-1.5 rounded-md bg-green-700 hover:bg-green-800 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-green-600 transition-all duration-300 shadow-sm border border-green-800/50"
                aria-label="Download"
                title="Download"
              >
                {isDownloading === `${section}-${tab}` ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                ) : downloadSuccess === `${section}-${tab}` ? (
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
                      <div className="relative bg-green-500 rounded-full p-0.5 download-success-animation">
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Download className="w-4 h-4 text-white transition-colors" />
                )}
              </button>
            </div>

          </div>

          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap bg-blue-50 border border-blue-200 rounded-lg p-2">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Active Filters:</span>
              {Object.entries(columnFilters).map(([column, value]) => (
                value && (
                  <div
                    key={column}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border-2 border-blue-300 text-blue-700 rounded-md text-xs shadow-sm"
                  >
                    <span className="font-semibold">{column.replace(/_/g, ' ')}:</span>
                    <span className="font-medium">{String(value)}</span>
                    <button
                      onClick={() => handleClearFilter(column)}
                      className="ml-1 hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              ))}
              {tabRiskScoreFilter.value && tabRiskScoreFilter.value !== 5 && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border-2 border-blue-300 text-blue-700 rounded-md text-xs shadow-sm">
                  <span className="font-semibold">risk_score:</span>
                  <span className="font-medium">
                    {tabRiskScoreFilter.operator === '>=' ? '≥' : '≤'} {tabRiskScoreFilter.value}
                  </span>
                  <button
                    onClick={() => {
                      setRiskScoreRangeFilter(prev => ({
                        ...prev,
                        [tabKey]: { operator: '>=', value: 5 }
                      }));
                      setRiskScoreRangeFilterInput(prev => ({
                        ...prev,
                        [tabKey]: { operator: '>=', value: null }
                      }));
                      setCurrentPage(0);
                    }}
                    className="ml-1 hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {Object.entries(tabRangeFilters).map(([column, filter]) => (
                filter.value !== 0 && (
                  <div key={column} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border-2 border-blue-300 text-blue-700 rounded-md text-xs shadow-sm">
                    <span className="font-semibold">{column.replace(/_/g, ' ')}:</span>
                    <span className="font-medium">
                      {filter.operator === '>=' ? '≥' : '≤'} {filter.value}
                    </span>
                    <button
                      onClick={() => {
                        setRangeFiltersState(prev => ({
                          ...prev,
                          [tabKey]: {
                            ...prev[tabKey],
                            [column]: { operator: '>=', value: 0, open: false }
                          }
                        }));
                        setRangeFiltersInputState(prev => ({
                          ...prev,
                          [tabKey]: {
                            ...prev[tabKey],
                            [column]: { operator: '>=', value: null, open: false }
                          }
                        }));
                        setCurrentPage(0);
                      }}
                      className="ml-1 hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              ))}
              <button
                onClick={handleClearAllFilters}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold px-2 py-1 bg-white border-2 border-blue-300 rounded-md hover:bg-blue-100 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* AG Grid Table */}
        <style>{`${AG_GRID_MIRROR_SCROLL_CSS}
          .ag-grid-mirror-h-scroll-wrap.risk-score-cluster-master-scroll .ag-root-wrapper-body {
            padding-bottom: 16px;
          }
          .ag-theme-alpine .ag-root-wrapper {
            scrollbar-gutter: stable;
          }
          /* Horizontal scroll on center viewport only — overflow-x on .ag-body-viewport breaks row rendering (e.g. cluster master) */
          .ag-theme-alpine .ag-body-viewport.ag-layout-normal {
            overflow-x: hidden !important;
            overflow-y: auto !important;
            box-sizing: border-box !important;
          }
          .ag-theme-alpine .ag-center-cols-viewport {
            overflow-x: auto !important;
            overflow-y: hidden !important;
          }
          .ag-theme-alpine .ag-center-cols-viewport,
          .ag-theme-alpine .ag-body-horizontal-scroll-viewport {
            -ms-overflow-style: auto !important;
            scrollbar-width: thin !important;
            scrollbar-color: #94a3b8 #f1f5f9 !important;
          }
          .ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar,
          .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
            display: block !important;
            height: 10px !important;
          }
          .ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-track,
          .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
            background: #f1f5f9 !important;
          }
          .ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-thumb,
          .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
            background: #94a3b8 !important;
            border-radius: 6px !important;
          }
          .ag-theme-alpine .ag-body-vertical-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
            opacity: 1 !important;
            visibility: visible !important;
          }
          /* Always-on H-scroll track (all tabs): thin, no heavy gray strip */
          .ag-theme-alpine .ag-body-horizontal-scroll {
            min-height: 12px;
            flex-shrink: 0;
            background: transparent;
            border-top: 1px solid #e2e8f0;
          }
          .ag-theme-alpine .ag-body-horizontal-scroll .ag-body-horizontal-scroll-viewport {
            min-height: 10px;
            background: transparent;
          }
          .ag-theme-alpine .ag-header {
            background: #f3f4f6 !important;
          }
          .ag-theme-alpine .ag-header-cell {
            background: transparent !important;
            color: #000000 !important;
            font-weight: bold !important;
            font-size: 12px !important;
            text-transform: uppercase !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
            overflow: visible !important;
          }
          .ag-theme-alpine .ag-header-cell .ag-header-cell-comp-wrapper {
            overflow: visible !important;
          }
          .ag-theme-alpine .ag-header-cell-text {
            font-weight: bold !important;
            color: #000000 !important;
            white-space: nowrap !important;
            overflow: visible !important;
            text-overflow: unset !important;
          }
          .ag-theme-alpine .ag-header-cell-label {
            font-weight: bold !important;
          }
          .ag-theme-alpine .ag-header-cell-comp-wrapper {
            width: 100% !important;
          }
          .ag-theme-alpine .ag-header-cell-combination {
            min-width: 0 !important;
          }
          .ag-theme-alpine .ag-row {
            min-height: 32px !important;
            height: 32px !important;
            max-height: 32px !important;
          }
          .ag-theme-alpine .ag-row:hover {
            background-color: #eff6ff !important;
          }
          .ag-theme-alpine .ag-cell {
            font-size: 12px !important;
            padding: 2px 5px !important;
            line-height: 1.2 !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            text-overflow: ellipsis !important;
            max-height: 32px !important;
            box-sizing: border-box !important;
          }
          .ag-theme-alpine .ag-cell-wrapper {
            overflow: hidden !important;
            max-height: 100% !important;
          }
          .ag-theme-alpine .ag-row-selected {
            background-color: transparent !important;
          }
          .ag-theme-alpine .ag-row-selected::before {
            background-color: transparent !important;
          }
          .ag-theme-alpine .ag-row-selected .ag-cell {
            background-color: transparent !important;
          }
        `}</style>
        <div
          ref={tableWrapRef}
          className={`ag-grid-mirror-h-scroll-wrap border border-gray-200 rounded-xl shadow-md bg-white min-w-0 relative ${
            isClusterMasterSection
              ? "risk-score-cluster-master-scroll overflow-x-hidden overflow-y-visible"
              : "overflow-hidden flex flex-col flex-1 min-h-0"
          }`}
        >
          <div
            className={`ag-theme-alpine w-full min-w-0 ${isClusterMasterSection ? "" : "flex-1 min-h-0"}`}
            style={
              isClusterMasterSection
                ? { height: "500px", minHeight: "500px", width: "100%", flexShrink: 0 }
                : { minHeight: 0, width: "100%", height: "100%" }
            }
          >
            <AgGridReact
              key={`risk-grid-${section}-${tab}`}
              ref={gridRef}
              rowData={paginatedData}
              rowHeight={32}
              getRowHeight={() => 32}
              headerHeight={hasAnyTwoLineHeader ? 56 : 48}
              columnDefs={[
                // Add checkbox column when in multi-select mode
                ...(isMultiSelectMode && supportsMultiSelect() ? [{
                  headerCheckboxSelection: true,
                  checkboxSelection: true,
                  headerName: '',
                  width: 50,
                  minWidth: 50,
                  maxWidth: 50,
                  pinned: 'left' as const,
                  lockPosition: true,
                  suppressMenu: true,
                  sortable: false,
                  resizable: false,
                }] : []),
                ...columnKeys.map((key) => {
                const isRiskScore = key.toLowerCase().includes('risk') && key.toLowerCase().includes('score');
                const isClusterIdClickable = key === 'cluster_id' && activeSection === "clusterMaster";
                const isCentroidClickable = key === 'centroid_lat_lon' && activeSection === "clusterMaster";
                const isTransporterCodeClickable = key === 'transporter_code' && activeSection === "riskAnalysis" && (activeRiskTab === "transport" || activeRiskTab === "completed");
                const isTtNumberClickable = key === 'tt_number' && activeSection === "riskAnalysis" && (activeRiskTab === "tts" || activeRiskTab === "completed");
                const isCombinationalAlert = key === 'combinational_alert_count' && activeSection === "riskAnalysis" && activeRiskTab === "completed";
                const isPlantNameCol = key === 'plant_name' && activeSection === "clusterMaster";

                // Column width: always fit full header name on single line (no "..."); same on refresh
                let headerName = getColumnDisplayName(key);
                // Two-line headers: Total/Average Shortage L in all tabs; VTS Matched in TT Violation; Combination Alerts Count in Completed
                if (key === "total_shortage_l") headerName = "Total\nShortage L";
                else if (key === "avg_shortage_l") headerName = "Average\nShortage L";
                else if (key === "vts_matched" && tab === "ttViolation" && section === "shortageAnalysis") headerName = "VTS\nMatched";
                else if (key === "combinational_alert_count" && tab === "completed" && section === "riskAnalysis") headerName = "Combination\nAlerts Count";
                else if (key === "shortage_events" && tab === "customerV" && section === "shortageAnalysis") headerName = "Shortage\nEvents";
                const headerTooltipText = getColumnTooltip(key);
                // ~10px per char for 12px bold uppercase + 62px for filter/sort icons and padding
                const calculatedMinWidth = Math.max(headerName.replace(/\n/g, " ").length * 10 + 62, 100);
                const isCombinationalAlertCol = key === 'combinational_alert_count';
                const combColMinWidth = 150;
                const combColWidth = 170;
                const isMergedTableTab = section === 'shortageAnalysis' && tab === 'mergedTable';
                const mergedTableColMinWidth = 130;
                const mergedTableColWidth = 150;
                // TT Violation: narrower width for Total/Average Shortage L and VTS Matched (two-line headers)
                const isTtViolationShortageCol = tab === 'ttViolation' && section === 'shortageAnalysis' && (key === 'total_shortage_l' || key === 'avg_shortage_l' || key === 'vts_matched');
                // Route TT Violation: narrower width for Total/Average Shortage L only (two-line headers)
                const isRouteTTShortageCol = tab === 'routeTT' && section === 'shortageAnalysis' && (key === 'total_shortage_l' || key === 'avg_shortage_l');
                // Customer Violation: uniform flex columns except green-badge total_* cols (narrow)
                const isCustomerViolationTab = tab === 'customerV' && section === 'shortageAnalysis';
                const customerVUniformMinWidth = 100;
                // Location Risk Score: wider Location name column
                const isLocationRiskLocationNameCol = tab === 'location' && section === 'riskAnalysis' && key === 'location_name';
                const locationRiskLocationNameWidth = 260;
                const twoLineShortageColWidth = 125; // used for both TT Violation and Route TT Violation shortage cols
                /** DR/PD/RD/ST/SV/ND/HA/HT/HB green-badge cols on Completed, Transport, and TT Risk tabs */
                const isRiskAnalysisViolationBadgeCol =
                  section === "riskAnalysis" &&
                  (tab === "completed" || tab === "transport" || tab === "tts") &&
                  COMPLETED_GREEN_BADGE_COL_IDS.has(key);
                const isMergedGreenBadgeCol =
                  isMergedTableTab && MERGED_SHORTAGE_VTS_GREEN_BADGE_COL_IDS.has(key);
                const isRouteTtGreenBadgeCol =
                  tab === "routeTT" &&
                  section === "shortageAnalysis" &&
                  ROUTE_TT_GREEN_BADGE_COL_IDS.has(key);
                const isTtViolationGreenBadgeCol =
                  tab === "ttViolation" &&
                  section === "shortageAnalysis" &&
                  TT_VIOLATION_GREEN_BADGE_COL_IDS.has(key);
                const displayHeaderName = headerName;
                const fullHeaderForTooltip = headerTooltipText || headerName;
                /** All green-badge metric columns (risk + shortage tabs) — lower flex weight so text cols get more space on wide screens */
                const isGreenBadgeStyleCol =
                  isRiskAnalysisViolationBadgeCol ||
                  isMergedGreenBadgeCol ||
                  isRouteTtGreenBadgeCol ||
                  isTtViolationGreenBadgeCol;
                const isTtViolationFlexFillCol =
                  section === "shortageAnalysis" &&
                  tab === "ttViolation" &&
                  (key === "tt_number" || key === "total_nd");
                const isRouteTtNdFlexFillCol =
                  section === "shortageAnalysis" && tab === "routeTT" && key === "total_nd";
                // Min widths (unchanged); flex shares extra horizontal space on large viewports
                const colWidth = isPlantNameCol
                  ? 280
                  : isLocationRiskLocationNameCol
                  ? locationRiskLocationNameWidth
                  : (isTtViolationShortageCol || isRouteTTShortageCol)
                    ? twoLineShortageColWidth
                    : isTtViolationGreenBadgeCol
                      ? TT_VIOLATION_GREEN_BADGE_COL_WIDTH_PX
                      : isRouteTtGreenBadgeCol
                        ? GREEN_BADGE_VIOLATION_COL_WIDTH_PX
                        : isMergedGreenBadgeCol
                          ? GREEN_BADGE_VIOLATION_COL_WIDTH_PX
                          : isMergedTableTab
                            ? mergedTableColMinWidth
                            : isRiskAnalysisViolationBadgeCol
                              ? GREEN_BADGE_VIOLATION_COL_WIDTH_PX
                              : isCombinationalAlertCol
                                ? combColMinWidth
                                : key === "trip_name"
                                  ? 160
                                  : calculatedMinWidth;
                let colFlexNum = 1;
                if (isPlantNameCol) colFlexNum = 1.5;
                else if (isLocationRiskLocationNameCol) colFlexNum = 1.35;
                else if (isTtViolationFlexFillCol && key === "tt_number") colFlexNum = 2;
                else if (isTtViolationFlexFillCol && key === "total_nd") colFlexNum = 1.1;
                else if (isRouteTtNdFlexFillCol) colFlexNum = 1.1;
                else if (isGreenBadgeStyleCol) colFlexNum = 0.65;
                else if (isCombinationalAlertCol) colFlexNum = 1.1;

                return {
                  field: key,
                  headerName: displayHeaderName,
                  headerTooltip: fullHeaderForTooltip,
                  sortable: true,
                  resizable: true,
                  ...(isCustomerViolationTab
                    ? CUSTOMER_VIOLATION_GREEN_BADGE_COL_IDS.has(key)
                      ? {
                          minWidth: CUSTOMER_VIOLATION_GREEN_BADGE_COL_WIDTH_PX,
                          flex: 1,
                        }
                      : key === 'destination'
                        ? { minWidth: 120, flex: 2 }
                        : { minWidth: customerVUniformMinWidth, flex: 1 }
                    : {
                  minWidth: colWidth,
                        flex: colFlexNum,
                        maxWidth: undefined,
                      }),
                  cellRenderer: (params: any) => {
                    const val = params.value;
                   
                    // Format value function
                    const formatValue = (value: any, columnKey: string) => {
                      const integerColumns = ['events_30d', 'events_10d', 'events_5d', 'unique_trucks_30d', 'days_since_last'];
                      if (columnKey && integerColumns.includes(columnKey)) {
                        if (value === null || value === undefined) return '0';
                        const num = Number(value);
                        if (!isNaN(num)) return Math.floor(num).toString();
                        return String(value);
                      }

                      // Shortage-VTS Combined: show only YYYY-MM-DD for invoice_date
                      if (columnKey === 'invoice_date' && typeof value === 'string') {
                        return value.slice(0, 10);
                      }

                      // Special formatting for qty_shipped and qty_received in shortage analysis - 2 decimal places
                      if ((columnKey === 'qty_shipped' || columnKey === 'qty_received') && section === 'shortageAnalysis') {
                        if (value === null || value === undefined) return '0.00';
                        const num = Number(value);
                        if (!isNaN(num)) return num.toFixed(2);
                        return String(value);
                      }

                      if (tab === 'cluster') {
                        if (value === null || value === undefined) return '0';
                        const num = Number(value);
                        if (!isNaN(num)) {
                          if (num === Math.floor(num)) return num.toFixed(1);
                          return num.toString();
                        }
                        return String(value);
                      }

                      // Transporter/Transported display: ignore decimals (e.g. 28252747.0 -> 28252747)
                      if (
                        typeof columnKey === 'string' &&
                        (
                          columnKey.toLowerCase().includes('transporter') ||
                          columnKey.toLowerCase().includes('transported')
                        )
                      ) {
                        if (value === null || value === undefined) return '0';
                        const num = Number(value);
                        if (!isNaN(num)) return Math.trunc(num).toString();
                        return String(value).split('.')[0];
                      }
                     
                      if (value === null || value === undefined) return '0';
                      const num = Number(value);
                      if (!isNaN(num) && num !== Math.floor(num)) return num.toFixed(2);
                      return String(value);
                    };

                    // Risk score with badge
                    if (isRiskScore && val !== null && val !== undefined) {
                      const score = parseFloat(String(val));
                      let badgeColor = 'bg-green-100 text-green-700';
                      if (!isNaN(score)) {
                        if (score >= 70) badgeColor = 'bg-red-100 text-red-700';
                        else if (score >= 40) badgeColor = 'bg-yellow-100 text-yellow-700';
                      }
                      return React.createElement('span', {
                        className: `inline-block px-2 py-0.5 rounded-full font-semibold text-xs ${badgeColor}`
                      }, Number(val).toFixed(2));
                    }

                    // plant_name column in cluster_master: render plant name text + location list icon button
                    if (isPlantNameCol) {
                      const rowClusterId = String((params.data as any)?.['cluster_id'] ?? '');
                      const isOpen = locationDropdown?.clusterId === rowClusterId;
                      const isLoading = !!locationNamesLoadingMap[rowClusterId];
                      const tooltipText = `Location list for Cluster ID: ${rowClusterId}`;

                      return React.createElement('div', {
                        className: 'flex items-center gap-1.5 w-full h-full',
                        style: { minWidth: 0 }
                      }, [
                        React.createElement('span', {
                          key: 'plant-name-text',
                          className: 'truncate flex-1 min-w-0',
                        }, val ? String(val) : '—'),
                        React.createElement(TooltipProvider, { key: 'plant-name-tooltip', delayDuration: 200 } as any,
                          React.createElement(Tooltip, null,
                            React.createElement(TooltipTrigger, { asChild: true },
                              React.createElement('button', {
                                className: `flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded transition-colors ${isOpen ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`,
                                onClick: (e: any) => {
                                  e.stopPropagation();
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  handlePlantLocationNamesClick(rowClusterId, rect);
                                }
                              },
                                isLoading
                                  ? React.createElement('div', { className: 'h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin' })
                                  : React.createElement('svg', {
                                      xmlns: 'http://www.w3.org/2000/svg',
                                      viewBox: '0 0 24 24',
                                      fill: 'none',
                                      stroke: 'currentColor',
                                      strokeWidth: 2,
                                      strokeLinecap: 'round',
                                      strokeLinejoin: 'round',
                                      className: 'w-3.5 h-3.5',
                                    }, [
                                      React.createElement('line', { key: 'l1', x1: 8, y1: 6, x2: 21, y2: 6 }),
                                      React.createElement('line', { key: 'l2', x1: 8, y1: 12, x2: 21, y2: 12 }),
                                      React.createElement('line', { key: 'l3', x1: 8, y1: 18, x2: 21, y2: 18 }),
                                      React.createElement('line', { key: 'l4', x1: 3, y1: 6, x2: '3.01', y2: 6 }),
                                      React.createElement('line', { key: 'l5', x1: 3, y1: 12, x2: '3.01', y2: 12 }),
                                      React.createElement('line', { key: 'l6', x1: 3, y1: 18, x2: '3.01', y2: 18 }),
                                    ])
                              )
                            ),
                            React.createElement(TooltipPortal, { container: typeof document !== 'undefined' ? document.body : undefined },
                              React.createElement(TooltipContent, { side: 'top', sideOffset: 6, className: 'text-white bg-gray-800 border-0 !z-[2147483647] text-xs' },
                                tooltipText
                              )
                            )
                          )
                        )
                      ]);
                    }

                    // Clickable cells
                    if ((isClusterIdClickable || isCentroidClickable || isTransporterCodeClickable || isTtNumberClickable) && val && String(val).trim() !== '') {
                      const normalizedClickableValue =
                        typeof key === 'string' &&
                        (key.toLowerCase().includes('transporter') || key.toLowerCase().includes('transported'))
                          ? formatValue(val, key)
                          : String(val);

                      // cluster_id in clusterMaster: show ID link only (location list icon moved to plant_name column)
                      if (isClusterIdClickable) {
                        const clusterId = String(val);

                        return React.createElement('span', {
                          className: 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer truncate',
                          onClick: () => handleClusterIdClick(clusterId),
                        }, clusterId);
                      }

                      return React.createElement('span', {
                        className: 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer',
                        onClick: () => {
                          if (isCentroidClickable) {
                            try {
                              let lat, lon;
                              const valueStr = String(val).trim();
                              try {
                                const parsed = JSON.parse(valueStr);
                                if (Array.isArray(parsed) && parsed.length >= 2) { lat = parsed[0]; lon = parsed[1]; }
                              } catch {
                                const parts = valueStr.split(',');
                                if (parts.length >= 2) { lat = parts[0].trim(); lon = parts[1].trim(); }
                              }
                              if (lat && lon) {
                                const latNum = Number(lat), lonNum = Number(lon);
                                if (!isNaN(latNum) && !isNaN(lonNum)) {
                                  window.open(`https://www.google.com/maps?q=${latNum},${lonNum}`, '_blank', 'noopener,noreferrer');
                                }
                              }
                            } catch (error) { console.error('Error parsing centroid_lat_lon:', error); }
                          }
                          else if (isTransporterCodeClickable) {
                            if (activeRiskTab === "completed") {
                              setActiveRiskTab("transport");
                              setSearchInputValues(prev => ({ ...prev, riskAnalysis: { ...prev.riskAnalysis, transport: normalizedClickableValue } }));
                              setSearchTerms(prev => ({ ...prev, riskAnalysis: { ...prev.riskAnalysis, transport: normalizedClickableValue } }));
                            } else {
                              handleTransporterCodeClick(normalizedClickableValue);
                            }
                          }
                          else if (isTtNumberClickable) {
                            if (activeRiskTab === "completed") {
                              setActiveRiskTab("tts");
                              setSearchInputValues(prev => ({ ...prev, riskAnalysis: { ...prev.riskAnalysis, tts: normalizedClickableValue } }));
                              setSearchTerms(prev => ({ ...prev, riskAnalysis: { ...prev.riskAnalysis, tts: normalizedClickableValue } }));
                            } else {
                              handleTtNumberClick(normalizedClickableValue);
                            }
                          }
                        }
                      }, formatValue(val, key));
                    }

                    // Combinational alert with icon
                    if (isCombinationalAlert && val !== null && val !== undefined && Number(val) > 0) {
                      return React.createElement('div', {
                        className: 'flex items-center gap-1.5 text-blue-600 hover:text-blue-800 cursor-pointer',
                        onClick: () => handleInvoiceNoClick(String(params.data?.invoice_no))
                      }, [
                        React.createElement('span', { key: 'val' }, formatValue(val, key)),
                        React.createElement(AlertCircle, { key: 'icon', className: 'h-4 w-4' })
                      ]);
                    }

                    // Shortage-VTS Combined (merged_shortage_vts): violation-style *_count columns → green badge only on this tab
                    const mergedShortageVtsCountColumns = [
                      'route_deviation_count',
                      'speed_violation_count',
                      'main_supply_removal_count',
                      'device_tamper_count',
                      'stoppage_violations_count',
                      'night_driving_count',
                      'continuous_driving_count',
                    ];
                    if (isMergedShortageVtsTable && mergedShortageVtsCountColumns.includes(key)) {
                      // null/undefined/'' still render as "0" via formatValue below — badge must apply too or some rows look unstyled
                      const raw = val === null || val === undefined || val === "" ? 0 : val;
                      const numVal = Number(raw);
                      return React.createElement('span', {
                        className: 'inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700'
                      }, isNaN(numVal) ? String(raw) : numVal.toString());
                    }

                    // Violation count columns with green badge
                    const violationColumns = ['dr', 'pd', 'rd', 'st', 'sv', 'nd', 'ha', 'ht', 'hb', 'total_rd', 'total_st', 'total_dr', 'total_pd', 'total_sv', 'total_cd', 'total_nd'];
                    if (violationColumns.includes(key) && val !== null && val !== undefined) {
                      const numVal = Number(val);
                      return React.createElement('span', {
                        className: 'inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700'
                      }, isNaN(numVal) ? val : numVal.toString());
                    }

                    return formatValue(val, key);
                  },
                  headerClass: `ag-header-cell-custom${isCombinationalAlertCol ? ' ag-header-cell-combination' : ''}`,
                } as ColDef;
              })
              ]}
              defaultColDef={{
                sortable: false,
                resizable: true,
                filter: false,
                floatingFilter: false,
                suppressMovable: false,
                suppressMenu: true,
                headerComponent: CustomHeaderComponent,
                minWidth: 120,
              }}
              tooltipShowDelay={200}
              pagination={false}
              animateRows={false}
              suppressRowClickSelection={!isMultiSelectMode}
              suppressCellFocus={true}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              rowSelection={isMultiSelectMode && supportsMultiSelect() ? 'multiple' : undefined}
              rowMultiSelectWithClick={isMultiSelectMode}
              getRowId={(params) => {
                // Use a unique identifier from the row data
                const data = params.data;
                if (data?.invoice_no) return `inv_${data.invoice_no}`;
                if (data?.cluster_id) return `cluster_${data.cluster_id}`;
                if (data?.transporter_code) return `trans_${data.transporter_code}`;
                if (data?.tt_number) return `tt_${data.tt_number}`;
                if (data?.id) return `id_${data.id}`;
                // Fallback to stringified data
                return `row_${JSON.stringify(data).slice(0, 50)}`;
              }}
              onSelectionChanged={(event) => {
                if (isMultiSelectMode && supportsMultiSelect()) {
                  const selectedNodes = event.api.getSelectedNodes();
                  const currentGridSelections = selectedNodes.map(node => node.data);
                 
                  // Get IDs of current grid's data to filter out old selections from this grid
                  const currentGridDataIds = new Set(
                    paginatedData.map((row: any) =>
                      row?.invoice_no || row?.cluster_id || row?.transporter_code || row?.tt_number || row?.id || JSON.stringify(row)
                    )
                  );
                 
                  // Keep selections from other tabs/grids (those not in current grid's data)
                  const selectionsFromOtherGrids = selectedRows.filter((row: any) => {
                    const rowId = row?.invoice_no || row?.cluster_id || row?.transporter_code || row?.tt_number || row?.id || JSON.stringify(row);
                    return !currentGridDataIds.has(rowId);
                  });
                 
                  // Combine selections from other grids with current grid's selections
                  setSelectedRows([...selectionsFromOtherGrids, ...currentGridSelections]);
                }
              }}
              onSortChanged={(event) => {
                const sortState = event.api.getColumnState().find(col => col.sort);
                if (sortState) {
                  setSortColumn(sortState.colId);
                  setSortDirection(sortState.sort || 'asc');
                }
              }}
             
              onGridReady={(params: GridReadyEvent) => {
                retryMirrorScrollbar();
                // Do not autoSizeAllColumns — conflicts with last-column flex and causes column / row layout jumps
                // Pre-select rows that are in selectedRows state
                if (isMultiSelectMode && selectedRows.length > 0) {
                  params.api.forEachNode((node) => {
                    const rowData = node.data;
                    const rowId = rowData?.invoice_no || rowData?.cluster_id || rowData?.transporter_code || rowData?.tt_number || rowData?.id;
                    const isSelected = selectedRows.some((selected: any) => {
                      const selectedId = selected?.invoice_no || selected?.cluster_id || selected?.transporter_code || selected?.tt_number || selected?.id;
                      return rowId && selectedId && rowId === selectedId;
                    });
                    if (isSelected) {
                      node.setSelected(true);
                    }
                  });
                }
              }}
              onFirstDataRendered={(params) => {
                retryMirrorScrollbar();
                // Pre-select rows that are in selectedRows state
                if (isMultiSelectMode && selectedRows.length > 0) {
                  params.api.forEachNode((node) => {
                    const rowData = node.data;
                    const rowId = rowData?.invoice_no || rowData?.cluster_id || rowData?.transporter_code || rowData?.tt_number || rowData?.id;
                    const isSelected = selectedRows.some((selected: any) => {
                      const selectedId = selected?.invoice_no || selected?.cluster_id || selected?.transporter_code || selected?.tt_number || selected?.id;
                      return rowId && selectedId && rowId === selectedId;
                    });
                    if (isSelected) {
                      node.setSelected(true);
                    }
                  });
                }
                // TT Violation / Customer Violation: fill grid width after layout
                if (
                  section === "shortageAnalysis" &&
                  (tab === "ttViolation" || tab === "customerV")
                ) {
                  requestAnimationFrame(() => {
                    try {
                      params.api.sizeColumnsToFit();
                    } catch {
                      /* no-op */
                    }
                  });
                }
              }}
              onGridSizeChanged={(params) => {
                if (
                  section === "shortageAnalysis" &&
                  (tab === "ttViolation" || tab === "customerV")
                ) {
                  try {
                    params.api.sizeColumnsToFit();
                  } catch {
                    /* no-op */
                  }
                }
              }}
              rowBuffer={20}
              suppressMenuHide={true}
              noRowsOverlayComponent={() => React.createElement('div', { className: 'text-center py-4 text-gray-500 text-xs' }, data.length > 0 ? 'No matching records found' : 'No data available')}
            />
          </div>
        </div>

        {/* {isMultiSelectMode && supportsMultiSelect() && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
            <strong>Multi-Select Mode:</strong> Select multiple risk score entries to create a ticket. {selectedRows.length} item(s) selected.
          </div>
        )} */}

        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 border-t border-gray-300 rounded-b-xl flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-2 py-1 text-sm border-2 border-gray-300 rounded-lg bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors font-medium"
              >
                {[5, 10, 25, 50, 100].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
              <span className="text-sm font-medium text-gray-700">entries</span>
            </div>
            {/* <div className="text-sm text-gray-700">
              Showing {totalItems > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, totalItems)} of{" "}
              {totalItems} entries
            </div> */}
            {/* <div className="text-sm text-gray-700">
              Showing {totalItems > 0 ? startIndex + 1 : 0} to {endIndex} of {totalItems} entries
            </div> */}
            <div className="text-sm font-medium text-gray-700 bg-white px-2 py-1.5 rounded-lg border border-gray-200 shadow-sm">
              Showing <span className="font-bold text-gray-900">{totalItems > 0 ? startIndex + 1 : 0}</span> to <span className="font-bold text-gray-900">{endIndex}</span> of <span className="font-bold text-gray-900">{totalItems}</span> entries
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (currentPage <= 2) {
                  pageNum = i;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${currentPage === pageNum
                        ? "bg-blue-500 text-white"
                        : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400"
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-100 p-1 flex flex-col h-[calc(100vh-2rem)] min-h-0 overflow-hidden">
      {showClusterMapViewPage ? (
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/governance/vts/score')}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                aria-label="Back to Cluster Master"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <h2 className="text-sm font-semibold text-gray-800">Cluster Map View</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex h-8 min-w-[6.5rem] items-center justify-center rounded-md border border-gray-200 bg-white px-2.5 text-xs font-semibold tabular-nums text-gray-900"
                  title="Last updated date from API (Cluster Map); trend chart can override"
                >
                  {clusterMapViewDateLoading && !clusterMapViewDate ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden />
                  ) : clusterMapViewDate ? (
                    clusterMapViewDate.split("-").reverse().join("-")
                  ) : (
                    "—"
                  )}
                </span>
                {showClusterMapLatestChip && (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-0.5 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    title="Reset to last updated date from API"
                    onClick={() => {
                      void (async () => {
                        await fetchClusterMapMaxDate({ clearDateUntilLoaded: false });
                        setShowClusterMapLatestChip(false);
                      })();
                    }}
                  >
                    <X className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    {/* Latest */}
                  </button>
                )}
              </div>
              <select
                value={clusterSbu}
                onChange={(e) => setClusterSbu(e.target.value)}
                className="px-2 py-1 text-xs font-medium border border-gray-300 rounded-md bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                aria-label="Business unit"
              >
                {locationTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Popover open={clusterMapPlantPopoverOpen} onOpenChange={setClusterMapPlantPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={clusterMapPlantPopoverOpen}
                    className="inline-flex items-center justify-between gap-1 min-w-[8rem] max-w-[12rem] truncate px-2 py-1 text-xs font-medium border border-gray-300 rounded-md bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                    title={clusterMapPlantFilter || 'All plants'}
                  >
                    <span className="truncate">{clusterMapPlantFilter || 'All plants'}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
                  <Command shouldFilter>
                    <CommandInput placeholder="Search plant…" className="h-8 text-xs" />
                    <CommandList className="max-h-[min(280px,50vh)]">
                      <CommandEmpty className="text-xs py-3">No plant found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all plants"
                          className="text-xs"
                          onSelect={() => {
                            setClusterMapPlantFilter('');
                            setClusterMapPlantPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-3.5 w-3.5 shrink-0',
                              !clusterMapPlantFilter ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          All plants
                        </CommandItem>
                        {clusterMapFilterMeta.plants.map((p) => (
                          <CommandItem
                            key={p}
                            value={p}
                            className="text-xs"
                            onSelect={() => {
                              setClusterMapPlantFilter(p);
                              setClusterMapPlantPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-3.5 w-3.5 shrink-0',
                                clusterMapPlantFilter === p ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="break-words">{p}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
                {/* <span className="whitespace-nowrap">Cluster type</span> */}
                <select
                  value={clusterMapClusterTypeFilter}
                  onChange={(e) => setClusterMapClusterTypeFilter(e.target.value)}
                  className="min-w-[7rem] max-w-[11rem] truncate px-2 py-1 text-xs font-medium border border-gray-300 rounded-md bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  title={clusterMapClusterTypeFilter || 'All types'}
                >
                  <option value="">All types</option>
                  {clusterMapFilterMeta.clusterTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <Map className="w-3.5 h-3.5 text-gray-500" />
                    <span>{currentMapStyle.label}</span>
                    <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 rounded-xl border border-gray-200 shadow-xl bg-white" align="end">
                  {/* <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Map className="w-5 h-5 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Map View</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Choose how the map is displayed</p>
                  </div> */}
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {MAP_VIEW_STYLES.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleMapViewStyleSelect(id)}
                        className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                          clusterMapViewStyle === id
                            ? 'border-blue-500 bg-blue-50/50 text-blue-600'
                            : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {clusterMapViewStyle === id && (
                          <span className="absolute top-1.5 right-1.5 text-blue-600">
                            <Check className="w-4 h-4" />
                          </span>
                        )}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                          id === 'light' ? 'bg-amber-50' :
                          id === 'hybrid' ? 'bg-indigo-100' :
                          id === 'satellite' ? 'bg-emerald-100' : 'bg-gray-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            id === 'hybrid' ? 'text-indigo-600' :
                            id === 'light' ? 'text-amber-600' :
                            id === 'satellite' ? 'text-emerald-700' : 'text-gray-600'
                          }`} />
                        </div>
                        <span className={`text-xs font-medium ${clusterMapViewStyle === id ? 'text-blue-600' : 'text-gray-700'}`}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="p-4 pt-0 flex items-start gap-2">
                    <Map className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{currentMapStyle.label} Mode</p>
                      <p className="text-xs text-gray-500 mt-0.5">{currentMapStyle.description}</p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                onClick={() => clusterMapViewRef.current?.resetView()}
              >
                Reset View
              </button>
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={clusterMapViewRadius500m}
                  onChange={(e) => setClusterMapViewRadius500m(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                300m Radius
              </label>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            {/* Wait for `risk_score_max_date` — do not mount ClusterMapView until `clusterMapViewDate` is set.
                Otherwise the map fires `risk_score_cluster_map` with today's fallback, then unmounts when max-date fetch clears date → duplicate API calls. */}
            {clusterMapViewDateLoading || !clusterMapViewDate ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-white text-gray-600">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" aria-hidden />
                <span className="text-sm font-medium">Loading map data…</span>
              </div>
            ) : (
              <ClusterMapView
                ref={clusterMapViewRef}
                className="min-h-0 flex-1 w-full"
                mapType={clusterMapViewMapType}
                onMapTypeChange={setClusterMapViewMapType}
                radius500m={clusterMapViewRadius500m}
                onRadius500mChange={setClusterMapViewRadius500m}
                selectedBu={clusterSbu}
                selectedDate={clusterMapViewDate || undefined}
                plantFilter={clusterMapPlantFilter}
                clusterTypeFilter={clusterMapClusterTypeFilter}
                onFilterMeta={handleClusterMapFilterMeta}
                onTrendDateSelect={(isoDate) => {
                  setClusterMapViewDate(isoDate);
                  setShowClusterMapLatestChip(true);
                }}
              />
            )}
          </div>
        </div>
      ) : (
        <>
      <VTSVehicleAI />
      <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-200 mb-2 flex-shrink-0">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <h1 className="text-2xl font-semibold text-gray-900">
            Risk Score Dashboard
          </h1>
            {(activeSection === "clusterMaster" ||
              (activeSection === "riskAnalysis" &&
                (activeRiskTab === "transport" || activeRiskTab === "tts" || activeRiskTab === "location")) ||
              (activeSection === "shortageAnalysis" && activeShortageTab !== "mergedTable")) && (
              <span className="text-sm text-gray-500 font-medium">
                - Last scheduler run at
                {lastSchedulerForHeader ? (
                  <span className="text-gray-500 font-medium">
                    {" "}
                    (
                    {(() => {
                      const d = new Date(lastSchedulerForHeader + "T00:00:00");
                      d.setDate(d.getDate() + 1);
                      return d.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      });
                    })()}{" "}
                    12:00 AM)
                  </span>
                ) : null}
              </span>
            )}
          </div>
          {/* Show ReusableFilterBar only for completed tab */}
          {(activeSection === "riskAnalysis" && activeRiskTab === "completed") ? (
            <div className="flex flex-col lg:flex-row items-center gap-2">
              <Select value={selectedBu} onValueChange={setSelectedBu}>
                <SelectTrigger className="w-auto h-7 text-xs">
                  <SelectValue placeholder="Select BU" />
                </SelectTrigger>
                <SelectContent>
                  {filterBuOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ReusableFilterBar
                key={refreshKey}
                refreshKey={refreshKey}
                selectedBu={selectedBu}
                onBuChange={setSelectedBu}
                selectedZone={selectedZone}
                onZoneChange={handleZoneChange}
                selectedPlant={selectedPlant}
                onPlantChange={handlePlantChangeForFilter}
                timeFilter={selectedTimeFilter}
                onTimeFilterChange={handleTimeFilterChangeForFilter}
                onRefresh={handleRefreshForFilter}
                isLoading={isRefreshing}
                hideBuSelect
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Location Type selector for cluster_master, transport, and tts tabs */}
              {(activeSection === "clusterMaster" ||
                (activeSection === "riskAnalysis" && (activeRiskTab === "transport" || activeRiskTab === "tts"))) && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedLocationType}
                    onChange={(e) => setSelectedLocationType(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                    aria-label="Business unit"
                  >
                    {locationTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* BU, Zone, Plant selectors for Shortage-VTS Combined (mergedTable) - separate state so it doesn't affect Completed Trip */}
              {activeSection === "shortageAnalysis" && activeShortageTab === "mergedTable" && (
                <div className="flex items-center gap-2">
                  <Select
                    value={mergedTableSelectedBu}
                    onValueChange={(value) => setMergedTableSelectedBu(value)}
                  >
                    <SelectTrigger className="w-auto h-7 text-xs">
                      <SelectValue placeholder="Select BU" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterBuOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ZonePlantSelections
                    key={`merged-table-zone-plant-${refreshKey}`}
                    zone={mergedTableSelectedZone}
                    sapid={mergedTableSelectedPlant}
                    onZoneChange={(zone) => {
                      setMergedTableSelectedZone(zone);
                      setCurrentPage(0);
                    }}
                    onPlantChange={(plant, zone) => {
                      setMergedTableSelectedPlant(plant);
                      if (zone !== undefined) setMergedTableSelectedZone(zone);
                      setCurrentPage(0);
                    }}
                    bu={mergedTableSelectedBu}
                    sendEmptyBu={false}
                    // isCemsDashboard={false}
                  />
                </div>
              )}

              {/* Single-date filter: Cluster Master, Transporter / TTS Risk Score only */}
              {(activeSection === "clusterMaster" ||
                (activeSection === "riskAnalysis" && (activeRiskTab === "transport" || activeRiskTab === "tts"))) && (
                <div className="relative">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); }}
                    className="pl-9 h-9 w-40"
                    placeholder="Select Date"
                    min={(() => {
                      const selectedDateObj = new Date(selectedDate);
                      const selectedMinDate = new Date(selectedDateObj);
                      selectedMinDate.setDate(selectedMinDate.getDate() - 60);

                      const todayMinDate = new Date();
                      todayMinDate.setDate(todayMinDate.getDate() - 60);

                      const minDate = selectedMinDate < todayMinDate ? selectedMinDate : todayMinDate;
                      return minDate.toISOString().split('T')[0];
                    })()}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              {/* Shortage-VTS Combined: TDY / YDY / 1W / 15D / 1M / 3M + custom range (no single-date field) */}
              {activeSection === "shortageAnalysis" && activeShortageTab === "mergedTable" && (
                <MergedShortageVtsTimeFilter
                  key={`merged-table-time-${refreshKey}`}
                  selectedFilter={
                    mergedTableDateRangeFilter?.start && mergedTableDateRangeFilter?.end
                      ? {
                          key: "Date",
                          cond: "equals",
                          value: (() => {
                            const fmt = (d: Date) =>
                              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                            return `${fmt(mergedTableDateRangeFilter.start)},${fmt(mergedTableDateRangeFilter.end)}`;
                          })(),
                        }
                      : mergedTableTimeFilter
                  }
                  onFilterChange={handleMergedTableTimeFilterChange}
                />
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-all duration-300"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 px-2 overflow-x-auto shadow-sm">
        <div className="flex items-center gap-3 min-w-max">
          {[
          {
            id: "riskAnalysis",
            label: "Risk Analysis",
            icon: "",
          },
          {
            id: "shortageAnalysis",
            label: "Shortage Analysis",
            icon: "",
          },
          {
            id: "clusterMaster",
            label: "Cluster Master",
            icon: "",
            hasInfo: true,
          },
          ].map((tab) => (
            <div key={tab.id} className={`flex items-center ${tab.id === "clusterMaster" ? "gap-4" : "gap-1"}`}>
              <button
                onClick={() => setActiveSection(tab.id)}
                className={`relative text-sm font-semibold px-6 py-2 transition-all duration-300 whitespace-nowrap rounded-lg
                  ${activeSection === tab.id
                    ? "bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-lg transform scale-105"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                  }`}
              >
                <div className="flex items-center gap-1">
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                  {tab.hasInfo && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
                            <Info className={`w-3.5 h-3.5 flex-shrink-0 ${activeSection === tab.id ? 'text-white/80' : 'text-blue-500'}`} />
                          </span>
                        </TooltipTrigger>
                        <TooltipPortal container={typeof document !== "undefined" ? document.body : undefined}>
                          <TooltipContent side="bottom" sideOffset={6} align="start" className="max-w-[280px] text-white bg-blue-600 border-0 !z-[2147483647]">
                            60 days Rolling Window
                          </TooltipContent>
                        </TooltipPortal>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {activeSection === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>
                )}
              </button>
              {tab.id === "clusterMaster" && (
                <button
                  type="button"
                  onClick={() => navigate(CLUSTER_MAP_VIEW_PATH)}
                  className={`relative inline-flex items-center gap-1.5 text-sm font-semibold px-6 py-2 whitespace-nowrap rounded-lg transition-all duration-300
                    ${showClusterMapViewPage
                      ? "bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-lg transform scale-105"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    }`}
                  aria-label="Cluster Map View"
                  title="Cluster Map View"
                >
                  {/* <Map className="w-3.5 h-3.5 shrink-0" /> */}
                  <span>Map View</span>
                  {showClusterMapViewPage && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" aria-hidden />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRiskScoreManualDownload}
          disabled={isDownloadingManual}
          className="group inline-flex items-center gap-2 text-sm font-semibold px-5 py-1.5 whitespace-nowrap rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:from-blue-600 hover:to-blue-700 hover:shadow-lg transition-all duration-300 ml-auto flex-shrink-0 border border-blue-500/70"
          aria-label="Download"
          title={isDownloadingManual ? "Downloading user manual..." : "Download"}
        >
          <span>User Manual</span>
          {isDownloadingManual ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
          )}

        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeSection === "riskAnalysis" ? (
          <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="mb-2 flex-shrink-0">
              {/* <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></span>
                Risk Analysis Tabs
              </h2> */}
             
              <div className="grid grid-cols-4 gap-3">
                {[
                  { id: "completed", label: "Completed Trips Risk Score", shortLabel: "Completed", hasInfo: true },
                  { id: "transport", label: "Transporter Risk Score", shortLabel: "Transporter", hasInfo: true },
                  { id: "tts", label: "TTs Risk Score", shortLabel: "TTs", hasInfo: true },
                  // { id: "afterDR", label: "TT After DR", shortLabel: "After DR", hasInfo: false },
                  { id: "location", label: "Location Risk Score", shortLabel: "Location", hasInfo: true },
                ].map((subtab) => (
                  <button
                    key={subtab.id}
                    onClick={() => setActiveRiskTab(subtab.id)}
                    className={`group relative flex flex-col items-center justify-center px-2 py-2.5 min-h-[36px] rounded-xl border-2 transition-all duration-300 transform hover:scale-105
                      ${activeRiskTab === subtab.id
                        ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white border-blue-600 shadow-lg"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-400/50 hover:bg-blue-50"
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-semibold text-center leading-tight ${activeRiskTab === subtab.id ? 'text-white' : 'text-gray-800'}`}>
                        {subtab.label}
                      </span>
                      {subtab.hasInfo && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
                                <Info className={`w-3.5 h-3.5 flex-shrink-0 ${activeRiskTab === subtab.id ? 'text-white/80' : 'text-blue-500'}`} />
                              </span>
                            </TooltipTrigger>
                            <TooltipPortal container={typeof document !== "undefined" ? document.body : undefined}>
                              <TooltipContent side="bottom" sideOffset={8} align="center" collisionPadding={16} className="max-w-[260px] text-white bg-blue-600 border-0 text-center !z-[2147483647]">
                                {subtab.id === 'completed' ? 'Completed trip data is available from 1st November' : '60 days Rolling Window'}
                              </TooltipContent>
                            </TooltipPortal>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {activeRiskTab === subtab.id && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading data...</div>
            ) : error ? (
              <div className="p-8 text-center text-gray-500">No Data Available</div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {renderTable(getCurrentData(), activeRiskTab, activeSection)}
              </div>
            )}
          </div>
        ) : activeSection === "shortageAnalysis" ? (
          <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="mb-2 flex-shrink-0">
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  // Tab id `mergedTable` ↔ API table_name merged_shortage_vts — keep label/shortLabel as-is; feature logic keys off this id only
                  { id: "mergedTable", label: "Shortage-VTS Combined", shortLabel: "Summary", hasInfo: true },
                  { id: "ttViolation", label: "TT Violation", shortLabel: "Summary", hasInfo: true },
                  { id: "customerV", label: "Customer Violation", shortLabel: "Summary", hasInfo: true },
                  { id: "routeTT", label: "Route TT Violation", shortLabel: " Summary", hasInfo: true },
                  // { id: "srcDest", label: "Location Destination", shortLabel: "Consistency" },
                  // { id: "customerSummary", label: "Customer ", shortLabel: "Summary" },
                ].map((subtab) => (
                  <button
                    key={subtab.id}
                    onClick={() => setActiveShortageTab(subtab.id)}
                    className={`group relative flex flex-col items-center justify-center px-1 py-1.5 rounded-xl border-2 transition-all duration-300 transform hover:scale-105
                      ${activeShortageTab === subtab.id
                        ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white border-blue-600 shadow-lg"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-400/50 hover:bg-blue-50"
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-semibold text-center leading-tight ${activeShortageTab === subtab.id ? 'text-white' : 'text-gray-800'}`}>
                        {subtab.label}
                      </span>
                      {subtab.hasInfo && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
                                <Info className={`w-3.5 h-3.5 flex-shrink-0 ${activeShortageTab === subtab.id ? 'text-white/80' : 'text-blue-500'}`} />
                              </span>
                            </TooltipTrigger>
                            <TooltipPortal container={typeof document !== "undefined" ? document.body : undefined}>
                              <TooltipContent side="bottom" sideOffset={6} align="center" collisionPadding={12} className="max-w-[280px] text-white bg-blue-600 border-0 !z-[2147483647]">
                                60 days Rolling Window
                              </TooltipContent>
                            </TooltipPortal>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <span className={`text-xs font-medium mb-1 ${activeShortageTab === subtab.id ? 'text-white/90' : 'text-gray-500'}`}>
                      {subtab.shortLabel}
                    </span>
                    {activeShortageTab === subtab.id && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading data...</div>
            ) : error ? (
              <div className="p-8 text-center text-gray-500">No Data Available</div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                {renderTable(getCurrentData(), activeShortageTab, activeSection)}
              </div>
            )}
          </div>
        ) : activeSection === "clusterMaster" ? (
          <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-4 flex flex-1 min-h-0 flex-col overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading data...</div>
            ) : error ? (
              <div className="p-8 text-center text-gray-500">No Data Available</div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {renderTable(getCurrentData(), "cluster", activeSection)}
              </div>
            )}
          </div>
        ) : null}
      </div>
     
      {/* Invoice No Details Sheet */}
      <InvoiceDetailSheet
        isOpen={isInvoiceModalOpen}
        onClose={setIsInvoiceModalOpen}
        clickedInvoiceNo={clickedInvoiceNo}
        invoiceModalData={invoiceModalData}
        invoiceModalLoading={invoiceModalLoading}
        invoiceModalError={invoiceModalError}
        invoiceModalSearch={invoiceModalSearch}
        setInvoiceModalSearch={setInvoiceModalSearch}
        onDownload={() => downloadModalData("completed_trips_risk_score", "clicked_invoice_no", clickedInvoiceNo || "", `Invoice_${clickedInvoiceNo}`)}
      />

      {/* Location Names Floating Dropdown (plant_name column in cluster_master) */}
      {locationDropdown && (
        <>
          <div
            className="fixed inset-0 z-[998]"
            onClick={() => setLocationDropdown(null)}
          />
          <div
            className="fixed z-[999] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
            style={{
              ...(locationDropdown.openUp
                ? { bottom: window.innerHeight - locationDropdown.bottom + 4 }
                : { top: locationDropdown.top }),
              left: Math.min(locationDropdown.left, window.innerWidth - 220),
              minWidth: '180px',
              maxWidth: '240px',
              maxHeight: '200px',
            }}
          >
            <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
              {locationNamesLoadingMap[locationDropdown.clusterId] ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="h-3 w-3 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                  <span className="text-xs text-gray-400">Loading…</span>
                </div>
              ) : !locationNamesMap[locationDropdown.clusterId] || locationNamesMap[locationDropdown.clusterId].length === 0 ? (
                <div className="px-3 py-2">
                  <span className="text-xs text-gray-400">No locations found.</span>
                </div>
              ) : (
                <ul>
                  {locationNamesMap[locationDropdown.clusterId].map((item, idx) => (
                    <li
                      key={idx}
                      className="px-3 py-1 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                      onClick={() => handleLocationNameClick(locationDropdown.clusterId, item.location_name)}
                    >
                      {item.location_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* Location Detail Sheet (opened by clicking a location in the plant_name dropdown) */}
      <LocationDetailSheet
        isOpen={isLocationDetailOpen}
        onClose={setIsLocationDetailOpen}
        clusterId={locationDetailClusterId}
        locationName={locationDetailName}
        data={locationDetailData}
        loading={locationDetailLoading}
        error={locationDetailError}
        search={locationDetailSearch}
        setSearch={setLocationDetailSearch}
      />

      {/* Cluster Details Sheet */}
      <ClusterDetailSheet
        isOpen={isClusterModalOpen}
        onClose={setIsClusterModalOpen}
        clickedClusterId={clickedClusterId}
        clusterDetailsData={clusterDetailsData}
        clusterDetailsLoading={clusterDetailsLoading}
        clusterDetailsError={clusterDetailsError}
        clusterModalSearch={clusterModalSearch}
        setClusterModalSearch={setClusterModalSearch}
        onDownload={() => downloadModalData("cluster_master", "clicked_cluster_id", clickedClusterId || "", `Cluster_${clickedClusterId}`)}
      />

      {/* Transporter Code Details Sheet */}
      <TransporterDetailSheet
        isOpen={isTransporterModalOpen}
        onClose={setIsTransporterModalOpen}
        clickedTransporterCode={clickedTransporterCode}
        transporterLineChartData={transporterLineChartData}
        transporterLineChartLoading={transporterLineChartLoading}
        transporterLineChartError={transporterLineChartError}
        transporterModalData={transporterModalData}
        transporterModalLoading={transporterModalLoading}
        transporterModalError={transporterModalError}
        transporterModalSearch={transporterModalSearch}
        setTransporterModalSearch={setTransporterModalSearch}
        onDownload={() => downloadModalData("transporter_risk_score", "clicked_transporter_code", clickedTransporterCode || "", `Transporter_${clickedTransporterCode}`)}
        dateBadgeLabel={selectedDate ? selectedDate.split('-').reverse().join('-') : dateRangeLabel}
      />

      {/* TT Number Details Sheet */}
      <TtNumberDetailSheet
        isOpen={isTtModalOpen}
        onClose={setIsTtModalOpen}
        clickedTtNumber={clickedTtNumber}
        ttLineChartData={ttLineChartData}
        ttLineChartLoading={ttLineChartLoading}
        ttLineChartError={ttLineChartError}
        ttModalData={ttModalData}
        ttModalLoading={ttModalLoading}
        ttModalError={ttModalError}
        ttModalSearch={ttModalSearch}
        setTtModalSearch={setTtModalSearch}
        onDownload={() => downloadModalData("tt_risk_score", "clicked_tt_number", clickedTtNumber || "", `TT_${clickedTtNumber}`)}
        dateBadgeLabel={selectedDate ? selectedDate.split('-').reverse().join('-') : dateRangeLabel}
      />

      {/* Create Ticket Dialog */}
      <TicketDialogModal
        isOpen={isCreateTicketDialogOpen}
        isMinimized={isTicketFormMinimized}
        initialData={ticketInitialData}
        onClose={handleTicketDialogClose}
        onMinimize={handleMinimize}
        onRestore={handleRestore}
        ticketSection="RiskScore"
      />

      {/* CSS for slideInRight animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-180deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.15) rotate(10deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0);
          }
        }
        @keyframes fadeOut {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.8);
          }
        }
        .download-success-animation {
          animation: fadeInScale 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards,
                     pulseGlow 1.5s ease-in-out 0.3s;
        }
        .download-success-animation.fade-out {
          animation: fadeOut 0.3s ease-in forwards;
        }
      `}</style>
        </>
      )}
    </div>
  );
}