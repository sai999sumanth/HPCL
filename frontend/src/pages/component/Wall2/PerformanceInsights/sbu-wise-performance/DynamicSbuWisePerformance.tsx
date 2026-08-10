
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Card,
  CardContent,
} from "@/@/components/ui/card";
import { styled } from "@mui/material/styles";
import dayjs, { Dayjs } from "dayjs";
import convertToFilters, { removeOldValues } from "@/utils/dynamicFilter";
import { format, formatDate, startOfMonth, subDays } from "date-fns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import React from "react";
import { Separator } from "@/@/components/ui/separator";
import RetailSalesPerformance from "../RetailSalesPerformance";
import { fetchChartData, fetchDistinctValues, fetchProductValues } from "../../api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { Button } from "@/@/components/ui/button";
import { Calendar, RotateCcw, Loader2, Check, ChevronsUpDown, Search, X } from "lucide-react";
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
import { Alert, AlertDescription } from "@/@/components/ui/alert";
import ScrollToTop from "@/components/common/ScrollToTop";
import TopRetailsub from "../topRetail/TopRetailsub";
import { useAuth } from '@/services/useuth';
import useAuthStore from "@/store/authStore";
import useMenuStore from "@/store/menuStore";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/@/components/ui/command";
import { Badge } from "@/@/components/ui/badge";
import SalesPerformanceTable from "../topRetail/SalesPerformanceTable";


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

interface Props {
  sbu: string;
}

/** Align "from" with the calendar month of "yesterday" so the 1st of the month does not pair start-of-current-month with end-of-previous-month (e.g. 2026-04-01,2026-03-31). */
const getMonthRangeEndingYesterday = () => {
  const end = dayjs().subtract(1, "day");
  return { from: end.startOf("month"), to: end };
};

/** India FY: April → March, label "YYYY-(YYYY+1)". */
const FY_START_MONTH = 3;

const getCurrentFiscalYearString = (d: dayjs.Dayjs = dayjs()) => {
  const y = d.year();
  const m = d.month();
  if (m >= FY_START_MONTH) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
};

/** One FY before the current FY (e.g. 2026-2027 → 2025-2026). */
const getPreviousFiscalYearString = (d: dayjs.Dayjs = dayjs()) => {
  const cur = parseFiscalYearLabel(getCurrentFiscalYearString(d));
  if (!cur) return "";
  const prevStart = cur.start - 1;
  return `${prevStart}-${prevStart + 1}`;
};

/**
 * Default FY in the dropdown: on the first day of the FY (1 Apr), select the **previous** FY;
 * otherwise select the **current** FY.
 */
const getDefaultSelectedFiscalYear = (d: dayjs.Dayjs = dayjs()) => {
  const today = d.startOf("day");
  const fyStartThisCalendarYear = d.year(today.year()).month(FY_START_MONTH).date(1).startOf("day");
  if (today.isSame(fyStartThisCalendarYear, "day")) {
    return getPreviousFiscalYearString(d);
  }
  return getCurrentFiscalYearString(d);
};

const parseFiscalYearLabel = (fy: string): { start: number; end: number } | null => {
  const m = /^(\d{4})-(\d{4})$/.exec(String(fy).trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) return null;
  return { start, end };
};

const isCurrentFiscalYearSelection = (fy: string) => fy === getCurrentFiscalYearString();

/**
 * Sales Summary / Zone Wise date range defaults:
 * - Past FY: 1 Mar (FY end year) → 31 Mar (end year), e.g. 2025-2026 → 1 Mar 2026 – 31 Mar 2026
 * - Current FY: 1st of current calendar month → yesterday; if today is the 1st, same day twice
 */
const getSalesDateRangeByFy = (fyLabel: string) => {
  const fy = parseFiscalYearLabel(fyLabel);
  if (!fy) return getMonthRangeEndingYesterday();

  if (!isCurrentFiscalYearSelection(fyLabel)) {
    const from = dayjs().year(fy.end).month(2).date(1);
    const to = dayjs().year(fy.end).month(2).date(31);
    return { from, to };
  }

  const monthStart = dayjs().startOf("month").startOf("day");
  const today = dayjs().startOf("day");
  if (today.date() === 1) {
    return { from: monthStart, to: monthStart };
  }
  return { from: monthStart, to: dayjs().subtract(1, "day").startOf("day") };
};

/**
 * Current FY YTD window: Apr 1 of FY start year through yesterday.
 * On the first day of the FY (today === Apr 1), use Apr 1 → Apr 1 (not prior day).
 */
const getCurrentFiscalYearYtdFromTo = (fyStartYear: number) => {
  const fyStart = dayjs().year(fyStartYear).month(3).date(1).startOf("day");
  const today = dayjs().startOf("day");
  if (today.isSame(fyStart, "day")) {
    return { from: fyStart, to: fyStart };
  }
  return { from: fyStart, to: dayjs().subtract(1, "day").startOf("day") };
};

/** Exactly two options: present FY and the immediate previous FY. */
const buildFiscalYearSelectOptions = (d: dayjs.Dayjs = dayjs()) => {
  const current = getCurrentFiscalYearString(d);
  const previous = getPreviousFiscalYearString(d);
  if (!previous) return [current];
  return [current, previous];
};

const DynamicSbuWisePerformance: React.FC<Props> = ({ sbu }) => {

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

  const [loadingYtdMarketing, setLoadingYtdMarketing] = useState(true);
  const [loadingZoneYtd, setLoadingZoneYtd] = useState(true);
  const [loadingZoneYtpm, setLoadingZoneYtpm] = useState(true);
  const [loadingYtpmMarketing, setLoadingYtpmMarketing] = useState(true);
  const [loadingZoneDateRange, setLoadingZoneDateRange] = useState(true);
  const [loadingSalesSummary, setLoadingSalesSummary] = useState(true);
  const [mode, setMode] = useState<ChartMode>("month");

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
  const [errorMessage, setErrorMessage] = useState("")

  const [recentSales, setRecentSales] = useState([]);
  // Stores the current sales data

  const [pastSales, setPastSales] = useState([]);

  const initialSalesRange = getSalesDateRangeByFy(getCurrentFiscalYearString());
  const [fromDate, setFromDate] = useState(initialSalesRange.from);
  const [toDate, setToDate] = useState(initialSalesRange.to);
  const [productList, setProductList] = useState<any>([]);

  useEffect(() => {
    YTDmarketingTotal();
    ZoneWiseYTD();
    ZoneWiseYTPM();
    ZoneWiseYTPMMarketingTotal();
  }, [selectedYear, productName]);

  useEffect(() => {
    ZoneWiseDateRange();
    SalesSummaryForDateRange();
  }, [selectedYear, productName]);


  useEffect(() => {
    getProductDetails().then((data) => {
      if (data && data["ProductName"]) {
        // Set all products as selected by default
        setProductName(data["ProductName"].map(p => p.toUpperCase()));
      }
    });
  }, [])



  // At the component level:
  // const [productName, setProductName] = useState<string[]>([]);

  // In the getProductDetails function:
  const getProductDetails = async () => {
    try {
      const response = await fetchProductValues({
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        column: ["ProductName"],
        where_cond: [
          { key: "Zone_Name", value: "-", cond: "!=" },
          { key: "Zone_Name", value: "", cond: "!=" },
          { key: "SBU_Name", value: "0", cond: "!=" },
          { key: "SBU_Name", value: sbu, cond: "=" },
        ],
      });


      if (response.status && response.data) {
        const unwantedProducts = [
          "LPG CYLINDER REGULATOR",
          "LPG CYLINDER ACCESSORIES",
          "MISCELLANEOUS/MINOR"
        ];

        const products = (response.data["ProductName"] || [])
          .map(name => {
            const parts = name.split(" - ");
            if (parts.length === 2) {
              const [prefix, suffix] = parts;
              const titleCasedSuffix = suffix
                .toLowerCase()
                .split(" ")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
              return `${prefix} - ${titleCasedSuffix}`;
            }
            return name;
          })
          .filter(name => !unwantedProducts.includes(name.toUpperCase()));

        setProductList(products);
        setProductName(products);

        return products;
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  };



  const headerRef = useRef(null);
  useEffect(() => {
    // Scroll to the header when component mounts
    if (headerRef.current) {
      headerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Optional - add highlight effect
      headerRef.current.classList.add('bg-blue-50');
      setTimeout(() => {
        headerRef.current.classList.remove('bg-blue-50');
      }, 2000);

    }
  }, []);


  const ZoneWiseYTD = async () => {
    setLoadingZoneYtd(true);
    
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD");
    }
    
    // Calculate date range based on selectedYear (Apr–Mar FY)
    let dateRange = "";
    const fy = parseFiscalYearLabel(selectedYear);
    if (fy && isCurrentFiscalYearSelection(selectedYear)) {
      const { from, to } = getCurrentFiscalYearYtdFromTo(fy.start);
      dateRange = `${formatDate(from)},${formatDate(to)}`;
    } else if (fy) {
      dateRange = `${fy.start}-04-01,${fy.end}-03-31`;
    }
    
    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];
    
    // Add DATE filter if dateRange is set
    if (dateRange) {
      filter.push({
        key: '"DATE"',
        cond: "equals",
        value: dateRange,
      });
    }
    
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
        setLoadingZoneYtd(false);
      } else {
        setSbuArray([]);
        setCurrentSalesArray([]);
        setHistoricalSalesArray([]);
        setLoadingZoneYtd(false);
      }
    } catch (error) {
      setSbuArray([]);
      setCurrentSalesArray([]);
      setHistoricalSalesArray([]);
      setLoadingZoneYtd(false);
      console.error("Error fetching data:", error);
    }
  };

  const ZoneWiseDateRange = async (
    fromDateOverride?: dayjs.Dayjs,
    toDateOverride?: dayjs.Dayjs
  ) => {
    setLoadingZoneDateRange(true);
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD");
    };

    // Calculate dates based on selectedYear if no overrides provided
    let fromDateToUse: dayjs.Dayjs;
    let toDateToUse: dayjs.Dayjs;

    if (fromDateOverride && toDateOverride) {
      // Use override parameters if provided
      fromDateToUse = fromDateOverride;
      toDateToUse = toDateOverride;
    } else {
      const fy = parseFiscalYearLabel(selectedYear);
      if (fy) {
        const { from, to } = getSalesDateRangeByFy(selectedYear);
        fromDateToUse = from;
        toDateToUse = to;
      } else {
        fromDateToUse = fromDate;
        toDateToUse = toDate;
      }
    }

    if (!fromDateToUse || !toDateToUse) {
      console.error("From date or to date is null");
      setSbuArrayState([]);
      setCurrentSalesState([]);
      setHistoricalSalesState([]);
      setLoadingZoneDateRange(false);
      return;
    }

    if (fromDateToUse.isAfter(toDateToUse)) {
      const t = fromDateToUse;
      fromDateToUse = toDateToUse;
      toDateToUse = t;
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"DATE"', cond: "equals", value: `${formatDate(fromDateToUse)},${formatDate(toDateToUse)}` },
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
        setLoadingZoneDateRange(false);
      } else {
        setSbuArrayState([]);
        setCurrentSalesState([]);
        setHistoricalSalesState([]);
        setLoadingZoneDateRange(false);
      }
    } catch (error) {
      setSbuArrayState([]);
      setCurrentSalesState([]);
      setHistoricalSalesState([]);
      setLoadingZoneDateRange(false);
      console.error("Error fetching data:", error);
    }
  };

  const SalesSummaryForDateRange = async (
    type?: string,
    fromDateOverride?: dayjs.Dayjs,
    toDateOverride?: dayjs.Dayjs
  ) => {
    setLoadingSalesSummary(true);
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD");
    };

    // Calculate dates based on selectedYear if no overrides provided
    let fromDateToUse: dayjs.Dayjs;
    let toDateToUse: dayjs.Dayjs;

    if (fromDateOverride && toDateOverride) {
      // Use override parameters if provided
      fromDateToUse = fromDateOverride;
      toDateToUse = toDateOverride;
    } else {
      const fy = parseFiscalYearLabel(selectedYear);
      if (fy) {
        const { from, to } = getSalesDateRangeByFy(selectedYear);
        fromDateToUse = from;
        toDateToUse = to;
      } else {
        fromDateToUse = fromDate;
        toDateToUse = toDate;
      }
    }

    if (!fromDateToUse || !toDateToUse) {
      console.error("From date or to date is null");
      setSbuList([]);
      setRecentSales([]);
      setPastSales([]);
      setLoadingSalesSummary(false);
      return;
    }

    if (fromDateToUse.isAfter(toDateToUse)) {
      const t = fromDateToUse;
      fromDateToUse = toDateToUse;
      toDateToUse = t;
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDateToUse)},${formatDate(toDateToUse)}`,
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
        setLoadingSalesSummary(false);
      } else {
        setSbuList([]);
        setRecentSales([]);
        setPastSales([]);
        setLoadingSalesSummary(false);
      }
    } catch (error) {
      setSbuList([]);
      setRecentSales([]);
      setPastSales([]);
      setLoadingSalesSummary(false);
      console.error("Error fetching data:", error);
    }
  };

  const YTDmarketingTotal = async () => {
    setLoadingYtdMarketing(true);
    const formatDate = (date: dayjs.Dayjs) => {
      return dayjs(date).format("YYYY-MM-DD");
    };

    let dateRange = "";
    const fyYtd = parseFiscalYearLabel(selectedYear);
    if (fyYtd && isCurrentFiscalYearSelection(selectedYear)) {
      const { from, to } = getCurrentFiscalYearYtdFromTo(fyYtd.start);
      dateRange = `${formatDate(from)},${formatDate(to)}`;
    } else if (fyYtd) {
      dateRange = `${fyYtd.start}-04-01,${fyYtd.end}-03-31`;
    }

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];
    
    // Add DATE filter if dateRange is set
    if (dateRange) {
      filter.push({
        key: '"DATE"',
        cond: "equals",
        value: dateRange,
      });
    }
    
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
        setLoadingYtdMarketing(false);
      } else {
        setYtdData([]);
        setYtcurrentData([]);
        setYtdHistoricalData([]);
        setLoadingYtdMarketing(false);
      }
    } catch (error) {
      setYtdData([]);
      setYtcurrentData([]);
      setYtdHistoricalData([]);
      setLoadingYtdMarketing(false);
      console.error("Error fetching data:", error);
    }
  };

  /**
   * YTPM = till previous month (API dates).
   * Past FY: full FY Apr 1 → Mar 31.
   * Current FY: Apr 1 → min(end of previous calendar month, Mar 31 FY end).
   * Current FY & calendar month is April (FY start month): Apr 1 → Apr 1 (same as heading “Apr YYYY to Apr YYYY”).
   */
  const getYTPMDateRange = () => {
    const fy = parseFiscalYearLabel(selectedYear);
    if (!fy) return "";

    if (!isCurrentFiscalYearSelection(selectedYear)) {
      return `${fy.start}-04-01,${fy.end}-03-31`;
    }

    const fyEnd = dayjs().year(fy.end).month(2).date(31);
    if (dayjs().month() === 3) {
      const d = dayjs().year(fy.start).month(3).date(1).format("YYYY-MM-DD");
      return `${d},${d}`;
    }

    const lastDayOfPrevMonth = dayjs().subtract(1, "month").endOf("month");
    const to = lastDayOfPrevMonth.isAfter(fyEnd)
      ? fyEnd.format("YYYY-MM-DD")
      : lastDayOfPrevMonth.format("YYYY-MM-DD");
    return `${fy.start}-04-01,${to}`;
  };

  const ZoneWiseYTPM = async () => {
    setLoadingZoneYtpm(true);

    const dateRange = getYTPMDateRange();

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"ProductName"', cond: "equals", value: productName.join(',') },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];

    // Add DATE filter if dateRange is set
    if (dateRange) {
      filter.push({
        key: '"DATE"',
        cond: "equals",
        value: dateRange,
      });
    }

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
        setLoadingZoneYtpm(false);
      } else {
        setYtdsbuname([]);
        setYtcurrentSales([]);
        setYtdHistoricalSales([]);
        setLoadingZoneYtpm(false);
      }
    } catch (error) {
      setYtdsbuname([]);
      setYtcurrentSales([]);
      setYtdHistoricalSales([]);
      setLoadingZoneYtpm(false);
      console.error("Error fetching data:", error);
    }
  };

  const ZoneWiseYTPMMarketingTotal = async () => {
    setLoadingYtpmMarketing(true);

    const dateRange = getYTPMDateRange();

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"C"', cond: "equals", value: "true" },
      { key: '"SBU_Name"', cond: "equals", value: sbu },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];

    // Add DATE filter if dateRange is set
    if (dateRange) {
      filter.push({
        key: '"DATE"',
        cond: "equals",
        value: dateRange,
      });
    }

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "",
      });

      if (response.status && response.data) {
        const zoneNames = response.data?.data.Zone_Name || {};
        const currentSales = response.data?.data.ACTUAL_TMT_SALES || {};
        const historicalSales =
          response.data?.data.ACTUAL_HISTORY_TMT_SALES || {};

        setYtdSbuNameprevious(Object.values(zoneNames));
        setYtdPreviousCurrentSales(Object.values(currentSales));
        setYtdPreviousHistoricSales(Object.values(historicalSales));
        setLoadingYtpmMarketing(false);
      } else {
        setYtdSbuNameprevious([]);
        setYtdPreviousCurrentSales([]);
        setYtdPreviousHistoricSales([]);
        setLoadingYtpmMarketing(false);
      }
    } catch (error) {
      setYtdSbuNameprevious([]);
      setYtdPreviousCurrentSales([]);
      setYtdPreviousHistoricSales([]);
      setLoadingYtpmMarketing(false);
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

  const handleFromDateChange = (newValue: Dayjs | null) => {
    if (newValue) {
      setFromDate(newValue);
    }
  };
  const handleToDateChange = (newValue: Dayjs | null) => {
    if (newValue) {
      setToDate(newValue);
    }
  };
  const [dateRangeHeading, setDateRangeHeading] = useState("");

  // Modify the handleDateFilter function to dynamically set date ranges based on selected year
  const handleDateFilter = () => {
    if (fromDate && toDate) {
      // Update the heading with the selected date range using fiscal year logic
      setDateRangeHeading(formatDateRangeHeading(fromDate, toDate, selectedYear));

      // Call the functions to fetch data based on the selected date range
      ZoneWiseDateRange(fromDate, toDate);
      SalesSummaryForDateRange("date", fromDate, toDate);
    }
    // Close the popover after applying filter
    setIsOpen(false);
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
    // validateDateRange(fromDate, toDate);

    // Close the popover after applying filter
  };

  /** Zone Wise YTPM heading: month–year, e.g. Apr 2025 to Mar 2026 (past FY) or Apr 2026 to May 2026 (current FY). */
  const getMonthYearRange = () => {
    const fy = parseFiscalYearLabel(selectedYear);
    if (!fy) return "";

    const aprStart = dayjs().year(fy.start).month(3).date(1);

    if (isCurrentFiscalYearSelection(selectedYear)) {
      if (dayjs().month() === 3) {
        const m = aprStart.format("MMM YYYY");
        return `${m} to ${m}`;
      }
      const prevMonth = dayjs().subtract(1, "month");
      return `${aprStart.format("MMM YYYY")} to ${prevMonth.format("MMM YYYY")}`;
    }

    const marEnd = dayjs().year(fy.end).month(2).date(1);
    return `${aprStart.format("MMM YYYY")} to ${marEnd.format("MMM YYYY")}`;
  };

/**
 * Get default date range for the calendar popup based on selected fiscal year:
 * - Previous FY: 1 Apr (FY start year) to 31 Mar (FY end year) - full FY range
 * - Current FY: 1 Apr (FY start year) to yesterday
 */
const getPopupDefaultDateRange = (fyLabel: string) => {
  const fy = parseFiscalYearLabel(fyLabel);
  if (!fy) return getMonthRangeEndingYesterday();

  const fyStartDate = dayjs().year(fy.start).month(3).date(1); // 1 Apr of start year

  if (!isCurrentFiscalYearSelection(fyLabel)) {
    // Previous FY: full year range (1 Apr to 31 Mar)
    const fyEndDate = dayjs().year(fy.end).month(2).date(31); // 31 Mar of end year
    return { from: fyStartDate, to: fyEndDate };
  }

  // Current FY: 1 Apr to yesterday (or today if it's 1 Apr)
  const today = dayjs().startOf("day");
  if (today.isSame(fyStartDate, "day")) {
    return { from: fyStartDate, to: fyStartDate };
  }
  return { from: fyStartDate, to: dayjs().subtract(1, "day").startOf("day") };
};

const handlePopoverOpenChange = (open) => {
  if (open) {
    const fy = parseFiscalYearLabel(selectedYear);
    if (fy) {
      const { from, to } = getPopupDefaultDateRange(selectedYear);
      setFromDate(from);
      setToDate(to);
    }
  }
  setIsOpen(open);
};
  const resetDate = () => {
    let resetFromDate: dayjs.Dayjs;
    let resetToDate: dayjs.Dayjs;
    const fy = parseFiscalYearLabel(selectedYear);
    if (fy) {
      const r = getSalesDateRangeByFy(selectedYear);
      resetFromDate = r.from;
      resetToDate = r.to;
    } else {
      const { from, to } = getMonthRangeEndingYesterday();
      resetFromDate = from;
      resetToDate = to;
    }

    setFromDate(resetFromDate);
    setToDate(resetToDate);
  };

  const handleYearChange = (value) => {
    setSelectedYear(value);
    setAppliedFilters((prev) => [...prev, { key: '"fiscal_year"', cond: "equals", value: value }]);
    const fy = parseFiscalYearLabel(value);
    let fromdate: dayjs.Dayjs;
    let todate: dayjs.Dayjs;
    if (fy) {
      const r = getSalesDateRangeByFy(value);
      fromdate = r.from;
      todate = r.to;
    } else {
      const r = getMonthRangeEndingYesterday();
      fromdate = r.from;
      todate = r.to;
    }

    setFromDate(fromdate);
    setToDate(todate);
    setDateRangeHeading(formatDateRangeHeading(fromdate, todate, value));
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
  // const [isOpen, setIsOpen] = useState(false);
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const CompactMarketingMetrics: React.FC<{
    title: string;
    currentValue: number;
    historicalValue: number;
    loading?: boolean;
  }> = ({ title, currentValue, historicalValue, loading = false }) => {
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
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="xs:text-xs sm:text-xs font-semibold text-black truncate">{title}</span>
              {loading && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" aria-hidden />
              )}
            </div>

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
  // Helper function to format heading date using selectedYear for YTD display
  const formatYTDHeadingDate = (year: string) => {
    const fy = parseFiscalYearLabel(year);
    if (!fy) {
      return `${fromDate.format("DD-MMM-YYYY")} to ${toDate.format("DD-MMM-YYYY")}`;
    }

    if (isCurrentFiscalYearSelection(year)) {
      const { from, to } = getCurrentFiscalYearYtdFromTo(fy.start);
      return `${from.format("DD-MMM-YYYY")} to ${to.format("DD-MMM-YYYY")}`;
    }

    const fromdate = dayjs().year(fy.start).month(3).date(1);
    const todate = dayjs().year(fy.end).month(2).date(31);
    return `${fromdate.format("DD-MMM-YYYY")} to ${todate.format("DD-MMM-YYYY")}`;
  };

  // Helper function to format date range heading using selectedYear
  // Always uses the endYear from selectedYear for the date range display
  const formatDateRangeHeading = (from: Dayjs, to: Dayjs, year: string) => {
    // Always show the actual selected dates in the heading
    // When dates are selected from calendar, they will be displayed
    // When using defaults, the dates will match the default calculated dates
    return `${from.format("DD-MMM-YYYY")} to ${to.format("DD-MMM-YYYY")}`;
  };

  const getDateRange = () => {
    return formatYTDHeadingDate(selectedYear);
  };

  // Initialize dateRangeHeading based on selectedYear only on mount or year change
  useEffect(() => {
    if (selectedYear) {
      const fyHeading = parseFiscalYearLabel(selectedYear);
      let defaultFrom: dayjs.Dayjs;
      let defaultTo: dayjs.Dayjs;
      if (fyHeading) {
        const { from, to } = getSalesDateRangeByFy(selectedYear);
        defaultFrom = from;
        defaultTo = to;
      } else {
        defaultFrom = fromDate;
        defaultTo = toDate;
      }

      setDateRangeHeading(formatDateRangeHeading(defaultFrom, defaultTo, selectedYear));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]); // Only update when selectedYear changes, not when dates change

  const user = useAuthStore(state => state.user);
  const getDynamicTitle = (sbu, user) => {
    if (user?.sales_area?.length > 0) {
      return user.sales_area;
    } else if (user?.zone?.length > 0) {
      return user.zone;
    } else if (user?.region?.length > 0) {
      return user.region;
    }
    return sbu; // fallback to just sbu if none are available
  };

  const handleRefresh = () => {
    let resetFromDate: dayjs.Dayjs;
    let resetToDate: dayjs.Dayjs;
    const fy = parseFiscalYearLabel(selectedYear);
    if (fy) {
      const { from, to } = getSalesDateRangeByFy(selectedYear);
      resetFromDate = from;
      resetToDate = to;
    } else {
      const { from, to } = getMonthRangeEndingYesterday();
      resetFromDate = from;
      resetToDate = to;
    }


    setFromDate(resetFromDate);
    setToDate(resetToDate);

    // Update the heading with the new date range using fiscal year logic
    setDateRangeHeading(formatDateRangeHeading(resetFromDate, resetToDate, selectedYear));

    // Call the functions to fetch data based on the new date range
    ZoneWiseDateRange(resetFromDate, resetToDate);
    SalesSummaryForDateRange("reset", resetFromDate, resetToDate);
  };

  console.log("sbuArray:", sbuArray);
  console.log("currentSalesArray:", currentSalesArray);
  console.log("historicalSalesArray:", historicalSalesArray);

  return (
    <>
      {/* <ScrollToTop /> */}
      <Card className="w-full bg-white rounded-lg border border-gray-200 pt-2 px-2">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div ref={headerRef} className="lg:col-start-3 lg:col-span-2 flex items-center justify-end">
            <span className="text-lg font-bold">
              {sbu} SBU MARKETING SUMMARY (TMT)
            </span>
          </div>

          <div className="lg:col-start-5 lg:col-span-2 gap-3 flex items-center justify-end">
            <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isProductPopoverOpen}
                  className="w-38 p-2 min-h-8 justify-between text-xs text-black font-semibold border-[1.5px] shadow-none border-gray-300"
                >
                  <div className="flex flex-wrap gap-1 max-w-38">
                    {productName.length === 0 ? (
                      <span className="text-gray-500">Select Product</span>
                    ) : productName.length === productList.length ? (
                      <span>All Products</span>
                    ) : (
                      <>
                        {productName.slice(0, 1).map((product) => (
                          <span key={product} className="bg-gray-200 px-1 rounded text-[10px]">
                            {product.toUpperCase()}
                          </span>
                        ))}
                        {productName.length > 1 && (
                          <span className="bg-gray-200 px-1 rounded text-[10px]">
                            +{productName.length - 1} more
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-2 text-xs">
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      className="w-full pl-7 pr-2 py-1.5 border rounded text-xs"
                      onChange={(e) => {
                        const searchTerm = e.target.value.toLowerCase();
                      }}
                    />
                  </div>

                  <div className="max-h-64 overflow-auto space-y-1">
                    <div
                      className="flex items-center space-x-2 p-1.5 hover:bg-gray-100 cursor-pointer rounded"
                      onClick={() => {
                        if (productName.length === productList.length) {
                          setProductName([]);
                        } else {
                          setProductName([...productList]); // Store original case
                        }
                      }}
                    >
                      <Check
                        className={`h-3.5 w-3.5 ${productName.length === productList.length ? "opacity-100" : "opacity-0"}`}
                      />
                      <span className="font-medium text-xs">Select All ({productList.length})</span>
                    </div>

                    {productList.map((product) => (
                      <div
                        key={product}
                        className="flex items-center space-x-2 p-1.5 hover:bg-gray-100 cursor-pointer rounded"
                        onClick={() => {
                          setProductName(prev => {
                            if (prev.includes(product)) {
                              return prev.filter(p => p !== product);
                            } else {
                              const newSelection = [...prev, product]; // Store original case
                              return newSelection;
                            }
                          });
                        }}
                      >
                        <Check
                          className={`h-3.5 w-3.5 ${productName.includes(product) ? "opacity-100" : "opacity-0"}`}
                        />
                        <span className="text-xs">{product.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-end justify-end">
              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[7.25rem] h-9 text-xs font-semibold border-[1.5px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYearOptions.map((fy) => (
                    <SelectItem key={fy} value={fy}>
                      {fy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>


        {(user?.sales_area?.length > 0 || user?.zone?.length > 0 || user?.region?.length > 0) ? (
          // Dynamic layout based on number of cards
          <div className={`gap-4 mt-4 ${sbuArray.length > 4
            ? 'grid grid-cols-1 gap-4' // Vertical layout for >4 cards
            : sbuArray.length > 2
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' // 2 columns for 3-4 cards, Date Range at bottom
              : 'grid grid-cols-1 lg:grid-cols-3 gap-4' // 3 columns for <=2 cards
            }`}>
            {/* Zone Wise YTD Section */}
            <div className={`space-y-2 ${sbuArray.length > 4
              ? 'order-1' // First position for >4 cards
              : sbuArray.length > 2
                ? 'order-1' // First position for 3-4 cards
                : 'order-1' // First position for <=2 cards
              }`}>
              <div className="flex justify-between items-center">
                <CompactMarketingMetrics
                  title="YTD (MARKETING TOTAL)"
                  currentValue={Math.round(
                    currentSalesArray.reduce((acc, val) => acc + val, 0)
                  )}
                  historicalValue={Math.round(
                    historicalSalesArray.reduce((acc, val) => acc + val, 0)
                  )}
                  loading={loadingZoneYtd}
                />
              </div>
              <span className="text-[10px] font-bold">
                Zone Wise YTD (
                {getDateRange()})

                {/* Zone Wise YTD ({fromDate.format("DD-MMM-YYYY")} to{" "}
        {toDate.format("DD-MMM-YYYY")}) */}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {sbuArray.map((sbu, index) => (
                  <GrowthStatCard
                    key={index}
                    title={getDynamicTitle(sbu, user)}
                    currentValue={currentSalesArray[index] || 0}
                    historicalValue={historicalSalesArray[index] || 0}
                  />
                ))}

              </div>
            </div>

            {/* Zone Wise YTPM Section */}
            <div className={`space-y-2 ${sbuArray.length > 4
              ? 'order-2' // Second position for >4 cards
              : sbuArray.length > 2
                ? 'order-2' // Second position for 3-4 cards
                : 'order-2' // Second position for <=2 cards
              }`}>
              <div className="flex justify-between items-center">
                <CompactMarketingMetrics
                  title="YTPM (MARKETING TOTAL TILL PREVIOUS MONTH)"
                  currentValue={Math.round(
                    YtdPreviousCurrentSales.reduce((acc, val) => acc + val, 0)
                  )}
                  historicalValue={Math.round(
                    YtdPreviousHistoricSales.reduce((acc, val) => acc + val, 0)
                  )}
                  loading={loadingYtpmMarketing || loadingZoneYtpm}
                />
              </div>
              <span className="text-[10px] font-bold">
                Zone Wise YTPM ({getMonthYearRange()})
              </span>
              {YtdPreviousCurrentSales && YtdPreviousCurrentSales.length === 0 && (
                <Alert variant="default">
                  <AlertDescription>
                    No Data Present for the current selection
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {Ytdsbuname.map((sbu, index) => (
                  <GrowthStatCard
                    key={index}
                    title={getDynamicTitle(sbu, user)}
                    currentValue={YTdcurrentSales[index] || 0}
                    historicalValue={YtdHistoricalSales[index] || 0}
                  />
                ))}

              </div>
            </div>

            {/* Zone Wise Date Range Section */}
            <div className={`space-y-2 ${sbuArray.length > 4
              ? 'order-3' // Third position for >4 cards
              : sbuArray.length > 2
                ? 'order-3 lg:col-span-2' // Bottom row spanning 2 columns for 3-4 cards
                : 'order-3' // Third position for <=2 cards
              }`}>
              <div className="flex justify-between items-center">
                <CompactMarketingMetrics
                  title="Date Range (Zone Wise)"
                  currentValue={Math.round(
                    currentSalesState.reduce((acc, val) => acc + val, 0)
                  )}
                  historicalValue={Math.round(
                    historicalSalesState.reduce((acc, val) => acc + val, 0)
                  )}
                  loading={loadingZoneDateRange}
                />
                <div className="flex gap-1">
                  <div className="flex gap-1 lg:col-start-5 justify-end">
                    <div className="flex gap-1 lg:col-start-5 justify-end">
                      <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                        <PopoverTrigger>
                          <Button
                            className={`border w-8 h-8 p-0 text-xs text-white ${mode === "date"
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

                      {/* Add the Refresh Button here */}
                      <Button
                        onClick={handleRefresh}
                        className="border w-8 h-8 p-0 mt-1 text-xs text-white bg-blue-500 hover:bg-blue-600"
                        title="Reset to default values"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>

                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold">
                Zone Wise Date Range ({dateRangeHeading})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {sbuArrayState.map((sbu, index) => (
                  <GrowthStatCard
                    key={index}
                    title={getDynamicTitle(sbu, user)}
                    currentValue={currentSalesState[index] || 0}
                    historicalValue={historicalSalesState[index] || 0}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="md:col-start-2 lg:col-span-1">
              <CompactMarketingMetrics
                title="YTD (MARKETING TOTAL)"
                currentValue={Math.round(
                  ytcurrentData.reduce((acc, val) => acc + val, 0)
                )}
                historicalValue={Math.round(
                  ytdHistoricalData.reduce((acc, val) => acc + val, 0)
                )}
                loading={loadingYtdMarketing || loadingZoneYtd}
              />
            </div>
            <span className="text-[12px] font-bold">
              Zone Wise YTD (
              {getDateRange()})
              {/* Zone Wise YTD ({fromDate.format("DD-MMM-YYYY")} to{" "}
              {toDate.format("DD-MMM-YYYY")}) */}
            </span>
            <div
              className={`grid xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2`}
            >
              {sbuArray.map((sbu, index) => (
                <GrowthStatCard
                  key={index}
                  title={sbu}
                  // title={getDynamicTitle(sbu, user)}
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
                  loading={loadingYtpmMarketing || loadingZoneYtpm}
                />
              </div>
            </div>

            <span className="text-[12px] font-bold">
              Zone Wise YTPM ({getMonthYearRange()})
            </span>
            {
              YtdPreviousCurrentSales && YtdPreviousCurrentSales.length === 0 && (
                <Alert variant="default" >
                  {/* <AlertCircle className="h-4 w-4" /> */}
                  {/* <AlertTitle>Error</AlertTitle> */}
                  <AlertDescription>
                    {/* {errorMessage} */}
                    No Data Present for the current selection
                  </AlertDescription>
                </Alert>
              )
            }
            <div
              className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2`}
            >
              {Ytdsbuname.map((sbu, index) => (
                <GrowthStatCard
                  key={index}
                  title={sbu}
                  // title={getDynamicTitle(sbu, user)}
                  currentValue={YTdcurrentSales[index] || 0}
                  historicalValue={YtdHistoricalSales[index] || 0}
                />
              ))}

            </div>
            <Separator className="mt-2 h-[2px] bg-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-5 md:col-span-2 gap-3 justify-end">
              <div className="lg:col-span-2">
                <CompactMarketingMetrics
                  title="SALES SUMMARY (DATE RANGE)"
                  currentValue={Math.round(
                    recentSales.reduce((acc, val) => acc + val, 0)
                  )}
                  historicalValue={Math.round(
                    pastSales.reduce((acc, val) => acc + val, 0)
                  )}
                  loading={loadingSalesSummary}
                />
              </div>
              <div className="lg:col-start-3 lg:col-span-2 flex items-center justify-start">
                <span className="text-lg font-bold">
                  SALES FOR DATE RANGE (TMT)
                </span>
              </div>


              <div className="flex gap-1 lg:col-start-5 justify-end">
                <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                  <PopoverTrigger>
                    <Button
                      className={`border w-8 h-8 p-0 text-xs text-white ${mode === "date"
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

                {/* Add the Refresh Button here */}
                <Button
                  onClick={handleRefresh}
                  className="border w-8 h-8 p-0 mt-1 text-xs text-white bg-blue-500 hover:bg-blue-600"
                  title="Reset to default values"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

            </div>

            {/* <span className="text-[12px] font-bold">Zone Wise Date Range ({dayjs().subtract(1, "year").month(3).date(1).format("DD-MMM-YYYY")} to {dayjs().subtract(1, "day").format("DD-MMM-YYYY")})</span> */}
            <span className="text-[12px] font-bold">
              Zone Wise Date Range ({dateRangeHeading})
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

            </div></>
        )}
        <Separator className="my-2 my-4 h-[2px] bg-cyan-700" />
        <SBUWiseProductLevel sbu={sbu} year={selectedYear} />
        <div className="mt-1 mb-2">
          <RetailSalesPerformance sbu={sbu} />
        </div>
      </Card>
      {/* {sbu === "I&C" && <SalesPerformanceTable />} */}
      <TopRetailsub sbu={sbu} />

    </>
  );
};

export default DynamicSbuWisePerformance;
