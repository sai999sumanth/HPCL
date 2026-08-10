import React, { useEffect, useRef, useState } from "react";
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
import { ArrowLeft, RotateCcw, Loader2, ChevronsUpDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { cn } from "@/@/lib/utils";
import { Check } from "lucide-react";
import { ScrollArea } from "@/@/components/ui/scroll-area";
import { FilterDropdown } from "../FilterDropdown";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";

interface ChartDataItem {
  zone: string;
  value: number;
  drillDown: boolean;
}

interface ApiResponse {
  status: boolean;
  message: string;
  data:
    | {
        ZOName: { [key: string]: string };
        Total_Consumers: { [key: string]: number };
      }
    | Array<{
        ZOName: string;
        ROName: string;
        SAName: string;
        DistributorName: string;
        Total_Consumers: number;
      }>;
}

interface DrilldownState {
  level: "zone" | "region" | "salesarea" | "distributor";
  filters: Array<{
    key: string;
    cond: string;
    value: string;
  }>;
}

interface FilterOption {
  key: string;
  label: string;
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

const DrillStateIndicator = ({ level }: { level: string }) => {
  const states = ["Zone", "Region", "SalesArea", "Distributor"];
  const displayLevel =
    level === "salesarea"
      ? "SalesArea"
      : level.charAt(0).toUpperCase() + level.slice(1);
  const currentIndex = states.indexOf(displayLevel);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[currentIndex]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${
              index === currentIndex ? "bg-blue-600" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const TotalConsumer = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    level: "zone",
    filters: [],
  });
  const [drillHistory, setDrillHistory] = useState<string[]>([]);
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
  const chartRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [totalConsumers, setTotalConsumers] = useState<number>(0);

  const transformData = (apiResponse: ApiResponse): ChartDataItem[] => {
    let grandTotal = 0;
    if (!apiResponse.status || !apiResponse.data) {
      return [];
    }

    if (drilldownState.level === "zone" && !Array.isArray(apiResponse.data)) {
      Object.values(apiResponse.data.Total_Consumers || {}).forEach((value) => {
        grandTotal += parseFloat(value.toString() || "0");
      });
      setTotalSales(grandTotal);

      // Handle month level data
      const monthData = apiResponse.data;
      return Object.keys(monthData.ZOName).map((key) => ({
        zone: monthData.ZOName[key],
        value: monthData["Total_Consumers"][key],
        drillDown: true,
      }));
    }

    if (Array.isArray(apiResponse.data)) {
      // Handle drilled down data
      const groupedData: { [key: string]: number } = {};
      const fieldMap = {
        zone: "ZOName",
        region: "ROName",
        salesarea: "SAName",
        distributor: "DistributorName",
      };

      const field = fieldMap[drilldownState.level];

      apiResponse.data.forEach((item) => {
        const key = field ? item[field] : item.ZOName;
        if (!groupedData[key]) {
          groupedData[key] = 0;
        }
        const value = parseFloat(item.Total_Consumers?.toString() || "0");
        groupedData[key] += value;
        grandTotal += value;
        setTotalSales(grandTotal); // Add to grand total
      });

      return Object.entries(groupedData).map(([key, value]) => ({
        zone: key,
        value,
        drillDown: drilldownState.level !== "distributor",
      }));
    }

    return [];
  };

  const fetchFilterOptions = async (filtersForDropdown = []) => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [...drilldownState.filters, ...filtersForDropdown],
        action: "cdcms_dropdown",
        drill_state: drilldownState.level,
      });

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = response.data;
      if (result) {
        // Store the current selections before updating
        const currentSelections = { ...selectedFilters };

        // Update filter data with new options
        setFilterData(result);

        // Create new selectedFilters object
        const newSelectedFilters = { ...currentSelections };

        // For each filter key, check if the current selection is still valid
        Object.keys(result).forEach((key) => {
          const currentValue = currentSelections[key];
          if (currentValue && !result[key].includes(currentValue)) {
            // If current selection is no longer valid, reset it
            newSelectedFilters[key] = "";
          }
          // If current selection is still valid, keep it
        });

        // Update selected filters with validated selections
        setSelectedFilters(newSelectedFilters);

        // Update active filters based on validated selections
        const newActiveFilters = Object.entries(newSelectedFilters)
          .filter(([_, val]) => val && val !== "placeholder")
          .map(([k, v]) => ({
            key: `"${k}"`,
            cond: "equals",
            value: v,
          }));
        setActiveFilters(newActiveFilters);
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

  const fetchData = async () => {
    try {
      setIsTransitioning(true);
      setIsLoading(true); // Ensure loading state is set

      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: drilldownState.filters,
          cross_filters: activeFilters.filter(
            (f) => f.value && f.value !== "placeholder"
          ),
          action: "lpg_cdcms_total_consumers",
          drill_state: drilldownState.level,
        });

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = response.data;

      if (result.status) {
        const transformedData = transformData(result);

        // Check if data is empty
        if (!transformedData || transformedData.length === 0) {
          setError("No data available");
          setChartData([]);
        } else {
          setChartData(transformedData);
          setError(null);
        }
      } else {
        setError(result.message || "Failed to fetch data");
        setChartData([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
      setChartData([]); // Clear chart data on error
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };
  const handleFilterChange = async (key: string, value: string) => {
    if (!value) return; // Don't process empty selections

    setIsLoadingFilters(true);
    try {
      // Update selected filters
      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: value,
      };
      setSelectedFilters(updatedSelectedFilters);

      // Create new filter
      const newFilter = {
        key: `"${key}"`,
        cond: "equals",
        value: value,
      };

      // Update active filters array
      let updatedFilters = [...activeFilters];
      const existingFilterIndex = updatedFilters.findIndex(
        (f) => f.key === `"${key}"`
      );

      if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }

      setActiveFilters(updatedFilters);

      // First, update dropdown options with the new filter
      const dropdownResponse = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [...drilldownState.filters, ...updatedFilters],
        action: "cdcms_dropdown",
        drill_state: drilldownState.level,
      });

      const dropdownResult = dropdownResponse.data;
      if (dropdownResult) {
        setFilterData(dropdownResult);
      }

      // Chart data will be fetched by the useEffect hook that depends on activeFilters
    } catch (error) {
      console.error("Error updating filters:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update filters"
      );
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Update the resetFilters function to also refresh dropdowns:
  const resetFilters = async () => {
    try {
      setIsLoadingFilters(true);

      // Reset all filter selections
      const resetFilterValues = Object.keys(selectedFilters).reduce(
        (acc, key) => {
          acc[key] = "";
          return acc;
        },
        {} as Record<string, string>
      );

      setSelectedFilters(resetFilterValues);
      setActiveFilters([]);

      // Reset drill state
      setDrilldownState({
        level: "zone",
        filters: [],
      });
      setDrillHistory([]);

      // Reset dropdown options
      const dropdownResponse = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [],
        action: "cdcms_dropdown",
        drill_state: "zone",
      });

      const dropdownResult = dropdownResponse.data;
      if (dropdownResult) {
        setFilterData(dropdownResult);
      }

      // Chart data will be fetched by the useEffect hook
    } catch (error) {
      console.error("Error resetting filters:", error);
      setError(
        error instanceof Error ? error.message : "Failed to reset filters"
      );
    } finally {
      setIsLoadingFilters(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [drilldownState, activeFilters]);

  const handleDrillDown = async (dataItem: ChartDataItem) => {
    if (!dataItem?.drillDown) return;

    const drillLevels: Record<string, DrilldownState["level"]> = {
      zone: "region",
      region: "salesarea",
      salesarea: "distributor",
    };

    const filterKeyMap: Record<string, string> = {
      zone: "ZOName",
      region: "ROName",
      salesarea: "SAName",
      distributor: "DistributorName",
    };

    const nextLevel = drillLevels[drilldownState.level];
    if (!nextLevel) return;

    const newFilters = [...drilldownState.filters];
    newFilters.push({
      key: `"${filterKeyMap[drilldownState.level]}"`,
      cond: "equals",
      value: dataItem.zone,
    });

    // Update drill state - this will trigger the useEffect above
    setDrilldownState({
      level: nextLevel,
      filters: newFilters,
    });
    setDrillHistory((prev) => [...prev, dataItem.zone]);

    // Fetch new dropdown options with updated drill filters only
    await fetchFilterOptions();
  };
  const handleBackClick = async () => {
    if (drilldownState.filters.length > 0) {
      const newFilters = [...drilldownState.filters];
      newFilters.pop();

      const levels: DrilldownState["level"][] = [
        "zone",
        "region",
        "salesarea",
        "distributor",
      ];
      const newLevel = levels[newFilters.length] || "zone";

      // Update drill state
      setDrilldownState({
        level: newLevel,
        filters: newFilters,
      });
      setDrillHistory((prev) => prev.slice(0, -1));

      // Fetch new dropdown options with updated drill filters and current active filters
      await fetchFilterOptions([...newFilters, ...activeFilters]);
    }
  };

  useEffect(() => {
    fetchFilterOptions([...drilldownState.filters]);
  }, []);

  // Chart creation effect
  // In the useEffect for chart creation, replace the chart creation code with this:

  useEffect(() => {
    if (!chartData.length || isLoading || !chartDivRef.current) return;

    if (chartRef.current) {
      chartRef.current.dispose();
    }

    const root = am5.Root.new(chartDivRef.current);
    chartRef.current = root;

    root.setThemes([am5themes_Animated.new(root)]);

    let chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        pinchZoomX: true,
        paddingBottom: 40,
      })
    );

    root._logo?.dispose();


    const getXAxisLabel = () => {
      const labelMap = {
        zone: "Zone",
        region: "Region",
        salesarea: "Sales Area",
        distributor: "Distributor Name",
      };
      return labelMap[drilldownState.level] || "Time Period";
    };

    // Calculate maximum value for y-axis
    const maxValue = Math.max(...chartData.map((item) => item.value));
    const yAxisMax = Math.ceil(maxValue * 1.2);
    let xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "zone",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );
    // Add X-axis title with dynamic label
    xAxis.children.push(
      am5.Label.new(root, {
        text: getXAxisLabel(),
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
      })
    );

    let yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0.5,
        min: 0,
        max: yAxisMax,
        renderer: am5xy.AxisRendererY.new(root, {
          pan: "zoom",
        }),
      })
    );

    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Total Consumers",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0,
      })
    );

    xAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    let series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Sales",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "zone",
        tooltip: am5.Tooltip.new(root, {
          labelText:
            "[bold fontSize: 8px]{categoryX}[/]\n[fontSize: 8px]Total Consumers: [fontSize: 8px bold]{valueY}[/]",
          getFillFromSprite: true,
          pointerOrientation: "vertical",
          centerX: am5.percent(50),
          centerY: am5.percent(0),
          animationDuration: 200,
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 15,
          paddingRight: 15,
        }),
      })
    );

    // Add value labels on top of columns
    series.bullets.push(function () {
      return am5.Bullet.new(root, {
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: "{valueY}",
          centerX: am5.p50,
          centerY: 0,
          populateText: true,
          fontSize: 10,
          fontWeight: "400",
          dy: -25,
        }),
      });
    });

    // Add click handler for drill-down
    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem?.dataContext as ChartDataItem;
      handleDrillDown(dataItem);
    });

    // Set custom colors for columns
    series.columns.template.adapters.add("fill", (fill, target) => {
      const colors = [
        am5.color(0x5e74e9),
        am5.color(0x282f64),
        am5.color(0x5b3474),
        am5.color(0x8a3679),
        am5.color(0xb63a76),
        am5.color(0xd94769),
        am5.color(0xf36355),
        am5.color(0xff863e),
        am5.color(0xffab22),
        am5.color(0xffcf24),
      ];

      const dataContext = target.dataItem?.dataContext as {
        zone: string;
        value: number;
      };
      const index = chartData.findIndex(
        (item) => item.zone === dataContext?.zone
      );
      return colors[index % colors.length];
    });

    // Set custom stroke colors
    series.columns.template.adapters.add("stroke", (stroke, target) => {
      const colors = [
        am5.color(0xd94769),
        am5.color(0x282f64),
        am5.color(0x5b3474),
        am5.color(0x8a3679),
        am5.color(0xb63a76),
        am5.color(0xd94769),
      ];

      const dataContext = target.dataItem?.dataContext as {
        zone: string;
        value: number;
      };
      const index = chartData.findIndex(
        (item) => item.zone === dataContext?.zone
      );
      return colors[index % colors.length];
    });

    // Set column appearance
    series.columns.template.setAll({
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      strokeOpacity: 0,
      cursorOverStyle: "pointer",
      tooltipY: 0,
      width: am5.percent(30),
      tooltipPosition: "pointer",
      interactive: true,
    });

    // Improved tooltip handling
    series.columns.template.events.on("pointerover", function (ev) {
      const column = ev.target;
      column.showTooltip();
      column.set("tooltipX", am5.percent(50));
      column.set("tooltipY", 0);
    });

    series.columns.template.events.on("pointerout", function (ev) {
      const column = ev.target;
      column.hideTooltip();
    });

    // Add hover state
    series.columns.template.states.create("hover", {
      fillOpacity: 0.8,
      strokeOpacity: 0.4,
      stroke: am5.color(0x000000),
      scale: 1.02,
    });

    // Add scrollbar with custom styling
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 8,
      minHeight: 10,
      start: 0,
      end: chartData.length <= 10 ? 1 : 10 / chartData.length,
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

    // // Add legend with improved positioning
    // chart.children.push(am5.Legend.new(root, {
    //   centerX: am5.p50,
    //   x: am5.p50,
    //   marginTop: 15,
    //   marginBottom: 0
    // }));

    // legend.data.setAll([series]);

    // Set data and animate
    xAxis.data.setAll(chartData);
    series.data.setAll(chartData);

    series.appear(1000);
    chart.appear(1000, 100);

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
      }
    };
  }, [chartData, isLoading, drilldownState.level]);

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">
          Loading {drilldownState.level} data...
        </span>
      </div>
    </div>
  );

  if (isLoading && !isTransitioning) {
    return (
      <Card className="w-full h-[400px] bg-white border border-gray-200">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-0 p-1">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-gray-800">
              Total Consumers
            </CardTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

            <div className="flex items-center gap-4">
              <DrillStateIndicator level={drilldownState.level} />
              <div className="flex gap-2">
                {drilldownState.filters.length > 0 && (
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
                  title="Reset All Filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Filter Dropdowns */}

          {/* Active Filters Display */}
          {/* {activeFilters.length > 0 && (
            <div className="text-xs text-gray-600">
              Active Filters: {activeFilters.map(f => `${f.key.replace(/"/g, '')}: ${f.value}`).join(', ')}
            </div>
          )} */}
        </div>
        <div className="text-xs font-semibold text-black-600">
          Total:
          <span className="text-blue-600">
            {
              Number.isInteger(totalSales)
                ? totalSales // Show as integer if it's a whole number
                : totalSales.toFixed(2) // Show with 2 decimals if it's a float
            }
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative h-[290px] pt-0">
        {drillHistory.length > 0 && (
          <div className="text-gray-600 p-1 text-xs">
            Drill Path: {drillHistory.join(" → ")}
          </div>
        )}
        {error ? (
          <NoDataDisplay message={error} />
        ) : (
          <>
            {isTransitioning && <LoadingOverlay />}
            <div
              ref={chartDivRef}
              id="chartdiv"
              style={{ width: "100%", height: "300px" }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TotalConsumer;
