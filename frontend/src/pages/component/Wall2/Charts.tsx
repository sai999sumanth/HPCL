import React, { useState, useEffect, useRef } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";
import { Card, CardContent, CardHeader, CardTitle } from "../../../@/components/ui/card";



const PerformancePieChart = () => {
  const chartRef = useRef(null);
  const rootRef = useRef(null);
  
  const data = [
    { name: 'CS Rejection', value: 5.18, color: '#7CB5EC' },
    { name: 'GD Rejection', value: 5.06, color: '#4572A7' },
    { name: 'PT Rejection', value: 89.76, color: '#8085E9' }
  ].sort((a, b) => b.value - a.value);

  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    // Only create root if it doesn't exist
    if (!rootRef.current) {
      rootRef.current = am5.Root.new(chartRef.current);
    }

    const root = rootRef.current;

    // Set themes
    root.setThemes([am5themes_Dark.new(root)]);

    // Create chart
    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        innerRadius: am5.percent(55)
      })
    );

    // Create series
    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "value",
        categoryField: "name",
        startAngle: 90,
        endAngle: -270,
        radius: am5.percent(75)
      })
    );

    // Hide labels and ticks
    series.labels.template.set("visible", false);
    series.ticks.template.set("visible", false);

    // Set data
    series.data.setAll(data);

    // Set colors
    series.slices.template.setAll({
      strokeWidth: 3,
      stroke: am5.color("#1a1a2e"),
      templateField: "sliceSettings"
    });

    data.forEach((item, index) => {
      series.data.setIndex(index, {
        ...item,
        sliceSettings: {
          fill: am5.color(item.color)
        }
      });
    });

    // Clean up function
    return () => {
      // Only dispose of the root when component is unmounted
      if (root) {
        root.dispose();
        rootRef.current = null;
      }
    };
  }, []); // Empty dependency array as we want this to run only once

  // Simplified LegendItem without text or value display
  const LegendItem = ({ entry, index }) => (
    <div
      className={`flex items-center gap-1 p-1 rounded transition-all duration-300 cursor-pointer 
        ${activeIndex === index ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'}`}
      onMouseEnter={() => setActiveIndex(index)}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <div
        className="min-w-[12px] h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: entry.color }}
      />
      <div className="flex flex-col flex-shrink min-w-0">
        <span className="text-white text-sm truncate">
          {entry.name}
        </span>
        <span className="text-white text-sm font-bold">
          {`${entry.value}%`}
        </span>
      </div>
    </div>
  );

  return (
    <Card className="w-full bg-[#1a1a2e] border-0">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white">
          Performance Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-80">
          <div className="lg:col-span-2 relative">
            <div ref={chartRef} style={{ width: "100%", height: "100%" }}></div>
          </div>
          
          <div className="flex flex-col justify-center gap-2 p-4 bg-gray-900/20 rounded-lg">
            {data.map((entry, index) => (
              <LegendItem key={index} entry={entry} index={index} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformancePieChart;