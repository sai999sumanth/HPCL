
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { useEffect, useRef } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"

const data = [
  {
    region: "PUNE",
    sales: { cy: 409.1, ly: 385.0, growth: 6.3 },
    marketShareOMC: { cy: 39.29, ly: 38.37, gl: 0.92 },
    marketShareIndustry: { cy: 37.19, ly: 36.72, gl: 0.47 },
  },
  {
    region: "BANGALORE",
    sales: { cy: 404.5, ly: 398.1, growth: 1.6 },
    marketShareOMC: { cy: 22.04, ly: 21.5, gl: 0.54 },
    marketShareIndustry: { cy: 18.66, ly: 18.92, gl: -0.26 },
  },
  {
    region: "GURUGRAM",
    sales: { cy: 402.1, ly: 407.1, growth: -1.2 },
    marketShareOMC: { cy: 25.66, ly: 25.14, gl: 0.52 },
    marketShareIndustry: { cy: 24.3, ly: 24.09, gl: 0.2 },
  },
  {
    region: "BARODA",
    sales: { cy: 366.0, ly: 361.6, growth: 1.2 },
    marketShareOMC: { cy: 26.78, ly: 26.08, gl: 0.7 },
    marketShareIndustry: { cy: 21.4, ly: 21.46, gl: -0.06 },
  },
  {
    region: "VASHI",
    sales: { cy: 339.4, ly: 328.4, growth: 3.3 },
    marketShareOMC: { cy: 32.45, ly: 32.3, gl: 0.15 },
    marketShareIndustry: { cy: 30.72, ly: 30.99, gl: -0.27 },
  },
  {
    region: "JODHPUR",
    sales: { cy: 314.5, ly: 289.8, growth: 8.5 },
    marketShareOMC: { cy: 33.4, ly: 32.59, gl: 0.82 },
    marketShareIndustry: { cy: 29.24, ly: 28.8, gl: 0.44 },
  },
  {
    region: "SECUNDERABAD",
    sales: { cy: 313.6, ly: 319.4, growth: -1.8 },
    marketShareOMC: { cy: 30.78, ly: 31.09, gl: -0.31 },
    marketShareIndustry: { cy: 29.05, ly: 29.56, gl: -0.5 },
  },
  {
    region: "AHMEDABAD",
    sales: { cy: 312.1, ly: 318.8, growth: -2.1 },
    marketShareOMC: { cy: 27.37, ly: 27.12, gl: 0.25 },
    marketShareIndustry: { cy: 20.2, ly: 20.98, gl: -0.78 },
  },
  {
    region: "BELLARY",
    sales: { cy: 307.6, ly: 321.8, growth: -4.4 },
    marketShareOMC: { cy: 26.86, ly: 26.64, gl: 0.22 },
    marketShareIndustry: { cy: 24.49, ly: 24.74, gl: -0.25 },
  },
  {
    region: "JAIPUR",
    sales: { cy: 299.2, ly: 268.9, growth: 11.3 },
    marketShareOMC: { cy: 30.27, ly: 30.22, gl: 0.05 },
    marketShareIndustry: { cy: 26.48, ly: 27.06, gl: -0.59 },
  },
];

const CHART_COLORS = {
    cy: "#2E7D32",  // Dark green for current year
    ly: "#90CAF9"   // Light blue for previous year
};

// Transform the data for the chart
const transformChartData = (data) => {
  return data.map(item => ({
    name: item.region,
    cy: item.sales.cy,
    ly: item.sales.ly
  }));
};

export default function ZoneWisePivotTableWithChart() {
    const chartRef = useRef<am5.Root | null>(null);
    const chartDivRef = useRef<HTMLDivElement>(null);
  
    const formatNumber = (num: number, decimals = 1) => {
      return num.toFixed(decimals);
    };
  
    const formatPercentage = (num: number) => {
      return `${num}%`;
    };
  
    useEffect(() => {
      if (!chartDivRef.current) return;
  
      const root = am5.Root.new(chartDivRef.current);
      chartRef.current = root;
  
      root.setThemes([am5themes_Animated.new(root)]);
      root._logo?.dispose();
  
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingBottom: 10,
        })
      );
  
      // Create axes
      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "name",
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 60,
            cellStartLocation: 0.2,
            cellEndLocation: 0.8,
          }),
          tooltip: am5.Tooltip.new(root, {})
        })
      );
  
      const chartData = transformChartData(data);
      const maxValue = Math.max(...chartData.flatMap(item => [item.cy, item.ly]));
      const yAxisMax = Math.ceil(maxValue * 1.2);
  
      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          maxDeviation: 0.5,
          min: 0,
          max: yAxisMax,
          strictMinMax: true,
          renderer: am5xy.AxisRendererY.new(root, {})
        })
      );
  
      // Configure axes labels
      xAxis.get("renderer").labels.template.setAll({
        rotation: 0,
        centerY: am5.p50,
        centerX: am5.p50,
        paddingTop: 8,
        paddingBottom: 2,
        fontSize: 10,
        maxWidth: 120,
        oversizedBehavior: "truncate",
        textAlign: "center",
      });
      
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
      });
  
      // Add Y-axis title
      yAxis.children.unshift(
        am5.Label.new(root, {
          rotation: -90,
          text: "Sales (TMT)",
          y: am5.p50,
          centerX: am5.p50,
          fontSize: 10,
          paddingBottom: 0,
        })
      );
  
      // Create legend
      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          marginTop: 15,
          marginBottom: 15,
        })
      );
  
      // Create series with fixed tooltips
      ["cy", "ly"].forEach((metric, index) => {
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: metric === "cy" ? "Current Year" : "Last Year",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: metric,
            categoryXField: "name",
            tooltip: am5.Tooltip.new(root, {
              pointerOrientation: "horizontal",
              labelText: "[bold fontSize: 8px]{categoryX}[/]\n[bold fontSize: 8px]{name}:[bold fontSize: 8px] {valueY} TMT"
            })
          })
        );
  
        // Configure column appearance
        series.columns.template.setAll({
          cornerRadiusTL: 3,
          cornerRadiusTR: 3,
          strokeOpacity: 0,
          fillOpacity: 0.8,
          fill: am5.color(CHART_COLORS[metric as keyof typeof CHART_COLORS]),
          width: am5.percent(90),
          tooltipY: 0,
          tooltipText: "{valueY}",
          // Enable tooltip interactions
          interactive: true,
          cursorOverStyle: "pointer"
        });
  
        // Configure value labels
        series.bullets.push(() => {
          return am5.Bullet.new(root, {
            locationY: 1,
            sprite: am5.Label.new(root, {
              text: "{valueY}",
              centerX: am5.p50,
              centerY: 0,
              populateText: true,
              fontSize: 10,
              fontWeight: "400",
              dy: -20
            })
          });
        });
  
        series.data.setAll(chartData);
      });
  
      // Add cursor
      chart.set("cursor", am5xy.XYCursor.new(root, {
        behavior: "none",
        xAxis: xAxis,
        yAxis: yAxis
      }));
  
      // Add scrollbar
      const scrollbarX = am5.Scrollbar.new(root, {
        orientation: "horizontal",
        marginBottom: 10
      });
  
      chart.set("scrollbarX", scrollbarX);
      chart.bottomAxesContainer.children.push(scrollbarX);
  
      // Set data
      xAxis.data.setAll(chartData);
      legend.data.setAll(chart.series.values);
  
      return () => {
        root.dispose();
      };
    }, []);
  

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Table Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Regional Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <table className="min-w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th rowSpan={2} className="border p-1 text-left text-xs font-medium">
                      Region
                    </th>
                    <th colSpan={3} className="border p-1 text-center text-xs font-medium">
                      Sales (TMT)
                    </th>
                    <th colSpan={3} className="border p-1 text-center text-xs font-medium">
                      Market Share in OMC (%)
                    </th>
                    <th colSpan={3} className="border p-1 text-center text-xs font-medium">
                      Market Share in Industry (%)
                    </th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="border p-1 text-center text-xs">CY ↓</th>
                    <th className="border p-1 text-center text-xs">LY</th>
                    <th className="border p-1 text-center text-xs">Gr%</th>
                    <th className="border p-1 text-center text-xs">CY</th>
                    <th className="border p-1 text-center text-xs">LY</th>
                    <th className="border p-1 text-center text-xs">G/L</th>
                    <th className="border p-1 text-center text-xs">CY</th>
                    <th className="border p-1 text-center text-xs">LY</th>
                    <th className="border p-1 text-center text-xs">G/L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={row.region} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border p-1 text-xs font-medium">{row.region}</td>
                      <td className="border p-1 text-right text-xs">{formatNumber(row.sales.cy)}</td>
                      <td className="border p-1 text-right text-xs">{formatNumber(row.sales.ly)}</td>
                      <td className={`border p-1 text-right text-xs ${row.sales.growth < 0 ? "text-red-500" : ""}`}>
                        {formatPercentage(row.sales.growth)}
                      </td>
                      <td className="border p-1 text-right text-xs">{formatNumber(row.marketShareOMC.cy)}</td>
                      <td className="border p-1 text-right text-xs">{formatNumber(row.marketShareOMC.ly)}</td>
                      <td className={`border p-1 text-right text-xs ${row.marketShareOMC.gl < 0 ? "text-red-500" : ""}`}>
                        {formatNumber(row.marketShareOMC.gl)}
                      </td>
                      <td className="border p-1 text-right text-xs">{formatNumber(row.marketShareIndustry.cy)}</td>
                      <td className="border p-1 text-right text-xs">{formatNumber(row.marketShareIndustry.ly)}</td>
                      <td className={`border p-1 text-right text-xs ${row.marketShareIndustry.gl < 0 ? "text-red-500" : ""}`}>
                        {formatNumber(row.marketShareIndustry.gl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Chart Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sales Comparison by Region</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={chartDivRef} className="h-[400px]" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}