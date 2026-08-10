import React, { useEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { cn } from "@/@/lib/utils";
import { Check } from "lucide-react";
import { ScrollArea } from "@/@/components/ui/scroll-area";
import { apiClient } from "@/services/apiClient";

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
    "Total Sales": { [key: string]: number };
  } | Array<{
    Month: string;
    ZOName: string;
    ROName: string;
    SAName: string;
    DistributorName: string;
    "Total Sales": number;
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
  { key: "CylType", label: "Cylinder Type" },
  // { key: "ConsumerType", label: "Consumer Type" },
];

const FilterDropdown = ({
  label,
  options,
  value,
  onChange,
  isLoading
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previousValue, setPreviousValue] = useState(value);

  const filteredOptions = options.filter(
    option => 
      option !== "NULL" && 
      option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleValueChange = (newValue: string) => {
    setPreviousValue(value); // Store the current value as previous
    onChange(newValue);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="flex flex-col gap-1">
        {/* <label className="text-xs font-medium text-gray-700">{label}</label> */}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 text-xs justify-between font-normal w-full"
          >
            <span className="truncate">
              {value
                ? options.find((option) => option === value)
                : `${label}`}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <div className="flex flex-col">
            <div className="flex items-center border-b px-3 relative">
              <input
                className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 pr-8"
                placeholder={`Search ${label}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  className="absolute right-2 h-6 w-6 p-0 hover:bg-transparent"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-[200px] overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="text-xs py-2 text-center text-gray-500">
                  No results found.
                </div>
              ) : (
                <div className="flex flex-col py-1">
                  {previousValue && (
                    <div className="px-2 py-1.5 text-xs text-gray-500 border-b">
                      Previous: {previousValue}
                    </div>
                  )}
                  {filteredOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleValueChange(option)}
                      className={cn(
                        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground",
                        value === option && "bg-accent text-accent-foreground"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
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
            className={`w-2 h-2 rounded-full ${index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'}`}
          />
        ))}
      </div>
    </div>
  );
};

const CumulativeSalesSummary = () => {
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
  const [activeFilters, setActiveFilters] = useState<Array<{
    key: string;
    cond: string;
    value: string;
  }>>([]);
  const chartRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);

  const transformData = (apiResponse: ApiResponse): ChartDataItem[] => {
    if (!apiResponse.status || !apiResponse.data) {
      return [];
    }

    if (drilldownState.level === 'month' && !Array.isArray(apiResponse.data)) {
      // Handle month level data
      const monthData = apiResponse.data;
      return Object.keys(monthData.Month).map(key => ({
        month: monthData.Month[key],
        value: monthData["Total Sales"][key],
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
        if (!groupedData[key]) {
          groupedData[key] = 0;
        }
        groupedData[key] += Number(item["Total Sales"]);
      });

      return Object.entries(groupedData).map(([key, value]) => ({
        month: key,
        value,
        drillDown: drilldownState.level !== 'distributor'
      }));
    }

    return [];
  };

  const fetchFilterOptions = async (crossFilters = []) => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: crossFilters,
          action: "cdcms_dropdown",
          drill_state: drilldownState.level
        })

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = response.data;
      if (result) {
        // Store the current selections before updating
        const currentSelections = { ...selectedFilters };
        
        // Update filter data with new options
        setFilterData(result);
        
        // Create new selectedFilters object
        const newSelectedFilters = { ...currentSelections };
        
        // For each filter key, check if the current selection is still valid
        Object.keys(result).forEach(key => {
          const currentValue = currentSelections[key];
          if (currentValue && !result[key].includes(currentValue)) {
            // If current selection is no longer valid, reset it
            newSelectedFilters[key] = "";
          }
          // If current selection is still valid, keep it
        });
        
        // Update selected filters with validated selections
        setSelectedFilters(newSelectedFilters);
        
        // Update active filters based on validated selections
        const newActiveFilters = Object.entries(newSelectedFilters)
          .filter(([_, val]) => val && val !== "placeholder")
          .map(([k, v]) => ({
            key: `"${k}"`,
            cond: "equals",
            value: v
          }));
        setActiveFilters(newActiveFilters);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch filter options');
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const fetchData = async () => {
    try {
      setIsTransitioning(true);
      setIsLoading(true);  // Ensure loading state is set

      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [...drilldownState.filters, ...activeFilters].filter(f => f.value && f.value !== "placeholder"),
          action: "lpg_cdcms_monthly_sales",
          drill_state: drilldownState.level
        })

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const result: ApiResponse = response.data;
      
      if (result.status) {
        const transformedData = transformData(result);
        setChartData(transformedData);
        setError(null);
      } else {
        setError(result.message || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
      setChartData([]); // Clear chart data on error
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };
  const handleFilterChange = async (key: string, value: string) => {
    if (!value) return; // Don't process empty selections
    
    setIsLoadingFilters(true);
    try {
        // Update selected filters
        const updatedSelectedFilters = {
            ...selectedFilters,
            [key]: value
        };
        setSelectedFilters(updatedSelectedFilters);

        // Create new filter
        const newFilter = {
            key: `"${key}"`,
            cond: "equals",
            value: value
        };

        // Update active filters array
        let updatedFilters = [...activeFilters];
        const existingFilterIndex = updatedFilters.findIndex(f => f.key === `"${key}"`);

        if (existingFilterIndex !== -1) {
            updatedFilters[existingFilterIndex] = newFilter;
        } else {
            updatedFilters.push(newFilter);
        }

        setActiveFilters(updatedFilters);

        // First, update dropdown options with the new filter
        const dropdownResponse = await apiClient.post('/api/charts/generate_vis_data', {
            filters: drilldownState.filters,
            cross_filters: updatedFilters,
                action: "cdcms_dropdown",
                drill_state: drilldownState.level
        });

        const dropdownResult = dropdownResponse.data;
        if (dropdownResult) {
            setFilterData(dropdownResult);
        }

        // Then, fetch the updated chart data
        const response = await apiClient.post('/api/charts/generate_vis_data', {
                filters: drilldownState.filters,
                cross_filters: updatedFilters,
                action: "lpg_cdcms_monthly_sales",
                drill_state: drilldownState.level
            });

        const result = response.data;
        
        if (result.status) {
            const transformedData = transformData(result);
            setChartData(transformedData);
            setError(null);
        } else {
            setError(result.message || 'Failed to fetch data');
        }

    } catch (error) {
        console.error('Error updating filters:', error);
        setError(error instanceof Error ? error.message : 'Failed to update filters');
    } finally {
        setIsLoadingFilters(false);
    }
};

// Update the resetFilters function to also refresh dropdowns:
const resetFilters = async () => {
    // Reset all filter selections
    const resetFilterValues = Object.keys(selectedFilters).reduce((acc, key) => {
        acc[key] = "";
        return acc;
    }, {} as Record<string, string>);
    
    setSelectedFilters(resetFilterValues);
    setActiveFilters([]);

    try {
        setIsLoading(true);
        
        // First, reset dropdown options
        const dropdownResponse = await apiClient.post('/api/charts/generate_vis_data', {
            filters: drilldownState.filters,
            cross_filters: [],
                action: "cdcms_dropdown",
                drill_state: drilldownState.level
            });

        const dropdownResult = dropdownResponse.data;
        if (dropdownResult) {
            setFilterData(dropdownResult);
        }

        // Then, reset chart data
        const response = await apiClient.post('/api/charts/generate_vis_data', {
                filters: drilldownState.filters,
                cross_filters: [],
                action: "lpg_cdcms_monthly_sales",
                drill_state: drilldownState.level
            });

        const result = response.data;
        
        if (result.status) {
            const transformedData = transformData(result);
            setChartData(transformedData);
            setError(null);
        } else {
            setError(result.message || 'Failed to reset data');
        }
    } catch (error) {
        console.error('Error resetting filters:', error);
        setError(error instanceof Error ? error.message : 'Failed to reset filters');
    } finally {
        setIsLoading(false);
    }
};
useEffect(() => {
  if (drilldownState.filters.length > 0) {
      fetchData();
  }
}, [drilldownState]);


 


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

    // Fetch new dropdown options with updated drill filters and current active filters
    await fetchFilterOptions([...newFilters, ...activeFilters]);
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

      // Fetch new dropdown options with updated drill filters and current active filters
      await fetchFilterOptions([...newFilters, ...activeFilters]);
    }
  };
  
  useEffect(() => {
    fetchFilterOptions([...drilldownState.filters]);
  }, []);

  // Fetch chart data when filters or drill state changes
  useEffect(() => {
    fetchData();
  }, [drilldownState, activeFilters]);

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
      wheelX: "panX",
      wheelY: "zoomX",
      pinchZoomX: true,
      paddingBottom: 40,
      paddingTop: 40
    })
  );

  root._logo?.dispose();



//  // Add legend before the chart title
//  const legend = chart.children.unshift(
//   am5.Legend.new(root, {
//     centerX: am5.p50,
//     x: am5.p50,
//     marginBottom: 20,
//     layout: root.horizontalLayout,
//     height: 40,      

//   })
// );
// const getLegendLabels = () => {
//   switch(drilldownState.level) {
//     case 'month':
//       return "Monthly Sales";
//     case 'zone':
//       return "Zone-wise Sales";
//     case 'region':
//       return "Region-wise Sales";
//     case 'salesarea':
//       return "Sales Area-wise Sales";
//     case 'distributor':
//       return "Distributor-wise Sales";
//     default:
//       return "Sales";
//   }
// };


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
      paddingTop: 20,
      fontSize: 12
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
      text: "Total Sales",
      y: am5.p50,
      centerX: am5.p50,
      fontSize: 12,
      paddingBottom: 10
    })
  );
  
  xAxis.get("renderer").labels.template.setAll({
    rotation: 0,
    centerY: am5.p50,
    centerX: am5.p50,
    paddingTop: 8,
    paddingBottom: 2,
    fontSize: 11,
    maxWidth: 120,
    oversizedBehavior: "truncate",
    textAlign: "center"
  });
  yAxis.get("renderer").labels.template.setAll({
    fontSize: 11,
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
        labelText: "[bold fontSize: 14px]{categoryX}[/]\n[fontSize: 13px]Total Sales: [bold]{valueY}[/]",
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
        fontSize: 13,
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
    end: chartData.length <= 10 ? 1 : 10 / chartData.length,
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
    <Card >
      <CardHeader className="pb-0 p-3">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-800">
              Monthly Sales
            </CardTitle>
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

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
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
          {activeFilters.length > 0 && (
            <div className="text-xs text-gray-600">
              Active Filters: {activeFilters.map(f => `${f.key.replace(/"/g, '')}: ${f.value}`).join(', ')}
            </div>
          )}

          {drillHistory.length > 0 && (
            <div className="text-gray-600 text-xs">
              Drill Path: {drillHistory.join(" → ")}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative h-[360px] pt-0">
      {error && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-gray-500 text-sm bg-red-50 p-4 rounded-md">
              No Data
            </div>
          </div>
        )}
        {isTransitioning && <LoadingOverlay />}
        <div
          ref={chartDivRef}
          id="chartdiv"
          style={{ width: "100%", height: "400px" }}
        />
      </CardContent>
    </Card>
  );
};

export default CumulativeSalesSummary;
