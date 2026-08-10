import React from "react";
import { useState, useCallback, useEffect, useMemo } from "react";
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
import {
  IconArrowLeft,
  IconMaximize,
  IconMinimize,
  IconRestore,
} from "@tabler/icons-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/@/components/ui/tabs";
import convertToFilters, { removeOldValues } from "@/utils/dynamicFilter";
import { fetchChartData, fetchDistinctValues } from "../../api";
import { format, startOfMonth, subDays } from "date-fns";

import { Separator } from "@/@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/@/components/ui/breadcrumb";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Calendar, RefreshCcw } from "lucide-react";
import ReactECharts from "echarts-for-react";
import { ToggleGroup, ToggleGroupItem } from "@/@/components/ui/toggle-group";
import { ReloadIcon } from "@radix-ui/react-icons";
import TablePerformancesales from "../../TablePerformancesales";
import { Switch } from "@/@/components/ui/switch";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import { Label } from "@/@/components/ui/label";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";

/** India FY: Apr–Mar, label "YYYY-(YYYY+1)". */
const FY_START_MONTH = 3;

const getCurrentFiscalYearString = (d: dayjs.Dayjs = dayjs()) => {
  const y = d.year();
  const m = d.month();
  if (m >= FY_START_MONTH) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
};

const parseFiscalYearLabel = (fy: string): { start: number; end: number } | null => {
  const m = /^(\d{4})-(\d{4})$/.exec(String(fy).trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) return null;
  return { start, end };
};

const getPreviousFiscalYearString = (d: dayjs.Dayjs = dayjs()) => {
  const cur = parseFiscalYearLabel(getCurrentFiscalYearString(d));
  if (!cur) return "";
  const prevStart = cur.start - 1;
  return `${prevStart}-${prevStart + 1}`;
};

const getDefaultSelectedFiscalYear = (d: dayjs.Dayjs = dayjs()) => {
  const today = d.startOf("day");
  const fyStartThisCalendarYear = d
    .year(today.year())
    .month(FY_START_MONTH)
    .date(1)
    .startOf("day");
  if (today.isSame(fyStartThisCalendarYear, "day")) {
    return getPreviousFiscalYearString(d);
  }
  return getCurrentFiscalYearString(d);
};

const isCurrentFiscalYearSelection = (fy: string) => fy === getCurrentFiscalYearString();

const buildFiscalYearSelectOptions = (d: dayjs.Dayjs = dayjs()) => {
  const current = getCurrentFiscalYearString(d);
  const previous = getPreviousFiscalYearString(d);
  if (!previous) return [current];
  return [current, previous];
};

/** Heading / picker range: past FY = 1 Apr start → 31 Mar end; current FY = 1 Apr → yesterday, or 1 Apr → 1 Apr if today is FY start. */
const getDrillYearDateRange = (fyLabel: string) => {
  const fy = parseFiscalYearLabel(fyLabel);
  if (!fy) {
    return {
      from: dayjs().month(3).date(1).startOf("day"),
      to: dayjs().subtract(1, "day").startOf("day"),
    };
  }
  if (!isCurrentFiscalYearSelection(fyLabel)) {
    return {
      from: dayjs().year(fy.start).month(3).date(1).startOf("day"),
      to: dayjs().year(fy.end).month(2).date(31).startOf("day"),
    };
  }
  const fyStart = dayjs().year(fy.start).month(3).date(1).startOf("day");
  const today = dayjs().startOf("day");
  if (today.isSame(fyStart, "day")) {
    return { from: fyStart, to: fyStart };
  }
  return {
    from: fyStart,
    to: dayjs().subtract(1, "day").startOf("day"),
  };
};

/** e.g. "1 Apr 2025 to 31 Mar 2026" */
const formatDrillHeadingRange = (from: dayjs.Dayjs, to: dayjs.Dayjs) =>
  `${dayjs(from).format("D MMM YYYY")} to ${dayjs(to).format("D MMM YYYY")}`;

interface ChartData {
  name: string;
  [key: string]: number | string;
}

type ChartMode = "month" | "year" | "ytd" | "date";

interface ActiveStates {
  H: boolean;
  A: boolean;
  T: boolean;
  C?: boolean;
}

interface Filter {
  key: string;
  cond: string;
  value: string;
}

const categoryData = {
  A: { color: "#f6c95e", name: "Actual", title: "Act" },
  H: { color: "#0998be", name: "Historical", title: "Hist" },
  T: { color: "#8f72da", name: "Target", title: "Tgt" },
};
const haButtonsData = {
  A: { color: "#00a495", name: "Actual", title: "Act" },
  H: { color: "#a3bf02", name: "Historical", title: "Hist" },
};
const tButtonsData = {
  T: { color: "#dea600", name: "Target", title: "Tgt" },
};

const getInitialDrilldownList = (selectedYorM: "Y" | "M") => {
  return selectedYorM === "Y"
    ? [
      { key: "cumulative", isActive: false, drillLevel: 1 },
      { key: "ProductName", isActive: false, drillLevel: 2 },
      { key: "Zone_Name", isActive: false, drillLevel: 3 },
      { key: "Region_Name", isActive: false, drillLevel: 4 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
      { key: "month_name", isActive: false, drillLevel: 6 },
    ]
    : [
      { key: "month_name", isActive: false, drillLevel: 1 },
      { key: "ProductName", isActive: false, drillLevel: 2 },
      { key: "Zone_Name", isActive: false, drillLevel: 3 },
      { key: "Region_Name", isActive: false, drillLevel: 4 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
    ];
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

const getXAxisKey = (drillLevel: number, selected: "Y" | "M"): string => {
  const keys =
    selected === "Y"
      ? [
        "cumulative",
        "ProductName",
        "Zone_Name",
        "Region_Name",
        "SalesArea_Name",
        "month_name",
      ]
      : [
        "month_name",
        "ProductName",
        "Zone_Name",
        "Region_Name",
        "SalesArea_Name",
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
  selectedYorM: any;
}

const transformChartData = (
  responseData: any,
  mode: ChartMode,
  drillLevel: number,
  activeStates: ActiveStates,
  selected: string,
  sbu: string
): ChartData[] => {
  if (!responseData) return [];
  const validSelected: "Y" | "M" = selected === "M" ? "M" : "Y";
  const isArray = Array.isArray(responseData);
  const xAxisKey = getXAxisKey(drillLevel, validSelected);
  const multiplyFactor = sbu === "GAS" ? 1000 : 1;

  if (!isArray) {
    if (drillLevel === 0) {
      const dataKey = responseData.month_name ? "month_name" : "cumulative";
      return Object.keys(responseData[dataKey] || {}) // Ensure it exists
        .map((key) => ({
          name: responseData[dataKey][key] ?? "", // Default to empty string
          ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
          TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
          ACTUAL_HISTORY_TMT_SALES:
            responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
        }))
        .filter(
          (item) =>
            item.name.trim() !== "" && // Ensure name is not empty
            (item.ACTUAL_TMT_SALES !== 0 ||
              item.TARGET_TMT_SALES !== 0 ||
              item.ACTUAL_HISTORY_TMT_SALES !== 0) // At least one nonzero
        );
    }

    return Object.keys(responseData[xAxisKey] || {}) // Ensure it exists
      .map((key) => ({
        name: responseData[xAxisKey]?.[key] ?? "",
        ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
        TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
        ACTUAL_HISTORY_TMT_SALES:
          responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
      }))
      .filter(
        (item) =>
          item.name.trim() !== "" && // Ensure name is not empty
          (item.ACTUAL_TMT_SALES !== 0 ||
            item.TARGET_TMT_SALES !== 0 ||
            item.ACTUAL_HISTORY_TMT_SALES !== 0) // At least one nonzero
      );
  }

  return responseData.map((item: any) => ({
    name: item[xAxisKey] || "",
    ...(activeStates.A &&
      (item?.NETWEIGHT_TMT
        ? { NETWEIGHT_TMT: item.NETWEIGHT_TMT * multiplyFactor }
        : item?.ACTUAL_TMT_SALES
          ? { ACTUAL_TMT_SALES: item.ACTUAL_TMT_SALES * multiplyFactor }
          : {})),
    ...(activeStates.T && {
      TARGET_QTY_TMT: (item.TARGET_QTY_TMT || 0) * multiplyFactor,
    }),
    ...(activeStates.H && {
      ACTUAL_HISTORY_TMT_SALES:
        (item.ACTUAL_HISTORY_TMT_SALES || 0) * multiplyFactor,
    }),
  }));
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
        {payload.map((entry: any, index: number) => {
          // Check if the value is less than 10 and display accordingly
          const formattedValue =
            entry.value < 10
              ? entry.value.toFixed(1) // Show 2 decimal places if less than 10
              : Math.round(entry.value); // Round off if greater than or equal to 10

          return (
            <p
              key={index}
              className="text-xs flex justify-between items-center gap-4"
              style={{ color: entry.color }}
            >
              <span>{entry.name}:</span>
              <span className="font-semibold">
                {parseFloat(formattedValue).toLocaleString()} TMT
              </span>
            </p>
          );
        })}
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

  // Define the rotation angle (e.g., 45 degrees)
  const angle = -45;
  const formattedValue =
    value < 10
      ? value.toFixed(1) // Show 2 decimal places if less than 10
      : Math.round(value); // Round off if greater than or equal to 10
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
        {parseFloat(formattedValue).toLocaleString()}
      </text>
    </g>
  );
};

interface SalesPerformanceProps {
  sbu: string;
}

const DrillDownComponent: React.FC<SalesPerformanceProps> = ({ sbu }) => {
  const isInitialized = React.useRef(false);
  const [drillDownChartData, setDrillDownChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [salesUnit, setSalesUnit] = useState("TMT");
  const [isExpanded, setIsExpanded] = useState(false);

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
    C: true,
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
  const [isResponse, setIsResponses] = useState(false);
  const [mode, setMode] = useState<ChartMode>("month");
  const [customProductName, setCustomProductName] = useState<string>("");
  const [productList, setProductList] = useState([]);

  const [selectedYear, setSelectedYear] = useState(() => getDefaultSelectedFiscalYear());
  const [drillHistory, setDrillHistory] = useState<string[]>(() =>
    mode === "month" ? [`FY ${getDefaultSelectedFiscalYear()}`] : []
  );

  const fiscalYearMonthKey = dayjs().format("YYYY-MM");
  const fiscalYearOptions = useMemo(() => buildFiscalYearSelectOptions(), [fiscalYearMonthKey]);

  useEffect(() => {
    const allowed = new Set(fiscalYearOptions);
    if (selectedYear && !allowed.has(selectedYear)) {
      setSelectedYear(getDefaultSelectedFiscalYear());
    }
  }, [selectedYear, fiscalYearOptions]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedSBU, setSelectedSBU] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSalesArea, setSelectedSalesArea] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");
const [isDateSelectionEnabled, setIsDateSelectionEnabled] = useState(false); // Step 1: Add state for date selection
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
  const [selectedYorM, setSelectedYorM] = useState<"Y" | "M">("Y");
  // Get first day of current month
  let [stackedData, setStackedData] = useState<any>([]);
  let [sbuOriginalData, setSbuOriginalData] = useState([]);
  let [zoneOriginalData, setZoneOriginalData] = useState([]);
  let [regionOriginalData, setRegionOriginalData] = useState([]);
  let [dataSeparation, setDataSeparation] = useState([]);
  let [percentageData, setPercentageData] = useState([]);

  // Get yesterday's date
  const firstDayOfMonth = dayjs().date(1).month(3); //.subtract(1, "year");
  const yesterday = dayjs().subtract(1, "day");

  // State for date range
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(yesterday);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [headingDate, setHeadingDate] = useState(() => {
    const { from, to } = getDrillYearDateRange(getDefaultSelectedFiscalYear());
    return formatDrillHeadingRange(from, to);
  });

  /** FY-based heading when not in custom date mode; in date mode, heading is set on Apply / year change. */
  useEffect(() => {
    if (mode === "date") {
      return;
    }
    const { from, to } = getDrillYearDateRange(selectedYear);
    setHeadingDate(formatDrillHeadingRange(from, to));
  }, [mode, selectedYear]);

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
  useEffect(() => {
    if (mode === "date") {
      return;
    }
    const { from, to } = getDrillYearDateRange(selectedYear);
    setFromDate(from);
    setToDate(to);
  }, [mode, selectedYear]);

  let [drilldownList, setDrilldownList] = useState(
    getInitialDrilldownList(selectedYorM)
  );

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

  useEffect(() => {
    handleModeChange("ytd");
    setMode("ytd");
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const retailFilter = selectedYorM === "Y" ? [{ key: '"SBU_Name"', cond: "equals", value: sbu }] : [];

    // Define the filters
    const ytdFilter = { key: '"YTD"', cond: "equals", value: "true" };
    const cFilter = { key: '"C"', cond: "equals", value: "true" };

    // Check if filters already exist
    const hasYTD = appliedFilters.some(filter => filter.key === ytdFilter.key);
    const hasC = appliedFilters.some(filter => filter.key === cFilter.key);

    // Only add filters if they don't already exist
    if (mode === "ytd") {
      if (!hasYTD) {
        appliedFilters.push(ytdFilter);
      }
    } else if (mode === "date") {
      // For date mode, we don't add the YTD filter
      appliedFilters = appliedFilters.filter((filter) => ![`"YTD"`].includes(filter.key));
    }

    if (selectedYorM === "Y" && !hasC) {
      appliedFilters.push(cFilter);
    }

    const updatedFilters = [...retailFilter, ...appliedFilters];
    try {
      const originalFilter = removeDuplicateFilters(
updatedFilters.filter(f =>
mode !== "ytd" ? true : f.key !== '"DATE"'
)
);
      // const originalFilter = removeDuplicateFilters(updatedFilters);
      const originalCrossFilter = removeDuplicateFilters(crossFilters);
      originalFilter.push({
        key: '"fiscal_year"',
        cond: "equals",
        value: selectedYear,
      });

      const response = await fetchChartData({
        filters: originalFilter,
        cross_filters: [
          ...originalCrossFilter,
          { key: '"sbu_wise"', cond: "equals", value: "true" },
        ],
        action:
          mode === "month" || mode === "ytd" || mode === "date"
            ? "m60_performance"
            : "yearly_sales_performance",
        drill_state: "",
      });
      setSalesUnit(response?.data?.sales_unit || "TMT");
      if (response.status && response.data) {
        if (
          Object.keys(response.data.data?.ACTUAL_HISTORY_TMT_SALES).length ===
          0 ||
          Object.keys(response.data.data?.ACTUAL_TMT_SALES).length === 0
        ) {
          toast.warning(
            "No data present for the selected combination.! Please select some other combination."
          );
          setIsLoading(false);
          setIsResponses(false);
          return;
        }
        const transformedData = transformChartData(
          response.data?.data,
          mode,
          drillLevel,
          activeStates,
          selectedYorM,
          sbu
        );
        setDrillDownChartData(transformedData);
        setIsResponses(true);
      } else {
        if (response.data?.data && response.data?.data?.length === 0) {
          toast.warning(response.message);
        }
        // setFilters([filters.pop()])
        setIsLoading(false);
        setIsResponses(false);
        // setDrillLevel((prev) => prev - 1);
        // setDrillHistory([drillHistory.pop()]);
      } console.log("originalFilter", originalFilter);
      console.log("originalCrossFilter", originalCrossFilter);
    } catch (error) {
      setIsLoading(false);
      setIsResponses(false);
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  }, [
    filters,
    drillLevel,
    mode,
    activeStates,
    appliedFilters,
    crossFilters,
    selectedYear,
  ]);

  // useEffect(() => {
  //   handleModeChange("ytd");
  // }, []);

useEffect(() => {
  if (mode === "ytd" && !isInitialized.current) {
    isInitialized.current = true;
  }
  if (!isInitialized.current) return;
  loadData();
}, [drillLevel, appliedFilters, crossFilters, selectedYear, mode]);

  const loadChartData = useCallback(
    async (drillState) => {
      setIsLoading(true);
      try {
        // Add "Retail" as a filter
        const retailFilter = [
          { key: '"SBU_Name"', cond: "equals", value: sbu },
        ];
        const updatedFilters = [...retailFilter, ...appliedFilters];

        // Fetch data
        const response = await fetchChartData({
          filters: updatedFilters,
          cross_filters: [],
          action: "m60_performance",
          drill_state: drillState,
          time_grain: "Monthly",
        });

        if (response.status && response.data) {
          const responseData = response.data?.data;
          setStackedData(responseData);

          let transformedData = [];
          switch (drillState) {
            case '"SBU_Name"':
              sbuOriginalData = responseData;
              setSbuOriginalData(responseData);
              // transformedData = transformStackedBarData(responseData, "SBU_Name");
              // console.log("SBU_Name",transformedData);
              // setSbuChartData(transformedData);
              break;
            case '"Zone_Name"':
              zoneOriginalData = responseData;
              setZoneOriginalData(responseData);
              //   transformedData = transformStackedBarData(responseData, "Zone_Name");
              //   console.log("Zone_Name",transformedData);
              //   setZoneChartData(transformedData);
              break;
            case '"Region_Name"':
              regionOriginalData = responseData;
              setRegionOriginalData(responseData);
              //   transformedData = transformStackedBarData(responseData, "Region_Name");
              //   console.log("Region_Name",transformedData);
              //   setRegionChartData(transformedData);
              break;
            default:
              console.warn("Unknown drillState:", drillState);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [appliedFilters]
  );

  // useEffect(() => {
  //   loadChartData('"SBU_Name"');
  //   loadChartData('"Zone_Name"');
  //   loadChartData('"Region_Name"');
  // }, [loadChartData, activeStates, appliedFilters]);

  // Transform data to show individual area sales per month
  const transformStackedBarData = (data, drillState) => {
    const drillMapping = {
      SBU_Name: "Zone_Name",
      Zone_Name: "Region_Name",
      Region_Name: "SalesArea_Name",
    };

    const nextState = drillMapping[drillState] || null;

    return data.flatMap((month) =>
      month.salesArea.map((area, index) => ({
        monthArea: `${month.month_name} - ${area}`,
        actual: month.ACTUAL_TMT_SALES[index],
        historical: month.ACTUAL_HISTORY_TMT_SALES[index],
      }))
    );
  };

const handleYearChange = (value) => {
  const formattedYear = `FY ${value}`;
  setSelectedYear(value);
  // setAppliedFilters((prev) => [
  //   ...prev,
  //   { key: '"fiscal_year"', cond: "equals", value: value },
  // ]);
  setDrillHistory((prev) => [formattedYear, ...prev.slice(1)]);
  
  setIsDateSelectionEnabled(!isCurrentFiscalYearSelection(value));
  // const { from: fromdate, to: todate } = getDrillYearDateRange(value);
  //   setFromDate(fromdate);
  //   setToDate(todate);
  // setHeadingDate(formatDrillHeadingRange(fromdate, todate));
};

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
        {
          key: "SBU_Name",
          value: sbu,
          cond: "=",
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
// AFTER — run dropdown init on mode change, but box calls only once on mount:
useEffect(() => {
  const initializeFilters = async () => {
    const years = await loadDistinctValues(
      mode === "year" ? ["FISCAL_YEAR"] : ["month_name"]
    );
    if (mode === "year") setYearOptions(years);

    const sbus = await loadDistinctValues(["SBU_Name"]);
    const updatedData = sbus["SBU_Name"].map((item) =>
      item === "PETROCHEMICALS SBU" ? "PetChem" : item
    );
    setSbuOptions(updatedData);

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
}, [mode, loadDistinctValues]);  // ← dropdown init still reacts to mode

// Separate effect — only runs once on mount
useEffect(() => {
  YTDBox();
  // Remove DateBox() entirely unless you actually need it elsewhere
}, []);
  // useEffect(() => {
  //   YTDBox();
  //   DateBox();
  //   const initializeFilters = async () => {
  //     const years = await loadDistinctValues(
  //       mode === "year" ? ["FISCAL_YEAR"] : ["month_name"]
  //     );
  //     if (mode === "year") {
  //       setYearOptions(years);
  //     }
  //     const sbus = await loadDistinctValues(["SBU_Name"]);
  //     const updatedData = sbus["SBU_Name"].map((item) =>
  //       item === "PETROCHEMICALS SBU" ? "PetChem" : item
  //     );
  //     setSbuOptions(updatedData);
  //     // setSbuOptions(sbus);
  //     const alldropdownOption = await loadDistinctValues([
  //       "Zone_Name",
  //       "Region_Name",
  //       "SalesArea_Name",
  //       "ProductName",
  //     ]);
  //     setZoneOptions(alldropdownOption?.["Zone_Name"]);
  //     setRegionOptions(alldropdownOption?.["Region_Name"]);
  //     setSalesAreaOptions(alldropdownOption?.["SalesArea_Name"]);
  //     setProductOptions(alldropdownOption?.["ProductName"]);
  //   };
  //   initializeFilters();
  // }, [mode, loadDistinctValues]);

  const YTDBox = async () => {
    setIsLoading(true);
    const filter = [
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
  const DateBox = async () => {
    setIsLoading(true);

    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const yesterday = subDays(today, 1);

    const dateRangeStart = format(firstDayOfMonth, "yyyy-MM-dd");
    const dateRangeEnd = format(yesterday, "yyyy-MM-dd");

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"T"', cond: "equals", value: "true" },
      
      { key: '"YTD"', cond: "equals", value: "true" },
      {
        key: '"DATE"',
        cond: "equals",
        value: `${dateRangeStart},${dateRangeEnd}`,
      },
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

        setDateFilterSbuArray(Object.values(sbuNames));
        setDateFilterCurrentSalesArray(Object.values(currentSales));
        setDateFilterHistoricalSalesArray(Object.values(historicalSales));
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

      // If selectedYorM is "M", remove "C" from updatedStates
      if (selectedYorM === "M") {
        updatedStates["C"] = false; // or delete updatedStates["C"];
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

  // function updateFiltersToCrossFilter(filters, crossFilters) {
  //   let filterMap = new Map();

  //   // Store filters in a Map for quick lookup
  //   filters.forEach((item) => {
  //     filterMap.set(item.key, item.value);
  //   });

  //   // Ensure crossFilters only has keys present in filters or "month_name"
  //   crossFilters = crossFilters.filter(
  //     (item) => item.key === '"month_name"' || filterMap.has(item.key) // item.key === '"cumulative"' ||
  //   );

  //   // Update existing crossFilters values if they exist in filters (except "month_name")
  //   crossFilters.forEach((item) => {
  //     if (filterMap.has(item.key) && item.key !== '"month_name"') {
  //       item.value = filterMap.get(item.key);
  //     }
  //   });

  //   // Ensure all keys from filters exist in crossFilters
  //   filters.forEach((item) => {
  //     if (!crossFilters.some((cf) => cf.key === item.key)) {
  //       crossFilters.push({ ...item });
  //     }
  //   });

  //   return crossFilters;
  // }

  function updateFiltersToCrossFilter(defaultFilter, crossFilters) {
    const defaultMap = new Map();
    const finalMap = new Map();

    // Step 1: Store defaultFilter in a separate map
    defaultFilter.forEach((item) => {
      defaultMap.set(item.key, { ...item });
    });

    // Step 2: First add crossFilters, skipping keys from defaultFilter except "month_name"
    crossFilters.forEach((item) => {
      if (item.key === '"month_name"' || !defaultMap.has(item.key)) {
        finalMap.set(item.key, { ...item });
      }
    });

    // Step 3: Now add defaultFilter entries (will appear at the end)
    defaultFilter.forEach((item) => {
      finalMap.set(item.key, { ...item }); // overwrites if already exists
    });

    return Array.from(finalMap.values());
  }

  const syncWithDropdowns = async (key, value) => {
    switch (key) {
      case "SBU_Name":
        setSelectedSBU(value);
        handleSBUChange(key, value);
        break;
      case "Zone_Name":
        setSelectedZone(value);
        handleZoneChange(key, value);
        break;
      case "Region_Name":
        setSelectedRegion(value);
        handleRegionChange(key, value);
        break;
      case "SalesArea_Name":
        setSelectedSalesArea(value);
        handleSalesAreaChange(key, value);
        break;
      case "ProductName":
        setSelectedProductName(value);
        handleProductNameChange(key, value);
        break;
      default:
        break;
    }
  };

  let newFilters = [];
  let newCrossFilters = [];
  let ytd = [];
  const handleBarClick = useCallback(
    (entry: any) => {
      setIsDrillDown(true);
      if (selectedYorM === "Y" && drillLevel >= 5) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      } else if (selectedYorM === "M" && drillLevel >= 4) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      }
      if (drillLevel === 1) {
        setAppliedFilters((prev) => [
          ...prev.filter((ele) => ele.key !== '"ProductName"'),
        ]);
        setIsSwitchOn(false);
        setProductList([]);
      }

      newFilters = [...appliedFilters];
      const filterKeys =
        selectedYorM === "Y"
          ? [
            "cumulative",
            "ProductName",
            "Zone_Name",
            "Region_Name",
            "SalesArea_Name",
            "month_name",
          ]
          : [
            "month_name",
            "ProductName",
            "Zone_Name",
            "Region_Name",
            "SalesArea_Name",
          ];

      newCrossFilters = [...crossFilters];
      if (drillLevel === 0) {
        newCrossFilters.push({
          key: '"SBU_Name"',
          cond: "equals",
          value: sbu,
        });
      } else {
        newCrossFilters.push({
          key:
            entry.name === "CUMMULATIVE_SALES"
              ? '"cumulative"'
              : `"${filterKeys[drillLevel]}"`,
          cond: "equals",
          value: entry.name === "CUMMULATIVE_SALES" ? "true" : entry.name,
        });
      }

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
      // if(isResponse) {
      if (sbu === "Aviation" || sbu === "GAS" || sbu === "PETCHEM") {
        console.log("Aviation is", true);
        // drillLevel + 4;
        if (drillLevel === 1) {
          setDrillLevel((prev) => prev + 4);
          return;
        }
        setDrillLevel((prev) => prev + 1);
      } else {
        setDrillLevel((prev) => prev + 1);
      }

      setDrillHistory([...drillHistory, entry.name]);
      if (drillLevel === 0) {
        syncWithDropdowns("SBU_Name", sbu);
      } else {
        syncWithDropdowns(filterKeys[drillLevel], entry.name);
      }
      // }
    },
    [drillLevel, appliedFilters, drillHistory, mode, selectedYorM]
  );

const handleBackClick = useCallback(() => {
  setIsDrillDown(true);
  
  if (drillLevel > 0) {
    // Get all active drills in reverse order (deepest first)
    const activeDrills = [...drilldownList]
      .filter(drill => drill.isActive)
      .sort((a, b) => b.drillLevel - a.drillLevel);

    if (activeDrills.length === 0) {
      resetFilters();
      return;
    }

    // Find the highest level to return to
    const targetDrillLevel = Math.max(0, drillLevel - 1);
    setDrillLevel(targetDrillLevel);

    // Determine which filters to remove (all filters deeper than target level)
    const filtersToRemove = activeDrills
      .filter(drill => drill.drillLevel > targetDrillLevel)
      .map(drill => drill.key);

    // Update drilldown list to deactivate all deeper drills
    const updatedList = drilldownList.map(drill => 
      filtersToRemove.includes(drill.key) 
        ? { ...drill, isActive: false } 
        : drill
    );
    setDrilldownList(updatedList);

    // Remove all deeper filters from cross filters
    const updatedCrossFilters = crossFilters.filter(
      filter => !filtersToRemove.includes(filter.key.replace(/"/g, ""))
    );
    setCrossFilters(updatedCrossFilters);

    // Remove all deeper filters from applied filters
    const updatedAppliedFilters = appliedFilters.filter(
      filter => !filtersToRemove.includes(filter.key.replace(/"/g, ""))
    );
    setAppliedFilters(updatedAppliedFilters);

    // Update drill history by removing all deeper levels
    setDrillHistory(prev => {
      const levelsToRemove = activeDrills
        .filter(drill => drill.drillLevel > targetDrillLevel)
        .length;
      return [...prev.slice(0, -levelsToRemove)];
    });
  }
}, [drillLevel, appliedFilters, drilldownList, crossFilters]);

const resetFilters = useCallback(async () => {
  const perspectiveKeys =
    selectedYorM === "Y"
      ? ['"A"', '"H"', '"T"', '"C"']
      : ['"A"', '"H"', '"T"'];

  // Separate perspective and non-perspective filters
  const perspectiveFilters = appliedFilters.filter((filter) =>
    perspectiveKeys.includes(filter.key)
  );

  // Define the reset filter for YTD
  const resetFilter = [
    {
      key: '"YTD"',
      cond: "equals",
      value: "true",
    },
  ];
  const { from, to } = getDrillYearDateRange(selectedYear);
  setFromDate(from);
  setToDate(to);
  // Reset all relevant states
  setDrillLevel(0);
  setMode("ytd");
  setCrossFilters([]);
  // setSelectedYear("2025-2026");
  setSelectedMonth("");
  setSelectedSBU("");
  setSelectedZone("");
  setSelectedRegion("");
  setSelectedSalesArea("");
  setSelectedProductName("");
  setDrillHistory(mode === "month" ? [`FY ${selectedYear}`] : []);
  setSelectedMonths([]);
  
  // Reset date filters to default values
  // const firstDayOfMonth = dayjs().date(1).month(3); // April 1st
  // const yesterday = dayjs().subtract(1, "day"); // Yesterday's date
  // setFromDate(firstDayOfMonth);
  // setToDate(yesterday);
  setDisplayedDateRange(''); // Clear displayed custom dates
  setMode("ytd");
  // Set the drilldown list based on the selected year or month
  if (selectedYorM === "Y") {
    setDrilldownList(getInitialDrilldownList("Y"));
  } else {
    setDrilldownList(getInitialDrilldownList("M")); // Assuming you have a function for month
  }

  // Update applied filters to include the reset filter and perspective filters
  setAppliedFilters((prev) => [...resetFilter, ...perspectiveFilters]);

  // Optionally, you can load distinct values if needed
  // await loadDistinctValues(["SBU_Name"], []);
}, [mode, selectedYorM, appliedFilters, selectedYear]);


  const handleModeChange = useCallback(
    (newMode) => {
      // If trying to deselect month while no other mode is selected, keep month selected
      if (newMode === "month" && mode === "month" && !appliedFilters.length) {
        return;
      }

      // If deselecting current mode, switch to month
      // if (newMode === mode) {
      //   setMode("month");
      //   setDrillHistory(["FY 2024-2025"]);
      //   resetFilters();
      //   return;
      // }

      if (newMode === mode) {
        setMode("month");
        setAppliedFilters((prev) =>
          prev.filter((item) => item.key !== '"YTD"')
        );
        setCrossFilters((prev) => [...prev]);
        return;
      }

      // Handle normal mode changes
      setMode(newMode);

      if (newMode === "year") {
        setDrillHistory([]);
        resetFilters();
      } else if (newMode === "month") {
        setDrillHistory([`FY ${selectedYear}`]);
        resetFilters();
      } else if (newMode === "ytd") {
        // resetFilters();
        // setDrillHistory([`Apr 01 - ${dayjs().format("MMM DD")}`]);
        setAppliedFilters((prev) => [
          ...prev,
          { key: '"YTD"', cond: "equals", value: "true" },
        ]);
        setCrossFilters((prev) => [...prev]);
        setMode("ytd");
      }
      // else if(newMode === 'date') {
      // setDrillHistory([`${fromDate.format('MMM-DD')} - ${toDate.format('MMM-DD')}`])
      // }
      else {
        setDrillHistory([`FY ${selectedYear}`]);
      }
    },
    [mode, filters, crossFilters, resetFilters]
  );

  const handleSBUChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("SBU_Name", value);
    const distinctValues = distinctFilterChange("SBU_Name", value);

    let higherLevelFilter = [];
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(
        defaultFilter,
        crossFilters
      );
      setCrossFilters(higherLevelFilter);

      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some(
          (filter) => filter.key.replace(/"/g, "") === drill.key
        ),
      }));
      setDrilldownList(drilldownList);
      const lastActiveDrill = [...drilldownList]
        .reverse()
        .find((d) => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [
        `FY ${selectedYear}`,
        ...higherLevelFilter.map((item) => item.value),
      ];
      setDrillHistory(updatedDrillHistory);
      // setDrillHistory([...drillHistory.slice(0, higherLevelFilter.length-1), higherLevelFilter[higherLevelFilter.length-1].value]);
    } else {
      higherLevelFilter = crossFilters;
    }

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
    // setSelectedZone("");
    // setSelectedRegion("");
    // setSelectedSalesArea("");
    // setSelectedProductName("");
    // setCrossFilters([]);
    // Set only SBU filter
    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      dateFilters =
        mode === "date"
          ? [{ key: '"DATE"', cond: "equals", value: formattedDates }]
          : [];
    }

    // let perspectiveFilters = selectedYorM === "M" ? "" : convertToFilters(activeStates);
    let perspectiveFilters = convertToFilters({
      ...activeStates,
      C: selectedYorM === "M" ? false : activeStates.C,
    });
    let ytdFilters =
      mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    setAppliedFilters([
      ...perspectiveFilters,
      ...ytdFilters,
      ...dateFilters,
      ...defaultFilter,
    ]);
  };

const handleZoneChange = async (key, value: string) => {
  const defaultFilter = handleFilterChange("Zone_Name", value);
  const distinctValues = distinctFilterChange("Zone_Name", value);

  if (value === "_empty") {
    let perspectiveFilters = convertToFilters(activeStates);
    setAppliedFilters([...perspectiveFilters]);
    setSelectedZone("");
    return;
  }
  
  setSelectedZone(value);

  // Set SBU and Zone filters
  let dateFilters = [];
  if (fromDate && toDate) {
    const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
      "YYYY-MM-DD"
    )}`;
    dateFilters =
      mode === "date"
        ? [{ key: '"DATE"', cond: "equals", value: formattedDates }]
        : [];
  }

  let perspectiveFilters = convertToFilters({
    ...activeStates,
    C: selectedYorM === "M" ? false : activeStates.C,
  });
  let ytdFilters =
    mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];

  // Ensure ProductName filter is retained
  const productNameFilter = appliedFilters.find(filter => filter.key === '"ProductName"');

  setAppliedFilters([
    ...perspectiveFilters,
    ...ytdFilters,
    ...dateFilters,
    ...defaultFilter,
    ...(productNameFilter ? [productNameFilter] : []), // Add ProductName filter if it exists
  ]);

  let higherLevelFilter = [];
  if (crossFilters.length > 0) {
    higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
    setCrossFilters(higherLevelFilter);
    drilldownList = drilldownList.map((drill) => ({
      ...drill,
      isActive: higherLevelFilter.some(
        (filter) => filter.key.replace(/"/g, "") === drill.key
      ),
    }));
    setDrilldownList(drilldownList);
    const lastActiveDrill = [...drilldownList]
      .reverse()
      .find((d) => d.isActive);
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
};


const handleRegionChange = async (key, value: string) => {
  const defaultFilter = handleFilterChange("Region_Name", value);
  const distinctValues = distinctFilterChange("Region_Name", value);
  
  if (value === "_empty") {
    let perspectiveFilters = convertToFilters(activeStates);
    setAppliedFilters([...perspectiveFilters]);
    setSelectedRegion("");
    return;
  }
  
  setSelectedRegion(value);

  let dateFilters = [];
  if (fromDate && toDate) {
    const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
      "YYYY-MM-DD"
    )}`;
    dateFilters =
      mode === "date"
        ? [{ key: '"DATE"', cond: "equals", value: formattedDates }]
        : [];
  }

  let perspectiveFilters = convertToFilters({
    ...activeStates,
    C: selectedYorM === "M" ? false : activeStates.C,
  });
  let ytdFilters =
    mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];

  // Ensure ProductName filter is retained
  const productNameFilter = appliedFilters.find(filter => filter.key === '"ProductName"');

  setAppliedFilters([
    ...perspectiveFilters,
    ...ytdFilters,
    ...dateFilters,
    ...defaultFilter,
    ...(productNameFilter ? [productNameFilter] : []), // Add ProductName filter if it exists
  ]);

  let higherLevelFilter = [];
  if (crossFilters.length > 0) {
    higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
    setCrossFilters(higherLevelFilter);
    drilldownList = drilldownList.map((drill) => ({
      ...drill,
      isActive: higherLevelFilter.some(
        (filter) => filter.key.replace(/"/g, "") === drill.key
      ),
    }));
    setDrilldownList(drilldownList);
    const lastActiveDrill = [...drilldownList]
      .reverse()
      .find((d) => d.isActive);
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
    // setSelectedProductName("");
    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      dateFilters =
        mode === "date"
          ? [{ key: '"DATE"', cond: "equals", value: formattedDates }]
          : [];
    }

    let perspectiveFilters = convertToFilters({
      ...activeStates,
      C: selectedYorM === "M" ? false : activeStates.C,
    });
    let ytdFilters =
      mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    if (drillLevel > 2) {
      setAppliedFilters([
        { key: '"ProductName"', cond: "equals", value: selectedProductName },
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter,
      ]);
    } else {
      setAppliedFilters([
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter,
      ]);
    }
    let higherLevelFilter = [];
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(
        defaultFilter,
        crossFilters
      );
      setCrossFilters(higherLevelFilter);
      // setDrillLevel(higherLevelFilter.length);
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some(
          (filter) => filter.key.replace(/"/g, "") === drill.key
        ),
      }));
      setDrilldownList(drilldownList);
      // **Step 2: Find the last active drill level**
      const lastActiveDrill = [...drilldownList]
        .reverse()
        .find((d) => d.isActive);
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
      const response: any = await loadDistinctValues(
        ["ProductName"],
        distinctValues
      );
      if (response) {
        // setSbuOptions(response["SBU_Name"]);
        // setZoneOptions(response["Zone_Name"]);
        // setRegionOptions(response["Region_Name"]);
        setProductOptions(response["ProductName"]);
      }
    } catch (error) {
      console.log(error);
    }
  };
  // const handleProductNameChange = async (key, value: string) => {
  //   const defaultFilter = handleFilterChange('ProductName', value);
  //   const distinctValues = distinctFilterChange('ProductName', value);
  //   if (value === "_empty") {
  //     let perspectiveFilters = convertToFilters(activeStates);
  //     setAppliedFilters([
  //       ...perspectiveFilters
  //     ]);
  //     setSelectedProductName("");
  //     return;
  //   }
  //   setSelectedProductName(value);
  //   let dateFilters = [];
  //   if(fromDate && toDate) {
  //     const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
  //       "YYYY-MM-DD"
  //     )}`;
  //     dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : [];
  //   }

  //   let perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
  //   let ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
  //   setAppliedFilters([
  //     ...perspectiveFilters,
  //     ...ytdFilters,
  //     ...dateFilters,
  //     ...defaultFilter,
  //   ]);
  //   let higherLevelFilter = [];
  //   if(crossFilters.length > 0){
  //     higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
  //     setCrossFilters(higherLevelFilter);

  //     drilldownList = drilldownList.map((drill) => ({
  //       ...drill,
  //       isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, '') === drill.key)
  //     }));
  //     setDrilldownList(drilldownList);
  //     const lastActiveDrill = [...drilldownList].reverse().find(d => d.isActive);
  //     const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
  //     setDrillLevel(drillcount);
  //     const updatedDrillHistory = ["FY 2025-2026", ...higherLevelFilter.map(item => item.value)];
  //     setDrillHistory(updatedDrillHistory);
  //     // setDrillHistory([...drillHistory.slice(0, higherLevelFilter.length-1), higherLevelFilter[higherLevelFilter.length-1].value]);
  //   } else {
  //     higherLevelFilter = crossFilters
  //   }
  //   // try {
  //   //   const response: any = await loadDistinctValues(
  //   //     ["ProductName"],
  //   //     distinctValues
  //   //   );
  //   //   if (response) {
  //   //     setSbuOptions(response["SBU_Name"]);
  //   //     setZoneOptions(response["Zone_Name"]);
  //   //     setRegionOptions(response["Region_Name"]);
  //   //     setSalesAreaOptions(response["SalesArea_Name"]);
  //   //   }
  //   // } catch (error) {
  //   //   console.log(error);
  //   // }
  // };

  const handleProductNameChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange("ProductName", value);
    const distinctValues = distinctFilterChange("ProductName", value);
    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([...perspectiveFilters]);
      // setSelectedProductName("");
      return;
    }
    setSelectedProductName(value);
    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      dateFilters =
        mode === "date"
          ? [{ key: '"DATE"', cond: "equals", value: formattedDates }]
          : [];
    }
    let perspectiveFilters = convertToFilters({
      ...activeStates,
      C: selectedYorM === "M" ? false : activeStates.C,
    });
    let ytdFilters =
      mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    if (drillLevel > 2) {
      setAppliedFilters([
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter,
      ]);
    } else {
      setAppliedFilters([
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter,
      ]);
    }
    let higherLevelFilter = [];
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(
        defaultFilter,
        crossFilters
      );
      setCrossFilters(higherLevelFilter);

      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some(
          (filter) => filter.key.replace(/"/g, "") === drill.key
        ),
      }));
      setDrilldownList(drilldownList);
      const lastActiveDrill = [...drilldownList]
        .reverse()
        .find((d) => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [
        `FY ${selectedYear}`,
        ...higherLevelFilter.map((item) => item.value),
      ];
      // console.log("updatedDrillHistory", updatedDrillHistory);
      setDrillHistory(updatedDrillHistory);
      // setDrillHistory([...drillHistory.slice(0, higherLevelFilter.length-1), higherLevelFilter[higherLevelFilter.length-1].value]);
    } else {
      higherLevelFilter = crossFilters;
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

// const handleDateFilter = () => {
//   if (fromDate && toDate) {
//     // Show warning if dates are outside FY, but still allow the filter
//      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
//       "YYYY-MM-DD"
//     )}`;
//     // Convert perspective filters based on active states
//     const perspectiveFilters = convertToFilters({ ...activeStates });

//     // Initialize filtersToAdd with the perspective filters and date filter
//     let filtersToAdd = [
//       ...perspectiveFilters,
//       { key: '"DATE"', cond: "equals", value: formattedDates },
//     ];

//     // If selectedYorM is "Y", add the "C" filter
//     if (selectedYorM === "Y") {
//       filtersToAdd.push({ key: '"C"', cond: "equals", value: "true" });
//     }

//     // If selectedYorM is not "Y", remove the "C" filter if it's present in appliedFilters
//     if (selectedYorM !== "Y") {
//       filtersToAdd = filtersToAdd.filter((filter) => filter.key !== '"C"');
//     }
//     const filtersWithoutYTD = newFilters.filter(filter => filter.key !== '"YTD"');
//     setAppliedFilters(filtersWithoutYTD);

//     // Set the applied filters
//     setAppliedFilters(filtersToAdd);

//     // Set mode and drill history
//     setMode("date");
//     setDrillHistory([
//       `${fromDate.format("MMM-DD")} - ${toDate.format("MMM-DD")}`,
//     ]);
//     setIsOpen(false);
//   }
// };
const [displayedDateRange, setDisplayedDateRange] = useState('');
const handleDateFilter = useCallback(() => {
  if (fromDate && toDate) {
    setHeadingDate(formatDrillHeadingRange(fromDate, toDate));
    
    // Apply filters
    const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`;
    const dateFilter = [{ key: '"DATE"', cond: "equals", value: formattedDates }];
    const perspectiveFilters = convertToFilters(activeStates);
    
    setAppliedFilters([...perspectiveFilters, ...dateFilter]);
    setMode("date");
    setIsOpen(false);
  }
}, [fromDate, toDate, activeStates, selectedYear]);

const handlePopoverOpenChange = (open) => {
  if (open) {
    const { from, to } = getDrillYearDateRange(selectedYear);
    setFromDate(from);
    setToDate(to);
  }
  setIsOpen(open);
};

const resetDate = () => {
  const { from, to } = getDrillYearDateRange(selectedYear);
  setFromDate(from);
  setToDate(to);
};


  const DrillIndicator: React.FC<DrillStateIndicatorProps> = ({
    drillLevel,
    drillHistory,
    selectedYorM,
  }) => {
    const states =
      selectedYorM === "Y"
        ? selectedSBU !== "Aviation" &&
          selectedSBU !== "GAS" &&
          selectedSBU !== "PETCHEM"
          ? [
            "Cumulative",
            "Product",
            "Zone",
            "Region",
            "Sales Area",
            "Month Name",
          ]
          : ["Cumulative", "Product", "Month Name"]
        : selectedSBU !== "Aviation" &&
          selectedSBU !== "GAS" &&
          selectedSBU !== "PETCHEM"
          ? ["Month Name", "Product", "Zone", "Region", "Sales Area"]
          : ["Month Name", "Product"];

    const getInitialDrilldownList = (selectedYorM: "Y" | "M") => {
      return selectedYorM === "Y"
        ? selectedSBU !== "Aviation" &&
          selectedSBU !== "GAS" &&
          selectedSBU !== "PETCHEM"
          ? [
            { key: "cumulative", isActive: false, drillLevel: 1 },
            { key: "ProductName", isActive: false, drillLevel: 2 },
            { key: "Zone_Name", isActive: false, drillLevel: 3 },
            { key: "Region_Name", isActive: false, drillLevel: 4 },
            { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
            { key: "month_name", isActive: false, drillLevel: 6 },
          ]
          : [
            { key: "cumulative", isActive: false, drillLevel: 1 },
            { key: "ProductName", isActive: false, drillLevel: 2 },
            { key: "month_name", isActive: false, drillLevel: 3 },
          ]
        : selectedSBU !== "Aviation" &&
          selectedSBU !== "GAS" &&
          selectedSBU !== "PETCHEM"
          ? [
            { key: "month_name", isActive: false, drillLevel: 1 },
            { key: "ProductName", isActive: false, drillLevel: 2 },
            { key: "Zone_Name", isActive: false, drillLevel: 3 },
            { key: "Region_Name", isActive: false, drillLevel: 4 },
            { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
          ]
          : [
            { key: "month_name", isActive: false, drillLevel: 1 },
            { key: "ProductName", isActive: false, drillLevel: 2 },
          ];
    };

    const updatedDrilldownList = getInitialDrilldownList(
      selectedYorM as "Y" | "M"
    ).map((drill) => ({
      ...drill,
      isActive: crossFilters.some(
        (filter) => filter.key.replace(/"/g, "") === drill.key
      ),
    }));

    // const lastActiveDrill = [...updatedDrilldownList].reverse().find((d) => d.isActive);
    // const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;

    return (
      <div className="space-y-2 text-xs px-8">
        <CustomStepper
          style={{ width: "650px" }}
          activeStep={drillLevel}
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

  // const currentMonth = new Date().getMonth();
  // const salesAreas = stackedData?.[currentMonth].salesArea;
  // Generate colors for the stacks
  const colors = ["#8884d8", "#83a6ed", "#8dd1e1", "#82ca9d"];

  const hasTargetData = (data: Record<string, any>) => {
    return data && Object.keys(data).some((key) => key.includes("_target"));
  };

  const handleZoneCellClick = ({ zone, month, value }) => {
    // Handle the click event here
    console.log(`Clicked: ${zone} - ${month}: ${value}%`);
    // Pass the data to another component or trigger any other action
    handleZoneChange("Zone_Name", zone);
  };

  const handleRegionCellClick = ({ region, month, value }) => {
    // Handle the click event here
    console.log(`Clicked: ${region} - ${month}: ${value}%`);
    // Pass the data to another component or trigger any other action
    handleRegionChange("Region_Name", region);
  };

  const showTargetChart = hasTargetData(dataSeparation);
  const showPercentageChart = hasTargetData(percentageData);
  interface RedIndicatorProps {
    x?: any;
    y?: any;
    width?: any;
  }
  // Red indicator component with proper typing
  const RedIndicator: React.FC<RedIndicatorProps> = ({
    x = 0,
    y = 0,
    width = 0,
  }) => (
    <svg x={x + width / 2 - 8} y={y - 45}>
      <circle cx="10" cy="10" r="10" fill="red" />
    </svg>
  );
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  const formatNumber = (value) => {
    return value.toLocaleString(); // This will add thousand separators
  };
  const ExpandedChart = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={toggleExpand}
      />

      {/* Expanded chart container */}
      <div className="relative w-[95vw] h-[90vh] bg-white rounded-lg shadow-xl p-4 z-50">
        <div className="absolute right-2 top-4">
          <TooltipProvider>
            <div className="flex gap-1">
              <ToggleGroup
                variant="outline"
                className="inline-flex gap-0 -space-x-px rounded-lg shadow-sm shadow-black/5 rtl:space-x-reverse bg-background"
                type="single"
                value={selectedYorM}
                onValueChange={(val: any) => {
                  if (val) {
                    setSelectedYorM(val); // Update the selected value

                    setAppliedFilters((prevFilters: any) => {
                      if (val === "Y") {
                        const newFilters = convertToFilters({
                          ...activeStates,
                          C: true,
                        });

                        // Ensure filters are not duplicated
                        const filteredPrevFilters = prevFilters.filter(
                          (filter: any) => filter.key !== '"C"'
                        );

                        return [...filteredPrevFilters, ...newFilters]; // Spread instead of nesting
                      } else {
                        return prevFilters.filter(
                          (filter: any) => filter.key !== '"C"'
                        );
                      }
                    });
                    setCrossFilters([]);
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

              {Object.keys(haButtonsData).map((key) => (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        activeStates[key as keyof ActiveStates]
                          ? "outline"
                          : "default"
                      }
                      className={`border text-xs p-1 w-8 h-8 flex items-center justify-center ${activeStates[key as keyof ActiveStates]
                          ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                          : "bg-white text-black hover:bg-white hover:text-black"
                        }`}
                      onClick={() =>
                        toggleButtonState(key as keyof ActiveStates)
                      }
                      disabled
                    >
                      {haButtonsData[key as keyof typeof haButtonsData].title}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{categoryData[key as keyof typeof categoryData].name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {Object.keys(tButtonsData).map((key) => (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        activeStates[key as keyof ActiveStates]
                          ? "outline"
                          : "default"
                      }
                      className={`border text-xs p-1 w-8 h-8 flex items-center justify-center ${activeStates[key as keyof ActiveStates]
                          ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                          : "bg-white text-black hover:bg-white hover:text-black"
                        }`}
                      onClick={() =>
                        toggleButtonState(key as keyof ActiveStates)
                      }
                    >
                      {tButtonsData[key as keyof typeof tButtonsData].title}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{categoryData[key as keyof typeof categoryData].name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              <Button
                variant={mode === "ytd" ? "outline" : "default"}
                onClick={() => handleModeChange("ytd")}
                className={`border w-9 h-8 p-0 text-xs ${mode === "ytd"
                    ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                    : "bg-white text-black hover:bg-white hover:text-black"
                  }`}
                // disabled={selectedYear === '2024-2025'}
              >
                YTD
              </Button>

              <div className="flex gap-1">
                  <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                  <PopoverTrigger disabled={mode === "ytd" }
                    className={`${mode === "date" ? "bg-teal-600 text-white" : "bg-white text-black cursor-not-allowed"}`}> 

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="inline-block" tabIndex={-1}>
        <Button
          className={`border w-8 h-8 p-0 text-xs ${
            isDisabled
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
                            format="DD/MM/YYYY"
                            views={["year", "month", "day"]}
                            minDate={dayjs()
                              .date(1)
                              .month(3)
                              .subtract(2, "year")}
                            maxDate={dayjs()}
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
                            minDate={dayjs()
                              .date(1)
                              .month(3)
                              .subtract(2, "year")}
                            maxDate={dayjs().add(1, 'year')}
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
              <Button
                onClick={toggleExpand}
                className="text-white text-xs font-bold mt-0.5 p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
              >
                {isExpanded ? (
                  <IconMinimize stroke={1.5} />
                ) : (
                  <IconMaximize stroke={1.5} />
                )}
              </Button>
            </div>
          </TooltipProvider>
        </div>

        <div className="h-full flex flex-col">
          {/* Chart Title */}
          <div className="mb-4">
            <span className="text-xl font-bold">
              Historical (2023-24) vs Actual (2024-25) vs Target - TMT/MT
            </span>
            <CustomLegend />
          </div>

          {/* Expanded Chart and Table Container */}
          <div className="flex flex-1 gap-4">
            {/* Chart Container */}
            <div className="flex-grow w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={drillDownChartData}
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
                      value: `Sales (${salesUnit})`,
                      angle: -90,
                      position: "insideLeft",
                      fill: "#333",
                      fontSize: 11,
                    }}
                    axisLine={{ stroke: "#333" }}
                    tickFormatter={formatNumber}
                  />
                  <RechartTooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#f0f0f0" }}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  {drillDownChartData &&
                    drillDownChartData.length > 7 &&
                    drillLevel !== 5 && (
                      <Brush
                        // startIndex={0}
                        // endIndex={6}
                        height={15}
                        stroke="#8884d8"
                        dy={2}
                      />
                    )}
                  {(() => {
                    // Existing bar chart logic (same as before)
                    let mostUnderperformingIndex = -1;
                    let maxUnderperformance = 0;

                    drillDownChartData.forEach((item, index) => {
                      const actual = item.ACTUAL_TMT_SALES || 0;
                      const historical = item.ACTUAL_HISTORY_TMT_SALES || 0;
                      const target = item.TARGET_TMT_SALES || 0;

                      const underperformance =
                        Number(historical) > 0
                          ? (Number(historical) - Number(actual)) /
                          Number(historical)
                          : 0;
                      const targetUnderperformance =
                        Number(target) > 0
                          ? (Number(target) - Number(actual)) / Number(target)
                          : 0;

                      const worstUnderperformance = Math.max(
                        underperformance,
                        targetUnderperformance
                      );

                      if (worstUnderperformance > maxUnderperformance) {
                        maxUnderperformance = worstUnderperformance;
                        mostUnderperformingIndex = index;
                      }
                    });

                    return Object.entries(categoryData).map(
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
                              maxBarSize={30}
                              alignmentBaseline="before-edge"
                              radius={[6, 6, 0, 0]}
                            >
                              <LabelList
                                dataKey={dataKey}
                                content={renderCustomizedLabel}
                              />

                              {key === "A" &&
                                mostUnderperformingIndex !== 0 && (
                                  <LabelList
                                    content={(props) => {
                                      const { x, y, width, index } = props;

                                      if (index === mostUnderperformingIndex) {
                                        return (
                                          <RedIndicator
                                            x={x}
                                            y={y}
                                            width={width}
                                          />
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                )}
                            </Bar>
                          )
                        );
                      }
                    );
                  })()}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleSwitchChange = async (checked: boolean) => {
    setIsSwitchOn(checked); // Set state when switch is toggled
    let response = await loadDistinctValues(["ProductName"]);
    const transformedData = response["ProductName"].map((item) => ({
      name: item,
      id: item,
    }));
    // console.log(response);
    setProductList(transformedData);
  };

  const handleProductSelect = (products) => {
    const productListString = products.join(",");
    setCustomProductName(productListString);
    setSelectedProductName(productListString);
    setAppliedFilters((prev) => [
      ...prev,
      { key: '"ProductName"', cond: "equals", value: productListString },
    ]);
  };
const isDisabled = mode === "ytd" ;

  return (
    <Card className="relative w-full h-full bg-white shadow-none border-none py-0 px-0">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid"
            className="w-12 h-12"
          >
            <g>
              <circle fill="#050f2c" r="10" cy="50" cx="84">
                <animate begin="0s" keySplines="0 0.5 0.5 1" values="10;0" keyTimes="0;1" calcMode="spline" dur="0.25s" repeatCount="indefinite" attributeName="r" />
                <animate begin="0s" values="#050f2c;#3369e7;#00aeff;#003666;#050f2c" keyTimes="0;0.25;0.5;0.75;1" calcMode="discrete" dur="1s" repeatCount="indefinite" attributeName="fill" />
              </circle>
              <circle fill="#050f2c" r="10" cy="50" cx="16">
                <animate begin="0s" keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1" values="0;0;10;10;10" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" dur="1s" repeatCount="indefinite" attributeName="r" />
                <animate begin="0s" keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1" values="16;16;16;50;84" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" dur="1s" repeatCount="indefinite" attributeName="cx" />
              </circle>
              <circle fill="#003666" r="10" cy="50" cx="50">
                <animate begin="-0.25s" keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1" values="0;0;10;10;10" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" dur="1s" repeatCount="indefinite" attributeName="r" />
                <animate begin="-0.25s" keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1" values="16;16;16;50;84" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" dur="1s" repeatCount="indefinite" attributeName="cx" />
              </circle>
              <circle fill="#00aeff" r="10" cy="50" cx="84">
                <animate begin="-0.5s" keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1" values="0;0;10;10;10" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" dur="1s" repeatCount="indefinite" attributeName="r" />
                <animate begin="-0.5s" keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1" values="16;16;16;50;84" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" dur="1s" repeatCount="indefinite" attributeName="cx" />
              </circle>
              <circle fill="#3369e7" r="10" cy="50" cx="16">
                <animate begin="-0.75s" keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1" values="0;0;10;10;10" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" dur="1s" repeatCount="indefinite" attributeName="r" />
                <animate begin="-0.75s" keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1" values="16;16;16;50;84" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" dur="1s" repeatCount="indefinite" attributeName="cx" />
              </circle>
            </g>
          </svg>
        </div>
      )}

      <CardHeader className="p-1">
        <div className="flex flex-row justify-between p-0">
      <span className="flex items-center text-sm font-extrabold">
            {sbu} Sales Performance (Drill down)
            <span className="p-1 rounded-lg text-xs bg-blue-100 ml-1">
              {headingDate}
        </span>
          </span>

          <TooltipProvider>
            <div className="flex gap-1">
              {/* {drillLevel > 0 && (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="switch-product"
                        className="py-2 h-6 data-[state=checked]:bg-teal-600"
                        checked={isSwitchOn}
                        onCheckedChange={handleSwitchChange}
                        disabled 
                      />
                      {!isSwitchOn ? (
                        <Label className="my-auto font-semibold">
                          Show Products
                        </Label>
                      ) : (
                        <Label className="my-auto font-semibold">
                          Hide Products
                        </Label>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Enable to select the products</p>
                  </TooltipContent>
                </Tooltip>
              )} */}
              {isSwitchOn && drillLevel > 0 && (
                <div className="">
                  <CustomMultiSelect
                    options={productList}
                    onValueChange={handleProductSelect}
                    maxCount={0}
                    defaultValue={[]}
                    placeholder="Select products"
                    variant="default"
                    clearFiltervalue={selectedMonths}
                    className="w-auto min-h-4 p-1 text-xs text-black shadow-none border-gray-300 ml-2"
                  />
                </div>
              )}
              <ToggleGroup
                variant="outline"
                className="inline-flex gap-0 -space-x-px rounded-lg shadow-sm shadow-black/5 rtl:space-x-reverse bg-background"
                type="single"
                value={selectedYorM}
                onValueChange={(val: any) => {
                  if (val) {
                    setSelectedYorM(val); // Update the selected value

                    setAppliedFilters((prevFilters: any) => {
                      if (val === "Y") {
                        const newFilters = convertToFilters({
                          ...activeStates,
                          C: true,
                        });

                        // Ensure filters are not duplicated
                        const filteredPrevFilters = prevFilters.filter(
                          (filter: any) => filter.key !== '"C"'
                        );

                        return [...filteredPrevFilters, ...newFilters]; // Spread instead of nesting
                      } else {
                        return prevFilters.filter(
                          (filter: any) => filter.key !== '"C"'
                        );
                      }
                    });
                    setCrossFilters([]);
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

              {Object.keys(haButtonsData).map((key) => (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        activeStates[key as keyof ActiveStates]
                          ? "outline"
                          : "default"
                      }
                      className={`border text-xs p-1 w-8 h-8 flex items-center justify-center ${activeStates[key as keyof ActiveStates]
                          ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                          : "bg-white text-black hover:bg-white hover:text-black"
                        }`}
                      onClick={() =>
                        toggleButtonState(key as keyof ActiveStates)
                      }
                      disabled
                    >
                      {haButtonsData[key as keyof typeof haButtonsData].title}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{categoryData[key as keyof typeof categoryData].name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {Object.keys(tButtonsData).map((key) => (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        activeStates[key as keyof ActiveStates]
                          ? "outline"
                          : "default"
                      }
                      className={`border text-xs p-1 w-8 h-8 flex items-center justify-center ${activeStates[key as keyof ActiveStates]
                          ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                          : "bg-white text-black hover:bg-white hover:text-black"
                        }`}
                      onClick={() =>
                        toggleButtonState(key as keyof ActiveStates)
                      }
                    >
                      {tButtonsData[key as keyof typeof tButtonsData].title}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{categoryData[key as keyof typeof categoryData].name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              <Button
                variant={mode === "ytd" ? "outline" : "default"}
                onClick={() => handleModeChange("ytd")}
                className={`border w-9 h-8 p-0 text-xs ${mode === "ytd"
                    ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                    : "bg-white text-black hover:bg-white hover:text-black"
                  }`}
                // disabled={selectedYear === '2024-2025'}
              >
                YTD
              </Button>

              <div className="flex gap-1">
                  <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                  <PopoverTrigger disabled={mode === "ytd" }
                    className={`${mode === "date" ? "bg-teal-600 text-white" : "bg-white text-black cursor-not-allowed"}`}> 

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="inline-block" tabIndex={-1}>
        <Button
          className={`border w-8 h-8 p-0 text-xs ${
            isDisabled
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
                            format="DD/MM/YYYY"
                            views={["year", "month", "day"]}
                            minDate={dayjs()
                              .date(1)
                              .month(3)
                              .subtract(2, "year")}
                            maxDate={dayjs()}
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
                            minDate={dayjs()
                              .date(1)
                              .month(3)
                              .subtract(2, "year")}
                            maxDate={dayjs().add(1, 'year')}
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
              <Button
                onClick={toggleExpand}
                className="text-white text-xs font-bold mt-0.5 p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
              >
                {isExpanded ? (
                  <IconMinimize stroke={1.5} />
                ) : (
                  <IconMaximize stroke={1.5} />
                )}
              </Button>

              <div className="flex items-end justify-end">
                {/* <h2 className="text-sm font-bold">{displayYear}</h2> */}
                <ShadcnSelect
                  value={selectedYear}
                  onValueChange={handleYearChange}
                >
                  <SelectTrigger className="w-[7.25rem] h-8 text-xs font-semibold border-[1.5px]">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {fiscalYearOptions.map((fy) => (
                      <SelectItem key={fy} value={fy}>
                        {fy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ShadcnSelect>
              </div>
            </div>
          </TooltipProvider>
        </div>
        <div className="flex justify-start">
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
        </div>
      </CardHeader>
      <div className="flex justify-between">
        <div className="flex gap-3 items-center">
          {/* <span className="text-base font-bold">
                    Historical (2023-24) vs Actual (2024-25) vs Target -{" "}
                    {salesUnit}
                  </span> */}
          {/* Custom Legend */}
          <CustomLegend />
        </div>
      </div>

      <div className="w-full flex justify-center mb-2">
        <DrillIndicator
          drillLevel={drillLevel}
          drillHistory={drillHistory}
          selectedYorM={selectedYorM}
        />
      </div>
      <CardContent className="grid lg:grid-cols-3 md:grid-cols-1 sm:grid-cols-1 grid-col-1 gap-4 px-2">
        <div className="md:col-span-2 lg:col-span-2 shadow-md rounded-lg border border-gray-200">
          <div className="h-[450px]">
            {/* UNDER PERFORMANCE RED DOT */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={drillDownChartData}
                margin={{ top: 40, right: 10, left: 10, bottom: 20 }}
              >
                <XAxis
                  dataKey="name"
                  tick={<CustomXAxisTick />}
                  height={80}
                  interval={0}
                />
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
                <RechartTooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#f0f0f0" }}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                {drillDownChartData &&
                  drillDownChartData.length > 7 &&
                  drillLevel !== 5 && (
                    <Brush
                      // startIndex={0}
                      // endIndex={6}
                      height={15}
                      stroke="#8884d8"
                      dy={2}
                    />
                  )}
                {(() => {
                  // Identify the most underperforming bar index based on actual vs historical sales
                  let mostUnderperformingIndex = -1;
                  let maxUnderperformance = 0;

                  drillDownChartData.forEach((item, index) => {
                    const actual = item.ACTUAL_TMT_SALES || 0;
                    const historical = item.ACTUAL_HISTORY_TMT_SALES || 0;

                    // Calculate underperformance based on the actual sales vs historical sales
                    const underperformance =
                      Number(historical) > 0
                        ? (Number(historical) - Number(actual)) /
                        Number(historical)
                        : 0;

                    // Track the worst underperforming index
                    if (underperformance > maxUnderperformance) {
                      maxUnderperformance = underperformance;
                      mostUnderperformingIndex = index;
                    }
                  });

                  return Object.entries(categoryData).map(
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
                            maxBarSize={40}
                            alignmentBaseline="before-edge"
                            radius={[6, 6, 0, 0]}
                          >
                            <LabelList
                              dataKey={dataKey}
                              content={renderCustomizedLabel}
                              angle={-90}
                              position="top"
                              transform="rotate(-90)"
                            />

                            {/* Display red indicator only for the most underperforming actual sales bar based on actual vs historical comparison */}
                            {key === "A" && mostUnderperformingIndex !== -1 && drillLevel > 2 && (
                              <LabelList
                                content={(props) => {
                                  const { x, y, width, index } = props;

                                  const shouldShowRedIndicator =
                                    (selectedYorM === "Y" && drillLevel >= 1) ||
                                    (selectedYorM === "M" && drillLevel >= 0);

                                  if (
                                    index === mostUnderperformingIndex &&
                                    shouldShowRedIndicator
                                  ) {
                                    return (
                                      <RedIndicator x={x} y={y} width={width} />
                                    );
                                  }
                                  return null;
                                }}
                              />
                            )}
                            {drillDownChartData &&
                              drillDownChartData.length > 7 && (
                                <Brush
                                  startIndex={0}
                                  endIndex={6}
                                  height={15}
                                  stroke="#8884d8"
                                  dy={2}
                                />
                              )}
                          </Bar>
                        )
                      );
                    }
                  );
                })()}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="">
          <TablePerformancesales
            salesUnit={salesUnit}
            data={drillDownChartData}
            activeStates={activeStates}
            drillLevel={drillLevel}
          />
        </div>
      </CardContent>
      {isExpanded && <ExpandedChart />}
    </Card>
  );
};

export default DrillDownComponent;
