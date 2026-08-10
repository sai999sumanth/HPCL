import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { apiClient } from "@/services/apiClient";
import { NaturalGasDashboardShell } from "./NaturalGasDashboardShell";
import { NgTripleLineAreaChart, type TripleLinePoint } from "./NaturalGasAmCharts";
import { OMC_COMPANY_HEX, hexToAm5Int } from "../omcCompanyColors";
import {
  type AggRow,
  buildMonthlyJvTripleLinePoints,
  formatCell,
  formatConnDateLabel,
  NATURAL_GAS_GV_CONNECTIONS_AGGREGATION_PAYLOAD,
  NATURAL_GAS_MONTHLY_COMPARISON_AGGREGATION_PAYLOAD,
  normalizeAggregationRows,
  rowTotal,
} from "./naturalGasAggregationsApi";
import { useNaturalGasAnalyticsDate } from "../NaturalGasAnalyticsDateContext";

const HEADER_BG = "#e8edf5";
const BORDER = "#d8dee9";
const NAVY = "#1a2b4b";

/** Matches prior daily log labels; data from daily `generate_data_aggregations` payload. */
const columns = ["Date", "Company", "GA area", "Sales"];

type DailyLogRow = {
  id: string;
  dateLabel: string;
  dateSort: string;
  company: string;
  gaName: string;
  sales: string;
};

function buildDailyRows(aggRows: AggRow[]): DailyLogRow[] {
  const mapped = aggRows.map((r, i) => {
    const dateRaw = r.conn_date ?? r.Conn_date ?? r.date ?? "";
    const gv = String(r.gv_name ?? r.gvName ?? "—").trim() || "—";
    const ga = String(r.ga_name ?? r.gaName ?? "—").trim() || "—";
    return {
      id: `row-${i}-${gv}-${String(dateRaw)}-${ga}`,
      dateLabel: formatConnDateLabel(dateRaw),
      dateSort: String(dateRaw).trim() || "",
      company: gv,
      gaName: ga,
      sales: formatCell(rowTotal(r)),
    };
  });
  mapped.sort((a, b) => {
    if (a.dateSort !== b.dateSort) return b.dateSort.localeCompare(a.dateSort);
    if (a.company !== b.company) return a.company.localeCompare(b.company);
    return a.gaName.localeCompare(b.gaName);
  });
  return mapped;
}

export const DailyPerformancePage: React.FC = () => {
  const { dateFrom, dateTo, refreshToken } = useNaturalGasAnalyticsDate();
  const [aggRows, setAggRows] = useState<AggRow[]>([]);
  const [monthlyAggRows, setMonthlyAggRows] = useState<AggRow[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchDailyLog = useCallback(async (signal: AbortSignal) => {
    setDailyLoading(true);
    setDailyError(null);
    try {
      const res = await apiClient.post(
        "/api/tableanalytics/generate_data_aggregations",
        {
          ...NATURAL_GAS_GV_CONNECTIONS_AGGREGATION_PAYLOAD,
          date_from: dateFrom,
          date_to: dateTo,
        },
        { signal }
      );
      setAggRows(normalizeAggregationRows(res.data));
    } catch (e) {
      if (axios.isCancel(e)) return;
      setDailyError(e instanceof Error ? e.message : String(e));
      setAggRows([]);
    } finally {
      setDailyLoading(false);
    }
  }, [dateFrom, dateTo]);

  const fetchMonthlyChart = useCallback(async (signal: AbortSignal) => {
    setMonthlyLoading(true);
    setMonthlyError(null);
    try {
      const res = await apiClient.post(
        "/api/tableanalytics/generate_data_aggregations",
        {
          ...NATURAL_GAS_MONTHLY_COMPARISON_AGGREGATION_PAYLOAD,
          date_from: dateFrom,
          date_to: dateTo,
        },
        { signal }
      );
      setMonthlyAggRows(normalizeAggregationRows(res.data));
    } catch (e) {
      if (axios.isCancel(e)) return;
      setMonthlyError(e instanceof Error ? e.message : String(e));
      setMonthlyAggRows([]);
    } finally {
      setMonthlyLoading(false);
    }
  }, [dateFrom, dateTo]);

  const refreshAll = useCallback(() => {
    fetchAbortRef.current?.abort();
    const ctrl = new AbortController();
    fetchAbortRef.current = ctrl;
    void fetchDailyLog(ctrl.signal);
    void fetchMonthlyChart(ctrl.signal);
  }, [fetchDailyLog, fetchMonthlyChart]);

  useEffect(() => {
    refreshAll();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [refreshAll, refreshToken]);

  const tableRows = useMemo(() => buildDailyRows(aggRows), [aggRows]);

  const comparisonData = useMemo<TripleLinePoint[]>(
    () => buildMonthlyJvTripleLinePoints(monthlyAggRows),
    [monthlyAggRows]
  );

  const chartYMax = useMemo(() => {
    let m = 0;
    for (const p of comparisonData) {
      m = Math.max(m, p.v0, p.v1, p.v2);
    }
    if (m <= 0) return undefined;
    const padded = Math.ceil(m * 1.12);
    return Math.max(padded, 5);
  }, [comparisonData]);

  const tripleColors: [number, number, number] = useMemo(
    () => [
      hexToAm5Int(OMC_COMPANY_HEX.HPCL),
      hexToAm5Int(OMC_COMPANY_HEX.HOGPL),
      hexToAm5Int(OMC_COMPANY_HEX.BGL),
    ],
    []
  );

  return (
    <NaturalGasDashboardShell>
      <div className="flex flex-col gap-1.5">
        {/* Daily performance log — prior layout; columns from daily aggregation API */}
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_16px_-6px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.04]">
          <div className="border-b border-slate-200/80 bg-slate-50/50 px-3 py-2">
            <h3 className="text-[13px] font-semibold tracking-tight text-[#1a2b4b]">Daily performance log</h3>
            
          </div>
          {!dailyLoading && dailyError ? (
            <div className="px-3 py-3 text-[12px] font-semibold text-red-700">{dailyError}</div>
          ) : null}
          <div className="max-h-[min(400px,52vh)] overflow-auto">
            <table className="w-full min-w-[900px] table-fixed border-collapse text-[12px]">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[18%]" />
                <col className="w-[35%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr style={{ backgroundColor: HEADER_BG, borderBottom: `1px solid ${BORDER}` }}>
                  {columns.map((h, i) => (
                    <th
                      key={h}
                      className={`border-b px-3 py-3 text-[11px] font-bold uppercase tracking-wide ${i === 0 ? "text-left" : "text-center"}`}
                      style={{
                        borderColor: BORDER,
                        color: "#1a2b4b",
                        borderRight: i < columns.length - 1 ? `1px solid ${BORDER}` : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[12px] font-semibold" style={{ color: NAVY }}>
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!dailyLoading && !dailyError && tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[12px] text-slate-500">
                      No rows returned for this range.
                    </td>
                  </tr>
                ) : null}
                {!dailyLoading &&
                  tableRows.map((row, ri) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-slate-100/90"
                      style={{
                        backgroundColor: ri % 2 === 0 ? "#ffffff" : "#f5f7fb",
                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      <td
                        className="min-w-0 px-3 py-2.5 text-left font-medium tabular-nums"
                        style={{ color: "#1e293b", borderRight: `1px solid ${BORDER}` }}
                      >
                        {row.dateLabel}
                      </td>
                      <td
                        className="min-w-0 px-3 py-2.5 text-center font-semibold"
                        style={{ color: "#1e293b", borderRight: `1px solid ${BORDER}` }}
                      >
                        {row.company}
                      </td>
                      <td
                        className="min-w-0 px-3 py-2.5 text-center break-words"
                        style={{ color: "#1e293b", borderRight: `1px solid ${BORDER}` }}
                      >
                        {row.gaName}
                      </td>
                      <td className="min-w-0 px-3 py-2.5 text-center tabular-nums font-semibold" style={{ color: "#1e293b" }}>
                        {row.sales}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comparison chart — monthly aggregation API */}
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_16px_-6px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.04]">
          <div className="border-b border-slate-200/80 px-3 py-2">
            <h3 className="text-[13px] font-semibold tracking-tight text-[#1a2b4b]">Comparison chart</h3>
          
          </div>
          <div className="p-2 pb-3">
            {monthlyLoading ? (
              <div className="flex h-[420px] items-center justify-center px-3 text-[12px] font-semibold text-slate-600">
                Loading chart…
              </div>
            ) : monthlyError ? (
              <div className="flex h-[420px] items-center justify-center px-3 text-[12px] text-red-700">{monthlyError}</div>
            ) : !monthlyError && comparisonData.length === 0 ? (
              <div className="flex h-[420px] items-center justify-center px-3 text-[12px] text-slate-500">
                No monthly series data for HPCL / HOGPL / BGL in this range.
              </div>
            ) : (
              <NgTripleLineAreaChart
                data={comparisonData}
                seriesNames={["HPCL", "HOGPL", "BGL"]}
                colors={tripleColors}
                valueUnit="count"
                valueFormat="#,###"
                areaFillOpacity={0.12}
                yMin={0}
                yMax={chartYMax}
                showXAxisLabels={false}
                className="h-[420px] w-full min-w-0"
              />
            )}
          </div>
        </div>
      </div>
    </NaturalGasDashboardShell>
  );
};
