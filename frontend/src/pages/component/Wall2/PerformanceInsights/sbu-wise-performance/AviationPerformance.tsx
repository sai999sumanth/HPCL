import { useState, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Toaster, toast } from "sonner";
import { Stepper, Step, StepLabel, Stack, TextField } from "@mui/material";
import { Badge } from "@/@/components/ui/badge";
import { styled } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import ApiLoader from "@/services/apiLoader";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/@/components/ui/tabs";
import convertToFilters, { removeOldValues } from "@/utils/dynamicFilter";
import { format, formatDate, startOfMonth, subDays } from "date-fns"
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import React from "react";
import { Separator } from "@/@/components/ui/separator";
import SalesDrill from "../../SalesDrill";
import RetailSalesPerformance from "../RetailSalesPerformance";
import { fetchChartData, fetchDistinctValues } from "../../api";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { Button } from "@/@/components/ui/button";
import { Calendar } from "lucide-react";
import GrowthStatCard from "../GrowthCard";
import SBUWiseProductLevel from "../SalesProductLevelCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";

interface ChartData {
  name: string;
  [key: string]: number | string;
}

type ChartMode = "month" | "year" | "ytd" | "date";

interface ActiveStates {
  H: boolean;
  A: boolean;
  T: boolean;
  C?: boolean
}

interface Filter {
  key: string;
  cond: string;
  value: string;
}

const categoryData = {
  H: { color: "#0998be", name: "Historical" },
  A: { color: "#f6c95e", name: "Actual" },
  T: { color: "#8f72da", name: "Target" },
};

interface FilterOption {
  key: string;
  cond: string;
  value: string;
}

interface FilterState {
  SBU_Name: string;
  Zone_Name: string;
  Region_Name: string;
  SalesArea_Name: string;
  ProductName: string;
}

const getDataKey = (
  key: string,
  mode: ChartMode,
  drillLevel: number
): string => {
  switch (key) {
    case "A":
      return "ACTUAL_TMT_SALES";
    case "H":
      return "ACTUAL_HISTORY_TMT_SALES";
    case "T":
      return "TARGET_TMT_SALES";
    default:
      return "";
  }
};

const getXAxisKey = (drillLevel: number): string => {
  const keys = [
    "month_name",
    "SBU_Name",
    "Zone_Name",
    "Region_Name",
    "SalesArea_Name",
    "ProductName",
  ];
  return keys[drillLevel] || "ProductName";
};

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
});

interface DrillStateIndicatorProps {
  drillLevel: number;
  drillHistory: string[];
}

export const DrillIndicator: React.FC<DrillStateIndicatorProps> = ({
  drillLevel,
  drillHistory,
}) => {
  const states = ["Month", "SBU", "Zone", "Region", "Sales Area", "Product"];

  return (
    <div className="space-y-2 text-xs px-8">
      <CustomStepper
        style={{ width: "650px" }}
        activeStep={drillLevel}
        alternativeLabel
      >
        {states.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </CustomStepper>
    </div>
  );
};

const transformChartData = (
  responseData: any,
  mode: ChartMode,
  drillLevel: number,
  activeStates: ActiveStates
): ChartData[] => {
  const isArray: boolean = Array.isArray(responseData);
  if (drillLevel === 0 && !isArray) {
    if (mode === "month" || mode === "ytd" || mode === "date") {
      return Object.keys(responseData.month_name).map((key) => {
        const data: ChartData = { name: responseData.month_name[key] };
        if (activeStates.A)
          data.ACTUAL_TMT_SALES = responseData.ACTUAL_TMT_SALES[key];
        if (activeStates.T)
          data.TARGET_TMT_SALES = responseData.TARGET_TMT_SALES
            ? responseData.TARGET_TMT_SALES[key]
            : undefined;
        if (activeStates.H)
          data.ACTUAL_HISTORY_TMT_SALES = responseData.ACTUAL_HISTORY_TMT_SALES
            ? responseData.ACTUAL_HISTORY_TMT_SALES[key]
            : undefined;
        return data;
      });
    } else {
      return Object.keys(responseData.FISCAL_YEAR).map((key) => {
        const data: ChartData = { name: responseData.FISCAL_YEAR[key] };
        if (activeStates.A)
          data.ACTUAL_TMT_SALES = responseData.ACTUAL_TMT_SALES[key];
        if (activeStates.T)
          data.TARGET_TMT_SALES = responseData.TARGET_TMT_SALES
            ? responseData.TARGET_TMT_SALES[key]
            : undefined;
        if (activeStates.H)
          data.ACTUAL_HISTORY_TMT_SALES = responseData.ACTUAL_HISTORY_TMT_SALES
            ? responseData.ACTUAL_HISTORY_TMT_SALES[key]
            : undefined;
        return data;
      });
    }
  } else if (drillLevel > 0 && !isArray) {
    if (mode === "month" || mode === "ytd" || mode === "date") {
      if (responseData.month_name) {
        return Object.keys(responseData.month_name).map((key) => {
          const data: ChartData = { name: responseData.month_name[key] };
          if (activeStates.A)
            data.ACTUAL_TMT_SALES = responseData.ACTUAL_TMT_SALES[key];
          if (activeStates.T)
            data.TARGET_TMT_SALES = responseData.TARGET_TMT_SALES
              ? responseData.TARGET_TMT_SALES[key]
              : "";
          if (activeStates.H)
            data.ACTUAL_HISTORY_TMT_SALES =
              responseData.ACTUAL_HISTORY_TMT_SALES
                ? responseData.ACTUAL_HISTORY_TMT_SALES[key]
                : "";
          return data;
        });
      } else {
        const xAxisKey = getXAxisKey(drillLevel);
        return Object.keys(responseData[xAxisKey]).map((key) => {
          const data: ChartData = { name: responseData[xAxisKey][key] };
          if (activeStates.A)
            data.ACTUAL_TMT_SALES = responseData.ACTUAL_TMT_SALES[key];
          if (activeStates.T)
            data.TARGET_TMT_SALES = responseData.TARGET_TMT_SALES
              ? responseData.TARGET_TMT_SALES[key]
              : "";
          if (activeStates.H)
            data.ACTUAL_HISTORY_TMT_SALES =
              responseData.ACTUAL_HISTORY_TMT_SALES
                ? responseData.ACTUAL_HISTORY_TMT_SALES[key]
                : "";
          return data;
        });
      }
    }
  } else {
    const xAxisKey = getXAxisKey(drillLevel);
    return responseData.map((item: any) => {
      const data: ChartData = { name: item[xAxisKey] || "" };
      if (activeStates.A) {
        if (item?.NETWEIGHT_TMT) {
          data.NETWEIGHT_TMT = item.NETWEIGHT_TMT;
        } else if (item?.ACTUAL_TMT_SALES) {
          data.ACTUAL_TMT_SALES = item.ACTUAL_TMT_SALES;
        }
      }
      if (activeStates.T) data.TARGET_QTY_TMT = item.TARGET_QTY_TMT;
      if (activeStates.H)
        data.ACTUAL_HISTORY_TMT_SALES = item.ACTUAL_HISTORY_TMT_SALES;
      return data;
    });
  }
};

const createFilters = (activeStates: ActiveStates): Filter[] => {
  return Object.entries(activeStates)
    .filter(([, isActive]) => isActive)
    .map(([stateKey]) => ({
      key: `"${stateKey}"`,
      cond: "equals",
      value: "true",
    }));
};

const AviationPerformance: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  // const [filters, setFilters] = useState<Filter[]>([
  // { key: '"A"', cond: "equals", value: "true" },
  // { key: '"H"', cond: "equals", value: "true" },
  // ]);
  const [filters, setFilters] = useState<FilterState>({
    SBU_Name: "",
    Zone_Name: "",
    Region_Name: "",
    SalesArea_Name: "",
    ProductName: "",
  });

  const [distinctFilters, setDistinctFilters] = useState<FilterState>({
    SBU_Name: "",
    Zone_Name: "",
    Region_Name: "",
    SalesArea_Name: "",
    ProductName: "",
  });
  const [activeStates, setActiveStates] = useState<ActiveStates>({
    A: true,
    H: true,
    T: true,
    C: true
  });
  let perspectiveFilters = convertToFilters(activeStates);
  let [appliedFilters, setAppliedFilters] =
    useState<FilterOption[]>(perspectiveFilters);
  // Order of filters for hierarchy
  const filterOrder = [
    "SBU_Name",
    "Zone_Name",
    "Region_Name",
    "SalesArea_Name",
    "ProductName",
  ];

  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<ChartMode>("month");

  const [drillHistory, setDrillHistory] = useState<string[]>(
    mode === "month" ? ["FY 2024-2025"] : []
  );
  const firstDayOfMonth = dayjs().date(1).month(3).subtract(1, "year");

  const [selectedYear, setSelectedYear] = useState("2025-2026");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedSBU, setSelectedSBU] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSalesArea, setSelectedSalesArea] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");


  const [isOpen, setIsOpen] = useState(false);
  const [crossFilters, setCrossFilters] = useState<Filter[]>([]);
  const [isSwitchOn, setIsSwitchOn] = useState(false);
  const [sbuArray, setSbuArray] = useState([]);
  const [currentSalesArray, setCurrentSalesArray] = useState([]);
  const [historicalSalesArray, setHistoricalSalesArray] = useState([]);
  const [dateFilterSbuArray, setDateFilterSbuArray] = useState([]);
  const [dateFilterCurrentSalesArray, setDateFilterCurrentSalesArray] =
    useState([]);
  const [dateFilterHistoricalSalesArray, setDateFilterHistoricalSalesArray] =
    useState([]);
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
  // Stores the list of SBU (Strategic Business Unit) names

  const [recentSales, setRecentSales] = useState([]);
  // Stores the current sales data

  const [pastSales, setPastSales] = useState([]);
  const [fycRecentSales, setFycRecentSales] = useState([]);
  // Stores the current sales data

  const [fycPastSales, setFycPastSales] = useState([]);


  const firstDayOfApril = dayjs().year(2024).month(3).startOf("month");

  // Get yesterday's date
  const yesterday = dayjs().subtract(1, "day");

  // State for date range
  const [fromDate, setFromDate] = useState(firstDayOfApril);
  const [toDate, setToDate] = useState(yesterday);
  const [selectedMonths, setSelectedMonths] = useState([]);

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
  ];

  const badgeVariants = [
    "secondary",
    "info",
    "success",
    "warning",
    "destructive",
    "info2",
  ] as const;

  // Function to remove duplicates keeping the latest entry for each key
  const removeDuplicateFilters = (data) => {
    // Create a map to store the latest filter for each key
    const filterMap = new Map();

    // Iterate through filters in reverse to keep the latest entries
    [...data].reverse().forEach((filter) => {
      if (!filterMap.has(filter.key)) {
        filterMap.set(filter.key, filter);
      }
    });

    // Convert map values back to array and reverse to maintain original order
    return Array.from(filterMap.values()).reverse();
  };

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
    ];
  }

  /**
   * Instead of trying to modify the existing applied filters array, we now build a new array from scratch each time
   * We iterate through the filter order and only add filters that should remain active
   * This ensures no duplicates can ever exist
   * @param key
   * @param {value} string
   */
  const distinctFilterChange = (key: keyof FilterState, value: string) => {
    const currentIndex = filterOrder.indexOf(key);

    // Create new filters object with all subsequent filters cleared
    const newFilters = { ...distinctFilters };
    filterOrder.forEach((filterKey, index) => {
      if (index === currentIndex) {
        newFilters[filterKey as keyof FilterState] = value;
      } else if (index > currentIndex) {
        newFilters[filterKey as keyof FilterState] = "";
      } else {
        newFilters[filterKey as keyof FilterState] =
          distinctFilters[filterKey as keyof FilterState];
      }
    });
    setDistinctFilters(newFilters);

    // Create new applied filters array
    let newAppliedFilters: FilterOption[] = [];

    // Keep only the filters that are before the current selection
    filterOrder.forEach((filterKey, index) => {
      if (index < currentIndex && newFilters[filterKey as keyof FilterState]) {
        newAppliedFilters.push({
          key: `${filterKey}`,
          cond: "=",
          value: newFilters[filterKey as keyof FilterState],
        });
      }
    });

    // Add the current selection if it has a value
    if (value) {
      newAppliedFilters.push({
        key: `${key}`,
        cond: "=",
        value: value,
      });
    }

    return newAppliedFilters;
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const currentIndex = filterOrder.indexOf(key);

    // Create new filters object with all subsequent filters cleared
    const newFilters = { ...filters };
    filterOrder.forEach((filterKey, index) => {
      if (index === currentIndex) {
        newFilters[filterKey as keyof FilterState] = value;
      } else if (index > currentIndex) {
        newFilters[filterKey as keyof FilterState] = "";
      } else {
        newFilters[filterKey as keyof FilterState] =
          filters[filterKey as keyof FilterState];
      }
    });
    setFilters(newFilters);

    // Create new applied filters array
    let newAppliedFilters: FilterOption[] = [];

    // Keep only the filters that are before the current selection
    filterOrder.forEach((filterKey, index) => {
      if (index < currentIndex && newFilters[filterKey as keyof FilterState]) {
        newAppliedFilters.push({
          key: `"${filterKey}"`,
          cond: "equals",
          value: newFilters[filterKey as keyof FilterState],
        });
      }
    });

    // Add the current selection if it has a value
    if (value) {
      newAppliedFilters.push({
        key: `"${key}"`,
        cond: "equals",
        value: value,
      });
    }
    setAppliedFilters(newAppliedFilters);
    return newAppliedFilters;
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const originalFilter = removeDuplicateFilters(appliedFilters);
      const originalCrossFilter = removeDuplicateFilters(crossFilters);
      // const orderedKeys = ['"FISCAL_YEAR"', '"month_name"'];
      // const reorderedData = reorderDataByKeys(originalFilter, orderedKeys);
      const response = await fetchChartData({
        filters: appliedFilters, // originalFilter, // !isDrillDown ? reorderedData : [], // Pass `filters` only if `isDrillDown` is true
        cross_filters: originalCrossFilter, // isDrillDown ? reorderedData : [], // Pass `cross_filters` if `isDrillDown` is false
        action:
          mode === "month" || mode === "ytd" || mode === "date"
            ? "m60_performance"
            : "yearly_sales_performance", // Determine `action` based on `mode`
        drill_state: "", // Pass drill_state as empty
      });
      if (response.status && response.data) {
        const transformedData = transformChartData(
          response.data?.data,
          mode,
          drillLevel,
          activeStates
        );
        setChartData(transformedData);
      } else {
        // setFilters([filters.pop()])
        setIsLoading(false);
        // setDrillLevel((prev) => prev - 1);
        // setDrillHistory([drillHistory.pop()]);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  }, [filters, drillLevel, mode, activeStates]);

  useEffect(() => {
    loadData();
  }, [drillLevel, appliedFilters, crossFilters]);

 
  
  useEffect(() => {
    RetailYTDmarketingTotal();
    ZoneWiseYTD()
    ZoneWiseYTPM();
    ZoneWiseYTPMMarketingTotal();
  }, [selectedYear]);

  useEffect(() => {
    ZoneWiseDateRange();
    ZoneWiseDateRangeSummary();
  }, [selectedYear]);

  const ZoneWiseYTD = async () => {
    setIsLoading(true);
    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },  
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: "Aviation" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },

    ];
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: '"SBU_Name"', // Pass drill_state as empty
        time_grain: "Yearly",
        resp_format: "summary"
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

  const ZoneWiseDateRange = async (fromDateOverride?: dayjs.Dayjs, toDateOverride?: dayjs.Dayjs) => {
    setIsLoading(true);
    const formatDate = (date) => {
      // console.log("data",date)
      return dayjs(date).format("YYYY-MM-DD");
    };
    const ytddate = formatDate(toDate);
    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: "Aviation" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
      { key: '"DATE"', cond: "equals", value: `${formatDate(fromDate)},${formatDate(toDate)}` },
    ];
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: '"SBU_Name"', // Pass drill_state as empty
        time_grain:"Yearly",
        resp_format: "summary"
      });
      if (response.status && response.data) {
        // Ensure we have valid data or use empty objects
        const zoneNames = response.data?.data.Zone_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

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

  const ZoneWiseDateRangeSummary = async (type?: string, fromDateOverride?: dayjs.Dayjs, toDateOverride?: dayjs.Dayjs) => {
    setIsLoading(true);
    const formatDate = (date) => {
      // console.log("data",date)
      return dayjs(date).format("YYYY-MM-DD");
    };
    const ytddate = formatDate(toDate);
    console.log("fromDAteFormated", ytddate);

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: "Aviation" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },

      { key: '"DATE"', cond: "equals", value: `${formatDate(fromDate)},${formatDate(toDate)}`,
      },
    ];
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
        time_grain: "Yearly"
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
      { key: '"SBU_Name"', cond: "equals", value: "Aviation"},
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },

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
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

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

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: "Aviation" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },

    ];

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: '"SBU_Name"',
        time_grain: "Yearly",
        resp_format: "summary"
      });

      if (response.status && response.data) {
        const zoneNames = response.data?.data.Zone_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

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
      { key: '"SBU_Name"', cond: "equals", value: "Aviation" } ,
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
     
    ];

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: '"SBU_Name"',
        time_grain: "Yearly"
      });

      if (response.status && response.data) {
        const zoneNames = response.data?.data.Zone_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

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
  
  const resetFilters = useCallback(async () => {
    const perspectiveKeys = ['"A"', '"H"', '"T"'];
    // Separate perspective and non-perspective filters
    const perspectiveFilters = appliedFilters.filter((filter) =>
      perspectiveKeys.includes(filter.key)
    );
    setDrillLevel(0);
    setMode("month");
    setAppliedFilters(perspectiveFilters);
    setCrossFilters([]);
    setSelectedYear("2025-2026");
    setSelectedMonth("");
    setSelectedSBU("");
    setSelectedZone("");
    setSelectedRegion("");
    setSelectedSalesArea("");
    setSelectedProductName("");
    setDrillHistory(mode === "month" ? ["FY 2024-2025"] : []);
    setSelectedMonths([]);
    setFromDate(firstDayOfApril);
    setToDate(yesterday);
    // await loadDistinctValues(["SBU_Name"], []);
  }, [mode, filters]);



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
    validateDateRange(newValue, toDate);
  };

  const handleToDateChange = (newValue) => {
    setToDate(newValue);
    validateDateRange(fromDate, newValue);
  };

  const handleDateFilter = () => {
    if (fromDate && toDate) {
      // Show warning if dates are outside FY, but still allow the filter
      const fy = getCurrentFinancialYear();
   
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      const perspectiveFilters = appliedFilters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      );
      setAppliedFilters(() => [
        ...perspectiveFilters,
        { key: '"DATE"', cond: "equals", value: formattedDates },
      ]);
      setMode("date");
      setDrillHistory([
        `${fromDate.format("MMM-DD")} - ${toDate.format("MMM-DD")}`,
      ]);      
    }
    validateDateRange(fromDate, toDate);
  
    // Close the popover after applying filter
    setIsOpen(false);
    ZoneWiseDateRange();
    ZoneWiseDateRangeSummary();
  
  };
  const resetDate = () => {
    // First set the state with new date values
    const resetFromDate = firstDayOfMonth
    const resetToDate = yesterday
  
    setFromDate(resetFromDate)
    setToDate(resetToDate)
  
    // Use these local variables directly in your function calls instead of
    // relying on the state values which haven't updated yet
    validateDateRange(resetFromDate, resetToDate)
  
    // Pass the explicit date values to your API calls
    ZoneWiseDateRangeSummary("reset", resetFromDate, resetToDate)
    ZoneWiseDateRange(resetFromDate, resetToDate)
  }
  const handleYearChange = (value) => {
    setSelectedYear(value);
    setAppliedFilters((prev) => [...prev, { key: '"fiscal_year"', cond: "equals", value: value}]);
    const [startYear, endYear] = value.split("-");
    if (startYear === "2024") {
      const fromdate = dayjs().date(1).month(3).subtract(1, 'year');
      const todate = dayjs().year(dayjs().year()).month(2).date(31);
      setFromDate(fromdate); setToDate(todate);
    } else {
      // Default: current FY based on today's date
      const fromdate = dayjs().date(1).month(3);
      const todate = dayjs().add(0, 'year').subtract(1, 'day');
      setFromDate(fromdate); setToDate(todate);
    }
  }
  const getDateRange = () => {
    const [startYear, endYear] = selectedYear.split("-")
    if (startYear === "2024") {
      
      const fromdate = dayjs().date(1).month(3).subtract(1, 'year');
      const todate = dayjs().year(dayjs().year()).month(2).date(31);
      return `${fromdate.format("DD-MMM-YYYY")} to ${todate.format("DD-MMM-YYYY")}`
    } else {
      // Default: current FY based on today's date
      const fromdate = dayjs().date(1).month(3);
      const todate = dayjs().add(0, 'year').subtract(1, 'day');
      return `${fromdate.format("DD-MMM-YYYY")} to ${todate.format("DD-MMM-YYYY")}`
    }
  }

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

  const CompactMarketingMetrics: React.FC<{ title: string; currentValue: number; historicalValue: number }> = ({
    title,
    currentValue,
    historicalValue,
  }) => {
    const calculatePercentage = (currentValue: number, historicalValue: number) => {
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
      <Card className="w-full max-w-3xl shadow rounded-md bg-white border border-[#EDF4F2] bg-gradient-to-br from-purple-300 via-blue-300 to-cyan-100">
        <CardContent className="px-1 py-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-black">{title}</div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-gray-500 uppercase">Curr</span>
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
    );
  };


  const handleSwitchChange = (checked) => {
    setIsSwitchOn(checked); // Update the state based on switch status
  };
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
            />
          </div>
          <div className="lg:col-start-3 lg:col-span-2  flex items-center justify-start">
            <span className="text-xl font-bold">AVIATION SBU MARKETING SUMMARY (TMT)</span>
          </div>
          <div className="flex items-end justify-end">
            {/* <h2 className="text-sm font-bold">{displayYear}</h2> */}
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-40 h-9 text-xs font-semibold border-[1.5px]">
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

          <span className="text-[12px] font-bold">Zone Wise YTD ({getDateRange()})</span>
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
              currentValue={Math.round(YtdPreviousCurrentSales.reduce((acc, val) => acc + val, 0))}
              historicalValue={Math.round(YtdPreviousHistoricSales.reduce((acc, val) => acc + val, 0))}
            />
          </div>
        </div>
        <span className="text-[12px] font-bold">Zone Wise YTPM ({dayjs().subtract(1, "year").month(3).format("MMM'YYYY")} - {dayjs().subtract(1, 'month').format("MMM'YYYY")})</span>
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
              currentValue={Math.round(recentSales.reduce((acc, val) => acc + val, 0))}
              historicalValue={Math.round(pastSales.reduce((acc, val) => acc + val, 0))}
            />
          </div>
          <div className="lg:col-start-3 lg:col-span-2 flex items-center justify-start"><span className="text-xl font-bold">SALES FOR DATE RANGE (TMT)</span></div>
          
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
                        minDate={fromDate}
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
        Zone Wise Date Range ({fromDate.format("DD-MMM-YYYY")} to {toDate.format("DD-MMM-YYYY")})
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
        
        <Separator className="my-2 my-4 h-[3px] bg-cyan-700" />
        <SBUWiseProductLevel sbu="Aviation" />
        <div className="mt-1 mb-2">
          <RetailSalesPerformance sbu="Aviation" />
        </div>
      </Card>
    </>
  );
};

export default AviationPerformance;
