import React, { useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5radar from "@amcharts/amcharts5/radar";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

interface OperabilityData {
  metric: string;
  value: number;
  color: string;
}

interface IrisGaugeChartProps {
  width?: string;
  height?: string;
  data?: OperabilityData[];
}

const defaultOperabilityData: OperabilityData[] = [
  { metric: "RDI", value: 75, color: "#9575cd" },
  { metric: "RO", value: 90, color: "#ff4081" },
  { metric: "LPG", value: 99, color: "#4dd0e1" },
  { metric: "RT", value: 99, color: "#4fc3f7" },
];

const IrisGaugeChart: React.FC<IrisGaugeChartProps> = ({
  width = "100%",
  height = "300px",
  data = defaultOperabilityData,
}) => {
  useLayoutEffect(() => {
    // Create root element
    const root = am5.Root.new("irisChartDiv");

    // Apply theme
    root.setThemes([am5themes_Animated.new(root)]);

    // Create radar chart
    const chart = root.container.children.push(
      am5radar.RadarChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        innerRadius: am5.percent(40),
      })
    );

    // Add cursor
    const cursor = chart.set(
      "cursor",
      am5radar.RadarCursor.new(root, {
        behavior: "zoomX",
      })
    );
    cursor.lineY.set("visible", false);

    // Create axes
    const xRenderer = am5radar.AxisRendererCircular.new(root, {});
    xRenderer.labels.template.setAll({
      radius: 10,
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "metric",
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5radar.AxisRendererRadial.new(root, {}),
        min: 0,
        max: 100,
        strictMinMax: true,
      })
    );

    // Create series
    const series = chart.series.push(
      am5radar.RadarColumnSeries.new(root, {
        name: "Operability",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "metric",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueY}%",
        }),
      })
    );

    series.columns.template.setAll({
      cornerRadius: 5,
      fillOpacity: 0.8,
      strokeWidth: 1,
      strokeOpacity: 0.5,
    });

    // Set data
    xAxis.data.setAll(data);
    series.data.setAll(data);

    // Add central label
    chart.radarContainer.children.push(
      am5.Label.new(root, {
        centerX: am5.p50,
        centerY: am5.p50,
        text: "IRIS",
        fontSize: 24,
        fill: am5.color("white"),
      })
    );

    // Animate chart
    series.appear(1000);
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [data]);

  return <div id="irisChartDiv" style={{ width, height }} />;
};

export default IrisGaugeChart;
