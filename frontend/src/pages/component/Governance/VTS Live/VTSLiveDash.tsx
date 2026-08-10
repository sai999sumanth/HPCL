import { format, subDays, subWeeks, subMonths } from 'date-fns';
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from 'react-router-dom';
import { VTSLiveTable } from "./VTSLiveTable";
import ActionLinkCard from "../VTS Analytics/ActionLinkCard";
import MetricCard from "../VTS Analytics/MetricCard";
import ReusableFilterBar from "../VTS Analytics/ReusableFilterBar";
import { Loader2, TrendingUp } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import VTSVehicleAI from "../VTS/VTSVehicleAI";
import useAuthStore from "@/store/authStore";
// import { VTSLiveWRTable } from "./VTSLiveWRTable";
// import { VTSLiveTCTable } from "./VTSLiveTCTable";
import OngoingTripChartTable from "./OngoingTripChartTable";
import NonReportingDevicesTable from "./NonReportingDevicesTable";

export const VTSLiveDash = () => {
  const { user } = useAuthStore();
  const userBu = user?.bu;
  const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
  const isTasUser = Array.isArray(userBu) && userBu.includes('TAS');
  const hasUserBu = isLpgUser || isTasUser;

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBu, setSelectedBu] = useState(isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  // Initial state is set to '15D'
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>('15D');
  const [dateRangeFilter, setDateRangeFilter] = useState<any | null>(null);
  // const [isRefreshing, setIsRefreshing] = useState(true);
  // const [openDialog, setOpenDialog] = useState<null | { title: string; rows: any[]; cardType: string }>(null);

  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [tcInvoiceCount, setTcInvoiceCount] = useState<number | null>(null);
  const [tcInvoiceLoading, setTcInvoiceLoading] = useState(false);
  const [tcInvoiceError, setTcInvoiceError] = useState<string | null>(null);

  const [wrInvoiceCount, setWrInvoiceCount] = useState<number | null>(null);
  const [wrInvoiceLoading, setWrInvoiceLoading] = useState(false);
  const [wrInvoiceError, setWrInvoiceError] = useState<string | null>(null);

  const [hsInvoiceCount, setHsInvoiceCount] = useState<number | null>(null);
  const [hsInvoiceLoading, setHsInvoiceLoading] = useState(false);
  const [hsInvoiceError, setHsInvoiceError] = useState<string | null>(null);

  const [emLockInvoiceCount, setEmLockInvoiceCount] = useState<number | null>(null);
  const [emLockInvoiceLoading, setEmLockInvoiceLoading] = useState(false);
  const [emLockInvoiceError, setEmLockInvoiceError] = useState<string | null>(null);

  const [nonReportingCount, setNonReportingCount] = useState<number | null>(null);
  const [nonReportingLoading, setNonReportingLoading] = useState(false);
  const [nonReportingError, setNonReportingError] = useState<string | null>(null);

  // NEW: Add state for checkboxes
  const [isLiveChecked, setIsLiveChecked] = useState(true);
  const [isClosedChecked, setIsClosedChecked] = useState(false);

  const tableRef = useRef<HTMLDivElement | null>(null);
  const tcTableRef = useRef<HTMLDivElement | null>(null);
  const wrTableRef = useRef<HTMLDivElement | null>(null);
  const hsTableRef = useRef<HTMLDivElement | null>(null);
  const emLockTableRef = useRef<HTMLDivElement | null>(null);
  const nonReportingTableRef = useRef<HTMLDivElement | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Derive isRefreshing from individual loading states
  const isRefreshing = invoiceLoading || tcInvoiceLoading || wrInvoiceLoading || hsInvoiceLoading || emLockInvoiceLoading || nonReportingLoading;

  // UPDATED: Reset checkboxes on refresh
  const handleRefresh = () => {
    setSelectedBu('TAS');
    setSelectedZone(null);
    setSelectedPlant(null);
    setSelectedTimeFilter('1M');
    setDateRangeFilter(null);
    setIsLiveChecked(true);
    setIsClosedChecked(false);
    setRefreshKey(prev => prev + 1);
  };

  const getBaseFilters = useCallback(() => {
    const filters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
    if (selectedZone) filters.push({ key: "zone", cond: "equals", value: selectedZone });
    if (selectedPlant) filters.push({ key: "sap_id", cond: "equals", value: selectedPlant });
    return filters;
  }, [selectedBu, selectedZone, selectedPlant]);

  const onTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
    // Check if filter is a date range object
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      // This is a custom date range filter
      const dateRange = filter.value.split(',');
      if (dateRange.length === 2) {
        setDateRangeFilter({
          start: new Date(dateRange[0]),
          end: new Date(dateRange[1])
        });
        setSelectedTimeFilter(null); // Clear time filter when custom date is selected
      }
    } else {
      // This is a standard time filter
      setSelectedTimeFilter(filter as string | null);
      setDateRangeFilter(null); // Clear date range when time filter is selected
    }
  };

  const getCrossFilters = useCallback(() => {
    const crossFilters: any[] = [];
    const now = new Date();

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const computeDateRangeString = (): string => {
      if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
        return `${fmt(dateRangeFilter.start)},${fmt(dateRangeFilter.end)}`;
      }

      switch (selectedTimeFilter) {
        case 'TDY': return `${fmt(now)},${fmt(now)}`;
        case 'YDY': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
        case '1W': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
        case '15D': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
        case '1M': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
        case '3M': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }

        case 't': return `${fmt(now)},${fmt(now)}`;
        case '1d': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
        case '1w': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
        case '15d': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
        case '1m': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
        case '3m': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }

        default: return `${fmt(now)},${fmt(now)}`;
      }
    };

    const dateValue = computeDateRangeString();

    if (dateValue) {
      crossFilters.push({ key: 'DATE', cond: 'equals', value: dateValue });
    }

    return crossFilters;
  }, [selectedTimeFilter, dateRangeFilter]);

  const memoizedCrossFilters = useMemo(() => getCrossFilters(), [getCrossFilters]);

  // Fetch metric card counts via separate API calls with total_count: "true"
  const fetchMetricCount = useCallback(async (
    tripType: string,
    action: string,
    setCount: (c: number | null) => void,
    setLoading: (l: boolean) => void,
    setError: (e: string | null) => void,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const filters = getBaseFilters();
      const payload: any = {
        filters,
        action,
        cross_filters: memoizedCrossFilters,
        payload: {
          ...(action === "get_emlock_open_data" ? {} : { ongoing_trips_type: tripType }),
          status: isLiveChecked ? "live" : isClosedChecked ? "closed" : "live",
          total_count: "true",
        },
      };
      if (action !== "get_emlock_open_data") {
        payload.drill_state = "vts_ongoing_trips";
      }
      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
      const totalCount = response.data?.total_count ?? response.data?.total_records ?? 0;
      setCount(Number(totalCount));
    } catch (err: any) {
      // console.error(`Error fetching ${tripType} metric count:`, err);
      setError(err.response?.data?.message || "Error");
      setCount(null);
    } finally {
      setLoading(false);
    }
  }, [getBaseFilters, memoizedCrossFilters, isLiveChecked, isClosedChecked]);

  // Fetch non-reporting devices count (same API, action: non_reporting_devices)
  const fetchNonReportingCount = useCallback(async () => {
    setNonReportingLoading(true);
    setNonReportingError(null);
    try {
      const filters = getBaseFilters();
      const status = isLiveChecked ? "live" : isClosedChecked ? "closed" : "live";
      const payload = {
        filters,
        action: "non_reporting_devices",
        cross_filters: memoizedCrossFilters,
        payload: { status, total_count: "true" },
        drill_state: "",
      };
      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
      const totalCount = response.data?.total_count ?? response.data?.total_records ?? 0;
      setNonReportingCount(Number(totalCount));
    } catch (err: any) {
      console.error("Error fetching non-reporting devices count:", err);
      setNonReportingError(err.response?.data?.message || "Error");
      setNonReportingCount(null);
    } finally {
      setNonReportingLoading(false);
    }
  }, [getBaseFilters, memoizedCrossFilters, isLiveChecked, isClosedChecked]);

  // Fetch 4 metric counts + non-reporting (EM Lock uses onTotalRecords callback from table)
  useEffect(() => {
    fetchMetricCount("RD", "vts_ongoing_trips", setInvoiceCount, setInvoiceLoading, setInvoiceError);
    fetchMetricCount("HS", "vts_ongoing_trips", setHsInvoiceCount, setHsInvoiceLoading, setHsInvoiceError);
    fetchMetricCount("TC", "vts_ongoing_trips", setTcInvoiceCount, setTcInvoiceLoading, setTcInvoiceError);
    fetchMetricCount("WR", "vts_ongoing_trips", setWrInvoiceCount, setWrInvoiceLoading, setWrInvoiceError);
    fetchNonReportingCount();
  }, [fetchMetricCount, fetchNonReportingCount]);

  // EM Lock metric count comes from OngoingTripChartTable via callback (old logic)
  const handleEmLockTotalRecords = useCallback((info: { count: number | null; loading: boolean; error: string | null }) => {
    setEmLockInvoiceCount(info.count);
    setEmLockInvoiceLoading(info.loading);
    setEmLockInvoiceError(info.error);
  }, []);

  // Set BU based on user's BU
  useEffect(() => {
    if (userBu) {
      if (isLpgUser) {
        setSelectedBu('LPG');
      } else if (isTasUser) {
        setSelectedBu('TAS');
      }
    }
  }, [userBu, isLpgUser, isTasUser]);

  // Metric counts fetched via separate API calls above

  // Helper function to find the scrollable parent container
  const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
    if (!element) return null;
    
    let parent = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflow = style.overflow + style.overflowY + style.overflowX;
      
      if (overflow.includes('scroll') || overflow.includes('auto')) {
        return parent;
      }
      
      parent = parent.parentElement;
    }
    
    return document.documentElement; // Fallback to window
  };

  // Helper function to scroll to a section within the scrollable container
  const scrollToSection = (element: HTMLElement | null, offset: number = -100) => {
    if (!element) return;
    
    const scrollableContainer = findScrollableParent(element);
    if (!scrollableContainer) return;
    
    const containerRect = scrollableContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Calculate the scroll position relative to the container
    const scrollTop = scrollableContainer.scrollTop || window.pageYOffset;
    const elementTop = elementRect.top - containerRect.top + scrollTop;
    
    // Apply offset for fixed headers
    const targetScrollTop = elementTop + offset;
    
    if (scrollableContainer === document.documentElement) {
      // If it's the window, use window.scrollTo
      window.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    } else {
      // Otherwise, scroll the container
      scrollableContainer.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
  };

  const handleCardClick = () => {
    setTimeout(() => {
      scrollToSection(tableRef.current, -100);
    }, 500);
  };

  const handleHsCardClick = () => {
    setTimeout(() => {
      scrollToSection(hsTableRef.current, -100);
    }, 500);
  };

  const handleTcCardClick = () => {
    setTimeout(() => {
      scrollToSection(tcTableRef.current, -100);
    }, 500);
  };

  const handleWrCardClick = () => {
    setTimeout(() => {
      scrollToSection(wrTableRef.current, -100);
    }, 500);
  };

  const handleEmLockCardClick = () => {
    setTimeout(() => {
      scrollToSection(emLockTableRef.current, -100);
    }, 500);
  };

  const handleNonReportingCardClick = () => {
    setTimeout(() => {
      scrollToSection(nonReportingTableRef.current, -100);
    }, 500);
  };

  // Auto-click card based on URL query parameter
  useEffect(() => {
    const cardParam = searchParams.get('card');
    if (cardParam === 'tripPendingClosure') {
      // Small delay to ensure component is fully rendered
      const timer = setTimeout(() => {
        handleTcCardClick();
        // Remove the query parameter after clicking
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('card');
        setSearchParams(newSearchParams, { replace: true });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="bg-gray-100 p-4 space-y-4">
      <VTSVehicleAI />

      <div className="bg-white p-2 !mt-0 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ongoing Violating Trips Dashboard</h1>
          </div>

          <ReusableFilterBar
            key={refreshKey}
            refreshKey={refreshKey}
            selectedBu={selectedBu}
            onBuChange={setSelectedBu}
            selectedZone={selectedZone}
            onZoneChange={setSelectedZone}
            selectedPlant={selectedPlant}
            onPlantChange={setSelectedPlant}
            timeFilter={selectedTimeFilter}
            onTimeFilterChange={onTimeFilterChange}
            onRefresh={handleRefresh}
            isLoading={isRefreshing}
            disableBuSelect={hasUserBu}
          />
        </div>
      </div>

      {/* Redesigned Live/Closed checkpoint with animations */}
      <div className="bg-white p-3 rounded-lg shadow-sm mt-2">
        <div className="flex flex-wrap items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Live Status Indicator */}
            <button
              onClick={() => {
                setIsLiveChecked(!isLiveChecked);
                if (!isLiveChecked) setIsClosedChecked(false);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all duration-300 ${
                isLiveChecked
                  ? 'bg-green-50 border-2 border-green-500 shadow-md'
                  : 'bg-gray-50 border-2 border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="relative flex items-center justify-center w-5 h-5">
                {/* Animated green pulsing dot for Live */}
                {isLiveChecked ? (
                  <>
                    {/* Pulsing animation rings - outside the dot */}
                    <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
                    <div className="absolute inset-0 rounded-full bg-green-400 animate-pulse opacity-60"></div>
                    {/* Main dot */}
                    <div className="relative w-3 h-3 rounded-full bg-green-500 z-10 shadow-lg"></div>
                  </>
                ) : (
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                )}
              </div>
              <span
                className={`font-medium text-sm ${
                  isLiveChecked ? 'text-green-700' : 'text-gray-600'
                }`}
              >
                Live
              </span>
            </button>

            {/* Closed Status Indicator */}
            <button
              onClick={() => {
                setIsClosedChecked(!isClosedChecked);
                if (!isClosedChecked) setIsLiveChecked(false);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all duration-300 ${
                isClosedChecked
                  ? 'bg-red-50 border-2 border-red-500 shadow-md'
                  : 'bg-gray-50 border-2 border-gray-200 hover:border-red-300'
              }`}
            >
              <div className="relative flex items-center justify-center w-4 h-4">
                {/* Red dot for Closed */}
                <div
                  className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                    isClosedChecked ? 'bg-red-500' : 'bg-gray-400'
                  }`}
                ></div>
              </div>
              <span
                className={`font-medium text-sm ${
                  isClosedChecked ? 'text-red-700' : 'text-gray-600'
                }`}
              >
                Closed
              </span>
            </button>
          </div>

          <button
            onClick={() => window.open('https://hpclvts.hpcl.co.in/', '_blank')}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline hover:underline-offset-2 font-medium transition-colors"
            title="Check Live Status"
          >
            Check Live Status
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
            <MetricCard
              title="Route deviation beyond 2 km"
              value={invoiceLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : invoiceError ? (
                "Error"
              ) : (
                invoiceCount !== null ? invoiceCount.toLocaleString() : "0"
              )}
              variant="warning"
              onClick={handleCardClick}
            />

            <MetricCard
              title="Unauthorized stoppage at Hotspots."
              value={
                hsInvoiceLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : hsInvoiceError ? (
                  "Error"
                ) : (
                  hsInvoiceCount !== null ? hsInvoiceCount.toLocaleString() : "0"
                )
              }
              variant="warning"
              onClick={handleHsCardClick}
            />

            <MetricCard
              title="Trip pending closure (2+ hrs)"
              value={
                tcInvoiceLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : tcInvoiceError ? (
                  "Error"
                ) : (
                  tcInvoiceCount !== null ? tcInvoiceCount.toLocaleString() : "0"
                )
              }
              variant="warning"
              onClick={handleTcCardClick}
            />

          </div>


          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
            <MetricCard
              title="TT with Non reporting devices "
              value={
                nonReportingLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : nonReportingError ? (
                  "Error"
                ) : (
                  nonReportingCount !== null ? nonReportingCount.toLocaleString() : "0"
                )
              }
              variant="warning"
              onClick={handleNonReportingCardClick}
            />

            <MetricCard
              title=" TT with open EM Lock"
              value={
                emLockInvoiceLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : emLockInvoiceError ? (
                  "Error"
                ) : (
                  emLockInvoiceCount !== null ? emLockInvoiceCount.toLocaleString() : "0"
                )
              }
              variant="warning"
              onClick={handleEmLockCardClick}
            />

            <MetricCard
              title="TT without Route ID"
              // value="Coming Soon"
              value={
                wrInvoiceLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : wrInvoiceError ? (
                  "Error"
                ) : (
                  wrInvoiceCount !== null ? wrInvoiceCount.toLocaleString() : "0"
                )
              }
              variant="warning"
              onClick={handleWrCardClick}
            />
          </div>
        </div>
      </div>

      {/* UPDATED: Pass status prop to all tables */}
      <div className="mt-2 space-y-4">
        <div ref={tableRef} className="scroll-mt-24">
          <OngoingTripChartTable
            tripType="RD"
            title="Route deviation beyond 2 km"
            selectedBu={selectedBu}
            selectedZone={selectedZone}
            selectedPlant={selectedPlant}
            crossFilters={memoizedCrossFilters}
            baseFilters={getBaseFilters()}
            status={isLiveChecked ? "live" : isClosedChecked ? "closed" : undefined}
          />
        </div>

        <div ref={hsTableRef} className="scroll-mt-24">
          <OngoingTripChartTable
            tripType="HS"
            title="Unauthorized stoppage at Hotspots"
            selectedBu={selectedBu}
            selectedZone={selectedZone}
            selectedPlant={selectedPlant}
            crossFilters={memoizedCrossFilters}
            baseFilters={getBaseFilters()}
            status={isLiveChecked ? "live" : isClosedChecked ? "closed" : undefined}
          />
        </div>

        <div ref={tcTableRef} className="scroll-mt-24">
          <OngoingTripChartTable
            tripType="TC"
            title="Trip pending closure (2+ hrs)"
            selectedBu={selectedBu}
            selectedZone={selectedZone}
            selectedPlant={selectedPlant}
            crossFilters={memoizedCrossFilters}
            baseFilters={getBaseFilters()}
            status={isLiveChecked ? "live" : isClosedChecked ? "closed" : undefined}
          />
        </div>

        <div ref={nonReportingTableRef} className="scroll-mt-24">
          <NonReportingDevicesTable
            selectedBu={selectedBu}
            selectedZone={selectedZone}
            selectedPlant={selectedPlant}
            crossFilters={memoizedCrossFilters}
            baseFilters={getBaseFilters()}
            status={isLiveChecked ? "live" : isClosedChecked ? "closed" : "live"}
          />
        </div>

        <div ref={wrTableRef} className="scroll-mt-24">
          <OngoingTripChartTable
            tripType="WR"
            title="TT without Route ID"
            selectedBu={selectedBu}
            selectedZone={selectedZone}
            selectedPlant={selectedPlant}
            crossFilters={memoizedCrossFilters}
            baseFilters={getBaseFilters()}
            status={isLiveChecked ? "live" : isClosedChecked ? "closed" : undefined}
          />
        </div>

        <div ref={emLockTableRef} className="scroll-mt-24">
          <OngoingTripChartTable
            tripType="EM"
            title="TT with open EM Lock"
            selectedBu={selectedBu}
            selectedZone={selectedZone}
            selectedPlant={selectedPlant}
            crossFilters={memoizedCrossFilters}
            baseFilters={getBaseFilters()}
            status={isLiveChecked ? "live" : isClosedChecked ? "closed" : undefined}
            onTotalRecords={handleEmLockTotalRecords}
          />
        </div>
      </div>
    </div>
  );
};