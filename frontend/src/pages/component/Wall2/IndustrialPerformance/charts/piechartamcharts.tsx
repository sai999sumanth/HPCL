
// import React, { useEffect } from 'react';
// import * as am5 from '@amcharts/amcharts5';
// import * as am5percent from '@amcharts/amcharts5/percent';
// import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';

// interface PieChartProps {
//   data: Record<string, number>;
//   title: string;
// }

// const PieChart: React.FC<PieChartProps> = ({ data, title }) => {
//   const chartId = `chart-${title.replace(/\s+/g, '-').toLowerCase()}`;

//   useEffect(() => {
//     const root = am5.Root.new(chartId);
//     root.setThemes([am5.Theme.new(root)]);

//     const chart = root.container.children.push(
//       am5percent.PieChart.new(root, {
//         layout: root.verticalLayout,
//         innerRadius: am5.percent(70),
//         paddingTop: 0,
//         paddingBottom: 0
//       })
//     );

//     const series = chart.series.push(
//       am5percent.PieSeries.new(root, {
//         name: "Series",
//         valueField: "value",
//         categoryField: "category",
//       })
//     );

//     // Configure labels
//     series.labels.template.setAll({
//       fontSize: 8,
//       text: "{category}: {value},"
//     });

//     series.labels.template.setAll({
//         text: "{category}:{value}:\n{valuePercentTotal.formatNumber('#.0')}%",
//         textType: "circular",
//         radius: -5,
//         fontSize: 10,
//         fill: am5.color(0x000000),
//         inside: false,
//         centerX: am5.percent(50),
//         centerY: am5.percent(50),
//         oversizedBehavior: "none",
//       })
  
//     // Configure tooltips
//     series.slices.template.setAll({
//       tooltipText: "{category}: {value.formatNumber('#.##')}"
//     });
    
//     series.ticks.template.setAll({
//       length: 6,
//       stroke: am5.color(0x000000)
//     });

//     const chartData = Object.entries(data).map(([category, value]) => ({
//       category,
//       value
//     }));
//    series.setAll({
//         tooltipText: "[fontSize: 10px]{category}: {value}",
//         tooltip: am5.Tooltip.new(root, {
//           labelText: "[fontSize: 10px]{category}: {value}",
//           getFillFromSprite: true
//         })
//       });
  
//     series.data.setAll(chartData);
//     root._logo?.dispose();

//     // Configure legend with compact spacing
//     const legend = chart.children.push(am5.Legend.new(root, {
//       centerX: am5.percent(50),
//       x: am5.percent(50),
//       layout: root.horizontalLayout,
//       paddingTop: 0,
//       paddingBottom: 0,
//       marginTop: 0,
//       marginBottom: 0
//     }));

//     // Adjust legend labels
//     legend.labels.template.setAll({
//       fontSize: 8,
//       paddingLeft: 4,
//       paddingRight: 4,
//       marginLeft: 0,
//       marginRight: 0,
//       fontWeight: "400"
//     });

//     // Adjust legend value labels
//     legend.valueLabels.template.setAll({
//       fontSize: 8,
//       paddingLeft: 2,
//       paddingRight: 2,
//       marginLeft: 0,
//       marginRight: 4
//     });

    
//     legend.labels.template.setAll({
//         textAlign: "center",
//         fill: am5.color(0x000000),
//         fontSize: 10
//       });
    
//       // Disable legend marker interactions
//       legend.markers.template.setAll({
//         width: 10,
//         height: 10
//       });
//     // Reduce spacing between legend items
//     legend.itemContainers.template.setAll({
//       paddingTop: 2,
//       paddingBottom: 2,
//       marginLeft: 0,
//       marginRight: 4
//     });
//     legend.valueLabels.template.set("forceHidden", true); // Hide default value labels

//     legend.data.setAll(series.dataItems);

//     return () => {
//       root.dispose();
//     };
//   }, [data, chartId]);

//   return (
//     <Card className="w-full">
//       <CardHeader className="p-1">
//         <CardTitle className="text-xs p-0">{title}</CardTitle>
//       </CardHeader>
//       <CardContent className="pt-0">
//         <div id={chartId} className="h-40"></div>
//       </CardContent>
//     </Card>
//   );
// };

// // export default PieChart;
// import React, { useState, useEffect } from 'react';
// import * as am5 from '@amcharts/amcharts5';
// import * as am5percent from '@amcharts/amcharts5/percent';
// import * as am5xy from '@amcharts/amcharts5/xy';
// import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
// import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';

// // PieChart component
// export const PieChart = ({ data, title }) => {
//   const chartId = `chart-${title.replace(/\s+/g, '-').toLowerCase()}`;
  
//   useEffect(() => {
//     const root = am5.Root.new(chartId);
//     root.setThemes([am5themes_Animated.new(root)]);
    
//     const chart = root.container.children.push(
//       am5percent.PieChart.new(root, {
//         layout: root.verticalLayout,
//         innerRadius: am5.percent(70),
//         paddingTop: 0,
//         paddingBottom: 0
//       })
//     );
    
//     const series = chart.series.push(
//       am5percent.PieSeries.new(root, {
//         name: "Series",
//         valueField: "value",
//         categoryField: "category",
//       })
//     );
    
//     series.labels.template.setAll({
//       text: "{category}: {value.formatNumber('#,###')}:\n{valuePercentTotal.formatNumber('#.0')}%",
//       textType: "circular",
//       radius: -5,
//       fontSize: 10,
//       fill: am5.color(0x000000),
//       inside: false,
//       centerX: am5.percent(50),
//       centerY: am5.percent(50),
//       oversizedBehavior: "none",
//     });
    
//     series.ticks.template.setAll({
//       length: 6,
//       stroke: am5.color(0x000000)
//     });
    
//     const chartData = Object.entries(data).map(([category, value]) => ({
//       category,
//       value
//     }));
    
//     series.setAll({
//       tooltipText: "[fontSize: 10px]{category}: {value.formatNumber('#,###')}",
//       tooltip: am5.Tooltip.new(root, {
//         labelText: "[fontSize: 10px]{category}: {value.formatNumber('#,###')}",
//         getFillFromSprite: true
//       })
//     });
    
//     series.data.setAll(chartData);
//     root._logo?.dispose();
    
//     const legend = chart.children.push(am5.Legend.new(root, {
//       centerX: am5.percent(50),
//       x: am5.percent(50),
//       layout: root.horizontalLayout,
//       paddingTop: 0,
//       paddingBottom: 0,
//       marginTop: 0,
//       marginBottom: 0
//     }));
    
//     legend.labels.template.setAll({
//       fontSize: 10,
//       textAlign: "center",
//       fill: am5.color(0x000000),
//       paddingLeft: 4,
//       paddingRight: 4
//     });
    
//     legend.markers.template.setAll({
//       width: 10,
//       height: 10
//     });
    
//     legend.itemContainers.template.setAll({
//       paddingTop: 2,
//       paddingBottom: 2,
//       marginLeft: 0,
//       marginRight: 4
//     });
    
//     legend.valueLabels.template.set("forceHidden", true);
//     legend.data.setAll(series.dataItems);
    
//     return () => {
//       root.dispose();
//     };
//   }, [data, chartId]);
  
//   return (
//     <Card className="w-full">
//       <CardHeader className="p-1">
//         <CardTitle className="text-xs p-0">{title}</CardTitle>
//       </CardHeader>
//       <CardContent className="pt-0">
//         <div id={chartId} className="h-40"></div>
//       </CardContent>
//     </Card>
//   );
// };

// // GrowthBarChart component
// export const GrowthBarChart = ({ data, title }) => {
//   const chartId = `chart-${title.replace(/\s+/g, '-').toLowerCase()}`;
  
//   useEffect(() => {
//     const root = am5.Root.new(chartId);
//     root.setThemes([am5themes_Animated.new(root)]);
    
//     const chart = root.container.children.push(
//       am5xy.XYChart.new(root, {
//         panX: true,
//         panY: false,
//         wheelX: "panX",
//         wheelY: "zoomX",
//         paddingTop: 0,
//         paddingBottom: 0,
//         paddingLeft: 0,
//         paddingRight: 15,

//         layout: root.verticalLayout
//       })
//     );
    
//     // Create axes
//     const xAxis = chart.xAxes.push(
//       am5xy.CategoryAxis.new(root, {
//         categoryField: "category",
//         renderer: am5xy.AxisRendererX.new(root, {
//           minGridDistance: 30
//         }),
//         tooltip: am5.Tooltip.new(root, {})
//       })
//     );
    
//     xAxis.get("renderer").labels.template.setAll({
//       rotation: -45,
//       centerY: am5.p50,
//       centerX: am5.p100,
//       paddingRight: 15,
//       fontSize: 10
//     });
    
//     const yAxis = chart.yAxes.push(
//       am5xy.ValueAxis.new(root, {
//         renderer: am5xy.AxisRendererY.new(root, {})
//       })
//     );
    
//     yAxis.get("renderer").labels.template.setAll({
//       fontSize: 10
//     });
    
//     // Add label
//     yAxis.children.unshift(
//       am5.Label.new(root, {
//         rotation: -90,
//         text: "Growth Percentage (%)",
//         y: am5.p50,
//         centerX: am5.p50,
//         fontSize: 10
//       })
//     );
    
//     // Create series
//     const series = chart.series.push(
//       am5xy.ColumnSeries.new(root, {
//         name: "Growth",
//         xAxis: xAxis,
//         yAxis: yAxis,
//         valueYField: "value",
//         categoryXField: "category",
//         tooltip: am5.Tooltip.new(root, {
//           labelText: "{categoryX}: {valueY}%"
//         })
//       })
//     );

//     series.columns.template.setAll({
//       cornerRadiusTL: 3,
//       cornerRadiusTR: 3,
//       strokeOpacity: 0
//     });
    
//     // Add value labels on top of bars
    // series.bullets.push(() => {
    //   return am5.Bullet.new(root, {
    //     locationY: 1,
    //     sprite: am5.Label.new(root, {
    //       text: "{valueY}%",
    //       fill: root.interfaceColors.get("alternativeText"),
    //       centerY: 0,
    //       centerX: am5.p50,
    //       populateText: true,
    //       fontSize: 10,
    //       fontWeight: "400",
    //       dy: -10
    //     })
    //   });
    // });
    
//     // Convert data to chart format
//     const chartData = [];
//     Object.entries(data).forEach(([sector, companies]) => {
//       Object.entries(companies).forEach(([company, value]) => {
//         chartData.push({
//           category: `${company} (${sector})`,
//           value: parseFloat(value)
//         });
//       });
//     });
    
//     // Sort data by value
//     chartData.sort((a, b) => b.value - a.value);
    
//     series.data.setAll(chartData);
//     xAxis.data.setAll(chartData);
    
//     // Add scrollbar
//     chart.set("scrollbarX", am5.Scrollbar.new(root, {
//       orientation: "horizontal"
//     }));
    
//     root._logo?.dispose();
    
//     // Add legend
//     const legend = chart.children.push(
//       am5.Legend.new(root, {
//         centerX: am5.p50,
//         x: am5.p50,
//         layout: root.horizontalLayout,
//         marginTop: 15
//       })
//     );
    
//     legend.data.setAll([{
//       name: "Positive Growth",
//       color: am5.color(0x2ECC40)
//     }, {
//       name: "Negative Growth",
//       color: am5.color(0xFF4136)
//     }]);
    
//     legend.markers.template.setAll({
//       width: 10,
//       height: 10
//     });
    
//     legend.labels.template.setAll({
//       fontSize: 10
//     });
    
//     chart.appear(1000, 100);
    
//     return () => {
//       root.dispose();
//     };
//   }, [data, chartId]);
  
//   return (
//     <Card className="w-full">
//       <CardHeader className="p-1">
//         <CardTitle className="text-xs p-0">{title}</CardTitle>
//       </CardHeader>
//       <CardContent className="pt-0 p-0">
//         <div id={chartId} className="h-52"></div>
//       </CardContent>
//     </Card>
//   );
// // };
// import React, { useState, useEffect } from 'react';
// import * as am5 from '@amcharts/amcharts5';
// import * as am5percent from '@amcharts/amcharts5/percent';
// import * as am5xy from '@amcharts/amcharts5/xy';
// import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
// import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';

// // Define interfaces for your data
// interface PieChartData {
//   [category: string]: number;
// }

// interface GrowthChartData {
//   [sector: string]: {
//     [company: string]: number;
//   };
// }

// interface ChartDataItem {
//   category: string;
//   value: number;
//   company?: string;
// }

// // Company color mapping
// const COMPANY_COLORS = {
//   "HPCL": "#1D4ED8",
//   "BPCL": "#FBBF24",
//   "IOCL": "#EA580C",
//   "RIL": "#A855F7",
//   "Nyra": "#14B8A6",
//   "Shell": "#A16207",
//   "MRPL": "#4D7C0F",
//   "GALE": "#991B1B",
//   "CPCL": "#44403C",
//   "HMEL": "#052E16",
//   "NRL": "#3B0764",
//   "NEL": "#7C2D12",
//   "OIL": "#1F2937",
//   "SMA": "#4A044E",
//   "BURL": "#9D174D"
// };

// // PieChart component
// export const PieChart = ({ data, title }: { data: PieChartData, title: string }) => {
//   const chartId = `chart-${title.replace(/\s+/g, '-').toLowerCase()}`;
  
//   useEffect(() => {
//     const root = am5.Root.new(chartId);
//     root.setThemes([am5themes_Animated.new(root)]);
    
//     const chart = root.container.children.push(
//       am5percent.PieChart.new(root, {
//         layout: root.verticalLayout,
//         innerRadius: am5.percent(70),
//         paddingTop: 0,
//         paddingBottom: 0
//       })
//     );
    
//     const series = chart.series.push(
//       am5percent.PieSeries.new(root, {
//         name: "Series",
//         valueField: "value",
//         categoryField: "category",
//       })
//     );
    
//     // Set custom colors for slices based on company name
//     series.slices.template.adapters.add("fill", (fill, target) => {
//       const dataItem = target.dataItem;
//       if (dataItem && dataItem.dataContext) {
//         const company = (dataItem.dataContext as ChartDataItem).category;
//         if (COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]) {
//           return am5.color(COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]);
//         }
//       }
//       return fill;
//     });
    
//     series.labels.template.setAll({
//       text: "{category}: {value.formatNumber('#,###')}:\n{valuePercentTotal.formatNumber('#.0')}%",
//       textType: "circular",
//       radius: -5,
//       fontSize: 10,
//       fill: am5.color(0x000000),
//       inside: false,
//       centerX: am5.percent(50),
//       centerY: am5.percent(50),
//       oversizedBehavior: "none",
//     });
    
//     series.ticks.template.setAll({
//       length: 6,
//       stroke: am5.color(0x000000)
//     });
    
//     const chartData = Object.entries(data).map(([category, value]) => ({
//       category,
//       value
//     }));
    
//     series.setAll({
//       tooltipText: "[fontSize: 10px]{category}: {value.formatNumber('#,###')}",
//       tooltip: am5.Tooltip.new(root, {
//         labelText: "[fontSize: 10px]{category}: {value.formatNumber('#,###')}",
//         getFillFromSprite: true
//       })
//     });
    
//     series.data.setAll(chartData);
//     root._logo?.dispose();
    
//     const legend = chart.children.push(am5.Legend.new(root, {
//       centerX: am5.percent(50),
//       x: am5.percent(50),
//       layout: root.horizontalLayout,
//       paddingTop: 0,
//       paddingBottom: 0,
//       marginTop: 0,
//       marginBottom: 0
//     }));
    
//     // Set custom colors for legend markers
// // For the legend markers
// legend.markers.template.adapters.add("fill" as any, (fill, target) => {
//   const dataItem = target.dataItem;
//   if (dataItem && dataItem.dataContext) {
//     const company = (dataItem.dataContext as ChartDataItem).category;
//     if (COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]) {
//       return am5.color(COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]);
//     }
//   }
//   return fill;
// });
//     legend.labels.template.setAll({
//       fontSize: 10,
//       textAlign: "center",
//       fill: am5.color(0x000000),
//       paddingLeft: 4,
//       paddingRight: 4
//     });
    
//     legend.markers.template.setAll({
//       width: 10,
//       height: 10
//     });
    
//     legend.itemContainers.template.setAll({
//       paddingTop: 2,
//       paddingBottom: 2,
//       marginLeft: 0,
//       marginRight: 4
//     });
    
//     legend.valueLabels.template.set("forceHidden", true);
//     legend.data.setAll(series.dataItems);
    
//     return () => {
//       root.dispose();
//     };
//   }, [data, chartId]);
  
//   return (
//     <Card className="w-full">
//       <CardHeader className="p-1">
//         <CardTitle className="text-xs p-0">{title}</CardTitle>
//       </CardHeader>
//       <CardContent className="pt-0">
//         <div id={chartId} className="h-40"></div>
//       </CardContent>
//     </Card>
//   );
// };

// // GrowthBarChart component
// export const GrowthBarChart = ({ data, title }: { data: GrowthChartData, title: string }) => {
//   const chartId = `chart-${title.replace(/\s+/g, '-').toLowerCase()}`;
  
//   useEffect(() => {
//     const root = am5.Root.new(chartId);
//     root.setThemes([am5themes_Animated.new(root)]);
    
//     const chart = root.container.children.push(
//       am5xy.XYChart.new(root, {
//         panX: true,
//         panY: false,
//         wheelX: "panX",
//         wheelY: "zoomX",
//         paddingTop: 0,
//         paddingBottom: -15,
//         paddingLeft: 0,
//         paddingRight: 15,
//         layout: root.verticalLayout
//       })
//     );
    
//     // Create axes
//     const xAxis = chart.xAxes.push(
//       am5xy.CategoryAxis.new(root, {
//         categoryField: "category",
//         renderer: am5xy.AxisRendererX.new(root, {
//           minGridDistance: 30
//         }),
//         tooltip: am5.Tooltip.new(root, {})
//       })
//     );
    
//     xAxis.get("renderer").labels.template.setAll({
//       rotation: -45,
//       centerY: am5.p50,
//       centerX: am5.p100,
//       paddingRight: 15,
//       fontSize: 10
//     });
    
//     const yAxis = chart.yAxes.push(
//       am5xy.ValueAxis.new(root, {
//         renderer: am5xy.AxisRendererY.new(root, {})
//       })
//     );
    
//     yAxis.get("renderer").labels.template.setAll({
//       fontSize: 10
//     });
    
//     // Add label
//     yAxis.children.unshift(
//       am5.Label.new(root, {
//         rotation: -90,
//         text: "Growth Percentage (%)",
//         y: am5.p50,
//         centerX: am5.p50,
//         fontSize: 10
//       })
//     );
    
//     // Create series
//     const series = chart.series.push(
//       am5xy.ColumnSeries.new(root, {
//         name: "Growth",
//         xAxis: xAxis,
//         yAxis: yAxis,
//         valueYField: "value",
//         categoryXField: "category",
//         tooltip: am5.Tooltip.new(root, {
//           labelText: "{categoryX}: {valueY}%"
//         })
//       })
//     );
    
//     // Set custom colors for columns based on company name
//     series.columns.template.adapters.add("fill" as any, (fill, target) => {
//       const dataItem = target.dataItem;
//       if (dataItem && dataItem.dataContext) {
//         const fullCategory = (dataItem.dataContext as ChartDataItem).category;
//         // Extract company name from category (format: "Company (Sector)")
//         const companyMatch = fullCategory.match(/^([^(]+)/);
//         if (companyMatch) {
//           const company = companyMatch[1].trim();
//           if (COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]) {
//             return am5.color(COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]);
//           }
//         }
//       }
//       // Default color logic based on positive/negative value
//       const value = dataItem ? (dataItem.get("valueY" as any) as number) : 0;
//       return value >= 0 ? am5.color(0x2ECC40) : am5.color(0xFF4136);
//     });
    
//     series.columns.template.setAll({
//       cornerRadiusTL: 3,
//       cornerRadiusTR: 3,
//       strokeOpacity: 0
//     });
    
// 

    
//     // Convert data to chart format
//     const chartData: ChartDataItem[] = [];
//     Object.entries(data).forEach(([sector, companies]) => {
//       Object.entries(companies).forEach(([company, value]) => {
//         chartData.push({
//           category: `${company} (${sector})`,
//           value: parseFloat(value.toString()),
//           company: company // Store the company name separately for color mapping
//         });
//       });
//     });
    
//     // Sort data by value
//     chartData.sort((a, b) => b.value - a.value);
    
//     series.data.setAll(chartData);
//     xAxis.data.setAll(chartData);
    
//     // Add scrollbar
//     chart.set("scrollbarX", am5.Scrollbar.new(root, {
//       orientation: "horizontal"
//     }));
    
//     root._logo?.dispose();
    
//     // Create company color legend
//     const legend = chart.children.push(
//       am5.Legend.new(root, {
//         centerX: am5.p50,
//         x: am5.p50,
//         layout: root.horizontalLayout,
//         marginTop: 15
//       })
//     );
    
//     // Create legend items for each company with their designated colors
//     const legendData = Object.entries(COMPANY_COLORS)
//       .filter(([company]) => {
//         // Only include companies that are present in the chart data
//         return chartData.some(item => item.category.includes(company));
//       })
//       .map(([company, color]) => ({
//         name: company,
//         color: am5.color(color)
//       }));
    
//     legend.data.setAll(legendData);
    
//     legend.markers.template.setAll({
//       width: 10,
//       height: 10
//     });
    
//     legend.labels.template.setAll({
//       fontSize: 10
//     });
    
//     chart.appear(1000, 100);
    
//     return () => {
//       root.dispose();
//     };
//   }, [data, chartId]);
  
//   return (
//     <Card className="w-full">
//       <CardHeader className="p-1">
//         <CardTitle className="text-xs p-0">{title}</CardTitle>
//       </CardHeader>
//       <CardContent className="pt-0 p-0">
//         <div id={chartId} className="h-64"></div>
//       </CardContent>
//     </Card>
//   );
// };
import React, { useState, useEffect } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/@/components/ui/button';

// Define interfaces for your data
interface PieChartData {
  [category: string]: number;
}

interface GrowthChartData {
  [sector: string]: {
    [company: string]: number;
  };
}

interface ChartDataItem {
  companyName: any;
  category: string;
  value: number;
  company?: string;
  sector?: string; // Add sector property
}

// Company color mapping
// Company colors configuration
const COMPANY_COLORS = {
  HPCL: "#1D4ED8",
  BPCL: "#FBBF24",
  IOCL: "#EA580C",
  RIL: "#A855F7",
  Nyra: "#14B8A6",
  SHELL: "#A16207",
  MRPL: "#4D7C0F",
  GAIL: "#991B1B", 
  CPCL: "#44403C",
  HMEL: "#052E16",
  NRL: "#3B0764",
  NEL: "#0048A8",
  OIL: "#1F2937",
  SMA: "#4A044E",
  BURL: "#9D174D",
  ONGC: "#FF0000",

  "Other PSU": "#808000",
  PVT: "#800080",
}
export const GrowthBarChart = ({ data, title }: { data: GrowthChartData, title: string }) => {
  let number = Math.random();
  const chartId = `chart-${title.replace(/\s+/g, '-').toLowerCase()}-${number}`;
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  
  // Define the custom company order
   const companyOrder = [
    "HPCL",
    "BPCL",
    "IOCL",
    "GAIL",
    "CPCL",
    "MRPL",
    "NRL",
    "OIL",
    "ONGC",
    "RIL",
    "NEL",
    "HMEL",
    "SHELL",
    "SMA"
  ];
  
  useEffect(() => {
    // Don't initialize chart until container is available
    const chartContainer = document.getElementById(chartId);
    if (!chartContainer) return;
    
    const root = am5.Root.new(chartId);
    root.setThemes([am5themes_Animated.new(root)]);
    
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "none",
        wheelY: "none",
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 15,
        paddingBottom: 0,
        layout: root.verticalLayout
      })
    );
    
    // Add cursor with improved configuration
    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
    cursor.lineY.set("visible", false);
    
    // Create axes with enhanced styling
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 30,
      minorGridEnabled: true
    });
    
    xRenderer.labels.template.setAll({
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p100,
      paddingRight: 5,
      fontSize: 10,
      fontWeight: "bold",
      // Show only company name, not sector in parentheses
      tooltipText: "{companyName}"
    });
    
    xRenderer.grid.template.setAll({
      location: 1
    });
    
    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        maxDeviation: 0.3,
        categoryField: "companyName", // Use companyName field instead of category
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    
    // Enable tooltips on x-axis labels
    xAxis.get("renderer").labels.template.set("tooltip", am5.Tooltip.new(root, {
      getFillFromSprite: false,
      labelText: "{companyName}" // Use companyName field
    }));
    
    // Add X-axis title with dynamic label
    xAxis.children.push(
      am5.Label.new(root, {
        // text: "Company",
        x: am5.p50,
        centerX: am5.p50,
        paddingTop: 0,
        fontSize: 10,
        fontWeight: "bold",
      })
    );
  
    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.1
    });
    const chartData: ChartDataItem[] = [];
    Object.entries(data).forEach(([sector, companies]) => {
      Object.entries(companies).forEach(([company, value]) => {
        chartData.push({
          category: `${company} (${sector})`, // Keep original format for reference
          companyName: company, // Add company name without sector
          value: parseFloat(value.toString()),
          company: company, // Store the company name separately for color mapping
          sector: sector // Store sector for potential future use
        });
      });
    });

    // Calculate maximum and minimum values with extra padding for labels
    const maxValue = Math.max(...chartData.map((item) => item.value));
    const minValue = Math.min(...chartData.map((item) => item.value));
    
    // Add extra padding (30%) to ensure labels are visible
    const yAxisMax = Math.ceil(maxValue > 0 ? maxValue * 1.3 : maxValue * 0.7);
    const yAxisMin = Math.floor(minValue < 0 ? minValue * 1.3 : minValue * 0.7);

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        max: yAxisMax,
        min: yAxisMin,
        maxDeviation: 0.3,
        renderer: yRenderer
      })
    );  
    
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 10,
      fontWeight: "bold",
    });
    
    // Add label
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "G/L (%)",
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 10,
        fontWeight: "bold",
      })
    );
    
    // Create series with enhanced visuals
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Growth",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "companyName", // Use companyName field instead of category
        sequencedInterpolation: true,
        tooltip: am5.Tooltip.new(root, {
          labelText: "{companyName}: {valueY.formatNumber('#.00')}%", // Use companyName field
          getFillFromSprite: true
        })
      })
    );
    
    // Enhanced column styling
    series.columns.template.setAll({
      width: am5.percent(40),
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      strokeOpacity: 0
    });
    
    // Set custom colors for columns based on company name
    series.columns.template.adapters.add("fill" as any, (fill, target) => {
      const dataItem = target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const company = (dataItem.dataContext as ChartDataItem).companyName;
        if (COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]) {
          return am5.color(COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]);
        }
      }
      // Default color logic based on positive/negative value
      const value = dataItem ? (dataItem.get("valueY" as any) as number) : 0;
      return value >= 0 ? am5.color(0x2ECC40) : am5.color(0xFF4136);
    });
    
    // Dynamic color adaptation for columns based on chart color index
    series.columns.template.adapters.add("stroke" as any, (stroke, target) => {
      return target.get("fill");
    });
    
    // Enhanced tooltips with company colors
    series.columns.template.adapters.add("tooltipFill" as any, (fill, target) => {
      const dataItem = target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const company = (dataItem.dataContext as ChartDataItem).companyName;
        if (COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]) {
          return am5.color(COMPANY_COLORS[company as keyof typeof COMPANY_COLORS]);
        }
      }
      return fill;
    });
    
    // Modified bullet label logic with dynamic positioning
    // series.bullets.push(() => {
    //   return am5.Bullet.new(root, {
    //     locationY: 1,
    //     sprite: am5.Label.new(root, {
    //       text: "{valueY.formatNumber('#.00')}%",
    //       fill: am5.color(0x000000),
    //       centerX: am5.p50,
    //       fontSize: 10,
    //       rotation:-20,
    //       fontWeight: "bold",
    //       populateText: true,
    //       oversizedBehavior: "none",
    //       dy: -25
    //     })
    //   });
    // });

    series.bullets.push((): am5.Bullet => {
      const bullet = am5.Bullet.new(root, {
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: "{valueY.formatNumber('#.00')}%",
          fill: am5.color(0x000000),
          centerX: am5.p50,
          fontSize: 10,
          rotation: -20,
          fontWeight: "bold",
          populateText: true,
          oversizedBehavior: "none",
          dy: 0,
        })
      });
    
      bullet.get("sprite").adapters.add("dy", (dy, target) => {
        const dataItem: any = target.dataItem;
        if (dataItem) {
          return dataItem.get("valueY") >= 0 ? -25 : 0;
        }
        return dy;
      });
    
      return bullet;
    });

    
    // Convert data to chart format with only company names
    
    
    // Sort data according to the specified company order
    chartData.sort((a, b) => {
      // Use companyName directly instead of extracting from category
      const companyA = a.companyName;
      const companyB = b.companyName;
      
      // Find positions in the companyOrder array
      const indexA = companyOrder.indexOf(companyA);
      const indexB = companyOrder.indexOf(companyB);
      
      // If both companies are in the order array, sort by that order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one company is in the order array, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // For companies not in the order array, maintain alphabetical order
      return companyA.localeCompare(companyB);
    });
    
    series.data.setAll(chartData);
    xAxis.data.setAll(chartData);
    
    // const scrollbarX = chart.set(
    //   "scrollbarX",
    //   am5.Scrollbar.new(root, {
    //     orientation: "horizontal",
    //     marginBottom: 20,
    //     marginTop: 0,
    //     minHeight: 5,
    //     paddingTop: 0,
    //     start: 0,
    //     end:1
    //     // end: chartData.length <= 10 ? 1 : 10 / chartData.length,
    //   })
    // );

    // scrollbarX.thumb.setAll({
    //   fill: am5.color(0x999999),
    // });
  
    root._logo?.dispose();
    
    // Create company color legend
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
        layout: root.horizontalLayout,
        marginTop: 0
      })
    );
    
    // Create legend items for each company with their designated colors
    const legendData = Object.entries(COMPANY_COLORS)
      .filter(([company]) => {
        // Only include companies that are present in the chart data
        return chartData.some(item => item.companyName === company);
      })
      .map(([company, color]) => ({
        name: company,
        color: am5.color(color)
      }));
    
    // Sort legend data according to the specified company order
    legendData.sort((a, b) => {
      const indexA = companyOrder.indexOf(a.name);
      const indexB = companyOrder.indexOf(b.name);
      
      // If both companies are in the order array, sort by that order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one company is in the order array, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // For companies not in the order array, maintain alphabetical order
      return a.name.localeCompare(b.name);
    });
    
    legend.data.setAll(legendData);
    
    legend.markers.template.setAll({
      width: 10,
      height: 10
    });
    
    legend.labels.template.setAll({
      fontSize: 10,
      fill: am5.color(0x000000)
    });
    
    // Enhanced animations
    series.appear(1000);
    chart.appear(1000, 100);
    
    // Update chart when expanded state changes
    const updateChartSize = () => {
      // Update scrollbar when chart is expanded/collapsed
      // if (scrollbarX) {
      //   scrollbarX.set("end", isExpanded || chartData.length <= 5 ? 1 : 5 / chartData.length);
      // }
      
      // Allow chart to reflow when container size changes
      root.resize();
    };

    // Set a timeout to ensure chart resizes after the animation completes
    if (isExpanded) {
      setTimeout(updateChartSize, 300);
    }
    
    return () => {
      root.dispose();
    };
  }, [data, chartId, isExpanded]);

  // Function to handle expanding/collapsing the chart
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div className={`transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50 bg-white shadow-2xl rounded-lg flex flex-col' : 'w-full'}`}>
      <Card className="w-full h-full flex  flex-col">
        <CardHeader className="p-1 pt-0 flex flex-row items-center justify-between">
          <CardTitle className="text-xs p-0">{title}</CardTitle>
          <Button
            onClick={toggleExpand}
            className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </CardHeader>
        <CardContent className={`p-0 relative ${isExpanded ? "h-[calc(100vh-12rem)]" : "h-[235px]"}`}>
          <div id={chartId} className={`${isExpanded ? 'h-full' : 'h-60'}`}></div>
        </CardContent>
      </Card>
      {isExpanded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 -z-10" onClick={toggleExpand}></div>
      )}
    </div>
  );
};
