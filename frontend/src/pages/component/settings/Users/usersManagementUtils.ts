import { apiClient } from "@/services/apiClient";
import { config } from "@/configs/excrypt.config";
import { encryptPayload } from "@/configs/encryptFernet";
import {
  BU_ALL_LABEL,
  BU_OPTIONS,
  USERS_LIST_FIELDS,
} from "./usersManagementConstants";

export function normalizeBuCode(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") return raw.trim().toUpperCase();
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.name === "string") return o.name.trim().toUpperCase();
    if (typeof o.bu === "string") return o.bu.trim().toUpperCase();
    if (typeof o.code === "string") return o.code.trim().toUpperCase();
  }
  return String(raw).trim().toUpperCase();
}

/** Parse PG / Python-style serialized array strings, e.g. "['A', 'B']". */
function tryParseSerializedStringArray(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
  } catch {
    // fall through
  }

  try {
    const jsonLike = trimmed.replace(/'/g, '"');
    const parsed = JSON.parse(jsonLike);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
  } catch {
    // fall through
  }

  const matches = [...trimmed.matchAll(/['"]([^'"]+)['"]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return matches.length > 0 ? matches : null;
}

/** Flatten `get_distinct_values` payloads (incl. PG array columns) to string option labels. */
export function normalizeDistinctStringOptions(raw: unknown): string[] {
  if (raw == null) return [];
  const out: string[] = [];

  const push = (value: unknown): void => {
    if (value == null || value === "") return;
    if (typeof value === "string") {
      const serialized = tryParseSerializedStringArray(value);
      if (serialized) {
        serialized.forEach(push);
        return;
      }
      const s = value.trim();
      if (s) out.push(s);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      push(o.name ?? o.system_role ?? o.value ?? o.label);
      return;
    }
    const s = String(value).trim();
    if (s && s !== "[object Object]") out.push(s);
  };

  const items = Array.isArray(raw) ? raw : [raw];
  items.forEach(push);
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

/** Session BU → toolbar option list + initial selection (explicit `[]` = full catalog, default TAS). */
export function parseSessionBuList(userBu: unknown): {
  allowedToolbarBus: string[];
  defaultSelected: string[];
} {
  const allCatalog = [...BU_OPTIONS] as string[];
  if (Array.isArray(userBu) && userBu.length === 0) {
    return {
      allowedToolbarBus: allCatalog,
      defaultSelected: ["TAS"],
    };
  }
  const list = Array.isArray(userBu) ? userBu : userBu != null ? [userBu] : [];
  const codes = list.map(normalizeBuCode).filter(Boolean);
  const allowed = new Set(BU_OPTIONS as readonly string[]);
  const matched = [...new Set(codes.filter((c) => allowed.has(c)))].sort();
  if (matched.length > 0) {
    return {
      allowedToolbarBus: matched,
      defaultSelected: [...matched],
    };
  }
  return {
    allowedToolbarBus: allCatalog,
    defaultSelected: ["TAS"],
  };
}

/** Builds `bu IN (...)` for the users API. Empty string = no BU filter (all BUs). */
export function formatBuInQuery(codes: readonly string[]): string {
  const uniq = [...new Set(codes.filter(Boolean))].sort();
  if (uniq.length === 0) {
    return "";
  }
  const parts = uniq.map((c) => {
    const inner = String(c).trim().replace(/'/g, "''");
    return `'{${inner}}'`;
  });
  return `bu IN (${parts.join(",")})`;
}

/** Map toolbar selection (incl. “All”) to BU codes for the API (`[]` = no BU filter). Scoped to `allowedBus`. */
export function normalizeToolbarBuSelection(
  raw: string[],
  allowedBus: readonly string[]
): string[] {
  const hasAll = raw.includes(BU_ALL_LABEL);
  const real = allowedBus.filter((b) => raw.includes(b));
  if (allowedBus.length > 0 && real.length === allowedBus.length) {
    return [];
  }
  if (hasAll && real.length < allowedBus.length) {
    const missingCount = allowedBus.length - real.length;
    if (missingCount >= 2) {
      return [];
    }
  }
  return [...new Set(real)].sort();
}

export function isManualUserTruthy(v: unknown): boolean {
  return v === true || v === 1 || String(v).toLowerCase() === "true";
}

/** User row is “active” if `status` / `enable` is true, 1, or the string `active` (case-insensitive). */
export function isUserStatusActive(data: any): boolean {
  const statusRaw = data?.status ?? data?.enable;
  return (
    statusRaw === true ||
    statusRaw === 1 ||
    String(statusRaw).toLowerCase() === "active"
  );
}

export function usersStatusFilterValue(data: any): string {
  return isUserStatusActive(data) ? "Active" : "Inactive";
}

export function isAdUserTruthy(v: unknown): boolean {
  return v === true || v === 1 || String(v).toLowerCase() === "true";
}

export function usersAdUserFilterValue(data: any): string {
  return isAdUserTruthy(data?.is_ad_user) ? "Yes" : "No";
}

/** Display value for ag-grid checkbox filter (yes / no only). */
export function usersManualUserFilterValue(data: any): string {
  return isManualUserTruthy(data?.manual_user) ? "yes" : "no";
}

export function extractCompleteJSON(
  text: string
): { parsed: unknown[]; remaining: string } {
  const results: unknown[] = [];
  let remaining = text;
  let startIndex = 0;

  while (startIndex < remaining.length) {
    while (
      startIndex < remaining.length &&
      /\s/.test(remaining[startIndex])
    ) {
      startIndex++;
    }
    if (startIndex >= remaining.length) break;

    const char = remaining[startIndex];
    if (char !== "{" && char !== "[") {
      startIndex++;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let endIndex = startIndex;

    for (let i = startIndex; i < remaining.length; i++) {
      const c = remaining[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (c === "\\") {
        escapeNext = true;
        continue;
      }

      if (c === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (c === "{" || c === "[") {
          depth++;
        } else if (c === "}" || c === "]") {
          depth--;
          if (depth === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
    }

    if (depth === 0 && endIndex > startIndex) {
      try {
        const jsonStr = remaining.substring(startIndex, endIndex).trim();
        if (jsonStr) {
          results.push(JSON.parse(jsonStr));
        }
        remaining = remaining.substring(endIndex);
        startIndex = 0;
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  return { parsed: results, remaining };
}

export function rowsFromStreamPayload(item: unknown): any[] {
  if (Array.isArray(item)) return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as any[];
    if (Array.isArray(o.payload)) return o.payload as any[];
    if (Array.isArray(o.result)) return o.result as any[];
    if (Array.isArray(o.rows)) return o.rows as any[];
    if (Array.isArray(o.users)) return o.users as any[];
    return [item as any];
  }
  return [];
}

export function buildUsersListQueryParams(
  searchTextTrimmed: string,
  buCodes: string[]
): Record<string, string> {
  const p: Record<string, string> = {
    fields: JSON.stringify([...USERS_LIST_FIELDS]),
    limit: "0",
  };
  const parts: string[] = [];
  const buQ = formatBuInQuery(buCodes);
  if (buQ) {
    parts.push(buQ);
  }
  // If RO is selected, add condition that novex_role != '{RO Dealer}'
  if (buCodes.includes("RO")) {
    parts.push("novex_role != '{RO Dealer}'");
  }
  if (parts.length > 0) {
    p.q = parts.join(" AND ");
  }
  if (searchTextTrimmed) p.search_text = searchTextTrimmed;
  return p;
}

export function buildUsersListUrl(
  searchTextTrimmed: string,
  buCodes: string[]
): string {
  const base = (apiClient.defaults.baseURL || "").replace(/\/$/, "");
  const params = buildUsersListQueryParams(searchTextTrimmed, buCodes);
  const query = config.encryption.enabled
    ? encryptPayload(params)
    : JSON.stringify(params);
  return `${base}/api/users?${query}`;
}

export function mergeCommonHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const common = apiClient.defaults.headers?.common;
  if (common && typeof common === "object") {
    Object.entries(common).forEach(([k, v]) => {
      if (typeof v === "string" && v) headers[k] = v;
    });
  }
  return headers;
}

/** Values shown in the ag-grid checkbox column filter (Users table). */
export function usersNameFilterValue(data: any): string {
  const first = data?.first_name || "";
  const last = data?.last_name || "";
  return `${first} ${last}`.trim();
}

export function usersArrayFieldFilterValue(field: string) {
  return (data: any): string => {
    const v = data?.[field];
    if (Array.isArray(v)) {
      return v
        .filter((item: any) => item && String(item).trim() !== "")
        .sort()
        .join(", ");
    }
    return v ?? "";
  };
}

export function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function formatUserArrays(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((x) => x != null && String(x).trim() !== "").join("; ");
  }
  return value == null ? "" : String(value);
}

export function sapIdsFromCommaInput(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
