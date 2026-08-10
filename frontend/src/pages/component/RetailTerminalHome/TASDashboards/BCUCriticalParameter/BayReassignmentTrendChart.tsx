import React, { useCallback, useEffect, useRef, useState } from "react"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip"
import { Loader2, RotateCcw, Maximize2, Minimize2, Download } from "lucide-react"
import { DateRangePickerFilter } from "../DateRangePickerFilter"
import { apiClient } from "@/services/apiClient"
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface ChartDataPoint {
  month: string
  totalAlerts: number
  bayBreakdown: Record<string, number>
  [key: string]: number | string | Record<string, number>
}


interface DetailRow {
  month: string
  zone: string
  sap_id: string
  location_name: string
  assigned_bay: string
  truck_number: any
  reassigned_bay: string
  load_number: any
  total_alerts: number
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface BayReassignmentChartProps {
  filters: FilterValue[];
  onDateFilterChange?: (filter: string) => void;
  onBcuFilterChange?: (filter: string) => void;
  /** Called when user clicks a chart dot: pass SQL filter for that date/month, or null when cleared */
  onChartPointFilterChange?: (sqlFilter: string | null) => void;
  filterPortalId?: string;
}

const BayReassignmentTrendChart: React.FC<BayReassignmentChartProps> = ({ filters, onDateFilterChange, onBcuFilterChange, onChartPointFilterChange, filterPortalId }) => {
  const rootRef = useRef<am5.Root | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [gridData, setGridData] = useState<DetailRow[]>([])
  const gridDataRef = useRef<DetailRow[]>([])
  const [filteredGridData, setFilteredGridData] = useState<DetailRow[]>([])
  const [fromDate, setFromDate] = useState(dayjs().subtract(6, "day"))
  const [toDate, setToDate] = useState(dayjs())
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>(() => {
    const defaultFrom = dayjs().subtract(6, "day")
    const defaultTo = dayjs()
    return [{
      key: '"DATE"',
      cond: "equals",
      value: `${defaultFrom.format("YYYY-MM-DD")},${defaultTo.format("YYYY-MM-DD")}`,
    }]
  })
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [selectedPlant, setSelectedPlant] = useState<string>("")
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [timeGrain, setTimeGrain] = useState<string>("weekly")
  let [bayNumbers, setBayNumbers] = useState<string[]>([])
  const [bcuNumberOptions, setBcuNumberOptions] = useState<string[]>([]);
  const [selectedBcuNumbers, setSelectedBcuNumbers] = useState<string>("");
  const [selectedBcu, setSelectedBcu] = useState(undefined);
  const [localFilters, setLocalFilters] = useState([]);
  const chartIdRef = useRef(`bayreassignment-${Math.floor(Math.random() * 100000)}`);
  const [initialBcuOptions, setInitialBcuOptions] = useState<string[]>([]);
  const [isInitialOptionsLoaded, setIsInitialOptionsLoaded] = useState(false);

  // Keep ref in sync so bullet click handler always filters against latest grid data
  useEffect(() => {
    gridDataRef.current = gridData;
  }, [gridData]);


  const totalAlertsByBay = {};

  const columnDefs: ColDef<DetailRow>[] = [
    {
      headerName: timeGrain === "monthly" ? 'Month' : 'Date',
      field: 'month',
      sort: "desc" as SortDirection,
    },
    { headerName: "Zone", field: "zone" },
    { headerName: "Plant", field: "location_name" },
    { headerName: "SAP ID", field: "sap_id" },
    { headerName: "Load Number", field: "load_number" },
    { headerName: "Truck Number", field: "truck_number" },
    { headerName: "Assigned Bay", field: "assigned_bay" },
    { headerName: "Reassigned Bay", field: "reassigned_bay" },
    {
      headerName: "Total Alerts",
      field: "total_alerts",
      valueFormatter: (params) => params.value?.toLocaleString()
    }
  ]

  // Handle refresh button click - clear error and filters
  const handleRefresh = () => {
    setIsLoading(true)
    setIsTransitioning(true)
    setError(null) // Clear error message
    setActiveFilter(null) // Clear active chart filter

    // Reset time grain to weekly
    setTimeGrain("weekly")

    // Clear zone and plant selections
    setSelectedZone("")
    setSelectedPlant("")

    // Reset date range to default values based on weekly time grain
    const defaultFromDate = dayjs().subtract(6, "day")
    const defaultToDate = dayjs()

    setFromDate(defaultFromDate)
    setToDate(defaultToDate)

    // Notify parent of date range reset
    if (onDateFilterChange && defaultFromDate && defaultToDate) {
      const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
      const sqlFilter = `created_at::DATE BETWEEN '${formatDate(defaultFromDate)}' AND '${formatDate(defaultToDate)}'`
      onDateFilterChange(sqlFilter)
    }

    // Remove zone, plant, and date from crossFilters
    setCrossFilters((prevFilters) =>
      prevFilters.filter((f) => f.key !== "zone" && f.key !== "plant" && f.key !== '"DATE"'),
    )

    // Add date filter for weekly view
    const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
    setCrossFilters((prevFilters) => [
      ...prevFilters.filter((f) => f.key !== '"DATE"'),
      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(defaultFromDate)},${formatDate(defaultToDate)}`,
      },
    ])

    // Reset BCU selection
    setSelectedBcuNumbers("")
    setSelectedBcu(undefined)

    // Reset local filters
    setLocalFilters([])

    // If parent has onBcuFilterChange, notify it of the reset
    if (onBcuFilterChange) {
      onBcuFilterChange("")
    }

    // Reset filtered grid data to show all data
    setFilteredGridData([]);
    onChartPointFilterChange?.(null);

    setRefreshKey((prev) => prev + 1)
  }

  // Handle date apply - only applies when Apply button is clicked
  const handleDateApply = (startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) => {
    if (!startDate || !endDate) return

    const formatDate = (date: dayjs.Dayjs) => {
      return date ? date.format("YYYY-MM-DD") : ""
    }

    setFromDate(startDate)
    setToDate(endDate)

    // Always notify parent of the current date range selection
    if (onDateFilterChange) {
      const sqlFilter = `created_at::DATE BETWEEN '${formatDate(startDate)}' AND '${formatDate(endDate)}'`
      onDateFilterChange(sqlFilter)
    }

    // Add date filter for both weekly and monthly views
      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
      value: `${formatDate(startDate)},${formatDate(endDate)}`,
      }

      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"')
        return [...filtersWithoutDate, dateFilter]
      })

      // Reset active filter
      setActiveFilter(null);
      setFilteredGridData([]);
      onChartPointFilterChange?.(null);

      // Refresh the data
      setRefreshKey((prev) => prev + 1)
  }
  const handleTimeGrainChange = (value: string) => {
    setTimeGrain(value)

    if (value === "weekly") {
      // Set the date range to the last 7 days for weekly view
      const defaultFromDate = dayjs().subtract(6, "day")
      const defaultToDate = dayjs()

      setFromDate(defaultFromDate)
      setToDate(defaultToDate)

      // Notify parent component with the new date range
      if (onDateFilterChange) {
        const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
        const sqlFilter = `created_at::DATE BETWEEN '${formatDate(defaultFromDate)}' AND '${formatDate(defaultToDate)}'`
        onDateFilterChange(sqlFilter)
      }

      // Add date filter for the last 7 days
      setCrossFilters((prevFilters) => {
        // Remove existing date filter
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"')

        // Add new date filter for the last 7 days
        return [
          ...filtersWithoutDate,
          {
            key: '"DATE"',
            cond: "equals",
            value: `${defaultFromDate.format("YYYY-MM-DD")},${defaultToDate.format("YYYY-MM-DD")}`,
          },
        ]
      })
    } else if (value === "monthly") {
      // For monthly view, clear the date filter
      setFromDate(null)
      setToDate(null)

      // Remove date filter from crossFilters
      setCrossFilters((prevFilters) => prevFilters.filter((f) => f.key !== '"DATE"'))

      // Notify parent that date filter is cleared
      if (onDateFilterChange) {
        onDateFilterChange("")
      }
    }

    // Reset active filter and filtered grid data
    setActiveFilter(null)
    setFilteredGridData([])

    // Refresh the data
    setRefreshKey((prev) => prev + 1)
  }


  const handleBcuNumberChange = (value) => {
    setSelectedBcu(value);
    const bcuQuery = value && value !== "All BAYs"
      ? `assigned_bay = '${value}'`
      : ""; // Empty string when "All BAYs" is selected

    // Call the callback function with the SQL filter
    if (onBcuFilterChange) {
      onBcuFilterChange(bcuQuery);
    }

    if (value === "All BAYs") {
      // "All BAYs" selected - remove filter
      setLocalFilters(prev => prev.filter(f => f.key !== "assigned_bay"));
    } else {
      // Specific BCU selected - add filter
      const bcuFilter = {
        key: "assigned_bay",
        cond: "equals",
        value: value
      };


      setLocalFilters((prev) => {
        const filtersWithoutBcu = prev.filter((f) => f.key !== "bcu_number")
        return [...filtersWithoutBcu, bcuFilter]
      })
    }

    setRefreshKey(prev => prev + 1);
  };


  useEffect(() => {
    if (onDateFilterChange && fromDate && toDate) {
      const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
      const sqlFilter = `created_at::DATE BETWEEN '${formatDate(fromDate)}' AND '${formatDate(toDate)}'`
      onDateFilterChange(sqlFilter)
    }
  }, [])
  const fetchData = useCallback(async () => {

    setIsTransitioning(true)
    try {
      // API call for bay reassignment data
      const apiEndpoint = "/api/charts/generate_vis_data"
      const combinedFilters = [...(filters || []), ...(localFilters || [])];
      // Check if there's a date filter in crossFilters
      const hasDateFilter = crossFilters.some((filter) => filter.key === '"DATE"')
      // If no date filter and in weekly mode, create a default one for the last 7 days
      const effectiveCrossFilters = [...crossFilters]
      if (!hasDateFilter && timeGrain === "weekly") {
        const today = dayjs()
        const sevenDaysAgo = today.subtract(6, "day")

        effectiveCrossFilters.push({
          key: '"DATE"',
          cond: "equals",
          value: `${sevenDaysAgo.format("YYYY-MM-DD")},${today.format("YYYY-MM-DD")}`,
        })
      }

      // Use correct request body structure based on time grain
      const requestBody = {
        filters: combinedFilters || [],
        action: "bay_reassignment",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters || [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: ""
      }

      // console.log("API Request:", JSON.stringify(requestBody))

      const response = await apiClient.post(apiEndpoint, requestBody);

      if (!response.status) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const result = response.data

      // Handle weekly data from daily_data field
      return {
        data: timeGrain === "monthly" ? result.monthly_data || {} : result.daily_data || {}
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch data")
      return { data: {} }
    } finally {
      setIsLoading(false)
      setIsTransitioning(false)
    }
  }, [filters, localFilters, crossFilters, timeGrain])

  const processData = (apiResponse: any): { chartData: ChartDataPoint[]; gridData: DetailRow[]; totalAlertsByBay: Record<string, number> } => {
    if (!apiResponse || !apiResponse.data) {
      console.log("No data in API response", apiResponse);
      return { chartData: [], gridData: [], totalAlertsByBay: {} };
    }

    const data = apiResponse.data;
    const allBays = new Set<string>();
    const monthData = new Map<string, { totalAlerts: number; bayBreakdown: Record<string, number> }>();
    const gridData: DetailRow[] = [];
    const totalAlertsByBay: Record<string, number> = {};

    // Collect and aggregate data
    Object.keys(data).forEach(month => {
      const monthEntries = data[month];

      // Initialize month data if not exists
      if (!monthData.has(month)) {
        monthData.set(month, { totalAlerts: 0, bayBreakdown: {} });
      }

      const monthInfo = monthData.get(month)!;

      monthEntries.forEach(entry => {
        const assigned_bay = entry.assigned_bay || "Unassigned";
        const total_alerts = Number(entry.total_alerts) || 0;

        // Add bay to set of unique bays
        allBays.add(assigned_bay);

        // Aggregate total alerts for this month
        monthInfo.totalAlerts += total_alerts;

        // Aggregate bay breakdown for this month
        if (!monthInfo.bayBreakdown[assigned_bay]) {
          monthInfo.bayBreakdown[assigned_bay] = 0;
        }
        monthInfo.bayBreakdown[assigned_bay] += total_alerts;

        // Accumulate total alerts for this bay across all months
        if (!totalAlertsByBay[assigned_bay]) {
          totalAlertsByBay[assigned_bay] = 0;
        }
        totalAlertsByBay[assigned_bay] += total_alerts;

        // Add to grid data
        gridData.push({
          month,
          zone: entry.zone || "",
          location_name: entry.location_name || "",
          sap_id: entry.sap_id || "",
          load_number: entry.load_number || "",
          assigned_bay,
          truck_number: entry.truck_number || "",
          reassigned_bay: entry.reassigned_bay || "",
          total_alerts
        });
      });
    });

    const bayNumbersArray = Array.from(allBays);
    bayNumbers = bayNumbersArray;
    setBayNumbers(bayNumbersArray);

    // Sort months chronologically
    const monthKeys = Array.from(monthData.keys()).sort((a, b) => {
      // Handle "YYYY-MM-DD" (weekly) and "YYYY-MM" (monthly) and "Mon-YYYY" formats
      const parseKey = (key: string): number => {
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date(key).getTime();
        // YYYY-MM
        if (/^\d{4}-\d{2}$/.test(key)) return new Date(`${key}-01`).getTime();
        // Mon-YYYY (e.g. "Mar-2026")
        const monYear = key.match(/^([A-Za-z]+)-(\d{4})$/);
        if (monYear) return new Date(`${monYear[1]} 1, ${monYear[2]}`).getTime();
        // Fallback: lexicographic
        return key.localeCompare(b);
      };
      return parseKey(a) - parseKey(b);
    });

    // Create chart data with aggregated information
    const chartData: ChartDataPoint[] = [];
    monthKeys.forEach(month => {
      const monthInfo = monthData.get(month)!;
      const dataPoint: ChartDataPoint = {
        month,
        totalAlerts: monthInfo.totalAlerts,
        bayBreakdown: { ...monthInfo.bayBreakdown }
      };

      // Add individual bay data as separate properties
      bayNumbersArray.forEach(bay => {
        dataPoint[bay] = monthInfo.bayBreakdown[bay] || 0;
      });

      chartData.push(dataPoint);
    });

    // Sort grid data by month to keep dates in order
    const sortedGridData = gridData.sort((a, b) => {
      const monthA = a.month || '';
      const monthB = b.month || '';
      return monthA.localeCompare(monthB);
    });

    return { chartData, gridData: sortedGridData, totalAlertsByBay };
  }


  // Build SQL filter for a chart point (date or month) for use by parent / below table
  const buildPointSqlFilter = (timeValue: string): string => {
    if (!timeValue) return "";
    const val = timeValue.trim();
    // Weekly: "YYYY-MM-DD" -> single date
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return `created_at::DATE = '${val}'`;
    }
    // Monthly: "YYYY-MM" -> first to last day of month
    const monthlyMatch = val.match(/^(\d{4})-(\d{2})$/);
    if (monthlyMatch) {
      const [, year, month] = monthlyMatch;
      const start = `${year}-${month}-01`;
      const end = dayjs(`${year}-${month}-01`).endOf("month").format("YYYY-MM-DD");
      return `created_at::DATE >= '${start}' AND created_at::DATE <= '${end}'`;
    }
    // Short or full month name (e.g. "Nov", "Jun"): Jan, Feb → current year; Mar–Dec → previous year
    const shortMonths: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const fullMonths: Record<string, number> = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
    const valNorm = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
    let monthNum = shortMonths[val] ?? shortMonths[valNorm] ?? fullMonths[val] ?? fullMonths[valNorm];
    if (monthNum === undefined && val.length >= 3) {
      monthNum = shortMonths[valNorm.slice(0, 3)];
    }
    if (monthNum !== undefined) {
      const currentYear = new Date().getFullYear();
      const y = monthNum <= 2 ? currentYear : currentYear - 1;
      const start = `${y}-${String(monthNum).padStart(2, "0")}-01`;
      const end = dayjs(`${y}-${String(monthNum).padStart(2, "0")}-01`).endOf("month").format("YYYY-MM-DD");
      return `created_at::DATE >= '${start}' AND created_at::DATE <= '${end}'`;
    }
    return "";
  };

  // Function to filter grid data based on selected data point (uses ref so chart bullet click has latest data)
  const filterGridDataByPoint = (timeValue: string) => {
    // Reset filtered data if clicking the same filter again
    if (activeFilter === timeValue) {
      setActiveFilter(null);
      setFilteredGridData([]);
      onChartPointFilterChange?.(null);
      return;
    }

    setActiveFilter(timeValue);
    const data = gridDataRef.current.length ? gridDataRef.current : gridData;
    const filtered = data.filter((item) => item.month === timeValue);
    setFilteredGridData(filtered);

    // Pass raw timeValue (e.g. Mar-2026, 2026-03) so table can parse and use correct year from backend
    if (timeValue) onChartPointFilterChange?.(timeValue);
  }


  useEffect(() => {
    let root: am5.Root | null = null

    const initChart = async () => {
      const chartContainer = document.getElementById(chartIdRef.current);
      if (!chartContainer) return;

      // Fetch data and process it
      const apiResponse = await fetchData()
      if (!apiResponse) {
        console.error("No API response");
        return;
      }

      const { chartData, gridData, totalAlertsByBay } = processData(apiResponse);
      setGridData(gridData)

      const uniqueBcus = Array.from(new Set(gridData.map(item => item.assigned_bay))).filter(Boolean);

      if (!isInitialOptionsLoaded && !localFilters.some(f => f.key === "assigned_bay")) {
        setInitialBcuOptions(uniqueBcus);
        setBcuNumberOptions(uniqueBcus);
        setIsInitialOptionsLoaded(true);
      } else if (isInitialOptionsLoaded) {
        setBcuNumberOptions(initialBcuOptions);
      }

      setInitialBcuOptions([]);
      setIsInitialOptionsLoaded(false);
      setFilteredGridData([])
      setActiveFilter(null)

      // If no data, don't attempt to create chart
      if (chartData.length === 0) {
        console.log("No chart data available");
        setIsLoading(false);
        setIsTransitioning(false);
        return;
      }

      try {
        // Create new root and chart
        root = am5.Root.new(chartIdRef.current);
        rootRef.current = root;
        if (root._logo) root._logo.dispose()

        root.setThemes([am5themes_Animated.new(root)])

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
        )

        // Find the highest value across all bays to set appropriate max value
        let maxValue = 0
        chartData.forEach(dataPoint => {
          Object.keys(dataPoint).forEach(key => {
            if (key !== 'month') {
              const value = Number(dataPoint[key]) || 0
              if (value > maxValue) maxValue = value
            }
          })
        })

        // Add 30% more to the max value for better visualization
        const yAxisMax = Math.ceil(maxValue * 1.3)

        // Create Y-axis
        const yAxis = chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            min: 0,
            max: yAxisMax > 0 ? yAxisMax : 10,
            renderer: am5xy.AxisRendererY.new(root, {
              minGridDistance: 30,
            }),
            numberFormat: "#,###",
          }),
        )

        yAxis.get("renderer").labels.template.setAll({
          fontSize: 10,
          fontWeight: "bold",
        })

        // Create X-axis
        const xAxis = chart.xAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "month",
            renderer: am5xy.AxisRendererX.new(root, {
              minGridDistance: 30,
            }),
          }),
        )

        // Make x-axis labels clickable
        const xRenderer = xAxis.get("renderer")
        xRenderer.labels.template.setAll({
          fontSize: 10,
          rotation: -90,
          dx: -8,
          inside: false,
          oversizedBehavior: "none",
          fill: am5.color(0x000000),
          fontWeight: "bold",
          cursorOverStyle: "pointer"
        })

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
        )

        // Add Y-axis title
        yAxis.children.unshift(
          am5.Label.new(root, {
            rotation: -90,
            text: "Bay Reassignment Alerts",
            y: am5.p50,
            centerX: am5.p50,
            fontSize: 10,
            fontWeight: "bold",
            paddingBottom: 0
          })
        );

        // Set data for the X axis
        xAxis.data.setAll(chartData)

        // Create the main aggregated series WITH tooltip
        const aggregatedSeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "Total Alerts",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "totalAlerts",
            categoryXField: "month",
            stroke: am5.color("#4682B4"),
            fill: am5.color("#4682B4"),
            minBulletDistance: 10,
            tooltip: am5.Tooltip.new(root, {
              maxWidth: 400,
              forceHidden: false,
              paddingBottom: 2,
              paddingTop: 2,
              paddingLeft: 12,
              paddingRight: 12,
              background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0xffffff),
                fillOpacity: 0.95,
                strokeOpacity: 0.8,
                cornerRadiusTL: 8,
                cornerRadiusTR: 8,
                cornerRadiusBL: 8,
                cornerRadiusBR: 8,
              })
            })
          })
        );

        // Add tooltip adapter to the series
        aggregatedSeries.get("tooltip").adapters.add("labelText", (text, target) => {
          const dataItem = target.dataItem;
          if (dataItem && dataItem.dataContext) {
            const data = dataItem.dataContext as ChartDataPoint;
            const totalAlerts = data.totalAlerts;
            const bayBreakdown = data.bayBreakdown;

            // Create detailed breakdown text
            let breakdownText = `[bold fontSize:12px]Total Alerts: ${totalAlerts}[/]`;

            // Sort bays by alert count (descending)
            const sortedBays = Object.entries(bayBreakdown)
              .filter(([bay, count]) => count > 0)
              .sort(([, a], [, b]) => b - a);

            if (sortedBays.length > 0) {
              sortedBays.forEach(([bay, count]) => {
                breakdownText += `\n[fontSize:10px]• Bay ${bay}: ${count} alerts[/]`;
              });
            }

            return breakdownText;
          }
          return `[bold fontSize:12px]Total Alerts: {totalAlerts}[/]`;
        });

        // Add circle bullets with click events
        aggregatedSeries.bullets.push((root) => {
          const circle = am5.Circle.new(root, {
            radius: 6,
            fill: am5.color("#4682B4"),
            stroke: am5.color("#ffffff"),
            strokeWidth: 2,
            cursorOverStyle: "pointer",
            interactive: true,
          });

          // Add click event
          circle.events.on("click", function (ev) {
            const dataItem = ev.target.dataItem;
            if (dataItem) {
              const category = dataItem.dataContext["month"];
              if (category) {
                filterGridDataByPoint(category.toString());
              }
            }
          });

          return am5.Bullet.new(root, {
            sprite: circle
          });
        });

        // Add value labels above data points
        aggregatedSeries.bullets.push(function (root) {
          return am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "{totalAlerts}",
              fill: am5.color(0x000000),
              centerY: am5.p100,
              centerX: am5.p50,
              populateText: true,
              fontSize: 11,
              fontWeight: "bold",
              dy: -15,
            })
          });
        });

        // Set data for the series
        aggregatedSeries.data.setAll(chartData);

        // Add cursor
        chart.set(
          "cursor",
          am5xy.XYCursor.new(root, {
            behavior: "zoomX",
          }),
        )

        // Add scrollbar
        chart.set(
          "scrollbarX",
          am5.Scrollbar.new(root, {
            orientation: "horizontal",
            paddingTop: 0,
          }),
        )

        // Apply chart appearance animation
        chart.appear(1000, 100)
      } catch (error) {
        console.error("Error initializing chart:", error);
        setError(`Error initializing chart: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    initChart()

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [refreshKey, crossFilters, timeGrain, filters])

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded)
  }

  // Clear chart point filter
  const clearChartFilter = () => {
    setActiveFilter(null);
    setFilteredGridData([]);
    onChartPointFilterChange?.(null);
  }

  // Chart title
  const chartTitle = `Bay Reassignment/Manual Bay Assignment (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`

  const filterPortalEl = filterPortalId ? document.getElementById(filterPortalId) : null

  const filterControls = (
    <>
      <Select
        onValueChange={handleBcuNumberChange}
        value={selectedBcu || ""}
      >
        <SelectTrigger className="h-7 text-xs w-40">
          <SelectValue placeholder="Select Assigned Bay">
            {selectedBcu || "Select Assigned Bay"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All BAYs">All Assigned Bays</SelectItem>
          {bcuNumberOptions.map((bcu) =>
            bcu ? (
              <SelectItem key={bcu} value={bcu}>
                {bcu}
              </SelectItem>
            ) : null
          )}
        </SelectContent>
      </Select>
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
      {timeGrain !== "weekly" ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <DateRangePickerFilter
                  fromDate={fromDate}
                  toDate={toDate}
                  onApply={handleDateApply}
                  disabled
                  maxDate={dayjs()}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px] rounded-md">
              Day-wise data only available for weekly view.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DateRangePickerFilter
          fromDate={fromDate}
          toDate={toDate}
          onApply={handleDateApply}
          disabled={isLoading}
          maxDate={dayjs()}
        />
      )}
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
    const headers = [
      timeGrain === "monthly" ? "Month" : "Date",
      "Zone", "Plant", "SAP ID", "Load Number", "Truck Number",
      "Assigned Bay", "Reassigned Bay", "Total Alerts"
    ];
    const rows = data.map(row => [
      row.month ?? "", row.zone ?? "", row.location_name ?? "",
      row.sap_id ?? "", row.load_number ?? "", row.truck_number ?? "",
      row.assigned_bay ?? "", row.reassigned_bay ?? "", row.total_alerts ?? ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bay Reassignment Data");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(wb, `Bay_Reassignment_Data_${ts}.xlsx`);
  };

  const handleDownloadExcel = async () => {
    try {
      // Prepare the same request body structure used for fetching data
      const combinedFilters = [...(filters || []), ...(localFilters || [])];

      // Check if there's a date filter in crossFilters
      const hasDateFilter = crossFilters.some((filter) => filter.key === '"DATE"')

      // If no date filter and in weekly mode, create a default one for the last 7 days
      const effectiveCrossFilters = [...crossFilters]
      if (!hasDateFilter && timeGrain === "weekly") {
        const today = dayjs()
        const sevenDaysAgo = today.subtract(6, "day")

        effectiveCrossFilters.push({
          key: '"DATE"',
          cond: "equals",
          value: `${sevenDaysAgo.format("YYYY-MM-DD")},${today.format("YYYY-MM-DD")}`,
        })
      }

      // Prepare request body matching the structure used in fetchData
      const requestBody = {
        filters: combinedFilters || [],
        action: "bay_reassignment",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters || [],
        // limit: 0,
        // time_grain: "",
        // resp_format: "",
        // resp_level: ""
      }

      console.log("Download Excel Request:", JSON.stringify(requestBody))

      // Call the download API
      const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody)

      if (!response.status) {
        throw new Error(`Download failed with status ${response.status}`)
      }

      // Get the blob from response
      const filePath = response.data?.file_path;

      // Generate filename with current timestamp
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss')
      const timePeriod = timeGrain === "monthly" ? "Monthly" : "Weekly"
      let fileName = `Bay_Reassignment_${timePeriod}_${timestamp}.xlsx`

      saveAs(filePath, fileName);

    } catch (error) {
      console.error("Error downloading Excel:", error)
      // You might want to show a toast notification or alert here
      alert(`Failed to download Excel file: ${error.message}`)
    }
  }
  
  return (<>
    {filterPortalEl && createPortal(filterControls, filterPortalEl)}
    <div className="flex gap-1 p-1">
      <div className={`${isTableExpanded ? "hidden" : "w-1/2"}`}>
        {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleExpand} />}
        <Card
          className={`transition-all duration-300 ${isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
            }`}
        >
          <CardHeader className="pb-0 p-1 pt-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">
                  {chartTitle}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!filterPortalEl && filterControls}
                  <Button
                    onClick={handleDownloadExcel}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    disabled={isLoading || gridData.length === 0}
                    title="Download Excel"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={toggleExpand}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  >
                    {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className={`p-0 relative ${isExpanded ? "h-[calc(100vh-8rem)]" : "h-[365px]"}`}>
            {isTransitioning && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                {/* <p>No data available</p> */}
              </div>
            )}

            {bayNumbers.length === 0 && !isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                {/* <p>No data available for the selected time period</p> */}
              </div>
            )}

            <div
              // ref={chartDivRef}
              id={chartIdRef.current}
              style={{
                width: "100%",
                height: isExpanded ? "calc(100vh - 8rem)" : "350px",
              }}
              className="chart-container"
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

      <div className={`${isTableExpanded ? "w-full" : "w-1/2"}`}>
        {isTableExpanded && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleTableExpand} />
        )}
        <Card
          className={`transition-all duration-300 ${isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
            }`}
        >
          <CardHeader className="pb-0 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                Bay Reassignment/Manual Bay Assignment  Data
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
                columnDefs={columnDefs}
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
  </>)
}

export default BayReassignmentTrendChart