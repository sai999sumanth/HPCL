import React, { useLayoutEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5map from "@amcharts/amcharts5/map";
import am5geodata_indiaLow from "@amcharts/amcharts5-geodata/indiaLow";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { NaturalGasDashboardShell } from "./NaturalGasDashboardShell";

const START = am5.color(0x8ab7ff);
const END = am5.color(0x25529a);
const HOVER_STROKE = am5.color(0x677935);

type IndiaFeature = GeoJSON.Feature & { id?: string };

/** Map polygon `id` → numeric value (placeholder until API supplies state-level metrics). */
function buildHeatMapData(geo: GeoJSON.FeatureCollection): { id: string; value: number }[] {
  const out: { id: string; value: number }[] = [];
  for (const f of geo.features) {
    const feat = f as IndiaFeature;
    const id = String(feat.id ?? (feat.properties as { id?: string } | undefined)?.id ?? "").trim();
    if (!id) continue;
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const value = Math.round(Math.abs(h % 10001));
    out.push({ id, value });
  }
  return out;
}

/**
 * Choropleth map based on the amCharts 5 “map + heat rules + heat legend” pattern
 * (see https://www.amcharts.com/docs/v5/charts/map-chart/ ).
 * Uses bundled India low geodata — replace `buildHeatMapData` with API-driven values when ready.
 */
export const DistributionMapPage: React.FC = () => {
  const divRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const root = am5.Root.new(el);
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        panX: "translateX",
        panY: "translateY",
        pinchZoom: true,
        projection: am5map.geoMercator(),
      })
    );

    chart.set(
      "zoomControl",
      am5map.ZoomControl.new(root, {
        x: am5.p100,
        centerX: am5.p100,
        y: am5.p0,
        centerY: am5.p0,
        paddingRight: 8,
        paddingTop: 8,
      })
    );

    chart.set("homeZoomLevel", 1);
    chart.set("homeGeoPoint", { longitude: 81.9629, latitude: 22.5937 });

    const polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_indiaLow,
        valueField: "value",
      })
    );

    polygonSeries.mapPolygons.template.setAll({
      tooltipText: "[bold]{name}[/]\n{value.formatNumber('#,###')}",
      interactive: true,
    });

    polygonSeries.mapPolygons.template.states.create("hover", {
      stroke: HOVER_STROKE,
      strokeWidth: 2,
    });

    polygonSeries.set("heatRules", [
      {
        target: polygonSeries.mapPolygons.template,
        dataField: "value",
        min: START,
        max: END,
        key: "fill",
      },
    ]);

    const heatData = buildHeatMapData(am5geodata_indiaLow as GeoJSON.FeatureCollection);
    polygonSeries.data.setAll(heatData);

    const heatLegend = chart.children.push(
      am5.HeatLegend.new(root, {
        orientation: "vertical",
        startColor: START,
        endColor: END,
        startText: "Lowest",
        endText: "Highest",
        stepCount: 5,
        y: am5.p100,
        centerY: am5.p100,
        x: am5.p100,
        centerX: am5.p100,
        paddingRight: 12,
        paddingBottom: 56,
      })
    );

    heatLegend.startLabel.setAll({
      fontSize: 12,
      fill: heatLegend.get("startColor"),
      fontWeight: "600",
    });
    heatLegend.endLabel.setAll({
      fontSize: 12,
      fill: heatLegend.get("endColor"),
      fontWeight: "600",
    });

    const vals = heatData.map((d) => d.value);
    const low = vals.length ? Math.min(...vals) : 0;
    const high = vals.length ? Math.max(...vals) : 1;
    heatLegend.set("startValue", low);
    heatLegend.set("endValue", high || 1);

    polygonSeries.mapPolygons.template.events.on("pointerover", (ev) => {
      const ctx = ev.target.dataItem?.dataContext as { value?: number } | undefined;
      const v = ctx?.value;
      if (v != null && Number.isFinite(v)) {
        heatLegend.showValue(v);
      }
    });

    chart.children.push(
      am5.Label.new(root, {
        x: 8,
        y: 8,
        text: "India — distribution (sample values per state/UT)",
        fontSize: 13,
        fontWeight: "600",
        fill: am5.color(0x1e293b),
        background: am5.RoundedRectangle.new(root, {
          fill: am5.color(0xffffff),
          fillOpacity: 0.88,
        }),
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 10,
        paddingRight: 10,
      })
    );

    const ro = new ResizeObserver(() => {
      root.resize();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      root.dispose();
    };
  }, []);

  return (
    <NaturalGasDashboardShell>
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_16px_-6px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.04]">
        <div className="border-b border-slate-200/80 px-3 py-2">
          <h3 className="text-[13px] font-semibold tracking-tight text-[#1a2b4b]">Distribution map</h3>
          <p className="text-[10px] text-slate-500">
            State/UT choropleth (amCharts 5 heat rules + legend). Values are placeholders until wired to your
            aggregation.
          </p>
        </div>
        <div ref={divRef} className="h-[min(720px,82vh)] w-full min-w-0" />
      </div>
    </NaturalGasDashboardShell>
  );
};
