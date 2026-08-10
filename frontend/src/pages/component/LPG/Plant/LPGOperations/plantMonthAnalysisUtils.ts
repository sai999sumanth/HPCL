/** Plant month analysis: shared types, constants, and pure helpers (charts + data shaping). */
/** Shared props for zone/plant grouped bar charts (vertical month labels, scrollbar after 10 categories) */
export const PLANT_MONTH_ZONE_BAR_CHART_PROPS = {
  xAxisLabelRotation: -90,
  scrollbarCategoryThreshold: 10,
} as const;
/** Raw API response row from plant_month_analysis (snake_case). Can be per month/plant or overall object. */
export interface PlantMonthAnalysisRawRow {
  Month?: string;
  Plant?: string;
  sap_id?: string;
  total_prod_cost_ly?: number;
  total_prod_cost_cy?: number;
  total_cost_mt_ly?: number;
  total_cost_mt_cy?: number;
  production_ly?: number;
  production_cy?: number;
  production_mt_ly?: number;
  production_mt_cy?: number;
  productivity_ly?: number;
  productivity_cy?: number;
  savings_ly?: number;
  savings_cy?: number;
  savings_mt_ly?: number;
  savings_mt_cy?: number;
  [key: string]: unknown;
}

/** One row from API response monthly_aggregated array (keys from backend, used directly for charts). */
export interface PlantMonthAnalysisMonthlyAggregatedRow {
  Month?: string;
  total_prod_cost_ly?: number;
  total_prod_cost_cy?: number;
  total_cost_mt_ly?: number;
  total_cost_mt_cy?: number;
  production_ly?: number;
  production_cy?: number;
  production_mt_ly?: number;
  production_mt_cy?: number;
  productivity_ly?: number;
  productivity_cy?: number;
  productivity?: number;
  savings_ly?: number;
  savings_cy?: number;
  savings_mt_ly?: number;
  savings_mt_cy?: number;
  [key: string]: unknown;
}

/** One row from API `zone_monthly_aggregated` (per zone per month) */
export interface PlantMonthZoneAggregatedRow {
  Month?: string;
  month_date?: string;
  zone?: string;
  Zone?: string;
  total_prod_cost_ly?: number;
  total_prod_cost_cy?: number;
  total_cost_mt_ly?: number;
  total_cost_mt_cy?: number;
  savings_ly?: number;
  savings_cy?: number;
  savings_mt_ly?: number;
  savings_mt_cy?: number;
  [key: string]: unknown;
}

/** One row from API `plant_monthly_aggregated` (per plant per month; includes zone for drilldown) */
export interface PlantMonthPlantAggregatedRow extends PlantMonthZoneAggregatedRow {
  Plant?: string;
  location_name?: string;
  sap_id?: string;
}

/** Chart row: aggregated by Month (one row per month) */
export interface PlantMonthAnalysisRow {
  Month: string;
  total_prod_cost_ly: number;
  total_prod_cost_cy: number;
  total_cost_mt_ly: number;
  total_cost_mt_cy: number;
  production_ly: number;
  production_cy: number;
  production_mt_ly: number;
  production_mt_cy: number;
  productivity_ly: number;
  productivity_cy: number;
  /** Monthly overall productivity from daily productivity API (merged for pivot) */
  productivity?: number;
  savings_ly: number;
  savings_cy: number;
  savings_mt_ly: number;
  savings_mt_cy: number;
}

const MONTH_ORDER: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

/** Full month name (or API variant) → 3-letter label for x-axis */
const MONTH_SHORT: Record<string, string> = {
  January: "Jan",
  February: "Feb",
  March: "Mar",
  April: "Apr",
  May: "May",
  June: "Jun",
  July: "Jul",
  August: "Aug",
  September: "Sep",
  October: "Oct",
  November: "Nov",
  December: "Dec",
};

export function monthToShort(month: string): string {
  if (!month) return month;
  return MONTH_SHORT[month] ?? month.slice(0, 3);
}

/** Monthly productivity overall item from lpg_operations_monthwise_productivity */
export interface MonthlyProductivityOverallItem {
  month_date: string;
  productivity: number;
}

/** Location/plant productivity item (for when a plant is selected) */
export interface MonthlyProductivityLocationItem {
  month_date: string;
  sap_id?: string;
  location?: string;
  zone?: string;
  productivity: number;
}

/** Format month_date "2025-09-01" -> "Sep 2025" */
export function formatMonthLabel(monthDate: string): string {
  try {
    const d = new Date(monthDate);
    const mon = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    return `${mon} ${year}`;
  } catch {
    return monthDate;
  }
}

/** Month name from month_date (e.g. "2025-01-01" -> "January") for merging with plant month analysis */
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function monthDateToMonthName(monthDate: string): string {
  try {
    const m = new Date(monthDate).getMonth();
    return MONTH_NAMES[m] ?? monthDate;
  } catch {
    return monthDate;
  }
}

/** Get a row by month name, or zero-filled. */
export function getMonthRow(data: PlantMonthAnalysisRow[], month: string): PlantMonthAnalysisRow {
  const r = data.find((x) => x.Month === month);
  if (r) return r;
  return {
    Month: month,
    total_prod_cost_ly: 0,
    total_prod_cost_cy: 0,
    total_cost_mt_ly: 0,
    total_cost_mt_cy: 0,
    production_ly: 0,
    production_cy: 0,
    production_mt_ly: 0,
    production_mt_cy: 0,
    productivity_ly: 0,
    productivity_cy: 0,
    savings_ly: 0,
    savings_cy: 0,
    savings_mt_ly: 0,
    savings_mt_cy: 0,
  };
}

/** Quarterly cost data: Jan separately; Apr+May+Jun/3; Jul+Aug+Sep/3; Oct+Nov+Dec/3. Computed in UI. */
export function getQuarterlyCostData(data: PlantMonthAnalysisRow[]): {
  costData: { Month: string; total_prod_cost_ly_cr: number; total_prod_cost_cy_cr: number }[];
  costMtData: { Month: string; total_cost_mt_ly: number; total_cost_mt_cy: number }[];
} {
  const CR = 1e7;
  const get = (m: string) => getMonthRow(data, m);
  const jan = get("January");
  const apr = get("April"), may = get("May"), jun = get("June");
  const jul = get("July"), aug = get("August"), sep = get("September");
  const oct = get("October"), nov = get("November"), dec = get("December");

  const q1_ly = apr.total_prod_cost_ly + may.total_prod_cost_ly + jun.total_prod_cost_ly;
  const q1_cy = apr.total_prod_cost_cy + may.total_prod_cost_cy + jun.total_prod_cost_cy;
  // Cost Per MT quarterly: (sum of cost_mt + sum of cost in crores) / 3
  const q1_mt_ly = ( (apr.total_cost_mt_ly + may.total_cost_mt_ly + jun.total_cost_mt_ly) + (apr.total_prod_cost_ly + may.total_prod_cost_ly + jun.total_prod_cost_ly) / CR ) / 3;
  const q1_mt_cy = ( (apr.total_cost_mt_cy + may.total_cost_mt_cy + jun.total_cost_mt_cy) + (apr.total_prod_cost_cy + may.total_prod_cost_cy + jun.total_prod_cost_cy) / CR ) / 3;

  const q2_ly = jul.total_prod_cost_ly + aug.total_prod_cost_ly + sep.total_prod_cost_ly;
  const q2_cy = jul.total_prod_cost_cy + aug.total_prod_cost_cy + sep.total_prod_cost_cy;
  const q2_mt_ly = ( (jul.total_cost_mt_ly + aug.total_cost_mt_ly + sep.total_cost_mt_ly) + (jul.total_prod_cost_ly + aug.total_prod_cost_ly + sep.total_prod_cost_ly) / CR ) / 3;
  const q2_mt_cy = ( (jul.total_cost_mt_cy + aug.total_cost_mt_cy + sep.total_cost_mt_cy) + (jul.total_prod_cost_cy + aug.total_prod_cost_cy + sep.total_prod_cost_cy) / CR ) / 3;

  const q3_ly = oct.total_prod_cost_ly + nov.total_prod_cost_ly + dec.total_prod_cost_ly;
  const q3_cy = oct.total_prod_cost_cy + nov.total_prod_cost_cy + dec.total_prod_cost_cy;
  const q3_mt_ly = ( (oct.total_cost_mt_ly + nov.total_cost_mt_ly + dec.total_cost_mt_ly) + (oct.total_prod_cost_ly + nov.total_prod_cost_ly + dec.total_prod_cost_ly) / CR ) / 3;
  const q3_mt_cy = ( (oct.total_cost_mt_cy + nov.total_cost_mt_cy + dec.total_cost_mt_cy) + (oct.total_prod_cost_cy + nov.total_prod_cost_cy + dec.total_prod_cost_cy) / CR ) / 3;

  const costData = [
    { Month: "Apr-Jun", total_prod_cost_ly_cr: q1_ly / CR, total_prod_cost_cy_cr: q1_cy / CR },
    { Month: "Jul-Sep", total_prod_cost_ly_cr: q2_ly / CR, total_prod_cost_cy_cr: q2_cy / CR },
    { Month: "Oct-Dec", total_prod_cost_ly_cr: q3_ly / CR, total_prod_cost_cy_cr: q3_cy / CR },
    { Month: "Jan", total_prod_cost_ly_cr: jan.total_prod_cost_ly / CR, total_prod_cost_cy_cr: jan.total_prod_cost_cy / CR },
  ];
  const costMtData = [
    { Month: "Apr-Jun", total_cost_mt_ly: q1_mt_ly, total_cost_mt_cy: q1_mt_cy },
    { Month: "Jul-Sep", total_cost_mt_ly: q2_mt_ly, total_cost_mt_cy: q2_mt_cy },
    { Month: "Oct-Dec", total_cost_mt_ly: q3_mt_ly, total_cost_mt_cy: q3_mt_cy },
    { Month: "Jan", total_cost_mt_ly: jan.total_cost_mt_ly, total_cost_mt_cy: jan.total_cost_mt_cy },
  ];
  return { costData, costMtData };
}

/** Quarterly savings: Savings chart = sum per quarter; Savings MT = average of savings_mt per quarter. Jan at end. */
export function getQuarterlySavingsData(data: PlantMonthAnalysisRow[]): {
  savingsData: { Month: string; savings_ly_cr: number; savings_cy_cr: number }[];
  savingsMtData: { Month: string; savings_mt_ly: number; savings_mt_cy: number }[];
} {
  const get = (m: string) => getMonthRow(data, m);
  const jan = get("January");
  const apr = get("April"), may = get("May"), jun = get("June");
  const jul = get("July"), aug = get("August"), sep = get("September");
  const oct = get("October"), nov = get("November"), dec = get("December");

  // Savings (crores): sum per quarter
  const CR = 1e7;
  const q1_ly = apr.savings_ly + may.savings_ly + jun.savings_ly;
  const q1_cy = apr.savings_cy + may.savings_cy + jun.savings_cy;
  const q2_ly = jul.savings_ly + aug.savings_ly + sep.savings_ly;
  const q2_cy = jul.savings_cy + aug.savings_cy + sep.savings_cy;
  const q3_ly = oct.savings_ly + nov.savings_ly + dec.savings_ly;
  const q3_cy = oct.savings_cy + nov.savings_cy + dec.savings_cy;

  // Savings Per MT quarterly: average of the three months' savings_mt
  const q1_mt_ly = (apr.savings_mt_ly + may.savings_mt_ly + jun.savings_mt_ly) / 3;
  const q1_mt_cy = (apr.savings_mt_cy + may.savings_mt_cy + jun.savings_mt_cy) / 3;
  const q2_mt_ly = (jul.savings_mt_ly + aug.savings_mt_ly + sep.savings_mt_ly) / 3;
  const q2_mt_cy = (jul.savings_mt_cy + aug.savings_mt_cy + sep.savings_mt_cy) / 3;
  const q3_mt_ly = (oct.savings_mt_ly + nov.savings_mt_ly + dec.savings_mt_ly) / 3;
  const q3_mt_cy = (oct.savings_mt_cy + nov.savings_mt_cy + dec.savings_mt_cy) / 3;

  const savingsData = [
    { Month: "Apr-Jun", savings_ly_cr: q1_ly / CR, savings_cy_cr: q1_cy / CR },
    { Month: "Jul-Sep", savings_ly_cr: q2_ly / CR, savings_cy_cr: q2_cy / CR },
    { Month: "Oct-Dec", savings_ly_cr: q3_ly / CR, savings_cy_cr: q3_cy / CR },
    { Month: "Jan", savings_ly_cr: jan.savings_ly / CR, savings_cy_cr: jan.savings_cy / CR },
  ];
  const savingsMtData = [
    { Month: "Apr-Jun", savings_mt_ly: q1_mt_ly, savings_mt_cy: q1_mt_cy },
    { Month: "Jul-Sep", savings_mt_ly: q2_mt_ly, savings_mt_cy: q2_mt_cy },
    { Month: "Oct-Dec", savings_mt_ly: q3_mt_ly, savings_mt_cy: q3_mt_cy },
    { Month: "Jan", savings_mt_ly: jan.savings_mt_ly, savings_mt_cy: jan.savings_mt_cy },
  ];
  return { savingsData, savingsMtData };
}

/** Scrollbar start ratio (0–1) so the chart shows from August by default. Use for charts with Month-based data; skip for Productivity chart. */
export function getScrollbarStartFromAugust(data: { Month?: string }[]): number {
  if (!data?.length) return 0;
  const idx = data.findIndex((r) => r.Month === "August");
  if (idx >= 0) return Math.min(idx / data.length, 1);
  const augOrder = MONTH_ORDER["August"] ?? 8;
  const firstIdx = data.findIndex((r) => (MONTH_ORDER[r.Month ?? ""] ?? 99) >= augOrder);
  return firstIdx >= 0 ? Math.min(firstIdx / data.length, 1) : 0;
}

export function getYAxisRangeProductivity(values: number[], paddingPercent = 0.1): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 100 };
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const padding = Math.max(range * paddingPercent, range * 0.05);
  return {
    min: Math.max(0, minVal - padding),
    max: maxVal + padding,
  };
}

/** Compute Y axis min/max from values so line charts use scale properly. Optionally include zero for bar charts. */
export function getYAxisRange(
  values: number[],
  paddingPercent = 0.12,
  includeZero = false
): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 100 };
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  if (minVal === maxVal) {
    const v = minVal;
    const pad = Math.abs(v) * 0.1 || 1;
    return {
      min: includeZero ? Math.min(0, v - pad) : v - pad,
      max: v + pad,
    };
  }
  const range = maxVal - minVal;
  const padding = Math.max(range * paddingPercent, range * 1);
  const min = minVal - padding;
  const max = maxVal + padding;
  return {
    min: includeZero ? Math.min(0, min) : min,
    max,
  };
}

export const COST_LY_COLOR = "#3674B5";
export const COST_CY_COLOR = "#f46a25";
export const PROD_LY_COLOR = "#13436c";
export const PROD_CY_COLOR = "#28a095";
export const SAVINGS_LY_COLOR = "#155E95";
export const SAVINGS_CY_COLOR = "#98D8EF";

export function sortByMonthOrder(data: PlantMonthAnalysisRow[]): PlantMonthAnalysisRow[] {
  return [...data].sort((a, b) => {
    const orderA = MONTH_ORDER[a.Month] ?? 99;
    const orderB = MONTH_ORDER[b.Month] ?? 99;
    return orderA === 1 ? (orderB === 1 ? 0 : 1) : orderB === 1 ? -1 : orderA - orderB;
  });
}

export function sortMonthNames(months: string[]): string[] {
  return [...new Set(months)].sort((a, b) => {
    const orderA = MONTH_ORDER[a] ?? 99;
    const orderB = MONTH_ORDER[b] ?? 99;
    return orderA === 1 ? (orderB === 1 ? 0 : 1) : orderB === 1 ? -1 : orderA - orderB;
  });
}

/** Nested API shape: one entry per zone with plants → months[] */
interface ZoneMonthlyNestedBlock {
  zone?: string;
  plants?: { plant?: string; months?: Record<string, unknown>[] }[];
}

/** Nested API shape: one entry per plant with months[] */
interface PlantMonthlyNestedBlock {
  plant?: string;
  zone?: string;
  months?: Record<string, unknown>[];
}

export function isNestedZoneMonthlyPayload(arr: unknown[]): arr is ZoneMonthlyNestedBlock[] {
  if (!arr.length || typeof arr[0] !== "object" || arr[0] === null) return false;
  const first = arr[0] as Record<string, unknown>;
  return Array.isArray(first.plants);
}

export function isNestedPlantMonthlyPayload(arr: unknown[]): arr is PlantMonthlyNestedBlock[] {
  if (!arr.length || typeof arr[0] !== "object" || arr[0] === null) return false;
  const first = arr[0] as Record<string, unknown>;
  return Array.isArray(first.months) && (first.plant != null || first.Plant != null);
}

/**
 * Roll up nested zone_monthly_aggregated (zone → plants → months) to one row per zone per month.
 * Cost / savings MT use production-weighted averages across plants.
 */
export function flattenNestedZoneMonthlyToRows(blocks: ZoneMonthlyNestedBlock[]): PlantMonthZoneAggregatedRow[] {
  const out: PlantMonthZoneAggregatedRow[] = [];
  for (const zb of blocks) {
    const zone = String(zb.zone ?? "").trim();
    if (!zone) continue;
    const byMonth = new Map<
      string,
      {
        sumCostCy: number;
        sumCostLy: number;
        sumSavCy: number;
        sumSavLy: number;
        sumProdCy: number;
        sumProdLy: number;
        wCostMtCy: number;
        wCostMtLy: number;
        wSavMtCy: number;
        wSavMtLy: number;
      }
    >();
    for (const pl of zb.plants ?? []) {
      for (const m of pl.months ?? []) {
        const monthName = String((m as { Month?: string }).Month ?? "").trim();
        if (!monthName) continue;
        const prodCy = Number((m as { production_mt_cy?: number }).production_mt_cy) || 0;
        const prodLy = Number((m as { production_mt_ly?: number }).production_mt_ly) || 0;
        const costMtCy = Number((m as { total_cost_mt_cy?: number }).total_cost_mt_cy) || 0;
        const costMtLy = Number((m as { total_cost_mt_ly?: number }).total_cost_mt_ly) || 0;
        const savMtCy = Number((m as { savings_mt_cy?: number }).savings_mt_cy) || 0;
        const savMtLy = Number((m as { savings_mt_ly?: number }).savings_mt_ly) || 0;
        let acc = byMonth.get(monthName);
        if (!acc) {
          acc = {
            sumCostCy: 0,
            sumCostLy: 0,
            sumSavCy: 0,
            sumSavLy: 0,
            sumProdCy: 0,
            sumProdLy: 0,
            wCostMtCy: 0,
            wCostMtLy: 0,
            wSavMtCy: 0,
            wSavMtLy: 0,
          };
          byMonth.set(monthName, acc);
        }
        acc.sumCostCy += Number((m as { total_prod_cost_cy?: number }).total_prod_cost_cy) || 0;
        acc.sumCostLy += Number((m as { total_prod_cost_ly?: number }).total_prod_cost_ly) || 0;
        acc.sumSavCy += Number((m as { savings_cy?: number }).savings_cy) || 0;
        acc.sumSavLy += Number((m as { savings_ly?: number }).savings_ly) || 0;
        acc.sumProdCy += prodCy;
        acc.sumProdLy += prodLy;
        acc.wCostMtCy += costMtCy * prodCy;
        acc.wCostMtLy += costMtLy * prodLy;
        acc.wSavMtCy += savMtCy * prodCy;
        acc.wSavMtLy += savMtLy * prodLy;
      }
    }
    for (const [monthName, acc] of byMonth) {
      out.push({
        Month: monthName,
        zone,
        Zone: zone,
        total_prod_cost_cy: acc.sumCostCy,
        total_prod_cost_ly: acc.sumCostLy,
        savings_cy: acc.sumSavCy,
        savings_ly: acc.sumSavLy,
        total_cost_mt_cy: acc.sumProdCy > 0 ? acc.wCostMtCy / acc.sumProdCy : 0,
        total_cost_mt_ly: acc.sumProdLy > 0 ? acc.wCostMtLy / acc.sumProdLy : 0,
        savings_mt_cy: acc.sumProdCy > 0 ? acc.wSavMtCy / acc.sumProdCy : 0,
        savings_mt_ly: acc.sumProdLy > 0 ? acc.wSavMtLy / acc.sumProdLy : 0,
      });
    }
  }
  return out;
}

/** Flatten plant_monthly_aggregated: [{ plant, zone, months: [...] }] → one row per plant per month */
export function flattenNestedPlantMonthlyToRows(blocks: PlantMonthlyNestedBlock[]): PlantMonthPlantAggregatedRow[] {
  const out: PlantMonthPlantAggregatedRow[] = [];
  for (const pr of blocks) {
    const plantName = String(pr.plant ?? (pr as { Plant?: string }).Plant ?? "").trim();
    const zone = String(pr.zone ?? "").trim();
    for (const m of pr.months ?? []) {
      const monthName = String((m as { Month?: string }).Month ?? "").trim();
      if (!monthName) continue;
      const row: PlantMonthPlantAggregatedRow = {
        ...(m as PlantMonthPlantAggregatedRow),
        Month: monthName,
        Plant: String((m as { Plant?: string }).Plant ?? plantName),
        zone: String((m as { Zone?: string }).Zone ?? zone).trim() || zone,
        Zone: String((m as { Zone?: string }).Zone ?? zone).trim() || zone,
      };
      out.push(row);
    }
  }
  return out;
}

export function normalizeZoneMonthlyAggregated(raw: unknown): PlantMonthZoneAggregatedRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (isNestedZoneMonthlyPayload(raw)) {
    return flattenNestedZoneMonthlyToRows(raw);
  }
  return raw as PlantMonthZoneAggregatedRow[];
}

export function normalizePlantMonthlyAggregated(raw: unknown): PlantMonthPlantAggregatedRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (isNestedPlantMonthlyPayload(raw)) {
    return flattenNestedPlantMonthlyToRows(raw);
  }
  return raw as PlantMonthPlantAggregatedRow[];
}

export function zoneKeyFromAggregatedRow(row: PlantMonthZoneAggregatedRow): string {
  const z = row.zone ?? row.Zone;
  return z != null ? String(z).trim() : "";
}

/** Same as Daily Productivity: drop leading/trailing "LPG Plant" from names. */
export function stripLPGPlantFromLabel(str: string): string {
  if (!str || typeof str !== "string") return str;
  const s = str.trim();
  return (
    s
      .replace(/^LPG\s+Plant\s*(-\s*)?/i, "")
      .replace(/\s*LPG\s+Plant\s*$/i, "")
      .trim() || s
  );
}

/** Zone key for charts: stripped + uppercase (matches bar labels / legend). */
export function zoneLabelFromAggregatedRow(row: PlantMonthZoneAggregatedRow): string {
  const z = zoneKeyFromAggregatedRow(row);
  return z ? stripLPGPlantFromLabel(z).toUpperCase() : "";
}

export function categoryMonthFromAggregatedRow(row: PlantMonthZoneAggregatedRow): string {
  const m = row.Month;
  if (m && String(m).trim()) return String(m).trim();
  const md = row.month_date;
  if (md && typeof md === "string") return monthDateToMonthName(md);
  return "";
}

export function transformZoneMonthlyToChart(
  rows: PlantMonthZoneAggregatedRow[],
  valueGetter: (r: PlantMonthZoneAggregatedRow) => number
): { chartData: Record<string, unknown>[]; groups: string[] } {
  if (!rows?.length) return { chartData: [], groups: [] };
  const groups = [...new Set(rows.map((r) => zoneLabelFromAggregatedRow(r)).filter(Boolean))].sort();
  const monthSet = new Set<string>();
  rows.forEach((r) => {
    const c = categoryMonthFromAggregatedRow(r);
    if (c) monthSet.add(c);
  });
  const monthsSorted = sortMonthNames([...monthSet]);
  const chartData = monthsSorted.map((monthCat) => {
    const row: Record<string, unknown> = {
      monthCat,
      label: monthToShort(monthCat),
    };
    groups.forEach((g) => {
      const item = rows.find(
        (r) => categoryMonthFromAggregatedRow(r) === monthCat && zoneLabelFromAggregatedRow(r) === g
      );
      const raw = item ? valueGetter(item) : NaN;
      row[g] = Number.isFinite(raw) ? Number(Number(raw).toFixed(2)) : null;
    });
    return row;
  });
  return { chartData, groups };
}

export function plantLabelFromAggregatedRow(row: PlantMonthPlantAggregatedRow): string {
  const p = row.Plant ?? row.location_name ?? row.sap_id;
  if (!p) return "—";
  return stripLPGPlantFromLabel(formatLocationLabel(String(p))).toUpperCase();
}

export function transformPlantMonthlyByZoneToChart(
  rows: PlantMonthPlantAggregatedRow[],
  zone: string,
  valueGetter: (r: PlantMonthPlantAggregatedRow) => number
): { chartData: Record<string, unknown>[]; groups: string[] } {
  const zoneRows = rows.filter((r) => zoneLabelFromAggregatedRow(r) === zone);
  if (!zoneRows.length) return { chartData: [], groups: [] };
  const groups = [...new Set(zoneRows.map(plantLabelFromAggregatedRow))].sort();
  const monthSet = new Set<string>();
  zoneRows.forEach((r) => {
    const c = categoryMonthFromAggregatedRow(r);
    if (c) monthSet.add(c);
  });
  const monthsSorted = sortMonthNames([...monthSet]);
  const chartData = monthsSorted.map((monthCat) => {
    const row: Record<string, unknown> = { monthCat, label: monthToShort(monthCat) };
    groups.forEach((plantLabel) => {
      const item = zoneRows.find(
        (r) => categoryMonthFromAggregatedRow(r) === monthCat && plantLabelFromAggregatedRow(r) === plantLabel
      );
      const raw = item ? valueGetter(item) : NaN;
      row[plantLabel] = Number.isFinite(raw) ? Number(Number(raw).toFixed(2)) : null;
    });
    return row;
  });
  return { chartData, groups };
}

/** Aggregate raw API rows by Month (sum across plants when multiple rows per month) */
export function aggregateByMonth(raw: PlantMonthAnalysisRawRow[]): PlantMonthAnalysisRow[] {
  const byMonth: Record<string, PlantMonthAnalysisRow> = {};
  for (const row of raw) {
    const month = row.Month ?? "Overall";
    if (!byMonth[month]) {
      byMonth[month] = {
        Month: month,
        total_prod_cost_ly: 0,
        total_prod_cost_cy: 0,
        total_cost_mt_ly: 0,
        total_cost_mt_cy: 0,
        production_ly: 0,
        production_cy: 0,
        production_mt_ly: 0,
        production_mt_cy: 0,
        productivity_ly: 0,
        productivity_cy: 0,
        savings_ly: 0,
        savings_cy: 0,
        savings_mt_ly: 0,
        savings_mt_cy: 0,
      };
    }
    const agg = byMonth[month];
    agg.total_prod_cost_ly += Number(row.total_prod_cost_ly) || 0;
    agg.total_prod_cost_cy += Number(row.total_prod_cost_cy) || 0;
    agg.total_cost_mt_ly += Number(row.total_cost_mt_ly) || 0;
    agg.total_cost_mt_cy += Number(row.total_cost_mt_cy) || 0;
    agg.production_ly += Number(row.production_ly) || 0;
    agg.production_cy += Number(row.production_cy) || 0;
    agg.production_mt_ly += Number(row.production_mt_ly) || 0;
    agg.production_mt_cy += Number(row.production_mt_cy) || 0;
    agg.productivity_ly += Number(row.productivity_ly) || 0;
    agg.productivity_cy += Number(row.productivity_cy) || 0;
    agg.savings_ly += Number(row.savings_ly) || 0;
    agg.savings_cy += Number(row.savings_cy) || 0;
    agg.savings_mt_ly += Number(row.savings_mt_ly) || 0;
    agg.savings_mt_cy += Number(row.savings_mt_cy) || 0;
  }
  return Object.values(byMonth);
}

/** Strip "sap_id - " prefix and truncate with "..." after maxLen characters. */
const LOCATION_LABEL_MAX_LEN = 28;
export function formatLocationLabel(raw: string): string {
  if (!raw || typeof raw !== "string") return "Unknown";
  const s = raw.trim().replace(/^\d+\s*-\s*/, "").trim() || raw.trim();
  if (s.length <= LOCATION_LABEL_MAX_LEN) return s;
  return s.slice(0, LOCATION_LABEL_MAX_LEN) + "...";
}

/** Build location options for combobox: value = sap_id, label = location name only (strip "id - ", truncate). */
export function getLocationOptions(raw: PlantMonthAnalysisRawRow[]): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const row of raw) {
    const sid = row.sap_id != null ? String(row.sap_id).trim() : "";
    const name = row.Plant != null ? String(row.Plant).trim() : (row.location_name != null ? String(row.location_name).trim() : null);
    if (!sid) continue;
    const label = name ? formatLocationLabel(name) : "Unknown";
    if (label === "Unknown" && name && name === sid) continue;
    map.set(sid, label);
  }
  const list = Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  return [{ value: "", label: "All Plants" }, ...list.map(([value, label]) => ({ value, label }))];
}

/** Map API monthly_aggregated row to PlantMonthAnalysisRow (chart/pivot shape). Uses keys from API as-is. */
export function mapMonthlyAggregatedToRow(row: PlantMonthAnalysisMonthlyAggregatedRow): PlantMonthAnalysisRow {
  const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  return {
    Month: row.Month ?? "",
    total_prod_cost_ly: num(row.total_prod_cost_ly),
    total_prod_cost_cy: num(row.total_prod_cost_cy),
    total_cost_mt_ly: num(row.total_cost_mt_ly),
    total_cost_mt_cy: num(row.total_cost_mt_cy),
    production_ly: num(row.production_ly),
    production_cy: num(row.production_cy),
    production_mt_ly: num(row.production_mt_ly),
    production_mt_cy: num(row.production_mt_cy),
    productivity_ly: num(row.productivity_ly),
    productivity_cy: num(row.productivity_cy),
    savings_ly: num(row.savings_ly),
    savings_cy: num(row.savings_cy),
    savings_mt_ly: num(row.savings_mt_ly),
    savings_mt_cy: num(row.savings_mt_cy),
    productivity: typeof row.productivity === "number" && !Number.isNaN(row.productivity) ? row.productivity : undefined,
  };
}
