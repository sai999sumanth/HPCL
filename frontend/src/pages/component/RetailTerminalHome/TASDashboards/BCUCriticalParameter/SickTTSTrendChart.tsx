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
import { toast } from "sonner"
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface ChartDataPoint {
  month: string
  totalAlerts: number // Sum of total_alerts for this month (for chart)
  [key: string]: number | string // Dynamic properties for each BCU
}

interface DetailRow {
  month: string
  zone: string
  sap_id: string
  tt_number?: string
  load_number?: number | string
  location_name: string
  total_required_quantity: string
  total_loaded_quantity: string
  fan_qty: string
  indent_breakup: string
  bcu_number: any
  total_alerts: number
  remarks?: string
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
  onChartFilterChange?: (filterDate: string | null) => void;
  filterPortalId?: string;
}

const SickTTSTrendChart: React.FC<BayReassignmentChartProps> =  ({ filters, onDateFilterChange, onBcuFilterChange, onChartFilterChange, filterPortalId }) => {
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
  const [bayNumbers, setBayNumbers] = useState<string[]>([])
  const gridDataRef = useRef<DetailRow[]>([])

  const [bcuNumberOptions, setBcuNumberOptions] = useState<string[]>([]);
const [selectedBcuNumbers, setSelectedBcuNumbers] = useState<string>("");
const [selectedBcu, setSelectedBcu] = useState(undefined);
const [localFilters, setLocalFilters] = useState([]);
const [isDownloading, setIsDownloading] = useState(false)
const [hasData, setHasData] = useState(false)

const handleDownload = async () => {
  setIsDownloading(true)
  try {
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

    // Use the same request body structure as fetchData
    const requestBody = {
      filters: combinedFilters ||  [],
      action: "sick_tts",
      drill_state: timeGrain === "weekly" ? "date" : "",
      cross_filters: effectiveCrossFilters || [],
      limit: 0,
      time_grain: "",
      resp_format: "",
      resp_level: ""
    }

    console.log("Download Request:", JSON.stringify(requestBody))
    
    const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody)
    
    if (!response.status) {
      throw new Error(`Download failed with status ${response.status}`)
    }
    
    let fileName = 'sick_tts_report.xlsx' // default filename
    let filePath = response.data?.file_path;

    saveAs(filePath, fileName);
    toast.success("Excel file downloaded successfully");
    
    
  } catch (error) {
    console.error("Download error:", error)
    // You might want to show a toast or alert here
    alert(`Download failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  } finally {
    setIsDownloading(false)
  }
}


  const columnDefs: ColDef<DetailRow>[] = [
    {
      headerName: timeGrain === "monthly" ? 'Month' : 'Date',
      field: 'month',
      sort: "desc" as SortDirection,
      minWidth: 120,
      flex: 0,
      width: 120,
    },
    { headerName: "Zone", field: "zone", minWidth: 90, flex: 0, width: 90 },
    { headerName: "Plant", field: "location_name", minWidth: 180, flex: 0, width: 180 },
    { headerName: "SAP ID", field: "sap_id", minWidth: 100, flex: 0, width: 100 },
    { headerName: "TT Number", field: "tt_number", minWidth: 130, flex: 0, width: 130 },
    { headerName: "Load Number", field: "load_number", minWidth: 130, flex: 0, width: 130 },
    { headerName: "Total Fan Qty", field: "fan_qty", minWidth: 160, flex: 0, width: 160 },
    { headerName: "Total Loaded Qty", field: "total_loaded_quantity", minWidth: 160, flex: 0, width: 160 },
    {
      headerName: "Total Alerts",
      field: "total_alerts",
      minWidth: 140,
      flex: 0,
      width: 140,
      valueFormatter: (params) => params.value?.toLocaleString()
    },
    { headerName: "Products", field: "indent_breakup"},
    { headerName: "Remarks", field: "remarks", minWidth: 300, flex: 1, width: 300 }
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
  useEffect(() => {
    if (onDateFilterChange && fromDate && toDate) {
      const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
      const sqlFilter = `created_at::DATE BETWEEN '${formatDate(fromDate)}' AND '${formatDate(toDate)}'`
      onDateFilterChange(sqlFilter)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setIsTransitioning(true)
    setError(null) // clear previous error so overlay doesn't show when we have data
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
        filters: combinedFilters ||  [],
        action: "sick_tts",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters || [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: ""
      }

      console.log("API Request:", JSON.stringify(requestBody))
      
      const response = await apiClient.post(apiEndpoint, requestBody)
      
      if (!response.status) {
        throw new Error(`API responded with status ${response.status}`);
      }
      
      const result = response.data
      
      // Clear error on success so "No data available" overlay doesn't stay
      setError(null)
      
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
  },[filters, localFilters, crossFilters, timeGrain])

  const processData = (apiResponse: any): { chartData: ChartDataPoint[]; gridData: DetailRow[] } => {
    if (!apiResponse || !apiResponse.data) {
      console.log("No data in API response", apiResponse);
      return { chartData: [], gridData: [] }
    }

    const data = apiResponse.data
    console.log("Processing data:", data);
    
    const allBays = new Set<string>()
    const monthData = new Map<string, Map<string, number>>()
    const monthTotals = new Map<string, number>() // Sum of total_alerts per month for chart
    const gridData: DetailRow[] = []

    // First pass: collect all BCU/bay numbers, per-BCU counts, and total alerts per month; build raw rows for table
    Object.keys(data).forEach(month => {
      const monthEntries = data[month]
      if (!monthData.has(month)) {
        monthData.set(month, new Map<string, number>())
        monthTotals.set(month, 0)
      }
      monthEntries.forEach(entry => {
        const bcu_number = entry.bcu_number ?? ""
        const total_alerts = entry.total_alerts || 0
        allBays.add(bcu_number)
        monthData.get(month)?.set(bcu_number, total_alerts)
        monthTotals.set(month, (monthTotals.get(month) || 0) + total_alerts)
        gridData.push({
          month,
          zone: entry.zone || "",
          location_name: entry.location_name || "",
          sap_id: entry.sap_id || "",
          tt_number: String(entry.tt_number ?? ""),
          load_number: entry.load_number ?? "",
          bcu_number: entry.bcu_number ?? "",
          total_alerts,
          total_required_quantity: String(entry.total_required_qty ?? entry.total_required_quantity ?? ""),
          fan_qty: String(entry.total_fan_qty ?? entry.fan_qty ?? entry.total_fan_quantity ?? ""),
          indent_breakup: String(entry.indent_breakup ?? entry.products ?? ""),
          total_loaded_quantity: String(entry.total_loaded_qty ?? entry.total_loaded_quantity ?? ""),
          remarks: String(entry.remarks ?? ""),
        })
      })
    })

    // Group table rows by same (month, load_number): merge into one row with summed totals
    const loadKey = (r: DetailRow) => `${r.month}|${r.load_number ?? ""}`
    const grouped = new Map<string, DetailRow>()
    gridData.forEach(row => {
      const key = loadKey(row)
      const existing = grouped.get(key)
      if (!existing) {
        grouped.set(key, { ...row })
        return
      }
      const reqQty = (parseFloat(existing.total_required_quantity) || 0) + (parseFloat(row.total_required_quantity) || 0)
      const loadedQty = (parseFloat(existing.total_loaded_quantity) || 0) + (parseFloat(row.total_loaded_quantity) || 0)
      const fanQty = (parseFloat(existing.fan_qty) || 0) + (parseFloat(row.fan_qty) || 0)
      const existingRemarks = (existing.remarks || "").trim()
      const rowRemarks = (row.remarks || "").trim()
      const mergedRemarks = [existingRemarks, rowRemarks].filter(Boolean).join(" | ")
      grouped.set(key, {
        ...existing,
        total_alerts: existing.total_alerts + (row.total_alerts || 0),
        total_required_quantity: String(reqQty),
        total_loaded_quantity: String(loadedQty),
        fan_qty: String(fanQty),
        remarks: mergedRemarks || undefined,
      })
    })
    const mergedGridData = Array.from(grouped.values())

    const bayNumbersArray = Array.from(allBays)
    setBayNumbers(bayNumbersArray)

    // Sort months chronologically (Jun, Jul, Aug, Sep...) - not alphabetically
    const MONTH_INDEX: Record<string, number> = {
      Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
      Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
    }
    const toMonthOrder = (s: string): number => {
      const [mon, year] = String(s).split("-")
      const m = MONTH_INDEX[mon]
      const y = parseInt(year, 10)
      if (m && !isNaN(y)) return y * 12 + m
      return 0
    }
    const monthKeys = Array.from(monthData.keys())
    const sortedMonths = monthKeys.sort((a, b) => toMonthOrder(a) - toMonthOrder(b) || String(a).localeCompare(String(b)))

    const sortedGridData = mergedGridData.sort((a, b) => {
      const orderA = toMonthOrder(a.month || "")
      const orderB = toMonthOrder(b.month || "")
      return orderA - orderB || (a.month || "").localeCompare(b.month || "")
    })

    const chartData: ChartDataPoint[] = []
    sortedMonths.forEach(month => {
      const dataPoint: ChartDataPoint = {
        month,
        totalAlerts: monthTotals.get(month) || 0,
      }
      bayNumbersArray.forEach(bay => {
        dataPoint[bay] = monthData.get(month)?.get(bay) || 0
      })
      chartData.push(dataPoint)
    })

    console.log("Chart data:", chartData);
    console.log("Grid data length:", sortedGridData.length);

    return { chartData, gridData: sortedGridData }
  }

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
    const filtered = source.filter(item => item.month === timeValue)
    setFilteredGridData(filtered)
  }

  const handleBcuNumberChange = (value) => {
    setSelectedBcu(value);
    const bcuQuery = value && value !== "All BCUs" 
        ? `bcu_number = '${value}'` 
        : ""; // Empty string when "All BCUs" is selected
      
      // Call the callback function with the SQL filter
      if (onBcuFilterChange) {
        onBcuFilterChange(bcuQuery);
      }
    
    if (value === "All BCUs") {
      // "All BCUs" selected - remove filter
      setLocalFilters(prev => prev.filter(f => f.key !== "bcu_number"));
    } else {
      // Specific BCU selected - add filter
      const bcuFilter = {
        key: "bcu_number",
        cond: "equals",
        value: value
      };
      
      setLocalFilters(prev => {
        const filtersWithoutBcu = prev.filter(f => f.key !== "bcu_number");
        return [...filtersWithoutBcu, bcuFilter];
      });
    }
    
    setRefreshKey(prev => prev + 1);
  };
  

  useEffect(() => {
    let root: am5.Root | null = null
  
    const initChart = async () => {
      if (!chartDivRef.current) {
        console.error("Chart div ref is null");
        return;
      }
  
      // Dispose of previous chart if it exists
      if (rootRef.current) {
        rootRef.current.dispose()
      }
  
      // Fetch data and process it
      const apiResponse = await fetchData()
      if (!apiResponse) {
        console.error("No API response");
        return;
      }
  
      const { chartData, gridData } = processData(apiResponse)
      setGridData(gridData)
      gridDataRef.current = gridData

      // Dropdown: only BCU numbers that come from the API response (bcu_number)
      const uniqueBcus = Array.from(new Set(gridData.map(item => item.bcu_number))).filter(Boolean);
      console.log('[SickTTSTrendChart] BCU number count in dropdown:', uniqueBcus.length, 'BCUs:', uniqueBcus);
      setBcuNumberOptions(uniqueBcus);
      
      // Reset filtered grid data when chart reloads
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
    
        // Max value from total alerts per month for Y-axis
        const maxValue = Math.max(...chartData.map((d) => Number(d.totalAlerts) || 0), 0)
        const yAxisMax = Math.max(10, Math.ceil(maxValue * 1.3))
        
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
            text: "Sick TT Alerts",
            y: am5.p50,
            centerX: am5.p50,
            fontSize: 10,
            fontWeight: "bold",
            paddingBottom: 0
          })
        );
        
        // Set data for the X axis
        xAxis.data.setAll(chartData)

        // Single series: Total Alerts per month (Jan total, Feb total, etc.)
        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "Total Alerts",
            xAxis,
            yAxis,
            valueYField: "totalAlerts",
            categoryXField: "month",
            stroke: am5.color(0x4682b4),
            fill: am5.color(0x4682b4),
            tooltip: am5.Tooltip.new(root, {
              labelText: "[bold]Total Alerts:[/] {valueY}",
              background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0xffffff),
                fillOpacity: 0.9,
              }),
            }),
            minBulletDistance: 10,
          }),
        )

        series.bullets.push(() => {
          const circle = am5.Circle.new(root, {
            radius: 5,
            fill: am5.color(0x4682b4),
            strokeWidth: 2,
            cursorOverStyle: "pointer",
            interactive: true,
          })
          circle.events.on("click", (ev) => {
            const dataItem = ev.target.dataItem
            if (dataItem?.dataContext?.["month"]) {
              filterGridDataByPoint(String(dataItem.dataContext["month"]))
            }
          })
          return am5.Bullet.new(root, { sprite: circle })
        })

        series.bullets.push(() =>
          am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "{valueY}",
              fill: am5.color(0x000000),
              centerY: am5.p0,
              centerX: am5.p50,
              populateText: true,
              fontSize: 10,
              fontWeight: "bold",
              dy: -25,
            }),
          }),
        )
        series.data.setAll(chartData)
        
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
          })
        )
        
        // Set legend items style
        legend.labels.template.setAll({
          fontSize: 10,
          fontWeight: "bold",
        })
        
        legend.valueLabels.template.setAll({
          fontSize: 12
        })
        
        // Set legend data from series
        legend.data.setAll(chart.series.values)
    
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
  }, [refreshKey, crossFilters, timeGrain,filters])

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
      "Zone", "Plant", "SAP ID", "TT Number", "Load Number",
      "Total Fan Qty", "Total Loaded Quantity", "Total Alerts", "Products", "Remarks"
    ];
    const rows = data.map(row => [
      row.month ?? "", row.zone ?? "", row.location_name ?? "",
      row.sap_id ?? "", row.tt_number ?? "", row.load_number ?? "",
      row.fan_qty ?? "", row.total_loaded_quantity ?? "",
      row.total_alerts ?? "", row.indent_breakup ?? "", row.remarks ?? ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sick TT Data");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(wb, `Sick_TT_Data_${ts}.xlsx`);
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
  const chartTitle = `Sick TT Analysis (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`

  const filterPortalEl = filterPortalId ? document.getElementById(filterPortalId) : null

  const filterControls = (
    <>
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

  return (<>
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
                <CardTitle className="text-xs font-bold text-gray-800">
                  {chartTitle}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!filterPortalEl && filterControls}
<Button
  onClick={handleDownload}
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

            {error && gridData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                <p>No data available</p>
              </div>
            )}

            {bayNumbers.length === 0 && !isLoading && !error && (
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
          className={`transition-all duration-300 ${
            isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                Sick TT Data
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
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible,
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                opacity: 1 !important;
                visibility: visible !important;
                min-height: 12px !important;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport,
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container {
                overflow-x: scroll !important;
                min-height: 12px !important;
                -ms-overflow-style: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar {
                display: block !important;
                height: 12px;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
              .sick-tt-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-thumb:hover {
                background: #475569;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-center-cols-viewport {
                overflow-x: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar {
                display: block !important;
                height: 12px;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .sick-tt-trend-grid.ag-theme-alpine .ag-center-cols-container {
                min-width: max-content;
              }
            `}</style>
            <div
              className="ag-theme-alpine sick-tt-trend-grid"
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
  </>)
}

export default SickTTSTrendChart