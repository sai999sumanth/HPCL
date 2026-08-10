import React, { useState, useCallback, useEffect } from "react"
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/@/components/ui/card"
import { IconArrowLeft, IconMaximize, IconMinimize, IconRestore } from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip"
import { toast } from "sonner"
import { fetchChartData, fetchDistinctValues } from "../api"
import dayjs from "dayjs"
import {
  getIndianFiscalYearMeta,
  getDefaultFiscalYearDropdownValue,
  parseFiscalYearLabel,
  getPreviousFYSbuDateRangeDefaults,
  getIndianFiscalYearFullRangeDisplay,
} from "@/utils/fiscalYearUtils"
import convertToFilters from "@/utils/dynamicFilter"
import ZoneWiseFilterMenu from "./ZoneWiseFilterMenu"
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import { Calendar } from "lucide-react"
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
  A: { color: "#6366f1", name: "Actual", title: "Act" },
  H: { color: "#06b6d4", name: "Historical", title: "Hist" },
  T: { color: "#f59e0b", name: "Target", title: "Tgt" },
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

const getXAxisKey = (drillLevel: number, selected: "Y" | "M", hasSbu = false): string => {
  const keys =
    selected === "Y"
      ? hasSbu
        ? ["cumulative", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name"]
        : ["cumulative", "SBU_Name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name"]
      : hasSbu
        ? ["month_name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name"]
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
  hasSbu = false,
): ChartData[] => {
  if (!responseData) return []
  const validSelected: "Y" | "M" = selected === "M" ? "M" : "Y"
  const isArray = Array.isArray(responseData)
  const xAxisKey = getXAxisKey(drillLevel, validSelected, hasSbu)

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
      <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-gray-100">
        <p className="font-bold text-gray-800 mb-2 text-sm border-b border-gray-100 pb-1.5">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => {
            const formattedValue =
              entry.value < 10
                ? entry.value.toFixed(2)
                : Math.round(entry.value).toLocaleString()

            return (
              <div key={index} className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-gray-600">{entry.name}</span>
                </div>
                <span className="font-bold text-gray-800">{formattedValue}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  return null
}


const getInitialDrilldownList = (selectedYorM: "Y" | "M", hasSbu = false) => {
  return selectedYorM === "Y"
    ? hasSbu
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
        { key: "SBU_Name", isActive: false, drillLevel: 2 },
        { key: "ProductName", isActive: false, drillLevel: 3 },
        { key: "Zone_Name", isActive: false, drillLevel: 4 },
        { key: "Region_Name", isActive: false, drillLevel: 5 },
        { key: "SalesArea_Name", isActive: false, drillLevel: 6 },
        { key: "month_name", isActive: false, drillLevel: 7 },
      ]
    : hasSbu
      ? [
        { key: "month_name", isActive: false, drillLevel: 1 },
        { key: "ProductName", isActive: false, drillLevel: 2 },
        { key: "Zone_Name", isActive: false, drillLevel: 3 },
        { key: "Region_Name", isActive: false, drillLevel: 4 },
        { key: "SalesArea_Name", isActive: false, drillLevel: 5 },
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

const WrappedXAxisTick = ({ x, y, payload, barCount = 0 }: any) => {
  const raw = (payload.value as string).replace(/_/g, " ");
  // Tighter wrapping when many bars or long names to prevent horizontal overlap
  const maxPerLine = barCount > 8 ? 8 : raw.length > 12 ? 9 : 10;
  const words = raw.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxPerLine && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={0} dy={14 + i * 12} textAnchor="middle"
          fill="#6b7280" fontSize={9}>
          {line}
        </text>
      ))}
    </g>
  );
};

const SalesPerformanceDrillDown: React.FC<{ sbu?: string }> = ({ sbu }) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  let [drillLevel, setDrillLevel] = useState(0);
  // const [filters, setFilters] = useState<Filter[]>([
  //   { key: '"A"', cond: "equals", value: "true" },
  //   { key: '"H"', cond: "equals", value: "true" },
  // ]);
  const [chartType, setChartType] = useState('bar');

  const [filters, setFilters] = useState<FilterState>({
    SBU_Name: sbu ?? '',
    Zone_Name: '',
    Region_Name: '',
    SalesArea_Name: '',
    ProductName: '',
  });

  const [distinctFilters, setDistinctFilters] = useState<FilterState>({
    SBU_Name: sbu ?? '',
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
  const [appliedFilters, setAppliedFilters] = useState<FilterOption[]>(() => {
    const base = convertToFilters({ A: true, H: true, T: true, C: true });
    if (sbu) return [...base, { key: '"SBU_Name"', cond: "equals", value: sbu }];
    return base;
  });
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
  let [selectedSBU, setSelectedSBU] = useState(sbu ?? "");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSalesArea, setSelectedSalesArea] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");

  const [sbuOptions, setSbuOptions] = useState<string[]>([]);
  const [zoneOptions, setZoneOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [salesAreaOptions, setSalesAreaOptions] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<string[]>([]);

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
  let [drilldownList, setDrilldownList] = useState(getInitialDrilldownList(selectedYorM, !!sbu));

  useEffect(() => {
    setDrilldownList(getInitialDrilldownList(selectedYorM, !!sbu));
  }, [selectedYorM, selectedSBU]);

  // Load SBU options on mount for ZoneWiseFilterMenu
  useEffect(() => {
    if (sbu) {
      // When SBU is locked, load dependent options scoped to that SBU
      loadDistinctValues(
        ["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"],
        [{ key: "SBU_Name", cond: "=", value: sbu }],
      ).then((res) => {
        if (res?.["Zone_Name"])      setZoneOptions(res["Zone_Name"]);
        if (res?.["Region_Name"])    setRegionOptions(res["Region_Name"]);
        if (res?.["SalesArea_Name"]) setSalesAreaOptions(res["SalesArea_Name"]);
        if (res?.["ProductName"])    setProductOptions(res["ProductName"]);
      }).catch(() => {});
    } else {
      loadDistinctValues(["SBU_Name"]).then((res) => {
        if (res?.["SBU_Name"]) setSbuOptions(res["SBU_Name"]);
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      const hasSbuFilter = originalFilter.some((filter) => filter.key === '"SBU_Name"')
      const sbuFilterEntry = sbu ? [{ key: '"SBU_Name"', cond: "equals", value: sbu }] : []
      let filtersToSend = hasYearFilter ? originalFilter : [...originalFilter, fiscalYearFilter]
      if (sbu && !hasSbuFilter) {
        filtersToSend = [...sbuFilterEntry, ...filtersToSend]
      }
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
          selectedYorM,
          !!sbu
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
      const maxYLevel = sbu ? 5 : 6;
      const maxMLevel = sbu ? 4 : 5;
      if (selectedYorM === "Y" && drillLevel >= maxYLevel) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      } else if (selectedYorM === "M" && drillLevel >= maxMLevel) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      }
      drillLevel === (sbu ? 1 : 2) && (setProductName([entry.name]))
      if (!sbu && drillLevel === 1) {
        setAppliedFilters((prev) => [...prev.filter((ele) => ele.key !== '"ProductName"')]);
        setIsSwitchOn(false);
        setProductList([]);
      }
      newFilters = [...appliedFilters];
      const filterKeys =
        selectedYorM === "Y"
          ? sbu
            ? ["cumulative", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name"]
            : ["cumulative", "SBU_Name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name", "month_name"]
          : sbu
            ? ["month_name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name"]
            : ["month_name", "SBU_Name", "ProductName", "Zone_Name", "Region_Name", "SalesArea_Name"];

      newCrossFilters = [...crossFilters];
      const isCumulative = drillLevel === 0 && selectedYorM === "Y";
      if (isCumulative && sbu) {
        // For SBU-wise pages, on cumulative click seed cross_filters with SBU + sbu_wise flag
        newCrossFilters = [
          { key: '"SBU_Name"', cond: "equals", value: sbu },
          { key: '"sbu_wise"', cond: "equals", value: "true" },
        ];
      } else if (isCumulative && !sbu) {
        // For general Sales Performance page, push cumulative flag to cross_filters
        newCrossFilters = [
          { key: '"cumulative"', cond: "equals", value: "true" },
        ];
      } else if (!isCumulative) {
        newCrossFilters.push({
          key: `"${filterKeys[drillLevel]}"`,
          cond: "equals",
          value: entry.name ?? entry?.value,
        });
      }
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
      setDrillHistory([...drillHistory, entry.name ?? entry?.value]);
      syncWithDropdowns(filterKeys[drillLevel], entry.name ?? entry?.value);
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

    // Define filter order based on drill levels (skip SBU when locked)
    const drillDownOrder = sbu
      ? ['"cumulative"', '"ProductName"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"', '"month_name"']
      : ['"cumulative"', '"SBU_Name"', '"ProductName"', '"Zone_Name"', '"Region_Name"', '"SalesArea_Name"'];

    // Find the current drill level filter to remove
    const currentDrillFilter = drillDownOrder[drillLevel - 1];

    // Special case for SBU-wise page: going back from Product to Cumulative clears sbu_wise cross filters
    if (sbu && currentDrillFilter === '"cumulative"') {
      const updatedCrossFilters = crossFilters.filter(
        f => f.key !== '"SBU_Name"' && f.key !== '"sbu_wise"'
      );
      setCrossFilters(updatedCrossFilters);
      setAppliedFilters(appliedFilters);
      setDrillLevel(prev => prev - 1);
      setDrillHistory(prev => [...prev.slice(0, -1)]);
      return;
    }

    // Special case: When moving back from Product to SBU, add cumulative
    if (!sbu && currentDrillFilter === '"SBU_Name"') {
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

    setSelectedYorM("Y");
    const statesYear: ActiveStates = { ...activeStates, C: true };
    setActiveStates(statesYear);
    const resetFilter = [
      {
        "key": "\"YTD\"",
        "cond": "equals",
        "value": "true"
      }
    ];
    const sbuFilter = sbu ? [{ key: '"SBU_Name"', cond: "equals", value: sbu }] : [];
    const fiscalYearFilter = { key: '"fiscal_year"', cond: "equals", value: selectedYear };
    const perspectiveFiltersYear = convertToFilters(statesYear);
    setDrillLevel(0);
    setMode("ytd");
    setDrilldownList(getInitialDrilldownList("Y", !!sbu));
    setAppliedFilters([...resetFilter, ...perspectiveFiltersYear, ...sbuFilter, fiscalYearFilter]);
    setCrossFilters([]);
    // setSelectedYear("2025-2026");
    setSelectedMonth("");
    setSelectedSBU(sbu ?? "");
    setSelectedZone("");
    setSelectedRegion("");
    setSelectedSalesArea("");
    setSelectedProductName("");
    setFilters({
      SBU_Name: sbu ?? '',
      Zone_Name: '',
      Region_Name: '',
      SalesArea_Name: '',
      ProductName: '',
    });
    setDrillHistory(mode === "month" ? [`FY ${selectedYear}`] : []);
    setSelectedMonths([]);
    setIsSwitchOn(false);
    // setHeadingDate(`${newFromDate.format("MMMM D")}, ${newFromDate.format("YYYY")} to ${newToDate.format("MMMM D")}, ${newToDate.format("YYYY")}`);

    // await loadDistinctValues(["SBU_Name"], []);
  }, [mode, filters, appliedFilters, crossFilters, selectedYear, sbu, activeStates]);

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
    // load dependent options after SBU change
    try {
      const response = await loadDistinctValues(
        ["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"],
        distinctFilterChange("SBU_Name", value),
      );
      if (response) {
        setZoneOptions(response["Zone_Name"] ?? []);
        setRegionOptions(response["Region_Name"] ?? []);
        setSalesAreaOptions(response["SalesArea_Name"] ?? []);
        setProductOptions(response["ProductName"] ?? []);
      }
    } catch {}
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
      <div className="flex flex-wrap gap-3 ml-2">
        {Object.entries(categoryData)
          .filter(([key]) => activeStates[key as keyof ActiveStates])
          .map(([key, { color, name }]) => (
            <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-full">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-gray-700">{name}</span>
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
    const isSpecialSBU = selectedSBU === "Aviation" || selectedSBU === "GAS" || selectedSBU === "PETCHEM";

    const states =
      sbu
        ? selectedYorM === "Y"
          ? ["Cumulative", "Product", "Zone", "Region", "Sales Area", "Month Name"]
          : ["Month Name", "Product", "Zone", "Region", "Sales Area"]
        : selectedYorM === "Y"
          ? isSpecialSBU
            ? ["Cumulative", "SBU", "Product", "Month Name"]
            : ["Cumulative", "SBU", "Product", "Zone", "Region", "Sales Area", "Month Name"]
          : isSpecialSBU
            ? ["Month Name", "SBU", "Product"]
            : ["Month Name", "SBU", "Product", "Zone", "Region", "Sales Area"];

    const getInitialDrilldownList = (ym: "Y" | "M") => {
      if (sbu) {
        return ym === "Y"
          ? [
              { key: "cumulative",     drillLevel: 1 },
              { key: "ProductName",    drillLevel: 2 },
              { key: "Zone_Name",      drillLevel: 3 },
              { key: "Region_Name",    drillLevel: 4 },
              { key: "SalesArea_Name", drillLevel: 5 },
              { key: "month_name",     drillLevel: 6 },
            ]
          : [
              { key: "month_name",     drillLevel: 1 },
              { key: "ProductName",    drillLevel: 2 },
              { key: "Zone_Name",      drillLevel: 3 },
              { key: "Region_Name",    drillLevel: 4 },
              { key: "SalesArea_Name", drillLevel: 5 },
            ];
      }
      if (ym === "Y") {
        return isSpecialSBU
          ? [
              { key: "cumulative", drillLevel: 1 },
              { key: "SBU_Name",   drillLevel: 2 },
              { key: "ProductName",drillLevel: 3 },
              { key: "month_name", drillLevel: 4 },
            ]
          : [
              { key: "cumulative",    drillLevel: 1 },
              { key: "SBU_Name",      drillLevel: 2 },
              { key: "ProductName",   drillLevel: 3 },
              { key: "Zone_Name",     drillLevel: 4 },
              { key: "Region_Name",   drillLevel: 5 },
              { key: "SalesArea_Name",drillLevel: 6 },
              { key: "month_name",    drillLevel: 7 },
            ];
      }
      return isSpecialSBU
        ? [
            { key: "month_name", drillLevel: 1 },
            { key: "SBU_Name",   drillLevel: 2 },
            { key: "ProductName",drillLevel: 3 },
          ]
        : [
            { key: "month_name",    drillLevel: 1 },
            { key: "SBU_Name",      drillLevel: 2 },
            { key: "ProductName",   drillLevel: 3 },
            { key: "Zone_Name",     drillLevel: 4 },
            { key: "Region_Name",   drillLevel: 5 },
            { key: "SalesArea_Name",drillLevel: 6 },
          ];
    };

    const list = getInitialDrilldownList(selectedYorM as "Y" | "M").map((drill) => ({
      ...drill,
      isActive: drill.key === "cumulative" && sbu
        ? crossFilters.some((f) => f.key.replace(/"/g, "") === "sbu_wise")
        : crossFilters.some((f) => f.key.replace(/"/g, "") === drill.key),
    }));

    return (
      <div className="flex items-center justify-center px-4 py-2 w-full overflow-x-auto">
        <div className="flex items-center gap-0 min-w-0">
          {list.map((drill, index) => {
            const isDone    = drill.isActive;
            const isCurrent = !isDone && index > 0 && list[index - 1]?.isActive;
            const isFirst   = index === 0 && !isDone && !list.some((d) => d.isActive);

            const nodeBase  = "relative z-10 flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0 transition-all duration-200";
            const nodeStyle = isDone
              ? `${nodeBase} bg-teal-500 text-white shadow-md shadow-teal-200`
              : isCurrent || isFirst
                ? `${nodeBase} bg-white border-2 border-teal-500 text-teal-600`
                : `${nodeBase} bg-gray-100 border border-gray-300 text-gray-400`;

            const labelStyle = isDone
              ? "text-[10px] font-semibold text-teal-600 mt-1 whitespace-nowrap"
              : isCurrent || isFirst
                ? "text-[10px] font-semibold text-teal-500 mt-1 whitespace-nowrap"
                : "text-[10px] text-gray-400 mt-1 whitespace-nowrap";

            const lineStyle = isDone && index < list.length - 1 && list[index + 1]?.isActive
              ? "flex-1 h-[2px] bg-teal-400 min-w-[24px] max-w-[56px] mx-1 rounded-full transition-all duration-200"
              : index < list.length - 1
                ? "flex-1 h-[2px] bg-gray-200 min-w-[24px] max-w-[56px] mx-1 rounded-full"
                : "";

            return (
              <React.Fragment key={drill.key}>
                <div className="flex flex-col items-center">
                  <div className={nodeStyle}>
                    {isDone ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7l3.5 3.5 5.5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span className={labelStyle}>{states[index]}</span>
                </div>
                {index < list.length - 1 && (
                  <div className={`${lineStyle} mb-4`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

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
                    <PopoverTrigger asChild>
                      <Button
                        className={`border w-8 h-8 p-0 text-xs ${mode === "date"
                          ? "bg-teal-600 text-white"
                          : "bg-white text-black"
                          }`}
                      >
                        <Calendar strokeWidth={1} className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 shadow-lg border border-gray-200 rounded-lg" align="end">
                      <div className="flex flex-col gap-3">
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
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 10, bottom: xAxisBottomMargin }}
                onClick={(data) => data?.activePayload?.[0]?.payload && handleBarClick(data.activePayload[0].payload)}
                barCategoryGap="25%"
                barGap={2}
              >
                <defs>
                  <linearGradient id="glassActualExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1}/>
                    <stop offset="40%" stopColor="#6366f1" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#4338ca" stopOpacity={0.85}/>
                  </linearGradient>
                  <linearGradient id="glassHistExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                    <stop offset="40%" stopColor="#06b6d4" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#0891b2" stopOpacity={0.85}/>
                  </linearGradient>
                      <linearGradient id="glassTargetExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fcd34d" stopOpacity={1}/>
                        <stop offset="40%" stopColor="#f59e0b" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.85}/>
                      </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={<WrappedXAxisTick barCount={barCount} />}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  interval={0}
                  height={xAxisHeight}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatNumber}
                  label={{
                    value: `Sales (${salesUnit})`,
                    angle: -90,
                    position: "insideLeft",
                    fill: "#6b7280",
                    fontSize: 11,
                  }}
                  width={60}
                />
                <RechartTooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                />
                {activeStates.A && (
                  <Bar
                    dataKey="ACTUAL_TMT_SALES"
                    name="Actual"
                    fill="url(#glassActualExp)"
                    stroke="#6366f1"
                    strokeWidth={0.5}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                )}
                {activeStates.H && (
                  <Bar
                    dataKey="ACTUAL_HISTORY_TMT_SALES"
                    name="Historical"
                    fill="url(#glassHistExp)"
                    stroke="#06b6d4"
                    strokeWidth={0.5}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                )}
                {activeStates.T && (
                  <Bar
                    dataKey="TARGET_TMT_SALES"
                    name="Target"
                    fill="url(#glassTargetExp)"
                    stroke="#f59e0b"
                    strokeWidth={0.5}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                )}
              </ComposedChart>
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

  const maxLabelLength = chartData.reduce((max: number, d: any) => Math.max(max, (d.name || "").length), 0);
  const barCount = chartData.length;
  const maxPerLine = barCount > 8 ? 8 : maxLabelLength > 12 ? 9 : 10;
  const estimatedLines = Math.ceil(maxLabelLength / maxPerLine);
  const xAxisHeight = 16 + estimatedLines * 14;
  const xAxisBottomMargin = barCount > 8 ? 10 : 4;
  const currentXAxisKey = getXAxisKey(drillLevel, selectedYorM, !!sbu);
  const isZoneDrill = currentXAxisKey === "Zone_Name";
  const chartMinWidth = isZoneDrill && barCount > 6 ? `${barCount * 80}px` : "100%";
  // Compute Y domain from all active series so overlay Y-axis matches scrollable chart
  const yMax = chartData.reduce((max: number, d: any) => {
    const vals = [
      activeStates.A ? (d.ACTUAL_TMT_SALES ?? 0) : 0,
      activeStates.H ? (d.ACTUAL_HISTORY_TMT_SALES ?? 0) : 0,
      activeStates.T ? (d.TARGET_TMT_SALES ?? 0) : 0,
    ];
    return Math.max(max, ...vals);
  }, 0);
  const yDomain: [number, number] = [0, yMax > 0 ? Math.ceil(yMax * 1.1) : 10];


  return (
    <>
      <Card className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="mt-0 mb-2">
          <CardHeader className="p-3 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
            <div className="flex flex-col gap-2">
              <div className="flex gap-4 justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">
                    {sbu ? `${sbu} Performance (Drill-Down)` : "Sales Performance (Drill-Down)"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {selectedYear}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-gray-100 text-gray-600">
                    {mode === "date" && fromDate && toDate
                      ? `${dayjs(fromDate).format("DD-MMM-YYYY")} to ${dayjs(toDate).format("DD-MMM-YYYY")}`
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
                {/* All Buttons Group */}

                <TooltipProvider>
                  <div className="flex items-center gap-1.5">
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
                          className="w-auto min-h-7 h-7 p-1 text-xs text-black shadow-none border-gray-200 rounded-lg"
                        />
                      </div>
                    )}
                    <ToggleGroup
                      variant="outline"
                      className="inline-flex gap-0 rounded-lg border border-gray-200 bg-white"
                      type="single"
                      value={selectedYorM}
                      onValueChange={(val: any) => {
                        if (val) {
                          setSelectedYorM(val);
                          setAppliedFilters((prevFilters: any) => {
                            if (val === "Y") {
                              const newFilters = convertToFilters({
                                ...activeStates,
                                C: true,
                              });
                              const filteredPrevFilters = prevFilters.filter(
                                (filter: any) => filter.key !== '"C"'
                              );
                              return [...filteredPrevFilters, ...newFilters];
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

                    {Object.keys(haButtonsData).map((key) => (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={activeStates[key as keyof ActiveStates] ? "default" : "outline"}
                            className={`h-7 w-7 p-0 text-xs font-semibold rounded-lg transition-all ${
                              activeStates[key as keyof ActiveStates]
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
                    {Object.keys(tButtonsData).map((key) => (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={activeStates[key as keyof ActiveStates] ? "default" : "outline"}
                            className={`h-7 w-7 p-0 text-xs font-semibold rounded-lg transition-all ${
                              activeStates[key as keyof ActiveStates]
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

                    <Button
                      variant={mode === "ytd" ? "default" : "outline"}
                      onClick={() => handleModeChange("ytd")}
                      className={`h-7 px-2.5 text-xs font-semibold rounded-lg transition-all ${
                        mode === "ytd"
                          ? "bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                          : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                      }`}
                    >
                      YTD
                    </Button>

                    <div className="flex gap-1">
                      <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                        <PopoverTrigger disabled={mode === "ytd"} asChild>
                          <div className="inline-block">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    className={`h-7 w-7 p-0 rounded-lg transition-all ${
                                      isDisabled
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                                        : mode === "date"
                                          ? "bg-teal-600 text-white border-teal-600"
                                          : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                                    }`}
                                    disabled={isDisabled}
                                  >
                                    <Calendar strokeWidth={1.5} className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-sm px-2 py-1">
                                  {isDisabled ? "Deselect YTD to use date filter" : "Open date picker"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3 shadow-lg border border-gray-200 rounded-lg" align="end">
                          <div className="flex flex-col gap-3">
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

                    {drillLevel > 0 && (
                      <Button
                        onClick={handleBackClick}
                        className="h-7 w-7 p-0 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm"
                      >
                        <IconArrowLeft stroke={2} className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      onClick={resetFilters}
                      className="h-7 w-7 p-0 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm"
                    >
                      <IconRestore stroke={2} className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={toggleExpand}
                      className="h-7 w-7 p-0 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm"
                    >
                      {isExpanded ? (
                        <IconMinimize stroke={2} className="h-3.5 w-3.5" />
                      ) : (
                        <IconMaximize stroke={2} className="h-3.5 w-3.5" />
                      )}
                    </Button>

                    <Select value={selectedYear} onValueChange={handleYearChange}>
                      <SelectTrigger className="w-28 h-7 text-xs font-semibold border-gray-200 rounded-lg bg-white">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={currentFY}>{currentFY}</SelectItem>
                        <SelectItem value={previousFY}>{previousFY}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipProvider>
              </div>
              {drillLevel > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {drillHistory.map((item, index) => (
                    <Badge
                      className="py-0.5 px-2 text-[10px] font-medium"
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

          {/* Drill History Badges */}
          <div className="w-full flex justify-center mb-0">
            <DrillIndicator
              drillLevel={drillLevel}
              drillHistory={drillHistory}
              selectedYorM={selectedYorM}
            />
          </div>
          {/* Chart Content */}

          <CardContent className="grid lg:grid-cols-3 md:grid-cols-1 sm:grid-cols-1 grid-col-1 gap-4 px-3 py-2">
            <div className="md:col-span-2 lg:col-span-2">
              <div className="h-[450px] bg-gradient-to-br from-gray-50/50 to-white rounded-xl border border-gray-100 p-3 relative">
                {isLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm z-10">
                    <svg className="h-7 w-7 animate-spin text-indigo-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-xs text-gray-500 font-medium">Loading chart…</span>
                  </div>
                ) : chartApiMessage ? (
                  <div className="flex h-full items-center justify-center rounded-lg bg-gray-50 px-4">
                    <p className="text-center text-sm font-medium text-gray-600">{chartApiMessage}</p>
                  </div>
                ) : (
                <div className="relative w-full h-full">
                  {/* Sticky legend — sits above both Y-axis overlay and scrollable chart */}
                  {isZoneDrill && barCount > 6 && (
                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center gap-4 bg-gradient-to-br from-gray-50/50 to-white" style={{ height: 36 }}>
                      {activeStates.A && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-600">
                          <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill="#6366f1" /></svg>Actual
                        </span>
                      )}
                      {activeStates.H && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-600">
                          <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill="#06b6d4" /></svg>Historical
                        </span>
                      )}
                      {activeStates.T && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-600">
                          <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill="#f59e0b" /></svg>Target
                        </span>
                      )}
                    </div>
                  )}
                  {/* Sticky Y-axis — rendered as fixed overlay on the left */}
                  {isZoneDrill && barCount > 6 && (
                    <div className="absolute top-0 left-0 h-full z-10 pointer-events-none bg-gradient-to-br from-gray-50/50 to-white" style={{ width: 58 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 20 + 36, right: 0, left: 0, bottom: xAxisBottomMargin + xAxisHeight }}
                        >
                          <YAxis
                            tick={{ fill: "#6b7280", fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={formatNumber}
                            width={58}
                            domain={yDomain}
                          />
                          <Bar dataKey="ACTUAL_TMT_SALES" fill="none" stroke="none" legendType="none" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* Scrollable chart area */}
                  <div
                    className="w-full h-full overflow-x-auto overflow-y-hidden"
                    style={{ paddingLeft: isZoneDrill && barCount > 6 ? 58 : 0 }}
                  >
                    <div style={{ minWidth: "100%", width: chartMinWidth, height: "100%" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{ top: isZoneDrill && barCount > 6 ? 20 + 36 : 20, right: 20, left: 0, bottom: xAxisBottomMargin }}
                          onClick={(data) => data?.activePayload?.[0]?.payload && handleBarClick(data.activePayload[0].payload)}
                          barCategoryGap="25%"
                          barGap={2}
                        >
                    <defs>
                      <linearGradient id="glassActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={1}/>
                        <stop offset="40%" stopColor="#6366f1" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#4338ca" stopOpacity={0.85}/>
                      </linearGradient>
                      <linearGradient id="glassHist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                        <stop offset="40%" stopColor="#06b6d4" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#0891b2" stopOpacity={0.85}/>
                      </linearGradient>
                      <linearGradient id="glassTarget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fcd34d" stopOpacity={1}/>
                        <stop offset="40%" stopColor="#f59e0b" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.85}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={<WrappedXAxisTick barCount={barCount} />}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                      interval={0}
                      height={xAxisHeight}
                    />
                          {/* Hide Y-axis in scrollable chart when sticky Y-axis overlay is active */}
                          {isZoneDrill && barCount > 6 ? (
                            <YAxis hide width={0} domain={yDomain} />
                          ) : (
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatNumber}
                      width={50}
                      domain={yDomain}
                    />
                          )}
                    <RechartTooltip content={<CustomTooltip />} />
                    {!(isZoneDrill && barCount > 6) && (
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                    />
                    )}
                    {activeStates.A && (
                      <Bar
                        dataKey="ACTUAL_TMT_SALES"
                        name="Actual"
                        fill="url(#glassActual)"
                        stroke="#6366f1"
                        strokeWidth={0.5}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                    )}
                    {activeStates.H && (
                      <Bar
                        dataKey="ACTUAL_HISTORY_TMT_SALES"
                        name="Historical"
                        fill="url(#glassHist)"
                        stroke="#06b6d4"
                        strokeWidth={0.5}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                    )}
                    {activeStates.T && (
                      <Bar
                        dataKey="TARGET_TMT_SALES"
                        name="Target"
                        fill="url(#glassTarget)"
                        stroke="#f59e0b"
                        strokeWidth={0.5}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                    )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                )}
              </div>

            </div>
            <div className="relative">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm z-10">
                  <svg className="h-6 w-6 animate-spin text-indigo-500 mb-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-xs text-gray-500 font-medium">Loading…</span>
                </div>
              )}
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

export default SalesPerformanceDrillDown;