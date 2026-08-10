// This code removes the alert series and its axis, and changes manual fan count axis to yAxisLeft

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
  manualFans: number
  zone?: string
  location_name?: string
}

interface DetailRow {
  month: string
  zone: string
  sap_id: string
  location_name: string
  total_alerts: number
  total_manual_fan_count: number
  manual_fan_percentage?: number
  total_count: number
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface ManualFanPrintedChartProps {
  filters: FilterValue[];
  onDateFilterChange?: (filter: string) => void;
  onChartFilterChange?: (filterDate: string | null) => void;
  filterPortalId?: string;
}

const ManualFanPrintedTrendChart: React.FC<ManualFanPrintedChartProps> = ({ filters, onDateFilterChange, onChartFilterChange, filterPortalId }) => {
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
  const [locations, setLocations] = useState<Set<string>>(new Set())
const [isDownloading, setIsDownloading] = useState(false)
const [hasData, setHasData] = useState(false)
  const gridDataRef = useRef<DetailRow[]>([])

  // Keep ref in sync with gridData so chart click handler always has latest data
  useEffect(() => {
    gridDataRef.current = gridData
  }, [gridData])

  // Notify parent when "Filtered by" date changes so host table can filter by it
  useEffect(() => {
    if (onChartFilterChange) onChartFilterChange(activeFilter)
  }, [activeFilter, onChartFilterChange])

const handleDownloadExcel = async () => {
  
  setIsDownloading(true)
  try {
    // Only include date filters for weekly view
    const effectiveCrossFilters = timeGrain === "weekly" 
      ? crossFilters 
      : crossFilters.filter(filter => filter.key !== '"DATE"')

    // If no date filter and in weekly mode, create a default one for the last 7 days
    if (timeGrain === "weekly" && !effectiveCrossFilters.some((filter) => filter.key === '"DATE"')) {
      const today = dayjs()
      const sevenDaysAgo = today.subtract(6, "day")
   
      effectiveCrossFilters.push({
        key: '"DATE"',
        cond: "equals",
        value: `${sevenDaysAgo.format("YYYY-MM-DD")},${today.format("YYYY-MM-DD")}`,
      })
    }

    const requestBody = {
      filters: filters || [],
      action: "manualfanprinted",
      drill_state: timeGrain === "weekly" ? "date" : "",
      cross_filters: effectiveCrossFilters || [],
      // limit: 0,
      // time_grain: "",
      // resp_format: "",
      // resp_level: ""
    }

    const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody)
    

    if (!response.status) {
      throw new Error(`Download failed: ${response.statusText}`)
    }

    let filePath = response.data?.file_path
    let fileName = `Manual_Fan_Data_${timeGrain}_${dayjs().format("YYYY-MM-DD_HH-mm-ss")}.xlsx`
    
    saveAs(filePath, fileName);
    toast.success("Excel file downloaded successfully");
    
  } catch (error) {
    console.error("Download error:", error)
    setError(error instanceof Error ? error.message : "Download failed")
  } finally {
    setIsDownloading(false)
  }
}



// setGridData(gridData)
// setHasData(gridData.length > 0)


  const columnDefs: ColDef<DetailRow>[] = [
    {
      headerName: timeGrain === "monthly" ? 'Month' : 'Date',
      field: 'month',
      sort: "desc" as SortDirection,
      flex: 1, minWidth: 120 
    },
    { headerName: "Zone", field: "zone", flex: 1, minWidth: 110  },
    { headerName: "Plant", field: "location_name", flex: 1, minWidth: 160  },
    { headerName: "SAP ID", field: "sap_id", flex: 1, minWidth: 100  },
    { 
      headerName: "Total Alerts", 
      field: "total_alerts",
      valueFormatter: (params) => params.value?.toLocaleString() ,
      flex: 1, minWidth: 120  },
     { 
      headerName: "Total Manual Fan Count", 
    },
    { 
      headerName: "Manual Fan Count", 
      field: "total_manual_fan_count",
      valueFormatter: (params) => params.value?.toLocaleString() 
    },
    { 
      headerName: "Total Count", 
      field: "total_count",
      valueFormatter: (params) => params.value?.toLocaleString() 
      , flex: 1, minWidth: 120 
    },
    { 
      headerName: "Manual Fan %", 
      field: "manual_fan_percentage",
      valueFormatter: (params) => (params.value ? `${params.value.toFixed(2)}%` : '0.00%'), flex: 1, minWidth: 160 
    }
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
    const today = dayjs().endOf("day")
    const start = startDate.isAfter(today) ? today : startDate
    const end = endDate.isAfter(today) ? today : endDate

    const formatDate = (date: dayjs.Dayjs) => {
      return date ? date.format("YYYY-MM-DD") : ""
    }

    setFromDate(start)
    setToDate(end)

    // Always notify parent of the current date range selection
    if (onDateFilterChange) {
      const sqlFilter = `created_at::DATE BETWEEN '${formatDate(start)}' AND '${formatDate(end)}'`
      onDateFilterChange(sqlFilter)
    }

    // Add date filter for both weekly and monthly views
      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
      value: `${formatDate(start)},${formatDate(end)}`,
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
    try {
      const apiEndpoint = "/api/charts/generate_vis_data"
      
      // Only include date filters for weekly view
      const effectiveCrossFilters = timeGrain === "weekly" 
        ? crossFilters 
        : crossFilters.filter(filter => filter.key !== '"DATE"')

      // If no date filter and in weekly mode, create a default one for the last 7 days
      if (timeGrain === "weekly" && !effectiveCrossFilters.some((filter) => filter.key === '"DATE"')) {
        const today = dayjs()
        const sevenDaysAgo = today.subtract(6, "day")
     
        effectiveCrossFilters.push({
          key: '"DATE"',
          cond: "equals",
          value: `${sevenDaysAgo.format("YYYY-MM-DD")},${today.format("YYYY-MM-DD")}`,
        })
      }

      const requestBody = {
        filters: filters || [],
        action: "manualfanprinted",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters || [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: ""
      }

      console.log("API Request:", JSON.stringify(requestBody))
      
      const response = await apiClient.post(apiEndpoint, requestBody)
      
      const result = response.data
      
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
  }, [ crossFilters, timeGrain, filters])
  const processData = (apiResponse: any): { chartData: ChartDataPoint[]; gridData: DetailRow[] } => {
    if (!apiResponse || !apiResponse.data) {
      return { chartData: [], gridData: [] }
    }

    const data = apiResponse.data
    const chartData: ChartDataPoint[] = []
    const gridData: DetailRow[] = []
    const locationSet = new Set<string>()

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
    const sortedMonths = Object.keys(data).sort((a, b) => toMonthOrder(a) - toMonthOrder(b) || String(a).localeCompare(String(b)))

    // Process the data for each month in chronological order
    sortedMonths.forEach(month => {
      const monthEntries = data[month]
      
      monthEntries.forEach(entry => {
        const locationName = entry.location_name || ''
        if (locationName) {
          locationSet.add(locationName)
        }
        
        // Calculate manual fan percentage
        const totalAlerts = entry.total_alerts || 0
        const manualFanCount = entry.total_manual_fan_count || 0
        // const manualFanPercentage = totalAlerts > 0 ? (manualFanCount / totalAlerts) * 100 : 0
        
        // Add to grid data
        gridData.push({
          month,
          zone: entry.zone || "",
          sap_id: entry.sap_id || "",
          location_name: locationName,
          total_alerts: totalAlerts,
          total_manual_fan_count: manualFanCount,
          manual_fan_percentage: entry.manual_fan_percentage,
          total_count: entry.total_count,
        })
        
        // Add data for charts
        chartData.push({
          month,
          manualFans: manualFanCount,
          zone: entry.zone || "",
          location_name: locationName
        })
      })
    })

    // Update the list of unique locations
    setLocations(locationSet)
    
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
    // Use ref so chart click handler has latest data (avoids stale closure)
    const source = gridDataRef.current.length > 0 ? gridDataRef.current : gridData
    setActiveFilter(timeValue)
    const filtered = source.filter(item => item.month === timeValue)
    setFilteredGridData(filtered)
  }

  useEffect(() => {
    let root: am5.Root | null = null
  
    const initChart = async () => {
      if (!chartDivRef.current) return
  
      // Dispose of previous chart if it exists
      if (rootRef.current) {
        rootRef.current.dispose()
      }
  
      // Fetch data and process it
      const apiResponse = await fetchData()
      if (!apiResponse) return
  
      const { chartData, gridData } = processData(apiResponse)
      setGridData(gridData)
      
      // Reset filtered grid data when chart reloads
      setFilteredGridData([])
      setActiveFilter(null)
  
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
  
      // Group data by month to combine data for the same month
      const monthlyData: { [key: string]: ChartDataPoint } = {}
      chartData.forEach(dataPoint => {
        const month = dataPoint.month
        if (!monthlyData[month]) {
          monthlyData[month] = {
            month,
            manualFans: 0
          }
        }
        
        monthlyData[month].manualFans += dataPoint.manualFans
      })
      
      // Convert back to array and sort by month chronologically (Jun, Jul, Aug, Sep...)
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
      const aggregatedData = Object.values(monthlyData).sort((a, b) => toMonthOrder(a.month) - toMonthOrder(b.month) || a.month.localeCompare(b.month))
      
      // Find max value for manual fan count
      let maxManualFans = 0
      aggregatedData.forEach(dataPoint => {
        maxManualFans = Math.max(maxManualFans, dataPoint.manualFans)
      })
      
      // Add 30% more to the max value, with a minimum of 10 for manual fans
      const yAxisMax = Math.max(10, Math.ceil(maxManualFans * 1.3))
      
      // Create Y-axis for manual fan count (left)
      const yAxisLeft = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: 0,
          max: yAxisMax,
          renderer: am5xy.AxisRendererY.new(root, {
            minGridDistance: 30,
          }),
          numberFormat: "#,###",
          tooltip: am5.Tooltip.new(root, {
            labelText: "{valueY}"
          })
        }),
      )
      
      yAxisLeft.get("renderer").labels.template.setAll({
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
      yAxisLeft.children.unshift(
        am5.Label.new(root, {
          rotation: -90,
          text: "Manual Fan Count",
          y: am5.p50,
          centerX: am5.p50,
          fontSize: 10,
          fontWeight: "bold",
          paddingBottom: 0
        })
      );
      
      // Set data for the X axis
      xAxis.data.setAll(aggregatedData)
      
      // Create series for Manual Fan Count (line)
      const manualFanSeries = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: "Manual Fan Count",
          xAxis: xAxis,
          yAxis: yAxisLeft,
          valueYField: "manualFans",
          categoryXField: "month",
          stroke: am5.color(0xFF8C00),
          fill: am5.color(0xFF8C00),
          tooltip: am5.Tooltip.new(root, {
            labelText: "Manual Fan Count: {valueY}",
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
        })
      )
      
      // Add circle bullets
      manualFanSeries.bullets.push(function(root) {
        const circle = am5.Circle.new(root, {
          radius: 6,
          fill: am5.color(0xFF8C00),
          stroke: am5.color(0xFFFFFF),
          strokeWidth: 2,
          cursorOverStyle: "pointer",
          interactive: true,
        })
        
        // Add click events to the bullets
        circle.events.on("click", function(ev) {
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
      
      // Add label bullets above data points for the line series
      manualFanSeries.bullets.push(function(root) {
        return am5.Bullet.new(root, {
          sprite: am5.Label.new(root, { 
            text: "{valueY}",
            fill: am5.color(0x000000),
            centerY: am5.p0,
            centerX: am5.p50,
            populateText: true,
            fontSize: 10,
            fontWeight: "bold",
            dy: -29,
          }),
        })
      })
      
      // Set data for the series
      manualFanSeries.data.setAll(aggregatedData)
      
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
    }
  
    initChart()
  
    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [refreshKey, crossFilters, timeGrain, filters, fetchData])

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded)
  }

  // Clear chart point filter
  const clearChartFilter = () => {
    setActiveFilter(null)
    setFilteredGridData([])
  }

  // Chart title
  const chartTitle = `Manual Fan Count Analysis (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`

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

  const handleTableExcelExport = () => {
    const data = filteredGridData.length > 0 ? filteredGridData : gridData;
    if (data.length === 0) return;
    const headers = [
      timeGrain === "monthly" ? "Month" : "Date",
      "Zone", "Plant", "SAP ID", "Total Alerts",
      "Manual Fan Count", "Total Count", "Manual Fan %"
    ];
    const rows = data.map(row => [
      row.month ?? "", row.zone ?? "", row.location_name ?? "",
      row.sap_id ?? "", row.total_alerts ?? "",
      row.total_manual_fan_count ?? "", row.total_count ?? "",
      row.manual_fan_percentage ? `${row.manual_fan_percentage.toFixed(2)}%` : "0.00%"
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manual Fan Printed Data");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(wb, `Manual_Fan_Printed_Data_${ts}.xlsx`);
  };

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
                <CardTitle className="text-xs font-bold text-gray-800">
                  {chartTitle}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!filterPortalEl && filterControls}
<Button
  onClick={handleDownloadExcel}
  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
  disabled={isDownloading || isLoading }
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

            {gridData.length === 0 && !isLoading && !error && (
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
                Manual Fan Printed Data
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
                  {isTableExpanded ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <style>{`
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible,
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                opacity: 1 !important;
                visibility: visible !important;
                min-height: 12px !important;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport,
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container {
                overflow-x: scroll !important;
                min-height: 12px !important;
                -ms-overflow-style: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar {
                display: block !important;
                height: 12px;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-thumb:hover {
                background: #475569;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-center-cols-viewport {
                overflow-x: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar {
                display: block !important;
                height: 12px;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .manual-fan-printed-trend-grid.ag-theme-alpine .ag-center-cols-container {
                min-width: max-content;
              }
            `}</style>
            <div
              className="ag-theme-alpine manual-fan-printed-trend-grid"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
                width: "100%",
              }}
            >
              <AgGridReact
                key={activeFilter ?? 'all'}
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
                alwaysShowHorizontalScroll={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  )
}

export default ManualFanPrintedTrendChart