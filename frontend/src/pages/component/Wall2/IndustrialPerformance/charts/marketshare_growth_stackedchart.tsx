
// import React, { useEffect, useRef } from 'react';

// interface StackedBarChartProps {
//   data: any[];
//   level: string;
//   companies: string[];
// }

// const MarketShareStackedBarChart: React.FC<StackedBarChartProps> = ({ data, level, companies }) => {
//   const chartRef = useRef<HTMLDivElement>(null);
//   const rootRef = useRef<any>(null);

//   // Function to format level name for display
//   const formatLevelName = (level: string): string => {
//     // Convert snake_case to Title Case
//     return level.split('_')
//       .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//       .join(' ');
//   };

//   useEffect(() => {
//     const loadChart = async () => {
//       try {
//         console.log('Loading chart with data:', { data, level, companies });

//         const am5 = await import("@amcharts/amcharts5/index");
//         const am5xy = await import("@amcharts/amcharts5/xy");
//         const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");

//         // Clean up existing chart
//         if (rootRef.current) {
//           rootRef.current.dispose();
//         }

//         if (!chartRef.current) {
//           console.error('Chart container not found');
//           return;
//         }

//         // Create root
//         const root = am5.Root.new(chartRef.current);
//         rootRef.current = root;

//         // Set themes
//         root.setThemes([am5themes_Animated.default.new(root)]);

//         // Create chart
//         const chart = root.container.children.push(
//           am5xy.XYChart.new(root, {
//             paddingRight: 20,
//             paddingLeft: 0,
//             paddingTop: 0, // Added padding for legend
//             layout: root.verticalLayout // Ensure proper layout with legend
//           })
//         );

//         // Process data
//         const processedData = data.map(item => {
//           const rowData: any = {
//             category: item[level]
//           };
          
//           companies.forEach(company => {
//             const marketShare = item["Market Share"]?.[company] || 0;
//             const growth = item["Growth"]?.[company] || 0;
//             rowData[`MarketShare_${company}`] = parseFloat(marketShare.toFixed(2));
//             rowData[`Growth_${company}`] = parseFloat(growth.toFixed(2));
//           });
          
//           return rowData;
//         });

//         // Add scrollbar
//         chart.set("scrollbarX", am5.Scrollbar.new(root, {
//           orientation: "horizontal",
//           marginBottom: 20
//         }));

//         // Create axes
//         const xAxis = chart.xAxes.push(
//           am5xy.CategoryAxis.new(root, {
//             categoryField: "category",
//             renderer: am5xy.AxisRendererX.new(root, {
//               minGridDistance: 30
//             }),
//             tooltip: am5.Tooltip.new(root, {})
//           })
//         );

//         xAxis.get("renderer").labels.template.setAll({
//           rotation: 0,
//           centerY: am5.p50,
//           centerX: am5.p50,
//           paddingTop: 8,
//           paddingBottom: 2,
//           fontSize: 10,
//           maxWidth: 120,
//           oversizedBehavior: "truncate",
//           textAlign: "center"
//         });

//         // Use the level prop to dynamically set the x-axis label
//         xAxis.children.push(
//           am5.Label.new(root, {
//             text: formatLevelName(level), // Format the level name for display
//             x: am5.p50,
//             centerX: am5.p50,
//             paddingTop: 0,
//             fontSize: 10,
//           })
//         );

//         const yAxis = chart.yAxes.push(
//           am5xy.ValueAxis.new(root, {
//             renderer: am5xy.AxisRendererY.new(root, {})
//           })
//         );

//         yAxis.get("renderer").labels.template.setAll({
//           rotation: 0,
//           centerY: am5.p50,
//           centerX: am5.p50,
//           paddingTop: 8,
//           paddingBottom: 2,
//           fontSize: 10,
//           maxWidth: 120,
//           oversizedBehavior: "truncate",
//           textAlign: "center"
//         });

//         yAxis.children.unshift(
//           am5.Label.new(root, {
//             rotation: -90,
//             text: "Percentage (%)",
//             y: am5.p50,
//             centerX: am5.p50,
//             fontSize: 10,
//             paddingBottom: 0
//           })
//         );

//         // Add legend before setting data
//         const legend = chart.children.push(
//           am5.Legend.new(root, {
//             centerX: am5.p50,
//             x: am5.p50,
//             marginBottom: 0,
//             paddingTop: 0
//           })
//         );
//         legend.labels.template.setAll({
//             textAlign: "center",
//             fill: am5.color(0x000000),
//             fontSize: 10,
//           });
      
//           // Disable legend marker interactions
//           legend.markers.template.setAll({
//             width: 16,
//             height: 16,
//           });

//         xAxis.data.setAll(processedData);
//         root._logo?.dispose();

//         // Create series for each metric and company
//         companies.forEach((company, index) => {
//           // Market Share series
//           const marketShareSeries = chart.series.push(
//             am5xy.ColumnSeries.new(root, {
//               name: `${company} Market Share`,
//               xAxis: xAxis,
//               yAxis: yAxis,
//               valueYField: `MarketShare_${company}`,
//               categoryXField: "category",
//               clustered: true,
//               tooltip: am5.Tooltip.new(root, {
//                 labelText: `[fontSize:10px bold]${company} Market Share: {valueY}%`
//               })
//             })
//           );

//           // Add column template with border radius
//           marketShareSeries.columns.template.setAll({
//             cornerRadiusTL: 4,
//             cornerRadiusTR: 4,
//             strokeOpacity: 0,
//             // fillOpacity: 0.8
//           });

//           marketShareSeries.data.setAll(processedData);

//           // Growth series
//           const growthSeries = chart.series.push(
//             am5xy.ColumnSeries.new(root, {
//               name: `${company} Growth`,
//               xAxis: xAxis,
//               yAxis: yAxis,
//               valueYField: `Growth_${company}`,
//               categoryXField: "category",
//               clustered: true,
//               tooltip: am5.Tooltip.new(root, {
//                 labelText: `[fontSize:10px bold]${company} Growth: {valueY}%`
//               })
//             })
//           );

//         //   Add column template with border radius
//           growthSeries.columns.template.setAll({
//             cornerRadiusTL: 4,
//             cornerRadiusTR: 4,
//             strokeOpacity: 0,
//             // fillOpacity: 0.8
//           });

//           growthSeries.data.setAll(processedData);
//         });

//         legend.data.setAll(chart.series.values);

//         // Add cursor
//         chart.set("cursor", am5xy.XYCursor.new(root, {}));

//         // Make stuff animate on load
//         chart.appear(1000, 100);

//         console.log('Chart setup complete');
//       } catch (error) {
//         console.error('Error creating chart:', error);
//       }
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
//       style={{ width: '100%', height: '400px' }}
//     />
//   );
// };

// export default MarketShareStackedBarChart;

// import React, { useEffect, useRef } from 'react';

// interface StackedBarChartProps {
//   data: any[];
//   level: string;
//   companies: string[];
// }

// const MarketShareStackedBarChart: React.FC<StackedBarChartProps> = ({ data, level, companies }) => {
//   const chartRef = useRef<HTMLDivElement>(null);
//   const rootRef = useRef<any>(null);

//   // Function to format level name for display
//   const formatLevelName = (level: string): string => {
//     // Convert snake_case to Title Case
//     return level.split('_')
//       .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//       .join(' ');
//   };

//   useEffect(() => {
//     const loadChart = async () => {
//       try {
//         console.log('Loading chart with data:', { data, level, companies });

//         const am5 = await import("@amcharts/amcharts5/index");
//         const am5xy = await import("@amcharts/amcharts5/xy");
//         const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");

//         // Clean up existing chart
//         if (rootRef.current) {
//           rootRef.current.dispose();
//         }

//         if (!chartRef.current) {
//           console.error('Chart container not found');
//           return;
//         }

//         // Create root
//         const root = am5.Root.new(chartRef.current);
//         rootRef.current = root;

//         // Set themes
//         root.setThemes([am5themes_Animated.default.new(root)]);

//         // Create chart
//         const chart = root.container.children.push(
//           am5xy.XYChart.new(root, {
//             paddingRight: 20,
//             paddingLeft: 0,
//             paddingTop: 0, // Added padding for legend
//             layout: root.verticalLayout // Ensure proper layout with legend
//           })
//         );

//         // Process data
//         const processedData = data.map(item => {
//           const rowData: any = {
//             category: item[level]
//           };
          
//           companies.forEach(company => {
//             const marketShare = item["Market Share"]?.[company] || 0;
//             const growth = item["Growth"]?.[company] || 0;
//             rowData[`MarketShare_${company}`] = parseFloat(marketShare.toFixed(2));
//             rowData[`Growth_${company}`] = parseFloat(growth.toFixed(2));
//           });
          
//           return rowData;
//         });

//         // Add scrollbar
//         chart.set("scrollbarX", am5.Scrollbar.new(root, {
//           orientation: "horizontal",
//           marginBottom: 20
//         }));

//         // Create axes
//         const xAxis = chart.xAxes.push(
//           am5xy.CategoryAxis.new(root, {
//             categoryField: "category",
//             renderer: am5xy.AxisRendererX.new(root, {
//               minGridDistance: 30
//             }),
//             tooltip: am5.Tooltip.new(root, {})
//           })
//         );

//         xAxis.get("renderer").labels.template.setAll({
//           rotation: 0,
//           centerY: am5.p50,
//           centerX: am5.p50,
//           paddingTop: 8,
//           paddingBottom: 2,
//           fontSize: 10,
//           maxWidth: 120,
//           oversizedBehavior: "truncate",
//           textAlign: "center"
//         });

//         // Use the level prop to dynamically set the x-axis label
//         xAxis.children.push(
//           am5.Label.new(root, {
//             text: formatLevelName(level), // Format the level name for display
//             x: am5.p50,
//             centerX: am5.p50,
//             paddingTop: 0,
//             fontSize: 10,
//           })
//         );
//         const maxValue = Math.max(...data.map((item) => item.value))
//         const yAxisMax = Math.ceil(maxValue * 1)
    
  
//         const yAxis = chart.yAxes.push(
//           am5xy.ValueAxis.new(root, {
//             renderer: am5xy.AxisRendererY.new(root, {}),
//             max: yAxisMax,

//           })
//         );

//         yAxis.get("renderer").labels.template.setAll({
//           rotation: 0,
//           centerY: am5.p50,
//           centerX: am5.p50,
//           paddingTop: 8,
//           paddingBottom: 2,
//           fontSize: 10,
//           maxWidth: 120,
//           oversizedBehavior: "truncate",
//           textAlign: "center"
//         });

//         yAxis.children.unshift(
//           am5.Label.new(root, {
//             rotation: -90,
//             text: "Percentage (%)",
//             y: am5.p50,
//             centerX: am5.p50,
//             fontSize: 10,
//             paddingBottom: 0
//           })
//         );

//         // Add legend before setting data
//         const legend = chart.children.push(
//           am5.Legend.new(root, {
//             centerX: am5.p50,
//             x: am5.p50,
//             marginBottom: 0,
//             paddingTop: 0
//           })
//         );
//         legend.labels.template.setAll({
//             textAlign: "center",
//             fill: am5.color(0x000000),
//             fontSize: 10,
//           });
      
//           // Disable legend marker interactions
//           legend.markers.template.setAll({
//             width: 16,
//             height: 16,
//           });

//         xAxis.data.setAll(processedData);
//         root._logo?.dispose();

//         // Create series for each metric and company
//         companies.forEach((company, index) => {
//           // Market Share series
//           const marketShareSeries = chart.series.push(
//             am5xy.ColumnSeries.new(root, {
//               name: `${company} Market Share`,
//               xAxis: xAxis,
//               yAxis: yAxis,
//               valueYField: `MarketShare_${company}`,
//               categoryXField: "category",
//               clustered: true,
//               tooltip: am5.Tooltip.new(root, {
//                 labelText: `[fontSize:10px bold]${company} Market Share: {valueY}%`
//               })
//             })
//           );

//           // Add column template with border radius
//           marketShareSeries.columns.template.setAll({
//             cornerRadiusTL: 4,
//             cornerRadiusTR: 4,
//             strokeOpacity: 0,
//             // fillOpacity: 0.8
//           });
//           marketShareSeries.bullets.push(() => {
//             return am5.Bullet.new(root, {
//                 locationY: 1,
//                 sprite: am5.Label.new(root, {
//                     text: "{valueY}",
//                     centerX: am5.p50,
//                     centerY: 0,
//                     populateText: true,
//                     fontSize: 10,
//                     fontWeight: "400",
                    
//                     dy: -22
//                 })
//             });
//         });

//           marketShareSeries.data.setAll(processedData);

//           // Growth series
//           const growthSeries = chart.series.push(
//             am5xy.ColumnSeries.new(root, {
//               name: `${company} Growth`,
//               xAxis: xAxis,
//               yAxis: yAxis,
//               valueYField: `Growth_${company}`,
//               categoryXField: "category",
//               clustered: true,
//               tooltip: am5.Tooltip.new(root, {
//                 labelText: `[fontSize:10px bold]${company} Growth: {valueY}%`
//               })
//             })
//           );

//         //   Add column template with border radius
//           growthSeries.columns.template.setAll({
//             cornerRadiusTL: 4,
//             cornerRadiusTR: 4,
//             strokeOpacity: 0,
//             // fillOpacity: 0.8
//           });
//           growthSeries.bullets.push(() => {
//             return am5.Bullet.new(root, {
//                 locationY: 1,
//                 sprite: am5.Label.new(root, {
//                     text: "{valueY}",
//                     centerX: am5.p50,
//                     centerY: 0,
//                     populateText: true,
//                     fontSize: 10,
//                     fontWeight: "400",
                    
//                 })
//             });
//         });

//           growthSeries.data.setAll(processedData);
//         });

//         legend.data.setAll(chart.series.values);

//         // Add cursor
//         chart.set("cursor", am5xy.XYCursor.new(root, {}));

//         // Make stuff animate on load
//         chart.appear(1000, 100);

//         console.log('Chart setup complete');
//       } catch (error) {
//         console.error('Error creating chart:', error);
//       }
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
//     return (
//       <div 
//         style={{ 
//           width: '100%', 
//           height: '400px', 
//           display: 'flex', 
//           alignItems: 'center', 
//           justifyContent: 'center',
//           color: '#666',
//           fontWeight: 500,
//           fontSize: '14px',
//           backgroundColor: '#0000',
//           borderRadius: '4px'
//         }}
//       >
//         No data available
//       </div>
//     );
//   }

//   return (
//     <div 
//       ref={chartRef} 
//       style={{ width: '100%', height: '400px' }}
//     />
//   );
// };

// export default MarketShareStackedBarChart;


import React, { useEffect, useRef } from 'react';

interface StackedBarChartProps {
  data: any[];
  level: string;
  companies: string[];
}

// Company color mapping
const COMPANY_COLORS = {
  HPCL: "#1D4ED8",
  BPCL: "#FBBF24",
  IOCL: "#EA580C",
  RIL: "#A855F7",
  Nyra: "#14B8A6",
  Shell: "#A16207",
  MRPL: "#4D7C0F",
  GALE: "#991B1B",
  CPCL: "#44403C",
  HMEL: "#052E16",
  NRL: "#3B0764",
  NEL: "#0048A8",
  OIL: "#1F2937",
  SMA: "#4A044E",
  BURL: "#9D174D",
  OtherPSU: "#6B7280",
  PVT: "#374151",
};

const MarketShareStackedBarChart: React.FC<StackedBarChartProps> = ({ data, level, companies }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<any>(null);

  // Function to format level name for display
  const formatLevelName = (level: string): string => {
    // Convert snake_case to Title Case
    return level.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get color for company or provide fallback
  const getCompanyColor = (company: string): string => {
    return COMPANY_COLORS[company] || "#000000"; // Black as fallback
  };

  // Get a lighter version of the company color for growth
  const getLighterColor = (company: string): string => {
    const baseColor = getCompanyColor(company);
    
    // Convert hex to RGB, make it lighter, convert back to hex
    // This is a simple approach - for production, consider using a proper color library
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Make color lighter (increase brightness)
    const lighterR = Math.min(255, r + 40);
    const lighterG = Math.min(255, g + 40);
    const lighterB = Math.min(255, b + 40);
    
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  };

  useEffect(() => {
    const loadChart = async () => {
      try {
        console.log('Loading chart with data:', { data, level, companies });

        const am5 = await import("@amcharts/amcharts5/index");
        const am5xy = await import("@amcharts/amcharts5/xy");
        const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");

        // Clean up existing chart
        if (rootRef.current) {
          rootRef.current.dispose();
        }

        if (!chartRef.current) {
          console.error('Chart container not found');
          return;
        }

        // Create root
        const root = am5.Root.new(chartRef.current);
        rootRef.current = root;

        // Set themes
        root.setThemes([am5themes_Animated.default.new(root)]);

        // Create chart
        const chart = root.container.children.push(
          am5xy.XYChart.new(root, {
            paddingRight: 20,
            paddingLeft: 0,
            paddingTop: 0, // Added padding for legend
            layout: root.verticalLayout // Ensure proper layout with legend
          })
        );

        // Process data
        const processedData = data.map(item => {
          const rowData: any = {
            category: item[level]
          };
          
          companies.forEach(company => {
            const marketShare = item["Market Share"]?.[company] || 0;
            const growth = item["Growth"]?.[company] || 0;
            rowData[`MarketShare_${company}`] = parseFloat(marketShare.toFixed(2));
            rowData[`Growth_${company}`] = parseFloat(growth.toFixed(1));
          });
          
          return rowData;
        });

        // Add scrollbar
        chart.set("scrollbarX", am5.Scrollbar.new(root, {
          orientation: "horizontal",
          marginBottom: 20
        }));

        // Create axes
        const xAxis = chart.xAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: am5xy.AxisRendererX.new(root, {
              minGridDistance: 30
            }),
            tooltip: am5.Tooltip.new(root, {})
          })
        );

        xAxis.get("renderer").labels.template.setAll({
          rotation: 0,
          centerY: am5.p50,
          centerX: am5.p50,
          paddingTop: 8,
          paddingBottom: 2,
          fontSize: 10,
          fontWeight: "bold",
          maxWidth: 120,
          oversizedBehavior: "truncate",
          textAlign: "center"
        });

        // Use the level prop to dynamically set the x-axis label
        xAxis.children.push(
          am5.Label.new(root, {
            text: formatLevelName(level), // Format the level name for display
            x: am5.p50,
            centerX: am5.p50,
            paddingTop: 0,
            fontWeight: "bold",
            fontSize: 10,
          })
        );
        const maxValue = Math.max(...data.map((item) => item.value))
        const yAxisMax = Math.ceil(maxValue * 1)
    
  
        const yAxis = chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {}),
            max: yAxisMax,

          })
        );

        yAxis.get("renderer").labels.template.setAll({
          rotation: 0,
          centerY: am5.p50,
          centerX: am5.p50,
          paddingTop: 8,
          paddingBottom: 2,
          fontWeight: "bold",
          fontSize: 10,
          maxWidth: 120,
          oversizedBehavior: "truncate",
          textAlign: "center"
        });

        yAxis.children.unshift(
          am5.Label.new(root, {
            rotation: -90,
            text: "Percentage (%)",
            y: am5.p50,
            centerX: am5.p50,
            fontSize: 10,
            fontWeight: "bold",
            paddingBottom: 0
          })
        );

        // Add legend before setting data
        const legend = chart.children.push(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            marginBottom: 0,
            paddingTop: 0
          })
        );
        legend.labels.template.setAll({
            textAlign: "center",
            fill: am5.color(0x000000),
            fontSize: 10,
            fontWeight: "bold",

          });
      
          // Disable legend marker interactions
          legend.markers.template.setAll({
            width: 16,
            height: 16,
          });

        xAxis.data.setAll(processedData);
        root._logo?.dispose();

        // Create series for each metric and company
        companies.forEach((company, index) => {
          // Market Share series
          const marketShareSeries = chart.series.push(
            am5xy.ColumnSeries.new(root, {
              name: `${company} Market Share`,
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: `MarketShare_${company}`,
              categoryXField: "category",
              clustered: true,
              tooltip: am5.Tooltip.new(root, {
                labelText: `[fontSize:10px bold]${company} Market Share: {valueY}%`
              })
            })
          );

          // Set company-specific color for market share
          marketShareSeries.columns.template.setAll({
            cornerRadiusTL: 4,
            cornerRadiusTR: 4,
            strokeOpacity: 0,
            fill: am5.color(getCompanyColor(company))
          });
          
          marketShareSeries.bullets.push(() => {
            return am5.Bullet.new(root, {
                locationY: 1,
                sprite: am5.Label.new(root, {
                    text: "{valueY}",
                    centerX: am5.p50,
                    centerY: 0,
                    rotation:-20,
                    populateText: true,
                    fontSize: 10,
                    fontWeight: "bold",
                    dy: -22
                })
            });
          });

          marketShareSeries.data.setAll(processedData);

          // Growth series
          const growthSeries = chart.series.push(
            am5xy.ColumnSeries.new(root, {
              name: `${company} Growth`,
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: `Growth_${company}`,
              categoryXField: "category",
              clustered: true,
              tooltip: am5.Tooltip.new(root, {
                labelText: `[fontSize:10px bold]${company} Growth: {valueY}%`
              })
            })
          );

          // Set company-specific color for growth (use lighter version)
          growthSeries.columns.template.setAll({
            cornerRadiusTL: 4,
            cornerRadiusTR: 4,
            strokeOpacity: 0,
            fill: am5.color(getLighterColor(company))
          });
          
          growthSeries.bullets.push(() => {
            return am5.Bullet.new(root, {
                locationY: 1,
                sprite: am5.Label.new(root, {
                    text: "{valueY}",
                    centerX: am5.p50,
                    rotation:-20,
                    centerY: 0,
                    populateText: true,
                    fontSize: 10,
                    fontWeight: "bold",
                })
            });
          });

          growthSeries.data.setAll(processedData);
        });

        legend.data.setAll(chart.series.values);

        // Add cursor
        chart.set("cursor", am5xy.XYCursor.new(root, {}));

        // Make stuff animate on load
        chart.appear(1000, 100);

        console.log('Chart setup complete');
      } catch (error) {
        console.error('Error creating chart:', error);
      }
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
    return (
      <div 
        style={{ 
          width: '100%', 
          height: '400px', 
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
  }

  return (
    <div 
      ref={chartRef} 
      style={{ width: '100%', height: '400px' }}
    />
  );
};

export default MarketShareStackedBarChart;