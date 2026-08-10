import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronRight, MapPin, RefreshCw } from "lucide-react";
import { NaturalGasDashboardShell } from "./NaturalGasDashboardShell";
import { OMC_COMPANY_NAMES, type OmcCompanyName } from "../omcCompanyColors";
import axios from "axios";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/@/components/ui/button";
import { cn } from "@/@/lib/utils";
import {
  type AggRow,
  formatCell,
  NATURAL_GAS_GV_CONNECTIONS_AGGREGATION_PAYLOAD,
  normalizeAggregationRows,
  rowTotal,
} from "./naturalGasAggregationsApi";
import { useNaturalGasAnalyticsDate } from "../NaturalGasAnalyticsDateContext";

type Row = {
  id: string;
  name: string;
  /** Formatted total (API `Total` / achieved sum) for this row */
  sales: string;
  children?: Row[];
};

const NAVY = "#1a2b4b";
const HEADER_BG = "#eef2ff";
const STRIPE = "#f0f4f8";
const CELL_BORDER = "#dfe4eb";

function idSafe(s: string): string {
  return s.replace(/\s+/g, "_").replace(/[^\w\-:]/g, "_");
}

function parseFormattedNumber(s: string): number {
  const n = Number(String(s).replaceAll(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function buildTreeFromAggRows(rows: AggRow[]): Row[] {
  // group_by: ["gv_name","conn_date","ga_name"]
  const byGv = new Map<string, AggRow[]>();
  for (const r of rows) {
    const gv = String(r.gv_name ?? r.gvName ?? "—").trim() || "—";
    if (!byGv.has(gv)) byGv.set(gv, []);
    byGv.get(gv)!.push(r);
  }

  const gvNames = [...byGv.keys()].sort((a, b) => a.localeCompare(b));
  return gvNames.map((gv) => {
    const gvRows = byGv.get(gv)!;
    const byDate = new Map<string, AggRow[]>();
    for (const r of gvRows) {
      const d = String(r.conn_date ?? r.Conn_date ?? r.date ?? "—").trim() || "—";
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(r);
    }
    const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
    const dateChildren: Row[] = dates.map((d) => {
      const dateRows = byDate.get(d)!;
      const gaChildren: Row[] = dateRows
        .slice()
        .sort((a, b) =>
          String(a.ga_name ?? a.gaName ?? "—").localeCompare(String(b.ga_name ?? b.gaName ?? "—"))
        )
        .map((r) => {
          const ga = String(r.ga_name ?? r.gaName ?? "—").trim() || "—";
          const total = rowTotal(r);
          return {
            id: `ga:${idSafe(gv)}:${idSafe(d)}:${idSafe(ga)}`,
            name: ga,
            sales: formatCell(total),
          };
        });
      const sum = gaChildren.reduce((acc, x) => acc + parseFormattedNumber(x.sales), 0);
      return {
        id: `date:${idSafe(gv)}:${idSafe(d)}`,
        name: d,
        sales: formatCell(sum),
        children: gaChildren,
      };
    });

    const gvSum = dateChildren.reduce((acc, x) => acc + parseFormattedNumber(x.sales), 0);
    return {
      id: `gv:${idSafe(gv)}`,
      name: gv,
      sales: formatCell(gvSum),
      children: dateChildren,
    };
  });
}

/** Deepest expanded chain from root (for breadcrumb). */
function getDeepestExpandedChain(rows: Row[], expanded: Set<string>): Row[] {
  let best: Row[] = [];
  function dfs(row: Row, chain: Row[]) {
    if (!expanded.has(row.id)) return;
    const next = [...chain, row];
    if (next.length > best.length) best = next;
    if (row.children) {
      for (const c of row.children) dfs(c, next);
    }
  }
  for (const r of rows) dfs(r, []);
  return best;
}

function findPathToRow(rows: Row[], id: string, path: Row[] = []): Row[] | null {
  for (const r of rows) {
    if (r.id === id) return [...path, r];
    if (r.children) {
      const hit = findPathToRow(r.children, id, [...path, r]);
      if (hit) return hit;
    }
  }
  return null;
}

type FlatItem =
  | { kind: "row"; row: Row; depth: number }
  | { kind: "subheader"; parentId: string };

/** Visible rows in order; sub-header inserted when a state (depth 1) is expanded with GA children. */
function flattenVisible(rows: Row[], expanded: Set<string>, depth = 0): FlatItem[] {
  const out: FlatItem[] = [];
  for (const row of rows) {
    out.push({ kind: "row", row, depth });
    if (!expanded.has(row.id) || !row.children?.length) continue;
    const hasGaChildren = row.children.some((c) => /\bGA\b/i.test(c.name) || c.name.includes("GA"));
    if (depth === 1 && hasGaChildren) {
      out.push({ kind: "subheader", parentId: row.id });
    }
    out.push(...flattenVisible(row.children, expanded, depth + 1));
  }
  return out;
}

function companyLogoClass(name: string): string {
  const n = name.toUpperCase();
  if (n === "HPCL") return "bg-[#9fdef0] text-[#1a2b4b] ring-1 ring-[#7ec8e0]";
  if (n === "HOGPL") return "bg-[#2a5d78] text-white ring-1 ring-[#1e4a5f]";
  if (n === "BGL") return "bg-[#f5a954] text-[#1a2b4b] ring-1 ring-[#e89433]";
  return "bg-slate-600 text-white";
}

function LogoMark({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold shadow-sm ${companyLogoClass(name)}`}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Match reference style: `All JVs > Maharashtra, Pune` when drilled to a GA row. */
function breadcrumbLabels(chain: Row[]): string[] {
  const base: string[] = ["All JVs"];
  if (chain.length === 0) return base;
  const last = chain[chain.length - 1]!;
  if (chain.length >= 2 && /\bGA\b/i.test(last.name)) {
    const stateRow = chain[chain.length - 2]!;
    const gaShort = last.name.replace(/\s*GA\s*$/i, "").trim();
    return [...base, `${stateRow.name}, ${gaShort}`];
  }
  return [...base, ...chain.map((r) => r.name)];
}

function Breadcrumbs({ chain }: { chain: Row[] }) {
  const parts = breadcrumbLabels(chain);
  return (
    <nav
      className="mb-3 flex flex-wrap items-center gap-1 text-[12px] font-semibold"
      style={{ color: NAVY }}
      aria-label="Breadcrumb"
    >
      {parts.map((label, i) => (
        <React.Fragment key={`${label}-${i}`}>
          {i > 0 ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" style={{ color: NAVY }} aria-hidden />
          ) : null}
          <span className={i === parts.length - 1 ? "font-bold" : ""}>{label}</span>
        </React.Fragment>
      ))}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" style={{ color: NAVY }} aria-hidden />
    </nav>
  );
}

function SubHeaderRow() {
  const cells = ["GA area", "Sales (total)"];
  return (
    <tr className="border-b bg-[#e8ecfc]" style={{ borderColor: CELL_BORDER }}>
      {cells.map((label, i) => (
        <td
          key={label}
          className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide ${i === 0 ? "border-r" : ""}`}
          style={{
            borderColor: CELL_BORDER,
            color: NAVY,
            textAlign: i === 0 ? "left" : "center",
          }}
        >
          {label}
        </td>
      ))}
    </tr>
  );
}

export const MultilevelAnalyticsPage: React.FC = () => {
  const { dateFrom, dateTo, refreshToken, refresh } = useNaturalGasAnalyticsDate();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [aggRows, setAggRows] = useState<AggRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchAggregation = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const ctrl = new AbortController();
    fetchAbortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(
        "/api/tableanalytics/generate_data_aggregations",
        {
          ...NATURAL_GAS_GV_CONNECTIONS_AGGREGATION_PAYLOAD,
          date_from: dateFrom,
          date_to: dateTo,
        },
        { signal: ctrl.signal }
      );
      setAggRows(normalizeAggregationRows(res.data));
    } catch (e) {
      if (axios.isCancel(e)) return;
      setError(e instanceof Error ? e.message : String(e));
      setAggRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAggregation();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [fetchAggregation, refreshToken]);

  const tree = useMemo(() => buildTreeFromAggRows(aggRows), [aggRows]);

  useEffect(() => {
    // Open the first GV node by default (and its first date) once data arrives.
    if (!tree.length) return;
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      const first = tree[0]!;
      next.add(first.id);
      if (first.children?.[0]) next.add(first.children[0].id);
      return next;
    });
  }, [tree]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const crumbChain = useMemo(() => {
    if (focusRowId) {
      const p = findPathToRow(tree, focusRowId);
      if (p?.length) return p;
    }
    return getDeepestExpandedChain(tree, expanded);
  }, [expanded, focusRowId]);

  const flat = useMemo(() => flattenVisible(tree, expanded), [expanded]);

  return (
    <NaturalGasDashboardShell>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Breadcrumbs chain={crumbChain} />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 border-slate-300 text-slate-600 hover:bg-slate-50"
          disabled={loading}
          onClick={() => refresh()}
          title="Refresh multilevel data"
          aria-label="Refresh multilevel data"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </div>

      <div
        className="overflow-hidden rounded-lg shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-[#c7d2e0]/80"
        style={{ borderColor: CELL_BORDER }}
      >
        <div className="max-h-[min(520px,62vh)] overflow-auto">
          {loading ? (
            <div className="px-3 py-3 text-[12px] font-semibold" style={{ color: NAVY }}>
              Loading…
            </div>
          ) : null}
          {!loading && error ? (
            <div className="px-3 py-3 text-[12px] font-semibold text-red-700">{error}</div>
          ) : null}
          <table className="w-full min-w-[320px] table-fixed border-collapse text-[12px]">
            <colgroup>
              <col style={{ width: "58%" }} />
              <col style={{ width: "42%" }} />
            </colgroup>
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr style={{ backgroundColor: HEADER_BG, borderBottom: `1px solid ${CELL_BORDER}` }}>
                <th
                  className="border-r px-3 py-3 text-left font-bold"
                  style={{ borderColor: CELL_BORDER, color: NAVY }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    JV level
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2.5} aria-hidden />
                  </span>
                </th>
                <th className="px-3 py-3 text-center font-bold" style={{ color: NAVY }}>
                  Sales (total)
                </th>
              </tr>
            </thead>
            <tbody>
              {flat.map((item, flatIdx) => {
                if (item.kind === "subheader") {
                  return <SubHeaderRow key={`sub-${item.parentId}`} />;
                }

                const { row, depth } = item;
                const hasChildren = Boolean(row.children && row.children.length > 0);
                const isOpen = expanded.has(row.id);
                const dataIdx = flat.slice(0, flatIdx).filter((x) => x.kind === "row").length;
                const stripe = dataIdx % 2 === 1;

                const isCompany =
                  depth === 0 && OMC_COMPANY_NAMES.includes(row.name as OmcCompanyName);
                /** Under JV: depth 1 = conn dates; under dates: depth 2+ = GA / area rows */
                const isDateRow = depth === 1;
                const isGaAreaRow = depth >= 2;

                const rowBg = stripe ? STRIPE : "#ffffff";

                const isFocused = focusRowId === row.id;

                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-[#dbeafe]/50"
                    style={{
                      backgroundColor: isFocused ? "#e0edfc" : rowBg,
                      borderBottom: `1px solid ${CELL_BORDER}`,
                    }}
                    onClick={() => setFocusRowId(row.id)}
                  >
                    <td
                      className="min-w-0 border-r px-3 py-2.5 align-middle font-medium"
                      style={{
                        borderColor: CELL_BORDER,
                        color: NAVY,
                        paddingLeft: `${12 + depth * 20}px`,
                      }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          className="inline-flex w-full items-center gap-2 text-left font-bold hover:opacity-90"
                          style={{ color: NAVY }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(row.id);
                          }}
                          aria-expanded={isOpen}
                        >
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 text-[#2563eb] transition-transform ${isOpen ? "rotate-90" : ""}`}
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          {isCompany ? <LogoMark name={row.name} /> : null}
                          {!isCompany && isDateRow ? (
                            <Calendar className="h-4 w-4 shrink-0 text-[#0d9488]" aria-hidden />
                          ) : null}
                          {!isCompany && isGaAreaRow ? (
                            <MapPin className="h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden />
                          ) : null}
                          <span className={depth >= 2 ? "text-[11px] font-semibold" : ""}>{row.name}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-2 font-semibold" style={{ color: NAVY }}>
                          <span className="inline-block w-6 shrink-0" aria-hidden />
                          {!isCompany && isDateRow ? (
                            <Calendar className="h-4 w-4 shrink-0 text-[#0d9488]" aria-hidden />
                          ) : null}
                          {!isCompany && isGaAreaRow ? (
                            <MapPin className="h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden />
                          ) : null}
                          <span className={depth >= 2 ? "text-[11px]" : ""}>{row.name}</span>
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2.5 text-center tabular-nums font-semibold"
                      style={{ color: NAVY }}
                    >
                      {row.sales}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </NaturalGasDashboardShell>
  );
};
