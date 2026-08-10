import React, { useEffect, useState, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2 } from "lucide-react";
import { FilterDropdown } from "../FilterDropdown";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";

interface ChartDataItem {
  name: string;
  value: number;
  drillDown: boolean;
}

type DrillLevel = "zone" | "region" | "salesarea" | "distributor";

interface DrilldownState {
  level: DrillLevel;
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
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" },
  // { key: "CylType", label: "Cylinder Type" },
];

const DrillStateIndicator = ({ level }: { level: string }) => {
  const states = ["zone", "region", "salesarea", "distributor" ];
  const displayNames = [
    "Zone",
    "Region",
    "Sales Area",
    "Distributor",
  ];
  const currentIndex = states.findIndex((state) => state === level);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">
        {currentIndex >= 0 ? displayNames[currentIndex] : level}
      </span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${index === currentIndex ? "bg-blue-600" : "bg-gray-300"
              }`}
          />
        ))}
      </div>
    </div>
  );
};

const TotalSuvidhaClub = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [pieData, setPieData] = useState([]);
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
  const [crossFilters, setCrossFilters] = useState<
    Array<{
      key: string;
      cond: string;
      value: string;
    }>
  >([]);
  const barChartRef = useRef(null);
  const pieChartRef = useRef(null);
  const barChartDivRef = useRef(null);
  const pieChartDivRef = useRef(null);

  const drillLevels: Record<DrillLevel, { next: DrillLevel; field: string }> = {
    zone: { next: "region", field: "ZOName" },
    region: { next: "salesarea", field: "ROName" },
    salesarea: { next: "distributor", field: "SAName" },
    distributor: { next: null, field: "DistributorName" },
  };

  const handleBackClick = () => {
    if (drilldownState.filters.length > 0) {
      setIsTransitioning(true);
      const newFilters = [...drilldownState.filters];
      newFilters.pop();

      const levels: DrillLevel[] = [
        "zone",
        "region",
        "salesarea",
      ];
      const currentLevelIndex = levels.indexOf(drilldownState.level);
      const newLevel = levels[currentLevelIndex - 1] || "zone";

      setDrilldownState({
        level: newLevel,
        filters: newFilters,
      });
      setDrillHistory((prev) => prev.slice(0, -1));
    }
  };

  const handleDrillDown = (dataItem: ChartDataItem) => {
    if (!dataItem?.drillDown) return;

    const currentLevelInfo = drillLevels[drilldownState.level];
    if (!currentLevelInfo) return;

    const newFilter = {
      key: `"${currentLevelInfo.field}"`,
      cond: "equals",
      value: dataItem.name,
    };

    const newFilters = [...drilldownState.filters, newFilter];

    setDrilldownState({
      level: currentLevelInfo.next,
      filters: newFilters,
    });

    setDrillHistory((prev) => [...prev, dataItem.name]);
    setIsTransitioning(true);
  };

  const transformData = (responseData: any) => {
    const { data_pie, data } = responseData;

    // Transform pie data
    const transformedPieData =
      data_pie?.map((item) => ({
        name: item.SubCategory,
        value: item.SuvidhaClub,
        drillDown: false,
      })) || [];

    // Transform bar data based on drill level
    const transformedBarData =
      data?.map((item) => {
        const currentLevel = drillLevels[drilldownState.level];
        const field = currentLevel?.field || "ZOName";

        return {
          name: item[field],
          value: item.SuvidhaClub,
          drillDown: drilldownState.level !== "distributor",
        };
      }) || [];

    return { pieData: transformedPieData, barData: transformedBarData };
  };

  const fetchData = async (crossFilters = []) => {
    try {
      setIsTransitioning(true);

      const payload = {
        filters: drilldownState.filters,
        cross_filters: crossFilters,
        action: "lpg_cdcms_total_suvidha",
        drill_state: "",
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);

      const result = response.data;

      if (result.status) {
        const { pieData, barData } = transformData(result);

        // Check if data is empty
        if ((!pieData || pieData.length === 0) && (!barData || barData.length === 0)) {
          setError("No data available");
          setPieData([]);
          setChartData([]);
        } else {
          setPieData(pieData);
          setChartData(barData);
          setError(null);
        }
      } else {
        setError(result.message || "Failed to fetch data");
        setPieData([]);
        setChartData([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const fetchFilterOptions = async (filtersForDropdown = []) => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [...drilldownState.filters, ...filtersForDropdown],
        action: "cdcms_dropdown",
        drill_state: drilldownState.level,
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

  const handleFilterChange = async (key: string, value: string) => {
    setIsLoadingFilters(true);
    try {
      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: value,
      };
      setSelectedFilters(updatedSelectedFilters);

      const newFilters = Object.entries(updatedSelectedFilters)
        .filter(([_, val]) => val && val !== "NULL")
        .map(([key, value]) => ({
          key: `"${key}"`,
          cond: "equals",
          value,
        }));

      setCrossFilters(newFilters);

      // Update dropdown options with the new filters
      const dropdownResponse = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [...drilldownState.filters, ...newFilters],
        action: "cdcms_dropdown",
        drill_state: drilldownState.level,
      });

      const dropdownResult = dropdownResponse.data;
      if (dropdownResult) {
        setFilterData(dropdownResult);
      }
    } catch (error) {
      console.error("Error updating filters:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const resetFilters = async () => {
    setIsLoadingFilters(true);
    try {
      const resetValues = Object.keys(selectedFilters).reduce((acc, key) => {
        acc[key] = "";
        return acc;
      }, {} as Record<string, string>);

      setSelectedFilters(resetValues);
      setCrossFilters([]);
      setDrilldownState({
        level: "zone",
        filters: [],
      });
      setDrillHistory([]);

      // Fetch fresh dropdown options with no filters
      const dropdownResponse = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [],
        action: "cdcms_dropdown",
        drill_state: "zone",
      });

      const dropdownResult = dropdownResponse.data;
      if (dropdownResult) {
        setFilterData(dropdownResult);
      }
    } catch (error) {
      console.error("Error resetting filters:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchData(crossFilters);
  }, [drilldownState.filters, crossFilters]);

  useEffect(() => {
    if (isLoading || !pieChartDivRef.current || !barChartDivRef.current) return;

    if (pieChartRef.current) pieChartRef.current.dispose();
    if (barChartRef.current) barChartRef.current.dispose();

    const pieRoot = am5.Root.new(pieChartDivRef.current);
    const barRoot = am5.Root.new(barChartDivRef.current);
    pieChartRef.current = pieRoot;
    barChartRef.current = barRoot;

    pieRoot.setThemes([am5themes_Animated.new(pieRoot)]);
    barRoot.setThemes([am5themes_Animated.new(barRoot)]);
    pieRoot._logo?.dispose();
    barRoot._logo?.dispose();

    // Pie Chart with adjusted position
    const pieChart = pieRoot.container.children.push(
      am5percent.PieChart.new(pieRoot, {
        layout: pieRoot.verticalLayout,
        innerRadius: am5.percent(50),
        height: am5.percent(60), // Reduced height
        x: am5.percent(-10), // Adjusted position
        y: am5.percent(5), // Adjusted position

        width: am5.percent(100) // Reduced width
      })
    );

        const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);
      // Add center label with smaller font size
      const label = pieChart.seriesContainer.children.push(
        am5.Label.new(pieRoot, {
          textAlign: "center",
          centerY: am5.p50,
          centerX: am5.p50,
          text: `Total\n[bold]${Math.round(totalValue)}[/]`,
          fontSize: 10
        })
      );

    const pieSeries = pieChart.series.push(
      am5percent.PieSeries.new(pieRoot, {
        valueField: "value",
        categoryField: "name",
        endAngle: 270,
      })
    );

    pieSeries.setAll({
      tooltipText: "[fontSize: 8px]{category}: {value.formatNumber('#.00')}",
      tooltip: am5.Tooltip.new(pieRoot, {
        labelText: "[fontSize: 8px] {category}: {value.formatNumber('#.00')}",
        getFillFromSprite: true,
      }),
    });
    pieSeries.labels.template.setAll({
      text: "{category}:\n{valuePercentTotal.formatNumber('#.0')}%",
      textType: "circular",
      radius: -5,
      fontSize: 10,
      fill: am5.color(0x000000),
      inside: false,
      centerX: am5.percent(50),
      centerY: am5.percent(50),
      oversizedBehavior: "none",
    })

    // pieSeries.ticks.template.setAll({
    // visible: false,
    // });

    pieSeries.labels.template.setAll({
      fontSize: 10,
    });

    const pieLegend = pieChart.children.unshift(
      am5.Legend.new(pieRoot, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        layout: pieRoot.horizontalLayout,
        height: 40
      })
    );

    pieLegend.labels.template.setAll({
      fontSize: 10,
      text: "{name}"
    });    // Update legend to show only raw values without percentages
    pieLegend.valueLabels.template.set("forceHidden", true); // Hide default value labels
   


    // If you want to show the actual values instead of percentages:
    // pieLegend.labels.template.adapters.add("text", function(text, target) {
    // const dataItem = target.dataItem;
    // if (dataItem) {
    // const category = dataItem.get("category");
    // const value = dataItem.get("value");
    // return `${category} ${value.toLocaleString()}`;
    // }
    // return text;
    // });

    pieLegend.markers.template.setAll({
      width: 16,
      height: 16
    });

    // Configure tooltips if needed
    pieSeries.setAll({
      tooltipText: "[fontSize: 8px]{category}: {value}",
      tooltip: am5.Tooltip.new(pieRoot, {
        labelText: "[fontSize: 8px]{category}: {value}",
        getFillFromSprite: true
      })
    });

    // Define colors for bars
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

    ];


    // Function to get X-Axis label based on drill state
    const getXAxisLabel = () => {
      switch (drilldownState.level) {
        case "zone": return "Zones";
        case "region": return "Regions";
        case "salesarea": return "Sales Areas";
        case "distributor": return "Distributors";
        default: return "Zones";
      }
    };

    // Bar Chart Configuration
    const barChart = barRoot.container.children.push(
      am5xy.XYChart.new(barRoot, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: barRoot.verticalLayout,
        height: am5.percent(85), // Reduced height
        paddingLeft: 0 // Remove left padding
      })
    );

    // X-Axis Configuration
    const xAxis = barChart.xAxes.push(
      am5xy.CategoryAxis.new(barRoot, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(barRoot, {
          minGridDistance: 30,
        }),
      })
    );

    xAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      textAlign: "center",
      maxWidth: 100,
      oversizedBehavior: "wrap",
      fontSize: 10,
    });


 
    // Y-Axis Configuration
    const yAxis = barChart.yAxes.push(
      am5xy.ValueAxis.new(barRoot, {
        renderer: am5xy.AxisRendererY.new(barRoot, {})
      })
    );
    xAxis.children.unshift(
      am5.Label.new(barRoot, {
        text: getXAxisLabel(),
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 10,
        fontSize: 10,
      })
    );
    
    // Adjust y-axis label
    yAxis.children.unshift(
      am5.Label.new(barRoot, {
        rotation: -90,
        text: "Total Suvidha",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0
      })
    );
    yAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      textAlign: "center",
      maxWidth: 80, // Reduced max width
      fontSize: 10,
      oversizedBehavior: "wrap"
    });
    // Bar Series Configuration
    const series = barChart.series.push(
      am5xy.ColumnSeries.new(barRoot, {
        name: "SuvidhaClub",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "name",
        tooltip: am5.Tooltip.new(barRoot, {
          labelText: "[fontSize: 8px]{categoryX}: {valueY}",
          getFillFromSprite: true,
          keepTargetHover: true
        }),
      })
    );

    // Bar Styling with different colors
    series.columns.template.setAll({
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      tooltipY: 0,
      fillOpacity: 0.8,
      strokeOpacity: 0.8,
    });

    // // Set different colors for each bar
    // series.columns.template.adapters.add("fill", (fill, target) => {
    //   const dataContext = target.dataItem.dataContext as ChartDataItem;
    //   const index = chartData.findIndex(item => item.name === dataContext.name);
    //   return colors[index % colors.length];
    // });
    // series.columns.template.adapters.add("stroke", (stroke, target) => {
    //   const dataContext = target.dataItem.dataContext as ChartDataItem;
    //   const index = chartData.findIndex(item => item.name === dataContext.name);
    //   return colors[index % colors.length];
    // });

    // Add value labels above bars
    series.bullets.push(function () {
      return am5.Bullet.new(barRoot, {
        locationY: 1,
        sprite: am5.Label.new(barRoot, {
          text: "{valueY}",
          fill: barRoot.interfaceColors.get("text"),
          centerX: am5.p50,
          centerY: am5.p50,
          populateText: true,
          fontSize: 10,
          dy: -9
        })
      });
    });

    // Create legend data with all colors
    const legendData = chartData.map((item, index) => ({
      name: item.name,
      color: colors[index % colors.length]
    }));

    // Bar Chart Legend
    const barLegend = barChart.children.unshift(
      am5.Legend.new(barRoot, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        layout: barRoot.horizontalLayout,
        height: 40,
        visible: true
      })
    );

    barLegend.data.setAll(legendData);

    barLegend.labels.template.setAll({
      fontSize: 10,
      fontWeight: "500"
    });

    barLegend.markers.template.setAll({
      width: 16,
      height: 16
    });

    // Scrollbar Configuration
    const scrollbarX = am5.Scrollbar.new(barRoot, {
      orientation: "horizontal",
      marginBottom: 8,
      minHeight: 10,
      start: 0,
      end: chartData.length <= 7 ? 1 : 7 / chartData.length,
    });

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true
    });

    barChart.set("scrollbarX", scrollbarX);
    barChart.bottomAxesContainer.children.push(scrollbarX);

    // Cursor Configuration
    barChart.set("cursor", am5xy.XYCursor.new(barRoot, {
      behavior: "none",
      xAxis: xAxis,
      yAxis: yAxis
    }));

    // Click Handler for Drill Down
    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem?.dataContext as ChartDataItem;
      if (dataItem) {
        handleDrillDown(dataItem);
      }
    });

    // Set Data
    xAxis.data.setAll(chartData);
    series.data.setAll(chartData);
    pieSeries.data.setAll(pieData);
    pieLegend.data.setAll(pieSeries.dataItems);

    // Cleanup
    return () => {
      if (pieChartRef.current) pieChartRef.current.dispose();
      if (barChartRef.current) barChartRef.current.dispose();
    };
  }, [chartData, pieData, isLoading]);


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
    <Card >
      <CardHeader className="pb-0 p-1"> {/* Reduced padding */}
      <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-gray-800">
              Total Suvidha Club
            </CardTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filterOptions.slice(0, 6).map(({ key, label }) => (
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
        </div>
      </CardHeader>

      <CardContent className="p-0 relative h-[310px]">
      {drillHistory.length > 0 && (
            <div className="text-gray-600 p-1 text-[10px]">Drill Path: {drillHistory.join(" → ")}</div>
          )}

        {error ? (
          <NoDataDisplay message={error} />
        ) : (
          <>
            {/* Charts Container */}
            <div className="flex h-full gap-0 relative">
              {isTransitioning && <LoadingOverlay />}
              <div ref={pieChartDivRef} className="p-0 flex w-[20%] h-300px" />
              <div ref={barChartDivRef} className="p-0 w-[80%] h-300px ml-0"  />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TotalSuvidhaClub;
