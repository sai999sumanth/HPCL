// // import React, { useEffect, useRef } from 'react';
// // import { Card } from '@/@/components/ui/card';

// // interface RegionData {
// //   Region_Name: string;
// //   [key: string]: string | number;
// // }

// // interface Props {
// //   data: RegionData[];
// //   onCellClick: (data: { region: string; month: string; value: number }) => void;
// // }

// // const RegionAvsHHeatmap: React.FC<Props> = ({ data, onCellClick }) => {
// //   const chartRef = useRef<HTMLDivElement>(null);
// //   const rootRef = useRef<any>(null);

// //   useEffect(() => {
// //     const loadChart = async () => {
// //       const am5 = await import("@amcharts/amcharts5/index");
// //       const am5xy = await import("@amcharts/amcharts5/xy");
// //       const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");

// //       if (rootRef.current) {
// //         rootRef.current.dispose();
// //       }

// //       const root = am5.Root.new(chartRef.current!);
// //       rootRef.current = root;

// //       root.setThemes([am5themes_Animated.default.new(root)]);

// //       const chart = root.container.children.push(
// //         am5xy.XYChart.new(root, {
// //           panY: true,
// //           layout: root.verticalLayout,
// //           paddingBottom: 0
// //         })
// //       );

// //       root._logo?.dispose();

// //       // Add vertical scrollbar to the right of the chart
// //       const scrollbarY = chart.set("scrollbarY", am5.Scrollbar.new(root, {
// //         orientation: "vertical",
// //         marginRight: 10,
// //         minWidth: 7,
// //         end: data.length > 14 ? 0.2 : 1  // Initial position of the scrollbar grip (0 = top, 1 = bottom)
// //       }));

// //       // Customize scrollbar appearance if needed
// //       scrollbarY.thumb.setAll({
// //         fill: am5.color(0x999999)
// //       });

// //       const yRenderer = am5xy.AxisRendererY.new(root, {
// //         minGridDistance: 20,
// //         inversed: true,
// //       });

// //       yRenderer.labels.template.setAll({
// //         fontSize: 10
// //       });

// //       const xRenderer = am5xy.AxisRendererX.new(root, {
// //         minGridDistance: 30
// //       });

// //       xRenderer.labels.template.setAll({
// //         fontSize: 10
// //       });

// //       const yAxis = chart.yAxes.push(
// //         am5xy.CategoryAxis.new(root, {
// //           categoryField: "category",
// //           renderer: yRenderer,
// //           tooltip: am5.Tooltip.new(root, {})
// //         })
// //       );

// //       const xAxis = chart.xAxes.push(
// //         am5xy.CategoryAxis.new(root, {
// //           categoryField: "category",
// //           renderer: xRenderer,
// //           tooltip: am5.Tooltip.new(root, {})
// //         })
// //       );

// //       const colors = {
// //         lowest: am5.color(0x7b0003),
// //         lower: am5.color(0xca0101),
// //         low: am5.color(0xe17a2d),
// //         medium: am5.color(0xffeb3b),
// //         high: am5.color(0x90c418),
// //         higher: am5.color(0x5dbe24),
// //         highest: am5.color(0x0b7d03)
// //       };

// //       const series = chart.series.push(
// //         am5xy.ColumnSeries.new(root, {
// //           calculateAggregates: true,
// //           stroke: am5.color(0xffffff),
// //           clustered: false,
// //           xAxis: xAxis,
// //           yAxis: yAxis,
// //           categoryXField: "monthCategory",
// //           categoryYField: "regionCategory",
// //           valueField: "value"
// //         })
// //       );

// //       series.columns.template.setAll({
// //         tooltipText: "{regionCategory}, {monthCategory}: {value}%",
// //         strokeOpacity: 1,
// //         strokeWidth: 1,
// //         width: am5.percent(100),
// //         height: am5.percent(100),
// //         templateField: "columnSettings",
// //         cursorOverStyle: "pointer"
// //       });

// //       series.columns.template.events.on("click", (e) => {
// //         const dataItem = e.target.dataItem;
// //         if (dataItem) {
// //           const dataContext = dataItem.dataContext as any;
// //           onCellClick({
// //             region: dataContext.regionCategory,
// //             month: dataContext.monthCategory,
// //             value: dataContext.value
// //           });
// //         }
// //       });

// //       series.bullets.push(function(root, series, dataItem) {
// //         return am5.Bullet.new(root, {
// //           locationX: 0.5,
// //           locationY: 0.5,
// //           sprite: am5.Label.new(root, {
// //             text: "{value}%",
// //             populateText: true,
// //             centerX: am5.p50,
// //             centerY: am5.p50,
// //             textAlign: "center",
// //             fontSize: 10,
// //             fontWeight: "500",
// //             fill: (dataItem?.dataContext as any)?.labelSettings?.fill || am5.color(0x000000),
// //           })
// //         });
// //       });

// //       const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
// //       const processedData: any[] = [];
// //       const regionCategories: string[] = [];

// //       data.forEach(region => {
// //         regionCategories.push(region.Region_Name);
        
// //         months.forEach(month => {
// //           const actual = Number(region[`${month}_actual`]);
// //           const history = Number(region[`${month}_history`]);
// //           const variance = ((actual - history) / history * 100);
          
// //           let color = colors.medium;
// //           if (variance <= -15) color = colors.lowest;
// //           else if (variance <= -10) color = colors.lower;
// //           else if (variance <= -5) color = colors.low;
// //           else if (variance <= 5) color = colors.medium;
// //           else if (variance <= 10) color = colors.high;
// //           else if (variance <= 15) color = colors.higher;
// //           else color = colors.highest;

// //           const textColor = (variance <= 5 && variance >= -5) ? 
// //             am5.color(0x000000) : am5.color(0xFFFFFF);

// //           processedData.push({
// //             monthCategory: month,
// //             regionCategory: region.Region_Name,
// //             value: parseFloat(variance.toFixed(1)),
// //             columnSettings: {
// //               fill: color
// //             },
// //             labelSettings: {
// //               fill: textColor
// //             }
// //           });
// //         });
// //       });

// //       series.data.setAll(processedData);
// //       yAxis.data.setAll(regionCategories.map(zone => ({ category: zone })));
// //       xAxis.data.setAll(months.map(month => ({ category: month })));

// //       chart.children.unshift(
// //         am5.Label.new(root, {
// //           text: "Region-wise Monthly Performance Variance for Actual vs History",
// //           fontSize: 14,
// //           fontWeight: "500",
// //           textAlign: "center",
// //           x: am5.p50,
// //           centerX: am5.p50,
// //           paddingTop: 0,
// //           paddingBottom: 10
// //         })
// //       );

// //       chart.appear(1000);
// //     };

// //     if (data && data.length > 0) {
// //       loadChart();
// //     }

// //     return () => {
// //       if (rootRef.current) {
// //         rootRef.current.dispose();
// //       }
// //     };
// //   }, [data]);

// //   return (
// //     <Card className="w-full p-4">
// //       <div 
// //         ref={chartRef} 
// //         className="h-[450px]"
// //         role="region"
// //         aria-label="Performance variance heatmap"
// //       />
// //     </Card>
// //   );
// // };

// // export default RegionAvsHHeatmap;

// import React, { useEffect, useRef } from 'react';
// import { Card } from '@/@/components/ui/card';

// interface RegionData {
//   Region_Name: string;
//   [key: string]: string | number;
// }

// interface Props {
//   data: RegionData[];
//   onCellClick: (data: { region: string; month: string; value: number }) => void;
// }

// const RegionAvsHHeatmap: React.FC<Props> = ({ data, onCellClick }) => {
//   const chartRef = useRef<HTMLDivElement>(null);
//   const rootRef = useRef<any>(null);

//   const calculateHistoryTotal = (regionData: RegionData) => {
//     const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
//     let total = 0;
//     let validValues = 0;

//     months.forEach(month => {
//       const actual = Number(regionData[`${month}_actual`]) || 0;
//       const history = Number(regionData[`${month}_history`]) || 0;
//       if (history !== 0) {
//         const variance = ((actual - history) / history * 100);
//         total += variance;
//         validValues++;
//       }
//     });

//     return validValues > 0 ? total / validValues : 0;
//   };

//   useEffect(() => {
//     const loadChart = async () => {
//       const am5 = await import("@amcharts/amcharts5/index");
//       const am5xy = await import("@amcharts/amcharts5/xy");
//       const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");

//       if (rootRef.current) {
//         rootRef.current.dispose();
//       }

//       const root = am5.Root.new(chartRef.current!);
//       rootRef.current = root;

//       root.setThemes([am5themes_Animated.default.new(root)]);

//       const chart = root.container.children.push(
//         am5xy.XYChart.new(root, {
//           panY: true,
//           layout: root.verticalLayout,
//           paddingBottom: 0
//         })
//       );

//       root._logo?.dispose();

//       const scrollbarY = chart.set("scrollbarY", am5.Scrollbar.new(root, {
//         orientation: "vertical",
//         marginRight: 10,
//         minWidth: 7,
//         end: data.length > 14 ? 0.2 : 1
//       }));

//       scrollbarY.thumb.setAll({
//         fill: am5.color(0x999999)
//       });

//       const yRenderer = am5xy.AxisRendererY.new(root, {
//         minGridDistance: 20,
//         inversed: true,
//       });

//       yRenderer.labels.template.setAll({
//         fontSize: 10
//       });

//       const xRenderer = am5xy.AxisRendererX.new(root, {
//         minGridDistance: 30
//       });

//       xRenderer.labels.template.setAll({
//         fontSize: 10
//       });

//       const yAxis = chart.yAxes.push(
//         am5xy.CategoryAxis.new(root, {
//           categoryField: "category",
//           renderer: yRenderer,
//           tooltip: am5.Tooltip.new(root, {})
//         })
//       );

//       const xAxis = chart.xAxes.push(
//         am5xy.CategoryAxis.new(root, {
//           categoryField: "category",
//           renderer: xRenderer,
//           tooltip: am5.Tooltip.new(root, {})
//         })
//       );

//       const colors = {
//         lowest: am5.color(0x7b0003),
//         lower: am5.color(0xca0101),
//         low: am5.color(0xe17a2d),
//         medium: am5.color(0xffeb3b),
//         high: am5.color(0x90c418),
//         higher: am5.color(0x5dbe24),
//         highest: am5.color(0x0b7d03)
//       };

//       const series = chart.series.push(
//         am5xy.ColumnSeries.new(root, {
//           calculateAggregates: true,
//           stroke: am5.color(0xffffff),
//           clustered: false,
//           xAxis: xAxis,
//           yAxis: yAxis,
//           categoryXField: "monthCategory",
//           categoryYField: "regionCategory",
//           valueField: "value"
//         })
//       );

//       series.columns.template.setAll({
//         tooltipText: "{regionCategory}, {monthCategory}: {value}%",
//         strokeOpacity: 1,
//         strokeWidth: 1,
//         width: am5.percent(100),
//         height: am5.percent(100),
//         templateField: "columnSettings",
//         cursorOverStyle: "pointer"
//       });

//       series.columns.template.events.on("click", (e) => {
//         const dataItem = e.target.dataItem;
//         if (dataItem) {
//           const dataContext = dataItem.dataContext as any;
//           onCellClick({
//             region: dataContext.regionCategory,
//             month: dataContext.monthCategory,
//             value: dataContext.value
//           });
//         }
//       });

//       series.bullets.push(function(root, series, dataItem) {
//         return am5.Bullet.new(root, {
//           locationX: 0.5,
//           locationY: 0.5,
//           sprite: am5.Label.new(root, {
//             text: "{value}%",
//             populateText: true,
//             centerX: am5.p50,
//             centerY: am5.p50,
//             textAlign: "center",
//             fontSize: 10,
//             fontWeight: "500",
//             fill: (dataItem?.dataContext as any)?.labelSettings?.fill || am5.color(0x000000),
//           })
//         });
//       });

//       const months = ['Total A vs H', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
//       const processedData: any[] = [];
//       const regionCategories: string[] = [];

//       data.forEach(region => {
//         regionCategories.push(region.Region_Name);
        
//         // Add Total A vs H column
//         const totalVariance = calculateHistoryTotal(region);
//         let totalColor = colors.medium;
//         if (totalVariance <= -15) totalColor = colors.lowest;
//         else if (totalVariance <= -10) totalColor = colors.lower;
//         else if (totalVariance <= -5) totalColor = colors.low;
//         else if (totalVariance <= 5) totalColor = colors.medium;
//         else if (totalVariance <= 10) totalColor = colors.high;
//         else if (totalVariance <= 15) totalColor = colors.higher;
//         else totalColor = colors.highest;

//         processedData.push({
//           monthCategory: 'Total A vs H',
//           regionCategory: region.Region_Name,
//           value: parseFloat(totalVariance.toFixed(1)),
//           columnSettings: {
//             fill: totalColor
//           },
//           labelSettings: {
//             fill: (totalVariance <= 5 && totalVariance >= -5) ? 
//               am5.color(0x000000) : am5.color(0xFFFFFF)
//           }
//         });
        
//         // Process monthly data
//         months.slice(1).forEach(month => {
//           const actual = Number(region[`${month}_actual`]);
//           const history = Number(region[`${month}_history`]);
//           const variance = ((actual - history) / history * 100);
          
//           let color = colors.medium;
//           if (variance <= -15) color = colors.lowest;
//           else if (variance <= -10) color = colors.lower;
//           else if (variance <= -5) color = colors.low;
//           else if (variance <= 5) color = colors.medium;
//           else if (variance <= 10) color = colors.high;
//           else if (variance <= 15) color = colors.higher;
//           else color = colors.highest;

//           const textColor = (variance <= 5 && variance >= -5) ? 
//             am5.color(0x000000) : am5.color(0xFFFFFF);

//           processedData.push({
//             monthCategory: month,
//             regionCategory: region.Region_Name,
//             value: parseFloat(variance.toFixed(1)),
//             columnSettings: {
//               fill: color
//             },
//             labelSettings: {
//               fill: textColor
//             }
//           });
//         });
//       });

//       series.data.setAll(processedData);
//       yAxis.data.setAll(regionCategories.map(zone => ({ category: zone })));
//       xAxis.data.setAll(months.map(month => ({ category: month })));

//       chart.children.unshift(
//         am5.Label.new(root, {
//           text: "Region-wise Monthly Performance Variance for Actual vs History",
//           fontSize: 14,
//           fontWeight: "500",
//           textAlign: "center",
//           x: am5.p50,
//           centerX: am5.p50,
//           paddingTop: 0,
//           paddingBottom: 10
//         })
//       );

//       chart.appear(1000);
//     };

//     if (data && data.length > 0) {
//       loadChart();
//     }

//     return () => {
//       if (rootRef.current) {
//         rootRef.current.dispose();
//       }
//     };
//   }, [data]);

//   return (
//     <Card className="w-full p-4">
//       <div 
//         ref={chartRef} 
//         className="h-[450px]"
//         role="region"
//         aria-label="Performance variance heatmap"
//       />
//     </Card>
//   );
// };

// export default RegionAvsHHeatmap;

import React, { useEffect, useRef } from 'react';
import { Card } from '@/@/components/ui/card';
import GrowthRings from '../zone-heatmap/growthrings';

interface RegionData {
  Region_Name: string;
  [key: string]: string | number;
}

interface GrowthIndicator {
  title: string;
  value: number;
}

interface Props {
  data: RegionData[];
  growthDetails: GrowthIndicator[];
  onCellClick: (data: { region: string; month: string; value: number }) => void;
  xaxisData: any;
}

const RegionAvsHHeatmap: React.FC<Props> = ({ data, xaxisData, growthDetails, onCellClick }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<any>(null);
  const chartIdRef = useRef<string>();
  if (!chartIdRef.current) {
    chartIdRef.current = `retail-region-avsh-${Math.random().toString(36).slice(2, 11)}`;
  }
  const chartId = chartIdRef.current;
  const onCellClickRef = useRef(onCellClick);
  onCellClickRef.current = onCellClick;
  const seriesRef = useRef<any>(null);
  const yAxisRef = useRef<any>(null);
  const xAxisRef = useRef<any>(null);
  const chartUiRef = useRef<any>(null);

  const calculateYearlyGrowth = (regionData: RegionData): number => {
    let totalActual = 0;
    let totalHistory = 0;
  
    Object.keys(regionData).forEach((key) => {
      if (key.includes("actual")) {
        const month = key.replace("_actual", "");
        const historyKey = `${month}_history`;
        
        if (regionData[historyKey] !== undefined) {
          totalActual += regionData[key] as number;
          totalHistory += regionData[historyKey] as number;
        }
      }
    });
  
    if (totalHistory === 0) return 0; // Avoid division by zero
  
    const growthPercentage = ((totalActual - totalHistory) / totalHistory) * 100;
    return parseFloat(growthPercentage.toFixed(2)); // Return growth rounded to 2 decimal places
  };

  useEffect(() => {
    if (!data?.length) {
      rootRef.current?.dispose();
      rootRef.current = null;
      seriesRef.current = null;
      yAxisRef.current = null;
      xAxisRef.current = null;
      chartUiRef.current = null;
      return;
    }

    let cancelled = false;
    const loadChart = async () => {
      const am5 = await import("@amcharts/amcharts5/index");
      const am5xy = await import("@amcharts/amcharts5/xy");
      const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");
      if (cancelled) return;

      const chartContainer = document.getElementById(chartId);
      if (!chartContainer) return;

      const months = xaxisData || [];
      const processedData: any[] = [];
      const regionCategories: string[] = [];

      data.forEach(region => {
        regionCategories.push(region.Region_Name);

        months.forEach(month => {
          const actual = Number(region[`${month.split("_")[0]}_actual`]) || 0;
          const history = Number(region[`${month.split("_")[0]}_history`]) || 0;

          let variance = 0;
          if (history !== 0) {
            variance = ((actual - history) / history * 100);
          }
          const roundedVariance = parseFloat(variance.toFixed(1));

          let color;
          if (roundedVariance === 0) {
            color = am5.color(0xB0B0B0);
          } else if (roundedVariance < 0) {
            color = am5.color(0xFFD5CF);
          } else {
            color = am5.color(0x9effc8);
          }

          const textColor = am5.color(0x1111);

          processedData.push({
            monthCategory: month,
            regionCategory: region.Region_Name,
            value: roundedVariance,
            columnSettings: {
              fill: color
            },
            labelSettings: {
              fill: textColor
            }
          });
        });

        const totalVariance = calculateYearlyGrowth(region);
        const roundedTotalVariance = parseFloat(totalVariance.toFixed(1));
        let totalColor;

        if (roundedTotalVariance === 0) {
          totalColor = am5.color(0xB0B0B0);
        } else if (roundedTotalVariance < 0) {
          totalColor = am5.color(0xFFD5CF);
        } else {
          totalColor = am5.color(0x9EFFC8);
        }

        const totalTextColor = (roundedTotalVariance >= -5 && roundedTotalVariance <= 5) ?
          am5.color(0x000000) : am5.color(0xFFFFFF);

        processedData.push({
          monthCategory: 'Total',
          regionCategory: region.Region_Name,
          value: roundedTotalVariance,
          columnSettings: {
            fill: totalColor
          },
          labelSettings: {
            fill: totalTextColor
          }
        });
      });

      if (cancelled) return;

      if (rootRef.current && seriesRef.current && yAxisRef.current && xAxisRef.current) {
        seriesRef.current.data.setAll(processedData);
        yAxisRef.current.data.setAll(regionCategories.map(region => ({ category: region })));
        xAxisRef.current.data.setAll(months.map(month => ({ category: month })));
        const sb = chartUiRef.current?.get("scrollbarY");
        if (sb) {
          sb.set("end", data.length > 14 ? 0.2 : 1);
        }
        return;
      }

      rootRef.current?.dispose();
      rootRef.current = null;
      seriesRef.current = null;
      yAxisRef.current = null;
      xAxisRef.current = null;
      chartUiRef.current = null;

      const root = am5.Root.new(chartId);
      rootRef.current = root;

      root.setThemes([am5themes_Animated.default.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: true,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingBottom: 10
        })
      );
      chartUiRef.current = chart;

      root._logo?.dispose();

      const scrollbarY = chart.set("scrollbarY", am5.Scrollbar.new(root, {
        orientation: "vertical",
        marginRight: 10,
        minWidth: 7,
        end: data.length > 14 ? 0.2 : 1
      }));

      scrollbarY.thumb.setAll({
        fill: am5.color(0x999999)
      });

      const yRenderer = am5xy.AxisRendererY.new(root, {
        minGridDistance: 20,
        inversed: true,
      });

      yRenderer.labels.template.setAll({
        fontSize: 10,
        fontWeight: "600"
      });

      const xRenderer = am5xy.AxisRendererX.new(root, {
        minGridDistance: 30,
        opposite: true

      });

      xRenderer.labels.template.setAll({
        fontSize: 12,
        fontWeight: "700"
      });

      const yAxis = chart.yAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "category",
          renderer: yRenderer,
          tooltip: am5.Tooltip.new(root, {})
        })
      );

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "category",
          renderer: xRenderer,
          tooltip: am5.Tooltip.new(root, {}),
        })
      );

      xRenderer.labels.template.adapters.add("fill", (fill, target: any) => {
        const dataItem = target.dataItem;
        if (dataItem && dataItem.get("category") === "Total") {
          return am5.color(0x1a237e);
        }
        return am5.color(0x2A004E);
      });

      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          calculateAggregates: true,
          stroke: am5.color(0xffffff),
          clustered: false,
          xAxis: xAxis,
          yAxis: yAxis,
          categoryXField: "monthCategory",
          categoryYField: "regionCategory",
          valueField: "value"
        })
      );

      seriesRef.current = series;
      yAxisRef.current = yAxis;
      xAxisRef.current = xAxis;

      series.columns.template.setAll({
        tooltipText: "{regionCategory}, {monthCategory}: {value}%",
        strokeOpacity: 1,
        strokeWidth: 1,
        width: am5.percent(100),
        height: am5.percent(100),
        templateField: "columnSettings",
        cursorOverStyle: "pointer"
      });

      series.columns.template.events.on("click", (e) => {
        const dataItem = e.target.dataItem;
        if (dataItem) {
          const dataContext = dataItem.dataContext as any;
          onCellClickRef.current?.({
            region: dataContext.regionCategory,
            month: dataContext.monthCategory,
            value: dataContext.value
          });
        }
      });

      series.bullets.push(function(root, series, dataItem) {
        return am5.Bullet.new(root, {
          locationX: 0.5,
          locationY: 0.5,
          sprite: am5.Label.new(root, {
            text: "{value}%",
            populateText: true,
            centerX: am5.p50,
            centerY: am5.p50,
            textAlign: "center",
            fontSize: 12,
            fontWeight: "600",
            fill: (dataItem?.dataContext as any)?.labelSettings?.fill || am5.color(0x000000),
          })
        });
      });

      series.data.setAll(processedData);
      yAxis.data.setAll(regionCategories.map(region => ({ category: region })));
      xAxis.data.setAll(months.map(month => ({ category: month })));

      chart.children.unshift(
        am5.Label.new(root, {
          fontSize: 14,
          fontWeight: "700",
          textAlign: "left",
          x: am5.p0,
          centerX: am5.p0,
          paddingTop: 0,
          paddingBottom: 10
        })
      );

      chart.appear(0);
    };

    loadChart();

    return () => {
      cancelled = true;
    };
  }, [data, xaxisData]);

  useEffect(() => {
    return () => {
      rootRef.current?.dispose();
      rootRef.current = null;
      seriesRef.current = null;
      yAxisRef.current = null;
      xAxisRef.current = null;
      chartUiRef.current = null;
    };
  }, []);
  return (
    <div className="w-full">
      {/* Title outside the chart */}
      <h2 className="text-sm font-bold">Region wise Performance Variance for Actual vs Historical</h2>
      
      {/* Growth rings side by side */}
      <div className="flex flex-wrap">
        <GrowthRings growthDetails={growthDetails} />
      </div>
      
      {/* Chart below at full width */}
      <Card className="w-full p-2">
        <div 
          id={chartId} 
          className="h-[500px]"
          role="region"
          aria-label="Performance variance heatmap"
        />
      </Card>
    </div>
  );
};

export default RegionAvsHHeatmap;