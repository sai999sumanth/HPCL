import React, { useState, useCallback } from 'react';
import { Settings, User, RefreshCw, Search, Download } from 'lucide-react';
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from '@/@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';
import CEMSHeader from './CEMSHeader';
import CEMSKPICards from './CEMSKPICards';
import EfficiencyClassificationChart from './EfficiencyClassificationChart';
import EfficiencyHeatMap from './EfficiencyHeatMap';
import GenerationInsights from './GenerationInsights';
import EfficiencyPlantDetailsTable from './EfficiencyPlantDetailsTable';
import GenerationTrendChart from './GenerationTrendChart';
import SolarDashboardSummaryTable from './SolarDashboardSummaryTable';
import PanelCleaningImpact from './PanelCleaningImpact';

const CEMSDashboard: React.FC = () => {
  // Filter states
  const [selectedBu, setSelectedBu] = useState<string>('TAS');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null | { key: string; cond: string; value: string }>('1W');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: Date, end: Date } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [panelCleaningRefreshKey, setPanelCleaningRefreshKey] = useState(0);
  const [panelCleaningIsRefreshing, setPanelCleaningIsRefreshing] = useState(false);
  const [efficiencyDrillType, setEfficiencyDrillType] = useState<'zone' | 'plant'>('zone');
  const [selectedEfficiencyCategory, setSelectedEfficiencyCategory] = useState<string | null>(null);
  const [selectedCriticalAlertLocation, setSelectedCriticalAlertLocation] = useState<string | null>(null);
  const [clickedZoneFromHeatMap, setClickedZoneFromHeatMap] = useState<string | null>(null);
  const [clickedPlantFromHeatMap, setClickedPlantFromHeatMap] = useState<string | null>(null);
  const [generationInsightsSearch, setGenerationInsightsSearch] = useState('');
  const [isGenerationDownloadLoading, setIsGenerationDownloadLoading] = useState(false);

  // Sample efficiency heat map data - replace with actual API data
  const efficiencyHeatMapData = {
    'Exceptional (>100%)': [
      { zone: 'CZ', efficiency: 105 },
      { zone: 'NZ', efficiency: 102 },
      { zone: 'WZ', efficiency: 108 },
    ],
    'Normal (90-99%)': [
      { zone: 'CZ', efficiency: 95 },
      { zone: 'EZ', efficiency: 92 },
      { zone: 'NCZ', efficiency: 94 },
      { zone: 'NFZ', efficiency: 96 },
      { zone: 'NWF', efficiency: 93 },
      { zone: 'NWZ', efficiency: 91 },
      { zone: 'NZ', efficiency: 98 },
      { zone: 'SCZ', efficiency: 97 },
      { zone: 'SWZ', efficiency: 90 },
      { zone: 'SZ', efficiency: 95 },
      { zone: 'WZ', efficiency: 99 },
    ],
    'Underperforming (<=90%)': [
      { zone: 'ECZ', efficiency: 85 },
      { zone: 'NFZ', efficiency: 88 },
      { zone: 'SWZ', efficiency: 82 },
    ],
    'Critical (<50%)': [
      { zone: 'ECZ', efficiency: 45 },
      { zone: 'SWZ', efficiency: 38 },
    ],
  };

  // Handle plant change (includes zone parameter)
  const handlePlantChange = (plant: string | null, zone: string | null) => {
    setSelectedPlant(plant);
    setSelectedZone(zone);
  };

  const handlePlantDisplayNameChange = (plantName: string | null) => {
    setSelectedCriticalAlertLocation(plantName);
  };

  // Handle time filter change and map to date filter format for KPI cards
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
        setSelectedTimeFilter(filter); // Pass the actual date range object to KPI cards
      }
    } else {
      // Regular time filter (string or null)
      setSelectedTimeFilter(filter as string | null);
      setDateRangeFilter(null);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    // Reset all filters to their default state
    setSelectedBu('TAS');
    setSelectedZone(null);
    setSelectedPlant(null);
    setSelectedCriticalAlertLocation(null);
    setSelectedTimeFilter('1W');
    setDateRangeFilter(null);
    // Clear Efficiency Plant Details (Exceptional / Normal / etc.) so the details table is hidden
    setSelectedEfficiencyCategory(null);
    setClickedZoneFromHeatMap(null);
    setClickedPlantFromHeatMap(null);
    setRefreshKey(prev => prev + 1);
    setPanelCleaningRefreshKey(prev => prev + 1); // also refresh Panel Cleaning on global refresh
    setIsRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Refresh only the Impact of Panel Cleaning card (does not affect other cards)
  const handlePanelCleaningRefresh = () => {
    setPanelCleaningRefreshKey(prev => prev + 1);
    setPanelCleaningIsRefreshing(true);
    setTimeout(() => {
      setPanelCleaningIsRefreshing(false);
    }, 500);
  };

  const handleEfficiencyCategorySelect = useCallback((category: string | null) => {
    setSelectedEfficiencyCategory(category);
    setClickedZoneFromHeatMap(null);
    setClickedPlantFromHeatMap(null);
  }, []);

  const handleHeatMapCellClick = useCallback((category: string | null, clickedZoneOrPlant: string | null, drillType: 'zone' | 'plant') => {
    setSelectedEfficiencyCategory(category);
    if (drillType === 'plant') {
      setClickedPlantFromHeatMap(clickedZoneOrPlant);
      setClickedZoneFromHeatMap(null);
    } else {
      setClickedZoneFromHeatMap(clickedZoneOrPlant);
      setClickedPlantFromHeatMap(null);
    }
  }, []);

  const handleEfficiencyTableBack = () => {
    setSelectedEfficiencyCategory(null)
    setClickedZoneFromHeatMap(null);
    setClickedPlantFromHeatMap(null);
  };

  const getDateFilterValue = (filter: string | null | { key: string; cond: string; value: string } | undefined): string => {
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      return filter.value;
    }

    if (typeof filter === 'string') {
      const filterMap: { [key: string]: string } = {
        't': 't',
        'tdy': 't',
        'TDY': 't',
        '1d': '1d',
        'ydy': '1d',
        'YDY': '1d',
        '1w': '1w',
        '1W': '1w',
        '15d': '15d',
        '15D': '15d',
        '1m': '1m',
        '1M': '1m',
        '3m': '3m',
        '3M': '3m',
        'custom': 'custom',
      };
      return filterMap[filter] || filterMap[filter.toLowerCase()] || filter;
    }

    return '1m';
  };

  const handleGenerationInsightsDownload = async () => {
    try {
      setIsGenerationDownloadLoading(true);

      const filterValue = getDateFilterValue(selectedTimeFilter);
      const filters: any[] = [];

      if (filterValue) {
        filters.push({
          key: "timestamp_ist",
          cond: "date_filter",
          value: filterValue,
        });
      }

      if (selectedZone) {
        filters.push({
          key: "zone",
          cond: "=",
          value: selectedZone.toUpperCase(),
        });
      }

      if (selectedPlant) {
        filters.push({
          key: "sap_id",
          cond: "=",
          value: selectedPlant,
        });
      }

      if (selectedCriticalAlertLocation) {
        filters.push({
          key: "location_name",
          cond: "=",
          value: selectedCriticalAlertLocation,
        });
      }

      const payload = {
        bu: selectedBu === "TAS" ? "SOD" : selectedBu,
        action: "get_insights",
        filters: [
          { key: "bu", cond: "=", value: selectedBu === "TAS" ? "SOD" : selectedBu },
          ...filters,
        ],
        drill_state: "",
        cross_filters: [],
        limit: 0,
        time_grain: "",
        category: "",
        is_download: true,
      };

      const response = await apiClient.post('/api/solarpanelcleaning/get_solar_dashboard_summary', payload);
      const raw = response?.data?.data ?? response?.data ?? response;

      let rows: any[] = [];
      if (Array.isArray(raw)) {
        rows = raw;
      } else if (raw && Array.isArray(raw.data)) {
        rows = raw.data;
      } else if (raw) {
        rows = [raw];
      }

      if (!rows.length) {
        toast.error("No data available to download");
        return;
      }

      const exportFields = [
        'sap_id',
        'actual_energy',
        'estimated_energy',
        'energy_generation_hours',
        'solar_window_hours',
        'export_available_hour',
        'power_outage',
        'adjusted_expected',
        'loss_of_power_outage',
        'loss_of_power_outage_percentage',
        'loss_dust_soil_percentage',
        'total_loss',
        'grid_availability_percentage',
      ];

      const headers: Record<string, string> = {
        sap_id: 'SAP ID',
        actual_energy: 'Actual Energy (KWH)',
        estimated_energy: 'Estimated Energy (KWH)',
        energy_generation_hours: 'Energy Generation Hours',
        solar_window_hours: 'Solar Window Hours',
        export_available_hour: 'Export Available Hour',
        power_outage: 'Power Outage',
        adjusted_expected: 'Adjusted Expected',
        loss_of_power_outage: 'Loss of Power Outage (KWH)',
        loss_of_power_outage_percentage: 'Power Outage Loss (%)',
        loss_dust_soil_percentage: 'Dust/Misc. Loss (%)',
        total_loss: 'Total Loss (%)',
        grid_availability_percentage: 'Grid Availability (%)',
      };

      const formattedData = rows.map((row) => {
        const formattedRow: Record<string, any> = {};
        exportFields.forEach((field) => {
          const header = headers[field] || field;
          formattedRow[header] = row[field] ?? "-";
        });
        return formattedRow;
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Generation Insights");
      const filename = `generation_insights_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast.success(`Downloaded ${rows.length} records`);
    } catch (error: any) {
      console.error('Failed to download generation insights:', error);
      const message = error?.response?.data?.message || error.message || 'Failed to download generation insights';
      toast.error(`Download failed: ${message}`);
    } finally {
      setIsGenerationDownloadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-[1920px] mx-auto space-y-3">
        {/* Header Section - VTS-style header card */}
        <CEMSHeader
          selectedBu={selectedBu}
          onBuChange={setSelectedBu}
          selectedZone={selectedZone}
          onZoneChange={setSelectedZone}
          selectedPlant={selectedPlant}
          onPlantChange={handlePlantChange}
          onPlantDisplayNameChange={handlePlantDisplayNameChange}
          timeFilter={selectedTimeFilter}
          onTimeFilterChange={onTimeFilterChange}
          onRefresh={handleRefresh}
          isLoading={isRefreshing}
          refreshKey={refreshKey}
        />

        {/* KPI Cards Section - Pass selectedTimeFilter as dateFilter */}
        <CEMSKPICards 
          zone={selectedZone} 
          dateFilter={selectedTimeFilter || '1W'}
          refreshKey={refreshKey}
          selectedLocation={selectedCriticalAlertLocation}
          selectedPlant={selectedPlant}
          bu={selectedBu}
        />

        {/* First Charts Row: Efficiency Classification | Heat Map - VTS-style card */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-100 space-y-0">
          <CardHeader className="border-b border-gray-100 p-2">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Efficiency Classification
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="inline-flex rounded-md overflow-hidden border">
                  <button
                    type="button"
                    onClick={() => setEfficiencyDrillType('zone')}
                    className={`px-2.5 h-6 text-xs ${efficiencyDrillType === 'zone' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                  >
                    Zone
                  </button>
                  <button
                    type="button"
                    onClick={() => setEfficiencyDrillType('plant')}
                    className={`px-2.5 h-6 text-xs border-l ${efficiencyDrillType === 'plant' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                  >
                    Plant
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-1">
            <div className="flex flex-col lg:flex-row lg:items-stretch w-full gap-1">
              <div className="lg:w-[35%] lg:flex-shrink-0">
            
                <h3 className="text-xs font-bold text-center">
  Efficiency Classification Breakup
</h3>

<div className="-mt-4">
  <EfficiencyClassificationChart
    zone={selectedZone}
    timeFilter={selectedTimeFilter}
    onCategorySelect={handleEfficiencyCategorySelect}
    refreshKey={refreshKey}
    selectedLocation={selectedCriticalAlertLocation}
    selectedPlant={selectedPlant}
    bu={selectedBu}
  />
</div>
              </div>
              <div className="lg:w-[65%] lg:flex-grow">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-bold text-center flex-1">
                    {efficiencyDrillType.charAt(0).toUpperCase() + efficiencyDrillType.slice(1)} - Efficiency Heat Map
                  </h3>
                </div>
              
<div className="-mt-4">
  <EfficiencyHeatMap
    drillType={efficiencyDrillType}
    zone={selectedZone}
    timeFilter={selectedTimeFilter}
    refreshKey={refreshKey}
    selectedLocation={selectedCriticalAlertLocation}
    selectedPlant={selectedPlant}
    bu={selectedBu}
    onCellClick={handleHeatMapCellClick}
  />
</div>
              </div>
            </div>
            {/* Efficiency Plant Details Table - inside this card when slice/cell is clicked */}
            {selectedEfficiencyCategory && (
              <div className="w-full min-w-0 -mt-5 pt-3 overflow-x-auto" data-efficiency-details-table>
                <EfficiencyPlantDetailsTable
                  selectedCategory={selectedEfficiencyCategory}
                  onBackClick={handleEfficiencyTableBack}
                  zone={clickedZoneFromHeatMap || selectedZone}
                  timeFilter={selectedTimeFilter}
                  selectedLocation={selectedCriticalAlertLocation}
                  selectedPlant={clickedPlantFromHeatMap || selectedPlant}
                  bu={selectedBu}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generation Insights Card - Full Width - VTS-style */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-100 space-y-0">
          <CardHeader className="border-b border-gray-100 p-2">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Generation Insights
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={generationInsightsSearch}
                    onChange={(e) => setGenerationInsightsSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setGenerationInsightsSearch('')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0 text-gray rounded-full hover:bg-gray-600 hover:text-white transition-colors flex items-center justify-center text-[10px]"
                    title="Clear search"
                  >
                    ✕
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerationInsightsDownload}
                  disabled={isGenerationDownloadLoading}
                  className="inline-flex items-center justify-center p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Download Generation Insights"
                >
                  {isGenerationDownloadLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2">
            <GenerationInsights 
              zone={selectedZone}
              timeFilter={selectedTimeFilter}
              refreshKey={refreshKey}
              selectedLocation={selectedCriticalAlertLocation}
              selectedPlant={selectedPlant}
              bu={selectedBu}
              searchTerm={generationInsightsSearch}
              onSearchChange={setGenerationInsightsSearch}
            />
          </CardContent>
        </Card>

        {/* Generation & Efficiency Trend Card - Full Width - VTS-style */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-100 space-y-0">
          <CardHeader className="border-b border-gray-100 p-2">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Generation & Efficiency Trend
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-2">
            <GenerationTrendChart 
              zone={selectedZone}
              timeFilter={selectedTimeFilter}
              refreshKey={refreshKey}
              selectedLocation={selectedCriticalAlertLocation}
              selectedPlant={selectedPlant}
              bu={selectedBu}
            />
          </CardContent>
        </Card>

        {/* Solar Dashboard Summary Table */}
        <SolarDashboardSummaryTable
          zone={selectedZone}
          timeFilter={selectedTimeFilter}
          refreshKey={refreshKey}
          bu={selectedBu}
          plant={selectedPlant}
          selectedLocation={selectedCriticalAlertLocation}
        />

        {/* Panel Cleaning Impact - same card style as Critical Plant Details */}
        <Card className="w-full min-w-0 bg-white rounded-xl shadow-sm border border-gray-100 space-y-0">
          <CardHeader className="border-b border-gray-100 p-2">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Impact of Panel Cleaning
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePanelCleaningRefresh}
                disabled={panelCleaningIsRefreshing}
                className="bg-blue-600 hover:bg-blue-700 text-white p-1 px-2 rounded-md flex items-center gap-2 h-7 text-xs"
              >
                <RefreshCw className={`h-4 w-4 ${panelCleaningIsRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 w-full min-w-0 overflow-x-auto">
            <PanelCleaningImpact
              zone={selectedZone}
              timeFilter={selectedTimeFilter}
              refreshKey={panelCleaningRefreshKey}
              bu={selectedBu}
              plant={selectedPlant}
              selectedLocation={selectedCriticalAlertLocation}
            />
          </CardContent>
        </Card>

        {/* Plant Performance Table */}
        {/* <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-2">
            <PlantPerformanceTable />
          </CardContent>
        </Card> */}
      </div>
    </div>
  );
};

export default CEMSDashboard;