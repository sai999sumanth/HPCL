import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
  lightenLubesHex,
  LUBES_CHART,
  lubesGrowthHex,
  resolveLubesCompanyColor,
} from "./lubesSalesPerformance.theme";
import type { LubesCompanyCompareChartRow } from "./lubesSalesPerformance.utils";
import { formatPct } from "./lubesSalesPerformance.utils";

const GRID_STROKE = 0xe2e8f0;
const AXIS_LABEL = 0x64748b;
const TOOLTIP_BG = 0xffffff;
const TOOLTIP_BORDER = 0xe2e8f0;
const TOOLTIP_TEXT = 0x0f172a;
const CHART_HEIGHT_PX = 228;

const hexToInt = (hex: string) => parseInt(hex.replace("#", ""), 16);

function getPctDomain(data: LubesCompanyCompareChartRow[]): [number, number] {
  const values = data.map((row) => row.pct).filter(Number.isFinite);
  if (values.length === 0) return [-10, 10];
  const minPct = Math.min(...values);
  const maxPct = Math.max(...values);
  const padding = 5;
  return [Math.floor(minPct - padding), Math.ceil(maxPct + padding)];
}

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
    maxWidth: 280,
  });
}

function applyXCategoryHoverBand(chart: am5xy.XYChart) {
  const cursor = chart.get("cursor") as am5xy.XYCursor | undefined;
  if (!cursor) return;
  const lineX = cursor.lineX;
  if (lineX) {
    lineX.setAll({
      visible: true,
      strokeOpacity: 0,
      fill: am5.color(0xcbd5e1),
      fillOpacity: 0.22,
    });
  }
}

export type LubesCompanyAmChartProps = {
  data: LubesCompanyCompareChartRow[];
  previousFY: string;
  currentFY: string;
  className?: string;
};

/** Vertical grouped column chart — company net weight + growth line. */
const LubesCompanyAmChart: React.FC<LubesCompanyAmChartProps> = ({
  data,
  previousFY,
  currentFY,
  className,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const companyColorMap = useMemo(() => {
    const map = new Map<string, { current: string; previous: string }>();
    data.forEach((row, index) => {
      const base = resolveLubesCompanyColor(row.category, index);
      map.set(row.category, {
        current: base,
        previous: lightenLubesHex(base, 0.55),
      });
    });
    return map;
  }, [data]);

  const colorGrowthLine = hexToInt(LUBES_CHART.growthLine);
  const valueFormat = "#,###.##";
  const valueUnit = "TMT";

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

    const [pctMin, pctMax] = getPctDomain(data);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingLeft: 2,
        paddingRight: 44,
        paddingTop: 18,
        paddingBottom: 2,
        maxTooltipDistance: 0,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 28,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 11,
      fontWeight: "500",
      maxWidth: 100,
      oversizedBehavior: "wrap",
      textAlign: "center",
      fill: am5.color(0x334155),
    });
    xAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.35,
      strokeDasharray: [4, 4],
      stroke: am5.color(GRID_STROKE),
    });

    const yAxisTmt = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
      })
    );
    yAxisTmt.get("renderer").labels.template.setAll({
      fontSize: 11,
      fill: am5.color(AXIS_LABEL),
    });
    yAxisTmt.get("renderer").grid.template.setAll({
      strokeOpacity: 0.55,
      strokeDasharray: [4, 4],
      stroke: am5.color(GRID_STROKE),
      location: 0,
    });

    const yAxisPct = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { opposite: true }),
        numberFormat: "#.#'%'",
        min: pctMin,
        max: pctMax,
        strictMinMax: true,
      })
    );
    yAxisPct.get("renderer").labels.template.setAll({
      fontSize: 10,
      fill: am5.color(AXIS_LABEL),
    });
    yAxisPct.get("renderer").grid.template.setAll({
      strokeOpacity: 0,
    });

    const combinedTip = am5.Tooltip.new(root, {
      labelText:
        `[fontSize:11px bold]{categoryX}[/]\n` +
        `[fontSize:11px]Curr (${currentFY}):[/] [bold]{current.formatNumber("${valueFormat}")}[/] ${valueUnit}\n` +
        `[fontSize:11px]Hist (${previousFY}):[/] [bold]{previous.formatNumber("${valueFormat}")}[/] ${valueUnit}\n` +
        `[fontSize:11px]Growth %:[/] [bold]{pct.formatNumber("#.##'")}%[/]`,
    });
    applyTooltipChrome(root, combinedTip);

    const resolveBarColor = (company: string | undefined, fy: "previous" | "current") => {
      if (!company) return am5.color(0x94a3b8);
      const colors = companyColorMap.get(company);
      if (!colors) return am5.color(0x94a3b8);
      const hex = fy === "previous" ? colors.previous : colors.current;
      return am5.color(hexToInt(hex));
    };

    const seriesPrevious = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: `Hist (${previousFY})`,
        xAxis,
        yAxis: yAxisTmt,
        valueYField: "previous",
        categoryXField: "category",
        tooltip: combinedTip,
        clustered: true,
      })
    );
    seriesPrevious.columns.template.adapters.add("fill", (_fill, target) => {
      const ctx = target.dataItem?.dataContext as LubesCompanyCompareChartRow | undefined;
      return resolveBarColor(ctx?.category, "previous");
    });
    seriesPrevious.columns.template.adapters.add("stroke", (_stroke, target) => {
      const ctx = target.dataItem?.dataContext as LubesCompanyCompareChartRow | undefined;
      return resolveBarColor(ctx?.category, "previous");
    });
    seriesPrevious.columns.template.setAll({
      strokeOpacity: 0.25,
      strokeWidth: 1,
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      width: am5.percent(85),
      tooltipX: am5.p50,
      tooltipY: am5.p0,
      tooltipPosition: "pointer",
    });

    const seriesCurrent = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: `Curr (${currentFY})`,
        xAxis,
        yAxis: yAxisTmt,
        valueYField: "current",
        categoryXField: "category",
        tooltip: combinedTip,
        clustered: true,
      })
    );
    seriesCurrent.columns.template.adapters.add("fill", (_fill, target) => {
      const ctx = target.dataItem?.dataContext as LubesCompanyCompareChartRow | undefined;
      return resolveBarColor(ctx?.category, "current");
    });
    seriesCurrent.columns.template.adapters.add("stroke", (_stroke, target) => {
      const ctx = target.dataItem?.dataContext as LubesCompanyCompareChartRow | undefined;
      return resolveBarColor(ctx?.category, "current");
    });
    seriesCurrent.columns.template.setAll({
      strokeOpacity: 0.25,
      strokeWidth: 1,
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      width: am5.percent(85),
      tooltipX: am5.p50,
      tooltipY: am5.p0,
      tooltipPosition: "pointer",
    });

    seriesCurrent.bullets.push(() => {
      const label = am5.Label.new(root, {
        text: "{pct.formatNumber(\"#.##'%\")}",
        populateText: true,
        fontSize: 10,
        fontWeight: "600",
        centerX: am5.p50,
        centerY: am5.p100,
        dy: -8,
      });
      label.adapters.add("fill", (_fill, target) => {
        const ctx = target.dataItem?.dataContext as LubesCompanyCompareChartRow | undefined;
        const pct = ctx?.pct ?? 0;
        return am5.color(hexToInt(lubesGrowthHex(pct)));
      });
      label.adapters.add("text", (_text, target) => {
        const ctx = target.dataItem?.dataContext as LubesCompanyCompareChartRow | undefined;
        if (ctx == null || !Number.isFinite(ctx.pct)) return "";
        return formatPct(ctx.pct);
      });
      return am5.Bullet.new(root, {
        locationX: 0.5,
        locationY: 1,
        sprite: label,
      });
    });

    const growthSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Growth %",
        xAxis,
        yAxis: yAxisPct,
        valueYField: "pct",
        categoryXField: "category",
        stroke: am5.color(colorGrowthLine),
        fill: am5.color(colorGrowthLine),
        tooltip: combinedTip,
      })
    );
    growthSeries.strokes.template.setAll({
      strokeWidth: 1.5,
      strokeDasharray: [4, 3],
    });

    growthSeries.bullets.push(() => {
      const circle = am5.Circle.new(root, {
        radius: 4,
        stroke: am5.color(0xffffff),
        strokeWidth: 1.5,
      });
      circle.adapters.add("fill", (_fill, target) => {
        const ctx = target.dataItem?.dataContext as LubesCompanyCompareChartRow | undefined;
        const pct = ctx?.pct ?? 0;
        return am5.color(hexToInt(lubesGrowthHex(pct)));
      });
      return am5.Bullet.new(root, { sprite: circle });
    });

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis: yAxisTmt,
        behavior: "none",
      })
    );
    applyXCategoryHoverBand(chart);

    xAxis.data.setAll(data);
    seriesPrevious.data.setAll(data);
    seriesCurrent.data.setAll(data);
    growthSeries.data.setAll(data);

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, previousFY, currentFY, companyColorMap, colorGrowthLine]);

  return (
    <div className="w-full min-w-0">
      <div
        ref={divRef}
        className={className ?? "w-full min-w-0"}
        style={{ height: CHART_HEIGHT_PX }}
      />
      <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-0.5 pb-0 text-[10px] font-medium text-slate-600">
        {data.map((row, index) => {
          const color = resolveLubesCompanyColor(row.category, index);
          return (
            <span key={row.category} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {row.category}
            </span>
          );
        })}
        <span className="text-[10px] font-normal text-slate-400">
          Light = Hist ({previousFY}) · Solid = Curr ({currentFY})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke={LUBES_CHART.growthLine}
              strokeWidth="2"
              strokeDasharray="3 2"
            />
          </svg>
          Growth %
        </span>
      </div>
    </div>
  );
};

export default LubesCompanyAmChart;
