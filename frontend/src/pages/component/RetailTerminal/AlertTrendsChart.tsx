import React, { useLayoutEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Tooltip } from '@mui/material';

export interface AlertTrendsChartProps {
  monthlyTrends: Array<Record<string, string | number>>;
}

/** Default ApexCharts-style palette for Alert Trends (extended so fewer repeats) */
const TREND_COLORS = [
  '#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#546E7A', '#26a69a', '#D4526E',
  '#2E7D32', '#C62828', '#1565C0', '#6A1B9A', '#EF6C00', '#00838F', '#558B2F', '#AD1457',
  '#283593', '#BF360C', '#00695C', '#4A148C'
];

/** Unique color per Alert Trends series index (no reuse so each series is distinct) */
function getTrendColor(index: number): string {
  if (index < TREND_COLORS.length) return TREND_COLORS[index];
  const hue = (index * 37 + 137) % 360;
  const s = 0.62;
  const l = 0.48;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; } else if (hue < 120) { r = x; g = c; } else if (hue < 180) { g = c; b = x; } else if (hue < 240) { g = x; b = c; } else if (hue < 300) { r = x; b = c; } else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const AlertTrendsChart: React.FC<AlertTrendsChartProps> = ({ monthlyTrends }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [barAnchorPosition, setBarAnchorPosition] = useState<{ left: number; top: number } | null>(null);
  const tooltipCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoveredMonthRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!chartRef.current || !monthlyTrends.length) return;
    const data = monthlyTrends;
    const valueKeys = Object.keys(data[0]).filter((k) => k !== 'month');
    if (valueKeys.length === 0) return;

    const dataWithTotal = data.map((row) => ({
      ...row,
      total: valueKeys.reduce((sum, k) => sum + (Number(row[k]) || 0), 0),
      _totalLabel: valueKeys.reduce((sum, k) => sum + (Number(row[k]) || 0), 0)
    }));

    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        layout: root.verticalLayout,
        paddingTop: 8,
        paddingRight: 48,
        paddingBottom: 8,
        paddingLeft: 8,
        panY: true,
        wheelY: 'panY'
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {})
      })
    );
    xAxis.get('renderer').labels.template.setAll({ fontSize: 10 });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'month',
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 20 })
      })
    );
    yAxis.get('renderer').labels.template.setAll({ fontSize: 9, maxWidth: 32 });
    yAxis.data.setAll(dataWithTotal);

    const scrollbarY = chart.set(
      'scrollbarY',
      am5.Scrollbar.new(root, {
        orientation: 'vertical',
        width: 10,
        marginLeft: 5,
        marginRight: 5
      })
    );
    scrollbarY.get('background').setAll({
      fill: am5.color(0xe5e7eb),
      fillOpacity: 0.9,
      stroke: am5.color(0xd1d5db),
      strokeWidth: 1
    });
    scrollbarY.thumb.setAll({
      fill: am5.color(0x9ca3af),
      fillOpacity: 1,
      stroke: am5.color(0x6b7280),
      strokeWidth: 0.5
    });
    scrollbarY.startGrip.setAll({ scale: 0.8 });
    scrollbarY.endGrip.setAll({ scale: 0.8 });

    let currentStartIdx = 0;
    let currentEndIdx = Math.min(5, data.length - 1);
    const visibleCount = 6;

    const handleScrollbarWheel = (ev: { originalEvent: WheelEvent }) => {
      if (data.length <= visibleCount) return;
      const deltaY = ev.originalEvent.deltaY;
      if (deltaY === 0) return;
      ev.originalEvent.preventDefault();
      const step = Math.max(1, Math.floor(visibleCount * 0.5));
      if (deltaY > 0) {
        currentStartIdx = Math.min(data.length - visibleCount, currentStartIdx + step);
        currentEndIdx = Math.min(data.length - 1, currentStartIdx + visibleCount - 1);
      } else {
        currentEndIdx = Math.max(visibleCount - 1, currentEndIdx - step);
        currentStartIdx = Math.max(0, currentEndIdx - visibleCount + 1);
      }
      yAxis.zoomToIndexes(currentStartIdx, currentEndIdx);
    };
    scrollbarY.get('background').events.on('wheel', handleScrollbarWheel);
    scrollbarY.thumb.events.on('wheel', handleScrollbarWheel);
    scrollbarY.startGrip.events.on('wheel', handleScrollbarWheel);
    scrollbarY.endGrip.events.on('wheel', handleScrollbarWheel);

    chart.plotContainer.events.on('wheel', (ev: { originalEvent: WheelEvent }) => {
      const rootDom = root.dom;
      if (!rootDom) return;
      const rect = rootDom.getBoundingClientRect();
      const mouseX = ev.originalEvent.clientX - rect.left;
      if (mouseX < rect.width - 24) {
        ev.originalEvent.preventDefault();
        ev.originalEvent.stopPropagation();
      }
    });

    yAxis.events.on('datavalidated', () => {
      if (data.length > visibleCount) {
        currentStartIdx = Math.max(0, data.length - visibleCount);
        currentEndIdx = data.length - 1;
      } else {
        currentStartIdx = 0;
        currentEndIdx = data.length - 1;
      }
    });

    valueKeys.forEach((key, i) => {
      const color = am5.color(getTrendColor(i));
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: key,
          xAxis,
          yAxis,
          valueXField: key,
          categoryYField: 'month',
          stacked: true,
          fill: color,
          stroke: color,
          tooltip: am5.Tooltip.new(root, { forceHidden: true })
        })
      );
      series.columns.template.events.on('pointerover', (ev) => {
        if (tooltipCloseTimeoutRef.current) {
          clearTimeout(tooltipCloseTimeoutRef.current);
          tooltipCloseTimeoutRef.current = null;
        }
        const target = ev.target as unknown as { dataItem?: { dataContext?: Record<string, unknown> } };
        const dataContext = target.dataItem?.dataContext;
        const month = typeof dataContext?.month === 'string' ? dataContext.month : null;
        const orig = (ev as unknown as { originalEvent?: MouseEvent }).originalEvent;
        if (month && orig) {
          if (lastHoveredMonthRef.current !== month) {
            lastHoveredMonthRef.current = month;
            setHoveredMonth(month);
            setBarAnchorPosition({ left: orig.clientX, top: orig.clientY });
          }
        }
      });
      series.data.setAll(dataWithTotal);
      series.appear();
    });

    const totalSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueXField: '_totalLabel',
        categoryYField: 'month',
        stacked: true,
        fill: am5.color(0xffffff),
        stroke: am5.color(0xffffff),
        tooltip: am5.Tooltip.new(root, { forceHidden: true })
      })
    );
    totalSeries.columns.template.setAll({ fillOpacity: 0, strokeOpacity: 0 });
    totalSeries.columns.template.events.on('pointerover', (ev) => {
      if (tooltipCloseTimeoutRef.current) {
        clearTimeout(tooltipCloseTimeoutRef.current);
        tooltipCloseTimeoutRef.current = null;
      }
      const target = ev.target as unknown as { dataItem?: { dataContext?: Record<string, unknown> } };
      const dataContext = target.dataItem?.dataContext;
      const month = typeof dataContext?.month === 'string' ? dataContext.month : null;
      const orig = (ev as unknown as { originalEvent?: MouseEvent }).originalEvent;
      if (month && orig) {
        if (lastHoveredMonthRef.current !== month) {
          lastHoveredMonthRef.current = month;
          setHoveredMonth(month);
          setBarAnchorPosition({ left: orig.clientX, top: orig.clientY });
        }
      }
    });
    totalSeries.bullets.push(() =>
      am5.Bullet.new(root, {
        locationX: 1,
        locationY: 0.5,
        sprite: am5.Label.new(root, {
          text: '{total}',
          populateText: true,
          centerX: am5.p0,
          centerY: am5.p50,
          x: 4,
          paddingLeft: 8,
          paddingTop: 0,
          paddingBottom: 0,
          dy: 0,
          fontSize: 11,
          fontWeight: '500',
          fill: am5.color(0x374151)
        })
      })
    );
    totalSeries.data.setAll(
      dataWithTotal.map((row) => ({ ...row, _totalLabel: 0 }))
    );
    totalSeries.appear();

    const clearTooltip = () => {
      lastHoveredMonthRef.current = null;
      setHoveredMonth(null);
      setBarAnchorPosition(null);
    };
    root.container.events.on('pointerout', () => {
      if (tooltipCloseTimeoutRef.current) clearTimeout(tooltipCloseTimeoutRef.current);
      tooltipCloseTimeoutRef.current = setTimeout(clearTooltip, 120);
    });

    chart.set('cursor', am5xy.XYCursor.new(root, {}));

    chart.appear(1000, 100);

    if (data.length > visibleCount) {
      setTimeout(() => {
        yAxis.zoomToIndexes(Math.max(0, data.length - visibleCount), data.length - 1);
      }, 100);
    }

    return () => {
      if (tooltipCloseTimeoutRef.current) {
        clearTimeout(tooltipCloseTimeoutRef.current);
        tooltipCloseTimeoutRef.current = null;
      }
      root.dispose();
    };
  }, [monthlyTrends]);

  return (
    <>
      <Tooltip
          open={!!hoveredMonth}
          disableHoverListener
          disableFocusListener
          placement="top"
          arrow
          PopperProps={{
            anchorEl:
              barAnchorPosition
                ? {
                    getBoundingClientRect: () =>
                      ({
                        top: barAnchorPosition.top,
                        left: barAnchorPosition.left,
                        width: 0,
                        height: 0,
                        bottom: barAnchorPosition.top,
                        right: barAnchorPosition.left,
                        x: barAnchorPosition.left,
                        y: barAnchorPosition.top,
                        toJSON: () => {}
                      }) as DOMRect
                  }
                : undefined,
            modifiers: [{ name: 'offset', options: { offset: [0, -8] } }]
          }}
          title={(() => {
            if (!hoveredMonth || !monthlyTrends.length) return null;
            const monthRow = monthlyTrends.find((r) => r.month === hoveredMonth);
            const valueKeys = Object.keys(monthlyTrends[0]).filter((k) => k !== 'month');
            if (!monthRow || valueKeys.length === 0) return null;
            return (
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 max-w-sm max-h-80 overflow-auto">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {hoveredMonth} — types & count
                </div>
                <div className="space-y-0.5">
                  {valueKeys.map((key, i) => {
                    const count = typeof monthRow[key] === 'number' ? (monthRow[key] as number) : 0;
                    if (count === 0) return null;
                    return (
                      <div key={key} className="flex justify-between items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 min-w-0 flex-1">
                          <div
                            className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: getTrendColor(i) }}
                          />
                          <span className="text-gray-800 truncate" title={key}>
                            {key}
                          </span>
                        </span>
                        <span className="text-gray-600 font-medium whitespace-nowrap text-[11px]">
                          {count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          componentsProps={{
            tooltip: {
              sx: {
                maxWidth: 'none',
                bgcolor: 'white',
                color: 'rgba(0,0,0,0.87)',
                border: '1px solid',
                borderColor: 'grey.200',
                boxShadow: 2
              }
            }
          }}
        >
          <div className="w-full" style={{ height: 280 }}>
            <div ref={chartRef} className="w-full h-full" />
          </div>
        </Tooltip>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 mt-3 pt-2 border-t border-gray-100">
          {Object.keys(monthlyTrends[0])
            .filter((k) => k !== 'month')
            .map((key, i) => (
              <div key={key} className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getTrendColor(i) }}
                />
                <span className="text-[10px] text-gray-600 truncate leading-tight" title={key}>
                  {key}
                </span>
              </div>
            ))}
        </div>
    </>
  );
};

export default AlertTrendsChart;

