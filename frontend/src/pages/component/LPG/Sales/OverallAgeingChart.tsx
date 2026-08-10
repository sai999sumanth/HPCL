
import React, { useEffect, useState, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2, X, ChevronsUpDown, Check, Maximize2, Minimize2 } from "lucide-react";
import { FilterDropdown } from "./FilterDropdown";
import { getYesterdayDate } from "@/hooks/useYesterdayDate";
import { apiClient } from "@/services/apiClient";

interface FilterDropdown {
    label: string;
    options: string[];
    value: string;
    onChange: (value: string) => void;
    isLoading: boolean;
}

interface FilterOption {
    key: string;
    label: string;
}

interface LocationFilter {
    key: string;
    cond: string;
    value: string;
  }
const filterOptions: FilterOption[] = [
    { key: "ZOName", label: "Zone" },
    { key: "ROName", label: "Region" },
    { key: "SAName", label: "Sales Area" },
    { key: "DistributorName", label: "Distributor" },
    { key: "CylType", label: "Cylinder Type" },

];


interface ChartDataItem {
    name: string;
    value: number;
    drillDown: boolean;
}

interface DrilldownState {
    level: 'ageing' | 'zone' | 'region' | 'salesarea' | 'distributor';
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
        ConsumerType?: { [key: string]: string };
        pending_1_3_days?: { [key: string]: number };
        pending_4_7_days?: { [key: string]: number };
        pending_8_15_days?: { [key: string]: number };
        pending_beyond_15_days?: { [key: string]: number };
    } | Array<any>;
}

const DrillStateIndicator = ({ level }: { level: string }) => {
    const states = ['Ageing', 'Zone', 'Region', 'SalesArea', 'Distributor'];
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
                        className={`w-1.5 h-1.5 rounded-full ${index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'}`}
                    />
                ))}
            </div>
        </div>
    );
};

const OverallAgeingChart = () => {
    const [chartData, setChartData] = useState<ChartDataItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [drilldownState, setDrilldownState] = useState<DrilldownState>({
        level: 'ageing',
        filters: []
    });
    const [drillLevel, setDrillLevel] = useState(0);
    const [filters, setFilters] = useState<LocationFilter[]>([]);
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

    const handleBackClick = async () => {
        if (drilldownState.filters.length > 0) {
            setIsTransitioning(true);
            const newFilters = [...drilldownState.filters];
            newFilters.pop();

            const levels: DrilldownState['level'][] = ['ageing', 'zone', 'region', 'salesarea', 'distributor'];
            const newLevel = levels[newFilters.length] || 'ageing';

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
            ageing: {
                next: 'zone',
                key: dataItem.name.toLowerCase().replace(/ /g, '_')
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
            if (drilldownState.level === 'ageing') {
                newFilters.push({
                    key: `"${currentLevel.key}"`,
                    cond: "equals",
                    value: ""
                });
            } else {
                // Always strip both PMUY and NPMUY suffixes for filter values
                const cleanName = dataItem.name
                    .replace(/ \(PMUY\)$/, '')
                    .replace(/ \(NPMUY\)$/, '');

                newFilters.push({
                    key: currentLevel.key,
                    cond: "equals",
                    value: cleanName
                });
            }

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
              }).then(res => res.data),
            apiClient.post('/api/charts/generate_vis_data', {
                filters: [],
                action: "lpg_cdcms_ageing",
                drill_state: ""
              }).then(res => res.data)
          ]);
      
          // Batch all state updates together
          const resetValues = Object.keys(dropdownResponse).reduce((acc, key) => {
            acc[key] = dropdownResponse[key].includes("NULL") ? "NULL" : "";
            return acc;
          }, {} as Record<string, string>);
      
          // Update all states at once
          setDrilldownState({
            level: 'ageing',
            filters: []
          });
          setActiveFilters([]);
          setCrossFilters([]);
          setDrillHistory([]);
          setFilterData(dropdownResponse);
          setSelectedFilters(resetValues);
      
          // Set chart data last
          if (chartResponse.status && chartResponse.data) {
            const transformedData = transformData(chartResponse.data);
            setChartData(transformedData);
          }
      
        } catch (error) {
          console.error('Error resetting filters:', error);
        } finally {
          setIsLoadingFilters(false);
          setIsTransitioning(false);
        }
      };
    
      const transformData = (data: ApiResponse['data']): ChartDataItem[] => {
        if (drilldownState.level === 'ageing') {
            // Handle the new API response format for ageing level
            if (Array.isArray(data) && data.length > 0) {
                const ageingData = data[0];
                return [
                    {
                        name: 'Pending 1_3 Days',
                        value: ageingData.pending_1_3_days || 0,
                        drillDown: true
                    },
                    {
                        name: 'Pending 4_7 Days',
                        value: ageingData.pending_4_7_days || 0,
                        drillDown: true
                    },
                    {
                        name: 'Pending 8_15 Days',
                        value: ageingData.pending_8_15_days || 0,
                        drillDown: true
                    },
                    {
                        name: 'Pending Beyond 15 Days',
                        value: ageingData.pending_beyond_15_days || 0,
                        drillDown: true
                    }
                ];
            }
            return [];
        }
    
        if (!Array.isArray(data)) return [];
    
        // For zone level and beyond (array data)
        const groupByField = {
            zone: 'ZOName',
            region: 'ROName',
            salesarea: 'SAName',
            distributor: 'DistributorName'
        }[drilldownState.level];
    
        if (!groupByField) return [];
    
        // Group by zone and split by PMUY/NPMUY
        const groupedData: { [key: string]: { PMUY: number; NPMUY: number } } = {};
        data.forEach(item => {
            const key = item[groupByField];
            if (typeof key === 'string') {
                if (!groupedData[key]) {
                    groupedData[key] = { PMUY: 0, NPMUY: 0 };
                }
                groupedData[key].PMUY += Number(item.PMUY || 0);
                groupedData[key].NPMUY += Number(item.NPMUY || 0);
            }
        });
    
        // Convert grouped data to chart format
        const chartData: ChartDataItem[] = [];
        Object.entries(groupedData).forEach(([key, values]) => {
            chartData.push(
                {
                    name: `${key} (PMUY)`,
                    value: values.PMUY,
                    drillDown: drilldownState.level !== 'distributor'
                },
                {
                    name: `${key} (NPMUY)`,
                    value: values.NPMUY,
                    drillDown: drilldownState.level !== 'distributor'
                }
            );
        });
    
        return chartData;
    };
        const fetchData = async (filters: DrilldownState['filters'], crossFilters: any[]) => {
        try {
            setIsTransitioning(true);

            const response = await apiClient.post('/api/charts/generate_vis_data', {
                    filters,
                    cross_filters: crossFilters,
                    action: "lpg_cdcms_ageing",
                    drill_state: ""
                })

            const result = response.data;

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

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: false,
                panY: true,
                wheelX: "none",
                wheelY: "panY", 
                layout: root.verticalLayout,
                paddingBottom: 30
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
        
        const xAxis = chart.xAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: am5xy.AxisRendererX.new(root, {}),
                numberFormat: "#,###",
                min: 0
            })
        );

        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: drilldownState.level === 'ageing' ? "name" : "category",
                renderer: am5xy.AxisRendererY.new(root, {
                    minGridDistance: 30,
                    cellStartLocation: 0.1,
                    cellEndLocation: 0.9
                })
            })
        );
        xAxis.get("renderer").labels.template.setAll({
            rotation: 0,
            centerY: am5.p50,
            centerX: am5.p50,
            paddingTop: 8,
            paddingBottom: 5,
            fontSize: 10,
            maxWidth: 80,
            oversizedBehavior: "truncate",
            textAlign: "center"
          });
          yAxis.get("renderer").labels.template.setAll({
            fontSize: 10
          });
    
        const getyAxisLabel = () => {
            const labelMap = {
              'ageing': 'Ageing',
              'zone': 'Zones',
              'region': 'Regions',
              'salesarea': 'Sales Areas',
              'distributor': 'Distributors'
            };
            return labelMap[drilldownState.level] || 'Time Period';
          };
          // Add axis labels
          xAxis.children.push(
            am5.Label.new(root, {
              x: am5.p50,
              text: "Overall Ageing",
              centerX: am5.p50,
              paddingTop: 20,
              fontSize: 10
            })
          );
    
          yAxis.children.unshift(
            am5.Label.new(root, {
              rotation: -90,
              text: getyAxisLabel(),
              y: am5.p50,
              centerX: am5.p50,
              fontSize: 10,
              paddingBottom: 10
            })
          );
    

        if (drilldownState.level === 'ageing') {
            // Existing ageing level chart logic (horizontal)
            
            const series = chart.series.push(
                am5xy.ColumnSeries.new(root, {
                    name: "Overall Ageing",
                    xAxis: xAxis,
                    yAxis: yAxis,
                    valueXField: "value",
                    categoryYField: "name",
                    tooltip: am5.Tooltip.new(root, {
                        labelText: "[fontSize: 8px bold]{categoryY}[/]\n[fontSize: 8px bold]Value: [fontSize: 8px bold]{valueX}[/]",
                        pointerOrientation: "horizontal",
                        getFillFromSprite: true
                    })
                })
            );

            series.columns.template.setAll({
                cornerRadiusTR: 5,
                cornerRadiusBR: 5,
                strokeOpacity: 0,
                width: am5.percent(90),
                tooltipY: 0,
                height: am5.percent(70),
                interactive: true,
                tooltipPosition: "pointer"
            });

            series.columns.template.adapters.add("fill", (fill, target) => {
                const colors = [
                    am5.color(0x7986CB),
                    am5.color(0x64B5F6),
                    am5.color(0xBA68C8),
                    am5.color(0x4DD0E1)
                ];
                const dataContext = target.dataItem?.dataContext as ChartDataItem;
                const index = chartData.findIndex(item => item.name === dataContext?.name);
                return colors[index % colors.length];
            });
            series.bullets.push(() => {
                            return am5.Bullet.new(root, {
                                locationX: 1,
                                sprite: am5.Label.new(root, {
                                    text: "{valueX.formatNumber('#,###.########')}",
                                    centerY: am5.p50,
                                    centerX: 1,
                                    paddingRight: 5,
                                    populateText: true,
                                    fontSize: 10
                                })
                            });
                        });
            series.columns.template.events.on("click", (ev) => {
                const dataItem = ev.target.dataItem?.dataContext as ChartDataItem;
                if (dataItem) handleDrillDown(dataItem);
            });
            const scrollbarY = am5.Scrollbar.new(root, {
                orientation: "vertical",
                marginLeft: 60
            });
            chart.set("scrollbarY", scrollbarY);
            yAxis.data.setAll(chartData);
            series.data.setAll(chartData);
            legend.data.setAll([series]);
            
        } else {
            // Grouped Horizontal Bar Chart for zone, region, salesarea, and distributor levels
            const processedData = chartData.map((item, index) => {
                // Strip PMUY/NPMUY from the name for the category
                const cleanName = item.name.replace(/ \(PMUY\)$/, '').replace(/ \(NPMUY\)$/, '');
                return {
                    category: cleanName,
                    pmuy: item.name.includes('(PMUY)') ? item.value : 0,
                    npmuy: item.name.includes('(NPMUY)') ? item.value : 0
                };
            }).reduce((acc, curr) => {
                const existing = acc.find(item => item.category === curr.category);
                if (existing) {
                    existing.pmuy = Math.max(existing.pmuy, curr.pmuy);
                    existing.npmuy = Math.max(existing.npmuy, curr.npmuy);
                } else {
                    acc.push(curr);
                }
                return acc;
            }, [] as Array<{ category: string, pmuy: number, npmuy: number }>);

            // PMUY Series
            const pmuySeries = chart.series.push(
                am5xy.ColumnSeries.new(root, {
                    name: "PMUY",
                    xAxis: xAxis,
                    yAxis: yAxis,
                    valueXField: "pmuy",
                    categoryYField: "category",
                    tooltip: am5.Tooltip.new(root, {
                        labelText: "[fontSize: 8px bold]{category} - [fontSize: 8px bold]PMUY[/]\n[fontSize: 8px bold]Value:[fontSize: 8px bold]{valueX}[/]",
                        pointerOrientation: "horizontal"
                    })
                })
            );


            // NPMUY Series
            const npmuySeries = chart.series.push(
                am5xy.ColumnSeries.new(root, {
                    name: "NPMUY",
                    xAxis: xAxis,
                    yAxis: yAxis,
                    valueXField: "npmuy",
                    categoryYField: "category",
                    tooltip: am5.Tooltip.new(root, {
                        labelText: "[fontSize: 8px bold]{category} - [fontSize: 8px bold]NPMUY[/]\n[fontSize: 8px bold]Value: [fontSize: 8px bold]{valueX}[/]",
                        pointerOrientation: "horizontal"
                    })
                })
            );
          
        
        
            // Styling and interactions
            const configureBarSeries = (series: am5xy.ColumnSeries, color: am5.Color) => {
                series.columns.template.setAll({
                    strokeOpacity: 0,
                    cornerRadiusBR: 5,
                    cornerRadiusTR: 5,
                    fill: color,
                    tooltipPosition: "pointer",
                    width: am5.percent(100), // Increase bar width from default
                    height: am5.percent(80) // Reduce gap between bars
            
                });
                series.bullets.push(() => {
                    return am5.Bullet.new(root, {
                        locationX: 1,
                        sprite: am5.Label.new(root, {
                            text: "{valueX.formatNumber('#,###.########')}",
                            centerY: am5.p50,
                            centerX: 1,
                            paddingRight: 5,
                            populateText: true,
                            fontSize: 10
                        })
                    });
                });
    
                series.columns.template.events.on("click", (ev) => {
                    const dataItem = ev.target.dataItem?.dataContext as any;
                    if (dataItem && drilldownState.level !== 'distributor') {
                        handleDrillDown({
                            name: `${dataItem.category} (${series.get("name")})`,
                            value: dataItem[series.get("name")?.toLowerCase() || ""],
                            drillDown: true
                        });
                    }
                });
            };

            configureBarSeries(pmuySeries, am5.color(0x7986CB));
            configureBarSeries(npmuySeries, am5.color(0x64B5F6));

            yAxis.data.setAll(processedData);
            pmuySeries.data.setAll(processedData);
            npmuySeries.data.setAll(processedData);
            legend.data.setAll([pmuySeries, npmuySeries]);
        }

        // Scrollbar and cursor configurations remain the same
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
            visible: true,
          });
          
          chart.set("scrollbarY", scrollbarY);
          chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "none",
            xAxis: xAxis,
            yAxis: yAxis,
          }));
          chart.rightAxesContainer;
          

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
            <Card className="h-[400px] relative">
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
                <CardHeader className="pb-0 p-1">
            <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-bold text-gray-800 whitespace-nowrap">
          Overall Ageing Analysis (cylinders in thousands) ({getYesterdayDate()})
                    </CardTitle>
                    <DrillStateIndicator level={drilldownState.level} />
                    </div>
                    <div className="flex items-center gap-2">
                    <div className="flex items-center gap-4 ">
              {drilldownState.filters.length=== 0 && (
                <div className="flex gap-2">
                  
                  <Button
                    onClick={resetFilters}
                    disabled={isTransitioning}
                    className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
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

                
            )}
              {drilldownState.filters.length > 0 && (
                <div className="flex gap-2">
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
              )}
            </div>
            
          </div>  
          </div>
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


                {/* Active Filters and Drill Path */}
                {/* <div className="px-3 text-xs text-gray-600">
                    {activeFilters.length > 0 && (
                        <div>Active Filters: {activeFilters.map(f => `${f.key}: ${f.value}`).join(", ")}</div>
                    )}
                   
                </div> */}

               </div> </CardHeader>
               <CardContent className={`p-0 relative ${isExpanded ? 'h-[calc(100%-60px)]' : 'h-[330px]'} pt-0`}>
               {drillHistory.length > 0 && (
   <div className="text-gray-600 p-1 text-xs">

                      Drill Path: {drillHistory.join(" → ")}</div>
                    )}
        {isTransitioning && <LoadingOverlay />}
        <div 
          ref={chartDivRef}
          id="chartdiv" 
          className={`w-full ${isExpanded ? 'h-full' : 'h-[300px]'}`}
          />
      </CardContent>
    </Card>
    </div>
    </div>

  );
};
export default OverallAgeingChart;