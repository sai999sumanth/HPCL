import React, { useEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { KPI_AM3_ZONE_BAR_3D, KPI_AM3_ZONE_BAR_GLASS_FILL_ALPHA } from "@/lib/kpiAm3Bar3D";
import {
  LPG_REJECTION_GD_PT_CS_COLORS,
  ZONE_COLOR_PALETTE,
} from "@/components/widgets/zone-grouped-bar";

export { LPG_REJECTION_GD_PT_CS_COLORS, ZONE_COLOR_PALETTE };

/** Line/accent colors for optional right-axis overall line */
const LINE_COLOR = 0x1976d2;
const LINE_LABEL_COLOR = 0x0288d1;
const LINE_LABEL_BG = 0xefefef;

function getYAxisRange(
  values: number[],
  paddingPercent = 0.1,
  minAtZero = true,
  /** Extra headroom above max so value/zone labels above columns are not clipped */
  topLabelHeadroomRatio = 0
): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 100 };
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  /** For bar charts (minAtZero), scale max from the tallest visible value only */
  const range = minAtZero ? maxVal || 1 : maxVal - minVal || 1;
  // Only use paddingPercent — removed hardcoded +30% that was inflating the axis
  const padding = range * paddingPercent;
  const headroom = range * topLabelHeadroomRatio;
  if (minAtZero) {
    return {
      min: 0,
      max: maxVal + padding + headroom,
    };
  }
  const rawMin = minVal - padding;
  return {
    min: rawMin,
    max: maxVal + padding + headroom,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Blend two 0xRRGGBB colors (t=0 → a, t=1 → b). */
function blendHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * Pseudo-3D / glass column: lighter top → saturated mid → darker base (amCharts 5 has no true 3D columns).
 * Gradient rotation matches **Zone-wise Retail Outlet Stockouts Distribution** amCharts 3 `angle`
 * (`KPI_AM3_ZONE_BAR_3D.angle`) so lighting aligns with that 3D bar reference.
 */
function glassBarGradient(root: am5.Root, baseHex: number): am5.LinearGradient {
  const top = blendHex(baseHex, 0xffffff, 0.42);
  const mid = blendHex(baseHex, 0xffffff, 0.08);
  const bottom = blendHex(baseHex, 0x000000, 0.28);
  return am5.LinearGradient.new(root, {
    rotation: 90 - KPI_AM3_ZONE_BAR_3D.angle,
    stops: [
      { color: am5.color(top), offset: 0 },
      { color: am5.color(mid), offset: 0.45 },
      { color: am5.color(bottom), offset: 1 },
    ],
  });
}

/** One series per key; preserves first-seen order (amCharts cannot share valueYField across duplicate names). */
function dedupeGroupsPreserveOrder(groups: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    if (seen.has(g)) continue;
    seen.add(g);
    out.push(g);
  }
  return out;
}

/** Values driving the left Y scale for a subset of rows (matches full-chart aggregation). */
function computeZoneValuesForPlotRows(
  rows: Record<string, unknown>[],
  stacked: boolean,
  clusterStackSize: number | undefined,
  groupsResolved: string[]
): number[] {
  if (stacked) {
    if (clusterStackSize) {
      return rows.map((row) => {
        const seg = clusterStackSize;
        const clusters = Math.ceil(groupsResolved.length / seg);
        let rowMax = 0;
        for (let c = 0; c < clusters; c++) {
          let sum = 0;
          for (let k = 0; k < seg; k++) {
            const gi = c * seg + k;
            if (gi >= groupsResolved.length) break;
            const g = groupsResolved[gi]!;
            const v = row[g];
            sum += typeof v === "number" && !Number.isNaN(v) ? v : 0;
          }
          rowMax = Math.max(rowMax, sum);
        }
        return rowMax;
      });
    }
    return rows.map((row) =>
      groupsResolved.reduce((sum, g) => {
        const v = row[g];
        const n = typeof v === "number" && !Number.isNaN(v) ? v : 0;
        return sum + n;
      }, 0)
    );
  }
  return rows.flatMap((row) =>
    groupsResolved.map((g) => row[g]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
  );
}

/** Visible category row indices from axis 0–1 zoom (scrollbar / category axis). Floor/ceil so partly visible categories are included in Y-scale math. */
function visibleCategorySliceIndices(len: number, start: number, end: number): { startIdx: number; endIdx: number } {
  if (len <= 0) return { startIdx: 0, endIdx: 0 };
  const startIdx = Math.max(0, Math.min(len - 1, Math.floor(start * len)));
  let endIdx = Math.max(0, Math.min(len, Math.ceil(end * len)));
  if (endIdx <= startIdx) endIdx = Math.min(len, startIdx + 1);
  return { startIdx, endIdx };
}

/** First segment of `"Plant · GD"` style labels for cluster plant bullets. */
function plantNameFromClusterSeriesDisplayName(name: string | undefined): string {
  if (!name) return "";
  const i = name.indexOf("·");
  return (i >= 0 ? name.slice(0, i) : name).trim();
}

/**
 * When plant group keys include the zone prefix (e.g. "SZL GUMMIDIPOONDI"), strip it using the drilldown zone (e.g. "SZL").
 */
export function stripZonePrefixFromGroupLabel(groupName: string, zoneContext: string | undefined): string {
  const z = zoneContext?.trim();
  if (!z) return groupName;
  const g = groupName.trim();
  const re = new RegExp(`^${escapeRegExp(z)}(?:\\s+|\\s*[-–—.]\\s*)`, "i");
  const stripped = g.replace(re, "").trim();
  return stripped.length > 0 ? stripped : g;
}

export interface OverallDataItem {
  month_date: string;
  productivity: number;
}

export interface ZoneGroupedBarChartProps {
  /** Chart data: each row has categoryField, categoryLabelField, and one key per group with numeric value */
  chartData: Record<string, unknown>[];
  /** Group names (e.g. zone names) – one column series per group */
  groups: string[];
  /** Category key in each row (e.g. "date") */
  categoryField?: string;
  /** Label key for x-axis display (e.g. "label") */
  categoryLabelField?: string;
  /** Value suffix in tooltips (e.g. "Cylinder/Hour") */
  valueSuffix?: string;
  /** Optional overall line: array of { month_date, productivity } merged into chartData as overallProductivity for right axis */
  overallLineData?: OverallDataItem[];
  /** Legend / tooltip name for the overall line (default "Productivity") */
  overallLineSeriesName?: string;
  /** Called when a bar is clicked: (categoryValue, groupName) */
  onBarClick?: (categoryValue: string, groupName: string) => void;
  /**
   * When set (e.g. `drillDim`), bar clicks pass `row[barClickDimensionField]` as the second argument
   * instead of the series `groupName` — for stacked MS/HSD where drill targets the dimension, not the segment.
   */
  barClickDimensionField?: string;
  /** Minimum value for left Y-axis (e.g. 1000 for productivity) */
  minBarY?: number;
  /** Bar colors (am5 hex). Defaults to ZONE_COLOR_PALETTE */
  colors?: number[];
  /** Right Y-axis label */
  rightAxisLabel?: string;
  /** Show legend. Default true */
  showLegend?: boolean;
  /** Class name for the container div */
  className?: string;
  /** Height of chart container (default 400) */
  height?: number;
  /** When true, Y-axis can extend below zero (e.g. negative savings). Default false */
  allowNegativeY?: boolean;
  /** X-axis category label rotation in degrees (e.g. -90 for vertical). Default 0 */
  xAxisLabelRotation?: number;
  /** Show horizontal scrollbar when category count exceeds this value. Default 20 */
  scrollbarCategoryThreshold?: number;
  /**
   * Initial X-axis zoom: show at most this many categories (e.g. months) in view.
   * When set and there are more categories, `start`/`end` are chosen so the scrollbar thumb
   * spans that fraction; drag to pan. If omitted, only `scrollbarCategoryThreshold` applies.
   */
  scrollbarInitialVisibleCategories?: number;
  /**
   * When set (plant drilldown within a zone), bar labels and tooltips use the plant name only (zone prefix stripped from the group key when present).
   * When omitted, the bar label is the series name (zone in zone-by-month charts).
   */
  barLabelZoneContext?: string;
  /** When true, column series stack per category (rejection totals by date). Default false (grouped). */
  stacked?: boolean;
  /**
   * When `stacked` is true: segments per cluster before a new stack starts (e.g. 3 for GD/PT/CS per plant).
   * Omit to stack all `groups` in a single column (first series starts the stack).
   */
  clusterStackSize?: number;
  /** Per-series legend/tooltip titles (same length as `groups`). Use with `clusterStackSize` for readable names. */
  seriesDisplayNames?: string[];
  /** When true, do not render value labels on columns (recommended for clustered stacks). */
  hideColumnBullets?: boolean;
  /**
   * With `clusterStackSize`: show each plant’s short name under the bottom segment (GD) of each stack.
   * Uses the text before ` · ` in `seriesDisplayNames` for that series.
   */
  clusterShowPlantLabels?: boolean;
  /**
   * Rounded top corners on columns (grouped) or on the top segment of each stack (clustered).
   * Set false for dense stacked rejection charts where square segments read more clearly.
   * @default true
   */
  roundedColumnTops?: boolean;
  /**
   * When true with `stacked` + `clusterStackSize`, legend shows only one entry per stack segment
   * (e.g. MS and HSD) using `colors[0]…colors[clusterStackSize-1]`, not every clustered series.
   */
  legendSegmentMode?: boolean;
  /**
   * Labels for each segment in `legendSegmentMode` (length should match `clusterStackSize`).
   * Defaults to `["MS","HSD"]` when `clusterStackSize === 2` and this is omitted.
   */
  segmentLegendLabels?: string[];
  /**
   * Pseudo-3D glass columns (linear gradient + highlight stroke) and matching glass-style segment legend swatches.
   * amCharts 5 does not support real extruded 3D bars like amCharts 3.
   */
  glass3DColumnStyle?: boolean;
  /** When true, renders a compact legend with smaller markers (10×10) and smaller font (9px). */
  smallLegend?: boolean;
  /**
   * Axis range groups — each entry draws a month/group label spanning `startCat`…`endCat` on the
   * category axis. When provided, regular x-axis tick labels are hidden (use this with flat
   * category keys like `"2025-10|CEN"` where the human-readable label is the range text).
   */
  axisRangeGroups?: Array<{ startCat: string; endCat: string; label: string }>;
  /**
   * When true, the top series of each bar stack renders the data row's `categoryLabelField` value
   * as a rotated -90° label above the bar (zone name above each bar in flat-format charts).
   */
  showCategoryLabelBullets?: boolean;
  /** When true, bar-top names render in full (no ellipsis truncation). */
  fullBarTopLabels?: boolean;
  /** Bar tooltip — e.g. "Zone", "Region" (shows `{label}: {group key}`). */
  tooltipGroupLabel?: string;
  /** Bar tooltip — e.g. "Dryout Hours" (shows `{label}: {value}{suffix}`). */
  tooltipValueLabel?: string;
  /** Optional first tooltip line — e.g. "Month" → `Month: Jan 2025`. */
  tooltipCategoryLabel?: string;
}

const DryoutZoneGroupedBarChart: React.FC<ZoneGroupedBarChartProps> = ({
  chartData,
  groups,
  categoryField = "date",
  categoryLabelField = "label",
  valueSuffix = "Cylinder/Hour",
  overallLineData,
  overallLineSeriesName = "Productivity",
  onBarClick,
  minBarY,
  colors = ZONE_COLOR_PALETTE,
  rightAxisLabel = "Productivity (Cylinder/Hour)",
  showLegend = true,
  className = "",
  height = 440,
  allowNegativeY = false,
  xAxisLabelRotation = 0,
  scrollbarCategoryThreshold = 20,
  scrollbarInitialVisibleCategories,
  barLabelZoneContext,
  stacked = false,
  clusterStackSize,
  seriesDisplayNames,
  hideColumnBullets = false,
  clusterShowPlantLabels = false,
  roundedColumnTops = true,
  barClickDimensionField,
  legendSegmentMode = false,
  segmentLegendLabels,
  glass3DColumnStyle = false,
  smallLegend = false,
  axisRangeGroups,
  showCategoryLabelBullets = false,
  fullBarTopLabels = false,
  tooltipGroupLabel,
  tooltipValueLabel,
  tooltipCategoryLabel,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<am5.Root | null>(null);

  useEffect(() => {
    if (!containerRef.current || chartData.length === 0 || groups.length === 0) return;

    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    const groupsResolved = dedupeGroupsPreserveOrder(groups);

    /** Stacked columns need numeric segments; null would break stack height. */
    const plotData: Record<string, unknown>[] = stacked
      ? chartData.map((row) => {
          const r = { ...row };
          for (const g of groupsResolved) {
            const v = r[g];
            r[g] = v != null && typeof v === "number" && !Number.isNaN(v) ? v : 0;
          }
          return r;
        })
      : chartData;

    const root = am5.Root.new(containerRef.current);
    rootRef.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);
    root.container.setAll({
      width: am5.percent(100),
      height: am5.percent(100),
    });

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "none",
        layout: root.verticalLayout,
        width: am5.percent(100),
        height: am5.percent(100),
        paddingTop: clusterStackSize != null ? 12 : 8,
        /** Keep bottom padding tight so legend + scrollbar sit just under the plot (avoids a large white band). */
        paddingBottom:
          (xAxisLabelRotation !== 0 ? 22 : clusterStackSize != null ? 8 : 4) +
          (clusterStackSize != null ? 12 : 0) +
          (clusterShowPlantLabels ? 6 : 0) +
          (axisRangeGroups?.length ? 18 : 0),
        paddingRight: 20,
        paddingLeft: 4,
      })
    );

    // Clip bullet labels that extend beyond the plot area (e.g. tall-bar text above chart top)
    chart.plotContainer.set("maskContent", true);

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: axisRangeGroups?.length ? 1 : clusterStackSize != null ? (xAxisLabelRotation !== 0 ? 48 : 36) : xAxisLabelRotation !== 0 ? 40 : 30,
      cellStartLocation: clusterStackSize != null ? 0.02 : 0.04,
      cellEndLocation: clusterStackSize != null ? 0.98 : 0.96,
      minorGridEnabled: false,
    });
    // X-axis vertical grid lines — subtle light gray (matches PerformanceScoreLineChart)
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
        categoryField,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );
    xAxis.data.setAll(plotData);

    // Build a lookup: category key → month label (for the middle category of each group).
    const catToMonthLabel = new Map<string, string>();
    if (axisRangeGroups?.length) {
      const allCats = plotData.map((r) => String(r[categoryField] ?? ""));
      for (const rg of axisRangeGroups) {
        const groupCats = allCats.filter((c) => c >= rg.startCat && c <= rg.endCat);
        const midCat = groupCats[Math.floor(groupCats.length / 2)];
        if (midCat) catToMonthLabel.set(midCat, rg.label);
      }
    }

    xAxis.get("renderer").labels.template.setAll({
      rotation: 0,
      centerY: am5.p50,
      centerX: am5.p50,
      fontSize: 10,
      fontWeight: axisRangeGroups?.length ? "600" : "400",
      fill: am5.color(0x475569),
      paddingTop: 6,
      paddingBottom: 4,
      maxWidth: axisRangeGroups?.length ? 120 : xAxisLabelRotation !== 0 ? 120 : 100,
      oversizedBehavior: "truncate",
      textAlign: "center",
    });
    xAxis.get("renderer").labels.template.adapters.add("text", (_text, target) => {
      const dataContext = target.dataItem?.dataContext as Record<string, unknown>;
      if (!dataContext) return "";
      const cat = String(dataContext[categoryField] ?? "");
      // Flat-format mode: show month label only for the middle category of each group
      if (axisRangeGroups?.length) {
        return catToMonthLabel.get(cat) ?? "";
      }
      // Normal mode: show the categoryLabelField value or the category key
      const lbl = dataContext[categoryLabelField];
      if (lbl != null && String(lbl).trim() !== "") return String(lbl);
      return cat;
    });

    const stackSegmentSize = stacked ? (clusterStackSize ?? groupsResolved.length) : 1;
    const columnTopRadius = 6;

    const nCat = plotData.length;
    let initialScrollEnd: number;
    if (
      scrollbarInitialVisibleCategories != null &&
      Number.isFinite(scrollbarInitialVisibleCategories) &&
      scrollbarInitialVisibleCategories >= 1
    ) {
      const want = Math.floor(scrollbarInitialVisibleCategories);
      const vis = Math.min(nCat, Math.max(1, want));
      initialScrollEnd = nCat <= vis ? 1 : Math.min(1, vis / nCat);
    } else {
      const th = Math.max(1, scrollbarCategoryThreshold);
      initialScrollEnd = nCat <= th ? 1 : Math.min(1, th / nCat);
    }
    const { startIdx: initStart, endIdx: initEnd } = visibleCategorySliceIndices(nCat, 0, initialScrollEnd);
    const initialVisibleRows = plotData.slice(initStart, initEnd);
    const zoneValues = computeZoneValuesForPlotRows(initialVisibleRows, stacked, clusterStackSize, groupsResolved);
    const labelHeadroom = barLabelZoneContext?.trim()
      ? 0.18
      : fullBarTopLabels
        ? 0.25
        : stacked
          ? clusterStackSize
            ? 0.10
            : 0.08
          : 0.12;
    /** Extra Y headroom for zone/plant names above columns (no value on bars) */
    const zoneRange = getYAxisRange(zoneValues, 0.1, !allowNegativeY, labelHeadroom);
    const yRenderer = am5xy.AxisRendererY.new(root, {});
    // Y-axis horizontal grid lines — subtle dashed (matches PerformanceScoreLineChart)
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
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: minBarY != null ? Math.max(minBarY, zoneRange.min) : zoneRange.min,
        max: zoneRange.max,
        strictMinMax: true,
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 10, fill: am5.color(0x475569) });

    let chartDataWithOverall: Record<string, unknown>[] = plotData;
    let yAxisRight: am5xy.ValueAxis<am5xy.AxisRendererY> | undefined;

    if (overallLineData && overallLineData.length > 0) {
      const overallMap = new Map<string, number>();
      overallLineData.forEach((d) => {
        overallMap.set(d.month_date, Number(Number(d.productivity).toFixed(2)));
      });
      chartDataWithOverall = plotData.map((row) => {
        const r = { ...row };
        const cat = r[categoryField] as string;
        const overallVal = overallMap.get(cat) ?? null;
        (r as Record<string, unknown>).overallProductivity = overallVal;
        return r as Record<string, unknown>;
      });
      const overallValues = chartDataWithOverall
        .slice(initStart, initEnd)
        .map((r) => (r as Record<string, unknown>).overallProductivity)
        .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      const overallRange = overallValues.length
        ? getYAxisRange(overallValues, 0.1, !allowNegativeY)
        : { min: 0, max: 1000 };
      const rightAxisRenderer = am5xy.AxisRendererY.new(root, { opposite: true, minGridDistance: 20 });
      rightAxisRenderer.grid.template.set("forceHidden", true);
      yAxisRight = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: rightAxisRenderer,
          min: allowNegativeY ? overallRange.min : Math.max(0, overallRange.min),
          max: overallRange.max,
          strictMinMax: true,
        })
      );
      yAxisRight.get("renderer").labels.template.setAll({ fontSize: 10, fontWeight: "bold" });
      yAxisRight.children.push(
        am5.Label.new(root, {
          rotation: 90,
          text: rightAxisLabel,
          y: am5.p50,
          centerX: am5.p50,
          fontSize: 10,
          fontWeight: "bold",
          paddingLeft: 10,
        })
      );
    }

    groupsResolved.forEach((groupName, idx) => {
      const color =
        clusterStackSize != null ? colors[idx % clusterStackSize] : colors[idx % colors.length];
      const zoneCtx = barLabelZoneContext?.trim();
      const displayGroupName = zoneCtx ? stripZonePrefixFromGroupLabel(groupName, barLabelZoneContext) : groupName;
      const displaySeriesName = seriesDisplayNames?.[idx] ?? displayGroupName;
      const columnStacked = stacked && idx % stackSegmentSize !== 0;
      const zoneSeries = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: displaySeriesName,
          xAxis,
          yAxis,
          valueYField: groupName,
          categoryXField: categoryField,
          fill: glass3DColumnStyle ? am5.color(blendHex(color, 0x000000, 0.12)) : am5.color(color),
          stroke: glass3DColumnStyle ? am5.color(0xffffff) : am5.color(color),
          stacked: columnStacked,
          tooltipText: "" // We'll use the adapter for custom text
        })
      );
      const columnTooltip = am5.Tooltip.new(root, {
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 8,
        paddingRight: 8,
        pointerOrientation: "horizontal",
      });
      const tooltipBg = columnTooltip.get("background");
      if (tooltipBg) tooltipBg.setAll({ fill: am5.color(0xffffff), stroke: am5.color(0xcccccc), strokeWidth: 1 });
      columnTooltip.label.set("fill", am5.color(0x000000));

      const isClusterStack = clusterStackSize != null;

      const topRoundedGrouped = roundedColumnTops && !stacked;
      const topRoundedCluster =
        roundedColumnTops && stacked && clusterStackSize != null && idx % clusterStackSize === clusterStackSize - 1;
      const topRoundedSimpleStack =
        roundedColumnTops && stacked && clusterStackSize == null && idx === groupsResolved.length - 1;

      zoneSeries.columns.template.setAll({
        width: am5.percent(isClusterStack ? 88 : 72),
        tooltipY: 0,
        ...(glass3DColumnStyle
          ? {
              fillGradient: glassBarGradient(root, color),
              fillOpacity: KPI_AM3_ZONE_BAR_GLASS_FILL_ALPHA,
              strokeOpacity: isClusterStack ? 0.55 : 0.35,
              stroke: am5.color(0xffffff),
              strokeWidth: isClusterStack ? 1.25 : 1,
            }
          : {
              strokeOpacity: isClusterStack ? 0.12 : 0,
              stroke: isClusterStack ? am5.color(0xffffff) : am5.color(color),
              strokeWidth: isClusterStack ? 1 : 0,
            }),
        cornerRadiusTL: topRoundedGrouped || topRoundedCluster || topRoundedSimpleStack ? columnTopRadius : 0,
        cornerRadiusTR: topRoundedGrouped || topRoundedCluster || topRoundedSimpleStack ? columnTopRadius : 0,
        cornerRadiusBL: 0,
        cornerRadiusBR: 0,
        tooltip: columnTooltip,
        tooltipPosition: "pointer",
        cursorOverStyle: onBarClick ? "pointer" : "default",
      });
      // Collapse spacer rows (inserted between months for visual gap) to 0-width invisible columns
      if (axisRangeGroups?.length) {
        zoneSeries.columns.template.adapters.add("width", (width, target) => {
          const cat = String((target.dataItem?.dataContext as Record<string, unknown>)?.[categoryField] ?? "");
          return cat.endsWith("|__GAP__") ? 0 : width;
        });
        zoneSeries.columns.template.adapters.add("forceHidden", (_hidden, target) => {
          const cat = String((target.dataItem?.dataContext as Record<string, unknown>)?.[categoryField] ?? "");
          return cat.endsWith("|__GAP__");
        });
      }
      if (onBarClick) {
        zoneSeries.columns.template.events.on("click", (ev) => {
          const dataItem = ev.target.dataItem;
          if (!dataItem) return;
          const ctx = dataItem.dataContext as Record<string, unknown>;
          const date = ctx?.[categoryField] as string;
          if (!date) return;
          const dimField = barClickDimensionField?.trim();
          const second =
            dimField && ctx[dimField] != null && String(ctx[dimField]).trim() !== ""
              ? String(ctx[dimField])
              : groupName;
          if (second) onBarClick(date, second);
        });
      }
      zoneSeries.columns.template.adapters.add("tooltipText", (_text, target) => {
        const dataItem = target.dataItem;
        if (!dataItem) return "";
        const ctx = dataItem.dataContext as Record<string, unknown>;
        console.log("DryoutZoneGroupedBarChart tooltip ctx:", ctx);
        const catLabel = String(ctx?.[categoryLabelField] ?? ctx?.[categoryField] ?? "").trim();
        const val = ctx[groupName];
        const valueStr = val != null && typeof val === "number" ? Number(val).toFixed(2) : "—";
        const suffix = valueSuffix
          ? valueSuffix.startsWith(" ")
            ? valueSuffix
            : ` ${valueSuffix}`
          : "";

        // Check if we have product breakdown data
        const productTotals = ctx[`product_totals_${groupName}`] as Record<string, number> | undefined;
        
        if (productTotals) {
          const totalStr = val != null && typeof val === "number" ? Number(val).toFixed(2) : "0.00";
          const monthLine = tooltipCategoryLabel?.trim() && catLabel
            ? `${tooltipCategoryLabel.trim()}: ${catLabel}\n`
            : "";
          const groupLbl = tooltipGroupLabel?.trim() ? `${tooltipGroupLabel.trim()}: ${groupName}\n`
            : "";
          let productLines = "";
          // Sort product groups alphabetically for consistent display
          const sortedProducts = Object.keys(productTotals).sort();
          for (const grp of sortedProducts) {
            const grpVal = productTotals[grp];
            if (grpVal != null) {
              productLines += `${grp}: ${Number(grpVal).toFixed(2)}${suffix}\n`;
            }
          }
          return `${monthLine}${groupLbl}Total: ${totalStr}${suffix}\n${productLines}`;
        }

        const groupLbl = tooltipGroupLabel?.trim();
        const valueLbl = tooltipValueLabel?.trim();
        if (groupLbl && valueLbl) {
          const monthLine =
            tooltipCategoryLabel?.trim() && catLabel
              ? `${tooltipCategoryLabel.trim()}: ${catLabel}\n`
              : "";
          return `${monthLine}${groupLbl}: ${groupName}\n${valueLbl}: ${valueStr}${suffix}`;
        }

        const title = seriesDisplayNames?.[idx] ?? (zoneCtx ? displayGroupName : groupName);
        const period = !zoneCtx && !seriesDisplayNames && catLabel ? ` · ${catLabel}` : "";
        const dateLine = seriesDisplayNames && catLabel ? `${catLabel}\n` : "";
        return `${dateLine}${title}${period}\n${valueStr}${suffix}`;
      });
      zoneSeries.bullets.push((root, _series, dataItem) => {
        if (hideColumnBullets) return undefined;
        if (clusterStackSize != null) {
          if (!clusterShowPlantLabels) return undefined;
          /** One label per plant: top segment (CS) of each stack, rotated like productivity bars. */
          if (idx % clusterStackSize !== clusterStackSize - 1) return undefined;
          const plantName = plantNameFromClusterSeriesDisplayName(seriesDisplayNames?.[idx]);
          if (!plantName) return undefined;
          const valueY = dataItem.get("valueY");
          if (valueY == null || (typeof valueY === "number" && Number.isNaN(valueY))) return undefined;
          return am5.Bullet.new(root, {
            locationY: 1,
            sprite: am5.Label.new(root, {
              text: plantName,
              fill: am5.color(0x374151),
              centerY: am5.p100,
              centerX: am5.p50,
              fontSize: 10,
              fontWeight: "600",
              rotation: -90,
              dx: 6,
              dy: -30,
              marginLeft: 4,
              marginRight: 6,
              paddingBottom: 2,
            }),
          });
        }

        // Flat-format mode: show zone name (categoryLabelField) above the top series bar only
        if (showCategoryLabelBullets) {
          if (idx !== groupsResolved.length - 1) return undefined; // top series only
          const ctx = dataItem.dataContext as Record<string, unknown>;
          // Skip spacer rows
          const catKey = String(ctx?.[categoryField] ?? "");
          if (catKey.endsWith("|__GAP__")) return undefined;
          const labelText = String(ctx?.[categoryLabelField] ?? "").trim();
          if (!labelText) return undefined;
          const valueY = dataItem.get("valueY");
          if (valueY == null || (typeof valueY === "number" && (Number.isNaN(valueY) || valueY === 0))) return undefined;
          return am5.Bullet.new(root, {
            locationY: 1,
            sprite: am5.Label.new(root, {
              text: labelText,
              fill: am5.color(0x374151),
              centerY: am5.p50,
              centerX: am5.p0,
              fontSize: 9,
              fontWeight: "600",
              rotation: -90,
              dx: 0,
              dy: -3,
              oversizedBehavior: "none",
            }),
          });
        }

        const valueY = dataItem.get("valueY");
        if (valueY == null || (typeof valueY === "number" && Number.isNaN(valueY))) return undefined;
        const textBody =
          seriesDisplayNames?.[idx] ?? (zoneCtx ? displayGroupName : groupName);

        return am5.Bullet.new(root, {
          locationY: 1,
          sprite: am5.Label.new(root, {
            text: textBody,
            fill: am5.color(fullBarTopLabels ? 0x000000 : color),
            centerY: am5.p50,
            centerX: am5.p0,   // bottom of rotated text anchored → text extends fully upward
            fontSize: 9,
            fontWeight: "600",
            rotation: -90,
            dx: 0,
            dy: -3,            // 3 px gap between bar top and text bottom
            oversizedBehavior: fullBarTopLabels ? "none" : "truncate",
            ...(fullBarTopLabels ? {} : { maxWidth: 200 }),
          }),
        });
      });
      zoneSeries.data.setAll(plotData);
    });

    if (yAxisRight && chartDataWithOverall.some((r) => (r as Record<string, unknown>).overallProductivity != null)) {
      const productivityLineSeries = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: overallLineSeriesName,
          xAxis,
          yAxis: yAxisRight,
          valueYField: "overallProductivity",
          categoryXField: categoryField,
          stroke: am5.color(LINE_COLOR),
        })
      );
      productivityLineSeries.strokes.template.setAll({ strokeWidth: 2 });
      productivityLineSeries.set(
        "tooltip",
        am5.Tooltip.new(root, {
          getFillFromSprite: false,
          labelText: `${overallLineSeriesName}: {valueY} ${valueSuffix}`,
          autoTextColor: false,
          background: am5.RoundedRectangle.new(root, {
            fill: am5.color(0x000000),
          }),
        })
      );
      productivityLineSeries.data.setAll(chartDataWithOverall);
      productivityLineSeries.bullets.push(() => {
        return am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 4,
            fill: am5.color(LINE_COLOR),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 1,
          }),
        });
      });
      productivityLineSeries.bullets.push(() => {
        return am5.Bullet.new(root, {
          locationY: 0,
          sprite: am5.Label.new(root, {
            text: "{valueY}",
            fill: am5.color(LINE_LABEL_COLOR),
            background: am5.RoundedRectangle.new(root, {
              fill: am5.color(LINE_LABEL_BG),
            }),
            centerY: am5.percent(50),
            centerX: am5.percent(50),
            populateText: true,
            dy: -20,
            fontSize: 11,
            fontWeight: "bold",
          }),
        });
      });
      productivityLineSeries.appear();
    }

    if (showLegend) {
      const useSegmentLegend =
        legendSegmentMode && stacked && clusterStackSize != null && clusterStackSize >= 1;
      if (useSegmentLegend) {
        const segN = clusterStackSize!;
        const labels: string[] =
          segmentLegendLabels != null && segmentLegendLabels.length >= segN
            ? segmentLegendLabels.slice(0, segN)
            : segN === 2
              ? ["MS", "HSD"]
              : Array.from({ length: segN }, (_, i) => `S${i + 1}`);
        const legRow = chart.children.push(
          am5.Container.new(root, {
            layout: root.horizontalLayout,
            centerX: am5.p50,
            x: am5.p50,
            marginTop: glass3DColumnStyle ? 22 : 4,
            marginBottom: 0,
          })
        );
        for (let i = 0; i < segN; i++) {
          /** Swatch + label on one row, label flush beside the marker. */
          const item = legRow.children.push(
            am5.Container.new(root, {
              layout: root.horizontalLayout,
              marginRight: i < segN - 1 ? 24 : 0,
              centerY: am5.p50,
              height: 18,
            })
          );
          const swatchColor = colors[i % segN]!;
          item.children.push(
            am5.RoundedRectangle.new(root, {
              width: 14,
              height: 14,
              marginRight: 6,
              centerY: am5.p50,
              ...(glass3DColumnStyle
                ? {
                    fillGradient: glassBarGradient(root, swatchColor),
                    fillOpacity: KPI_AM3_ZONE_BAR_GLASS_FILL_ALPHA,
                    stroke: am5.color(0xffffff),
                    strokeOpacity: 0.9,
                    strokeWidth: 1.25,
                  }
                : {
                    fill: am5.color(swatchColor),
                    stroke: am5.color(0xd1d5db),
                    strokeWidth: 1,
                  }),
              cornerRadiusTL: 3,
              cornerRadiusTR: 3,
              cornerRadiusBL: 3,
              cornerRadiusBR: 3,
            })
          );
          item.children.push(
            am5.Label.new(root, {
              text: labels[i] ?? `S${i + 1}`,
              fontSize: 11,
              fontWeight: "500",
              paddingLeft: 0,
              paddingRight: 0,
              centerY: am5.p50,
              fill: am5.color(0x111827),
            })
          );
        }
      } else {
        const legend = chart.children.push(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            layout: root.horizontalLayout,
            marginTop: glass3DColumnStyle ? 22 : 4,
            marginBottom: 0,
            paddingTop: 0,
            paddingBottom: 0,
          })
        );
        const legendFontSize = smallLegend ? 9 : 10;
        legend.labels.template.setAll({
          fontSize: legendFontSize,
          paddingLeft: 2,
          paddingRight: smallLegend ? 6 : 8,
        });
        legend.markers.template.setAll({ width: smallLegend ? 10 : 12, height: smallLegend ? 10 : 12 });
        legend.markerRectangles.template.setAll({
          cornerRadiusTL: 2,
          cornerRadiusTR: 2,
          cornerRadiusBL: 2,
          cornerRadiusBR: 2,
        });
        if (legend.valueLabels) legend.valueLabels.template.setAll({ forceHidden: true });
        legend.data.setAll(chart.series.values);
      }
    }

    // Disable cursor for now to ensure column tooltips are shown
    // const cursor = am5xy.XYCursor.new(root, { behavior: "zoomX", xAxis });
    // Create a tooltip and set it on the cursor, then hide it
    // cursor.set("tooltip", am5.Tooltip.new(root, {}));
    // cursor.get("tooltip").set("forceHidden", true);
    // chart.set("cursor", cursor);
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: glass3DColumnStyle ? 10 : 4,
      height: 10,
      start: 0,
      end: initialScrollEnd,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);

    const syncYAxisToVisibleCategories = () => {
      const apply = () => {
        if (root.isDisposed()) return;
        const len = plotData.length;
        if (!len) return;
        // Read from xAxis (the live zoom state), falling back to scrollbar
        let st = xAxis.get("start") ?? scrollbarX.get("start", 0);
        let en = xAxis.get("end")   ?? scrollbarX.get("end",   1);
        st = Math.max(0, Math.min(1, st));
        en = Math.max(Math.min(1, en), st + 1e-6);
        const { startIdx, endIdx } = visibleCategorySliceIndices(len, st, en);
        let slice = plotData.slice(startIdx, endIdx);
        if (slice.length === 0) slice = plotData;
        const zv = computeZoneValuesForPlotRows(slice, stacked, clusterStackSize, groupsResolved);
        const zr = getYAxisRange(zv, 0.1, !allowNegativeY, labelHeadroom);
        const yMin = minBarY != null ? Math.max(minBarY, zr.min) : zr.min;
        // Temporarily relax strictMinMax so set() takes effect immediately
        yAxis.setAll({ strictMinMax: false, min: yMin, max: zr.max });
        yAxis.set("strictMinMax", true);

        if (yAxisRight) {
          const ovSlice = chartDataWithOverall.slice(startIdx, endIdx);
          const ovUse = ovSlice.length > 0 ? ovSlice : chartDataWithOverall;
          const overallVals = ovUse
            .map((r) => (r as Record<string, unknown>).overallProductivity)
            .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
          const or = overallVals.length
            ? getYAxisRange(overallVals, 0.1, !allowNegativeY)
            : { min: 0, max: 1000 };
          yAxisRight.setAll({ strictMinMax: false, min: allowNegativeY ? or.min : Math.max(0, or.min), max: or.max });
          yAxisRight.set("strictMinMax", true);
        }

        chart.series.values.forEach((s) => {
          try { s.markDirtyValues?.(); s.markDirty(); } catch (_e) { /* ignore */ }
        });
      };
      // Single rAF is sufficient — fires after the axis zoom has been committed
      requestAnimationFrame(apply);
    };

    xAxis.on("start", syncYAxisToVisibleCategories);
    xAxis.on("end",   syncYAxisToVisibleCategories);
    scrollbarX.events.on("rangechanged", syncYAxisToVisibleCategories);
    syncYAxisToVisibleCategories();
    chart.series.values.forEach((s) => s.appear(1000));
    chart.appear(1000, 100);

    return () => {
      try {
        root.dispose();
      } catch (_e) {
        // ignore if already disposed
      }
      rootRef.current = null;
    };
  }, [
    chartData,
    groups,
    categoryField,
    categoryLabelField,
    valueSuffix,
    overallLineData,
    overallLineSeriesName,
    onBarClick,
    minBarY,
    colors,
    rightAxisLabel,
    showLegend,
    allowNegativeY,
    xAxisLabelRotation,
    scrollbarCategoryThreshold,
    scrollbarInitialVisibleCategories,
    barLabelZoneContext,
    stacked,
    clusterStackSize,
    seriesDisplayNames,
    hideColumnBullets,
    clusterShowPlantLabels,
    barClickDimensionField,
    legendSegmentMode,
    segmentLegendLabels,
    glass3DColumnStyle,
    smallLegend,
    axisRangeGroups,
    showCategoryLabelBullets,
    fullBarTopLabels,
    tooltipGroupLabel,
    tooltipValueLabel,
    tooltipCategoryLabel,
  ]);

  const style: React.CSSProperties = { width: "100%" };
  if (height != null && height > 0) style.height = `${height}px`;
  else style.height = "100%";
  return <div ref={containerRef} className={className} style={style} />;
};

/** KPI dryout copy — safe to customize without affecting LPG/TAS/Performance Score charts. */
export { DryoutZoneGroupedBarChart };
export default DryoutZoneGroupedBarChart;
