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
import { FilterDropdown } from "../FilterDropdown";
import { BRIGHT_COLORS, formatNumberByDrillLevel } from "./useformatnumberdrilldown";
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
    PMUY: number;
    NPMUY: number;

  
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
interface SalesComparisonChartProps {
  globalActiveFilters: Array<{
    key: string;
    cond: string;
    value: string;
  }>;
  globalCrossFilters: Array<{
    key: string;
    cond: string;
    value: string;
  }>;
}
const filterOptions: FilterOption[] = [
  // { key: "Month", label: "Month" },
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" },
  // { key: "CylType", label: "Cylinder Type" },
  // { key: "ConsumerType", label: "Consumer Type" },

];
const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = [ "Month", "Zone", "Region", "Area", "Distributor"];

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

// const DayWiseTrendButton = ({ isActive, onClick }: { isActive: boolean; onClick: () => void }) => (
//   <Button
//     onClick={onClick}
//     className={`text-xs h-8 ${
//       isActive
//         ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
//         : "bg-white text-gray-700 border border-gray-300"
//     } hover:from-blue-600 hover:to-purple-600`}
//   >
//     Quarter-wise
//   </Button>
// )



const Subsidycentral_transaction =({ globalActiveFilters, globalCrossFilters }: SalesComparisonChartProps) => {
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
      })

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
      "Month",
      "ZOName",
      "ROName",
      "SAName",
      "DistributorName",
    ];
    return fields[level] || fields[0];
  };

  const fetchChartData = async () => {
    let pmuyTotal = 0;
    let npmuyTotal = 0;
    try {
      setIsTransitioning(true);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters,
        cross_filters: globalCrossFilters,
        action: "lpg_cdcms_subsidy_central_transaction",
        drill_state: "",
      });
  
      const data = response.data;
      if (data.status) {
        const transformedData = Array.isArray(data.data)
          ? data.data.map((item: SalesComparisonDataItem) => {
              // Calculate totals
              if (item.PMUY) {
                pmuyTotal += parseFloat(item.PMUY.toString());
              }
              if (item.NPMUY) {
                npmuyTotal += parseFloat(item.NPMUY.toString());
              }
              return {
                ...item,
                name: item[getDrillLevelField(drillLevel)] || "Unknown",
              };
            })
          : [];
        setChartData(transformedData);
        setTotalSales({ current: pmuyTotal, previous: npmuyTotal });
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
  }, [filters, crossFilters, drillLevel,globalCrossFilters,globalActiveFilters]);

  useEffect(() => {
    if (!chartData.length || isLoading || !chartDivRef.current) return

    if (rootRef.current) {
      rootRef.current.dispose()
    }

    const root = am5.Root.new(chartDivRef.current)
    rootRef.current = root

    root.setThemes([am5themes_Animated.new(root)])

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 10,
      }),
    )

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {}),
        numberFormat: "#,###",
        min: 0,
        // Calculate and set the max value
        max: function() {
          // Find the maximum x-value in your data
          let maxValue = 0;
          chartData.forEach(item => {
            maxValue = Math.max(maxValue, item.PMUY || 0, item.NPMUY || 0);
          });
          // Add an additional range (e.g., 10% more)
          return maxValue * 1.1;
        }(),
      }),
    );

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "name",
        renderer: am5xy.AxisRendererY.new(root, {
          minGridDistance: 30,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
      }),
    )

    // Fix for y-axis not displaying all values
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 8,
      oversizedBehavior: "truncate",
      maxWidth: 120,
      textAlign: "left"
    })

    // Ensure all categories are displayed
    yAxis.get("renderer").grid.template.setAll({
      location: 0
    })

    xAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      paddingBottom: 5,
      fontSize: 8,
      maxWidth: 80,
      oversizedBehavior: "truncate",
      textAlign: "center",
    })

    const getXAxisLabel = () => {
      const levels = [
        "Consumers(lakhs)",
        "Consumers(lakhs)",
        "Consumers(k)",
        "Consumers(k)",
        "Consumers(k)",
        "Consumers(k)",
      ];
      return levels[drillLevel] || "Locations";
    };

    xAxis.children.push(
      am5.Label.new(root, {
        text: getXAxisLabel(),
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 8,
      })
    );
    const getYAxisLabel = () => {
      const levels = ["Month", "Zone", "Region", "Sales Area", "Distributor"];
      return levels[drillLevel] || "Distributor";
    };
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: getYAxisLabel(),
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 8,
        paddingBottom: 0,
      }),
    )

    const pmuySeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "PMUY",
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "PMUY",
        categoryYField: "name",
        tooltip: am5.Tooltip.new(root, {
          labelText: "[fontSize: 8px bold]{categoryY}[/],[fontSize: 8px bold]PMUY: [fontSize: 8px bold]{valueX}[/]",
        }),
      }),
    )

    const npmuySeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "NPMUY",
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "NPMUY",
        categoryYField: "name",
        tooltip: am5.Tooltip.new(root, {
          labelText: "[fontSize: 8px bold]{categoryY}[/],[fontSize: 8px bold]NPMUY: [fontSize: 8px bold]{valueX}[/]",
        }),
      }),
    )

    // Configure series
    ;
    [pmuySeries, npmuySeries].forEach((series, index) => {
      series.columns.template.setAll({
        strokeOpacity: 0,
        cornerRadiusBR: 5,
        cornerRadiusTR: 5,
        fill: BRIGHT_COLORS[index % BRIGHT_COLORS.length],
        width: am5.percent(100),
        height: am5.percent(80),
      })
      
      // Fix for the bullet labels
      series.bullets.push(function() {
        const label = am5.Label.new(root, {
          centerY: am5.p50,
          centerX: 1,
          paddingRight: 5,
          fontSize: 10
        });
        
        // Add adapter for the text
        label.adapters.add("text", function (text, target) {
          const dataItem = target.dataItem as any; // Type assertion
          if (dataItem) {
            const value = dataItem.get("valueX" as keyof typeof dataItem);
            return formatNumberByDrillLevel(value, drillLevel);
          }
          return text;
        });
        
        return am5.Bullet.new(root, {
          locationX: 1,
          sprite: label
        });
      });

      // Add click event for drill-down
      if (drillLevel < 4) {
        series.columns.template.events.on("click", (ev) => {
          const dataItem = ev.target.dataItem?.dataContext as SalesComparisonDataItem
          if (dataItem) {
            const newFilter = {
              key: `"${getDrillLevelField(drillLevel)}"`,
              cond: "equals",
              value: dataItem.name,
            }
            setFilters((prev) => [...prev, newFilter])
            setDrillLevel((prev) => prev + 1)
            setDrillHistory((prev) => [...prev, dataItem.name])
          }
        })
      }
    })

    const scrollbarY = am5.Scrollbar.new(root, {
      orientation: "vertical",
      marginRight: 30,
      minWidth: 10,
      start: 0,
      end: chartData.length <= 12 ? 1 : 12 / chartData.length,
    })
    chart.set("scrollbarY", scrollbarY)
    chart.rightAxesContainer.children.push(scrollbarY)

    scrollbarY.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    })

    chart.set("scrollbarY", scrollbarY)
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
    // Set data
    const reversedChartData = [...chartData].reverse();

    // Set the reversed data
    yAxis.data.setAll(reversedChartData);
    pmuySeries.data.setAll(reversedChartData);
    npmuySeries.data.setAll(reversedChartData);
        root._logo?.dispose()

  const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        marginTop: -20,
        marginBottom: 10,
      })
    );
    
    legend.labels.template.setAll({
      fontSize: 10,
      fontWeight: "400",
      text: "{categoryY}", // Change from "{name}" to "{categoryY}"
    });
    
    // Set the data source for the legend (the chart series)
    legend.data.setAll(chart.series.values);
    
    // You can disable the value labels in the legend by hiding them
    legend.valueLabels.template.set("visible", false);
    
    // Modify the legend marker size if needed
    legend.markers.template.setAll({
      width: 16,
      height: 16
    });
    
    return () => {
      root.dispose()
    }
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
  // Format totals based on drill level
  const formatTotal = (value) => {
    return formatNumberByDrillLevel(value, drillLevel);
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
            <div className="flex items-center gap-4" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div className="flex items-center gap-4">
                <CardTitle className="text-xs font-bold text-gray-800 whitespace-nowrap">
                ⁠Central Subsidy Transactions Count
                </CardTitle>
                <DrillStateIndicator drillLevel={drillLevel} />
              </div>

              {/* <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1 flex-grow">
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
              </div> */}

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
          <span className="text-black-600">
              Total PMUY: 
              <span className="text-blue-600 ml-1">
                {formatTotal(totalSales.current)}
              </span>
            </span>
            <span className="text-black-600">
              Total NPMUY:
              <span className="text-blue-600 ml-1">
                {formatTotal(totalSales.previous)}
              </span>
            </span>
</div>
        </CardHeader>

        <CardContent
          className={`p-0 pb-0 relative ${
            isExpanded ? "h-[calc(100vh-8rem)]" : "h-[500px]"
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
              height: isExpanded ? "calc(100vh - 8rem)" : "490px",
            }}
          />
        </CardContent>
      </Card>
    </>
  );
};

export default Subsidycentral_transaction;
