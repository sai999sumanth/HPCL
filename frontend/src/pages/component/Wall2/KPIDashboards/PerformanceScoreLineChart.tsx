import React, { useEffect, useRef, type CSSProperties } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

/** Same primary line blue as Daily Productivity trend (`0x297ab1`). */
const PRODUCTIVITY_LINE_BLUE = 0x297ab1;

const MULTI_LINE_COLORS = [
  PRODUCTIVITY_LINE_BLUE,
  0x388e3c,
  0xf57c00,
  0xc62828,
  0x7b1fa2,
  0x00897b,
];


export interface PerformanceScoreLineChartProps {
  chartData: Record<string, unknown>[];
  /** Series keys on each row (e.g. Score or zone names) */
  groups: string[];
  /** Optional amCharts color ints per series (same order as `groups`); falls back to default palette. */
  seriesColors?: number[];
  categoryField?: string;
  categoryLabelField?: string;
  /** Shown in tooltip after value — same idea as "Cylinder/Hour" in Daily Productivity */
  valueSuffix?: string;
  /**
   * When true (default if `groups.length > 1`), tooltip lines show the series name, e.g. `MS: 1.23`.
   * Set false to show only the numeric value (plus `valueSuffix`) like the legacy single-metric chart.
   */
  tooltipSeriesName?: boolean;
  height?: number;
  className?: string;
  /** X-axis category label rotation (Daily Productivity monthly overall uses `-90`) */
  xAxisLabelRotation?: number;
  /** When false, the X scrollbar is hidden entirely. Defaults to true. */
  showScrollbar?: boolean;
  /** Horizontal scrollbar track height in px. Defaults to 10. */
  scrollbarHeight?: number;
  /** Space below the chart for the scrollbar. Defaults to 15. */
  scrollbarMarginBottom?: number;
  /** Render as bar (column) chart instead of line. Defaults to "line". */
  chartType?: "line" | "bar";
  /** When true, suppresses the built-in amCharts legend (parent renders its own). */
  hideLegend?: boolean;
  /** Number of X-axis categories visible by default (overrides auto-calculation). */
  defaultVisibleCategories?: number;
  /** Label used in bar tooltip for the group/series dimension (e.g. "Zone", "Region", "Sales Area"). */
  groupLabel?: string;
  /** Label used in bar tooltip for the value dimension (e.g. "Hours", "Liters"). Defaults to "Hours". */
  valueLabel?: string;
  /**
   * Called when a bar is clicked. `groupName` is the series key (e.g. zone name),
   * `categoryValue` is the X-axis category value (e.g. month ISO string).
   */
  onBarClick?: (params: { groupName: string; categoryValue: string }) => void;
  /**
   * Extra fields to append to the tooltip below the main value line.
   * Each entry reads `data[key]` and shows `Label: value`.
   */
  tooltipExtraFields?: { key: string; label: string; /** Whole number — no decimal places */ integer?: boolean }[];
  /**
   * When set, the line-chart tooltip shows "Label: date" as the first line
   * instead of appending the date after the value.  e.g. "Date"
   */
  tooltipDateLabel?: string;
  /**
   * When set, the line-chart tooltip shows "Label: value" for the main metric
   * instead of just the bold value.  e.g. "Dryout Hours"
   */
  tooltipValueLabel?: string;
  /**
   * When true, bar chart tooltipExtraFields use `{key}` directly (not `{seriesName_key}`).
   * Use when each row already has the field as a top-level key (single-series bar charts).
   */
  barTooltipExtraFieldsDirect?: boolean;
  /**
   * When true, the group label in bar tooltip shows the category (X-axis) value instead of the
   * series name. Use for single-series bar charts where each bar represents a distinct entity
   * (e.g. zone name stored as the category field, not the series name).
   */
  barGroupLabelFromCategory?: boolean;
  /**
   * When set on grouped bar charts, tooltip shows this label + X-axis category (e.g. Month) above the group line.
   */
  barTooltipCategoryLabel?: string;
  /**
   * Override the bar width percentage (default: 65% for multi-series, 80% for single-series).
   */
  barWidthPercent?: number;
  /**
   * When provided, each bar column is individually coloured by cycling through this palette
   * (amCharts color ints). Overrides the single series fill colour per data item.
   */
  perBarColors?: number[];
  /**
   * Controls the padding between category groups on the X axis (0–0.5).
   * Smaller value = tighter groups with less gap between them.
   * Defaults to 0.1 (i.e. cellStartLocation=0.1, cellEndLocation=0.9).
   */
  barCellPadding?: number;
}

function formatTooltipExtraValue(raw: unknown, integer?: boolean): string | null {
  if (raw == null || raw === "") return null;
  const num = Number(raw);
  if (Number.isFinite(num)) {
    return integer
      ? num.toLocaleString("en-IN", { maximumFractionDigits: 0 })
      : num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(raw);
}

/**
 * Line chart aligned with Daily Productivity trend: tooltip `[bold]value[/] suffix + newline + month label`,
 * container bullets (circle + value label), optional legend (multi-series), scrollbar + zoom cursor.
 */
function PerformanceScoreLineChart({
  chartData,
  groups,
  seriesColors,
  categoryField = "cat",
  categoryLabelField = "label",
  valueSuffix = "score",
  tooltipSeriesName,
  height = 350,
  className = "",
  xAxisLabelRotation = -90,
  showScrollbar = true,
  scrollbarHeight = 10,
  scrollbarMarginBottom = 15,
  chartType = "line",
  hideLegend = false,
  defaultVisibleCategories,
  groupLabel = "Zone",
  valueLabel = "Hours",
  onBarClick,
  tooltipExtraFields,
  tooltipDateLabel,
  tooltipValueLabel,
  barTooltipExtraFieldsDirect = false,
  barGroupLabelFromCategory = false,
  barTooltipCategoryLabel,
  barWidthPercent,
  perBarColors,
  barCellPadding = 0.1,
}: PerformanceScoreLineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<am5.Root | null>(null);

  useEffect(() => {
    if (!containerRef.current || chartData.length === 0 || groups.length === 0) return;
    const showSeriesInTooltip = tooltipSeriesName ?? groups.length > 1;

    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    const root = am5.Root.new(containerRef.current);
    rootRef.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingBottom: showScrollbar ? Math.min(24, Math.round(scrollbarMarginBottom * 0.5)) : 0,
        paddingLeft: 8,
        paddingRight: 20,
      })
    );

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 1,
      cellStartLocation: barCellPadding,
      cellEndLocation: 1 - barCellPadding,
    });
    // X-axis vertical grid lines — subtle light gray
    xRenderer.grid.template.setAll({
      visible: true,
      stroke: am5.color(0xe2e8f0),
      strokeWidth: 1,
      strokeOpacity: 0.8,
      location: 0.5,
    });
    // X-axis baseline stroke
    xRenderer.setAll({
      stroke: am5.color(0x94a3b8),
      strokeWidth: 1.5,
      strokeOpacity: 1,
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: categoryField,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    // When rotation is 0 (horizontal), anchor to center; when angled, anchor to right edge
    const isHorizontal = xAxisLabelRotation === 0;
    xAxis.get("renderer").labels.template.setAll({
      rotation: xAxisLabelRotation,
      centerY: am5.p50,
      centerX: isHorizontal ? am5.p50 : am5.p100,
      fontSize: 10,
      paddingTop: isHorizontal ? 6 : 10,
      paddingRight: 0,
      inside: false,
      oversizedBehavior: "wrap",
      maxWidth: isHorizontal ? 80 : 200,
      minPosition: 0.01,
      maxPosition: 0.99,
      fill: am5.color(0x475569),
    });
    xAxis.get("renderer").labels.template.adapters.add("text", (_text, target) => {
      const dataItem = target.dataItem;
      if (!dataItem) return "";
      const ctx = dataItem.dataContext as Record<string, unknown>;
      const lbl = ctx?.[categoryLabelField];
      if (lbl != null && String(lbl).trim() !== "") return String(lbl);
      const cat = ctx?.[categoryField];
      return cat != null ? String(cat) : "";
    });

    const yRenderer = am5xy.AxisRendererY.new(root, {});
    // Y-axis horizontal grid lines — subtle dashed
    yRenderer.grid.template.setAll({
      visible: true,
      stroke: am5.color(0xe2e8f0),
      strokeWidth: 1,
      strokeOpacity: 0.8,
      strokeDasharray: [4, 3],
    });
    // Y-axis left baseline stroke
    yRenderer.setAll({
      stroke: am5.color(0x94a3b8),
      strokeWidth: 1.5,
      strokeOpacity: 1,
    });

    // Y-axis: dynamically scales on scroll, clamped to 0 minimum via adapter
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        strictMinMax: false,
        extraMax: 0.12,
      })
    );
    // Prevent Y axis from going below 0 without locking the max
    yAxis.adapters.add("min", (min) => Math.max(0, (min as number) ?? 0));
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fill: am5.color(0x475569),
    });

    xAxis.data.setAll(chartData as object[]);

    groups.forEach((groupName, gi) => {
      const colorHex =
        seriesColors != null && seriesColors.length > 0
          ? seriesColors[gi % seriesColors.length]!
          : MULTI_LINE_COLORS[gi % MULTI_LINE_COLORS.length]!;
      const color = am5.color(colorHex);

      const gName = groupName;

      if (chartType === "bar") {
        const suffix = valueSuffix ? ` ${valueSuffix}` : "";

        // One tooltip instance per series — attached to the column template so only
        // the single hovered bar shows its tooltip, not all bars in the category.
        const colTooltip = am5.Tooltip.new(root, {
          pointerOrientation: "vertical",
          getFillFromSprite: true,
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 10,
          paddingRight: 10,
        });

        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: groupName,
            xAxis,
            yAxis,
            valueYField: groupName,
            categoryXField: categoryField,
            fill: color,
            stroke: am5.color(0xffffff),
          })
        );

        // tooltip on the template → fires only for the specific bar being hovered
        const resolvedBarWidth = barWidthPercent ?? (groups.length > 1 ? 65 : 80);
        colTooltip.label.adapters.add("text", (_text, target) => {
          const di = target.dataItem;
          if (!di) return "";
          const ctx = di.dataContext as Record<string, unknown>;
          const categoryVal = ctx[categoryField];
          const monthLabel = String(ctx[categoryLabelField] ?? categoryVal ?? "");
          const vyRaw = ctx[gName];
          const vy =
            typeof vyRaw === "number"
              ? vyRaw
              : vyRaw != null && vyRaw !== ""
                ? parseFloat(String(vyRaw))
                : NaN;
          const vStr = Number.isFinite(vy)
            ? vy.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : String(vyRaw ?? "");
          const categoryPrefix = barTooltipCategoryLabel
            ? `[bold]${barTooltipCategoryLabel}:[/] ${monthLabel}\n`
            : "";
          const groupVal = barGroupLabelFromCategory ? String(categoryVal ?? "") : gName;
          const extraLines = (tooltipExtraFields ?? [])
            .map(({ key, label, integer }) => {
              const fieldRef = barTooltipExtraFieldsDirect ? key : `${gName}_${key}`;
              const display = formatTooltipExtraValue(ctx[fieldRef], integer);
              if (display == null) return null;
              return `[bold]${label}:[/] ${display}`;
            })
            .filter(Boolean)
            .join("\n");
          return `${categoryPrefix}[bold]${groupLabel}:[/] ${groupVal}\n[bold]${valueLabel}:[/] ${vStr}${suffix}${extraLines ? `\n${extraLines}` : ""}`;
        });
        series.columns.template.setAll({
          width: am5.percent(resolvedBarWidth),
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
          strokeWidth: 1,
          stroke: am5.color(0xffffff),
          strokeOpacity: 0.4,
          tooltipY: 0,
          cursorOverStyle: onBarClick ? "pointer" : "default",
          tooltip: colTooltip,
          tooltipText: " ",
        });

        // Collapse null/zero columns to zero width so they don't leave gaps in grouped bars
        series.columns.template.adapters.add("width", (width, target) => {
          const ctx = target.dataItem?.dataContext as Record<string, unknown> | undefined;
          const val = ctx?.[groupName];
          return (val == null || Number(val) === 0) ? am5.p0 : width;
        });
        series.columns.template.adapters.add("forceHidden", (hidden, target) => {
          const ctx = target.dataItem?.dataContext as Record<string, unknown> | undefined;
          const val = ctx?.[groupName];
          return (val == null || Number(val) === 0) ? true : hidden;
        });

        // Per-bar colour — override fill/stroke per data item when palette is supplied
        if (perBarColors && perBarColors.length > 0) {
          series.columns.template.adapters.add("fill", (_fill, target) => {
            const di = target.dataItem;
            const idx = di ? series.dataItems.indexOf(di as am5.DataItem<am5xy.IColumnSeriesDataItem>) : 0;
            return am5.color(perBarColors[(idx < 0 ? 0 : idx) % perBarColors.length]);
          });
          series.columns.template.adapters.add("stroke", (_stroke, target) => {
            const di = target.dataItem;
            const idx = di ? series.dataItems.indexOf(di as am5.DataItem<am5xy.IColumnSeriesDataItem>) : 0;
            return am5.color(perBarColors[(idx < 0 ? 0 : idx) % perBarColors.length]);
          });
        }

        // Click → pass the clicked zone + month back to parent
        if (onBarClick) {
          series.columns.template.events.on("click", (ev) => {
            const dataItem = ev.target.dataItem as am5.DataItem<am5xy.IColumnSeriesDataItem> | undefined;
            if (!dataItem) return;
            const ctx = dataItem.dataContext as Record<string, unknown>;
            const categoryValue = String(ctx?.[categoryField] ?? "");
            onBarClick({ groupName: gName, categoryValue });
          });
        }

        // Rotated value label (90°) above each bar, colored same as bar
        series.bullets.push((rootBullet, bulletSeries, dataItem) => {
          const ctx = dataItem.dataContext as Record<string, unknown>;
          const vyRaw = ctx[groupName];
          const valueY =
            typeof vyRaw === "number"
              ? vyRaw
              : vyRaw != null && vyRaw !== ""
                ? parseFloat(String(vyRaw))
                : NaN;
          if (!Number.isFinite(valueY)) return undefined;

          return am5.Bullet.new(rootBullet, {
            locationY: 1,
            sprite: am5.Label.new(rootBullet, {
              text: valueY.toFixed(2),
              centerX: am5.p50,
              centerY: am5.p50,
              populateText: true,
              fontSize: 9,
              fontWeight: "600",
              fill: am5.color(0x000000),
              rotation: -90,
              dy: -28,
            }),
          });
        });

        series.data.setAll(chartData as object[]);
        series.appear(1000);
      } else {
        const tooltipObj = am5.Tooltip.new(root, {
          labelText: " ",
          pointerOrientation: "horizontal",
          dx: 5,
        });
        tooltipObj.label.adapters.add("text", (_text, target) => {
          const di = target.dataItem;
          if (!di) return "";
          const ctx = di.dataContext as Record<string, unknown>;
          const monthLabel = (ctx?.[categoryLabelField] ?? ctx?.[categoryField] ?? "") as string;
          const vyRaw = ctx[gName];
          const vy =
            typeof vyRaw === "number"
              ? vyRaw
              : vyRaw != null && vyRaw !== ""
                ? parseFloat(String(vyRaw))
                : NaN;
          const vStr = Number.isFinite(vy) ? vy.toFixed(2) : String(vyRaw ?? "");
          const valueLine = showSeriesInTooltip
            ? `[bold]${gName}: ${vStr}[/]${valueSuffix ? ` ${valueSuffix}` : ""}`
            : `[bold]${vStr}[/]${valueSuffix ? ` ${valueSuffix}` : ""}`;
          const extraLines = (tooltipExtraFields ?? [])
            .map(({ key, label, integer }) => {
              const display = formatTooltipExtraValue(ctx[key], integer);
              if (display == null) return null;
              return `[bold]${label}:[/] ${display}`;
            })
            .filter(Boolean)
            .join("\n");
          // If caller supplies explicit date/value labels → Date first, then labeled value, then extras
          if (tooltipDateLabel && tooltipValueLabel) {
            const dateLine = `[bold]${tooltipDateLabel}:[/] ${monthLabel}`;
            const labeledValueLine = `[bold]${tooltipValueLabel}:[/] ${vStr}${valueSuffix ? ` ${valueSuffix}` : ""}`;
            return `${dateLine}\n${labeledValueLine}${extraLines ? "\n" + extraLines : ""}`;
          }
          return `${valueLine}\n${monthLabel}${extraLines ? "\n" + extraLines : ""}`;
        });

        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: groupName,
            xAxis,
            yAxis,
            valueYField: groupName,
            categoryXField: categoryField,
            stroke: color,
            fill: color,
            tooltip: tooltipObj,
          })
        );
        series.strokes.template.setAll({ strokeWidth: 2 });
        series.fills.template.set("visible", false);
        series.data.setAll(chartData as object[]);

        series.bullets.push((rootBullet, _series, dataItem) => {
          const ctx = dataItem.dataContext as Record<string, unknown>;
          const vyRaw = ctx[groupName];
          const valueY =
            typeof vyRaw === "number"
              ? vyRaw
              : vyRaw != null && vyRaw !== ""
                ? parseFloat(String(vyRaw))
                : NaN;
          if (!Number.isFinite(valueY)) return undefined;
          const container = am5.Container.new(rootBullet, {});
          container.children.push(
            am5.Circle.new(rootBullet, {
              radius: 4,
              fill: color,
              stroke: rootBullet.interfaceColors.get("background"),
              strokeWidth: 2,
            })
          );
          container.children.push(
            am5.Label.new(rootBullet, {
              text: `${valueY.toFixed(2)}`,
              centerX: am5.p50,
              centerY: am5.p100,
              populateText: true,
              fontWeight: "600",
              fontSize: 10,
              fill: color,
              background: am5.RoundedRectangle.new(rootBullet, {
                fill: am5.color(0xffffff),
                fillOpacity: 0.9,
              }),
              paddingTop: 4,
              paddingBottom: 4,
              paddingLeft: 6,
              paddingRight: 6,
              dy: -8,
            })
          );
          return am5.Bullet.new(rootBullet, { sprite: container });
        });
        series.appear(1000);
      }
    });

    // Legend: compact, small markers + tight spacing
    if (groups.length > 1 && !hideLegend) {
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          layout: root.horizontalLayout,
          marginTop: 4,
          marginBottom: 0,
          paddingTop: 0,
          paddingBottom: 0,
        })
      );
      legend.labels.template.setAll({
        fontSize: 9,
        paddingLeft: 2,
        paddingRight: 6,
      });
      legend.markers.template.setAll({
        width: 10,
        height: 10,
      });
      legend.markerRectangles.template.setAll({
        cornerRadiusTL: 2,
        cornerRadiusTR: 2,
        cornerRadiusBL: 2,
        cornerRadiusBR: 2,
      });
      if (legend.valueLabels) legend.valueLabels.template.setAll({ forceHidden: true });
      legend.data.setAll(chart.series.values);
    }

    // For bar charts: cursor without xAxis snapping so grouped tooltips don't fire;
    // each column template handles its own tooltip on hover.
    const cursor = am5xy.XYCursor.new(root, {
      behavior: "zoomX",
      ...(chartType !== "bar" ? { xAxis } : {}),
    });
    chart.set("cursor", cursor);
    if (showScrollbar) {
      // When many series (groups) exist, limit to fewer visible categories so bars stay readable.
      // >15 groups → show 1 category at a time; >7 → 2; otherwise up to 20.
      // defaultVisibleCategories overrides the auto-calculation when explicitly set.
      const autoMax = groups.length > 15 ? 1 : groups.length > 7 ? 2 : 20;
      const maxVisible = defaultVisibleCategories ?? autoMax;
      const scrollEnd = chartData.length <= maxVisible ? 1 : Math.min(1, maxVisible / chartData.length);
      const scrollbarX = am5.Scrollbar.new(root, {
        orientation: "horizontal",
        marginBottom: scrollbarMarginBottom,
        height: scrollbarHeight,
        marginTop: -5,
        start: 0,
        end: scrollEnd,
      });
      chart.set("scrollbarX", scrollbarX);
      chart.bottomAxesContainer.children.push(scrollbarX);
    }

    chart.appear(1000, 100);

    return () => {
      root.dispose();
      rootRef.current = null;
    };
  }, [chartData, groups, seriesColors, height, categoryField, categoryLabelField, valueSuffix, tooltipSeriesName, xAxisLabelRotation, showScrollbar, scrollbarHeight, scrollbarMarginBottom, chartType, hideLegend, defaultVisibleCategories, groupLabel, valueLabel, onBarClick, tooltipExtraFields, tooltipDateLabel, tooltipValueLabel, barTooltipExtraFieldsDirect, barGroupLabelFromCategory, barTooltipCategoryLabel, barWidthPercent, perBarColors, barCellPadding]);

  const style: CSSProperties = { width: "100%" };
  if (height != null && height > 0) style.height = `${height}px`;
  else style.height = "100%";

  return <div ref={containerRef} className={className} style={style} />;
}

export default PerformanceScoreLineChart;
