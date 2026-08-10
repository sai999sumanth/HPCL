import React, { useMemo, useEffect, useState } from 'react';
import { cn } from '@/@/lib/utils';
import Header from './lpgHeader';
import { usePlantLocations } from './hooks/usePlantLocations';
import { useDashboardFilters } from './hooks/useDashboardFilters';
import useAuthStore from '@/store/authStore';
import { Loader2, ServerCrash } from 'lucide-react';
import { useRejectionData } from './hooks/useRejectionData';
import { useProductivityData } from './hooks/useProductivityData';
import { useTotalProductivityCardData } from './hooks/useTotalProductivityCardData';
import { useBottlingSummaryData } from './hooks/useBottlingSummaryData';
import { useFillingAccuracyData } from './hooks/useFillingAccuracyData';
import useCSRejectionChartData from './hooks/useCSRejectionChartData';
import { useProductivityHistory } from './hooks/useProductivityHistory';
import { useEldOldRejections } from './hooks/useEldOldRejections';
import { useEldDrillDown } from './hooks/useEldDrillDown';
import { useOldDrillDown } from './hooks/useOldDrillDown';
import { useUnderPerformanceScales } from './hooks/useUnderPerformanceScales';
import { useUnderfillOverfillScales } from './hooks/useUnderfillOverfillScales';
import MetricCard from './MetricCard';
import CSRejectionChart from './CSRejectionChart';
import { EldOldRejectionsChart } from './EldOldRejectionsChart';
import { EldDrillDownChart } from './EldDrillDownChart';
import { OldDrillDownChart } from './OldDrillDownChart';
import { ScalesTable } from './ScalesTable';
import { ProductivityHistoryChart } from './ProductivityHistoryChart';
import { ProductivityTable } from './ProductivityTable';
import { BottlingSummaryChart } from './BottlingSummaryChart';
import { FillingAccuracyChart } from './FillingAccuracyChart';


import { useHourlyProductionData } from './hooks/useHourlyProductionData';
import { useTotalProductionCardData } from './hooks/useTotalProductionCardData';
import { HourlyProductionChart } from './HourlyProductionChart';


const Dashboard: React.FC = () => {
  const { plants, loading: plantsLoading, error: plantsError, refetchPlants } = usePlantLocations();
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useAuthStore();

  const {
    plantId,
    dateRange,
    activePreset,
    updatePlant,
    updateDateRange,
    setDatePreset,
  } = useDashboardFilters();

  const accessiblePlants = useMemo(() => {
    if (!user?.sap_id || !Array.isArray(user.sap_id) || user.sap_id.length === 0) {
      return plants;
    }
    const allowedSapIds = user.sap_id.map((id: string | number) => Number(id));
    return plants.filter(plant => allowedSapIds.includes(plant.sap_id));
  }, [plants, user?.sap_id]);

  useEffect(() => {
    if (accessiblePlants.length > 0 && !plantId) {
      updatePlant(accessiblePlants[0].id);
    }
  }, [accessiblePlants, plantId, updatePlant]);

  const selectedPlant = useMemo(() => {
    if (!plantId || accessiblePlants.length === 0) return null;
    return accessiblePlants.find(p => p.id === plantId) ?? null;
  }, [plantId, accessiblePlants]);

  const handleRefresh = () => {
    refetchPlants();
    setRefreshKey((k) => k + 1);
  };

  const { data: rejectionData, loading: rejectionLoading } = useRejectionData(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: productivityData, loading: productivityLoading, error: productivityError } = useProductivityData(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: totalProductivityCardData, loading: totalProductivityCardLoading, error: totalProductivityCardError } = useTotalProductivityCardData(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: bottlingData, loading: bottlingLoading, error: bottlingError } = useBottlingSummaryData(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: fillingAccuracyData, loading: fillingAccuracyLoading, error: fillingAccuracyError } = useFillingAccuracyData(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: csRejectionChartData, loading: csRejectionLoading, error: csRejectionError } = useCSRejectionChartData(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: productivityHistoryData, loading: productivityHistoryLoading, error: productivityHistoryError } = useProductivityHistory(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: eldOldRejectionsData, loading: eldOldRejectionsLoading, error: eldOldRejectionsError } = useEldOldRejections(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: eldDrillDownData, loading: eldDrillDownLoading, error: eldDrillDownError } = useEldDrillDown(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);
  const { data: oldDrillDownData, loading: oldDrillDownLoading, error: oldDrillDownError } = useOldDrillDown(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);

  const [underPerformanceTime, setUnderPerformanceTime] = useState<'30m' | '1h' | '2h' | '4h' | '8h' | '1d'>('1d');
  const [underfillOverfillTime, setUnderfillOverfillTime] = useState<'30m' | '1h' | '2h' | '4h' | '8h' | '1d'>('1d');
  const { data: underPerformanceScalesData, loading: underPerformanceScalesLoading, error: underPerformanceScalesError } = useUnderPerformanceScales(selectedPlant?.sap_id, underPerformanceTime, refreshKey);
  const { data: underfillOverfillScalesData, loading: underfillOverfillScalesLoading, error: underfillOverfillScalesError } = useUnderfillOverfillScales(selectedPlant?.sap_id, underfillOverfillTime, refreshKey);
  const { data: hourlyProductionData, loading: hourlyProductionLoading, error: hourlyProductionError } = useHourlyProductionData(selectedPlant?.sap_id, refreshKey);
  const { data: totalProductionCardData, loading: totalProductionCardLoading, error: totalProductionCardError } = useTotalProductionCardData(selectedPlant?.sap_id, dateRange.startDate, dateRange.endDate, refreshKey);

  const getMetricValue = (data: any) => {
    if (data.error) return 'N/A';
    if (rejectionLoading) return <Loader2 className="w-6 h-6 animate-spin" />;
    return `${data.current.toFixed(2)}%`;
  };

  const getProductivityCardValue = (): React.ReactNode => {
    if (totalProductivityCardLoading) return <Loader2 className="w-6 h-6 animate-spin" />;
    if (totalProductivityCardError || totalProductivityCardData == null) return 'N/A';
    const raw = totalProductivityCardData as Record<string, unknown> | null;
    const value = typeof raw === 'number' ? raw : (raw?.['Productivity'] ?? raw?.total_productivity ?? raw?.value ?? raw?.productivity ?? (Array.isArray(raw) && raw[0] != null ? (raw[0].value ?? (raw[0] as Record<string, unknown>).total_productivity) : null));
    const num = typeof value === 'number' && !Number.isNaN(value) ? value : null;
    const changePercent = raw && typeof raw['Change (%)'] === 'number' ? raw['Change (%)'] as number : null;
    return num != null ? (
      <div className="flex flex-col items-center gap-0.5">
        <span>
          {Number(num).toFixed(2)}
          <span className="text-xs font-normal opacity-90"> Cyl/hr</span>
        </span>
        {changePercent !== null && (
          <span
            className={cn(
              'text-xs font-medium',
              changePercent > 0 ? 'text-green-600' : changePercent < 0 ? 'text-red-600' : 'text-gray-500'
            )}
          >
            DoD Percentage: {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
          </span>
        )}
      </div>
    ) : 'N/A';
  };

  const getProductionCardValue = (): React.ReactNode => {
    if (totalProductionCardLoading) return <Loader2 className="w-6 h-6 animate-spin" />;
    if (totalProductionCardError || totalProductionCardData == null) return 'N/A';
    const raw = totalProductionCardData as Record<string, unknown>;
    const total = raw['Total Production'];
    const changePercent = typeof raw['Change (%)'] === 'number' ? (raw['Change (%)'] as number) : null;
    const isValidTotal = typeof total === 'number' && !Number.isNaN(total);
    if (!isValidTotal) return 'N/A';
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span>{(total as number).toLocaleString()}</span>
        {changePercent !== null && (
          <span
            className={cn(
              'text-xs font-medium',
              changePercent > 0 ? 'text-green-600' : changePercent < 0 ? 'text-red-600' : 'text-gray-500'
            )}
          >
            DoD Percentage: {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
          </span>
        )}
      </div>
    );
  };

  const cardMetrics = [
    { title: 'Productivity', type: 'productivity' as const },
    { title: 'Production', type: 'production' as const },
    { title: 'Check Scale Rejection', data: rejectionData.cs },
    { title: 'Valve Leak Rejection', data: rejectionData.gd },
    { title: 'O-Ring Leak Rejection', data: rejectionData.pt },
  ];

  const anyRejectionError = rejectionData.cs.error || rejectionData.gd.error || rejectionData.pt.error;
  const overallError = anyRejectionError ? "One or more rejection metrics failed to load." : (totalProductivityCardError || totalProductionCardError || productivityError || bottlingError || fillingAccuracyError || csRejectionError || eldOldRejectionsError || hourlyProductionError);

  const shouldStackCharts = csRejectionChartData.length > 2 || fillingAccuracyData.length > 2;

  // Compute today's date suffix like: Today(9th June 2026)
  const today = new Date();
  const dayNum = today.getDate();
  const getOrdinal = (n: number) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return 'th';
    switch (n % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };
  const monthName = today.toLocaleString(undefined, { month: 'long' });
  const year = today.getFullYear();
  const todaySuffix = `Today(${dayNum}${getOrdinal(dayNum)} ${monthName} ${year})`;

  const renderContent = () => {
    if (plantsLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Loading Plant Locations...</p>
        </div>
      );
    }

    if (plantsError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
          <ServerCrash className="w-8 h-8 mb-4" />
          <p className="font-semibold">No plant data available</p>
          <button
            onClick={handleRefresh}
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    
    if (selectedPlant) {
      return (
        <div className="space-y-2">
          {/* THE FIX: Hourly Production Chart is now the first section with the highest z-index. */}

          
          <section className="relative z-30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {cardMetrics.map((metric, index) => (
                <div key={index} className="transform transition-all duration-200 hover:scale-105 hover:-translate-y-1">
                  <MetricCard
                    title={metric.title}
                    value={
                      metric.type === 'productivity'
                        ? getProductivityCardValue()
                        : metric.type === 'production'
                          ? getProductionCardValue()
                          : getMetricValue((metric as { data: any }).data)
                    }
                  />
                </div>
              ))}
            </div>
          </section>
          <section className="relative z-40 grid grid-cols-1 lg:grid-cols-2 gap-2 items-stretch">
            <div className="w-full h-[320px] min-h-[320px]">
              <HourlyProductionChart data={hourlyProductionData} loading={hourlyProductionLoading} error={hourlyProductionError} />
            </div>
            <div className="w-full h-[320px] min-h-[320px]">
              <FillingAccuracyChart data={fillingAccuracyData} loading={fillingAccuracyLoading} error={fillingAccuracyError} />
            </div>
          </section>
          <section className="relative z-20 flex flex-col lg:flex-row gap-2 items-stretch">
            <div className="w-full lg:w-5/12">
              <BottlingSummaryChart data={bottlingData} loading={bottlingLoading} error={bottlingError} />
            </div>
            <div className="w-full lg:w-7/12">
              <ProductivityTable data={productivityData} loading={productivityLoading} error={productivityError} />
            </div>
          </section>

          <section className="relative z-10 flex flex-col lg:flex-row gap-2 items-stretch">
            <div className="w-full lg:w-7/12 h-[360px] min-h-[360px]">
              <CSRejectionChart data={csRejectionChartData} loading={csRejectionLoading} error={csRejectionError} />
            </div>
            <div className="w-full lg:w-5/12 h-[360px] min-h-[360px]">
              <EldOldRejectionsChart data={eldOldRejectionsData} loading={eldOldRejectionsLoading} error={eldOldRejectionsError} />
            </div>
          </section>
          <section className="relative z-10 flex flex-col lg:flex-row gap-2 items-stretch w-full">
            <div className="w-full lg:w-1/2 h-[360px] min-h-[360px]">
              <OldDrillDownChart data={oldDrillDownData} loading={oldDrillDownLoading} error={oldDrillDownError} title="OLD Rejections Drill Down" />
            </div>
            <div className="w-full lg:w-1/2 h-[360px] min-h-[360px]">
              <EldDrillDownChart data={eldDrillDownData} loading={eldDrillDownLoading} error={eldDrillDownError} title="ELD Rejections Drill Down" />
            </div>
          </section>
          <section className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-2 items-stretch">
            <div className="w-full min-h-[280px]">
              <ScalesTable
                title={<>
                  <div>Underperforming Scales</div>
                  <div className="text-xs text-gray-500">{todaySuffix}</div>
                </>}
                overallLabel="OVERALL EFFICIENCY"
                meta={underPerformanceScalesData.meta}
                metaCar1Key="car1Eff"
                metaCar2Key="car2Eff"
                rows={underPerformanceScalesData.rows}
                valueKey="efficiency_display"
                valueHeader="EFFICIENCY"
                loading={underPerformanceScalesLoading}
                error={underPerformanceScalesError}
                timeRange={underPerformanceTime}
                onTimeRangeChange={setUnderPerformanceTime}
              />
            </div>
            <div className="w-full min-h-[280px]">
              <ScalesTable
                title={<>
                  <div>Underfilling & Overfilling Scales</div>
                  <div className="text-xs text-gray-500">{todaySuffix}</div>
                </>}
                overallLabel="OVERALL ACCURACY"
                meta={underfillOverfillScalesData.meta}
                metaCar1Key="car1Acc"
                metaCar2Key="car2Acc"
                rows={underfillOverfillScalesData.rows}
                valueKey="accuracy_display"
                valueHeader="ACCURACY"
                loading={underfillOverfillScalesLoading}
                error={underfillOverfillScalesError}
                timeRange={underfillOverfillTime}
                onTimeRangeChange={setUnderfillOverfillTime}
              />
            </div>
          </section>
          <section className="relative z-10 w-full h-[360px] min-h-[360px]">
            <ProductivityHistoryChart data={productivityHistoryData} loading={productivityHistoryLoading} error={productivityHistoryError} />
          </section>

          {/* {overallError && !rejectionData.cs.error && !rejectionData.gd.error && !rejectionData.pt.error && (
            <div className="relative bg-white border border-red-200 rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">Data Loading Error</h3>
                  <p className="mt-1 text-sm text-red-600">{overallError}</p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="ml-4 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )} */}
        </div>
      );
    }

    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Plant</h3>
        <p className="text-gray-500">Choose a manufacturing plant to view production metrics.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <Header
        plants={plants}
        plantsLoading={plantsLoading}
        plantsError={plantsError}
        onRefresh={handleRefresh}
        plantId={plantId}
        dateRange={dateRange}
        activePreset={activePreset}
        updatePlant={updatePlant}
        updateDateRange={updateDateRange}
        setDatePreset={setDatePreset}
        selectedPlant={selectedPlant}
      />
      
      <main className=" mx-auto px-2 sm:px-2 lg:px-2 py-2">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;
