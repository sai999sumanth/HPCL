import React, { useEffect, useMemo, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { AgGridReact } from "ag-grid-react";
import {
  ColDef,
  IFilterParams,
  IDoesFilterPassParams,
} from "ag-grid-community";
import { Loader2, RotateCcw, Maximize2, Minimize2, ArrowLeft } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay";
import {
  ZoneGroupedBarChart,
  stripZonePrefixFromGroupLabel,
  type OverallDataItem as ZoneBarOverallLineDatum,
} from "@/components/widgets/zone-grouped-bar";

interface ApiDataPoint {
  avg_productivity: number;
  process_date: string;
}

interface OverallDataItem {
  month_date: string;
  total_production: number;
  total_net_hours: number;
  productivity: number;
}

interface ZoneDataItem {
  month_date: string;
  zone: string;
  total_production: number;
  total_net_hours: number;
  productivity: number;
}

interface LocationDataItem {
  month_date: string;
  location: string;
  sap_id: string;
  zone: string;
  total_production: number;
  total_net_hours: number;
  productivity: number;
}

interface OverallSummary {
  average_productivity: number;
  max_productivity?: number;
  min_productivity?: number;
  total_production?: number;
  total_net_hours?: number;
  overall_productivity?: number;
}

interface MonthlyProductivityResponse {
  status: boolean;
  message: string;
  overall_data?: OverallDataItem[];
  overall_summary?: OverallSummary;
  zone_data?: ZoneDataItem[];
  zone_summary?: OverallSummary;
  location_data?: LocationDataItem[];
  location_summary?: OverallSummary;
}

interface LPGOPDailyProductivitytrendProps {
  activeFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  crossFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  onResetFilters: () => void
  headerFilters?: React.ReactNode
}

const DrillStateIndicator = ({ drillLevel }: { drillLevel: number }) => {
  const states = ["Zone", "Plant"];
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{states[drillLevel]}</span>
      <div className="flex gap-1">
        {states.map((_, index) => (
          <div key={index} className={`w-2 h-2 rounded-full ${index === drillLevel ? "bg-blue-600" : "bg-gray-300"}`} />
        ))}
      </div>
    </div>
  );
};

const LPGOPDailyProductivitytrend:React.FC<LPGOPDailyProductivitytrendProps> = ({
  activeFilters,
  crossFilters,
  onResetFilters,
  headerFilters,
}:LPGOPDailyProductivitytrendProps) => {
  const rootRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const isInitializing = useRef(false);
  const initCancelledRef = useRef(false);
  /** Avoid duplicate `lpg_operations_daywise_productivity` calls when the effect re-runs (e.g. `customAverageProductivity` or equivalent `cross_filters`). */
  const dailyProductivityCacheRef = useRef<{ key: string; data: unknown[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [averageProductivity, setAverageProductivity] = useState<number | null>(null);
  const [customAverageProductivity, setCustomAverageProductivity] = useState<number | null>(null);

  // Add states for filters similar to GDRejections
  const [filterData, setFilterData] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  // Daily = daily chart; Monthly = monthly API with overall/zone/plant
  const [timeView, setTimeView] = useState<"daily" | "monthly">("daily");
  const [dataView, setDataView] = useState<"overall" | "zone" | "plant">("overall");
  const [monthlyData, setMonthlyData] = useState<MonthlyProductivityResponse | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  // Drilldown from zone bar: show locations bar chart for this zone + month
  const [drilldownFromZone, setDrilldownFromZone] = useState<{ zone: string; monthDate: string } | null>(null);

  // Refresh chart with current filters
  const resetFilters = async () => {
    setIsLoadingFilters(true);
    setIsLoading(true);
    // Clear error state when resetting
    setError(null);
    // Reset the initialization guard to allow re-initialization
    isInitializing.current = false;

    try {
      // Reset date filters locally
      setFromDate(null);
      setToDate(null);

      // Fetch initial filter options
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "operations_dropdown",
          drill_state: "",
        })

      const result = response.data;
      setFilterData(result);

      // Reset selected filters
      const resetValues = Object.keys(result).reduce((acc, key) => {
        acc[key] = result[key].includes("NULL") ? "NULL" : "";
        return acc;
      }, {} as Record<string, string>);

      setSelectedFilters(resetValues);

      // Force chart to reinitialize by updating refreshKey
      setRefreshKey(prev => prev + 1);

    } catch (error) {
      console.error('Error resetting filters:', error);
      setError("Failed to reset filters");
    } finally {
      setIsLoadingFilters(false);
      setIsLoading(false);
    }
  };

  // Fetch filter options like in GDRejections
  const fetchFilterOptions = async () => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [],
          action: "operations_dropdown",
          drill_state: ""
        })

      const result = response.data;
      setFilterData(result);

      // Initialize filters with empty values
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

  // Build cross_filters for daily view: last 30 days (replace any existing DATE filter)
  const getDailyViewFilters = (filters: typeof crossFilters) => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const dateFilter = { key: '"DATE"', cond: "equals" as const, value: `${startStr},${endStr}` };
    const withoutDate = (filters || []).filter((f) => f.key !== '"DATE"');
    return [...withoutDate, dateFilter];
  };

  // Modified fetchData to use filters
  const fetchData = async (appliedFilters = []) => {
    setIsTransitioning(true);
    // Clear error state before fetching new data
    setError(null);

    try {
      const payload = {
        filters: [],
        cross_filters: appliedFilters,
        action: "lpg_operations_daywise_productivity",
        drill_state: "",
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", payload);

      const result = response.data;

      if (result.data && result.data.length > 0) {
        // Clear any previous error
        setError(null);
        return result.data;
      } else {
        setError("No data available");
        return null;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("No data available");
      return null;
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  // Modified Get Card data to accept filters
  const getCardChartAverageProductivity = async (appliedFilters = []) => {
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [],
        cross_filters: appliedFilters, // Pass the applied filters here
        action: 'card_chart',
        drill_state: "lpg_operations_current_month_productivity",
      });
      
      if (response.data?.status) {
        setCustomAverageProductivity(response.data.data[0]?.["Total Productivity"]);
      } else {
        setCustomAverageProductivity(null);
      }
    } catch (error) {
      console.error('Error fetching average productivity:', error);
      setCustomAverageProductivity(null);
    }
  };

  // Fetch monthly productivity (zone_data + location_data)
  const fetchMonthlyData = async (
    appliedFilters = [],
    setState = true
  ): Promise<MonthlyProductivityResponse | null> => {
    if (setState) {
      setIsTransitioning(true);
      setError(null);
    }
    try {
      const payload = {
        filters: [],
        cross_filters: appliedFilters,
        action: "lpg_operations_monthwise_productivity",
        drill_state: "",
      };
      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
      const result = response.data as MonthlyProductivityResponse;
      if (result?.status && (result.overall_data || result.zone_data || result.location_data)) {
        if (setState) setMonthlyData(result);
        return result;
      }
      if (setState) setError("No data available");
      return null;
    } catch (err) {
      console.error("Error fetching monthly productivity:", err);
      if (setState) setError("No data available");
      return null;
    } finally {
      if (setState) {
        setIsLoading(false);
        setIsTransitioning(false);
      }
    }
  };

  // Format month_date "2025-09-01" -> "Sep 2025"
  const formatMonthLabel = (monthDate: string): string => {
    try {
      const d = new Date(monthDate);
      const mon = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      return `${mon} ${year}`;
    } catch {
      return monthDate;
    }
  };

  const stripLPGPlantFromLabel = (str: string): string => {
    if (!str || typeof str !== "string") return str;
    const s = str.trim();
    // Remove leading "LPG Plant" / "LPG Plant - " and trailing " LPG Plant" / " LPG PLANT"
    return s
      .replace(/^LPG\s+Plant\s*(-\s*)?/i, "")
      .replace(/\s*LPG\s+Plant\s*$/i, "")
      .trim() || s;
  };

  // Y-axis min/max from data so line chart variation is visible (not flattened by fixed 0–max scale)
  const getYAxisRange = (values: number[], paddingPercent = 0.1): { min: number; max: number } => {
    if (!values.length) return { min: 0, max: 100 };
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const oneScale = range * 0.3;
    const padding = Math.max(range * paddingPercent, range * 0.05) + oneScale;
    return {
      min: Math.max(0, minVal - padding),
      max: maxVal + padding,
    };
  };

  // Overall: use overall_data directly — month_date on x-axis, productivity on y-axis
  const transformOverallDataToChart = (
    data: OverallDataItem[] | undefined
  ): { date: string; label: string; value: number }[] => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => new Date(a.month_date).getTime() - new Date(b.month_date).getTime())
      .map((d) => ({
        date: d.month_date,
        label: formatMonthLabel(d.month_date),
        value: Number(Number(d.productivity).toFixed(2)),
      }));
  };

  // Pivot location_data: one row per location, columns = Location, SAP ID, Zone, then one column per month (productivity)
  const pivotLocationDataByMonth = (
    data: LocationDataItem[] | undefined
  ): { months: string[]; rows: { location: string; sap_id: string; zone: string; byMonth: Record<string, number> }[] } => {
    if (!data || data.length === 0) return { months: [], rows: [] };
    const months = [...new Set(data.map((d) => d.month_date))].sort();
    const key = (r: LocationDataItem) => `${r.location}|${r.sap_id}|${r.zone}`;
    const map = new Map<string, { location: string; sap_id: string; zone: string; byMonth: Record<string, number> }>();
    data.forEach((d) => {
      const k = key(d);
      if (!map.has(k)) map.set(k, { location: d.location, sap_id: d.sap_id, zone: d.zone, byMonth: {} });
      const row = map.get(k)!;
      row.byMonth[d.month_date] = Number(Number(d.productivity).toFixed(2));
    });
    const rows = Array.from(map.values());
    return { months, rows };
  };

  // Location data for one zone -> month-wise grouped chart (one row per month, one column per plant)
  const transformLocationDataByZoneToChart = (
    data: LocationDataItem[] | undefined,
    zone: string
  ): { chartData: Record<string, unknown>[]; groups: string[] } => {
    if (!data || data.length === 0) return { chartData: [], groups: [] };
    const zoneData = data.filter((d) => String(d.zone).trim() === zone);
    if (zoneData.length === 0) return { chartData: [], groups: [] };
    const dateStrings = [...new Set(zoneData.map((d) => String(d.month_date).trim()))];
    const dates = dateStrings.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const groups = [...new Set(zoneData.map((d) => d.location || d.sap_id || "—"))].sort();
    const chartData = dates.map((date) => {
      const row: Record<string, unknown> = {
        date,
        label: formatMonthLabel(date),
      };
      groups.forEach((plantName) => {
        const item = zoneData.find(
          (d) =>
            String(d.month_date).trim() === date &&
            (d.location || d.sap_id || "—") === plantName
        );
        const val = item ? item.productivity : null;
        row[plantName] = val != null ? Number(Number(val).toFixed(2)) : null;
      });
      return row;
    });
    return { chartData, groups };
  };

  // Zone: zone_data -> one line per zone; use "zone" key. Use "date" as category for stable slots.
  const transformZoneDataToChart = (
    data: ZoneDataItem[] | undefined
  ): { chartData: Record<string, unknown>[]; groups: string[] } => {
    if (!data || data.length === 0) return { chartData: [], groups: [] };
    const dateStrings = [...new Set(data.map((d) => String(d.month_date).trim()))];
    const dates = dateStrings.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const groups = [...new Set(data.map((d) => String(d.zone).trim()))].sort();
    const chartData = dates.map((date) => {
      const row: Record<string, unknown> = {
        date,
        label: formatMonthLabel(date),
      };
      groups.forEach((g) => {
        const item = data.find((d) => String(d.month_date).trim() === date && String(d.zone).trim() === g);
        const val = item ? item.productivity : null;
        row[g] = val != null ? Number(Number(val).toFixed(2)) : null;
      });
      return row;
    });
    return { chartData, groups };
  };

  // When monthly + zone view (no drilldown), use reusable ZoneGroupedBarChart with this config
  const zoneChartConfig = useMemo(() => {
    if (timeView !== "monthly" || dataView !== "zone" || drilldownFromZone || !monthlyData?.zone_data) return null;
    const { chartData, groups } = transformZoneDataToChart(monthlyData.zone_data);
    if (chartData.length === 0 || groups.length === 0) return null;
    return { chartData, groups };
  }, [timeView, dataView, drilldownFromZone, monthlyData?.zone_data]);

  /** Right-axis overall productivity line on zone bars — same `overall_data` merge as plant drill level. */
  const zoneOverallLineData = useMemo((): ZoneBarOverallLineDatum[] | undefined => {
    if (!monthlyData?.overall_data?.length) return undefined;
    return monthlyData.overall_data.map((d) => ({
      month_date: d.month_date,
      productivity: Number(Number(d.productivity).toFixed(2)),
    }));
  }, [monthlyData?.overall_data]);

  // Function to aggregate data by date
  const aggregateDataByDate = (data) => {
    if (!data || !Array.isArray(data)) return [];
    
    const aggregated = {};
    let totalProductivity = 0;
    let dataPointCount = 0;
    
    // Group and sum values by date
    data.forEach(item => {
      const date = item.process_date;
      const productivity = item["avg_productivity"] || 0;
      
      if (!aggregated[date]) {
        aggregated[date] = 0;
      }
      aggregated[date] += productivity;
      
      // Add to total for average calculation
      totalProductivity += productivity;
      dataPointCount++;
    });
    
    // Calculate the average
    const average = dataPointCount > 0 ? totalProductivity / dataPointCount : 0;
    setAverageProductivity(Number(average.toFixed(2)));
    
    // Convert to array and sort by date
    return Object.keys(aggregated)
      .map(date => ({
        date,
        value: Number(aggregated[date].toFixed(2))
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  /** Stable key so we do not refetch card_chart when `crossFilters` gets a new array reference with the same payload. */
  const cardChartCrossKey = useMemo(() => JSON.stringify(crossFilters ?? []), [crossFilters]);

  // Fetch filter options on component mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Single card_chart load: no duplicate mount + `crossFilters` run (both used to fire with `[]`).
  // KPI / LPG bar applies TDY in a follow-up effect — skip until `cross_filters` are present.
  useEffect(() => {
    if (!crossFilters?.length) {
      setCustomAverageProductivity(null);
      return;
    }
    void getCardChartAverageProductivity(crossFilters);
  }, [cardChartCrossKey]);

  // Fetch monthly data when Monthly view is selected (no date filter so all months show)
  useEffect(() => {
    if (timeView === "monthly") {
      const filtersWithoutDate = (crossFilters || []).filter((f) => f.key !== '"DATE"');
      fetchMonthlyData(filtersWithoutDate);
    } else {
      setMonthlyData(null);
    }
  }, [timeView, crossFilters]);

  // Clear zone drilldown when switching view
  useEffect(() => {
    setDrilldownFromZone(null);
  }, [timeView, dataView]);

  // Same zone/bar palette as Valve Leak Rejection (LPGGDRejection)
  const ZONE_COLOR_PALETTE = [
    0x4e79a7, 0x59a14f, 0xf28e2b, 0xe15759, 0xb07aa1,
    0x76b7b2, 0xedc948, 0xff9da7, 0x9c755f, 0xbab0ac,
    0x79706e, 0xd4a574,
  ];
  // Valve Leak Rejection line/accent colors (used for productivity line in Zone view)
  const VALVE_LEAK_LINE_COLOR = 0x1976d2;   // Bright Blue (fill in Valve Leak Present bars)
  const VALVE_LEAK_LABEL_COLOR = 0x0288d1;  // Bright Cyan
  const VALVE_LEAK_LABEL_BG = 0xefefef;     // Light grey background for labels

  // Initialize chart and handle data updates
  useEffect(() => {
    let root: am5.Root | null = null;
    initCancelledRef.current = false;

    const initChart = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;
      // Zone bar chart is rendered by reusable ZoneGroupedBarChart component
      if (timeView === "monthly" && dataView === "zone" && !drilldownFromZone) {
        isInitializing.current = false;
        return;
      }
      if (!chartDivRef.current) return;
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }

      const isDaily = timeView === "daily";

      if (isDaily) {
        const dailyFilters = getDailyViewFilters(crossFilters);
        const cacheKey = `${refreshKey}|${JSON.stringify(dailyFilters)}`;
        const cached = dailyProductivityCacheRef.current;
        const cacheHit =
          cached?.key === cacheKey && Array.isArray(cached.data) && cached.data.length > 0;

        let apiData: unknown[] | null = null;
        if (cacheHit) {
          apiData = cached!.data;
          setIsLoading(false);
          setIsTransitioning(false);
        } else {
          const fetched = await fetchData(dailyFilters);
          apiData = Array.isArray(fetched) ? fetched : null;
          if (apiData && apiData.length > 0) {
            dailyProductivityCacheRef.current = { key: cacheKey, data: apiData };
          }
        }

        if (initCancelledRef.current || !chartDivRef.current) {
          isInitializing.current = false;
          return;
        }
        if (!apiData || apiData.length === 0) {
          setError("No data available");
          isInitializing.current = false;
          return;
        }
        setError(null);
        const transformedData = aggregateDataByDate(apiData);
        const processedData = transformedData
          .map((item) => ({
            date: item.date,
            value: item.value,
            timestamp: new Date(item.date).getTime(),
          }))
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-30);

        if (initCancelledRef.current || !chartDivRef.current) {
          isInitializing.current = false;
          return;
        }
        if (rootRef.current) {
          rootRef.current.dispose();
          rootRef.current = null;
        }
        root = am5.Root.new(chartDivRef.current);
        rootRef.current = root;
        root._logo?.dispose();
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(
          am5xy.XYChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            layout: root.verticalLayout,
            paddingBottom: 0,
            paddingRight: 20,
          })
        );

        const xAxis = chart.xAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "date",
            renderer: am5xy.AxisRendererX.new(root, {
              minGridDistance: 1,
              cellStartLocation: 0.1,
              cellEndLocation: 0.9,
            }),
            tooltip: am5.Tooltip.new(root, {}),
          })
        );
        xAxis.get("renderer").labels.template.setAll({
          rotation: -90,
          centerY: am5.p50,
          centerX: am5.p100,
          fontSize: 10,
          paddingTop: 10,
          paddingRight: 0,
          inside: false,
          oversizedBehavior: "none",
          maxWidth: 200,
          minPosition: 0.01,
          maxPosition: 0.99,
          fill: am5.color(0x000000),
        });
        xAxis.get("renderer").grid.template.setAll({ visible: true, location: 0.5 });
        xAxis.get("renderer").labels.template.adapters.add("text", (text: string) => text);
        xAxis.data.setAll(processedData);

        const dailyValues = processedData.map((d) => d.value);
        if (customAverageProductivity != null) dailyValues.push(customAverageProductivity);
        const dailyRange = getYAxisRange(dailyValues);
        const yAxis = chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {}),
            min: dailyRange.min,
            max: dailyRange.max,
            strictMinMax: true,
          })
        );
        yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: "Productivity",
            xAxis,
            yAxis,
            valueYField: "value",
            categoryXField: "date",
            stroke: am5.color(0x297ab1),
            fill: am5.color(0x297ab1),
            tooltip: am5.Tooltip.new(root, {
              labelText: "[bold]{valueY}[/] Cylinder/Hour \n{categoryX}",
              pointerOrientation: "horizontal",
              dx: 5,
            }),
          })
        );

        if (customAverageProductivity !== null) {
          chart.series.push(
            am5xy.LineSeries.new(root, {
              name: "Average",
              xAxis,
              yAxis,
              valueYField: "average",
              categoryXField: "date",
              stroke: am5.color(0xff0000),
            })
          );
          const averageSeries = chart.series.getIndex(1) as am5xy.LineSeries;
          averageSeries?.data.setAll(
            processedData.map((item) => ({ date: item.date, average: customAverageProductivity }))
          );
          chart.plotContainer.children.push(
            am5.Label.new(root, {
              text: `Average: ${customAverageProductivity} Cylinder/Hour`,
              fontSize: 12,
              fontWeight: "bold",
              fill: am5.color(0xff0000),
              background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0xffffff),
                fillOpacity: 0.8,
                stroke: am5.color(0xff0000),
                strokeOpacity: 0.5,
                strokeWidth: 1,
              }),
              paddingTop: 5,
              paddingBottom: 5,
              paddingLeft: 10,
              paddingRight: 10,
              x: am5.percent(80),
              y: 15,
            })
          );
        }

        series.bullets.push((root, _series, dataItem) => {
          const container = am5.Container.new(root, {});
          const valueY = dataItem.get("valueY");
          const roundvalue = Math.round(valueY);
          container.children.push(
            am5.Circle.new(root, {
              radius: 5,
              fill: am5.color(0x297ab1),
              stroke: root.interfaceColors.get("background"),
              strokeWidth: 2,
            })
          );
          container.children.push(
            am5.Label.new(root, {
              text: `${roundvalue}`,
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontWeight: "600",
              fontSize: 10,
              fill: am5.color(0x297ab1),
              background: am5.RoundedRectangle.new(root, { fill: am5.color(0xffffff), fillOpacity: 0.8 }),
              paddingTop: 4,
              paddingBottom: 4,
              paddingLeft: 6,
              paddingRight: 6,
              dy: -8,
            })
          );
          return am5.Bullet.new(root, { sprite: container });
        });

        chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis }));
        const scrollEndDaily = processedData.length <= 20 ? 1 : Math.min(1, 20 / processedData.length);
        chart.set(
          "scrollbarX",
          am5.Scrollbar.new(root, { orientation: "horizontal", marginBottom: 15, height: 10, start: 0, end: scrollEndDaily })
        );
        series.data.setAll(processedData);
        series.appear(1000);
        chart.appear(1000, 100);
      } else {
        if (!monthlyData) {
          if (rootRef.current) {
            rootRef.current.dispose();
            rootRef.current = null;
          }
          isInitializing.current = false;
          return;
        }
        const data = monthlyData;
        // Monthly + Plant: bar chart of all locations (avg productivity across months)
        if (dataView === "plant" && data?.location_data?.length) {
          setError(null);
          const locByKey = new Map<string, { location: string; sap_id: string; zone: string; sum: number; count: number }>();
          data.location_data.forEach((d) => {
            const k = `${d.location}|${d.sap_id}|${d.zone}`;
            if (!locByKey.has(k)) locByKey.set(k, { location: d.location, sap_id: d.sap_id, zone: d.zone, sum: 0, count: 0 });
            const row = locByKey.get(k)!;
            row.sum += Number(d.productivity);
            row.count += 1;
          });
          const locationChartData = Array.from(locByKey.values())
            .map((r) => ({ location: stripLPGPlantFromLabel(r.location), zone: r.zone, value: Number((r.sum / r.count).toFixed(2)) }))
            .sort((a, b) => a.location.localeCompare(b.location));
          if (locationChartData.length > 0) {
            if (initCancelledRef.current || !chartDivRef.current) {
              isInitializing.current = false;
              return;
            }
            if (rootRef.current) {
              rootRef.current.dispose();
              rootRef.current = null;
            }
            root = am5.Root.new(chartDivRef.current);
            rootRef.current = root;
            root._logo?.dispose();
            root.setThemes([am5themes_Animated.new(root)]);
            const chart = root.container.children.push(
              am5xy.XYChart.new(root, {
                panX: true,
                panY: true,
                wheelX: "panX",
                wheelY: "none",
                layout: root.verticalLayout,
                paddingBottom: 0,
                paddingRight: 20,
              })
            );
            const xAxis = chart.xAxes.push(
              am5xy.CategoryAxis.new(root, {
                categoryField: "location",
                renderer: am5xy.AxisRendererX.new(root, {
                  minGridDistance: 20,
                  cellStartLocation: 0.1,
                  cellEndLocation: 0.9,
                }),
                tooltip: am5.Tooltip.new(root, {}),
              })
            );
            xAxis.data.setAll(locationChartData);
            xAxis.get("renderer").labels.template.setAll({
              rotation: -45,
              fontSize: 10,
              maxWidth: 120,
              oversizedBehavior: "truncate",
            });
            const yAxis = chart.yAxes.push(
              am5xy.ValueAxis.new(root, {
                renderer: am5xy.AxisRendererY.new(root, {}),
                min: 0,
              })
            );
            yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });
            const series = chart.series.push(
              am5xy.ColumnSeries.new(root, {
                name: "Avg Productivity",
                xAxis,
                yAxis,
                valueYField: "value",
                categoryXField: "location",
                fill: am5.color(0x59a14f),
                stroke: am5.color(0x59a14f),
                tooltip: am5.Tooltip.new(root, {
                  labelText: "[bold]{valueY}[/] Cylinder/Hour\n{categoryX}\nZone: {zone}",
                }),
              })
            );
            series.columns.template.setAll({
              cornerRadiusTL: 4,
              cornerRadiusTR: 4,
            });
            series.data.setAll(locationChartData);
            const scrollEndPlant = locationChartData.length <= 20 ? 1 : Math.min(1, 20 / locationChartData.length);
            chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis }));
            chart.set(
              "scrollbarX",
              am5.Scrollbar.new(root, { orientation: "horizontal", marginBottom: 15, height: 10, start: 0, end: scrollEndPlant })
            );
            series.appear(1000);
            chart.appear(1000, 100);
            isInitializing.current = false;
            return;
          }
        }
        if (dataView === "plant") {
          setError("No data available");
          if (rootRef.current) {
            rootRef.current.dispose();
            rootRef.current = null;
          }
          isInitializing.current = false;
          return;
        }
        if (dataView === "overall" && !data?.overall_data?.length) {
          setError("No data available");
          isInitializing.current = false;
          return;
        }
        if (dataView === "zone" && !data?.zone_data?.length) {
          setError("No data available");
          isInitializing.current = false;
          return;
        }
        setError(null);

        // Drilldown: month-wise grouped bar chart – one bar per plant per month for the selected zone
        if (drilldownFromZone && data?.location_data?.length) {
          const { chartData: monthlyChartData, groups: plantGroups } = transformLocationDataByZoneToChart(
            data.location_data,
            drilldownFromZone.zone
          );
          if (monthlyChartData.length > 0 && plantGroups.length > 0) {
            if (initCancelledRef.current || !chartDivRef.current) {
              isInitializing.current = false;
              return;
            }
            if (rootRef.current) {
              rootRef.current.dispose();
              rootRef.current = null;
            }
            root = am5.Root.new(chartDivRef.current);
            rootRef.current = root;
            root._logo?.dispose();
            root.setThemes([am5themes_Animated.new(root)]);

            const chart = root.container.children.push(
              am5xy.XYChart.new(root, {
                panX: true,
                panY: true,
                wheelX: "panX",
                wheelY: "none",
                layout: root.verticalLayout,
                paddingTop: 8,
                paddingBottom: 0,
                paddingRight: 20,
              })
            );

            const xRenderer = am5xy.AxisRendererX.new(root, {
              minGridDistance: 30,
              cellStartLocation: 0.1,
              cellEndLocation: 0.9,
              minorGridEnabled: false,
            });
            const xAxis = chart.xAxes.push(
              am5xy.CategoryAxis.new(root, {
                categoryField: "date",
                renderer: xRenderer,
                tooltip: am5.Tooltip.new(root, {}),
              })
            );
            xRenderer.grid.template.setAll({ location: 1 });
            xAxis.data.setAll(monthlyChartData);
            xAxis.get("renderer").labels.template.setAll({
              rotation: 0,
              centerY: am5.p50,
              centerX: am5.p50,
              fontSize: 12,
              fontWeight: "bold",
              paddingTop: 8,
              paddingBottom: 5,
              maxWidth: 100,
              oversizedBehavior: "truncate",
              textAlign: "center",
            });
            xAxis.get("renderer").labels.template.adapters.add("text", (_text, target) => {
              const dataContext = target.dataItem?.dataContext as Record<string, unknown>;
              return dataContext?.label != null ? String(dataContext.label) : "";
            });

            const plantValues = monthlyChartData.flatMap((row) =>
              plantGroups.map((g) => (row as Record<string, unknown>)[g]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
            );
            const plantRange = getYAxisRange(plantValues);
            const plantSpan = plantRange.max - plantRange.min || 1;
            const yMaxPlantLabels = plantRange.max + plantSpan * 0.22;
            const yAxis = chart.yAxes.push(
              am5xy.ValueAxis.new(root, {
                renderer: am5xy.AxisRendererY.new(root, {}),
                min: Math.max(0, plantRange.min),
                max: yMaxPlantLabels,
                strictMinMax: true,
              })
            );
            yAxis.get("renderer").labels.template.setAll({ fontSize: 12, fontWeight: "bold" });

            // Right Y-axis: overall productivity line (same as zone level)
            const overallMap = new Map<string, number>();
            (data.overall_data ?? []).forEach((d) => {
              overallMap.set(d.month_date, Number(Number(d.productivity).toFixed(2)));
            });
            const chartDataWithOverall = monthlyChartData.map((row) => {
              const r = row as Record<string, unknown>;
              const overallVal = overallMap.get(r.date as string) ?? null;
              return { ...r, overallProductivity: overallVal } as Record<string, unknown>;
            });
            const overallValues = chartDataWithOverall
              .map((r) => (r as Record<string, unknown>).overallProductivity)
              .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
            const overallRange = overallValues.length ? getYAxisRange(overallValues) : { min: 0, max: 1000 };
            const rightAxisRenderer = am5xy.AxisRendererY.new(root, { opposite: true, minGridDistance: 20 });
            rightAxisRenderer.grid.template.set("forceHidden", true);
            const yAxisRight = chart.yAxes.push(
              am5xy.ValueAxis.new(root, {
                renderer: rightAxisRenderer,
                min: Math.max(0, overallRange.min),
                max: overallRange.max,
                strictMinMax: true,
              })
            );
            yAxisRight.get("renderer").labels.template.setAll({ fontSize: 10, fontWeight: "bold" });
            yAxisRight.children.push(
              am5.Label.new(root, {
                rotation: 90,
                text: "Productivity (Cylinder/Hour)",
                y: am5.p50,
                centerX: am5.p50,
                fontSize: 10,
                fontWeight: "bold",
                paddingLeft: 10,
              })
            );

            plantGroups.forEach((plantName, idx) => {
              const color = ZONE_COLOR_PALETTE[idx % ZONE_COLOR_PALETTE.length];
              const displayName = stripZonePrefixFromGroupLabel(
                stripLPGPlantFromLabel(plantName),
                drilldownFromZone.zone
              );
              const columnSeries = chart.series.push(
                am5xy.ColumnSeries.new(root, {
                  name: displayName,
                  xAxis,
                  yAxis,
                  valueYField: plantName,
                  categoryXField: "date",
                  fill: am5.color(color),
                  stroke: am5.color(color),
                })
              );
              const columnTooltip = am5.Tooltip.new(root, {
                paddingTop: 6,
                paddingBottom: 6,
                paddingLeft: 8,
                paddingRight: 8,
                pointerOrientation: "horizontal",
              });
              const tooltipBg = columnTooltip.get("background");
              if (tooltipBg) tooltipBg.setAll({ fill: am5.color(0xffffff), stroke: am5.color(0xcccccc), strokeWidth: 1 });
              columnTooltip.label.set("fill", am5.color(0x000000));
              columnSeries.columns.template.setAll({
                width: am5.percent(90),
                tooltipY: 0,
                strokeOpacity: 0,
                cornerRadiusTL: 4,
                cornerRadiusTR: 4,
                tooltip: columnTooltip,
                tooltipPosition: "pointer",
              });
              columnSeries.columns.template.adapters.add("tooltipText", (_text, target) => {
                const dataItem = target.dataItem;
                if (!dataItem) return "";
                const ctx = dataItem.dataContext as Record<string, unknown>;
                const monthLabel = (ctx?.label ?? ctx?.date ?? "") as string;
                const val = ctx[plantName];
                const valueStr = val != null && typeof val === "number" ? Number(val).toFixed(2) : "—";
                return `${displayName}\n${valueStr} Cylinder/Hour\n${monthLabel}`;
              });
              columnSeries.bullets.push((root, _series, dataItem) => {
                const valueY = dataItem.get("valueY");
                if (valueY == null || (typeof valueY === "number" && Number.isNaN(valueY))) return undefined;
                return am5.Bullet.new(root, {
                  locationY: 1,
                  sprite: am5.Label.new(root, {
                    text: displayName,
                    fill: am5.color(0x1f2937),
                    centerY: am5.p100,
                    centerX: am5.p50,
                    fontSize: 11,
                    fontWeight: "600",
                    textAlign: "center",
                    rotation: -90,
                    dx: 6,
                    dy: -30,
                    marginLeft: 4,
                    marginRight: 6,
                    // oversizedBehavior: "truncate",
                    paddingBottom: 2,
                  }),
                });
              });
              columnSeries.data.setAll(monthlyChartData);
              columnSeries.appear();
            });

            const productivityLineSeries = chart.series.push(
              am5xy.LineSeries.new(root, {
                name: "Productivity",
                xAxis,
                yAxis: yAxisRight,
                valueYField: "overallProductivity",
                categoryXField: "date",
                stroke: am5.color(VALVE_LEAK_LINE_COLOR),
              })
            );
            productivityLineSeries.strokes.template.setAll({ strokeWidth: 2 });
            productivityLineSeries.set(
              "tooltip",
              am5.Tooltip.new(root, {
                getFillFromSprite: false,
                labelText: "Productivity: {valueY} Cylinder/Hour",
                autoTextColor: false,
                background: am5.RoundedRectangle.new(root, {
                  fill: am5.color(0x000000),
                }),
              })
            );
            productivityLineSeries.data.setAll(chartDataWithOverall);
            productivityLineSeries.bullets.push(() => {
              return am5.Bullet.new(root, {
                sprite: am5.Circle.new(root, {
                  radius: 4,
                  fill: am5.color(VALVE_LEAK_LINE_COLOR),
                  stroke: root.interfaceColors.get("background"),
                  strokeWidth: 1,
                }),
              });
            });
            productivityLineSeries.bullets.push(() => {
              return am5.Bullet.new(root, {
                locationY: 0,
                sprite: am5.Label.new(root, {
                  text: "{valueY}",
                  fill: am5.color(VALVE_LEAK_LABEL_COLOR),
                  background: am5.RoundedRectangle.new(root, {
                    fill: am5.color(VALVE_LEAK_LABEL_BG),
                  }),
                  centerY: am5.percent(50),
                  centerX: am5.percent(50),
                  populateText: true,
                  dy: -20,
                  fontSize: 11,
                  fontWeight: "bold",
                }),
              });
            });
            productivityLineSeries.appear();

            const legend = chart.children.push(
              am5.Legend.new(root, {
                centerX: am5.p50,
                x: am5.p50,
                layout: root.horizontalLayout,
                marginTop: 8,
              })
            );
            legend.labels.template.setAll({ fontSize: 10 });
            if (legend.valueLabels) legend.valueLabels.template.setAll({ fontSize: 10 });
            legend.data.setAll(chart.series.values);

            const scrollEndZoneMonthly = monthlyChartData.length <= 20 ? 1 : Math.min(1, 20 / monthlyChartData.length);
            chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis }));
            chart.set(
              "scrollbarX",
              am5.Scrollbar.new(root, { orientation: "horizontal", marginBottom: 15, height: 10, start: 0, end: scrollEndZoneMonthly })
            );
            chart.series.values.forEach((s) => s.appear(1000));
            chart.appear(1000, 100);
            isInitializing.current = false;
            return;
          }
        }

        if (dataView === "overall") {
          const overallChartData = transformOverallDataToChart(data.overall_data);
          if (overallChartData.length === 0) {
            isInitializing.current = false;
            return;
          }
          if (initCancelledRef.current || !chartDivRef.current) {
            isInitializing.current = false;
            return;
          }
          if (rootRef.current) {
            rootRef.current.dispose();
            rootRef.current = null;
          }
          root = am5.Root.new(chartDivRef.current);
          rootRef.current = root;
          root._logo?.dispose();
          root.setThemes([am5themes_Animated.new(root)]);

          const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
              panX: true,
              panY: true,
              wheelX: "panX",
              wheelY: "none",
              layout: root.verticalLayout,
              paddingBottom: 0,
              paddingRight: 20,
            })
          );

          const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
              categoryField: "label",
              renderer: am5xy.AxisRendererX.new(root, {
                minGridDistance: 1,
                cellStartLocation: 0.1,
                cellEndLocation: 0.9,
              }),
              tooltip: am5.Tooltip.new(root, {}),
            })
          );
          xAxis.data.setAll(overallChartData);
          xAxis.get("renderer").labels.template.setAll({
            rotation: -90,
            centerY: am5.p50,
            centerX: am5.p100,
            fontSize: 10,
            paddingTop: 10,
            paddingRight: 0,
            inside: false,
            oversizedBehavior: "none",
            maxWidth: 200,
            minPosition: 0.01,
            maxPosition: 0.99,
            fill: am5.color(0x000000),
          });
          xAxis.get("renderer").grid.template.setAll({ visible: true, location: 0.5 });
          xAxis.get("renderer").labels.template.adapters.add("text", (text: string) => text);

          const overallValues = overallChartData.map((d) => d.value);
          const avgProductivityForRange = data.overall_summary?.average_productivity;
          if (avgProductivityForRange != null) overallValues.push(avgProductivityForRange);
          const overallRange = getYAxisRange(overallValues);
          const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
              renderer: am5xy.AxisRendererY.new(root, {}),
              min: overallRange.min,
              max: overallRange.max,
              strictMinMax: true,
            })
          );
          yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

          const series = chart.series.push(
            am5xy.LineSeries.new(root, {
              name: "Overall",
              xAxis,
              yAxis,
              valueYField: "value",
              categoryXField: "label",
              stroke: am5.color(0x297ab1),
              fill: am5.color(0x297ab1),
              tooltip: am5.Tooltip.new(root, {
                labelText: "[bold]{valueY}[/] Cylinder/Hour \n{categoryX}",
                pointerOrientation: "horizontal",
                dx: 5,
              }),
            })
          );
          series.data.setAll(overallChartData);
          series.bullets.push((root, _s, dataItem) => {
            const valueY = dataItem.get("valueY");
            if (valueY == null) return undefined;
            const container = am5.Container.new(root, {});
            container.children.push(
              am5.Circle.new(root, {
                radius: 4,
                fill: am5.color(0x297ab1),
                stroke: root.interfaceColors.get("background"),
                strokeWidth: 2,
              })
            );
            container.children.push(
              am5.Label.new(root, {
                text: `${Number(valueY).toFixed(2)}`,
                centerX: am5.p50,
                centerY: am5.p100,
                populateText: true,
                fontWeight: "600",
                fontSize: 10,
                fill: am5.color(0x297ab1),
                background: am5.RoundedRectangle.new(root, { fill: am5.color(0xffffff), fillOpacity: 0.9 }),
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 6,
                paddingRight: 6,
                dy: -8,
              })
            );
            return am5.Bullet.new(root, { sprite: container });
          });

          const avgProductivity = data.overall_summary?.average_productivity;
          if (avgProductivity != null) {
            const avgSeries = chart.series.push(
              am5xy.LineSeries.new(root, {
                name: "Average",
                xAxis,
                yAxis,
                valueYField: "average",
                categoryXField: "label",
                stroke: am5.color(0xff0000),
              })
            );
            avgSeries.data.setAll(
              overallChartData.map((d) => ({ ...d, average: avgProductivity }))
            );
            chart.plotContainer.children.push(
              am5.Label.new(root, {
                text: `Average: ${Number(avgProductivity).toFixed(2)} Cylinder/Hour`,
                fontSize: 12,
                fontWeight: "bold",
                fill: am5.color(0xff0000),
                background: am5.RoundedRectangle.new(root, {
                  fill: am5.color(0xffffff),
                  fillOpacity: 0.9,
                  stroke: am5.color(0xff0000),
                  strokeOpacity: 0.5,
                  strokeWidth: 1,
                }),
                paddingTop: 5,
                paddingBottom: 5,
                paddingLeft: 10,
                paddingRight: 10,
                x: am5.percent(80),
                y: 15,
              })
            );
          }

          const scrollEndOverall = overallChartData.length <= 20 ? 1 : Math.min(1, 20 / overallChartData.length);
          chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis }));
          chart.set(
            "scrollbarX",
            am5.Scrollbar.new(root, { orientation: "horizontal", marginBottom: 15, height: 10, start: 0, end: scrollEndOverall })
          );
          series.appear(1000);
          chart.appear(1000, 100);
        }
      }

      isInitializing.current = false;
    };

    const timer = setTimeout(() => {
      initChart().catch((err) => {
        console.error("Error initializing chart:", err);
        isInitializing.current = false;
      });
    }, 0);

    return () => {
      initCancelledRef.current = true;
      clearTimeout(timer);
      isInitializing.current = false;
      if (rootRef.current) {
        try {
          rootRef.current.dispose();
        } catch (_e) {
          // ignore if already disposed or DOM detached
        }
        rootRef.current = null;
      }
    };
  }, [refreshKey, crossFilters, customAverageProductivity, timeView, dataView, monthlyData, drilldownFromZone]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Checkbox column filter (same as VTS Insights): search + Select All / Deselect All
  const PlantCheckboxFilter = useMemo(() => {
    return class {
      private params: IFilterParams;
      private filterValue: Set<string> = new Set();
      private eGui: HTMLElement | null = null;
      private searchInput: HTMLInputElement | null = null;
      private checkboxContainer: HTMLElement | null = null;
      private allValues: any[] = [];

      init(params: IFilterParams) {
        this.params = params;
        this.eGui = document.createElement("div");
        this.eGui.className = "p-0 bg-white border border-gray-200 rounded shadow-lg";
        this.eGui.style.minWidth = "180px";
        this.eGui.style.maxWidth = "220px";
        this.eGui.style.maxHeight = "280px";
        this.eGui.style.display = "flex";
        this.eGui.style.flexDirection = "column";

        const uniqueValues = new Set<any>();
        this.params.api.forEachNode((node) => {
          if (node.data) {
            const value = this.params.getValue(node);
            if (value !== null && value !== undefined) {
              uniqueValues.add(value);
            }
          }
        });
        this.allValues = Array.from(uniqueValues).sort((a, b) => {
          if (typeof a === "number" && typeof b === "number") return a - b;
          return String(a).localeCompare(String(b));
        });

        const searchContainer = document.createElement("div");
        searchContainer.className = "px-1.5 py-1 border-b border-gray-200";
        searchContainer.style.flexShrink = "0";
        this.searchInput = document.createElement("input");
        this.searchInput.type = "text";
        this.searchInput.placeholder = "Search...";
        this.searchInput.className =
          "w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";
        this.searchInput.addEventListener("input", () => this.filterCheckboxes());
        searchContainer.appendChild(this.searchInput);
        this.eGui.appendChild(searchContainer);

        this.checkboxContainer = document.createElement("div");
        this.checkboxContainer.style.overflowY = "auto";
        this.checkboxContainer.style.flex = "1";
        this.checkboxContainer.style.minHeight = "0";

        this.allValues.forEach((value) => {
          const strVal = String(value);
          this.filterValue.add(strVal);
          const label = document.createElement("label");
          label.className = "flex items-center gap-1 px-1 py-0.5 hover:bg-gray-50 cursor-pointer";
          label.style.display = "flex";
          label.setAttribute("data-value", strVal);
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0";
          checkbox.checked = true;
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) this.filterValue.add(strVal);
            else this.filterValue.delete(strVal);
            this.params.filterChangedCallback();
          });
          const span = document.createElement("span");
          span.textContent = strVal;
          span.className = "text-xs text-gray-700 truncate";
          label.appendChild(checkbox);
          label.appendChild(span);
          this.checkboxContainer!.appendChild(label);
        });
        this.eGui.appendChild(this.checkboxContainer);

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "flex gap-1 px-1 py-1 border-t border-gray-200 bg-gray-50";
        buttonContainer.style.flexShrink = "0";
        const selectAllBtn = document.createElement("button");
        selectAllBtn.textContent = "Select All";
        selectAllBtn.className =
          "flex-1 px-1.5 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors";
        selectAllBtn.addEventListener("click", () => {
          const labels = this.checkboxContainer!.querySelectorAll('label:not([style*="display: none"])');
          labels.forEach((label: Element) => {
            const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
              checkbox.checked = true;
              this.filterValue.add(label.getAttribute("data-value") ?? "");
            }
          });
          this.params.filterChangedCallback();
        });
        const deselectAllBtn = document.createElement("button");
        deselectAllBtn.textContent = "Deselect All";
        deselectAllBtn.className =
          "flex-1 px-1.5 py-1 text-xs font-medium bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors";
        deselectAllBtn.addEventListener("click", () => {
          const labels = this.checkboxContainer!.querySelectorAll('label:not([style*="display: none"])');
          labels.forEach((label: Element) => {
            const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
              checkbox.checked = false;
              this.filterValue.delete(label.getAttribute("data-value") ?? "");
            }
          });
          this.params.filterChangedCallback();
        });
        buttonContainer.appendChild(selectAllBtn);
        buttonContainer.appendChild(deselectAllBtn);
        this.eGui.appendChild(buttonContainer);
      }

      private filterCheckboxes() {
        if (!this.checkboxContainer || !this.searchInput) return;
        const searchTerm = this.searchInput.value.toLowerCase();
        this.checkboxContainer.querySelectorAll("label").forEach((label) => {
          const val = (label.getAttribute("data-value") ?? "").toLowerCase();
          (label as HTMLElement).style.display = val.includes(searchTerm) ? "flex" : "none";
        });
      }

      getGui() {
        return this.eGui!;
      }

      doesFilterPass(params: IDoesFilterPassParams) {
        if (this.filterValue.size === 0) return false;
        const value = this.params.getValue(params.node);
        return this.filterValue.has(value != null ? String(value) : "");
      }

      isFilterActive() {
        return this.filterValue.size > 0;
      }

      getModel() {
        return this.isFilterActive() ? Array.from(this.filterValue) : null;
      }

      setModel(model: any) {
        if (model && this.checkboxContainer) {
          this.filterValue = new Set(model.map((x: any) => String(x)));
          this.checkboxContainer.querySelectorAll("label").forEach((label) => {
            const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
              const v = label.getAttribute("data-value") ?? "";
              checkbox.checked = this.filterValue.has(v);
            }
          });
        }
      }
    };
  }, []);

  const plantPivot =
    timeView === "monthly" && dataView === "plant" && monthlyData?.location_data?.length
      ? pivotLocationDataByMonth(monthlyData.location_data)
      : null;

  // AG Grid: column defs with pivot layout (Location, SAP ID, Zone | Productivity > months)
  const plantGridColumnDefs = plantPivot
    ? ([
        { field: "location", headerName: "Location", pinned: "left", width: 140, minWidth: 120 },
        { field: "sap_id", headerName: "SAP ID", pinned: "left", width: 90, minWidth: 72 },
        { field: "zone", headerName: "Zone", pinned: "left", width: 90, minWidth: 72 },
        {
          headerName: "Productivity",
          headerClass: "productivity-header-center",
          children: plantPivot.months.map(
            (m): ColDef => ({
              field: m,
              headerName: formatMonthLabel(m),
              headerClass: "productivity-month-header",
              flex: 1,
              minWidth: 100,
              width: 110,
              type: "numericColumn",
              cellClass: "ag-right-aligned-cell",
              valueFormatter: (p) =>
                p.value != null ? Number(p.value).toFixed(2) : "—",
            })
          ),
        },
      ] as ColDef[])
    : [];

  const plantGridRowData = plantPivot
    ? plantPivot.rows.map((r) => ({
        location: r.location,
        sap_id: r.sap_id,
        zone: r.zone,
        ...r.byMonth,
      }))
    : [];

  return (
    <>
      <style>{`
        .productivity-header-center { justify-content: center; text-align: center; }
        .plant-productivity-grid .productivity-month-header .ag-header-cell-label {
          justify-content: center;
        }
        .plant-productivity-grid .productivity-month-header .ag-header-cell-text {
          text-align: center;
        }
        .plant-productivity-grid .ag-header-cell .ag-header-cell-filter-button {
          display: none !important;
        }
        .plant-productivity-grid .ag-header-cell .ag-header-cell-comp-wrapper {
          display: flex !important;
          align-items: center;
          width: 100%;
          min-width: 0;
        }
        .plant-productivity-grid .ag-header-cell .ag-header-cell-label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .plant-productivity-grid .ag-header-cell .ag-header-cell-label .ag-header-cell-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .plant-productivity-grid .ag-header-cell .ag-header-cell-menu-button {
          margin-left: auto !important;
          flex-shrink: 0;
          min-width: 20px;
        }
        .plant-productivity-grid .ag-header-row .ag-header-cell {
          min-width: 0;
        }
      `}</style>
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
        <CardHeader className="pb-0 p-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex-shrink-0 flex flex-col">
                <CardTitle className="text-xs font-bold text-gray-800">
                  Daily Productivity (Cylinder/Hour) - Last 30 Days 
                  {drilldownFromZone && (
                    <span className="text-gray-600 font-normal ml-1">
                      — Zone: {drilldownFromZone.zone} (plants by month)
                    </span>
                  )}
                </CardTitle>
                {timeView === "daily" && customAverageProductivity !== null && (
                  <div className="text-xs text-gray-700 font-semibold mt-1">
                    Average Productivity: <span className="text-red-600">{customAverageProductivity} </span>
                  </div>
                )}
                {timeView === "monthly" && monthlyData && (() => {
                  const avg = dataView === "overall" ? monthlyData.overall_summary?.average_productivity
                    : dataView === "zone" ? monthlyData.zone_summary?.average_productivity
                    : monthlyData.location_summary?.average_productivity;
                  return avg != null ? (
                    <div className="text-xs text-gray-700 font-semibold mt-1">
                      Average Productivity: <span className="text-red-600">{Number(avg).toFixed(2)} </span>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {headerFilters}
                <div className="flex rounded-md border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTimeView("daily")}
                    className={`px-2 py-1 text-xs font-medium ${
                      timeView === "daily"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeView("monthly")}
                    className={`px-2 py-1 text-xs font-medium border-l border-gray-300 ${
                      timeView === "monthly"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Monthly
                  </button>
                </div>
                {timeView === "monthly" && (
                  <div className="flex items-center gap-3 mr-1">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="productivity-data-view"
                        checked={dataView === "overall"}
                        onChange={() => setDataView("overall")}
                        className="w-3 h-3 text-blue-600"
                      />
                      <span className="text-xs font-medium text-gray-700">Overall</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="productivity-data-view"
                        checked={dataView === "zone"}
                        onChange={() => setDataView("zone")}
                        className="w-3 h-3 text-blue-600"
                      />
                      <span className="text-xs font-medium text-gray-700">Zone</span>
                    </label>
                    {dataView === "zone" && (
                      <>
                        <DrillStateIndicator drillLevel={drilldownFromZone ? 1 : 0} />
                        {drilldownFromZone && (
                          <Button
                            onClick={() => setDrilldownFromZone(null)}
                            className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                            title="Back to zone chart"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
                <Button
                  onClick={resetFilters}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  disabled={isLoading || isLoadingFilters}
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
        </CardHeader>
        <CardContent 
          className={`p-0 relative ${
            isExpanded ? "h-[calc(100vh-8rem)]" : "h-[380px]"
          }`}
        >
          {isTransitioning && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                padding: '20px',
                borderRadius: '8px',
              }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}

          {error && <NoDataDisplay />}

          {zoneChartConfig && (
            <ZoneGroupedBarChart
              chartData={zoneChartConfig.chartData}
              groups={zoneChartConfig.groups}
              categoryField="date"
              categoryLabelField="label"
              valueSuffix="Cylinder/Hour"
              overallLineData={zoneOverallLineData}
              overallLineSeriesName="Productivity"
              onBarClick={(categoryValue, groupName) => setDrilldownFromZone({ zone: groupName, monthDate: categoryValue })}
              minBarY={1000}
              showLegend
              height={isExpanded ? 0 : 360}
              className={isExpanded ? "h-full min-h-[400px]" : ""}
            />
          )}

          {!zoneChartConfig && (
            <div
              ref={chartDivRef}
              style={{
                width: "100%",
                height: isExpanded ? "calc(100vh - 8rem)" : "350px",
              }}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default LPGOPDailyProductivitytrend;