import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/@/components/ui/separator";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReactTooltip } from "recharts";

// Context for active filters
const ActiveFilterContext = createContext({
    activeCardId: null,
    activeSeverity: null,
    activeAlert: null,
    setActiveSeverity: (cardId: number | null, severity: string | null) => { },
    setActiveAlert: (cardId: number | null, alertName: string | null) => { }
});

// Context for title click filtering
const TitleFilterContext = createContext({
    activeTitleFilter: null,
    setActiveTitleFilter: (cardId: number | null) => { },
});

export const TitleFilterProvider = ({ children }) => {
    const [activeTitleFilter, setActiveTitleFilter] = useState<number | null>(null);
    return (
        <TitleFilterContext.Provider value={{ activeTitleFilter, setActiveTitleFilter }}>
            {children}
        </TitleFilterContext.Provider>
    );
};
const sharedColorPalette = [
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#f97316", // Orange
    "#14b8a6", // Teal
    "#22c55e", // Green
    "#f43f5e", // Red
    "#fbbf24", // Yellow
    "#06b6d4", // Cyan
    "#6366f1", // Indigo
    "#a855f7", // Bright Purple
    "#ef4444", // Bright Red
    "#10b981", // Emerald Green
    "#f59e0b", // Amber
    "#0ea5e9", // Sky Blue
    "#84cc16", // Lime Green
    "#d946ef", // Fuchsia
    "#f97316", // Warm Orange
    "#64748b", // Slate Gray
    "#a3e635", // Neon Green
    "#f472b6", // Hot Pink
    "#4f46e5", // Deep Indigo
    "#f97316", // Burnt Orange
];


export const ActiveFilterProvider = ({ children }) => {
    const [activeCardId, setActiveCardId] = useState<number | null>(null);
    const [activeSeverity, setActiveSeverity] = useState<string | null>(null);
    const [activeAlert, setActiveAlert] = useState<string | null>(null);

    const handleSetActiveSeverity = (cardId: number | null, severity: string | null) => {
        if (activeCardId === cardId && activeSeverity === severity) {
            setActiveCardId(null);
            setActiveSeverity(null);
        } else {
            setActiveCardId(cardId);
            setActiveSeverity(severity);
            setActiveAlert(null);
        }
    };

    const handleSetActiveAlert = (cardId: number | null, alertName: string | null) => {
        if (activeCardId === cardId && activeAlert === alertName) {
            setActiveCardId(null);
            setActiveAlert(null);
        } else {
            setActiveCardId(cardId);
            setActiveAlert(alertName);
            setActiveSeverity(null);
        }
    };

    return (
        <ActiveFilterContext.Provider value={{
            activeCardId,
            activeSeverity,
            activeAlert,
            setActiveSeverity: handleSetActiveSeverity,
            setActiveAlert: handleSetActiveAlert
        }}>
            {children}
        </ActiveFilterContext.Provider>
    );
};

const BCUGantryChart = ({ onSelectName, apiData, refreshKey, dateFilter, viewMode, embedded = false, isLoading: externalLoading = false }) => {
    const rootRef = useRef(null);
    const chartDivRef = useRef(null);
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(true);
    const [chartData, setChartData] = useState([]);
    const [activeFilter, setActiveFilter] = useState(null);
    const [isExpandedchart, setIsExpandedchart] = useState(false);

    // Use external loading state if provided, otherwise use internal state
    const isCurrentlyLoading = externalLoading || isLoading;

    const { activeCardId, activeSeverity, setActiveSeverity } = useContext(ActiveFilterContext);
    const { activeTitleFilter, setActiveTitleFilter } = useContext(TitleFilterContext);

    const processData = useCallback((data) => {
        const aggregatedData = new Map();
        data.forEach((item) => {
            if (item.interlock_name) {
                const interlockName = item.interlock_name;
                const count = item.count || 0;
                aggregatedData.set(interlockName, (aggregatedData.get(interlockName) || 0) + count);
            }
        });
        return Array.from(aggregatedData.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setIsTransitioning(true);
        setError(null);
        try {
            console.log('BCUGantryChart fetchData - Received apiData length:', apiData?.length, 'dateFilter:', dateFilter);
            // Ensure we return an array
            return Array.isArray(apiData) ? apiData : [];
        } catch (error) {
            setError("Failed to process data");
            return [];
        } finally {
            setIsLoading(false);
            setIsTransitioning(false);
        }
    }, [apiData, dateFilter]);

    useEffect(() => {
        let root = null;
      
        const initChart = async () => {
          const filteredData = await fetchData();
          const transformedData = processData(filteredData);
          setChartData(transformedData);
      
          if (!transformedData.length) {
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
              innerRadius: am5.percent(50), // This makes it a donut chart
            })
          );
      
          // Create series
          const series = chart.series.push(
            am5percent.PieSeries.new(root, {
              valueField: "value",
              categoryField: "name",
              endAngle: 270,
            })
          );
      
          // Use the shared color palette in amCharts
          series.set("colors", am5.ColorSet.new(root, {
            colors: sharedColorPalette.map(color => am5.color(color)),
          }));
      
          // Disable labels
          series.labels.template.set("forceHidden", true);
      
          // Disable ticks
          series.ticks.template.set("forceHidden", true);
      
          // Add tooltip
          series.slices.template.set("tooltipText", "{category}: {value}");
      
          // Add click handler for slices
          series.slices.template.events.on("click", (event) => {
            const selectedName = event.target.dataItem.dataContext.name;
            if (activeFilter === selectedName) {
              setActiveFilter(null);
              onSelectName(null);
            } else {
              setActiveFilter(selectedName);
              onSelectName(selectedName);
            }
          });
      
          // Configure slices
          series.slices.template.setAll({
            strokeWidth: 2,
            stroke: am5.color(0xffffff),
            cornerRadius: 5,
            cursorOverStyle: "pointer",
          });
      
          // Add hover effect to slices
          series.slices.template.states.create("hover", {
            scale: 1.05,
            fillOpacity: 0.9,
          });
      
          // Apply active filter if it exists
          if (activeFilter) {
            series.slices.each(function (slice) {
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
      }, [fetchData, isExpandedchart, onSelectName, refreshKey, apiData, activeFilter, dateFilter]);

      const toggleExpand = () => {
        setIsExpandedchart(!isExpandedchart);
    };

    const clearActiveFilter = () => {
        setActiveFilter(null);
        onSelectName(null);
    };

    const totalCount = chartData.reduce((sum, item) => sum + item.value, 0);

    const generateColor = (index) => {
        return sharedColorPalette[index % sharedColorPalette.length];
    };
    
    if (embedded) {
        return (
            <div className="h-full flex flex-col">
                {isCurrentlyLoading ? (
                    <div className="flex items-center justify-center flex-1 w-full">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                            <p className="text-sm text-gray-500">Loading chart data...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center flex-1 w-full">
                        <div className="text-center text-gray-500">No Data Available</div>
                    </div>
                ) : (
                    <div className="flex flex-row flex-1 min-h-0">
                        {/* Chart Section */}
                        <div className="flex flex-col items-center relative w-[50%] h-full">
                            {!isCurrentlyLoading && !isTransitioning && (
                                <div className="absolute top-2 right-2 text-[10px] text-gray-500 z-10">
                                    Click on a slice to filter
                                </div>
                            )}
                            {isTransitioning ? (
                                <div className="flex items-center justify-center h-full w-full">
                                    <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                                </div>
                            ) : (
                                <div
                                    ref={chartDivRef}
                                    style={{ width: "100%", height: "100%", position: "relative" }}
                                >
                                    {chartData.length > 0 && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "50%",
                                                left: "50%",
                                                transform: "translate(-50%, -50%)",
                                                zIndex: 1,
                                                textAlign: "center",
                                                pointerEvents: "none",
                                            }}
                                        >
                                            <div className="font-bold text-2xl">{totalCount}</div>
                                            <div className="text-gray-500 text-xs">Total</div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeFilter && !isCurrentlyLoading && !isTransitioning && (
                                <div className="absolute bottom-2 left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center z-10">
                                    <span>Selected: {activeFilter}</span>
                                    <button
                                        className="ml-2 text-blue-600 hover:text-blue-800"
                                        onClick={clearActiveFilter}
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Legend Section */}
                        <div className="w-[50%] h-full overflow-y-scroll">
                            {isTransitioning ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                </div>
                            ) : (
                                <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
                                    {chartData.length > 0 ? (
                                        chartData.map((entry, index) => (
                                            <div
                                                key={index}
                                                className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors duration-200 
                                                    ${activeFilter === entry.name ? 'bg-blue-50' : 'hover:bg-gray-50 cursor-pointer'} text-xs`}
                                                onClick={() => {
                                                    if (activeFilter === entry.name) {
                                                        setActiveFilter(null);
                                                        onSelectName(null);
                                                    } else {
                                                        setActiveFilter(entry.name);
                                                        onSelectName(entry.name);
                                                    }
                                                }}
                                            >
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: generateColor(index) }}
                                                />
                                                <span className="font-medium text-gray-700 w-32">
                                                    {entry.name || "Unnamed Alert"}
                                                </span>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <div className="flex items-center gap-1">
                                                        <span
                                                            className="font-semibold text-xs"
                                                            style={{ color: generateColor(index) }}
                                                        >
                                                            {entry.value || 0}
                                                        </span>
                                                        <span className="text-gray-400 text-xs">alerts</span>
                                                    </div>
                                                    <div className="h-1 rounded-full bg-gray-100 overflow-hidden w-16">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-300"
                                                            style={{
                                                                backgroundColor: generateColor(index),
                                                                width: `${totalCount > 0
                                                                    ? ((entry.value || 0) / totalCount) * 100
                                                                    : 0
                                                                    }%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-gray-500 text-sm py-4">No data available</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-full max-h-full">
            <Card
                className={`w-full bg-white border border-gray-200 transition-all duration-300 
                    ${isExpandedchart 
                        ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" 
                        : "h-[374px]"}`}
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
                <CardContent className="h-full">
                    {isCurrentlyLoading ? (
                        <div className="flex items-center justify-center h-full w-full">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                                <p className="text-sm text-gray-500">Loading chart data...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full w-full">
                            <div className="text-center text-gray-500">No Data Available</div>
                        </div>
                    ) : (
                        <div 
                            className={`flex transition-all duration-300 ${
                                isExpandedchart 
                                    ? "space-x-4 h-[calc(100%-40px)]" 
                                    : "flex-row h-full"
                            }`}
                        >
                            {/* Chart Section - 70% width in expanded mode */}
                            <div 
                                className={`
                                    flex flex-col items-center relative 
                                    ${isExpandedchart 
                                        ? "w-[65%] h-full" 
                                        : "w-[50%] h-[300px]"
                                    }
                                `}
                            >
                                {/* Instructional text */}
                                {!isCurrentlyLoading && !isTransitioning && (
                                    <div className="absolute top-2 right-2 text-[10px] text-gray-500 z-10">
                                        Click on a slice to filter by interlock
                                    </div>
                                )}
                                {isTransitioning ? (
                                    <div className="flex items-center justify-center h-full w-full">
                                        <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                                    </div>
                                ) : (
                                    <div
                                        ref={chartDivRef}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            position: "relative",
                                        }}
                                    >
                                        {chartData.length > 0 && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "50%",
                                                    left: "50%",
                                                    transform: "translate(-50%, -50%)",
                                                    zIndex: 1,
                                                    textAlign: "center",
                                                    pointerEvents: "none",
                                                }}
                                            >
                                                <div className={`font-bold ${isExpandedchart ? "text-4xl" : "text-2xl"}`}>{totalCount}</div>
                                                <div className={`text-gray-500 ${isExpandedchart ? "text-sm" : "text-xs"}`}>Total</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Active filter indicator */}
                                {activeFilter && !isCurrentlyLoading && !isTransitioning && (
                                    <div className="absolute bottom-2 left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center z-10">
                                        <span>Selected: {activeFilter}</span>
                                        <button
                                            className="ml-2 text-blue-600 hover:text-blue-800"
                                            onClick={clearActiveFilter}
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Top Alerts Section - 30% width in expanded mode */}
                            <div 
                                className={`
                                    ${isExpandedchart 
                                        ? "w-[30%] h-full overflow-y-auto border-l border-gray-200 pl-4" 
                                        : "w-[50%] h-[250px] overflow-y-scroll"
                                    }
                                `}
                            >
                                {/* <h3 className={`font-semibold text-gray-700 mb-2 ${isExpandedchart ? "text-base" : "text-sm"}`}>
                                    Top Alerts
                                </h3> */}
                                {isTransitioning ? (
                                    <div className="flex items-center justify-center h-32">
                                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
                                        {chartData.length > 0 ? (
                                            chartData.map((entry, index) => (
                                                <div
                                                    key={index}
                                                    className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors duration-200 
                                                        ${activeFilter === entry.name ? 'bg-blue-50' : 'hover:bg-gray-50 cursor-pointer'}
                                                        ${isExpandedchart ? 'text-sm' : 'text-xs'}`}
                                                    onClick={() => {
                                                        if (activeFilter === entry.name) {
                                                            setActiveFilter(null);
                                                            onSelectName(null);
                                                        } else {
                                                            setActiveFilter(entry.name);
                                                            onSelectName(entry.name);
                                                        }
                                                    }}
                                                >
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: generateColor(index) }}
                                                    />
                                                    <span className={`font-medium text-gray-700 ${isExpandedchart ? 'w-48' : 'w-32'}`}>
                                                        {entry.name || "Unnamed Alert"}
                                                    </span>
                                                    <div className="flex items-center gap-2 ml-4">
                                                        <div className="flex items-center gap-1">
                                                            <span
                                                                className={`font-semibold ${isExpandedchart ? 'text-sm' : 'text-xs'}`}
                                                                style={{ color: generateColor(index) }}
                                                            >
                                                                {entry.value || 0}
                                                            </span>
                                                            <span className={`text-gray-400 ${isExpandedchart ? 'text-sm' : 'text-xs'}`}>alerts</span>
                                                        </div>
                                                        <div className={`h-1 rounded-full bg-gray-100 overflow-hidden ${isExpandedchart ? 'w-24' : 'w-16'}`}>
                                                            <div
                                                                className="h-full rounded-full transition-all duration-300"
                                                                style={{
                                                                    backgroundColor: generateColor(index),
                                                                    width: `${totalCount > 0
                                                                        ? ((entry.value || 0) / totalCount) * 100
                                                                        : 0
                                                                    }%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center text-gray-500 text-sm py-4">No data available</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
export default BCUGantryChart;