import React, { useEffect, useMemo, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

type DaywiseTrendInputRow = {
  date_time?: string;
  day?: string;
  date?: string;
  product?: string;
  product_name?: string;
  product_grp?: string;
  available_stock?: number | string;
  availableStock?: number | string;
  ullage?: number | string;
};

type DaywiseLineRow = {
  day: string;
  availableStock: number;
  ullage: number;
};

type Props = {
  rows: DaywiseTrendInputRow[];
  isLoading: boolean;
  selectedProduct: string;
  compact?: boolean;
  legendPosition?: 'top' | 'bottom' | 'none';
};

const AVAILABLE_STOCK_COLOR = '#f59e0b';
const ULLAGE_COLOR = '#06b6d4';
const VISIBLE_DATE_COUNT = 7;
const HORIZONTAL_SCROLLBAR_HEIGHT = 8;
const SCROLLBAR_GRIP_WIDTH = 8;
const SCROLLBAR_GRIP_HEIGHT = 10;
const CHART_BOTTOM_PADDING = 2;
const SCROLLBAR_MARGIN_TOP = 0;

function normalizeDayLabel(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const firstPart = raw.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(firstPart)) return firstPart.slice(0, 10);
  const parsed = new Date(raw.includes(' ') ? raw.replace(' ', 'T') : raw);
  if (!Number.isFinite(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
}

function parseNumberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getProductDisplayName(product: string): string {
  const key = product.trim().toUpperCase();
  if (key === 'ETHANOL') return 'ETH';
  if (key === 'BIODIESEL') return 'BD';
  return product;
}

export default function TASSupplyChainDaywiseStockUllageLineChart({
  rows,
  isLoading,
  selectedProduct,
  compact = false,
  legendPosition = 'bottom',
}: Props) {
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const chartRootRef = useRef<am5.Root | null>(null);

  const normalizedRows = useMemo(() => {
    return rows
      .map((row) => {
        const day = normalizeDayLabel(row.date_time ?? row.day ?? row.date);
        const productRaw = String(row.product ?? row.product_name ?? row.product_grp ?? 'Unknown').trim() || 'Unknown';
        const product = getProductDisplayName(productRaw);
        const availableStock = parseNumberValue(row.available_stock ?? row.availableStock);
        const ullage = parseNumberValue(row.ullage);
        return { day, product, availableStock, ullage };
      })
      .filter((row) => row.day !== '-');
  }, [rows]);

  const chartData = useMemo(() => {
    if (!selectedProduct) return [] as DaywiseLineRow[];
    const grouped = new Map<string, DaywiseLineRow>();

    normalizedRows.forEach((item) => {
      if (item.product !== selectedProduct) return;
      const previous = grouped.get(item.day);
      if (!previous) {
        grouped.set(item.day, {
          day: item.day,
          availableStock: item.availableStock,
          ullage: item.ullage,
        });
        return;
      }
      grouped.set(item.day, {
        day: previous.day,
        availableStock: previous.availableStock + item.availableStock,
        ullage: previous.ullage + item.ullage,
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [normalizedRows, selectedProduct]);

  useEffect(() => {
    if (!chartDivRef.current) return;

    if (chartRootRef.current) {
      chartRootRef.current.dispose();
      chartRootRef.current = null;
    }

    if (isLoading || chartData.length === 0) return;

    const root = am5.Root.new(chartDivRef.current);
    chartRootRef.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'panX',
        wheelY: 'zoomX',
        pinchZoomX: true,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 16,
        paddingBottom: CHART_BOTTOM_PADDING,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'day',
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 40,
          strokeOpacity: 0.3,
          strokeWidth: 1,
        }),
      })
    );
    xAxis.data.setAll(chartData);
    if (chartData.length > VISIBLE_DATE_COUNT) {
      xAxis.events.once('datavalidated', () => {
        xAxis.zoomToIndexes(0, VISIBLE_DATE_COUNT - 1);
      });
    }
    const shouldRotateXAxisLabels = chartData.length > VISIBLE_DATE_COUNT;
    xAxis.get('renderer').labels.template.setAll({
      fontSize: 9,
      fontWeight: '500',
      fill: am5.color('#666666'),
      paddingTop: shouldRotateXAxisLabels ? 12 : 8,
      paddingBottom: 4,
      rotation: shouldRotateXAxisLabels ? -45 : 0,
      centerX: shouldRotateXAxisLabels ? am5.p100 : am5.p50,
      centerY: shouldRotateXAxisLabels ? am5.p50 : am5.p50,
    });
    xAxis.get('renderer').grid.template.setAll({
      strokeOpacity: 0.15,
      stroke: am5.color('#e5e7eb'),
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        // Keep enough top space so labels above points remain fully visible.
        extraMax: 0.25,
        renderer: am5xy.AxisRendererY.new(root, {
          strokeOpacity: 0.3,
          strokeWidth: 1,
        }),
      })
    );
    yAxis.get('renderer').labels.template.setAll({
      fontSize: 9,
      fontWeight: '500',
      fill: am5.color('#666666'),
      paddingRight: 8,
      paddingLeft: 4,
    });
    yAxis.get('renderer').grid.template.setAll({
      strokeOpacity: 0.15,
      stroke: am5.color('#e5e7eb'),
    });

    const makeSeries = (
      name: string,
      field: 'availableStock' | 'ullage',
      color: string,
      labelDx: number,
      labelDy: number,
      placeLabelBelowPoint: boolean
    ) => {
      const seriesColor = am5.color(color);
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: 'day',
          tooltip: am5.Tooltip.new(root, {
            labelText: `Product: ${selectedProduct || '-'}\n${name}: {valueY.formatNumber('#,###.##')}`,
          }),
        })
      );
      series.setAll({
        stroke: seriesColor,
        fill: seriesColor,
      });
      series.get('tooltip')?.setAll({
        paddingTop: 3,
        paddingBottom: 3,
        paddingLeft: 5,
        paddingRight: 5,
      });
      series.get('tooltip')?.label.setAll({
        fontSize: 9,
        fontWeight: '500',
        lineHeight: 1.1,
      });
      series.strokes.template.setAll({
        stroke: seriesColor,
        strokeWidth: 2,
        strokeOpacity: 1,
      });
      series.bullets.push((rootBullet, _series, dataItem) => {
        const ctx = dataItem.dataContext as Record<string, unknown>;
        const vyRaw = ctx[field];
        const valueY =
          typeof vyRaw === 'number' ? vyRaw : vyRaw != null && vyRaw !== '' ? parseFloat(String(vyRaw)) : NaN;
        if (!Number.isFinite(valueY)) return undefined;
        const container = am5.Container.new(rootBullet, {});
        container.children.push(
          am5.Circle.new(rootBullet, {
            radius: 3,
            fill: seriesColor,
            stroke: root.interfaceColors.get('background'),
            strokeWidth: 2,
            strokeOpacity: 1,
          })
        );
        container.children.push(
          am5.Label.new(rootBullet, {
            text: `${valueY.toFixed(2)}`,
            centerX: am5.p50,
            centerY: placeLabelBelowPoint ? am5.p0 : am5.p100,
            populateText: true,
            fontWeight: '600',
            fontSize: 9,
            fill: seriesColor,
            dx: labelDx,
            background: am5.RoundedRectangle.new(rootBullet, {
              fill: am5.color(0xffffff),
              fillOpacity: 0.9,
            }),
            paddingTop: 3,
            paddingBottom: 3,
            paddingLeft: 5,
            paddingRight: 5,
            dy: labelDy,
          })
        );
        return am5.Bullet.new(rootBullet, { sprite: container });
      });
      series.data.setAll(chartData);
      return series;
    };

    makeSeries('Available Stock', 'availableStock', AVAILABLE_STOCK_COLOR, -16, 6, true);
    makeSeries('Ullage', 'ullage', ULLAGE_COLOR, 18, -12, false);

    chart.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        behavior: 'zoomX',
        xAxis,
      })
    );

    const scrollbar = am5.Scrollbar.new(root, { orientation: 'horizontal' });
    scrollbar.setAll({
      height: HORIZONTAL_SCROLLBAR_HEIGHT,
      minHeight: HORIZONTAL_SCROLLBAR_HEIGHT,
      marginTop: SCROLLBAR_MARGIN_TOP,
      marginBottom: 0,
    });
    [scrollbar.startGrip, scrollbar.endGrip].forEach((grip) => {
      grip.setAll({
        width: SCROLLBAR_GRIP_WIDTH,
        height: SCROLLBAR_GRIP_HEIGHT,
      });
      grip.get('icon')?.setAll({ forceHidden: true });
    });
    chart.set('scrollbarX', scrollbar);
    chart.bottomAxesContainer.setAll({
      paddingTop: 0,
      paddingBottom: 0,
    });
    chart.bottomAxesContainer.children.push(scrollbar);
    chart.appear(700, 80);

    return () => {
      if (chartRootRef.current) {
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
    };
  }, [chartData, isLoading]);

  useEffect(() => {
    return () => {
      if (chartRootRef.current) {
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full bg-white">
      {legendPosition === 'top' ? (
        <div className="mb-1 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: AVAILABLE_STOCK_COLOR }} />
            <span>Available Stock</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ULLAGE_COLOR }} />
            <span>Ullage</span>
          </div>
        </div>
      ) : null}
      <div className={`relative w-full ${compact ? 'h-[225px]' : 'h-[300px]'}`}>
        <div ref={chartDivRef} className="h-full w-full" />
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex flex-col items-center text-gray-500">
              <svg className="mb-2 h-6 w-6 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <span className="text-sm">Loading chart data...</span>
            </div>
          </div>
        ) : null}
        {!isLoading && chartData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">No trend data available</div>
        ) : null}
      </div>
      {legendPosition === 'bottom' ? (
        <div className="mt-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: AVAILABLE_STOCK_COLOR }} />
            <span>Available Stock</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ULLAGE_COLOR }} />
            <span>Ullage</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
