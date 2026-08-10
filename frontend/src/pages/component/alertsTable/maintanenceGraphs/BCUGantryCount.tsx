import React, { useEffect, useRef, useState, useCallback } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Loader2, RotateCcw, CalendarIcon, Maximize2, Minimize2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

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
              minDate={fromDate}
              maxDate={dayjs()}
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

const BCUGantryCount = ({ onSelectName, apiData, refreshKey }) => {
  const rootRef = useRef(null);
  const chartDivRef = useRef(null);

  // State management
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [isExpandedchart, setIsExpandedchart] = useState(false);

  // Filter states
  const [fromDate, setFromDate] = useState(dayjs().subtract(7, "day"));
  const [toDate, setToDate] = useState(dayjs());

  // Process data from API response
  const processData = (data) => {
    // Create a map to aggregate counts by interlock_name
    const aggregatedData = new Map();
    
    // Process each item in the array
    data.forEach((item) => {
      if (item.interlock_name) {
        const interlockName = item.interlock_name;
        const count = item.count || 0;
        
        // If this interlock_name already exists, add to its count
        if (aggregatedData.has(interlockName)) {
          aggregatedData.set(interlockName, aggregatedData.get(interlockName) + count);
        } else {
          // Otherwise create a new entry
          aggregatedData.set(interlockName, count);
        }
      }
    });
    
    // Convert the map to an array of objects in the format needed for the chart
    const transformedData = Array.from(aggregatedData.entries()).map(([name, value]) => ({
      name,
      value
    }));
    
    // Sort data by value in descending order
    transformedData.sort((a, b) => b.value - a.value);
    
    return transformedData;
  };

  // Fetch and process data
  const fetchData = useCallback(async () => {
    setIsTransitioning(true);
    setError(null);
  
    try {
      // Use all data without zone/plant filtering
      return apiData;
    } catch (error) {
      console.error("Error processing data:", error);
      setError(error.message || "Failed to process data");
      return [];
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  }, [apiData]);

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

      const filteredData = await fetchData();
      const transformedData = processData(filteredData);
      setChartData(transformedData);

      if (!transformedData || transformedData.length === 0) {
        setError("No data available for the selected filters");
        return;
      }

      // Create root element
      root = am5.Root.new(chartDivRef.current);
      rootRef.current = root;
      root._logo?.dispose();

      // Set themes
      root.setThemes([am5themes_Animated.new(root)]);

      // Create chart
      const chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.verticalLayout,
          innerRadius: am5.percent(50) // This makes it a donut chart
        })
      );

      // Create series
      const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          valueField: "value",
          categoryField: "name",
          endAngle: 270
        })
      );

      // Define futuristic color set
      series.set("colors", am5.ColorSet.new(root, {
        colors: [
          am5.color(0xD32F2F), // Matte Red  
          am5.color(0xF57C00), // Matte Orange
          am5.color(0xFFA000), // Matte Amber  
          am5.color(0xFBC02D), // Matte Yellow  
          am5.color(0x388E3C), // Matte Green  
          am5.color(0x00897B), // Matte Teal  
          am5.color(0x1976D2), // Matte Blue  
          am5.color(0x303F9F), // Matte Indigo  
          am5.color(0x7B1FA2), // Matte Purple  
          am5.color(0xC2185B), // Matte Pink  
          am5.color(0x5D4037), // Matte Brown  
          am5.color(0x616161), // Matte Gray  
          am5.color(0x455A64)  // Matte Blue Gray  
        ]
      }));

      // Configure labels
      series.labels.template.setAll({
        text: "{category}: {value}",
        fontSize: 10,
        fill: am5.color(0x000000),
        textType: "radial",
        radius: 10,
        maxWidth: 130
      });

      // Configure ticks
      series.ticks.template.setAll({
        forceHidden: false,
        stroke: am5.color(0x000000),
        strokeOpacity: 0.6,
        length: 10
      });

      // Add tooltip and click handler
      series.slices.template.set("tooltipText", "{category}: {value}");
      
      // Add click handler for slices - this passes the selected name to the parent component
      series.slices.template.events.on("click", (event) => {
        const selectedName = event.target.dataItem.dataContext.name;
        
        // If the same slice is clicked again, clear the selection
        if (activeFilter === selectedName) {
          setActiveFilter(null);
          // Pass null to the parent component to clear the filter
          if (onSelectName) {
            onSelectName(null);
          }
        } else {
          // Otherwise, set the new active filter
          setActiveFilter(selectedName);
          // Pass the selected interlock_name to the parent component
          if (onSelectName) {
            onSelectName(selectedName);
          }
        }
      });

      // Configure slices
      series.slices.template.setAll({
        strokeWidth: 2,
        stroke: am5.color(0xffffff),
        cornerRadius: 5,
        cursorOverStyle: "pointer"
      });

      // Add hover effect to slices
      series.slices.template.states.create("hover", {
        scale: 1.05,
        fillOpacity: 0.9
      });

      // Add legend
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.percent(50),
          x: am5.percent(50),
          height: am5.percent(80),
          width: am5.percent(100),
          layout: isExpandedchart ? root.horizontalLayout : root.verticalLayout
        })
      );

      // Configure legend items
      legend.labels.template.setAll({
        fontSize: isExpandedchart ? 10 : 7,
        fontWeight: "400",
        fill: am5.color(0x000000),
        truncate: true,
        maxWidth: isExpandedchart ? 200 : 100
      });

      legend.valueLabels.template.setAll({
        fontSize: isExpandedchart ? 10 : 7,
        fontWeight: "400",
        fill: am5.color(0x000000)
      });

      legend.markerRectangles.template.setAll({
        cornerRadiusTL: 10,
        cornerRadiusTR: 4,
        cornerRadiusBL: 4,
        cornerRadiusBR: 10
      });

      // Apply active filter if it exists (to maintain selection state when chart is redrawn)
      if (activeFilter) {
        series.slices.each(function(slice) {
          if (slice.dataItem.dataContext.name === activeFilter) {
            slice.set("fill", slice.get("fill"));
            slice.set("stroke", am5.color(0x000000));
            slice.set("strokeWidth", 3);
          }
        });
      }

      // Set the data
      series.data.setAll(transformedData);

      // Animate chart appearance
      series.appear(1000, 100);
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

  }, [fetchData, isExpandedchart, onSelectName, refreshKey, activeFilter]);
  
  // Toggle expand/minimize
  const toggleExpand = () => {
    setIsExpandedchart(!isExpandedchart);
  };

  // Clear active filter and notify parent component
  const clearActiveFilter = () => {
    setActiveFilter(null);
    if (onSelectName) {
      onSelectName(null);
    }
  };

  // Calculate total count for the center text
  const totalCount = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <>
      {isExpandedchart && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={toggleExpand}
        />
      )}

      <Card
        className={`w-full bg-white border border-gray-200 transition-all duration-300 ${isExpandedchart ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : "h-[270px]"
          }`}
      >
        <CardHeader className="pb-0 p-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                BCU Alarm Parameter Alert Count
              </CardTitle>
              <Button
                onClick={toggleExpand}
                className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
              >
                {isExpandedchart ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent
          className={`p-0 relative ${isExpandedchart ? "h-[calc(100vh-8rem)]" : "h-[260px]"
            }`}
        >
          {isTransitioning && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}

          {error && (
            // <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-white/80 z-10">
            <div className="absolute inset-0 flex items-center justify-center text-blue-500 bg-white/80 z-10">
            <p>loading chart.....</p>
              {/* <p>Error loading chart: {error}</p> */}

            </div>
          )}

          <div
            ref={chartDivRef}
            style={{
              width: "100%",
              height: isExpandedchart ? "calc(100vh - 8rem)" : "380px",
              position: "relative"
            }}
          >
            {/* Center text showing total count */}
            {!isLoading && !isTransitioning && chartData.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "28%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1,
                  textAlign: "center",
                  pointerEvents: "none"
                }}
              >
                <div className="text-2xl font-bold">{totalCount}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
            )}
          </div>
          {/* Active filter indicator */}
          {activeFilter && (
            <div className="absolute bottom-12 left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center z-10">
              <span>Selected: {activeFilter}</span>
              <button
                className="ml-2 text-blue-600 hover:text-blue-800"
                onClick={clearActiveFilter}
              >
                ×
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default BCUGantryCount;