import type React from "react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/@/components/ui/card";
import {
  IconArrowLeft,
  IconMaximize,
  IconMinimize,
  IconRestore,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { toast } from "sonner";
import dayjs from "dayjs";
import convertToFilters from "@/utils/dynamicFilter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { Calendar } from "lucide-react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Button } from "@/@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { Badge } from "@/@/components/ui/badge";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent } from "ag-grid-community";
import { debounce } from "lodash";
import { fetchChartData } from "../../api";
import { getHierarchyColWidth, HierarchyRenderer, LoadingOverlay, SbuNameRenderer, getRowStyleByLevel } from "./RedesignUtils";
import {
  ActiveStates,
  ChartMode,
  Filter,
  FilterOption,
  FilterState,
  TableDataType,
} from "./DataTypes";
import {
  categoryData,
  createFilters,
  defaultColDef,
  getInitialDrilldownListValues,
  haButtonsData,
  metricCols,
  removeDuplicateFilters,
  tButtonsData,
  transformTableData,
  useTableRowToggle,
  validateDateRange,
} from "./HelperFunctions";

interface SalesMarketingPivotTableProps {
  selectedYear: string;
}

const SalesMarketingPivotTable: React.FC<SalesMarketingPivotTableProps> = ({
  selectedYear: propSelectedYear,
}) => {
  const [tableData, setTableData] = useState<TableDataType[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
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
  const perspectiveFilters = convertToFilters(activeStates);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterOption[]>(perspectiveFilters);

  const [isLoading, setIsLoading] = useState(true);
  const [isResponse, setIsResponses] = useState(false);
  const [mode, setMode] = useState<ChartMode>("ytd");
  const [drillHistory, setDrillHistory] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState(propSelectedYear);
  const [isDrillDown, setIsDrillDown] = useState<boolean | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [crossFilters, setCrossFilters] = useState<Filter[]>([]);
  const [salesUnit, setSalesUnit] = useState<string>("TMT");
  const [selectedYorM, setSelectedYorM] = useState<"Y" | "M">("Y");
  const firstDayOfMonth = dayjs().date(1).month(3);
  const [isExpanded, setIsExpanded] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    totalActual: number;
    totalTarget: number;
    totalHistory: number;
  }>({ totalActual: 0, totalTarget: 0, totalHistory: 0 });

  const yesterday = dayjs().subtract(1, "day");
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(yesterday);

  const badgeVariants = [
    "secondary",
    "info",
    "success",
    "warning",
    "destructive",
    "info2",
  ] as const;

  const [drilldownList, setDrilldownList] = useState(
    getInitialDrilldownListValues(selectedYorM)
  );
  const tableRef = useRef<AgGridReact>(null);
  const hierarchyWidthsRef = useRef<Record<string, number>>({});
  const hasUserResizedRef = useRef(false);

  // Calculate current and previous fiscal years
  const fiscalYearOptions = useMemo(() => {
    const currentMonth = dayjs().month(); // 0-indexed (0 = January, 3 = April)
    const currentYear = dayjs().year();
    
    // Fiscal year starts in April (month index 3)
    // If current month is April or later, current FY is currentYear-nextYear
    // If current month is before April, current FY is prevYear-currentYear
    const currentFYStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const currentFY = `${currentFYStartYear}-${currentFYStartYear + 1}`;
    const previousFY = `${currentFYStartYear - 1}-${currentFYStartYear}`;
    
    return [currentFY, previousFY];
  }, []);

  useEffect(() => {
    setSelectedYear(propSelectedYear);
  }, [propSelectedYear]);

  useEffect(() => {
    setDrilldownList(getInitialDrilldownListValues(selectedYorM));
  }, [selectedYorM]);

  const onColumnResized = useCallback((params: any) => {
    if (!params.finished) return;
    const col = params.column;
    if (!col) return;
    const colId = col.getColId();

    if (colId.startsWith("hierarchy_")) {
      hierarchyWidthsRef.current[colId] = col.getActualWidth();
      hasUserResizedRef.current = true;
    }
  }, []);

  useEffect(() => {
    handleModeChange("ytd");
    setMode("ytd");
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filtersToUse =
        mode === "ytd"
          ? [
              ...appliedFilters.filter((f) => f.key !== '"YTD"'),
              { key: '"YTD"', cond: "equals", value: "true" },
            ]
          : appliedFilters.filter((f) => f.key !== '"YTD"');

      const originalFilter = removeDuplicateFilters(filtersToUse);

      const cleanedFilters = originalFilter.filter(
        (f) => f.key !== '"fiscal_year"'
      );
      cleanedFilters.push({
        key: '"fiscal_year"',
        cond: "equals",
        value: selectedYear,
      });

      // First API call: Get summary totals (empty cross_filters)
      const summaryResponse = await fetchChartData({
        filters: cleanedFilters,
        cross_filters: [],
        action: "m60_performance",
        drill_state: "",
      });

      const newSalesUnit = summaryResponse?.data?.sales_unit || "TMT";
      setSalesUnit(newSalesUnit);

      if (summaryResponse.status && summaryResponse.data) {
        // Calculate summary totals from the response
        const actualSales = summaryResponse.data.data?.ACTUAL_TMT_SALES || {};
        const targetSales = summaryResponse.data.data?.TARGET_TMT_SALES || {};
        const historySales = summaryResponse.data.data?.ACTUAL_HISTORY_TMT_SALES || {};
        
        const totalActual = Object.values(actualSales).reduce<number>(
          (sum, val) => sum + (Number(val) || 0),
          0
        );
        const totalTarget = Object.values(targetSales).reduce<number>(
          (sum, val) => sum + (Number(val) || 0),
          0
        );
        const totalHistory = Object.values(historySales).reduce<number>(
          (sum, val) => sum + (Number(val) || 0),
          0
        );
        
        setSummaryData({ totalActual, totalTarget, totalHistory });
      }

      // Second API call: Get SBU-level data for table (with cumulative: true in cross_filters)
      const tableResponse = await fetchChartData({
        filters: cleanedFilters,
        cross_filters: [{ key: '"cumulative"', cond: "equals", value: "true" }],
        action: "m60_performance",
        drill_state: "",
      });

      console.log("Table API Response:", tableResponse.data?.data);
      
      if (tableResponse.status && tableResponse.data) {
        if (
          Object.keys(tableResponse.data.data?.ACTUAL_HISTORY_TMT_SALES || {}).length === 0 ||
          Object.keys(tableResponse.data.data?.ACTUAL_TMT_SALES || {}).length === 0
        ) {
          toast.warning(
            "No data present for the selected combination. Please select some other combination."
          );
          setIsLoading(false);
          setIsResponses(false);
          return;
        }

        const isAllZero =
          Object.values(tableResponse.data.data?.ACTUAL_TMT_SALES || {}).every(
            (value) => value === 0
          ) &&
          Object.values(tableResponse.data.data?.TARGET_TMT_SALES || {}).every(
            (value) => value === 0
          ) &&
          Object.values(tableResponse.data.data?.ACTUAL_HISTORY_TMT_SALES || {}).every(
            (value) => value === 0
          );

        if (isAllZero) {
          toast.warning(
            "No data found for the selected combination! All sales values are 0."
          );
          setIsLoading(false);
          setIsResponses(false);
          return;
        }

        setIsResponses(true);
        
        // Transform data - this will now receive SBU_Name data directly
        const transformedData = transformTableData(
          tableResponse.data?.data,
          1, // Start from level 1 (SBU level)
          selectedYorM
        );
        setTableData(transformedData);
      } else {
        setIsResponses(false);
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      setIsResponses(false);
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  }, [drillLevel, mode, activeStates, appliedFilters, crossFilters, selectedYear, selectedYorM]);

  const debouncedLoadData = useMemo(
    () => debounce(loadData, 300),
    [loadData]
  );

  useEffect(() => {
    debouncedLoadData();
    return () => debouncedLoadData.cancel();
  }, [appliedFilters, crossFilters, debouncedLoadData]);

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
      if (selectedYorM === "M") {
        updatedStates["C"] = false;
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

  const handleBackClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setIsDrillDown(true);
      if (drillLevel <= 0) return;

      const drillDownOrder = [
        '"cumulative"',
        '"SBU_Name"',
        '"ProductName"',
        '"Zone_Name"',
        '"Region_Name"',
        '"SalesArea_Name"',
      ];

      const currentDrillFilter = drillDownOrder[drillLevel - 1];

      if (currentDrillFilter === '"SBU_Name"') {
        const updatedCrossFilters = crossFilters.filter(
          (f) => f.key !== '"SBU_Name"'
        );
        const updatedAppliedFilters = appliedFilters.filter(
          (f) => f.key !== '"SBU_Name"'
        );
        updatedCrossFilters.push({
          key: '"cumulative"',
          cond: "equals",
          value: "true",
        });
        setCrossFilters(updatedCrossFilters);
        setAppliedFilters(updatedAppliedFilters);
        setDrillLevel((prev) => prev - 1);
        setDrillHistory((prev) => [...prev.slice(0, -1)]);
        return;
      }

      const updatedCrossFilters = crossFilters.filter(
        (f) => f.key !== currentDrillFilter
      );
      const updatedAppliedFilters = appliedFilters.filter(
        (f) => f.key !== currentDrillFilter
      );
      setCrossFilters(updatedCrossFilters);
      setAppliedFilters(updatedAppliedFilters);
      setDrillLevel((prev) => prev - 1);
      setDrillHistory((prev) => [...prev.slice(0, -1)]);
    },
    [drillLevel, appliedFilters, crossFilters]
  );

  const resetFilters = useCallback(async () => {
    if (selectedYear === "2024-2025") {
      const newFromDate = dayjs().date(1).month(3).subtract(1, "year");
      const newToDate = dayjs().year(dayjs().year()).month(2).date(31);
      setFromDate(newFromDate);
      setToDate(newToDate);
    } else {
      const newFromDate = firstDayOfMonth;
      const newToDate = yesterday;
      setFromDate(newFromDate);
      setToDate(newToDate);
    }

    const perspectiveKeys =
      selectedYorM === "Y"
        ? ['"A"', '"H"', '"T"', '"C"']
        : ['"A"', '"H"', '"T"'];

    const perspectiveFiltersToKeep = appliedFilters.filter((filter) =>
      perspectiveKeys.includes(filter.key)
    );

    const resetFilter = [
      {
        key: '"YTD"',
        cond: "equals",
        value: "true",
      },
    ];

    setDrillLevel(0);
    setMode("ytd");
    if (selectedYorM === "Y") {
      setDrilldownList(getInitialDrilldownListValues("Y"));
      setAppliedFilters([...resetFilter, ...perspectiveFiltersToKeep]);
    } else {
      setAppliedFilters([...resetFilter, ...perspectiveFiltersToKeep]);
    }
    setCrossFilters([]);
    setDrillHistory([]);
    setFromDate(firstDayOfMonth);
    setToDate(yesterday);
    hierarchyWidthsRef.current = {};
    hasUserResizedRef.current = false;
  }, [mode, appliedFilters, selectedYear, selectedYorM, firstDayOfMonth, yesterday]);

  const handleModeChange = useCallback(
    (newMode: ChartMode) => {
      if (newMode === mode && mode === "ytd") {
        setMode("date");
        setAppliedFilters((prev) =>
          prev.filter((item) => item.key !== '"YTD"')
        );
        return;
      }

      setMode(newMode);
      if (newMode === "ytd") {
        setAppliedFilters((prev) => {
          const filtersWithoutDate = prev.filter(
            (item) => item.key !== '"DATE"'
          );
          return [
            ...filtersWithoutDate,
            { key: '"YTD"', cond: "equals", value: "true" },
          ];
        });
        setMode("ytd");
      }
    },
    [mode]
  );

  useEffect(() => {
    if (mode !== "ytd") {
      if (selectedYear === "2024-2025") {
        const fromdate = dayjs().date(1).month(3).subtract(1, "year");
        const todate = dayjs().date(31).month(2);
        setFromDate(fromdate);
        setToDate(todate);
      } else {
        const fromdate = dayjs().date(1).month(3);
        const todate = dayjs().subtract(1, "day");
        setFromDate(fromdate);
        setToDate(todate);
      }
    } else if (mode === "ytd") {
      if (selectedYear === "2024-2025") {
        const fromdate = dayjs().date(1).month(3).subtract(1, "year");
        const todate = dayjs().date(31).month(2);
        setFromDate(fromdate);
        setToDate(todate);
      } else {
        const fromdate = dayjs().date(1).month(3);
        const todate = dayjs().subtract(1, "day");
        setFromDate(fromdate);
        setToDate(todate);
      }
    }
  }, [mode, selectedYear]);

  const [headingDate, setHeadingDate] = useState("");

  const formatHeadingDate = (from: dayjs.Dayjs, to: dayjs.Dayjs, year: string) => {
    if (year && year.includes("-")) {
      const [startYear, endYear] = year.split("-");
      const currentFiscalYear =
        dayjs().month() >= 3
          ? `${dayjs().year()}-${dayjs().year() + 1}`
          : `${dayjs().year() - 1}-${dayjs().year()}`;

      if (year === currentFiscalYear) {
        return `${from.format("MMMM D")}, ${startYear} to ${to.format(
          "MMMM D"
        )}, ${to.format("YYYY")}`;
      } else {
        return `${from.format("MMMM D")}, ${startYear} to ${to.format(
          "MMMM D"
        )}, ${endYear}`;
      }
    }
    return `${from.format("MMMM D")}, ${from.format("YYYY")} to ${to.format(
      "MMMM D"
    )}, ${to.format("YYYY")}`;
  };

  useEffect(() => {
    if (fromDate && toDate && selectedYear) {
      setHeadingDate(formatHeadingDate(fromDate, toDate, selectedYear));
    }
  }, [selectedYear]);

  const handleDateFilter = () => {
    if (fromDate && toDate) {
      const formattedDates = `${fromDate.format("YYYY-MM-DD")},${toDate.format(
        "YYYY-MM-DD"
      )}`;
      const newPerspectiveFilters = convertToFilters({ ...activeStates });
      const newFilters = [
        ...newPerspectiveFilters,
        { key: '"DATE"', cond: "equals", value: formattedDates },
      ];
      if (selectedYorM === "Y") {
        newFilters.push({ key: '"C"', cond: "equals", value: "true" });
      }
      const filtersWithoutYTD = newFilters.filter(
        (filter) => filter.key !== '"YTD"'
      );
      setAppliedFilters(filtersWithoutYTD);
      setMode("date");
      setDrillHistory([
        `${fromDate.format("MMM-DD")} - ${toDate.format("MMM-DD")}`,
      ]);
      setHeadingDate(formatHeadingDate(fromDate, toDate, selectedYear));
      setIsOpen(false);
    }
  };

  const handleFromDateChange = (newValue: dayjs.Dayjs | null) => {
    if (newValue) {
      setFromDate(newValue);
      validateDateRange(newValue, toDate);
    }
  };

  const handleToDateChange = (newValue: dayjs.Dayjs | null) => {
    if (newValue) {
      setToDate(newValue);
      validateDateRange(fromDate, newValue);
    }
  };

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      if (selectedYear === "2024-2025") {
        const firstDateOfApril = dayjs().year(2024).month(3).date(1);
        const lastDateOfMarch = dayjs().year(2025).month(2).date(31);
        setFromDate(firstDateOfApril);
        setToDate(lastDateOfMarch);
      } else {
        const firstDateOfApril = dayjs().year(2025).month(3).date(1);
        const yesterdayDate = dayjs().subtract(1, "day");
        setFromDate(firstDateOfApril);
        setToDate(yesterdayDate);
      }
    }
    setIsOpen(open);
  };

  const resetDate = () => {
    let fromdate, todate;

    if (selectedYear === "2024-2025") {
      fromdate = dayjs().year(2024).month(3).date(1);
      todate = dayjs().year(2025).month(2).date(31);
    } else {
      fromdate = dayjs().year(2025).month(3).date(1);
      todate = dayjs().subtract(1, "day");
    }

    setFromDate(fromdate);
    setToDate(todate);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleYearChange = (value: string) => {
    const formattedYear = `FY ${value}`;
    setSelectedYear(value);
    let fromdate;
    let todate;

    if (value === "2024-2025") {
      fromdate = dayjs().date(1).month(3).subtract(1, "year");
      todate = dayjs().year(dayjs().year()).month(2).date(31);
    } else {
      fromdate = dayjs().date(1).month(3);
      todate = dayjs().add(0, "year").subtract(1, "day");
    }

    setFromDate(fromdate);
    setToDate(todate);
    setHeadingDate(formatHeadingDate(fromdate, todate, value));

    setAppliedFilters((prev) => {
      const filtered = prev.filter((f) => f.key !== '"fiscal_year"');
      return [
        ...filtered,
        { key: '"fiscal_year"', cond: "equals", value: value },
      ];
    });
    setDrillHistory((prev) => [formattedYear, ...prev.slice(1)]);
  };

  const isDisabled = mode === "ytd";

  const onGridReady = useCallback((params: GridReadyEvent) => {
    // Always fit columns to fill the available width
    params.api.sizeColumnsToFit();
  }, []);

  const colDefs = useMemo(() => {
    // Fixed columns: SBU Name (starting from SBU level, no cumulative column)
    // Using flex for dynamic width based on screen size
    const fixedCols: ColDef[] = [
      {
        colId: "sbuName",
        headerName: "SBU Name",
        flex: 2, // Takes 2x the space of other columns
        minWidth: 150,
        resizable: true,
        suppressMovable: true,
        lockPosition: true,
        pinned: "left",
        valueGetter: (params) => {
          const row = params.data as TableDataType;
          if (!row) return "";
          return row.name || "";
        },
        cellRenderer: SbuNameRenderer,
        cellStyle: {
          display: "flex",
          alignItems: "center",
          padding: "0px",
          overflow: "hidden",
        },
        headerClass: "font-medium bg-gray-50",
      },
    ];

    // All metric columns use flex for dynamic sizing
    const metricColumns = metricCols.map((col) => {
      const originalCellStyle = col.cellStyle;
      return {
        ...col,
        flex: 1, // All metric columns have equal flex
        minWidth: 90, // Minimum width to ensure readability
        resizable: true,
        suppressMovable: true,
        lockPosition: true,
        suppressSizeToFit: false,
        cellStyle: (params: any) => {
          const baseStyle = typeof originalCellStyle === "function" 
            ? originalCellStyle(params) 
            : originalCellStyle || {};
          return {
            ...baseStyle,
            overflow: "hidden",
          };
        },
      };
    });

    return [...fixedCols, ...metricColumns];
  }, [tableData]);

  const { onToggle } = useTableRowToggle({
    selectedYorM,
    mode,
    selectedYear,
    appliedFilters,
    setTableData,
  });


  const ExpandedChart = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={toggleExpand}
      />
      <div className="relative w-[95vw] h-[90vh] bg-white rounded-lg shadow-xl p-4 z-50">
        <div className="absolute right-2 top-4">
          <div className="flex gap-3">
            <TooltipProvider>
              <div className="flex items-center gap-1">
                <Button
                  onClick={toggleExpand}
                  className="text-white text-xs font-bold p-1 w-7 h-7 rounded-sm shadow bg-blue-500 flex items-center justify-center hover:bg-blue-500"
                >
                  <IconMinimize stroke={1.5} />
                </Button>
              </div>
            </TooltipProvider>
          </div>
        </div>
        <div className="h-full flex flex-col">
          <div className="mb-4">
            <span className="text-xl font-bold">
              Sales Performance (Drill-Down) - {selectedYear}
            </span>
          </div>
          <div className="flex-1">
            <div className="ag-theme-quartz h-full w-full">
              <AgGridReact
                rowData={tableData}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                ref={tableRef}
                getRowId={(params) => params.data.id}
                getRowStyle={getRowStyleByLevel}
                domLayout="normal"
                rowHeight={40}
                headerHeight={48}
                suppressHorizontalScroll={false}
                alwaysShowHorizontalScroll={true}
                suppressScrollOnNewData={true}
                suppressColumnVirtualisation={false}
                suppressColumnMoveAnimation={false}
                suppressDragLeaveHidesColumns={true}
                maintainColumnOrder={true}
                animateRows={true}
                ensureDomOrder={true}
                reactiveCustomComponents={true}
                rowBuffer={20}
                suppressCellFocus={true}
                enableCellTextSelection={true}
                context={{ onToggle }}
                onGridReady={onGridReady}
                onColumnResized={onColumnResized}
                noRowsOverlayComponent={() => (
                  <div className="p-8 text-center text-gray-500">
                    No data available for the selected filters.
                  </div>
                )}
                loadingOverlayComponent={LoadingOverlay}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Card className="w-full bg-transparent rounded-lg border border-gray-200 pt-2 px-2 relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-lg">
            <div className="flex flex-col items-center gap-2">
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
          </div>
        )}
        <div className="mt-1 mb-2">
          <CardHeader className="p-1">
            <div className="flex flex-col gap-2">
              <div className="flex gap-4 justify-between items-start">
                <span className="flex items-center text-sm font-extrabold">
                  Sales Performance (Drill-Down) - {selectedYear}
                  <span className="p-1 rounded-md text-xs text-blue-900 ml-2">
                    {headingDate}
                  </span>
                </span>
                <TooltipProvider>
                  <div className="flex gap-1">
                    <ToggleGroup
                      type="single"
                      value={selectedYorM}
                      onValueChange={(val: "Y" | "M") => {
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
                      className="inline-flex rounded-md bg-background border border-input shadow-sm"
                    >
                      <ToggleGroupItem
                        value="Y"
                        disabled={
                          crossFilters.length > 0 && selectedYorM !== "Y"
                        }
                        className="h-7 px-3 py-1.5 text-xs font-medium rounded-l-md data-[state=on]:bg-teal-600 data-[state=on]:text-white data-[state=off]:text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-1 transition-colors duration-150"
                      >
                        Year
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="M"
                        disabled={
                          crossFilters.length > 0 && selectedYorM !== "M"
                        }
                        className="h-7 px-3 py-1.5 text-xs font-medium rounded-r-md data-[state=on]:bg-teal-600 data-[state=on]:text-white data-[state=off]:text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-1 transition-colors duration-150"
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
                            className={`border text-xs p-1 w-8 h-8 flex items-center justify-center ${
                              activeStates[key as keyof ActiveStates]
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
                    {Object.keys(tButtonsData).map((key) => (
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
                    <Button
                      variant={mode === "ytd" ? "outline" : "default"}
                      onClick={() => handleModeChange("ytd")}
                      className={`border w-9 h-8 p-0 text-xs ${
                        mode === "ytd"
                          ? "bg-teal-600 text-white hover:bg-teal-600 hover:text-white"
                          : "bg-white text-black hover:bg-white hover:text-black"
                      }`}
                    >
                      YTD
                    </Button>
                    <div className="flex gap-1">
                      <Popover
                        open={isOpen}
                        onOpenChange={handlePopoverOpenChange}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <Button
                                className={`border w-8 h-8 p-0 text-xs ${
                                  isDisabled
                                    ? "bg-white text-black cursor-not-allowed opacity-70"
                                    : mode === "date"
                                    ? "bg-teal-600 text-white"
                                    : "bg-white text-black"
                                }`}
                                disabled={isDisabled}
                              >
                                <Calendar strokeWidth={1} className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="text-sm px-2 py-1"
                          >
                            {isDisabled
                              ? "Deselect YTD to use date filter"
                              : "Open date picker"}
                          </TooltipContent>
                        </Tooltip>
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
                                  maxDate={dayjs().add(1, "year")}
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
                    <div className="flex items-center mx-1">
                      <Select
                        value={selectedYear}
                        onValueChange={handleYearChange}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs font-semibold border-[1.5px]">
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
            </div>
          </CardHeader>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-2 px-2 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <div className="text-[10px] text-blue-600 font-medium mb-1">Cumulative Actual Sales</div>
              <div className="text-lg font-bold text-blue-800">
                {summaryData.totalActual.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-[9px] text-blue-500 mt-0.5">{salesUnit}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <div className="text-[10px] text-amber-600 font-medium mb-1">Cumulative Target Sales</div>
              <div className="text-lg font-bold text-amber-800">
                {summaryData.totalTarget.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-[9px] text-amber-500 mt-0.5">{salesUnit}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-2">
              <div className="text-[10px] text-green-600 font-medium mb-1">Cumulative History Sales</div>
              <div className="text-lg font-bold text-green-800">
                {summaryData.totalHistory.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-[9px] text-green-500 mt-0.5">{salesUnit}</div>
            </div>
            <div className={`border rounded-lg p-2 ${
              summaryData.totalHistory > 0 
                ? ((summaryData.totalActual - summaryData.totalHistory) / summaryData.totalHistory * 100) >= 0 
                  ? "bg-emerald-50 border-emerald-200" 
                  : "bg-red-50 border-red-200"
                : "bg-gray-50 border-gray-200"
            }`}>
              <div className={`text-[10px] font-medium mb-1 ${
                summaryData.totalHistory > 0 
                  ? ((summaryData.totalActual - summaryData.totalHistory) / summaryData.totalHistory * 100) >= 0 
                    ? "text-emerald-600" 
                    : "text-red-600"
                  : "text-gray-600"
              }`}>Cumulative Act vs His %</div>
              <div className={`text-lg font-bold ${
                summaryData.totalHistory > 0 
                  ? ((summaryData.totalActual - summaryData.totalHistory) / summaryData.totalHistory * 100) >= 0 
                    ? "text-emerald-800" 
                    : "text-red-800"
                  : "text-gray-800"
              }`}>
                {summaryData.totalHistory > 0 
                  ? `${((summaryData.totalActual - summaryData.totalHistory) / summaryData.totalHistory * 100).toFixed(2)}%`
                  : "N/A"
                }
              </div>
              <div className={`text-[9px] mt-0.5 ${
                summaryData.totalHistory > 0 
                  ? ((summaryData.totalActual - summaryData.totalHistory) / summaryData.totalHistory * 100) >= 0 
                    ? "text-emerald-500" 
                    : "text-red-500"
                  : "text-gray-500"
              }`}>Growth %</div>
            </div>
            <div className={`border rounded-lg p-2 ${
              summaryData.totalTarget > 0 
                ? ((summaryData.totalActual - summaryData.totalTarget) / summaryData.totalTarget * 100) >= 0 
                  ? "bg-emerald-50 border-emerald-200" 
                  : "bg-red-50 border-red-200"
                : "bg-gray-50 border-gray-200"
            }`}>
              <div className={`text-[10px] font-medium mb-1 ${
                summaryData.totalTarget > 0 
                  ? ((summaryData.totalActual - summaryData.totalTarget) / summaryData.totalTarget * 100) >= 0 
                    ? "text-emerald-600" 
                    : "text-red-600"
                  : "text-gray-600"
              }`}>Cumulative Act vs Tgt %</div>
              <div className={`text-lg font-bold ${
                summaryData.totalTarget > 0 
                  ? ((summaryData.totalActual - summaryData.totalTarget) / summaryData.totalTarget * 100) >= 0 
                    ? "text-emerald-800" 
                    : "text-red-800"
                  : "text-gray-800"
              }`}>
                {summaryData.totalTarget > 0 
                  ? `${((summaryData.totalActual - summaryData.totalTarget) / summaryData.totalTarget * 100).toFixed(2)}%`
                  : "N/A"
                }
              </div>
              <div className={`text-[9px] mt-0.5 ${
                summaryData.totalTarget > 0 
                  ? ((summaryData.totalActual - summaryData.totalTarget) / summaryData.totalTarget * 100) >= 0 
                    ? "text-emerald-500" 
                    : "text-red-500"
                  : "text-gray-500"
              }`}>Achievement %</div>
            </div>
          </div>
          
          <div className="w-full flex justify-center mb-0"></div>
          <CardContent className="px-2 py-0">
            <div className="w-full h-[365px]">
              <div
                className="ag-theme-quartz h-full w-full"
                style={{ overflow: "hidden" }}
              >
                <AgGridReact
                  rowData={tableData}
                  columnDefs={colDefs}
                  defaultColDef={defaultColDef}
                  ref={tableRef}
                  enableCellTextSelection={true}
                  context={{ onToggle }}
                  animateRows={true}
                  rowHeight={22}
                  headerHeight={32}
                  suppressCellFocus={true}
                  reactiveCustomComponents={true}
                  domLayout="normal"
                  rowBuffer={20}
                  suppressDragLeaveHidesColumns={true}
                  maintainColumnOrder={true}
                  ensureDomOrder={true}
                  suppressScrollOnNewData={true}
                  getRowId={(params) => params.data.id}
                  getRowStyle={getRowStyleByLevel}
                  noRowsOverlayComponent={() => (
                    <div className="p-8 text-center text-gray-500">
                      No data available for the selected filters.
                    </div>
                  )}
                  suppressColumnVirtualisation={false}
                  loadingOverlayComponent={LoadingOverlay}
                  alwaysShowHorizontalScroll={true}
                  suppressHorizontalScroll={false}
                  onColumnResized={onColumnResized}
                  onGridReady={onGridReady}
                />
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
      {isExpanded && <ExpandedChart />}
    </>
  );
};

export default SalesMarketingPivotTable;
