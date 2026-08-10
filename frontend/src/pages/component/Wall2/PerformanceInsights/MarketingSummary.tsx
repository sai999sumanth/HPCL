import type React from "react"
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
  Brush,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/@/components/ui/card"
import { IconArrowLeft, IconMaximize, IconMinimize, IconRestore } from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip"
import { toast } from "sonner"
import { fetchChartData, fetchDistinctValues } from "../api"
import { Stepper, Step, StepLabel } from "@mui/material"
import { styled } from "@mui/material/styles"
import dayjs from "dayjs"
import {
  getIndianFiscalYearMeta,
  getDefaultFiscalYearDropdownValue,
  parseFiscalYearLabel,
  getPreviousFYSbuDateRangeDefaults,
  getIndianFiscalYearFullRangeDisplay,
} from "@/utils/fiscalYearUtils"
import ApiLoader from "@/services/apiLoader"
import convertToFilters from "@/utils/dynamicFilter"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Calendar } from "lucide-react"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import { LocalizationProvider } from "@mui/x-date-pickers"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect"
import { Button } from "@/@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/@/components/ui/toggle-group"
import { Switch } from "@/@/components/ui/switch"
import { Label } from "@/@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Badge } from "@/@/components/ui/badge"
import TablePerformancesales from "../TablePerformancesales"

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
  A: { color: "#f6c95e", name: "Actual", title: "Act" },
  H: { color: "#0998be", name: "Historical", title: "Hist" },
  T: { color: "#8f72da", name: "Target", title: "Tgt" },
}

// const categoryData = {
//   H: { color: "#0998be", name: "Historical" },
//   A: { color: "#f6c95e", name: "Actual" },
//   T: { color: "#8f72da", name: "Target" },
// };
const haButtonsData = {
  A: { color: "#00a495", name: "Actual", title: "Act" },
  H: { color: "#a3bf02", name: "Historical", title: "Hist" },
}
const tButtonsData = {
  T: { color: "#dea600", name: "Target", title: "Tgt" },
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
      ? ["cumulative", "SBU_Name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name"]
      : ["month_name", "SBU_Name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name"]

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
            item.name.trim() !== ""
          //  && // Ensure name is not empty
          //   (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0), // At least one nonzero
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
          item.name.trim() !== ""
        // && // Ensure name is not empty
        //   (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0), // At least one nonzero
      )
  }

  // TODO: This is for MT - Multiplying in 1000 for Region and Sales Area
  // if (!isArray) {
  //   if (drillLevel === 0) {
  //     const dataKey = responseData.month_name ? "month_name" : "cumulative";
  //     return Object.keys(responseData[dataKey] || {}) // Ensure it exists
  //       .map((key) => ({
  //         name: responseData[dataKey][key] ?? "", // Default to empty string
  //         ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
  //         TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
  //         ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
  //       }))
  //       .filter((item) =>
  //         item.name.trim() !== "" && // Ensure name is not empty
  //         (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0) // At least one nonzero
  //       );
  //   }

  //   // return Object.keys(responseData[xAxisKey] || {}) // Ensure it exists
  //   //   .map((key) => ({
  //   //     name: responseData[xAxisKey]?.[key] ?? "",
  //   //     ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
  //   //     TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
  //   //     ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
  //   //   }))
  //   //   .filter((item) =>
  //   //     item.name.trim() !== "" && // Ensure name is not empty
  //   //     (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0) // At least one nonzero
  //   //   );

  //   // Map through the xAxisKey values in responseData and transform each item into a chart data point.
  //   // If both SalesArea_Name and Region_Name are present, multiply the sales values (ACTUAL_TMT_SALES, TARGET_TMT_SALES, ACTUAL_HISTORY_TMT_SALES) by 1000.
  //   // The resulting array is filtered to ensure that:
  //   // 1. The 'name' field is not empty.
  //   // 2. At least one of the sales values (ACTUAL_TMT_SALES, TARGET_TMT_SALES, or ACTUAL_HISTORY_TMT_SALES) is non-zero.
  //   return Object.keys(responseData[xAxisKey] || {}) // Ensure it exists
  //     .map((key) => {
  //       // Check if both SalesArea_Name and Region_Name are present in the response data for the key
  //       const shouldMultiplyBy1000 = responseData.SalesArea_Name || responseData.Region_Name;

  //       return {
  //         name: responseData[xAxisKey]?.[key] ?? "",
  //         ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key]
  //           ? shouldMultiplyBy1000
  //             ? responseData.ACTUAL_TMT_SALES[key] * 1000
  //             : responseData.ACTUAL_TMT_SALES[key]
  //           : 0,
  //         TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key]
  //           ? shouldMultiplyBy1000
  //             ? responseData.TARGET_TMT_SALES[key] * 1000
  //             : responseData.TARGET_TMT_SALES[key]
  //           : 0,
  //         ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key]
  //           ? shouldMultiplyBy1000
  //             ? responseData.ACTUAL_HISTORY_TMT_SALES[key] * 1000
  //             : responseData.ACTUAL_HISTORY_TMT_SALES[key]
  //           : 0,
  //       };
  //     })
  //     .filter((item) =>
  //       item.name.trim() !== "" && // Ensure name is not empty
  //       (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0) // At least one nonzero
  //     );
  // }

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
            dy={10}
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
      { key: "ProductName", isActive: false, drillLevel: 3 },
      { key: "Zone_Name", isActive: false, drillLevel: 4 },
      { key: "Region_Name", isActive: false, drillLevel: 5 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 6 },
      { key: "month_name", isActive: false, drillLevel: 7 },
    ]
    : [
      { key: "month_name", isActive: false, drillLevel: 1 },
      { key: "SBU_Name", isActive: false, drillLevel: 2 },
      { key: "ProductName", isActive: false, drillLevel: 3 },
      { key: "Zone_Name", isActive: false, drillLevel: 4 },
      { key: "Region_Name", isActive: false, drillLevel: 5 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 6 },
    ]
}

const getDrilldownList = (selectedYorM: "Y" | "M") => {
  return selectedYorM === "Y"
    ? [
      { key: "cumulative", isActive: false, drillLevel: 1 },
      { key: "SBU_Name", isActive: false, drillLevel: 2 },
      { key: "ProductName", isActive: false, drillLevel: 3 },
      { key: "month_name", isActive: false, drillLevel: 7 },
    ]
    : [
      { key: "month_name", isActive: false, drillLevel: 1 },
      { key: "SBU_Name", isActive: false, drillLevel: 2 },
      { key: "ProductName", isActive: false, drillLevel: 3 }
    ]
}

const MarketingSummary: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  let [drillLevel, setDrillLevel] = useState(0);
  // const [filters, setFilters] = useState<Filter[]>([
  //   { key: '"A"', cond: "equals", value: "true" },
  //   { key: '"H"', cond: "equals", value: "true" },
  // ]);
  const [chartType, setChartType] = useState('bar');

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
    T: true,
    C: true,
  });
  const perspectiveFilters = convertToFilters(activeStates);
  const [appliedFilters, setAppliedFilters] = useState<FilterOption[]>(perspectiveFilters);
  // Order of filters for hierarchy
  const filterOrder = ['SBU_Name', 'ProductName', 'Zone_Name', 'Region_Name', 'SalesArea_Name'];

  const [isLoading, setIsLoading] = useState(true);
  const [isResponse, setIsResponses] = useState(false);
  /** API status false or empty payload — show inside chart area */
  const [chartApiMessage, setChartApiMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<ChartMode>("ytd");
  const [customProductName, setCustomProductName] = useState("");
  const [productName, setProductName] = useState<string[]>([]);

  const [drillHistory, setDrillHistory] = useState<string[]>(() =>
    mode === "month" ? [`FY ${getDefaultFiscalYearDropdownValue()}`] : [],
  )
  const [isSwitchOn, setIsSwitchOn] = useState(false)
  const [selectedYear, setSelectedYear] = useState(() => getDefaultFiscalYearDropdownValue())
  const [selectedMonth, setSelectedMonth] = useState("");
  let [selectedSBU, setSelectedSBU] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSalesArea, setSelectedSalesArea] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");

  const [isDrillDown, setIsDrillDown] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [crossFilters, setCrossFilters] = useState<Filter[]>([]);
  const [salesUnit, setSalesUnit] = useState<string>('TMT');
  const [selectedYorM, setSelectedYorM] = useState<"Y" | "M">("Y");
  // Get first day of current month
  const firstDayOfMonth = dayjs().date(1).month(3); // .subtract(1, "year")
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBreadCrumb, setShowBreadcrumb] = useState(false);

  // Get yesterday's date
  const yesterday = dayjs().subtract(1, 'day');

  // State for date range
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(yesterday);
  const { currentFY, previousFY } = getIndianFiscalYearMeta()
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [productList, setProductList] = useState([]);

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

  const activeDrills = [];
  let [drilldownList, setDrilldownList] = useState(getInitialDrilldownList(selectedYorM));

  useEffect(() => {
    setDrilldownList(getInitialDrilldownList(selectedYorM));
  }, [selectedYorM, selectedSBU]);
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
    const newAppliedFilters: FilterOption[] = [];

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
    const newAppliedFilters: FilterOption[] = [];

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

  useEffect(() => {
    handleModeChange("ytd");
    setMode("ytd")
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      mode === "ytd" ? appliedFilters.push({ key: '"YTD"', cond: "equals", value: "true" }) : appliedFilters
      const originalFilter = removeDuplicateFilters(appliedFilters);
      const originalCrossFilter = removeDuplicateFilters(crossFilters); // .map((filter) => filter.key === '"ProductName"' ? {...filter, cond: "in"} : filter)
      const fiscalYearFilter = { key: '"fiscal_year"', cond: "equals", value: selectedYear }
      const hasYearFilter = originalFilter.some((filter) => filter.key === '"fiscal_year"')
      const filtersToSend = hasYearFilter ? originalFilter : [...originalFilter, fiscalYearFilter]
      const response = await fetchChartData({
        filters: filtersToSend,
        cross_filters: originalCrossFilter, // isDrillDown ? reorderedData : [], // Pass `cross_filters` if `isDrillDown` is false
        action:
          mode === "month" || mode === "ytd" || mode === "date"
            ? "m60_performance"
            : "yearly_sales_performance", // Determine `action` based on `mode`
        drill_state: "", // Pass drill_state as empty
      });
      const newSalesUnit = response?.data?.sales_unit || 'TMT';
      setSalesUnit(newSalesUnit);

      if (response.status === false) {
        setChartData([]);
        setChartApiMessage(
          typeof response.message === "string" && response.message.trim()
            ? response.message
            : "No data available for the selected filters.",
        );
        setIsResponses(false);
        setIsLoading(false);
        return;
      }

      if (response.status && response.data) {
        setChartApiMessage(null);
        if (Object.keys(response.data.data?.ACTUAL_HISTORY_TMT_SALES).length === 0 || Object.keys(response.data.data?.ACTUAL_TMT_SALES).length === 0) {
          toast.warning("No data present for the selected combination.! Please select some other combination.");
          setIsLoading(false);
          setIsResponses(false);
          return;
        }

        // Check if all values for ACTUAL_TMT_SALES, TARGET_TMT_SALES, and ACTUAL_HISTORY_TMT_SALES are 0
        const isAllZero =
          Object.values(response.data.data?.ACTUAL_TMT_SALES).every(value => value === 0) &&
          Object.values(response.data.data?.TARGET_TMT_SALES).every(value => value === 0) &&
          Object.values(response.data.data?.ACTUAL_HISTORY_TMT_SALES).every(value => value === 0);

        if (isAllZero) {
          toast.warning("No data found for the selected combination! All sales values are 0.");
          setIsLoading(false);
          setIsResponses(false);
          return;
        }

        setIsResponses(true);
        if (selectedSBU === "Aviation" || selectedSBU === "GAS" || selectedSBU === "PETCHEM") {
          if (drillLevel === 3) { // Jumping to the Month level directly, Skipping Zone, RO, SA
            drillLevel = 6;
            setDrillLevel(6);
          } else if (drillLevel === 6) {
            drillLevel = 2;
            setDrillLevel(2);
          }
        }
        const transformedData = transformChartData(
          response.data?.data,
          mode,
          drillLevel,
          activeStates,
          selectedYorM
        );
        setChartData(transformedData);

      } else {
        setChartData([]);
        setChartApiMessage(
          typeof response.message === "string" && response.message.trim()
            ? response.message
            : "No data available for the selected filters.",
        );
        setIsResponses(false);
        setIsLoading(false);
      }
      console.log("filtersToSend", filtersToSend);
      console.log("originalCrossFilter", originalCrossFilter);

    } catch (error) {
      setIsLoading(false);
      setIsResponses(false);
      setChartApiMessage(null);
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  }, [drillLevel, mode, activeStates, appliedFilters, crossFilters, selectedSBU, selectedYear]);

  useEffect(() => {
    loadData();
  }, [appliedFilters, crossFilters]); // drillLevel, 

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
        updatedStates["C"] = false;  // or delete updatedStates["C"];
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
    const filterMap = new Map();

    // Store filters in a Map for quick lookup
    filters.forEach((item) => {
      filterMap.set(item.key, item.value);
    });

    // Ensure crossFilters only has keys present in filters or "month_name"
    crossFilters = crossFilters.filter(
      (item) => item.key === '"month_name"' || filterMap.has(item.key) // item.key === '"cumulative"' ||
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

  const syncWithDropdowns = async (key, value) => {
    switch (key) {
      case "SBU_Name":
        selectedSBU = value;
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
      if (selectedYorM === "Y" && drillLevel >= 6) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      } else if (selectedYorM === "M" && drillLevel >= 5) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      }
      drillLevel === 2 && (setProductName([entry.name]))
      if (drillLevel === 1) {
        setAppliedFilters((prev) => [...prev.filter((ele) => ele.key !== '"ProductName"')]);
        setIsSwitchOn(false);
        setProductList([]);
      }
      newFilters = [...appliedFilters];
      const filterKeys =
        selectedYorM === "Y"
          ? ["cumulative", "SBU_Name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name"]
          : ["month_name", "SBU_Name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name"];

      newCrossFilters = [...crossFilters];
      newCrossFilters.push({
        key: entry.name || entry?.value === "CUMMULATIVE_SALES" ? '"cumulative"' : `"${filterKeys[drillLevel]}"`,
        cond: "equals",
        value: entry.name || entry?.value === "CUMMULATIVE_SALES" ? "true" : entry?.name ? entry?.name : entry?.value,
      });
      if (mode === "ytd") {
        ytd = [{ key: '"YTD"', cond: "equals", value: "true" }];
      }

      // Preserve perspective filters
      const perspectiveFilters = appliedFilters.filter((filter) =>
        ["A", "H", "T"].includes(filter.key.replace(/"/g, ""))
      );
      newFilters = [...newFilters, ...perspectiveFilters, ...ytd];
      const removeDups = [...new Set(newFilters)];
      setAppliedFilters(removeDups);
      setCrossFilters(newCrossFilters);
      // if(isResponse) {
      setDrillLevel((prev) => prev + 1);
      setDrillHistory([...drillHistory, entry.name || entry?.value]);
      syncWithDropdowns(filterKeys[drillLevel], entry.name || entry?.value);
      // } 
      // else {
      //   setDrillLevel((prev) => prev - 1);
      // }
    },
    [drillLevel, appliedFilters, drillHistory, mode, selectedYorM]
  );
  const handleBackClick = useCallback((event) => {
    event.preventDefault();
    setIsDrillDown(true);

    if (drillLevel <= 0) return;

    // Define filter order based on drill levels
    const drillDownOrder = [
      '"cumulative"',
      '"SBU_Name"',
      '"ProductName"',
      '"Zone_Name"',
      '"Region_Name"',
      '"SalesArea_Name"'
    ];

    // Find the current drill level filter to remove
    const currentDrillFilter = drillDownOrder[drillLevel - 1];

    // Special case: When moving back from Product to SBU, add cumulative
    if (currentDrillFilter === '"SBU_Name"') {
      const updatedCrossFilters = crossFilters.filter(f => f.key !== '"SBU_Name"');
      const updatedAppliedFilters = appliedFilters.filter(f => f.key !== '"SBU_Name"');

      // Add cumulative to cross_filters
      updatedCrossFilters.push({
        key: '"cumulative"',
        cond: "equals",
        value: "true"
      });

      setCrossFilters(updatedCrossFilters);
      setAppliedFilters(updatedAppliedFilters);
      setDrillLevel(prev => prev - 1);
      setDrillHistory(prev => [...prev.slice(0, -1)]);
      return;
    }

    // Default case: Just remove the current level's filter
    const updatedCrossFilters = crossFilters.filter(f => f.key !== currentDrillFilter);
    const updatedAppliedFilters = appliedFilters.filter(f => f.key !== currentDrillFilter);

    setCrossFilters(updatedCrossFilters);
    setAppliedFilters(updatedAppliedFilters);
    setDrillLevel(prev => prev - 1);
    setDrillHistory(prev => [...prev.slice(0, -1)]);
  }, [drillLevel, appliedFilters, crossFilters, selectedSBU]);


  const resetFilters = useCallback(async () => {
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

    // Set the new dates
    // setFromDate(fromdate);
    // setToDate(todate);
    // const newFromDate = firstDayOfMonth;
    // const newToDate = yesterday;
    // setFromDate(newFromDate);
    // setToDate(newToDate);
    setShowBreadcrumb(true);
    // const formattedDates = `${newFromDate.format("YYYY-MM-DD")},${newToDate.format("YYYY-MM-DD")}`;

    const perspectiveKeys = selectedYorM === "Y" ? ['"A"', '"H"', '"T"', '"C"'] : ['"A"', '"H"', '"T"'];
    // Separate perspective and non-perspective filters
    const perspectiveFilters = appliedFilters.filter((filter) =>
      perspectiveKeys.includes(filter.key)
    );
    const resetFilter = [
      {
        "key": "\"YTD\"",
        "cond": "equals",
        "value": "true"
      }
    ];
    setDrillLevel(0);
    setMode("ytd");
    if (selectedYorM === "Y") {
      setDrilldownList(getInitialDrilldownList("Y"));
      setAppliedFilters((prev) => [...resetFilter, ...perspectiveFilters]);
    } else {
      setAppliedFilters((prev) => [...resetFilter, ...perspectiveFilters]);
    }
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
    setIsSwitchOn(false);
    // setHeadingDate(`${newFromDate.format("MMMM D")}, ${newFromDate.format("YYYY")} to ${newToDate.format("MMMM D")}, ${newToDate.format("YYYY")}`);

    // await loadDistinctValues(["SBU_Name"], []);
  }, [mode, filters, appliedFilters, crossFilters]);

  // Fix the handleModeChange function to properly handle mode switching
  const handleModeChange = useCallback(
    (newMode) => {
      // If trying to deselect month while no other mode is selected, keep month selected
      if (newMode === "month" && mode === "month" && !appliedFilters.length) {
        return;
      }

      // If deselecting current mode (YTD), switch to date mode and enable date filter
      if (newMode === mode && mode === "ytd") {
        setMode("date");
        // Remove YTD filter
        setAppliedFilters((prev) => prev.filter(item => (item.key !== '"YTD"')));
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
        setAppliedFilters((prev) => {
          // Remove DATE filter if it exists
          const filtersWithoutDate = prev.filter(item => item.key !== '"DATE"');
          return [
            ...filtersWithoutDate,
            { key: '"YTD"', cond: "equals", value: "true" },
          ];
        });
        setMode("ytd");
      } else {
        setDrillHistory([`FY ${selectedYear}`]);
      }
    },
    [mode, filters, crossFilters, resetFilters]
  );


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
  }, [mode, selectedYear]);

  const handleSBUChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('SBU_Name', value);
    const distinctValues = distinctFilterChange('SBU_Name', value);

    let higherLevelFilter = [];
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
      setCrossFilters(higherLevelFilter);
      if (value === 'Aviation' || value === 'GAS' || value === 'PETCHEM') {
        drilldownList = drilldownList.map((drill) => ({
          ...drill,
          isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, '') === drill.key)
        }));
      } else {
        drilldownList = drilldownList.map((drill) => ({
          ...drill,
          isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, '') === drill.key)
        }));
      }
      setDrilldownList(drilldownList);
      const lastActiveDrill = [...drilldownList].reverse().find(d => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map(item => item.value)];
      setDrillHistory(updatedDrillHistory);
      // setDrillHistory([...drillHistory.slice(0, higherLevelFilter.length-1), higherLevelFilter[higherLevelFilter.length-1].value]);
    } else {
      higherLevelFilter = crossFilters
    }

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
    selectedSBU = value
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
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : [];
    }

    // let perspectiveFilters = selectedYorM === "M" ? "" : convertToFilters(activeStates);
    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    if (drillLevel > 2) {
      setAppliedFilters([
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter,
        { key: '"ProductName"', cond: "equals", value: selectedProductName }
      ]);
    } else {
      setAppliedFilters([
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter,
      ]);
    }
    // try {
    //   const response = await loadDistinctValues(
    //     ["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"],
    //     distinctValues
    //   );
    //   if (response) {
    //     setZoneOptions(response["Zone_Name"]);
    //     setRegionOptions(response["Region_Name"]);
    //     setSalesAreaOptions(response["SalesArea_Name"]);
    //     setProductOptions(response["ProductName"]);
    //   }
    // } catch (error) {
    //   console.log(error);
    // }
  };

  const handleZoneChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('Zone_Name', value);
    const distinctValues = distinctFilterChange('Zone_Name', value);
    // if (value === "_empty") {
    //   let perspectiveFilters = convertToFilters(activeStates);
    //   setAppliedFilters([
    //     ...perspectiveFilters
    //   ]);
    //   setSelectedSBU("");
    //   return;
    // }
    setSelectedZone(value);
    // setSelectedRegion("");
    // setSelectedSalesArea("");
    // setSelectedProductName("");
    // setCrossFilters([]);
    // Set SBU and Zone filters
    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : [];
    }

    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    setAppliedFilters([
      ...perspectiveFilters,
      ...ytdFilters,
      ...dateFilters,
      ...defaultFilter
    ]);

    let higherLevelFilter = [];
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
      setCrossFilters(higherLevelFilter);
      // setDrillLevel(higherLevelFilter.length);
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, '') === drill.key)
      }));
      setDrilldownList(drilldownList);
      const lastActiveDrill = [...drilldownList].reverse().find(d => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map(item => item.value)];
      setDrillHistory(updatedDrillHistory);
    } else {
      higherLevelFilter = crossFilters
    }
    // try {
    //   const response: any = await loadDistinctValues(
    //     ["Region_Name", "SalesArea_Name", "ProductName"],
    //     distinctValues
    //   );
    //   if (response) {
    //     // setSbuOptions(response["SBU_Name"]);
    //     setRegionOptions(response["Region_Name"]);
    //     setSalesAreaOptions(response["SalesArea_Name"]);
    //     setProductOptions(response["ProductName"]);
    //   }
    // } catch (error) {
    //   console.log(error);
    // }
  };

  const handleRegionChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('Region_Name', value);
    const distinctValues = distinctFilterChange('Region_Name', value);
    // if (value === "_empty") {
    //   let perspectiveFilters = convertToFilters(activeStates);
    //   setAppliedFilters([
    //     ...perspectiveFilters
    //   ]);
    //   setSelectedSBU("");
    //   return;
    // }
    setSelectedRegion(value);
    // setSelectedSalesArea("");
    // setSelectedProductName("");
    let higherLevelFilter = [];
    if (crossFilters.length > 0) {
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
      setCrossFilters(higherLevelFilter);
      // setDrillLevel(higherLevelFilter.length);
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, '') === drill.key)
      }));
      setDrilldownList(drilldownList);
      const lastActiveDrill = [...drilldownList].reverse().find(d => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map(item => item.value)];
      setDrillHistory(updatedDrillHistory);
    } else {
      higherLevelFilter = crossFilters
    }
    // Set SBU, Zone, and Region filters
    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : [];
    }

    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    if (drillLevel > 2) {
      setAppliedFilters([
        { key: '"ProductName"', cond: "equals", value: selectedProductName },
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter
      ]);
    } else {
      setAppliedFilters([
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter,
      ]);
    }
    // try {
    //   const response: any = await loadDistinctValues(
    //     ["SalesArea_Name", "ProductName"],
    //     distinctValues
    //   );
    //   if (response) {
    //     // setSbuOptions(response["SBU_Name"]);
    //     // setZoneOptions(response["Zone_Name"]);
    //     setProductOptions(response["ProductName"]);
    //     setSalesAreaOptions(response["SalesArea_Name"]);
    //   }
    // } catch (error) {
    //   console.log(error);
    // }
  };

  const handleSalesAreaChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('SalesArea_Name', value);
    const distinctValues = distinctFilterChange('SalesArea_Name', value);
    // if (value === "_empty") {
    //   let perspectiveFilters = convertToFilters(activeStates);
    //   setAppliedFilters([
    //     ...perspectiveFilters
    //   ]);
    //   setSelectedSalesArea("");
    //   return;
    // }
    setSelectedSalesArea(value);
    // setSelectedProductName("");
    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : [];
    }

    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    if (drillLevel > 2) {
      setAppliedFilters([
        { key: '"ProductName"', cond: "equals", value: selectedProductName },
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter
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
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
      setCrossFilters(higherLevelFilter);
      // setDrillLevel(higherLevelFilter.length);
      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, '') === drill.key)
      }));
      setDrilldownList(drilldownList);
      // **Step 2: Find the last active drill level**
      const lastActiveDrill = [...drilldownList].reverse().find(d => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map(item => item.value)];
      setDrillHistory(updatedDrillHistory);
    } else {
      higherLevelFilter = crossFilters
    }
    // try {
    //   const response: any = await loadDistinctValues(
    //     ["ProductName"],
    //     distinctValues
    //   );
    //   if (response) {
    //     // setSbuOptions(response["SBU_Name"]);
    //     // setZoneOptions(response["Zone_Name"]);
    //     // setRegionOptions(response["Region_Name"]);
    //     setProductOptions(response["ProductName"]);
    //   }
    // } catch (error) {
    //   console.log(error);
    // }
  };
  const handleProductNameChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('ProductName', value);
    const distinctValues = distinctFilterChange('ProductName', value);
    if (value === "_empty") {
      const perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([
        ...perspectiveFilters
      ]);
      // setSelectedProductName("");
      return;
    }
    setSelectedProductName(value);
    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : [];
    }

    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    if (drillLevel > 2) {
      setAppliedFilters([
        ...perspectiveFilters,
        ...ytdFilters,
        ...dateFilters,
        ...defaultFilter
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
      higherLevelFilter = updateFiltersToCrossFilter(defaultFilter, crossFilters);
      setCrossFilters(higherLevelFilter);

      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, '') === drill.key)
      }));
      setDrilldownList(drilldownList);
      const lastActiveDrill = [...drilldownList].reverse().find(d => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map(item => item.value)];
      setDrillHistory(updatedDrillHistory);
      // setDrillHistory([...drillHistory.slice(0, higherLevelFilter.length-1), higherLevelFilter[higherLevelFilter.length-1].value]);
    } else {
      higherLevelFilter = crossFilters
    }
    // try {
    //   const response: any = await loadDistinctValues(
    //     ["ProductName"],
    //     distinctValues
    //   );
    //   if (response) {
    //     setSbuOptions(response["SBU_Name"]);
    //     setZoneOptions(response["Zone_Name"]);
    //     setRegionOptions(response["Region_Name"]);
    //     setSalesAreaOptions(response["SalesArea_Name"]);
    //   }
    // } catch (error) {
    //   console.log(error);
    // }
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
              <span className="text-sm font-bold text-gray-700">{name}</span>
            </div>
          ))}
      </div>
    );
  };

  const handleDateFilter = () => {
    if (fromDate && toDate) {
      // Format dates for the filter
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`;

      // Convert perspective filters based on active states
      const perspectiveFilters = convertToFilters({ ...activeStates });

      // Create new filters array instead of modifying existing one
      const newFilters = [
        ...perspectiveFilters,
        { key: '"DATE"', cond: "equals", value: formattedDates },
      ];

      // If selectedYorM is "Y", add the "C" filter
      if (selectedYorM === "Y") {
        newFilters.push({ key: '"C"', cond: "equals", value: "true" });
      }

      // Explicitly remove YTD filter if it exists
      const filtersWithoutYTD = newFilters.filter(filter => filter.key !== '"YTD"');

      // Set the applied filters with a completely new array
      setAppliedFilters(filtersWithoutYTD);

      // Set mode and drill history
      setMode("date");
      setDrillHistory([
        `${fromDate.format("MMM-DD")} - ${toDate.format("MMM-DD")}`,
      ]);

      // Close the popover
      setIsOpen(false);
    }
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
  //     const fy = getCurrentFinancialYear();
  //     // if (fromDate.isBefore(fy.start) || toDate.isAfter(fy.end)) {
  //     //   toast.warning(
  //     //     "Note: Selected date range extends beyond the current financial year"
  //     //   );
  //     //   return false;
  //     // }

  //     const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
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
  //       filtersToAdd = filtersToAdd.filter(filter => filter.key !== '"C"');
  //     }

  //     // Set the applied filters
  //     setAppliedFilters(filtersToAdd);

  //     // Set mode and drill history
  //     setMode("date");
  //     setDrillHistory([
  //       `${fromDate.format("MMM-DD")} - ${toDate.format("MMM-DD")}`,
  //     ]);
  //   }
  // };

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


  const fy = getCurrentFinancialYear();

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
        ? (selectedSBU !== "Aviation" && selectedSBU !== 'GAS' && selectedSBU !== 'PETCHEM') ? ["Cumulative", "SBU", "Product", "Zone", "Region", "Sales Area", "Month Name"] : ["Cumulative", "SBU", "Product", "Month Name"]
        : (selectedSBU !== "Aviation" && selectedSBU !== 'GAS' && selectedSBU !== 'PETCHEM') ? ["Month Name", "SBU", "Product", "Zone", "Region", "Sales Area"] : ["Month Name", "SBU", "Product"]

    const getInitialDrilldownList = (selectedYorM: "Y" | "M") => {
      return selectedYorM === "Y"
        ? (selectedSBU !== "Aviation" && selectedSBU !== 'GAS' && selectedSBU !== 'PETCHEM') ? [
          { key: "cumulative", isActive: false, drillLevel: 1 },
          { key: "SBU_Name", isActive: false, drillLevel: 2 },
          { key: "ProductName", isActive: false, drillLevel: 3 },
          { key: "Zone_Name", isActive: false, drillLevel: 4 },
          { key: "Region_Name", isActive: false, drillLevel: 5 },
          { key: "SalesArea_Name", isActive: false, drillLevel: 6 },
          { key: "month_name", isActive: false, drillLevel: 7 },
        ] : [
          { key: "cumulative", isActive: false, drillLevel: 1 },
          { key: "SBU_Name", isActive: false, drillLevel: 2 },
          { key: "ProductName", isActive: false, drillLevel: 3 },
          { key: "month_name", isActive: false, drillLevel: 4 }
        ]
        : (selectedSBU !== "Aviation" && selectedSBU !== 'GAS' && selectedSBU !== 'PETCHEM') ? [
          { key: "month_name", isActive: false, drillLevel: 1 },
          { key: "SBU_Name", isActive: false, drillLevel: 2 },
          { key: "ProductName", isActive: false, drillLevel: 3 },
          { key: "Zone_Name", isActive: false, drillLevel: 4 },
          { key: "Region_Name", isActive: false, drillLevel: 5 },
          { key: "SalesArea_Name", isActive: false, drillLevel: 6 },
        ] : [
          { key: "month_name", isActive: false, drillLevel: 1 },
          { key: "SBU_Name", isActive: false, drillLevel: 2 },
          { key: "ProductName", isActive: false, drillLevel: 3 }
        ]
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
          style={{ width: "750px" }}
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

  interface RedIndicatorProps {
    x?: any;
    y?: any;
    width?: any;
  }
  // Red indicator component with proper typing
  const RedIndicator: React.FC<RedIndicatorProps> = ({ x = 0, y = 0, width = 0 }) => (
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
          <div className="flex gap-3">
            <TooltipProvider>
              <div className="flex items-center gap-1">
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
                    disabled={
                      crossFilters.length > 0 && selectedYorM !== "Y"
                    } // Disable if crossFilters length > 0 and "Y" isn't selected
                  >
                    Year
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    className="rounded-none h-8 shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 data-[state=on]:bg-teal-600 data-[state=on]:text-white"
                    value="M"
                    disabled={
                      crossFilters.length > 0 && selectedYorM !== "M"
                    } // Disable if crossFilters length > 0 and "M" isn't selected
                  >
                    Month
                  </ToggleGroupItem>
                </ToggleGroup>
                {/* A, H, T Buttons */}
                {/* A and H Buttons */}
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
                        {
                          haButtonsData[key as keyof typeof haButtonsData]
                            .title
                        }
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {
                          haButtonsData[key as keyof typeof haButtonsData]
                            .name
                        }
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {/* Target Button */}
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
                        {
                          tButtonsData[key as keyof typeof tButtonsData]
                            .title
                        }
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

                {/* YTD Button */}
                <Button
                  variant={mode === "ytd" ? "outline" : "default"}
                  onClick={() => handleModeChange("ytd")}
                  className={`border w-9 h-8 p-0 text-xs ${mode === "ytd"
                    ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                    : "bg-white text-black hover:bg-white hover:text-black"
                    }`}
                // disabled={selectedYear === "2024-2025"}
                >
                  YTD
                </Button>

                <div className="flex gap-1">
                  <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                    <PopoverTrigger>
                      <Button
                        className={`border w-8 h-8 p-0 text-xs ${mode === "date"
                          ? "bg-teal-600 text-white"
                          : "bg-white text-black"
                          }`}
                      // disabled={selectedYear === "2024-2025"}
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
                              minDate={fromDate}
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
        </div>

        <div className="h-full flex flex-col">
          {/* Chart Title */}
          <div className="mb-4">
            <span className="text-xl font-bold">
              Historical (2023-24) vs Actual (2024-25) vs Target - {salesUnit}
            </span>
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
              <BarChart
                data={chartData}
                margin={{ top: 40, right: 10, left: 10, bottom: 50 }}
              >
                <XAxis
                  dataKey="name"
                  tick={<CustomXAxisTick />}
                  height={70}
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

                {(() => {
                  // Identify the most underperforming bar index
                  let mostUnderperformingIndex = -1;
                  let maxUnderperformance = 0;

                  chartData.forEach((item, index) => {
                    const actual = item.ACTUAL_TMT_SALES || 0;
                    const historical = item.ACTUAL_HISTORY_TMT_SALES || 0;
                    const target = item.TARGET_TMT_SALES || 0;

                    // Calculate underperformance based on the lowest percentage compared to historical/target
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

                            {/* Display red indicator only for the most underperforming actual sales bar */}
                            {key === "A" && mostUnderperformingIndex !== -1 && (
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
                            )}
                          </Bar>
                        )
                      );
                    }
                  );
                })()}
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>

          {/* Drill Indicator */}
          <div className="flex items-center justify-center">
            <DrillIndicator
              drillLevel={drillLevel}
              drillHistory={drillHistory}
              selectedYorM={selectedYorM}
            />
          </div>
        </div>
      </div>
    </div>
  );

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
          value: selectedSBU,
          cond: "=",
        }
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
    [selectedSBU]
  );

  const handleSwitchChange = async (checked: boolean) => {
    setIsSwitchOn(checked) // Set state when switch is toggled
    const response = await loadDistinctValues(["ProductName"]);
    const transformedData = response['ProductName'].map(item => ({
      name: item,
      id: item
    }));
    console.log("transformedData", transformedData);
    setProductList(transformedData);
    setProductName(["HSD"]);
  }

  const handleProductSelect = (products: string[]) => {
    const productListString = products.join(",");
    setCustomProductName(productListString);
    setSelectedProductName(productListString);
    setProductName(products);
    if (products.length === 1 && drillLevel > 2) {
      setAppliedFilters((prev) => [...prev, { key: '"ProductName"', cond: "equals", value: productListString }]);
      setCrossFilters((prev) => [...prev, { key: '"ProductName"', cond: "equals", value: productListString }]);
    } else if (products.length > 1 && drillLevel > 2) {
      setAppliedFilters((prev) => [...prev, { key: '"ProductName"', cond: "in", value: productListString }]);
      setCrossFilters((prev) => [...prev, { key: '"ProductName"', cond: "in", value: productListString }]);
    }
    // else {
    //   setAppliedFilters((prev) => [...prev, { key: '"ProductName"', cond: "equal", value: productListString }]);
    // }
  }

  // useEffect(() => {
  //   drillLevel < 2 && customProductName.length > 0 && handleProductSelect([]);
  // }, [drillLevel]);

  const handleYearChange = (value: string) => {
    const formattedYear = `FY ${value}`
    setSelectedYear(value)

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
    setAppliedFilters((prev) => {
      const withoutFy = prev.filter((f) => f.key !== '"fiscal_year"')
      return [...withoutFy, { key: '"fiscal_year"', cond: "equals", value: value }]
    })
    setDrillHistory((prev) => [formattedYear, ...prev.slice(1)])
  }


  const isDisabled = mode === "ytd";


  return (
    <>
      <Card className="w-full bg-white rounded-lg border border-gray-200 pt-2 px-2">
        {isLoading && <ApiLoader loading={isLoading} />}
        <div className="mt-1 mb-2">
          <CardHeader className="p-1">
            <div className="flex flex-col gap-2">
              <div className="flex gap-4 justify-between items-start">
                <span className="flex items-center text-sm font-extrabold flex-wrap gap-1">
                  Sales Performance (Drill-Down) - {selectedYear}
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
                {/* All Buttons Group */}

                <TooltipProvider>
                  <div className="flex gap-1">
                    {/* { drillLevel > 1 && 
                      <Tooltip>
                        <TooltipTrigger className="">
                          <div className="flex items-center space-x-2">
  <Switch
    id="switch-product"
    className="py-2 h-6 data-[state=checked]:bg-teal-600"
    checked={isSwitchOn}
    onCheckedChange={handleSwitchChange}
    disabled
  />
  {!isSwitchOn ? (
    <Label className="my-auto text-xs font-semibold">Show Products</Label>
  ) : (
    <Label className="my-auto font-semibold">Hide Products</Label>
  )}
</div>
                          <div className="flex items-center space-x-2">
                            <Switch id="switch-product" className="py-2 h-6 data-[state=checked]:bg-teal-600" checked={isSwitchOn} onCheckedChange={handleSwitchChange} />
                            {!isSwitchOn ? <Label className="my-auto text-xs font-semibold">Show Products</Label> : <Label className="my-auto font-semibold">Hide Products</Label>}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Enable to select the products</p>
                        </TooltipContent>
                      </Tooltip>
                    } */}
                    {isSwitchOn && drillLevel > 1 && (
                      <div className="">
                        <CustomMultiSelect
                          options={productList}
                          onValueChange={handleProductSelect}
                          maxCount={0}
                          defaultValue={["HSD", "MS"]}
                          placeholder="Select products"
                          variant="default"
                          clearFiltervalue={selectedMonths}
                          className="w-auto min-h-7 h-8 p-1 text-xs text-black shadow-none border-gray-300 ml-2"
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
                        disabled={
                          crossFilters.length > 0 && selectedYorM !== "Y"
                        } // Disable if crossFilters length > 0 and "Y" isn't selected
                      >
                        Year
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        className="rounded-none h-8 shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 data-[state=on]:bg-teal-600 data-[state=on]:text-white"
                        value="M"
                        disabled={
                          crossFilters.length > 0 && selectedYorM !== "M"
                        } // Disable if crossFilters length > 0 and "M" isn't selected
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
                            {
                              haButtonsData[key as keyof typeof haButtonsData]
                                .title
                            }
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {
                              haButtonsData[key as keyof typeof haButtonsData]
                                .name
                            }
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {/* Target Button */}
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
                            {
                              tButtonsData[key as keyof typeof tButtonsData]
                                .title
                            }
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

                    <div className="flex items-center mx-1">
                      <Select value={selectedYear} onValueChange={handleYearChange}>
                        <SelectTrigger className="w-32 h-8 text-xs font-semibold border-[1.5px]">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={currentFY}>{currentFY}</SelectItem>
                          <SelectItem value={previousFY}>{previousFY}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TooltipProvider>
              </div>
              <div className="flex">
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
              {/* Chart Title */}
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

            </div>
          </CardHeader>

          {/* Drill History Badges */}
          <div className="w-full flex justify-center mb-0">
            <DrillIndicator
              drillLevel={drillLevel}
              drillHistory={drillHistory}
              selectedYorM={selectedYorM}
            />
          </div>
          {/* Chart Content */}

          <CardContent className="grid lg:grid-cols-3 md:grid-cols-1 sm:grid-cols-1 grid-col-1 gap-4 px-2 py-0">
            <div className="md:col-span-2 lg:col-span-2">
              <div className="h-[470px] sm:w-sm md:w-md">
                {chartApiMessage ? (
                  <div className="flex h-full items-center justify-center rounded-lg bg-gray-50 px-4">
                    <p className="text-center text-sm font-medium text-gray-600">{chartApiMessage}</p>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 40, right: 10, left: 10, bottom: 20 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={<CustomXAxisTick />}
                      height={80}
                      interval={0}
                      onClick={handleBarClick}
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
                    {chartData && chartData.length > 7 && drillLevel !== 6 && (
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

                      chartData.forEach((item, index) => {
                        const actual = item.ACTUAL_TMT_SALES || 0;
                        const historical = item.ACTUAL_HISTORY_TMT_SALES || 0;

                        // Calculate underperformance based on the actual sales vs historical sales
                        const underperformance =
                          Number(historical) > 0
                            ? (Number(historical) - Number(actual)) / Number(historical)
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
                                {key === "A" &&
                                  mostUnderperformingIndex !== -1 && drillLevel > 2 && (
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
      </Card>
      {isExpanded && <ExpandedChart />}
    </>
  );
};

export default MarketingSummary;