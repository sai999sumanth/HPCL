import React, { useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5radar from '@amcharts/amcharts5/radar';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface ChartData {
  category: string;
  value: number;
  full: number;
  columnSettings?: {
    fill: am5.Color;
  };
}

interface RadarGaugeChartProps {
  data?: ChartData[];
  width?: string;
  height?: string;
  title?: string;
}

const defaultData: ChartData[] = [
  {
    category: "RCD",
    value: 75,
    full: 100,
    columnSettings: {
      fill: am5.color(0xB76EE8)
    }
  },
  {
    category: "Retail",
    value: 90,
    full: 100,
    columnSettings: {
      fill: am5.color(0xE86E9A)
    }
  },
  {
    category: "LPG",
    value: 99,
    full: 100,
    columnSettings: {
      fill: am5.color(0x6EE8D3)
    }
  },
  {
    category: "SOD",
    value: 99,
    full: 100,
    columnSettings: {
      fill: am5.color(0x6E95E8)
    }
  }
];

const SolidGaugeChart: React.FC<RadarGaugeChartProps> = ({
  width = '500px',
  height = '300px',
  title,
  data = defaultData
}) => {
  const chartRef = useRef<am5.Root | null>(null);
  const chartDivId = useRef(`chartdiv-${Math.random().toString(36).substr(2, 9)}`);

  useLayoutEffect(() => {
    if (chartRef.current) {
      chartRef.current.dispose();
    }

    const root = am5.Root.new(chartDivId.current);
    chartRef.current = root;

    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    const chart = root.container.children.push(
      am5radar.RadarChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        startAngle: 180,
        endAngle: 360,
        innerRadius: am5.percent(50),
        layout: root.verticalLayout,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0
      })
    );

    // Create axes
    const xRenderer = am5radar.AxisRendererCircular.new(root, {
      minGridDistance: 30
    });
    xRenderer.labels.template.setAll({
      visible: false
    });
    xRenderer.grid.template.setAll({
      visible: false
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: xRenderer,
        min: 0,
        max: 100,
        strictMinMax: true
      })
    );

    const yRenderer = am5radar.AxisRendererRadial.new(root, {
      minGridDistance: 20
    });
    yRenderer.labels.template.setAll({
      visible: false
    });
    yRenderer.grid.template.setAll({
      visible: false
    });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: yRenderer
      })
    );

    yAxis.data.setAll(data);

    // Create series
    const series = chart.series.push(
      am5radar.RadarColumnSeries.new(root, {
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "value",
        categoryYField: "category",
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    // Style columns
    series.columns.template.setAll({
      width: am5.percent(70),
      tooltipText: "{categoryY}: {valueX}%",
      templateField: "columnSettings"
    });

    series.data.setAll(data);

    // Add labels
    data.forEach((item, index) => {
      const angle = 180 + (180 / (data.length + 1)) * (index + 1);
      const radius = 120;
      const x = radius * Math.cos((angle * Math.PI) / 180);
      const y = radius * Math.sin((angle * Math.PI) / 180);

      chart.radarContainer.children.push(
        am5.Label.new(root, {
          text: `${item.value}% ${item.category}`,
          fontSize: "0.9em",
          x: x,
          y: y,
          centerX: x > 0 ? am5.percent(0) : am5.percent(100),
          centerY: am5.percent(50),
          fill: am5.color(0xFFFFFF)
        })
      );
    });

    // Add center label
    chart.radarContainer.children.push(
      am5.Label.new(root, {
        text: "IRIS",
        fontSize: 24,
        fontWeight: "500",
        centerX: am5.percent(50),
        centerY: am5.percent(50),
        fill: am5.color(0xFFFFFF)
      })
    );

    // Add title if provided
    if (title) {
      chart.children.push(
        am5.Label.new(root, {
          text: title,
          fontSize: 16,
          fontWeight: "500",
          textAlign: "center",
          x: am5.percent(50),
          y: 0,
          centerX: am5.percent(50),
          paddingTop: 0,
          fill: am5.color(0xFFFFFF)
        })
      );
    }

    series.appear(1000);
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [data, title]);

  return (
    <div 
      id={chartDivId.current}
      style={{ 
        width, 
        height,
        margin: '0 auto'
      }} 
    />
  );
};

export default SolidGaugeChart;