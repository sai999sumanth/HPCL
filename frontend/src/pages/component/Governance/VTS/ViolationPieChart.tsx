import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

// 1. Updated Interface: Now matches the new data structure.
interface ViolationData {
  violation: string;
  percentage: number;
  count: number;
}

interface ViolationPieChartProps {
  data: ViolationData[];
}

// Matte color palette
const MATTE_COLORS = [
  "#c52429", // Red
  "#e67e22", // Orange
  "#15a396", // Teal
  "#4aaf49", // Green
  "#2a449b", // Blue
  "#9b2476", // Magenta/Purple
  "#ef5785"
];

const ViolationPieChart: React.FC<ViolationPieChartProps> = ({ data }) => { 

  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const seriesRef = useRef<am5percent.PieSeries | null>(null);

  useEffect(() => { 
    if (!chartRef.current || !data || data.length === 0) return;
    let root: am5.Root;
    if (!rootRef.current) { 
      root = am5.Root.new(chartRef.current);
      rootRef.current = root;
      if (root._logo) root._logo.dispose();
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
          // NOTE: We still use 'count' as the value field. This is best practice.
          // The library will calculate percentages from the raw counts,
          // ensuring the chart always sums to 100%.
          valueField: 'count',
          categoryField: 'violation',
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

      series.slices.template.adapters.add("radius", function(radius, target) {
        const dataItem = target.dataItem;
        const high = series.getPrivate("valueHigh");

        if (dataItem) {
          const dataContext = dataItem?.dataContext as ViolationData | undefined;
          const value = dataContext?.count || 0;
          const minRadius = 0.6;
          const radiusFactor = minRadius + (1 - minRadius) * (value / (high || 1));
          return radius * radiusFactor;
        }
        return radius;
      });
      
      series.labels.template.setAll({ 
        textType: "regular",
        centerX: 0,
        centerY: 0,
        fontSize:8,
        fontWeight: "700",
        fill: am5.color("#374151"),
        text: "{category}\n{valuePercentTotal.formatNumber('#.##')}%",
        oversizedBehavior: "wrap",
        maxWidth: 100,
        textAlign: "center",
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 0,
        paddingRight: 0
      });

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

    if (seriesRef.current) {
      seriesRef.current.slices.template.adapters.add("fill", (fill, target) => {
        const dataItem = target.dataItem as am5.DataItem<am5percent.IPieSeriesDataItem>;
        if (dataItem) {
          const index = seriesRef.current?.dataItems.indexOf(dataItem) ?? -1;
          return am5.color(MATTE_COLORS[index % MATTE_COLORS.length]);
        }
        return fill;
      });

      seriesRef.current.data.setAll(data);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [data]);

  return (
    <div
      ref={chartRef}
      className="w-full h-72"
      style={{ minHeight: '288px' }}
    />
  );
};

// Example parent component to demonstrate usage with the new data.
const ViolationDashboard = () => {
  const violationBreakupData = [
    { violation: 'Route Deviation', percentage: 20.5, count: 255 },
    { violation: 'Power Disconnection', percentage: 18.2, count: 227 },
    { violation: 'Device Tampering', percentage: 15.8, count: 197 },
    { violation: 'Stoppage Violation', percentage: 13.3, count: 166 },
    { violation: 'Night Driving Violation', percentage: 11.7, count: 146 },
    { violation: 'Continuous Driving Violation', percentage: 10.1, count: 126 },
    { violation: 'Speed Violation', percentage: 10.4, count: 130 }
  ];

  return (
    <div>
      <h2>Violation Breakup</h2>
      <ViolationPieChart data={violationBreakupData} />
    </div>
  );
};

export default ViolationPieChart;