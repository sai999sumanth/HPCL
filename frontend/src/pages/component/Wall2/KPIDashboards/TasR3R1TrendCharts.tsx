import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ZoneGroupedBarChart } from "@/components/widgets/zone-grouped-bar";
import { apiClient } from "@/services/apiClient";
import { cn } from "@/@/lib/utils";
import { Loader2, RotateCcw, Maximize2, Minimize2, ArrowLeft } from "lucide-react";
import NoDataDisplay from "@/components/common/NoDataDisplay";
import PerformanceScoreLineChart from "./PerformanceScoreLineChart";

const API_R3_R1 = "/api/indentmanagement/get_r3_r1_details";

const PLANT_MONTH_ZONE_BAR_CHART_PROPS = {
  xAxisLabelRotation: -90,
  scrollbarCategoryThreshold: 10,
} as const;

function unwrapPayload(res: unknown): unknown {
  if (res == null) return null;
  let cur: unknown = (res as Record<string, unknown>).data ?? res;
  if (cur && typeof cur === "object" && !Array.isArray(cur) && "data" in (cur as object)) {
    const inner = (cur as { data?: unknown }).data;
    if (inner !== undefined) cur = inner;
  }
  return cur;
}

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

function formatDayLabel(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatGroupName(name: string): string {
  return String(name ?? "").trim().toUpperCase();
}

function pickArray(o: Record<string, unknown>, keys: string[]): Record<string, unknown>[] | null {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] !== null) {
      return v as Record<string, unknown>[];
    }
  }
  return null;
}

/** Indent management API: trend value and transaction date */
const INDENT_VALUE_KEY = "avg_r1_diff_r3";
/** Daywise API may return pre-aggregated minutes instead of `avg_r1_diff_r3`. */
const INDENT_VALUE_KEY_ALT = "average_minutes";
/** Monthwise nested payload: `monthly_data` / `zone_data` / `location_data`. */
const MONTHLY_VALUE_KEY = "monthly_avg_r3_r1";
const INDENT_SERIES_LABEL = "Avg R1−R3";
const COMPOSITE_KEY_SEP = "\x1f";

/** Prefer legacy key, then daywise `average_minutes`, then monthwise aggregate key. */
function detectIndentValueKey(row: Record<string, unknown>): string | null {
  if (row[INDENT_VALUE_KEY] != null && row[INDENT_VALUE_KEY] !== "") return INDENT_VALUE_KEY;
  if (row[INDENT_VALUE_KEY_ALT] != null && row[INDENT_VALUE_KEY_ALT] !== "") return INDENT_VALUE_KEY_ALT;
  if (row[MONTHLY_VALUE_KEY] != null && row[MONTHLY_VALUE_KEY] !== "") return MONTHLY_VALUE_KEY;
  return null;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Sort categories: ISO dates first, else `Apr-2025`-style labels from API. */
function sortCategoryTime(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  const re = /^([A-Za-z]{3})-(\d{4})$/;
  const ma = re.exec(a.trim());
  const mb = re.exec(b.trim());
  if (ma && mb) {
    const norm = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const ia = MONTH_ABBR.indexOf(norm(ma[1]!));
    const ib = MONTH_ABBR.indexOf(norm(mb[1]!));
    const ya = parseInt(ma[2]!, 10);
    const yb = parseInt(mb[2]!, 10);
    if (ya !== yb) return ya - yb;
    if (ia >= 0 && ib >= 0) return ia - ib;
  }
  return a.localeCompare(b);
}

/** Axis label for `month_label` / `month` values like `Apr-2025`. */
function formatMonthCategoryLabel(cat: string): string {
  const d = new Date(cat);
  if (!Number.isNaN(d.getTime())) return formatMonthLabel(cat);
  const re = /^([A-Za-z]{3})-(\d{4})$/;
  const m = re.exec(cat.trim());
  if (m) return `${m[1]} ${m[2]}`;
  return cat;
}

function detectPeriodKey(row: Record<string, unknown>, preferMonthly: boolean): string | null {
  const monthlyFirst = ["month_date", "month", "Month", "year_month"];
  const dailyFirst = ["CARD_DATE", "process_date", "date", "day", "txn_date", "indent_date"];
  const order = preferMonthly ? [...monthlyFirst, ...dailyFirst] : [...dailyFirst, ...monthlyFirst];
  for (const k of order) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") return k;
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


function cardDateToMonthStart(cardDate: string): string {
  const d = new Date(cardDate);
  if (Number.isNaN(d.getTime())) return cardDate;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Multiple rows per period (e.g. terminals) → mean of `avg_r1_diff_r3`. */
function aggregateRowsByPeriod(
  rows: Record<string, unknown>[],
  periodKey: string,
  valueKey: string
): Record<string, unknown>[] {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const cat = String(row[periodKey] ?? "").trim();
    if (!cat) continue;
    const v = toNum(row[valueKey]);
    if (v == null) continue;
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(v);
  }
  const cats = [...map.keys()].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return cats.map((cat) => {
    const vals = map.get(cat)!;
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
    return { [periodKey]: cat, [valueKey]: avg };
  });
}

/** One row per (month, zone) with averaged metric. */
function aggregateByMonthZone(
  rows: Record<string, unknown>[],
  monthKey: string,
  zoneKey: string,
  valueKey: string
): Record<string, unknown>[] {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const m = String(row[monthKey] ?? "").trim();
    const z = String(row[zoneKey] ?? "").trim();
    if (!m || !z) continue;
    const v = toNum(row[valueKey]);
    if (v == null) continue;
    const k = `${m}${COMPOSITE_KEY_SEP}${z}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(v);
  }
  const out: Record<string, unknown>[] = [];
  for (const [k, vals] of map) {
    const sepIdx = k.indexOf(COMPOSITE_KEY_SEP);
    const m = k.slice(0, sepIdx);
    const z = k.slice(sepIdx + 1);
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
    out.push({ [monthKey]: m, [zoneKey]: z, [valueKey]: avg });
  }
  return out;
}

/** One row per (month, plant) within a zone — for drilldown. */
function aggregateByMonthPlant(
  rows: Record<string, unknown>[],
  monthKey: string,
  zoneKey: string,
  valueKey: string,
  zoneFilter: string,
  plantKey: (r: Record<string, unknown>) => string
): Record<string, unknown>[] {
  const zoneNorm = zoneFilter.trim().toUpperCase();
  const map = new Map<string, number[]>();
  for (const row of rows) {
    if (String(row[zoneKey] ?? "").trim().toUpperCase() !== zoneNorm) continue;
    const m = String(row[monthKey] ?? "").trim();
    const p = plantKey(row);
    const v = toNum(row[valueKey]);
    if (v == null || !m) continue;
    const k = `${m}${COMPOSITE_KEY_SEP}${p}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(v);
  }
  const out: Record<string, unknown>[] = [];
  for (const [k, vals] of map) {
    const sepIdx = k.indexOf(COMPOSITE_KEY_SEP);
    const m = k.slice(0, sepIdx);
    const p = k.slice(sepIdx + 1);
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
    out.push({ [monthKey]: m, _plant: p, [valueKey]: avg });
  }
  return out;
}

function findPlantKey(row: Record<string, unknown>): string {
  return String(
    row.name ?? row.location ?? row.plant_name ?? row.plant ?? row.sap_id ?? row.LOCN_CODE ?? "—"
  ).trim();
}

/** Prefer explicit r3 / r1 column names; fallback to two numeric columns. */
function discoverR3R1Keys(row: Record<string, unknown>): { r3: string; r1: string } | null {
  const keys = Object.keys(row);
  let r3 = keys.find((k) => /^r3$/i.test(k));
  let r1 = keys.find((k) => /^r1$/i.test(k));
  if (!r3) r3 = keys.find((k) => /r3/i.test(k) && !/r1/i.test(k) && !/national/i.test(k));
  if (!r1) r1 = keys.find((k) => /r1/i.test(k) && !/r3/i.test(k) && !/national/i.test(k));
  if (r3 && r1 && r3 !== r1) return { r3, r1 };

  const numericKeys = keys.filter((k) => {
    if (/national|zone|month|date|sap|location|plant|label|cat/i.test(k)) return false;
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return true;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(parseFloat(v))) return true;
    return false;
  });
  if (numericKeys.length >= 2) {
    return { r3: numericKeys[0]!, r1: numericKeys[1]! };
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Number(n.toFixed(4)) : null;
}

type ParsedBundle = {
  line: { chartData: Record<string, unknown>[]; groups: string[] } | null;
  zone: { chartData: Record<string, unknown>[]; groups: string[] } | null;
  plant: { chartData: Record<string, unknown>[]; groups: string[] } | null;
};

function emptyParsedBundle(): ParsedBundle {
  return { line: null, zone: null, plant: null };
}

function extractDataRows(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload) && payload.length && typeof payload[0] === "object" && payload[0] !== null) {
    return payload as Record<string, unknown>[];
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    const inner = pickArray(o, ["data", "overall_data", "result", "rows"]);
    if (inner?.length) return inner;
  }
  return null;
}

/** API: `{ data: [{ CARD_DATE, zone, name, avg_r1_diff_r3, ... }] }` */
function parseAvgR1DiffR3Rows(
  rows: Record<string, unknown>[],
  periodView: "daily" | "monthly",
  scopeMode: "overall" | "zone",
  drilldown: { zone: string; monthCat: string } | null
): ParsedBundle {
  const empty = emptyParsedBundle();
  const sample = rows[0]!;
  const vk = detectIndentValueKey(sample);
  if (!vk) return empty;
  const pk =
    "CARD_DATE" in sample && sample.CARD_DATE != null
      ? "CARD_DATE"
      : detectPeriodKey(sample, periodView === "monthly") ?? "CARD_DATE";

  const labelMonth = (cat: string) => formatMonthLabel(cat);
  const labelDay = (cat: string) => formatDayLabel(cat);

  if (periodView === "daily" || (periodView === "monthly" && scopeMode === "overall")) {
    if (periodView === "daily") {
      const agg = aggregateRowsByPeriod(rows, pk, vk);
      const line = transformOverallSingleSeries(agg, pk, vk, INDENT_SERIES_LABEL, labelDay);
      return { ...empty, line };
    }
    const withMonth = rows.map((r) => ({
      ...r,
      _month: cardDateToMonthStart(String(r[pk] ?? "")),
    }));
    const agg = aggregateRowsByPeriod(withMonth, "_month", vk);
    const line = transformOverallSingleSeries(agg, "_month", vk, INDENT_SERIES_LABEL, labelMonth);
    return { ...empty, line };
  }

  if (periodView === "monthly" && scopeMode === "zone") {
    const zk = findZoneKey(sample);
    if (!zk) return empty;
    const withMonth = rows.map((r) => ({
      ...r,
      _month: cardDateToMonthStart(String(r[pk] ?? "")),
    }));
    if (!drilldown) {
      const composite = aggregateByMonthZone(withMonth, "_month", zk, vk);
      const z = transformZoneMetric(composite, "_month", zk, vk, labelMonth);
      return { ...empty, zone: z.groups.length ? z : null };
    }
    const plantRows = aggregateByMonthPlant(
      withMonth,
      "_month",
      zk,
      vk,
      drilldown.zone,
      findPlantKey
    );
    const p = transformPlantPivot(plantRows, "_month", "_plant", vk, labelMonth);
    return { ...empty, plant: p.groups.length ? p : null };
  }

  return empty;
}

function transformOverallSingleSeries(
  rows: Record<string, unknown>[],
  periodKey: string,
  valueKey: string,
  seriesLabel: string,
  labelFn: (cat: string) => string
): { chartData: Record<string, unknown>[]; groups: string[] } | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) =>
    sortCategoryTime(String(a[periodKey] ?? ""), String(b[periodKey] ?? ""))
  );
  const groups = [seriesLabel];
  const chartData = sorted.map((row) => {
    const cat = String(row[periodKey] ?? "");
    return {
      cat,
      label: labelFn(cat),
      [seriesLabel]: toNum(row[valueKey]),
    };
  });
  return { chartData, groups };
}

function transformOverallTwoSeries(
  rows: Record<string, unknown>[],
  periodKey: string,
  keys: { r3: string; r1: string },
  labelFn: (cat: string) => string
): { chartData: Record<string, unknown>[]; groups: string[] } | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) =>
    sortCategoryTime(String(a[periodKey] ?? ""), String(b[periodKey] ?? ""))
  );
  const groups = ["R3", "R1"];
  const chartData = sorted.map((row) => {
    const cat = String(row[periodKey] ?? "");
    return {
      cat,
      label: labelFn(cat),
      R3: toNum(row[keys.r3]),
      R1: toNum(row[keys.r1]),
    };
  });
  return { chartData, groups };
}

function transformZoneMetric(
  rows: Record<string, unknown>[],
  periodKey: string,
  zoneKey: string,
  valueKey: string,
  labelFn: (cat: string) => string
): { chartData: Record<string, unknown>[]; groups: string[] } {
  if (!rows.length) return { chartData: [], groups: [] };
  const dates = [...new Set(rows.map((d) => String(d[periodKey] ?? "").trim()))].filter(Boolean).sort(sortCategoryTime);
  const rawZones = [...new Set(rows.map((d) => String(d[zoneKey] ?? "").trim()))].filter(Boolean);
  const groups = rawZones.map(formatGroupName);
  const zoneToDisplay = new Map(rawZones.map((z, i) => [z, groups[i]!]));
  const chartData = dates.map((date) => {
    const row: Record<string, unknown> = {
      cat: date,
      label: labelFn(date),
    };
    rawZones.forEach((z) => {
      const display = zoneToDisplay.get(z)!;
      const item = rows.find(
        (d) => String(d[periodKey]).trim() === date && String(d[zoneKey]).trim() === z
      );
      row[display] = toNum(item?.[valueKey]);
    });
    return row;
  });
  return { chartData, groups };
}

function transformPlantPivot(
  rows: Record<string, unknown>[],
  periodKey: string,
  plantCol: string,
  valueKey: string,
  labelFn: (cat: string) => string
): { chartData: Record<string, unknown>[]; groups: string[] } {
  if (!rows.length) return { chartData: [], groups: [] };
  const dates = [...new Set(rows.map((d) => String(d[periodKey] ?? "").trim()))].filter(Boolean).sort(sortCategoryTime);
  const plants = [...new Set(rows.map((d) => String(d[plantCol] ?? "").trim()))].filter(Boolean).sort();
  const groups = plants.map(formatGroupName);
  const plantToDisplay = new Map(plants.map((p, i) => [p, groups[i]!]));
  const chartData = dates.map((date) => {
    const row: Record<string, unknown> = {
      cat: date,
      label: labelFn(date),
    };
    plants.forEach((p) => {
      const display = plantToDisplay.get(p)!;
      const item = rows.find(
        (d) => String(d[periodKey]).trim() === date && String(d[plantCol]).trim() === p
      );
      row[display] = toNum(item?.[valueKey]);
    });
    return row;
  });
  return { chartData, groups };
}

function transformLocationMetric(
  rows: Record<string, unknown>[],
  periodKey: string,
  zoneFilter: string,
  zoneKey: string,
  valueKey: string,
  labelFn: (cat: string) => string
): { chartData: Record<string, unknown>[]; groups: string[] } {
  const zoneNorm = zoneFilter.trim().toUpperCase();
  const zoneRows = rows.filter((d) => String(d[zoneKey] ?? "").trim().toUpperCase() === zoneNorm);
  if (!zoneRows.length) return { chartData: [], groups: [] };

  const findPlant = (d: Record<string, unknown>) =>
    String(d.name ?? d.location ?? d.plant_name ?? d.plant ?? d.sap_id ?? "—");

  const dates = [...new Set(zoneRows.map((d) => String(d[periodKey] ?? "").trim()))].filter(Boolean).sort(sortCategoryTime);
  const plantKeys = [...new Set(zoneRows.map(findPlant))].sort();
  const groups = plantKeys.map(formatGroupName);
  const plantToDisplay = new Map(plantKeys.map((p, i) => [p, groups[i]!]));

  const chartData = dates.map((date) => {
    const row: Record<string, unknown> = {
      cat: date,
      label: labelFn(date),
    };
    plantKeys.forEach((plantName) => {
      const display = plantToDisplay.get(plantName)!;
      const item = zoneRows.find(
        (d) => String(d[periodKey]).trim() === date && findPlant(d) === plantName
      );
      row[display] = toNum(item?.[valueKey]);
    });
    return row;
  });
  return { chartData, groups };
}

/**
 * Monthwise nested payload: `monthly_data` (overall), `zone_data` / `location_data` (zone + drilldown).
 * Keys: `month_label`, `month`, `monthly_avg_r3_r1`, `zone`, `name` (terminals).
 */
function parseMonthlyAggregateNested(
  o: Record<string, unknown>,
  scopeMode: "overall" | "zone",
  drilldown: { zone: string; monthCat: string } | null
): ParsedBundle {
  const empty = emptyParsedBundle();

  if (scopeMode === "overall") {
    const monthlyData = o.monthly_data;
    if (!Array.isArray(monthlyData) || !monthlyData.length) return empty;
    const md = monthlyData as Record<string, unknown>[];
    const sample = md[0]!;
    if (!("month_label" in sample) || !(MONTHLY_VALUE_KEY in sample)) return empty;
    const rows = md
      .map((r) => ({
        month_label: String(r.month_label ?? "").trim(),
        [MONTHLY_VALUE_KEY]: r[MONTHLY_VALUE_KEY],
      }))
      .filter((r) => r.month_label);
    rows.sort((a, b) => sortCategoryTime(a.month_label, b.month_label));
    const line = transformOverallSingleSeries(
      rows,
      "month_label",
      MONTHLY_VALUE_KEY,
      INDENT_SERIES_LABEL,
      formatMonthCategoryLabel
    );
    return { ...empty, line };
  }

  const zoneData = o.zone_data;
  if (!Array.isArray(zoneData) || !zoneData.length) return empty;
  const zd = zoneData as Record<string, unknown>[];
  const zs = zd[0]!;
  const zk = findZoneKey(zs);
  if (!("month" in zs) || !zk || !(MONTHLY_VALUE_KEY in zs)) return empty;
  const z = transformZoneMetric(zd, "month", zk, MONTHLY_VALUE_KEY, formatMonthCategoryLabel);
  if (!z.groups.length) return empty;

  if (drilldown && Array.isArray(o.location_data) && o.location_data.length) {
    const loc = o.location_data as Record<string, unknown>[];
    const p = transformLocationMetric(loc, "month", drilldown.zone, zk, MONTHLY_VALUE_KEY, formatMonthCategoryLabel);
    return { line: null, zone: z, plant: p.groups.length ? p : null };
  }

  return { line: null, zone: z, plant: null };
}

function parseR3R1Response(
  res: unknown,
  periodView: "daily" | "monthly",
  scopeMode: "overall" | "zone",
  drilldown: { zone: string; monthCat: string } | null
): ParsedBundle {
  const empty = emptyParsedBundle();
  const payload = unwrapPayload(res);
  if (payload == null) return empty;

  if (periodView === "monthly" && typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    const hasMonthly = Array.isArray(o.monthly_data) && o.monthly_data.length > 0;
    const hasZone = Array.isArray(o.zone_data) && o.zone_data.length > 0;
    if (hasMonthly || hasZone) {
      const nested = parseMonthlyAggregateNested(o, scopeMode, drilldown);
      if (nested.line || nested.zone || nested.plant) return nested;
    }
  }

  const preferMonthly = periodView === "monthly";
  const rowsFromPayload = extractDataRows(payload);
  if (rowsFromPayload?.length && detectIndentValueKey(rowsFromPayload[0]!)) {
    return parseAvgR1DiffR3Rows(rowsFromPayload, periodView, scopeMode, drilldown);
  }

  if (Array.isArray(payload) && payload.length && typeof payload[0] === "object" && payload[0] !== null) {
    if (periodView === "monthly" && scopeMode === "zone") {
      /* try nested object path below */
    } else {
      const rows = payload as Record<string, unknown>[];
      const periodKey = detectPeriodKey(rows[0]!, preferMonthly);
      const rk = periodKey ? discoverR3R1Keys(rows[0]!) : null;
      if (!periodKey || !rk) return empty;
      const labelFn = preferMonthly ? formatMonthLabel : formatDayLabel;
      const line = transformOverallTwoSeries(rows, periodKey, rk, labelFn);
      return { ...empty, line };
    }
  }

  if (typeof payload !== "object" || payload === null) return empty;
  const o = payload as Record<string, unknown>;

  const overall = pickArray(o, ["overall_data", "overall", "daily_overall", "monthly_overall"]);
  const zone = pickArray(o, ["zone_data", "zone_wise", "zones_data"]);
  const location = pickArray(o, ["location_data", "plant_data", "plants_data"]);
  const trendFallback = periodView === "daily" ? pickArray(o, ["trend", "series"]) : null;

  if (periodView === "daily" || scopeMode === "overall") {
    const lineRows = overall?.length
      ? overall
      : periodView === "daily" && trendFallback?.length
        ? trendFallback
        : null;
    if (!lineRows?.length) return empty;
    const sample0 = lineRows[0]!;
    const periodKey = detectPeriodKey(sample0, preferMonthly);
    const rk = periodKey ? discoverR3R1Keys(sample0) : null;
    if (!periodKey || !rk) return empty;
    const labelFn = preferMonthly ? formatMonthLabel : formatDayLabel;
    const line = transformOverallTwoSeries(lineRows, periodKey, rk, labelFn);
    return { ...empty, line };
  }

  if (!zone?.length) return empty;

  const sample = zone[0]!;
  const periodKey = detectPeriodKey(sample, preferMonthly);
  const zoneKey = findZoneKey(sample);
  const rk = periodKey ? discoverR3R1Keys(sample) : null;
  if (!periodKey || !zoneKey || !rk) return empty;

  const labelFn = preferMonthly ? formatMonthLabel : formatDayLabel;

  if (scopeMode === "zone" && zone?.length && zoneKey) {
    const zR3 = transformZoneMetric(zone, periodKey, zoneKey, rk.r3, labelFn);
    const zR1 = transformZoneMetric(zone, periodKey, zoneKey, rk.r1, labelFn);
    const merged = zR3.groups.length ? zR3 : zR1.groups.length ? zR1 : null;

    if (drilldown && location?.length) {
      const pR3 = transformLocationMetric(location, periodKey, drilldown.zone, zoneKey, rk.r3, labelFn);
      const pR1 = transformLocationMetric(location, periodKey, drilldown.zone, zoneKey, rk.r1, labelFn);
      const plant = pR3.groups.length ? pR3 : pR1.groups.length ? pR1 : null;
      return { line: null, zone: merged, plant };
    }

    return { line: null, zone: merged, plant: null };
  }

  return empty;
}

function DrillStateIndicator({ drillLevel }: { drillLevel: number }) {
  const states = ["Zone", "Plant"];
  return (
    <div className="flex gap-2 items-center text-xs text-gray-600 ml-2">
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

export interface TasR3R1TrendChartsProps {
  /** KPI top bar — date range, zone, plant (`"sap_id"`). */
  crossFilters: Array<{ key: string; cond: string; value: string }>;
}

const TasR3R1TrendCharts = ({ crossFilters = [] }: TasR3R1TrendChartsProps) => {
  const [periodView, setPeriodView] = useState<"daily" | "monthly">("daily");
  const [scopeMode, setScopeMode] = useState<"overall" | "zone">("overall");
  const [drilldown, setDrilldown] = useState<{ zone: string; monthCat: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  /** Daily API uses `crossFilters`; monthly ignores them. Stabilize deps so monthly does not refetch when only the bar filters update. */
  const dailyFilterKey = useMemo(
    () => (periodView === "daily" ? JSON.stringify(crossFilters) : "monthly"),
    [periodView, crossFilters]
  );

  useEffect(() => {
    if (periodView === "daily") {
      setDrilldown(null);
      setScopeMode("overall");
    }
  }, [periodView]);

  useEffect(() => {
    if (scopeMode === "overall") setDrilldown(null);
  }, [scopeMode]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const action = periodView === "monthly" ? "r3_r1_monthwise" : "r3_r1_daywise";
      const body =
        periodView === "monthly"
          ? { filters: [], cross_filters: [], action, drill_state: "" }
          : { filters: [], cross_filters: crossFilters ?? [], action, drill_state: "" };

      const response = await apiClient.post(API_R3_R1, body);
      const data = response?.data ?? response;
      const obj = data as Record<string, unknown> | undefined;
      if (obj && typeof obj === "object" && obj.status === false) {
        setError(String(obj.message ?? "R3/R1 request failed"));
        setRawResponse(null);
        return;
      }
      setRawResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load R3/R1 trend");
      setRawResponse(null);
    } finally {
      setLoading(false);
    }
  }, [periodView, dailyFilterKey]);

  const crossFiltersRef = useRef(crossFilters);
  crossFiltersRef.current = crossFilters;

  useEffect(() => {
    /* Parent applies TDY in a follow-up effect — first paint has `crossFilters: []`, which would duplicate the daywise call. */
    if (periodView === "daily" && crossFiltersRef.current.length === 0) {
      return;
    }
    void fetchData();
  }, [fetchData, periodView]);

  const parsed = useMemo(
    () => parseR3R1Response(rawResponse, periodView, scopeMode, drilldown),
    [rawResponse, periodView, scopeMode, drilldown]
  );

  const showLine = periodView === "daily" || (periodView === "monthly" && scopeMode === "overall");
  const showZone =
    periodView === "monthly" && scopeMode === "zone" && !drilldown && Boolean(parsed.zone?.chartData.length);
  const showPlant =
    periodView === "monthly" && scopeMode === "zone" && drilldown && Boolean(parsed.plant?.chartData.length);

  const zoneBarClick =
    periodView === "monthly" && scopeMode === "zone" && !drilldown
      ? (categoryValue: string, groupName: string) =>
          setDrilldown({ zone: groupName, monthCat: categoryValue })
      : undefined;

  const chartBody = (
    <>
      {loading && (
        <div className="flex items-center justify-center h-full min-h-[400px] text-gray-500 gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}
      {!loading && error && (
        <div className="h-[200px] flex items-center justify-center text-red-600 text-sm border border-dashed rounded-md px-2 text-center">
          {error}
        </div>
      )}
      {!loading && !error && parsed.line && parsed.line.chartData.length > 0 && showLine && (
        <div className={cn("w-full", isExpanded && "flex-1 min-h-0 flex flex-col")}>
          <PerformanceScoreLineChart
            chartData={parsed.line.chartData}
            groups={parsed.line.groups}
            categoryField="cat"
            categoryLabelField="label"
            valueSuffix=" min"
            height={isExpanded ? 0 : 440}
            className={cn("w-full", isExpanded && "flex-1 min-h-[480px]")}
          />
        </div>
      )}
      {!loading && !error && showZone && parsed.zone && (
        <div className="space-y-4 w-full">
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">{INDENT_SERIES_LABEL} — by zone</div>
            <ZoneGroupedBarChart
              {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
              chartData={parsed.zone.chartData}
              groups={parsed.zone.groups}
              categoryField="cat"
              categoryLabelField="label"
              valueSuffix=" min"
              showLegend
              height={isExpanded ? 0 : 400}
              className={cn("w-full", isExpanded && "flex-1 min-h-[420px]")}
              onBarClick={zoneBarClick}
            />
          </div>
        </div>
      )}
      {!loading && !error && showPlant && parsed.plant && (
        <div className="space-y-4 w-full">
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">
              {INDENT_SERIES_LABEL} — by terminal (zone {drilldown?.zone})
            </div>
            <ZoneGroupedBarChart
              {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
              chartData={parsed.plant.chartData}
              groups={parsed.plant.groups}
              categoryField="cat"
              categoryLabelField="label"
              valueSuffix=" min"
              showLegend
              height={isExpanded ? 0 : 360}
              className={cn("w-full", isExpanded && "flex-1 min-h-[380px]")}
            />
          </div>
        </div>
      )}
      {!loading &&
        !error &&
        !(
          (showLine && parsed.line?.chartData.length) ||
          (showZone && parsed.zone?.chartData.length) ||
          (showPlant && parsed.plant?.chartData.length)
        ) && <NoDataDisplay />}
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
            <div className="flex items-center justify-between gap-2 w-full flex-wrap">
              <div className="flex-shrink-0 flex flex-col min-w-0">
                <CardTitle className="text-sm font-bold text-gray-800">
                  TAS {INDENT_SERIES_LABEL} trend
                  {drilldown && (
                    <span className="text-gray-600 font-normal ml-1">
                      — Zone: {drilldown.zone} (plants by month)
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
                      periodView === "daily" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodView("monthly")}
                    className={cn(
                      "px-2 py-1 text-xs font-medium border-l border-gray-300",
                      periodView === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    Monthly
                  </button>
                </div>
                {periodView === "monthly" && (
                  <div className="flex items-center gap-3 mr-1 flex-wrap">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="tas-r3r1-scope"
                        checked={scopeMode === "overall"}
                        onChange={() => setScopeMode("overall")}
                        className="w-3 h-3 text-blue-600"
                      />
                      <span className="text-xs font-medium text-gray-700">Overall</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="tas-r3r1-scope"
                        checked={scopeMode === "zone"}
                        onChange={() => setScopeMode("zone")}
                        className="w-3 h-3 text-blue-600"
                      />
                      <span className="text-xs font-medium text-gray-700">Zone</span>
                    </label>
                    {scopeMode === "zone" && (
                      <>
                        <DrillStateIndicator drillLevel={drilldown ? 1 : 0} />
                        {drilldown && (
                          <Button
                            type="button"
                            onClick={() => setDrilldown(null)}
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
                  onClick={() => void fetchData()}
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
        <CardContent className={cn("p-0 relative", isExpanded && "flex-1 min-h-0 overflow-auto flex flex-col")}>
          <div
            className={cn(
              "relative",
              isExpanded ? "min-h-[min(600px,calc(100vh-11rem))] flex-1 flex flex-col" : "min-h-[430px]"
            )}
          >
            {chartBody}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default TasR3R1TrendCharts;
