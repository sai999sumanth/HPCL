import React, { useEffect, useRef, useState } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { ArrowLeft, RotateCcw, Loader2, Maximize2, Minimize2 } from "lucide-react"
import { FilterDropdown } from "../../Sales/FilterDropdown"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover"
import useCurrentDate from "@/hooks/useCurrentdate"
import { apiClient } from "@/services/apiClient"
import NoDataDisplay from "@/components/common/NoDataDisplay"

interface ChartDataItem {
  zone: string;
  name: string;
  value: number;
  drillDown: boolean;
}

interface ApiResponse {
  status: boolean
  message: string
  data:
  | {
    zone: { [key: string]: string }
    Cylinder_Filled: { [key: string]: number }
  }
  | Array<{
    zone: string
    plant: string
    process_date: string
    Cylinder_Filled: number
  }>
}

interface DrilldownState {
  level: "zone" | "plant"
  filters: Array<{
    key: string
    cond: string
    value: string
  }>
}

interface FilterOption {
  key: string
  label: string
}
interface LPGFilledCylinderProps {
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

const filterOptions: FilterOption[] = [
  { key: "zone", label: "Zone" },
  { key: "plant", label: "Plant" }, 
// { key: "DistributorName", label: "Distributor" },
  // { key: "CylType", label: "Cylinder Type" },
]
const DrillStateIndicator = ({ drillLevel }: { drillLevel: DrilldownState["level"] }) => {
  const states = ["zone", "plant"]
  const currentIndex = states.indexOf(drillLevel)

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{drillLevel}</span>
      <div className="flex gap-1">
        {states.map((state, index) => (
          <div
            key={state}
            className={`w-2 h-2 rounded-full ${index === currentIndex ? "bg-blue-600" : "bg-gray-300"}`}
          />
        ))}
      </div>
    </div>
  )
}
const LPGFilledCylinder = ({
  activeFilters,
  crossFilters,
  onResetFilters,
  selectedFromDate,
  selectedToDate,
}:LPGFilledCylinderProps) => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    level: "zone",
    filters: [],
  })
  const [drillHistory, setDrillHistory] = useState<string[]>([])
  const chartRef = useRef<am5.Root | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const [filterData, setFilterData] = useState<Record<string, string[]>>({})
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({})
  const [isLoadingFilters, setIsLoadingFilters] = useState(true)
  const [fromDate, setFromDate] = useState();
  const [toDate, setToDate] = useState(); 
  const { formattedDate } = useCurrentDate(); 
  const [isExpanded, setIsExpanded] = useState(false);
  // Add state for total production
  const [totalProduction, setTotalProduction] = useState<number>(0);
    const hasInitialized = useRef(false);



  const handleBackClick = async () => {
    if (drilldownState.filters.length > 0) {
      setIsTransitioning(true);
      const newFilters = [...drilldownState.filters];
      newFilters.pop();

      const levels: DrilldownState["level"][] = ["zone", "plant"]
      const newLevel = levels[newFilters.length] || "zone"

      setDrilldownState({
        level: newLevel,
        filters: newFilters
      });
      setDrillHistory(prev => prev.slice(0, -1));
      
      // Fetch data for the new drilldown level
      // We need to wait for state to update or pass the level directly
      fetchData(newFilters, crossFilters, newLevel);
    }
  };


  const handleDrillDown = async (dataItem: ChartDataItem) => {
    if (!dataItem?.drillDown) return;

    setIsTransitioning(true);
    const newFilters = [...drilldownState.filters];

    const drillLevels = {
      zone: {
        next: 'plant',
        key: '"zone"'
      },
      plant: {
        next: 'process_date',
        key: '"Plant"'
      },

    };

    const currentLevel = drillLevels[drilldownState.level];

    if (currentLevel) {
      newFilters.push({
        key: currentLevel.key,
        cond: "equals",
        value: dataItem.zone
      });

      setDrilldownState({
        level: currentLevel.next as DrilldownState['level'],
        filters: newFilters
      });

      setDrillHistory(prev => [...prev, dataItem.zone]);
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
      // setActiveFilters(prevFilters => {
      //   const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
      //   return [...filtersWithoutDate, dateFilter];
      // });

      // // Update cross filters similarly
      // setCrossFilters(prevFilters => {
      //   const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
      //   return [...filtersWithoutDate, dateFilter];
      // });
    }
  };
  const fetchFilterOptions = async (skipIfExists = false) => {
    // Skip if filter data already exists and skipIfExists is true
    if (skipIfExists && Object.keys(filterData).length > 0) {
      return;
    }
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "operations_dropdown",
          drill_state: drilldownState.level
        });

      const result = response.data;
      setFilterData(result);

      // Initialize filter selections
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


  const resetFilters = async () => {
    setIsLoadingFilters(true);
    setIsTransitioning(true);

    try {
      // Reset selections to empty
      const resetValues = Object.keys(filterData).reduce((acc, key) => {
        acc[key] = "";
        return acc;
      }, {} as Record<string, string>);
      setSelectedFilters(resetValues);

      // Reset drilldown state
      setDrilldownState({
        level: 'zone',
        filters: []
      });
      setDrillHistory([]);

      // Only fetch chart data - dropdown data doesn't need to be refetched
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [],
        cross_filters: [],
        action: "lpg_operations_filled_cylinder",
        drill_state: ""
      });

      const result = response.data;
      console.log('Reset filters API response:', result);
      if (result.status && result.data) {
        const transformedData = transformData(result.data, 'zone'); // Pass the reset level
        console.log('Transformed data for reset:', transformedData);
        setChartData(transformedData);
        setError(null); // Clear any previous errors
      } else {
        setChartData([]);
        setError('No data available');
      }


    } catch (error) {
      console.error('Error resetting everything:', error);
      setError('Error resetting filters');
    } finally {
      setIsLoadingFilters(false);
      setIsTransitioning(false);
    }
  };


  const transformData = (data: ApiResponse['data'], currentLevel: string = drilldownState.level): ChartDataItem[] => {
    if (!Array.isArray(data) && currentLevel === 'zone') {
      return Object.keys(data.zone).map(key => ({
        zone: data.zone[key],
        name: data.zone[key], // Add name property
        value: parseFloat(data.Cylinder_Filled[key].toString()),
        drillDown: true
      }));
    }

    if (!Array.isArray(data)) return [];

    const groupByField = {
      zone: 'zone',
      plant: 'plant',
      process_date: 'process_date',
    }[currentLevel];

    if (!groupByField) return [];

    const groupedData: { [key: string]: number } = {};
    data.forEach(item => {
      const key = item[groupByField as keyof typeof item];
      if (typeof key === 'string') {
        if (!groupedData[key]) {
          groupedData[key] = 0;
        }
        groupedData[key] += parseFloat(item.Cylinder_Filled.toString());
      }
    });

    return Object.entries(groupedData).map(([key, value]) => ({
      zone: key,
      name: key, // Add name property
      value,
      drillDown: currentLevel !== 'plant',
    }));
  };


  const fetchData = async (filters: DrilldownState['filters'], crossFilters: any[], level?: string) => {
    try {
      console.log('Fetching data with filters:', filters, 'and crossFilters:', crossFilters);
      setIsTransitioning(true);

      const payload = {
        filters,
        cross_filters: crossFilters,
        action: "lpg_operations_filled_cylinder",
        drill_state: ""
      };

      const response = await apiClient.post('/api/charts/generate_vis_data', payload);

      const result = response.data;
      console.log('API response:', result);

      if (result.status && result.data) {
        const transformedData = transformData(result.data, level || drilldownState.level);
        console.log('Transformed data:', transformedData);
        setChartData(transformedData);
        setError(null); // Clear any previous errors
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('No data available');
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  // Calculate total production whenever chartData changes
  useEffect(() => {
    if (chartData.length > 0) {
      const total = chartData.reduce((sum, item) => sum + item.value, 0);
      setTotalProduction(total);
    } else {
      setTotalProduction(0);
    }
  }, [chartData]);
  useEffect(() => {
        if (hasInitialized.current) return;

    const initializeData = async () => {
      hasInitialized.current = true;
      setIsLoading(true);
      try {
        // Fetch filter options and chart data in parallel
        await Promise.all([
          fetchFilterOptions(),
          fetchData(drilldownState.filters, crossFilters)
        ]);
      } catch (error) {
        console.error('Error initializing data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeData();
  }, []); 


  useEffect(() => {
    if (!hasInitialized.current) return;

    if (drilldownState.filters.length > 0) {
      fetchData(drilldownState.filters, crossFilters);
    }
  }, [drilldownState.filters]);

  // Refetch when zone/plant filters from the page change
  useEffect(() => {
    if (!hasInitialized.current) return;
    fetchData(drilldownState.filters, crossFilters);
  }, [crossFilters]);


  // Chart creation effect
  useEffect(() => {
    console.log('Chart effect triggered with:', { chartData, isLoading, drilldownState });
    if (!chartData.length || isLoading || !chartDivRef.current) return

    // Dispose of the previous chart instance
    if (chartRef.current) {
      chartRef.current.dispose()
    }

    const root = am5.Root.new(chartDivRef.current)
    chartRef.current = root

    root.setThemes([am5themes_Animated.new(root)])

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "none",
        pinchZoomX: true,
        paddingBottom: 30,
        paddingRight: 20,
        paddingLeft: 20,
      }),
    )

    root._logo?.dispose()

    // // Add legend before the chart title
    // const legend = chart.children.unshift(
    // am5.Legend.new(root, {
    // centerX: am5.p50,
    // x: am5.p50,
    // marginBottom: 20,
    // layout: root.horizontalLayout,
    // height: 40,

    // })
    // );
    // const getLegendLabels = () => {
    // switch(drilldownState.level) {
    // case 'month':
    // return "Monthly Sales";
    // case 'zone':
    // return "Zone-wise Sales";
    // case 'region':
    // return "Region-wise Sales";
    // case 'salesarea':
    // return "Sales Area-wise Sales";
    // case 'distributor':
    // return "Distributor-wise Sales";
    // default:
    // return "Sales";
    // }
    // };

    const getXAxisLabel = () => {
      const labelMap = {
        month: "Month",
        zone: "Zone",
        plant:"Plant",
        region: "Region",
        salesarea: "Sales Area",
        distributor: "Distributor Name",
      }
      return labelMap[drilldownState.level] || "Time Period"
    }

    // Calculate maximum value for y-axis
    const maxValue = Math.max(...chartData.map((item) => item.value))
    const yAxisMax = Math.ceil(maxValue * 1.2)
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "zone",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 30,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      }),
    )
    // Add X-axis title with dynamic label
    xAxis.children.push(
      am5.Label.new(root, {
        text: getXAxisLabel(),
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        paddingBottom: -10,
        fontSize: 10,
      }),
    )

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0.5,
        min: 0,
        max: yAxisMax,
        renderer: am5xy.AxisRendererY.new(root, {
          pan: "zoom",
        }),
      }),
    )

    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Cylinder Filled",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 0,
      }),
    )

    xAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      paddingTop: 8,
      paddingBottom: 2,
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    })
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "truncate",
      textAlign: "center",
    })
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Sales",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "zone",
        tooltip: am5.Tooltip.new(root, {
          labelText: "[bold fontSize: 8px]{categoryX}[/]\n[fontSize: 8px]Cylinder Filled: [bold fontSize: 8px]{valueY}[/]",
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
      }),
    )

    // Add value labels on top of columns
    series.bullets.push(() =>
      am5.Bullet.new(root, {
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
      }),
    )

    // Add click handler for drill-down
    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem?.dataContext as ChartDataItem
      handleDrillDown(dataItem)
    })

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
      ]

      const dataContext = target.dataItem?.dataContext as { zone: string; value: number }
      const index = chartData.findIndex((item) => item.zone === dataContext?.zone)
      return colors[index % colors.length]
    })

    // Set custom stroke colors
    series.columns.template.adapters.add("stroke", (stroke, target) => {
      const colors = [
        am5.color(0xd94769),
        am5.color(0x282f64),
        am5.color(0x5b3474),
        am5.color(0x8a3679),
        am5.color(0xb63a76),
        am5.color(0xd94769),
      ]

      const dataContext = target.dataItem?.dataContext as { zone: string; value: number }
      const index = chartData.findIndex((item) => item.zone === dataContext?.zone)
      return colors[index % colors.length]
    })

    // Set column appearance
    series.columns.template.setAll({
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      strokeOpacity: 0,
      cursorOverStyle: "pointer",
      tooltipY: 0,
      width: am5.percent(30),
      maxWidth: 50,
      tooltipPosition: "pointer",
      interactive: true,
    })

    // Improved tooltip handling
    series.columns.template.events.on("pointerover", (ev) => {
      const column = ev.target
      column.showTooltip()
      column.set("tooltipX", am5.percent(50))
      column.set("tooltipY", 0)
    })

    series.columns.template.events.on("pointerout", (ev) => {
      const column = ev.target
      column.hideTooltip()
    })

    // Add hover state
    series.columns.template.states.create("hover", {
      fillOpacity: 0.8,
      strokeOpacity: 0.4,
      stroke: am5.color(0x000000),
      scale: 1.02,
    })

    // Add scrollbar with custom styling
    const maxVisibleBars = drilldownState.level === 'plant' ? 4 : 10;
    const visibleEnd = chartData.length > maxVisibleBars ? maxVisibleBars / chartData.length : 1;
    xAxis.set("start", 0);
    xAxis.set("end", visibleEnd);

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 8,
      minHeight: 10,
      start: 0,
      end: visibleEnd,
    })
    chart.set("scrollbarX", scrollbarX)
    chart.bottomAxesContainer.children.push(scrollbarX)

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true,
    })

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis,
      }),
    )
    chart.bottomAxesContainer

    // // Add legend with improved positioning
    // chart.children.push(am5.Legend.new(root, {
    // centerX: am5.p50,
    // x: am5.p50,
    // marginTop: 15,
    // marginBottom: 0
    // }));

    // legend.data.setAll([series]);

    // Set data and animate
    xAxis.data.setAll(chartData)
    series.data.setAll(chartData)

    series.appear(1000)
    chart.appear(1000, 100)

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose()
      }
    }
  }, [chartData, isLoading, drilldownState.level])

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">Loading {drilldownState.level} data...</span>
      </div>
    </div>
  )

  if (isLoading && !isTransitioning) {
    return (
      <Card className="w-full h-[500px] bg-white border border-gray-200">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        </CardContent>
      </Card>
    )
  }

  const title = `Production ( No. of Cyl in lakhs) (${selectedFromDate && selectedToDate ? `${selectedFromDate} to ${selectedToDate}` : formattedDate})`;

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
        <CardHeader className="pb-0 p-1">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800 flex">
              <h3>{title}</h3>
              </CardTitle>

              <div className="flex items-center gap-4">
                <DrillStateIndicator drillLevel={drilldownState.level} />
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
            </div>
            <div className="flex items-center gap-4">
            <div className="text-xs font-semibold text-gray-800">
                  Total: {" "}
                  <span className="text-blue-600">
                    {totalProduction !== undefined && totalProduction !== null
                      ? Number.isInteger(totalProduction)
                        ? totalProduction.toLocaleString()
                        : Number(totalProduction).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              {/* <DateRangePickerFilter
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={(date) => handleDateChange('from', date)}
                onToDateChange={(date) => handleDateChange('to', date)}
                disabled={isLoadingFilters}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-1">
                {filterOptions.map(({ key, label }) => {
                  // Filter out null values and empty strings from options array
                  const cleanedOptions = (filterData[key] || [])
                    .filter(option => option !== null && option !== "")
                    .sort();

                  return (
                    <FilterDropdown
                      key={key}
                      label={label}
                      options={cleanedOptions}  // Pass the cleaned options instead
                      value={selectedFilters[key] || ""}
                      onChange={(value) => handleFilterChange(key, value)}
                      isLoading={isLoadingFilters}
                    />
                  );
                })}
              </div> */}
            </div>
          </div>
        </CardHeader>
        <CardContent 
          className={`p-0 relative pt-0 ${
            isExpanded ? "h-[calc(100vh-8rem)]" : "h-[290px]"
          }`}
        >
          {drillHistory.length > 0 && (
            <div className="text-gray-600 p-1 text-xs">Drill Path: {drillHistory.join(" → ")}</div>
          )}
          {(!!error || (!isLoading && !isTransitioning && chartData.length === 0 && hasInitialized.current)) && <NoDataDisplay />}
          {isTransitioning && <LoadingOverlay />}
          <div 
            ref={chartDivRef} 
            id="chartdiv" 
            style={{ 
              width: "100%", 
              height: isExpanded ? "calc(100vh - 8rem)" : "290px"
            }} 
          />
        </CardContent>
      </Card>
    </>
  );
};

export default LPGFilledCylinder;
