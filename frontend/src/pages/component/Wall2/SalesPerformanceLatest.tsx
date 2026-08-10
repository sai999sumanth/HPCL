import { useState, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/@/components/ui/card"
import { toast } from "sonner"
import { Stepper, Step, StepLabel } from "@mui/material"
import { styled } from "@mui/material/styles"
import { useNavigate } from "react-router-dom"
import dayjs from "dayjs"
import ApiLoader from "@/services/apiLoader"
import convertToFilters from "@/utils/dynamicFilter"
import { format, startOfMonth, subDays } from "date-fns"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import { LocalizationProvider } from "@mui/x-date-pickers"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import type React from "react"
import { Separator } from "@/@/components/ui/separator"
import { fetchChartData, fetchDistinctValues, fetchProductValues } from "./api"
import SalesDrill from "./SalesDrill"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Button } from "@/@/components/ui/button"
import { AlertCircle, Calendar, Loader2, RotateCcw } from "lucide-react"
import GrowthStatCard from "./PerformanceInsights/GrowthCard"
import SBUWiseProductLevel from "./PerformanceInsights/SalesProductLevelCard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/@/components/ui/alert"
import {
  getIndianFiscalYearMeta,
  getDefaultFiscalYearDropdownValue,
  parseFiscalYearLabel,
  getPreviousFYSbuDateRangeDefaults,
  getCurrentMonthStartThroughYesterdayClamped,
  getIndianFyYtdAprilStartThroughYesterday,
  getIndianFyYtpAprilThroughPreviousMonthEnd,
} from "@/utils/fiscalYearUtils"

interface ChartData {
  name: string
  [key: string]: number | string
}

type ChartMode = "month" | "year" | "ytd" | "date"

interface ActiveStates {
  H: boolean
  A: boolean
  T: boolean
  C?: boolean
}

interface Filter {
  key: string
  cond: string
  value: string
}

const NO_DATA_SELECTION_MESSAGE = "No Data Present for the current selection"
const NO_DATA_AVAILABLE_MESSAGE = "No data available"

/** Backend may return e.g. "Internal Error:- <uuid>" — treat as empty chart / no data. */
function isChartInternalErrorMessage(message: unknown): boolean {
  return String(message ?? "").includes("Internal Error:-")
}

const categoryData = {
  H: { color: "#0998be", name: "Historical" },
  A: { color: "#f6c95e", name: "Actual" },
  T: { color: "#8f72da", name: "Target" },
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

const CustomStepper = styled(Stepper)({
  // backgroundColor: '#f0f0f0',
  padding: "2px",
  borderRadius: "8px",
  // border: '1px solid #e0e0e0',
  "& .MuiStepLabel-label": {
    color: "#333",
    "&.Mui-active": {
      color: "#00a495 !important",
    },
    "&.Mui-completed": {
      color: "#00a495 !important",
    },
  },
  "& .MuiStepIcon-root": {
    color: "#ccc",
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
}

interface ActiveStates {
  H: boolean
  A: boolean
  T: boolean
  C?: boolean
}

export const DrillIndicator: React.FC<DrillStateIndicatorProps> = ({ drillLevel, drillHistory }) => {
  const states = ["Month", "SBU", "Zone", "Region", "Sales Area", "Product"]

  return (
    <div className="space-y-2 text-xs px-8">
      <CustomStepper style={{ width: "650px" }} activeStep={drillLevel} alternativeLabel>
        {states.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </CustomStepper>
    </div>
  )
}

const SalesPerformanceLatest: React.FC = () => {
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
  const [errorMessage, setErrorMessage] = useState("")
  const [emptyStateBannerMessage, setEmptyStateBannerMessage] = useState(NO_DATA_SELECTION_MESSAGE)
  const [mode, setMode] = useState<ChartMode>("month")
  const firstDayOfApril = dayjs().month(3).date(1);

  const [selectedYear, setSelectedYear] = useState(() => getDefaultFiscalYearDropdownValue())
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitchOn, setIsSwitchOn] = useState(false)
  const [sbuArray, setSbuArray] = useState([])
  const [currentSalesArray, setCurrentSalesArray] = useState([])
  const [historicalSalesArray, setHistoricalSalesArray] = useState([])
  const [sbuArrayState, setSbuArrayState] = useState([])
  const [currentSalesState, setCurrentSalesState] = useState([])
  const [historicalSalesState, setHistoricalSalesState] = useState([])


  const [sbuList, setSbuList] = useState([])
  const [ytdData, setYtdData] = useState([])
  const [ytcurrentData, setYtcurrentData] = useState([])
  const [ytdHistoricalData, setYtdHistoricalData] = useState([])
  const [Ytdsbuname, setYtdsbuname] = useState([])
  const [YTdcurrentSales, setYtcurrentSales] = useState([])
  const [YtdHistoricalSales, setYtdHistoricalSales] = useState([])
  const [YtdSbuNameprevious, setYtdSbuNameprevious] = useState([])
  const [YtdPreviousCurrentSales, setYtdPreviousCurrentSales] = useState([])
  const [YtdPreviousHistoricSales, setYtdPreviousHistoricSales] = useState([])


  const [loadingSbuYtd, setLoadingSbuYtd] = useState(true);
  const [loadingSbuYtpm, setLoadingSbuYtpm] = useState(true);
  const [loadingYtpmMarketing, setLoadingYtpmMarketing] = useState(true);
  const [loadingZoneDateRange, setLoadingZoneDateRange] = useState(true);

  // Stores the list of SBU (Strategic Business Unit) names
  useEffect(() => {
    // Small timeout to ensure DOM is rendered
    const timer = setTimeout(() => {
      const element = document.getElementById('marketing-summary-heading');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);
  const [recentSales, setRecentSales] = useState([])
  // Stores the current sales data

  const [pastSales, setPastSales] = useState([])
  // Stores the current sales data

  const [fromDate, setFromDate] = useState(() => getCurrentMonthStartThroughYesterdayClamped().from)
  const [toDate, setToDate] = useState(() => getCurrentMonthStartThroughYesterdayClamped().to)
  const { currentFY, previousFY } = getIndianFiscalYearMeta()

  const handlePopoverOpenChange = (open) => {
    if (open) {
      const fy = parseFiscalYearLabel(selectedYear)
      if (fy && selectedYear === previousFY) {
        // Display full previous FY range: 01-Apr-2025 to 31-Mar-2026
        setFromDate(dayjs().year(fy.start).month(3).date(1))   // 01-Apr-2025
        setToDate(dayjs().year(fy.end).month(2).date(31))       // 31-Mar-2026
      } else if (fy) {
        const r = getCurrentMonthStartThroughYesterdayClamped()
        setFromDate(r.from)
        setToDate(r.to)
      }
    }
    setIsOpen(open);
  };
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
      const response = await fetchProductValues({
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
    // ← ADD THIS BLOCK — wipe everything before re-fetching
  setSbuArray([]); setCurrentSalesArray([]); setHistoricalSalesArray([])
  setSbuArrayState([]); setCurrentSalesState([]); setHistoricalSalesState([])
  setYtdData([]); setYtcurrentData([]); setYtdHistoricalData([])
  setYtdsbuname([]); setYtcurrentSales([]); setYtdHistoricalSales([])
  setYtdSbuNameprevious([]); setYtdPreviousCurrentSales([]); setYtdPreviousHistoricSales([])
  setRecentSales([]); setPastSales([])
    SbuWiseYTD()
    SbuWiseDateRange()
    YTDMarketingTotal()
    SbuWiseYTPM()
    YTDPMMarketingTotal()
    SalesSummaryForDateRange() // Add this line to update the Sales summary
  }, [mode, selectedYear]) // fromDate, toDate


  const SbuWiseYTD = async () => {
    setLoadingSbuYtd(true)
    setSbuArray([])
    setCurrentSalesArray([])
    setHistoricalSalesArray([])
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD")
    }

    // Calculate fiscal year date range based on selectedYear
    let dateRange = ""
    const fyParsed = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    if (fyParsed && selectedYear === prevFY) {
      dateRange = `${fyParsed.start}-04-01,${fyParsed.end}-03-31`
    } else if (fyParsed) {
      const ytd = getIndianFyYtdAprilStartThroughYesterday(selectedYear)
      if (ytd) {
        dateRange = `${formatDate(ytd.from)},${formatDate(ytd.to)}`
      }
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
    ]

    // Add DATE filter if dateRange is set
    if (dateRange) {
      filter.push({
        key: '"DATE"',
        cond: "equals",
        value: dateRange,
      })
    }

    // Remove SBU_Name equals Retail filter if present
    const filteredFilters = filter.filter(
      (f) => !(f.key === '"SBU_Name"' && f.cond === "equals" && f.value === "Retail")
    )

    try {
      const response = await fetchChartData({
        filters: filteredFilters,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
      })
      if (isChartInternalErrorMessage(response?.message)) {
        setSbuArray([])
        setCurrentSalesArray([])
        setHistoricalSalesArray([])
        setErrorMessage("")
        setEmptyStateBannerMessage(NO_DATA_AVAILABLE_MESSAGE)
        setLoadingSbuYtd(false) 
        return
      }
      if (response.status && response.data) {
        setEmptyStateBannerMessage(NO_DATA_SELECTION_MESSAGE)
        // Ensure we have valid data or use empty objects
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        // Convert to arrays, handling potential undefined values
        setSbuArray(Object.values(sbuNames))
        setCurrentSalesArray(Object.values(currentSales))
        setHistoricalSalesArray(Object.values(historicalSales))
        setLoadingSbuYtd(false) 
      } else {
        setSbuArray([])
        setCurrentSalesArray([])
        setHistoricalSalesArray([])
        setLoadingSbuYtd(false) 
      }
    } catch (error) {
      setLoadingSbuYtd(false) 
      console.error("Error fetching data:", error)
    }
  }

  const formatDate = (date: dayjs.Dayjs) => {
    return dayjs(date).format("YYYY-MM-DD")
  }

  const SbuWiseDateRange = async (fromDateOverride?: dayjs.Dayjs, toDateOverride?: dayjs.Dayjs) => {
    setIsLoading(true)
    setSbuArrayState([])
    setCurrentSalesState([])
    setHistoricalSalesState([])
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD")
    }

    // Calculate dates based on selectedYear if no overrides provided
    let fromDateToUse: dayjs.Dayjs
    let toDateToUse: dayjs.Dayjs

    if (fromDateOverride && toDateOverride) {
      // Use override parameters if provided
      fromDateToUse = fromDateOverride
      toDateToUse = toDateOverride
    } else {
      const fyParsed = parseFiscalYearLabel(selectedYear)
      const { previousFY: prevFY } = getIndianFiscalYearMeta()
      if (fyParsed && selectedYear === prevFY) {
        const d = getPreviousFYSbuDateRangeDefaults(fyParsed)
        fromDateToUse = d.from
        toDateToUse = d.to
      } else {
        fromDateToUse = fromDate
        toDateToUse = toDate
      }
    }

    if (!fromDateToUse || !toDateToUse) {
      console.error("From date or to date is null")
      setIsLoading(false)
      return
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
      // { key: '"YTD"', cond: "equals", value: "true" },
      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDateToUse)},${formatDate(toDateToUse)}`,
      },
    ]

    // Remove SBU_Name equals Retail filter if present
    const filteredFilters = filter.filter(
      (f) => !(f.key === '"SBU_Name"' && f.cond === "equals" && f.value === "Retail")
    )

    // Rest of your function remains the same
    try {
      console.log("SbuWiseDateRange API call with filters:", filteredFilters)
      const response = await fetchChartData({
        filters: filteredFilters,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
      })
      console.log("SbuWiseDateRange API response:", response)
      if (isChartInternalErrorMessage(response?.message)) {
        setSbuArrayState([])
        setCurrentSalesState([])
        setHistoricalSalesState([])
        setErrorMessage("")
        setEmptyStateBannerMessage(NO_DATA_AVAILABLE_MESSAGE)
        setIsLoading(false)
        return
      }
      if (response.status && response.data) {
        setEmptyStateBannerMessage(NO_DATA_SELECTION_MESSAGE)
        // Ensure we have valid data or use empty objects
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        // Convert to arrays, handling potential undefined values
        const sbuArray = Object.values(sbuNames)
        const currentArray = Object.values(currentSales)
        const historicalArray = Object.values(historicalSales)

        console.log("SbuWiseDateRange setting state:", { sbuArray, currentArray, historicalArray })
        setSbuArrayState(sbuArray)
        setCurrentSalesState(currentArray)
        setHistoricalSalesState(historicalArray)
        setIsLoading(false)
      } else {
        setSbuArrayState([])
        setCurrentSalesState([])
        setHistoricalSalesState([])
        console.warn("SbuWiseDateRange: No data in response", response)
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
      console.error("Error fetching SbuWiseDateRange data:", error)
    }
  }

  const SalesSummaryForDateRange = async (type?: string, fromDateOverride?: dayjs.Dayjs, toDateOverride?: dayjs.Dayjs) => {
    setLoadingZoneDateRange(true)
    setSbuList([])
    setRecentSales([])
    setPastSales([])  
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD")
    }

    // Calculate dates based on selectedYear if no overrides provided
    let fromDateToUse: dayjs.Dayjs
    let toDateToUse: dayjs.Dayjs

    if (fromDateOverride && toDateOverride) {
      // Use override parameters if provided
      fromDateToUse = fromDateOverride
      toDateToUse = toDateOverride
    } else {
      const fyParsed = parseFiscalYearLabel(selectedYear)
      const { previousFY: prevFY } = getIndianFiscalYearMeta()
      if (fyParsed && selectedYear === prevFY) {
        const d = getPreviousFYSbuDateRangeDefaults(fyParsed)
        fromDateToUse = d.from
        toDateToUse = d.to
      } else {
        fromDateToUse = fromDate
        toDateToUse = toDate
      }
    }

    if (!fromDateToUse || !toDateToUse) {
      console.error("From date or to date is null")
      setIsLoading(false)
      return
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear }, // Add this line to use selectedYear

      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDateToUse)},${formatDate(toDateToUse)}`,
      },
    ]

    // Remove SBU_Name equals Retail filter if present
    const filteredFilters = filter.filter(
      (f) => !(f.key === '"SBU_Name"' && f.cond === "equals" && f.value === "Retail")
    )

    // Rest of your function remains the same
    try {
      const response = await fetchChartData({
        filters: filteredFilters,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
      })
      if (isChartInternalErrorMessage(response?.message)) {
        setSbuList([])
        setRecentSales([])
        setPastSales([])
        setErrorMessage("")
        setEmptyStateBannerMessage(NO_DATA_AVAILABLE_MESSAGE)
        setLoadingZoneDateRange(false)
        return
      }
      if (response.status && response.data) {
        setEmptyStateBannerMessage(NO_DATA_SELECTION_MESSAGE)
        // Ensure we have valid data or use empty objects
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        // Convert to arrays, handling potential undefined values
        setSbuList(Object.values(sbuNames))
        setRecentSales(Object.values(currentSales))
        setPastSales(Object.values(historicalSales))
        setLoadingZoneDateRange(false)
      } else {
        setSbuList([])
        setRecentSales([])
        setPastSales([])
        setLoadingZoneDateRange(false)
      }
    } catch (error) {
      setLoadingZoneDateRange(false)
      console.error("Error fetching data:", error)
    }
  }

  const YTDMarketingTotal = async () => {
    setLoadingYtpmMarketing(true)
    setYtdData([])
    setYtcurrentData([])
    setYtdHistoricalData([])
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD")
    }

    const fyParsed = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    let dateRangeValue = ""
    if (fyParsed && selectedYear === prevFY) {
      dateRangeValue = `${fyParsed.start}-04-01,${fyParsed.end}-03-31`
    } else if (fyParsed) {
      const from = dayjs().year(fyParsed.start).month(3).date(1)
      const to = dayjs().subtract(1, "day")
      dateRangeValue = `${formatDate(from)},${formatDate(to)}`
    } else {
      dateRangeValue = `${formatDate(fromDate)},${formatDate(toDate)}`
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
      { key: '"DATE"', cond: "equals", value: dateRangeValue },
    ]

    // Remove SBU_Name equals Retail filter if present
    const filteredFilters = filter.filter(
      (f) => !(f.key === '"SBU_Name"' && f.cond === "equals" && f.value === "Retail")
    )

    // Rest of the function remains the same...
    try {
      const response = await fetchChartData({
        filters: filteredFilters,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
      })
      if (isChartInternalErrorMessage(response?.message)) {
        setYtdData([])
        setYtcurrentData([])
        setYtdHistoricalData([])
        setErrorMessage("")
        setEmptyStateBannerMessage(NO_DATA_AVAILABLE_MESSAGE)
        setLoadingYtpmMarketing(false)  
        return
      }
      if (response.status && response.data) {
        setEmptyStateBannerMessage(NO_DATA_SELECTION_MESSAGE)
        // Ensure we have valid data or use empty objects
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        // Convert to arrays, handling potential undefined values
        setYtdData(Object.values(sbuNames))
        setYtcurrentData(Object.values(currentSales))
        setYtdHistoricalData(Object.values(historicalSales))
        setLoadingYtpmMarketing(false)  
      } else {
        setLoadingYtpmMarketing(false)  
      }
    } catch (error) {
      setLoadingYtpmMarketing(false)  
      console.error("Error fetching data:", error)
    }
  }

  /** YTPM = FY Apr start → end of previous calendar month (in-FY); in April, previous month is Mar → clamp to end of April (Apr–Apr). */
  const getYTPMDateRange = () => {
    const r = getIndianFyYtpAprilThroughPreviousMonthEnd(selectedYear)
    if (!r) return ""
    return `${r.from.format("YYYY-MM-DD")},${r.to.format("YYYY-MM-DD")}`
  }

  const SbuWiseYTPM = async () => {
    setLoadingSbuYtpm(true)
    setYtdsbuname([])
    setYtcurrentSales([])
    setYtdHistoricalSales([])
    const dateRange = getYTPMDateRange()

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ]

    // Add DATE filter if dateRange is set
    if (dateRange) {
      filter.push({
        key: '"DATE"',
        cond: "equals",
        value: dateRange,
      })
    }

    // Remove SBU_Name equals Retail filter if present
    const filteredFilters = filter.filter(
      (f) => !(f.key === '"SBU_Name"' && f.cond === "equals" && f.value === "Retail")
    )

    try {
      const response = await fetchChartData({
        filters: filteredFilters,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
        action: "m60_performance",
        drill_state: "",
      })

      if (isChartInternalErrorMessage(response?.message)) {
        setYtdsbuname([])
        setYtcurrentSales([])
        setYtdHistoricalSales([])
        setErrorMessage("")
        setEmptyStateBannerMessage(NO_DATA_AVAILABLE_MESSAGE)
        setLoadingSbuYtpm(false)
        return
      }
      if (response.status && response.data) {
        setEmptyStateBannerMessage(NO_DATA_SELECTION_MESSAGE)
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        setYtdsbuname(Object.values(sbuNames))
        setYtcurrentSales(Object.values(currentSales))
        setYtdHistoricalSales(Object.values(historicalSales))
        setLoadingSbuYtpm(false)
      } else {
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        setYtdsbuname(Object.values(sbuNames))
        setYtcurrentSales(Object.values(currentSales))
        setYtdHistoricalSales(Object.values(historicalSales))
        setErrorMessage(response.message)
        setLoadingSbuYtpm(false)
      }
    } catch (error) {
      setLoadingSbuYtpm(false)
      console.error("Error fetching data:", error)
    }
  }

  const YTDPMMarketingTotal = async () => {
    setIsLoading(true)

    const dateRange = getYTPMDateRange()

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
    ]

    // Add DATE filter if dateRange is set
    if (dateRange) {
      filter.push({
        key: '"DATE"',
        cond: "equals",
        value: dateRange,
      })
    }

    // Remove SBU_Name equals Retail filter if present
    const filteredFilters = filter.filter(
      (f) => !(f.key === '"SBU_Name"' && f.cond === "equals" && f.value === "Retail")
    )

    try {
      const response = await fetchChartData({
        filters: filteredFilters,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "",
      })

      if (isChartInternalErrorMessage(response?.message)) {
        setYtdSbuNameprevious([])
        setYtdPreviousCurrentSales([])
        setYtdPreviousHistoricSales([])
        setErrorMessage("")
        setEmptyStateBannerMessage(NO_DATA_AVAILABLE_MESSAGE)
        setIsLoading(false)
        return
      }
      if (response.status && response.data) {
        setEmptyStateBannerMessage(NO_DATA_SELECTION_MESSAGE)
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        setYtdSbuNameprevious(Object.values(sbuNames))
        setYtdPreviousCurrentSales(Object.values(currentSales))
        setYtdPreviousHistoricSales(Object.values(historicalSales))
        setIsLoading(false)
      } else {
        const sbuNames = response.data?.data.SBU_Name || {}
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {}
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {}

        setYtdSbuNameprevious(Object.values(sbuNames))
        setYtdPreviousCurrentSales(Object.values(currentSales))
        setYtdPreviousHistoricSales(Object.values(historicalSales))
        setErrorMessage(response.message)
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
      console.error("Error fetching data:", error)
    }
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

  const handleYearChange = (value) => {
    setSelectedYear(value)
    setAppliedFilters((prev) => {
      const withoutFy = prev.filter((f) => f.key !== '"fiscal_year"')
      return [...withoutFy, { key: '"fiscal_year"', cond: "equals", value: value }]
    })

    const fy = parseFiscalYearLabel(value)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    let fromdate: dayjs.Dayjs
    let todate: dayjs.Dayjs
    if (fy && value === prevFY) {
      const d = getPreviousFYSbuDateRangeDefaults(fy)
      fromdate = d.from
      todate = d.to
    } else if (fy) {
      const r = getCurrentMonthStartThroughYesterdayClamped()
      fromdate = r.from
      todate = r.to
    } else {
      return
    }

    setFromDate(fromdate)
    setToDate(todate)
  }


  /** SBU Wise YTD: 01-Apr (FY start) through yesterday; on 01-Apr shows 01-Apr–01-Apr. Previous FY: full Apr–Mar. */
  const getYtdTitleRange = () => {
    const fy = parseFiscalYearLabel(selectedYear)
    if (!fy) return ""
    if (selectedYear === currentFY) {
      const ytd = getIndianFyYtdAprilStartThroughYesterday(selectedYear)
      if (!ytd) return ""
      return `${ytd.from.format("DD-MMM-YYYY")} to ${ytd.to.format("DD-MMM-YYYY")}`
    }
    const fromdate = dayjs().year(fy.start).month(3).date(1)
    const todate = dayjs().year(fy.end).month(2).date(31)
    return `${fromdate.format("DD-MMM-YYYY")} to ${todate.format("DD-MMM-YYYY")}`
  }

  /** SBU Wise YTPM title: FY start month through previous month (matches DATE range). */
  const getYtpmTitleRange = () => {
    const r = getIndianFyYtpAprilThroughPreviousMonthEnd(selectedYear)
    if (!r) return ""
    return `${r.from.format("MMM-YYYY")} - ${r.to.format("MMM-YYYY")}`
  }

  /** SBU Wise Date Range label (present FY: month start → yesterday; historical: Mar 1 start year → Mar 31 end year). */
  // const getSbuWiseDateRangeDisplay = () =>
  //   `${fromDate.format("DD-MMM-YYYY")} to ${toDate.format("DD-MMM-YYYY")}`
  const getSbuWiseDateRangeDisplay = () => {
    const fy = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()

    if (fy && selectedYear === prevFY) {
      // Last month of the fiscal year = March of the end year
      const from = dayjs().year(fy.end).month(2).date(1)   // March 1, 2026
      const to = dayjs().year(fy.end).month(2).date(31)  // March 31, 2026
      return `${from.format("DD-MMM-YYYY")} to ${to.format("DD-MMM-YYYY")}`
    }

    return `${fromDate.format("DD-MMM-YYYY")} to ${toDate.format("DD-MMM-YYYY")}`
  }
  const handleFromDateChange = (newValue) => {
    setFromDate(newValue)
    // validateDateRange(newValue, toDate)
  }

  const handleToDateChange = (newValue) => {
    setToDate(newValue)
    // validateDateRange(fromDate, newValue)
  }

  // // Modify the handleDateFilter function to fetch data for both APIs
  // const handleDateFilter = () => {
  //   validateDateRange(fromDate, toDate);
  //   YTDMarketingTotal();
  //   Summarydata();
  //   YTDDatewiseBox();
  // }

  // // Modify the reset function to fetch data for both APIs
  // const resetDate = () => {
  //   setFromDate(firstDayOfApril);
  //   setToDate(yesterday);

  //   // Fetch data for both APIs after resetting
  //   YTDMarketingTotal();
  //   Summarydata();
  //   YTDDatewiseBox();
  // }
  const resetDate = () => {
    const fyParsed = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    let resetFromDate: dayjs.Dayjs
    let resetToDate: dayjs.Dayjs

    if (fyParsed && selectedYear === prevFY) {
      const d = getPreviousFYSbuDateRangeDefaults(fyParsed)
      resetFromDate = d.from
      resetToDate = d.to
    } else if (fyParsed) {
      const r = getCurrentMonthStartThroughYesterdayClamped()
      resetFromDate = r.from
      resetToDate = r.to
    } else {
      resetFromDate = fromDate
      resetToDate = toDate
    }

    // Update the state with the reset dates
    setFromDate(resetFromDate);
    setToDate(resetToDate);

    // Trigger API calls with the default dates
    SalesSummaryForDateRange(undefined, resetFromDate, resetToDate);
    SbuWiseDateRange(resetFromDate, resetToDate);
  }


  // Create a new function to centralize data fetching
  // const fetchAllData = () => {
  //   Summarydata();
  //   YTDDatewiseBox();
  // };

  const handleDateFilter = () => {
    validateDateRange(fromDate, toDate);
    setIsOpen(false);
    // Pass the selected dates from the calendar to the API functions
    SalesSummaryForDateRange(undefined, fromDate, toDate);
    SbuWiseDateRange(fromDate, toDate);
  };


  const getStyles = (value) => {
    if (value > 0) {
      return {
        background: "bg-gradient-to-br from-blue-50 via-blue-300 to-blue-300",
        glow: "before:bg-emerald-500/20",
        text: "text-black",
        gradientText: "bg-gradient-to-r from-emerald-500 to-green-600",
        border: "border-emerald-200/30",
        highlight: "group-hover:text-emerald-500",
        icon: "bg-emerald-500",
      }
    } else {
      return {
        background: "bg-gradient-to-br from-red-50 via-red-100 to-red-200",
        glow: "before:bg-red-500/20",
        text: "text-black",
        gradientText: "bg-gradient-to-r from-red-500 to-rose-600",
        border: "border-red-200/30",
        highlight: "group-hover:text-red-500",
        icon: "bg-red-500",
      }
    }
  }

  const CompactMarketingMetrics: React.FC<{
    title: string; currentValue: number; historicalValue: number; loading?: boolean;
  }> = ({
    title,
    currentValue,
    historicalValue,
    loading = false
  }) => {
      const calculatePercentage = (currentValue: number, historicalValue: number, isLoading = false) => {
        if (historicalValue === 0) {
          return currentValue !== 0 ? 100 : 0 // If historical is 0, return 100% if current exists, 0% if both are 0
        }
        return Number((((currentValue - historicalValue) / historicalValue) * 100).toFixed(2))
      }

      const percentageNum = calculatePercentage(currentValue, historicalValue)
      const styles = getStyles(percentageNum)
      return (
        <Card className="w-full max-w-3xl shadow rounded-md bg-white border border-[#EDF4F2] bg-gradient-to-br from-purple-300 via-blue-300 to-cyan-100">
          <CardContent className="px-1 py-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-black">{title}</div>
              {loading && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" aria-hidden />
              )}
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-gray-800 uppercase">Curr</span>
                  <span className="text-sm font-bold">{currentValue.toLocaleString()}</span>
                </div>

                <div className="h-6 w-px bg-gray-200"></div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-white-800 uppercase">Hist</span>
                  <span className="text-sm font-bold">{historicalValue.toLocaleString()}</span>
                </div>

                <div className={`flex items-center ${styles.background} px-2 py-1 rounded-full text-xs`}>
                  <span className={`text-[12px] font-extrabold ${styles.text}`}>
                    {percentageNum > 0 ? "+" : ""}
                    {percentageNum.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }
  const handleRefresh = () => {
    let resetFromDate, resetToDate;

    const fyParsed = parseFiscalYearLabel(selectedYear)
    const { previousFY: prevFY } = getIndianFiscalYearMeta()
    if (fyParsed && selectedYear === prevFY) {
      const d = getPreviousFYSbuDateRangeDefaults(fyParsed)
      resetFromDate = d.from
      resetToDate = d.to
    } else if (fyParsed) {
      const r = getCurrentMonthStartThroughYesterdayClamped()
      resetFromDate = r.from
      resetToDate = r.to
    } else {
      resetFromDate = fromDate
      resetToDate = toDate
    }

    // Update the state with the new date values
    setFromDate(resetFromDate);
    setToDate(resetToDate);

    // Call the API functions to fetch data for the new date range
    SalesSummaryForDateRange("reset", resetFromDate, resetToDate);
    SbuWiseDateRange(resetFromDate, resetToDate);
  };


  const handleSwitchChange = (checked) => {
    setIsSwitchOn(checked) // Update the state based on switch status
  }
  return (
    <>
      <Card className="w-full bg-white rounded-lg border border-gray-200 pt-2 px-2">
        {isLoading && <ApiLoader loading={isLoading} />}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="md:col-start-3 lg:col-span-2">
            <CompactMarketingMetrics
              title="YTD (MARKETING TOTAL)"
              currentValue={Math.round(ytcurrentData.reduce((acc, val) => acc + val, 0))}
              historicalValue={Math.round(ytdHistoricalData.reduce((acc, val) => acc + val, 0))}
              loading={loadingSbuYtd}
            />
          </div>
          <div className="lg:col-start-3 lg:col-span-2  flex items-center justify-start">
            <span id="marketing-summary-heading" className="text-xl font-bold">MARKETING SUMMARY (TMT)</span>
          </div>
          {/* <div className="md:col-start-3 lg:col-start-5">
              <GrowthStatCard
                title="YTD (Marketing total)"
                currentValue={ytcurrentData}
                historicalValue={ytdHistoricalData}
              />
            </div> */}
          {/* <div className="lg:col-start-5">
              <GrowthStatCard
                title="FYC"
                currentValue={fycRecentSales}
                historicalValue={fycPastSales}
              />
            </div> */}
          <div className="flex items-end justify-end">
            {/* <h2 className="text-sm font-bold">{displayYear}</h2> */}
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-40 h-9 text-xs font-semibold border-[1.5px]">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentFY}>{currentFY}</SelectItem>
                <SelectItem value={previousFY}>{previousFY}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* </div> */}
        <span className="text-[12px] font-bold">SBU Wise YTD ({getYtdTitleRange()})</span>
        {!isLoading && sbuArray.length === 0 && (
          <Alert variant="default" className="mt-1 border-gray-300 py-2">
            <AlertDescription>{emptyStateBannerMessage}</AlertDescription>
          </Alert>
        )}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 p-0"> */}
        {/* <div
          className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${sbuArrayState?.length} gap-2`}
        >
          {sbuArrayState.map((sbu, index) => ( 
            <GrowthStatCard
              key={index}
              title={sbu}
              currentValue={currentSalesState[index] || 0}
              historicalValue={historicalSalesState[index] || 0}
            />
          ))}
        </div> */}

        <div className={`grid sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-${sbuArrayState?.length} gap-2`}>
          {sbuArray.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              dateType={'"YTD"'}
              dateValue={"true"}
              headerTitle={`YTD (${getYtdTitleRange()})`}
              currentValue={currentSalesArray[index] || 0}
              historicalValue={historicalSalesArray[index] || 0}
            />
          ))}
        </div>

        <Separator className="mt-2 h-[2px] bg-gray-200" />

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {/* <div className="md:col-start-4 lg:col-start-5">
            <GrowthStatCard
              title="YTPM (MARKETING TOTAL)"
              currentValue={YtdPreviousCurrentSales}
              historicalValue={YtdPreviousHistoricSales}
            />
          </div> */}
          <div className="md:col-start-5 lg:col-span-5">
            <CompactMarketingMetrics
              title="YTPM (MARKETING TOTAL TILL PREVIOUS MONTH)"
              currentValue={Math.round(YtdPreviousCurrentSales.reduce((acc, val) => acc + val, 0))}
              historicalValue={Math.round(YtdPreviousHistoricSales.reduce((acc, val) => acc + val, 0))}
              loading={loadingYtpmMarketing || loadingSbuYtpm}
            />
          </div>
        </div>
        <span className="text-[12px] font-bold">SBU Wise YTPM ({getYtpmTitleRange()})</span>
        {!isLoading && Ytdsbuname.length === 0 && (
          <Alert variant="default" className="mt-1 border-gray-300 py-2">
            <AlertDescription>{emptyStateBannerMessage}</AlertDescription>
          </Alert>
        )}
        {/* <span className="text-[12px] font-bold"> SBU Wise FYC </span>
        <div
          className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${sbuArrayState?.length} gap-2`}
        >
          {sbuArray.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              currentValue={currentFycSalesState[index] || 0}
              historicalValue={historicalFycSalesState[index] || 0}
            />
          ))}
        </div> */}
        <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${sbuArrayState?.length} gap-2`}>
          {Ytdsbuname.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              dateType={'"YTDPM"'}
              dateValue={"true"}
              headerTitle={`YTPM (${getYtpmTitleRange()})`}
              currentValue={YTdcurrentSales[index] || 0}
              historicalValue={YtdHistoricalSales[index] || 0}
            />
          ))}
        </div>
        {/* {Ytdsbuname && Ytdsbuname.length === 0 && (
          <Alert variant="info" className="bg-blue-50">
            <AlertCircle className="h-6 w-6 rounded-full" />
            <AlertTitle className="font-bold">Info</AlertTitle>
            <AlertDescription className="font-[500]">{errorMessage}</AlertDescription>
          </Alert>
        )} */}
        <Separator className="my-2 my-4 h-[2px] bg-cyan-700" />

        {/* <span className="text-[12px] font-bold">SBU Wise Current Month</span> */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 p-0"> */}
        {/* <div
          className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${sbuArrayState?.length} gap-2`}
        >
          {dateFilterSbuArray.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              currentValue={dateFilterCurrentSalesArray[index] || 0}
              historicalValue={dateFilterHistoricalSalesArray[index] || 0}
            />
          ))}
        </div> */}

        <div className="grid grid-cols-1 md:grid-cols-5 md:col-span-2 gap-3 justify-end">
          <div className="lg:col-span-2">
            <CompactMarketingMetrics
              title="SALES SUMMARY (DATE RANGE)"
              currentValue={Math.round(recentSales.reduce((acc, val) => acc + val, 0))}
              historicalValue={Math.round(pastSales.reduce((acc, val) => acc + val, 0))}
              loading={loadingZoneDateRange}
            />
          </div>
          <div className="lg:col-start-3 lg:col-span-2 flex items-center justify-start">
            <span className="text-xl font-bold">SALES FOR DATE RANGE (TMT)</span>
          </div>

          <div className="flex gap-1 lg:col-start-5 justify-end">


            <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
              <PopoverTrigger>
                <Button
                  className={`border w-8 h-8 p-0 text-xs text-white ${mode === "date"
                    ? "bg-teal-600 text-white"
                    : "bg-blue-500 hover:text-white hover:bg-blue-500"
                    }`}
                >
                  <Calendar strokeWidth={1} className="h-4 w-4" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-auto p-4">
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <div className="flex flex-col space-y-4">
                    <div className="flex flex-col md:flex-row lg:flex-row xl:flex-row content-center gap-3">
                      <DatePicker
                        label="From"
                        value={fromDate}
                        className="w-40"
                        format="DD/MM/YYYY"
                        views={["year", "month", "day"]}
                        onChange={handleFromDateChange}
                        minDate={dayjs().date(1).month(3).subtract(2, "year")}
                        maxDate={dayjs()}
                        slotProps={{
                          textField: {
                            size: "small",
                            className:
                              "h-10 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                          },
                        }}
                        sx={{ width: "200px" }}
                      />
                      <DatePicker
                        label="To"
                        value={toDate}
                        format="DD/MM/YYYY"
                        views={["year", "month", "day"]}
                        minDate={dayjs().date(1).month(3).subtract(2, "year")}
                        maxDate={dayjs()}
                        onChange={handleToDateChange}
                        className="w-40"
                        slotProps={{
                          textField: {
                            size: "small",
                            className:
                              "h-10 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                          },
                        }}
                        sx={{ width: "200px" }}
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
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </LocalizationProvider>
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleRefresh}
              className={`border w-8 h-8 p-0 mt-1 text-xs text-white bg-blue-500 hover:bg-blue-600`}
              title="Reset to default values"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* <div className="lg:col-start-5">
            <GrowthStatCard
              title="Sales summary (Date Range)"
              currentValue={recentSales}
              historicalValue={pastSales}
            />
          </div> */}
        </div>

        {/* <span className="text-[12px] font-bold">SBU Wise Date Range ({dayjs().subtract(1, "year").month(3).date(1).format("DD-MMM-YYYY")} to {dayjs().subtract(1, "day").format("DD-MMM-YYYY")})</span> */}
        <span className="text-[12px] font-bold">
          SBU Wise Date Range ({getSbuWiseDateRangeDisplay()})
        </span>

        {/* <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 p-0"> */}
        {/* <div
          className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${sbuArrayState?.length} gap-2`}
        >
          {sbuArray.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              currentValue={currentSalesArray[index] || 0}
              historicalValue={historicalSalesArray[index] || 0}
            />
          ))}
        </div> */}

        <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${sbuArrayState?.length} gap-2`}>
          {sbuArrayState.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              dateType={'"DATE"'}
              headerTitle={`Date range(${getSbuWiseDateRangeDisplay()})`}
              dateValue={`${formatDate(fromDate)},${formatDate(toDate)}`}
              currentValue={currentSalesState[index] || 0}
              historicalValue={historicalSalesState[index] || 0}
            />
          ))}
        </div>

        <Separator className="my-2 my-4 h-[2px] bg-cyan-700" />
        {
          selectedYear && selectedYear !== "" && (
            <SBUWiseProductLevel year={selectedYear} />
          )
        }
        {/* <span className="text-[12px] font-bold">SBU Wise YTPM</span> */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 p-0"> */}
        {/* <div
          className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${sbuArrayState?.length} gap-2`}
        >
          {Ytdsbuname.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              currentValue={YTdcurrentSales[index] || 0}
              historicalValue={YtdHistoricalSales[index] || 0}
            />
          ))}
        </div> */}

        <div className="mt-1 mb-2">
          <SalesDrill />
        </div>
      </Card>
    </>
  )
}

export default SalesPerformanceLatest
