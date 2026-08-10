import React, { useEffect, useMemo, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

export type DayWiseTrendDetail = {
  product: string;
  date_time: string;
  dispatch: number;
  reciept: number;
  available_stock: number;
  dead_stock: number;
  capacity: number;
  ullage: number;
};

type TASSupplyChainChartProps = {
  selectedDetail: DayWiseTrendDetail | null;
  isDayWiseTrendLoading: boolean;
};

export default function TASSupplyChainChart({ selectedDetail, isDayWiseTrendLoading }: TASSupplyChainChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartRootRef = useRef<am5.Root | null>(null);

  const legendItems = useMemo(
    () => [
      { key: 'Dispatch', color: '#2563eb' },
      { key: 'Reciept', color: '#16a34a' },
      { key: 'Available Stock', color: '#f59e0b' },
      { key: 'Dead Stock', color: '#ef4444' },
      { key: 'Capacity', color: '#8b5cf6' },
      { key: 'Ullage', color: '#06b6d4' },
    ],
    []
  );

  useEffect(() => {
    const chartEl = chartRef.current;
    if (!chartEl || !selectedDetail) return;

    if (chartRootRef.current) {
      chartRootRef.current.dispose();
      chartRootRef.current = null;
    }

    const root = am5.Root.new(chartEl);
    chartRootRef.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: 'panX',
        wheelY: 'zoomX',
        pinchZoomX: true,
        layout: root.verticalLayout,
        paddingLeft: 4,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
      })
    );

    const breakdownRows = [
      { metric: 'Dispatch', value: selectedDetail.dispatch, color: '#2563eb' },
      { metric: 'Reciept', value: selectedDetail.reciept, color: '#16a34a' },
      { metric: 'Available Stock', value: selectedDetail.available_stock, color: '#f59e0b' },
      { metric: 'Dead Stock', value: selectedDetail.dead_stock, color: '#ef4444' },
      { metric: 'Capacity', value: selectedDetail.capacity, color: '#8b5cf6' },
      { metric: 'Ullage', value: selectedDetail.ullage, color: '#06b6d4' },
    ];
    const initialMetricWindowFraction = breakdownRows.length > 4 ? 4 / breakdownRows.length : 1;

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'metric',
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 25,
          cellStartLocation: 0.12,
          cellEndLocation: 0.88,
        }),
      })
    );
    xAxis.data.setAll(breakdownRows);
    xAxis.events.once('datavalidated', () => {
      xAxis.zoom(0, initialMetricWindowFraction);
    });
    xAxis.get('renderer').labels.template.setAll({
      fontSize: 11,
      fill: am5.color('#374151'),
    });
    xAxis.get('renderer').grid.template.setAll({ visible: false });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: '#,###.##',
        extraMax: 0.2,
      })
    );
    yAxis.get('renderer').grid.template.setAll({ visible: false });
    yAxis.get('renderer').labels.template.setAll({
      fontSize: 11,
      fill: am5.color('#374151'),
    });

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Value',
        xAxis,
        yAxis,
        valueYField: 'value',
        categoryXField: 'metric',
        clustered: true,
        tooltip: am5.Tooltip.new(root, {
          labelText: '{categoryX}\n{valueY}',
        }),
      })
    );
    series.get('tooltip')?.setAll({
      paddingTop: 4,
      paddingBottom: 4,
      paddingLeft: 6,
      paddingRight: 6,
    });
    series.get('tooltip')?.label.setAll({
      fontSize: 10,
      fontWeight: '500',
    });
    series.columns.template.adapters.add('fill', (_fill, target) => {
      const data = target.dataItem?.dataContext as { color?: string } | undefined;
      return am5.color(data?.color ?? '#2563eb');
    });
    series.columns.template.adapters.add('stroke', (_stroke, target) => {
      const data = target.dataItem?.dataContext as { color?: string } | undefined;
      return am5.color(data?.color ?? '#2563eb');
    });
    series.columns.template.setAll({
      strokeOpacity: 0,
      strokeWidth: 0,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 0,
      cornerRadiusBR: 0,
      tooltipY: 0,
    });
    series.bullets.push(() =>
      am5.Bullet.new(root, {
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: '{valueY}',
          populateText: true,
          centerX: am5.p50,
          centerY: am5.p100,
          dy: -4,
          fontSize: 9,
          rotation: -45,
          fontWeight: '700',
          fill: am5.color(0x000000),
        }),
      })
    );
    series.data.setAll(breakdownRows);
    series.appear(800);

    chart.set('cursor', am5xy.XYCursor.new(root, { behavior: 'zoomX', xAxis }));
    const breakdownScrollbarX = am5.Scrollbar.new(root, {
      orientation: 'horizontal',
    });
    chart.set('scrollbarX', breakdownScrollbarX);
    breakdownScrollbarX.setAll({
      start: 0,
      end: initialMetricWindowFraction,
    });
    chart.bottomAxesContainer.children.moveValue(breakdownScrollbarX);
    chart.appear(800, 100);

    return () => {
      if (chartRootRef.current) {
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
    };
  }, [selectedDetail]);

  useEffect(() => {
    return () => {
      if (chartRootRef.current) {
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
    };
  }, []);

  return (
    <div className="px-2 py-2">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Selected Bar Breakdown</h3>
        <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
          {selectedDetail ? `${selectedDetail.product} | ${selectedDetail.date_time}` : 'Select a bar'}
        </span>
      </div>
      <div className="relative h-[230px] w-full bg-white">
        <div ref={chartRef} className="h-full w-full" />
        {!selectedDetail && !isDayWiseTrendLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            Select a bar to view values
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {legendItems.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span>{item.key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
