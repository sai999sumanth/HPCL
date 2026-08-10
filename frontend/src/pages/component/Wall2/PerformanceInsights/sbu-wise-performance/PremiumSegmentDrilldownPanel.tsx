import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Gem } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import type { LubesItemCategoryRow } from "./lubesSalesPerformance.types";
import ItemCategoryBreakdownPanel from "./ItemCategoryBreakdownPanel";
import {
  buildLubesItemCategoryPayload,
  buildLubesItemCategoryYtdPayload,
  mapLubesItemCategoryRows,
  normalizeAggregationRows,
} from "./lubesSalesPerformance.utils";

export type PremiumSegmentDrilldownPanelProps = {
  loading: boolean;
  refreshing: boolean;
  fiscalYears: string[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  premiumSegmentName: string;
  /** Shared with PremiumSegmentPanel — when true, show YTD data here too */
  ytdActive: boolean;
  getBaseFilters: () => Record<string, string[]>;
  filtersKey: string;
  onExitDrilldown: () => void;
  onRefresh: () => void;
};

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const PremiumSegmentDrilldownPanel: React.FC<PremiumSegmentDrilldownPanelProps> = ({
  loading,
  refreshing,
  fiscalYears,
  displayCurrentFY,
  displayPreviousFY,
  premiumSegmentName,
  ytdActive,
  getBaseFilters,
  filtersKey,
  onExitDrilldown,
  onRefresh,
}) => {
  const [itemCategoryRows, setItemCategoryRows] = useState<LubesItemCategoryRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const [ytdLoading, setYtdLoading] = useState(false);
  const [ytdRows, setYtdRows] = useState<LubesItemCategoryRow[] | null>(null);

  const fetchItemData = useCallback(async () => {
    setDrillLoading(true);
    try {
      const response = await apiClient.post(
        "/api/tableanalytics/generate_data_aggregations",
        buildLubesItemCategoryPayload(fiscalYears, {
          ...getBaseFilters(),
          PREMIUM_SEGMENT: [premiumSegmentName],
        })
      );
      setItemCategoryRows(mapLubesItemCategoryRows(normalizeAggregationRows(response.data)));
    } catch {
      setItemCategoryRows([]);
    } finally {
      setDrillLoading(false);
    }
  }, [fiscalYears, getBaseFilters, premiumSegmentName]);

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

      const extraFilters = { ...getBaseFilters(), PREMIUM_SEGMENT: [premiumSegmentName] };

      const [currentRes, prevRes] = await Promise.all([
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesItemCategoryYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, extraFilters)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesItemCategoryYtdPayload(prevFY, prevDateFrom, prevDateTo, extraFilters)
        ),
      ]);

      setYtdRows([
        ...mapLubesItemCategoryRows(normalizeAggregationRows(currentRes.data)),
        ...mapLubesItemCategoryRows(normalizeAggregationRows(prevRes.data)),
      ]);
    } catch {
      setYtdRows([]);
    } finally {
      setYtdLoading(false);
    }
  }, [displayCurrentFY, getBaseFilters, premiumSegmentName]);

  useEffect(() => {
    void fetchItemData();
  }, [fetchItemData, filtersKey]);

  useEffect(() => {
    setYtdRows(null);
  }, [displayCurrentFY, premiumSegmentName, filtersKey]);

  // Auto-fetch YTD when the shared toggle turns on
  useEffect(() => {
    if (ytdActive && ytdRows === null && !ytdLoading) {
      void fetchYtd();
    }
  }, [ytdActive, ytdRows, ytdLoading, fetchYtd]);

  const activeRows = ytdActive ? (ytdRows ?? []) : itemCategoryRows;
  const isActiveLoading = loading || (ytdActive ? ytdLoading : drillLoading);

  const prevFY = `${parseInt(displayCurrentFY.split("-")[0], 10) - 1}-${parseInt(displayCurrentFY.split("-")[0], 10)}`;

  const backButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading || refreshing || drillLoading}
      onClick={onExitDrilldown}
      className="h-7 gap-1.5 rounded-md border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      <ArrowLeft className="h-3 w-3" />
      Back
    </Button>
  );

  return (
    <ItemCategoryBreakdownPanel
      loading={isActiveLoading}
      refreshing={refreshing}
      itemCategoryRows={activeRows}
      displayCurrentFY={displayCurrentFY}
      displayPreviousFY={ytdActive ? prevFY : displayPreviousFY}
      title="Premium Items"
      subtitle={
        ytdActive
          ? `YTD · ${displayCurrentFY} vs prev year · ${premiumSegmentName}`
          : `Premium Segment: ${premiumSegmentName} · Curr (${displayCurrentFY}) vs Hist (${displayPreviousFY})`
      }
      emptyMessage="No item data found for the selected premium segment."
      leadingAction={backButton}
      icon={<Gem className="h-4 w-4" />}
      onRefresh={() => {
        if (ytdActive) {
          void fetchYtd();
        } else {
          void fetchItemData();
          onRefresh();
        }
      }}
    />
  );
};

export default PremiumSegmentDrilldownPanel;
