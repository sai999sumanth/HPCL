import React, { useEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";


const MATTE_COLORS = [
  "#c52429", // Red
  "#e67e22", // Orange
  "#15a396", // Teal
  "#4aaf49", // Green
  "#2a449b", // Blue
  "#9b2476", // Magenta/Purple
  "#ef5785"  // Pink
];

const ViolationPieChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const seriesRef = useRef<am5percent.PieSeries | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    let root: am5.Root;

    if (!rootRef.current) {
      root = am5.Root.new(chartRef.current);
      rootRef.current = root;

      if (root._logo) root._logo.dispose(); // Remove amCharts watermark
      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.verticalLayout,
          radius: am5.percent(80)
        })
      );

      const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          alignLabels: true,
          calculateAggregates: true,
          valueField: "violation_count",
          categoryField: "violation_type",
          innerRadius: am5.percent(20)
        })
      );

      seriesRef.current = series;

     
      series.slices.template.setAll({
        tooltipText: "{category}: {valuePercentTotal.formatNumber('#.##')}% ({value} alerts)",
        stroke: am5.color(0xffffff),
        strokeWidth: 3,
        cornerRadius: 4
      });

      
      series.slices.template.adapters.add("radius", function (radius, target) {
        const dataItem = target.dataItem;
        const high = series.getPrivate("valueHigh");
        if (dataItem) {
          const value = (dataItem.dataContext as any)?.violation_count || 0;
          const minRadius = 0.6;
          const radiusFactor = minRadius + (1 - minRadius) * (value / (high || 1));
          return radius * radiusFactor;
        }
        return radius;
      });

      // Labels
      series.labels.template.setAll({
        textType: "regular",
        centerX: 0,
        centerY: 0,
        fontSize: 10,
        fontWeight: "700",
        fill: am5.color("#374151"),
        text: "{category}\n{valuePercentTotal.formatNumber('#.##')}%",
        oversizedBehavior: "wrap",
        maxWidth: 100,
        textAlign: "center",
        paddingTop: 10,
        paddingBottom: 10
      });

      // Ticks
      series.ticks.template.setAll({
        strokeOpacity: 0.8,
        stroke: am5.color("#666666"),
        strokeWidth: 1,
        visible: true,
        length: 15
      });

      series.labelsContainer.set("paddingTop", 20);

      series.appear(1000, 100);
      chart.appear(1000, 100);
    } else {
      root = rootRef.current;
    }

    // Matte colors
    if (seriesRef.current) {
      seriesRef.current.slices.template.adapters.add("fill", (fill, target) => {
        const dataItem = target.dataItem as am5.DataItem<am5percent.IPieSeriesDataItem>;
        if (dataItem) {
          const index = seriesRef.current?.dataItems.indexOf(dataItem) ?? -1;
          return am5.color(MATTE_COLORS[index % MATTE_COLORS.length]);
        }
        return fill;
      });

      
      seriesRef.current.data.setAll([
          { violation_type: "Route Deviation", violation_count: 36794 },
      { violation_type: "Stoppage Violations", violation_count: 20660 },
      { violation_type: "Night Driving", violation_count: 7574 },
      { violation_type: "Main Supply Removal", violation_count: 5809 },
      { violation_type: "Device Tamper", violation_count: 3883 },
      { violation_type: "Speed Violation", violation_count: 736 },
      { violation_type: "Continuous Driving", violation_count: 314 },
      { violation_type: "Device Offline", violation_count: 1 }
     ]);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">
        Violation Distribution
      </h4>
      <div
        ref={chartRef}
        className="w-full h-96"
        style={{ minHeight: "400px" }}
      />
    </div>
  );
};

export default ViolationPieChart;