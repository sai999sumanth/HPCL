import React, { useState, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/@/components/ui/breadcrumb";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Download, RefreshCw, Check, Info } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import PerformanceScoreCard from './PerformanceScore';
import PerformanceScoreZone from './PerformanceScoreZone';
import EnhancedTimeFilter from '../../Governance/filters/TimeFilterButtons';
import Alarmas from './Alarms';
import Equipment from './Equipment';
import EquipmentDetailsTable from './EquipmentDetailsTable';
import AlarmTable from './AlarmTable';
import CriticalAlertDetailsTable from './CriticalAlertDetailsTable';
import NestedPivotTable, { NestedPivotTableRef } from './Pivottable';
import EquipmentWiseDetails from './equipmentwisedetails';
import LocationWiseDetails from './locatiowisedetails';
import PivotTable from './equipmenttable';
import ExceptionReport from './Exceptionreport';
import PerformanceScoreBreakdownChart from './PerformanceScoreBreakdownChart';
import TopAlerts from './Topalerts';
import TASGpt from '../TASGpt';

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const TASGovernance: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [detailedData, setDetailedData] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailedCurrentPage, setDetailedCurrentPage] = useState(1);
  const [detailedItemsPerPage, setDetailedItemsPerPage] = useState(10);
  const [selectedCriticalAlertLocation, setSelectedCriticalAlertLocation] = useState<string | null>(null);
  const [criticalAlertSeverity, setCriticalAlertSeverity] = useState<string[]>(['']);
  const [selectedPerformanceLocation, setSelectedPerformanceLocation] = useState<string | null>(null);
  const [selectedPerformanceZone, setSelectedPerformanceZone] = useState<string | null>(null);
  // Separate state for filtering the Performance Score Card (only set by zone clicks)
  const [performanceCardZoneFilter, setPerformanceCardZoneFilter] = useState<string | null>(null);
  const [performanceViewMode, setPerformanceViewMode] = useState<'location' | 'zone'>('location');
  
  // Force re-render counter for immediate updates
  const [filterUpdateTrigger, setFilterUpdateTrigger] = useState(0);
  const PIVOT_SEVERITY_OPTIONS = [
    { id: 'Critical' as const, letter: 'C', color: '#dc2626' },
    { id: 'High' as const, letter: 'H', color: '#ea580c' },
    { id: 'Medium' as const, letter: 'M', color: '#ca8a04' },
    { id: 'Low' as const, letter: 'L', color: '#16a34a' },
  ];

  const [selectedAlarmInterlock, setSelectedAlarmInterlock] = useState<string | null>(null);
  const handleAlertSelect = (alert: string | null) => {
    setSelectedAlarmInterlock(alert);
  };

  const [timeFilter, setTimeFilter] = useState<string | null | { key: string; cond: string; value: string }>('15D');
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [selectedSeverity, setSelectedSeverity] = useState<string[]>(['']);
  const [pivotSelectedSeverityOptions, setPivotSelectedSeverityOptions] = useState<string[]>(['Critical']);
  const pivotTableSeverity = useMemo(
    () => (pivotSelectedSeverityOptions.length === 4 ? [''] : pivotSelectedSeverityOptions),
    [pivotSelectedSeverityOptions]
  );
  const [equipmentAlertStatus, setEquipmentAlertStatus] = useState<'All' | 'Open' | 'Close'>('All');
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>("");
  const selectRef = useRef<HTMLSelectElement>(null);
  const pivotTableRef = useRef<NestedPivotTableRef>(null);
  const [isPivotDownloading, setIsPivotDownloading] = useState(false);

  // Convert API values back to display values for the dropdown
  const displaySeverity = selectedSeverity.includes('') ? ['All'] : selectedSeverity;

  // Reset Performance Score / Breakdown filter state, Pivot Alert Severity, and close all drill-down tables when refresh is clicked
  useEffect(() => {
    setSelectedPerformanceZone(null);
    setPerformanceCardZoneFilter(null);
    setSelectedPerformanceLocation(null);
    setPivotSelectedSeverityOptions(['Critical']);
    // Close Equipment details drill-down
    setSelectedLocation(null);
    setDetailedData([]);
    // Close Critical Alert details drill-down
    setSelectedCriticalAlertLocation(null);
    setCriticalAlertSeverity(['']);
    // Close Alarms Alert details drill-down (AlertDetailsTable inside AlarmTable)
    handleAlertSelect(null);
  }, [refreshCounter]);

  // When user toggles Performance Score view (location ↔️ zone), reset breakdown chart selection so it refreshes to default
  useEffect(() => {
    setSelectedPerformanceZone(null);
    setPerformanceCardZoneFilter(null);
    setSelectedPerformanceLocation(null);
  }, [performanceViewMode]);

  // Initialize select element on mount
  useEffect(() => {
    if (selectRef.current) {
      const selectElement = selectRef.current;
      const options = Array.from(selectElement.options);

      // Clear all selections
      options.forEach(option => option.selected = false);

      // Set initial selections for "All"
      const allOption = options.find(option => option.value === 'All');
      if (allOption) allOption.selected = true;
    }
  }, []); // Run only on mount

  const handleLocationSelect = (location: string | null) => {
    setSelectedLocation(location);
    setDetailedItemsPerPage(10);
    setIsLoadingDetails(true);
  };

  const handleDetailedDataUpdate = (data: any[], location: string | null) => {
    setDetailedData(data);
    setSelectedLocation(location);
    setIsLoadingDetails(false);
  };

  const handleBackClick = () => {
    setSelectedLocation(null);
    setDetailedData([]);
    setDetailedItemsPerPage(10);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setDetailedItemsPerPage(newItemsPerPage);
    setDetailedCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setDetailedCurrentPage(page);
  };

  const handleCriticalAlertDetails = (location: string, severity: string[]) => {
    setSelectedCriticalAlertLocation(location);
    setCriticalAlertSeverity(severity);
  };

  const handleCriticalAlertDetailsBack = () => {
    setSelectedCriticalAlertLocation(null);
    setCriticalAlertSeverity(['']);
  };

  const handlePivotSeverityToggle = (severity: string) => {
    setPivotSelectedSeverityOptions(prev => {
      let next: string[];
      if (prev.includes(severity)) {
        next = prev.filter((s) => s !== severity);
        if (next.length === 0) next = ['Critical'];
      } else {
        next = [...prev, severity];
      }
      return next;
    });
  };

  // Utility function to convert timeFilter to start_date and end_date
  const getDateRangeFromFilter = (filter: string | null | { key: string; cond: string; value: string }): { start_date: string; end_date: string } => {
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];

    if (!filter) {
      // Default to today if no filter selected
      return {
        start_date: currentDate,
        end_date: currentDate
      };
    }

    if (typeof filter === 'object' && filter.key === 'Date' && filter.value) {
      // Custom date range
      const [startDate, endDate] = filter.value.split(',');
      return {
        start_date: startDate,
        end_date: endDate
      };
    }

    if (typeof filter === 'string') {
      // Predefined filters
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      switch (filter) {
        case 'TDY': // Today
          return {
            start_date: currentDate,
            end_date: currentDate
          };
        case 'YDY': // Yesterday
          return {
            start_date: yesterdayStr,
            end_date: yesterdayStr
          };
        case '1W': // Last 1 Week
          const oneWeekAgo = new Date(today);
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return {
            start_date: oneWeekAgo.toISOString().split('T')[0],
            end_date: currentDate
          };
        case '15D': // Last 15 Days
          const fifteenDaysAgo = new Date(today);
          fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
          return {
            start_date: fifteenDaysAgo.toISOString().split('T')[0],
            end_date: currentDate
          };
        case '1M': // Last 1 Month
          const oneMonthAgo = new Date(today);
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          return {
            start_date: oneMonthAgo.toISOString().split('T')[0],
            end_date: currentDate
          };
        case '3M': // Last 3 Months
          const threeMonthsAgo = new Date(today);
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          return {
            start_date: threeMonthsAgo.toISOString().split('T')[0],
            end_date: currentDate
          };
        default:
          // Default to today for unknown filters
          return {
            start_date: currentDate,
            end_date: currentDate
          };
      }
    }

    // Default fallback
    return {
      start_date: currentDate,
      end_date: currentDate
    };
  };

  // Get current date range based on selected filter
  const currentDateRange = getDateRangeFromFilter(timeFilter);

  return (
    <div className="tas-governance-dashboard min-h-screen bg-gray-50 p-0">
      <style>{`
        /* Visible scrollbars inside cards — overrides global * and MainLayout .hide-scrollbar (higher specificity) */
        .hide-scrollbar .tas-governance-dashboard *,
        .hide-scrollbar .tas-governance-dashboard *:hover {
          scrollbar-width: thin !important;
          scrollbar-color: #a8a8a8 #f1f1f1 !important;
          -ms-overflow-style: auto !important;
        }
        .hide-scrollbar .tas-governance-dashboard *::-webkit-scrollbar,
        .hide-scrollbar .tas-governance-dashboard *:hover::-webkit-scrollbar {
          width: 8px !important;
          height: 8px !important;
          display: block !important;
          -webkit-appearance: none !important;
        }
        .hide-scrollbar .tas-governance-dashboard *::-webkit-scrollbar-track,
        .hide-scrollbar .tas-governance-dashboard *:hover::-webkit-scrollbar-track {
          background: #f1f1f1 !important;
          border-radius: 4px;
        }
        .hide-scrollbar .tas-governance-dashboard *::-webkit-scrollbar-thumb,
        .hide-scrollbar .tas-governance-dashboard *:hover::-webkit-scrollbar-thumb {
          background: #a8a8a8 !important;
          border-radius: 4px;
        }
        .hide-scrollbar .tas-governance-dashboard *::-webkit-scrollbar-thumb:hover {
          background: #888 !important;
        }
        .tas-governance-dashboard *,
        .tas-governance-dashboard *:hover {
          scrollbar-width: thin !important;
          scrollbar-color: #a8a8a8 #f1f1f1 !important;
          -ms-overflow-style: auto !important;
        }
        .tas-governance-dashboard *::-webkit-scrollbar,
        .tas-governance-dashboard *:hover::-webkit-scrollbar {
          width: 8px !important;
          height: 8px !important;
          display: block !important;
          -webkit-appearance: none !important;
        }
        .tas-governance-dashboard *::-webkit-scrollbar-track,
        .tas-governance-dashboard *:hover::-webkit-scrollbar-track {
          background: #f1f1f1 !important;
          border-radius: 4px;
        }
        .tas-governance-dashboard *::-webkit-scrollbar-thumb,
        .tas-governance-dashboard *:hover::-webkit-scrollbar-thumb {
          background: #a8a8a8 !important;
          border-radius: 4px;
        }
        .tas-governance-dashboard *::-webkit-scrollbar-thumb:hover {
          background: #888 !important;
        }
      `}</style>
      <div className="w-full min-w-0 space-y-2">
        {/* Header Section */}
        <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="pb-2 pt-0.5 pl-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900">
                TAS Governance Dashboard
              </CardTitle>
              <div className="flex items-center gap-2">
                <EnhancedTimeFilter
                  selectedFilter={typeof timeFilter === 'string' ? timeFilter : null}
                  onFilterChange={setTimeFilter}
                />
                <Button
                  onClick={() => setRefreshCounter(prev => prev + 1)}
                  disabled={false}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white p-1 px-2 rounded-md flex items-center gap-2 h-7 text-xs"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Zone + Performance Breakdown Chart (same width, up/down) | Location (fixed width) */}
        {/* <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-2 mt-4 items-start "> */}
          {/* Left column: Zone (top) and Performance Breakdown Chart (below) - takes remaining width */}
          {/* <div className="flex flex-col gap-2 w-full min-w-0" id="performance-score-breakdown-chart">
            <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 h-[350px] w-full">
              <CardContent className="p-2 h-full flex flex-col">
                <PerformanceScoreZone
                  startDate={currentDateRange.start_date}
                  endDate={currentDateRange.end_date}
                  refreshTrigger={refreshCounter}
                  onZoneSelect={(zone) => {
                    // Use flushSync to force immediate synchronous state update
                    flushSync(() => {
                      // When zone is clicked in PerformanceScoreZone:
                      // ONLY filter the Performance Score Card, DON'T update breakdown chart
                      setPerformanceCardZoneFilter(zone);
                      // Clear location selection
                      // setSelectedPerformanceLocation(null);
                      // setPerformanceViewMode('zone');
                      // Force immediate update
                      // setFilterUpdateTrigger(prev => prev + 1);
                    });
                  }}
                />
              </CardContent>
            </Card>
            <PerformanceScoreBreakdownChart
              startDate={currentDateRange.start_date}
              endDate={currentDateRange.end_date}
              refreshTrigger={refreshCounter}
              selectedLocation={selectedPerformanceLocation}
              selectedZone={selectedPerformanceZone}
              viewMode={performanceViewMode}
              // Add this callback to clear location when zone changes via dropdown
              onZoneChange={(zone) => {
                setSelectedPerformanceZone(zone);
                setSelectedPerformanceLocation(null); // Clear location selection when zone changes
                // DON'T update performanceCardZoneFilter - dropdown changes shouldn't filter the card
              }}
            />
          </div>
          {/* Right column: Location card - fixed 560px width */}
          {/* <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 h-[690px] w-full max-w-full shrink-0"> */}
          {/* <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 h-[690px] w-full flex-shrink flex-grow">

            <CardContent className="p-2 h-full flex flex-col">

              <PerformanceScoreCard
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
                selectedZone={performanceCardZoneFilter}
                onClearZoneFilter={() => {
                  setPerformanceCardZoneFilter(null);
                  setSelectedPerformanceZone(null);
                  setFilterUpdateTrigger(prev => prev + 1);
                }}
                onLocationSelect={(locationName, zone) => {
                  // Use flushSync to force immediate synchronous state update
                  flushSync(() => {
                    // When location is clicked:
                    // 1. Update breakdown chart with location AND its zone immediately
                    setSelectedPerformanceLocation(locationName);
                    setSelectedPerformanceZone(zone);
                    // 2. DON'T update performanceCardZoneFilter - keep card unfiltered
                    setPerformanceViewMode('location');
                    // 3. Force immediate update
                    setFilterUpdateTrigger(prev => prev + 1);
                  });
                }}
                onFirstLocationLoaded={(locationName, zone) => {
                  // Don't auto-select first location - let user select manually
                }}
                onViewModeChange={(viewMode) => {
                  setPerformanceViewMode(viewMode);
                }}
              /> */}
            {/* </CardContent>
          </Card> * */}
        {/* </div> */}
        {/* Zone + trend (left) | TAS Score spans both rows (right) — aligned on large screens */}
        <div
          id="performance-score-breakdown-chart"
          className="tas-gov-performance-grid w-full mt-4 grid grid-cols-1 gap-2 transition-all duration-300 items-stretch lg:grid-cols-2"
        >
          <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 h-[370px] w-full min-w-0 lg:col-start-1 lg:row-start-1">
            <CardContent className="p-2 h-full flex flex-col min-w-0">
              <PerformanceScoreZone
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
                onZoneSelect={(zone) => {
                  flushSync(() => {
                    setPerformanceCardZoneFilter(zone);
                  });
                }}
              />
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-all duration-300 w-full min-w-0 h-[min(560px,70vh)] lg:h-[730px] lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <CardContent className="p-2 h-full flex flex-col min-w-0">
              <PerformanceScoreCard
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
                selectedZone={performanceCardZoneFilter}
                onClearZoneFilter={() => {
                  setPerformanceCardZoneFilter(null);
                  setSelectedPerformanceZone(null);
                }}
                onLocationSelect={(locationName, zone) => {
                  flushSync(() => {
                    setSelectedPerformanceLocation(locationName);
                    setSelectedPerformanceZone(zone);
                    setPerformanceViewMode("location");
                  });
                }}
                onViewModeChange={(viewMode) => setPerformanceViewMode(viewMode)}
              />
            </CardContent>
          </Card>

          <div className="h-[350px] w-full min-h-0 min-w-0 overflow-hidden lg:col-start-1 lg:row-start-2">
            <PerformanceScoreBreakdownChart
              startDate={currentDateRange.start_date}
              endDate={currentDateRange.end_date}
              refreshTrigger={refreshCounter}
              selectedLocation={selectedPerformanceLocation}
              selectedZone={selectedPerformanceZone}
              viewMode={performanceViewMode}
              onZoneChange={(zone) => {
                setSelectedPerformanceZone(zone);
                setSelectedPerformanceLocation(null);
              }}
              className="h-full"
            />
          </div>
        </div>

        {/* Row 3: Equipment Wise and Location Wise below breakdown chart, beside each other */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-4 items-stretch">
          <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 h-[350px] min-w-0">
            <CardContent className="p-0.5 h-full min-w-0">
              <EquipmentWiseDetails
                key={refreshCounter}
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
                onEquipmentTypeSelect={setSelectedEquipmentType}
              />
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 h-[350px] min-w-0">
            <CardContent className="p-0.5 h-full min-w-0">
              <LocationWiseDetails
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
                equipmentType={selectedEquipmentType}
                onClearEquipmentType={() => setSelectedEquipmentType("")}
              />
            </CardContent>
          </Card>
        </div>

        {/* Alarms | Top Alerts (Topalerts.tsx) — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-4 items-stretch">
          {/* Alarms Card */}
          <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 min-w-0">
            <CardContent className="px-2 pt-1 pb-2 h-[350px] flex flex-col">
              <Alarmas
                key={refreshCounter}
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
                onInterlockSelect={handleAlertSelect}
                onAlertSeverityChange={setSelectedSeverity}
                selectedInterlock={selectedAlarmInterlock}
              />
            </CardContent>
          </Card>

          {/* Top Alerts (replaces Critical Alerts table) */}
          <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 min-w-0">
            <CardContent className="px-2 pt-0.5 pb-1 h-[350px] flex flex-col min-w-0">
              <TopAlerts
                key={refreshCounter}
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
              />
            </CardContent>
          </Card>
        </div>

        {/*
          One wrapper so parent space-y-2 does not stack 3× gaps between: critical details, AlarmTable, Equipment|Pivot.
          Internal gap-0 avoids extra flex spacing; parent space-y-2 applies only once below Alarms|Top Alerts.
        */}
        <div className="w-full flex flex-col gap-0">
          {/* Critical Alert Details Table - Full Width Below CriticalAlerts Card */}
          <div
            data-details-table
            className={`transition-all duration-700 ease-out overflow-hidden ${selectedCriticalAlertLocation
                ? 'max-h-[1000px] opacity-100'
                : 'max-h-0 opacity-0 h-0'
              }`}
            style={{
              transition: 'all 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              marginTop: selectedCriticalAlertLocation ? undefined : 0
            }}
          >
            <div
              className={`transform transition-transform duration-500 ease-out delay-100 ${selectedCriticalAlertLocation
                  ? 'translate-y-0'
                  : '-translate-y-4'
                }`}
            >
              {selectedCriticalAlertLocation && (
                <CriticalAlertDetailsTable
                  selectedLocation={selectedCriticalAlertLocation}
                  onBackClick={handleCriticalAlertDetailsBack}
                  startDate={currentDateRange.start_date}
                  endDate={currentDateRange.end_date}
                  alertSeverity={criticalAlertSeverity}
                />
              )}
            </div>
          </div>

          {/* Alarm Table - bar chart + drill table when slice clicked */}
          <div className="w-full min-h-0">
            <AlarmTable
              currentDateRange={currentDateRange}
              alertSeverity={selectedSeverity}
              selectedAlert={selectedAlarmInterlock}
              onAlertSelect={handleAlertSelect}
            />
          </div>

          {/* Equipment and Pivot Table — side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 items-stretch">
          {/* Equipment Card */}
          <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 min-w-0">
            <CardContent className="px-2 pt-1 pb-2 h-[360px] flex flex-col">
              <Equipment
                onLocationSelect={handleLocationSelect}
                onDetailedDataUpdate={handleDetailedDataUpdate}
                onAlertStatusChange={setEquipmentAlertStatus}
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
              />
            </CardContent>
          </Card>

          {/* Pivot Table Card */}
          <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 min-w-0">
            <CardContent className="pl-1 pr-1 pt-1 pb-1 h-[360px] flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Location-Wise Alert Generation Summary
                  </h4>

                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (pivotTableRef.current) {
                        setIsPivotDownloading(true);
                        try {
                          await pivotTableRef.current.handleDownload();
                        } finally {
                          setIsPivotDownloading(false);
                        }
                      }
                    }}
                    disabled={isPivotDownloading}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Download Excel"
                  >
                    {isPivotDownloading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                  {PIVOT_SEVERITY_OPTIONS.map((opt) => {
                    const isSelected = pivotSelectedSeverityOptions.includes(opt.id);
                    return (
                      <div key={opt.id} className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-gray-700">{opt.letter}</span>
                        <button
                          type="button"
                          onClick={() => handlePivotSeverityToggle(opt.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-sm shrink-0 border-2 bg-transparent p-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
                          style={{ borderColor: opt.color }}
                          aria-pressed={isSelected}
                          title={opt.id}
                        >
                          {isSelected ? <Check className="h-3 w-3" strokeWidth={5.5} style={{ color: '#2563eb' }} /> : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <NestedPivotTable
                key={refreshCounter}
                ref={pivotTableRef}
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
                selectedSeverity={pivotTableSeverity}
              />
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Equipment Details Table - Full Width Below Equipment Card */}
        {selectedLocation && (
          <div className="w-full mt-2" data-equipment-details-table>
            <EquipmentDetailsTable
              selectedLocation={selectedLocation}
              detailedData={detailedData}
              isLoadingDetails={isLoadingDetails}
              detailedCurrentPage={detailedCurrentPage}
              detailedItemsPerPage={detailedItemsPerPage}
              onBackClick={handleBackClick}
              onItemsPerPageChange={handleItemsPerPageChange}
              onPageChange={handlePageChange}
              startDate={currentDateRange.start_date}
              endDate={currentDateRange.end_date}
            />
          </div>
        )}

        {/* TAS Alerts Exception Report - Separate Full Width Card */}
        {/* <div className="w-full mt-4">
          <Card data-exception-card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-2">
              <ExceptionReport
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
              />
            </CardContent>
          </Card>
        </div> */}

        <div className="w-full mt-4">
          <Card
            data-exception-card
            className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 h-full"
          >
            <CardContent className="p-2 h-full">
              <ExceptionReport
                startDate={currentDateRange.start_date}
                endDate={currentDateRange.end_date}
                refreshTrigger={refreshCounter}
              />
            </CardContent>
          </Card>
        </div>
        <TASGpt />
      </div>
    </div>
  );
};

export default TASGovernance;