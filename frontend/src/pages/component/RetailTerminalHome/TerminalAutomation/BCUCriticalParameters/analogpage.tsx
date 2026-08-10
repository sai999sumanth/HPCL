import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Card, CardContent } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { cn } from "@/@/lib/utils";
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  Building2,
  Wifi,
  WifiOff,
  Table2,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { convertUTCDateToLocalDate } from "@/hooks/useRelativeTime";

const ANALYTICAL_MODEL = "Analog 24 hr window" as const;

export interface AnalogPageProps {
  zone?: string | null;
  plant?: string | null;
}

/** Same as TASPlantCards — resolve display `location_name` for tas_analytics. */
async function resolveLocationNameForTas(zone: string, sapId: string): Promise<string> {
  const s = sapId.trim();
  if (!s) return "";
  const z = zone.trim();
  try {
    const response = await apiClient.post("/api/ticketing/get_location_data", {
      bu: ["TAS"],
      zone: z ? [z] : [""],
      region: [""],
      sales_area: [""],
      sap_id: [""],
    });
    const locations = response?.data?.data?.locations;
    const found = Array.isArray(locations)
      ? locations.find((loc: { sap_id?: string }) => String(loc?.sap_id) === String(s))
      : undefined;
    const raw = found?.name != null ? String(found.name).trim() : "";
    return raw;
  } catch {
    return "";
  }
}

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build POST /api/tasanalytics/tas_analytics body (matches backend contract; filters optional). */
function buildTasAnalyticsPayload(opts: {
  location_name: string;
  zone: string;
  start_date: string;
  end_date: string;
}) {
  return {
    analytical_model: ANALYTICAL_MODEL,
    location_name: opts.location_name,
    interlock_name: "",
    alert_status: "",
    alert_severity: [] as string[],
    zone: opts.zone,
    start_date: opts.start_date,
    end_date: opts.end_date,
    equipment_type: "",
    equipment_name: "",
    download: "",
    truck_number: "",
    filters: [] as { key: string; cond: string; value: string; val?: string }[],
    interlock_category: "",
  };
}

type UiKpi = {
  totalLocations: string | number;
  locationsOnlineLabel: string;
  locationsOnlineSub: string;
  /** Count of depots whose rolled-up Location Health status is OFFLINE (all host tables offline). */
  locationsOfflineLabel: string;
  locationsOfflineSub: string;
  /** Host-table rows with Offline status (across all locations). */
  totalOfflineTables: string | number;
  offlineSub: string;
};

type UiLocation = {
  id: string;
  name: string;
  status: "OFFLINE" | "CRITICAL" | "NO SIGNAL" | "ONLINE" | "UNKNOWN";
  /** Legacy combined line; prefer sapLabel + pendingLabel in UI */
  detail: string;
  sapLabel: string;
  pendingLabel: string;
};

type UiTableRow = {
  hostTable: string;
  statusLabel: string;
  statusTone: "offline" | "pending" | "other";
  lastRecorded: string;
};

type UiBanner = { title: string; body: string } | null;

/** API row under each location (`Analog 24 hr window`). */
type ApiAnalogTable = {
  table_name?: string;
  status?: string;
  last_created_at?: string | null;
};

/** API location entry */
type ApiAnalogLocation = {
  sap_id?: string;
  location_name?: string;
  zone?: string;
  tables?: ApiAnalogTable[];
};

function pickStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normalizeStatus(s: string): UiLocation["status"] {
  const u = s.toUpperCase();
  if (u.includes("OFFLINE")) return "OFFLINE";
  if (u.includes("CRITICAL")) return "CRITICAL";
  if (u.includes("NO SIGNAL") || u.includes("NO_SIGNAL")) return "NO SIGNAL";
  if (u.includes("ONLINE")) return "ONLINE";
  return "UNKNOWN";
}

function isOfflineTableStatus(status: string): boolean {
  return /offline/i.test(status);
}

/** True when this host table is reported Online (not Offline). */
function isOnlineTableStatus(status: string): boolean {
  const s = pickStr(status);
  if (!s) return false;
  return /online/i.test(s) && !isOfflineTableStatus(s);
}

/**
 * Location Health badge: if **any** table is Online → ONLINE; else if **all** are Offline → OFFLINE;
 * otherwise CRITICAL (e.g. pending/SAP only, no Online).
 */
function rollupLocationStatus(tables: ApiAnalogTable[]): UiLocation["status"] {
  const t = tables ?? [];
  if (t.length === 0) return "NO SIGNAL";
  if (t.some((row) => isOnlineTableStatus(pickStr(row.status)))) return "ONLINE";
  if (t.every((row) => isOfflineTableStatus(pickStr(row.status)))) return "OFFLINE";
  return "CRITICAL";
}

function formatLastRecordedToIst(lastRaw: unknown): string {
  if (lastRaw == null || String(lastRaw).trim() === "") return "—";
  try {
    const d = new Date(String(lastRaw));
    if (isNaN(d.getTime())) return pickStr(lastRaw);
    const localDate = convertUTCDateToLocalDate(d);
    return localDate.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return pickStr(lastRaw);
  }
}

function mapApiTableToUiRow(row: ApiAnalogTable, i: number): UiTableRow {
  const st = pickStr(row.status);
  const stUp = st.toUpperCase();
  const tone: UiTableRow["statusTone"] =
    stUp.includes("PENDING") || stUp.includes("SAP")
      ? "pending"
      : stUp.includes("OFFLINE") || stUp.includes("FAIL")
        ? "offline"
        : "other";
  const lastRecorded = formatLastRecordedToIst(row.last_created_at);
  return {
    hostTable: pickStr(row.table_name) || `table-${i}`,
    statusLabel: st || "—",
    statusTone: tone,
    lastRecorded,
  };
}

/** Unwrap axios body: `{ status, data: { now, locations } }` or flat `{ locations }`. */
function unwrapTasAnalyticsPayload(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if ("data" in r && r.data != null && typeof r.data === "object" && !Array.isArray(r.data)) {
    return r.data as Record<string, unknown>;
  }
  return r;
}

function buildKpisFromLocations(locs: ApiAnalogLocation[]): UiKpi {
  /** Same rule as KPI “Locations Online”: count depots with any Online host table. */
  let locationsWithAnyOnline = 0;
  /** Rolled-up OFFLINE only (all tables offline). */
  let locationsWithRollupOffline = 0;
  let totalOfflineTables = 0;
  let totalTables = 0;

  for (const loc of locs) {
    const tables = Array.isArray(loc.tables) ? loc.tables : [];
    let locHasAnyOnline = false;
    for (const t of tables) {
      totalTables++;
      const s = pickStr(t.status);
      if (isOfflineTableStatus(s)) totalOfflineTables++;
      if (isOnlineTableStatus(s)) locHasAnyOnline = true;
    }
    if (locHasAnyOnline) locationsWithAnyOnline++;
    if (rollupLocationStatus(tables) === "OFFLINE") locationsWithRollupOffline++;
  }

  const n = locs.length;
  const onlineLabel =
    n === 0 ? "—" : locationsWithAnyOnline === 0 ? "0" : String(locationsWithAnyOnline);
  const offlineLabel =
    n === 0 ? "—" : locationsWithRollupOffline === 0 ? "0" : String(locationsWithRollupOffline);

  return {
    totalLocations: n || "—",
    locationsOnlineLabel: onlineLabel,
    locationsOnlineSub:
      n === 0
        ? ""
        : locationsWithAnyOnline === 0
          ? "No location has any Online host table"
          : `${locationsWithAnyOnline} location(s) with at least one Online table`,
    locationsOfflineLabel: offlineLabel,
    locationsOfflineSub:
      n === 0
        ? ""
        : locationsWithRollupOffline === 0
          ? "No location has rolled-up Offline status"
          : `${locationsWithRollupOffline} location(s) with all host tables offline`,
    totalOfflineTables: totalTables ? totalOfflineTables : "—",
    offlineSub: "Host tables marked Offline (24 hr window)",
  };
}

type ParsedAnalog = {
  now: string;
  windowHours: number;
  kpis: UiKpi;
  /** One entry per API location — table rows scoped to that depot */
  depots: {
    sap_id: string;
    location_name: string;
    zone: string;
    sidebar: UiLocation;
    tableRows: UiTableRow[];
  }[];
  banner: UiBanner;
};

function parseAnalogWindowResponse(raw: unknown): ParsedAnalog | null {
  const inner = unwrapTasAnalyticsPayload(raw);
  if (!inner) return null;

  const locsRaw = inner.locations;
  if (!Array.isArray(locsRaw) || locsRaw.length === 0) {
    const kpisEmpty: UiKpi = {
      totalLocations: "—",
      locationsOnlineLabel: "—",
      locationsOnlineSub: "",
      locationsOfflineLabel: "—",
      locationsOfflineSub: "",
      totalOfflineTables: "—",
      offlineSub: "Host tables marked Offline (24 hr window)",
    };
    return {
      now: pickStr(inner.now),
      windowHours: Number(inner.window_hours) || 24,
      kpis: kpisEmpty,
      depots: [],
      banner: null,
    };
  }

  const locs = locsRaw as ApiAnalogLocation[];
  const kpis = buildKpisFromLocations(locs);

  const depots = locs.map((loc, i) => {
    const sap_id = pickStr(loc.sap_id) || `sap-${i}`;
    const location_name = pickStr(loc.location_name) || "—";
    const zone = pickStr(loc.zone) || "—";
    const tables = Array.isArray(loc.tables) ? loc.tables : [];
    const status = rollupLocationStatus(tables);
    const sidebar: UiLocation = {
      id: sap_id,
      name: location_name,
      status,
      detail: `${tables.length} tables · ${zone}`,
      sapLabel: sap_id ? `SAP ID: ${sap_id}` : "SAP ID: —",
      pendingLabel: `${tables.length} Tables Pending`,
    };
    const tableRows = tables.map((t, j) => mapApiTableToUiRow(t, j));
    return { sap_id, location_name, zone, sidebar, tableRows };
  });

  const now = pickStr(inner.now);
  const windowHours = Number(inner.window_hours) || 24;

  const banner: UiBanner =
    now || windowHours
      ? {
          title: "Analog window:",
          body: `${windowHours}h rolling window · API time ${now || "—"}`,
        }
      : null;

  return {
    now,
    windowHours,
    kpis,
    depots,
    banner,
  };
}

/** Location Health list — badge colors aligned to reference UI */
function locationCardBadgeClass(status: UiLocation["status"]) {
  switch (status) {
    case "OFFLINE":
      return "border border-red-200/80 bg-red-50 text-red-800 shadow-sm";
    case "CRITICAL":
      return "bg-[#f8bbd9] text-gray-900 border-transparent";
    case "NO SIGNAL":
      return "bg-slate-300/90 text-gray-900 border-transparent";
    case "ONLINE":
      return "border border-emerald-200/80 bg-emerald-50 text-emerald-800";
    default:
      return "bg-slate-200 text-gray-800 border-transparent";
  }
}

/** Detail table status column — pill badges aligned with Location Health tones */
function detailTableStatusBadgeClass(tone: UiTableRow["statusTone"], statusLabel: string) {
  const s = statusLabel ?? "";
  if (tone === "offline") return "border border-red-200/80 bg-red-50 text-red-800";
  if (tone === "pending") return "border border-amber-200/90 bg-amber-100 text-amber-950";
  if (/online/i.test(s)) return "border border-emerald-200/80 bg-emerald-50 text-emerald-800";
  return "bg-slate-200 text-gray-800";
}

function AnalogDetailStatusCell(props: ICellRendererParams<UiTableRow>) {
  const row = props.data;
  if (!row) return null;
  const label = row.statusLabel?.trim() || "—";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase leading-tight tracking-tight",
        detailTableStatusBadgeClass(row.statusTone, label)
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * BCU Critical Parameter — Analog 24 hr window via POST /api/tasanalytics/tas_analytics.
 */
export default function AnalogPage({ zone, plant }: AnalogPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  /** Location Health list filter: toggled via Locations Online / Locations Offline KPI cards. */
  const [locationHealthFilter, setLocationHealthFilter] = useState<"all" | "online" | "offline">("all");
  const [parsed, setParsed] = useState<ParsedAnalog | null>(null);

  const zoneStr = String(zone ?? "").trim();
  const plantStr = String(plant ?? "").trim();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const location_name = await resolveLocationNameForTas(zoneStr, plantStr);
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const payload = buildTasAnalyticsPayload({
        location_name,
        zone: zoneStr,
        start_date: formatDateYmd(start),
        end_date: formatDateYmd(end),
      });

      const { data: body } = await apiClient.post("/api/tasanalytics/tas_analytics", payload);
      const next = parseAnalogWindowResponse(body);
      setParsed(next);
      setLocationHealthFilter("all");
      if (next?.depots?.length) {
        const idx = next.depots.findIndex((d) => String(d.sap_id) === plantStr);
        setSelectedIdx(idx >= 0 ? idx : 0);
      } else {
        setSelectedIdx(0);
      }
    } catch (e) {
      console.error("AnalogPage: tas_analytics failed", e);
      setError("Could not load Analog analytics. Check network or try again.");
      setParsed(null);
    } finally {
      setLoading(false);
    }
  }, [zoneStr, plantStr, refreshToken]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const locationHealthDepotIndices = useMemo(() => {
    if (!parsed?.depots?.length) return [];
    if (locationHealthFilter === "all") return parsed.depots.map((_, i) => i);
    if (locationHealthFilter === "online") {
      return parsed.depots
        .map((d, i) => (d.sidebar.status === "ONLINE" ? i : -1))
        .filter((i) => i >= 0);
    }
    return parsed.depots
      .map((d, i) => (d.sidebar.status === "OFFLINE" ? i : -1))
      .filter((i) => i >= 0);
  }, [parsed, locationHealthFilter]);

  const toggleLocationHealthOnlineFilter = useCallback(() => {
    setLocationHealthFilter((prev) => {
      const next = prev === "online" ? "all" : "online";
      if (next === "online" && parsed?.depots?.length) {
        const cur = parsed.depots[selectedIdx];
        if (cur?.sidebar.status !== "ONLINE") {
          const first = parsed.depots.findIndex((d) => d.sidebar.status === "ONLINE");
          if (first >= 0) setSelectedIdx(first);
        }
      }
      return next;
    });
  }, [parsed, selectedIdx]);

  const toggleLocationHealthOfflineFilter = useCallback(() => {
    setLocationHealthFilter((prev) => {
      const next = prev === "offline" ? "all" : "offline";
      if (next === "offline" && parsed?.depots?.length) {
        const cur = parsed.depots[selectedIdx];
        if (cur?.sidebar.status !== "OFFLINE") {
          const first = parsed.depots.findIndex((d) => d.sidebar.status === "OFFLINE");
          if (first >= 0) setSelectedIdx(first);
        }
      }
      return next;
    });
  }, [parsed, selectedIdx]);

  const activeDepot = parsed?.depots[selectedIdx];
  const tableRows = activeDepot?.tableRows ?? [];
  const kpis = parsed?.kpis;
  const banner = parsed?.banner;

  const detailColumnDefs = useMemo<ColDef<UiTableRow>[]>(
    () => [
      {
        field: "hostTable",
        headerName: "Table name",
        flex: 1.2,
        minWidth: 160,
      },
      {
        field: "statusLabel",
        headerName: "Status",
        flex: 1,
        minWidth: 140,
        cellRenderer: AnalogDetailStatusCell,
        sortable: true,
      },
      {
        field: "lastRecorded",
        headerName: "Last recorded at",
        flex: 1,
        minWidth: 140,
      },
    ],
    []
  );

  /** Same height: Location Health list (left) = details AG Grid (right). */
  const ANALOG_SPLIT_PANEL_H = "h-[min(32rem,56vh)] lg:h-[min(32rem,52vh)]";

  return (
    <div className="flex min-h-0 w-full flex-col rounded-xl border border-gray-200 bg-white p-4 font-sans text-gray-800 antialiased shadow-sm md:p-6">
      <div className="mb-2 flex flex-col gap-2 border-b border-gray-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="-mt-2 text-sm font-semibold leading-tight tracking-tight text-gray-800 md:text-base">
            Analog Data Connectivity Status
          </h1>
        </div>
        <Button
          type="button"
          variant="icon"
          size="icon"
          className="h-6 w-6 shrink-0 -mt-2 rounded-sm border-0 bg-blue-600 p-0 text-xs text-white shadow-sm transition-colors hover:bg-blue-700 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60"
          disabled={loading}
          title="Refresh dashboard data"
          aria-label="Refresh dashboard data"
          onClick={() => setRefreshToken((t) => t + 1)}
        >
          <RefreshCw className={cn("h-3 w-3 text-white", loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50/40 px-3 py-2.5 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-100 bg-white/95 px-6 py-12 shadow-sm backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-8 w-8 shrink-0 animate-spin text-blue-600" />
            <span className="text-xs text-gray-500">Loading analytics…</span>
          </div>
        ) : null}

        <div
          className={cn(
            "min-h-0",
            loading && "pointer-events-none select-none opacity-[0.38]"
          )}
        >
      {/* KPI row — title + subtitle, icon in pastel square, metric */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 !bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
          <CardContent className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase leading-tight tracking-tight text-gray-900">
                  Total Locations
                </p>
                <p className="mt-0.5 text-xs leading-snug text-gray-500">Across all locations</p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums leading-none tracking-tight text-gray-900">
                  {kpis?.totalLocations ?? "—"}
                </p>
              </div>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e8eaf6] text-slate-700"
                aria-hidden
              >
                <Building2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
            </div>
            {/* <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-500">Global network nodes in this snapshot</p> */}
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          aria-pressed={locationHealthFilter === "online"}
          aria-label={
            locationHealthFilter === "online"
              ? "Locations online filter active. Press to show all locations."
              : "Filter location health to online locations only"
          }
          className={cn(
            "overflow-hidden rounded-2xl border border-slate-200/80 !bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] outline-none transition-all",
            "cursor-pointer hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
            locationHealthFilter === "online" && "ring-2 ring-emerald-400/50 ring-offset-1 shadow-[0_4px_14px_rgba(16,185,129,0.12)]"
          )}
          onClick={toggleLocationHealthOnlineFilter}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleLocationHealthOnlineFilter();
            }
          }}
        >
          <CardContent className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase leading-tight tracking-tight text-gray-900">
                  Locations Online
                </p>
                <p className="mt-0.5 text-xs leading-snug text-gray-500">With any online host table</p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums leading-none tracking-tight text-gray-900">
                  {kpis?.locationsOnlineLabel ?? "—"}
                </p>
              </div>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-slate-700"
                aria-hidden
              >
                <Wifi className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
            </div>
            {kpis?.locationsOnlineSub ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-gray-600">{kpis.locationsOnlineSub}</p>
            ) : null}
            {locationHealthFilter === "online" ? (
              <p className="mt-1 text-xs font-semibold text-gray-900">Filter on · click card to show all</p>
            ) : null}
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          aria-pressed={locationHealthFilter === "offline"}
          aria-label={
            locationHealthFilter === "offline"
              ? "Locations offline filter active. Press to show all locations."
              : "Filter location health to offline locations only"
          }
          className={cn(
            "overflow-hidden rounded-2xl border border-slate-200/80 !bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] outline-none transition-all",
            "cursor-pointer hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2",
            locationHealthFilter === "offline" && "ring-2 ring-red-400/50 ring-offset-1 shadow-[0_4px_14px_rgba(239,68,68,0.12)]"
          )}
          onClick={toggleLocationHealthOfflineFilter}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleLocationHealthOfflineFilter();
            }
          }}
        >
          <CardContent className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase leading-tight tracking-tight text-gray-900">
                  Locations Offline
                </p>
                <p className="mt-0.5 text-xs leading-snug text-gray-500">All host tables offline</p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums leading-none tracking-tight text-gray-900">
                  {kpis?.locationsOfflineLabel ?? "—"}
                </p>
              </div>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600"
                aria-hidden
              >
                <WifiOff className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
            </div>
            {kpis?.locationsOfflineSub ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-gray-600">{kpis.locationsOfflineSub}</p>
            ) : null}
            {locationHealthFilter === "offline" ? (
              <p className="mt-1 text-xs font-semibold text-gray-900">Filter on · click card to show all</p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 !bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
          <CardContent className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase leading-tight tracking-tight text-gray-900">
                  Total Offline Tables
                </p>
                {/* <p className="mt-1 text-xs leading-snug text-slate-500">In the 24 hr window</p> */}
                <p className="mt-3 text-3xl font-semibold tabular-nums leading-none tracking-tight text-gray-900">
                  {kpis?.totalOfflineTables ?? "—"}
                </p>
              </div>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fef3c7] text-slate-700"
                aria-hidden
              >
                <Table2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-gray-500">
              {kpis?.offlineSub ?? "Host tables marked Offline (24 hr window)"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert banner — only if API returns a message */}
      {banner && (
        <div className="mb-3 flex gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs leading-snug text-gray-600">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
          <div className="min-w-0 break-all sm:break-normal">
            <span className="font-semibold text-gray-800">{banner.title}</span>{" "}
            <span className="text-gray-500">{banner.body}</span>
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid min-h-0 grid-cols-1 gap-x-2 gap-y-2",
          "lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_auto] lg:items-start lg:gap-x-3"
        )}
      >
        {/* Row 1: aligned section headings (same row on lg) */}
        <h2 className="order-1 mb-0 text-sm font-bold uppercase leading-tight tracking-tight text-gray-900 antialiased lg:col-start-1 lg:row-start-1 lg:self-end">
          Location Health
        </h2>
        <div className="order-3 min-w-0 shrink-0 lg:col-start-2 lg:row-start-1 lg:self-end">
          {activeDepot?.location_name ? (
            <p className="m-0 min-w-0 truncate text-xs font-semibold leading-snug text-gray-900 md:text-sm">
              {activeDepot.location_name}
            </p>
          ) : (
            <p className="m-0 text-xs text-gray-600">Depot detail</p>
          )}
        </div>

        {/* Row 2: scrollable panels */}
        <aside
          className={cn(
            "order-2 flex h-full min-h-0 min-w-0 flex-col lg:col-start-1 lg:row-start-2",
            ANALOG_SPLIT_PANEL_H
          )}
        >
          <style>
            {`
              /* Hidden until hover; narrow bar (WebKit + Firefox) */
              .analog-location-health-scroll {
                scrollbar-gutter: auto;
                scrollbar-width: none;
              }
              .analog-location-health-scroll:hover {
                scrollbar-width: thin;
                scrollbar-color: rgb(203 213 225) rgb(248 250 252);
              }
              .analog-location-health-scroll::-webkit-scrollbar {
                -webkit-appearance: none;
                appearance: none;
                width: 0;
              }
              .analog-location-health-scroll:hover::-webkit-scrollbar {
                width: 7px;
              }
              .analog-location-health-scroll:hover::-webkit-scrollbar-track {
                margin: 4px 0;
                background: rgb(248 250 252);
                border-radius: 6px;
                border: 1px solid rgb(241 245 249);
              }
              .analog-location-health-scroll:hover::-webkit-scrollbar-thumb {
                background: rgb(203 213 225);
                border-radius: 6px;
                border: 2px solid rgb(248 250 252);
                background-clip: padding-box;
                min-height: 32px;
              }
              .analog-location-health-scroll:hover::-webkit-scrollbar-thumb:hover {
                background: rgb(186 199 216);
              }
            `}
          </style>
          <div
            role="region"
            aria-label="Location list"
            className={cn(
              "analog-location-health-scroll min-h-0 w-full flex-1 overflow-x-hidden overflow-y-scroll overscroll-contain rounded-xl border border-slate-100/90 bg-white shadow-sm"
            )}
          >
            <div className="pr-1">
              {!parsed?.depots?.length && !loading ? (
                <p className="px-4 py-8 text-center text-xs text-gray-500">No locations in API response.</p>
              ) : locationHealthDepotIndices.length === 0 && !loading ? (
                <p className="px-4 py-8 text-center text-xs text-gray-500">
                  {locationHealthFilter === "offline"
                    ? "No locations with Offline status in this snapshot."
                    : "No locations with Online status in this snapshot."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-200/50">
                  {locationHealthDepotIndices.map((depotIdx) => {
                    const depot = parsed?.depots[depotIdx];
                    if (!depot) return null;
                    const loc = depot.sidebar;
                    return (
                    <li key={loc.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedIdx(depotIdx)}
                        className={cn(
                          "relative flex w-full items-start gap-2 py-2.5 pl-3 pr-2.5 text-left outline-none transition-colors sm:gap-3 sm:pl-3.5 sm:pr-3",
                          selectedIdx === depotIdx
                            ? "bg-white before:absolute before:inset-y-0 before:left-0 before:w-[5px] before:bg-red-500 hover:bg-gray-100"
                            : "bg-white hover:bg-gray-100"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold leading-tight text-gray-800">{loc.name}</div>
                          <div className="mt-0.5 font-mono text-xs leading-snug text-gray-500">{loc.sapLabel}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                          {loc.status === "OFFLINE" ? (
                            <span className="text-xs font-semibold uppercase tracking-tight text-red-700">
                              OFFLINE
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-tight",
                                locationCardBadgeClass(loc.status)
                              )}
                            >
                              {loc.status}
                            </span>
                          )}
                          {/* <span className="max-w-[9.5rem] text-xs leading-snug text-gray-600 sm:max-w-none">
                            {loc.pendingLabel}
                          </span> */}
                        </div>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>

        <div
          className={cn(
            "order-4 flex h-full min-h-0 min-w-0 flex-col lg:col-start-2 lg:row-start-2",
            ANALOG_SPLIT_PANEL_H
          )}
        >
          <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
              <style>
                {`
                  /* Same horizontal scroll behavior as BCULoading.tsx AgGrid */
                  .bcu-loading-table-invisible-scroll .ag-body-viewport,
                  .bcu-loading-table-invisible-scroll .ag-body-viewport-wrapper,
                  .bcu-loading-table-invisible-scroll .ag-center-cols-viewport,
                  .bcu-loading-table-invisible-scroll .ag-body-vertical-scroll-viewport {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                  }
                  .bcu-loading-table-invisible-scroll .ag-body-viewport::-webkit-scrollbar,
                  .bcu-loading-table-invisible-scroll .ag-body-viewport-wrapper::-webkit-scrollbar,
                  .bcu-loading-table-invisible-scroll .ag-center-cols-viewport::-webkit-scrollbar,
                  .bcu-loading-table-invisible-scroll .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
                    display: none;
                  }
                  .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll.ag-scrollbar-invisible,
                  .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                    opacity: 1 !important;
                    visibility: visible !important;
                    position: relative !important;
                    bottom: auto !important;
                  }
                  .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer {
                    scrollbar-width: thin !important;
                    -ms-overflow-style: auto !important;
                    min-height: 12px;
                  }
                  .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar {
                    height: 10px !important;
                    display: block !important;
                  }
                  .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar-track,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar-track {
                    background: #e5e7eb;
                    border-radius: 4px;
                  }
                  .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar-thumb,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar-thumb {
                    background: #6b7280;
                    border-radius: 4px;
                  }
                  .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar-thumb:hover,
                  .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar-thumb:hover {
                    background: #4b5563;
                  }
                  /* Larger type in the details grid */
                  .analog-detail-table.ag-theme-alpine {
                    --ag-font-size: 13px;
                    --ag-header-height: 30px;
                    --ag-row-height: 30px;
                    --ag-cell-horizontal-padding: 6px;
                  }
                  .analog-detail-table.ag-theme-alpine .ag-header-cell-label,
                  .analog-detail-table.ag-theme-alpine .ag-header-cell-text {
                    font-size: 13px;
                  }
                `}
              </style>
              <div
                className="analog-detail-table bcu-loading-table-invisible-scroll ag-theme-alpine min-h-0 w-full flex-1 [&_.ag-root-wrapper]:h-full"
                style={{ flex: "1 1 0%", minHeight: 0, height: "100%" }}
              >
                <AgGridReact<UiTableRow>
                  columnDefs={detailColumnDefs}
                  rowData={tableRows}
                  defaultColDef={{
                    sortable: true,
                    resizable: true,
                    filter: false,
                  }}
                  domLayout="normal"
                  headerHeight={30}
                  rowHeight={30}
                  alwaysShowHorizontalScroll
                  suppressCellFocus
                  enableCellTextSelection
                  suppressContextMenu
                  suppressMenuHide
                  animateRows
                  getRowId={(p) =>
                    `${String(p.data?.hostTable ?? "")}::${String(p.data?.lastRecorded ?? "")}`
                  }
                  overlayNoRowsTemplate='<span class="ag-overlay-no-rows-center text-xs text-gray-500">No table rows in API response for this model.</span>'
                />
              </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
