import React, { useEffect, useState, useRef, useMemo } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, IFilterParams, IDoesFilterPassParams } from "ag-grid-community";
import { ArrowLeft, RotateCcw, Loader2, CalendarIcon, Minimize2, Maximize2 } from "lucide-react";
import { FilterDropdown } from "../../Sales/FilterDropdown";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import useCurrentDate from "@/hooks/useCurrentdate"
import { apiClient } from "@/services/apiClient";
import NoDataDisplay from "@/components/common/NoDataDisplay"

const REJECTION_CHART_LABEL = "Check Scale Rejection";
// Same as Daily Productivity: remove leading "LPG Plant" / "LPG Plant - " and trailing " LPG Plant"
  const stripLpgPlant = (str: string): string => {
    if (!str || typeof str !== "string") return str;
    const s = str.trim();
    return s.replace(/^LPG\s+Plant\s*(-\s*)?/i, "").replace(/\s*LPG\s+Plant\s*$/i, "").trim() || s;
  };

interface CSRejectionsProps {
  activeFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  selectedFromDate: any
  selectedToDate: any
  crossFilters: Array<{
    key: string
    cond: string
    value: string
  }>
  onResetFilters: () => void
  /** When true (e.g. opened from big number card dialog), use larger chart height */
  embeddedInDialog?: boolean
  /** When provided and embeddedInDialog, minimise button closes the dialog */
  onCloseDialog?: () => void
}

interface OverallRejectionItem {
  month_date: string;
  cs_rejection_percent?: number;
  pt_rejection_percent?: number;
  gd_rejection_percent?: number;
  rejection_percent?: number;
}

interface ZoneRejectionItem {
  month_date: string;
  zone: string;
  cs_rejection_percent?: number;
  pt_rejection_percent?: number;
  gd_rejection_percent?: number;
  rejection_percent?: number;
}

interface LocationRejectionItem {
  month_date: string;
  location: string;
  sap_id: string;
  zone: string;
  cs_rejection_percent?: number;
  pt_rejection_percent?: number;
  gd_rejection_percent?: number;
  rejection_percent?: number;
}

interface RejectionSummary {
  average_rejection_percent?: number;
  max_rejection_percent?: number;
  min_rejection_percent?: number;
  rejection_type?: string;
}

interface MonthlyRejectionsResponse {
  status?: boolean;
  message?: string;
  overall_data?: OverallRejectionItem[];
  overall_summary?: RejectionSummary;
  zone_data?: ZoneRejectionItem[];
  zone_summary?: RejectionSummary;
  location_data?: LocationRejectionItem[];
  location_summary?: RejectionSummary;
}


const DrillStateIndicator = ({ level }) => {
  const states = ['zone', 'plant'];
  const currentIndex = states.indexOf(level);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
      <span>Level:</span>
      <span className="font-bold text-blue-600">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
      <div className="flex gap-1">
        {states.map((state, index) => (
          <div
            key={state}
            className={`w-2 h-2 rounded-full ${index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'}`}
          />
        ))}
      </div>
    </div>
  );
};



const CHART_HEIGHT_DEFAULT = 240;
const CHART_HEIGHT_DIALOG = 680;

const CSRejections = ({
  activeFilters,
  crossFilters,
  onResetFilters,
  selectedFromDate,
  selectedToDate,
  embeddedInDialog = false,
  onCloseDialog,
}:CSRejectionsProps) => {
  const chartHeightPx = embeddedInDialog ? CHART_HEIGHT_DIALOG : CHART_HEIGHT_DEFAULT;
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { formattedDate } = useCurrentDate(); 
  const [drilldownState, setDrilldownState] = useState({
    level: 'zone',
    filters: [{
      key: '"rejection_type"',
      cond: "equals",
      value: "CS"
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
  // We don't need activeFilters anymore since we're separating filters and cross_filters
  // filters will always contain rejection_type and drill state
  // cross_filters will contain dropdown selections

  const [isExpanded, setIsExpanded] = useState(false);
  const [tableSearch, setTableSearch] = useState("");

  // Present = current chart; Monthly = overall/zone (plant level via zone bar click, like Productivity)
  const [timeView, setTimeView] = useState<"daily" | "monthly">("daily");
  const [dataView, setDataView] = useState<"overall" | "zone">("overall");
  const [monthlyRejectionsData, setMonthlyRejectionsData] = useState<MonthlyRejectionsResponse | null>(null);
  const [drilldownFromZone, setDrilldownFromZone] = useState<{ zone: string; monthDate: string } | null>(null);
const isFetchingRef = useRef(false);
  const handleBackClick = async () => {
    if (drilldownState.filters.length > 1) {
      setIsTransitioning(true);
      const newFilters = [...drilldownState.filters];
      newFilters.pop();

      const levels = ['zone', 'plant'];
      const newLevel = levels[newFilters.length - 1] || 'zone';

      setDrilldownState({
        level: newLevel,
        filters: newFilters
      });
      setDrillHistory(prev => prev.slice(0, -1));
    }
  };

  const handleDrillDown = async (dataItem) => {
    if (!dataItem?.drillDown) return;

    setIsTransitioning(true);
    const newFilters = [...drilldownState.filters];

    const drillLevels = {
      zone: {
        next: 'plant',
        key: '"zone"'
      },
      plant: {
        next: 'process_date',
        key: '"Plant"'
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
        level: currentLevel.next,
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

      // Add date filter to cross filters only
      // setCrossFilters(prevFilters => {
      //   const filtersWithoutDate = prevFilters.filter(f => f.key !== '"DATE"');
      //   return [...filtersWithoutDate, dateFilter];
      // });
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
      }, {});
      setSelectedFilters(initialFilters);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

 
  // const resetFilters = async () => {
  //   setIsLoadingFilters(true);
  //   setIsTransitioning(true);
    
  //   try {
  //     // Reset to initial CS rejection filter (always keep this in filters array)
  //     const initialFilter = [{
  //       key: '"rejection_type"',
  //       cond: "equals",
  //       value: "CS"
  //     }];
      
  //     // Clear cross filters and reset drill state
  //     // setCrossFilters([]);
  //     setDrilldownState({
  //       level: 'zone',
  //       filters: initialFilter
  //     });
      
  //     // Clear drill history
  //     setDrillHistory([]);
      
  //     // Reset date filters
  //     setFromDate(null);
  //     setToDate(null);
      
  //     // Fetch fresh data with no filters and at top level
  //     await Promise.all([
  //       // Reset filter options - need to call this with empty filters to get all options
  //       apiClient.post('/api/charts/generate_vis_data', {
  //         filters: [],
  //           action: "operations_dropdown",
  //           drill_state: ""
  //         }).then(res => res.data).then(result => {
  //         setFilterData(result);
          
  //         // Reset selected filters after getting new filter data
  //         const resetValues = Object.keys(result).reduce((acc, key) => {
  //           acc[key] = "";
  //           return acc;
  //         }, {});
  //         setSelectedFilters(resetValues);
  //       }),
        
  //       // Reset chart data with only the rejection_type filter
  //       fetchData(initialFilter, [])
  //     ]);
  //   } catch (error) {
  //     console.error('Error resetting filters:', error);
  //   } finally {
  //     setIsLoadingFilters(false);
  //     setIsTransitioning(false);
  //   }
  // };
//  const resetFilters = async () => {
//   setIsLoadingFilters(true);
//   setIsTransitioning(true);
  
//   try {
//     const initialFilter = [{
//       key: '"rejection_type"',
//       cond: "equals",
//       value: "CS"
//     }];
    
//     setDrilldownState({
//       level: 'zone',
//       filters: initialFilter
//     });
    
//     setDrillHistory([]);
//     setFromDate(null);
//     setToDate(null);
    
//     // Only refresh dropdowns here — DO NOT call fetchData directly
//     const res = await apiClient.post('/api/charts/generate_vis_data', {
//       filters: [],
//       action: "operations_dropdown",
//       drill_state: ""
//     });
    
//     const result = res.data;
//     setFilterData(result);
    
//     const resetValues = Object.keys(result).reduce((acc, key) => {
//       acc[key] = "";
//       return acc;
//     }, {});
//     setSelectedFilters(resetValues);
    
//     // fetchData will auto-run via useEffect when drilldownState resets
//   } catch (error) {
//     console.error('Error resetting filters:', error);
//   } finally {
//     setIsLoadingFilters(false);
//     setIsTransitioning(false);
//   }
// };
 const resetFilters = async () => {
  setIsLoadingFilters(true);
  setIsTransitioning(true);

  try {
    const initialFilter = [{
      key: '"rejection_type"',
      cond: "equals",
      value: "CS"
    }];

    // Temporarily stop automatic fetching
    isFetchingRef.current = true;

    setDrillHistory([]);
    setFromDate(null);
    setToDate(null);

    const res = await apiClient.post('/api/charts/generate_vis_data', {
      filters: [],
      action: "operations_dropdown",
      drill_state: ""
    });
   console.log("chartData:", chartData);
    const result = res.data;
    setFilterData(result);

    const resetValues = Object.keys(result).reduce((acc, key) => {
      acc[key] = "";
      return acc;
    }, {});
    setSelectedFilters(resetValues);

    setDrilldownFromZone(null);

    // Now safely update filters, triggering only one fetch
    setDrilldownState({
      level: 'zone',
      filters: initialFilter
    });

  } catch (error) {
    console.error('Error resetting filters:', error);
  } finally {
    isFetchingRef.current = false;
    setIsLoadingFilters(false);
    setIsTransitioning(false);
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
      setError('No data available');
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const fetchMonthlyRejections = async (crossFiltersList = []) => {
    setError(null);
    setIsTransitioning(true);
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [],
        cross_filters: crossFiltersList,
        action: "lpg_operations_monthwise_rejections",
        drill_state: "",
      });
      const result = response.data as MonthlyRejectionsResponse;
      const hasData = result?.status !== false && (
        (result?.overall_data?.length) ||
        (result?.zone_data?.length) ||
        (result?.location_data?.length)
      );
      if (hasData) {
        setMonthlyRejectionsData(result);
        return;
      }
      setMonthlyRejectionsData(null);
      setError("No data available");
    } catch (err) {
      console.error("Error fetching monthly rejections:", err);
      setMonthlyRejectionsData(null);
      setError("No data available");
    } finally {
      setIsTransitioning(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // useEffect(() => {
  //   fetchData(drilldownState.filters, crossFilters);
  // }, [drilldownState.filters, crossFilters]);
// useEffect(() => {
//   if (isFetchingRef.current) return;
//   isFetchingRef.current = true;

//   fetchData(drilldownState.filters, crossFilters)
//     .finally(() => {
//       isFetchingRef.current = false;
//     });
// }, [drilldownState.filters, crossFilters]);
useEffect(() => {
  let cancelled = false;

  // Skip if filters are empty or already fetching
  if (!drilldownState.filters?.length || isFetchingRef.current) return;

  const run = async () => {
    try {
      isFetchingRef.current = true;
      await fetchData(drilldownState.filters, crossFilters);
    } finally {
      isFetchingRef.current = false;
    }
  };

  run();

  // Cleanup to prevent race conditions
  return () => {
    cancelled = true;
  };
}, [JSON.stringify(drilldownState.filters), JSON.stringify(crossFilters)]);

  useEffect(() => {
    if (timeView !== "monthly") return;
    const filtersWithoutDate = (crossFilters || []).filter((f) => f.key !== '"DATE"');
    fetchMonthlyRejections(filtersWithoutDate);
  }, [timeView, JSON.stringify(crossFilters)]);

  useEffect(() => {
    setDrilldownFromZone(null);
  }, [timeView, dataView, JSON.stringify(crossFilters)]);

  useEffect(() => {
    if (timeView === "monthly") {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
      return;
    }
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
        text: "CS Rejections",
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
      maxWidth: 50,
      tooltipX: 0,
      tooltipPosition: "pointer",
      interactive: true
    });

    // Add colors
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

      const dataContext = target.dataItem?.dataContext as { name: string } | undefined;
      const index = dataContext ? chartData.findIndex(item => item.name === dataContext.name) : 0;
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

      const dataContext = target.dataItem?.dataContext as { name: string } | undefined;
      const index = dataContext ? chartData.findIndex(item => item.name === dataContext.name) : 0;
      return colors[index % colors.length];
    });

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

    // Add horizontal line at y=3
    const targetLineRange = yAxis.createAxisRange(yAxis.makeDataItem({
      value: 3
    }));

    // Style the target line
    targetLineRange.get("grid").setAll({
      strokeOpacity: 1,
      stroke: am5.color(0xFF0000),  // Red color
      strokeWidth: 2,
      strokeDasharray: [3, 3]  // Create a dashed line
    });

    // Add a label to the target line
    targetLineRange.get("label").setAll({
      text: "(3)",
      fill: am5.color(0xFF0000),
      fontSize: 10,
      fontWeight: "bold",
      dx: 5
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

    // Add scrollbar with plant-level 4-bar visibility
    const maxVisibleBars = drilldownState.level === 'plant' ? 4 : 10;
    const visibleEnd = chartData.length > maxVisibleBars ? maxVisibleBars / chartData.length : 1;
    xAxis.set("start", 0);
    xAxis.set("end", visibleEnd);

    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 20,
      minHeight: 10,
      start: 0,
      end: visibleEnd
    });
    
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);

    scrollbarX.thumb.setAll({
      fillOpacity: 0.2,
      visible: true
    });

    chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "none",
      xAxis: xAxis,
      yAxis: yAxis
    }));

    // Set data
    xAxis.data.setAll(chartData);
    series.data.setAll(chartData);

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
      }
    };
  }, [timeView, chartData, isLoading, drilldownState.level]);

  const formatMonthLabel = (monthDate) => {
    try {
      const d = new Date(monthDate);
      const mon = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      return `${mon} ${year}`;
    } catch {
      return monthDate;
    }
  };

  // Monthly Overall: line chart from overall_data (cs_rejection_percent) + average line
  useEffect(() => {
    if (timeView !== "monthly" || dataView !== "overall" || !monthlyRejectionsData || !chartDivRef.current) return;
    const raw = monthlyRejectionsData.overall_data ?? [];
    if (!raw.length) return;

    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }

    const root = am5.Root.new(chartDivRef.current);
    chartRef.current = root;
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

    const sorted = [...raw]
      .sort((a, b) => new Date(a.month_date).getTime() - new Date(b.month_date).getTime())
      .map((d) => ({
        label: formatMonthLabel(d.month_date),
        value: Number(Number(d.cs_rejection_percent ?? 0).toFixed(2)),
      }));

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
    xAxis.data.setAll(sorted);
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

    const values = sorted.map((d) => d.value);
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 10;
    const padding = Math.max((dataMax - dataMin) * 0.15, 0.5);
    const yMin = Math.max(0, dataMin - padding);
    const yMax = dataMax + padding;

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        min: yMin,
        max: yMax,
        strictMinMax: true,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "CS Rejection",
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "label",
        stroke: am5.color(0x297ab1),
        fill: am5.color(0x297ab1),
        tooltip: am5.Tooltip.new(root, {
          labelText: `${REJECTION_CHART_LABEL}: [bold]{valueY}%[/]\n{categoryX}`,
          pointerOrientation: "horizontal",
          dx: 5,
        }),
      })
    );
    series.data.setAll(sorted);
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
          text: `${Number(valueY)}`,
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

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis }));
    const scrollbarXOverall = am5.Scrollbar.new(root, { orientation: "horizontal", marginTop: 8, marginBottom: 15, height: 10, start: 0, end: 1 });
    chart.set("scrollbarX", scrollbarXOverall);
    chart.bottomAxesContainer.children.push(scrollbarXOverall);
    series.appear(1000);
    chart.appear(1000, 100);

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [timeView, dataView, monthlyRejectionsData, isExpanded]);

  // When monthly and view is Zone (or drilldown), clear is handled per-effect

  const ZONE_COLOR_PALETTE = [
    0x4e79a7, 0x59a14f, 0xf28e2b, 0xe15759, 0xb07aa1,
    0x76b7b2, 0xedc948, 0xff9da7, 0x9c755f, 0xbab0ac,
    0x79706e, 0xd4a574,
  ];
  const OVERALL_LINE_COLOR = 0x1976d2;
  const OVERALL_LABEL_COLOR = 0x0288d1;
  const OVERALL_LABEL_BG = 0xefefef;

  // Zone: zone_data -> one bar series per zone; category = month, value = cs_rejection_percent
  const transformZoneDataToChart = (
    data: ZoneRejectionItem[] | undefined
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
        const val = item ? item.cs_rejection_percent : null;
        row[g] = val != null ? Number(Number(val).toFixed(2)) : null;
      });
      return row;
    });
    return { chartData, groups };
  };

  // Location data for one zone -> month-wise grouped chart (plants by month), like Productivity
  const transformLocationDataByZoneToChart = (
    data: LocationRejectionItem[] | undefined,
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
        const val = item ? (item.cs_rejection_percent ?? item.rejection_percent) : null;
        row[plantName] = val != null ? Number(Number(val).toFixed(2)) : null;
      });
      return row;
    });
    return { chartData, groups };
  };

  const pivotLocationDataByMonth = (
    data: LocationRejectionItem[] | undefined
  ): { months: string[]; rows: { location: string; sap_id: string; zone: string; byMonth: Record<string, number> }[] } => {
    if (!data || data.length === 0) return { months: [], rows: [] };
    const months = [...new Set(data.map((d) => d.month_date))].sort();
    const key = (r: LocationRejectionItem) => `${r.location}|${r.sap_id}|${r.zone}`;
    const map = new Map<string, { location: string; sap_id: string; zone: string; byMonth: Record<string, number> }>();
    data.forEach((d) => {
      const k = key(d);
      if (!map.has(k)) map.set(k, { location: d.location, sap_id: d.sap_id, zone: d.zone, byMonth: {} });
      const row = map.get(k)!;
      row.byMonth[d.month_date] = Number(Number(d.cs_rejection_percent ?? 0).toFixed(2));
    });
    const rows = Array.from(map.values());
    return { months, rows };
  };

  // Monthly Zone: grouped bar chart from zone_data (cs_rejection_percent); click bar -> plant drilldown
  useEffect(() => {
    if (timeView !== "monthly" || dataView !== "zone" || drilldownFromZone || !monthlyRejectionsData?.zone_data?.length || !chartDivRef.current) return;

    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }

    const { chartData: monthlyChartData, groups } = transformZoneDataToChart(monthlyRejectionsData.zone_data);
    if (monthlyChartData.length === 0 || groups.length === 0) return;

    const root = am5.Root.new(chartDivRef.current);
    chartRef.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingTop: 30,
        paddingBottom: 25,
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
      fontSize: 10,
      paddingTop: 8,
      paddingBottom: 5,
      maxWidth: 100,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    xAxis.get("renderer").labels.template.adapters.add("text", (_text: string, target: unknown) => {
      const dataContext = (target as { dataItem?: { dataContext?: Record<string, unknown> } })?.dataItem?.dataContext;
      return dataContext?.label != null ? String(dataContext.label) : "";
    });

    const zoneValues = monthlyChartData.flatMap((row) =>
      groups.map((g) => (row as Record<string, unknown>)[g]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
    );
    const yMax = zoneValues.length ? Math.max(...zoneValues) * 1.1 : 10;
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        min: 0,
        max: yMax,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

    const overallMap = new Map<string, number>();
    (monthlyRejectionsData.overall_data ?? []).forEach((d: OverallRejectionItem) => {
      const v = d.cs_rejection_percent;
      if (v != null) overallMap.set(String(d.month_date), Number(Number(v).toFixed(2)));
    });
    const chartDataWithOverall = monthlyChartData.map((row: Record<string, unknown>) => {
      const date = row.date as string;
      return { ...row, overallValue: overallMap.get(date) ?? null } as Record<string, unknown>;
    });
    const overallValues = chartDataWithOverall.map((r) => r.overallValue).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    const overallMin = overallValues.length ? Math.min(...overallValues) : 0;
    const overallMax = overallValues.length ? Math.max(...overallValues) : 10;
    const overallPadding = overallValues.length ? Math.max((overallMax - overallMin) * 0.15, 0.5) : 0.5;
    const rightAxisRenderer = am5xy.AxisRendererY.new(root, { opposite: true, minGridDistance: 20 });
    rightAxisRenderer.grid.template.set("forceHidden", true);
    const yAxisRight = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: rightAxisRenderer,
        min: Math.max(0, overallMin - overallPadding),
        max: overallMax + overallPadding,
        strictMinMax: true,
      })
    );
    yAxisRight.get("renderer").labels.template.setAll({ fontSize: 10, fontWeight: "bold" });

    groups.forEach((groupName, idx) => {
      const color = ZONE_COLOR_PALETTE[idx % ZONE_COLOR_PALETTE.length];
      const zoneSeries = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: stripLpgPlant(groupName),
          xAxis,
          yAxis,
          valueYField: groupName,
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
      const columnTooltipBg = columnTooltip.get("background");
      if (columnTooltipBg) columnTooltipBg.setAll({ fill: am5.color(0xffffff), stroke: am5.color(0xcccccc), strokeWidth: 1 });
      columnTooltip.label.set("fill", am5.color(0x000000));
      zoneSeries.columns.template.setAll({
        width: am5.percent(90),
        maxWidth: 50,
        tooltipY: 0,
        strokeOpacity: 0,
        cornerRadiusTL: 4,
        cornerRadiusTR: 4,
        tooltip: columnTooltip,
        tooltipPosition: "pointer",
        cursorOverStyle: "pointer",
      });
      zoneSeries.columns.template.events.on("click", (ev) => {
        const dataItem = ev.target.dataItem;
        if (!dataItem) return;
        const ctx = dataItem.dataContext as Record<string, unknown>;
        const date = ctx?.date as string;
        if (date && groupName) setDrilldownFromZone({ zone: groupName, monthDate: date });
      });
      zoneSeries.columns.template.adapters.add("tooltipText", (_t: string, target: unknown) => {
        const dataItem = (target as { dataItem?: { dataContext?: Record<string, unknown> } })?.dataItem;
        if (!dataItem) return "";
        const ctx = dataItem.dataContext;
        const val = ctx?.[groupName];
        const valueStr = val != null && typeof val === "number" ? `${Number(val).toFixed(2)}` : "—";
        return `[semibold fontSize:12px]${stripLpgPlant(groupName)}: [fontSize: 12px bold] ${valueStr}`;
      });
      // Zone name above each bar (only when maximised)
      if (isExpanded) {
        const zoneBarLabel = stripLpgPlant(groupName);
        zoneSeries.bullets.push((root, _series, dataItem) => {
          const valueY = dataItem.get("valueY");
          if (valueY == null || (typeof valueY === "number" && Number.isNaN(valueY))) return undefined;
          return am5.Bullet.new(root, {
            locationY: 1,
            sprite: am5.Label.new(root, {
              text: zoneBarLabel,
              fill: root.interfaceColors.get("text"),
              centerY: 15,
              centerX: am5.p50,
              fontSize: 11,
              fontWeight: "bold",
              dy: -6,
            }),
          });
        });
        zoneSeries.bulletsContainer.set("paddingTop", 2);
      }
      zoneSeries.data.setAll(monthlyChartData);
      zoneSeries.appear();
    });

    if (overallValues.length > 0) {
      const lineSeries = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: "Overall",
          xAxis,
          yAxis: yAxisRight,
          valueYField: "overallValue",
          categoryXField: "date",
          stroke: am5.color(OVERALL_LINE_COLOR),
        })
      );
      lineSeries.strokes.template.setAll({ strokeWidth: 2 });
      lineSeries.set(
        "tooltip",
        am5.Tooltip.new(root, {
          getFillFromSprite: false,
          labelText: `${REJECTION_CHART_LABEL}: {valueY}%`,
          autoTextColor: false,
          background: am5.RoundedRectangle.new(root, { fill: am5.color(0x000000) }),
        })
      );
      lineSeries.get("tooltip").label.set("fill", am5.color(0xffffff));
      lineSeries.data.setAll(chartDataWithOverall);
      lineSeries.bullets.push(() =>
        am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 4,
            fill: am5.color(OVERALL_LINE_COLOR),
            stroke: am5.color(OVERALL_LABEL_BG),
            strokeWidth: 1,
          }),
        })
      );
      lineSeries.bullets.push(() =>
        am5.Bullet.new(root, {
          locationY: 0,
          sprite: am5.Label.new(root, {
            text: "{valueY}",
            fill: am5.color(OVERALL_LABEL_COLOR),
            fontSize: 11,
            fontWeight: "bold",
            centerY: am5.percent(50),
            centerX: am5.percent(50),
            populateText: true,
            dy: -20,
            background: am5.RoundedRectangle.new(root, { fill: am5.color(OVERALL_LABEL_BG) }),
          }),
        })
      );
      lineSeries.appear();
    }

    if (isExpanded) {
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
    }

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis }));
    const scrollbarXZone = am5.Scrollbar.new(root, { orientation: "horizontal", marginTop: 8, marginBottom: 15, height: 10, start: 0, end: 1 });
    chart.set("scrollbarX", scrollbarXZone);
    chart.bottomAxesContainer.children.push(scrollbarXZone);
    chart.appear(1000, 100);

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [timeView, dataView, drilldownFromZone, monthlyRejectionsData, isExpanded]);

  // Monthly Zone drilldown: plant-by-month chart for selected zone (like Productivity)
  useEffect(() => {
    if (timeView !== "monthly" || dataView !== "zone" || !drilldownFromZone || !monthlyRejectionsData?.location_data?.length || !chartDivRef.current) return;

    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }

    const { chartData: monthlyChartData, groups: plantGroups } = transformLocationDataByZoneToChart(
      monthlyRejectionsData.location_data,
      drilldownFromZone.zone
    );
    if (monthlyChartData.length === 0 || plantGroups.length === 0) return;

    const root = am5.Root.new(chartDivRef.current);
    chartRef.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: 25,
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
      fontSize: 10,
      paddingTop: 8,
      paddingBottom: 5,
      maxWidth: 100,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    xAxis.get("renderer").labels.template.adapters.add("text", (_text: string, target: unknown) => {
      const dataContext = (target as { dataItem?: { dataContext?: Record<string, unknown> } })?.dataItem?.dataContext;
      return dataContext?.label != null ? String(dataContext.label) : "";
    });

    const plantValues = monthlyChartData.flatMap((row) =>
      plantGroups.map((g) => (row as Record<string, unknown>)[g]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
    );
    const yMax = plantValues.length ? Math.max(...plantValues) * 1.1 : 10;
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        min: 0,
        max: yMax,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });

    const overallMap = new Map<string, number>();
    (monthlyRejectionsData.overall_data ?? []).forEach((d: OverallRejectionItem) => {
      const v = d.cs_rejection_percent;
      if (v != null) overallMap.set(String(d.month_date), Number(Number(v).toFixed(2)));
    });
    const chartDataWithOverall = monthlyChartData.map((row: Record<string, unknown>) => {
      const date = row.date as string;
      return { ...row, overallValue: overallMap.get(date) ?? null } as Record<string, unknown>;
    });
    const overallValues = chartDataWithOverall.map((r) => r.overallValue).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    const overallMin = overallValues.length ? Math.min(...overallValues) : 0;
    const overallMax = overallValues.length ? Math.max(...overallValues) : 10;
    const overallPadding = overallValues.length ? Math.max((overallMax - overallMin) * 0.15, 0.5) : 0.5;
    const rightAxisRenderer = am5xy.AxisRendererY.new(root, { opposite: true, minGridDistance: 20 });
    rightAxisRenderer.grid.template.set("forceHidden", true);
    const yAxisRight = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: rightAxisRenderer,
        min: Math.max(0, overallMin - overallPadding),
        max: overallMax + overallPadding,
        strictMinMax: true,
      })
    );
    yAxisRight.get("renderer").labels.template.setAll({ fontSize: 10, fontWeight: "bold" });

    plantGroups.forEach((plantName, idx) => {
      const color = ZONE_COLOR_PALETTE[idx % ZONE_COLOR_PALETTE.length];
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: stripLpgPlant(plantName),
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
      const columnTooltipBg = columnTooltip.get("background");
      if (columnTooltipBg) columnTooltipBg.setAll({ fill: am5.color(0xffffff), stroke: am5.color(0xcccccc), strokeWidth: 1 });
      columnTooltip.label.set("fill", am5.color(0x000000));
      series.columns.template.setAll({
        width: am5.percent(90),
        maxWidth: 50,
        tooltipY: 0,
        strokeOpacity: 0,
        cornerRadiusTL: 4,
        cornerRadiusTR: 4,
        tooltip: columnTooltip,
        tooltipPosition: "pointer",
      });
      series.columns.template.adapters.add("tooltipText", (_t: string, target: unknown) => {
        const dataItem = (target as { dataItem?: { dataContext?: Record<string, unknown> } })?.dataItem;
        if (!dataItem) return "";
        const ctx = dataItem.dataContext;
        const val = ctx?.[plantName];
        const valueStr = val != null && typeof val === "number" ? `${Number(val).toFixed(2)}%` : "—";
        return `[semibold fontSize:12px]${stripLpgPlant(plantName)}: [fontSize: 12px bold] ${valueStr}`;
      });
      if (isExpanded) {
        const barLabel = stripLpgPlant(plantName);
        series.bullets.push((root, _s, dataItem) => {
          const valueY = dataItem.get("valueY");
          if (valueY == null || (typeof valueY === "number" && Number.isNaN(valueY))) return undefined;
          return am5.Bullet.new(root, {
            locationY: 1,
            sprite: am5.Label.new(root, {
              text: barLabel,
              fill: root.interfaceColors.get("text"),
              centerY: 15,
              centerX: am5.p50,
              fontSize: 11,
              fontWeight: "bold",
              dy: -6,
              rotation: -90,
            }),
          });
        });
      }
      series.data.setAll(monthlyChartData);
      series.appear();
    });

    if (overallValues.length > 0) {
      const lineSeries = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: "Overall",
          xAxis,
          yAxis: yAxisRight,
          valueYField: "overallValue",
          categoryXField: "date",
          stroke: am5.color(OVERALL_LINE_COLOR),
        })
      );
      lineSeries.strokes.template.setAll({ strokeWidth: 2 });
      lineSeries.set(
        "tooltip",
        am5.Tooltip.new(root, {
          getFillFromSprite: false,
          labelText: `${REJECTION_CHART_LABEL}: {valueY}%`,
          autoTextColor: false,
          background: am5.RoundedRectangle.new(root, { fill: am5.color(0x000000) }),
        })
      );
      lineSeries.get("tooltip").label.set("fill", am5.color(0xffffff));
      lineSeries.data.setAll(chartDataWithOverall);
      lineSeries.bullets.push(() =>
        am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 4,
            fill: am5.color(OVERALL_LINE_COLOR),
            stroke: am5.color(OVERALL_LABEL_BG),
            strokeWidth: 1,
          }),
        })
      );
      lineSeries.bullets.push(() =>
        am5.Bullet.new(root, {
          locationY: 0,
          sprite: am5.Label.new(root, {
            text: "{valueY}",
            fill: am5.color(OVERALL_LABEL_COLOR),
            fontSize: 11,
            fontWeight: "bold",
            centerY: am5.percent(50),
            centerX: am5.percent(50),
            populateText: true,
            dy: -20,
            background: am5.RoundedRectangle.new(root, { fill: am5.color(OVERALL_LABEL_BG) }),
          }),
        })
      );
      lineSeries.appear();
    }

    if (isExpanded) {
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
    }

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis }));
    const scrollbarXDrill = am5.Scrollbar.new(root, { orientation: "horizontal", marginTop: 8, marginBottom: 15, height: 10, start: 0, end: 1 });
    chart.set("scrollbarX", scrollbarXDrill);
    chart.bottomAxesContainer.children.push(scrollbarXDrill);
    chart.appear(1000, 100);

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [timeView, dataView, drilldownFromZone, monthlyRejectionsData, isExpanded]);

  // Checkbox column filter (same as Productivity): search + Select All / Deselect All for pivot "three bar" menu
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
    timeView === "monthly" && monthlyRejectionsData?.location_data?.length && drilldownFromZone
      ? pivotLocationDataByMonth(monthlyRejectionsData.location_data)
      : null;

  const plantGridColumnDefs: (ColDef | ColGroupDef)[] = plantPivot
    ? [
        { field: "location", headerName: "Location", pinned: "left", width: 140, minWidth: 120 },
        { field: "sap_id", headerName: "SAP ID", pinned: "left", width: 90, minWidth: 72 },
        { field: "zone", headerName: "Zone", pinned: "left", width: 90, minWidth: 72 },
        {
          headerName: "CS Rejection",
          headerClass: "productivity-header-center",
          children: plantPivot.months.map(
            (m): ColDef => ({
              field: m,
              headerName: formatMonthLabel(m),
              headerClass: "productivity-month-header",
              flex: 1,
              minWidth: 80,
              width: 100,
              type: "numericColumn",
              cellClass: "ag-right-aligned-cell",
              valueFormatter: (p) => (p.value != null ? `${Number(p.value).toFixed(2)}` : "—"),
            })
          ),
        } as ColGroupDef,
      ]
    : [];

  const plantGridRowData = plantPivot
    ? plantPivot.rows.map((r) => ({
        location: r.location,
        sap_id: r.sap_id,
        zone: r.zone,
        ...r.byMonth,
      }))
    : [];

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
  const title = `Check Scale Rejection${timeView === "monthly" ? "" : ` (${selectedFromDate && selectedToDate ? `${selectedFromDate} to ${selectedToDate}` : formattedDate})`}`;

  const toggleExpand = () => {
    if (embeddedInDialog && onCloseDialog) {
      onCloseDialog();
    } else {
    setIsExpanded(!isExpanded);
    }
  };

  const Wrapper = embeddedInDialog ? "div" : Card;
  const HeaderWrapper = embeddedInDialog ? "div" : CardHeader;
  const ContentWrapper = embeddedInDialog ? "div" : CardContent;
  const wrapperClassName = embeddedInDialog
    ? "w-full h-full flex flex-col min-h-0"
    : `transition-all duration-300 flex flex-col ${isExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : "h-[320px] max-h-[320px] min-h-[320px]"}`;
  
  return (
    <>
      <style>{`
        .plant-rejection-grid.productivity-header-center,
        .plant-rejection-grid .productivity-header-center { justify-content: center; text-align: center; }
        .plant-rejection-grid .productivity-month-header .ag-header-cell-label { justify-content: center; }
        .plant-rejection-grid .productivity-month-header .ag-header-cell-text { text-align: center; }
        .plant-rejection-grid.embedded-in-dialog .ag-body-horizontal-scroll-viewport,
        .plant-rejection-grid.embedded-in-dialog .ag-body-vertical-scroll-viewport,
        .plant-rejection-grid.embedded-in-dialog .ag-body-viewport { scrollbar-width: none; }
        .plant-rejection-grid.embedded-in-dialog .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
        .plant-rejection-grid.embedded-in-dialog .ag-body-vertical-scroll-viewport::-webkit-scrollbar,
        .plant-rejection-grid.embedded-in-dialog .ag-body-viewport::-webkit-scrollbar { display: none; }
      `}</style>
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={toggleExpand}
        />
      )}
      <Wrapper className={wrapperClassName}>
        <HeaderWrapper className={`pb-0 p-1 flex-shrink-0 ${embeddedInDialog ? "pr-10" : ""}`}>
          <div className="flex flex-col gap-2">
            {!embeddedInDialog && !isExpanded ? (
              <>
                <div className="flex items-center justify-between gap-2 flex-nowrap">
                  <CardTitle className="text-xs font-bold text-gray-800 flex-shrink min-w-0"><h3 className="truncate">{title}</h3></CardTitle>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button onClick={resetFilters} disabled={isTransitioning} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50" title="Reset All Filters"><RotateCcw className="h-4 w-4" /></Button>
                    <Button onClick={toggleExpand} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"><Maximize2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {timeView === "daily" && drillHistory.length > 0 && (
                    <span className="text-gray-600 text-xs font-bold">Drill Path: {drillHistory.join(" → ")}</span>
                  )}
                  {timeView === "monthly" && (
                    <>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={embeddedInDialog ? "dataView-cs-dialog" : "dataView-cs"} checked={dataView === "overall"} onChange={() => setDataView("overall")} className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Overall</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={embeddedInDialog ? "dataView-cs-dialog" : "dataView-cs"} checked={dataView === "zone"} onChange={() => setDataView("zone")} className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Zone</span>
                      </label>
                      {dataView === "zone" && (
                        <>
                          <DrillStateIndicator level={drilldownFromZone ? "plant" : "zone"} />
                          {drilldownFromZone && (
                            <Button onClick={() => setDrilldownFromZone(null)} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700" title="Back to zone chart">
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {timeView === "daily" && <DrillStateIndicator level={drilldownState.level} />}
                  {timeView === "daily" && drilldownState.filters.length > 1 && (
                    <Button onClick={handleBackClick} disabled={isTransitioning} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"><ArrowLeft className="h-4 w-4" /></Button>
                  )}
                  <div className="flex rounded-md border border-gray-300 overflow-hidden">
                    <button type="button" onClick={() => setTimeView("daily")} className={`px-2 py-1 text-xs font-medium ${timeView === "daily" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}>Present</button>
                    <button type="button" onClick={() => setTimeView("monthly")} className={`px-2 py-1 text-xs font-medium border-l border-gray-300 ${timeView === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}>Monthly</button>
                  </div>
                </div>
              </>
            ) : (
              <div className={`flex items-center justify-between gap-2 ${embeddedInDialog ? "flex-nowrap min-h-[2rem] items-center" : "flex-wrap"}`}>
                {embeddedInDialog ? (
                  <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                ) : (
              <CardTitle className="text-xs font-bold text-gray-800">
              <h3>{title}</h3>
              </CardTitle>
                )}
                <div className={`flex items-center gap-2 flex-wrap ${embeddedInDialog ? "flex-shrink-0" : ""}`}>
                  {timeView === "daily" && drillHistory.length > 0 && (
                    <span className="text-gray-600 text-xs font-bold">Drill Path: {drillHistory.join(" → ")}</span>
                  )}
                  {timeView === "monthly" && (
                    <>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={embeddedInDialog ? "dataView-cs-dialog" : "dataView-cs"} checked={dataView === "overall"} onChange={() => setDataView("overall")} className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Overall</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={embeddedInDialog ? "dataView-cs-dialog" : "dataView-cs"} checked={dataView === "zone"} onChange={() => setDataView("zone")} className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Zone</span>
                      </label>
                      {dataView === "zone" && (
                        <>
                          <DrillStateIndicator level={drilldownFromZone ? "plant" : "zone"} />
                          {drilldownFromZone && (
                            <Button onClick={() => setDrilldownFromZone(null)} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700" title="Back to zone chart">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                        </>
                      )}
                    </>
                  )}
                  {timeView === "daily" && <DrillStateIndicator level={drilldownState.level} />}
                  {timeView === "daily" && drilldownState.filters.length > 1 && (
                    <Button onClick={handleBackClick} disabled={isTransitioning} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"><ArrowLeft className="h-4 w-4" /></Button>
                  )}
                  <div className="flex rounded-md border border-gray-300 overflow-hidden">
                    <button type="button" onClick={() => setTimeView("daily")} className={`px-2 py-1 text-xs font-medium ${timeView === "daily" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}>Present</button>
                    <button type="button" onClick={() => setTimeView("monthly")} className={`px-2 py-1 text-xs font-medium border-l border-gray-300 ${timeView === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}>Monthly</button>
                </div>
                  <Button onClick={resetFilters} disabled={isTransitioning} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50" title="Reset All Filters"><RotateCcw className="h-4 w-4" /></Button>
                  <Button onClick={toggleExpand} className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700">{isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}</Button>
              </div>
            </div>
            )}
            </div>
            {/* <div className="flex items-center gap-4">
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
            </div> */}
        </HeaderWrapper>
        <ContentWrapper 
          className={`p-0 relative pt-0 overflow-auto ${embeddedInDialog ? "flex-1 min-h-0" : isExpanded ? "h-[calc(100vh-8rem)] flex-1 min-h-0" : "h-[240px] max-h-[240px] min-h-0 flex-1"}`}
        >
          {timeView === "daily" && (error || (!isLoading && chartData.length === 0)) && <NoDataDisplay />}
          {timeView === "monthly" && (error || (
            !isTransitioning &&
            ((dataView === "overall" && !monthlyRejectionsData?.overall_data?.length) ||
              (dataView === "zone" && !monthlyRejectionsData?.zone_data?.length) ||
              (dataView === "zone" && drilldownFromZone && !monthlyRejectionsData?.location_data?.length))
          )) && <NoDataDisplay />}
          {isTransitioning && <LoadingOverlay />}
          <div
            ref={chartDivRef}
            style={{ 
              width: "100%", 
                height: embeddedInDialog ? "100%" : isExpanded ? "calc(100vh - 8rem)" : `${chartHeightPx}px`,
            }}
          />
        </ContentWrapper>
      </Wrapper>
    </>
  );
};

export default CSRejections;