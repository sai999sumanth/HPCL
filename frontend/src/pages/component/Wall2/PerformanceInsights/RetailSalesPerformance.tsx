import React from "react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { IconArrowLeft, IconMaximize, IconMinimize, IconRestore } from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { toast } from "sonner";
import { Stepper, Step, StepLabel } from "@mui/material";
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
import { RetailSalesDropdowns, SalesDropdowns } from "../SalesDropdowns";
import TablePerformancesales from "../TablePerformancesales";
import { fetchChartData, fetchDistinctValues } from "../api";
import { format, startOfMonth, subDays } from "date-fns";
import RetailSalesPerformanceTable from "./retailPerformanceTable";
import IndividualData from "./individualData";
import IndividualDataPercentage from "./individualDataPercentage";
import { Separator } from "@/@/components/ui/separator";
import RegionPerformanceTable from "./region/regionPerformanceTable";
import RegionIndividualData from "./region/regionIndividualData";
import RegionIndividualDataPercentage from "./region/regionPercentage";
import SalesAreaPerformanceTable from "./salesarea/salesareaTable";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/@/components/ui/breadcrumb";
import SalesAreaIndividualDataPercentage from "./salesarea/salesareaPercentage";
import SalesAreaIndividualData from "./salesarea/salesareaIndividual";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Calendar, Loader2, RefreshCcw } from "lucide-react";
import IndividualAvsTPercentage from "./IndividualAvsTPercentage";
import RegionAvsT from "./region/regionAvsT";
import RegionAvsTPercentage from "./region/regionAvsTpercentage";
import SalesAreaAvsT from "./salesarea/salesareaAvsT";
import SalesAreaAvsTPercentage from "./salesarea/salesareaAvsTPercentage";
import IndividualAvsT from "./IndividualAvsT";
import { ToggleGroup, ToggleGroupItem } from "@/@/components/ui/toggle-group";
import ZoneAvsHHeatmap from "./zone-heatmap/zone-heatmap-avsh";
import ZoneAvsTHeatmap from "./zone-heatmap/zone-heatmap-avst";
import RegionHeatmap from "./region-heatmap/RegionHeatmap";
import SalesAreaHeatmap from "./salesarea-heatmap/SalesAreaHeatmap";
import DrillDownComponent from "./sbu-wise-performance/Drill-down-component";
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";

interface ChartData {
  name: string;
  [key: string]: number | string;
}

type ChartMode = "month" | "year" | "ytd" | "date" | "";

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

/** India FY: Apr–Mar, label "YYYY-(YYYY+1)". */
const FY_START_MONTH = 3;

/** Avoid new array identity when parallel heatmap APIs return the same axis labels (prevents chart remount flicker). */
function keepPreviousIfEqual<T>(prev: T, next: T | undefined | null): T {
  if (next === undefined || next === null) return prev;
  if (Object.is(prev, next)) return prev;
  if (typeof next === "object" && next !== null && typeof prev === "object" && prev !== null) {
    try {
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
    } catch {
      /* ignore */
    }
  }
  return next as T;
}

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

/** From/to for date pickers and YTD alignment from FY label (same as SBU drill-down). */
const getRetailFiscalYearDateRange = (fyLabel: string) => {
  const fy = parseFiscalYearLabel(fyLabel);
  if (!fy) {
    return {
      from: dayjs().month(3).date(1),
      to: dayjs().subtract(1, "day"),
    };
  }
  if (!isCurrentFiscalYearSelection(fyLabel)) {
    return {
      from: dayjs().year(fy.start).month(3).date(1),
      to: dayjs().year(fy.end).month(2).date(31),
    };
  }
  return {
    from: dayjs().year(fy.start).month(3).date(1),
    to: dayjs().subtract(1, "day"),
  };
};

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
      // { key: "SBU_Name", isActive: false, drillLevel: 2 },
      { key: "Zone_Name", isActive: false, drillLevel: 2 },
      { key: "Region_Name", isActive: false, drillLevel: 3 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 4 },
      { key: "ProductName", isActive: false, drillLevel: 5 },
      { key: "month_name", isActive: false, drillLevel: 6 },
    ]
    : [
      { key: "month_name", isActive: false, drillLevel: 1 },
      // { key: "SBU_Name", isActive: false, drillLevel: 2 },
      { key: "Zone_Name", isActive: false, drillLevel: 2 },
      { key: "Region_Name", isActive: false, drillLevel: 3 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 4 },
      { key: "ProductName", isActive: false, drillLevel: 5 },
    ];
};


interface FilterOption {
  key: string;
  cond: string;
  value: string;
}

function activeStatesFromAppliedFilters(applied: FilterOption[]): ActiveStates {
  return {
    A: applied.some((f) => f.key === '"A"'),
    H: applied.some((f) => f.key === '"H"'),
    T: applied.some((f) => f.key === '"T"'),
    C: applied.some((f) => f.key === '"C"'),
  };
}

function isPerspectiveFilterOn(applied: FilterOption[], letter: "A" | "H" | "T"): boolean {
  return applied.some((f) => f.key === `"${letter}"`);
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
      ? ["cumulative", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName", "month_name"]
      : ["month_name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"];

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

const transformChartData = (
  responseData: any,
  mode: ChartMode,
  drillLevel: number,
  activeStates: ActiveStates,
  selected: string,
  sbu: string
): ChartData[] => {
  console.log("sbubu", sbu);
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
          ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
        }))
        .filter((item) =>
          item.name.trim() !== "" && item.name.trim() !== "-" &&
          (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0) // At least one nonzero
        );
    }

    return Object.keys(responseData[xAxisKey] || {}) // Ensure it exists
      .map((key) => ({
        name: responseData[xAxisKey]?.[key] ?? "",
        ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
        TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
        ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
      }))
      .filter((item) =>
        item.name.trim() !== "" && item.name.trim() !== "-" &&
        (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0) // At least one nonzero
      );
  }

  return responseData
    .filter((item: any) =>
      item.Zone_Name !== "-" && item.Zone_Name !== "" &&
      item.Region_Name !== "-" && item.Region_Name !== "" &&
      item.SalesArea_Name !== "-" && item.SalesArea_Name !== ""
    )
    .map((item: any) => ({
      name: item[xAxisKey] || "",
      ...(activeStates.A &&
        (item?.NETWEIGHT_TMT
          ? { NETWEIGHT_TMT: item.NETWEIGHT_TMT * multiplyFactor }
          : item?.ACTUAL_TMT_SALES
            ? { ACTUAL_TMT_SALES: item.ACTUAL_TMT_SALES * multiplyFactor }
            : {})),
      ...(activeStates.T && { TARGET_QTY_TMT: (item.TARGET_QTY_TMT || 0) * multiplyFactor }),
      ...(activeStates.H && { ACTUAL_HISTORY_TMT_SALES: (item.ACTUAL_HISTORY_TMT_SALES || 0) * multiplyFactor }),
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
          const formattedValue = entry.value < 10
            ? entry.value.toFixed(1)  // Show 2 decimal places if less than 10
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

  const formattedValue = value < 10
    ? value.toFixed(1)  // Show 2 decimal places if less than 10
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


// Define type for growth details
interface GrowthIndicator {
  title: string;
  value: number;
}
const RetailSalesPerformance: React.FC<SalesPerformanceProps> = ({ sbu }) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  // const [filters, setFilters] = useState<Filter[]>([
  //   { key: '"A"', cond: "equals", value: "true" },
  //   { key: '"H"', cond: "equals", value: "true" },
  // ]);
  const [salesUnit, setSalesUnit] = useState('TMT');
  const [isExpanded, setIsExpanded] = useState(false);


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
    C: true
  });
  const [appliedFilters, setAppliedFilters] = useState<FilterOption[]>(() => [
    ...convertToFilters({ A: true, H: true, T: true, C: true }),
    { key: '"YTD"', cond: "equals", value: "true" },
  ]);
  // Order of filters for hierarchy
  const filterOrder = ['SBU_Name', 'Zone_Name', 'Region_Name', 'SalesArea_Name', 'ProductName'];

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingGeoZoneRetail, setIsRefreshingGeoZoneRetail] = useState(false);
  const [isRefreshingGeoRegionRetail, setIsRefreshingGeoRegionRetail] = useState(false);
  const [isRefreshingGeoSalesAreaRetail, setIsRefreshingGeoSalesAreaRetail] = useState(false);
  const [isGeoChartsLoading, setIsGeoChartsLoading] = useState(false);
  const [mode, setMode] = useState<ChartMode>("ytd");

  const [drillHistory, setDrillHistory] = useState<string[]>(
    mode === "month" ? [`FY ${getDefaultSelectedFiscalYear()}`] : []
  );

  const [selectedYear, setSelectedYear] = useState(() => getDefaultSelectedFiscalYear());

  const fiscalYearMonthKey = dayjs().format("YYYY-MM");
  const fiscalYearOptions = useMemo(
    () => buildFiscalYearSelectOptions(),
    [fiscalYearMonthKey]
  );

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
  const [dateFilterCurrentSalesArray, setDateFilterCurrentSalesArray] = useState([]);
  const [dateFilterHistoricalSalesArray, setDateFilterHistoricalSalesArray] = useState([]);
  const [selectedYorM, setSelectedYorM] = useState<"Y" | "M">("Y");
  const mainChartLoadIdRef = useRef(0);
  const geoChartsLoadGenRef = useRef(0);
  // Get first day of current month
  let [stackedData, setStackedData] = useState<any>([]);
  let [sbuOriginalData, setSbuOriginalData] = useState([]);
  let [sbuHeatMapData, setSbuHeatMapData] = useState([]);
  const [sbuGrowthDetails, setSbuGrowthDetails] = useState<GrowthIndicator[]>([]);
  const [zoneGrowthDetails, setZoneGrowthDetails] = useState<GrowthIndicator[]>([]);
  const [regionGrowthDetails, setRegionGrowthDetails] = useState<GrowthIndicator[]>([]);
  const [sbuTgtGrowthDetails, setTgtSbuGrowthDetails] = useState<GrowthIndicator[]>([]);
  const [zoneTgtGrowthDetails, setTgtZoneGrowthDetails] = useState<GrowthIndicator[]>([]);
  const [regionTgtGrowthDetails, setTgtRegionGrowthDetails] = useState<GrowthIndicator[]>([]);

  let [zoneOriginalData, setZoneOriginalData] = useState([]);
  let [zoneHeatMapData, setZoneHeatMapData] = useState([]);
  let [regionOriginalData, setRegionOriginalData] = useState([]);
  let [regionHeatMapData, setRegionHeatMapData] = useState([]);
  let [dataSeparation, setDataSeparation] = useState([]);
  let [percentageData, setPercentageData] = useState([]);
  let [regionSeparation, setRegionSeparation] = useState([]);
  let [regionPercentage, setRegionPercentage] = useState([]);
  let [salesSeparation, setSalesSeparation] = useState([]);
  let [salesPercentage, setSalesPercentage] = useState([]);
  const [stackedCoulmnChartData, setStackedCoulmnChartData] = useState("");
  const [isStackedCoulmnChartDataLoaded, setIsStackedCoulmnChartDataLoaded] = useState(false);
  const [xaxisAHData, setXaxisAHData] = useState([])
  const [xaxisATData, setXaxisATData] = useState([])

  const [headingDate, setHeadingDate] = useState("");
  // State for date range — align with selected FY (default = current or previous per Apr 1 rule)
  const [fromDate, setFromDate] = useState(() =>
    getRetailFiscalYearDateRange(getDefaultSelectedFiscalYear()).from
  );
  const [toDate, setToDate] = useState(() =>
    getRetailFiscalYearDateRange(getDefaultSelectedFiscalYear()).to
  );

  // Helper function to format heading date using selectedYear
  const formatHeadingDate = (from: Dayjs, to: Dayjs, year: string) => {
    // Extract years from selectedYear (format: "2024-2025" or "2025-2026")
    if (year && year.includes('-')) {
      const [startYear, endYear] = year.split('-');
      const currentFiscalYear = getCurrentFiscalYearString();

      if (year === currentFiscalYear) {
        // For current fiscal year, use actual toDate
        return `${from.format("MMMM D")}, ${startYear} to ${to.format("MMMM D")}, ${to.format("YYYY")}`;
      } else {
        // For past fiscal years, use the end year from selectedYear
        return `${from.format("MMMM D")}, ${startYear} to ${to.format("MMMM D")}, ${endYear}`;
      }
    }
    // Fallback to date years if selectedYear is not in expected format
    return `${from.format("MMMM D")}, ${from.format("YYYY")} to ${to.format("MMMM D")}, ${to.format("YYYY")}`;
  };

  // Set initial heading date and update when dependencies change
  useEffect(() => {
    if (fromDate && toDate && selectedYear) {
      setHeadingDate(formatHeadingDate(fromDate, toDate, selectedYear));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]); // Only update when selectedYear changes, not when dates change

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

  let initialDrilldownList = [
    { key: "cumulative", isActive: false, drillLevel: 1 },
    // { key: "SBU_Name", isActive: false, drillLevel: 2 },
    { key: "Zone_Name", isActive: false, drillLevel: 2 },
    { key: "Region_Name", isActive: false, drillLevel: 3 },
    { key: "SalesArea_Name", isActive: false, drillLevel: 4 },
    { key: "ProductName", isActive: false, drillLevel: 5 },
    { key: "month_name", isActive: false, drillLevel: 6 },
  ];
  let activeDrills = [];
  let [drilldownList, setDrilldownList] = useState(getInitialDrilldownList(selectedYorM));
  useEffect(() => {
    if (mode === "date") {
      return;
    }
    const { from, to } = getRetailFiscalYearDateRange(selectedYear);
    setFromDate(from);
    setToDate(to);
  }, [mode, selectedYear]);


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

  const loadData = useCallback(async () => {
    const loadId = ++mainChartLoadIdRef.current;
    setIsLoading(true);
    let ytd = [];
    if (mode === "ytd" || mode === "date") {
      ytd = [{ key: '"YTD"', cond: "equals", value: "true" }];
    }
    const retailFilter = [{ key: '"SBU_Name"', cond: "equals", value: sbu }];
    const updatedFilters = [...retailFilter, ...appliedFilters, ...ytd];
    try {
      const originalFilter = removeDuplicateFilters(updatedFilters);
      const originalCrossFilter = removeDuplicateFilters(crossFilters);
      // const orderedKeys = ['"FISCAL_YEAR"', '"month_name"'];
      // const reorderedData = reorderDataByKeys(originalFilter, orderedKeys);
      originalFilter.push({ key: '"fiscal_year"', cond: "equals", value: selectedYear });
      const response = await fetchChartData({
        filters: originalFilter, // originalFilter, // !isDrillDown ? reorderedData : [], // Pass `filters` only if `isDrillDown` is true
        cross_filters: originalCrossFilter, // isDrillDown ? reorderedData : [], // Pass `cross_filters` if `isDrillDown` is false
        action:
          mode === "month" || mode === "ytd" || mode === "date"
            ? "m60_performance"
            : "yearly_sales_performance", // Determine `action` based on `mode`
        drill_state: "", // Pass drill_state as empty
      });
      if (loadId !== mainChartLoadIdRef.current) return;
      setSalesUnit(response?.data?.sales_unit || 'TMT');
      if (response.status && response.data) {
        if (
          Object.keys(response.data.data?.ACTUAL_HISTORY_TMT_SALES).length ===
          0 ||
          Object.keys(response.data.data?.ACTUAL_TMT_SALES).length === 0
        ) {
          toast.warning(
            "No data present for the selected combination.! Please select some other combination."
          );
          return;
        }
        const transformedData = transformChartData(
          response.data?.data,
          mode,
          drillLevel,
          activeStatesFromAppliedFilters(appliedFilters),
          selectedYorM,
          sbu
        );
        setChartData(transformedData);
      } else {
        const errorMessage = response.message || "No data available for the selected filters.";
        toast.warning(errorMessage);
        // setFilters([filters.pop()])
        // setDrillLevel((prev) => prev - 1);
        // setDrillHistory([drillHistory.pop()]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (loadId === mainChartLoadIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    drillLevel,
    mode,
    appliedFilters,
    crossFilters,
    selectedYear,
    sbu,
    selectedYorM,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);
const loadChartData = useCallback(async (drillState) => {
    try {
      const retailFilter = [{ key: '"SBU_Name"', cond: "equals", value: sbu }];
      const updatedFilters = [...retailFilter, ...appliedFilters];
      const originalFilter = removeDuplicateFilters(updatedFilters);

      // ✅ ADD THIS LINE — same pattern as loadData
      originalFilter.push({ key: '"fiscal_year"', cond: "equals", value: selectedYear });

      const response = await fetchChartData({
        filters: originalFilter,

  // const loadChartData = useCallback(async (drillState) => {
  //   setIsLoading(true);
  //   try {
  //     // Add "Retail" as a filter
  //     const retailFilter = [{ key: '"SBU_Name"', cond: "equals", value: sbu }];
  //     const updatedFilters = [...retailFilter, ...appliedFilters];
  //     const originalFilter = removeDuplicateFilters(updatedFilters);
  //     // Fetch data
  //     const response = await fetchChartData({
  //       filters: originalFilter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: drillState,
        time_grain: "Monthly",
        resp_format: "summary"
      });

      if (response.status && response.data) {
        const initialResponseData = response.data?.data;
        const responseData = Array.isArray(initialResponseData)
          ? initialResponseData.filter(item =>
            item.Zone_Name !== "-" && item.Zone_Name !== "" &&
            item.Region_Name !== "-" && item.Region_Name !== "" &&
            item.SalesArea_Name !== "-" && item.SalesArea_Name !== ""
          )
          : initialResponseData;

        let transformedData = [];
        switch (drillState) {
          case '"SBU_Name"':
            sbuOriginalData = responseData;
            setSbuOriginalData(responseData)
            // transformedData = transformStackedBarData(responseData, "SBU_Name");
            // console.log("SBU_Name",transformedData);
            // setSbuChartData(transformedData);
            break;
          case '"Zone_Name"':
            zoneOriginalData = responseData;
            setZoneOriginalData(responseData)
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
    }
  }, [appliedFilters, selectedYear, sbu]);
const loadHeatMapChartData = useCallback(async (drillState) => {
    try {
      const retailFilter = [{ key: '"SBU_Name"', cond: "equals", value: sbu }];
      const updatedFilters = [...retailFilter, ...appliedFilters];
      const originalFilter = removeDuplicateFilters(updatedFilters);

      originalFilter.push({ key: '"fiscal_year"', cond: "equals", value: selectedYear });

      const response = await fetchChartData({
        filters: originalFilter,
  // const loadHeatMapChartData = useCallback(async (drillState) => {
  //   setIsLoading(true);
  //   try {
  //     // Add "Retail" as a filter
  //     const retailFilter = [{ key: '"SBU_Name"', cond: "equals", value: sbu }];
  //     const updatedFilters = [...retailFilter, ...appliedFilters];
  //     const originalFilter = removeDuplicateFilters(updatedFilters);
  //     // Fetch data
  //     const response = await fetchChartData({
  //       filters: originalFilter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: drillState,
        time_grain: "Monthly",
        resp_format: "heat_map"
      });

      if (response.status && response.data) {
        const initialResponseData = response.data?.data;
        const responseData = Array.isArray(initialResponseData)
          ? initialResponseData.filter(item =>
            item.Zone_Name !== "-" && item.Zone_Name !== "" &&
            item.Region_Name !== "-" && item.Region_Name !== "" &&
            item.SalesArea_Name !== "-" && item.SalesArea_Name !== ""
          )
          : initialResponseData;
        const xaxisah = response.data?.['hist_xaxis'];
        const xaxisat = response.data?.['tgt_xaxis'];
        const growthDetails = response.data?.hist_growth_details || [];
        const tgtGrowthDetails = response.data?.tgt_growth_details || [];

        setXaxisAHData((prev) => keepPreviousIfEqual(prev, xaxisah));
        setXaxisATData((prev) => keepPreviousIfEqual(prev, xaxisat));

        // Helper function to format growth details with proper type handling
        const formatGrowthDetails = (details: any) => {
          if (Array.isArray(details)) {
            return details;
          } else if (details && typeof details === 'object') {
            return Object.entries(details).map(([title, value]) => ({
              title,
              value: typeof value === 'number' ? value : parseFloat(String(value))
            }));
          }
          return [];
        };

        const hasA = isPerspectiveFilterOn(appliedFilters, "A");
        const hasH = isPerspectiveFilterOn(appliedFilters, "H");
        const hasT = isPerspectiveFilterOn(appliedFilters, "T");

        switch (drillState) {
          case '"SBU_Name"':
            setSbuHeatMapData(responseData);

            // Handle historical growth details
            if (growthDetails && Array.isArray(growthDetails) && growthDetails.length > 0 && hasA && hasH) {
              setSbuGrowthDetails(formatGrowthDetails(growthDetails));
            }

            // Handle target growth details
            if (tgtGrowthDetails && Array.isArray(tgtGrowthDetails) && tgtGrowthDetails.length > 0 && hasA && hasT) {
              setTgtSbuGrowthDetails(formatGrowthDetails(tgtGrowthDetails));
            }
            break;

          case '"Zone_Name"':
            setZoneHeatMapData(responseData);

            // Handle historical growth details
            if (growthDetails && Array.isArray(growthDetails) && growthDetails.length > 0 && hasH) {
              setZoneGrowthDetails(formatGrowthDetails(growthDetails));
            }

            // Handle target growth details
            if (tgtGrowthDetails && Array.isArray(tgtGrowthDetails) && tgtGrowthDetails.length > 0 && hasT) {
              setTgtZoneGrowthDetails(formatGrowthDetails(tgtGrowthDetails));
            }
            break;

          case '"Region_Name"':
            setRegionHeatMapData(responseData);

            // Handle historical growth details
            if (growthDetails && Array.isArray(growthDetails) && growthDetails.length > 0 && hasH) {
              setRegionGrowthDetails(formatGrowthDetails(growthDetails));
            }

            // Handle target growth details
            if (tgtGrowthDetails && Array.isArray(tgtGrowthDetails) && tgtGrowthDetails.length > 0 && hasT) {
              setTgtRegionGrowthDetails(formatGrowthDetails(tgtGrowthDetails));
            }
            break;

          default:
            console.warn("Unknown drillState:", drillState);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [appliedFilters, sbu, selectedYear]);
  useEffect(() => {
    const gen = ++geoChartsLoadGenRef.current;
    let cancelled = false;
    setIsGeoChartsLoading(true);
    void (async () => {
      try {
        await Promise.all([
          loadHeatMapChartData('"SBU_Name"'),
          loadHeatMapChartData('"Zone_Name"'),
          loadHeatMapChartData('"Region_Name"'),
          loadChartData('"SBU_Name"'),
          loadChartData('"Zone_Name"'),
          loadChartData('"Region_Name"'),
        ]);
      } finally {
        if (!cancelled && gen === geoChartsLoadGenRef.current) {
          setIsGeoChartsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadChartData, loadHeatMapChartData]);

  // Transform data to show individual area sales per month
  const transformStackedBarData = (data, drillState) => {
    const drillMapping = {
      "SBU_Name": "Zone_Name",
      "Zone_Name": "Region_Name",
      "Region_Name": "SalesArea_Name"
    };

    const nextState = drillMapping[drillState] || null;

    return data.flatMap(month =>
      month.salesArea.map((area, index) => ({
        monthArea: `${month.month_name} - ${area}`,
        actual: month.ACTUAL_TMT_SALES[index],
        historical: month.ACTUAL_HISTORY_TMT_SALES[index]
      }))
    );
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
          key: "Region_Name",
          value: "-",
          cond: "!=",
        },
        {
          key: "Region_Name",
          value: "",
          cond: "!=",
        },
        {
          key: "SalesArea_Name",
          value: "-",
          cond: "!=",
        },
        {
          key: "SalesArea_Name",
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
    [sbu]
  );

  useEffect(() => {
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

      const alldropdownOption = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"]);

      // Filter out unwanted product options
      const filteredProductOptions = alldropdownOption?.["ProductName"].filter(
        (product) => product !== "LPG CYLINDER REGULATOR" && product !== "LPG CYLINDER ACCESSORIES" && product !== "Miscellaneous/Minor"
      );

      setZoneOptions(alldropdownOption?.["Zone_Name"]);
      setRegionOptions(alldropdownOption?.["Region_Name"]);
      setSalesAreaOptions(alldropdownOption?.["SalesArea_Name"]);
      setProductOptions(filteredProductOptions); // Set filtered product options
    };
    initializeFilters();
  }, [mode, loadDistinctValues]);


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
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

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

    const dateRangeStart = format(firstDayOfMonth, 'yyyy-MM-dd');
    const dateRangeEnd = format(yesterday, 'yyyy-MM-dd');

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"DATE"', cond: "equals", value: `${dateRangeStart},${dateRangeEnd}` },
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
        const historicalSales = response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

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

  const syncWithDropdowns = async (key, value) => {
    switch (key) {
      // case "SBU_Name":
      //   setSelectedSBU(value);
      //   handleSBUChange(key, value);
      //   break;
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
      if (drillLevel >= 6) {
        toast.info("You have reached the maximum drill-down level.");
        return;
      }

      newFilters = [...appliedFilters];
      const filterKeys =
        selectedYorM === "Y"
          ? ["cumulative", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName", "month_name"]
          : ["month_name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"];

      newCrossFilters = [...crossFilters];
      if (drillLevel === 0) {
        newCrossFilters.push({
          key: '"SBU_Name"',
          cond: "equals",
          value: sbu,
        });
      } else {
        newCrossFilters.push({
          key: entry.name === "CUMMULATIVE_SALES" ? '"cumulative"' : `"${filterKeys[drillLevel]}"`,
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
      setDrillLevel((prev) => prev + 1);
      setDrillHistory([...drillHistory, entry.name]);
      syncWithDropdowns(filterKeys[drillLevel], entry.name);
    },
    [drillLevel, appliedFilters, drillHistory, mode, selectedYorM]
  );

  const handleBackClick = useCallback(() => {
    setIsDrillDown(true);
    if (drillLevel > 0) {
      const activeDrills = drilldownList.filter((drill) => drill.isActive);
      if (activeDrills.length === 1 || activeDrills === null) {
        resetFilters();
        return;
      }
      const lastActiveDrill = activeDrills.length > 0 ? activeDrills[activeDrills.length - 1] : null;
      const lastActiveCount = activeDrills.length > 1 ? activeDrills.slice(-2, -1)[0] : null;
      const drillcount = lastActiveDrill ? lastActiveCount?.drillLevel : 0;
      setDrillLevel((drillcount === null || drillcount === undefined) ? 1 : drillcount);

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
    
    // Always include YTD filter to ensure YTD is selected
    setAppliedFilters([...resetFilter, ...perspectiveFilters]);
    const { from: newFromDate, to: newToDate } = getRetailFiscalYearDateRange(selectedYear);
    setFromDate(newFromDate);
    setToDate(newToDate);
    setHeadingDate(formatHeadingDate(newFromDate, newToDate, selectedYear));
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

  }, [mode, filters, appliedFilters, crossFilters, selectedYear]);

  const handleModeChange = useCallback(
    (newMode) => {
      // If trying to deselect month while no other mode is selected, keep month selected
      if (newMode === "month" && mode === "month" && !appliedFilters.length) {
        return;
      }
      if (newMode === "ytd") {
        setAppliedFilters((prevFilters) => [...prevFilters, { key: '"YTD"', cond: "equals", value: "true" }]);
      }
      // If deselecting current mode (YTD), switch to date mode and enable date filter
      if (newMode === mode && mode === "ytd") {
        setMode("date");
        // Remove YTD filter
        setAppliedFilters((prev) => prev.filter(item => item.key !== '"YTD"'));
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

  const handleMonthSelect = (monthValues) => {
    const monthValuesString = monthValues.join(",");

    const monthFilter = {
      key: '"month_name"',
      cond: "equals",
      value: monthValuesString,
    };

    setAppliedFilters((prev) => {
      const monthFilterIndex = prev.findIndex((f) => f.key === '"month_name"');
      if (monthFilterIndex >= 0) {
        const newFilters = [...prev];
        newFilters[monthFilterIndex] = monthFilter;
        return newFilters;
      }
      return [...prev, monthFilter];
    });
  };

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
    // Radix Select can fire onValueChange when the control syncs; avoid a second chart/geo fetch for the same FY.
    if (value === selectedYear) return;
    const { from: fromdate, to: todate } = getRetailFiscalYearDateRange(value);
    setFromDate(fromdate);
    setToDate(todate);
    setHeadingDate(formatHeadingDate(fromdate, todate, value));
    setSelectedYear(value);
    setAppliedFilters((prev) => {
      const withoutFy = prev.filter((f) => f.key !== '"fiscal_year"');
      return [...withoutFy, { key: '"fiscal_year"', cond: "equals", value }];
    });
  };
  const handleMonthChange = async (event: any) => {
    const value = event.target.value;
    if (value === "_empty") {
      resetFilters();
      return;
    }
    setSelectedMonth(value);
    const fyForApi = `FY ${selectedYear}`;
    setAppliedFilters([
      ...appliedFilters.filter((filter) =>
        ["A", "H", "T", "BE", "RI"].includes(filter.key.replace(/"/g, ""))
      ),
      { key: '"FISCAL_YEAR"', cond: "equals", value: fyForApi },
      { key: '"month_name"', cond: "equals", value },
    ]);
    setDrillLevel(1);
    setDrillHistory([fyForApi, value]);
    const sbus = await loadDistinctValues(["SBU_Name"], {
      FISCAL_YEAR: fyForApi,
      month_name: value,
    });
    setSbuOptions(sbus);
  };

  const handleSBUChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('SBU_Name', value);
    const distinctValues = distinctFilterChange('SBU_Name', value);

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
      console.log("updatedDrillHistory", updatedDrillHistory);
      setDrillHistory(updatedDrillHistory);
      // setDrillHistory([...drillHistory.slice(0, higherLevelFilter.length-1), higherLevelFilter[higherLevelFilter.length-1].value]);
    } else {
      higherLevelFilter = crossFilters
    }

    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([
        ...perspectiveFilters,
        {
          key: '"SBU_Name"',
          cond: "equals",
          value: ""
        }
      ]);
      setSelectedSBU("");
      return;
    }
    setSelectedSBU(value);
    setSelectedZone("");
    setSelectedRegion("");
    setSelectedSalesArea("");
    setSelectedProductName("");
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
    let perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    let ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    setAppliedFilters([
      ...perspectiveFilters,
      ...ytdFilters,
      ...dateFilters,
      ...defaultFilter
    ]);
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

    setSelectedZone(value);
    setSelectedRegion("");
    setSelectedSalesArea("");
    setSelectedProductName("");

    // Get existing date filters
    let dateFilters = appliedFilters.filter((filter) => filter.key === '"DATE"');

    // If no date filters but we have date values, create them
    if (dateFilters.length === 0 && fromDate && toDate && mode === "date") {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format("YYYY-MM-DD")}`;
      dateFilters = [{ key: '"DATE"', cond: "equals", value: formattedDates }];
    }

    // Get perspective filters
    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C });

    // Get YTD filters
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];

    // Combine all filters
    const combinedFilters = combineAllFilters(defaultFilter, dateFilters, [...perspectiveFilters, ...ytdFilters]);

    setAppliedFilters(combinedFilters);

    // Fetch regions based on the selected zone
    try {
      const response = await loadDistinctValues(
        ["Region_Name"],
        distinctValues
      );
      if (response) {
        setRegionOptions(response["Region_Name"]);
      }
    } catch (error) {
      console.log(error);
    }
  };


  const handleRegionChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('Region_Name', value);
    const distinctValues = distinctFilterChange('Region_Name', value);
    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([
        ...perspectiveFilters
      ]);
      setSelectedSBU("");
      return;
    }
    setSelectedRegion(value);
    setSelectedSalesArea("");
    setSelectedProductName("");
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
      console.log("updatedDrillHistory", updatedDrillHistory);
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

    let perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    let ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    setAppliedFilters([
      ...perspectiveFilters,
      ...ytdFilters,
      ...dateFilters,
      ...defaultFilter
    ]);
    try {
      const response: any = await loadDistinctValues(
        ["SalesArea_Name", "ProductName"],
        distinctValues
      );
      if (response) {
        // setSbuOptions(response["SBU_Name"]);
        // setZoneOptions(response["Zone_Name"]);
        setProductOptions(response["ProductName"]);
        setSalesAreaOptions(response["SalesArea_Name"]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSalesAreaChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('SalesArea_Name', value);
    const distinctValues = distinctFilterChange('SalesArea_Name', value);
    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([
        ...perspectiveFilters
      ]);
      setSelectedSalesArea("");
      return;
    }
    setSelectedSalesArea(value);
    setSelectedProductName("");
    let dateFilters = [];
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      dateFilters = mode === "date" ? [{ key: '"DATE"', cond: "equals", value: formattedDates }] : [];
    }

    let perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    let ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
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
      // **Step 2: Find the last active drill level**
      const lastActiveDrill = [...drilldownList].reverse().find(d => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map(item => item.value)];
      console.log("updatedDrillHistory", updatedDrillHistory);
      setDrillHistory(updatedDrillHistory);
    } else {
      higherLevelFilter = crossFilters
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
  const handleProductNameChange = async (key, value: string) => {
    const defaultFilter = handleFilterChange('ProductName', value);
    const distinctValues = distinctFilterChange('ProductName', value);
    if (value === "_empty") {
      let perspectiveFilters = convertToFilters(activeStates);
      setAppliedFilters([
        ...perspectiveFilters
      ]);
      setSelectedProductName("");
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

    let perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C })
    let ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
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

      drilldownList = drilldownList.map((drill) => ({
        ...drill,
        isActive: higherLevelFilter.some((filter) => filter.key.replace(/"/g, '') === drill.key)
      }));
      setDrilldownList(drilldownList);
      const lastActiveDrill = [...drilldownList].reverse().find(d => d.isActive);
      const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
      setDrillLevel(drillcount);
      const updatedDrillHistory = [`FY ${selectedYear}`, ...higherLevelFilter.map(item => item.value)];
      console.log("updatedDrillHistory", updatedDrillHistory);
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
  const combineAllFilters = (dropdownFilters, dateFilters, perspectiveFilters) => {
    // Start with perspective filters (A, H, T, C)
    let combinedFilters = [...perspectiveFilters]

    // Add date filters if they exist
    if (dateFilters && dateFilters.length > 0) {
      combinedFilters = [...combinedFilters, ...dateFilters]
    }

    // Add dropdown filters if they exist
    if (dropdownFilters && dropdownFilters.length > 0) {
      combinedFilters = [...combinedFilters, ...dropdownFilters]
    }

    // Remove any duplicate filters by key
    const uniqueFilters = []
    const keys = new Set()

    for (const filter of combinedFilters) {
      if (!keys.has(filter.key)) {
        keys.add(filter.key)
        uniqueFilters.push(filter)
      }
    }

    return uniqueFilters
  }
const headingtext = toDate

  const handleDateFilter = () => {
    if (fromDate && toDate) {
      // Format dates for the filter
      const formattedFromDate = formatDate(fromDate.format("YYYY-MM-DD"));
      const formattedToDate = formatDate(toDate.format("YYYY-MM-DD"));
      const formattedDates = `${formattedFromDate},${formattedToDate}`;

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
        `${formattedFromDate} - ${formattedToDate}`,
      ]);
      setHeadingDate(formatHeadingDate(fromDate, toDate, selectedYear));

      // Close the popover
      setIsOpen(false);
    }
  };
  const formatDate = (dateString: string): string => {
    // Check if the dateString is in the format YYYY-MM-DD
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) { // Check if the date is valid
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        return date.toLocaleDateString('en-GB', options).replace(/,/g, '');
      }
    }

    // If the date is in the format DD-MM-YYYY
    const customDateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dateString.match(customDateRegex);
    if (match) {
      const [_, day, month, year] = match;
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) { // Check if the date is valid
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        return date.toLocaleDateString('en-GB', options).replace(/,/g, '');
      }
    }

    // If the date format is not recognized, return the original string
    return dateString;
  };



  const handlePopoverOpenChange = (open) => {
    if (open) {
      const { from, to } = getRetailFiscalYearDateRange(selectedYear);
      setFromDate(from);
      setToDate(to);
    }
    setIsOpen(open);
  };

  const resetDate = () => {
    const { from, to } = getRetailFiscalYearDateRange(selectedYear);
    setFromDate(from);
    setToDate(to);
  };

  const DrillIndicator: React.FC<DrillStateIndicatorProps> = ({
    drillLevel,
    drillHistory,
  }) => {
    const states = ["Month", "SBU", "Zone", "Region", "Sales Area", "Product"];

    // Update drilldownList with isActive flag
    const updatedDrilldownList = drilldownList.map((drill) => ({
      ...drill,
      isActive: crossFilters.some((filter) => filter.key.replace(/"/g, "") === drill.key),
    }));

    // Find the last active drill level
    const lastActiveDrill = [...updatedDrilldownList].reverse().find((d) => d.isActive);
    const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;


    return (
      <div className="space-y-2 text-xs px-8">
        {/* <CustomStepper style={{ width: "650px" }} activeStep={drillcount} alternativeLabel>
            {updatedDrilldownList.map((drill) => (
              <Step key={drill.key}>
                <StepLabel
                  className={drill.isActive ? "Mui-active Mui-completed" : ""}
                  style={{ color: drill.isActive ? "#00a495" : "#ccc" }}
                >
                  {drill.key.replace(/_/g, " ")}
                </StepLabel>
              </Step>
            ))}
          </CustomStepper> */}

        <CustomStepper
          style={{ width: "650px" }}
          activeStep={drillcount}
          alternativeLabel
        >
          {updatedDrilldownList.map((drill, index) => (
            <Step key={drill.key} completed={drill.isActive}>
              <StepLabel style={{ color: drill.isActive ? "#00a495" : "#ccc" }}>
                {drill.key.replace(/_/g, " ")}
              </StepLabel>
            </Step>
          ))}
        </CustomStepper>
      </div>
    );
  };

  const handleZoneClick = (zoneData) => {
    setDataSeparation(() => zoneData); // Ensure a new state reference
    setPercentageData(() => zoneData); // Update percentage data as well
    // console.log("zoneData", zoneData);
  };

  const handleRegionClick = (regionData) => {
    setRegionSeparation(regionData);
    setRegionPercentage(regionData);
  }

  const handleSalesareaClick = (salesData) => {
    setSalesSeparation(salesData);
    setSalesPercentage(salesData);
  }
  // const currentMonth = new Date().getMonth();
  // const salesAreas = stackedData?.[currentMonth].salesArea;  
  // Generate colors for the stacks
  const colors = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d'];

  const loadStackedCoulmnChartData = async () => {
    setIsLoading(true);
    try {

      const option: any = {
        tooltip: {
          trigger: "item", // Show tooltip only for hovered series
        },
        legend: { show: false },

        xAxis: [
          {
            type: 'category',
            data: []
          }
        ],
        yAxis: [
          {
            type: 'value'
          }
        ],
      };

      // Fetch data
      //TODO: create StackedColumnChart separate component
      const payload = {
        "filters": [{ "key": "\"SBU_Name\"", "cond": "equals", "value": "Retail" },
        { "key": "\"A\"", "cond": "equals", "value": "true" },
        { "key": "\"H\"", "cond": "equals", "value": "true" },
        { "key": "\"T\"", "cond": "equals", "value": "true" }]
      }
      const response = await fetchChartData({
        filters: payload.filters,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "\"SBU_Name\"",
        time_grain: "Monthly",
        resp_format: "stacked"
      });
      if (response.status && response.data) {
        response.data.data.series.forEach((item, index) => {
          item.emphasis = {
            focus: 'series'
          };
          item.type = 'bar';
        });
        option.series = response.data.data.series;
        option.xAxis[0].data = response.data.data.months;

        setStackedCoulmnChartData(option);
        setIsLoading(false);
        setIsStackedCoulmnChartDataLoaded(true);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  };

  // useEffect(() => {
  //   loadStackedCoulmnChartData(); 
  //   console.log("dataSeparation",dataSeparation)
  // }, []);

  const hasTargetData = (data: Record<string, any>) => {
    return data && Object.keys(data).some(key => key.includes('_target'));
  };

  const handleZoneCellClick = ({ zone, month, value }) => {
    // Handle the click event here
    console.log(`Clicked: ${zone} - ${month}: ${value}%`);
    // Pass the data to another component or trigger any other action
    handleZoneChange("Zone_Name", zone);
  }

  const handleRegionCellClick = ({ region, month, value }) => {
    // Handle the click event here
    console.log(`Clicked: ${region} - ${month}: ${value}%`);
    // Pass the data to another component or trigger any other action
    handleRegionChange("Region_Name", region);
  };

  const handleSalesAreaCellClick = ({ salesArea }: { salesArea: string }) => {
    handleSalesAreaChange("SalesArea_Name", salesArea);
  };

  const refreshZoneSectionRetail = async () => {
    if (isRefreshingGeoZoneRetail) return;
    setIsRefreshingGeoZoneRetail(true);
    try {
      await handleZoneChange("Zone_Name", "");
      const alldropdownOption = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"]);
      if (alldropdownOption) {
        setZoneOptions(alldropdownOption["Zone_Name"]);
        setRegionOptions(alldropdownOption["Region_Name"]);
        setSalesAreaOptions(alldropdownOption["SalesArea_Name"]);
      }
    } catch (e) {
      console.error("refreshZoneSectionRetail:", e);
    } finally {
      setIsRefreshingGeoZoneRetail(false);
    }
  };

  const refreshRegionSectionRetail = async () => {
    if (isRefreshingGeoRegionRetail) return;
    setIsRefreshingGeoRegionRetail(true);
    try {
      const z = selectedZone;
      await handleRegionChange("Region_Name", "");
      if (z) {
        const res = await loadDistinctValues(["Region_Name", "SalesArea_Name"], [{ key: "Zone_Name", cond: "=", value: z }]);
        setRegionOptions(res?.["Region_Name"] ?? []);
        setSalesAreaOptions(res?.["SalesArea_Name"] ?? []);
      } else {
        const all = await loadDistinctValues(["Region_Name", "SalesArea_Name"]);
        setRegionOptions(all?.["Region_Name"] ?? []);
        setSalesAreaOptions(all?.["SalesArea_Name"] ?? []);
      }
    } catch (e) {
      console.error("refreshRegionSectionRetail:", e);
    } finally {
      setIsRefreshingGeoRegionRetail(false);
    }
  };

  const refreshSalesAreaSectionRetail = async () => {
    if (isRefreshingGeoSalesAreaRetail) return;
    setIsRefreshingGeoSalesAreaRetail(true);
    try {
      const z = selectedZone;
      const r = selectedRegion;
      await handleSalesAreaChange("SalesArea_Name", "");
      if (z && r) {
        const res = await loadDistinctValues(["SalesArea_Name"], [
          { key: "Zone_Name", cond: "=", value: z },
          { key: "Region_Name", cond: "=", value: r },
        ]);
        setSalesAreaOptions(res?.["SalesArea_Name"] ?? []);
      } else if (z) {
        const res = await loadDistinctValues(["SalesArea_Name"], [{ key: "Zone_Name", cond: "=", value: z }]);
        setSalesAreaOptions(res?.["SalesArea_Name"] ?? []);
      } else {
        const all = await loadDistinctValues(["SalesArea_Name"]);
        setSalesAreaOptions(all?.["SalesArea_Name"] ?? []);
      }
    } catch (e) {
      console.error("refreshSalesAreaSectionRetail:", e);
    } finally {
      setIsRefreshingGeoSalesAreaRetail(false);
    }
  };

  const showTargetChart = hasTargetData(dataSeparation);
  const showPercentageChart = hasTargetData(percentageData);

  /** Stable array refs for amCharts children — inline `[x]` changes identity every render and remounts charts. */
  const sbuMonthlyComparisonData = useMemo(() => [dataSeparation], [dataSeparation]);
  const sbuMonthlyPercentageData = useMemo(() => [percentageData], [percentageData]);
  const regionMonthlyComparisonData = useMemo(() => [regionSeparation], [regionSeparation]);
  const regionMonthlyPercentageData = useMemo(() => [regionPercentage], [regionPercentage]);
  const salesAreaMonthlyComparisonData = useMemo(() => [salesSeparation], [salesSeparation]);
  const salesAreaMonthlyPercentageData = useMemo(() => [salesPercentage], [salesPercentage]);

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
            <span className="text-xl font-bold">
              Historical (2023-24) vs Actual (2024-25) vs Target - TMT/MT
            </span>
            <CustomLegend />
          </div>

          {/* Expanded Chart */}
          <div className="flex-1">
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
                            // onClick={handleBarClick}
                            cursor="cursor-not-allowed"
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
          </div>

          {/* Drill Indicator */}
        </div>
      </div>
    </div>
  );
  const isDisabled = mode === "ytd";
  const chartsBlockLoading = isLoading || isGeoChartsLoading;

  return (
    <Card className="w-full h-full bg-white rounded-lg border border-gray-200 py-2 px-2">
      {
        sbu && (
          <DrillDownComponent key={sbu} sbu={sbu} />
        )
      }
      <Separator className="my-2 my-4 h-[3px] bg-cyan-700" />
      <CardHeader className="p-1">
        <div className="flex flex-col gap-2">
                        <span className="flex items-center text-sm font-extrabold">
                Zone-Wise Performance - {selectedYear}
                <span className="p-1 rounded-md text-xs bg-blue-100 ml-1">
                  {headingDate}
                  {/* {fromDate.format("MMMM D")},{fromDate.format("YYYY")} to {toDate.format("MMMM D")},{toDate.format("YYYY")} */}

                </span>
              </span>
          {/* Top Controls Section */}
          <div className="flex gap-4 justify-between items-start">
            <div className="flex">
              <RetailSalesDropdowns
                selectedYear={selectedYear}
                selectedZone={selectedZone}
                selectedRegion={selectedRegion}
                selectedSalesArea={selectedSalesArea}
                selectedProductName={selectedProductName}
                yearOptions={yearOptions}
                zoneOptions={zoneOptions}
                regionOptions={regionOptions}
                salesAreaOptions={salesAreaOptions}
                productOptions={productOptions}
                //  handleZoneChange={handleZoneChange} 
                // handleYearChange={handleYearChange}
                handleZoneChange={(key, value) => handleZoneChange(key, value)}
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
              />
              {mode === "month" && (
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
              )}
            </div>

            {/* Control Buttons */}
            <TooltipProvider>
              <div className="flex gap-1">
                <ToggleGroup
                  variant="outline"
                  className="inline-flex gap-0 -space-x-px rounded-lg shadow-sm shadow-black/5 rtl:space-x-reverse bg-background"
                  type="single"
                  value={selectedYorM}
                  onValueChange={(val) => {
                    if (val) {
                      if (val === "Y" || val === "M") {
                        setSelectedYorM(val);
                      }
                      if (val === "Y") {
                        setAppliedFilters((prevFilters) => [
                          ...prevFilters,
                          { key: '"C"', cond: "equals", value: "true" },
                        ]);
                      } else {
                        setAppliedFilters((prevFilters) =>
                          prevFilters.filter((filter) => filter.key !== '"C"')
                        );
                      }
                    }
                  }}
                >
                  <ToggleGroupItem
                    className="rounded-none h-8 shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 data-[state=on]:bg-teal-600 data-[state=on]:text-white"
                    value="Y"
                  >
                    Year
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    className="rounded-none h-8 shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 data-[state=on]:bg-teal-600 data-[state=on]:text-white"
                    value="M"
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
                        {categoryData[key as keyof typeof categoryData].title}
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
                        {categoryData[key as keyof typeof categoryData].title}
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
                              format="DD/MM/YYYY"
                              views={["year", "month", "day"]}
                              minDate={dayjs().date(1).month(3).subtract(2, "year")}
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
                              minDate={dayjs().date(1).month(3).subtract(2, "year")}
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

                <div className="flex items-end justify-end">
                  {/* <h2 className="text-sm font-bold">{displayYear}</h2> */}
                  <ShadcnSelect value={selectedYear} onValueChange={handleYearChange}>
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

          {/* <div className="pt-1 pb-2 overflow-x-auto">
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-200 bg-gray-100 shadow-md">
<nav className="flex flex-nowrap items-center gap-1 whitespace-nowrap text-sm font-medium text-gray-700">
  {appliedFilters
    .filter((ele) => {
      const key = ele.key.replace(/"/g, "");
      const val = ele.value;

      // Exclude known keys (including DATE)
      if (["A", "H", "T", "YTD", "C", "DATE"].includes(key)) return false;

      // Exclude date ranges and fiscal years
      const isDateRange = /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(val);
      const isSingleDate = /^\d{4}-\d{2}-\d{2}$/.test(val);
      const isFiscalYear = /^\d{4}-\d{4}$/.test(val);

      return !(isDateRange || isSingleDate || isFiscalYear);
    })
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
</nav>{selectedYear}<h1>{fromDate.format('YYYY-MM-DD')}to{toDate.format('YYYY-MM-DD')}</h1>
            </div>
          </div> */}
                        {appliedFilters.length > 0 &&
            Object.keys(appliedFilters[appliedFilters.length - 1]).length > 0 &&
            appliedFilters.filter((ele) => !["A", "H", "T", "YTD", "C"].includes(ele.key.replace(/"/g, "")))
              .length > 0 && ( 
              <div className="flex justify-start pt-1 pb-2">
                <Breadcrumb className="shadow-md border border-gray-200 bg-gray-100 px-3 py-1 rounded-lg">
                  <BreadcrumbList>
                        {/* Render all appliedFilters items */}
            {appliedFilters
              .filter((ele) => {
                const key = ele.key.replace(/"/g, "");
                const val = ele.value;
          
                // Exclude known keys (including DATE)
                if (["A", "H", "T", "YTD", "C", "DATE"].includes(key)) return false;
          
                // Exclude date ranges and fiscal years
                const isDateRange = /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(val);
                const isSingleDate = /^\d{4}-\d{2}-\d{2}$/.test(val);
                const isFiscalYear = /^\d{4}-\d{4}$/.test(val);
          
                return !(isDateRange || isSingleDate || isFiscalYear);
              })
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
                         </BreadcrumbList>
                </Breadcrumb>
              </div>
            )}
          
          
          {/* Chart Title */}
          <div className="flex justify-between">
            <div className="flex gap-3 items-center">
      <span className="flex items-center text-sm font-extrabold">
                {/* {getDynamicHeaderText()}  */}
                {/* Historical (2023-24) vs Actual (2024-25) vs Target - {salesUnit} */}
                {sbu} Cumulative Sales                     
              </span>
              <CustomLegend /> 
                  {/* <div className="text-xs flex text-gray-600">
                                      <span className="p-1 rounded-md text-xs bg-blue-100 ml-1">
                    {selectedYear}                </span>
                                                          <span className="p-1 rounded-md text-xs bg-blue-100 ml-1">
                    {fromDate.format("DD-MMM-YYYY")} to {toDate.format("DD-MMM-YYYY")}                </span>

                        </div> */}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative flex min-h-[320px] flex-col gap-3 p-0">
        {chartsBlockLoading ? (
          <div
            className="flex min-h-[480px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/90 py-20"
            role="status"
            aria-live="polite"
            aria-label="Loading charts"
          >
            <Loader2 className="h-10 w-10 shrink-0 animate-spin text-teal-600" aria-hidden />
            <span className="text-sm font-medium text-slate-600">Loading charts…</span>
          </div>
        ) : (
          <>
        {/* Chart-Table Pair 1 - Overall Data */}
        <div className="flex gap-4">
          <div className="w-3/5 shadow-md rounded-lg border border-gray-200">
            <div className="h-[450px]">
              {/* UNDER PERFORMANCE RED DOT */}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 40, right: 10, left: 10, bottom: 40 }}
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
                  <RechartTooltip content={<CustomTooltip />} cursor={{ fill: "#f0f0f0" }} />
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
                        Number(historical) > 0 ? (Number(historical) - Number(actual)) / Number(historical) : 0;
                      const targetUnderperformance =
                        Number(target) > 0 ? (Number(target) - Number(actual)) / Number(target) : 0;

                      const worstUnderperformance = Math.max(
                        underperformance,
                        targetUnderperformance
                      );

                      if (worstUnderperformance > maxUnderperformance) {
                        maxUnderperformance = worstUnderperformance;
                        mostUnderperformingIndex = index;
                      }
                    });

                    return Object.entries(categoryData).map(([key, { color, name }]) => {
                      const dataKey = getDataKey(key, mode, drillLevel);
                      return (
                        activeStates[key as keyof ActiveStates] && (
                          <Bar
                            key={key}
                            dataKey={dataKey}
                            name={name}
                            fill={color}
                            // onClick={handleBarClick}
                            cursor="cursor-not-allowed"
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
                                    return <RedIndicator x={x} y={y} width={width} />;
                                  }
                                  return null;
                                }}
                              />
                            )} */}
                          </Bar>
                        )
                      );
                    });
                  })()}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="w-2/5 h-[450px] flex overflow-y-scroll">
            <TablePerformancesales
              salesUnit={salesUnit}
              data={chartData}
              activeStates={activeStates}
              drillLevel={drillLevel}
              mode="cumulative"
            />
          </div>
        </div>

        {/* <span className="text-base font-bold">
                Monthly Sales Comparision (Actual vs History vs Target)
        </span>
      { isStackedCoulmnChartDataLoaded && <ReactECharts option={stackedCoulmnChartData} /> } */}


        <div className="flex gap-0">
          <div className="w-full pl-2 pr-2 py-2">
            <div className="flex justify-between content-between items-center gap-2">
              {
                sbu !== "Aviation" && sbu !== "GAS" && sbu !== "PETCHEM" ?
                  <p className="font-bold text-sm min-w-0 flex-1">Zone-wise Performance Variance for Actual vs Historical</p>
                  : <p className="font-bold text-sm min-w-0 flex-1">Monthly Performance Variance</p>
              }
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Clear zone, region & sales area selection and refresh"
                disabled={isRefreshingGeoZoneRetail || isGeoChartsLoading}
                aria-busy={isRefreshingGeoZoneRetail || isGeoChartsLoading}
                onClick={() => { void refreshZoneSectionRetail(); }}
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshingGeoZoneRetail || isGeoChartsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <ZoneAvsHHeatmap data={sbuHeatMapData} xaxisData={xaxisAHData} growthDetails={sbuGrowthDetails} onCellClick={handleZoneCellClick} />
          </div>

          {activeStates.T && sbuHeatMapData && sbuHeatMapData.length > 0 && (
            <div className="w-full pl-1 pr-2 py-2">
              <div className="flex justify-between content-between items-center gap-2">
                {
                  sbu !== "Aviation" && sbu !== "GAS" && sbu !== "PETCHEM" ?
                    <p className="font-bold text-sm min-w-0 flex-1">Zone-wise Performance Variance for Actual vs Target</p>
                    : <p className="font-bold text-sm min-w-0 flex-1">Monthly Performance Variance</p>
                }
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  title="Clear zone, region & sales area selection and refresh"
                  disabled={isRefreshingGeoZoneRetail || isGeoChartsLoading}
                  aria-busy={isRefreshingGeoZoneRetail || isGeoChartsLoading}
                  onClick={() => { void refreshZoneSectionRetail(); }}
                >
                  <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshingGeoZoneRetail || isGeoChartsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <ZoneAvsTHeatmap data={sbuHeatMapData} xaxisData={xaxisATData} growthDetails={sbuTgtGrowthDetails} />
            </div>
          )}
        </div>
        <div className="flex gap-2 px-2 pb-2">
          <div className="w-[38%] shrink-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-extrabold min-w-0 flex-1">Zone wise Monthwise sales (TMT)</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Clear zone, region & sales area selection and refresh"
                disabled={isRefreshingGeoZoneRetail || isGeoChartsLoading}
                aria-busy={isRefreshingGeoZoneRetail || isGeoChartsLoading}
                onClick={() => { void refreshZoneSectionRetail(); }}
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshingGeoZoneRetail || isGeoChartsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="h-[500px]">
              <RetailSalesPerformanceTable
                props={sbuOriginalData}
                onZoneClick={handleZoneClick}
              />
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="shadow-md rounded-xl overflow-hidden">
              <IndividualData id="actual-sales-chart" data={sbuMonthlyComparisonData} onRefresh={() => loadChartData('"SBU_Name"')} />
            </div>
            <div className="shadow-md rounded-xl overflow-hidden">
              <IndividualDataPercentage
                id="percentage-sales-chart"
                data={sbuMonthlyPercentageData}
                selectedYear={selectedYear}
                onRefresh={() => loadChartData('"SBU_Name"')}
              />
            </div>
          </div>
        </div>
        {
          sbu !== "Aviation" && sbu !== "GAS" && sbu !== "PETCHEM" && (
            <div className="">
              {showTargetChart && (
                <div className="flex items-stretch gap-2 px-2">
                  <div className="flex-1 shadow-md rounded-xl overflow-hidden">
                    <IndividualAvsT id="target-sales-chart" data={sbuMonthlyComparisonData} onRefresh={() => loadChartData('"SBU_Name"')} />
                  </div>
                  <div className="flex-1 shadow-md rounded-xl overflow-hidden">
                    <IndividualAvsTPercentage
                      id="percentage-target-chart"
                      data={sbuMonthlyPercentageData}
                      selectedYear={selectedYear}
                      onRefresh={() => loadChartData('"SBU_Name"')}
                    />
                  </div>
                </div>
              )}
              <Separator className="my-2 my-4 h-[3px] bg-cyan-700" />

              {/* Region heatmap + table side by side */}
              <div className="flex gap-3 px-2 pb-2">
                {/* Left: heatmap */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-extrabold min-w-0 flex-1">Region-wise Performance Variance</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Clear region & sales area selection and refresh"
                      disabled={isRefreshingGeoRegionRetail || isGeoChartsLoading}
                      aria-busy={isRefreshingGeoRegionRetail || isGeoChartsLoading}
                      onClick={() => { void refreshRegionSectionRetail(); }}
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshingGeoRegionRetail || isGeoChartsLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <RegionHeatmap
                    data={regionHeatMapData}
                    xaxisData={xaxisAHData}
                    growthDetailsAvH={regionGrowthDetails}
                    growthDetailsAvT={regionTgtGrowthDetails}
                    showTarget={activeStates.T && regionHeatMapData?.length > 0}
                    onCellClick={({ region, month, value }) =>
                      handleRegionCellClick({ region, month, value })
                    }
                  />
                </div>

                {/* Right: Region monthwise table */}
                <div className="w-[38%] shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-extrabold min-w-0 flex-1">Region wise Monthwise sales ({salesUnit})</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Clear region & sales area selection and refresh"
                      disabled={isRefreshingGeoRegionRetail || isGeoChartsLoading}
                      aria-busy={isRefreshingGeoRegionRetail || isGeoChartsLoading}
                      onClick={() => { void refreshRegionSectionRetail(); }}
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshingGeoRegionRetail || isGeoChartsLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <div className="h-[500px]">
                    <RegionPerformanceTable
                      props={zoneOriginalData}
                      onRegionClick={handleRegionClick}
                    />
                  </div>
                </div>
              </div>

              {/* Region monthly charts stacked below */}
              <div className="flex flex-col gap-2 px-2 pb-2">
                <div className="shadow-md rounded-xl overflow-hidden">
                  <RegionIndividualData
                    id="region-individual-sales-chart"
                    data={regionMonthlyComparisonData}
                  />
                </div>
                <div className="shadow-md rounded-xl overflow-hidden">
                  <RegionIndividualDataPercentage
                    id="region-percentage-sales-chart"
                    data={regionMonthlyPercentageData}
                  />
                </div>
              </div>
              {showTargetChart && (
                <div className="flex items-stretch gap-2 px-2 pb-2">
                  <div className="flex-1 shadow-md rounded-xl overflow-hidden">
                    <RegionAvsT
                      id="region-target-sales-chart"
                      data={regionMonthlyComparisonData}
                    />
                  </div>
                  <div className="flex-1 shadow-md rounded-xl overflow-hidden">
                    <RegionAvsTPercentage
                      id="region-target-percentage-chart"
                      data={regionMonthlyPercentageData}
                    />
                  </div>
                </div>
              )}

              <Separator className="my-2 my-4 h-[3px] bg-cyan-700" />
              <div className="px-2 pb-2 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-extrabold min-w-0 flex-1">Sales Area wise Performance Variance</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Clear sales area selection and refresh"
                    disabled={isRefreshingGeoSalesAreaRetail || isGeoChartsLoading}
                    aria-busy={isRefreshingGeoSalesAreaRetail || isGeoChartsLoading}
                    onClick={() => { void refreshSalesAreaSectionRetail(); }}
                  >
                    <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshingGeoSalesAreaRetail || isGeoChartsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <SalesAreaHeatmap
                  data={regionHeatMapData}
                  xaxisData={xaxisAHData}
                  growthDetailsAvH={regionGrowthDetails}
                  growthDetailsAvT={regionTgtGrowthDetails}
                  showTarget={activeStates.T && regionHeatMapData?.length > 0}
                  onCellClick={({ salesArea }) => handleSalesAreaCellClick({ salesArea })}
                />
              </div>
              <div className="flex gap-2 px-2 pb-2">
                <div className="w-[38%] shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-extrabold min-w-0 flex-1">Sales Area wise Monthwise sales ({salesUnit})</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Clear sales area selection and refresh"
                      disabled={isRefreshingGeoSalesAreaRetail || isGeoChartsLoading}
                      aria-busy={isRefreshingGeoSalesAreaRetail || isGeoChartsLoading}
                      onClick={() => { void refreshSalesAreaSectionRetail(); }}
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshingGeoSalesAreaRetail || isGeoChartsLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <div className="h-[500px]">
                    <SalesAreaPerformanceTable
                      props={regionOriginalData}
                      onRegionClick={handleSalesareaClick}
                    />
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="shadow-md rounded-xl overflow-hidden">
                    <SalesAreaIndividualData
                      id="sales-individual-sales-chart"
                      data={salesAreaMonthlyComparisonData}
                    />
                  </div>
                  <div className="shadow-md rounded-xl overflow-hidden">
                    <SalesAreaIndividualDataPercentage
                      id="sales-percentage-sales-chart"
                      data={salesAreaMonthlyPercentageData}
                    />
                  </div>
                </div>
              </div>

              {showTargetChart && (
                <div className="flex items-stretch gap-2 px-2 pb-2">
                  <div className="flex-1 shadow-md rounded-xl overflow-hidden">
                    <SalesAreaAvsT
                      id="salesarea-target-chart"
                      data={salesAreaMonthlyComparisonData}
                    />
                  </div>
                  <div className="flex-1 shadow-md rounded-xl overflow-hidden">
                    <SalesAreaAvsTPercentage
                      id="salesarea-target-percentage-chart"
                      data={salesAreaMonthlyPercentageData}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        }
          </>
        )}
      </CardContent>
      {isExpanded && <ExpandedChart />}
    </Card>
  );
};

export default RetailSalesPerformance;
