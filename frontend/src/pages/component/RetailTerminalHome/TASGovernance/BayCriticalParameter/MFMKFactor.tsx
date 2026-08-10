import React, { useEffect, useState, useCallback, useLayoutEffect, useRef } from 'react';
import { apiClient } from '@/services/apiClient';
import { Loader2, AlertCircle, Search, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

interface MFMKFactorProps {
  selectedBu: string;
  selectedZone: string | null;
  selectedPlant: string | null;
  selectedTimeFilter: string | null | { key: string; cond: string; value: string };
  refreshKey: number;
  plantData?: Array<{ id: string; name: string }>;
}

interface BCUDiffAlertsData {
  [key: string]: any;
}

const MFMKFactor: React.FC<MFMKFactorProps> = ({
  selectedBu,
  selectedZone,
  selectedPlant,
  selectedTimeFilter,
  refreshKey,
  plantData: plantDataProp = [],
}) => {
  const [data, setData] = useState<BCUDiffAlertsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantData, setPlantData] = useState<Array<{ id: string; name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'zone' | 'plant'>('zone');
  const [selectedChartCategory, setSelectedChartCategory] = useState<string | null>(null);
  const [selectedBarBcuNumbers, setSelectedBarBcuNumbers] = useState<string[] | null>(null);
  const plantDataRef = useRef<Array<{ id: string; name: string }>>([]);
  const chartRootRef = useRef<am5.Root | null>(null);
  const chartRootRef2 = useRef<am5.Root | null>(null);
  const chartId = 'mfmk-factor-chart-mfm';
  const chartId2 = 'mfmk-factor-chart-invoice';

  const formatCell = (val: any): string => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'number') return val.toLocaleString();
    if (typeof val === 'string' && !isNaN(Number(val))) return Number(val).toLocaleString();
    return String(val);
  };

  const formatDateForAxis = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const parts = String(dateStr).trim().split('-');
    if (parts.length !== 3) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const y = parts[0];
    const m = months[Number(parts[1]) - 1] || parts[1];
    const d = parts[2];
    return `${d} ${m} ${y}`;
  };

  // Convert time filter to date range
  const getDateRange = useCallback(() => {
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (selectedTimeFilter && typeof selectedTimeFilter === 'object' && 'value' in selectedTimeFilter) {
      // Custom date range - value format: "startDate,endDate"
      const dateRangeStr = selectedTimeFilter.value;
      if (dateRangeStr && dateRangeStr.includes(',')) {
        const [startDate, endDate] = dateRangeStr.split(',').map(d => d.trim());
        if (startDate && endDate) {
          return { start_date: startDate, end_date: endDate };
        }
      }
      // Fallback to default if parsing fails
      const s = new Date(now);
      s.setDate(s.getDate() - 15);
      return { start_date: fmt(s), end_date: fmt(now) };
    }

    switch (selectedTimeFilter) {
      case 'TDY':
      case 't':
        return { start_date: fmt(now), end_date: fmt(now) };
      case 'YDY':
      case '1d': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return { start_date: fmt(y), end_date: fmt(y) };
      }
      case '1W':
      case '1w': {
        const s = new Date(now);
        s.setDate(s.getDate() - 7);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '15D':
      case '15d': {
        const s = new Date(now);
        s.setDate(s.getDate() - 15);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '1M':
      case '1m': {
        const s = new Date(now);
        s.setDate(s.getDate() - 30);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '3M':
      case '3m': {
        const s = new Date(now);
        s.setDate(s.getDate() - 90);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      default: {
        const s = new Date(now);
        s.setDate(s.getDate() - 15);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
    }
  }, [selectedTimeFilter]);

  // Use plant data from parent (fetched once at dashboard level)
  useEffect(() => {
    setPlantData(plantDataProp);
    plantDataRef.current = plantDataProp;
  }, [plantDataProp]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const dateRange = getDateRange();
      
      // Find plant name from plantDataRef
      const selectedPlantObj = plantDataRef.current.find(p => p.id === selectedPlant);
      const plantName = selectedPlantObj ? selectedPlantObj.name : (selectedPlant || "");
      
      console.log('MFMKFactor - Selected Plant ID:', selectedPlant);
      console.log('MFMKFactor - Plant Data:', plantDataRef.current);
      console.log('MFMKFactor - Found Plant:', selectedPlantObj);
      console.log('MFMKFactor - Using Plant Name:', plantName);
      
      const payload = {
        analytical_model: "BCU DIff Alerts",
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        location_name: plantName,
        zone: selectedZone || "",
        interlock_name: "",
        alert_status: "",
        alert_severity: [""],
        equipment_type: "",
        equipment_name: "",
        download: ""
      };
      
      console.log('MFMKFactor - API Payload:', payload);

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      console.log('MFMKFactor - API Response:', response.data);

      if (response && response.data) {
        let dataArray: BCUDiffAlertsData[] = [];

        // Handle response structure: {status, message, data: [...]}
        if (response.data.data && Array.isArray(response.data.data)) {
          dataArray = response.data.data;
          console.log('MFMKFactor - Using response.data.data:', dataArray.length, 'items');
        } else if (response.data.values && Array.isArray(response.data.values)) {
          dataArray = response.data.values;
          console.log('MFMKFactor - Using response.data.values:', dataArray.length, 'items');
        } else if (Array.isArray(response.data)) {
          dataArray = response.data;
          console.log('MFMKFactor - Using response.data as array:', dataArray.length, 'items');
        } else if (typeof response.data === 'object' && response.data !== null) {
          // Check if it has a data property
          if (response.data.data && Array.isArray(response.data.data)) {
            dataArray = response.data.data;
            console.log('MFMKFactor - Using nested response.data.data:', dataArray.length, 'items');
          } else if (response.data.values && Array.isArray(response.data.values)) {
            dataArray = response.data.values;
            console.log('MFMKFactor - Using nested response.data.values:', dataArray.length, 'items');
          } else {
            dataArray = Object.values(response.data);
            console.log('MFMKFactor - Using Object.values(response.data):', dataArray.length, 'items');
          }
        }

        console.log('MFMKFactor - Final data array:', dataArray);
        setData(dataArray);
      } else {
        setData([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch BCU Diff Alerts data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load data');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedZone, selectedPlant, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Chart data row type (includes count for label on bar, bcu_numbers for tooltip when aggregated)
  type ChartDataRow = {
    category: string;
    bcu_number: string;
    bcu_numbers: string; // newline-separated list of all BCU numbers in this bar (for tooltip)
    percentage_diff: number;
    invoice_percentage_diff: number;
    count: number;
  };

  // Create bar charts with amcharts (one per metric)
  const createChart = (
    rootId: string,
    rootRef: React.MutableRefObject<am5.Root | null>,
    valueField: "percentage_diff" | "invoice_percentage_diff",
    title: string,
    colorHex: string,
    chartData: ChartDataRow[],
    viewMode: "zone" | "plant"
  ) => {
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }
    
    // Check if container exists
    const container = document.getElementById(rootId);
    if (!container) {
      console.warn(`Chart container ${rootId} not found`);
      return;
    }
    
    const root = am5.Root.new(rootId);
    rootRef.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout,
        paddingRight: 20,
        paddingLeft: 20,
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, { renderer: am5xy.AxisRendererY.new(root, {}) })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 11, fontWeight: "500" });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 30 }),
      })
    );
    // For plant/location view, rotate x-axis labels to prevent overlap
    if (viewMode === "plant") {
      xAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
        textAlign: "center",
        rotation: -45,
        centerX: am5.p50,
        centerY: am5.p100,
        paddingTop: 8,
      });
    } else {
      xAxis.get("renderer").labels.template.setAll({ fontSize: 11, textAlign: "center" });
    }
    
    // Set axis data; when empty use a placeholder so x/y axes still show
    const axisData = chartData && chartData.length > 0
      ? chartData
      : [{ category: "No data", bcu_number: "", bcu_numbers: "", percentage_diff: 0, invoice_percentage_diff: 0, count: 0 }];
    xAxis.data.setAll(axisData);

    // When no data, fix y-axis range so axis is visible
    if (!chartData || chartData.length === 0) {
      yAxis.set("min", 0);
      yAxis.set("max", 10);
      yAxis.set("strictMinMax", true);
    }

    const color = am5.color(colorHex);
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: title,
        xAxis,
        yAxis,
        valueYField: valueField,
        categoryXField: "category",
        fill: color,
        stroke: color,
      })
    );
    series.columns.template.setAll({
      width: am5.percent(18),
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      tooltipText: "BCU numbers:\n{bcu_numbers}",
    });
    series.columns.template.events.on("click", (ev) => {
      const dataContext = ev.target.dataItem?.dataContext as { category?: string; bcu_numbers?: string } | undefined;
      const category = dataContext?.category;
      const bcuNumbersStr = dataContext?.bcu_numbers;
      if (category != null) setSelectedChartCategory(String(category));
      const bcuList = bcuNumbersStr
        ? String(bcuNumbersStr).split(/\n/).map((s) => s.trim()).filter(Boolean)
        : [];
      setSelectedBarBcuNumbers(bcuList.length > 0 ? bcuList : null);
    });

    // Label on top of bar: show count (1 if single, 2 or 3 if added)
    series.bullets.push(() => {
      return am5.Bullet.new(root, {
        locationX: 0.5,
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: "{count}",
          fill: am5.color(0x374151),
          centerY: am5.p100,
          centerX: am5.p50,
          populateText: true,
          fontSize: 11,
          fontWeight: "600",
        }),
      });
    });

    // Set series data; when empty use [] so only axes show (no bar)
    series.data.setAll(chartData && chartData.length > 0 ? chartData : []);
  };

  useLayoutEffect(() => {
    if (isLoading) {
      if (chartRootRef.current) {
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
      if (chartRootRef2.current) {
        chartRootRef2.current.dispose();
        chartRootRef2.current = null;
      }
      return;
    }

    const toNum = (val: any): number =>
      typeof val === "number" ? val : typeof val === "string" && !isNaN(Number(val)) ? Number(val) : 0;

    let chartData: ChartDataRow[];
    if (!data || data.length === 0) {
      chartData = [];
    } else if (viewMode === "zone") {
      chartData = data.map((item, index) => {
        const zone = item.zone ?? "Unknown";
        const category = zone || `Item ${index + 1}`;
        const bcu = item.bcu_number ?? "";
        return {
          category,
          bcu_number: bcu,
          bcu_numbers: bcu,
          percentage_diff: toNum(item.percentage_diff),
          invoice_percentage_diff: toNum(item.invoice_percentage_diff),
          count: 1,
        };
      });
    } else {
      chartData = data.map((item, index) => {
        const locationName = item.location_name ?? "";
        let category = locationName || `Item ${index + 1}`;
        const words = category.trim().split(/\s+/);
        if (words.length >= 3) {
          category = words.slice(0, 2).join(" ") + "\n" + words.slice(2).join(" ");
        }
        const bcu = item.bcu_number ?? "";
        return {
          category,
          bcu_number: bcu,
          bcu_numbers: bcu,
          percentage_diff: toNum(item.percentage_diff),
          invoice_percentage_diff: toNum(item.invoice_percentage_diff),
          count: 1,
        };
      });
    }

    // Aggregate per chart: only include rows where value > 0; only add BCU to tooltip when value > 0 (do not add if 0)
    const aggregatedMFM = new Map<string, ChartDataRow>();
    const aggregatedInvoice = new Map<string, ChartDataRow>();
    (chartData || []).forEach((row) => {
      const bcu = (row.bcu_number || "").trim();
      const addBcu = bcu && bcu !== "0";

      // MFM chart: only sum and add BCU when percentage_diff > 0
      if (row.percentage_diff > 0) {
        const existing = aggregatedMFM.get(row.category);
        if (existing) {
          existing.percentage_diff += row.percentage_diff;
          existing.count += 1;
          if (addBcu) existing.bcu_numbers = (existing.bcu_numbers ? existing.bcu_numbers + "\n" : "") + bcu;
        } else {
          aggregatedMFM.set(row.category, {
            ...row,
            invoice_percentage_diff: 0,
            bcu_numbers: addBcu ? bcu : "",
          });
        }
      }

      // Invoice chart: only sum and add BCU when invoice_percentage_diff > 0
      if (row.invoice_percentage_diff > 0) {
        const existing = aggregatedInvoice.get(row.category);
        if (existing) {
          existing.invoice_percentage_diff += row.invoice_percentage_diff;
          existing.count += 1;
          if (addBcu) existing.bcu_numbers = (existing.bcu_numbers ? existing.bcu_numbers + "\n" : "") + bcu;
        } else {
          aggregatedInvoice.set(row.category, {
            ...row,
            percentage_diff: 0,
            bcu_numbers: addBcu ? bcu : "",
          });
        }
      }
    });

    // Show only bars where value >= 0.05
    const chartDataMFM = Array.from(aggregatedMFM.values()).filter((row) => row.percentage_diff >= 0.05);
    const chartDataInvoice = Array.from(aggregatedInvoice.values()).filter((row) => row.invoice_percentage_diff >= 0.05);

    // Always create charts (even if empty) - createChart handles empty data
    createChart(
      chartId,
      chartRootRef,
      "percentage_diff",
      "MFM vs BCU Totalizer Diff",
      "#1e88e5",
      chartDataMFM,
      viewMode
    );
    createChart(
      chartId2,
      chartRootRef2,
      "invoice_percentage_diff",
      "Invoice vs BCU Totalizer Diff",
      "#43a047",
      chartDataInvoice,
      viewMode
    );

    return () => {
      if (chartRootRef.current) {
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
      if (chartRootRef2.current) {
        chartRootRef2.current.dispose();
        chartRootRef2.current = null;
      }
    };
  }, [data, isLoading, chartId, chartId2, viewMode]);

  // Filter data based on search term
  const filterData = (data: BCUDiffAlertsData[]) => {
    if (!searchTerm.trim()) return data;

    const searchLower = searchTerm.toLowerCase();
    return data.filter(item => {
      const searchableFields = [
        item.location_name,
        item.sap_id,
        item.bcu_number,
        item.bay_number,
        item.zone,
        ...Object.values(item).map(v => 
          v !== null && v !== undefined ? String(v) : ''
        )
      ].filter(Boolean);

      return searchableFields.some(field =>
        field.toString().toLowerCase().includes(searchLower)
      );
    });
  };

  const filteredData = filterData(data);

  // Match table row to chart category (zone+bay or location+bay)
  const rowMatchesChartCategory = useCallback(
    (item: BCUDiffAlertsData, category: string, mode: 'zone' | 'plant'): boolean => {
      const lines = category.split(/\n/).map((s) => s.trim()).filter(Boolean);
      const categoryText = lines.join(" ").trim();
      const prefix = categoryText.replace(/\s*\(Bay\s*\d+\)\s*$/i, "").trim();
      const bayMatch = categoryText.match(/\(Bay\s*(\d+)\)/i)?.[1];
      if (bayMatch != null) {
        const itemBay = item.bay_number != null ? String(item.bay_number).padStart(2, "0") : "";
        const matchBay = String(bayMatch).padStart(2, "0");
        if (itemBay !== matchBay) return false;
      }
      if (mode === "zone") return (item.zone ?? "").trim() === prefix;
      return (item.location_name ?? "").trim() === prefix;
    },
    []
  );

  // When a bar is clicked: show only rows matching that bar's category AND that bar's BCU numbers
  const tableDataForChart =
    selectedChartCategory && data.length > 0
      ? (() => {
          const byCategory = data.filter((row) => rowMatchesChartCategory(row, selectedChartCategory, viewMode));
          if (selectedBarBcuNumbers && selectedBarBcuNumbers.length > 0) {
            const bcuSet = new Set(selectedBarBcuNumbers);
            return byCategory.filter((row) => bcuSet.has((row.bcu_number ?? "").trim()));
          }
          return byCategory;
        })()
      : data;

  // Clear bar selection when view mode changes
  useEffect(() => {
    setSelectedChartCategory(null);
    setSelectedBarBcuNumbers(null);
  }, [viewMode]);

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-[1920px] mx-auto space-y-1">
        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#1e88e5' }} />
              <span className="text-gray-500 font-medium">Loading BCU Diff Alerts data...</span>
            </div>
          </div>
        )}

        {/* Chart Card */}
        {!error && !isLoading && (
          <Card className="bg-white rounded-lg shadow-sm border">
            <CardHeader className="border-b p-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  MFM vs BCU Totalizer Diff and Invoice vs BCU Totalizer Diff
                  </CardTitle>
                 
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">View:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('zone')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        viewMode === 'zone'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Zone
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('plant')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        viewMode === 'plant'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Plant
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2 pb-2 pt-1">
              <div className="flex flex-nowrap gap-4 items-stretch min-h-0 overflow-hidden">
                {/* Chart 1 - 1/3 */}
                <div className="flex-shrink-0 w-1/3 min-w-[280px] flex flex-col gap-1">
                  <div className="text-[10px] text-gray-500 px-1 pb-1 shrink-0">
                    Click on bar to filter by {viewMode === 'zone' ? 'zone' : 'plant'}
                  </div>
                  <div id={chartId} style={{ width: "100%", height: "320px" }}></div>
                </div>
                {/* Chart 2 - 1/3 */}
                <div className="flex-shrink-0 w-1/3 min-w-[280px] flex flex-col gap-1">
                  <div className="text-[10px] px-1 pb-1 shrink-0 invisible select-none">Click on bar</div>
                  <div id={chartId2} style={{ width: "100%", height: "320px" }}></div>
                </div>
                {/* Table - 1/3 */}
<div className="flex-shrink-0 w-1/3 min-w-[30%] max-w-[30%] flex flex-col">
                  {selectedChartCategory && (
                    <div className="mb-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <div className="text-xs text-gray-700">
                        Filtered by {viewMode}: <span className="font-medium text-blue-600">
                          {selectedChartCategory.replace(/\s*\(Bay\s*\d+\)\s*$/i, "").replace(/\n/g, " ").trim() || selectedChartCategory}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedChartCategory(null); setSelectedBarBcuNumbers(null); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                        title="Clear filter"
                      >
                        Clear Filter
                      </button>
                    </div>
                  )}
                  <div className="border rounded-lg overflow-hidden flex flex-col flex-1 min-h-0" style={{ borderColor: '#1e88e5' }}>
                    <div className="px-3 py-2 text-xs font-semibold text-white shrink-0 flex items-center justify-between" style={{ background: '#1e88e5' }}>
                      <span>Bay details</span>
                    </div>
                    <div className="overflow-x-auto overflow-y-auto max-h-[300px] min-h-0">
                      <table className="w-full min-w-max text-xs border-collapse" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
                        <thead className="sticky top-0 bg-gray-100">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap" title="BCU Number">BCU Number</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap" title="BCU MFM Net Totalizer Diff">BCU MFM Diff</th>
                            {/* <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap" title="Invoiced Total TL Qty Diff">Inv. TL Qty Diff</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap" title="BCU Net Totalizer">BCU Net</th> */}
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap" title="Percentage Diff">% Diff</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap" title="Invoice Percentage Diff">Inv. % Diff</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
                          {tableDataForChart.length > 0 ? (
                            tableDataForChart.map((item, index) => (
                              <tr key={index} className="transition-colors hover:[background-color:#1e88e510]" style={{ borderBottom: '1px solid #1e88e540' }}>
                                <td className="px-2 py-2 text-gray-700">{item.bcu_number ?? '-'}</td>
                                <td className="px-2 py-2 text-gray-700">{formatCell(item.bcu_mfm_net_totalizer_diff)}</td>
                                {/* <td className="px-2 py-2 text-gray-700">{formatCell(item.invoiced_total_tl_qty_diff)}</td>
                                <td className="px-2 py-2 text-gray-700">{formatCell(item.bcu_net_totalizer)}</td> */}
                                <td className="px-2 py-2 text-gray-700">{formatCell(item.percentage_diff)}</td>
                                <td className="px-2 py-2 text-gray-700">{formatCell(item.invoice_percentage_diff)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="px-2 py-6 text-center text-gray-500">
                                No data available
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table Card */}
        {!error && (() => {
        // Calculate column keys once
        const allKeysSet = new Set<string>();
        if (filteredData.length > 0) {
          filteredData.forEach(item => {
            Object.keys(item).forEach(key => allKeysSet.add(key));
          });
        } else if (data.length > 0) {
          data.forEach(item => {
            Object.keys(item).forEach(key => allKeysSet.add(key));
          });
        }
        const standardKeys = ['location_name', 'sap_id', 'bcu_number', 'bay_number', 'zone'];
        const additionalKeys = Array.from(allKeysSet).filter(key => !standardKeys.includes(key));
        const totalCols = standardKeys.length + additionalKeys.length;

        return (
          <Card className="bg-white rounded-lg shadow-sm border">
            <CardHeader className="border-b p-2 flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent shrink-0">
             BCU MFM Totalizer diff summary
              </CardTitle>
              {/* Search Bar */}
              <div className="relative shrink-0 w-80 min-w-0">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  disabled={isLoading}
                  className="block w-full pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg focus:ring-gray-500 focus:border-gray-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {searchTerm && !isLoading && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
                  >
                    <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-2 pb-2 pt-1">
              <div className="border overflow-hidden bg-white rounded-lg" style={{ borderColor: '#1e88e5' }}>
            <div className="overflow-x-auto overflow-y-auto max-h-[500px] relative">
              <table className="w-max min-w-full divide-y relative" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
                <thead className="sticky top-0 z-10" style={{ background: '#1e88e5' }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Location Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider">
                      SAP ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider">
                      BCU Number
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Bay Number
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Zone
                    </th>
                    {additionalKeys.map((key) => (
                      <th key={key} className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
                  {isLoading ? (
                    <tr>
                      <td colSpan={totalCols || 5} className="px-4 py-8 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#1e88e5' }} />
                          <span className="text-gray-500 font-medium">Loading BCU Diff Alerts data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredData.length > 0 ? (
                    filteredData.map((item, index) => (
                      <tr key={index} className="transition-colors hover:[background-color:#1e88e510]" style={{ borderBottom: '1px solid #1e88e540' }}>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {item.location_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {item.sap_id || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {item.bcu_number || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {item.bay_number || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {item.zone || '-'}
                        </td>
                        {additionalKeys.map((key) => {
                          const value = item[key];
                          return (
                            <td key={key} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                              {value !== null && value !== undefined 
                                ? (typeof value === 'number' ? value.toLocaleString() : String(value))
                                : '-'
                              }
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={totalCols || 5} className="px-4 py-6 text-center">
                        <p className="text-gray-600 font-medium">
                          {data.length > 0 ? 'No data found matching your search' : 'No data available'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
      </div>
    </div>
  );
};

export default MFMKFactor;
