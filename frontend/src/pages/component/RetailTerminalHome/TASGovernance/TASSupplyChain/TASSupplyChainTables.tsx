import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import { Fuel, RefreshCw, Search, X } from 'lucide-react';
import DataGrid from '@/components/common/DataGrid';
import EnhancedTimeFilter from '../../../Governance/filters/TimeFilterButtons';
import TASSupplyChainProductInsightCalendar from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainProductInsightCalendar';
import { CustomMultiSelect } from '@/@/components/ui/custom-multiselect';
import { apiClient } from '@/services/apiClient';
import TASSupplyChainDaywiseAm3BarChart from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainDaywiseAm3BarChart';
import TASSupplyChainDaywiseStockUllageLineChart from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainDaywiseStockUllageLineChart';
import TASSupplyChainStockUtilizationView from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainStockUtilizationView';

interface TASSupplyChainTablesProps {
  isRefreshing: boolean;
  refreshToken: number;
  selectedZone: string;
  selectedLocation: string;
  isDailyTrendsLoading: boolean;
  productWiseRows: any[];
  dailyTrendsRows: any[];
  outletDispatchRows: any[];
  summaryTimeFilter: string | null | { key: string; cond: string; value: string };
  onSummaryTimeFilterChange: (value: string | null | { key: string; cond: string; value: string }) => void;
  productInsightTimeFilter: string | null | { key: string; cond: string; value: string };
  onProductInsightTimeFilterChange: (value: string | null | { key: string; cond: string; value: string }) => void;
  timeFilterResetToken: number;
  outletDispatchFilter: 'all' | 'active' | 'inactive' | 'mixed' | 'MS' | 'POWER 95' | 'POWER 99' | 'HSD' | 'TURBO';
  onOutletDispatchFilterChange: (
    value: 'all' | 'active' | 'inactive' | 'mixed' | 'MS' | 'POWER 95' | 'POWER 99' | 'HSD' | 'TURBO'
  ) => void;
  selectedOutletProducts: string[];
  onSelectedOutletProductsChange: (value: string[]) => void;
  isOutletDispatchLoading: boolean;
  isOutletDispatchRoCountLoading: boolean;
  focusOutletDispatchKey: number;
  outletDispatchTotalRoValue: string;
  outletDispatchActiveRoValue: string;
  outletDispatchInactiveRoValue: string;
  outletDispatchMixedRoValue: string;
  isProductInsightLoading: boolean;
  productWiseColumnDefs: any[];
  dailyTrendsColumnDefs: any[];
  pendingRecordsColumnDefs: any[];
  onDayWiseTrendRowsChange?: (rows: any[]) => void;
  onDayWiseTrendLoadingChange?: (loading: boolean) => void;
  executiveProductWiseChartRows: Array<{
    productName: string;
    availableStock: number;
    deadStock: number;
    capacity: number;
    availablePercent: number;
    deadPercent: number;
  }>;
  getProductTheme: (
    index: number,
    productName?: string
  ) => { badgeBg: string; barBg: string; barLightBg: string; textColor: string };
  isSupplyHubStockMetricsLoading: boolean;
  selectedPlantLabel: string;
  isStockUtilizationSheetOpen: boolean;
  setIsStockUtilizationSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DAYWISE_PRODUCT_ORDER = ['HSD', 'MS', 'ETHANOL', 'ATF', 'BIODIESEL'];
/** Shared height for Product Insight panel. */
const PRODUCT_INSIGHT_PANEL_HEIGHT = 400;
const normalizeDaywiseChartProductName = (product: string) => {
  const key = product.trim().toUpperCase();
  if (key === 'ETHANOL') return 'ETH';
  if (key === 'BIODIESEL') return 'BD';
  return product.trim();
};
const findPreferredHsdOption = (options: string[]) =>
  options.find((option) => option.trim().toUpperCase() === 'HSD');
const hasHsdOption = (options: { id: string; name: string }[]) =>
  options.some((option) => option.id.trim().toUpperCase() === 'HSD');
const getHsdOptionId = (options: { id: string; name: string }[]) =>
  options.find((option) => option.id.trim().toUpperCase() === 'HSD')?.id;
const removeDecimalPart = (value: unknown) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!/^-?[\d,]+(\.\d+)?$/.test(trimmed)) return value;

  return trimmed.split('.')[0];
};
const applyDecimalFormatterToColumnDefs = (columnDefs: any[]): any[] =>
  columnDefs.map((column) => {
    const nextColumn = { ...column };
    if (Array.isArray(nextColumn.children) && nextColumn.children.length > 0) {
      nextColumn.children = applyDecimalFormatterToColumnDefs(nextColumn.children);
    } else {
      const existingValueFormatter = nextColumn.valueFormatter;
      nextColumn.valueFormatter = (params: any) => {
        const rawValue =
          typeof existingValueFormatter === 'function'
            ? existingValueFormatter(params)
            : params.value;
        return removeDecimalPart(rawValue);
      };
    }
    return nextColumn;
  });
const sanitizeRowNumericValues = (rows: any[]) =>
  rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const nextRow: Record<string, any> = { ...row };
    Object.keys(nextRow).forEach((key) => {
      nextRow[key] = removeDecimalPart(nextRow[key]);
    });
    return nextRow;
  });

export default function TASSupplyChainTables({
  isRefreshing,
  refreshToken,
  selectedZone,
  selectedLocation,
  isDailyTrendsLoading,
  productWiseRows,
  dailyTrendsRows,
  outletDispatchRows,
  summaryTimeFilter,
  onSummaryTimeFilterChange,
  productInsightTimeFilter,
  onProductInsightTimeFilterChange,
  timeFilterResetToken,
  outletDispatchFilter,
  onOutletDispatchFilterChange,
  selectedOutletProducts,
  onSelectedOutletProductsChange,
  isOutletDispatchLoading,
  isOutletDispatchRoCountLoading,
  focusOutletDispatchKey,
  outletDispatchTotalRoValue,
  outletDispatchActiveRoValue,
  outletDispatchInactiveRoValue,
  outletDispatchMixedRoValue,
  isProductInsightLoading,
  productWiseColumnDefs,
  dailyTrendsColumnDefs,
  pendingRecordsColumnDefs,
  onDayWiseTrendRowsChange,
  onDayWiseTrendLoadingChange,
  executiveProductWiseChartRows,
  getProductTheme,
  isSupplyHubStockMetricsLoading,
  selectedPlantLabel,
  isStockUtilizationSheetOpen,
  setIsStockUtilizationSheetOpen,
}: TASSupplyChainTablesProps) {
  const formatProductLabel = (value: string) => {
    const key = value.trim().toUpperCase();
    if (key === 'BIODIESEL') return 'BD';
    if (key === 'ETHANOL') return 'ETH';
    return value;
  };
  const PRODUCT_OPTIONS = useMemo(
    () => [
      { id: 'HSD', name: 'HSD' },
      { id: 'MS', name: 'MS' },
      { id: 'POWER 95', name: 'POWER 95' },
      { id: 'POWER 99', name: 'POWER 99' },
      { id: 'POWER 100', name: 'POWER 100' },
      { id: 'TURBO', name: 'TURBO' },
    ],
    []
  );
  const [productTableSearch, setProductTableSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [outletDispatchSearch, setOutletDispatchSearch] = useState('');
  const [dayWiseProductSearch, setDayWiseProductSearch] = useState('');
  const [selectedTerminalPlantIds, setSelectedTerminalPlantIds] = useState<string[]>([]);
  const hasInitializedTerminalSelection = useRef(false);
  const outletDispatchSectionRef = useRef<HTMLDivElement | null>(null);
  const liveTankMonitoringWrapRef = useRef<HTMLDivElement | null>(null);
  const productInsightTableWrapRef = useRef<HTMLDivElement | null>(null);
  const daywiseStockUllageTableWrapRef = useRef<HTMLDivElement | null>(null);
  const tankBcuSummaryTableWrapRef = useRef<HTMLDivElement | null>(null);
  const outletDispatchTableWrapRef = useRef<HTMLDivElement | null>(null);
  const [dayWiseTrendRows, setDayWiseTrendRows] = useState<any[]>([]);
  const [isDayWiseTrendLoading, setIsDayWiseTrendLoading] = useState(false);
  const [selectedDayWiseProducts, setSelectedDayWiseProducts] = useState<string[]>([]);
  const [selectedDayWiseChartProduct, setSelectedDayWiseChartProduct] = useState<string>('');
  const [selectedDayWiseStockUllageProduct, setSelectedDayWiseStockUllageProduct] = useState<string>('');
  const [showDayWiseStockUllageTable] = useState(true);
  const [dayWiseTimeFilter, setDayWiseTimeFilter] = useState<string | null | { key: string; cond: string; value: string }>('3M');
  useEffect(() => {
    setDayWiseTimeFilter('3M');
  }, [timeFilterResetToken]);

  const DEFAULT_DAYWISE_DATE_RANGE = '2026-02-16, 2026-03-16';
  /** Same fixed window as Supply Chain Trends (3M) for Daywise Available Stock/Ullage table. */
  const DEFAULT_DAYWISE_STOCK_ULLAGE_TABLE_DATE_VALUE = '2026-02-05, 2026-03-05';
  const getDateRangeFromFilter = (
    filter: string | null | { key: string; cond: string; value: string }
  ): { startDate: string; endDate: string } => {
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];

    if (!filter) {
      return { startDate: currentDate, endDate: currentDate };
    }

    if (typeof filter === 'object' && filter.key === 'Date' && filter.value) {
      const [startDateRaw, endDateRaw] = filter.value.split(',');
      const startDate = startDateRaw?.trim() || currentDate;
      const endDate = endDateRaw?.trim() || startDate;
      return { startDate, endDate };
    }

    if (typeof filter === 'string') {
      const endDate = currentDate;
      const start = new Date(today);
      switch (filter) {
        case 'TDY':
          return { startDate: endDate, endDate };
        case 'YDY': {
          start.setDate(start.getDate() - 1);
          const date = start.toISOString().split('T')[0];
          return { startDate: date, endDate: date };
        }
        case '1W':
          start.setDate(start.getDate() - 7);
          return { startDate: start.toISOString().split('T')[0], endDate };
        case '15D':
          start.setDate(start.getDate() - 15);
          return { startDate: start.toISOString().split('T')[0], endDate };
        case '1M':
          start.setMonth(start.getMonth() - 1);
          return { startDate: start.toISOString().split('T')[0], endDate };
        case '3M':
          start.setMonth(start.getMonth() - 3);
          return { startDate: start.toISOString().split('T')[0], endDate };
        default:
          return { startDate: endDate, endDate };
      }
    }

    return { startDate: currentDate, endDate: currentDate };
  };

  const terminalPlantOptions = useMemo(() => {
    const uniqueIds = Array.from(
      new Set(
        outletDispatchRows
          .map((row: any) => String(row?.terminalPlantId ?? '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return uniqueIds.map((id) => ({ id, name: id }));
  }, [outletDispatchRows]);

  useEffect(() => {
    if (terminalPlantOptions.length === 0) {
      setSelectedTerminalPlantIds([]);
      hasInitializedTerminalSelection.current = false;
      return;
    }

    if (!hasInitializedTerminalSelection.current) {
      setSelectedTerminalPlantIds(terminalPlantOptions.map((option) => option.id));
      hasInitializedTerminalSelection.current = true;
      return;
    }

    setSelectedTerminalPlantIds((prev) => {
      const validIds = new Set(terminalPlantOptions.map((option) => option.id));
      return prev.filter((id) => validIds.has(id));
    });
  }, [terminalPlantOptions]);

  const sortedOutletDispatchRows = useMemo(() => {
    if (selectedTerminalPlantIds.length === 0) return outletDispatchRows;
    const selectedTerminalSet = new Set(selectedTerminalPlantIds);
    return outletDispatchRows.filter((row: any) =>
      selectedTerminalSet.has(String(row?.terminalPlantId ?? '').trim())
    );
  }, [outletDispatchRows, selectedTerminalPlantIds]);

  useEffect(() => {
    if (focusOutletDispatchKey <= 0) return;
    outletDispatchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusOutletDispatchKey]);


  const handleOutletDispatchGridReady = useCallback((params: any) => {
    params.api.applyColumnState({
      state: [{ colId: 'terminalPlantId', sort: 'asc' }],
      defaultState: { sort: null },
    });
  }, []);

  const outletDispatchColumnDefs = useMemo(() => {
    const appendHeaderClass = (existing: any, className: string) =>
      [existing, className].filter(Boolean).join(' ');

    const centerAlignColumns = (columns: any[]): any[] =>
      columns.map((column) => {
        if (Array.isArray(column?.children) && column.children.length > 0) {
          return {
            ...column,
            headerClass: appendHeaderClass(column?.headerClass, 'outlet-dispatch-group-header'),
            children: centerAlignColumns(column.children),
          };
        }

        return {
          ...column,
          headerClass: appendHeaderClass(column?.headerClass, 'outlet-dispatch-child-header'),
          cellStyle: {
            ...(column?.cellStyle ?? {}),
            textAlign: 'center',
          },
        };
      });

    const selectedProductSet = new Set(selectedOutletProducts);
    const filteredColumns = pendingRecordsColumnDefs.filter((column: any) => {
      const header = String(column?.headerName ?? '');
      const isProductGroup = PRODUCT_OPTIONS.some((option) => option.id === header);
      if (!isProductGroup) return true;
      return selectedProductSet.size === 0 || selectedProductSet.has(header);
    });

    return centerAlignColumns(filteredColumns);
  }, [pendingRecordsColumnDefs, selectedOutletProducts, PRODUCT_OPTIONS]);

  useEffect(() => {
    onDayWiseTrendLoadingChange?.(isDayWiseTrendLoading);
  }, [isDayWiseTrendLoading, onDayWiseTrendLoadingChange]);

  useEffect(() => {
    onDayWiseTrendRowsChange?.(dayWiseTrendRows);
  }, [dayWiseTrendRows, onDayWiseTrendRowsChange]);

  useEffect(() => {
    let isActive = true;
    let fetchTimeout: ReturnType<typeof setTimeout> | null = null;

    const fetchDayWiseTrends = async () => {
      setIsDayWiseTrendLoading(true);
      try {
        const { startDate, endDate } = getDateRangeFromFilter(dayWiseTimeFilter);
        const dayWiseDateValue = !dayWiseTimeFilter
          ? DEFAULT_DAYWISE_DATE_RANGE
          : dayWiseTimeFilter === '3M'
            ? DEFAULT_DAYWISE_STOCK_ULLAGE_TABLE_DATE_VALUE
            : `${startDate}, ${endDate}`;
        const filters = [
          {
            key: 'date_time',
            cond: 'equals',
            value: dayWiseDateValue,
            val: '',
          },
          ...(selectedZone && selectedZone !== 'all'
            ? [
                {
                  key: 'zone',
                  cond: 'equals',
                  value: selectedZone,
                  val: '',
                },
              ]
            : []),
          ...(selectedLocation !== 'all'
            ? [
                {
                  key: 'sap_id',
                  cond: 'equals',
                  value: selectedLocation,
                  val: '',
                },
              ]
            : []),
        ];
        const response = await apiClient.post('/api/tankdetails/get_tank_details', {
          filters,
          action: 'daywise_trends',
          drill_state: '',
          cross_filters: [],
          limit: 0,
          payload: {},
        });

        if (!isActive) return;
        const rawRows =
          response?.data?.data ??
          response?.data?.payload?.data ??
          response?.data?.payload ??
          response?.data;
        const rows = Array.isArray(rawRows)
          ? rawRows
          : Array.isArray(rawRows?.rows)
            ? rawRows.rows
            : [];
        setDayWiseTrendRows(rows);
      } catch (error) {
        if (!isActive) return;
        console.error('Failed to fetch daywise trends:', error);
        setDayWiseTrendRows([]);
      } finally {
        if (isActive) setIsDayWiseTrendLoading(false);
      }
    };

    // Schedule on next tick so StrictMode's first mount cleanup cancels duplicate initial calls.
    fetchTimeout = setTimeout(() => {
      void fetchDayWiseTrends();
    }, 0);

    return () => {
      isActive = false;
      if (fetchTimeout) clearTimeout(fetchTimeout);
    };
  }, [dayWiseTimeFilter, refreshToken, selectedZone, selectedLocation]);

  const dayWiseTrendTableRows = useMemo(() => {
    return dayWiseTrendRows
      .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
      .map((row: any) => ({ ...row }));
  }, [dayWiseTrendRows]);

  const dayWiseProductOptions = useMemo(() => {
    const productKeyCandidates = ['product', 'product_name'];
    const optionsSet = new Set<string>();

    dayWiseTrendTableRows.forEach((row: any) => {
      const productValue = productKeyCandidates
        .map((key) => row?.[key])
        .find((value) => value !== undefined && value !== null && String(value).trim() !== '');

      if (productValue !== undefined && productValue !== null) {
        optionsSet.add(String(productValue).trim());
      }
    });

    const ordered = DAYWISE_PRODUCT_ORDER.filter((product) => optionsSet.has(product));
    const remaining = Array.from(optionsSet).filter((product) => !DAYWISE_PRODUCT_ORDER.includes(product));

    return [...ordered, ...remaining].map((value) => ({ id: value, name: formatProductLabel(value) }));
  }, [dayWiseTrendTableRows]);

  const dayWiseChartProductOptions = useMemo(() => {
    const optionSet = new Set<string>();
    dayWiseTrendRows.forEach((row: any) => {
      const rawProduct = String(row?.product ?? row?.product_name ?? row?.product_grp ?? '').trim();
      if (!rawProduct) return;
      optionSet.add(normalizeDaywiseChartProductName(rawProduct));
    });
    return Array.from(optionSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [dayWiseTrendRows]);

  useEffect(() => {
    setSelectedDayWiseChartProduct((prev) => {
      if (dayWiseChartProductOptions.length === 0) return '';
      const hsdOption = findPreferredHsdOption(dayWiseChartProductOptions);
      if (hsdOption) return hsdOption;
      if (prev && dayWiseChartProductOptions.includes(prev)) return prev;
      return dayWiseChartProductOptions[0];
    });
  }, [dayWiseChartProductOptions]);

  useEffect(() => {
    setSelectedDayWiseStockUllageProduct((prev) => {
      if (dayWiseChartProductOptions.length === 0) return '';
      const hsdOption = findPreferredHsdOption(dayWiseChartProductOptions);
      if (hsdOption) return hsdOption;
      if (prev && dayWiseChartProductOptions.includes(prev)) return prev;
      return dayWiseChartProductOptions[0];
    });
  }, [dayWiseChartProductOptions]);

  useEffect(() => {
    if (dayWiseProductOptions.length === 0) {
      setSelectedDayWiseProducts([]);
      return;
    }

    setSelectedDayWiseProducts((prev) => {
      if (prev.length === 0) {
        return dayWiseProductOptions.map((option) => option.id);
      }
      const validProducts = new Set(dayWiseProductOptions.map((option) => option.id));
      const next = prev.filter((product) => validProducts.has(product));
      if (next.length > 0) return next;
      return dayWiseProductOptions.map((option) => option.id);
    });
  }, [dayWiseProductOptions]);

  useEffect(() => {
    const setupMirrorScrollbar = (wrapEl: HTMLDivElement | null) => {
      if (!wrapEl) return () => {};

      const viewport =
        (wrapEl.querySelector('.ag-center-cols-viewport') as HTMLElement | null) ??
        (wrapEl.matches('[data-mirror-scroll-viewport="true"]') ? wrapEl : null) ??
        (wrapEl.querySelector('[data-mirror-scroll-viewport="true"]') as HTMLElement | null);
      if (!viewport) return () => {};
      const isCustomViewport = viewport.hasAttribute('data-mirror-scroll-viewport');

      const mirrorHost =
        (wrapEl.querySelector('.ag-root-wrapper-body') as HTMLElement | null) ??
        (isCustomViewport ? ((wrapEl.parentElement as HTMLElement | null) ?? wrapEl) : wrapEl);
      mirrorHost.style.position = 'relative';
      if (isCustomViewport) {
        wrapEl.style.paddingBottom = '14px';
      }

      const existingMirror = mirrorHost.querySelector('.tas-h-scroll-mirror');
      if (existingMirror) existingMirror.remove();

      const mirror = document.createElement('div');
      mirror.className = 'tas-h-scroll-mirror';
      Object.assign(mirror.style, {
        position: 'absolute',
        left: isCustomViewport ? '0px' : '8px',
        right: isCustomViewport ? '0px' : '8px',
        bottom: '4px',
        height: '8px',
        background: '#e2e8f0',
        borderRadius: '8px',
        zIndex: '25',
        cursor: 'pointer',
        userSelect: 'none',
      });

      const thumb = document.createElement('div');
      Object.assign(thumb.style, {
        position: 'absolute',
        top: '0.5px',
        bottom: '0.5px',
        left: '0px',
        minWidth: '40px',
        background: '#94a3b8',
        borderRadius: '8px',
      });

      mirror.appendChild(thumb);
      mirrorHost.appendChild(mirror);

      const sync = () => {
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const trackWidth = mirror.clientWidth;
        const thumbWidth =
          maxScroll <= 0
            ? trackWidth
            : Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const left = maxScroll <= 0 ? 0 : (viewport.scrollLeft / maxScroll) * movable;
        thumb.style.width = `${thumbWidth}px`;
        thumb.style.left = `${left}px`;
      };

      const onViewportScroll = () => sync();
      viewport.addEventListener('scroll', onViewportScroll, { passive: true });

      const onTrackClick = (e: MouseEvent) => {
        if (e.target === thumb) return;
        const rect = mirror.getBoundingClientRect();
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = mirror.clientWidth;
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, (x - thumbWidth / 2) / movable));
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

        const onMove = (ev: MouseEvent) => {
          const dx = ev.clientX - startX;
          viewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll));
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      };

      mirror.addEventListener('click', onTrackClick);
      thumb.addEventListener('mousedown', onThumbMouseDown);

      const ro = new ResizeObserver(sync);
      ro.observe(viewport);
      ro.observe(mirror);
      window.addEventListener('resize', sync);
      requestAnimationFrame(sync);

      return () => {
        viewport.removeEventListener('scroll', onViewportScroll);
        mirror.removeEventListener('click', onTrackClick);
        thumb.removeEventListener('mousedown', onThumbMouseDown);
        ro.disconnect();
        window.removeEventListener('resize', sync);
        mirror.remove();
        if (isCustomViewport) {
          wrapEl.style.paddingBottom = '';
        }
      };
    };

    const cleanups: Array<() => void> = [];
    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const bindMirrors = () => {
      cleanups.push(setupMirrorScrollbar(liveTankMonitoringWrapRef.current));
      cleanups.push(setupMirrorScrollbar(productInsightTableWrapRef.current));
      cleanups.push(setupMirrorScrollbar(daywiseStockUllageTableWrapRef.current));
      cleanups.push(setupMirrorScrollbar(tankBcuSummaryTableWrapRef.current));
      cleanups.push(setupMirrorScrollbar(outletDispatchTableWrapRef.current));
    };

    rafId = requestAnimationFrame(bindMirrors);
    timeoutId = setTimeout(bindMirrors, 250);

    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [
    showDayWiseStockUllageTable,
    isRefreshing,
    isDailyTrendsLoading,
    isOutletDispatchLoading,
    productWiseRows,
    dayWiseTrendTableRows,
    dailyTrendsRows,
    sortedOutletDispatchRows,
  ]);

  const dayWisePivotConfig = useMemo(() => {
    if (dayWiseTrendTableRows.length === 0) return null;

    const allKeys = Array.from(
      new Set(dayWiseTrendTableRows.flatMap((row: any) => Object.keys(row ?? {})))
    );
    const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s-]+/g, '_');
    const normalizedToActual = new Map<string, string>();

    allKeys.forEach((key) => {
      const normalized = normalizeKey(key);
      if (!normalizedToActual.has(normalized)) normalizedToActual.set(normalized, key);
    });

    const findActualKey = (aliases: string[]) =>
      aliases
        .map((alias) => normalizedToActual.get(normalizeKey(alias)))
        .find((matched): matched is string => Boolean(matched));

    const dateKey = findActualKey(['date', 'date_time', 'day']);
    const productKey = findActualKey(['product', 'product_name']);
    const metricKeys = {
      capacity: findActualKey(['capacity']),
      available_stock: findActualKey([
        'available_stock',
        'availablestock',
        'avilable_stock',
        'available_stock_qty',
      ]),
      dispatch: findActualKey(['dispatch', 'dispatch_qty', 'tank_dispatch', 'total_dispatch']),
      reciept: findActualKey(['receipt', 'reciept']),
      dead_stock: findActualKey(['dead_stock', 'deadstock']),
      ullage: findActualKey(['ullage']),
    };

    if (!dateKey || !productKey) return null;
    return { dateKey, productKey, metricKeys };
  }, [dayWiseTrendTableRows]);

  const dayWisePivotedRows = useMemo(() => {
    if (!dayWisePivotConfig) return [];

    const selectedProductsSet = new Set(selectedDayWiseProducts);
    const rowsByDate = new Map<string, any>();

    dayWiseTrendTableRows.forEach((row: any) => {
      const dateValue = row?.[dayWisePivotConfig.dateKey];
      const productValue = row?.[dayWisePivotConfig.productKey];
      if (dateValue === undefined || dateValue === null) return;
      if (productValue === undefined || productValue === null) return;

      const normalizedProduct = String(productValue).trim();
      if (selectedProductsSet.size > 0 && !selectedProductsSet.has(normalizedProduct)) return;

      const dateKey = String(dateValue).trim();
      if (!rowsByDate.has(dateKey)) {
        rowsByDate.set(dateKey, { date: dateKey });
      }

      const dateRow = rowsByDate.get(dateKey);
      Object.entries(dayWisePivotConfig.metricKeys).forEach(([metricName, metricKey]) => {
        if (!metricKey) return;
        dateRow[`${normalizedProduct}__${metricName}`] = row?.[metricKey];
      });
    });

    return Array.from(rowsByDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date), undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [dayWiseTrendTableRows, dayWisePivotConfig, selectedDayWiseProducts]);

  const dayWiseTrendColumnDefs = useMemo(() => {
    const productNames = selectedDayWiseProducts.length
      ? selectedDayWiseProducts
      : dayWiseProductOptions.map((option) => option.id);

    const metricDefinitions = [
      { key: 'capacity', headerName: 'Capacity' },
      { key: 'available_stock', headerName: 'Available Stock' },
      { key: 'dispatch', headerName: 'Dispatch' },
      { key: 'reciept', headerName: 'Reciept' },
      // { key: 'dead_stock', headerName: 'Dead Stock' }, // Temporarily hidden on UI
      { key: 'ullage', headerName: 'Ullage' },
    ];

    const groupedProductColumns = productNames.map((productName) => ({
      headerName: productName,
      headerClass: 'daywise-product-group-header',
      children: metricDefinitions.map((metric) => ({
        field: `${productName}__${metric.key}`,
        headerName: metric.headerName,
        headerClass: 'daywise-product-child-header',
        headerStyle: {
          paddingLeft: '1px',
          paddingRight: '1px',
        },
        minWidth: 96,
        cellStyle: { textAlign: 'center' },
      })),
    }));

    return [
      {
        field: 'date',
        headerName: 'Date',
        minWidth: 140,
        pinned: 'left',
        lockPinned: true,
        cellStyle: { textAlign: 'center' },
      },
      ...groupedProductColumns,
    ];
  }, [dayWiseProductOptions, selectedDayWiseProducts]);
  const formattedProductWiseColumnDefs = useMemo(
    () => applyDecimalFormatterToColumnDefs(productWiseColumnDefs ?? []),
    [productWiseColumnDefs]
  );
  const formattedDailyTrendsColumnDefs = useMemo(
    () => applyDecimalFormatterToColumnDefs(dailyTrendsColumnDefs ?? []),
    [dailyTrendsColumnDefs]
  );
  const formattedDayWiseTrendColumnDefs = useMemo(
    () => applyDecimalFormatterToColumnDefs(dayWiseTrendColumnDefs ?? []),
    [dayWiseTrendColumnDefs]
  );
  const formattedOutletDispatchColumnDefs = useMemo(
    () => applyDecimalFormatterToColumnDefs(outletDispatchColumnDefs ?? []),
    [outletDispatchColumnDefs]
  );
  const formattedProductWiseRows = useMemo(
    () => sanitizeRowNumericValues(productWiseRows ?? []),
    [productWiseRows]
  );
  const formattedDayWisePivotedRows = useMemo(
    () => sanitizeRowNumericValues(dayWisePivotedRows ?? []),
    [dayWisePivotedRows]
  );
  const formattedDailyTrendsRows = useMemo(
    () => sanitizeRowNumericValues(dailyTrendsRows ?? []),
    [dailyTrendsRows]
  );
  const formattedOutletDispatchRows = useMemo(
    () => sanitizeRowNumericValues(sortedOutletDispatchRows ?? []),
    [sortedOutletDispatchRows]
  );

  // Selected Bar Breakdown + old amCharts5 daywise chart logic is kept disabled for now.

  return (
    <div className="w-full min-w-0 space-y-1">
      <style>{`
        .tas-supplychain-table-wrap .ag-body-horizontal-scroll {
          display: none !important;
          height: 0 !important;
          min-height: 0 !important;
        }
        .tas-supplychain-table-wrap .ag-center-cols-viewport {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .tas-supplychain-table-wrap .ag-center-cols-viewport::-webkit-scrollbar {
          height: 0 !important;
          width: 0 !important;
        }
        .product-insight-table .product-insight-child-header .ag-header-cell-label,
        .product-insight-table .ag-header-cell-label {
          justify-content: center !important;
          width: 100% !important;
          text-align: center !important;
        }
        .outlet-dispatch-zone-table .ag-header-cell-label {
          justify-content: center;
          font-weight: 600;
        }
        .outlet-dispatch-zone-table .ag-header-group-cell-label,
        .outlet-dispatch-zone-table .ag-header-group-text {
          font-weight: 600 !important;
        }
        .outlet-dispatch-zone-table .ag-header-group-cell-label {
          justify-content: center !important;
        }
        .daywise-product-table .daywise-product-group-header .ag-header-group-cell-label,
        .daywise-product-table .daywise-product-child-header .ag-header-cell-label {
          justify-content: center !important;
          width: 100% !important;
          text-align: center !important;
        }
        .outlet-dispatch-zone-table .outlet-dispatch-group-header .ag-header-group-cell-label,
        .outlet-dispatch-zone-table .outlet-dispatch-child-header .ag-header-cell-label {
          justify-content: center !important;
          width: 100% !important;
          text-align: center !important;
        }
        .tas-grid-scroll.ag-theme-alpine .ag-paging-panel {
          min-height: 32px !important;
          height: 32px !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          font-size: 11px !important;
        }
        .tas-grid-scroll.ag-theme-alpine .ag-paging-panel > * {
          line-height: 1.1 !important;
        }
        .tas-grid-scroll.ag-theme-alpine .ag-popup {
          z-index: 40 !important;
        }
        .product-insight-table .ag-header-cell-text {
          white-space: normal !important;
          overflow: hidden !important;
          text-overflow: clip !important;
          word-break: break-word !important;
          line-height: 1.2 !important;
          text-align: center !important;
        }
        .product-insight-table .ag-cell {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .product-insight-table .ag-pinned-left-cols-container .ag-cell {
          justify-content: center !important;
        }
        @keyframes tank-wave-shift {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .tank-wave {
          animation: tank-wave-shift 3.5s linear infinite;
          will-change: transform;
        }
      `}</style>
      {/* <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-2 py-2">
          <h3 className="text-sm font-semibold text-gray-900">Live Tank Monitoring</h3>
        </div>
        <div className="px-2 pb-2">
          {isRefreshing ? (
            <div className="flex h-[180px] items-center justify-center">
              <div className="flex flex-col items-center py-6 text-center text-xs text-gray-500">
                <RefreshCw className="mb-2 h-4 w-4 animate-spin text-gray-500" />
                <span>Loading live tank data...</span>
              </div>
            </div>
          ) : !executiveProductWiseChartRows.length ? (
            <div className="py-6 text-center text-xs text-gray-500">No live tank monitoring data available</div>
          ) : (
            <div
              ref={liveTankMonitoringWrapRef}
              className="w-full overflow-x-auto"
              data-mirror-scroll-viewport="true"
            >
              <div className="inline-flex min-w-max flex-nowrap items-start gap-2 pb-1 pr-2">
              {executiveProductWiseChartRows.map((item, index) => {
                const currentLevel = Math.max(0, item.availableStock + item.deadStock);
                const fillPercent = Math.max(0, Math.min(100, item.availablePercent + item.deadPercent));
                const productTheme = getProductTheme(index, item.productName);
                return (
                  <div
                    key={`table-live-tank-${item.productName}`}
                    className="w-[clamp(132px,12vw,210px)] shrink-0 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white ${productTheme.badgeBg}`}
                        >
                          <Fuel className="h-2.5 w-2.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold uppercase text-slate-900">
                            {formatProductLabel(item.productName)}
                          </div>
                          <div className="text-xs font-semibold text-gray-500">
                            {item.capacity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}L
                          </div>
                        </div>
                      </div>
                      <div className={`text-xs font-bold leading-none ${productTheme.textColor}`}>{fillPercent.toFixed(1)}%</div>
                    </div>
                    <div className="mx-0.5 mb-2.5 relative h-20 overflow-hidden rounded-b-[16px] rounded-t-sm border-[3px] border-gray-300 bg-white">
                      <div
                        className={`absolute bottom-0 left-0 right-0 overflow-hidden transition-[height] duration-300 ${productTheme.barBg}`}
                        style={{ height: `${fillPercent}%` }}
                      >
                        <div className="tank-wave absolute left-0 top-0 h-3 w-[200%]">
                          <svg
                            viewBox="0 0 200 24"
                            preserveAspectRatio="none"
                            className="h-full w-full"
                            aria-hidden
                          >
                            <path
                              d="M0,0 H200 V8 C184,17 166,17 150,8 C134,-1 116,-1 100,8 C84,17 66,17 50,8 C34,-1 16,-1 0,8 Z"
                              fill="#ffffff"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className={`absolute inset-x-0 bottom-0 h-1.5 ${productTheme.barLightBg}`} aria-hidden />
                    </div>
                    <div className="space-y-1.5">
                      <div className="pb-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-semibold text-slate-700">Current Level</span>
                          <span className="text-xs font-bold text-slate-900">
                            {currentLevel.toLocaleString('en-IN', { maximumFractionDigits: 2 })}L
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className={`h-full rounded-full ${productTheme.barBg}`} style={{ width: `${fillPercent}%` }} />
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] font-semibold text-slate-700">Total Capacity</span>
                        <span className="text-xs font-bold text-slate-900">
                          {item.capacity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}L
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div> */}
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          style={{ height: PRODUCT_INSIGHT_PANEL_HEIGHT }}
        >
          <div className="flex shrink-0 flex-col gap-2 px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="shrink-0 text-sm font-semibold text-gray-900">Product Insight</h3>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <Input
                  value={productTableSearch}
                  onChange={(e) => setProductTableSearch(e.target.value)}
                  placeholder="Search table..."
                  className="h-7 w-full pl-7 pr-8 text-xs sm:w-[240px]"
                />
                {productTableSearch ? (
                  <button
                    type="button"
                    onClick={() => setProductTableSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear product table search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <TASSupplyChainProductInsightCalendar
                selectedFilter={productInsightTimeFilter}
                onFilterChange={onProductInsightTimeFilterChange}
                resetTrigger={timeFilterResetToken}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
            <div
              ref={productInsightTableWrapRef}
              className="tas-supplychain-table-wrap h-full min-h-0 overflow-hidden"
            >
              <DataGrid
                className="tas-grid-scroll product-insight-table h-full"
                style={{ ['--ag-paging-panel-height' as any]: '32px', height: '100%' }}
                rowData={formattedProductWiseRows}
                columnDefs={formattedProductWiseColumnDefs}
                loading={isProductInsightLoading}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                respectColumnTextAlign
                suppressNoRowsOverlayWhenLoading
                quickFilterText={productTableSearch}
                height="100%"
                headerHeight={32}
                pagination={true}
                paginationPageSize={10}
                rowSelection="single"
                suppressRowClickSelection={true}
                defaultColDef={{
                  sortable: true,
                  filter: false,
                  resizable: true,
                  editable: false,
                  flex: 1,
                  wrapHeaderText: true,
                  autoHeaderHeight: true,
                  suppressMovable: true,
                  valueFormatter: (params: any) => removeDecimalPart(params.value),
                  cellStyle: {
                    fontSize: '12px',
                    padding: '4px 6px',
                    fontFamily: 'Arial, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  },
                }}
                gridOptions={{
                  overlayNoRowsTemplate:
                    '<span style="padding: 10px; color: #6b7280;">No data available</span>',
                  autoSizeStrategy: {
                    type: 'fitGridWidth',
                  },
                  rowHeight: 24,
                  alwaysShowHorizontalScroll: true,
                  alwaysShowVerticalScroll: true,
                }}
              />
            </div>
          </div>
        </div>
        <TASSupplyChainStockUtilizationView
          executiveProductWiseChartRows={executiveProductWiseChartRows}
          getProductTheme={getProductTheme}
          isRefreshing={isRefreshing}
          isSupplyHubStockMetricsLoading={isSupplyHubStockMetricsLoading}
          selectedPlantLabel={selectedPlantLabel}
          isStockUtilizationSheetOpen={isStockUtilizationSheetOpen}
          setIsStockUtilizationSheetOpen={setIsStockUtilizationSheetOpen}
          layout="fullWidth"
        />
      </div>
      <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2"> 
        {/* Daywise Product Dispatch and Reciept Trends hidden for now. */}
        <div
          className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm ${
            showDayWiseStockUllageTable ? 'xl:col-span-2' : ''
          }`}
        >
          <div className="px-2 pb-2">
            <div className="mb-2 flex w-full min-w-0 flex-col gap-2 rounded-lg px-2 py-1 text-[11px] sm:flex-row sm:items-center sm:justify-between">
              <h3 className="shrink-0 text-sm font-bold text-gray-900 sm:whitespace-nowrap">
                Daywise Available Stock and Ullage Trends
              </h3>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <>
                  <span className="shrink-0 text-xs font-semibold text-black">Product</span>
                  <CustomMultiSelect
                    options={dayWiseProductOptions}
                    value={selectedDayWiseProducts}
                    onValueChange={setSelectedDayWiseProducts}
                    placeholder="Select Product"
                    maxCount={0}
                    hideSelectAll
                    triggerDisplay="firstWithCount"
                    loading={isRefreshing || isDayWiseTrendLoading}
                    className="h-7 min-h-7 w-[168px] min-w-[168px] max-w-[168px] bg-white text-xs"
                  />
                </>
                {showDayWiseStockUllageTable ? (
                  <div className="relative min-w-[220px]">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={dayWiseProductSearch}
                      onChange={(e) => setDayWiseProductSearch(e.target.value)}
                      placeholder="Search table..."
                      className="h-7 w-full pl-7 pr-8 text-xs"
                    />
                    {dayWiseProductSearch ? (
                      <button
                        type="button"
                        onClick={() => setDayWiseProductSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear daywise product table search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <EnhancedTimeFilter
                  selectedFilter={dayWiseTimeFilter}
                  onFilterChange={setDayWiseTimeFilter}
                  resetTrigger={timeFilterResetToken}
                />
              </div>
            </div>
            <div ref={daywiseStockUllageTableWrapRef} className="tas-supplychain-table-wrap">
              <DataGrid
                className="tas-grid-scroll daywise-product-table"
                style={{ ['--ag-paging-panel-height' as any]: '32px' }}
                rowData={formattedDayWisePivotedRows}
                columnDefs={formattedDayWiseTrendColumnDefs}
                loading={isRefreshing || isDayWiseTrendLoading}
                paginationPageSizeSelector={[10, 20, 50, 100]}
              respectColumnTextAlign
              suppressNoRowsOverlayWhenLoading
                quickFilterText={dayWiseProductSearch}
                height="345px"
                headerHeight={32}
                pagination={true}
                paginationPageSize={10}
                rowSelection="single"
                suppressRowClickSelection={true}
                defaultColDef={{
                  sortable: true,
                  filter: false,
                  resizable: true,
                  editable: false,
                  flex: 1,
                  wrapHeaderText: true,
                  autoHeaderHeight: true,
                  suppressMovable: true,
                  valueFormatter: (params: any) => removeDecimalPart(params.value),
                  cellStyle: {
                    fontSize: '12px',
                    padding: '4px 6px',
                    fontFamily: 'Arial, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                }}
                gridOptions={{
                  overlayNoRowsTemplate:
                    '<span style="padding: 10px; color: #6b7280;">No data available</span>',
                  autoSizeStrategy: {
                    type: 'fitGridWidth',
                  },
                  rowHeight: 24,
                  groupHeaderHeight: 24,
                  alwaysShowHorizontalScroll: true,
                  alwaysShowVerticalScroll: true,
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-2 py-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Tank and BCU Dispatch Summary</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search table..."
                className="h-7 w-[240px] pr-8 text-xs"
              />
              {tableSearch ? (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <EnhancedTimeFilter
              selectedFilter={summaryTimeFilter}
              onFilterChange={onSummaryTimeFilterChange}
              resetTrigger={timeFilterResetToken}
            />
          </div>
        </div>
        <div className="px-2 pb-2">
          <div ref={tankBcuSummaryTableWrapRef} className="tas-supplychain-table-wrap">
            <DataGrid
              className="tas-grid-scroll"
              style={{ ['--ag-paging-panel-height' as any]: '32px' }}
              rowData={formattedDailyTrendsRows}
              columnDefs={formattedDailyTrendsColumnDefs}
              loading={isRefreshing || isDailyTrendsLoading}
              paginationPageSizeSelector={[10, 20, 50, 100]}
              respectColumnTextAlign
              suppressNoRowsOverlayWhenLoading
              quickFilterText={tableSearch}
              height="360px"
              headerHeight={32}
              pagination={true}
              paginationPageSize={10}
              rowSelection="single"
              suppressRowClickSelection={true}
              defaultColDef={{
                sortable: true,
                filter: false,
                resizable: true,
                editable: false,
                flex: 1,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                suppressMovable: true,
                valueFormatter: (params: any) => removeDecimalPart(params.value),
                cellStyle: {
                  fontSize: '12px',
                  padding: '4px 6px',
                  fontFamily: 'Arial, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                },
              }}
              gridOptions={{
                overlayNoRowsTemplate:
                  '<span style="padding: 10px; color: #6b7280;">No data available</span>',
                autoSizeStrategy: {
                  type: 'fitGridWidth',
                },
                rowHeight: 24,
                alwaysShowHorizontalScroll: true,
                alwaysShowVerticalScroll: true,
              }}
            />
          </div>
        </div>
      </div>
      <div ref={outletDispatchSectionRef} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-2 py-1 flex flex-col items-stretch gap-1.5">
          {/* <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">Outlet Dispatch Records</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={outletDispatchSearch}
                onChange={(e) => setOutletDispatchSearch(e.target.value)}
                placeholder="Search table..."
                className="h-7 w-[240px] pl-7 pr-8 text-xs"
              />
              {outletDispatchSearch ? (
                <button
                  type="button"
                  onClick={() => setOutletDispatchSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear outlet dispatch search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div> */}
          <div className="flex w-full min-w-0 flex-col gap-2 rounded-lg px-2 py-1 text-[11px] lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-2 lg:gap-y-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h3 className="shrink-0 whitespace-nowrap text-sm font-bold text-gray-900">Outlet Dispatch Records</h3>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0">
                  <button
                    type="button"
                    onClick={() => onOutletDispatchFilterChange('all')}
                    className={`h-6 whitespace-nowrap rounded px-2 font-medium ${outletDispatchFilter === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-700'}`}
                  >
                    Total: <span className="ml-1 text-sm font-bold text-slate-900">{isOutletDispatchRoCountLoading ? '--' : outletDispatchTotalRoValue}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOutletDispatchFilterChange('active')}
                    className={`h-6 whitespace-nowrap rounded px-2 font-medium ${outletDispatchFilter === 'active' ? 'bg-emerald-100 text-emerald-800' : 'text-emerald-700'}`}
                  >
                    Active: <span className="ml-1 text-sm font-bold text-emerald-600">{isOutletDispatchRoCountLoading ? '--' : outletDispatchActiveRoValue}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOutletDispatchFilterChange('mixed')}
                    className={`h-6 whitespace-nowrap rounded px-2 font-medium ${outletDispatchFilter === 'mixed' ? 'bg-amber-100 text-amber-800' : 'text-amber-700'}`}
                  >
                    Partial DryOut: <span className="ml-1 text-sm font-bold text-amber-800">{isOutletDispatchRoCountLoading ? '--' : outletDispatchMixedRoValue}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOutletDispatchFilterChange('inactive')}
                    className={`h-6 whitespace-nowrap rounded px-2 font-medium ${outletDispatchFilter === 'inactive' ? 'bg-rose-100 text-rose-800' : 'text-rose-700'}`}
                  >
                    DryOut: <span className="ml-1 text-sm font-bold text-rose-800">{isOutletDispatchRoCountLoading ? '--' : outletDispatchInactiveRoValue}</span>
                  </button>
                </div>
              </div>
              <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:flex-1 sm:flex-nowrap lg:ml-auto lg:justify-end">
                <div className="flex min-w-0 flex-none items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold text-black">Product</span>
                  <CustomMultiSelect
                    options={PRODUCT_OPTIONS}
                    value={selectedOutletProducts}
                    onValueChange={onSelectedOutletProductsChange}
                    placeholder="Select Product"
                    maxCount={0}
                    hideSelectAll
                    triggerDisplay="firstWithCount"
                    loading={isRefreshing || isOutletDispatchLoading}
                    className="h-7 min-h-7 min-w-[132px] max-w-[132px] bg-white text-xs"
                  />
                </div>
                <div className="flex min-w-0 flex-none items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold text-black">Terminal ID</span>
                  <CustomMultiSelect
                    options={terminalPlantOptions}
                    value={selectedTerminalPlantIds}
                    onValueChange={setSelectedTerminalPlantIds}
                    placeholder="Terminal Plant ID"
                    maxCount={0}
                    hideSelectAll
                    triggerDisplay="firstWithCount"
                    className="h-7 min-h-7 min-w-[132px] max-w-[132px] bg-white text-xs"
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold text-black">Search</span>
                  <div className="relative min-w-0 flex-1 overflow-hidden">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={outletDispatchSearch}
                      onChange={(e) => setOutletDispatchSearch(e.target.value)}
                      placeholder="Search table..."
                      className="h-7 w-full min-w-0 max-w-full pl-7 pr-7 text-xs"
                    />
                    {outletDispatchSearch ? (
                      <button
                        type="button"
                        onClick={() => setOutletDispatchSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear outlet dispatch search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
          </div>
        </div>
        <div className="px-2 pb-2">
          <div ref={outletDispatchTableWrapRef} className="tas-supplychain-table-wrap">
              <DataGrid
                className="tas-grid-scroll outlet-dispatch-zone-table"
                style={{
                  ['--ag-paging-panel-height' as any]: '32px',
                  ['--ag-header-background-color' as any]: '#f8fafc',
                  ['--ag-header-foreground-color' as any]: '#020617',
                  ['--ag-border-color' as any]: '#e2e8f0',
                  ['--ag-row-border-color' as any]: '#e2e8f0',
                }}
                rowData={formattedOutletDispatchRows}
                columnDefs={formattedOutletDispatchColumnDefs}
                onGridReady={handleOutletDispatchGridReady}
                loading={isRefreshing || isOutletDispatchLoading}
                paginationPageSizeSelector={[10, 20, 50, 100]}
              respectColumnTextAlign
              suppressNoRowsOverlayWhenLoading
                quickFilterText={outletDispatchSearch}
                height="340px"
                headerHeight={32}
                pagination={true}
                paginationPageSize={10}
                rowSelection="single"
                suppressRowClickSelection={true}
                defaultColDef={{
                  sortable: true,
                  filter: false,
                  resizable: true,
                  editable: false,
                  flex: 1,
                  wrapHeaderText: false,
                  autoHeaderHeight: false,
                  suppressMovable: true,
                  valueFormatter: (params: any) => removeDecimalPart(params.value),
                  cellStyle: {
                    fontSize: '12px',
                    padding: '4px 6px',
                    fontFamily: 'Arial, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                  },
                }}
                gridOptions={{
                  overlayNoRowsTemplate:
                    '<span style="padding: 10px; color: #6b7280;">No data available</span>',
                  autoSizeStrategy: {
                    type: 'fitGridWidth',
                  },
                  rowHeight: 24,
                  groupHeaderHeight: 24,
                  alwaysShowHorizontalScroll: true,
                  alwaysShowVerticalScroll: true,
                }}
              />
          </div>
        </div>
      </div>
    </div>
  );
}
