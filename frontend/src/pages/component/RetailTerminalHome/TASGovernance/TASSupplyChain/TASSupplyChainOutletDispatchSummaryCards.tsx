import React, { useEffect, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
// import { Activity, AlertTriangle, CircleOff, LayoutGrid } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

export type OutletDispatchSummaryFilter = 'all' | 'active' | 'mixed' | 'inactive';

// type SummaryCardConfig = {
//   id: OutletDispatchSummaryFilter;
//   title: string;
//   value: string;
//   selectedClass: string;
//   idleClass: string;
//   valueClass: string;
//   Icon: React.ComponentType<{ className?: string }>;
// };

type Props = {
  totalRoValue: string;
  activeRoValue: string;
  partialDryOutRoValue: string;
  dryOutRoValue: string;
  isRoCountLoading: boolean;
  isRefreshing: boolean;
  outletDispatchFilter: string;
  onOutletDispatchFilterChange: (filter: OutletDispatchSummaryFilter) => void;
  className?: string;
};

// function buildOutletDispatchSummaryCards(
//   totalRoValue: string,
//   activeRoValue: string,
//   partialDryOutRoValue: string,
//   dryOutRoValue: string,
//   isRoCountLoading: boolean,
//   isRefreshing: boolean
// ): SummaryCardConfig[] {
//   const showPlaceholder = isRoCountLoading || isRefreshing;
//   const display = (v: string) => (showPlaceholder ? '--' : v);
//
//   return [
//     {
//       id: 'all',
//       title: 'Total',
//       value: display(totalRoValue),
//       selectedClass: 'border-slate-400 bg-slate-50 ring-1 ring-slate-200',
//       idleClass: 'border-slate-300 bg-slate-50',
//       valueClass: 'text-slate-900',
//       Icon: LayoutGrid,
//     },
//     {
//       id: 'mixed',
//       title: 'Partial DryOut',
//       value: display(partialDryOutRoValue),
//       selectedClass: 'border-amber-300 bg-amber-50 ring-1 ring-amber-200',
//       idleClass: 'border-amber-200 bg-amber-50/60',
//       valueClass: 'text-amber-800',
//       Icon: AlertTriangle,
//     },
//     {
//       id: 'active',
//       title: 'Active',
//       value: display(activeRoValue),
//       selectedClass: 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200',
//       idleClass: 'border-emerald-200 bg-emerald-50/60',
//       valueClass: 'text-emerald-700',
//       Icon: Activity,
//     },
//     {
//       id: 'inactive',
//       title: 'DryOut',
//       value: display(dryOutRoValue),
//       selectedClass: 'border-rose-300 bg-rose-50 ring-1 ring-rose-200',
//       idleClass: 'border-rose-200 bg-rose-50/60',
//       valueClass: 'text-rose-800',
//       Icon: CircleOff,
//     },
//   ];
// }

/** Parse a localized numeric string ("1,234" or "--") into a finite number; non-numeric yields 0. */
function parseNumericValue(value: string): number {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function TASSupplyChainOutletDispatchSummaryCards({
  totalRoValue,
  activeRoValue,
  partialDryOutRoValue,
  dryOutRoValue,
  isRoCountLoading,
  isRefreshing,
  outletDispatchFilter,
  onOutletDispatchFilterChange,
  className = '',
}: Props) {
  // const cards = buildOutletDispatchSummaryCards(
  //   totalRoValue,
  //   activeRoValue,
  //   partialDryOutRoValue,
  //   dryOutRoValue,
  //   isRoCountLoading,
  //   isRefreshing
  // );

  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const seriesRef = useRef<am5percent.PieSeries | null>(null);
  const centerLabelRef = useRef<am5.Label | null>(null);
  const onFilterChangeRef = useRef(onOutletDispatchFilterChange);

  useEffect(() => {
    onFilterChangeRef.current = onOutletDispatchFilterChange;
  }, [onOutletDispatchFilterChange]);

  const showPlaceholder = isRoCountLoading || isRefreshing;
  const totalValueSum = useMemo(
    () =>
      parseNumericValue(activeRoValue) +
      parseNumericValue(partialDryOutRoValue) +
      parseNumericValue(dryOutRoValue),
    [activeRoValue, partialDryOutRoValue, dryOutRoValue]
  );
  const hasChartData = totalValueSum > 0;

  const chartData = useMemo(() => {
    return [
      {
        id: 'active' as OutletDispatchSummaryFilter,
        category: 'Active',
        value: parseNumericValue(activeRoValue),
        color: '#10b981',
      },
      {
        id: 'mixed' as OutletDispatchSummaryFilter,
        category: 'Partial\nDryOut',
        value: parseNumericValue(partialDryOutRoValue),
        color: '#f59e0b',
      },
      {
        id: 'inactive' as OutletDispatchSummaryFilter,
        category: 'DryOut',
        value: parseNumericValue(dryOutRoValue),
        color: '#f43f5e',
      },
    ].filter((item) => item.value > 0);
  }, [activeRoValue, partialDryOutRoValue, dryOutRoValue]);

  const totalDisplay = showPlaceholder ? '--' : (totalRoValue || '0');

  useEffect(() => {
    if (!chartRef.current) return;

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
    if (root._logo) root._logo.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        radius: am5.percent(85),
        innerRadius: am5.percent(55),
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 5,
        paddingRight: 5,
      })
    );

    chart.seriesContainer.setAll({
      centerX: am5.percent(50),
      centerY: am5.percent(50),
      x: am5.percent(50),
      y: am5.percent(50),
    });

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: 'value',
        categoryField: 'category',
        alignLabels: true,
        calculateAggregates: true,
        legendLabelText: '{category}',
        legendValueText: '{value}',
      })
    );
    seriesRef.current = series;

    series.slices.template.setAll({
      stroke: am5.color(0xffffff),
      strokeWidth: 2,
      cornerRadius: 2,
      tooltipText: '{category}: {value} ({valuePercentTotal.formatNumber("#.0")}%)',
      cursorOverStyle: 'default',
    });

    series.slices.template.adapters.add('fill', (_fill, target) => {
      const dataItem = target.dataItem as am5.DataItem<am5percent.IPieSeriesDataItem> | undefined;
      const ctx = dataItem?.dataContext as { color?: string } | undefined;
      return ctx?.color ? am5.color(ctx.color) : am5.color(0x94a3b8);
    });

    series.labels.template.setAll({
      textType: 'regular',
      fontSize: 9,
      fontWeight: '700',
      fill: am5.color(0x475569),
      text: '{category}\n{value}',
      oversizedBehavior: 'truncate',
      maxWidth: 80,
      textAlign: 'center',
      centerX: 0,
      centerY: 0,
      paddingTop: 4,
      paddingBottom: 4,
      paddingLeft: 0,
      paddingRight: 0,
      visible: true,
    });

    series.ticks.template.setAll({
      visible: true,
      strokeOpacity: 0.8,
      stroke: am5.color(0x64748b),
      strokeWidth: 1,
      length: 8,
    });

    series.slices.template.events.on('click', (ev) => {
      void ev;
      // Interaction temporarily disabled.
    });

    const centerLabel = chart.seriesContainer.children.push(
      am5.Label.new(root, {
        textAlign: 'center',
        centerX: am5.p50,
        centerY: am5.p50,
        text: `[bold fontSize:12px #475569]TOTAL[/]\n[bold fontSize:20px #0f172a]${totalDisplay}[/]`,
      })
    );
    centerLabelRef.current = centerLabel;

    series.appear(800, 100);
    chart.appear(800, 100);

    return () => {
      root.dispose();
      rootRef.current = null;
      seriesRef.current = null;
      centerLabelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.data.setAll(chartData);
  }, [chartData]);

  useEffect(() => {
    if (!centerLabelRef.current) return;
    centerLabelRef.current.set(
      'text',
      `[bold fontSize:12px #475569]TOTAL[/]\n[bold fontSize:20px #0f172a]${totalDisplay}[/]`
    );
  }, [totalDisplay]);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.slices.each((slice) => {
      const dataItem = slice.dataItem as am5.DataItem<am5percent.IPieSeriesDataItem> | undefined;
      const ctx = dataItem?.dataContext as { id?: OutletDispatchSummaryFilter } | undefined;
      const isSelected = ctx?.id === outletDispatchFilter;
      slice.set('strokeWidth', isSelected ? 3 : 2);
      slice.set('stroke', am5.color(isSelected ? 0x0f172a : 0xffffff));
    });
  }, [outletDispatchFilter, chartData]);

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm ${className}`.trim()}
    >
      <div className="shrink-0 bg-blue-50 px-1.5 py-1.5">
        <div className="flex h-5 items-center">
          <div className="text-sm font-semibold leading-tight text-blue-900">Outlet Dispatch View</div>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-stretch px-2 py-1">
        <div ref={chartRef} className="h-full w-full" />
        {showPlaceholder ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-500" />
          </div>
        ) : !hasChartData ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-[11px] font-semibold text-slate-500">
            No dispatch data available
          </div>
        ) : null}
      </div>
    
      {/*
      <div
        className={`grid h-full min-h-0 w-full grid-cols-2 grid-rows-2 gap-1 auto-rows-fr lg:grid-cols-4 lg:grid-rows-1 ${className}`.trim()}
      >
        {cards.map((card) => {
          const isSelected = outletDispatchFilter === card.id;
          const Icon = card.Icon;
          return (
            <div
              key={card.id}
              className={`flex h-full min-h-0 items-start rounded-xl border px-2 py-1.5 text-left shadow-sm sm:px-2.5 sm:py-2 ${
                isSelected ? card.selectedClass : card.idleClass
              }`}
            >
              <div className="flex w-full min-w-0 items-start justify-between gap-1.5 sm:gap-2">
                <div className="min-w-0 flex-1 text-left">
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{card.title}</div>
                  <div className={`mt-1.5 truncate text-xl font-bold leading-tight tabular-nums ${card.valueClass}`}>
                    {card.value}
                  </div>
                </div>
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-lg ${
                    card.id === 'all'
                      ? 'bg-slate-100 text-slate-700'
                      : card.id === 'mixed'
                        ? 'bg-amber-100 text-amber-700'
                        : card.id === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      */}
    </div>
  );
}
