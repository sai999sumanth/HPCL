import React, { useState, useCallback, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  Brush,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { IconArrowLeft, IconRestore } from "@tabler/icons-react";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { Toaster, toast } from "sonner";
import { fetchChartData, fetchDistinctValues } from "./api";
import { Stepper, Step, StepLabel } from "@mui/material";
import { Badge } from "@/@/components/ui/badge";
import { styled } from "@mui/material/styles";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/@/components/ui/breadcrumb";
import { useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Alert } from "@/@/components/ui/alert";
import ApiLoader from "@/services/apiLoader";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { Calendar, TrendingDown, TrendingUp, X } from "lucide-react";
import { Switch } from "@/@/components/ui/switch";
import { Label } from "@/@/components/ui/label";
import { data } from "@/pages/custom-dashboard/charts/data";
import { Separator } from "@/@/components/ui/separator";
import TablePerformancesales from "./TablePerformancesales";
import { CustomMultiSelect } from "../../../@/components/ui/custom-multiselect";
import { SalesDropdowns } from "./SalesDropdowns";
import convertToFilters from "@/utils/dynamicFilter";

interface ChartData {
  name: string;
  [key: string]: number | string;
}

type ChartMode = "month" | "year" | "ytd" | "date";

interface ActiveStates {
  H: boolean;
  A: boolean;
  T: boolean;
}

interface Filter {
  key: string;
  cond: string;
  value: string;
}

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

const categoryData = {
  H: { color: "#a3bf02", name: "Historical" },
  A: { color: "#00a495", name: "Actual" },
  T: { color: "#dea600", name: "Target" },
};

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
    <div className="space-y-2 px-8">
      <CustomStepper activeStep={drillLevel} alternativeLabel>
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
  let isArray: boolean = Array.isArray(responseData);
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
        <p className="font-bold text-gray-800 mb-2 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            className="text-sm flex justify-between items-center gap-4"
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

const renderCustomizedLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  const radius = 10;

  return (
    <g>
      <text
        className="text-[0.52rem]"
        x={x + width / 2}
        y={y - radius}
        fill="#333"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {value}
      </text>
    </g>
  );
};

const SalesAHTYTD: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  // const [filters, setFilters] = useState<Filter[]>([
  //   { key: '"A"', cond: "equals", value: "true" },
  //   { key: '"H"', cond: "equals", value: "true" },

  // ]);
  const [filters, setFilters] = useState<FilterState>({
      SBU_Name: '',
      Zone_Name: '',
      Region_Name: '',
      SalesArea_Name: '',
      ProductName: '',
    });
  
    const [distinctFilters, setDistinctFilters] = useState<FilterState>({
      SBU_Name: '',
      Zone_Name: '',
      Region_Name: '',
      SalesArea_Name: '',
      ProductName: '',
    });
    const [activeStates, setActiveStates] = useState<ActiveStates>({
      A: true,
      H: true,
      T: false,
    });
    let perspectiveFilters = convertToFilters(activeStates);
    let [appliedFilters, setAppliedFilters] = useState<FilterOption[]>(perspectiveFilters);
    const filterOrder = ['SBU_Name', 'Zone_Name', 'Region_Name', 'SalesArea_Name', 'ProductName'];
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<ChartMode>("month");
  // const [activeStates, setActiveStates] = useState<ActiveStates>({
  //   A: true,
  //   H: true,
  //   T: false,
  // });

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
  let [distinctFilter, setDistinctFilter] = useState<any[]>([]);
  const [isSwitchOn, setIsSwitchOn] = useState(false);
  const [sbuArray, setSbuArray] = useState([]);
  const [currentSalesArray, setCurrentSalesArray] = useState([]);
  const [historicalSalesArray, setHistoricalSalesArray] = useState([]);

  // Get first day of current month
  const firstDayOfMonth = dayjs().startOf("month");

  // Get yesterday's date
  const yesterday = dayjs().subtract(1, "day");

  // State for date range
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(yesterday);
  const [selectedMonths, setSelectedMonths] = useState([]);

  console.log("crossFilters", selectedMonths);

  // Initialize the base filter array
  let distinctDynamicFilter: Array<{
    key: string;
    cond: string;
    value: string;
  }> = [
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
    { id: "Mar", name: "March", icon: undefined }
  ];


  const badgeVariants = [
    "secondary",
    "info",
    "success",
    "warning",
    "destructive",
    "info2",
  ] as const;
  const addDynamicFilter = (column: string, value: string) => {
    setDistinctFilter((prevFilters) => { 
      // Remove old filter and add new one
      const updatedFilters = prevFilters.filter(
        (filter) => filter.key !== column
      );
      updatedFilters.push({ key: column, cond: "=", value });
      return updatedFilters;
    });
  };

  const stats = [
    {
      title: "Retail",
      percentage: "4.1",
      currentValue: "20627",
      historicalValue: "19807",
      bgColor: "bg-emerald-50",
    },
    {
      title: "LPG",
      percentage: "-6.6",
      currentValue: "6084",
      historicalValue: "5710",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Aviation",
      percentage: "25.3",
      currentValue: "726",
      historicalValue: "579",
      bgColor: "bg-emerald-50",
    },
    {
      title: "I&C",
      percentage: "45.3",
      currentValue: "656",
      historicalValue: "243",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Lubes",
      percentage: "-17.3",
      currentValue: "456",
      historicalValue: "529",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Petchem",
      percentage: "22.3",
      currentValue: "626",
      historicalValue: "379",
      bgColor: "bg-emerald-50",
    },
  ];

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

  const distinctFilterChange = (key: keyof FilterState, value: string) => {

    const currentIndex = filterOrder.indexOf(key);
    
    // Create new filters object with all subsequent filters cleared
    const newFilters = { ...distinctFilters };
    filterOrder.forEach((filterKey, index) => {
      if (index === currentIndex) {
        newFilters[filterKey as keyof FilterState] = value;
      } else if (index > currentIndex) {
        newFilters[filterKey as keyof FilterState] = '';
      } else {
        newFilters[filterKey as keyof FilterState] = distinctFilters[filterKey as keyof FilterState];
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
          value: newFilters[filterKey as keyof FilterState]
        });
      }
    });

    // Add the current selection if it has a value
    if (value) {
      newAppliedFilters.push({
        key: `${key}`,
        cond: "=",
        value: value
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
        newFilters[filterKey as keyof FilterState] = '';
      } else {
        newFilters[filterKey as keyof FilterState] = filters[filterKey as keyof FilterState];
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
          value: newFilters[filterKey as keyof FilterState]
        });
      }
    });

    // Add the current selection if it has a value
    if (value) {
      newAppliedFilters.push({
        key: `"${key}"`,
        cond: "equals",
        value: value
      });
    }
    setAppliedFilters(newAppliedFilters);
    return newAppliedFilters;

    
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    console.log("calling this load data");
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
  }, [loadData]);

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
      const zones = await loadDistinctValues(["Zone_Name"]);
      setZoneOptions(zones["Zone_Name"]);
      const regions = await loadDistinctValues(["Region_Name"]);
      setRegionOptions(regions["Region_Name"]);
      const salesAreas = await loadDistinctValues(["SalesArea_Name"]);
      setSalesAreaOptions(salesAreas["SalesArea_Name"]);
      const productNames = await loadDistinctValues(["ProductName"]);
      setProductOptions(productNames["ProductName"]);
    };
    initializeFilters();
  }, [mode, loadDistinctValues]);

  const YTDBox = async () => {
    setIsLoading(true);
    let filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
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
        const sbuNames = response.data.SBU_Name || {};
        const currentSales = response.data.ACTUAL_TMT_SALES || {};
        const historicalSales = response.data.ACTUAL_HISTORY_TMT_SALES || {};

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

  const toggleButtonState = (key: keyof ActiveStates) => {
    setActiveStates((prevStates) => {
      const updatedStates = { ...prevStates };
      if (key === "T" && !prevStates.A) {
        toast.error("Target can only be selected if Actual is selected", {
          position: "top-right",
        });
        return prevStates;
      }
      if (key === "A" && !updatedStates[key] && updatedStates.T) {
        updatedStates.T = false;
      }
      updatedStates[key] = !updatedStates[key];
      if (!updatedStates["A"] && !updatedStates["H"] && !updatedStates["T"]) {
        toast.info("At least one option must be selected.");
        return prevStates;
      }
      setAppliedFilters((prevFilters) => {
        const newFilters = prevFilters.filter(
          (filter) => !["A", "H", "T"].includes(filter.key.replace(/"/g, ""))
        );
        const updatedFilters = createFilters(updatedStates);
        return [...newFilters, ...updatedFilters];
      });
      return updatedStates;
    });
  };

  let newFilters = [];
  let newCrossFilters = [];
  let ytd = [];
  const handleBarClick = useCallback(
    (entry: any) => {
      setIsDrillDown(true);
      if (drillLevel >= 5) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      }

      newFilters = [...appliedFilters];
      const filterKeys = [
        "month_name",
        "SBU_Name",
        "Zone_Name",
        "Region_Name",
        "SalesArea_Name",
      ];

      // if (drillLevel === 0 && (mode === "month" || mode === 'ytd')) {
      // newFilters = [
      // { key: '"FISCAL_YEAR"', cond: "equals", value: "FY 2024-2025" },
      // // { key: '"month_name"', cond: "equals", value: entry.name },
      // ];
      // } else {
      newCrossFilters = [...crossFilters];
      newCrossFilters.push({
        key: `"${filterKeys[drillLevel]}"`,
        cond: "equals",
        value: entry.name,
      });
      if (mode === "ytd") {
        ytd = [{ key: '"YTD"', cond: "equals", value: "true" }];
      }

      // Preserve perspective filters
      const perspectiveFilters = appliedFilters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      );
      newFilters = [...newFilters, ...perspectiveFilters, ...ytd];
      let removeDups = [...new Set(newFilters)];
      let stringLubes = ["Lubes"];
      if (entry.name.includes(stringLubes)) {
        console.log(true);
        setAppliedFilters(removeDups);
        setCrossFilters(newCrossFilters);
        setDrillLevel((prev) => prev + 2);
        setDrillHistory([...drillHistory, entry.name]);
        return;
      }
      setAppliedFilters(removeDups);
      setCrossFilters(newCrossFilters);
      setDrillLevel((prev) => prev + 1);
      setDrillHistory([...drillHistory, entry.name]);
    },
    [drillLevel, filters, drillHistory, mode]
  );

  const handleBackClick1 = useCallback(() => {
    console.log("newFilters", filters);
    if (drillLevel > 0) {
      //
      const perspectiveFilters = ["A", "H", "T", "BE", "RI"];
      const newFilterss = appliedFilters.filter((filter) => {
        const key = filter.key.replace(/"/g, "");
        return (
          perspectiveFilters.includes(key) ||
          (drillLevel === 1 && key === "FISCAL_YEAR")
        );
      });
      console.log(newFilterss);
      setAppliedFilters(newFilterss);
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
    }
  }, [drillLevel, filters, drillHistory]);

  const handleBackClick = useCallback(() => {
    setIsDrillDown(true);
    if (drillLevel > 0) {
      // Perspective keys to retain
      const perspectiveKeys = ['"A"', '"H"', '"T"'];

      // Separate perspective and non-perspective filters
      const perspectiveFilters = appliedFilters.filter((filter) =>
        perspectiveKeys.includes(filter.key)
      );
      const nonPerspectiveFilters = appliedFilters.filter(
        (filter) => !perspectiveKeys.includes(filter.key)
      );

      // Remove the last non-perspective filter
      const updatedNonPerspectiveFilters = nonPerspectiveFilters.slice(0, -1);

      // Combine updated filters
      const updatedFilters = [
        ...perspectiveFilters,
        ...updatedNonPerspectiveFilters,
      ];
      let stringLubes = "Lubes";
      if (mode === "month" && drillLevel === 1) {
        setDrillLevel(0);
        setAppliedFilters(perspectiveFilters);
        setDrillHistory([]);
        setCrossFilters([]);
      } else if (crossFilters?.[1]?.value.includes(stringLubes)) {
        setAppliedFilters(updatedFilters);
        setCrossFilters(crossFilters.slice(0, -1));
        setDrillLevel(drillLevel - 2);
        setDrillHistory(drillHistory.slice(0, -1));
      } else {
        // Update states
        setAppliedFilters(updatedFilters);
        setCrossFilters(crossFilters.slice(0, -1));
        setDrillLevel(drillLevel - 1);
        setDrillHistory(drillHistory.slice(0, -1));
      }
    }
  }, [drillLevel, filters, drillHistory, mode]);

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
    // await loadDistinctValues(["SBU_Name"], []);
  }, [mode, filters]);

  const handleModeChange = useCallback(
    (newMode) => {
      // If trying to deselect month while no other mode is selected, keep month selected
      if (newMode === "month" && mode === "month" && !appliedFilters.length) {
        return;
      }

      // If deselecting current mode, switch to month
      if (newMode === mode) {
        setMode("month");
        setDrillHistory(["FY 2024-2025"]);
        resetFilters();
        return;
      }

      // Handle normal mode changes
      setMode(newMode);

      if (newMode === "year") {
        setDrillHistory([]);
        resetFilters();
      } else if (newMode === "month") {
        setDrillHistory(["FY 2024-2025"]);
        resetFilters();
      } else if (newMode === "ytd") {
        resetFilters();
        setDrillHistory([`Apr 01 - ${dayjs().format("MMM DD")}`]);
        setAppliedFilters((prev) => [
          ...prev,
          { key: '"YTD"', cond: "equals", value: "true" },
        ]);
        setMode("ytd");
      }
      // else if(newMode === 'date') {
      // setDrillHistory([`${fromDate.format('MMM-DD')} - ${toDate.format('MMM-DD')}`])
      // }
      else {
        setDrillHistory(["FY 2024-2025"]);
      }
    },
    [mode, filters, resetFilters]
  );

  // const handleMonthSelect = (monthValue) => {
  // // Add or update month filter
  // const monthFilter = {
  // key: '"month_name"',
  // cond: "equals",
  // value: monthValue,
  // };
  // setFilters((prev) => {
  // const monthFilterIndex = prev.findIndex((f) => f.key === '"Month"');
  // if (monthFilterIndex >= 0) {
  // const newFilters = [...prev];
  // newFilters[monthFilterIndex] = monthFilter;
  // return newFilters;
  // }
  // return [...prev, monthFilter];
  // });
  // };

  const handleMonthSelect = (monthValues) => {

    const monthValuesString = monthValues.join(',');

    const monthFilter = {
      key: '"month_name"',
      cond: "equals",
      value: monthValuesString,
    };

    setAppliedFilters((prev) => {
      const monthFilterIndex = prev.findIndex((f) => f.key === '"Month"');
      if (monthFilterIndex >= 0) {
        const newFilters = [...prev];
        newFilters[monthFilterIndex] = monthFilter;
        return newFilters;
      }
      return [...prev, monthFilter];
    });
  };
  const handleYearChange = (value: string) => {
    if (value === "_empty") {
      resetFilters();
      return;
    }
    setSelectedYear(value);
    setAppliedFilters([
      ...appliedFilters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      ),
      { key: '"FISCAL_YEAR"', cond: "equals", value },
    ]);
    // setDrillLevel(1);
    // setDrillHistory([value]);
    loadDistinctValues(["SBU_Name"], { FISCAL_YEAR: value }).then(setSbuOptions);
  };

  const handleMonthChange = async (event: any) => {
    const value = event.target.value;
    if (value === "_empty") {
      resetFilters();
      return;
    }
    setSelectedMonth(value);
    setAppliedFilters([
      ...appliedFilters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      ),
      { key: '"FISCAL_YEAR"', cond: "equals", value: "FY 2024-2025" },
      { key: '"month_name"', cond: "equals", value },
    ]);
    // setDrillLevel(1);
    // setDrillHistory(["FY 2024-2025", value]);
    const sbus = await loadDistinctValues(["SBU_Name"], {
      FISCAL_YEAR: "FY 2024-2025",
      month_name: value,
    });
    setSbuOptions(sbus);
  };
  const removeOldValues = (data) => {
    const uniqueFilters = data.reduce((acc, current) => {
      acc[current.key] = current; // Overwrite any existing key with the latest value
      return acc;
    }, {});

    return Object.values(uniqueFilters);
  };

  const handleSBUChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("SBU_Name", value);
    const distinctValues = distinctFilterChange("SBU_Name", value);

    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([
        ...perspectiveFilters,
        {
          key: '"SBU_Name"',
          cond: "equals",
          value: "",
        },
      ]);
      setSelectedSBU("");
      return;
    }
    setSelectedSBU(value);
    setCrossFilters([]);
    // Set only SBU filter
    let perspectiveFilters = convertToFilters(activeStates);
    setAppliedFilters([...perspectiveFilters, ...defaultFilter]);
    try {
      const response = await loadDistinctValues(
        ["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"],
        distinctValues
      );
      if (response) {
        setZoneOptions(response["Zone_Name"]);
        setRegionOptions(response["Region_Name"]);
        setSalesAreaOptions(response["SalesArea_Name"]);
        setProductOptions(response["ProductName"]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleZoneChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("Zone_Name", value);
    const distinctValues = distinctFilterChange("Zone_Name", value);
    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([...perspectiveFilters]);
      setSelectedSBU("");
      return;
    }
    setSelectedZone(value);
    setCrossFilters([]);
    // Set SBU and Zone filters
    let perspectiveFilters = convertToFilters(activeStates);
    setAppliedFilters([...perspectiveFilters, ...defaultFilter]);
    try {
      const response: any = await loadDistinctValues(
        ["SBU_Name", "Region_Name", "SalesArea_Name", "ProductName"],
        distinctValues
      );
      if (response) {
        setSbuOptions(response["SBU_Name"]);
        setRegionOptions(response["Region_Name"]);
        setSalesAreaOptions(response["SalesArea_Name"]);
        setProductOptions(response["ProductName"]);
      }
    } catch (error) {
      console.log(error);
    }
    // setRegionOptions(regions);
  };

  const handleRegionChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("Region_Name", value);
    const distinctValues = distinctFilterChange("Region_Name", value);
    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([...perspectiveFilters]);
      setSelectedSBU("");
      return;
    }
    setSelectedRegion(value);
    // Set SBU, Zone, and Region filters
    let perspectiveFilters = convertToFilters(activeStates);
    setAppliedFilters([...perspectiveFilters, ...defaultFilter]);
    try {
      const response: any = await loadDistinctValues(
        ["SBU_Name", "Zone_Name", "SalesArea_Name", "ProductName"],
        distinctValues
      );
      if (response) {
        setSbuOptions(response["SBU_Name"]);
        setZoneOptions(response["Zone_Name"]);
        setProductOptions(response["ProductName"]);
        setSalesAreaOptions(response["SalesArea_Name"]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSalesAreaChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("SalesArea_Name", value);
    const distinctValues = distinctFilterChange("SalesArea_Name", value);
    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([...perspectiveFilters]);
      setSelectedSalesArea("");
      return;
    }
    setSelectedSalesArea(value);
    let perspectiveFilters = convertToFilters(activeStates);
    setAppliedFilters([...perspectiveFilters, ...defaultFilter]);

    try {
      const response: any = await loadDistinctValues(
        ["SBU_Name", "Zone_Name", "Region_Name", "ProductName"],
        distinctValues
      );
      if (response) {
        setSbuOptions(response["SBU_Name"]);
        setZoneOptions(response["Zone_Name"]);
        setRegionOptions(response["Region_Name"]);
        setProductOptions(response["ProductName"]);
      }
    } catch (error) {
      console.log(error);
    }
  };
  const handleProductNameChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("ProductName", value);
    const distinctValues = distinctFilterChange("ProductName", value);
    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([...perspectiveFilters]);
      setSelectedProductName("");
      return;
    }
    setSelectedProductName(value);
    let perspectiveFilters = convertToFilters(activeStates);
    setAppliedFilters([...perspectiveFilters, ...defaultFilter]);
    try {
      const response: any = await loadDistinctValues(
        ["SBU_Name", "Zone_Name", "Region_Name"],
        distinctValues
      );
      if (response) {
        setSbuOptions(response["SBU_Name"]);
        setZoneOptions(response["Zone_Name"]);
        setRegionOptions(response["Region_Name"]);
        setSalesAreaOptions(response["SalesArea_Name"]);
      }
    } catch (error) {
      console.log(error);
    }
  };


  const getDynamicHeaderText = () => {
    const activeKeys = Object.keys(activeStates).filter(
      (key) => activeStates[key as keyof ActiveStates]
    );
    if (activeKeys.length === 1 && activeKeys[0] === "A") {
      return "Actual (2024-25)";
    } else if (
      activeKeys.includes("A") &&
      activeKeys.includes("H") &&
      !activeKeys.includes("T")
    ) {
      return "Historical (2023-24) vs Actual (2024-25)";
    } else if (
      activeKeys.includes("A") &&
      activeKeys.includes("T") &&
      !activeKeys.includes("H")
    ) {
      return "Actual (2024-25) vs Target";
    } else if (
      activeKeys.length === 3 &&
      activeKeys.includes("A") &&
      activeKeys.includes("H") &&
      activeKeys.includes("T")
    ) {
      return "History (2023-24) vs Actual (2024-25) vs Target";
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
      console.log("Selected dates:", formattedDates);
    }
  };

  const resetDate = () => {
    setFromDate(firstDayOfMonth);
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
    const percentageNum: any =
      historicalValue !== 0
        ? (((currentValue - historicalValue) / historicalValue) * 100).toFixed(
          2
        )
        : 0;

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
        {/* Glow Effect */}
        {/* <div
 className={`absolute -inset-[1px] rounded-2xl transition-all duration-300 blur-2xl group-hover:blur-xl ${styles.glow} opacity-0 group-hover:opacity-100`}
 ></div> */}

        {/* Card Content */}
        <div className="relative p-3 space-y-2 h-full">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                {title}
              </h3>
            </div>

            {/* Percentage Badge */}
            <div
              className={`px-1 py-0 flex rounded-xl ${styles.background} border ${styles.border}`}
            >
              <span className={`text-xs font-bold ${styles.text}`}>
                {percentageNum > 0 ? "+" : ""}
                {percentageNum}%
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mt-auto">
            <div className="space-y-0">
              <p className="text-xs text-gray-500 font-medium">Cur Val</p>
              <p className="text-md font-bold text-gray-700">
                {Number(currentValue).toLocaleString()}
              </p>
            </div>
            <div className="space-y-0">
              <p className="text-xs text-gray-500 font-medium m-0">His Val</p>
              <p className="text-md font-bold text-gray-700 m-0">
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
    <Card className="w-full bg-white rounded-lg border border-gray-200 pt-2 px-2">
      {isLoading && <ApiLoader loading={isLoading} />}
      {/* <span className="text-base font-bold">Sales Performance Selection</span>
      <Separator className="my-1" /> */}
      <div className="flex gap-1">
        <div className="w-[60%]">
          <CardHeader className="p-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <SalesDropdowns
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
                  
                  <div className="flex gap-1">
                    <TooltipProvider>
                      {Object.keys(categoryData).map((key) => (
                        <Tooltip key={key}>
                          <TooltipTrigger asChild>
                            <Button
                              variant={activeStates[key as keyof ActiveStates] ? "outline" : "default"}
                              className={`border text-xs p-0 w-8 h-8 flex items-center justify-center ${
                                activeStates[key as keyof ActiveStates]
                                  ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                                  : "bg-white text-black hover:bg-white hover:text-black"
                              }`}
                              onClick={() => toggleButtonState(key as keyof ActiveStates)}
                            >
                              {key}
                            </Button>
                            
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{categoryData[key as keyof typeof categoryData].name}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                  <Button
                              variant={mode === "ytd" ? "outline" : "default"}
                              onClick={() => handleModeChange("ytd")}
                              className={`border w-9 h-8 p-0 text-xs ${
                                mode === "ytd"
                                  ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                                  : "bg-white text-black hover:bg-white hover:text-black"
                              }`}
                            >
                              YTD
                            </Button>

                         


                <div className="flex gap-1">
                  <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger>
                      {/* <Button className={`border w-7 h-7 p-0 text-xs ${mode === "date" ? "bg-teal-600 text-white" : "bg-white text-black"}`}>
                        <Calendar strokeWidth={1} className="h-4 w-4" />
                      </Button> */}
                    </PopoverTrigger>

                        <PopoverContent className="w-auto p-4">
                          {/* <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <div className="flex flex-col space-y-4">
                              <div className="flex items-center space-x-4">
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
                          </LocalizationProvider> */}
                        </PopoverContent>
                      </Popover>
{/* 
                      <Button
                    onClick={handleBackClick}
                    className="text-white text-xs p-0 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
                  >
                    <IconArrowLeft stroke={1.5} className="h-4 w-4" />
                  </Button> */}
                  <Button
                    onClick={resetFilters}
                    className="text-white text-xs p-0 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
                  >
                    <IconRestore stroke={1.5} className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              </div>


              <div className="flex justify-between">
                <span className="text-base font-bold">
                  {getDynamicHeaderText()} - TMT
                </span>
              </div>
            </div>
          </CardHeader>
            <CardContent className="px-2">
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 36 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={<CustomXAxisTick />}
                      height={60}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fill: "#333", fontSize: "0.7rem" }}
                      label={{
                        value: "Sales(TMT)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#333",
                        fontSize: 11,
                      }}
                      axisLine={{ stroke: "#333" }}
                    />
                    <RechartTooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: "#f0f0f0" }}
                    />
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      wrapperStyle={{
                        paddingTop: "0px",
                      }}
                    />
                    {Object.entries(categoryData).map(
                      ([key, { color, name }]) => {
                        const dataKey = getDataKey(key, mode, 0);
                        return (
                          activeStates[key as keyof ActiveStates] && (
                            <Bar
                              key={key}
                              dataKey={dataKey}
                              name={name}
                              fill={color}
                              maxBarSize={30}
                              alignmentBaseline="before-edge"
                            >
                              <LabelList
                                dataKey={dataKey}
                                content={renderCustomizedLabel}
                              />
                            </Bar>
                          )
                        );
                      }
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* <div className="w-full flex justify-center mb-3">
 {drillHistory.length > 0 && (
 <div className="flex flex-wrap gap-2 items-center">
 {drillHistory.map((item, index) => (
 <Badge className="py-2 text-sm" key={index} variant={badgeVariants[index % badgeVariants.length]}>
 {item}
 </Badge>
 ))}
 </div>
 )}
 </div> */}
              {/* <DrillIndicator drillLevel={drillLevel} drillHistory={drillHistory} /> */}
            </CardContent>
            </div>
        <div className="w-[40%]">
          <TablePerformancesales
            data={chartData}
            activeStates={activeStates}
            drillLevel={0}
          />
        </div>
      </div>
    </Card>
  );
};



export default SalesAHTYTD;
