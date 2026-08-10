import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ZoneGroupedBarChart } from "@/components/widgets/zone-grouped-bar";
import { apiClient } from "@/services/apiClient";
import { cn } from "@/@/lib/utils";
import { Loader2, RotateCcw, Maximize2, Minimize2, ArrowLeft } from "lucide-react";
import NoDataDisplay from "@/components/common/NoDataDisplay";
import PerformanceScoreLineChart from "./PerformanceScoreLineChart";

const PLANT_MONTH_ZONE_BAR_CHART_PROPS = {
  xAxisLabelRotation: -90,
  scrollbarCategoryThreshold: 10,
} as const;

/** LPG Operations uses this key for the date range on charts (`"DATE"` with quotes). */
const LPQ_CHARTS_DATE_FILTER_KEY = '"DATE"';

const API_PERFORMANCE_SCORE_TREND = "/api/performancescore/performance_score_trend";
const API_PERFORMANCE_SCORE_MONTHLY_TREND = "/api/performancescore/performance_score_monthly_trend";

/** Preset codes for `created_at` + `date_filter` (Terminal / performance APIs). */
export type TimeFilter = "t" | "1d" | "1w" | "15d" | "1m" | "3m";

/** LPG Operations top-bar presets (TDY, YDY, 1W, …). `null` = custom date range. */
export type LpgTimeRangePreset = "tdy" | "ydy" | "1w" | "15d" | "1m" | null;

/** Map LPG Operations time buttons → `created_at` `date_filter` value. */
export function lpgTimePresetToTimeFilter(preset: LpgTimeRangePreset): TimeFilter {
  switch (preset) {
    case "tdy":
      return "t";
    case "ydy":
      return "1d";
    case "1w":
      return "1w";
    case "15d":
      return "15d";
    case "1m":
      return "1m";
    case null:
    default:
      return "1m";
  }
}

/** `{ key: "created_at", cond: "date_filter", value: TimeFilter }` */
export type PerformanceScoreTrendFilterEntry = {
  key: string;
  cond: string;
  value: string;
};

function buildCreatedAtFilter(timeFilter: TimeFilter): PerformanceScoreTrendFilterEntry {
  return {
    key: "created_at",
    cond: "date_filter",
    value: timeFilter,
  };
}

/** Daily → `performance_score_trend`: `created_at` + screen filters. */
function buildDailyPerformancePayload(
  bu: string,
  timeFilter: TimeFilter,
  filters: Array<{ key: string; cond: string; value: string }>,
  crossFilters: Array<{ key: string; cond: string; value: string }>
): {
  bu: string;
  filters: PerformanceScoreTrendFilterEntry[];
  cross_filters: PerformanceScoreTrendFilterEntry[];
  drill_state: string;
} {
  const stripDate = (items: Array<{ key: string; cond: string; value: string }>) =>
    items.filter((f) => f.key !== LPQ_CHARTS_DATE_FILTER_KEY);

  const filtersNoDate = stripDate(filters ?? []);
  const crossNoDate = stripDate(crossFilters ?? []);
  const createdAt = buildCreatedAtFilter(timeFilter);

  return {
    bu,
    filters: [createdAt, ...filtersNoDate],
    cross_filters: crossNoDate,
    drill_state: "",
  };
}

/** Monthly API returns `overall_data`, `zone_data`, `location_data` in one response — fetch once with empty filters. */
function buildMonthlyPerformancePayload(bu: string): {
  bu: string;
  filters: PerformanceScoreTrendFilterEntry[];
  cross_filters: PerformanceScoreTrendFilterEntry[];
  drill_state: string;
} {
  return { bu, filters: [], cross_filters: [], drill_state: "" };
}

/** Monthly trend API row shapes (score only plotted; `national_score` ignored). */
export type MonthlyScoreOverallRow = { month_date: string; score: number; national_score?: number };
export type MonthlyScoreZoneRow = MonthlyScoreOverallRow & { zone: string };
export type MonthlyScoreLocationRow = MonthlyScoreOverallRow & {
  location: string;
  sap_id: string;
  zone: string;
};

export type MonthlyPerformanceScoreApiResponse = {
  status?: boolean;
  message?: string;
  overall_data?: MonthlyScoreOverallRow[];
  zone_data?: MonthlyScoreZoneRow[];
  location_data?: MonthlyScoreLocationRow[];
  date_range?: { start_date: string; end_date: string };
  monthly_data?: { month_date: string; score: number; national_score?: number };
};

/** Same as Daily Productivity — "2025-09-01" → "Sep 2025" */
function formatMonthLabel(monthDate: string): string {
  try {
    const d = new Date(monthDate);
    const mon = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    return `${mon} ${year}`;
  } catch {
    return monthDate;
  }
}

/** Overall monthly: line chart (single `Score` series). */
function transformOverallScoreDataToLineChart(
  data: MonthlyScoreOverallRow[] | undefined
): { chartData: Record<string, unknown>[]; groups: string[] } | null {
  if (!data?.length) return null;
  const chartData = [...data]
    .sort((a, b) => new Date(a.month_date).getTime() - new Date(b.month_date).getTime())
    .map((d) => ({
      cat: d.month_date,
      label: formatMonthLabel(d.month_date),
      Score: Number(Number(d.score).toFixed(2)),
    }));
  return { chartData, groups: ["Score"] };
}

/** Zone monthly: grouped bars — one stack per month, one series per zone (`score` only). Mirrors `transformZoneDataToChart` in Daily Productivity. */
function transformMonthlyZoneDataToBarChart(
  data: MonthlyScoreZoneRow[] | undefined
): { chartData: Record<string, unknown>[]; groups: string[] } {
  if (!data?.length) return { chartData: [], groups: [] };
  const dates = [...new Set(data.map((d) => String(d.month_date).trim()))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const rawZones = [...new Set(data.map((d) => String(d.zone).trim()))].sort();
  const groups = rawZones.map(formatGroupName);
  const zoneToDisplay = new Map(rawZones.map((z, i) => [z, groups[i]!]));
  const chartData = dates.map((date) => {
    const row: Record<string, unknown> = {
      cat: date,
      label: formatMonthLabel(date),
    };
    rawZones.forEach((z) => {
      const display = zoneToDisplay.get(z)!;
      const item = data.find(
        (d) => String(d.month_date).trim() === date && String(d.zone).trim() === z
      );
      const val = item?.score;
      row[display] = val != null ? Number(Number(val).toFixed(2)) : null;
    });
    return row;
  });
  return { chartData, groups };
}

/** Plant drill: one row per month, one column per plant (location) — `score` only. Mirrors `transformLocationDataByZoneToChart` in Daily Productivity. */
function transformMonthlyLocationByZoneToBarChart(
  data: MonthlyScoreLocationRow[] | undefined,
  zone: string
): { chartData: Record<string, unknown>[]; groups: string[] } {
  if (!data?.length) return { chartData: [], groups: [] };
  const zoneNorm = zone.trim().toUpperCase();
  const zoneData = data.filter((d) => String(d.zone).trim().toUpperCase() === zoneNorm);
  if (!zoneData.length) return { chartData: [], groups: [] };
  const dateStrings = [...new Set(zoneData.map((d) => String(d.month_date).trim()))];
  const dates = dateStrings.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const plantKeys = [...new Set(zoneData.map((d) => d.location || d.sap_id || "—"))].sort();
  const groups = plantKeys.map((p) => formatGroupName(p));
  const plantToDisplay = new Map(plantKeys.map((p, i) => [p, groups[i]!]));
  const chartData = dates.map((date) => {
    const row: Record<string, unknown> = {
      cat: date,
      label: formatMonthLabel(date),
    };
    plantKeys.forEach((plantName) => {
      const display = plantToDisplay.get(plantName)!;
      const item = zoneData.find(
        (d) =>
          String(d.month_date).trim() === date &&
          (d.location || d.sap_id || "—") === plantName
      );
      const val = item?.score;
      row[display] = val != null ? Number(Number(val).toFixed(2)) : null;
    });
    return row;
  });
  return { chartData, groups };
}

/** Build chart series from full monthly API payload (client-side overall / zone / plant). */
function parseMonthlyPerformanceScoreBundle(
  res: unknown,
  scopeMode: "overall" | "zone",
  drilldown: { zone: string; monthCat: string } | null
): { chartData: Record<string, unknown>[]; groups: string[] } | null {
  const payload = unwrapPayload(res) as MonthlyPerformanceScoreApiResponse | null;
  if (!payload || typeof payload !== "object") return null;

  if (scopeMode === "overall") {
    return transformOverallScoreDataToLineChart(payload.overall_data);
  }
  if (scopeMode === "zone" && !drilldown) {
    const { chartData, groups } = transformMonthlyZoneDataToBarChart(payload.zone_data);
    return chartData.length && groups.length ? { chartData, groups } : null;
  }
  if (scopeMode === "zone" && drilldown) {
    const { chartData, groups } = transformMonthlyLocationByZoneToBarChart(
      payload.location_data,
      drilldown.zone
    );
    return chartData.length && groups.length ? { chartData, groups } : null;
  }
  return null;
}

/** Same pattern as Daily Productivity trend — zone vs plant drill level */
function DrillStateIndicator({ drillLevel }: { drillLevel: number }) {
  const states = ["Zone", "Plant"];
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillLevel]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full ${index === drillLevel ? "bg-blue-600" : "bg-gray-300"}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Same as other LPG charts — shorten labels on bars / legend. */
function stripLPGPlantFromLabel(str: string): string {
  if (!str || typeof str !== "string") return str;
  const s = str.trim();
  return (
    s
      .replace(/^LPG\s+Plant\s*(-\s*)?/i, "")
      .replace(/\s*LPG\s+Plant\s*$/i, "")
      .trim() || s
  );
}

function formatGroupName(name: string): string {
  return stripLPGPlantFromLabel(name).toUpperCase();
}

function isFiniteNumber(v: unknown): boolean {
  if (typeof v === "number" && !Number.isNaN(v)) return Number.isFinite(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    return Number.isFinite(n);
  }
  return false;
}

function findPeriodKey(row: Record<string, unknown>): string | null {
  const candidates = [
    "month_date",
    "month",
    "Month",
    "date",
    "period",
    "label",
    "time",
    "year_month",
    "YearMonth",
  ];
  for (const c of candidates) {
    if (c in row && row[c] != null && String(row[c]).trim() !== "") return c;
  }
  const keys = Object.keys(row);
  const strKey = keys.find((k) => {
    const v = row[k];
    return typeof v === "string" && /^\d{4}-\d{2}/.test(v);
  });
  return strKey ?? keys[0] ?? null;
}

function findZoneKey(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row);
  const exact = keys.find((k) => /^(zone|Zone|zone_name|ZONE)$/i.test(k));
  if (exact) return exact;
  return keys.find((k) => /zone/i.test(k)) ?? null;
}

/** Prefer `score` / `performance_score`; never use `national_score`. */
function findScoreKey(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row).filter((k) => !/national_score/i.test(k));
  const exactScore = keys.find((k) => /^score$/i.test(k));
  if (exactScore) return exactScore;
  const preferred = keys.find((k) =>
    /^(performance_score|avg_score|score)$/i.test(k)
  );
  if (preferred) return preferred;
  const fallback = keys.find(
    (k) => /score|index|value|performance/i.test(k) && !/national/i.test(k)
  );
  return fallback ?? null;
}

function shortLabel(period: string): string {
  const s = String(period).trim();
  if (s.length <= 14) return s;
  return s.slice(0, 12) + "…";
}

function stripNationalScoreFromRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const o = { ...r };
    for (const k of Object.keys(o)) {
      if (/national_score/i.test(k)) delete o[k];
    }
    return o;
  });
}

/** Unwrap axios / nested { data } from performance score APIs. */
function unwrapPayload(res: unknown): unknown {
  if (res == null) return null;
  let cur: unknown = (res as Record<string, unknown>).data ?? res;
  if (cur && typeof cur === "object" && !Array.isArray(cur) && "data" in (cur as object)) {
    const inner = (cur as { data?: unknown }).data;
    if (inner !== undefined) cur = inner;
  }
  return cur;
}

function collectArrayCandidates(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  const keys = [
    "trend",
    "monthly_scores",
    "rows",
    "series",
    "zone_trend",
    "performance_trend",
    "data_points",
    "chart_data",
    "result",
    "items",
  ];
  for (const k of keys) {
    if (Array.isArray(o[k])) return o[k] as unknown[];
  }
  if (Array.isArray(o.zones)) {
    const flat: unknown[] = [];
    for (const z of o.zones as Record<string, unknown>[]) {
      if (z && typeof z === "object" && Array.isArray((z as { months?: unknown[] }).months)) {
        const zoneName = String((z as { zone?: string; Zone?: string }).zone ?? (z as { Zone?: string }).Zone ?? "");
        for (const m of (z as { months: Record<string, unknown>[] }).months) {
          flat.push({ ...m, zone: zoneName || (m as { zone?: string }).zone });
        }
      }
    }
    if (flat.length) return flat;
  }
  return null;
}

function isNumericColumn(rows: Record<string, unknown>[], key: string, minRatio = 0.5): boolean {
  if (!rows.length) return false;
  let ok = 0;
  for (const r of rows) {
    const v = r[key];
    if (v == null || v === "") continue;
    if (isFiniteNumber(v)) ok++;
  }
  return ok / rows.length >= minRatio;
}

function widePivotChart(rows: Record<string, unknown>[]): { chartData: Record<string, unknown>[]; groups: string[] } | null {
  if (!rows.length) return null;
  const periodKey = findPeriodKey(rows[0]);
  if (!periodKey) return null;
  const keys = Object.keys(rows[0]).filter((k) => k !== periodKey);
  const skip = new Set(["id", "sap_id", "bu", "BU", "status", "name", "plant", "Plant"]);
  const groupKeys = keys
    .filter(
      (k) =>
        !skip.has(k) &&
        !/national_score/i.test(k) &&
        isNumericColumn(rows, k, 0.4)
    )
    .sort();
  if (groupKeys.length === 0) return null;
  const groups = groupKeys.map(formatGroupName);
  const keyToDisplay = new Map(groupKeys.map((k, i) => [k, groups[i]!]));
  const chartData = rows.map((row) => {
    const cat = String(row[periodKey] ?? "");
    const out: Record<string, unknown> = {
      cat,
      label: shortLabel(cat),
    };
    groupKeys.forEach((k) => {
      const display = keyToDisplay.get(k)!;
      const v = row[k];
      const n = typeof v === "number" ? v : parseFloat(String(v));
      out[display] = Number.isFinite(n) ? Number(n.toFixed(2)) : null;
    });
    return out;
  });
  return { chartData, groups };
}

function longPivotChart(rows: Record<string, unknown>[]): { chartData: Record<string, unknown>[]; groups: string[] } | null {
  const periodKey = findPeriodKey(rows[0]);
  const zoneKey = findZoneKey(rows[0]);
  const scoreKey = findScoreKey(rows[0]);
  if (!periodKey || !zoneKey || !scoreKey) return null;
  const periods = [...new Set(rows.map((r) => String(r[periodKey] ?? "").trim()))].filter(Boolean);
  const rawZones = [...new Set(rows.map((r) => String(r[zoneKey] ?? "").trim()))].filter(Boolean);
  if (!periods.length || !rawZones.length) return null;
  const zoneToDisplay = new Map(rawZones.map((z) => [z, formatGroupName(z)]));
  const displayZones = [...new Set(rawZones.map((z) => zoneToDisplay.get(z)!))].sort();
  const chartData = periods.map((cat) => {
    const row: Record<string, unknown> = { cat, label: shortLabel(cat) };
    displayZones.forEach((dz) => {
      const rawZ = rawZones.find((z) => zoneToDisplay.get(z) === dz);
      const item = rawZ
        ? rows.find(
            (r) =>
              String(r[periodKey]).trim() === cat &&
              String(r[zoneKey]).trim() === rawZ
          )
        : undefined;
      const v = item ? item[scoreKey] : undefined;
      const n = typeof v === "number" ? v : v != null ? parseFloat(String(v)) : NaN;
      row[dz] = Number.isFinite(n) ? Number(n.toFixed(2)) : null;
    });
    return row;
  });
  return { chartData, groups: displayZones };
}

function singleSeriesChart(rows: Record<string, unknown>[]): { chartData: Record<string, unknown>[]; groups: string[] } | null {
  const periodKey = findPeriodKey(rows[0]);
  const scoreKey = findScoreKey(rows[0]);
  if (!periodKey || !scoreKey) return null;
  const g = "Score";
  const chartData = rows.map((row) => {
    const cat = String(row[periodKey] ?? "");
    const v = row[scoreKey];
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    return {
      cat,
      label: shortLabel(cat),
      [g]: Number.isFinite(n) ? Number(n.toFixed(2)) : null,
    };
  });
  return { chartData, groups: [g] };
}

/**
 * Turn performance_score_trend API payload into ZoneGroupedBarChart series.
 * Supports: long (period+zone+score), wide (period + numeric columns per zone), or single score column.
 */
export function parsePerformanceScoreTrendResponse(res: unknown): {
  chartData: Record<string, unknown>[];
  groups: string[];
} | null {
  const payload = unwrapPayload(res);
  const arr = collectArrayCandidates(payload);
  if (!arr?.length || typeof arr[0] !== "object" || arr[0] === null) {
    return null;
  }
  const rows = stripNationalScoreFromRows(arr as Record<string, unknown>[]);

  const zk = findZoneKey(rows[0]);
  const sk = findScoreKey(rows[0]);
  const pk = findPeriodKey(rows[0]);
  if (zk && sk && pk) {
    const long = longPivotChart(rows);
    if (long && long.groups.length) return long;
  }

  const wide = widePivotChart(rows);
  if (wide && wide.groups.length) return wide;

  const single = singleSeriesChart(rows);
  if (single && single.groups.length) return single;

  return null;
}

export interface LPGPerformanceScoreTrendProps {
  /** Business unit — LPG Operations uses `"LPG"`. */
  bu?: string;
  /** Card heading — e.g. per-BU KPI dashboard titles. */
  chartTitle?: string;
  filters?: Array<{ key: string; cond: string; value: string }>;
  crossFilters?: Array<{ key: string; cond: string; value: string }>;
  /** From LPG Operations TDY / YDY / 1W / … — drives `created_at` date_filter. Omitted → TDY; `null` = custom range → `1m`. */
  timeRangePreset?: LpgTimeRangePreset;
}

const PerformanceScoreTrend = ({
  bu = "LPG",
  chartTitle = "Performance Score Index Trend",
  filters = [],
  crossFilters = [],
  timeRangePreset,
}: LPGPerformanceScoreTrendProps) => {
  const timeFilter = useMemo(() => {
    if (timeRangePreset === undefined) return lpgTimePresetToTimeFilter("tdy");
    return lpgTimePresetToTimeFilter(timeRangePreset);
  }, [timeRangePreset]);

  const [periodView, setPeriodView] = useState<"daily" | "monthly">("daily");
  const [scopeMode, setScopeMode] = useState<"overall" | "zone">("overall");
  const [drilldownPerf, setDrilldownPerf] = useState<{ zone: string; monthCat: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (periodView === "daily") {
      setDrilldownPerf(null);
      setScopeMode("overall");
    }
  }, [periodView]);

  useEffect(() => {
    if (scopeMode === "overall") {
      setDrilldownPerf(null);
    }
  }, [scopeMode]);

  const showLineChart =
    periodView === "daily" || (periodView === "monthly" && scopeMode === "overall");
  const showZoneBarChart = periodView === "monthly" && scopeMode === "zone";

  const monthlySummaryRow = useMemo(() => {
    if (periodView !== "monthly" || !rawResponse) return null;
    const p = unwrapPayload(rawResponse) as MonthlyPerformanceScoreApiResponse | null;
    return p?.monthly_data ?? null;
  }, [periodView, rawResponse]);

  /**
   * Stable key so `fetchTrend` is not recreated when unrelated parent state churns.
   * Monthly API ignores filters/cross_filters — key only `monthly:${bu}` so zone/date bar changes do not refetch monthly.
   * Daily encodes filters + cross_filters so real changes still refetch.
   */
  const performanceFetchKey = useMemo(
    () =>
      periodView === "monthly"
        ? `monthly:${bu}`
        : JSON.stringify({
            bu,
            timeFilter,
            filters: filters ?? [],
            crossFilters: crossFilters ?? [],
          }),
    [periodView, bu, timeFilter, filters, crossFilters]
  );

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (periodView === "monthly") {
        const payload = buildMonthlyPerformancePayload(bu);
        const response = await apiClient.post(API_PERFORMANCE_SCORE_MONTHLY_TREND, payload);
        const data = response?.data ?? response;
        const body = data as MonthlyPerformanceScoreApiResponse | undefined;
        if (body && typeof body === "object" && body.status === false) {
          setError(body.message || "Monthly performance score request failed");
          setRawResponse(null);
          return;
        }
        setRawResponse(data);
        return;
      }
      const payload = buildDailyPerformancePayload(bu, timeFilter, filters ?? [], crossFilters ?? []);
      const response = await apiClient.post(API_PERFORMANCE_SCORE_TREND, payload);
      const data = response?.data ?? response;
      setRawResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load performance trend");
      setRawResponse(null);
    } finally {
      setLoading(false);
    }
  }, [periodView, performanceFetchKey]);

  useEffect(() => {
    /* KPI bar applies TDY in a follow-up effect — avoid a duplicate daily call with empty `cross_filters`. */
    if (periodView === "daily" && crossFilters.length === 0) {
      return;
    }
    void fetchTrend();
  }, [fetchTrend, periodView]);

  /** Daily: generic trend parse. Monthly: `overall_data` / `zone_data` / `location_data` bundle (same pattern as Daily Productivity monthly). */
  const parsed = useMemo(() => {
    if (periodView === "monthly") {
      return parseMonthlyPerformanceScoreBundle(rawResponse, scopeMode, drilldownPerf);
    }
    return parsePerformanceScoreTrendResponse(rawResponse);
  }, [periodView, rawResponse, scopeMode, drilldownPerf]);

  const zoneBarClick =
    periodView === "monthly" && scopeMode === "zone" && !drilldownPerf
      ? (categoryValue: string, groupName: string) =>
          setDrilldownPerf({ zone: groupName, monthCat: categoryValue })
      : undefined;

  const chartBody = (
    <>
      {loading && (
        <div className="flex items-center justify-center h-full min-h-[320px] text-gray-500 gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}
      {!loading && error && (
        <div className="h-[200px] flex items-center justify-center text-red-600 text-sm border border-dashed rounded-md">
          {error}
        </div>
      )}
      {!loading && !error && parsed && parsed.chartData.length > 0 && parsed.groups.length > 0 && showLineChart && (
        <div className={cn("w-full", isExpanded && "flex-1 min-h-0 flex flex-col")}>
          <PerformanceScoreLineChart
            chartData={parsed.chartData}
            groups={parsed.groups}
            categoryField="cat"
            categoryLabelField="label"
            valueSuffix="score"
            height={isExpanded ? 0 : 350}
            className={cn("w-full", isExpanded && "flex-1 min-h-[400px]")}
          />
        </div>
      )}
      {!loading && !error && parsed && parsed.chartData.length > 0 && parsed.groups.length > 0 && showZoneBarChart && (
        <div className={cn("w-full", isExpanded && "flex-1 min-h-0 flex flex-col")}>
          <ZoneGroupedBarChart
            {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
            chartData={parsed.chartData}
            groups={parsed.groups}
            categoryField="cat"
            categoryLabelField="label"
            valueSuffix="score"
            showLegend
            height={isExpanded ? 0 : 350}
            className={cn("w-full", isExpanded && "flex-1 min-h-[400px]")}
            onBarClick={zoneBarClick}
          />
        </div>
      )}
      {!loading && !error && (!parsed || parsed.chartData.length === 0) && (
      < NoDataDisplay/>
      )}
    </>
  );

  return (
    <>
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setIsExpanded(false)}
          aria-hidden
        />
      )}
      <Card
        className={cn(
          "border border-gray-200 shadow-sm transition-all duration-300",
          isExpanded && "fixed inset-4 z-50 flex flex-col overflow-hidden h-[calc(100vh-2rem)] shadow-2xl"
        )}
      >
        <CardHeader className="pb-0 p-2 flex-shrink-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex-shrink-0 flex flex-col min-w-0">
                <CardTitle className="text-sm font-bold text-gray-800">
                  {chartTitle}
                  {drilldownPerf && (
                    <span className="text-gray-600 font-normal ml-1">
                      — Zone: {drilldownPerf.zone} (plants by month)
                    </span>
                  )}
                </CardTitle>
               
              </div>
              <div className="flex-shrink-0 flex items-center gap-2 flex-wrap justify-end">
                <div className="flex rounded-md border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPeriodView("daily")}
                    className={cn(
                      "px-2 py-1 text-xs font-medium",
                      periodView === "daily"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodView("monthly")}
                    className={cn(
                      "px-2 py-1 text-xs font-medium border-l border-gray-300",
                      periodView === "monthly"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    Monthly
                  </button>
                </div>
                {periodView === "monthly" && (
                  <div className="flex items-center gap-3 mr-1">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="perf-score-trend-scope"
                        checked={scopeMode === "overall"}
                        onChange={() => setScopeMode("overall")}
                        className="w-3 h-3 text-blue-600"
                      />
                      <span className="text-xs font-medium text-gray-700">Overall</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="perf-score-trend-scope"
                        checked={scopeMode === "zone"}
                        onChange={() => setScopeMode("zone")}
                        className="w-3 h-3 text-blue-600"
                      />
                      <span className="text-xs font-medium text-gray-700">Zone</span>
                    </label>
                    {scopeMode === "zone" && (
                      <>
                        <DrillStateIndicator drillLevel={drilldownPerf ? 1 : 0} />
                        {drilldownPerf && (
                          <Button
                            type="button"
                            onClick={() => setDrilldownPerf(null)}
                            className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                            title="Back to zone chart"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
                <Button
                  type="button"
                  onClick={() => void fetchTrend()}
                  disabled={loading}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  title="Refresh"
                >
                  <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsExpanded((e) => !e)}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title={isExpanded ? "Minimize" : "Maximize"}
                >
                  {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            "p-0 relative",
            isExpanded && "flex-1 min-h-0 overflow-auto flex flex-col"
          )}
        >
          <div
            className={cn(
              "relative",
              isExpanded ? "min-h-[min(520px,calc(100vh-11rem))] flex-1 flex flex-col" : "h-[365px]"
            )}
          >
            {chartBody}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default PerformanceScoreTrend;
