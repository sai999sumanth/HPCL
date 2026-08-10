
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import type { GridApi, SortDirection } from "ag-grid-community"
import dayjs from "dayjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { Loader2, RotateCcw, Maximize2, Minimize2, Download, Info } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip"
import { DateRangePickerFilter } from "./DateRangePickerFilter"
import { apiClient } from "@/services/apiClient"
import * as XLSX from "xlsx"

interface DataPoint {
  month?: string
  date?: string
  Equipment: number
  sortOrder?: number
  alert_status?: string
  count?: number
  openCount?: number,
  closeCount?: number,
}

interface DetailRow {
  sap_id: string
  zone: string
  location_name: string
  equipment_name: string
  sensor_id?: string
  count: number
  open_alerts_current_day?: number
  close_alerts_current_day?: number
  type?: string
  carry_forward_days?: number
  created_date?: string
  till_date?: string
  closed_date?: string
  days_to_close?: number
  category?: string
  month?: string
  date?: string
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface TASMaintenanceChartProps {
  filters: FilterValue[]
  zone?: string | null
  plant?: string | null
  onDateRangeSelect?: (startDate: string, endDate: string) => void
  onEquipmentSelect?: (equipment: string) => void
  onDeviceSelect?: (device: string) => void
  onRowClick?: (equipmentName: string, date: string, sensorId?: string) => void
  onChartDateSelect?: (date: string, isMonth?: boolean) => void
  /** Parent increments this to clear chart table filter (so one clear clears both tables) */
  clearChartFilterTrigger?: number
  /** Notify parent when Equipment Usage Analysis is loading (for MaintenanceTable overlay). */
  onMaintenanceLoadingChange?: (loading: boolean) => void
  /** Full tas_maintenance_fault response for MaintenanceTable (`data.data` rows). */
  onMaintenanceDataChange?: (data: any) => void
}
interface EquipmentDetail {
  sap_id: string;
  zone: string;
  location_name: string;
  equipment_name: string;
  sensor_id: string | null;
  alert_status: string;
  count: number;
  open_alerts_current_day?: number;
  close_alerts_current_day?: number;
  open_alerts_current_carry_count?: number;
  type?: string;
  carry_forward_days?: number;
  created_date?: string;
  till_date?: string;
  closed_date?: string;
  days_to_close?: number;
}
interface EquipmentData {
  open_alerts_current_carry_count: number;
  details: EquipmentDetail[];
}
interface ApiResponse {
  status: boolean;
  message: string;
  alert_summary?: {
    safety?: Record<string, { Equipment: EquipmentData }>;
    process?: Record<string, { Equipment: EquipmentData }>;
  };
  monthly_data?: {
    safety?: Record<string, { Equipment: EquipmentData }>;
    process?: Record<string, { Equipment: EquipmentData }>;
  };
  daily_data?: {
    safety?: Record<string, { Equipment: EquipmentData }>;
    process?: Record<string, { Equipment: EquipmentData }>;
  };
}
export default function TASMaintenanceChart({
  filters,
  zone: zoneProp,
  plant: plantProp,
  onDateRangeSelect,
  onEquipmentSelect,
  onRowClick,
  onDeviceSelect,
  onChartDateSelect,
  clearChartFilterTrigger = 0,
  onMaintenanceLoadingChange,
  onMaintenanceDataChange,
}: TASMaintenanceChartProps) {
  const rootRef = useRef<am5.Root | null>(null)
  const lineChartRef = useRef<HTMLDivElement | null>(null)
  const normalTableWrapRef = useRef<HTMLDivElement | null>(null)
  const tableGridApiRef = useRef<GridApi | null>(null)
  /** Latest API buckets for chart-point / bar drill-down (table default stays alert_summary). */
  const drillDailyDataRef = useRef<NonNullable<ApiResponse["daily_data"]>>({})
  const drillMonthlyDataRef = useRef<NonNullable<ApiResponse["monthly_data"]>>({})
  const skipAutoDateRangeNotifyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [isMaintenanceTableLoading, setIsMaintenanceTableLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [gridData, setGridData] = useState<DetailRow[]>([])
  const gridDataRef = useRef<DetailRow[]>([])
  const [filteredGridData, setFilteredGridData] = useState<DetailRow[]>([])
 
  // Keep ref in sync with gridData state
  useEffect(() => {
    gridDataRef.current = gridData
  }, [gridData])
  const [localFilters, setLocalFilters] = useState<FilterValue[]>([])
  const [viewMode, setViewMode] = useState<"yearly" | "weekly">("weekly")
  const [fromMDate, setFromMDate] = useState(dayjs().subtract(7, "day"))
  const [toMDate, setToMDate] = useState(dayjs())
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<string>("All Equipment")
  const [hasData, setHasData] = useState(true)
  const [isDateRangeSelected, setIsDateRangeSelected] = useState(false)
  const [deviceOptions, setDeviceOptions] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("All Devices");
  const [isDownloading, setIsDownloading] = useState(false);
  const [tableAlertStatus, setTableAlertStatus] = useState<"Open" | "Close">("Close");
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>(() => {
    // Initialize with default 7-day date filter for weekly view
    return [
      {
        key: '"DATE"',
        cond: "equals",
        value: `${dayjs().subtract(7, "day").format("YYYY-MM-DD")},${dayjs().format("YYYY-MM-DD")}`,
      },
    ]
  })

  useEffect(() => {
    onMaintenanceLoadingChange?.(isMaintenanceTableLoading)
  }, [isMaintenanceTableLoading, onMaintenanceLoadingChange])

  const fetchDeviceIDs = async () => {
    try {
      const apiEndpoint = "/api/charts/get_distinct_values";
      const requestBody = {
        connection_id: 1,
        schema: "public",
        table: "alerts",
        column: ["sensor_id"],
        where_cond: [
          {
            key: "equipment_name",
            cond: "equals",
            value: selectedEquipment,
            val: ""
          }
        ]
      };

      const response = await apiClient.post(apiEndpoint, requestBody);

      const result = response.data;

      if (result.status && result.data?.sensor_id) {
        // Map the sensors with proper format if needed
        setDeviceOptions(result.data.sensor_id);
      } else {
        setDeviceOptions([]);
      }
    } catch (error) {
      console.error("Error fetching device IDs:", error);
      setDeviceOptions([]);
    }
  };

  // Call fetchDeviceIDs when selectedEquipment changes
  useEffect(() => {
    fetchDeviceIDs();
  }, [selectedEquipment]);

  // Helper function to convert month string to sortable format
  const getMonthSortOrder = (monthStr: string): number => {
    // Parse month string (e.g., "May-2024", "Dec-2023") to get proper sorting order
    const [month, year] = monthStr.split('-');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const monthIndex = monthNames.indexOf(month);
    // Return year * 100 + month index for proper chronological sorting
    return parseInt(year) * 100 + monthIndex;
  };

  const handleRowClick = (event: any) => {
    if (onRowClick && event.data && event.data.equipment_name) {
      const timeValue = viewMode === "yearly" ? event.data.month : event.data.date; // Get the date or month
      onRowClick(event.data.equipment_name, timeValue); // Pass equipment name and date only (sensor_id removed)
    }
    // DO NOT clear filteredGridData - preserve the date filter from line chart dot click
    // The filtered view in Equipment Analysis table should remain visible when a row is clicked
    // Only the chart date filter will be applied, not equipment ID filter from row click
  }

  /** Chart bullet/bar drill-down uses filtered rows; omit date/carry columns in that view */
  const isChartPointFilterActive = filteredGridData.length > 0

  // Column definitions for the AG Grid (slightly reduced column widths)
  const columnDefs = useMemo(() => {
    const dateColumn = {
      headerName: viewMode === "yearly" ? "Month" : "Date",
      field: viewMode === "yearly" ? "month" : ("date" as keyof DetailRow),
      sort: "desc" as SortDirection,
      filter: false,
      suppressMenu: true,
      width: 120,
    }

    return [
    {
      headerName: "SAP ID",
      field: "sap_id" as keyof DetailRow,
      filter: false,
      suppressMenu: true,
      width: 85,
    },
    {
      headerName: "Zone",
      field: "zone" as keyof DetailRow,
      filter: false,
      suppressMenu: true,
      width: 85,
    },
    {
      headerName: "Plant",
      field: "location_name" as keyof DetailRow,
      filter: false,
      suppressMenu: true,
      width: 92,
    },
    {
      headerName: "Category",
      field: "category" as keyof DetailRow,
      filter: false,
      suppressMenu: true,
      width: 100,
    },
    {
      headerName: "Equipment",
      field: "equipment_name" as keyof DetailRow,
      filter: false,
      suppressMenu: true,
      width: 110,
    },
    {
      headerName: "Equipment ID",
      field: "sensor_id" as keyof DetailRow,
      filter: false,
      suppressMenu: true,
      width: 130,
      minWidth: 130,
      wrapHeaderText: false,
      autoHeaderHeight: false,
    },
    ...(tableAlertStatus === "Close" ? [dateColumn] : []),
    ...(isChartPointFilterActive
      ? []
      : tableAlertStatus === "Open"
        ? [
            // {
            //   headerName: "Created Date",
            //   field: "created_date" as keyof DetailRow,
            //   filter: false,
            //   suppressMenu: true,
            //   width: 120,
            // },
            {
              headerName: "Current Date",
              field: "till_date" as keyof DetailRow,
              filter: false,
              suppressMenu: true,
              width: 120,
            },
          ]
        : [
            // {
            //   headerName: "Created Date",
            //   field: "created_date" as keyof DetailRow,
            //   filter: false,
            //   suppressMenu: true,
            //   width: 120,
            // },
            {
              headerName: "Closed Date",
              field: "closed_date" as keyof DetailRow,
              filter: false,
              suppressMenu: true,
              width: 120,
            },
            {
              headerName: "Closure Duration (Days)",
              field: "days_to_close" as keyof DetailRow,
              filter: false,
              suppressMenu: true,
              width: 120,
            },
          ]),
    ...(tableAlertStatus === "Open" && !isChartPointFilterActive
      ? [
          {
            headerName: "Carry Forward Days",
            field: "carry_forward_days" as keyof DetailRow,
            filter: false,
            suppressMenu: true,
            width: 150,
          },
        ]
      : []),
    // Show carry forward count when open bar is clicked
    ...(isChartPointFilterActive && tableAlertStatus === "Open"
      ? [
          {
            headerName: "Open Alerts Carry Count",
            field: "count" as keyof DetailRow,
            filter: false,
            suppressMenu: true,
            width: 120,
          },
        ]
      : []),
    ...(tableAlertStatus === "Open" ? [dateColumn] : []),
  ]
  }, [viewMode, tableAlertStatus, isChartPointFilterActive])
  
  const handleDownloadExcel = useCallback(() => {
    type ExportColDef = {
      headerName?: string
      field?: keyof DetailRow | string
      valueGetter?: (params: { data?: DetailRow }) => unknown
    }

    const sourceData = filteredGridData.length > 0 ? filteredGridData : gridData
    const exportRows = sourceData.filter((row) => {
      if (tableAlertStatus === "Open") {
        return (row.type || "").toLowerCase() !== "closed"
      }
      if (isChartPointFilterActive) {
        return (row.type || "").toLowerCase() === "closed"
      }
      return (row.type || "").toLowerCase() === "closed"
    })

    if (!exportRows.length) return

    const dateHeader = viewMode === "yearly" ? "Month" : "Date"
    const openTabExportMetricHeaders = new Set([
      "Carry Forward Days",
      "Open Alerts Carry Count",
      "Open Alerts (Current Day)",
      "Total Open Alerts",
      dateHeader,
    ])
    const openTabExportMetricCols: ExportColDef[] =
      tableAlertStatus === "Open"
        ? [
            {
              headerName: "Open Alerts Carry Count",
              field: "count",
            },
            {
              headerName: "Open Alerts (Current Day)",
              field: "open_alerts_current_day",
            },
            ...(!isChartPointFilterActive
              ? [{ headerName: "Carry Forward Days", field: "carry_forward_days" }]
              : []),
          ]
        : []
    const exportColumnDefs: ExportColDef[] =
      tableAlertStatus === "Open"
        ? [
            ...(columnDefs as ExportColDef[]).filter(
              (col) => !openTabExportMetricHeaders.has(col.headerName || ""),
            ),
            ...openTabExportMetricCols,
            {
              headerName: dateHeader,
              field: viewMode === "yearly" ? "month" : "date",
            },
          ]
        : (columnDefs as ExportColDef[])

    setIsDownloading(true)
    try {
      const numericFields = new Set([
        "count",
        "carry_forward_days",
        "open_alerts_current_day",
        "days_to_close",
      ])
      const toExcelRow = (row: DetailRow) => {
        const obj: Record<string, unknown> = {}
        exportColumnDefs.forEach((col) => {
          const headerName = col.headerName || (col.field as string) || ""
          if (!headerName) return
          if (typeof col.valueGetter === "function") {
            obj[headerName] = col.valueGetter({ data: row })
          } else if (col.field) {
            const val = row[col.field as keyof DetailRow]
            obj[headerName] = numericFields.has(col.field as string)
              ? val !== undefined && val !== null
                ? Number(val)
                : 0
              : (val ?? "")
          }
        })
        return obj
      }

      const ws = XLSX.utils.json_to_sheet(exportRows.map(toExcelRow))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Equipment Analysis")

      const timeLabel = viewMode === "yearly" ? "Monthly" : "Weekly"
      const equipmentPart =
        selectedEquipment !== "All Equipment"
          ? `_${String(selectedEquipment).replace(/\s+/g, "_")}`
          : ""
      const datePart =
        filteredGridData.length > 0 && filteredGridData[0]
          ? `_${viewMode === "yearly" ? filteredGridData[0].month : filteredGridData[0].date}`
          : ""
      const filename = `TAS_Maintenance_${timeLabel}${equipmentPart}${datePart}_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (error) {
      console.error("Error downloading Excel file:", error)
      setError("Failed to download Excel file. Please try again.")
    } finally {
      setIsDownloading(false)
    }
  }, [
    columnDefs,
    gridData,
    filteredGridData,
    isChartPointFilterActive,
    tableAlertStatus,
    viewMode,
    selectedEquipment,
  ])

  // Improved filter handling
  useEffect(() => {
    // Create a map to merge filters, giving preference to new filters
    const filterMap = new Map<string, FilterValue>()

    // Add existing local filters first
    localFilters.forEach((filter) => {
      filterMap.set(filter.key, filter)
    })

    // Overwrite or add new filters from parent
    filters.forEach((filter) => {
      filterMap.set(filter.key, filter)
    })

    // Convert map back to array
    const combinedFilters = Array.from(filterMap.values())

    // Update local filters state
    setLocalFilters(combinedFilters)

    // Trigger a refresh when filters change
    setRefreshKey((prev) => prev + 1)
  }, [filters])

  // Set default date range for weekly view (skip after refresh clears parent date filter)
  useEffect(() => {
    if (skipAutoDateRangeNotifyRef.current) {
      skipAutoDateRangeNotifyRef.current = false
      return
    }
    if (viewMode === "weekly" && onDateRangeSelect && !isDateRangeSelected) {
      const startDate = dayjs().subtract(7, "day").format("YYYY-MM-DD")
      const endDate = dayjs().format("YYYY-MM-DD")
      onDateRangeSelect(startDate, endDate)
    }
  }, [viewMode, onDateRangeSelect, isDateRangeSelected])

  // When parent clears "Date Filter Applied" (×), clear this chart's table filter only (do not change crossFilters or chart will reload)
  useEffect(() => {
    if (clearChartFilterTrigger > 0) {
      setFilteredGridData([])
    }
  }, [clearChartFilterTrigger])

  // Handle refresh button click
  const handleRefresh = () => {
    setIsLoading(true)
    setIsTransitioning(true)
    setError(null)
    setHasData(true)

    // Set view mode to weekly when refreshing
    setViewMode("weekly")

    // Reset equipment filter
    setSelectedEquipment("All Equipment")

    // Notify parent component about equipment reset
    if (onEquipmentSelect) {
      onEquipmentSelect("All Equipment")
    }
    setSelectedDevice("All Devices");
    if (onDeviceSelect) {
      onDeviceSelect("All Devices");
    }

    // Reset date selection flag and clear applied date filters
    setIsDateRangeSelected(false)
    skipAutoDateRangeNotifyRef.current = true

    const startDate = dayjs().subtract(7, "day")
    const endDate = dayjs()
    setFromMDate(startDate)
    setToMDate(endDate)

    // Remove date, zone, plant, equipment from crossFilters (no DATE filter until user applies again)
    setCrossFilters((prevFilters) =>
      prevFilters.filter(
        (f) =>
          f.key !== "zone" &&
          f.key !== "plant" &&
          f.key !== "interlock_name" &&
          f.key !== "equipment_name" &&
          f.key !== '"DATE"',
      ),
    )

    // Reset chart point table filter
    setFilteredGridData([])

    if (onDateRangeSelect) {
      onDateRangeSelect("", "")
    }
    if (onChartDateSelect) {
      onChartDateSelect("", false)
    }

    // Trigger a refresh
    setRefreshKey((prev) => prev + 1)
  }

  // Handle date apply - only applies when Apply button is clicked. Clamp to today so future dates are not used.
  const handleDateApply = (startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) => {
    if (!startDate || !endDate) return;

    const today = dayjs().endOf("day");
    const clampedEnd = endDate.isAfter(today) ? today : endDate;
    const clampedStart = startDate.isAfter(today) ? today : startDate;
    const from = clampedStart.isAfter(clampedEnd) ? clampedEnd : clampedStart;
    const to = clampedStart.isAfter(clampedEnd) ? clampedStart : clampedEnd;

      const formatDate = (date: dayjs.Dayjs) => {
        return date.format("YYYY-MM-DD");
      }

    setFromMDate(from);
    setToMDate(to);

    const startDateStr = formatDate(from);
    const endDateStr = formatDate(to);

      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${startDateStr},${endDateStr}`,
      };

      setCrossFilters((prevFilters) => {
        // Remove any existing date filters
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"');

        // Add the new date filter
        return [...filtersWithoutDate, dateFilter];
      });

      // Set the flag to indicate a date range has been manually selected
      setIsDateRangeSelected(true);

      // Ensure dates are passed in the same format as the API request
      if (onDateRangeSelect) {
        onDateRangeSelect(startDateStr, endDateStr);
      }

      // Reset filtered grid data
      setFilteredGridData([]);

      // Reset selected equipment to "All Equipment" and notify parent component
      setSelectedEquipment("All Equipment");
      if (onEquipmentSelect) {
        onEquipmentSelect("All Equipment");
      }

      // Refresh the data
      setRefreshKey((prev) => prev + 1);
  }

  // Handle equipment selection change
  const handleEquipmentChange = (value: string) => {
    setSelectedEquipment(value)

    if (value === "All Equipment") {
      // Remove equipment filter
      setCrossFilters((prevFilters) => {
        return prevFilters.filter((f) => f.key !== "equipment_name")
      })
    } else {
      // Add equipment filter
      const equipmentFilter = {
        key: "equipment_name",
        cond: "equals",
        value: value === "N/A" ? "" : value, // Handle null equipment_name as empty string
      }

      setCrossFilters((prevFilters) => {
        const filtersWithoutEquipment = prevFilters.filter((f) => f.key !== "equipment_name")
        return [...filtersWithoutEquipment, equipmentFilter]
      })
    }

    // Notify parent component about equipment selection
    if (onEquipmentSelect) {
      onEquipmentSelect(value)
    }

    // Reset filtered grid data
    setFilteredGridData([])

    // Trigger a refresh
    setRefreshKey((prev) => prev + 1)
  }

  const buildMaintenanceFaultRequestBody = useCallback(() => {
      const dateFilter = crossFilters.find((filter) => filter.key === '"DATE"')
      const equipmentFilter = crossFilters.find((filter) => filter.key === "equipment_name")
      const deviceFilter = crossFilters.find((filter) => filter.key === "sensor_id")

      const cross_filters = [...(dateFilter ? [dateFilter] : [])]

      const zoneFilter =
        (zoneProp !== undefined && zoneProp !== null && zoneProp !== ""
          ? zoneProp
          : filters.find((f) => f.key === "zone")?.value) ?? null
      const plantFilter =
        (plantProp !== undefined && plantProp !== null && plantProp !== ""
          ? plantProp
          : filters.find((f) => f.key === "sap_id")?.value) ?? null

      const filtersWithEquipmentAndDevice = [
        ...filters.filter(
          (f) =>
            f.key !== "zone" &&
            f.key !== "sap_id" &&
            f.key !== "equipment_name" &&
            f.key !== "sensor_id",
        ),
        ...(zoneFilter ? [{ key: "zone", cond: "equals", value: zoneFilter }] : []),
        ...(plantFilter ? [{ key: "sap_id", cond: "equals", value: plantFilter }] : []),
        ...(equipmentFilter
          ? [{ key: "equipment_name", cond: "equals", value: equipmentFilter.value }]
          : []),
        ...(deviceFilter ? [{ key: "sensor_id", cond: "equals", value: deviceFilter.value }] : []),
      ]

      let defaultDateRange = null
      if (viewMode === "weekly") {
        const startDate = dayjs().subtract(7, "day").format("YYYY-MM-DD")
        const endDate = dayjs().format("YYYY-MM-DD")
        defaultDateRange = `${startDate},${endDate}`
      }

      return {
        action: "tas_maintenance_fault",
        drill_state: viewMode === "yearly" ? "" : "date",
        cross_filters,
        filters: filtersWithEquipmentAndDevice,
        limit: 0,
        time_grain: viewMode === "weekly" ? "week" : "",
        resp_format: "",
        resp_level: "",
        ...(viewMode === "weekly" &&
          !isDateRangeSelected &&
          defaultDateRange && {
            // date_range: defaultDateRange,
          }),
      }
    },
    [crossFilters, filters, zoneProp, plantProp, viewMode, isDateRangeSelected],
  )

  const fetchMaintenanceTableData = useCallback(async () => {
    setIsMaintenanceTableLoading(true)
    try {
      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        buildMaintenanceFaultRequestBody(),
      )
      onMaintenanceDataChange?.(response.data)
    } catch (error) {
      console.error("Error fetching maintenance table data:", error)
      onMaintenanceDataChange?.(null)
    } finally {
      setIsMaintenanceTableLoading(false)
    }
  }, [buildMaintenanceFaultRequestBody, onMaintenanceDataChange])

  useEffect(() => {
    fetchMaintenanceTableData()
  }, [fetchMaintenanceTableData, refreshKey])

  // Chart + upper Equipment Analysis table — same tas_maintenance_fault payload as lower table.
  const fetchChartData = async () => {
  setIsLoading(true)
  setIsTransitioning(true)
  try {
    const apiEndpoint = "/api/charts/generate_vis_data"
    const requestBody = buildMaintenanceFaultRequestBody()

    const response = await apiClient.post(apiEndpoint, requestBody)

    const result: ApiResponse = response.data
    const alertSummary = result.alert_summary || {}
    drillDailyDataRef.current = result.daily_data || {}
    drillMonthlyDataRef.current = result.monthly_data || {}
    // Equipment Usage chart: daily_data (weekly) / monthly_data (monthly); table default: alert_summary only
    const chartSeriesData =
      viewMode === "yearly" ? result.monthly_data || {} : result.daily_data || {}

    // Extract equipment options from the API response
    const extractEquipmentNames = (data: any) => {
      const names = new Set<string>()

      // Process safety data
      Object.values(data?.safety || {}).forEach((dateData: any) => {
        if (dateData?.Equipment?.details) {
          dateData.Equipment.details.forEach((detail: any) => {
            names.add(detail.equipment_name === null ? "N/A" : detail.equipment_name)
          })
        }
      })

      // Process process data
      Object.values(data?.process || {}).forEach((dateData: any) => {
        if (dateData?.Equipment?.details) {
          dateData.Equipment.details.forEach((detail: any) => {
            names.add(detail.equipment_name === null ? "N/A" : detail.equipment_name)
          })
        }
      })

      return Array.from(names).filter(Boolean).sort()
    }

    // Set equipment options only when not filtering by equipment – keeps all tabs visible when switching
    const hasEquipmentFilter = crossFilters.some((f) => f.key === "equipment_name")
    if (viewMode === "yearly") {
      const equipmentNames = extractEquipmentNames(alertSummary)
      if (!hasEquipmentFilter) setEquipmentOptions(equipmentNames)
      return {
        data: {
          process: chartSeriesData?.process || {},
          safety: chartSeriesData?.safety || {},
        },
        gridSource: {
          process: alertSummary?.process || {},
          safety: alertSummary?.safety || {},
        },
        mode: "yearly",
      }
    } else {
      const equipmentNames = extractEquipmentNames(alertSummary)
      if (!hasEquipmentFilter) setEquipmentOptions(equipmentNames)
      return {
        data: {
          process: chartSeriesData?.process || {},
          safety: chartSeriesData?.safety || {},
        },
        gridSource: {
          process: alertSummary?.process || {},
          safety: alertSummary?.safety || {},
        },
        mode: "weekly",
      }
    }
  } catch (error) {
    drillDailyDataRef.current = {}
    drillMonthlyDataRef.current = {}
    setError("Please refresh and check once again since server is down.")
    return {
      data: {
        process: {},
        safety: {},
      },
      gridSource: {
        process: {},
        safety: {},
      },
      mode: viewMode === "yearly" ? "yearly" : "weekly",
    }
  } finally {
    setIsLoading(false)
    setIsTransitioning(false)
  }
}

  // Helper function to check if a date is within the selected range
  const isDateInRange = (dateStr: string): boolean => {
    if (viewMode === "yearly" || !fromMDate || !toMDate) {
      return true; // For yearly view or when no date range is set, include all dates
    }
   
    const date = dayjs(dateStr);
    return date.isSame(fromMDate, 'day') || date.isSame(toMDate, 'day') ||
           (date.isAfter(fromMDate, 'day') && date.isBefore(toMDate, 'day'));
  };

const processData = (apiResponse: any): { chartData: DataPoint[]; gridData: DetailRow[] } => {
  if (!apiResponse || !apiResponse.data) {
    setHasData(false);
    return { chartData: [], gridData: [] };
  }

  const { safety = {}, process = {} } = apiResponse.data;
  const gridSource = apiResponse.gridSource || { safety: {}, process: {} };
  const gridSafety = gridSource.safety || {};
  const gridProcess = gridSource.process || {};
  const mode = apiResponse.mode;
  const chartData: DataPoint[] = [];
  const gridData: DetailRow[] = [];

  const chartEmpty = Object.keys(safety).length === 0 && Object.keys(process).length === 0;
  const gridEmpty =
    Object.keys(gridSafety).length === 0 && Object.keys(gridProcess).length === 0;

  if (chartEmpty && gridEmpty) {
    setHasData(false);
    return { chartData: [], gridData: [] };
  }

  setHasData(true);

  const categoryChartMetrics = (categoryData: any) => {
    let yAxisValue = 0;
    let tooltipOpen = 0;
    let tooltipClose = 0;

    if (categoryData?.Equipment) {
      yAxisValue = categoryData.Equipment.open_alerts_current_carry_count || 0;

      if (categoryData.Equipment.details) {
        const filteredDetails = selectedEquipment === "All Equipment"
          ? categoryData.Equipment.details
          : categoryData.Equipment.details.filter((detail: any) =>
              selectedEquipment === "N/A"
                ? detail.equipment_name === null
                : detail.equipment_name === selectedEquipment
            );

        filteredDetails.forEach((detail: any) => {
          tooltipOpen += detail.open_alerts_current_day || 0;
          tooltipClose += detail.close_alerts_current_day || 0;
        });
      }
    }
    return { yAxisValue, tooltipOpen, tooltipClose };
  };

  const appendGridRowsFromCategory = (
    categoryData: any,
    categoryName: "Safety" | "Process",
    timeKey: string,
    timeField: "date" | "month"
  ) => {
    if (!categoryData?.Equipment?.details) return;
    categoryData.Equipment.details.forEach((detail: any) => {
      gridData.push({
        sap_id: detail.sap_id || "",
        zone: detail.zone || "",
        location_name: detail.location_name || "",
        sensor_id: detail.sensor_id || "",
        equipment_name: detail.equipment_name || "N/A",
        count: detail.open_alerts_current_carry_count || 0,
        open_alerts_current_day: detail.open_alerts_current_day || 0,
        close_alerts_current_day: detail.close_alerts_current_day || 0,
        type: detail.type || "",
        carry_forward_days: detail.carry_forward_days ?? 0,
        created_date: detail.created_date || "",
        till_date: detail.till_date || "",
        closed_date: detail.closed_date || "",
        days_to_close: detail.days_to_close ?? 0,
        category: categoryName,
        [timeField]: timeKey,
      });
    });
  };

  if (mode === "weekly") {
    const allDates = new Set([...Object.keys(safety), ...Object.keys(process)]);
    const filteredDates = Array.from(allDates).filter((dateStr) => isDateInRange(dateStr));
    const hasDateRangeMatches = filteredDates.length > 0;
    const effectiveDates = hasDateRangeMatches ? filteredDates : Array.from(allDates);
    const sortedDates = effectiveDates.sort();

    const dateMap = new Map();
    if (fromMDate && toMDate && hasDateRangeMatches) {
      let currentDate = fromMDate.clone();
      while (currentDate.isSame(toMDate) || currentDate.isBefore(toMDate)) {
        const dateStr = currentDate.format("YYYY-MM-DD");
        if (filteredDates.includes(dateStr)) {
          dateMap.set(dateStr, {
            date: dateStr,
            Equipment: 0,
            openCount: 0,
            closeCount: 0,
          });
        }
        currentDate = currentDate.add(1, "day");
      }
    }

    sortedDates.forEach((dateKey) => {
      const safetyMetrics = categoryChartMetrics(safety[dateKey]);
      const processMetrics = categoryChartMetrics(process[dateKey]);

      dateMap.set(dateKey, {
        date: dateKey,
        Equipment: safetyMetrics.yAxisValue + processMetrics.yAxisValue,
        openCount: safetyMetrics.tooltipOpen + processMetrics.tooltipOpen,
        closeCount: safetyMetrics.tooltipClose + processMetrics.tooltipClose,
      });
    });

    const chartDataFromMap = Array.from(dateMap.values());
    chartData.push(...chartDataFromMap);
    chartData.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const allGridDates = new Set([...Object.keys(gridSafety), ...Object.keys(gridProcess)]);
    const filteredGridDates = Array.from(allGridDates).filter((dateStr) => isDateInRange(dateStr));
    const hasGridRangeMatches = filteredGridDates.length > 0;
    const effectiveGridDates = hasGridRangeMatches ? filteredGridDates : Array.from(allGridDates);
    effectiveGridDates.sort().forEach((dateKey) => {
      appendGridRowsFromCategory(gridSafety[dateKey], "Safety", dateKey, "date");
      appendGridRowsFromCategory(gridProcess[dateKey], "Process", dateKey, "date");
    });
  } else {
    const allMonths = new Set([...Object.keys(safety), ...Object.keys(process)]);

    Array.from(allMonths).forEach((monthKey) => {
      const safetyMetrics = categoryChartMetrics(safety[monthKey]);
      const processMetrics = categoryChartMetrics(process[monthKey]);

      chartData.push({
        month: monthKey,
        Equipment: safetyMetrics.yAxisValue + processMetrics.yAxisValue,
        openCount: safetyMetrics.tooltipOpen + processMetrics.tooltipOpen,
        closeCount: safetyMetrics.tooltipClose + processMetrics.tooltipClose,
        sortOrder: getMonthSortOrder(monthKey),
      });
    });

    chartData.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const allGridMonths = new Set([...Object.keys(gridSafety), ...Object.keys(gridProcess)]);
    Array.from(allGridMonths).forEach((monthKey) => {
      appendGridRowsFromCategory(gridSafety[monthKey], "Safety", monthKey, "month");
      appendGridRowsFromCategory(gridProcess[monthKey], "Process", monthKey, "month");
    });
  }

  return { chartData, gridData };
};
  // Function to filter grid data based on selected data point
  const filterGridDataByPoint = (timeValue: string, drillStatus?: "Open" | "Close") => {
    if (!timeValue) {
      setFilteredGridData([])
      return
    }

    if (drillStatus) {
      setTableAlertStatus(drillStatus)
    }

    const timeField = viewMode === "yearly" ? "month" : "date"
    const drillBucket =
      viewMode === "yearly" ? drillMonthlyDataRef.current : drillDailyDataRef.current

    const lookupKey =
      timeField === "date"
        ? (() => {
            const norm = timeValue.split("T")[0]
            const safetyKeys = Object.keys(drillBucket?.safety || {})
            const processKeys = Object.keys(drillBucket?.process || {})
            const direct =
              drillBucket?.safety?.[timeValue] || drillBucket?.process?.[timeValue]
                ? timeValue
                : null
            if (direct) return timeValue
            const all = new Set([...safetyKeys, ...processKeys])
            for (const k of all) {
              if (String(k).split("T")[0] === norm) return k
            }
            return timeValue
          })()
        : timeValue

    const rows: DetailRow[] = []
    const pushCategoryRows = (categoryData: any, categoryName: "Safety" | "Process") => {
      if (!categoryData?.Equipment?.details) return
      categoryData.Equipment.details.forEach((detail: any) => {
        rows.push({
          sap_id: detail.sap_id || "",
          zone: detail.zone || "",
          location_name: detail.location_name || "",
          sensor_id: detail.sensor_id || "",
          equipment_name: detail.equipment_name || "N/A",
          count: detail.open_alerts_current_carry_count || 0,
          open_alerts_current_day: detail.open_alerts_current_day || 0,
          close_alerts_current_day: detail.close_alerts_current_day || 0,
          type: detail.type || "",
          carry_forward_days: detail.carry_forward_days ?? 0,
          created_date: detail.created_date || "",
          till_date: detail.till_date || "",
          closed_date: detail.closed_date || "",
          days_to_close: detail.days_to_close ?? 0,
          category: categoryName,
          [timeField]: lookupKey,
        })
      })
    }

    pushCategoryRows(drillBucket?.safety?.[lookupKey], "Safety")
    pushCategoryRows(drillBucket?.process?.[lookupKey], "Process")

    setFilteredGridData(rows)
   
    // Pass the selected date/month to parent component for MaintenanceTable query
    if (onChartDateSelect) {
      const isMonth = viewMode === "yearly"
      onChartDateSelect(timeValue, isMonth)
    }
  }

  // Initialize and update chart
  useEffect(() => {
    let root: am5.Root | null = null

    const initChart = async () => {
      if (!lineChartRef.current) return

      if (rootRef.current) {
        rootRef.current.dispose()
      }

      const apiResponse = await fetchChartData()
      if (!apiResponse) return

      const { chartData, gridData } = processData(apiResponse)
      setGridData(gridData)
     
      // Store gridData in a ref for reliable access in click handlers
      gridDataRef.current = gridData

      // Reset filtered grid data when chart reloads
      setFilteredGridData([])

      // If no data, display message but don't attempt to create chart
      if (chartData.length === 0) {
        setHasData(false)
        return
      }

      const root = am5.Root.new(lineChartRef.current);
      rootRef.current = root;
      root._logo?.dispose()

      root.setThemes([am5themes_Animated.new(root)])

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "panX", // Enable 2-finger scroll (touchpad) and mouse wheel horizontal scrolling
          wheelY: "none",
          layout: root.verticalLayout,
          paddingTop: 0,
          paddingBottom: 0,
          paddingRight: 30,
        }),
      )

      // Find the highest value to set an appropriate max value
      // Consider both Equipment (line) and openCount/closeCount (bars) for max value
      const maxEquipment = Math.max(...chartData.map((item) => item.Equipment || 0))
      const maxOpenCount = Math.max(...chartData.map((item) => item.openCount || 0))
      const maxCloseCount = Math.max(...chartData.map((item) => item.closeCount || 0))
      const maxValue = Math.max(maxEquipment, maxOpenCount, maxCloseCount)
      // Add 30% more to the max value for better visualization
      const yAxisMax = Math.ceil(maxValue * 1.3)

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: 0,
          max: yAxisMax > 0 ? yAxisMax : 10, // Use default of 10 if no data
          renderer: am5xy.AxisRendererY.new(root, {
            minGridDistance: 30,
          }),
        }),
      )
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
        fontWeight: "bold",
      })

      // Determine the category field based on view mode
      const categoryField = viewMode === "yearly" ? "month" : "date"

      // Create X-axis
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: categoryField,
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
          }),
        }),
      )

      // Add Y-axis label
      yAxis.children.unshift(
        am5.Label.new(root, {
          text: "Alert Count",
          rotation: -90,
          fontSize: 12,
          fontWeight: "bold",
          fill: am5.color(0x000000),
          y: am5.p50,
          dy: 60,
          centerY: am5.p50,
          paddingRight: 10,
        }),
      )

      // Make x-axis labels clickable
      const xRenderer = xAxis.get("renderer");
      xRenderer.labels.template.setAll({
        fontSize: 10,
        paddingTop: 0,
        paddingRight: 0,
        paddingLeft: 0, // Add this to ensure no unwanted space
        inside: false,
        oversizedBehavior: "none",
        rotation: viewMode === "weekly" ? -90 : -90,
        centerX: am5.p0,
        centerY: am5.p50, // Optional, adjust vertical anchor if needed
        fill: am5.color(0x000000),
        fontWeight: "bold",
        cursorOverStyle: "pointer",
      });

      // Set data for x-axis - data is already sorted in processData
      xAxis.data.setAll(chartData)

      // Create column series for Open Alerts (bars) - base of stacked bar
      const openAlertsSeries = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: "Open Alerts (Current Day)",
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: "openCount",
          categoryXField: categoryField,
          fill: am5.color("#0EA5E9"), // Sky blue
          stroke: am5.color("#0EA5E9"),
          tooltip: am5.Tooltip.new(root, {
            labelText: "Equipment Open Alerts (Current Day): [bold]{valueY}[/]",
            forceHidden: false,
          }),
          stacked: true,
        })
      )
      openAlertsSeries.get("tooltip").label.setAll({
        fontSize: 9,
        fontWeight: "400",
      })
      openAlertsSeries.columns.template.setAll({
        maxWidth: 50,
      })

      // Create column series for Close Alerts (bars) - stacked on top
      const closeAlertsSeries = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: "Close Alerts (Current Day)",
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: "closeCount",
          categoryXField: categoryField,
          fill: am5.color("#F59E0B"), // Amber
          stroke: am5.color("#F59E0B"),
          tooltip: am5.Tooltip.new(root, {
            labelText: "Equipment Close Alerts (Current Day): [bold]{valueY}[/]",
            forceHidden: false,
          }),
          stacked: true,
        })
      )
      closeAlertsSeries.get("tooltip").label.setAll({
        fontSize: 9,
        fontWeight: "400",
      })
      closeAlertsSeries.columns.template.setAll({
        maxWidth: 50,
      })

      const wireColumnDrill = (columnSeries: am5xy.ColumnSeries, drillStatus: "Open" | "Close") => {
        columnSeries.columns.template.set("cursorOverStyle", "pointer")
        columnSeries.columns.template.events.on("click", (ev) => {
          const target = ev.target as am5.Sprite
          const dataItem = target.dataItem as am5.DataItem<am5xy.IColumnSeriesDataItem> | undefined
          const ctx = dataItem?.dataContext as DataPoint | undefined
          const tv = viewMode === "yearly" ? ctx?.month : ctx?.date
          if (tv) filterGridDataByPoint(tv, drillStatus)
        })
      }
      wireColumnDrill(openAlertsSeries, "Open")
      wireColumnDrill(closeAlertsSeries, "Close")

      // Create line series for Open Alerts Carry Count
const series = chart.series.push(
  am5xy.LineSeries.new(root, {
          name: "Open Alerts Carry Count",
    xAxis: xAxis,
    yAxis: yAxis,
    valueYField: "Equipment",
    categoryXField: categoryField,
          stroke: am5.color("#1E40AF"), // Deep navy blue
          fill: am5.color("#1E40AF"),
    tooltip: am5.Tooltip.new(root, {
            labelText: "Equipment Open Alerts Carry Count: [bold]{valueY}[/]",
      forceHidden: false,
    }),
    minBulletDistance: 10,
  })
      )
      series.get("tooltip").label.setAll({
        fontSize: 9,
        fontWeight: "400",
      })


      // Add circle bullets with click events
series.bullets.push((root, series, dataItem) => {
  // Capture dataItem in closure for reliable access
  const capturedDataItem = dataItem
 
  const circle = am5.Circle.new(root, {
    radius: 5,
    fill: am5.color("#1E40AF"),
    stroke: root.interfaceColors.get("background"),
    strokeWidth: 2,
    cursorOverStyle: "pointer",
    interactive: true, // Make bullets interactive
  })
 
  // Create a handler function that uses the captured dataItem
  const handleClick = (e: any) => {
    const target = e.target as any
    // Try multiple ways to get the dataItem
    let item = target.dataItem ||
               (target.userData && target.userData.dataItem) ||
               (e.target.parent && e.target.parent.dataItem) ||
               capturedDataItem
   
    // If still no dataItem, try to get it from the bullet's parent
    if (!item && target.parent) {
      const bullet = target.parent
      if (bullet && bullet.dataItem) {
        item = bullet.dataItem
      }
    }
   
    // Last resort: use captured dataItem
    if (!item) {
      item = capturedDataItem
    }
   
    if (item && item.dataContext) {
      const dataContext = item.dataContext as DataPoint
      const timeValue = viewMode === "yearly" ? dataContext.month : dataContext.date
      if (timeValue) {
        filterGridDataByPoint(timeValue, "Open")
      } else {
        setFilteredGridData([])
      }
    } else {
      setFilteredGridData([])
    }
  }
 
  // Add click event to filter grid data
  circle.events.on("click", handleClick)
 
  // Also add pointerdown event as a fallback for better compatibility
  circle.events.on("pointerdown", handleClick)
 
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
  return labelBullet
})

      // Always show tooltip even for zero values
series.get("tooltip").set("forceHidden", false)
      openAlertsSeries.get("tooltip").set("forceHidden", false)
      closeAlertsSeries.get("tooltip").set("forceHidden", false)
     
      // Set data for all series
series.data.setAll(chartData)
      openAlertsSeries.data.setAll(chartData)
      closeAlertsSeries.data.setAll(chartData)

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

      // Add legend at top with horizontal layout for better visibility
      const legend = chart.children.unshift(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          layout: root.horizontalLayout,
          marginTop: 0,
          marginBottom: 0,
          paddingLeft: 0,
          paddingRight: 0,
        }),
      )

      // Set legend items style with smaller font and tighter spacing
      legend.labels.template.setAll({
        fontSize: 8,
        fontWeight: "400",
        paddingRight: 0,
        paddingLeft: 0,
      })

      legend.valueLabels.template.setAll({
        fontSize: 8,
        paddingLeft: 0,
      })

      // Reduce gap between legend items
      legend.itemContainers.template.setAll({
        paddingRight: 0,
        paddingLeft: 4,
      })

      // Add background to legend for better visibility
      legend.set("background", am5.Rectangle.new(root, {
        fill: am5.color(0xffffff),
        fillOpacity: 0.8,
        stroke: am5.color(0xe0e0e0),
        strokeWidth: 1,
      }))

      // Set legend data from series
      legend.data.setAll(chart.series.values)

      // Set initial zoom to show 14 bars by default
      // Wait for data to be validated before zooming
      if (chartData.length > 14) {
        xAxis.events.once("datavalidated", () => {
          xAxis.zoomToIndexes(0, 13) // Show first 14 bars (indexes 0-13)
        })
      }

      chart.appear(1000, 100)
    }

    initChart()

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [refreshKey, viewMode, crossFilters, selectedEquipment, zoneProp, plantProp, filters])

  // Toggle chart expansion (chart only)
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  // Toggle table expansion (table only)
  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded)
  }

  // In maximized mode, fit columns to use full available width.
  useEffect(() => {
    if (!isTableExpanded || !tableGridApiRef.current) return
    const timer = window.setTimeout(() => {
      tableGridApiRef.current?.sizeColumnsToFit()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isTableExpanded, tableAlertStatus])

  // Clear chart point filter
  const clearChartFilter = () => {
    setFilteredGridData([])
  }

  // Handle view mode change
  const handleViewModeChange = (value: "weekly" | "yearly") => {
    setViewMode(value)

    if (value === "weekly") {
      const startDate = dayjs().subtract(7, "day")
      const endDate = dayjs()

      setFromMDate(startDate)
      setToMDate(endDate)

      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${startDate.format("YYYY-MM-DD")},${endDate.format("YYYY-MM-DD")}`,
      }

      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"')
        return [...filtersWithoutDate, dateFilter]
      })

      // Reset date selection flag
      setIsDateRangeSelected(false)
    } else {
      // For yearly view, remove the date filter from cross_filters
      setCrossFilters((prevFilters) => prevFilters.filter((f) => f.key !== '"DATE"'))

      // Reset date range for yearly view
      setFromMDate(null as any)
      setToMDate(null as any)
      if (onDateRangeSelect) {
        onDateRangeSelect("", "")
      }

      // Reset date selection flag
      setIsDateRangeSelected(false)
    }

    // Reset filtered grid data
    setFilteredGridData([])
    setSelectedEquipment("All Equipment");
    if (onEquipmentSelect) {
      onEquipmentSelect("All Equipment");
    }

    // Trigger a refresh
    setRefreshKey((prev) => prev + 1)
  }
const handleDeviceChange = (value: string) => {
  setSelectedDevice(value);

  // ADD THIS BLOCK - Notify parent component about device selection
  if (onDeviceSelect) {
    onDeviceSelect(value);
  }

  if (value === "All Devices") {
    // Remove device filter
    setCrossFilters((prevFilters) => {
      return prevFilters.filter((f) => f.key !== "sensor_id");
    });
  } else {
    // Add device filter
    const deviceFilter = {
      key: "sensor_id",
      cond: "equals",
      value: value,
    };

    setCrossFilters((prevFilters) => {
      const filtersWithoutDevice = prevFilters.filter((f) => f.key !== "sensor_id");
      return [...filtersWithoutDevice, deviceFilter];
    });
  }

  // Reset filtered grid data
  setFilteredGridData([]);

  // Trigger a refresh
  setRefreshKey((prev) => prev + 1);
};

  useEffect(() => {
    const setupMirrorScrollbar = (wrapEl: HTMLDivElement | null) => {
      if (!wrapEl) return () => {}

      const viewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null
      if (!viewport) return () => {}

      const mirrorHost =
        (wrapEl.querySelector(".ag-root-wrapper-body") as HTMLElement | null) ?? wrapEl
      mirrorHost.style.position = "relative"

      const existingMirror = mirrorHost.querySelector(".tas-h-scroll-mirror")
      if (existingMirror) existingMirror.remove()

      const mirror = document.createElement("div")
      mirror.className = "tas-h-scroll-mirror"
      Object.assign(mirror.style, {
        position: "absolute",
        left: "8px",
        right: "8px",
        bottom: "4px",
        height: "8px",
        background: "#e2e8f0",
        borderRadius: "8px",
        zIndex: "5",
        cursor: "pointer",
        userSelect: "none",
      })

      const thumb = document.createElement("div")
      Object.assign(thumb.style, {
        position: "absolute",
        top: "0.5px",
        bottom: "0.5px",
        left: "0px",
        minWidth: "40px",
        background: "#94a3b8",
        borderRadius: "8px",
      })

      mirror.appendChild(thumb)
      mirrorHost.appendChild(mirror)

      const sync = () => {
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        const trackWidth = mirror.clientWidth
        const thumbWidth = maxScroll <= 0 ? trackWidth : Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth)
        const movable = Math.max(1, trackWidth - thumbWidth)
        const left = maxScroll <= 0 ? 0 : (viewport.scrollLeft / maxScroll) * movable
        thumb.style.width = `${thumbWidth}px`
        thumb.style.left = `${left}px`
      }

      const onViewportScroll = () => sync()
      viewport.addEventListener("scroll", onViewportScroll, { passive: true })

      const onTrackClick = (e: MouseEvent) => {
        if (e.target === thumb) return
        const rect = mirror.getBoundingClientRect()
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        if (maxScroll <= 0) return
        const trackWidth = mirror.clientWidth
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth)
        const movable = Math.max(1, trackWidth - thumbWidth)
        const x = e.clientX - rect.left
        const ratio = Math.max(0, Math.min(1, (x - thumbWidth / 2) / movable))
        viewport.scrollLeft = ratio * maxScroll
      }

      const onThumbMouseDown = (e: MouseEvent) => {
        e.preventDefault()
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        if (maxScroll <= 0) return
        const trackWidth = mirror.clientWidth
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth)
        const movable = Math.max(1, trackWidth - thumbWidth)
        const startX = e.clientX
        const startScroll = viewport.scrollLeft

        const onMove = (ev: MouseEvent) => {
          const dx = ev.clientX - startX
          viewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll))
        }
        const onUp = () => {
          document.removeEventListener("mousemove", onMove)
          document.removeEventListener("mouseup", onUp)
        }

        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
      }

      mirror.addEventListener("click", onTrackClick)
      thumb.addEventListener("mousedown", onThumbMouseDown)

      const ro = new ResizeObserver(sync)
      ro.observe(viewport)
      ro.observe(mirror)
      window.addEventListener("resize", sync)
      requestAnimationFrame(sync)

      return () => {
        viewport.removeEventListener("scroll", onViewportScroll)
        mirror.removeEventListener("click", onTrackClick)
        thumb.removeEventListener("mousedown", onThumbMouseDown)
        ro.disconnect()
        window.removeEventListener("resize", sync)
        mirror.remove()
      }
    }

    const cleanupNormal = setupMirrorScrollbar(normalTableWrapRef.current)

    return () => {
      cleanupNormal()
    }
  }, [isTableExpanded, gridData, filteredGridData, viewMode, tableAlertStatus])

  const equipmentTabOptions = ["All Equipment", ...equipmentOptions]
  const activeEquipmentTabIndex =
    selectedEquipment === "All Equipment"
      ? 0
      : Math.max(0, equipmentOptions.indexOf(selectedEquipment) + 1)

  return (
    <div className="flex flex-col gap-2 p-1">
      {/* Hide AG Grid native horizontal bar; keep only custom mirror bar */}
      <style>{`
        .tas-maintenance-table-wrap .ag-body-horizontal-scroll {
          display: none !important;
          height: 0 !important;
          min-height: 0 !important;
        }
        .tas-maintenance-table-wrap .ag-paging-panel {
          position: relative;
          z-index: 20;
          background: #fff;
        }
        .tas-maintenance-table-wrap .ag-popup,
        .tas-maintenance-table-wrap .ag-picker-field-wrapper,
        .tas-maintenance-table-wrap .ag-select-list {
          z-index: 40 !important;
        }
      `}</style>
        {isExpanded && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleExpand} />}
      {isTableExpanded && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleTableExpand} />
      )}

      {/* Equipment tabs and filters in the same row – horizontal scroll when more than ~7 tabs */}
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center gap-2 w-full border-b border-gray-200 pb-1 ">
          <div className="overflow-x-auto overflow-y-hidden flex-1 min-w-0 py-0.5" role="tablist">
            <div className="flex flex-nowrap gap-1.5 min-h-0 w-max">
            {equipmentTabOptions.map((equipment, index) => {
              const isActive = activeEquipmentTabIndex === index
              return (
                <button
                  key={equipment}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleEquipmentChange(equipmentTabOptions[index] ?? "All Equipment")}
                  className={`min-w-[100px] w-[100px] max-w-[100px] px-3 py-2 text-xs font-semibold leading-tight transition-all rounded-full min-h-[20px] flex items-center justify-center truncate shrink-0 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm ring-2 ring-offset-1 ring-blue-400"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                          {equipment}
                </button>
              )
            })}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap ml-auto shrink-0">
                  {/* All Devices dropdown - commented out */}
                  {/* <Select value={selectedDevice || "All Devices"} onValueChange={handleDeviceChange}>
                    <SelectTrigger className="w-[120px] h-7 text-xs">
                      <SelectValue placeholder="Select Device" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem className="text-xs" value="All Devices">
                        All Devices
                      </SelectItem>
                      {deviceOptions.map((device) => (
                        <SelectItem key={device} className="text-xs" value={device}>
                          {device}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select> */}
                  <Select value={viewMode} onValueChange={handleViewModeChange}>
                    <SelectTrigger className="w-[100px] h-7 text-xs">
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem className="text-xs" value="yearly">
                        Monthly
                      </SelectItem>
                      <SelectItem className="text-xs" value="weekly">
                        Weekly
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {viewMode !== "weekly" ? (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <DateRangePickerFilter
                              fromDate={fromMDate}
                              toDate={toMDate}
                              onApply={handleDateApply}
                              disabled
                              maxDate={dayjs()}
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[250px]">
                          Day-wise data is  available for weekly view.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <DateRangePickerFilter
                      fromDate={fromMDate}
                      toDate={toMDate}
                      onApply={handleDateApply}
                      disabled={isLoading}
                      maxDate={dayjs()}
                    />
                  )}
<Button
  onClick={handleDownloadExcel}
  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
  disabled={isDownloading || isLoading || !hasData}
  title="Download Excel"
>
  {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
</Button>
                  <Button
                    onClick={handleRefresh}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
          </div>
        </div>

      {/* Chart and table always visible – data updates by selected equipment tab */}
      <div className="flex gap-1 h-[420px]">
        <div className={`${isTableExpanded ? "hidden" : "w-1/2"} flex flex-col min-h-0`}>
          <Card
            className={`flex flex-col h-full min-h-0 transition-all duration-300 ${isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""}`}
          >
            <CardHeader className="pb-0 p-1 pt-1 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-xs font-bold text-gray-800">Equipment Usage Analysis</CardTitle>
                <Button
                  onClick={toggleExpand}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title={isExpanded ? "Minimize chart" : "Maximize chart"}
                >
                  {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 relative flex-1 min-h-0">
            {isTransitioning && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {(error || (!hasData && !isTransitioning)) && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                {/* <p>No Data Available</p> */}
              </div>
            )}

            <div
              ref={lineChartRef}
              style={{
                width: "100%",
                height: isExpanded ? "calc(100vh - 8rem)" : "100%",
                minHeight: "320px",
              }}
            />

          </CardContent>
        </Card>
      </div>

      <div className={`${isTableExpanded ? "w-full" : "w-1/2"} flex flex-col min-h-0`}>
        <Card
          className={`relative flex flex-col h-full min-h-0 transition-all duration-300 ${isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""}`}
        >
          {(isTransitioning || isLoading) && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/80 rounded-md"
              aria-busy="true"
              aria-label="Loading equipment analysis"
            >
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-xs font-medium text-gray-600">Loading...</span>
            </div>
          )}
          <CardHeader className="pb-0 p-2 shrink-0">

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <CardTitle className="text-xs font-bold text-gray-800 truncate">
                  {viewMode === "yearly" ? "Monthly Equipment Analysis" : "Equipment Weekly Analysis"}
                  {selectedEquipment !== "All Equipment" && ` - Equipment: ${selectedEquipment}`}
                  {filteredGridData.length > 0 &&
                    ` - ${viewMode === "yearly" ? "Month" : "Date"}: ${viewMode === "yearly" ? filteredGridData[0].month : filteredGridData[0].date}`}
                </CardTitle>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex text-gray-500 hover:text-gray-700 shrink-0 cursor-pointer" aria-label="Info">
                        <Info className="w-3.5 h-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                      <p className="mb-2">If an alert is not closed on the same day, it moves to the next day and is called a carry forward alert.</p>
                      <p className="font-semibold mb-1">Carry Forward Count:</p>
                      <ul className="list-none space-y-0.5 pl-0">
                        <li>1 = Alert not closed</li>
                        <li>0 = Alert closed</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold ${tableAlertStatus === "Open" ? "text-red-700" : "text-green-700"}`}>
                  {tableAlertStatus}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tableAlertStatus === "Open"}
                  onClick={() => setTableAlertStatus((prev) => (prev === "Open" ? "Close" : "Open"))}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 shadow-sm ${
                    tableAlertStatus === "Open"
                      ? "bg-red-700 focus:ring-red-600 border border-red-800"
                      : "bg-green-700 focus:ring-green-600 border border-green-800"
                  }`}
                  title={tableAlertStatus}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                      tableAlertStatus === "Open" ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <Button
                  onClick={toggleTableExpand}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                  title={isTableExpanded ? "Minimize table" : "Maximize table"}
                >
                  {isTableExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0 flex-1 min-h-0 flex flex-col">
            <div
              ref={normalTableWrapRef}
              className="tas-maintenance-table-wrap ag-theme-alpine flex-1 min-h-0"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "100%",
                minHeight: "320px",
                width: "100%",
              }}
            >
              <AgGridReact
                columnDefs={columnDefs}
                rowData={(filteredGridData.length > 0 ? filteredGridData : gridData).filter((row) => {
                  // When a specific bar is clicked, filter by alert status tab
                  if (isChartPointFilterActive) {
                    return tableAlertStatus === "Close"
                      ? (row.type || "").toLowerCase() === "closed"
                      : (row.type || "").toLowerCase() !== "closed"
                  }
                  return tableAlertStatus === "Open"
                    ? (row.type || "").toLowerCase() === "carry_forward"
                    : (row.type || "").toLowerCase() === "closed"
                })}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  wrapHeaderText: true,
                  autoHeaderHeight: true,
                }}
                pagination={true}
                paginationPageSize={20}
                enableCellTextSelection={true}
                suppressCellFocus={true}
                domLayout="normal"
                headerHeight={20}
                rowHeight={25}
                suppressMovableColumns={false}
                suppressContextMenu={true}
                suppressMenuHide={true}
                suppressRowClickSelection={false}
                onRowClicked={handleRowClick}
                onGridReady={(params) => {
                  tableGridApiRef.current = params.api
                }}
                onGridSizeChanged={() => {
                  if (isTableExpanded) {
                    tableGridApiRef.current?.sizeColumnsToFit()
                  }
                }}
                rowSelection="single"
                alwaysShowHorizontalScroll={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
      </div>
    </div>
  );
}
