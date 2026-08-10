import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { apiClient } from "@/services/apiClient";
import { Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import DataGrid from '@/components/common/DataGrid';

interface GenerationInsightsProps {
  zone?: string[] | string;
  timeFilter?: string | null | { key: string; cond: string; value: string };
  refreshKey?: number;
  selectedLocation?: string | null;
  selectedPlant?: string | null;
  bu?: string;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
}

interface GenerationInsightData {
  sap_id: string;
  name: string;
  actual_energy: number;
  estimated_energy: number;
  energy_generation_hours: number;
  solar_window_hours: number;
  export_available_hour: number;
  power_outage: number;
  adjusted_expected: number;
  loss_of_power_outage: number;
  loss_of_power_outage_percentage: number;
  efficiency_estimated_actual_percentage: number;
  loss_dust_soil_percentage: number;
  total_loss: number;
  grid_availability_percentage: number;
}

// Custom tooltip: render "Garbage value coming for meter" in red with visible card background
const MeterIssueTooltip = (props: { value?: string }) => {
  const v = props?.value;
  if (!v) return null;
  return (
    <div
      style={{
        backgroundColor: '#fff',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span style={{ color: '#dc2626', fontWeight: 600 }}>{v}</span>
    </div>
  );
};

// Overall insights (pie + availability) from get_overall_insights
interface LossBreakdownEntry {
  name: string;
  value: number;
  color: string;
  lossKwh?: number; // absolute loss (KWH) when available from API
}
interface OverallInsightsData {
  grid_availability_percentage: number;
  loss_of_power_outage_percentage: number;
  loss_dust_soil_percentage: number;
  total_loss: number;
  actual_energy?: number;
  estimated_energy?: number;
  pieChartData: { category: string; value: number; color: string; lossKwh?: number }[];
  lossBreakdown: LossBreakdownEntry[];
}

const GenerationInsights: React.FC<GenerationInsightsProps> = ({ 
  zone, 
  timeFilter, 
  refreshKey = 0, 
  selectedLocation = null, 
  selectedPlant = null,
  bu = 'TAS',
  searchTerm: searchTermProp,
  onSearchChange,
}) => {
  const [tableData, setTableData] = useState<GenerationInsightData[]>([]);
  const [overallInsights, setOverallInsights] = useState<OverallInsightsData | null>(null);
  const [internalSearch, setInternalSearch] = useState('');
  const isControlled = searchTermProp !== undefined && onSearchChange !== undefined;
  const searchTerm = isControlled ? searchTermProp ?? '' : internalSearch;
  const setSearchTerm = isControlled ? (onSearchChange ?? (() => {})) : setInternalSearch;
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [isPieLoading, setIsPieLoading] = useState(true);
  const pieChartRef = useRef<HTMLDivElement>(null);
  const pieRootRef = useRef<am5.Root | null>(null);
  const gridApiRef = useRef<{ sizeColumnsToFit: () => void } | null>(null);
const gridContainerRef = useRef<HTMLDivElement | null>(null);
const syncScrollbarRef = useRef<(() => void) | null>(null);
  // Pie chart: only from get_overall_insights response (no mock/fallback)
  const pieChartData = useMemo(
    () => overallInsights?.pieChartData ?? [],
    [overallInsights]
  );
  const availabilityValue = useMemo(
    () => overallInsights?.grid_availability_percentage ?? null,
    [overallInsights]
  );
  const totalLossValue = useMemo(
    () => overallInsights?.total_loss ?? null,
    [overallInsights]
  );
  const lossBreakdown = useMemo(
    () => overallInsights?.lossBreakdown ?? [],
    [overallInsights]
  );

  // amCharts5 pie chart - data from get_overall_insights
  useEffect(() => {
    if (isPieLoading) {
      if (pieRootRef.current) {
        pieRootRef.current.dispose();
        pieRootRef.current = null;
      }
      return;
    }
    if (!pieChartRef.current) return;

    const root = am5.Root.new(pieChartRef.current);
    pieRootRef.current = root;
    if (root._logo) root._logo.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        radius: am5.percent(75),
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 6,
        paddingBottom: 6,
      })
    );

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: 'value',
        categoryField: 'category',
        innerRadius: am5.percent(40),
        startAngle: -90,
      })
    );

    series.slices.template.setAll({
      stroke: am5.color(0xffffff),
      strokeWidth: 1.5,
      cornerRadius: 4,
      tooltipText: '{category}: {value.formatNumber("#.##")}%',
      tooltipX: am5.percent(100),
      tooltipY: am5.percent(50),
    });

    series.slices.template.states.create('hover', {
      shiftRadius: 12,
      strokeWidth: 2,
    });

    series.slices.template.adapters.add('fill', (fill, target) => {
      const dataItem = target.dataItem;
      if (dataItem?.dataContext && typeof dataItem.dataContext === 'object' && 'color' in dataItem.dataContext) {
        const hex = (dataItem.dataContext as { color: string }).color.replace('#', '');
        return am5.color(parseInt(hex, 16));
      }
      return fill;
    });

    // Hide slice labels – center overlay shows TOTAL LOSS
    series.labels.template.set('visible', false);

    series.data.setAll(pieChartData);
    series.appear(1000, 100);
    chart.appear(1000, 100);

    return () => {
      root.dispose();
      pieRootRef.current = null;
    };
  }, [isPieLoading, pieChartData]);

  // Function to get the correct date filter value
  const getDateFilterValue = (filter: string | null | { key: string; cond: string; value: string } | undefined): string => {
    // Handle date range objects (custom date ranges)
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      // This is a custom date range filter - return the value as is
      return filter.value;
    }

    // Handle string filters
    if (typeof filter === 'string') {
      const filterMap: { [key: string]: string } = {
        't': 't',           // Today
        'tdy': 't',         // Today (alternative)
        'TDY': 't',         // Today (uppercase)
        '1d': '1d',         // Yesterday
        'ydy': '1d',        // Yesterday (alternative)
        'YDY': '1d',        // Yesterday (uppercase)
        '1w': '1w',         // 1 Week
        '1W': '1w',         // 1 Week (uppercase)
        '15d': '15d',       // 15 Days
        '15D': '15d',       // 15 Days (uppercase)
        '1m': '1m',         // 1 Month
        '1M': '1m',         // 1 Month (uppercase)
        '3m': '3m',         // 3 Months
        '3M': '3m',         // 3 Months (uppercase)
        'custom': 'custom'  // Date Range
      };
      return filterMap[filter] || filterMap[filter.toLowerCase()] || filter; // Return mapped value or original filter
    }

    // Default to 1 month
    return '1m';
  };

  // Build shared payload for get_insights and get_overall_insights
  const buildPayload = useCallback((action: string) => {
    const filterValue = getDateFilterValue(timeFilter);
    const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');
    return {
      bu: apiBU,
      action,
      filters: [
        { key: 'bu', cond: '=', value: apiBU },
        { key: 'timestamp_ist', cond: 'date_filter', value: filterValue },
        ...(zone ? [{ key: 'zone', cond: '=', value: Array.isArray(zone) ? zone[0]?.toUpperCase() : zone.toUpperCase() }] : []),
        ...(selectedPlant ? [{ key: 'sap_id', cond: '=', value: selectedPlant }] : []),
        ...(selectedLocation ? [{ key: 'location_name', cond: '=', value: selectedLocation }] : []),
      ],
      drill_state: '',
      cross_filters: [],
      limit: 0,
      time_grain: '',
      category: '',
    };
  }, [timeFilter, zone, selectedPlant, selectedLocation, bu]);

  // Parse get_overall_insights response into pie + availability data (response only, no mock)
  const parseOverallInsights = (raw: unknown): OverallInsightsData | null => {
    if (!raw || typeof raw !== 'object') return null;
    const data = Array.isArray(raw) ? raw[0] : raw;
    if (!data || typeof data !== 'object') return null;
    const obj = data as Record<string, unknown>;
    const grid_availability_percentage = typeof obj.grid_availability_percentage === 'number'
      ? obj.grid_availability_percentage
      : 0;
    const total_loss = typeof obj.total_loss === 'number' ? obj.total_loss : 0;
    const loss_of_power_outage_percentage = typeof obj.loss_of_power_outage_percentage === 'number'
      ? obj.loss_of_power_outage_percentage
      : null;
    const loss_dust_soil_percentage = typeof obj.loss_dust_soil_percentage === 'number'
      ? obj.loss_dust_soil_percentage
      : null;
    const loss_of_power_outage = typeof obj.loss_of_power_outage === 'number' ? obj.loss_of_power_outage : undefined;
    const actual_energy = typeof obj.actual_energy === 'number' ? obj.actual_energy : undefined;
    const estimated_energy = typeof obj.estimated_energy === 'number' ? obj.estimated_energy : undefined;

    const pieChartData: { category: string; value: number; color: string; lossKwh?: number }[] = [];
    const lossBreakdown: LossBreakdownEntry[] = [];
    if (loss_of_power_outage_percentage !== null) {
      pieChartData.push({
        category: 'Loss - Power Outage',
        value: loss_of_power_outage_percentage,
        color: '#393D7E',
        ...(loss_of_power_outage != null ? { lossKwh: loss_of_power_outage } : {}),
      });
      lossBreakdown.push({
        name: 'Loss - Power Outage',
        value: loss_of_power_outage_percentage,
        color: '#393D7E',
        ...(loss_of_power_outage != null ? { lossKwh: loss_of_power_outage } : {}),
      });
    }
    if (loss_dust_soil_percentage !== null) {
      pieChartData.push({ category: 'Loss - Dust/Misc.', value: loss_dust_soil_percentage, color: '#E5BA41' });
      lossBreakdown.push({ name: 'Loss - Dust/Misc.', value: loss_dust_soil_percentage, color: '#E5BA41' });
    }

    return {
      grid_availability_percentage,
      loss_of_power_outage_percentage: loss_of_power_outage_percentage ?? 0,
      loss_dust_soil_percentage: loss_dust_soil_percentage ?? 0,
      total_loss,
      actual_energy,
      estimated_energy,
      pieChartData,
      lossBreakdown,
    };
  };

  // Fetch table data (get_insights) and pie/overall data (get_overall_insights)
  useEffect(() => {
    const apiUrl = '/api/solarpanelcleaning/get_solar_dashboard_summary';

    const fetchTableInsights = async () => {
      setIsTableLoading(true);
      try {
        const tableRes = await apiClient.post(apiUrl, buildPayload('get_insights'));
        const tableRaw = tableRes?.data?.data ?? tableRes?.data ?? tableRes;
        if (tableRaw) {
          if (Array.isArray(tableRaw)) setTableData(tableRaw);
          else if (tableRaw.data && Array.isArray(tableRaw.data)) setTableData(tableRaw.data);
          else setTableData([tableRaw]);
        }
      } catch (error) {
        console.error('Failed to fetch table insights:', error);
      } finally {
        setIsTableLoading(false);
      }
    };

    const fetchOverallInsights = async () => {
      setIsPieLoading(true);
      try {
        const overallRes = await apiClient.post(apiUrl, buildPayload('get_overall_insights'));
        const overallRaw = overallRes?.data?.data ?? overallRes?.data ?? overallRes;
        const parsed = parseOverallInsights(overallRaw);
        setOverallInsights(parsed);
      } catch (error) {
        console.error('Failed to fetch overall insights:', error);
      } finally {
        setIsPieLoading(false);
      }
    };

    fetchTableInsights();
    fetchOverallInsights();
  }, [zone, timeFilter, refreshKey, selectedPlant, selectedLocation, buildPayload]);

  // Format percentage with 2 decimal places
  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
  };

  // Format number with commas and 2 decimal places
  const formatNumber = (value: number | null | undefined, decimals = 2): string => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  // Get base color for progress bar based on value type and value
  // Uses custom palette: #1C4D8D, #C95792, #F8B55F
  const getProgressBarColor = (value: number, type: 'loss' | 'availability'): string => {
    if (value === null || value === undefined || isNaN(value)) return '#D9D9D9';
    
    if (type === 'availability') {
      // Higher availability -> darker color
      if (value >= 80) return '#1C4D8D';  // darkest (blue)
      if (value >= 60) return '#C95792';  // medium (pink/magenta)
      if (value >= 40) return '#F8B55F';  // light (yellow/orange)
      return '#F8B55F';                  // lightest
    } else {
      // Higher loss -> darker color (invert scale)
      const absValue = Math.abs(value);
      if (absValue >= 50) return '#1C4D8D';  // worst loss (blue)
      if (absValue >= 30) return '#C95792';  // medium (pink/magenta)
      if (absValue >= 10) return '#F8B55F';  // light (yellow/orange)
      return '#F8B55F';                      // lowest loss
    }
  };

  // Normalize percentage value for progress bar (0-100)
  const normalizeValue = (value: number | null | undefined): number => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    // Handle negative values by taking absolute value
    const absValue = Math.abs(value);
    // For very large values (>100), cap at 100 for visual display
    // but we'll show the actual value in text
    return Math.min(absValue, 100);
  };

  // Progress bar component
  const ProgressBar = ({ value, type }: { value: number | null | undefined; type: 'loss' | 'availability' }) => {
    if (value === null || value === undefined || isNaN(value)) {
      return <span className="text-xs text-gray-400">-</span>;
    }

    const normalizedValue = normalizeValue(value);
    const percentage = Math.min(normalizedValue, 100);
    const baseColor = getProgressBarColor(value, type);
    const displayValue = formatPercentage(value);
    const isOverflow = Math.abs(value) > 100;
    const showTextInside = percentage >= 20; // Show text inside bar if it's wide enough



    return (
      <div className="w-full max-w-[180px]">
        <div className="flex-1 bg-gray-200 rounded-full h-4 relative overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isOverflow ? 'opacity-80' : ''} flex items-center ${
              showTextInside ? 'justify-start' : 'justify-center'
            }`}
            style={{ 
              width: `${percentage}%`, 
              minWidth: showTextInside ? '40px' : '0px',
              backgroundColor: baseColor
            }}
          >
            {showTextInside && (
              <span className="text-[9px] font-semibold text-white px-1.5 whitespace-nowrap">
                {displayValue}
              </span>
            )}
          </div>
          {!showTextInside && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-semibold text-gray-700 whitespace-nowrap">
                {displayValue}
              </span>
            </div> 
          )}
          {isOverflow && percentage >= 20 && (
            <div className="absolute inset-0 flex items-center justify-end pr-1 pointer-events-none">
              <span className="text-[7px] font-bold text-red-600">!</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Check if row has any negative numeric value (garbage value from meter) – used to highlight whole row
  const rowHasNegativeValue = useCallback((data: GenerationInsightData | undefined): boolean => {
    if (!data) return false;
    const numericFields: (keyof GenerationInsightData)[] = [
      'actual_energy', 'estimated_energy', 'energy_generation_hours', 'solar_window_hours',
      'export_available_hour', 'power_outage', 'adjusted_expected', 'loss_of_power_outage',
      'loss_of_power_outage_percentage', 'efficiency_estimated_actual_percentage',
      'loss_dust_soil_percentage', 'total_loss', 'grid_availability_percentage',
    ];
    return numericFields.some(
      (f) => typeof data[f] === 'number' && (data[f] as number) < 0
    );
  }, []);

  // Tooltip for meter-issue rows: show "Garbage value coming for meter" only (no cell value)
  const meterIssueTooltipValueGetter = useCallback(
    (params: { data?: GenerationInsightData }) =>
      rowHasNegativeValue(params.data) ? 'Garbage value coming from meter' : '',
    [rowHasNegativeValue]
  );

  // Grid table column definitions (AlertTableV2 style)
  const centeredCellStyle = { textAlign: 'center' as const };
  
  // Dynamic cell style function: red for negative values (garbage from meter), normal for others
  const getNumericCellStyle = (params: { value: number | null | undefined }) => {
    const baseStyle = { textAlign: 'center' as const };
    if (typeof params.value === 'number' && params.value < 0) {
      return { 
        ...baseStyle, 
        color: '#dc2626', 
        fontWeight: 700,
        backgroundColor: '#fef2f2'
      };
    }
    return baseStyle;
  };

  const columnDefs = useMemo(() => [
    { headerName: 'SAP ID', 
      field: 'sap_id',
       minWidth: 80, flex: 0, tooltipValueGetter: meterIssueTooltipValueGetter, cellStyle: centeredCellStyle, headerClass: 'no-border-header' },
    {
  headerName: 'Location Name',
      field: 'LocationName',
      minWidth: 160,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: string | null | undefined }) => p.value || '',

      tooltipValueGetter: meterIssueTooltipValueGetter,

    },
    {
      headerName: 'Actual Energy(KWH)',
      field: 'actual_energy',
      minWidth: 130,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: number | null | undefined }) => formatNumber(p.value),
      tooltipValueGetter: meterIssueTooltipValueGetter,
    },
   
    {
      headerName: 'Estimated Energy(KWH)',
      field: 'estimated_energy',
      minWidth: 140,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: number | null | undefined }) => formatNumber(p.value),
      tooltipValueGetter: meterIssueTooltipValueGetter,
    },
    {
      headerName: 'Energy Gen. Hrs',
      field: 'energy_generation_hours',
      minWidth: 100,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: number | null | undefined }) => formatNumber(p.value),
      tooltipValueGetter: meterIssueTooltipValueGetter,
    },
    {
      headerName: 'Solar Window Hrs',
      field: 'solar_window_hours',
      minWidth: 120,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: number | null | undefined }) => formatNumber(p.value),
      tooltipValueGetter: meterIssueTooltipValueGetter,
    },
    {
      headerName: 'Power Outage Hrs',
      field: 'power_outage',
      minWidth: 100,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: number | null | undefined }) => formatNumber(p.value),
      tooltipValueGetter: meterIssueTooltipValueGetter,
    },
    {
      headerName: 'Power Outage (%)',
      field: 'loss_of_power_outage_percentage',
      minWidth: 110,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: number | null | undefined }) => formatPercentage(p.value),
      tooltipValueGetter: meterIssueTooltipValueGetter,
    },
    {
      headerName: 'Dust/Misc. (%)',
      field: 'loss_dust_soil_percentage',
      minWidth: 130,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: number | null | undefined }) => formatPercentage(p.value),
      tooltipValueGetter: meterIssueTooltipValueGetter,
    },
    {
      headerName: 'Grid Avail. (%)',
      field: 'grid_availability_percentage',
      minWidth: 110,
      cellStyle: getNumericCellStyle,
      headerClass: 'no-border-header',
      valueFormatter: (p: { value: number | null | undefined }) => formatPercentage(p.value),
      tooltipValueGetter: meterIssueTooltipValueGetter,
    },
  ], [meterIssueTooltipValueGetter]);

  const defaultColDef = useMemo(() => ({
    flex: 0,
    resizable: true,
    sortable: true,
    filter: false,
    suppressMenu: true,
    tooltipComponent: MeterIssueTooltip,
  }), []);

  // Filter table data based on search term (all columns)
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return tableData;
    const term = searchTerm.toLowerCase().trim();
    return tableData.filter(row =>
      Object.values(row).some(
        value => value != null && String(value).toLowerCase().includes(term)
      )
    );
  }, [tableData, searchTerm]);


  useEffect(() => {
  const setupMirrorScrollbar = (wrapEl: HTMLDivElement | null): (() => void) => {
    if (!wrapEl) return () => {};
    const viewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null;
    if (!viewport) {
      const t = setTimeout(() => setupMirrorScrollbar(wrapEl), 100);
      return () => clearTimeout(t);
    }
    const mirrorHost = (wrapEl.querySelector(".ag-root-wrapper-body") as HTMLElement | null) ?? wrapEl;
    mirrorHost.style.position = "relative";
    wrapEl.querySelector(".tas-h-scroll-mirror")?.remove();
    const mirror = document.createElement("div");
    mirror.className = "tas-h-scroll-mirror";
    Object.assign(mirror.style, {
      position: "absolute", left: "8px", right: "8px", bottom: "0px",
      height: "8px", background: "#e2e8f0", borderRadius: "8px",
      zIndex: "5", cursor: "pointer", userSelect: "none", display: "block",
    });
    const thumb = document.createElement("div");
    Object.assign(thumb.style, {
      position: "absolute", top: "0.5px", bottom: "0.5px", left: "0px",
      minWidth: "40px", background: "#94a3b8", borderRadius: "8px",
    });
    thumb.addEventListener("mouseenter", () => { thumb.style.background = "#475569"; });
    thumb.addEventListener("mouseleave", () => { thumb.style.background = "#94a3b8"; });
    mirror.appendChild(thumb);
    mirrorHost.appendChild(mirror);
    const sync = () => {
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const trackWidth = mirror.clientWidth;
      const thumbWidth = Math.max(40, (viewport.clientWidth / (viewport.scrollWidth || 1)) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      thumb.style.width = `${thumbWidth}px`;
      thumb.style.left = `${(maxScroll > 0 ? (viewport.scrollLeft / maxScroll) : 0) * movable}px`;
    };
    syncScrollbarRef.current = sync;
    viewport.addEventListener("scroll", sync, { passive: true });
    const onTrackClick = (e: MouseEvent) => {
      if (e.target === thumb) return;
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScroll <= 0) return;
      const trackWidth = mirror.clientWidth;
      const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      const ratio = Math.max(0, Math.min(1, (e.clientX - mirror.getBoundingClientRect().left - thumbWidth / 2) / movable));
      viewport.scrollLeft = ratio * maxScroll;
    };
    const onThumbMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScroll <= 0) return;
      const trackWidth = mirror.clientWidth;
      const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      const startX = e.clientX;
      const startScroll = viewport.scrollLeft;
      thumb.style.background = "#475569";
      const onMove = (ev: MouseEvent) => {
        viewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + ((ev.clientX - startX) / movable) * maxScroll));
      };
      const onUp = () => {
        thumb.style.background = "#94a3b8";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
    mirror.addEventListener("click", onTrackClick);
    thumb.addEventListener("mousedown", onThumbMouseDown);
    const ro = new ResizeObserver(sync);
    ro.observe(viewport);
    ro.observe(mirror);
    window.addEventListener("resize", sync);
    requestAnimationFrame(sync);
    return () => {
      viewport.removeEventListener("scroll", sync);
      mirror.removeEventListener("click", onTrackClick);
      thumb.removeEventListener("mousedown", onThumbMouseDown);
      ro.disconnect();
      window.removeEventListener("resize", sync);
      mirror.remove();
      syncScrollbarRef.current = null;
    };
  };
  const cleanup = setupMirrorScrollbar(gridContainerRef.current);
  return () => cleanup();
}, [filteredData]);

useEffect(() => {
  if (syncScrollbarRef.current) {
    requestAnimationFrame(() => { syncScrollbarRef.current?.(); });
  }
}, [filteredData, isTableLoading]);

  const onGridReady = useCallback((params: { api: { sizeColumnsToFit: () => void } }) => {
    gridApiRef.current = params.api;
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full mt-1">
      {/* Pie chart + right side values only (no card) – one loading for both */}
      <div className="flex flex-row gap-4 shrink-0 items-start mt-0 lg:mt-1 relative">
        {isPieLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white rounded">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading generation insights...</p>
            </div>
          </div>
        )}
        {/* Pie Chart - amCharts */}
        <div className="flex flex-col shrink-0 -ml-6">
          <h3 className="text-xs font-bold text-center mb-1">Generation Insights</h3>
          <div className="w-full h-full flex flex-col relative" style={{ width: 260, height: 260, minHeight: '260px' }}>
            <div ref={pieChartRef} className="w-full h-full" style={{ minHeight: '260px', height: '100%' }} />
            {!isPieLoading && totalLossValue != null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-bold text-gray-800 tabular-nums">{totalLossValue.toFixed(2)}%</span>
              </div>
            )}
          </div>
        </div>
        {/* Right side: Grid Availability + Loss breakdown */}
        <div className="flex flex-col gap-3 min-w-[200px] py-1 pt-8 -ml-5">
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md bg-gray-100">
            <span className="text-xs font-medium text-gray-700">Grid Availability</span>
            <span className={`text-sm font-bold tabular-nums ${availabilityValue != null && availabilityValue < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {availabilityValue != null ? `${availabilityValue.toFixed(2)}%` : '–'}
            </span>
          </div>
          {totalLossValue != null && (
            <div className="flex items-center justify-between gap-2 pt-1 pb-1 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-700">Total Loss</span>
              <span className="text-sm font-bold text-gray-800 tabular-nums">{totalLossValue.toFixed(2)}%</span>
            </div>
          )}
          {lossBreakdown.map((entry) => (
            <TooltipProvider key={entry.name} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700">{entry.name}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: entry.color }}>
                        {entry.value.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden w-40">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ backgroundColor: entry.color, width: `${Math.min(entry.value, 100)}%` }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] bg-gray-900 text-white border-0">
                  {overallInsights?.actual_energy != null && (
                    <p className="text-white/90">Actual Energy: {overallInsights.actual_energy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KWH</p>
                  )}
                  {overallInsights?.estimated_energy != null && (
                    <p className="text-white/90">Estimated Energy: {overallInsights.estimated_energy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KWH</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Table - DataGrid (AlertTableV2 style): width scales up on larger screens */}
      <div className="flex-1 min-w-0 w-full max-w-full sm:max-w-[65%] md:max-w-[70%] lg:max-w-[75%] xl:max-w-[82%] 2xl:max-w-[88%] ml-auto overflow-hidden flex flex-col gap-1">
        {!isControlled && (
          <div className="flex justify-end mt-0.5 mr-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex-shrink-0  text-gray rounded-full hover:bg-gray-600 transition-colors flex items-center justify-center text-xs"
                title="Clear search"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      
        <div
  ref={gridContainerRef}
 className="w-full min-w-0 border border-gray-200 overflow-hidden bg-white relative"
 style={{ width: '100%', maxWidth: '100%' }}
>
          {/* Overlay when loading so table content doesn't show in background */}
          {isTableLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 rounded">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading table...</p>
              </div>
            </div>
          )}
          <div className="w-full min-w-0 [&_.ag-header]:!border-0 [&_.ag-header]:!border-b-0 [&_.ag-header]:!outline-none [&_.ag-header-viewport]:!border-0 [&_.ag-header-panel]:!border-0 [&_.ag-header-container]:!border-0 [&_.ag-header-row]:!border-0 [&_.ag-header-row]:!outline-none [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell]:!flex [&_.ag-header-cell]:!items-center [&_.ag-header-cell]:!justify-center [&_.ag-header-cell]:!p-0 [&_.ag-header-cell]:!min-h-0 [&_.ag-header-cell]:!border-0 [&_.ag-header-cell]:!outline-none [&_.ag-header-cell::after]:hidden [&_.ag-header-cell::before]:hidden [&_.ag-header-cell-label]:!p-0 [&_.ag-header-cell-label]:!m-0 [&_.ag-header-cell-label]:!border-0 [&_.ag-header-cell-label]:!flex [&_.ag-header-cell-label]:!w-full [&_.ag-header-cell-label]:!items-center [&_.ag-header-cell-label]:!justify-center [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell-text]:!font-semibold [&_.ag-header-cell-text]:!text-sm [&_.ag-header-cell-text]:!leading-tight [&_.ag-header-cell-text]:!whitespace-normal [&_.ag-header-cell-text]:!text-center [&_.ag-header-cell-text]:!block [&_.ag-header-cell-text]:!break-words [&_.ag-header-cell-focus]:!outline-none [&_.ag-header-cell-focus]:!shadow-none [&_.ag-header-cell-focus]:!border-0 [&_.ag-header-cell-focus]:!ring-0 [&_.ag-focus-managed]:!outline-none [&_.ag-focus-managed]:!shadow-none [&_.no-border-header]:!border-0 [&_.no-border-header]:!outline-none [&_.no-border-header::after]:hidden [&_.no-border-header::before]:hidden [&_.ag-cell]:!text-gray-800 [&_.ag-cell]:!text-xs [&_.ag-cell]:!font-normal [&_.ag-cell]:!py-1 [&_.ag-cell]:!text-center [&_.ag-cell]:!flex [&_.ag-cell]:!items-center [&_.ag-cell]:!justify-center [&_.ag-cell]:!border-0 [&_.ag-cell-value]:!w-full [&_.ag-row]:!min-h-0 [&_.ag-root]:!w-full [&_.ag-body-viewport]:!w-full [&_.ag-center-cols-viewport]:!w-full [&_.ag-row-meter-issue]:!bg-red-50 [&_.ag-row-meter-issue_.ag-cell]:!text-red-800" style={{ minHeight: '18rem', width: '100%', maxWidth: '100%' }}>
            <DataGrid
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowData={filteredData}
              loading={false}
              height="18rem"
              width="100%"
              style={{ minWidth: 0 }}
              headerHeight={45}
              gridOptions={{
              rowHeight: 28,
              getRowClass: (params: { data?: GenerationInsightData }) =>
                rowHasNegativeValue(params.data) ? 'ag-row-meter-issue' : undefined,
            }}
              pagination={true}
              paginationPageSize={20}
              rowSelection="single"
              suppressRowClickSelection={true}
              onGridReady={onGridReady}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerationInsights;