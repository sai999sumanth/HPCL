import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface TrendsData {
  [key: string]: string | number;
}

interface ViolationTrendsChartProps { 
  data: TrendsData[];
  timeGrain: string;
  violationNames: string[];
  violationKeys: string[];
  colors: string[];
}

// Matte color palette (same as pie chart)

const MATTE_COLORS = [
  "#c52429", // Red
  "#e67e22", // Orange
  "#15a396", // Teal
  "#4aaf49", // Green
  "#2a449b", // Blue
  "#9b2476", // Magenta/Purple
  "#ef5785",
  "#8e44ad", // Purple
];

const ViolationTrendsChart: React.FC<ViolationTrendsChartProps> = ({  
  data, 
  timeGrain, 
  violationNames, 
  violationKeys, 
  colors 
}) => { 
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {  
    if (!chartRef.current || !data || data.length === 0) return;
    const root = am5.Root.new(chartRef.current);
    if (root._logo) root._logo.dispose();

    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push( 
      am5xy.XYChart.new(root, { 
        panX: true,
        panY: true,
        wheelX: 'panX',
        wheelY: 'zoomX',
        paddingLeft: 15,
        paddingRight: 15,
        paddingTop: 15,
        paddingBottom: 5,
      })
    );

    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { behavior: "none" }));
    cursor.lineY.set('visible', false);

    const xAxis = chart.xAxes.push( 
      am5xy.DateAxis.new(root, {
        maxDeviation: 0.2,
        baseInterval: { timeUnit: timeGrain === 'daywise' ? 'day' : 'month', count: 1 },
        renderer: am5xy.AxisRendererX.new(root, { 
          minGridDistance: 40,
          strokeOpacity: 0.3,
          strokeWidth: 1
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    // Configure X-axis labels
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fontWeight: "500",
      fill: am5.color("#666666"),
      paddingTop: 8,
      paddingBottom: 4
    });

    // Configure X-axis grid
    xAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.15,
      stroke: am5.color("#e5e7eb")
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { 
          strokeOpacity: 0.3,
          strokeWidth: 1,
          inside: false
        }),
      })
    );

    // Configure Y-axis labels
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fontWeight: "500",
      fill: am5.color("#666666"),
      paddingRight: 8,
      paddingLeft: 4
    });

    // Configure Y-axis grid
    yAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.15,
      stroke: am5.color("#e5e7eb")
    });

    // Function to create a series with matte colors
    const createSeries = (name: string, field: string, color: string) => {
      const series = chart.series.push(  
        am5xy.LineSeries.new(root, { 
          name: name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: field,
          valueXField: 'timestamp',
          stroke: am5.color(color),
          tooltip: am5.Tooltip.new(root, {
            labelText: `{name}: {valueY}`,
            getFillFromSprite: false,
            autoTextColor: false
          })
        })
      );
      
      // Remove area fill for cleaner line chart
      series.fills.template.setAll({ fillOpacity: 0, visible: false });
      
      // Set line properties
      series.strokes.template.setAll({ 
        strokeWidth: 2,
        strokeOpacity: 0.8
      });
      
      // Set tooltip styling with matte colors
      series.get("tooltip")?.setAll({ 
        background: am5.RoundedRectangle.new(root, { 
          fill: am5.color(color),
          fillOpacity: 0.9,
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
          cornerRadiusBL: 4,
          cornerRadiusBR: 4
        }),
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 6,
        paddingRight: 6
      });
      
      series.get("tooltip")?.label.setAll({ 
        fill: am5.color("#ffffff"),
        fontWeight: "500",
        fontSize: 10,
        maxWidth: 120
      });
      
      // Create bullets (data points) with matte colors
      series.bullets.push(() => am5.Bullet.new(root, { 
        sprite: am5.Circle.new(root, { 
          radius: 3,
          fill: am5.color(color),
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 2,
          strokeOpacity: 1
        }),
      }));
      
      return series;
    };
    
    // Create series for each violation type using matte colors
    violationKeys.forEach((key, index) => {
      const matteColor = MATTE_COLORS[index % MATTE_COLORS.length];
      createSeries(violationNames[index], key, matteColor);
    });

    // Prepare chart data with timestamps
    const chartData = data.map(item => {
      const timestamp = timeGrain === 'daywise'
        ? new Date(item.date as string).getTime()
        : new Date(item.month as string).getTime();
      return { ...item, timestamp };
    });

    // Set data
    xAxis.data.setAll(chartData);
    chart.series.each(series => series.data.setAll(chartData));

    // Add normal am5 Scrollbar (simple variant without chart preview)
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      height: 12
    });
    chart.set("scrollbarX", scrollbarX);
    // Customize normal scrollbar appearance
    scrollbarX.get("background").setAll({
      fill: am5.color("#e5e7eb"),
      fillOpacity: 0.8
    });

    scrollbarX.thumb.setAll({
      fill: am5.color("#6b7280"),
      fillOpacity: 0.7
    });

    // Customize grips
    scrollbarX.startGrip.setAll({
      scale: 0.8
    });

    scrollbarX.endGrip.setAll({
      scale: 0.8
    });

    // Position scrollbar at bottom
    chart.bottomAxesContainer.children.push(scrollbarX);

    // Add stock am5 Legend below scrollbar
    const legend = chart.bottomAxesContainer.children.push(am5.Legend.new(root, {
      centerX: am5.percent(50),
      x: am5.percent(50),
      layout: root.horizontalLayout,
      marginTop: 0
    }));

    // Reduce font size to fit 7 items in single row
    legend.labels.template.setAll({
      fontSize: 7.5,
      fontWeight: "700"
    });

    // Set legend data to series for automatic hide/unhide functionality
    legend.data.setAll(chart.series.values);

    // Set initial scroll position to 35% after chart loads
    setTimeout(() => {
      scrollbarX.set("start", 0);
      scrollbarX.set("end", 0.35);
    }, 100);

    // Animate chart appearance
    chart.appear(1000, 100);

    return () => root.dispose();
  }, [data, timeGrain, violationKeys, violationNames, colors]);

  return (
    <div
      ref={chartRef}
      className="w-full h-72"
      style={{ minHeight: '288px' }}
    />
  );
  
};

export default ViolationTrendsChart;