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

// const RegionAvsTHeatmap: React.FC<Props> = ({ data, onCellClick }) => {
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
//         end: data.length > 14 ? 1 : 0.2 // Initial position of the scrollbar grip (0 = top, 1 = bottom)
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
//           categoryYField: "zoneCategory",
//           valueField: "value"
//         })
//       );

//       series.columns.template.setAll({
//         tooltipText: "{zoneCategory}, {monthCategory}: {value}%",
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
//       const regionCategories: string[] = [];

//       data.forEach(region => {
//         regionCategories.push(region.Region_Name);
        
//         months.forEach(month => {
//           const actual = Number(region[`${month}_actual`]);
//           const target = Number(region[`${month}_history`]);
//           const variance = ((actual - target) / target * 100);
          
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
//             zoneCategory: region.Region_Name,
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
//           text: "Region-wise Monthly Performance Variance for Actual vs Target",
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

// export default RegionAvsTHeatmap;
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

const RegionAvsTHeatmap: React.FC<Props> = ({ data, xaxisData, growthDetails, onCellClick }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<any>(null);

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
          panY: true,
          layout: root.verticalLayout,
          paddingBottom: 10
        })
      );

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
        fontWeight: "600"
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
          tooltip: am5.Tooltip.new(root, {})
        })
      );

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

      series.columns.template.setAll({
        tooltipText: "{regionCategory}, {monthCategory}: {value}%",
        strokeOpacity: 1,
        strokeWidth: 1,
        width: am5.percent(100),
        height: am5.percent(100),
        templateField: "columnSettings"
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

      // Add Total A vs T calculation function
      const calculateTargetTotal = (regionData: RegionData) => {
        const months = xaxisData; // ['Cum', 'Jan', 'Feb', 'Mar'];
        let total = 0;
        let validValues = 0;

        months.forEach(month => {
          const actual = Number(regionData[`${month.split("_")[0]}_actual`]) || 0;
          const target = Number(regionData[`${month.split("_")[0]}_target`]) || 0;
          if (target !== 0) {
            const variance = ((actual - target) / target * 100);
            total += variance;
            validValues++;
          }
        });

        return validValues > 0 ? total / validValues : 0;
      };

      const months = xaxisData; // ['Cum', 'Jan', 'Feb', 'Mar'];
      const processedData: any[] = [];
      const regionCategories: string[] = [];

      data.forEach(region => {
        regionCategories.push(region.Region_Name);
        
        // Process monthly data
        months.forEach(month => {
          let variance: number;
          let actual: number;
          let target: number;

          if (month === 'Total') {
            variance = calculateTargetTotal(region);
          } else {
            actual = Number(region[`${month.split("_")[0]}_actual`]);
            target = Number(region[`${month.split("_")[0]}_target`]);
            variance = target !== 0 ? ((actual - target) / target * 100) : (actual > 0 ? 100 : 0);
          }
          
          let color;
          if (variance === 0) {
            color = am5.color(0xB0B0B0); // Gray color for 0
          } else if (variance < 0) {
            color = am5.color(0xFFD5CF); // Light red for negative values
          } else {
            color = am5.color(0x9effc8); // Light green for positive values
          }

          const textColor = am5.color(0x000000);

          processedData.push({
            monthCategory: month,
            regionCategory: region.Region_Name,
            value: parseFloat(variance.toFixed(1)),
            columnSettings: {
              fill: color
            },
            labelSettings: {
              fill: textColor
            }
          });
        });
      });

      series.data.setAll(processedData);
      yAxis.data.setAll(regionCategories.map(region => ({ category: region })));
      xAxis.data.setAll(months.map(month => ({ category: month })));

      chart.children.unshift(
        am5.Label.new(root, {
          // text: "Region-wise Monthly Performance Variance for Actual vs Target",
          fontSize: 14,
          fontWeight: "600",
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
      <h2 className="text-sm font-bold">Region wise Performance Variance for Actual vs Target</h2>
      
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

export default RegionAvsTHeatmap;