
import React, { useState, useEffect, useLayoutEffect } from "react";
import {
    Loader2,
    AlertCircle,
    ChevronRight,
    Search,
    RefreshCw,
    Home,
    Building,
    Truck,
    AlertTriangle,
    Car,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

interface VTSLiveTableProps {
    selectedBu?: string;
    selectedZone?: string | null;
    selectedPlant?: string | null;
    crossFilters?: any[];
    title?: string;
}

export const VTSLiveTCTable: React.FC<VTSLiveTableProps> = ({
    selectedBu ,
    selectedZone ,
    selectedPlant ,
    crossFilters = [
       
    ],
    title = "Trip not closed more than 2 hrs",
}) => {
    const [searchValue, setSearchValue] = useState("");
    const [data, setData] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [drillDownData, setDrillDownData] = useState<any[] | null>(null);
    const [drillDownLoading, setDrillDownLoading] = useState(false);
    const [drillDownError, setDrillDownError] = useState<string | null>(null);
    const [drillDownFilters, setDrillDownFilters] = useState<
        { key: string; value: string }[]
    >([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        setError(null);
        setData(null);
        setDrillDownData(null);
        setDrillDownFilters([]);
        
        try {
            const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
            if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });
            if (selectedPlant) baseFilters.push({ key: "sap_id", cond: "equals", value: selectedPlant });

            const payload = {
                filters: baseFilters,
                action: "vts_ongoing_trips",
                drill_state: "vts_ongoing_trips",
                cross_filters: crossFilters,
                payload: {
                    ongoing_trips_type: "TC",
                },
            };

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });

            if (response.data.data && Array.isArray(response.data.data)) {
                setData(response.data.data);
            } else {
                setData([]);
            }
        } catch (err: any) {
            console.error("Initial fetch error:", err);
            setError(err.response?.data?.message || "Error fetching data.");
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBreadcrumbClick = async (index: number) => {
        const newFilters = drillDownFilters.slice(0, index);
        setDrillDownFilters(newFilters);

        if (newFilters.length === 0) {
            setDrillDownData(null);
            setDrillDownError(null);
            return;
        }

        setDrillDownLoading(true);
        setDrillDownError(null);

        try {
            const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];
            if (selectedZone) baseFilters.push({ key: "zone", cond: "equals", value: selectedZone });

            const filterPayload = newFilters.reduce((acc, f) => {
                acc[f.key] = f.value;
                return acc;
            }, {} as Record<string, any>);

            const payload = {
                filters: baseFilters,
                action: "vts_ongoing_trips",
                drill_state: "vts_ongoing_trips",
                cross_filters: crossFilters,
                payload: {
                    ongoing_trips_type: "TC",
                    ...filterPayload,
                },
            };

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });

            const drillDataArray = Array.isArray(response.data.data) && response.data.data.length > 0
                ? response.data.data
                : null;

            setDrillDownData(drillDataArray);
        } catch (err: any) {
            console.error("Breadcrumb API error:", err);
            setDrillDownError(err.response?.data?.message || "Error fetching data.");
            setDrillDownData(null);
        } finally {
            setDrillDownLoading(false);
        }
    };

    const fetchDrillDownData = async (clickedKey: string, clickedValue: string) => {
        setDrillDownLoading(true);
        setDrillDownError(null);

        try {
            const baseFilters: any[] = [{ key: "bu", cond: "equals", value: selectedBu }];

            const existingFilters = drillDownFilters?.reduce((acc, f) => {
                acc[f.key] = f.value;
                return acc;
            }, {} as Record<string, any>);

            const payload = {
                filters: baseFilters,
                action: "vts_ongoing_trips",
                drill_state: "vts_ongoing_trips",
                cross_filters: crossFilters,
                payload: {
                    ongoing_trips_type: "TC",
                    ...(existingFilters || {}),
                    [clickedKey]: clickedValue,
                },
            };

            const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
                headers: { "Content-Type": "application/json" },
            });

            let drillDataArray: any[] | null = null;
            if (response.data && response.data.data) {
                drillDataArray = Array.isArray(response.data.data) && response.data.data.length > 0
                    ? response.data.data
                    : null;
            }

            setDrillDownData(drillDataArray);
            setDrillDownFilters(prev => [...prev, { key: clickedKey, value: clickedValue }]);
            setSearchValue("");
        } catch (err: any) {
            console.error("Drill-down API error:", err);
            setDrillDownError(err.response?.data?.message || "Error fetching drill-down data.");
            setDrillDownData(null);
        } finally {
            setDrillDownLoading(false);
        }
    };

    const handleRefresh = () => {
        setSearchValue("");
        setDrillDownData(null);
        setDrillDownFilters([]);
        setDrillDownError(null);
        fetchInitialData();
    };

    const displayData = (drillDownData || data) ?? [];

    const filteredData = displayData.filter(row =>
        Object.values(row).some(val =>
            val && String(val).toLowerCase().includes(searchValue.toLowerCase())
        )
    );

    const columns = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];

    const formatHeader = (key: string) => key.replace(/_/g, " ").toUpperCase();

    const getBreadcrumbIcon = (filterKey: string) => {
        switch (filterKey) {
            case "zone":
                return <Home className="w-3 h-3" />;
            case "location_name":
                return <Building className="w-3 h-3" />;
            case "transporter_name":
                return <Truck className="w-3 h-3" />;
            case "tt_number":
                return <Car className="w-3 h-3" />;
            default:
                return null;
        }
    };

    const getBreadcrumbLabel = (filter: { key: string; value: string }) => {
        switch (filter.key) {
            case "zone":
                return `${filter.value} - Locations`;
            case "location_name":
                return `${filter.value} - Transporters`;
            case "transporter_name":
                return `${filter.value} - Vehicles`;
            case "tt_number":
                return `${filter.value} - Details`;
            default:
                return filter.value;
        }
    };

    const getChartData = () => {
        if (filteredData.length === 0) return [];
        
        const nameColumn = columns.find(col => 
            col.toLowerCase().includes('name') || 
            col === 'zone' || 
            col === 'location_name' ||
            col === 'transporter_name' ||
            col === 'tt_number'
        );
        
        const numericColumns = columns.filter(col => {
            const sampleValue = filteredData[0][col];
            return typeof sampleValue === 'number' || 
                   (!isNaN(Number(sampleValue)) && sampleValue !== null && sampleValue !== '');
        });

        if (!nameColumn || numericColumns.length === 0) return [];

        return filteredData.slice(0, 10).map(row => {
            const chartRow: any = { name: row[nameColumn] || 'N/A' };
            numericColumns.forEach(col => {
                chartRow[col] = Number(row[col]) || 0;
            });
            return chartRow;
        });
    };

    const chartData = getChartData();
    const numericColumns = chartData.length > 0 
        ? Object.keys(chartData[0]).filter(key => key !== 'name')
        : [];

    const COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b'];

    // AmCharts Bar Chart Component
    const AmChartsBarChart: React.FC<{ data: any[]; chartId: string }> = ({ data, chartId }) => {
        useLayoutEffect(() => {
            const root = am5.Root.new(chartId);

            // Remove amCharts logo/branding
            root._logo?.dispose();

            root.setThemes([am5themes_Animated.new(root)]);

            const chart = root.container.children.push(
                am5xy.XYChart.new(root, {
                    panX: false,
                    panY: false,
                    wheelX: "none",
                    wheelY: "none",
                    layout: root.verticalLayout,
                })
            );

            // Create Y-axis
            const yAxis = chart.yAxes.push(
                am5xy.ValueAxis.new(root, {
                    renderer: am5xy.AxisRendererY.new(root, {}),
                })
            );

            yAxis.get("renderer").labels.template.setAll({
                fontSize: 10,
            });

            // Create X-axis
            const xAxis = chart.xAxes.push(
                am5xy.CategoryAxis.new(root, {
                    categoryField: "name",
                    renderer: am5xy.AxisRendererX.new(root, {
                        minGridDistance: 30,
                    }),
                })
            );

            xAxis.get("renderer").labels.template.setAll({
                rotation: -45,
                centerY: am5.p50,
                centerX: am5.p100,
                fontSize: 11,
            });

            xAxis.data.setAll(data);

            // Create series for each numeric column
            numericColumns.forEach((field, index) => {
                const series = chart.series.push(
                    am5xy.ColumnSeries.new(root, {
                        name: formatHeader(field),
                        xAxis: xAxis,
                        yAxis: yAxis,
                        valueYField: field,
                        categoryXField: "name",
                        fill: am5.color(COLORS[index % COLORS.length]),
                        stroke: am5.color(COLORS[index % COLORS.length]),
                    })
                );

                series.columns.template.setAll({
                    cornerRadiusTL: 8,
                    cornerRadiusTR: 8,
                    maxWidth: 20,
                    tooltipText: `{name} - ${formatHeader(field)}: {${field}}`,
                });

                // Add labels on top of bars
                series.bullets.push(() => {
                    return am5.Bullet.new(root, {
                        locationY: 1,
                        sprite: am5.Label.new(root, {
                            text: `{${field}}`,
                            fill: am5.color(0x374151),
                            centerY: am5.p100,
                            centerX: am5.p50,
                            populateText: true,
                            fontSize: 10,
                            fontWeight: "600",
                        }),
                    });
                });

                series.data.setAll(data);
            });

            // Add legend if multiple series
            if (numericColumns.length > 1) {
                const legend = chart.children.push(
                    am5.Legend.new(root, {
                        centerX: am5.p50,
                        x: am5.p50,
                    })
                );
                
                legend.labels.template.setAll({
                    fontSize: 10,
                });
                
                legend.data.setAll(chart.series.values);
            }

            return () => {
                root.dispose();
            };
        }, [data, chartId]);

        return <div id={chartId} style={{ width: "100%", height: "350px" }}></div>;
    };

    return (
        <div className="w-full h-full flex flex-col bg-white">
            {/* Header */}
            <div className="px-4 py-3  bg-gradient-to-r from-blue-50 to-indigo-50 border-b ">
                <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleRefresh}
                            className="p-1.5 hover:bg-white/30 rounded transition-colors group"
                            aria-label="Refresh"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4 text-gray-700 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-300" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Breadcrumb + Search */}
            {!error && !drillDownError && displayData && displayData.length > 0 && (
                <div className="px-6 pt-5 pb-4 bg-white">
                    <div className="space-y-3">
                        {/* Breadcrumb */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                                <button
                                    onClick={() => handleBreadcrumbClick(0)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                        drillDownFilters.length === 0
                                            ? "bg-blue-600 text-white font-medium"
                                            : "text-blue-600 hover:bg-blue-100"
                                    }`}
                                >
                                    <Home className="w-3 h-3" />
                                    Home
                                </button>

                                {drillDownFilters.map((filter, index) => (
                                    <React.Fragment key={index}>
                                        <ChevronRight className="w-3 h-3 text-gray-400" />
                                        <button
                                            onClick={() => handleBreadcrumbClick(index + 1)}
                                            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                                index === drillDownFilters.length - 1
                                                    ? "bg-blue-600 text-white font-medium"
                                                    : "text-blue-600 hover:bg-blue-100"
                                            }`}
                                        >
                                            {getBreadcrumbIcon(filter.key)}
                                            {getBreadcrumbLabel(filter)}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                            
                            <div className="text-xs text-gray-600 flex-shrink-0">
                                {drillDownFilters.length === 0 && 'Click on any zone to view locations'}
                                {drillDownFilters.length === 1 && drillDownFilters[0].key === 'zone' && 'Click on any location to view transporters'}
                                {drillDownFilters.length === 2 && drillDownFilters[1].key === 'location_name' && 'Click on any transporter to view TT numbers'}
                                {drillDownFilters.length === 3 && drillDownFilters[2].key === 'transporter_name' && 'Showing TT number details'}
                            </div>
                        </div>

                        {/* Search */}
                        {/* <div className="relative group max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3 transition-colors group-focus-within:text-blue-600" />
                            <input
                                type="text"
                                placeholder="Search all columns..."
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-gray-50 hover:bg-white transition-all"
                            />
                        </div> */}
                    </div>
                </div>
            )}
            
            {/* Body */}
            <div className="flex-1 overflow-auto">
                {/* Error */}
                {(error || drillDownError) && !loading && !drillDownLoading && (
                    <div className="m-6">
                        <div className="flex items-center p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-xl shadow-lg">
                            <AlertCircle className="w-6 h-6 text-blue-600 mr-3" />
                            <span className="text-blue-900 font-medium">{error || drillDownError}</span>
                        </div>
                    </div>
                )}

                {/* No Data Message */}
                {drillDownData === null && drillDownFilters.length > 0 && !loading && !drillDownLoading && !error && !drillDownError && (
                    <div className="m-6">
                        <div className="flex items-center p-5 bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 rounded-xl shadow-lg">
                            <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                            <span className="text-yellow-900 font-medium">No data available for the selected drill-down level.</span>
                        </div>
                    </div>
                )}

                {/* Grid View - Chart and Table side by side */}
                {!error && !drillDownError && (
                    <div className="px-6 pb-4 mt-1 grid grid-cols-2 gap-4">
                        {/* Chart Section */}
                        <div className="rounded-xl shadow-lg overflow-hidden border border-gray-200 bg-white p-6">
                            {/* <h5 className="text-sm font-semibold text-gray-700 mb-4">Chart View</h5> */}
                            {(loading || drillDownLoading) ? (
                                <div className="flex flex-col items-center justify-center h-96">
                                    <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                                    <span className="text-gray-700 font-semibold mt-4 text-sm">
                                        Loading data...
                                    </span>
                                </div>
                            ) : chartData.length > 0 ? (
                                <AmChartsBarChart
                                    data={chartData}
                                    chartId={`vtslive-tc-chart-${drillDownFilters.length}`}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                                    <AlertTriangle className="w-10 h-10 mb-2" />
                                    <span className="text-sm font-medium">No data available for chart</span>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl shadow-lg overflow-hidden border border-gray-200">
 

  {/* Scrollable Table Container */}
  <div className="max-h-[350px] overflow-y-auto overflow-x-auto">
    <table className="w-full border-collapse">
      {/* Sticky Header */}
      <thead className="sticky top-0 z-20 bg-gray-100 shadow-sm">
        <tr className="border-b border-gray-300">
          {columns.map((key) => (
            <th
              key={key}
              className="px-3 py-2 text-left text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-100"
            >
              {formatHeader(key)}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y">
        {/* Loading State */}
        {(loading || drillDownLoading) && (
          <tr>
            <td colSpan={columns.length} className="px-3 py-12">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="text-gray-700 font-semibold mt-4 text-sm">
                  Loading data...
                </span>
              </div>
            </td>
          </tr>
        )}

        {/* Data Rows */}
        {!loading &&
          !drillDownLoading &&
          filteredData.length > 0 &&
          filteredData.map((row, index) => (
            <tr key={index} className="bg-white hover:bg-blue-50 transition-colors">
              {columns.map((key, i) => {
                if (["zone", "location_name", "transporter_name", "tt_number"].includes(key)) {
                  return (
                    <td
                      key={i}
                      className="px-3 py-2 whitespace-nowrap text-sm text-blue-600 hover:underline cursor-pointer font-medium"
                      onClick={() => fetchDrillDownData(key, String(row[key]))}
                    >
                      {row[key] ?? "-"}
                    </td>
                  );
                }
                return (
                  <td key={i} className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                    {row[key] ?? "-"}
                  </td>
                );
              })}
            </tr>
          ))}

        {/* Empty State */}
        {!loading && !drillDownLoading && filteredData.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="px-3 py-12 text-center">
              <div className="flex flex-col items-center justify-center text-gray-500">
                <AlertTriangle className="w-10 h-10 mb-2" />
                <span className="text-sm font-medium">No data available</span>
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>

                    </div>
                )}
            </div>
        </div>
    );
};
