import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, FileSpreadsheet, Loader2 } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { toast } from "sonner";

const REPORTS_LIST_API = "/api/natural-gas/ngc-mis/reports";
const REPORT_DETAIL_API = "/api/natural-gas/ngc-mis/report";

type ReportListItem = {
  report_date: string;
  uploaded_at?: string;
  uploaded_by?: string;
  file_name?: string;
};

type GaRow = {
  geographical_area?: string;
  ga_name?: string;
  status?: string;
  progress_pct?: number | string;
  remarks?: string;
  [key: string]: unknown;
};

type ReportDetail = {
  summary?: Record<string, string | number | null>;
  ga_wise?: GaRow[];
};

function formatDateLabel(iso: string) {
  try {
    const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export const NGCMISOfficerPanel: React.FC = () => {
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportDays, setReportDays] = useState<ReportListItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ReportDetail | null>(null);

  const loadReportList = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await apiClient.get(REPORTS_LIST_API);
      const body = res?.data;
      const list =
        (body?.reports as ReportListItem[]) ||
        (body?.data as ReportListItem[]) ||
        [];
      setReportDays(Array.isArray(list) ? list : []);
    } catch {
      setReportDays([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReportList();
  }, [loadReportList]);

  const loadDetail = async (date: string) => {
    if (!date) return;
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiClient.get(REPORT_DETAIL_API, {
        params: { date },
      });
      const body = res?.data?.data ?? res?.data;
      setDetail(
        body && typeof body === "object"
          ? (body as ReportDetail)
          : { summary: {}, ga_wise: [] }
      );
    } catch {
      toast.error("Could not load report for this date.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const summaryEntries = detail?.summary
    ? Object.entries(detail.summary)
    : [];
  const gaRows = Array.isArray(detail?.ga_wise) ? detail!.ga_wise! : [];
  const gaColumns =
    gaRows.length > 0
      ? Array.from(
          new Set(
            gaRows.flatMap((r) =>
              Object.keys(r).filter((k) => !k.startsWith("_"))
            )
          )
        )
      : ["geographical_area", "status", "progress_pct", "remarks"];

  return (
    <div className="space-y-1.5">
      <Card className="overflow-hidden border border-gray-200/90 bg-white shadow-sm ring-1 ring-gray-100/80 md:max-w-3xl">
        <CardHeader className="border-b border-gray-200/80 bg-white px-2.5 py-1.5">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-700 shadow-sm">
              <CalendarDays className="h-3.5 w-3.5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                Officer
              </span>
              View report (day-wise)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-2.5 py-2">
          <div className="flex flex-wrap items-end gap-1.5">
            <div className="space-y-0.5">
              <label
                className="text-xs font-medium text-gray-700"
                htmlFor="ngc-report-date"
              >
                Report date
              </label>
              <Input
                id="ngc-report-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 w-[188px] border-gray-200 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedDate || detailLoading}
              onClick={() => void loadDetail(selectedDate)}
            >
              {detailLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Load"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reportsLoading}
              onClick={() => void loadReportList()}
            >
              Refresh list
            </Button>
          </div>

          <div>
            <p className="mb-0.5 text-xs font-medium text-gray-600">
              Available dates (from server)
            </p>
            {reportsLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : reportDays.length === 0 ? (
              <p className="text-xs text-gray-500">
                No reports listed yet — connect the list API or upload from HQO.
              </p>
            ) : (
              <ul className="max-h-28 space-y-0 overflow-y-auto rounded-md border border-gray-200/90 bg-white/80 p-1 text-xs">
                {reportDays.map((r) => (
                  <li key={r.report_date}>
                    <button
                      type="button"
                      className="w-full rounded px-1.5 py-1 text-left text-gray-800 hover:bg-gray-50"
                      onClick={() => {
                        setSelectedDate(r.report_date.slice(0, 10));
                        void loadDetail(r.report_date.slice(0, 10));
                      }}
                    >
                      <span className="font-medium text-gray-900">
                        {formatDateLabel(r.report_date)}
                      </span>
                      {r.file_name && (
                        <span className="ml-1.5 text-[10px] text-gray-500">
                          {r.file_name}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-gray-200/90 bg-white shadow-sm ring-1 ring-gray-100/80">
        <CardHeader className="border-b border-gray-200/80 bg-white px-2.5 py-1.5">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-700 shadow-sm ring-1 ring-gray-200/80">
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                Reports
              </span>
              Summary &amp; detailed tables
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 px-2.5 py-2">
          {/* <NGCProgressMockSummaryTable /> */}

          <div className="border-t border-gray-200/80 pt-1.5">
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-800">
              <span className="h-1 w-1 rounded-full bg-gray-400" aria-hidden />
              Detailed (JV — GA wise) from API
            </h3>
            {detailLoading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading report…
              </div>
            )}
            {!detailLoading && !detail && (
              <p className="text-xs text-gray-500">
                Pick a date and <strong className="font-semibold text-gray-800">Load</strong>{" "}
                to show live data when the API is connected.
              </p>
            )}
            {!detailLoading && detail && (
              <>
                <div className="mb-2">
                  {summaryEntries.length === 0 ? (
                    <p className="text-xs text-gray-500">No summary fields.</p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {summaryEntries.map(([k, v]) => (
                        <div
                          key={k}
                          className="rounded-md border border-gray-200/90 bg-white/90 px-2 py-1.5 text-xs shadow-sm"
                        >
                          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            {k.replace(/_/g, " ")}
                          </div>
                          <div className="font-medium text-gray-900">
                            {v === null || v === undefined ? "—" : String(v)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="min-w-0 overflow-hidden rounded-md border border-gray-200/90 bg-white shadow-sm ring-1 ring-gray-100/70">
                  <h4 className="border-b border-gray-200/80 bg-slate-100/90 px-2 py-1.5 text-xs font-semibold tracking-tight text-slate-800">
                    GA-wise details
                  </h4>
                  <div className="overflow-x-auto">
                    {gaRows.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-gray-500">No GA rows.</p>
                    ) : (
                      <table className="w-max max-w-full border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200/90 bg-slate-200/90">
                            {gaColumns.map((col) => (
                              <th
                                key={col}
                                className="whitespace-nowrap px-2 py-1.5 text-left text-[12px] font-semibold capitalize tracking-wide text-slate-700 first:pl-2 last:pr-2"
                              >
                                {col.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gaRows.map((row, idx) => (
                            <tr
                              key={idx}
                              className={`border-b border-gray-100/80 ${
                                idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                              } hover:bg-slate-100/50`}
                            >
                              {gaColumns.map((col) => (
                                <td
                                  key={col}
                                  className="max-w-[20rem] whitespace-normal px-2 py-1.5 text-[12px] leading-snug text-gray-800"
                                  title={
                                    row[col] != null ? String(row[col]) : undefined
                                  }
                                >
                                  {row[col] === undefined || row[col] === null
                                    ? "—"
                                    : String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
