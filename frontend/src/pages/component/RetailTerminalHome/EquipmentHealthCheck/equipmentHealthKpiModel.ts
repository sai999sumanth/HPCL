export type EquipmentHealthKpiModel = {
  /** Server-reported total (all pages). */
  apiTotal: number;
  /** Rows used for status breakdown (current request page / window). */
  loadedRowCount: number;
  openOnLoaded: number;
  resolvedOnLoaded: number;
  closedOnLoaded: number;
  rejectedOnLoaded: number;
  otherStatusOnLoaded: number;
};

function normStatus(statusRaw: unknown): string {
  return String(statusRaw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Aggregates status counts from the **loaded** `tasfaulty` rows.
 * `apiTotal` comes from the list API (`total` / `count`) for the headline total.
 */
export function computeEquipmentHealthKpis(
  rows: Record<string, unknown>[],
  apiTotal: number
): EquipmentHealthKpiModel {
  let openOnLoaded = 0;
  let resolvedOnLoaded = 0;
  let closedOnLoaded = 0;
  let rejectedOnLoaded = 0;
  let otherStatusOnLoaded = 0;

  for (const r of rows) {
    const st = normStatus(r.status);
    if (st === "open") openOnLoaded++;
    else if (st === "resolved") resolvedOnLoaded++;
    else if (st === "closed") closedOnLoaded++;
    else if (st === "rejected" || st === "rejection") rejectedOnLoaded++;
    else otherStatusOnLoaded++;
  }

  return {
    apiTotal: Number.isFinite(apiTotal) ? apiTotal : 0,
    loadedRowCount: rows.length,
    openOnLoaded,
    resolvedOnLoaded,
    closedOnLoaded,
    rejectedOnLoaded,
    otherStatusOnLoaded,
  };
}

/** Donut / table drill: vendor slice label (matches `buildVendorDistributionFromRows`). */
export function equipmentRowVendorLabel(row: Record<string, unknown>): string {
  const v = String(row.vendor_name ?? "").trim();
  return v ? v : "Unknown";
}

/** Bar chart / table drill: location label (matches `buildLocationDistributionFromRows`; table uses `name` as Location Name). */
export function equipmentRowLocationLabel(row: Record<string, unknown>): string {
  const loc = String(row.location_name ?? "").trim();
  if (loc) return loc;
  const n = String(row.name ?? "").trim();
  return n ? n : "Unknown";
}

/** Bar chart / table drill: zone label (matches `buildZoneDistributionFromRows`; same as table `zone` column). */
export function equipmentRowZoneLabel(row: Record<string, unknown>): string {
  const z = String(row.zone ?? "").trim();
  return z ? z : "Unknown";
}

/** Donut drill level-2: coarse status bucket for a row (matches KPI bucketing). */
export function equipmentRowStatusBucket(row: Record<string, unknown>): string {
  const st = normStatus(row.status);
  if (st === "open") return "Open";
  if (st === "rejected" || st === "rejection") return "Reopened";
  if (st === "resolved") return "Resolved";
  if (st === "closed") return "Closed";
  return "Other";
}

const STATUS_BUCKET_ORDER = ["Open", "Reopened", "Resolved", "Closed", "Other"] as const;

/** Shared helper: count status buckets for rows matching a label function. */
function buildStatusDistribution(
  rows: Record<string, unknown>[],
  labelFn: (r: Record<string, unknown>) => string,
  labelValue: string
): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const k of STATUS_BUCKET_ORDER) counts.set(k, 0);
  for (const r of rows) {
    if (labelFn(r) !== labelValue) continue;
    const b = equipmentRowStatusBucket(r);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return STATUS_BUCKET_ORDER.map((name) => ({ name, value: counts.get(name) ?? 0 })).filter(
    (d) => d.value > 0
  );
}

/** Status distribution for one vendor bucket among loaded rows. */
export function buildVendorStatusDistribution(
  rows: Record<string, unknown>[],
  vendorLabel: string
): { name: string; value: number }[] {
  return buildStatusDistribution(rows, equipmentRowVendorLabel, vendorLabel);
}

/** Status distribution for one location bucket among loaded rows. */
export function buildLocationStatusDistribution(
  rows: Record<string, unknown>[],
  locationLabel: string
): { name: string; value: number }[] {
  return buildStatusDistribution(rows, equipmentRowLocationLabel, locationLabel);
}

/** Status distribution for one zone bucket among loaded rows. */
export function buildZoneStatusDistribution(
  rows: Record<string, unknown>[],
  zoneLabel: string
): { name: string; value: number }[] {
  return buildStatusDistribution(rows, equipmentRowZoneLabel, zoneLabel);
}

/** Location counts among rows in a single zone (unified zone → location drill). */
export function buildLocationDistributionForZone(
  rows: Record<string, unknown>[],
  zoneLabel: string
): { name: string; value: number }[] {
  const scoped = rows.filter((r) => equipmentRowZoneLabel(r) === zoneLabel);
  const counts = new Map<string, number>();
  for (const row of scoped) {
    const name = equipmentRowLocationLabel(row);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export type AvgClosingTimeSlice = { name: string; value: number };

function parseRowTimestampMs(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return Number.isFinite(ms) ? ms : null;
  }
  const s = String(raw).trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (dmy) {
    const day = Number.parseInt(dmy[1], 10);
    const month = Number.parseInt(dmy[2], 10) - 1;
    const year = Number.parseInt(dmy[3], 10);
    const hh = dmy[4] != null ? Number.parseInt(dmy[4], 10) : 0;
    const mm = dmy[5] != null ? Number.parseInt(dmy[5], 10) : 0;
    const ss = dmy[6] != null ? Number.parseInt(dmy[6], 10) : 0;
    const ms = new Date(year, month, day, hh, mm, ss).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const naiveIsoLocal = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/.exec(s);
  if (naiveIsoLocal && !/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s.trim())) {
    const tIst = new Date(`${naiveIsoLocal[1]}T${naiveIsoLocal[2]}+05:30`).getTime();
    if (!Number.isNaN(tIst)) return tIst;
  }
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Hours from `created_at` → `updated_at` for resolved / closed rows only. */
export function equipmentRowClosingTimeHours(row: Record<string, unknown>): number | null {
  const st = normStatus(row.status);
  if (st !== "closed" && st !== "resolved") return null;
  const createdMs = parseRowTimestampMs(row.created_at ?? (row as { createdAt?: unknown }).createdAt);
  const closedMs = parseRowTimestampMs(
    row.updated_at ??
      (row as { updatedAt?: unknown }).updatedAt ??
      (row as { modified_at?: unknown }).modified_at ??
      (row as { modifiedAt?: unknown }).modifiedAt
  );
  if (createdMs == null || closedMs == null || closedMs < createdMs) return null;
  return (closedMs - createdMs) / (1000 * 60 * 60);
}

function buildAvgClosingTimeByLabel(
  rows: Record<string, unknown>[],
  labelFn: (r: Record<string, unknown>) => string
): AvgClosingTimeSlice[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const hrs = equipmentRowClosingTimeHours(row);
    if (hrs == null) continue;
    const name = labelFn(row);
    const prev = sums.get(name) ?? { total: 0, count: 0 };
    sums.set(name, { total: prev.total + hrs, count: prev.count + 1 });
  }
  return Array.from(sums.entries())
    .map(([name, { total, count }]) => ({ name, value: total / count }))
    .sort((a, b) => b.value - a.value);
}

export function buildZoneAvgClosingTime(rows: Record<string, unknown>[]): AvgClosingTimeSlice[] {
  return buildAvgClosingTimeByLabel(rows, equipmentRowZoneLabel);
}

export function buildVendorAvgClosingTime(rows: Record<string, unknown>[]): AvgClosingTimeSlice[] {
  return buildAvgClosingTimeByLabel(rows, equipmentRowVendorLabel);
}

export function buildLocationAvgClosingTime(rows: Record<string, unknown>[]): AvgClosingTimeSlice[] {
  return buildAvgClosingTimeByLabel(rows, equipmentRowLocationLabel);
}

/** Vendor counts among rows in a zone + location (unified location → vendor drill). */
export function buildVendorDistributionForZoneLocation(
  rows: Record<string, unknown>[],
  zoneLabel: string,
  locationLabel: string
): { name: string; value: number }[] {
  const scoped = rows.filter(
    (r) =>
      equipmentRowZoneLabel(r) === zoneLabel && equipmentRowLocationLabel(r) === locationLabel
  );
  const counts = new Map<string, number>();
  for (const row of scoped) {
    const name = equipmentRowVendorLabel(row);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
