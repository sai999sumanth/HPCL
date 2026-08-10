import React, { useEffect, useMemo, useState } from 'react';
import { Fuel } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/@/components/ui/tooltip';
import { apiClient } from '@/services/apiClient';
import msPetrolIcon from '@/assets/images/ms_petrol.svg';
import hsdDieselIcon from '@/assets/images/hsd_diesel.svg';
import atfAeroplaneIcon from '@/assets/images/atf_aeroplane.svg';
import bdBiodieselIcon from '@/assets/images/bd_biodiesel.svg';

const CIRCLE_RADIUS = 15;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

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

/** Canonical key for dedupe / row matching (BD↔BIODIESEL, ETHANOL↔ETH). */
function canonicalTopCardProductKey(id: string): string {
  const k = id.trim().toUpperCase();
  if (k === 'BD' || k === 'BIODIESEL') return 'BIODIESEL';
  if (k === 'ETHANOL' || k === 'ETH') return 'ETH';
  return k;
}

/** Short label on cards and in the product multiselect. */
function displayTopCardProductLabel(id: string): string {
  const k = id.trim().toUpperCase();
  if (k === 'BIODIESEL') return 'BD';
  if (k === 'ETHANOL' || k === 'ETH') return 'ETH';
  return k;
}

function TopCardProductIcon({
  src,
  alt,
  label,
  labelColor,
}: {
  src: string;
  alt: string;
  label: string;
  labelColor: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center">
      <span className={`mb-0.5 text-[11px] font-bold uppercase leading-none sm:text-xs ${labelColor}`}>
        {label}
      </span>
      <div className="h-[2.65rem] w-9 overflow-hidden sm:h-[2.75rem] sm:w-10">
        <img
          src={src}
          alt={alt}
          className="h-[3.1rem] w-full -translate-y-1 object-cover object-top sm:h-[3.25rem] sm:-translate-y-1.5"
          draggable={false}
        />
      </div>
    </div>
  );
}
function rankTopCardProductId(id: string): number {
  const raw = id.trim().toUpperCase();
  const canon = canonicalTopCardProductKey(id);
  let idx = TOP_CARD_PRODUCT_PRIORITY.indexOf(raw);
  if (idx === -1) idx = TOP_CARD_PRODUCT_PRIORITY.indexOf(canon);
  if (idx === -1 && canon === 'ETH') {
    const iEthanol = TOP_CARD_PRODUCT_PRIORITY.indexOf('ETHANOL');
    const iEth = TOP_CARD_PRODUCT_PRIORITY.indexOf('ETH');
    const candidates = [iEthanol, iEth].filter((i) => i !== -1);
    idx = candidates.length ? Math.min(...candidates) : -1;
  }
  return idx === -1 ? 999 : idx;
}

function topCardsGridClass(productCount: number) {
  const base = 'grid w-full min-w-0 items-start gap-2 grid-cols-1 sm:grid-cols-2';
  if (productCount <= 1) return `${base} lg:grid-cols-1`;
  if (productCount === 2) return `${base} lg:grid-cols-2 xl:grid-cols-2`;
  if (productCount === 3) return `${base} lg:grid-cols-3 xl:grid-cols-3`;
  if (productCount === 4) return `${base} lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4`;
  if (productCount === 5) return `${base} lg:grid-cols-3 xl:grid-cols-5`;
  return `${base} lg:grid-cols-3 xl:grid-cols-6`;
}

const TOP_CARD_PRODUCT_THEMES: Record<
  string,
  { iconBg: string; labelColor: string; borderColor: string }
> = {
  MS: { iconBg: 'bg-blue-600', labelColor: 'text-blue-700', borderColor: 'border-blue-100' },
  HSD: { iconBg: 'bg-teal-600', labelColor: 'text-teal-700', borderColor: 'border-teal-100' },
  ATF: { iconBg: 'bg-orange-500', labelColor: 'text-orange-600', borderColor: 'border-orange-100' },
  BD: { iconBg: 'bg-violet-600', labelColor: 'text-violet-700', borderColor: 'border-violet-100' },
  BIODIESEL: { iconBg: 'bg-violet-600', labelColor: 'text-violet-700', borderColor: 'border-violet-100' },
  ETH: { iconBg: 'bg-emerald-600', labelColor: 'text-emerald-700', borderColor: 'border-emerald-100' },
  ETHANOL: { iconBg: 'bg-emerald-600', labelColor: 'text-emerald-700', borderColor: 'border-emerald-100' },
  TURBO: { iconBg: 'bg-sky-600', labelColor: 'text-sky-700', borderColor: 'border-sky-100' },
  'POWER 95': { iconBg: 'bg-fuchsia-600', labelColor: 'text-fuchsia-700', borderColor: 'border-fuchsia-100' },
  'POWER 99': { iconBg: 'bg-rose-600', labelColor: 'text-rose-700', borderColor: 'border-rose-100' },
  'POWER 100': { iconBg: 'bg-amber-600', labelColor: 'text-amber-700', borderColor: 'border-amber-100' },
};

function getTopCardProductTheme(productKey: string) {
  const key = productKey.trim().toUpperCase();
  const canonical = canonicalTopCardProductKey(key);
  return (
    TOP_CARD_PRODUCT_THEMES[key] ??
    TOP_CARD_PRODUCT_THEMES[canonical] ?? {
      iconBg: 'bg-slate-600',
      labelColor: 'text-slate-700',
      borderColor: 'border-slate-100',
    }
  );
}

function getTopCardProductIcon(productKey: string): string | null {
  const raw = productKey.trim().toUpperCase();
  const canonical = canonicalTopCardProductKey(productKey);
  if (raw === 'MS' || canonical === 'MS') return msPetrolIcon;
  if (raw === 'HSD' || canonical === 'HSD') return hsdDieselIcon;
  if (raw === 'ATF' || canonical === 'ATF') return atfAeroplaneIcon;
  if (raw === 'BD' || raw === 'BIODIESEL' || canonical === 'BIODIESEL') return bdBiodieselIcon;
  return null;
}

type SeverityRingItem = {
  label: string;
  stroke: string;
  threshold: string;
  value: number;
  hoverRows: AggregatedSustainabilityRow[];
};

function SeverityRingGrid({
  severityData,
  isLoading,
}: {
  severityData: SeverityRingItem[];
  isLoading: boolean;
}) {
  return (
    <TooltipProvider>
      <div className="grid min-w-0 flex-1 grid-cols-4 gap-0 sm:gap-0.5 xl:justify-end">
        {severityData.map((severity) => {
          const ringValue = isLoading ? 0 : Math.max(0, severity.value);
          const normalizedPercent = Math.max(0, Math.min(100, ringValue));
          const progressOffset = CIRCLE_CIRCUMFERENCE * (1 - normalizedPercent / 100);
          return (
            <Tooltip key={severity.label}>
              <TooltipTrigger asChild>
                <div className="flex w-full min-w-0 cursor-default flex-col items-center px-0">
                  <span className="mb-0.5 truncate text-center text-[7px] font-medium leading-none text-blue-900 sm:text-[8px]">
                    {severity.label}
                  </span>
                  <div className="relative h-9 w-9 sm:h-10 sm:w-10">
                    <svg
                      className="h-9 w-9 -rotate-90 sm:h-10 sm:w-10"
                      viewBox="0 0 42 42"
                      aria-hidden
                    >
                      <circle
                        cx="21"
                        cy="21"
                        r={CIRCLE_RADIUS}
                        stroke="#cbd5e1"
                        strokeWidth="4"
                        fill="none"
                      />
                      <circle
                        cx="21"
                        cy="21"
                        r={CIRCLE_RADIUS}
                        stroke={severity.stroke}
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={CIRCLE_CIRCUMFERENCE}
                        strokeDashoffset={progressOffset}
                        className={isLoading ? 'opacity-40' : undefined}
                      />
                    </svg>
                    <span
                      className={`absolute inset-0 flex items-center justify-center text-[8px] font-semibold leading-none sm:text-[9px]${
                        isLoading ? ' animate-pulse text-slate-400' : ' text-blue-900 sm:text-[11px] font-bold'
                      }`}
                    >
                      {isLoading ? '…' : ringValue}
                    </span>
                  </div>
                  <span className="mt-0.5 hidden truncate text-center text-[6px] font-medium leading-tight text-slate-600 sm:block sm:text-[7px]">
                    {isLoading ? 'Loading' : severity.threshold}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-h-44 max-w-80 overflow-y-auto text-xs">
                <div className="mb-1 font-semibold">
                  {severity.label} ({severity.threshold})
                </div>
                {isLoading ? (
                  <div>Loading tank data…</div>
                ) : severity.hoverRows.length ? (
                  <div className="space-y-1">
                    {severity.hoverRows.map((row, rowIndex) => (
                      <div key={`${severity.label}-${rowIndex}`}>
                        location: {row.location_name ?? '-'} | zone: {row.zone}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>No tanks in this bucket</div>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function sortTopCardProductIds(ids: string[], rankOf: (id: string) => number = rankTopCardProductId) {
  return [...ids].sort((a, b) => {
    const d = rankOf(a) - rankOf(b);
    if (d !== 0) return d;
    return a.localeCompare(b);
  });
}

type TopCardItem = {
  title: string;
  value: string;
  unit: string;
  accentBorder: string;
  sideIcon: React.ComponentType<{ className?: string }>;
};

type ExecutiveRow = {
  productName: string;
  availableStock: number;
  deadStock: number;
  capacity: number;
  ullage: number;
};

type TankwiseRow = {
  zone?: string | null;
  sap_id?: string | null;
  location_name?: string | null;
  tank_name?: string | null;
  product?: string | null;
  product_name?: string | null;
  product_category?: string | null;
  category?: string | null;
  available_stock_kl?: number | string | null;
  stock_sustainability?: number | string | null;
  stockSustainability?: number | string | null;
};

type AggregatedSustainabilityRow = {
  sap_id: string;
  location_name: string;
  zone: string;
  productKey: string;
  totalStockSustainability: number;
  tankCount: number;
  tankNames: string[];
};

type Props = {
  cards: TopCardItem[];
  isRefreshing: boolean;
  executiveProductWiseChartRows: ExecutiveRow[];
  selectedTopCardProductIds: string[];
  selectedLocation: string;
  refreshToken: number;
  /** Full `date_time` for tank_status — aligned with supply-hub `product_wise_trends` (fixed default range until user changes calendar). */
  supplyHubTankDetailsDateRange: string;
  /** `date_time` for tankwise_sustainability; default is start day of that same fixed range. */
  supplyHubTankwiseDateTimeValue: string;
};

export default function TASSupplyChainTopCards({
  cards,
  isRefreshing,
  executiveProductWiseChartRows,
  selectedTopCardProductIds,
  selectedLocation,
  refreshToken,
  supplyHubTankDetailsDateRange,
  supplyHubTankwiseDateTimeValue,
}: Props) {
  const severityMeta = [
    { label: 'Normal', stroke: '#22c55e', threshold: '>5 days supply' },
    { label: 'Medium', stroke: '#f59e0b', threshold: '3-4 days' },
    { label: 'High', stroke: '#f97316', threshold: '2 days' },
    { label: 'Critical', stroke: '#ef4444', threshold: '0-1 days' },
  ];
  const [tankUsageByProduct, setTankUsageByProduct] = useState<Record<string, { totalTank: number; inUse: number; notInUse: number }>>({});
  const [tankwiseRows, setTankwiseRows] = useState<TankwiseRow[]>([]);
  const [isTankUsageLoading, setIsTankUsageLoading] = useState(false);
  const getProductKey = (value: string) => value.trim().toUpperCase();
  const canonicalProductKey = (value: string) => canonicalTopCardProductKey(value);

  const productsToShow = useMemo(
    () => sortTopCardProductIds(selectedTopCardProductIds),
    [selectedTopCardProductIds]
  );

  const visibleCards = useMemo(
    () => productsToShow.map((_, index) => cards[index] ?? cards[cards.length - 1]),
    [cards, productsToShow]
  );
  const toDisplayValue = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const getStockSustainability = (row: TankwiseRow) => {
    const parsed = Number(row?.stock_sustainability ?? row?.stockSustainability ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const aggregateByProductAndSapId = (rows: TankwiseRow[]): AggregatedSustainabilityRow[] => {
    const grouped = new Map<string, AggregatedSustainabilityRow>();

    rows.forEach((row) => {
      const productKey = getProductKey(String(row?.product ?? row?.product_name ?? row?.product_category ?? row?.category ?? ''));
      if (!productKey) return;

      const sapId = String(row?.sap_id ?? '').trim();
      if (!sapId) return;

      const key = `${productKey}::${sapId}`;
      const current = grouped.get(key) ?? {
        sap_id: sapId,
        location_name: String(row?.location_name ?? '-'),
        zone: String(row?.zone ?? '-'),
        productKey,
        totalStockSustainability: 0,
        tankCount: 0,
        tankNames: [],
      };

      const tankName = String(row?.tank_name ?? '').trim();
      current.totalStockSustainability += getStockSustainability(row);
      current.tankCount += 1;
      if (tankName && !current.tankNames.includes(tankName)) {
        current.tankNames.push(tankName);
      }

      grouped.set(key, current);
    });

    return Array.from(grouped.values());
  };

  const isTankDetailsLoading = isTankUsageLoading;
  const isCapacityRefreshing = isRefreshing;

  const tankwisePayload = useMemo(
    () => ({
      filters: [
        {
          key: 'date_time',
          cond: 'equals',
          value: supplyHubTankwiseDateTimeValue,
          val: '',
        },
        ...(selectedLocation && selectedLocation !== 'all'
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
      action: 'tankwise_sustainability',
      drill_state: '',
      cross_filters: [],
      limit: 0,
      payload: {},
    }),
    [selectedLocation, supplyHubTankwiseDateTimeValue]
  );

  const tankStatusPayload = useMemo(
    () => ({
      filters: [
        {
          key: 'date_time',
          cond: 'equals',
          value: supplyHubTankDetailsDateRange,
          val: '',
        },
        ...(selectedLocation && selectedLocation !== 'all'
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
      action: 'tank_status',
      drill_state: '',
      cross_filters: [],
      limit: 0,
      payload: {},
    }),
    [selectedLocation, supplyHubTankDetailsDateRange]
  );

  useEffect(() => {
    let isActive = true;
    const toNumberOrNull = (value: unknown): number | null => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const pickFirstNumericValue = (candidates: unknown[]): number | null => {
      for (const candidate of candidates) {
        const numeric = toNumberOrNull(candidate);
        if (numeric !== null) return numeric;
      }
      return null;
    };
    const collectTankwiseRowsDeep = (input: unknown): TankwiseRow[] => {
      const visited = new Set<unknown>();
      const result: TankwiseRow[] = [];
      const walk = (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        if (visited.has(value)) return;
        visited.add(value);

        if (Array.isArray(value)) {
          const hasTankwiseLikeRow = value.some((item) => {
            if (!item || typeof item !== 'object') return false;
            const row = item as Record<string, unknown>;
            return (
              'tank_name' in row ||
              'stock_sustainability' in row ||
              'stockSustainability' in row ||
              'product' in row ||
              'product_name' in row
            );
          });
          if (hasTankwiseLikeRow) result.push(...(value as TankwiseRow[]));
          value.forEach(walk);
          return;
        }

        Object.values(value as Record<string, unknown>).forEach(walk);
      };
      walk(input);
      return result;
    };

    const extractTankUsageByProduct = (rawData: unknown) => {
      const rows = Array.isArray(rawData)
        ? rawData
        : Array.isArray((rawData as { rows?: unknown[] })?.rows)
          ? ((rawData as { rows: unknown[] }).rows ?? [])
          : [];
      const usageMap: Record<string, { totalTank: number; inUse: number; notInUse: number }> = {};

      rows.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const row = item as Record<string, unknown>;
        const productKey = getProductKey(
          String(row?.product ?? row?.product_name ?? row?.product_category ?? row?.category ?? '')
        );
        if (!productKey) return;

        const totalTankValue = pickFirstNumericValue([row?.total_tank, row?.totalTank, row?.total]);
        const inUseValue = pickFirstNumericValue([row?.tanks_in_use, row?.in_use, row?.inUse, row?.used_tank]);
        const notInUseValue = pickFirstNumericValue([row?.tanks_not_in_use, row?.not_in_use, row?.notInUse, row?.unused_tank]);

        usageMap[productKey] = {
          totalTank: Math.max(0, Math.round(totalTankValue ?? 0)),
          inUse: Math.max(0, Math.round(inUseValue ?? 0)),
          notInUse: Math.max(0, Math.round(notInUseValue ?? 0)),
        };
      });

      return usageMap;
    };

    const fetchTankUsage = async () => {
      setIsTankUsageLoading(true);
      try {
        const [tankwiseResult, tankStatusResult] = await Promise.allSettled([
          apiClient.post('/api/tankdetails/get_tank_details', tankwisePayload),
          apiClient.post('/api/tankdetails/get_tank_details', tankStatusPayload),
        ]);
        if (!isActive) return;

        if (tankwiseResult.status === 'fulfilled') {
          const tankwiseRawData =
            tankwiseResult.value?.data?.data ??
            tankwiseResult.value?.data?.payload?.data ??
            tankwiseResult.value?.data?.payload ??
            tankwiseResult.value?.data;

          const rows: TankwiseRow[] = Array.isArray(tankwiseRawData)
            ? tankwiseRawData
            : Array.isArray(tankwiseRawData?.rows)
              ? tankwiseRawData.rows
              : collectTankwiseRowsDeep(tankwiseRawData);

          setTankwiseRows(rows);
        } else {
          console.error('Failed to fetch tankwise sustainability:', tankwiseResult.reason);
          setTankwiseRows([]);
        }

        if (tankStatusResult.status === 'fulfilled') {
          const tankStatusRawData =
            tankStatusResult.value?.data?.data ??
            tankStatusResult.value?.data?.payload?.data ??
            tankStatusResult.value?.data?.payload ??
            tankStatusResult.value?.data;
          setTankUsageByProduct(extractTankUsageByProduct(tankStatusRawData));
        } else {
          console.error('Failed to fetch tank status:', tankStatusResult.reason);
          setTankUsageByProduct({});
        }
      } catch (error) {
        if (!isActive) return;
        console.error('Failed to fetch tank details:', error);
        setTankUsageByProduct({});
        setTankwiseRows([]);
      } finally {
        if (isActive) setIsTankUsageLoading(false);
      }
    };

    void fetchTankUsage();
    return () => {
      isActive = false;
    };
  }, [tankwisePayload, tankStatusPayload, refreshToken]);

  return (
    <div className="flex w-full flex-col gap-0">
      <div className={topCardsGridClass(productsToShow.length)}>
      {visibleCards.map((item, index) => {
        const displayProductName = productsToShow[index] ?? productsToShow[productsToShow.length - 1];
        const mappedCanonicalKey = canonicalProductKey(displayProductName);
        const mappedProductKey = getProductKey(displayProductName);
        const productTheme = getTopCardProductTheme(displayProductName);
        const productIconSrc = getTopCardProductIcon(displayProductName);
        const productTankUsage =
          tankUsageByProduct[mappedProductKey] ??
          (mappedCanonicalKey === 'BIODIESEL'
            ? tankUsageByProduct.BD ?? tankUsageByProduct.BIODIESEL
            : undefined) ??
          (mappedCanonicalKey === 'ETH'
            ? tankUsageByProduct.ETHANOL ?? tankUsageByProduct.ETH
            : undefined) ??
          { totalTank: 0, inUse: 0, notInUse: 0 };
        const stockUtilizationRow =
          executiveProductWiseChartRows.find(
            (row) => canonicalProductKey(row.productName) === mappedCanonicalKey
          ) ?? null;
        const totalCapacity = Math.max(0, stockUtilizationRow?.capacity ?? 0);
        const totalUllage = Math.max(0, stockUtilizationRow?.ullage ?? 0);
        const productTankRows = tankwiseRows.filter(
          (row) =>
            canonicalProductKey(
              String(row?.product ?? row?.product_name ?? row?.product_category ?? row?.category ?? '')
            ) === mappedCanonicalKey
        );
        const productSapRows = aggregateByProductAndSapId(productTankRows);
        const normalRows = productSapRows.filter((row) => row.totalStockSustainability > 5);
        const mediumRows = productSapRows.filter((row) => {
          const value = row.totalStockSustainability;
          return value >= 3 && value < 5;
        });
        const highRows = productSapRows.filter((row) => {
          const value = row.totalStockSustainability;
          return value >= 2 && value < 3;
        });
        const criticalRows = productSapRows.filter((row) => {
          const value = row.totalStockSustainability;
          return value >= 0 && value < 2;
        });
        const productSeverityData = [
          {
            ...severityMeta[0],
            value: normalRows.length,
            hoverRows: normalRows,
          },
          {
            ...severityMeta[1],
            value: mediumRows.length,
            hoverRows: mediumRows,
          },
          {
            ...severityMeta[2],
            value: highRows.length,
            hoverRows: highRows,
          },
          {
            ...severityMeta[3],
            value: criticalRows.length,
            hoverRows: criticalRows,
          },
        ];

        return (
          <div
            key={`${canonicalProductKey(displayProductName)}-${item.title}`}
            className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${productTheme.borderColor}`}
          >
            <div className="flex min-w-0 flex-col px-2.5 pt-2 pb-1 sm:px-3 sm:pt-2.5 sm:pb-1">
              <div className="flex min-w-0 flex-col gap-1.5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex shrink-0 flex-col items-center self-start">
                  {productIconSrc ? (
                    <TopCardProductIcon
                      src={productIconSrc}
                      alt={displayTopCardProductLabel(displayProductName)}
                      label={displayTopCardProductLabel(displayProductName)}
                      labelColor={productTheme.labelColor}
                    />
                  ) : (
                    <div className="flex shrink-0 flex-col items-center">
                      <span
                        className={`mb-0.5 text-[11px] font-bold uppercase leading-none sm:text-xs ${productTheme.labelColor}`}
                      >
                        {displayTopCardProductLabel(displayProductName)}
                      </span>
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${productTheme.iconBg}`}
                      >
                        <Fuel className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
                      </div>
                    </div>
                  )}
                </div>

                <SeverityRingGrid severityData={productSeverityData} isLoading={isTankDetailsLoading} />
              </div>

              {isTankDetailsLoading ? (
                <div className="mt-3 flex min-h-[2.5rem] items-center justify-center sm:mt-3.5">
                  <span className="text-[9px] font-medium text-slate-400 animate-pulse sm:text-[10px]">
                    Loading tank details…
                  </span>
                </div>
              ) : (
                <div className="mt-3 grid min-w-0 grid-cols-3 gap-0.5 text-center sm:mt-3.5 sm:gap-1">
                  <div className="min-w-0">
                    <div className="truncate text-[8px] font-semibold text-slate-500 sm:text-[9px]">Total Tanks</div>
                    <div className="mt-0.5 text-xs font-bold leading-none text-slate-900 sm:text-sm">
                      {productTankUsage.totalTank}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[8px] font-semibold text-emerald-600 sm:text-[9px]">In Use</div>
                    <div className="mt-0.5 text-xs font-bold leading-none text-emerald-600 sm:text-sm">
                      {productTankUsage.inUse}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[8px] font-semibold text-rose-600 sm:text-[9px]">Not In Use</div>
                    <div className="mt-0.5 text-xs font-bold leading-none text-rose-600 sm:text-sm">
                      {productTankUsage.notInUse}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-1.5 border-t border-slate-100 pt-1 pb-0">
                <div className="grid min-w-0 grid-cols-2 gap-1">
                  <div className="min-w-0">
                    <div className="truncate text-[8px] font-semibold text-slate-500 sm:text-[9px]">Total Capacity</div>
                    {isCapacityRefreshing && !stockUtilizationRow ? (
                      <div className="mt-1 h-3.5 w-16 animate-pulse rounded bg-slate-200 sm:w-20" />
                    ) : (
                      <div className="mt-0.5 truncate text-[11px] font-bold leading-tight text-slate-900 sm:text-xs">
                        {toDisplayValue(totalCapacity)} KL
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[8px] font-semibold text-slate-500 sm:text-[9px]">Total Ullage</div>
                    {isCapacityRefreshing && !stockUtilizationRow ? (
                      <div className="mt-1 h-3.5 w-16 animate-pulse rounded bg-slate-200 sm:w-20" />
                    ) : (
                      <div className="mt-0.5 truncate text-[11px] font-bold leading-tight text-slate-900 sm:text-xs">
                        {toDisplayValue(totalUllage)} KL
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
