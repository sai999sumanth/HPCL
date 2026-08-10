import React from "react"
import { useState, useCallback, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/@/components/ui/card"
import { IconArrowLeft, IconMinimize, IconRestore } from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip"
import { toast } from "sonner"
import { fetchChartData, fetchDistinctValues } from "./api"
import { Stepper, Step, StepLabel } from "@mui/material"
import { styled } from "@mui/material/styles"
import { useNavigate } from "react-router-dom"
import dayjs from "dayjs"
import {
  getIndianFiscalYearMeta,
  getDefaultFiscalYearDropdownValue,
  parseFiscalYearLabel,
  getPreviousFYSbuDateRangeDefaults,
  getIndianFiscalYearFullRangeDisplay,
} from "@/utils/fiscalYearUtils"
import ApiLoader from "@/services/apiLoader"
import TablePerformancesales from "./TablePerformancesales"
import { SalesDropdowns } from "./SalesDropdowns"
import convertToFilters from "@/utils/dynamicFilter"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/@/components/ui/breadcrumb"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Calendar } from "lucide-react"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import { LocalizationProvider } from "@mui/x-date-pickers"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { Button } from "@/@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/@/components/ui/toggle-group"
import MarketingSummary from "./PerformanceInsights/MarketingSummary"
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { MarketingSummarySalesDropdowns } from "./MarketingSummarySalesDropdowns"
import TopRetail from "./PerformanceInsights/RetailSalesPerformance/TopRetail"
// import SbuFiscalYearTable from "./PerformanceInsights/RetailSalesPerformance/sbuFiscalYearTable"

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
  A: { color: "#f6c95e", name: "Actual", title: "Act" },
  H: { color: "#0998be", name: "Historical", title: "Hist" },
  T: { color: "#8f72da", name: "Target", title: "Tgt" },
}

const haButtonsData = {
  A: { color: "#00a495", name: "Actual", title: "Act" },
  H: { color: "#a3bf02", name: "Historical", title: "Hist" },
}
const tButtonsData = {
  T: { color: "#dea600", name: "Target", title: "Tgt" },
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

const getDataKey = (key: string, mode: ChartMode, drillLevel: number): string => {
  switch (key) {
    case "A":
      return "ACTUAL_TMT_SALES"
    case "H":
      return "ACTUAL_HISTORY_TMT_SALES"
    case "T":
      return "TARGET_TMT_SALES"
    default:
      return ""
  }
}

// const getXAxisKey = (drillLevel: number): string => {
//   const keys = [
//     "cumulative",
//     "SBU_Name",
//     "Zone_Name",
//     "Region_Name",
//     "SalesArea_Name",
//     "month_name",
//     "ProductName",
//   ];
//   return keys[drillLevel] || "ProductName";
// };

const getXAxisKey = (drillLevel: number, selected: "Y" | "M"): string => {
  const keys =
    selected === "Y"
      ? ["cumulative", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName", "month_name"]
      : ["month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"]

  return keys[drillLevel] || "ProductName"
}

// const CustomStepper = styled(Stepper)({
//   // backgroundColor: '#f0f0f0',
//   padding: "2px",
//   borderRadius: "8px",
//   // border: '1px solid #e0e0e0',
//   "& .MuiStepLabel-label": {
//     color: "#333",
//     "&.Mui-active": {
//       color: "#00a495 !important",
//     },
//     "&.Mui-completed": {
//       color: "#00a495 !important",
//     },
//   },
//   "& .MuiStepIcon-root": {
//     color: "#ccc",
//     "&.Mui-active": {
//       color: "#00a495",
//     },
//     "&.Mui-completed": {
//       color: "#00a495",
//     },
//   },
// });

const CustomStepper = styled(Stepper)({
  padding: "2px",
  borderRadius: "8px",
  "& .MuiStepLabel-label": {
    color: "#ccc", // Default inactive color
    "&.Mui-active": {
      color: "#00a495 !important",
    },
    "&.Mui-completed": {
      color: "#00a495 !important",
    },
  },
  "& .MuiStepIcon-root": {
    color: "#ccc", // Default inactive color
    "&.Mui-active": {
      color: "#00a495",
    },
    "&.Mui-completed": {
      color: "#00a495",
    },
  },
})

interface DrillStateIndicatorProps {
  drillLevel: number
  drillHistory: string[]
  selectedYorM: string
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

  // if (!isArray) {
  //   if (drillLevel === 0) {
  //     const dataKey = responseData.month_name ? "month_name" : "cumulative";
  //     return Object.keys(responseData[dataKey]).map((key) => ({
  //       name: responseData[dataKey][key],
  //       ...(activeStates.A && { ACTUAL_TMT_SALES: Math.round(responseData.ACTUAL_TMT_SALES?.[key]) }),
  //       ...(activeStates.T && { TARGET_TMT_SALES: Math.round(responseData.TARGET_TMT_SALES?.[key]) }),
  //       ...(activeStates.H && { ACTUAL_HISTORY_TMT_SALES: Math.round(responseData.ACTUAL_HISTORY_TMT_SALES?.[key]) }),
  //     }));
  //   }

  //   // return Object.keys(responseData[xAxisKey]).map((key) => ({
  //   //   name: responseData[xAxisKey][key] !== "" ? responseData[xAxisKey][key] : null,
  //   //   ...(activeStates.A && { ACTUAL_TMT_SALES: Math.round(responseData.ACTUAL_TMT_SALES?.[key]) }),
  //   //   ...(activeStates.T && { TARGET_TMT_SALES: Math.round(responseData.TARGET_TMT_SALES?.[key]) }),
  //   //   ...(activeStates.H && { ACTUAL_HISTORY_TMT_SALES: Math.round(responseData.ACTUAL_HISTORY_TMT_SALES?.[key]) }),
  //   // }));

  //   return Object.keys(responseData[xAxisKey])
  //     .filter((key) =>
  //       responseData[xAxisKey][key] !== "" && // Skip empty values for name
  //       activeStates.A && responseData.ACTUAL_TMT_SALES?.[key] !== undefined && responseData.ACTUAL_TMT_SALES?.[key] !== 0 &&
  //       activeStates.T && responseData.TARGET_TMT_SALES?.[key] !== undefined && responseData.TARGET_TMT_SALES?.[key] !== 0 &&
  //       activeStates.H && responseData.ACTUAL_HISTORY_TMT_SALES?.[key] !== undefined && responseData.ACTUAL_HISTORY_TMT_SALES?.[key] !== 0
  //     )
  //     .map((key) => ({
  //       name: responseData[xAxisKey][key],
  //       ACTUAL_TMT_SALES: Math.round(responseData.ACTUAL_TMT_SALES?.[key]),
  //       TARGET_TMT_SALES: Math.round(responseData.TARGET_TMT_SALES?.[key]),
  //       ACTUAL_HISTORY_TMT_SALES: Math.round(responseData.ACTUAL_HISTORY_TMT_SALES?.[key]),
  //     }));
  // }

  if (!isArray) {
    if (drillLevel === 0) {
      const dataKey = responseData.month_name ? "month_name" : "cumulative"
      return Object.keys(responseData[dataKey] || {}) // Ensure it exists
        .map((key) => ({
          name: responseData[dataKey][key] ?? "", // Default to empty string
          ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
          TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
          ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
        }))
        .filter(
          (item) =>
            item.name.trim() !== "" && // Ensure name is not empty
            (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0), // At least one nonzero
        )
    }

    return Object.keys(responseData[xAxisKey] || {}) // Ensure it exists
      .map((key) => ({
        name: responseData[xAxisKey]?.[key] ?? "",
        ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
        TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
        ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
      }))
      .filter(
        (item) =>
          item.name.trim() !== "" && // Ensure name is not empty
          (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0), // At least one nonzero
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

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-bold text-gray-800 mb-2 text-xs">{label}</p>
        {payload.map((entry: any, index: number) => {
          // Check if the value is less than 10 and display accordingly
          const formattedValue =
            entry.value < 10
              ? entry.value.toFixed(1) // Show 2 decimal places if less than 10
              : Math.round(entry.value) // Round off if greater than or equal to 10

          return (
            <p key={index} className="text-xs flex justify-between items-center gap-4" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-semibold">{Number.parseFloat(formattedValue).toLocaleString()} TMT</span>
            </p>
          )
        })}
      </div>
    )
  }
  return null
}

const CustomXAxisTick: React.FC<any> = ({ x, y, payload }) => {
  const words = payload.value.split(" ")
  const lineHeight = 15
  // Calculate total height of the text
  const totalHeight = words.length * lineHeight
  // Calculate maximum width of the text to determine underline width
  const getTextWidth = (text: string, fontSize: number) => {
    const averageCharWidth = fontSize * 0.6 // Approximate width per character
    return text.length * averageCharWidth
  }
  const maxWidth = Math.max(...words.map((word) => getTextWidth(word, words.length > 9 ? 10 : 12)))

  return (
    <g transform={`translate(${x},${y})`}>
      {words.map((word: string, index: number) => (
        <g key={index}>
          {/* Text element */}
          <text
            className="font-bold"
            x={0}
            y={index * lineHeight}
            dy={16}
            fill="#11111"
            fontSize={words.length > 9 ? 10 : 12}
            textAnchor="middle"
            dominantBaseline="middle"
            cursor="pointer"
          >
            {word}
          </text>
          {/* Underline for each word */}
          {/* <line
 x1={-maxWidth/2}
 y1={(index * lineHeight) + 22}
 x2={maxWidth/2}
 y2={(index * lineHeight) + 22}
 stroke="#1b82f7"
 strokeWidth="1"
 /> */}
        </g>
      ))}
    </g>
  )
}
const renderCustomizedLabel = (props: any) => {
  const { x, y, width, height, value } = props
  const radius = 10

  // Define the rotation angle (e.g., 45 degrees)
  const angle = -45

  const formattedValue =
    value < 10
      ? value.toFixed(1) // Show 2 decimal places if less than 10
      : Math.round(value) // Round off if greater than or equal to 10

  return (
    <g>
      <text
        className="text-xs"
        x={x + width / 2}
        y={y - radius}
        fill="#333"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${angle}, ${x + width / 3}, ${y - radius})`} // Rotate the label
        fontWeight="600"
      >
        {Number.parseFloat(formattedValue).toLocaleString()}
      </text>
    </g>
  )
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

/** Drill filters shown in Zone-Wise breadcrumb (excludes perspective keys, DATE, and fiscal_year). */
function getZoneWiseBreadcrumbDrillFilters(filters: FilterOption[]): FilterOption[] {
  return filters.filter((ele) => {
    const key = ele.key.replace(/"/g, "")
    const val = String(ele.value ?? "")
    if (["A", "H", "T", "YTD", "C", "DATE"].includes(key)) return false
    const isDateRange = /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(val)
    const isSingleDate = /^\d{4}-\d{2}-\d{2}$/.test(val)
    const isFiscalYear = /^\d{4}-\d{4}$/.test(val)
    if (isDateRange || isSingleDate || isFiscalYear) return false
    return val.trim() !== ""
  })
}

const SalesDrill: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [drillLevel, setDrillLevel] = useState(0)
  // const [filters, setFilters] = useState<Filter[]>([
  //   { key: '"A"', cond: "equals", value: "true" },
  //   { key: '"H"', cond: "equals", value: "true" },
  // ]);

  const [filters, setFilters] = useState<FilterState>({
    SBU_Name: "",
    Zone_Name: "",
    Region_Name: "",
    SalesArea_Name: "",
    ProductName: "",
  })

  const [distinctFilters, setDistinctFilters] = useState<FilterState>({
    SBU_Name: "",
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
  const perspectiveFilters = convertToFilters(activeStates)
  const [appliedFilters, setAppliedFilters] = useState<FilterOption[]>(perspectiveFilters)
  // Order of filters for hierarchy
  const filterOrder = ["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"]

  const [isLoading, setIsLoading] = useState(true)
  const [isResponse, setIsResponses] = useState(false)
  /** API returned status false (e.g. no data) — show this text inside the chart area */
  const [chartApiMessage, setChartApiMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<ChartMode>("year")

  const [drillHistory, setDrillHistory] = useState<string[]>(() =>
    mode === "month" ? [`FY ${getDefaultFiscalYearDropdownValue()}`] : [],
  )

  const [selectedYear, setSelectedYear] = useState(() => getDefaultFiscalYearDropdownValue())
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedSBU, setSelectedSBU] = useState("")
  const [selectedZone, setSelectedZone] = useState("")
  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedSalesArea, setSelectedSalesArea] = useState("")
  const [selectedProductName, setSelectedProductName] = useState<string[]>([])

  const [yearOptions, setYearOptions] = useState<string[]>([])
  const [sbuOptions, setSbuOptions] = useState<string[]>([])
  const [zoneOptions, setZoneOptions] = useState<string[]>([])
  const [regionOptions, setRegionOptions] = useState<string[]>([])
  const [salesAreaOptions, setSalesAreaOptions] = useState<string[]>([])
  const [productOptions, setProductOptions] = useState<string[]>([])
  const navigate = useNavigate()
  const [showWarning, setShowWarning] = useState(false)
  const [isDrillDown, setIsDrillDown] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [crossFilters, setCrossFilters] = useState<Filter[]>([])
  const [isSwitchOn, setIsSwitchOn] = useState(false)
  const [sbuArray, setSbuArray] = useState([])
  const [currentSalesArray, setCurrentSalesArray] = useState([])
  const [historicalSalesArray, setHistoricalSalesArray] = useState([])
  const [salesUnit, setSalesUnit] = useState<string>("TMT")
  const [selectedYorM, setSelectedYorM] = useState<"Y" | "M">("Y")
  // Get first day of current month
  const firstDayOfMonth = dayjs().date(1).month(3) //.subtract(1, "year");
  const [isExpanded, setIsExpanded] = useState(false)

  // Get yesterday's date
  const yesterday = dayjs().subtract(1, "day")
  // State for date range
  const [fromDate, setFromDate] = useState(firstDayOfMonth)
  const [toDate, setToDate] = useState(yesterday)
  const { currentFY, previousFY } = getIndianFiscalYearMeta()

  const [selectedMonths, setSelectedMonths] = useState([])

  const monthOptions: any = [
    { id: "Apr", name: "April", icon: undefined },
    { id: "May", name: "May", icon: undefined },
    { id: "Jun", name: "June", icon: undefined },
    { id: "Jul", name: "July", icon: undefined },
    { id: "Aug", name: "August", icon: undefined },
    { id: "Sep", name: "September", icon: undefined },
    { id: "Oct", name: "October", icon: undefined },
    { id: "Nov", name: "November", icon: undefined },
    { id: "Dec", name: "December", icon: undefined },
    { id: "Jan", name: "January", icon: undefined },
    { id: "Feb", name: "February", icon: undefined },
    { id: "Mar", name: "March", icon: undefined },
  ]

  const badgeVariants = ["secondary", "info", "success", "warning", "destructive", "info2"] as const

  const activeDrills = []
  let [drilldownList, setDrilldownList] = useState(getInitialDrilldownList(selectedYorM))

  useEffect(() => {
    setDrilldownList(getInitialDrilldownList(selectedYorM))
  }, [selectedYorM])
  // Function to remove duplicates keeping the latest entry for each key
  const removeDuplicateFilters = (data) => {
    // Create a map to store the latest filter for each key
    const filterMap = new Map()

      // Iterate through filters in reverse to keep the latest entries
      ;[...data].reverse().forEach((filter) => {
        if (!filterMap.has(filter.key)) {
          filterMap.set(filter.key, filter)
        }
      })

    // Convert map values back to array and reverse to maintain original order
    return Array.from(filterMap.values()).reverse()
  }

  /**
   * Reorder an array of objects based on a list of keys.
   * @param {Array} data - The array of objects to reorder.
   * @param {Array} orderedKeys - The list of keys to order first.
   * @returns {Array} The reordered array.
   */
  function reorderDataByKeys(data, orderedKeys) {
    return [
      ...data.filter((item) => orderedKeys.includes(item.key)), // Extract and place the desired keys first
      ...data.filter((item) => !orderedKeys.includes(item.key)), // Place the remaining keys after
    ]
  }

  /**
   * Instead of trying to modify the existing applied filters array, we now build a new array from scratch each time
   * We iterate through the filter order and only add filters that should remain active
   * This ensures no duplicates can ever exist
   * @param key
   * @param {value} string
   */
  const distinctFilterChange = (key: keyof FilterState, value: string) => {
    const currentIndex = filterOrder.indexOf(key)

    // Create new filters object with all subsequent filters cleared
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

    // Create new applied filters array
    const newAppliedFilters: FilterOption[] = []

    // Keep only the filters that are before the current selection
    filterOrder.forEach((filterKey, index) => {
      if (index < currentIndex && newFilters[filterKey as keyof FilterState]) {
        newAppliedFilters.push({
          key: `${filterKey}`,
          cond: "=",
          value: newFilters[filterKey as keyof FilterState],
        })
      }
    })

    // Add the current selection if it has a value
    if (value) {
      newAppliedFilters.push({
        key: `${key}`,
        cond: "=",
        value: value,
      })
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
    if (mode !== "ytd") {
      setFromDate(fromdate)
      setToDate(todate)
    } else if (mode === "ytd") {
      setFromDate(fromdate)
      setToDate(todate)
    }
  }, [mode, selectedYear])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const currentIndex = filterOrder.indexOf(key)

    // Create new filters object with all subsequent filters cleared
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

    // Create new applied filters array
    const newAppliedFilters: FilterOption[] = []

    // Keep only the filters that are before the current selection
    filterOrder.forEach((filterKey, index) => {
      if (index < currentIndex && newFilters[filterKey as keyof FilterState]) {
        newAppliedFilters.push({
          key: `"${filterKey}"`,
          cond: "equals",
          value: newFilters[filterKey as keyof FilterState],
        })
      }
    })

    // Add the current selection if it has a value
    if (value) {
      newAppliedFilters.push({
        key: `"${key}"`,
        cond: "equals",
        value: value,
      })
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

      // Ensure fiscal_year is always included
      const fiscalYearFilter = { key: '"fiscal_year"', cond: "equals", value: selectedYear }
      const hasYearFilter = originalFilter.some((filter) => filter.key === '"fiscal_year"')

      const filtersToSend = hasYearFilter ? originalFilter : [...originalFilter, fiscalYearFilter]

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
          toast.warning("No data present for the selected combination.! Please select some other combination.")
          setIsLoading(false)
          return
        }
        // Check if all values for ACTUAL_TMT_SALES, TARGET_TMT_SALES, and ACTUAL_HISTORY_TMT_SALES are 0
        const isAllZero =
          Object.values(response.data.data?.ACTUAL_TMT_SALES).every((value) => value === 0) &&
          Object.values(response.data.data?.TARGET_TMT_SALES).every((value) => value === 0) &&
          Object.values(response.data.data?.ACTUAL_HISTORY_TMT_SALES).every((value) => value === 0)

        if (isAllZero) {
          toast.warning("No data found for the selected combination! All sales values are 0.")
          setIsLoading(false)
          setIsResponses(false)
          // return
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
      toast.error("Error fetching data. Please try again.");

      console.error("Error fetching data:", error)
    }
    setIsLoading(false)
  }, [filters, drillLevel, mode, activeStates, appliedFilters, crossFilters, selectedYear])

  useEffect(() => {
    if (selectedYorM !== "Y") {
      handleModeChange("ytd")
      setMode("ytd")
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [drillLevel, appliedFilters, crossFilters])

  const loadDistinctValues = useCallback(async (column: string[], whereCond: any = []) => {
    whereCond = [
      ...whereCond,
      {
        key: "Zone_Name",
        value: "-",
        cond: "!=",
      },
      {
        key: "Zone_Name",
        value: "",
        cond: "!=",
      },
      {
        key: "SBU_Name",
        value: "0",
        cond: "!=",
      },
    ]
    try {
      const response = await fetchDistinctValues({
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        column: column,
        where_cond: whereCond,
      })
      if (response.status && response.data) {
        return response.data
      }
    } catch (error) {
      console.error(`Error fetching distinct values for ${column}:`, error)
    }
    return []
  }, [])

  const fetchProductName = useCallback(async (column: string[], whereCond: any = []) => {
    whereCond = [
      ...whereCond,
      {
        key: "Zone_Name",
        value: "-",
        cond: "!=",
      },
      {
        key: "Zone_Name",
        value: "",
        cond: "!=",
      },
      {
        key: "SBU_Name",
        value: "0",
        cond: "!=",
      },
      {
        key: "DAY_ID",
        cond: ">",
        value: "2024-06-30",
      },
      {
        key: "ProductName",
        value: "",
        cond: "!=",
      },
    ]
    try {
      const response = await fetchDistinctValues({
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        column: column,
        where_cond: whereCond,
      })
      if (response.status && response.data) {
        return response.data
      }
    } catch (error) {
      console.error(`Error fetching distinct values for ${column}:`, error)
    }
    return []
  }, [])

  useEffect(() => {
    // YTDBox();
    const initializeFilters = async () => {
      const years = await loadDistinctValues(mode === "year" ? ["FISCAL_YEAR"] : ["month_name"])
      if (mode === "year") {
        setYearOptions(years)
      }
      const sbus = await loadDistinctValues(["SBU_Name"])
      const product = await fetchProductName(["ProductName"])
      const removeItems = ["Common", "Mumbai Ref", "Renewable Energy", "Visakh Ref"]
      const updatedData = sbus["SBU_Name"].map((item) => (item === "PETROCHEMICALS SBU" ? "PetChem" : item))
      const SBU_Name = updatedData.filter((item) => !removeItems.includes(item))
      setSbuOptions(SBU_Name)
      // setSbuOptions(sbus);
      const alldropdownOption = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name"])
      setZoneOptions(alldropdownOption?.["Zone_Name"])
      setRegionOptions(alldropdownOption?.["Region_Name"])
      setSalesAreaOptions(alldropdownOption?.["SalesArea_Name"])
      setProductOptions(product?.["ProductName"])
    }
    initializeFilters()
  }, [mode, loadDistinctValues, fetchProductName])

  const YTDBox = async () => {
    setIsLoading(true)
    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
    ]
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
      })
      if (response.status && response.data) {
        // Ensure we have valid data or use empty objects
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        // Convert to arrays, handling potential undefined values
        setSbuArray(Object.values(sbuNames))
        setCurrentSalesArray(Object.values(currentSales))
        setHistoricalSalesArray(Object.values(historicalSales))
        setIsLoading(false)
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        toast.error("Data not found. Please try again.");
      } else if (error.response && error.response.status === 500) {
        toast.error("Internal server error. Please try again later.");
      } else {
        toast.error("Error fetching data. Please try again.");
      }
      setIsLoading(false);
    }

  }

  const toggleButtonState = (key: keyof ActiveStates) => {
    setActiveStates((prevStates) => {
      const updatedStates = { ...prevStates }
      if (key === "T" && !prevStates.A) {
        toast.error("Target can only be selected if Actual is selected", {
          position: "top-right",
        })
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
      // If selectedYorM is "M", remove "C" from updatedStates
      if (selectedYorM === "M") {
        updatedStates["C"] = false // or delete updatedStates["C"];
      }
      setAppliedFilters((prevFilters) => {
        const newFilters = prevFilters.filter((filter) => !["A", "H", "T"].includes(filter.key.replace(/"/g, "")))
        const updatedFilters = createFilters(updatedStates)
        return [...newFilters, ...updatedFilters]
      })
      return updatedStates
    })
  }

  function updateFiltersToCrossFilter(filters, crossFilters) {
    const filterMap = new Map()

    // Store filters in a Map for quick lookup
    filters.forEach((item) => {
      filterMap.set(item.key, item.value)
    })

    // Create a new crossFilters array that preserves date filters
    let newCrossFilters = [...crossFilters]

    // Preserve any DATE filter in crossFilters
    const dateFilter = newCrossFilters.find((filter) => filter.key === '"DATE"')

    // Ensure crossFilters only has keys present in filters or special keys like "month_name" or "DATE"
    newCrossFilters = newCrossFilters.filter(
      (item) => item.key === '"month_name"' || item.key === '"DATE"' || filterMap.has(item.key),
    )

    // Update existing crossFilters values if they exist in filters (except special keys)
    newCrossFilters.forEach((item) => {
      if (filterMap.has(item.key) && item.key !== '"month_name"' && item.key !== '"DATE"') {
        item.value = filterMap.get(item.key)
      }
    })

    // Ensure all keys from filters exist in crossFilters
    filters.forEach((item) => {
      if (!newCrossFilters.some((cf) => cf.key === item.key)) {
        newCrossFilters.push({ ...item })
      }
    })

    return newCrossFilters
  }

  const syncWithDropdowns = async (key, value) => {
    switch (key) {
      case "SBU_Name":
        setSelectedSBU(value)
        handleSBUChange(key, value)
        break
      case "Zone_Name":
        setSelectedZone(value)
        handleZoneChange(key, value)
        break
      case "Region_Name":
        setSelectedRegion(value)
        handleRegionChange(key, value)
        break
      case "SalesArea_Name":
        setSelectedSalesArea(value)
        handleSalesAreaChange(key, value)
        break
      case "ProductName":
        // If the value is a string (from drill-down), convert it to an array
        const productValue = typeof value === "string" ? [value] : value
        setSelectedProductName(productValue)
        handleProductNameChange(key, productValue)
        break
      default:
        break
    }
  }

  let newFilters = []
  let newCrossFilters = []
  let ytd = []
  const handleBarClick = useCallback(
    (entry: any) => {
      setIsDrillDown(true)
      if (drillLevel >= 6) {
        toast.info("You have reached the maximum drill-down level.")
        return
      }

      newFilters = [...appliedFilters]
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
      if (mode === "ytd") {
        ytd = [{ key: '"YTD"', cond: "equals", value: "true" }]
      }

      // Preserve perspective filters
      const perspectiveFilters = appliedFilters.filter((filter) =>
        ["A", "H", "T"].includes(filter.key.replace(/"/g, "")),
      )
      newFilters = [...newFilters, ...perspectiveFilters, ...ytd]
      const removeDups = [...new Set(newFilters)]
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
    (event) => {
      event.preventDefault()
      setIsDrillDown(true)
      if (drillLevel > 0) {
        const activeDrills = drilldownList.filter((drill) => drill.isActive)
        if (drillLevel === 1) {
          resetFilters()
          return
        }
        if (activeDrills.length === 1 || activeDrills === null) {
          // const updatedCrossFilters: any = crossFilters.push({ key: '"cumulative"', cond: "equals", value: "true"});
          const updatedCrossFilters = [{ key: '"cumulative"', cond: "equals", value: "true" }]
          setCrossFilters(updatedCrossFilters)
          appliedFilters.length > 5 ? setAppliedFilters(appliedFilters.slice(0, -1)) : setAppliedFilters(appliedFilters)
          setDrillHistory((prev) => [...prev.slice(0, -1)])
          setDrillLevel((prev) => prev - 1)
          // resetFilters();
          return
        }
        const lastActiveDrill = activeDrills.length > 0 ? activeDrills[activeDrills.length - 1] : null
        const lastActiveCount = activeDrills.length > 1 ? activeDrills.slice(-2, -1)[0] : null
        const drillcount = lastActiveDrill ? lastActiveCount?.drillLevel : 0
        setDrillLevel(drillcount)

        if (activeDrills.length > 1) {
          const updatedList = drilldownList.map((drill) => {
            if (drill.key === lastActiveDrill?.key) {
              return { ...drill, isActive: false }
            }
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
    const perspectiveKeys = selectedYorM === "Y" ? ['"A"', '"H"', '"T"', '"C"'] : ['"A"', '"H"', '"T"'];

    // Separate perspective and non-perspective filters
    const perspectiveFilters = appliedFilters.filter((filter) => perspectiveKeys.includes(filter.key));
    const resetFilter = [
      {
        key: '"YTD"',
        cond: "equals",
        value: "true",
      },
    ];

    setDrillLevel(0);
    setMode(selectedYorM === "Y" ? "year" : "ytd");

    if (selectedYorM === "Y") {
      setDrilldownList(getInitialDrilldownList("Y"));
      setAppliedFilters((prev) => [...resetFilter, ...perspectiveFilters]);
    } else {
      setAppliedFilters((prev) => [...resetFilter, ...perspectiveFilters]);
    }
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
    setCrossFilters([]);
    // setSelectedYear("");
    setSelectedMonth("");
    setSelectedSBU("");
    setSelectedZone("");
    setSelectedRegion("");
    setSelectedSalesArea("");
    setSelectedProductName([]); // Reset selected products here
    setDrillHistory(mode === "month" ? [`FY ${selectedYear}`] : []);
    setSelectedMonths([]);

    setIsSwitchOn(false);
  }, [mode, filters, appliedFilters, crossFilters, selectedYorM]);



  const handleModeChange = useCallback(
    (newMode) => {
      // If trying to deselect month while no other mode is selected, keep month selected
      if (newMode === "month" && mode === "month" && !appliedFilters.length) {
        return
      }

      // If deselecting current mode (YTD), switch to date mode and enable date filter
      if (newMode === mode && mode === "ytd") {
        setMode("date")
        // Remove YTD filter
        setAppliedFilters((prev) => prev.filter((item) => item.key !== '"YTD"'))
        return
      }

      // Handle normal mode changes
      setMode(newMode)

      if (newMode === "year") {
        setDrillHistory([])
        resetFilters()
      } else if (newMode === "month") {
        setDrillHistory([`FY ${selectedYear}`])
        resetFilters()
      } else if (newMode === "ytd") {
        setAppliedFilters((prev) => {
          // Remove DATE filter if it exists
          const filtersWithoutDate = prev.filter((item) => item.key !== '"DATE"')
          return [...filtersWithoutDate, { key: '"YTD"', cond: "equals", value: "true" }]
        })
        setMode("ytd")
      } else {
        setDrillHistory([`FY ${selectedYear}`])
      }
    },
    [mode, filters, crossFilters, resetFilters],
  )

  const handleMonthSelect = (monthValues) => {
    const monthValuesString = monthValues.join(",")

    const monthFilter = {
      key: '"month_name"',
      cond: "equals",
      value: monthValuesString,
    }

    setAppliedFilters((prev) => {
      const monthFilterIndex = prev.findIndex((f) => f.key === '"month_name"')
      if (monthFilterIndex >= 0) {
        const newFilters = [...prev]
        newFilters[monthFilterIndex] = monthFilter
        return newFilters
      }
      return [...prev, monthFilter]
    })
  }

  // const handleYearChange = (value: string) => {
  //   if (value === "_empty") {
  //     resetFilters();
  //     return;
  //   }
  //   setSelectedYear(value);
  //   setAppliedFilters([
  //     ...appliedFilters.filter((filter) =>
  //       ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
  //     ),
  //     { key: '"FISCAL_YEAR"', cond: "equals", value },
  //   ]);
  //   setDrillLevel(1);
  //   setDrillHistory([value]);
  //   loadDistinctValues(["SBU_Name"], { FISCAL_YEAR: value }).then(
  //     setSbuOptions
  //   );
  // };

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
      return [...withoutFy, { key: '"fiscal_year"', cond: "equals", value: value }]
    })
  }

  const handleMonthChange = async (event: any) => {
    const value = event.target.value
    if (value === "_empty") {
      resetFilters()
      return
    }
    setSelectedMonth(value)
    const fyLabel = `FY ${selectedYear}`
    setAppliedFilters([
      ...appliedFilters.filter((filter) => ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))),
      { key: '"FISCAL_YEAR"', cond: "equals", value: fyLabel },
      { key: '"month_name"', cond: "equals", value },
    ])
    setDrillLevel(1)
    setDrillHistory([fyLabel, value])
    const sbus = await loadDistinctValues(["SBU_Name"], {
      FISCAL_YEAR: fyLabel,
      month_name: value,
    })
    setSbuOptions(sbus)
  }

  const handleSBUChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("SBU_Name", value)
    const distinctValues = distinctFilterChange("SBU_Name", value)

    let higherLevelFilter = []
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
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)]
      console.log("updatedDrillHistory", updatedDrillHistory)
      setDrillHistory(updatedDrillHistory)
      // setDrillHistory([...drillHistory.slice(0, higherLevelFilter.length-1), higherLevelFilter[higherLevelFilter.length-1].value]);
    } else {
      higherLevelFilter = crossFilters
    }
    setZoneOptions([])
    setRegionOptions([])
    setSalesAreaOptions([])
    setProductOptions([])
    // if (value === "_empty") {
    //   let perspectiveFilters = convertToFilters(activeStates);
    //   setAppliedFilters([
    //     ...perspectiveFilters,
    //     {
    //       key: '"SBU_Name"',
    //       cond: "equals",
    //       value: ""
    //     }
    //   ]);
    //   setSelectedSBU("");
    //   return;
    // }
    setSelectedSBU(value)
    setSelectedZone("")
    setSelectedRegion("")
    setSelectedSalesArea("")
    setSelectedProductName([])
    // setCrossFilters([]);
    // Set only SBU filter
    let dateFilters = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    // let perspectiveFilters = selectedYorM === "M" ? "" : convertToFilters(activeStates);
    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFilters, ...ytdFilters, ...dateFilters, ...defaultFilter])
    try {
      const response = await loadDistinctValues(
        ["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"],
        distinctValues,
      )
      if (response) {
        setZoneOptions(response["Zone_Name"])
        setRegionOptions(response["Region_Name"])
        setSalesAreaOptions(response["SalesArea_Name"])
        setProductOptions(response["ProductName"])

        // Auto-select when there is only one option
        if (response?.["Zone_Name"]?.length === 1) {
          setSelectedZone(response?.["Zone_Name"][0])
        }

        if (response?.["Region_Name"]?.length === 1) {
          setSelectedRegion(response?.["Region_Name"][0])
        }

        if (response?.["SalesArea_Name"]?.length === 1) {
          setSelectedSalesArea(response?.["SalesArea_Name"][0])
        }
      }
    } catch (error) {
      console.log(error)
    }
  }

  const handleZoneChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("Zone_Name", value)
    const distinctValues = distinctFilterChange("Zone_Name", value)
    // if (value === "_empty") {
    //   let perspectiveFilters = convertToFilters(activeStates);
    //   setAppliedFilters([
    //     ...perspectiveFilters
    //   ]);
    //   setSelectedSBU("");
    //   return;
    // }
    setSelectedZone(value)
    setSelectedRegion("")
    setSelectedSalesArea("")
    setSelectedProductName([])
    // setCrossFilters([]);
    // Set SBU and Zone filters
    let dateFilters = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFilters, ...ytdFilters, ...dateFilters, ...defaultFilter])

    let higherLevelFilter = []
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters)
      setCrossFilters(higherLevelFilter)
      // setDrillLevel(higherLevelFilter.length);
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }))
      setDrilldownList(drilldownList)
      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive)
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0
      setDrillLevel(drillcount)
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)]
      console.log("updatedDrillHistory", updatedDrillHistory)
      setDrillHistory(updatedDrillHistory)
    } else {
      higherLevelFilter = crossFilters
    }
    try {
      const response: any = await loadDistinctValues(["Region_Name", "SalesArea_Name", "ProductName"], distinctValues)
      if (response) {
        // setSbuOptions(response["SBU_Name"]);
        setRegionOptions(response["Region_Name"])
        setSalesAreaOptions(response["SalesArea_Name"])
        setProductOptions(response["ProductName"])
      }
    } catch (error) {
      console.log(error)
    }
  }

  const handleRegionChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("Region_Name", value)
    const distinctValues = distinctFilterChange("Region_Name", value)
    // if (value === "_empty") {
    //   let perspectiveFilters = convertToFilters(activeStates);
    //   setAppliedFilters([
    //     ...perspectiveFilters
    //   ]);
    //   setSelectedSBU("");
    //   return;
    // }
    setSelectedRegion(value)
    setSelectedSalesArea("")
    setSelectedProductName([])
    let higherLevelFilter = []
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters)
      setCrossFilters(higherLevelFilter)
      // setDrillLevel(higherLevelFilter.length);
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }))
      setDrilldownList(drilldownList)
      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive)
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0
      setDrillLevel(drillcount)
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)]
      console.log("updatedDrillHistory", updatedDrillHistory)
      setDrillHistory(updatedDrillHistory)
    } else {
      higherLevelFilter = crossFilters
    }
    // Set SBU, Zone, and Region filters
    let dateFilters = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFilters, ...ytdFilters, ...dateFilters, ...defaultFilter])
    try {
      const response: any = await loadDistinctValues(["SalesArea_Name", "ProductName"], distinctValues)
      if (response) {
        // setSbuOptions(response["SBU_Name"]);
        // setZoneOptions(response["Zone_Name"]);
        setProductOptions(response["ProductName"])
        setSalesAreaOptions(response["SalesArea_Name"])
      }
    } catch (error) {
      console.log(error)
    }
  }

  const handleSalesAreaChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("SalesArea_Name", value)
    const distinctValues = distinctFilterChange("SalesArea_Name", value)
    // if (value === "_empty") {
    //   let perspectiveFilters = convertToFilters(activeStates);
    //   setAppliedFilters([
    //     ...perspectiveFilters
    //   ]);
    //   setSelectedSalesArea("");
    //   return;
    // }
    setSelectedSalesArea(value)
    setSelectedProductName([])
    let dateFilters = []
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : []
    }

    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : []
    setAppliedFilters([...perspectiveFilters, ...ytdFilters, ...dateFilters, ...defaultFilter])
    let higherLevelFilter = []
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters)
      setCrossFilters(higherLevelFilter)
      // setDrillLevel(higherLevelFilter.length);
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }))
      setDrilldownList(drilldownList)
      // **Step 2: Find the last active drill level**
      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive)
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0
      setDrillLevel(drillcount)
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map((item) => item.value)]
      console.log("updatedDrillHistory", updatedDrillHistory)
      setDrillHistory(updatedDrillHistory)
    } else {
      higherLevelFilter = crossFilters
    }

    try {
      const response: any = await loadDistinctValues(["ProductName"], distinctValues)
      if (response) {
        // setSbuOptions(response["SBU_Name"]);
        // setZoneOptions(response["Zone_Name"]);
        // setRegionOptions(response["Region_Name"]);
        setProductOptions(response["ProductName"])
      }
    } catch (error) {
      console.log(error)
    }
  }
  const handleProductNameChange = async (key, value: string[]) => {
    const productString = value.join(",");

    const defaultFilter = handleFilterChange("ProductName", productString);
    const distinctValues = distinctFilterChange("ProductName", productString);

    setSelectedProductName(value);

    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`;
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : [];
    }

    const perspectiveFilters = convertToFilters({
      ...activeStates,
      C: selectedYorM === "M" ? false : activeStates.C,
    });
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];

    setAppliedFilters([
      ...perspectiveFilters,
      ...ytdFilters,
      ...dateFilters,
      ...defaultFilter,
    ]);

    let higherLevelFilter = [];
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
      setCrossFilters(higherLevelFilter);

      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, "") === drill.key),
      }));
      setDrilldownList(drilldownList);

      const lastActiveDrill = [...drilldownList].reverse().find((d) => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);

      const updatedDrillHistory = [
        `FY ${selectedYear}`,
        ...higherLevelFilter.map((item) => item.value),
      ];
      setDrillHistory(updatedDrillHistory);
    } else {
      higherLevelFilter = crossFilters;
    }

    try {
      const response: any = await loadDistinctValues(["ProductName"], distinctValues);
      if (response) {
        const filteredOptions = (response["ProductName"] || []).filter(
          (name: string) => name !== "Miscellaneous/Minor"
        );
        setProductOptions(filteredOptions);
      }
    } catch (error) {
      console.error("Error fetching product names:", error);
      toast.error("An error occurred while fetching product names. Please try again.");
    }
  };



  const getDynamicHeaderText = () => {
    // Extract just the starting year from the selection
    const selectedStartYear = selectedYear.split("-")[0]

    // Calculate previous year for "Historical" part
    const previousYear = `${Number.parseInt(selectedStartYear) - 1}-${selectedStartYear.slice(-2)}`
    // Calculate current year for "Actual" part
    const currentYear = selectedYear

    return `Historical (${previousYear}) vs Actual (${currentYear}) vs Target`
  }

  const getCurrentFinancialYear = () => {
    const today = dayjs()
    const currentYear = today.year()
    const startMonth = 3 // April (0-based month)
    let fyStart = dayjs().year(currentYear).month(startMonth).startOf("month")
    let fyEnd = dayjs()
      .year(currentYear + 1)
      .month(startMonth - 1)
      .endOf("month")

    // If current date is before April, adjust financial year back one year
    if (today.month() < startMonth) {
      fyStart = fyStart.subtract(1, "year")
      fyEnd = fyEnd.subtract(1, "year")
    }
    return { start: fyStart, end: fyEnd }
  }

  const validateDateRange = (from, to) => {
    if (!from || !to) return

    const fy = getCurrentFinancialYear()
    const isWithinFY = from.isAfter(fy.start) && from.isBefore(fy.end) && to.isAfter(fy.start) && to.isBefore(fy.end)

    // setShowWarning(!isWithinFY);

    // if (!isWithinFY) {
    // toast.warning(
    // `Selected dates are outside the current financial year (${fy.start.format('DD/MM/YYYY')} - ${fy.end.format('DD/MM/YYYY')})`
    // );
    // }
  }
  const CustomLegend = () => {
    return (
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
  }

  const handleFromDateChange = (newValue) => {
    setFromDate(newValue)
    validateDateRange(newValue, toDate)
  }

  const handleToDateChange = (newValue) => {
    setToDate(newValue)
    validateDateRange(fromDate, newValue)
  }

  const handleDateFilter = () => {
    if (fromDate && toDate) {
      // Format dates for the filter
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`

      // Convert perspective filters based on active states
      const perspectiveFilters = convertToFilters({ ...activeStates })

      // Create new filters array instead of modifying existing one
      const newFilters = [...perspectiveFilters, { key: '"DATE"', cond: "equals", value: formattedDates }]

      // If selectedYorM is "Y", add the "C" filter
      if (selectedYorM === "Y") {
        newFilters.push({ key: '"C"', cond: "equals", value: "true" })
      }

      // Explicitly remove YTD filter if it exists
      const filtersWithoutYTD = newFilters.filter((filter) => filter.key !== '"YTD"')

      // Set the applied filters with a completely new array
      setAppliedFilters(filtersWithoutYTD)

      // Set mode and drill history
      setMode("date")
      setDrillHistory([`${fromDate.format("MMM-DD")} - ${toDate.format("MMM-DD")}`])

      // Close the popover
      setIsOpen(false)
    }
  }

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      const fy = parseFiscalYearLabel(selectedYear)
      const { previousFY: prevFY } = getIndianFiscalYearMeta()
      if (fy) {
        // Always set from date to April 1 of the FY start year
        const aprilFirst = dayjs(`${fy.start}-04-01`)
        setFromDate(aprilFirst)

        if (selectedYear === prevFY) {
          // Previous FY: to = March 31 of end year
          const marchThirtyFirst = dayjs(`${fy.end}-03-31`)
          setToDate(marchThirtyFirst)
        } else {
          // Current FY: to = yesterday
          setToDate(dayjs().subtract(1, "day"))
        }
      }
    }
    setIsOpen(open)
  }
  const resetDate = () => {
    const fy = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    let fromdate: dayjs.Dayjs
    let todate: dayjs.Dayjs
    if (fy && selectedYear === prevFY) {
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
  }

  const fy = getCurrentFinancialYear()

  const handleXaxisClick = (entry: any) => {
    console.log("handleXaxisClick", entry)
  }

  const isContainMonth = () => {
    return drillHistory.some((item) => monthOptions.includes(item))
  }

  const handleReset = () => {
    setFromDate(null)
    setToDate(null)
  }

  const formatDisplayDate = (date) => {
    return date ? dayjs(date).format("DD/MM/YYYY") : ""
  }

  const DrillIndicator: React.FC<DrillStateIndicatorProps> = ({ drillLevel, drillHistory, selectedYorM }) => {
    const states =
      selectedYorM === "Y"
        ? ["Cumulative", "SBU", "Zone", "Region", "Sales Area", "Product", "Month Name"]
        : ["Month Name", "SBU", "Zone", "Region", "Sales Area", "Product"]

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

    const updatedDrilldownList = getInitialDrilldownList(selectedYorM as "Y" | "M").map((drill) => ({
      ...drill,
      isActive: crossFilters.some((filter) => filter.key.replace(/"/g, "") === drill.key),
    }))

    const lastActiveDrill = [...updatedDrilldownList].reverse().find((d) => d.isActive)
    const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0

    return (
      <div className="space-y-2 text-xs px-8">
        <CustomStepper style={{ width: "650px" }} activeStep={drillcount} alternativeLabel>
          {updatedDrilldownList.slice(0, states.length).map((drill, index) => (
            <Step key={drill.key} completed={drill.isActive}>
              <StepLabel style={{ color: drill.isActive ? "#00a495" : "#ccc" }}>{states[index]}</StepLabel>
            </Step>
          ))}
        </CustomStepper>
      </div>
    )
  }

  const handleSwitchChange = (checked) => {
    setIsSwitchOn(checked) // Update the state based on switch status
  }

  interface RedIndicatorProps {
    x?: any
    y?: any
    width?: any
  }
  // Red indicator component with proper typing
  const RedIndicator: React.FC<RedIndicatorProps> = ({ x = 0, y = 0, width = 0 }) => (
    <svg x={x + width / 2 - 8} y={y - 45}>
      <circle cx="10" cy="10" r="10" fill="red" />
    </svg>
  )
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }
  const formatNumber = (value) => {
    return value.toLocaleString() // This will add thousand separators
  }
  const ExpandedChart = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={toggleExpand} />

      {/* Expanded chart container */}
      <div className="relative w-[95vw] h-[90vh] bg-white rounded-lg shadow-xl p-4 z-50">
        <div className="absolute right-2 top-4">
          <div className="flex gap-3">
            <Button
              onClick={resetFilters}
              className="text-white text-xs font-bold mt-0.5 p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
            >
              <IconRestore stroke={1.5} />
            </Button>
            <Button
              onClick={handleBackClick}
              className="text-white text-xs font-bold p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
            >
              <IconArrowLeft stroke={1.5} />
            </Button>
            <Button
              onClick={toggleExpand}
              className="text-white text-xs font-bold p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
            >
              <IconMinimize stroke={1.5} />
            </Button>
          </div>
        </div>

        <div className="h-full flex flex-col">
          {/* Chart Title */}
          <div className="mb-4">
            <span className="text-xl font-bold">Historical (2023-24) vs Actual (2024-25) vs Target - {salesUnit}</span>
            <CustomLegend />
          </div>

          {/* Expanded Chart */}
          <div className="flex-1">
            {chartApiMessage ? (
              <div className="flex h-full min-h-[400px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4">
                <p className="text-center text-sm font-medium text-gray-600">{chartApiMessage}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 36 }}>
                  <XAxis dataKey="name" tick={<CustomXAxisTick />} height={60} interval={0} />
                  <YAxis
                    tick={{ fill: "#333", fontSize: "0.7rem" }}
                    label={{
                      value: `Sales (${salesUnit})`,
                      angle: -90,
                      position: "insideLeft",
                      fill: "#333",
                      fontSize: 11,
                    }}
                    axisLine={{ stroke: "#333" }}
                    tickFormatter={formatNumber}
                  />
                  <RechartTooltip content={<CustomTooltip />} cursor={{ fill: "#f0f0f0" }} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

                  {(() => {
                    // Identify the most underperforming bar index
                    let mostUnderperformingIndex = -1
                    let maxUnderperformance = 0

                    chartData.forEach((item, index) => {
                      const actual = item.ACTUAL_TMT_SALES || 0
                      const historical = item.ACTUAL_HISTORY_TMT_SALES || 0
                      const target = item.TARGET_TMT_SALES || 0

                      // Calculate underperformance based on the lowest percentage compared to historical/target
                      const underperformance =
                        Number(historical) > 0 ? (Number(historical) - Number(actual)) / Number(historical) : 0
                      const targetUnderperformance =
                        Number(target) > 0 ? (Number(target) - Number(actual)) / Number(target) : 0

                      const worstUnderperformance = Math.max(underperformance, targetUnderperformance)

                      if (worstUnderperformance > maxUnderperformance) {
                        maxUnderperformance = worstUnderperformance
                        mostUnderperformingIndex = index
                      }
                    })

                    return Object.entries(categoryData).map(([key, { color, name }]) => {
                      const dataKey = getDataKey(key, mode, drillLevel)
                      return (
                        activeStates[key as keyof ActiveStates] && (
                          <Bar
                            key={key}
                            dataKey={dataKey}
                            name={name}
                            fill={color}
                            onClick={handleBarClick}
                            cursor="pointer"
                            maxBarSize={30}
                            alignmentBaseline="before-edge"
                            radius={[6, 6, 0, 0]}
                          >
                            <LabelList dataKey={dataKey} content={renderCustomizedLabel} />

                            {/* Display red indicator only for the most underperforming actual sales bar */}
                            {key === "A" && mostUnderperformingIndex !== -1 && (
                              <LabelList
                                content={(props) => {
                                  const { x, y, width, index } = props

                                  if (index === mostUnderperformingIndex) {
                                    return <RedIndicator x={x} y={y} width={width} />
                                  }
                                  return null
                                }}
                              />
                            )}
                          </Bar>
                        )
                      )
                    })
                  })()}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Drill Indicator */}
          <div className="flex items-center justify-center">
            <DrillIndicator drillLevel={drillLevel} drillHistory={drillHistory} selectedYorM={selectedYorM} />
          </div>
        </div>
      </div>
    </div>
  )
  const isDisabled = mode === "ytd";
  const zoneWiseBreadcrumbFilters = getZoneWiseBreadcrumbDrillFilters(appliedFilters)

  return (
    <>
      <MarketingSummary />
      <Card className="w-full bg-white rounded-lg border border-gray-200 pt-2 mt-3">
        {isLoading && <ApiLoader loading={isLoading} />}
        <div className="mt-1 mb-2">
          <CardHeader className="p-1">
            <div className="flex flex-col gap-2">
              <span className="flex items-center text-sm font-extrabold flex-wrap gap-1">
                Zone-Wise Performance - {selectedYear}
                <span className="p-1 rounded-md text-xs bg-blue-100 ml-1">
                  ({(() => {
                    const fy = parseFiscalYearLabel(selectedYear)
                    const { previousFY: prevFY } = getIndianFiscalYearMeta()
                    if (!fy) return ""
                    const fyStart = dayjs().year(fy.start).month(3).date(1) // April 1st of start year
                    if (selectedYear === prevFY) {
                      // Previous FY: Apr 1 of start year → Mar 31 of end year
                      const fyEnd = dayjs().year(fy.end).month(2).date(31) // March 31 of end year
                      return `${fyStart.format("DD-MMM-YYYY")} to ${fyEnd.format("DD-MMM-YYYY")}`
                    } else {
                      // Current FY: Apr 1 of start year → yesterday
                      const fyEnd = dayjs().subtract(1, "day")
                      return `${fyStart.format("DD-MMM-YYYY")} to ${fyEnd.format("DD-MMM-YYYY")}`
                    }
                  })()})
                </span>
              </span>

              <div className="flex gap-4 justify-between items-start">
                <div className="flex flex-wrap">
                  <MarketingSummarySalesDropdowns
                    selectedYear={selectedYear}
                    selectedSBU={selectedSBU}
                    selectedZone={selectedZone}
                    selectedRegion={selectedRegion}
                    selectedSalesArea={selectedSalesArea}
                    selectedProductName={selectedProductName}
                    yearOptions={yearOptions}
                    sbuOptions={sbuOptions}
                    zoneOptions={zoneOptions}
                    regionOptions={regionOptions}
                    salesAreaOptions={salesAreaOptions}
                    productOptions={productOptions}
                    handleYearChange={handleYearChange}
                    handleSBUChange={(key, value) => handleSBUChange(key, value)}
                    handleZoneChange={(key, value) => handleZoneChange(key, value)}
                    handleRegionChange={(key, value) => handleRegionChange(key, value)}
                    handleSalesAreaChange={(key, value) => handleSalesAreaChange(key, value)}
                    handleProductNameChange={(key, value) => handleProductNameChange(key, value)}
                    mode={mode}
                  />
                  {/* {mode === "month" && (
                    <CustomMultiSelect
                      options={monthOptions}
                      onValueChange={handleMonthSelect}
                      maxCount={0}
                      defaultValue={[]}
                      placeholder="Select Months"
                      variant="default"
                      clearFiltervalue={selectedMonths}
                      className="w-auto min-h-4 p-1 text-xs text-black shadow-none border-gray-300 ml-2"
                    />
                  )} */}
                </div>
                {/* All Buttons Group */}

                <TooltipProvider>
                  <div className="flex gap-1">
                    <ToggleGroup
                      variant="outline"
                      className="inline-flex gap-0 -space-x-px rounded-lg shadow-sm shadow-black/5 rtl:space-x-reverse bg-background"
                      type="single"
                      value={selectedYorM}
                      onValueChange={(val: any) => {
                        if (val) {
                          setSelectedYorM(val) // Update the selected value

                          if (val === "Y") {
                            setMode("year")
                          } else {
                            setMode("ytd")
                          }

                          setAppliedFilters((prevFilters: any) => {
                            if (val === "Y") {
                              const newFilters = convertToFilters({ ...activeStates, C: true })

                              // Ensure filters are not duplicated
                              const filteredPrevFilters = prevFilters.filter((filter: any) => filter.key !== '"C"')

                              return [...filteredPrevFilters, ...newFilters] // Spread instead of nesting
                            } else {
                              return prevFilters.filter((filter: any) => filter.key !== '"C"')
                            }
                          })
                          setCrossFilters([])
                        }
                      }}
                    >
                      <ToggleGroupItem
                        className="rounded-none h-8 shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 data-[state=on]:bg-teal-600 data-[state=on]:text-white"
                        value="Y"
                        disabled={crossFilters.length > 0 && selectedYorM !== "Y"} // Disable if crossFilters length > 0 and "Y" isn't selected
                      >
                        Year
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        className="rounded-none h-8 shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 data-[state=on]:bg-teal-600 data-[state=on]:text-white"
                        value="M"
                        disabled={crossFilters.length > 0 && selectedYorM !== "M"} // Disable if crossFilters length > 0 and "M" isn't selected
                      >
                        Month
                      </ToggleGroupItem>
                    </ToggleGroup>

                    {/* A and H Buttons */}
                    {Object.keys(haButtonsData).map((key) => (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={activeStates[key as keyof ActiveStates] ? "outline" : "default"}
                            className={`border text-xs p-1 w-8 h-8 flex items-center justify-center ${activeStates[key as keyof ActiveStates]
                              ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                              : "bg-white text-black hover:bg-white hover:text-black"
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
                    {/* Target Button */}
                    {Object.keys(tButtonsData).map((key) => (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={activeStates[key as keyof ActiveStates] ? "outline" : "default"}
                            className={`border text-xs p-1 w-8 h-8 flex items-center justify-center ${activeStates[key as keyof ActiveStates]
                              ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                              : "bg-white text-black hover:bg-white hover:text-black"
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

                    {/* YTD Button */}
                    <Button
                      variant={mode === "ytd" ? "outline" : "default"}
                      onClick={() => handleModeChange("ytd")}
                      className={`border w-9 h-8 p-0 text-xs ${mode === "ytd"
                        ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                        : "bg-white text-black hover:bg-white hover:text-black"
                        }`}
                    // disabled={selectedYear === "2024-2025"} // Disable if selected year is 2024-2025
                    >
                      YTD
                    </Button>

                    <div className="flex gap-1">
                      <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                        <PopoverTrigger disabled={mode === "ytd"}
                          className={`${mode === "date" ? "bg-teal-600 text-white" : "bg-white text-black cursor-not-allowed"}`}>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-block" tabIndex={-1}>
                                  <Button
                                    className={`border w-8 h-8 p-0 text-xs ${isDisabled
                                      ? "bg-white text-black cursor-not-allowed"
                                      : mode === "date"
                                        ? "bg-teal-600 text-white"
                                        : "bg-white text-black"
                                      }`}
                                    disabled={isDisabled}
                                  >
                                    <Calendar strokeWidth={1} className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-sm px-2 py-1">
                                {isDisabled ? "Deselect YTD to use date filter" : "Open date picker"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </PopoverTrigger>

                        <PopoverContent className="w-auto p-4">
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <div className="flex flex-col space-y-4">
                              <div className="flex items-center space-x-4">
                                <DatePicker
                                  label="From"
                                  value={fromDate}
                                  className="w-40"
                                  minDate={dayjs().date(1).month(3).subtract(2, "year")}
                                  maxDate={dayjs()}
                                  format="DD/MM/YYYY"
                                  views={["year", "month", "day"]}
                                  onChange={handleFromDateChange}
                                  slotProps={{
                                    textField: {
                                      size: "small",
                                      className: "h-10 text-sm",
                                    },
                                  }}
                                />
                                <DatePicker
                                  label="To"
                                  value={toDate}
                                  format="DD/MM/YYYY"
                                  views={["year", "month", "day"]}
                                  onChange={handleToDateChange}
                                  minDate={dayjs().date(1).month(3).subtract(2, "year")}
                                  maxDate={dayjs().add(1, 'year')}
                                  className="w-40"
                                  slotProps={{
                                    textField: {
                                      size: "small",
                                      className: "h-10 text-sm",
                                    },
                                  }}
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  className="h-8"
                                  onClick={resetDate}
                                >
                                  Reset
                                </Button>
                                <button
                                  className="h-8 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                  onClick={handleDateFilter}
                                // disabled={!fromDate || !toDate || isContainMonth()}
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          </LocalizationProvider>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Back and Reset Buttons */}
                    {drillLevel > 0 && (
                      <Button
                        onClick={handleBackClick}
                        className="text-white text-xs mt-0.5 font-bold p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
                      >
                        <IconArrowLeft stroke={1.5} />
                      </Button>
                    )}
                    <Button
                      onClick={resetFilters}
                      className="text-white text-xs font-bold mt-0.5 p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
                    >
                      <IconRestore stroke={1.5} />
                    </Button>

                    <div className="flex items-center mx-1">
                      <ShadcnSelect value={selectedYear} onValueChange={handleYearChange}>
                        <SelectTrigger className="w-32 h-8 text-xs font-semibold border-[1.5px]">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={currentFY}>{currentFY}</SelectItem>
                          <SelectItem value={previousFY}>{previousFY}</SelectItem>
                        </SelectContent>
                      </ShadcnSelect>
                    </div>
                    {/* <Button
                      onClick={toggleExpand}
                      className="text-white text-xs font-bold mt-0.5 p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
                    >
                      {isExpanded ? (
                        <IconMinimize stroke={1.5} />
                      ) : (
                        <IconMaximize stroke={1.5} />
                      )}
                    </Button> */}
                  </div>
                </TooltipProvider>
              </div>
              {/* <div className="pt-1 pb-2 overflow-x-auto">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-200 bg-gray-100 shadow-md">
                  <nav className="flex flex-nowrap items-center gap-1 whitespace-nowrap text-sm font-medium text-gray-700">
                    {appliedFilters
                      .filter((ele) => !["A", "H", "T", "YTD", "C"].includes(ele.key.replace(/"/g, "")))
                      .map((filter, index, array) => {
                        const val =
                          /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(filter.value)
                            ? filter.value.split(",").map(d => {
                              const [y, m, d2] = d.split("-");
                              return `${d2} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m) - 1]} ${y}`;
                            }).join(" - ")
                            : /^\d{4}-\d{2}-\d{2}$/.test(filter.value)
                              ? (() => {
                                const [y, m, d2] = filter.value.split("-");
                                return `${d2} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m) - 1]} ${y}`;
                              })()
                              : /^\d{4}-\d{4}$/.test(filter.value)
                                ? `${filter.value.slice(0, 4)}-${filter.value.slice(7, 9)}`
                                : filter.value;

                        return (
                          <React.Fragment key={`filter-${filter.key}`}>
                            <span>{val}</span>
                            {index < array.length - 1 && <span className="mx-1">&gt;</span>}
                          </React.Fragment>
                        );
                      })}
                  </nav>
                </div>
              </div> */}
              {zoneWiseBreadcrumbFilters.length > 0 && (
                <div className="flex justify-start pt-1 pb-2">
                  <Breadcrumb className="shadow-md border border-gray-200 bg-gray-100 px-3 py-1 rounded-lg">
                    <BreadcrumbList>
                      {zoneWiseBreadcrumbFilters.map((filter, index, array) => {
                        const val =
                          /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(filter.value)
                            ? filter.value.split(",").map(d => {
                              const [y, m, d2] = d.split("-");
                              return `${d2} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m) - 1]} ${y}`;
                            }).join(" - ")
                            : /^\d{4}-\d{2}-\d{2}$/.test(filter.value)
                              ? (() => {
                                const [y, m, d2] = filter.value.split("-");
                                return `${d2} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m) - 1]} ${y}`;
                              })()
                              : /^\d{4}-\d{4}$/.test(filter.value)
                                ? `${filter.value.slice(0, 4)}-${filter.value.slice(7, 9)}`
                                : filter.value;

                        return (
                          <React.Fragment key={`filter-${filter.key}-${index}`}>
                            <span>{val}</span>
                            {index < array.length - 1 && <span className="mx-1">&gt;</span>}
                          </React.Fragment>
                        );
                      })}
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              )}



              {/* Chart Title */}
              <div className="flex justify-between">
                <div className="flex gap-3 items-center">
                  <span className="flex items-center text-sm font-extrabold">
                    {getDynamicHeaderText()}
                    {/* Historical (2023-24) vs Actual (2024-25) vs Target - {salesUnit} */}
                  </span>
                  {/* Custom Legend */}
                  <CustomLegend />

                </div>
              </div>
            </div>
          </CardHeader>
          {/* Chart Content */}
          <CardContent className="grid lg:grid-cols-3 md:grid-cols-1 sm:grid-cols-1 grid-col-1 gap-4 px-2">
            <div className="md:col-span-2 lg:col-span-2 shadow-md rounded-lg border border-gray-200">
              <div className="h-[450px] sm:w-sm md:w-md">
                {chartApiMessage ? (
                  <div className="flex h-full items-center justify-center rounded-lg bg-gray-50 px-4">
                    <p className="text-center text-sm font-medium text-gray-600">{chartApiMessage}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 50, right: 30, left: 20, bottom: 36 }}>
                      <XAxis dataKey="name" tick={<CustomXAxisTick />} height={60} interval={0} />
                      <YAxis
                        tick={{ fill: "#333", fontSize: "0.7rem" }}
                        label={{
                          value: `Sales (${salesUnit})`,
                          angle: -90,
                          position: "insideLeft",
                          fill: "#333",
                          fontSize: 11,
                        }}
                        axisLine={{ stroke: "#333" }}
                        tickFormatter={formatNumber}
                      />
                      <RechartTooltip content={<CustomTooltip />} cursor={{ fill: "#f0f0f0" }} />
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

                      {(() => {
                        // Identify the most underperforming bar index
                        let mostUnderperformingIndex = -1
                        let maxUnderperformance = 0

                        chartData.forEach((item, index) => {
                          const actual: any = item.ACTUAL_TMT_SALES || 0
                          const historical: any = item.ACTUAL_HISTORY_TMT_SALES || 0
                          const target: any = item.TARGET_TMT_SALES || 0

                          // Calculate underperformance based on the lowest percentage compared to historical/target
                          const underperformance = historical > 0 ? ((actual - historical) / historical) * 100 : 0
                          const targetUnderperformance = target > 0 ? ((actual - target) / target) * 100 : 0

                          const worstUnderperformance = Math.max(underperformance, targetUnderperformance)

                          if (worstUnderperformance > maxUnderperformance) {
                            maxUnderperformance = worstUnderperformance
                            mostUnderperformingIndex = index
                          }
                        })

                        return Object.entries(categoryData).map(([key, { color, name }]) => {
                          const dataKey = getDataKey(key, mode, drillLevel)
                          return (
                            activeStates[key as keyof ActiveStates] && (
                              <Bar
                                className="cursor-not-allowed"
                                key={key}
                                dataKey={dataKey}
                                name={name}
                                fill={color}
                                // onClick={handleBarClick}
                                maxBarSize={40}
                                alignmentBaseline="before-edge"
                                radius={[6, 6, 0, 0]}
                              >
                                <LabelList dataKey={dataKey} content={renderCustomizedLabel} />

                                {/* Display red indicator only for the most underperforming actual sales bar */}
                                {/* {key === "A" && mostUnderperformingIndex !== -1 && (
                                  <LabelList
                                    content={(props) => {
                                      const { x, y, width, index } = props;
    
                                      if (index === mostUnderperformingIndex) {
                                        return (
                                          <RedIndicator x={x} y={y} width={width} />
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                )} */}
                              </Bar>
                            )
                          )
                        })
                      })()}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* <div className="flex justify-center">
                {drillLevel > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {drillHistory.map((item, index) => (
                      <Badge
                        className="py-1 text-xs"
                        key={index}
                        variant={badgeVariants[index % badgeVariants.length]}
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                )}
              </div> */}
              {/* Drill History Badges */}
              {/* <div className="w-full flex justify-center mb-0">
                <DrillIndicator
                  drillLevel={drillLevel}
                  drillHistory={drillHistory}
                  selectedYorM={selectedYorM}
                />
              </div> */}
            </div>
            <div className="">
              <TablePerformancesales
                salesUnit={salesUnit}
                data={chartData}
                activeStates={activeStates}
                drillLevel={drillLevel}
              />
            </div>
          </CardContent>
        </div>
        {isExpanded && <ExpandedChart />}
      </Card>
      {/* <SbuFiscalYearTable/> */}
      <TopRetail sbu={sbuOptions} />
    </>
  )
}

export default SalesDrill
