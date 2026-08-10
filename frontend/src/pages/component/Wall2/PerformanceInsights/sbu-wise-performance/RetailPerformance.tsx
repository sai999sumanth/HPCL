import { useState, useCallback, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
} from "@/@/components/ui/card";
import { toast } from "sonner";
import {
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import dayjs, { Dayjs } from "dayjs";
import ApiLoader from "@/services/apiLoader";
import convertToFilters, { removeOldValues } from "@/utils/dynamicFilter";
import { format, formatDate, startOfMonth, subDays } from "date-fns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import React from "react";
import { Separator } from "@/@/components/ui/separator";
import RetailSalesPerformance from "../RetailSalesPerformance";
import { fetchChartData, fetchDistinctValues } from "../../api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { Button } from "@/@/components/ui/button";
import { Calendar } from "lucide-react";
import GrowthStatCard from "../GrowthCard";
import SBUWiseProductLevel from "../SalesProductLevelCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { MultiSelect } from "@/@/components/ui/industry-multiselect";

type ChartMode = "month" | "year" | "ytd" | "date";

interface ActiveStates {
  H: boolean;
  A: boolean;
  T: boolean;
  C?: boolean;
}

interface FilterOption {
  key: string;
  cond: string;
  value: string;
}

const RetailPerformance: React.FC = () => {

  const [activeStates, setActiveStates] = useState<ActiveStates>({
    A: true,
    H: true,
    T: true,
    C: true,
  });
  let perspectiveFilters = convertToFilters(activeStates);
  let [appliedFilters, setAppliedFilters] =
    useState<FilterOption[]>(perspectiveFilters);
  // Order of filters for hierarchy

  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<ChartMode>("month");

  const [drillHistory, setDrillHistory] = useState<string[]>(
    mode === "month" ? ["FY 2025-2026"] : []
  );
  const firstDayOfMonth = dayjs().date(1).month(3).subtract(1, "year");

  const [selectedYear, setSelectedYear] = useState("2025-2026");
  const [isOpen, setIsOpen] = useState(false);
  const [sbuArray, setSbuArray] = useState([]);
  const [currentSalesArray, setCurrentSalesArray] = useState([]);
  const [historicalSalesArray, setHistoricalSalesArray] = useState([]);
  const [sbuArrayState, setSbuArrayState] = useState([]);
  const [currentSalesState, setCurrentSalesState] = useState([]);
  const [historicalSalesState, setHistoricalSalesState] = useState([]);

  const [sbuList, setSbuList] = useState([]);
  const [ytdData, setYtdData] = useState([]);
  const [ytcurrentData, setYtcurrentData] = useState([]);
  const [ytdHistoricalData, setYtdHistoricalData] = useState([]);
  const [Ytdsbuname, setYtdsbuname] = useState([]);
  const [YTdcurrentSales, setYtcurrentSales] = useState([]);
  const [YtdHistoricalSales, setYtdHistoricalSales] = useState([]);
  const [YtdSbuNameprevious, setYtdSbuNameprevious] = useState([]);
  const [YtdPreviousCurrentSales, setYtdPreviousCurrentSales] = useState([]);
  const [YtdPreviousHistoricSales, setYtdPreviousHistoricSales] = useState([]);
  const productMultiSelectRef = useRef(null);
  const [productName, setProductName] = useState<any>([]);

  const [recentSales, setRecentSales] = useState([]);
  // Stores the current sales data

  const [pastSales, setPastSales] = useState([]);
  const firstDayOfApril = dayjs().year(2024).month(3).startOf("month");

  // Get yesterday's date
  const yesterday = dayjs().subtract(1, "day");

  // State for date range
  const [fromDate, setFromDate] = useState(firstDayOfApril);
  const [toDate, setToDate] = useState(yesterday);
  const [productList, setProductList] = useState<any>([]);

  useEffect(() => {
    RetailYTDmarketingTotal();
    ZoneWiseYTD();
    ZoneWiseYTPM();
    ZoneWiseYTPMMarketingTotal();
  }, [selectedYear, productName]);

  useEffect(() => {
    ZoneWiseDateRange();
    SalesSummaryForDateRange();
  }, [selectedYear, productName]);

  useEffect(() => { getProductDetails() }, [])

  const getProductDetails = async () => {
    let payload = [
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
        key: "SBU_Name",
        value: "Retail",
        cond: "=",
      }
    ];

    try {
      const response = await fetchDistinctValues({
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        column: ["ProductName"],
        where_cond: payload,
      });
      if (response.status && response.data) {
        setProductList(response.data["ProductName"]);
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching distinct values for product name`, error);
    }
  }

  const ZoneWiseYTD = async () => {
    setIsLoading(true);
    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: "Retail" },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: '"SBU_Name"', // Pass drill_state as empty
        time_grain: "Yearly",
        resp_format: "summary",
      });
      if (response.status && response.data) {
        // Ensure we have valid data or use empty objects
        const zoneNames = response.data?.data.Zone_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        // Convert to arrays, handling potential undefined values
        setSbuArray(Object.values(zoneNames));
        setCurrentSalesArray(Object.values(currentSales));
        setHistoricalSalesArray(Object.values(historicalSales));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
  };

  const ZoneWiseDateRange = async (
    fromDateOverride?: dayjs.Dayjs,
    toDateOverride?: dayjs.Dayjs
  ) => {
    setIsLoading(true);
    const formatDate = (date) => {
      return dayjs(date).format("YYYY-MM-DD");
    };

    // Determine the date range based on selected year
    let dateValue;
    if (selectedYear === "2024-2025") {
      dateValue = `${formatDate(fromDate)},${formatDate(toDate)}`;
    } else if (selectedYear === "2025-2026") {
      dateValue = `${formatDate(fromDate)},${formatDate(toDate)}`;
    } else {
      // Use the provided dates or state dates as fallback
      const fromD = fromDateOverride || fromDate;
      const toD = toDateOverride || toDate;
      dateValue = `${formatDate(fromDate)},${formatDate(toDate)}`;
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: "Retail" },
      { key: '"DATE"', cond: "equals", value: dateValue },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: '"SBU_Name"',
        time_grain: "Yearly",
        resp_format: "summary",
      });
      if (response.status && response.data) {
        // Ensure we have valid data or use empty objects
        const zoneNames = response.data?.data.Zone_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        // Convert to arrays, handling potential undefined values
        setSbuArrayState(Object.values(zoneNames));
        setCurrentSalesState(Object.values(currentSales));
        setHistoricalSalesState(Object.values(historicalSales));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
  };

  const SalesSummaryForDateRange = async (
    type?: string,
    fromDateOverride?: dayjs.Dayjs,
    toDateOverride?: dayjs.Dayjs
  ) => {
    setIsLoading(true);
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD");
    };

    // Use override parameters if provided, otherwise use state
    const fromDateToUse = fromDateOverride || fromDate;
    const toDateToUse = toDateOverride || toDate;

    if (!fromDateToUse || !toDateToUse) {
      console.error("From date or to date is null");
      setIsLoading(false);
      return;
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear }, // Add this line to use selectedYear
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDate)},${formatDate(toDate)}`,
      },
    ];
    // Rest of your function remains the same
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
      });
      if (response.status && response.data) {
        // Ensure we have valid data or use empty objects
        const sbuNames = response.data?.data.SBU_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        // Convert to arrays, handling potential undefined values
        setSbuList(Object.values(sbuNames));
        setRecentSales(Object.values(currentSales));
        setPastSales(Object.values(historicalSales));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
  };

  const RetailYTDmarketingTotal = async () => {
    setIsLoading(true);
    const formatDate = (date) => {
      // console.log("data",date)
      return dayjs(date).format("YYYY-MM-DD");
    };
    const ytddate = formatDate(toDate);

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      { key: '"SBU_Name"', cond: "equals", value: "Retail" },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
      });
      if (response.status && response.data) {
        // Ensure we have valid data or use empty objects
        const sbuNames = response.data?.data.SBU_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        // Convert to arrays, handling potential undefined values
        setYtdData(Object.values(sbuNames));
        setYtcurrentData(Object.values(currentSales));
        setYtdHistoricalData(Object.values(historicalSales));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
  };

  const ZoneWiseYTPM = async () => {
    setIsLoading(true);

    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const yesterday = subDays(today, 1);

    const dateRangeStart = format(firstDayOfMonth, "yyyy-MM-dd");
    const dateRangeEnd = format(yesterday, "yyyy-MM-dd");

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: "Retail" },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: '"SBU_Name"',
        time_grain: "Yearly",
        resp_format: "summary",
      });

      if (response.status && response.data) {
        const zoneNames = response.data?.data.Zone_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        setYtdsbuname(Object.values(zoneNames));
        setYtcurrentSales(Object.values(currentSales));
        setYtdHistoricalSales(Object.values(historicalSales));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
  };

  const ZoneWiseYTPMMarketingTotal = async () => {
    setIsLoading(true);

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: "Retail" },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: '"SBU_Name"',
        time_grain: "Yearly",
      });

      if (response.status && response.data) {
        const zoneNames = response.data?.data.Zone_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        setYtdSbuNameprevious(Object.values(zoneNames));
        setYtdPreviousCurrentSales(Object.values(currentSales));
        setYtdPreviousHistoricSales(Object.values(historicalSales));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
  };

  const getCurrentFinancialYear = () => {
    const today = dayjs();
    const currentYear = today.year();
    const startMonth = 3; // April (0-based month)
    let fyStart = dayjs().year(currentYear).month(startMonth).startOf("month");
    let fyEnd = dayjs()
      .year(currentYear + 1)
      .month(startMonth - 1)
      .endOf("month");

    // If current date is before April, adjust financial year back one year
    if (today.month() < startMonth) {
      fyStart = fyStart.subtract(1, "year");
      fyEnd = fyEnd.subtract(1, "year");
    }
    return { start: fyStart, end: fyEnd };
  };

  const validateDateRange = (from, to) => {
    if (!from || !to) return;

    const fy = getCurrentFinancialYear();
    const isWithinFY =
      from.isAfter(fy.start) &&
      from.isBefore(fy.end) &&
      to.isAfter(fy.start) &&
      to.isBefore(fy.end);

    // setShowWarning(!isWithinFY);

    // if (!isWithinFY) {
    // toast.warning(
    // `Selected dates are outside the current financial year (${fy.start.format('DD/MM/YYYY')} - ${fy.end.format('DD/MM/YYYY')})`
    // );
    // }
  };

  const handleFromDateChange = (newValue) => {
    setFromDate(newValue);
    // validateDateRange(newValue, toDate);
  };

  const handleToDateChange = (newValue) => {
    setToDate(newValue);
    // validateDateRange(fromDate, newValue);
  };

  // Modify the handleDateFilter function to dynamically set date ranges based on selected year
  const handleDateFilter = () => {
    // if (fromDate && toDate) {
    //   const perspectiveFilters = appliedFilters.filter((filter) =>
    //     ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
    //   );
    //   setAppliedFilters(() => [
    //     ...perspectiveFilters,
    //     { key: '"DATE"', cond: "equals", value: `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}` },
    //   ]);
    //   setMode("date");
    //   setDrillHistory([
    //     `${fromDate.format("MMM-DD")} - ${toDate.format("MMM-DD")}`,
    //   ]);
    // }
    // validateDateRange(fromDate, toDate);

    // Close the popover after applying filter
    setIsOpen(false);
    ZoneWiseDateRange();
    SalesSummaryForDateRange();
  };

  const resetDate = () => {
    // First set the state with new date values
    const resetFromDate = firstDayOfMonth;
    const resetToDate = yesterday;

    setFromDate(resetFromDate);
    setToDate(resetToDate);

    // Use these local variables directly in your function calls instead of
    // relying on the state values which haven't updated yet
    validateDateRange(resetFromDate, resetToDate);

    // Pass the explicit date values to your API calls
    SalesSummaryForDateRange("reset", resetFromDate, resetToDate);
    ZoneWiseDateRange(resetFromDate, resetToDate);
  };

  const handleYearChange = (value) => {
    setSelectedYear(value);
    setAppliedFilters((prev) => [
      ...prev,
      { key: '"fiscal_year"', cond: "equals", value: value },
    ]);
    const [startYear, endYear] = value.split("-");
    if (startYear === "2024") {
      const fromdate = dayjs().date(1).month(3).subtract(1, "year");
      const todate = dayjs().year(dayjs().year()).month(2).date(31);
      setFromDate(fromdate);
      setToDate(todate);
    } else {
      // Default: current FY based on today's date
      const fromdate = dayjs().date(1).month(3);
      const todate = dayjs().add(0, "year").subtract(1, "day");
      setFromDate(fromdate);
      setToDate(todate);
    }
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
      };
    } else {
      return {
        background: "bg-gradient-to-br from-red-50 via-red-100 to-red-200",
        glow: "before:bg-red-500/20",
        text: "text-black",
        gradientText: "bg-gradient-to-r from-red-500 to-rose-600",
        border: "border-red-200/30",
        highlight: "group-hover:text-red-500",
        icon: "bg-red-500",
      };
    }
  };

  const CompactMarketingMetrics: React.FC<{
    title: string;
    currentValue: number;
    historicalValue: number;
  }> = ({ title, currentValue, historicalValue }) => {
    const calculatePercentage = (
      currentValue: number,
      historicalValue: number
    ) => {
      if (historicalValue === 0) {
        return currentValue !== 0 ? 100 : 0; // If historical is 0, return 100% if current exists, 0% if both are 0
      }
      return Number(
        (((currentValue - historicalValue) / historicalValue) * 100).toFixed(2)
      );
    };

    const percentageNum = calculatePercentage(currentValue, historicalValue);
    const styles = getStyles(percentageNum);
    return (
      <Card className="w-full max-w-xl shadow rounded-md bg-white border border-[#EDF4F2] bg-gradient-to-br from-purple-300 via-blue-300 to-cyan-100">
        <CardContent className="px-1 py-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-black">{title}</div>

            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-gray-800 uppercase">Curr</span>
                <span className="text-sm font-bold">
                  {currentValue.toLocaleString()}
                </span>
              </div>

              <div className="h-6 w-px bg-gray-200"></div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-white-800 uppercase">Hist</span>
                <span className="text-sm font-bold">
                  {historicalValue.toLocaleString()}
                </span>
              </div>

              <div
                className={`flex items-center ${styles.background} px-2 py-1 rounded-full text-xs`}
              >
                <span className={`text-[12px] font-extrabold ${styles.text}`}>
                  {percentageNum > 0 ? "+" : ""}
                  {percentageNum.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getDateRange = () => {
    const [startYear, endYear] = selectedYear.split("-");
    if (startYear === "2024") {
      const fromdate = dayjs().date(1).month(3).subtract(1, "year");
      const todate = dayjs().year(dayjs().year()).month(2).date(31);
      return `${fromdate.format("DD-MMM-YYYY")} to ${todate.format(
        "DD-MMM-YYYY"
      )}`;
    } else {
      // Default: current FY based on today's date
      const fromdate = dayjs().date(1).month(3);
      const todate = dayjs().add(0, "year").subtract(1, "day");
      return `${fromdate.format("DD-MMM-YYYY")} to ${todate.format(
        "DD-MMM-YYYY"
      )}`;
    }
  };

  return (
    <>
      <Card className="w-full bg-white rounded-lg border border-gray-200 pt-2 px-2">
        {isLoading && <ApiLoader loading={isLoading} />}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-start-3 lg:col-span-2 flex items-center justify-end">
            <span className="text-lg font-bold">
              RETAIL SBU MARKETING SUMMARY (TMT)
            </span>
          </div>
          <div className="lg:col-start-5 lg:col-span-2 gap-3 flex items-center justify-end">
            <MultiSelect
              ref={productMultiSelectRef}
              options={productList.map((product) => ({
                label: product.toUpperCase(),
                value: product.toUpperCase(),
                disabled: false,
              }))}
              maxCount={0}  // Limit to single selection
              onValueChange={setProductName}
              placeholder="Select Product"
              className="w-42 min-h-9 text-xs text-black font-bold border-[1.5px] shadow-none border-gray-300"
              value={productName}
            />

            <div className="flex items-end justify-end">
              {/* <h2 className="text-sm font-bold">{displayYear}</h2> */}
              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger className="w-32 h-9 text-xs font-semibold border-[1.5px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-2026">2025-2026</SelectItem>
                  <SelectItem value="2024-2025">2024-2025</SelectItem>

                  {/* <SelectItem value="2023-2024">2023-2024</SelectItem> */}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>


        <div className="md:col-start-2 lg:col-span-1">
          <CompactMarketingMetrics
            title="YTD (MARKETING TOTAL)"
            currentValue={Math.round(
              ytcurrentData.reduce((acc, val) => acc + val, 0)
            )}
            historicalValue={Math.round(
              ytdHistoricalData.reduce((acc, val) => acc + val, 0)
            )}
          />
        </div>
        <span className="text-[12px] font-bold">
          Zone Wise YTD ({getDateRange()})
        </span>
        <div
          className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2`}
        >
          {sbuArray.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              currentValue={currentSalesArray[index] || 0}
              historicalValue={historicalSalesArray[index] || 0}
            />
          ))}
        </div>

        <Separator className="mt-2 h-[2px] bg-gray-200" />

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          <div className="md:col-start-4 lg:col-span-4">
            <CompactMarketingMetrics
              title="YTPM (MARKETING TOTAL TILL PREVIOUS MONTH)"
              currentValue={Math.round(
                YtdPreviousCurrentSales.reduce((acc, val) => acc + val, 0)
              )}
              historicalValue={Math.round(
                YtdPreviousHistoricSales.reduce((acc, val) => acc + val, 0)
              )}
            />
          </div>
        </div>
        <span className="text-[12px] font-bold">
          Zone Wise YTPM (
          {dayjs().subtract(1, "year").month(3).format("MMM'YYYY")} -{" "}
          {dayjs().subtract(1, "month").format("MMM'YYYY")})
        </span>
        <div
          className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2`}
        >
          {Ytdsbuname.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              currentValue={YTdcurrentSales[index] || 0}
              historicalValue={YtdHistoricalSales[index] || 0}
            />
          ))}
        </div>
        <Separator className="my-2 my-4 h-[2px] bg-cyan-700" />

        <div className="grid grid-cols-1 md:grid-cols-5 md:col-span-2 gap-3 justify-end">
          <div className="lg:col-span-2">
            <CompactMarketingMetrics
              title="Sales summary (Date Range)"
              currentValue={Math.round(
                recentSales.reduce((acc, val) => acc + val, 0)
              )}
              historicalValue={Math.round(
                pastSales.reduce((acc, val) => acc + val, 0)
              )}
            />
          </div>
          <div className="lg:col-start-3 lg:col-span-2 flex items-center justify-start">
            <span className="text-lg font-bold">
              SALES FOR DATE RANGE (TMT)
            </span>
          </div>

          <div className="flex gap-1 lg:col-start-5 justify-end">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger>
                <Button
                  className={`border w-8 h-8 p-0 text-xs text-white ${
                    mode === "date"
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
                        sx={{
                          width: "200px",
                        }}
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
                        sx={{
                          width: "200px",
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
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </LocalizationProvider>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* <span className="text-[12px] font-bold">Zone Wise Date Range ({dayjs().subtract(1, "year").month(3).date(1).format("DD-MMM-YYYY")} to {dayjs().subtract(1, "day").format("DD-MMM-YYYY")})</span> */}
        <span className="text-[12px] font-bold">
          Zone Wise Date Range ({fromDate.format("DD-MMM-YYYY")} to{" "}
          {toDate.format("DD-MMM-YYYY")})
        </span>
        <div
          className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2`}
        >
          {sbuArrayState.map((sbu, index) => (
            <GrowthStatCard
              key={index}
              title={sbu}
              currentValue={currentSalesState[index] || 0}
              historicalValue={historicalSalesState[index] || 0}
            />
          ))}
        </div>

        <Separator className="my-2 my-4 h-[2px] bg-cyan-700" />
        <SBUWiseProductLevel sbu="Retail" />
        <div className="mt-1 mb-2">
          {/* <RetailSalesPerformance sbu="Retail" /> */}
        </div>
      </Card>
    </>
  );
};

export default RetailPerformance;
