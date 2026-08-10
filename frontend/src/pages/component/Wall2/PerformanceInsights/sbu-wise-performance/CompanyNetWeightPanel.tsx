import React, { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type { CompanySummary } from "./lubesSalesPerformance.types";
import {
  CompanySummaryCard,
  LoadingBlock,
  PanelShell,
} from "./lubesSalesPerformance.shared";
import { LUBES_UI } from "./lubesSalesPerformance.theme";
import { apiClient } from "@/services/apiClient";
import {
  buildLubesYtdPayload,
  normalizeAggregationRows,
  pickField,
} from "./lubesSalesPerformance.utils";

export type CompanyNetWeightPanelProps = {
  loading: boolean;
  refreshing: boolean;
  summaries: CompanySummary[];
  displayCurrentFY: string;
  ytdActive: boolean;
  ytdExtraFilters?: Record<string, string[]>;
  ytdExtraFiltersKey?: string;
  onYtdChange: (active: boolean) => void;
  onRefresh: () => void;
};

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const buildYtdSummaries = (
  currentData: unknown,
  prevData: unknown
): CompanySummary[] => {
  const currentMap = new Map<string, number>();
  for (const row of normalizeAggregationRows(currentData)) {
    const company = pickField(row as Record<string, unknown>, ["CATEGORY", "category"]);
    if (!company || company.toLowerCase() === "null") continue;
    currentMap.set(company, (currentMap.get(company) ?? 0) + Number(row.Total ?? row.total ?? 0));
  }

  const prevMap = new Map<string, number>();
  for (const row of normalizeAggregationRows(prevData)) {
    const company = pickField(row as Record<string, unknown>, ["CATEGORY", "category"]);
    if (!company || company.toLowerCase() === "null") continue;
    prevMap.set(company, (prevMap.get(company) ?? 0) + Number(row.Total ?? row.total ?? 0));
  }

  const allCompanies = Array.from(new Set([...currentMap.keys(), ...prevMap.keys()])).sort();
  return allCompanies.map((company) => {
    const currentFyTotal = currentMap.get(company) ?? 0;
    const previousFyTotal = prevMap.get(company) ?? 0;
    return { company, currentFyTotal, previousFyTotal, difference: currentFyTotal - previousFyTotal };
  });
};

const CompanyNetWeightPanel: React.FC<CompanyNetWeightPanelProps> = ({
  loading,
  refreshing,
  summaries,
  displayCurrentFY,
  ytdActive,
  ytdExtraFilters = {},
  ytdExtraFiltersKey = "",
  onYtdChange,
  onRefresh,
}) => {
  const [ytdLoading, setYtdLoading] = useState(false);
  const [ytdSummaries, setYtdSummaries] = useState<CompanySummary[] | null>(null);

  const fetchYtd = useCallback(async () => {
    setYtdLoading(true);
    try {
      const today = new Date();
      const currentDateTo = toYMD(today);

      const prevYearToday = new Date(today);
      prevYearToday.setFullYear(today.getFullYear() - 1);
      const prevDateTo = toYMD(prevYearToday);

      const currentFYStartYear = parseInt(displayCurrentFY.split("-")[0], 10);
      const currentDateFrom = `${currentFYStartYear}0401`;
      const prevFY = `${currentFYStartYear - 1}-${currentFYStartYear}`;
      const prevDateFrom = `${currentFYStartYear - 1}0401`;

      const [currentRes, prevRes] = await Promise.all([
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, ytdExtraFilters)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesYtdPayload(prevFY, prevDateFrom, prevDateTo, ytdExtraFilters)
        ),
      ]);

      setYtdSummaries(buildYtdSummaries(currentRes.data, prevRes.data));
    } catch {
      setYtdSummaries([]);
    } finally {
      setYtdLoading(false);
    }
  }, [displayCurrentFY, ytdExtraFilters]);

  // Reset cache when FY or filters change
  useEffect(() => { setYtdSummaries(null); }, [displayCurrentFY, ytdExtraFiltersKey]);

  // Auto-fetch when activated
  useEffect(() => {
    if (ytdActive && ytdSummaries === null && !ytdLoading) void fetchYtd();
  }, [ytdActive, ytdSummaries, ytdLoading, fetchYtd]);

  const activeSummaries = ytdActive ? (ytdSummaries ?? []) : summaries;
  const isActiveLoading  = ytdActive ? ytdLoading : loading;
  const subtitle = ytdActive
    ? `YTD · ${displayCurrentFY} vs prev year`
    : `Curr vs Hist · ${displayCurrentFY}`;

  return (
    <PanelShell
      icon={<Building2 className="h-4 w-4" />}
      title="Company Net Weight"
      subtitle={subtitle}
      action={
        <div className="flex items-center gap-1.5">
          {/* YTD toggle button */}
          <button
            type="button"
            disabled={ytdLoading}
            onClick={() => onYtdChange(!ytdActive)}
            className={`flex items-center gap-0.5 rounded border px-1.5 py-px text-[9px] font-semibold transition-colors disabled:opacity-50
              ${ytdActive
                ? "border-blue-400 bg-blue-100 text-blue-700"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
          >
            {ytdLoading
              ? <Loader2 className="h-2 w-2 animate-spin" />
              : <span>YTD</span>
            }
          </button>

          {/* Refresh button — refreshes YTD when in YTD mode, else normal data */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Refresh"
            disabled={isActiveLoading || refreshing}
            onClick={ytdActive ? () => void fetchYtd() : onRefresh}
            className="h-7 w-7 shrink-0 rounded-md border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3 w-3 ${(refreshing || ytdLoading) ? "animate-spin" : ""}`} />
          </Button>
        </div>
      }
      fillHeight
    >
      {isActiveLoading ? (
        <LoadingBlock fill />
      ) : activeSummaries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-4 text-center text-sm text-slate-500">
          {ytdActive ? "No YTD data available." : "No company data available."}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {!ytdActive && refreshing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
              <Loader2 className={LUBES_UI.loader} />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-5">
              {activeSummaries.map((summary) => (
                <CompanySummaryCard key={summary.company} summary={summary} />
              ))}
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  );
};

export default CompanyNetWeightPanel;
