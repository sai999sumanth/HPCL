import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/@/components/ui/radio-group";
import { Button } from "@/@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { fetchChartData } from "../api";
import { Switch } from "@/@/components/ui/switch";
import { Label } from "@/@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";

const SBUs = ["Retail", "LPG", "I&C", "Lubes", "Aviation", "PETCHEM", "NG"];

const getStyles = (value) => {
  if (value > 0) {
    return {
      background: "",
      border: "border-emerald-200/30",
      textColor: "text-emerald-700",
      icon: "text-emerald-700",
      indicator: <ArrowUpRight className="text-emerald-700" />,
    };
  } else if (value < 0) {
    return {
      background: "",
      border: "border-red-200/30",
      textColor: "text-red-700",
      icon: "text-red-700",
      indicator: <ArrowDownRight className="text-red-700" />,
    };
  } else {
    return {
      background: "",
      border: "border-gray-200/30",
      textColor: "text-gray-700",
      icon: "text-gray-700",
      indicator: null,
    };
  }
};

export default function SBUWiseProductLevel({ sbu, year }: any) {
  const [selectedSBU, setSelectedSBU] = useState("Retail");
  const [ytdData, setYtdData] = useState([]);
  const [ytdpmData, setYtdpmData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("month");
  const [isDateRangeEnabled, setIsDateRangeEnabled] = useState(false);
  const [showAllDialog, setShowAllDialog] = useState(false);
  const [visibleCardCount, setVisibleCardCount] = useState(6);

  const [selectedYear, setSelectedYear] = useState(year);

  // Default date ranges for fiscal years

  const getDefaultDatesForFiscalYear = (fiscalYear: string) => {
    const [startYear, endYear] = fiscalYear.split("-").map(Number);

    if (!startYear || !endYear) return null;

    const isCurrentFiscalYear =
      dayjs().isAfter(dayjs(`${startYear}-04-01`)) &&
      dayjs().isBefore(dayjs(`${endYear}-04-01`));

    return {
      from: dayjs(`${startYear}-04-01`), // April 1st of the start year
      to: isCurrentFiscalYear
        ? dayjs().subtract(1, "day") 
        : dayjs(`${endYear}-03-31`), // Otherwise, March 31st of the end year
    };
  };
  //  else {
  //       // Fallback to current fiscal year
  //       const currentMonth = dayjs().month();
  //       const currentYear = dayjs().year();
  //       // If current month is January-March, fiscal year started last year
  //       const fiscalYearStart = currentMonth < 3 ? currentYear - 1 : currentYear;

  //       return {
  //         from: dayjs(`${fiscalYearStart}-04-01`),
  //         to: dayjs(`${fiscalYearStart + 1}-03-31`),
  //       };
  //     }
  //   };
// const yesterday = year === "2024-2025"
//   ? dayjs().subtract(1, "day").year(2024)
//   : dayjs().subtract(1, "day");
//   // Initialize dates based on selected year
//   const defaultDates = getDefaultDatesForFiscalYear(year);
//   const [fromDate, setFromDate] = useState(defaultDates.from);
//   const [toDate, setToDate] = useState(yesterday);
const defaultDates = getDefaultDatesForFiscalYear(year);
const [fromDate, setFromDate] = useState(defaultDates.from);
const [toDate, setToDate] = useState(defaultDates.to);  
  const calculatePercentageDiff = (curr, hist) => {
    if (curr === 0 && hist === 0) return 0;
    let diff = ((curr - hist) / hist) * 100;
    if (diff > 100) diff = 100;
    if (diff < -100) diff = -100;
    return diff.toFixed(1);
  };

  const transformSalesData = (data) => {
    if (
      !data ||
      !data.ProductName ||
      Object.keys(data.ProductName).length === 0 ||
      !data.ACTUAL_TMT_SALES ||
      !data.ACTUAL_HISTORY_TMT_SALES
    ) {
      return [];
    }

    const keys = Object.keys(data.ProductName);

    return keys
      .map((key) => ({
        productName:
          data.ProductName[key] === "Compressed Bio Gas (CBG)"
            ? "CBG"
            : data.ProductName[key],
        actualTmtSales: data.ACTUAL_TMT_SALES[key] || 0,
        actualHistoryTmtSales: data.ACTUAL_HISTORY_TMT_SALES[key] || 0,
      }))
    // .filter(
    //   (item) => item.actualTmtSales !== 0 || item.actualHistoryTmtSales !== 0
    // );
  };

  const formatDate = (date) => {
    return dayjs(date).format("YYYY-MM-DD");
  };

  const fetchYtdData = async () => {
    setIsLoading(true);
    let dateFilters = [];
    let crossFilters = [];

    let payload = {
      filters: [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"T"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"YTD"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "in", value: year },
        { key: '"SBU_Name"', cond: "equals", value: sbu ? sbu : selectedSBU },
        ...dateFilters,
      ],
      cross_filters: [
        { key: '"SBU_Name"', cond: "equals", value: sbu ? sbu : selectedSBU },
        ...crossFilters,
      ],
      action: "m60_performance",
      drill_state: "",
    };

    try {
      const response = await fetchChartData(payload);
      if (response.status) {
        const transformedData = transformSalesData(response.data.data);
        setYtdData(transformedData);
      } else {
        const transformedData = transformSalesData(response.data.data);
        setYtdData(transformedData);
      }
    } catch {
      console.warn("error fetching YTD data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchYtdpmData = async () => {
    setIsLoading(true);
    let dateFilters = [];
    let crossFilters = [];

    let payload = {
      filters: [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"T"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"YTDPM"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: year },
        { key: '"SBU_Name"', cond: "equals", value: sbu ? sbu : selectedSBU },
        ...dateFilters,
      ],
      cross_filters: [
        { key: '"SBU_Name"', cond: "equals", value: sbu ? sbu : selectedSBU },
        ...crossFilters,
      ],
      action: "m60_performance",
      drill_state: "",
    };

    try {
      const response = await fetchChartData(payload);
      if (response.status) {
        const transformedData = transformSalesData(response.data.data);
        setYtdpmData(transformedData);
      } else {
        const transformedData = transformSalesData(response.data.data);
        setYtdpmData(transformedData);
        // toast.info("No data present for the YTPM");
      }
    } catch {
      console.warn("error fetching YTDPM data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateRangeData = async () => {
    setIsLoading(true);
    setMode("DATE");
    let payload = {
      filters: [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"T"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" },
        { key: '"fiscal_year"', cond: "equals", value: year },
        {
          key: '"DATE"',
          cond: "equals",
          value: `${formatDate(fromDate)},${formatDate(toDate)}`,
        },
        { key: '"SBU_Name"', cond: "equals", value: sbu ? sbu : selectedSBU },
      ],
      cross_filters: [
        { key: '"SBU_Name"', cond: "equals", value: sbu ? sbu : selectedSBU },
      ],
      action: "m60_performance",
      drill_state: "",
    };

    try {
      const response = await fetchChartData(payload);
      if (response.status) {
        const transformedData = transformSalesData(response.data.data);
        setYtdData(transformedData);
        setYtdpmData([]); // Clear YTDPM data when in date range mode
      }
    } catch {
      console.warn("error fetching date range data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isDateRangeEnabled) {
      handleDateRangeData();
    } else {
      fetchYtdData();
      fetchYtdpmData();
    }
  }, [selectedSBU, year, isDateRangeEnabled]);

  // Update date range when fiscal year changes
  useEffect(() => {
    const defaultDates = getDefaultDatesForFiscalYear(year);
    setFromDate(defaultDates.from);
    setToDate(defaultDates.to);
  }, [year]);

  const handleFromDateChange = (newValue) => {
    setFromDate(newValue);
  };

  const handleToDateChange = (newValue) => {
    setToDate(newValue);
  };

  const handleDateFilter = () => {
    handleDateRangeData();
    setIsOpen(false);
  };

  const resetDate = () => {
    const defaultDates = getDefaultDatesForFiscalYear(year);
    setFromDate(defaultDates.from);
    setToDate(defaultDates.to);
  };

  // Combine and match YTD and YTDPM data by product name
  const getCombinedData = () => {
    const combinedData = [];
    const currentSBU = sbu || selectedSBU;
    // const productOrder = productOrders[currentSBU] || [];

    // If in date range mode, just return YTD data
    // if (isDateRangeEnabled) {
    //   return [...ytdData].sort((a, b) => {
    //     const orderA = productOrder.indexOf(a.productName);
    //     const orderB = productOrder.indexOf(b.productName);
    //     return (
    //       (orderA === -1 ? 9999 : orderA) - (orderB === -1 ? 9999 : orderB)
    //     );
    //   });
    // }

    // Process all YTD products
    ytdData.forEach((ytdProduct) => {
      const ytdpmProduct = ytdpmData.find(
        (p) => p.productName === ytdProduct.productName
      );
      combinedData.push({
        productName: ytdProduct.productName,
        ytd: {
          actualTmtSales: ytdProduct.actualTmtSales,
          actualHistoryTmtSales: ytdProduct.actualHistoryTmtSales,
          percentageDiff: calculatePercentageDiff(
            ytdProduct.actualTmtSales,
            ytdProduct.actualHistoryTmtSales
          ),
        },
        ytdpm: ytdpmProduct
          ? {
            actualTmtSales: ytdpmProduct.actualTmtSales,
            actualHistoryTmtSales: ytdpmProduct.actualHistoryTmtSales,
            percentageDiff: calculatePercentageDiff(
              ytdpmProduct.actualTmtSales,
              ytdpmProduct.actualHistoryTmtSales
            ),
          }
          : null,
      });
    });

    // Add any YTDPM products not in YTD
    ytdpmData.forEach((ytdpmProduct) => {
      if (
        !combinedData.some((p) => p.productName === ytdpmProduct.productName)
      ) {
        combinedData.push({
          productName: ytdpmProduct.productName,
          ytd: null,
          ytdpm: {
            actualTmtSales: ytdpmProduct.actualTmtSales,
            actualHistoryTmtSales: ytdpmProduct.actualHistoryTmtSales,
            percentageDiff: calculatePercentageDiff(
              ytdpmProduct.actualTmtSales,
              ytdpmProduct.actualHistoryTmtSales
            ),
          },
        });
      }
    });

    // Sort by the predefined order for the current SBU
    // combinedData.sort((a, b) => {
    //   const orderA = productOrder.indexOf(a.productName);
    //   const orderB = productOrder.indexOf(b.productName);
    //   return (orderA === -1 ? 9999 : orderA) - (orderB === -1 ? 9999 : orderB);
    // });

    return combinedData;
  };

  // Function to format the display value based on the rule
  const formatDisplayValue = (value) => {
    // If value is null or undefined, return "N/A"
    if (value === null || value === undefined) return "N/A";

    // For values less than 10, show 1 decimal point
    if (Math.abs(value) < 10) {
      return parseFloat(value).toFixed(1);
    }
    // For values 10 or greater, round to nearest integer
    else {
      return Math.round(value).toString();
    }
  };

  // Update the renderProductCard function to use our new formatting logic
  const renderProductCard = (product, index) => {
    const { ytd } = product;
    // For date range mode
    if (isDateRangeEnabled) {
      const ytdPercentageDiff: any = calculatePercentageDiff(
        ytd.actualTmtSales,
        ytd.actualHistoryTmtSales
      );

      const styles = getStyles(parseFloat(ytdPercentageDiff));

      return (
        <TooltipProvider>
          <Card
            key={`${product.productName}-${index}`}
            className={`p-1 text-left ${styles.background} ${styles.border} border rounded-lg shadow-md`}
          >
            <CardHeader className="p-2 pb-0">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="text-xs font-semibold">{product.productName}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-xs ${styles.textColor} font-bold flex items-center`}>
                      {ytdPercentageDiff}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Growth % (Date Range)</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold bg-blue-100 px-1 p-[2px] rounded-md">
                  Date range
                </span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <div className="flex flex-col">
                  <span className="font-bold mr-1">Curr:</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="">{formatDisplayValue(ytd.actualTmtSales)}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{ytd.actualTmtSales}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold mr-1">Hist:</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="">{formatDisplayValue(ytd.actualHistoryTmtSales)}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{ytd.actualHistoryTmtSales}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>
      );
    }

    // Normal YTD/YTDPM mode
    const ytdStyles = product.ytd
      ? getStyles(parseFloat(product.ytd.percentageDiff))
      : getStyles(0);
    const ytdpmStyles = product.ytdpm
      ? getStyles(parseFloat(product.ytdpm.percentageDiff))
      : getStyles(0);

    return (
      <TooltipProvider>
        <Card
          key={`${product.productName}-${index}`}
          className={`p-1 text-left ${ytdStyles.background} ${ytdStyles.border} border rounded-lg shadow-md`}
        >
          <CardHeader className="p-2 pb-0">
            <span className="flex text-xs font-semibold bg-blue-100 p-[3px] rounded-sm mr-0">
              {product.productName}
            </span>
            <CardTitle className={`text-sm font-bold grid grid-cols-3 justify-between`}>
              <span className=""></span>
              <span className="flex items-center text-xs font-semibold">YTD</span>
              <span className="flex items-center text-xs font-semibold">YTPM</span>
            </CardTitle>
            
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 mt-1">
                <span className="font-medium text-xs mr-1">Gr(%)</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-[11px] ${ytdStyles.textColor} font-bold flex items-center`}>
                      {product.ytd ? product.ytd.percentageDiff + "" : "N/A"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>YTD Growth %</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-[11px] ${ytdpmStyles.textColor} font-bold flex items-center`}>
                      {product.ytdpm ? product.ytdpm.percentageDiff + "" : "N/A"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>YTPM Growth %</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <span className="font-medium text-xs mr-1">Curr:</span>
                <div className="flex flex-col text-[11px]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-semibold">
                        {product.ytd ? formatDisplayValue(product.ytd.actualTmtSales) : "N/A"}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-gray-300 text-black font-semibold">
                      <p>{product.ytd?.actualTmtSales}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-col text-[11px]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-semibold">
                        {product.ytdpm ? formatDisplayValue(product.ytdpm.actualTmtSales) : "N/A"}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{product.ytdpm?.actualTmtSales}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <span className="font-medium text-xs mr-1">Hist:</span>
                <div className="flex flex-col text-[11px]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-semibold">
                        {product.ytd ? formatDisplayValue(product.ytd.actualHistoryTmtSales) : "N/A"}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{product.ytd?.actualHistoryTmtSales}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-col text-[11px]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-semibold">
                        {product.ytdpm ? formatDisplayValue(product.ytdpm.actualHistoryTmtSales) : "N/A"}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{product.ytdpm?.actualHistoryTmtSales}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    );
  };

  const handleYearChange = (value) => {
    setSelectedYear(value);
    // Get default dates for the selected fiscal year
    const defaultDates = getDefaultDatesForFiscalYear(value);
    setFromDate(defaultDates.from);
    setToDate(defaultDates.to);
  };

  const combinedData = getCombinedData();
  const showMoreButton = combinedData.length > visibleCardCount;

  // Only show YTPM alert if not in date range mode and YTDPM data is empty
  const showYtpmAlert =
    !isDateRangeEnabled && ytdpmData && ytdpmData.length === 0;

  return (
    <div className="mb-2 space-y-1 ">
<div className="flex items-center gap-2">
  <span className="flex items-center text-sm font-extrabold">
    {sbu ? sbu : selectedSBU}-Productwise sales
  </span>
  <button
    onClick={() => {
      if (isDateRangeEnabled) {
        handleDateRangeData();
      } else {
        fetchYtdData();
        fetchYtdpmData();
      }
    }}
    className="p-1 rounded-md hover:bg-gray-100 transition-colors"
    title="Refresh"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-4 w-4 text-gray-500 ${isLoading ? "animate-spin" : ""}`}
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
</div>
      
      <div className="flex gap-3 mb-0 mt-0 font-['verdana']">
        {/* Radio Group for SBU Selection */}
        {!sbu && (
          <RadioGroup
            value={selectedSBU}
            onValueChange={setSelectedSBU}
            className="flex space-x-4"
          >
            {SBUs.map((sbu) => (
              <div key={sbu} className="flex items-center space-x-2">
                <RadioGroupItem
                  className="border-[0.1rem]"
                  value={sbu}
                  id={sbu}
                />
                <label className="font-bold text-xs" htmlFor={sbu}>
                  {sbu}
                </label>
              </div>
            ))}
          </RadioGroup>
        )}

        <div className="flex items-center space-x-2">
          <Switch
            id="date-range-toggle"
            checked={isDateRangeEnabled}
            onCheckedChange={setIsDateRangeEnabled}
            className="w-10 data-[state=checked]:bg-blue-500"
          />
          <Label htmlFor="date-range-toggle">Enable Date Range</Label>
        </div>

        {/* Date Picker Input */}
        {isDateRangeEnabled && (
          <div className="flex items-center space-x-4">
            <div className="flex gap-1 lg:col-start-5 justify-end">
              <Popover open={isOpen} onOpenChange={setIsOpen}>
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
                          minDate={dayjs().date(1).month(3).subtract(2, "year")}
                          maxDate={dayjs().add(1, "year")}
                          onChange={handleFromDateChange}
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
                          maxDate={dayjs().add(1, "year")}
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
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {/* <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-40 h-8 text-xs font-semibold border-[1.5px]">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-2026">2025-2026</SelectItem>
              <SelectItem value="2024-2025">2024-2025</SelectItem>
            </SelectContent>
          </Select> */}

          {/* Show more button - positioned next to the dropdown */}
          {showMoreButton && (
            <Button
              onClick={() => setShowAllDialog(true)}
              variant="link"
              className="text-blue-600 text-xs font-medium flex items-center ml-2"
            >
              Show More <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Only show YTPM alert if not in date range mode */}
      {/* {showYtpmAlert && (
        <Alert variant="info" className="bg-blue-50">
          <AlertCircle className="h-6 w-6 rounded-full" />
          <AlertTitle className="font-bold">Info</AlertTitle>
          <AlertDescription className="font-[500]">
            No data is available in YTPM for the current year {selectedYear}.
          </AlertDescription>
        </Alert>
      )} */}

      {
        ytdData.length === 0 && ytdpmData.length === 0 && (
          <p>There are no products available in this SBU...</p>
        )
      }

      {isLoading ? (
        <div className="text-center p-4">Loading data...</div>
      ) : (
        <div className="">
          {/* Grid showing limited cards */}
          <div className="grid lg:grid-cols-6 md:grid-cols-3 sm:grid-cols-2 xs:grid-cols-1 gap-2" key={Math.random()}>
            {combinedData
              .slice(0, visibleCardCount)
              .map((product, index) => (
                <div key={product.id ?? index}>
                  {renderProductCard(product, index)}
                </div>
              ))}
          </div>

          {/* Dialog for showing all cards */}
          <Dialog open={showAllDialog} onOpenChange={setShowAllDialog}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>All Products for {sbu || selectedSBU}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {combinedData && combinedData.length > 0 && combinedData.map((product, index) => (
                  <div key={product.id ?? index}>
                    {renderProductCard(product, index)}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
