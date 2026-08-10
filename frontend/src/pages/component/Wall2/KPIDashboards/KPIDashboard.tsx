import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import LPGOperationsTopFilterBar from "../../LPG/Plant/LPGOperations/LPGOperationsTopFilterBar";
import { useLPGOperationsFilters } from "../../LPG/Plant/LPGOperations/useLPGOperationsFilters";
import PerformanceScoreTrend from "./PerformanceScoreTrend";
import TasR3R1TrendCharts from "./TasR3R1TrendCharts";
import KpiDashboardLocationDropdowns from "./KpiDashboardLocationDropdowns";
import { mergeKpiTicketingCrossFilters } from "./kpiDashboardMergeCrossFilters";

/** Loaded after idle so the performance score chart can fetch and paint first (LPG KPI only). */
const LPGOPDailyProductivitytrend = lazy(() => import("../../LPG/Plant/LPGOperations/LPGOPDailyProductivitytrend"));
const PlantMonthAnalysisNew = lazy(() =>
  import("../../LPG/Plant/LPGOperations/PlantMonthAnalysisNew").then((m) => ({ default: m.PlantMonthAnalysisNew }))
);
const LpgPlantsInsightsCharts = lazy(() => import("./LpgPlantsInsightsCharts"));

const KPI_BU_CONFIG = {
  tas: { bu: "TAS" as const, chartTitle: "TAS Performance Score Index Trend" },
  lpg: { bu: "LPG" as const, chartTitle: "LPG Performance Score Index Trend" },
};

const chartSuspenseFallback = (
  <div className="flex items-center justify-center min-h-[120px] text-sm text-gray-500 border border-dashed border-gray-200 rounded-md bg-gray-50/80">
    Loading chart…
  </div>
);

const KPIDashboard = () => {
  const { bu: buParam } = useParams<{ bu: string }>();
  const key = buParam?.toLowerCase() as keyof typeof KPI_BU_CONFIG;
  const config = KPI_BU_CONFIG[key];

  const f = useLPGOperationsFilters({ defaultTimePreset: "15d" });

  const [kpiTicketingZone, setKpiTicketingZone] = useState<string | null>(null);
  const [kpiTicketingSapId, setKpiTicketingSapId] = useState<string | null>(null);

  const handleKpiLocationChange = useCallback((sel: { zone: string | null; sapId: string | null }) => {
    setKpiTicketingZone(sel.zone);
    setKpiTicketingSapId(sel.sapId);
  }, []);

  const mergedCrossFilters = useMemo(
    () => mergeKpiTicketingCrossFilters(f.crossFilters, kpiTicketingZone, kpiTicketingSapId),
    [f.crossFilters, kpiTicketingZone, kpiTicketingSapId]
  );

  /** Mount secondary LPG blocks after first paint / idle so APIs for productivity + plant month do not compete with performance score. */
  const [loadLpgSecondaryCharts, setLoadLpgSecondaryCharts] = useState(false);

  useEffect(() => {
    if (config.bu !== "LPG") {
      setLoadLpgSecondaryCharts(false);
      return;
    }
    let cancelled = false;
    const run = () => {
      if (!cancelled) setLoadLpgSecondaryCharts(true);
    };
    let idleId: number | undefined;
    let timeoutId: number | undefined;

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout: 1500 });
    } else if (typeof window !== "undefined") {
      timeoutId = window.setTimeout(run, 400);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [config.bu]);

  if (!config) {
    return <Navigate to="/kpi-dashboards/lpg" replace />;
  }

  return (
    <div className="space-y-2 bg-white p-1">
      <div className="sticky top-0 z-30 -mx-1 px-1 bg-white pb-1 border-b border-gray-100 shadow-sm">
        <LPGOperationsTopFilterBar
          beforeFilters={
            <KpiDashboardLocationDropdowns bu={config.bu} layout="toolbar" onSelectionChange={handleKpiLocationChange} />
          }
          filterOptions={f.filterOptions}
          filterData={f.filterData}
          selectedFilters={f.selectedFilters}
          isLoadingFilters={f.isLoadingFilters}
          onFilterChange={f.handleFilterChange}
          fromDate={f.fromDate}
          toDate={f.toDate}
          onFromDateChange={(date) => f.handleDateChange("from", date)}
          onToDateChange={(date) => f.handleDateChange("to", date)}
          timeRangePreset={f.timeRangePreset}
          onApplyTimeRangePreset={f.applyTimeRangePreset}
          onResetFilters={f.resetFilters}
          hiddenFilterKeys={["zone", "plant", "carousel_type"]}
        />
      </div>
      <PerformanceScoreTrend
        key={config.bu}
        bu={config.bu}
        chartTitle={config.chartTitle}
        filters={f.activeFilters}
        crossFilters={mergedCrossFilters}
        timeRangePreset={f.timeRangePreset}
      />
      {config.bu === "TAS" && <TasR3R1TrendCharts crossFilters={mergedCrossFilters} />}
      {config.bu === "LPG" && loadLpgSecondaryCharts && (
        <>
          <Suspense fallback={chartSuspenseFallback}>
            <LPGOPDailyProductivitytrend
              activeFilters={f.activeFilters}
              crossFilters={mergedCrossFilters}
              onResetFilters={f.resetFilters}
            />
          </Suspense>
          <Suspense fallback={chartSuspenseFallback}>
            <LpgPlantsInsightsCharts crossFilters={mergedCrossFilters} />
          </Suspense>
          <Suspense fallback={chartSuspenseFallback}>
            <PlantMonthAnalysisNew costChartsOnly isCardExpanded={false} />
          </Suspense>
        </>
      )}
    </div>
  );
};

export default KPIDashboard;
