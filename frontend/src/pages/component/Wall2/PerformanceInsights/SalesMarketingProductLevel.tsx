import React, { useEffect, useState, useCallback, useRef } from "react";
import { RadioGroup, RadioGroupItem } from "@/@/components/ui/radio-group";
import { Button } from "@/@/components/ui/button";
import { Calendar, Loader2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { fetchChartData } from "../api";
import { Switch } from "@/@/components/ui/switch";
import { Label } from "@/@/components/ui/label";

const SBUs = ["Retail", "LPG", "I&C", "Lubes", "Aviation", "PETCHEM", "NG"];

interface SalesMarketingProductLevelProps {
  year: string;
  sbu?: string;
}

interface ProductData {
  productName: string;
  actualTmtSales: number;
  actualHistoryTmtSales: number;
}

interface CombinedProductData {
  productName: string;
  ytd: {
    actualTmtSales: number;
    actualHistoryTmtSales: number;
    percentageDiff: string;
  } | null;
  ytdpm: {
    actualTmtSales: number;
    actualHistoryTmtSales: number;
    percentageDiff: string;
  } | null;
}

const calcPct = (curr: number, hist: number) => {
  const v = hist === 0 ? (curr !== 0 ? 100 : 0) : Number((((curr - hist) / hist) * 100).toFixed(2));
  return Math.min(100, Math.max(-100, v));
};

const pctLabel = (pct: number) => `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;

const SalesMarketingProductLevel: React.FC<SalesMarketingProductLevelProps> = ({ year, sbu }) => {
  const [selectedSBU, setSelectedSBU] = useState("Retail");
  const [ytdData, setYtdData] = useState<ProductData[]>([]);
  const [ytdpmData, setYtdpmData] = useState<ProductData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDateRangeEnabled, setIsDateRangeEnabled] = useState(false);
  const [displayFromDate, setDisplayFromDate] = useState<dayjs.Dayjs | null>(null);
  const [displayToDate, setDisplayToDate] = useState<dayjs.Dayjs | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollCallbackRef = useCallback((el: HTMLDivElement | null) => {
    (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (!el) return;
    updateScroll();
    el.addEventListener("scroll", updateScroll);
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
  }, [updateScroll]);

  const scrollCards = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" });
  };

  const getDefaultDatesForFiscalYear = useCallback((fiscalYear: string) => {
    const [startYear, endYear] = fiscalYear.split("-").map(Number);
    if (!startYear || !endYear) return { from: dayjs(), to: dayjs() };
    const isCurrentFY = dayjs().isAfter(dayjs(`${startYear}-04-01`)) && dayjs().isBefore(dayjs(`${endYear}-04-01`));
    return { from: dayjs(`${startYear}-04-01`), to: isCurrentFY ? dayjs().subtract(1, "day") : dayjs(`${endYear}-03-31`) };
  }, []);

  const defaultDates = getDefaultDatesForFiscalYear(year);
  const [fromDate, setFromDate] = useState(defaultDates.from);
  const [toDate, setToDate] = useState(defaultDates.to);

  const calculatePercentageDiff = (curr: number, hist: number): string => {
    if (curr === 0 && hist === 0) return "0";
    if (hist === 0) return curr > 0 ? "100" : "-100";
    let diff = ((curr - hist) / hist) * 100;
    if (diff > 100) diff = 100;
    if (diff < -100) diff = -100;
    return diff.toFixed(1);
  };

  const transformSalesData = (data: any): ProductData[] => {
    if (!data?.ProductName || Object.keys(data.ProductName).length === 0 ||
      !data.ACTUAL_TMT_SALES || !data.ACTUAL_HISTORY_TMT_SALES) return [];
    return Object.keys(data.ProductName).map((key) => ({
      productName: data.ProductName[key] === "Compressed Bio Gas (CBG)" ? "CBG" : data.ProductName[key],
      actualTmtSales: data.ACTUAL_TMT_SALES[key] || 0,
      actualHistoryTmtSales: data.ACTUAL_HISTORY_TMT_SALES[key] || 0,
    }));
  };

  const formatDate = (date: dayjs.Dayjs) => dayjs(date).format("YYYY-MM-DD");
  const activeSbu = sbu ?? selectedSBU;

  const fetchYtdData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchChartData({
        filters: [
          { key: '"A"', cond: "equals", value: "true" },
          { key: '"H"', cond: "equals", value: "true" },
          { key: '"T"', cond: "equals", value: "true" },
          { key: '"C"', cond: "equals", value: "true" },
          { key: '"YTD"', cond: "equals", value: "true" },
          { key: '"fiscal_year"', cond: "in", value: year },
          { key: '"SBU_Name"', cond: "equals", value: activeSbu },
        ],
        cross_filters: [{ key: '"SBU_Name"', cond: "equals", value: activeSbu }],
        action: "m60_performance", drill_state: "",
      });
      setYtdData(response.status && response.data?.data ? transformSalesData(response.data.data) : []);
    } catch { setYtdData([]); } finally { setIsLoading(false); }
  }, [year, activeSbu]);

  const fetchYtdpmData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchChartData({
        filters: [
          { key: '"A"', cond: "equals", value: "true" },
          { key: '"H"', cond: "equals", value: "true" },
          { key: '"T"', cond: "equals", value: "true" },
          { key: '"C"', cond: "equals", value: "true" },
          { key: '"YTDPM"', cond: "equals", value: "true" },
          { key: '"fiscal_year"', cond: "equals", value: year },
          { key: '"SBU_Name"', cond: "equals", value: activeSbu },
        ],
        cross_filters: [{ key: '"SBU_Name"', cond: "equals", value: activeSbu }],
        action: "m60_performance", drill_state: "",
      });
      setYtdpmData(response.status && response.data?.data ? transformSalesData(response.data.data) : []);
    } catch { setYtdpmData([]); } finally { setIsLoading(false); }
  }, [year, activeSbu]);

  const handleDateRangeData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchChartData({
        filters: [
          { key: '"A"', cond: "equals", value: "true" },
          { key: '"H"', cond: "equals", value: "true" },
          { key: '"T"', cond: "equals", value: "true" },
          { key: '"C"', cond: "equals", value: "true" },
          { key: '"fiscal_year"', cond: "equals", value: year },
          { key: '"DATE"', cond: "equals", value: `${formatDate(fromDate)},${formatDate(toDate)}` },
          { key: '"SBU_Name"', cond: "equals", value: activeSbu },
        ],
        cross_filters: [{ key: '"SBU_Name"', cond: "equals", value: activeSbu }],
        action: "m60_performance", drill_state: "",
      });
      if (response.status && response.data?.data) {
        setYtdData(transformSalesData(response.data.data));
        setYtdpmData([]);
      } else { setYtdData([]); setYtdpmData([]); }
    } catch { setYtdData([]); setYtdpmData([]); } finally { setIsLoading(false); }
  }, [year, activeSbu, fromDate, toDate]);

  useEffect(() => {
    if (isDateRangeEnabled) handleDateRangeData();
    else { fetchYtdData(); fetchYtdpmData(); }
  }, [selectedSBU, year, isDateRangeEnabled, fetchYtdData, fetchYtdpmData]);

  useEffect(() => {
    const d = getDefaultDatesForFiscalYear(year);
    setFromDate(d.from);
    setToDate(d.to);
  }, [year, getDefaultDatesForFiscalYear]);

  useEffect(() => { updateScroll(); }, [ytdData, updateScroll]);

  const formatVal = (v: number) => Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toLocaleString("en-IN");

  const getCombinedData = (): CombinedProductData[] => {
    const combined: CombinedProductData[] = [];
    ytdData.forEach((ytdP) => {
      const ytdpmP = ytdpmData.find((p) => p.productName === ytdP.productName);
      combined.push({
        productName: ytdP.productName,
        ytd: { actualTmtSales: ytdP.actualTmtSales, actualHistoryTmtSales: ytdP.actualHistoryTmtSales, percentageDiff: calculatePercentageDiff(ytdP.actualTmtSales, ytdP.actualHistoryTmtSales) },
        ytdpm: ytdpmP ? { actualTmtSales: ytdpmP.actualTmtSales, actualHistoryTmtSales: ytdpmP.actualHistoryTmtSales, percentageDiff: calculatePercentageDiff(ytdpmP.actualTmtSales, ytdpmP.actualHistoryTmtSales) } : null,
      });
    });
    ytdpmData.forEach((ytdpmP) => {
      if (!combined.some((p) => p.productName === ytdpmP.productName)) {
        combined.push({ productName: ytdpmP.productName, ytd: null, ytdpm: { actualTmtSales: ytdpmP.actualTmtSales, actualHistoryTmtSales: ytdpmP.actualHistoryTmtSales, percentageDiff: calculatePercentageDiff(ytdpmP.actualTmtSales, ytdpmP.actualHistoryTmtSales) } });
      }
    });
    return combined;
  };

  const handleRefresh = () => {
    const defaultDates = getDefaultDatesForFiscalYear(year);
    setFromDate(defaultDates.from);
    setToDate(defaultDates.to);
    setIsDateRangeEnabled(false);
    setDisplayFromDate(null);
    setDisplayToDate(null);
    setSelectedSBU("Retail");
    fetchYtdData();
    fetchYtdpmData();
  };

  const combinedData = getCombinedData();

  const renderCard = (product: CombinedProductData) => {
    const pct = product.ytd ? calcPct(product.ytd.actualTmtSales, product.ytd.actualHistoryTmtSales) : 0;
    const pos = pct >= 0;
    const nameRef = React.createRef<HTMLSpanElement>();
    const handleMouseEnter = () => {
      const el = nameRef.current;
      if (el) el.title = el.scrollWidth > el.offsetWidth ? product.productName : "";
    };

    return (
      <div key={product.productName}
        className={`flex flex-col flex-shrink-0 w-[200px] px-4 py-3 rounded-lg border gap-2 transition-all duration-150
          ${pos ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}
      >
        {/* Name + % */}
        <div className="flex items-center justify-between gap-2">
          <span ref={nameRef} onMouseEnter={handleMouseEnter}
            className="text-[13px] font-bold text-gray-700 uppercase truncate leading-tight flex-1">
            {product.productName}
          </span>
          <span className={`text-[13px] font-extrabold leading-tight flex-shrink-0 ${pos ? "text-blue-700" : "text-red-600"}`}>
            {pctLabel(pct)}
          </span>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gray-200" />

        {/* YTD / YTPM columns */}
        {!isDateRangeEnabled ? (
          <div className="grid grid-cols-2 gap-3">
            {/* YTD */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">YTD</span>
              {product.ytd ? (
                <>
                  <span className={`text-xs font-extrabold ${calcPct(product.ytd.actualTmtSales, product.ytd.actualHistoryTmtSales) >= 0 ? "text-blue-600" : "text-red-500"}`}>
                    {pctLabel(calcPct(product.ytd.actualTmtSales, product.ytd.actualHistoryTmtSales))}
                  </span>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 uppercase">Curr</span>
                      <span className="text-[13px] font-extrabold text-gray-800 tabular-nums">{formatVal(product.ytd.actualTmtSales)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 uppercase">Hist</span>
                      <span className="text-[13px] font-semibold text-gray-500 tabular-nums">{formatVal(product.ytd.actualHistoryTmtSales)}</span>
                    </div>
                  </div>
                </>
              ) : <span className="text-xs text-gray-400">N/A</span>}
            </div>
            {/* YTPM */}
            <div className="flex flex-col gap-1.5 border-l border-gray-200 pl-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">YTPM</span>
              {product.ytdpm ? (
                <>
                  <span className={`text-xs font-extrabold ${calcPct(product.ytdpm.actualTmtSales, product.ytdpm.actualHistoryTmtSales) >= 0 ? "text-blue-600" : "text-red-500"}`}>
                    {pctLabel(calcPct(product.ytdpm.actualTmtSales, product.ytdpm.actualHistoryTmtSales))}
                  </span>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 uppercase">Curr</span>
                      <span className="text-[13px] font-extrabold text-gray-800 tabular-nums">{formatVal(product.ytdpm.actualTmtSales)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 uppercase">Hist</span>
                      <span className="text-[13px] font-semibold text-gray-500 tabular-nums">{formatVal(product.ytdpm.actualHistoryTmtSales)}</span>
                    </div>
                  </div>
                </>
              ) : <span className="text-xs text-gray-400">N/A</span>}
            </div>
          </div>
        ) : (
          product.ytd ? (
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400 uppercase">Curr</span>
                <span className="text-[13px] font-extrabold text-gray-800 tabular-nums">{formatVal(product.ytd.actualTmtSales)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400 uppercase">Hist</span>
                <span className="text-[13px] font-semibold text-gray-500 tabular-nums">{formatVal(product.ytd.actualHistoryTmtSales)}</span>
              </div>
            </div>
          ) : <span className="text-xs text-gray-400">N/A</span>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden border-indigo-200 mt-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <div className="min-w-0 flex-shrink-0">
          <p className="text-xs font-bold text-gray-800 leading-tight flex items-center gap-1.5 flex-wrap">
            {activeSbu} — Product Wise Sales
            {isDateRangeEnabled && displayFromDate && displayToDate ? (
              <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                {displayFromDate.format("DD-MMM-YYYY")} → {displayToDate.format("DD-MMM-YYYY")}
              </span>
            ) : !isDateRangeEnabled && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                {getDefaultDatesForFiscalYear(year).from.format("MMM-YYYY")} – {getDefaultDatesForFiscalYear(year).to.format("MMM-YYYY")}
              </span>
            )}
          </p>
        </div>

        {/* SBU selector inline (only if no sbu prop) */}
        {!sbu && (
          <>
            <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
            <RadioGroup value={selectedSBU} onValueChange={setSelectedSBU}
              className="flex gap-3 items-center flex-wrap">
              {SBUs.map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <RadioGroupItem className="border-[0.1rem]" value={s} id={`sbu-${s}`} />
                  <label className="text-xs font-semibold cursor-pointer" htmlFor={`sbu-${s}`}>{s}</label>
                </div>
              ))}
            </RadioGroup>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Switch id="date-range-toggle" checked={isDateRangeEnabled}
            onCheckedChange={(v) => { setIsDateRangeEnabled(v); if (v) { setDisplayFromDate(fromDate); setDisplayToDate(toDate); } else { setDisplayFromDate(null); setDisplayToDate(null); } }}
            className="data-[state=checked]:bg-blue-500" />
          <Label htmlFor="date-range-toggle" className="text-[11px] text-gray-500 cursor-pointer whitespace-nowrap">Date Range</Label>
        </div>

        {isDateRangeEnabled && (
          <>
            <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <button className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors flex-shrink-0" title="Select date range">
                  <Calendar className="h-3.5 w-3.5 text-gray-600" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <div className="flex flex-col gap-2">
                    <DatePicker label="From" value={fromDate} format="DD/MM/YYYY" views={["year", "month", "day"]}
                      onChange={(v) => v && setFromDate(v)}
                      minDate={dayjs().date(1).month(3).subtract(2, "year")} maxDate={dayjs()}
                      slotProps={{ textField: { size: "small", fullWidth: true, className: "text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs [&_.MuiInputBase-input]:py-1.5" } }} />
                    <DatePicker label="To" value={toDate} format="DD/MM/YYYY" views={["year", "month", "day"]}
                      onChange={(v) => v && setToDate(v)}
                      minDate={dayjs().date(1).month(3).subtract(2, "year")} maxDate={dayjs()}
                      slotProps={{ textField: { size: "small", fullWidth: true, className: "text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs [&_.MuiInputBase-input]:py-1.5" } }} />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                        onClick={() => { const d = getDefaultDatesForFiscalYear(year); setFromDate(d.from); setToDate(d.to); }}>Reset</Button>
                      <Button size="sm" className="h-6 text-xs px-2 bg-blue-500 hover:bg-blue-600"
                        onClick={() => { handleDateRangeData(); setDisplayFromDate(fromDate); setDisplayToDate(toDate); setIsOpen(false); }}>Apply</Button>
                    </div>
                  </div>
                </LocalizationProvider>
              </PopoverContent>
            </Popover>
          </>
        )}

        <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
        <button onClick={handleRefresh} disabled={isLoading}
          className="p-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors flex-shrink-0" title="Refresh">
          <RotateCcw className={`h-3.5 w-3.5 text-gray-500 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>


      {/* Cards area */}
      <div className="bg-gray-50 px-3 py-2.5">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : combinedData.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No products available.</p>
        ) : (
          <div className="relative flex items-stretch">
            {canScrollLeft && (
              <button onClick={() => scrollCards("left")}
                className="flex-shrink-0 z-10 self-center w-5 h-5 flex items-center justify-center rounded-full bg-pink-100/80 backdrop-blur-sm border border-pink-300 shadow-sm hover:bg-pink-200 transition-colors mr-1">
                <ChevronLeft className="h-3 w-3 text-pink-500" />
              </button>
            )}
            <div ref={scrollCallbackRef} onScroll={updateScroll}
              className="flex gap-2 overflow-x-auto flex-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {combinedData.map((p) => renderCard(p))}
            </div>
            {canScrollRight && (
              <button onClick={() => scrollCards("right")}
                className="flex-shrink-0 z-10 self-center w-5 h-5 flex items-center justify-center rounded-full bg-pink-100/80 backdrop-blur-sm border border-pink-300 shadow-sm hover:bg-pink-200 transition-colors ml-1">
                <ChevronRight className="h-3 w-3 text-pink-500" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesMarketingProductLevel;
