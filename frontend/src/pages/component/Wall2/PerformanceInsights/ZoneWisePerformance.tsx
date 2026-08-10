import React, { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/@/components/ui/card"
import ExplodingPieChart from "./ExplodingPieChart"
import { IconArrowLeft, IconRestore } from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip"
import { toast } from "sonner"
import { fetchChartData, fetchDistinctValues } from "../api"
import dayjs from "dayjs"
import {
  getIndianFiscalYearMeta,
  getDefaultFiscalYearDropdownValue,
  parseFiscalYearLabel,
  getPreviousFYSbuDateRangeDefaults,
} from "@/utils/fiscalYearUtils"
import TablePerformancesales from "../TablePerformancesales"
import convertToFilters from "@/utils/dynamicFilter"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Calendar } from "lucide-react"
import { Button } from "@/@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/@/components/ui/toggle-group"
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import ZoneWiseFilterMenu from "./ZoneWiseFilterMenu"
import { Badge } from "@/@/components/ui/badge"

interface ChartData {
  name: string
  [key: string]: number | string
}

type ChartMode = "month" | "year" | "ytd" | "date"

interface ActiveStates {
  A: boolean
  H: boolean
  T: boolean
  C?: boolean
}

interface Filter {
  key: string
  cond: string
  value: string
}

interface FilterOption {
  key: string
  cond: string
  value: string
}

interface FilterState {
  SBU_Name: string
  Zone_Name: string
  Region_Name: string
  SalesArea_Name: string
  ProductName: string
}

const categoryData = {
  A: { color: "#6366f1", name: "Actual", title: "Act" },
  H: { color: "#06b6d4", name: "Historical", title: "Hist" },
  T: { color: "#f59e0b", name: "Target", title: "Tgt" },
}

const haButtonsData = {
  A: { color: "#00a495", name: "Actual", title: "Act" },
  H: { color: "#a3bf02", name: "Historical", title: "Hist" },
}

const tButtonsData = {
  T: { color: "#dea600", name: "Target", title: "Tgt" },
}

const getXAxisKey = (drillLevel: number, selected: "Y" | "M"): string => {
  const keys =
    selected === "Y"
      ? ["cumulative", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName", "month_name"]
      : ["month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"]
  return keys[drillLevel] || "ProductName"
}

const transformChartData = (
  responseData: any,
  mode: ChartMode,
  drillLevel: number,
  activeStates: ActiveStates,
  selected: string,
): ChartData[] => {
  if (!responseData) return []
  const validSelected: "Y" | "M" = selected === "M" ? "M" : "Y"
  const isArray = Array.isArray(responseData)
  const xAxisKey = getXAxisKey(drillLevel, validSelected)

  if (!isArray) {
    if (drillLevel === 0) {
      const dataKey = responseData.month_name ? "month_name" : "cumulative"
      return Object.keys(responseData[dataKey] || {})
        .map((key) => ({
          name: responseData[dataKey][key] ?? "",
          ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
          TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
          ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
        }))
        .filter(
          (item) =>
            item.name.trim() !== "" &&
            (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0),
        )
    }

    return Object.keys(responseData[xAxisKey] || {})
      .map((key) => ({
        name: responseData[xAxisKey]?.[key] ?? "",
        ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
        TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
        ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
      }))
      .filter(
        (item) =>
          item.name.trim() !== "" &&
          (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0),
      )
  }

  return responseData.map((item: any) => ({
    name: item[xAxisKey] || "",
    ...(activeStates.A &&
      (item?.NETWEIGHT_TMT
        ? { NETWEIGHT_TMT: item.NETWEIGHT_TMT }
        : item?.ACTUAL_TMT_SALES
          ? { ACTUAL_TMT_SALES: item.ACTUAL_TMT_SALES }
          : {})),
    ...(activeStates.T && { TARGET_QTY_TMT: item.TARGET_QTY_TMT }),
    ...(activeStates.H && { ACTUAL_HISTORY_TMT_SALES: item.ACTUAL_HISTORY_TMT_SALES }),
  }))
}

const createFilters = (activeStates: ActiveStates): Filter[] => {
  return Object.entries(activeStates)
    .filter(([, isActive]) => isActive)
    .map(([stateKey]) => ({
      key: `"${stateKey}"`,
      cond: "equals",
      value: "true",
    }))
}

const getInitialDrilldownList = (selectedYorM: "Y" | "M") => {
  return selectedYorM === "Y"
    ? [
      { key: "cumulative", isActive: false, drillLevel: 1 },
      { key: "SBU_Name", isActive: false, drillLevel: 2 },
      { key: "Zone_Name", isActive: false, drillLevel: 3 },
      { key: "Region_Name", isActive: false, drillLevel: 4 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
      { key: "ProductName", isActive: false, drillLevel: 6 },
      { key: "month_name", isActive: false, drillLevel: 7 },
    ]
    : [
      { key: "month_name", isActive: false, drillLevel: 1 },
      { key: "SBU_Name", isActive: false, drillLevel: 2 },
      { key: "Zone_Name", isActive: false, drillLevel: 3 },
      { key: "Region_Name", isActive: false, drillLevel: 4 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
      { key: "ProductName", isActive: false, drillLevel: 6 },
    ]
}


const ZoneWisePerformance: React.FC<{ sbu?: string }> = ({ sbu }) => {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [drillLevel, setDrillLevel] = useState(0)

  const [filters, setFilters] = useState<FilterState>({
    SBU_Name: sbu ?? "",
    Zone_Name: "",
    Region_Name: "",
    SalesArea_Name: "",
    ProductName: "",
  })

  const [distinctFilters, setDistinctFilters] = useState<FilterState>({
    SBU_Name: sbu ?? "",
    Zone_Name: "",
    Region_Name: "",
    SalesArea_Name: "",
    ProductName: "",
  })

  const [activeStates, setActiveStates] = useState<ActiveStates>({
    A: true,
    H: true,
    T: true,
    C: true,
  })
  const perspectiveFilters = convertToFilters({ A: true, H: true, T: true, C: false })
  const [appliedFilters, setAppliedFilters] = useState<FilterOption[]>(() => {
    const base = convertToFilters({ A: true, H: true, T: true, C: false })
    if (sbu) return [...base, { key: '"SBU_Name"', cond: "equals", value: sbu }]
    return base
  })
  const filterOrder = ["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"]

  const [isLoading, setIsLoading] = useState(true)
  const [isResponse, setIsResponses] = useState(false)
  const [chartApiMessage, setChartApiMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<ChartMode>("ytd")

  const [drillHistory, setDrillHistory] = useState<string[]>(() =>
    mode === "month" ? [`FY ${getDefaultFiscalYearDropdownValue()}`] : [],
  )

  const [selectedYear, setSelectedYear] = useState(() => getDefaultFiscalYearDropdownValue())
  const [selectedSBU, setSelectedSBU] = useState(sbu ?? "")
  const [selectedZone, setSelectedZone] = useState("")
  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedSalesArea, setSelectedSalesArea] = useState("")
  const [selectedProductName, setSelectedProductName] = useState<string[]>([])

  const [yearOptions] = useState<string[]>([])
  const [sbuOptions, setSbuOptions] = useState<string[]>([])
  const [zoneOptions, setZoneOptions] = useState<string[]>([])
  const [regionOptions, setRegionOptions] = useState<string[]>([])
  const [salesAreaOptions, setSalesAreaOptions] = useState<string[]>([])
  const [productOptions, setProductOptions] = useState<string[]>([])

  const [isOpen, setIsOpen] = useState(false)
  const [crossFilters, setCrossFilters] = useState<Filter[]>([])
  const [salesUnit, setSalesUnit] = useState<string>("TMT")
  const [selectedYorM, setSelectedYorM] = useState<"Y" | "M">("M")

  const firstDayOfMonth = dayjs().date(1).month(3)
  const yesterday = dayjs().subtract(1, "day")
  const [fromDate, setFromDate] = useState(firstDayOfMonth)
  const [toDate, setToDate] = useState(yesterday)
  const [displayFromDate, setDisplayFromDate] = useState<dayjs.Dayjs | null>(null)
  const [displayToDate, setDisplayToDate] = useState<dayjs.Dayjs | null>(null)
  const { currentFY, previousFY } = getIndianFiscalYearMeta()

  let [drilldownList, setDrilldownList] = useState(getInitialDrilldownList(selectedYorM))

  useEffect(() => {
    setDrilldownList(getInitialDrilldownList(selectedYorM))
  }, [selectedYorM])

  const removeDuplicateFilters = (data: FilterOption[]) => {
    const filterMap = new Map()
      ;[...data].reverse().forEach((filter) => {
        if (!filterMap.has(filter.key)) filterMap.set(filter.key, filter)
      })
    return Array.from(filterMap.values()).reverse()
  }

  const distinctFilterChange = (key: keyof FilterState, value: string) => {
    const currentIndex = filterOrder.indexOf(key)
    const newFilters = { ...distinctFilters }
    filterOrder.forEach((filterKey, index) => {
      if (index === currentIndex) {
        newFilters[filterKey as keyof FilterState] = value
      } else if (index > currentIndex) {
        newFilters[filterKey as keyof FilterState] = ""
      } else {
        newFilters[filterKey as keyof FilterState] = distinctFilters[filterKey as keyof FilterState]
      }
    })
    setDistinctFilters(newFilters)

    const newAppliedFilters: FilterOption[] = []
    filterOrder.forEach((filterKey, index) => {
      if (index < currentIndex && newFilters[filterKey as keyof FilterState]) {
        newAppliedFilters.push({
          key: `${filterKey}`,
          cond: "=",
          value: newFilters[filterKey as keyof FilterState],
        })
      }
    })
    if (value) {
      newAppliedFilters.push({ key: `${key}`, cond: "=", value })
    }
    return newAppliedFilters
  }

  useEffect(() => {
    const fyParsed = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    let fromdate: dayjs.Dayjs
    let todate: dayjs.Dayjs
    if (fyParsed && selectedYear === prevFY) {
      const d = getPreviousFYSbuDateRangeDefaults(fyParsed)
      fromdate = d.from
      todate = d.to
    } else if (fyParsed) {
      fromdate = dayjs().year(fyParsed.start).month(3).date(1)
      todate = dayjs().subtract(1, "day")
    } else {
      return
    }
    setFromDate(fromdate)
    setToDate(todate)
  }, [mode, selectedYear])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const currentIndex = filterOrder.indexOf(key)
    const newFilters = { ...filters }
    filterOrder.forEach((filterKey, index) => {
      if (index === currentIndex) {
        newFilters[filterKey as keyof FilterState] = value
      } else if (index > currentIndex) {
        newFilters[filterKey as keyof FilterState] = ""
      } else {
        newFilters[filterKey as keyof FilterState] = filters[filterKey as keyof FilterState]
      }
    })
    setFilters(newFilters)

    const newAppliedFilters: FilterOption[] = []
    filterOrder.forEach((filterKey, index) => {
      if (index < currentIndex && newFilters[filterKey as keyof FilterState]) {
        newAppliedFilters.push({
          key: `"${filterKey}"`,
          cond: "equals",
          value: newFilters[filterKey as keyof FilterState],
        })
      }
    })
    if (value) {
      newAppliedFilters.push({ key: `"${key}"`, cond: "equals", value })
    }
    setAppliedFilters(newAppliedFilters)
    return newAppliedFilters
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      mode === "ytd" ? appliedFilters.push({ key: '"YTD"', cond: "equals", value: "true" }) : appliedFilters
      const originalFilter = removeDuplicateFilters(appliedFilters)
      const originalCrossFilter = removeDuplicateFilters(crossFilters)

      const fiscalYearFilter = { key: '"fiscal_year"', cond: "equals", value: selectedYear }
      const hasYearFilter = originalFilter.some((filter) => filter.key === '"fiscal_year"')
      const baseFilters = hasYearFilter ? originalFilter : [...originalFilter, fiscalYearFilter]
      const filtersToSend = selectedYorM === "M"
        ? baseFilters.filter((f) => f.key !== '"C"')
        : baseFilters

      const response = await fetchChartData({
        filters: filtersToSend,
        cross_filters: originalCrossFilter,
        action: mode === "month" || mode === "ytd" || mode === "date" ? "m60_performance" : "yearly_sales_performance",
        drill_state: "",
      })
      const newSalesUnit = response?.data?.sales_unit || "TMT"
      setSalesUnit(newSalesUnit)

      if (response.status === false) {
        setChartData([])
        setChartApiMessage(
          typeof response.message === "string" && response.message.trim()
            ? response.message
            : "No data available for the selected filters.",
        )
        setIsResponses(false)
        setIsLoading(false)
        return
      }

      if (response.status && response.data) {
        setChartApiMessage(null)
        if (
          Object.keys(response.data.data?.ACTUAL_HISTORY_TMT_SALES).length === 0 ||
          Object.keys(response.data.data?.ACTUAL_TMT_SALES).length === 0
        ) {
          toast.warning("No data present for the selected combination. Please select some other combination.")
          setIsLoading(false)
          return
        }
        const isAllZero =
          Object.values(response.data.data?.ACTUAL_TMT_SALES).every((value) => value === 0) &&
          Object.values(response.data.data?.TARGET_TMT_SALES).every((value) => value === 0) &&
          Object.values(response.data.data?.ACTUAL_HISTORY_TMT_SALES).every((value) => value === 0)

        if (isAllZero) {
          toast.warning("No data found for the selected combination! All sales values are 0.")
          setIsLoading(false)
          setIsResponses(false)
        }

        const transformedData = transformChartData(response.data?.data, mode, drillLevel, activeStates, selectedYorM)
        setChartData(transformedData)
        setIsResponses(true)
      } else {
        setChartData([])
        setChartApiMessage(
          typeof response.message === "string" && response.message.trim()
            ? response.message
            : "No data available for the selected filters.",
        )
        setIsResponses(false)
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
      setIsResponses(false)
      setChartApiMessage(null)
      toast.error("Error fetching data. Please try again.")
      console.error("Error fetching data:", error)
    }
    setIsLoading(false)
  }, [filters, drillLevel, mode, activeStates, appliedFilters, crossFilters, selectedYear])

  useEffect(() => {
    handleModeChange("ytd")
    setMode("ytd")
  }, [])

  useEffect(() => {
    loadData()
  }, [drillLevel, appliedFilters, crossFilters])

  const loadDistinctValues = useCallback(async (column: string[], whereCond: any = []) => {
    whereCond = [
      ...whereCond,
      { key: "Zone_Name", value: "-", cond: "!=" },
      { key: "Zone_Name", value: "", cond: "!=" },
      { key: "SBU_Name", value: "0", cond: "!=" },
    ]
    try {
      const response = await fetchDistinctValues({
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        column,
        where_cond: whereCond,
      })
      if (response.status && response.data) return response.data
    } catch (error) {
      console.error(`Error fetching distinct values for ${column}:`, error)
    }
    return []
  }, [])

  const fetchProductName = useCallback(async (column: string[], whereCond: any = []) => {
    whereCond = [
      ...whereCond,
      { key: "Zone_Name", value: "-", cond: "!=" },
      { key: "Zone_Name", value: "", cond: "!=" },
      { key: "SBU_Name", value: "0", cond: "!=" },
      { key: "ProductName", value: "", cond: "!=" },
    ]
    try {
      const response = await fetchDistinctValues({
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        column,
        where_cond: whereCond,
      })
      if (response.status && response.data) return response.data
    } catch (error) {
      console.error(`Error fetching distinct values for ${column}:`, error)
    }
    return []
  }, [])

  useEffect(() => {
    const initializeFilters = async () => {
      if (sbu) {
        // When SBU is locked, load only dependent options for that SBU
        const whereCond = [{ key: "SBU_Name", cond: "=", value: sbu }]
        const product = await fetchProductName(["ProductName"])
        const alldropdownOption = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name"], whereCond)
        setZoneOptions(alldropdownOption?.["Zone_Name"])
        setRegionOptions(alldropdownOption?.["Region_Name"])
        setSalesAreaOptions(alldropdownOption?.["SalesArea_Name"])
        setProductOptions(product?.["ProductName"] ?? [])
      } else {
        const sbus = await loadDistinctValues(["SBU_Name"])
        const product = await fetchProductName(["ProductName"])
        const removeItems = ["Common", "Mumbai Ref", "Renewable Energy", "Visakh Ref"]
        const updatedData = sbus["SBU_Name"].map((item: string) => (item === "PETROCHEMICALS SBU" ? "PetChem" : item))
        const SBU_Name = updatedData.filter((item: string) => !removeItems.includes(item))
        setSbuOptions(SBU_Name)
        const alldropdownOption = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name"])
        setZoneOptions(alldropdownOption?.["Zone_Name"])
        setRegionOptions(alldropdownOption?.["Region_Name"])
        setSalesAreaOptions(alldropdownOption?.["SalesArea_Name"])
        setProductOptions(product?.["ProductName"] ?? [])
      }
    }
    initializeFilters()
  }, [mode, loadDistinctValues, fetchProductName])

  const toggleButtonState = (key: keyof ActiveStates) => {
    setActiveStates((prevStates) => {
      const updatedStates = { ...prevStates }
      if (key === "T" && !prevStates.A) {
        toast.error("Target can only be selected if Actual is selected", { position: "top-right" })
        return prevStates
      }
      if (key === "A" && !updatedStates[key] && updatedStates.T) {
        updatedStates.T = false
      }
      updatedStates[key] = !updatedStates[key]
      if (!updatedStates["A"] && !updatedStates["H"] && !updatedStates["T"]) {
        toast.info("At least one option must be selected.")
        return prevStates
      }
      if (selectedYorM === "M") updatedStates["C"] = false
      setAppliedFilters((prevFilters) => {
        const newFilters = prevFilters.filter((filter) => !["A", "H", "T"].includes(filter.key.replace(/"/g, "")))
        const updatedFilters = createFilters(updatedStates)
        return [...newFilters, ...updatedFilters]
      })
      return updatedStates
    })
  }

  function updateFiltersToCrossFilter(filters: FilterOption[], crossFilters: Filter[]) {
    const filterMap = new Map()
    filters.forEach((item) => filterMap.set(item.key, item.value))
    let newCrossFilters = [...crossFilters]
    newCrossFilters = newCrossFilters.filter(
      (item) => item.key === '"month_name"' || item.key === '"DATE"' || filterMap.has(item.key),
    )
    newCrossFilters.forEach((item) => {
      if (filterMap.has(item.key) && item.key !== '"month_name"' && item.key !== '"DATE"') {
        item.value = filterMap.get(item.key)
      }
    })
    filters.forEach((item) => {
      if (!newCrossFilters.some((cf) => cf.key === item.key)) {
        newCrossFilters.push({ ...item })
      }
    })
    return newCrossFilters
  }

  const syncWithDropdowns = async (key: string, value: string | string[]) => {
    switch (key) {
      case "SBU_Name":
        setSelectedSBU(value as string)
        handleSBUChange(key, value as string)
        break
      case "Zone_Name":
        setSelectedZone(value as string)
        handleZoneChange(key, value as string)
        break
      case "Region_Name":
        setSelectedRegion(value as string)
        handleRegionChange(key, value as string)
        break
      case "SalesArea_Name":
        setSelectedSalesArea(value as string)
        handleSalesAreaChange(key, value as string)
        break
      case "ProductName":
        const productValue = typeof value === "string" ? [value] : value
        setSelectedProductName(productValue)
        handleProductNameChange(key, productValue)
        break
    }
  }

  let newCrossFilters: Filter[] = []
  let ytd: FilterOption[] = []

  const handleBarClick = useCallback(
    (entry: any) => {
      if (drillLevel >= 6) {
        toast.info("You have reached the maximum drill-down level.")
        return
      }

      const newFiltersLocal = [...appliedFilters]
      const filterKeys =
        selectedYorM === "Y"
          ? ["cumulative", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName", "month_name"]
          : ["month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"]

      newCrossFilters = [...crossFilters]
      newCrossFilters.push({
        key: entry.name === "CUMMULATIVE_SALES" ? '"cumulative"' : `"${filterKeys[drillLevel]}"`,
        cond: "equals",
        value: entry.name === "CUMMULATIVE_SALES" ? "true" : entry.name,
      })
      if (mode === "ytd") ytd = [{ key: '"YTD"', cond: "equals", value: "true" }]

      const perspectiveFiltersLocal = appliedFilters.filter((filter) =>
        ["A", "H", "T"].includes(filter.key.replace(/"/g, "")),
      )
      const combined = [...newFiltersLocal, ...perspectiveFiltersLocal, ...ytd]
      const removeDups = [...new Set(combined)]
      setAppliedFilters(removeDups)
      setCrossFilters(newCrossFilters)
      if (isResponse) {
        setDrillLevel((prev) => prev + 1)
        setDrillHistory([...drillHistory, entry.name])
        syncWithDropdowns(filterKeys[drillLevel], entry.name)
      }
    },
    [drillLevel, appliedFilters, drillHistory, mode, selectedYorM, isResponse],
  )

  const handleBackClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      if (drillLevel > 0) {
        const activeDrills = drilldownList.filter((drill) => drill.isActive)
        if (drillLevel === 1) {
          resetFilters()
          return
        }
        if (activeDrills.length === 1 || activeDrills === null) {
          const updatedCrossFilters = [{ key: '"cumulative"', cond: "equals", value: "true" }]
          setCrossFilters(updatedCrossFilters)
          appliedFilters.length > 5 ? setAppliedFilters(appliedFilters.slice(0, -1)) : setAppliedFilters(appliedFilters)
          setDrillHistory((prev) => [...prev.slice(0, -1)])
          setDrillLevel((prev) => prev - 1)
          return
        }
        const lastActiveDrill = activeDrills.length > 0 ? activeDrills[activeDrills.length - 1] : null
        const lastActiveCount = activeDrills.length > 1 ? activeDrills.slice(-2, -1)[0] : null
        const drillcount = lastActiveDrill ? lastActiveCount?.drillLevel ?? 0 : 0
        setDrillLevel(drillcount)

        if (activeDrills.length > 1) {
          const updatedList = drilldownList.map((drill) => {
            if (drill.key === lastActiveDrill?.key) return { ...drill, isActive: false }
            return drill
          })
          drilldownList = updatedList
          setDrilldownList(updatedList)
        }

        const updatedCrossFilters = crossFilters.filter(
          (filter) => filter.key.replace(/"/g, "") !== lastActiveDrill?.key,
        )
        setCrossFilters(updatedCrossFilters)
        appliedFilters.length > 5 ? setAppliedFilters(appliedFilters.slice(0, -1)) : setAppliedFilters(appliedFilters)
        setDrillHistory((prev) => [...prev.slice(0, -1)])
      }
    },
    [drillLevel, appliedFilters, drillHistory, mode, selectedYorM, drilldownList, crossFilters],
  )

  const resetFilters = useCallback(async () => {
    setSelectedYorM("M")
    const statesMonthly: ActiveStates = { ...activeStates, C: false }
    setActiveStates(statesMonthly)
    const resetFilter = [{ key: '"YTD"', cond: "equals", value: "true" }]
    const sbuFilter = sbu ? [{ key: '"SBU_Name"', cond: "equals", value: sbu }] : []
    const fiscalYearFilter = { key: '"fiscal_year"', cond: "equals", value: selectedYear }
    const perspectiveFiltersMonthly = convertToFilters(statesMonthly)

    setDrillLevel(0)
    setMode("ytd")
    setDrilldownList(getInitialDrilldownList("M"))
    setAppliedFilters([...resetFilter, ...perspectiveFiltersMonthly, ...sbuFilter, fiscalYearFilter])

    const fyParsed = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    let newFromDate: dayjs.Dayjs
    let newToDate: dayjs.Dayjs
    if (fyParsed && selectedYear === prevFY) {
      const d = getPreviousFYSbuDateRangeDefaults(fyParsed)
      newFromDate = d.from
      newToDate = d.to
    } else if (fyParsed) {
      newFromDate = dayjs().year(fyParsed.start).month(3).date(1)
      newToDate = dayjs().subtract(1, "day")
    } else {
      newFromDate = firstDayOfMonth
      newToDate = yesterday
    }
    setFromDate(newFromDate)
    setToDate(newToDate)
    setDisplayFromDate(null)
    setDisplayToDate(null)
    setCrossFilters([])
    setSelectedSBU(sbu ?? "")
    setSelectedZone("")
    setSelectedRegion("")
    setSelectedSalesArea("")
    setSelectedProductName([])
    setDrillHistory(mode === "month" ? [`FY ${selectedYear}`] : [])
    setFilters({
      SBU_Name: sbu ?? "",
      Zone_Name: "",
      Region_Name: "",
      SalesArea_Name: "",
      ProductName: "",
    })
  }, [mode, filters, appliedFilters, crossFilters, selectedYear, sbu, activeStates])

  const handleModeChange = useCallback(
    (newMode: ChartMode) => {
      if (newMode === "month" && mode === "month" && !appliedFilters.length) return
      if (newMode === mode && mode === "ytd") {
        // Deselecting YTD → switch to date mode and immediately apply the current date range
        const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
        setMode("date")
        setDisplayFromDate(fromDate)
        setDisplayToDate(toDate)
        setAppliedFilters((prev) => {
          const withoutYtd = prev.filter(
            (item) => item.key !== '"YTD"' && (selectedYorM === "Y" || item.key !== '"C"'),
          )
          // Replace or add the DATE filter
          const withoutDate = withoutYtd.filter((item) => item.key !== '"DATE"')
          return [...withoutDate, { key: '"DATE"', cond: "equals", value: formattedDates }]
        })
        return
      }
      setMode(newMode)
      if (newMode === "year") {
        setDrillHistory([])
        resetFilters()
      } else if (newMode === "month") {
        setDrillHistory([`FY ${selectedYear}`])
        resetFilters()
      } else if (newMode === "ytd") {
        setDisplayFromDate(null)
        setDisplayToDate(null)
        setAppliedFilters((prev) => {
          const filtersWithoutDate = prev.filter((item) => item.key !== '"DATE"' && (selectedYorM === "Y" || item.key !== '"C"'))
          return [...filtersWithoutDate, { key: '"YTD"', cond: "equals", value: "true" }]
        })
        setMode("ytd")
      } else {
        setDrillHistory([`FY ${selectedYear}`])
      }
    },
    [mode, filters, crossFilters, resetFilters],
  )

  const handleYearChange = (value: string) => {
    const fy = parseFiscalYearLabel(value)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    let fromdate: dayjs.Dayjs
    let todate: dayjs.Dayjs
    if (fy && value === prevFY) {
      const d = getPreviousFYSbuDateRangeDefaults(fy)
      fromdate = d.from
      todate = d.to
    } else if (fy) {
      fromdate = dayjs().year(fy.start).month(3).date(1)
      todate = dayjs().subtract(1, "day")
    } else {
      return
    }
    setFromDate(fromdate)
    setToDate(todate)
    setSelectedYear(value)
    setAppliedFilters((prev) => {
      const withoutFy = prev.filter((f) => f.key !== '"fiscal_year"')
      return [...withoutFy, { key: '"fiscal_year"', cond: "equals", value }]
    })
  }

  const handleSBUChange = async (key: string, value: string) => {
    const defaultFilter = handleFilterChange("SBU_Name", value)
    const distinctValues = distinctFilterChange("SBU_Name", value)

    let higherLevelFilter: FilterOption[] = []
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters)
      setCrossFilters(higherLevelFilter)
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }))
      setDrilldownList(drilldownList)
      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive)
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0
      setDrillLevel(drillcount)
      setDrillHistory([`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)])
    }

    setSelectedSBU(value)
    setSelectedZone("")
    setSelectedRegion("")
    setSelectedSalesArea("")
    setSelectedProductName([])

    let dateFilters: FilterOption[] = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    const perspectiveFiltersLocal = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFiltersLocal, ...ytdFilters, ...dateFilters, ...defaultFilter])

    try {
      const response = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], distinctValues)
      if (response) {
        setZoneOptions(response["Zone_Name"])
        setRegionOptions(response["Region_Name"])
        setSalesAreaOptions(response["SalesArea_Name"])
        setProductOptions(response["ProductName"])
        if (response?.["Zone_Name"]?.length === 1) setSelectedZone(response["Zone_Name"][0])
        if (response?.["Region_Name"]?.length === 1) setSelectedRegion(response["Region_Name"][0])
        if (response?.["SalesArea_Name"]?.length === 1) setSelectedSalesArea(response["SalesArea_Name"][0])
      }
    } catch (error) {
      console.log(error)
    }
  }

  const handleZoneChange = async (key: string, value: string) => {
    const defaultFilter = handleFilterChange("Zone_Name", value)
    const distinctValues = distinctFilterChange("Zone_Name", value)

    setSelectedZone(value)
    setSelectedRegion("")
    setSelectedSalesArea("")
    setSelectedProductName([])

    let dateFilters: FilterOption[] = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    const perspectiveFiltersLocal = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFiltersLocal, ...ytdFilters, ...dateFilters, ...defaultFilter])

    if (crossFilters.length > 0) {
      const higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters)
      setCrossFilters(higherLevelFilter)
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }))
      setDrilldownList(drilldownList)
      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive)
      setDrillLevel(lastActiveDrill ? lastActiveDrill.drillLevel : 0)
      setDrillHistory([`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)])
    }

    try {
      const response: any = await loadDistinctValues(["Region_Name", "SalesArea_Name", "ProductName"], distinctValues)
      if (response) {
        setRegionOptions(response["Region_Name"])
        setSalesAreaOptions(response["SalesArea_Name"])
        setProductOptions(response["ProductName"])
      }
    } catch (error) {
      console.log(error)
    }
  }

  const handleRegionChange = async (key: string, value: string) => {
    const defaultFilter = handleFilterChange("Region_Name", value)
    const distinctValues = distinctFilterChange("Region_Name", value)

    setSelectedRegion(value)
    setSelectedSalesArea("")
    setSelectedProductName([])

    if (crossFilters.length > 0) {
      const higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters)
      setCrossFilters(higherLevelFilter)
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }))
      setDrilldownList(drilldownList)
      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive)
      setDrillLevel(lastActiveDrill ? lastActiveDrill.drillLevel : 0)
      setDrillHistory([`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)])
    }

    let dateFilters: FilterOption[] = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    const perspectiveFiltersLocal = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFiltersLocal, ...ytdFilters, ...dateFilters, ...defaultFilter])

    try {
      const response: any = await loadDistinctValues(["SalesArea_Name", "ProductName"], distinctValues)
      if (response) {
        setProductOptions(response["ProductName"])
        setSalesAreaOptions(response["SalesArea_Name"])
      }
    } catch (error) {
      console.log(error)
    }
  }

  const handleSalesAreaChange = async (key: string, value: string) => {
    const defaultFilter = handleFilterChange("SalesArea_Name", value)
    const distinctValues = distinctFilterChange("SalesArea_Name", value)

    setSelectedSalesArea(value)
    setSelectedProductName([])

    let dateFilters: FilterOption[] = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    const perspectiveFiltersLocal = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFiltersLocal, ...ytdFilters, ...dateFilters, ...defaultFilter])

    if (crossFilters.length > 0) {
      const higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters)
      setCrossFilters(higherLevelFilter)
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }))
      setDrilldownList(drilldownList)
      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive)
      setDrillLevel(lastActiveDrill ? lastActiveDrill.drillLevel : 0)
      setDrillHistory([`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)])
    }

    try {
      const response: any = await loadDistinctValues(["ProductName"], distinctValues)
      if (response) setProductOptions(response["ProductName"])
    } catch (error) {
      console.log(error)
    }
  }

  const handleProductNameChange = async (key: string, value: string[]) => {
    const productString = value.join(",")
    const defaultFilter = handleFilterChange("ProductName", productString)
    const distinctValues = distinctFilterChange("ProductName", productString)

    setSelectedProductName(value)

    let dateFilters: FilterOption[] = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    const perspectiveFiltersLocal = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFiltersLocal, ...ytdFilters, ...dateFilters, ...defaultFilter])

    if (crossFilters.length > 0) {
      const higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters)
      setCrossFilters(higherLevelFilter)
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }))
      setDrilldownList(drilldownList)
      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive)
      setDrillLevel(lastActiveDrill ? lastActiveDrill.drillLevel : 0)
      setDrillHistory([`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)])
    }

    try {
      const response: any = await loadDistinctValues(["ProductName"], distinctValues)
      if (response) {
        const filteredOptions = (response["ProductName"] || []).filter(
          (name: string) => name !== "Miscellaneous/Minor",
        )
        setProductOptions(filteredOptions)
      }
    } catch (error) {
      console.error("Error fetching product names:", error)
      toast.error("An error occurred while fetching product names. Please try again.")
    }
  }

  const getDynamicHeaderText = () => {
    const selectedStartYear = selectedYear.split("-")[0]
    const previousYear = `${Number.parseInt(selectedStartYear) - 1}-${selectedStartYear.slice(-2)}`
    const currentYear = selectedYear
    return `Historical (${previousYear}) vs Actual (${currentYear}) vs Target`
  }

  const validateDateRange = (from: dayjs.Dayjs | null, to: dayjs.Dayjs | null) => {
    if (!from || !to) return
  }

  const CustomLegend = () => (
    <div className="flex flex-wrap gap-2 ml-2">
      {Object.entries(categoryData)
        .filter(([key]) => activeStates[key as keyof ActiveStates])
        .map(([key, { color, name }]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-3 h-3" style={{ backgroundColor: color }} />
            <span className="text-sm font-bold text-gray-700">{name}</span>
          </div>
        ))}
    </div>
  )

  const handleFromDateChange = (newValue: dayjs.Dayjs | null) => {
    if (newValue) {
      setFromDate(newValue)
      validateDateRange(newValue, toDate)
    }
  }

  const handleToDateChange = (newValue: dayjs.Dayjs | null) => {
    if (newValue) {
      setToDate(newValue)
      validateDateRange(fromDate, newValue)
    }
  }

  const handleDateFilter = () => {
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      const perspectiveFiltersLocal = convertToFilters({ ...activeStates, C: selectedYorM === "Y" ? activeStates.C : false })
      const newFilters: FilterOption[] = [
        ...perspectiveFiltersLocal,
        { key: '"DATE"', cond: "equals", value: formattedDates },
      ]
      if (selectedYorM === "Y") newFilters.push({ key: '"C"', cond: "equals", value: "true" })
      const filtersWithoutYTD = newFilters.filter((filter) => filter.key !== '"YTD"' && (selectedYorM === "Y" || filter.key !== '"C"'))
      setAppliedFilters(filtersWithoutYTD)
      setMode("date")
      setDrillHistory([`${fromDate.format("MMM-DD")} - ${toDate.format("MMM-DD")}`])
      setDisplayFromDate(fromDate)
      setDisplayToDate(toDate)
      setIsOpen(false)
    }
  }

  const handlePopoverOpenChange = (open: boolean) => {
    if (open && isDisabled) return
    if (open) {
      if (displayFromDate && displayToDate) {
        // Restore previously applied dates so user sees what they last selected
        setFromDate(displayFromDate)
        setToDate(displayToDate)
      } else {
        // No date applied yet — seed with FY defaults
        const fy = parseFiscalYearLabel(selectedYear)
        const { previousFY: prevFY } = getIndianFiscalYearMeta()
        if (fy) {
          const aprilFirst = dayjs(`${fy.start}-04-01`)
          setFromDate(aprilFirst)
          if (selectedYear === prevFY) {
            setToDate(dayjs(`${fy.end}-03-31`))
          } else {
            setToDate(dayjs().subtract(1, "day"))
          }
        }
      }
    }
    setIsOpen(open)
  }

  const resetDate = () => {
    const fy = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    if (fy && selectedYear === prevFY) {
      const d = getPreviousFYSbuDateRangeDefaults(fy)
      setFromDate(d.from)
      setToDate(d.to)
    } else if (fy) {
      setFromDate(dayjs().year(fy.start).month(3).date(1))
      setToDate(dayjs().subtract(1, "day"))
    }
  }

  const isDisabled = mode === "ytd"

  const badgeVariants = [
    "secondary",
    "info",
    "success",
    "warning",
    "destructive",
    "info2",
  ] as const;

  return (
      <Card className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="mt-0 mb-2">
          <CardHeader className="p-3 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-extrabold text-gray-800 whitespace-nowrap">
                {sbu ? `${sbu} Zone-Wise Performance - ${selectedYear}` : `Zone-Wise Performance - ${selectedYear}`}
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs bg-blue-100 text-blue-700 font-medium whitespace-nowrap">
                {mode === "date" && displayFromDate && displayToDate
                  ? `${displayFromDate.format("DD-MMM-YYYY")} to ${displayToDate.format("DD-MMM-YYYY")}`
                  : (() => {
                    const fy = parseFiscalYearLabel(selectedYear)
                    const { previousFY: prevFY } = getIndianFiscalYearMeta()
                    if (!fy) return ""
                    const fyStart = dayjs().year(fy.start).month(3).date(1)
                    if (selectedYear === prevFY) {
                      const fyEnd = dayjs().year(fy.end).month(2).date(31)
                      return `${fyStart.format("DD-MMM-YYYY")} to ${fyEnd.format("DD-MMM-YYYY")}`
                    }
                    const fyEnd = dayjs().subtract(1, "day")
                    return `${fyStart.format("DD-MMM-YYYY")} to ${fyEnd.format("DD-MMM-YYYY")}`
                  })()}
              </span>
            </div>

            {/* RIGHT: all controls */}
            <TooltipProvider>
              <div className="flex items-center gap-1 flex-wrap">

                {/* Filter menu */}
                <ZoneWiseFilterMenu
                  selectedSBU={selectedSBU}
                  selectedZone={selectedZone}
                  selectedRegion={selectedRegion}
                  selectedSalesArea={selectedSalesArea}
                  selectedProductName={selectedProductName}
                  sbuOptions={sbuOptions}
                  zoneOptions={zoneOptions}
                  regionOptions={regionOptions}
                  salesAreaOptions={salesAreaOptions}
                  productOptions={productOptions}
                  handleSBUChange={(key, value) => handleSBUChange(key, value)}
                  handleZoneChange={(key, value) => handleZoneChange(key, value)}
                  handleRegionChange={(key, value) => handleRegionChange(key, value)}
                  handleSalesAreaChange={(key, value) => handleSalesAreaChange(key, value)}
                  handleProductNameChange={(key, value) => handleProductNameChange(key, value)}
                  hideSbu={!!sbu}
                />

                {/* Year / Month toggle */}
                <ToggleGroup
                  variant="outline"
                  className="inline-flex gap-0 rounded-lg border border-gray-200 bg-white"
                  type="single"
                  value={selectedYorM}
                  onValueChange={(val: any) => {
                    if (val) {
                      setSelectedYorM(val)
                      setAppliedFilters((prevFilters: any) => {
                        if (val === "Y") {
                          const newFiltersLocal = convertToFilters({ ...activeStates, C: true })
                          const filteredPrevFilters = prevFilters.filter((filter: any) => filter.key !== '"C"')
                          return [...filteredPrevFilters, ...newFiltersLocal]
                        } else {
                          return prevFilters.filter((filter: any) => filter.key !== '"C"')
                        }
                      })
                      setCrossFilters([])
                    }
                  }}
                >
                  <ToggleGroupItem
                    className="h-7 px-3 text-xs font-medium rounded-l-lg data-[state=on]:bg-blue-500 data-[state=on]:text-white"
                    value="Y"
                    disabled={crossFilters.length > 0 && selectedYorM !== "Y"}
                  >
                    Year
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    className="h-7 px-3 text-xs font-medium rounded-r-lg data-[state=on]:bg-blue-500 data-[state=on]:text-white"
                    value="M"
                    disabled={crossFilters.length > 0 && selectedYorM !== "M"}
                  >
                    Month
                  </ToggleGroupItem>
                </ToggleGroup>

                {/* Act / Hist buttons */}
                {Object.keys(haButtonsData).map((key) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={activeStates[key as keyof ActiveStates] ? "default" : "outline"}
                        className={`h-7 w-7 p-0 text-xs font-semibold rounded-lg transition-all ${activeStates[key as keyof ActiveStates]
                            ? "bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                            : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                          }`}
                        onClick={() => toggleButtonState(key as keyof ActiveStates)}
                        disabled
                      >
                        {haButtonsData[key as keyof typeof haButtonsData].title}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{haButtonsData[key as keyof typeof haButtonsData].name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}

                {/* Tgt button */}
                {Object.keys(tButtonsData).map((key) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={activeStates[key as keyof ActiveStates] ? "default" : "outline"}
                        className={`h-7 w-7 p-0 text-xs font-semibold rounded-lg transition-all ${activeStates[key as keyof ActiveStates]
                            ? "bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                            : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                          }`}
                        onClick={() => toggleButtonState(key as keyof ActiveStates)}
                      >
                        {tButtonsData[key as keyof typeof tButtonsData].title}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{categoryData[key as keyof typeof categoryData].name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}

                {/* YTD button */}
                <Button
                  variant={mode === "ytd" ? "default" : "outline"}
                  onClick={() => handleModeChange("ytd")}
                  className={`h-7 px-2.5 text-xs font-semibold rounded-lg transition-all ${mode === "ytd"
                      ? "bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                      : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                    }`}
                >
                  YTD
                </Button>

                {/* Date picker */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                        <PopoverTrigger disabled={isDisabled} asChild>
                          <Button
                            className={`h-7 w-7 p-0 rounded-lg transition-all ${isDisabled
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 opacity-60"
                                : mode === "date"
                                  ? "bg-teal-600 text-white border-teal-600"
                                  : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                              }`}
                            disabled={isDisabled}
                            onClick={isDisabled ? (e) => e.preventDefault() : undefined}
                          >
                            <Calendar strokeWidth={1.5} className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3 shadow-lg border border-gray-200 rounded-lg" align="end">
                          <div className="flex flex-col gap-3">
                            {/* From */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">From</label>
                              <input
                                type="date"
                                value={fromDate ? fromDate.format("YYYY-MM-DD") : ""}
                                min={dayjs().date(1).month(3).subtract(2, "year").format("YYYY-MM-DD")}
                                max={toDate ? toDate.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD")}
                                onChange={(e) => handleFromDateChange(e.target.value ? dayjs(e.target.value) : null)}
                                className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 shadow-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                            {/* To */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">To</label>
                              <input
                                type="date"
                                value={toDate ? toDate.format("YYYY-MM-DD") : ""}
                                min={fromDate ? fromDate.format("YYYY-MM-DD") : dayjs().date(1).month(3).subtract(2, "year").format("YYYY-MM-DD")}
                                max={dayjs().format("YYYY-MM-DD")}
                                onChange={(e) => handleToDateChange(e.target.value ? dayjs(e.target.value) : null)}
                                className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 shadow-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                            {/* Actions */}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={resetDate}
                                className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={handleDateFilter}
                                className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-sm px-2 py-1">
                    {isDisabled ? "Deselect YTD to use date filter" : "Open date picker"}
                  </TooltipContent>
                </Tooltip>

                {/* Back button */}
                {drillLevel > 0 && (
                  <Button
                    onClick={handleBackClick}
                    className="h-7 w-7 p-0 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm"
                  >
                    <IconArrowLeft stroke={2} className="h-3.5 w-3.5" />
                  </Button>
                )}

                {/* Reset button */}
                <Button
                  onClick={resetFilters}
                  className="h-7 w-7 p-0 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm"
                >
                  <IconRestore stroke={2} className="h-3.5 w-3.5" />
                </Button>

                {/* Year select */}
                <ShadcnSelect value={selectedYear} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-28 h-7 text-xs font-semibold border-gray-200 rounded-lg bg-white">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={currentFY}>{currentFY}</SelectItem>
                    <SelectItem value={previousFY}>{previousFY}</SelectItem>
                  </SelectContent>
                </ShadcnSelect>

              </div>
            </TooltipProvider>
          </div>

          {/* ── Row 2: Drill history pills + active filter pills ── */}
          {(drillLevel > 0 || selectedZone || selectedRegion || selectedSalesArea || selectedProductName.length > 0 || (selectedSBU && !sbu)) && (
            <div className="flex flex-wrap gap-1.5 mt-1 items-center">
              {/* Drill history */}
              {drillHistory.map((item, index) => (
                <Badge
                  className="py-0.5 px-2 text-[10px] font-medium"
                  key={`drill-${index}`}
                  variant={badgeVariants[index % badgeVariants.length]}
                >
                  {item}
                </Badge>
              ))}

              {/* Active filter pills */}
              {selectedSBU && !sbu && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                  <span className="text-teal-500 font-semibold">SBU:</span> {selectedSBU}
                  <button onClick={() => handleSBUChange("SBU_Name", "")} className="ml-0.5 hover:text-teal-900">×</button>
                </span>
              )}
              {selectedZone && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="text-blue-500 font-semibold">Zone:</span> {selectedZone}
                  <button onClick={() => handleZoneChange("Zone_Name", "")} className="ml-0.5 hover:text-blue-900">×</button>
                </span>
              )}
              {selectedRegion && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
                  <span className="text-violet-500 font-semibold">Region:</span> {selectedRegion}
                  <button onClick={() => handleRegionChange("Region_Name", "")} className="ml-0.5 hover:text-violet-900">×</button>
                </span>
              )}
              {selectedSalesArea && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="text-amber-500 font-semibold">Area:</span> {selectedSalesArea}
                  <button onClick={() => handleSalesAreaChange("SalesArea_Name", "")} className="ml-0.5 hover:text-amber-900">×</button>
                </span>
              )}
              {selectedProductName.map((p, i) => (
                <span key={`prod-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                  <span className="text-rose-500 font-semibold">Product:</span> {p}
                  <button onClick={() => handleProductNameChange("ProductName", selectedProductName.filter((x) => x !== p))} className="ml-0.5 hover:text-rose-900">×</button>
                </span>
              ))}
            </div>
          )}

          {/* ── Row 3: Chart sub-title + legend ── */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-bold text-gray-700">
              {getDynamicHeaderText()}
            </span>
            <CustomLegend />
          </div>
        </CardHeader>

          <CardContent className="grid lg:grid-cols-3 md:grid-cols-1 sm:grid-cols-1 grid-col-1 gap-4 px-3 py-2">
            <div className="md:col-span-2 lg:col-span-2">
              <div className=" bg-gradient-to-br from-gray-50/50 to-white rounded-xl border border-gray-100 p-3 relative">
              {isLoading ? (
                <div className="flex h-full items-center justify-center rounded-lg bg-gray-50">
                  <div className="flex flex-col items-center gap-2 text-xs text-gray-400">
                    <svg className="h-6 w-6 animate-spin text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Loading chart…
                  </div>
                </div>
              ) : chartApiMessage ? (
                <div className="flex h-full items-center justify-center rounded-lg bg-gray-50 px-4">
                  <p className="text-center text-sm font-medium text-gray-600">{chartApiMessage}</p>
                </div>
              ) : (
                <ExplodingPieChart chartData={chartData} salesUnit={salesUnit} />
              )}
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="flex flex-col gap-2 pt-2 px-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-7 rounded bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
                ))}
              </div>
            ) : (
              <TablePerformancesales
                salesUnit={salesUnit}
                data={chartData}
                activeStates={activeStates}
                drillLevel={drillLevel}
              />
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

export default ZoneWisePerformance
