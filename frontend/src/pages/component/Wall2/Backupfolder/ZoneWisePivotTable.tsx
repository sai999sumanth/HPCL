// "use client"

// import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
// import { useEffect, useRef } from "react"
// import * as am5 from "@amcharts/amcharts5"
// import * as am5xy from "@amcharts/amcharts5/xy"
// import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"

// export interface RegionalData {
//     region: string
//     sales: {
//       cy: number
//       ly: number
//       growth: number
//     }
//     marketShareOMC: {
//       cy: number
//       ly: number
//       gl: number
//     }
//     marketShareIndustry: {
//       cy: number
//       ly: number
//       gl: number
//     }
//   }
  
// const data: RegionalData[] = [
//   {
//     region: "PUNE",
//     sales: { cy: 409.1, ly: 385.0, growth: 6.3 },
//     marketShareOMC: { cy: 39.29, ly: 38.37, gl: 0.92 },
//     marketShareIndustry: { cy: 37.19, ly: 36.72, gl: 0.47 },
//   },
//   {
//     region: "BANGALORE",
//     sales: { cy: 404.5, ly: 398.1, growth: 1.6 },
//     marketShareOMC: { cy: 22.04, ly: 21.5, gl: 0.54 },
//     marketShareIndustry: { cy: 18.66, ly: 18.92, gl: -0.26 },
//   },
//   {
//     region: "GURUGRAM",
//     sales: { cy: 402.1, ly: 407.1, growth: -1.2 },
//     marketShareOMC: { cy: 25.66, ly: 25.14, gl: 0.52 },
//     marketShareIndustry: { cy: 24.3, ly: 24.09, gl: 0.2 },
//   },
//   {
//     region: "BARODA",
//     sales: { cy: 366.0, ly: 361.6, growth: 1.2 },
//     marketShareOMC: { cy: 26.78, ly: 26.08, gl: 0.7 },
//     marketShareIndustry: { cy: 21.4, ly: 21.46, gl: -0.06 },
//   },
//   {
//     region: "VASHI",
//     sales: { cy: 339.4, ly: 328.4, growth: 3.3 },
//     marketShareOMC: { cy: 32.45, ly: 32.3, gl: 0.15 },
//     marketShareIndustry: { cy: 30.72, ly: 30.99, gl: -0.27 },
//   },
//   {
//     region: "JODHPUR",
//     sales: { cy: 314.5, ly: 289.8, growth: 8.5 },
//     marketShareOMC: { cy: 33.4, ly: 32.59, gl: 0.82 },
//     marketShareIndustry: { cy: 29.24, ly: 28.8, gl: 0.44 },
//   },
//   {
//     region: "SECUNDERABAD",
//     sales: { cy: 313.6, ly: 319.4, growth: -1.8 },
//     marketShareOMC: { cy: 30.78, ly: 31.09, gl: -0.31 },
//     marketShareIndustry: { cy: 29.05, ly: 29.56, gl: -0.5 },
//   },
//   {
//     region: "AHMEDABAD",
//     sales: { cy: 312.1, ly: 318.8, growth: -2.1 },
//     marketShareOMC: { cy: 27.37, ly: 27.12, gl: 0.25 },
//     marketShareIndustry: { cy: 20.2, ly: 20.98, gl: -0.78 },
//   },
//   {
//     region: "BELLARY",
//     sales: { cy: 307.6, ly: 321.8, growth: -4.4 },
//     marketShareOMC: { cy: 26.86, ly: 26.64, gl: 0.22 },
//     marketShareIndustry: { cy: 24.49, ly: 24.74, gl: -0.25 },
//   },
//   {
//     region: "JAIPUR",
//     sales: { cy: 299.2, ly: 268.9, growth: 11.3 },
//     marketShareOMC: { cy: 30.27, ly: 30.22, gl: 0.05 },
//     marketShareIndustry: { cy: 26.48, ly: 27.06, gl: -0.59 },
//   },
// ]
// export default function ZoneWisePivotTable() {
//     const chartRef = useRef<am5.Root | null>(null);
//     const chartDivRef = useRef<HTMLDivElement>(null);
  
//     const formatNumber = (num: number, decimals = 1) => {
//       return num.toFixed(decimals);
//     };
  
//     const formatPercentage = (num: number) => {
//       return `${num}%`;
//     };
  
//     // Transform data for the chart
//     const chartData = data.map(item => ({
//       name: item.region,
//       value: item.sales.cy
//     }));
  
//     useEffect(() => {
//       if (!chartDivRef.current) return;
  
//       // Create root element
//       const root = am5.Root.new(chartDivRef.current);
//       chartRef.current = root;
  
//       root.setThemes([am5themes_Animated.new(root)]);
//       root._logo?.dispose();
  
//       // Create chart
//       const chart = root.container.children.push(
//         am5xy.XYChart.new(root, {
//           panX: false,
//           panY: true,
//           wheelX: "none",
//           wheelY: "none",
//           layout: root.verticalLayout,
//           paddingBottom: 20
//         })
//       );
  
//       // Create axes
//       const xAxis = chart.xAxes.push(
//         am5xy.ValueAxis.new(root, {
//           renderer: am5xy.AxisRendererX.new(root, {}),
//           numberFormat: "#,###.########",
//           min: 0
//         })
//       );
  
//       const yAxis = chart.yAxes.push(
//         am5xy.CategoryAxis.new(root, {
//           categoryField: "name",
//           renderer: am5xy.AxisRendererY.new(root, {
//             minGridDistance: 30,
//             cellStartLocation: 0.1,
//             cellEndLocation: 0.8
//           }),
//           tooltip: am5.Tooltip.new(root, {})
//         })
//       );
  
//       // Configure axis labels
//       xAxis.get("renderer").labels.template.setAll({
//         rotation: 0,
//         centerY: am5.p50,
//         centerX: am5.p50,
//         paddingTop: 8,
//         paddingBottom: 2,
//         fontSize: 8,
//         maxWidth: 120,
//         oversizedBehavior: "truncate",
//         textAlign: "center"
//       });
  
//       yAxis.get("renderer").labels.template.setAll({
//         rotation: 0,
//         fontSize: 8,
//         maxWidth: 120,
//         oversizedBehavior: "truncate",
//         textAlign: "center"
//       });
  
//       // Add series
//       const series = chart.series.push(
//         am5xy.ColumnSeries.new(root, {
//           name: "Sales",
//           xAxis: xAxis,
//           yAxis: yAxis,
//           valueXField: "value",
//           categoryYField: "name",
//           tooltip: am5.Tooltip.new(root, {
//             labelText: "[bold fontSize: 8px]{categoryY}[/]\n[fontSize: 10px]Sales: [bold fontSize: 8px]{valueX.formatNumber('#,###.########')}[/]"
//           })
//         })
//       );
  
//       // Configure columns
//       series.columns.template.setAll({
//         cornerRadiusTR: 5,
//         cornerRadiusBR: 5,
//         strokeOpacity: 0,
//         tooltipY: 0,
//         height: am5.percent(70),
//         width: am5.percent(40)
//       });
  
//       // Add scrollbar
//       const scrollbarY = am5.Scrollbar.new(root, {
//         orientation: "vertical",
//         marginRight: -10,
//         minWidth: 10,
//         start: 0,
//         end: chartData.length <= 10 ? 1 : 10 / chartData.length,
//       });
  
//       chart.set("scrollbarY", scrollbarY);
//       chart.rightAxesContainer.children.push(scrollbarY);
  
//       // Set data
//       yAxis.data.setAll(chartData);
//       series.data.setAll(chartData);
  
//       return () => {
//         root.dispose();
//       };
//     }, []);
  
//     return (
//       <div className="w-full">
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//           {/* Table Section */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="text-sm">Regional Performance Metrics</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="w-full overflow-x-auto">
//                 <table className="min-w-full border-collapse bg-white">
//                   <thead>
//                     <tr className="bg-gray-100">
//                       <th rowSpan={2} className="border p-1 text-left text-xs font-medium">
//                         Region
//                       </th>
//                       <th colSpan={3} className="border p-1 text-center text-xs font-medium">
//                         Sales (TMT)
//                       </th>
//                       <th colSpan={3} className="border p-1 text-center text-xs font-medium">
//                         Market Share in OMC (%)
//                       </th>
//                       <th colSpan={3} className="border p-1 text-center text-xs font-medium">
//                         Market Share in Industry (%)
//                       </th>
//                     </tr>
//                     <tr className="bg-gray-50">
//                       <th className="border p-1 text-center text-xs">CY ↓</th>
//                       <th className="border p-1 text-center text-xs">LY</th>
//                       <th className="border p-1 text-center text-xs">Gr%</th>
//                       <th className="border p-1 text-center text-xs">CY</th>
//                       <th className="border p-1 text-center text-xs">LY</th>
//                       <th className="border p-1 text-center text-xs">G/L</th>
//                       <th className="border p-1 text-center text-xs">CY</th>
//                       <th className="border p-1 text-center text-xs">LY</th>
//                       <th className="border p-1 text-center text-xs">G/L</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {data.map((row, index) => (
//                       <tr key={row.region} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
//                         <td className="border p-1 text-xs font-medium">{row.region}</td>
//                         <td className="border p-1 text-right text-xs">{formatNumber(row.sales.cy)}</td>
//                         <td className="border p-1 text-right text-xs">{formatNumber(row.sales.ly)}</td>
//                         <td className={`border p-1 text-right text-xs ${row.sales.growth < 0 ? "text-red-500" : ""}`}>
//                           {formatPercentage(row.sales.growth)}
//                         </td>
//                         <td className="border p-1 text-right text-xs">{formatNumber(row.marketShareOMC.cy)}</td>
//                         <td className="border p-1 text-right text-xs">{formatNumber(row.marketShareOMC.ly)}</td>
//                         <td className={`border p-1 text-right text-xs ${row.marketShareOMC.gl < 0 ? "text-red-500" : ""}`}>
//                           {formatNumber(row.marketShareOMC.gl)}
//                         </td>
//                         <td className="border p-1 text-right text-xs">{formatNumber(row.marketShareIndustry.cy)}</td>
//                         <td className="border p-1 text-right text-xs">{formatNumber(row.marketShareIndustry.ly)}</td>
//                         <td className={`border p-1 text-right text-xs ${row.marketShareIndustry.gl < 0 ? "text-red-500" : ""}`}>
//                           {formatNumber(row.marketShareIndustry.gl)}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </CardContent>
//           </Card>
  
//           {/* Chart Section */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="text-sm">Sales by Region</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div ref={chartDivRef} className="h-[500px]" />
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     );
//   }
  "use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card"
import { useEffect, useRef } from "react"
import * as am5 from "@amcharts/amcharts5"
import * as am5xy from "@amcharts/amcharts5/xy"
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated"
import FilterComponent from "./FiltersLayout"
import ExcelStyleTabs from "./IndustrialTabs"

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
  Current_Sales: "#2E7D32",  // Dark green for current year
  Previous_Sale: "#90CAF9"   // Light blue for previous year
};

// Transform the data for the chart
const transformChartData = (data) => {
  return data.map(item => ({
    name: item.region,
    Current_Sales: item.sales.cy,
    Previous_Sale: item.sales.ly
  }));
};

export default function ZoneWisePivotTable() {
  const chartRef = useRef<am5.Root | null>(null);
  const chartDivRef = useRef<HTMLDivElement>(null);

  const formatNumber = (num: number, decimals = 1) => {
    return num.toFixed(decimals);
  };

  const formatPercentage = (num: number) => {
    return `${num}%`;
  };

  
  return (
    <div className="w-full">
              < ExcelStyleTabs/>

       < FilterComponent/>
        {/* Table Section */}
       
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
       

       
      </div>
  );
}