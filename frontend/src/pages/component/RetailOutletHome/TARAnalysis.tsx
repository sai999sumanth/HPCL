import React, { useEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import * as am5plugins_exporting from "@amcharts/amcharts5/plugins/exporting";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2 } from "lucide-react";
import { FilterDropdown } from "../LPG/Sales/FilterDropdown";
import { apiClient } from "@/services/apiClient";

interface ChartDataItem {
  label: string;
  value: number;
  drillDown: boolean;
}

interface ApiResponse {
  [key: string]: any;
}

interface DrilldownState {
  level: "zone" | "region" | "salesarea" | "rosapcode" | "";
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

// Updated filter options to match the three levels
const filterOptions: FilterOption[] = [
  { key: "zone", label: "Zone" },
  { key: "region", label: "Region" },
  { key: "salesarea", label: "Sales Area" },
  { key: "rosapcode", label: "Distributor" },
];

const DrillStateIndicator = ({ level }: { level: string }) => {
    // Define the states in order
    const states = ["Zone", "Region", "SalesArea", "Customer"];
    
    // Get the current index based on the level
    let currentIndex;
    if (level === "") {
      currentIndex = 0; // Zone level
    } else if (level === "zone") {
      currentIndex = 1; // Region level
    } else if (level === "region") {
      currentIndex = 2; // SalesArea level
    } else if (level === "salesarea") {
      currentIndex = 3; // Distributor level
    } else {
      // Default to Zone level if unknown
      currentIndex = 0;
    }
  
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
const RetailTAR = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    level: "",
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
  const [totalAmount, setTotalAmount] = useState<number>(0);

  const transformData = (apiResponse: any[]): ChartDataItem[] => {
    let total = 0;
    if (!apiResponse || !Array.isArray(apiResponse) || apiResponse.length === 0) {
      return [];
    }

    // Determine which fields to use based on drilldown level
    let labelField: string;
    switch(drilldownState.level) {
      case "zone":
                labelField = "region";
        break;
      case "region":
        labelField = "salesarea";
        break;
      case "salesarea":
        labelField = "site_name";
        break;
    //   case "rosapcode":
    //     // For the last level, use site_area as requested
    //     labelField = "site_name"; 
    //     break;
      default:
        labelField = "zone";
    }

    // Transform the data
    const transformedData = apiResponse.map(item => {
      // Add to total
      const amount = parseFloat(item.amount?.toString() || "0");
      total += amount;
      
      return {
        label: item[labelField] || item.zone || "",
        value: amount,
        // Only allow drill down if not at the last level (rosapcode)
        drillDown: drilldownState.level !== "rosapcode",
      };
    });

    // Update total
    setTotalAmount(total);
    
    return transformedData;
  };

  const fetchData = async () => {
    try {
      setIsTransitioning(true);
      setIsLoading(true);

      // Prepare cross_filters
      const crossFilters = drilldownState.level ? 
        drilldownState.filters.map(filter => ({
          key: filter.key.replace(/"/g, ''),
          cond: filter.cond,
          value: filter.value
        })) : [];

      // Add active filters
      const allFilters = [
        ...crossFilters,
        ...activeFilters.filter(f => f.value && f.value !== "placeholder")
      ];

      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [],
        action: "retail_tar",
        drill_state: drilldownState.level || "",
        cross_filters: allFilters,
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: ""
      });

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = response.data;

      if (Array.isArray(result)) {
        if (result.length > 0) {
          const transformedData = transformData(result);
          setChartData(transformedData);
          setError(null);
        } else {
          setChartData([]);
          setError("No data available for this level");
        }
      } else {
        setError("Invalid response format");
        setChartData([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
      setChartData([]);
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const handleFilterChange = async (key: string, value: string) => {
    if (!value) return;

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
        key: key,
        cond: "equals",
        value: value,
      };

      // Update active filters array
      let updatedFilters = [...activeFilters];
      const existingFilterIndex = updatedFilters.findIndex(
        (f) => f.key === key
      );

      if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }

      setActiveFilters(updatedFilters);

      // Fetch updated data
      await fetchData();
    } catch (error) {
      console.error("Error updating filters:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update filters"
      );
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const resetFilters = async () => {
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

    try {
      setIsLoading(true);

      // Reset drill state to initial state
      setDrilldownState({
        level: "",
        filters: []
      });
      setDrillHistory([]);

      // Fetch new data
      await fetchData();
    } catch (error) {
      console.error("Error resetting filters:", error);
      setError(
        error instanceof Error ? error.message : "Failed to reset filters"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [drilldownState]);

  const handleDrillDown = async (dataItem: ChartDataItem) => {
    if (!dataItem?.drillDown) return;

    // Define the drill level sequence
    const drillLevels: Record<string, DrilldownState["level"]> = {
      "": "zone",
      zone: "region",
      region: "salesarea",
      salesarea: "rosapcode",
    };

    // Define filter key map for each level
    const filterKeyMap: Record<string, string> = {
      "": "zone",
      zone: "region",
      region: "salesarea",
      salesarea: "rosapcode",
    };

    const currentLevel = drilldownState.level;
    const nextLevel = drillLevels[currentLevel];
    
    if (!nextLevel) return;

    const newFilters = [...drilldownState.filters];
    newFilters.push({
      key: filterKeyMap[currentLevel],
      cond: "equals",
      value: dataItem.label,
    });

    // Update drill state
    setDrilldownState({
      level: nextLevel,
      filters: newFilters,
    });
    setDrillHistory((prev) => [...prev, dataItem.label]);

    // Fetch new dropdown options with updated drill filters and current active filters
    // await fetchFilterOptions([...newFilters, ...activeFilters]);
  };

  const handleBackClick = async () => {
    if (drilldownState.filters.length > 0) {
      const newFilters = [...drilldownState.filters];
      newFilters.pop();

      // Define levels in order
      const levels: DrilldownState["level"][] = [
        "",
        "zone",
        "region",
        "salesarea",
      ];
      const newLevel = levels[newFilters.length] || "";

      // Update drill state
      setDrilldownState({
        level: newLevel,
        filters: newFilters,
      });
      setDrillHistory((prev) => prev.slice(0, -1));

      // Fetch new dropdown options with updated drill filters and current active filters
    //   await fetchFilterOptions([...newFilters, ...activeFilters]);
    }
  };

  // Initial load and drilldown changes are handled by useEffect([drilldownState]) above

  // OPTION 1: Using amCharts built-in Intl support (Recommended)
  // No custom function needed - amCharts handles this automatically with en-IN locale

  useEffect(() => {
    if (!chartData.length || isLoading || !chartDivRef.current) return;

    if (chartRef.current) {
      chartRef.current.dispose();
    }

    const root = am5.Root.new(chartDivRef.current);
    chartRef.current = root;

    // Set themes without locale dependency
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
      // Updated label map to include all three levels
      const labelMap = {
        "": "Zone",
        zone: "Region",
        region: "Sales Area",
        salesarea: "Customer",
        // rosapcode: "Site Area"
      };
      return labelMap[drilldownState.level] || "Zone";
    };

    // Calculate maximum value for y-axis
    const maxValue = Math.max(...chartData.map((item) => item.value));
    const yAxisMax = Math.ceil(maxValue * 1.2);
    
    // Custom Indian number formatter function
    const formatIndianNumber = (value) => {
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    };

    // Add export functionality
    const exporting = am5plugins_exporting.Exporting.new(root, {
      menu: am5plugins_exporting.ExportingMenu.new(root, {
        align: "right",
        valign: "top"
      }),
      dataSource: chartData,
      filePrefix: "TAR_Chart"
    });

    // Set the chart as the export target
    exporting.get("menu").set("items", [
      {
        type: "format",
        format: "png",
        label: "Export as PNG"
      },
      {
        type: "format", 
        format: "jpg",
        label: "Export as JPG"
      },
      {
        type: "format",
        format: "pdf",
        label: "Export as PDF"
      },
      {
        type: "separator"
      },
      {
        type: "format",
        format: "csv",
        label: "Export data as CSV"
      },
      {
        type: "format",
        format: "xlsx", 
        label: "Export data as XLSX"
      }
    ]);
    
    let xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "label",
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
        text: "TAR Amount",
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
    
    // Add custom formatter for Y-axis labels
    yAxis.get("renderer").labels.template.adapters.add("text", function(text, target) {
      if (target.dataItem) {
        // @ts-ignore
        const value = target.dataItem.get("value");
        return formatIndianNumber(value);
      }
      return text;
    });
    
    let series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "TAR Amount",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "label",
        tooltip: am5.Tooltip.new(root, {
          labelText:
            "[bold fontSize: 8px]{categoryX}[/]\n[fontSize: 8px]TAR Amount: [fontSize: 8px bold]₹{valueY}[/]",
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

    // Add custom formatter for tooltip
    series.get("tooltip").adapters.add("labelText", function(labelText, target) {
      if (target.dataItem) {
        const dataContext = target.dataItem.dataContext as { label: string; value: number };
        const categoryX = dataContext.label;
        const valueY = dataContext.value;
        const formattedValue = formatIndianNumber(valueY);
        return `[bold fontSize: 8px]${categoryX}[/]\n[fontSize: 8px]TAR Amount: [fontSize: 8px bold]₹${formattedValue}[/]`;
      }
      return labelText;
    });

    // Add value labels on top of columns with Indian formatting
    series.bullets.push(function () {
      const label = am5.Label.new(root, {
        text: "₹{valueY}",
        centerX: am5.p50,
        centerY: 0,
        populateText: true,
        fontSize: 10,
        fontWeight: "400",
        dy: -25,
      });

      // Add custom formatter for value labels
      label.adapters.add("text", function(text, target) {
        if (target.dataItem) {
          const dataContext = target.dataItem.dataContext as { label: string; value: number };
          const value = dataContext.value;
          const formattedValue = formatIndianNumber(value);
          return `₹${formattedValue}`;
        }
        return text;
      });

      return am5.Bullet.new(root, {
        locationY: 1,
        sprite: label,
      });
    });

    // Add click handler for drill-down functionality
    series.columns.template.events.on("click", function (ev) {
      const dataItem = ev.target.dataItem;
      if (dataItem) {
        const dataContext = dataItem.dataContext as ChartDataItem;
        if (dataContext?.drillDown) {
          handleDrillDown(dataContext);
        }
      }
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
        label: string;
        value: number;
      };
      const index = chartData.findIndex(
        (item) => item.label === dataContext?.label
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
        label: string;
        value: number;
      };
      const index = chartData.findIndex(
        (item) => item.label === dataContext?.label
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
      end: chartData.length <= 12 ? 1 : 12 / chartData.length,
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
          Loading {drilldownState.level || "zone"} data...
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
              Retail TAR Analysis
            </CardTitle>
            {/* <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
        </div>
        <div className="text-xs font-semibold text-black-600">
          Total TAR Amount:
          <span className="text-blue-600">
            ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative h-[290px] pt-0">
        {drillHistory.length > 0 && (
          <div className="text-gray-600 p-1 text-xs">
            Drill Path: {drillHistory.join(" → ")}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-gray-500 text-sm bg-gray-50 p-4 rounded-md">
              No Data
            </div>
          </div>
        )}
        {isTransitioning && <LoadingOverlay />}
        <div
          ref={chartDivRef}
          style={{ width: "100%", height: "300px" }}
        />
      </CardContent>
    </Card>
  );
};

export default RetailTAR;