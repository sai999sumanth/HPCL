import React, { useEffect, useState, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2, ChevronsUpDown, X, Minimize2, Maximize2 } from "lucide-react";
import { setError } from "@/redux/features/askAISlice";
import { FilterDropdown } from "./FilterDropdown";
import { getYesterdayDate } from "@/hooks/useYesterdayDate";
import { apiClient } from "@/services/apiClient";

interface ChartDataItem {
  name: string;
  Bookings: number;
  Sales: number;
  Pending: number;
  ZOName?: string;
  ROName?: string;
  SAName?: string;
  DistributorName?: string;
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


const CHART_COLORS = {
  Bookings: '#0x003f5c',
  Sales: '#0x2f4b7c',
  Pending: '#0x665191'
};

const filterOptions: FilterOption[] = [
  // { key: "Month", label: "Month" },
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" },
  { key: "CylType", label: "Cylinder Type" },
  { key: "ConsumerType", label: "Consumer Type" },
];

/** Booking vs sales chart — `payload.type` for `lpg_cdcms_booking_vs_sales_vs_pending`. */
type BookingSalesMetricType = "cyl" | "tmt";

const BOOKING_SALES_TYPE_OPTIONS: { value: BookingSalesMetricType; label: string }[] = [
  { value: "cyl", label: "Cylinders" },
  { value: "tmt", label: "TMT" },
];


const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = ['Zone', 'Region', 'Area', 'Distributor'];
  
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillLevel]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${
              index === drillLevel ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const LPGZonePerformanceChart = () => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [drillHistory, setDrillHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [filters, setFilters] = useState<LocationFilter[]>([]);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalValues, setTotalValues] = useState<{
    bookings: number;
    sales: number;
    pending: number;
    total: number;
}>({
    bookings: 0,
    sales: 0,
    pending: 0,
    total: 0
});

  // Filter states
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
  const [drillState, setDrillState] = useState<DrillState>({
    level: 'month',
    filters: []
  });

  const [bookingSalesMetricType, setBookingSalesMetricType] =
    useState<BookingSalesMetricType>("cyl");

  const fetchFilterOptions = async (crossFilters = []) => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: crossFilters,
          action: "cdcms_dropdown",
          drill_state: drillState.level // Now properly typed
        });

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = response.data;
      if (result) {
        setFilterData(result);
        // Don't set initial values, let user select them
        const currentSelections = { ...selectedFilters };
        Object.keys(result).forEach(key => {
          if (currentSelections[key] && !result[key].includes(currentSelections[key])) {
            currentSelections[key] = "";
          }
        });
        setSelectedFilters(currentSelections);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch filter options');
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
      setCrossFilters(updatedFilters);

      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: updatedFilters,
          action: "cdcms_dropdown",
          drill_state: ""
        });

      const result = response.data;
      setFilterData(result);

    } catch (error) {
      console.error('Error updating filters:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const getDrillLevelField = (level: number) => {
    const fields = ['ZOName', 'ROName', 'SAName', 'DistributorName'];
    return fields[level] || fields[0];
  };

  const fetchChartData = async () => {
    try {
        setIsTransitioning(true);
        const response = await apiClient.post('/api/charts/generate_vis_data', {
                filters,
                cross_filters: crossFilters,
                action: "lpg_cdcms_booking_vs_sales_vs_pending",
                drill_state: "",
                payload: { type: bookingSalesMetricType },
            });

        const data = response.data;
        if (data.status) {
            let totalBookings = 0;
            let totalSales = 0;
            let totalPending = 0;

            const transformedData = Array.isArray(data.data)
                ? data.data.map((item: any) => {
                    const bookings = parseFloat(item.Bookings) || 0;
                    const sales = parseFloat(item.Sales) || 0;
                    const pending = parseFloat(item.Pending) || 0;
                    
                    totalBookings += bookings;
                    totalSales += sales;
                    totalPending += pending;

                    return {
                        name: item[getDrillLevelField(drillLevel)] || item.ZOName,
                        Bookings: bookings,
                        Sales: sales,
                        Pending: pending,
                        ...item
                    };
                })
                : Object.keys(data.data.ZOName).map((key) => {
                    const bookings = parseFloat(data.data.Bookings[key]) || 0;
                    const sales = parseFloat(data.data.Sales[key]) || 0;
                    const pending = parseFloat(data.data.Pending[key]) || 0;

                    totalBookings += bookings;
                    totalSales += sales;
                    totalPending += pending;

                    return {
                        name: data.data.ZOName[key],
                        Bookings: bookings,
                        Sales: sales,
                        Pending: pending
                    };
                });

            setChartData(transformedData);
            setTotalValues({
                bookings: totalBookings,
                sales: totalSales,
                pending: totalPending,
                total: totalBookings + totalSales + totalPending
            });
        }
    } catch (error) {
        console.error('Failed to fetch chart data:', error);
    } finally {
        setIsLoading(false);
        setIsTransitioning(false);
    }
};
  const resetFilters = async () => {
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
      setCrossFilters([]);
  
      // Fetch initial filter options with no filters
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "cdcms_dropdown",
          drill_state: ""
        });
  
      const result = response.data;
      setFilterData(result);
  
      // Fetch data with reset filters
      setDrillLevel(0);
      setDrillHistory([]);
      setFilters([]);
    } catch (error) {
      console.error('Error resetting filters:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [filters, crossFilters, drillLevel, bookingSalesMetricType]);

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
        wheelX: "panX",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 30
      })
    );
    root._logo?.dispose();

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60,
          cellStartLocation: 0.1,
          cellEndLocation: 0.8
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const maxValue = Math.max(
      ...chartData.flatMap(item => [item.Bookings, item.Sales, item.Pending])
    );
    const yAxisMax = Math.ceil(maxValue * 1.2);

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0.5,
        min: 0,
        max: yAxisMax,
        strictMinMax: true,
        renderer: am5xy.AxisRendererY.new(root, {
          pan: "zoom"
        })
      })
    );

    if (chartData.length > 7) {
      xAxis.events.once("datavalidated", function() {
        xAxis.zoomToIndexes(0, 6);
      });
    }

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
    const getXAxisLabel = () => {
      switch (drillLevel) {
        case 0:
          return "Zones";
        case 1:
          return "Regions";
        case 2:
          return "Sales Areas";
        case 3:
          return "Distributors";
        default:
          return "Locations";
      }
    };
    xAxis.children.push(
      am5.Label.new(root, {
        text: getXAxisLabel(),
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10
      })
    );
      // Add Y-axis title with "Total Sales"
  yAxis.children.unshift(
    am5.Label.new(root, {
      rotation: -90,
      text: "(In MT)",
      y: am5.p50,
      centerX: am5.p50,
      fontSize: 10,
      paddingBottom: 0
    })
  );

  const legend = chart.children.unshift(
    am5.Legend.new(root, {
      centerX: am5.p50,
      x: am5.p50,
      marginBottom: 0,
      layout: root.horizontalLayout,
      useDefaultMarker: true,
      clickTarget: "marker", // Enable legend clicking
    })
  );

  // Configure legend labels to be simple and non-interactive
  legend.labels.template.setAll({
    textAlign: "center",
    fill: am5.color(0x000000),
    fontSize: 10
  });

  // Disable legend marker interactions
  legend.markers.template.setAll({
    width: 16,
    height: 16
  });

  // Disable all legend interactions
  legend.itemContainers.template.set("focusable", false);
  legend.markerRectangles.template.states.create("hover", {});
  legend.markerRectangles.template.states.create("down", {});


  ["Bookings", "Sales", "Pending"].forEach((metric) => {
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: metric,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: metric,
        categoryXField: "name",
        tooltip: am5.Tooltip.new(root, {
          pointerOrientation: "horizontal",
          labelText: `[fontSize: 8px]${metric}: {valueY}`
        })
      })
    );
    series.columns.template.setAll({
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      strokeOpacity: 0,
      fillOpacity: 0.8,
      fill: am5.color(CHART_COLORS[metric as keyof typeof CHART_COLORS]),
      tooltipY: 0,
      width: am5.percent(90)
    });


    series.columns.template.events.on("click", async (ev) => {
      if (drillLevel >= 3) return;
      
      const dataItem = ev.target.dataItem?.dataContext as ChartDataItem;
      if (!dataItem) return;
    
      const newFilter = {
        key: `"${getDrillLevelField(drillLevel)}"`,
        cond: "equals",
        value: dataItem.name
      };

      const updatedFilters = [...filters, newFilter];
      setFilters(updatedFilters);
      setDrillLevel(prev => prev + 1);
      setDrillHistory(prev => [...prev, dataItem.name]);
      try {
        setIsLoadingFilters(true);
        const response = await apiClient.post('/api/charts/generate_vis_data', {
            filters: updatedFilters,
            action: "cdcms_dropdown",
            drill_state: getDrillLevelField(drillLevel + 1) // Use the new drill level
          }).then(res => res.data);
        if (response.status) {
          const result = response.data;
          setFilterData(result);
        }
      } catch (error) {
        console.error('Error fetching filter options after drill down:', error);
      } finally {
        setIsLoadingFilters(false);
      }
      });

      series.bullets.push(() => {
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

      series.data.setAll(chartData);
    });

 
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 8,
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



    xAxis.data.setAll(chartData);

    chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "none"
    }));

    legend.data.setAll(chart.series.values);
    
    // Disable legend hover state
    // legend.itemContainers.template.set("hoverable", false);
    legend.itemContainers.template.set("focusable", false);
    legend.markerRectangles.template.states.create("hover", {});
    legend.markerRectangles.template.states.create("down", {});
    legend.data.setAll(chart.series.values);

    return () => {
      root.dispose();
    };
  }, [chartData, isLoading]);

  const handleBackClick = () => {
    if (drillLevel > 0) {
      setFilters(prev => prev.slice(0, -1));
      setDrillLevel(prev => prev - 1);
      setDrillHistory(prev => prev.slice(0, -1));
    }
  };

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">Loading {getDrillLevelField(drillLevel)} data...</span>
      </div>
    </div>
  );

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (isLoading && !isTransitioning) {
    return (
      <Card className="w-full h-[550px] bg-white border border-gray-200">
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
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-xs font-bold text-gray-800">
                    Bookings vs Sales vs Pendings ({getYesterdayDate()})

                  </CardTitle>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1">
                   
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
                     <FilterDropdown
                      key="booking-sales-type"
                      label="Type"
                      options={BOOKING_SALES_TYPE_OPTIONS}
                      value={bookingSalesMetricType}
                      onChange={(value) =>
                        setBookingSalesMetricType(value as BookingSalesMetricType)
                      }
                      isLoading={false}
                    />
                  </div>
                  

                  <div className="flex items-center gap-2">
                  {drillLevel === 0 && (
                      <>
                       
                        <Button
                          onClick={resetFilters}
                          disabled={isTransitioning}
                          className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                     
                    {drillLevel > 0 && (
                      <>
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
                      </>
                    )}
                     
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
            </div>
            <div className="flex gap-4 text-xs font-semibold">
    <span className="text-black-600">
    
       TotalBookings:
       <span className="text-blue-600">

          {totalValues.bookings.toFixed(2)} 
           
       </span>
  </span>
    <span className="text-black-600">
      
       TotalSales: 
       <span className="text-blue-600">
      {Number.isInteger(totalValues.sales) 
  ? totalValues.sales // Show as integer if it's a whole number
  : totalValues.sales.toFixed(2) // Show with 2 decimals if it's a float
}
      </span>
    </span>
    <span className="text-black-600">
       Totalpendings: 
       <span className="text-blue-600">
       {totalValues.pending }
       
       </span>
       
       
    </span>
    <DrillStateIndicator drillLevel={drillLevel} />

</div>
          </CardHeader>
          <CardContent className={`p-0 relative ${isExpanded ? 'h-[calc(100%-60px)]' : 'h-[300px]'} pt-0`}>
            {drillHistory.length > 0 && (
              <div className="text-gray-600 p-1 text-xs">
                Drill Path: {drillHistory.join(" → ")}
              </div>
            )}
            {isTransitioning && <LoadingOverlay />}
            <div 
              ref={chartDivRef} 
              id="chartdiv" 
              className={`w-full ${isExpanded ? 'h-full' : 'h-[290px]'}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LPGZonePerformanceChart;
