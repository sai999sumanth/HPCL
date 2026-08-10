import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Maximize2, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/@/components/ui/sheet";
import { apiClient } from "@/services/apiClient";
import {
  buildLubesSegmentDistributorStatusPayload,
  buildLubesSegmentDistributorMonthlyPayload,
  buildLubesDistributorLastDatePayload,
  normalizeAggregationRows,
  pickField,
} from "./lubesSalesPerformance.utils";

const MONTH_ABBRS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const fmt = (v: number) =>
  v === 0 ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const fmtDate = (raw: string): string => {
  if (!raw || raw.length !== 8) return raw || "—";
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const d = new Date(`${year}-${month}-${day}`);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

type DistributorEntry = {
  name: string;
  salesArea: string;
  yearTotal: number;
  monthTotal: number;
  lastDate: string;
};

type StatusSection = {
  label: string;
  status: "Active" | "Inactive" | "Recently_Added";
  distributors: DistributorEntry[];
};

export type SegmentRegionStatusListProps = {
  fiscalYear: string;
};

const STATUS_CONFIG: Array<Pick<StatusSection, "label" | "status">> = [
  { label: "Active Distributer", status: "Active" },
  { label: "Inactive Distributer", status: "Inactive" },
  { label: "Recently Added Distributer", status: "Recently_Added" },
];

const STATUS_HEADING_STYLE: Record<
  StatusSection["status"],
  { border: string; bg: string; text: string; thead: string }
> = {
  Active: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    thead: "bg-emerald-100 text-emerald-700",
  },
  Inactive: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-700",
    thead: "bg-rose-100 text-rose-700",
  },
  Recently_Added: {
    border: "border-indigo-200",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    thead: "bg-indigo-100 text-indigo-700",
  },
};

const DistributorTable: React.FC<{
  distributors: DistributorEntry[];
  currentMonth: string;
  fiscalYear: string;
}> = ({ distributors, currentMonth, fiscalYear }) => (
  <table className="min-w-full border-collapse text-[10px]">
    <thead className="sticky top-0 z-10 bg-slate-100">
      <tr>
        <th className="px-2 py-1.5 text-left font-medium text-slate-600">Distributor</th>
        <th className="px-2 py-1.5 text-left font-medium text-slate-600 whitespace-nowrap">Sales Area</th>
        <th className="px-2 py-1.5 text-right font-medium text-slate-600 whitespace-nowrap">Total Sales ({fiscalYear})</th>
        <th className="px-2 py-1.5 text-right font-medium text-slate-600 whitespace-nowrap">{currentMonth} Sales</th>
        <th className="px-2 py-1.5 text-right font-medium text-slate-600 whitespace-nowrap">Last Sales Date</th>
      </tr>
    </thead>
    <tbody>
      {distributors.length > 0 ? (
        distributors.map((d, i) => (
          <tr key={`${d.name}__${d.salesArea}__${i}`} className="border-t border-slate-200 bg-white">
            <td className="max-w-[120px] truncate px-2 py-1.5 text-slate-700">{d.name}</td>
            <td className="max-w-[100px] truncate px-2 py-1.5 text-slate-500">{d.salesArea || "—"}</td>
            <td className="px-2 py-1.5 text-right text-slate-600">{fmt(d.yearTotal)}</td>
            <td className="px-2 py-1.5 text-right text-slate-600">{fmt(d.monthTotal)}</td>
            <td className="px-2 py-1.5 text-right text-slate-500 whitespace-nowrap">{fmtDate(d.lastDate)}</td>
          </tr>
        ))
      ) : (
        <tr className="border-t border-slate-200 bg-white">
          <td colSpan={5} className="px-2 py-2 text-center text-slate-400">No matches</td>
        </tr>
      )}
    </tbody>
  </table>
);

const SegmentRegionStatusList: React.FC<SegmentRegionStatusListProps> = ({
  fiscalYear,
}) => {
  const currentMonth = MONTH_ABBRS[new Date().getMonth()];

  const [sections, setSections] = useState<StatusSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState<
    Partial<Record<StatusSection["status"], boolean>>
  >({});
  const [searchByStatus, setSearchByStatus] = useState<
    Record<StatusSection["status"], string>
  >({ Active: "", Inactive: "", Recently_Added: "" });

  const [sheetSection, setSheetSection] = useState<StatusSection | null>(null);

  const fetchSection = useCallback(
    async (label: string, status: StatusSection["status"]): Promise<StatusSection> => {
      const [yearRes, monthRes, lastDateRes] = await Promise.all([
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesSegmentDistributorStatusPayload(fiscalYear, status)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesSegmentDistributorMonthlyPayload(fiscalYear, status, currentMonth)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesDistributorLastDatePayload(status)
        ),
      ]);

      type RowMeta = { name: string; salesArea: string };
      const yearMap = new Map<string, { meta: RowMeta; total: number }>();
      for (const row of normalizeAggregationRows(yearRes.data)) {
        const name = pickField(row, ["NAME1", "name1"]);
        if (!name) continue;
        const salesArea = pickField(row, ["ORG_SA_NM", "org_sa_nm"]) ?? "";
        const key = `${name}__${salesArea}`;
        yearMap.set(key, { meta: { name, salesArea }, total: Number(row.Total ?? row.total ?? 0) });
      }

      const monthMap = new Map<string, number>();
      for (const row of normalizeAggregationRows(monthRes.data)) {
        const name = pickField(row, ["NAME1", "name1"]);
        if (!name) continue;
        const salesArea = pickField(row, ["ORG_SA_NM", "org_sa_nm"]) ?? "";
        const key = `${name}__${salesArea}`;
        monthMap.set(key, Number(row.Total ?? row.total ?? 0));
      }

      const lastDateMap = new Map<string, string>();
      for (const row of normalizeAggregationRows(lastDateRes.data)) {
        const name = pickField(row, ["NAME1", "name1"]);
        if (!name) continue;
        const raw = row.LAST_DATE ?? row.last_date ?? "";
        lastDateMap.set(name, String(raw).trim());
      }

      const allKeys = Array.from(
        new Set([...yearMap.keys(), ...monthMap.keys()])
      ).sort((a, b) => a.localeCompare(b));

      const distributors: DistributorEntry[] = allKeys.map((key) => {
        const meta = yearMap.get(key)?.meta ?? (() => {
          const [name, salesArea] = key.split("__");
          return { name, salesArea };
        })();
        return {
          name: meta.name,
          salesArea: meta.salesArea,
          yearTotal: yearMap.get(key)?.total ?? 0,
          monthTotal: monthMap.get(key) ?? 0,
          lastDate: lastDateMap.get(meta.name) ?? "",
        };
      });

      return { label, status, distributors };
    },
    [fiscalYear, currentMonth]
  );

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        STATUS_CONFIG.map(({ label, status }) => fetchSection(label, status))
      );
      setSections(results);
    } catch {
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [fetchSection]);

  const refreshSection = useCallback(
    async (label: string, status: StatusSection["status"]) => {
      setRefreshingStatus((prev) => ({ ...prev, [status]: true }));
      try {
        const updated = await fetchSection(label, status);
        setSections((prev) =>
          prev.map((s) => (s.status === status ? updated : s))
        );
      } catch {
        // keep existing data on error
      } finally {
        setRefreshingStatus((prev) => ({ ...prev, [status]: false }));
      }
    },
    [fetchSection]
  );

  useEffect(() => {
    void fetchSections();
  }, [fetchSections]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      {loading ? (
        <div className="flex h-20 items-center justify-center text-xs text-slate-500">
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-slate-500" />
          Loading status data...
        </div>
      ) : sections.length === 0 ? (
        <div className="flex h-20 items-center justify-center text-xs text-slate-500">
          No status data available.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 overflow-x-auto">
          {sections.map((section) => {
            const query = searchByStatus[section.status].trim().toLowerCase();
            const filtered = query
              ? section.distributors.filter(
                  (d) =>
                    d.name.toLowerCase().includes(query) ||
                    d.salesArea.toLowerCase().includes(query)
                )
              : section.distributors;
            const style = STATUS_HEADING_STYLE[section.status];

            return (
              <div
                key={section.label}
                className={`rounded-md border ${style.border} ${style.bg}`}
              >
                {/* Section header */}
                <div className={`border-b ${style.border} px-2 py-1.5`}>
                  <div className="flex items-center gap-2">
                    <div className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${style.text}`}>
                      {section.label}
                    </div>
                    <input
                      type="search"
                      value={searchByStatus[section.status]}
                      onChange={(e) =>
                        setSearchByStatus((prev) => ({
                          ...prev,
                          [section.status]: e.target.value,
                        }))
                      }
                      placeholder="Search..."
                      className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none placeholder:text-slate-400"
                    />
                    <div className="shrink-0 text-[10px] text-slate-500">
                      {filtered.length}
                    </div>
                    <button
                      type="button"
                      aria-label="Refresh"
                      disabled={!!refreshingStatus[section.status]}
                      onClick={() => void refreshSection(section.label, section.status)}
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-white/60 hover:text-slate-700 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${refreshingStatus[section.status] ? "animate-spin" : ""}`}
                      />
                    </button>
                    <button
                      type="button"
                      aria-label="Expand list"
                      onClick={() => setSheetSection(section)}
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-white/60 hover:text-slate-700"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="max-h-56 overflow-auto [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
                  <DistributorTable distributors={filtered} currentMonth={currentMonth} fiscalYear={fiscalYear} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sheet for expanded view */}
      <Sheet open={!!sheetSection} onOpenChange={(open) => { if (!open) setSheetSection(null); }}>
        <SheetContent side="right" className="flex w-[90vw] max-w-3xl flex-col gap-0 p-0">
          <SheetHeader
            className={`border-b px-4 py-3 ${sheetSection ? STATUS_HEADING_STYLE[sheetSection.status].bg : ""}`}
          >
            <div className="flex items-center gap-3">
              <SheetTitle
                className={`shrink-0 text-sm font-semibold ${sheetSection ? STATUS_HEADING_STYLE[sheetSection.status].text : ""}`}
              >
                {sheetSection?.label}
              </SheetTitle>
              {sheetSection && (
                <input
                  type="search"
                  value={searchByStatus[sheetSection.status]}
                  onChange={(e) =>
                    setSearchByStatus((prev) => ({ ...prev, [sheetSection.status]: e.target.value }))
                  }
                  placeholder="Search..."
                  className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none placeholder:text-slate-400"
                />
              )}
            </div>
          </SheetHeader>
          {sheetSection && (() => {
            const sheetQuery = searchByStatus[sheetSection.status].trim().toLowerCase();
            const sheetDistributors = sheetQuery
              ? sheetSection.distributors.filter(
                  (d) =>
                    d.name.toLowerCase().includes(sheetQuery) ||
                    d.salesArea.toLowerCase().includes(sheetQuery)
                )
              : sheetSection.distributors;
            return (
              <>
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
                  <DistributorTable distributors={sheetDistributors} currentMonth={currentMonth} fiscalYear={fiscalYear} />
                </div>
                <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
                  {sheetDistributors.length} item{sheetDistributors.length === 1 ? "" : "s"}
                </p>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SegmentRegionStatusList;
