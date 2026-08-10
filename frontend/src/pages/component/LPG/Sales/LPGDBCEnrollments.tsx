import React, { useEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2, ChevronsUpDown, X, Minimize2, Maximize2 } from "lucide-react";
import { FilterDropdown } from "./FilterDropdown";
import { getYesterdayDate } from "@/hooks/useYesterdayDate";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";

interface ChartDataItem {
  month: string;
  value: number;
  drillDown: boolean;
}

interface ApiResponse {
  status: boolean;
  message: string;
  data: {
    Month: { [key: string]: string };
    "DBCIssued": { [key: string]: number };
  } | Array<{
    Month: string;
    ZOName: string;
    ROName: string;
    SAName: string;
    DistributorName: string;
    "DBCIssued": number;
  }>;
}

interface DrilldownState {
  level: 'month' | 'zone' | 'region' | 'salesarea' | 'distributor';
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
  { key: "ConsumerType", label: "Consumer Type" },
];


const DrillStateIndicator = ({ level }: { level: string }) => {
  const states = ['Month', 'Zone', 'Region', 'SalesArea', 'Distributor'];
  const displayLevel = level === 'salesarea' ? 'SalesArea' : level.charAt(0).toUpperCase() + level.slice(1);
  const currentIndex = states.indexOf(displayLevel);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[currentIndex]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'}`}
          />
        ))}
      </div>
    </div>
  );
};

const LPGDBCEnrollments = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    level: 'month',
    filters: []
  });
  const [drillHistory, setDrillHistory] = useState<string[]>([]);
  const [filterData, setFilterData] = useState<Record<string, string[]>>({});
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [crossFilters, setCrossFilters] = useState<Array<{
    key: string;
    cond: string;
    value: string;
  }>>([]);
  const chartRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalSales, setTotalSales] = useState<number>(0);

  const transformData = (apiResponse: ApiResponse): ChartDataItem[] => {
    let grandTotal=0;
    if (!apiResponse.status || !apiResponse.data) {
      return [];
    }

    if (drilldownState.level === 'month' && !Array.isArray(apiResponse.data)) {
      Object.values(apiResponse.data.DBCIssued || {}).forEach(value => {
        grandTotal += parseFloat(value.toString() || '0');
        console.log("dfdfdfdfd",grandTotal);
    });
      // Handle month level data
      const monthData = apiResponse.data;
      return Object.keys(monthData.Month).map(key => ({
        month: monthData.Month[key],
        value: monthData["DBCIssued"][key],
        drillDown: true
      }));
    }

    if (Array.isArray(apiResponse.data)) {
      // Handle drilled down data
      const groupedData: { [key: string]: number } = {};
      const fieldMap = {
        zone: 'ZOName',
        region: 'ROName',
        salesarea: 'SAName',
        distributor: 'DistributorName'
      };

      const field = fieldMap[drilldownState.level];
      
      apiResponse.data.forEach(item => {
        const key = field ? item[field] : item.Month;
        if (typeof key === 'string') {
          if (!groupedData[key]) {
              groupedData[key] = 0;
          }
          const value = parseFloat(item.DBCIssued?.toString() || '0');
          groupedData[key] += value;
          grandTotal += value;  // Add to grand total
      }
      setTotalSales(grandTotal);
        
        // if (!groupedData[key]) {
        //   groupedData[key] = 0;
        // }
        // groupedData[key] += Number(item["DBCIssued"]);
      });

      return Object.entries(groupedData).map(([key, value]) => ({
        month: key,
        value,
        drillDown: drilldownState.level !== 'distributor'
      }));
    }

    return [];
  };

  const fetchFilterOptions = async () => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "cdcms_dropdown",
          drill_state: ""
        });

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = response.data;
      if (result) {
        setFilterData(result);

        // Initialize with empty values instead of default selections
        const initialFilters = Object.keys(result).reduce((acc, key) => {
          acc[key] = "";
          return acc;
        }, {} as Record<string, string>);
        setSelectedFilters(initialFilters);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
      setError('No data available');
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const fetchData = async (filters: DrilldownState['filters'], crossFilters: any[]) => {
    try {
      setIsTransitioning(true);
      setIsLoading(true);  // Ensure loading state is set

      const payload = {
        filters,
        cross_filters: crossFilters,
        action: "lpg_cdcms_dbc_enrollments",
        drill_state: ""
      };

      const response = await apiClient.post('/api/charts/generate_vis_data', payload);

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.data;

      if (result.status) {
        const transformedData = transformData(result);
        setChartData(transformedData);
        setError(null);
      } else {
        setError(result.message || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('No data available');
      setChartData([]); // Clear chart data on error
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };
  const handleFilterChange = async (key: string, value: string) => {
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


      let updatedFilters = [...crossFilters];
      const existingFilterIndex = updatedFilters.findIndex(f => f.key === `"${key}"`);

      if (value === "NULL") {
        updatedFilters = updatedFilters.filter(f => f.key !== `"${key}"`);
      } else if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }

      setCrossFilters(updatedFilters);

   // API call to update filter options and fetch data
   const response = await apiClient.post('/api/charts/generate_vis_data', {
    filters: updatedFilters,
    action: "cdcms_dropdown",
    drill_state: ""
    });

      const result = response.data;
      setFilterData(result);
      fetchData(drilldownState.filters, updatedFilters);


    } catch (error) {
      console.error('Error updating filters:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

// Update the resetFilters function to also refresh dropdowns:
const resetFilters = async () => {
  setIsLoadingFilters(true);
  setIsTransitioning(true);
  try {
    // First: Get both dropdown and chart data in parallel
    const [dropdownResponse, chartResponse] = await Promise.all([
      apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "cdcms_dropdown",
          drill_state: ""
        }),
      apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "lpg_cdcms_dbc_enrollments",
          drill_state: ""
        })
    ]);

    // Process both responses
    const [dropdownResult, chartResult] = await Promise.all([
      dropdownResponse.data,
      chartResponse.data
    ]);

    // Batch all state updates together
    const resetValues = Object.keys(dropdownResult).reduce((acc, key) => {
      acc[key] = dropdownResult[key].includes("NULL") ? "NULL" : "";
      return acc;
    }, {} as Record<string, string>);

    // Update all states at once
    setDrilldownState({
      level: 'month',
      filters: []
    });
    setCrossFilters([]);
    // setCrossFilters([]);
    setDrillHistory([]);
    setFilterData(dropdownResult);
    setSelectedFilters(resetValues);

    // Set chart data last
    if (chartResult.status && chartResult.data) {
      const transformedData = transformData(chartResult.data);
      setChartData(transformedData);
    }

  } catch (error) {
    console.error('Error resetting filters:', error);
  } finally {
    setIsLoadingFilters(false);
    setIsTransitioning(false);
  }
};

  const handleDrillDown = async (dataItem: ChartDataItem) => {
    if (!dataItem?.drillDown) return;
  
    const drillLevels: Record<string, DrilldownState['level']> = {
      month: 'zone',
      zone: 'region',
      region: 'salesarea',
      salesarea: 'distributor'
    };
  
    const filterKeyMap: Record<string, string> = {
      month: 'Month',
      zone: 'ZOName',
      region: 'ROName',
      salesarea: 'SAName',
      distributor: 'DistributorName'
    };
  
    const nextLevel = drillLevels[drilldownState.level];
    if (!nextLevel) return;
  
    const newFilters = [...drilldownState.filters];
    newFilters.push({
      key: `"${filterKeyMap[drilldownState.level]}"`,
      cond: "equals",
      value: dataItem.month
    });
  
    // Update drill state
    setDrilldownState({
      level: nextLevel,
      filters: newFilters
    });
    setDrillHistory(prev => [...prev, dataItem.month]);

  };
  const handleBackClick = async () => {
    if (drilldownState.filters.length > 0) {
      const newFilters = [...drilldownState.filters];
      newFilters.pop();

      const levels: DrilldownState['level'][] = ['month', 'zone', 'region', 'salesarea', 'distributor'];
      const newLevel = levels[newFilters.length] || 'month';

      // Update drill state
      setDrilldownState({
        level: newLevel,
        filters: newFilters
      });
      setDrillHistory(prev => prev.slice(0, -1));

    }
  };
  
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchData(drilldownState.filters, crossFilters);
  }, [drilldownState.filters]);

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
      paddingBottom: 0,
    })
  );

  root._logo?.dispose();


const getXAxisLabel = () => {
  const labelMap = {
    'month': 'Month',
    'zone': 'Zone',
    'region': 'Region',
    'salesarea': 'Sales Area',
    'distributor': 'Distributor Name'
  };
  return labelMap[drilldownState.level] || 'Time Period';
};

  // Calculate maximum value for y-axis
  const maxValue = Math.max(...chartData.map(item => item.value));
  const yAxisMax = Math.ceil(maxValue * 1.2);
  let xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: "month",
      renderer: am5xy.AxisRendererX.new(root, {
        minGridDistance: 60,
        cellStartLocation: 0.1,
        cellEndLocation: 0.9
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
      fontSize: 10
    })
  );

  let yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      maxDeviation: 0.5,
      renderer: am5xy.AxisRendererY.new(root, {
        pan: "zoom"
      })
    })
  );

  yAxis.children.unshift(
    am5.Label.new(root, {
      rotation: -90,
      text: "DBCIssued",
      y: am5.p50,
      centerX: am5.p50,
      fontSize: 10,
      paddingBottom: 0
    })
  );
  
  xAxis.get("renderer").labels.template.setAll({
    rotation: 0,
    centerY: am5.p50,
    centerX: am5.p50,
    paddingTop: 8,
    paddingBottom: 2,
    fontSize: 10,
    maxWidth: 120,
    oversizedBehavior: "truncate",
    textAlign: "center"
  });
  yAxis.get("renderer").labels.template.setAll({
    fontSize: 10,
    maxWidth: 120,
    oversizedBehavior: "truncate",
    textAlign: "center"
  });
let series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: "Sales",
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: "value",
      categoryXField: "month",
      tooltip: am5.Tooltip.new(root, {
        labelText: "[bold fontSize: 8px]{categoryX}[/]\n[fontSize: 8px]DBCIssued: [fontSize: 8px bold]{valueY}[/]",
        getFillFromSprite: true,
        pointerOrientation: "vertical",
        centerX: am5.percent(50),
        centerY: am5.percent(0),
        animationDuration: 200,
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 15,
        paddingRight: 15
      })
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
        dy: -25
      })
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
      am5.color(0x296350),
      am5.color(0x40786c),
      am5.color(0x5b8d89),
      am5.color(0x77a2a3),
      am5.color(0x98b8bc),
      am5.color(0x92b2c0),
      am5.color(0x7198ad),
      am5.color(0x527c9b),
      am5.color(0x376288),
      am5.color(0x1c4875),
    ];

    const dataContext = target.dataItem?.dataContext as { month: string; value: number };
    const index = chartData.findIndex(item => item.month === dataContext?.month);
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

    const dataContext = target.dataItem?.dataContext as { month: string; value: number };
    const index = chartData.findIndex(item => item.month === dataContext?.month);
    return colors[index % colors.length];
  });

  // Set column appearance
  series.columns.template.setAll({
    cornerRadiusTL: 5,
    cornerRadiusTR: 5,
    strokeOpacity: 0,
    cursorOverStyle: "pointer",
    tooltipY: 0,
    width: am5.percent(60),
    tooltipPosition: "pointer",
    interactive: true
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
    marginBottom: 30,
    minHeight: 10,
    start: 0,
    end: chartData.length <= 12 ? 1 : 12 / chartData.length,
  });
  chart.set("scrollbarX", scrollbarX);
  chart.bottomAxesContainer.children.push(scrollbarX);

  scrollbarX.thumb.setAll({
    fillOpacity: 0.2,
    visible: true
  });
  
  chart.set("scrollbarX", scrollbarX);
  chart.set("cursor", am5xy.XYCursor.new(root, {
    behavior: "none",
    xAxis: xAxis,
    yAxis: yAxis
  }));
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
const toggleExpand = () => {
  setIsExpanded(!isExpanded);
};
  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">Loading {drilldownState.level} data...</span>
      </div>
    </div>
  );

  if (isLoading && !isTransitioning) {
    return (
      <Card className="w-full h-[5
 00px] bg-white border border-gray-200">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className={`transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50' : ''}`}>
        <div className={`${isExpanded ? 'fixed inset-0 bg-black/20 backdrop-blur-sm' : ''}`} />
        <Card className={`relative ${isExpanded ? 'h-full bg-white/95' : ''}`}>

      <CardHeader className="pb-0 p-1">
        <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
        <CardTitle className="text-xs font-bold text-gray-800">
              DBC Enrollments (Count) ({getYesterdayDate()})
            </CardTitle>
            <DrillStateIndicator level={drilldownState.level} />
            </div>

            <div className="flex items-center gap-2 ml-auto">
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

          {/* Filter Dropdowns */}
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

          {/* Active Filters Display */}
          {/* {activeFilters.length > 0 && (
            <div className="text-xs text-gray-600">
              Active Filters: {activeFilters.map(f => `${f.key.replace(/"/g, '')}: ${f.value}`).join(', ')}
            </div>
          )} */}

        
        </div>
        <div className="text-xs font-semibold text-black-600">
        TotalDBC: 
        <span className="text-blue-600">
        {Number.isInteger(totalSales) 
      ? totalSales // Show as integer if it's a whole number
      : totalSales.toFixed(2) // Show with 2 decimals if it's a float
    }
        </span>
        
    </div>
      </CardHeader>
      <CardContent className={`p-0 relative ${isExpanded ? 'h-[calc(100%-60px)]' : 'h-[280px]'} pt-0`}>
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
          className={`w-full ${isExpanded ? 'h-full' : 'h-[270px]'}`}
        />
      </CardContent>
    </Card>
    </div>
    </div>

  );
};

export default LPGDBCEnrollments;
