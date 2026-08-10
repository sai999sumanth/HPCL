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
import { Loader2, RotateCcw, Download, Maximize2, Minimize2 } from "lucide-react"
import { DateRangePickerFilter } from "../DateRangePickerFilter"
import { apiClient } from "@/services/apiClient"
import { toast } from "sonner"
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx';
import SafetyProcessGantryTable from "../../../alertsTable/SafetyProcessGantryTable"

interface ChartDataPoint {
  month: string
  [key: string]: number | string // Dynamic properties for each BCU number
}

interface DetailRow {
  month: string
  zone: string
  sap_id: string
  location_name: string
  bcu_number: string
  total_alerts: number
}

/** K Factor Main API response row (for BCU K Factor tab) */
interface KFactorMainRow {
  month?: string
  alert_category?: string
  alert_type?: string
  count?: number
  zone?: string
  [key: string]: unknown
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface KFactorChartProps {
  filters: FilterValue[];
  zone?: string | null;
  plant?: string | null;
  onDateFilterChange?: (filter: string) => void;
  onBcuFilterChange?: (filter: string) => void;
  onActiveTabChange?: (tab: 0 | 1) => void;
  filterPortalId?: string;
}

const KFactorTrendChart: React.FC<KFactorChartProps> = ({ filters, zone: zoneProp, plant: plantProp, onDateFilterChange, onBcuFilterChange, onActiveTabChange, filterPortalId }) => {
  const rootRef = useRef<am5.Root | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [gridData, setGridData] = useState<DetailRow[]>([])
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
  const [bcuNumbers, setBcuNumbers] = useState<string[]>([])

  const [bcuNumberOptions, setBcuNumberOptions] = useState<string[]>([]);
const [selectedBcuNumbers, setSelectedBcuNumbers] = useState<string>("");
const [selectedBcu, setSelectedBcu] = useState(undefined);
const [localFilters, setLocalFilters] = useState([]);

const [isDownloading, setIsDownloading] = useState(false)
const [hasData, setHasData] = useState(false)
  const [activeTab, setActiveTab] = useState<0 | 1>(0) // 0 = Analog K-Factor Change (default), 1 = BCU K Factor Changes
  const [kFactorMainData, setKFactorMainData] = useState<KFactorMainRow[]>([])
  const chartDivRefBcu = useRef<HTMLDivElement | null>(null)
  const rootRefBcu = useRef<am5.Root | null>(null)

  useEffect(() => {
    onActiveTabChange?.(activeTab)
  }, [activeTab, onActiveTabChange])

// 3. Add this download handler function
const handleDownloadExcel = async () => {
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

    // Use the same request body structure as fetchData (match TASTrendChart)
    const requestBody = {
      filters: combinedFilters || [],
      action: "kfactor",
      drill_state: timeGrain === "weekly" ? "date" : "",
      cross_filters: effectiveCrossFilters || [],
      time_grain: timeGrain === "weekly" ? "week" : "",
    }

    console.log("Download API Request:", JSON.stringify(requestBody))
    
    const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody)
    

    if (!response.status) {
      throw new Error(`Download failed: ${response.statusText}`)
    }

    let filePath = response.data?.file_path
    let fileName = `KFactor_${timeGrain}_${dayjs().format("YYYY-MM-DD_HH-mm-ss")}.xlsx`
    
    saveAs(filePath, fileName);
    toast.success("Excel file downloaded successfully");
    
  } catch (error) {
    console.error("Error downloading Excel:", error)
    setError(error instanceof Error ? error.message : "Failed to download Excel file")
  } finally {
    setIsDownloading(false)
  }
}


  const columnDefs: ColDef<DetailRow>[] = [
    {
      headerName: timeGrain === "monthly" ? 'Month' : 'Date',
      field: 'month',
      sort: "desc" as SortDirection,
    },
    { headerName: "Zone", field: "zone" },
    { headerName: "Plant", field: "location_name" },
    { headerName: "SAP ID", field: "sap_id" },
    { headerName: "BCU Number", field: "bcu_number" },
    { 
      headerName: "Total Alerts", 
      field: "total_alerts",
      valueFormatter: (params) => params.value?.toLocaleString() 
    }
  ]

  const columnDefsKFactorMain: ColDef<KFactorMainRow>[] = [
    { headerName: "Month", field: "month", sort: "desc" as SortDirection },
    { headerName: "Alert Category", field: "alert_category" },
    { headerName: "Alert Type", field: "alert_type" },
    { headerName: "Count", field: "count", valueFormatter: (p) => p.value?.toLocaleString() },
    { headerName: "Zone", field: "zone" },
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

  const fetchData =   useCallback(async () => { 

    setIsTransitioning(true)
    try {
      // API call for k-factor data
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

      // Use correct request body structure based on time grain (match TASTrendChart pattern)
      const requestBody = {
        filters: combinedFilters ||  [],
        action: "kfactor",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters || [],
        limit: 0,
        time_grain: timeGrain === "weekly" ? "week" : "",
        resp_format: "",
        resp_level: ""
      }

      console.log("API Request:", JSON.stringify(requestBody))
      
      const response = await apiClient.post(apiEndpoint, requestBody)
      
      const result = response.data
      // K Factor Main: top-level key only (same as TASTrendChart equipment keys); support both naming conventions
      const raw =
        result["K Factor Main"] ??
        result.k_factor_main ??
        (timeGrain === "monthly" ? result.monthly_data?.["K Factor Main"] : result.daily_data?.["K Factor Main"])
      const kFactorMain = (Array.isArray(raw) ? raw : []) as KFactorMainRow[]
      return {
        data: timeGrain === "monthly" ? result.monthly_data || {} : result.daily_data || {},
        kFactorMain,
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

  // Same API as TASTrendChart so "K Factor Main" data comes through (action tas_normal_count returns equipment keys at top level)
  const fetchKFactorMainData = useCallback(async (): Promise<KFactorMainRow[]> => {
    try {
      const apiEndpoint = "/api/charts/generate_vis_data"
      const dateFilters: { key: string; cond: string; value: string }[] = []
      if (timeGrain === "weekly" && fromDate && toDate) {
        const fmt = (d: dayjs.Dayjs | null) => (d && (d as any).format ? (d as dayjs.Dayjs).format("YYYY-MM-DD") : "")
        const fromStr = fmt(fromDate)
        const toStr = fmt(toDate)
        if (fromStr && toStr) {
          dateFilters.push({ key: '"DATE"', cond: "equals", value: `${fromStr},${toStr}` })
        }
      }
      const otherFilters = [...(filters || []), ...(crossFilters || []).filter((f) => f.key !== '"DATE"'), ...(localFilters || [])].map((filter) => {
        if (filter.key === "plant") {
          return { key: "sap_id", cond: filter.cond, value: filter.value }
        }
        return filter
      })
      const requestBody = {
        action: "tas_normal_count",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: dateFilters,
        filters: otherFilters,
        limit: 0,
        time_grain: timeGrain === "weekly" ? "week" : "",
        resp_format: "",
        resp_level: "",
      }
      const response = await apiClient.post(apiEndpoint, requestBody)
      const result = response.data
      // K Factor Main lives inside monthly_data / daily_data (e.g. result.monthly_data["K Factor Main"])
      const dataByGrain = timeGrain === "weekly" ? result.daily_data : result.monthly_data
      const raw = dataByGrain?.["K Factor Main"] ?? result["K Factor Main"] ?? result.k_factor_main
      return Array.isArray(raw) ? (raw as KFactorMainRow[]) : []
    } catch (e) {
      console.error("Error fetching K Factor Main:", e)
      return []
    }
  }, [filters, localFilters, crossFilters, timeGrain, fromDate, toDate])

  const processData = (apiResponse: any): { chartData: ChartDataPoint[]; gridData: DetailRow[] } => {
    if (!apiResponse || !apiResponse.data) {
      return { chartData: [], gridData: [] }
    }

    const data = apiResponse.data
    const allBCUs = new Set<string>()
    const monthData = new Map<string, Map<string, number>>()
    const gridData: DetailRow[] = []

    // First pass: collect all BCU numbers and prepare data structure
    Object.keys(data).forEach(month => {
      const monthEntries = data[month]
      
      if (!monthData.has(month)) {
        monthData.set(month, new Map<string, number>())
      }
      
      monthEntries.forEach(entry => {
        // Use empty string for null or empty BCU number
        const bcu_number = entry.bcu_number || "No BCU"
        const total_alerts = entry.total_alerts || 0
        
        // Add BCU to the set (even if it's "No BCU")
        allBCUs.add(bcu_number)
        
        // Store this BCU's alert count for this month
        monthData.get(month)?.set(bcu_number, total_alerts)
        
        // Add to grid data
        gridData.push({
          month,
          zone: entry.zone || "",
          location_name: entry.location_name || "",
          sap_id: entry.sap_id || "",
          bcu_number,
          total_alerts
        })
      })
    })

    // Create array of all unique BCU numbers
    const bcuNumbersArray = Array.from(allBCUs)
    setBcuNumbers(bcuNumbersArray)

    // Create chart data points with a column for each BCU
    const chartData: ChartDataPoint[] = []

    // Sort months chronologically (Jun, Jul, Aug, Sep...) - not alphabetically (Aug, Jul, Jun, Sep)
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

    sortedMonths.forEach(month => {
      const dataPoint: ChartDataPoint = { month }
      
      // Add a property for each BCU with its alert count (or 0 if none)
      bcuNumbersArray.forEach(bcu => {
        dataPoint[bcu] = monthData.get(month)?.get(bcu) || 0
      })
      
      chartData.push(dataPoint)
    })

    // Sort grid data by month to keep dates in order
    const sortedGridData = gridData.sort((a, b) => {
      const monthA = a.month || '';
      const monthB = b.month || '';
      return monthA.localeCompare(monthB);
    });

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
    
    // Set the active filter
    setActiveFilter(timeValue)
    
    const filtered = gridData.filter(item => item.month === timeValue)
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
      // Tab 1: kfactor API for BCU chart
      const apiResponse = await fetchData()
      if (!apiResponse) return

      // Tab 2: same API as TASTrendChart (tas_normal_count) so K Factor Main data is returned
      const kFactorMainFromTas = await fetchKFactorMainData()
      setKFactorMainData(kFactorMainFromTas)
  
      const { chartData, gridData } = processData(apiResponse)
      setGridData(gridData)


if (refreshKey === 0 || bcuNumberOptions.length === 0) {
  const uniqueBcus = Array.from(new Set(gridData.map(item => item.bcu_number))).filter(Boolean);
  setBcuNumberOptions(uniqueBcus);
}
      
      // Reset filtered grid data when chart reloads
      setFilteredGridData([])
      setActiveFilter(null)
  
      // Create chart only when tab 1 is mounted (chart div exists)
      if (!chartDivRef.current) return

      // Dispose of previous chart if it exists
      if (rootRef.current) {
        rootRef.current.dispose()
      }

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
  
      // Find the highest value across all BCUs to set appropriate max value
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
        paddingTop: 10,
        paddingRight: 0,
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
          text: "K-Factor Alerts",
          y: am5.p50,
          centerX: am5.p50,
          fontSize: 10,
          fontWeight: "bold",
          paddingBottom: 0
        })
      );
      
      // Set data for the X axis
      xAxis.data.setAll(chartData)
  
      // Generate a color palette for the BCUs
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
      ]
      
      // Create a series for each BCU
      // Don't filter out empty BCU numbers - use all BCUs including "No BCU"
      const localBcuNumbers = Array.from(new Set(gridData.map(item => item.bcu_number)));
      
      localBcuNumbers.forEach((bcu, index) => {
        const colorIndex = index % colors.length;
        
        // Create a series for this BCU
        const series = chart.series.push( 
          am5xy.LineSeries.new(root, {
            name: bcu,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: bcu,
            categoryXField: "month",
            stroke: am5.color(colors[colorIndex]),
            fill: am5.color(colors[colorIndex]),
            tooltip: am5.Tooltip.new(root, {
              labelText: `[bold fontSize:12px]BCU Number:${bcu},Total Alerts [bold fontSize:12px]{valueY}[/]`,
              maxWidth: 300,
              forceHidden: false,
              paddingBottom: 2,
              paddingTop: 1 ,
              background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0xffffff), // White background
                fillOpacity: 0.7, // 70% opacity (semi-transparent)
                strokeOpacity: 0.5, // Slightly transparent border
              })
                          }),
            minBulletDistance: 10,
          }),
        );

        series.get("tooltip").adapters.add("visible", (visible, target) => {
          return target.dataItem?.dataContext[bcu] > 0;
        });
        
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

        // Add label bullets above data points
        series.bullets.push(function(root) {
          const labelBullet = am5.Bullet.new(root, {
            sprite: am5.Label.new(root, {
              text: "{valueY}",
              fill: am5.color(0x000000),
              centerY: am5.p0,
              centerX: am5.p50,
              populateText: true,
              fontSize: 10,
              fontWeight: "bold",
              dy: -10,
            })
          });

          // labelBullet.get("sprite").adapters.add("visible", (visible, target) => {
          //   const dataItem = target.dataItem;
          //   return dataItem?.dataContext[bcu] > 0;
          // });

          return labelBullet;
        });

        // Always show tooltip even for zero values
        series.get("tooltip").set("forceHidden", false);

        // Set data for the series
        series.data.setAll(chartData);
      });
      
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
      // const legend = chart.children.unshift(
      //   am5.Legend.new(root, {
      //     centerX: am5.p50,
      //     x: am5.p50,
      //     layout: root.horizontalLayout,
      //     marginTop: 0,
      //     marginBottom: 0,
      //   })
      // )
      
      // // Set legend items style
      // legend.labels.template.setAll({
      //   fontSize: 10,
      //   fontWeight: "bold",
      // })
      
      // legend.valueLabels.template.setAll({
      //   fontSize: 12
      // })
      
      // // Set legend data from series
      // legend.data.setAll(chart.series.values)
  
      // Apply chart appearance animation
      chart.appear(1000, 100)
    }
  
    initChart()
  
    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [refreshKey, crossFilters, localFilters, timeGrain, filters, fetchKFactorMainData])

  // Tab 2: BCU K Factor line chart from K Factor Main data
  useEffect(() => {
    if (activeTab !== 1) {
      if (rootRefBcu.current) {
        rootRefBcu.current.dispose()
        rootRefBcu.current = null
      }
      return
    }
    if (!chartDivRefBcu.current) return
    if (rootRefBcu.current) {
      rootRefBcu.current.dispose()
      rootRefBcu.current = null
    }
    if (!kFactorMainData.length) return
    const data = kFactorMainData
    const byMonth = new Map<string, number>()
    data.forEach((r) => {
      const m = r.month ?? ""
      byMonth.set(m, (byMonth.get(m) ?? 0) + (Number(r.count) || 0))
    })
    // Sort months chronologically (Jun, Jul, Aug, Sep...) for BCU K Factor chart x-axis
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
    const chartData = Array.from(byMonth.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => toMonthOrder(a.month || "") - toMonthOrder(b.month || "") || (a.month || "").localeCompare(b.month || ""))

    const root = am5.Root.new(chartDivRefBcu.current)
    rootRefBcu.current = root
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
    const yAxisMax = Math.max(1, Math.ceil(Math.max(...chartData.map((d) => d.count), 0) * 1.3))
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: yAxisMax,
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 30 }),
        numberFormat: "#,###",
        tooltip: am5.Tooltip.new(root, { labelText: "{valueY}" }),
      }),
    )
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10, fontWeight: "bold" })
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "month",
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 30 }),
      }),
    )
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      paddingTop: 10,
      fill: am5.color(0x000000),
      fontWeight: "bold",
    })
    xAxis.data.setAll(chartData)
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "K Factor Main",
        xAxis,
        yAxis,
        valueYField: "count",
        categoryXField: "month",
        stroke: am5.color(0x4682b4),
        fill: am5.color(0x4682b4),
        tooltip: am5.Tooltip.new(root, { labelText: "Count: [bold]{valueY}[/]" }),
        minBulletDistance: 10,
      }),
    )
    series.bullets.push(() =>
      am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 5,
          fill: am5.color(0x4682b4),
          strokeWidth: 2,
        }),
      }),
    )
    series.data.setAll(chartData)
    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX" }))
    chart.set(
      "scrollbarX",
      am5.Scrollbar.new(root, { orientation: "horizontal", paddingTop: 0 }),
    )
    chart.appear(1000, 100)
    return () => {
      root.dispose()
      if (rootRefBcu.current === root) rootRefBcu.current = null
    }
  }, [activeTab, kFactorMainData])

  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded)
  }

  // Clear chart point filter
  const clearChartFilter = () => {
    setActiveFilter(null)
    setFilteredGridData([])
  }

  // Chart title
  const chartTitle = `K-Factor Analysis (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`

  const filterPortalEl = filterPortalId ? document.getElementById(filterPortalId) : null

  const filterControls = (
    <>
      <Select
        onValueChange={handleBcuNumberChange}
        value={selectedBcu || ""}
      >
        <SelectTrigger className="h-7 text-xs w-40">
          <SelectValue placeholder="Select BCU">
            {selectedBcu || "Select BCU"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All BCUs">All BCUs</SelectItem>
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
      "Zone", "Plant", "SAP ID", "BCU Number", "Total Alerts"
    ];
    const rows = data.map(row => [
      row.month ?? "", row.zone ?? "", row.location_name ?? "",
      row.sap_id ?? "", row.bcu_number ?? "", row.total_alerts ?? ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "K-Factor Data");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(wb, `K_Factor_Data_${ts}.xlsx`);
  };

  return (
    <>
    {filterPortalEl && createPortal(filterControls, filterPortalEl)}
    <div className="flex flex-col gap-2 p-1">
      {/* Tabs: same style as TASMaintenanceChart (rounded pills, blue-600 active, gray inactive) */}
      <div className="flex items-center gap-2 flex-wrap w-full border-b border-gray-200 pb-1 mb-1 -mt-2">
        <div className="flex flex-wrap gap-1.5 min-h-0 shrink-0" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 0}
            onClick={() => setActiveTab(0)}
            className={`px-3 py-2 text-xs font-semibold leading-tight transition-all rounded-full min-h-[20px] flex items-center justify-center truncate ${
              activeTab === 0
                ? "bg-blue-600 text-white shadow-sm ring-2 ring-offset-1 ring-blue-400"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            Analog K-Factor Change
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 1}
            onClick={() => setActiveTab(1)}
            className={`px-3 py-2 text-xs font-semibold leading-tight transition-all rounded-full min-h-[20px] flex items-center justify-center truncate ${
              activeTab === 1
                ? "bg-blue-600 text-white shadow-sm ring-2 ring-offset-1 ring-blue-400"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            BCU K Factor Changes
          </button>
        </div>
      </div>

      {activeTab === 0 ? (
    <div className="flex gap-1 p-1">
      <div className={`${isTableExpanded ? "hidden" : "w-1/2"}`}>
        <Card className="transition-all duration-300">
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
  disabled={isDownloading || isLoading || !hasData}
  title="Download Excel"
>
  {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
</Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 relative h-[365px]">
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

            {bcuNumbers.length === 0 && !isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                <p>No data available for the selected time period</p>
              </div>
            )}

            <div
              ref={chartDivRef}
              style={{
                width: "100%",
                height: "350px",
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
                K-Factor Data
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
      ) : (
        <div className="flex flex-col gap-2 p-1">
          <div className="flex gap-1">
            <div className="w-1/2">
              <Card>
                <CardHeader className="pb-0 p-1 pt-1">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-bold text-gray-800">
                        K Factor Main – Trend
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {!filterPortalEl && filterControls}
                        <Button
                          onClick={handleDownloadExcel}
                          className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
                          disabled={isDownloading || isLoading || !kFactorMainData.length}
                          title="Download Excel"
                        >
                          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 relative h-[365px]">
                  {isTransitioning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  )}
                  {!kFactorMainData.length && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                      <p>No K Factor Main data for the selected period</p>
                    </div>
                  )}
                  <div
                    ref={chartDivRefBcu}
                    style={{ width: "100%", height: "350px" }}
                  />
                </CardContent>
              </Card>
            </div>
            <div className="w-1/2">
              <Card>
                <CardHeader className="pb-0 p-2">
                  <CardTitle className="text-xs font-bold text-gray-800">
                    K Factor Main – Table
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-1 pt-0">
                  <div
                    className="ag-theme-alpine"
                    style={{ height: "357px", width: "100%" }}
                  >
                    <AgGridReact
                      columnDefs={columnDefsKFactorMain}
                      rowData={kFactorMainData}
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
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="mt-2">
            <SafetyProcessGantryTable
              query={(() => {
                let q = "bu='TAS' AND alert_section='TAS' AND interlock_name='K Factor Change_BCU'"
                if (timeGrain === "weekly" && fromDate && toDate) {
                  const fromStr = (fromDate as dayjs.Dayjs).format?.("YYYY-MM-DD") ?? ""
                  const toStr = (toDate as dayjs.Dayjs).format?.("YYYY-MM-DD") ?? ""
                  if (fromStr && toStr) q += ` AND created_at::DATE BETWEEN '${fromStr}' AND '${toStr}'`
                }
                // Apply global filters (exclude DATE; map plant -> sap_id)
                const tableFilters = (filters || []).filter((f) => f.key !== '"DATE"')
                for (const f of tableFilters) {
                  const col = f.key === "plant" ? "sap_id" : f.key.replace(/"/g, "")
                  const val = (f.value || "").replace(/'/g, "''")
                  if (col && val) q += ` AND ${col}='${val}'`
                }
                return q
              })()}
              zone={zoneProp != null && zoneProp !== "" ? zoneProp : selectedZone || undefined}
              plant={plantProp != null && plantProp !== "" ? plantProp : selectedPlant || undefined}
            />
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default KFactorTrendChart;