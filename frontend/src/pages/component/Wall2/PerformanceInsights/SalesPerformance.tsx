import { useState, useCallback, useEffect } from "react";
import { Card } from "@/@/components/ui/card";
import { toast } from "sonner";
import { Stepper, Step, StepLabel } from "@mui/material";
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
import { fetchChartData, fetchDistinctValues } from "../api";
import { format, formatDate, startOfMonth, subDays } from "date-fns";
import RetailSalesPerformance from "./RetailSalesPerformance";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import React from "react";
import SalesDrill from "../SalesDrill";
import { Separator } from "@/@/components/ui/separator"


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

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-bold text-gray-800 mb-2 text-xs">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            className="text-xs flex justify-between items-center gap-4"
            style={{ color: entry.color }}
          >
            <span>{entry.name}:</span>
            <span className="font-semibold">
              {entry.value?.toLocaleString()} TMT
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomXAxisTick: React.FC<any> = ({ x, y, payload }) => {
  const words = payload.value.split(" ");
  const lineHeight = 15;
  // Calculate total height of the text
  const totalHeight = words.length * lineHeight;
  // Calculate maximum width of the text to determine underline width
  const getTextWidth = (text: string, fontSize: number) => {
    const averageCharWidth = fontSize * 0.6; // Approximate width per character
    return text.length * averageCharWidth;
  };
  const maxWidth = Math.max(
    ...words.map((word) => getTextWidth(word, words.length > 9 ? 10 : 12))
  );

  return (
    <g transform={`translate(${x},${y})`}>
      {words.map((word: string, index: number) => (
        <g key={index}>
          {/* Text element */}
          <text
            x={0}
            y={index * lineHeight}
            dy={16}
            fill="#1b82f7"
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
  );
};

const SalesPerformanceInsights: React.FC = () => {
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

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedSBU, setSelectedSBU] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSalesArea, setSelectedSalesArea] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");

  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [sbuOptions, setSbuOptions] = useState<string[]>([]);
  const [zoneOptions, setZoneOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [salesAreaOptions, setSalesAreaOptions] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [isDrillDown, setIsDrillDown] = useState(null);
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
  const [currentFycSalesState, setCurrentFycSalesState] = useState([]);
  const [historicalFycSalesState, setHistoricalFycSalesState] = useState([]);

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

  const loadDistinctValues = useCallback(
    async (column: string[], whereCond: any = []) => {
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
      ];
      try {
        const response = await fetchDistinctValues({
          connection_id: "1",
          schema: "public",
          table: "MOM_DAY_LEVEL_DATA",
          column: column,
          
          where_cond: whereCond,
        });
        if (response.status && response.data) {
          return response.data;
        }
      } catch (error) {
        console.error(`Error fetching distinct values for ${column}:`, error);
      }
      return [];
    },
    []
  );
  useEffect(() => {
    YTDBox();
    // DateBox();
    YTDDatewiseBox();
    FYCBox();
    Summarydata();
    FYCSummarydata();
    Summarydatayear();
    YTDmonthsales();
    YTDpreviousmonth();

    const initializeFilters = async () => {
      const years = await loadDistinctValues(
        mode === "year" ? ["FISCAL_YEAR"] : ["month_name"]
      );
      if (mode === "year") {
        setYearOptions(years);
      }
      const sbus = await loadDistinctValues(["SBU_Name"]);
      const updatedData = sbus["SBU_Name"].map((item) =>
        item === "PETROCHEMICALS SBU" ? "PetChem" : item
      );
      setSbuOptions(updatedData);
      // setSbuOptions(sbus);
      const alldropdownOption = await loadDistinctValues([
        "Zone_Name",
        "Region_Name",
        "SalesArea_Name",
        "ProductName",
      ]);
      setZoneOptions(alldropdownOption?.["Zone_Name"]);
      setRegionOptions(alldropdownOption?.["Region_Name"]);
      setSalesAreaOptions(alldropdownOption?.["SalesArea_Name"]);
      setProductOptions(alldropdownOption?.["ProductName"]);
    };
    initializeFilters();
  }, [mode, loadDistinctValues, fromDate, toDate]);

  const YTDBox = async () => {
    setIsLoading(true);
    const filter = [
      // { key: '"A"', cond: "equals", value: "true" },
      // { key: '"H"', cond: "equals", value: "true" },
      // { key: '"YTD"', cond: "equals", value: "true" },
    ];
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
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
        setSbuArray(Object.values(sbuNames));
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

  const YTDDatewiseBox = async () => {
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
      // { key: '"YTD"', cond: "equals", value: "true" },
      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDate)},${formatDate(toDate)}`,
      },
    ];
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
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
        setSbuArrayState(Object.values(sbuNames));
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
  const FYCBox = async () => {
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
      { key: '"FYC"', cond: "equals", value: "true" },
      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDate)},${formatDate(toDate)}`,
      },
    ];
    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
        action: "m60_performance",
        drill_state: "", // Pass drill_state as empty
      });
      if (response.status && response.data) {
        // Ensure we have valid data or use empty objects
        // const sbuNames = response.data?.data.SBU_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        // Convert to arrays, handling potential undefined values
        // setSbuArrayState(Object.values(sbuNames));
        setCurrentFycSalesState(Object.values(currentSales));
        setHistoricalFycSalesState(Object.values(historicalSales));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
  };

  const Summarydata = async () => {
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
      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDate)},${formatDate(toDate)}`,
      },
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
  const FYCSummarydata = async () => {
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
      { key: '"FYC"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDate)},${formatDate(toDate)}`,
      },
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
        setSbuList(Object.values(sbuNames));
        setFycRecentSales(Object.values(currentSales));
        setFycPastSales(Object.values(historicalSales));
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
  };
  const Summarydatayear = async () => {
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
      // { key: '"DATE"',
      // cond: "equals",
      // value: `${formatDate(fromDate)},${formatDate(toDate)}`}
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

  // const DateBox = async () => {
  //   setIsLoading(true);

  //   const today = new Date();
  //   const firstDayOfMonth = startOfMonth(today);
  //   const yesterday = subDays(today, 1);

  //   const dateRangeStart = format(firstDayOfMonth, "yyyy-MM-dd");
  //   const dateRangeEnd = format(yesterday, "yyyy-MM-dd");

  //   const filter = [
  //     { key: '"A"', cond: "equals", value: "true" },
  //     { key: '"H"', cond: "equals", value: "true" },
  //     { key: '"YTD"', cond: "equals", value: "true" },
  //     {
  //       key: '"DATE"',
  //       cond: "equals",
  //       value: `${dateRangeStart},${dateRangeEnd}`,
  //     },
  //   ];

  //   try {
  //     const response = await fetchChartData({
  //       filters: filter,
  //       cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
  //       action: "m60_performance",
  //       drill_state: "",
  //     });

  //     if (response.status && response.data) {
  //       const sbuNames = response.data?.data.SBU_Name || {};
  //       const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
  //       const historicalSales =
  //         response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

  //       setDateFilterSbuArray(Object.values(sbuNames));
  //       setDateFilterCurrentSalesArray(Object.values(currentSales));
  //       setDateFilterHistoricalSalesArray(Object.values(historicalSales));
  //       setIsLoading(false);
  //     } else {
  //       setIsLoading(false);
  //     }
  //   } catch (error) {
  //     setIsLoading(false);
  //     console.error("Error fetching data:", error);
  //   }
  // };

  const YTDmonthsales = async () => {
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
      // { key: '"DATE"', cond: "equals", value: `${dateRangeStart},${dateRangeEnd}` },
    ];

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
        action: "m60_performance",
        drill_state: "",
      });

      if (response.status && response.data) {
        const sbuNames = response.data?.data.SBU_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        setYtdsbuname(Object.values(sbuNames));
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

  const YTDpreviousmonth = async () => {
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
      { key: '"C"', cond: "equals", value: "true" },
      // { key: '"DATE"', cond: "equals", value: `${dateRangeStart},${dateRangeEnd}` },
    ];

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "",
      });

      if (response.status && response.data) {
        const sbuNames = response.data?.data.SBU_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        setYtdSbuNameprevious(Object.values(sbuNames));
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
    setSelectedYear("");
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
      if (fromDate.isBefore(fy.start) || toDate.isAfter(fy.end)) {
        toast.warning(
          "Note: Selected date range extends beyond the current financial year"
        );
        return false;
      }
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
  };

  const resetDate = () => {
    setFromDate(firstDayOfApril);
    setToDate(yesterday);
  };

  const fy = getCurrentFinancialYear();

  const handleXaxisClick = (entry: any) => {
    console.log("handleXaxisClick", entry);
  };

  const isContainMonth = () => {
    return drillHistory.some((item) => monthOptions.includes(item));
  };

  const handleReset = () => {
    setFromDate(null);
    setToDate(null);
  };

  const formatDisplayDate = (date) => {
    return date ? dayjs(date).format("DD/MM/YYYY") : "";
  };

  const GrowthStatCard = ({
    title,
    currentValue,
    historicalValue,
    bgColor = "bg-emerald-50",
  }) => {
    const calculatePercentage = (currentValue, historicalValue) => {
      if (historicalValue === 0) {
        return currentValue !== 0 ? 100 : 0; // If historical is 0, return 100% if current exists, 0% if both are 0
      }
      return Number(
        (((currentValue - historicalValue) / historicalValue) * 100).toFixed(2)
      );
    };

    const percentageNum = calculatePercentage(currentValue, historicalValue);

    const getStyles = (value) => {
      if (value > 0) {
        return {
          background:
            "bg-gradient-to-br from-green-400/10 via-emerald-400/10 to-teal-400/10",
          glow: "before:bg-emerald-500/20",
          text: "text-emerald-500",
          gradientText: "bg-gradient-to-r from-emerald-500 to-green-600",
          border: "border-emerald-200/30",
          highlight: "group-hover:text-emerald-500",
          icon: "bg-emerald-500",
        };
      } else {
        return {
          background:
            "bg-gradient-to-br from-red-400/10 via-rose-400/10 to-pink-400/10",
          glow: "before:bg-red-500/20",
          text: "text-red-500",
          gradientText: "bg-gradient-to-r from-red-500 to-rose-600",
          border: "border-red-200/30",
          highlight: "group-hover:text-red-500",
          icon: "bg-red-500",
        };
      }
    };

    const styles = getStyles(percentageNum);

    return (
      <div
        className={`group relative rounded-2xl ${styles.background} border ${styles.border} backdrop-blur-xl transition-all duration-300 hover:scale-[1.02]`}
      >
        {/* Card Content */}
        <div className="relative p-1.5 space-y-2">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                {title}
              </h3>
            </div>

            {/* Percentage Badge */}
            <div
              className={`px-1 py-0 flex rounded-xl ${styles.background} border ${styles.border}`}
            >
              <span className={`text-[10px] font-bold ${styles.text}`}>
                {percentageNum > 0 ? "+" : ""}
                {percentageNum}%
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div
            className="grid grid-cols-2 gap-4 mt-auto"
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <div className="space-y-0">
              <p className="text-[11px] xs:text-xs sm:text-sm md:text-base text-gray-500 font-medium">
                Curr
              </p>
              <p className="text-[11px] xs:text-xs sm:text-sm md:text-base font-bold text-gray-700">
                {Number(currentValue).toLocaleString()}
              </p>
            </div>
            <div className="space-y-0">
              <p className="text-[11px] xs:text-xs sm:text-sm md:text-base text-gray-500 font-medium m-0">
                Hist
              </p>
              <p className="text-[11px] xs:text-xs sm:text-sm md:text-base font-bold text-gray-700 m-0">
                {Number(historicalValue).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
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
          <div className="lg:col-span-2 md:col-start-1">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className="flex flex-col md:flex-row lg:flex-row xl:flex-row content-center gap-3">
                <DatePicker
                  label="From"
                  value={fromDate}
                  className="w-40"
                  format="DD/MM/YYYY"
                  views={["year", "month", "day"]}
                  minDate={dayjs().date(1).month(3).subtract(2, "year")}
                  maxDate={dayjs()}
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
            </LocalizationProvider>
          </div>

          {/* <div className="grid grid-cols-1 md:grid-cols-3 md:col-span-2 gap-3"> */}
            <div className="lg:col-start-4">
              <GrowthStatCard
                title="Date Range"
                currentValue={recentSales}
                historicalValue={pastSales}
              />
            </div>
            <div className="lg:col-start-5">
              <GrowthStatCard
                title="FYC"
                currentValue={fycRecentSales}
                historicalValue={fycPastSales}
              />
            </div>
          </div>
        {/* </div> */}
        <span className="text-[12px] font-bold">SBU Wise DateRange</span>
        {/* <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 p-0"> */}
        <div
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
        </div>

        <span className="text-[12px] font-bold">
          SBU Wise FYC
        </span>
        {/* <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 p-0"> */}
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
        </div>
        <Separator className="my-2 mt-4 h-[3px]" />

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
          <div className="md:col-start-3 lg:col-start-4">
            <GrowthStatCard
              title="YTD"
              currentValue={ytcurrentData}
              historicalValue={ytdHistoricalData}
            />
          </div>
          <div className="md:col-start-4 lg:col-start-5">
            <GrowthStatCard
              title="YTPM"
              currentValue={YtdPreviousCurrentSales}
              historicalValue={YtdPreviousHistoricSales}
            />
          </div>
        </div>

        <span className="text-[12px] font-bold">
          SBU Wise YTD (Apr 01 - {dayjs().subtract(1, "day").format("MMM-DD")} )
        </span>
        {/* <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 p-0"> */}
        <div
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
        </div>

        <span className="text-[12px] font-bold">SBU Wise YTPM</span>
        {/* <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 p-0"> */}
        <div
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
        </div>
        <div className="mt-1 mb-2">
          <Tabs defaultValue="tab1" className="w-full">
            <TabsList className="grid w-full grid-cols-8 ">
              <TabsTrigger value="tab1" className="text-[0.9789rem]">
                Marketing Summary
              </TabsTrigger>
              <TabsTrigger value="tab2">Retail</TabsTrigger>
              <TabsTrigger value="tab3">LPG</TabsTrigger>
              <TabsTrigger value="tab4">I&C</TabsTrigger>
              <TabsTrigger value="tab5">Lubes</TabsTrigger>
              <TabsTrigger value="tab6">Aviation</TabsTrigger>
              <TabsTrigger value="tab7">Petchem</TabsTrigger>
              <TabsTrigger value="tab8">Gas</TabsTrigger>

              {/* <TabsTrigger value="tab1">SALES PERFORMANCE DRILLDOWN</TabsTrigger>
 <TabsTrigger value="tab2">SALES PERFORMANCE SELECTION WISE</TabsTrigger>
 <TabsTrigger value="tab3">SALES PERFORMANCE DATE WISE</TabsTrigger>
 <TabsTrigger value="tab4">SALES PERFORMANCE MONTH WISE</TabsTrigger> */}
            </TabsList>
            <TabsContent value="tab1">
              <SalesDrill />
              {/* Chart Content */}
            </TabsContent>

            {/* Other Tabs */}
            <TabsContent value="tab2">
              <RetailSalesPerformance sbu="Retail" />
            </TabsContent>

            <TabsContent value="tab3">
              <RetailSalesPerformance sbu="LPG" />
            </TabsContent>
            <TabsContent value="tab4">
              <RetailSalesPerformance sbu="I&C" />
            </TabsContent>
            <TabsContent value="tab5">
              <RetailSalesPerformance sbu="Lubes" />
            </TabsContent>
            <TabsContent value="tab6">
              <RetailSalesPerformance sbu="Aviation" />
            </TabsContent>
            <TabsContent value="tab7">
              <RetailSalesPerformance sbu="PETCHEM" />
            </TabsContent>
            <TabsContent value="tab8">
              <RetailSalesPerformance sbu="GAS" />
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </>
  );
};

export default SalesPerformanceInsights;
