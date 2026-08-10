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
import { RotateCcw, Loader2, ArrowLeft } from "lucide-react";
import { FilterDropdown } from "../FilterDropdown";
import { display } from "@mui/system";
import { apiClient } from "@/services/apiClient";

const BigNumberCard = ({ title, consumers, refills, onClick,totalRefills }) => {
  const percentageOfTotal = totalRefills ? ((refills / totalRefills) * 100).toFixed(1) : 0;
  // const percentage =  ((refills/100) * 100).toFixed(1);
  
  
  return (
    <Card
      className="h-24 w-full cursor-pointer hover:shadow-lg transition-shadow bg-[#424771]"
      onClick={onClick}
    >
      <div className="h-full flex flex-col">
        <div className="text-center w-full">
          <h2 className="text-[10px] font-semibold text-white px-1 truncate">
            {title}
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-between px-2">
          <div className="flex flex-col">
            <span className="text-[11px] text-white">Consumers</span>
            <p className="text-[10px] font-bold text-white">
              {consumers?.toLocaleString()}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-white">Refills</span>
            <p className="text-[10px] font-bold text-white">
              {refills?.toLocaleString()}
            </p>
           
           
          </div>
         
        </div>
        <div className="flex-1 flex items-center justify-between px-1">
  <span className="text-[11px] text-white">Percentage</span>
  <p className="text-[9px] text-white truncate">({percentageOfTotal}%)</p>
</div>
      </div>
    </Card>
  );
};

interface FilterDropdown {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}
interface FilterOption {
  key: string;
  label: string;
}

interface LocationFilter {
  key: string;
  cond: string;
  value: string;
}

interface DrilldownState {
  level: "exception" | "zone" | "region" | "salesarea" | "distributor";
  filters: Array<{
    key: string;
    cond: string;
    value: string;
  }>;
}

const filterOptions: FilterOption[] = [
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" },
//   { key: "CylType", label: "Cylinder Type" },
];
interface ChartDataItem {
  name: string;
  value: number;
  drillDown: boolean;
}
interface ApiResponse {
  status: boolean;
  message: string;
  data:
    | {
        ExceptionName?: { [key: string]: string };
        Consumers?: { [key: string]: number };
        Refills?: { [key: string]: number };
        totalRefills?: number;
      }
    | Array<any>;
}

const DrillStateIndicator = ({ level }: { level: string }) => {
  // Updated states array to match exact level names from drilldownState
  const states = ["Exception", "Zone", "Region", "SalesArea", "Distributor"];

  // Normalize the level name to match the states array
  const normalizedLevel = level.toLowerCase();
  const currentIndex = states.findIndex(
    (state) => state.toLowerCase() === normalizedLevel
  );

  // Create display names with proper capitalization
  const displayNames = [
    "Exception",
    "Zone",
    "Region",
    "SalesArea",
    "Distributor",
  ];

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-xs text-blue-600">
        {currentIndex >= 0 ? displayNames[currentIndex] : level}
      </span>
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

const SubsidyExceptionStats = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    level: "exception",
    filters: [],
  });
  const [drillLevel, setDrillLevel] = useState(0);
  const [filters, setFilters] = useState<LocationFilter[]>([]);
  const [drillHistory, setDrillHistory] = useState<string[]>([]);
  const chartRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
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
  const [cardData, setCardData] = useState(null);
  const [showCards, setShowCards] = useState(true);
  const [selectedCardData, setSelectedCardData] = useState(null);

  const handleBackClick = async () => {
    if (drilldownState.filters.length > 0) {
      setIsTransitioning(true);
      const newFilters = [...drilldownState.filters];
      newFilters.pop();

      const levels: DrilldownState["level"][] = [
        "exception",
        "zone",
        "region",
        "salesarea",
        "distributor",
      ];
      const newLevel = levels[newFilters.length] || "exception";

      // If going back to initial level with no filters, show cards
      if (newLevel === "exception" && newFilters.length === 0) {
        setShowCards(true);
      }

      setDrilldownState({
        level: newLevel,
        filters: newFilters,
      });
      setDrillHistory((prev) => prev.slice(0, -1));
    }
  };

  const handleDrillDown = async (dataItem: any) => {
    setIsTransitioning(true);
    const newFilters = [...drilldownState.filters];

    const drillLevels = {
      exception: {
        next: "zone",
        key: "ExceptionName",
      },
      zone: {
        next: "region",
        key: "ZOName",
      },
      region: {
        next: "salesarea",
        key: "ROName",
      },
      salesarea: {
        next: "distributor",
        key: "SAName",
      },
    };

    const currentLevel = drillLevels[drilldownState.level];

    if (currentLevel && drilldownState.level !== "distributor") {
      newFilters.push({
        key: `"${currentLevel.key}"`,
        cond: "equals",
        value: dataItem.category,
      });

      setDrilldownState({
        level: currentLevel.next as DrilldownState["level"],
        filters: newFilters,
      });

      setDrillHistory((prev) => [...prev, dataItem.category]);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [],
        action: "cdcms_dropdown",
        drill_state: drilldownState.level,
      });

      const result = response.data;
      setFilterData(result);
      const initialFilters = Object.keys(result).reduce((acc, key) => {
        acc[key] = "";
        return acc;
      }, {} as Record<string, string>);
      setSelectedFilters(initialFilters);
    } catch (error) {
      console.error("Error fetching filter options:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const handleCardClick = (exceptionName) => {
    setSelectedCardData(exceptionName);
    setShowCards(false);

    // Update drilldown state to zone level with filter for the selected exception
    setDrilldownState({
      level: "zone",
      filters: [
        {
          key: '"ExceptionName"',
          cond: "equals",
          value: exceptionName,
        },
      ],
    });

    // Add to drill history
    setDrillHistory([exceptionName]);

    // Set transition loading state
    setIsTransitioning(true);

    // Make sure we're triggering the drill down API cal
  };
  const handleFilterChange = async (key: string, value: string) => {
    if (!value) return;

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

      if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }

      setActiveFilters(updatedFilters);
      // Removed manual fetchData call - useEffect will handle it
    } catch (error) {
      console.error("Error updating filters:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const resetFilters = async () => {
    // Add a guard clause to prevent multiple executions
    if (isLoadingFilters) return;
    
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

      // Reset drilldown state to initial
      setDrilldownState({
        level: "exception",
        filters: [],
      });

      // Reset drill history
      setDrillHistory([]);

      // Show cards view when resetting
      setShowCards(true);

      // Reset drill level
      setDrillLevel(0);

      // Fetch dropdown data - useEffect will handle chart data fetch
      const dropdownResult = await apiClient.post("/api/charts/generate_vis_data", {
        filters: [],
        action: "cdcms_dropdown",
        drill_state: "exception",
      });

      setFilterData(dropdownResult.data);
    } catch (error) {
      console.error("Error resetting filters:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  };


  const transformData = (data: ApiResponse["data"]) => {
    if (drilldownState.level === "exception" && "ExceptionName" in data) {
      // Transform data for both cards and chart when at exception level
      const keys = Object.keys(data.ExceptionName);
      const transformedData = keys.map((key) => ({
        category: data.ExceptionName[key],
        consumers: data.Consumers?.[key] || 0,
        refills: data.Refills?.[key] || 0,
      }));

      const totalRefills = keys.reduce((sum, key) => sum + (data.Refills?.[key] || 0), 0);
            console.log("Total Refills:", totalRefills);
      // Update card data when at exception level
      const cardTransformedData = transformedData.reduce((acc, item) => {
        acc[item.category] = {
          consumers: item.consumers,
          refills: item.refills,
          totalRefills: totalRefills
        };
        return acc;
      }, {});

      setCardData(cardTransformedData);
      return transformedData;
    } else if (Array.isArray(data)) {
      // For drilled down data, keep the existing transformation
      const groupByField = {
        zone: "ZOName",
        region: "ROName",
        salesarea: "SAName",
        distributor: "DistributorName",
      }[drilldownState.level];

      if (!groupByField) return [];

      const groupedData: {
        [key: string]: { consumers: number; refills: number };
      } = {};

      data.forEach((item) => {
        const key = item[groupByField];
        if (!groupedData[key]) {
          groupedData[key] = { consumers: 0, refills: 0 };
        }
        groupedData[key].consumers += Number(item.Consumers || 0);
        groupedData[key].refills += Number(item.Refills || 0);
      });

      return Object.entries(groupedData).map(([category, values]) => ({
        category,
        ...values,
      }));
    }
    return [];
  };

  // Drill level field mapping
  const getDrillLevelField = (level: number) => {
    const fields = [
      "ExceptionName",
      "ZOName",
      "ROName",
      "SAName",
      "DistributorName",
    ];
    return fields[level] || fields[0];
  };
  const fetchData = async (
    drillFilters: LocationFilter[],
    crossFilters: LocationFilter[]
  ) => {
    try {
      setIsTransitioning(true);

      // Log the request for debugging
      console.log("API Request:", {
        filters: drillFilters,
        cross_filters: crossFilters,
        action: "lpg_cdcms_exception_stats",
        drill_state: drilldownState.level,
      });

      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: drillFilters,
        cross_filters: crossFilters,
        action: "lpg_cdcms_exception_stats",
        drill_state: drilldownState.level,
      });

      const result = response.data;

      if (result.status && result.data) {
        const transformedData = transformData(result.data);

        // Update chart data first
        setChartData(transformedData);

        // Show cards only at initial exception level with no filters
        if (drilldownState.level === "exception" && drillFilters.length === 0) {
          // Add a small delay for smooth transition
          await new Promise(resolve => setTimeout(resolve, 100));
          setShowCards(true);
        } else {
          setShowCards(false);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchData(drilldownState.filters, activeFilters);
  }, [drilldownState.level, drilldownState.filters, activeFilters]);

  useEffect(() => {
    if (!chartData.length || isLoading || !chartDivRef.current) return;

    if (chartRef.current) {
      chartRef.current.dispose();
    }

    const root = am5.Root.new(chartDivRef.current);
    chartRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 0,
      })
    );

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

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {}),
        numberFormat: "#,###",
        min: 0,
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererY.new(root, {
          minGridDistance: 0,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      paddingBottom: 5,
      fontSize: 10,
      maxWidth: 80,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
    });
    const getyAxisLabel = () => {
      const labelMap = {
        exception: "Exception Names",
        zone: "Zones",
        region: "Regions",
        salesarea: "Sales Areas",
        distributor: "Distributors",
      };
      return labelMap[drilldownState.level] || "Time Period";
    };
    // Add axis labels
    xAxis.children.push(
      am5.Label.new(root, {
        text: "Consumers & Refills",
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 20,
        fontSize: 10,
      })
    );
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: getyAxisLabel(),
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 10,
      })
    );

    const consumersSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Consumers",
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "consumers",
        categoryYField: "category",
        tooltip: am5.Tooltip.new(root, {
          labelText:
            "[fontSize: 8px bold]{category}[/],[fontSize: 8px bold]Consumers: [fontSize: 8px bold]{valueX}[/]",
        }),
      })
    );

    const refillsSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Refills",
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "refills",
        categoryYField: "category",
        tooltip: am5.Tooltip.new(root, {
          labelText:
            "[fontSize: 8px bold]{category}[/],[fontSize: 8px bold]Refills: [fontSize: 8px bold]{valueX}[/]",
        }),
      })
    );

    // Configure series
    [consumersSeries, refillsSeries].forEach((series, index) => {
      series.columns.template.setAll({
        strokeOpacity: 0,
        cornerRadiusBR: 5,
        cornerRadiusTR: 5,
        fill: index === 0 ? am5.color(0x7986cb) : am5.color(0x64b5f6),
        width: am5.percent(100),
        height: am5.percent(80),
      });

      series.bullets.push(() => {
        return am5.Bullet.new(root, {
          locationX: 1,
          sprite: am5.Label.new(root, {
            text: "{valueX.formatNumber('#,###.########')}",
            centerY: am5.p50,
            centerX: 1,
            paddingRight: 5,
            populateText: true,
            fontSize: 10,
          }),
        });
      });

      // Add click event for drill-down
      if (drilldownState.level !== "distributor") {
        series.columns.template.events.on("click", (ev) => {
          const dataItem = ev.target.dataItem?.dataContext;
          if (dataItem) {
            handleDrillDown(dataItem);
          }
        });
      }
    });

    const scrollbarY = am5.Scrollbar.new(root, {
      orientation: "vertical",
      marginRight: 30,
      minWidth: 10,
      start: 0,
      end: chartData.length <= 7 ? 1 : 7 / chartData.length,
    });
    chart.set("scrollbarY", scrollbarY);
    chart.rightAxesContainer.children.push(scrollbarY);

    scrollbarY.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    });

    chart.set("scrollbarY", scrollbarY);
    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      })
    );
    chart.rightAxesContainer;

    // Set data
    yAxis.data.setAll(chartData);
    consumersSeries.data.setAll(chartData);
    refillsSeries.data.setAll(chartData);
    legend.data.setAll([consumersSeries, refillsSeries]);

    return () => {
      root.dispose();
    };
  }, [chartData, isLoading]);
  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">
          Loading {getDrillLevelField(drillLevel)} data...
        </span>
      </div>
    </div>
  );

  if (isLoading && !isTransitioning) {
    return (
      <Card className="h-[300px] relative">
        <CardContent className="h-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        </CardContent>
      </Card>
    );
  }

  const renderCards = () => {
    if (!cardData) return null;
  
    // Convert cardData into an array and sort by percentage
    const sortedCards = Object.entries(cardData)
      .map(([exceptionName, data]) => ({
        exceptionName,
        consumers: (data as any).consumers,
        refills: (data as any).refills,
        totalRefills: (data as any).totalRefills,
        percentage: ((data as any).refills / (data as any).totalRefills) * 100
      }))
      .sort((a, b) => b.percentage - a.percentage); // Sort in descending order
  
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-1 p-1">
        {sortedCards.map(({ exceptionName, consumers, refills, totalRefills }) => (
          <BigNumberCard
            key={exceptionName}
            title={exceptionName}
            consumers={consumers}
            totalRefills={totalRefills}
            refills={refills}
            onClick={() => handleCardClick(exceptionName)}
          />
        ))}
      </div>
    );
  };

  return (  
    <Card>
      <CardHeader className="pb-0 p-1">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-gray-800">
              Subsidy Exception Stats
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
            <div className="flex items-center gap-2">
              <DrillStateIndicator level={drilldownState.level} />
              {drilldownState.filters.length === 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={resetFilters}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-5 h-5 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {drilldownState.filters.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleBackClick}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={resetFilters}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          {/* Filters Row */}

          {/* Active Filters and Drill Path */}
          {/* {activeFilters.length > 0 && (
                        <div className="text-xs text-gray-600">
                            Active Filters: {activeFilters.map(f => `${f.key}: ${f.value}`).join(", ")}
                            </div>
                    )} */}
        </div>
      </CardHeader>
      <CardContent className="p-0 relative pt-0">
      {drillHistory.length > 0 && (
                        <div className="text-gray-600 p-1 text-xs">
                            Drill Path: {drillHistory.join(" → ")}
                        </div>
                    )}

      <div className="transition-opacity duration-300 ease-in-out">
        {showCards ? (
          renderCards()
        ) : (
          <div className="relative h-[300px]">
            {isTransitioning && <LoadingOverlay />}
            <div
              ref={chartDivRef}
              id="chartdiv"
              style={{ width: "100%", height: "290px" }}
            />
          </div>
        )}
      </div>

      </CardContent>
    </Card>
  );
};

export default SubsidyExceptionStats;
