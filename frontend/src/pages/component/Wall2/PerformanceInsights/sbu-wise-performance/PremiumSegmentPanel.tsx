import React, { useCallback, useEffect, useState } from "react";
import { Gem, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type { PeriodCardItem } from "./lubesSalesPerformance.types";
import {
  ghostIconButtonClass,
  LoadingBlock,
  PanelShell,
} from "./lubesSalesPerformance.shared";
import {
  buildLubesPremiumSegmentYtdPayload,
  buildPremiumSegmentYtdCardItems,
  formatPct,
  formatTmtSmart,
} from "./lubesSalesPerformance.utils";
import { LUBES_UI } from "./lubesSalesPerformance.theme";
import { apiClient } from "@/services/apiClient";

export type PremiumSegmentPanelProps = {
  loading: boolean;
  refreshing: boolean;
  premiumCardItems: PeriodCardItem[];
  selectedPremiumSegmentId?: string;
  drillActive: boolean;
  displayCurrentFY: string;
  /** Controlled YTD toggle — owned by parent so drilldown panel can react to the same state */
  ytdActive: boolean;
  ytdExtraFilters?: Record<string, string[]>;
  ytdExtraFiltersKey?: string;
  onYtdChange: (active: boolean) => void;
  onSelectPremiumSegment: (segmentId: string) => void;
  onRefresh: () => void;
  drilldown?: React.ReactNode;
};

const PremiumSegmentCard: React.FC<{
  item: PeriodCardItem;
  selected: boolean;
  onClick: () => void;
}> = ({ item, selected, onClick }) => {
  const current = formatTmtSmart(item.compare.current);
  const hist = formatTmtSmart(item.compare.hist);
  const pctClass =
    item.compare.pct > 0
      ? "text-emerald-600"
      : item.compare.pct < 0
        ? "text-rose-600"
        : "text-slate-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
        selected
          ? "border-slate-400 bg-slate-50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
      title={`${item.label} · Curr ${current} · Hist ${hist} · Growth ${formatPct(item.compare.pct)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="block truncate text-[12px] font-semibold text-slate-900">
              {item.label}
            </span>
          </div>
          <span className="mt-0.5 inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600">
            Premium
          </span>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold tabular-nums ${pctClass}`}>
          {item.compare.pct > 0 ? "+" : ""}
          {Math.round(item.compare.pct)}%
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Curr <span className="font-semibold text-slate-900">{current}</span>
        </span>
        <span>
          Hist <span className="font-semibold text-slate-700">{hist}</span>
        </span>
      </div>
    </button>
  );
};

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const PremiumSegmentPanel: React.FC<PremiumSegmentPanelProps> = ({
  loading,
  refreshing,
  premiumCardItems,
  selectedPremiumSegmentId,
  drillActive,
  displayCurrentFY,
  ytdActive,
  ytdExtraFilters = {},
  ytdExtraFiltersKey = "",
  onYtdChange,
  onSelectPremiumSegment,
  onRefresh,
  drilldown,
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
          buildLubesPremiumSegmentYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, ytdExtraFilters)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesPremiumSegmentYtdPayload(prevFY, prevDateFrom, prevDateTo, ytdExtraFilters)
        ),
      ]);

      setYtdCardItems(buildPremiumSegmentYtdCardItems(currentRes.data, prevRes.data));
    } catch {
      setYtdCardItems([]);
    } finally {
      setYtdLoading(false);
    }
  }, [displayCurrentFY, ytdExtraFilters]);

  useEffect(() => {
    setYtdCardItems(null);
  }, [displayCurrentFY, ytdExtraFiltersKey]);

  // Fetch YTD when activated (and not yet loaded)
  useEffect(() => {
    if (ytdActive && ytdCardItems === null && !ytdLoading) {
      void fetchYtd();
    }
  }, [ytdActive, ytdCardItems, ytdLoading, fetchYtd]);

  const activeItems = ytdActive ? (ytdCardItems ?? []) : premiumCardItems;
  const isActiveLoading = ytdActive ? ytdLoading : loading;

  return (
    <PanelShell
      icon={<Gem className="h-4 w-4" />}
      title="Premium Segment"
      subtitle={
        ytdActive
          ? `YTD · ${displayCurrentFY} vs prev year`
          : "Premium-only segments · choose a card to drill into items"
      }
      action={
        <div className="flex items-center gap-1.5">
          {/* YTD toggle — also drives the drilldown panel */}
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

          {/* Refresh — context-aware */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh premium segment data"
            disabled={isActiveLoading || refreshing}
            onClick={ytdActive ? () => void fetchYtd() : onRefresh}
            className={ghostIconButtonClass}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(refreshing || ytdLoading) ? "animate-spin" : ""}`} />
          </Button>
        </div>
      }
      denseHeader
      className="border-slate-200 bg-white"
    >
      {isActiveLoading ? (
        <LoadingBlock />
      ) : activeItems.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-500">
          {ytdActive ? "No YTD premium segment data available." : "No premium segment data available."}
        </div>
      ) : (
        <div className="relative">
          {!ytdActive && refreshing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
              <Loader2 className={LUBES_UI.loader} />
            </div>
          )}

          <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
            {activeItems.map((item) => (
              <PremiumSegmentCard
                key={item.id}
                item={item}
                selected={drillActive && selectedPremiumSegmentId === item.id}
                onClick={() => onSelectPremiumSegment(item.id)}
              />
            ))}
          </div>

          {/* Always render drilldown — it also reacts to ytdActive */}
          {drilldown ? <div className="mt-3">{drilldown}</div> : null}
        </div>
      )}
    </PanelShell>
  );
};

export default PremiumSegmentPanel;
