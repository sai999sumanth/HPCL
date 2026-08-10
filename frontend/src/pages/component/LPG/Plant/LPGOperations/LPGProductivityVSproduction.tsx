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
  Maximize2,
  Minimize2,
} from "lucide-react";
import useCurrentDate from "@/hooks/useCurrentdate"
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay"

// Mock payload matching the hours-by-interval API shape
const MOCK_HOURLY_PRODUCTION = {
  "1": [1381, 1668, 1738, 1570, 631, 1220, 318],
  "2": [0, 0, 0, 0, 0, 0, 0],
  labels: [
    "0900 - 1000",
    "1000 - 1100",
    "1100 - 1200",
    "1200 - 1300",
    "1300 - 1400",
    "1400 - 1500",
    "1500 - 1600",
  ],
  total1: 8526,
  total2: 0,
} as const;

interface ProductionDataItem {
  zone?: string;
  plant?: string;
  break_production: number;
  overtime_prouction: number;
  /** API returns this spelling; normalized to overtime_prouction for chart */
  overtime_production?: number;
  name?: string;
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
interface ProductionComparisonChartProps {
  activeFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  selectedFromDate: any
  selectedToDate: any
  crossFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  onResetFilters: () => void
}


const CHART_COLORS = {
  break_production: "#01949A", // Green for break production
  overtime_prouction: "#004369", // Blue for overtime production
};


const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = ["Zone", "Plant"];

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


const ProductionComparisonChart = ({
  activeFilters,
  crossFilters,
  onResetFilters,
  selectedFromDate,
  selectedToDate,
}:ProductionComparisonChartProps) => {
  const [chartData, setChartData] = useState<ProductionDataItem[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [drillHistory, setDrillHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [filters, setFilters] = useState<LocationFilter[]>([]);
  const [error, setChartError] = useState<string | null>(null);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const { formattedDate } = useCurrentDate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalProduction, setTotalProduction] = useState<{ 
    breakProduction: number; 
    overtimeProduction: number 
  }>({ 
    breakProduction: 0, 
    overtimeProduction: 0 
  });

  const [fromDate, setFromDate] = useState();
  const [toDate, setToDate] = useState();

  // Filter states
  const [filterData, setFilterData] = useState<Record<string, string[]>>({});
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, string>
  >({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [drillState, setDrillState] = useState<DrillState>({
    level: "zone",
    filters: [],
  });

  // Fetch filter options
  const fetchFilterOptions = async (crossFilters = []) => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: crossFilters,
          action: "operations_dropdown",
          drill_state: drillState.level, // Now properly typed
        })

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.data;
      if (result) {
        setFilterData(result);
        // Don't set initial values, let user select them
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
      setChartError("No data available");
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Drill level field mapping
  const getDrillLevelField = (level: number) => {
    const fields = ["zone", "plant"];
    return fields[level] || fields[0];
  };

  const fetchChartData = async () => {
    let breakProductionTotal = 0;
    let overtimeProductionTotal = 0;
    try {
      setIsTransitioning(true);
      setChartError(null);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters,
          cross_filters: crossFilters,
          action: "productivity_overtime_vs_break_production",
          drill_state: "",
        })

      const result = await response.data;
      if (result && result.data) {
        let transformedData: ProductionDataItem[] = [];

        if (
          result.data &&
          Array.isArray((result.data as any).labels) &&
          Array.isArray((result.data as any)["1"]) &&
          Array.isArray((result.data as any)["2"]) &&
          (result.data as any).labels.length === (result.data as any)["1"].length &&
          (result.data as any).labels.length === (result.data as any)["2"].length
        ) {
          // Shape: { labels: string[], "1": number[], "2": number[], total1, total2 }
          const payload = result.data as any;
          const labels: string[] = payload.labels;
          const series1: number[] = payload["1"];
          const series2: number[] = payload["2"];

          transformedData = labels.map((label: string, idx: number) => ({
            name: label,
            break_production: Number(series1[idx] ?? 0),
            overtime_prouction: Number(series2[idx] ?? 0),
          }));

          // Totals prefer provided totals; if absent, compute
          breakProductionTotal = typeof payload.total1 === "number"
            ? Number(payload.total1)
            : series1.reduce((sum: number, v: number) => sum + (Number(v) || 0), 0);
          overtimeProductionTotal = typeof payload.total2 === "number"
            ? Number(payload.total2)
            : series2.reduce((sum: number, v: number) => sum + (Number(v) || 0), 0);
        } else if (Array.isArray(result.data)) {
          transformedData = result.data.map((item: any) => {
            const breakVal = Number(item.break_production) ?? 0;
            const overtimeVal = Number(item.overtime_production ?? item.overtime_prouction) ?? 0;
            breakProductionTotal += breakVal;
            overtimeProductionTotal += overtimeVal;

            const nameField = getDrillLevelField(drillLevel);
            return {
              ...item,
              name: item[nameField] || item.zone || item.plant || item.name || "Unknown",
              break_production: breakVal,
              overtime_prouction: overtimeVal,
            } as ProductionDataItem;
          });
        } else if (typeof result.data === "object" && result.data !== null) {
          // Handle object-shaped payloads like { normal: {...}, break: {...}, overtime: {...} }
          const dataObj = result.data as any;
          const breakHours = Number(dataObj?.break?.net_hours ?? 0);
          const overtimeHours = Number(dataObj?.overtime?.net_hours ?? 0);

          breakProductionTotal = breakHours;
          overtimeProductionTotal = overtimeHours;

          transformedData = [
            {
              name: "Total",
              break_production: breakHours,
              overtime_prouction: overtimeHours,
            },
          ];
        } else {
          // Fallback to mock data when response isn't in expected shapes
          const labels = MOCK_HOURLY_PRODUCTION.labels as unknown as string[];
          const series1 = MOCK_HOURLY_PRODUCTION["1"] as unknown as number[];
          const series2 = MOCK_HOURLY_PRODUCTION["2"] as unknown as number[];

          transformedData = labels.map((label: string, idx: number) => ({
            name: label,
            break_production: Number(series1[idx] ?? 0),
            overtime_prouction: Number(series2[idx] ?? 0),
          }));

          breakProductionTotal = Number(MOCK_HOURLY_PRODUCTION.total1);
          overtimeProductionTotal = Number(MOCK_HOURLY_PRODUCTION.total2);
        }

        setChartData(transformedData);
        setTotalProduction({
          breakProduction: breakProductionTotal,
          overtimeProduction: overtimeProductionTotal,
        });
      } else {
        setChartError("No data available");
      }
    } catch (error) {
      console.error("Failed to fetch chart data:", error);
      setChartError("No data available");
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const resetFilters = async () => {
    setIsLoadingFilters(true);
    try {
      // Reset active filters
      // setActiveFilters([]);

      // Reset the selected filter values
      const resetValues = Object.keys(filterData).reduce((acc, key) => {
        acc[key] = filterData[key].includes("NULL") ? "NULL" : "";
        return acc;
      }, {} as Record<string, string>);

      setSelectedFilters(resetValues);
      // setCrossFilters([]);

      // Fetch initial filter options with no filters
      const response = await apiClient.post("/api/charts/generate_vis_data", {
          filters: [],
          action: "operations_dropdown",
          drill_state: "",
        })

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
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [drillLevel, filters, crossFilters ]);

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
          cellStartLocation: 0.2,  // Center the labels between bars
          cellEndLocation: 0.8, 
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const maxValue = Math.max(
      ...chartData.flatMap((item) => [
        item.break_production || 0, 
        item.overtime_prouction || 0
      ])
    );
    const yAxisMax = Math.ceil(maxValue * 1.1);

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0.5,
        min: 0,
        extraMax: 0.1,
        strictMinMax: false,
        renderer: am5xy.AxisRendererY.new(root, {
          pan: "zoom",
        }),
      })
    );
    
    // X-axis label configurations
    xAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      paddingBottom: 2,
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
    });
    
    yAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 5,
      paddingBottom: 0,
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    
    // Y-axis label and title
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Production Values",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0,
      })
    );

    // X-axis drill-down level label
    const getXAxisLabel = () => {
      const levels = ["Zone", "Plant"];
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
        clickTarget: "marker",
      })
    );

    // Configure legend labels
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

    // Force legend to always show series name (fixed labels)
    legend.labels.template.set("text", "{name}");

    // Series for Break Production and Overtime Production (fixed order for consistent legend)
    const metrics = [
      { field: "break_production", name: "Breakdown Hrs", color: CHART_COLORS.break_production },
      { field: "overtime_prouction", name: "Overtime Hrs", color: CHART_COLORS.overtime_prouction }
    ];
    
    const seriesList: am5xy.ColumnSeries[] = [];
    metrics.forEach((metric) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: metric.name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: metric.field,
          categoryXField: "name",
          // Keep legend fixed: show series name even when cursor hovers (no zone/category in legend)
          legendLabelText: metric.name,
          legendRangeLabelText: metric.name,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "vertical",
            labelText: `[fontSize: 8px]{name}, ${metric.name}: {valueY}[/]`,
          }),
        })
      );
      seriesList.push(series);
  
      series.columns.template.setAll({
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        strokeOpacity: 0,
        fillOpacity: 0.8,
        fill: am5.color(metric.color),
        tooltipY: 0,
        width: am5.percent(80),
        maxWidth: 50,
      });
  
      series.columns.template.events.on("click", (ev) => {
        if (drillLevel >= 1) return; // Only allow drilling to Plant level

        const dataItem = ev.target.dataItem?.dataContext as ProductionDataItem;
        if (!dataItem) return;

        const newFilter = {
          key: `"${getDrillLevelField(drillLevel)}"`,
          cond: "equals",
          value: dataItem.name as string,
        };

        setFilters((prev) => [...prev, newFilter]);
        setDrillLevel((prev) => prev + 1);
        setDrillHistory((prev) => [...prev, dataItem.name as string]);
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

    // Set legend in fixed order: Breakdown Hrs, then Overtime Hrs
    legend.data.setAll(seriesList);

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 10,
      minHeight: 10,
      start: 0,
    });
    
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    });

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      })
    );

    xAxis.data.setAll(chartData);

    return () => {
      root.dispose();
    };
  }, [chartData, isLoading]);

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
  const title = `Interruption Hrs Lost vs OT Production Hrs (in Hours)(${selectedFromDate && selectedToDate ? `${selectedFromDate} to ${selectedToDate}` : formattedDate})`;

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
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div className="flex items-center gap-1 justify-between" >
                <CardTitle className="text-xs font-bold text-gray-800 whitespace-nowrap">
                <h3>{title}</h3>
                </CardTitle>
              </div>

              <div className="flex items-center gap-2">
              <DrillStateIndicator drillLevel={drillLevel} />

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
        
          <div className="flex gap-2 text-xs font-semibold">
            <span className="text-black-600">
              Total Breakdown Hrs: 
              <span className="text-blue-600">
                {Number.isInteger(totalProduction.breakProduction) 
                  ? totalProduction.breakProduction 
                  : totalProduction.breakProduction.toFixed(2)
                }
              </span>
            </span>
            <span className="text-black-600">
              Total Overtime Hrs:
              <span className="text-blue-600">
                {Number.isInteger(totalProduction.overtimeProduction) 
                  ? totalProduction.overtimeProduction 
                  : totalProduction.overtimeProduction.toFixed(2)
                }
              </span>
            </span>
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
          {(error || (!isLoading && chartData.length === 0)) && <NoDataDisplay />}
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

export default ProductionComparisonChart;