import React, { useEffect, useRef } from "react";
import {
  KPI_AM3_ZONE_BAR_3D,
  KPI_AM3_ZONE_BAR_GLASS_FILL_ALPHA,
  KPI_AM3_ZONE_BAR_SCROLLBAR,
  styleKpiAm3ZoneScrollbar,
  wireAm3LegendCompanionGraphs,
} from "@/lib/kpiAm3Bar3D";

/** Row shape from `RetailOutletStockoutsDashboard` bar chart data */
export type RetailStockoutsBarRow = {
  zone: string;
  withoutPct: number;
  partialPct: number;
  fullPct: number;
  withoutCount: number;
  partialCount: number;
  fullCount: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AmChartsGlobal = any;

function ensureAmChartsReady(AmCharts: AmChartsGlobal): void {
  if (AmCharts.isReady) return;
  if (typeof AmCharts.handleLoad === "function") AmCharts.handleLoad();
}

/** Zone bars visible in the viewport before horizontal scrollbar panning is used. */
const BARS_VISIBLE = 7;

const OUTSIDE_BAR_LABEL_DX = 5;

function nudgeSvgTranslateX(transformAttr: string | null, dx: number): string | null {
  if (!transformAttr) return null;
  const m = transformAttr.match(/translate\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
  if (!m) return null;
  return transformAttr.replace(m[0], `translate(${parseFloat(m[1]) + dx},${m[2]})`);
}

/** amCharts 3 value-axis `boldLabels` is not always applied to SVG ticks — reinforce on draw. */
function applyBoldYAxisLabels(chart: AmChartsGlobal): void {
  const axes = chart.valueAxes as Array<{ labelsSet?: { node?: Element & ParentNode }; titleLabel?: { node?: Element } }> | undefined;
  if (!Array.isArray(axes)) return;
  axes.forEach((axis) => {
    const labelRoot = axis.labelsSet?.node;
    labelRoot?.querySelectorAll?.("text").forEach((t) => {
      t.setAttribute("font-weight", "700");
    });
    const titleNode = axis.titleLabel?.node;
    if (titleNode?.tagName === "text") {
      titleNode.setAttribute("font-weight", "700");
    }
  });
}

function applyBoldBarValueLabels(chart: AmChartsGlobal): void {
  const graphs = chart.graphs as Array<{ bulletSet?: { node?: Element & ParentNode } }> | undefined;
  if (!Array.isArray(graphs)) return;
  graphs.forEach((g, graphIndex) => {
    const root = g.bulletSet?.node;
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("text").forEach((t: SVGTextElement) => {
      t.setAttribute("font-weight", "700");
      if (graphIndex === 3) {
        const next = nudgeSvgTranslateX(t.getAttribute("transform"), OUTSIDE_BAR_LABEL_DX);
        if (next) t.setAttribute("transform", next);
      }
    });
  });
}

const BAR_SERIES = {
  cyan: { fill: "#9FDEF1", legendColor: "#9FDEF1" },
  lime: { fill: "#B9E52F", legendColor: "#B9E52F" },
  teal: { fill: "#2A5D78", legendColor: "#2A5D78" },
} as const;

const GLASS_FILL_ALPHA = KPI_AM3_ZONE_BAR_GLASS_FILL_ALPHA;
const LABEL_ON_GLASS = "#1e293b";

function labelTextHideZero(item: { values?: { value?: number } }, formatted: string): string {
  const v = item?.values?.value;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "";
  return formatted;
}

function balloonFullDryouts(
  item: {
    values?: { value?: number };
    dataContext?: Record<string, unknown>;
    serialDataItem?: { dataContext?: Record<string, unknown> };
  },
  useTopSegment: boolean
): string {
  const v = item?.values?.value;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "";
  const ctx = item.dataContext ?? item.serialDataItem?.dataContext ?? {};
  const zone = String(ctx.zone ?? ctx.category ?? "");
  return `<b>with full dryouts</b><br>Zone: ${zone}<br>ROs: ${ctx.fullCount}<br>Segment: ${useTopSegment ? ctx.fullPctTop : ctx.fullPctInside}%<br>Total: ${ctx.fullPct}%`;
}

function buildMakeChartConfig(data: RetailStockoutsBarRow[]) {
  const needsScroll = data.length > BARS_VISIBLE;

  const dataProvider = data.map((r) => ({
    zone: r.zone,
    withoutPct: r.withoutPct,
    partialPct: r.partialPct,
    fullPct: r.fullPct,
    fullPctInside: r.fullPct > 10 ? r.fullPct : 0,
    fullPctTop: r.fullPct > 0 && r.fullPct <= 10 ? r.fullPct : 0,
    withoutCount: r.withoutCount,
    partialCount: r.partialCount,
    fullCount: r.fullCount,
  }));

  return {
    type: "serial" as const,
    theme: "light",
    addCodeCredits: false,
    marginTop: 28,
    marginLeft: needsScroll ? 68 : 20,
    marginRight: 20,
    marginBottom: needsScroll ? 46 : 20,
    autoMargins: true,
    autoMarginOffset: needsScroll ? 4 : 10,
    /** Hide amCharts default "Show all" zoom-out control when scrolled. */
    zoomOutText: "",
    startDuration: 1.1,
    startEffect: "easeOutSine",
    sequencedAnimation: false,
    depth3D: KPI_AM3_ZONE_BAR_3D.depth3D,
    angle: KPI_AM3_ZONE_BAR_3D.angle,
    columnWidth: KPI_AM3_ZONE_BAR_3D.columnWidth,
    columnSpacing: KPI_AM3_ZONE_BAR_3D.columnSpacing,
    plotAreaFillAlphas: 0,
    categoryField: "zone",
    dataProvider,
    numberFormatter: { precision: 1, decimalSeparator: ".", thousandsSeparator: "," },
    valueAxes: [
      {
        stackType: "regular",
        position: "left",
        minimum: 0,
        maximum: 100,
        unit: "%",
        title: "% of ROs",
        titleBold: true,
        boldLabels: true,
        fontSize: 10,
        color: "#475569",
        axisColor: "#475569",
        labelsEnabled: true,
        showFirstLabel: true,
        showLastLabel: true,
        gridAlpha: 0,
        axisAlpha: 0.45,
        axisThickness: 1,
        inside: false,
      },
    ],
    graphs: [
      {
        title: "without dryouts",
        valueField: "withoutPct",
        type: "column",
        lineAlpha: 0,
        fillAlphas: GLASS_FILL_ALPHA,
        lineColor: BAR_SERIES.cyan.fill,
        legendColor: BAR_SERIES.cyan.legendColor,
        balloonText:
          "<b>without dryouts</b><br>Zone: [[category]]<br>ROs: [[withoutCount]]<br>Share: [[withoutPct]]%",
        showAllValueLabels: true,
        labelText: "[[value]]%",
        labelFunction: labelTextHideZero,
        labelPosition: "middle",
        color: LABEL_ON_GLASS,
        labelColor: LABEL_ON_GLASS,
        labelRotation: -90,
        fontSize: 11,
      },
      {
        title: "with partial dryouts",
        valueField: "partialPct",
        type: "column",
        lineAlpha: 0,
        fillAlphas: GLASS_FILL_ALPHA,
        lineColor: BAR_SERIES.lime.fill,
        legendColor: BAR_SERIES.lime.legendColor,
        balloonText:
          "<b>with partial dryouts</b><br>Zone: [[category]]<br>ROs: [[partialCount]]<br>Share: [[partialPct]]%",
        showAllValueLabels: true,
        labelText: "[[value]]%",
        labelFunction: labelTextHideZero,
        labelPosition: "middle",
        color: LABEL_ON_GLASS,
        labelColor: LABEL_ON_GLASS,
        labelRotation: -90,
        fontSize: 11,
      },
      {
        title: "with full dryouts",
        valueField: "fullPctInside",
        type: "column",
        lineAlpha: 0,
        fillAlphas: GLASS_FILL_ALPHA,
        lineColor: BAR_SERIES.teal.fill,
        legendColor: BAR_SERIES.teal.legendColor,
        balloonFunction: (item: { values?: { value?: number }; dataContext?: Record<string, unknown> }) =>
          balloonFullDryouts(item, false),
        showAllValueLabels: true,
        labelText: "[[value]]%",
        labelFunction: labelTextHideZero,
        labelPosition: "middle",
        color: "#ffffff",
        labelColor: "#ffffff",
        labelRotation: -90,
        fontSize: 11,
      },
      {
        title: "__fullDryoutsTopLabel",
        valueField: "fullPctTop",
        type: "column",
        lineAlpha: 0,
        fillAlphas: GLASS_FILL_ALPHA,
        lineColor: BAR_SERIES.teal.fill,
        legendColor: BAR_SERIES.teal.legendColor,
        visibleInLegend: false,
        switchable: true,
        balloonFunction: (item: { values?: { value?: number }; dataContext?: Record<string, unknown> }) =>
          balloonFullDryouts(item, true),
        showAllValueLabels: true,
        labelText: "[[value]]%",
        labelFunction: labelTextHideZero,
        labelPosition: "top",
        labelOffset: 12,
        color: LABEL_ON_GLASS,
        labelColor: LABEL_ON_GLASS,
        labelRotation: 0,
        fontSize: 11,
      },
    ],
    categoryAxis: {
      gridPosition: "start",
      labelRotation: 0,
      gridAlpha: 0,
      axisAlpha: 0.85,
      boldLabels: true,
      tickLength: 0,
      autoWrap: false,
      fontSize: 10,
      ...(needsScroll ? { marginBottom: 6 } : {}),
    },
    ...(needsScroll
      ? {
          chartScrollbar: { ...KPI_AM3_ZONE_BAR_SCROLLBAR },
          mouseWheelScrollEnabled: true,
        }
      : {}),
    chartCursor: {
      categoryBalloonEnabled: false,
      cursorAlpha: 0.12,
      zoomable: false,
    },
    legend: {
      position: "bottom",
      align: "center",
      horizontalGap: 12,
      spacing: 8,
      markerSize: 12,
      marginTop: needsScroll ? 8 : 0,
      switchable: true,
    },
  };
}

const RetailOutletStockoutsAm3BarChart: React.FC<{ data: RetailStockoutsBarRow[] }> = ({ data }) => {
  const chartRef = useRef<AmChartsGlobal | null>(null);
  const containerIdRef = useRef(`ro-stockouts-am3-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    let cancelled = false;
    let onResize: (() => void) | null = null;
    let resizeTimer: number | undefined;
    let containerResizeObserver: ResizeObserver | null = null;

    const init = async () => {
      await import("amcharts/dist/amcharts/amcharts.js");
      await import("amcharts/dist/amcharts/serial.js");
      await import("amcharts/dist/amcharts/themes/light.js");

      if (cancelled) return;

      const AmCharts = (window as unknown as { AmCharts: AmChartsGlobal }).AmCharts;
      if (!AmCharts?.makeChart) return;

      ensureAmChartsReady(AmCharts);

      const el = document.getElementById(containerIdRef.current);
      if (!el || data.length === 0) return;

      requestAnimationFrame(() => {
        if (cancelled) return;

        const chart = AmCharts.makeChart(containerIdRef.current, buildMakeChartConfig(data));

        chart.brr = () => {};
        const link = chart.amLink as { parentNode?: { removeChild: (n: unknown) => void } } | undefined;
        if (link?.parentNode) link.parentNode.removeChild(link);

        wireAm3LegendCompanionGraphs(chart, {
          "with full dryouts": ["__fullDryoutsTopLabel"],
        });
        let initialZoomApplied = false;
        let yAxisMarginFixed = false;

        const paintScrollbar = () => {
          if (data.length <= BARS_VISIBLE) return;
          requestAnimationFrame(() => styleKpiAm3ZoneScrollbar(el, chart));
        };

        const ensureYAxisMargin = () => {
          if (yAxisMarginFixed || data.length <= BARS_VISIBLE) return;
          const currentLeft = Number(chart.marginLeftReal ?? chart.marginLeft ?? 0);
          if (currentLeft >= 64) {
            yAxisMarginFixed = true;
            return;
          }
          chart.marginLeft = 68;
          chart.marginsUpdated = false;
          yAxisMarginFixed = true;
          chart.validateSize();
        };

        /** amCharts 3 `start`/`end` are category indices (integers), not 0–1 fractions. */
        const applyInitialZoom = () => {
          if (initialZoomApplied || data.length <= BARS_VISIBLE) return;
          const chartData = chart.chartData as unknown[] | undefined;
          if (!Array.isArray(chartData) || chartData.length === 0) return;
          if (typeof chart.zoomToIndexes !== "function") return;
          chart.zoomToIndexes(0, BARS_VISIBLE - 1);
          initialZoomApplied = true;
        };

        chart.addListener("dataUpdated", () => {
          applyInitialZoom();
          paintScrollbar();
        });
        chart.addListener("init", applyInitialZoom);
        const hideZoomOutButton = () => {
          if (chart.zbSet?.hide) chart.zbSet.hide();
        };

        chart.addListener("drawn", () => {
          ensureYAxisMargin();
          applyInitialZoom();
          applyBoldYAxisLabels(chart);
          applyBoldBarValueLabels(chart);
          hideZoomOutButton();
          paintScrollbar();
        });

        chart.addListener("zoomed", () => {
          hideZoomOutButton();
          paintScrollbar();
        });

        applyBoldYAxisLabels(chart);
        applyBoldBarValueLabels(chart);
        chartRef.current = chart;

        window.setTimeout(applyInitialZoom, 0);
        window.setTimeout(applyInitialZoom, 120);
        window.setTimeout(paintScrollbar, 0);
        window.setTimeout(paintScrollbar, 120);
        window.setTimeout(paintScrollbar, 300);

        onResize = () => {
          if (chart?.validateSize) chart.validateSize();
          applyBoldYAxisLabels(chart);
          applyBoldBarValueLabels(chart);
        };
        onResize();
        window.addEventListener("resize", onResize);
        resizeTimer = window.setTimeout(onResize, 150);

        if (typeof ResizeObserver !== "undefined") {
          containerResizeObserver = new ResizeObserver(() => {
            if (cancelled) return;
            requestAnimationFrame(() => {
              if (!cancelled) onResize?.();
            });
          });
          containerResizeObserver.observe(el);
        }
      });
    };

    void init();

    return () => {
      cancelled = true;
      if (containerResizeObserver) {
        containerResizeObserver.disconnect();
        containerResizeObserver = null;
      }
      if (onResize) window.removeEventListener("resize", onResize);
      if (resizeTimer != null) window.clearTimeout(resizeTimer);
      const ch = chartRef.current;
      chartRef.current = null;
      if (ch && typeof ch.clear === "function") {
        try {
          ch.clear();
        } catch {
          /* ignore */
        }
      }
    };
  }, [data]);

  return (
    <div
      id={containerIdRef.current}
      className="h-full min-h-[300px] w-full overflow-visible rounded-lg bg-white pt-0 pl-1"
      style={{ width: "100%", height: "100%", position: "relative", marginTop: 0, paddingTop: 0 }}
    />
  );
};

export default RetailOutletStockoutsAm3BarChart;
