import React, { useEffect, useRef } from "react";

/** One category (day) for stacked CS / GD / PT rejections. */
export type LpgRejectionsDailyChartRow = {
  dayLabel: string;
  cs: number;
  gd: number;
  pt: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AmChartsGlobal = any;

function ensureAmChartsReady(AmCharts: AmChartsGlobal): void {
  if (AmCharts.isReady) return;
  if (typeof AmCharts.handleLoad === "function") {
    AmCharts.handleLoad();
  }
}

function applyBoldBarValueLabels(chart: AmChartsGlobal): void {
  const graphs = chart.graphs as Array<{ bulletSet?: { node?: Element & ParentNode } }> | undefined;
  if (!Array.isArray(graphs)) return;
  for (const g of graphs) {
    const root = g.bulletSet?.node;
    if (!root?.querySelectorAll) continue;
    root.querySelectorAll("text").forEach((t) => {
      t.setAttribute("font-weight", "700");
    });
  }
}

/** 0x5e74e9, 0x5b3474, 0xd94769 — CS, GD, PT */
const SERIES = {
  cs: { fill: "#5E74E9", legendColor: "#5E74E9" },
  gd: { fill: "#5B3474", legendColor: "#5B3474" },
  pt: { fill: "#D94769", legendColor: "#D94769" },
} as const;

function labelTextHideZero(item: { values?: { value?: number } }, formatted: string): string {
  const v = item?.values?.value;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "";
  return formatted;
}

function buildConfig(data: LpgRejectionsDailyChartRow[]) {
  const dataProvider = data.map((r) => ({
    dayLabel: r.dayLabel,
    cs: r.cs,
    gd: r.gd,
    pt: r.pt,
  }));

  /** X-axis labels vertical (90°) for readability with many dates. */
  const labelRotation = 90;

  return {
    type: "serial" as const,
    theme: "light",
    addCodeCredits: false,
    /** Match table / UI copy (`text-xs` ≈ 12px; chart uses slightly smaller for density). */
    fontSize: 10,
    color: "#374151",
    balloon: {
      fillColor: "#ffffff",
      fillAlpha: 0.98,
      borderColor: "#d1d5db",
      borderThickness: 1,
      borderAlpha: 1,
      color: "#1f2937",
      fontSize: 11,
      horizontalPadding: 10,
      verticalPadding: 8,
      cornerRadius: 4,
      shadowAlpha: 0.12,
    },
    startDuration: 0.8,
    startEffect: "easeOutSine",
    sequencedAnimation: false,
    depth3D: 18,
    angle: 28,
    columnWidth: 0.72,
    columnSpacing: 12,
    plotAreaFillAlphas: 0,
    categoryField: "dayLabel",
    dataProvider,
    /** Room for vertical category labels + legend. */
    autoMargins: true,
    marginLeft: 16,
    marginRight: 16,
    marginTop: 16,
    marginBottom: 120,
    numberFormatter: {
      precision: 1,
      decimalSeparator: ".",
      thousandsSeparator: ",",
    },
    valueAxes: [
      {
        stackType: "regular",
        position: "left",
        minimum: 0,
        title: "Rejections",
        titleFontSize: 11,
        fontSize: 10,
        gridAlpha: 0,
        axisAlpha: 0.45,
        axisThickness: 1,
      },
    ],
    graphs: [
      {
        title: "Type CS",
        valueField: "cs",
        type: "column",
        lineAlpha: 0,
        fillAlphas: 1,
        lineColor: SERIES.cs.fill,
        legendColor: SERIES.cs.legendColor,
        balloonText:
          "<b>Type CS</b><br><span style='opacity:0.9'>[[category]]</span><br>Rejections: <b>[[value]]</b>",
        showBalloon: true,
        showAllValueLabels: true,
        labelText: "[[value]]",
        labelFunction: labelTextHideZero,
        labelPosition: "middle",
        color: "#ffffff",
        labelColor: "#ffffff",
        labelRotation: -90,
        fontSize: 9,
        cornerRadiusTop: 0,
      },
      {
        title: "Type GD",
        valueField: "gd",
        type: "column",
        lineAlpha: 0,
        fillAlphas: 1,
        lineColor: SERIES.gd.fill,
        legendColor: SERIES.gd.legendColor,
        balloonText:
          "<b>Type GD</b><br><span style='opacity:0.9'>[[category]]</span><br>Rejections: <b>[[value]]</b>",
        showBalloon: true,
        showAllValueLabels: true,
        labelText: "[[value]]",
        labelFunction: labelTextHideZero,
        labelPosition: "middle",
        color: "#ffffff",
        labelColor: "#ffffff",
        labelRotation: -90,
        fontSize: 9,
        cornerRadiusTop: 0,
      },
      {
        title: "Type PT",
        valueField: "pt",
        type: "column",
        lineAlpha: 0,
        fillAlphas: 1,
        lineColor: SERIES.pt.fill,
        legendColor: SERIES.pt.legendColor,
        balloonText:
          "<b>Type PT</b><br><span style='opacity:0.9'>[[category]]</span><br>Rejections: <b>[[value]]</b>",
        showBalloon: true,
        showAllValueLabels: true,
        labelText: "[[value]]",
        labelFunction: labelTextHideZero,
        labelPosition: "middle",
        color: "#ffffff",
        labelColor: "#ffffff",
        labelRotation: -90,
        fontSize: 9,
        /** Rounded top only on the visible stack cap (PT). */
        cornerRadiusTop: 6,
      },
    ],
    categoryAxis: {
      gridPosition: "start",
      labelRotation,
      fontSize: 10,
      color: "#4b5563",
      gridAlpha: 0,
      axisAlpha: 0.85,
      boldLabels: true,
      tickLength: 0,
      /** Vertical labels: avoid clipping. */
      autoWrap: false,
      labelOffset: 4,
    },
    chartCursor: {
      categoryBalloonEnabled: true,
      categoryBalloonAlpha: 0.92,
      categoryBalloonColor: "#ffffff",
      cursorAlpha: 0.12,
      zoomable: false,
      valueBalloonsEnabled: true,
      oneBalloonOnly: false,
      /** `fullWidth: true` pins balloons to chart edges — use false so tooltips track columns. */
      fullWidth: false,
    },
    legend: {
      position: "bottom",
      align: "center",
      horizontalGap: 12,
      spacing: 8,
      markerSize: 12,
      fontSize: 10,
      color: "#4b5563",
    },
  };
}

const LpgRejectionsDailyAm3BarChart: React.FC<{ data: LpgRejectionsDailyChartRow[] }> = ({ data }) => {
  const chartRef = useRef<AmChartsGlobal | null>(null);
  const containerIdRef = useRef(`lpg-rej-daily-am3-${Math.random().toString(36).slice(2, 11)}`);

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
        const cfg = buildConfig(data);
        const chart = AmCharts.makeChart(containerIdRef.current, cfg);
        chart.brr = () => {};
        const link = chart.amLink as { parentNode?: { removeChild: (n: unknown) => void } } | undefined;
        if (link?.parentNode) link.parentNode.removeChild(link);
        chart.addListener("drawn", () => {
          applyBoldBarValueLabels(chart);
        });
        applyBoldBarValueLabels(chart);
        chartRef.current = chart;
        onResize = () => {
          if (chart?.validateSize) chart.validateSize();
          applyBoldBarValueLabels(chart);
        };
        onResize();
        window.addEventListener("resize", onResize);
        resizeTimer = window.setTimeout(onResize, 150);

        if (typeof ResizeObserver !== "undefined") {
          containerResizeObserver = new ResizeObserver(() => {
            if (cancelled) return;
            requestAnimationFrame(() => {
              if (cancelled) return;
              onResize?.();
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
      className="h-full min-h-[560px] w-full"
      style={{ width: "100%", height: "100%", minHeight: 560, position: "relative" }}
    />
  );
};

export default LpgRejectionsDailyAm3BarChart;
