import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiClient } from "@/services/apiClient";
import { Card, CardContent } from "@/@/components/ui/card";
import { Search } from 'lucide-react';
import DataGrid from '@/components/common/DataGrid';

interface PlantDetail {
  LocationName: string;
  Plant_cd: string;
  energy_generated: string;
  estimated_energy?: string;
  efficiency: string;
}

// Category to data field mapping - shared constant
export const EFFICIENCY_CATEGORY_DATA_FIELD_MAP: { [key: string]: string } = {
  'Exceptional': 'exceptional_data',
  'Normal': 'normal_data',
  'Underperforming': 'underperforming_data',
  'Critical': 'critical_data'
};

// Category values that match the keys above
export const EFFICIENCY_CATEGORIES = ['Exceptional', 'Normal', 'Underperforming', 'Critical'] as const;
export type EfficiencyCategory = typeof EFFICIENCY_CATEGORIES[number];

const normalizeEfficiencyCategory = (category: string | null): EfficiencyCategory | null => {
  if (!category) return null;
  const cleaned = category
    .replace(/\n/g, ' ')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (cleaned.includes('exceptional')) return 'Exceptional';
  if (cleaned.includes('underperforming')) return 'Underperforming';
  if (cleaned.includes('normal')) return 'Normal';
  if (cleaned.includes('critical')) return 'Critical';
  return null;
};

interface EfficiencyPlantDetailsTableProps {
  selectedCategory: string | null;
  onBackClick: () => void;
  zone?: string[] | string;
  timeFilter?: string | null | { key: string; cond: string; value: string };
  selectedLocation?: string | null;
  selectedPlant?: string | null;
  bu?: string;
}

const EfficiencyPlantDetailsTable: React.FC<EfficiencyPlantDetailsTableProps> = ({
  selectedCategory,
  onBackClick,
  zone,
  timeFilter,
  selectedLocation = null,
  selectedPlant = null,
  bu = 'TAS',
}) => {
  const [plantDetails, setPlantDetails] = useState<PlantDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const gridApiRef = useRef<{ sizeColumnsToFit: () => void } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Function to get the correct date filter value
  const getDateFilterValue = (filter: string | null | { key: string; cond: string; value: string } | undefined): string => {
    // Handle date range objects (custom date ranges)
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      // This is a custom date range filter - return the value as is
      return filter.value;
    }

    // Handle string filters
    if (typeof filter === 'string') {
      const filterMap: { [key: string]: string } = {
        't': 't',           // Today
        'tdy': 't',         // Today (alternative)
        '1d': '1d',         // Yesterday
        'ydy': '1d',        // Yesterday (alternative)
        '1w': '1w',         // 1 Week
        '15d': '15d',       // 15 Days
        '1m': '1m',         // 1 Month
        '3m': '3m',         // 3 Months
        'custom': 'custom'  // Date Range
      };
      return filterMap[filter.toLowerCase()] || filter; // Return original filter if not in map
    }

    // Default to today
    return 't';
  };

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return plantDetails;

    return plantDetails.filter(item =>
      Object.values(item).some(value =>
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [plantDetails, searchTerm]);

  // Dynamic table height: min 2 rows, grow with data, cap at 20 visible rows (matches paginationPageSize)
  const TABLE_HEADER_HEIGHT = 40;
  const TABLE_ROW_HEIGHT = 28;
  const TABLE_MIN_VISIBLE_ROWS = 4;
  const TABLE_MAX_VISIBLE_ROWS = 20;
  const tableHeight = TABLE_HEADER_HEIGHT + Math.max(TABLE_MIN_VISIBLE_ROWS, Math.min(filteredData.length, TABLE_MAX_VISIBLE_ROWS)) * TABLE_ROW_HEIGHT;

  useEffect(() => {
    if (selectedCategory) {
      fetchPlantDetails();
    }
  }, [selectedCategory, zone, timeFilter, selectedPlant, selectedLocation, bu]);

  const fetchPlantDetails = async () => {
    const normalizedCategory = normalizeEfficiencyCategory(selectedCategory);
    if (!normalizedCategory) return;

    // Ensure selectedCategory matches one of the valid categories from EFFICIENCY_CATEGORIES
    // This ensures it maps correctly to the data fields (exceptional_data, normal_data, etc.)
    if (!EFFICIENCY_CATEGORIES.includes(normalizedCategory)) {
      console.warn(`Invalid category: ${selectedCategory}. Expected one of: ${EFFICIENCY_CATEGORIES.join(', ')}`);
      setPlantDetails([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const filterValue = getDateFilterValue(timeFilter);

      // Map category to efficiency filter - using same category values as data field map
      const efficiencyFilter: { [key: string]: string } = {
        'Exceptional': 'exceptional',
        'Normal': 'normal',
        'Underperforming': 'underperforming',
        'Critical': 'critical'
      };

      const selectedLocationName = selectedLocation || selectedPlant;
      const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');
      const payload = {
        "bu": apiBU,
        "action": "get_efficiency",
        "filters": [
          {"key":"bu","cond":"=","value": apiBU},
          {"key":"timestamp_ist","cond":"date_filter","value": filterValue},
          ...(zone ? [{"key":"zone","cond":"=","value": Array.isArray(zone) ? zone[0]?.toUpperCase() : zone.toUpperCase()}] : []),
          ...(selectedLocationName ? [{"key":"location_name","cond":"=","value": selectedLocationName}] : []),
          {"key":"efficiency_category","cond":"=","value": efficiencyFilter[normalizedCategory] || normalizedCategory.toLowerCase()}
        ],
        "drill_state": "",
        "cross_filters": [],
        "limit": 0,
        "time_grain": "",
        "category": ""
      };

      const response = await apiClient.post('/api/solarpanelcleaning/get_solar_dashboard_summary', payload);

      // Use shared category to data field mapping
      const dataField = EFFICIENCY_CATEGORY_DATA_FIELD_MAP[normalizedCategory] || 'critical_data';

      // Get zone value for matching
      const zoneValue = zone ? (Array.isArray(zone) ? zone[0]?.toUpperCase() : zone.toUpperCase()) : null;

      // Check if response has direct data field (when zone filter is applied and API returns direct format)
      if (response && response.data && response.data[dataField] && Array.isArray(response.data[dataField])) {
        // If we have a plant filter, filter the data to show only the selected plant
        if (selectedLocationName) {
          const plantValue = selectedLocationName.toUpperCase();
          const filteredData = response.data[dataField].filter((plant: any) => {
            if (!plant) return false;
            // Match by LocationName (most common case)
            return (
              plant.LocationName?.toUpperCase() === plantValue ||
              plant.Plant_cd?.toString() === plantValue ||
              plant['BU Code']?.toUpperCase() === plantValue ||
              plant.plant?.toUpperCase() === plantValue
            );
          });
          setPlantDetails(filteredData);
        } else {
          // No plant filter, show all data
          setPlantDetails(response.data[dataField]);
        }
      } 
      // Check if response has heatmap_data structure (array of zones/plants)
      else if (response && response.data && response.data.heatmap_data && Array.isArray(response.data.heatmap_data)) {
        // If we have a plant filter, find the matching plant entry in heatmap_data
        if (selectedLocationName) {
          const plantValue = selectedLocationName.toUpperCase();
          
          // First, try to find the plant entry by matching the 'plant' field in heatmap_data
          // This is the structure when in plant-level view
          const plantEntry = response.data.heatmap_data.find((item: any) => {
            if (!item) return false;
            // Match by plant field (for plant-level view)
            return (
              item.plant?.toUpperCase() === plantValue ||
              item.zone?.toUpperCase() === plantValue ||
              item.zone_name?.toUpperCase() === plantValue
            );
          });
          
          if (plantEntry && plantEntry[dataField] && Array.isArray(plantEntry[dataField])) {
            // Found the plant entry, use its category data directly
            setPlantDetails(plantEntry[dataField]);
          } else {
            // Fallback: search through all data arrays for matching plants
            // This handles cases where plant data might be nested differently
            const matchingPlants: PlantDetail[] = [];
            response.data.heatmap_data.forEach((item: any) => {
              if (item && item[dataField] && Array.isArray(item[dataField])) {
                // Filter plants that match the selected plant identifier
                const filtered = item[dataField].filter((plant: any) => {
                  if (!plant) return false;
                  // Check if plant matches by LocationName, Plant_cd, BU Code, or plant field
                  return (
                    plant.LocationName?.toUpperCase() === plantValue ||
                    plant.Plant_cd?.toString() === plantValue ||
                    plant['BU Code']?.toUpperCase() === plantValue ||
                    plant.plant?.toUpperCase() === plantValue
                  );
                });
                matchingPlants.push(...filtered);
              }
            });
            setPlantDetails(matchingPlants);
          }
        }
        // If we have a zone filter, find the matching zone entry
        else if (zoneValue) {
          const zoneData = response.data.heatmap_data.find((item: any) => 
            item && (item.zone?.toUpperCase() === zoneValue || item.zone_name?.toUpperCase() === zoneValue)
          );
          if (zoneData && zoneData[dataField] && Array.isArray(zoneData[dataField])) {
            setPlantDetails(zoneData[dataField]);
          } else {
            setPlantDetails([]);
          }
        } else {
          // No zone/plant filter - aggregate all matching category data from all zones/plants
          const allData: PlantDetail[] = [];
          response.data.heatmap_data.forEach((zoneItem: any) => {
            if (zoneItem && zoneItem[dataField] && Array.isArray(zoneItem[dataField])) {
              allData.push(...zoneItem[dataField]);
            }
          });
          setPlantDetails(allData);
        }
      } else {
        setPlantDetails([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch plant details:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load plant details');
      setPlantDetails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getPaginatedData = (data: PlantDetail[], page: number, perPage: number) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: PlantDetail[], itemsPerPage: number) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const columnDefs = useMemo(() => [
    { headerName: 'Location Name', field: 'LocationName', minWidth: 140 },
    { headerName: 'Plant Code', field: 'Plant_cd', minWidth: 110 },
    { headerName: 'Energy Generated (KWH)', field: 'energy_generated', minWidth: 160 },
    { headerName: 'Estimated Energy (KWH)', field: 'estimated_energy', minWidth: 160 },
    { headerName: 'Efficiency (%)', field: 'efficiency', minWidth: 120 },
  ], []);

  const defaultColDef = useMemo(() => ({
    flex: 1,
    resizable: true,
    sortable: true,
    filter: false,
    suppressMenu: true,
  }), []);

  const sizeColumnsToFit = useCallback(() => {
    gridApiRef.current?.sizeColumnsToFit();
  }, []);

  const onGridReady = useCallback((params: { api: { sizeColumnsToFit: () => void } }) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
    // Re-fit after layout settles (panel open / small screen)
    requestAnimationFrame(() => params.api.sizeColumnsToFit());
    setTimeout(() => params.api.sizeColumnsToFit(), 100);
  }, []);

  // Re-fit when container size changes (resize, panel open, orientation)
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      gridApiRef.current?.sizeColumnsToFit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!selectedCategory && !isLoading && !error && filteredData.length > 0]);

  // Re-fit when data loads or changes
  useEffect(() => {
    if (filteredData.length === 0) return;
    const t = setTimeout(sizeColumnsToFit, 50);
    return () => clearTimeout(t);
  }, [filteredData.length, sizeColumnsToFit]);

  return (
    <Card className="w-full min-w-0 bg-white border border-gray-200 shadow-none">
      <CardContent className="p-2 w-full min-w-0 overflow-x-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {selectedCategory} Plant Details
            </h3>
          </div>
          <div className="flex items-center gap-2 -mr-1">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search plants..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-8 pr-8 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0 text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center text-xs"
                title="Clear search"
              >
                ✕
              </button>
            </div>
            <button
              onClick={onBackClick}
              className="w-6 h-6 flex-shrink-0 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors flex items-center justify-center text-sm"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="text-gray-500 text-sm">Loading plant details...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-4">
            <div className="text-red-500 text-sm">{error}</div>
          </div>
        )}

        {/* Table - DataGrid (AlertTableV2 style) */}
        {!isLoading && !error && filteredData.length > 0 && (
          <div
            ref={tableContainerRef}
            className={`w-full min-w-0 border border-gray-200 overflow-hidden bg-white ${
              normalizeEfficiencyCategory(selectedCategory) === 'Critical' ? 'critical-plant-details-visible-scroll' : ''
            }`}
            style={{ width: '100%', maxWidth: '100%' }}
          >
            {normalizeEfficiencyCategory(selectedCategory) === 'Critical' && (
              <style>{`
                .critical-plant-details-visible-scroll .ag-body-viewport,
                .critical-plant-details-visible-scroll .ag-center-cols-viewport,
                .critical-plant-details-visible-scroll .ag-body-horizontal-scroll-viewport {
                  -ms-overflow-style: auto !important;
                  scrollbar-width: thin !important;
                  scrollbar-color: #94a3b8 #e2e8f0 !important;
                }
                .critical-plant-details-visible-scroll .ag-body-viewport::-webkit-scrollbar,
                .critical-plant-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar,
                .critical-plant-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
                  display: block !important;
                  width: 10px;
                  height: 10px;
                }
                .critical-plant-details-visible-scroll .ag-body-viewport::-webkit-scrollbar-thumb,
                .critical-plant-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar-thumb,
                .critical-plant-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
                  background: #94a3b8;
                  border-radius: 5px;
                }
                .critical-plant-details-visible-scroll .ag-body-viewport::-webkit-scrollbar-track,
                .critical-plant-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar-track,
                .critical-plant-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
                  background: #f1f5f9;
                }
              `}</style>
            )}
            <div className="w-full min-w-0 [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell-text]:!font-semibold [&_.ag-header-cell-text]:!text-sm [&_.ag-header-cell]:!py-2 [&_.ag-header-cell]:!px-3 [&_.ag-header-cell]:!min-h-0 [&_.ag-cell]:!text-gray-800 [&_.ag-cell]:!text-xs [&_.ag-cell]:!font-normal [&_.ag-cell]:!py-1 [&_.ag-row]:!min-h-0 [&_.ag-root]:!w-full [&_.ag-body-viewport]:!w-full [&_.ag-center-cols-viewport]:!w-full" style={{ minHeight: `${TABLE_HEADER_HEIGHT + TABLE_MIN_VISIBLE_ROWS * TABLE_ROW_HEIGHT}px`, width: '100%', maxWidth: '100%' }}>
              <DataGrid
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowData={filteredData}
                loading={false}
                height={`${tableHeight}px`}
                width="100%"
                style={{ minWidth: 0 }}
                headerHeight={TABLE_HEADER_HEIGHT}
                gridOptions={{ rowHeight: 28 }}
                pagination={true}
                paginationPageSize={20}
                rowSelection="single"
                suppressRowClickSelection={true}
                onGridReady={onGridReady}
              />
            </div>
          </div>
        )}

        {/* No Data State */}
        {!isLoading && !error && filteredData.length === 0 && searchTerm && (
          <div className="border border-gray-200 overflow-hidden bg-white">
            <div className="text-center py-3">
              <p className="text-gray-600 font-medium text-sm">No plants found matching "{searchTerm}"</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && plantDetails.length === 0 && !searchTerm && (
          <div className="border border-gray-200 overflow-hidden bg-white">
            <div className="text-center py-3">
              <p className="text-gray-600 font-medium text-sm">No plant details available</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EfficiencyPlantDetailsTable;