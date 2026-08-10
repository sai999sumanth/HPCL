/** Shared types + helpers for `POST /api/tableanalytics/generate_data_aggregations` (natural gas GV connections). */

export type AggRow = Record<string, unknown>;

export const NATURAL_GAS_GV_CONNECTIONS_AGGREGATION_PAYLOAD = {
  table: "natural_gas_gv_connections",
  filters: {},
  date_column: "conn_date",
  date_from: "2026-02-16",
  date_to: "2026-04-17",
  aggregations: ["['Total', 'sum', 'achieved_count']"],
  detail_fields: [],
  order_by: ["['Total', 'desc']"],
  limit: 0,
  skip: 0,
  group_by: ["gv_name", "conn_date", "ga_name"],
} as const;

/** Monthly buckets for JV comparison chart (`date_trunc` in group_by). */
export const NATURAL_GAS_MONTHLY_COMPARISON_AGGREGATION_PAYLOAD = {
  ...NATURAL_GAS_GV_CONNECTIONS_AGGREGATION_PAYLOAD,
  group_by: ["gv_name","[\"date_trunc('month', conn_date)\", 'conn_date']","ga_name"],
} as const;

export function normalizeAggregationRows(payload: unknown): AggRow[] {
  if (Array.isArray(payload)) {
    return payload.filter((x): x is AggRow => x != null && typeof x === "object");
  }
  if (!payload || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  const listKeys = ["rows", "items", "values", "content", "result"] as const;
  for (const k of listKeys) {
    const v = o[k];
    if (!Array.isArray(v) || v.length === 0) continue;
    const nested = normalizeAggregationRows(v);
    if (nested.length > 0) return nested;
  }
  if (o.data !== undefined) return normalizeAggregationRows(o.data);
  return [];
}

export function rowTotal(r: AggRow): number {
  const t = r.total ?? r.Total ?? r.TOTAL ?? r["Total"] ?? r["total"];
  const n = typeof t === "number" ? t : Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return v.toLocaleString("en-IN");
  const n = Number(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(n)) return n.toLocaleString("en-IN");
  return String(v);
}

/** Raw API date string → readable label when parseable. */
export function formatConnDateLabel(raw: unknown): string {
  const s = String(raw ?? "—").trim() || "—";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return s;
}

/** Prefer month bucket field when API returns `date_trunc(...)` or similar in row keys. */
export function extractGroupedMonthRaw(r: AggRow): unknown {
  for (const k of Object.keys(r)) {
    const kl = k.toLowerCase();
    if (kl.includes("date_trunc") || (kl.includes("month") && /conn|date/i.test(k))) {
      return r[k as keyof AggRow];
    }
  }
  return r.conn_date ?? r.Conn_date ?? r.date;
}

function monthSortKey(raw: unknown): string {
  const d = new Date(String(raw));
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  const s = String(raw ?? "").trim();
  return s || "—";
}

function formatMonthCategory(raw: unknown): string {
  const d = new Date(String(raw));
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }
  return String(raw ?? "—");
}

export type TripleLineAggPoint = { category: string; v0: number; v1: number; v2: number };

/**
 * Sums achieved totals by calendar month and JV (HPCL / HOGPL / BGL) for the triple-line chart.
 * Rows are expected from monthly `group_by` including `date_trunc('month', conn_date)`.
 */
export function buildMonthlyJvTripleLinePoints(rows: AggRow[]): TripleLineAggPoint[] {
  const byMonth = new Map<string, { label: string; totals: [number, number, number] }>();

  for (const r of rows) {
    const gv = String(r.gv_name ?? r.gvName ?? "").trim();
    const upper = gv.toUpperCase();
    const slot: 0 | 1 | 2 | null =
      upper === "HPCL" ? 0 : upper === "HOGPL" ? 1 : upper === "BGL" ? 2 : null;
    if (slot === null) continue;

    const rawm = extractGroupedMonthRaw(r);
    const sortKey = monthSortKey(rawm);
    if (sortKey === "—") continue;

    const v = rowTotal(r);
    let rec = byMonth.get(sortKey);
    if (!rec) {
      rec = { label: formatMonthCategory(rawm), totals: [0, 0, 0] };
      byMonth.set(sortKey, rec);
    }
    rec.totals[slot] += v;
  }

  const sortedKeys = [...byMonth.keys()].sort((a, b) => a.localeCompare(b));
  return sortedKeys.map((k) => {
    const rec = byMonth.get(k)!;
    return {
      category: rec.label,
      v0: rec.totals[0],
      v1: rec.totals[1],
      v2: rec.totals[2],
    };
  });
}
