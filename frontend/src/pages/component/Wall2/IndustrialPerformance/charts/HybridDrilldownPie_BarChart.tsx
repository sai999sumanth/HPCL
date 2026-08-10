// import React, { useEffect, useState } from 'react';
// import * as am5 from '@amcharts/amcharts5';
// import * as am5xy from '@amcharts/amcharts5/xy';
// import * as am5percent from '@amcharts/amcharts5/percent';
// import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
// import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';

// interface Company {
//   category: string;
//   value: number;
// }

// interface SectorData {
//   category: string;
//   value: number;
//   sliceSettings: {
//     fill: am5.Color;
//   };
//   breakdown: Company[];
// }

// interface SectorBreakdownChartProps {
//   data: {
//     [sector: string]: {
//       [company: string]: number;
//     };
//   };
//   title: string;
// }

// export const SectorBreakdownChart: React.FC<SectorBreakdownChartProps> = ({ data, title }) => {
//   const chartId = `sector-breakdown-${title.replace(/\s+/g, '-').toLowerCase()}`;
//   const [currentSector, setCurrentSector] = useState<string | null>(null);
  
//   useEffect(() => {
//     // Create root
//     const root = am5.Root.new(chartId);
//     root.setThemes([am5themes_Animated.new(root)]);
    
//     // Format data for the chart
//     const sectorData: SectorData[] = [];
//     const breakdownData: { [key: string]: Company[] } = {};
    
//     // Process data for sectors and their companies
//     Object.entries(data).forEach(([sector, companies]) => {
//       // Calculate total value for the sector
//       let sectorTotal = 0;
//       const companyBreakdown: Company[] = [];
      
//       Object.entries(companies).forEach(([company, value]) => {
//         const numValue = parseFloat(value.toString());
//         sectorTotal += numValue;
//         companyBreakdown.push({
//           category: company,
//           value: numValue
//         });
//       });
      
//       // Sort company breakdown by value
//       companyBreakdown.sort((a, b) => b.value - a.value);
      
//       // Add sector to main data
//       sectorData.push({
//         category: sector,
//         value: sectorTotal,
//         sliceSettings: {
//           fill: getSectorColor(sector)
//         },
//         breakdown: companyBreakdown
//       });
      
//       breakdownData[sector] = companyBreakdown;
//     });
    
//     // Create wrapper container
//     const container = root.container.children.push(
//       am5.Container.new(root, {
//         width: am5.p100,
//         height: am5.p100,
//         layout: root.horizontalLayout
//       })
//     );
    
//     // Create column chart (left side)
//     const columnChart = container.children.push(
//       am5xy.XYChart.new(root, {
//         width: am5.p50,
//         panX: false,
//         panY: false,
//         wheelX: "none",
//         wheelY: "none",
//         layout: root.verticalLayout
//       })
//     );
    
//     // Create Y axis
//     const yRenderer = am5xy.AxisRendererY.new(root, {});
//     const yAxis = columnChart.yAxes.push(
//       am5xy.CategoryAxis.new(root, {
//         categoryField: "category",
//         renderer: yRenderer
//       })
//     );
    
//     yRenderer.grid.template.setAll({
//       location: 1
//     });
    
//     // Create X axis
//     const xAxis = columnChart.xAxes.push(
//       am5xy.ValueAxis.new(root, {
//         renderer: am5xy.AxisRendererX.new(root, {
//           strokeOpacity: 0.1
//         })
//       })
//     );
    
//     // Add series
//     const columnSeries = columnChart.series.push(
//       am5xy.ColumnSeries.new(root, {
//         name: "Companies",
//         xAxis: xAxis,
//         yAxis: yAxis,
//         valueXField: "value",
//         categoryYField: "category",
//         tooltip: am5.Tooltip.new(root, {
//           labelText: "{categoryY}: {valueX}%"
//         })
//       })
//     );
    
//     columnSeries.columns.template.setAll({
//       cornerRadiusTL: 3,
//       cornerRadiusTR: 3,
//       strokeOpacity: 0
//     });
    
//     // Add value labels
//     columnSeries.bullets.push(() => {
//       return am5.Bullet.new(root, {
//         locationX: 1,
//         sprite: am5.Label.new(root, {
//           text: "{valueX}%",
//           fill: root.interfaceColors.get("alternativeText"),
//           centerY: am5.p50,
//           centerX: am5.p50,
//           populateText: true,
//           fontSize: 10,
//           fontWeight: "400",
//           dx: 10
//         })
//       });
//     });
    
//     // Create pie chart (right side)
//     const pieChart = container.children.push(
//       am5percent.PieChart.new(root, {
//         width: am5.p50,
//         innerRadius: am5.percent(50)
//       })
//     );
    
//     // Create series
//     const pieSeries = pieChart.series.push(
//       am5percent.PieSeries.new(root, {
//         valueField: "value",
//         categoryField: "category",
//         templateField: "sliceSettings"
//       })
//     );
    
//     pieSeries.slices.template.setAll({
//       strokeOpacity: 0
//     });
    
//     // Add interactivity
//     let currentSlice: am5.Slice | null = null;
//     pieSeries.slices.template.on("active", function(active, slice) {
//       if (slice) {
//         if (currentSlice && currentSlice !== slice && active) {
//           currentSlice.set("active", false);
//         }
        
//         if (active) {
//           const sectorName = slice.dataItem?.get("category") as string;
//           setCurrentSector(sectorName);
          
//           const color = slice.get("fill");
          
//           // Find the sector data for this slice
//           const sliceData = sectorData.find(d => d.category === sectorName);
          
//           if (sliceData) {
//             // Update label with percentage
//             const percentValue = (slice.dataItem?.get("valuePercentTotal") || 0) * 100;
//             label1.set("text", `${percentValue.toFixed(1)}%`);
//             label1.set("fill", color);
            
//             // Update sector name
//             label2.set("text", sectorName);
            
//             // Update column colors
//             columnSeries.columns.template.setAll({
//               fill: color,
//               stroke: color
//             });
            
//             // Update column data
//             columnSeries.data.setAll(sliceData.breakdown);
//             yAxis.data.setAll(sliceData.breakdown);
//           }
          
//           currentSlice = slice;
//         }
//       }
//     });
    
//     pieSeries.labels.template.set("forceHidden", true);
//     pieSeries.ticks.template.set("forceHidden", true);
    
//     // Set initial data
//     pieSeries.data.setAll(sectorData);
    
//     // Add center labels
//     const label1 = pieChart.seriesContainer.children.push(
//       am5.Label.new(root, {
//         text: "",
//         fontSize: 35,
//         fontWeight: "bold",
//         centerX: am5.p50,
//         centerY: am5.p50
//       })
//     );
    
//     const label2 = pieChart.seriesContainer.children.push(
//       am5.Label.new(root, {
//         text: "",
//         fontSize: 12,
//         centerX: am5.p50,
//         centerY: am5.p50,
//         dy: 30
//       })
//     );
    
//     // Pre-select first slice
//     pieSeries.events.on("datavalidated", function() {
//       const firstSlice = pieSeries.slices.getIndex(0);
//       if (firstSlice) {
//         firstSlice.set("active", true);
//       }
//     });
    
//     // Make stuff animate on load
//     columnChart.appear(1000, 100);
//     pieChart.appear(1000, 100);
    
//     // Clean up
//     if (root._logo) {
//       root._logo.dispose();
//     }
    
//     return () => {
//       root.dispose();
//     };
//   }, [data, chartId]);
  
//   // Helper function to get color based on sector
//   function getSectorColor(sector: string): am5.Color {
//     switch (sector) {
//       case "MPSU":
//         return am5.color(0x2ECC40);
//       case "OTH PSU":
//         return am5.color(0xFFDC00);
//       case "PVT":
//         return am5.color(0x0074D9);
//       default:
//         return am5.color(0x7FDBFF);
//     }
//   }
  
//   return (
//     <Card className="w-full">
//       <CardHeader className="p-1">
//         <CardTitle className="text-xs p-0">{title}</CardTitle>
//       </CardHeader>
//       <CardContent className="pt-0">
//         <div id={chartId} className="h-96"></div>
//       </CardContent>
//     </Card>
//   );
// };