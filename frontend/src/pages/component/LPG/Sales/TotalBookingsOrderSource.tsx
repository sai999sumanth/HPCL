import React, { useEffect, useState, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2,ChevronsUpDown, X, Check, Minimize2, Maximize2 } from "lucide-react";

import { FilterDropdown } from "./FilterDropdown";
import { getYesterdayDate } from "@/hooks/useYesterdayDate";
import { apiClient } from "@/services/apiClient";


interface ChartDataItem {
  name: string;
  value: number;
  drillDown: boolean;
}

interface DrilldownState {
  level: 'source' | 'zone' | 'region' | 'salesarea' | 'distributor';
  filters: Array<{
    key: string;
    cond: string;
    value: string;
  }>;
}

interface ApiResponse {
  status: boolean;
  message: string;
  data: {
    OrderSourceName: { [key: string]: string };
    Total_Bookings: { [key: string]: number };
  } | Array<{
    OrderSourceName: string;
    ZOName: string;
    ROName: string;
    SAName: string;
    DistributorName: string;
    Total_Bookings: number;
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
  const states = ['Source', 'Zone', 'Region', 'SalesArea', 'Distributor'];
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
            className={`w-1.5 h-1.5 rounded-full ${
              index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const TotalBookingsOrderSource = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    level: 'source',
    filters: []
  });
  const [drillHistory, setDrillHistory] = useState<string[]>([]);
  const chartRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [filterData, setFilterData] = useState<Record<string, string[]>>({});
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Array<{
    key: string;
    cond: string;
    value: string;
  }>>([]);
  const [crossFilters, setCrossFilters] = useState<Array<{
    key: string;
    cond: string;
    value: string;
  }>>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalSales, setTotalSales] = useState<number>(0);

  const handleBackClick = async () => {
    if (drilldownState.filters.length > 0) {
      setIsTransitioning(true);
      const newFilters = [...drilldownState.filters];
      newFilters.pop();
      
      const levels: DrilldownState['level'][] = ['source', 'zone', 'region', 'salesarea', 'distributor'];
      const newLevel = levels[newFilters.length] || 'source';
      
      setDrilldownState({
        level: newLevel,
        filters: newFilters
      });
      setDrillHistory(prev => prev.slice(0, -1));
    }
  };

  const resetView = async () => {
    setIsTransitioning(true);
    setDrilldownState({
      level: 'source',
      filters: []
    });
    setDrillHistory([]);
  };

  const handleDrillDown = async (dataItem: ChartDataItem) => {
    if (!dataItem?.drillDown) return;
    
    setIsTransitioning(true);
    const newFilters = [...drilldownState.filters];
    
    const drillLevels = {
      source: { 
        next: 'zone', 
        key: '"OrderSourceName"'
      },
      zone: { 
        next: 'region', 
        key: '"ZOName"'
      },
      region: { 
        next: 'salesarea', 
        key: '"ROName"'
      },
      salesarea: { 
        next: 'distributor', 
        key: '"SAName"'
      }
    };

    const currentLevel = drillLevels[drilldownState.level];
    
    if (currentLevel) {
      newFilters.push({
        key: currentLevel.key,
        cond: "equals",
        value: dataItem.name
      });

      setDrilldownState({
        level: currentLevel.next as DrilldownState['level'],
        filters: newFilters
      });

      setDrillHistory(prev => [...prev, dataItem.name]);
    }
  };

  const transformData = (data: ApiResponse['data']): ChartDataItem[] => {
    let grandTotal=0;
    if (!Array.isArray(data) && drilldownState.level === 'source') {
      Object.values(data.Total_Bookings || {}).forEach(value => {
        grandTotal += parseFloat(value.toString() || '0');
    });
    setTotalSales(grandTotal);
      
      return Object.keys(data.OrderSourceName).map(key => ({
        name: data.OrderSourceName[key],
        value: parseFloat(data.Total_Bookings[key].toString()),
        drillDown: true
      }));
    }

    
    if (!Array.isArray(data)) return [];

    const groupByField = {
      zone: 'ZOName',
      region: 'ROName',
      salesarea: 'SAName',
      distributor: 'DistributorName'
    }[drilldownState.level];

    if (!groupByField) return [];

    const groupedData: { [key: string]: number } = {};
    data.forEach(item => {
      const key = item[groupByField as keyof typeof item];
      if (typeof key === 'string') {
          if (!groupedData[key]) {
              groupedData[key] = 0;
          }
          const value = parseFloat(item.Total_Bookings?.toString() || '0');
          groupedData[key] += value;
          grandTotal += value;  // Add to grand total
      }
      setTotalSales(grandTotal);
  });

    return Object.entries(groupedData).map(([key, value]) => ({
      name: key,
      value,
      drillDown: drilldownState.level !== 'distributor'
    }));
  };

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
      
      // Initialize with empty values instead of default selections
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

   // API call to update filter options and fetch data
   const response = await apiClient.post('/api/charts/generate_vis_data', {
    filters: updatedFilters,
    action: "cdcms_dropdown",
    drill_state: ""
    });

      const result = response.data;
      setFilterData(result);
      setCrossFilters(updatedFilters);
      fetchData(drilldownState.filters, updatedFilters);
    
    
    } catch (error) {
      console.error('Error updating filters:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

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
          action: "lpg_cdcms_bookings_order_source_wise",
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
        level: 'source',
        filters: []
      });
      setActiveFilters([]);
      setCrossFilters([]);
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
  const fetchData = async (filters: DrilldownState['filters'], crossFilters: any[]) => {
    try {
      setIsTransitioning(true);
      
      const payload = {
        filters,
        cross_filters: crossFilters,
        action: "lpg_cdcms_bookings_order_source_wise",
        drill_state: ""
      };

      const response = await apiClient.post('/api/charts/generate_vis_data', payload);

      const result = response.data as ApiResponse;
      
      if (result.status && result.data) {
        const transformedData = transformData(result.data);
        setChartData(transformedData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchData(drilldownState.filters, crossFilters);
  }, [drilldownState.filters]);

  const getYAxisLabel = () => {
    const labelMap = {
      'month': 'Month',
      'zone': 'Zone',
      'region': 'Region',
      'salesarea': 'Sales Area',
      'distributor': 'Distributor Name'
    };
    return labelMap[drilldownState.level] || 'OrderSourceName';
  };

  useEffect(() => {
    if (!chartData.length || isLoading || !chartDivRef.current) return;

    if (chartRef.current) {
      chartRef.current.dispose();
    }

    const root = am5.Root.new(chartDivRef.current);
    chartRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panY: true,
        panX: false,
        wheelY: "none",
        wheelX: "none",
        layout: root.verticalLayout,
        paddingBottom: 0
      })
    );

     const legend = chart.children.unshift(
            am5.Legend.new(root, {
                centerX: am5.percent(50),
                x: am5.percent(50),
                marginTop: 0,
                marginBottom: 0,
                layout: root.horizontalLayout,
                height: 40
            })
        );
        
        legend.labels.template.setAll({
            fontSize: 10,
            fontWeight: "400",
            text: "{categoryY}"  // Change from "{name}" to "{categoryY}"
        });
        
        // After setting series data
        legend.data.setAll(chartData);

    // Create axes
    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "name",
        renderer: am5xy.AxisRendererY.new(root, {
          minGridDistance: 20,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9
        }),
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      maxWidth: 150,
      oversizedBehavior: "truncate",
      textAlign: "right"
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0.5,
        min: 0,
        strictMinMax: true,
        renderer: am5xy.AxisRendererX.new(root, {
          pan: "zoom"
        }),
        numberFormat: "#.",
        extraMax: 0.2
      })
    );

    xAxis.get("renderer").labels.template.setAll({
      fontSize: 10
    });

    // Add axis labels
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: getYAxisLabel(),
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        paddingBottom: 10
      })
    );

    xAxis.children.push(
      am5.Label.new(root, {
        text: "Total Bookings",
        x: am5.p50,
        centerX: am5.p50,
        paddingBottom: 0,
        fontSize: 10
      })
    );

    // Create series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Values",
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "value",
        categoryYField: "name",
        tooltip: am5.Tooltip.new(root, {
          labelText: "[bold fontSize: 8px]{categoryY}[/]\n[fontSize: 8px]Value: [bold fontSize: 8px]{valueX}[/]"
        })
      })
    );

    // Configure bars
    series.columns.template.setAll({
      cornerRadiusTR: 5,
      cornerRadiusBR: 5,
      strokeOpacity: 0,
       width: am5.percent(90),
      height: am5.percent(70),
      tooltipX: 0,
      tooltipPosition: "pointer",
      interactive: true
    });

    // Color configuration
    series.columns.template.adapters.add("fill", (fill, target) => {
      const colors = [
        am5.color(0x7986CB),
        am5.color(0x64B5F6),
        am5.color(0xBA68C8),
        am5.color(0x4DD0E1),
        am5.color(0x7E57C2),
        am5.color(0xF06292),
        am5.color(0xE57FC8),
        am5.color(0x9575CD),
        am5.color(0xBC8F8F),
        am5.color(0xE57373),
        am5.color(0xDB7093)
      ];

      const dataContext = target.dataItem?.dataContext as ChartDataItem;
      const index = chartData.findIndex(item => item.name === dataContext?.name);
      return colors[index % colors.length];
    });

    // Add value labels at the end of bars
    series.bullets.push(() => {
      return am5.Bullet.new(root, {
        locationX: 1,
        sprite: am5.Label.new(root, {
          text: "{valueX}",
          centerY: am5.p50,
          centerX: 1,
          paddingLeft: 5,
          populateText: true,
          fontSize: 10,
          fontWeight: "400"
        })
      });
    });

    // Hover state
    series.columns.template.states.create("hover", {
      fillOpacity: 0.8,
      strokeOpacity: 0.4,
      stroke: am5.color(0x000000),
      scale: 1.02
    });

    // Click handler for drill-down
    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem?.dataContext as ChartDataItem;
      if (dataItem) handleDrillDown(dataItem);
    });

    // Add scrollbar for vertical scrolling
    const scrollbarY = am5.Scrollbar.new(root, {
      orientation: "vertical",
      marginRight: 10,
      minWidth: 10,
      start: 0,
      end: chartData.length <= 10 ? 1 : 10 / chartData.length,
    });
    
    chart.set("scrollbarY", scrollbarY);
    chart.rightAxesContainer.children.push(scrollbarY);

    scrollbarY.thumb.setAll({
      fillOpacity: 0.2,
      visible: true
    });

    // Set cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "none",
      xAxis: xAxis,
      yAxis: yAxis
    }));

    // Set data
    yAxis.data.setAll(chartData);
    series.data.setAll(chartData);
    legend.data.setAll([series]);

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
        <span className="text-sm text-gray-600">Loading {drilldownState.level} data...</span>
      </div>
    </div>
  );
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

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
    <div className="relative">
      <div className={`transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50' : ''}`}>
        <div className={`${isExpanded ? 'fixed inset-0 bg-black/20 backdrop-blur-sm' : ''}`} />
        <Card className={`relative ${isExpanded ? 'h-full bg-white/95' : ''}`}>

      <CardHeader className="pb-0 p-1">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">

            <CardTitle className="text-xs font-bold text-gray-800">
              Total Bookings (In MT) (Order Source Wise) ({getYesterdayDate()})
              
            </CardTitle>
            <DrillStateIndicator level={drilldownState.level} />
            </div>

            
            <div className="flex items-center gap-4">
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
          
          {/* 3x2 Grid of Filter Dropdowns */}
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

          {/* Active Filters Display */}
          {/* {activeFilters.length > 0 && (
            <div className="text-xs text-gray-600">
              Active Filters: {activeFilters.map(f => `${f.key.replace(/"/g, '')}: ${f.value}`).join(', ')}
            </div>
          )} */}

          
        </div>
        <div className="text-xs font-semibold text-black-600">

        TotalBookings: 
         <span className="text-blue-600">
         {Number.isInteger(totalSales) 
      ? totalSales // Show as integer if it's a whole number
      : totalSales.toFixed(2) // Show with 2 decimals if it's a float
    }
         </span>
        
    </div>
      </CardHeader>
      <CardContent className={`p-0 relative ${isExpanded ? 'h-[calc(100%-60px)]' : 'h-[310px]'} pt-0`}>
      {drillHistory.length > 0 && (
            <div className="text-gray-600 p-1 text-xs">
              Drill Path: {drillHistory.join(" → ")}
            </div>
          )}
        {isTransitioning && <LoadingOverlay />}
        <div 
          ref={chartDivRef}
          className={`w-full ${isExpanded ? 'h-full' : 'h-[280px]'}`}
          />
      </CardContent>
    </Card>
    </div>
    </div>

  );
};

export default TotalBookingsOrderSource;
