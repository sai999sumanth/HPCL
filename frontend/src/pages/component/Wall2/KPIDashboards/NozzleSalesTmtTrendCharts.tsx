import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { DryoutZoneGroupedBarChart } from "./DryoutZoneGroupedBarChart";
import { ZONE_COLOR_PALETTE } from "@/components/widgets/zone-grouped-bar";
import { apiClient } from "@/services/apiClient";
import { cn } from "@/@/lib/utils";
import { Loader2, RotateCcw, Maximize2, Minimize2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/@/components/ui/dropdown-menu";
import NoDataDisplay from "@/components/common/NoDataDisplay";
import PerformanceScoreLineChart from "./PerformanceScoreLineChart";

const API_NOZZLE_TMT = "/api/nozzlesales/nozzle_sales_tmt";

const NOZZLE_ACTION_DAILY   = "nozzle_daily_sales_tmt";
const NOZZLE_ACTION_MONTHLY = "nozzle_monthly_sales_tmt";

export const NOZZLE_MS_OPTIONS  = ["MS", "POWER 100","POWER 95","POWER 99","E20"] as const;
export const NOZZLE_HSD_OPTIONS = ["HSD","TURBO"] as const;
export const NOZZLE_ALL_PRODUCTS: string[] = [...NOZZLE_MS_OPTIONS, ...NOZZLE_HSD_OPTIONS];

const SERIES_LABEL = "Nozzle sales";

export type NozzleCrossFilterRow = {
  key: string; cond: string; value: string; values: unknown[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeCrossFilters(
  cf: Array<{ key: string; cond: string; value: string }>
): NozzleCrossFilterRow[] {
  return cf.map((f) => {
    const key  = f.key.replace(/^"(.*)"$/, "$1");
    const cond = key.toUpperCase() === "DATE" ? "equals" : f.cond === "equals" ? "=" : f.cond;
    return { key, cond, value: f.value, values: [] };
  });
}

function stripDateFilters(rows: NozzleCrossFilterRow[]): NozzleCrossFilterRow[] {
  return rows.filter((r) => {
    const k = String(r.key).replace(/^"(.*)"$/, "$1").trim().toUpperCase();
    return k !== "DATE" && k !== "CARD_DATE";
  });
}

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function sortTime(a: string, b: string): number {
  const da = new Date(a).getTime(), db = new Date(b).getTime();
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  const re = /^([A-Za-z]{3})-(\d{4})$/;
  const ma = re.exec(a.trim()), mb = re.exec(b.trim());
  if (ma && mb) {
    const norm = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const ia = MONTH_ABBR.indexOf(norm(ma[1]!)), ib = MONTH_ABBR.indexOf(norm(mb[1]!));
    const ya = parseInt(ma[2]!, 10),              yb = parseInt(mb[2]!, 10);
    if (ya !== yb) return ya - yb;
    if (ia >= 0 && ib >= 0) return ia - ib;
  }
  return a.localeCompare(b);
}

function fmtMonth(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime()))
      return `${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
  } catch { /* ignore */ }
  const m = /^([A-Za-z]{3})-(\d{4})$/.exec(iso.trim());
  return m ? `${m[1]} ${m[2]}` : iso;
}

function fmtDay(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { /* ignore */ }
  return iso;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Number(n.toFixed(4)) : null;
}

function getValueSuffix(vk: string): string {
  return vk === "sales_volume" ? "TMT" : " TMT";
}

// ─────────────────────────────────────────────────────────────────────────────
// Key detection
// ─────────────────────────────────────────────────────────────────────────────

function detectPeriodKey(row: Record<string, unknown>, preferMonthly: boolean): string | null {
  const monthly = ["month_label", "month", "Month", "year_month", "period"];
  const daily   = ["transaction_date", "CARD_DATE", "date", "day", "txn_date", "sales_date"];
  for (const k of (preferMonthly ? [...monthly, ...daily] : [...daily, ...monthly])) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") return k;
  }
  return null;
}

function detectValueKey(row: Record<string, unknown>): string | null {
  for (const k of ["sales_volume","nozzle_sales_tmt","sales_tmt","tmt","TMT","total_tmt","value","qty","volume"]) {
    if (k in row && row[k] != null && row[k] !== "") return k;
  }
  for (const k of Object.keys(row)) {
    if (/date|month|zone|product|label|name|cat|code|sap|locn|connected_sites|plant/i.test(k)) continue;
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return k;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(parseFloat(v))) return k;
  }
  return null;
}

function detectZoneKey(row: Record<string, unknown>): string | null {
  const exact = Object.keys(row).find((k) => /^(zone|Zone|zone_name|ZONE)$/i.test(k));
  if (exact) return exact;
  return Object.keys(row).find((k) => /zone/i.test(k) && !/national/i.test(k)) ?? null;
}

function detectPlantKey(row: Record<string, unknown>): string | null {
  for (const k of ["plant","plant_name","location","location_name","sap_id","LOCN_CODE","name"]) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") return k;
  }
  return Object.keys(row).find(
    (k) => /plant|terminal|location/i.test(k) && !/transaction|sales|zone|product/i.test(k)
  ) ?? null;
}

function detectLocationKey(row: Record<string, unknown>): string | null {
  for (const k of ["location", "location_name", "name", "plant", "plant_name", "sap_id"]) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") return k;
  }
  return detectPlantKey(row);
}

// ─────────────────────────────────────────────────────────────────────────────
// Response extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractSlot(
  raw: unknown,
  slot: "overall" | "monthly" | "zone_wise" | "location_wise" | "daily_zone_product_nozzle_sales"
): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") return [];

  let cur: unknown = raw;
  for (let i = 0; i < 2; i++) {
    if (cur && typeof cur === "object" && !Array.isArray(cur) && "data" in (cur as object))
      cur = (cur as Record<string, unknown>).data;
    else break;
  }

  if (cur && typeof cur === "object" && !Array.isArray(cur)) {
    const obj = cur as Record<string, unknown>;
    if (slot === "monthly") {
      for (const k of ["overall", "monthly", "monthly_data"]) {
        const v = obj[k];
        if (Array.isArray(v) && v.length && typeof v[0] === "object")
          return v as Record<string, unknown>[];
      }
    }
    const arr = obj[slot];
    if (Array.isArray(arr) && arr.length && typeof arr[0] === "object")
      return arr as Record<string, unknown>[];

    for (const k of [
      "daily_zone_product_nozzle_sales",
      "nozzle_daily_sales_tmt",
      "nozzle_monthly_sales_tmt",
      "data", "rows", "result",
    ]) {
      const v = obj[k];
      if (Array.isArray(v) && v.length && typeof v[0] === "object")
        return v as Record<string, unknown>[];
    }
  }

  if (Array.isArray(cur) && cur.length && typeof cur[0] === "object")
    return cur as Record<string, unknown>[];

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart bundle types & builders
// ─────────────────────────────────────────────────────────────────────────────

type ChartBundle = {
  chartData: Record<string, unknown>[];
  groups: string[];
  suffix: string;
  groupKeyToOriginal?: Record<string, string>;
} | null;

function buildLineBundle(rows: Record<string, unknown>[], isMonthly: boolean): ChartBundle {
  if (!rows.length) return null;
  const sample = rows[0]!;
  const pk = detectPeriodKey(sample, isMonthly);
  if (!pk) return null;
  const vk = detectValueKey(sample);
  if (!vk) return null;
  const labelFn = isMonthly ? fmtMonth : fmtDay;
  const sorted = [...rows].sort((a, b) => sortTime(String(a[pk] ?? ""), String(b[pk] ?? "")));
  return {
    chartData: sorted.map((r) => ({
      cat:            String(r[pk] ?? ""),
      label:          labelFn(String(r[pk] ?? "")),
      [SERIES_LABEL]: toNum(r[vk]),
    })),
    groups: [SERIES_LABEL],
    suffix: getValueSuffix(vk),
  };
}

/**
 * Pivots rows that have a product_grp column into a single ChartBundle
 * where each product becomes its own series (line) on the same chart.
 * Falls back to buildLineBundle when no product key is found.
 */
function buildMultiProductLineBundle(
  rows: Record<string, unknown>[],
  isMonthly: boolean
): ChartBundle {
  if (!rows.length) return null;
  const sample = rows[0]!;
  const pk = detectPeriodKey(sample, isMonthly);
  if (!pk) return null;
  const vk = detectValueKey(sample);
  if (!vk) return null;

  const productKey =
    Object.keys(sample).find((k) => /^product_grp$/i.test(k)) ??
    Object.keys(sample).find((k) => /product/i.test(k));

  // No product key — single series fallback
  if (!productKey) return buildLineBundle(rows, isMonthly);

  const labelFn = isMonthly ? fmtMonth : fmtDay;
  const suffix  = getValueSuffix(vk);

  // All distinct products and periods
  const products = [...new Set(rows.map((r) => String(r[productKey] ?? "").trim()))].filter(Boolean).sort();
  const periods  = [...new Set(rows.map((r) => String(r[pk] ?? "").trim()))].filter(Boolean).sort(sortTime);

  if (products.length === 0) return null;

  // Single product — use standard single-series bundle so series label stays clean
  if (products.length === 1) {
    return buildLineBundle(rows, isMonthly);
  }

  // Pivot: one chartData row per period, one key per product
  const chartData = periods.map((period) => {
    const row: Record<string, unknown> = { cat: period, label: labelFn(period) };
    for (const prod of products) {
      let sum = 0, hit = false;
      for (const r of rows) {
        if (String(r[pk] ?? "").trim() !== period) continue;
        if (String(r[productKey] ?? "").trim() !== prod) continue;
        const v = toNum(r[vk]);
        if (v != null) { sum += v; hit = true; }
      }
      row[prod] = hit ? Number(sum.toFixed(4)) : null;
    }
    return row;
  });

  return { chartData, groups: products, suffix };
}

function buildGroupedBundle(
  rows: Record<string, unknown>[],
  dimKey: string,
  isMonthly: boolean
): ChartBundle {
  if (!rows.length) return null;
  const sample = rows[0]!;
  const pk = detectPeriodKey(sample, isMonthly);
  if (!pk) return null;
  const vk = detectValueKey(sample);
  if (!vk) return null;
  const labelFn = isMonthly ? fmtMonth : fmtDay;

  const dimCanon = (s: string) => s.trim().toUpperCase();

  const periods = [...new Set(rows.map((r) => String(r[pk] ?? "").trim()))].filter(Boolean).sort(sortTime);
  const canonSet = new Set<string>();
  const canonToOriginal = new Map<string, string>();
  const productTotalsByPeriodGroup = new Map<string, Record<string, number>>(); // key: period|group
  for (const r of rows) {
    const d = String(r[dimKey] ?? "").trim();
    if (!d) continue;
    const c = dimCanon(d);
    const period = String(r[pk] ?? "").trim();
    const key = `${period}|${c}`;
    if (r.product_totals) {
      productTotalsByPeriodGroup.set(key, r.product_totals as Record<string, number>);
    }
    canonSet.add(c);
    if (!canonToOriginal.has(c)) canonToOriginal.set(c, d);
  }
  const groups = [...canonSet].sort();

  const chartData = periods.map((period) => {
    const row: Record<string, unknown> = { cat: period, label: labelFn(period) };
    for (const g of groups) {
      let sum = 0;
      let hit = false;
      for (const r of rows) {
        if (String(r[pk] ?? "").trim() !== period) continue;
        if (dimCanon(String(r[dimKey] ?? "")) !== g) continue;
        const v = toNum(r[vk]);
        if (v != null) { sum += v; hit = true; }
      }
      row[g] = hit ? Number(sum.toFixed(4)) : null;
      // Also add product_totals_<group> key to store product totals for this group
      const productKey = `${period}|${g}`;
      const productTotals = productTotalsByPeriodGroup.get(productKey);
      if (productTotals) {
        row[`product_totals_${g}`] = productTotals;
      }
    }
    return row;
  });

  return {
    chartData,
    groups,
    suffix: getValueSuffix(vk),
    groupKeyToOriginal: Object.fromEntries(canonToOriginal),
  };
}

function aggregateRowsByPeriodAndDim(
  rows: Record<string, unknown>[],
  periodKey: string,
  dimKey: string,
  valueKey: string
): Record<string, unknown>[] {
  const sums = new Map<string, number>();
  const productSums = new Map<string, Map<string, number>>(); // key -> productGrp -> sum
  const meta = new Map<string, { p: unknown; d: unknown }>();
  
  for (const r of rows) {
    const p = String(r[periodKey] ?? "").trim();
    const d = String(r[dimKey] ?? "").trim();
    if (!p || !d) continue;
    const v = toNum(r[valueKey]);
    if (v == null) continue;
    
    const key = `${p}\x1e${d}`;
    sums.set(key, (sums.get(key) ?? 0) + v);
    
    // Track totals per product group
    const productGrp = String(r["product_grp"] ?? "").trim();
    if (productGrp) {
      if (!productSums.has(key)) {
        productSums.set(key, new Map<string, number>());
      }
      const productMap = productSums.get(key)!;
      productMap.set(productGrp, (productMap.get(productGrp) ?? 0) + v);
    }
    
    if (!meta.has(key)) meta.set(key, { p: r[periodKey], d: r[dimKey] });
  }
  
  const out: Record<string, unknown>[] = [];
  sums.forEach((sum, key) => {
    const m = meta.get(key);
    if (!m) return;
    const productTotals: Record<string, number> = {};
    const productMap = productSums.get(key);
    if (productMap) {
      for (const [grp, val] of productMap.entries()) {
        productTotals[grp] = val;
      }
    }
    const row = {
      [periodKey]: m.p,
      [dimKey]: m.d,
      [valueKey]: sum,
      product_totals: productTotals,
    };
    out.push(row);
    console.log("aggregateRowsByPeriodAndDim row:", row);
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload builders
// ─────────────────────────────────────────────────────────────────────────────

function applyProductFilters(
  body: Record<string, unknown>,
  _isMonthly: boolean,
  msProducts: string[],
  hsdProducts: string[]
): Record<string, unknown> {
  if (msProducts.length  > 0) body.ms_products  = msProducts;
  if (hsdProducts.length > 0) body.hsd_products = hsdProducts;
  return body;
}

function buildDailyPayload(
  cross: NozzleCrossFilterRow[],
  msProducts: string[],
  hsdProducts: string[]
): Record<string, unknown> {
  return applyProductFilters(
    { filters: [], drill_state: "", cross_filters: cross, segregation: [], action: NOZZLE_ACTION_DAILY },
    false, msProducts, hsdProducts
  );
}

function buildNozzleMonthlyOverallPayload(
  cross: NozzleCrossFilterRow[],
  msProducts: string[],
  hsdProducts: string[]
): Record<string, unknown> {
  return applyProductFilters(
    {
      filters: [],
      level_filter: {},
      cross_filters: stripDateFilters(cross),
      segregation: [],
      action: NOZZLE_ACTION_MONTHLY,
    },
    true, msProducts, hsdProducts
  );
}

export type NozzleDrillSelection = {
  zone?: string;
  region?: string;
  sales_area?: string;
};

function nozzleFilterRow(key: string, value: string) {
  return { key, cond: "equals" as const, value, values: [] as unknown[] };
}

function buildNozzleMonthlyDrillPayload(
  sel: NozzleDrillSelection,
  cross: NozzleCrossFilterRow[],
  msProducts: string[],
  hsdProducts: string[]
): Record<string, unknown> {
  const filters: Array<{ key: string; cond: string; value: string; values: unknown[] }> = [];
  if (sel.zone)       filters.push(nozzleFilterRow("zone",       sel.zone));
  if (sel.region)     filters.push(nozzleFilterRow("region",     sel.region));
  if (sel.sales_area) filters.push(nozzleFilterRow("sales_area", sel.sales_area));

  let level: "zone" | "region" | "sales_area";
  if (!sel.zone)        level = "zone";
  else if (!sel.region) level = "zone";
  else if (!sel.sales_area) level = "region";
  else level = "sales_area";

  return applyProductFilters(
    {
      filters,
      level_filter: { level },
      cross_filters: stripDateFilters(cross),
      segregation: [],
      action: NOZZLE_ACTION_MONTHLY,
    },
    true, msProducts, hsdProducts
  );
}

type NozzleDrillPhase = "zones" | "regions" | "sales_areas" | "locations";

function getNozzleDrillPhase(sel: NozzleDrillSelection): NozzleDrillPhase {
  if (!sel.zone)        return "zones";
  if (!sel.region)      return "regions";
  if (!sel.sales_area)  return "sales_areas";
  return "locations";
}

function unwrapNozzlePayload(raw: unknown): Record<string, unknown> | null {
  let cur: unknown = raw;
  for (let i = 0; i < 2; i++) {
    if (cur && typeof cur === "object" && !Array.isArray(cur) && "data" in (cur as object))
      cur = (cur as Record<string, unknown>).data;
    else break;
  }
  if (cur && typeof cur === "object" && !Array.isArray(cur)) return cur as Record<string, unknown>;
  return null;
}

function extractNozzleDrillRows(raw: unknown, phase: NozzleDrillPhase): Record<string, unknown>[] {
  const root = unwrapNozzlePayload(raw);
  if (!root) return [];
  const keysByPhase: Record<NozzleDrillPhase, string[]> = {
    zones:       ["zone",       "zone_data",       "data", "nozzle_monthly_sales_tmt", "zone_wise",     "overall_data"],
    regions:     ["region",     "region_data",     "zone_data",       "data", "nozzle_monthly_sales_tmt"],
    sales_areas: ["sales_area", "sales_area_data", "region_data",     "data", "nozzle_monthly_sales_tmt"],
    locations:   ["location",   "location_data",   "sales_area_data", "data", "location_wise", "nozzle_monthly_sales_tmt"],
  };
  for (const k of keysByPhase[phase]) {
    const v = root[k];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") return v as Record<string, unknown>[];
  }
  for (const k of Object.keys(root)) {
    const v = root[k];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") return v as Record<string, unknown>[];
  }
  return [];
}

function detectRegionKey(row: Record<string, unknown>): string | null {
  for (const k of ["region", "region_name", "Region"]) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") return k;
  }
  return Object.keys(row).find((k) => /region/i.test(k) && !/national/i.test(k)) ?? null;
}

function detectSalesAreaKey(row: Record<string, unknown>): string | null {
  for (const k of ["sales_area", "sales_area_name", "Sales_area"]) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") return k;
  }
  return Object.keys(row).find((k) => /sales_area/i.test(k)) ?? null;
}

function getNozzleGroupKeyForPhase(phase: NozzleDrillPhase, sample: Record<string, unknown>): string | null {
  if (phase === "zones")       return detectZoneKey(sample);
  if (phase === "regions")     return detectRegionKey(sample);
  if (phase === "sales_areas") return detectSalesAreaKey(sample);
  return detectLocationKey(sample);
}

type NozzleUiDrillLevel = "zone" | "region" | "sales_area" | "location";

const NOZZLE_DRILL_LABELS: Record<NozzleUiDrillLevel, string> = {
  zone: "Zone", region: "Region", sales_area: "Sales area", location: "Location",
};

const NOZZLE_MONTHLY_DRILL_ORDER: NozzleUiDrillLevel[] = ["zone", "region", "sales_area", "location"];

function NozzleDrillStateIndicator({ level }: { level: NozzleUiDrillLevel }) {
  const states = NOZZLE_MONTHLY_DRILL_ORDER.map((k) => NOZZLE_DRILL_LABELS[k]);
  const drillIndex = Math.max(0, NOZZLE_MONTHLY_DRILL_ORDER.indexOf(level));
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillIndex]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div key={index}
            className={`w-2 h-2 rounded-full ${index === drillIndex ? "bg-blue-600" : "bg-gray-300"}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

function NozzleSwipeableLegend({ groups, colors }: { groups: string[]; colors: number[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  };
  return (
    <div className="flex items-center gap-1 w-full min-w-0 px-1 pt-1 pb-1">
      <button type="button" onClick={() => scroll("left")}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-100 text-xs">‹</button>
      <div ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 py-0.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {groups.map((g, i) => {
          const hex = colors[i % colors.length] ?? 0x888888;
          const cssColor = `#${hex.toString(16).padStart(6, "0")}`;
          return (
            <div key={g} className="flex items-center gap-1 shrink-0">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cssColor }} />
              <span className="text-[10px] text-gray-600 whitespace-nowrap">{g}</span>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => scroll("right")}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-100 text-xs">›</button>
    </div>
  );
}

export interface NozzleSalesTmtTrendChartsProps {
  crossFilters: Array<{ key: string; cond: string; value: string }>;
}

const NozzleSalesTmtTrendCharts = ({ crossFilters = [] }: NozzleSalesTmtTrendChartsProps) => {
  const [periodView, setPeriodView] = useState<"daily" | "monthly">("daily");
  const [scopeMode,  setScopeMode]  = useState<"overall" | "zone">("overall");
  const [drillSelection, setDrillSelection] = useState<NozzleDrillSelection>({});
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const msProducts  = useMemo(
    () => selectedProducts.filter((p) => (NOZZLE_MS_OPTIONS  as readonly string[]).includes(p)),
    [selectedProducts]
  );
  const hsdProducts = useMemo(
    () => selectedProducts.filter((p) => (NOZZLE_HSD_OPTIONS as readonly string[]).includes(p)),
    [selectedProducts]
  );

  const [loadingMain,  setLoadingMain]  = useState(false);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [errorMain,    setErrorMain]    = useState<string | null>(null);
  const [errorDrill,   setErrorDrill]   = useState<string | null>(null);

  // Single bundle for all cases — multi-product daily will have multiple groups (one per product)
  const [mainBundle,  setMainBundle]  = useState<ChartBundle>(null);
  const [drillBundle, setDrillBundle] = useState<ChartBundle>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  const crossFiltersKey = useMemo(() => JSON.stringify(crossFilters), [crossFilters]);
  const normalizedCross = useMemo(() => normalizeCrossFilters(crossFilters), [crossFiltersKey]);
  const drillFilterKey  = useMemo(
    () => [drillSelection.zone ?? "", drillSelection.region ?? "", drillSelection.sales_area ?? ""].join("|"),
    [drillSelection.zone, drillSelection.region, drillSelection.sales_area]
  );
  const fetchSeq = useRef(0);

  const drillUiLevel = useMemo<NozzleUiDrillLevel>(() => {
    if (!drillSelection.zone)        return "zone";
    if (!drillSelection.region)      return "region";
    if (!drillSelection.sales_area)  return "sales_area";
    return "location";
  }, [drillSelection.zone, drillSelection.region, drillSelection.sales_area]);

  const allSelected  = selectedProducts.length === NOZZLE_ALL_PRODUCTS.length;
  const productLabel = allSelected
    ? "All Products"
    : selectedProducts.length === 0
      ? "Select Product"
      : selectedProducts.length === 1
        ? selectedProducts[0]
        : `${selectedProducts[0]} +${selectedProducts.length - 1} more`;

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (periodView === "daily" && normalizedCross.length === 0) {
      setMainBundle(null);
      setDrillBundle(null);
      setDrillSelection({});
      return;
    }

    const seq = ++fetchSeq.current;

    // ── DAILY ────────────────────────────────────────────────────────────
    if (periodView === "daily") {
      setLoadingMain(true);
      setErrorMain(null);
      setDrillBundle(null);
      setDrillSelection({});
      try {
        const body = buildDailyPayload(normalizedCross, msProducts, hsdProducts);
        const res  = await apiClient.post(API_NOZZLE_TMT, body);
        if (seq !== fetchSeq.current) return;
        const data = res?.data ?? res;
        const obj  = data as Record<string, unknown> | undefined;
        if (obj && typeof obj === "object" && obj.status === false) {
          setErrorMain(String(obj.message ?? "Request failed"));
          setMainBundle(null);
          return;
        }
        const rows = extractSlot(data, "daily_zone_product_nozzle_sales");
        // Use multi-product pivot — if product_grp present & multiple products,
        // produces one series per product on the same chart; otherwise single series.
        setMainBundle(buildMultiProductLineBundle(rows, false));
      } catch (e) {
        if (seq !== fetchSeq.current) return;
        setErrorMain(e instanceof Error ? e.message : "Failed to load daily nozzle sales");
        setMainBundle(null);
      } finally {
        if (seq === fetchSeq.current) setLoadingMain(false);
      }
      return;
    }

    // // ── MONTHLY OVERALL ──────────────────────────────────────────────────
    // if (periodView === "monthly" && scopeMode === "overall") {
    //   setLoadingMain(true);
    //   setErrorMain(null);
    //   setDrillBundle(null);
    //   setDrillSelection({});
    //   try {
    //     const body = buildNozzleMonthlyOverallPayload(normalizedCross, msProducts, hsdProducts);
    //     const res  = await apiClient.post(API_NOZZLE_TMT, body);
    //     if (seq !== fetchSeq.current) return;
    //     const data = res?.data ?? res;
    //     const obj  = data as Record<string, unknown> | undefined;
    //     if (obj && typeof obj === "object" && obj.status === false) {
    //       setErrorMain(String(obj.message ?? "Request failed"));
    //       setMainBundle(null);
    //       return;
    //     }
    //     const rows = extractSlot(data, "monthly");
    //     setMainBundle(buildLineBundle(rows, true));
    //   } catch (e) {
    //     if (seq !== fetchSeq.current) return;
    //     setErrorMain(e instanceof Error ? e.message : "Failed to load monthly nozzle sales");
    //     setMainBundle(null);
    //   } finally {
    //     if (seq === fetchSeq.current) setLoadingMain(false);
    //   }
    //   return;
    // }
    // ── MONTHLY OVERALL ──────────────────────────────────────────────────
if (periodView === "monthly" && scopeMode === "overall") {
  setLoadingMain(true);
  setErrorMain(null);
  setDrillBundle(null);
  setDrillSelection({});
  try {
    const body = buildNozzleMonthlyOverallPayload(normalizedCross, msProducts, hsdProducts);
    const res  = await apiClient.post(API_NOZZLE_TMT, body);
    if (seq !== fetchSeq.current) return;
    const data = res?.data ?? res;
    const obj  = data as Record<string, unknown> | undefined;
    if (obj && typeof obj === "object" && obj.status === false) {
      setErrorMain(String(obj.message ?? "Request failed"));
      setMainBundle(null);
      return;
    }
    // const rows = extractSlot(data, "monthly");
      const rows = extractSlot(data, "monthly") ?? extractSlot(data, "overall");
      setMainBundle(buildMultiProductLineBundle(rows, true));
  } catch (e) {
    if (seq !== fetchSeq.current) return;
    setErrorMain(e instanceof Error ? e.message : "Failed to load monthly nozzle sales");
    setMainBundle(null);
  } finally {
    if (seq === fetchSeq.current) setLoadingMain(false);
  }
  return;
}

    // ── MONTHLY ZONE drill ───────────────────────────────────────────────
    setMainBundle(null);
    setLoadingDrill(true);
    setErrorDrill(null);
    setDrillBundle(null);

    try {
      const body = buildNozzleMonthlyDrillPayload(drillSelection, normalizedCross, msProducts, hsdProducts);
      const res  = await apiClient.post(API_NOZZLE_TMT, body);
      if (seq !== fetchSeq.current) return;
      const data = res?.data ?? res;
      console.log("Drill API response:", data);
      const obj  = data as Record<string, unknown> | undefined;
      if (obj && typeof obj === "object" && obj.status === false) {
        setErrorDrill(String(obj.message ?? "Drill request failed"));
        setDrillBundle(null);
        return;
      }
      const phase = getNozzleDrillPhase(drillSelection);
      const rows  = extractNozzleDrillRows(data, phase);
      console.log("Drill rows:", rows);
      if (!rows.length) { setDrillBundle(null); return; }
      const gk = getNozzleGroupKeyForPhase(phase, rows[0]!);
      if (!gk) { setDrillBundle(null); return; }
      const pk = detectPeriodKey(rows[0]!, true);
      const vk = detectValueKey(rows[0]!);
      if (!pk || !vk) { setDrillBundle(null); return; }
      const merged = aggregateRowsByPeriodAndDim(rows, pk, gk, vk);
      console.log("Merged drill rows:", merged);
      if (!merged.length) { setDrillBundle(null); return; }
      setDrillBundle(buildGroupedBundle(merged, gk, true));
    } catch (e) {
      if (seq !== fetchSeq.current) return;
      setErrorDrill(e instanceof Error ? e.message : "Failed to load drill data");
      setDrillBundle(null);
    } finally {
      if (seq === fetchSeq.current) setLoadingDrill(false);
    }
  }, [periodView, scopeMode, normalizedCross, msProducts, hsdProducts, drillFilterKey]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  useEffect(() => {
    setMainBundle(null);
    setDrillBundle(null);
    setDrillSelection({});
  }, [periodView, scopeMode]);

  // ── derived booleans ──────────────────────────────────────────────────────
  const isMonthlyZone = periodView === "monthly" && scopeMode === "zone";
  const isAnyLoading  = loadingMain || (isMonthlyZone && loadingDrill);
  const showDrillChart =
    isMonthlyZone && !loadingMain && !loadingDrill && !errorDrill &&
    !!drillBundle && drillBundle.chartData.length > 0;
  const showLineChart = !isMonthlyZone && !!mainBundle && mainBundle.chartData.length > 0;

  const chartHeight = isExpanded ? 640 : 440;

  const handleDrillBarClick = useCallback(
    (_periodValue: string, groupName: string) => {
      const apiName = drillBundle?.groupKeyToOriginal?.[groupName] ?? groupName;
      setDrillSelection((s) => {
        if (!s.zone)        return { ...s, zone: apiName };
        if (!s.region)      return { ...s, region: apiName };
        if (!s.sales_area)  return { ...s, sales_area: apiName };
        return s;
      });
    },
    [drillBundle?.groupKeyToOriginal]
  );

  const handleDrillBack = useCallback(() => {
    setDrillSelection((s) => {
      if (s.sales_area) { const { sales_area, ...rest } = s; return rest; }
      if (s.region)     { const { region, sales_area, ...rest } = s; return rest; }
      if (s.zone)       return {};
      return s;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
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
        className={cn(
          "border border-gray-200 bg-white shadow-sm transition-all duration-300",
          isExpanded
            ? "fixed inset-4 z-50 flex h-[calc(100vh-2rem)] min-h-0 flex-col shadow-2xl"
            : "h-fit w-full"
        )}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <CardHeader className={`pb-2 p-3 ${isExpanded ? "shrink-0" : ""}`}>
          <div className="flex flex-col gap-1">
            {/* Row 1 */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <CardTitle className="text-sm font-bold text-gray-800">
                  {SERIES_LABEL}
                </CardTitle>
                {periodView === "monthly" && scopeMode === "zone" && drillUiLevel !== "location" && (
                  <span className="flex items-center gap-0.5 text-[11px] text-blue-500">
                    <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full border border-blue-400 text-[9px] font-bold shrink-0">i</span>
                    Click a bar to drill down.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Product dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline"
                      className="h-6 min-w-[8rem] max-w-[13rem] justify-between gap-1 px-2 py-0 text-xs font-normal">
                      <span className="truncate text-left">{productLabel}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuLabel className="text-xs">Products</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      className="text-xs font-medium"
                      checked={allSelected}
                      onCheckedChange={(c) => setSelectedProducts(c ? [...NOZZLE_ALL_PRODUCTS] : [])}
                      onSelect={(e) => e.preventDefault()}
                    >
                      All Products
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {NOZZLE_ALL_PRODUCTS.map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt}
                        className="text-xs"
                        checked={selectedProducts.includes(opt)}
                        onCheckedChange={(c) =>
                          setSelectedProducts((p) =>
                            c ? [...p.filter((x) => x !== opt), opt] : p.filter((x) => x !== opt)
                          )
                        }
                        onSelect={(e) => e.preventDefault()}
                      >
                        {opt}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Daily / Monthly toggle */}
                <div className="flex rounded-md border border-gray-300 overflow-hidden">
                  <button type="button"
                    onClick={() => { setScopeMode("overall"); setPeriodView("daily"); }}
                    className={cn("px-2 py-1 text-xs font-medium",
                      periodView === "daily" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                    )}>
                    Daily
                  </button>
                  <button type="button"
                    onClick={() => setPeriodView("monthly")}
                    className={cn("px-2 py-1 text-xs font-medium border-l border-gray-300",
                      periodView === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                    )}>
                    Monthly
                  </button>
                </div>

                {/* Overall / Zone — monthly only */}
                {periodView === "monthly" && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="nozzle-tmt-scope"
                        checked={scopeMode === "overall"} onChange={() => setScopeMode("overall")}
                        className="w-3 h-3 text-blue-600" />
                      <span className="text-xs font-medium text-gray-700">Overall</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="nozzle-tmt-scope"
                        checked={scopeMode === "zone"} onChange={() => setScopeMode("zone")}
                        className="w-3 h-3 text-blue-600" />
                      <span className="text-xs font-medium text-gray-700">Zone</span>
                    </label>
                    {scopeMode === "zone" && <NozzleDrillStateIndicator level={drillUiLevel} />}
                    {scopeMode === "zone" && drillUiLevel !== "zone" && (
                      <button type="button" onClick={handleDrillBack}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100">
                        ← Back
                      </button>
                    )}
                  </div>
                )}

                <Button type="button" onClick={() => void fetchAll()} disabled={isAnyLoading}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  title="Refresh">
                  <RotateCcw className={cn("h-4 w-4", isAnyLoading && "animate-spin")} />
                </Button>
                <Button type="button" onClick={() => setIsExpanded((e) => !e)}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title={isExpanded ? "Minimize" : "Maximize"}>
                  {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Row 2: breadcrumb */}
            {periodView === "monthly" && scopeMode === "zone" &&
              (drillSelection.zone || drillSelection.region || drillSelection.sales_area) && (
                <div className="flex items-center flex-nowrap overflow-x-auto text-[11px] w-full" style={{ scrollbarWidth: "none" }}>
                  {[
                    drillSelection.zone       ? { label: "Zone",       value: drillSelection.zone }       : null,
                    drillSelection.region     ? { label: "Region",     value: drillSelection.region }     : null,
                    drillSelection.sales_area ? { label: "Sales area", value: drillSelection.sales_area } : null,
                  ].filter(Boolean).map((entry, i) => (
                    <span key={i} className="flex items-center">
                      {i > 0 && (
                        <span className="mx-1.5 text-blue-300 font-medium tracking-tighter shrink-0 whitespace-nowrap">——›</span>
                      )}
                      <span className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
                        <span className="text-gray-400 font-normal">{entry!.label}:</span>
                        <span className="font-semibold text-blue-700">{entry!.value}</span>
                      </span>
                    </span>
                  ))}
                </div>
              )}
          </div>
        </CardHeader>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <CardContent
          className={`p-2 pt-0 pb-2 relative ${isExpanded ? "flex min-h-0 flex-1 flex-col overflow-hidden" : ""}`}
        >
          <div
            className={cn("relative w-full", isExpanded && "flex min-h-0 flex-1 flex-col")}
            style={{ minHeight: chartHeight }}
          >
            {isAnyLoading ? (
              <div className={`flex items-center justify-center ${isExpanded ? "min-h-0 flex-1" : "py-16"}`}>
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : (errorMain || errorDrill) ? (
              <div className={isExpanded ? "min-h-0 flex-1 flex items-center justify-center" : "py-8"}>
                <NoDataDisplay />
              </div>
            ) : (
              <>
                {/* Single line chart — handles both single-series and multi-product-series */}
                {showLineChart && (
                  <PerformanceScoreLineChart
                    chartData={mainBundle!.chartData}
                    groups={mainBundle!.groups}
                    categoryField="cat"
                    categoryLabelField="label"
                    valueSuffix={mainBundle!.suffix}
                    xAxisLabelRotation={periodView === "daily" ? -90 : 0}
                    showScrollbar
                    height={isExpanded ? undefined : chartHeight}
                    className={isExpanded ? "min-h-0 w-full flex-1" : "w-full"}
                  />
                )}

                {/* Monthly zone drill — grouped bar chart */}
                {showDrillChart && (
                  <>
                    <DryoutZoneGroupedBarChart
                      chartData={drillBundle!.chartData}
                      groups={drillBundle!.groups}
                      categoryField="cat"
                      categoryLabelField="label"
                      valueSuffix={drillBundle!.suffix}
                      colors={ZONE_COLOR_PALETTE}
                      showLegend={drillUiLevel !== "location"}
                      smallLegend
                      fullBarTopLabels
                      seriesDisplayNames={drillBundle!.groups.map(
                        (g) => drillBundle!.groupKeyToOriginal?.[g] ?? g
                      )}
                      xAxisLabelRotation={0}
                      scrollbarCategoryThreshold={3}
                      scrollbarInitialVisibleCategories={drillUiLevel === "location" ? 1 : 3}
                      hideColumnBullets={false}
                      height={isExpanded ? 0 : chartHeight}
                      className={cn("w-full", isExpanded && "flex-1 min-h-[440px]")}
                      onBarClick={drillUiLevel === "location" ? undefined : handleDrillBarClick}
                    />
                    {drillUiLevel === "location" && drillBundle!.groups.length > 0 && (
                      <NozzleSwipeableLegend
                        groups={drillBundle!.groups}
                        colors={ZONE_COLOR_PALETTE}
                      />
                    )}
                  </>
                )}

                {/* No data */}
                {!showLineChart && !showDrillChart && (
                  <div className={isExpanded ? "min-h-0 flex-1 flex items-center justify-center" : "py-8"}>
                    <NoDataDisplay />
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default NozzleSalesTmtTrendCharts;

