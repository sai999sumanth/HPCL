export const UPLOAD_CONNECTION_API =
  "/api/naturalgasgvconnections/upload_connection_data";
export const CONFIRM_SYNC_API = "/api/naturalgasgvconnections/confirm_data_sync";

/** Paginated list: summary aggregates. */
export const NATURAL_GAS_SUMMARY_LIST_API = "/api/naturalgasconnectionssummary";
/** Paginated list: all connection rows. */
export const NATURAL_GAS_CONNECTIONS_LIST_API = "/api/naturalgasgvconnections";

export const NATURAL_GAS_LIST_DEFAULT_SKIP = 0;
export const NATURAL_GAS_LIST_DEFAULT_LIMIT = 100;

export type ConnectionSummaryRow = {
  jv_name?: string;
  conn_date?: string;
  new_connection_count?: number;
  old_connection_count?: number;
};

/** Row from GET /api/naturalgasgvconnections (and upload preview after normalize). */
export type ConnectionJvRow = {
  id?: number;
  ga_name?: string;
  gv_name?: string;
  conn_date?: string;
  day_wise_target?: number;
  backlog_lmc?: number;
  backlog_ngc?: number;
  achieved_count?: number;
  created_at?: string;
  updated_at?: string;
  entity_id?: string | null;
  /** Legacy upload / alternate column names */
  ga_area?: string;
  ga_id?: string;
  state?: string;
  jv_name?: string;
  new_connection_count?: number;
  old_connection_count?: number;
};

function pickFirstArray(obj: Record<string, unknown>, keys: string[]): unknown[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function asRecordRow(x: unknown): Record<string, unknown> | null {
  if (x !== null && typeof x === "object" && !Array.isArray(x)) {
    return x as Record<string, unknown>;
  }
  return null;
}

function str(r: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return undefined;
}

function num(r: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

export function normalizeSummaryRow(r: Record<string, unknown>): ConnectionSummaryRow {
  return {
    jv_name: str(r, [
      "jv_name",
      "JV Name",
      "JV",
      "jv",
      "JV_NAME",
      "Entity",
      "entity",
    ]),
    conn_date: str(r, [
      "conn_date",
      "Conn Date",
      "Date",
      "connection_date",
      "CONNECTION_DATE",
    ]),
    new_connection_count: num(r, [
      "new_connection_count",
      "New",
      "new",
      "New Connection",
      "NEW_CONNECTION_COUNT",
    ]),
    old_connection_count: num(r, [
      "old_connection_count",
      "Old",
      "old",
      "Old Connection",
      "OLD_CONNECTION_COUNT",
    ]),
  };
}

export function normalizeJvRow(r: Record<string, unknown>): ConnectionJvRow {
  const base = normalizeSummaryRow(r);
  return {
    ...base,
    id: num(r, ["id", "ID"]),
    ga_name: str(r, [
      "ga_name",
      "GA Name",
      "ga_area",
      "GA area",
      "GA Area",
      "gaArea",
      "Geographical Area",
    ]),
    gv_name: str(r, ["gv_name", "GV Name", "gv", "GV"]),
    day_wise_target: num(r, [
      "day_wise_target",
      "dayWiseTarget",
      "Day Wise Target",
      "DAY_WISE_TARGET",
    ]),
    backlog_lmc: num(r, ["backlog_lmc", "backlogLmc", "BACKLOG_LMC"]),
    backlog_ngc: num(r, ["backlog_ngc", "backlogNgc", "BACKLOG_NGC"]),
    achieved_count: num(r, [
      "achieved_count",
      "achievedCount",
      "Achieved",
      "ACHIEVED_COUNT",
    ]),
    created_at: str(r, ["created_at", "createdAt", "CREATED_AT"]),
    updated_at: str(r, ["updated_at", "updatedAt", "UPDATED_AT"]),
    entity_id: (() => {
      const v = r.entity_id ?? (r as { entity_id?: unknown; entityId?: unknown }).entityId;
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    })(),
    ga_area: str(r, ["ga_area", "GA area", "GA Area", "gaArea", "Geographical Area"]),
    ga_id: str(r, ["ga_id", "GA ID", "GA_ID", "gaId"]),
    state: str(r, ["state", "State", "STATE"]),
  };
}

export function parseUploadConnectionResponse(res: {
  data?: unknown;
}): {
  ack_id: string;
  summary: ConnectionSummaryRow[];
  jv: ConnectionJvRow[];
} | null {
  const raw = res?.data as Record<string, unknown> | undefined;
  const body = (raw?.data as Record<string, unknown> | undefined) ?? raw;
  if (!body || typeof body !== "object") return null;

  const ack =
    body.ack_id ??
    body.ackId ??
    (body as { Ack_Id?: string }).Ack_Id ??
    (body as { ACK_ID?: string }).ACK_ID;
  const ack_id = typeof ack === "string" ? ack : ack != null ? String(ack) : "";
  if (!ack_id) return null;

  const payload = (body.payload as Record<string, unknown> | undefined) ?? body;

  const summaryKeys = [
    "Summary Data",
    "summary_data",
    "SummaryData",
    "summary",
    "Summary",
  ];
  /** Upload `/api/naturalgasgvconnections/upload_connection_data` returns rows under `payload.detailed_report`. */
  const jvKeys = [
    "detailed_report",
    "Detailed_Report",
    "detailedReport",
    "JV Data",
    "jv_data",
    "JVData",
    "jv",
    "JV",
    "jv_detail",
    "JVDetail",
    "jvDetail",
  ];

  let summaryRaw = pickFirstArray(payload, summaryKeys);
  if (summaryRaw.length === 0) summaryRaw = pickFirstArray(body, summaryKeys);

  let jvRaw = pickFirstArray(payload, jvKeys);
  if (jvRaw.length === 0) jvRaw = pickFirstArray(body, jvKeys);

  const summary: ConnectionSummaryRow[] = [];
  for (const row of summaryRaw) {
    const rec = asRecordRow(row);
    if (rec) summary.push(normalizeSummaryRow(rec));
  }

  const jv: ConnectionJvRow[] = [];
  for (const row of jvRaw) {
    const rec = asRecordRow(row);
    if (rec) jv.push(normalizeJvRow(rec));
  }

  return {
    ack_id,
    summary,
    jv,
  };
}

/**
 * Extracts an array of row objects from typical paginated list API responses
 * (array root, `{ data: [] }`, `{ data: { items: [] } }`, etc.).
 */
export function extractRecordsFromListResponse(res: {
  data?: unknown;
}): Record<string, unknown>[] {
  const raw = res?.data;

  const recordsFromArray = (arr: unknown): Record<string, unknown>[] => {
    if (!Array.isArray(arr)) return [];
    const out: Record<string, unknown>[] = [];
    for (const item of arr) {
      const rec = asRecordRow(item);
      if (rec) out.push(rec);
    }
    return out;
  };

  if (Array.isArray(raw)) return recordsFromArray(raw);

  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const first = (o.data ?? o.Data ?? o.payload) as unknown;
    if (Array.isArray(first)) {
      const got = recordsFromArray(first);
      if (got.length > 0) return got;
    }
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const inner = first as Record<string, unknown>;
      for (const key of ["items", "results", "rows", "records", "data", "list"]) {
        const arr = inner[key];
        if (Array.isArray(arr)) {
          const got = recordsFromArray(arr);
          if (got.length > 0) return got;
        }
      }
    }
    for (const key of ["items", "results", "rows", "records", "list", "data"]) {
      const arr = o[key];
      if (Array.isArray(arr)) {
        const got = recordsFromArray(arr);
        if (got.length > 0) return got;
      }
    }
  }

  return [];
}

export function parseConfirmSyncResponse(res: {
  data?: unknown;
}): {
  status: string | number | boolean | null;
  message: string | null;
} {
  const raw = res?.data as unknown;
  if (Array.isArray(raw) && raw.length >= 2) {
    return {
      status: raw[0] as string | number | boolean,
      message: String(raw[1] ?? ""),
    };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const inner = (o.data as Record<string, unknown> | undefined) ?? o;
    const status =
      inner.Status ?? inner.status ?? inner.success ?? inner[0] ?? null;
    const message =
      inner.Message ?? inner.message ?? inner[1] ?? null;
    return {
      status: status as string | number | boolean | null,
      message: message != null ? String(message) : null,
    };
  }
  return { status: null, message: null };
}

/** Interprets API [Status, Message] — true / success / 200 = green; false / failure = red. */
export function isConfirmSuccessful(
  status: string | number | boolean | null,
  message: string | null
): boolean {
  if (status === true) return true;
  if (status === false) return false;
  if (typeof status === "string") {
    const s = status.trim().toLowerCase();
    if (s === "true" || s === "success" || s === "ok") return true;
    if (s === "false" || s === "fail" || s === "failure" || s === "error")
      return false;
  }
  if (status === 200 || status === "200") return true;
  if (status === 400 || status === 500 || status === "400" || status === "500")
    return false;
  if (message && /fail|error|invalid|denied/i.test(message) && status !== 200)
    return false;
  if (message && /success|synced|completed|ok/i.test(message)) return true;
  return false;
}

export function parseConfirmFromAxiosError(e: unknown): {
  status: string | number | boolean | null;
  message: string | null;
} | null {
  const err = e as { response?: { data?: unknown } };
  const data = err?.response?.data;
  if (data === undefined || data === null) return null;
  return parseConfirmSyncResponse({ data });
}
