// import React, { useEffect, useRef } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';
// import { AgGridReact } from 'ag-grid-react';
// import MarketShareStackedBarChart from './marketshare_growth_stackedchart';

// interface HeatmapData {
//   category: string;
//   value: number;
//   [key: string]: any;
// }

// interface GridHeatmapProps {
//   data: any[];
//   level: string;
//   companies: string[];
// }

// const MarketShareHeatmap: React.FC<GridHeatmapProps> = ({ data, level, companies }) => {
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
//           panX: false,
//           panY: false,
//           wheelX: "none",
//           wheelY: "none",
//           layout: root.verticalLayout,
//           paddingBottom: 20,
//           paddingTop: 0,
//           paddingLeft: 0,
//           paddingRight: 0
//         })
//       );

//       root._logo?.dispose();

//       // Create axes
//       const yRenderer = am5xy.AxisRendererY.new(root, {
//         minGridDistance: 15,
//         inversed: true,
//       });

//       yRenderer.labels.template.setAll({
//         fontSize: 10,
//         paddingRight: 2
//       });

//       const xRenderer = am5xy.AxisRendererX.new(root, {
//         minGridDistance: 20,
//         opposite:true

//       });

//       xRenderer.labels.template.setAll({
//         fontSize: 10,
//         paddingTop: 2,
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
//           categoryField: "company",
//           renderer: xRenderer,
//           tooltip: am5.Tooltip.new(root, {})
//         })
//       );

//       // Define colors
//       const colors = {
//         lowest: am5.color(0x7b0003),
//         lower: am5.color(0xca0101),
//         low: am5.color(0xe17a2d),
//         medium: am5.color(0xfff59d),
//         high: am5.color(0x90c418),
//         higher: am5.color(0x5dbe24),
//         highest: am5.color(0x0b7d03)
//       };

//       // Create series
//       const series = chart.series.push(
//         am5xy.ColumnSeries.new(root, {
//           calculateAggregates: true,
//           stroke: am5.color(0xffffff),
//           clustered: false,
//           xAxis: xAxis,
//           yAxis: yAxis,
//           categoryXField: "company",
//           categoryYField: "category",
//           valueField: "value"
//         })
//       );

//       // Process data for heatmap
//       const processedData: any[] = [];
//       const categories: string[] = [];

//       data.forEach(item => {
//         categories.push(item[level]);
        
//         companies.forEach(company => {
//           const value = item["Market Share"]?.[company] || 0;
          
//           let color = colors.medium;
//           if (value <= 5) color = colors.lowest;
//           else if (value <= 10) color = colors.lower;
//           else if (value <= 15) color = colors.low;
//           else if (value <= 20) color = colors.medium;
//           else if (value <= 25) color = colors.high;
//           else if (value <= 30) color = colors.higher;
//           else color = colors.highest;

//           const textColor = (value <= 20 && value >= 10) ? 
//             am5.color(0x000000) : am5.color(0xFFFFFF);

//           processedData.push({
//             company: company,
//             category: item[level],
//             value: parseFloat(value.toFixed(1)),
//             columnSettings: {
//               fill: color
//             },
//             labelSettings: {
//               fill: textColor
//             }
//           });
//         });
//       });

//       // Configure series
//       series.columns.template.setAll({
//         tooltipText: "{category}, {company}: {value}%",
//         strokeOpacity: 1,
//         strokeWidth: 0.5,
//         width: am5.percent(100),
//         height: am5.percent(100),
//         templateField: "columnSettings"
//       });

//       // Add value labels
//       series.bullets.push(function(root) {
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
//             templateField: "labelSettings"
//           })
//         });
//       });
//       // Add vertical scrollbar to the right of the chart
//       const scrollbarY = chart.set("scrollbarY", am5.Scrollbar.new(root, {
//         orientation: "vertical",
//         marginRight: 10,
//         minWidth: 7,
//         end: data.length >6 ? 0.5 : 1  // Initial position of the scrollbar grip (0 = top, 1 = bottom)
//       }));

//       // Customize scrollbar appearance if needed
//       scrollbarY.thumb.setAll({
//         fill: am5.color(0x999999)
//       });


//       // Set data
//       series.data.setAll(processedData);
//       yAxis.data.setAll(categories.map(cat => ({ category: cat })));
//       xAxis.data.setAll(companies.map(company => ({ company })));

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
//   }, [data, companies, level]);

//   return (
//     <div 
//       ref={chartRef} 
//       className="h-[300px]"
//       role="region"
//       aria-label="Market share heatmap"
//     />
//   );
// };

// const MarketShareGridWithHeatmap: React.FC<{
//   level: string;
//   data: any[];
//   companies: string[];
//   columnDefs: any[];
//   title: string;
// }> = ({ level, data, companies, columnDefs, title }) => {
//   const levelTitle = level.replace(/_/g, ' ').toUpperCase();
//   return (
//     <div className="space-y-2">
//       <Card className="w-full">
//         <CardHeader className="p-2">
//           <CardTitle className="text-sm">{title}</CardTitle>
//         </CardHeader>
//         <CardContent className="p-2">
//           <div className="ag-theme-alpine h-[270px] w-full">
//             <AgGridReact
//               columnDefs={columnDefs}
//               rowData={data}
//               defaultColDef={{
//                 sortable: true,
//                 filter: true,
//                 resizable: true,
//                 minWidth: 100,
//                 flex: 1,
//                 headerClass: "text-xs",
//                 cellClass: "text-xs"
//               }}
//               rowHeight={32}
//               headerHeight={32}
//               onGridReady={(params) => {
//                 params.api.sizeColumnsToFit();
//               }}
//             />
//           </div>
//         </CardContent>
//       </Card>

//       <Card className="w-full">
//         <CardHeader className="p-2">
//           <CardTitle className="text-xs">{levelTitle} Market Share Distribution</CardTitle>
//         </CardHeader>
//         <CardContent className="p-2">
//           <MarketShareHeatmap 
//             data={data}
//             level={level}
//             companies={companies}
//           />
//         </CardContent>
//       </Card>

//       <Card className="w-full">
//         <CardHeader className="p-2">
//           <CardTitle className="text-xs">{levelTitle} Market Share and Growth Analysis</CardTitle>
//         </CardHeader>
//         <CardContent className="p-2">
//           <MarketShareStackedBarChart 
//             data={data}
//             level={level}
//             companies={companies}
//           />
//         </CardContent>
//       </Card>
//     </div>
//   );
// };


// export default MarketShareGridWithHeatmap;

// import React, { useEffect, useRef } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';
// import { AgGridReact } from 'ag-grid-react';
// import MarketShareStackedBarChart from './marketshare_growth_stackedchart';

// interface HeatmapData {
//   category: string;
//   value: number;
//   [key: string]: any;
// }

// interface GridHeatmapProps {
//   data: any[];
//   level: string;
//   companies: string[];
// }

// const NoDataMessage = () => (
//   <div 
//     style={{ 
//       width: '100%', 
//       height: '100%', 
//       display: 'flex', 
//       alignItems: 'center', 
//       justifyContent: 'center',
//       color: '#666',
//       fontWeight: 500,
//       fontSize: '14px',
//       backgroundColor: '#0000',
//       borderRadius: '4px'
//     }}
//   >
//     No data available
//   </div>
// );

// const MarketShareHeatmap: React.FC<GridHeatmapProps> = ({ data, level, companies }) => {
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
//           panX: false,
//           panY: false,
//           wheelX: "none",
//           wheelY: "none",
//           layout: root.verticalLayout,
//           paddingBottom: 20,
//           paddingTop: 0,
//           paddingLeft: 0,
//           paddingRight: 0
//         })
//       );

//       root._logo?.dispose();

//       // Create axes
//       const yRenderer = am5xy.AxisRendererY.new(root, {
//         minGridDistance: 15,
//         inversed: true,
//       });

//       yRenderer.labels.template.setAll({
//         fontSize: 10,
//         paddingRight: 2
//       });

//       const xRenderer = am5xy.AxisRendererX.new(root, {
//         minGridDistance: 20,
//         opposite:true

//       });

//       xRenderer.labels.template.setAll({
//         fontSize: 10,
//         paddingTop: 2,
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
//           categoryField: "company",
//           renderer: xRenderer,
//           tooltip: am5.Tooltip.new(root, {})
//         })
//       );

//       // Define colors
//       const colors = {
//         lowest: am5.color(0x7b0003),
//         lower: am5.color(0xca0101),
//         low: am5.color(0xe17a2d),
//         medium: am5.color(0xfff59d),
//         high: am5.color(0x90c418),
//         higher: am5.color(0x5dbe24),
//         highest: am5.color(0x0b7d03)
//       };

//       // Create series
//       const series = chart.series.push(
//         am5xy.ColumnSeries.new(root, {
//           calculateAggregates: true,
//           stroke: am5.color(0xffffff),
//           clustered: false,
//           xAxis: xAxis,
//           yAxis: yAxis,
//           categoryXField: "company",
//           categoryYField: "category",
//           valueField: "value"
//         })
//       );

//       // Process data for heatmap
//       const processedData: any[] = [];
//       const categories: string[] = [];

//       data.forEach(item => {
//         categories.push(item[level]);
        
//         companies.forEach(company => {
//           const value = item["Market Share"]?.[company] || 0;
          
//           let color = colors.medium;
//           if (value <= 5) color = colors.lowest;
//           else if (value <= 10) color = colors.lower;
//           else if (value <= 15) color = colors.low;
//           else if (value <= 20) color = colors.medium;
//           else if (value <= 25) color = colors.high;
//           else if (value <= 30) color = colors.higher;
//           else color = colors.highest;

//           const textColor = (value <= 20 && value >= 10) ? 
//             am5.color(0x000000) : am5.color(0xFFFFFF);

//           processedData.push({
//             company: company,
//             category: item[level],
//             value: parseFloat(value.toFixed(1)),
//             columnSettings: {
//               fill: color
//             },
//             labelSettings: {
//               fill: textColor
//             }
//           });
//         });
//       });

//       // Configure series
//       series.columns.template.setAll({
//         tooltipText: "{category}, {company}: {value}%",
//         strokeOpacity: 1,
//         strokeWidth: 0.5,
//         width: am5.percent(100),
//         height: am5.percent(100),
//         templateField: "columnSettings"
//       });

//       // Add value labels
//       series.bullets.push(function(root) {
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
//             templateField: "labelSettings"
//           })
//         });
//       });
//       // Add vertical scrollbar to the right of the chart
//       const scrollbarY = chart.set("scrollbarY", am5.Scrollbar.new(root, {
//         orientation: "vertical",
//         marginRight: 10,
//         minWidth: 7,
//         end: data.length >6 ? 0.5 : 1  // Initial position of the scrollbar grip (0 = top, 1 = bottom)
//       }));

//       // Customize scrollbar appearance if needed
//       scrollbarY.thumb.setAll({
//         fill: am5.color(0x999999)
//       });


//       // Set data
//       series.data.setAll(processedData);
//       yAxis.data.setAll(categories.map(cat => ({ category: cat })));
//       xAxis.data.setAll(companies.map(company => ({ company })));

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
//   }, [data, companies, level]);

//   // Show "No data available" message if data is empty
//   if (!data || data.length === 0) {
//     return <NoDataMessage />;
//   }

//   return (
//     <div 
//       ref={chartRef} 
//       className="h-[300px]"
//       role="region"
//       aria-label="Market share heatmap"
//     />
//   );
// };

// const MarketShareGridWithHeatmap: React.FC<{
//   level: string;
//   data: any[];
//   companies: string[];
//   columnDefs: any[];
//   title: string;
// }> = ({ level, data, companies, columnDefs, title }) => {
//   const levelTitle = level.replace(/_/g, ' ').toUpperCase();
//   const hasData = data && data.length > 0;
  
//   return (
//     <div className="space-y-2">
//       <Card className="w-full">
//         <CardHeader className="p-2">
//           <CardTitle className="text-sm">{title}</CardTitle>
//         </CardHeader>
//         <CardContent className="p-2">
//           {hasData ? (
//             <div className="ag-theme-alpine h-[270px] w-full">
//               <AgGridReact
//                 columnDefs={columnDefs}
//                 rowData={data}
//                 defaultColDef={{
//                   sortable: true,
//                   filter: true,
//                   resizable: true,
//                   minWidth: 100,
//                   flex: 1,
//                   headerClass: "text-xs",
//                   cellClass: "text-xs"
//                 }}
//                 rowHeight={32}
//                 headerHeight={32}
//                 onGridReady={(params) => {
//                   params.api.sizeColumnsToFit();
//                 }}
//               />
//             </div>
//           ) : (
//             <div className="h-[270px]">
//               <NoDataMessage />
//             </div>
//           )}
//         </CardContent>
//       </Card>

//       <Card className="w-full">
//         <CardHeader className="p-2">
//           <CardTitle className="text-xs">{levelTitle} Market Share Distribution</CardTitle>
//         </CardHeader>
//         <CardContent className="p-2 h-[300px]">
//           {hasData ? (
//             <MarketShareHeatmap 
//               data={data}
//               level={level}
//               companies={companies}
//             />
//           ) : (
//             <NoDataMessage />
//           )}
//         </CardContent>
//       </Card>

//       <Card className="w-full">
//         <CardHeader className="p-2">
//           <CardTitle className="text-xs">{levelTitle} Market Share and Growth Analysis</CardTitle>
//         </CardHeader>
//         <CardContent className="p-2 h-[400px]">
//           <MarketShareStackedBarChart 
//             data={data}
//             level={level}
//             companies={companies}
//           />
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default MarketShareGridWithHeatmap;




import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';
import { AgGridReact } from 'ag-grid-react';
import MarketShareStackedBarChart from './marketshare_growth_stackedchart';

interface HeatmapData {
  category: string;
  value: number;
  [key: string]: any;
}

interface GridHeatmapProps {
  data: any[];
  level: string;
  companies: string[];
}

const NoDataMessage = () => (
  <div 
    style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: '#666',
      fontWeight: 500,
      fontSize: '14px',
      backgroundColor: '#0000',
      borderRadius: '4px'
    }}
  >
    No data available
  </div>
);

const MarketShareHeatmap: React.FC<GridHeatmapProps> = ({ data, level, companies }) => {
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
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingBottom: 20,
          paddingTop: 0,
          paddingLeft: 0,
          paddingRight: 0
        })
      );

      root._logo?.dispose();

      // Create axes
      const yRenderer = am5xy.AxisRendererY.new(root, {
        minGridDistance: 15,
        inversed: true,
      });

      yRenderer.labels.template.setAll({
        fontSize: 10,
        paddingRight: 2
      });

      const xRenderer = am5xy.AxisRendererX.new(root, {
        minGridDistance: 20,
        opposite:true
      });

      xRenderer.labels.template.setAll({
        fontSize: 10,
        paddingTop: 2,
      });
      const maxValue = Math.max(...data.map((item) => item.value))
      const yAxisMax = Math.ceil(maxValue * 1.2)
  
      const yAxis = chart.yAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "category",
          renderer: yRenderer,
          tooltip: am5.Tooltip.new(root, {})
        })
      );

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "company",
          renderer: xRenderer,
          tooltip: am5.Tooltip.new(root, {})
        })
      );


      // Create series
      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          calculateAggregates: true,
          stroke: am5.color(0xffffff),
          clustered: false,
          xAxis: xAxis,
          yAxis: yAxis,
          categoryXField: "company",
          categoryYField: "category",
          valueField: "value"
        })
      );

      // Process data for heatmap
      const processedData: any[] = [];
      const categories: string[] = [];

      data.forEach(item => {
        categories.push(item[level]);
        
        companies.forEach(company => {
          const value = item["Market Share"]?.[company] || 0;
          
          // let color = colors.medium;
          // if (value <= 5) color = colors.lowest;
          // else if (value <= 10) color = colors.lower;
          // else if (value <= 15) color = colors.low;
          // else if (value <= 20) color = colors.medium;
          // else if (value <= 25) color = colors.high;
          // else if (value <= 30) color = colors.higher;
          // else color = colors.highest;

          let color;
          if (value === 0) {
            color = am5.color(0xB0B0B0); // Gray color for 0
          } else if (value < 0) {
            color = am5.color(0xFFD5CF); // Light red for negative values
          } else {
            color = am5.color(0x9EFFC8); // Light green for positive values
          }

          const textColor = am5.color(0x000000);

          processedData.push({
            company: company,
            category: item[level],
            value: parseFloat(value.toFixed(2)),
            columnSettings: {
              fill: color
            },
            labelSettings: {
              fill: textColor
            }
          });
        });
      });

      // Configure series
      series.columns.template.setAll({
        tooltipText: "{category}, {company}: {value}%",
        strokeOpacity: 1,
        strokeWidth: 0.5,
        width: am5.percent(100),
        height: am5.percent(100),
        templateField: "columnSettings"
      });

      // Add value labels
      series.bullets.push(function(root) {
        return am5.Bullet.new(root, {
          locationX: 0.5,
          locationY: 0.5,
          sprite: am5.Label.new(root, {
            text: "{value}%",
            populateText: true,
            centerX: am5.p50,
            centerY: am5.p50,
            textAlign: "center",
            fontSize: 10,
            fontWeight: "500",
            templateField: "labelSettings"
          })
        });
      });
      // Add vertical scrollbar to the right of the chart
      const scrollbarY = chart.set("scrollbarY", am5.Scrollbar.new(root, {
        orientation: "vertical",
        marginRight: 10,
        minWidth: 7,
        end: data.length >6 ? 0.5 : 1  // Initial position of the scrollbar grip (0 = top, 1 = bottom)
      }));

      // Customize scrollbar appearance if needed
      scrollbarY.thumb.setAll({
        fill: am5.color(0x999999)
      });

      // Set data
      series.data.setAll(processedData);
      yAxis.data.setAll(categories.map(cat => ({ category: cat })));
      xAxis.data.setAll(companies.map(company => ({ company })));

      chart.appear(1000);
    };

    if (data && data.length > 0) {
      loadChart();
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
      }
    };
  }, [data, companies, level]);

  // Show "No data available" message if data is empty
  if (!data || data.length === 0) {
    return <NoDataMessage />;
  }

  return (
    <div 
      ref={chartRef} 
      className="h-[300px]"
      role="region"
      aria-label="Market share heatmap"
    />
  );
};

const MarketShareGridWithHeatmap: React.FC<{
  level: string;
  data: any[];
  companies: string[];
  columnDefs: any[];
  gridTitle: string;
  heatmapTitle: string;
  stackedChartTitle: string;
  filterInfo: string;
}> = ({ 
  level, 
  data, 
  companies, 
  columnDefs, 
  gridTitle, 
  heatmapTitle, 
  stackedChartTitle,
  filterInfo 
}) => {
  const hasData = data && data.length > 0;
  
  return (
    <div className="space-y-2">
      <Card className="w-full">
        <CardHeader className="p-2">
          <CardTitle className="text-sm">{gridTitle}{filterInfo}</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {hasData ? (
            <div className="ag-theme-alpine h-[270px] w-full">
              <AgGridReact
                columnDefs={columnDefs}
                rowData={data}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  minWidth: 100,
                  flex: 1,
                  headerClass: "text-xs",
                  cellClass: "text-xs"
                }}
                rowHeight={32}
                headerHeight={32}
                onGridReady={(params) => {
                  params.api.sizeColumnsToFit();
                }}
              />
            </div>
          ) : (
            <div className="h-[270px]">
              <NoDataMessage />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="p-2">
          <CardTitle className="text-xs">{heatmapTitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 h-[300px]">
          {hasData ? (
            <MarketShareHeatmap 
              data={data}
              level={level}
              companies={companies}
            />
          ) : (
            <NoDataMessage />
          )}
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="p-2">
          <CardTitle className="text-xs">{stackedChartTitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 h-[400px]">
          <MarketShareStackedBarChart 
            data={data}
            level={level}
            companies={companies}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketShareGridWithHeatmap;