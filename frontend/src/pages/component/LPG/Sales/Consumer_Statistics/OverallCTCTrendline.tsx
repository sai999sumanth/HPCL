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
import { FilterDropdown } from "../../Sales/FilterDropdown";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";

// Define filter options
const filterOptions = [ 
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" }
];

// Date Range Picker component


const OverallCTCTrendline = () => {
  const rootRef = useRef(null);
  const chartDivRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Add states for filters
  const [filterData, setFilterData] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [viewMode, setViewMode] = useState("monthly");
  
  const [crossFilters, setCrossFilters] = useState([]);

  const handleRefresh = () => {
    setIsLoading(true);
    setIsTransitioning(true);
    setRefreshKey(prev => prev + 1);
  };

  // Date change handler
  const handleDateChange = (type, newDate) => {
    if (type === 'from') {
      setFromDate(newDate);
    } else {
      setToDate(newDate);
    }

    if (newDate && (type === 'from' ? toDate : fromDate)) {
      const start = type === 'from' ? newDate : fromDate;
      const end = type === 'from' ? toDate : newDate;

      const formatDate = (date) => {
        return date.format('YYYY-MM-DD');
      };

      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(start)},${formatDate(end)}`
      };

      setActiveFilters(prevFilters => {
        const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });

      setCrossFilters(prevFilters => {
        const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });
    }
  };

  const handleViewModeChange = (newMode) => {
    setViewMode(newMode);
    setIsLoading(true);
    setIsTransitioning(true);
    setRefreshKey(prev => prev + 1);
  };

  // Filter change handler
  const handleFilterChange = async (key, value) => {
    setIsLoadingFilters(true);
    try {
      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: value
      };
      setSelectedFilters(updatedSelectedFilters);

      const newFilter = {
        key: `"${key}"`,
        cond: "equals",
        value: value
      };

      let updatedFilters = [...activeFilters];
      const existingFilterIndex = updatedFilters.findIndex(f => f.key === `"${key}"`);

      if (value === "NULL") {
        updatedFilters = updatedFilters.filter(f => f.key !== `"${key}"`);
      } else if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }

      setActiveFilters(updatedFilters);
      setCrossFilters(updatedFilters);
      
      // Update the chart with new filters
      fetchData(updatedFilters);
    } catch (error) {
      console.error('Error updating filters:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Reset filters function
  const resetFilters = async () => {
    setIsLoadingFilters(true);
    
    try {
      // Fetch initial filter options
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [],
        action: "cdcms_dropdown",
        drill_state: "",
      })

      const result = response.data;
      setFilterData(result);
      
      // Reset date filters
      setFromDate(null);
      setToDate(null);
      
      // Reset active filters to empty
      setActiveFilters([]);
      
      // Reset selected filters
      const resetValues = Object.keys(result).reduce((acc, key) => {
        acc[key] = result[key].includes("NULL") ? "NULL" : "";
        return acc;
      }, {});
      
      setSelectedFilters(resetValues);
      setCrossFilters([]);
      
      // Fetch data with reset filters
      fetchData([]);
      
    } catch (error) {
      console.error('Error resetting filters:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Fetch filter options
  const fetchFilterOptions = async () => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [],
        action: "cdcms_dropdown",
        drill_state: ""
      })

      const result = response.data;
      setFilterData(result);

      // Initialize filters with empty values
      const initialFilters = Object.keys(result).reduce((acc, key) => {
        acc[key] = "";
        return acc;
      }, {});
      
      setSelectedFilters(initialFilters);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Fetch data with filters
  const fetchData = async (appliedFilters = []) => {
    setIsTransitioning(true);
    try {
      const payload = {
        filters: [],
        cross_filters: appliedFilters,
        action: "lpg_cdcms_daywise_overall_ctc_statistics",
        drill_state: viewMode === "yearly" ? "financial_year" : "",
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
      
      const result = response.data;
      
      if (result.data) {
        return result.data;
      } else {
        setError("No data returned from API");
        return null;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
      return null;
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  // Process CTC data for the chart
  const processCTCData = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    // Prepare data structure for trend line chart
    const allMonths = [...new Set(data.map(item => item.Month.trim()))].sort();
    
    // Create series data for each CTC type
    const seriesData = [
      {
        name: "ACTC",
        data: []
      },
      {
        name: "BCTC",
        data: []
      },
      {
        name: "NCTC",
        data: []
      }
    ];
    
    // Populate series data
    allMonths.forEach(month => {
      const monthData = data.find(item => item.Month.trim() === month);
      
      if (monthData) {
        seriesData[0].data.push({
          date: month,
          value: monthData.ACTC,
          ctcType: "ACTC"
        });
        
        seriesData[1].data.push({
          date: month,
          value: monthData.BCTC,
          ctcType: "BCTC"
        });
        
        seriesData[2].data.push({
          date: month,
          value: monthData.NCTC,
          ctcType: "NCTC"
        });
      }
    });
    
    return {
      allMonths,
      seriesData
    };
  };

  // Fetch filter options on component mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Initialize chart and handle data updates
  useEffect(() => {
    let root = null;

    const initChart = async () => {
      if (!chartDivRef.current) {
        console.error("Chart div not found");
        return;
      }

      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }

      const apiData = await fetchData(crossFilters);
      if (!apiData) return;

      // Process data for the chart
      const processedData = processCTCData(apiData);
      if (!processedData) return;

      // Create root element
      root = am5.Root.new(chartDivRef.current);
      rootRef.current = root;
      root._logo?.dispose();

      // Set themes
      root.setThemes([am5themes_Animated.new(root)]);

      // Create chart
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "panX",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingBottom: 0,
          paddingRight: 20,
        })
      );

      // Create category axis for dates
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "date",
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 1,
            cellStartLocation: 0.1,
            cellEndLocation: 0.9,
          }),
          tooltip: am5.Tooltip.new(root, {}),
        })
      );

      // Set axis label styling
      xAxis.get("renderer").labels.template.setAll({
        rotation: -90,
        centerY: am5.p50,
        centerX: am5.p100,
        fontSize: 10,
        marginTop: 10,
        inside: false,
        oversizedBehavior: "none",
        maxWidth: 200,
        minPosition: 0.01,
        maxPosition: 0.99,
        fill: am5.color(0x000000),
        dy: -40
      });

      // Force showing all grid lines
      xAxis.get("renderer").grid.template.setAll({
        visible: true,
        location: 0.5,
      });

      // Set the categories (dates)
      xAxis.data.setAll(processedData.allMonths.map((date) => ({ date })));

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
          min: 0,
        })
      );

      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
      });

      // Define colors for different series
      const colors = [
        am5.color(0x297ab1), // blue for ACTC
        am5.color(0x5c940d), // green for BCTC
        am5.color(0xd9480f), // orange for NCTC
      ];

      // Create a series for each CTC type
      processedData.seriesData.forEach((seriesItem, index) => {
        // Create series
        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: seriesItem.name,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "value",
            categoryXField: "date",
            stroke: colors[index % colors.length],
            fill: colors[index % colors.length]
          })
        );
        
        // Add bullets with tooltips
        series.bullets.push((root, series, dataItem) => {
          const container = am5.Container.new(root, {});
          const valueY = dataItem.get("valueY");
    
          // Create the circle with tooltip
          const circle = container.children.push(
            am5.Circle.new(root, {
              radius: 5,
              fill: colors[index % colors.length],
              stroke: root.interfaceColors.get("background"),
              strokeWidth: 2,
              tooltip: am5.Tooltip.new(root, {
                pointerOrientation: "horizontal",
                labelText: "[fontSize:10px bold]{name}[/]: [fontSize:10px bold]{valueY} [fontSize:10px bold],{categoryX}"
              })
            })
          );
    
          // Make tooltip text reference the series data
          circle.adapters.add("tooltipText", function() {
            return "[fontSize:10px bold]" + seriesItem.name + "[/]: [fontSize:10px bold]" + valueY + "[fontSize:10px bold],{categoryX}";
          });
    
          // Add value label above bullet
          const label = container.children.push(
            am5.Label.new(root, {
              text: `${valueY.toLocaleString()}`,
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontWeight: "600",
              fontSize: 10,
              fill: colors[index % colors.length],
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
    
          // Add hover effect
          circle.states.create("hover", {
            scale: 1.5,
          });
    
          return am5.Bullet.new(root, {
            sprite: container
          });
        });
    
        // Set data to series
        series.data.setAll(seriesItem.data);
        series.appear(1000);
      });

      // Add legend
      const legend = chart.children.unshift(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          marginTop: 0,
          marginBottom: 0,
          useDefaultMarker: true
        })
      );
      
      // Style legend markers
      legend.markers.template.setAll({
        width: 16,
        height: 2
      });
      
      legend.data.setAll(chart.series.values);
      legend.labels.template.setAll({
        fontSize: 10,
        fontWeight: "400"
      });

      // Add cursor
      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "zoomX",
          xAxis: xAxis
        })
      );

      // Make chart interactive
      chart.plotContainer.set("interactive", true);

    //   // Create scrollbar
    //   const scrollbarX = am5.Scrollbar.new(root, {
    //     orientation: "horizontal",
    //     marginBottom: 15,
    //     height: 10,
    //     start: 0,
    //     end: 1,
    //   });

    //   chart.set("scrollbarX", scrollbarX);

      // Animate chart appearance
      chart.appear(1000, 100);
    };

    const timer = setTimeout(() => {
      initChart();
    }, 0);

    return () => {
      clearTimeout(timer);
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [refreshKey, crossFilters, viewMode]);

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
              <CardTitle className="text-xs font-bold text-gray-800">
                Overall CTC Statistics Trend Line
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={resetFilters}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 mr-1"
                  disabled={isLoading || isLoadingFilters}
                  title="Reset All Filters"
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
            
            {/* Filter row */}
            <div className="flex items-center gap-4">
            
              <div className="grid grid-cols-5 gap-1">
                {filterOptions.map(({ key, label }) => { 
                  const cleanedOptions = (filterData[key] || [])
                    .filter(option => option !== null && option !== "")
                    .sort();

                  return (
                    <FilterDropdown
                      key={key}
                      label={label}
                      options={cleanedOptions}
                      value={selectedFilters[key] || ""}
                      onChange={(value) => handleFilterChange(key, value)}
                      isLoading={isLoadingFilters || isLoading}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent 
          className={`p-0 relative ${
            isExpanded ? "h-[calc(100vh-8rem)]" : "h-[375px]"
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
          
          {error && (
            <NoDataDisplay/>
          )}

          <div
            ref={chartDivRef}
            style={{ 
              width: "100%", 
              height: "100%" 
            }}
          />
          
        </CardContent>
      </Card>
    </>
  );
};

export default OverallCTCTrendline;