"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react"
import { SeverityProvider } from "../../projects/Projects"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/@/components/ui/breadcrumb"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import TerminalAutomationZonePlantSelections from "../RetailOutletHome/TerminalAutomationZonePlantSelections"
import BCUAlertsTable from "../alertsTable/BCUAlertsTable"
import MaintenanceTable from "../alertsTable/MaintenanceTable"
import BCUCrticalParamsWrapper from "./TerminalAutomation/BCUCriticalParameters/BCUCrticalParamsWrapper"
import TASMaintenanceChart from "./TASDashboards/TASMaintenanceChart"
import { Grid } from "@mui/material"
import TerminalTable from "../alertsTable/TASTerminalTable"
import TASTrendDashboard from "./TASDashboards/TASTrendDashboard"
import FaultGantry from "../alertsTable/maintanenceGraphs/FaultGantry"
import FlowContainer from "@/pages/flow/FlowContainer"
import GantryShutdownPage from "./TerminalAutomation/GantryShutDownPage"
import ESDShutdownPage from "./TerminalAutomation/ESDShutDownPage"
import { apiClient } from "@/services/apiClient"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip"
import { Info } from "lucide-react"
import TASGpt from './TASGpt';


interface FilterValue {
  key: string
  cond: string
  value: string
}

interface SeverityFilter {
  severity: string | null
  section: string | null
  interlockName: string | null
  bu: string
}

interface TitleFilter {
  id: number | null
  title: string | null
  bu: string
  alert_section: string | null
}

interface LocationFilter {
  zone: string | null
  plant: string | null
}

/** All 24 BCU interlock names shown in the BCU Alarm Parameters tooltip (displayed regardless of API load). */
const BCU_INTERLOCK_NAMES_TOOLTIP: string[] = [

  "BCU Totalizer Mismatch with last day Totalizer",  
        "BCU Local Loading" ,
        "BCU Totalizer Mismatch with MFM Totalizer",  
        "K - Factor Changed",  
        "Blend Underdose Alarm",  
        "No Flow",  
        "Additive Overdose Alarm",  
        "Meter overrun Alarm",  
        "Additive Underdose Alarm",  
        "Unauthorized Flow Alarm",  
        "High Flow Alarm",  
        "Blend overdose Alarm",  
        "Low Flow",  
        "BCU Loading Status", 
        "Min 5% Manual Cross-check records",  
        "Sick TT_ truck",  
        "Cancel TT_ truck",  
        "Gantry Permissive override",  
        "Unauthorized flow",  
        "Bay reasignment",  
        "TT Overloaded",  
    "Day End Report",
   "Manual - bay assignment of more 5% of total TT loaded, Manual FAN printed more 5% of total TT loaded",  
]

const TerminalAutomation: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([0]))
  const tableRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null)
  const [filters, setFilters] = useState<FilterValue[]>([])

  const [selectedName, setSelectedName] = useState(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null)

  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const businessUnits = [{ id: 2, bu: "TAS", alert_section: "TAS" }]
  const businessUnits1 = [{ id: 2, bu: "TAS", alert_section: "VA" }]
  const businessUnits2 = [{ id: 2, bu: "TAS", alert_section: "VTS" }]
  const [timeFilter, setTimeFilter] = useState("t")
  const [selectedInterlock, setSelectedInterlock] = useState(null)
  const [selectedFromDate, setSelectedFromDate] = useState<string>("")
  const [selectedToDate, setSelectedToDate] = useState<string>("")
  const [selectedmaintenanceFromDate, setSelectedmaintenanceFromDate] = useState<string>("")
  const [selectedmaintenanceToDate, setSelectedmaintenanceToDate] = useState<string>("")
  const [selectedEquipment, setSelectedEquipment] = useState<string>("All Equipment")
  // Add new state for clicked equipment name
  const [clickedEquipmentName, setClickedEquipmentName] = useState<string | null>(null)
  // Add state for chart dot clicked date/month
  const [chartClickedDate, setChartClickedDate] = useState<string | null>(null)
  const [chartClickedIsMonth, setChartClickedIsMonth] = useState<boolean>(false)
  const [alertStatus, setAlertStatus] = useState<"All" | "Open" | "Close">("Open");
  const [locationViewRefreshKey, setLocationViewRefreshKey] = useState(0)

  const [selectedBcuNumber, setSelectedBcuNumber] = useState<string>("")
  const [tableRefreshKey, setTableRefreshKey] = useState(0)
  const [isDateRangeSelected, setIsDateRangeSelected] = useState(false)
  const [isDateRangeMSelected, setIsDateRangeMSelected] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<string>("All Devices")
  const [clearChartFilterTrigger, setClearChartFilterTrigger] = useState(0)
  const [maintenanceChartLoading, setMaintenanceChartLoading] = useState(false)
  const [maintenanceApiData, setMaintenanceApiData] = useState<any>(null)
  const handleDeviceSelect = (device: string) => {
    setSelectedDevice(device)
  }

  // Function to refresh the table
  const handleRefreshTable = () => {
    setTableRefreshKey((prev) => prev + 1)
  }
  const handleDateRangeSelect = (fromDate: string, toDate: string) => {
    setSelectedFromDate(fromDate)
    setSelectedToDate(toDate)
    setIsDateRangeSelected(true) // Update state when date range is selected
  }
  const handleDateRangeSelectmaintenance = (fromMDate: string, toMDate: string) => {
    if (!fromMDate?.trim() || !toMDate?.trim()) {
      setSelectedmaintenanceFromDate("")
      setSelectedmaintenanceToDate("")
      setIsDateRangeMSelected(false)
      return
    }
    // Only update if dates are provided and not empty
    if (fromMDate && toMDate && fromMDate.trim() !== "" && toMDate.trim() !== "") {
      // If chart clicked date is already set, don't override it with automatic/default date range
      // Chart clicked date takes priority over automatic date range selection
      if (chartClickedDate && chartClickedDate.trim() !== "") {
        // Check if this is the default 7-day range (automatic selection from TASMaintenanceChart useEffect)
        // Calculate if it's approximately 7 days from today
        const today = new Date()
        const endDate = new Date(toMDate)
        const startDate = new Date(fromMDate)
        const daysDiff = Math.abs((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const isToday = endDate.toDateString() === today.toDateString()
        const isDefaultRange = Math.abs(daysDiff - 7) < 1 && isToday
        
        // If this is the default/automatic range, don't override chart clicked date
        if (isDefaultRange) {
          return // Don't update date range if chart date is active and this is automatic selection
        }
      }
      
      setSelectedmaintenanceFromDate(fromMDate)
      setSelectedmaintenanceToDate(toMDate)
      setIsDateRangeMSelected(true) // Update state when date range is selected
      // Clear chart clicked date when date range is manually selected via date picker
      setChartClickedDate(null)
      setChartClickedIsMonth(false)
    }
  }

  // Handle chart dot click date selection
  const handleChartDateSelect = (date: string, isMonth: boolean = false) => {
    if (!date || date.trim() === "") {
      setChartClickedDate(null)
      setChartClickedIsMonth(false)
      return
    }
    if (date && date.trim() !== "") {
      setChartClickedDate(date)
      setChartClickedIsMonth(isMonth)
      // Clear date range filter when chart date is selected to prevent overlap
      setSelectedmaintenanceFromDate("")
      setSelectedmaintenanceToDate("")
      // Keep isDateRangeMSelected as true so MaintenanceTable remains visible
      // The table should show when either date range OR chart date is selected
      setIsDateRangeMSelected(true)
    }
  }

  const handleBcuNumberSelect = (bcuNumber: string) => {
    const extractedBcuNumber = bcuNumber
    setSelectedBcuNumber(extractedBcuNumber)
  }
  const handleInterlockSelection = (interlockName) => {
    setSelectedInterlock(interlockName)
  }
  const handleInterlockOptionsLoaded = (_names: string[]) => {
    // Tooltip always uses BCU_INTERLOCK_NAMES_TOOLTIP; no state update needed.
  }

  // Add handler for equipment row click
  const [equipmentSelectionSource, setEquipmentSelectionSource] = useState<'dropdown' | 'rowClick'>('dropdown')

  // Update the handleEquipmentSelect function
  const handleEquipmentSelect = (equipment: string) => {
    setSelectedEquipment(equipment)
    setEquipmentSelectionSource('dropdown')
  }

  // Add new function to handle row click equipment selection and date
  const handleRowClickEquipment = (equipmentName: string, date: string) => {
    setSelectedEquipment(equipmentName)
    setClickedEquipmentName(date) // Store the clicked date for query filtering
    setEquipmentSelectionSource('rowClick')
    // IMPORTANT: Do NOT set selectedDevice from row click - sensor_id filter is removed
    // IMPORTANT: Do NOT clear chartClickedDate - preserve the date filter from line chart dot click
    // Only the chart date filter will be applied, not equipment ID filter from row click
  }

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    severity: null,
    section: null,
    interlockName: null,
    bu: "TAS",
  })

  const [titleFilter, setTitleFilter] = useState<TitleFilter>({
    id: null,
    title: null,
    bu: "TAS",
    alert_section: null,
  })

  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: null,
  })
  // Don't pass zone/plant to maintenance chart until user explicitly selects
  const [userHasSelectedLocation, setUserHasSelectedLocation] = useState(false)

  useEffect(() => {
    fetchUserInfo()
  }, [])

  /** Default zone/plant (NCZ / 1128) only while Location View tab (0) is active */
  useEffect(() => {
    if (activeTab !== 0) return
    setSelectedZone("NCZ")
    setSelectedPlant("1128")
    setLocationFilter({
      zone: "NCZ",
      plant: "1128",
    })
    setFilters((prev) => {
      const withoutZone = prev.filter((f) => f.key !== "zone")
      const withoutSap = withoutZone.filter((f) => f.key !== "sap_id")
      return [
        ...withoutSap,
        { key: "zone", cond: "equals", value: "NCZ" },
        { key: "sap_id", cond: "equals", value: "1128" },
      ]
    })
  }, [activeTab])

  const fetchUserInfo = async () => {
    try {
      const response = await apiClient.get("/api/session/me")
      setUserInfo(response.data)
    } catch (error) { }
  }
  const [userInfo, setUserInfo] = useState<any>({})
  const handleZoneChange = (zone: string | null) => {
    if (zone === selectedZone) return
    setUserHasSelectedLocation(true)
    setSelectedZone(zone)
    setSelectedPlant(null)

    setLocationFilter((prev) => ({
      ...prev,
      zone,
      plant: null,
    }))

    // Update filters: set zone and clear plant in one update so chart API is called only once
    setFilters((prevFilters) => {
      const withoutZone = prevFilters.filter((f) => f.key !== "zone")
      const withoutSap = withoutZone.filter((f) => f.key !== "sap_id")
      if (zone) {
        return [...withoutSap, { key: "zone", cond: "equals", value: zone }]
      }
      return withoutSap
    })
  }

  // 2. Create handler function
  const handleAlertStatusChange = (status: "All" | "Open" | "Close") => {
    setAlertStatus(status);
  };
const handlePlantChange = (plant: string) => {
  if (plant === selectedPlant) return
  setLocationFilter((prev) => ({
    ...prev,
    plant,
  }))
  setSelectedPlant(plant)

  setFilters((prevFilters) => {
    const filtersWithoutSapId = prevFilters.filter((f) => f.key !== "sap_id")
    if (plant) {
      return [...filtersWithoutSapId, { key: "sap_id", cond: "equals", value: plant }]
    }
    return filtersWithoutSapId
  })
}

const getQuery = (
  baseStatus: string,
  tabIndex: number,
  fromDate?: string,
  toDate?: string,
  fromMDate?: string,
  toMDate?: string,
  extractedBcuNumber?: string,
  clickedDate?: string,
  alertStatus?: "All" | "Open" | "Close",
  skip = 0,
  limit = 20,
  chartClickedDate?: string | null,
  chartClickedIsMonth?: boolean,
): {
  baseQuery: string
  paginationParams: { skip: number; limit: number }
} => {
  let baseQuery = `bu='TAS' AND alert_section='TAS'`
  
  if (alertStatus && alertStatus !== "All") {
    baseQuery += ` AND alert_status='${alertStatus}'`
  }
  
  if (tabIndex === 0) {
    // My Inbox
    baseQuery += ` AND device_type IN ('Loading Point', 'Gantry')`
    
    if (selectedInterlock) {
      // Special handling for "BCU Permissive Off"
      if (selectedInterlock === "BCU Permissive Off") {
        baseQuery += ` AND interlock_name = '${selectedInterlock}'`
      } else {
        baseQuery += ` AND interlock_name LIKE '%${selectedInterlock}%'`
      }
    }
    
    if (extractedBcuNumber) {
      baseQuery += ` AND device_name LIKE '%${extractedBcuNumber}%'`
    }
    // Add date filter only if fromDate and toDate are provided
    if (fromDate && toDate) {
      baseQuery += ` AND created_at::DATE BETWEEN '${fromDate}' AND '${toDate}'`
    }
    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`
    }
    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`
    }
  } else if (tabIndex === 1) {
    // Escalation Inbox / MaintenanceTable
    baseQuery += ` AND sop_id IN ('SOP004','SOP016','SOP017','SOP018','SOP019','SOP020','SOP007','SOP008',
              'SOP009','SOP010','SOP010A','SOP011','SOP012','SOP013','SOP014')`
    
    // Apply date filter: Chart clicked date takes priority, then date range filter
    // Both can work together with equipment/sensor_id filters
    const clickedDate = chartClickedDate || null
    const isMonth = chartClickedIsMonth || false
    
    // First priority: Chart clicked date (from line chart dot click)
    if (clickedDate && clickedDate.trim() !== "") {
      if (isMonth) {
        // Convert month string (e.g., "May-2024") to date range (first day to last day of month)
        const [monthName, year] = clickedDate.split('-')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthIndex = monthNames.indexOf(monthName)
        if (monthIndex !== -1) {
          const firstDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
          // Get last day of month using Date object
          const lastDayOfMonth = new Date(parseInt(year), monthIndex + 1, 0)
          const lastDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
          baseQuery += ` AND created_at::DATE BETWEEN '${firstDay}' AND '${lastDay}'`
        }
      } else {
        // For weekly view, use the clicked date as both start and end
        baseQuery += ` AND created_at::DATE = '${clickedDate}'`
      }
    } 
    // Second priority: Date range filter (from date picker)
    else if (fromMDate && toMDate && fromMDate.trim() !== "" && toMDate.trim() !== "") {
      // Add date filter for MaintenanceTable (from TASMaintenanceChart date range)
      baseQuery += ` AND created_at::DATE BETWEEN '${fromMDate}' AND '${toMDate}'`
    }

    // Add zone and plant filters
    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`
    }
    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`
    }
  } else if (tabIndex === 3) {
    // Escalation Inbox
    baseQuery += ` AND alert_status='${baseStatus}' AND interlock_name NOT LIKE '%Under Maintenance%' 
  AND device_type NOT IN ('Gantry', 'Loading Point')`
  }

  // Existing filter logic remains the same...
  if (severityFilter.severity) {
    baseQuery += ` AND severity='${severityFilter.severity}'`
  }

  if (severityFilter.interlockName) {
    // Special handling for "BCU Permissive Off" in severity filter as well
    if (severityFilter.interlockName === "BCU Permissive Off") {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`
    } else {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`
    }
  }

  // Add equipment filter based on selection source
  // Note: Date filter from chart dot click (chartClickedDate) is already applied above
  // This section only handles equipment name filtering, not date filtering
  if (selectedEquipment && selectedEquipment !== "All Equipment") {
    if (equipmentSelectionSource === 'rowClick') {
      // For row click, only apply equipment name filter
      // Date filter is handled separately above (chartClickedDate takes priority)
      baseQuery += ` AND equipment_name ILIKE '%${selectedEquipment}%'`
    } else {
      baseQuery += ` AND equipment_name = '${selectedEquipment === "N/A" ? "" : selectedEquipment}'`
    }
  }

  // Add device filter (simple dropdown selection only)
  if (selectedDevice && selectedDevice !== "All Devices") {
    baseQuery += ` AND sensor_id = '${selectedDevice === "N/A" ? "" : selectedDevice}'`
  }

  return {
    baseQuery,
    paginationParams: {
      skip,
      limit,
    },
  }
}
  const handleTabChange = (index: number) => {
    setActiveTab(index)
    setLoadedTabs((prev) => new Set([...prev, index]))

    // Location View: default NCZ/1128 is applied by useEffect when activeTab === 0
    if (index === 0) {
      setLocationViewRefreshKey((prev) => prev + 1)
    } else {
      // Set zone and plant to "all" for other tabs; clear filters so the new tab doesn't get previous zone/plant
      setSelectedZone(null)
      setSelectedPlant(null)
      setLocationFilter({
        zone: null,
        plant: null,
      })
      setFilters((prev) => prev.filter((f) => f.key !== "zone" && f.key !== "sap_id"))
    }
  }

  const handleDateRangeChange = (dateFilter: any) => {
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      bu: "TAS",
    })

    setTitleFilter({
      id: null,
      title: null,
      bu: "TAS",
      alert_section: null,
    })

    setDateRangeFilter(dateFilter)
    setTimeFilter(null)
  }

  const handleLocationChange = (locationId: string) => {
    setLocationFilter((prev) => ({
      ...prev,
      plant: locationId,
    }))
  }

  //for check the selected data
  useEffect(() => { }, [selectedName])

  // Update query generation to include clicked equipment and clicked date
  // Pass chartClickedDate and chartClickedIsMonth to getQuery for MaintenanceTable filtering
  const queryResult = getQuery(
    undefined,
    1,
    undefined,
    undefined,
    selectedmaintenanceFromDate,
    selectedmaintenanceToDate,
    undefined,
    clickedEquipmentName, 
    undefined,
    0, // skip
    20,  // limit
    chartClickedDate, // Pass chart clicked date
    chartClickedIsMonth // Pass whether it's a month selection
  )

  const querybcuResult = getQuery(
    "Open",
    0, // Note: corresponds to the first tab for BCUAlertsTable
    selectedFromDate,
    selectedToDate,
    undefined,
    undefined,
    selectedBcuNumber,
    undefined,
    alertStatus,
    0, // skip
    20  // limit
  )

  // Append exclusion condition for interlock_name
  querybcuResult.baseQuery += ` AND interlock_name NOT IN (
    'Pulse Security', 
    'K-Factors', 
    'Cancel TT Reported', 
    'Manual FAN printed more than 5% of total TT loaded', 
    'Bay reassignment', 
    'Manual - bay assignment of more than 5% of total TT loaded', 
    'Manual FAN printed less than 5% of total TT loaded'
  )`
  return (
    <div className="bg-white p-1 pt-0 rounded-lg shadow-md">
      <SeverityProvider>
        <div className="flex items-center justify-between px-1 py-1">
          <Breadcrumb>
            <BreadcrumbList className="flex items-center text-gray-500">
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate(-1)} className="hover:text-gray-700">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbPage className="text-gray-900">TAS Overview</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-4">
            <TerminalAutomationZonePlantSelections
              key={`zone-plant-${activeTab}`}
              bu="TAS"
              defaultZone={activeTab === 0 ? "NCZ" : undefined}
              defaultPlant={activeTab === 0 ? "1128" : undefined}
              onZoneChange={handleZoneChange}
              onPlantChange={handlePlantChange}
            />
          </div>
        </div>

        <div ref={tableRef} className="rounded-md border border-gray-200 text-sm  shadow">
          <Tabs variant="unstyled" className="w-full" index={activeTab} onChange={handleTabChange}>
            <TabList className="w-full flex border-b min-h-[48px]">
              <TooltipProvider delayDuration={200}>
                {[
                  {
                    name: "Location View",
                    description: "Location layout: Plant equipment connectivity among the Process PLC, Safety PLC, and LRC machine.",
                  },
                  {
                    name: "BCU Alarm Parameters Dashboard",
                    description: "Monitor the BCU alarm parameters through alerts and charts, with options to filter by status, interlock, and date range.",
                  },
                  {
                    name: "Equipment Under Maintenance & Faulty Dashboard",
                    description: "Track equipment that is under maintenance or in faulty status, along with trend analysis and detailed maintenance records for the equipment listed below.",
                    equipmentTabs: ["ESD", "Fire Engine", "HCD", "MOV", "Radar", "ROSOV", "Tank", "VFT"],
                  },
                  {
                    name: "BCU Critical Parameters Dashboard",
                    description: "BCU analog parameters: For the parameters listed below, provide detailed information along with a line chart and an alerts table, with monthly and weekly filter options available.",
                    equipmentTabs: [
                      "Local Loaded TT",
                      "Bay Reassignment/Manual Bay Assignment",
                      "Unauthorised Flow",
                      "Sick TT",
                      "Cancelled TTS",
                      "K-Factor Changes",
                      "MFM K Factor",
                      "Manual Fan Printed",
                      "Overloaded TT",
                    ],
                  },
                  {
                    name: "Safety Parameters Dashboard",
                    description: "View trends and analytics for safety parameters, for below listed equipment.",
                    equipmentTabs: ["Radar", "VFT", "Hcd", "Esd", "Dyke", "Gantry Override"],
                  },
                  {
                    name: "Process Parameters Dashboard",
                    description: "View trends and analytics for process parameters, for below listed equipment.",
                    equipmentTabs: ["Tank Leakage", "Ups", "Plc", "Primary Level", "Lrc Switchover"],
                  },
                  {
                    name: "Gantry Shutdown",
                    description: "View gantry shutdown events, history, and related information.",
                  },
                  {
                    name: "ESD Shutdown",
                    description: "View ESD events, history, and related information.",
                  },
                ].map((tab, index) => (
                  <Tab
                    key={tab.name}
                    className={`relative px-2 py-2 text-s font-medium transition-colors text-center flex items-center justify-center gap-1 ${
                      tab.name === "Equipment Under Maintenance & Faulty Dashboard"
                        ? "flex-[1.5] min-w-[170px]"
                        : "flex-1"
                    } ${activeTab === index ? "text-blue-500" : "text-gray-600"}`}
                  >
                    <span className="leading-tight">{tab.name}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          // className="inline-flex shrink-0 items-center justify-center w-5 h-5  border border-blue-500 text-blue-500 hover:text-blue-600 hover:border-blue-600 cursor-help outline-none ring-0 focus:outline-none focus:ring-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="max-w-[340px] rounded-lg px-4 py-3 text-xs text-white bg-blue-600 bg-gradient-to-b shadow-sm"
                      >
                        {tab.name === "BCU Alarm Parameters Dashboard" ? (
                          <div className="space-y-3 text-white">
                            <p className="leading-relaxed text-white">
                              {tab.description}
                            </p>
                            <div className="border-t border-gray-400/50 pt-2">
                              <p className="font-semibold mb-2 text-white">Available interlocks</p>
                              <ul className="list-none space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                {BCU_INTERLOCK_NAMES_TOOLTIP.map((name, i) => (
                                  <li key={name} className="flex gap-2 items-start text-white">
                                    <span className="shrink-0 w-5 text-right font-medium tabular-nums text-white">{i + 1}.</span>
                                    <span className="leading-snug break-words text-white">{name}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : (tab as { equipmentTabs?: string[] }).equipmentTabs ? (
                          <div className="space-y-3 text-white">
                            <p className="leading-relaxed text-white">{tab.description}</p>
                            <div className="border-t border-gray-400/50 pt-2">
                              <p className="font-semibold mb-2 text-white">Equipment tabs</p>
                              <ul className="list-none space-y-1.5 pr-1">
                                {(tab as { equipmentTabs: string[] }).equipmentTabs.map((item, i) => (
                                  <li key={item} className="flex gap-2 items-start text-white">
                                    <span className="shrink-0 w-5 text-right font-medium tabular-nums text-white">{i + 1}.</span>
                                    <span className="leading-snug break-words text-white">{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <p className="leading-relaxed text-white">{tab.description}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    {activeTab === index && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                    )}
                  </Tab>
                ))}
              </TooltipProvider>
            </TabList>

            <TabPanels className="p-2">
              <TabPanel>
                {loadedTabs.has(0) && activeTab === 0 && (
                  <FlowContainer
                    plant={selectedPlant}
                    key={`location-view-${locationViewRefreshKey}`}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(1) && activeTab === 1 && (
                  <>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                      <div className="flex-1 min-w-0">
                        <FaultGantry
                          onBcuNumberSelect={handleBcuNumberSelect}
                          filters={filters}
                          onDateRangeSelect={handleDateRangeSelect}
                          onInterlockSelect={handleInterlockSelection}
                          onInterlockOptionsLoaded={handleInterlockOptionsLoaded}
                          zone={selectedZone}
                          plant={selectedPlant}
                          onRefresh={handleRefreshTable}
                          onAlertStatusChange={handleAlertStatusChange}
                        />
                      </div>
                    </div>

                    {isDateRangeSelected && ( // Only render BCUAlertsTable when a date range is selected
                      <BCUAlertsTable
                        query={querybcuResult.baseQuery}
                        selectedInterlock={selectedInterlock}
                        onLocationChange={handleLocationChange}
                        onAlertStatusChange={handleAlertStatusChange}
                        key={`open-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${selectedName}-${selectedFromDate}-${selectedToDate}-${selectedBcuNumber}-${tableRefreshKey}`}
                      />
                    )}
                  </>
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(2) && activeTab === 2 && (
                  <>
                    <div>
                      <Grid container spacing={1} style={{ paddingLeft: 0 }}>
                        <Grid item xs={12} style={{ paddingTop: 0 }}>
                          <TerminalTable zone={selectedZone} plant={selectedPlant} />
                          <TASMaintenanceChart
                            filters={filters}
                            zone={selectedZone}
                            plant={selectedPlant}
                            onDateRangeSelect={handleDateRangeSelectmaintenance}
                            onEquipmentSelect={handleEquipmentSelect}
                            onDeviceSelect={handleDeviceSelect}
                            onRowClick={handleRowClickEquipment}
                            onChartDateSelect={handleChartDateSelect}
                            clearChartFilterTrigger={clearChartFilterTrigger}
                            onMaintenanceLoadingChange={setMaintenanceChartLoading}
                            onMaintenanceDataChange={setMaintenanceApiData}
                          />
                        </Grid>
                        {/* <Grid item xs={12} style={{paddingTop:0}}>
                              <SafetyChart/>
                            </Grid> */}
                      </Grid>
                    </div>
                    <div>
                      {(isDateRangeMSelected || (chartClickedDate && chartClickedDate.trim() !== "")) && ( // Only render MaintenanceTable when a date range or chart date is selected
                        <>
                          {/* Chart Date Filter Indicator */}
                          {chartClickedDate && chartClickedDate.trim() !== "" && (
                            <div className="mb-2 inline-flex flex-wrap items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                              <span className="text-sm text-gray-700">
                                Date Filter Applied:
                              </span>
                              <span className="text-sm font-semibold text-green-700">
                                {chartClickedIsMonth ? `Month: ${chartClickedDate}` : `Date: ${chartClickedDate}`}
                              </span>
                              <button
                                onClick={() => {
                                  setChartClickedDate(null)
                                  setChartClickedIsMonth(false)
                                  setClearChartFilterTrigger((t) => t + 1)
                                }}
                                className="flex items-center justify-center w-5 h-5 rounded-full bg-green-200 hover:bg-green-300 text-green-700 transition-colors shrink-0"
                                title="Remove Date filter"
                                aria-label="Remove Date filter"
                              >
                                <span className="text-xs font-bold">×</span>
                              </button>
                            </div>
                          )}
                          {/* Equipment Select Filter Indicator */}
                          {selectedEquipment && selectedEquipment !== "All Equipment" && (
                            <div className="mb-2 inline-flex flex-wrap items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                              <span className="text-sm text-gray-700">
                                Equipment Filter Applied:
                              </span>
                              <span className="text-sm font-semibold text-purple-700">
                                {selectedEquipment}
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedEquipment("All Equipment")
                                  if (handleEquipmentSelect) {
                                    handleEquipmentSelect("All Equipment")
                                  }
                                }}
                                className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-200 hover:bg-purple-300 text-purple-700 transition-colors shrink-0"
                                title="Remove Equipment filter"
                                aria-label="Remove Equipment filter"
                              >
                                <span className="text-xs font-bold">×</span>
                              </button>
                            </div>
                          )}
                          {/* Equipment ID Filter Indicator */}
                          {selectedDevice && selectedDevice !== "All Devices" && (
                            <div className="mb-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                              <span className="text-sm text-gray-700">
                                Equipment ID Filter Applied:
                              </span>
                              <span className="text-sm font-semibold text-blue-700">
                                {selectedDevice}
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedDevice("All Devices")
                                  if (handleDeviceSelect) {
                                    handleDeviceSelect("All Devices")
                                  }
                                }}
                                className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 hover:bg-blue-300 text-blue-700 transition-colors"
                                title="Remove Equipment ID filter"
                                aria-label="Remove Equipment ID filter"
                              >
                                <span className="text-xs font-bold">×</span>
                              </button>
                            </div>
                          )}
                          <MaintenanceTable
                            query={queryResult.baseQuery}
                            onLocationChange={handleLocationChange}
                            zone={selectedZone}
                            plant={selectedPlant}
                            maintenanceData={maintenanceApiData}
                            externalLoading={maintenanceChartLoading}
                            key={`open-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${selectedZone}-${selectedPlant}-${selectedmaintenanceFromDate}-${selectedmaintenanceToDate}-${clickedEquipmentName}-${selectedDevice}-${chartClickedDate}-${chartClickedIsMonth}`} // Added chart clicked date to key
                          />
                        </>
                      )}
                    </div>
                  </>
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(3) && activeTab === 3 && (
                  <BCUCrticalParamsWrapper
                    filters={filters}
                    zone={selectedZone}
                    plant={selectedPlant}
                  />
                )}
              </TabPanel>
              {/* <TabPanel>
                {loadedTabs.has(3) && (
                  <RegularAlertTable
                    query={getQuery("Close", 3)}
                    onLocationChange={handleLocationChange}
                    key={`closed-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}`}
                  />
                )}
              </TabPanel> */}
              <TabPanel>
                {loadedTabs.has(4) && activeTab === 4 && (
                  <>
                    <TASTrendDashboard filters={filters} zone={selectedZone} plant={selectedPlant} initialTabIndex={0} />
                  </>
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(5) && activeTab === 5 && (
                  <>
                    <TASTrendDashboard filters={filters} zone={selectedZone} plant={selectedPlant} initialTabIndex={1} />
                  </>
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(6) && activeTab === 6 && (
                  <>
                    <GantryShutdownPage filters={filters} bu="tas" />
                  </>
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(7) && activeTab === 7 && (
                  <>
                    <ESDShutdownPage filters={filters} bu="tas" />
                  </>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
         <TASGpt />
      </SeverityProvider>
    </div>
  )
}

export default TerminalAutomation

