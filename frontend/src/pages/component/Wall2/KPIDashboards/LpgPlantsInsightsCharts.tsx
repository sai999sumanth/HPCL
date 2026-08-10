import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Loader2, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { cn } from "@/@/lib/utils";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";
import { ZoneGroupedBarChart } from "@/components/widgets/zone-grouped-bar";
import LpgRejectionsKpiTable from "./LpgRejectionsKpiTable";

const LPG_PLANTS_INSIGHTS_API = "/api/lpgoperationsinsights/lpg_plants_insights";

export type LpgPlantsMetricType = "top_productivity" | "bottom_productivity" | "rejections";

type InsightRow = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function extractDataArray(raw: unknown): InsightRow[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.length && typeof raw[0] === "object") {
    return raw as InsightRow[];
  }
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.data) && o.data.length && typeof o.data[0] === "object") {
    return o.data as InsightRow[];
  }
  return null;
}

function getPeriodKey(sample: InsightRow): string {
  const keys = Object.keys(sample);
  const k =
    keys.find((x) => /^(process_date|transaction_date|date|day)$/i.test(x)) ??
    keys.find((x) => /date|day/i.test(x));
  return k ?? "process_date";
}

function getValueKey(sample: InsightRow): string {
  const keys = Object.keys(sample);
  const found = keys.find(
    (k) =>
      /productivity|rejection|reject|defect|count|value|metric|rate/i.test(k) &&
      !/sap|plant|date|name|id$/i.test(k)
  );
  return found ?? "productivity";
}

/** Legend / tooltip / bar labels: drop trailing "LPG PLANT" and never include sap id. */
function shortPlantDisplayName(plant: string): string {
  return String(plant)
    .trim()
    .replace(/\s*LPG\s*PLANT\s*$/i, "")
    .replace(/\s+LPG\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Unique series keys aligned with `picked` order (for duplicate city names after shortening). */
function uniqueShortPlantGroupKeys(picked: { sap_id: string; plant: string }[]): string[] {
  const seen = new Map<string, number>();
  return picked.map((p) => {
    const base = shortPlantDisplayName(p.plant) || "Plant";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    if (n === 1) return base;
    return `${base} ${n}`;
  });
}

function formatPeriodLabel(period: string): string {
  const s = String(period).trim();
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
  } catch {
    /* ignore */
  }
  return s;
}

/**
 * Grouped bars: x = process_date, y = value column, one cluster per plant (top 5 or bottom 5 by mean value).
 */
function buildGroupedBarTopBottom(
  rows: InsightRow[],
  rankMode: "top5" | "bottom5"
): { chartData: Record<string, unknown>[]; groups: string[] } | null {
  if (!rows.length) return null;
  const sample = rows[0]!;
  const periodKey = getPeriodKey(sample);
  const valueKey = getValueKey(sample);
  const sapOf = (r: InsightRow) => String(r.sap_id ?? "").trim();
  const plantOf = (r: InsightRow) => String(r.plant ?? "").trim();

  const bySap = new Map<string, { plant: string; sum: number; count: number }>();
  for (const r of rows) {
    const id = sapOf(r);
    if (!id) continue;
    const val = toNum(r[valueKey]);
    if (val == null) continue;
    const cur = bySap.get(id) ?? { plant: plantOf(r), sum: 0, count: 0 };
    cur.sum += val;
    cur.count += 1;
    if (plantOf(r)) cur.plant = plantOf(r);
    bySap.set(id, cur);
  }

  const ranked = [...bySap.entries()].map(([id, v]) => ({
    sap_id: id,
    plant: v.plant,
    mean: v.count ? v.sum / v.count : 0,
  }));
  ranked.sort((a, b) => (rankMode === "top5" ? b.mean - a.mean : a.mean - b.mean));
  const picked = ranked.slice(0, 5);
  if (!picked.length) return null;

  const selectedSap = new Set(picked.map((p) => p.sap_id));
  const groupKeys = uniqueShortPlantGroupKeys(picked);

  const filtered = rows.filter((r) => selectedSap.has(sapOf(r)));
  const periods = [...new Set(filtered.map((r) => String(r[periodKey] ?? "").trim()))].filter(Boolean).sort();

  const chartData = periods.map((period) => {
    const row: Record<string, unknown> = {
      cat: period,
      label: formatPeriodLabel(period),
    };
    picked.forEach((p, i) => {
      const key = groupKeys[i]!;
      const match = filtered.find(
        (r) => String(r[periodKey]).trim() === period && sapOf(r) === p.sap_id
      );
      const val = match ? toNum(match[valueKey]) : null;
      row[key] = val != null && Number.isFinite(val) ? val : null;
    });
    return row;
  });

  return { chartData, groups: groupKeys };
}

export type LpgPlantsParsedBar = {
  chartData: Record<string, unknown>[];
  groups: string[];
  seriesDisplayNames?: string[];
  clusterStackSize?: number;
  valueSuffixOverride?: string;
};

function parseInsightsToGroupedBar(raw: unknown, rankMode: "top5" | "bottom5"): LpgPlantsParsedBar | null {
  const rows = extractDataArray(raw);
  if (!rows?.length) return null;
  return buildGroupedBarTopBottom(rows, rankMode);
}

async function fetchLpgPlantsInsights(
  metric: LpgPlantsMetricType,
  crossFilters: Array<{ key: string; cond: string; value: string }>
): Promise<unknown> {
  const response = await apiClient.post(LPG_PLANTS_INSIGHTS_API, {
    filters: [],
    cross_filters: crossFilters,
    metric_type: metric,
    drill_state: "",
  });
  return response?.data ?? response;
}

type ChartKey = "top" | "bottom" | "rej";

const PLANT_BAR_PROPS = {
  xAxisLabelRotation: -45,
  scrollbarCategoryThreshold: 14,
} as const;

export interface LpgPlantsInsightsChartsProps {
  /** KPI top-bar filters (DATE range, zone, sap_id from ticketing, etc.). */
  crossFilters: Array<{ key: string; cond: string; value: string }>;
}

const LpgPlantsInsightsCharts: React.FC<LpgPlantsInsightsChartsProps> = ({ crossFilters }) => {
  const [topRaw, setTopRaw] = useState<unknown>(null);
  const [bottomRaw, setBottomRaw] = useState<unknown>(null);
  const [rejectionsRaw, setRejectionsRaw] = useState<unknown>(null);

  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingBottom, setLoadingBottom] = useState(true);
  const [loadingRej, setLoadingRej] = useState(true);

  const [topError, setTopError] = useState<string | null>(null);
  const [bottomError, setBottomError] = useState<string | null>(null);
  const [rejectionsError, setRejectionsError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<ChartKey | null>(null);
  const seqRef = useRef(0);

  const applyResponse = useCallback(
    (
      _metric: LpgPlantsMetricType,
      value: unknown,
      setRaw: (v: unknown) => void,
      setErr: (e: string | null) => void,
      setLoading: (b: boolean) => void
    ) => {
      const obj = value as Record<string, unknown> | undefined;
      if (obj && typeof obj === "object" && obj.status === false) {
        setErr(String(obj.message ?? "Request failed"));
        setRaw(null);
      } else {
        setErr(null);
        setRaw(value);
      }
      setLoading(false);
    },
    []
  );

  const loadOne = useCallback(
    async (metric: LpgPlantsMetricType) => {
      const setters =
        metric === "top_productivity"
          ? { setRaw: setTopRaw, setErr: setTopError, setLoading: setLoadingTop }
          : metric === "bottom_productivity"
            ? { setRaw: setBottomRaw, setErr: setBottomError, setLoading: setLoadingBottom }
            : { setRaw: setRejectionsRaw, setErr: setRejectionsError, setLoading: setLoadingRej };

      setters.setLoading(true);
      setters.setErr(null);
      try {
        const data = await fetchLpgPlantsInsights(metric, crossFilters);
        applyResponse(metric, data, setters.setRaw, setters.setErr, setters.setLoading);
      } catch (e) {
        setters.setErr(e instanceof Error ? e.message : "Request failed");
        setters.setRaw(null);
        setters.setLoading(false);
      }
    },
    [applyResponse, crossFilters]
  );

  const loadAll = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoadingTop(true);
    setLoadingBottom(true);
    setLoadingRej(true);
    setTopError(null);
    setBottomError(null);
    setRejectionsError(null);
    try {
      const [a, b, c] = await Promise.allSettled([
        fetchLpgPlantsInsights("top_productivity", crossFilters),
        fetchLpgPlantsInsights("bottom_productivity", crossFilters),
        fetchLpgPlantsInsights("rejections", crossFilters),
      ]);
      if (seq !== seqRef.current) return;
      if (a.status === "fulfilled") {
        applyResponse("top_productivity", a.value, setTopRaw, setTopError, setLoadingTop);
      } else {
        setTopError(a.reason instanceof Error ? a.reason.message : "Request failed");
        setTopRaw(null);
        setLoadingTop(false);
      }
      if (b.status === "fulfilled") {
        applyResponse("bottom_productivity", b.value, setBottomRaw, setBottomError, setLoadingBottom);
      } else {
        setBottomError(b.reason instanceof Error ? b.reason.message : "Request failed");
        setBottomRaw(null);
        setLoadingBottom(false);
      }
      if (c.status === "fulfilled") {
        applyResponse("rejections", c.value, setRejectionsRaw, setRejectionsError, setLoadingRej);
      } else {
        setRejectionsError(c.reason instanceof Error ? c.reason.message : "Request failed");
        setRejectionsRaw(null);
        setLoadingRej(false);
      }
    } catch {
      if (seq !== seqRef.current) return;
    }
  }, [applyResponse, crossFilters]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const topParsed = useMemo(() => parseInsightsToGroupedBar(topRaw, "top5"), [topRaw]);
  const bottomParsed = useMemo(() => parseInsightsToGroupedBar(bottomRaw, "bottom5"), [bottomRaw]);

  const chartCard = (
    key: ChartKey,
    title: string,
    subtitle: string,
    parsed: LpgPlantsParsedBar | null,
    err: string | null,
    loading: boolean,
    valueSuffix: string,
    onRefresh: () => void,
    roundedColumnTops = true
  ) => {
    const isEx = expanded === key;
    const showChart = !loading && !err && parsed && parsed.groups.length > 0 && parsed.chartData.length > 0;

    return (
      <>
        {isEx && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setExpanded(null)}
            aria-hidden
          />
        )}
        <Card
          className={cn(
            "border border-gray-200 shadow-sm transition-all duration-300 p-0",
            isEx && "fixed inset-4 z-50 flex flex-col overflow-hidden h-[calc(100vh-2rem)] shadow-2xl"
          )}
        >
          <CardHeader className="pb-2 flex-shrink-0 space-y-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-sm font-bold text-gray-800">{title}</CardTitle>
                <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  onClick={() => void onRefresh()}
                  disabled={loading}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  title="Refresh this chart"
                >
                  <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
                <Button
                  type="button"
                  onClick={() => setExpanded(isEx ? null : key)}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title={isEx ? "Minimize" : "Maximize"}
                >
                  {isEx ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn("pt-0 p-0 relative", isEx && "flex-1 min-h-0 overflow-auto flex flex-col")}>
            <div className={cn("relative w-full", isEx ? "flex-1 min-h-[min(560px,calc(100vh-11rem))]" : "min-h-[320px]")}>
              {loading && (
                <div className="flex min-h-[320px] items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              )}
              {!loading && err && (
                <div className="flex min-h-[200px] items-center justify-center px-4 text-center text-sm text-red-600">
                  {err}
                </div>
              )}
              {showChart && (
                <>
                  <ZoneGroupedBarChart
                    {...PLANT_BAR_PROPS}
                    chartData={parsed!.chartData}
                    groups={parsed!.groups}
                    categoryField="cat"
                    categoryLabelField="label"
                    valueSuffix={parsed?.valueSuffixOverride ?? valueSuffix}
                    showLegend={!parsed?.clusterStackSize}
                    stacked={Boolean(parsed?.clusterStackSize)}
                    clusterStackSize={parsed?.clusterStackSize}
                    seriesDisplayNames={parsed?.seriesDisplayNames}
                    clusterShowPlantLabels={Boolean(parsed?.clusterStackSize)}
                    height={isEx ? 0 : parsed?.clusterStackSize ? 440 : 400}
                    className={cn("w-full", isEx && "flex-1 min-h-[420px]")}
                    rightAxisLabel={(parsed?.valueSuffixOverride ?? valueSuffix).trim()}
                    roundedColumnTops={roundedColumnTops}
                  />
                </>
              )}
              {!loading && !err && !showChart && (
                <div className="relative min-h-[280px]">
                  <NoDataDisplay message="No chart data for this view" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  const rejectionsCard = () => {
    const key: ChartKey = "rej";
    const isEx = expanded === key;
    return (
      <>
        {isEx && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setExpanded(null)}
            aria-hidden
          />
        )}
        <Card
          className={cn(
            "border border-gray-200 shadow-sm transition-all duration-300 p-0",
            isEx && "fixed inset-4 z-50 flex flex-col overflow-hidden h-[calc(100vh-2rem)] shadow-2xl"
          )}
        >
          <CardHeader className="pb-2 flex-shrink-0 space-y-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-sm font-bold text-gray-800">LPG plant rejections</CardTitle>
                <p className="text-xs text-gray-600 mt-0.5">
                  Overall CS / GD / PT, total, and trend %; click Trend % for day-wise stacked chart (API{" "}
                  <code className="text-[11px]">metric_type: rejections</code>).
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  onClick={() => void loadOne("rejections")}
                  disabled={loadingRej}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  title="Refresh"
                >
                  <RotateCcw className={cn("h-4 w-4", loadingRej && "animate-spin")} />
                </Button>
                <Button
                  type="button"
                  onClick={() => setExpanded(isEx ? null : key)}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title={isEx ? "Minimize" : "Maximize"}
                >
                  {isEx ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn("pt-0 p-0 relative", isEx && "flex-1 min-h-0 overflow-auto flex flex-col")}>
            <div
              className={cn(
                "relative w-full",
                isEx ? "flex-1 min-h-[min(560px,calc(100vh-11rem))]" : "min-h-[320px]"
              )}
            >
              <LpgRejectionsKpiTable
                crossFilters={crossFilters}
                response={rejectionsRaw}
                loading={loadingRej}
                error={rejectionsError}
              />
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {chartCard(
        "top",
        "Top 5 plants — productivity increased",
        "Grouped by process date; five plants with highest mean productivity in the window (API: top_productivity).",
        topParsed,
        topError,
        loadingTop,
        " productivity",
        () => loadOne("top_productivity")
      )}
      {chartCard(
        "bottom",
        "Bottom 5 plants — productivity reduced",
        "Grouped by process date; five plants with lowest mean productivity in the window (API: bottom_productivity).",
        bottomParsed,
        bottomError,
        loadingBottom,
        " productivity",
        () => loadOne("bottom_productivity")
      )}
      {rejectionsCard()}
    </div>
  );
};

export default LpgPlantsInsightsCharts;
