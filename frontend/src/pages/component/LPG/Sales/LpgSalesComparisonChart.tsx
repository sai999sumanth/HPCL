import React, { useEffect, useState, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import {
  ArrowLeft,
  RotateCcw,
  Loader2,
  ChevronsUpDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { setError } from "@/redux/features/askAISlice";
import { FilterDropdown } from "./FilterDropdown";
import { Calendar } from "@/@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/@/lib/utils";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateRangePickerFilter } from "./DareRangePicker";
import { apiClient } from "@/services/apiClient";

interface SalesComparisonDataItem {
  name: string;
  Quarter?: string;
  Month?: string;
  ZOName?: string;
  ROName?: string;
  SAName?: string;
  DistributorName?: string;
  Current_Year: string;
  Previous_Year: string;
  Current_Sales: number;
  Previous_Sale: number;
}

interface LocationFilter {
  key: string;
  cond: string;
  value: string;
}

interface FilterOption {
  key: string;
  label: string;
}

interface DrillState {
  level: string;
  filters: Array<{
    key: string;
    cond: string;
    value: string;
  }>;
}

const CHART_COLORS = {
  Current_Sales: "#01949A", // Green for current year
  Previous_Sale: "#004369", // Blue for previous year
};

const filterOptions: FilterOption[] = [
  // { key: "Month", label: "Month" },
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" },
  { key: "CylType", label: "Cylinder Type" },
  { key: "ConsumerType", label: "Consumer Type" },
];

const filterOptions1: FilterOption[] = [
  { key: "Financial_Year", label: "Financial Year" },
];

const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = ["Quarter", "Month", "Zone", "Region", "Area", "Distributor"];

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillLevel]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${
              index === drillLevel ? "bg-blue-600" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
;


const SalesComparisonChart = () => {
  const [chartData, setChartData] = useState<SalesComparisonDataItem[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [drillHistory, setDrillHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [filters, setFilters] = useState<LocationFilter[]>([]);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [isDayWiseTrend, setIsDayWiseTrend] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [fromDate, setFromDate] = useState();
  const [toDate, setToDate] = useState();
  const [totalSales, setTotalSales] = useState<{ current: number; previous: number }>({ 
    current: 0, 
    previous: 0 
});

  // Filter states
  const [filterData, setFilterData] = useState<Record<string, string[]>>({});
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, string>
  >({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [activeFilters, setActiveFilters] = useState<
    Array<{
      key: string;
      cond: string;
      value: string;
    }>
  >([]);
  const [crossFilters, setCrossFilters] = useState<
    Array<{
      key: string;
      cond: string;
      value: string;
    }>
  >([]);
  const [drillState, setDrillState] = useState<DrillState>({
    level: "Quarter",
    filters: [],
  });

  // Fetch filter options
  const fetchFilterOptions = async (crossFilters = []) => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: crossFilters,
          action: "cdcms_dropdown",
          drill_state: drillState.level,
        });

      if (!response.status)
        throw new Error(`HTTP error! status: ${response.status}`);

      const result = response.data;
      if (result) {
        setFilterData(result);
        const currentSelections = { ...selectedFilters };
        Object.keys(result).forEach((key) => {
          if (
            currentSelections[key] &&
            !result[key].includes(currentSelections[key])
          ) {
            currentSelections[key] = "";
          }
        });
        setSelectedFilters(currentSelections);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to fetch filter options"
      );
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const handleDateChange = (type: 'from' | 'to', newDate: any) => {
    if (type === 'from') {
      setFromDate(newDate);
    } else {
      setToDate(newDate);
    }

    // Only update filters if both dates are selected
    if (newDate && (type === 'from' ? toDate : fromDate)) {
      const start = type === 'from' ? newDate : fromDate;
      const end = type === 'from' ? toDate : newDate;

      // Format dates as YYYY-MM-DD
      const formatDate = (date: any) => {
        return date.format('YYYY-MM-DD');
      };

      // Create date filter
      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(start)},${formatDate(end)}`
      };

      // Update active filters - remove any existing date filter first
      setActiveFilters(prevFilters => {
        const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });

      // Update cross filters similarly
      setCrossFilters(prevFilters => {
        const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });
    }
  };
  const handleFilterChange = async (key: string, value: string) => {
    setIsLoadingFilters(true);
    try {
      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: value,
      };
      setSelectedFilters(updatedSelectedFilters);

      const newFilter = {
        key: `"${key}"`,
        cond: "equals",
        value: value,
      };

      let updatedFilters = [...activeFilters];
      const existingFilterIndex = updatedFilters.findIndex(
        (f) => f.key === `"${key}"`
      );

      if (value === "NULL") {
        updatedFilters = updatedFilters.filter((f) => f.key !== `"${key}"`);
      } else if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }

      setActiveFilters(updatedFilters);
      setCrossFilters(updatedFilters);

      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: updatedFilters,
          action: "cdcms_dropdown",
          drill_state: "",
        });

      const result = response.data;
      setFilterData(result);
    } catch (error) {
      console.error("Error updating filters:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Drill level field mapping
  const getDrillLevelField = (level: number) => {
    const fields = [
      "Quarter",
      "Month",
      "ZOName",
      "ROName",
      "SAName",
      "DistributorName",
    ];
    return fields[level] || fields[0];
  };

  // Fetch chart data
  const fetchChartData = async () => {
    let currentTotal = 0;  // For Current_Sales
    let previousTotal = 0; // For Previous_Sale
    try {
        setIsTransitioning(true);
        const response = await apiClient.post("/api/charts/generate_vis_data", {
                filters,
                cross_filters: crossFilters,
                action: "lpg_cdcms_actual_vs_historic_sales",
                drill_state: "",
            });

        const data = response.data;
        if (data.status) {
            const transformedData = Array.isArray(data.data)
                ? data.data.map((item: SalesComparisonDataItem) => {
                    // Calculate totals
                    if (item.Current_Sales) {
                        currentTotal += parseFloat(item.Current_Sales.toString());
                    }
                    if (item.Previous_Sale) {
                        previousTotal += parseFloat(item.Previous_Sale.toString());
                    }
                    return {
                        ...item,
                        name: item[getDrillLevelField(drillLevel)] || "Unknown",
                    };
                })
                : [];
            setChartData(transformedData);
            setTotalSales({ current: currentTotal, previous: previousTotal });  
        }
    } catch (error) {
        console.error("Failed to fetch chart data:", error);
    } finally {
        setIsLoading(false);
        setIsTransitioning(false);
    }
};
  const resetFilters = async () => {
    setIsLoadingFilters(true);
    try {
      // Reset active filters
      setActiveFilters([]);

      // Reset the selected filter values
      const resetValues = Object.keys(filterData).reduce((acc, key) => {
        acc[key] = filterData[key].includes("NULL") ? "NULL" : "";
        return acc;
      }, {} as Record<string, string>);

      setSelectedFilters(resetValues);
      setCrossFilters([]);
      setFromDate(undefined);
      setToDate(undefined);

      // Fetch initial filter options with no filters
      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: [],
          action: "cdcms_dropdown",
          drill_state: "",
        });

      const result = response.data;
      setFilterData(result);

      // Fetch data with reset filters
      setDrillLevel(0);
      setDrillHistory([]);
      setFilters([]);
    } catch (error) {
      console.error("Error resetting filters:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  }; // Chart rendering logic (similar to previous implementation)
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [filters, crossFilters, drillLevel]);

  useEffect(() => {
    if (!chartData.length || isLoading || !chartDivRef.current) return;

    if (rootRef.current) {
      rootRef.current.dispose();
    }

    const root = am5.Root.new(chartDivRef.current);
    rootRef.current = root;

    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 10,
      })
    );
    root._logo?.dispose();

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60,
          cellStartLocation: 0.2, // Reduced gap
          cellEndLocation: 0.6, // Reduced gap
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const maxValue = Math.max(
      ...chartData.flatMap((item) => [item.Current_Sales, item.Previous_Sale])
    );
    const yAxisMax = Math.ceil(maxValue * 1.2);

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0.5,
        min: 0,
        max: yAxisMax,
        strictMinMax: true,
        renderer: am5xy.AxisRendererY.new(root, {
          pan: "zoom",
        }),
      })
    );

    // X-axis label configurations
    xAxis.get("renderer").labels.template.setAll({
      rotation: 0, // Changed from -45 to 0
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      paddingBottom: 2,
      fontSize: 10, // Increased from 10 to 12
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    yAxis.get("renderer").labels.template.setAll({
      rotation: 0, // Removed rotation
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      paddingBottom: 2,
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    // Y-axis label and title
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Sales (TMT)", // Consider renaming based on your specific data
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0,
      })
    );

    // X-axis drill-down level label
    const getXAxisLabel = () => {
      const levels = [
        "Quarter",
        "Month",
        "Zone",
        "Region",
        "Sales Area",
        "Distributor",
      ];
      return levels[drillLevel] || "Locations";
    };

    xAxis.children.push(
      am5.Label.new(root, {
        text: getXAxisLabel(),
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
      })
    );
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginBottom: 0,
        layout: root.horizontalLayout,
        useDefaultMarker: true,
        clickTarget: "marker", // Enable legend clicking
      })
    );

    // Configure legend labels to be simple and non-interactive
    legend.labels.template.setAll({
      textAlign: "center",
      fill: am5.color(0x000000),
      fontSize: 10,
    });

    // Disable legend marker interactions
    legend.markers.template.setAll({
      width: 16,
      height: 16,
    });

    legend.itemContainers.template.set("focusable", false);
    legend.markerRectangles.template.states.create("hover", {});
    legend.markerRectangles.template.states.create("down", {});

    // Series for Current and Previous Year Sales
    ["Current_Sales", "Previous_Sale"].forEach((metric, index) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name:
            index === 0
              ? chartData[0]?.Current_Year
              : chartData[0]?.Previous_Year,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: metric,
          categoryXField: "name",
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "vertical",
            labelText: `[fontSize: 8px]{name},Sales: {valueY}[/]`, // Smaller font size
          }),
        })
      );

      series.columns.template.setAll({
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        strokeOpacity: 0,
        fillOpacity: 0.8,
        fill: am5.color(CHART_COLORS[metric as keyof typeof CHART_COLORS]),
        tooltipY: 0,
        width: am5.percent(90),
        tooltipText: `[fontSize: 8px]{name},Sales: {valueY}[/]`, // Individual tooltip for each bar
      });
      // series.bullets.push(() => {
      //   return am5.Bullet.new(root, {
      //     locationY: 1,
      //     sprite: am5.Label.new(root, {
      //       text: "{valueY}",
      //       centerX: am5.p50,
      //       centerY: am5.p100,
      //       populateText: true,
      //       fontSize: 12,
      //       fontWeight: "400",
      //       dy: 0, // Adjust this value to position the label above the bar
      //       fill: am5.color(0x000000),
      //       background: am5.RoundedRectangle.new(root, {
      //         fill: am5.color(0xffffff),
      //         fillOpacity: 0.8,
      //       }),
      //     }),
      //   })
      // })

      //   // Add drill-down functionality
      //   if (!isDayWiseTrend) {
      //     series.columns.template.events.on("click", (ev) => {
      //       if (drillLevel >= 5) return
      //       const dataItem = ev.target.dataItem?.dataContext as SalesComparisonDataItem
      //       if (!dataItem) return

      //       const newFilter = {
      //         key: `"${getDrillLevelField(drillLevel)}"`,
      //         cond: "equals",
      //         value: dataItem.name,
      //       }

      //       setFilters((prev) => [...prev, newFilter])
      //       setDrillLevel((prev) => prev + 1)
      //       setDrillHistory((prev) => [...prev, dataItem.name])
      //     })
      //   }

      //   series.data.setAll(chartData)
      // })
      series.columns.template.events.on("click", (ev) => {
        if (drillLevel >= 5) return;

        const dataItem = ev.target.dataItem
          ?.dataContext as SalesComparisonDataItem;
        if (!dataItem) return;

        const newFilter = {
          key: `"${getDrillLevelField(drillLevel)}"`,
          cond: "equals",
          value: dataItem.name,
        };

        setFilters((prev) => [...prev, newFilter]);
        setDrillLevel((prev) => prev + 1);
        setDrillHistory((prev) => [...prev, dataItem.name]);
      });
      series.bullets.push(() => {
        return am5.Bullet.new(root, {
          locationY: 1,
          sprite: am5.Label.new(root, {
            text: "{valueY}",
            centerX: am5.p50,
            centerY: 0,
            populateText: true,
            fontSize: 9,
            fontWeight: "400",
            dy: -20,
          }),
        });
      });

      series.data.setAll(chartData);
    });
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 10,
      minHeight: 10,
      start: 0,
      end: chartData.length <= 7 ? 1 : 7 / chartData.length,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    });

    chart.set("scrollbarX", scrollbarX);
    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      })
    );
    chart.bottomAxesContainer;
    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      })
    );
    chart.bottomAxesContainer;

    xAxis.data.setAll(chartData);

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
      })
    );
    legend.data.setAll(chart.series.values);

    return () => {
      root.dispose();
    };
  }, [chartData, isLoading, isDayWiseTrend]);

  const handleBackClick = () => {
    if (drillLevel > 0) {
      setFilters((prev) => prev.slice(0, -1));
      setDrillLevel((prev) => prev - 1);
      setDrillHistory((prev) => prev.slice(0, -1));
    }
  };

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-xs text-gray-600">
          Loading {getDrillLevelField(drillLevel)} data...
        </span>
      </div>
    </div>
  );
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (isLoading && !isTransitioning) {
    return (
      <Card className="w-full h-[265px] bg-white border border-gray-200">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={toggleExpand}
        />
      )}
      <Card
        className={`transition-all duration-300 ${
          isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
        }`}
      >
        <CardHeader className="pb-0 p-1">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4" style={{display:"flex",justifyContent:"center",alignItems:"center"}}>
              <div className="flex items-center gap-4">
                <CardTitle className="text-xs font-bold text-gray-800 whitespace-nowrap">
                  Actual Vs Historic Sales
                </CardTitle>
                <DrillStateIndicator drillLevel={drillLevel} />
              </div>
              <div className="flex items-center gap-2">
              <DateRangePickerFilter
      fromDate={fromDate}
      toDate={toDate}
      onFromDateChange={(date) => handleDateChange('from', date)}
      onToDateChange={(date) => handleDateChange('to', date)}
      disabled={isLoadingFilters}
    />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1 flex-grow">
                {filterOptions.map(({ key, label }) => (
                  <FilterDropdown
                    key={key}
                    label={label}
                    options={filterData[key] || []}
                    value={selectedFilters[key] || ""}
                    onChange={(value) => handleFilterChange(key, value)}
                    isLoading={isLoadingFilters}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {drillLevel > 0 && (
                  <Button
                    onClick={handleBackClick}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  onClick={resetFilters}
                  disabled={isTransitioning}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  onClick={toggleExpand}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                >
                  {isExpanded ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex gap-4 text-xs font-semibold">
    <span className="text-black-600 mt-1">
        Current Total: 
        <span className="text-blue-600 mt-1">
        {Number.isInteger(totalSales.current) 
  ? totalSales.current // Show as integer if it's a whole number
  : totalSales.current.toFixed(2) // Show with 2 decimals if it's a float
}
     </span>

        
    </span>
     <span className="text-black-600 mt-1">
        Previous Total:
        <span className="text-blue-600">

        {Number.isInteger(totalSales.previous) 
  ? totalSales.previous // Show as integer if it's a whole number
  : totalSales.previous.toFixed(2) // Show with 2 decimals if it's a float
}
        <span/> 
     </span>
    </span>

    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-1 flex-grow">
                {filterOptions1.map(({ key, label }) => (
                  <FilterDropdown
                    key={key}
                    label={label}
                    options={filterData[key] || []}
                    value={selectedFilters[key] || ""}
                    onChange={(value) => handleFilterChange(key, value)}
                    isLoading={isLoadingFilters}
                  />
                ))}
              </div>
</div>

        </CardHeader>

        <CardContent
          className={`p-0 pb-0 relative ${
            isExpanded ? "h-[calc(100vh-8rem)]" : "h-[265px]"
          } pt-0`}
        >
          {drillHistory.length > 0 && (
            <div className="text-gray-600 p-1 text-xs">
              Drill Path: {drillHistory.join(" → ")}
            </div>
          )}
          {isTransitioning && <LoadingOverlay />}
          <div
            ref={chartDivRef}
            id="chartdiv"
            style={{
              width: "100%",
              height: isExpanded ? "calc(100vh - 8rem)" : "250px",
            }}
          />
        </CardContent>
      </Card>
    </>
  );
};

export default SalesComparisonChart;
