

"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import { Button } from "../../../@/components/ui/button"
import { Input } from "../../../@/components/ui/input"
import { RefreshCw, MoreVertical, Filter, Download } from "lucide-react"
import DataGrid from "../../../components/common/DataGrid"
import { convertUTCDateToLocalDate, formatRelativeTime } from "@/hooks/useRelativeTime"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import AlertHistoryDialogV2 from "./AlertHistoryDialogV2"
import * as XLSX from 'xlsx';
interface ROAlertsTableV2Props {
  query?: string
  onLocationChange?: (locationId: string) => void
onAlertStatusChange?: (status: "Open" | "Close" | "All") => void
  zone?: string | null
  plant?: string | null
  /** Full tas_maintenance_fault response from TASMaintenanceChart (`data.data` rows). */
  maintenanceData?: any
  /** Show loading overlay while Equipment Usage Analysis chart is fetching. */
  externalLoading?: boolean
}

interface HistoryDialogState { 
  isOpen: boolean
  alertId: string | number | null
}

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

const matchesMaintenanceSearchText = (row: Record<string, unknown>, searchText: string) => {
  const searchLower = searchText.toLowerCase()
  return Object.values(row).some((val) => {
    if (val === null || val === undefined) return false
    if (typeof val === "object") return false
    return String(val).toLowerCase().includes(searchLower)
  })
}

// Helper function to calculate duration between dates
const calculateDuration = (startDate: string, endDate: string): string => {
  try {
    if (!startDate || !endDate) return "-"

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-"

    // If end date is before start date, return invalid
    if (end < start) return "Invalid date range"

    const diff = end.getTime() - start.getTime()

    // Convert to appropriate time units
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h`
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60
      return `${hours}h ${remainingMinutes}m`
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  } catch (error) {
    console.error("Error calculating duration:", error)
    return "-"
  }
}

const getDynamicDateRangeForCrossFilter = (queryString: string): { fromDate: string; toDate: string } => {
  const today = new Date().toISOString().slice(0, 10)

  if (!queryString) {
    return { fromDate: today, toDate: today }
  }

  // Supports both:
  // 1) created_at::DATE BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'
  // 2) created_at::DATE = 'YYYY-MM-DD'
  const betweenMatch = queryString.match(
    /created_at::DATE\s+BETWEEN\s+['"]([\d-]+)['"]\s+AND\s+['"]([\d-]+)['"]/i,
  )
  if (betweenMatch?.[1] && betweenMatch?.[2]) {
    return { fromDate: betweenMatch[1], toDate: betweenMatch[2] }
  }

  const equalsMatch = queryString.match(/created_at::DATE\s*=\s*['"]([\d-]+)['"]/i)
  if (equalsMatch?.[1]) {
    return { fromDate: equalsMatch[1], toDate: equalsMatch[1] }
  }

  return { fromDate: today, toDate: today }
}

const isChartPointDateQuery = (queryString: string) =>
  /created_at::DATE\s*=\s*['"][\d-]+['"]/i.test(queryString || "")

const matchesMaintenanceAlertStatus = (
  row: { type?: string; alert_status?: string },
  status: "Open" | "Close" | "All",
  chartPointFilterActive: boolean,
) => {
  const type = (row.type || "").toLowerCase()
  if (status === "All") return true
  if (status === "Close") return type === "closed"
  if (chartPointFilterActive) return type !== "closed"
  return type === "carry_forward"
}

const normalizeMaintenanceRow = (raw: any) => ({
  ...raw,
  // Keep previous header fields compatible with existing columns.
  id: raw?.id ?? raw?.alert_id ?? `${raw?.sap_id ?? ""}-${raw?.created_at ?? ""}-${raw?.interlock_name ?? ""}`,
  alert_status: raw?.alert_status ?? (raw?.type === "carry_forward" ? "Open" : raw?.type === "closed" ? "Close" : "-"),
  created_at: raw?.created_at ?? raw?.created_date ?? null,
  closed_at: raw?.closed_at ?? raw?.till_date ?? null,
  moc_status: raw?.action_type ?? "-",
  moc_duration: raw?.maintenance_days ?? "-",
  actual_duration: raw?.actual_duration ?? "-",
})

const isDateKeyInRange = (dateKey: string, fromDate: string, toDate: string) => {
  const normalizedKey = String(dateKey).split("T")[0]

  const toISODate = (str: string) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str
    const monthMatch = str.match(/^([A-Za-z]{3})-(\d{4})$/)
    if (monthMatch) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const monthIndex = monthNames.indexOf(monthMatch[1])
      if (monthIndex !== -1) {
        return `${monthMatch[2]}-${String(monthIndex + 1).padStart(2, "0")}`
      }
    }
    return str
  }

  const isoKey = toISODate(normalizedKey)
  const isoFrom = toISODate(fromDate)
  const isoTo = toISODate(toDate)

  const compare = (a: string, b: string) => {
    if (a.length === b.length) return a === b ? 0 : a > b ? 1 : -1
    if (a.length === 10 && b.length === 7) {
      if (a.startsWith(b)) return 0
      return a > b ? 1 : -1
    }
    if (a.length === 7 && b.length === 10) {
      if (b.startsWith(a)) return 0
      return a > b ? 1 : -1
    }
    return a === b ? 0 : a > b ? 1 : -1
  }

  return compare(isoKey, isoFrom) >= 0 && compare(isoKey, isoTo) <= 0
}

const isDateBucketKey = (key: string) =>
  /^\d{4}-\d{2}-\d{2}/.test(String(key)) || /^[A-Za-z]{3}-\d{4}$/.test(String(key))

const isMaintenanceDayBlock = (dayBlock: unknown): dayBlock is Record<string, any> => {
  if (!dayBlock || typeof dayBlock !== "object" || Array.isArray(dayBlock)) return false
  return Object.values(dayBlock as Record<string, any>).some(
    (value) =>
      Array.isArray(value) ||
      (value && typeof value === "object" && Array.isArray(value.Equipment?.details)),
  )
}

const appendRowsFromDayBlock = (dayBlock: Record<string, any>, rows: any[]) => {
  Object.values(dayBlock).forEach((categoryData) => {
    if (Array.isArray(categoryData)) {
      categoryData.forEach((item) => rows.push(normalizeMaintenanceRow(item)))
    } else if (
      categoryData &&
      typeof categoryData === "object" &&
      Array.isArray(categoryData.Equipment?.details)
    ) {
      categoryData.Equipment.details.forEach((item: any) => rows.push(normalizeMaintenanceRow(item)))
    }
  })
}

/** Lower table rows: date → Process/Safety alert rows from `data.data` or search `data`. */
const getMaintenanceDateBuckets = (responseData: any): Record<string, any> | null => {
  if (!responseData || typeof responseData !== "object") return null

  const candidates = [responseData.data?.data, responseData.data].filter(
    (source): source is Record<string, unknown> =>
      !!source && typeof source === "object" && !Array.isArray(source),
  )

  for (const record of candidates) {
    const hasDateBuckets = Object.entries(record).some(
      ([key, value]) => isDateBucketKey(key) && isMaintenanceDayBlock(value),
    )
    if (hasDateBuckets) return record as Record<string, any>
  }

  return null
}

const extractRowsFromMaintenanceData = (
  responseData: any,
  dateRange?: { fromDate: string; toDate: string },
) => {
  const rows: any[] = []
  const dateBuckets = getMaintenanceDateBuckets(responseData)
  if (!dateBuckets) return rows

  Object.entries(dateBuckets).forEach(([dateKey, dayBlock]) => {
    if (dateKey === "summary") {
      if (isMaintenanceDayBlock(dayBlock)) {
        appendRowsFromDayBlock(dayBlock, rows)
      }
      return
    }

    if (!isDateBucketKey(dateKey) || !isMaintenanceDayBlock(dayBlock)) return
    if (
      dateRange?.fromDate &&
      dateRange?.toDate &&
      !isDateKeyInRange(dateKey, dateRange.fromDate, dateRange.toDate)
    ) {
      return
    }
    appendRowsFromDayBlock(dayBlock, rows)
  })

  return rows
}

export const MaintenanceTable: React.FC<ROAlertsTableV2Props> = ({
  query,
  onLocationChange,
  onAlertStatusChange,
  zone,
  plant,
  maintenanceData,
  externalLoading = false,
}) => {
  const [pageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [searchText, setSearchText] = useState<string>("")
  const debouncedSearchText = useDebounce(searchText, 300)
  const [alertStatusFilter, setAlertStatusFilter] = useState<"Open" | "Close" | "All">("All");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "zone",
    "location_name",
    "sap_id",
    "alert_category",
    "device_name",
    "sensor_id",
    "interlock_name",
    "start_date",
    "moc_status",
    "moc_duration",
    "end_date",
    "actual_duration",
    "alert_status",
    "actions",
    "equipment_name",
  ])
  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null,
  })
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sapIdFilterFromTable, setSapIdFilterFromTable] = useState(false)
  const [totalRowCount, setTotalRowCount] = useState<number | null>(null)
  const gridApi = React.useRef<any>(null)
  const tableWrapRef = React.useRef<HTMLDivElement | null>(null)
  const rowsCacheRef = React.useRef<{ key: string; rows: any[] } | null>(null)
  const skipFilterRefreshOnMountRef = React.useRef(true)
  const showLoadingOverlay = isLoading || externalLoading

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId,
    })
  }, [])

const handleAlertStatusToggle = useCallback(() => {
  setAlertStatusFilter((prev) => {
    const newStatus: "Open" | "Close" | "All" =
      prev === "All" ? "Open" : prev === "Open" ? "Close" : "All";
    if (onAlertStatusChange) onAlertStatusChange(newStatus);
    return newStatus;
  });
}, [onAlertStatusChange])

  useEffect(() => {
    if (onAlertStatusChange) onAlertStatusChange(alertStatusFilter);
  }, []);

  // Function to build the complete query with filters (payload like SafetyProcessGantryTable)
  const buildQueryWithFilters = useCallback(
    (baseQuery: string) => {
      let completeQuery = baseQuery || ""

      if (alertStatusFilter !== "All") {
        const alertStatusQuery = `alert_status='${alertStatusFilter}'`;
        completeQuery = completeQuery ? `${completeQuery} AND ${alertStatusQuery}` : alertStatusQuery;
      }

      // Only add zone/plant filters if they're not already in the base query
      if (zone && zone !== "all" && !completeQuery.includes(`zone='${zone}'`)) {
        completeQuery += completeQuery ? ` AND zone='${zone}'` : `zone='${zone}'`
      }

      if (plant && plant !== "all" && !completeQuery.includes(`sap_id='${plant}'`)) {
        completeQuery += completeQuery ? ` AND sap_id='${plant}'` : `sap_id='${plant}'`
      }

      return completeQuery
    },
    [zone, plant, alertStatusFilter],
  )

  const getRowsCacheKey = useCallback(() => {
    const completeQuery = buildQueryWithFilters(query || "")
    return JSON.stringify({
      completeQuery,
      alertStatusFilter,
      zone,
      plant,
      maintenanceData,
      searchText: debouncedSearchText.trim(),
    })
  }, [query, buildQueryWithFilters, alertStatusFilter, zone, plant, maintenanceData, debouncedSearchText])

  const clearRowsCache = useCallback(() => {
    rowsCacheRef.current = null
  }, [])

  const loadAllRows = useCallback((): any[] => {
    const cacheKey = getRowsCacheKey()
    if (rowsCacheRef.current?.key === cacheKey) {
      return rowsCacheRef.current.rows
    }

    const completeQuery = buildQueryWithFilters(query || "")
    const { fromDate, toDate } = getDynamicDateRangeForCrossFilter(completeQuery)
    const shouldApplyDateFilter = /created_at::DATE/i.test(completeQuery)

    if (!maintenanceData) {
      rowsCacheRef.current = { key: cacheKey, rows: [] }
      return []
    }

    let rows: any[] = extractRowsFromMaintenanceData(
      maintenanceData,
      shouldApplyDateFilter && fromDate && toDate ? { fromDate, toDate } : undefined,
    )

    if (alertStatusFilter !== "All") {
      const chartPointFilterActive = isChartPointDateQuery(completeQuery)
      rows = rows.filter((row) =>
        matchesMaintenanceAlertStatus(row, alertStatusFilter, chartPointFilterActive),
      )
    }

    if (debouncedSearchText.trim()) {
      rows = rows.filter((row) => matchesMaintenanceSearchText(row, debouncedSearchText.trim()))
    }

    rowsCacheRef.current = { key: cacheKey, rows }
    return rows
  }, [
    getRowsCacheKey,
    buildQueryWithFilters,
    query,
    maintenanceData,
    alertStatusFilter,
    debouncedSearchText,
  ])

  const fetchData = useCallback(
    async (startRow: number, endRow: number, sortModel?: any) => {
      const isCacheHit = rowsCacheRef.current?.key === getRowsCacheKey()
      if (!isCacheHit && !externalLoading) setIsLoading(true)
      try {
        const currentPageNumber = Math.floor(startRow / pageSize)
        let rows = loadAllRows()

        if (sortModel?.length) {
          const { colId, sort } = sortModel[0]
          rows = [...rows].sort((a, b) => {
            const aVal = a?.[colId]
            const bVal = b?.[colId]
            if (aVal == null && bVal == null) return 0
            if (aVal == null) return 1
            if (bVal == null) return -1
            const aStr = String(aVal).toLowerCase()
            const bStr = String(bVal).toLowerCase()
            const cmp = aStr > bStr ? 1 : aStr < bStr ? -1 : 0
            return sort === "desc" ? -cmp : cmp
          })
        }
        setCurrentPage(currentPageNumber)
        const total = Array.isArray(rows) ? rows.length : 0
        setTotalRowCount(total)

        return {
          data: Array.isArray(rows) ? rows.slice(startRow, endRow) : [],
          lastRow: total,
        }
      } catch (err) {
        console.error("Error loading maintenance rows:", err)
        throw err
      } finally {
        if (!isCacheHit && !externalLoading) setIsLoading(false)
      }
    },
    [getRowsCacheKey, loadAllRows, pageSize, externalLoading],
  )

  const dataSource = useMemo(
    () => ({
      getRows: async (params: any) => {
        try {
          const result = await fetchData(params.startRow, params.endRow, params.sortModel)
          params.successCallback(result.data, result.lastRow)
        } catch (err) {
          params.failCallback()
        }
      },
    }),
    [fetchData],
  )

  // Reset sapIdFilterFromTable flag when plant changes from outside (not from table click)
  useEffect(() => {
    // If plant becomes null or "all", reset the flag
    if (!plant || plant === "all") {
      setSapIdFilterFromTable(false)
    }
  }, [plant])

  // Refresh grid when filters or shared chart API data changes
  useEffect(() => {
    if (skipFilterRefreshOnMountRef.current && !maintenanceData) {
      skipFilterRefreshOnMountRef.current = false
      return
    }
    skipFilterRefreshOnMountRef.current = false

    clearRowsCache()
    setTotalRowCount(null)
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache()
      setCurrentPage(0)
    }
  }, [zone, plant, query, alertStatusFilter, maintenanceData, debouncedSearchText, clearRowsCache])

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api
    params.api.sizeColumnsToFit()
  }, [])

  useEffect(() => {
    const setupMirrorScrollbar = (wrapEl: HTMLDivElement | null) => {
      if (!wrapEl) return () => {}

      const viewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null
      if (!viewport) return () => {}

      const mirrorHost =
        (wrapEl.querySelector(".ag-root-wrapper-body") as HTMLElement | null) ?? wrapEl
      mirrorHost.style.position = "relative"

      const existingMirror = mirrorHost.querySelector(".maintenance-h-scroll-mirror")
      if (existingMirror) existingMirror.remove()

      const mirror = document.createElement("div")
      mirror.className = "maintenance-h-scroll-mirror"
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

    let cleanup = () => {}
    let retries = 0
    const maxRetries = 10
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const trySetup = () => {
      cleanup()
      cleanup = setupMirrorScrollbar(tableWrapRef.current)
      if (retries < maxRetries && tableWrapRef.current && !tableWrapRef.current.querySelector(".maintenance-h-scroll-mirror")) {
        retries += 1
        retryTimer = setTimeout(trySetup, 120)
      }
    }

    trySetup()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      cleanup()
    }
  }, [showLoadingOverlay, totalRowCount, selectedColumns])

  const handleRefresh = useCallback(async () => {
    if (gridApi.current) {
      setIsRefreshing(true)
      setTotalRowCount(null)
      try {
        // If sap_id filter was set from table click, remove it on refresh
        if (sapIdFilterFromTable && onLocationChange) {
          onLocationChange(null) // Clear the sap_id filter
          setSapIdFilterFromTable(false) // Reset the flag
        }
        
        await new Promise(resolve => {
          gridApi.current.refreshInfiniteCache()
          // Add a small delay to ensure the refresh animation is visible
          setTimeout(resolve, 500)
        })
        setSearchText("")
        setCurrentPage(0) // Reset to first page on refresh
        toast.success("Data refreshed successfully")
      } catch (error) {
        console.error("Error during refresh:", error)
        toast.error("Failed to refresh data")   
      } finally {
        setIsRefreshing(false)
      }
    }
  }, [sapIdFilterFromTable, onLocationChange])  

  const handleLocationClick = useCallback(
    (sapId: string) => {
      if (onLocationChange) {
        setSapIdFilterFromTable(true) // Mark that filter was set from table click
        onLocationChange(sapId)
      } else {
        navigate(`/location/${sapId}`)
      }
    },
    [onLocationChange, navigate],
  )

  // Get button text and styling based on current filter status
  const getToggleButtonConfig = () => {
    switch (alertStatusFilter) {
      case "Open":
        return {
          text: "Open Alerts",
          variant: "default" as const,
          className: "bg-red-600 hover:bg-red-700 text-white"
        }
      case "Close":
        return {
          text: "Closed Alerts",
          variant: "default" as const,
          className: "bg-green-600 hover:bg-green-700 text-white"
        }
    }
  }

  const toggleConfig = getToggleButtonConfig()

  // Column Definitions
  const columnDefs = useMemo(
    () => [
      {
        headerName: "Zone",
        field: "zone",
        sortable: true,
        minWidth: 110,
        filter: true,
        hide: !selectedColumns.includes("zone"),
      },
      {
        headerName: "Plant",
        field: "location_name",
        sortable: true,
        minWidth: 110,
        filter: true,
        cellRenderer: (params: any) => (
          <span
            className="text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => handleLocationClick(params.data.sap_id)}
          >
            {params.value}
          </span>
        ),
        hide: !selectedColumns.includes("location_name"),
      },
      {
        headerName: "SAP ID",
        field: "sap_id",
        sortable: true,
        minWidth: 130,
        filter: true,
        cellRenderer: (params: any) => (
          <span
            className="text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => handleLocationClick(params.value)}
          >
            {params.value}
          </span>
        ),
        hide: !selectedColumns.includes("sap_id"),
      },
      {
        headerName: "System",
        field: "alert_category",
        minWidth: 110,
        sortable: true,
        filter: true,
        hide: !selectedColumns.includes("alert_category"),
      },
      {
        headerName: "Equipment",
        field: "device_name",
        minWidth: 150,
        sortable: true,
        filter: true,
        hide: !selectedColumns.includes("device_name"),
        valueFormatter: (params) => params.value?.split("@")[0] || "",
      },
      {
        headerName: "equipment_name",
        field: "equipment_name",
        minWidth: 150,
        sortable: true,
        filter: true,
        hide: !selectedColumns.includes("equipment_name"),
      },      {
        headerName: "Device ID",
        field: "sensor_id",
        minWidth: 150,
        sortable: true,
        filter: true,
        hide: !selectedColumns.includes("sensor_id"),
      },
      {
        headerName: "Alert Type",
        field: "interlock_name",
        sortable: true,
        minWidth: 150,
        filter: true,
        hide: !selectedColumns.includes("interlock_name"),
        cellRenderer: (params: any) => {
          const value = params.value || ""
          const displayValue = value.toLowerCase().trim().endsWith("maintenance") ? "Maintenance" : "Fault"
          return <span>{displayValue}</span>
        },
      },
      {
        headerName: "Alert Status",
        field: "alert_status",
        minWidth: 150,
        sortable: true,
        filter: true,
        hide: !selectedColumns.includes("alert_status"),
        cellRenderer: (params: any) => <span>{params.value || "-"}</span>,

      },
      {
        headerName: "Start Date for maintenance or Fault",
        field: "created_at",
        sortable: true,
        minWidth: 240,
        filter: true,
        comparator: (valueA: any, valueB: any) => {
          // Handle null/undefined values
          if (!valueA && !valueB) return 0
          if (!valueA) return 1
          if (!valueB) return -1

          // Convert to Date objects for comparison
          const dateA = new Date(valueA).getTime()
          const dateB = new Date(valueB).getTime()

          // Handle invalid dates
          if (isNaN(dateA) && isNaN(dateB)) return 0
          if (isNaN(dateA)) return 1
          if (isNaN(dateB)) return -1

          return dateA - dateB
        },
        cellRenderer: (params: any) => {
          if (!params.value) return "-"
          try {
            // Convert UTC to local time
            const utcDate = new Date(params.value)
            const localDate = convertUTCDateToLocalDate(utcDate)

            // Format the absolute time using the converted local date
            const formattedDateTime = localDate.toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })

            // Get the relative time (already handles UTC conversion internally)
            const relativeTime = formatRelativeTime(params.value)

            // Return both times in a stacked layout
            return (
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">{relativeTime}</span>
                <span className="text-xs text-gray-500">{formattedDateTime}</span>
              </div>
            )
          } catch (error) {
            console.error("Error formatting date:", error)
            return "Invalid date"
          }
        },
        hide: !selectedColumns.includes("start_date"),
      },
      {
        headerName: "MOC Status",
        field: "moc_status",
        sortable: true,
        minWidth: 130,
        filter: true,
        cellRenderer: (params: any) => <span>{params.data?.action_type ?? params.value ?? "-"}</span>,
        hide: !selectedColumns.includes("moc_status"),
      },
      {
        headerName: "MOC Duration as per approval",
        field: "moc_duration",
        sortable: true,
        minWidth: 220,
        filter: true,
        cellRenderer: (params: any) => <span>{params.data?.maintenance_days ?? params.value ?? "-"}</span>,
        hide: !selectedColumns.includes("moc_duration"),
      },
      {
        headerName: "End Date for maintenance/Fault",
        field: "closed_at",
        sortable: true,
        minWidth: 240,
        filter: true,
        comparator: (valueA: any, valueB: any) => {
          // Handle null/undefined values
          if (!valueA && !valueB) return 0
          if (!valueA) return 1
          if (!valueB) return -1

          // Convert to Date objects for comparison
          const dateA = new Date(valueA).getTime()
          const dateB = new Date(valueB).getTime()

          // Handle invalid dates
          if (isNaN(dateA) && isNaN(dateB)) return 0
          if (isNaN(dateA)) return 1
          if (isNaN(dateB)) return -1

          return dateA - dateB
        },
        cellRenderer: (params: any) => {
          if (!params.value) return "-"
          try {
            // Convert UTC to local time
            const utcDate = new Date(params.value)
            const localDate = convertUTCDateToLocalDate(utcDate)

            // Format the absolute time using the converted local date
            const formattedDateTime = localDate.toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })

            // Get the relative time (already handles UTC conversion internally)
            const relativeTime = formatRelativeTime(params.value)

            // Return both times in a stacked layout
            return (
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">{relativeTime}</span>
                <span className="text-xs text-gray-500">{formattedDateTime}</span>
              </div>
            )
          } catch (error) {
            console.error("Error formatting date:", error)
            return "Invalid date"
          }
        },
        hide: !selectedColumns.includes("end_date"),
      },
      {
        headerName: "Actual Duration under maintenance/Fault status",
        field: "actual_duration",
        sortable: true,
        minWidth: 300,
        filter: true,
        cellRenderer: (params: any) => {
          const createdAt = params?.data?.created_at
          const closedAt = params?.data?.closed_at
          if (!createdAt || !closedAt) return <span>-</span>
          return <span>{calculateDuration(createdAt, closedAt)}</span>
        },
        hide: !selectedColumns.includes("actual_duration"),
      },
      {
        headerName: "Actions",
        field: "actions",
        sortable: false,
        filter: false,
        width: 100,
        pinned: "right",
        cellRenderer: (params: any) => {
          const alertId = params?.data?.id
          if (!alertId) return null
          return (
            <div className="text-right">
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => handleViewHistory(alertId)}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          )
        },
        hide: !selectedColumns.includes("actions"),
      },
    ],
    [selectedColumns, handleViewHistory, handleLocationClick],
  )

const [isDownloading, setIsDownloading] = useState(false);
const [selectedInterlock, setSelectedInterlock] = useState<string>(''); // Add if not already present

// Add this function after your existing useCallback functions
const fetchAllDataForExport = useCallback(async () => {
  return loadAllRows()
}, [loadAllRows]);
const handleExcelExport = useCallback(async () => {
  setIsDownloading(true);
  try {
    const allData = await fetchAllDataForExport();

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Create worksheet data with heading and filters
    const worksheetData = [];

    // Add main heading with timestamp
    const currentDateTime = new Date();
    const formattedDateTime = currentDateTime.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
    const formattedDateForTitle = currentDateTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const formattedTimeForTitle = currentDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    worksheetData.push([`MAINTENANCE ALERTS REPORT - ${formattedDateForTitle} at ${formattedTimeForTitle}`]);
    worksheetData.push([]); // Empty row for spacing

    // Add generation info
    worksheetData.push(['Total Records Exported:', allData.length]);
    worksheetData.push([]); // Empty row for spacing

    // Function to extract and format date range from query
    const extractDateRangeFromQuery = (queryString) => {
      if (!queryString) return null;
      
      try {
        // Specific pattern for your date format: created_at::DATE BETWEEN '2025-03-01' AND '2025-06-24'
        const betweenPattern = /created_at::DATE\s+BETWEEN\s+['"]([\d-]+)[']\s+AND\s+['"]([\d-]+)['"]|DATE\(created_at\)\s+BETWEEN\s+['"]([\d-]+)[']\s+AND\s+['"]([\d-]+)['"]|created_at\s+BETWEEN\s+['"]([\d-]+)[']\s+AND\s+['"]([\d-]+)['"]/gi;
        
        const match = betweenPattern.exec(queryString);
        
        if (match) {
          // Extract the dates from the match groups
          const startDate = match[1] || match[3] || match[5];
          const endDate = match[2] || match[4] || match[6];
          
          if (startDate && endDate) {
            const formatDate = (dateStr) => {
              try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
              } catch (e) {
                return dateStr;
              }
            };

            return `Alert Date: ${formatDate(startDate)} to ${formatDate(endDate)}`;
          }
        }
        
        // If no BETWEEN pattern found, you can add other specific patterns you use
        const rangePattern = /created_at::DATE\s*>=\s*['"]([\d-]+)['"].*?created_at::DATE\s*<=\s*['"]([\d-]+)['"]|created_at::DATE\s*<=\s*['"]([\d-]+)['"].*?created_at::DATE\s*>=\s*['"]([\d-]+)['"]/gi;
        const rangeMatch = rangePattern.exec(queryString);
        
        if (rangeMatch) {
          const startDate = rangeMatch[1] || rangeMatch[4];
          const endDate = rangeMatch[2] || rangeMatch[3];
          
          if (startDate && endDate) {
            const formatDate = (dateStr) => {
              try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
              } catch (e) {
                return dateStr;
              }
            };

            return `Alert Date: ${formatDate(startDate)} to ${formatDate(endDate)}`;
          }
        }
        
      } catch (error) {
        console.error('Error parsing date range from query:', error);
      }

      return null;
    };

    // Build filter display
    const appliedFilters = [];
    
    // Extract and add date range from query
    const completeQuery = buildQueryWithFilters(query || '');
    const dateRangeInfo = extractDateRangeFromQuery(completeQuery);
    if (dateRangeInfo) {
      appliedFilters.push(dateRangeInfo);
    }
    
    if (alertStatusFilter) {
      appliedFilters.push(`Alert Status: ${alertStatusFilter}`);
    }
    
    if (zone && zone !== 'all') {
      appliedFilters.push(`Zone: ${zone}`);
    }
    
    if (plant && plant !== 'all') {
      appliedFilters.push(`Plant: ${plant}`);
    }
    
    if (selectedInterlock) {
      appliedFilters.push(`Interlock: ${selectedInterlock}`);
    }

    if (debouncedSearchText.trim()) {
      appliedFilters.push(`Search Text: ${debouncedSearchText}`);
    }

    if (appliedFilters.length > 0) {
      appliedFilters.forEach(filter => {
        worksheetData.push([filter]);
      });
    } else {
      worksheetData.push(['No filters applied']);
    }

    worksheetData.push([]); // Empty row for spacing
    worksheetData.push([]); // Another empty row for better separation

    // Add data headers
    const headers = [
      'Date Time Stamp',
      'Zone',
      'Plant',
      'SAP ID',
      'System',
      'Equipment',
      'Device ID',
      'Alert Type',
      'Alert Status',
      'Equipment Name',
      'Alert Closed Time'
    ];
    worksheetData.push(headers);

    // Format and add data rows
    const dataRows = allData.map((row) => [
      row.created_at ? new Date(row.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : '',
      row.zone || '',
      row.location_name || '',
      row.sap_id || '',
      row.alert_category || '',
      row.device_name ? row.device_name.split('@')[0] : '',
      row.sensor_id || '',
      row.interlock_name ? (row.interlock_name.toLowerCase().trim().endsWith('maintenance') ? 'Maintenance' : 'Fault') : '',
      row.alert_status || '',
      row.equipment_name || '',
      row.updated_at ? new Date(row.updated_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : ''
    ]);

    // Add all data rows to worksheet data
    worksheetData.push(...dataRows);

    // Create worksheet from the data
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Style the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Define styles for different sections
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell) {
          // Main heading style (row 0)
          if (row === 0) {
            cell.s = {
              font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "2563EB" } }, // Blue background
              alignment: { horizontal: "center", vertical: "center" }
            };
          }
          // Generation info styling
          else if (row === 2 || row === 3 || row === 4 || row === 6) {
            cell.s = {
              font: { bold: true, size: 11 },
              fill: { fgColor: { rgb: "F3F4F6" } } // Light gray background
            };
          }
          // Individual filter rows styling
          else if (row > 3 && row < worksheetData.findIndex(rowData => 
            Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
          ) && worksheetData[row] && worksheetData[row][0] && worksheetData[row][0] !== '') {
            cell.s = {
              font: { size: 10 },
              fill: { fgColor: { rgb: "F9FAFB" } }, // Very light gray background
              alignment: { horizontal: "left", vertical: "center" }
            };
          }
          // Data headers styling
          else if (row === worksheetData.findIndex(rowData => 
            Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
          )) {
            cell.s = {
              font: { bold: true, size: 11, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "374151" } }, // Dark gray background
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
              }
            };
          }
          // Data rows styling
          else if (row > worksheetData.findIndex(rowData => 
            Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
          )) {
            cell.s = {
              border: {
                top: { style: "thin", color: { rgb: "E5E7EB" } },
                bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                left: { style: "thin", color: { rgb: "E5E7EB" } },
                right: { style: "thin", color: { rgb: "E5E7EB" } }
              },
              alignment: { vertical: "center" }
            };
          }
        }
      }
    }

    // Set column widths
    const headerRowIndex = worksheetData.findIndex(rowData => 
      Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
    );
    
    if (headerRowIndex !== -1) {
      const columnWidths = headers.map((header, index) => {
        let width = Math.max(header.length, 12); // Minimum width
        
        // Adjust width based on content type
        switch (header) {
          case 'Date Time Stamp':
          case 'Alert Closed Time':
            width = 18;
            break;
          case 'Plant':
          case 'Equipment':
          case 'Equipment Name':
            width = 25;
            break;
          case 'SAP ID':
          case 'Device ID':
            width = 15;
            break;
          case 'Zone':
          case 'System':
          case 'Alert Type':
          case 'Alert Status':
            width = 12;
            break;
          default:
            width = 15;
        }
        
        return { wch: width };
      });
      
      worksheet['!cols'] = columnWidths;
    }

    // Merge cells for the main heading
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }
    ];

    // Set row heights
    worksheet['!rows'] = [
      { hpt: 25 }, // Main heading row height
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Maintenance Alerts');

    // Generate filename with detailed timestamp
    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `Maintenance_Alerts_Report_${fileTimestamp}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);

    toast.success(`Successfully exported ${allData.length} maintenance alerts to ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.error('Failed to export data to Excel. Please try again.');
  } finally {
    setIsDownloading(false);
  }
}, [fetchAllDataForExport, alertStatusFilter, zone, plant, selectedInterlock, debouncedSearchText, query, buildQueryWithFilters]);

const handleDownloadExcel = () => {
  handleExcelExport();
};


  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2 space-x-2">
        <div className="flex-grow">
          <Input
            placeholder="Search maintenance records..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-8"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={
              alertStatusFilter === 'All'
                ? 'text-blue-600'
                : alertStatusFilter === 'Open'
                  ? 'text-red-600'
                  : 'text-green-600'
            }
          >
            {alertStatusFilter}
          </span>
          <button
            onClick={handleAlertStatusToggle}
            type="button"
            role="switch"
            aria-checked={alertStatusFilter !== "All"}
            aria-label="Toggle alert status filter"
            className={`relative inline-flex h-5 w-12 items-center rounded-full transition-colors duration-300 ease-in-out ${
              alertStatusFilter === "All"
                ? "bg-blue-400"
                : alertStatusFilter === "Open"
                  ? "bg-red-400"
                  : "bg-green-400"
            } focus:outline-none focus:ring-1 focus:ring-gray-300`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${
                alertStatusFilter === "All"
                  ? "translate-x-1"
                  : alertStatusFilter === "Open"
                    ? "translate-x-4"
                    : "translate-x-7"
              }`}
            />
          </button>
        </div>
<Button
  onClick={handleDownloadExcel}
  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
  disabled={isDownloading}
  title={isDownloading ? "Downloading..." : "Download Excel"}
>
  {isDownloading ? (
    <RefreshCw className="h-4 w-4 animate-spin" />
  ) : (
    <Download className="h-4 w-4" />
  )}
</Button>
        {/* Refresh hidden for now — data comes from TASMaintenanceChart shared API */}
        {/* <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refresh' : 'Refresh'}
        </Button> */}
      </div>

      <div ref={tableWrapRef} className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 relative maintenance-table-visible-scroll">
        {/* AG Grid hides scrollbars by default; restore visible scrollbars for this table only */}
        <style>{`
          .maintenance-table-visible-scroll .ag-body-viewport,
          .maintenance-table-visible-scroll .ag-center-cols-viewport,
          .maintenance-table-visible-scroll .ag-body-vertical-scroll-viewport {
            -ms-overflow-style: auto !important;
            scrollbar-width: thin !important;
            scrollbar-color: #94a3b8 #e2e8f0 !important;
          }
          .maintenance-table-visible-scroll .ag-body-viewport::-webkit-scrollbar,
          .maintenance-table-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar,
          .maintenance-table-visible-scroll .ag-body-vertical-scroll-viewport::-webkit-scrollbar,
          .maintenance-table-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
            display: block !important;
            width: 10px;
            height: 10px;
          }
          .maintenance-table-visible-scroll .ag-body-viewport::-webkit-scrollbar-thumb,
          .maintenance-table-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar-thumb,
          .maintenance-table-visible-scroll .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb,
          .maintenance-table-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 5px;
          }
          .maintenance-table-visible-scroll .ag-body-viewport::-webkit-scrollbar-track,
          .maintenance-table-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar-track,
          .maintenance-table-visible-scroll .ag-body-vertical-scroll-viewport::-webkit-scrollbar-track,
          .maintenance-table-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
            background: #f1f5f9;
          }
          .maintenance-table-visible-scroll .ag-paging-panel {
            position: relative;
            z-index: 20;
            background: #fff;
          }
          .maintenance-table-visible-scroll .ag-popup,
          .maintenance-table-visible-scroll .ag-picker-field-wrapper,
          .maintenance-table-visible-scroll .ag-select-list {
            z-index: 40 !important;
          }
        `}</style>
        {showLoadingOverlay && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 rounded border border-gray-200"
            style={{ minHeight: "610px" }}
          >
            <div className="flex items-center gap-2 text-gray-700">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Loading maintenance data...</span>
            </div>
          </div>
        )}
        {!showLoadingOverlay && totalRowCount === 0 && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/95 rounded border border-gray-200"
            style={{ minHeight: '610px' }}
          >
            <p className="text-gray-600 text-center text-sm max-w-sm px-4">
            No alerts available for the selected date range.
            </p>
          </div>
        )}
        <DataGrid
          columnDefs={columnDefs}
          height="610px"
          pagination={true}
          paginationPageSize={pageSize}
          rowSelection="single"
          onGridReady={onGridReady}
          rowModelType="infinite"
          datasource={dataSource}
          cacheBlockSize={pageSize}
          infiniteInitialRowCount={0}
          defaultColDef={{
            flex: 1,
            minWidth: 100,
            maxWidth: 300,
            resizable: true,
            sortable: true,
            filter: false,
            suppressMenu: true,
          }}
        />
      </div>

      <AlertHistoryDialogV2
        isOpen={historyDialogState.isOpen}
        onClose={() => setHistoryDialogState({ isOpen: false, alertId: null })}
        alertId={historyDialogState.alertId}
        onSubmitSuccess={(message?: string) => {
          if (gridApi.current) {
            gridApi.current.refreshInfiniteCache()
          }
          if (message) {
            toast.success(message)
          }
          setHistoryDialogState({ isOpen: false, alertId: null })
        } } onRequestDocumentUpload={undefined}      />
    </div>
  )
}

export default MaintenanceTable