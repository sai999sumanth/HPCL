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
  totalAlerts?: number
  bcuDetails?: {
    bcu: string
    alerts: number
    overloaded: number
    loaded: number
  }[]
  [key: string]: number | string | {
    bcu: string
    alerts: number
    overloaded: number
    loaded: number
  }[] | undefined // Updated to allow the bcuDetails array type
}

interface DetailRow {
  month: string
  zone: string
  location_name: string
  sap_id: string
  bcu_number: string
  total_alerts: number
  total_required_qty: number
  total_loaded_qty: number
  overloaded_qty: number
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface OverloadedTTSTrendChartProps {
  filters: FilterValue[];
  onDateFilterChange?: (filter: string) => void;
  onBcuFilterChange?: (filter: string) => void;
  onChartFilterChange?: (filterDate: string | null) => void;
  filterPortalId?: string;
}

const OverloadedTTSTrendChart: React.FC<OverloadedTTSTrendChartProps> =   ({ filters, onDateFilterChange, onBcuFilterChange, onChartFilterChange, filterPortalId }) => {
  console.log("Filters from ta to wrapper to overload:", filters)
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
  const [bcuNumbers, setBcuNumbers] = useState<string[]>([])
  const [timeGrain, setTimeGrain] = useState<string>("weekly")


const [bcuNumberOptions, setBcuNumberOptions] = useState<string[]>([]);
const [selectedBcuNumbers, setSelectedBcuNumbers] = useState<string>("");
const [selectedBcu, setSelectedBcu] = useState(undefined);
const [localFilters, setLocalFilters] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false)
const [hasData, setHasData] = useState(false)
  const gridDataRef = useRef<DetailRow[]>([])

const handleDownloadExcel = async () => {
  setIsDownloading(true);
  try {
    const combinedFilters = [...(filters || []), ...(localFilters || [])];
    const hasDateFilter = crossFilters.some((filter) => filter.key === '"DATE"');
    
    const effectiveCrossFilters = [...crossFilters];
    if (!hasDateFilter && timeGrain === "weekly") {
      const today = dayjs();
      const sevenDaysAgo = today.subtract(6, "day");
      effectiveCrossFilters.push({
        key: '"DATE"',
        cond: "equals",
        value: `${sevenDaysAgo.format("YYYY-MM-DD")},${today.format("YYYY-MM-DD")}`,
      });
    }

    const requestBody = {
      filters: combinedFilters || [],
      action: "overloaded_tts",
      drill_state: timeGrain === "weekly" ? "date" : "",
      cross_filters: effectiveCrossFilters || [],
      // limit: 0,
      // time_grain: "",
      // resp_format: "",
      // resp_level: "",
    };

    const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody);
    
    if (response.status) {
      let filePath = response.data?.file_path;
      let fileName = `overloaded_tts_report_${timeGrain}_${dayjs().format("YYYY-MM-DD")}.xlsx`;
      saveAs(filePath, fileName);
      toast.success("Excel file downloaded successfully");
    } else {
      throw new Error("Download failed");
    }
  } catch (error) {
    console.error("Error downloading Excel:", error);
    setError("Failed to download Excel file");
  } finally {
    setIsDownloading(false);
  }
};
  const columnDefs: ColDef<DetailRow>[] = [
    {
      headerName: timeGrain === "monthly" ? 'Month' : 'Date',
      field: 'month',
      sort: "desc" as SortDirection,
      flex: 1,
      minWidth: 110,
    },
    { headerName: "Zone", field: "zone", flex: 1, minWidth: 85 },
    { headerName: "Plant", field: "location_name", flex: 1, minWidth: 100 },
    { headerName: "SAP ID", field: "sap_id", flex: 1, minWidth: 95 },
    { headerName: "BCU Number", field: "bcu_number", flex: 1, minWidth: 115 },
    { headerName: "Total Alerts", field: "total_alerts", flex: 1, minWidth: 115 },
    { headerName: "Required Qty", field: "total_required_qty", flex: 1, minWidth: 120 },
    { headerName: "Loaded Qty", field: "total_loaded_qty", flex: 1, minWidth: 110 },
    { headerName: "Overloaded Qty", field: "overloaded_qty", flex: 1, minWidth: 130 },
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
    setIsTransitioning(true);
    try {
      // API call for Overloaded TTS data
      const apiEndpoint = "/api/charts/generate_vis_data";
  
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
      const requestBody = {
        filters: combinedFilters || [],
        action: "overloaded_tts",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters || [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: "",
      };
  
      console.log("API Request:", JSON.stringify(requestBody));
  
      const response = await apiClient.post(apiEndpoint, requestBody);
  
      const result = response.data;
  
      return {
        data: timeGrain === "monthly" ? result.monthly_data || {} : result.daily_data || {},
      };
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
      return { data: {} };
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  }, [filters, localFilters, crossFilters, timeGrain]); 
  
const processData = (apiResponse: any): { chartData: ChartDataPoint[]; gridData: DetailRow[] } => {
  if (!apiResponse || !apiResponse.data) {
    return { chartData: [], gridData: [] }
  }
  const data = apiResponse.data
  const allBCUs = new Set<string>()
  const monthData = new Map<string, { 
    totalAlerts: number, 
    bcuDetails: Map<string, { alerts: number, overloaded: number, loaded: number }> 
  }>()
  const gridData: DetailRow[] = []

  // First pass: collect all BCU numbers and prepare data structure
  Object.keys(data).forEach(month => {
    const monthEntries = data[month]
    
    if (!monthData.has(month)) {
      monthData.set(month, { 
        totalAlerts: 0, 
        bcuDetails: new Map<string, { alerts: number, overloaded: number, loaded: number }>() 
      })
    }
    
    monthEntries.forEach(entry => {
      // Handle null or empty BCU numbers
      const bcu_number = entry.bcu_number || "Unknown BCU"
      const total_alerts = entry.total_alerts || 0
      const total_required_qty = entry.total_required_qty || 0
      const total_loaded_qty = entry.total_loaded_qty || 0
      const overloaded_qty = entry.total_quantity_difference || 0
      
      // Add BCU to the set
      allBCUs.add(bcu_number)
      
      // Add to total alerts for this month
      const monthEntry = monthData.get(month)
      if (monthEntry) {
        monthEntry.totalAlerts += total_alerts
        monthEntry.bcuDetails.set(bcu_number, { 
          alerts: total_alerts,
          overloaded: overloaded_qty,
          loaded: total_loaded_qty
        })
      }
      
      // Add to grid data
      gridData.push({
        month,
        zone: entry.zone || "",
        location_name: entry.location_name || "",
        sap_id: entry.sap_id || "",
        bcu_number,
        total_alerts,
        total_required_qty,
        total_loaded_qty,
        overloaded_qty
      })
    })
  })

  // Create array of all unique BCU numbers
  const bcuNumbersArray = Array.from(allBCUs)
  setBcuNumbers(bcuNumbersArray)

  // Create chart data points with summed total alerts
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
    const monthEntry = monthData.get(month)
    if (monthEntry) {
      const dataPoint: ChartDataPoint = { 
        month,
        totalAlerts: monthEntry.totalAlerts,
        bcuDetails: Array.from(monthEntry.bcuDetails.entries()).map(([bcu, details]) => ({
          bcu,
          alerts: details.alerts,
          overloaded: details.overloaded,
          loaded: details.loaded
        }))
      }
      
      chartData.push(dataPoint)
    }
  })

  // Sort grid data by month chronologically (Jun, Jul, Aug, Sep...)
  const sortedGridData = gridData.sort((a, b) => {
    const orderA = toMonthOrder(a.month || '')
    const orderB = toMonthOrder(b.month || '')
    return orderA - orderB || (a.month || '').localeCompare(b.month || '')
  })

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

      // Create the BCU query string with the CURRENT selected value
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
      gridDataRef.current = gridData
setHasData(gridData.length > 0)


      // Dropdown: only BCU numbers that come from the API response (bcu_number)
      const uniqueBcus = Array.from(new Set(gridData.map(item => item.bcu_number))).filter(Boolean);
      console.log('[OverloadedTTSTrendChart] BCU number count in dropdown:', uniqueBcus.length, 'BCUs:', uniqueBcus);
      setBcuNumberOptions(uniqueBcus);
      
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
  
      // Find the highest value across all BCUs to set appropriate max value
      let maxValue = 0
      chartData.forEach(dataPoint => {
        Object.keys(dataPoint).forEach(key => {
          if (key !== 'month' && !key.includes('_overloaded') && !key.includes('_loaded')) {
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
        inside: false,
        rotation: -90,
        dx: -8,
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

      yAxis.children.unshift(
        am5.Label.new(root, {
          rotation: -90,
          text: "Total Alerts",
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
      const localBcuNumbers = Array.from(new Set(gridData.map(item => item.bcu_number)));

      // First, prepare the chart data to include quantities for tooltips
      chartData.forEach(dataPoint => {
        const month = dataPoint.month;
        // For each BCU, add corresponding fields if not already present
        localBcuNumbers.forEach(bcu => {
          const matchingEntries = gridData.filter(item => 
            item.month === month && item.bcu_number === bcu
          );
          if (matchingEntries.length > 0) {
            dataPoint[`${bcu}_loaded_qty`] = matchingEntries[0].total_loaded_qty;
            dataPoint[`${bcu}_required_qty`] = matchingEntries[0].total_required_qty;
            dataPoint[`${bcu}_overloaded_qty`] = matchingEntries[0].overloaded_qty;
          } else {
            dataPoint[`${bcu}_loaded_qty`] = 0;
            dataPoint[`${bcu}_required_qty`] = 0;
            dataPoint[`${bcu}_overloaded_qty`] = 0;
          }
        });
      });

      // Now create series for each BCU with the quantities in tooltip
      localBcuNumbers.forEach((bcu, index) => {
        const colorIndex = index % colors.length;
        
        // Create a series for this BCU
        // const series = chart.series.push(
        //   am5xy.LineSeries.new(root, {
        //     name: bcu,
        //     xAxis: xAxis,
        //     yAxis: yAxis,
        //     valueYField: bcu,
        //     categoryXField: "month",
        //     stroke: am5.color(colors[colorIndex]),
        //     fill: am5.color(colors[colorIndex]),
        //     tooltip: am5.Tooltip.new(root, {
              // labelText: `[bold fontSize:12px]BCU Number:${bcu},Total Alerts: [bold fontSize:12px]{valueY}[/], [bold fontSize:12px]Overloaded Qty: [bold fontSize:12px]{${bcu}_overloaded_qty}[/]`,
        //       maxWidth: 400,
        //       forceHidden: false,
        //       paddingBottom: 2,
        //       paddingTop: 1 ,
        //       background: am5.RoundedRectangle.new(root, {
        //         fill: am5.color(0xffffff), // White background
        //         fillOpacity: 0.7, // 70% opacity (semi-transparent)
        //         strokeOpacity: 0.5, // Slightly transparent border
        //       })
              
        //     }),
        //     minBulletDistance: 10,
        //   }),
        // );
        
        // // Apply adapter to the tooltip to hide it when value is 0 or not present
        // series.get("tooltip").adapters.add("visible", (visible, target) => {
        //   return target.dataItem?.dataContext[bcu] > 0;
        // });
        
        // // Add circle bullets with click events
        // series.bullets.push((root) => {
        //   const circle = am5.Circle.new(root, {
        //     radius: 5,
        //     fill: am5.color(colors[colorIndex]),
        //     strokeWidth: 2,
        //     cursorOverStyle: "pointer",
        //     interactive: true,
        //   });
          
        //   // Add click events to the bullets
        //   circle.events.on("click", function(ev) {
        //     const dataItem = ev.target.dataItem;
        //     if (dataItem) {
        //       const category = dataItem.dataContext["month"];
        //       if (category) {
        //         filterGridDataByPoint(category.toString());
        //       }
        //     }
        //   });
          
        //   return am5.Bullet.new(root, {
        //     sprite: circle
        //   });
        // });

        // // Add label bullets above data points
        // series.bullets.push(function(root) {
        //   const labelBullet = am5.Bullet.new(root, {
        //     sprite: am5.Label.new(root, {
        //       text: "{valueY}",
        //       fill: am5.color(0x000000),
        //       centerY: am5.p0,
        //       centerX: am5.p50,
        //       populateText: true,
        //       fontSize: 10,
        //       fontWeight: "bold",
        //       dy: -25,
        //     })
        //   });
          
        //   // Hide label if value is 0 or not present
        //   labelBullet.get("sprite").adapters.add("visible", (visible, target) => {
        //     const dataItem = target.dataItem;
        //     return dataItem?.dataContext[bcu] > 0;
        //   });
          
        //   return labelBullet;
        // });

        // // Set data for the series
        // series.data.setAll(chartData);
      });
chart.series.clear()

// Create a single series for the summed total alerts
const series = chart.series.push(
  am5xy.LineSeries.new(root, {
    name: "Total Alerts",
    xAxis: xAxis,
    yAxis: yAxis,
    valueYField: "totalAlerts",
    categoryXField: "month",
    stroke: am5.color("#2563eb"), // Blue color
    fill: am5.color("#2563eb"),
    tooltip: am5.Tooltip.new(root, {
      labelText: `[bold fontSize:12px]{categoryX}[/]
[bold fontSize:12px]Total Alerts: {valueY}[/]
{bcuDetailsTooltip}`,
      maxWidth: 400,
      forceHidden: false,
      paddingBottom: 2,
      paddingTop: 1,
      background: am5.RoundedRectangle.new(root, {
        fill: am5.color(0xffffff),
        // fillOmiacity: 0.9,
        strokeOpacity: 0.5,
      })
    }),
    minBulletDistance: 10,
  })
)

// Add adapter to format the tooltip with BCU details
series.get("tooltip")!.adapters.add("labelText", function(text, target) {
  const dataItem = target.dataItem;
  if (dataItem && dataItem.dataContext) {
    const dataContext = dataItem.dataContext as ChartDataPoint;
    
    let tooltipText = `[bold fontSize:12px]Total Alerts: ${dataContext.totalAlerts}[/]`;
    
    if (dataContext.bcuDetails && dataContext.bcuDetails.length > 0) {
      dataContext.bcuDetails.forEach((detail) => {
        if (detail.alerts > 0) {
          tooltipText += `\n[bold]${detail.bcu}:[/] ${detail.alerts} alerts`;
          if (detail.overloaded > 0) {
            tooltipText += ` (Overloaded: ${detail.overloaded})`;
          }
        }
      });
    }
    
    return tooltipText;
  }
  return text;
});

// Add circle bullets with click events
series.bullets.push((root) => {
  const circle = am5.Circle.new(root, {
    radius: 6,
    fill: am5.color("#2563eb"),
    strokeWidth: 2,
    stroke: am5.color("#ffffff"),
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
    sprite: circle
  })
})
// Add label bullets above data points showing the total
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
      dy: -25,
    })
  })
  
  return labelBullet
})

// Set data for the series
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
  }, [refreshKey, crossFilters, timeGrain,filters])

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

  // Notify parent when chart filter (filtered by date/month) changes so host table can filter query
  useEffect(() => {
    onChartFilterChange?.(activeFilter)
  }, [activeFilter, onChartFilterChange])

  // Chart title
  const chartTitle = `Overloaded TTS Analysis (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`

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
      "Zone", "Plant", "SAP ID", "BCU Number",
      "Total Alerts", "Required Qty", "Loaded Qty", "Overloaded Qty"
    ];
    const rows = data.map(row => [
      row.month ?? "", row.zone ?? "", row.location_name ?? "",
      row.sap_id ?? "", row.bcu_number ?? "",
      row.total_alerts ?? "", row.total_required_qty ?? "",
      row.total_loaded_qty ?? "", row.overloaded_qty ?? ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Overloaded TTS Data");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(wb, `Overloaded_TTS_Data_${ts}.xlsx`);
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

            {bcuNumbers.length === 0 && !isLoading && !error && (
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
                Overloaded TTS Data
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
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible,
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                opacity: 1 !important;
                visibility: visible !important;
                min-height: 12px !important;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport,
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container {
                overflow-x: scroll !important;
                min-height: 12px !important;
                -ms-overflow-style: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar {
                display: block !important;
                height: 12px;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-container::-webkit-scrollbar-thumb:hover {
                background: #475569;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-center-cols-viewport {
                overflow-x: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar {
                display: block !important;
                height: 12px;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .overloaded-tts-trend-grid.ag-theme-alpine .ag-center-cols-container {
                min-width: max-content;
              }
            `}</style>
            <div
              className="ag-theme-alpine overloaded-tts-trend-grid"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
                width: "100%",
                minHeight: 0,
              }}
            >
              <AgGridReact
                key={activeFilter ?? 'all'}
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

export default OverloadedTTSTrendChart