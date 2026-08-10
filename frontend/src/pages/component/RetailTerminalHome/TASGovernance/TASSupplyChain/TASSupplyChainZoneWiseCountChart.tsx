/**
 * Zone-wise RO counts as an amCharts 5 XY stacked column chart:
 * https://www.amcharts.com/docs/v5/charts/xy-chart/series/column-series/#Stacking
 * — multiple `ColumnSeries` with `stacked: true`, shared `CategoryAxis` + `ValueAxis`.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

export type ZoneWiseStackedBarRow = {
  zone: string;
  active: number;
  mixed: number;
  inactive: number;
};

const ACTIVE_COLOR = '#10b981';
const MIXED_COLOR = '#f59e0b';
const INACTIVE_COLOR = '#f43f5e';

const SCROLLBAR_HEIGHT = 8;
const SCROLLBAR_GRIP_W = 8;
const SCROLLBAR_GRIP_H = 10;

type Props = {
  rows: ZoneWiseStackedBarRow[];
  isLoading: boolean;
  isRefreshing: boolean;
  /** Text inside the title parentheses, e.g. "All zones" or "NCZ" → title `RO status (All zones)`. */
  scopeLabel?: string;
  className?: string;
};

type ChartApi = {
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>;
  sActive: am5xy.ColumnSeries;
  sMixed: am5xy.ColumnSeries;
  sInactive: am5xy.ColumnSeries;
};

export default function TASSupplyChainZoneWiseCountChart({
  rows,
  isLoading,
  isRefreshing,
  scopeLabel,
  className = '',
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const chartApiRef = useRef<ChartApi | null>(null);

  const showPlaceholder = isLoading || isRefreshing;
  const hasChartData = useMemo(
    () => rows.some((r) => (r.active || 0) + (r.mixed || 0) + (r.inactive || 0) > 0),
    [rows]
  );

  useEffect(() => {
    if (!chartRef.current) return;

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
    if (root._logo) root._logo.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: 'panX',
        wheelY: 'none',
        pinchZoomX: true,
        paddingLeft: 4,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
        layout: root.verticalLayout,
      })
    );

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 18,
      strokeOpacity: 0.25,
      strokeWidth: 1,
    });
    xRenderer.labels.template.setAll({
      fontSize: 9,
      fontWeight: '600',
      fill: am5.color(0x475569),
      oversizedBehavior: 'truncate',
      maxWidth: 56,
      rotation: 0,
      centerX: am5.p50,
      centerY: am5.p50,
    });
    xRenderer.grid.template.setAll({
      strokeOpacity: 0.12,
      stroke: am5.color(0xe2e8f0),
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'zone',
        renderer: xRenderer,
      })
    );

    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.25,
      strokeWidth: 1,
    });
    yRenderer.labels.template.setAll({
      fontSize: 9,
      fontWeight: '500',
      fill: am5.color(0x64748b),
    });
    yRenderer.grid.template.setAll({
      strokeOpacity: 0.12,
      stroke: am5.color(0xe2e8f0),
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        extraMax: 0.12,
        renderer: yRenderer,
      })
    );

    const makeStackedSeries = (name: string, field: keyof Pick<ZoneWiseStackedBarRow, 'active' | 'mixed' | 'inactive'>, color: string) => {
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name,
          stacked: true,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: 'zone',
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: 'vertical',
            labelText: `Count: {valueY.formatNumber("#,###")}`,
          }),
        })
      );
      series.columns.template.setAll({
        fill: am5.color(color),
        stroke: am5.color(0xffffff),
        strokeWidth: 1,
        strokeOpacity: 1,
        width: am5.percent(80),
        cornerRadiusTL: 2,
        cornerRadiusTR: 2,
      });
      series.columns.template.states.create('hover', {
        fillOpacity: 0.92,
        strokeOpacity: 0.85,
        strokeWidth: 1.5,
      });
      series.get('tooltip')?.adapters.add('visible', (visible, target) => {
        const dataItem = target.dataItem as am5.DataItem<am5xy.IColumnSeriesDataItem> | undefined;
        const vy = dataItem?.get('valueY');
        if (vy === 0 || vy === null || vy === undefined) return false;
        return visible;
      });
      series.get('tooltip')?.label.setAll({
        fontSize: 10,
        fontWeight: '500',
      });
      return series;
    };

    const sActive = makeStackedSeries('Active', 'active', ACTIVE_COLOR);
    const sMixed = makeStackedSeries('Partial DryOut', 'mixed', MIXED_COLOR);
    const sInactive = makeStackedSeries('DryOut', 'inactive', INACTIVE_COLOR);

    chart.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        behavior: 'zoomX',
        xAxis,
        yAxis,
      })
    );

    const scrollbarX = am5.Scrollbar.new(root, { orientation: 'horizontal' });
    scrollbarX.setAll({
      height: SCROLLBAR_HEIGHT,
      minHeight: SCROLLBAR_HEIGHT,
      marginTop: 2,
      marginBottom: 0,
    });
    [scrollbarX.startGrip, scrollbarX.endGrip].forEach((grip) => {
      grip.setAll({
        width: SCROLLBAR_GRIP_W,
        height: SCROLLBAR_GRIP_H,
      });
      grip.get('icon')?.setAll({ forceHidden: true });
    });
    chart.set('scrollbarX', scrollbarX);
    chart.bottomAxesContainer.setAll({
      paddingTop: 0,
      paddingBottom: 0,
    });
    chart.bottomAxesContainer.children.push(scrollbarX);

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        layout: root.horizontalLayout,
        marginTop: 2,
        marginBottom: 0,
      })
    );
    legend.data.setAll([sActive, sMixed, sInactive]);
    legend.itemContainers.template.setAll({
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 4,
      paddingRight: 4,
      marginLeft: 0,
      marginRight: 0,
    });
    legend.labels.template.setAll({
      fontSize: 9,
      fill: am5.color(0x334155),
      paddingLeft: 0,
      paddingRight: 0,
      marginLeft: 0,
      marginRight: 0,
    });
    legend.markers.template.setAll({
      width: 10,
      height: 10,
      marginLeft: 0,
      marginRight: 4,
    });
    legend.valueLabels.template.setAll({
      visible: false,
      forceHidden: true,
    });

    chartApiRef.current = { xAxis, sActive, sMixed, sInactive };

    chart.appear(600, 100);

    return () => {
      chartApiRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = chartApiRef.current;
    if (!api) return;
    api.xAxis.data.setAll(rows);
    api.sActive.data.setAll(rows);
    api.sMixed.data.setAll(rows);
    api.sInactive.data.setAll(rows);

    const rotate = rows.length > 6;
    api.xAxis.get('renderer').labels.template.setAll({
      rotation: rotate ? -35 : 0,
      centerX: rotate ? am5.p100 : am5.p50,
      centerY: rotate ? am5.p50 : am5.p50,
    });
  }, [rows]);

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm ${className}`.trim()}
    >
      <div className="shrink-0 bg-blue-50 px-1.5 py-1.5">
        <div className="flex min-h-5 items-center leading-tight">
          <div className="truncate text-sm font-semibold text-blue-900">
            RO status{scopeLabel ? ` (${scopeLabel})` : ''}
          </div>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-stretch px-1 py-0.5">
        <div ref={chartRef} className="h-full w-full min-h-[168px]" />
        {showPlaceholder ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-500" />
          </div>
        ) : !hasChartData ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-[11px] font-semibold text-slate-500">
            No zone data available
          </div>
        ) : null}
      </div>
    </div>
  );
}
