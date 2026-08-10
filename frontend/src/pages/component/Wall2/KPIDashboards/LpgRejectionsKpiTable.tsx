import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import NoDataDisplay from "@/components/common/NoDataDisplay";
import type { LpgRejectionsDailyRow, LpgRejectionsPlantRow } from "./lpgRejectionsKpi.api";
import LpgRejectionsDailyAm3BarChart, {
  type LpgRejectionsDailyChartRow,
} from "./LpgRejectionsDailyAm3BarChart";
import LpgRejectionsTrendSparkline from "./LpgRejectionsTrendSparkline";

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

function fmtTrendPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}%`;
}

function formatDayLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function dailyToChartRows(daily: LpgRejectionsDailyRow[]): LpgRejectionsDailyChartRow[] {
  return [...daily]
    .sort((a, b) => String(a.process_date).localeCompare(String(b.process_date)))
    .map((d) => ({
      dayLabel: formatDayLabel(d.process_date),
      cs: d.cs_rejection,
      gd: d.gd_rejection,
      pt: d.pt_rejection,
    }));
}

/** Unwrap `data` from insight API: `{ status, message, data: plants[] }` or a raw array. */
export function unwrapLpgRejectionsPlantRows(raw: unknown): LpgRejectionsPlantRow[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    return typeof raw[0] === "object" ? (raw as LpgRejectionsPlantRow[]) : null;
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.status === false) return null;
  const inner = o.data;
  if (Array.isArray(inner)) {
    if (inner.length === 0) return [];
    return typeof inner[0] === "object" ? (inner as LpgRejectionsPlantRow[]) : null;
  }
  return null;
}

export interface LpgRejectionsKpiTableProps {
  crossFilters: Array<{ key: string; cond: string; value: string }>;
  response: unknown | null;
  loading: boolean;
  error: string | null;
}

const LpgRejectionsKpiTable: React.FC<LpgRejectionsKpiTableProps> = ({
  crossFilters,
  response,
  loading,
  error,
}) => {
  /** Row whose trend is expanded — chart renders below the table. */
  const [expandedSapId, setExpandedSapId] = useState<string | null>(null);

  const awaitingFilters = crossFilters.length === 0;

  const rows = useMemo(() => unwrapLpgRejectionsPlantRows(response), [response]);

  const sortedRows = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows].sort((a, b) =>
      String(a.location_name).localeCompare(String(b.location_name), undefined, { sensitivity: "base" })
    );
  }, [rows]);

  const expandedRow = useMemo(
    () => (expandedSapId ? sortedRows.find((r) => r.sap_id === expandedSapId) ?? null : null),
    [sortedRows, expandedSapId]
  );

  const chartData = useMemo(
    () => (expandedRow?.daily?.length ? dailyToChartRows(expandedRow.daily) : []),
    [expandedRow]
  );

  const toggleTrendChart = (row: LpgRejectionsPlantRow) => {
    setExpandedSapId((prev) => (prev === row.sap_id ? null : row.sap_id));
  };

  const renderBody = () => {
    if (awaitingFilters) {
      return (
        <div className="flex min-h-[200px] items-center justify-center px-4 text-center text-xs text-gray-500">
          Waiting for date range…
        </div>
      );
    }
    if (loading) {
      return (
        <div className="flex min-h-[280px] items-center justify-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading…</span>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex min-h-[160px] items-center justify-center px-4 text-center text-xs text-red-600">
          {error}
        </div>
      );
    }
    if (rows === null) {
      return (
        <div className="flex min-h-[160px] items-center justify-center px-4 text-center text-xs text-amber-700">
          Unexpected response shape for rejections.
        </div>
      );
    }
    if (!sortedRows.length) {
      return (
        <div className="relative min-h-[280px]">
          <NoDataDisplay message="No rejections data for this view" />
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full min-w-[720px] border-collapse text-xs text-gray-800">
          <thead>
            <tr className="bg-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              <th className="border-b border-gray-200 px-2.5 py-2">Plant location</th>
              <th className="border-b border-gray-200 px-2.5 py-2">Type CS</th>
              <th className="border-b border-gray-200 px-2.5 py-2">Type GD</th>
              <th className="border-b border-gray-200 px-2.5 py-2">Type PT</th>
              <th className="border-b border-gray-200 px-2.5 py-2">Total rejections</th>
              <th className="w-[116px] border-b border-gray-200 px-2.5 py-2">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const o = row.overall;
              const isOpen = expandedSapId === row.sap_id;
              return (
                <tr key={row.sap_id} className="border-b border-gray-100 bg-white last:border-0">
                  <td className="px-2.5 py-2 text-[11px] font-semibold text-gray-900">{row.location_name}</td>
                  <td className="px-2.5 py-2 text-[11px] font-medium text-[#5E74E9]">{fmtNum(o.cs_rejection)}</td>
                  <td className="px-2.5 py-2 text-[11px] font-medium text-[#5B3474]">{fmtNum(o.gd_rejection)}</td>
                  <td className="px-2.5 py-2 text-[11px] font-medium text-[#D94769]">{fmtNum(o.pt_rejection)}</td>
                  <td className="px-2.5 py-2 text-[11px] font-semibold text-gray-900">{fmtNum(o.total_rejections)}</td>
                  <td className="w-[116px] px-2 py-1.5 align-middle">
                    <button
                      type="button"
                      onClick={() => toggleTrendChart(row)}
                      title={`Trend ${fmtTrendPct(o.trend_pct)} — ${isOpen ? "hide" : "show"} day-wise chart below`}
                      className={`inline-flex w-full items-center justify-center rounded-md px-1 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                        isOpen ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50"
                      }`}
                    >
                      <LpgRejectionsTrendSparkline daily={row.daily} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderBody()}

      {expandedRow && chartData.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 border-b border-gray-100 pb-2">
            <h3 className="text-sm font-semibold text-gray-800">
              {expandedRow.location_name} — day-wise rejections
            </h3>
            <p className="mt-0.5 text-[11px] text-gray-500">
              CS / GD / PT colours match the trend column. Hover segments for tooltips.
            </p>
          </div>
          <div className="w-full" style={{ minHeight: 560 }}>
            <LpgRejectionsDailyAm3BarChart key={expandedSapId ?? "chart"} data={chartData} />
          </div>
        </div>
      ) : expandedRow ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-xs text-gray-500">
          No daily data for this plant.
        </div>
      ) : null}
    </div>
  );
};

export default LpgRejectionsKpiTable;
