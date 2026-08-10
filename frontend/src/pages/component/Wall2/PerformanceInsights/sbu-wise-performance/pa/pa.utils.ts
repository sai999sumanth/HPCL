import type { PivotData, TwoFyRow, SimpleRow, ParetoSummary } from "./pa.types";

export const FISCAL_MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

/** Calendar month index (0=Jan … 11=Dec) → index in FISCAL_MONTH_ORDER */
const CALENDAR_MONTH_TO_FISCAL_INDEX: Record<number, number> = {
  3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8,
  0: 9, 1: 10, 2: 11,
};

/** Active India FY label for a given date, e.g. "2026-2027" */
export const getActiveFiscalYear = (asOf = new Date()): string => {
  const m = asOf.getMonth();
  const y = asOf.getFullYear();
  const start = m >= 3 ? y : y - 1;
  return `${start}-${start + 1}`;
};

/** Apr → present month for active FY; full year for completed past FYs */
export const getVisibleFiscalMonths = (fiscalYear: string, asOf = new Date()): string[] => {
  if (fiscalYear !== getActiveFiscalYear(asOf)) {
    return [...FISCAL_MONTH_ORDER];
  }
  const fiscalIdx = CALENDAR_MONTH_TO_FISCAL_INDEX[asOf.getMonth()] ?? 0;
  return FISCAL_MONTH_ORDER.slice(0, fiscalIdx + 1);
};

export const QUARTER_ORDER = ["Q1", "Q2", "Q3", "Q4"];
export const HALF_YEAR_ORDER = ["H1", "H2"];
export const FY_OPTIONS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024"];

/** Normalize API month values ("April", "APR", "Apr") → "Apr" */
export const normalizeMonthKey = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const key = trimmed.slice(0, 3).toUpperCase();
  return key.charAt(0) + key.slice(1).toLowerCase();
};

export const getMonthMapValue = (map: Map<string, number>, month: string): number => {
  const direct = map.get(month);
  if (direct !== undefined) return direct;
  for (const [key, val] of map.entries()) {
    if (normalizeMonthKey(key) === month) return val;
  }
  return 0;
};

export const monthYoyPct = (current: number, previous: number): number =>
  previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

export const SEGMENT_COLORS: Record<string, string> = {
  AUTOMOTIVE: "#1A5FB4", Automotive: "#1A5FB4",
  INDUSTRIAL: "#1D7A52", Industrial: "#1D7A52",
  MARINE: "#B06A00",     Marine: "#B06A00",
  CONSTRUCTION: "#C24D2C", Construction: "#C24D2C",
  AGRICULTURE: "#5B3FA6", Agriculture: "#5B3FA6",
};

export const FALLBACK_COLORS = [
  "#1A5FB4", "#1D7A52", "#B06A00", "#C24D2C",
  "#5B3FA6", "#0F6E70", "#7A7060", "#9A9890",
];

/** Safely read a field from an API row (case-insensitive). Returns "" for null/undefined/"null". */
export const gf = (row: any, key: string): string => {
  const val = (row?.[key] ?? row?.[key.toUpperCase()] ?? row?.[key.toLowerCase()] ?? "").toString();
  return val === "null" || val === "undefined" ? "" : val;
};

/** Read the Total/total field from a row */
export const nf = (row: any): number => Number(row?.Total ?? row?.total ?? 0);

export const getPrevFY = (fy: string): string => {
  const [a, b] = fy.split("-").map(Number);
  return `${a - 1}-${b - 1}`;
};

export const toYMD = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

export const getYtdDates = (currentFY: string) => {
  const startYear = Number(currentFY.split("-")[0]);
  const today = new Date();
  const dateFrom = `${startYear}0401`;
  const dateTo = toYMD(today);
  const prevDateFrom = `${startYear - 1}0401`;
  const prevYearToday = new Date(today);
  prevYearToday.setFullYear(today.getFullYear() - 1);
  const prevDateTo = toYMD(prevYearToday);
  return { dateFrom, dateTo, prevDateFrom, prevDateTo };
};

/** Apr 1 → equivalent calendar day in the given FY (today for active FY). */
export const getMomDatesForFy = (fiscalYear: string, asOf = new Date()) => {
  const startYear = Number(fiscalYear.split("-")[0]);
  const dateFrom = `${startYear}0401`;
  const activeFY = getActiveFiscalYear(asOf);

  if (fiscalYear === activeFY) {
    return { dateFrom, dateTo: toYMD(asOf) };
  }

  const activeStartYear = Number(activeFY.split("-")[0]);
  const yearOffset = activeStartYear - startYear;
  const equivalentDate = new Date(asOf);
  equivalentDate.setFullYear(asOf.getFullYear() - yearOffset);
  return { dateFrom, dateTo: toYMD(equivalentDate) };
};

/** Display e.g. "20260401" → "Apr 1" */
export const formatYmdShort = (ymd: string): string => {
  const month = parseInt(ymd.slice(4, 6), 10);
  const day = parseInt(ymd.slice(6, 8), 10);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[month - 1] ?? ymd} ${day}`;
};

/** Human-readable MoM window for a fiscal year, e.g. "Apr 1 – Jun 23". */
export const formatMomPeriodLabel = (fiscalYear: string, asOf = new Date()): string => {
  const { dateFrom, dateTo } = getMomDatesForFy(fiscalYear, asOf);
  return `${formatYmdShort(dateFrom)} – ${formatYmdShort(dateTo)}`;
};

export type PaCompareMode = "fy" | "mom";

export type PaDateRange = { date_from: string; date_to: string };

/** Date window for MoM compare; null when comparing full fiscal years. */
export const getPaDateRange = (
  fiscalYear: string,
  compareMode: PaCompareMode,
  asOf = new Date(),
): PaDateRange | null => {
  if (compareMode !== "mom") return null;
  const { dateFrom, dateTo } = getMomDatesForFy(fiscalYear, asOf);
  return { date_from: dateFrom, date_to: dateTo };
};

export const fmtTmt = (v: number): string => {
  if (v === 0) return "0";
  return v.toFixed(2);
};

/** Full-precision TMT for chart tooltips (no rounding to 2 decimals) */
export const fmtTooltipTmt = (v: number): string => {
  if (v === 0) return "0";
  const raw = v.toLocaleString("en-IN", { maximumFractionDigits: 10, minimumFractionDigits: 0 });
  return raw.includes(".") ? raw.replace(/0+$/, "").replace(/\.$/, "") : raw;
};

/** Full-precision signed % for chart tooltips */
export const fmtTooltipPct = (v: number): string => {
  if (v === 0) return "0%";
  const raw = v.toLocaleString("en-IN", { maximumFractionDigits: 10, minimumFractionDigits: 0 });
  const trimmed = raw.includes(".") ? raw.replace(/0+$/, "").replace(/\.$/, "") : raw;
  return `${v > 0 ? "+" : ""}${trimmed}%`;
};

/** Compact whole-number label for bar chart values */
export const fmtBarTmt = (v: number): string => {
  if (v === 0) return "";
  return Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

/** Compact signed % label for bar chart values */
export const fmtBarPct = (v: number): string => {
  if (v === 0) return "0%";
  return `${v > 0 ? "+" : ""}${Math.round(v)}%`;
};

export const growthClass = (pct: number) =>
  pct > 0 ? "text-green-700" : pct < 0 ? "text-red-700" : "text-stone-400";

/** Returns a CSS color value for inline-style usage */
export const growthColor = (pct: number): string =>
  pct > 0 ? "#1D7A52" : pct < 0 ? "#C0392B" : "#9A9890";

export const normalizeRows = (data: any): any[] =>
  Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

export function processTwoFy(
  apiRows: any[],
  nameKey: string,
  currentFY: string,
  prevFY: string,
): TwoFyRow[] {
  const map = new Map<string, { cur: number; prev: number }>();
  for (const row of apiRows) {
    const name = gf(row, nameKey);
    if (!name) continue;
    const fy = gf(row, "FISCAL_YEAR");
    const entry = map.get(name) ?? { cur: 0, prev: 0 };
    if (fy === currentFY) entry.cur += nf(row);
    else if (fy === prevFY) entry.prev += nf(row);
    map.set(name, entry);
  }
  return Array.from(map.entries())
    .map(([name, { cur, prev }]) => ({
      name,
      currentTotal: cur,
      prevTotal: prev,
      growthPct: prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0,
    }))
    .sort((a, b) => b.currentTotal - a.currentTotal);
}

/** Merge two single-FY API responses into comparable TwoFy rows. */
export function buildTwoFyFromSingleFyResponses(
  currentRows: any[],
  prevRows: any[],
  nameKey: string,
): TwoFyRow[] {
  const map = new Map<string, { cur: number; prev: number }>();
  for (const row of currentRows) {
    const name = gf(row, nameKey);
    if (!name) continue;
    const entry = map.get(name) ?? { cur: 0, prev: 0 };
    entry.cur += nf(row);
    map.set(name, entry);
  }
  for (const row of prevRows) {
    const name = gf(row, nameKey);
    if (!name) continue;
    const entry = map.get(name) ?? { cur: 0, prev: 0 };
    entry.prev += nf(row);
    map.set(name, entry);
  }
  return Array.from(map.entries())
    .map(([name, { cur, prev }]) => ({
      name,
      currentTotal: cur,
      prevTotal: prev,
      growthPct: prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0,
    }))
    .sort((a, b) => b.currentTotal - a.currentTotal);
}

export function buildPivot(apiRows: any[], rowKey: string, colKey: string): PivotData {
  const cells: Record<string, Record<string, number>> = {};
  const rowSet: string[] = [];
  const colSet: string[] = [];
  let maxVal = 0;
  for (const row of apiRows) {
    const r = gf(row, rowKey);
    const c = gf(row, colKey);
    const val = nf(row);
    if (!r || !c) continue;
    if (!cells[r]) { cells[r] = {}; rowSet.push(r); }
    if (!colSet.includes(c)) colSet.push(c);
    cells[r][c] = (cells[r][c] ?? 0) + val;
    maxVal = Math.max(maxVal, cells[r][c]);
  }
  return { rows: rowSet, cols: colSet, cells, maxVal };
}

/** Build Pareto rows: top contributors until cumulative share reaches 80%. */
export function buildParetoSummary(rows: SimpleRow[]): ParetoSummary {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const grandTotal = sorted.reduce((s, r) => s + r.total, 0);

  if (sorted.length === 0 || grandTotal <= 0) {
    return {
      rows: [],
      totalCount: 0,
      top80Count: 0,
      top80Sum: 0,
      tailCount: 0,
      tailSum: 0,
      grandTotal: 0,
    };
  }

  let cumulative = 0;
  let top80Count = sorted.length;

  const paretoRows = sorted.map((row, index) => {
    cumulative += row.total;
    const cumulativePct = (cumulative / grandTotal) * 100;
    if (top80Count === sorted.length && cumulativePct >= 80) {
      top80Count = index + 1;
    }
    return {
      name: row.name,
      total: row.total,
      cumulativePct,
      isTop80: false,
    };
  });

  paretoRows.forEach((row, index) => {
    row.isTop80 = index < top80Count;
  });

  const top80Sum = paretoRows.slice(0, top80Count).reduce((s, r) => s + r.total, 0);
  const tailSum = grandTotal - top80Sum;

  return {
    rows: paretoRows,
    totalCount: sorted.length,
    top80Count,
    top80Sum,
    tailCount: sorted.length - top80Count,
    tailSum,
    grandTotal,
  };
}
