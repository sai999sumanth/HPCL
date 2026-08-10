import React, { useEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import dayjs from "dayjs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Loader2, RotateCcw, Maximize2, Minimize2, CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { apiClient } from "@/services/apiClient";

interface DataPoint {
  month?: string;
  date?: string;
  total_alerts: number;
}

interface DetailRow {
  sap_id: string;
  location_name?: string;
  sop_id: string;
  interlock_name: string;
  total_alerts: number;
  month?: string;
  date?: string;
}

interface BCUCriticalParamsLocalLoadChartProps {
  interlockName: string;
}

// Date Range Picker component
const DateRangePickerFilter = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  disabled = false,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="w-7 h-6 bg-white border-gray-300 hover:bg-gray-50"
          disabled={disabled}
        >
          <CalendarIcon className="h-[13px] w-[13px] text-gray-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <div className="flex flex-col gap-2">
            <DatePicker
              label="From"
              value={fromDate}
              format="DD/MM/YYYY"
              views={["year", "month", "day"]}
              onChange={onFromDateChange}
              disabled={disabled}
              slotProps={{
                textField: {
                  size: "small",
                  className: "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                },
              }}
            />
            <DatePicker
              label="To"
              value={toDate}
              format="DD/MM/YYYY"
              views={["year", "month", "day"]}
              onChange={onToDateChange}
              disabled={disabled}
              slotProps={{
                textField: {
                  size: "small",
                  className: "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                },
              }}
            />
          </div>
        </LocalizationProvider>
      </PopoverContent>
    </Popover>
  );
};

const BCUCriticalParamsLocalLoadChart: React.FC<BCUCriticalParamsLocalLoadChartProps> = ({ interlockName }) => {
  const rootRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"yearly" | "daily">("yearly");
  const [gridData, setGridData] = useState<DetailRow[]>([]);
  const [fromDate, setFromDate] = useState(dayjs().subtract(7, 'day'));
  const [toDate, setToDate] = useState(dayjs());
  const [crossFilters, setCrossFilters] = useState([
    {
      key: "interlock_name",
      cond: "equals",
      value: interlockName || "BCU Local Loading" // Use the prop value with fallback
    }
  ]);

  // Update crossFilters when interlockName prop changes
  useEffect(() => {
    setCrossFilters(prevFilters => {
      const filtersWithoutInterlock = prevFilters.filter(f => f.key !== "interlock_name");
      return [
        ...filtersWithoutInterlock,
        {
          key: "interlock_name",
          cond: "equals",
          value: interlockName || "BCU Local Loading"
        }
      ];
    });
    // Refresh the data when interlock name changes
    setRefreshKey(prev => prev + 1);
  }, [interlockName]);

  const columnDefs = [
    {
      headerName: viewMode === "yearly" ? 'Month' : 'Date',
      field: viewMode === "yearly" ? 'month' : 'date' as keyof DetailRow
    },
    { headerName: 'Interlock Name', field: 'interlock_name' as keyof DetailRow },
    { headerName: 'SAP ID', field: 'sap_id' as keyof DetailRow },
    { headerName: 'SOP ID', field: 'sop_id' as keyof DetailRow },
    { headerName: 'Total Alerts', field: 'total_alerts' as keyof DetailRow }
  ];

  const handleRefresh = () => {
    setIsLoading(true);
    setIsTransitioning(true);
    setRefreshKey(prev => prev + 1);
  };

  const handleDateChange = (type, newDate) => {
    if (type === 'from') {
      setFromDate(newDate);
    } else {
      setToDate(newDate);
    }

    if (newDate && (type === 'from' ? toDate : fromDate)) {
      const start = type === 'from' ? newDate : fromDate;
      const end = type === 'from' ? toDate : newDate;

      const formatDate = (date) => {
        return date.format('YYYY-MM-DD');
      };

      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(start)},${formatDate(end)}`
      };

      setCrossFilters(prevFilters => {
        const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });

      // Refresh the data
      setRefreshKey(prev => prev + 1);
    }
  };

  // Mock data for testing - in real usage this would be replaced with actual API call
  // const mockData = {
  //   status: true,
  //   message: "success",
  //   monthly_data: {
  //     "Mar-2025": [
  //       {
  //         "interlock_name": interlockName || "BCU Local Loading",
  //         "sap_id": "1128",
  //         "sop_id": "SOP025",
  //         "total_alerts": 7093
  //       }
  //     ]
  //   }
  // };

  const fetchData = async () => {
    setIsTransitioning(true);
    try {
      const apiEndpoint = "/api/charts/generate_vis_data";

      const requestBody = {
        filters: [],
        action: "tas_analog_count",
        drill_state: viewMode === "yearly" ? "" : "date",
        cross_filters: crossFilters.filter((filter, index, self) =>
          index === self.findIndex((f) => f.key === filter.key)
        ),
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: ""
      };

      const response = await apiClient.post(apiEndpoint, requestBody);

      const result = response.data;

      if (viewMode === "yearly" && result.monthly_data) {
        return { data: result.monthly_data, mode: "yearly" };
      } else if (viewMode === "daily" && result.daily_data) {
        return { data: result.daily_data, mode: "daily" };
      } else if (viewMode === "yearly" && !result.monthly_data) {
        // For testing - use mock data
        // return { data: mockData.monthly_data, mode: "yearly" };
      } else {
        setError(`No ${viewMode} data returned from API`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
      return null;
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const processData = (apiResponse: any): { chartData: DataPoint[], gridData: any[] } => {
    // Create a default empty dataset
    const chartData: DataPoint[] = [];
    const gridData: any[] = [];

    // If no data is available, create empty data structure
    if (!apiResponse || !apiResponse.data) {
      return { chartData: [], gridData: [] };
    }

    const data = apiResponse.data;
    const mode = apiResponse.mode;

    // Format based on new response structure
    Object.entries(data).forEach(([timeKey, records]: [string, any]) => {
      // Sum total_alerts for the month
      const totalAlerts = records.reduce((sum, record) => sum + record.total_alerts, 0);

      // Add data point for chart
      const dataPoint: DataPoint = {
        [mode === "yearly" ? 'month' : 'date']: timeKey,
        total_alerts: totalAlerts
      };
      chartData.push(dataPoint);

      // Add records to grid data
      records.forEach(record => {
        gridData.push({
          ...record,
          [mode === "yearly" ? 'month' : 'date']: timeKey
        });
      });
    });

    return { chartData, gridData };
  };

  useEffect(() => {
    let root: am5.Root | null = null;

    const initChart = async () => {
      if (!chartDivRef.current) return;

      if (rootRef.current) {
        rootRef.current.dispose();
      }

      const apiResponse = await fetchData();

      // Always create a chart, even if no data exists
      let chartData: DataPoint[] = [];
      let gridData: any[] = [];

      if (apiResponse) {
        const processedData = processData(apiResponse);
        chartData = processedData.chartData;
        gridData = processedData.gridData;
      } else {
        // Create default empty data if apiResponse is null
        const mode = viewMode;
        const timeKeys = mode === "yearly"
          ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
          : [fromDate.format('YYYY-MM-DD')];

        timeKeys.forEach(timeKey => {
          chartData.push({
            [mode === "yearly" ? 'month' : 'date']: timeKey,
            total_alerts: 0,
          });
        });
      }

      setGridData(gridData);

      root = am5.Root.new(chartDivRef.current);
      rootRef.current = root;
      root._logo?.dispose();

      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "panX",
          wheelY: "zoomX",
          layout: root.verticalLayout,
          paddingTop: 0,
          paddingBottom: 0,
          paddingRight: 20,
        })
      );

      // Create Y-axis
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: 0,
          renderer: am5xy.AxisRendererY.new(root, {
            minGridDistance: 30
          })
        })
      );
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
      });

      // Determine the category field based on view mode
      const categoryField = viewMode === "yearly" ? "month" : "date";

      // Create X-axis
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: categoryField,
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
          }),
        })
      );
      xAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
        paddingTop: 10,
        paddingRight: 0,
        inside: false,
        oversizedBehavior: "none",
        rotation: viewMode === "daily" ? -45 : 0, // Rotate labels for daily view
      });
      xAxis.data.setAll(chartData);

      // Add legend at the top
      const legend = chart.children.unshift(
        am5.Legend.new(root, {
          centerX: am5.percent(50),
          x: am5.percent(50),
          paddingTop: 0,
          paddingBottom: 0
        })
      );

      // Create series for total_alerts
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: "Total Alerts",
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: "total_alerts",
          categoryXField: categoryField,
          stroke: am5.color("#0xff7043"),          
          fill: am5.color("#0xff7043"),
          tooltip: am5.Tooltip.new(root, {
            labelText: `[fontSize:10px bold]Total Alerts: [fontSize:10px bold]{valueY} `,
            pointerOrientation: "horizontal",
            dx: 5,
          }),
        })
      );

      series.bullets.push((root) => {
        return am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 5,
            fill: series.get("fill"),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 2,
          }),
        });
      });
      

      series.data.setAll(chartData);
      legend.data.setAll(chart.series.values);

      // Add cursor
      chart.set("cursor", am5xy.XYCursor.new(root, {
        behavior: "zoomX",
      }));

      // Add scrollbar
      chart.set("scrollbarX", am5.Scrollbar.new(root, {
        orientation: "horizontal",
        paddingTop: 0,
      }));

      chart.appear(1000, 100);
    };

    initChart();

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
      }
    };
  }, [refreshKey, viewMode, crossFilters]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded);
  };

  return (
    <div className="flex gap-1 p-1">
      <div className="w-1/2">
        {isExpanded && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={toggleExpand}
          />
        )}
        <Card
          className={`transition-all duration-300 ${isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
            }`}
        >
          <CardHeader className="pb-0 p-1 pt-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">
                  System Analysis: {interlockName}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={viewMode}
                    onValueChange={(value: "yearly" | "daily") => setViewMode(value)}
                  >
                    <SelectTrigger className="w-[100px] h-7 text-xs">
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem className="text-xs" value="yearly">Monthly</SelectItem>
                      <SelectItem className="text-xs" value="daily">Weekly</SelectItem>
                    </SelectContent>
                  </Select>

                  {viewMode === "daily" && (
                    <DateRangePickerFilter
                      fromDate={fromDate}
                      toDate={toDate}
                      onFromDateChange={(date) => handleDateChange('from', date)}
                      onToDateChange={(date) => handleDateChange('to', date)}
                      disabled={isLoading}
                    />
                  )}

                  <Button
                    onClick={handleRefresh}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={toggleExpand}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-3 w-3" />
                    ) : (
                      <Maximize2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent
            className={`p-0 relative ${isExpanded ? "h-[calc(100vh-8rem)]" : "h-[365px]"
              }`}
          >
            {isTransitioning && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                <p>No Data</p>
              </div>
            )}

            <div
              ref={chartDivRef}
              style={{
                width: "100%",
                height: isExpanded ? "calc(100vh - 8rem)" : "350px"
              }}
            />
          </CardContent>
        </Card>
      </div>
      <div className="w-1/2">
        {isTableExpanded && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={toggleTableExpand}
          />
        )}
        <Card
          className={`transition-all duration-300 ${isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl w-[calc(100vw-2rem)]" : ""
            }`}
        >
          <CardHeader className="pb-0 p-1 pt-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">
                  {viewMode === "yearly" ? "Monthly Details" : "Daily Details"}: {interlockName}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* <Button
                    onClick={handleRefresh}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button> */}
                  <Button
                    onClick={toggleTableExpand}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  >
                    {isTableExpanded ? (
                      <Minimize2 className="h-3 w-3" />
                    ) : (
                      <Maximize2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <div
              className="ag-theme-alpine"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "365px",
                width: "100%",
              }}
            >
              <AgGridReact
                key={refreshKey}
                columnDefs={columnDefs}
                rowData={gridData}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
                pagination={true}
                paginationPageSize={10}
                enableCellTextSelection={true}
                suppressCellFocus={true}
                domLayout="normal"
                headerHeight={25}
                rowHeight={25}
                suppressMovableColumns={false}
                suppressContextMenu={true}
                suppressMenuHide={true}
                suppressRowClickSelection={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BCUCriticalParamsLocalLoadChart;