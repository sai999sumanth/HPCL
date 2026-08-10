import React, { useEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

/** Same shell as KPI cards (shared with widgets + unified drill). */
export const EQUIPMENT_HEALTH_KPI_CARD_SHELL =
  "relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md";

export const CHART_PLOT_HEIGHT_PX = 280;

/**
 * Avg closing-time progress bars — same blue→purple→pink family as amCharts SR bars above,
 * but shifted hues so the two rows don't share identical colors.
 * (amCharts default ≈ #67b7dc → #6794dc → #6771dc → #8067dc → #a367dc → #c767dc → #dc67ce …)
 */
export const AVG_CLOSING_TIME_BAR_COLORS: readonly string[] = [
  "#5DAFE8",
  "#5C8FE0",
  "#5A72E0",
  "#735FE8",
  "#925EE0",
  "#B05AD8",
  "#D05AC8",
  "#D05AA8",
  "#D07088",
  "#D08870",
];

const VENDOR_SLICE_SOLIDS: readonly string[] = [
  "#2563EB", "#0EA5E9", "#14B8A6", "#22C55E", "#F59E0B", "#8B5CF6",
  "#2563EB", "#0EA5E9", "#14B8A6", "#22C55E", "#F59E0B", "#8B5CF6",
  "#2563EB", "#0EA5E9", "#14B8A6", "#22C55E", "#F59E0B", "#8B5CF6",
  "#2563EB", "#0EA5E9", "#14B8A6", "#22C55E", "#F59E0B", "#8B5CF6",
];

export type VendorDistributionSlice = { name: string; value: number };

const STATUS_SLICE_SOLIDS: Record<string, string> = {
  Open:     "#7dd3fc",
  Reopened: "#fca5a5",
  Resolved: "#86efac",
  Closed:   "#cbd5e1",
  Other:    "#fcd34d",
};

function sliceSolidHex(name: string, index: number, isStatusChart: boolean): string {
  if (isStatusChart) return STATUS_SLICE_SOLIDS[name] ?? STATUS_SLICE_SOLIDS.Other;
  return VENDOR_SLICE_SOLIDS[index % VENDOR_SLICE_SOLIDS.length] ?? VENDOR_SLICE_SOLIDS[0];
}

function hexStrToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

type ChartDataItem = VendorDistributionSlice & {
  _index: number;
  _colorHex: string;
  _dimmed: boolean;
  _isActive: boolean;
  pct: string;
};

function truncateAxisLabel(name: string, maxLen = 9): string {
  const s = String(name).trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}...`;
}

export function VendorWiseRechartsBarChart({
  data,
  chartModeKey,
  activeCategory,
  onBarClick,
  plotHeightPx = CHART_PLOT_HEIGHT_PX,
  scrollbarWhenAbove = 0,
  scrollbarVisibleCount = 5,
}: {
  data: VendorDistributionSlice[];
  chartModeKey: string;
  activeCategory?: string | null;
  onBarClick?: (name: string) => void;
  plotHeightPx?: number;
  /** When `data.length` exceeds this, show a horizontal scrollbar (0 = off). */
  scrollbarWhenAbove?: number;
  /** Number of categories visible in the scrollbar viewport. */
  scrollbarVisibleCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef     = useRef<am5.Root | null>(null);

  const isStatusChart = chartModeKey.startsWith("status:");
  const total = data.reduce((s, d) => s + d.value, 0);
  const useScrollbar =
    scrollbarWhenAbove > 0 && data.length > scrollbarWhenAbove;
  const containerHeightPx = useScrollbar ? plotHeightPx + 22 : plotHeightPx;

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    const root = am5.Root.new(containerRef.current);
    rootRef.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const useScrollbar =
      scrollbarWhenAbove > 0 && data.length > scrollbarWhenAbove;

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        layout: root.verticalLayout,
        paddingLeft: 4,
        paddingRight: 12,
        paddingBottom: useScrollbar ? 8 : 0,
        paddingTop: 4,
      })
    );

    // ── X axis ──────────────────────────────────────────────────────────────
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: useScrollbar ? 40 : 20,
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
    });
    xRenderer.grid.template.setAll({ visible: false });
    xRenderer.setAll({ stroke: am5.color(0xe2e8f0), strokeWidth: 1, strokeOpacity: 1 });
    xRenderer.labels.template.setAll({
      fontSize: 10,
      fill: am5.color(0x334155),
      paddingTop: 4,
      rotation: 0,
      centerX: am5.p50,
      centerY: am5.p50,
      oversizedBehavior: "none",
      textAlign: "center",
      maxWidth: useScrollbar ? 88 : 72,
    });
    if (useScrollbar) {
      xRenderer.labels.template.adapters.add("text", (text, target) => {
        const ctx = target.dataItem?.dataContext as ChartDataItem | undefined;
        if (!ctx?.name) return text;
        return truncateAxisLabel(ctx.name, 9);
      });
    }

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "name",
        renderer: xRenderer,
      })
    );

    // ── Y axis ──────────────────────────────────────────────────────────────
    const yRenderer = am5xy.AxisRendererY.new(root, {});
    yRenderer.grid.template.setAll({
      stroke: am5.color(0xcbd5e1),
      strokeDasharray: [3, 3],
      strokeOpacity: 0.9,
    });
    yRenderer.setAll({
      stroke: am5.color(0xe2e8f0),
      strokeWidth: 1,
      strokeOpacity: 1,
    });
    yRenderer.labels.template.setAll({
      fontSize: 11,
      fill: am5.color(0x64748b),
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        strictMinMax: false,
        extraMax: 0.12,
        min: 0,
      })
    );
    yAxis.adapters.add("min", (min) => Math.max(0, (min as number) ?? 0));

    // ── Series ───────────────────────────────────────────────────────────────
    // amCharts default color set (used for vendor/location/zone charts only).
    // For status drill charts we keep our custom STATUS_SLICE_SOLIDS mapping.
    const defaultColors = chart.get("colors");
    const colTooltip = am5.Tooltip.new(root, {
      pointerOrientation: "vertical",
      getFillFromSprite: false,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 10,
      paddingRight: 10,
    });
    colTooltip.get("background")?.setAll({
      fill: am5.color(0xffffff),
      stroke: am5.color(0xe2e8f0),
      strokeWidth: 1,
    });
    colTooltip.label.setAll({ fontSize: 12, fill: am5.color(0x1e293b) });

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "name",
      })
    );

    series.columns.template.setAll({
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      maxWidth: 48,
      strokeOpacity: 0,
      cursorOverStyle: onBarClick ? "pointer" : "default",
      tooltip: colTooltip,
      tooltipText: "[bold]{name}[/]\n[bold]Count:[/] {value} SR ({pct}%)",
    });

    // Per-bar fill colour
    series.columns.template.adapters.add("fill", (_fill, target) => {
      const ctx = target.dataItem?.dataContext as ChartDataItem | undefined;
      if (!ctx) return _fill;
      if (isStatusChart) return am5.color(hexStrToInt(ctx._colorHex));
      return defaultColors.getIndex(ctx._index);
    });

    // Active bar: coloured border stroke; inactive stroke hidden
    series.columns.template.adapters.add("stroke", (_stroke, target) => {
      const ctx = target.dataItem?.dataContext as ChartDataItem | undefined;
      if (!ctx) return _stroke;
      if (ctx._isActive) return am5.color(0x475569);
      return isStatusChart ? am5.color(hexStrToInt(ctx._colorHex)) : defaultColors.getIndex(ctx._index);
    });
    series.columns.template.adapters.add("strokeWidth", (_sw, target) => {
      const ctx = target.dataItem?.dataContext as ChartDataItem | undefined;
      return ctx?._isActive ? 2 : 0;
    });
    series.columns.template.adapters.add("strokeOpacity", (_op, target) => {
      const ctx = target.dataItem?.dataContext as ChartDataItem | undefined;
      return ctx?._isActive ? 1 : 0;
    });

    // Dim non-active bars
    series.columns.template.adapters.add("fillOpacity", (_op, target) => {
      const ctx = target.dataItem?.dataContext as ChartDataItem | undefined;
      return ctx?._dimmed ? 0.38 : 1;
    });

    // Click handler
    if (onBarClick) {
      series.columns.template.events.on("click", (ev) => {
        const ctx = ev.target.dataItem?.dataContext as ChartDataItem | undefined;
        if (ctx?.name) onBarClick(ctx.name);
      });
    }

    // ── Data ─────────────────────────────────────────────────────────────────
    const chartData: ChartDataItem[] = data.map((d, i) => ({
      ...d,
      _index: i,
      _colorHex: isStatusChart ? sliceSolidHex(d.name, i, true) : "#000000",
      _isActive: activeCategory === d.name,
      _dimmed:
        activeCategory != null && activeCategory !== "" && d.name !== activeCategory,
      pct: total > 0 ? ((d.value / total) * 100).toFixed(1) : "0",
    }));

    xAxis.data.setAll(chartData);
    series.data.setAll(chartData);

    if (useScrollbar) {
      const visible = Math.min(scrollbarVisibleCount, chartData.length);
      const scrollEnd = visible / chartData.length;
      const scrollbarX = am5.Scrollbar.new(root, {
        orientation: "horizontal",
        marginBottom: 0,
        height: 8,
        minHeight: 8,
        marginTop: 4,
        start: 0,
        end: scrollEnd,
      });
      scrollbarX.get("background")?.setAll({
        fill: am5.color(0xe5e7eb),
        fillOpacity: 0.85,
      });
      scrollbarX.thumb.setAll({
        height: 8,
        fill: am5.color(0x94a3b8),
        fillOpacity: 0.9,
      });
      [scrollbarX.startGrip, scrollbarX.endGrip].forEach((grip) => {
        grip.setAll({ width: 18, height: 18, scale: 0.9 });
        grip.get("icon")?.setAll({ forceHidden: true });
        grip.get("background")?.setAll({
          fill: am5.color(0x94a3b8),
          fillOpacity: 0.9,
        });
      });
      chart.set("scrollbarX", scrollbarX);
      chart.bottomAxesContainer.children.push(scrollbarX);

      const cursor = am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis });
      chart.set("cursor", cursor);
    }

    series.appear(800);
    chart.appear(800, 100);

    return () => {
      root.dispose();
      rootRef.current = null;
    };
  }, [data, chartModeKey, activeCategory, onBarClick, plotHeightPx, scrollbarWhenAbove, scrollbarVisibleCount]);

  if (data.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0 shrink-0"
      style={{ height: containerHeightPx }}
    />
  );
}
