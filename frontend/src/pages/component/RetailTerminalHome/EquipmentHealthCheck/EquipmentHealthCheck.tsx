import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './equipment.css';

import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Download, FileDown, RefreshCw, AlertTriangle, Activity, X, MoreVertical, MoreHorizontal, Search, Info, Loader2, Plus, Copy, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '@/services/apiClient';
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Input } from "@/@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";
import useAuthStore from "@/store/authStore";
import {
  AlertSheetDetail,
  type EquipmentAlertsSheetCategory,
  type AlertsSheetTimeFilterValue,
} from "./AlertSheetDetail";
import { EquipmentHealthKpiWidgets } from "./EquipmentHealthKpiWidgets";
import { EquipmentRaiseRequestForm } from "./EquipmentRaiseRequestForm";
import { EquipmentHistoryDialog, EquipmentActionDialog } from "./EquipmentDialogs";
import {
  equipmentRowLocationLabel,
  equipmentRowStatusBucket,
  equipmentRowVendorLabel,
  equipmentRowZoneLabel,
  type AvgClosingTimeSlice,
} from "./equipmentHealthKpiModel";
import TASGpt from '../TASGpt';

/** KPI / drill charts load up to this many rows in one `/api/tasfaulty` call (table stays paginated). */
const CHART_AGGREGATE_MAX_ROWS = 15_000;

type AvgClosingCardsData = {
  zone: AvgClosingTimeSlice[];
  vendor: AvgClosingTimeSlice[];
  location: AvgClosingTimeSlice[];
};

const EMPTY_AVG_CLOSING_CARDS: AvgClosingCardsData = {
  zone: [],
  vendor: [],
  location: [],
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseAvgClosingSlices(input: unknown): AvgClosingTimeSlice[] {
  if (Array.isArray(input)) {
    return input
      .map((row): AvgClosingTimeSlice | null => {
        if (row == null || typeof row !== "object") return null;
        const item = row as Record<string, unknown>;
        const nameRaw =
          item.name ??
          item.label ??
          item.vendor_name ??
          item.location_name ??
          item.zone ??
          item.key;
        const name = String(nameRaw ?? "").trim();
        if (!name) return null;
        const valueRaw =
          item.value ??
          item.avg_resolution_hours ??
          item.avg_resolution ??
          item.average_resolution ??
          item.avg_closing ??
          item.average_closing ??
          item.avg_closing_time ??
          item.closing_time ??
          item.hrs ??
          item.hours;
        const value = toFiniteNumber(valueRaw);
        if (value == null) return null;
        return { name, value };
      })
      .filter((d): d is AvgClosingTimeSlice => d != null)
      .sort((a, b) => b.value - a.value);
  }

  if (input && typeof input === "object") {
    const out: AvgClosingTimeSlice[] = [];
    for (const [name, raw] of Object.entries(input as Record<string, unknown>)) {
      if (!name) continue;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;
        const val = toFiniteNumber(
          obj.value ??
            obj.avg_resolution_hours ??
            obj.avg_resolution ??
            obj.average_resolution ??
            obj.avg_closing ??
            obj.average_closing ??
            obj.avg_closing_time ??
            obj.hrs ??
            obj.hours
        );
        if (val != null) out.push({ name, value: val });
        continue;
      }
      const val = toFiniteNumber(raw);
      if (val != null) out.push({ name, value: val });
    }
    return out.sort((a, b) => b.value - a.value);
  }

  return [];
}

function findSectionByDimension(
  root: Record<string, unknown>,
  dimension: "zone" | "vendor" | "location"
): unknown {
  const preferredKeys = [
    `${dimension}_summary`,
    `${dimension}_wise_avg_resolution`,
    `${dimension}_wise_avg_closing_time`,
    `${dimension}_wise_resolution`,
    `${dimension}_wise`,
    `${dimension}_avg_resolution`,
    `${dimension}_avg_closing_time`,
  ];
  for (const key of preferredKeys) {
    if (key in root) return root[key];
  }
  const entries = Object.entries(root);
  for (const [key, value] of entries) {
    const k = key.toLowerCase();
    if (!k.includes(dimension)) continue;
    if (
      k.includes("summary") ||
      k.includes("avg") ||
      k.includes("resolution") ||
      k.includes("closing")
    ) {
      return value;
    }
  }
  return null;
}

function parseAvgClosingCardsFromAnalyticsResponse(body: unknown): AvgClosingCardsData {
  const root =
    body && typeof body === "object" && "data" in (body as Record<string, unknown>)
      ? ((body as Record<string, unknown>).data as unknown)
      : body;
  if (!root || typeof root !== "object") return EMPTY_AVG_CLOSING_CARDS;
  const dataRoot = root as Record<string, unknown>;
  return {
    zone: parseAvgClosingSlices(findSectionByDimension(dataRoot, "zone")),
    vendor: parseAvgClosingSlices(findSectionByDimension(dataRoot, "vendor")),
    location: parseAvgClosingSlices(findSectionByDimension(dataRoot, "location")),
  };
}

/** Only these roles may use "Raise a request to the vendor" on Equipment Help Desk. */
const VENDOR_RAISE_REQUEST_ROLES = [
  "Location In-Charge SOD",
  "Maintenance Officer SOD",
  "Plant In-Charge SOD",
  "Planning Officer SOD",
  "Safety Officer SOD",
] as const;

/** Collapse punctuation/spacing so API variants like "Location Incharge SOD" still match "Location In-Charge SOD". */
function compactRoleKey(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Same idea as Ticketing2 `roleMatches`: exact or substring (handles prefixed API labels).
 * Also matches when only hyphens/spacing differ (see {@link compactRoleKey}).
 * Comparison is case-insensitive so `tas vendor` matches `TAS Vendor`.
 */
function roleMatchesVendorRaise(userRole: unknown, expectedRole: string): boolean {
  const a = String(userRole ?? "").trim();
  const b = String(expectedRole ?? "").trim();
  if (!a || !b) return false;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al === bl || al.includes(bl)) return true;
  const ca = compactRoleKey(a);
  const cb = compactRoleKey(b);
  if (ca.length >= 8 && cb.length >= 8 && ca.includes(cb)) return true;
  return false;
}

/** True when this single role string is only the vendor login — must never grant "raise to vendor". */
function isStrictTasVendorRoleString(userRole: unknown): boolean {
  const raw = String(userRole ?? "").trim();
  const t = raw.toLowerCase().replace(/\s+/g, " ");
  if (t === "tas vendor" || t === "tas-vendor" || t === "tasvendor") return true;
  return /^tas\s*vendor$/i.test(raw);
}

/** Novex roles only — do not merge `system_role` or `allowed_roles` (avoids false positives; Help Desk uses Novex only). */
function collectNovexRoleStringsOnly(user: { novex_role?: unknown } | null | undefined): string[] {
  const out: string[] = [];
  const v = user?.novex_role;
  if (Array.isArray(v)) {
    v.forEach((x) => {
      const s = String(x ?? "").trim();
      if (s) out.push(s);
    });
  } else if (v != null && String(v).trim() !== "") {
    out.push(String(v).trim());
  }
  return out;
}

function isGenericAdminRoleString(userRole: unknown): boolean {
  return /^admin$/i.test(String(userRole ?? "").trim());
}

function canUserRaiseVendorRequest(user: { novex_role?: unknown; system_role?: unknown } | null | undefined): boolean {
  const roles = collectNovexRoleStringsOnly(user);
  if (roles.length === 0) return false;
  return roles.some((r) => {
    if (isStrictTasVendorRoleString(r)) return false;
    if (isGenericAdminRoleString(r)) return false;
    return VENDOR_RAISE_REQUEST_ROLES.some((allowed) => roleMatchesVendorRaise(r, allowed));
  });
}

/** True when a session role string matches one of the five allowlisted SOD officer labels (substring / compact). */
function roleMatchesAllowlistedSodOfficer(r: unknown): boolean {
  return VENDOR_RAISE_REQUEST_ROLES.some((allowed) => roleMatchesVendorRaise(r, allowed));
}

/** The five named SOD roles only (**novex_role**), no abbreviation heuristic — used to deny Help Desk ⋯ on **Open** rows. */
function isUserAllowlistedFiveSodOfficerSession(user: { novex_role?: unknown } | null | undefined): boolean {
  return collectNovexRoleStringsOnly(user).some((r) => {
    if (isStrictTasVendorRoleString(r) || isGenericAdminRoleString(r)) return false;
    return roleMatchesAllowlistedSodOfficer(r);
  });
}

/**
 * APIs sometimes send short or alternate labels (e.g. "Loc IC SOD", "Maint Officer SOD") that do not contain the
 * full allowlisted substring — still treat as the same five Novex SOD officer family when safe.
 */
function isLikelyNovexSodOfficerRoleString(roleRaw: unknown): boolean {
  const s = String(roleRaw ?? "").trim();
  if (!s || isStrictTasVendorRoleString(s) || isGenericAdminRoleString(s)) return false;
  if (/tas\s*vendor/i.test(s)) return false;
  const compact = compactRoleKey(s);
  if (!compact.includes("sod")) return false;
  const hasFamily =
    /(location|plant|maintenance|planning|safety)/i.test(s) ||
    /\b(loc|maint|plant)\b/i.test(s);
  const hasOfficerLike =
    /(in[\s\-]?charge|officer|incharge|\bic\b)/i.test(s) || /(location|plant).*(in[\s\-]?charge|ic\b)/i.test(s);
  return hasFamily && hasOfficerLike;
}

/**
 * Help Desk officers (SOD family): **novex_role** only. **Open** — only {@link isUserTasVendor}; officers do not get ⋯ on Open.
 */
function isUserEquipmentHelpDeskOfficer(user: { novex_role?: unknown } | null | undefined): boolean {
  const roles = collectNovexRoleStringsOnly(user);
  if (roles.length === 0) return false;
  return roles.some((r) => {
    if (isStrictTasVendorRoleString(r)) return false;
    if (isGenericAdminRoleString(r)) return false;
    if (roleMatchesAllowlistedSodOfficer(r)) return true;
    return isLikelyNovexSodOfficerRoleString(r);
  });
}

const TAS_VENDOR_ROLE = "TAS Vendor";

/**
 * True when **novex_role** matches TAS Vendor (substring / {@link roleMatchesVendorRaise}).
 * **novex_role** only (not `system_role` / `allowed_roles`).
 */
function isUserTasVendor(user: { novex_role?: unknown } | null | undefined): boolean {
  return collectNovexRoleStringsOnly(user).some((r) => roleMatchesVendorRaise(r, TAS_VENDOR_ROLE));
}

/** 48h limit used for **Resolved** rows (from `updated_at`) and as the base unit for open-row windows. */
const HELP_DESK_ACTION_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Avoid hiding actions when server clock is slightly ahead of the client. */
const HELP_DESK_CLOCK_SKEW_PAST_MS = 24 * 60 * 60 * 1000;
/** Small buffer so a row exactly on the 48h boundary is not dropped due to millisecond drift. */
const HELP_DESK_WINDOW_SLACK_MS = 5 * 60 * 1000;
/**
 * Officers on **open** (non-terminal) rows: use latest row timestamp with a slightly wider window than 48h
 * so backlog rows remain actionable across weekends / next-day review.
 */
const HELP_DESK_OFFICER_OPEN_ACTION_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Parse timestamps from API strings. Prefer explicit DD/MM/YYYY[, HH:mm:ss] (common in IN locale responses)
 * because `Date.parse` is unreliable for ambiguous `dd/mm/yyyy`.
 */
function parseHelpDeskTimestampMs(raw: unknown): number | null {
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
  /** `YYYY-MM-DDTHH:mm(:ss)` without `Z` / offset — treat wall time as **IST** (+05:30) for 48h window on `updated_at`. */
  const naiveIsoLocal = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/.exec(s);
  if (naiveIsoLocal && !/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s.trim())) {
    const tIst = new Date(`${naiveIsoLocal[1]}T${naiveIsoLocal[2]}+05:30`).getTime();
    if (!Number.isNaN(tIst)) return tIst;
  }
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Latest activity time on the row. Using the max of known fields fixes cases where `updated_at` is stale or
 * missing while `created_at` is fresh (officers could not see ⋯ before).
 */
function getLatestEquipmentRowTimestampMs(item: Record<string, unknown>): number | null {
  const keys = [
    "updated_at",
    "updatedAt",
    "Updated_at",
    "modified_at",
    "modifiedAt",
    "created_at",
    "createdAt",
    "updated_on",
    "last_updated",
  ] as const;
  let best: number | null = null;
  const consider = (v: unknown) => {
    const ms = parseHelpDeskTimestampMs(v);
    if (ms != null && (best == null || ms > best)) best = ms;
  };
  for (const k of keys) {
    if (k in item) consider(item[k]);
  }
  for (const k of Object.keys(item)) {
    if (/created|updated|modified|timestamp|(^|_)at$|_time$|date/i.test(k)) {
      consider(item[k]);
    }
  }
  return best;
}

function isEquipmentRowWithinHelpDeskWindow(
  item: Record<string, unknown>,
  windowMs: number = HELP_DESK_ACTION_WINDOW_MS
): boolean {
  const ms = getLatestEquipmentRowTimestampMs(item);
  if (ms == null) return false;
  const elapsed = Date.now() - ms;
  return (
    elapsed >= -HELP_DESK_CLOCK_SKEW_PAST_MS &&
    elapsed <= windowMs + HELP_DESK_WINDOW_SLACK_MS
  );
}

/**
 * For **Resolved** rows, product rule is 48h from **`updated_at`** (not max of all timestamps). Falls back to
 * `modified_at` when the API omits `updated_at`.
 */
function getEquipmentRowUpdatedAtForResolvedActionMs(item: Record<string, unknown>): number | null {
  const raw =
    item.updated_at ??
    (item as { updatedAt?: unknown }).updatedAt ??
    (item as { Updated_at?: unknown }).Updated_at;
  let ms = parseHelpDeskTimestampMs(raw);
  if (ms != null) return ms;
  return parseHelpDeskTimestampMs(
    (item as { modified_at?: unknown }).modified_at ?? (item as { modifiedAt?: unknown }).modifiedAt
  );
}

function isWithinHelpDesk48hOfUpdatedAtForResolved(item: Record<string, unknown>): boolean {
  const t = getEquipmentRowUpdatedAtForResolvedActionMs(item);
  if (t == null) return false;
  const elapsed = Date.now() - t;
  return (
    elapsed >= -HELP_DESK_CLOCK_SKEW_PAST_MS &&
    elapsed <= HELP_DESK_ACTION_WINDOW_MS + HELP_DESK_WINDOW_SLACK_MS
  );
}

/** Officers Accept/Reject while the ticket is not in a terminal state (API may use Pending/New/etc., not only "Open"). */
function isHelpDeskOfficerActionableStatus(statusRaw: unknown): boolean {
  const st = String(statusRaw ?? "").trim().toLowerCase();
  if (!st) return true;
  if (st === "resolved" || st === "closed" || st === "rejected" || st === "rejection") return false;
  return true;
}

/** Normalized status for comparisons (trim, lower, collapse spaces). */
function normalizeHelpDeskRowStatus(statusRaw: unknown): string {
  return String(statusRaw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Help Desk ⋯: **Open** — **only** {@link isUserTasVendor} (**novex_role** TAS Vendor), no time expiry.
 * **Rejected** / **Rejection** — same TAS Vendor (novex) rule, no expiry.
 * **TAS Vendor** has no ⋯ on **Resolved** (vendor submits Resolved first).
 * **Five allowlisted SOD officers** on **Resolved**: ⋯ within **48h** of `updated_at` (IST-naive ISO parsed as +05:30).
 * **Officers** (non-vendor, **novex_role** only): ⋯ on other non-terminal statuses with a rolling window; **not** on **Open** (vendor-only).
 */
function canUserSeeEquipmentHelpDeskAction(
  user: { novex_role?: unknown } | null | undefined,
  item: {
    status?: unknown;
    updated_at?: unknown;
    updatedAt?: unknown;
    modified_at?: unknown;
    created_at?: unknown;
  }
): boolean {
  const row = item as Record<string, unknown>;
  const st = normalizeHelpDeskRowStatus(item?.status);

  if (isUserTasVendor(user)) {
    // Status only — no 48h/72h or `updated_at` checks for vendor.
    return st === "open" || st === "rejected" || st === "rejection";
  }

  if (isUserAllowlistedFiveSodOfficerSession(user) && st === "open") {
    return false;
  }

  if (isUserAllowlistedFiveSodOfficerSession(user) && st === "resolved") {
    return isWithinHelpDesk48hOfUpdatedAtForResolved(row);
  }
  if (isUserEquipmentHelpDeskOfficer(user) && isHelpDeskOfficerActionableStatus(st)) {
    if (st === "open") return false;
    return isEquipmentRowWithinHelpDeskWindow(row, HELP_DESK_OFFICER_OPEN_ACTION_WINDOW_MS);
  }
  return false;
}

/** Maps Selected Alerts time filter → YYYY-MM-DD range for `created_at::DATE` in /api/alerts `q`. */
function alertsSheetFilterToDateRange(
  filter: AlertsSheetTimeFilterValue | undefined
): { from: string; to: string } | null {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const end = new Date();
  const start = new Date();

  if (filter && typeof filter === "object" && filter.key === "Date" && filter.value) {
    const parts = String(filter.value).split(",");
    const a = parts[0]?.trim();
    const b = parts[1]?.trim();
    if (a && b) return { from: a, to: b };
    return null;
  }

  const key = typeof filter === "string" ? filter : null;
  if (!key) return null;

  switch (key) {
    case "TDY":
      return { from: fmt(end), to: fmt(end) };
    case "YDY": {
      const y = new Date(end);
      y.setDate(y.getDate() - 1);
      const d = fmt(y);
      return { from: d, to: d };
    }
    case "1W":
      start.setDate(end.getDate() - 7);
      break;
    case "15D":
      start.setDate(end.getDate() - 15);
      break;
    case "1M":
      start.setMonth(end.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(end.getMonth() - 3);
      break;
    default:
      start.setMonth(end.getMonth() - 1);
  }
  return { from: fmt(start), to: fmt(end) };
}

function buildAlertsCreatedAtDateClause(
  filter: AlertsSheetTimeFilterValue | undefined,
  esc: (s: string) => string
): string {
  const range = alertsSheetFilterToDateRange(filter);
  if (!range) return "";
  return `(created_at::DATE BETWEEN '${esc(range.from)}' AND '${esc(range.to)}')`;
}

/** Device ids may include `@Plant` (e.g. `@Mathura`); alerts filters use the device id only. */
function stripDeviceNameLocationSuffix(raw: string): string {
  const s = String(raw ?? "").trim();
  const i = s.indexOf("@");
  return i >= 0 ? s.slice(0, i).trimEnd() : s;
}

/** Client-side sort value for equipment table columns (keys match column `key` in thead) */
function getEquipmentRowSortValue(row: Record<string, unknown>, key: string): string | number {
  switch (key) {
    case 'tas_faulty_unique_id': {
      const v = (row as { tas_faulty_unique_id?: unknown }).tas_faulty_unique_id;
      if (v == null || String(v).trim() === "") return "";
      const n = Number(v);
      return Number.isFinite(n) && String(v).trim() === String(n) ? n : String(v);
    }
    case 'sap_id':
      return String(row?.sap_id ?? '');
    case 'name':
      return String((row as { location_name?: string; name?: string }).location_name ?? row?.name ?? '');
    case 'device_type':
      return String(row?.device_type ?? '');
    case 'zone':
      return String(row?.zone ?? '');
    case 'vendor_name':
      return String(row?.vendor_name ?? '');
    case 'equipment_name':
      return String(row?.equipment_name ?? '');
    case 'device_id':
      return String((row as { device_id?: string }).device_id ?? '');
    case 'user_remarks':
      return String(row?.user_remarks ?? '');
    case 'vendor_remarks':
      return String(row?.vendor_remarks ?? '');
    case 'certificate': {
      const p = row?.certificate ?? (row as { certificate_file?: string }).certificate_file ?? (row as { certificate_path?: string }).certificate_path;
      return p ? String(p) : '';
    }
    case 'faulty': {
      const raw = (row as { faulty_date?: string }).faulty_date ?? row?.faulty;
      if (!raw) return 0;
      const d = parseApiUtcToDate(String(raw));
      return d ? d.getTime() : 0;
    }
    case 'created_at': {
      const raw = row?.created_at;
      if (!raw) return 0;
      const d = parseApiUtcToDate(String(raw));
      return d ? d.getTime() : 0;
    }
    case 'status':
      return String(row?.status ?? '').toLowerCase();
    case 'action':
      return row?.id != null ? Number(row.id) : 0;
    case 'faulty_history': {
      const raw = (row as { faulty_history?: unknown }).faulty_history;
      return normalizeFaultyHistory(raw).length;
    }
    default:
      return String((row as Record<string, unknown>)?.[key] ?? '');
  }
}

/** Normalize API `faulty_history` (array, JSON string, or object) for display in the history dialog */
function normalizeFaultyHistory(raw: unknown): Array<Record<string, unknown>> {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x) => x != null && typeof x === "object") as Array<Record<string, unknown>>;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const p = JSON.parse(s) as unknown;
      if (Array.isArray(p)) {
        return p.filter((x) => x != null && typeof x === "object") as Array<Record<string, unknown>>;
      }
      if (p != null && typeof p === "object") {
        return [p as Record<string, unknown>];
      }
    } catch {
      return [{ details: raw }];
    }
    return [];
  }
  if (typeof raw === "object") {
    return [raw as Record<string, unknown>];
  }
  return [];
}

/** Display API ISO timestamps in **IST** (Asia/Kolkata). */
const IST_TZ = "Asia/Kolkata";

/**
 * Backend sends **UTC** as ISO strings, often **without** `Z`. `new Date("...T07:27:03")` is treated as **local**
 * in JS — wrong. If there is no zone suffix, append `Z` so the instant is UTC, then we format with `Asia/Kolkata`.
 */
function parseApiUtcToDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const hasExplicitZone =
    /[zZ]\s*$/.test(s) ||
    /[+\-]\d{2}:\d{2}\s*$/.test(s) ||
    /[+\-]\d{4}\s*$/.test(s);
  let candidate = s;
  if (!hasExplicitZone && /^\d{4}-\d{2}-\d{2}T/i.test(s)) {
    candidate = `${s}Z`;
  }
  const d = new Date(candidate);
  if (!Number.isNaN(d.getTime())) return d;
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateTimeIst(raw: unknown, empty: string = "—"): string {
  if (raw == null || String(raw).trim() === "") return empty;
  const d = parseApiUtcToDate(String(raw));
  if (!d) return empty;
  return d.toLocaleString("en-IN", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDateIst(raw: unknown, empty: string = "—"): string {
  if (raw == null || String(raw).trim() === "") return empty;
  const d = parseApiUtcToDate(String(raw));
  if (!d) return empty;
  return d.toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** `updated_at` / `created_at` for faulty_history table */
function formatFaultyHistoryDateTime(raw: unknown): string {
  return formatDateTimeIst(raw, "-");
}

/** Maps raw API status values to user-facing display labels. */
function displayStatusLabel(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "rejected" || s === "rejection") return "Reopen";
  return status;
}

function faultyHistoryStatusPillClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "open") return "bg-green-100 text-green-800 border border-green-200";
  if (s === "closed") return "bg-red-100 text-red-800 border border-red-200";
  if (s === "rejected" || s === "rejection") return "bg-orange-100 text-orange-800 border border-orange-200";
  return "bg-gray-100 text-gray-800 border border-gray-200";
}

/** Same date fields as the "Updated at" column; used for ordering rows. */
function getFaultyHistoryEntrySortTimeMs(entry: Record<string, unknown>): number {
  const raw = entry.updated_at ?? entry.updatedAt ?? entry.created_at ?? entry.createdAt;
  if (raw == null || String(raw).trim() === "") return 0;
  const d = parseApiUtcToDate(String(raw));
  return d ? d.getTime() : 0;
}

/** Latest datetime first; rows without a parseable date sort to the bottom. */
function sortFaultyHistoryEntriesNewestFirst(
  entries: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return [...entries].sort(
    (a, b) => getFaultyHistoryEntrySortTimeMs(b) - getFaultyHistoryEntrySortTimeMs(a)
  );
}

/** Session `sap_id` / `zone` from `/api/session/me` (array or scalar). */
function normalizeSessionScopeFieldList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (x == null ? "" : String(x).trim()))
      .filter(Boolean);
  }
  const s = String(raw).trim();
  return s ? [s] : [];
}

function sameEquipmentRowSapId(sessionSap: string, rowSap: string): boolean {
  const a = sessionSap.trim();
  const b = String(rowSap ?? "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na === nb) return true;
  return false;
}

function sameEquipmentRowZone(sessionZone: string, rowZone: string): boolean {
  const a = sessionZone.trim().toLowerCase();
  const b = String(rowZone ?? "").trim().toLowerCase();
  if (!a || !b) return false;
  return a === b;
}

/**
 * Recent equipment table: filter rows by logged-in user session.
 * No SAP and no zone → all rows. SAP only → match SAP. Zone only → match zone. Both → AND.
 */
function equipmentRowMatchesSessionScope(
  row: Record<string, unknown>,
  sessionSapIds: string[],
  sessionZones: string[]
): boolean {
  const hasSap = sessionSapIds.length > 0;
  const hasZone = sessionZones.length > 0;
  if (!hasSap && !hasZone) return true;

  const rowSap = String(row.sap_id ?? "").trim();
  const rowZone = String(row.zone ?? "").trim();

  if (hasSap && hasZone) {
    const sapMatch = sessionSapIds.some((s) => sameEquipmentRowSapId(s, rowSap));
    const zoneMatch = sessionZones.some((z) => sameEquipmentRowZone(z, rowZone));
    return sapMatch && zoneMatch;
  }
  if (hasSap) {
    return sessionSapIds.some((s) => sameEquipmentRowSapId(s, rowSap));
  }
  return sessionZones.some((z) => sameEquipmentRowZone(z, rowZone));
}

/** Escape single quotes inside `q` string literals (alerts/ticketing style). */
function escapeTasFaultyQueryStringValue(s: string): string {
  return String(s).replace(/'/g, "''");
}

/**
 * GET `/api/tasfaulty` — `q` uses session `sap_id` / `zone` only (no `bu` clause).
 * Returns empty string when neither is set so the request omits `q`.
 */
function buildTasFaultyListQueryString(scopeSapIds: string[], scopeZones: string[]): string {
  const parts: string[] = [];

  if (scopeSapIds.length === 1) {
    parts.push(`sap_id='${escapeTasFaultyQueryStringValue(scopeSapIds[0])}'`);
  } else if (scopeSapIds.length > 1) {
    parts.push(
      `sap_id IN (${scopeSapIds.map((id) => `'${escapeTasFaultyQueryStringValue(id)}'`).join(",")})`
    );
  }

  if (scopeZones.length === 1) {
    parts.push(`zone='${escapeTasFaultyQueryStringValue(scopeZones[0])}'`);
  } else if (scopeZones.length > 1) {
    parts.push(
      `zone IN (${scopeZones.map((z) => `'${escapeTasFaultyQueryStringValue(z)}'`).join(",")})`
    );
  }

  return parts.join(" AND ");
}

/** Chart drill → extra `q` fragments (AND‑joined with session scope). Keeps paginated table aligned with charts. */
function buildTasFaultyChartDrillQueryParts(drill: {
  vendor: string | null;
  location: string | null;
  zone: string | null;
  status: string | null;
}): string[] {
  const parts: string[] = [];
  const vn = drill.vendor != null ? String(drill.vendor).trim() : "";
  if (vn) parts.push(`vendor_name='${escapeTasFaultyQueryStringValue(vn)}'`);

  const loc = drill.location != null ? String(drill.location).trim() : "";
  if (loc) {
    const e = escapeTasFaultyQueryStringValue(loc);
    parts.push(`(location_name='${e}' OR name='${e}')`);
  }

  const zn = drill.zone != null ? String(drill.zone).trim() : "";
  if (zn) parts.push(`zone='${escapeTasFaultyQueryStringValue(zn)}'`);

  const st = drill.status != null ? String(drill.status).trim() : "";
  if (st) {
    const key = st.toLowerCase();
    if (key === "open") {
      parts.push(`LOWER(TRIM(COALESCE(status,'')))='open'`);
    } else if (key === "rejected") {
      parts.push(
        `(LOWER(TRIM(COALESCE(status,'')))='rejected' OR LOWER(TRIM(COALESCE(status,'')))='rejection')`
      );
    } else if (key === "resolved") {
      parts.push(`LOWER(TRIM(COALESCE(status,'')))='resolved'`);
    } else if (key === "closed") {
      parts.push(`LOWER(TRIM(COALESCE(status,'')))='closed'`);
    } else if (key === "other") {
      parts.push(
        `(LOWER(TRIM(COALESCE(status,''))) NOT IN ('open','rejected','rejection','resolved','closed') OR TRIM(COALESCE(status,''))='')`
      );
    } else {
      parts.push(`LOWER(TRIM(COALESCE(status,'')))='${escapeTasFaultyQueryStringValue(key)}'`);
    }
  }
  return parts;
}

function mergeTasFaultyQ(baseQ: string, extraParts: string[]): string {
  const all = [...(baseQ.trim() ? [baseQ.trim()] : []), ...extraParts.filter(Boolean)];
  return all.join(" AND ");
}

/** Parse /api/tasfaulty/get_info response into a list of device id strings */
function normalizeDeviceIdList(payload: unknown): string[] {
  if (payload == null) return [];
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") return String(item).trim();
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          const v = o.device_id ?? o.deviceId ?? o.id ?? o.unique_id;
          return v != null ? String(v).trim() : "";
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.data)) return normalizeDeviceIdList(o.data);
    /** e.g. { results: ["LP 01_…@Mathura", …], sap_id: "1128" } from /api/tasfaulty/get_info */
    if (Array.isArray(o.results)) return normalizeDeviceIdList(o.results);
    if (Array.isArray(o.rows)) return normalizeDeviceIdList(o.rows);
    if (Array.isArray(o.device_ids)) return normalizeDeviceIdList(o.device_ids);
    if (Array.isArray(o.deviceIds)) return normalizeDeviceIdList(o.deviceIds);
    const single = o.device_id ?? o.deviceId;
    if (single != null && String(single).trim() !== "") return [String(single).trim()];
    if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
      return normalizeDeviceIdList(o.data);
    }
  }
  return [];
}

const EquipmentHealthCheck: React.FC = () => {

  const [showForm, setShowForm] = useState(false);

  const [refreshCounter, setRefreshCounter] = useState(0);

  /** Chart drill state — each card is fully independent. */
  const [vendorDonutDrillVendor, setVendorDonutDrillVendor] = useState<string | null>(null);
  const [vendorDonutDrillVendorStatus, setVendorDonutDrillVendorStatus] = useState<string | null>(null);
  const [vendorDonutDrillLocation, setVendorDonutDrillLocation] = useState<string | null>(null);
  const [vendorDonutDrillLocationStatus, setVendorDonutDrillLocationStatus] = useState<string | null>(null);
  const [vendorDonutDrillZone, setVendorDonutDrillZone] = useState<string | null>(null);
  const [vendorDonutDrillZoneStatus, setVendorDonutDrillZoneStatus] = useState<string | null>(null);

  const handleChartDrillVendor = useCallback((vendorLabel: string | null) => {
    setCurrentPage(0);
    setVendorDonutDrillVendor(vendorLabel);
    if (!vendorLabel) setVendorDonutDrillVendorStatus(null);
  }, []);
  const handleChartDrillVendorStatus = useCallback((statusBucket: string) => {
    setCurrentPage(0);
    setVendorDonutDrillVendorStatus((prev) => (prev === statusBucket ? null : statusBucket));
  }, []);

  const handleChartDrillLocation = useCallback((locationLabel: string | null) => {
    setCurrentPage(0);
    setVendorDonutDrillLocation(locationLabel);
    if (!locationLabel) setVendorDonutDrillLocationStatus(null);
  }, []);
  const handleChartDrillLocationStatus = useCallback((statusBucket: string) => {
    setCurrentPage(0);
    setVendorDonutDrillLocationStatus((prev) => (prev === statusBucket ? null : statusBucket));
  }, []);

  const handleChartDrillZone = useCallback((zoneLabel: string | null) => {
    setCurrentPage(0);
    setVendorDonutDrillZone(zoneLabel);
    if (!zoneLabel) setVendorDonutDrillZoneStatus(null);
  }, []);
  const handleChartDrillZoneStatus = useCallback((statusBucket: string) => {
    setCurrentPage(0);
    setVendorDonutDrillZoneStatus((prev) => (prev === statusBucket ? null : statusBucket));
  }, []);

  const [filterFormData, setFilterFormData] = useState({
    sap_id: "",
    location_name: "",
    device_category: "",
    device_type: "",
    selecting_areas: "",
    zone: "",
    vendor_name: "",
    equipment_name: "",
    device_id: "",
    severity: "",
    user_remarks: "",
    faulty_date: "",
    certificate_file: null,
  });

  // File upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Equipment table custom horizontal scrollbar ─────────────────────── */
  const eqScrollInnerRef = useRef<HTMLDivElement>(null);
  const eqHTrackRef = useRef<HTMLDivElement>(null);
  const [eqHScrollMetrics, setEqHScrollMetrics] = useState({
    scrollLeft: 0, scrollWidth: 0, clientWidth: 0, trackWidth: 0,
  });
  const updateEqHScroll = useCallback(() => {
    const el = eqScrollInnerRef.current;
    const track = eqHTrackRef.current;
    if (!el) return;
    setEqHScrollMetrics({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      trackWidth: track?.clientWidth ?? el.clientWidth,
    });
  }, []);
  const handleEqThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = eqScrollInnerRef.current;
    const track = eqHTrackRef.current;
    if (!el || !track) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll <= 0) return;
    const trackW = track.clientWidth;
    const thumbW = Math.max(40, (el.clientWidth / el.scrollWidth) * trackW);
    const movable = Math.max(1, trackW - thumbW);
    const startX = e.clientX;
    const startScroll = el.scrollLeft;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      el.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const handleEqTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.thumb === 'true') return;
    const el = eqScrollInnerRef.current;
    const track = eqHTrackRef.current;
    if (!el || !track) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll <= 0) return;
    const trackW = track.clientWidth;
    const thumbW = Math.max(40, (el.clientWidth / el.scrollWidth) * trackW);
    const movable = Math.max(1, trackW - thumbW);
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (x - thumbW / 2) / movable));
    el.scrollLeft = ratio * maxScroll;
  };
  useEffect(() => {
    const el = eqScrollInnerRef.current;
    const track = eqHTrackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateEqHScroll());
    ro.observe(el);
    if (track) ro.observe(track);
    window.addEventListener('resize', updateEqHScroll);
    const raf = requestAnimationFrame(() => updateEqHScroll());
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', updateEqHScroll); };
  }, [updateEqHScroll]);

  const user = useAuthStore((state) => state.user);

  const canRaiseVendorRequest = useMemo(() => canUserRaiseVendorRequest(user), [user]);
  const userIsTasVendor = useMemo(() => isUserTasVendor(user), [user]);

  /** TAS Vendor Help Desk action label (API still sends `resolved: true`). Non-vendor flow only offers Rejected in the dialog. */
  const helpDeskPositiveUiLabel = useMemo(() => "Resolved", []);

  /** Close raise-request form if session/roles change and user no longer has access. */
  useEffect(() => {
    if (showForm && !canRaiseVendorRequest) {
      setShowForm(false);
      toast.error("You do not have permission to raise vendor requests.");
    }
  }, [showForm, canRaiseVendorRequest]);

  const rawZoneForFx = Array.isArray(user?.zone)
    ? (user?.zone?.[0] ?? "")
    : (user as any)?.zone ?? "";
  const rawSapForFx = Array.isArray(user?.sap_id)
    ? (user?.sap_id?.[0] ?? "")
    : (user as any)?.sap_id ?? "";
  const userZoneKey = String(rawZoneForFx ?? "").trim();
  const userSapKey = String(rawSapForFx ?? "").trim();

  // Dropdown data state
  const [dropdownData, setDropdownData] = useState<{
    zones: any[];
    sapIds: any[];
  }>({
    zones: [],
    sapIds: [],
  });
  const [dropdownLoading, setDropdownLoading] = useState(false);

  /**
   * After `handleClear` (post-submit) `sap_id` is empty; opening the form again must repopulate from session +
   * `dropdownData` so `/api/tashelpdeskvendormails` runs. Single state update before `showForm` so the vendor effect
   * sees `sap_id` on the same open.
   */
  const openRaiseRequestToVendor = useCallback(() => {
    setFilterFormData((prev) => {
      if (String(prev.sap_id ?? "").trim()) return prev;
      if (!userZoneKey && !userSapKey) return prev;

      const zonesNormalized = dropdownData.zones;
      const plantsNormalized = dropdownData.sapIds;

      const defaultZoneId =
        (zonesNormalized.find((z: any) => String(z.id) === String(userZoneKey)) ??
          zonesNormalized.find((z: any) => String(z.name) === String(userZoneKey)))?.id ||
        userZoneKey ||
        "";

      const defaultSap = userSapKey
        ? (plantsNormalized.find((p: any) => String(p.id) === String(userSapKey)) ??
            plantsNormalized.find((p: any) => String(p.name) === String(userSapKey)))
        : undefined;

      const defaultSapId = defaultSap?.id || userSapKey || "";
      const defaultLocationName = defaultSap?.location_name || defaultSap?.name || "";

      if (!defaultSapId && !defaultZoneId) return prev;

      return {
        ...prev,
        zone: defaultZoneId || prev.zone,
        sap_id: defaultSapId || prev.sap_id,
        location_name: defaultLocationName || prev.location_name,
      };
    });
    setShowForm(true);
  }, [userZoneKey, userSapKey, dropdownData.zones, dropdownData.sapIds]);

  // API response data state
  const [apiResponseData, setApiResponseData] = useState(null);
  const [allEquipmentData, setAllEquipmentData] = useState([]);
  const [loadingAllData, setLoadingAllData] = useState(false);
  /** Full list (up to server total, capped) for KPI charts only — `allEquipmentData` stays one table page. */
  const [equipmentChartAggregateData, setEquipmentChartAggregateData] = useState<unknown[]>([]);
  const [loadingChartAggregate, setLoadingChartAggregate] = useState(false);
  const [avgClosingCardsData, setAvgClosingCardsData] = useState<AvgClosingCardsData>(EMPTY_AVG_CLOSING_CARDS);
  const [loadingAvgClosingCards, setLoadingAvgClosingCards] = useState(false);
  /**
   * Unfiltered total — updated ONLY when no drill is active so the chart aggregate
   * is never re-triggered by a drill-filtered list count.
   */
  const [unfilteredTotal, setUnfilteredTotal] = useState(0);

  // Add Alert sheet state
  const [showAddAlertSheet, setShowAddAlertSheet] = useState(false);

  // Add Alert sheet internal state (AlertsTable fetches its own data via query)
  const [alertTypes, setAlertTypes] = useState<string[]>([]);
  const [alertTypeOptions, setAlertTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [loadingAlertTypes, setLoadingAlertTypes] = useState(false);
  /** Faulty vs Maintenance: same `/api/alerts`; `q` includes `alert_category`. */
  const [alertsSheetCategoryTab, setAlertsSheetCategoryTab] =
    useState<EquipmentAlertsSheetCategory>("Faulty");
  /** Time range for /api/alerts `q` (default last 1 month — matches EnhancedTimeFilter `1M`). */
  const [alertsSheetTimeFilter, setAlertsSheetTimeFilter] =
    useState<AlertsSheetTimeFilterValue>("1M");
  /** Rows checked in Add Alert sheet grid (used on Raise Request submit for alert_id / device fields) */
  const [selectedAlertRows, setSelectedAlertRows] = useState<any[]>([]);

  // Dialog state
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [justification, setJustification] = useState("");
  const [actionType, setActionType] = useState<string>("resolved");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyDialogItem, setHistoryDialogItem] = useState<Record<string, unknown> | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  /** Bumps on each list effect run so stale `/api/tasfaulty` responses do not overwrite state. */
  const equipmentListFetchRunIdRef = useRef(0);
  /** Bumps so overlapping chart-aggregate fetches do not overwrite state. */
  const chartAggregateFetchRunIdRef = useRef(0);

  /** Recent equipment table: client-side sort (current page only) */
  const [equipmentTableSortColumn, setEquipmentTableSortColumn] = useState<string | null>(null);
  const [equipmentTableSortDirection, setEquipmentTableSortDirection] = useState<'asc' | 'desc'>('asc');

  // Download state
  const [downloadingFileId, setDownloadingFileId] = useState<number | string | null>(null);

  // Vendor mail mapping from /api/tashelpdeskvendormails (multiple rows → user picks vendor)
  const [vendorMailRows, setVendorMailRows] = useState<any[]>([]);
  const [loadingVendorMails, setLoadingVendorMails] = useState(false);
  const [selectedVendorRowId, setSelectedVendorRowId] = useState("");

  /** Options from POST /api/tasfaulty/get_info (sap_id + equipment_name) */
  const [deviceIdOptions, setDeviceIdOptions] = useState<string[]>([]);
  const [loadingDeviceIds, setLoadingDeviceIds] = useState(false);

  // Handle input change for filter form
  const handleInputChange = (field: string, value: string | File | null) => {
    setFilterFormData((prev) => {
      // When device category changes, clear Selecting Areas to avoid invalid combinations
      if (field === "device_type") {
        const v = value as string;
        return { ...prev, device_type: v, device_category: v, selecting_areas: "", device_id: "" };
      }
      if (field === "equipment_name") {
        return { ...prev, equipment_name: value as string, device_id: "" };
      }
      if (field === "sap_id" && typeof value === "string") {
        return { ...prev, sap_id: value, device_id: "" };
      }
      return { ...prev, [field]: value };
    });

    // Auto-fill location name when SAP ID is selected
    if (field === "sap_id" && value && typeof value === 'string') {
      // Find the corresponding name for the selected SAP ID
      const selectedSapItem = dropdownData.sapIds.find(item => item.id === value);
      if (selectedSapItem) {
        setFilterFormData((prev) => ({ ...prev, name: selectedSapItem.name }));
        console.log("Auto-filled location name:", selectedSapItem.name);
      }
    }
  };

  // Area options based on selected Device Category
  const areaOptions =
    filterFormData.device_type === "TAS Safety"
      ? ["Tank Farm", "Control Room", "Software and Reports"]
      : ["TT Gantry", "Tank Farm", "Control Room", "Software and Reports"];

  // Equipment Name options based on Device Category and Selecting Areas
  let equipmentOptions: string[] = [];

  if (filterFormData.device_type === "TAS process") {
    if (filterFormData.selecting_areas === "TT Gantry") {
      equipmentOptions = [
        "BCU",
        "MFM",
        "DCV",
        "RTD",
        "VFD",
        "Header PT",
        "RIT",
        "Card Reader",
        "Barrier Gate",
        "EDU",
        "On/off Valve",
        "Biometric system",
        "Header MOVs",
        "Others",
      ];
    } else if (filterFormData.selecting_areas === "Tank Farm") {
      equipmentOptions = [
        "Primary Radar",
        "MST",
        "WLS",
        "TSI",
        "CIU/FCU",
        "Density Probe",
        "PT",
        "Header Density Meter",
        "Header MFMs",
        "Others",
      ];
    } else if (filterFormData.selecting_areas === "Control Room") {
      equipmentOptions = [
        "LRC Server",
        "Client Machines",
        "Terminal Server",
        "Ethernet Switch",
        "KVM Switch",
        "Ethernet Gateway",
        "Process PLC",
        "Control Room LED Screen",
        "Control Room Printer",
        "Others",
      ];
    } else if (filterFormData.selecting_areas === "Software and Reports") {
      equipmentOptions = [
        "SCADA",
        "PLC Logic",
        "Reports",
        "Others",
      ];
    }
  } else if (filterFormData.device_type === "TAS Safety") {
    if (filterFormData.selecting_areas === "Tank Farm") {
      equipmentOptions = [
        "Secondary Radars",
        "VFTs",
        "ROSOV/MOV Communication",
        "HCD communication",
        "Field Hooters",
        "ESDs",
        "Others",
      ];
    } else if (filterFormData.selecting_areas === "Control Room") {
      equipmentOptions = [
        "Safety PLC",
        "Hooters",
        "Ethernet Switches",
        "WDM/FDAP",
        "CIU/FCU",
        "Others",
      ];
    } else if (filterFormData.selecting_areas === "Software and Reports") {
      equipmentOptions = [
        "SCADA",
        "PLC Logic",
        "Reports",
        "Others",
      ];
    }
  }

  // Pagination functions
  const handlePageChange = (page: number) => {
    const maxPage = Math.max(0, Math.ceil(totalItems / itemsPerPage) - 1);
    const validPage = Math.max(0, Math.min(page, maxPage));
    setCurrentPage(validPage);
  };

  const handleItemsPerPageChange = (num: number) => {
    setItemsPerPage(num);
    setCurrentPage(0);
  };

  // Action dialog functions
  const handleActionClick = (item: any) => {
    if (!canUserSeeEquipmentHelpDeskAction(user, item)) {
      toast.error(
        isUserTasVendor(user)
          ? "You cannot perform this action on this ticket (TAS Vendor can act on Open or Rejected only)."
          : "You cannot perform this action (check role, status, or time limits; five SOD officers cannot act on Open rows)."
      );
      return;
    }
    setSelectedItem(item);
    setJustification("");
    setActionType(userIsTasVendor ? "resolved" : "rejection");
    setShowActionDialog(true);
  };

  const handleDialogSubmit = async () => {
    if (!justification.trim()) {
      toast.error("Please provide justification");
      return;
    }

    if (!selectedItem) {
      toast.error("No equipment selected");
      return;
    }

    if (!canUserSeeEquipmentHelpDeskAction(user, selectedItem as { status?: unknown; updated_at?: unknown })) {
      toast.error("This action is no longer available.");
      setShowActionDialog(false);
      setSelectedItem(null);
      return;
    }

    try {
      const resolvedFlag = userIsTasVendor ? true : actionType === "resolved";
      const remarks = justification.trim();
      const payload = userIsTasVendor
        ? {
            transaction_id: String(selectedItem.id || ""),
            resolved: resolvedFlag,
            vendor_remarks: remarks,
          }
        : {
            transaction_id: String(selectedItem.id || ""),
            resolved: resolvedFlag,
            user_remarks: remarks,
          };

      console.log("Submitting payload:", payload);

      await apiClient.post('/api/tasfaulty/update_faulty', payload);

      toast.success("Equipment marked as faulty successfully!");
      setShowActionDialog(false);
      setSelectedItem(null);
      setJustification("");
      setActionType(userIsTasVendor ? "resolved" : "rejection");

      // Refresh the data after successful submission
      setRefreshCounter(prev => prev + 1);
    } catch (error) {
      console.error('Error marking equipment as faulty:', error);
      toast.error('Failed to mark equipment as faulty');
    }
  };

  // Handle certificate download
  const handleCertificateDownload = async (item: any) => {
    const filePath = item.certificate || item.certificate_file || item.certificate_path;

    if (!filePath || downloadingFileId) return;

    setDownloadingFileId(item.id);

    try {
      const response = await apiClient.post(
        "/api/noticesvts/download_notice",
        { id: item.id, file_path: filePath },
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);

      const link = document.createElement("a");
      link.href = blobUrl;
      const filename = filePath.split("/").pop() || filePath.split("\\").pop() || "certificate";
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
      toast.success("Certificate downloaded successfully");
    } catch (error) {
      console.error("Error downloading certificate:", error);
      toast.error("Failed to download certificate. Please try again.");
    } finally {
      setDownloadingFileId(null);
    }
  };

  // Validate if all required fields are filled (certificate file is now optional)
  const isFormValid = () => {
    const base =
      filterFormData.sap_id.trim() &&
      filterFormData.location_name.trim() &&
      filterFormData.device_type.trim() &&
      filterFormData.zone.trim() &&
      filterFormData.equipment_name.trim() &&
      filterFormData.user_remarks.trim() &&
      filterFormData.faulty_date.trim();
    if (!base) return false;
    // Multiple vendor rows: user must choose one
    if (vendorMailRows.length > 1) {
      return Boolean(selectedVendorRowId && filterFormData.vendor_name.trim());
    }
    return true;
  };


  const handleSearchEquipment = async () => {
    if (!canRaiseVendorRequest) {
      toast.error("You do not have permission to raise a vendor request.");
      return;
    }
    if (!isFormValid()) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const joinAlertField = (key: "device_name" | "device_type" | "id") =>
        selectedAlertRows
          .map((row: any) => {
            if (key === "id") {
              return String(row?.unique_id ?? row?.alert_id ?? "").trim();
            }
            return String(row?.[key] ?? "").trim();
          })
          .filter(Boolean)
          .join(", ");

      const alertDeviceName = joinAlertField("device_name");
      const alertDeviceType = joinAlertField("device_type");
      const alertId = joinAlertField("id");
      const vendorNameForApi = filterFormData.vendor_name.trim();

      const deviceCategoryForApi =
        filterFormData.device_category.trim() || filterFormData.device_type.trim();

      // Build query parameters — device_name / device_type / alert_id from checked rows in Add Alert sheet; vendor_name from form
      const queryParamsObj: any = {
        sap_id: filterFormData.sap_id,
        location_name: filterFormData.location_name,
        device_category: deviceCategoryForApi,
        device_type: alertDeviceType || filterFormData.device_type,
        selecting_areas: filterFormData.selecting_areas,
        zone: filterFormData.zone,
        equipment_name: filterFormData.equipment_name,
        device_id: filterFormData.device_id.trim(),
        user_remarks: filterFormData.user_remarks,
        faulty_date: filterFormData.faulty_date,
        device_name: alertDeviceName,
        alert_id: alertId,
        vendor_name: vendorNameForApi,
      };

      // Only add certificate parameter if file exists
      if (filterFormData.certificate_file?.name) {
        queryParamsObj.certificate = filterFormData.certificate_file.name;
      }

      const queryParams = new URLSearchParams(queryParamsObj);

      // Create FormData for the file upload (optional); mirror alert + vendor fields on body for multipart parsers
      const formDataPayload = new FormData();
      if (filterFormData.certificate_file) {
        formDataPayload.append('certificate_file', filterFormData.certificate_file);
      } else {
        formDataPayload.append('no_file_uploaded', 'true');
      }
      formDataPayload.append('device_name', alertDeviceName);
      formDataPayload.append('device_category', deviceCategoryForApi);
      formDataPayload.append('device_type', alertDeviceType || filterFormData.device_type);
      formDataPayload.append('alert_id', alertId);
      formDataPayload.append('vendor_name', vendorNameForApi);
      if (filterFormData.device_id.trim()) {
        formDataPayload.append('device_id', filterFormData.device_id.trim());
      }

      const response = await apiClient.post(
        `/api/tasfaulty/tas_faulty_create?${queryParams.toString()}`,
        formDataPayload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('API Response:', response.data);
      toast.success('Equipment health check submitted successfully!');

      // Clear form after successful submission
      handleClear();


      fetchAllEquipmentData(0, itemsPerPage);


      setShowForm(false);
    } catch (error) {
      console.error('API Error:', error);
      toast.error(error.response?.data?.message || 'Failed to submit equipment health check');
    }
  };
  // Handle clear form
  const handleClear = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }

    setFilterFormData({
      sap_id: "",
      location_name: "",
      device_category: "",
      device_type: "",
      selecting_areas: "",
      zone: "",
      vendor_name: "",
      equipment_name: "",
      device_id: "",
      severity: "",
      user_remarks: "",
      faulty_date: "",
      certificate_file: null,
    });
    setVendorMailRows([]);
    setSelectedVendorRowId("");
    setSelectedAlertRows([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setRefreshCounter(prev => prev + 1);
  };

  // Handle file change for certificate upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const isValidType = allowedTypes.includes(file.type) ||
        ['jpg', 'jpeg', 'png', 'pdf'].includes(fileExtension || '');

      if (!isValidType) {
        toast.error("Please upload only JPG, PNG, or PDF files.");
        e.target.value = ''; // Clear the input
        return;
      }

      // Validate file size (max 8MB)
      const maxSize = 8 * 1024 * 1024; // 8MB in bytes
      if (file.size > maxSize) {
        toast.error("File size must be less than 8MB.");
        e.target.value = ''; // Clear the input
        return;
      }

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      const isImageFile = file.type.startsWith('image/') ||
        ['jpg', 'jpeg', 'png'].includes(fileExtension || '');

      if (isImageFile) {
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
      } else {
        setImagePreview(null);
      }

      setFilterFormData((prev) => ({
        ...prev,
        certificate_file: file,
      }));

      toast.success("File selected successfully!");
    }
  };

  // Handle remove image preview
  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }

    setFilterFormData((prev) => ({
      ...prev,
      certificate_file: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fetch interlock_name from /api/alerts. `alert_category` is added only on the Maintenance tab.
  const fetchAlertTypeOptions = async (categoryOverride?: EquipmentAlertsSheetCategory) => {
    const category = categoryOverride ?? alertsSheetCategoryTab;
    setLoadingAlertTypes(true);
    try {
      const rawZone = Array.isArray(user?.zone)
        ? (user?.zone?.[0] ?? "")
        : (user as any)?.zone ?? "";
      const zone = String(rawZone ?? "").trim();
      const locationName = String(filterFormData?.location_name ?? "").trim();
      const deviceName = stripDeviceNameLocationSuffix(String(filterFormData?.device_id ?? ""));
      const parts: string[] = ["alert_section='TAS'"];
      if (category === "Maintenance") {
        parts.push("(alert_category='Maintenance')");
      }
      if (zone) parts.push(`(zone='${zone.replace(/'/g, "''")}')`);
      if (locationName) parts.push(`(location_name='${locationName.replace(/'/g, "''")}')`);
      const esc = (s: string) => String(s).replace(/'/g, "''");
      const dateClause = buildAlertsCreatedAtDateClause(alertsSheetTimeFilter, esc);
      if (dateClause) parts.push(dateClause);
      const q = parts.join(" AND ");
      // Alert Type dropdown: request only interlock_name from /api/alerts; device filters via search_text, not q
      const alertTypeFields = ["interlock_name"];
      const params: Record<string, string | number> = {
        limit: 500,
        skip: 0,
        fields: JSON.stringify(alertTypeFields),
      };
      if (q) params.q = q;
      if (deviceName) params.search_text = deviceName;
      const response = await apiClient.get("/api/alerts", { params });
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      const seen = new Set<string>();
      const names: string[] = [];
      for (const row of data as any[]) {
        const interlock = String(row?.interlock_name ?? "").trim();
        if (!interlock || seen.has(interlock)) continue;
        seen.add(interlock);
        names.push(interlock);
      }
      names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      setAlertTypeOptions(names.map((name) => ({ label: name, value: name })));
    } catch (error) {
      console.error("Error fetching alert type options:", error);
      setAlertTypeOptions([]);
    } finally {
      setLoadingAlertTypes(false);
    }
  };

  // Build query for AlertsTable (no date range; AlertsTable adds alert_status)
  // Alert Type selection: interlock_name values only
  const buildAlertsQuery = () => {
    const selected = alertTypes.filter((t) => t != null && String(t).trim() !== "");
    if (selected.length === 0) return "";
    const rawZone = Array.isArray(user?.zone)
      ? (user?.zone?.[0] ?? "")
      : (user as any)?.zone ?? "";
    const zone = String(rawZone ?? "").trim();
    const esc = (s: string) => String(s).replace(/'/g, "''");
    const interlockCondition =
      selected.length === 1
        ? `interlock_name='${esc(selected[0])}'`
        : `(${selected.map((name) => `interlock_name='${esc(name)}'`).join(" OR ")})`;
    // Maintenance tab only: filter by alert_category. Default (Faulty) tab: no alert_category in q.
    const maintenanceClause =
      alertsSheetCategoryTab === "Maintenance" ? " AND (alert_category='Maintenance')" : "";
    const dateClause = buildAlertsCreatedAtDateClause(alertsSheetTimeFilter, esc);
    const datePart = dateClause ? ` AND ${dateClause}` : "";
    // Device name is applied via grid search_text (initialSearchText), not in q
    return `bu='TAS' AND alert_section='TAS' AND (zone='${zone}')${maintenanceClause}${datePart} AND ${interlockCondition}`;
  };

  const handleAlertTypesChange = (values: string[]) => {
    setAlertTypes(values);
  };

  const handleAlertsSheetCategoryTabChange = (tab: EquipmentAlertsSheetCategory) => {
    if (tab === alertsSheetCategoryTab) return;
    setAlertsSheetCategoryTab(tab);
    setAlertTypes([]);
    fetchAlertTypeOptions(tab);
  };

  // Reset add alert sheet state on open; fetch interlock names for dropdown
  const handleOpenAddAlertSheet = () => {
    setAlertsSheetCategoryTab("Faulty");
    setAlertTypes([]);
    setAlertsSheetTimeFilter("1M");
    setShowAddAlertSheet(true);
  };

  // Refetch alert-type options when the sheet is open and the time range changes.
  useEffect(() => {
    if (!showAddAlertSheet) return;
    void fetchAlertTypeOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch uses latest tab/time from state
  }, [showAddAlertSheet, alertsSheetTimeFilter]);

  const removeLinkedAlert = (rowKey: string) => {
    setSelectedAlertRows((prev) =>
      prev.filter((r: any) => {
        const k = String(r?.unique_id ?? r?.alert_id ?? r?.id ?? "");
        return k !== rowKey;
      })
    );
  };

  const formatLinkedAlertDate = (v: unknown) => {
    if (v == null || v === "") return "—";
    const s = formatDateTimeIst(v, "");
    return s === "" ? String(v) : s;
  };

  // Fetch dropdown data & default SAP/Zone based on logged-in user
  const fetchDropdownData = async () => {
    setDropdownLoading(true);
    try {
      // 1) Get user info (zone, sap_id) from auth state (no extra API call)
      // Session can return these as arrays (e.g. [] or ["NCZ"]), so normalise:
      const rawZone = Array.isArray(user?.zone)
        ? (user?.zone?.[0] ?? '')
        : (user as any)?.zone ?? '';
      const rawSapId = Array.isArray(user?.sap_id)
        ? (user?.sap_id?.[0] ?? '')
        : (user as any)?.sap_id ?? '';

      const userZone = String(rawZone ?? '').trim();
      const userSapId = String(rawSapId ?? '').trim();

      // 2) Call ticketing location API with TAS BU, passing zone & sap_id from session
      const payload = {
        bu: ['TAS'],
        zone: [userZone || ''],
        region: [''],
        sales_area: [''],
        sap_id: [userSapId || ''],
      };

      console.log('Fetching dropdown data with /api/ticketing/get_location_data payload:', payload);

      const response = await apiClient.post(
        '/api/ticketing/get_location_data',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const data = response.data;
      console.log('Dropdown API Response (/api/ticketing/get_location_data):', data);

      if (!data || data.status !== true) {
        throw new Error(data?.message || 'Failed to fetch locations');
      }

      const d = data.data ?? {};

      // Normalize zones (adapted from Ticketing2 useLocations)
      const zonesArr: any[] = Array.isArray(d.zones)
        ? d.zones
        : Array.isArray(d.zone)
          ? d.zone
          : Array.isArray(d.zoneData)
            ? d.zoneData
            : [];

      const zonesNormalized: any[] = zonesArr
        .map((z: any) => {
          if (z && typeof z === 'object') {
            const id = String((z as any).id ?? (z as any).zone ?? (z as any).name ?? '').trim();
            const name = String((z as any).name ?? (z as any).zone ?? id).trim();
            return id ? { id, name } : null;
          }
          const s = String(z ?? '').trim();
          return s ? { id: s, name: s } : null;
        })
        .filter(Boolean) as any[];

      // Normalize SAP IDs / locations (adapted from Ticketing2 useLocations)
      const locationSapArr: any[] = Array.isArray(d.location_sap_id) ? d.location_sap_id : [];
      const sapIdsArr: any[] = Array.isArray(d.sap_ids) ? d.sap_ids : [];
      const namesArr: any[] = Array.isArray(d.names) ? d.names : [];
      const locationsArr: any[] = Array.isArray(d.locations) ? d.locations : [];

      let plantsNormalized: any[] = [];

      if (locationsArr.length > 0) {
        plantsNormalized = locationsArr
          .map((loc: any) => {
            const sapId = String(loc?.sap_id ?? loc?.id ?? '').trim();
            const name = String(loc?.name ?? loc?.location_name ?? '').trim();
            if (!sapId && !name) return null;
            return {
              id: sapId || name,
              name: name || sapId,
              label: name,
              location_name: name,
            };
          })
          .filter(Boolean) as any[];
      } else if (locationSapArr.length > 0) {
        plantsNormalized = locationSapArr
          .map((entry: any) => {
            const s = String(entry ?? '').trim();
            if (!s) return null;

            let sapId = '';
            let locationName = s;
            const sepIdx = s.lastIndexOf(' - ');
            if (sepIdx >= 0) {
              locationName = s.slice(0, sepIdx).trim();
              sapId = s.slice(sepIdx + 3).trim();
            } else {
              const m = s.match(/(\d+)\s*$/);
              sapId = m?.[1] ?? '';
              if (sapId) locationName = s.replace(new RegExp(`\\s*${sapId}\\s*$`), '').trim();
            }

            const id = sapId || s;
            const name = locationName || s;

            return {
              id,
              name,
              label: s,
              location_name: name,
            };
          })
          .filter(Boolean) as any[];
      } else if (sapIdsArr.length > 0) {
        plantsNormalized = sapIdsArr
          .map((sap: any, idx: number) => {
            const id = String(sap ?? '').trim();
            if (!id) return null;
            const nm = String(namesArr[idx] ?? '').trim();
            const name = nm || id;
            return {
              id,
              name,
              label: name,
              location_name: name,
            };
          })
          .filter(Boolean) as any[];
      } else if (Array.isArray(d.plant)) {
        plantsNormalized = d.plant as any[];
      } else if (Array.isArray(d.plants)) {
        plantsNormalized = d.plants as any[];
      }

      setDropdownData({
        zones: zonesNormalized,
        sapIds: plantsNormalized,
      });

      // Autofill SAP ID, Zone, and Location Name fields from session / location data (if present).
      // If both sap_id and zone are empty in session, keep these fields empty.
      if (userZone || userSapId) {
        const defaultZoneId =
          (zonesNormalized.find((z: any) => String(z.id) === String(userZone)) ??
            zonesNormalized.find((z: any) => String(z.name) === String(userZone)))?.id ||
          userZone ||
          "";

        const defaultSap = userSapId
          ? (plantsNormalized.find((p: any) => String(p.id) === String(userSapId)) ??
            plantsNormalized.find((p: any) => String(p.name) === String(userSapId)))
          : undefined;

        const defaultSapId = defaultSap?.id || userSapId || "";
        const defaultLocationName = defaultSap?.location_name || defaultSap?.name || "";

        setFilterFormData((prev) => ({
          ...prev,
          zone: defaultZoneId || prev.zone,
          sap_id: defaultSapId || prev.sap_id,
          location_name: defaultLocationName || prev.location_name,
        }));

        console.log('Processed dropdown data from ticketing API:', {
          zones: zonesNormalized,
          sapIds: plantsNormalized,
          defaultZoneId,
          defaultSapId,
          defaultLocationName,
        });
      } else {
        console.log('User session has empty sap_id and zone – leaving form fields blank.');
      }
    } catch (error) {
      console.error('Error fetching dropdown data from ticketing API:', error);
      toast.error('Failed to load dropdown data');
    } finally {
      setDropdownLoading(false);
    }
  };


  // Fetch all equipment health check data with parameters like CreateDevice.tsx
  /** Pass `runId` from the list `useEffect` so overlapping requests ignore stale results; omit for manual calls (e.g. after submit). */
  const fetchAllEquipmentData = async (page = currentPage, limit = itemsPerPage, runId?: number) => {
    console.log('fetchAllEquipmentData called with page:', page, 'limit:', limit);
    setLoadingAllData(true);
    try {
      const scopeSapIds = normalizeSessionScopeFieldList(user?.sap_id);
      const scopeZones = normalizeSessionScopeFieldList(user?.zone);

      /** Session scope only — drill filtering is handled client-side by drillFilteredEquipmentData.
       *  Sending drill state to the server caused 500 errors when multiple cards were drilled. */
      const q = buildTasFaultyListQueryString(scopeSapIds, scopeZones);
      const tasFaultyParams: Record<string, string | number> = {
        skip: page,
        limit,
        sort: JSON.stringify({ created_at: "desc" }),
      };
      if (q) tasFaultyParams.q = q;
      const response = await apiClient.get("/api/tasfaulty", { params: tasFaultyParams });
      if (runId !== undefined && runId !== equipmentListFetchRunIdRef.current) return;
      console.log('All Equipment Data:', response.data);

      // Handle different response structures like CreateDevice.tsx
      const rows = response.data?.data;
      const total = response.data?.total || response.data?.count || rows?.length || 0;

      if (response.data && response.data.data) {
        setAllEquipmentData(Array.isArray(response.data.data) ? response.data.data : []);
      } else if (Array.isArray(response.data)) {
        setAllEquipmentData(response.data);
      } else {
        setAllEquipmentData([]);
      }

      const parsedTotal = typeof total === "number" ? total : 0;
      setTotalItems(parsedTotal);
      // Only update unfilteredTotal when no drill is active — this prevents the chart
      // aggregate from re-fetching filtered data when a card is drilled.
      const isDrilled = !!(vendorDonutDrillVendor || vendorDonutDrillLocation || vendorDonutDrillZone);
      if (!isDrilled) setUnfilteredTotal(parsedTotal);
    } catch (error) {
      if (runId !== undefined && runId !== equipmentListFetchRunIdRef.current) return;
      console.error('Error fetching all equipment data:', error);
      toast.error('Failed to load equipment data');
      setAllEquipmentData([]);
      setTotalItems(0);
      // Do NOT reset unfilteredTotal or equipmentChartAggregateData here — a table
      // fetch error must not blank the KPI charts which use a separate fetch.
    } finally {
      if (runId === undefined || runId === equipmentListFetchRunIdRef.current) {
        setLoadingAllData(false);
      }
    }
  };

  useEffect(() => {
    fetchDropdownData();
  }, []);

  /** Single load path: mount + pagination + refresh. Deferred one tick so React dev Strict Mode does not start a request that is immediately torn down (duplicate GET + cancel). */
  useEffect(() => {
    const runId = ++equipmentListFetchRunIdRef.current;
    const timer = window.setTimeout(() => {
      void fetchAllEquipmentData(currentPage, itemsPerPage, runId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    currentPage,
    itemsPerPage,
    refreshCounter,
    user,
    // Drill state intentionally excluded — list query is session-scoped only;
    // drill filtering is applied client-side by drillFilteredEquipmentData.
  ]);

  /**
   * Load rows for KPI charts — session-scoped only, NO drill state in query or deps.
   *
   * Uses `unfilteredTotal` (not `totalItems`) as the dep/cap — `unfilteredTotal` is only
   * updated when no drill is active, so drilling a card never re-triggers this fetch.
   */
  useEffect(() => {
    if (unfilteredTotal <= 0) {
      setEquipmentChartAggregateData([]);
      setLoadingChartAggregate(false);
      return;
    }
    const runId = ++chartAggregateFetchRunIdRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoadingChartAggregate(true);
        try {
          const scopeSapIds = normalizeSessionScopeFieldList(user?.sap_id);
          const scopeZones = normalizeSessionScopeFieldList(user?.zone);
          const q = buildTasFaultyListQueryString(scopeSapIds, scopeZones);
          const cap = Math.min(unfilteredTotal, CHART_AGGREGATE_MAX_ROWS);
          const tasFaultyParams: Record<string, string | number> = {
            skip: 0,
            limit: cap,
            sort: JSON.stringify({ created_at: "desc" }),
          };
          if (q) tasFaultyParams.q = q;
          console.log('[ChartAggregate] fetching, cap=', cap, '— no drill filters');
          const response = await apiClient.get("/api/tasfaulty", { params: tasFaultyParams });
          if (runId !== chartAggregateFetchRunIdRef.current) return;

          let rows: unknown[] = [];
          if (response.data?.data) {
            rows = Array.isArray(response.data.data) ? response.data.data : [];
          } else if (Array.isArray(response.data)) {
            rows = response.data;
          }
          console.log('[ChartAggregate] received', rows.length, 'rows — all cards will use this');
          setEquipmentChartAggregateData(rows);
        } catch (err) {
          if (runId !== chartAggregateFetchRunIdRef.current) return;
          console.error("EquipmentHealthCheck: chart aggregate fetch failed", err);
          setEquipmentChartAggregateData([]);
        } finally {
          if (runId === chartAggregateFetchRunIdRef.current) {
            setLoadingChartAggregate(false);
          }
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    unfilteredTotal,   // only changes when no drill active → never contaminates charts
    refreshCounter,
    user,
  ]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAvgClosingCards(true);
      try {
        const payload = {
          analytical_model: "tas_faulty_resolution_avg_time",
          location_name: "",
          interlock_name: "",
          alert_status: "",
          alert_severity: [""],
          zone: "",
          start_date: "",
          end_date: "",
          equipment_type: "",
          equipment_name: "",
          download: "",
          truck_number: "",
          filters: [{ key: "vendor_name", cond: "=", value: "" }],
          interlock_category: "",
        };
        const response = await apiClient.post("/api/tasanalytics/tas_analytics", payload);
        if (cancelled) return;
        setAvgClosingCardsData(parseAvgClosingCardsFromAnalyticsResponse(response?.data));
      } catch (err) {
        if (cancelled) return;
        console.error("EquipmentHealthCheck: avg closing analytics fetch failed", err);
        setAvgClosingCardsData(EMPTY_AVG_CLOSING_CARDS);
      } finally {
        if (!cancelled) setLoadingAvgClosingCards(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCounter, user?.sap_id, user?.zone]);

  /** When the raise-request form opens, load vendor rows for the current SAP ID (multi-select if count > 1) */
  useEffect(() => {
    if (!showForm) {
      setVendorMailRows([]);
      setSelectedVendorRowId("");
      return;
    }
    const sapId = String(filterFormData.sap_id ?? "").trim();
    if (!sapId) {
      setVendorMailRows([]);
      setSelectedVendorRowId("");
      setFilterFormData((prev) => ({ ...prev, vendor_name: "" }));
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingVendorMails(true);
      try {
        const escapeQ = (s: string) => s.replace(/'/g, "''");
        const q = `sap_id='${escapeQ(sapId)}'`;
        const vendorMailFields = ["vendor_name"];
        const { data: res } = await apiClient.get("/api/tashelpdeskvendormails", {
          params: {
            q,
            skip: 0,
            limit: 20,
            sort: JSON.stringify({ created_at: "desc" }),
            fields: JSON.stringify(vendorMailFields),
          },
        });
        const body = res as any;
        let rows: any[] = [];
        if (Array.isArray(body)) {
          rows = body;
        } else if (body?.data && Array.isArray(body.data)) {
          rows = body.data;
        } else if (body?.data && typeof body.data === "object" && !Array.isArray(body.data)) {
          rows = [];
        } else if (Array.isArray((body as any)?.rows)) {
          rows = (body as any).rows;
        }

        if (cancelled) return;

        setVendorMailRows(rows);

        const locFromVendor = String(rows[0]?.location_name ?? "").trim();
        if (locFromVendor) {
          setFilterFormData((prev) => {
            if (String(prev.location_name ?? "").trim()) return prev;
            return { ...prev, location_name: locFromVendor };
          });
        }

        const pickVendor = (row: any) =>
          String(row?.vendor_name ?? row?.vendorName ?? "").trim();

        if (rows.length === 1) {
          const vn = pickVendor(rows[0]);
          const rid = rows[0]?.id != null ? String(rows[0].id) : "0";
          setSelectedVendorRowId(rid);
          setFilterFormData((prev) => ({ ...prev, vendor_name: vn }));
        } else if (rows.length > 1) {
          setSelectedVendorRowId("");
          setFilterFormData((prev) => ({ ...prev, vendor_name: "" }));
        } else {
          setSelectedVendorRowId("");
          const vn =
            body && typeof body === "object" && !Array.isArray(body)
              ? pickVendor(body)
              : "";
          setFilterFormData((prev) => ({ ...prev, vendor_name: vn }));
        }
      } catch (err) {
        console.error("EquipmentHealthCheck: /api/tashelpdeskvendormails failed", err);
        if (!cancelled) {
          setVendorMailRows([]);
          setSelectedVendorRowId("");
        }
      } finally {
        if (!cancelled) setLoadingVendorMails(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showForm, filterFormData.sap_id]);

  /** POST /api/tasfaulty/get_info — payload { sap_id, equipment_name } → device ID dropdown options */
  const fetchDeviceIdsForEquipment = useCallback(async (sapId: string, equipmentName: string) => {
    const sap = String(sapId ?? "").trim();
    const eq = String(equipmentName ?? "").trim();
    if (!sap || !eq) {
      setDeviceIdOptions([]);
      setLoadingDeviceIds(false);
      setFilterFormData((prev) => (prev.device_id ? { ...prev, device_id: "" } : prev));
      return;
    }
    setLoadingDeviceIds(true);
    try {
      const { data: body } = await apiClient.post("/api/tasfaulty/get_info", {
        sap_id: sap,
        equipment_name: eq,
      });
      const raw = (body as { data?: unknown })?.data ?? body;
      const list = normalizeDeviceIdList(raw);
      setDeviceIdOptions(list);
      setFilterFormData((prev) => {
        if (list.length === 0) return prev.device_id ? { ...prev, device_id: "" } : prev;
        if (prev.device_id && list.includes(prev.device_id)) return prev;
        return { ...prev, device_id: "" };
      });
    } catch (e) {
      console.error("EquipmentHealthCheck: /api/tasfaulty/get_info failed", e);
      setDeviceIdOptions([]);
      toast.error("Could not load device IDs for this equipment.");
    } finally {
      setLoadingDeviceIds(false);
    }
  }, []);

  /** When SAP + equipment name are set (e.g. after selecting Equipment Name), load device IDs for the dropdown */
  useEffect(() => {
    if (!showForm) {
      setDeviceIdOptions([]);
      setLoadingDeviceIds(false);
      return;
    }
    const sap = String(filterFormData.sap_id ?? "").trim();
    const eq = String(filterFormData.equipment_name ?? "").trim();
    if (!sap || !eq) {
      setDeviceIdOptions([]);
      setLoadingDeviceIds(false);
      setFilterFormData((prev) => (prev.device_id ? { ...prev, device_id: "" } : prev));
      return;
    }
    void fetchDeviceIdsForEquipment(sap, eq);
  }, [showForm, filterFormData.sap_id, filterFormData.equipment_name, fetchDeviceIdsForEquipment]);

  const handleEquipmentTableSortClick = (key: string) => {
    if (equipmentTableSortColumn === key) {
      setEquipmentTableSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setEquipmentTableSortColumn(key);
      setEquipmentTableSortDirection('asc');
    }
  };

  /** Recent table rows: filter by session `sap_id` / `zone` when either is present; otherwise show all. */
  const scopedEquipmentData = useMemo(() => {
    const sapIds = normalizeSessionScopeFieldList(user?.sap_id);
    const zones = normalizeSessionScopeFieldList(user?.zone);
    const hasSap = sapIds.length > 0;
    const hasZone = zones.length > 0;
    if (!hasSap && !hasZone) return allEquipmentData;
    return (allEquipmentData as Record<string, unknown>[]).filter((row) =>
      equipmentRowMatchesSessionScope(row, sapIds, zones)
    );
  }, [allEquipmentData, user]);

  /** Same session scope as the table, applied to chart aggregate rows (full list for KPIs). */
  const scopedEquipmentChartData = useMemo(() => {
    const sapIds = normalizeSessionScopeFieldList(user?.sap_id);
    const zones = normalizeSessionScopeFieldList(user?.zone);
    const hasSap = sapIds.length > 0;
    const hasZone = zones.length > 0;
    if (!hasSap && !hasZone) return equipmentChartAggregateData;
    return (equipmentChartAggregateData as Record<string, unknown>[]).filter((row) =>
      equipmentRowMatchesSessionScope(row, sapIds, zones)
    );
  }, [equipmentChartAggregateData, user]);

  const sortedEquipmentData = useMemo(() => {
    if (!equipmentTableSortColumn) return scopedEquipmentData;
    const copy = [...scopedEquipmentData];
    const col = equipmentTableSortColumn;
    const dir = equipmentTableSortDirection === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      const va = getEquipmentRowSortValue(a as Record<string, unknown>, col);
      const vb = getEquipmentRowSortValue(b as Record<string, unknown>, col);
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va === vb ? 0 : va < vb ? -1 : 1;
      } else {
        cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
      }
      return cmp * dir;
    });
    return copy;
  }, [scopedEquipmentData, equipmentTableSortColumn, equipmentTableSortDirection]);

  const drillFilteredEquipmentData = useMemo(() => {
    let list: typeof sortedEquipmentData = [...sortedEquipmentData];
    if (vendorDonutDrillVendor) {
      list = list.filter((row) => equipmentRowVendorLabel(row as Record<string, unknown>) === vendorDonutDrillVendor);
      if (vendorDonutDrillVendorStatus) {
        list = list.filter((row) => equipmentRowStatusBucket(row as Record<string, unknown>) === vendorDonutDrillVendorStatus);
      }
    }
    if (vendorDonutDrillLocation) {
      list = list.filter((row) => equipmentRowLocationLabel(row as Record<string, unknown>) === vendorDonutDrillLocation);
      if (vendorDonutDrillLocationStatus) {
        list = list.filter((row) => equipmentRowStatusBucket(row as Record<string, unknown>) === vendorDonutDrillLocationStatus);
      }
    }
    if (vendorDonutDrillZone) {
      list = list.filter((row) => equipmentRowZoneLabel(row as Record<string, unknown>) === vendorDonutDrillZone);
      if (vendorDonutDrillZoneStatus) {
        list = list.filter((row) => equipmentRowStatusBucket(row as Record<string, unknown>) === vendorDonutDrillZoneStatus);
      }
    }
    return list;
  }, [
    sortedEquipmentData,
    vendorDonutDrillVendor, vendorDonutDrillVendorStatus,
    vendorDonutDrillLocation, vendorDonutDrillLocationStatus,
    vendorDonutDrillZone, vendorDonutDrillZoneStatus,
  ]);

  /**
   * When a drill is active, filter the FULL chart-aggregate dataset (all rows, not
   * just the current server page) so every matching record is reachable.
   * Null when no drill is active — table falls back to server-paginated data.
   */
  const drillFilteredFullData = useMemo<Record<string, unknown>[] | null>(() => {
    const isDrilled = !!(vendorDonutDrillVendor || vendorDonutDrillLocation || vendorDonutDrillZone);
    if (!isDrilled) return null;
    let list = scopedEquipmentChartData as Record<string, unknown>[];
    if (vendorDonutDrillVendor) {
      list = list.filter((r) => equipmentRowVendorLabel(r) === vendorDonutDrillVendor);
      if (vendorDonutDrillVendorStatus)
        list = list.filter((r) => equipmentRowStatusBucket(r) === vendorDonutDrillVendorStatus);
    }
    if (vendorDonutDrillLocation) {
      list = list.filter((r) => equipmentRowLocationLabel(r) === vendorDonutDrillLocation);
      if (vendorDonutDrillLocationStatus)
        list = list.filter((r) => equipmentRowStatusBucket(r) === vendorDonutDrillLocationStatus);
    }
    if (vendorDonutDrillZone) {
      list = list.filter((r) => equipmentRowZoneLabel(r) === vendorDonutDrillZone);
      if (vendorDonutDrillZoneStatus)
        list = list.filter((r) => equipmentRowStatusBucket(r) === vendorDonutDrillZoneStatus);
    }
    return list;
  }, [
    scopedEquipmentChartData,
    vendorDonutDrillVendor, vendorDonutDrillVendorStatus,
    vendorDonutDrillLocation, vendorDonutDrillLocationStatus,
    vendorDonutDrillZone, vendorDonutDrillZoneStatus,
  ]);

  /** Client-side page slice of drillFilteredFullData when drill is active. */
  const drillPagedTableRows = useMemo(() => {
    if (!drillFilteredFullData) return null;
    const start = currentPage * itemsPerPage;
    return drillFilteredFullData.slice(start, start + itemsPerPage);
  }, [drillFilteredFullData, currentPage, itemsPerPage]);

  /** Total count used by the pagination footer — filtered count when drilling, server total otherwise. */
  const effectiveTotalForPagination = drillFilteredFullData ? drillFilteredFullData.length : totalItems;

  const handleExportToExcel = useCallback(() => {
    // Use the full chart-aggregate dataset (all rows, not just the current page),
    // then apply the same drill filters that the table uses.
    let rows = scopedEquipmentChartData as Record<string, unknown>[];
    if (vendorDonutDrillVendor) {
      rows = rows.filter((r) => equipmentRowVendorLabel(r) === vendorDonutDrillVendor);
      if (vendorDonutDrillVendorStatus)
        rows = rows.filter((r) => equipmentRowStatusBucket(r) === vendorDonutDrillVendorStatus);
    }
    if (vendorDonutDrillLocation) {
      rows = rows.filter((r) => equipmentRowLocationLabel(r) === vendorDonutDrillLocation);
      if (vendorDonutDrillLocationStatus)
        rows = rows.filter((r) => equipmentRowStatusBucket(r) === vendorDonutDrillLocationStatus);
    }
    if (vendorDonutDrillZone) {
      rows = rows.filter((r) => equipmentRowZoneLabel(r) === vendorDonutDrillZone);
      if (vendorDonutDrillZoneStatus)
        rows = rows.filter((r) => equipmentRowStatusBucket(r) === vendorDonutDrillZoneStatus);
    }
    if (!rows.length) { toast.error('No data to export'); return; }

    const exportRows = rows.map((item) => ({
      'SR Request No': String((item as { tas_faulty_unique_id?: unknown }).tas_faulty_unique_id ?? '').trim() || '-',
      'SAP ID': String(item.sap_id ?? '-'),
      'Location Name': String((item as { location_name?: string; name?: string }).location_name ?? (item as { name?: string }).name ?? '-'),
      'Device Type': String(item.device_type ?? '-'),
      'Zone': String(item.zone ?? '-'),
      'Vendor Name': String(item.vendor_name ?? '-'),
      'Equipment Name': String(item.equipment_name ?? '-'),
      'Latest User Remarks': String(item.user_remarks ?? '-'),
      'Latest Vendor Remarks': String(item.vendor_remarks ?? '-'),
      'Faulty Date': formatDateIst((item as { faulty_date?: unknown; faulty?: unknown }).faulty_date ?? item.faulty, '-'),
      'Created At': formatDateTimeIst(item.created_at, '-'),
      'Status': String(item.status ?? '-'),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment Health');
    const filename = `Equipment_Health_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [
    scopedEquipmentChartData,
    vendorDonutDrillVendor, vendorDonutDrillVendorStatus,
    vendorDonutDrillLocation, vendorDonutDrillLocationStatus,
    vendorDonutDrillZone, vendorDonutDrillZoneStatus,
  ]);

  return (
    <div className="bg-gray-100 p-1 space-y-0.5">
      <div className="bg-white p-2 !mt-0 rounded-xl shadow-sm border border-gray-100 mb-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-2xl font-bold text-gray-900">
              Equipment Help Desk Dashboard
            </h1>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {canRaiseVendorRequest && !showForm ? (
                <button
                  type="button"
                  className="whitespace-nowrap text-md font-semibold text-blue-700 transition hover:text-blue-900"
                  onClick={openRaiseRequestToVendor}
                >
                  Raise a request to the vendor →
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setRefreshCounter((prev) => prev + 1);
                }}
                disabled={loadingAllData}
                title="Refresh data"
                aria-label="Refresh data"
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 p-2 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 shrink-0 ${loadingAllData ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Global search..."
              className="pl-10 w-full lg:w-96 bg-white border-gray-300 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
          </div> */}
        </div>
      </div>

      {!showForm && (
        <div className="p-1 !mt-0">
          <EquipmentHealthKpiWidgets
            className="mb-2"
            rows={scopedEquipmentChartData as Record<string, unknown>[]}
            apiTotal={unfilteredTotal}
            avgClosingCards={avgClosingCardsData}
            loading={loadingAllData || loadingChartAggregate || loadingAvgClosingCards}
            chartDrillVendor={vendorDonutDrillVendor}
            chartDrillVendorStatus={vendorDonutDrillVendorStatus}
            chartDrillLocation={vendorDonutDrillLocation}
            chartDrillLocationStatus={vendorDonutDrillLocationStatus}
            chartDrillZone={vendorDonutDrillZone}
            chartDrillZoneStatus={vendorDonutDrillZoneStatus}
            onChartDrillVendor={handleChartDrillVendor}
            onChartDrillVendorStatus={handleChartDrillVendorStatus}
            onChartDrillLocation={handleChartDrillLocation}
            onChartDrillLocationStatus={handleChartDrillLocationStatus}
            onChartDrillZone={handleChartDrillZone}
            onChartDrillZoneStatus={handleChartDrillZoneStatus}
          />

          <div className="space-y-3 rounded-xl bg-white p-1">
            {(vendorDonutDrillVendor || vendorDonutDrillLocation || vendorDonutDrillZone) ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/90 px-3 py-2 text-xs text-gray-800">
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {vendorDonutDrillVendor ? (
                    <span>
                      Vendor: <strong>{vendorDonutDrillVendor}</strong>
                      {vendorDonutDrillVendorStatus ? <> · Status: <strong>{vendorDonutDrillVendorStatus}</strong></> : null}
                    </span>
                  ) : null}
                  {vendorDonutDrillLocation ? (
                    <span>
                      Location: <strong>{vendorDonutDrillLocation}</strong>
                      {vendorDonutDrillLocationStatus ? <> · Status: <strong>{vendorDonutDrillLocationStatus}</strong></> : null}
                    </span>
                  ) : null}
                  {vendorDonutDrillZone ? (
                    <span>
                      Zone: <strong>{vendorDonutDrillZone}</strong>
                      {vendorDonutDrillZoneStatus ? <> · Status: <strong>{vendorDonutDrillZoneStatus}</strong></> : null}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="shrink-0 font-semibold text-blue-700 hover:text-blue-900"
                  onClick={() => {
                    setCurrentPage(0);
                    setVendorDonutDrillVendor(null); setVendorDonutDrillVendorStatus(null);
                    setVendorDonutDrillLocation(null); setVendorDonutDrillLocationStatus(null);
                    setVendorDonutDrillZone(null); setVendorDonutDrillZoneStatus(null);
                  }}
                >
                  Clear chart filter
                </button>
              </div>
            ) : null}
            {/* Heading + Table in one card */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-0">
                <h2 className="text-sm font-bold mt-1 mb-1 text-gray-700">Equipment Help Desk Detailed Records</h2>
                <button
                  type="button"
                  onClick={handleExportToExcel}
                  disabled={loadingAllData || drillFilteredEquipmentData.length === 0}
                  title="Download table as Excel"
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 p-1 text-white shadow-md transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
              <hr className="w-full border-0 border-t border-gray-200/90" />
              {/* native scrollbar hidden; custom track below is always visible */}
              <div
                ref={eqScrollInnerRef}
                onScroll={updateEqHScroll}
                className="eq-table-inner w-full min-w-0 max-h-[500px] overflow-x-auto overflow-y-auto relative"
                style={{ scrollbarWidth: 'none' } as React.CSSProperties}
              >
                <table className="w-max min-w-full divide-y divide-gray-200 relative">
                  <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-500 to-indigo-500">
                    <tr>
                      {[
                        { key: 'tas_faulty_unique_id', label: 'SR Request No' },
                        { key: 'sap_id', label: 'SAP ID' },
                        { key: 'name', label: 'Location Name' },
                        { key: 'device_type', label: 'Device Type' },
                        { key: 'zone', label: 'Zone' },
                        { key: 'vendor_name', label: 'Vendor Name' },
                        { key: 'equipment_name', label: 'Equipment Name' },
                        { key: 'user_remarks', label: 'Latest user remarks' },
                        { key: 'vendor_remarks', label: 'Latest vendor remarks' },
                        { key: 'certificate', label: 'Certificate' },
                        { key: 'faulty', label: 'Faulty Date' },
                        { key: 'created_at', label: 'Created At' },
                        { key: 'status', label: 'Status' },
                        { key: 'faulty_history', label: 'History' },
                        { key: 'action', label: 'Action', fixed: true },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`relative text-left px-1 py-2 text-xs font-bold uppercase tracking-wider text-white border-r border-white/20 ${col.fixed ? 'sticky right-0 bg-gradient-to-r from-blue-500 to-indigo-500 z-20' : ''
                            }`}
                          style={{
                            width:
                              col.key === 'action' ? '80px' : col.key === 'faulty_history' ? '72px' : '130px',
                            minWidth: col.key === 'action' ? '80px' : col.key === 'faulty_history' ? '64px' : '80px',
                            maxWidth: 'none'
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block cursor-pointer font-semibold"
                              title={col.label}
                              style={{ whiteSpace: 'normal' }}
                            >
                              {col.label}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loadingAllData ? (
                      <tr>
                        <td
                          colSpan={15}
                          className="text-center py-6 text-gray-500 font-medium"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-xs">Loading equipment data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (drillPagedTableRows ? drillPagedTableRows.length > 0 : allEquipmentData.length > 0 && scopedEquipmentData.length > 0) ? (
                      (() => {
                        const tableRows = drillPagedTableRows ?? drillFilteredEquipmentData;
                        return tableRows.length > 0 ? tableRows.map((item, index) => (
                        <tr key={(item as { tas_faulty_unique_id?: unknown }).tas_faulty_unique_id ?? item.id ?? index} className="hover:bg-blue-50">
                          <td className="px-1 py-1 text-xs whitespace-nowrap text-gray-700 border-b">
                            {String((item as { tas_faulty_unique_id?: unknown }).tas_faulty_unique_id ?? "").trim() || "-"}
                          </td>
                          <td className="px-1 py-1 text-xs whitespace-nowrap text-gray-700 border-b">{item.sap_id || '-'}</td>
                          <td className="px-1 py-1 text-xs whitespace-nowrap text-gray-700 border-b">
                            {(item as { location_name?: string; name?: string }).location_name || (item as { name?: string }).name || '-'}
                          </td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b whitespace-nowrap">{item.device_type || '-'}</td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b whitespace-nowrap">{item.zone || '-'}</td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b whitespace-nowrap">{item.vendor_name || '-'}</td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b whitespace-nowrap">{item.equipment_name || '-'}</td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b whitespace-nowrap">{item.user_remarks || '-'}</td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b whitespace-nowrap">{item.vendor_remarks || '-'}</td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b whitespace-nowrap">
                            {(() => {
                              const filePath = item.certificate || item.certificate_file || item.certificate_path;
                              if (!filePath) return '-';

                              const filename = filePath.split('/').pop() || filePath.split('\\').pop() || 'Download';

                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleCertificateDownload(item)}
                                        disabled={downloadingFileId === item.id}
                                        className={`text-blue-600 hover:text-blue-800 underline flex items-center gap-1 ${downloadingFileId === item.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                          }`}
                                      >
                                        {downloadingFileId === item.id ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Downloading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Download className="h-3 w-3" />
                                            <span>{filename}</span>
                                          </>
                                        )}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Download Certificate</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </td>
                          <td className="px-1  py-1 text-xs text-gray-700 border-b">
                            {(() => {
                              const raw =
                                (item as { faulty_date?: string; faulty?: string }).faulty_date ??
                                (item as { faulty?: string }).faulty;
                              if (!raw) return '-';
                              return formatDateIst(raw, '-');
                            })()}
                          </td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b whitespace-nowrap">
                            {item.created_at
                              ? formatDateTimeIst(item.created_at, '-')
                              : '-'}
                          </td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b">
                            {item.status ? (
                              <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${item.status.toLowerCase() === 'open'
                                ? 'bg-green-100 text-green-800'
                                : item.status.toLowerCase() === 'closed'
                                  ? 'bg-red-100 text-red-800'
                                  : (item.status.toLowerCase() === 'rejected' || item.status.toLowerCase() === 'rejection')
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                {displayStatusLabel(item.status)}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b text-center">
                            <Button
                              type="button"
                              onClick={() => {
                                setHistoryDialogItem(item as Record<string, unknown>);
                                setHistoryDialogOpen(true);
                              }}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                              title="View history"
                              aria-label="View faulty request history"
                            >
                              <MoreHorizontal className="h-4 w-4 text-gray-500" />
                            </Button>
                          </td>
                          <td className="px-1 py-1 text-xs text-gray-700 border-b sticky right-0 bg-white">
                            {canUserSeeEquipmentHelpDeskAction(user, item) ? (
                              <Button
                                onClick={() => handleActionClick(item)}
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                              >
                                <MoreVertical className="h-4 w-4 text-gray-500" />
                              </Button>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      )) : (
                          <tr>
                            <td colSpan={15} className="text-center py-6 text-xs text-gray-600 bg-gray-50/80">
                              No rows match the chart selection.
                            </td>
                          </tr>
                        );
                      })()
                    ) : allEquipmentData.length > 0 && scopedEquipmentData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={15}
                          className="text-center py-6 text-amber-800 text-xs bg-amber-50/80"
                        >
                           No service requests found. 
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td
                          colSpan={15}
                          className="text-center py-6 text-blue-600 text-xs"
                        >
                          No service requests found. 
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Always-visible custom horizontal scrollbar track */}
              {(() => {
                const { scrollLeft, scrollWidth, clientWidth, trackWidth } = eqHScrollMetrics;
                const tw = Math.max(trackWidth || 1, 1);
                const sw = Math.max(scrollWidth, 1);
                const maxScroll = Math.max(0, scrollWidth - clientWidth);
                const thumbW = maxScroll <= 0 ? tw : Math.max(40, (clientWidth / sw) * tw);
                const thumbLeft = maxScroll <= 0 ? 0 : (scrollLeft / maxScroll) * Math.max(1, tw - thumbW);
                return (
                  <div
                    ref={eqHTrackRef}
                    className="relative h-3 w-full shrink-0 cursor-pointer select-none bg-white border-t border-gray-100"
                    onClick={handleEqTrackClick}
                    role="presentation"
                  >
                    <div
                      data-thumb="true"
                      className="pointer-events-auto absolute top-0.5 bottom-0.5 rounded-full bg-slate-400 hover:bg-slate-600 transition-colors"
                      style={{ width: `${thumbW}px`, left: `${thumbLeft}px`, minWidth: 40 }}
                      onMouseDown={handleEqThumbMouseDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                );
              })()}

              {/* Pagination footer like CreateDevice.tsx */}
              <div className="!mt-0 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 border-t border-gray-300 rounded-b-xl flex items-center justify-between mt-4 shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-700">Show</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      className="px-2 py-1 text-xs border-2 border-gray-300 rounded-lg bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors font-medium"
                    >
                      {[5, 10, 25, 50, 100].map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs font-medium text-gray-700">entries</span>
                  </div>
                  <div className="text-xs font-medium text-gray-700 bg-white px-2 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                    Showing{" "}
                    <span className="font-bold text-gray-900">{effectiveTotalForPagination > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{" "}
                    <span className="font-bold text-gray-900">{Math.min((currentPage + 1) * itemsPerPage, effectiveTotalForPagination)}</span> of{" "}
                    <span className="font-bold text-gray-900">{effectiveTotalForPagination}</span> entries
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, Math.ceil(effectiveTotalForPagination / itemsPerPage)) }, (_, i) => {
                      let pageNum: number;
                      const totalPages = Math.ceil(effectiveTotalForPagination / itemsPerPage);

                      if (totalPages <= 5) {
                        pageNum = i;
                      } else if (currentPage <= 2) {
                        pageNum = i;
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 5 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${currentPage === pageNum
                            ? "bg-blue-500 text-white"
                            : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400"
                            }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(effectiveTotalForPagination / itemsPerPage) - 1}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && canRaiseVendorRequest && (
        <EquipmentRaiseRequestForm
          filterFormData={filterFormData}
          setFilterFormData={setFilterFormData}
          handleInputChange={handleInputChange}
          areaOptions={areaOptions}
          equipmentOptions={equipmentOptions}
          vendorMailRows={vendorMailRows}
          loadingVendorMails={loadingVendorMails}
          selectedVendorRowId={selectedVendorRowId}
          setSelectedVendorRowId={setSelectedVendorRowId}
          deviceIdOptions={deviceIdOptions}
          loadingDeviceIds={loadingDeviceIds}
          handleOpenAddAlertSheet={handleOpenAddAlertSheet}
          selectedAlertRows={selectedAlertRows}
          setSelectedAlertRows={setSelectedAlertRows}
          imagePreview={imagePreview}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          handleRemoveImage={handleRemoveImage}
          handleSearchEquipment={handleSearchEquipment}
          isFormValid={isFormValid}
          setShowForm={setShowForm}
          formatDateTimeIst={formatDateTimeIst}
        />
      )}

      {/* Add Alert Sheet */}
      <AlertSheetDetail
        open={showAddAlertSheet}
        onOpenChange={setShowAddAlertSheet}
        alertCategoryTab={alertsSheetCategoryTab}
        onAlertCategoryTabChange={handleAlertsSheetCategoryTabChange}
        alertsTimeFilter={alertsSheetTimeFilter}
        onAlertsTimeFilterChange={setAlertsSheetTimeFilter}
        alertTypes={alertTypes}
        onAlertTypesChange={handleAlertTypesChange}
        alertTypeOptions={alertTypeOptions}
        loadingAlertTypes={loadingAlertTypes}
        alertsQuery={buildAlertsQuery()}
        initialAlertsSearchText={stripDeviceNameLocationSuffix(String(filterFormData.device_id ?? ""))}
        onClose={() => setShowAddAlertSheet(false)}
        onSelectionChange={setSelectedAlertRows}
      />

      {/* Faulty request history dialog */}
      <EquipmentHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        historyDialogItem={historyDialogItem}
        setHistoryDialogItem={setHistoryDialogItem}
        normalizeFaultyHistory={normalizeFaultyHistory}
        sortFaultyHistoryEntriesNewestFirst={sortFaultyHistoryEntriesNewestFirst}
        formatFaultyHistoryDateTime={formatFaultyHistoryDateTime}
        faultyHistoryStatusPillClass={faultyHistoryStatusPillClass}
        displayStatusLabel={displayStatusLabel}
      />

      {/* Action dialog */}
      <EquipmentActionDialog
        open={showActionDialog}
        onOpenChange={setShowActionDialog}
        selectedItem={selectedItem}
        userIsTasVendor={userIsTasVendor}
        helpDeskPositiveUiLabel={helpDeskPositiveUiLabel}
        actionType={actionType}
        setActionType={setActionType}
        justification={justification}
        setJustification={setJustification}
        handleDialogSubmit={handleDialogSubmit}
      />
      <TASGpt/>
    </div>
  );
};

export default EquipmentHealthCheck;