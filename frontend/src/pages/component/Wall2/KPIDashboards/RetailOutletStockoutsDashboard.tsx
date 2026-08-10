import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Loader2, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import LPGOperationsTopFilterBar from "../../LPG/Plant/LPGOperations/LPGOperationsTopFilterBar";
import { useLPGOperationsFilters } from "../../LPG/Plant/LPGOperations/useLPGOperationsFilters";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";
import {
  RETAIL_OUTLET_STOCKOUTS_API,
  RETAIL_OUTLET_STOCKOUTS_ACTION,
  RETAIL_OUTLET_STOCKOUT_DISTRIBUTION_ACTION,
  type RetailOutletStockoutsApiResponse,
  type RetailOutletStockoutsBinaryApiResponse,
} from "./retailOutletStockouts.api.example";
import RetailOutletStockoutsAm3BarChart from "./RetailOutletStockoutsAm3BarChart";
import RetailOutletStockoutsAm3BarChartBinary from "./RetailOutletStockoutsAm3BarChartBinary";
import RetailOutletStockoutsAm3PieChart from "./RetailOutletStockoutsAm3PieChart";
import NozzleSalesTmtTrendCharts from "./NozzleSalesTmtTrendCharts";
import LossOfSalesVolumeChart from "./LossOfSalesVolumeChart";
import KpiDashboardLocationDropdowns from "./KpiDashboardLocationDropdowns";
import { mergeKpiTicketingCrossFilters } from "./kpiDashboardMergeCrossFilters";
import { cn } from "@/@/lib/utils";

/** Retail stockouts chart palette. */
const COLORS_DIST = {
  without: "#9FDEF1",
  partial: "#B9E52F",
  full: "#2A5D78",
} as const;

const COLORS_BINARY = {
  without: "#9FDEF1",
  with: "#2A5D78",
} as const;

const STOCKOUTS_CHART_CARD =
  "border border-gray-200 bg-white shadow-sm";

type StockoutsExpandedCard = "distPie" | "distBar" | "binaryPie" | "binaryBar";

/** Same as `NozzleSalesTmtTrendCharts` refresh / maximize toolbar buttons. */
function StockoutsChartHeaderActions(props: {
  onRefresh: () => void;
  refreshDisabled: boolean;
  refreshSpin: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { onRefresh, refreshDisabled, refreshSpin, isExpanded, onToggleExpand } = props;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        onClick={onRefresh}
        disabled={refreshDisabled}
        className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        title="Refresh"
      >
        <RotateCcw className={cn("h-4 w-4", refreshSpin && "animate-spin")} />
      </Button>
      <Button
        type="button"
        onClick={onToggleExpand}
        className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
        title={isExpanded ? "Minimize" : "Maximize"}
      >
        {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function isNoDataResponse(raw: unknown): boolean {
  const check = (o: Record<string, unknown>) =>
    o.status === true && String(o.message ?? "").trim() === "No Data";
  if (raw != null && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (check(o)) return true;
    if (o.data && typeof o.data === "object") {
      return check(o.data as Record<string, unknown>);
    }
  }
  return false;
}

function unwrapDistributionPayload(res: unknown): RetailOutletStockoutsApiResponse | null {
  if (res == null || typeof res !== "object") return null;
  const o = res as Record<string, unknown>;
  const sum = o.summary;
  if (
    sum &&
    typeof sum === "object" &&
    "partial_dryouts" in sum &&
    "zones" in o &&
    Array.isArray(o.zones)
  ) {
    return o as unknown as RetailOutletStockoutsApiResponse;
  }
  if (o.data && typeof o.data === "object") {
    const inner = o.data as Record<string, unknown>;
    const s2 = inner.summary;
    if (
      s2 &&
      typeof s2 === "object" &&
      "partial_dryouts" in s2 &&
      "zones" in inner &&
      Array.isArray(inner.zones)
    ) {
      return inner as unknown as RetailOutletStockoutsApiResponse;
    }
  }
  return null;
}

function unwrapBinaryPayload(res: unknown): RetailOutletStockoutsBinaryApiResponse | null {
  if (res == null || typeof res !== "object") return null;
  const o = res as Record<string, unknown>;
  const s = o.summary;
  if (
    s &&
    typeof s === "object" &&
    "with_dryouts" in s &&
    !("partial_dryouts" in s) &&
    Array.isArray(o.zones)
  ) {
    return o as unknown as RetailOutletStockoutsBinaryApiResponse;
  }
  if (o.data && typeof o.data === "object") {
    const inner = o.data as Record<string, unknown>;
    const s2 = inner.summary;
    if (
      s2 &&
      typeof s2 === "object" &&
      "with_dryouts" in s2 &&
      !("partial_dryouts" in s2) &&
      Array.isArray(inner.zones)
    ) {
      return inner as unknown as RetailOutletStockoutsBinaryApiResponse;
    }
  }
  return null;
}

const RetailOutletStockoutsDashboard: React.FC = () => {
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

  const [distData, setDistData] = useState<RetailOutletStockoutsApiResponse | null>(null);
  const [distNoData, setDistNoData] = useState(false);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState<string | null>(null);

  const [binaryData, setBinaryData] = useState<RetailOutletStockoutsBinaryApiResponse | null>(null);
  const [binaryNoData, setBinaryNoData] = useState(false);
  const [binaryLoading, setBinaryLoading] = useState(false);
  const [binaryError, setBinaryError] = useState<string | null>(null);
  const [expandedStockoutsCard, setExpandedStockoutsCard] = useState<StockoutsExpandedCard | null>(null);

  const crossFiltersRef = useRef(mergedCrossFilters);
  crossFiltersRef.current = mergedCrossFilters;

  const bodyBase = useMemo(
    () => ({
      filters: [] as unknown[],
      cross_filters: mergedCrossFilters,
      drill_state: "",
    }),
    [mergedCrossFilters]
  );

  const fetchDistributionStockouts = useCallback(async () => {
    setDistLoading(true);
    setDistError(null);
    setDistNoData(false);
    try {
      const resDist = await apiClient.post(RETAIL_OUTLET_STOCKOUTS_API, {
        ...bodyBase,
        action: RETAIL_OUTLET_STOCKOUT_DISTRIBUTION_ACTION,
      });
      const rawDist = resDist?.data ?? resDist;
      const failDist =
        rawDist != null && typeof rawDist === "object" && (rawDist as Record<string, unknown>).status === false;

      if (failDist) {
        setDistData(null);
        setDistError(String((rawDist as Record<string, unknown>).message ?? "Distribution request failed"));
      } else if (isNoDataResponse(rawDist)) {
        setDistData(null);
        setDistNoData(true);
      } else {
        const payload = unwrapDistributionPayload(rawDist);
        if (!payload?.summary || !Array.isArray(payload.zones)) {
          setDistError("Invalid distribution response");
          setDistData(null);
        } else {
          setDistData(payload);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load distribution stockouts";
      setDistError(msg);
      setDistData(null);
    } finally {
      setDistLoading(false);
    }
  }, [bodyBase]);

  const fetchBinaryStockouts = useCallback(async () => {
    setBinaryLoading(true);
    setBinaryError(null);
    setBinaryNoData(false);
    try {
      const resBinary = await apiClient.post(RETAIL_OUTLET_STOCKOUTS_API, {
        ...bodyBase,
        action: RETAIL_OUTLET_STOCKOUTS_ACTION,
      });
      const rawBin = resBinary?.data ?? resBinary;
      const failBin =
        rawBin != null && typeof rawBin === "object" && (rawBin as Record<string, unknown>).status === false;

      if (failBin) {
        setBinaryData(null);
        setBinaryError(String((rawBin as Record<string, unknown>).message ?? "Stockouts request failed"));
      } else if (isNoDataResponse(rawBin)) {
        setBinaryData(null);
        setBinaryNoData(true);
      } else {
        const payload = unwrapBinaryPayload(rawBin);
        if (!payload?.summary || !Array.isArray(payload.zones)) {
          setBinaryError("Invalid stockouts response");
          setBinaryData(null);
        } else {
          setBinaryData(payload);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load retail outlet stockouts";
      setBinaryError(msg);
      setBinaryData(null);
    } finally {
      setBinaryLoading(false);
    }
  }, [bodyBase]);

  const fetchStockouts = useCallback(async () => {
    await Promise.all([fetchDistributionStockouts(), fetchBinaryStockouts()]);
  }, [fetchDistributionStockouts, fetchBinaryStockouts]);

  useEffect(() => {
    if (crossFiltersRef.current.length === 0) {
      return;
    }
    void fetchStockouts();
  }, [fetchStockouts]);

  const zonesForBarDist = useMemo(
    () => (distData?.zones ?? []).filter((z) => String(z.zone_code).toUpperCase() !== "TOTAL"),
    [distData]
  );

  const pieSlicesDist = useMemo(
    () =>
      distData
        ? [
            {
              title: "ROs with no dryouts",
              value: distData.summary.without_dryouts.count,
              color: COLORS_DIST.without,
            },
            {
              title: "ROs with partial dryouts",
              value: distData.summary.partial_dryouts.count,
              color: COLORS_DIST.partial,
            },
            {
              title: "ROs with full dryouts",
              value: distData.summary.full_dryouts.count,
              color: COLORS_DIST.full,
            },
          ]
        : [],
    [distData]
  );

  const barChartDataDist = useMemo(
    () =>
      zonesForBarDist.map((z) => ({
        zone: z.zone_code,
        withoutPct: z.without_dryouts_pct,
        partialPct: z.partial_dryouts_pct,
        fullPct: z.full_dryouts_pct,
        withoutCount: z.without_dryouts_count,
        partialCount: z.partial_dryouts_count,
        fullCount: z.full_dryouts_count,
      })),
    [zonesForBarDist]
  );

  const zonesForBarBinary = useMemo(
    () => (binaryData?.zones ?? []).filter((z) => String(z.zone_code).toUpperCase() !== "TOTAL"),
    [binaryData]
  );

  const pieSlicesBinary = useMemo(
    () =>
      binaryData
        ? [
            {
              title: "ROs without dryouts",
              value: binaryData.summary.without_dryouts.count,
              color: COLORS_BINARY.without,
            },
            {
              title: "ROs with dryouts",
              value: binaryData.summary.with_dryouts.count,
              color: COLORS_BINARY.with,
            },
          ]
        : [],
    [binaryData]
  );

  const barChartDataBinary = useMemo(
    () =>
      zonesForBarBinary.map((z) => ({
        zone: z.zone_code,
        withoutPct: z.without_dryouts_pct,
        withPct: z.with_dryouts_pct,
        withoutCount: z.without_dryouts_count,
        withCount: z.with_dryouts_count,
      })),
    [zonesForBarBinary]
  );

  const periodLabel =
    f.fromDate && f.toDate
      ? `${f.formatDateToString(f.fromDate)} – ${f.formatDateToString(f.toDate)}`
      : "—";

  const totalRosDist =
    distData != null
      ? distData.summary.without_dryouts.count +
        distData.summary.partial_dryouts.count +
        distData.summary.full_dryouts.count
      : null;

  const totalRosBinary =
    binaryData != null
      ? binaryData.summary.without_dryouts.count + binaryData.summary.with_dryouts.count
      : null;

  const awaitingDateFilter = mergedCrossFilters.length === 0;

  const renderDistPieBody = () => {
    if (distLoading) {
      return (
        <div className="flex h-full min-h-[280px] items-center justify-center gap-2 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      );
    }
    if (distError) {
      return (
        <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-red-600">
          {distError}
        </div>
      );
    }
    if (distNoData || pieSlicesDist.length === 0) {
      if (awaitingDateFilter) {
        return (
          <div className="flex h-full min-h-[240px] items-center justify-center px-4 text-center text-sm text-gray-500">
            Waiting for date range…
          </div>
        );
      }
      return <NoDataDisplay />;
    }
    return <RetailOutletStockoutsAm3PieChart data={pieSlicesDist} />;
  };

  const renderDistBarBody = () => {
    if (distLoading) {
      return (
        <div className="flex h-full min-h-[300px] items-center justify-center gap-2 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      );
    }
    if (distError) {
      return (
        <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-red-600">
          {distError}
        </div>
      );
    }
    if (distNoData || barChartDataDist.length === 0) {
      if (awaitingDateFilter) {
        return (
          <div className="flex h-full min-h-[400px] items-center justify-center px-4 text-center text-sm text-gray-500">
            Waiting for date range…
          </div>
        );
      }
      return <NoDataDisplay />;
    }
    return <RetailOutletStockoutsAm3BarChart data={barChartDataDist} />;
  };

  const renderBinaryPieBody = () => {
    if (binaryLoading) {
      return (
        <div className="flex h-full min-h-[280px] items-center justify-center gap-2 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      );
    }
    if (binaryError) {
      return (
        <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-red-600">
          {binaryError}
        </div>
      );
    }
    if (binaryNoData || pieSlicesBinary.length === 0) {
      if (awaitingDateFilter) {
        return (
          <div className="flex h-full min-h-[240px] items-center justify-center px-4 text-center text-sm text-gray-500">
            Waiting for date range…
          </div>
        );
      }
      return <NoDataDisplay />;
    }
    return <RetailOutletStockoutsAm3PieChart data={pieSlicesBinary} />;
  };

  const renderBinaryBarBody = () => {
    if (binaryLoading) {
      return (
        <div className="flex h-full min-h-[400px] items-center justify-center gap-2 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      );
    }
    if (binaryError) {
      return (
        <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-red-600">
          {binaryError}
        </div>
      );
    }
    if (binaryNoData || barChartDataBinary.length === 0) {
      if (awaitingDateFilter) {
        return (
          <div className="flex h-full min-h-[400px] items-center justify-center px-4 text-center text-sm text-gray-500">
            Waiting for date range…
          </div>
        );
      }
      return <NoDataDisplay />;
    }
    return <RetailOutletStockoutsAm3BarChartBinary data={barChartDataBinary} />;
  };

  const chartAreaClass = (id: StockoutsExpandedCard) =>
    expandedStockoutsCard === id
      ? "relative h-[calc(100vh-8rem)] min-h-[400px] w-full flex-1 p-0"
      : "relative h-[min(40vh,420px)] w-full min-h-[300px] p-0";

  return (
    <div className="space-y-2 bg-white p-1 min-h-0">
      {expandedStockoutsCard && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setExpandedStockoutsCard(null)}
          aria-hidden
        />
      )}
      <div className="sticky top-0 z-30 -mx-1 px-1 bg-white pb-1 border-b border-gray-100 shadow-sm">
        <LPGOperationsTopFilterBar
          beforeFilters={
            <KpiDashboardLocationDropdowns bu="RO" layout="toolbar" onSelectionChange={handleKpiLocationChange} />
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
      <LossOfSalesVolumeChart crossFilters={mergedCrossFilters} />
      <div className="flex w-full flex-col gap-1">
      <div className="grid grid-cols-10 gap-2">
  {/* 30% */}
  <div className="col-span-3">
    <Card
      className={`flex w-full min-h-0 flex-col p-0 ${STOCKOUTS_CHART_CARD} ${
        expandedStockoutsCard === "distPie" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
      }`}
    >
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-slate-800 pr-1">
            Retail Outlet Stockouts Distribution
          </CardTitle>
          <StockoutsChartHeaderActions
            onRefresh={() => void fetchDistributionStockouts()}
            refreshDisabled={distLoading || awaitingDateFilter}
            refreshSpin={distLoading}
            isExpanded={expandedStockoutsCard === "distPie"}
            onToggleExpand={() =>
              setExpandedStockoutsCard((c) => (c === "distPie" ? null : "distPie"))
            }
          />
        </div>
      </CardHeader>
      <CardContent
        className={`flex flex-col pt-0 p-0 ${
          expandedStockoutsCard === "distPie" ? "min-h-0 flex-1 overflow-hidden" : "min-h-[min(40vh,420px)]"
        }`}
      >
        <div className={chartAreaClass("distPie")}>{renderDistPieBody()}</div>
      </CardContent>
    </Card>
  </div>

  {/* 70% */}
  <div className="col-span-7">
    <Card
      className={`flex w-full min-h-0 flex-col ${STOCKOUTS_CHART_CARD} ${
        expandedStockoutsCard === "distBar" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
      }`}
    >
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-slate-800 pr-1">
            Zone-wise Retail Outlet Stockouts Distribution
          </CardTitle>
          <StockoutsChartHeaderActions
            onRefresh={() => void fetchDistributionStockouts()}
            refreshDisabled={distLoading || awaitingDateFilter}
            refreshSpin={distLoading}
            isExpanded={expandedStockoutsCard === "distBar"}
            onToggleExpand={() =>
              setExpandedStockoutsCard((c) => (c === "distBar" ? null : "distBar"))
            }
          />
        </div>
      </CardHeader>
      <CardContent
        className={`flex flex-col pt-0 p-0 ${
          expandedStockoutsCard === "distBar" ? "min-h-0 flex-1 overflow-hidden" : "min-h-[min(40vh,420px)]"
        }`}
      >
        <div className={chartAreaClass("distBar")}>{renderDistBarBody()}</div>
      </CardContent>
    </Card>
  </div>
</div>
<div className="grid grid-cols-10 gap-2">
  {/* 30% */}
  <div className="col-span-3">
    <Card
      className={`flex w-full min-h-0 flex-col p-0 ${STOCKOUTS_CHART_CARD} ${
        expandedStockoutsCard === "binaryPie" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
      }`}
    >
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-slate-800 pr-1">Retail Outlet Stockouts</CardTitle>
          <StockoutsChartHeaderActions
            onRefresh={() => void fetchBinaryStockouts()}
            refreshDisabled={binaryLoading || awaitingDateFilter}
            refreshSpin={binaryLoading}
            isExpanded={expandedStockoutsCard === "binaryPie"}
            onToggleExpand={() =>
              setExpandedStockoutsCard((c) => (c === "binaryPie" ? null : "binaryPie"))
            }
          />
        </div>
      </CardHeader>
      <CardContent
        className={`flex flex-col pt-0 p-0 ${
          expandedStockoutsCard === "binaryPie" ? "min-h-0 flex-1 overflow-hidden" : "min-h-[min(40vh,420px)]"
        }`}
      >
        <div className={chartAreaClass("binaryPie")}>{renderBinaryPieBody()}</div>
      </CardContent>
    </Card>
  </div>

  {/* 70% */}
  <div className="col-span-7">
    <Card
      className={`flex w-full min-h-0 flex-col ${STOCKOUTS_CHART_CARD} ${
        expandedStockoutsCard === "binaryBar" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
      }`}
    >
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-slate-800 pr-1">
            Zone-wise Retail Outlet Stockouts
          </CardTitle>
          <StockoutsChartHeaderActions
            onRefresh={() => void fetchBinaryStockouts()}
            refreshDisabled={binaryLoading || awaitingDateFilter}
            refreshSpin={binaryLoading}
            isExpanded={expandedStockoutsCard === "binaryBar"}
            onToggleExpand={() =>
              setExpandedStockoutsCard((c) => (c === "binaryBar" ? null : "binaryBar"))
            }
          />
        </div>
      </CardHeader>
      <CardContent
        className={`flex flex-col pt-0 p-0 ${
          expandedStockoutsCard === "binaryBar" ? "min-h-0 flex-1 overflow-hidden" : "min-h-[min(40vh,420px)]"
        }`}
      >
        <div className={chartAreaClass("binaryBar")}>{renderBinaryBarBody()}</div>
      </CardContent>
    </Card>
  </div>
</div>
        <NozzleSalesTmtTrendCharts crossFilters={mergedCrossFilters} />
      </div>
    </div>
  );
};

export default RetailOutletStockoutsDashboard;
