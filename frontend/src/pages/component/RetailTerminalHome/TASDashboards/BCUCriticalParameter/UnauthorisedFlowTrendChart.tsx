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
import { toast } from "sonner"

interface ChartDataPoint {
  month: string
  TOTAL_LOG_COUNT?: number 
  [key: string]: number | string | undefined 
}

interface DetailRow {
  month: string
  zone: string
  location_name: string
  sap_id: string
  bcu_number: string
  log_count: number
  total_net_totalizer: number
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface UnauthorisedFlowChartProps {
  filters: FilterValue[];
  onDateFilterChange?: (filter: string) => void;
  onBcuFilterChange?: (filter: string) => void;
  onChartFilterChange?: (filterDate: string | null) => void;
  filterPortalId?: string;
}
  const handleDownloadExcel = () => {

  };
const UnauthorisedFlowTrendChart: React.FC<UnauthorisedFlowChartProps> = ({ filters, onDateFilterChange, onBcuFilterChange, onChartFilterChange, filterPortalId }) => {
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
  const [bcuNumbers, setBcuNumbers] = useState<string[]>([])
  const [timeGrain, setTimeGrain] = useState<string>("weekly")
  const gridDataRef = useRef<DetailRow[]>([])

  const [bcuNumberOptions, setBcuNumberOptions] = useState<string[]>([]);
  const [selectedBcuNumbers, setSelectedBcuNumbers] = useState<string>("");
  const [selectedBcu, setSelectedBcu] = useState(undefined);
  const [localFilters, setLocalFilters] = useState([]);

// Replace the existing handleDownloadExcel function with this implementation
const handleDownloadExcel = async () => {
  try {
    setIsLoading(true);
    
    // Prepare the same request body that's used for fetching chart data
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

    // Create the request body for the download API
    const requestBody = {
      filters: combinedFilters || [],
      action: "unauthorised_flow",
      drill_state: timeGrain === "weekly" ? "date" : "",
      cross_filters: effectiveCrossFilters || [],
      // limit: 0,
      // time_grain: timeGrain,
      // resp_format: "excel", 
      // resp_level: "detailed" 
    };

    console.log("Download API Request:", JSON.stringify(requestBody));

    // Call the download API
    const response = await apiClient.post('/api/tasassetmaster/download_tas_report', requestBody);
    
    if (!response.status) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let file_path = response.data?.file_path;
    let file_name = file_path.split("/").pop();

    saveAs(file_path, file_name);
    toast.success("Excel file downloaded successfully");
  } catch (error) {
    console.error('Error downloading Excel file:', error);
    setError(error instanceof Error ? error.message : 'Failed to download Excel file');
    
    // Optional: Show a user-friendly error message
    // You might want to add a toast notification here instead
    alert(`Failed to download Excel file: ${error.message}`);
    
  } finally {
    setIsLoading(false);
  }
};
  const columnDefs: ColDef<DetailRow>[] = [
    {
      headerName: timeGrain === "monthly" ? "Month" : "Date",
      field: "month",
      sort: "desc" as SortDirection,
      flex: 1,
      minWidth: 100,
    },
    { headerName: "Zone", field: "zone", flex: 1, minWidth: 80 },
    { headerName: "Plant", field: "location_name", flex: 1, minWidth: 100 },
    { headerName: "SAP ID", field: "sap_id", flex: 1, minWidth: 80 },
    { headerName: "BCU Number", field: "bcu_number", flex: 1, minWidth: 90 },
    { headerName: "Total count of logs", field: "log_count", flex: 1, minWidth: 100 },
    {
      headerName: "Total Net Totalizer",
      field: "total_net_totalizer",
      flex: 1,
      minWidth: 100,
      valueFormatter: (params) => {
        if (params.value !== null && params.value !== undefined) {
          return Number(params.value).toFixed(2);
        }
        return params.value;
      }
    },
  ];

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
    try {
      // API call for unauthorized flow data
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
        action: "unauthorised_flow",
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

const processData = (apiResponse: any): { chartData: ChartDataPoint[]; gridData: DetailRow[] } => {
  if (!apiResponse || !apiResponse.data) {
    return { chartData: [], gridData: [] }
  }

  const data = apiResponse.data
  const allBCUs = new Set<string>()
  const monthData = new Map<string, Map<string, number>>()
  const monthTotals = new Map<string, number>() // New: Track total for each month
  const gridData: DetailRow[] = []

  // First pass: collect all BCU numbers and prepare data structure
  Object.keys(data).forEach(month => {
    const monthEntries = data[month]
    let monthTotal = 0 // Initialize month total

    if (!monthData.has(month)) {
      monthData.set(month, new Map<string, number>())
    }

    monthEntries.forEach(entry => {
      const { bcu_number, log_count, total_net_totalizer } = entry
      if (bcu_number) {
        allBCUs.add(bcu_number)

        // Store this BCU's log count for this month
        monthData.get(month)?.set(bcu_number, log_count)
        
        // Add to month total
        monthTotal += log_count || 0

        // Add to grid data
        gridData.push({
          month,
          zone: entry.zone || "",
          location_name: entry.location_name || "",
          sap_id: entry.sap_id || "",
          bcu_number,
          log_count,
          total_net_totalizer: entry.total_net_totalizer || 0
        })
      }
    })

    // Store the total for this month
    monthTotals.set(month, monthTotal)
  })

  // Create array of all unique BCU numbers
  const bcuNumbersArray = Array.from(allBCUs)
  setBcuNumbers(bcuNumbersArray)

  // Create chart data points with a column for each BCU AND total
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

    // Add a property for each BCU with its log count (or 0 if none)
    bcuNumbersArray.forEach(bcu => {
      dataPoint[bcu] = monthData.get(month)?.get(bcu) || 0
    })

    // Add total log count for this month
    dataPoint['TOTAL_LOG_COUNT'] = monthTotals.get(month) || 0

    chartData.push(dataPoint)
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

      setLocalFilters((prev) => {
        const filtersWithoutBcu = prev.filter((f) => f.key !== "bcu_number")
        return [...filtersWithoutBcu, bcuFilter]
      })
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

      // Dropdown: only BCU numbers that come from the API response (bcu_number)
      const uniqueBcus = Array.from(new Set(gridData.map(item => item.bcu_number))).filter(Boolean);
      console.log('[UnauthorisedFlowTrendChart] BCU number count in dropdown:', uniqueBcus.length, 'BCUs:', uniqueBcus);
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
        // paddingTop: 10,
        // paddingRight: 0,
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
          text: "Unauthorised Flow Alerts",
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

      // First, let's prepare the chart data to include net totalizer values
      chartData.forEach(dataPoint => {
        const month = dataPoint.month;
        // For each BCU, add a corresponding net_totalizer field
        localBcuNumbers.forEach(bcu => {
          const matchingEntries = gridData.filter(item =>
            item.month === month && item.bcu_number === bcu
          );
          if (matchingEntries.length > 0) {
            // Add the total_net_totalizer to the chart data point with a special field name
            dataPoint[`${bcu}_net_totalizer`] = matchingEntries[0].total_net_totalizer;
          } else {
            dataPoint[`${bcu}_net_totalizer`] = 0;
          }
        });
      });

      // Now create series for each BCU with the net totalizer in tooltip
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
              // labelText: `[bold fontSize:12px]${bcu},[bold fontSize:12px]Net Totalizer:[bold fontSize:12px]{${bcu}_net_totalizer}[/],[bold fontSize:12px]Log Count:[bold fontSize:12px]{valueY}[/]`,
        //       maxWidth: 400,
        //       forceHidden: false,
        //       paddingBottom: 2,
        //       paddingTop: 1,
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
        //   circle.events.on("click", function (ev) {
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
        // series.bullets.push(function (root) {
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
        //   labelBullet.get("sprite").adapters.add("visible", (visible, target) => {
        //     const dataItem = target.dataItem;
        //     return dataItem?.dataContext[bcu] > 0;
        //   });
        //   return labelBullet;
        // });

        // // Always show tooltip even for zero values
        // // series.get("tooltip").set("forceHidden", false);

        // // Set data for the series
        // series.data.setAll(chartData);
      });


const totalSeries = chart.series.push(
  am5xy.LineSeries.new(root, {
    name: "Total Log Count",
    xAxis: xAxis,
    yAxis: yAxis,
    valueYField: "TOTAL_LOG_COUNT",
    categoryXField: "month",
    stroke: am5.color("#4682B4"), // Steel blue color
    fill: am5.color("#4682B4"),
    tooltip: am5.Tooltip.new(root, {
      labelText: "", // We'll set this dynamically
      maxWidth: 400,
      forceHidden: false,
      paddingBottom: 4,
      paddingTop: 4,
      background: am5.RoundedRectangle.new(root, {
        fill: am5.color(0xffffff),
        fillOpacity: 0.9,
        strokeOpacity: 0.5,
      })
    }),
    minBulletDistance: 10,
  }),
);

totalSeries.get("tooltip").adapters.add("labelText", (text, target) => {
  const dataItem = target.dataItem;
  if (!dataItem || !dataItem.dataContext) return text;
  
  const dataContext = dataItem.dataContext as ChartDataPoint;
  const month = dataContext.month;
  const totalLogCount = dataContext.TOTAL_LOG_COUNT;
  
  // Get all BCUs that have data for this specific month
  const bcusForThisMonth = gridData
    .filter(item => item.month === month && item.log_count > 0)
    .map(item => ({
      bcu: item.bcu_number,
      logCount: item.log_count,
      netTotalizer: item.total_net_totalizer
    }));
  
  // Create tooltip content
  let tooltipContent = `[bold fontSize:12px]Total Log Count:[/] [bold fontSize:12px]${totalLogCount}[/]\n`;
  
  if (bcusForThisMonth.length > 0) {
    bcusForThisMonth.forEach((bcuData, index) => {
      tooltipContent += `[fontSize:11px]• BCU ${bcuData.bcu}:[/]`;
      tooltipContent += `[fontSize:10px]  Log Count: ${bcuData.logCount}[/]`;
      tooltipContent += `[fontSize:10px]  Net Totalizer: ${bcuData.netTotalizer ? Number(bcuData.netTotalizer).toFixed(2) : '0.00'}[/]`;
      if (index < bcusForThisMonth.length - 1) {
        tooltipContent += `\n`;
      }
    });
  } else {
    tooltipContent += `[fontSize:11px]No BCU data available for this ${timeGrain === "monthly" ? "month" : "date"}[/]`;
  }
  
  return tooltipContent;
});

// Add circle bullets for total series
totalSeries.bullets.push((root) => {
  const circle = am5.Circle.new(root, {
    radius: 5,
    fill: am5.color("#4682B4"),
    stroke: am5.color("#FFFFFF"),
    strokeWidth: 2,
    cursorOverStyle: "pointer",
    interactive: true,
  });

  // Add click events to the bullets
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

// Add label bullets for total series
totalSeries.bullets.push(function (root) {
  const labelBullet = am5.Bullet.new(root, {
    sprite: am5.Label.new(root, {
      text: "{valueY}",
      fill: am5.color("#000000"),
      centerY: am5.p0,
      centerX: am5.p50,
      populateText: true,
      fontSize: 10,
      fontWeight: "bold",
      dy: -25,
    })
  });
  
  return labelBullet;
});

// Set data for the total series
totalSeries.data.setAll(chartData);

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

      // // Add legend
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
  }, [refreshKey, crossFilters, timeGrain, filters])

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
    if (onChartFilterChange) {
      onChartFilterChange(activeFilter)
    }
  }, [activeFilter, onChartFilterChange])

  // Chart title
  const chartTitle = `Unauthorised Flow Analysis (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`

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
      "Total count of logs", "Total Net Totalizer"
    ];
    const rows = data.map(row => [
      row.month ?? "", row.zone ?? "", row.location_name ?? "",
      row.sap_id ?? "", row.bcu_number ?? "",
      row.log_count ?? "", row.total_net_totalizer ?? ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unauthorised Flow Data");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(wb, `Unauthorised_Flow_Data_${ts}.xlsx`);
  };

  return (
    <>
    {filterPortalEl && createPortal(filterControls, filterPortalEl)}
    <div className="flex gap-1 p-1">
      <div className={`${isTableExpanded ? "hidden" : "w-1/2"}`}>
        {isExpanded && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={toggleExpand}
          />
        )}
        <Card
          className={`transition-all duration-300 ${isExpanded
              ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl"
              : ""
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
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={toggleTableExpand}
          />
        )}
        <Card
          className={`transition-all duration-300 ${isTableExpanded
              ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl"
              : ""
            }`}
        >
          <CardHeader className="pb-0 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                Unauthorised Flow Data
                {activeFilter &&
                  ` - ${timeGrain === "monthly" ? "Month" : "Date"
                  }: ${activeFilter}`}
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
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible,
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                opacity: 1 !important;
                visibility: visible !important;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport {
                overflow-x: scroll !important;
                min-height: 10px !important;
                -ms-overflow-style: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
                display: block !important;
                height: 10px;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover {
                background: #475569;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-center-cols-viewport {
                overflow-x: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #64748b #e2e8f0;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar {
                display: block !important;
                height: 10px;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 4px;
              }
              .unauthorised-flow-trend-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-thumb {
                background: #64748b;
                border-radius: 4px;
              }
            `}</style>
            <div
              className="ag-theme-alpine unauthorised-flow-trend-grid"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
                width: "100%",
                minHeight: 0,
              }}
            >
              <AgGridReact
                columnDefs={columnDefs}
                rowData={
                  filteredGridData.length > 0 ? filteredGridData : gridData
                }
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
}

export default UnauthorisedFlowTrendChart