import React, { useEffect, useState, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2, X, ChevronsUpDown, Check, Minimize2, Maximize2 } from "lucide-react";
import { FilterDropdown } from "./FilterDropdown";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";



interface FilterOption {
    key: string;
    label: string;
}

const filterOptions: FilterOption[] = [
    { key: "ZOName", label: "Zone" },
    { key: "ROName", label: "Region" },
    { key: "SAName", label: "Sales Area" },
    { key: "DistributorName", label: "Distributor" },
    { key: "CylType", label: "Cylinder Type" },
    // { key: "ConsumerType", label: "Consumer Type" },
];

const filterOptions1: FilterOption[] = [
    { key: "Financial_Year", label: "Financial Year" },
  ];
  interface ChartDataItem {
    name: string;
    value: number;
    drillDown: boolean;
}

interface DrilldownState {
    level: 'ConsumerType' | 'zone' | 'region' | 'salesarea' | 'distributor';
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
        ConsumerType: { [key: string]: string };
        Sales: { [key: string]: number };
    } | Array<{
        ConsumerType: string;
        ZOName: string;
        ROName: string;
        SAName: string;
        DistributorName: string;
        Sales: number;
    }>;
}

const DrillStateIndicator = ({ level }: { level: string }) => {
    const states = ['ConsumerType', 'Zone', 'Region', 'SalesArea', 'Distributor'];
    const displayLevel = level === 'salesarea' ? 'SalesArea' : level.charAt(0).toUpperCase() + level.slice(1);
    const currentIndex = states.indexOf(displayLevel);

    return (
        <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
            <span>Level:</span>
            <span className="font-bold text-blue-600">{displayLevel}</span>
            <div className="flex gap-1">
                {states.map((_, index) => (
                    <div
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full ${index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};

const CurrentYearSales = () => {
    const [chartData, setChartData] = useState<ChartDataItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [drilldownState, setDrilldownState] = useState<DrilldownState>({
        level: 'ConsumerType',
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

            const levels: DrilldownState['level'][] = ['ConsumerType', 'zone', 'region', 'salesarea', 'distributor'];
            const newLevel = levels[newFilters.length] || 'ConsumerType';

            setDrilldownState({
                level: newLevel,
                filters: newFilters
            });
            setDrillHistory(prev => prev.slice(0, -1));
        }
    };


    const handleDrillDown = async (dataItem: ChartDataItem) => {
        if (!dataItem?.drillDown) return;

        setIsTransitioning(true);
        const newFilters = [...drilldownState.filters];

        const drillLevels = {
            ConsumerType: {
                next: 'zone',
                key: '"ConsumerType"'
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

  const fetchFilterOptions = async () => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "cdcms_dropdown",
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
      setError('No data available');
    } finally {
      setIsLoadingFilters(false);
    }
  };

    const handleFilterChange = async (key: string, value: string) => {
        if (!value) return; // Don't process empty selections
        
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

            if (existingFilterIndex !== -1) {
                updatedFilters[existingFilterIndex] = newFilter;
            } else {
                updatedFilters.push(newFilter);
            }

            setActiveFilters(updatedFilters);
            setCrossFilters(updatedFilters);

            // Separate API calls for filters and drilldown
            await Promise.all([
                // Update filter options
                apiClient.post('/api/charts/generate_vis_data', {
                    filters: updatedFilters,
                        action: "cdcms_dropdown",
                        drill_state: ""
                    }).then(res => res.data).then(result => setFilterData(result)),
                
                // Update chart data
                fetchData(drilldownState.filters, updatedFilters)
            ]);

        } catch (error) {
            console.error('Error updating filters:', error);
        } finally {
            setIsLoadingFilters(false);
        }
    };

    const resetEverything = async () => {
        setIsLoadingFilters(true);
        setIsTransitioning(true);
        
        try {
            // Reset all filters
            setActiveFilters([]);
            setCrossFilters([]);
            
            // Reset selections to empty
            const resetValues = Object.keys(filterData).reduce((acc, key) => {
                acc[key] = "";
                return acc;
            }, {} as Record<string, string>);
            setSelectedFilters(resetValues);

            // Reset drilldown state
            setDrilldownState({
                level: 'ConsumerType',
                filters: []
            });
            setDrillHistory([]);

            // Fetch fresh data with no filters and at top level
            await Promise.all([
                // Reset filter options
                apiClient.post('/api/charts/generate_vis_data', {
                    filters: [],
                        action: "cdcms_dropdown",
                        drill_state: ""
                    }).then(res => res.data).then(result => {
                    setFilterData(result);
                }),
                
                // Reset chart data to top level
                apiClient.post('/api/charts/generate_vis_data', {
                    filters: [],
                        cross_filters: [],
                        action: "lpg_cdcms_current_financial_year_sales",
                        drill_state: ""
                    }).then(res => res.data).then(result => {
                    const transformedData = transformData(result.data);
                    setChartData(transformedData);
                })
            ]);

        } catch (error) {
            console.error('Error resetting everything:', error);
        } finally {
            setIsLoadingFilters(false);
            setIsTransitioning(false);
        }
    };

    const transformData = (data: ApiResponse['data']): ChartDataItem[] => {
        let total = 0;
        
        if (!Array.isArray(data) && drilldownState.level === 'ConsumerType') {
            total = Object.values(data.Sales).reduce((sum, val) => sum + parseFloat(val.toString()), 0);
            setTotalSales(total);
            
            return Object.keys(data.ConsumerType).map(key => ({
                name: data.ConsumerType[key],
                value: parseFloat(data.Sales[key].toString()),
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
                const salesValue = parseFloat(item.Sales.toString());
                groupedData[key] += salesValue;
                total += salesValue;
            }
        });

        setTotalSales(total);

        return Object.entries(groupedData).map(([key, value]) => ({
            name: key,
            value,
            drillDown: drilldownState.level !== 'distributor'
        }));
    };


    const fetchData = async (filters: DrilldownState['filters'], crossFilters: any[]) => {
        try {
            setIsTransitioning(true);

            const payload = {
                filters,
                cross_filters: crossFilters,
                action: "lpg_cdcms_current_financial_year_sales",
                drill_state: ""
            };

            const response = await apiClient.post('/api/charts/generate_vis_data', payload);
            const result = response.data;

            if (result.status && result.data) {
                const transformedData = transformData(result.data);
                setChartData(transformedData);
                setError(null);
            } else {
                setError('No data available');
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setError('No data available');
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
    }, [drilldownState.filters, crossFilters]);

    useEffect(() => {
        if (!chartData.length || isLoading || !chartDivRef.current) return;

        if (chartRef.current) {
            chartRef.current.dispose();
        }

        const root = am5.Root.new(chartDivRef.current);
        chartRef.current = root;

        root.setThemes([am5themes_Animated.new(root)]);
        root._logo?.dispose();
        const getXAxisLabel = () => {
            const labelMap = {
              'ConsumerType': 'ConsumerType',
              'zone': 'Zones',
              'region': 'Regions',
              'salesarea': 'Sales Areas',
              'distributor': 'Distributors'
            };
            return labelMap[drilldownState.level] || 'Time Period';
          };
          
          const createChart = () => {
            const chart = root.container.children.push(
                am5xy.XYChart.new(root, {
                    panX: false,
                    panY: true,
                    wheelX: "none",
                    wheelY: "none",
                    layout: root.verticalLayout,
                    paddingBottom: 20
                })
            );

            // Enhanced tooltip configuration
            const tooltip = am5.Tooltip.new(root, {
                getFillFromSprite: true,
                labelText: "[bold fontSize: 8px]{categoryY}[/]\n[fontSize: 10px]Sales: [bold fontSize: 8px]{valueX.formatNumber('#,###.########')}[/]",
                pointerOrientation: "horizontal",
                centerY: am5.percent(50),
                centerX: am5.percent(100),
                animationDuration: 200
            });

            tooltip.get("background").setAll({
                fillOpacity: 0.95,
                fill: am5.color(0xffffff),
                strokeWidth: 1,
                stroke: am5.color(0xcccccc)
            });

            // // Common legend configuration
            // const legend = chart.children.unshift(
            //     am5.Legend.new(root, {
            //         centerX: am5.percent(50),
            //         x: am5.percent(50),
            //         marginTop: 15,
            //         marginBottom: 15,
            //         layout: root.horizontalLayout,
            //         height: 40,
            //         verticalScrollbar: am5.Scrollbar.new(root, {
            //             orientation: "vertical"
            //         })
            //     })
            // );

            // legend.markers.template.setAll({
            //     width: 18,
            //     height: 18
            // });

            // legend.labels.template.setAll({
            //     fontSize: 12,
            //     fontWeight: "400",
            //     populateText: true,
            //     text: "{name}"
            // });
                // Enhanced X-axis configuration
                const xAxis = chart.xAxes.push(
                    am5xy.ValueAxis.new(root, {
                        renderer: am5xy.AxisRendererX.new(root, {}),
                        numberFormat: "#,###.########",
                        min: 0
                    })
                );

            // Enhanced Y-axis configuration
            const yAxis = chart.yAxes.push(
                am5xy.CategoryAxis.new(root, {
                    categoryField: "name",
                    renderer: am5xy.AxisRendererY.new(root, {
                        minGridDistance: 30,
                        cellStartLocation: 0.1,
                        cellEndLocation: 0.8
                    }),
                    tooltip: am5.Tooltip.new(root, {})
                })
            );

            xAxis.get("renderer").labels.template.setAll({
                rotation: 0,
                centerY: am5.p50,
                centerX: am5.p50,
                paddingTop: 8,
                paddingBottom: 2,
                fontSize: 8,
                maxWidth: 120,
                oversizedBehavior: "truncate",
                textAlign: "center"
              });
            yAxis.get("renderer").labels.template.setAll({
                rotation: 0,
                fontSize: 8,
                maxWidth: 120,
                oversizedBehavior: "truncate",
                textAlign: "center"
              });
                // Add X-axis title with dynamic label
                xAxis.children.push(
                    am5.Label.new(root, {
                    text: "Sales(TMT)",
                    x: am5.p50,
                    centerX: am5.p50,
                    paddingTop: 0,
                    fontSize: 10
                    })
                );
                yAxis.children.unshift(
                    am5.Label.new(root, {
                    text: getXAxisLabel(),
                      rotation: -90,
                      y: am5.p50,
                      centerX: am5.p50,
                      fontSize: 10,
                      paddingBottom: 0
                    })
                  );
                  
            // Add cursor
            chart.set("cursor", am5xy.XYCursor.new(root, {
                behavior: "none",
                xAxis: xAxis,
                yAxis: yAxis
            }));

            // Enhanced series configuration
            const series = chart.series.push(
                am5xy.ColumnSeries.new(root, {
                    name: "Sales",
                    xAxis: xAxis,
                    yAxis: yAxis,
                    valueXField: "value",
                    categoryYField: "name",
                    tooltip
                })
            );

            // Enhanced column template configuration
            series.columns.template.setAll({
                cornerRadiusTR: 5,
                cornerRadiusBR: 5,
                strokeOpacity: 0,
                cursorOverStyle: "pointer",
                tooltipY: 0,
                height: am5.percent(70),
                interactive: true,
                tooltipPosition: "pointer",
                width: am5.percent(40)
            });

            // Enhanced color adaptation
            series.columns.template.adapters.add("fill", (fill, target) => {
                const colors = [
                    am5.color(0x4C5270),
                    am5.color(0xFF45B5),
                    am5.color(0x738d37),
                    am5.color(0xd0e3ff),
                    am5.color(0x0d659d),
                    am5.color(0x1390e0),
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

            // Enhanced hover state
            series.columns.template.states.create("hover", {
                fillOpacity: 0.8,
                strokeOpacity: 0.4,
                stroke: am5.color(0x000000),
                scale: 1.02
            });

            // Enhanced tooltip events
            series.columns.template.events.on("pointerover", function(ev) {
                const column = ev.target;
                column.showTooltip();
            });

            series.columns.template.events.on("pointerout", function(ev) {
                const column = ev.target;
                column.hideTooltip();
            });

            // Click handler
            series.columns.template.events.on("click", (ev) => {
                const dataItem = ev.target.dataItem?.dataContext as ChartDataItem;
                if (dataItem) handleDrillDown(dataItem);
            });

            // Enhanced value labels
            series.bullets.push(() => {
                return am5.Bullet.new(root, {
                    locationX: 1,
                    sprite: am5.Label.new(root, {
                        text: "{valueX.formatNumber('#,###.########')}",
                        centerY: am5.p50,
                        centerX: 1,
                        paddingRight: 5,
                        populateText: true,
                        fontSize: 8
                    })
                });
            });

            const scrollbarY = am5.Scrollbar.new(root, {
                orientation: "vertical",
                marginRight: -10,
                minWidth: 10,
                start: 0,
                end: chartData.length <= 10 ? 1 : 10 / chartData.length,
              });
              chart.set("scrollbarY", scrollbarY);
              chart.rightAxesContainer.children.push(scrollbarY);
              
              scrollbarY.thumb.setAll({
                fillOpacity: 0.2,
                visible: true,
              });
              
              chart.set("scrollbarY", scrollbarY);
              chart.set("cursor", am5xy.XYCursor.new(root, {
                behavior: "none",
                xAxis: xAxis,
                yAxis: yAxis,
              }));
              chart.rightAxesContainer;
              

            return { chart, series, yAxis };
        };

        const { chart, series, yAxis } = createChart();

        // Set data
        yAxis.data.setAll(chartData);
        series.data.setAll(chartData);
        // legend.data.setAll(series.dataItems);

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
            <Card className="h-[280px] relative">
                <CardContent className="h-full flex items-center justify-center">
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
          <CardHeader className="pb-1 p-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs font-bold text-gray-800">
                  Current Year Sales
                </CardTitle>
                <DrillStateIndicator level={drilldownState.level} />
                

                {/* <div className="flex items-center gap-4">
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
                </div> */}
              </div>
              
              <div className="flex items-center gap-2">
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
                  onClick={resetEverything}
                  disabled={isTransitioning}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  title="Reset All"
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
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold mt-1">
  <span className="text-black-600 flex items-center gap-2">
    Total: 
    <span className="text-blue-600">
      {Number.isInteger(totalSales) 
        ? totalSales // Show as integer if it's a whole number
        : totalSales.toFixed(2) // Show with 2 decimals if it's a float
      }
    </span>
  </span>
  
  {/* All financial dropdowns beside the Total */}
  {filterOptions1.map(({ key, label }) => (
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
          </CardHeader>
          
          <CardContent className={`p-0 relative ${isExpanded ? 'h-[calc(100%-60px)]' : 'h-[265px]'} pt-0`}>

          {drillHistory.length > 0 && (
              <div className="text-gray-600 p-1 text-xs">Drill Path: {drillHistory.join(" → ")}</div>
            )}

            {(error || (!isLoading && chartData.length === 0)) && <NoDataDisplay />}
            {isTransitioning && <LoadingOverlay />}
            <div ref={chartDivRef} id="chartdiv"
              className={`w-full ${isExpanded ? 'h-full' : 'h-[260px]'}`}
              />
          </CardContent>
        </Card>
        </div>
    </div>

      )
      
}

export default CurrentYearSales;

