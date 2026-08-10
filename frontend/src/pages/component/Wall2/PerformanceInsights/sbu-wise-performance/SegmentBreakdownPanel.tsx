import React, { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type { PeriodCardItem } from "./lubesSalesPerformance.types";
import {
  ghostIconButtonClass,
  LoadingBlock,
  PanelShell,
  PeriodSummaryCard,
} from "./lubesSalesPerformance.shared";
import { LUBES_UI } from "./lubesSalesPerformance.theme";
import { apiClient } from "@/services/apiClient";
import {
  buildLubesSegmentYtdPayload,
  buildSegmentYtdCardItems,
} from "./lubesSalesPerformance.utils";

export type SegmentBreakdownPanelProps = {
  loading: boolean;
  refreshing: boolean;
  segmentCardItems: PeriodCardItem[];
  appliedSegments: string[];
  displayCurrentFY: string;
  ytdActive: boolean;
  ytdExtraFilters?: Record<string, string[]>;
  ytdExtraFiltersKey?: string;
  onYtdChange: (active: boolean) => void;
  onToggleSegment: (segment: string) => void;
  onRefresh: () => void;
};

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const SegmentBreakdownPanel: React.FC<SegmentBreakdownPanelProps> = ({
  loading,
  refreshing,
  segmentCardItems,
  appliedSegments,
  displayCurrentFY,
  ytdActive,
  ytdExtraFilters = {},
  ytdExtraFiltersKey = "",
  onYtdChange,
  onToggleSegment,
  onRefresh,
}) => {
  const [ytdLoading, setYtdLoading] = useState(false);
  const [ytdCardItems, setYtdCardItems] = useState<PeriodCardItem[] | null>(null);

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
          buildLubesSegmentYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, ytdExtraFilters)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesSegmentYtdPayload(prevFY, prevDateFrom, prevDateTo, ytdExtraFilters)
        ),
      ]);

      setYtdCardItems(buildSegmentYtdCardItems(currentRes.data, prevRes.data));
    } catch {
      setYtdCardItems([]);
    } finally {
      setYtdLoading(false);
    }
  }, [displayCurrentFY, ytdExtraFilters]);

  useEffect(() => { setYtdCardItems(null); }, [displayCurrentFY, ytdExtraFiltersKey]);

  // Auto-fetch when activated
  useEffect(() => {
    if (ytdActive && ytdCardItems === null && !ytdLoading) void fetchYtd();
  }, [ytdActive, ytdCardItems, ytdLoading, fetchYtd]);

  const activeItems = ytdActive ? (ytdCardItems ?? []) : segmentCardItems;
  const isActiveLoading = ytdActive ? ytdLoading : loading;

  return (
    <PanelShell
      icon={<Layers className="h-4 w-4" />}
      title="Segment Breakdown"
      subtitle={ytdActive ? `YTD · ${displayCurrentFY} vs prev year` : undefined}
      action={
        <div className="flex items-center gap-1.5">
          {/* YTD toggle */}
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

          {/* Refresh — refreshes YTD when in YTD mode, else normal data */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh segment data"
            disabled={isActiveLoading || refreshing}
            onClick={ytdActive ? () => void fetchYtd() : onRefresh}
            className={ghostIconButtonClass}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(refreshing || ytdLoading) ? "animate-spin" : ""}`} />
          </Button>
        </div>
      }
    >
      {isActiveLoading ? (
        <LoadingBlock />
      ) : activeItems.length === 0 ? (
        <div className="py-4 text-center text-sm text-slate-500">
          {ytdActive ? "No YTD segment data available." : "No segment breakdown data available."}
        </div>
      ) : (
        <div className="relative w-full">
          {!ytdActive && refreshing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
              <Loader2 className={LUBES_UI.loader} />
            </div>
          )}
          <div className="grid w-full grid-cols-5 gap-2">
            {activeItems.map((item) => (
              <PeriodSummaryCard
                key={item.id}
                item={item}
                highlighted={appliedSegments.includes(item.id)}
                onClick={() => onToggleSegment(item.id)}
                variant="segment"
              />
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
};

export default SegmentBreakdownPanel;
