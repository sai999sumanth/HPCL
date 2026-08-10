"use client"
import type React from "react"
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import { AgGridReact } from "ag-grid-react"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import type { SortDirection } from "ag-grid-community"
import dayjs from "dayjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { Button } from "@/@/components/ui/button"
import { Download, Loader2, Minimize2, Maximize2, X } from "lucide-react"
import * as XLSX from "xlsx"
import { apiClient } from "@/services/apiClient"
import { saveAs } from 'file-saver';

interface DataPoint {
  month?: string
  date?: string
  Equipment: number
}

interface DetailRow {
  sap_id: string
  zone: string
  location_name: string
  equipment_name: string
  count: number
  month?: string
  date?: string
}

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface EquipmentChartProps {
  filters: FilterValue[];
  selectedEquipment?: string;
  alertCategory: string; // Safety, Process, or Gantry
  onEquipmentChange?: (equipment: string) => void;
  onDateRangeSelect?: (fromDate: string, toDate: string) => void;
  onRowDateSelect?: (date: string) => void;
  alertStatus?: "All" | "Open" | "Close";
  // Props lifted to dashboard
  viewMode: "yearly" | "weekly";
  isExpanded: boolean;
  refreshTrigger: number;
  fromDate: any; // dayjs object
  toDate: any;   // dayjs object
  onLoadingChange?: (loading: boolean) => void;
  onHasDataChange?: (hasData: boolean) => void;
  onToggleExpand?: () => void;
}

export interface TASTrendChartHandle {
  handleDownloadExcel: () => void;
  handleRefresh: () => void;
}

// Chart color by alert category
const CHART_COLORS = {
  Safety: "#4682B4", // Blue
  Process: "#e76f51", // Orange-red
  Gantry: "#2a9d8f"  // Teal
};

// Equipment to hide from dropdown options
const HIDDEN_EQUIPMENT = [
  // Add equipment names to hide here
  // e.g., "Equipment Name To Hide"
  "ROSOV STATUS", "Hooter", "Fire Pump", "MOV STATUS"
];

// Define equipment categories - this ensures each equipment appears only in its proper category
const EQUIPMENT_CATEGORIES = {
  Safety: [
    "Radar", "MOV STATUS", "VFT", "HCD", "ESD",
    "Dyke", "ROSOV STATUS", "Hooter", "Fire Pump", "Gantry Override"
  ],
  Process: [
    "Tank Leakage", "Ups", "Plc", "Primary Level", "Lrc Switchover"
  ],
  Gantry: [
    "BCU", "Loading Point"
  ]
};

// Default equipment to select for each category
const DEFAULT_EQUIPMENT = {
  Safety: "Radar",
  Process: "Tank Leakage",
  Gantry: "BCU"
};

// Fallback data keys when API returns interlock/backend name instead of display name
const EQUIPMENT_DATA_KEY_FALLBACK: Record<string, string> = {
  "Gantry Override": "Gantry Permissive_Override",
};

const TASTrendChart = forwardRef<TASTrendChartHandle, EquipmentChartProps>(function TASTrendChart({
  filters,
  selectedEquipment,
  alertCategory,
  onEquipmentChange,
  onDateRangeSelect,
  onRowDateSelect,
  alertStatus,
  viewMode,
  isExpanded,
  refreshTrigger,
  fromDate,
  toDate,
  onLoadingChange,
  onHasDataChange,
  onToggleExpand,
}, ref) {
  const rootRef = useRef<am5.Root | null>(null)
  const chartRef = useRef<am5xy.XYChart | null>(null)
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  const onRowDateSelectRef = useRef(onRowDateSelect)
  useEffect(() => {
    onRowDateSelectRef.current = onRowDateSelect
  }, [onRowDateSelect])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [gridData, setGridData] = useState<DetailRow[]>([])
  const [filteredGridData, setFilteredGridData] = useState<DetailRow[]>([])
  const gridApiRef = useRef<any>(null)
  const gridDataRef = useRef<DetailRow[]>([])
  useEffect(() => { gridDataRef.current = gridData; }, [gridData])
  const [crossFilters, setCrossFilters] = useState<FilterValue[]>([])
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [selectedPlant, setSelectedPlant] = useState<string>("")
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [localSelectedEquipment, setLocalSelectedEquipment] = useState<string | null>(null)
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([])
  // State to store all fetched data (to avoid refetching when just changing equipment)
  const [allCategoryData, setAllCategoryData] = useState<any>(null)
  const transformedFilters = filters.map(filter => {
    if (filter.key === "plant") {
      return {
        key: "sap_id",
        cond: filter.cond,
        value: filter.value
      };
    }
    return filter;
  });
  const [isDownloading, setIsDownloading] = useState(false)
  const [isTableDownloading, setIsTableDownloading] = useState(false)
  const hasData = gridData.length > 0

  // Table row data and total row for bifurcation (total count by month)
  const tableRowData = filteredGridData.length > 0 ? filteredGridData : gridData
  const totalCount = tableRowData.reduce((sum, row) => sum + (row.count ?? 0), 0)
  const pinnedBottomRowData = tableRowData.length
    ? [{ date: "", month: "Total", zone: "", location_name: "", sap_id: "", equipment_name: "", count: totalCount } as DetailRow]
    : []

  // Notify parent of loading/hasData changes
  useEffect(() => { onLoadingChange?.(isLoading); }, [isLoading]);
  useEffect(() => { onHasDataChange?.(hasData); }, [hasData]);

  // Add the download handler function
  const handleDownloadExcel = async () => {
    if (!localSelectedEquipment || !hasData) return;

    setIsDownloading(true);
    try {
      const dateFilters = crossFilters.filter(f => f.key === '"DATE"');

      const otherFilters = [
        ...filters,
        ...crossFilters.filter(f => f.key !== '"DATE"'),
        {
          key: "equipment_name",
          cond: "equals",
          value: localSelectedEquipment
        }
      ].map(filter => {
        if (filter.key === "plant") {
          return {
            key: "sap_id",
            cond: filter.cond,
            value: filter.value
          };
        }
        return filter;
      });
      if (alertStatus && alertStatus !== 'All') {
        otherFilters.push({
          key: "status",
          cond: "equals",
          value: alertStatus
        });
      }
      const requestBody = {
        action: "tas_normal_count",
        drill_state: viewMode === "yearly" ? "" : "date",
        cross_filters: dateFilters,
        filters: otherFilters,
        limit: 0,
        time_grain: viewMode === "weekly" ? "week" : "",
        resp_format: "",
        resp_level: "",
      };
      console.log(requestBody)
      const response = await apiClient.post("/api/tasassetmaster/download_tas_report", requestBody);

      if (!response.status) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const filePath = response.data?.file_path;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `TAS_${alertCategory}_${localSelectedEquipment}_${viewMode}_${timestamp}.xlsx`;
      let fileName = filename;

      saveAs(filePath, fileName);

    } catch (error) {
      // console.error("Error downloading Excel:", error);
      setError(error instanceof Error ? error.message : "Failed to download Excel file");
    } finally {
      setIsDownloading(false);
    }
  };
  useEffect(() => {
    const equipmentList = EQUIPMENT_CATEGORIES[alertCategory] || [];
    const visibleEquipment = equipmentList.filter(item =>
      !HIDDEN_EQUIPMENT.includes(item)
    );

    setAvailableEquipment(visibleEquipment);

    // Set default equipment if none selected
    if (!localSelectedEquipment) {
      const defaultEquip = selectedEquipment || DEFAULT_EQUIPMENT[alertCategory];
      if (visibleEquipment.includes(defaultEquip)) {
        setLocalSelectedEquipment(defaultEquip);
      } else if (visibleEquipment.length > 0) {
        setLocalSelectedEquipment(visibleEquipment[0]);
      }
    }
  }, [alertCategory, selectedEquipment]);

  // Update local equipment state when prop changes
  useEffect(() => {
    if (selectedEquipment && selectedEquipment !== localSelectedEquipment) {
      setLocalSelectedEquipment(selectedEquipment);
      setActiveFilter(null);
      setFilteredGridData([]);

      // If we already have the full category data, just reprocess it
      if (allCategoryData) {
        processDataForEquipment(allCategoryData, selectedEquipment);
      } else {
        // First load, need to fetch data
        setRefreshKey(prev => prev + 1);
      }
    }
  }, [selectedEquipment]);
  //  console.log("onDateRangeSelect", onDateRangeSelect)
  const columnDefs = [
    ...(viewMode === "weekly"
      ? [
          { headerName: "Date", field: "date" as keyof DetailRow, sort: "desc" as SortDirection, width: 120 },
          { headerName: "Month", field: "month" as keyof DetailRow, width: 110 },
        ]
      : [
          {
            headerName: "Month",
            field: "month" as keyof DetailRow,
            sort: "desc" as SortDirection,
            width: 120,
          },
        ]),
    { headerName: "Zone", field: "zone" as keyof DetailRow },
    { headerName: "Plant", field: "location_name" as keyof DetailRow },
    { headerName: "SAP ID", field: "sap_id" as keyof DetailRow },
    { headerName: "Equipment", field: "equipment_name" as keyof DetailRow },
    { headerName: "Total Alert Count", field: "count" as keyof DetailRow },
  ]

  const handleDownloadAnalysisTable = () => {
    if (tableRowData.length === 0 && pinnedBottomRowData.length === 0) return;
    setIsTableDownloading(true);
    try {
      const numericFields = new Set<string>(["count"]);
      const headers = columnDefs.map((c: { headerName?: string; field?: string }) => ({
        headerName: c.headerName || (c.field as string) || "",
        field: c.field as string,
      }));
      const toExcelRow = (row: DetailRow) => {
        const obj: Record<string, unknown> = {};
        headers.forEach(({ headerName, field }) => {
          if (!field) return;
          const val = row[field as keyof DetailRow];
          obj[headerName] = numericFields.has(field) ? (val !== undefined && val !== null ? Number(val) : 0) : (val ?? "");
        });
        return obj;
      };
      const excelRows = [...tableRowData.map(toExcelRow), ...pinnedBottomRowData.map(toExcelRow)];
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analysis");
      const filename = `TAS_${alertCategory}_${localSelectedEquipment}_Analysis_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (e) {
      setError("Failed to download Analysis table");
    } finally {
      setIsTableDownloading(false);
    }
  };

  // Internal refresh - triggered by parent via refreshTrigger prop change
  const handleRefresh = () => {
    setIsLoading(true)
    setIsTransitioning(true)
    setError(null)
    setActiveFilter(null)
    setSelectedZone("")
    setSelectedPlant("")

    // Keep current equipment when parent controls it (e.g. tab); otherwise reset to category default
    const equipmentToKeep = selectedEquipment || DEFAULT_EQUIPMENT[alertCategory];
    setLocalSelectedEquipment(equipmentToKeep);
    if (onEquipmentChange && equipmentToKeep) {
      onEquipmentChange(equipmentToKeep);
    }

    setFilteredGridData([])
    setAllCategoryData(null);
    onRowDateSelectRef.current?.("");
    setRefreshKey((prev) => prev + 1)
  }


  const handleLocalEquipmentChange = (value: string) => {
    setLocalSelectedEquipment(value);
    setActiveFilter(null);
    setFilteredGridData([]);
    if (onRowDateSelect) onRowDateSelect("");

    // Notify parent component of equipment change if callback exists
    if (onEquipmentChange) {
      onEquipmentChange(value);
    }

    // Process existing data for the new equipment
    if (allCategoryData) {
      processDataForEquipment(allCategoryData, value);
    } else {

      setRefreshKey(prev => prev + 1);
    }
  }

  // Function to process data for only the selected equipment
  const processDataForEquipment = useCallback((data: any, equipmentToProcess?: string) => {
    const equipmentName = equipmentToProcess || localSelectedEquipment;
    if (!data || !equipmentName) return;

    const mode = viewMode === "yearly" ? "yearly" : "weekly";
    const result = processData({
      data,
      mode
    }, equipmentName);

    setGridData(result.gridData);

    // Update chart with new data
    updateChart(result.chartData, equipmentName);
  }, [viewMode, localSelectedEquipment]);

  // Function to update the chart with new data - improved to handle complete chart recreation when needed
  const updateChart = (chartData: DataPoint[], equipmentName: string) => {
    if (!rootRef.current || !chartDivRef.current) return;

    // If chart doesn't exist or we need to recreate it
    if (!chartRef.current) {
      if (rootRef.current) {
        createNewChart(chartData, equipmentName);
      }
      return;
    }

    try {
      const chart = chartRef.current;

      // Update series
      if (chart.series.length > 0) {
        const series = chart.series.getIndex(0) as am5xy.LineSeries;
        if (series) {
          // Update series name
          series.set("name", equipmentName);

          // Update tooltip
          const tooltip = series.get("tooltip") as am5.Tooltip;
          if (tooltip) {
            tooltip.set("labelText", `${equipmentName}: [bold]{valueY}[/]`);
          }

          // Update data
          series.data.setAll(chartData);
        }
      }

      // Update X-axis data
      const xAxis = chart.xAxes.getIndex(0) as am5xy.CategoryAxis<am5xy.AxisRendererX>;
      if (xAxis) {
        xAxis.data.setAll(chartData);
      }

      // Update Y-axis max value
      const maxValue = Math.max(1, ...chartData.map(item => item.Equipment));
      const yAxisMax = Math.ceil(maxValue * 1.3);
      const yAxis = chart.yAxes.getIndex(0) as am5xy.ValueAxis<am5xy.AxisRendererY>;
      if (yAxis) {
        yAxis.set("max", yAxisMax);
      }
    } catch (error) {
      // console.error("Error updating chart:", error);
      // If updating fails, recreate the chart
      createNewChart(chartData, equipmentName);
    }
  };

  // Function to create a new chart from scratch
  const createNewChart = (chartData: DataPoint[], equipmentName: string) => {
    if (!rootRef.current || !chartDivRef.current) return;

    // Dispose old chart if exists
    if (chartRef.current) {
      chartRef.current.dispose();
    }

    const root = rootRef.current;

    // Create new chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingTop: 0,
        paddingBottom: 0,
        paddingRight: 30,
      })
    ) as am5xy.XYChart;

    chartRef.current = chart;

    // Find the highest value to set an appropriate max value
    const maxValue = Math.max(1, ...chartData.map(item => item.Equipment));
    const yAxisMax = Math.ceil(maxValue * 1.3);

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: yAxisMax,
        renderer: am5xy.AxisRendererY.new(root, {
          minGridDistance: 30,
        }),
      })
    );

    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fontWeight: "bold",
    });

    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Alert Count",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        fontWeight: "bold",
        paddingBottom: 0
      })
    );

    // Determine the category field based on view mode
    const categoryField = viewMode === "yearly" ? "month" : "date";

    // Create X-axis
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: categoryField,
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 30,
          cellStartLocation: 0.2, // Adjust label positioning
          cellEndLocation: 0.8,   // Adjust label positioning
        }),
      })
    );

    // Make x-axis labels clickable
    const xRenderer = xAxis.get("renderer");
    xRenderer.labels.template.setAll({
      fontSize: 8,
      inside: false,
      oversizedBehavior: "none",
      rotation: -90,
      fill: am5.color(0x000000),
      fontWeight: "bold",
      cursorOverStyle: "pointer",
      centerX: am5.p0, // 👈 Align left edge when rotated
      centerY: am5.p50, // 👈 Vertically center
      dy: 10,           // 👈 Adjust downward (tweak as needed)
    });


    xAxis.data.setAll(chartData);

    // Get the color for the current alert category
    const categoryColor = CHART_COLORS[alertCategory] || "#4682B4"; // Default to blue if not found

    // Create series for Equipment
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: equipmentName,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "Equipment",
        categoryXField: categoryField,
        stroke: am5.color(categoryColor),
        fill: am5.color(categoryColor),
        tooltip: am5.Tooltip.new(root, {
          labelText: `${equipmentName}: [bold]{valueY}[/]`,
          forceHidden: false,
        }),
        minBulletDistance: 10,
      })
    );

    // Add circle bullets with click events
    series.bullets.push((root) => {
      const circle = am5.Circle.new(root, {
        radius: 5,
        fill: am5.color(categoryColor),
        stroke: root.interfaceColors.get("background"),
        strokeWidth: 2,
        cursorOverStyle: "pointer",
        interactive: true,
      });

      // Add click events to the bullets
      circle.events.on("click", function (ev) {
        const dataItem = ev.target.dataItem;
        if (dataItem) {
          const category = dataItem.dataContext[categoryField];
          if (category) {
            filterGridDataByPoint(category.toString());
          }
        }
      });

      return am5.Bullet.new(root, {
        sprite: circle
      });
    });

    // Add label bullets above data points
    series.bullets.push(function (root) {
      const labelBullet = am5.Bullet.new(root, {
        sprite: am5.Label.new(root, {
          text: "{valueY}",
          fill: am5.color(0x000000),
          centerY: am5.p0,
          centerX: am5.p50,
          populateText: true,
          fontSize: 10,
          fontWeight: "bold",
          dy: -25,
        })
      });
      return labelBullet;
    });

    // Set data
    series.data.setAll(chartData);

    // Add cursor
    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "zoomX",
      })
    );

    // Add scrollbar
    chart.set(
      "scrollbarX",
      am5.Scrollbar.new(root, {
        orientation: "horizontal",
        paddingTop: 0,
      })
    );

    // Add legend
    const legend = chart.children.unshift(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        layout: root.horizontalLayout,
        marginTop: 0,
        marginBottom: 0,
      })
    );

    // Set legend items style
    legend.labels.template.setAll({
      fontSize: 12,
      fontWeight: "500"
    });

    legend.valueLabels.template.setAll({
      fontSize: 12
    });

    // Set legend data from series
    legend.data.setAll(chart.series.values);

    chart.appear(1000, 100);
  };

  // Month ordering helper function
  const getMonthOrder = (monthStr) => {
    const monthMap = {
      'Jan': 1, 'January': 1,
      'Feb': 2, 'February': 2,
      'Mar': 3, 'March': 3,
      'Apr': 4, 'April': 4,
      'May': 5,
      'Jun': 6, 'June': 6,
      'Jul': 7, 'July': 7,
      'Aug': 8, 'August': 8,
      'Sep': 9, 'September': 9,
      'Oct': 10, 'October': 10,
      'Nov': 11, 'November': 11,
      'Dec': 12, 'December': 12
    };

    // Handle different month formats
    if (monthStr.includes('-')) {
      // Format like "2024-01" or "Jan-2024"
      const parts = monthStr.split('-');
      if (parts.length === 2) {
        const monthPart = parts[0].length <= 2 ? parts[1] : parts[0];
        const yearPart = parts[0].length <= 2 ? parts[0] : parts[1];

        // If it's numeric month
        if (!isNaN(parseInt(monthPart))) {
          return parseInt(yearPart) * 100 + parseInt(monthPart);
        }
        // If it's text month
        return parseInt(yearPart) * 100 + (monthMap[monthPart] || 0);
      }
    }

    // Handle month names directly
    return monthMap[monthStr] || 0;
  };
  const fetchData = async () => {
    if (!localSelectedEquipment) {
      setIsLoading(false);
      setIsTransitioning(false);
      return { data: {}, mode: viewMode === "yearly" ? "yearly" : "weekly" };
    }

    setIsTransitioning(true)
    try {
      // Build date filters from viewMode + fromDate/toDate (single source of truth; avoid crossFilters state race)
      const dateFilters: { key: string; cond: string; value: string }[] = [];
      if (viewMode === "weekly" && fromDate && toDate) {
        const fmt = (d: any) => (d && d.format ? d.format("YYYY-MM-DD") : "");
        const fromStr = fmt(fromDate);
        const toStr = fmt(toDate);
        if (fromStr && toStr) {
          dateFilters.push({ key: '"DATE"', cond: "equals", value: `${fromStr},${toStr}` });
        }
      }

      // Transform other filters to change "plant" key to "sap_id"
      const otherFilters = [...filters, ...crossFilters.filter(f => f.key !== '"DATE"')].map(filter => {
        if (filter.key === "plant") {
          return {
            key: "sap_id",
            cond: filter.cond,
            value: filter.value
          };
        }
        // Add zone filter to filters
        if (filter.key === "zone") {
          return filter;
        }
        return filter;
      });
      if (alertStatus && alertStatus !== 'All') {
        otherFilters.push({
          key: "status",
          cond: "equals",
          value: alertStatus
        });
      }
      // In a real implementation, use the API call instead of mock data
      const apiEndpoint = "/api/charts/generate_vis_data"
      const requestBody = {
        action: "tas_normal_count",
        drill_state: viewMode === "yearly" ? "" : "date",
        cross_filters: dateFilters, // Only date filters here
        filters: otherFilters, // Zone and plant (transformed) filters here
        limit: 0,
        time_grain: viewMode === "weekly" ? "week" : "",
        resp_format: "",
        resp_level: "",
      }
      console.log(requestBody)

      // console.log("API Request:", JSON.stringify(requestBody)); // Log request for debugging

      const response = await apiClient.post(apiEndpoint, requestBody);
      const result = await response.data

      // Store the complete dataset for future use
      if (viewMode === "yearly") {
        setAllCategoryData(result.monthly_data || {});
        return { data: result.monthly_data || {}, mode: "yearly" };
      } else {
        setAllCategoryData(result.daily_data || {});
        return { data: result.daily_data || {}, mode: "weekly" };
      }
    } catch (error) {
      // console.error("Error fetching data:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch data")
      return { data: {}, mode: viewMode === "yearly" ? "yearly" : "weekly" }
    } finally {
      setIsLoading(false)
      setIsTransitioning(false)
    }
  }

  const processData = (apiResponse: any, equipmentToProcess?: string): { chartData: DataPoint[]; gridData: any[] } => {
    if (!apiResponse || apiResponse.data === undefined) {
      return { chartData: [], gridData: [] };
    }

    const data = apiResponse.data;
    const mode = apiResponse.mode;
    const chartData: DataPoint[] = [];
    const gridData: any[] = [];

    // Use specified equipment or fall back to state value
    const equipment = equipmentToProcess || localSelectedEquipment;

    if (!equipment) {
      return { chartData: [], gridData: [] };
    }

    // Gantry Override: API may return flat array [{ month, alert_category: "Gantry", count, zone, ... }]
    const isGantryOverride = equipment === "Gantry Override";
    const matchesCategory = (item: any) =>
      item.alert_category === alertCategory || (isGantryOverride && item.alert_category === "Gantry");
    const matchesEquipment = (item: any) =>
      String(item.device_name || item.equipment_name || "").toLowerCase() === String(equipment).toLowerCase();

    let equipmentData: any[] = [];

    if (Array.isArray(data)) {
      // Flat array (e.g. Process/Plc): filter by equipment; if no device_name on items, fall back to category
      equipmentData = data.filter(matchesEquipment);
      if (equipmentData.length === 0 && data.length > 0)
        equipmentData = data.filter(matchesCategory);
    } else {
      // Resolve data key: API may return "Plc" or "PLC"; find key case-insensitively if needed
      let dataKey: string | null = null;
      if (data[equipment] && Array.isArray(data[equipment]) && data[equipment].length > 0) {
        dataKey = equipment;
      } else if (EQUIPMENT_DATA_KEY_FALLBACK[equipment] && data[EQUIPMENT_DATA_KEY_FALLBACK[equipment]]?.length > 0) {
        dataKey = EQUIPMENT_DATA_KEY_FALLBACK[equipment];
      } else {
        const keyLower = String(equipment).toLowerCase();
        const found = Object.keys(data).find((k) => String(k).toLowerCase() === keyLower);
        if (found && Array.isArray(data[found]) && data[found].length > 0) dataKey = found;
      }

      if (!dataKey || !data[dataKey] || !Array.isArray(data[dataKey]) || data[dataKey].length === 0) {
        return { chartData: [], gridData: [] };
      }
      const rawRows = data[dataKey];
      // Process tab: API often returns alert_category "Safety" for equipment like Plc; use all rows when key matches
      if (alertCategory === "Process") {
        equipmentData = rawRows;
      } else {
        equipmentData = rawRows.filter(matchesCategory);
      }
    }

    if (equipmentData.length === 0) {
      return { chartData: [], gridData: [] };
    }

    // Process data for the selected equipment
    if (mode === "weekly") {
      // Support both date and month (e.g. Gantry Override response may have only month)
      const getDateKey = (item: any) =>
        item.date || (item.month && dayjs(item.month, "MMM-YYYY").isValid() ? dayjs(item.month, "MMM-YYYY").format("YYYY-MM-DD") : null);

      // Sort dates in chronological order
      const allDates = [...new Set(equipmentData.map((item: any) => getDateKey(item)).filter(Boolean))].sort();

      // Create a map to ensure all dates in the range have entries
      const dateMap = new Map();

      // Initialize with all dates in range
      let currentDate = fromDate.clone();
      while (currentDate.isSame(toDate) || currentDate.isBefore(toDate)) {
        const dateStr = currentDate.format("YYYY-MM-DD");
        dateMap.set(dateStr, {
          date: dateStr,
          Equipment: 0
        });
        currentDate = currentDate.add(1, "day");
      }

      // Fill in actual data
      equipmentData.forEach(item => {
        const dateKey = getDateKey(item);
        if (!dateKey) return;

        // Add or update the total count for this date
        if (dateMap.has(dateKey)) {
          const existingData = dateMap.get(dateKey);
          dateMap.set(dateKey, {
            ...existingData,
            Equipment: existingData.Equipment + item.count
          });
        } else {
          dateMap.set(dateKey, {
            date: dateKey,
            Equipment: item.count
          });
        }

        // Add to grid data (include month for bifurcation by month)
        gridData.push({
          date: dateKey,
          month: item.month || dayjs(dateKey).format("MMM YYYY"),
          zone: item.zone,
          location_name: item.location_name,
          sap_id: item.sap_id,
          equipment_name: equipment,
          count: item.count
        });
      });

      // Convert map values to array for chart data
      chartData.push(...Array.from(dateMap.values()));

      // Sort chart data by date
      chartData.sort((a, b) => {
        if (a.date && b.date) {
          return a.date.localeCompare(b.date);
        }
        return 0;
      });
    } else {
      // Process yearly/monthly data (equipmentData already computed above)
      // Group data by month
      const monthlyData = equipmentData.reduce((acc, item) => {
        const month = item.month;
        if (!acc[month]) {
          acc[month] = {
            month,
            Equipment: 0,
            details: []
          };
        }
        acc[month].Equipment += item.count;
        acc[month].details.push(item);
        return acc;
      }, {});

      // Convert to chart data format
      Object.values(monthlyData).forEach((monthData: any) => {
        chartData.push({
          month: monthData.month,
          Equipment: monthData.Equipment
        });

        // Add to grid data
        monthData.details.forEach(detail => {
          gridData.push({
            month: monthData.month,
            zone: detail.zone,
            location_name: detail.location_name,
            sap_id: detail.sap_id,
            equipment_name: equipment,
            count: detail.count
          });
        });
      });

      // Sort chart data by month
      chartData.sort((a, b) => {
        if (a.month && b.month) {
          const orderA = getMonthOrder(a.month);
          const orderB = getMonthOrder(b.month);
          return orderA - orderB;
        }
        return 0;
      });
    }

    return { chartData, gridData };
  }

  // Function to filter grid data based on selected data point
  const filterGridDataByPoint = (timeValue: string) => {
    const timeField = viewMode === "yearly" ? "month" : "date";
    // Use ref so we always filter the latest grid data (avoids stale closure when chart bullet was created before setGridData flushed)
    const dataToFilter = gridDataRef.current;

    // Normalize clicked value to match grid format: weekly = YYYY-MM-DD, yearly = month string as stored in grid
    let normalizedValue: string = timeValue;
    if (viewMode === "weekly" && timeValue) {
      const d = dayjs(timeValue);
      normalizedValue = d.isValid() ? d.format("YYYY-MM-DD") : String(timeValue).trim();
    }

    // Reset filtered data if clicking the same filter again
    if (activeFilter === normalizedValue) {
      setActiveFilter(null);
      setFilteredGridData([]);
      onRowDateSelectRef.current?.("");
      gridApiRef.current?.setFilterModel(null);
      return;
    }

    // Set the active filter and notify parent so SafetyProcessGantryTable also filters by this date
    setActiveFilter(normalizedValue);
    onRowDateSelectRef.current?.(normalizedValue);

    const filtered = dataToFilter.filter(item => {
      const rowVal = item[timeField];
      if (viewMode === "weekly" && rowVal) {
        const rowDate = dayjs(rowVal).format("YYYY-MM-DD");
        return rowDate === normalizedValue;
      }
      return String(rowVal).trim() === String(normalizedValue).trim();
    });
    setFilteredGridData(filtered);
    // Clear AG Grid column/quick filters so the table shows exactly this chart-filtered set
    gridApiRef.current?.setFilterModel(null);
  };

  // Inject scrollbar styles into document.head so they load after AG Grid and overrides take effect
  // Keep only ONE vertical scrollbar (right column) and ONE horizontal scrollbar (above Total); hide duplicates.
  useEffect(() => {
    const id = 'tas-trend-grid-scrollbar-styles';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      el.textContent = `
        /* Hide scrollbar on body viewport - avoid duplicate vertical scrollbar (grid uses vertical scroll column for that) */
        .tas-trend-grid-with-total .ag-body-viewport,
        .tas-trend-grid-with-total .ag-center-cols-viewport {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        .tas-trend-grid-with-total .ag-body-viewport::-webkit-scrollbar,
        .tas-trend-grid-with-total .ag-center-cols-viewport::-webkit-scrollbar {
          display: none !important;
        }
        .tas-trend-grid-with-total .ag-body-viewport-wrapper.ag-layout-normal {
          overflow-y: scroll !important;
          overflow-x: scroll !important;
        }
        .tas-trend-grid-with-total .ag-body-viewport {
          overflow-y: scroll !important;
          overflow-x: scroll !important;
        }
        /* Single vertical scrollbar: only on the right column (above Total) */
        .tas-trend-grid-with-total .ag-body-vertical-scroll.ag-scrollbar-invisible,
        .tas-trend-grid-with-total .ag-body-vertical-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
          opacity: 1 !important;
          visibility: visible !important;
        }
        .tas-trend-grid-with-total .ag-body-vertical-scroll-viewport {
          overflow-y: scroll !important;
          -ms-overflow-style: auto !important;
          scrollbar-width: thin !important;
        }
        .tas-trend-grid-with-total .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
          display: block !important;
          width: 12px;
        }
        .tas-trend-grid-with-total .ag-body-vertical-scroll-viewport::-webkit-scrollbar-track {
          background: #cbd5e1;
          border-radius: 6px;
        }
        .tas-trend-grid-with-total .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 6px;
        }
        .tas-trend-grid-with-total .ag-body-vertical-scroll-viewport {
          scrollbar-color: #64748b #cbd5e1;
        }
        /* Single horizontal scrollbar: only on the row above Total */
        .tas-trend-grid-with-total .ag-body-horizontal-scroll.ag-scrollbar-invisible,
        .tas-trend-grid-with-total .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
          opacity: 1 !important;
          visibility: visible !important;
          position: relative !important;
          bottom: auto !important;
        }
        .tas-trend-grid-with-total .ag-body-horizontal-scroll-viewport {
          overflow-x: scroll !important;
          min-height: 8px !important;
          -ms-overflow-style: auto !important;
          scrollbar-width: thin !important;
          scrollbar-color: #64748b #cbd5e1;
        }
        .tas-trend-grid-with-total .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
          display: block !important;
          height: 10px;
          width: 10px;
        }
        .tas-trend-grid-with-total .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
          background: #cbd5e1;
          border-radius: 6px;
        }
        .tas-trend-grid-with-total .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 6px;
        }
        /* Hide scrollbar on horizontal spacers so only one horizontal bar shows */
        .tas-trend-grid-with-total .ag-horizontal-left-spacer,
        .tas-trend-grid-with-total .ag-horizontal-right-spacer {
          overflow-x: scroll !important;
          min-height: 8px !important;
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        .tas-trend-grid-with-total .ag-horizontal-left-spacer::-webkit-scrollbar,
        .tas-trend-grid-with-total .ag-horizontal-right-spacer::-webkit-scrollbar {
          display: none !important;
        }
        /* Total row: reduced height, content centered vertically */
        .tas-trend-grid-with-total .ag-floating-bottom .ag-row,
        .tas-trend-grid-with-total .ag-floating-bottom-viewport .ag-row {
          min-height: 16px !important;
          height: 16px !important;
          background-color: #e2e8f0 !important;
          overflow: visible !important;
          display: flex !important;
          align-items: center !important;
        }
        .tas-trend-grid-with-total .ag-floating-bottom .ag-cell,
        .tas-trend-grid-with-total .ag-floating-bottom-viewport .ag-cell {
          line-height: 1 !important;
          overflow: visible !important;
          text-overflow: clip !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          display: flex !important;
          align-items: center !important;
        }
        .tas-trend-grid-with-total .ag-floating-bottom,
        .tas-trend-grid-with-total .ag-floating-bottom-container,
        .tas-trend-grid-with-total .ag-floating-bottom-viewport {
          min-height: 18px !important;
          height: 18px !important;
          overflow: visible !important;
        }
        /* Scroll above Total row: reduced height */
        .tas-trend-grid-with-total .ag-body-horizontal-scroll {
          margin-bottom: 0 !important;
          margin-top: 0 !important;
          min-height: 0 !important;
          padding: 0 !important;
          background: #e2e8f0 !important;
          border: none !important;
        }
        .tas-trend-grid-with-total .ag-body-horizontal-scroll-viewport {
          min-height: 3px !important;
        }
        .tas-trend-grid-with-total .ag-floating-bottom-container {
          background: #e2e8f0 !important;
        }
        .tas-trend-grid-with-total .ag-floating-bottom {
          margin-top: 0 !important;
          padding-top: 0 !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          border: none !important;
        }
        .tas-trend-grid-with-total .ag-floating-bottom .ag-row,
        .tas-trend-grid-with-total .ag-floating-bottom-viewport .ag-row {
          border: none !important;
          border-top: none !important;
          border-bottom: none !important;
        }
        .tas-trend-grid-with-total .ag-floating-bottom .ag-cell,
        .tas-trend-grid-with-total .ag-floating-bottom-viewport .ag-cell {
          border: none !important;
          border-top: none !important;
          border-bottom: none !important;
          border-right: none !important;
          box-shadow: none !important;
        }
        /* Remove horizontal line above Total row (body bottom border / floating top border) */
        .tas-trend-grid-with-total .ag-body-viewport,
        .tas-trend-grid-with-total .ag-center-cols-viewport {
          border-bottom: none !important;
        }
        .tas-trend-grid-with-total .ag-floating-bottom-container {
          border-top: none !important;
        }
        .tas-trend-grid-with-total .ag-row-pinned {
          border-top: none !important;
          box-shadow: none !important;
        }
        .tas-trend-grid-with-total .ag-root-wrapper-body,
        .tas-trend-grid-with-total .ag-body {
          gap: 0 !important;
        }
        /* Reduce gap between Total row and pagination */
        .tas-trend-grid-with-total .ag-paging-panel {
          margin-top: 2px !important;
          padding-top: 2px !important;
          min-height: 0 !important;
        }
      `;
      document.head.appendChild(el);
    }
    return () => {
      const toRemove = document.getElementById(id);
      if (toRemove) toRemove.remove();
    };
  }, []);

  useEffect(() => {
    let root: am5.Root | null = null

    const initChart = async () => {
      if (!chartDivRef.current || !localSelectedEquipment) return

      if (rootRef.current) {
        rootRef.current.dispose()
      }

      // Create new root
      root = am5.Root.new(chartDivRef.current)
      rootRef.current = root
      root._logo?.dispose()
      root.setThemes([am5themes_Animated.new(root)])

      // Fetch data
      const apiResponse = await fetchData()
      if (!apiResponse) return

      // Process data and create chart
      const { chartData, gridData } = processData(apiResponse)
      setGridData(gridData)

      // Reset filtered grid data
      setFilteredGridData([])
      setActiveFilter(null)
      onRowDateSelectRef.current?.("")

      // Create the chart
      createNewChart(chartData, localSelectedEquipment)
    }

    initChart()

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose()
      }
    }
  }, [refreshKey, viewMode, fromDate, toDate, crossFilters, alertCategory, filters, alertStatus])

  // React to refreshTrigger from parent
  useEffect(() => {
    if (refreshTrigger > 0) {
      handleRefresh();
    }
  }, [refreshTrigger]);

  // Sync crossFilters when fromDate/toDate props change (mirrors original handleViewModeChange logic)
  useEffect(() => {
    if (!fromDate || !toDate) {
      // yearly mode: remove date filter completely
      setCrossFilters((prevFilters) =>
        prevFilters.filter((f) => f.key !== '"DATE"')
      );
    } else {
      // weekly mode: add/update date filter
      const formatDate = (date) => date.format("YYYY-MM-DD");
      const dateFilter = {
        key: '"DATE"',
        cond: "equals",
        value: `${formatDate(fromDate)},${formatDate(toDate)}`,
      };
      setCrossFilters((prevFilters) => {
        const filtersWithoutDate = prevFilters.filter((f) => f.key !== '"DATE"');
        return [...filtersWithoutDate, dateFilter];
      });
    }
    // Reset active filter and filtered grid data on date/mode change
    setActiveFilter(null);
    setFilteredGridData([]);
    if (onRowDateSelect) {
      onRowDateSelect("");
    }
  }, [fromDate, toDate]);
  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded)
  }

  // Sync table expansion with chart expansion from parent
  useEffect(() => {
    setIsTableExpanded(isExpanded);
  }, [isExpanded]);

  // When chart point filter is applied or cleared, clear AG Grid column filters so the table shows the correct dataset
  useEffect(() => {
    gridApiRef.current?.setFilterModel(null);
  }, [activeFilter]);

  // Clear chart point filter
  const clearChartFilter = () => {
    setActiveFilter(null);
    setFilteredGridData([]);
    onRowDateSelectRef.current?.("");
    gridApiRef.current?.setFilterModel(null);
  }

  // Fixed chart title that combines alert category and equipment
  const chartTitle = localSelectedEquipment
    ? `${alertCategory} Equipment Analysis - ${localSelectedEquipment}`
    : `${alertCategory} Equipment Analysis`;

  // Expose download and refresh to parent via ref (must be before any early returns)
  useImperativeHandle(ref, () => ({
    handleDownloadExcel,
    handleRefresh,
  }));

  // Show loading state if no equipment is available yet
  if (availableEquipment.length === 0 || !localSelectedEquipment) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading available equipment...</span>
      </div>
    );
  }
  const gridStyle = {
    '--ag-selected-row-background-color': '#e6f0ff',  // Very light blue
    '--ag-selected-row-border-color': '#1a73e8',      // Google blue border
    height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
    width: "100%",
  } as React.CSSProperties & Record<string, string>;

  return (
    <>
      {isExpanded && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />
      )}
      <div
        className={`flex gap-1 p-1 ${isExpanded
          ? "fixed inset-4 z-50 bg-white rounded-xl shadow-2xl overflow-hidden"
          : ""
          }`}
      >
        {/* Close button when expanded */}
        {isExpanded && (
          <button
            onClick={onToggleExpand}
            className="absolute top-2 right-2 z-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-7 h-7 flex items-center justify-center shadow"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {/* Chart card */}
        <div className={`${isExpanded ? "w-1/2 h-full flex flex-col" : "w-1/2"}`}>
          <Card className={`transition-all duration-300 ${isExpanded ? "h-full flex flex-col" : ""}`}>
            <CardHeader className="pb-0 p-1 pt-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">
                  {chartTitle}{' '}
                  <span
                    className={
                      alertStatus === 'All'
                        ? 'text-blue-600'
                        : alertStatus === 'Open'
                          ? 'text-red-600'
                          : 'text-green-600'
                    }
                  >
                    ({alertStatus})
                  </span>
                </CardTitle>
                <Button
                  onClick={handleDownloadExcel}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 shrink-0"
                  disabled={isDownloading || !hasData}
                  title="Download Excel"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`p-0 relative ${isExpanded ? "flex-1 min-h-0" : "h-[365px]"}`}>
              {isTransitioning && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80">
                  <p>No data available</p>
                </div>
              )}

              <div
                ref={chartDivRef}
                style={{
                  width: "100%",
                  height: isExpanded ? "100%" : "350px",
                }}
              />

              {activeFilter && (
                <div className="absolute bottom-2 left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center">
                  <span>Filtered by: {activeFilter}</span>
                  <button
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    onClick={clearChartFilter}
                  >
                    ×
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table card */}
        <div className={`${isExpanded ? "w-1/2 h-full flex flex-col" : "w-1/2"}`}>
          <Card className={`transition-all duration-300 ${isExpanded ? "h-full flex flex-col" : ""}`}>
            <CardHeader className="pb-0 p-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-800">
                  {localSelectedEquipment} {viewMode === "yearly" ? "Monthly" : "Weekly"} Analysis
                  {activeFilter && ` - ${viewMode === "yearly" ? "Month" : "Date"}: ${activeFilter}`}
                </CardTitle>
                <Button
                  onClick={handleDownloadAnalysisTable}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 shrink-0"
                  disabled={(tableRowData.length === 0 && pinnedBottomRowData.length === 0) || isTableDownloading}
                  title="Download Excel"
                >
                  {isTableDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`p-1 pt-0 ${isExpanded ? "flex-1 min-h-0" : ""}`}>
              <div
                className="ag-theme-alpine tas-trend-grid-with-total"
                style={{
                  '--ag-selected-row-background-color': '#e6f0ff',
                  '--ag-selected-row-border-color': '#1a73e8',
                  height: isExpanded ? "100%" : "357px",
                  width: "100%",
                } as React.CSSProperties & Record<string, string>}
              >
                <AgGridReact
                  key={`grid-${activeFilter ?? 'all'}-${gridData.length}`}
                  columnDefs={columnDefs}
                  rowData={tableRowData}
                  pinnedBottomRowData={pinnedBottomRowData}
                  alwaysShowVerticalScroll={true}
                  alwaysShowHorizontalScroll={true}
                  getRowId={(params) => {
                    const r = params.data;
                    const id = [r.month, r.date, r.zone, r.location_name, r.sap_id, r.equipment_name, r.count].filter(Boolean).join('|');
                    return id || (r.month === 'Total' ? 'pinned-total' : `row-${r.count}`);
                  }}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true,
                    width: 100,
                    minWidth: 100,
                  }}
                  pagination={true}
                  paginationPageSize={isExpanded ? 20 : 10}
                  paginationPageSizeSelector={[10, 20, 50, 100]}
                  enableCellTextSelection={true}
                  suppressCellFocus={true}
                  domLayout="normal"
                  headerHeight={25}
                  rowHeight={15}
                  getRowHeight={(params) => (params.node?.rowPinned === "bottom" ? 18 : 25)}
                  suppressMovableColumns={false}
                  suppressContextMenu={true}
                  suppressMenuHide={true}
                  rowSelection="single"
                  onRowClicked={(params) => {
                    params.api.forEachNode(node => node.setSelected(false));
                    params.node.setSelected(true);
                    const selectedValue = viewMode === "yearly" ? params.data.month : params.data.date;
                    if (selectedValue) onRowDateSelectRef.current?.(selectedValue);
                  }}
                  onGridReady={(params) => {
                    gridApiRef.current = params.api;
                    if (params.api.getDisplayedRowCount() > 0) {
                      params.api.getDisplayedRowAtIndex(0).setSelected(true);
                    }
                  }}
                  getRowStyle={(params) => {
                    if (params.node.rowPinned === "bottom") {
                      return { fontWeight: 600, backgroundColor: "#f1f5f9" };
                    }
                    if (params.node.isSelected()) {
                      return { backgroundColor: '#d1e7dd', color: '#0f5132' };
                    }
                    return null;
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
})

export default TASTrendChart