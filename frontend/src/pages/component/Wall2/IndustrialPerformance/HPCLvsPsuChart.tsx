import React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart, Line,
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
import { IconArrowLeft, IconRestore } from "@tabler/icons-react";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { Toaster, toast } from "sonner";
import { Stepper, Step, StepLabel } from "@mui/material";
import { Badge } from "@/@/components/ui/badge";
import { styled } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import ApiLoader from "@/services/apiLoader";
import convertToFilters, { removeOldValues } from "@/utils/dynamicFilter";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/@/components/ui/breadcrumb";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { Calendar } from "lucide-react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import { Button } from '@/@/components/ui/button';
import TablePerformancesales from "../TablePerformancesales";
import { fetchChartData, fetchDistinctValues } from "../api";


interface ChartData {
  name: string;
  [key: string]: number | string;
}

type ChartMode = "month" | "year" | "ytd" | "date" | "ytm";

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
  H: { color: "#a3bf02", name: "Historical" },
  A: { color: "#00a495", name: "Actual" },
  // T: { color: "#dea600", name: "Target" },
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
      return "actual";
    case "H":
      return "history";
    default:
      return "";
  }
};

const getXAxisKey = (drillLevel: number, selected: "Y" | "M"): string => {
  const keys =
    selected === "Y"
      ? ["cumulative", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name", "ProductName"]
      : ["month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"];

  return keys[drillLevel] || "ProductName";
};

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
});

interface DrillStateIndicatorProps {
  drillLevel: number;
  drillHistory: string[];
  selectedYorM: string;
}

const transformChartData = (
  data: any,
  mode: ChartMode,
  drillLevel: number,
  activeStates: ActiveStates,
) => {
  // Check if it's company level data (first format)
  if (data.company && data.history_share && data.actual_share) {
    const transformedData = [];
    const indices = Object.keys(data.company);
    
    indices.forEach(index => {
      transformedData.push({
        name: data.company[index],
        history: data.history_share[index],
        actual: data.actual_share[index]
      });
    });
    
    return transformedData;
  }
  
  // Check if it's monthly data (second format)
  if (data.month_name) {
    const transformedData = [];
    const months = Object.keys(data.month_name);
    
    months.forEach(monthIndex => {
      transformedData.push({
        name: data.month_name[monthIndex],
        history: data.history_market_share[monthIndex],
        actual: data.actual_market_share[monthIndex]
      });
    });
    
    return transformedData;
  }
  
  return [];
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border border-gray-200 shadow-md rounded-md">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {new Intl.NumberFormat().format(entry.value)}
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
        </g>
      ))}
    </g>
  );
};

const renderCustomizedLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (!value) return null;

  const formattedValue = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);

  return (
    <text
      x={x + width / 2}
      y={y}
      fill="#333"
      textAnchor="middle"
      fontSize="0.7rem"
      dominantBaseline="middle"
      transform={`rotate(-90, ${x + width / 2}, ${y})`}
      dy={0}
      dx={-6}
    >
      {formattedValue}
    </text>
  );
};

const getInitialDrilldownList = (selectedYorM: "Y" | "M") => {
  return selectedYorM === "Y"
    ? [
        { key: "cumulative", isActive: false, drillLevel: 1 },
        { key: "SBU_Name", isActive: false, drillLevel: 2 },
        { key: "Zone_Name", isActive: false, drillLevel: 3 },
        { key: "Region_Name", isActive: false, drillLevel: 4 },
        { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
        { key: "month_name", isActive: false, drillLevel: 6 },
        { key: "ProductName", isActive: false, drillLevel: 7 },
      ]
    : [
        { key: "month_name", isActive: false, drillLevel: 1 },
        { key: "SBU_Name", isActive: false, drillLevel: 2 },
        { key: "Zone_Name", isActive: false, drillLevel: 3 },
        { key: "Region_Name", isActive: false, drillLevel: 4 },
        { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
        { key: "ProductName", isActive: false, drillLevel: 6 },
      ];
};

const HPCLvsPsuChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [companyLevelData, setCompanyLevelData] = useState([]);
  const [monthLevelData, setMonthLevelData] = useState([]);
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
    C: true,
  });
  let perspectiveFilters = convertToFilters(activeStates);
  let [appliedFilters, setAppliedFilters] = useState<FilterOption[]>(perspectiveFilters);
  // Order of filters for hierarchy
  const filterOrder = ['SBU_Name', 'Zone_Name', 'Region_Name', 'SalesArea_Name', 'ProductName'];

  const [isLoading , setIsLoading] = useState(true);
  const [mode, setMode] = useState<ChartMode>("ytm");

  const [drillHistory, setDrillHistory] = useState<string[]>(
    mode === "month" ? ["FY 2024-2025"] : []
  );

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("APR");
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
  const [salesUnit, setSalesUnit] = useState<string>('TMT');
  const [selectedYorM, setSelectedYorM] = useState<"Y" | "M">("Y");
  // Get first day of current month
  const firstDayOfMonth = dayjs().startOf("month");

  // Get yesterday's date
  const yesterday = dayjs().subtract(1, "day");

  // State for date range
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
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

  let activeDrills = [];
  let [drilldownList, setDrilldownList] = useState(getInitialDrilldownList(selectedYorM));

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"][i]
  }));

  const companies = [
    "bpcl", "cpcl", "gail", "hmel", "hpcl", "iocl", 
    "mrpl", "nel", "nrl", "oil", "ongc", "ril", "shell", "sma"
  ];
 
  useEffect(() => {
    setDrilldownList(getInitialDrilldownList(selectedYorM));
  }, [selectedYorM]);
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

  const loadData = useCallback(async (respFormat) => {
    setIsLoading(true);
    console.log("calling this load data");
    try {
      const originalFilter = removeDuplicateFilters(appliedFilters);
      const originalCrossFilter = removeDuplicateFilters(crossFilters);
      // const orderedKeys = ['"FISCAL_YEAR"', '"month_name"'];
      // const reorderedData = reorderDataByKeys(originalFilter, orderedKeys);
      const response = await fetchChartData({
        filters: originalFilter, // appliedFilters, // !isDrillDown ? reorderedData : [], // Pass `filters` only if `isDrillDown` is true
        cross_filters: originalCrossFilter, // isDrillDown ? reorderedData : [], // Pass `cross_filters` if `isDrillDown` is false
        action: "industry_performance", // Determine `action` based on `mode`
        drill_state: "", // Pass drill_state as empty
        resp_format: respFormat
      });
      const newSalesUnit = response?.data?.sales_unit || 'TMT';
      setSalesUnit(newSalesUnit);
        if (response.status && response.data) {
          if (Object.keys(response.data?.actual_share).length === 0 || Object.keys(response.data?.history_share).length === 0) {
            toast.info("No data present for the selected combination.! Please select some other combination.");
            setIsLoading(false);
            return;
          }
          const transformedData = transformChartData(
            response.data,
            mode,
            drillLevel,
            activeStates
          );
          console.log("transformedData", transformedData);
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
  }, [filters, drillLevel, mode, activeStates, appliedFilters, crossFilters]);

  useEffect(()=>{
    handleModeChange("ytm");
  },[]);

  useEffect(() => {
    getCompanyLevel();
    getMonthLevel();
  }, [drillLevel, appliedFilters, crossFilters]);

  const getCompanyLevel = async () => {
    setIsLoading(true);
    try {
      const originalFilter = removeDuplicateFilters(appliedFilters);
      // Add the new OMC filter to the original filters
      const filtersWithOMC = [
        ...originalFilter,
        {"key": "\"OMC\"", "cond": "equals", "value": "PSU"},
        // {"key": "\"OMC\"", "cond": "equals", "value": "MPSU"}

      ];
      
      const originalCrossFilter = removeDuplicateFilters(crossFilters);
      const response = await fetchChartData({
        filters: filtersWithOMC,  // Using the updated filters array
        cross_filters: originalCrossFilter,
        action: "industry_performance",
        drill_state: "",
        resp_format: "company_level"
      });
  
      if (response.status && response.data) {
        const transformedData = transformChartData(
          response.data,
          mode,
          drillLevel,
          activeStates
        );
        console.log("transformedData", transformedData);
        setCompanyLevelData(transformedData);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  };
  const getMonthLevel = async () => {
    setIsLoading(true);
    try {
      const originalFilter = removeDuplicateFilters(appliedFilters);
      const originalCrossFilter = removeDuplicateFilters(crossFilters);
      const response = await fetchChartData({
        filters: originalFilter, 
        cross_filters: originalCrossFilter, 
        action: "industry_performance",
        drill_state: "", 
        time_grain: "Monthly",
        resp_format: "company_level"
      });
      if (response.status && response.data) {
        const transformedData = transformChartData(
          response.data,
          mode,
          drillLevel,
          activeStates
        );
        setMonthLevelData(response.data);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  }

  const getData = (monthIndex) => {
    let { historyData, actualData } = splitDataByType(monthLevelData);
    return companies.map(company => ({
      name: company.toUpperCase(),
      history: historyData[`history_${company}_share`] ? historyData[`history_${company}_share`][monthIndex] : 0,
      actual: actualData[`actual_${company}_share`] ? actualData[`actual_${company}_share`][monthIndex] : 0
    }));
  };


function splitDataByType(data) {
  let historyData = {};
  let actualData = {};
  let metadata = {};

  Object.keys(data).forEach((key) => {
      if (key.startsWith("history_")) {
          historyData[key] = data[key];  // Store history-related data
      } else if (key.startsWith("actual_")) {
          actualData[key] = data[key];  // Store actual-related data
      } else {
          metadata[key] = data[key];  // Store other metadata like month_name, company
      }
  });

  return { historyData, actualData, metadata };
}


  const loadDistinctValues = useCallback(
    async (column: string[], whereCond: any = []) => {
      whereCond = [
        // ...whereCond,
        {
          //   key: "Zone_Name",
          //   value: "-",
          //   cond: "!=",
          // },
          // {
          //   key: "Zone_Name",
          //   value: "",
          //   cond: "!=",
          // },
          // {
          //   key: "SBU_Name",
          //   value: "0",
          //   cond: "!=",
        },
      ];
      try {
        const response = await fetchDistinctValues({
          connection_id: "1",
          schema: "public",
          table: "industry_performance",
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
    // YTDBox();
    const initializeFilters = async () => {
      const years = await loadDistinctValues(
        mode === "year" ? ["FISCAL_YEAR"] : ["month_name"]
      );
      if (mode === "year") {
        setYearOptions(years);
      }
      // const sbus = await loadDistinctValues(["SBU_Name"]);
      // const updatedData = sbus["SBU_Name"].map((item) =>
      //   item === "PETROCHEMICALS SBU" ? "PetChem" : item
      // );
      // setSbuOptions(updatedData);
      // setSbuOptions(sbus);
      const alldropdownOption = await loadDistinctValues([
        "sbu_name",
        "statename",
        "region_name",
        "distname",
        "productname",
      ]);
      setSbuOptions(alldropdownOption?.["sbu_name"]);
      setZoneOptions(alldropdownOption?.["statename"]);
      setRegionOptions(alldropdownOption?.["region_name"]);
      setSalesAreaOptions(alldropdownOption?.["distname"]);
      setProductOptions(alldropdownOption?.["productname"]);
    };
    initializeFilters();
  }, [mode, loadDistinctValues]);

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

    function updateFiltersToCrossFilter(filters, crossFilters) {
      let filterMap = new Map();

      // Store filters in a Map for quick lookup
      filters.forEach((item) => {
        filterMap.set(item.key, item.value);
      });

      // Ensure crossFilters only has keys present in filters or "month_name"
      crossFilters = crossFilters.filter(
        (item) => item.key === '"month_name"' || filterMap.has(item.key)
      );

      // Update existing crossFilters values if they exist in filters (except "month_name")
      crossFilters.forEach((item) => {
        if (filterMap.has(item.key) && item.key !== '"month_name"') {
          item.value = filterMap.get(item.key);
        }
      });

      // Ensure all keys from filters exist in crossFilters
      filters.forEach((item) => {
        if (!crossFilters.some((cf) => cf.key === item.key)) {
          crossFilters.push({ ...item });
        }
      });

      return crossFilters;
    }

    // const syncWithDropdowns = async (key, value) => {
    //   switch (key) {
    //     case "SBU_Name":
    //       setSelectedSBU(value);
    //       handleSBUChange(key, value);
    //       break;
    //     case "Zone_Name":
    //       setSelectedZone(value);
    //       handleZoneChange(key, value);
    //       break;
    //     case "Region_Name":
    //       setSelectedRegion(value);
    //       handleRegionChange(key, value);
    //       break;
    //     case "SalesArea_Name":
    //       setSelectedSalesArea(value);
    //       handleSalesAreaChange(key, value);
    //       break;
    //     default:
    //       break;
    //   }
    // };

  let newFilters = [];
  let newCrossFilters = [];
  let ytd = [];
  const handleBarClick = useCallback(
    (entry: any) => {
      setIsDrillDown(true);
      if (drillLevel >= 6) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      }

      newFilters = [...appliedFilters];
      const filterKeys =
        selectedYorM === "Y"
          ? ["cumulative", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name", "ProductName"]
          : ["month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"];

      newCrossFilters = [...crossFilters];
      newCrossFilters.push({
        key: entry.name === "CUMMULATIVE_SALES" ? '"cumulative"' : `"${filterKeys[drillLevel]}"`,
        cond: "equals",
        value: entry.name === "CUMMULATIVE_SALES" ? "true" : entry.name,
      });
      if (mode === "ytd") {
        ytd = [{ key: '"YTD"', cond: "equals", value: "true" }];
      }

      // Preserve perspective filters
      const perspectiveFilters = appliedFilters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      );
      newFilters = [...newFilters, ...perspectiveFilters, ...ytd];
      const removeDups = [...new Set(newFilters)];
      setAppliedFilters(removeDups);
      setCrossFilters(newCrossFilters);
      setDrillLevel((prev) => prev + 1);
      setDrillHistory([...drillHistory, entry.name]);
    //   syncWithDropdowns(filterKeys[drillLevel], entry.name);
    },
    [drillLevel, appliedFilters, drillHistory, mode, selectedYorM]
  );

  const handleBackClick = useCallback(() => {
    setIsDrillDown(true);
    if (drillLevel > 0) {
      const filterKeys =
        selectedYorM === "Y"
          ? ["cumulative", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name", "ProductName"]
          : ["month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"];

      const activeDrills = drilldownList.filter((drill) => drill.isActive);
      if (activeDrills.length === 1 || activeDrills === null) {
        resetFilters();
        return;
      }
      const lastActiveDrill = activeDrills.length > 0 ? activeDrills[activeDrills.length - 1] : null;
      const lastActiveCount = activeDrills.length > 1 ? activeDrills.slice(-2, -1)[0] : null;
      const drillcount = lastActiveDrill ? lastActiveCount?.drillLevel : 0;
      setDrillLevel(drillcount);

      if (activeDrills.length > 1) {
        const updatedList = drilldownList.map((drill) => {
          if (drill.key === lastActiveDrill?.key) {
            return { ...drill, isActive: false };
          }
          return drill;
        });

        drilldownList = updatedList;
        setDrilldownList(updatedList);
      }

      const updatedCrossFilters = crossFilters.filter((filter) => filter.key.replace(/"/g, '') !== lastActiveDrill?.key);
      setCrossFilters(updatedCrossFilters);
      appliedFilters.length > 2 ? setAppliedFilters(appliedFilters.slice(0, -1)) : setAppliedFilters(appliedFilters);
      setDrillHistory((prev) => [...prev.slice(0, -1)]);
    }
  }, [drillLevel, appliedFilters, drillHistory, mode, selectedYorM]);

  const resetFilters = useCallback(async () => {
    const perspectiveKeys = selectedYorM==="Y"?['"A"', '"H"', '"T"','"C"']:['"A"', '"H"', '"T"'];
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
  }, [mode, filters, appliedFilters, crossFilters]);

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
      } else if (newMode === "ytm") {
        // resetFilters();
        setDrillHistory([`Apr 01 - ${dayjs().format("MMM DD")}`]);
        setAppliedFilters((prev) => [
          ...prev,
          { key: '"YTM"', cond: "equals", value: "true" },
        ]);
        setMode("ytm");
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
  const CustomLegend = () => {
    return (
      <div className="flex flex-wrap gap-2 ml-2">
        {Object.entries(categoryData)
          .filter(([key]) => activeStates[key as keyof ActiveStates])
          .map(([key, { color, name }]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-3 h-3" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-700">{name}</span>
            </div>
          ))}
      </div>
    );
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

  const DrillIndicator: React.FC<DrillStateIndicatorProps> = ({
    drillLevel,
    drillHistory,
    selectedYorM,
  }) => {
    const states =
      selectedYorM === "Y"
        ? ["Cumulative", "SBU", "Zone", "Region", "Sales Area", "Month Name", "Product"]
        : ["Month Name", "SBU", "Zone", "Region", "Sales Area", "Product"];
  
    const getInitialDrilldownList = (selectedYorM: "Y" | "M") => {
      return selectedYorM === "Y"
        ? [
            { key: "cumulative", isActive: false, drillLevel: 1 },
            { key: "SBU_Name", isActive: false, drillLevel: 2 },
            { key: "Zone_Name", isActive: false, drillLevel: 3 },
            { key: "Region_Name", isActive: false, drillLevel: 4 },
            { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
            { key: "month_name", isActive: false, drillLevel: 6 },
            { key: "ProductName", isActive: false, drillLevel: 7 },
          ]
        : [
            { key: "month_name", isActive: false, drillLevel: 1 },
            { key: "SBU_Name", isActive: false, drillLevel: 2 },
            { key: "Zone_Name", isActive: false, drillLevel: 3 },
            { key: "Region_Name", isActive: false, drillLevel: 4 },
            { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
            { key: "ProductName", isActive: false, drillLevel: 6 },
          ];
    };
  
    const updatedDrilldownList = getInitialDrilldownList(selectedYorM as "Y" | "M").map((drill) => ({
      ...drill,
      isActive: crossFilters.some((filter) => filter.key.replace(/"/g, "") === drill.key),
    }));
  
    const lastActiveDrill = [...updatedDrilldownList].reverse().find((d) => d.isActive);
    const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
  
    return (
      <div className="space-y-2 text-xs px-8">
        <CustomStepper
          style={{ width: "650px" }}
          activeStep={drillcount}
          alternativeLabel
        >
          {updatedDrilldownList.slice(0, states.length).map((drill, index) => (
            <Step key={drill.key} completed={drill.isActive}>
              <StepLabel style={{ color: drill.isActive ? "#00a495" : "#ccc" }}>
                {states[index]}
              </StepLabel>
            </Step>
          ))}
        </CustomStepper>
      </div>
    );
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
        <div className="relative px-2 py-1 space-y-1 h-full">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-0">
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
          <div className="grid grid-cols-2 gap-4 mt-0">
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
    <>
      <Card className="w-full bg-white rounded-lg border border-gray-200 pt-2 px-2">
        {isLoading && <ApiLoader loading={isLoading} />}
        <div className="mt-1 mb-2">
          <CardHeader className="p-1">
            <div className="flex flex-col gap-2">
              <div className="flex gap-4 justify-between items-start">
                <div className="flex">
                  {/* <IndustrialPerformanceDropdowns
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
                    handleSBUChange={(key, value) =>
                      handleSBUChange(key, value)
                    }
                    handleZoneChange={(key, value) =>
                      handleZoneChange(key, value)
                    }
                    handleRegionChange={(key, value) =>
                      handleRegionChange(key, value)
                    }
                    handleSalesAreaChange={(key, value) =>
                      handleSalesAreaChange(key, value)
                    }
                    handleProductNameChange={(key, value) =>
                      handleProductNameChange(key, value)
                    }
                    mode={mode}
                  /> */}
                </div>
                {/* All Buttons Group */}

                <TooltipProvider>
                  <div className="flex items-center space-x-2">
                    {/* <label htmlFor="month-select" className="text-sm font-medium">Select Month:</label>
                    <select id="month-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border rounded p-1">
                      {months.map((month) => (
                        <option key={month.value} value={month.value}>{month.label}</option>
                      ))}
                    </select> */}
                  </div>
                  <div className="flex gap-1">
                    {/* A, H, T Buttons */}
                    {Object.keys(categoryData).map((key) => (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={
                              activeStates[key as keyof ActiveStates]
                                ? "outline"
                                : "default"
                            }
                            className={`border text-xs p-1 w-8 h-8 flex items-center justify-center ${
                              activeStates[key as keyof ActiveStates]
                                ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                                : "bg-white text-black hover:bg-white hover:text-black"
                            }`}
                            onClick={() =>
                              toggleButtonState(key as keyof ActiveStates)
                            }
                          >
                            {key}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {
                              categoryData[key as keyof typeof categoryData]
                                .name
                            }
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}

                    {/* YTM Button */}
                    <Button
                      variant="default"
                      onClick={() => handleModeChange("ytm")}
                      className={`w-9 h-8 p-0 text-xs ${
                        mode === "ytm"
                          ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white border-teal-600"
                          : "bg-white text-black hover:bg-white hover:text-black border"
                      }`}
                    >
                      YTM
                    </Button>

                    <div className="flex gap-1">
                      <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger>
                          <Button
                            className={`border w-8 h-8 p-0 text-xs ${
                              mode === "date"
                                ? "bg-teal-600 text-white"
                                : "bg-white text-black"
                            }`}
                          >
                            <Calendar strokeWidth={1} className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent className="w-auto p-4">
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                  </div>
                </TooltipProvider>
              </div>
              {/* Chart Title */}
              <div className="flex justify-between">
                <div className="flex gap-3 items-center">
                  <span className="text-base font-bold">
                    {/* {getDynamicHeaderText()} */}
                    HPCL VS PSU
                  </span>
                  {/* Custom Legend */}
                  <CustomLegend />
                </div>
              </div>
            </div>
          </CardHeader>
          {/* Chart Content */}
          <CardContent className="flex flex-col">
            <div className="grid lg:grid-cols-1 md:grid-cols-1 sm:grid-cols-1 grid-col-1 gap-4 px-2">
              <div className="md:col-span-2 lg:col-span-2">
                <div className="h-[450px] sm:w-sm md:w-md">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      width={500}
                      height={300}
                      data={companyLevelData}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
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
                          value: "",
                          angle: -90,
                          position: "outsideLeft",
                          fill: "#333",
                          fontSize: 11,
                        }}
                        axisLine={{ stroke: "#333" }}
                      />
                      <CartesianGrid strokeDasharray="3 3" />
                      <RechartTooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "#f0f0f0" }}
                      />
                      <Brush dataKey="name" height={20} stroke="#8884d8" />
                      {Object.entries(categoryData).map(
                        ([key, { color, name }]) => {
                          const dataKey = getDataKey(key, mode, drillLevel);
                          return (
                            activeStates[key as keyof ActiveStates] && (
                              <Bar
                                key={key}
                                dataKey={dataKey}
                                name={name}
                                fill={color}
                                onClick={handleBarClick}
                                cursor="pointer"
                                maxBarSize={50}
                                alignmentBaseline="before-edge"
                                radius={[4, 4, 0, 0]}
                              >
                                <LabelList
                                  dataKey={dataKey}
                                  content={renderCustomizedLabel}
                                  position="top"
                                />
                              </Bar>
                            )
                          );
                        }
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                </div>
              
            </div>
          </CardContent>
        </div>
      </Card>


    
    </>
  );
};

export default HPCLvsPsuChart;