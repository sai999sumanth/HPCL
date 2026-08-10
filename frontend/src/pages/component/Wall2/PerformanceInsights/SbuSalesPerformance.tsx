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
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
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
import dayjs, { Dayjs } from "dayjs";
import convertToFilters from "@/utils/dynamicFilter";
import { RetailSalesDropdowns } from "../SalesDropdowns";
import TablePerformancesales from "../TablePerformancesales";
import { fetchChartData, fetchDistinctValues } from "../api";
import RetailSalesPerformanceTable from "./retailPerformanceTable";
import IndividualData from "./individualData";
import IndividualDataPercentage from "./individualDataPercentage";
import { Separator } from "@/@/components/ui/separator";
import RegionPerformanceTable from "./region/regionPerformanceTable";
import RegionIndividualData from "./region/regionIndividualData";
import RegionIndividualDataPercentage from "./region/regionPercentage";
import SalesAreaPerformanceTable from "./salesarea/salesareaTable";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import SalesAreaIndividualDataPercentage from "./salesarea/salesareaPercentage";
import SalesAreaIndividualData from "./salesarea/salesareaIndividual";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { Calendar, Loader2, RotateCcw } from "lucide-react";
import IndividualAvsTPercentage from "./IndividualAvsTPercentage";
import RegionAvsT from "./region/regionAvsT";
import RegionAvsTPercentage from "./region/regionAvsTpercentage";
import SalesAreaAvsT from "./salesarea/salesareaAvsT";
import SalesAreaAvsTPercentage from "./salesarea/salesareaAvsTPercentage";
import IndividualAvsT from "./IndividualAvsT";
import ZoneWiseFilterMenu, { ZoneWiseFilterTriggerButton } from "./ZoneWiseFilterMenu";
import ZoneHeatmap from "./zone-heatmap/ZoneHeatmap";
import RegionHeatmap from "./region-heatmap/RegionHeatmap";
import SalesAreaHeatmap from "./salesarea-heatmap/SalesAreaHeatmap";
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface GrowthIndicator {
  title: string;
  value: number;
}

interface DrillStateIndicatorProps {
  drillLevel: number;
  drillHistory: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FY_START_MONTH = 3;

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

// ─── Fiscal year helpers ──────────────────────────────────────────────────────

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
  const fyStartThisCalendarYear = d.year(today.year()).month(FY_START_MONTH).date(1).startOf("day");
  if (today.isSame(fyStartThisCalendarYear, "day")) return getPreviousFiscalYearString(d);
  return getCurrentFiscalYearString(d);
};

const isCurrentFiscalYearSelection = (fy: string) => fy === getCurrentFiscalYearString();

const buildFiscalYearSelectOptions = (d: dayjs.Dayjs = dayjs()) => {
  const current = getCurrentFiscalYearString(d);
  const previous = getPreviousFiscalYearString(d);
  if (!previous) return [current];
  return [current, previous];
};

const getRetailFiscalYearDateRange = (fyLabel: string) => {
  const fy = parseFiscalYearLabel(fyLabel);
  if (!fy) return { from: dayjs().month(3).date(1), to: dayjs().subtract(1, "day") };
  if (!isCurrentFiscalYearSelection(fyLabel)) {
    return { from: dayjs().year(fy.start).month(3).date(1), to: dayjs().year(fy.end).month(2).date(31) };
  }
  return { from: dayjs().year(fy.start).month(3).date(1), to: dayjs().subtract(1, "day") };
};

const getInitialDrilldownList = (selectedYorM: "Y" | "M") => {
  return selectedYorM === "Y"
    ? [
      { key: "cumulative", isActive: false, drillLevel: 1 },
      { key: "Zone_Name", isActive: false, drillLevel: 2 },
      { key: "Region_Name", isActive: false, drillLevel: 3 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 4 },
      { key: "ProductName", isActive: false, drillLevel: 5 },
      { key: "month_name", isActive: false, drillLevel: 6 },
    ]
    : [
      { key: "month_name", isActive: false, drillLevel: 1 },
      { key: "Zone_Name", isActive: false, drillLevel: 2 },
      { key: "Region_Name", isActive: false, drillLevel: 3 },
      { key: "SalesArea_Name", isActive: false, drillLevel: 4 },
      { key: "ProductName", isActive: false, drillLevel: 5 },
    ];
};

const getDataKey = (key: string, _mode: ChartMode, _drillLevel: number): string => {
  switch (key) {
    case "A": return "ACTUAL_TMT_SALES";
    case "H": return "ACTUAL_HISTORY_TMT_SALES";
    case "T": return "TARGET_TMT_SALES";
    default: return "";
  }
};

const getXAxisKey = (drillLevel: number, selected: "Y" | "M"): string => {
  const keys = selected === "Y"
    ? ["cumulative", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName", "month_name"]
    : ["month_name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"];
  return keys[drillLevel] || "ProductName";
};

const CustomStepper = styled(Stepper)({
  padding: "2px",
  borderRadius: "8px",
  "& .MuiStepLabel-label": {
    color: "#333",
    "&.Mui-active": { color: "#00a495 !important" },
    "&.Mui-completed": { color: "#00a495 !important" },
  },
  "& .MuiStepIcon-root": {
    color: "#ccc",
    "&.Mui-active": { color: "#00a495" },
    "&.Mui-completed": { color: "#00a495" },
  },
});

// ─── Transform ────────────────────────────────────────────────────────────────

const transformChartData = (
  responseData: any, mode: ChartMode, drillLevel: number,
  activeStates: ActiveStates, selected: string, sbu: string
): ChartData[] => {
  if (!responseData) return [];
  const validSelected: "Y" | "M" = selected === "M" ? "M" : "Y";
  const isArray = Array.isArray(responseData);
  const xAxisKey = getXAxisKey(drillLevel, validSelected);
  const multiplyFactor = sbu === "GAS" ? 1000 : 1;

  if (!isArray) {
    if (drillLevel === 0) {
      const dataKey = responseData.month_name ? "month_name" : "cumulative";
      return Object.keys(responseData[dataKey] || {})
        .map((key) => ({
          name: responseData[dataKey][key] ?? "",
          ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
          TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
          ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
        }))
        .filter((item) =>
          item.name.trim() !== "" && item.name.trim() !== "-" &&
          (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0)
        );
    }
    return Object.keys(responseData[xAxisKey] || {})
      .map((key) => ({
        name: responseData[xAxisKey]?.[key] ?? "",
        ACTUAL_TMT_SALES: responseData.ACTUAL_TMT_SALES?.[key] ?? 0,
        TARGET_TMT_SALES: responseData.TARGET_TMT_SALES?.[key] ?? 0,
        ACTUAL_HISTORY_TMT_SALES: responseData.ACTUAL_HISTORY_TMT_SALES?.[key] ?? 0,
      }))
      .filter((item) =>
        item.name.trim() !== "" && item.name.trim() !== "-" &&
        (item.ACTUAL_TMT_SALES !== 0 || item.TARGET_TMT_SALES !== 0 || item.ACTUAL_HISTORY_TMT_SALES !== 0)
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
    .map(([stateKey]) => ({ key: `"${stateKey}"`, cond: "equals", value: "true" }));
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-bold text-gray-800 mb-2 text-xs">{label}</p>
        {payload.map((entry: any, index: number) => {
          const formattedValue = entry.value < 10 ? entry.value.toFixed(1) : Math.round(entry.value);
          return (
            <p key={index} className="text-xs flex justify-between items-center gap-4" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-semibold">{parseFloat(formattedValue).toLocaleString()} TMT</span>
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
  return (
    <g transform={`translate(${x},${y})`}>
      {words.map((word: string, index: number) => (
        <text key={index} x={0} y={0} dy={index * lineHeight + 10} textAnchor="middle" fill="#333" fontSize="0.65rem">
          {word}
        </text>
      ))}
    </g>
  );
};

const renderCustomizedLabel = (props: any) => {
  const { x, y, width, value } = props;
  const radius = 10;
  const angle = -45;
  const formattedValue = value < 10 ? value.toFixed(1) : Math.round(value);
  return (
    <g>
      <text className="text-xs" x={x + width / 2} y={y - radius} fill="#333" textAnchor="middle"
        dominantBaseline="middle" transform={`rotate(${angle}, ${x + width / 3}, ${y - radius})`} fontWeight="600">
        {parseFloat(formattedValue).toLocaleString()}
      </text>
    </g>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function keepPreviousIfEqual<T>(prev: T, next: T | undefined | null): T {
  if (next === undefined || next === null) return prev;
  if (Object.is(prev, next)) return prev;
  if (typeof next === "object" && next !== null && typeof prev === "object" && prev !== null) {
    try {
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
    } catch { /* ignore */ }
  }
  return next as T;
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

// ─── Main component ───────────────────────────────────────────────────────────

interface SbuSalesPerformanceProps { sbu: string; }

const SbuSalesPerformance: React.FC<SbuSalesPerformanceProps> = ({ sbu }) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [salesUnit, setSalesUnit] = useState("TMT");
  const [isExpanded, setIsExpanded] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    SBU_Name: "", Zone_Name: "", Region_Name: "", SalesArea_Name: "", ProductName: "",
  });
  const [distinctFilters, setDistinctFilters] = useState<FilterState>({
    SBU_Name: "", Zone_Name: "", Region_Name: "", SalesArea_Name: "", ProductName: "",
  });
  const [activeStates, setActiveStates] = useState<ActiveStates>({ A: true, H: true, T: true, C: true });
  const [appliedFilters, setAppliedFilters] = useState<FilterOption[]>(() => [
    ...convertToFilters({ A: true, H: true, T: true, C: true }),
    { key: '"YTD"', cond: "equals", value: "true" },
  ]);
  const filterOrder = ["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"];

  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<ChartMode>("ytd");
  const [drillHistory, setDrillHistory] = useState<string[]>(
    mode === "month" ? [`FY ${getDefaultSelectedFiscalYear()}`] : []
  );
  const [selectedYear, setSelectedYear] = useState(() => getDefaultSelectedFiscalYear());

  const fiscalYearMonthKey = dayjs().format("YYYY-MM");
  const fiscalYearOptions = useMemo(() => buildFiscalYearSelectOptions(), [fiscalYearMonthKey]);

  useEffect(() => {
    const allowed = new Set(fiscalYearOptions);
    if (selectedYear && !allowed.has(selectedYear)) setSelectedYear(getDefaultSelectedFiscalYear());
  }, [selectedYear, fiscalYearOptions]);

  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSalesArea, setSelectedSalesArea] = useState("");
  const [selectedProductName, setSelectedProductName] = useState<string[]>([]);

  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [zoneOptions, setZoneOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [salesAreaOptions, setSalesAreaOptions] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<string[]>([]);

  const [isRefreshingGeoZone, setIsRefreshingGeoZone] = useState(false);
  const [isRefreshingGeoRegion, setIsRefreshingGeoRegion] = useState(false);
  const [isRefreshingGeoSalesArea, setIsRefreshingGeoSalesArea] = useState(false);
  /** True while SBU/zone/region summary + heatmap APIs run (filters, heatmap drill, refresh). */
  const [isGeoChartsLoading, setIsGeoChartsLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [crossFilters, setCrossFilters] = useState<Filter[]>([]);
  const [selectedYorM, setSelectedYorM] = useState<"Y" | "M">("Y");
  const mainChartLoadIdRef = useRef(0);
  const geoChartsLoadGenRef = useRef(0);

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
  let [dataSeparation, setDataSeparation] = useState([]);
  let [percentageData, setPercentageData] = useState([]);
  const [selectedZoneNameForTable, setSelectedZoneNameForTable] = useState<string>("");
  let [regionSeparation, setRegionSeparation] = useState([]);
  let [regionPercentage, setRegionPercentage] = useState([]);
  const [selectedRegionNameForTable, setSelectedRegionNameForTable] = useState<string>("");
  let [regionHeatMapData, setRegionHeatMapData] = useState([]);
  let [salesSeparation, setSalesSeparation] = useState([]);
  let [salesPercentage, setSalesPercentage] = useState([]);
  const [selectedSalesAreaNameForTable, setSelectedSalesAreaNameForTable] = useState<string>("");
  const [xaxisAHData, setXaxisAHData] = useState([]);
  const [xaxisATData, setXaxisATData] = useState([]);
  const [headingDate, setHeadingDate] = useState("");
  const [selectedMonths, setSelectedMonths] = useState([]);

  const [fromDate, setFromDate] = useState(() => getRetailFiscalYearDateRange(getDefaultSelectedFiscalYear()).from);
  const [toDate, setToDate] = useState(() => getRetailFiscalYearDateRange(getDefaultSelectedFiscalYear()).to);

  const formatHeadingDate = (from: Dayjs, to: Dayjs, year: string) => {
    if (year && year.includes("-")) {
      const [startYear, endYear] = year.split("-");
      const currentFiscalYear = getCurrentFiscalYearString();
      if (year === currentFiscalYear) {
        return `${from.format("MMMM D")}, ${startYear} to ${to.format("MMMM D")}, ${to.format("YYYY")}`;
      } else {
        return `${from.format("MMMM D")}, ${startYear} to ${to.format("MMMM D")}, ${endYear}`;
      }
    }
    return `${from.format("MMMM D")}, ${from.format("YYYY")} to ${to.format("MMMM D")}, ${to.format("YYYY")}`;
  };

  useEffect(() => {
    if (fromDate && toDate && selectedYear) setHeadingDate(formatHeadingDate(fromDate, toDate, selectedYear));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

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

  let [drilldownList, setDrilldownList] = useState(getInitialDrilldownList(selectedYorM));

  useEffect(() => {
    if (mode === "date") return;
    const { from, to } = getRetailFiscalYearDateRange(selectedYear);
    setFromDate(from);
    setToDate(to);
  }, [mode, selectedYear]);

  useEffect(() => { setDrilldownList(getInitialDrilldownList(selectedYorM)); }, [selectedYorM]);

  const removeDuplicateFilters = (data) => {
    const filterMap = new Map();
    [...data].reverse().forEach((filter) => { if (!filterMap.has(filter.key)) filterMap.set(filter.key, filter); });
    return Array.from(filterMap.values()).reverse();
  };

  const distinctFilterChange = (key: keyof FilterState, value: string) => {
    const currentIndex = filterOrder.indexOf(key);
    const newFilters = { ...distinctFilters };
    filterOrder.forEach((filterKey, index) => {
      if (index === currentIndex) newFilters[filterKey as keyof FilterState] = value;
      else if (index > currentIndex) newFilters[filterKey as keyof FilterState] = "";
      else newFilters[filterKey as keyof FilterState] = distinctFilters[filterKey as keyof FilterState];
    });
    setDistinctFilters(newFilters);
    const newAppliedFilters: FilterOption[] = [];
    filterOrder.forEach((filterKey, index) => {
      if (index < currentIndex && newFilters[filterKey as keyof FilterState]) {
        newAppliedFilters.push({ key: `${filterKey}`, cond: "=", value: newFilters[filterKey as keyof FilterState] });
      }
    });
    if (value) newAppliedFilters.push({ key: `${key}`, cond: "=", value });
    return newAppliedFilters;
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const currentIndex = filterOrder.indexOf(key);
    const newFilters = { ...filters };
    filterOrder.forEach((filterKey, index) => {
      if (index === currentIndex) newFilters[filterKey as keyof FilterState] = value;
      else if (index > currentIndex) newFilters[filterKey as keyof FilterState] = "";
      else newFilters[filterKey as keyof FilterState] = filters[filterKey as keyof FilterState];
    });
    setFilters(newFilters);
    const newAppliedFilters: FilterOption[] = [];
    filterOrder.forEach((filterKey, index) => {
      if (index < currentIndex && newFilters[filterKey as keyof FilterState]) {
        newAppliedFilters.push({ key: `"${filterKey}"`, cond: "equals", value: newFilters[filterKey as keyof FilterState] });
      }
    });
    if (value) newAppliedFilters.push({ key: `"${key}"`, cond: "equals", value });
    setAppliedFilters(newAppliedFilters);
    return newAppliedFilters;
  };

  const loadData = useCallback(async () => {
    const loadId = ++mainChartLoadIdRef.current;
    setIsLoading(true);
    const ytd = mode === "ytd" || mode === "date" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    const retailFilter = [{ key: '"SBU_Name"', cond: "equals", value: sbu }];
    const updatedFilters = [...retailFilter, ...appliedFilters, ...ytd];
    try {
      const originalFilter = removeDuplicateFilters(updatedFilters);
      const originalCrossFilter = removeDuplicateFilters(crossFilters);
      originalFilter.push({ key: '"fiscal_year"', cond: "equals", value: selectedYear });
      const response = await fetchChartData({
        filters: originalFilter,
        cross_filters: originalCrossFilter,
        action: mode === "month" || mode === "ytd" || mode === "date" ? "m60_performance" : "yearly_sales_performance",
        drill_state: "",
      });
      if (loadId !== mainChartLoadIdRef.current) return;
      setSalesUnit(response?.data?.sales_unit || "TMT");
      if (response.status && response.data) {
        if (
          Object.keys(response.data.data?.ACTUAL_HISTORY_TMT_SALES).length === 0 ||
          Object.keys(response.data.data?.ACTUAL_TMT_SALES).length === 0
        ) {
          toast.warning("No data present for the selected combination.");
          return;
        }
        setChartData(
          transformChartData(
            response.data?.data,
            mode,
            drillLevel,
            activeStatesFromAppliedFilters(appliedFilters),
            selectedYorM,
            sbu,
          ),
        );
      } else {
        toast.warning(response.message || "No data available for the selected filters.");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (loadId === mainChartLoadIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [drillLevel, mode, appliedFilters, crossFilters, selectedYear, sbu, selectedYorM]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadChartData = useCallback(async (drillState) => {
    try {
      const retailFilter = [{ key: '"SBU_Name"', cond: "equals", value: sbu }];
      const updatedFilters = [...retailFilter, ...appliedFilters];
      const originalFilter = removeDuplicateFilters(updatedFilters);
      originalFilter.push({ key: '"fiscal_year"', cond: "equals", value: selectedYear });
      const response = await fetchChartData({
        filters: originalFilter, cross_filters: [], action: "m60_performance",
        drill_state: drillState, time_grain: "Monthly", resp_format: "summary",
      });
      if (response.status && response.data) {
        const initialResponseData = response.data?.data;
        const responseData = Array.isArray(initialResponseData)
          ? initialResponseData.filter((item) =>
            item.Zone_Name !== "-" && item.Zone_Name !== "" &&
            item.Region_Name !== "-" && item.Region_Name !== "" &&
            item.SalesArea_Name !== "-" && item.SalesArea_Name !== ""
          )
          : initialResponseData;
        switch (drillState) {
          case '"SBU_Name"': sbuOriginalData = responseData; setSbuOriginalData(responseData); break;
          case '"Zone_Name"': zoneOriginalData = responseData; setZoneOriginalData(responseData); break;
          case '"Region_Name"': regionOriginalData = responseData; setRegionOriginalData(responseData); break;
          default: break;
        }
      }
    } catch (error) { console.error("Error fetching chart data:", error); }
  }, [appliedFilters, selectedYear, sbu]);

  const loadHeatMapChartData = useCallback(async (drillState) => {
    try {
      const retailFilter = [{ key: '"SBU_Name"', cond: "equals", value: sbu }];
      const updatedFilters = [...retailFilter, ...appliedFilters];
      const originalFilter = removeDuplicateFilters(updatedFilters);
      originalFilter.push({ key: '"fiscal_year"', cond: "equals", value: selectedYear });
      const response = await fetchChartData({
        filters: originalFilter, cross_filters: [], action: "m60_performance",
        drill_state: drillState, time_grain: "Monthly", resp_format: "heat_map",
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

        const formatGrowthDetails = (details: any) => {
          if (Array.isArray(details)) return details;
          if (details && typeof details === 'object') {
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
            if (growthDetails && Array.isArray(growthDetails) && growthDetails.length > 0 && hasA && hasH) {
              setSbuGrowthDetails(formatGrowthDetails(growthDetails));
            }
            if (tgtGrowthDetails && Array.isArray(tgtGrowthDetails) && tgtGrowthDetails.length > 0 && hasA && hasT) {
              setTgtSbuGrowthDetails(formatGrowthDetails(tgtGrowthDetails));
            }
            break;
          case '"Zone_Name"':
            setZoneHeatMapData(responseData);
            if (growthDetails && Array.isArray(growthDetails) && growthDetails.length > 0 && hasH) {
              setZoneGrowthDetails(formatGrowthDetails(growthDetails));
            }
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
          default: break;
        }
      }
    } catch (error) { console.error("Error fetching heatmap data:", error); }
  }, [appliedFilters, selectedYear, sbu]);

  useEffect(() => {
    const gen = ++geoChartsLoadGenRef.current;
    let cancelled = false;
    setIsGeoChartsLoading(true);
    void (async () => {
      try {
        await Promise.all([
          loadChartData('"SBU_Name"'),
          loadHeatMapChartData('"SBU_Name"'),
          loadChartData('"Zone_Name"'),
          loadHeatMapChartData('"Zone_Name"'),
          loadChartData('"Region_Name"'),
          loadHeatMapChartData('"Region_Name"'),
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

  const loadDistinctValues = useCallback(async (column: string[], whereCond: any = []) => {
    const baseWhere = [
      { key: "Zone_Name", value: "-", cond: "!=" },
      { key: "Zone_Name", value: "", cond: "!=" },
      { key: "SBU_Name", value: "0", cond: "!=" },
      { key: "SBU_Name", value: sbu, cond: "=" },
    ];
    try {
      const response = await fetchDistinctValues({
        connection_id: "1", schema: "public", table: "MOM_DAY_LEVEL_DATA",
        column, where_cond: [...baseWhere, ...whereCond],
      });
      if (response.status && response.data) return response.data;
    } catch (error) { console.error("Error fetching distinct values:", error); }
    return [];
  }, [sbu]);

  useEffect(() => {
    const init = async () => {
      const all = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name"]);
      setZoneOptions(all?.["Zone_Name"] ?? []);
      setRegionOptions(all?.["Region_Name"] ?? []);
      setSalesAreaOptions(all?.["SalesArea_Name"] ?? []);
    };
    init();
  }, [loadDistinctValues]);

  const toggleButtonState = (key: keyof ActiveStates) => {
    setActiveStates((prev) => ({ ...prev, [key]: !prev[key] }));
    const filterKey = `"${key}"`;
    if (activeStates[key]) {
      setAppliedFilters((prev) => prev.filter((f) => f.key !== filterKey));
    } else {
      setAppliedFilters((prev) => [...prev, { key: filterKey, cond: "equals", value: "true" }]);
    }
  };

  const handleZoneChange = async (key: string, value: string) => {
    setIsGeoChartsLoading(true);
    setSelectedZoneNameForTable("");
    setSelectedRegionNameForTable("");
    setSelectedSalesAreaNameForTable("");
    try {
      setSelectedZone(value);
      setSelectedRegion("");
      setSelectedSalesArea("");
      setSelectedProductName([]);
      const defaultFilter = handleFilterChange("Zone_Name", value);
      if (value) {
        const res = await loadDistinctValues(["Region_Name", "SalesArea_Name"], [{ key: "Zone_Name", cond: "=", value }]);
        setRegionOptions(res?.["Region_Name"] ?? []);
        setSalesAreaOptions(res?.["SalesArea_Name"] ?? []);
      }
      const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C });
      const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
      setAppliedFilters([...perspectiveFilters, ...ytdFilters, ...defaultFilter]);
    } catch (e) {
      console.error("handleZoneChange:", e);
      setIsGeoChartsLoading(false);
    }
  };

  const handleRegionChange = async (key: string, value: string) => {
    setIsGeoChartsLoading(true);
    setSelectedRegionNameForTable("");
    setSelectedSalesAreaNameForTable("");
    try {
      setSelectedRegion(value);
      setSelectedSalesArea("");
      setSelectedProductName([]);
      const defaultFilter = handleFilterChange("Region_Name", value);
      if (value) {
        const res = await loadDistinctValues(["SalesArea_Name"], [
          ...(selectedZone ? [{ key: "Zone_Name", cond: "=", value: selectedZone }] : []),
          { key: "Region_Name", cond: "=", value },
        ]);
        setSalesAreaOptions(res?.["SalesArea_Name"] ?? []);
      }
      const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C });
      const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
      setAppliedFilters([...perspectiveFilters, ...ytdFilters, ...defaultFilter]);
    } catch (e) {
      console.error("handleRegionChange:", e);
      setIsGeoChartsLoading(false);
    }
  };

  const handleSalesAreaChange = (key: string, value: string) => {
    setIsGeoChartsLoading(true);
    setSelectedSalesAreaNameForTable("");
    setSelectedSalesArea(value);
    setSelectedProductName([]);
    const defaultFilter = handleFilterChange("SalesArea_Name", value);
    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C });
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    setAppliedFilters([...perspectiveFilters, ...ytdFilters, ...defaultFilter]);
  };

  const handleProductNameChange = (key: string, value: string[]) => {
    setSelectedProductName(value);
    const perspectiveFilters = convertToFilters({ ...activeStates, C: selectedYorM === "M" ? false : activeStates.C });
    const ytdFilters = mode === "ytd" ? [{ key: '"YTD"', cond: "equals", value: "true" }] : [];
    const locationFilters: FilterOption[] = [];
    if (selectedZone) locationFilters.push({ key: '"Zone_Name"', cond: "equals", value: selectedZone });
    if (selectedRegion) locationFilters.push({ key: '"Region_Name"', cond: "equals", value: selectedRegion });
    if (selectedSalesArea) locationFilters.push({ key: '"SalesArea_Name"', cond: "equals", value: selectedSalesArea });
    if (value.length > 0) locationFilters.push({ key: '"ProductName"', cond: "in", value: value.join(",") });
    setAppliedFilters([...perspectiveFilters, ...ytdFilters, ...locationFilters]);
  };

  const handleYearChange = (value: string) => {
    if (value === selectedYear) return;
    setSelectedYear(value);
    const { from, to } = getRetailFiscalYearDateRange(value);
    setFromDate(from);
    setToDate(to);
    setAppliedFilters((prev) => {
      const withoutFy = prev.filter((f) => f.key !== '"fiscal_year"');
      return [...withoutFy, { key: '"fiscal_year"', cond: "equals", value }];
    });
    setDrillHistory((prev) => [`FY ${value}`, ...prev.slice(1)]);
  };

  const handleModeChange = useCallback((newMode: ChartMode) => {
    if (newMode === "ytd") {
      if (mode === "ytd") {
        setMode("month");
        setAppliedFilters((prev) => prev.filter((f) => f.key !== '"YTD"'));
        return;
      }
      setMode("ytd");
      setAppliedFilters((prev) => {
        const withoutDate = prev.filter((f) => f.key !== '"DATE"');
        const hasYTD = withoutDate.some((f) => f.key === '"YTD"');
        return hasYTD ? withoutDate : [...withoutDate, { key: '"YTD"', cond: "equals", value: "true" }];
      });
    } else {
      setMode(newMode);
    }
  }, [mode]);

  const resetFilters = useCallback(async () => {
    const { from, to } = getRetailFiscalYearDateRange(selectedYear);
    setFromDate(from);
    setToDate(to);
    const perspectiveKeys = selectedYorM === "Y" ? ['"A"', '"H"', '"T"', '"C"'] : ['"A"', '"H"', '"T"'];
    const perspectiveFiltersLocal = appliedFilters.filter((f) => perspectiveKeys.includes(f.key));
    const resetFilter = [{ key: '"YTD"', cond: "equals", value: "true" }];
    setDrillLevel(0);
    setMode("ytd");
    setAppliedFilters([...resetFilter, ...perspectiveFiltersLocal]);
    setCrossFilters([]);
    setSelectedZone("");
    setSelectedRegion("");
    setSelectedSalesArea("");
    setSelectedProductName([]);
    setDrillHistory(mode === "month" ? [`FY ${selectedYear}`] : []);
    setFilters({ SBU_Name: "", Zone_Name: "", Region_Name: "", SalesArea_Name: "", ProductName: "" });
    setDrilldownList(getInitialDrilldownList(selectedYorM));
  }, [mode, filters, appliedFilters, crossFilters, selectedYorM, selectedYear]);

  const handleBackClick = useCallback(() => {
    if (drillLevel > 0 && crossFilters.length > 0) {
      const lastActiveDrill = [...drilldownList].reverse().find((d) =>
        crossFilters.some((f) => f.key.replace(/"/g, "") === d.key)
      );
      const updatedCrossFilters = crossFilters.filter(
        (f) => f.key.replace(/"/g, "") !== lastActiveDrill?.key
      );
      setCrossFilters(updatedCrossFilters);
      appliedFilters.length > 5
        ? setAppliedFilters(appliedFilters.slice(0, -1))
        : setAppliedFilters(appliedFilters);
      setDrillHistory((prev) => [...prev.slice(0, -1)]);
    }
  }, [drillLevel, appliedFilters, drillHistory, mode, selectedYorM, drilldownList, crossFilters]);

  const handleMonthSelect = (months: string[]) => {
    setSelectedMonths(months as any);
    if (months.length > 0) {
      const monthFilter = { key: '"month_name"', cond: "in", value: months.join(",") };
      setAppliedFilters((prev) => {
        const withoutMonth = prev.filter((f) => f.key !== '"month_name"');
        return [...withoutMonth, monthFilter];
      });
    } else {
      setAppliedFilters((prev) => prev.filter((f) => f.key !== '"month_name"'));
    }
  };

  const handleFromDateChange = (newValue) => setFromDate(newValue);
  const handleToDateChange = (newValue) => setToDate(newValue);

  const handlePopoverOpenChange = (open: boolean) => {
    if (open && mode === "ytd") return;
    if (open) {
      const { from, to } = getRetailFiscalYearDateRange(selectedYear);
      setFromDate(from);
      setToDate(to);
    }
    setIsOpen(open);
  };

  useEffect(() => {
    if (mode === "ytd") setIsOpen(false);
  }, [mode]);

  const resetDate = () => {
    const { from, to } = getRetailFiscalYearDateRange(selectedYear);
    setFromDate(from);
    setToDate(to);
  };

  const formatDate = (dateString: string): string => {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/,/g, "");
      }
    }
    const customDateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dateString.match(customDateRegex);
    if (match) {
      const [_, day, month, year] = match;
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/,/g, "");
      }
    }
    return dateString;
  };

  const handleDateFilter = () => {
    if (fromDate && toDate) {
      const fromISO = fromDate.format("YYYY-MM-DD");
      const toISO   = toDate.format("YYYY-MM-DD");
      const perspectiveFilters = convertToFilters({ ...activeStates });
      const newFilters = [...perspectiveFilters, { key: '"DATE"', cond: "equals", value: `${fromISO},${toISO}` }];
      if (selectedYorM === "Y") newFilters.push({ key: '"C"', cond: "equals", value: "true" });
      setAppliedFilters(newFilters.filter((f) => f.key !== '"YTD"'));
      setMode("date");
      setDrillHistory([`${formatDate(fromISO)} - ${formatDate(toISO)}`]);
      setHeadingDate(formatHeadingDate(fromDate, toDate, selectedYear));
      setIsOpen(false);
    }
  };

  const CustomLegend = () => (
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

  const handleZoneClick = (zoneData) => { setDataSeparation(() => zoneData); setPercentageData(() => zoneData); setSelectedZoneNameForTable(zoneData?.Zone_Name ?? ""); };
  const handleRegionClick = (regionData) => { setRegionSeparation(regionData); setRegionPercentage(regionData); setSelectedRegionNameForTable(regionData?.Region_Name ?? ""); };
  const handleSalesareaClick = (salesData) => { setSalesSeparation(salesData); setSalesPercentage(salesData); setSelectedSalesAreaNameForTable(salesData?.SalesArea_Name ?? ""); };

  const handleZoneCellClick = ({ zone }) => handleZoneChange("Zone_Name", zone);
  const handleRegionCellClick = ({ region }) => handleRegionChange("Region_Name", region);
  const handleSalesAreaCellClick = ({ salesArea }: { salesArea: string }) =>
    handleSalesAreaChange("SalesArea_Name", salesArea);

  /** Clear zone / region / sales-area filters from heatmaps & tables, reload APIs, reset dropdown options */
  const refreshZoneSection = async () => {
    if (isRefreshingGeoZone) return;
    setIsRefreshingGeoZone(true);
    setSelectedZoneNameForTable("");
    setSelectedRegionNameForTable("");
    setSelectedSalesAreaNameForTable("");
    try {
      await handleZoneChange("Zone_Name", "");
      const all = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name"]);
      setZoneOptions(all?.["Zone_Name"] ?? []);
      setRegionOptions(all?.["Region_Name"] ?? []);
      setSalesAreaOptions(all?.["SalesArea_Name"] ?? []);
    } catch (e) {
      console.error("refreshZoneSection:", e);
    } finally {
      setIsRefreshingGeoZone(false);
    }
  };

  /** Clear region & sales-area selection (keep zone), reload region-level data */
  const refreshRegionSection = async () => {
    if (isRefreshingGeoRegion) return;
    setIsRefreshingGeoRegion(true);
    setSelectedRegionNameForTable("");
    setSelectedSalesAreaNameForTable("");
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
      console.error("refreshRegionSection:", e);
    } finally {
      setIsRefreshingGeoRegion(false);
    }
  };

  /** Clear sales-area selection only, reload sales-area drill data */
  const refreshSalesAreaSection = async () => {
    if (isRefreshingGeoSalesArea) return;
    setIsRefreshingGeoSalesArea(true);
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
      console.error("refreshSalesAreaSection:", e);
    } finally {
      setIsRefreshingGeoSalesArea(false);
    }
  };

  const showTargetChart = dataSeparation && Object.keys(dataSeparation).some((key) => key.includes("_target"));

  const sbuMonthlyComparisonData = useMemo(() => [dataSeparation], [dataSeparation]);
  const sbuMonthlyPercentageData = useMemo(() => [percentageData], [percentageData]);
  const regionMonthlyComparisonData = useMemo(() => [regionSeparation], [regionSeparation]);
  const regionMonthlyPercentageData = useMemo(() => [regionPercentage], [regionPercentage]);
  const salesAreaMonthlyComparisonData = useMemo(() => [salesSeparation], [salesSeparation]);
  const salesAreaMonthlyPercentageData = useMemo(() => [salesPercentage], [salesPercentage]);

  interface RedIndicatorProps { x?: any; y?: any; width?: any; }
  const RedIndicator: React.FC<RedIndicatorProps> = ({ x = 0, y = 0, width = 0 }) => (
    <svg x={x + width / 2 - 8} y={y - 45}><circle cx="10" cy="10" r="10" fill="red" /></svg>
  );

  const toggleExpand = () => setIsExpanded(!isExpanded);
  const formatNumber = (value) => value.toLocaleString();

  const DrillIndicator: React.FC<DrillStateIndicatorProps> = ({ drillLevel, drillHistory }) => {
    const updatedDrilldownList = drilldownList.map((drill) => ({
      ...drill,
      isActive: crossFilters.some((filter) => filter.key.replace(/"/g, "") === drill.key),
    }));
    const lastActiveDrill = [...updatedDrilldownList].reverse().find((d) => d.isActive);
    const drillcount = lastActiveDrill ? lastActiveDrill.drillLevel : 0;
    return (
      <div className="space-y-2 text-xs px-8">
        <CustomStepper style={{ width: "650px" }} activeStep={drillcount} alternativeLabel>
          {updatedDrilldownList.map((drill) => (
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

  // ─── Return ────────────────────────────────────────────────────────────────

  const dateRangePickerDisabled = mode === "ytd";
  const chartsBlockLoading = isLoading || isGeoChartsLoading;

  return (
    <Card className="w-full h-full overflow-visible rounded-lg border border-gray-200 bg-white px-2 py-1.5 relative">
      <CardHeader className="space-y-1 overflow-visible p-0 sticky top-0 z-50 bg-white rounded-t-lg">
        <div className="flex flex-col gap-1.5 overflow-visible rounded-md border border-gray-200 bg-slate-50/60 p-2">
          {/* Heading: title + date context + mode/year on one row; filters below stay in this panel */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                {sbu} sales performance
              </h2>
              <p className="mt-0.5 text-[10px] leading-snug text-gray-600 sm:text-xs">
                {headingDate || `Fiscal year ${selectedYear}`}
                {salesUnit ? ` · ${salesUnit}` : ""}
              </p>
            </div>
          {/* Active filter pills */}
          {(selectedZone || selectedRegion || selectedSalesArea) && (
            <div className="flex flex-wrap gap-1 border-t border-gray-200/80 pt-1.5">
              {selectedZone && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="text-blue-500 font-semibold">Zone:</span> {selectedZone}
                  <button onClick={() => handleZoneChange("Zone_Name", "")} className="ml-0.5 hover:text-blue-900">×</button>
                </span>
              )}
              {selectedRegion && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
                  <span className="text-violet-500 font-semibold">Region:</span> {selectedRegion}
                  <button onClick={() => handleRegionChange("Region_Name", "")} className="ml-0.5 hover:text-violet-900">×</button>
                </span>
              )}
              {selectedSalesArea && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="text-amber-500 font-semibold">Area:</span> {selectedSalesArea}
                  <button onClick={() => handleSalesAreaChange("SalesArea_Name", "")} className="ml-0.5 hover:text-amber-900">×</button>
                </span>
              )}
            </div>
          )}
            <TooltipProvider>
              <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-start gap-1 sm:justify-end">
                <ZoneWiseFilterMenu
                  renderFilterTrigger={(p) => <ZoneWiseFilterTriggerButton {...p} />}
                  selectedZone={selectedZone}
                  selectedRegion={selectedRegion}
                  selectedSalesArea={selectedSalesArea}
                  zoneOptions={zoneOptions}
                  regionOptions={regionOptions}
                  salesAreaOptions={salesAreaOptions}
                  handleZoneChange={(key, value) => handleZoneChange(key, value)}
                  handleRegionChange={(key, value) => handleRegionChange(key, value)}
                  handleSalesAreaChange={(key, value) => handleSalesAreaChange(key, value)}
                  hideSbu={true}
                  hideProduct={true}
                />
                <Button
                  type="button"
                  variant={mode === "ytd" ? "default" : "outline"}
                  title={mode === "ytd" ? "Turn off YTD (switch to full fiscal months)" : "Use year-to-date slice"}
                  onClick={() => handleModeChange("ytd")}
                  className={`border w-9 h-8 p-0 text-xs ${mode === "ytd" ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white" : "bg-white text-black hover:bg-white hover:text-black"}`}
                >
                  YTD
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                        <PopoverTrigger asChild disabled={dateRangePickerDisabled}>
                          <Button
                            type="button"
                            disabled={dateRangePickerDisabled}
                            className={`border w-8 h-8 p-0 text-xs ${
                              dateRangePickerDisabled
                                ? "cursor-not-allowed bg-white text-gray-400 opacity-60"
                                : mode === "date"
                                  ? "bg-teal-600 text-white"
                                  : "bg-white text-black"
                            }`}
                          >
                            <Calendar strokeWidth={1} className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3 shadow-lg border border-gray-200 rounded-lg" align="end">
                          <div className="flex flex-col gap-3">
                            {/* From */}
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
                            {/* To */}
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
                            {/* Actions */}
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
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-sm px-2 py-1">
                    {dateRangePickerDisabled
                      ? "Turn YTD off first (click YTD), then you can choose a custom date range."
                      : "Pick a date range and Apply."}
                  </TooltipContent>
                </Tooltip>

                {drillLevel > 0 && (
                  <Button onClick={handleBackClick} className="text-white text-xs mt-0.5 font-bold p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500">
                    <IconArrowLeft stroke={1.5} />
                  </Button>
                )}
                <Button onClick={resetFilters} className="text-white text-xs font-bold mt-0.5 p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500">
                  <IconRestore stroke={1.5} />
                </Button>

                <div className="flex shrink-0 items-center gap-1 rounded border border-gray-200 bg-white px-1 py-0.5 shadow-sm">
                  <span className="hidden text-[10px] font-semibold text-gray-600 sm:inline">FY</span>
                  <ShadcnSelect value={selectedYear} onValueChange={handleYearChange}>
                    <SelectTrigger className="h-8 w-[6.75rem] border-[1.5px] p-0 px-1.5 text-xs font-semibold">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {fiscalYearOptions.map((fy) => (
                        <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                      ))}
                    </SelectContent>
                  </ShadcnSelect>
                </div>
              </div>
            </TooltipProvider>
          </div>


        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 p-0">
        {!chartsBlockLoading ? (
          <>
        {/* ── Zone heatmap (both AvH + AvT) + Zone Monthwise table side-by-side ── */}
        <div className="flex gap-3 px-2 pt-1 pb-2 items-start">
          {/* Left: unified heatmap — grows with data */}
          <div className="w-[38%] shrink-0 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-bold text-sm min-w-0 flex-1">
                {sbu !== "Aviation" && sbu !== "GAS" && sbu !== "PETCHEM"
                  ? "Zone-wise Performance Variance"
                  : "Monthly Performance Variance"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Clear zone, region & sales area selection and refresh"
                disabled={isRefreshingGeoZone || isGeoChartsLoading}
                aria-busy={isRefreshingGeoZone || isGeoChartsLoading}
                onClick={() => { void refreshZoneSection(); }}
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRefreshingGeoZone || isGeoChartsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <ZoneHeatmap
              data={sbuHeatMapData}
              xaxisData={xaxisAHData}
              growthDetailsAvH={sbuGrowthDetails}
              growthDetailsAvT={sbuTgtGrowthDetails}
              showTarget={activeStates.T && sbuHeatMapData?.length > 0}
              onCellClick={({ zone }) => handleZoneCellClick({ zone })}
            />
          </div>

          {/* Right: Zone Monthwise sales table — grows with data */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-extrabold min-w-0 flex-1">Zone wise Monthwise sales (TMT)</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Clear zone, region & sales area selection and refresh"
                disabled={isRefreshingGeoZone || isGeoChartsLoading}
                aria-busy={isRefreshingGeoZone || isGeoChartsLoading}
                onClick={() => { void refreshZoneSection(); }}
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRefreshingGeoZone || isGeoChartsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <RetailSalesPerformanceTable props={sbuOriginalData} onZoneClick={handleZoneClick} selectedZoneName={selectedZoneNameForTable} />
          </div>
        </div>

        <div className="flex items-stretch gap-2 px-2 pb-2">
          <div className="flex-1 ">
            <IndividualData id="actual-sales-chart-sbu" data={sbuMonthlyComparisonData} onRefresh={() => loadChartData('"SBU_Name"')} />
          </div>
          <div className="flex-1">
            <IndividualDataPercentage id="percentage-sales-chart-sbu" data={sbuMonthlyPercentageData} selectedYear={selectedYear} onRefresh={() => loadChartData('"SBU_Name"')} />
          </div>
        </div>

        {sbu !== "Aviation" && sbu !== "GAS" && sbu !== "PETCHEM" && (
          <div className="flex flex-col gap-2">
            {showTargetChart && (
              <div className="flex gap-2 px-2">
                <div className="flex-1">
                  <IndividualAvsT id="target-sales-chart-sbu" data={sbuMonthlyComparisonData} onRefresh={() => loadChartData('"SBU_Name"')} />
                </div>
                <div className="flex-1">
                  <IndividualAvsTPercentage id="percentage-target-chart-sbu" data={sbuMonthlyPercentageData} selectedYear={selectedYear} onRefresh={() => loadChartData('"SBU_Name"')} />
                </div>
              </div>
            )}
            <Separator className="mx-2 h-[3px] bg-cyan-700" />
            <div className="flex gap-3 px-2 pb-2">
              {/* Left: Region heatmap */}
              <div className="w-[38%] shrink-0 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-extrabold min-w-0 flex-1">Region-wise Performance Variance</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Clear region & sales area selection and refresh"
                    disabled={isRefreshingGeoRegion || isGeoChartsLoading}
                    aria-busy={isRefreshingGeoRegion || isGeoChartsLoading}
                    onClick={() => { void refreshRegionSection(); }}
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${isRefreshingGeoRegion || isGeoChartsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <RegionHeatmap
                  data={zoneHeatMapData}
                  xaxisData={xaxisAHData}
                  growthDetailsAvH={zoneGrowthDetails}
                  growthDetailsAvT={zoneTgtGrowthDetails}
                  showTarget={activeStates.T && zoneHeatMapData?.length > 0}
                  onCellClick={({ region }) => handleRegionCellClick({ region })}
                />
              </div>
              {/* Right: Region monthwise table */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-extrabold min-w-0 flex-1">Region wise Monthwise sales ({salesUnit})</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Clear region & sales area selection and refresh"
                    disabled={isRefreshingGeoRegion || isGeoChartsLoading}
                    aria-busy={isRefreshingGeoRegion || isGeoChartsLoading}
                    onClick={() => { void refreshRegionSection(); }}
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${isRefreshingGeoRegion || isGeoChartsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <RegionPerformanceTable props={zoneOriginalData} onRegionClick={handleRegionClick} selectedRegionName={selectedRegionNameForTable} />
              </div>
            </div>
            <div className="flex items-stretch gap-2 px-2 pb-2">
              <div className="flex-1 ">
                <RegionIndividualData id="region-individual-sales-chart-sbu" data={regionMonthlyComparisonData} />
              </div>
              <div className="flex-1">
                <RegionIndividualDataPercentage id="region-percentage-sales-chart-sbu" data={regionMonthlyPercentageData} />
              </div>
            </div>
            {showTargetChart && (
              <div className="flex gap-2 px-2">
                <div className="flex-1 ">
                  <RegionAvsT id="region-target-chart-sbu" data={regionMonthlyComparisonData} />
                </div>
                <div className="flex-1">
                  <RegionAvsTPercentage id="region-target-percentage-chart-sbu" data={regionMonthlyPercentageData} />
                </div>
              </div>
            )}
            <div>
              <Separator className="my-2 my-4 h-[3px] bg-cyan-700" />
              <div className="flex gap-3 px-2 pb-2">
                <div className="w-[38%] shrink-0 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-extrabold min-w-0 flex-1">Sales Area wise Performance Variance</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Clear sales area selection and refresh"
                      disabled={isRefreshingGeoSalesArea || isGeoChartsLoading}
                      aria-busy={isRefreshingGeoSalesArea || isGeoChartsLoading}
                      onClick={() => { void refreshSalesAreaSection(); }}
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${isRefreshingGeoSalesArea || isGeoChartsLoading ? "animate-spin" : ""}`} />
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-extrabold min-w-0 flex-1">Sales Area wise Monthwise sales ({salesUnit})</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Clear sales area selection and refresh"
                      disabled={isRefreshingGeoSalesArea || isGeoChartsLoading}
                      aria-busy={isRefreshingGeoSalesArea || isGeoChartsLoading}
                      onClick={() => { void refreshSalesAreaSection(); }}
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${isRefreshingGeoSalesArea || isGeoChartsLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <SalesAreaPerformanceTable
                    props={regionOriginalData}
                    onRegionClick={handleSalesareaClick}
                    selectedSalesAreaName={selectedSalesAreaNameForTable}
                  />
                </div>
              </div>
            <div className="flex items-stretch gap-2 px-2 pb-2">
              <div className="flex-1 ">
                  <SalesAreaIndividualData
                    id="sales-individual-sales-chart"
                    data={salesAreaMonthlyComparisonData}
                  />
                </div>
              <div className="flex-1">
                  <SalesAreaIndividualDataPercentage
                    id="sales-percentage-sales-chart"
                    data={salesAreaMonthlyPercentageData}
                  />
                </div>
            </div>

            {showTargetChart && (
              <div className="flex gap-2 px-2">
                <div className="flex-1 ">
                  <SalesAreaAvsT
                    id="salesarea-target-chart"
                    data={salesAreaMonthlyComparisonData}
                  />
                </div>
                <div className="flex-1">
                  <SalesAreaAvsTPercentage
                    id="salesarea-target-percentage-chart"
                    data={salesAreaMonthlyPercentageData}
                  />
                </div>
              </div>
            )}
          </div>
          </div>
        )}
          </>
        ) : (
          <div
            className="flex min-h-[420px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50/90 py-16"
            role="status"
            aria-live="polite"
            aria-label="Loading charts"
          >
            <Loader2 className="h-9 w-9 shrink-0 animate-spin text-teal-600" aria-hidden />
            <span className="text-xs font-medium text-slate-600">Loading chart data…</span>
          </div>
        )}
    </CardContent>
    </Card >
  );
};

export default SbuSalesPerformance;
