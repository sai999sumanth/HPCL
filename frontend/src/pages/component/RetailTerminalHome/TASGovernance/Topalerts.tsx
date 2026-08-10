import React, { useLayoutEffect, useState, useEffect, useRef, useCallback } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { apiClient } from '@/services/apiClient';
import { Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, X, Info, Download } from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/@/components/ui/dialog';

// Chart bar color for Top 5 Open Alerts
const CHART_COLOR = "#8B5E83";

// Same palette as Alarms.tsx legend/chart for consistent TAS Governance colors
const LEGEND_COLORS = [
  "#00a2ff", "#f3a200", "#67b7dc", "#e26b6b", "#80c342",
  "#a0a0a0", "#ffd966", "#9966ff", "#00cc99", "#ff6699",
];

interface TopAlertsProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
}

interface AlertData {
  interlock_name: string;
  count: number;
}

interface AlertDetail {
  unique_id?: string;
  zone?: string;
  location_name?: string;
  interlock_name?: string;
  severity?: string;
  alert_status?: string;
  created_at?: string;
  ageing_days?: number;
}

const TopAlerts = ({ startDate, endDate, refreshTrigger = 0 }: TopAlertsProps = {}) => {
  const [data, setData] = useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInterlock, setSelectedInterlock] = useState<string>('');
  const [alertDetails, setAlertDetails] = useState<AlertDetail[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ column: string | null; direction: 'asc' | 'desc' }>({
    column: null,
    direction: 'asc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchValue, setSearchValue] = useState('');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const payload = {
        "analytical_model": "Top five Alerts",
        "location_name": "",
        "interlock_name": "",
        "alert_status": "Open",
        "alert_severity": [""],
        "zone": "",
        "start_date": startDate || new Date().toISOString().split('T')[0],
        "end_date": endDate || new Date().toISOString().split('T')[0]
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        // Normalise API response so chart always receives a flat array
        // Old: response.data -> [ { interlock_name, count }, ... ]
        // New: response.data -> { status, message, data: { data: [...], count, total } }
        let apiData: any = response.data;

        if (apiData && typeof apiData === 'object') {
          // Handle wrapped structure: { data: [...] } or { data: { data: [...] } }
          if (Array.isArray(apiData.data)) {
            apiData = apiData.data;
          } else if (apiData.data && Array.isArray(apiData.data.data)) {
            apiData = apiData.data.data;
          }
        }

        let dataArray: AlertData[] = [];

        if (Array.isArray(apiData)) {
          dataArray = apiData.map((item: any) => ({
            interlock_name: item.interlock_name || item.alert || item.alert_name || '',
            count: item.count || item.alert_count || 0
          }));
        } else if (typeof apiData === 'object' && apiData !== null) {
          // If it's an object, convert to array
          dataArray = Object.entries(apiData).map(([key, value]: [string, any]) => ({
            interlock_name: key,
            count: typeof value === 'number' ? value : (value?.count || 0)
          }));
        }

        // Sort by count descending and take top 5 (highest first)
        dataArray = dataArray
          .filter(item => item.count > 0)
          .sort((b, a) => b.count - a.count)
          .slice(0, 5);

        setData(dataArray);
      } else {
        setError('No data available');
        setData([]);
      }
    } catch (err: any) {
      console.error('Error fetching top alerts data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to fetch top alerts data');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, refreshTrigger]);

  const handleBarClick = useCallback(async (interlockName: string) => {
    setSelectedInterlock(interlockName);
    setIsDialogOpen(true);
    setIsLoadingDetails(true);
    setDetailsError(null);
    setAlertDetails([]);
    setCurrentPage(1); // Reset to first page when opening dialog
    setSearchValue(''); // Reset search when opening dialog

    try {
      const payload = {
        "analytical_model": "Top five Alerts",
        "location_name": "",
        "interlock_name": interlockName,
        "alert_status": "Open",
        "alert_severity": [""],
        "zone": "",
        "start_date": startDate || new Date().toISOString().split('T')[0],
        "end_date": endDate || new Date().toISOString().split('T')[0]
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        // New: { status, message, data: [...] } — use response.data.data
        // Old: response.data is array directly
        let apiData: any = response.data;
        if (apiData && typeof apiData === 'object' && Array.isArray(apiData.data)) {
          apiData = apiData.data;
        }

        let detailsArray: AlertDetail[] = [];

        if (Array.isArray(apiData)) {
          detailsArray = apiData.map((item: any) => ({
            unique_id: item.unique_id || '',
            zone: item.zone || '',
            location_name: item.location_name || '',
            interlock_name: item.interlock_name || '',
            severity: item.severity || '',
            alert_status: item.alert_status || '',
            created_at: item.created_at || '',
            ageing_days: item.ageing_days || 0,
          }));
        } else if (typeof apiData === 'object' && apiData !== null) {
          detailsArray = Object.values(apiData).map((item: any) => ({
            unique_id: item.unique_id || '',
            zone: item.zone || '',
            location_name: item.location_name || '',
            interlock_name: item.interlock_name || '',
            severity: item.severity || '',
            alert_status: item.alert_status || '',
            created_at: item.created_at || '',
            ageing_days: item.ageing_days || 0,
          }));
        }

        setAlertDetails(detailsArray);
      } else {
        setDetailsError('No details available');
      }
    } catch (err: any) {
      console.error('Error fetching alert details:', err);
      setDetailsError(err?.response?.data?.message || err.message || 'Failed to fetch alert details');
    } finally {
      setIsLoadingDetails(false);
    }
  }, [startDate, endDate]);

  // Handle column sorting
  const handleSort = (column: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.column === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ column, direction });
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when items per page changes
  };

  // Get filtered and sorted data
  const getFilteredData = () => {
    if (!searchValue.trim()) return alertDetails;
    
    const searchLower = searchValue.toLowerCase();
    return alertDetails.filter((detail) => {
      return (
        (detail.zone || '').toLowerCase().includes(searchLower) ||
        (detail.location_name || '').toLowerCase().includes(searchLower) ||
        (detail.unique_id || '').toLowerCase().includes(searchLower) ||
        (detail.interlock_name || '').toLowerCase().includes(searchLower) ||
        (detail.alert_status || '').toLowerCase().includes(searchLower) ||
        (detail.created_at || '').toLowerCase().includes(searchLower) ||
        String(detail.ageing_days || '').includes(searchLower)
      );
    });
  };

  // Get sorted data
  const getSortedData = () => {
    let sorted = getFilteredData();
    
    if (sortConfig.column) {
      sorted = [...sorted].sort((a, b) => {
        const aValue = (a as any)[sortConfig.column!];
        const bValue = (b as any)[sortConfig.column!];

        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        // Try to parse as number
        const aNum = parseFloat(String(aValue));
        const bNum = parseFloat(String(bValue));
        const isNumeric = !isNaN(aNum) && !isNaN(bNum);

        if (isNumeric) {
          // Numeric comparison
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        } else {
          // String comparison
          const aStr = String(aValue).toLowerCase();
          const bStr = String(bValue).toLowerCase();
          if (sortConfig.direction === 'asc') {
            return aStr.localeCompare(bStr);
          } else {
            return bStr.localeCompare(aStr);
          }
        }
      });
    }
    
    return sorted;
  };

  // Get paginated data
  const getPaginatedData = () => {
    const sorted = getSortedData();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sorted.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const totalPages = Math.ceil(getSortedData().length / itemsPerPage);

  /** Export current filtered & sorted dialog rows to Excel (client-side only) */
  const handleDownloadExcel = useCallback(() => {
    const sorted = getSortedData();
    if (sorted.length === 0) return;

    const headers = [
      'Zone',
      'Location',
      'Unique ID',
      'Interlock Name',
      'Ageing Status (days)',
      'Alert Status',
      'Created At',
    ];
    const rows = sorted.map((row) => [
      row.zone ?? '',
      row.location_name ?? '',
      row.unique_id ?? '',
      row.interlock_name ?? '',
      row.ageing_days ?? '',
      row.alert_status ?? '',
      row.created_at
        ? (String(row.created_at).includes('T') || String(row.created_at).match(/^\d{4}-\d{2}-\d{2}/)
          ? new Date(row.created_at as string).toLocaleString()
          : String(row.created_at))
        : '',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Top alerts');

    const safe = (s: string) => s.replace(/[/\\?*[\]:]/g, '-').slice(0, 80);
    const interlock = selectedInterlock ? safe(selectedInterlock) : 'alerts';
    const filename = `TopAlerts_${interlock}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [alertDetails, searchValue, sortConfig, selectedInterlock]);

  useLayoutEffect(() => {
    if (!chartRef.current || data.length === 0) {
      console.log('Chart not ready:', { hasRef: !!chartRef.current, dataLength: data.length });
      return;
    }

    console.log('Creating chart with data:', data);

    // Dispose of any existing chart
    if (chartRef.current) {
      const existingRoot = am5.registry.rootElements.find(root => root.dom === chartRef.current);
      if (existingRoot) {
        existingRoot.dispose();
      }
    }

    const root = am5.Root.new(chartRef.current);

    // Remove amCharts logo
    if (root._logo) {
      root._logo.dispose();
    }

    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        /** Room for long category names on the Y axis (horizontal bars). */
        paddingLeft: 12,
        paddingRight: 10,
        paddingTop: 15,
        paddingBottom: 15,
      })
    );

    // Create Y-axis (categories)
    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "interlock_name",
        renderer: am5xy.AxisRendererY.new(root, {
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          /** Must be small enough vs plot height or amCharts hides/skips category labels (was 55 → only ~3–4 rows fit). */
          minGridDistance: 8,
          inside: false,
        }),
      })
    );

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fill: am5.color(0x505050),
      maxWidth: 200,
      oversizedBehavior: "wrap",
      breakWords: true,
      textAlign: "right",
      lineHeight: 1.15,
      paddingRight: 6,
      text: "{category}",
      populateText: true,
      centerY: am5.p50,
    });
    yAxis.data.setAll(data);

    // Make Y-axis grid lines less visible
    yAxis.get("renderer").grid.template.setAll({
      stroke: am5.color(0x000000),
      strokeOpacity: 0.1,
      strokeWidth: 1,
    });

    // Create X-axis (values) - ensure it starts from 0 and goes to max
    const maxValue = Math.max(...data.map(d => d.count), 0);
    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 30,
          opposite: false, // Ensure axis is at bottom
        }),
        min: 0,
        max: maxValue * 1.1, // Add 10% padding at top
        strictMinMax: false,
      })
    );

    // Configure X-axis labels - small text
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fill: am5.color(0x505050),
    });

    // Make X-axis grid lines less visible
    xAxis.get("renderer").grid.template.setAll({
      stroke: am5.color(0x000000),
      strokeOpacity: 0.1,
      strokeWidth: 1,
    });

    // Create series for horizontal bars
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "count",
        categoryYField: "interlock_name",
      })
    );

    // Configure columns - use CHART_COLOR (#8B5E83)
    series.columns.template.setAll({
      fill: am5.color(CHART_COLOR),
      stroke: am5.color(CHART_COLOR),
      strokeWidth: 1,
      strokeOpacity: 1,
      fillOpacity: 1,
      cornerRadiusBR: 0,
      cornerRadiusTR: 0,
      cornerRadiusBL: 0,
      cornerRadiusTL: 0,
      tooltipText: "{categoryY}: {valueX}",
      cursorOverStyle: "pointer",
    });
    
    // Add click event to bars
    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const context = dataItem.dataContext as AlertData;
        if (context.interlock_name) {
          handleBarClick(context.interlock_name);
        }
      }
    });
    
    // Set column width for horizontal bars (height in horizontal orientation)
    series.columns.template.set("height", am5.percent(60));

    // Add labels at the end of bars - white text
    const label = series.bullets.push(function () {
      return am5.Bullet.new(root, {
        locationX: 1,
        sprite: am5.Label.new(root, {
          text: "{valueX}",
          fill: am5.color(0xffffff),
          fontSize: 12,
          centerX: am5.percent(100),
          centerY: am5.percent(50),
          populateText: true,
          dx: -3, // Small offset from the end
        }),
      });
    });

    // Set data
    console.log('Setting series data:', data);
    series.data.setAll(data);
    
    // Ensure series is visible
    series.set("visible", true);
    series.set("forceHidden", false);

    // Make bars animate
    series.appear(1000, 100);
    chart.appear(1000, 100);
    
    console.log('Chart created, series dataItems:', series.dataItems.length);

    return () => {
      root.dispose();
    };
  }, [data, startDate, endDate]);

  if (isLoading) {
  return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: '#6366f1' }} />
          <p className="text-sm text-gray-600">Loading top alerts data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center">
          <div className="text-red-500 text-sm">⚠ {error}</div>
        </div>
          </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center">
          <div className="text-gray-500 text-sm">No top alerts data available</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-full flex flex-col">
        <div className="mb-3 px-2 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Top 5 Open Alerts</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 leading-none">
              <Info className="h-3 w-3 flex-shrink-0" />
              <span>Click on chart  to get details in table</span>
            </div>
        <div className="flex-1 min-h-0 w-full min-w-0 overflow-visible">
          <div
            ref={chartRef}
            className="h-full w-full min-h-[280px] overflow-visible"
          />
        </div>
      </div>

      {/* Alert Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold text-gray-900">
                  Alert Details: {selectedInterlock}
                </DialogTitle>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={isLoadingDetails || getSortedData().length === 0}
                  title="Download Excel (current filtered table data)"
                  aria-label="Download Excel"
                  className="inline-flex items-center justify-center shrink-0 rounded-md border border-green-600 bg-green-600 p-1.5 text-white shadow-sm hover:bg-green-700 hover:border-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-4" />
                </button>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-8 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchValue && (
                  <button
                    onClick={() => {
                      setSearchValue('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: '#6366f1' }} />
                <p className="text-xs text-gray-600">Loading alert details...</p>
              </div>
            </div>
          ) : detailsError ? (
            <div className="text-center py-8">
              <div className="text-red-500 text-xs">⚠ {detailsError}</div>
            </div>
          ) : alertDetails.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 text-xs">No alert details available</div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th
                        onClick={() => handleSort('zone')}
                        className="px-3 py-1.5 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>Zone</span>
                          <div className="flex flex-col items-center justify-center">
                            {sortConfig.column === 'zone' ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center opacity-40">
                                <ChevronUp className="h-3 w-3 -mb-0.5" />
                                <ChevronDown className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('location_name')}
                        className="px-3 py-1.5 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>Location</span>
                          <div className="flex flex-col items-center justify-center">
                            {sortConfig.column === 'location_name' ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center opacity-40">
                                <ChevronUp className="h-3 w-3 -mb-0.5" />
                                <ChevronDown className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('unique_id')}
                        className="px-3 py-1.5 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>Unique ID</span>
                          <div className="flex flex-col items-center justify-center">
                            {sortConfig.column === 'unique_id' ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center opacity-40">
                                <ChevronUp className="h-3 w-3 -mb-0.5" />
                                <ChevronDown className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('interlock_name')}
                        className="px-3 py-1.5 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>Interlock Name</span>
                          <div className="flex flex-col items-center justify-center">
                            {sortConfig.column === 'interlock_name' ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center opacity-40">
                                <ChevronUp className="h-3 w-3 -mb-0.5" />
                                <ChevronDown className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('ageing_days')}
                        className="px-3 py-1.5 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none"
                      >
                        <div className="flex items-center justify-end gap-2">
                          <span>Ageing Status(days)</span>
                          <div className="flex flex-col items-center justify-center">
                            {sortConfig.column === 'ageing_days' ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center opacity-40">
                                <ChevronUp className="h-3 w-3 -mb-0.5" />
                                <ChevronDown className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('alert_status')}
                        className="px-3 py-1.5 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>Alert Status</span>
                          <div className="flex flex-col items-center justify-center">
                            {sortConfig.column === 'alert_status' ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center opacity-40">
                                <ChevronUp className="h-3 w-3 -mb-0.5" />
                                <ChevronDown className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('created_at')}
                        className="px-3 py-1.5 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>Created At</span>
                          <div className="flex flex-col items-center justify-center">
                            {sortConfig.column === 'created_at' ? (
                              sortConfig.direction === 'asc' ? (
                                <ChevronUp className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center opacity-40">
                                <ChevronUp className="h-3 w-3 -mb-0.5" />
                                <ChevronDown className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                </tr>
              </thead>
                  <tbody>
                    {getPaginatedData().map((detail, index) => (
                      <tr key={detail.unique_id || index} className="hover:bg-gray-50 border-b border-gray-200">
                        <td className="px-3 py-1.5 text-xs">
                          {detail.zone || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {detail.location_name || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {detail.unique_id || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {detail.interlock_name || '-'}
                        </td>
                        <td className={`px-3 py-1.5 text-xs text-right ${(detail.ageing_days || 0) > 10 ? 'text-red-600 font-semibold' : ''}`}>
                          {detail.ageing_days !== undefined ? detail.ageing_days : '-'}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {detail.alert_status ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              detail.alert_status === 'Close' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {detail.alert_status}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {detail.created_at || '-'}
                        </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {getSortedData().length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-2 border-t border-gray-200 bg-white gap-3 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-xs text-gray-600">entries</span>
              </div>
              <div className="text-xs text-gray-600">
                Showing <span className="font-semibold text-gray-800">
                  {getSortedData().length > 0 ? Math.min((currentPage - 1) * itemsPerPage + 1, getSortedData().length) : 0}
                </span>
                {' to '}
                <span className="font-semibold text-gray-800">
                  {Math.min(currentPage * itemsPerPage, getSortedData().length)}
                </span>
                {' of '}
                <span className="font-semibold text-gray-800">{getSortedData().length}</span>
                {' entries'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="bg-white border border-gray-300 text-gray-700 px-3 py-1 text-xs rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-gray-700 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="bg-white border border-gray-300 text-gray-700 px-3 py-1 text-xs rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TopAlerts;