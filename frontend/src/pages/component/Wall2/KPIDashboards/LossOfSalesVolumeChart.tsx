import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, Loader2, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { cn } from "@/@/lib/utils";
import NoDataDisplay from "@/components/common/NoDataDisplay";
import PerformanceScoreLineChart from "./PerformanceScoreLineChart";
import { DryoutZoneGroupedBarChart } from "./DryoutZoneGroupedBarChart";

export const LOSS_OF_SALES_VOLUME_API = "/api/dryoutmanagement/get_loss_of_sales_volume";

/** amCharts color ints: MS (red `#fd0200`), HSD (dark blue `#00008a`) — lines + stacked bars. */
export const LOSS_MS_HSD_AM_COLORS: readonly number[] = [0xfd0200, 0x00008a];

type CrossFilterEntry = { key: string; cond: string; value: string };

/** API expects `values: []` on each cross_filter row (see dryoutmanagement payloads). */
export type LossApiCrossFilterRow = {
  key: string;
  cond: string;
  value: string;
  values: unknown[];
};

export function normalizeCrossFiltersForLossApi(filters: CrossFilterEntry[]): LossApiCrossFilterRow[] {
  return filters.map((f) => ({
    key: f.key.replace(/^"(.*)"$/, "$1"),
    cond: f.cond,
    value: f.value,
    values: [],
  }));
}

/** Monthly loss API should not receive DATE in `cross_filters` — drill uses bar clicks + `filters` + `drill_state`. */
export function stripDateFromLossCrossFilters(filters: LossApiCrossFilterRow[]): LossApiCrossFilterRow[] {
  return filters.filter((f) => {
    const k = String(f.key).replace(/^"(.*)"$/, "$1").toUpperCase();
    return k !== "DATE" && k !== "CARD_DATE";
  });
}

function unwrapPayload(res: unknown): Record<string, unknown> | null {
  if (res == null || typeof res !== "object") return null;
  const o = res as Record<string, unknown>;
  const inner = o.data;
  if (inner != null && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return o;
}

function extractLossFromRow(row: Record<string, unknown>): number | null {
  const keys = [
    "loss_of_sales_volume",
    "loss_of_sale",
    "loss_volume",
    "loss",
    "volume",
    "value",
    "total_loss",
    "sales_volume_lost",
  ];
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v != null && v !== "" && typeof v !== "object") {
      const n = parseFloat(String(v));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Keys normalized to uppercase (MS, HSD, …). */
function extractLossOfSaleMap(row: Record<string, unknown>): Map<string, number> {
  const los = row.loss_of_sale;
  if (los == null || typeof los !== "object") return new Map();
  const out = new Map<string, number>();
  for (const [k, v] of Object.entries(los as Record<string, unknown>)) {
    const canon = k.trim().toUpperCase();
    let n: number;
    if (typeof v === "number" && Number.isFinite(v)) n = v;
    else {
      const p = parseFloat(String(v));
      if (!Number.isFinite(p)) continue;
      n = p;
    }
    out.set(canon, n);
  }
  return out;
}

/** Series keys for loss line / stacked bar charts (MS + HSD). */
export const LOSS_MS_HSD_GROUPS = ["MS", "HSD"] as const;

export type LossMsHsdRow = {
  cat: string;
  label: string;
  MS: number | null;
  HSD: number | null;
};

function formatDayLabel(isoOrStr: string): string {
  if (!isoOrStr) return "";
  try {
    const d = new Date(isoOrStr);
    if (Number.isNaN(d.getTime())) return isoOrStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return isoOrStr;
  }
}

function formatMonthLabel(monthDate: string): string {
  const s = String(monthDate ?? "").trim();
  if (!s) return "";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const mon = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    return `${mon} ${year}`;
  } catch {
    return s;
  }
}

/** Prefer month buckets from API (`month_date`, `process_date`, …). */
function monthKeyFromRow(row: Record<string, unknown>): string {
  return String(row.month_date ?? row.process_date ?? row.date ?? "").trim();
}

function parseDailyChartRows(raw: unknown): LossMsHsdRow[] {
  const root = unwrapPayload(raw);
  const arr: unknown[] = Array.isArray(root)
    ? root
    : Array.isArray((root as Record<string, unknown>)?.data)
      ? ((root as Record<string, unknown>).data as unknown[])
      : Array.isArray((root as Record<string, unknown>)?.daily_data)
        ? ((root as Record<string, unknown>).daily_data as unknown[])
        : [];
  const out: LossMsHsdRow[] = [];
  arr.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const dateStr = String(row.process_date ?? row.date ?? row.sale_date ?? row.day ?? row.category ?? "");
    const los = extractLossOfSaleMap(row);
    let ms = los.get("MS") ?? null;
    let hsd = los.get("HSD") ?? null;
    if (ms == null && hsd == null) {
      const legacy = extractLossFromRow(row);
      if (legacy == null) return;
      ms = legacy;
      hsd = null;
    }
    const cat = dateStr || `row-${i}`;
    out.push({
      cat,
      label: formatDayLabel(dateStr) || cat,
      MS: ms != null ? Number(ms.toFixed(4)) : null,
      HSD: hsd != null ? Number(hsd.toFixed(4)) : null,
    });
  });
  return out.sort((a, b) => a.cat.localeCompare(b.cat));
}

/** Monthly zone drill: API `drill_state` + `filters` (Zone → Region → sales_area → location). */
export type MonthlyDrillLevel = "zone" | "region" | "sales_area" | "location";

export type LossDrillSelection = {
  zone?: string;
  region?: string;
  sales_area?: string;
};

interface MonthlyLossBundle {
  overallRows: LossMsHsdRow[];
  drillChartData: Record<string, unknown>[] | null;
  /** Series keys: `["MS","HSD"]` — simple stacked pair per zone row. */
  drillGroups: string[] | null;
  /** Canonical dimension key (zone/region/…) → first-seen API label (for filters). */
  drillGroupKeyToOriginal: Record<string, string> | null;
  /** Dimension labels in original order, for bar-click drill. */
  drillClusterDimOrder: string[] | null;
  /** Month range groups for axisRangeGroups prop (flat format). */
  drillAxisRangeGroups: Array<{ startCat: string; endCat: string; label: string }> | null;
  averageLoss: number | null;
}

/** Filters sent in request body — selected parents for deeper drill levels. */
export function buildLossDrillFilters(sel: LossDrillSelection): Array<{ key: string; cond: string; value: string }> {
  const out: Array<{ key: string; cond: string; value: string }> = [];
  if (sel.zone) out.push({ key: "zone", cond: "equals", value: sel.zone });
  if (sel.region) out.push({ key: "region", cond: "equals", value: sel.region });
  if (sel.sales_area) out.push({ key: "sales_area", cond: "equals", value: sel.sales_area });
  return out;
}

function resolveGroupKey(row: Record<string, unknown>, candidates: string[]): string | null {
  for (const k of candidates) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/**
 * X-axis = one category per month; each month clusters one stacked column per dimension value (zone/region/…),
 * each stack = MS + HSD from `loss_of_sale`. Series keys `dim_i_MS` / `dim_i_HSD` match `clusterStackSize={2}`.
 */
const DRILL_ROW_DATE_KEYS = ["month_date", "process_date", "date"] as const;

function resolveDrillDateKey(rows: Record<string, unknown>[]): string {
  for (const k of DRILL_ROW_DATE_KEYS) {
    if (rows.some((r) => r[k] != null && String(r[k]).trim() !== "")) return k;
  }
  return "month_date";
}


/**
 * Flat format: one data row per (zone × month) pair that has actual data.
 * Category key = `"${date}|${canon}"` — guarantees no empty cluster slots for absent zones.
 * axisRangeGroups: spans first→last category key per month for human-readable month labels.
 * groups = ["MS", "HSD"]; stacked=true, NO clusterStackSize needed.
 */
function buildDrillClusteredMonthByDimension(
  rows: Record<string, unknown>[],
  groupCandidates: string[]
): {
  chartData: Record<string, unknown>[];
  groups: string[];
  groupKeyToOriginal: Record<string, string>;
  drillClusterDimOrder: string[];
  axisRangeGroups: Array<{ startCat: string; endCat: string; label: string }>;
} | null {
  if (!rows.length) return null;
  const dateKey = resolveDrillDateKey(rows);
  const groupCanon = (s: string) => s.trim().toUpperCase();
  const canonToOriginal = new Map<string, string>();
  const canonSet = new Set<string>();
  rows.forEach((r) => {
    const g = resolveGroupKey(r, groupCandidates);
    if (!g) return;
    const c = groupCanon(g);
    canonSet.add(c);
    if (!canonToOriginal.has(c)) canonToOriginal.set(c, g.trim());
  });
  const dimCanons = [...canonSet].sort();
  if (dimCanons.length === 0) return null;

  const dates = [...new Set(rows.map((r) => String(r[dateKey] ?? "").trim()))]
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Exclude zones with zero data across ALL months
  const dimTotals = new Map<string, number>();
  dimCanons.forEach((gCanon) => {
    let total = 0;
    for (const d of rows) {
      const gk = resolveGroupKey(d, groupCandidates);
      if (!gk || groupCanon(gk) !== gCanon) continue;
      const los = extractLossOfSaleMap(d);
      total += (los.get("MS") ?? 0) + (los.get("HSD") ?? 0);
    }
    dimTotals.set(gCanon, total);
  });
  const activeDimCanons = dimCanons.filter((c) => (dimTotals.get(c) ?? 0) > 0);
  if (activeDimCanons.length === 0) return null;

  const drillClusterDimOrder = activeDimCanons.map((c) => canonToOriginal.get(c) ?? c);
  const groups = ["MS", "HSD"];

  // Flat rows — one per (date × zone) that has actual MS or HSD data
  const chartData: Record<string, unknown>[] = [];
  const axisRangeGroups: Array<{ startCat: string; endCat: string; label: string }> = [];

  for (const date of dates) {
    const monthLabel = formatMonthLabel(date) || date;
    const catsInMonth: string[] = [];

    for (const gCanon of activeDimCanons) {
      let sumMs = 0, sumHsd = 0, hasMs = false, hasHsd = false;
      for (const d of rows) {
        if (String(d[dateKey] ?? "").trim() !== date) continue;
        const gk = resolveGroupKey(d, groupCandidates);
        if (!gk || groupCanon(gk) !== gCanon) continue;
        const los = extractLossOfSaleMap(d);
        const ms = los.get("MS"); const hsd = los.get("HSD");
        if (ms != null && ms > 0) { sumMs += ms; hasMs = true; }
        if (hsd != null && hsd > 0) { sumHsd += hsd; hasHsd = true; }
      }
      if (!hasMs && !hasHsd) continue; // skip zone with no data in this month
      const cat = `${date}|${gCanon}`;
      const zoneName = canonToOriginal.get(gCanon) ?? gCanon;
      chartData.push({
        cat,
        label: zoneName,    // shown as bullet label above bar
        MS:  hasMs  ? Number(sumMs.toFixed(2))  : 0,
        HSD: hasHsd ? Number(sumHsd.toFixed(2)) : 0,
      });
      catsInMonth.push(cat);
    }

    if (catsInMonth.length > 0) {
      axisRangeGroups.push({
        startCat: catsInMonth[0]!,
        endCat: catsInMonth[catsInMonth.length - 1]!,
        label: monthLabel,
      });
      // Spacer after each month (except last) creates a real visual gap
      const isLastDate = date === dates[dates.length - 1];
      if (!isLastDate) {
        chartData.push({ cat: `${date}|__GAP__`, label: "", MS: 0, HSD: 0 });
      }
    }
  }

  if (chartData.length === 0) return null;
  return {
    chartData,
    groups,
    groupKeyToOriginal: Object.fromEntries(canonToOriginal),
    drillClusterDimOrder,
    axisRangeGroups,
  };
}

const GROUP_KEYS: Record<MonthlyDrillLevel, string[]> = {
  zone: ["zone", "Zone", "ZONE"],
  region: ["region", "Region", "REGION"],
  sales_area: ["sales_area", "sales_area_name", "Sales_area", "salesArea", "SALES_AREA"],
  location: ["location_name", "location", "Location", "Location_name", "LOCATION"],
};

/** Prefer API arrays by drill level; fall back to common keys. */
function extractDrillRows(root: Record<string, unknown>, level: MonthlyDrillLevel): Record<string, unknown>[] {
  const byLevel: Record<MonthlyDrillLevel, string[]> = {
    zone: ["zone_data", "data"],
    region: ["region_data", "zone_data", "data"],
    sales_area: ["sales_area_data", "region_data", "data"],
    location: ["location_data", "sales_area_data", "data"],
  };
  for (const k of byLevel[level]) {
    const v = root[k];
    if (Array.isArray(v) && v.length > 0) return v as Record<string, unknown>[];
  }
  return [];
}

function aggregateOverallFromZone(zoneSrc: Record<string, unknown>[]): LossMsHsdRow[] {
  const byMonth = new Map<string, { ms: number; hsd: number }>();
  zoneSrc.forEach((row) => {
    const md = monthKeyFromRow(row);
    if (!md) return;
    const los = extractLossOfSaleMap(row);
    const ms = los.get("MS");
    const hsd = los.get("HSD");
    if (ms == null && hsd == null) return;
    const cur = byMonth.get(md) ?? { ms: 0, hsd: 0 };
    if (ms != null) cur.ms += ms;
    if (hsd != null) cur.hsd += hsd;
    byMonth.set(md, cur);
  });
  return [...byMonth.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([cat, v]) => ({
      cat,
      label: formatMonthLabel(cat),
      MS: Number(v.ms.toFixed(2)),
      HSD: Number(v.hsd.toFixed(2)),
    }));
}

function parseMonthlyLossResponse(
  raw: unknown,
  dataView: "overall" | "zone",
  drillLevel: MonthlyDrillLevel
): MonthlyLossBundle | null {
  const root = unwrapPayload(raw);
  if (!root) return null;

  const overallSrc = root.overall_data;
  const zoneSrcRaw = root.zone_data;
  const zoneSrc = Array.isArray(zoneSrcRaw) ? (zoneSrcRaw as Record<string, unknown>[]) : [];

  let overallRows: LossMsHsdRow[] = [];
  if (Array.isArray(overallSrc) && overallSrc.length > 0) {
    overallRows = (overallSrc as Record<string, unknown>[])
      .map((row, i) => {
        const md = monthKeyFromRow(row);
        const los = extractLossOfSaleMap(row);
        let ms = los.get("MS") ?? null;
        let hsd = los.get("HSD") ?? null;
        if (ms == null && hsd == null) {
          const legacy = extractLossFromRow(row);
          if (legacy == null) return null;
          ms = legacy;
        }
        return {
          cat: md || `m-${i}`,
          label: formatMonthLabel(md) || md,
          MS: ms != null ? Number(Number(ms).toFixed(2)) : null,
          HSD: hsd != null ? Number(Number(hsd).toFixed(2)) : null,
        };
      })
      .filter(Boolean) as LossMsHsdRow[];
    overallRows.sort((a, b) => new Date(a.cat).getTime() - new Date(b.cat).getTime());
  } else if (zoneSrc.length > 0 && dataView === "overall") {
    overallRows = aggregateOverallFromZone(zoneSrc);
  } else if (
    overallRows.length === 0 &&
    Array.isArray((root as Record<string, unknown>).data) &&
    dataView === "overall"
  ) {
    const dataArr = (root as Record<string, unknown>).data as unknown[];
    const sample = dataArr[0];
    if (sample && typeof sample === "object" && sample !== null) {
      const sr = sample as Record<string, unknown>;
      if (sr.month_date != null || sr.process_date != null || sr.loss_of_sale != null) {
        overallRows = dataArr
          .map((item, i) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            const md = monthKeyFromRow(row);
            const los = extractLossOfSaleMap(row);
            let ms = los.get("MS") ?? null;
            let hsd = los.get("HSD") ?? null;
            if (ms == null && hsd == null) {
              const legacy = extractLossFromRow(row);
              if (legacy == null) return null;
              ms = legacy;
            }
            return {
              cat: md || `m-${i}`,
              label: formatMonthLabel(md) || md,
              MS: ms != null ? Number(Number(ms).toFixed(2)) : null,
              HSD: hsd != null ? Number(Number(hsd).toFixed(2)) : null,
            };
          })
          .filter(Boolean) as LossMsHsdRow[];
        overallRows.sort((a, b) => new Date(a.cat).getTime() - new Date(b.cat).getTime());
      }
    }
  }

  let drillChartData: Record<string, unknown>[] | null = null;
  let drillGroups: string[] | null = null;
  let drillGroupKeyToOriginal: Record<string, string> | null = null;
  let drillClusterDimOrder: string[] | null = null;
  let drillAxisRangeGroups: Array<{ startCat: string; endCat: string; label: string }> | null = null;
  if (dataView === "zone") {
    const drillRows = extractDrillRows(root, drillLevel);
    if (drillRows.length > 0) {
      const built = buildDrillClusteredMonthByDimension(drillRows, GROUP_KEYS[drillLevel]);
      if (built) {
        drillChartData = built.chartData;
        drillGroups = built.groups;
        drillGroupKeyToOriginal = built.groupKeyToOriginal;
        drillClusterDimOrder = built.drillClusterDimOrder;
        drillAxisRangeGroups = built.axisRangeGroups;
      }
    }
    if (drillLevel === "zone" && zoneSrc.length > 0 && (!drillChartData || drillChartData.length === 0)) {
      const built = buildDrillClusteredMonthByDimension(zoneSrc, GROUP_KEYS.zone);
      if (built) {
        drillChartData = built.chartData;
        drillGroups = built.groups;
        drillGroupKeyToOriginal = built.groupKeyToOriginal;
        drillClusterDimOrder = built.drillClusterDimOrder;
        drillAxisRangeGroups = built.axisRangeGroups;
      }
    }
  }

  if (
    overallRows.length === 0 &&
    (!drillChartData || drillChartData.length === 0) &&
    dataView === "overall"
  ) {
    const fallbackArr = Array.isArray((root as Record<string, unknown>).data)
      ? ((root as Record<string, unknown>).data as unknown[])
      : null;
    if (fallbackArr && fallbackArr.length > 0) {
      const rows = parseDailyChartRows(raw);
      if (rows.length === 0) return null;
      return {
        overallRows: rows.map((r) => ({
          cat: r.cat,
          label: r.label,
          MS: r.MS,
          HSD: r.HSD,
        })),
        drillChartData: null,
        drillGroups: null,
        drillGroupKeyToOriginal: null,
        drillClusterDimOrder: null,
        drillAxisRangeGroups: null,
        averageLoss: rows.length
          ? Number(
              (
                rows.reduce((s, x) => s + (x.MS ?? 0) + (x.HSD ?? 0), 0) / rows.length
              ).toFixed(2)
            )
          : null,
      };
    }
    return null;
  }

  if (dataView === "zone" && (!drillChartData || drillChartData.length === 0) && overallRows.length === 0) {
    const fallbackArr = Array.isArray((root as Record<string, unknown>).data)
      ? ((root as Record<string, unknown>).data as unknown[])
      : null;
    if (fallbackArr && fallbackArr.length > 0) {
      const tryRows = fallbackArr as Record<string, unknown>[];
      const built = buildDrillClusteredMonthByDimension(tryRows, GROUP_KEYS[drillLevel]);
      if (built) {
        drillChartData = built.chartData;
        drillGroups = built.groups;
        drillGroupKeyToOriginal = built.groupKeyToOriginal;
        drillClusterDimOrder = built.drillClusterDimOrder;
        drillAxisRangeGroups = built.axisRangeGroups;
      }
    }
    if (!drillChartData || drillChartData.length === 0) return null;
  }

  let averageLoss: number | null = null;
  const os = root.overall_summary as Record<string, unknown> | undefined;
  if (os) {
    const a =
      extractLossFromRow(os) ??
      (typeof os.average_loss === "number" ? os.average_loss : null) ??
      (typeof os.avg_loss === "number" ? os.avg_loss : null);
    if (a != null) averageLoss = Number(Number(a).toFixed(2));
  }
  if (averageLoss == null && overallRows.length > 0) {
    const sum = overallRows.reduce((s, r) => s + (r.MS ?? 0) + (r.HSD ?? 0), 0);
    averageLoss = Number((sum / overallRows.length).toFixed(2));
  }

  return {
    overallRows,
    drillChartData,
    drillGroups,
    drillGroupKeyToOriginal,
    drillClusterDimOrder,
    drillAxisRangeGroups,
    averageLoss,
  };
}

export type LossOfSalesVolumeChartProps = {
  crossFilters: CrossFilterEntry[];
};

/**
 * Loss of sales volume — same controls as Daily Productivity: Daily / Monthly toggle;
 * Monthly: Overall vs Zone. Uses `POST /api/dryoutmanagement/get_loss_of_sales_volume`.
 */
const DRILL_LABELS: Record<MonthlyDrillLevel, string> = {
  zone: "Zone",
  region: "Region",
  sales_area: "Sales area",
  location: "Location",
};

/** Same UI as Daily Productivity (Cylinder/Hour) — `DrillStateIndicator` with dots for each step. */
const LOSS_MONTHLY_DRILL_ORDER: MonthlyDrillLevel[] = ["zone", "region", "sales_area", "location"];

function LossDrillStateIndicator({ level }: { level: MonthlyDrillLevel }) {
  const states = LOSS_MONTHLY_DRILL_ORDER.map((k) => DRILL_LABELS[k]);
  const drillIndex = Math.max(0, LOSS_MONTHLY_DRILL_ORDER.indexOf(level));
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillIndex]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full ${index === drillIndex ? "bg-blue-600" : "bg-gray-300"}`}
          />
        ))}
      </div>
    </div>
  );
}

const LossOfSalesVolumeChart: React.FC<LossOfSalesVolumeChartProps> = ({ crossFilters }) => {
  const [timeView, setTimeView] = useState<"daily" | "monthly">("daily");
  const [dataView, setDataView] = useState<"overall" | "zone">("overall");
  const [monthlyDrillLevel, setMonthlyDrillLevel] = useState<MonthlyDrillLevel>("zone");
  const [drillSelection, setDrillSelection] = useState<LossDrillSelection>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyRows, setDailyRows] = useState<LossMsHsdRow[]>([]);
  const [monthlyBundle, setMonthlyBundle] = useState<MonthlyLossBundle | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const apiCrossFilters = useMemo(() => normalizeCrossFiltersForLossApi(crossFilters), [crossFilters]);
  const monthlyCrossFilters = useMemo(() => stripDateFromLossCrossFilters(apiCrossFilters), [apiCrossFilters]);

  const drillFilterKey = useMemo(
    () =>
      [drillSelection.zone ?? "", drillSelection.region ?? "", drillSelection.sales_area ?? ""].join("|"),
    [drillSelection.zone, drillSelection.region, drillSelection.sales_area]
  );

  const hasDateFilter = useMemo(
    () =>
      apiCrossFilters.some((c) => {
        const k = String(c.key).replace(/^"(.*)"$/, "$1").toUpperCase();
        return k === "DATE";
      }),
    [apiCrossFilters]
  );

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        filters: [] as unknown[],
        drill_state: "",
        cross_filters: apiCrossFilters,
        segregation: [] as unknown[],
        action: "daily_loss_of_sale",
      };
      const res = await apiClient.post(LOSS_OF_SALES_VOLUME_API, payload);
      const raw = res?.data ?? res;
      const rows = parseDailyChartRows(raw);
      setDailyRows(rows);
      if (rows.length === 0) setError("No data available");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load loss of sales volume");
      setDailyRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiCrossFilters]);

  const fetchMonthly = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const segregation: unknown[] = [];
      const payload: Record<string, unknown> =
        dataView === "overall"
          ? {
              filters: [],
              drill_state: "",
              cross_filters: monthlyCrossFilters,
              segregation,
              action: "monthly_loss_of_sale",
            }
          : {
              filters: buildLossDrillFilters(drillSelection),
              drill_state: monthlyDrillLevel,
              cross_filters: monthlyCrossFilters,
              segregation,
              action: "monthly_loss_of_sale",
            };
      const res = await apiClient.post(LOSS_OF_SALES_VOLUME_API, payload);
      const raw = res?.data ?? res;
      const bundle = parseMonthlyLossResponse(raw, dataView, monthlyDrillLevel);
      setMonthlyBundle(bundle);
      const okOverall = bundle && bundle.overallRows.length > 0;
      const okDrill =
        bundle &&
        bundle.drillChartData &&
        bundle.drillChartData.length > 0 &&
        bundle.drillGroups &&
        bundle.drillGroups.length > 0;
      if (dataView === "overall") {
        if (!bundle || !okOverall) setError("No data available");
      } else if (!bundle || !okDrill) {
        setError("No data available");
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load loss of sales volume");
      setMonthlyBundle(null);
    } finally {
      setLoading(false);
    }
  }, [monthlyCrossFilters, dataView, monthlyDrillLevel, drillFilterKey]);

  const handleRefresh = useCallback(() => {
    if (timeView === "daily") {
      if (!hasDateFilter) return;
      void fetchDaily();
    } else {
      void fetchMonthly();
    }
  }, [hasDateFilter, timeView, fetchDaily, fetchMonthly]);

  const handleDrillBarClick = useCallback(
    (categoryValue: string, _seriesKeyOrDim: string) => {
      // Flat format: categoryValue = "2025-11|CEN" → extract CANON → look up original name
      const canon = String(categoryValue).split("|")[1]?.trim().toUpperCase() ?? categoryValue.trim().toUpperCase();
      const apiName =
        monthlyBundle?.drillGroupKeyToOriginal?.[canon] ??
        monthlyBundle?.drillGroupKeyToOriginal?.[categoryValue.trim()] ??
        canon;
      if (monthlyDrillLevel === "zone") {
        setDrillSelection({ zone: apiName });
        setMonthlyDrillLevel("region");
      } else if (monthlyDrillLevel === "region") {
        setDrillSelection((s) => ({ ...s, region: apiName }));
        setMonthlyDrillLevel("sales_area");
      } else if (monthlyDrillLevel === "sales_area") {
        setDrillSelection((s) => ({ ...s, sales_area: apiName }));
        setMonthlyDrillLevel("location");
      }
    },
    [monthlyDrillLevel, monthlyBundle?.drillGroupKeyToOriginal]
  );

  const handleDrillBack = useCallback(() => {
    if (monthlyDrillLevel === "location") {
      setMonthlyDrillLevel("sales_area");
      setDrillSelection((s) => {
        const { sales_area, ...rest } = s;
        return rest;
      });
    } else if (monthlyDrillLevel === "sales_area") {
      setMonthlyDrillLevel("region");
      setDrillSelection((s) => {
        const { region, sales_area, ...rest } = s;
        return rest;
      });
    } else if (monthlyDrillLevel === "region") {
      setMonthlyDrillLevel("zone");
      setDrillSelection({});
    }
  }, [monthlyDrillLevel]);

  /** Taller plot area so clustered zone/location bars fit inside the card; expanded uses most of the modal. */
  const chartHeight = isExpanded ? 640 : 440;

  /** Location level: many dense categories — scrollbar viewport shows one month at a time for readable stacks. */
  const drillScrollbarVisibleCategories =
    monthlyDrillLevel === "location" ? 1 : monthlyDrillLevel === "sales_area" ? 3 : 4;

  useEffect(() => {
    if (timeView === "monthly" && dataView === "zone") {
      setMonthlyDrillLevel("zone");
      setDrillSelection({});
    }
  }, [dataView, timeView]);

  useEffect(() => {
    if (timeView === "daily") {
      if (!hasDateFilter) {
        setDailyRows([]);
        setError(null);
        return;
      }
      void fetchDaily();
    } else {
      void fetchMonthly();
    }
  }, [timeView, hasDateFilter, fetchDaily, fetchMonthly]);

  const dailyChartData = useMemo(
    () => dailyRows.map((r) => ({ cat: r.cat, label: r.label, MS: r.MS, HSD: r.HSD })),
    [dailyRows]
  );

  const monthlyOverallChartData = useMemo(
    () =>
      monthlyBundle
        ? monthlyBundle.overallRows.map((r) => ({ cat: r.cat, label: r.label, MS: r.MS, HSD: r.HSD }))
        : [],
    [monthlyBundle]
  );

  const showDrillChart =
    timeView === "monthly" &&
    dataView === "zone" &&
    monthlyBundle?.drillChartData &&
    monthlyBundle.drillGroups &&
    monthlyBundle.drillChartData.length > 0 &&
    monthlyBundle.drillGroups.length > 0;

  /** Daily series still requires a toolbar date range; monthly loads without DATE in the payload. */
  const awaitingDailyDate = timeView === "daily" && !hasDateFilter;
  const refreshDisabled = loading || awaitingDailyDate;

  return (
    <>
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
          aria-hidden
        />
      )}
      <Card
        className={`border border-gray-200 bg-white shadow-sm transition-all duration-300 ${
          isExpanded ? "fixed inset-4 z-50 flex h-[calc(100vh-2rem)] min-h-0 flex-col shadow-2xl" : "h-fit w-full"
        }`}
      >
      <CardHeader className={`pb-2 p-3 ${isExpanded ? "shrink-0" : ""}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <CardTitle className="text-sm font-bold text-gray-800">Loss of Sales Volume</CardTitle>
            {timeView === "monthly" &&
              dataView === "zone" &&
              (drillSelection.zone || drillSelection.region || drillSelection.sales_area) && (
                <div className="flex items-center flex-wrap gap-y-0.5 text-[11px]">
                  {[
                    drillSelection.zone    ? { label: "Zone",       value: drillSelection.zone }       : null,
                    drillSelection.region  ? { label: "Region",     value: drillSelection.region }     : null,
                    drillSelection.sales_area ? { label: "Sales area", value: drillSelection.sales_area } : null,
                  ].filter(Boolean).map((entry, i) => (
                    <span key={i} className="flex items-center">
                      {i > 0 && <span className="mx-1.5 text-blue-300 font-medium tracking-tighter">——›</span>}
                      <span className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                        <span className="text-gray-400 font-normal">{entry!.label}:</span>
                        <span className="font-semibold text-blue-700">{entry!.value}</span>
                      </span>
                    </span>
                  ))}
                </div>
              )}
            {timeView === "monthly" && monthlyBundle?.averageLoss != null && (
              <div className="text-xs text-gray-700 font-semibold">
                Average loss:{" "}
                <span className="text-red-600">{Number(monthlyBundle.averageLoss).toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Daily / Monthly toggle */}
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => { setTimeView("daily"); setMonthlyDrillLevel("zone"); setDrillSelection({}); }}
                className={`px-2 py-1 text-xs font-medium ${
                  timeView === "daily" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => { setTimeView("monthly"); setMonthlyDrillLevel("zone"); setDrillSelection({}); }}
                className={`px-2 py-1 text-xs font-medium border-l border-gray-300 ${
                  timeView === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                Monthly
              </button>
            </div>
            {/* Overall / Zone + Level indicator — inline, same row */}
            {timeView === "monthly" && (
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="loss-sales-data-view"
                    checked={dataView === "overall"}
                    onChange={() => { setDataView("overall"); setMonthlyDrillLevel("zone"); setDrillSelection({}); }}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">Overall</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="loss-sales-data-view"
                    checked={dataView === "zone"}
                    onChange={() => { setDataView("zone"); setMonthlyDrillLevel("zone"); setDrillSelection({}); }}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">Zone</span>
                </label>
                {dataView === "zone" && (
                  <div className="flex items-center gap-2">
                    <LossDrillStateIndicator level={monthlyDrillLevel} />
                    {monthlyDrillLevel !== "zone" && (
                      <button
                        type="button"
                        onClick={handleDrillBack}
                        className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 flex items-center justify-center shrink-0"
                        title="Back one level"
                        aria-label="Back"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={refreshDisabled}
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
      </CardHeader>
      <CardContent
        className={`p-2 pt-0 pb-2 relative ${isExpanded ? "flex min-h-0 flex-1 flex-col overflow-hidden" : ""}`}
      >
        {/** Reserve plot height while data is loading so the card does not collapse. */}
        <div
          className={cn("relative w-full", isExpanded && "flex min-h-0 flex-1 flex-col")}
          style={{ minHeight: chartHeight }}
        >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-md">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}
        {awaitingDailyDate && (
          <div
            className={`flex items-center justify-center text-sm text-gray-500 ${isExpanded ? "min-h-0 flex-1" : "py-16"}`}
          >
            Waiting for date range…
          </div>
        )}
        {!awaitingDailyDate && error && !loading && <NoDataDisplay />}
        {!awaitingDailyDate && !error && timeView === "daily" && dailyChartData.length > 0 && (
          <PerformanceScoreLineChart
            chartData={dailyChartData as Record<string, unknown>[]}
            groups={[...LOSS_MS_HSD_GROUPS]}
            seriesColors={[...LOSS_MS_HSD_AM_COLORS]}
            categoryField="cat"
            categoryLabelField="label"
            valueSuffix="KL"
            height={isExpanded ? undefined : chartHeight}
            className={isExpanded ? "min-h-0 w-full flex-1" : "w-full"}
            xAxisLabelRotation={-45}
          />
        )}
        {!error &&
          timeView === "monthly" &&
          dataView === "overall" &&
          monthlyOverallChartData.length > 0 && (
            <PerformanceScoreLineChart
              chartData={monthlyOverallChartData as Record<string, unknown>[]}
              groups={[...LOSS_MS_HSD_GROUPS]}
              seriesColors={[...LOSS_MS_HSD_AM_COLORS]}
              categoryField="cat"
              categoryLabelField="label"
              valueSuffix="KL"
              height={isExpanded ? undefined : chartHeight}
              className={isExpanded ? "min-h-0 w-full flex-1" : "w-full"}
              xAxisLabelRotation={-90}
            />
          )}
        {!error && showDrillChart && monthlyBundle && (
          <DryoutZoneGroupedBarChart
            stacked
            colors={[...LOSS_MS_HSD_AM_COLORS]}
            chartData={monthlyBundle.drillChartData!}
            groups={monthlyBundle.drillGroups!}
            categoryField="cat"
            categoryLabelField="label"
            axisRangeGroups={monthlyBundle.drillAxisRangeGroups ?? undefined}
            showCategoryLabelBullets
            valueSuffix="KL"
            height={isExpanded ? undefined : chartHeight}
            className={isExpanded ? "min-h-0 w-full flex-1" : "w-full"}
            showLegend
            smallLegend
            scrollbarInitialVisibleCategories={
              monthlyBundle.drillAxisRangeGroups?.length
                ? Math.round((monthlyBundle.drillChartData?.length ?? 36) / Math.max(1, monthlyBundle.drillAxisRangeGroups.length)) * 3
                : drillScrollbarVisibleCategories
            }
            scrollbarCategoryThreshold={12}
            onBarClick={monthlyDrillLevel === "location" ? undefined : handleDrillBarClick}
          />
        )}
        {!loading &&
          !error &&
          timeView === "monthly" &&
          dataView === "zone" &&
          monthlyBundle &&
          (!monthlyBundle.drillChartData || monthlyBundle.drillChartData.length === 0) && (
            <div
              className={`flex items-center justify-center px-4 py-12 text-center text-sm text-gray-500 ${isExpanded ? "min-h-0 flex-1" : ""}`}
            >
              No chart data for this drill level. If the API supports it, ensure the response includes arrays such as{" "}
              <code className="mx-1 text-xs">zone_data</code>, <code className="mx-1 text-xs">region_data</code>, etc.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  );
};

export default LossOfSalesVolumeChart;
