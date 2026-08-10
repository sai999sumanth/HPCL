
import React, { useEffect, useState, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2, CalendarIcon } from "lucide-react";
import { FilterDropdown } from "../../Sales/FilterDropdown";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { apiClient } from "@/services/apiClient";

const filterOptions = [
    { key: "zone", label: "Zone" },
    { key: "plant", label: "Plant" }, 
    { key: "filling_head", label: "Carousel type" },
  ];

const DrillStateIndicator = ({ level }) => {
    const states = ['Zone', 'Plant'];
    const currentIndex = states.indexOf(level.charAt(0).toUpperCase() + level.slice(1));

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

const ExpandedPTRejections = () => {
    const [chartData, setChartData] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [drilldownState, setDrilldownState] = useState({
        level: 'zone',
        filters: [{
            key: '"rejection_type"',
            cond: "equals",
            value: "PT"
        }]
    });
    const [drillHistory, setDrillHistory] = useState([]);
    const chartRef = useRef(null);
    const chartDivRef = useRef(null);
    const [filterData, setFilterData] = useState({});
    const [selectedFilters, setSelectedFilters] = useState({});
    const [isLoadingFilters, setIsLoadingFilters] = useState(true);
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [activeFilters, setActiveFilters] = useState([{
        key: '"rejection_type"',
        cond: "equals",
        value: "PT"
    }]);
    const [crossFilters, setCrossFilters] = useState<Array<{
        key: string;
        cond: string;
        value: string;
    }>>([]);

    const handleBackClick = () => {
        if (drilldownState.filters.length > 1) {
            setIsTransitioning(true);
            const newFilters = [...drilldownState.filters];
            newFilters.pop();

            setDrilldownState({
                level: 'zone',
                filters: newFilters
            });
            setDrillHistory(prev => prev.slice(0, -1));
        }
    };

    const handleDrillDown = async (dataItem) => {
        if (!dataItem?.drillDown) return;

        setIsTransitioning(true);
        const newFilters = [...drilldownState.filters];

        if (drilldownState.level === 'zone') {
            newFilters.push({
                key: '"zone"',
                cond: "equals",
                value: dataItem.name
            });

            setDrilldownState({
                level: 'plant',
                filters: newFilters
            });

            setDrillHistory(prev => [...prev, dataItem.name]);
        }
    };

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

    const fetchFilterOptions = async () => {
        try {
            setIsLoadingFilters(true);
            const response = await apiClient.post('/api/charts/generate_vis_data', {
                    filters: [],
                    action: "operations_dropdown",
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
            fetchData(drilldownState.filters, updatedFilters);
        } catch (error) {
            console.error('Error updating filters:', error);
        } finally {
            setIsLoadingFilters(false);
        }
    };

        const resetFilters = async () => {
        setIsLoadingFilters(true);
        
        try {
            // Fetch initial filter options with no filters before resetting the state
            const response = await apiClient.post('/api/charts/generate_vis_data', {
                    filters: [],
                    action: "operations_dropdown",
                    drill_state: "",
                });
    
            const result = response.data;
            setFilterData(result); // Update filter data first
            
            // Reset active filters after filter data is fetched
            setActiveFilters([{
                key: '"rejection_type"',
                cond: "equals",
                value: "PT"
            }]);
    
            // Reset drill state to initial zone level
            setDrilldownState({
                level: 'zone',
                filters: [{
                    key: '"rejection_type"',
                    cond: "equals",
                    value: "PT"
                }]
            });
    
            // Clear drill history
            setDrillHistory([]);
            
            // Reset the selected filter values
            const resetValues = Object.keys(filterData).reduce((acc, key) => {
                acc[key] = filterData[key].includes("NULL") ? "NULL" : "";
                return acc;
            }, {} as Record<string, string>);
    
            setSelectedFilters(resetValues);
            setCrossFilters([]);
    
            // Fetch data with reset filters
            await fetchData([{
                key: '"rejection_type"',
                cond: "equals",
                value: "PT"
            }], []);
    
        } catch (error) {
            console.error('Error resetting filters:', error);
        } finally {
            setIsLoadingFilters(false);
        }
    };

    const fetchData = async (filters, crossFilters) => {
        try {
            setIsTransitioning(true);

            const response = await apiClient.post('/api/charts/generate_vis_data', {
                    filters,
                    cross_filters: crossFilters,
                    action: "lpg_operations_rejections",
                    drill_state: ""
                });

            const result = response.data;

            if (result.status && result.data) {
                const transformedData = result.data.map(item => ({
                    name: item[drilldownState.level],
                    value: item.Rejections,
                    drillDown: drilldownState.level !== 'plant'
                }));
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
    }, [drilldownState.filters,crossFilters]);

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
                panX: true,
                panY: false,
                wheelX: "none",
                wheelY: "none",
                layout: root.verticalLayout,
                paddingBottom: 0
            })
        );

        // Create category axis
        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "name",
                renderer: am5xy.AxisRendererX.new(root, {
                    minGridDistance:30,
                    cellStartLocation: 0,
                    cellEndLocation: 0.9
                }),
                tooltip: am5.Tooltip.new(root, {})
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

        // Create value axis
        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                maxDeviation: 0.5,
                min: 0,
                strictMinMax: true,
                renderer: am5xy.AxisRendererY.new(root, {
                    pan: "zoom"
                }),
                numberFormat: "#.",
                extraMax: 0.2
            })
        );

        yAxis.get("renderer").labels.template.setAll({
            fontSize: 10
        });

        // Add axis labels
        xAxis.children.push(
            am5.Label.new(root, {
                text: drilldownState.level.charAt(0).toUpperCase() + drilldownState.level.slice(1),
                x: am5.p50,
                centerX: am5.p50,
                paddingTop: 0,
                fontSize: 10
            })
        );

        yAxis.children.unshift(
            am5.Label.new(root, {
                rotation: -90,
                text: "PT Rejections",
                y: am5.p50,
                centerX: am5.p50,
                fontSize: 10,
                paddingBottom: 0
            })
        );

        // Create series
        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: "Rejections",
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: "value",
                categoryXField: "name",
                tooltip: am5.Tooltip.new(root, {
                    labelText: "[bold fontSize: 8px]{categoryX}[/]\n[fontSize: 8px]Value: [bold fontSize: 8px]{valueY}[/]"
                })
            })
        );

        // Configure columns
        series.columns.template.setAll({
            cornerRadiusTL: 5,
            cornerRadiusTR: 5,
            strokeOpacity: 0,
            width: am5.percent(40),
            // tooltipY: 0,
            tooltipX: 0,
                tooltipPosition: "pointer",
            interactive: true
        });

        // Add colors
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

            const dataContext:any = target.dataItem?.dataContext;
            const index = chartData.findIndex(item => item.name === dataContext?.name);
            return colors[index % colors.length];
        });

        // Add legend
        // const legend = chart.children.push(
        //     am5.Legend.new(root, {
        //         centerX: am5.percent(50),
        //         x: am5.percent(50),
        //         marginBottom: 15,
        //         marginTop: 0,
        //         useDefaultMarker: true,
        //         layout: root.horizontalLayout
        //     })
        // );

        // legend.labels.template.setAll({
        //     fontSize: 10,
        //     fontWeight: "400"
        // });

        // Add value labels on top of bars
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

        // Add hover state
        series.columns.template.states.create("hover", {
            fillOpacity: 0.8,
            strokeOpacity: 0.4,
            stroke: am5.color(0x000000),
            scale: 1.02
        });

        // Add click handler for drill-down
        series.columns.template.events.on("click", (ev) => {
            const dataItem = ev.target.dataItem?.dataContext;
            if (dataItem) handleDrillDown(dataItem);
        });

        // Add scrollbar if needed
        if (chartData.length > 10) {
            const scrollbarX = am5.Scrollbar.new(root, {
                orientation: "horizontal",
                marginBottom: 20,
                minHeight: 10,
                start: 0,
                // end: 10 / chartData.length,
            });

            chart.set("scrollbarX", scrollbarX);
            chart.bottomAxesContainer.children.push(scrollbarX);

            scrollbarX.thumb.setAll({
                fillOpacity: 0.2,
                visible: true
            });
        }
        const scrollbarX = am5.Scrollbar.new(root, {
            orientation: "horizontal",
            marginBottom: 20,
            minHeight: 10,
            start: 0,
            // end: chartData.length === 7 ? 1 : 4 / chartData.length
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


        // Set data
        xAxis.data.setAll(chartData);
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
        <Card>
            <CardHeader className="pb-0 p-1">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold text-gray-800">
                        O-Ring Leak Rejection
                        </CardTitle>

                        <div className="flex items-center gap-2">
                            <DrillStateIndicator level={drilldownState.level} />
                            <div className="flex gap-2">
                                {drilldownState.filters.length > 1 && (
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

                    <div className="flex items-center gap-4">
                        <DateRangePickerFilter
                            fromDate={fromDate}
                            toDate={toDate}
                            onFromDateChange={(date) => handleDateChange('from', date)}
                            onToDateChange={(date) => handleDateChange('to', date)}
                            disabled={isLoadingFilters}
                        />
                        <div className="grid grid-cols-3 gap-1">
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
                                        isLoading={isLoadingFilters}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 relative h-[500px] pt-0">
                {drillHistory.length > 0 && (
                    <div className="text-gray-600 p-1 text-xs">
                        Drill Path: {drillHistory.join(" → ")}
                    </div>
                )}
                {isTransitioning && <LoadingOverlay />}
                <div
                    ref={chartDivRef}
                    style={{ width: "100%", height: "480px" }}
                />
            </CardContent>
        </Card>
    );
};

export default ExpandedPTRejections;