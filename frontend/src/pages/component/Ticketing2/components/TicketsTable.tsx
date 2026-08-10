
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { PmPeriodBarChartAm5, PmWeekLineChartAm5 } from "./PmOrdersAmCharts";
import EnhancedTimeFilter from "../../Governance/filters/TimeFilterButtons";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { apiClient } from "@/services/apiClient";
import useAuthStore from "@/store/authStore";
import { toast } from "sonner";
import TicketDialogModal from "./TicketDialogModal";

type TimeFilterValue = string | null | { key: string; cond: string; value: string };

interface PmOrder {
  order_no: string;
  order_type: string;
  order_description: string;
  planner_group_desc: string;
  system_status_desc: string;
  equipment_description: string;
  planning_plant: string;
  planning_plant_desc: string;
  planned_date: string;
}

type PmSortColumn =
  | "order_no"
  | "order_type"
  | "order_description"
  | "planner_group_desc"
  | "system_status_desc"
  | "equipment_description"
  | "planning_plant"
  | "planning_plant_desc"
  | "planned_date";

const comparePmOrders = (a: PmOrder, b: PmOrder, col: PmSortColumn, dir: "asc" | "desc"): number => {
  const sign = dir === "asc" ? 1 : -1;
  if (col === "planned_date") {
    const sa = String(a.planned_date ?? "").trim();
    const sb = String(b.planned_date ?? "").trim();
    return sign * sa.localeCompare(sb, undefined, { numeric: true });
  }
  const sa = String(a[col] ?? "").trim();
  const sb = String(b[col] ?? "").trim();
  return sign * sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
};

type LocationDataResponse = {
  status?: boolean;
  message?: string;
  data?: {
    zones?: Array<string | { id?: string; name?: string; zone?: string }>;
    zone?: Array<string | { id?: string; name?: string; zone?: string }>;
    zoneData?: Array<string | { id?: string; name?: string; zone?: string }>;
  };
};

const formatDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

/** Year range for PM orders by period bar chart only (not table / summary / week chart). */
type PmPeriodRangeKey = "2025" | "2026";

const PM_PERIOD_RANGE_BY_KEY: Record<PmPeriodRangeKey, { start_date: string; end_date: string }> = {
  "2025": { start_date: "2025-01-01", end_date: "2025-12-31" },
  "2026": { start_date: "2026-01-01", end_date: "2026-12-31" },
};

/** First and last calendar day of the month containing `reference` (local time). */
const getCalendarMonthRange = (reference: Date = new Date()) => {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { startDate: formatDate(start), endDate: formatDate(end) };
};

/** Map bar labels like "Feb 2026" / "2026-02" to the first day of that month (local). */
const parsePeriodLabelToMonthStart = (label: string): Date | null => {
  const s = String(label).trim();
  if (!s) return null;
  const d1 = new Date(`1 ${s}`);
  if (!Number.isNaN(d1.getTime())) {
    return new Date(d1.getFullYear(), d1.getMonth(), 1);
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    if (m >= 0 && m <= 11) return new Date(y, m, 1);
  }
  return null;
};

/**
 * PM orders by period — zone bar fills match LPG rejections charts (CS → GD → PT, seven zones each).
 * Hex values from: LPGCSRejection, LPGGDRejection, LPGPTRejection column `fill` adapters.
 */
const PM_PERIOD_BAR_COLORS = [
  "#5e74e9",
  "#282f64",
  "#5b3474",
  "#8a3679",
  "#b63a76",
  "#d94769",
  "#f36355",
  "#1976D2",
  "#388E3C",
  "#0288D1",
  "#F57C00",
  "#8E24AA",
  "#C2185B",
  "#FBC02D",
  "#7986CB",
  "#64B5F6",
  "#BA68C8",
  "#4DD0E1",
  "#7E57C2",
  "#F06292",
  "#E57FC8",
] as const;

/** Oldest month first (e.g. Jun 2025, Jul 2025, …) for PM orders by period bar chart. */
const sortPmPeriodChartPointsByMonthAscending = (points: PmWeeklyChartPoint[]): PmWeeklyChartPoint[] => {
  return [...points].sort((a, b) => {
    const da = parsePeriodLabelToMonthStart(a.name);
    const db = parsePeriodLabelToMonthStart(b.name);
    const ta = da?.getTime() ?? Number.POSITIVE_INFINITY;
    const tb = db?.getTime() ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
  });
};

const getDateRangeFromTimeFilter = (
  selectedTimeFilter: string | null,
  dateRangeFilter: { start: Date; end: Date } | null
) => {
  if (dateRangeFilter?.start && dateRangeFilter?.end) {
    return { startDate: formatDate(dateRangeFilter.start), endDate: formatDate(dateRangeFilter.end) };
  }

  const now = new Date();
  const start = new Date(now);
  switch (selectedTimeFilter) {
    case "YDY":
    case "1d":
      start.setDate(now.getDate() - 1);
      break;
    case "1W":
    case "1w":
      start.setDate(now.getDate() - 7);
      break;
    case "15D":
    case "15d":
      start.setDate(now.getDate() - 15);
      break;
    case "1M":
    case "1m":
      start.setDate(now.getDate() - 30);
      break;
    case "3M":
    case "3m":
      start.setDate(now.getDate() - 90);
      break;
    case "TDY":
    case "t":
    default:
      break;
  }

  return { startDate: formatDate(start), endDate: formatDate(now) };
};

const formatPlannedDate = (dateValue?: string) => {
  if (!dateValue || dateValue.length !== 8) return dateValue || "-";
  const formatted = `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`;
  const parsed = new Date(formatted);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString("en-IN");
};

const pmOrderRowKey = (row: PmOrder) =>
  `${row.order_no}|${row.planned_date ?? ""}|${row.planning_plant ?? ""}|${row.order_type ?? ""}`;

/** PM summary response: counts on the root; `data` may be `[]` when data_required is false. */
const PM_ORDER_SUMMARY_CARDS: Array<{ key: string; label: string }> = [
  { key: "total_orders_count", label: "Total Orders" },
  { key: "active_orders_count", label: "Active Orders" },
  { key: "completed_orders_count", label: "Completed Orders" },
];

const parsePmOrdersBigNumbers = (responseData: unknown): Array<{ label: string; value: string | number }> => {
  const out: Array<{ label: string; value: string | number }> = [];
  const root = responseData as Record<string, unknown> | null | undefined;
  if (!root || typeof root !== "object") return out;

  for (const { key, label } of PM_ORDER_SUMMARY_CARDS) {
    const val = root[key];
    if (typeof val === "number") out.push({ label, value: val });
  }
  if (out.length > 0) return out;

  const nested = root.data;
  const d =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : root;

  if (Array.isArray(d.stats)) {
    d.stats.forEach((item: unknown) => {
      const s = item as Record<string, unknown>;
      const lbl = s?.section ?? s?.name ?? s?.title ?? s?.label;
      const val = s?.value ?? s?.count ?? s?.total;
      if (lbl != null && val != null) {
        out.push({ label: String(lbl), value: typeof val === "number" ? val : String(val) });
      }
    });
    if (out.length > 0) return out;
  }

  const skipKeys = new Set([
    "status",
    "message",
    "data",
    "data_required",
    "rows",
    "details",
    "stats",
  ]);
  const formatLabel = (k: string) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  for (const [key, val] of Object.entries(d)) {
    if (skipKeys.has(key)) continue;
    if (typeof val === "number") {
      out.push({ label: formatLabel(key), value: val });
    } else if (val && typeof val === "object" && "count" in (val as object)) {
      const c = (val as { count?: unknown }).count;
      if (typeof c === "number") out.push({ label: formatLabel(key), value: c });
    }
  }

  if (typeof root.total === "number" && out.every((c) => c.label !== "Total")) {
    out.unshift({ label: "Total", value: root.total });
  }

  return out;
};

type PmWeeklyChartPoint = { name: string; value: number };

type WeekLineSeriesEntry = {
  monthKey: string;
  monthStart: Date;
  label: string;
  dataKey: string;
  points: PmWeeklyChartPoint[];
};

const monthKeyFromDate = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

const sameCalendarMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const WEEK_LINE_COLORS = ["#0d9488", "#2563eb", "#ea580c", "#7c3aed", "#db2777"];

/** Stroke/dot color for a week line: same base as the PM-by-period bar for that month, if present. */
const weekLineColorForMonth = (monthStart: Date, periodBars: PmWeeklyChartPoint[]): string => {
  const idx = periodBars.findIndex((row) => {
    const d = parsePeriodLabelToMonthStart(String(row.name));
    return d != null && sameCalendarMonth(d, monthStart);
  });
  if (idx >= 0) {
    return PM_PERIOD_BAR_COLORS[idx % PM_PERIOD_BAR_COLORS.length];
  }
  const key = monthKeyFromDate(monthStart);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i)) % PM_PERIOD_BAR_COLORS.length;
  return PM_PERIOD_BAR_COLORS[Math.abs(h) % PM_PERIOD_BAR_COLORS.length];
};

/** One row per week index; each series gets its own dataKey for multi-line chart. */
const buildMergedWeekLineChartRows = (
  series: WeekLineSeriesEntry[]
): Array<Record<string, string | number | null>> => {
  if (series.length === 0) return [];
  if (series.length === 1) {
    return series[0].points.map((p) => ({
      name: p.name,
      [series[0].dataKey]: p.value,
    }));
  }
  const maxLen = Math.max(...series.map((s) => s.points.length));
  return Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, string | number | null> = {};
    const nameA = series.map((s) => s.points[i]?.name).find(Boolean);
    row.name = nameA ?? `Week ${i + 1}`;
    series.forEach((s) => {
      const v = s.points[i]?.value;
      row[s.dataKey] = typeof v === "number" && Number.isFinite(v) ? v : null;
    });
    return row;
  });
};

/** Normalize pm_orders_weekly response into recharts-friendly rows (name + value). */
const parsePmOrdersWeeklyChart = (responseData: unknown): PmWeeklyChartPoint[] => {
  const root = responseData as Record<string, unknown> | null | undefined;
  if (!root || typeof root !== "object") return [];

  if (Array.isArray(root.segment_counts) && root.segment_counts.length > 0) {
    const out: PmWeeklyChartPoint[] = [];
    for (const item of root.segment_counts) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name = o.segment != null ? String(o.segment).trim() : "";
      const raw = o.total_count ?? o.count ?? o.value;
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(value)) continue;
      out.push({ name: name || `Segment ${out.length + 1}`, value });
    }
    if (out.length > 0) return out;
  }

  const tryArray = (arr: unknown): PmWeeklyChartPoint[] => {
    if (!Array.isArray(arr)) return [];
    const out: PmWeeklyChartPoint[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      let labelRaw =
        o.period ??
        o.month ??
        o.week ??
        o.week_label ??
        o.label ??
        o.segment ??
        o.name ??
        o.date ??
        o.x;
      let label = labelRaw != null ? String(labelRaw).trim() : "";
      if (!label) {
        const k = Object.keys(o).find((key) => /period|month|week|date|label|name/i.test(key));
        if (k != null && o[k] != null) label = String(o[k]).trim();
      }
      const valRaw =
        o.total_count ?? o.count ?? o.value ?? o.total ?? o.orders ?? o.orders_count ?? o.order_count;
      const num = typeof valRaw === "number" ? valRaw : Number(valRaw);
      if (!Number.isFinite(num)) continue;
      if (!label) label = `Item ${out.length + 1}`;
      out.push({ name: label, value: num });
    }
    return out;
  };

  let list = tryArray(root.data);
  if (list.length === 0 && root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    const d = root.data as Record<string, unknown>;
    list = tryArray(d.chart_data ?? d.series ?? d.rows ?? d.points ?? d.items);
  }
  if (list.length === 0) list = tryArray(root.series ?? root.rows ?? root.chart_data);

  return list;
};

const normalizeZones = (responseData: LocationDataResponse): string[] => {
  const d = responseData?.data ?? {};
  const zonesArr = Array.isArray(d.zones)
    ? d.zones
    : Array.isArray(d.zone)
      ? d.zone
      : Array.isArray(d.zoneData)
        ? d.zoneData
        : [];

  return zonesArr
    .map((z) => {
      if (z && typeof z === "object") {
        return String(z.id ?? z.zone ?? z.name ?? "").trim();
      }
      return String(z ?? "").trim();
    })
    .filter(Boolean);
};

/** Table pagination total from pm_orders response; prefers `total_orders_count`. */
const readPmOrdersTotalCount = (responseData: unknown): number | null => {
  if (!responseData || typeof responseData !== "object") return null;
  const o = responseData as Record<string, unknown>;
  const keys = ["total_orders_count", "total", "count"] as const;
  const pick = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  for (const key of keys) {
    const t = pick(o[key]);
    if (t != null) return t;
  }
  const inner = o.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    const d = inner as Record<string, unknown>;
    for (const key of keys) {
      const t = pick(d[key]);
      if (t != null) return t;
    }
  }
  return null;
};

function PmSortableColumnHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: PmSortColumn;
  label: string;
  sortColumn: PmSortColumn | null;
  sortDirection: "asc" | "desc";
  onSort: (c: PmSortColumn) => void;
}) {
  const active = sortColumn === column;
  const upActive = active && sortDirection === "asc";
  const downActive = active && sortDirection === "desc";
  const ariaSort = active ? (sortDirection === "asc" ? "ascending" : "descending") : "none";

  return (
    <th
      className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-center text-sm"
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex flex-row flex-nowrap items-center justify-center gap-0.5 whitespace-nowrap w-full font-semibold text-gray-700 hover:bg-gray-200/60 rounded px-1 py-0.5 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <span className="inline-flex flex-row flex-nowrap items-center gap-0 shrink-0" aria-hidden>
          <ArrowUp
            className={cn("h-6 w-2.5 shrink-0", upActive ? "text-blue-600" : "text-gray-300")}
            strokeWidth={2.25}
          />
          <ArrowDown
            className={cn("h-6 w-2.5 shrink-0", downActive ? "text-blue-600" : "text-gray-300")}
            strokeWidth={2.25}
          />
        </span>
      </button>
    </th>
  );
}

export default function TicketsTable() {
  const { user } = useAuthStore();
  const userBu = user?.bu;
  const isLpgUser = Array.isArray(userBu) && userBu.includes("LPG");
  const isTasUser = Array.isArray(userBu) && userBu.includes("TAS");

  const [selectedBu, setSelectedBu] = useState(isLpgUser ? "LPG" : "TAS");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>("1M");
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: Date; end: Date } | null>(null);
  const [rows, setRows] = useState<PmOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  /** Set when API returns a total (e.g. `total_orders_count`) for "Showing … of N entries". */
  const [serverTotalCount, setServerTotalCount] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [pmBigNumberCards, setPmBigNumberCards] = useState<Array<{ label: string; value: string | number }>>([]);
  const [isLoadingBigNumbers, setIsLoadingBigNumbers] = useState(false);

  const [pmWeeklyChartData, setPmWeeklyChartData] = useState<PmWeeklyChartPoint[]>([]);
  const [isLoadingWeeklyChart, setIsLoadingWeeklyChart] = useState(false);
  /** PM orders by period bar: full calendar year (default 2026). */
  const [pmPeriodRangeKey, setPmPeriodRangeKey] = useState<PmPeriodRangeKey>("2026");
  const [weekLineMonthSeries, setWeekLineMonthSeries] = useState<WeekLineSeriesEntry[]>([]);
  const [isLoadingWeeklyLineChart, setIsLoadingWeeklyLineChart] = useState(false);
  const weekLineSeriesRef = useRef<WeekLineSeriesEntry[]>([]);
  /** Bumps when user adds a month from the bar so an in-flight default "current month" fetch does not overwrite. */
  const defaultWeekLoadSeqRef = useRef(0);
  /** Only the latest pm_orders table request may update rows/totals (avoids stale responses clearing the total). */
  const pmOrdersFetchSeqRef = useRef(0);
  /** Fingerprint of filters + search (not page). When it changes, cached total from API must not carry over. */
  const pmOrdersFpRef = useRef<string>("");
  /** Last `total_orders_count` (etc.) from API for the current filter fingerprint; survives page changes when response omits total. */
  const lastPmOrdersTotalRef = useRef<number | null>(null);
  useEffect(() => {
    weekLineSeriesRef.current = weekLineMonthSeries;
  }, [weekLineMonthSeries]);

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<PmOrder[]>([]);
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [ticketInitialData, setTicketInitialData] = useState<Record<string, unknown> | null>(null);
  const [isTicketFormMinimized, setIsTicketFormMinimized] = useState(false);
  const [isPreparingTicket, setIsPreparingTicket] = useState(false);
  const [openLocationDropdown, setOpenLocationDropdown] = useState(false);
  const [locationOptions, setLocationOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [sortColumn, setSortColumn] = useState<PmSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const pmTableScrollRef = useRef<HTMLDivElement | null>(null);
  const pmTableMirrorRef = useRef<HTMLDivElement | null>(null);

  const handleSortColumn = useCallback((col: PmSortColumn) => {
    setSortColumn((prev) => {
      if (prev === col) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return col;
      }
      setSortDirection("asc");
      return col;
    });
  }, []);

  const canCreateTicket = useMemo(
    () =>
      Array.isArray(user?.novex_role) &&
      user.novex_role.some((r) =>
        ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"].includes(String(r).trim())
      ),
    [user?.novex_role]
  );

  useEffect(() => {
    if (isLpgUser) setSelectedBu("LPG");
    else if (isTasUser) setSelectedBu("TAS");
  }, [isLpgUser, isTasUser]);

  const requestParams = useMemo(() => {
    const { startDate, endDate } = getDateRangeFromTimeFilter(selectedTimeFilter, dateRangeFilter);
    const selectedPlants = selectedPlant
      ? String(selectedPlant)
          .split(",")
          .map((plant) => plant.trim())
          .filter(Boolean)
      : [];

    return {
      planning_plant: selectedPlants,
      start_date: startDate,
      end_date: endDate,
      ...(selectedZone ? { zone: selectedZone } : {}),
      data_required: true,
    };
  }, [selectedTimeFilter, dateRangeFilter, selectedZone, selectedPlant]);

  const locationRequestParams = useMemo(() => {
    const { startDate, endDate } = getDateRangeFromTimeFilter(selectedTimeFilter, dateRangeFilter);
    return {
      planning_plant: [],
      start_date: startDate,
      end_date: endDate,
      ...(selectedZone ? { zone: selectedZone } : {}),
      data_required: true,
    };
  }, [selectedTimeFilter, dateRangeFilter, selectedZone]);

  /** Summary / big numbers: same location + zone + date range as the table; `data_required` false per API contract. */
  const pmBigNumbersPayload = useMemo(
    () => ({
      ...requestParams,
      data_required: false,
      search: "",
      skip: 0,
      limit: 2000,
    }),
    [requestParams]
  );

  const planningPlantsForWeekly = useMemo(() => {
    if (!selectedPlant) return [] as string[];
    return String(selectedPlant)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }, [selectedPlant]);

  const pmWeeklyChartPayload = useMemo(() => {
    const range = PM_PERIOD_RANGE_BY_KEY[pmPeriodRangeKey];
    return {
      planning_plant: planningPlantsForWeekly,
      segment_type: "month",
      start_date: range.start_date,
      end_date: range.end_date,
      data_required: false,
      search: "",
      skip: 0,
      limit: 50,
    };
  }, [planningPlantsForWeekly, pmPeriodRangeKey]);

  const mergedWeekLineChartData = useMemo(
    () => buildMergedWeekLineChartRows(weekLineMonthSeries),
    [weekLineMonthSeries]
  );

  /** Only one period bar uses teal: the latest month among week-line series (rest stay yellow). */
  const periodBarHighlightMonthStart = useMemo(() => {
    if (weekLineMonthSeries.length === 0) return null;
    return weekLineMonthSeries.reduce((latest, s) =>
      s.monthStart.getTime() > latest.monthStart.getTime() ? s : latest
    ).monthStart;
  }, [weekLineMonthSeries]);

  /** e.g. "March 2026" or "March 2026, April 2026" for the week chart title. */
  const pmWeekChartSelectedMonthsLabel = useMemo(() => {
    if (weekLineMonthSeries.length === 0) return null;
    return weekLineMonthSeries
      .map((s) =>
        s.monthStart.toLocaleString("en-US", { month: "long", year: "numeric" })
      )
      .join(", ");
  }, [weekLineMonthSeries]);

  const fetchPmBigNumbers = useCallback(async () => {
    setIsLoadingBigNumbers(true);
    try {
      const response = await apiClient.post("/api/ticketing/pm_orders", pmBigNumbersPayload);
      const parsed = parsePmOrdersBigNumbers(response?.data);
      setPmBigNumberCards(parsed);
    } catch {
      setPmBigNumberCards([]);
    } finally {
      setIsLoadingBigNumbers(false);
    }
  }, [pmBigNumbersPayload]);

  const fetchPmWeeklyChart = useCallback(async () => {
    setIsLoadingWeeklyChart(true);
    try {
      const response = await apiClient.post("/api/ticketing/pm_orders_weekly", pmWeeklyChartPayload);
      const parsed = parsePmOrdersWeeklyChart(response?.data);
      setPmWeeklyChartData(sortPmPeriodChartPointsByMonthAscending(parsed));
    } catch {
      setPmWeeklyChartData([]);
    } finally {
      setIsLoadingWeeklyChart(false);
    }
  }, [pmWeeklyChartPayload]);

  /** Single POST for one calendar month’s weekly PM orders. */
  const fetchWeekSeriesEntryForMonth = useCallback(
    async (monthStart: Date): Promise<WeekLineSeriesEntry | null> => {
      const { startDate, endDate } = getCalendarMonthRange(monthStart);
      const response = await apiClient.post("/api/ticketing/pm_orders_weekly", {
        planning_plant: planningPlantsForWeekly,
        segment_type: "week" as const,
        start_date: startDate,
        end_date: endDate,
        data_required: false,
        search: "",
        skip: 0,
        limit: 50,
      });
      const points = parsePmOrdersWeeklyChart(response?.data);
      const key = monthKeyFromDate(monthStart);
      const label = monthStart.toLocaleString("en-US", { month: "short", year: "numeric" });
      const dataKey = `wk_${monthStart.getFullYear()}_${monthStart.getMonth()}`;
      const anchor = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
      return { monthKey: key, monthStart: anchor, label, dataKey, points };
    },
    [planningPlantsForWeekly]
  );

  /** Toggle month on period bar: remove series, or POST that month only and add another line (keeps e.g. current month). */
  const handlePeriodBarMonthClick = useCallback(
    async (monthStart: Date) => {
      const key = monthKeyFromDate(monthStart);
      if (weekLineSeriesRef.current.some((s) => s.monthKey === key)) {
        setWeekLineMonthSeries((prev) => prev.filter((s) => s.monthKey !== key));
        return;
      }
      defaultWeekLoadSeqRef.current += 1;
    setIsLoadingWeeklyLineChart(true);
    try {
        const entry = await fetchWeekSeriesEntryForMonth(monthStart);
        if (!entry) return;
        setWeekLineMonthSeries((prev) => {
          const filtered = prev.filter((s) => s.monthKey !== key);
          return [...filtered, entry].sort((a, b) => a.monthStart.getTime() - b.monthStart.getTime());
        });
    } catch {
        // keep prior series
    } finally {
      setIsLoadingWeeklyLineChart(false);
    }
    },
    [fetchWeekSeriesEntryForMonth]
  );

  const handleRefreshPmPeriodChart = useCallback(() => {
    void fetchPmWeeklyChart();
  }, [fetchPmWeeklyChart]);

  const handleRefreshPmWeekChart = useCallback(() => {
    const seq = ++defaultWeekLoadSeqRef.current;
    setIsLoadingWeeklyLineChart(true);
    (async () => {
      try {
        const series = weekLineSeriesRef.current;
        if (series.length === 0) {
          const now = new Date();
          const entry = await fetchWeekSeriesEntryForMonth(now);
          if (seq !== defaultWeekLoadSeqRef.current) return;
          if (entry) setWeekLineMonthSeries([entry]);
          return;
        }
        const entries = await Promise.all(series.map((s) => fetchWeekSeriesEntryForMonth(s.monthStart)));
        if (seq !== defaultWeekLoadSeqRef.current) return;
        const valid = entries.filter((e): e is WeekLineSeriesEntry => e != null);
        setWeekLineMonthSeries(
          valid.sort((a, b) => a.monthStart.getTime() - b.monthStart.getTime())
        );
      } catch {
        if (seq === defaultWeekLoadSeqRef.current) setWeekLineMonthSeries([]);
      } finally {
        if (seq === defaultWeekLoadSeqRef.current) setIsLoadingWeeklyLineChart(false);
      }
    })();
  }, [fetchWeekSeriesEntryForMonth]);

  const fetchPmOrders = useCallback(async () => {
    const fetchSeq = ++pmOrdersFetchSeqRef.current;
    const fp = `${JSON.stringify(requestParams)}|${searchTerm.trim()}`;
    if (fp !== pmOrdersFpRef.current) {
      pmOrdersFpRef.current = fp;
      lastPmOrdersTotalRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const skip = currentPage - 1;
      const response = await apiClient.post("/api/ticketing/pm_orders", {
        ...requestParams,
        search: searchTerm.trim(),
        skip,
        limit: rowsPerPage,
      });
      if (fetchSeq !== pmOrdersFetchSeqRef.current) return;

      const fetchedRows = Array.isArray(response?.data?.data) ? response.data.data : [];
      setRows(fetchedRows);
      setHasMorePages(fetchedRows.length === rowsPerPage);

      const extracted = readPmOrdersTotalCount(response?.data);
      if (extracted !== null) {
        lastPmOrdersTotalRef.current = extracted;
        setServerTotalCount(extracted);
        setTotalItems(extracted);
      } else if (lastPmOrdersTotalRef.current !== null) {
        const t = lastPmOrdersTotalRef.current;
        setServerTotalCount(t);
        setTotalItems(t);
      } else {
        setServerTotalCount(null);
        if (currentPage === 1 && fetchedRows.length < rowsPerPage) {
        setTotalItems(fetchedRows.length);
      } else {
          setTotalItems(
            (currentPage - 1) * rowsPerPage +
              fetchedRows.length +
              (fetchedRows.length === rowsPerPage ? rowsPerPage : 0)
          );
        }
      }
    } catch (err: any) {
      if (fetchSeq !== pmOrdersFetchSeqRef.current) return;
      setRows([]);
      setHasMorePages(false);
      setTotalItems(0);
      setServerTotalCount(null);
      lastPmOrdersTotalRef.current = null;
      pmOrdersFpRef.current = "";
      setError(err?.response?.data?.message || "Failed to fetch PM orders");
    } finally {
      if (fetchSeq === pmOrdersFetchSeqRef.current) setIsLoading(false);
    }
  }, [currentPage, rowsPerPage, requestParams, searchTerm]);

  const fetchLocationOptions = useCallback(async () => {
    try {
      const response = await apiClient.post("/api/ticketing/pm_orders", {
        ...locationRequestParams,
        search: "",
        skip: 0,
        limit: 2000,
      });
      const sourceRows: PmOrder[] = Array.isArray(response?.data?.data) ? response.data.data : [];
      const map = new Map<string, string>();
      sourceRows.forEach((row) => {
        const plantId = String(row.planning_plant ?? "").trim();
        if (!plantId) return;
        const plantDesc = String(row.planning_plant_desc ?? "").trim() || plantId;
        if (!map.has(plantId)) map.set(plantId, plantDesc);
      });
      const options = Array.from(map.entries())
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
      setLocationOptions(options);
    } catch {
      setLocationOptions([]);
    }
  }, [locationRequestParams]);

  const filteredRows = useMemo(() => {
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => comparePmOrders(a, b, sortColumn, sortDirection));
  }, [rows, sortColumn, sortDirection]);

  const selectedPlantLabel = useMemo(() => {
    if (!selectedPlant) return "All Locations";
    return locationOptions.find((option) => option.id === selectedPlant)?.label || "All Locations";
  }, [locationOptions, selectedPlant]);

  const pageStartIndex = filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const pageEndIndex = filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + filteredRows.length;
  const totalPages = useMemo(() => {
    if (totalItems > 0) return Math.max(1, Math.ceil(totalItems / rowsPerPage));
    return hasMorePages ? currentPage + 1 : currentPage;
  }, [totalItems, rowsPerPage, hasMorePages, currentPage]);

  useEffect(() => {
    fetchPmOrders();
  }, [fetchPmOrders, refreshKey]);

  useEffect(() => {
    fetchLocationOptions();
  }, [fetchLocationOptions, refreshKey]);

  useEffect(() => {
    void fetchPmBigNumbers();
  }, [fetchPmBigNumbers, refreshKey]);

  useEffect(() => {
    void fetchPmWeeklyChart();
  }, [fetchPmWeeklyChart, refreshKey]);

  /** Default: load current calendar month for PM week line chart when location, time range, or refresh changes. */
  useEffect(() => {
    const seq = ++defaultWeekLoadSeqRef.current;
    let cancelled = false;
    setIsLoadingWeeklyLineChart(true);
    (async () => {
      try {
        const now = new Date();
        const entry = await fetchWeekSeriesEntryForMonth(now);
        if (cancelled || seq !== defaultWeekLoadSeqRef.current) return;
        if (!entry) return;
        setWeekLineMonthSeries([entry]);
      } catch {
        if (!cancelled && seq === defaultWeekLoadSeqRef.current) setWeekLineMonthSeries([]);
      } finally {
        if (!cancelled && seq === defaultWeekLoadSeqRef.current) setIsLoadingWeeklyLineChart(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    planningPlantsForWeekly,
    refreshKey,
    selectedTimeFilter,
    dateRangeFilter,
    selectedPlant,
    fetchWeekSeriesEntryForMonth,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedZone, selectedPlant, selectedTimeFilter, dateRangeFilter, rowsPerPage]);

  useEffect(() => {
    const viewport = pmTableScrollRef.current;
    const mirror = pmTableMirrorRef.current;
    if (!viewport || !mirror) return;

    let thumb = mirror.querySelector(".pm-tickets-table-scroll-mirror-thumb") as HTMLDivElement | null;
    if (!thumb) {
      thumb = document.createElement("div");
      thumb.className = "pm-tickets-table-scroll-mirror-thumb";
      mirror.appendChild(thumb);
    }

    const sync = () => {
      if (!thumb) return;
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const trackWidth = mirror.clientWidth;
      const thumbWidth =
        maxScroll <= 0 ? trackWidth : Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      const left = maxScroll <= 0 ? 0 : (viewport.scrollLeft / maxScroll) * movable;
      thumb.style.width = `${thumbWidth}px`;
      thumb.style.left = `${left}px`;
    };

    const onViewportScroll = () => sync();
    viewport.addEventListener("scroll", onViewportScroll, { passive: true });

    const onTrackClick = (e: MouseEvent) => {
      if (!thumb || e.target === thumb) return;
      const rect = mirror.getBoundingClientRect();
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScroll <= 0) return;
      const trackWidth = mirror.clientWidth;
      const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, (x - thumbWidth / 2) / movable));
      viewport.scrollLeft = ratio * maxScroll;
    };

    const onThumbMouseDown = (e: MouseEvent) => {
      if (!thumb) return;
      e.preventDefault();
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScroll <= 0) return;
      const trackWidth = mirror.clientWidth;
      const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      const startX = e.clientX;
      const startScroll = viewport.scrollLeft;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        viewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

    mirror.addEventListener("click", onTrackClick);
    thumb.addEventListener("mousedown", onThumbMouseDown);

    const ro = new ResizeObserver(sync);
    ro.observe(viewport);
    const tableEl = viewport.querySelector("table");
    if (tableEl) ro.observe(tableEl);
    ro.observe(mirror);
    window.addEventListener("resize", sync);
    requestAnimationFrame(sync);

    return () => {
      viewport.removeEventListener("scroll", onViewportScroll);
      mirror.removeEventListener("click", onTrackClick);
      thumb?.removeEventListener("mousedown", onThumbMouseDown);
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [filteredRows.length, rowsPerPage, currentPage, isLoading, isMultiSelectMode]);

  const onTimeFilterChange = (filter: TimeFilterValue) => {
    if (filter && typeof filter === "object" && "key" in filter && "value" in filter) {
      const [start, end] = String(filter.value).split(",");
      if (start && end) {
        setDateRangeFilter({ start: new Date(start), end: new Date(end) });
        setSelectedTimeFilter(null);
      }
      return;
    }
    setSelectedTimeFilter(filter as string | null);
    setDateRangeFilter(null);
  };

  const handleRefresh = () => {
    setSelectedBu(isLpgUser ? "LPG" : "TAS");
    setSelectedZone(null);
    setSelectedPlant(null);
    setSelectedTimeFilter("1M");
    setDateRangeFilter(null);
    setIsMultiSelectMode(false);
    setSelectedRows([]);
    setCurrentPage(1);
    setTotalItems(0);
    setHasMorePages(false);
    setServerTotalCount(null);
    try {
      localStorage.removeItem("zone");
      localStorage.removeItem("sapId");
    } catch {
      /* ignore */
    }
    setRefreshKey((k) => k + 1);
  };

  const handleCreateTicket = useCallback(
    async (rowsToUse: PmOrder[]) => {
      if (!canCreateTicket) {
        toast.error("You are not allowed to create tickets.");
        return;
      }
      if (rowsToUse.length === 0) {
        toast.error("Please select at least one PM order to create a ticket");
        return;
      }

      const isMultipleRows = rowsToUse.length > 1;
      const uniquePlants = [...new Set(rowsToUse.map((r) => r.planning_plant).filter(Boolean))];
      const uniquePlantDescs = [...new Set(rowsToUse.map((r) => r.planning_plant_desc).filter(Boolean))];

      let sapIdValue: string | string[] = "";
      if (uniquePlants.length === 1) sapIdValue = uniquePlants[0] as string;
      else if (uniquePlants.length > 1) sapIdValue = uniquePlants as string[];

      let locationValue: string | string[] = "";
      let locationIdValue: string | string[] = "";
      if (uniquePlantDescs.length === 1) {
        locationValue = uniquePlantDescs[0] as string;
        locationIdValue = (uniquePlants[0] as string) || (uniquePlantDescs[0] as string);
      } else if (uniquePlantDescs.length > 1) {
        locationValue = uniquePlantDescs as string[];
        locationIdValue = uniquePlants.length > 0 ? (uniquePlants as string[]) : (uniquePlantDescs as string[]);
      }

      const fallbackZone = selectedZone || "";
      const sapIdsForZoneLookup = uniquePlants.filter(Boolean);
      let zoneValue: string | string[] = fallbackZone;

      if (sapIdsForZoneLookup.length > 0) {
        setIsPreparingTicket(true);
        try {
          const payload = {
            bu: [selectedBu || "TAS"],
            zone: [""],
            region: [""],
            sales_area: [""],
            sap_id: sapIdsForZoneLookup,
          };
          const response = await apiClient.post<LocationDataResponse>(
            "/api/ticketing/get_location_data",
            payload,
            { headers: { "Content-Type": "application/json" } }
          );
          const data = response.data;
          if (data?.status !== true) {
            throw new Error(data?.message || "Failed to get zone for selected location");
          }
          const apiZones = [...new Set(normalizeZones(data))];
          if (apiZones.length === 1) {
            zoneValue = apiZones[0];
          } else if (apiZones.length > 1) {
            zoneValue = apiZones;
          }
        } catch (err) {
          console.error("Failed zone autofill from get_location_data:", err);
          toast.error("Could not auto-detect zone from location. Using current zone filter.");
        } finally {
          setIsPreparingTicket(false);
        }
      }

      const initialTicketData: Record<string, unknown> = {
        zone: zoneValue,
        location_name: locationValue,
        location_id: locationIdValue,
        bu: isMultipleRows ? "" : selectedBu,
        region: "",
        sap_id: sapIdValue,
        alert_section: selectedBu === "LPG" ? "LPG" : "TAS",
        ticket_section: "PM Orders",
        linked_rows: rowsToUse,
        order_id: Array.from(
          new Set(
            rowsToUse
              .map((r) => r.order_no)
              .filter((value): value is string => Boolean(value && String(value).trim()))
              .map((value) => String(value).trim())
          )
        ),
        summary: "",
        description: "",
        hideLinkedAlerts: true,
      };

      setTicketInitialData(initialTicketData);
      setIsCreateTicketDialogOpen(true);
      setIsTicketFormMinimized(false);
    },
    [canCreateTicket, selectedBu, selectedZone]
  );

  const handleTicketDialogClose = useCallback(() => {
    setIsCreateTicketDialogOpen(false);
    setIsTicketFormMinimized(false);
    setTicketInitialData(null);
    setIsMultiSelectMode(false);
    setSelectedRows([]);
  }, []);

  const toggleRowSelected = (row: PmOrder) => {
    const key = pmOrderRowKey(row);
    setSelectedRows((prev) => {
      const idx = prev.findIndex((r) => pmOrderRowKey(r) === key);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, row];
    });
  };

  const allFilteredSelected =
    isMultiSelectMode &&
    filteredRows.length > 0 &&
    filteredRows.every((r) => selectedRows.some((s) => pmOrderRowKey(s) === pmOrderRowKey(r)));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const keys = new Set(filteredRows.map(pmOrderRowKey));
      setSelectedRows((prev) => prev.filter((r) => !keys.has(pmOrderRowKey(r))));
    } else {
      setSelectedRows((prev) => {
        const map = new Map(prev.map((r) => [pmOrderRowKey(r), r]));
        filteredRows.forEach((r) => map.set(pmOrderRowKey(r), r));
        return Array.from(map.values());
      });
    }
  };

  const rowIsSelected = (row: PmOrder) => selectedRows.some((s) => pmOrderRowKey(s) === pmOrderRowKey(row));

  return (
    <div className="bg-gray-100 p-1 space-y-1 min-h-screen">
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">PM Orders Table</h1>
          <div className="flex flex-row flex-nowrap items-center justify-end gap-2 w-full lg:w-auto min-w-0 overflow-x-auto [scrollbar-width:thin]">
            <div className="shrink-0 w-max max-w-full">
              <Popover open={openLocationDropdown} onOpenChange={setOpenLocationDropdown}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openLocationDropdown}
                    className="w-42 h-7 text-xs justify-between min-w-[220px]"
                  >
                    {selectedPlantLabel}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0">
                  <Command>
                    <CommandInput placeholder="Search Location..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No location found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all locations"
                          onSelect={() => {
                            setSelectedPlant(null);
                            setOpenLocationDropdown(false);
                          }}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", !selectedPlant ? "opacity-100" : "opacity-0")}
                          />
                          All Locations
                        </CommandItem>
                        {locationOptions.map((option) => (
                          <CommandItem
                            key={option.id}
                            value={`${option.label} ${option.id}`.toLowerCase()}
                            onSelect={() => {
                              setSelectedPlant(option.id);
                              setOpenLocationDropdown(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedPlant === option.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="shrink-0 min-w-0 flex items-center gap-2">
              <Button
                type="button"
                onClick={handleRefresh}
                disabled={isLoading}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white p-1 px-2 rounded-md flex items-center gap-2 h-7 text-xs shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 -mt-3 mb-4 min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 shrink-0 tracking-tight">Summary</h2>
          <div className="shrink-0 min-w-0 w-full sm:w-auto flex items-stretch sm:items-center justify-start sm:justify-end overflow-visible pb-0.5 sm:pb-0">
            <EnhancedTimeFilter
              key={`time-filter-${refreshKey}`}
              selectedFilter={
                dateRangeFilter?.start && dateRangeFilter?.end
                  ? {
                      key: "Date",
                      cond: "equals",
                      value: `${formatDate(dateRangeFilter.start)},${formatDate(dateRangeFilter.end)}`,
                    }
                  : selectedTimeFilter
              }
              onFilterChange={onTimeFilterChange as (filter: string | null) => void}
            />
          </div>
        </div>
        {isLoadingBigNumbers ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Loading summary...
          </div>
        ) : pmBigNumberCards.length > 0 ? (
          <div
            className={cn(
              "grid gap-3 lg:gap-4",
              pmBigNumberCards.length <= 3
                ? "grid-cols-1 sm:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}
          >
            {pmBigNumberCards.map((card, i) => {
              const labelNorm = String(card.label).toLowerCase();
              const isCompletedMetric = /completed/.test(labelNorm);
              const isActiveOrdersMetric =
                !isCompletedMetric &&
                (labelNorm.includes("active orders") ||
                  labelNorm.includes("active order") ||
                  /^active[\s_]/.test(labelNorm.trim()) ||
                  labelNorm.includes("active_orders"));
              const isTotalOrdersMetric =
                !isCompletedMetric &&
                !isActiveOrdersMetric &&
                (labelNorm.includes("total orders") ||
                  labelNorm.includes("total order") ||
                  labelNorm.includes("total_orders"));
              const cardClassName = cn(
                "flex min-h-[5.25rem] min-w-0 flex-col justify-center rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm",
                "transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-md",
                isCompletedMetric
                  ? "border-l-[4px] border-l-emerald-500"
                  : isActiveOrdersMetric
                    ? "border-l-[4px] border-l-blue-500"
                    : isTotalOrdersMetric
                      ? "border-l-[4px] border-l-slate-400"
                      : [
                          "border-l-[4px] border-l-slate-400",
                          "border-l-[4px] border-l-blue-500",
                          "border-l-[4px] border-l-emerald-500",
                        ][i % 3]
              );

              return (
                <div key={`${card.label}-${i}`} className={cardClassName}>
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p
                      className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-gray-500 truncate"
                      title={card.label}
                    >
                  {card.label}
                </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {isTotalOrdersMetric ? (
                        <span
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-50 text-slate-700 shadow-sm"
                          aria-hidden
                        >
                          <ClipboardList className="h-4 w-4" strokeWidth={2} />
                        </span>
                      ) : null}
                      {isActiveOrdersMetric ? (
                        <span
                          className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 shadow-sm"
                          aria-hidden
                        >
                          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/75 motion-reduce:hidden" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                          </span>
                        </span>
                      ) : null}
                      {isCompletedMetric ? (
                        <span
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"
                          aria-hidden
                        >
                          <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                        </span>
                      ) : null}
              </div>
          </div>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[1.65rem]">
                    {card.value}
                  </p>
      </div>
              );
            })}
            </div>
          ) : (
          <p className="text-xs text-gray-400 py-3">No summary metrics returned for the selected period.</p>
          )}
        </div>
        <div className="p-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PM orders..."
              className="h-8 w-full pl-10 pr-8 text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white hover:border-gray-400 transition-all shadow-sm text-gray-700 placeholder:text-gray-400"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>
          {canCreateTicket ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              {!isMultiSelectMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMultiSelectMode(true);
                  }}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <Plus className="mr-2 h-4 w-4 shrink-0" />
                  <span>Create-Ticket</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRows.length === 0) {
                        toast.error("Please select at least one PM order to create a ticket");
                        return;
                      }
                      void handleCreateTicket(selectedRows);
                    }}
                    disabled={isPreparingTicket}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1",
                      selectedRows.length > 0
                        ? "border-green-600 bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500"
                    )}
                  >
                    {isPreparingTicket ? (
                      <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {isPreparingTicket
                        ? "Preparing..."
                        : selectedRows.length === 0
                          ? "Create Ticket"
                          : `Create Ticket (+${selectedRows.length})`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMultiSelectMode(false);
                      setSelectedRows([]);
                    }}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  >
                    <span>Cancel</span>
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-600 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading PM orders...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-red-600 text-sm">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">No PM orders found for selected filters.</div>
        ) : (
          <>
            <div className="border border-gray-200 overflow-hidden bg-white w-full">
            <div ref={pmTableScrollRef} className="pm-tickets-table-scroll overflow-x-scroll min-w-0">
            <table className="w-full min-w-max border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  {isMultiSelectMode ? (
                    <th className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-center font-semibold text-gray-700 text-sm w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Select all visible rows"
                      />
                    </th>
                  ) : null}
                  <PmSortableColumnHeader
                    column="order_no"
                    label="Order No"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                  <PmSortableColumnHeader
                    column="order_type"
                    label="Order Type"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                  <PmSortableColumnHeader
                    column="order_description"
                    label="Order Description"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                  <PmSortableColumnHeader
                    column="planner_group_desc"
                    label="Planner Group"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                  <PmSortableColumnHeader
                    column="system_status_desc"
                    label="System Status"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                  <PmSortableColumnHeader
                    column="equipment_description"
                    label="Equipment"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                  <PmSortableColumnHeader
                    column="planning_plant"
                    label="Planning Plant"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                  <PmSortableColumnHeader
                    column="planning_plant_desc"
                    label="Planning Plant Desc"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                  <PmSortableColumnHeader
                    column="planned_date"
                    label="Planned Date"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSortColumn}
                  />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr
                    key={`${row.order_no}-${index}`}
                    className={`border-t border-gray-100 hover:bg-gray-50 ${isMultiSelectMode && rowIsSelected(row) ? "bg-blue-50/80" : ""}`}
                  >
                    {isMultiSelectMode ? (
                      <td className="px-3 py-2 align-middle text-center text-xs text-gray-800">
                        <input
                          type="checkbox"
                          checked={rowIsSelected(row)}
                          onChange={() => toggleRowSelected(row)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Select order ${row.order_no || index + 1}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{row.order_no || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{row.order_type || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{row.order_description || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{row.planner_group_desc || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{row.system_status_desc || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{row.equipment_description || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{row.planning_plant || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{row.planning_plant_desc || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-800">{formatPlannedDate(row.planned_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div
              ref={pmTableMirrorRef}
              className="pm-tickets-table-scroll-mirror mt-2"
              aria-hidden="true"
            />
            </div>
            <div className="!mt-0 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 border-t border-gray-300 rounded-b-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Show</span>
                <select
                  id="rows-per-page"
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="px-2 py-1 text-sm border-2 border-gray-300 rounded-lg bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors font-medium"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                  <span className="text-sm font-medium text-gray-700">entries</span>
                </div>
                <div className="text-sm font-medium text-gray-700 bg-white px-2 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                  Showing <span className="font-bold text-gray-900">{pageStartIndex}</span> to{" "}
                  <span className="font-bold text-gray-900">{pageEndIndex}</span>
                  {serverTotalCount !== null ? (
                    <>
                      {" "}
                      of <span className="font-bold text-gray-900">{serverTotalCount}</span> entries
                    </>
                  ) : (
                    " entries"
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                          currentPage === pageNum
                            ? "bg-blue-500 text-white"
                            : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={
                    currentPage >= totalPages ||
                    (serverTotalCount === null && !hasMorePages)
                  }
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-800">PM orders by period</h2>
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <label htmlFor="pm-period-range" className="sr-only">
                Period date range
              </label>
              <select
                id="pm-period-range"
                value={pmPeriodRangeKey}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "2025" || v === "2026") setPmPeriodRangeKey(v);
                }}
                className="h-7 min-w-[11rem] rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="PM orders by period date range"
              >
                <option value="2025">Jan 2025 – Dec 2025</option>
                <option value="2026">Jan 2026 – Dec 2026</option>
              </select>
              <Button
                type="button"
                onClick={handleRefreshPmPeriodChart}
                disabled={isLoadingWeeklyChart}
                className="!h-5 !w-5 !min-h-0 !min-w-0 !p-0 bg-blue-600 hover:bg-blue-700 text-white rounded shrink-0 [&_svg]:shrink-0"
                aria-label="Refresh PM orders by period chart"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingWeeklyChart ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-gray-600 mb-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-500" aria-hidden />
            <span>
              Click on a bar to load that month&apos;s data in PM orders by week.
            </span>
          </p>
          {isLoadingWeeklyChart ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Loading chart...
            </div>
          ) : pmWeeklyChartData.length > 0 ? (
            <PmPeriodBarChartAm5
              data={pmWeeklyChartData}
              onBarClick={(name) => {
                const monthStart = parsePeriodLabelToMonthStart(String(name));
                if (monthStart) void handlePeriodBarMonthClick(monthStart);
              }}
            />
          ) : (
            <p className="text-xs text-gray-400 py-6 text-center">No  data  available for the selected filters.</p>
          )}
        </div>

        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-800 shrink-0">PM orders by week</h2>
              {pmWeekChartSelectedMonthsLabel ? (
                <span
                  className="text-xs text-gray-500 font-normal truncate"
                  title={pmWeekChartSelectedMonthsLabel}
                >
                  - {pmWeekChartSelectedMonthsLabel}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              onClick={handleRefreshPmWeekChart}
              disabled={isLoadingWeeklyLineChart}
              className="!h-5 !w-5 !min-h-0 !min-w-0 !p-0 bg-blue-600 hover:bg-blue-700 text-white rounded shrink-0 [&_svg]:shrink-0"
              aria-label="Refresh PM orders by week chart"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingWeeklyLineChart ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {isLoadingWeeklyLineChart ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Loading chart...
            </div>
          ) : mergedWeekLineChartData.length > 0 ? (
            <PmWeekLineChartAm5
              mergedData={mergedWeekLineChartData}
              seriesEntries={weekLineMonthSeries}
              colorForSeries={(s) => weekLineColorForMonth(s.monthStart, pmWeeklyChartData)}
            />
          ) : selectedPlant ? (
            <p className="text-xs text-gray-600 py-8 text-center px-3 leading-relaxed">
              Present month data is not available for the selected location
              {selectedPlantLabel !== "All Locations" ? (
                <>
                  {" "}
                  {/* (<span className="font-semibold text-gray-800">{selectedPlantLabel}</span>). */}
                </>
              ) : (
                "."
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-400 py-6 text-center">No data available for the selected filters.</p>
          )}
        </div>
      </div>

      <TicketDialogModal
        isOpen={isCreateTicketDialogOpen}
        isMinimized={isTicketFormMinimized}
        initialData={ticketInitialData}
        onClose={handleTicketDialogClose}
        onMinimize={() => setIsTicketFormMinimized(true)}
        onRestore={() => setIsTicketFormMinimized(false)}
        ticketSection="PM Orders"
      />

    </div>
  );
}

