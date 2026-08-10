// import React, { useEffect, useRef } from 'react';
// import { Card } from '@/@/components/ui/card';

// interface SalesData {
//     SalesArea_Name: string;
//   [key: string]: string | number;
// }

// const SalesAreaAvsHHeatmap: React.FC<{ data: SalesData[] }> = ({ data }) => {
//   const chartRef = useRef<HTMLDivElement>(null);
//   const rootRef = useRef<any>(null);

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

//       // Add vertical scrollbar to the right of the chart
//       const scrollbarY = chart.set("scrollbarY", am5.Scrollbar.new(root, {
//         orientation: "vertical",
//         marginRight: 10,
//         minWidth: 7,
//         end: data.length > 14 ? 0.04 : 1  // Initial position of the scrollbar grip (0 = top, 1 = bottom)
//       }));

//       // Customize scrollbar appearance if needed
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
//           categoryYField: "salesCategory",
//           valueField: "value"
//         })
//       );

//       series.columns.template.setAll({
//         tooltipText: "{salesCategory}, {monthCategory}: {value}%",
//         strokeOpacity: 1,
//         strokeWidth: 1,
//         width: am5.percent(100),
//         height: am5.percent(100),
//         templateField: "columnSettings"
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

//       const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
//       const processedData: any[] = [];
//       const salesareaCategories: string[] = [];

//       data.forEach(sales => {
//         salesareaCategories.push(sales.SalesArea_Name);
        
//         months.forEach(month => {
//           const actual = Number(sales[`${month}_actual`]);
//           const history = Number(sales[`${month}_history`]);
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
//             salesCategory: sales.SalesArea_Name,
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
//       yAxis.data.setAll(salesareaCategories.map(salesarea => ({ category: salesarea })));
//       xAxis.data.setAll(months.map(month => ({ category: month })));

//       chart.children.unshift(
//         am5.Label.new(root, {
//           text: "Sales area-wise Monthly Performance Variance for Actual vs History",
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

// export default SalesAreaAvsHHeatmap;


import React, { useEffect, useRef } from 'react';
import { Card } from '@/@/components/ui/card';
import GrowthRings from '../zone-heatmap/growthrings';

interface SalesData {
  SalesArea_Name: string;
  [key: string]: string | number;
}
interface GrowthIndicator {
  title: string;
  value: number;
}

interface Props {
  data: SalesData[];
  growthDetails: GrowthIndicator[];
  onCellClick?: (data: { salesArea: string; month: string; value: number }) => void;
  xaxisData: any;
}

const SalesAreaAvsHHeatmap: React.FC<Props> = ({ data, growthDetails,xaxisData, onCellClick }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<any>(null);
  const onCellClickRef = useRef(onCellClick);
  onCellClickRef.current = onCellClick;

  const calculateYearlyGrowth = (salesData: SalesData): number => {
    let totalActual = 0;
    let totalHistory = 0;
  
    Object.keys(salesData).forEach((key) => {
      if (key.includes("actual")) {
        const month = key.replace("_actual", "");
        const historyKey = `${month}_history`;
        
        if (salesData[historyKey] !== undefined) {
          totalActual += salesData[key] as number;
          totalHistory += salesData[historyKey] as number;
        }
      }
    });
  
    if (totalHistory === 0) return 0; // Avoid division by zero
  
    const growthPercentage = ((totalActual - totalHistory) / totalHistory) * 100;
    return parseFloat(growthPercentage.toFixed(2)); // Return growth rounded to 2 decimal places
  };

  useEffect(() => {
    const loadChart = async () => {
      const am5 = await import("@amcharts/amcharts5/index");
      const am5xy = await import("@amcharts/amcharts5/xy");
      const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");

      if (rootRef.current) {
        rootRef.current.dispose();
      }

      const root = am5.Root.new(chartRef.current!);
      rootRef.current = root;

      root.setThemes([am5themes_Animated.default.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: true,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingBottom: 10 // Increased padding to accommodate the legend
        })
      );

      root._logo?.dispose();

      const scrollbarY = chart.set("scrollbarY", am5.Scrollbar.new(root, {
        orientation: "vertical",
        marginRight: 10,
        minWidth: 7,
        end: data.length > 14 ? 0.04 : 1
      }));

      scrollbarY.thumb.setAll({
        fill: am5.color(0x999999)
      });

      const yRenderer = am5xy.AxisRendererY.new(root, {
        minGridDistance: 20,
        inversed: true,
      });

      yRenderer.labels.template.setAll({
        fontSize: 12,
        fontWeight: "600"
      });

      const xRenderer = am5xy.AxisRendererX.new(root, {
        minGridDistance: 30,
        opposite: true

      });

      // Basic x-axis label configuration
      xRenderer.labels.template.setAll({
        fontSize: 14,
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

      // Correct adapter syntax for x-axis labels
      xRenderer.labels.template.adapters.add("fill", (fill, target: any) => {
        const dataItem = target.dataItem;
        if (dataItem && dataItem.get("category") === "Total") {
          return am5.color(0x1a237e); // Dark blue color for Total
        }
        return am5.color(0x333333); // Default dark color for months
      });

      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          calculateAggregates: true,
          stroke: am5.color(0xffffff),
          clustered: false,
          xAxis: xAxis,
          yAxis: yAxis,
          categoryXField: "monthCategory",
          categoryYField: "salesAreaCategory",
          valueField: "value"
        })
      );

      series.columns.template.setAll({
        tooltipText: "{salesAreaCategory}, {monthCategory}: {value}%",
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
            salesArea: dataContext.salesAreaCategory,
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
            fontSize: 11,
            fontWeight: "600",
            fill: (dataItem?.dataContext as any)?.labelSettings?.fill || am5.color(0x000000),
          })
        });
      });

      const months = xaxisData || []; // ['Cum', 'Jan', 'Feb', 'Mar', 'Total'];
      const processedData: any[] = [];
      const salesAreaCategories: string[] = [];

      data.forEach(sales => {
        salesAreaCategories.push(sales.SalesArea_Name);
        
        // Process monthly data
        months.forEach(month => {
          const actual = Number(sales[`${month.split("_")[0]}_actual`]) || 0;
          const history = Number(sales[`${month.split("_")[0]}_history`]) || 0;
          
          // Calculate variance and round to 1 decimal place for display consistency
          let variance = 0;
          if (history !== 0) {
            variance = ((actual - history) / history * 100);
          }
          const roundedVariance = parseFloat(variance.toFixed(1));
          
          // Updated color logic based on variance - using strict comparison for zero case
          let color;
          if (roundedVariance === 0) {
            color = am5.color(0xB0B0B0); // Gray color for 0
          } else if (roundedVariance < 0) {
            color = am5.color(0xFFD5CF); // Light red for negative values
          } else {
            color = am5.color(0x9effc8); // Light green for positive values
          }

          // Determine text color: black for light backgrounds, white for dark backgrounds
          const textColor = am5.color(0x1111);

          processedData.push({
            monthCategory: month,
            salesAreaCategory: sales.SalesArea_Name,
            value: roundedVariance,
            columnSettings: {
              fill: color
            },
            labelSettings: {
              fill: textColor
            }
          });
        });

        // Add total column with the same color logic
        const totalVariance = calculateYearlyGrowth(sales);
        const roundedTotalVariance = parseFloat(totalVariance.toFixed(1));
        let totalColor;
        
        // Check if the total variance is exactly 0 or very close to 0
        if (roundedTotalVariance === 0) {
          totalColor = am5.color(0xB0B0B0); // Gray color for 0
        } else if (roundedTotalVariance < 0) {
          totalColor = am5.color(0xFFD5CF); // Light red for negative values
        } else {
          totalColor = am5.color(0x9EFFC8); // Light green for positive values
        }

        const totalTextColor = (roundedTotalVariance >= -5 && roundedTotalVariance <= 5) ? 
          am5.color(0x000000) : am5.color(0xFFFFFF);

        processedData.push({
          monthCategory: 'Total',
          salesAreaCategory: sales.SalesArea_Name,
          value: roundedTotalVariance,
          columnSettings: {
            fill: totalColor
          },
          labelSettings: {
            fill: totalTextColor
          }
        });
      });

      series.data.setAll(processedData);
      yAxis.data.setAll(salesAreaCategories.map(salesArea => ({ category: salesArea })));
      xAxis.data.setAll(months.map(month => ({ category: month })));

      chart.children.unshift(
        am5.Label.new(root, {
          // text: "Sales Area wise Monthly Performance Variance for Actual vs History",
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

    if (data && data.length > 0) {
      loadChart();
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
      }
    };
  }, [data, xaxisData]);

  return (
    <div className="w-full">
      {/* Title outside the chart */}
      <h2 className="text-sm font-bold">SalesArea wise Performance Variance for Actual vs Historical</h2>
      
      {/* Growth rings side by side */}
      <div className="flex flex-wrap">
        <GrowthRings growthDetails={growthDetails} />
      </div>
      
      {/* Chart below at full width */}
      <Card className="w-full p-2">
        <div 
          ref={chartRef} 
          className="h-[500px]"
          role="region"
          aria-label="Performance variance heatmap"
        />
      </Card>
    </div>
  );
};
export default SalesAreaAvsHHeatmap;