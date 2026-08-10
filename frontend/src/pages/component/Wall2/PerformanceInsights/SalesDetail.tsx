import React, { useState, useCallback, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import {
  Loader2, RotateCcw, X, Maximize2,
  TrendingUp, BarChart2, GitBranch, GitCompare,
} from "lucide-react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { apiClient } from "@/services/apiClient";
import { fetchDistinctValues } from "../api";
import ZoneWiseFilterMenu from "./ZoneWiseFilterMenu";
import useAuthStore from "@/store/authStore";

type Tab = "SBU" | "Zone" | "Region" | "Sales Area" | "Product";
const ALL_TABS: Tab[] = ["SBU", "Zone", "Region", "Sales Area", "Product"];

// Derive the allowed tabs based on the user's novex_role.
// - "Sales Officer *"    → start after Sales Area: ["Product"]
// - "Regional Manager *" → start after Region:     ["Sales Area", "Product"]
// - "Zonal Head *"       → start after Zone:       ["Region", "Sales Area", "Product"]
// - anything else        → all tabs
const getTabsForRole = (novexRoles: string[]): Tab[] => {
  const role = novexRoles?.[0] ?? "";
  if (role.startsWith("Sales Officer "))   return ["Product"];
  if (role.startsWith("Regional Manager ")) return ["Sales Area", "Product"];
  if (role.startsWith("Zonal Head "))       return ["Region", "Sales Area", "Product"];
  return ALL_TABS;
};

const BAR_COLOR          = "#3b82f6";
const BAR_COLOR_SELECTED = "#1d4ed8";
const BAR_COLOR_DIM      = "#bfdbfe";
const MONTH_COLOR        = "#10b981";
const INLINE_CHART_HEIGHT = 200;

/** Layout classes for inline fixed height vs fullscreen flex fill. */
const getChartPlotLayout = (fillContainer: boolean, height: number) => ({
  wrapperClassName: fillContainer
    ? "flex h-full min-h-0 w-full flex-1 flex-col gap-1"
    : "flex shrink-0 flex-col gap-1",
  plotClassName: fillContainer
    ? "relative min-h-0 w-full flex-1 overflow-hidden"
    : "relative w-full shrink-0 overflow-hidden",
  plotStyle: fillContainer ? undefined : ({ width: "100%", height } as const),
  statusStyle: fillContainer ? ({ minHeight: 120 } as const) : ({ height, minHeight: height } as const),
});

const COMPARE_COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

const FISCAL_MONTH_ORDER = ["APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC","JAN","FEB","MAR"];

/** Small tooltip above the point so it does not cover markers or value labels. */
const createCompactChartTooltip = (root: am5.Root, labelText: string, placeAbovePoint = true) => {
  const tooltip = am5.Tooltip.new(root, {
    labelText,
    getFillFromSprite: false,
    pointerOrientation: placeAbovePoint ? "up" : "horizontal",
    dy: placeAbovePoint ? -32 : 0,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 5,
    paddingRight: 5,
    background: am5.RoundedRectangle.new(root, {
      fill: am5.color("#ffffff"),
      fillOpacity: 0.96,
      stroke: am5.color("#d1d5db"),
      strokeWidth: 1,
    }),
  });
  tooltip.label.setAll({
    fontSize: 10,
    fill: am5.color("#374151"),
    maxWidth: 140,
    textAlign: "center",
  });
  return tooltip;
};

const linePointTooltipText = (isDay: boolean, showClickHint = false) =>
  isDay
    ? "Day {categoryX}: [bold]{valueY.formatNumber('#,###.#')}[/] TMT"
    : `{categoryX}: [bold]{valueY.formatNumber('#,###.#')}[/] TMT${showClickHint ? " [fontSize:8px](click for daily)[/]" : ""}`;

const BAR_TOOLTIP_TEXT = "{categoryX}: [bold]{valueY.formatNumber('#,###.#')}[/] TMT";

const setupLineChartCursor = (
  chart: am5xy.XYChart,
  root: am5.Root,
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>
) => {
  const cursor = am5xy.XYCursor.new(root, { behavior: "none", xAxis });
  chart.set("cursor", cursor);
  cursor.lineY.set("visible", false);
  cursor.lineX.set("visible", false);
  xAxis.set("tooltip", undefined);
};

/** Apply horizontal window on category axis (day-wise scroll). */
const applyCategoryAxisZoom = (
  axis: am5xy.CategoryAxis<am5xy.AxisRenderer> | null,
  startIndex: number,
  visibleCount: number,
) => {
  if (!axis) return;
  const len = axis.data.length;
  if (len <= visibleCount) return;
  const maxStart = Math.max(0, len - visibleCount);
  const safeStart = Math.max(0, Math.min(startIndex, maxStart));
  axis.zoomToIndexes(safeStart, safeStart + visibleCount);
};

/** Cancellable zoom scheduler — avoids stale timeouts resetting the slider after user scrolls. */
const createCategoryAxisZoomScheduler = () => {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let rafId = 0;
  const clear = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };
  const schedule = (
    axis: am5xy.CategoryAxis<am5xy.AxisRenderer> | null,
    startIndex: number,
    visibleCount: number,
  ) => {
    clear();
    const run = () => applyCategoryAxisZoom(axis, startIndex, visibleCount);
    run();
    rafId = requestAnimationFrame(run);
    [50, 150, 350].forEach((ms) => timers.push(setTimeout(run, ms)));
  };
  return { schedule, clear };
};

/** Re-sync chart size + zoom when host resizes (fullscreen modal open, etc.). */
const useCategoryChartHostResize = (
  chartDivRef: React.RefObject<HTMLDivElement | null>,
  rootRef: React.RefObject<am5.Root | null>,
  xAxisRef: React.RefObject<am5xy.CategoryAxis<am5xy.AxisRenderer> | null>,
  opts: {
    active: boolean;
    chartEpoch: number;
    pointCount: number;
    visibleCount: number;
    startIndex: number;
  },
) => {
  const startIndexRef = useRef(opts.startIndex);
  startIndexRef.current = opts.startIndex;

  useEffect(() => {
    if (!opts.active) return;
    const host = chartDivRef.current;
    const root = rootRef.current;
    if (!host || !root) return;

    const sync = () => {
      root.resize();
      if (opts.pointCount > opts.visibleCount) {
        applyCategoryAxisZoom(xAxisRef.current, startIndexRef.current, opts.visibleCount);
      }
    };

    const ro = new ResizeObserver(sync);
    ro.observe(host);
    requestAnimationFrame(sync);
    const delayed = [50, 200, 450].map((ms) => setTimeout(sync, ms));

    return () => {
      ro.disconnect();
      delayed.forEach(clearTimeout);
    };
  }, [
    opts.active,
    opts.chartEpoch,
    opts.pointCount,
    opts.visibleCount,
    chartDivRef,
    rootRef,
    xAxisRef,
  ]);
};

interface ChartRow { name: string; Total: number; }
type SeriesMap = Record<string, ChartRow[]>;

/** DAY_ID e.g. 20260401 → chart day label "01" (1 Apr 2026). */
const dayIdToChartDay = (dayId: string | number): string => {
  const id = String(dayId ?? "").trim();
  if (id.length === 8) return id.slice(6, 8);
  if (id.length >= 2) return id.slice(-2).padStart(2, "0");
  return id.padStart(2, "0");
};

const mapDailyApiRows = (rows: any[]): ChartRow[] =>
  rows
    .map((row: any) => ({
      name: dayIdToChartDay(row.DAY_ID ?? row.day_id ?? ""),
      Total: Number(row.Total ?? 0),
    }))
    .filter((row) => row.name !== "")
    .sort((a, b) => Number(a.name) - Number(b.name));

/** X-axis field for compare merge — not `name` (conflicts with amCharts series `{name}` / legend). */
const COMPARE_CATEGORY_FIELD = "category";

/** Merge compare series for chart: months (monthly) or days 01–31 (day-wise). */
const buildCompareMergedChartData = (
  seriesMap: SeriesMap,
  selectedNames: string[],
  isDrillDown: boolean,
): Record<string, unknown>[] => {
  if (isDrillDown) {
    const allDays = new Set<string>();
    selectedNames.forEach((name) => {
      (seriesMap[name] ?? []).forEach((r) => allDays.add(String(r.name).padStart(2, "0")));
    });
    return Array.from(allDays)
      .sort((a, b) => Number(a) - Number(b))
      .map((day) => {
        const entry: Record<string, unknown> = { [COMPARE_CATEGORY_FIELD]: day };
        selectedNames.forEach((name) => {
          const row = (seriesMap[name] ?? []).find(
            (r) => String(r.name).padStart(2, "0") === day,
          );
          entry[name] = row?.Total ?? null;
        });
        return entry;
      });
  }

  const allMonths = FISCAL_MONTH_ORDER.filter((m) =>
    selectedNames.some((name) =>
      (seriesMap[name] ?? []).some((r) => r.name.toUpperCase().slice(0, 3) === m),
    ),
  );
  return allMonths.map((month) => {
    const entry: Record<string, unknown> = { [COMPARE_CATEGORY_FIELD]: month };
    selectedNames.forEach((name) => {
      const row = (seriesMap[name] ?? []).find((r) => r.name.toUpperCase().slice(0, 3) === month);
      entry[name] = row?.Total ?? null;
    });
    return entry;
  });
};

const getComparePointCategory = (dataItem: am5.DataItem<am5xy.ILineSeriesDataItem> | undefined) => {
  if (!dataItem) return "";
  const fromAxis = dataItem.get("categoryX");
  if (fromAxis != null && String(fromAxis).trim() !== "") return String(fromAxis);
  const ctx = dataItem.dataContext as Record<string, unknown> | undefined;
  const fromCtx = ctx?.[COMPARE_CATEGORY_FIELD] ?? ctx?.name;
  return fromCtx != null ? String(fromCtx) : "";
};

const attachCompareMonthClick = (
  sprite: am5.Circle,
  onMonthClick: ((monthName: string) => void) | undefined,
  isDrillDown: boolean,
) => {
  if (!onMonthClick || isDrillDown) return;
  sprite.setAll({ cursorOverStyle: "pointer", interactive: true });
  sprite.events.on("click", (ev) => {
    const category = getComparePointCategory(
      ev.target.dataItem as am5.DataItem<am5xy.ILineSeriesDataItem> | undefined,
    );
    if (category) onMonthClick(normalizeMonthName(category));
  });
};

const TAB_DRILL_KEY: Record<Tab, string> = {
  SBU: "SBU_Name", Zone: "Zone_Name", Region: "Region_Name",
  "Sales Area": "SalesArea_Name", Product: "ProductName",
};
const TAB_GROUP_BY: Record<Tab, string[]> = {
  SBU: ["SBU_Name","FISCALYEAR"], Zone: ["Zone_Name","FISCALYEAR"],
  Region: ["Region_Name","FISCALYEAR"], "Sales Area": ["SalesArea_Name","FISCALYEAR"],
  Product: ["ProductName","FISCALYEAR"],
};

// ─── Compare multi-line chart - amCharts ──────────────────────────────────────

interface CompareLineChartProps {
  seriesMap: SeriesMap; loading: boolean;
  selectedNames: string[]; defaultData?: ChartRow[];
  onDefaultPointClick?: (monthName: string) => void;
  onComparePointClick?: (monthName: string) => void; // Click handler for comparison lines
  isDrillDown?: boolean;
  height?: number;
  fillContainer?: boolean;
}

const CompareLineChart: React.FC<CompareLineChartProps> = ({
  seriesMap, loading, selectedNames, defaultData = [], onDefaultPointClick, onComparePointClick,
  isDrillDown = false, height = INLINE_CHART_HEIGHT, fillContainer = false,
}) => {
  const plotLayout = getChartPlotLayout(fillContainer, height);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const xAxisRef = useRef<am5xy.CategoryAxis<am5xy.AxisRenderer> | null>(null);
  const zoomSchedulerRef = useRef(createCategoryAxisZoomScheduler());

  const SCROLL_THRESHOLD = isDrillDown ? 10 : 999;
  const visibleCount = SCROLL_THRESHOLD;

  const [sliderIndex, setSliderIndex] = useState(0);
  const [chartEpoch, setChartEpoch] = useState(0);

  useEffect(() => () => zoomSchedulerRef.current.clear(), []);

  const drillPointCount = useMemo(
    () =>
      isDrillDown && selectedNames.length > 0
        ? buildCompareMergedChartData(seriesMap, selectedNames, true).length
        : 0,
    [seriesMap, selectedNames, isDrillDown],
  );

  const sliderPointCount = useMemo(
    () =>
      selectedNames.length === 0
        ? (defaultData?.length ?? 0)
        : isDrillDown
          ? drillPointCount
          : 0,
    [selectedNames, defaultData, isDrillDown, drillPointCount],
  );

  const hasRenderableData = useMemo(
    () =>
      selectedNames.length === 0
        ? defaultData.length > 0
        : isDrillDown
          ? drillPointCount > 0
          : selectedNames.some((n) => (seriesMap[n]?.length ?? 0) > 0),
    [selectedNames, defaultData, isDrillDown, drillPointCount, seriesMap],
  );

  const maxSlider = Math.max(0, sliderPointCount - visibleCount);
  const safeSliderIndex = Math.min(sliderIndex, maxSlider);
  const showSlider = isDrillDown && sliderPointCount > SCROLL_THRESHOLD;
  const showBlockingLoader = loading && !hasRenderableData;

  useEffect(() => {
    setSliderIndex(0);
  }, [defaultData, seriesMap, isDrillDown, selectedNames]);

  useEffect(() => {
    if (safeSliderIndex !== sliderIndex) setSliderIndex(safeSliderIndex);
  }, [safeSliderIndex, sliderIndex]);

  useEffect(() => {
    if (!isDrillDown || sliderPointCount <= SCROLL_THRESHOLD) return;
    applyCategoryAxisZoom(xAxisRef.current, safeSliderIndex, visibleCount);
  }, [safeSliderIndex, chartEpoch, isDrillDown, sliderPointCount, SCROLL_THRESHOLD, visibleCount]);

  useCategoryChartHostResize(chartDivRef, rootRef, xAxisRef, {
    active: isDrillDown && sliderPointCount > SCROLL_THRESHOLD,
    chartEpoch,
    pointCount: sliderPointCount,
    visibleCount,
    startIndex: safeSliderIndex,
  });

  const handleSliderChange = (next: number) => {
    zoomSchedulerRef.current.clear();
    setSliderIndex(next);
    applyCategoryAxisZoom(xAxisRef.current, next, visibleCount);
  };

  useLayoutEffect(() => {
    if (showBlockingLoader) return;
    if (!chartDivRef.current) return;

    if (rootRef.current) { rootRef.current.dispose(); rootRef.current = null; xAxisRef.current = null; }

    const root = am5.Root.new(chartDivRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    rootRef.current = root;
    root._logo?.dispose();

    const compareDrillCount =
      isDrillDown && selectedNames.length > 0
        ? buildCompareMergedChartData(seriesMap, selectedNames, true).length
        : 0;
    const needsScroll =
      isDrillDown &&
      (selectedNames.length === 0
        ? (defaultData?.length ?? 0) > SCROLL_THRESHOLD
        : compareDrillCount > SCROLL_THRESHOLD);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false, panY: false,
        wheelX: "none", wheelY: "none",
        layout: root.verticalLayout,
        paddingTop: 8, paddingBottom: needsScroll ? 0 : 8, paddingLeft: 12, paddingRight: 8,
      })
    );
    chart.zoomOutButton.set("forceHidden", true);

    // Handle default data (single line) when no selections
    if (selectedNames.length === 0 && defaultData.length > 0) {
      const avg = defaultData.reduce((s, r) => s + r.Total, 0) / defaultData.length;

      // X axis
      const xRenderer = am5xy.AxisRendererX.new(root, { 
        minGridDistance: 30,
        cellStartLocation: needsScroll ? 0.1 : 0.5,
        cellEndLocation: needsScroll ? 0.9 : 0.5,
      });
      xRenderer.labels.template.setAll({ 
        fontSize: 11, 
        fill: am5.color("#9ca3af"), 
        paddingTop: 4,
        rotation: needsScroll ? -45 : 0,
        centerY: needsScroll ? am5.p0 : am5.p50,
        centerX: needsScroll ? am5.p100 : am5.p50,
      });
      xRenderer.grid.template.set("visible", false);

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          renderer: xRenderer,
          categoryField: "name",
        })
      );
      xAxisRef.current = xAxis;
      setupLineChartCursor(chart, root, xAxis);

      // Y axis
      const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 30 });
      yRenderer.labels.template.setAll({ fontSize: 9, fill: am5.color("#9ca3af") });
      yRenderer.grid.template.setAll({ stroke: am5.color("#f0f0f0"), strokeDasharray: [3, 3] });

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: yRenderer,
          extraMin: 0.05,
          extraMax: 0.15,
        })
      );

      // Average line
      const avgRange = yAxis.createAxisRange(yAxis.makeDataItem({ value: avg }));
      avgRange.get("grid")?.setAll({
        stroke: am5.color("#d1d5db"),
        strokeOpacity: 1,
        strokeDasharray: [4, 3],
      });

      const pointTooltipText = linePointTooltipText(isDrillDown, !!onDefaultPointClick && !isDrillDown);
      const pointTooltip = createCompactChartTooltip(root, pointTooltipText, true);

      // Line series
      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          xAxis, yAxis,
          valueYField: "Total",
          categoryXField: "name",
          stroke: am5.color(MONTH_COLOR),
          fill: am5.color(MONTH_COLOR),
          tooltip: pointTooltip,
        })
      );

      series.strokes.template.setAll({ strokeWidth: 2, interactive: true });

      series.bullets.push((rootBullet, _series, dataItem) => {
        const valueY = (dataItem as am5.DataItem<am5xy.ILineSeriesDataItem>).get("valueY");
        if (valueY == null) return undefined;

        const container = am5.Container.new(rootBullet, {});
        const circle = am5.Circle.new(rootBullet, {
          radius: 5,
          fill: am5.color(MONTH_COLOR),
          stroke: am5.color("#ffffff"),
          strokeWidth: 2,
          cursorOverStyle: onDefaultPointClick && !isDrillDown ? "pointer" : "default",
        });
        circle.set("tooltip", pointTooltip);

        if (onDefaultPointClick && !isDrillDown) {
          circle.states.create("hover", { radius: 6, fill: am5.color("#059669") });
          circle.events.on("click", (ev) => {
            const di = ev.target.dataItem as am5.DataItem<am5xy.ILineSeriesDataItem> | undefined;
            const monthName = di?.get("categoryX");
            if (monthName) onDefaultPointClick(normalizeMonthName(String(monthName)));
          });
        } else {
          circle.states.create("hover", { radius: 6, fill: am5.color("#059669") });
        }

        container.children.push(circle);
        container.children.push(
          am5.Label.new(rootBullet, {
            text: "{valueY.formatNumber('#,###.#')}",
            fill: am5.color("#374151"),
            fontSize: 9,
            fontWeight: "700",
            centerX: am5.p50,
            centerY: am5.p100,
            paddingBottom: 3,
            populateText: true,
            interactive: false,
            dy: -10,
          })
        );
        return am5.Bullet.new(rootBullet, { sprite: container });
      });

      xAxis.data.setAll(defaultData);
      series.data.setAll(defaultData);

      if (needsScroll) {
        zoomSchedulerRef.current.schedule(xAxis, 0, visibleCount);
      }

      series.appear(800);
      chart.appear(800, 100);
      setChartEpoch((n) => n + 1);

      return () => {
        zoomSchedulerRef.current.clear();
        if (rootRef.current) { rootRef.current.dispose(); rootRef.current = null; xAxisRef.current = null; }
      };
    }

    // Handle multiple series for comparison
    if (selectedNames.length > 0) {
      const merged = buildCompareMergedChartData(seriesMap, selectedNames, isDrillDown);

      // X axis
      const xRenderer = am5xy.AxisRendererX.new(root, {
        minGridDistance: isDrillDown ? 30 : 30,
        cellStartLocation: isDrillDown && needsScroll ? 0.1 : 0.5,
        cellEndLocation: isDrillDown && needsScroll ? 0.9 : 0.5,
      });
      xRenderer.labels.template.setAll({
        fontSize: isDrillDown ? 11 : 9,
        fill: am5.color("#9ca3af"),
        paddingTop: 4,
        rotation: isDrillDown && needsScroll ? -45 : 0,
        centerY: isDrillDown && needsScroll ? am5.p0 : am5.p50,
        centerX: isDrillDown && needsScroll ? am5.p100 : am5.p50,
      });
      xRenderer.grid.template.set("visible", false);

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          renderer: xRenderer,
          categoryField: COMPARE_CATEGORY_FIELD,
        })
      );
      xAxisRef.current = xAxis;
      setupLineChartCursor(chart, root, xAxis);

      // Y axis
      const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 30 });
      yRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color("#9ca3af") });
      yRenderer.grid.template.setAll({ stroke: am5.color("#f0f0f0"), strokeDasharray: [3, 3] });

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: yRenderer,
          extraMin: 0.05,
          extraMax: 0.05,
        })
      );

      // Create series for each selected name
      selectedNames.forEach((name, i) => {
        const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
        const seriesLabel = name;
        const compareTooltipText = isDrillDown
          ? `Day {categoryX}: [bold]${seriesLabel} {valueY.formatNumber('#,###.#')}[/] TMT`
          : `${seriesLabel} · {categoryX}: [bold]{valueY.formatNumber('#,###.#')}[/] TMT\n[fontSize:8px](Click for daily view)[/]`;
        const compareTooltip = createCompactChartTooltip(root, compareTooltipText, true);
        const series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: seriesLabel,
            xAxis, yAxis,
            valueYField: seriesLabel,
            categoryXField: COMPARE_CATEGORY_FIELD,
            stroke: am5.color(color),
            fill: am5.color(color),
            connect: true,
            tooltip: compareTooltip,
          })
        );

        series.strokes.template.setAll({
          strokeWidth: 2,
          interactive: true,
          cursorOverStyle: onComparePointClick && !isDrillDown ? "pointer" : "default",
        });
        if (onComparePointClick && !isDrillDown) {
          series.strokes.template.events.on("click", (ev) => {
            const category = getComparePointCategory(
              ev.target.dataItem as am5.DataItem<am5xy.ILineSeriesDataItem> | undefined,
            );
            if (category) onComparePointClick(normalizeMonthName(category));
          });
        }

        series.bullets.push((rootBullet, _series, dataItem) => {
          const valueY = (dataItem as am5.DataItem<am5xy.ILineSeriesDataItem>).get("valueY");
          if (valueY == null) return undefined;

          const circle = am5.Circle.new(rootBullet, {
            radius: 6,
            fill: am5.color(color),
            stroke: am5.color("#ffffff"),
            strokeWidth: 2,
          });
          circle.set("tooltip", compareTooltip);
          circle.states.create("hover", { radius: 7, fillOpacity: 0.85 });
          attachCompareMonthClick(circle, onComparePointClick, isDrillDown);

          return am5.Bullet.new(rootBullet, { sprite: circle });
        });

        series.bullets.push((rootBullet) =>
          am5.Bullet.new(rootBullet, {
            locationY: 1,
            sprite: am5.Label.new(rootBullet, {
              text: "{valueY.formatNumber('#,###.#')}",
              fill: am5.color(color),
              fontSize: 9,
              fontWeight: "700",
              centerX: am5.p50,
              centerY: am5.p100,
              paddingBottom: 3,
              populateText: true,
              interactive: false,
              dy: -10,
            }),
          }),
        );

        series.data.setAll(merged);
      });

      // Legend — fixed series names (selected bars), not hovered month/day
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          layout: root.horizontalLayout,
        })
      );
      legend.labels.template.setAll({
        fontSize: 11,
        fill: am5.color("#4b5563"),
        text: "{name}",
      });
      legend.valueLabels.template.set("forceHidden", true);
      legend.labels.template.adapters.add("text", (_text, target) => {
        const series = target.dataItem?.dataContext as am5xy.LineSeries | undefined;
        const label = series?.get("name");
        return label != null ? String(label) : _text;
      });
      legend.data.setAll(chart.series.values);

      xAxis.data.setAll(merged);

      if (isDrillDown && needsScroll) {
        zoomSchedulerRef.current.schedule(xAxis, 0, visibleCount);
      }

      chart.series.each((series) => {
        series.appear(800);
      });
      chart.appear(800, 100);
      setChartEpoch((n) => n + 1);

      return () => {
        zoomSchedulerRef.current.clear();
        if (rootRef.current) { rootRef.current.dispose(); rootRef.current = null; xAxisRef.current = null; }
      };
    }

    return () => {
      zoomSchedulerRef.current.clear();
      if (rootRef.current) { rootRef.current.dispose(); rootRef.current = null; xAxisRef.current = null; }
    };
  }, [
    seriesMap, showBlockingLoader, selectedNames, defaultData, onDefaultPointClick, onComparePointClick,
    isDrillDown, SCROLL_THRESHOLD, height, fillContainer,
  ]);

  if (showBlockingLoader) {
    return (
      <div
        className={`flex items-center justify-center gap-2 text-xs text-gray-400 ${fillContainer ? "min-h-[120px] flex-1" : ""}`}
        style={plotLayout.statusStyle}
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Loading compare data…
      </div>
    );
  }

  if (selectedNames.length === 0 && defaultData.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-gray-400 ${fillContainer ? "flex-1" : ""}`}
        style={plotLayout.statusStyle}
      >
        No data
      </div>
    );
  }

  const sliderFillPct = maxSlider > 0 ? (safeSliderIndex / maxSlider) * 100 : 0;

  return (
    <div className={plotLayout.wrapperClassName}>
      <div className={plotLayout.plotClassName} style={plotLayout.plotStyle}>
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 rounded bg-white/75 text-xs text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Updating…
          </div>
        )}
        <div ref={chartDivRef} className="relative z-0 h-full w-full" />
      </div>
      {showSlider && (
        <div className="relative z-30 flex items-center gap-2 px-1 pb-1 shrink-0">
          <span className="text-[9px] text-gray-400 shrink-0">1</span>
          <input
            type="range"
            min={0}
            max={maxSlider}
            step={1}
            value={safeSliderIndex}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            onInput={(e) => handleSliderChange(Number((e.target as HTMLInputElement).value))}
            className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
            style={{
              accentColor: "#10b981",
              background: `linear-gradient(to right, #10b981 ${sliderFillPct}%, #e5e7eb ${sliderFillPct}%)`,
            }}
          />
          <span className="text-[9px] text-gray-400 shrink-0">{sliderPointCount}</span>
        </div>
      )}
    </div>
  );
};

// ─── Month line chart (single) - amCharts ─────────────────────────────────────

interface MonthLineChartProps { 
  chartData: ChartRow[]; 
  loading: boolean; 
  error: string | null;
  onPointClick?: (monthName: string) => void;
  isDrillDown?: boolean;
  drilledMonth?: string | null;
  height?: number;
  fillContainer?: boolean;
}

const MonthLineChart: React.FC<MonthLineChartProps> = ({
  chartData, loading, error, onPointClick, isDrillDown = false, drilledMonth,
  height = INLINE_CHART_HEIGHT, fillContainer = false,
}) => {
  const plotLayout = getChartPlotLayout(fillContainer, height);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const xAxisRef = useRef<am5xy.CategoryAxis<am5xy.AxisRenderer> | null>(null);
  const zoomSchedulerRef = useRef(createCategoryAxisZoomScheduler());

  const SCROLL_THRESHOLD = isDrillDown ? 10 : 999; // Enable scroll for daily view with >10 days
  const visibleCount = SCROLL_THRESHOLD;

  const [sliderIndex, setSliderIndex] = useState(0);
  const [chartEpoch, setChartEpoch] = useState(0);

  useEffect(() => () => zoomSchedulerRef.current.clear(), []);

  const maxSlider = Math.max(0, chartData.length - visibleCount);
  const safeSliderIndex = Math.min(sliderIndex, maxSlider);
  const showSlider = isDrillDown && chartData.length > SCROLL_THRESHOLD;
  const showBlockingLoader = loading && chartData.length === 0;

  useEffect(() => { setSliderIndex(0); }, [chartData]);

  useEffect(() => {
    if (safeSliderIndex !== sliderIndex) setSliderIndex(safeSliderIndex);
  }, [safeSliderIndex, sliderIndex]);

  useEffect(() => {
    if (!isDrillDown || chartData.length <= SCROLL_THRESHOLD) return;
    applyCategoryAxisZoom(xAxisRef.current, safeSliderIndex, visibleCount);
  }, [safeSliderIndex, chartEpoch, isDrillDown, chartData.length, SCROLL_THRESHOLD, visibleCount]);

  useCategoryChartHostResize(chartDivRef, rootRef, xAxisRef, {
    active: isDrillDown && chartData.length > SCROLL_THRESHOLD,
    chartEpoch,
    pointCount: chartData.length,
    visibleCount,
    startIndex: safeSliderIndex,
  });

  const handleSliderChange = (next: number) => {
    zoomSchedulerRef.current.clear();
    setSliderIndex(next);
    applyCategoryAxisZoom(xAxisRef.current, next, visibleCount);
  };

  useLayoutEffect(() => {
    if (showBlockingLoader || error || chartData.length === 0) return;
    if (!chartDivRef.current) return;

    if (rootRef.current) { rootRef.current.dispose(); rootRef.current = null; xAxisRef.current = null; }

    const root = am5.Root.new(chartDivRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    rootRef.current = root;
    root._logo?.dispose();

    const needsScroll = chartData.length > SCROLL_THRESHOLD;

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false, panY: false,
        wheelX: "none", wheelY: "none",
        layout: root.verticalLayout,
        paddingTop: 8, paddingBottom: 0, paddingLeft: 12, paddingRight: 8,
      })
    );
    chart.zoomOutButton.set("forceHidden", true);

    // X axis - categories (months or days)
    const xRenderer = am5xy.AxisRendererX.new(root, { 
      minGridDistance: isDrillDown ? 30 : 30,
      cellStartLocation: needsScroll ? 0.1 : 0.5,
      cellEndLocation: needsScroll ? 0.9 : 0.5,
    });
    xRenderer.labels.template.setAll({ 
      fontSize: 11, 
      fill: am5.color("#9ca3af"), 
      paddingTop: 4,
      rotation: isDrillDown && needsScroll ? -45 : 0,
      centerY: isDrillDown && needsScroll ? am5.p0 : am5.p50,
      centerX: isDrillDown && needsScroll ? am5.p100 : am5.p50,
    });
    xRenderer.grid.template.set("visible", false);

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        renderer: xRenderer,
        categoryField: "name",
      })
    );
    xAxisRef.current = xAxis;
    setupLineChartCursor(chart, root, xAxis);

    // Y axis - values
    const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 30 });
    yRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color("#9ca3af") });
    yRenderer.grid.template.setAll({ stroke: am5.color("#f0f0f0"), strokeDasharray: [3, 3] });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        extraMin: 0.05,
        extraMax: 0.15,
      })
    );

    // Average line
    const avg = chartData.reduce((s, r) => s + r.Total, 0) / chartData.length;
    const avgRange = yAxis.createAxisRange(
      yAxis.makeDataItem({ value: avg })
    );
    avgRange.get("grid")?.setAll({
      stroke: am5.color("#d1d5db"),
      strokeOpacity: 1,
      strokeDasharray: [4, 3],
    });

    const pointTooltipText = linePointTooltipText(isDrillDown, !!onPointClick && !isDrillDown);
    const pointTooltip = createCompactChartTooltip(root, pointTooltipText, true);

    // Line series
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        xAxis, yAxis,
        valueYField: "Total",
        categoryXField: "name",
        stroke: am5.color(MONTH_COLOR),
        fill: am5.color(MONTH_COLOR),
        tooltip: pointTooltip,
      })
    );

    series.strokes.template.setAll({ strokeWidth: 2, interactive: true });

    series.bullets.push((rootBullet, _series, dataItem) => {
      const valueY = (dataItem as am5.DataItem<am5xy.ILineSeriesDataItem>).get("valueY");
      if (valueY == null) return undefined;

      const container = am5.Container.new(rootBullet, {});
      const circle = am5.Circle.new(rootBullet, {
        radius: 5,
        fill: am5.color(MONTH_COLOR),
        stroke: am5.color("#ffffff"),
        strokeWidth: 2,
        cursorOverStyle: onPointClick && !isDrillDown ? "pointer" : "default",
      });
      circle.set("tooltip", pointTooltip);

      if (onPointClick && !isDrillDown) {
        circle.states.create("hover", { radius: 6, fill: am5.color("#059669") });
        circle.events.on("click", (ev) => {
          const di = ev.target.dataItem as am5.DataItem<am5xy.ILineSeriesDataItem> | undefined;
          const monthName = di?.get("categoryX");
          if (monthName) onPointClick(normalizeMonthName(String(monthName)));
        });
      } else {
        circle.states.create("hover", { radius: 6, fill: am5.color("#059669") });
      }

      container.children.push(circle);
      container.children.push(
        am5.Label.new(rootBullet, {
          text: "{valueY.formatNumber('#,###.#')}",
          fill: am5.color("#374151"),
          fontSize: 9,
          fontWeight: "700",
          centerX: am5.p50,
          centerY: am5.p100,
          paddingBottom: 3,
          populateText: true,
          interactive: false,
          dy: -10,
        })
      );
      return am5.Bullet.new(rootBullet, { sprite: container });
    });

    xAxis.data.setAll(chartData);
    series.data.setAll(chartData);

    if (needsScroll) {
      zoomSchedulerRef.current.schedule(xAxis, 0, visibleCount);
    }

    series.appear(800);
    chart.appear(800, 100);
    setChartEpoch((n) => n + 1);

    return () => {
      zoomSchedulerRef.current.clear();
      if (rootRef.current) { rootRef.current.dispose(); rootRef.current = null; xAxisRef.current = null; }
    };
  }, [chartData, showBlockingLoader, error, onPointClick, isDrillDown, SCROLL_THRESHOLD, height, fillContainer]);

  if (showBlockingLoader) {
    return (
      <div
        className={`flex items-center justify-center gap-2 text-xs text-gray-400 ${fillContainer ? "min-h-[120px] flex-1" : ""}`}
        style={plotLayout.statusStyle}
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-red-400 ${fillContainer ? "flex-1" : ""}`}
        style={plotLayout.statusStyle}
      >
        {error}
      </div>
    );
  }
  if (chartData.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-gray-400 ${fillContainer ? "flex-1" : ""}`}
        style={plotLayout.statusStyle}
      >
        No data
      </div>
    );
  }

  const sliderFillPct = maxSlider > 0 ? (safeSliderIndex / maxSlider) * 100 : 0;

  return (
    <div className={plotLayout.wrapperClassName}>
      <div className={plotLayout.plotClassName} style={plotLayout.plotStyle}>
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 rounded bg-white/75 text-xs text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Updating…
          </div>
        )}
        <div ref={chartDivRef} className="relative z-0 h-full w-full" />
      </div>
      {showSlider && (
        <div className="relative z-30 flex shrink-0 items-center gap-2 px-1 pb-1">
          <span className="text-[9px] text-gray-400 shrink-0">1</span>
          <input
            type="range"
            min={0}
            max={maxSlider}
            step={1}
            value={safeSliderIndex}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            onInput={(e) => handleSliderChange(Number((e.target as HTMLInputElement).value))}
            className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
            style={{
              accentColor: "#10b981",
              background: `linear-gradient(to right, #10b981 ${sliderFillPct}%, #e5e7eb ${sliderFillPct}%)`,
            }}
          />
          <span className="text-[9px] text-gray-400 shrink-0">{chartData.length}</span>
        </div>
      )}
    </div>
  );
};

// ─── amCharts 5 Bar chart body ────────────────────────────────────────────────

interface ChartBodyProps {
  chartData: ChartRow[]; loading: boolean; error: string | null;
  selectedBar?: string | null; selectedBars?: Set<string>;
  onBarClick?: (name: string) => void;
  barColor?: string; compareMode?: boolean;
  chartId: string;
  height?: number;
  fillContainer?: boolean;
}

const ChartBody: React.FC<ChartBodyProps> = ({
  chartData, loading, error, selectedBar, selectedBars, onBarClick,
  barColor = BAR_COLOR, compareMode = false, chartId, height = INLINE_CHART_HEIGHT,
  fillContainer = false,
}) => {
  const plotLayout = getChartPlotLayout(fillContainer, height);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const rootRef     = useRef<am5.Root | null>(null);
  const xAxisRef    = useRef<am5xy.CategoryAxis<am5xy.AxisRenderer> | null>(null);

  const SCROLL_THRESHOLD = 8;
  const visibleCount = SCROLL_THRESHOLD;

  // slider state: index of first visible bar (0-based)
  const [sliderIndex, setSliderIndex] = useState(0);

  // when data changes, reset slider to 0
  useEffect(() => { setSliderIndex(0); }, [chartData]);

  // whenever sliderIndex changes, zoom the axis
  useEffect(() => {
    if (!xAxisRef.current || chartData.length <= SCROLL_THRESHOLD) return;
    xAxisRef.current.zoomToIndexes(sliderIndex, sliderIndex + visibleCount);
  }, [sliderIndex, chartData.length]);

  useLayoutEffect(() => {
    if (loading || error || chartData.length === 0) return;
    if (!chartDivRef.current) return;

    if (rootRef.current) { rootRef.current.dispose(); rootRef.current = null; xAxisRef.current = null; }

    const root = am5.Root.new(chartDivRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    rootRef.current = root;
    root._logo?.dispose();

    const needsScroll = chartData.length > SCROLL_THRESHOLD;

    // ── Vertical bar chart (categories on X, values on Y)
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false, panY: false,
        wheelX: "none", wheelY: "none",
        layout: root.verticalLayout,
        paddingTop: 8, paddingBottom: 0, paddingLeft: 8, paddingRight: 0,
      })
    );
    chart.zoomOutButton.set("forceHidden", true);

    // ── X axis = categories
    const xRenderer = am5xy.AxisRendererX.new(root, {
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
      minGridDistance: 20,
    });
    xRenderer.labels.template.setAll({
      fontSize: 11,
      fill: am5.color("#374151"),
      fontWeight: "500",
      maxWidth: 70,
      oversizedBehavior: "wrap",
      centerY: am5.p0,
      centerX: am5.p50,
      paddingTop: 4,
      textAlign: "center",
    });
    xRenderer.grid.template.set("visible", false);

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        renderer: xRenderer,
        categoryField: "name",
      })
    );
    xAxisRef.current = xAxis;

    // ── Y axis = values
    const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 30 });
    yRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color("#9ca3af") });
    yRenderer.grid.template.setAll({ stroke: am5.color("#f0f0f0"), strokeDasharray: [3, 3] });

    const hasNegative = chartData.some((r) => r.Total < 0);
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        strictMinMax: hasNegative ? false : true,
        min: hasNegative ? undefined : 0,
        extraMin: 0,
        extraMax: 0.15,
        baseValue: 0,
      })
    );

    // ── color resolver
    const resolveColor = (name, total) => {
      const defaultColor = total < 0 ? "#f87171" : barColor;
      if (compareMode && selectedBars) {
        if (selectedBars.size === 0) return defaultColor;
        if (selectedBars.has(name)) return COMPARE_COLORS[Array.from(selectedBars).indexOf(name) % COMPARE_COLORS.length];
        return BAR_COLOR_DIM;
      }
      if (!selectedBar) return defaultColor;
      return name === selectedBar ? BAR_COLOR_SELECTED : BAR_COLOR_DIM;
    };

    // ── series
    const barTooltip = createCompactChartTooltip(root, BAR_TOOLTIP_TEXT, false);

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis, yAxis,
        valueYField: "Total",
        categoryXField: "name",
        baseAxis: xAxis,
        tooltip: barTooltip,
      })
    );

    series.columns.template.setAll({
      width: am5.percent(55),
      maxWidth: 40,
      cornerRadiusTL: 4, cornerRadiusTR: 4,
      cornerRadiusBL: 0, cornerRadiusBR: 0,
      strokeOpacity: 0,
      cursorOverStyle: onBarClick ? "pointer" : "default",
      showTooltipOn: "hover",
    });
    series.columns.template.set("tooltip", barTooltip);

    series.columns.template.adapters.add("fill", (_fill, target) => {
      const di = target.dataItem;
      if (!di) return am5.color(barColor);
      return am5.color(resolveColor((di as any).get("categoryX") ?? "", (di as any).get("valueY") ?? 0));
    });
    series.columns.template.adapters.add("stroke", (_s, target) => {
      const di = target.dataItem;
      if (!di) return am5.color(barColor);
      return am5.color(resolveColor((di as any).get("categoryX") ?? "", (di as any).get("valueY") ?? 0));
    });

    // value labels on top of each bar (non-interactive so column tooltips work)
    series.bullets.push((root, _series, dataItem) => {
      const value = (dataItem as any).get("valueY") ?? 0;
      const isNeg = value < 0;
      return am5.Bullet.new(root, {
        locationY: isNeg ? 0 : 1,
        sprite: am5.Label.new(root, {
          text: "{valueY.formatNumber('#,###.#')}",
          fill: am5.color("#374151"),
          fontSize: 9,
          fontWeight: "700",
          centerX: am5.p50,
          centerY: isNeg ? am5.p0 : am5.p100,
          paddingBottom: isNeg ? 0 : 3,
          paddingTop: isNeg ? 3 : 0,
          populateText: true,
          interactive: false,
        }),
      });
    });

    // click handler
    if (onBarClick) {
      series.columns.template.events.on("click", (ev) => {
        const dataItem = ev.target.dataItem;
        if (dataItem) onBarClick((dataItem as any).get("categoryX") ?? "");
      });
    }

    // zero baseline highlight
    yAxis.get("renderer").grid.template.adapters.add("strokeOpacity", (_opacity, target) => {
      const value = (target.dataItem as any)?.get("value");
      return value === 0 ? 1 : 0.3;
    });
    yAxis.get("renderer").grid.template.adapters.add("stroke", (stroke, target) => {
      const value = (target.dataItem as any)?.get("value");
      return value === 0 ? am5.color("#94a3b8") : stroke;
    });
    yAxis.get("renderer").grid.template.adapters.add("strokeWidth", (_w, target) => {
      const value = (target.dataItem as any)?.get("value");
      return value === 0 ? 2 : 1;
    });

    // set data then zoom to first SCROLL_THRESHOLD bars
    xAxis.data.setAll(chartData);
    series.data.setAll(chartData);

    if (needsScroll) {
      setTimeout(() => {
        xAxis.zoomToIndexes(0, SCROLL_THRESHOLD);
      }, 100);
    }

    series.appear(800);
    chart.appear(800, 100);

    let resizeObserver: ResizeObserver | undefined;
    if (fillContainer && chartDivRef.current) {
      resizeObserver = new ResizeObserver(() => root.resize());
      resizeObserver.observe(chartDivRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      if (rootRef.current) { rootRef.current.dispose(); rootRef.current = null; xAxisRef.current = null; }
    };
  }, [chartData, loading, error, selectedBar, selectedBars, barColor, compareMode, height, fillContainer]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center gap-2 text-xs text-gray-400 ${fillContainer ? "min-h-[120px] flex-1" : ""}`}
        style={plotLayout.statusStyle}
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-red-400 ${fillContainer ? "flex-1" : ""}`}
        style={plotLayout.statusStyle}
      >
        {error}
      </div>
    );
  }
  if (chartData.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-gray-400 ${fillContainer ? "flex-1" : ""}`}
        style={plotLayout.statusStyle}
      >
        No data
      </div>
    );
  }

  const maxSlider = Math.max(0, chartData.length - visibleCount);
  const showSlider = chartData.length > SCROLL_THRESHOLD;

  return (
    <div className={plotLayout.wrapperClassName}>
      <div className={plotLayout.plotClassName} style={plotLayout.plotStyle}>
        <div ref={chartDivRef} id={chartId} className="h-full w-full" />
      </div>
      {showSlider && (
        <div className="flex shrink-0 items-center gap-2 px-1 pb-1">
          <span className="text-[9px] text-gray-400 shrink-0">1</span>
          <input
            type="range"
            min={0}
            max={maxSlider}
            step={1}
            value={sliderIndex}
            onChange={(e) => setSliderIndex(Number(e.target.value))}
            className="w-full h-1 appearance-none rounded-full cursor-pointer"
            style={{
              accentColor: "#6366f1",
              background: `linear-gradient(to right, #6366f1 ${(sliderIndex / maxSlider) * 100}%, #e5e7eb ${(sliderIndex / maxSlider) * 100}%)`,
            }}
          />
          <span className="text-[9px] text-gray-400 shrink-0">{chartData.length}</span>
        </div>
      )}
    </div>
  );
};

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ icon: React.ReactNode; label: string; accent?: string; className?: string }> = ({
  icon, label, accent, className = "mb-2",
}) => (
  <div className={`flex items-center gap-1.5 min-w-0 ${className}`}>
    <span className={`flex items-center justify-center w-5 h-5 rounded ${accent ?? "bg-blue-50 text-blue-400"}`}>{icon}</span>
    <span className="text-[10px] font-semibold text-gray-500 tracking-wide uppercase">{label}</span>
  </div>
);

const ChartMaximizeButton: React.FC<{ onClick: () => void; title?: string }> = ({
  onClick,
  title = "View fullscreen",
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="p-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 shadow-sm transition-colors shrink-0"
  >
    <Maximize2 className="h-3.5 w-3.5" />
  </button>
);

const ChartFullscreenModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onBackToMonthly?: () => void;
  backButtonVariant?: "emerald" | "violet";
}> = ({ open, onClose, title, children, onBackToMonthly, backButtonVariant = "violet" }) => {
  if (!open) return null;
  const backBtnClass =
    backButtonVariant === "emerald"
      ? "text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-100"
      : "text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 border-violet-100";
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/60 p-3 sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex flex-1 min-h-0 w-full flex-col rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 shrink-0">
          <span className="text-sm font-bold text-gray-800 min-w-0 truncate">{title}</span>
          <div className="flex items-center gap-2 shrink-0">
            {onBackToMonthly && (
              <button
                type="button"
                onClick={onBackToMonthly}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${backBtnClass}`}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Back to Monthly
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden p-4">{children}</div>
      </div>
    </div>
  );
};

// ─── Compare toggle button ────────────────────────────────────────────────────

const CompareBtn: React.FC<{ active: boolean; count: number; onClick: () => void }> = ({ active, count, onClick }) => (
  <button type="button" onClick={onClick}
    title={active ? "Exit Compare" : "Compare mode: click multiple bars"}
    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all shadow-sm whitespace-nowrap ${
      active ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
             : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
    }`}>
    <GitCompare className="h-3.5 w-3.5" />
    Compare
    {active && count > 0 && (
      <span className="ml-0.5 bg-white/30 text-white rounded-full px-1.5 py-0 text-[9px] font-bold">{count}</span>
    )}
  </button>
);

// ─── Helper fetch ─────────────────────────────────────────────────────────────

// Helper: normalize month name to title case (e.g., "APR" -> "Apr", "apr" -> "Apr")
const normalizeMonthName = (monthName: string): string => {
  if (!monthName || monthName.length === 0) return monthName;
  return monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
};

const fetchAndMap = async (
  fiscalYearLabel: string, groupBy: string[], nameKey: string,
  extraFilters?: Record<string, string | string[]>, orderBy?: string[],
): Promise<ChartRow[]> => {
  const payload = {
    table: "MOM_DAY_LEVEL_DATA",
    filters: { FISCALYEAR: [fiscalYearLabel], ...extraFilters },
    date_column: null, date_from: null, date_to: null,
    aggregations: ["['Total', 'sum', 'NETWEIGHT_TMT']"],
    detail_fields: [],
    order_by: orderBy ?? ["['Total', 'desc']"],
    limit: 0, skip: 0, group_by: groupBy,
  };
  const response = await apiClient.post("/api/tableanalytics/generate_data_aggregations", payload);
  const rows: any[] = Array.isArray(response.data?.data) ? response.data.data
    : Array.isArray(response.data) ? response.data : [];
  return rows
    .map((row: any) => {
      const name = row[nameKey] ?? row.SBU_Name ?? "";
      // Normalize month names to title case (e.g., "APR" -> "Apr")
      const normalizedName = nameKey === "month_name" ? normalizeMonthName(name) : name;
      return { name: normalizedName, Total: Number(row.Total ?? 0) };
    })
    .filter((row) => row.name !== null && row.name !== undefined && String(row.name).trim() !== "" && String(row.name).trim() !== "0");
};

/** Fetch day-level rows per name (DAY_ID → chart day 01–31). */
const fetchDailySeriesMap = async (
  monthName: string,
  names: string[],
  drillKey: string,
  fiscalYearLabel: string,
  baseExtra: Record<string, string | string[]>,
): Promise<SeriesMap> => {
  const dailySeries: SeriesMap = {};
  await Promise.all(
    names.map(async (name) => {
      try {
        const extra: Record<string, string | string[]> = {
          ...baseExtra,
          [drillKey]: name,
          month_name: [monthName],
        };
        const payload = {
          table: "MOM_DAY_LEVEL_DATA",
          filters: { FISCALYEAR: [fiscalYearLabel], ...extra },
          date_column: null,
          date_from: null,
          date_to: null,
          aggregations: ["['Total', 'sum', 'NETWEIGHT_TMT']"],
          detail_fields: [],
          order_by: ["['DAY_ID', 'asc']"],
          limit: 0,
          skip: 0,
          group_by: ["month_name", "DAY_ID", "FISCALYEAR"],
        };
        const response = await apiClient.post("/api/tableanalytics/generate_data_aggregations", payload);
        const rows: any[] = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        dailySeries[name] = mapDailyApiRows(rows);
      } catch {
        dailySeries[name] = [];
      }
    }),
  );
  return dailySeries;
};

// helper: fetch compare month series for a set of names
const fetchCompareSeries = async (
  names: string[], drillKey: string, fiscalYearLabel: string,
  parentFilter?: Record<string, string>,
): Promise<SeriesMap> => {
  const results: SeriesMap = {};
  await Promise.all(
    names.map(async (name) => {
      try {
        const rows = await fetchAndMap(
          fiscalYearLabel,
          ["month_name", "FISCALYEAR"],
          "month_name",
          { ...parentFilter, [drillKey]: name },
          ["['month_name', 'asc']"],
        );
        results[name] = [...rows].sort((a, b) => {
          const ai = FISCAL_MONTH_ORDER.indexOf(a.name.toUpperCase().slice(0, 3));
          const bi = FISCAL_MONTH_ORDER.indexOf(b.name.toUpperCase().slice(0, 3));
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
      } catch { results[name] = []; }
    }),
  );
  return results;
};

// sort months helper
const sortMonths = (rows: ChartRow[]) =>
  [...rows].sort((a, b) => {
    const ai = FISCAL_MONTH_ORDER.indexOf(a.name.toUpperCase().slice(0, 3));
    const bi = FISCAL_MONTH_ORDER.indexOf(b.name.toUpperCase().slice(0, 3));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props { selectedYear?: string; sbu?: string; }

// ─── Main component ───────────────────────────────────────────────────────────

const SalesDetail: React.FC<Props> = ({ selectedYear = "2026-2027", sbu }) => {
  const { user } = useAuthStore();

  // Compute role-restricted tabs, then further filter out "SBU" when sbu prop is set
  const roleTabs = getTabsForRole(user?.novex_role ?? []);
  const TABS: Tab[] = sbu ? roleTabs.filter((t) => t !== "SBU") : roleTabs;
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Card 1 normal + compare
  const [selectedBar, setSelectedBar]           = useState<string | null>(null);
  const [compareMode, setCompareMode]           = useState(false);
  const [selectedBars, setSelectedBars]         = useState<Set<string>>(new Set());
  const [compareSeriesMap, setCompareSeriesMap] = useState<SeriesMap>({});
  const [compareLoading, setCompareLoading]     = useState(false);
  const [compareDrilledMonth, setCompareDrilledMonth] = useState<string | null>(null); // Track drilled month in compare mode
  const [compareDailySeriesMap, setCompareDailySeriesMap] = useState<SeriesMap>({}); // Daily data for compare mode
  const [expandedChartPanel, setExpandedChartPanel] = useState<
    "primary" | "secondary" | "zonePrimary" | "zoneSecondary" | null
  >(null);

  // ── Card 2 compare (always on — no toggle needed)
  const [zoneSelectedBars, setZoneSelectedBars]         = useState<Set<string>>(new Set());
  const [zoneCompareSeriesMap, setZoneCompareSeriesMap] = useState<SeriesMap>({});
  const [zoneCompareDailySeriesMap, setZoneCompareDailySeriesMap] = useState<SeriesMap>({});
  const [zoneCompareLoading, setZoneCompareLoading]     = useState(false);

  // unified per-tab filter (drives Card 2 drill-down via currentFilter)
  const [selectedFilter, setSelectedFilter] = useState<Partial<Record<Tab, string | null>>>({});

  const [monthData, setMonthData]       = useState<ChartRow[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError]     = useState<string | null>(null);
  const [drilledMonth, setDrilledMonth] = useState<string | null>(null); // Track drilled month
  const [dailyData, setDailyData]       = useState<ChartRow[]>([]);

  const [zoneData, setZoneData]         = useState<ChartRow[]>([]);
  const [zoneLoading, setZoneLoading]   = useState(false);
  const [zoneError, setZoneError]       = useState<string | null>(null);

  const [zoneMonthData, setZoneMonthData]       = useState<ChartRow[]>([]);
  const [zoneMonthLoading, setZoneMonthLoading] = useState(false);
  const [zoneMonthError, setZoneMonthError]     = useState<string | null>(null);
  const [zoneDrilledMonth, setZoneDrilledMonth] = useState<string | null>(null); // Track drilled month for zone chart
  const [zoneDailyData, setZoneDailyData]       = useState<ChartRow[]>([]);

  const card2Tabs = TABS.slice(TABS.indexOf(activeTab) + 1);
  // zoneTab is derived from activeTab so it always stays in sync without a double-render.
  // overrideZoneTab stores a manual Card-2 tab pick; it is cleared whenever activeTab changes.
  const [overrideZoneTab, setOverrideZoneTab] = useState<Tab | null>(null);
  const zoneTab: Tab | null = overrideZoneTab && card2Tabs.includes(overrideZoneTab)
    ? overrideZoneTab
    : (card2Tabs[0] ?? null);

  const currentFilter    = selectedFilter[activeTab] ?? null;
  const setCurrentFilter = (v: string | null) =>
    setSelectedFilter((prev) => ({ ...prev, [activeTab]: v }));

  const fiscalYearLabel = selectedYear ? `FY ${selectedYear}` : "FY 2023-2024";

  // ── ZoneWiseFilterMenu state
  const [fmSBU, setFmSBU]               = useState(sbu ?? "");
  const [fmZone, setFmZone]             = useState("");
  const [fmRegion, setFmRegion]         = useState("");
  const [fmSalesArea, setFmSalesArea]   = useState("");
  const [fmProduct, setFmProduct]       = useState<string[]>([]);
  const [fmSbuOptions, setFmSbuOptions] = useState<string[]>([]);
  const [fmZoneOptions, setFmZoneOptions]   = useState<string[]>([]);
  const [fmRegionOptions, setFmRegionOptions] = useState<string[]>([]);
  const [fmSalesAreaOptions, setFmSalesAreaOptions] = useState<string[]>([]);
  const [fmProductOptions, setFmProductOptions]     = useState<string[]>([]);

  const resetFilters = () => {
    setFmSBU(sbu ?? "");
    setFmZone("");
    setFmRegion("");
    setFmSalesArea("");
    setFmProduct([]);
    setSelectedBar(null);
    setSelectedBars(new Set());
    setZoneSelectedBars(new Set());
  };

  const loadDistinctValues = useCallback(async (columns: string[], whereCond: any[] = []) => {
    const results: Record<string, string[]> = {};
    try {
      const res = await fetchDistinctValues({
        connection_id: "1", schema: "public",
        table: "MOM_DAY_LEVEL_DATA", column: columns,
        where_cond: [{ key: "SBU_Name", cond: "!=", value: "0" }, ...whereCond],
      });
      if (res?.status && res?.data) {
        columns.forEach((col) => {
          if (Array.isArray(res.data[col])) results[col] = res.data[col].filter((v: string) => String(v).trim() !== "0");
        });
      }
    } catch {}
    return results;
  }, []);

  // load all filter options on mount
  useEffect(() => {
    const whereCond = sbu ? [{ key: "SBU_Name", cond: "=", value: sbu }] : [];
    loadDistinctValues(["SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], whereCond).then((res) => {
      if (res["SBU_Name"])       setFmSbuOptions(res["SBU_Name"]);
      if (res["Zone_Name"])      setFmZoneOptions(res["Zone_Name"]);
      if (res["Region_Name"])    setFmRegionOptions(res["Region_Name"]);
      if (res["SalesArea_Name"]) setFmSalesAreaOptions(res["SalesArea_Name"]);
      if (res["ProductName"])    setFmProductOptions(res["ProductName"]);
    });
  }, [loadDistinctValues, sbu]);

  const handleFmSBUChange = async (_key: string, value: string) => {
    setFmSBU(value); setFmZone(""); setFmRegion(""); setFmSalesArea(""); setFmProduct([]);
    const whereCond = value ? [{ key: "SBU_Name", cond: "=", value }] : [];
    const res = await loadDistinctValues(["Zone_Name", "Region_Name", "SalesArea_Name", "ProductName"], whereCond);
    setFmZoneOptions(res["Zone_Name"] ?? []);
    setFmRegionOptions(res["Region_Name"] ?? []);
    setFmSalesAreaOptions(res["SalesArea_Name"] ?? []);
    setFmProductOptions(res["ProductName"] ?? []);
  };
  const handleFmZoneChange = async (_key: string, value: string) => {
    setFmZone(value); setFmRegion(""); setFmSalesArea(""); setFmProduct([]);
    const whereCond = [
      ...(fmSBU ? [{ key: "SBU_Name", cond: "=", value: fmSBU }] : []),
      ...(value ? [{ key: "Zone_Name", cond: "=", value }] : []),
    ];
    const res = await loadDistinctValues(["Region_Name", "SalesArea_Name", "ProductName"], whereCond);
    setFmRegionOptions(res["Region_Name"] ?? []);
    setFmSalesAreaOptions(res["SalesArea_Name"] ?? []);
    setFmProductOptions(res["ProductName"] ?? []);
  };
  const handleFmRegionChange = async (_key: string, value: string) => {
    setFmRegion(value); setFmSalesArea(""); setFmProduct([]);
    const whereCond = [
      ...(fmSBU    ? [{ key: "SBU_Name",    cond: "=", value: fmSBU    }] : []),
      ...(fmZone   ? [{ key: "Zone_Name",   cond: "=", value: fmZone   }] : []),
      ...(value    ? [{ key: "Region_Name", cond: "=", value           }] : []),
    ];
    const res = await loadDistinctValues(["SalesArea_Name", "ProductName"], whereCond);
    setFmSalesAreaOptions(res["SalesArea_Name"] ?? []);
    setFmProductOptions(res["ProductName"] ?? []);
  };
  const handleFmSalesAreaChange = async (_key: string, value: string) => {
    setFmSalesArea(value); setFmProduct([]);
    const whereCond = [
      ...(fmSBU       ? [{ key: "SBU_Name",      cond: "=", value: fmSBU       }] : []),
      ...(fmZone      ? [{ key: "Zone_Name",      cond: "=", value: fmZone      }] : []),
      ...(fmRegion    ? [{ key: "Region_Name",    cond: "=", value: fmRegion    }] : []),
      ...(value       ? [{ key: "SalesArea_Name", cond: "=", value              }] : []),
    ];
    const res = await loadDistinctValues(["ProductName"], whereCond);
    setFmProductOptions(res["ProductName"] ?? []);
  };
  const handleFmProductChange = (_key: string, value: string[]) => {
    setFmProduct(value);
  };

  // build the extra filter object from ZoneWiseFilterMenu selections
  const fmExtra: Record<string, string> = {};
  if (fmSBU)        fmExtra["SBU_Name"]      = fmSBU;
  if (fmZone)       fmExtra["Zone_Name"]      = fmZone;
  if (fmRegion)     fmExtra["Region_Name"]    = fmRegion;
  if (fmSalesArea)  fmExtra["SalesArea_Name"] = fmSalesArea;
  if (fmProduct.length === 1) fmExtra["ProductName"] = fmProduct[0];

  // ── reset everything on tab change
  useEffect(() => {
    setOverrideZoneTab(null);
    setSelectedBar(null);
    setSelectedBars(new Set());
    setCompareSeriesMap({});
    setZoneSelectedBars(new Set());
    setZoneCompareSeriesMap({});
    setZoneCompareDailySeriesMap({});
    setZoneDrilledMonth(null);
    setZoneDailyData([]);
  }, [activeTab]);

  // ── reset Card 2 compare data when the Card 2 tab (zoneTab) changes
  useEffect(() => {
    setZoneSelectedBars(new Set());
    setZoneCompareSeriesMap({});
    setZoneCompareDailySeriesMap({});
    setZoneDrilledMonth(null);
    setZoneDailyData([]);
  }, [zoneTab]);

  // ── Card 1: toggle compare mode
  useEffect(() => {
    if (!compareMode) { setSelectedBars(new Set()); setCompareSeriesMap({}); }
    else setSelectedBar(null);
  }, [compareMode]);

  // ── Card 1 compare: fetch series when selectedBars changes
  useEffect(() => {
    if (!compareMode || selectedBars.size === 0) {
      setCompareLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setCompareLoading(true);
      const res = await fetchCompareSeries(Array.from(selectedBars), TAB_DRILL_KEY[activeTab], fiscalYearLabel);
      if (!cancelled) { setCompareSeriesMap(res); setCompareLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [compareMode, selectedBars, fiscalYearLabel, activeTab]);

  // ── Card 2 compare: fetch series when zoneSelectedBars changes (always on)
  useEffect(() => {
    if (!zoneTab || zoneSelectedBars.size === 0) {
      setZoneCompareLoading(false);
      return;
    }
    let cancelled = false;
    // build parent filter (same as what fetchZoneData uses)
    const parentFilter: Record<string, string> = {};
    if (selectedBar)   parentFilter[TAB_DRILL_KEY[activeTab]] = selectedBar;
    if (currentFilter) parentFilter[TAB_DRILL_KEY[activeTab]] = currentFilter;
    (async () => {
      setZoneCompareLoading(true);
      const res = await fetchCompareSeries(
        Array.from(zoneSelectedBars), TAB_DRILL_KEY[zoneTab], fiscalYearLabel, parentFilter,
      );
      if (!cancelled) { setZoneCompareSeriesMap(res); setZoneCompareLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [zoneSelectedBars, fiscalYearLabel, zoneTab, selectedBar, currentFilter, activeTab]);

  // ── data fetches
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { setChartData(await fetchAndMap(fiscalYearLabel, TAB_GROUP_BY[activeTab], TAB_DRILL_KEY[activeTab], fmExtra)); }
    catch { setError("Failed to load data."); setChartData([]); }
    finally { setLoading(false); }
  }, [fiscalYearLabel, activeTab, JSON.stringify(fmExtra)]);

  const fetchMonthData = useCallback(async () => {
    setMonthLoading(true); setMonthError(null);
    try {
      const extra: Record<string, string> = { ...fmExtra };
      if (selectedBar) extra[TAB_DRILL_KEY[activeTab]] = selectedBar;
      setMonthData(sortMonths(await fetchAndMap(fiscalYearLabel, ["month_name","FISCALYEAR"], "month_name", extra, ["['month_name', 'asc']"])));
    } catch { setMonthError("Failed to load data."); setMonthData([]); }
    finally { setMonthLoading(false); }
  }, [fiscalYearLabel, selectedBar, activeTab, JSON.stringify(fmExtra)]);

  const fetchZoneData = useCallback(async () => {
    if (!zoneTab) { setZoneData([]); return; }
    setZoneLoading(true); setZoneError(null);
    try {
      const extra: Record<string, string> = { ...fmExtra };
      if (selectedBar)   extra[TAB_DRILL_KEY[activeTab]] = selectedBar;
      if (currentFilter) extra[TAB_DRILL_KEY[activeTab]] = currentFilter;
      setZoneData(await fetchAndMap(fiscalYearLabel, TAB_GROUP_BY[zoneTab], TAB_DRILL_KEY[zoneTab], extra));
    } catch { setZoneError("Failed to load data."); setZoneData([]); }
    finally { setZoneLoading(false); }
  }, [fiscalYearLabel, zoneTab, selectedBar, activeTab, currentFilter, JSON.stringify(fmExtra)]);

  const fetchZoneMonthData = useCallback(async () => {
    if (!zoneTab) { setZoneMonthData([]); return; }
    setZoneMonthLoading(true); setZoneMonthError(null);
    try {
      const extra: Record<string, string> = { ...fmExtra };
      if (selectedBar)   extra[TAB_DRILL_KEY[activeTab]] = selectedBar;
      if (currentFilter) extra[TAB_DRILL_KEY[activeTab]] = currentFilter;
      setZoneMonthData(sortMonths(await fetchAndMap(fiscalYearLabel, ["month_name","FISCALYEAR"], "month_name", extra, ["['month_name', 'asc']"])));
    } catch { setZoneMonthError("Failed to load data."); setZoneMonthData([]); }
    finally { setZoneMonthLoading(false); }
  }, [fiscalYearLabel, zoneTab, selectedBar, activeTab, currentFilter, JSON.stringify(fmExtra)]);

  // Fetch daily data for a specific month drill-down
  const fetchDailyData = useCallback(async (monthName: string) => {
    setMonthLoading(true); setMonthError(null);
    try {
      const extra: Record<string, string | string[]> = { ...fmExtra };
      if (selectedBar) extra[TAB_DRILL_KEY[activeTab]] = selectedBar;
      extra["month_name"] = [monthName];
      
      const payload = {
        table: "MOM_DAY_LEVEL_DATA",
        filters: { FISCALYEAR: [fiscalYearLabel], ...extra },
        date_column: null, date_from: null, date_to: null,
        aggregations: ["['Total', 'sum', 'NETWEIGHT_TMT']"],
        detail_fields: [],
        order_by: ["['DAY_ID', 'asc']"],
        limit: 0, skip: 0,
        group_by: ["month_name", "DAY_ID", "FISCALYEAR"],
      };
      const response = await apiClient.post("/api/tableanalytics/generate_data_aggregations", payload);
      const rows: any[] = Array.isArray(response.data?.data) ? response.data.data
        : Array.isArray(response.data) ? response.data : [];
      setDailyData(mapDailyApiRows(rows));
    } catch { setMonthError("Failed to load daily data."); setDailyData([]); }
    finally { setMonthLoading(false); }
  }, [fiscalYearLabel, selectedBar, activeTab, JSON.stringify(fmExtra)]);

  // Fetch daily data for zone chart
  const fetchZoneDailyData = useCallback(async (monthName: string) => {
    if (!zoneTab) return;
    setZoneMonthLoading(true); setZoneMonthError(null);
    try {
      const extra: Record<string, string | string[]> = { ...fmExtra };
      if (selectedBar)   extra[TAB_DRILL_KEY[activeTab]] = selectedBar;
      if (currentFilter) extra[TAB_DRILL_KEY[activeTab]] = currentFilter;
      extra["month_name"] = [monthName];
      
      const payload = {
        table: "MOM_DAY_LEVEL_DATA",
        filters: { FISCALYEAR: [fiscalYearLabel], ...extra },
        date_column: null, date_from: null, date_to: null,
        aggregations: ["['Total', 'sum', 'NETWEIGHT_TMT']"],
        detail_fields: [],
        order_by: ["['DAY_ID', 'asc']"],
        limit: 0, skip: 0,
        group_by: ["month_name", "DAY_ID", "FISCALYEAR"],
      };
      const response = await apiClient.post("/api/tableanalytics/generate_data_aggregations", payload);
      const rows: any[] = Array.isArray(response.data?.data) ? response.data.data
        : Array.isArray(response.data) ? response.data : [];
      setZoneDailyData(mapDailyApiRows(rows));
    } catch { setZoneMonthError("Failed to load daily data."); setZoneDailyData([]); }
    finally { setZoneMonthLoading(false); }
  }, [fiscalYearLabel, zoneTab, selectedBar, activeTab, currentFilter, JSON.stringify(fmExtra)]);

  // Fetch daily data for Card 1 compare mode
  const fetchCompareDailyData = useCallback(async (monthName: string, selectedNames: string[]) => {
    setCompareLoading(true);
    try {
      const dailySeries = await fetchDailySeriesMap(
        monthName,
        selectedNames,
        TAB_DRILL_KEY[activeTab],
        fiscalYearLabel,
        { ...fmExtra },
      );
      setCompareDailySeriesMap(dailySeries);
    } catch {
      setCompareDailySeriesMap({});
    } finally {
      setCompareLoading(false);
    }
  }, [fiscalYearLabel, activeTab, JSON.stringify(fmExtra)]);

  // Fetch daily data for Zone-wise Breakdown compare (multiple zone/region/etc. bars)
  const fetchZoneCompareDailyData = useCallback(async (monthName: string, selectedNames: string[]) => {
    if (!zoneTab) return;
    setZoneCompareLoading(true);
    try {
      const baseExtra: Record<string, string | string[]> = { ...fmExtra };
      if (selectedBar) baseExtra[TAB_DRILL_KEY[activeTab]] = selectedBar;
      if (currentFilter) baseExtra[TAB_DRILL_KEY[activeTab]] = currentFilter;
      const dailySeries = await fetchDailySeriesMap(
        monthName,
        selectedNames,
        TAB_DRILL_KEY[zoneTab],
        fiscalYearLabel,
        baseExtra,
      );
      setZoneCompareDailySeriesMap(dailySeries);
    } catch {
      setZoneCompareDailySeriesMap({});
    } finally {
      setZoneCompareLoading(false);
    }
  }, [fiscalYearLabel, zoneTab, selectedBar, activeTab, currentFilter, JSON.stringify(fmExtra)]);

  useEffect(() => { fetchData(); },          [fetchData]);
  useEffect(() => { fetchMonthData(); },     [fetchMonthData]);
  useEffect(() => { fetchZoneData(); },      [fetchZoneData]);
  useEffect(() => { fetchZoneMonthData(); }, [fetchZoneMonthData]);

  // ── Re-fetch daily data when filters change while in drilled view
  useEffect(() => {
    if (drilledMonth) {
      fetchDailyData(drilledMonth);
    }
  }, [drilledMonth, fetchDailyData]);

  useEffect(() => {
    if (!zoneDrilledMonth) return;
    if (zoneSelectedBars.size > 0) {
      fetchZoneCompareDailyData(zoneDrilledMonth, Array.from(zoneSelectedBars));
    } else {
      fetchZoneDailyData(zoneDrilledMonth);
    }
  }, [zoneDrilledMonth, zoneSelectedBars, fetchZoneDailyData, fetchZoneCompareDailyData]);

  useEffect(() => {
    if (compareDrilledMonth && selectedBars.size > 0) {
      fetchCompareDailyData(compareDrilledMonth, Array.from(selectedBars));
    }
  }, [compareDrilledMonth, selectedBars, fetchCompareDailyData]);

  // ── bar click: Card 1
  const handleBarClick = (name: string) => {
    if (compareMode) {
      setSelectedBars((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
    } else {
      setSelectedBar((prev) => (prev === name ? null : name));
    }
  };

  // ── bar click: Card 2 (always compare mode)
  const handleZoneBarClick = (name: string) => {
    setZoneSelectedBars((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };

  // ── month point click: drill down to daily view
  const handleMonthPointClick = (monthName: string) => {
    setDrilledMonth(monthName);
    fetchDailyData(monthName);
  };

  // ── back to monthly view
  const handleBackToMonthly = () => {
    setDrilledMonth(null);
    setDailyData([]);
  };

  // ── zone month point click: drill down to daily view
  const handleZoneMonthPointClick = (monthName: string) => {
    setZoneDrilledMonth(monthName);
    if (zoneSelectedBars.size > 0) {
      setZoneCompareDailySeriesMap({});
      fetchZoneCompareDailyData(monthName, Array.from(zoneSelectedBars));
    } else {
      fetchZoneDailyData(monthName);
    }
  };

  // ── back to zone monthly view
  const handleZoneBackToMonthly = () => {
    setZoneDrilledMonth(null);
    setZoneDailyData([]);
    setZoneCompareDailySeriesMap({});
  };

  // ── compare mode point click: drill down to daily view
  const handleComparePointClick = (monthName: string) => {
    if (selectedBars.size > 0) {
      setCompareDailySeriesMap({});
      setCompareDrilledMonth(monthName);
      fetchCompareDailyData(monthName, Array.from(selectedBars));
    }
  };

  // ── back to compare monthly view
  const handleCompareBackToMonthly = () => {
    setCompareDrilledMonth(null);
    setCompareDailySeriesMap({});
  };

  const pillClasses       = "bg-blue-50 text-blue-700 border-blue-200";
  const filterPillClasses = "bg-indigo-50 text-indigo-700 border-indigo-200";

  const primaryChartTitle = `${activeTab}-wise${compareMode ? " · Compare" : card2Tabs.length > 0 ? " · click to drill down" : ""}`;
  const secondaryChartTitle = compareMode
    ? (compareDrilledMonth ? `Day-wise · ${compareDrilledMonth}` : "Monthly comparison")
    : (drilledMonth ? `Day-wise · ${drilledMonth}` : `Month-wise${selectedBar ? ` · ${selectedBar}` : ""}`);

  const renderPrimaryChart = (chartHeight: number, idSuffix = "", fillContainer = false) => (
    <ChartBody
      chartData={chartData}
      loading={loading}
      error={error}
      selectedBar={!compareMode ? selectedBar : undefined}
      selectedBars={compareMode ? selectedBars : undefined}
      onBarClick={handleBarClick}
      compareMode={compareMode}
      chartId={`sales-detail-card1${idSuffix}`}
      height={chartHeight}
      fillContainer={fillContainer}
    />
  );

  const renderSecondaryChart = (chartHeight: number, fillContainer = false) =>
    compareMode ? (
      <CompareLineChart
        seriesMap={compareDrilledMonth ? compareDailySeriesMap : compareSeriesMap}
        loading={selectedBars.size > 0 ? compareLoading : monthLoading}
        selectedNames={Array.from(selectedBars)}
        defaultData={monthData}
        onComparePointClick={compareDrilledMonth ? undefined : handleComparePointClick}
        isDrillDown={!!compareDrilledMonth}
        height={chartHeight}
        fillContainer={fillContainer}
      />
    ) : (
      <MonthLineChart
        chartData={drilledMonth ? dailyData : monthData}
        loading={monthLoading}
        error={monthError}
        onPointClick={drilledMonth ? undefined : handleMonthPointClick}
        isDrillDown={!!drilledMonth}
        drilledMonth={drilledMonth}
        height={chartHeight}
        fillContainer={fillContainer}
      />
    );

  const zonePrimaryChartTitle = zoneTab ? `${zoneTab}-wise · click to compare` : "Zone-wise · click to compare";
  const zoneSecondaryChartTitle = zoneDrilledMonth
    ? `Day-wise · ${zoneDrilledMonth}`
    : "Monthly comparison";

  const renderZonePrimaryChart = (chartHeight: number, idSuffix = "", fillContainer = false) => (
    <ChartBody
      chartData={zoneData}
      loading={zoneLoading}
      error={zoneError}
      barColor="#6366f1"
      selectedBars={zoneSelectedBars}
      onBarClick={handleZoneBarClick}
      compareMode={true}
      chartId={`sales-detail-card2${idSuffix}`}
      height={chartHeight}
      fillContainer={fillContainer}
    />
  );

  const renderZoneSecondaryChart = (chartHeight: number, fillContainer = false) => (
    <CompareLineChart
      seriesMap={
        zoneDrilledMonth && zoneSelectedBars.size > 0
          ? zoneCompareDailySeriesMap
          : zoneCompareSeriesMap
      }
      loading={zoneCompareLoading || zoneMonthLoading}
      selectedNames={Array.from(zoneSelectedBars)}
      defaultData={
        zoneDrilledMonth && zoneSelectedBars.size === 0
          ? zoneDailyData
          : zoneMonthData
      }
      onDefaultPointClick={
        zoneDrilledMonth || zoneSelectedBars.size > 0 ? undefined : handleZoneMonthPointClick
      }
      onComparePointClick={zoneDrilledMonth ? undefined : handleZoneMonthPointClick}
      isDrillDown={!!zoneDrilledMonth}
      height={chartHeight}
      fillContainer={fillContainer}
    />
  );

  return (
    <div className="flex flex-col gap-0">

      {/* ══ Card 1: Sales Detail ══════════════════════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100">
                <BarChart2 className="h-4 w-4 text-blue-600" />
              </span>
              <span className="text-sm font-bold text-gray-800 whitespace-nowrap">Sales Detail</span>
              <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{fiscalYearLabel}</span>
            </div>

            {!compareMode && selectedBar && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${pillClasses}`}>
                {selectedBar}
                <button onClick={() => setSelectedBar(null)} className="ml-0.5 hover:text-blue-900"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {compareMode && Array.from(selectedBars).map((name, i) => (
              <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold"
                style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + "18", color: COMPARE_COLORS[i % COMPARE_COLORS.length], borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + "55" }}>
                {name}
                <button onClick={() => setSelectedBars((p) => { const n = new Set(p); n.delete(name); return n; })} className="ml-0.5 opacity-70 hover:opacity-100"><X className="h-2.5 w-2.5" /></button>
              </span>
            ))}
            {currentFilter && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${filterPillClasses}`}>
                {activeTab}: {currentFilter}
                <button onClick={() => setCurrentFilter(null)} className="ml-0.5 hover:text-indigo-900"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!compareMode && (
              <ZoneWiseFilterMenu
                selectedSBU={fmSBU}
                selectedZone={fmZone}
                selectedRegion={fmRegion}
                selectedSalesArea={fmSalesArea}
                selectedProductName={fmProduct}
                sbuOptions={fmSbuOptions}
                zoneOptions={fmZoneOptions}
                regionOptions={fmRegionOptions}
                salesAreaOptions={fmSalesAreaOptions}
                productOptions={fmProductOptions}
                handleSBUChange={handleFmSBUChange}
                handleZoneChange={handleFmZoneChange}
                handleRegionChange={handleFmRegionChange}
                handleSalesAreaChange={handleFmSalesAreaChange}
                handleProductNameChange={handleFmProductChange}
                hideSbu={!!sbu}
              />
            )}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
              {TABS.map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    activeTab === tab ? "bg-white text-blue-600 shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700"
                  }`}>{tab}</button>
              ))}
            </div>
            <CompareBtn active={compareMode} count={selectedBars.size} onClick={() => { resetFilters(); setCompareMode((m) => !m); }} />
            <button onClick={() => { resetFilters(); setCompareMode(false); setActiveTab(TABS[0]); fetchData(); fetchMonthData(); }} disabled={loading || monthLoading}
              className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm" title="Refresh & Reset Filters">
              <RotateCcw className={`h-3.5 w-3.5 text-gray-500 ${(loading || monthLoading) ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 pb-3">
          <div className="grid grid-cols-2 gap-4 items-stretch">
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <SectionLabel icon={<BarChart2 className="h-3 w-3" />}
                  label={primaryChartTitle}
                  accent={compareMode ? "bg-violet-50 text-violet-500" : "bg-blue-50 text-blue-400"}
                  className="mb-0" />
                <ChartMaximizeButton onClick={() => setExpandedChartPanel("primary")} title="Fullscreen chart" />
              </div>
              <div className="flex-1">
                {renderPrimaryChart(INLINE_CHART_HEIGHT)}
              </div>
            </div>
            <div className="border-l border-dashed border-gray-200 pl-4 flex flex-col">
              {compareMode ? (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <SectionLabel icon={<TrendingUp className="h-3 w-3" />}
                      label={secondaryChartTitle}
                      accent="bg-violet-50 text-violet-500"
                      className="mb-0" />
                    <div className="flex items-center gap-1 shrink-0">
                      {compareDrilledMonth && (
                        <button
                          onClick={handleCompareBackToMonthly}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 rounded transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Back to Monthly
                        </button>
                      )}
                      <ChartMaximizeButton onClick={() => setExpandedChartPanel("secondary")} title="Fullscreen chart" />
                    </div>
                  </div>
                  <div>{renderSecondaryChart(INLINE_CHART_HEIGHT)}</div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <SectionLabel icon={<TrendingUp className="h-3 w-3" />}
                      label={secondaryChartTitle}
                      accent="bg-emerald-50 text-emerald-500"
                      className="mb-0" />
                    <div className="flex items-center gap-1 shrink-0">
                      {drilledMonth && (
                        <button
                          onClick={handleBackToMonthly}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Back to Monthly
                        </button>
                      )}
                      <ChartMaximizeButton onClick={() => setExpandedChartPanel("secondary")} title="Fullscreen chart" />
                    </div>
                  </div>
                  <div>{renderSecondaryChart(INLINE_CHART_HEIGHT)}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Connector + Card 2 — hidden in compare mode ─────────────────────── */}
      {!compareMode && card2Tabs.length > 0 && (
        <>
          <div className="flex items-stretch gap-0 pl-8">
            <div className="flex flex-col items-center w-8">
              <div className="w-px flex-1 bg-blue-200" />
              <div className="w-2 h-2 rounded-full bg-blue-400 my-0.5 shrink-0" />
              <div className="w-px flex-1 bg-blue-200" />
                </div>
            <div className="flex items-center py-1">
              <span className="text-[10px] text-blue-400 font-semibold tracking-wide ml-1">
                {selectedBar ? `Filtered by: ${selectedBar}` : currentFilter ? `Filtered by: ${currentFilter}` : "Drill-down"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden ml-8">
            <div className="flex">
              <div className="w-1 shrink-0 bg-gradient-to-b from-blue-400 to-blue-200 rounded-l-xl" />
              <div className="flex-1 min-w-0">
                {/* Card 2 Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3 border-b border-blue-50 bg-gradient-to-r from-blue-50/60 to-white">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100">
                        <GitBranch className="h-4 w-4 text-blue-500" />
                      </span>
                      <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                        {zoneTab ? `${zoneTab}-wise` : ""} Breakdown
                      </span>
                    </div>
                    {selectedBar && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${pillClasses}`}>
                        {TAB_DRILL_KEY[activeTab]}: {selectedBar}
                        <button onClick={() => setSelectedBar(null)} className="ml-0.5 hover:text-blue-900"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    )}
                    {currentFilter && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${filterPillClasses}`}>
                        {activeTab}: {currentFilter}
                        <button onClick={() => setCurrentFilter(null)} className="ml-0.5 hover:text-indigo-900"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    )}
                    {/* Card 2 compare pills — always shown when bars selected */}
                    {Array.from(zoneSelectedBars).map((name, i) => (
                      <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold"
                        style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + "18", color: COMPARE_COLORS[i % COMPARE_COLORS.length], borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + "55" }}>
                        {name}
                        <button onClick={() => setZoneSelectedBars((p) => { const n = new Set(p); n.delete(name); return n; })} className="ml-0.5 opacity-70 hover:opacity-100"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    ))}
            </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                      {card2Tabs.map((tab) => (
                        <button key={tab} type="button" onClick={() => setOverrideZoneTab(tab)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                            zoneTab === tab ? "bg-white text-blue-600 shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700"
                          }`}>{tab}</button>
                      ))}
                    </div>
                    <button onClick={() => { setZoneSelectedBars(new Set()); setOverrideZoneTab(card2Tabs[0] ?? null); fetchZoneData(); fetchZoneMonthData(); }} disabled={zoneLoading || zoneMonthLoading}
                      className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm" title="Refresh & Reset Filters">
                      <RotateCcw className={`h-3.5 w-3.5 text-gray-500 ${(zoneLoading || zoneMonthLoading) ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Card 2 Body */}
                <div className="px-4 pt-3 pb-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <SectionLabel icon={<BarChart2 className="h-3 w-3" />}
                          label={zonePrimaryChartTitle}
                          accent="bg-blue-50 text-blue-400"
                          className="mb-0" />
                        <ChartMaximizeButton
                          onClick={() => setExpandedChartPanel("zonePrimary")}
                          title="Fullscreen chart"
                        />
                      </div>
                      {renderZonePrimaryChart(INLINE_CHART_HEIGHT)}
                    </div>
                    <div className="border-l border-dashed border-gray-200 pl-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <SectionLabel icon={<TrendingUp className="h-3 w-3" />}
                          label={zoneSecondaryChartTitle}
                          accent="bg-violet-50 text-violet-500"
                          className="mb-0" />
                        <div className="flex items-center gap-1 shrink-0">
                          {zoneDrilledMonth && (
                            <button
                              onClick={handleZoneBackToMonthly}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 rounded transition-colors"
                            >
                              <RotateCcw className="h-3 w-3" /> Back to Monthly
                            </button>
                          )}
                          <ChartMaximizeButton
                            onClick={() => setExpandedChartPanel("zoneSecondary")}
                            title="Fullscreen chart"
                          />
                        </div>
                      </div>
                      <div>{renderZoneSecondaryChart(INLINE_CHART_HEIGHT)}</div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </>
        )}

      <ChartFullscreenModal
        open={expandedChartPanel === "primary"}
        onClose={() => setExpandedChartPanel(null)}
        title={primaryChartTitle}
      >
        {renderPrimaryChart(INLINE_CHART_HEIGHT, "-fullscreen", true)}
      </ChartFullscreenModal>

      <ChartFullscreenModal
        open={expandedChartPanel === "secondary"}
        onClose={() => setExpandedChartPanel(null)}
        title={secondaryChartTitle}
        onBackToMonthly={
          compareMode
            ? compareDrilledMonth
              ? handleCompareBackToMonthly
              : undefined
            : drilledMonth
              ? handleBackToMonthly
              : undefined
        }
        backButtonVariant={compareMode ? "violet" : "emerald"}
      >
        {renderSecondaryChart(INLINE_CHART_HEIGHT, true)}
      </ChartFullscreenModal>

      <ChartFullscreenModal
        open={expandedChartPanel === "zonePrimary"}
        onClose={() => setExpandedChartPanel(null)}
        title={zonePrimaryChartTitle}
      >
        {renderZonePrimaryChart(INLINE_CHART_HEIGHT, "-zone-fs", true)}
      </ChartFullscreenModal>

      <ChartFullscreenModal
        open={expandedChartPanel === "zoneSecondary"}
        onClose={() => setExpandedChartPanel(null)}
        title={zoneSecondaryChartTitle}
        onBackToMonthly={zoneDrilledMonth ? handleZoneBackToMonthly : undefined}
        backButtonVariant="violet"
      >
        {renderZoneSecondaryChart(INLINE_CHART_HEIGHT, true)}
      </ChartFullscreenModal>
    </div>
  );
};

export default SalesDetail;
