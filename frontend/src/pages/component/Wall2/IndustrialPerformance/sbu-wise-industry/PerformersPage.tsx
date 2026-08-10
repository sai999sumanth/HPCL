import React, { useState, useEffect, useMemo } from 'react';
import FilterDisplay from './FilterDisplay';
import PerformersCharts from './PerformersCharts';
import ChartModal from './ChartModal';
import DrilldownModal from './DrilldownModal';
import FinancialPerformanceDashboard from './FinancialPerformanceDashboard';
import { fetchTopPerformers, fetchBottomPerformers, downloadPerformanceData } from './services/performanceApi';
import { RefreshCw, Download, AlertCircle, TrendingUp, TrendingDown, Activity, Info, Building2 } from 'lucide-react';
import { ApiResponse, FilterValues, RegionData } from './types';

const getPreviousFiscalMonthAbbr = (): string => { 
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const now = new Date();
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);
  return months[previousMonthDate.getMonth()];
};

const getCurrentFiscalYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const DEFAULT_FILTER_VALUES: FilterValues = {
  sbu_name: '',
  zone_name: '',
  region_name: '',
  statename: '',
  fiscal_year: getCurrentFiscalYear(),
  productname: [],
  month_name: getPreviousFiscalMonthAbbr(),
  coname: 'HPCL',
  distname: ''
};

/** Align page prop with `industry_performance.sbu_name` (e.g. Retail → RETAIL). */
const normalizeSbuNameForApi = (pageSbu: string): string => pageSbu.trim().toUpperCase();

interface MessageState {
  text: string;
  type: 'error' | 'info';
}

type MetricKey = 'gain_loss' | 'total_sales' | 'curr_mkt' | 'his_mkt' | 'growth';
type ViewType = 'table' | 'chart';

interface MaximizedChartState {
  title: string;
  data: any[];
  nameKey: string;
  type: 'zones' | 'regions' | 'districts';
}

interface PerformersPageProps {
  sbu: string;
}

const PerformersPage: React.FC<PerformersPageProps> = ({ sbu }) => {
  const [filterValues, setFilterValues] = useState<FilterValues>(() => ({
    ...DEFAULT_FILTER_VALUES,
    sbu_name: normalizeSbuNameForApi(sbu),
  }));
  const [showTopPerformers, setShowTopPerformers] = useState(true);
  const [topZonesData, setTopZonesData] = useState<any[]>([]);
  const [topRegionsData, setTopRegionsData] = useState<any[]>([]);
  const [topDistrictsData, setTopDistrictsData] = useState<any[]>([]);
  const [topLoading, setTopLoading] = useState(true);
  const [topMessage, setTopMessage] = useState<MessageState | null>(null);
  const [bottomZonesData, setBottomZonesData] = useState<any[]>([]);
  const [bottomRegionsData, setBottomRegionsData] = useState<any[]>([]);
  const [bottomDistrictsData, setBottomDistrictsData] = useState<any[]>([]);
  const [bottomLoading, setBottomLoading] = useState(true);
  const [bottomMessage, setBottomMessage] = useState<MessageState | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  
  const [maximizedChart, setMaximizedChart] = useState<MaximizedChartState | null>(null);

  // State for metrics
  const [zoneMetric, setZoneMetric] = useState<MetricKey>('total_sales');
  const [regionMetric, setRegionMetric] = useState<MetricKey>('total_sales');
  const [districtMetric, setDistrictMetric] = useState<MetricKey>('total_sales');

  // State for views (table/chart)
  const [zoneView, setZoneView] = useState<ViewType>('table');
  const [regionView, setRegionView] = useState<ViewType>('table');
  const [districtView, setDistrictView] = useState<ViewType>('table');

  const [drilldownRegion, setDrilldownRegion] = useState<string | null>(null);

  const loadTopPerformers = async (filters: FilterValues) => {
    setTopLoading(true);
    setTopMessage(null);
    setTopDistrictsData([]);

    try { 
      const response = await fetchTopPerformers(filters);
      if (response.status && response.data) {
        setTopZonesData(response.data.zones || []);
        setTopRegionsData(response.data.regions || []);
        setTopDistrictsData(response.data.districts || []);
        if (!response.data.zones?.length && !response.data.regions?.length && !response.data.districts?.length) {
          setTopMessage({ text: 'No performers data found for this selection.', type: 'info' });
        }
      } else {
        setTopZonesData([]);
        setTopRegionsData([]);
        setTopDistrictsData([]);
        setTopMessage({
          text: response.message || 'No data available for the current selection.',
          type: 'info'
        });
      }
    } catch (error: any) {
      console.error('Error loading top performers:', error);
      setTopZonesData([]);
      setTopRegionsData([]);
      setTopDistrictsData([]);
      if (error.code === 'ERR_NETWORK') {
        setTopMessage({ text: 'Network Error: Unable to connect to the server.', type: 'error' });
      } else {
        setTopMessage({ text: 'An unexpected error occurred while fetching data.', type: 'error' });
      }
    } finally {
      setTopLoading(false);
    }
  };

  const loadBottomPerformers = async (filters: FilterValues) => {
    setBottomLoading(true);
    setBottomMessage(null);
    setBottomDistrictsData([]);

    try {
      const response = await fetchBottomPerformers(filters);
      if (response.status && response.data) {
        setBottomZonesData(response.data.zones || []);
        setBottomRegionsData(response.data.regions || []);
        setBottomDistrictsData(response.data.districts || []);
        if (!response.data.zones?.length && !response.data.regions?.length && !response.data.districts?.length) {
          setBottomMessage({ text: 'No performers data found for this selection.', type: 'info' });
        }
      } else {
        setBottomZonesData([]);
        setBottomRegionsData([]);
        setBottomDistrictsData([]);
        setBottomMessage({
          text: response.message || 'No data available for the current selection.',
          type: 'info'
        });
      }
    } catch (error: any) {
      console.error('Error loading bottom performers:', error);
      setBottomZonesData([]);
      setBottomRegionsData([]);
      setBottomDistrictsData([]);
      if (error.code === 'ERR_NETWORK') {
        setBottomMessage({ text: 'Network Error: Unable to connect to the server.', type: 'error' });
      } else {
        setBottomMessage({ text: 'An unexpected error occurred while fetching data.', type: 'error' });
      }
    } finally {
      setBottomLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: FilterValues) => {
    setFilterValues(newFilters);
    loadTopPerformers(newFilters);
    loadBottomPerformers(newFilters);
  };

  const handleExport = async () => {
    const dataExists = showTopPerformers
      ? topZonesData.length > 0 || topRegionsData.length > 0 || topDistrictsData.length > 0
      : bottomZonesData.length > 0 || bottomRegionsData.length > 0 || bottomDistrictsData.length > 0;

    if (!dataExists) {
      alert("No data available to download.");
      return;
    }

    setExportLoading(true);
    setExportError(null);

    try {
      const response = await downloadPerformanceData(filterValues);

      if (response?.status && response.file_path) { 
        const proxiedPath = response.file_path.replace('/opt/downloads/', '/downloads/');
        window.open(proxiedPath, '_blank');
      } else { 
        console.error('Export failed: Invalid response from server', response);
        setExportError(response.message || 'Export failed. The server response was not a valid download link.');
      }

    } catch (err: any) {
      console.error('Export API error:', err);
      const message = err.response?.data?.message || err.message || 'An unexpected error occurred during export.';
      setExportError(message);
    } finally {
      setExportLoading(false);
    }
  };
  
  const handleMaximizeChart = (chartInfo: Omit<MaximizedChartState, 'view'>) => {
    setMaximizedChart(chartInfo);
  };

  const handleRegionRowClick = (region: RegionData) => {
    setDrilldownRegion(region.region_name);
  };

  const refreshAllData = () => {
    const newFilters = {
      ...DEFAULT_FILTER_VALUES,
      sbu_name: normalizeSbuNameForApi(sbu),
    };
    setFilterValues(newFilters);
    loadTopPerformers(newFilters);
    loadBottomPerformers(newFilters);
    setZoneView('table');
    setRegionView('table');
    setDistrictView('table');
  };

  useEffect(() => {
    loadTopPerformers(filterValues);
    loadBottomPerformers(filterValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentLoading = showTopPerformers ? topLoading : bottomLoading;
  const currentMessage = showTopPerformers ? topMessage : bottomMessage;
  const currentZonesData = showTopPerformers ? topZonesData : bottomZonesData;
  const currentRegionsData = showTopPerformers ? topRegionsData : bottomRegionsData;
  const currentDistrictsData = showTopPerformers ? topDistrictsData : bottomDistrictsData;
  
  const noDataToExport = currentZonesData.length === 0 && currentRegionsData.length === 0 && currentDistrictsData.length === 0;

  const getProductsDisplayText = () => {
    if (filterValues.productname.length === 0) return 'All Products';
    if (filterValues.productname.length === 1) return filterValues.productname[0];
    return `${filterValues.productname.length} Products Selected`;
  };

  const activeModalTools = useMemo(() => {
    if (!maximizedChart) {
      return { 
        metric: 'total_sales' as MetricKey, 
        onMetricChange: (() => {}) as (metric: MetricKey) => void,
        view: 'table' as ViewType,
        onViewChange: (() => {}) as (view: ViewType) => void,
      };
    }
    switch (maximizedChart.type) {
      case 'zones':
        return { metric: zoneMetric, onMetricChange: setZoneMetric, view: zoneView, onViewChange: setZoneView };
      case 'regions':
        return { metric: regionMetric, onMetricChange: setRegionMetric, view: regionView, onViewChange: setRegionView };
      case 'districts':
        return { metric: districtMetric, onMetricChange: setDistrictMetric, view: districtView, onViewChange: setDistrictView };
      default:
        return { 
          metric: 'total_sales' as MetricKey, 
          onMetricChange: (() => {}) as (metric: MetricKey) => void,
          view: 'table' as ViewType,
          onViewChange: (() => {}) as (view: ViewType) => void,
        };
    }
  }, [maximizedChart, zoneMetric, regionMetric, districtMetric, zoneView, regionView, districtView]);

  return ( 
    <div className="min-h-screen bg-gray-50 p-3">
      <div>
        <div className="mb-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                Performance Analytics Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                {filterValues.coname} • {sbu} • {getProductsDisplayText()} • {filterValues.distname || 'All Districts'} • {filterValues.month_name} {filterValues.fiscal_year}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={refreshAllData}
                disabled={currentLoading}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1.5 rounded text-sm transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${currentLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <FilterDisplay
          title="Applied Filters"
          filters={filterValues}
          onFiltersChange={handleFiltersChange}
          pageSbu={sbu}
        />

        <div className="mb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-white rounded-lg p-1 shadow-sm border">
                <button
                  onClick={() => setShowTopPerformers(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    showTopPerformers ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <TrendingUp className="h-4 w-4" />
                  Top Performers
                </button>
                <button
                  onClick={() => setShowTopPerformers(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    !showTopPerformers ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <TrendingDown className="h-4 w-4" />
                  Bottom Performers
                </button>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-between gap-y-3 gap-x-4 md:w-auto md:justify-end">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-gray-600">Zones:</span>
                  <span className="font-semibold">{currentZonesData.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-4 w-4 text-purple-500" />
                  <span className="text-gray-600">Regions:</span>
                  <span className="font-semibold">{currentRegionsData.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4 text-teal-500" />
                  <span className="text-gray-600">Districts:</span>
                  <span className="font-semibold">{currentDistrictsData.length}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                <button
                  onClick={handleExport}
                  disabled={exportLoading || noDataToExport}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                    showTopPerformers ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400' : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                  } text-white`}
                >
                  <Download className={`h-3 w-3 ${exportLoading ? 'animate-spin' : ''}`} />
                  Export
                </button>
                {exportError && (  
                  <p className="text-xs text-red-600 mt-1">{exportError}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <PerformersCharts 
            zonesData={currentZonesData}
            regionsData={currentRegionsData}
            districtsData={currentDistrictsData}
            loading={currentLoading}
            message={currentMessage}
            titlePrefix={showTopPerformers ? 'Top' : 'Bottom'}
            onMaximizeChart={handleMaximizeChart}
            onRegionRowClick={handleRegionRowClick}
            zoneMetric={zoneMetric}
            onZoneMetricChange={setZoneMetric}
            regionMetric={regionMetric}
            onRegionMetricChange={setRegionMetric}
            districtMetric={districtMetric}
            onDistrictMetricChange={setDistrictMetric}
            zoneView={zoneView}
            onZoneViewChange={setZoneView}
            regionView={regionView}
            onRegionViewChange={setRegionView}
            districtView={districtView}
            onDistrictViewChange={setDistrictView}
        />

       <FinancialPerformanceDashboard filters={filterValues} />

      </div> 
      <ChartModal
        isOpen={!!maximizedChart}
        onClose={() => setMaximizedChart(null)}
        title={maximizedChart?.title || ''}
        data={maximizedChart?.data || []}
        nameKey={maximizedChart?.nameKey || ''}
        type={maximizedChart?.type || 'zones'}
        view={activeModalTools.view}
        onViewChange={activeModalTools.onViewChange}
        selectedMetric={activeModalTools.metric}
        onMetricChange={activeModalTools.onMetricChange}
      />

      <DrilldownModal
        isOpen={!!drilldownRegion}
        onClose={() => setDrilldownRegion(null)}
        regionName={drilldownRegion || ''}
      />
    </div>
  );
};

export default PerformersPage;