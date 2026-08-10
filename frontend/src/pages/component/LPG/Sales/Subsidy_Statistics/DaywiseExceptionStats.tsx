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

interface ApiDataPoint {
  Delivery_Date: string;
  ExceptionName: string;
  Refills: number;
  Financial_Year?: string;
  Month?: string;
}

interface AggregatedData {
  allDates: string[];
  seriesData: Array<{
    name: string;
    data: Array<{
      date: string;
      value: number;
      errorType: string;
    }>;
    totalCount: number; // Added total count for each series
  }>;
  grandTotal: number; // Added grand total
}

// Define filter options
const filterOptions = [
    { key: "ZOName", label: "Zone" },
    { key: "ROName", label: "Region" },
    { key: "SAName", label: "Sales Area" },
    { key: "DistributorName", label: "Distributor" },
  ];

// Date Range Picker component
const DateRangePickerFilter = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  disabled = false,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="w-7 h-6 bg-white border-gray-300 hover:bg-gray-50"
          disabled={disabled}
        >
          <CalendarIcon className="h-[13px] w-[13px] text-gray-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <div className="flex flex-col gap-2">
            <DatePicker
              label="From"
              value={fromDate}
              format="DD/MM/YYYY"
              views={["year", "month", "day"]}
              onChange={onFromDateChange}
              disabled={disabled}
              slotProps={{
                textField: {
                  size: "small",
                  className: "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                },
              }}
            />
            <DatePicker
              label="To"
              value={toDate}
              format="DD/MM/YYYY"
              views={["year", "month", "day"]}
              onChange={onToDateChange}
              disabled={disabled}
              slotProps={{
                textField: {
                  size: "small",
                  className: "h-8 text-xs [&_.MuiSvgIcon-root]:w-4 [&_.MuiSvgIcon-root]:h-4 [&_.MuiInputBase-input]:text-xs",
                },
              }}
            />
          </div>
        </LocalizationProvider>
      </PopoverContent>
    </Popover>
  );
};

const SubsidyExceptionChart: React.FC = () => {
  const rootRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalCounts, setTotalCounts] = useState({
    grandTotal: 0,
    seriesTotal: []
  });

  // Add states for filters
  const [filterData, setFilterData] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  // Add this to your state variables
  const [viewMode, setViewMode] = useState("error_code"); // Initial value is error_code

  const [crossFilters, setCrossFilters] = useState<Array<{
    key: string;
    cond: string;
    value: string;
  }>>([]);

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
    const modeValue = newMode === "Financial Year Wise" ? "financial_year" : "error_code";
    // Immediately clear the series totals when switching to error_code mode to prevent them from showing during transition
    if (modeValue === "error_code") {
      setTotalCounts(prev => ({
        ...prev,
        seriesTotal: []
      }));
    }
    setViewMode(modeValue);
    setIsLoading(true);
    setIsTransitioning(true);
    setRefreshKey(prev => prev + 1); // This will trigger data refresh
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
      });

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
      }, {} as Record<string, string>);
      
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

  // Format numbers for display
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toString();
  };

  // Fetch filter options
  const fetchFilterOptions = async () => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [],
        action: "cdcms_dropdown",
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

  // Fetch data with filters
  const fetchData = async (appliedFilters = []) => {
    setIsTransitioning(true);
    try {
      const payload = {
        filters: [],
        cross_filters: appliedFilters,
        action: "lpg_cdcms_daywise_subsidy_exception_statistics",
        drill_state: viewMode === "financial_year" ? "financial_year" : "",
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);

      const result = response.data;
      
      if (result.data) {
        return result.data;
      } else {
        setError("No data available");
        return null;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("No data available");
      return null;
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  // Group data by payment error type and date
  // Update this function to handle both data formats
  const aggregateDataByErrorType = (data: any[] | null): AggregatedData | null => {
    if (!data || !Array.isArray(data)) return null;
    
    if (viewMode === "financial_year") {
      // Handle financial year data format
      // Group data by month and financial year
      const groupedByFY: Record<string, Record<string, number>> = {};
      let grandTotal = 0;
      
      data.forEach(item => {
        const financialYear = item.Financial_Year || "Unknown";
        
        if (!groupedByFY[financialYear]) {
          groupedByFY[financialYear] = {};
        }
        
        const month = item.Month;
        const refills = item.Refills || 0;
        groupedByFY[financialYear][month] = refills;
        grandTotal += refills;
      });
      
      // Get all unique months
      const allMonths = [...new Set(data.map(item => item.Month))].sort();
      
      // Create series data for each financial year
      const seriesData = [];
      
      Object.keys(groupedByFY).forEach(fy => {
        const fyData = [];
        let totalCount = 0;
        
        allMonths.forEach(month => {
          const value = groupedByFY[fy][month] || 0;
          totalCount += value;
          fyData.push({
            date: month,
            value: value,
            errorType: fy
          });
        });
        
        seriesData.push({
          name: fy,
          data: fyData,
          totalCount: totalCount
        });
      });
      
      // Update total counts state
      setTotalCounts({
        grandTotal: grandTotal,
        seriesTotal: seriesData.map(series => ({
          name: series.name,
          total: series.totalCount
        }))
      });
      
      return {
        allDates: allMonths,
        seriesData,
        grandTotal
      };
    } else {
      // Original error code wise logic
      // Group data by payment error type
      const groupedByError: Record<string, Record<string, number>> = {};
      let grandTotal = 0;
      
      data.forEach(item => {
        // Make sure we have valid error names - replace null or empty with "Unknown"
        const errorName = item.ExceptionName ? item.ExceptionName.trim() : "Unknown";
        
        if (!groupedByError[errorName]) {
          groupedByError[errorName] = {};
        }
        
        const date = item.Delivery_Date;
        const refills = item.Refills || 0;
        groupedByError[errorName][date] = refills;
        grandTotal += refills;
      });
      
      // Get all unique dates from data
      const allDates = [...new Set(data.map(item => item.Delivery_Date))].sort();
      
      // Create series data for each error type
      const seriesData = [];
      
      Object.keys(groupedByError).forEach(errorName => {
        const errorData = [];
        let totalCount = 0;
        
        allDates.forEach(date => {
          const value = groupedByError[errorName][date] || 0;
          totalCount += value;
          errorData.push({
            date: date,
            value: value,
            errorType: errorName
          });
        });
        
        seriesData.push({
          name: errorName,
          data: errorData,
          totalCount: totalCount
        });
      });
      
      // Update total counts state
      setTotalCounts({
        grandTotal: grandTotal,
        seriesTotal: seriesData.map(series => ({
          name: series.name,
          total: series.totalCount
        }))
      });
      
      return {
        allDates,
        seriesData,
        grandTotal
      };
    }
  };
  
  // Fetch filter options on component mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Initialize chart and handle data updates
  useEffect(() => {
    let root: am5.Root | null = null;

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

      // Prepare data for the chart
      const aggregatedData = aggregateDataByErrorType(apiData);
      if (!aggregatedData) return;
      
      root = am5.Root.new(chartDivRef.current);
      rootRef.current = root;
      root._logo?.dispose();

      root.setThemes([am5themes_Animated.new(root)]);

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
            cellEndLocation: 0.9
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
        dy:-50
      })

      // Force showing all grid lines
      xAxis.get("renderer").grid.template.setAll({
        visible: true,
        location: 0.5
      });
      
      // Set the categories (dates)
      xAxis.data.setAll(aggregatedData.allDates.map(date => ({ date })));

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
        am5.color(0x297ab1), // Blue
        am5.color(0xd9480f), // Orange
        am5.color(0x5c940d), // Green
        am5.color(0x9c36b5), // Purple
        am5.color(0xe03131), // Red
        am5.color(0x3b5bdb), // Indigo
        am5.color(0x0b7285), // Teal
        am5.color(0x5f3dc4), // Violet
        am5.color(0xf59f00), // Yellow
        am5.color(0x1864ab), // Dark Blue
        am5.color(0x74b816), // Lime Green
        am5.color(0xc2255c), // Pink
        am5.color(0x862e9c)  // Deep Purple
      ];

            // Create a tooltip that will be used for all bullets
      const sharedBulletTooltip = am5.Tooltip.new(root, {
        pointerOrientation: "horizontal",
        labelText: "[fontSize:10px bold]{name}[/]: [fontSize:10px bold]{valueY} [fontSize:10px bold]Refills,{categoryX}"
      });
      

      // Create a series for each payment error type
      aggregatedData.seriesData.forEach((seriesItem, index) => {
        // Create series
        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: seriesItem.name,
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "value",
            categoryXField: "date",
            stroke: colors[index % colors.length],
            fill: colors[index % colors.length],
          })
        );

        // Add bullets with labels
        series.bullets.push((root, series, dataItem) => {
          const container = am5.Container.new(root, {});
          const valueY = dataItem.get("valueY");
          
          const circle = container.children.push(
            am5.Circle.new(root, {
              radius: 5,
              fill: colors[index % colors.length],
              stroke: root.interfaceColors.get("background"),
              strokeWidth: 2,
              // Each bullet gets its own tooltip instance
              tooltip: am5.Tooltip.new(root, {
                pointerOrientation: "horizontal",
                labelText:
                  "[fontSize:10px bold]{name}[/]: [fontSize:10px bold]{valueY} [fontSize:10px bold]Refills,{categoryX}",
              }),
            })
          );

          // Make tooltip text reference the series data
          circle.adapters.add("tooltipText", function () {
            return (
              "[fontSize:10px bold]" +
              seriesItem.name +
              "[/]: [fontSize:10px bold]" +
              valueY +
              " [fontSize:10px bold]Refills," +
              dataItem.get("categoryX")
            );
          });

          const label = container.children.push(
            am5.Label.new(root, {
              text: `${valueY}`,
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

          circle.states.create("hover", {
            scale: 1.5,
          });

          return am5.Bullet.new(root, {
            sprite: container,
          });
        });

        // Set data to series
        series.data.setAll(seriesItem.data);
        series.appear(1000);
      });

      // Create legend for different payment error types
      const legend = chart.children.unshift(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          marginTop: 0,
          marginBottom: 0,
          useDefaultMarker: true

        })
      );
      
      legend.markers.template.setAll({
        width: 16,
        height: 2
      });
      legend.data.setAll(chart.series.values);
      legend.labels.template.setAll({
        fontSize: 10,
        fontWeight: "400"
      });

      chart.set(
        "cursor",
        am5xy.XYCursor.new(root, {
          behavior: "zoomX",
          xAxis: xAxis
        })
      );

      // Make sure cursor can interact with bullets
      chart.plotContainer.set("interactive", true);

      // Create scrollbar
      const scrollbarX = am5.Scrollbar.new(root, {
        orientation: "horizontal",
        marginBottom: 15,
        height: 10,
        start: 0,
        end: 1
      });
      
      chart.set("scrollbarX", scrollbarX);
      
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
                Day Wise Subsidy Exception Statistics
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
            
            {/* Total counts display section with loader */}
            <div className="flex gap-4 text-xs font-semibold">
              {isTransitioning ? (
                <div className="flex items-center">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600 mr-2" />
                  <span>Loading totals...</span>
                </div>
              ) : (
                <>
                  <span className="text-black-600">
                    Total Refills: 
                    <span className="text-blue-600 ml-1">
                      {formatNumber(totalCounts.grandTotal)}
                    </span>
                  </span>
                  {/* Only show individual totals in financial year view */}
                  {viewMode === "financial_year" && totalCounts.seriesTotal.map((series, index) => (
                    <span key={index} className="text-black-600">
                      {series.name}: 
                      <span className="text-blue-600 ml-1">
                        {formatNumber(series.total)}
                      </span>
                    </span>
                  ))}
                </>
              )}
            </div>
              
            {/* Filter row */}
            <div className="flex items-center gap-4">
              <DateRangePickerFilter
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={(date) => handleDateChange('from', date)}
                onToDateChange={(date) => handleDateChange('to', date)}
                disabled={isLoadingFilters || isLoading}
              />
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
                <FilterDropdown
                    key="viewMode"
                    label="View"
                    options={["Error Code Wise", "Financial Year Wise"]}
                    value={viewMode === "error_code" ? "Error Code Wise" : "Financial Year Wise"}
                    onChange={(value) => handleViewModeChange(value)}
                    isLoading={isLoadingFilters || isLoading}
                 />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent 
          className={`p-0 relative ${
            isExpanded ? "h-[calc(100vh-8rem)]" : "h-[565px]"
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
          
          {(error || (!isLoading && !rootRef.current)) && <NoDataDisplay />}

          <div
            ref={chartDivRef}
            style={{ 
              width: "100%", 
              height: isExpanded ? "calc(100vh - 8rem)" : "550px" 
            }}
          />
        </CardContent>
      </Card>
    </>
  );
};

export default SubsidyExceptionChart;