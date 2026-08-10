"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/@/components/ui/button"
import { Input } from "@/@/components/ui/input"
import { RefreshCw, Shield, AlertTriangle, Image, Lock, Search, Download, Calendar, CalendarDays, Flag } from "lucide-react"
import { apiClient } from "@/services/apiClient"
import { toast } from "sonner"
import RetailGovernanceTable from "./RetailGovernanceTable"
import BlockDialogs from "./BlockDialogs"
import AlertHistoryDialogV2 from "../../alertsTable/AlertHistoryDialogV2"
import { ReusableCombobox, ComboboxOption } from "../../Ticketing/components/reusable-combobox"
import RetailGovernanceStatsCards from "./RetailGovernanceStatsCards"
import { useRetailGovernanceApi } from "./useRetailGovernanceApi"

interface AlertData {
  id: number
  alert_section: string
  alert_status: string
  block_status?: string
  bu: string
  zone: string
  region?: string
  sales_area?: string
  location_name: string
  ro_name?: string
  ro_id?: string
  sap_id?: string
  vehicle_number?: string
  interlock_name: string
  alert_message: string
  created_at: string
  vehicle_blocked_start_date?: string
  vehicle_blocked_end_date?: string
  file_uploaded_path?: string
  unique_id?: string
  alert_state?: string
  ro_offline?: boolean
}

interface TabCount {
  [key: number]: number
}

const TABS = [
  {
    label: "Open",
    query: `alert_section='RO' and bu='RO' and interlock_name='Restroom Cleaning Evidence Missing' and alert_status='Open' AND (block_status IS NULL OR block_status = '')`,
    icon: AlertTriangle,
  },
  {
    label: "Blocked",
    query: `alert_section='RO' and bu='RO' and interlock_name='Restroom Cleaning Evidence Missing' and alert_status='Open' And alert_state != 'Resolved' and block_status in ('Blocked', 'WaitingForUnBlockAck', 'WaitingForBlockAck')`,
    icon: Lock,
  },
  {
    label: "Image Uploaded (Unblock)",
    query: `alert_section='RO' and bu='RO' and interlock_name='Restroom Cleaning Evidence Missing' and  alert_state='Resolved' and block_status in ('Blocked', 'WaitingForUnBlockAck', 'WaitingForBlockAck')`,
    icon: Image,
  },
  {
    label: "Pending Unblocks",
    query: `alert_section='RO' AND bu='RO' AND interlock_name='Restroom Cleaning Evidence Missing' AND ro_offline = true AND alert_status='Close' AND block_status='UnBlocked'`,
    icon: CalendarDays,
  },
  {
    label: "Closed",
    query: `alert_section='RO' and bu='RO' and interlock_name='Restroom Cleaning Evidence Missing' and alert_status='Close'`,
    icon: Shield,
  },
]

// Helper function to get today's date in YYYY-MM-DD format
const getTodaysDate = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

const RetailGovernance: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [gridData, setGridData] = useState<AlertData[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tabCounts, setTabCounts] = useState<TabCount>({})
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('')
  // Sorting state
  const [sortKey, setSortKey] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null)

  // Location filter states
  const [zoneFilter, setZoneFilter] = useState("all")
  const [regionFilter, setRegionFilter] = useState("all")
  const [salesAreaFilter, setSalesAreaFilter] = useState("all")

  // Date filter state - Initialize with today's date
  const [selectedDate, setSelectedDate] = useState<string>(getTodaysDate())

  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    blocked: 0,
    unblocked: 0,
    waiting_block_confirmation: 0,
    waiting_sales_stop_confirmation: 0,
    waiting_unblock_confirmation: 0,
    waiting_sales_resume_confirmation: 0,
    manually_unblocked: 0,
    automatically_unblocked: 0,
    no_connectivity: 0,
    pending_unblocks: 0,
  })
  const [statsLoading, setStatsLoading] = useState(false)

  // Use API hook
  const {
    fetchLastSyncedTime,
    zones,
    regions,
    salesAreas,
    locationsLoading,
    fetchLocations,
    fetchAlerts: fetchAlertsApi,
    fetchAllTabCounts: fetchAllTabCountsApi,
    fetchStats: fetchStatsApi,
    downloadReport
  } = useRetailGovernanceApi()

  // Dialog states
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const [selectedAlertForBlock, setSelectedAlertForBlock] = useState<AlertData | null>(null)
  const [blockRemark, setBlockRemark] = useState("")

  const [isUnblockDialogOpen, setIsUnblockDialogOpen] = useState(false)
  const [selectedAlertForUnblock, setSelectedAlertForUnblock] = useState<AlertData | null>(null)
  const [unblockRemark, setUnblockRemark] = useState("")

  const [isBlockRODialogOpen, setIsBlockRODialogOpen] = useState(false)
  const [blockROId, setBlockROId] = useState("")
  const [blockRORemark, setBlockRORemark] = useState("")

  const [historyDialogState, setHistoryDialogState] = useState<{ isOpen: boolean; alertId: string | number | null }>({
    isOpen: false,
    alertId: null,
  })

  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false)
  const [selectedAlertForComments, setSelectedAlertForComments] = useState<AlertData | null>(null)
  const [comment, setComment] = useState("")

  const [isDayEndDialogOpen, setIsDayEndDialogOpen] = useState(false)

  const isFirstRender = useRef(true)
  const fetchAlertsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Wrapper functions using the API hook
  const getFilters = () => ({
    searchTerm,
    selectedDate,
    zoneFilter,
    regionFilter,
    salesAreaFilter,
  })

  const fetchAllTabCounts = async () => {
    try {
      const filters = getFilters()
      const tabQueries = TABS.map(tab => tab.query)
      const counts = await fetchAllTabCountsApi(tabQueries, filters)
      setTabCounts(counts)
    } catch (error) {
      console.error("Error fetching tab counts:", error)
    }
  }

  const fetchAlerts = async (page = currentPage, tabIndex = activeTab, showToast = false) => {
    setIsLoading(true)
    // Immediately clear data when starting a new fetch to avoid showing old data
    setGridData([])

    try {
      const filters = getFilters()
      const result = await fetchAlertsApi(
        TABS[tabIndex].query,
        filters,
        page,
        pageSize,
        sortKey || undefined,
        sortOrder || undefined
      )

      // Only update if we're still on the same tab
      setGridData(result.data)
      setTotalItems(result.total)

      setTabCounts(prev => ({
        ...prev,
        [tabIndex]: result.total
      }))

      if (showToast) {
        toast.success("Data fetched successfully")
      }
    } catch (error) {
      console.error("Error fetching alerts:", error)
      toast.error("Failed to fetch alerts")
      setGridData([])
      setTotalItems(0)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const filters = getFilters()
      const statsData = await fetchStatsApi(filters)
      setStats(statsData)
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setStatsLoading(false)
    }
  }

  const handleTabChange = (index: number) => {
    setActiveTab(index)
    setCurrentPage(1)
    // Clear grid data immediately when changing tabs
    setGridData([])
    // Reset sorting when changing tabs
    setSortKey('')
    setSortOrder(null)
  }

  const handleSortChange = (newSortKey: string, newSortOrder: 'asc' | 'desc' | null) => {
    setSortKey(newSortKey)
    setSortOrder(newSortOrder)
    setCurrentPage(1) // Reset to first page when sorting changes
  }
  const fetchSyncedTime = async () => {
    try {
      const time = await fetchLastSyncedTime()
      setLastSyncedTime(time)
    } catch (error) {
      console.error("Error fetching synced time:", error)
    }
  }
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([
      fetchAlerts(currentPage, activeTab, true),
      fetchAllTabCounts(),
      fetchStats(),
      fetchSyncedTime()
    ])
    setIsRefreshing(false)
  }

  const handleViewHistory = (alertId: number) => {
    setHistoryDialogState({ isOpen: true, alertId })
  }

  const handleOpenBlockDialog = (alert: AlertData) => {
    setSelectedAlertForBlock(alert)
    setBlockRemark("")
    setIsBlockDialogOpen(true)
  }

  const handleOpenUnblockDialog = (alert: AlertData) => {
    setSelectedAlertForUnblock(alert)
    setUnblockRemark("")
    setIsUnblockDialogOpen(true)
  }

  const handleOpenBlockRODialog = () => {
    setBlockROId("")
    setBlockRORemark("")
    setIsBlockRODialogOpen(true)
  }

  const handleOpenCommentsDialog = (alert: AlertData) => {
    setSelectedAlertForComments(alert)
    setComment("")
    setIsCommentsDialogOpen(true)
  }

  const handleConfirmComments = async () => {
    if (!selectedAlertForComments || !comment.trim()) {
      toast.error("Please enter a comment")
      return
    }

    try {
      const response = await apiClient.post("/api/alerts/add_rca_reason", {
        alert_id: selectedAlertForComments.id.toString(),
        reason: comment.trim(),
      })

      toast.success("Comment submitted successfully")
      setIsCommentsDialogOpen(false)
      setSelectedAlertForComments(null)
      setComment("")
      await Promise.all([
        fetchAlerts(currentPage, activeTab),
        fetchAllTabCounts(),
        fetchStats()
      ])
    } catch (error: any) {
      console.error("Error submitting comment:", error)
      const errorMessage = error.response?.data?.message || "Failed to submit comment"
      toast.error(errorMessage)
    }
  }

  const handleDayEnd = () => {
    setIsDayEndDialogOpen(true)
  }

  const handleConfirmDayEnd = async () => {
    try {
      const response = await apiClient.post(
        "/api/alerts/day_end_closure",
        {}
      )

      if (response.data?.status === true) {
        toast.success(
          response.data.message || "Day end process completed successfully"
        )
        setIsDayEndDialogOpen(false)

        await Promise.all([
          fetchAlerts(currentPage, activeTab),
          fetchAllTabCounts(),
          fetchStats()
        ])
      } else {
        toast.error(
          response.data?.message || "Failed to complete day end process"
        )
      }
    } catch (error: any) {
      console.error("Error processing day end:", error)
      const errorMessage =
        error.response?.data?.message ||
        "Failed to complete day end process"
      toast.error(errorMessage)
    }
  }

  const handleConfirmBlock = async () => {
    if (!selectedAlertForBlock) return

    const blockId = selectedAlertForBlock.id

    if (!blockId) {
      toast.error("Block ID is missing for this alert")
      return
    }

    try {
      const response = await apiClient.post("/api/indentdryout/block_outlet", {
        block_id: blockId.toString(),
        remarks_blocked: blockRemark,
      })

      if (response.data?.status === true) {
        toast.success(response.data.message || `Alert #${selectedAlertForBlock.id} blocked successfully`)
        setIsBlockDialogOpen(false)
        setSelectedAlertForBlock(null)
        setBlockRemark("")
        await Promise.all([
          fetchAlerts(currentPage, activeTab),
          fetchStats()
        ])
      } else {
        toast.error(response.data?.message || "Failed to block outlet")
      }
    } catch (error) {
      console.error("Error blocking outlet:", error)
      toast.error("Failed to block outlet")
    }
  }

  const handleConfirmUnblock = async () => {
    if (!selectedAlertForUnblock) return

    try {
      const payload = {
        unblock_id: selectedAlertForUnblock.id.toString(),
        remarks_unblocked: unblockRemark,
      }

      await apiClient.post("/api/indentdryout/unblock_outlet", payload)
      toast.success(`Alert #${selectedAlertForUnblock.id} unblocked successfully`)
      setIsUnblockDialogOpen(false)
      setSelectedAlertForUnblock(null)
      setUnblockRemark("")
      await Promise.all([
        fetchAlerts(currentPage, activeTab),
        fetchAllTabCounts(),
        fetchStats()
      ])
    } catch (error) {
      console.error("Error unblocking outlet:", error)
      toast.error("Failed to unblock outlet")
    }
  }

  const handleConfirmBlockRO = async () => {
    if (!blockROId.trim() || !blockRORemark.trim()) {
      toast.error("Please provide RO ID and remarks")
      return
    }

    try {
      const response = await apiClient.post("/api/indentdryout/block_ro", {
        ro_code: blockROId.trim(),
        remarks_blocked: blockRORemark,
      })

      if (response.data?.status === true) {
        toast.success(response.data.message || "RO has been successfully blocked")
        setIsBlockRODialogOpen(false)
        setBlockROId("")
        setBlockRORemark("")
        await Promise.all([
          fetchAlerts(currentPage, activeTab),
          fetchAllTabCounts(),
          fetchStats()
        ])
      } else {
        toast.error(response.data?.message || "Failed to block RO")
      }
    } catch (error: any) {
      console.error("Error blocking RO:", error)
      const errorMessage = error.response?.data?.message || "Failed to block RO"
      toast.error(errorMessage)
    }
  }

  const handleDownload = async () => {
    const filters = getFilters()
    await downloadReport(filters)
  }

  useEffect(() => {
    // Fetch location data on initial load
    fetchLocations()
    // Initial data fetch - all three in parallel
    Promise.all([
      fetchAllTabCounts(),
      fetchStats(),
      fetchAlerts(1, 0),
      fetchSyncedTime()
    ])
  }, [])

  useEffect(() => {
    // Only fetch alerts when page/tab/pageSize/sorting changes
    fetchAlerts(currentPage, activeTab)
  }, [currentPage, activeTab, pageSize, sortKey, sortOrder])

  useEffect(() => {
    // When filters change, reset to page 1 and refetch everything
    setCurrentPage(1)

    Promise.all([
      fetchAlerts(1, activeTab),
      fetchAllTabCounts(),
      fetchStats()
    ])
  }, [zoneFilter, regionFilter, salesAreaFilter, selectedDate])

  useEffect(() => {
    // Refetch locations when zone changes
    if (zoneFilter !== "all") {
      fetchLocations(zoneFilter)
    } else {
      fetchLocations()
    }

    // Reset dependent filters when zone changes
    setRegionFilter("all")
    setSalesAreaFilter("all")
  }, [zoneFilter])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (fetchAlertsTimeoutRef.current) {
      clearTimeout(fetchAlertsTimeoutRef.current)
    }

    // When search term changes, debounce and refetch everything
    fetchAlertsTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1)
      Promise.all([
        fetchAlerts(1, activeTab),
        fetchAllTabCounts(),
        fetchStats()
      ])
    }, 500)

    return () => {
      if (fetchAlertsTimeoutRef.current) {
        clearTimeout(fetchAlertsTimeoutRef.current)
      }
    }
  }, [searchTerm])

  const handleZoneChange = (value: string) => {
    setZoneFilter(value)
  }

  const zoneOptions: ComboboxOption[] = [
    { value: "all", label: "All Zones" },
    ...zones.map((zone) => ({ value: zone.id, label: zone.name })),
  ]

  const regionOptions: ComboboxOption[] = [
    { value: "all", label: "All Regions" },
    ...regions.map((region) => ({ value: region, label: region })),
  ]

  const salesAreaOptions: ComboboxOption[] = [
    { value: "all", label: "All Sales Areas" },
    ...salesAreas.map((salesArea) => ({ value: salesArea, label: salesArea })),
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      {/* Header */}
      <div className="mb-3">
        {/* First Line: Title with Search and Date at the end */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mt-2 mb-3">
          <h1 className="text-lg font-bold text-gray-900">
            VA Cleanliness – Retail Outlet Blocking Management - 
            {lastSyncedTime && (
              <span className="ml-2 text-md font-bold text-gray-600">
             Last scheduler run at ({lastSyncedTime})
              </span>
            )}
          </h1>

          <div className="flex items-center gap-3">
            {/* Date Filter */}
            <div className="relative">
              <CalendarDays className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 pointer-events-none z-10" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 h-9 w-40"
                placeholder="Select Date"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 bg-transparent"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 bg-transparent"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Second Line: Dropdowns at the start */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          {/* Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              {/* Search */}
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by RO Name, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 w-72 lg:w-96"
              />
            </div>
            <ReusableCombobox
              options={zoneOptions}
              value={zoneFilter}
              onValueChange={handleZoneChange}
              placeholder="Zone"
              buttonClassName="h-9 w-32"
              disabled={zones.length === 0 && !locationsLoading}
            />

            <ReusableCombobox
              options={regionOptions}
              value={regionFilter}
              onValueChange={setRegionFilter}
              placeholder="Region"
              buttonClassName="h-9 w-48"
              disabled={regions.length === 0 && !locationsLoading}
            />

            <ReusableCombobox
              options={salesAreaOptions}
              value={salesAreaFilter}
              onValueChange={setSalesAreaFilter}
              placeholder="Sales Area"
              buttonClassName="h-9 w-48"
              disabled={salesAreas.length === 0 && !locationsLoading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 ml-auto">
            <Button
              onClick={handleDayEnd}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0 shadow-md"
            >
              <Calendar className="h-4 w-4" />
              Day End
            </Button>
            <Button
              onClick={handleOpenBlockRODialog}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 shadow-md"
            >
              <Lock className="h-4 w-4" />
              Block RO
            </Button>
          </div>
        </div>
      </div>

      {/* Big Number Cards */}
      <RetailGovernanceStatsCards stats={stats} loading={statsLoading} />

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border mt-4">
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto bg-gray-50/50 border-b">
          {TABS.map((tab, index) => {
            const IconComponent = tab.icon
            return (
              <button
                key={index}
                onClick={() => handleTabChange(index)}
                className={`relative text-xs font-bold px-4 py-2 transition-all duration-200 whitespace-nowrap rounded-md flex items-center gap-2 border ${
                  activeTab === index
                    ? "bg-white text-indigo-700 border-indigo-200 shadow-sm ring-1 ring-indigo-100"
                    : "bg-transparent text-gray-500 border-transparent hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                {IconComponent && <IconComponent className={`w-3.5 h-3.5 ${activeTab === index ? "text-indigo-600" : "text-gray-400"}`} />}
                <span>{tab.label}</span>
                <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-4.5 px-1.5 text-[10px] font-bold rounded-full transition-colors ${
                  activeTab === index
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-200 text-gray-600"
                }`}>
                  {tabCounts[index] || 0}
                </span>
                {activeTab === index && (
                  <div className="absolute -bottom-[9px] left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-0">
          <RetailGovernanceTable
            gridData={gridData}
            isLoading={isLoading}
            activeTab={activeTab}
            totalItems={totalItems}
            currentPage={currentPage}
            pageSize={pageSize}
            setCurrentPage={setCurrentPage}
            setPageSize={setPageSize}
            onViewHistory={handleViewHistory}
            onOpenBlockDialog={handleOpenBlockDialog}
            onOpenUnblockDialog={handleOpenUnblockDialog}
            onOpenCommentsDialog={handleOpenCommentsDialog}
            onRefresh={handleRefresh}
            onSortChange={handleSortChange}
          />
        </div>
      </div>

      {/* Dialogs */}
      <BlockDialogs
        isBlockDialogOpen={isBlockDialogOpen}
        setIsBlockDialogOpen={setIsBlockDialogOpen}
        blockRemark={blockRemark}
        setBlockRemark={setBlockRemark}
        onConfirmBlock={handleConfirmBlock}

        isUnblockDialogOpen={isUnblockDialogOpen}
        setIsUnblockDialogOpen={setIsUnblockDialogOpen}
        unblockRemark={unblockRemark}
        setUnblockRemark={setUnblockRemark}
        onConfirmUnblock={handleConfirmUnblock}

        isBlockRODialogOpen={isBlockRODialogOpen}
        setIsBlockRODialogOpen={setIsBlockRODialogOpen}
        blockROId={blockROId}
        setBlockROId={setBlockROId}
        blockRORemark={blockRORemark}
        setBlockRORemark={setBlockRORemark}
        onConfirmBlockRO={handleConfirmBlockRO}

        isCommentsDialogOpen={isCommentsDialogOpen}
        setIsCommentsDialogOpen={setIsCommentsDialogOpen}
        comment={comment}
        setComment={setComment}
        onConfirmComments={handleConfirmComments}

        isDayEndDialogOpen={isDayEndDialogOpen}
        setIsDayEndDialogOpen={setIsDayEndDialogOpen}
        onConfirmDayEnd={handleConfirmDayEnd}
      />

      {/* Alert History Dialog */}
      {historyDialogState.isOpen && (
        <AlertHistoryDialogV2
          isOpen={historyDialogState.isOpen}
          onClose={() => setHistoryDialogState({ isOpen: false, alertId: null })}
          alertId={historyDialogState.alertId}
          onSubmitSuccess={undefined}
          onRequestDocumentUpload={undefined}
        />
      )}
    </div>
  )
}

export default RetailGovernance