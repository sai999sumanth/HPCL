
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/@/components/ui/card';
import { Button } from '@/@/components/ui/button';
import { CustomMultiSelect } from '@/@/components/ui/custom-multiselect';
import { Droplets, Fuel, RefreshCw } from 'lucide-react';
import ZonePlantSelections from '@/pages/component/RetailOutletHome/ZonePlantSelections';
import EnhancedTimeFilter from '@/pages/component/Governance/filters/TimeFilterButtons';
import TASSupplyChainDaywiseAm3BarChart from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainDaywiseAm3BarChart';
import TASSupplyChainDaywiseDispatchReceiptTable from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainDaywiseDispatchReceiptTable';
import TASSupplyChainDaywiseStockUllageLineChart from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainDaywiseStockUllageLineChart';
import TASSupplyChainDaywiseStockUllageTable from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainDaywiseStockUllageTable';
import TASSupplyChainTopCards from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainTopCards';
import TASSupplyChainOutletDispatchSummaryCards from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainOutletDispatchSummaryCards';
import TASSupplyChainZoneWiseCountChart from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChainZoneWiseCountChart';

const DEFAULT_TOP_CARD_PRODUCT_IDS = ['MS', 'HSD', 'ATF', 'BD'] as const;

const MAX_TOP_CARD_PRODUCT_SELECTION = 4;

const TOP_CARD_PRODUCT_PRIORITY = [
  'MS',
  'HSD',
  'ATF',
  'BD',
  'BIODIESEL',
  'ETHANOL',
  'ETH',
  'TURBO',
  'POWER 95',
  'POWER 99',
  'POWER 100',
];

function canonicalTopCardProductKey(id: string): string {
  const key = id.trim().toUpperCase();
  if (key === 'BD' || key === 'BIODIESEL') return 'BIODIESEL';
  if (key === 'ETHANOL' || key === 'ETH') return 'ETH';
  return key;
}

function displayTopCardProductLabel(id: string): string {
  const key = id.trim().toUpperCase();
  if (key === 'BIODIESEL') return 'BD';
  if (key === 'ETHANOL' || key === 'ETH') return 'ETH';
  return key;
}

function rankTopCardProductId(id: string): number {
  const raw = id.trim().toUpperCase();
  const canonical = canonicalTopCardProductKey(id);
  let idx = TOP_CARD_PRODUCT_PRIORITY.indexOf(raw);
  if (idx === -1) idx = TOP_CARD_PRODUCT_PRIORITY.indexOf(canonical);
  if (idx === -1 && canonical === 'ETH') {
    const ethanolIndex = TOP_CARD_PRODUCT_PRIORITY.indexOf('ETHANOL');
    const ethIndex = TOP_CARD_PRODUCT_PRIORITY.indexOf('ETH');
    const candidates = [ethanolIndex, ethIndex].filter((value) => value !== -1);
    idx = candidates.length ? Math.min(...candidates) : -1;
  }
  return idx === -1 ? 999 : idx;
}

function sortTopCardProductIds(ids: string[]) {
  return [...ids].sort((leftId, rightId) => {
    const rankDiff = rankTopCardProductId(leftId) - rankTopCardProductId(rightId);
    if (rankDiff !== 0) return rankDiff;
    return leftId.localeCompare(rightId);
  });
}

function capTopCardProductSelection(ids: string[]) {
  let resolved = [...ids];
  while (resolved.length > MAX_TOP_CARD_PRODUCT_SELECTION) {
    const biodieselIndex = resolved.findIndex((id) => canonicalTopCardProductKey(id) === 'BIODIESEL');
    if (biodieselIndex !== -1) {
      resolved = resolved.filter((_, index) => index !== biodieselIndex);
      continue;
    }
    const ranked = sortTopCardProductIds(resolved);
    resolved = ranked.slice(0, ranked.length - 1);
  }
  return sortTopCardProductIds(resolved);
}

type KpiCard = {
  title: string;
  value: string;
  unit: string;
  subColor?: string;
  accentBorder: string;
  icon: React.ComponentType<{ className?: string }> | null;
  sideIcon: React.ComponentType<{ className?: string }>;
};

type ExecutiveRow = {
  productName: string;
  availableStock: number;
  deadStock: number;
  capacity: number;
  ullage: number;
  availablePercent: number;
  deadPercent: number;
};

type ProductTheme = {
  badgeBg: string;
  barBg: string;
  barLightBg: string;
  textColor: string;
};

type Props = {
  kpiCards: KpiCard[];
  productWiseRows: Array<{
    productName: string;
    tankDispatch: string;
    tankReceipt: string;
  }>;
  locationMountKey: number;
  setSelectedZone: React.Dispatch<React.SetStateAction<string>>;
  setSelectedLocation: React.Dispatch<React.SetStateAction<string>>;
  setSummaryTimeFilter: React.Dispatch<React.SetStateAction<string | null | { key: string; cond: string; value: string }>>;
  setHasSummaryTimeFilterOverride: React.Dispatch<React.SetStateAction<boolean>>;
  setProductInsightTimeFilter: React.Dispatch<
    React.SetStateAction<string | null | { key: string; cond: string; value: string }>
  >;
  setHasProductInsightTimeFilterOverride: React.Dispatch<React.SetStateAction<boolean>>;
  supplyHubStockTimeFilter: string | null | { key: string; cond: string; value: string };
  setSupplyHubStockTimeFilter: React.Dispatch<
    React.SetStateAction<string | null | { key: string; cond: string; value: string }>
  >;
  setHasSupplyHubStockTimeFilterOverride: React.Dispatch<React.SetStateAction<boolean>>;
  onSupplyHubStockTimeFilterChange: (value: string | null | { key: string; cond: string; value: string }) => void;
  /** Default fixed span or calendar selection — supply-hub `product_wise_trends` + product card `tank_status`. */
  supplyHubTankDetailsDateRange: string;
  /** Default start day of that span for `tankwise_sustainability`; full range when user picks dates. */
  supplyHubTankwiseDateTimeValue: string;
  setTimeFilterResetToken: React.Dispatch<React.SetStateAction<number>>;
  setOutletDispatchStatusFilter: React.Dispatch<
    React.SetStateAction<'all' | 'active' | 'inactive' | 'mixed' | 'MS' | 'POWER 95' | 'POWER 99' | 'HSD' | 'TURBO'>
  >;
  outletDispatchChartFilter: 'all' | 'active' | 'inactive' | 'mixed';
  setOutletDispatchChartFilter: React.Dispatch<
    React.SetStateAction<'all' | 'active' | 'inactive' | 'mixed'>
  >;
  outletDispatchTotalRoValue: string;
  outletDispatchActiveRoValue: string;
  outletDispatchMixedRoValue: string;
  outletDispatchInactiveRoValue: string;
  isOutletDispatchRoCountLoading: boolean;
  zoneWiseStackedBarRows: Array<{ zone: string; active: number; mixed: number; inactive: number }>;
  isZoneWiseCountLoading: boolean;
  setLocationMountKey: React.Dispatch<React.SetStateAction<number>>;
  setRefreshToken: React.Dispatch<React.SetStateAction<number>>;
  selectedZone: string;
  selectedLocation: string;
  refreshToken: number;
  isRefreshing: boolean;
  /** Loading supply-hub product_wise_trends (MS/HSD capacity/ullage + Stock Utilization), separate from Product Insight. */
  isSupplyHubStockMetricsLoading: boolean;
  isTotalRoLoading: boolean;
  activeRoValue: string;
  mixedRoValue: string;
  inactiveRoValue: string;
  executiveProductWiseChartRows: ExecutiveRow[];
  getProductTheme: (index: number, productName?: string) => ProductTheme;
  dispatchReceiptDayWiseRows: any[];
  isDispatchReceiptDayWiseLoading: boolean;
  stockUllageDayWiseRows: any[];
  isStockUllageDayWiseLoading: boolean;
  chartTimeFilter: string | null | { key: string; cond: string; value: string };
  onChartTimeFilterChange: (value: string | null | { key: string; cond: string; value: string }) => void;
  timeFilterResetToken: number;
  defaultPlantName?: string;
  onPlantDisplayNameChange?: (plantName: string | null) => void;
  onLocationFilterReady?: () => void;
};

export default function TASSupplyChainOverview({
  kpiCards,
  productWiseRows,
  locationMountKey,
  setSelectedZone,
  setSelectedLocation,
  setSummaryTimeFilter,
  setHasSummaryTimeFilterOverride,
  setProductInsightTimeFilter,
  setHasProductInsightTimeFilterOverride,
  supplyHubStockTimeFilter,
  setSupplyHubStockTimeFilter,
  setHasSupplyHubStockTimeFilterOverride,
  onSupplyHubStockTimeFilterChange,
  supplyHubTankDetailsDateRange,
  supplyHubTankwiseDateTimeValue,
  setTimeFilterResetToken,
  setOutletDispatchStatusFilter,
  outletDispatchChartFilter,
  setOutletDispatchChartFilter,
  outletDispatchTotalRoValue,
  outletDispatchActiveRoValue,
  outletDispatchMixedRoValue,
  outletDispatchInactiveRoValue,
  isOutletDispatchRoCountLoading,
  zoneWiseStackedBarRows,
  isZoneWiseCountLoading,
  setLocationMountKey,
  setRefreshToken,
  selectedZone,
  selectedLocation,
  refreshToken,
  isRefreshing,
  isSupplyHubStockMetricsLoading,
  isTotalRoLoading,
  activeRoValue,
  mixedRoValue,
  inactiveRoValue,
  executiveProductWiseChartRows,
  getProductTheme,
  dispatchReceiptDayWiseRows,
  isDispatchReceiptDayWiseLoading,
  stockUllageDayWiseRows,
  isStockUllageDayWiseLoading,
  chartTimeFilter,
  onChartTimeFilterChange,
  timeFilterResetToken,
  defaultPlantName,
  onPlantDisplayNameChange,
  onLocationFilterReady,
}: Props) {
  const normalizeProductKey = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const key = raw.toUpperCase();
    if (key === 'BIODIESEL' || key === 'BD') return 'BD';
    if (key === 'ETHANOL' || key === 'ETH') return 'ETH';
    return key;
  };
  const [selectedTopCardProductIds, setSelectedTopCardProductIds] = useState<string[]>(() => [
    ...DEFAULT_TOP_CARD_PRODUCT_IDS,
  ]);
  const [selectedDispatchReceiptProduct, setSelectedDispatchReceiptProduct] = useState('');
  const [selectedStockUllageProduct, setSelectedStockUllageProduct] = useState('');
  const [dispatchReceiptTrendView, setDispatchReceiptTrendView] = useState<'line' | 'table'>('line');
  const [stockUllageTrendView, setStockUllageTrendView] = useState<'line' | 'table'>('line');
  const orderedProductWiseRows = useMemo(() => {
    const prioritizedProductOrder = ['MS', 'HSD', 'ATF', 'ETH', 'BD'];
    const getProductPriority = (productName: string) => {
      const normalizedProductName = normalizeProductKey(productName);
      const priorityIndex = prioritizedProductOrder.indexOf(normalizedProductName);
      return priorityIndex === -1 ? Number.POSITIVE_INFINITY : priorityIndex;
    };

    return [...productWiseRows].sort((leftRow, rightRow) => {
      const priorityDiff = getProductPriority(leftRow.productName) - getProductPriority(rightRow.productName);
      if (priorityDiff !== 0) return priorityDiff;
      return leftRow.productName.localeCompare(rightRow.productName);
    });
  }, [productWiseRows]);
  const orderedExecutiveProductWiseChartRows = useMemo(() => {
    const prioritizedProductOrder = ['MS', 'HSD', 'ATF', 'ETHANOL'];
    const getProductPriority = (productName: string) => {
      const normalizedProductName = productName.trim().toUpperCase();
      const priorityIndex = prioritizedProductOrder.indexOf(normalizedProductName);
      return priorityIndex === -1 ? Number.POSITIVE_INFINITY : priorityIndex;
    };

    return [...executiveProductWiseChartRows].sort((leftRow, rightRow) => {
      const priorityDiff = getProductPriority(leftRow.productName) - getProductPriority(rightRow.productName);
      if (priorityDiff !== 0) return priorityDiff;
      return leftRow.productName.localeCompare(rightRow.productName);
    });
  }, [executiveProductWiseChartRows]);
  const topCardProductsFromResponse = useMemo(() => {
    const seenCanonical = new Set<string>();
    const labels: string[] = [];

    executiveProductWiseChartRows.forEach((row) => {
      const productName = String(row?.productName ?? '').trim();
      if (!productName) return;

      const canonicalProduct = canonicalTopCardProductKey(productName);
      if (seenCanonical.has(canonicalProduct)) return;

      seenCanonical.add(canonicalProduct);
      labels.push(productName);
    });

    return labels.sort((leftProduct, rightProduct) => {
      const rankDiff = rankTopCardProductId(leftProduct) - rankTopCardProductId(rightProduct);
      if (rankDiff !== 0) return rankDiff;
      return leftProduct.localeCompare(rightProduct);
    });
  }, [executiveProductWiseChartRows]);
  const topCardProductOptions = useMemo(() => {
    const seenCanonical = new Set<string>();
    const options: { id: string; name: string }[] = [];
    const pushOption = (rawId: string) => {
      const canonicalProduct = canonicalTopCardProductKey(rawId);
      if (seenCanonical.has(canonicalProduct)) return;

      seenCanonical.add(canonicalProduct);
      options.push({
        id: rawId,
        name: displayTopCardProductLabel(rawId),
      });
    };

    DEFAULT_TOP_CARD_PRODUCT_IDS.forEach((id) => pushOption(id));
    topCardProductsFromResponse.forEach((id) => pushOption(id));

    return [...options].sort((leftOption, rightOption) => {
      const rankDiff = rankTopCardProductId(leftOption.id) - rankTopCardProductId(rightOption.id);
      if (rankDiff !== 0) return rankDiff;
      return leftOption.id.localeCompare(rightOption.id);
    });
  }, [topCardProductsFromResponse]);
  const handleTopCardProductChange = (next: string[]) => {
    if (next.length === 0) {
      setSelectedTopCardProductIds([...DEFAULT_TOP_CARD_PRODUCT_IDS]);
      return;
    }

    const seenCanonical = new Set<string>();
    const resolved: string[] = [];

    for (const rawId of next) {
      const canonicalProduct = canonicalTopCardProductKey(rawId);
      if (seenCanonical.has(canonicalProduct)) continue;

      seenCanonical.add(canonicalProduct);
      const matchingOption = topCardProductOptions.find(
        (option) => canonicalTopCardProductKey(option.id) === canonicalProduct
      );
      resolved.push(matchingOption?.id ?? rawId);
    }

    setSelectedTopCardProductIds(capTopCardProductSelection(resolved));
  };
  useEffect(() => {
    const validCanonicalProducts = new Set(topCardProductOptions.map((option) => canonicalTopCardProductKey(option.id)));

    setSelectedTopCardProductIds((previous) => {
      const filtered = previous.filter((id) => validCanonicalProducts.has(canonicalTopCardProductKey(id)));
      const next =
        filtered.length === 0 ? [...DEFAULT_TOP_CARD_PRODUCT_IDS] : capTopCardProductSelection(filtered);

      if (next.length === previous.length && next.every((id, index) => id === previous[index])) {
        return previous;
      }

      return next;
    });
  }, [topCardProductOptions]);
  const topCardProductsToShow = useMemo(
    () => sortTopCardProductIds(selectedTopCardProductIds),
    [selectedTopCardProductIds]
  );
  const chartProductRows = useMemo(() => {
    const unique = new Set<string>();
    [...dispatchReceiptDayWiseRows, ...stockUllageDayWiseRows].forEach((row: any) => {
      const product = normalizeProductKey(row?.product ?? row?.product_name ?? row?.product_grp);
      if (product) unique.add(product);
    });
    const prioritizedProductOrder = ['MS', 'HSD', 'ATF', 'ETH', 'BD'];
    return Array.from(unique)
      .sort((a, b) => {
        const aIdx = prioritizedProductOrder.indexOf(a.toUpperCase());
        const bIdx = prioritizedProductOrder.indexOf(b.toUpperCase());
        const aRank = aIdx === -1 ? Number.POSITIVE_INFINITY : aIdx;
        const bRank = bIdx === -1 ? Number.POSITIVE_INFINITY : bIdx;
        if (aRank !== bRank) return aRank - bRank;
        return a.localeCompare(b);
      })
      .map((productName) => ({ productName, tankDispatch: '0', tankReceipt: '0' }));
  }, [dispatchReceiptDayWiseRows, stockUllageDayWiseRows]);
  const productRowsForCharts = useMemo(() => {
    const sourceRows = orderedProductWiseRows.length ? orderedProductWiseRows : chartProductRows;
    const uniqueRows: typeof sourceRows = [];
    const seenProducts = new Set<string>();

    sourceRows.forEach((row) => {
      const productName = String(row?.productName ?? '').trim();
      if (!productName) return;

      const productKey = normalizeProductKey(productName);
      if (seenProducts.has(productKey)) return;

      seenProducts.add(productKey);
      uniqueRows.push({
        ...row,
        productName: productKey,
      });
    });

    return uniqueRows;
  }, [orderedProductWiseRows, chartProductRows]);
  const isDispatchReceiptTrendLoading = isRefreshing || isDispatchReceiptDayWiseLoading;
  const isStockUllageTrendLoading = isRefreshing || isStockUllageDayWiseLoading;
  const isSupplyChainTrendsLoading =
    isRefreshing || (isDispatchReceiptDayWiseLoading && isStockUllageDayWiseLoading);

  useEffect(() => {
    if (!productRowsForCharts.length) {
      setSelectedDispatchReceiptProduct('');
      setSelectedStockUllageProduct('');
      return;
    }

    const hasSelectedDispatchReceiptProduct = productRowsForCharts.some(
      (row) => row.productName === selectedDispatchReceiptProduct
    );
    if (!hasSelectedDispatchReceiptProduct) {
      setSelectedDispatchReceiptProduct(productRowsForCharts[0].productName);
    }
    const hasSelectedStockUllageProduct = productRowsForCharts.some(
      (row) => row.productName === selectedStockUllageProduct
    );
    if (!hasSelectedStockUllageProduct) {
      setSelectedStockUllageProduct(productRowsForCharts[0].productName);
    }
  }, [productRowsForCharts, selectedDispatchReceiptProduct, selectedStockUllageProduct]);

  const selectedDispatchReceiptRow = useMemo(
    () => productWiseRows.find((row) => row.productName === selectedDispatchReceiptProduct) ?? null,
    [productWiseRows, selectedDispatchReceiptProduct]
  );
  const selectedDispatchReceiptChartProduct = useMemo(
    () => normalizeProductKey(selectedDispatchReceiptProduct),
    [selectedDispatchReceiptProduct]
  );
  const selectedStockUllageChartProduct = useMemo(
    () => normalizeProductKey(selectedStockUllageProduct),
    [selectedStockUllageProduct]
  );
  const dispatchReceiptTotalsFromChart = useMemo(() => {
    const toNum = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const totals = dispatchReceiptDayWiseRows.reduce(
      (acc, row: any) => {
        const rowProduct = normalizeProductKey(row?.product ?? row?.product_name ?? row?.product_grp);
        if (!rowProduct || rowProduct !== selectedDispatchReceiptChartProduct) return acc;

        const dispatch = toNum(row?.dispatch ?? row?.tank_dispatch ?? row?.dispatch_qty ?? row?.total_dispatch);
        const receipt = toNum(row?.reciept ?? row?.receipt);

        return {
          dispatch: acc.dispatch + dispatch,
          receipt: acc.receipt + receipt,
        };
      },
      { dispatch: 0, receipt: 0 }
    );

    return {
      dispatch: totals.dispatch.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      receipt: totals.receipt.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
    };
  }, [dispatchReceiptDayWiseRows, selectedDispatchReceiptChartProduct]);
  const currentDayDispatchReceiptFromChart = useMemo(() => {
    const toNum = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const parseDate = (value: unknown) => {
      if (value == null) return Number.NaN;
      if (typeof value === 'number') return value;
      const raw = String(value).trim();
      if (!raw) return Number.NaN;

      const normalizedRaw = raw.replace(',', ' ').replace(/\s+/g, ' ').trim();
      const directParsed = new Date(normalizedRaw.includes(' ') ? normalizedRaw.replace(' ', 'T') : normalizedRaw).getTime();
      if (Number.isFinite(directParsed)) return directParsed;

      const monthMap: Record<string, number> = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };

      // Handles formats like 12-Feb, 12-Feb-24, 12-Feb-2025, 12 Feb 2025
      const dayMonthYearMatch = normalizedRaw.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s]?(\d{2,4})?$/);
      if (dayMonthYearMatch) {
        const day = Number(dayMonthYearMatch[1]);
        const monthKey = dayMonthYearMatch[2].slice(0, 3).toLowerCase();
        const month = monthMap[monthKey];
        const rawYear = dayMonthYearMatch[3];
        const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : new Date().getFullYear();
        if (Number.isFinite(day) && Number.isFinite(year) && month != null) {
          return new Date(year, month, day).getTime();
        }
      }

      // Handles formats like Feb-12, Feb-12-24, Feb 12 2025
      const monthDayYearMatch = normalizedRaw.match(/^([A-Za-z]{3,9})[-/\s](\d{1,2})(?:[-/\s](\d{2,4}))?$/);
      if (monthDayYearMatch) {
        const monthKey = monthDayYearMatch[1].slice(0, 3).toLowerCase();
        const month = monthMap[monthKey];
        const day = Number(monthDayYearMatch[2]);
        const rawYear = monthDayYearMatch[3];
        const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : new Date().getFullYear();
        if (Number.isFinite(day) && Number.isFinite(year) && month != null) {
          return new Date(year, month, day).getTime();
        }
      }

      return Number.NaN;
    };

    const productRows = dispatchReceiptDayWiseRows.filter((row: any) => {
      const rowProduct = normalizeProductKey(row?.product ?? row?.product_name ?? row?.product_grp);
      return rowProduct === selectedDispatchReceiptChartProduct;
    });

    if (!productRows.length) {
      return { dispatch: '0', receipt: '0' };
    }

    let latestRow = productRows[productRows.length - 1];
    let latestTs = parseDate(
      latestRow?.date_time ??
        latestRow?.date ??
        latestRow?.day ??
        latestRow?.dispatch_date ??
        latestRow?.created_at ??
        latestRow?.updated_at
    );

    productRows.forEach((row: any) => {
      const rowTs = parseDate(
        row?.date_time ?? row?.date ?? row?.day ?? row?.dispatch_date ?? row?.created_at ?? row?.updated_at
      );
      if (!Number.isFinite(latestTs) || (Number.isFinite(rowTs) && rowTs > latestTs)) {
        latestRow = row;
        latestTs = rowTs;
      }
    });

    const latestDispatch = toNum(
      latestRow?.dispatch ?? latestRow?.tank_dispatch ?? latestRow?.dispatch_qty ?? latestRow?.total_dispatch
    );
    const latestReceipt = toNum(latestRow?.reciept ?? latestRow?.receipt);

    return {
      dispatch: latestDispatch.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      receipt: latestReceipt.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
    };
  }, [dispatchReceiptDayWiseRows, selectedDispatchReceiptChartProduct]);
  const stockUllageTotalsFromChart = useMemo(() => {
    const toNum = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const totals = stockUllageDayWiseRows.reduce(
      (acc, row: any) => {
        const rowProduct = normalizeProductKey(row?.product ?? row?.product_name ?? row?.product_grp);
        if (!rowProduct || rowProduct !== selectedStockUllageChartProduct) return acc;

        const availableStock = toNum(row?.available_stock ?? row?.availableStock);
        const ullage = toNum(row?.ullage);

        return {
          availableStock: acc.availableStock + availableStock,
          ullage: acc.ullage + ullage,
        };
      },
      { availableStock: 0, ullage: 0 }
    );

    return {
      availableStock: totals.availableStock.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      ullage: totals.ullage.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
    };
  }, [stockUllageDayWiseRows, selectedStockUllageChartProduct]);
  const currentDayStockUllageFromChart = useMemo(() => {
    const toNum = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const parseDate = (value: unknown) => {
      if (value == null) return Number.NaN;
      if (typeof value === 'number') return value;
      const raw = String(value).trim();
      if (!raw) return Number.NaN;

      const normalizedRaw = raw.replace(',', ' ').replace(/\s+/g, ' ').trim();
      const directParsed = new Date(normalizedRaw.includes(' ') ? normalizedRaw.replace(' ', 'T') : normalizedRaw).getTime();
      if (Number.isFinite(directParsed)) return directParsed;

      const monthMap: Record<string, number> = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };

      const dayMonthYearMatch = normalizedRaw.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s]?(\d{2,4})?$/);
      if (dayMonthYearMatch) {
        const day = Number(dayMonthYearMatch[1]);
        const monthKey = dayMonthYearMatch[2].slice(0, 3).toLowerCase();
        const month = monthMap[monthKey];
        const rawYear = dayMonthYearMatch[3];
        const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : new Date().getFullYear();
        if (Number.isFinite(day) && Number.isFinite(year) && month != null) {
          return new Date(year, month, day).getTime();
        }
      }

      const monthDayYearMatch = normalizedRaw.match(/^([A-Za-z]{3,9})[-/\s](\d{1,2})(?:[-/\s](\d{2,4}))?$/);
      if (monthDayYearMatch) {
        const monthKey = monthDayYearMatch[1].slice(0, 3).toLowerCase();
        const month = monthMap[monthKey];
        const day = Number(monthDayYearMatch[2]);
        const rawYear = monthDayYearMatch[3];
        const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : new Date().getFullYear();
        if (Number.isFinite(day) && Number.isFinite(year) && month != null) {
          return new Date(year, month, day).getTime();
        }
      }

      return Number.NaN;
    };

    const productRows = stockUllageDayWiseRows.filter((row: any) => {
      const rowProduct = normalizeProductKey(row?.product ?? row?.product_name ?? row?.product_grp);
      return rowProduct === selectedStockUllageChartProduct;
    });

    if (!productRows.length) {
      return { availableStock: '0', ullage: '0' };
    }

    let latestRow = productRows[productRows.length - 1];
    let latestTs = parseDate(
      latestRow?.date_time ??
        latestRow?.date ??
        latestRow?.day ??
        latestRow?.dispatch_date ??
        latestRow?.created_at ??
        latestRow?.updated_at
    );

    productRows.forEach((row: any) => {
      const rowTs = parseDate(
        row?.date_time ?? row?.date ?? row?.day ?? row?.dispatch_date ?? row?.created_at ?? row?.updated_at
      );
      if (!Number.isFinite(latestTs) || (Number.isFinite(rowTs) && rowTs > latestTs)) {
        latestRow = row;
        latestTs = rowTs;
      }
    });

    const latestAvailableStock = toNum(latestRow?.available_stock ?? latestRow?.availableStock);
    const latestUllage = toNum(latestRow?.ullage);

    return {
      availableStock: latestAvailableStock.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      ullage: latestUllage.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
    };
  }, [stockUllageDayWiseRows, selectedStockUllageChartProduct]);

  return (
    <>
      <Card className="mb-1.5 !mt-0 w-full min-w-0 rounded-xl border border-gray-100 bg-white p-1.5">
        <CardHeader className="py-0 pl-2 pr-2">
          <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
            <CardTitle className="shrink-0 text-lg font-semibold text-gray-900">Supply Intelligence Hub</CardTitle>
            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
              <ZonePlantSelections
                key={locationMountKey}
                bu="TAS"
                containerClassName="flex min-w-0 flex-wrap gap-1 xl:justify-end"
                hideAlertType
                defaultPlantName={defaultPlantName}
                onZoneChange={(zone) => {
                  setSelectedZone(zone == null ? 'all' : zone);
                }}
                onPlantChange={(plant, zone) => {
                  setSelectedZone(zone == null ? 'all' : zone);
                  setSelectedLocation(plant == null ? 'all' : plant);
                  onLocationFilterReady?.();
                }}
                onPlantDisplayNameChange={onPlantDisplayNameChange}
              />
              <div className="w-full min-w-[140px] flex-1 sm:w-[168px] sm:flex-none sm:min-w-[168px] sm:max-w-[168px]">
                <CustomMultiSelect
                  options={topCardProductOptions}
                  value={topCardProductsToShow}
                  onValueChange={handleTopCardProductChange}
                  placeholder="Select Product"
                  maxCount={0}
                  hideSelectAll
                  triggerDisplay="firstWithCount"
                  loading={isRefreshing || isSupplyHubStockMetricsLoading}
                  className="h-7 min-h-7 w-full bg-white text-xs"
                />
              </div>
              <Button
                size="sm"
                className="flex h-7 shrink-0 items-center gap-2 rounded-md bg-blue-600 p-1 px-2 text-xs text-white hover:bg-blue-700"
                disabled={isRefreshing}
                onClick={() => {
                  setSummaryTimeFilter(null);
                  setHasSummaryTimeFilterOverride(false);
                  setProductInsightTimeFilter(null);
                  setHasProductInsightTimeFilterOverride(false);
                  setSupplyHubStockTimeFilter(null);
                  setHasSupplyHubStockTimeFilterOverride(false);
                  onChartTimeFilterChange('3M');
                  setTimeFilterResetToken((prev) => prev + 1);
                  setOutletDispatchStatusFilter('all');
                  setOutletDispatchChartFilter('all');
                  if (selectedZone !== 'all' || selectedLocation !== 'all') {
                    setSelectedZone('all');
                    setLocationMountKey((k) => k + 1);
                  } else {
                    setRefreshToken((prev) => prev + 1);
                  }
                }}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      <div className="grid w-full min-w-0 grid-cols-1 gap-2">
        <TASSupplyChainTopCards
          cards={kpiCards.slice(0, 8)}
          isRefreshing={isRefreshing || isSupplyHubStockMetricsLoading}
          executiveProductWiseChartRows={orderedExecutiveProductWiseChartRows}
          selectedTopCardProductIds={topCardProductsToShow}
          selectedLocation={selectedLocation}
          refreshToken={refreshToken}
          supplyHubTankDetailsDateRange={supplyHubTankDetailsDateRange}
          supplyHubTankwiseDateTimeValue={supplyHubTankwiseDateTimeValue}
        />
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-1">
        <div className="hidden">
          <div className="grid grid-cols-1 gap-1 lg:auto-rows-fr">
            {/* {kpiCards.map((item) => {
              const SideIcon = item.sideIcon;
              const isTwoCardRowTile = item.title === 'STOCK SUSTAINABILITY' || item.title === 'TOTAL RO';

              return (
                <div
                  key={item.title}
                  className={`rounded-xl border border-slate-300 border-l-2 bg-white p-1.5 pt-2 min-h-[82px] ${item.accentBorder}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold tracking-wide text-gray-500">
                      {item.title === 'TOTAL RO' ? (
                        <>
                          {item.title}{' '}
                          {isRefreshing || isTotalRoLoading ? (
                            <span className="inline-block h-3 w-8 rounded bg-gray-300/90 align-middle animate-pulse" />
                          ) : (
                            <span className="text-xs font-bold text-gray-900 leading-tight" aria-label="Total outlet counts">
                              ({item.value})
                            </span>
                          )}
                        </>
                      ) : (
                        item.title
                      )}
                    </div>
                    <SideIcon className="h-3.5 w-3.5 text-black" />
                  </div>
                  {item.title === 'TOTAL RO' ? (
                    <div className="mt-1.5 flex items-center w-full justify-center">
                      <div className="flex-1 flex flex-col items-center justify-center min-w-0 border-r border-gray-200">
                        <div className="text-[10px] font-medium text-gray-600 mb-0.5 leading-tight opacity-90">Active</div>
                        {isRefreshing || isTotalRoLoading ? (
                          <span className="mt-0.5 inline-block h-4 w-8 rounded bg-gray-300/90 animate-pulse" />
                        ) : (
                          <span className="text-sm font-bold text-gray-900 leading-tight">{activeRoValue}</span>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center min-w-0 border-r border-gray-200">
                        <div className="text-[10px] font-medium text-gray-600 mb-0.5 leading-tight opacity-90 whitespace-nowrap">
                          Partial DryOut
                        </div>
                        {isRefreshing || isTotalRoLoading ? (
                          <span className="mt-0.5 inline-block h-4 w-8 rounded bg-gray-300/90 animate-pulse" />
                        ) : (
                          <span className="text-sm font-bold text-gray-900 leading-tight">{mixedRoValue}</span>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                        <div className="text-[10px] font-medium text-gray-600 mb-0.5 leading-tight opacity-90">DryOut </div>
                        {isRefreshing || isTotalRoLoading ? (
                          <span className="mt-0.5 inline-block h-4 w-8 rounded bg-gray-300/90 animate-pulse" />
                        ) : (
                          <span className="text-sm font-bold text-gray-900 leading-tight">{inactiveRoValue}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-baseline gap-1">
                      {isRefreshing ? (
                        <div className="flex items-baseline gap-1">
                          <span className="inline-block h-5 w-14 rounded bg-gray-300/90 animate-pulse" />
                          <span className="text-[10px] text-gray-500">{item.unit}</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-base font-bold leading-none text-gray-900">{item.value}</span>
                          <span className="text-[10px] text-gray-500">{item.unit}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })} */}
          </div>
        </div>
        <div className="w-full min-w-0">
          <div
            className={`flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white p-2 ${
              isSupplyChainTrendsLoading ? 'min-h-[208px]' : 'min-h-[286px]'
            }`}
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="text-sm font-semibold text-slate-900">Supply Chain Trends</div>
              <div className="ml-auto">
                <EnhancedTimeFilter
                  key={`time-filter-${timeFilterResetToken}`}
                  selectedFilter={chartTimeFilter}
                  onFilterChange={onChartTimeFilterChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-1">
              <div
                className={`min-w-0 rounded-xl border border-slate-200 bg-white p-2 ${
                  isDispatchReceiptTrendLoading ? 'self-start' : ''
                }`}
              >
                <div className="mb-0.5 -mx-2 -mt-2 rounded-t-xl bg-blue-50 px-2 pt-2">
                  <div className="mb-1.5 flex items-center pb-1.5">
                    <div className="shrink-0 text-xs font-semibold tracking-wide text-blue-900">Dispatch/Receipt</div>
                    <div className="w-10 shrink-0" />
                    <div className="overflow-x-auto">
                      <div className="inline-flex min-w-max items-center gap-1.5">
                        {productRowsForCharts.map((item, index) => {
                          const isSelected = item.productName === selectedDispatchReceiptProduct;
                          const productTheme = getProductTheme(index, item.productName);
                          return (
                            <button
                              key={`dispatch-receipt-tab-${item.productName}`}
                              type="button"
                              onClick={() => setSelectedDispatchReceiptProduct(item.productName)}
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase transition-colors ${
                                isSelected
                                  ? `${productTheme.badgeBg} text-white`
                                  : `${productTheme.textColor} bg-gray-100 hover:bg-gray-200`
                              }`}
                            >
                              {item.productName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {isDispatchReceiptTrendLoading ? (
                    <div className="flex h-10 items-center justify-center">
                      <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
                    </div>
                  ) : productRowsForCharts.length ? (
                    <>
                      <div className="px-1 pt-1 pb-0 text-[12px]">
                        <div className="grid grid-cols-5 gap-2">
                          <div className="rounded-md bg-gray-100 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-black">
                                <Droplets className="h-3.5 w-3.5 text-blue-600" />
                                Avg Receipt
                              </span>
                              {isDispatchReceiptDayWiseLoading ? (
                                <span className="inline-block h-4 w-[4.5rem] shrink-0 rounded bg-gray-300/90 animate-pulse" />
                              ) : (
                                <span className="text-[13px] font-semibold text-gray-900">
                                  {dispatchReceiptTotalsFromChart.receipt}KL
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rounded-md bg-gray-100 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-black">
                                <Droplets className="h-3.5 w-3.5 text-blue-700" />
                                Current Day Receipt
                              </span>
                              {isDispatchReceiptDayWiseLoading ? (
                                <span className="inline-block h-4 w-[4.5rem] shrink-0 rounded bg-gray-300/90 animate-pulse" />
                              ) : (
                                <span className="text-[13px] font-semibold text-gray-900">
                                  {currentDayDispatchReceiptFromChart.receipt}KL
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rounded-md bg-gray-100 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-black">
                                <Fuel className="h-3.5 w-3.5 text-blue-600" />
                                Avg Dispatch
                              </span>
                              {isDispatchReceiptDayWiseLoading ? (
                                <span className="inline-block h-4 w-[4.5rem] shrink-0 rounded bg-gray-300/90 animate-pulse" />
                              ) : (
                                <span className="text-[13px] font-semibold text-gray-900">
                                  {dispatchReceiptTotalsFromChart.dispatch}KL
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rounded-md bg-gray-100 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-black">
                                <Fuel className="h-3.5 w-3.5 text-blue-700" />
                                Current Day Dispatch
                              </span>
                              {isDispatchReceiptDayWiseLoading ? (
                                <span className="inline-block h-4 w-[4.5rem] shrink-0 rounded bg-gray-300/90 animate-pulse" />
                              ) : (
                                <span className="text-[13px] font-semibold text-gray-900">
                                  {currentDayDispatchReceiptFromChart.dispatch}KL
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 pt-1.5">
                        <div className="mb-1.5 flex items-center justify-end">
                          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                            <button
                              type="button"
                              onClick={() => setDispatchReceiptTrendView('line')}
                              className={`rounded px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                                dispatchReceiptTrendView === 'line'
                                  ? 'bg-white text-blue-700 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Line
                            </button>
                            <button
                              type="button"
                              onClick={() => setDispatchReceiptTrendView('table')}
                              className={`rounded px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                                dispatchReceiptTrendView === 'table'
                                  ? 'bg-white text-blue-700 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Table
                            </button>
                          </div>
                        </div>
                        {dispatchReceiptTrendView === 'line' ? (
                          <TASSupplyChainDaywiseAm3BarChart
                            rows={dispatchReceiptDayWiseRows}
                            isLoading={isDispatchReceiptDayWiseLoading}
                            selectedProduct={selectedDispatchReceiptChartProduct}
                            legendPosition="top"
                          />
                        ) : (
                          <TASSupplyChainDaywiseDispatchReceiptTable
                            rows={dispatchReceiptDayWiseRows}
                            isLoading={isDispatchReceiptDayWiseLoading}
                            selectedProduct={selectedDispatchReceiptChartProduct}
                          />
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-3 text-center text-xs text-gray-500">No product insight data available</div>
                  )}
                </div>
              </div>
              <div
                className={`min-w-0 rounded-xl border border-slate-200 bg-white p-2 ${
                  isStockUllageTrendLoading ? 'self-start' : ''
                }`}
              >
                <div className="mb-0.5 -mx-2 -mt-2 rounded-t-xl bg-blue-50 px-2 pt-2">
                  <div className="mb-1.5 flex items-center gap-1 pb-1.5">
                    <div className="shrink-0 text-xs font-semibold tracking-wide text-blue-900">Available Stock/Ullage</div>
                    <div className="w-10 shrink-0" />
                    <div className="min-w-0 flex-1 overflow-x-auto">
                      <div className="inline-flex min-w-max items-center gap-1.5">
                        {productRowsForCharts.map((item, index) => {
                          const isSelected = item.productName === selectedStockUllageProduct;
                          const productTheme = getProductTheme(index, item.productName);
                          return (
                            <button
                              key={`stock-ullage-tab-${item.productName}`}
                              type="button"
                              onClick={() => setSelectedStockUllageProduct(item.productName)}
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase transition-colors ${
                                isSelected
                                  ? `${productTheme.badgeBg} text-white`
                                  : `${productTheme.textColor} bg-gray-100 hover:bg-gray-200`
                              }`}
                            >
                              {item.productName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-0 space-y-2 overflow-y-auto pr-1">
                  {isStockUllageTrendLoading ? (
                    <div className="flex h-10 items-center justify-center">
                      <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
                    </div>
                  ) : productRowsForCharts.length ? (
                    <>
                      <div className="px-1 pt-1 pb-0 text-[12px]">
                        <div className="grid grid-cols-4 gap-2">
                          <div className="rounded-md bg-gray-100 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-black">
                                <Fuel className="h-3.5 w-3.5 text-blue-600" />
                                Avg Available Stock
                              </span>
                              {isStockUllageDayWiseLoading ? (
                                <span className="inline-block h-4 w-[4.5rem] shrink-0 rounded bg-gray-300/90 animate-pulse" />
                              ) : (
                                <span className="text-[13px] font-semibold text-gray-900">
                                  {stockUllageTotalsFromChart.availableStock}KL
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rounded-md bg-gray-100 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-black">
                                <Fuel className="h-3.5 w-3.5 text-blue-700" />
                                Current Day Available
                              </span>
                              {isStockUllageDayWiseLoading ? (
                                <span className="inline-block h-4 w-[3rem] shrink-0 rounded bg-gray-300/90 animate-pulse" />
                              ) : (
                                <span className="text-[13px] font-semibold text-gray-900">
                                  {currentDayStockUllageFromChart.availableStock}KL
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rounded-md bg-gray-100 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-black">
                                <Droplets className="h-3.5 w-3.5 text-blue-600" />
                                Avg Ullage
                              </span>
                              {isStockUllageDayWiseLoading ? (
                                <span className="inline-block h-4 w-[4.5rem] shrink-0 rounded bg-gray-300/90 animate-pulse" />
                              ) : (
                                <span className="text-[13px] font-semibold text-gray-900">
                                  {stockUllageTotalsFromChart.ullage}KL
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rounded-md bg-gray-100 px-1.5 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-black">
                                <Droplets className="h-3.5 w-3.5 text-blue-700" />
                                Current Day Ullage
                              </span>
                              {isStockUllageDayWiseLoading ? (
                                <span className="inline-block h-4 w-[4.5rem] shrink-0 rounded bg-gray-300/90 animate-pulse" />
                              ) : (
                                <span className="text-[13px] font-semibold text-gray-900">
                                  {currentDayStockUllageFromChart.ullage}KL
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 pt-1.5">
                        <div className="mb-1.5 flex items-center justify-end">
                          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                            <button
                              type="button"
                              onClick={() => setStockUllageTrendView('line')}
                              className={`rounded px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                                stockUllageTrendView === 'line'
                                  ? 'bg-white text-blue-700 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Line
                            </button>
                            <button
                              type="button"
                              onClick={() => setStockUllageTrendView('table')}
                              className={`rounded px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                                stockUllageTrendView === 'table'
                                  ? 'bg-white text-blue-700 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Table
                            </button>
                          </div>
                        </div>
                        {stockUllageTrendView === 'line' ? (
                          <TASSupplyChainDaywiseStockUllageLineChart
                            rows={stockUllageDayWiseRows}
                            isLoading={isStockUllageDayWiseLoading}
                            selectedProduct={selectedStockUllageChartProduct}
                            legendPosition="top"
                          />
                        ) : (
                          <TASSupplyChainDaywiseStockUllageTable
                            rows={stockUllageDayWiseRows}
                            isLoading={isStockUllageDayWiseLoading}
                            selectedProduct={selectedStockUllageChartProduct}
                          />
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-3 text-center text-xs text-gray-500">No product insight data available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
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
    </>
  );
}
