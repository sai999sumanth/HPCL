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
import { Loader2, RotateCcw, CalendarIcon, Maximize2, Minimize2 } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";

interface ApiDataPoint {
  sum_production: number;
  process_date: string;
}
interface LPGOPDailyProductiontrendProps {
  activeFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  crossFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  onResetFilters: () => void
}


const LPGOPDailyProductiontrend: React.FC<LPGOPDailyProductiontrendProps> = ({
  activeFilters,
  crossFilters,
  onResetFilters,
}:LPGOPDailyProductiontrendProps) => {
  const rootRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const isInitializing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Add states for filters similar to GDRejections
  const [filterData, setFilterData] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  // Update state for total production
  const [totalProduction, setTotalProduction] = useState<number>(0);

  const handleRefresh = () => {
    setIsLoading(true);
    setIsTransitioning(true);
    setError(null); // Clear error on manual refresh
    setRefreshKey(prev => prev + 1);
  };

  
  // Refresh chart with current filters
  const resetFilters = async () => {
    setIsLoadingFilters(true);
    setIsLoading(true);
    // Clear error state when resetting
    setError(null);
    // Reset the initialization guard to allow re-initialization
    isInitializing.current = false;

    try {
      // Reset date filters locally
      setFromDate(null);
      setToDate(null);

      // Fetch initial filter options
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "operations_dropdown",
          drill_state: "",
        })

      const result = response.data;
      setFilterData(result);

      // Reset selected filters
      const resetValues = Object.keys(result).reduce((acc, key) => {
        acc[key] = result[key].includes("NULL") ? "NULL" : "";
        return acc;
      }, {} as Record<string, string>);

      setSelectedFilters(resetValues);

      // Force chart to reinitialize by updating refreshKey
      setRefreshKey(prev => prev + 1);

    } catch (error) {
      console.error('Error resetting filters:', error);
      setError("Failed to reset filters");
    } finally {
      setIsLoadingFilters(false);
      setIsLoading(false);
    }
  };

  // Fetch filter options like in GDRejections
  const fetchFilterOptions = async () => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "operations_dropdown",
          drill_state: ""
        });

      const result = response.data;
      setFilterData(result);

      // Initialize filters with empty values
      const initialFilters = Object.keys(result).reduce((acc, key) => {
        acc[key] = "";
        return acc;
      }, {} as Record<string, string>);
      
      setSelectedFilters(initialFilters);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Build cross_filters for daily production: last 30 days (replace any existing DATE filter)
  const getLast30DaysFilters = (filters: typeof crossFilters) => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const dateFilter = { key: '"DATE"', cond: "equals" as const, value: `${startStr},${endStr}` };
    const withoutDate = (filters || []).filter((f) => f.key !== '"DATE"');
    return [...withoutDate, dateFilter];
  };

  // Modified fetchData to use filters and calculate total
  const fetchData = async (appliedFilters = []) => {
    setIsTransitioning(true);
    // Clear error state before fetching new data
    setError(null);

    try {
      const payload = {
        filters: [],
        cross_filters: appliedFilters,
        action: "lpg_operations_daywise_production",
        drill_state: "",
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);

      const result = response.data;

      if (result.data && result.data.length > 0) {
        // Calculate total production
        const total = result.data.reduce((sum, item) => {
          return sum + (item["sum_production"] || 0);
        }, 0);

        // Set the total production state
        setTotalProduction(total);
        // Clear any previous error
        setError(null);

        return result.data;
      } else {
        setError("No data available");
        setTotalProduction(0);
        return null;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("No data available");
      setTotalProduction(0);
      return null;
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  // Function to aggregate data by date
  const aggregateDataByDate = (data) => {
    if (!data || !Array.isArray(data)) return [];
    
    const aggregated = {};
    
    // Group and sum values by date
    data.forEach(item => {
      const date = item.process_date;
      if (!aggregated[date]) {
        aggregated[date] = 0;
      }
      aggregated[date] += item["sum_production"] || 0;
    });
    
    // Convert to array and sort by date
    return Object.keys(aggregated)
      .map(date => ({
        date,
        value: Number(aggregated[date].toFixed(2))
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Fetch filter options on component mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Initialize chart and handle data updates
  useEffect(() => {
    // Prevent concurrent initializations
    if (isInitializing.current) {
      return;
    }

    let root: am5.Root | null = null;

    const initChart = async () => {
      if (!chartDivRef.current) {
        console.error("Chart div not found");
        return;
      }

      isInitializing.current = true;

      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }

      const apiData = await fetchData(getLast30DaysFilters(crossFilters));

      if (!apiData || apiData.length === 0) {
        // If no data, still clean up and return
        setError("No data available");
        isInitializing.current = false;
        return;
      }

      // Clear error if we have data
      setError(null);

      // Aggregate data by date
      const transformedData = aggregateDataByDate(apiData);
      
      root = am5.Root.new(chartDivRef.current);
      rootRef.current = root;
      root._logo?.dispose();

      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingTop: 20,
          paddingBottom: 0, // Extra padding for date labels
          paddingRight: 20,
        })
      );

      // Process dates to ensure exact string matching; keep only last 30 days
      const processedData = transformedData
        .map(item => {
          return {
            date: item.date,
            value: item.value,
            timestamp: new Date(item.date).getTime()
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-30);
      
      // Create category axis instead of date axis to show exact date strings
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "date", // Use exact date string from API
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 1, // Force all labels to display
            cellStartLocation: 0.1,
            cellEndLocation: 0.9
          }),
          tooltip: am5.Tooltip.new(root, {}),
        })
      );
      
      // Critical settings to force display ALL categories
      xAxis.get("renderer").labels.template.setAll({
        rotation: -90,
        centerY: am5.p50,
        centerX: am5.p100,
        fontSize: 10,
        paddingTop: 10,
        paddingRight: 0,
        inside: false, // Show labels outside the axis
        oversizedBehavior: "none", // Don't hide any labels
        maxWidth: 200,
        minPosition: 0.01,
        maxPosition: 0.99,
        fill: am5.color(0x000000)
      });

      // Force showing all grid lines
      xAxis.get("renderer").grid.template.setAll({
        visible: true,
        location: 0.5
      });
      
      // Turn off label truncation
      xAxis.get("renderer").labels.template.adapters.add("text", function(text) {
        return text; // Return original text without modification
      });
      
      // Set the data for categories
      xAxis.data.setAll(processedData);

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
          min: 0,
          extraMax: 0.15, // extend scale so bullet labels above the line are not clipped
        })
      );
      
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
      });

      // Create series
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: "Productivity",
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: "value",
          categoryXField: "date",
          stroke: am5.color(0x297ab1),
          fill: am5.color(0x297ab1),
          tooltip: am5.Tooltip.new(root, {
            labelText: "[bold]{valueY}[/] MT\n{categoryX}",
            pointerOrientation: "horizontal",
            dx: 5,
          }),
        })
      );

      // Add bullets with labels
      series.bullets.push((root, series, dataItem) => {
        const container = am5.Container.new(root, {});
        const valueY = dataItem.get("valueY");
        const roundvalue = Math.round(valueY);

        const circle = container.children.push(
          am5.Circle.new(root, {
            radius: 5,
            fill: am5.color(0x297ab1),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 2,
          })
        );

        const label = container.children.push(
          am5.Label.new(root, {
            text: `${roundvalue}`,
            centerX: am5.p50,
            centerY: am5.p100,
            populateText: true,
            fontWeight: "600",
            fontSize: 10,
            fill: am5.color(0x297ab1),
            background: am5.RoundedRectangle.new(root, {
              fill: am5.color(0xffffff),
              fillOpacity: 0.8,
            }),
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 6,
            paddingRight: 6,
            dy: -8,
          })
        );

        circle.states.create("hover", {
          scale: 1.5,
        });

        return am5.Bullet.new(root, {
          sprite: container,
        });
      });

      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "zoomX",
          xAxis: xAxis,
        })
      );

      // Create scrollbar: show 20 values by default, scroll for more
      const scrollEnd = processedData.length <= 20 ? 1 : Math.min(1, 20 / processedData.length);
      const scrollbarX = am5.Scrollbar.new(root, {
        orientation: "horizontal",
        marginBottom: 15,
        height: 10,
        start: 0,
        end: scrollEnd,
      });
      
      chart.set("scrollbarX", scrollbarX);
      
      // Set data to series
      series.data.setAll(processedData);

      // Animate chart appearance
      series.appear(1000);
      chart.appear(1000, 100);

      // Chart initialization complete
      isInitializing.current = false;
    };

    const timer = setTimeout(() => {
      initChart().catch(err => {
        console.error('Error initializing chart:', err);
        isInitializing.current = false;
      });
    }, 0);

    return () => {
      clearTimeout(timer);
      isInitializing.current = false;
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [refreshKey, crossFilters]); // Added crossFilters as dependency

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

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
        <CardHeader className="pb-0 p-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <CardTitle className="text-xs font-bold text-gray-800">
                  Daily Production (MT) - Last 30 Days
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={resetFilters}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 mr-1"
                  disabled={isLoading || isLoadingFilters}
                  title="Reset All Filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                {/* Add the maximize/minimize button */}
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
            
            {/* Filter row similar to GDRejections */}
            <div className="flex items-center gap-4">
            <div className="text-xs font-semibold text-gray-800">
                  Total:{" "}
                  <span className="text-blue-600">
                    {totalProduction !== undefined && totalProduction !== null 
                      ? Number.isInteger(totalProduction / 1000) 
                        ? (totalProduction / 1000).toLocaleString() 
                        : (totalProduction / 1000).toFixed(2) 
                      : "0.00"} MT
                  </span>
                </div>
           
            </div>
          </div>
        </CardHeader>
        <CardContent 
          className={`p-0 relative ${
            isExpanded ? "h-[calc(100vh-8rem)]" : "h-[365px]"
          }`}
        >
          {isTransitioning && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                padding: '20px',
                borderRadius: '8px',
              }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}
          
          {error && <NoDataDisplay />}

          <div
            ref={chartDivRef}
            style={{
              width: "100%",
              height: isExpanded ? "calc(100vh - 8rem)" : "350px"
            }}
          />
        </CardContent>
      </Card>
    </>
  );
};

export default LPGOPDailyProductiontrend;