import React, { useEffect, useState, useRef } from "react"
import { createPortal } from "react-dom"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import type { ColDef, SortDirection } from "ag-grid-community"
import dayjs from "dayjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Loader2, RotateCcw, Maximize2, Minimize2, Download } from "lucide-react"
import { DateRangePickerFilter } from "../DateRangePickerFilter"
import { apiClient } from "@/services/apiClient"
import * as XLSX from 'xlsx';

// Chart data point interface
interface ChartDataPoint {
  timePeriod: string;
  [key: string]: any; // For dynamic series data
}

// Base row interface that all data types will extend
interface BaseRow {
  month?: string;
  date?: string;
  zone?: string;
  location_name?: string;
  sap_id?: string;
  bcu_number?: string;
  [key: string]: any; // For other properties
}

interface FilterValue {
  key: string;
  cond: string;
  value: string;
}

// Define the props for the component
interface ReusableChartTableProps {
  dataType: 'kfactor' | 'sick_tts' | 'unauthorised_flow' | 'manualfanprinted' | 'overloaded_tts' | 'local_loaded';
  title?: string;
  filters?: FilterValue[];
  initialTimeGrain?: 'monthly' | 'weekly';
  yAxisLabel?: string; // Optional custom Y-axis label
  filterPortalId?: string;
}

// Configuration for each data type
interface DataTypeConfig {
  valueField: string;
  seriesIdField: string;
  secondaryValueField?: string;
  secondaryValueLabel?: string;
  defaultTitle: string;
  yAxisLabel: string;
  columns: (timeGrain: string) => ColDef<BaseRow>[];
}

const ReusableBCU: React.FC<ReusableChartTableProps> = ({
  dataType,
  title,
  filters = [],
  initialTimeGrain = 'weekly',
  yAxisLabel,
  filterPortalId
}) => {
  // Chart and UI state
  const rootRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [gridData, setGridData] = useState<BaseRow[]>([]);
  const [filteredGridData, setFilteredGridData] = useState<BaseRow[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  
  // Filters and time state
  const [fromDate, setFromDate] = useState(dayjs().subtract(6, "day"));
  const [toDate, setToDate] = useState(dayjs());
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [selectedPlant, setSelectedPlant] = useState<string>("");
  const [timeGrain, setTimeGrain] = useState<string>(initialTimeGrain);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [seriesList, setSeriesList] = useState<string[]>([]);
  
  // Data type configuration
  const dataTypeConfigs: Record<string, DataTypeConfig> = {
    kfactor: {
      valueField: 'kfactor_value',
      seriesIdField: 'material',
      secondaryValueField: 'target_value',
      secondaryValueLabel: 'Target Value',
      defaultTitle: 'K-Factor Analysis',
      yAxisLabel: 'K-Factor Value',
      columns: (timeGrain) => [
        {
          headerName: timeGrain === "monthly" ? 'Month' : 'Date',
          field: timeGrain === "monthly" ? 'month' : 'date',
          sort: "desc" as SortDirection,
        },
        { headerName: "Zone", field: "zone" },
        { headerName: "Plant", field: "location_name" },
        { headerName: "SAP ID", field: "sap_id" },
        { headerName: "Material", field: "material" },
        { headerName: "K-Factor Value", field: "kfactor_value" },
        { headerName: "Target Value", field: "target_value" }
      ]
    },
    sick_tts: {
      valueField: 'total_req_qty',
      seriesIdField: 'zone',
      secondaryValueField: 'total_loaded_qty',
      secondaryValueLabel: 'Loaded Quantity',
      defaultTitle: 'Sick Time to Service',
      yAxisLabel: 'Required Quantity',
      columns: (timeGrain) => [
        {
          headerName: timeGrain === "monthly" ? 'Month' : 'Date',
          field: timeGrain === "monthly" ? 'month' : 'date',
          sort: "desc" as SortDirection,
        },
        { headerName: "Zone", field: "zone" },
        { headerName: "Plant", field: "location_name" },
        { headerName: "SAP ID", field: "sap_id" },
        { headerName: "BCU Number", field: "bcu_number" },
        { headerName: "Required Quantity", field: "total_req_qty" },
        { headerName: "Loaded Quantity", field: "total_loaded_qty" }
      ]
    },
    unauthorised_flow: {
      valueField: 'total_alerts',
      seriesIdField: 'bcu_number',
      secondaryValueField: 'total_net_totalizer',
      secondaryValueLabel: 'Net Totalizer',
      defaultTitle: 'Unauthorised Flow Events',
      yAxisLabel: 'Total Alerts',
      columns: (timeGrain) => [
        {
          headerName: timeGrain === "monthly" ? 'Month' : 'Date',
          field: timeGrain === "monthly" ? 'month' : 'date',
          sort: "desc" as SortDirection,
        },
        { headerName: "Zone", field: "zone" },
        { headerName: "Plant", field: "location_name" },
        { headerName: "SAP ID", field: "sap_id" },
        { headerName: "BCU Number", field: "bcu_number" },
        { headerName: "Total Alerts", field: "total_alerts" },
        { headerName: "Net Totalizer", field: "total_net_totalizer" }
      ]
    },
    manualfanprinted: {
      valueField: 'total_alerts',
      seriesIdField: 'zone',
      secondaryValueField: 'total_manual_fan_count',
      secondaryValueLabel: 'Manual Fan Count',
      defaultTitle: 'Manual FAN Printed Analysis',
      yAxisLabel: 'Total Alerts',
      columns: (timeGrain) => [
        {
          headerName: timeGrain === "monthly" ? 'Month' : 'Date',
          field: timeGrain === "monthly" ? 'month' : 'date',
          sort: "desc" as SortDirection,
        },
        { headerName: "Zone", field: "zone" },
        { headerName: "Plant", field: "location_name" },
        { headerName: "SAP ID", field: "sap_id" },
        { headerName: "Total Alerts", field: "total_alerts" },
        { headerName: "Manual Fan Count", field: "total_manual_fan_count" }
      ]
    },
    overloaded_tts: {
      valueField: 'total_required_qty',
      seriesIdField: 'zone',
      secondaryValueField: 'total_loaded_qty',
      secondaryValueLabel: 'Loaded Quantity',
      defaultTitle: 'Overloaded Time to Service',
      yAxisLabel: 'Required Quantity',
      columns: (timeGrain) => [
        {
          headerName: timeGrain === "monthly" ? 'Month' : 'Date',
          field: timeGrain === "monthly" ? 'month' : 'date',
          sort: "desc" as SortDirection,
        },
        { headerName: "Zone", field: "zone" },
        { headerName: "Plant", field: "location_name" },
        { headerName: "SAP ID", field: "sap_id" },
        { headerName: "BCU Number", field: "bcu_number" },
        { headerName: "Required Quantity", field: "total_required_qty" },
        { headerName: "Loaded Quantity", field: "total_loaded_qty" }
      ]
    },
    local_loaded: {
      valueField: 'total_alerts',
      seriesIdField: 'bcu_number',
      secondaryValueField: 'total_loaded_qty',
      secondaryValueLabel: 'Loaded Quantity',
      defaultTitle: 'BCU Alert Analysis',
      yAxisLabel: 'Total Alerts',
      columns: (timeGrain) => [
        {
          headerName: timeGrain === "monthly" ? 'Month' : 'Date',
          field: timeGrain === "monthly" ? 'month' : 'date',
          sort: "desc" as SortDirection,
        },
        { headerName: "Zone", field: "zone" },
        { headerName: "Plant", field: "location_name" },
        { headerName: "SAP ID", field: "sap_id" },
        { headerName: "BCU Number", field: "bcu_number" },
        { headerName: "Total Alerts", field: "total_alerts" },
        { headerName: "Loaded Quantity", field: "total_loaded_qty" }
      ]
    }
  };

  // Get current configuration based on dataType
  const getConfig = (): DataTypeConfig => {
    return dataTypeConfigs[dataType] || dataTypeConfigs.local_loaded;
  };

  // Get column definitions for the current data type
  const getColumnDefs = (): ColDef<BaseRow>[] => {
    return getConfig().columns(timeGrain);
  };

  // Get table title
  const getTableTitle = (): string => {
    if (title) return title;
    return getConfig().defaultTitle;
  };

  // Get Y-axis label
  const getYAxisLabel = (): string => {
    if (yAxisLabel) return yAxisLabel;
    return getConfig().yAxisLabel;
  };

  // Get value field name
  const getValueFieldName = (): string => {
    return getConfig().valueField;
  };

  // Get series ID field name
  const getSeriesIdFieldName = (): string => {
    return getConfig().seriesIdField;
  };

  // Get secondary value field name (if any)
  const getSecondaryValueFieldName = (): string | undefined => {
    return getConfig().secondaryValueField;
  };

  // Get secondary value label
  const getSecondaryValueLabel = (): string | undefined => {
    return getConfig().secondaryValueLabel;
  };

  // Handle refresh button click
  const handleRefresh = () => {
    setIsLoading(true);
    setIsTransitioning(true);
    setError(null);
    setActiveFilter(null);

    // Clear selections and filters
    setSelectedZone("");
    setSelectedPlant("");
    setCrossFilters((prevFilters) => prevFilters.filter((f) => f.key !== "zone" && f.key !== "plant"));
    setFilteredGridData([]);

    setRefreshKey((prev) => prev + 1);
  };

  // Handle date range changes
  const handleDateChange = (type: string, newDate: dayjs.Dayjs) => {
    if (type === "from") {
      setFromDate(newDate);
    } else {
      setToDate(newDate);
    }

    if (newDate && (type === "from" ? toDate : fromDate)) {
      const start = type === "from" ? newDate : fromDate;
      const end = type === "from" ? toDate : newDate;

      const formatDate = (date: dayjs.Dayjs) => {
        return date.format("YYYY-MM-DD");
      };

      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(start)},${formatDate(end)}`,
      };

      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });

      // Reset active filter and filtered data
      setActiveFilter(null);
      setFilteredGridData([]);

      // Refresh the data
      setRefreshKey((prev) => prev + 1);
    }
  };

  // Handle time grain changes
  const handleTimeGrainChange = (value: string) => {
    setTimeGrain(value);
    setActiveFilter(null);
    setFilteredGridData([]);
    setRefreshKey((prev) => prev + 1);
  };

  // Apply zone filter
  const applyZoneFilter = (zone: string) => {
    if (zone === selectedZone) {
      // If already selected, clear the filter
      setSelectedZone("");
      setCrossFilters(prevFilters => prevFilters.filter(f => f.key !== "zone"));
    } else {
      // Set new zone filter
      setSelectedZone(zone);
      const zoneFilter = {
        key: "zone",
        cond: "equals",
        value: zone
      };
      
      // Remove any existing zone filter and add the new one
      setCrossFilters(prevFilters => {
        const filtersWithoutZone = prevFilters.filter(f => f.key !== "zone");
        return [...filtersWithoutZone, zoneFilter];
      });
    }
    
    // Reset active filter and filtered data
    setActiveFilter(null);
    setFilteredGridData([]);
    
    // Refresh data
    setRefreshKey(prev => prev + 1);
  };
  
  // Apply plant filter
  const applyPlantFilter = (plant: string) => {
    if (plant === selectedPlant) {
      // If already selected, clear the filter
      setSelectedPlant("");
      setCrossFilters(prevFilters => prevFilters.filter(f => f.key !== "plant"));
    } else {
      // Set new plant filter
      setSelectedPlant(plant);
      const plantFilter = {
        key: "sap_id",
        cond: "equals",
        value: plant
      };
      
      // Remove any existing plant filter and add the new one
      setCrossFilters(prevFilters => {
        const filtersWithoutPlant = prevFilters.filter(f => f.key !== "plant");
        return [...filtersWithoutPlant, plantFilter];
      });
    }
    
    // Reset active filter and filtered data
    setActiveFilter(null);
    setFilteredGridData([]);
    
    // Refresh data
    setRefreshKey(prev => prev + 1);
  };

  // Filter grid data based on selected time period
  const filterGridDataByPoint = (timeValue: string) => {
    // Reset filtered data if clicking the same filter again
    if (activeFilter === timeValue) {
      setActiveFilter(null);
      setFilteredGridData([]);
      return;
    }
    
    // Set the active filter
    setActiveFilter(timeValue);
    
    const timeField = timeGrain === "monthly" ? "month" : "date";
    const filtered = gridData.filter(item => item[timeField] === timeValue);
    setFilteredGridData(filtered);
  };

  // Toggle chart expansion
  const toggleChartExpand = () => {
    setIsChartExpanded(!isChartExpanded);
  };

  // Toggle table expansion
  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded);
  };

  // Clear chart point filter
  const clearChartFilter = () => {
    setActiveFilter(null);
    setFilteredGridData([]);
  };

  // Fetch data from API
  const fetchData = async () => {
    setIsTransitioning(true);
    try {
      const apiEndpoint = "/api/charts/generate_vis_data";
      
      const requestBody = {
        filters: filters || [],
        action: dataType,
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: crossFilters || [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: ""
      };

      console.log(`API Request for ${dataType}:`, JSON.stringify(requestBody));
      
      const response = await apiClient.post(apiEndpoint, requestBody);
      
      if (!response.status) {
        throw new Error(`API returned ${response.status} ${response.statusText}`);
      }
      
      const result = response.data;
      
      if (result.status !== true) {
        throw new Error(`API error: ${result.message || 'Unknown error'}`);
      }
      
      // Return data based on timeGrain
      return { 
        data: timeGrain === "monthly" ? result.monthly_data || {} : result.daily_data || {} 
      };
    } catch (error) {
      console.error(`Error fetching ${dataType} data:`, error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
      return { data: {} };
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  // Sort time periods for chart (YYYY-MM or date format)
  const sortTimePeriods = (periods: string[]): string[] => {
    // For YYYY-MM format
    if (periods.length > 0 && periods[0].match(/^\d{4}-\d{2}$/)) {
      return periods.sort();
    }
    
    // For date format, use Date object to sort
    return periods.sort((a, b) => {
      try {
        return new Date(a).getTime() - new Date(b).getTime();
      } catch {
        return a.localeCompare(b);
      }
    });
  };

  // Process API response into chart and grid data
  const processData = (apiResponse: any): { chartData: ChartDataPoint[]; gridData: BaseRow[] } => {
    if (!apiResponse || !apiResponse.data) {
      return { chartData: [], gridData: [] };
    }

    const data = apiResponse.data;
    const gridData: BaseRow[] = [];
    
    // Get field names from config
    const valueField = getValueFieldName();
    const seriesIdField = getSeriesIdFieldName();
    const secondaryValueField = getSecondaryValueFieldName();
    
    // For chart - we need to identify series and time periods
    const seriesMap = new Map<string, Map<string, number>>();
    const secondarySeriesMap = secondaryValueField 
      ? new Map<string, Map<string, number>>()
      : null;
    
    const timePeriodsSet = new Set<string>();
    const seriesSet = new Set<string>();

    // Process data for grid and chart
    Object.keys(data).forEach(timePeriod => {
      timePeriodsSet.add(timePeriod);
      const entries = data[timePeriod];
      
      if (Array.isArray(entries)) {
        entries.forEach(entry => {
          // Normalize series ID value - use Unknown-[index] for empty or missing values
          let seriesId = "Unknown";
          if (entry[seriesIdField] !== null && entry[seriesIdField] !== undefined) {
            seriesId = entry[seriesIdField].toString().trim();
            // If still empty, use a fallback value
            if (seriesId === "") {
              seriesId = entry.zone ? `Zone-${entry.zone}` : 
                        entry.location_name ? `Plant-${entry.location_name}` :
                        entry.sap_id ? `SAP-${entry.sap_id}` : "Unspecified";
            }
          }
          
          seriesSet.add(seriesId);
          
          // Track primary value for the chart
          if (!seriesMap.has(seriesId)) {
            seriesMap.set(seriesId, new Map<string, number>());
          }
          
          const primaryValue = entry[valueField] !== null && entry[valueField] !== undefined
            ? Number(entry[valueField])
            : 0;
            
          seriesMap.get(seriesId)?.set(timePeriod, primaryValue);
          
          // Track secondary value if applicable
          if (secondaryValueField && secondarySeriesMap) {
            if (!secondarySeriesMap.has(seriesId)) {
              secondarySeriesMap.set(seriesId, new Map<string, number>());
            }
            
            const secondaryValue = entry[secondaryValueField] !== null && entry[secondaryValueField] !== undefined
              ? Number(entry[secondaryValueField])
              : 0;
              
            secondarySeriesMap.get(seriesId)?.set(timePeriod, secondaryValue);
          }
          
          // Create row for grid with timeGrain field and all available data
          const row: BaseRow = {
            [timeGrain === "monthly" ? 'month' : 'date']: timePeriod,
          };
          
          // Copy all properties from the entry
          Object.keys(entry).forEach(key => {
            row[key] = entry[key] !== null ? entry[key] : "";
          });
          
          gridData.push(row);
        });
      }
    });
    
    // Create chart data points
    const chartData: ChartDataPoint[] = [];
    const timePeriods = sortTimePeriods(Array.from(timePeriodsSet));
    const seriesList = Array.from(seriesSet).filter(s => s !== "");
    
    // Save series for later reference
    setSeriesList(seriesList);
    
    // Build chart data points - one for each time period
    timePeriods.forEach(timePeriod => {
      const dataPoint: ChartDataPoint = { timePeriod };
      
      seriesList.forEach(series => {
        // Add primary value
        dataPoint[series] = seriesMap.get(series)?.get(timePeriod) ?? 0;
        
        // Add secondary value if applicable
        if (secondaryValueField && secondarySeriesMap) {
          dataPoint[`${series}_${secondaryValueField}`] = 
            secondarySeriesMap.get(series)?.get(timePeriod) ?? 0;
        }
      });
      
      chartData.push(dataPoint);
    });
    
    // Sort grid data by date/month to keep dates in order
    const dateField = timeGrain === "monthly" ? 'month' : 'date';
    const sortedGridData = gridData.sort((a, b) => {
      const dateA = a[dateField] || '';
      const dateB = b[dateField] || '';
      
      // For YYYY-MM format
      if (dateA.match(/^\d{4}-\d{2}$/) && dateB.match(/^\d{4}-\d{2}$/)) {
        return dateA.localeCompare(dateB);
      }
      
      // For date format, use Date object to sort
      try {
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      } catch {
        return dateA.localeCompare(dateB);
      }
    });
    
    return { chartData, gridData: sortedGridData };
  };

// Initialize and update chart
useEffect(() => {
    let root: am5.Root | null = null;
  
    const initChart = async () => {
      if (!chartDivRef.current) return;
  
      // Dispose of previous chart if it exists
      if (rootRef.current) {
        rootRef.current.dispose();
      }
  
      // Fetch data and process it
      const apiResponse = await fetchData();
      if (!apiResponse) return;
  
      const { chartData, gridData } = processData(apiResponse);
      setGridData(gridData);
      setChartData(chartData);
      
      // Reset filtered grid data when chart reloads
      setFilteredGridData([]);
      setActiveFilter(null);
  
      // Skip chart creation if no data or series
      if (chartData.length === 0 || seriesList.length === 0) {
        return;
      }
  
      // Create new root and chart
      root = am5.Root.new(chartDivRef.current);
      rootRef.current = root;
      if (root._logo) root._logo.dispose();
  
      root.setThemes([am5themes_Animated.new(root)]);
  
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingTop: 0,
          paddingBottom: 0,
          paddingRight: 30,
        }),
      );
  
      // Find the highest value to set appropriate max value for y-axis
      let maxValue = 0;
      chartData.forEach(dataPoint => {
        Object.keys(dataPoint).forEach(key => {
          if (key !== 'timePeriod' && !key.includes('_' + getSecondaryValueFieldName())) {
            const value = Number(dataPoint[key]) || 0;
            if (value > maxValue) maxValue = value;
          }
        });
      });
      
      // Add 30% more to the max value for better visualization
      const yAxisMax = Math.ceil(maxValue * 1.3);
      
      // Create Y-axis
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: 0,
          max: yAxisMax > 0 ? yAxisMax : 10, // Use default of 10 if no data
          renderer: am5xy.AxisRendererY.new(root, {
            minGridDistance: 30,
          }),
          numberFormat: "#,###",
          tooltip: am5.Tooltip.new(root, {
            labelText: "{valueY}"
          })
        }),
      );
      
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
        fontWeight: "bold",
      });
  
      // Create X-axis
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "timePeriod",
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
          }),
          tooltip: am5.Tooltip.new(root, {}),
        }),
      );
      
      // Make x-axis labels clickable
      const xRenderer = xAxis.get("renderer");
      xRenderer.labels.template.setAll({
        fontSize: 10,
        paddingTop: 10,
        paddingRight: 0,
        inside: false,
        oversizedBehavior: "none",
        fill: am5.color(0x000000),
        fontWeight: "bold",
        cursorOverStyle: "pointer"
      });
      
      // Add X-axis title based on timeGrain
      xAxis.children.push(
        am5.Label.new(root, {
          text: timeGrain === "monthly" ? "Monthly" : "Weekly",
          x: am5.p50,
          centerX: am5.p50,
          fontSize: 10,
          fontWeight: "bold",
          paddingTop: 0,
          paddingBottom: 0
        })
      );

      // Add Y-axis title
      yAxis.children.unshift(
        am5.Label.new(root, {
          rotation: -90,
          text: getYAxisLabel(),
          y: am5.p50,
          centerX: am5.p50,
          fontSize: 10,
          fontWeight: "bold",
          paddingBottom: 0
        })
      );
      
      // Log chart data for debugging
      console.log("Chart data:", chartData);
      console.log("Series list:", seriesList);
      
      // Set data for the X axis - this is critical
      xAxis.data.setAll(chartData);
  
      // Generate a color palette for series
      const colors = [
        "#4682B4", // Steel Blue
        "#D14242", // Red
        "#66BB6A", // Green
        "#FFA726", // Orange
        "#5C6BC0", // Indigo
        "#8D6E63", // Brown
        "#26A69A", // Teal
        "#EC407A", // Pink
        "#AB47BC", // Purple
        "#78909C", // Blue Grey
      ];
      
      const secondaryValueField = getSecondaryValueFieldName();
      const secondaryValueLabel = getSecondaryValueLabel();
      
      // Create a series for each unique series ID
      seriesList.forEach((seriesId, index) => {
        const colorIndex = index % colors.length;
        
        // Skip empty series IDs
        if (!seriesId) return;
        
        // Create tooltip text based on whether we have secondary values
        let tooltipText = `[bold fontSize:12px]${seriesId}: [bold fontSize:12px]{valueY}[/]`;
        if (secondaryValueField && secondaryValueLabel) {
          tooltipText += `, [bold fontSize:12px]${secondaryValueLabel}: [bold fontSize:12px]{${seriesId}_${secondaryValueField}}[/]`;
        }
        
        // Create the series
        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: seriesId,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: seriesId,
            categoryXField: "timePeriod",
            stroke: am5.color(colors[colorIndex]),
            fill: am5.color(colors[colorIndex]),
            tooltip: am5.Tooltip.new(root, {
              labelText: tooltipText,
              forceHidden: false,
            }),
            minBulletDistance: 10,
            connect: true, // Important to connect points with lines
          }),
        );
        
        // Add circle bullets with click events
        series.bullets.push((root) => {
          const circle = am5.Circle.new(root, {
            radius: 5,
            fill: am5.color(colors[colorIndex]),
            strokeWidth: 2,
            cursorOverStyle: "pointer",
            interactive: true,
          });
          
          // Add click events to the bullets
          circle.events.on("click", function(ev) {
            const dataItem = ev.target.dataItem;
            if (dataItem && dataItem.dataContext) {
              const category = dataItem.dataContext["timePeriod"];
              if (category) {
                filterGridDataByPoint(category.toString());
              }
            }
          });
          
          return am5.Bullet.new(root, {
            sprite: circle
          });
        });
        
        // Add label bullets above data points
        series.bullets.push(function(root) {
          return am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "{valueY}",
              fill: am5.color(0x000000),
              centerY: am5.p0,
              centerX: am5.p50,
              populateText: true,
              fontSize: 10,
              fontWeight: "bold",
              dy: -25,
            })
          });
        });
        
        // Always show tooltip even for zero values
        series.get("tooltip").set("forceHidden", false);
        
        // Make sure we validate the data for this series
        series.appear(1000, 100);
        
        // Set data for the series - this is critical
        series.data.setAll(chartData);
      });
      
      // Add cursor
      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "zoomX",
        }),
      );
  
      // Add scrollbar
      chart.set(
        "scrollbarX",
        am5.Scrollbar.new(root, {
          orientation: "horizontal",
          paddingTop: 0,
        }),
      );
  
      // Add legend
      const legend = chart.children.unshift(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          layout: root.horizontalLayout,
          marginTop: 0,
          marginBottom: 0,
        })
      );
      
      // Set legend items style
      legend.labels.template.setAll({
        fontSize: 10,
        fontWeight: "bold",
      });
      
      legend.valueLabels.template.setAll({
        fontSize: 12
      });
      
      // Set legend data from series
      legend.data.setAll(chart.series.values);
  
      // Apply chart appearance animation
      chart.appear(1000, 100);
    };
  
    initChart();
  
    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
      }
    };
  }, [refreshKey, crossFilters, timeGrain, dataType]);
  
  // Get unique zones for filter dropdown
  const uniqueZones = Array.from(new Set(gridData.map(item => item.zone).filter(Boolean)));
  
  // Get plants for selected zone
  const zonePlants = selectedZone 
    ? Array.from(new Set(gridData
        .filter(item => item.zone === selectedZone)
        .map(item => item.location_name)
        .filter(Boolean)))
    : [];
    
  // Chart title
  const chartTitle = `${getTableTitle()} (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`;

  const filterPortalEl = filterPortalId ? document.getElementById(filterPortalId) : null

  const filterControls = (
    <>
      {uniqueZones.length > 0 && (
        <Select 
          value={selectedZone} 
          onValueChange={applyZoneFilter}
        >
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue placeholder="Zone" />
          </SelectTrigger>
          <SelectContent>
            {uniqueZones.map(zone => (
              <SelectItem key={zone} value={zone || ""}>{zone}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {selectedZone && zonePlants.length > 0 && (
        <Select 
          value={selectedPlant} 
          onValueChange={applyPlantFilter}
        >
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue placeholder="Plant" />
          </SelectTrigger>
          <SelectContent>
            {zonePlants.map(plant => (
              <SelectItem key={plant} value={plant || ""}>{plant}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select 
        value={timeGrain} 
        onValueChange={handleTimeGrainChange}
      >
        <SelectTrigger className="h-7 text-xs w-24">
          <SelectValue placeholder="Time Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
        </SelectContent>
      </Select>
      <DateRangePickerFilter
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={(date) => handleDateChange("from", date)}
        onToDateChange={(date) => handleDateChange("to", date)}
        disabled={isLoading}
      />
      <Button
        onClick={handleRefresh}
        className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        disabled={isLoading}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </>
  )

  const handleTableExcelExport = () => {
    const data = filteredGridData.length > 0 ? filteredGridData : gridData;
    if (data.length === 0) return;
    const cols = getColumnDefs();
    const headers = cols.map((c: any) => c.headerName || c.field || "");
    const rows = data.map(row => cols.map((c: any) => {
      const val = row[c.field];
      return val ?? "";
    }));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${getTableTitle()} Data`);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const safeName = getTableTitle().replace(/\s+/g, "_");
    XLSX.writeFile(wb, `${safeName}_Data_${ts}.xlsx`);
  };

  return (
    <>
      {filterPortalEl && createPortal(filterControls, filterPortalEl)}
      <div className="flex gap-1 p-1">
      <div className={`${isTableExpanded ? "hidden" : "w-1/2"}`}>
        {isChartExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleChartExpand} />}
        <Card
          className={`transition-all duration-300 ${
            isChartExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-1 pt-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">
                  {chartTitle}
                  {selectedZone && ` - Zone: ${selectedZone}`}
                  {selectedPlant && ` - Plant: ${selectedPlant}`}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!filterPortalEl && filterControls}
                  <Button
                    onClick={toggleChartExpand}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  >
                    {isChartExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className={`p-0 relative ${isChartExpanded ? "h-[calc(100vh-8rem)]" : "h-[365px]"}`}>
            {isTransitioning && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                <p>No data available</p>
              </div>
            )}

            {seriesList.length === 0 && !isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                <p>No data available for the selected time period</p>
              </div>
            )}

            <div
              ref={chartDivRef}
              style={{
                width: "100%",
                height: isChartExpanded ? "calc(100vh - 8rem)" : "350px",
              }}
            />
            
            {activeFilter && (
              <div className="absolute bottom-2 left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center">
                <span>Filtered by: {activeFilter}</span>
                <button 
                  className="ml-2 text-blue-600 hover:text-blue-800" 
                  onClick={clearChartFilter}
                >
                  ×
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className={`${isChartExpanded ? "hidden" : "w-1/2"}`}>
        {isTableExpanded && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleTableExpand} />
        )}
        <Card
          className={`transition-all duration-300 ${
            isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                {getTableTitle()} Data
                {activeFilter && ` - ${timeGrain === "monthly" ? "Month" : "Date"}: ${activeFilter}`}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  onClick={handleTableExcelExport}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  disabled={gridData.length === 0}
                  title="Download Excel"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  onClick={toggleTableExpand}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                >
                  {isTableExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <div
              className="ag-theme-alpine"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
                width: "100%",
              }}
            >
              <AgGridReact
                columnDefs={getColumnDefs()}
                rowData={filteredGridData.length > 0 ? filteredGridData : gridData}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
                pagination={true}
                paginationPageSize={isTableExpanded ? 20 : 10}
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
    </>
  );
};

export default ReusableBCU;