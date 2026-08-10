import React, { useMemo } from 'react';
import { Button } from '@/@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/@/components/ui/sheet';
import { Fuel, Maximize2, RefreshCw } from 'lucide-react';

type ExecutiveRow = {
  productName: string;
  availableStock: number;
  deadStock: number;
  capacity: number;
  ullage?: number;
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
  executiveProductWiseChartRows: ExecutiveRow[];
  getProductTheme: (index: number, productName?: string) => ProductTheme;
  isRefreshing: boolean;
  isSupplyHubStockMetricsLoading: boolean;
  selectedPlantLabel: string;
  isStockUtilizationSheetOpen: boolean;
  setIsStockUtilizationSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  layout?: 'compact' | 'fullWidth';
  className?: string;
  style?: React.CSSProperties;
};

function formatKl(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function StockUtilizationBar({
  item,
  index,
  getProductTheme,
}: {
  item: ExecutiveRow;
  index: number;
  getProductTheme: (index: number, productName?: string) => ProductTheme;
}) {
  const productTheme = getProductTheme(index, item.productName);
  const usedTotalPercent = item.availablePercent + item.deadPercent;
  const normalizeFactor = usedTotalPercent > 100 ? 100 / usedTotalPercent : 1;
  const availableSegment = Math.max(0, item.availablePercent * normalizeFactor);
  const deadSegment = Math.max(0, item.deadPercent * normalizeFactor);
  const remainingSegment = Math.max(0, 100 - availableSegment - deadSegment);
  const fillPercent = Math.round(item.deadPercent + item.availablePercent);

  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <div className="mb-0 flex items-center justify-between text-[10px] font-semibold text-black sm:text-[11px]">
        <span className="truncate text-black">{normalizeProductKey(item.productName)}</span>
        <span className="shrink-0 text-black">{fillPercent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded bg-gray-200">
        <div className="flex h-full w-full">
          <div className={`h-full ${productTheme.barBg}`} style={{ width: `${deadSegment}%` }} />
          <div className={`h-full ${productTheme.barBg}`} style={{ width: `${availableSegment}%` }} />
          <div className="h-full bg-gray-300" style={{ width: `${remainingSegment}%` }} />
        </div>
      </div>
      <div className="mt-0 grid w-full grid-cols-3 gap-1 text-[9px] text-gray-600 sm:text-[10px]">
        <span className="truncate text-left font-medium">{formatKl(item.deadStock)}</span>
        <span className="truncate text-center font-medium text-black">{formatKl(item.availableStock)}</span>
        <span className="truncate text-right font-medium">{formatKl(item.capacity)}</span>
      </div>
    </div>
  );
}

function normalizeProductKey(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const key = raw.toUpperCase();
  if (key === 'BIODIESEL' || key === 'BD') return 'BD';
  if (key === 'ETHANOL' || key === 'ETH') return 'ETH';
  return key;
}

export default function TASSupplyChainStockUtilizationView({
  executiveProductWiseChartRows,
  getProductTheme,
  isRefreshing,
  isSupplyHubStockMetricsLoading,
  selectedPlantLabel,
  isStockUtilizationSheetOpen,
  setIsStockUtilizationSheetOpen,
  layout = 'compact',
  className,
  style,
}: Props) {
  const formatProductLabel = (value: string) => normalizeProductKey(value);

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

  return (
    <>
      <div
        className={`flex min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white ${className ?? ''}`}
        style={style}
      >
        <div className={`shrink-0 bg-blue-50 ${layout === 'fullWidth' ? 'px-2 py-2' : 'px-1.5 py-1.5'}`}>
          <div className="flex items-center justify-between gap-1.5">
            <div className="text-sm font-semibold leading-tight text-blue-900">Stock Utilization View</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 shrink-0 gap-1 px-1 text-[9px] font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-800"
              onClick={() => setIsStockUtilizationSheetOpen(true)}
              disabled={
                isRefreshing || isSupplyHubStockMetricsLoading || !orderedExecutiveProductWiseChartRows.length
              }
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className={layout === 'fullWidth' ? 'px-2 py-2' : 'relative min-h-0 flex-1 overflow-hidden'}>
          {layout === 'fullWidth' ? (
            isRefreshing || isSupplyHubStockMetricsLoading ? (
              <div className="flex min-h-[5rem] items-center justify-center">
                <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            ) : !orderedExecutiveProductWiseChartRows.length ? (
              <div className="py-4 text-center text-[11px] text-gray-500">No product trend data available</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {orderedExecutiveProductWiseChartRows.map((item, index) => (
                  <StockUtilizationBar
                    key={item.productName}
                    item={item}
                    index={index}
                    getProductTheme={getProductTheme}
                  />
                ))}
              </div>
            )
          ) : (
          <div
            className="tas-stock-utilization-scroll tas-stock-utilization-scroll-custom absolute inset-0 space-y-0.5 overflow-y-auto overflow-x-hidden px-1.5 pb-0.5"
            style={{ scrollbarGutter: 'auto' }}
          >
            {isRefreshing || isSupplyHubStockMetricsLoading ? (
              <div className="flex min-h-[1.75rem] flex-1 items-center justify-center">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-500" />
              </div>
            ) : (
              <>
                {orderedExecutiveProductWiseChartRows.map((item, index) => (
                  <div key={item.productName}>
                    <div className="mb-0 flex items-center justify-between text-[10px] font-semibold text-black">
                      <span className="truncate text-black">{formatProductLabel(item.productName)}</span>
                      <span className="shrink-0 text-black">{Math.round(item.deadPercent + item.availablePercent)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded bg-gray-200">
                      {(() => {
                        const productTheme = getProductTheme(index, item.productName);
                        const usedTotalPercent = item.availablePercent + item.deadPercent;
                        const normalizeFactor = usedTotalPercent > 100 ? 100 / usedTotalPercent : 1;
                        const availableSegment = Math.max(0, item.availablePercent * normalizeFactor);
                        const deadSegment = Math.max(0, item.deadPercent * normalizeFactor);
                        const remainingSegment = Math.max(0, 100 - availableSegment - deadSegment);
                        return (
                          <div className="flex h-full w-full">
                            <div className={`h-full ${productTheme.barBg}`} style={{ width: `${deadSegment}%` }} />
                            <div className={`h-full ${productTheme.barBg}`} style={{ width: `${availableSegment}%` }} />
                            <div className="h-full bg-gray-300" style={{ width: `${remainingSegment}%` }} />
                          </div>
                        );
                      })()}
                    </div>
                    <div className="mt-0 grid w-full grid-cols-3 gap-1 text-[9px] text-gray-600">
                      <span className="truncate text-left font-medium">
                        {item.deadStock.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                      <span className="truncate text-center font-medium text-black">
                        {item.availableStock.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                      <span className="truncate text-right font-medium">
                        {item.capacity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
                {!orderedExecutiveProductWiseChartRows.length ? (
                  <div className="py-2 text-center text-[10px] text-gray-500">No product trend data available</div>
                ) : null}
              </>
            )}
          </div>
          )}
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
      <Sheet open={isStockUtilizationSheetOpen} onOpenChange={setIsStockUtilizationSheetOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-[68vw] flex-col gap-0 border-l border-gray-200 bg-gray-50 p-0 shadow-xl sm:w-[60vw] sm:max-w-[700px] lg:w-[52vw] lg:max-w-[760px] [&>button]:right-3 [&>button]:top-3 [&>button]:h-7 [&>button]:w-7 [&>button]:p-0 [&>button]:inline-flex [&>button]:items-center [&>button]:justify-center [&>button]:border-0 [&>button]:outline-none [&>button]:ring-0 [&>button]:shadow-none [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button_svg]:h-5 [&>button_svg]:w-5"
        >
          <SheetHeader className="border-b border-gray-200 bg-white px-5 py-4 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="text-2xl font-bold text-slate-900">Live Tank Monitoring</SheetTitle>
              <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-900">
                {selectedPlantLabel}
              </div>
              <SheetDescription className="sr-only">
                Expanded stock utilization details showing live tank monitoring cards.
              </SheetDescription>
            </div>
          </SheetHeader>
          <div className="tas-stock-utilization-scroll min-h-0 flex-1 !overflow-y-scroll p-4 pr-3">
            {isRefreshing || isSupplyHubStockMetricsLoading ? (
              <div className="flex h-full items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            ) : !orderedExecutiveProductWiseChartRows.length ? (
              <div className="py-6 text-center text-sm text-gray-500">No stock utilization details available</div>
            ) : (
              <div className="mx-auto grid w-full max-w-[720px] grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                {orderedExecutiveProductWiseChartRows.map((item, index) => {
                  const currentLevel = Math.max(0, item.availableStock + item.deadStock);
                  const fillPercent = Math.max(0, Math.min(100, item.availablePercent + item.deadPercent));
                  const productTheme = getProductTheme(index, item.productName);
                  return (
                    <div
                      key={`sheet-${item.productName}`}
                      className="mx-auto w-full max-w-[205px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${productTheme.badgeBg}`}
                          >
                            <Fuel className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold uppercase text-slate-900">
                              {formatProductLabel(item.productName)}
                            </div>
                            <div className="text-sm font-semibold text-gray-500">
                              {item.capacity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}L
                            </div>
                          </div>
                        </div>
                        <div className={`font-bold leading-none ${productTheme.textColor}`}>{fillPercent.toFixed(1)}%</div>
                      </div>
                      <div className="mx-0.5 mb-2 relative h-20 overflow-hidden rounded-b-[16px] rounded-t-sm border-[3px] border-gray-300 bg-white">
                        <div
                          className={`absolute bottom-0 left-0 right-0 overflow-hidden transition-[height] duration-300 ${productTheme.barBg}`}
                          style={{ height: `${fillPercent}%` }}
                        >
                          <div className="tank-wave absolute left-0 top-0 h-3 w-[200%]">
                            <svg viewBox="0 0 200 24" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
                              <path
                                d="M0,0 H200 V8 C184,17 166,17 150,8 C134,-1 116,-1 100,8 C84,17 66,17 50,8 C34,-1 16,-1 0,8 Z"
                                fill="#ffffff"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className={`absolute inset-x-0 bottom-0 h-1.5 ${productTheme.barLightBg}`} aria-hidden />
                      </div>
                      <div className="space-y-1">
                        <div className="pb-1">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10px] font-semibold text-slate-700">Current Level</span>
                            <span className="text-sm font-bold text-slate-900">
                              {currentLevel.toLocaleString('en-IN', { maximumFractionDigits: 2 })}L
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                            <div className={`h-full rounded-full ${productTheme.barBg}`} style={{ width: `${fillPercent}%` }} />
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-semibold text-slate-700">Total Capacity</span>
                          <span className="text-sm font-bold text-slate-900">
                            {item.capacity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}L
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
