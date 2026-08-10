import React, { useEffect, useRef } from 'react';

export interface AgeingAnalysisItem {
  ageing_range: string;
  total_alerts: number;
  locations?: { location_name: string; alert_count: number }[];
}

interface AgeingBarChartProps {
  /** ageing_analysis from API: [{ ageing_range: "1 Day", total_alerts: 28, locations? }, ...] */
  ageing_analysis: AgeingAnalysisItem[];
  /** Called when a bar is clicked (ageing_range or null to clear) */
  onBarClick?: (ageingRange: string | null) => void;
}

/**
 * Bar chart: x-axis = ageing_range (as in response: 1 Day, 2 Days, 3 Days, 4 Days, 5 Days, 6-10 Days, etc.),
 * y-axis = total_alerts (Alert Count).
 */
const AgeingBarChart: React.FC<AgeingBarChartProps> = ({ ageing_analysis, onBarClick }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const data = (ageing_analysis || [])
      .map((item) => ({
        ageing_range: String(item.ageing_range ?? '').trim(),
        total_alerts: Number(item.total_alerts) ?? 0,
      }))
      .sort((a, b) => b.total_alerts - a.total_alerts) // Sort descending by value
      .reverse(); // So highest bar appears at top (first category at bottom in amCharts)
    if (data.length === 0) return;

    let disposed = false;
    const loadChart = async () => {
      const am5 = await import('@amcharts/amcharts5');
      const am5xy = await import('@amcharts/amcharts5/xy');
      const am5themes_Animated = await import('@amcharts/amcharts5/themes/Animated');

      const root = am5.Root.new(chartRef.current!);
      rootRef.current = root;
      root.setThemes([am5themes_Animated.default.new(root)]);
      root._logo?.dispose?.();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: 'none',
        wheelY: 'none',
        layout: root.verticalLayout,
      })
    );

    // Horizontal bar: X = value (total_alerts), Y = category (ageing_range)
    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {}),
        min: 0,
      })
    );
    xAxis.get('renderer').labels.template.setAll({ fontSize: 11 });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'ageing_range',
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 24 }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );
    yAxis.get('renderer').labels.template.setAll({ fontSize: 11 });
    yAxis.data.setAll(data);

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Alert Count',
        xAxis,
        yAxis,
        valueXField: 'total_alerts',
        categoryYField: 'ageing_range',
        tooltip: am5.Tooltip.new(root, {
          labelText: '{categoryY}: {valueX}',
        }),
      })
    );

    // Bar: solid fill only, no outline/stroke, no rounded corners (indigo)
    series.columns.template.setAll({
      fill: am5.color(0x6366f1),
      stroke: am5.color(0x00000000),
      strokeWidth: 0,
      strokeOpacity: 0,
      cornerRadiusTL: 0,
      cornerRadiusTR: 0,
      cornerRadiusBL: 0,
      cornerRadiusBR: 0,
      width: am5.percent(26),
    });
    series.data.setAll(data);

    if (onBarClick) {
      series.columns.template.events.on('click', (ev) => {
        if (disposed) return;
        const dataContext = ev.target.dataItem?.dataContext as { ageing_range?: string } | undefined;
        const range = dataContext?.ageing_range ?? null;
        onBarClick(range);
      });
    }

    chart.set('cursor', am5xy.XYCursor.new(root, {}));
    chart.set('scrollbarY', am5.Scrollbar.new(root, { orientation: 'vertical' }));
    };

    loadChart();
    return () => {
      disposed = true;
      const root = rootRef.current;
      if (root?.dispose) root.dispose();
      rootRef.current = null;
    };
  }, [ageing_analysis, onBarClick]);

  return <div ref={chartRef} className="w-full h-[460px]" />;
};

export default AgeingBarChart;