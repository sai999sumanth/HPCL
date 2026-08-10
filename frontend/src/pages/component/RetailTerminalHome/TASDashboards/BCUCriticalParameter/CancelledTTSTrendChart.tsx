import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
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
import { Loader2, RotateCcw, Maximize2, Minimize2 } from "lucide-react"
import { DateRangePickerFilter } from "../DateRangePickerFilter"
import { Download } from "lucide-react"
import { apiClient } from "@/services/apiClient"
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface ChartDataPoint {
  month: string
  total_alerts: number
  total_fan_qty: number
}

interface DetailRow {
  month: string
  zone: string
  sap_id: string
  location_name: string
  truck_number: string
  load_number: string
  total_alerts: number
  total_fan_qty: number
  indent_breakup?: string
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface CancelledTTSChartProps {
  filters: FilterValue[]
  onDateFilterChange?: (filter: string) => void
  onChartFilterChange?: (filterDate: string | null) => void
  filterPortalId?: string
}

const CancelledTTSTrendChart: React.FC<CancelledTTSChartProps> = ({ filters, onDateFilterChange, onChartFilterChange, filterPortalId }) => {
  const rootRef = useRef<am5.Root | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [gridData, setGridData] = useState<DetailRow[]>([])
  const [filteredGridData, setFilteredGridData] = useState<DetailRow[]>([])
  const [fromDate, setFromDate] = useState(dayjs().subtract(6, "day"))
  const [toDate, setToDate] = useState(dayjs())
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>(() => {
    const defaultFrom = dayjs().subtract(6, "day")
    const defaultTo = dayjs()
    return [{ key: '"DATE"', cond: "equals", value: `${defaultFrom.format("YYYY-MM-DD")},${defaultTo.format("YYYY-MM-DD")}` }]
  })
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [selectedPlant, setSelectedPlant] = useState<string>("")
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [timeGrain, setTimeGrain] = useState<string>("weekly")
const [isDownloading, setIsDownloading] = useState(false)
  const gridDataRef = useRef<DetailRow[]>([])


const handleDownloadExcel = async () => {
  setIsDownloading(true)
  try {
    // Create a copy of crossFilters to avoid modifying the original
    const effectiveCrossFilters = [...crossFilters]

    // If in weekly mode and no date filter exists, add a default one
    if (
      timeGrain === "weekly" &&
      !effectiveCrossFilters.some((filter) => filter.key === '"DATE"') &&
      fromDate &&
      toDate
    ) {
      const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
      effectiveCrossFilters.push({
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDate)},${formatDate(toDate)}`,
      })
    }

    // Use the same request body structure as fetchData
    const requestBody = {
      filters: filters || [],
      action: "cancelled_tts",
      drill_state: timeGrain === "weekly" ? "date" : "",
      cross_filters: effectiveCrossFilters || [],
      // limit: 0,
      // time_grain: "",
      // resp_format: "",
      // resp_level: "",
    }

    const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody)

    if (!response.status) {
      throw new Error(`Download failed with status ${response.status}`)
    }

    const { status, file_path } = response.data;

    if (!status || !file_path) {
      throw new Error("Download failed: No file path returned");
    }

    const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const timePeriod = timeGrain === "monthly" ? "Monthly" : "Weekly"
    let fileName = `Cancelled_TTS_${timePeriod}_${timestamp}.xlsx`

    saveAs(file_path, fileName);
  } catch (error) {
    console.error("Error downloading Excel:", error)
    setError(error instanceof Error ? error.message : "Failed to download Excel file")
  } finally {
    setIsDownloading(false)
  }
}

// 4. Add hasData computed value (add this after your existing state declarations)
const hasData = gridData.length > 0


  const columnDefs: ColDef<DetailRow>[] = [
    {
      headerName: timeGrain === "monthly" ? "Month" : "Date",
      field: "month",
      sort: "desc" as SortDirection,
      flex: 1,
      minWidth: 140,
    },
    { headerName: "Zone", field: "zone", flex: 1, minWidth: 100 },
    { headerName: "Plant", field: "location_name", flex: 1, minWidth: 100 },
    { headerName: "SAP ID", field: "sap_id", flex: 1, minWidth: 100 },
    { headerName: "Truck Number", field: "truck_number", flex: 1, minWidth: 150 },
    {
      headerName: "Load Number",
      field: "load_number",
      flex: 1,
      minWidth: 150,
    },
    {
      headerName: "Total Alerts",
      field: "total_alerts",
      flex: 1,
      minWidth: 150,
      valueFormatter: (params) => params.value?.toLocaleString(),
    },
    {
      headerName: "Total Fan Qty",
      field: "total_fan_qty",
      flex: 1,
      minWidth: 150,
      valueFormatter: (params) => params.value?.toLocaleString(),
    },
    { headerName: "Indent Breakup", field: "indent_breakup", flex: 1, minWidth: 150 },
  ]

  // Handle refresh button click - clear error and filters
  const handleRefresh = () => {
    setIsLoading(true)
    setIsTransitioning(true)
    setError(null) // Clear error message
    setActiveFilter(null) // Clear active chart filter
    
    // Set time grain to weekly
    setTimeGrain("weekly")
  
    // Clear zone and plant selections
    setSelectedZone("")
    setSelectedPlant("")
  
    // Reset date range to default values based on weekly time grain (since we're forcing weekly)
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

    // Reset filtered grid data to show all data
    setFilteredGridData([])

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
    setActiveFilter(null)
    setFilteredGridData([])

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

  const fetchData = useCallback(async () => {
    setIsTransitioning(true)
    try {
      // API call for cancelled TTS data
      const apiEndpoint = "/api/charts/generate_vis_data"

      // Create a copy of crossFilters to avoid modifying the original
      const effectiveCrossFilters = [...crossFilters]

      // If in weekly mode and no date filter exists, add a default one
      if (
        timeGrain === "weekly" &&
        !effectiveCrossFilters.some((filter) => filter.key === '"DATE"') &&
        fromDate &&
        toDate
      ) {
        const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
        effectiveCrossFilters.push({
          key: '"DATE"',
          cond: "equals",
          value: `${formatDate(fromDate)},${formatDate(toDate)}`,
        })
      }

      // Use correct request body structure based on time grain
      const requestBody = {
        filters: filters || [],
        action: "cancelled_tts",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters || [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: "",
      }

      console.log("API Request:", JSON.stringify(requestBody))

      const response = await apiClient.post(apiEndpoint, requestBody)

      if (!response.status) {
        throw new Error(`API responded with status ${response.status}`)
      }

      const result = response.data

      // Return both graph_data (for chart) and appropriate data for table
      return {
        chartData: result.graph_data || {},
        tableData: timeGrain === "monthly" ? result.monthly_data || {} : result.daily_data || {},
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch data")
      return { chartData: {}, tableData: {} }
    } finally {
      setIsLoading(false)
      setIsTransitioning(false)
    }
  }, [filters, crossFilters, timeGrain, fromDate, toDate])
const getMonthOrder = (monthStr) => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Extract month name from various formats
  let monthName = monthStr;
  
  // If it contains a year, extract just the month part
  const monthYearMatch = monthStr.match(/^([A-Za-z]{3,})\s+(\d{4})$/);
  if (monthYearMatch) {
    monthName = monthYearMatch[1];
  }
  
  const yearMonthMatch = monthStr.match(/^(\d{4})\s+([A-Za-z]{3,})$/);
  if (yearMonthMatch) {
    monthName = yearMonthMatch[2];
  }
  
  // Check short month names
  const shortIndex = months.findIndex(m => 
    m.toLowerCase() === monthName.toLowerCase()
  );
  if (shortIndex !== -1) return shortIndex;
  
  // Check full month names
  const fullIndex = fullMonths.findIndex(m => 
    m.toLowerCase() === monthName.toLowerCase()
  );
  if (fullIndex !== -1) return fullIndex;
  
  return -1; // Return -1 if month is not found
};

const processData = (apiResponse: any): { chartData: ChartDataPoint[]; gridData: DetailRow[] } => {
  if (!apiResponse) {
    console.log("No data in API response");
    return { chartData: [], gridData: [] };
  }

  // Process table data
  const tableData = apiResponse.tableData || {};
  console.log("Processing table data:", tableData);

  const gridData: DetailRow[] = [];

  // Check if we have data
  if (Object.keys(tableData).length === 0) {
    console.log("No table data available");
    return { chartData: [], gridData: [] };
  }

  Object.keys(tableData).forEach((month) => {
    const monthEntries = tableData[month];

    if (!Array.isArray(monthEntries)) {
      console.log(`Invalid data format for month ${month}:`, monthEntries);
      return;
    }

    monthEntries.forEach((entry) => {
      // Add to grid data
      gridData.push({
        month,
        zone: entry.zone || "",
        location_name: entry.location_name || "",
        sap_id: entry.sap_id || "",
        truck_number: entry.truck_number || "No Truck",
        load_number: entry.load_number || "",
        total_alerts: entry.total_alerts || 0,
        total_fan_qty: entry.total_fan_qty || 0,
        indent_breakup: entry.indent_breakup ?? "",
      });
    });
  });

  // Process chart data from graph_data
  const graphData = apiResponse.chartData || {};
  console.log("Processing chart data:", graphData);

  const chartData: ChartDataPoint[] = Object.keys(graphData)
    .map((date) => ({
      month: date,
      total_alerts: graphData[date].total_alerts || 0,
      total_fan_qty: graphData[date].total_fan_qty || 0,
    }))
    .sort((a, b) => {
      const monthOrderA = getMonthOrder(a.month);
      const monthOrderB = getMonthOrder(b.month);
      
      // If both have valid month orders, sort by month first, then by year
      if (monthOrderA !== -1 && monthOrderB !== -1) {
        // Extract year from the date string
        const yearA = a.month.match(/\d{4}/)?.[0] || '';
        const yearB = b.month.match(/\d{4}/)?.[0] || '';
        
        // If years are different, sort by year first
        if (yearA && yearB && yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        
        // If same year or no year, sort by month
        if (monthOrderA !== monthOrderB) {
          return monthOrderA - monthOrderB;
        }
        
        // Same month and year, maintain order
        return 0;
      }
      
      // If one has valid order, prioritize it
      if (monthOrderA !== -1) return -1;
      if (monthOrderB !== -1) return 1;
      
      // For YYYY-MM format, use direct comparison
      if (a.month.match(/^\d{4}-\d{2}$/) && b.month.match(/^\d{4}-\d{2}$/)) {
        return a.month.localeCompare(b.month);
      }
      
      // For date format, use Date object to sort
      try {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateA.getTime() - dateB.getTime();
        }
      } catch {
        // Fall through to localeCompare
      }
      
      // Fallback to localeCompare
      return a.month.localeCompare(b.month);
    });

  console.log("Chart data:", chartData);
  console.log("Grid data length:", gridData.length);

  // Sort grid data by month to keep dates in order - use same logic as chart data
  const sortedGridData = gridData.sort((a, b) => {
    const monthA = a.month || '';
    const monthB = b.month || '';
    
    // Try to use getMonthOrder for month name formats
    const orderA = getMonthOrder(monthA);
    const orderB = getMonthOrder(monthB);
    
    // If both have valid month orders, sort by that
    if (orderA !== -1 && orderB !== -1) {
      // If same month, try to extract year for secondary sort
      if (orderA === orderB) {
        const yearA = monthA.match(/\d{4}/)?.[0] || '';
        const yearB = monthB.match(/\d{4}/)?.[0] || '';
        if (yearA && yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
      }
      return orderA - orderB;
    }
    
    // If one has valid order, prioritize it
    if (orderA !== -1) return -1;
    if (orderB !== -1) return 1;
    
    // For YYYY-MM format, use direct comparison
    if (monthA.match(/^\d{4}-\d{2}$/) && monthB.match(/^\d{4}-\d{2}$/)) {
      return monthA.localeCompare(monthB);
    }
    
    // For date format, use Date object to sort
    try {
      const dateA = new Date(monthA);
      const dateB = new Date(monthB);
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return dateA.getTime() - dateB.getTime();
      }
    } catch {
      // Fall through to localeCompare
    }
    
    // Fallback to localeCompare
    return monthA.localeCompare(monthB);
  });

  return { chartData, gridData: sortedGridData };
};


  // Function to filter grid data based on selected data point
  const filterGridDataByPoint = (timeValue: string) => {
    // Reset filtered data if clicking the same filter again
    if (activeFilter === timeValue) {
      setActiveFilter(null)
      setFilteredGridData([])
      return
    }

    // Use ref so chart click handler has latest data (avoids stale closure)
    const source = gridDataRef.current.length > 0 ? gridDataRef.current : gridData
    setActiveFilter(timeValue)
    const filtered = source.filter((item) => item.month === timeValue)
    setFilteredGridData(filtered)
  }

  useEffect(() => {
    let root: am5.Root | null = null

    const initChart = async () => {
      if (!chartDivRef.current) {
        console.error("Chart div ref is null")
        return
      }

      // Dispose of previous chart if it exists
      if (rootRef.current) {
        rootRef.current.dispose()
      }

      // Fetch data and process it
      const apiResponse = await fetchData()
      if (!apiResponse) {
        console.error("No API response")
        return
      }

      const { chartData, gridData } = processData(apiResponse)
      setGridData(gridData)
      gridDataRef.current = gridData

      // Reset filtered grid data when chart reloads
      setFilteredGridData([])
      setActiveFilter(null)

      // If no data, don't attempt to create chart
      if (chartData.length === 0) {
        console.log("No chart data available")
        setIsLoading(false)
        setIsTransitioning(false)
        return
      }

      try {
        // Create new root and chart
        root = am5.Root.new(chartDivRef.current)
        rootRef.current = root
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

        // Find the highest alert value to set appropriate max value for the primary axis
        let maxAlertValue = 0
        chartData.forEach((dataPoint) => {
          if (dataPoint.total_alerts > maxAlertValue) {
            maxAlertValue = dataPoint.total_alerts
          }
        })

        // Add 30% more to the max value for better visualization
        const alertAxisMax = Math.ceil(maxAlertValue * 1.3) || 10 // Use default of 10 if no data

        // Create Y-axis for alerts
        const alertsAxis = chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            min: 0,
            max: alertAxisMax,
            renderer: am5xy.AxisRendererY.new(root, {
              minGridDistance: 30,
            }),
            numberFormat: "#,###",
            tooltip: am5.Tooltip.new(root, {
              labelText: "{valueY}",
            }),
          }),
        )

        alertsAxis.get("renderer").labels.template.setAll({
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
          cursorOverStyle: "pointer",
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
            paddingBottom: 0,
          }),
        )

        // Add Y-axis title
        alertsAxis.children.unshift(
          am5.Label.new(root, {
            rotation: -90,
            text: "Cancelled TTS Alerts",
            y: am5.p50,
            centerX: am5.p50,
            fontSize: 10,
            fontWeight: "bold",
            paddingBottom: 0,
          }),
        )

        // Set data for the X axis
        xAxis.data.setAll(chartData)

        // Create alert series
        const alertSeries = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "Total Alerts",
            xAxis: xAxis,
            yAxis: alertsAxis,
            valueYField: "total_alerts",
            categoryXField: "month",
            stroke: am5.color("#D14242"), // Red color for alerts
            fill: am5.color("#D14242"),
            tooltip: am5.Tooltip.new(root, {
              labelText: `[bold fontSize:12px]Total Alerts: [bold fontSize:12px]{total_alerts}[/], [bold fontSize:12px]Fan Qty: [bold fontSize:12px]{total_fan_qty}[/]`,
              maxWidth: 300,
              forceHidden: false,
              paddingBottom: 2,
              paddingTop: 1,
              background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0xffffff), // White background
                fillOpacity: 0.7, // 70% opacity (semi-transparent)
                strokeOpacity: 0.5, // Slightly transparent border
              }),
            }),
            minBulletDistance: 10,
          }),
        )

        // Only show tooltip if total_alerts > 0
        alertSeries.get("tooltip").adapters.add("visible", (visible, target) => {
          return (target.dataItem?.dataContext as ChartDataPoint)?.total_alerts > 0
        })

        // Add circle bullets with click events
        alertSeries.bullets.push((root) => {
          const circle = am5.Circle.new(root, {
            radius: 5,
            fill: am5.color("#D14242"), // Red color for alerts
            strokeWidth: 2,
            cursorOverStyle: "pointer",
            interactive: true,
          })

          // Add click events to the bullets
          circle.events.on("click", (ev) => {
            const dataItem = ev.target.dataItem
            if (dataItem) {
              const category = dataItem.dataContext["month"]
              if (category) {
                filterGridDataByPoint(category.toString())
              }
            }
          })

          return am5.Bullet.new(root, {
            sprite: circle,
          })
        })

        // Add label bullets above data points
        alertSeries.bullets.push((root) => {
          const labelBullet = am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "{total_alerts}",
              fill: am5.color(0x000000),
              centerY: am5.p0,
              centerX: am5.p50,
              populateText: true,
              fontSize: 10,
              fontWeight: "bold",
              dy: -25,
            }),
          })

          // Hide label if value is 0
          labelBullet.get("sprite").adapters.add("visible", (visible, target) => {
            const dataItem = target.dataItem
            return (dataItem?.dataContext as ChartDataPoint)?.total_alerts > 0
          })

          return labelBullet
        })

        // Set data for the alert series
        alertSeries.data.setAll(chartData)

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

        // Add legend
        const legend = chart.children.unshift(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            layout: root.horizontalLayout,
            marginTop: 0,
            marginBottom: 0,
          }),
        )

        // Set legend items style
        legend.labels.template.setAll({
          fontSize: 10,
          fontWeight: "bold",
        })

        legend.valueLabels.template.setAll({
          fontSize: 12,
        })

        // Set legend data from series
        legend.data.setAll(chart.series.values)

        // Apply chart appearance animation
        chart.appear(1000, 100)
        setError(null)
      } catch (error) {
        console.error("Error initializing chart:", error)
        // setError(`Error initializing chart: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    initChart()

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [refreshKey, crossFilters, timeGrain, filters])

  useEffect(() => {
    if (onDateFilterChange && fromDate && toDate) {
      const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
      const sqlFilter = `created_at::DATE BETWEEN '${formatDate(fromDate)}' AND '${formatDate(toDate)}'`
      onDateFilterChange(sqlFilter)
    }
  }, [])

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded)
  }

  const handleTableExcelExport = () => {
    const data = filteredGridData.length > 0 ? filteredGridData : gridData;
    if (data.length === 0) return;
    const headers = [
      timeGrain === "monthly" ? "Month" : "Date",
      "Zone", "Plant", "SAP ID", "Truck Number",
      "Load Number", "Total Alerts", "Total Fan Qty", "Indent Breakup"
    ];
    const rows = data.map(row => [
      row.month ?? "", row.zone ?? "", row.location_name ?? "",
      row.sap_id ?? "", row.truck_number ?? "", row.load_number ?? "",
      row.total_alerts ?? "", row.total_fan_qty ?? "", row.indent_breakup ?? ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cancelled TTS Data");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(wb, `Cancelled_TTS_Data_${ts}.xlsx`);
  };

  // Clear chart point filter
  const clearChartFilter = () => {
    setActiveFilter(null)
    setFilteredGridData([])
  }

  // Notify parent when chart filter (filtered by date/month) changes so host table can filter query
  useEffect(() => {
    if (onChartFilterChange) {
      onChartFilterChange(activeFilter)
    }
  }, [activeFilter, onChartFilterChange])

  // Chart title
  const chartTitle = `Cancelled TTS Analysis (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`

  const filterPortalEl = filterPortalId ? document.getElementById(filterPortalId) : null

  const filterControls = (
    <>
      <Select value={timeGrain} onValueChange={handleTimeGrainChange}>
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

  return (
    <>
      {filterPortalEl && createPortal(filterControls, filterPortalEl)}
    <div className="flex gap-1 p-1">
      <div className={`${isTableExpanded ? "hidden" : "w-1/2"}`}>
        {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleExpand} />}
        <Card
          className={`transition-all duration-300 ${
            isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-1 pt-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">{chartTitle}</CardTitle>
                <div className="flex items-center gap-2">
                  {!filterPortalEl && filterControls}
<Button
  onClick={handleDownloadExcel}
  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
  disabled={isDownloading || isLoading || !hasData}
  title="Download Excel"
>
  {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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
                <p>No data available</p>
              </div>
            )}

            {!isLoading && !error && !isTransitioning && gridData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                <p>No data available for the selected time period</p>
              </div>
            )}

            <div
              ref={chartDivRef}
              style={{
                width: "100%",
                height: isExpanded ? "calc(100vh - 8rem)" : "350px",
              }}
              className="chart-container"
            />

            {activeFilter && (
              <div className="absolute bottom-2 left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center">
                <span>Filtered by: {activeFilter}</span>
                <button className="ml-2 text-blue-600 hover:text-blue-800" onClick={clearChartFilter}>
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
          className={`transition-all duration-300 ${
            isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                Cancelled TTS Data
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
            <style>{`
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible,
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                opacity: 1 !important;
                visibility: visible !important;
                min-height: 12px !important;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport,
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container {
                overflow-x: scroll !important;
                min-height: 12px !important;
                -ms-overflow-style: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar {
                display: block !important;
                height: 12px;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-thumb:hover {
                background: #475569;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-center-cols-viewport {
                overflow-x: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar {
                display: block !important;
                height: 12px;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .cancelled-tts-trend-grid.ag-theme-alpine .ag-center-cols-container {
                min-width: max-content;
              }
            `}</style>
            <div
              className="ag-theme-alpine cancelled-tts-trend-grid"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
                width: "100%",
                minHeight: 0,
              }}
            >
              <AgGridReact
                columnDefs={columnDefs}
                rowData={filteredGridData.length > 0 ? filteredGridData : gridData}
                alwaysShowHorizontalScroll={true}
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
  )
}

export default CancelledTTSTrendChart

