import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../@/components/ui/card';
import { ChartContainer, ChartConfig } from '../../../../@/components/ui/chart';
import { apiClient } from '@/services/apiClient';
import BCUAlertsTable from '../../alertsTable/BCUAlertsTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import TimeFilterButtons from "../../RetailOutletHome/TimeFilterButtons";
import { Button } from "@/@/components/ui/button";
import { RotateCcw, AlertTriangle } from "lucide-react";

interface InterlockData {
  name: string;
  count: number;
  zoneBreakdown: { [zone: string]: number };
  locationBreakdown: { [location: string]: number };
}

interface ApiResponse {
  status: boolean;
  message: string;
  daily_data: {
    gantry: {
      [date: string]: {
        Normal: {
          details: Array<{
            sap_id: string;
            zone: string;
            location_name: string;
            bcu_number: string;
            interlock_name: string;
            count: number;
          }>;
          total: number;
        };
      };
    };
  };
}

const TASAlerts: React.FC = () => {
  const [interlockData, setInterlockData] = useState<InterlockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [selectedInterlock, setSelectedInterlock] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState("15d");
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [heatMapView, setHeatMapView] = useState<'zone' | 'location'>('zone');
  const [selectedHeatMapFilter, setSelectedHeatMapFilter] = useState<{
    zoneOrLocation?: string;
    interlock?: string;
    type?: 'zone' | 'location';
  } | null>(null);
  const tableRef = React.useRef<HTMLDivElement>(null);

  // Helper function to format interlock names (replace underscores with spaces)
  const formatInterlockName = (name: string) => {
    return name.replace(/_/g, ' ');
  };

  // Function to get date range from filters
  const getDateRangeFromFilters = () => {
    if (dateRangeFilter) {
      const [startDate, endDate] = dateRangeFilter.value.split(",");
      return `${startDate},${endDate}`;
    }

    if (timeFilter) {
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);
      const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000);
      const oneWeekAgo = new Date(Date.now() - 7 * 86400000);
      const oneMonthAgo = new Date(Date.now() - 30 * 86400000);
      const threeMonthsAgo = new Date(Date.now() - 90 * 86400000);

      const formatDate = (date: Date) => date.toISOString().split('T')[0];

      const timeFilterMap: { [key: string]: string } = {
        t: `${formatDate(today)},${formatDate(today)}`,
        "1d": `${formatDate(yesterday)},${formatDate(yesterday)}`,
        "1w": `${formatDate(oneWeekAgo)},${formatDate(today)}`,
        "15d": `${formatDate(fifteenDaysAgo)},${formatDate(today)}`,
        "1m": `${formatDate(oneMonthAgo)},${formatDate(today)}`,
        "3m": `${formatDate(threeMonthsAgo)},${formatDate(today)}`
      };
      return timeFilterMap[timeFilter] || `${formatDate(today)},${formatDate(today)}`;
    }

    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return `${formatDate(today)},${formatDate(today)}`;
  };

  // Function to fetch interlock data
  const fetchInterlockData = async () => {
    try {
      setLoading(true);
      const dateRange = getDateRangeFromFilters();
      const payload = {
        "action": "interlock_name_count",
        "drill_state": "date",
        "filters": [],
        "cross_filters": [{"key": "\"DATE\"", "cond": "equals", "value": dateRange}],
        "limit": 0,
        "time_grain": "week",
        "resp_format": "",
        "resp_level": ""
      };

      const response = await apiClient.post<ApiResponse>('/api/charts/generate_vis_data', payload);

      if (response.data.status) {
        // Filter for specific interlock names
        const targetInterlocks = [
          'Blend overdose Alarm_BCU',
          'Blend Underdose Alarm_BCU',
          'Additive Overdose Alarm_BCU',
          'Additive Underdose Alarm_BCU'
        ];

        // Process the data - group by interlock_name
        const interlockData: {
          [interlock: string]: {
            count: number;
            zones: { [zone: string]: number };
            locations: { [location: string]: number };
          }
        } = {};

        // Iterate through all dates and details
        Object.values(response.data.daily_data.gantry).forEach(dateData => {
          if (dateData.Normal && dateData.Normal.details) {
            dateData.Normal.details.forEach(detail => {
              if (targetInterlocks.includes(detail.interlock_name)) {
                const interlock = detail.interlock_name;

                // Initialize if not exists
                if (!interlockData[interlock]) {
                  interlockData[interlock] = {
                    count: 0,
                    zones: {},
                    locations: {}
                  };
                }

                // Update total count
                interlockData[interlock].count += detail.count;

                // Update zone count
                interlockData[interlock].zones[detail.zone] =
                  (interlockData[interlock].zones[detail.zone] || 0) + detail.count;

                // Update location count
                interlockData[interlock].locations[detail.location_name] =
                  (interlockData[interlock].locations[detail.location_name] || 0) + detail.count;
              }
            });
          }
        });

        // Convert to array format for cards
        const processedData: InterlockData[] = Object.entries(interlockData).map(([name, data]) => ({
          name,
          count: data.count,
          zoneBreakdown: data.zones,
          locationBreakdown: data.locations
        }));

        setInterlockData(processedData);
        setCardsError(null); // Clear any previous errors
      } else {
        setCardsError('Failed to fetch interlock data');
      }
    } catch (err) {
      console.error('Error fetching interlock data:', err);
      setCardsError('Failed to load interlock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterlockData();
  }, [timeFilter, dateRangeFilter]);

  // Prepare heat map data for all zones and interlocks
  const zoneHeatMapData = React.useMemo(() => {
    if (interlockData.length === 0) return { items: [], interlocks: [], data: [] };

    // Get all unique zones across all interlocks
    const allZones = new Set<string>();
    interlockData.forEach(interlock => {
      Object.keys(interlock.zoneBreakdown).forEach(zone => allZones.add(zone));
    });
    const zones = Array.from(allZones).sort();

    // Get all interlock names (should be 4)
    const interlocks = interlockData.map(d => d.name).sort();

    // Create heat map matrix: zones x interlocks
    const data = zones.map(zone => ({
      item: zone,
      values: interlocks.map(interlockName => {
        const interlock = interlockData.find(d => d.name === interlockName);
        return interlock ? (interlock.zoneBreakdown[zone] || 0) : 0;
      })
    }));

    return { items: zones, interlocks, data };
  }, [interlockData]);

  // Prepare heat map data for all locations and interlocks
  const locationHeatMapData = React.useMemo(() => {
    if (interlockData.length === 0) return { items: [], interlocks: [], data: [] };

    // Get all unique locations across all interlocks
    const allLocations = new Set<string>();
    interlockData.forEach(interlock => {
      Object.keys(interlock.locationBreakdown).forEach(location => allLocations.add(location));
    });
    const locations = Array.from(allLocations).sort();

    // Get all interlock names (should be 4)
    const interlocks = interlockData.map(d => d.name).sort();

    // Create heat map matrix: locations x interlocks
    const data = locations.map(location => ({
      item: location,
      values: interlocks.map(interlockName => {
        const interlock = interlockData.find(d => d.name === interlockName);
        return interlock ? (interlock.locationBreakdown[location] || 0) : 0;
      })
    }));

    return { items: locations, interlocks, data };
  }, [interlockData]);

  // Select current heat map data based on view
  const heatMapData = heatMapView === 'zone' ? zoneHeatMapData : locationHeatMapData;

  // Get max value for color intensity calculation
  const maxValue = React.useMemo(() => {
    let max = 0;
    heatMapData.data.forEach(row => {
      row.values.forEach(val => {
        if (val > max) max = val;
      });
    });
    return max;
  }, [heatMapData]);

  // Color intensity function
  const getHeatMapColor = (value: number) => {
    if (value === 0) return '#f3f4f6'; // Light gray for zero
    if (maxValue === 0) return '#dbeafe';
    const intensity = value / maxValue;
    if (intensity < 0.25) return '#dbeafe'; // Light blue
    if (intensity < 0.5) return '#93c5fd'; // Medium blue
    if (intensity < 0.75) return '#60a5fa'; // Dark blue
    return '#3b82f6'; // Deep blue
  };


  // Color functions for charts
  const getZoneColor = (zone: string) => {
    const colors: { [key: string]: string } = {
      'SZ': '#3b82f6', // Blue
      'NWZ': '#10b981', // Green
      'NEZ': '#f59e0b', // Yellow
      'SWZ': '#ec4899', // Pink
      'CWZ': '#8b5cf6', // Purple
    };
    return colors[zone] || '#6b7280'; // Default gray
  };

  const getLocationColor = (location: string) => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
      '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#a855f7'
    ];
    // Use location name hash to get consistent colors
    let hash = 0;
    for (let i = 0; i < location.length; i++) {
      hash = location.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Handler for location change
  const handleLocationChange = (locationId: string) => {
    console.log('Location changed:', locationId);
    // Handle location change logic here
  };

  // Generate query for BCUAlertsTable
  const generateTableQuery = () => {
    let baseQuery = `bu='TAS' AND alert_section='TAS'`;

    // Add date filtering
    const dateRange = getDateRangeFromFilters();
    if (dateRange && dateRange !== 'today,today') {
      const [startDate, endDate] = dateRange.split(',');
      baseQuery += ` AND created_at::DATE BETWEEN '${startDate}' AND '${endDate}'`;
    }

    // Add interlock filter if selected from card or heat map
    const interlockToFilter = selectedHeatMapFilter?.interlock || selectedInterlock;
    if (interlockToFilter) {
      baseQuery += ` AND interlock_name LIKE '%${interlockToFilter}%'`;
    }

    // Add zone/location filter if selected from heat map
    if (selectedHeatMapFilter?.zoneOrLocation) {
      if (selectedHeatMapFilter.type === 'zone') {
        baseQuery += ` AND zone = '${selectedHeatMapFilter.zoneOrLocation}'`;
      } else if (selectedHeatMapFilter.type === 'location') {
        baseQuery += ` AND location_name = '${selectedHeatMapFilter.zoneOrLocation}'`;
      }
    }

    // Add the interlock name filters from our cards (only if no specific interlock is selected)
    if (!interlockToFilter) {
      const targetInterlocks = [
        'Blend overdose Alarm_BCU',
        'Blend Underdose Alarm_BCU',
        'Additive Overdose Alarm_BCU',
        'Additive Underdose Alarm_BCU'
      ];

      if (targetInterlocks.length > 0) {
        const interlockConditions = targetInterlocks.map(name => `interlock_name = '${name}'`).join(' OR ');
        baseQuery += ` AND (${interlockConditions})`;
      }
    }

    return baseQuery;
  };

  // Handler for time filter change
  const handleTimeFilterChange = (filter: string) => {
    const filterMap: { [key: string]: string } = {
      today: "t",
      yesterday: "y",
      "1week": "1w",
      "1month": "1m",
      "3months": "3m",
    };

    setTimeFilter(filterMap[filter] || filter);
  };

  // Handler for date range change
  const handleDateRangeChange = (dateFilter: any) => {
    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
  };

  // Handler for refresh
  const handleRefresh = () => {
    setIsLoading(true);
    setResetTrigger(prev => prev + 1);

    // Refetch data (keep current filters)
    fetchInterlockData();

    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">BCU Alerts</h1>
        <div className="flex items-center gap-2">
          <TimeFilterButtons
            selectedFilter={timeFilter}
            onFilterChange={handleTimeFilterChange}
            onDateRangeChange={handleDateRangeChange}
            resetTrigger={resetTrigger}
          />
          <Button
            onClick={handleRefresh}
            className="h-7 px-2 py-1 text-xs font-medium rounded-lg transition-all bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-gray-200 hover:to-gray-300 border border-gray-300"
            disabled={isLoading}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cards Section */}
      <div className="mb-4">
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading interlock data...</div>
          </div>
        )}

        {cardsError && (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <div className="text-lg text-red-600">Failed to load interlock data</div>
              <div className="text-sm text-gray-500 mt-1">{cardsError}</div>
            </div>
          </div>
        )}

        {!loading && !cardsError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {interlockData.length > 0 ? (
              [...interlockData].sort((a, b) => b.count - a.count).map((interlock, index) => {
                const isSelected = selectedInterlock === interlock.name;

                return (
                  <Card
                    key={index}
                    className={`relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-200 shadow-md bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white'
                    }`}
                    onClick={() => {
                      const newSelection = isSelected ? null : interlock.name;
                      setSelectedInterlock(newSelection);
                      // Clear heat map filter when card is clicked
                      setSelectedHeatMapFilter(null);
                      // Scroll to table when a card is clicked
                      if (tableRef.current) {
                        setTimeout(() => {
                          tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }
                    }}
                  >
                    <CardContent className="p-2 relative">
                      {isSelected && (
                        <div className="absolute top-4 right-4">
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <div>
                        <h3 className={`text-sm font-medium leading-snug line-clamp-2 mb-2 px-2.5 py-1.5 rounded-md ${
                          isSelected
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          {formatInterlockName(interlock.name)}
                        </h3>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 leading-none">
                            {interlock.count}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Alerts
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full flex justify-center items-center h-32">
                <div className="text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-sm text-gray-500">No alerts found</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zone/Location-wise Alerts Heat Map */}
      <div className="mb-2">
        <Card className="shadow-md">
          <CardHeader className="p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-l font-semibold text-gray-700">
                {heatMapView === 'zone' ? 'Zone-wise' : 'Location-wise'} Alerts Heat Map
              </CardTitle>
              {!loading && !cardsError && (
                <div className="flex rounded-lg bg-gray-100 p-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHeatMapView('zone');
                      // Clear heat map filter when switching views
                      if (selectedHeatMapFilter?.type !== 'zone') {
                        setSelectedHeatMapFilter(null);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      heatMapView === 'zone'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Zones
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHeatMapView('location');
                      // Clear heat map filter when switching views
                      if (selectedHeatMapFilter?.type !== 'location') {
                        setSelectedHeatMapFilter(null);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      heatMapView === 'location'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Locations
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            {loading && (
              <div className="flex justify-center items-center h-64">
                <div className="text-lg">Loading heat map data...</div>
              </div>
            )}

            {cardsError && (
              <div className="flex justify-center items-center h-64">
                <div className="text-center">
                  <div className="text-4xl mb-2">⚠️</div>
                  <div className="text-lg text-red-600">Failed to load heat map data</div>
                  <div className="text-sm text-gray-500 mt-1">{cardsError}</div>
                </div>
              </div>
            )}

            {!loading && !cardsError && heatMapData.items.length > 0 && heatMapData.interlocks.length > 0 && (
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Header row with interlock names */}
                  <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: `${heatMapView === 'zone' ? '100px' : '150px'} repeat(${heatMapData.interlocks.length}, minmax(80px, 1fr))` }}>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center">
                      {heatMapView === 'zone' ? 'Zones' : 'Locations'}
                    </div>
                    {heatMapData.interlocks.map((interlock, idx) => (
                      <div
                        key={idx}
                        className="text-[10px] text-gray-600 text-center px-1.5 py-1 bg-gray-50 rounded"
                        title={interlock}
                      >
                        <div className="truncate">{interlock.split('_')[0]}</div>
                        <div className="text-[9px] text-gray-400 truncate">{interlock.split('_')[1] || ''}</div>
                      </div>
                    ))}
                  </div>

                  {/* Heat map rows */}
                  <div className="space-y-1">
                    {heatMapData.data.map((row, rowIdx) => (
                      <div
                        key={row.item}
                        className="grid gap-1.5 items-center"
                        style={{ gridTemplateColumns: `${heatMapView === 'zone' ? '100px' : '150px'} repeat(${heatMapData.interlocks.length}, minmax(80px, 1fr))` }}
                      >
                        {/* Item label (Zone or Location) */}
                        <div className="flex items-center gap-1.5">
                          {heatMapView === 'zone' ? (
                            <>
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getZoneColor(row.item) }}
                              />
                              <span className="text-xs text-gray-600">{row.item}</span>
                            </>
                          ) : (
                            <>
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getLocationColor(row.item) }}
                              />
                              <span className="text-xs text-gray-600 truncate" title={row.item}>
                                {row.item.length > 20 ? row.item.substring(0, 20) + '...' : row.item}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Heat map cells */}
                        {row.values.map((value, colIdx) => {
                          const isSelected = selectedHeatMapFilter?.zoneOrLocation === row.item && 
                                           selectedHeatMapFilter?.interlock === heatMapData.interlocks[colIdx] &&
                                           selectedHeatMapFilter?.type === heatMapView;
                          
                          return (
                            <div
                              key={colIdx}
                              className={`relative group h-8 rounded border flex items-center justify-center transition-all hover:shadow-sm cursor-pointer ${
                                isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                              }`}
                              style={{
                                backgroundColor: getHeatMapColor(value)
                              }}
                              title={`${row.item} • ${heatMapData.interlocks[colIdx]}: ${value} alerts`}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Set filter and scroll to table
                                setSelectedHeatMapFilter({
                                  zoneOrLocation: row.item,
                                  interlock: heatMapData.interlocks[colIdx],
                                  type: heatMapView
                                });
                                // Clear card selection when heat map is clicked
                                setSelectedInterlock(null);
                                // Scroll to table
                                if (tableRef.current) {
                                  setTimeout(() => {
                                    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 100);
                                }
                              }}
                            >
                              <span className={`text-xs font-medium ${
                                value === 0 ? 'text-gray-400' : 'text-gray-700'
                              }`}>
                                {value}
                              </span>
                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                                <div className="bg-gray-900 text-white text-[10px] rounded py-0.5 px-1.5 whitespace-nowrap">
                                  {heatMapData.interlocks[colIdx]}
                                  <br />
                                  <span className="font-medium">{value} alerts</span>
                                </div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-500">Intensity:</span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            <div className="w-3 h-3 rounded bg-gray-200"></div>
                            <span className="text-[9px] text-gray-400">0</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <div className="w-3 h-3 rounded bg-blue-200"></div>
                            <span className="text-[9px] text-gray-400">Low</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <div className="w-3 h-3 rounded bg-blue-400"></div>
                            <span className="text-[9px] text-gray-400">Med</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <div className="w-3 h-3 rounded bg-blue-600"></div>
                            <span className="text-[9px] text-gray-400">High</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Max: {maxValue}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* BCU Alerts Table */}
      {interlockData.length > 0 && !cardsError && (
        <div ref={tableRef} className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-l font-semibold">Detailed Alerts Table</h2>
            {(selectedInterlock || selectedHeatMapFilter) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600">Filtered by:</span>
                {selectedHeatMapFilter && (
                  <>
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                      {selectedHeatMapFilter.type === 'zone' ? 'Zone' : 'Location'}: {selectedHeatMapFilter.zoneOrLocation}
                    </span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      {formatInterlockName(selectedHeatMapFilter.interlock || '')}
                    </span>
                  </>
                )}
                {selectedInterlock && !selectedHeatMapFilter && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                    {formatInterlockName(selectedInterlock)}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSelectedInterlock(null);
                    setSelectedHeatMapFilter(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-sm underline"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>
          <BCUAlertsTable
            query={generateTableQuery()}
            selectedInterlock={selectedHeatMapFilter?.interlock || selectedInterlock}
            onLocationChange={handleLocationChange}
            key={`tas-alerts-${selectedInterlock}-${selectedHeatMapFilter?.zoneOrLocation}-${selectedHeatMapFilter?.interlock}-${timeFilter}-${dateRangeFilter?.value || 'no-range'}-${interlockData.length}`}
          />
        </div>
      )}
    </div>
  );
};

export default TASAlerts;
