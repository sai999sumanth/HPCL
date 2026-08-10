import React, { useMemo, useState, useCallback, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Factory, Fuel, Link2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import axios, { isCancel } from "axios";
import { apiClient } from "@/services/apiClient";
import { NaturalGasDashboardShell } from "./NaturalGasDashboardShell";
import { NgLineChart, NgMultiColorColumnChart, type CategoryValue } from "./NaturalGasAmCharts";
import {
  SalesByGaAreaHorizontalBarChart,
  am5IntToCssHex,
  type GaHorizontalBarRow,
} from "./SalesByGaAreaHorizontalBarChart";
import { OMC_COMPANY_HEX, OMC_COMPANY_NAMES, hexToAm5Int } from "../omcCompanyColors";
import { useNaturalGasAnalyticsDate } from "../NaturalGasAnalyticsDateContext";

/** Same plot height for Sales by company, GA horizontal, and Sales trends. */
const EXEC_CHART_PLOT_CLASS = "h-[min(260px,38vh)] w-full min-w-0 shrink-0";
/** Sales by GA area only: inner scroll when many rows */
const CHART_SCROLL_CLASS = "min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2";
/** Sales by company & Sales trends: no outer wrapper scroll — fixed plot; use in-chart scrollbar */
const FIXED_PLOT_WRAP_CLASS = "min-h-0 flex-1 overflow-hidden";

/** Y-axis 0–15 MMSCM — mock data scaled to this range */
const Y_MAX = 15;

/** Big-number cards: neutral surface; colour only on icon circle */
const KPI_METRICS: Record<
  "sales" | "connections" | "industrial" | "cng",
  { Icon: LucideIcon; iconColor: string; iconBg: string }
> = {
  sales: {
    Icon: TrendingUp,
    iconColor: "#1d4ed8",
    iconBg: "bg-blue-100",
  },
  connections: {
    Icon: Link2,
    iconColor: "#0f766e",
    iconBg: "bg-teal-100",
  },
  industrial: {
    Icon: Factory,
    iconColor: "#c2410c",
    iconBg: "bg-orange-100",
  },
  cng: {
    Icon: Fuel,
    iconColor: "#166534",
    iconBg: "bg-emerald-100",
  },
};

type KpiMetric = keyof typeof KPI_METRICS;

/**
 * Chart card header: title shares one line with legends (`headerRight`) then refresh (`cornerAction`); subtitle below if set.
 */
function ChartCard({
  title,
  subtitle,
  children,
  headerRight,
  cornerAction,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  /** e.g. refresh — same line as title & legends, after legends. */
  cornerAction?: React.ReactNode;
}) {
  const showToolbar = Boolean(headerRight || cornerAction);
  return (
    <div className="flex max-h-[min(320px,46vh)] min-h-[200px] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-6px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.04] transition-shadow duration-200 hover:shadow-[0_8px_28px_-6px_rgba(15,23,42,0.12)]">
      <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-white via-white to-slate-50/40 p-2.5">
        <div className="mb-2 shrink-0 border-b border-slate-100/90 pb-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 flex-1 text-[13px] font-semibold leading-snug tracking-tight text-slate-800">
              {title}
            </h3>
            {showToolbar ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {headerRight}
                {cornerAction}
              </div>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-gradient-to-b from-slate-50/80 to-slate-100/30 p-1 ring-1 ring-inset ring-slate-200/70">
          {children}
        </div>
      </div>
    </div>
  );
}

function ChartRefreshButton({
  busy,
  onClick,
  title,
}: {
  busy: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-6 w-6 shrink-0 border-slate-300 p-0 text-slate-600 hover:bg-slate-50"
      disabled={busy}
      onClick={onClick}
      aria-label={title}
      title={title}
    >
      <RefreshCw className={`h-[14px] w-[14px] ${busy ? "animate-spin" : ""}`} aria-hidden />
    </Button>
  );
}

const KPI = ({
  label,
  value,
  unit,
  metric,
}: {
  label: string;
  value: string;
  unit?: string;
  metric: KpiMetric;
}) => {
  const { Icon, iconColor, iconBg } = KPI_METRICS[metric];
  return (
    <div className="relative flex min-h-[3.5rem] items-center gap-2 overflow-hidden rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-900/[0.04] transition hover:shadow-md">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-inner ring-1 ring-black/[0.06] ${iconBg}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} style={{ color: iconColor }} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 text-left leading-tight">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-base font-bold tabular-nums tracking-tight text-slate-900 sm:text-lg">
          {value}
          {unit ? (
            <span className="ml-0.5 text-[10px] font-semibold text-slate-600 sm:text-[11px]">{unit}</span>
          ) : null}
        </p>
      </div>
    </div>
  );
};

const COMPANY_COLORS_HEX = OMC_COMPANY_NAMES.map((n) => hexToAm5Int(OMC_COMPANY_HEX[n]));

type GvAggBasePayload = {
  table: string;
  filters: Record<string, unknown>;
  date_column: string;
  date_from: string;
  date_to: string;
  /** Backend expects Python-style string entries (see tableanalytics API). */
  aggregations: string[];
  detail_fields: string[];
  order_by: string[];
  limit: number;
  skip: number;
};

function buildGvAggBasePayload(dateFrom: string, dateTo: string): GvAggBasePayload {
  return {
    table: "natural_gas_gv_connections",
    filters: {},
    date_column: "conn_date",
    date_from: dateFrom,
    date_to: dateTo,
    aggregations: ["['Total', 'sum', 'achieved_count']"],
    detail_fields: [],
    order_by: ["['Total', 'desc']"],
    limit: 0,
    skip: 0,
  };
}

/** 1 — Total sales KPI: empty `group_by`. */
const GV_TOTAL_SALES_KPI_GROUP_BY: string[] = [];
/** 2 — Sales by company. */
const GV_SALES_BY_COMPANY_GROUP_BY = ["gv_name"] as const;
/** 3 — Sales by GA name (`ga_name` on x-axis cluster groups). */
const GV_SALES_BY_GA_NAME_GROUP_BY = ["gv_name", "ga_name"] as const;
/** 4 — Sales trends (daily totals). */
const GV_SALES_TREND_GROUP_BY = ["conn_date"] as const;
/** 5 — Detailed overview table. */
const GV_DETAIL_GROUP_BY = ["gv_name", "conn_date"] as const;

/** Preferred column order for detail rows (API keys → one column each). */
const DETAIL_TABLE_COLUMN_ORDER: readonly string[] = ["gv_name", "conn_date", "total", "Total"];

/** Table header labels for `generate_data_aggregations` row keys. */
const DETAIL_COLUMN_HEADER: Record<string, string> = {
  gv_name: "GV name",
  conn_date: "Connection date",
  total: "Total",
  Total: "Total",
};

function detailColumnHeader(fieldKey: string): string {
  return DETAIL_COLUMN_HEADER[fieldKey] ?? fieldKey.replace(/_/g, " ");
}

/** Read cell value: `total` / `Total` both map to the same measure. */
function detailCellValue(row: Record<string, unknown>, fieldKey: string): unknown {
  if (fieldKey === "total" || fieldKey === "Total") {
    return row.total ?? row.Total ?? row.TOTAL ?? row[fieldKey];
  }
  return row[fieldKey];
}

function isPlainObjectRow(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/** Parse string bodies (some gateways return JSON as text). */
function coerceJsonValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return raw;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return raw;
  }
}

/**
 * Unwrap table-analytics envelopes: `{ data: [...] }`, `{ success, data }`, nested `data`, etc.
 */
function normalizeAggregationRows(raw: unknown): Record<string, unknown>[] {
  raw = coerceJsonValue(raw);
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (isPlainObjectRow(raw[0])) return raw as Record<string, unknown>[];
    return [];
  }

  if (!isPlainObjectRow(raw)) return [];

  const o = raw as Record<string, unknown>;

  if (typeof o.success === "boolean" && o.data !== undefined) {
    const inner = normalizeAggregationRows(o.data);
    if (inner.length > 0) return inner;
  }

  const listKeys = [
    "data",
    "rows",
    "results",
    "records",
    "items",
    "list",
    "values",
    "content",
    "result",
  ] as const;

  for (const k of listKeys) {
    const v = o[k];
    if (!Array.isArray(v) || v.length === 0) continue;
    const nested = normalizeAggregationRows(v);
    if (nested.length > 0) return nested;
  }

  if (o.data !== undefined) {
    return normalizeAggregationRows(o.data);
  }

  return [];
}

/** Axios `response.data` → row array (same as normalize, explicit for call sites). */
function rowsFromApiResponse(payload: unknown): Record<string, unknown>[] {
  return normalizeAggregationRows(payload);
}

function aggregationRequestErrorMessage(reason: unknown): string {
  if (axios.isAxiosError(reason)) {
    const d = reason.response?.data as { message?: string; detail?: string } | undefined;
    if (d?.message) return String(d.message);
    if (d?.detail) return String(d.detail);
    if (reason.response?.status != null) {
      return `${reason.response.status} ${reason.message}`.trim();
    }
    return reason.message;
  }
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    return v % 1 === 0 ? v.toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  return String(v);
}

function rowTotal(r: Record<string, unknown>): number {
  const t = r.total ?? r.Total ?? r.TOTAL;
  const n = typeof t === "number" ? t : Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Sales-by-company API rows: `gv_name` + `total` (see `data` array in response envelope). */
function companyRowToCategoryValue(r: Record<string, unknown>): CategoryValue {
  return {
    category: String(r.gv_name ?? r.gvName ?? "").trim() || "—",
    value: rowTotal(r),
  };
}

function trendCategoryLabel(r: Record<string, unknown>, index: number): string {
  const raw = r.conn_date ?? r.Conn_date ?? r.date ?? r.Date ?? r.period ?? r.day;
  if (raw == null || raw === "") return `Point ${index + 1}`;
  const s = String(raw);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  }
  return s;
}

/** Map trend aggregation rows to line chart points (sorted by date when `conn_date` / `date` is present). */
function rowsToTrendLineData(rows: Record<string, unknown>[]): CategoryValue[] {
  if (!rows.length) return [];
  const decorated = rows.map((r, i) => {
    const raw = r.conn_date ?? r.Conn_date ?? r.date ?? r.Date ?? r.period;
    const t = raw != null ? new Date(String(raw)).getTime() : NaN;
    const sortKey = Number.isFinite(t) ? t : i;
    return {
      category: trendCategoryLabel(r, i),
      value: rowTotal(r),
      sortKey,
    };
  });
  decorated.sort((a, b) => a.sortKey - b.sortKey);
  return decorated.map(({ category, value }) => ({ category, value }));
}

/** Cycle OMC brand colours for arbitrary GV names. */
function colorHexForGvIndex(i: number): string {
  return OMC_COMPANY_HEX[OMC_COMPANY_NAMES[i % OMC_COMPANY_NAMES.length]!]!;
}

function gvNameFromRow(r: Record<string, unknown>): string {
  return String(r.gv_name ?? r.gvName ?? "").trim();
}

function gaNameFromRow(r: Record<string, unknown>): string {
  return String(r.ga_name ?? r.gaName ?? "").trim() || "—";
}

const GV_GA_MERGE_KEY = "\u001f";

/**
 * One bar per merged (GV × GA) row from the API; `groupKey` = GV for collapsed X labels.
 * X-axis shows one company name per consecutive group (tooltip still has full "GV — GA").
 */
function buildGvGaPerAreaColumns(rows: Record<string, unknown>[]): {
  data: CategoryValue[];
  categoryColorByName: Record<string, number>;
  gvLegendItems: { name: string; hex: string }[];
} {
  const merged = new Map<string, { gv: string; ga: string; value: number }>();
  for (const r of rows) {
    const gv = gvNameFromRow(r) || "—";
    const ga = gaNameFromRow(r);
    const key = `${gv}${GV_GA_MERGE_KEY}${ga}`;
    const v = rowTotal(r);
    const prev = merged.get(key);
    if (prev) prev.value += v;
    else merged.set(key, { gv, ga, value: v });
  }

  const sortedGvs = [...new Set([...merged.values()].map((x) => x.gv))].sort((a, b) =>
    a.localeCompare(b)
  );
  const gvOrderIndex = new Map(sortedGvs.map((g, i) => [g, i]));

  const data: CategoryValue[] = [...merged.values()]
    .sort((a, b) => {
      const g = a.gv.localeCompare(b.gv);
      if (g !== 0) return g;
      return a.ga.localeCompare(b.ga);
    })
    .map(({ gv, ga, value }) => ({
      category: `${gv} — ${ga}`,
      value,
      groupKey: gv,
      gaArea: ga,
      gvName: gv,
    }));

  const categoryColorByName: Record<string, number> = {};
  for (const { gv, ga } of merged.values()) {
    const cat = `${gv} — ${ga}`;
    const idx = gvOrderIndex.get(gv) ?? 0;
    categoryColorByName[cat] = hexToAm5Int(colorHexForGvIndex(idx));
  }

  const gvLegendItems = sortedGvs.map((name, i) => ({
    name,
    hex: colorHexForGvIndex(i),
  }));

  return { data, categoryColorByName, gvLegendItems };
}

function niceYMax(values: number[], fallback: number): number {
  const m = Math.max(0, ...values);
  if (!Number.isFinite(m) || m === 0) return fallback;
  return Math.max(fallback * 0.25, Math.ceil(m * 1.12));
}

const legendBtnOn =
  "border-slate-200/90 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50";
const legendBtnOff = "border-slate-100 bg-slate-50/80 text-slate-400 line-through opacity-70";

/** Read-only legend row — same pill style as company chart (top toolbar). */
function PaletteLegendPills({ items }: { items: { name: string; hex: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex max-w-[min(100%,28rem)] flex-wrap justify-end gap-1.5">
      {items.map((L) => (
        <span
          key={L.name}
          className="inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-full border border-slate-200/90 bg-white px-2 py-1 text-[9px] font-medium text-slate-700 shadow-sm"
          title={L.name}
        >
          <span
            className="h-2 w-3 shrink-0 rounded-sm ring-1 ring-black/10"
            style={{ backgroundColor: L.hex }}
            aria-hidden
          />
          <span className="truncate">{L.name}</span>
        </span>
      ))}
    </div>
  );
}

/** Company toggles — Sales by GV (labels from API). */
function CompanyLegendButtons({
  visibleByCompany,
  onToggleCompany,
  items,
}: {
  visibleByCompany: Record<string, boolean>;
  onToggleCompany: (name: string) => void;
  items: { name: string; hex: string }[];
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {items.map((L) => {
        const on = visibleByCompany[L.name] !== false;
        return (
          <button
            key={L.name}
            type="button"
            onClick={() => onToggleCompany(L.name)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-medium transition-all ${
              on ? legendBtnOn : legendBtnOff
            }`}
            aria-pressed={on}
            title={on ? `Hide ${L.name}` : `Show ${L.name}`}
          >
            <span
              className="h-2 w-3 shrink-0 rounded-sm ring-1 ring-black/10"
              style={{ backgroundColor: on ? L.hex : "#e2e8f0" }}
            />
            {L.name}
          </button>
        );
      })}
    </div>
  );
}

export const ExecutiveSummaryDashboard: React.FC = () => {
  const { dateFrom, dateTo, refreshToken } = useNaturalGasAnalyticsDate();
  const [gvAggRows, setGvAggRows] = useState<Record<string, unknown>[]>([]);
  const [companyChartRows, setCompanyChartRows] = useState<Record<string, unknown>[]>([]);
  const [stateChartRows, setStateChartRows] = useState<Record<string, unknown>[]>([]);
  const [totalSalesKpiRows, setTotalSalesKpiRows] = useState<Record<string, unknown>[]>([]);
  const [trendChartRows, setTrendChartRows] = useState<Record<string, unknown>[]>([]);
  const [gvAggLoading, setGvAggLoading] = useState(false);
  const [gvAggError, setGvAggError] = useState<string | null>(null);
  const [refreshingDetail, setRefreshingDetail] = useState(false);
  const [refreshingCompany, setRefreshingCompany] = useState(false);
  const [refreshingState, setRefreshingState] = useState(false);
  const [refreshingTrend, setRefreshingTrend] = useState(false);
  const [companyVisible, setCompanyVisible] = useState<Record<string, boolean>>({});

  const toggleCompany = useCallback((name: string) => {
    setCompanyVisible((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      const keys = Object.keys(next);
      const anyOn = keys.some((k) => next[k]);
      return anyOn ? next : prev;
    });
  }, []);

  useEffect(() => {
    const names = [...new Set(companyChartRows.map(gvNameFromRow).filter(Boolean))];
    if (names.length === 0) return;
    setCompanyVisible((prev) => {
      const next: Record<string, boolean> = {};
      for (const n of names) next[n] = prev[n] !== false;
      return next;
    });
  }, [companyChartRows]);

  /** Date window from shared NGC header (TDY / YDY / 1W / … / custom). */
  const aggDateRange = useMemo(
    () => ({ date_from: dateFrom, date_to: dateTo }),
    [dateFrom, dateTo]
  );

  const postAggregationRows = useCallback(
    async (groupBy: readonly string[] | string[], signal?: AbortSignal) => {
      const base = buildGvAggBasePayload(aggDateRange.date_from, aggDateRange.date_to);
      const res = await apiClient.post<unknown>(
        "/api/tableanalytics/generate_data_aggregations",
        { ...base, group_by: [...groupBy] },
        { signal }
      );
      return rowsFromApiResponse(res.data);
    },
    [aggDateRange]
  );

  const refreshDetail = useCallback(async () => {
    setRefreshingDetail(true);
    try {
      setGvAggRows(await postAggregationRows(GV_DETAIL_GROUP_BY));
    } catch {
      setGvAggRows([]);
    } finally {
      setRefreshingDetail(false);
    }
  }, [postAggregationRows]);

  const refreshCompany = useCallback(async () => {
    setRefreshingCompany(true);
    try {
      setCompanyChartRows(await postAggregationRows(GV_SALES_BY_COMPANY_GROUP_BY));
    } catch {
      setCompanyChartRows([]);
    } finally {
      setRefreshingCompany(false);
    }
  }, [postAggregationRows]);

  const refreshState = useCallback(async () => {
    setRefreshingState(true);
    try {
      setStateChartRows(await postAggregationRows(GV_SALES_BY_GA_NAME_GROUP_BY));
    } catch {
      setStateChartRows([]);
    } finally {
      setRefreshingState(false);
    }
  }, [postAggregationRows]);

  const refreshTrend = useCallback(async () => {
    setRefreshingTrend(true);
    try {
      setTrendChartRows(await postAggregationRows(GV_SALES_TREND_GROUP_BY));
    } catch {
      setTrendChartRows([]);
    } finally {
      setRefreshingTrend(false);
    }
  }, [postAggregationRows]);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      setGvAggLoading(true);
      setGvAggError(null);
      try {
        /** Order: 1 KPI, 2 company, 3 GA name cluster, 4 trend (`conn_date`), 5 detail table */
        const results = await Promise.allSettled([
          postAggregationRows(GV_TOTAL_SALES_KPI_GROUP_BY, ctrl.signal),
          postAggregationRows(GV_SALES_BY_COMPANY_GROUP_BY, ctrl.signal),
          postAggregationRows(GV_SALES_BY_GA_NAME_GROUP_BY, ctrl.signal),
          postAggregationRows(GV_SALES_TREND_GROUP_BY, ctrl.signal),
          postAggregationRows(GV_DETAIL_GROUP_BY, ctrl.signal),
        ]);

        const errors: string[] = [];
        const applyRows = (i: number, rows: Record<string, unknown>[]) => {
          if (i === 0) setTotalSalesKpiRows(rows);
          else if (i === 1) setCompanyChartRows(rows);
          else if (i === 2) setStateChartRows(rows);
          else if (i === 3) setTrendChartRows(rows);
          else setGvAggRows(rows);
        };
        results.forEach((res, i) => {
          if (res.status === "fulfilled") {
            applyRows(i, res.value);
          } else {
            applyRows(i, []);
            errors.push(aggregationRequestErrorMessage(res.reason));
          }
        });

      
      } catch (e: unknown) {
        if (isCancel(e)) return;
        const msg = e instanceof Error ? e.message : "Failed to load aggregations";
        setGvAggError(msg);
        setGvAggRows([]);
        setCompanyChartRows([]);
        setStateChartRows([]);
        setTrendChartRows([]);
        setTotalSalesKpiRows([]);
      } finally {
        if (!ctrl.signal.aborted) setGvAggLoading(false);
      }
    };
    void load();
    return () => ctrl.abort();
  }, [aggDateRange, postAggregationRows, refreshToken]);

  /** Empty `group_by` KPI payload: `[{ "total": 2870 }]` — single scalar for the period. */
  const totalSalesKpiDisplay = useMemo(() => {
    if (!totalSalesKpiRows.length) return null;
    let sum = 0;
    let any = false;
    for (const r of totalSalesKpiRows) {
      const v = rowTotal(r);
      sum += v;
      any = true;
    }
    return any ? sum.toLocaleString("en-IN") : null;
  }, [totalSalesKpiRows]);

  const totalConnectionsFromApi = useMemo(() => {
    if (!gvAggRows.length) return null;
    let sum = 0;
    let any = false;
    for (const r of gvAggRows) {
      const t = r.total ?? r.Total ?? r.TOTAL;
      const n = typeof t === "number" ? t : Number(t);
      if (Number.isFinite(n)) {
        sum += n;
        any = true;
      }
    }
    return any ? sum.toLocaleString("en-IN") : null;
  }, [gvAggRows]);

  const gvDetailColumns = useMemo(() => {
    if (!gvAggRows.length) return [] as string[];
    const keySet = new Set<string>();
    for (const r of gvAggRows) {
      for (const k of Object.keys(r)) {
        if (!k.startsWith("_")) keySet.add(k);
      }
    }
    if (keySet.has("total") && keySet.has("Total")) {
      keySet.delete("Total");
    } else if (keySet.has("Total") && !keySet.has("total")) {
      keySet.delete("Total");
      keySet.add("total");
    }
    const head = DETAIL_TABLE_COLUMN_ORDER.filter((k) => keySet.has(k));
    const headSet = new Set(head);
    const tail = [...keySet].filter((k) => !headSet.has(k)).sort();
    return [...head, ...tail];
  }, [gvAggRows]);

  /** Loading / empty state: show the three logical columns from the API contract. */
  const detailTableColSpan = Math.max(gvDetailColumns.length, 3);

  const companyLegendItems = useMemo(() => {
    const names = [...new Set(companyChartRows.map(gvNameFromRow).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    return names.map((n, i) => ({ name: n, hex: colorHexForGvIndex(i) }));
  }, [companyChartRows]);

  const companyCategoryColorByName = useMemo(() => {
    const m: Record<string, number> = {};
    companyLegendItems.forEach((L, i) => {
      m[L.name] = hexToAm5Int(colorHexForGvIndex(i));
    });
    return m;
  }, [companyLegendItems]);

  const dataByCompany = useMemo((): CategoryValue[] => {
    return companyChartRows
      .map((r) => companyRowToCategoryValue(r))
      .filter((d) => d.category !== "" && d.category !== "—")
      .filter((d) => companyVisible[d.category] !== false);
  }, [companyChartRows, companyVisible]);

  const companyYMax = useMemo(
    () => niceYMax(dataByCompany.map((d) => d.value), Y_MAX),
    [dataByCompany]
  );

  const { data: dataByGvGaAreas, categoryColorByName: gvGaCategoryColorByName, gvLegendItems } =
    useMemo(() => buildGvGaPerAreaColumns(stateChartRows), [stateChartRows]);

  const gvGaYMax = useMemo(
    () => niceYMax(dataByGvGaAreas.map((d) => d.value), Y_MAX),
    [dataByGvGaAreas]
  );

  const gaHorizontalRows = useMemo((): GaHorizontalBarRow[] => {
    if (dataByGvGaAreas.length === 0) return [];
    const gaCounts = new Map<string, number>();
    for (const d of dataByGvGaAreas) {
      const ga = d.gaArea ?? "";
      gaCounts.set(ga, (gaCounts.get(ga) ?? 0) + 1);
    }
    const maxV = Math.max(1, ...dataByGvGaAreas.map((d) => d.value));
    return [...dataByGvGaAreas]
      .sort((a, b) => b.value - a.value)
      .map((d) => {
        const ga = d.gaArea ?? "—";
        const gv = d.gvName ?? "—";
        const dup = (gaCounts.get(ga) ?? 0) > 1;
        const name = dup ? `${ga} (${gv})` : ga;
        const rgb = gvGaCategoryColorByName[d.category];
        const fill = am5IntToCssHex(rgb ?? 0x2563eb);
        const scorePct = Math.round((d.value / maxV) * 1000) / 10;
        return {
          name,
          value: d.value,
          fill,
          gaArea: ga,
          gvName: gv,
          scorePct,
        };
      });
  }, [dataByGvGaAreas, gvGaCategoryColorByName]);

  /** Daily trend from API with `group_by: ["conn_date"]` (`conn_date` + `total`). */
  const dataTrend = useMemo(() => rowsToTrendLineData(trendChartRows), [trendChartRows]);

  const trendYMax = useMemo(
    () => niceYMax(dataTrend.map((d) => d.value), Y_MAX),
    [dataTrend]
  );

  const detailBusy = gvAggLoading || refreshingDetail;
  const companyBusy = gvAggLoading || refreshingCompany;
  const stateBusy = gvAggLoading || refreshingState;
  const trendBusy = gvAggLoading || refreshingTrend;

  return (
    <NaturalGasDashboardShell>
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-1.5 lg:grid-cols-4">
        <KPI
          label="Total sales"
          value={gvAggLoading ? "…" : totalSalesKpiDisplay ?? "—"}
          metric="sales"
        />
        <KPI
          label="Total connections"
          value={detailBusy ? "…" : totalConnectionsFromApi ?? "—"}
          metric="connections"
        />
        <KPI label="Industrial customers" value="—" metric="industrial" />
        <KPI label="CNG stations" value="—" metric="cng" />
      </div>

      {/* Charts row: company | GA | trend — one horizontal row (4:5:3), shrinks with min-w-0 */}
      <div className="flex min-h-0 w-full min-w-0 flex-row flex-nowrap gap-1.5">
        <div className="flex min-h-0 min-w-0 flex-[3.2] flex-col">
          <ChartCard
            title="Sales by company"
            cornerAction={
              <ChartRefreshButton
                busy={companyBusy}
                onClick={refreshCompany}
                title="Refresh sales by company"
              />
            }
            headerRight={
              <CompanyLegendButtons
                visibleByCompany={companyVisible}
                onToggleCompany={toggleCompany}
                items={companyLegendItems}
              />
            }
          >
            <div className={FIXED_PLOT_WRAP_CLASS}>
              <NgMultiColorColumnChart
                data={dataByCompany}
                colors={COMPANY_COLORS_HEX}
                categoryColorByName={companyCategoryColorByName}
                valueLabel="Total"
                valueUnit="count"
                yMin={0}
                yMax={companyYMax}
                className={EXEC_CHART_PLOT_CLASS}
                scrollbarVisibleCategories={5}
                showValueLabels={false}
                emphasizeCategoryScrollbar
              />
            </div>
          </ChartCard>
        </div>
        <div className="flex min-h-0 min-w-0 flex-[4.5] flex-col">
          <ChartCard
            title="Sales by GA area"
            // subtitle="Horizontal bars: GA area on the left, sales (count) on the bottom axis; colour = company (GV)"
            headerRight={<PaletteLegendPills items={gvLegendItems} />}
            cornerAction={
              <ChartRefreshButton
                busy={stateBusy}
                onClick={refreshState}
                title="Refresh GA breakdown"
              />
            }
          >
            <div className={CHART_SCROLL_CLASS}>
              <SalesByGaAreaHorizontalBarChart
                rows={gaHorizontalRows}
                xMax={gvGaYMax}
                embeddedInCard
                className={EXEC_CHART_PLOT_CLASS}
              />
            </div>
          </ChartCard>
        </div>
        <div className="flex min-h-0 min-w-0 flex-[3.2] flex-col">
          <ChartCard
            title="Sales trends"
            cornerAction={
              <ChartRefreshButton
                busy={trendBusy}
                onClick={refreshTrend}
                title="Refresh sales trend (conn_date)"
              />
            }
            headerRight={
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2 py-1 text-[9px] font-medium text-slate-600 shadow-sm">
                <span
                  className="h-2 w-4 shrink-0 rounded-sm ring-1 ring-black/10"
                  style={{ backgroundColor: OMC_COMPANY_HEX.HPCL }}
                  aria-hidden
                />
                Sales trend
              </div>
            }
          >
            <div className={FIXED_PLOT_WRAP_CLASS}>
              <NgLineChart
                data={dataTrend}
                color={hexToAm5Int(OMC_COMPANY_HEX.HPCL)}
                fillOpacity={0.12}
                valueLabel="Sales trend"
                valueUnit="count"
                showLegend={false}
                yMin={0}
                yMax={trendYMax}
                className={EXEC_CHART_PLOT_CLASS}
                scrollbarVisibleCategories={5}
              />
            </div>
          </ChartCard>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_4px_20px_-6px_rgba(15,23,42,0.09)] ring-1 ring-slate-900/[0.04]">
        <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 flex-1 text-[13px] font-semibold tracking-tight text-slate-800">
              Detailed data overview
            </h3>
            <ChartRefreshButton
              busy={detailBusy}
              onClick={refreshDetail}
              title="Refresh detailed table"
            />
          </div>
        </div>
        <div className="max-h-[min(260px,42vh)] overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="sticky top-0 border-b border-slate-200 bg-slate-100/95 backdrop-blur-sm">
                {(gvDetailColumns.length > 0
                  ? gvDetailColumns
                  : (["gv_name", "conn_date", "total"] as const)
                ).map((fieldKey) => (
                  <th
                    key={fieldKey}
                    className="px-2 py-2 text-left text-[11px] font-semibold text-slate-800"
                  >
                    {detailColumnHeader(fieldKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailBusy ? (
                <tr>
                  <td
                    colSpan={detailTableColSpan}
                    className="px-2 py-6 text-center text-slate-500"
                  >
                    Loading data…
                  </td>
                </tr>
              ) : gvAggError ? (
                <tr>
                  <td
                    colSpan={detailTableColSpan}
                    className="px-2 py-6 text-center text-red-600"
                  >
                    {gvAggError}
                  </td>
                </tr>
              ) : gvAggRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={detailTableColSpan}
                    className="px-2 py-6 text-center text-slate-500"
                  >
                    No rows returned for this period.
                  </td>
                </tr>
              ) : (
                gvAggRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100/90 transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-slate-100/70"
                  >
                    {gvDetailColumns.map((col) => (
                      <td key={col} className="px-2 py-1.5 text-slate-800">
                        {formatCell(detailCellValue(row, col))}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </NaturalGasDashboardShell>
  );
};
