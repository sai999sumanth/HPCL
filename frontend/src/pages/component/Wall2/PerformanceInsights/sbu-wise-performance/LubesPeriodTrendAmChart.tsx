import React, { useLayoutEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { LUBES_CHART } from "./lubesSalesPerformance.theme";
import type { LubesPeriodTrendPoint } from "./lubesSalesPerformance.utils";
import type { PeriodViewMode } from "./lubesSalesPerformance.types";

const GRID_STROKE = 0xe2e8f0;
const AXIS_LABEL = 0x64748b;
const TOOLTIP_BG = 0xffffff;
const TOOLTIP_BORDER = 0xe2e8f0;
const TOOLTIP_TEXT = 0x0f172a;
const PLOT_HEIGHT_PX = 228;
const EXPANDED_PLOT_HEIGHT_PX = 380;

const hexToInt = (hex: string) => parseInt(hex.replace("#", ""), 16);

function scheduleResize(root: am5.Root) {
  queueMicrotask(() => root.resize());
  requestAnimationFrame(() => root.resize());
}

function attachResizeObserver(root: am5.Root, el: HTMLElement): () => void {
  const ro = new ResizeObserver(() => root.resize());
  ro.observe(el);
  return () => ro.disconnect();
}

function applyTooltipChrome(root: am5.Root, tooltip: am5.Tooltip) {
  tooltip.setAll({
    getFillFromSprite: false,
    autoTextColor: false,
    pointerOrientation: "vertical",
    animationDuration: 120,
  });
  tooltip.get("background")?.setAll({
    fill: am5.color(TOOLTIP_BG),
    fillOpacity: 1,
    stroke: am5.color(TOOLTIP_BORDER),
    strokeOpacity: 1,
    strokeWidth: 1,
  });
  tooltip.label.setAll({
    fill: am5.color(TOOLTIP_TEXT),
    fontSize: 12,
    lineHeight: am5.percent(140),
    oversizedBehavior: "wrap",
    maxWidth: 260,
  });
}

export type LubesPeriodTrendAmChartProps = {
  data: LubesPeriodTrendPoint[];
  previousFY: string;
  currentFY: string;
  periodView: PeriodViewMode;
  expanded?: boolean;
  height?: number;
  className?: string;
};

const LubesPeriodTrendAmChart: React.FC<LubesPeriodTrendAmChartProps> = ({
  data,
  previousFY,
  currentFY,
  periodView,
  expanded = false,
  height,
  className,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const colorHist = hexToInt(LUBES_CHART.hist);
  const colorCurr = hexToInt(LUBES_CHART.current);
  const valueFormat = "#,###.##";
  const valueUnit = "TMT";

  const plotHeight = height !== undefined ? height : (expanded ? EXPANDED_PLOT_HEIGHT_PX : PLOT_HEIGHT_PX);

  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el || data.length === 0) return;

    resizeCleanupRef.current?.();
    rootRef.current?.dispose();
    rootRef.current = null;

    const root = am5.Root.new(el);
    rootRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingLeft: 2,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: periodView === "month" ? 2 : 0,
        maxTooltipDistance: 0,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: periodView === "month" ? 16 : 24,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      fontSize: periodView === "month" ? 9 : 10,
      fontWeight: "500",
      fill: am5.color(0x334155),
      paddingTop: 2,
      ...(periodView === "month"
        ? {
            rotation: -35,
            centerY: am5.p50,
            centerX: am5.p100,
          }
        : {
            textAlign: "center",
            maxWidth: 72,
            oversizedBehavior: "wrap",
          }),
    });
    xAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.35,
      strokeDasharray: [4, 4],
      stroke: am5.color(GRID_STROKE),
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
      })
    );
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fill: am5.color(AXIS_LABEL),
    });
    yAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.55,
      strokeDasharray: [4, 4],
      stroke: am5.color(GRID_STROKE),
      location: 0,
    });

    const tipPrevious = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px]{categoryX}[/]\n[bold]${previousFY}[/]\n[bold]{previous.formatNumber("${valueFormat}")}[/] ${valueUnit}`,
    });
    applyTooltipChrome(root, tipPrevious);

    const tipCurrent = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px]{categoryX}[/]\n[bold]${currentFY}[/]\n[bold]{current.formatNumber("${valueFormat}")}[/] ${valueUnit}`,
    });
    applyTooltipChrome(root, tipCurrent);

    const seriesPrevious = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: previousFY,
        xAxis,
        yAxis,
        valueYField: "previous",
        categoryXField: "category",
        tooltip: tipPrevious,
      })
    );
    seriesPrevious.strokes.template.setAll({
      strokeWidth: 2,
      stroke: am5.color(colorHist),
    });
    seriesPrevious.fills.template.setAll({
      fill: am5.color(colorHist),
      fillOpacity: 0.08,
      visible: true,
    });
    seriesPrevious.bullets.push(() =>
      am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 3.5,
          fill: am5.color(0xffffff),
          stroke: am5.color(colorHist),
          strokeWidth: 2,
        }),
      })
    );

    const seriesCurrent = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: currentFY,
        xAxis,
        yAxis,
        valueYField: "current",
        categoryXField: "category",
        tooltip: tipCurrent,
      })
    );
    seriesCurrent.strokes.template.setAll({
      strokeWidth: 2,
      stroke: am5.color(colorCurr),
    });
    seriesCurrent.fills.template.setAll({
      fill: am5.color(colorCurr),
      fillOpacity: 0.08,
      visible: true,
    });
    seriesCurrent.bullets.push(() =>
      am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 3.5,
          fill: am5.color(0xffffff),
          stroke: am5.color(colorCurr),
          strokeWidth: 2,
        }),
      })
    );

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );

    xAxis.data.setAll(data);
    seriesPrevious.data.setAll(data);
    seriesCurrent.data.setAll(data);

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, previousFY, currentFY, periodView, colorHist, colorCurr, expanded, height]);

  return (
    <div className={`w-full min-w-0 ${className ?? ""}`}>
      <div ref={divRef} className="w-full min-w-0" style={{ height: plotHeight }} />
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-0.5 pt-0.5 text-[10px] font-medium text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span
            className="h-2 w-2 shrink-0 rounded-full border-2 bg-white"
            style={{ borderColor: LUBES_CHART.hist }}
          />
          {previousFY}
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="h-2 w-2 shrink-0 rounded-full border-2 bg-white"
            style={{ borderColor: LUBES_CHART.current }}
          />
          {currentFY}
        </span>
      </div>
    </div>
  );
};

export default LubesPeriodTrendAmChart;
