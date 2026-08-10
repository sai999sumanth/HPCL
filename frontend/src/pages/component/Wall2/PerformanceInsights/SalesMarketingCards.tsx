import React, { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { fetchChartData } from "../api";
import { Loader2, Calendar } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

interface SalesMarketingCardsProps {
  selectedYear: string;
}

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

const isCurrentFiscalYearSelection = (fy: string) => fy === getCurrentFiscalYearString();

const getCurrentFiscalYearYtdFromTo = (fyStartYear: number) => {
  const fyStart = dayjs().year(fyStartYear).month(3).date(1).startOf("day");
  const today = dayjs().startOf("day");
  if (today.isSame(fyStart, "day")) {
    return { from: fyStart, to: fyStart };
  }
  return { from: fyStart, to: dayjs().subtract(1, "day").startOf("day") };
};

const getYTPMDateRange = (selectedYear: string) => {
  const fy = parseFiscalYearLabel(selectedYear);
  if (!fy) return null;

  const fyStart = dayjs().year(fy.start).month(3).date(1);
  const today = dayjs().startOf("day");
  const previousMonthEnd = today.subtract(1, "month").endOf("month");

  if (isCurrentFiscalYearSelection(selectedYear)) {
    if (today.month() === 3) {
      return { from: fyStart, to: fyStart.endOf("month") };
    }
    return { from: fyStart, to: previousMonthEnd };
  }

  return {
    from: dayjs().year(fy.start).month(3).date(1),
    to: dayjs().year(fy.end).month(2).date(31),
  };
};

const getCurrentMonthStartThroughYesterdayClamped = () => {
  const today = dayjs().startOf("day");
  const monthStart = today.startOf("month");
  if (today.date() === 1) {
    return { from: monthStart, to: monthStart };
  }
  return { from: monthStart, to: dayjs().subtract(1, "day").startOf("day") };
};

const getPreviousFYSbuDateRangeDefaults = (fy: { start: number; end: number }) => {
  return {
    from: dayjs().year(fy.end).month(2).date(1),
    to: dayjs().year(fy.end).month(2).date(31),
  };
};

interface SbuData {
  name: string;
  current: number;
  historical: number;
}

const calculateGrowth = (current: number, historical: number): number => {
  if (historical === 0) return current !== 0 ? 100 : 0;
  const v = Number((((current - historical) / historical) * 100).toFixed(1));
  return Math.min(100, Math.max(-100, v));
};

const formatNumber = (num: number): string => {
  return num.toLocaleString("en-IN");
};

interface SummaryTableProps {
  title: string;
  subtitle?: string;
  data: SbuData[];
  loading: boolean;
  showActions?: boolean;
  showRefreshOnly?: boolean;
  onCalendarClick?: () => void;
  onRefreshClick?: () => void;
  isPopoverOpen?: boolean;
  onPopoverChange?: (open: boolean) => void;
  popoverContent?: React.ReactNode;
}

const SummaryTable: React.FC<SummaryTableProps> = ({
  title,
  subtitle,
  data,
  loading,
  showActions = false,
  showRefreshOnly = false,
  onCalendarClick,
  onRefreshClick,
  isPopoverOpen,
  onPopoverChange,
  popoverContent,
}) => {
  const total = data.reduce(
    (acc, item) => ({
      current: acc.current + item.current,
      historical: acc.historical + item.historical,
    }),
    { current: 0, historical: 0 }
  );

  const totalGrowth = calculateGrowth(total.current, total.historical);

  return (
    <div className="bg-white rounded-md overflow-hidden border border-gray-300">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <h3 className="text-[11px] font-bold text-gray-800">{title}</h3>
            {showRefreshOnly && onRefreshClick && (
              <button
                onClick={onRefreshClick}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                title="Refresh"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
          </div>
          {subtitle && (
            <span className="text-[9px] text-gray-500 mt-0.5">{subtitle}</span>
          )}
        </div>
        {showActions && (
          <div className="flex items-center gap-1">
            <button
              onClick={onRefreshClick}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <Popover open={isPopoverOpen} onOpenChange={onPopoverChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0 border-gray-300"
                  onClick={onCalendarClick}
                >
                  <Calendar className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              {popoverContent}
            </Popover>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        </div>
      ) : (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-3 py-1.5 font-semibold text-gray-600">SBU</th>
              <th className="text-right px-3 py-1.5 font-semibold text-gray-600">Current</th>
              <th className="text-right px-3 py-1.5 font-semibold text-gray-600">Previous</th>
              <th className="text-right px-3 py-1.5 font-semibold text-gray-600">Growth</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-4 text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              <>
                {data.map((item, index) => {
                  const growth = calculateGrowth(item.current, item.historical);
                  return (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-1 text-gray-700">{item.name}</td>
                      <td className="px-3 py-1 text-right text-gray-800 font-medium">
                        {formatNumber(Math.round(item.current))}
                      </td>
                      <td className="px-3 py-1 text-right text-gray-600">
                        {formatNumber(Math.round(item.historical))}
                      </td>
                      <td
                        className={`px-3 py-1 text-right font-semibold ${
                          growth > 0 ? "text-green-600" : growth < 0 ? "text-red-600" : "text-gray-500"
                        }`}
                      >
                        {growth > 0 ? "+" : ""}
                        {growth.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                  <td className="px-3 py-1.5 text-gray-800">Total</td>
                  <td className="px-3 py-1.5 text-right text-gray-800">
                    {formatNumber(Math.round(total.current))}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-600">
                    {formatNumber(Math.round(total.historical))}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right font-bold ${
                      totalGrowth > 0 ? "text-green-600" : totalGrowth < 0 ? "text-red-600" : "text-gray-500"
                    }`}
                  >
                    {totalGrowth > 0 ? "+" : ""}
                    {totalGrowth.toFixed(1)}%
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

const SalesMarketingCards: React.FC<SalesMarketingCardsProps> = ({ selectedYear }) => {
  const [loadingYtd, setLoadingYtd] = useState(true);
  const [loadingYtpm, setLoadingYtpm] = useState(true);
  const [loadingDateRange, setLoadingDateRange] = useState(true);
  const [ytpmDateView, setYtpmDateView] = useState<"ytpm" | "date">("ytpm");

  const [ytdData, setYtdData] = useState<SbuData[]>([]);
  const [ytpmData, setYtpmData] = useState<SbuData[]>([]);
  const [dateRangeData, setDateRangeData] = useState<SbuData[]>([]);

  const [isOpen, setIsOpen] = useState(false);

  const getInitialDateRange = useCallback(() => {
    const fy = parseFiscalYearLabel(selectedYear);
    const previousFY = getPreviousFiscalYearString();
    if (fy && selectedYear === previousFY) {
      return getPreviousFYSbuDateRangeDefaults(fy);
    }
    return getCurrentMonthStartThroughYesterdayClamped();
  }, [selectedYear]);

  const [fromDate, setFromDate] = useState(() => getInitialDateRange().from);
  const [toDate, setToDate] = useState(() => getInitialDateRange().to);
  const [displayFromDate, setDisplayFromDate] = useState(() => getInitialDateRange().from);
  const [displayToDate, setDisplayToDate] = useState(() => getInitialDateRange().to);

  const formatDate = (date: dayjs.Dayjs) => dayjs(date).format("YYYY-MM-DD");

  const getYtdDateRange = useCallback(() => {
    const fy = parseFiscalYearLabel(selectedYear);
    if (!fy) return "";
    if (isCurrentFiscalYearSelection(selectedYear)) {
      const { from, to } = getCurrentFiscalYearYtdFromTo(fy.start);
      return `${formatDate(from)},${formatDate(to)}`;
    }
    return `${fy.start}-04-01,${fy.end}-03-31`;
  }, [selectedYear]);

  const getYtdTitleRange = useCallback(() => {
    const fy = parseFiscalYearLabel(selectedYear);
    if (!fy) return "";
    if (isCurrentFiscalYearSelection(selectedYear)) {
      const { from, to } = getCurrentFiscalYearYtdFromTo(fy.start);
      return `${from.format("DD-MMM-YYYY")} to ${to.format("DD-MMM-YYYY")}`;
    }
    const fromdate = dayjs().year(fy.start).month(3).date(1);
    const todate = dayjs().year(fy.end).month(2).date(31);
    return `${fromdate.format("DD-MMM-YYYY")} to ${todate.format("DD-MMM-YYYY")}`;
  }, [selectedYear]);

  const getYtpmTitleRange = useCallback(() => {
    const r = getYTPMDateRange(selectedYear);
    if (!r) return "";
    return `${r.from.format("MMM-YYYY")} - ${r.to.format("MMM-YYYY")}`;
  }, [selectedYear]);

  const getDateRangeForSelectedYear = useCallback(() => {
    const fy = parseFiscalYearLabel(selectedYear);
    const previousFY = getPreviousFiscalYearString();
    
    if (fy && selectedYear === previousFY) {
      return {
        from: dayjs().year(fy.end).month(2).date(1),
        to: dayjs().year(fy.end).month(2).date(31),
      };
    }
    
    const today = dayjs().startOf("day");
    const monthStart = today.startOf("month");
    if (today.date() === 1) {
      return { from: monthStart, to: monthStart };
    }
    return { from: monthStart, to: dayjs().subtract(1, "day").startOf("day") };
  }, [selectedYear]);

  const getSbuWiseDateRangeDisplay = useCallback(() => {
    return `${displayFromDate.format("DD-MMM-YYYY")} to ${displayToDate.format("DD-MMM-YYYY")}`;
  }, [displayFromDate, displayToDate]);

  const SbuWiseYTD = useCallback(async () => {
    setLoadingYtd(true);
    const dateRange = getYtdDateRange();

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTD"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "equals", value: selectedYear },
    ];

    if (dateRange) {
      filter.push({ key: '"DATE"', cond: "equals", value: dateRange });
    }

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
        action: "m60_performance",
        drill_state: "",
      });

      if (response.status && response.data?.data) {
        const sbuNames = response.data.data.SBU_Name || {};
        const currentSales = response.data.data.ACTUAL_TMT_SALES || {};
        const historicalSales = response.data.data.ACTUAL_HISTORY_TMT_SALES || {};

        const sbuArray = Object.values(sbuNames) as string[];
        const currentArray = Object.values(currentSales) as number[];
        const historicalArray = Object.values(historicalSales) as number[];

        const combinedData: SbuData[] = sbuArray.map((name, index) => ({
          name,
          current: currentArray[index] || 0,
          historical: historicalArray[index] || 0,
        }));

        setYtdData(combinedData);
      } else {
        setYtdData([]);
      }
    } catch (error) {
      console.error("Error fetching YTD data:", error);
      setYtdData([]);
    } finally {
      setLoadingYtd(false);
    }
  }, [selectedYear, getYtdDateRange]);

  const SbuWiseYTPM = useCallback(async () => {
    setLoadingYtpm(true);
    const r = getYTPMDateRange(selectedYear);
    const dateRange = r ? `${formatDate(r.from)},${formatDate(r.to)}` : "";

    const filter = [
      { key: '"A"', cond: "equals", value: "true" },
      { key: '"H"', cond: "equals", value: "true" },
      { key: '"YTDPM"', cond: "equals", value: "true" },
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
    ];

    if (dateRange) {
      filter.push({ key: '"DATE"', cond: "equals", value: dateRange });
    }

    try {
      const response = await fetchChartData({
        filters: filter,
        cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
        action: "m60_performance",
        drill_state: "",
      });

      if (response.status && response.data?.data) {
        const sbuNames = response.data.data.SBU_Name || {};
        const currentSales = response.data.data.ACTUAL_TMT_SALES || {};
        const historicalSales = response.data.data.ACTUAL_HISTORY_TMT_SALES || {};

        const sbuArray = Object.values(sbuNames) as string[];
        const currentArray = Object.values(currentSales) as number[];
        const historicalArray = Object.values(historicalSales) as number[];

        const combinedData: SbuData[] = sbuArray.map((name, index) => ({
          name,
          current: currentArray[index] || 0,
          historical: historicalArray[index] || 0,
        }));

        setYtpmData(combinedData);
      } else {
        setYtpmData([]);
      }
    } catch (error) {
      console.error("Error fetching YTPM data:", error);
      setYtpmData([]);
    } finally {
      setLoadingYtpm(false);
    }
  }, [selectedYear]);

  const SbuWiseDateRange = useCallback(
    async (fromDateOverride?: dayjs.Dayjs, toDateOverride?: dayjs.Dayjs) => {
      setLoadingDateRange(true);

      let fromDateToUse: dayjs.Dayjs;
      let toDateToUse: dayjs.Dayjs;

      if (fromDateOverride && toDateOverride) {
        fromDateToUse = fromDateOverride;
        toDateToUse = toDateOverride;
      } else {
        const defaultRange = getDateRangeForSelectedYear();
        fromDateToUse = defaultRange.from;
        toDateToUse = defaultRange.to;
      }

      const filter = [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: selectedYear },
        {
          key: '"DATE"',
          cond: "equals",
          value: `${formatDate(fromDateToUse)},${formatDate(toDateToUse)}`,
        },
      ];

      try {
        const response = await fetchChartData({
          filters: filter,
          cross_filters: [{ key: '"month_name"', cond: "equals", value: "" }],
          action: "m60_performance",
          drill_state: "",
        });

        if (response.status && response.data?.data) {
          const sbuNames = response.data.data.SBU_Name || {};
          const currentSales = response.data.data.ACTUAL_TMT_SALES || {};
          const historicalSales = response.data.data.ACTUAL_HISTORY_TMT_SALES || {};

          const sbuArray = Object.values(sbuNames) as string[];
          const currentArray = Object.values(currentSales) as number[];
          const historicalArray = Object.values(historicalSales) as number[];

          const combinedData: SbuData[] = sbuArray.map((name, index) => ({
            name,
            current: currentArray[index] || 0,
            historical: historicalArray[index] || 0,
          }));

          setDateRangeData(combinedData);
        } else {
          setDateRangeData([]);
        }
      } catch (error) {
        console.error("Error fetching Date Range data:", error);
        setDateRangeData([]);
      } finally {
        setLoadingDateRange(false);
      }
    },
    [selectedYear]
  );

  useEffect(() => {
    const range = getInitialDateRange();
    setFromDate(range.from);
    setToDate(range.to);
    setDisplayFromDate(range.from);
    setDisplayToDate(range.to);
    SbuWiseYTD();
    SbuWiseYTPM();
    SbuWiseDateRange(range.from, range.to);
  }, [SbuWiseYTD, SbuWiseYTPM, getInitialDateRange]);

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      const fy = parseFiscalYearLabel(selectedYear);
      if (fy) {
        const currentFY = getCurrentFiscalYearString();
        if (selectedYear === currentFY) {
          // Current fiscal year: FY start date to yesterday
          const fyStart = dayjs().year(fy.start).month(3).date(1);
          const yesterday = dayjs().subtract(1, "day").startOf("day");
          // If today is the first day of FY, use FY start for both
          if (dayjs().startOf("day").isSame(fyStart, "day")) {
            setFromDate(fyStart);
            setToDate(fyStart);
          } else {
            setFromDate(fyStart);
            setToDate(yesterday);
          }
        } else {
          // Previous fiscal year: FY start date (1 Apr) to FY end date (31 Mar)
          setFromDate(dayjs().year(fy.start).month(3).date(1));
          setToDate(dayjs().year(fy.end).month(2).date(31));
        }
      }
    }
    setIsOpen(open);
  };

  const handleFromDateChange = (newValue: dayjs.Dayjs | null) => {
    if (newValue) setFromDate(newValue);
  };

  const handleToDateChange = (newValue: dayjs.Dayjs | null) => {
    if (newValue) setToDate(newValue);
  };

  const handleDateFilter = () => {
    setIsOpen(false);
    setDisplayFromDate(fromDate);
    setDisplayToDate(toDate);
    SbuWiseDateRange(fromDate, toDate);
  };

  const handleRefresh = () => {
    SbuWiseDateRange(displayFromDate, displayToDate);
  };

  const resetDate = () => {
    const range = getInitialDateRange();
    setFromDate(range.from);
    setToDate(range.to);
  };

  const dateRangePopoverContent = (
    <PopoverContent className="w-56 p-3" align="end">
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="flex flex-col space-y-2">
          <DatePicker
            label="From"
            value={fromDate}
            format="DD/MM/YYYY"
            views={["year", "month", "day"]}
            onChange={handleFromDateChange}
            minDate={dayjs().date(1).month(3).subtract(2, "year")}
            maxDate={dayjs()}
            slotProps={{
              textField: {
                size: "small",
                fullWidth: true,
                className: "text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs [&_.MuiInputBase-input]:py-1.5",
              },
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
            slotProps={{
              textField: {
                size: "small",
                fullWidth: true,
                className: "text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs [&_.MuiInputBase-input]:py-1.5",
              },
            }}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={resetDate}>
              Reset
            </Button>
            <Button size="sm" className="h-7 text-xs px-3 bg-blue-500 hover:bg-blue-600" onClick={handleDateFilter}>
              Apply
            </Button>
          </div>
        </div>
      </LocalizationProvider>
    </PopoverContent>
  );

  const handleYtdRefresh = () => {
    SbuWiseYTD();
  };

  const handleYtpmRefresh = () => {
    SbuWiseYTPM();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SummaryTable
        title="SBU Wise YTD (MARKETING TOTAL)"
        subtitle={getYtdTitleRange()}
        data={ytdData}
        loading={loadingYtd}
        showRefreshOnly={true}
        onRefreshClick={handleYtdRefresh}
      />

      {/* Combined YTPM + DATE RANGE card with toggle */}
      <div className="bg-white rounded-md overflow-hidden border border-gray-300">
        {/* Toggle header */}
        <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold text-gray-800 truncate">
              {ytpmDateView === "ytpm"
                ? "SBU Wise YTPM (MARKETING TOTAL TILL PREVIOUS MONTH)"
                : "SBU Wise SALES SUMMARY (DATE RANGE)"}
            </span>
            <span className="text-[9px] text-gray-500 mt-0.5">
              {ytpmDateView === "ytpm" ? getYtpmTitleRange() : getSbuWiseDateRangeDisplay()}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {/* Toggle pill */}
            <div className="flex items-center bg-gray-100 rounded-full p-0.5 border border-gray-200">
              <button
                onClick={() => setYtpmDateView("ytpm")}
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                  ytpmDateView === "ytpm"
                    ? "bg-purple-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                YTPM
              </button>
              <button
                onClick={() => setYtpmDateView("date")}
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                  ytpmDateView === "date"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Date Range
              </button>
            </div>
            {/* Actions */}
            {ytpmDateView === "ytpm" ? (
              <button
                onClick={handleYtpmRefresh}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                title="Refresh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-500 ${loadingYtpm ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            ) : (
              <>
                <button onClick={handleRefresh} className="p-1 rounded-md hover:bg-gray-100 transition-colors" title="Refresh">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-500 ${loadingDateRange ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-gray-300">
                      <Calendar className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  {dateRangePopoverContent}
                </Popover>
              </>
            )}
          </div>
        </div>

        {/* Table body — swaps based on toggle */}
        {(ytpmDateView === "ytpm" ? loadingYtpm : loadingDateRange) ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          </div>
        ) : (() => {
          const activeData = ytpmDateView === "ytpm" ? ytpmData : dateRangeData;
          const total = activeData.reduce(
            (acc, item) => ({ current: acc.current + item.current, historical: acc.historical + item.historical }),
            { current: 0, historical: 0 }
          );
          const totalGrowth = calculateGrowth(total.current, total.historical);
          return (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-600">SBU</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-gray-600">Current</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-gray-600">Previous</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-gray-600">Growth</th>
                </tr>
              </thead>
              <tbody>
                {activeData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-gray-500">No data available</td>
                  </tr>
                ) : (
                  <>
                    {activeData.map((item, index) => {
                      const growth = calculateGrowth(item.current, item.historical);
                      return (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-1 text-gray-700">{item.name}</td>
                          <td className="px-3 py-1 text-right text-gray-800 font-medium">{formatNumber(Math.round(item.current))}</td>
                          <td className="px-3 py-1 text-right text-gray-600">{formatNumber(Math.round(item.historical))}</td>
                          <td className={`px-3 py-1 text-right font-semibold ${growth > 0 ? "text-green-600" : growth < 0 ? "text-red-600" : "text-gray-500"}`}>
                            {growth > 0 ? "+" : ""}{growth.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                      <td className="px-3 py-1.5 text-gray-800">Total</td>
                      <td className="px-3 py-1.5 text-right text-gray-800">{formatNumber(Math.round(total.current))}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{formatNumber(Math.round(total.historical))}</td>
                      <td className={`px-3 py-1.5 text-right font-bold ${totalGrowth > 0 ? "text-green-600" : totalGrowth < 0 ? "text-red-600" : "text-gray-500"}`}>
                        {totalGrowth > 0 ? "+" : ""}{totalGrowth.toFixed(1)}%
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          );
        })()}
      </div>
    </div>
  );
};

export default SalesMarketingCards;
