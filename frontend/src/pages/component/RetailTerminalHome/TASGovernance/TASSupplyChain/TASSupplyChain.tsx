import React, { useEffect, useMemo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/@/components/ui/tooltip';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Box,
  Database,
  Fuel,
  Info,
  Package,
  TriangleAlert,
  Truck,
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import TASSupplyChainTables from './TASSupplyChainTables';
import TASSupplyChainOverview from './TASSupplyChainOverview';
import type { ZoneWiseStackedBarRow } from './TASSupplyChainZoneWiseCountChart';

/** Default plant filter for Supply Intelligence Hub location dropdown and API `sap_id` cross-filters. */
export const DEFAULT_SUPPLY_CHAIN_PLANT_NAME = 'Coimbatore';

type SupplyChainLocationRow = { sap_id?: string; name?: string };

/** Resolve plant `sap_id` from location list by display name (exact, then contains). */
export function findPlantSapIdByName(
  locations: SupplyChainLocationRow[],
  plantName: string
): string | null {
  const target = plantName.trim().toLowerCase();
  if (!target || locations.length === 0) return null;
  const exact = locations.find((loc) => loc.name?.trim().toLowerCase() === target);
  const matched =
    exact ??
    locations.find((loc) => loc.name?.trim().toLowerCase().includes(target));
  return matched?.sap_id ? String(matched.sap_id) : null;
}

function pickFirstArray(...candidates: any[]): any[] {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function unwrapAvailabilityPayload(raw: any): any {
  return (
    raw?.data?.data ??
    raw?.data?.payload?.data ??
    raw?.data?.payload ??
    raw?.data ??
    raw?.payload?.data ??
    raw?.payload ??
    raw
  );
}

function isZoneRoStatusBucket(value: unknown): value is { active?: unknown; inactive?: unknown; mixed?: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return 'active' in o || 'inactive' in o || 'mixed' in o;
}

/** Response shape `{ NCZ: { active, inactive, mixed }, ... }` from `zone_wise_count`. */
function findZoneWiseRoStatusMap(data: any): Record<string, { active: number; inactive: number; mixed: number }> | null {
  const candidates = [
    unwrapAvailabilityPayload(data),
    data,
    data?.data,
    unwrapAvailabilityPayload(data)?.data,
  ];
  const skipKeys = new Set(
    ['data', 'payload', 'success', 'message', 'status', 'error', 'errors', 'meta', 'result', 'results'].map((k) =>
      k.toLowerCase()
    )
  );

  for (const obj of candidates) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
    const out: Record<string, { active: number; inactive: number; mixed: number }> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (skipKeys.has(key.toLowerCase())) continue;
      if (!isZoneRoStatusBucket(value)) continue;
      const v = value as Record<string, unknown>;
      out[key] = {
        active: Number(v.active) || 0,
        inactive: Number(v.inactive) || 0,
        mixed: Number(v.mixed) || 0,
      };
    }
    if (Object.keys(out).length > 0) return out;
  }
  return null;
}

/**
 * `zone_wise_count` map → one row per zone for stacked columns (active / mixed / inactive).
 * When a zone is selected, returns a single bar for that zone (if present in payload).
 */
function extractZoneWiseStackedBarRows(responseData: any, selectedZone: string): ZoneWiseStackedBarRow[] {
  const statusMap = findZoneWiseRoStatusMap(responseData);
  if (!statusMap) return [];

  let entries: ZoneWiseStackedBarRow[] = Object.entries(statusMap).map(([zone, v]) => ({
    zone,
    active: v.active,
    mixed: v.mixed,
    inactive: v.inactive,
  }));

  if (selectedZone && selectedZone !== 'all') {
    let match = entries.find((e) => e.zone === selectedZone);
    if (!match) {
      const key = Object.keys(statusMap).find((k) => k.toUpperCase() === selectedZone.toUpperCase());
      if (key !== undefined) {
        const v = statusMap[key];
        match = { zone: key, active: v.active, mixed: v.mixed, inactive: v.inactive };
      }
    }
    entries = match ? [match] : entries;
  }

  entries.sort((a, b) => a.zone.localeCompare(b.zone));
  return entries;
}

function isProductWiseRowCandidate(value: any): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).map((k) => k.toLowerCase());
  return keys.some((k) =>
    [
      'product',
      'product_name',
      'product_category',
      'category',
      'available_stock',
      'tank_dispatch',
      'tank_receipt',
      'stock_sustainability',
      'net_stock',
      'dead_stock',
      'ullage',
      'capacity',
    ].includes(k)
  );
}

function collectProductWiseRowsDeep(obj: any): any[] {
  const rows: any[] = [];
  const visit = (value: any) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      if (value.length > 0 && value.every((item) => isProductWiseRowCandidate(item))) {
        rows.push(...value);
        return;
      }
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      for (const nestedValue of Object.values(value)) {
        visit(nestedValue);
      }
    }
  };
  visit(obj);
  return rows;
}

function ProductInsightSortableHeader(props: any) {
  const currentSort = props.column?.getSort?.();

  const onSortRequested = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    props.progressSort?.(event.shiftKey);
  };

  const onTooltipClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="flex h-full w-full items-center justify-center gap-1 px-1">
      <button
        type="button"
        onClick={onSortRequested}
        className="flex items-center gap-1 border-0 bg-transparent p-0 text-inherit"
      >
        <span className="whitespace-pre-line text-center leading-tight">{props.displayName}</span>
        {currentSort === 'asc' ? (
          <ArrowUp className="h-3 w-3 text-gray-500" />
        ) : currentSort === 'desc' ? (
          <ArrowDown className="h-3 w-3 text-gray-500" />
        ) : null}
      </button>
      {props.tooltipText ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onTooltipClick}
                className="flex items-center border-0 bg-transparent p-0"
                aria-label={`${props.displayName} info`}
              >
                <Info className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="border-gray-700 bg-gray-700 text-white">
              {props.tooltipText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}

/** Normalizes `product_wise_trends` API payload into Product Insight grid rows. */
function mapProductWiseResponseToRows(productWiseData: any): any[] {
  const productWiseRaw =
    productWiseData?.data ?? productWiseData?.payload?.data ?? productWiseData?.payload ?? productWiseData;
  const productWiseList = pickFirstArray(
    Array.isArray(productWiseRaw) ? productWiseRaw : null,
    productWiseRaw?.rows,
    productWiseRaw?.data,
    productWiseRaw?.full_details,
    productWiseRaw?.product_wise,
    productWiseRaw?.productWise,
    productWiseRaw?.result,
    productWiseData?.data?.rows,
    productWiseData?.payload?.rows,
    collectProductWiseRowsDeep(productWiseRaw)
  );
  if (productWiseList.length === 0) return [];

  const preferredProductOrder = ['MS', 'HSD', 'BIODIESEL', 'ATF'];
  const getProductSortRank = (productName: string) => {
    const normalizedName = productName.trim().toUpperCase();
    const rank = preferredProductOrder.indexOf(normalizedName);
    return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
  };
  const toNum = (val: any) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };
  const sortedProductWiseList = productWiseList
    .map((item: any, index: number) => ({ item, index }))
    .sort((a, b) => {
      const aName = String(a.item?.product ?? a.item?.product_name ?? a.item?.product_category ?? a.item?.category ?? '');
      const bName = String(b.item?.product ?? b.item?.product_name ?? b.item?.product_category ?? b.item?.category ?? '');
      const rankDiff = getProductSortRank(aName) - getProductSortRank(bName);
      if (rankDiff !== 0) return rankDiff;
      return a.index - b.index;
    })
    .map(({ item }) => item);

  const mappedProductRows = sortedProductWiseList.map((item: any, index: number) => ({
    productName: String(
      item?.product ?? item?.product_name ?? item?.product_category ?? item?.category ?? `PRODUCT ${index + 1}`
    ),
    sapId: String(item?.sap_id ?? item?.sapId ?? '-'),
    availableStock: toNum(item?.available_stock ?? item?.availableStock).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    }),
    tankDispatch: toNum(item?.tank_dispatch ?? item?.dispatch ?? item?.dispatch_value).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    }),
    tankReceipt: toNum(item?.tank_receipt ?? item?.receipt ?? item?.receipt_value).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    }),
    sevenDayAvg: toNum(item?.seven_day_avg ?? item?.sevenDayAvg).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    }),
    netStock: Math.round(toNum(item?.net_stock ?? item?.stock)).toLocaleString('en-IN'),
    stockSustainability: toNum(item?.stock_sustainability ?? item?.stockSustainability).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    }),
    deadStock: toNum(item?.dead_stock ?? item?.deadStock ?? item?.deadstock).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    }),
    ullage: toNum(item?.ullage ?? item?.Ullage).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    }),
    capacity: toNum(item?.capacity ?? item?.total_capacity ?? item?.totalCapacity).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    }),
  }));

  const uniqueProductRows: typeof mappedProductRows = [];
  const seenProducts = new Set<string>();
  mappedProductRows.forEach((row) => {
    const productKey = String(row?.productName ?? '').trim().toUpperCase();
    if (!productKey || seenProducts.has(productKey)) return;
    seenProducts.add(productKey);
    uniqueProductRows.push(row);
  });
  return uniqueProductRows;
}

/** Builds numeric rows for stock-utilization UI (tank fill %) from mapped product_wise_trends rows. */
function buildExecutiveProductWiseChartRows(productWiseRows: any[]) {
  const parseNumeric = (value: unknown) => {
    const numeric = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(numeric) ? numeric : 0;
  };

  return productWiseRows.map((row: any) => {
    const availableStock = parseNumeric(row?.availableStock ?? row?.available_stock);
    const deadStock = parseNumeric(row?.deadStock ?? row?.dead_stock ?? row?.deadstock);
    const capacity = parseNumeric(row?.capacity);
    const ullage = parseNumeric(row?.ullage);
    const safeCapacity = capacity > 0 ? capacity : 1;
    return {
      productName: String(row?.productName ?? row?.product ?? '-'),
      availableStock,
      deadStock,
      capacity,
      ullage,
      availablePercent: Math.max(0, Math.min(100, (availableStock / safeCapacity) * 100)),
      deadPercent: Math.max(0, Math.min(100, (deadStock / safeCapacity) * 100)),
    };
  });
}

export default function TASSupplyChainComponent() {
  const PRODUCT_GROUP_OPTIONS = useMemo(() => ['MS', 'POWER 95', 'POWER 99', 'POWER 100', 'HSD', 'TURBO'], []);
  const [summaryTimeFilter, setSummaryTimeFilter] = useState<string | null | { key: string; cond: string; value: string }>(null);
  const [hasSummaryTimeFilterOverride, setHasSummaryTimeFilterOverride] = useState(false);
  const [productInsightTimeFilter, setProductInsightTimeFilter] = useState<
    string | null | { key: string; cond: string; value: string }
  >(null);
  const [hasProductInsightTimeFilterOverride, setHasProductInsightTimeFilterOverride] = useState(false);
  const [supplyHubStockTimeFilter, setSupplyHubStockTimeFilter] = useState<
    string | null | { key: string; cond: string; value: string }
  >(null);
  const [hasSupplyHubStockTimeFilterOverride, setHasSupplyHubStockTimeFilterOverride] = useState(false);
  const [isProductInsightFetching, setIsProductInsightFetching] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedPlantDisplayName, setSelectedPlantDisplayName] = useState<string>(
    DEFAULT_SUPPLY_CHAIN_PLANT_NAME
  );
  const [locationFilterReady, setLocationFilterReady] = useState(false);
  const defaultPlantSapIdRef = React.useRef<string | null>(null);
  const [dispatchRateValue, setDispatchRateValue] = useState<string>('0');
  const [receiptRateValue, setReceiptRateValue] = useState<string>('0');
  const [netStockValue, setNetStockValue] = useState<string>('0');
  const [stockSustainabilityValue, setStockSustainabilityValue] = useState<string>('0');
  const [totalProductValue, setTotalProductValue] = useState<string>('0');
  const [totalCapacityValue, setTotalCapacityValue] = useState<string>('0');
  const [totalUllageCapacityValue, setTotalUllageCapacityValue] = useState<string>('0');
  const [activeOutletsValue, setActiveOutletsValue] = useState<string>('0');
  const [activeOutletsUnit, setActiveOutletsUnit] = useState<string>('');
  const [activeRoValue, setActiveRoValue] = useState<string>('0');
  const [inactiveRoValue, setInactiveRoValue] = useState<string>('0');
  const [mixedRoValue, setMixedRoValue] = useState<string>('0');
  const [outletDispatchTotalRoValue, setOutletDispatchTotalRoValue] = useState<string>('0');
  const [outletDispatchActiveRoValue, setOutletDispatchActiveRoValue] = useState<string>('0');
  const [outletDispatchInactiveRoValue, setOutletDispatchInactiveRoValue] = useState<string>('0');
  const [outletDispatchMixedRoValue, setOutletDispatchMixedRoValue] = useState<string>('0');
  /** RO counts for Outlet Dispatch View chart — not updated by Records section product/filter changes. */
  const [outletDispatchChartTotalRoValue, setOutletDispatchChartTotalRoValue] = useState<string>('0');
  const [outletDispatchChartActiveRoValue, setOutletDispatchChartActiveRoValue] = useState<string>('0');
  const [outletDispatchChartInactiveRoValue, setOutletDispatchChartInactiveRoValue] = useState<string>('0');
  const [outletDispatchChartMixedRoValue, setOutletDispatchChartMixedRoValue] = useState<string>('0');
  const [isOutletDispatchRoCountLoading, setIsOutletDispatchRoCountLoading] = useState(false);
  const [isOutletDispatchChartRoCountLoading, setIsOutletDispatchChartRoCountLoading] = useState(false);
  const [zoneWiseStackedBarRows, setZoneWiseStackedBarRows] = useState<ZoneWiseStackedBarRow[]>([]);
  const [isZoneWiseCountLoading, setIsZoneWiseCountLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [productWiseRows, setProductWiseRows] = useState<any[]>([]);
  /** Product-wise capacity/ullage for MS/HSD cards & Stock Utilization (chart time — not Product Insight). */
  const [supplyHubProductWiseRows, setSupplyHubProductWiseRows] = useState<any[]>([]);
  const [isSupplyHubProductWiseLoading, setIsSupplyHubProductWiseLoading] = useState(false);
  const [dailyTrendsRows, setDailyTrendsRows] = useState<any[]>([]);
  const [outletDispatchRows, setOutletDispatchRows] = useState<any[]>([]);
  const [outletDispatchAllRows, setOutletDispatchAllRows] = useState<any[]>([]);
  const [outletDispatchInStockRows, setOutletDispatchInStockRows] = useState<any[]>([]);
  const [outletDispatchOutOfStockRows, setOutletDispatchOutOfStockRows] = useState<any[]>([]);
  const [outletDispatchMixedRows, setOutletDispatchMixedRows] = useState<any[]>([]);
  const [outletDispatchStatusFilter, setOutletDispatchStatusFilter] = useState<
    'all' | 'active' | 'inactive' | 'mixed' | 'MS' | 'POWER 95' | 'POWER 99' | 'HSD' | 'TURBO'
  >('all');
  const [outletDispatchChartFilter, setOutletDispatchChartFilter] = useState<
    'all' | 'active' | 'inactive' | 'mixed'
  >('all');
  const [selectedOutletProducts, setSelectedOutletProducts] = useState<string[]>(PRODUCT_GROUP_OPTIONS);
  const [isTotalRoLoading, setIsTotalRoLoading] = useState(false);
  const [isOutletDispatchLoading, setIsOutletDispatchLoading] = useState(false);
  const [isDailyTrendsLoading, setIsDailyTrendsLoading] = useState(false);
  const [dispatchReceiptChartRows, setDispatchReceiptChartRows] = useState<any[]>([]);
  const [isDispatchReceiptChartLoading, setIsDispatchReceiptChartLoading] = useState(false);
  const [stockUllageChartRows, setStockUllageChartRows] = useState<any[]>([]);
  const [isStockUllageChartLoading, setIsStockUllageChartLoading] = useState(false);
  const [chartTimeFilter, setChartTimeFilter] = useState<string | null | { key: string; cond: string; value: string }>('3M');
  const [focusOutletDispatchKey, setFocusOutletDispatchKey] = useState(0);
  const [locationMountKey, setLocationMountKey] = useState(0);
  const [timeFilterResetToken, setTimeFilterResetToken] = useState(0);
  const [isStockUtilizationSheetOpen, setIsStockUtilizationSheetOpen] = useState(false);
  const previousRefreshTokenRef = React.useRef(refreshToken);
  const previousSelectedLocationRef = React.useRef(selectedLocation);
  const previousSelectedOutletProductsRef = React.useRef(selectedOutletProducts.join(','));
  const DEFAULT_DAILY_TRENDS_DATE = '2026-02-16, 2026-03-16';
  /** Supply Chain Trends card + aligned table: fixed `date_time` for daywise APIs when preset is 3M. */
  const DEFAULT_SUPPLY_CHAIN_TRENDS_3M_DATE_VALUE = '2026-02-05, 2026-03-05';
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
  const kpiCards = [
    {
      title: 'TOTAL CAPACITY',
      value: totalCapacityValue,
      unit: 'KL',
      subColor: 'text-cyan-600',
      accentBorder: 'border-l-cyan-500',
      icon: null,
      sideIcon: Database,
    },
    {
      title: 'TOTAL PRODUCT',
      value: totalProductValue,
      unit: 'KL',
      accentBorder: 'border-l-cyan-400',
      icon: null,
      sideIcon: Box,
    },
 
    {
      title: 'TOTAL ULLAGE ',
      value: totalUllageCapacityValue,
      unit: 'KL',
      subColor: 'text-cyan-600',
      accentBorder: 'border-l-sky-500',
      icon: null,
      sideIcon: Database,
    },
    // {
    //   title: 'DISPATCH QUANTITY',
    //   value: dispatchRateValue,
    //   unit: 'KL/Days',
    //   // subText: '+4.2% VS PREV DAY',
    //   subColor: 'text-emerald-600',
    //   accentBorder: 'border-l-sky-400',
    //   icon: ArrowUp,
    //   sideIcon: Truck,
    // },
    // {
    //   title: 'RECEIPT QUANTITY',
    //   value: receiptRateValue,
    //   unit: 'KL/Days',
    //   // subText: '-1.8% VS PREV DAY',
    //   subColor: 'text-rose-600',
    //   accentBorder: 'border-l-purple-400',
    //   icon: ArrowDown,
    //   sideIcon: Package,
    // },
    {
      title: 'NET STOCK AVAILABILITY',
      value: netStockValue,
      unit: 'KL/Days',
      // subText: '',
      accentBorder: 'border-l-indigo-400',
      icon: null,
      sideIcon: Database,
    },
    {
      title: 'STOCK SUSTAINABILITY',
      value: stockSustainabilityValue,
      unit: 'Days',
      // subText: 'HEALTHY RANGE',
      subColor: 'text-emerald-600',
      accentBorder: 'border-l-emerald-400',
      icon: null,
      sideIcon: Fuel,
    },
   
    {
      title: 'TOTAL RO',
      value: activeOutletsValue,
      unit: activeOutletsUnit,
      // subText: '6 CRITICAL RE-FILLS PENDING',
      subColor: 'text-rose-600',
      accentBorder: 'border-l-rose-400',
      icon: TriangleAlert,
      sideIcon: Activity,
    },
  ];
  const executiveProductWiseChartRows = useMemo(
    () => buildExecutiveProductWiseChartRows(supplyHubProductWiseRows),
    [supplyHubProductWiseRows]
  );
  /** Full `start, end` for product_wise_trends + tank_status (calendar/custom range; else same fixed window as Supply Chain Trends 3M). */
  const supplyHubTankDetailsDateRange = useMemo(() => {
    if (!hasSupplyHubStockTimeFilterOverride) {
      return DEFAULT_SUPPLY_CHAIN_TRENDS_3M_DATE_VALUE;
    }
    const { startDate, endDate } = getDateRangeFromFilter(supplyHubStockTimeFilter);
    return `${startDate}, ${endDate}`;
  }, [supplyHubStockTimeFilter, hasSupplyHubStockTimeFilterOverride]);

  /** Default: first day of fixed supply-hub range for tankwise. After user selects dates: same range string as others. */
  const supplyHubTankwiseDateTimeValue = useMemo(() => {
    if (!hasSupplyHubStockTimeFilterOverride) {
      return DEFAULT_SUPPLY_CHAIN_TRENDS_3M_DATE_VALUE.split(',')[0].trim();
    }
    const { startDate, endDate } = getDateRangeFromFilter(supplyHubStockTimeFilter);
    return `${startDate}, ${endDate}`;
  }, [supplyHubStockTimeFilter, hasSupplyHubStockTimeFilterOverride]);
  const selectedPlantLabel = useMemo(() => {
    if (!selectedLocation || selectedLocation === 'all') return 'All Plants';
    return selectedPlantDisplayName || selectedLocation;
  }, [selectedLocation, selectedPlantDisplayName]);

  /** Resolve Coimbatore `sap_id` before data APIs so payloads include the default plant filter. */
  useEffect(() => {
    let cancelled = false;
    const resolveDefaultPlant = async () => {
      try {
        const response = await apiClient.post('/api/ticketing/get_location_data', {
          bu: ['TAS'],
          zone: [''],
          region: [''],
          sales_area: [''],
          sap_id: [''],
        });
        if (cancelled) return;
        const locations: SupplyChainLocationRow[] = response?.data?.data?.locations ?? [];
        const sapId = findPlantSapIdByName(locations, DEFAULT_SUPPLY_CHAIN_PLANT_NAME);
        if (sapId) {
          defaultPlantSapIdRef.current = sapId;
          setSelectedLocation(sapId);
          setSelectedPlantDisplayName(DEFAULT_SUPPLY_CHAIN_PLANT_NAME);
          localStorage.setItem('sapId', sapId);
        }
      } catch (error) {
        console.error('Failed to resolve default supply chain plant:', error);
      } finally {
        if (!cancelled) setLocationFilterReady(true);
      }
    };
    void resolveDefaultPlant();
    return () => {
      cancelled = true;
    };
  }, []);
  const getProductTheme = (index: number, productName?: string) => {
    const cardThemes = [
      {
        badgeBg: 'bg-orange-500',
        barBg: 'bg-orange-500',
        barLightBg: 'bg-orange-500',
        textColor: 'text-orange-600',
      },
      {
        badgeBg: 'bg-blue-600',
        barBg: 'bg-blue-600',
        barLightBg: 'bg-blue-600',
        textColor: 'text-blue-700',
      },
      {
        badgeBg: 'bg-fuchsia-600',
        barBg: 'bg-fuchsia-600',
        barLightBg: 'bg-fuchsia-600',
        textColor: 'text-fuchsia-700',
      },
      {
        badgeBg: 'bg-emerald-600',
        barBg: 'bg-emerald-600',
        barLightBg: 'bg-emerald-600',
        textColor: 'text-emerald-700',
      },
      {
        badgeBg: 'bg-violet-600',
        barBg: 'bg-violet-600',
        barLightBg: 'bg-violet-600',
        textColor: 'text-violet-700',
      },
      {
        badgeBg: 'bg-rose-600',
        barBg: 'bg-rose-600',
        barLightBg: 'bg-rose-600',
        textColor: 'text-rose-700',
      },
      { badgeBg: 'bg-sky-600', barBg: 'bg-sky-600', barLightBg: 'bg-sky-600', textColor: 'text-sky-700' },
      {
        badgeBg: 'bg-lime-600',
        barBg: 'bg-lime-600',
        barLightBg: 'bg-lime-600',
        textColor: 'text-lime-700',
      },
      {
        badgeBg: 'bg-amber-600',
        barBg: 'bg-amber-600',
        barLightBg: 'bg-amber-600',
        textColor: 'text-amber-700',
      },
      {
        badgeBg: 'bg-cyan-600',
        barBg: 'bg-cyan-600',
        barLightBg: 'bg-cyan-600',
        textColor: 'text-cyan-700',
      },
      {
        badgeBg: 'bg-pink-600',
        barBg: 'bg-pink-600',
        barLightBg: 'bg-pink-600',
        textColor: 'text-pink-700',
      },
      {
        badgeBg: 'bg-indigo-600',
        barBg: 'bg-indigo-600',
        barLightBg: 'bg-indigo-600',
        textColor: 'text-indigo-700',
      },
    ];
    const productKey = String(productName ?? '')
      .trim()
      .toUpperCase();
    const normalizedProductKey = productKey
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Keep DEDA/dead stock variants on the same product color (ATF, BIODIESEL, ETHANOL, HEXANE, etc.).
    const hasDeadOrDedaMarker = /\b(DEDA|DEAD)\b/.test(normalizedProductKey);
    const baseProductKey = normalizedProductKey
      .replace(/\b(DEDA|DEAD)\b/g, '')
      .replace(/\bSTOCK\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const fixedProductThemeMap: Record<string, (typeof cardThemes)[number]> = {
      MS: cardThemes[0],
      HSD: cardThemes[1],
      // Ethanol should be green.
      ETHANOL: {
        badgeBg: 'bg-emerald-600',
        barBg: 'bg-emerald-600',
        barLightBg: 'bg-emerald-600',
        textColor: 'text-emerald-700',
      },
      // Hexane should be purple.
      HEXANE: {
        badgeBg: 'bg-violet-600',
        barBg: 'bg-violet-600',
        barLightBg: 'bg-violet-600',
        textColor: 'text-violet-700',
      },
      // Biodiesel appears light yellow/golden.
      BIODIESEL: {
        badgeBg: 'bg-amber-400',
        barBg: 'bg-amber-400',
        barLightBg: 'bg-amber-400',
        textColor: 'text-amber-700',
      },
      // ATF (Jet Fuel) uses a distinct sky tone for readability.
      ATF: {
        badgeBg: 'bg-sky-500',
        barBg: 'bg-sky-500',
        barLightBg: 'bg-sky-500',
        textColor: 'text-sky-700',
      },
      'ATF (JET FUEL)': {
        badgeBg: 'bg-sky-500',
        barBg: 'bg-sky-500',
        barLightBg: 'bg-sky-500',
        textColor: 'text-sky-700',
      },
      'JET FUEL': {
        badgeBg: 'bg-sky-500',
        barBg: 'bg-sky-500',
        barLightBg: 'bg-sky-500',
        textColor: 'text-sky-700',
      },
    };
    if (normalizedProductKey && fixedProductThemeMap[normalizedProductKey]) {
      return fixedProductThemeMap[normalizedProductKey];
    }
    if (baseProductKey && fixedProductThemeMap[baseProductKey]) {
      const baseTheme = fixedProductThemeMap[baseProductKey];
      if (hasDeadOrDedaMarker) {
        return {
          ...baseTheme,
          // Keep dead/DEDA tank fill in the same solid product shade.
          barLightBg: baseTheme.barBg,
        };
      }
      return baseTheme;
    }
    return cardThemes[index % cardThemes.length];
  };
  const dailyTrendsColumnDefs = useMemo(
    () => [
      {
        headerName: 'Product Category',
        field: 'category',
        minWidth: 220,
        cellRenderer: (params: any) => {
          const row = params.data;
          if (!row) return '-';
          return (
            <div className="text-[13px] font-semibold leading-4 text-gray-900 text-left">
              {row.category}
            </div>
          );
        },
      },
      { headerName: 'SAP ID', field: 'sapId', minWidth: 90 },
      {
        headerName: 'Daily Dispatch Trend',
        field: 'dispatchValue',
        minWidth: 220,
        cellRenderer: (params: any) => {
          const row = params.data;
          if (!row) return '-';
          const dispatchBars = [0.55, 0.72, 0.64, 0.81, 0.9, 0.76].map((factor) =>
            Math.max(8, Math.min(100, Math.round(row.dispatchPercent * factor)))
          );
          return (
            <div className="flex items-center gap-4 py-1">
              {/* <div className="flex h-10 items-end gap-1">
                {dispatchBars.map((bar: number, idx: number) => (
                  <span
                    key={`dispatch-${row.category}-${idx}`}
                    className="w-2 rounded-sm bg-sky-500"
                    style={{ height: `${bar}%` }}
                  />
                ))}
              </div> */}
              <span className="text-[13px] font-normal text-gray-700">{row.dispatchValue}</span>
            </div>
          );
        },
      },
      {
        headerName: 'Daily Receipt Trend',
        field: 'receiptValue',
        minWidth: 220,
        cellRenderer: (params: any) => {
          const row = params.data;
          if (!row) return '-';
          const receiptBars = [0.58, 0.5, 0.7, 0.62, 0.82, 0.56].map((factor) =>
            Math.max(8, Math.min(100, Math.round(row.receiptPercent * factor)))
          );
          return (
            <div className="flex items-center gap-4 py-1">
              {/* <div className="flex h-10 items-end gap-1">
                {receiptBars.map((bar: number, idx: number) => (
                  <span
                    key={`receipt-${row.category}-${idx}`}
                    className="w-2 rounded-sm bg-emerald-500"
                    style={{ height: `${bar}%` }}
                  />
                ))}
              </div> */}
              <span className="text-[13px] font-normal text-gray-700">{row.receiptValue}</span>
            </div>
          );
        },
      },
      {
        headerName: 'BCU Dispatch',
        field: 'bcuDispatch',
        minWidth: 130,
        cellStyle: { textAlign: 'right' },
      },
      {
        headerName: 'Difference',
        field: 'difference',
        minWidth: 120,
        cellStyle: { textAlign: 'right' },
      },
    ],
    []
  );
  const productWiseColumnDefs = useMemo(
    () => [
      {
        headerName: 'Product',
        field: 'productName',
        minWidth: 100,
        pinned: 'left',
        lockPinned: true,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        cellRenderer: (params: any) => (
          <div className="w-full text-center text-[13px] font-semibold leading-4 text-gray-900">
            {params.value ?? '-'}
          </div>
        ),
      },
      // { headerName: 'SAP ID', field: 'sapId', minWidth: 55 },
      {
        headerName: 'Ullage',
        field: 'ullage',
        minWidth: 96,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        headerComponent: ProductInsightSortableHeader,
        headerComponentParams: { tooltipText: 'As on Date' },
      },
      {
        headerName: 'Available Stock',
        field: 'availableStock',
        minWidth: 96,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        headerComponent: ProductInsightSortableHeader,
        headerComponentParams: { tooltipText: 'As on Date' },
      },
      {
        headerName: 'Product Dispatch',
        field: 'tankDispatch',
        minWidth: 96,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        headerComponent: ProductInsightSortableHeader,
        headerComponentParams: { tooltipText: 'As on Date' },
      },
      {
        headerName: 'Product Receipt',
        field: 'tankReceipt',
        minWidth: 96,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        headerComponent: ProductInsightSortableHeader,
        headerComponentParams: { tooltipText: 'As on Date' },
      },
      {
        headerName: '7 Day Avg',
        field: 'sevenDayAvg',
        minWidth: 96,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        headerComponent: ProductInsightSortableHeader,
        headerComponentParams: { tooltipText: 'Last 7 days sales Avg (excluding current day)' },
      },
      {
        headerName: 'Net Stock',
        field: 'netStock',
        minWidth: 96,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        headerComponent: ProductInsightSortableHeader,
        headerComponentParams: {
          tooltipText: 'Available Stock + Product Receipt - Product Dispatch',
        },
      },
      {
        headerName: 'Stock Sustainability\n(in days)',
        field: 'stockSustainability',
        minWidth: 110,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        headerComponent: ProductInsightSortableHeader,
        headerComponentParams: { tooltipText: 'Estimated stock sustainability in days' },
      },
      {
        headerName: 'Dead Stock',
        field: 'deadStock',
        minWidth: 96,
        headerClass: 'product-insight-child-header',
        cellStyle: { textAlign: 'center' },
        headerComponent: ProductInsightSortableHeader,
        headerComponentParams: { tooltipText: 'As on Date' },
      },
    ],
    []
  );
  const pendingRecordsColumnDefs = useMemo(
    () => [
      {
        headerName: 'Zone',
        field: 'zone',
        minWidth: 90,
        pinned: 'left',
        lockPinned: true,
      },
      {
        headerName: 'Terminal Plant ID',
        field: 'terminalPlantId',
        minWidth: 124,
        pinned: 'left',
        lockPinned: true,
        wrapHeaderText: true,
      },
      {
        headerName: 'RO SAP Code',
        field: 'roSapCode',
        minWidth: 100,
        pinned: 'left',
        lockPinned: true,
        wrapHeaderText: true,
      },
      { headerName: 'Status', field: 'status', minWidth: 100, pinned: 'left', lockPinned: true },
      {
        headerName: 'HSD',
        children: [
          { headerName: 'Stock Coverage(days)', field: 'HSD', minWidth: 130 },
          { headerName: 'Total Capacity', field: 'HSDTotalCapacity', minWidth: 130 },
          { headerName: 'Available Ullage', field: 'HSDAvailableUllage', minWidth: 130 },
          { headerName: 'Available Stock', field: 'HSDAvailableStock', minWidth: 130 },
          { headerName: 'HSD Status', field: 'HSDStatus', minWidth: 130 },
        ],
      },
      {
        headerName: 'MS',
        children: [
          { headerName: 'Stock Coverage(days)', field: 'MS', minWidth: 130 },
          { headerName: 'Total Capacity', field: 'MSTotalCapacity', minWidth: 130 },
          { headerName: 'Available Ullage', field: 'MSAvailableUllage', minWidth: 130 },
          { headerName: 'Available Stock', field: 'MSAvailableStock', minWidth: 130 },
          { headerName: 'MS Status', field: 'MSStatus', minWidth: 130 },
        ],
      },
      {
        headerName: 'POWER 95',
        children: [
          { headerName: 'Stock Coverage(days)', field: 'POWER95', minWidth: 130 },
          { headerName: 'Total Capacity', field: 'POWER95TotalCapacity', minWidth: 130 },
          { headerName: 'Available Ullage', field: 'POWER95AvailableUllage', minWidth: 130 },
          { headerName: 'Available Stock', field: 'POWER95AvailableStock', minWidth: 130 },
          { headerName: 'POWER 95 Status', field: 'POWER95Status', minWidth: 130 },
        ],
      },
      {
        headerName: 'POWER 99',
        children: [
          { headerName: 'Stock Coverage(days)', field: 'POWER99', minWidth: 130 },
          { headerName: 'Total Capacity', field: 'POWER99TotalCapacity', minWidth: 130 },
          { headerName: 'Available Ullage', field: 'POWER99AvailableUllage', minWidth: 130 },
          { headerName: 'Available Stock', field: 'POWER99AvailableStock', minWidth: 130 },
          { headerName: 'POWER 99 Status', field: 'POWER99Status', minWidth: 130 },
        ],
      },
      {
        headerName: 'POWER 100',
        children: [
          { headerName: 'Stock Coverage(days)', field: 'POWER100', minWidth: 130 },
          { headerName: 'POWER 100 Status', field: 'POWER100Status', minWidth: 130 },
        ],
      },
      {
        headerName: 'TURBO',
        children: [
          { headerName: 'Stock Coverage(days)', field: 'TURBO', minWidth: 130 },
          { headerName: 'Total Capacity', field: 'TURBOTotalCapacity', minWidth: 130 },
          { headerName: 'Available Ullage', field: 'TURBOAvailableUllage', minWidth: 130 },
          { headerName: 'Available Stock', field: 'TURBOAvailableStock', minWidth: 130 },
          { headerName: 'TURBO Status', field: 'TURBOStatus', minWidth: 130 },
        ],
      },
    ],
    []
  );
  useEffect(() => {
    if (outletDispatchStatusFilter === 'active') {
      setOutletDispatchRows(outletDispatchInStockRows);
      return;
    }
    if (outletDispatchStatusFilter === 'inactive') {
      setOutletDispatchRows(outletDispatchOutOfStockRows);
      return;
    }
    if (outletDispatchStatusFilter === 'mixed') {
      setOutletDispatchRows(outletDispatchMixedRows);
      return;
    }
    if (outletDispatchStatusFilter === 'all') {
      setOutletDispatchRows(outletDispatchAllRows);
      return;
    }
    if (['MS', 'POWER 95', 'POWER 99', 'HSD', 'TURBO'].includes(outletDispatchStatusFilter)) {
      // Product dropdown values are already applied at API payload level.
      setOutletDispatchRows(outletDispatchAllRows);
      return;
    }

    const filteredRows = outletDispatchAllRows.filter((row) => {
      const rowStatus = String(row?.status ?? '').toLowerCase();
      return rowStatus.includes(outletDispatchStatusFilter.toLowerCase());
    });
    setOutletDispatchRows(filteredRows);
  }, [outletDispatchStatusFilter, outletDispatchAllRows, outletDispatchInStockRows, outletDispatchOutOfStockRows, outletDispatchMixedRows]);
  useEffect(() => {
    if (!locationFilterReady) return;
    let isCurrentRequest = true;
    const currentSelectedProductsKey = selectedOutletProducts.join(',');
    const didRefreshTokenChange = previousRefreshTokenRef.current !== refreshToken;
    const didSelectedLocationChange = previousSelectedLocationRef.current !== selectedLocation;
    const didSelectedProductsChange = previousSelectedOutletProductsRef.current !== currentSelectedProductsKey;
    const shouldRefreshOnlyOutletDispatchRecords =
      didSelectedProductsChange && !didRefreshTokenChange && !didSelectedLocationChange;

    previousRefreshTokenRef.current = refreshToken;
    previousSelectedLocationRef.current = selectedLocation;
    previousSelectedOutletProductsRef.current = currentSelectedProductsKey;
    const deepCollect = (obj: any, matcher: (key: string) => boolean): any[] => {
      const results: any[] = [];
      const visit = (value: any) => {
        if (value == null) return;
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (typeof value === 'object') {
          for (const [key, nestedValue] of Object.entries(value)) {
            if (matcher(key)) {
              results.push(nestedValue);
            }
            visit(nestedValue);
          }
        }
      };
      visit(obj);
      return results;
    };

    const firstNumericFromCandidates = (...candidates: any[]): number | null => {
      const parseToNumber = (value: any): number | null => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const normalized = value.replace(/,/g, '').trim();
          if (!normalized) return null;
          const parsed = Number(normalized);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      };

      for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
          for (const item of candidate) {
            const nested = firstNumericFromCandidates(item);
            if (nested !== null) return nested;
          }
          continue;
        }
        if (candidate != null && typeof candidate === 'object') {
          if ('value' in candidate) {
            const nestedValue = firstNumericFromCandidates((candidate as any).value);
            if (nestedValue !== null) return nestedValue;
          }
          for (const value of Object.values(candidate)) {
            const nested = firstNumericFromCandidates(value);
            if (nested !== null) return nested;
          }
          continue;
        }
        const parsed = parseToNumber(candidate);
        if (parsed !== null) return parsed;
      }
      return null;
    };

    const isDispatchRowCandidate = (value: any): boolean => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const keys = Object.keys(value).map((k) => k.toLowerCase());
      return keys.some((k) =>
        [
          'terminal_plant_id',
          'terminalplantid',
          'rosapcode',
          'ro_sap_code',
          'rosapcode',
          'product_qty',
          'productqty',
          'qty',
          'quantity',
          'ms',
          'status',
          'stock_status',
        ].includes(k)
      );
    };

    const collectDispatchRowsDeep = (obj: any): any[] => {
      const rows: any[] = [];
      const visit = (value: any) => {
        if (value == null) return;
        if (Array.isArray(value)) {
          if (value.length > 0 && value.every((item) => isDispatchRowCandidate(item))) {
            rows.push(...value);
            return;
          }
          value.forEach(visit);
          return;
        }
        if (typeof value === 'object') {
          for (const nestedValue of Object.values(value)) {
            visit(nestedValue);
          }
        }
      };
      visit(obj);
      return rows;
    };
    const extractActiveOutletCounts = (
      responseData: any
    ): { active: number | null; total: number | null; inactive: number | null; mixed: number | null } => {
      const activeLikeKeys = deepCollect(responseData, (key) => {
        const k = key.toLowerCase();
        return (k.includes('active') || k === 'ro_count') && (k.includes('ro') || k.includes('outlet') || k.includes('count'));
      });
      const totalLikeKeys = deepCollect(responseData, (key) => {
        const k = key.toLowerCase();
        return k.includes('total') && (k.includes('ro') || k.includes('outlet') || k.includes('count'));
      });
      const inactiveLikeKeys = deepCollect(responseData, (key) => {
        const k = key.toLowerCase();
        return k.includes('inactive') && (k.includes('ro') || k.includes('outlet') || k.includes('count'));
      });
      const mixedLikeKeys = deepCollect(responseData, (key) => {
        const k = key.toLowerCase();
        return k.includes('mixed') && (k.includes('ro') || k.includes('outlet') || k.includes('count'));
      });

      const active = firstNumericFromCandidates(
        responseData?.active_ro,
        responseData?.ro_count,
        responseData?.active_outlets,
        responseData?.active_outlet_count,
        responseData?.data?.active_ro,
        responseData?.data?.ro_count,
        responseData?.data?.active_outlets,
        responseData?.data?.active_outlet_count,
        responseData?.payload?.active_ro,
        responseData?.payload?.ro_count,
        responseData?.payload?.active_outlets,
        responseData?.payload?.active_outlet_count,
        responseData?.data?.value,
        responseData?.payload?.value,
        activeLikeKeys
      );

      const total = firstNumericFromCandidates(
        responseData?.total_ro,
        responseData?.total_outlets,
        responseData?.total_outlet_count,
        responseData?.outlet_count,
        responseData?.data?.total_ro,
        responseData?.data?.total_outlets,
        responseData?.data?.total_outlet_count,
        responseData?.data?.outlet_count,
        responseData?.payload?.total_ro,
        responseData?.payload?.total_outlets,
        responseData?.payload?.total_outlet_count,
        responseData?.payload?.outlet_count,
        totalLikeKeys
      );

      const inactive = firstNumericFromCandidates(
        responseData?.inactive_ro,
        responseData?.data?.inactive_ro,
        responseData?.payload?.inactive_ro,
        inactiveLikeKeys
      );
      const mixed = firstNumericFromCandidates(
        responseData?.mixed_ro,
        responseData?.data?.mixed_ro,
        responseData?.payload?.mixed_ro,
        mixedLikeKeys
      );

      return { active, total, inactive, mixed };
    };

    const extractMetricValue = (
      responseData: any,
      metric: 'dispatch' | 'receipt' | 'net_stock' | 'stock_sustainability'
    ): number | null => {
      const candidates = [
        metric === 'dispatch'
          ? responseData?.total_dispatch
          : metric === 'receipt'
            ? responseData?.total_receipt
            : metric === 'net_stock'
              ? responseData?.net_stock
              : responseData?.stock_sustainability,
        metric === 'dispatch'
          ? responseData?.data?.total_dispatch
          : metric === 'receipt'
            ? responseData?.data?.total_receipt
            : metric === 'net_stock'
              ? responseData?.data?.net_stock
              : responseData?.data?.stock_sustainability,
        metric === 'dispatch'
          ? responseData?.payload?.total_dispatch
          : metric === 'receipt'
            ? responseData?.payload?.total_receipt
            : metric === 'net_stock'
              ? responseData?.payload?.net_stock
              : responseData?.payload?.stock_sustainability,
        responseData?.data?.value,
        responseData?.payload?.value,
      ];

      for (const candidate of candidates) {
        const numericCandidate = Number(candidate);
        if (Number.isFinite(numericCandidate)) return numericCandidate;
      }

      const deepSearch = (obj: any): number | null => {
        if (obj == null) return null;
        if (typeof obj === 'number' && Number.isFinite(obj)) return obj;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const found = deepSearch(item);
            if (found !== null) return found;
          }
          return null;
        }
        if (typeof obj === 'object') {
          for (const [key, value] of Object.entries(obj)) {
            if (key.toLowerCase().includes(metric)) {
              const maybe = Number(value);
              if (Number.isFinite(maybe)) return maybe;
            }
            const found = deepSearch(value);
            if (found !== null) return found;
          }
        }
        return null;
      };

      return deepSearch(responseData);
    };

    const fetchDispatchRate = async () => {
      try {
        if (shouldRefreshOnlyOutletDispatchRecords) {
          setIsOutletDispatchLoading(true);
          setIsOutletDispatchRoCountLoading(true);
        } else {
          setIsRefreshing(true);
          setDispatchRateValue('--');
          setReceiptRateValue('--');
          setNetStockValue('--');
          setStockSustainabilityValue('--');
          setTotalProductValue('--');
          setTotalCapacityValue('--');
          setTotalUllageCapacityValue('--');
          setActiveOutletsValue('0');
          setActiveOutletsUnit('');
          setActiveRoValue('0');
          setInactiveRoValue('0');
          setMixedRoValue('0');
          setOutletDispatchTotalRoValue('0');
          setOutletDispatchActiveRoValue('0');
          setOutletDispatchInactiveRoValue('0');
          setOutletDispatchMixedRoValue('0');
          setOutletDispatchChartTotalRoValue('0');
          setOutletDispatchChartActiveRoValue('0');
          setOutletDispatchChartInactiveRoValue('0');
          setOutletDispatchChartMixedRoValue('0');
          setOutletDispatchAllRows([]);
          setOutletDispatchInStockRows([]);
          setOutletDispatchOutOfStockRows([]);
          setOutletDispatchRows([]);
          setZoneWiseStackedBarRows([]);
          setIsTotalRoLoading(true);
          setIsOutletDispatchLoading(true);
          setIsOutletDispatchRoCountLoading(true);
          setIsOutletDispatchChartRoCountLoading(true);
          setIsZoneWiseCountLoading(true);
        }
        const selectedProductGroupValue = selectedOutletProducts.length > 0
          ? selectedOutletProducts.join(', ')
          : PRODUCT_GROUP_OPTIONS.join(', ');
        const locationCrossFilters = [
          ...(selectedZone && selectedZone !== 'all'
            ? [
                {
                  key: 'zone',
                  cond: 'equals',
                  value: selectedZone,
                  values: [],
                },
              ]
            : []),
          ...(selectedLocation !== 'all'
            ? [
                {
                  key: 'sap_id',
                  cond: 'equals',
                  value: selectedLocation,
                  values: [],
                },
              ]
            : []),
        ];
        const activeOutletPayload = {
          filters: [],
          drill_state: '',
          cross_filters: locationCrossFilters,
          action: 'ro_count',
        };
        const outletDispatchPayload = {
          filters: [
            {
              key: 'product_grp',
              cond: 'equals',
              value: selectedProductGroupValue,
            },
          ],
          drill_state: '',
          cross_filters: locationCrossFilters,
          action: 'ro_details',
        };
        const outletDispatchRoCountPayload = {
          filters: [
            {
              key: 'product_grp',
              cond: 'equals',
              value: selectedProductGroupValue,
            },
          ],
          drill_state: '',
          cross_filters: locationCrossFilters,
          action: 'ro_count',
        };
        const zoneWiseCountCrossFilters =
          selectedZone && selectedZone !== 'all'
            ? [
                {
                  key: 'zone',
                  cond: 'equals',
                  value: selectedZone,
                  values: [],
                },
              ]
            : [];
        const zoneWiseCountPayload = {
          filters: [],
          drill_state: '',
          cross_filters: zoneWiseCountCrossFilters,
          action: 'zone_wise_count',
        };

        if (!shouldRefreshOnlyOutletDispatchRecords) {
          void apiClient
            .post('/api/nozzle_sales_stock/product_availability_days', zoneWiseCountPayload)
            .then((zoneWiseResponse) => {
              if (!isCurrentRequest) return;
              console.info('[TASSupplyChain][zone_wise_count] payload', zoneWiseCountPayload);
              console.info('[TASSupplyChain][zone_wise_count] response', zoneWiseResponse?.data ?? zoneWiseResponse);
              setZoneWiseStackedBarRows(
                extractZoneWiseStackedBarRows(zoneWiseResponse?.data ?? zoneWiseResponse, selectedZone)
              );
            })
            .catch((zoneWiseError) => {
              if (!isCurrentRequest) return;
              console.error('Failed to fetch ZONE WISE COUNT:', zoneWiseError);
              setZoneWiseStackedBarRows([]);
            })
            .finally(() => {
              if (!isCurrentRequest) return;
              setIsZoneWiseCountLoading(false);
            });
        }

        if (!shouldRefreshOnlyOutletDispatchRecords) {
          void apiClient
            .post('/api/nozzle_sales_stock/product_availability_days', activeOutletPayload)
            .then((activeOutletsResponse) => {
              if (!isCurrentRequest) return;
              console.info('[TASSupplyChain][ro_count] payload', activeOutletPayload);
              console.info('[TASSupplyChain][ro_count] response', activeOutletsResponse?.data ?? activeOutletsResponse);
              const activeOutletMetrics = extractActiveOutletCounts(activeOutletsResponse?.data ?? activeOutletsResponse);
              if (activeOutletMetrics.active !== null) {
                setActiveRoValue(Math.round(activeOutletMetrics.active).toLocaleString('en-IN'));
              } else {
                setActiveRoValue('0');
              }
              if (activeOutletMetrics.total !== null) {
                setActiveOutletsValue(Math.round(activeOutletMetrics.total).toLocaleString('en-IN'));
                setActiveOutletsUnit('');
              } else {
                setActiveOutletsValue('0');
                setActiveOutletsUnit('');
              }
              if (activeOutletMetrics.inactive !== null) {
                setInactiveRoValue(Math.round(activeOutletMetrics.inactive).toLocaleString('en-IN'));
              } else {
                setInactiveRoValue('0');
              }
              if (activeOutletMetrics.mixed !== null) {
                setMixedRoValue(Math.round(activeOutletMetrics.mixed).toLocaleString('en-IN'));
              } else {
                setMixedRoValue('0');
              }
            })
            .catch((activeOutletsError) => {
              if (!isCurrentRequest) return;
              console.error('Failed to fetch ACTIVE OUTLETS:', activeOutletsError);
              setActiveOutletsValue('0');
              setActiveOutletsUnit('');
              setActiveRoValue('0');
              setInactiveRoValue('0');
              setMixedRoValue('0');
            })
            .finally(() => {
              if (!isCurrentRequest) return;
              setIsTotalRoLoading(false);
            });
        }
  
        void apiClient
          .post('/api/nozzle_sales_stock/product_availability_days', outletDispatchPayload)
          .then((outletDispatchResponse) => {
            if (!isCurrentRequest) return;
            console.info('[TASSupplyChain][ro_details] payload', outletDispatchPayload);
            console.info('[TASSupplyChain][ro_details] response', outletDispatchResponse?.data ?? outletDispatchResponse);
            const responsePayload =
              outletDispatchResponse?.data?.data ??
              outletDispatchResponse?.data?.payload ??
              outletDispatchResponse?.data ??
              outletDispatchResponse;
            const outletDispatchRaw =
              responsePayload?.data ??
              responsePayload?.payload?.data ??
              responsePayload?.payload ??
              outletDispatchResponse?.data?.data ??
              outletDispatchResponse?.data?.payload?.data ??
              outletDispatchResponse?.data?.payload ??
              outletDispatchResponse?.data ??
              outletDispatchResponse;
            const fullDetails = pickFirstArray(
              outletDispatchRaw?.full_details,
              outletDispatchRaw?.fullDetails,
              outletDispatchRaw?.ro_details,
              outletDispatchRaw?.rows,
              responsePayload?.full_details,
              responsePayload?.fullDetails,
              responsePayload?.ro_details,
              responsePayload?.rows,
              Array.isArray(outletDispatchRaw) ? outletDispatchRaw : null,
              Array.isArray(responsePayload) ? responsePayload : null
            );
            const deepRows = collectDispatchRowsDeep(outletDispatchRaw);
            const inStock = pickFirstArray(
              outletDispatchRaw?.in_stock,
              outletDispatchRaw?.inStock,
              outletDispatchRaw?.active,
              responsePayload?.in_stock,
              responsePayload?.inStock,
              responsePayload?.active
            );
            const outOfStock = pickFirstArray(
              outletDispatchRaw?.out_of_stock,
              outletDispatchRaw?.outOfStock,
              outletDispatchRaw?.inactive,
              responsePayload?.out_of_stock,
              responsePayload?.outOfStock,
              responsePayload?.inactive
            );
            const mixedRows = pickFirstArray(
              outletDispatchRaw?.mixed_ro,
              outletDispatchRaw?.mixedRo,
              outletDispatchRaw?.mixed,
              responsePayload?.mixed_ro,
              responsePayload?.mixedRo,
              responsePayload?.mixed
            );
            const mapOutletRows = (list: any[]) =>
              list.map((item: any) => {
                const numOrZero = (value: any) => {
                  if (value === null || value === undefined || value === '') return 0;
                  const numeric = Number(value);
                  return Number.isFinite(numeric) ? numeric : 0;
                };

                return {
                  zone: String(item?.zone ?? item?.Zone ?? item?.ZONE ?? item?.sales_zone ?? item?.salesZone ?? '-'),
                  terminalPlantId: String(
                    item?.terminal_plant_id ?? item?.terminalPlantId ?? item?.terminal_plant ?? item?.terminal ?? '-'
                  ),
                  roSapCode: String(
                    item?.sap_id ??
                      item?.sapId ??
                      item?.rosapcode ??
                      item?.ro_sap_code ??
                      item?.roSapCode ??
                      item?.sap_code ??
                      '-'
                  ),
                  status: String(
                    item?.status ??
                      item?.stock_status ??
                      item?.availability_status ??
                      item?.product_status ??
                      '-'
                  ),
                  HSD: Number(item?.HSD ?? item?.hsd ?? 0) || 0,
                  HSDTotalCapacity: numOrZero(item?.HSD_total_capacity ?? item?.hsd_total_capacity ?? item?.HSDTotalCapacity),
                  HSDAvailableUllage: numOrZero(
                    item?.HSD_available_ullage ?? item?.hsd_available_ullage ?? item?.HSDAvailableUllage
                  ),
                  HSDAvailableStock: numOrZero(
                    item?.HSD_available_stock ?? item?.hsd_available_stock ?? item?.HSDAvailableStock
                  ),
                  HSDStatus: String(item?.HSD_status ?? item?.hsd_status ?? item?.HSDStatus ?? item?.hsdStatus ?? '-'),
                  MS: Number(item?.MS ?? item?.ms ?? 0) || 0,
                  MSTotalCapacity: numOrZero(item?.MS_total_capacity ?? item?.ms_total_capacity ?? item?.MSTotalCapacity),
                  MSAvailableUllage: numOrZero(
                    item?.MS_available_ullage ?? item?.ms_available_ullage ?? item?.MSAvailableUllage
                  ),
                  MSAvailableStock: numOrZero(item?.MS_available_stock ?? item?.ms_available_stock ?? item?.MSAvailableStock),
                  MSStatus: String(item?.MS_status ?? item?.ms_status ?? item?.MSStatus ?? item?.msStatus ?? '-'),
                  POWER95:
                    Number(
                      item?.['POWER 95'] ??
                        item?.POWER95 ??
                        item?.power95 ??
                        item?.power_95 ??
                        0
                    ) || 0,
                  POWER95TotalCapacity: numOrZero(
                    item?.['POWER 95_total_capacity'] ??
                      item?.POWER95_total_capacity ??
                      item?.power95_total_capacity ??
                      item?.power_95_total_capacity ??
                      item?.POWER95TotalCapacity
                  ),
                  POWER95AvailableUllage: numOrZero(
                    item?.['POWER 95_available_ullage'] ??
                      item?.POWER95_available_ullage ??
                      item?.power95_available_ullage ??
                      item?.power_95_available_ullage ??
                      item?.POWER95AvailableUllage
                  ),
                  POWER95AvailableStock: numOrZero(
                    item?.['POWER 95_available_stock'] ??
                      item?.POWER95_available_stock ??
                      item?.power95_available_stock ??
                      item?.power_95_available_stock ??
                      item?.POWER95AvailableStock
                  ),
                  POWER95Status: String(
                    item?.['POWER 95_status'] ??
                      item?.POWER95_status ??
                      item?.power95_status ??
                      item?.power_95_status ??
                      item?.POWER95Status ??
                      item?.power95Status ??
                      '-'
                  ),
                  POWER99:
                    Number(
                      item?.['POWER 99'] ??
                        item?.POWER99 ??
                        item?.power99 ??
                        item?.power_99 ??
                        0
                    ) || 0,
                  POWER99TotalCapacity: numOrZero(
                    item?.['POWER 99_total_capacity'] ??
                      item?.POWER99_total_capacity ??
                      item?.power99_total_capacity ??
                      item?.power_99_total_capacity ??
                      item?.POWER99TotalCapacity
                  ),
                  POWER99AvailableUllage: numOrZero(
                    item?.['POWER 99_available_ullage'] ??
                      item?.POWER99_available_ullage ??
                      item?.power99_available_ullage ??
                      item?.power_99_available_ullage ??
                      item?.POWER99AvailableUllage
                  ),
                  POWER99AvailableStock: numOrZero(
                    item?.['POWER 99_available_stock'] ??
                      item?.POWER99_available_stock ??
                      item?.power99_available_stock ??
                      item?.power_99_available_stock ??
                      item?.POWER99AvailableStock
                  ),
                  POWER99Status: String(
                    item?.['POWER 99_status'] ??
                      item?.POWER99_status ??
                      item?.power99_status ??
                      item?.power_99_status ??
                      item?.POWER99Status ??
                      item?.power99Status ??
                      '-'
                  ),
                  POWER100:
                    Number(
                      item?.['POWER 100'] ??
                        item?.POWER100 ??
                        item?.power100 ??
                        item?.power_100 ??
                        0
                    ) || 0,
                  POWER100Status: String(
                    item?.['POWER 100_status'] ??
                      item?.POWER100_status ??
                      item?.power100_status ??
                      item?.power_100_status ??
                      item?.POWER100Status ??
                      item?.power100Status ??
                      '-'
                  ),
                  TURBO: Number(item?.TURBO ?? item?.turbo ?? 0) || 0,
                  TURBOTotalCapacity: numOrZero(
                    item?.TURBO_total_capacity ?? item?.turbo_total_capacity ?? item?.TURBOTotalCapacity
                  ),
                  TURBOAvailableUllage: numOrZero(
                    item?.TURBO_available_ullage ?? item?.turbo_available_ullage ?? item?.TURBOAvailableUllage
                  ),
                  TURBOAvailableStock: numOrZero(
                    item?.TURBO_available_stock ?? item?.turbo_available_stock ?? item?.TURBOAvailableStock
                  ),
                  TURBOStatus: String(item?.TURBO_status ?? item?.turbo_status ?? item?.TURBOStatus ?? item?.turboStatus ?? '-'),
                };
              });
            const mappedFullRows = mapOutletRows(fullDetails);
            const mappedDeepRows = mapOutletRows(deepRows);
            const mappedInStockRows = mapOutletRows(inStock);
            const mappedOutOfStockRows = mapOutletRows(outOfStock);
            const mappedMixedRows = mapOutletRows(mixedRows);

            setOutletDispatchAllRows(mappedFullRows.length > 0 ? mappedFullRows : mappedDeepRows);
            setOutletDispatchInStockRows(mappedInStockRows);
            setOutletDispatchOutOfStockRows(mappedOutOfStockRows);
            setOutletDispatchMixedRows(mappedMixedRows);

            // Keep active/inactive tabs usable even when API omits split buckets.
            const baseRowsForFallback = mappedFullRows.length > 0 ? mappedFullRows : mappedDeepRows;
            if (mappedInStockRows.length === 0 && mappedOutOfStockRows.length === 0 && baseRowsForFallback.length > 0) {
              const inStockFallback = baseRowsForFallback.filter((row) => {
                const status = row.status.toLowerCase();
                return status.includes('active') || status.includes('in stock') || status.includes('instock');
              });
              const outOfStockFallback = baseRowsForFallback.filter((row) => {
                const status = row.status.toLowerCase();
                return status.includes('inactive') || status.includes('out of stock') || status.includes('oos');
              });
              if (inStockFallback.length > 0) setOutletDispatchInStockRows(inStockFallback);
              if (outOfStockFallback.length > 0) setOutletDispatchOutOfStockRows(outOfStockFallback);
            }
          })
          .catch((outletDispatchError) => {
            if (!isCurrentRequest) return;
            console.error('Failed to fetch OUTLET DISPATCH RECORDS:', outletDispatchError);
            setOutletDispatchAllRows([]);
            setOutletDispatchInStockRows([]);
            setOutletDispatchOutOfStockRows([]);
            setOutletDispatchMixedRows([]);
            setOutletDispatchRows([]);
          })
          .finally(() => {
            if (!isCurrentRequest) return;
            setIsOutletDispatchLoading(false);
          });
        void apiClient
          .post('/api/nozzle_sales_stock/product_availability_days', outletDispatchRoCountPayload)
          .then((outletDispatchRoCountResponse) => {
            if (!isCurrentRequest) return;
            const outletDispatchMetrics = extractActiveOutletCounts(
              outletDispatchRoCountResponse?.data ?? outletDispatchRoCountResponse
            );
            setOutletDispatchActiveRoValue(
              outletDispatchMetrics.active !== null ? Math.round(outletDispatchMetrics.active).toLocaleString('en-IN') : '0'
            );
            setOutletDispatchTotalRoValue(
              outletDispatchMetrics.total !== null ? Math.round(outletDispatchMetrics.total).toLocaleString('en-IN') : '0'
            );
            setOutletDispatchInactiveRoValue(
              outletDispatchMetrics.inactive !== null
                ? Math.round(outletDispatchMetrics.inactive).toLocaleString('en-IN')
                : '0'
            );
            setOutletDispatchMixedRoValue(
              outletDispatchMetrics.mixed !== null ? Math.round(outletDispatchMetrics.mixed).toLocaleString('en-IN') : '0'
            );
            if (!shouldRefreshOnlyOutletDispatchRecords) {
              setOutletDispatchChartActiveRoValue(
                outletDispatchMetrics.active !== null ? Math.round(outletDispatchMetrics.active).toLocaleString('en-IN') : '0'
              );
              setOutletDispatchChartTotalRoValue(
                outletDispatchMetrics.total !== null ? Math.round(outletDispatchMetrics.total).toLocaleString('en-IN') : '0'
              );
              setOutletDispatchChartInactiveRoValue(
                outletDispatchMetrics.inactive !== null
                  ? Math.round(outletDispatchMetrics.inactive).toLocaleString('en-IN')
                  : '0'
              );
              setOutletDispatchChartMixedRoValue(
                outletDispatchMetrics.mixed !== null ? Math.round(outletDispatchMetrics.mixed).toLocaleString('en-IN') : '0'
              );
            }
          })
          .catch((outletDispatchRoCountError) => {
            if (!isCurrentRequest) return;
            console.error('Failed to fetch OUTLET DISPATCH RO COUNT:', outletDispatchRoCountError);
            setOutletDispatchTotalRoValue('0');
            setOutletDispatchActiveRoValue('0');
            setOutletDispatchInactiveRoValue('0');
            setOutletDispatchMixedRoValue('0');
            if (!shouldRefreshOnlyOutletDispatchRecords) {
              setOutletDispatchChartTotalRoValue('0');
              setOutletDispatchChartActiveRoValue('0');
              setOutletDispatchChartInactiveRoValue('0');
              setOutletDispatchChartMixedRoValue('0');
            }
          })
          .finally(() => {
            if (!isCurrentRequest) return;
            setIsOutletDispatchRoCountLoading(false);
            if (!shouldRefreshOnlyOutletDispatchRecords) {
              setIsOutletDispatchChartRoCountLoading(false);
            }
          });

        if (shouldRefreshOnlyOutletDispatchRecords) return;

        // KPI cards APIs intentionally disabled as requested.
        // const settledResponses = await Promise.allSettled([
        //   apiClient.post('/api/tankdetails/get_tank_details', {
        //     ...payloadWithLocationFilters,
        //     action: 'total_dispatch',
        //   }),
        //   apiClient.post('/api/tankdetails/get_tank_details', {
        //     ...payloadWithLocationFilters,
        //     action: 'total_receipt',
        //   }),
        //   apiClient.post('/api/tankdetails/get_tank_details', {
        //     ...payloadWithLocationFilters,
        //     action: 'net_stock',
        //   }),
        //   apiClient.post('/api/tankdetails/get_tank_details', {
        //     ...payloadWithLocationFilters,
        //     action: 'stock_sustainability',
        //   }),
        //   apiClient.post('/api/tankdetails/get_tank_details', {
        //     ...payloadWithLocationFilters,
        //     action: 'total_product',
        //   }),
        //   apiClient.post('/api/tankdetails/get_tank_details', {
        //     ...payloadWithLocationFilters,
        //     action: 'product_wise_trends',
        //   }),
        //   apiClient.post('/api/tankdetails/get_tank_details', {
        //     ...payloadWithLocationFilters,
        //     action: 'total_capacity',
        //   }),
        //   apiClient.post('/api/tankdetails/get_tank_details', {
        //     ...payloadWithLocationFilters,
        //     action: 'total_ullage',
        //   }),
        // ]);
        // const getSettledData = (index: number) => {
        //   const response = settledResponses[index];
        //   if (response?.status === 'fulfilled') return response.value?.data;
        //   console.error(`KPI API failed at index ${index}:`, response?.reason);
        //   return null;
        // };
        const dispatchData = null;
        const receiptData = null;
        const netStockData = null;
        const stockSustainabilityData = null;
        const totalProductData = null;
        const totalCapacityData = null;
        const totalUllageCapacityData = null;

        const dispatchValue = extractMetricValue(dispatchData, 'dispatch');
        const receiptValue = extractMetricValue(receiptData, 'receipt');
        const netStockMetricValue = extractMetricValue(netStockData, 'net_stock');
        const stockSustainabilityMetricValue = extractMetricValue(stockSustainabilityData, 'stock_sustainability');
        const totalProductCandidates = [
          totalProductData?.data,
          totalProductData?.total_product,
          totalProductData?.data?.total_product,
          totalProductData?.payload?.total_product,
          totalProductData?.data?.value,
          totalProductData?.payload?.value,
        ];
        let totalProductMetricValue: number | null = null;
        for (const candidate of totalProductCandidates) {
          const numericCandidate = Number(candidate);
          if (Number.isFinite(numericCandidate)) {
            totalProductMetricValue = numericCandidate;
            break;
          }
        }
        const totalCapacityCandidates = [
          totalCapacityData?.data,
          totalCapacityData?.total_capacity,
          totalCapacityData?.data?.total_capacity,
          totalCapacityData?.payload?.total_capacity,
          totalCapacityData?.data?.value,
          totalCapacityData?.payload?.value,
        ];
        let totalCapacityMetricValue: number | null = null;
        for (const candidate of totalCapacityCandidates) {
          const numericCandidate = Number(candidate);
          if (Number.isFinite(numericCandidate)) {
            totalCapacityMetricValue = numericCandidate;
            break;
          }
        }
        const totalUllageCapacityCandidates = [
          totalUllageCapacityData?.data,
          totalUllageCapacityData?.tank_ullage,
          totalUllageCapacityData?.data?.tank_ullage,
          totalUllageCapacityData?.payload?.tank_ullage,
          totalUllageCapacityData?.total_ullage,
          totalUllageCapacityData?.data?.total_ullage,
          totalUllageCapacityData?.payload?.total_ullage,
          totalUllageCapacityData?.ullage,
          totalUllageCapacityData?.data?.ullage,
          totalUllageCapacityData?.payload?.ullage,
          totalUllageCapacityData?.data?.value,
          totalUllageCapacityData?.payload?.value,
        ];
        let totalUllageCapacityMetricValue: number | null = null;
        for (const candidate of totalUllageCapacityCandidates) {
          const numericCandidate = Number(candidate);
          if (Number.isFinite(numericCandidate)) {
            totalUllageCapacityMetricValue = numericCandidate;
            break;
          }
        }

        if (dispatchValue !== null) {
          if (!isCurrentRequest) return;
          setDispatchRateValue(Math.round(dispatchValue).toLocaleString('en-IN'));
        } else {
          if (!isCurrentRequest) return;
          setDispatchRateValue('0');
        }
        if (receiptValue !== null) {
          if (!isCurrentRequest) return;
          setReceiptRateValue(Math.round(receiptValue).toLocaleString('en-IN'));
        } else {
          if (!isCurrentRequest) return;
          setReceiptRateValue('0');
        }
        if (netStockMetricValue !== null) {
          if (!isCurrentRequest) return;
          setNetStockValue(Math.round(netStockMetricValue).toLocaleString('en-IN'));
        } else {
          if (!isCurrentRequest) return;
          setNetStockValue('0');
        }
        if (stockSustainabilityMetricValue !== null) {
          if (!isCurrentRequest) return;
          setStockSustainabilityValue(Number(stockSustainabilityMetricValue).toFixed(1));
        } else {
          if (!isCurrentRequest) return;
          setStockSustainabilityValue('0');
        }
        if (totalProductMetricValue !== null) {
          if (!isCurrentRequest) return;
          setTotalProductValue(Math.round(totalProductMetricValue).toLocaleString('en-IN'));
        } else {
          if (!isCurrentRequest) return;
          setTotalProductValue('0');
        }
        if (totalCapacityMetricValue !== null) {
          if (!isCurrentRequest) return;
          setTotalCapacityValue(Math.round(totalCapacityMetricValue).toLocaleString('en-IN'));
        } else {
          if (!isCurrentRequest) return;
          setTotalCapacityValue('0');
        }
        if (totalUllageCapacityMetricValue !== null) {
          if (!isCurrentRequest) return;
          setTotalUllageCapacityValue(Math.round(totalUllageCapacityMetricValue).toLocaleString('en-IN'));
        } else {
          if (!isCurrentRequest) return;
          setTotalUllageCapacityValue('0');
        }

      } catch (error) {
        if (!isCurrentRequest) return;
        console.error('Failed to fetch KPI values:', error);
        setDispatchRateValue('0');
        setReceiptRateValue('0');
        setNetStockValue('0');
        setStockSustainabilityValue('0');
        setTotalProductValue('0');
        setTotalCapacityValue('0');
        setTotalUllageCapacityValue('0');
        setOutletDispatchAllRows([]);
        setOutletDispatchInStockRows([]);
        setOutletDispatchOutOfStockRows([]);
        setOutletDispatchRows([]);
        setOutletDispatchTotalRoValue('0');
        setOutletDispatchActiveRoValue('0');
        setOutletDispatchInactiveRoValue('0');
        setOutletDispatchMixedRoValue('0');
        setIsOutletDispatchRoCountLoading(false);
      } finally {
        if (!isCurrentRequest) return;
        if (!shouldRefreshOnlyOutletDispatchRecords) {
          setIsRefreshing(false);
        }
      }
    };

    void fetchDispatchRate();
    return () => {
      isCurrentRequest = false;
    };
  }, [
    refreshToken,
    selectedZone,
    selectedLocation,
    locationFilterReady,
    selectedOutletProducts,
    PRODUCT_GROUP_OPTIONS,
  ]);

  useEffect(() => {
    if (!locationFilterReady) return;
    let cancelled = false;
    const fetchProductInsight = async () => {
      try {
        setIsProductInsightFetching(true);
        const { startDate, endDate } = getDateRangeFromFilter(productInsightTimeFilter);
        const productWiseDateTimeValue = hasProductInsightTimeFilterOverride
          ? `${startDate}, ${endDate}`
          : DEFAULT_DAILY_TRENDS_DATE;
        const productWisePayloadBase = {
          filters: [
            {
              key: 'date_time',
              cond: 'equals',
              value: productWiseDateTimeValue,
              val: '',
            },
          ],
          drill_state: '',
          cross_filters: [],
          limit: 0,
          payload: {},
        };
        const payloadWithLocationFilters = {
          ...productWisePayloadBase,
          filters: [
            ...productWisePayloadBase.filters,
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
          ],
        };
        const productWiseResponse = await apiClient.post('/api/tankdetails/get_tank_details', {
          ...payloadWithLocationFilters,
          action: 'product_wise_trends',
        });
        if (cancelled) return;
        const rows = mapProductWiseResponseToRows(productWiseResponse?.data ?? null);
        setProductWiseRows(rows);
      } catch (productWiseError) {
        if (!cancelled) {
          console.error('Failed to fetch PRODUCT WISE:', productWiseError);
          setProductWiseRows([]);
        }
      } finally {
        if (!cancelled) {
          setIsProductInsightFetching(false);
        }
      }
    };

    void fetchProductInsight();
    return () => {
      cancelled = true;
    };
  }, [
    productInsightTimeFilter,
    hasProductInsightTimeFilterOverride,
    refreshToken,
    selectedZone,
    selectedLocation,
    locationFilterReady,
  ]);

  /** MS/HSD total capacity & ullage + Stock Utilization: product_wise_trends with this section’s own date filter (not Product Insight / charts). */
  useEffect(() => {
    if (!locationFilterReady) return;
    let cancelled = false;
    const fetchSupplyHubProductWiseTrends = async () => {
      try {
        setIsSupplyHubProductWiseLoading(true);
        const productWisePayloadBase = {
          filters: [
            {
              key: 'date_time',
              cond: 'equals',
              value: supplyHubTankDetailsDateRange,
              val: '',
            },
          ],
          drill_state: '',
          cross_filters: [],
          limit: 0,
          payload: {},
        };
        const payloadWithLocationFilters = {
          ...productWisePayloadBase,
          filters: [
            ...productWisePayloadBase.filters,
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
          ],
        };
        const productWiseResponse = await apiClient.post('/api/tankdetails/get_tank_details', {
          ...payloadWithLocationFilters,
          action: 'product_wise_trends',
        });
        if (cancelled) return;
        const rows = mapProductWiseResponseToRows(productWiseResponse?.data ?? null);
        setSupplyHubProductWiseRows(rows);
      } catch (hubError) {
        if (!cancelled) {
          console.error('Failed to fetch supply hub product_wise_trends:', hubError);
          setSupplyHubProductWiseRows([]);
        }
      } finally {
        if (!cancelled) {
          setIsSupplyHubProductWiseLoading(false);
        }
      }
    };

    void fetchSupplyHubProductWiseTrends();
    return () => {
      cancelled = true;
    };
  }, [refreshToken, selectedZone, selectedLocation, locationFilterReady, supplyHubTankDetailsDateRange]);

  useEffect(() => {
    if (!locationFilterReady) return;
    const fetchDailyTrends = async () => {
      try {
        setIsDailyTrendsLoading(true);
        const { startDate, endDate } = getDateRangeFromFilter(summaryTimeFilter);
        const dailyTrendsDateValue = hasSummaryTimeFilterOverride
          ? `${startDate}, ${endDate}`
          : DEFAULT_DAILY_TRENDS_DATE;
        const payload = {
          filters: [
            {
              key: 'date_time',
              cond: 'equals',
              value: dailyTrendsDateValue,
              val: '',
            },
          ],
          drill_state: '',
          cross_filters: [],
          limit: 0,
          payload: {},
        };
        const payloadWithLocationFilters = {
          ...payload,
          filters: [
            ...payload.filters,
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
          ],
        };

        const dailyTrendsResponse = await apiClient.post('/api/tankdetails/get_tank_details', {
          ...payloadWithLocationFilters,
          action: 'daily_trends',
        });
        const dailyTrendsData = dailyTrendsResponse?.data;
        const trendsRaw =
          dailyTrendsData?.data ??
          dailyTrendsData?.payload?.data ??
          dailyTrendsData?.payload ??
          dailyTrendsData;
        const trendsList = Array.isArray(trendsRaw)
          ? trendsRaw
          : Array.isArray(trendsRaw?.rows)
            ? trendsRaw.rows
            : [];
        if (trendsList.length > 0) {
          const accents = ['bg-sky-400', 'bg-emerald-400', 'bg-cyan-400', 'bg-slate-400', 'bg-rose-400'];
          const toNum = (val: any) => {
            const n = Number(val);
            return Number.isFinite(n) ? n : 0;
          };
          const maxDispatch = Math.max(
            ...trendsList.map((item: any) => toNum(item?.tank_dispatch ?? item?.dispatch ?? item?.dispatch_value ?? item?.total_dispatch)),
            1
          );
          const maxReceipt = Math.max(
            ...trendsList.map((item: any) => toNum(item?.tank_receipt ?? item?.receipt ?? item?.receipt_value ?? item?.total_receipt)),
            1
          );
          const mappedRows = trendsList.map((item: any, index: number) => {
            const category = String(
              item?.category ??
                item?.product_category ??
                item?.product ??
                item?.product_name ??
                item?.name ??
                `ROW ${index + 1}`
            );
            const fullName = String(item?.full_name ?? item?.fullName ?? item?.description ?? category);
            const dispatch = toNum(
              item?.tank_dispatch ?? item?.dispatch ?? item?.dispatch_value ?? item?.total_dispatch
            );
            const receipt = toNum(
              item?.tank_receipt ?? item?.receipt ?? item?.receipt_value ?? item?.total_receipt
            );
            const averageRaw = toNum(item?.difference ?? item?.average ?? item?.avg_daily ?? item?.avg ?? (dispatch + receipt) / 2);
            const dispatchPercent = Math.max(0, Math.min(100, (dispatch / maxDispatch) * 100));
            const receiptPercent = Math.max(0, Math.min(100, (receipt / maxReceipt) * 100));
            return {
              category,
              fullName,
              sapId: String(item?.sap_id ?? ''),
              bcuDispatch: Math.round(toNum(item?.bcu_dispatch)).toLocaleString('en-IN'),
              difference: Math.round(toNum(item?.difference)).toLocaleString('en-IN'),
              dispatchValue: Math.round(dispatch).toLocaleString('en-IN'),
              receiptValue: Math.round(receipt).toLocaleString('en-IN'),
              average: Math.round(averageRaw).toLocaleString('en-IN'),
              dispatchPercent,
              receiptPercent,
              accent: accents[index % accents.length],
            };
          });
          setDailyTrendsRows(mappedRows);
        } else {
          setDailyTrendsRows([]);
        }
      } catch (dailyTrendsError) {
        console.error('Failed to fetch DAILY TRENDS:', dailyTrendsError);
        setDailyTrendsRows([]);
      } finally {
        setIsDailyTrendsLoading(false);
      }
    };

    void fetchDailyTrends();
  }, [summaryTimeFilter, hasSummaryTimeFilterOverride, refreshToken, selectedZone, selectedLocation, locationFilterReady]);

  useEffect(() => {
    if (!locationFilterReady) return;
    let isCurrentRequest = true;
    const extractRows = (response: any) => {
      const rawRows =
        response?.data?.data ??
        response?.data?.payload?.data ??
        response?.data?.payload ??
        response?.data;
      return Array.isArray(rawRows) ? rawRows : Array.isArray(rawRows?.rows) ? rawRows.rows : [];
    };

    const fetchDispatchReceiptDayWiseChart = async () => {
      try {
        setIsDispatchReceiptChartLoading(true);
        const { startDate, endDate } = getDateRangeFromFilter(chartTimeFilter);
        const chartDateValue = !chartTimeFilter
          ? DEFAULT_DAILY_TRENDS_DATE
          : chartTimeFilter === '3M'
            ? DEFAULT_SUPPLY_CHAIN_TRENDS_3M_DATE_VALUE
            : `${startDate}, ${endDate}`;
        const filters = [
          {
            key: 'date_time',
            cond: 'equals',
            value: chartDateValue,
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

        // Keep a separate API call for Dispatch/Receipt while using the same daywise trends contract.
        // const response = await apiClient.post('/api/tankdetails/get_tank_details', {
        //   filters,
        //   action: 'daywise_stock_ullage_trends',
        //   drill_state: '',
        //   cross_filters: [],
        //   limit: 0,
        //   payload: {},
        // });
        const response = { data: [] };

        if (!isCurrentRequest) return;
        let rows = extractRows(response);
        // Backward compatibility for environments where dedicated action is not available.
        if (rows.length === 0) {
          const fallbackResponse = await apiClient.post('/api/tankdetails/get_tank_details', {
            filters,
            action: 'daywise_trends',
            drill_state: '',
            cross_filters: [],
            limit: 0,
            payload: {},
          });
          if (!isCurrentRequest) return;
          rows = extractRows(fallbackResponse);
        }
        setDispatchReceiptChartRows(rows);
      } catch (error) {
        if (!isCurrentRequest) return;
        console.error('Failed to fetch Dispatch/Receipt chart trends:', error);
        setDispatchReceiptChartRows([]);
      } finally {
        if (!isCurrentRequest) return;
        setIsDispatchReceiptChartLoading(false);
      }
    };

    const fetchStockUllageDayWiseChart = async () => {
      try {
        setIsStockUllageChartLoading(true);
        const { startDate, endDate } = getDateRangeFromFilter(chartTimeFilter);
        const chartDateValue = !chartTimeFilter
          ? DEFAULT_DAILY_TRENDS_DATE
          : chartTimeFilter === '3M'
            ? DEFAULT_SUPPLY_CHAIN_TRENDS_3M_DATE_VALUE
            : `${startDate}, ${endDate}`;
        const filters = [
          {
            key: 'date_time',
            cond: 'equals',
            value: chartDateValue,
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

        // Prefer dedicated stock/ullage daywise action when backend provides it.
        // const dedicatedResponse = await apiClient.post('/api/tankdetails/get_tank_details', {
        //   filters,
        //   action: 'daywise_stock_ullage_trends',
        //   drill_state: '',
        //   cross_filters: [],
        //   limit: 0,
        //   payload: {},
        // });
        const dedicatedResponse = { data: [] };
        if (!isCurrentRequest) return;
        let rows = extractRows(dedicatedResponse);

        // Fallback to generic daywise trends action for older backend contracts.
        if (rows.length === 0) {
          const fallbackResponse = await apiClient.post('/api/tankdetails/get_tank_details', {
            filters,
            action: 'daywise_trends',
            drill_state: '',
            cross_filters: [],
            limit: 0,
            payload: {},
          });
          if (!isCurrentRequest) return;
          rows = extractRows(fallbackResponse);
        }

        setStockUllageChartRows(rows);
      } catch (error) {
        if (!isCurrentRequest) return;
        console.error('Failed to fetch Stock/Ullage chart trends:', error);
        setStockUllageChartRows([]);
      } finally {
        if (!isCurrentRequest) return;
        setIsStockUllageChartLoading(false);
      }
    };

    void Promise.all([fetchDispatchReceiptDayWiseChart(), fetchStockUllageDayWiseChart()]);

    return () => {
      isCurrentRequest = false;
    };
  }, [refreshToken, selectedZone, selectedLocation, locationFilterReady, chartTimeFilter, DEFAULT_DAILY_TRENDS_DATE]);

  const handleSummaryTimeFilterChange = (value: string | null | { key: string; cond: string; value: string }) => {
    setSummaryTimeFilter(value);
    setHasSummaryTimeFilterOverride(true);
  };

  const handleProductInsightTimeFilterChange = (value: string | null | { key: string; cond: string; value: string }) => {
    setProductInsightTimeFilter(value);
    setHasProductInsightTimeFilterOverride(true);
  };

  const handleSupplyHubStockTimeFilterChange = (
    value: string | null | { key: string; cond: string; value: string }
  ) => {
    setSupplyHubStockTimeFilter(value);
    setHasSupplyHubStockTimeFilterOverride(true);
  };

  return (
    <div className="flex w-full min-w-0 flex-col rounded-lg bg-white shadow-md">
      <style>{`
        .tas-grid-scroll .ag-center-cols-viewport,
        .tas-grid-scroll .ag-body-horizontal-scroll-viewport,
        .tas-grid-scroll .ag-body-vertical-scroll-viewport {
          scrollbar-width: auto !important;
          scrollbar-color: #94a3b8 #e5e7eb !important;
        }
        .tas-grid-scroll .ag-center-cols-viewport::-webkit-scrollbar,
        .tas-grid-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
        .tas-grid-scroll .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .tas-grid-scroll .ag-center-cols-viewport::-webkit-scrollbar-track,
        .tas-grid-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
        .tas-grid-scroll .ag-body-vertical-scroll-viewport::-webkit-scrollbar-track {
          background: #e5e7eb;
        }
        .tas-grid-scroll .ag-center-cols-viewport::-webkit-scrollbar-thumb,
        .tas-grid-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
        .tas-grid-scroll .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 8px;
        }
        .tas-grid-scroll .ag-body-vertical-scroll {
          min-width: 10px;
          width: 10px !important;
        }
      `}</style>
      <div className="w-full min-w-0 space-y-1 p-1">
      <TASSupplyChainOverview
        kpiCards={kpiCards}
        productWiseRows={productWiseRows}
        locationMountKey={locationMountKey}
        setSelectedZone={setSelectedZone}
        setSelectedLocation={setSelectedLocation}
        setSummaryTimeFilter={setSummaryTimeFilter}
        setHasSummaryTimeFilterOverride={setHasSummaryTimeFilterOverride}
        setProductInsightTimeFilter={setProductInsightTimeFilter}
        setHasProductInsightTimeFilterOverride={setHasProductInsightTimeFilterOverride}
        supplyHubStockTimeFilter={supplyHubStockTimeFilter}
        setSupplyHubStockTimeFilter={setSupplyHubStockTimeFilter}
        setHasSupplyHubStockTimeFilterOverride={setHasSupplyHubStockTimeFilterOverride}
        onSupplyHubStockTimeFilterChange={handleSupplyHubStockTimeFilterChange}
        supplyHubTankDetailsDateRange={supplyHubTankDetailsDateRange}
        supplyHubTankwiseDateTimeValue={supplyHubTankwiseDateTimeValue}
        setTimeFilterResetToken={setTimeFilterResetToken}
        setOutletDispatchStatusFilter={setOutletDispatchStatusFilter}
        outletDispatchChartFilter={outletDispatchChartFilter}
        setOutletDispatchChartFilter={setOutletDispatchChartFilter}
        outletDispatchTotalRoValue={outletDispatchChartTotalRoValue}
        outletDispatchActiveRoValue={outletDispatchChartActiveRoValue}
        outletDispatchMixedRoValue={outletDispatchChartMixedRoValue}
        outletDispatchInactiveRoValue={outletDispatchChartInactiveRoValue}
        isOutletDispatchRoCountLoading={isOutletDispatchChartRoCountLoading}
        zoneWiseStackedBarRows={zoneWiseStackedBarRows}
        isZoneWiseCountLoading={isZoneWiseCountLoading}
        setLocationMountKey={setLocationMountKey}
        setRefreshToken={setRefreshToken}
        selectedZone={selectedZone}
        selectedLocation={selectedLocation}
        refreshToken={refreshToken}
        isRefreshing={isRefreshing}
        isSupplyHubStockMetricsLoading={isSupplyHubProductWiseLoading}
        isTotalRoLoading={isTotalRoLoading}
        activeRoValue={activeRoValue}
        mixedRoValue={mixedRoValue}
        inactiveRoValue={inactiveRoValue}
        executiveProductWiseChartRows={executiveProductWiseChartRows}
        getProductTheme={getProductTheme}
        dispatchReceiptDayWiseRows={dispatchReceiptChartRows}
        isDispatchReceiptDayWiseLoading={isDispatchReceiptChartLoading}
        stockUllageDayWiseRows={stockUllageChartRows}
        isStockUllageDayWiseLoading={isStockUllageChartLoading}
        chartTimeFilter={chartTimeFilter}
        onChartTimeFilterChange={setChartTimeFilter}
        timeFilterResetToken={timeFilterResetToken}
        defaultPlantName={DEFAULT_SUPPLY_CHAIN_PLANT_NAME}
        onPlantDisplayNameChange={setSelectedPlantDisplayName}
        onLocationFilterReady={() => setLocationFilterReady(true)}
      />
      
      <TASSupplyChainTables
        refreshToken={refreshToken}
        selectedZone={selectedZone}
        selectedLocation={selectedLocation}
        isRefreshing={isRefreshing}
        productWiseRows={productWiseRows}
        dailyTrendsRows={dailyTrendsRows}
        outletDispatchRows={outletDispatchRows}
        summaryTimeFilter={summaryTimeFilter}
        onSummaryTimeFilterChange={handleSummaryTimeFilterChange}
        productInsightTimeFilter={productInsightTimeFilter}
        onProductInsightTimeFilterChange={handleProductInsightTimeFilterChange}
        timeFilterResetToken={timeFilterResetToken}
        outletDispatchFilter={outletDispatchStatusFilter}
        onOutletDispatchFilterChange={setOutletDispatchStatusFilter}
        selectedOutletProducts={selectedOutletProducts}
        onSelectedOutletProductsChange={setSelectedOutletProducts}
        isOutletDispatchLoading={isOutletDispatchLoading}
        isOutletDispatchRoCountLoading={isOutletDispatchRoCountLoading}
        isDailyTrendsLoading={isDailyTrendsLoading}
        focusOutletDispatchKey={focusOutletDispatchKey}
        outletDispatchTotalRoValue={outletDispatchTotalRoValue}
        outletDispatchActiveRoValue={outletDispatchActiveRoValue}
        outletDispatchInactiveRoValue={outletDispatchInactiveRoValue}
        outletDispatchMixedRoValue={outletDispatchMixedRoValue}
        isProductInsightLoading={isProductInsightFetching}
        productWiseColumnDefs={productWiseColumnDefs}
        dailyTrendsColumnDefs={dailyTrendsColumnDefs}
        pendingRecordsColumnDefs={pendingRecordsColumnDefs}
        executiveProductWiseChartRows={executiveProductWiseChartRows}
        getProductTheme={getProductTheme}
        isSupplyHubStockMetricsLoading={isSupplyHubProductWiseLoading}
        selectedPlantLabel={selectedPlantLabel}
        isStockUtilizationSheetOpen={isStockUtilizationSheetOpen}
        setIsStockUtilizationSheetOpen={setIsStockUtilizationSheetOpen}
      />
      </div>
    </div>
  );
}
