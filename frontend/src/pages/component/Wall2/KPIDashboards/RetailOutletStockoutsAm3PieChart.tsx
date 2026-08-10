import React, { useEffect, useRef } from "react";

export type RetailStockoutsPieSlice = {
  title: string;
  value: number;
  color: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AmChartsGlobal = any;

function ensureAmChartsReady(AmCharts: AmChartsGlobal): void {
  if (AmCharts.isReady) return;
  if (typeof AmCharts.handleLoad === "function") {
    AmCharts.handleLoad();
  }
}

const RetailOutletStockoutsAm3PieChart: React.FC<{ data: RetailStockoutsPieSlice[] }> = ({ data }) => {
  const chartRef = useRef<AmChartsGlobal | null>(null);
  const containerIdRef = useRef(`ro-stockouts-pie3d-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    let cancelled = false;
    let onResize: (() => void) | null = null;
    let resizeTimer: number | undefined;

    const init = async () => {
      await import("amcharts/dist/amcharts/amcharts.js");
      await import("amcharts/dist/amcharts/pie.js");
      await import("amcharts/dist/amcharts/themes/light.js");

      if (cancelled) return;

      const AmCharts = (window as unknown as { AmCharts: AmChartsGlobal }).AmCharts;
      if (!AmCharts?.makeChart) return;

      ensureAmChartsReady(AmCharts);

      const el = document.getElementById(containerIdRef.current);
      if (!el || data.length === 0) return;

      requestAnimationFrame(() => {
        if (cancelled) return;

        const chart = AmCharts.makeChart(containerIdRef.current, {
          type: "pie",
          theme: "light",
          addCodeCredits: false,
          startDuration: 0.6,

          dataProvider: data.map((d) => ({
            title: d.title,
            value: d.value,
            color: d.color,
          })),

          titleField: "title",
          valueField: "value",
          colorField: "color",

          depth3D: 18,
          angle: 32,

          outlineColor: "#ffffff",
          outlineAlpha: 0.75,
          outlineThickness: 2,

          // ✅ ONLY % on pie labels
          labelText: "[[percents]]%",
          labelRadius: 8,

          // ✅ Tooltip still shows full info
          balloonText: "<b>[[title]]</b><br>[[value]] ([[percents]]%)",

          // ✅ Vertical + centered legend
          legend: {
            position: "bottom",
            align: "center",
            maxColumns: 1,
            equalWidths: false,
            valueWidth: 0,
            markerSize: 10,
            spacing: 6,
            autoMargins: false,
            marginBottom: 20,
          },
        });

        chart.brr = () => {};
        const cr = chart as { amLink?: { parentNode?: { removeChild: (n: unknown) => void } } };
        if (cr.amLink?.parentNode) cr.amLink.parentNode.removeChild(cr.amLink);

        chartRef.current = chart;

        onResize = () => {
          if (chart?.validateSize) chart.validateSize();
        };

        onResize();
        window.addEventListener("resize", onResize);
        resizeTimer = window.setTimeout(onResize, 150);
      });
    };

    void init();

    return () => {
      cancelled = true;
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
      className="h-full min-h-[280px] w-full rounded-lg bg-white"
      style={{ width: "100%", height: "100%", position: "relative" }}
    />
  );
};

export default RetailOutletStockoutsAm3PieChart;