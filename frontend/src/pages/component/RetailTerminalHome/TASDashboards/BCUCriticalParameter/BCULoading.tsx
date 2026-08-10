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
import { Loader2, RotateCcw, Maximize2, Minimize2, Download } from "lucide-react"
import { DateRangePickerFilter } from "../DateRangePickerFilter"
import { apiClient } from "@/services/apiClient"
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface ChartDataPoint {
  month: string
  [key: string]: number | string // Dynamic properties for each BCU number
}

interface DetailRow {
  month: string
  zone: string
  location_name: string
  sap_id: string
  bcu_number: string
  total_alerts: number
  total_loaded_qty: number
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface BCUAlertChartProps {
  filters: FilterValue[]
  onDateFilterChange?: (filter: string) => void
  onBcuFilterChange?: (filter: string) => void
  onChartFilterChange?: (filterDate: string | null) => void
  filterPortalId?: string
}

const BCUAlertTrendChart: React.FC<BCUAlertChartProps> = ({ filters, onDateFilterChange, onBcuFilterChange, onChartFilterChange, filterPortalId }) => {
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
  const gridDataRef = useRef<DetailRow[]>([])
  const gridApiRef = useRef<any>(null)
  useEffect(() => { gridDataRef.current = gridData }, [gridData])
  useEffect(() => {
    const id = 'bcu-loading-grid-horizontal-scrollbar-styles'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.textContent = `
      .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll.ag-scrollbar-invisible,
      .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
        opacity: 1 !important;
        visibility: visible !important;
        position: relative !important;
        bottom: auto !important;
      }
      .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport,
      .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer,
      .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer {
        scrollbar-width: thin !important;
        -ms-overflow-style: auto !important;
        min-height: 12px;
      }
      .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
      .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar,
      .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar {
        height: 10px !important;
        display: block !important;
      }
      .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
      .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar-track,
      .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar-track {
        background: #e5e7eb;
        border-radius: 4px;
      }
      .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
      .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar-thumb,
      .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar-thumb {
        background: #6b7280;
        border-radius: 4px;
      }
    `
    document.head.appendChild(el)
    return () => { document.getElementById(id)?.remove() }
  }, [])
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
  const [bcuNumberOptions, setBcuNumberOptions] = useState<string[]>([])
  const [selectedBcuNumbers, setSelectedBcuNumbers] = useState<string>("")
  const [selectedBcu, setSelectedBcu] = useState(undefined)
  const [localFilters, setLocalFilters] = useState([])

  // Notify parent when "Filtered by" date/month changes so host table can filter by it
  useEffect(() => {
    if (onChartFilterChange) onChartFilterChange(activeFilter)
  }, [activeFilter, onChartFilterChange])

  const handleDownloadExcel = async () => {
    try {
      setIsLoading(true);

      const combinedFilters = [...(filters || []), ...(localFilters || [])];
      const hasDateFilter = crossFilters.some(filter => filter.key === '"DATE"');
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
        filters: combinedFilters,
        action: "local_loaded",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters,
      };

      const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody);

      const { status, file_path } = response.data;

      if (!status || !file_path) {
        throw new Error("Download failed: No file path returned");
      }

      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const timePeriod = timeGrain === "monthly" ? "Monthly" : "Weekly"
      let fileName = `BCU_Loading_${timePeriod}_${timestamp}.xlsx`

      saveAs(file_path, fileName);
    } catch (error) {
      console.error("Error downloading Excel file:", error);
      setError(error instanceof Error ? error.message : "Failed to download Excel file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableExcelExport = () => {
    const data = filteredGridData.length > 0 ? filteredGridData : gridData;
    if (data.length === 0) return;
    const headers = [
      timeGrain === "monthly" ? "Month" : "Date",
      "Zone", "Plant", "SAP ID", "BCU Number",
      "Total count of alerts", "Sum of Loaded Qty"
    ];
    const rows = data.map(row => [
      row.month ?? "", row.zone ?? "", row.location_name ?? "",
      row.sap_id ?? "", row.bcu_number ?? "",
      row.total_alerts ?? "", row.total_loaded_qty ?? ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BCU Alert Data");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    XLSX.writeFile(wb, `BCU_Alert_Data_${ts}.xlsx`);
  };

  const columnDefs: ColDef<DetailRow>[] = [
    {
      headerName: timeGrain === "monthly" ? "Month" : "Date",
      field: "month",
      sort: "desc" as SortDirection,
      width: 110,
      minWidth: 120,
    },
    { headerName: "Zone", field: "zone", width: 90, minWidth: 90 },
    { headerName: "Plant", field: "location_name", width: 100, minWidth: 100 },
    { headerName: "SAP ID", field: "sap_id", width: 100, minWidth: 80 },
    { headerName: "BCU Number", field: "bcu_number", width: 120, minWidth: 100 },
    { headerName: "Total count of alerts", field: "total_alerts", width: 155, minWidth: 140 },
    { headerName: "Sum of Loaded Qty", field: "total_loaded_qty", width: 145, minWidth: 130 },
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

  // Modify the handleTimeGrainChange function to not apply date filters for monthly view
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
      // API call for BCU alert data
      const apiEndpoint = "/api/charts/generate_vis_data"
      const combinedFilters = [...(filters || []), ...(localFilters || [])]

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

      // Fix: Use correct request body structure based on time grain
      const requestBody = {
        filters: combinedFilters || [], // Use the appropriate filters source
        action: "local_loaded",
        drill_state: timeGrain === "weekly" ? "date" : "",
        cross_filters: effectiveCrossFilters || [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: "",
      }

      console.log("API Request:", JSON.stringify(requestBody))

      const response = await apiClient.post(apiEndpoint, requestBody)

      const result = response.data

      // Fix: Correctly handle weekly data from daily_data field
      return {
        data: timeGrain === "monthly" ? result.monthly_data || {} : result.daily_data || {},
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
    const dateData = new Map<string, { total_alerts: number; total_loaded_qty: number; bcu_numbers: Set<string> }>()
    const gridData: DetailRow[] = []

    // First pass: collect all BCU numbers and prepare data structure
    Object.keys(data).forEach((date) => {
      const dateEntries = data[date]

      if (!dateData.has(date)) {
        dateData.set(date, { total_alerts: 0, total_loaded_qty: 0, bcu_numbers: new Set<string>() });
      }

      dateEntries.forEach((entry) => {
        const { bcu_number, total_alerts, total_loaded_qty } = entry;
        if (bcu_number) {
          allBCUs.add(bcu_number);

          // Aggregate alerts and loaded quantities
          const currentData = dateData.get(date);
          currentData.total_alerts += total_alerts;
          currentData.total_loaded_qty += total_loaded_qty;
          currentData.bcu_numbers.add(bcu_number);

          // Add to grid data
          gridData.push({
            month: date,
            zone: entry.zone || "",
            location_name: entry.location_name || "",
            sap_id: entry.sap_id || "",
            bcu_number,
            total_alerts,
            total_loaded_qty: total_loaded_qty || 0,
          });
        }
      });
    });

    // Create chart data from aggregated data
    const chartData: ChartDataPoint[] = [];
    const sortedDates = Array.from(dateData.keys()).sort((a, b) => {
      try {
        return new Date(a).getTime() - new Date(b).getTime();
      } catch {
        return a.localeCompare(b);
      }
    });
    
    sortedDates.forEach((date) => {
      const value = dateData.get(date)!;
      const dataPoint: ChartDataPoint = { month: date, total_alerts: value.total_alerts };

      // Add a property for each BCU with its alert count (or 0 if none)
      allBCUs.forEach((bcu) => {
        dataPoint[bcu] = value.bcu_numbers.has(bcu) ? value.total_alerts : 0; // Show total alerts for the date
      });

      chartData.push(dataPoint);
    });

    // Create array of all unique BCU numbers
    const bcuNumbersArray = Array.from(allBCUs);
    setBcuNumbers(bcuNumbersArray);

    // Sort grid data by date to keep dates in order
    const sortedGridData = gridData.sort((a, b) => {
      const dateA = a.month || '';
      const dateB = b.month || '';
      try {
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      } catch {
        return dateA.localeCompare(dateB);
      }
    });

    return { chartData, gridData: sortedGridData };
  }

  // Function to filter grid data based on selected data point
  const filterGridDataByPoint = (timeValue: string) => {
    const dataToFilter = gridDataRef.current

    const normalizeForCompare = (val: string) => {
      if (!val) return ""
      if (timeGrain === "weekly") {
        const d = dayjs(val)
        return d.isValid() ? d.format("YYYY-MM-DD") : String(val).trim()
      }
      return String(val).trim()
    }
    const normalizedValue = normalizeForCompare(timeValue)

    if (activeFilter === normalizedValue) {
      setActiveFilter(null)
      setFilteredGridData([])
      gridApiRef.current?.setFilterModel(null)
      if (onDateFilterChange) {
        if (timeGrain === "weekly" && fromDate && toDate) {
          const fmt = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD")
          onDateFilterChange(`created_at::DATE BETWEEN '${fmt(fromDate)}' AND '${fmt(toDate)}'`)
        } else {
          onDateFilterChange("")
        }
      }
      return
    }

    setActiveFilter(normalizedValue)
    const filtered = dataToFilter.filter((item) => {
      const rowMonth = item.month
      if (timeGrain === "weekly" && rowMonth) {
        const rowNorm = dayjs(rowMonth).isValid() ? dayjs(rowMonth).format("YYYY-MM-DD") : String(rowMonth).trim()
        return rowNorm === normalizedValue
      }
      return String(rowMonth).trim() === normalizedValue
    })
    setFilteredGridData(filtered)
    gridApiRef.current?.setFilterModel(null)

    if (onDateFilterChange) {
      let sqlFilter = ""
      if (timeGrain === "weekly") {
        const d = dayjs(timeValue)
        if (d.isValid()) {
          sqlFilter = `created_at::DATE = '${d.format("YYYY-MM-DD")}'`
        }
      } else {
        const d = dayjs(timeValue, ["YYYY-MM", "MMM-YYYY", "MMM YYYY", "YYYY-MM-DD"], true)
        if (d.isValid()) {
          const start = d.startOf("month").format("YYYY-MM-DD")
          const end = d.endOf("month").format("YYYY-MM-DD")
          sqlFilter = `created_at::DATE BETWEEN '${start}' AND '${end}'`
        }
      }
      if (sqlFilter) onDateFilterChange(sqlFilter)
    }
  }

  const handleBcuNumberChange = (value) => {
    // Update the selected BCU state
    setSelectedBcu(value)

    // Create the BCU query string with the CURRENT selected value
    const bcuQuery = value && value !== "All BCUs" ? `bcu_number = '${value}'` : "" // Empty string when "All BCUs" is selected

    // Call the callback function with the SQL filter
    if (onBcuFilterChange) {
      onBcuFilterChange(bcuQuery)
    }

    // Update local filters for the chart
    if (value === "All BCUs" || !value) {
      // Remove BCU filter when "All BCUs" is selected
      setLocalFilters((prev) => prev.filter((f) => f.key !== "bcu_number"))
    } else {
      // Add BCU filter for specific BCU
      const bcuFilter = {
        key: "bcu_number",
        cond: "equals",
        value: value,
      }

      setLocalFilters((prev) => {
        const filtersWithoutBcu = prev.filter((f) => f.key !== "bcu_number")
        return [...filtersWithoutBcu, bcuFilter]
      })
    }

    // Refresh the chart
    setRefreshKey((prev) => prev + 1)
  }

  useEffect(() => {
    if (onDateFilterChange && fromDate && toDate) {
      const formatDate = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD")
      const sqlFilter = `created_at::DATE BETWEEN '${formatDate(fromDate)}' AND '${formatDate(toDate)}'`
      onDateFilterChange(sqlFilter)
    }
  }, [])

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

      // Dropdown: only BCU numbers that come from the API response (bcu_number)
      const uniqueBcus = Array.from(new Set(gridData.map((item) => item.bcu_number))).filter(Boolean)
      console.log('[BCULoading] BCU number count in dropdown:', uniqueBcus.length, 'BCUs:', uniqueBcus)
      setBcuNumberOptions(uniqueBcus)

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
      chartData.forEach((dataPoint) => {
        Object.keys(dataPoint).forEach((key) => {
          if (key !== "month") {
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
            labelText: "{valueY}",
          }),
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
        inside: false,
        rotation: -90,
        dx: -8,
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

      yAxis.children.unshift(
        am5.Label.new(root, {
          rotation: -90,
          text: "BCU Wise Alert Count",
          y: am5.p50,
          centerX: am5.p50,
          fontSize: 10,
          fontWeight: "bold",
          paddingBottom: 0,
        }),
      )
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
      // Create a series for each BCU
      const localBcuNumbers = Array.from(new Set(gridData.map((item) => item.bcu_number)))
      const localBcuNumber = Array.from(new Set(gridData.map((item) => item)))
      chartData.forEach((dataPoint) => {
        const { month, date } = dataPoint
        localBcuNumbers.forEach((bcu) => {
          const match = gridData.find(
            (item) =>
              item.bcu_number === bcu &&
              (item.month === month)
          )

          dataPoint[`${bcu}_total_alerts`] = match?.total_alerts || 0
        })
      })

      // First, let's prepare the chart data to include loaded quantities
      chartData.forEach((dataPoint) => {
        const month = dataPoint.month
        // For each BCU, add a corresponding loaded_qty field
        localBcuNumbers.forEach((bcu) => {
          const matchingEntries = gridData.filter((item) => item.month === month && item.bcu_number === bcu)
          if (matchingEntries.length > 0) {
            // Add the total_loaded_qty to the chart data point with a special field name
            dataPoint[`${bcu}_loaded_qty`] = matchingEntries[0].total_loaded_qty
          } else {
            dataPoint[`${bcu}_loaded_qty`] = 0
          }
        })
      })

      console.log("localBcuNumber", localBcuNumber);

      localBcuNumbers.forEach((bcu, index) => {
        const colorIndex = index % colors.length;

        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: bcu,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "total_alerts", // Use total alerts for the Y-axis
            categoryXField: "month",
            stroke: am5.color(colors[colorIndex]),
            fill: am5.color(colors[colorIndex]),
            tooltip: am5.Tooltip.new(root, {
              // labelText: `[bold fontSize:12px]BCU Number: ${bcu},[/][bold fontSize:12px]Total Alerts: {${bcu}_total_alerts},[/][bold fontSize:12px]Loaded Qty: {${bcu}_loaded_qty}[/]`,
              labelText: `[bold fontSize:10px]BCU: ${bcu},[/][bold fontSize:10px]Alerts: {${bcu}_total_alerts},[/][bold fontSize:10px]Qty: {${bcu}_loaded_qty}[/]`,
              maxWidth: 400,
              // forceHidden: false,
              paddingBottom: 2,
              paddingTop: 1,
              background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0xffffff), // White background
                fillOpacity: 0.7, // 70% opacity (semi-transparent)
                strokeOpacity: 0.5, // Slightly transparent border
              })
            }),
            minBulletDistance: 10,
          }),
        );

        // Apply adapter to the tooltip to hide it when value is 0 or not present
        series.get("tooltip").adapters.add("visible", (visible, target) => {
          const dataContext = target.dataItem?.dataContext;
          const alertValue = dataContext?.[`${bcu}_total_alerts`] || 0;

          if (alertValue <= 0) {
            // Force hide tooltip and prevent space allocation
            target.set("forceHidden", true);
            return false;
          }

          target.set("forceHidden", false);
          return true;
        })


        // Add circle bullets with click events
        series.bullets.push((root) => {
          const circle = am5.Circle.new(root, {
            radius: 5,
            fill: am5.color(colors[colorIndex]),
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
        series.bullets.push((root) => {
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
            }),
          })

          // Hide label if value is 0 or not present
          labelBullet.get("sprite").adapters.add("visible", (visible, target) => {
            const dataItem = target.dataItem
            return dataItem?.dataContext[bcu] > 0
          })

          return labelBullet
        })

        // Set data for the series
        series.data.setAll(chartData)
      })
      // Add cursor
      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "zoomX",
        }),
      )

      chart.set(
        "scrollbarX",
        am5.Scrollbar.new(root, {
          orientation: "horizontal",
          paddingTop: 0,
        }),
      )
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
    if (onChartFilterChange) onChartFilterChange(null)
    // Restore parent date filter so HostLocalLoadedTts shows full range again
    if (onDateFilterChange) {
      if (timeGrain === "weekly" && fromDate && toDate) {
        const fmt = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD")
        onDateFilterChange(`created_at::DATE BETWEEN '${fmt(fromDate)}' AND '${fmt(toDate)}'`)
      } else {
        onDateFilterChange("")
      }
    }
  }

  const chartTitle = `BCU Alert Analysis (${fromDate && toDate ? `${fromDate.format("DD MMM YYYY")} - ${toDate.format("DD MMM YYYY")}` : "Monthly"})`

  const filterPortalEl = filterPortalId ? document.getElementById(filterPortalId) : null

  const filterControls = (
    <>
      <Select onValueChange={handleBcuNumberChange} value={selectedBcu || ""}>
        <SelectTrigger className="h-7 text-xs w-40">
          <SelectValue placeholder="Select BCU">{selectedBcu || "Select BCU"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All BCUs">All BCUs</SelectItem>
          {bcuNumberOptions.map((bcu) =>
            bcu ? (
              <SelectItem key={bcu} value={bcu}>
                {bcu}
              </SelectItem>
            ) : null,
          )}
        </SelectContent>
      </Select>
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

  useEffect(() => {
    gridApiRef.current?.setFilterModel(null)
  }, [activeFilter])

  return (
    <>
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
                <CardTitle className="text-xs font-bold text-gray-800">{chartTitle}</CardTitle>
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
          className={`transition-all duration-300 ${isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
            }`}
        >
          <CardHeader className="pb-0 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                BCU Alert Data
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
              /* Hide vertical scrollbar only */
              .bcu-loading-table-invisible-scroll .ag-body-viewport,
              .bcu-loading-table-invisible-scroll .ag-body-viewport-wrapper,
              .bcu-loading-table-invisible-scroll .ag-center-cols-viewport,
              .bcu-loading-table-invisible-scroll .ag-body-vertical-scroll-viewport {
                scrollbar-width: none;
                -ms-overflow-style: none;
              }
              .bcu-loading-table-invisible-scroll .ag-body-viewport::-webkit-scrollbar,
              .bcu-loading-table-invisible-scroll .ag-body-viewport-wrapper::-webkit-scrollbar,
              .bcu-loading-table-invisible-scroll .ag-center-cols-viewport::-webkit-scrollbar,
              .bcu-loading-table-invisible-scroll .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
                display: none;
              }
              /* Force horizontal scroll row visible (AG Grid hides it with ag-scrollbar-invisible / ag-apple-scrollbar) */
              .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll.ag-scrollbar-invisible,
              .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                opacity: 1 !important;
                visibility: visible !important;
                position: relative !important;
                bottom: auto !important;
              }
              .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport,
              .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer,
              .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer {
                scrollbar-width: thin !important;
                -ms-overflow-style: auto !important;
                min-height: 12px;
              }
              .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
              .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar,
              .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar {
                height: 10px !important;
                display: block !important;
              }
              .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
              .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar-track,
              .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar-track {
                background: #e5e7eb;
                border-radius: 4px;
              }
              .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
              .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar-thumb,
              .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar-thumb {
                background: #6b7280;
                border-radius: 4px;
              }
              .bcu-loading-table-invisible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
              .bcu-loading-table-invisible-scroll .ag-horizontal-left-spacer::-webkit-scrollbar-thumb:hover,
              .bcu-loading-table-invisible-scroll .ag-horizontal-right-spacer::-webkit-scrollbar-thumb:hover {
                background: #4b5563;
              }
            `}</style>
            <div
              className="ag-theme-alpine bcu-loading-table-invisible-scroll"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
                width: "100%",
              }}
            >
              <AgGridReact
                key={`bcu-loading-grid-${activeFilter ?? 'all'}-${gridData.length}`}
                columnDefs={columnDefs}
                rowData={filteredGridData.length > 0 ? filteredGridData : gridData}
                getRowId={(params) => {
                  const d = params.data;
                  if (!d) return 'empty';
                  const id = [d.month, d.bcu_number, d.zone, d.sap_id, d.location_name, d.total_alerts, d.total_loaded_qty].filter(Boolean).join('|');
                  return id || `row-${d.month}-${d.bcu_number ?? ''}`;
                }}
                onGridReady={(params) => { gridApiRef.current = params.api }}
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
                alwaysShowHorizontalScroll={true}
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

export default BCUAlertTrendChart