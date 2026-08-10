import React, { useLayoutEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
  OMC_COMPANY_HEX,
  OMC_COMPANY_NAMES,
  OMC_FIELD_KEYS,
  hexToAm5Int,
} from "../omcCompanyColors";

export type CategoryValue = {
  category: string;
  value: number;
  /** When using `xAxisCollapseGroupLabels`, consecutive bars with the same key share one X label (first bar shows the key). */
  groupKey?: string;
  gaArea?: string;
  gvName?: string;
};

const GRID_STROKE = 0xe2e8f0;
const AXIS_LABEL = 0x64748b;
const TOOLTIP_BG = 0x0f172a;
const TOOLTIP_BORDER = 0x334155;
const TOOLTIP_TEXT = 0xf1f5f9;
const TOOLTIP_LIGHT_BG = 0xffffff;
const TOOLTIP_LIGHT_BORDER = 0xe2e8f0;
const TOOLTIP_LIGHT_TEXT = 0x0f172a;

function blendHex(hex: number, towardWhite: number): number {
  const t = Math.min(1, Math.max(0, towardWhite));
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const R = Math.round(r + (255 - r) * t);
  const G = Math.round(g + (255 - g) * t);
  const B = Math.round(b + (255 - b) * t);
  return (R << 16) | (G << 8) | B;
}

function shadeHex(hex: number, towardBlack: number): number {
  const t = Math.min(1, Math.max(0, towardBlack));
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const R = Math.round(r * (1 - t));
  const G = Math.round(g * (1 - t));
  const B = Math.round(b * (1 - t));
  return (R << 16) | (G << 8) | B;
}

function scheduleResize(root: am5.Root) {
  queueMicrotask(() => root.resize());
  requestAnimationFrame(() => root.resize());
}

function attachResizeObserver(root: am5.Root, el: HTMLElement): () => void {
  const ro = new ResizeObserver(() => {
    root.resize();
  });
  ro.observe(el);
  return () => ro.disconnect();
}

function applyTooltipChrome(
  root: am5.Root,
  tooltip: am5.Tooltip,
  variant: "dark" | "light" = "dark"
) {
  tooltip.setAll({
    getFillFromSprite: false,
    autoTextColor: false,
    pointerOrientation: "vertical",
    animationDuration: 120,
  });
  const bg = tooltip.get("background");
  if (variant === "light") {
    bg?.setAll({
      fill: am5.color(TOOLTIP_LIGHT_BG),
      fillOpacity: 1,
      stroke: am5.color(TOOLTIP_LIGHT_BORDER),
      strokeOpacity: 1,
      strokeWidth: 1,
    });
    tooltip.label.setAll({
      fill: am5.color(TOOLTIP_LIGHT_TEXT),
      fontSize: 12,
      lineHeight: am5.percent(132),
      oversizedBehavior: "wrap",
      maxWidth: 220,
    });
  } else {
    bg?.setAll({
      fill: am5.color(TOOLTIP_BG),
      fillOpacity: 0.96,
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
}

function stylePlotGrid(xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>, yAxis: am5xy.ValueAxis<am5xy.AxisRenderer>) {
  yAxis.get("renderer").grid.template.setAll({
    strokeOpacity: 0.55,
    strokeDasharray: [4, 4],
    stroke: am5.color(GRID_STROKE),
    location: 0,
  });
  xAxis.get("renderer").grid.template.setAll({
    strokeOpacity: 0.35,
    strokeDasharray: [4, 4],
    stroke: am5.color(GRID_STROKE),
  });
}

function styleAxisLabels(xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>, yAxis: am5xy.ValueAxis<am5xy.AxisRenderer>) {
  xAxis.get("renderer").labels.template.setAll({
    fontSize: 11,
    fill: am5.color(AXIS_LABEL),
  });
  yAxis.get("renderer").labels.template.setAll({
    fontSize: 11,
    fill: am5.color(AXIS_LABEL),
  });
}

/** Optional sizing for the horizontal category scrollbar (Sales by company uses `emphasized`). */
export type XAxisCategoryScrollbarLook = {
  height?: number;
  marginTop?: number;
  marginBottom?: number;
  thumbHeight?: number;
};

/** amCharts horizontal scrollbar: viewport shows `visibleCount` categories at a time */
function attachXAxisCategoryScrollbar(
  root: am5.Root,
  chart: am5xy.XYChart,
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>,
  totalCategories: number,
  visibleCount: number,
  onAfterZoom?: () => void,
  look?: XAxisCategoryScrollbarLook
) {
  const n = Math.max(1, totalCategories);
  const show = Math.min(Math.max(1, visibleCount), n);
  const span = show / n;

  const sbH = look?.height ?? 6;
  const sbMt = look?.marginTop ?? 6;
  const sbMb = look?.marginBottom ?? 10;
  const thumbH = look?.thumbHeight ?? 4;

  xAxis.get("renderer").labels.template.set("paddingBottom", 2);

  const scrollbarX = am5.Scrollbar.new(root, {
    orientation: "horizontal",
    height: sbH,
    marginTop: sbMt,
    marginBottom: sbMb,
    marginLeft: 4,
    marginRight: 12,
  });
  scrollbarX.get("background")?.setAll({
    fill: am5.color(0xe2e8f0),
    fillOpacity: 0.9,
    stroke: am5.color(0xcbd5e1),
    strokeWidth: 0.5,
  });
  scrollbarX.thumb.setAll({
    fill: am5.color(0x94a3b8),
    fillOpacity: 0.6,
    height: thumbH,
  });
  chart.bottomAxesContainer.children.push(scrollbarX);

  const applyZoom = () => {
    const start = scrollbarX.get("start", 0);
    const end = scrollbarX.get("end", 1);
    xAxis.zoom(start, end);
    onAfterZoom?.();
  };

  scrollbarX.set("start", 0);
  scrollbarX.set("end", span);
  applyZoom();

  scrollbarX.events.on("rangechanged", applyZoom);
}

/** Vertical scrollbar — category axis on Y (horizontal bar charts) */
function attachYAxisCategoryScrollbar(
  root: am5.Root,
  chart: am5xy.XYChart,
  yAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>,
  totalCategories: number,
  visibleCount: number
) {
  const n = Math.max(1, totalCategories);
  const show = Math.min(Math.max(1, visibleCount), n);
  const span = show / n;

  yAxis.get("renderer").labels.template.set("paddingRight", 4);

  const scrollbarY = am5.Scrollbar.new(root, {
    orientation: "vertical",
    width: 6,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 2,
    marginRight: 2,
  });
  scrollbarY.get("background")?.setAll({
    fill: am5.color(0xe2e8f0),
    fillOpacity: 0.9,
    stroke: am5.color(0xcbd5e1),
    strokeWidth: 0.5,
  });
  scrollbarY.thumb.setAll({
    fill: am5.color(0x94a3b8),
    fillOpacity: 0.6,
    width: 4,
  });
  chart.rightAxesContainer.children.push(scrollbarY);

  const applyZoom = () => {
    const start = scrollbarY.get("start", 0);
    const end = scrollbarY.get("end", 1);
    yAxis.zoom(start, end);
  };

  scrollbarY.set("start", 0);
  scrollbarY.set("end", span);
  applyZoom();

  scrollbarY.events.on("rangechanged", applyZoom);
}

/** Light vertical band on hover (grouped / category charts) */
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

/** Horizontal band on hover (category on Y — horizontal bar charts) */
function applyYCategoryHoverBand(chart: am5xy.XYChart) {
  const cursor = chart.get("cursor") as am5xy.XYCursor | undefined;
  if (!cursor) return;
  const lineY = cursor.lineY;
  if (lineY) {
    lineY.setAll({
      visible: true,
      strokeOpacity: 0,
      fill: am5.color(0xcbd5e1),
      fillOpacity: 0.22,
    });
  }
}

/** Vertical column chart — amCharts 5 */
export const NgColumnChart: React.FC<{
  data: CategoryValue[];
  color?: number;
  /** Shown in tooltip (e.g. Sales, Volume) */
  valueLabel?: string;
  valueUnit?: string;
  /** amCharts number format, e.g. "#,###.0" */
  valueFormat?: string;
}> = ({
  data,
  color: fillColor = 0x2563eb,
  valueLabel = "Sales",
  valueUnit = "MMSCM",
  valueFormat = "#,###.0",
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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
        paddingLeft: 4,
        paddingRight: 8,
        paddingTop: 12,
        paddingBottom: 4,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 24,
          cellStartLocation: 0.08,
          cellEndLocation: 0.92,
        }),
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
      })
    );

    const columnTooltip = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px opacity:0.85]{categoryX}[/]\n[bold fontSize:13px]{valueY.formatNumber("${valueFormat}")}[/] [fontSize:11px opacity:0.8]${valueUnit}[/]\n[fontSize:10px opacity:0.65]${valueLabel}[/]`,
    });
    applyTooltipChrome(root, columnTooltip);

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: valueLabel,
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "category",
        tooltip: columnTooltip,
      })
    );

    const colGrad = am5.LinearGradient.new(root, {
      stops: [
        { color: am5.color(blendHex(fillColor, 0.18)), offset: 0 },
        { color: am5.color(fillColor), offset: 0.5 },
        { color: am5.color(shadeHex(fillColor, 0.12)), offset: 1 },
      ],
    });
    colGrad.set("rotation", 90);
    series.columns.template.setAll({
      fillGradient: colGrad,
      stroke: am5.color(fillColor),
      strokeOpacity: 0.35,
      strokeWidth: 1,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      width: am5.percent(72),
      tooltipX: am5.p50,
      tooltipY: am5.p0,
      tooltipPosition: "pointer",
      cursorOverStyle: "pointer",
    });

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );

    xAxis.data.setAll(data);
    series.data.setAll(data);

    styleAxisLabels(xAxis, yAxis);
    stylePlotGrid(xAxis, yAxis);

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, fillColor, valueLabel, valueUnit, valueFormat]);

  return <div ref={divRef} className="h-[232px] w-full min-w-0" />;
};

/** Multi-color columns (e.g. one color per company) + optional HTML legend row is rendered by parent */
export const NgMultiColorColumnChart: React.FC<{
  data: CategoryValue[];
  /** Parallel to data — one hex per bar (used when categoryColorByName is not set) */
  colors: number[];
  /** Stable color per category name (e.g. when data is filtered by legend) */
  categoryColorByName?: Record<string, number>;
  valueLabel?: string;
  valueUnit?: string;
  valueFormat?: string;
  yMin?: number;
  yMax?: number;
  className?: string;
  /** If set, amCharts bottom scrollbar shows this many categories at a time */
  scrollbarVisibleCategories?: number;
  /**
   * One X label per `groupKey` run (bars still 1:1 with API rows). Labels account for zoom/scrollbar so the
   * first visible bar in a group always shows the group name when the previous bar is off-screen.
   */
  xAxisCollapseGroupLabels?: boolean;
  /** Numeric labels above each column (tooltip still shows values). */
  showValueLabels?: boolean;
  /** Larger, clearer bottom X scrollbar (fixed plot; no outer page scroll on parent). */
  emphasizeCategoryScrollbar?: boolean;
}> = ({
  data,
  colors,
  categoryColorByName,
  valueLabel = "Sales",
  valueUnit = "MMSCM",
  valueFormat = "#,###.0",
  yMin,
  yMax,
  className = "h-[220px]",
  scrollbarVisibleCategories,
  xAxisCollapseGroupLabels = false,
  showValueLabels = true,
  emphasizeCategoryScrollbar = false,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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

    const padTop = showValueLabels ? 26 : 8;
    const padBottom =
      scrollbarVisibleCategories != null ? (emphasizeCategoryScrollbar ? 22 : 18) : 8;

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingLeft: 8,
        paddingRight: scrollbarVisibleCategories != null ? 20 : 10,
        paddingTop: padTop,
        paddingBottom: padBottom,
        maxTooltipDistance: 0,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 14,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
        ...(yMin != null ? { min: yMin } : {}),
        ...(yMax != null ? { max: yMax } : {}),
        strictMinMax: yMin != null || yMax != null,
      })
    );

    const columnTooltip = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px opacity:0.85]{categoryX}[/]\n[bold fontSize:13px]{valueY.formatNumber("${valueFormat}")}[/] [fontSize:11px opacity:0.8]${valueUnit}[/]\n[fontSize:10px opacity:0.65]${valueLabel}[/]`,
    });
    applyTooltipChrome(root, columnTooltip);

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: valueLabel,
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "category",
        tooltip: columnTooltip,
      })
    );

    const resolveHex = (cat: string | undefined): number => {
      if (cat && categoryColorByName && categoryColorByName[cat] != null) {
        return categoryColorByName[cat]!;
      }
      const idx = data.findIndex((d) => d.category === cat);
      return idx >= 0 ? colors[idx % colors.length]! : 0x2563eb;
    };

    series.columns.template.adapters.add("fill", (_fill, target) => {
      const ctx = target.dataItem?.dataContext as CategoryValue | undefined;
      return am5.color(resolveHex(ctx?.category));
    });
    series.columns.template.adapters.add("stroke", (_s, target) => {
      const ctx = target.dataItem?.dataContext as CategoryValue | undefined;
      return am5.color(resolveHex(ctx?.category));
    });

    series.columns.template.setAll({
      strokeOpacity: 0.35,
      strokeWidth: 1,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      width: am5.percent(52),
      tooltipX: am5.p50,
      tooltipY: am5.p0,
      tooltipPosition: "pointer",
      cursorOverStyle: "pointer",
    });

    if (showValueLabels) {
      series.bullets.push(() =>
        am5.Bullet.new(root, {
          locationX: 0.5,
          locationY: 1,
          sprite: am5.Label.new(root, {
            populateText: true,
            text: `{valueY.formatNumber("${valueFormat}")}`,
            fontSize: 11,
            fontWeight: "600",
            fill: am5.color(0x334155),
            centerX: am5.p50,
            centerY: am5.p100,
            dy: -8,
          }),
        })
      );
    }

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );
    applyXCategoryHoverBand(chart);

    xAxis.data.setAll(data);
    series.data.setAll(data);

    styleAxisLabels(xAxis, yAxis);
    stylePlotGrid(xAxis, yAxis);

    xAxis.get("renderer").labels.template.setAll({
      location: 0.5,
      textAlign: "center",
      fontSize: 10,
      maxWidth: 120,
      oversizedBehavior: "wrap",
      fill: am5.color(0x334155),
    });

    const hasGroupKeys = data.some((d) => d.groupKey != null && String(d.groupKey).length > 0);
    if (xAxisCollapseGroupLabels && hasGroupKeys) {
      const indexByCategory = new Map(data.map((d, i) => [d.category, i]));
      const n = data.length;
      const categoryVisibleInZoom = (i: number, start: number, end: number) => {
        if (n <= 1) return true;
        const lo = i / n;
        const hi = (i + 1) / n;
        return hi > start && lo < end;
      };
      const xLab = xAxis.get("renderer").labels.template;
      xLab.adapters.add("text", (_text, target) => {
        const cat = (target.dataItem as { get?: (k: string) => unknown } | undefined)?.get?.(
          "category"
        ) as string | undefined;
        const idx = cat != null ? indexByCategory.get(cat) : undefined;
        if (idx == null) return cat ?? "";
        const g = data[idx]?.groupKey;
        return g != null && g !== "" ? g : cat ?? "";
      });
      xLab.adapters.add("forceHidden", (_h, target) => {
        const cat = (target.dataItem as { get?: (k: string) => unknown } | undefined)?.get?.(
          "category"
        ) as string | undefined;
        const idx = cat != null ? indexByCategory.get(cat) : undefined;
        if (idx == null) return false;
        const row = data[idx];
        const g = row?.groupKey;
        if (g == null || g === "") return false;
        const start = xAxis.get("start", 0);
        const end = xAxis.get("end", 1);
        if (idx === 0) return false;
        const prev = data[idx - 1];
        if (prev?.groupKey !== g) return false;
        if (!categoryVisibleInZoom(idx - 1, start, end)) return false;
        return true;
      });
    }

    if (scrollbarVisibleCategories != null && data.length > 0) {
      const scrollLook: XAxisCategoryScrollbarLook | undefined = emphasizeCategoryScrollbar
        ? { height: 8, marginTop: 8, marginBottom: 12, thumbHeight: 5 }
        : undefined;
      attachXAxisCategoryScrollbar(
        root,
        chart,
        xAxis,
        data.length,
        scrollbarVisibleCategories,
        xAxisCollapseGroupLabels && hasGroupKeys ? () => xAxis.get("renderer").markDirty() : undefined,
        scrollLook
      );
    }

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [
    data,
    colors,
    categoryColorByName,
    valueLabel,
    valueUnit,
    valueFormat,
    yMin,
    yMax,
    scrollbarVisibleCategories,
    xAxisCollapseGroupLabels,
    showValueLabels,
    emphasizeCategoryScrollbar,
  ]);

  return <div ref={divRef} className={`w-full min-w-0 ${className}`} />;
};

/** Group by category (e.g. HPCL / HOGPL / BGL) × three periods — reference-style grouped bars */
export type GroupedThreePeriodRow = {
  category: string;
  m0: number;
  m1: number;
  m2: number;
};

export const NgGroupedThreePeriodColumnChart: React.FC<{
  data: GroupedThreePeriodRow[];
  periodNames: [string, string, string];
  periodColors: [number, number, number];
  valueUnit?: string;
  valueFormat?: string;
  valueLabel?: string;
  yMin?: number;
  yMax?: number;
  className?: string;
  scrollbarVisibleCategories?: number;
}> = ({
  data,
  periodNames,
  periodColors,
  valueUnit = "MMSCM",
  valueFormat = "#,###.0",
  valueLabel = "Sales",
  yMin,
  yMax,
  className = "h-[220px]",
  scrollbarVisibleCategories,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const fields = ["m0", "m1", "m2"] as const;

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
        paddingLeft: 4,
        paddingRight: scrollbarVisibleCategories != null ? 18 : 8,
        paddingTop: 8,
        paddingBottom: scrollbarVisibleCategories != null ? 12 : 4,
        maxTooltipDistance: 0,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 24,
          cellStartLocation: 0.12,
          cellEndLocation: 0.88,
        }),
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fontWeight: "500",
      maxWidth: 88,
      oversizedBehavior: "wrap",
      textAlign: "center",
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
        ...(yMin != null ? { min: yMin } : {}),
        ...(yMax != null ? { max: yMax } : {}),
        strictMinMax: yMin != null || yMax != null,
      })
    );

    const seriesList: am5xy.ColumnSeries[] = [];
    for (let i = 0; i < 3; i++) {
      const field = fields[i]!;
      const periodName = periodNames[i]!;
      const col = periodColors[i]!;
      const tip = am5.Tooltip.new(root, {
        labelText: `[fontSize:11px]{categoryX}[/]\n[bold]${periodName}[/]\n[bold]{valueY.formatNumber("${valueFormat}")}[/] ${valueUnit}\n[fontSize:10px opacity:0.75]${valueLabel}[/]`,
      });
      applyTooltipChrome(root, tip);

      const s = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: periodName,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: "category",
          tooltip: tip,
          clustered: true,
        })
      );
      s.columns.template.setAll({
        fill: am5.color(col),
        stroke: am5.color(col),
        strokeOpacity: 0.4,
        strokeWidth: 1,
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        width: am5.percent(78),
        tooltipX: am5.p50,
        tooltipY: am5.p0,
        tooltipPosition: "pointer",
      });
      seriesList.push(s);
    }

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );
    applyXCategoryHoverBand(chart);

    xAxis.data.setAll(data);
    seriesList.forEach((s) => s.data.setAll(data));

    styleAxisLabels(xAxis, yAxis);
    stylePlotGrid(xAxis, yAxis);

    if (scrollbarVisibleCategories != null && data.length > 0) {
      attachXAxisCategoryScrollbar(root, chart, xAxis, data.length, scrollbarVisibleCategories);
    }

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, periodNames, periodColors, valueUnit, valueFormat, valueLabel, yMin, yMax, scrollbarVisibleCategories]);

  return <div ref={divRef} className={`w-full min-w-0 ${className}`} />;
};

export type GroupedTwoMetric = { category: string; a: number; b: number };

/** Grouped columns — e.g. Maharashtra vs Gujarat */
export const NgGroupedTwoStateChart: React.FC<{
  data: GroupedTwoMetric[];
  seriesAName: string;
  seriesBName: string;
  colorA?: number;
  colorB?: number;
  valueUnit?: string;
  valueFormat?: string;
  yMin?: number;
  yMax?: number;
  className?: string;
}> = ({
  data,
  seriesAName,
  seriesBName,
  colorA = 0x2563eb,
  colorB = 0xea580c,
  valueUnit = "MMSCM",
  valueFormat = "#,###.0",
  yMin,
  yMax,
  className = "h-[240px]",
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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
        paddingLeft: 4,
        paddingRight: 8,
        paddingTop: 8,
        paddingBottom: 4,
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

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
        ...(yMin != null ? { min: yMin } : {}),
        ...(yMax != null ? { max: yMax } : {}),
        strictMinMax: yMin != null || yMax != null,
      })
    );

    const tipA = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px]{categoryX}[/]\n[bold]${seriesAName}:[/] [bold]{valueY.formatNumber("${valueFormat}")}[/] ${valueUnit}`,
    });
    applyTooltipChrome(root, tipA);
    const tipB = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px]{categoryX}[/]\n[bold]${seriesBName}:[/] [bold]{valueY.formatNumber("${valueFormat}")}[/] ${valueUnit}`,
    });
    applyTooltipChrome(root, tipB);

    const s1 = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: seriesAName,
        xAxis,
        yAxis,
        valueYField: "a",
        categoryXField: "category",
        tooltip: tipA,
        clustered: true,
      })
    );
    s1.columns.template.setAll({
      fill: am5.color(colorA),
      stroke: am5.color(colorA),
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      width: am5.percent(90),
    });

    const s2 = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: seriesBName,
        xAxis,
        yAxis,
        valueYField: "b",
        categoryXField: "category",
        tooltip: tipB,
        clustered: true,
      })
    );
    s2.columns.template.setAll({
      fill: am5.color(colorB),
      stroke: am5.color(colorB),
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      width: am5.percent(90),
    });

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 8,
        layout: root.horizontalLayout,
      })
    );
    legend.data.setAll([s1, s2]);

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );

    xAxis.data.setAll(data);
    s1.data.setAll(data);
    s2.data.setAll(data);

    styleAxisLabels(xAxis, yAxis);
    stylePlotGrid(xAxis, yAxis);

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, seriesAName, seriesBName, colorA, colorB, valueUnit, valueFormat, yMin, yMax]);

  return <div ref={divRef} className={`w-full min-w-0 ${className}`} />;
};

/** State × HPCL / HOGPL / BGL — clustered */
export type StateCompanyClusterRow = {
  state: string;
  hpcl: number;
  hogpl: number;
  bgl: number;
};

const STATE_CLUSTER_COLORS = OMC_COMPANY_NAMES.map((n) => hexToAm5Int(OMC_COMPANY_HEX[n])) as [
  number,
  number,
  number,
];
const STATE_CLUSTER_FIELDS = OMC_FIELD_KEYS;
const STATE_CLUSTER_NAMES = OMC_COMPANY_NAMES;

export const NgSalesByStateClusterChart: React.FC<{
  data: StateCompanyClusterRow[];
  valueUnit?: string;
  valueFormat?: string;
  yMin?: number;
  yMax?: number;
  className?: string;
  /** Fixed plot height (px) — optional; prefer className height when using amCharts scrollbar */
  plotHeightPx?: number;
  /** Hide amCharts legend when using external HTML legend (e.g. executive dashboard) */
  hideBuiltInLegend?: boolean;
  /** amCharts bottom scrollbar: show this many state groups at a time */
  scrollbarVisibleCategories?: number;
  /** Override HPCL / HOGPL / BGL labels (e.g. GV names from analytics API) */
  clusterSeriesLabels?: [string, string, string];
}> = ({
  data,
  valueUnit = "MMSCM",
  valueFormat = "#,###.0",
  yMin = 0,
  yMax = 150,
  className = "h-[300px]",
  plotHeightPx,
  hideBuiltInLegend = false,
  scrollbarVisibleCategories,
  clusterSeriesLabels,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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
        paddingLeft: 4,
        paddingRight: scrollbarVisibleCategories != null ? 18 : 8,
        paddingTop: 6,
        paddingBottom: scrollbarVisibleCategories != null ? 12 : 6,
        /** Only the hovered cluster column’s tooltip */
        maxTooltipDistance: 0,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "state",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: data.length > 4 ? 20 : 32,
          cellStartLocation: 0.06,
          cellEndLocation: 0.94,
        }),
      })
    );
    xAxis.get("renderer").labels.template.setAll({
      fontSize: data.length > 5 ? 9 : 10,
      maxWidth: 72,
      oversizedBehavior: "wrap",
      textAlign: "center",
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
        min: yMin,
        max: yMax,
        strictMinMax: true,
      })
    );

    const seriesList: am5xy.ColumnSeries[] = [];
    const clusterCount = STATE_CLUSTER_FIELDS.length;
    for (let i = 0; i < clusterCount; i++) {
      const field = STATE_CLUSTER_FIELDS[i]!;
      const company = clusterSeriesLabels?.[i] ?? STATE_CLUSTER_NAMES[i]!;
      const tip = am5.Tooltip.new(root, {
        labelText: `[fontSize:11px opacity:0.65]{categoryX}[/]\n[bold fontSize:14px]{valueY.formatNumber("${valueFormat}")}[/][fontSize:12px opacity:0.85] ${valueUnit}[/]\n[fontSize:10px opacity:0.55]${company}[/]`,
      });
      applyTooltipChrome(root, tip, "light");

      const s = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: company,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: "state",
          tooltip: tip,
          clustered: true,
        })
      );
      const c = STATE_CLUSTER_COLORS[i]!;
      s.columns.template.setAll({
        fill: am5.color(c),
        stroke: am5.color(c),
        strokeOpacity: 0.35,
        strokeWidth: 1,
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        width: am5.percent(82),
        tooltipX: am5.p50,
        tooltipY: am5.p100,
      });
      seriesList.push(s);
    }

    if (!hideBuiltInLegend) {
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          marginTop: 4,
          marginBottom: 0,
          layout: root.horizontalLayout,
        })
      );
      legend.data.setAll(seriesList);
      legend.markers.template.setAll({
        width: 9,
        height: 9,
      });
      legend.labels.template.setAll({
        fontSize: 9,
        fill: am5.color(0x475569),
      });
      legend.itemContainers.template.setAll({
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 3,
        paddingRight: 3,
        marginRight: 2,
        cursorOverStyle: "pointer",
      });
    }

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );
    applyXCategoryHoverBand(chart);

    xAxis.data.setAll(data);
    seriesList.forEach((s) => s.data.setAll(data));

    styleAxisLabels(xAxis, yAxis);
    stylePlotGrid(xAxis, yAxis);

    if (scrollbarVisibleCategories != null && data.length > 0) {
      attachXAxisCategoryScrollbar(root, chart, xAxis, data.length, scrollbarVisibleCategories);
    }

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, valueUnit, valueFormat, yMin, yMax, hideBuiltInLegend, scrollbarVisibleCategories, clusterSeriesLabels]);

  const sizeStyle =
    plotHeightPx != null
      ? { height: plotHeightPx, minHeight: plotHeightPx }
      : undefined;

  return (
    <div
      ref={divRef}
      className={plotHeightPx != null ? "w-full min-w-0" : `w-full min-w-0 ${className}`}
      style={sizeStyle}
    />
  );
};

function styleAxisLabelsHorizontal(
  xAxis: am5xy.ValueAxis<am5xy.AxisRenderer>,
  yAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>
) {
  xAxis.get("renderer").labels.template.setAll({
    fontSize: 11,
    fill: am5.color(AXIS_LABEL),
  });
  yAxis.get("renderer").labels.template.setAll({
    fontSize: 11,
    fill: am5.color(AXIS_LABEL),
  });
}

function stylePlotGridHorizontal(
  xAxis: am5xy.ValueAxis<am5xy.AxisRenderer>,
  yAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>
) {
  xAxis.get("renderer").grid.template.setAll({
    strokeOpacity: 0.55,
    strokeDasharray: [4, 4],
    stroke: am5.color(GRID_STROKE),
    location: 0,
  });
  yAxis.get("renderer").grid.template.setAll({
    strokeOpacity: 0.35,
    strokeDasharray: [4, 4],
    stroke: am5.color(GRID_STROKE),
  });
}

/** State / GA name × HPCL / HOGPL / BGL — stacked horizontal bars */
export const NgSalesByStateClusterHorizontalChart: React.FC<{
  data: StateCompanyClusterRow[];
  valueUnit?: string;
  valueFormat?: string;
  xMin?: number;
  xMax?: number;
  className?: string;
  plotHeightPx?: number;
  hideBuiltInLegend?: boolean;
  scrollbarVisibleCategories?: number;
  clusterSeriesLabels?: [string, string, string];
}> = ({
  data,
  valueUnit = "MMSCM",
  valueFormat = "#,###.0",
  xMin = 0,
  xMax = 150,
  className = "h-[300px]",
  plotHeightPx,
  hideBuiltInLegend = false,
  scrollbarVisibleCategories,
  clusterSeriesLabels,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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
        paddingLeft: 8,
        paddingRight: scrollbarVisibleCategories != null ? 22 : 10,
        paddingTop: 6,
        paddingBottom: scrollbarVisibleCategories != null ? 10 : 6,
        maxTooltipDistance: 0,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {}),
        numberFormat: valueFormat,
        min: xMin,
        max: xMax,
        strictMinMax: true,
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "state",
        renderer: am5xy.AxisRendererY.new(root, {
          minGridDistance: data.length > 4 ? 14 : 20,
          inversed: true,
        }),
      })
    );
    yAxis.get("renderer").labels.template.setAll({
      fontSize: data.length > 5 ? 9 : 10,
      maxWidth: 112,
      oversizedBehavior: "wrap",
      textAlign: "right",
    });

    const seriesList: am5xy.ColumnSeries[] = [];
    const clusterCount = STATE_CLUSTER_FIELDS.length;
    for (let i = 0; i < clusterCount; i++) {
      const field = STATE_CLUSTER_FIELDS[i]!;
      const company = clusterSeriesLabels?.[i] ?? STATE_CLUSTER_NAMES[i]!;
      const tip = am5.Tooltip.new(root, {
        labelText: `[fontSize:11px opacity:0.65]{categoryY}[/]\n[bold fontSize:14px]{valueX.formatNumber("${valueFormat}")}[/][fontSize:12px opacity:0.85] ${valueUnit}[/]\n[fontSize:10px opacity:0.55]${company}[/]`,
      });
      applyTooltipChrome(root, tip, "light");

      const s = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: company,
          xAxis,
          yAxis,
          valueXField: field,
          categoryYField: "state",
          tooltip: tip,
          stacked: true,
        })
      );
      const c = STATE_CLUSTER_COLORS[i]!;
      s.columns.template.setAll({
        fill: am5.color(c),
        stroke: am5.color(c),
        strokeOpacity: 0.35,
        strokeWidth: 1,
        cornerRadiusTL: i === 0 ? 3 : 0,
        cornerRadiusBL: i === 0 ? 3 : 0,
        cornerRadiusTR: i === clusterCount - 1 ? 3 : 0,
        cornerRadiusBR: i === clusterCount - 1 ? 3 : 0,
        height: am5.percent(92),
        tooltipX: am5.p100,
        tooltipY: am5.p50,
      });
      seriesList.push(s);
    }

    if (!hideBuiltInLegend) {
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          marginTop: 4,
          marginBottom: 0,
          layout: root.horizontalLayout,
        })
      );
      legend.data.setAll(seriesList);
      legend.markers.template.setAll({
        width: 9,
        height: 9,
      });
      legend.labels.template.setAll({
        fontSize: 9,
        fill: am5.color(0x475569),
      });
      legend.itemContainers.template.setAll({
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 3,
        paddingRight: 3,
        marginRight: 2,
        cursorOverStyle: "pointer",
      });
    }

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );
    applyYCategoryHoverBand(chart);

    yAxis.data.setAll(data);
    seriesList.forEach((s) => s.data.setAll(data));

    styleAxisLabelsHorizontal(xAxis, yAxis);
    stylePlotGridHorizontal(xAxis, yAxis);

    if (scrollbarVisibleCategories != null && data.length > 0) {
      attachYAxisCategoryScrollbar(root, chart, yAxis, data.length, scrollbarVisibleCategories);
    }

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, valueUnit, valueFormat, xMin, xMax, hideBuiltInLegend, scrollbarVisibleCategories, clusterSeriesLabels]);

  const sizeStyle =
    plotHeightPx != null
      ? { height: plotHeightPx, minHeight: plotHeightPx }
      : undefined;

  return (
    <div
      ref={divRef}
      className={plotHeightPx != null ? "w-full min-w-0" : `w-full min-w-0 ${className}`}
      style={sizeStyle}
    />
  );
};

/** Single line + area */
export const NgLineChart: React.FC<{
  data: CategoryValue[];
  color?: number;
  fillOpacity?: number;
  valueLabel?: string;
  valueUnit?: string;
  valueFormat?: string;
  /** Show series name in a bottom legend (reference dashboard) */
  showLegend?: boolean;
  yMin?: number;
  yMax?: number;
  className?: string;
  /** If set, amCharts bottom scrollbar shows this many categories at a time */
  scrollbarVisibleCategories?: number;
}> = ({
  data,
  color: strokeColor = 0x4f46e5,
  fillOpacity = 0.14,
  valueLabel = "Trend",
  valueUnit = "index",
  valueFormat = "#,###.0",
  showLegend = false,
  yMin,
  yMax,
  className,
  scrollbarVisibleCategories,
}) => {
  const resolvedHeightClass =
    className ?? (showLegend ? "h-[248px]" : "h-[232px]");
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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
        paddingLeft: 4,
        paddingRight: scrollbarVisibleCategories != null ? 18 : 8,
        paddingTop: 12,
        paddingBottom: scrollbarVisibleCategories != null ? 12 : 4,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 28,
          cellStartLocation: 0.05,
          cellEndLocation: 0.95,
        }),
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
        ...(yMin != null ? { min: yMin } : {}),
        ...(yMax != null ? { max: yMax } : {}),
        strictMinMax: yMin != null || yMax != null,
      })
    );

    const lineTooltip = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px opacity:0.85]{categoryX}[/]\n[bold fontSize:13px]{valueY.formatNumber("${valueFormat}")}[/] [fontSize:11px opacity:0.8]${valueUnit}[/]\n[fontSize:10px opacity:0.65]${valueLabel}[/]`,
    });
    applyTooltipChrome(root, lineTooltip);

    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: valueLabel,
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "category",
        tooltip: lineTooltip,
      })
    );

    series.strokes.template.setAll({
      strokeWidth: 2.5,
      stroke: am5.color(strokeColor),
      lineCap: "round",
      lineJoin: "round",
    });
    series.fills.template.setAll({
      fill: am5.color(strokeColor),
      fillOpacity,
      visible: true,
    });

    series.bullets.push((_root, _series, dataItem) => {
      const onlyWhen = dataItem?.dataContext != null;
      if (!onlyWhen) return undefined;
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 4,
          fill: am5.color(0xffffff),
          stroke: am5.color(strokeColor),
          strokeWidth: 2,
        }),
      });
    });

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );

    if (showLegend) {
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          marginTop: 4,
          layout: root.horizontalLayout,
        })
      );
      legend.data.setAll([series]);
      legend.markers.template.setAll({ width: 9, height: 9 });
      legend.labels.template.setAll({ fontSize: 9, fill: am5.color(0x475569) });
      legend.itemContainers.template.setAll({ paddingTop: 2, paddingBottom: 2, cursorOverStyle: "pointer" });
    }

    xAxis.data.setAll(data);
    series.data.setAll(data);

    styleAxisLabels(xAxis, yAxis);
    stylePlotGrid(xAxis, yAxis);

    if (scrollbarVisibleCategories != null && data.length > 0) {
      attachXAxisCategoryScrollbar(root, chart, xAxis, data.length, scrollbarVisibleCategories);
    }

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, strokeColor, fillOpacity, valueLabel, valueUnit, valueFormat, showLegend, yMin, yMax, scrollbarVisibleCategories]);

  return <div ref={divRef} className={`w-full min-w-0 ${resolvedHeightClass}`} />;
};

export type DualLinePoint = { category: string; current: number; compare: number };

/** Two line series — optional area fill under lines (reference dashboard) */
export const NgDualLineChart: React.FC<{
  data: DualLinePoint[];
  currentLabel?: string;
  compareLabel?: string;
  valueUnit?: string;
  valueFormat?: string;
  /** Default matches mock: blue current, green compare */
  compareColor?: number;
  areaFillOpacity?: number;
  yMin?: number;
  yMax?: number;
  showLegend?: boolean;
}> = ({
  data,
  currentLabel = "Current period",
  compareLabel = "Compare period",
  valueUnit = "MMSCM",
  valueFormat = "#,###.0",
  compareColor = 0x22c55e,
  areaFillOpacity = 0.12,
  yMin,
  yMax,
  showLegend = true,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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
        paddingLeft: 4,
        paddingRight: 8,
        paddingTop: 12,
        paddingBottom: 4,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 28,
          cellStartLocation: 0.05,
          cellEndLocation: 0.95,
        }),
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
        ...(yMin != null ? { min: yMin } : {}),
        ...(yMax != null ? { max: yMax } : {}),
        strictMinMax: yMin != null || yMax != null,
      })
    );

    const tip1 = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px opacity:0.85]{categoryX}[/]\n[bold #2563eb]●[/] ${currentLabel}: [bold]{valueY.formatNumber("${valueFormat}")}[/] ${valueUnit}`,
    });
    applyTooltipChrome(root, tip1);

    const tip2 = am5.Tooltip.new(root, {
      labelText: `[fontSize:11px opacity:0.85]{categoryX}[/]\n[bold #16a34a]◆[/] ${compareLabel}: [bold]{valueY.formatNumber("${valueFormat}")}[/] ${valueUnit}`,
    });
    applyTooltipChrome(root, tip2);

    const s1 = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: currentLabel,
        xAxis,
        yAxis,
        valueYField: "current",
        categoryXField: "category",
        tooltip: tip1,
      })
    );
    s1.strokes.template.setAll({
      strokeWidth: 2.5,
      stroke: am5.color(0x2563eb),
      lineCap: "round",
    });
    s1.fills.template.setAll({
      visible: true,
      fill: am5.color(0x2563eb),
      fillOpacity: areaFillOpacity,
    });

    const s2 = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: compareLabel,
        xAxis,
        yAxis,
        valueYField: "compare",
        categoryXField: "category",
        tooltip: tip2,
      })
    );
    s2.strokes.template.setAll({
      strokeWidth: 2.5,
      stroke: am5.color(compareColor),
      strokeDasharray: [6, 4],
      lineCap: "round",
    });
    s2.fills.template.setAll({
      visible: true,
      fill: am5.color(compareColor),
      fillOpacity: areaFillOpacity * 0.85,
    });

    const bulletCommon = (stroke: number) => {
      return (_r: am5.Root, _s: am5xy.LineSeries, dataItem: am5.DataItem<am5xy.ILineSeriesDataItem>) => {
        if (!dataItem?.dataContext) return undefined;
        return am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 3.5,
            fill: am5.color(0xffffff),
            stroke: am5.color(stroke),
            strokeWidth: 2,
          }),
        });
      };
    };
    s1.bullets.push(bulletCommon(0x2563eb));
    s2.bullets.push(bulletCommon(compareColor));

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        behavior: "none",
      })
    );

    if (showLegend) {
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          marginTop: 4,
          layout: root.horizontalLayout,
        })
      );
      legend.data.setAll([s1, s2]);
    }

    xAxis.data.setAll(data);
    s1.data.setAll(data);
    s2.data.setAll(data);

    styleAxisLabels(xAxis, yAxis);
    stylePlotGrid(xAxis, yAxis);

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [
    data,
    currentLabel,
    compareLabel,
    valueUnit,
    valueFormat,
    compareColor,
    areaFillOpacity,
    yMin,
    yMax,
    showLegend,
  ]);

  return (
    <div className="space-y-2">
      <div ref={divRef} className="h-[260px] w-full min-w-0" />
      <div className="flex flex-wrap items-center justify-center gap-6 border-t border-slate-100 pt-2 text-[10px] text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-8 rounded-sm bg-gradient-to-b from-blue-400 to-blue-600 shadow-sm ring-1 ring-blue-600/20" />
          <span className="font-medium text-slate-700">{currentLabel}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-8 border-t-[2.5px] border-dashed border-emerald-600" />
          <span className="font-medium text-slate-700">{compareLabel}</span>
        </span>
        <span className="text-slate-400">·</span>
        <span className="tabular-nums text-slate-500">Hover points for details</span>
      </div>
    </div>
  );
};

/**
 * Three line series + area — mirrors {@link LPGOPDailyProductivitytrend} daily line chart:
 * vertical X labels (-90°), bottom horizontal scrollbar, zoom cursor, container bullets (dot + value label).
 */
export type TripleLinePoint = { category: string; v0: number; v1: number; v2: number };

export const NgTripleLineAreaChart: React.FC<{
  data: TripleLinePoint[];
  seriesNames: [string, string, string];
  colors: [number, number, number];
  valueUnit?: string;
  valueFormat?: string;
  areaFillOpacity?: number;
  yMin?: number;
  yMax?: number;
  /** When false, category labels are hidden (month still available in tooltips / scrollbar). */
  showXAxisLabels?: boolean;
  className?: string;
}> = ({
  data,
  seriesNames,
  colors,
  valueUnit = "MMSCM",
  valueFormat = "#,###",
  areaFillOpacity = 0.14,
  yMin,
  yMax,
  showXAxisLabels = true,
  className = "h-[280px]",
}) => {
  const fields = ["v0", "v1", "v2"] as const;
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

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
        paddingBottom: showXAxisLabels ? 0 : 4,
        paddingTop: 8,
        paddingRight: 20,
        maxTooltipDistance: 0,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 1,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const xLabels = xAxis.get("renderer").labels.template;
    xLabels.setAll({
      rotation: -90,
      centerY: am5.p50,
      centerX: am5.p100,
      fontSize: 10,
      fontWeight: "700",
      paddingTop: showXAxisLabels ? 10 : 0,
      paddingRight: 0,
      inside: false,
      oversizedBehavior: "none",
      maxWidth: 200,
      minPosition: 0.01,
      maxPosition: 0.99,
      fill: am5.color(0x000000),
      visible: showXAxisLabels,
    });
    xAxis.get("renderer").grid.template.setAll({ visible: true, location: 0.5 });
    xLabels.adapters.add("text", (text: string) => text);

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: valueFormat,
        ...(yMin != null ? { min: yMin } : {}),
        ...(yMax != null ? { max: yMax } : {}),
        strictMinMax: yMin != null || yMax != null,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10, fontWeight: "700" });

    const seriesArr: am5xy.LineSeries[] = [];
    for (let i = 0; i < 3; i++) {
      const field = fields[i]!;
      const name = seriesNames[i]!;
      const col = colors[i]!;
      const tip = am5.Tooltip.new(root, {
        labelText: `[bold]{valueY.formatNumber("${valueFormat}")}[/] ${valueUnit}\n[fontSize:11px opacity:0.85]{categoryX}[/]\n[bold]${name}[/]`,
        pointerOrientation: "horizontal",
        dx: 5,
      });
      applyTooltipChrome(root, tip);

      const s = chart.series.push(
        am5xy.LineSeries.new(root, {
          name,
          xAxis,
          yAxis,
          valueYField: field,
          categoryXField: "category",
          stroke: am5.color(col),
          fill: am5.color(col),
          tooltip: tip,
          stacked: false,
        })
      );
      s.strokes.template.setAll({
        strokeWidth: 2.5,
        stroke: am5.color(col),
        lineCap: "round",
        lineJoin: "round",
      });
      s.fills.template.setAll({
        visible: true,
        fill: am5.color(col),
        fillOpacity: areaFillOpacity,
      });

      s.bullets.push((r, _series, dataItem) => {
        if (!dataItem?.dataContext) return undefined;
        const valueY = dataItem.get("valueY") as number | undefined;
        if (valueY == null || !Number.isFinite(valueY)) return undefined;
        const roundvalue = Math.round(valueY);
        const container = am5.Container.new(r, {});
        container.children.push(
          am5.Circle.new(r, {
            radius: 5,
            fill: am5.color(col),
            stroke: r.interfaceColors.get("background"),
            strokeWidth: 2,
          })
        );
        container.children.push(
          am5.Label.new(r, {
            text: `${roundvalue}`,
            centerX: am5.p50,
            centerY: am5.p100,
            populateText: true,
            fontWeight: "700",
            fontSize: 10,
            fill: am5.color(col),
            background: am5.RoundedRectangle.new(r, { fill: am5.color(0xffffff), fillOpacity: 0.85 }),
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 6,
            paddingRight: 6,
            dy: -8,
          })
        );
        return am5.Bullet.new(r, { sprite: container });
      });
      seriesArr.push(s);
    }

    chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis }));

    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 8,
        layout: root.horizontalLayout,
      })
    );
    legend.data.setAll(chart.series.values);
    legend.markers.template.setAll({ width: 10, height: 10 });
    legend.labels.template.setAll({ fontSize: 10, fill: am5.color(0x334155), fontWeight: "700" });
    legend.itemContainers.template.setAll({
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 2,
      paddingBottom: 2,
    });

    xAxis.data.setAll(data);
    seriesArr.forEach((s) => s.data.setAll(data));

    const scrollEnd = data.length <= 20 ? 1 : Math.min(1, 20 / data.length);
    chart.set(
      "scrollbarX",
      am5.Scrollbar.new(root, {
        orientation: "horizontal",
        marginBottom: showXAxisLabels ? 15 : 10,
        height: 10,
        start: 0,
        end: scrollEnd,
      })
    );

    yAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.35,
      strokeDasharray: [4, 4],
      stroke: am5.color(GRID_STROKE),
    });

    seriesArr.forEach((s) => s.appear(1000));
    chart.appear(1000, 100);

    scheduleResize(root);
    resizeCleanupRef.current = attachResizeObserver(root, el);

    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      root.dispose();
      rootRef.current = null;
    };
  }, [data, seriesNames, colors, valueUnit, valueFormat, areaFillOpacity, yMin, yMax, showXAxisLabels]);

  return <div ref={divRef} className={`w-full min-w-0 ${className}`} />;
};
