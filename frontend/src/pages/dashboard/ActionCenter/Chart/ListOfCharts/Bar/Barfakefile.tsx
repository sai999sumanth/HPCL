

// import React, { useEffect, useRef, useState } from 'react';
// import EChartsReact from 'echarts-for-react';
// import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
// import { Alert, AlertDescription } from '../../../../../../@/components/ui/alert';
// import BarDataTable from './BarDataTable';
// import { EChartsOption } from 'echarts';

// interface MetricColumn {
//   column: {
//     column_name: string;
//   };
//   label: string;
// }

// interface ChartRequest {
//   params: {
//     form_data: {
//       x_axis: {
//         name: string;
//         label?: string;
//       };
//       groupby?: Array<{
//         name: string;
//       }>;
//     };
//     queries: Array<{
//       metrics: MetricColumn[];
//     }>;
//   };
// }

// interface BarProps {
//   data: {
//     chartType: string;
//     chartData: Array<Record<string, any>>;
//     showLegend: boolean;
//     legendOrientation: 'top' | 'bottom' | 'left' | 'right';
//     legendType: 'plain' | 'scroll';
//     chartRequest: ChartRequest;
//     showDataZoom: boolean;
//     hideDataTable?: boolean;
//   };
//   theme: string;
// }

// interface CustomSeriesData {
//   value: number;
//   itemData?: Record<string, any>;
//   dimensions?: Record<string, any>;
//   metric?: string;
//   dimensionDisplay?: string;
// }

// // Define a custom series type that extends ECharts series options
// interface CustomBarSeriesOption {
//   name: string;
//   type: 'bar';
//   data: CustomSeriesData[];
//   barMaxWidth?: string | number;
//   barGap?: string | number;
//   emphasis?: {
//     focus?: 'series' | 'self' | 'none';
//     blurScope?: 'coordinateSystem' | 'series' | 'global';
//   };
// }

// const Bar: React.FC<BarProps> = ({ data, theme }) => {
//   const chartRef = useRef<EChartsReact>(null);
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

//   useEffect(() => {
//     const resizeObserver = new ResizeObserver(entries => {
//       for (let entry of entries) {
//         const { width, height } = entry.contentRect;
//         setContainerSize({ width, height });
//       }
//     });

//     if (containerRef.current) {
//       resizeObserver.observe(containerRef.current);
//     }

//     return () => {
//       resizeObserver.disconnect();
//     };
//   }, []);

//   useEffect(() => {
//     if (chartRef.current) {
//       chartRef.current.getEchartsInstance().resize();
//     }
//   }, [containerSize]);

//   const formatValue = (value: any): string => {
//     if (value === null || value === undefined) return '-';
    
//     if (typeof value === 'number') {
//       return new Intl.NumberFormat('en-US', {
//         maximumFractionDigits: 2,
//         notation: Math.abs(value) > 1000000 ? 'compact' : 'standard'
//       }).format(value);
//     }
    
//     return String(value);
//   };

//   const processChartData = (): { categories: string[]; series: CustomBarSeriesOption[] } => {
//     const xAxisField = data.chartRequest.params.form_data.x_axis.name;
//     const metrics = data.chartRequest.params.queries[0].metrics;
//     const groupByFields = data.chartRequest.params.form_data.groupby?.map(g => g.name) || [];
    
//     const categories = Array.from(new Set(data.chartData.map(item => String(item[xAxisField]))));

//     let series: CustomBarSeriesOption[] = [];

//     if (groupByFields.length > 0) {
//       const getDimensionValue = (item: any) => 
//         groupByFields.map(field => item[field]).join(' - ');

//       const dimensionCombinations = Array.from(new Set(
//         data.chartData.map(getDimensionValue)
//       ));

//       series = dimensionCombinations.flatMap(dimension =>
//         metrics.map(metric => ({
//           name: `${dimension} - ${metric.label}`,
//           type: 'bar',
//           data: categories.map(category => ({
//             value: data.chartData.find(item => 
//               String(item[xAxisField]) === category && 
//               getDimensionValue(item) === dimension
//             )?.[metric.column.column_name] || 0,
//             itemData: data.chartData.find(item => 
//               String(item[xAxisField]) === category && 
//               getDimensionValue(item) === dimension
//             ),
//             dimensions: groupByFields.reduce((acc, field) => ({
//               ...acc,
//               [field]: data.chartData.find(item => 
//                 String(item[xAxisField]) === category && 
//                 getDimensionValue(item) === dimension
//               )?.[field] || null
//             }), {}),
//             metric: metric.label,
//             dimensionDisplay: dimension
//           }))
//         }))
//       );
//     } else {
//       series = metrics.map(metric => ({
//         name: metric.label,
//         type: 'bar',
//         data: categories.map(category => ({
//           value: data.chartData.find(item => String(item[xAxisField]) === category)?.[metric.column.column_name] || 0,
//           itemData: data.chartData.find(item => String(item[xAxisField]) === category),
//           metric: metric.label
//         }))
//       }));
//     }

//     return { categories, series };
//   };

//   const getSelectedTheme = (themeName: string) => {
//     const themes = {
//       Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine, Westeros
//     };
//     return themes[themeName as keyof typeof themes] || Westeros;
//   };

//   if (!data.chartData?.length) {
//     return (
//       <Alert>
//         <AlertDescription>No data available for visualization</AlertDescription>
//       </Alert>
//     );
//   }

//   const { categories, series } = processChartData();
//   const selectedTheme = getSelectedTheme(theme);
//   const groupByFields = data.chartRequest.params.form_data.groupby?.map(g => g.name) || [];

//   const option: EChartsOption = {
//     tooltip: {
//       trigger: 'item',
//       axisPointer: {
//         type: 'shadow'
//       },
//       formatter: (params: any) => {
//         if (!params || !params.data) return '';

//         const itemData = params.data.itemData || {};
//         const xAxisField = data.chartRequest.params.form_data.x_axis.name;
//         const xAxisLabel = data.chartRequest.params.form_data.x_axis.label || xAxisField;

//         let tooltipContent = `
//           <div style="font-weight: bold; margin-bottom: 8px;">
//             ${xAxisLabel}: ${itemData[xAxisField] || params.name}
//           </div>
//         `;

//         if (params.data.dimensions) {
//           tooltipContent += `<div style="margin: 8px 0; padding-bottom: 8px; border-bottom: 1px solid #eee;">`;
//           groupByFields.forEach(field => {
//             const dimensionValue = params.data.dimensions[field];
//             if (dimensionValue !== null) {
//               tooltipContent += `
//                 <div style="margin: 4px 0;">
//                   <span style="color: #666;">${field}:</span>
//                   <span style="margin-left: 8px;">${dimensionValue}</span>
//                 </div>
//               `;
//             }
//           });
//           tooltipContent += `</div>`;
//         }

//         tooltipContent += `
//           <div style="display: flex; justify-content: space-between; margin: 4px 0;">
//             <span style="color: ${params.color};">● ${params.data.metric || params.seriesName}:</span>
//             <span style="margin-left: 12px; font-weight: bold;">
//               ${formatValue(params.value)}
//             </span>
//           </div>
//         `;

//         if (itemData.timestamp) {
//           tooltipContent += `
//             <div style="margin-top: 8px; font-size: 0.9em; color: #666;">
//               ${new Date(itemData.timestamp).toLocaleString()}
//             </div>
//           `;
//         }

//         return tooltipContent;
//       }
//     },
//     legend: {
//       show: data.showLegend,
//       type: data.legendType,
//       orient: data.legendOrientation === 'left' || data.legendOrientation === 'right' 
//         ? 'vertical' 
//         : 'horizontal',
//       top: data.legendOrientation === 'top' ? '0' : 'auto',
//       bottom: data.legendOrientation === 'bottom' ? '0' : 'auto',
//       left: data.legendOrientation === 'left' ? '0' : 'auto',
//       right: data.legendOrientation === 'right' ? '0' : 'auto',
//       textStyle: {
//         fontSize: 12
//       }
//     },
//     grid: {
//       left: '3%',
//       right: '4%',
//       bottom: data.showDataZoom ? '15%' : '3%',
//       top: data.legendOrientation === 'top' ? '15%' : '8%',
//       containLabel: true
//     },
//     xAxis: {
//       type: 'category',
//       data: categories,
//       axisLabel: {
//         rotate: categories.length > 12 ? 45 : 0
//       },
//       axisTick: {
//         alignWithLabel: true
//       }
//     },
//     yAxis: {
//       type: 'value',
//       axisLabel: {
//         formatter: formatValue
//       }
//     },
//     series: series as any[],
//     dataZoom: data.showDataZoom ? [
//       {
//         type: 'slider',
//         start: 0,
//         end: 100,
//         height: 30,
//         bottom: 5
//       },
//       {
//         type: 'inside',
//         start: 0,
//         end: 100
//       }
//     ] : []
//   };
// console.log(series);
//   return (
//     <div ref={containerRef} className="flex flex-col h-full">
//       <div className="relative" style={{ height: data.hideDataTable ? '100%' : '400px' }}>
//         <EChartsReact
//           ref={chartRef}
//           option={option}
//           theme={selectedTheme}
//           style={{ height: '100%' }}
//           notMerge={true}
//           opts={{ renderer: 'canvas' }}
//         />
//       </div>

//       {!data.hideDataTable && (
//         <div className="mt-4">
//           <Tabs defaultValue="results">
//             <TabsList>
//               <TabsTrigger value="results">RESULTS</TabsTrigger>
//             </TabsList>
//             <TabsContent value="results" className="h-64 overflow-auto">
//               <BarDataTable data={data.chartData} />
//             </TabsContent>
//           </Tabs>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Bar;




import React, { useEffect, useRef, useState } from 'react';
import EChartsReact from 'echarts-for-react';
import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
import BarDataTable from './BarDataTable';
import { BarSeriesOption } from 'echarts/charts';
import { EChartsOption } from 'echarts-for-react';

interface BarProps {
  data: {
    chartType: string;
    chartData: Array<Record<string, any>>;
    showLegend: boolean;
    legendOrientation: 'top' | 'bottom' | 'left' | 'right';
    legendType: 'plain' | 'scroll';
    chartRequest: any;
    showDataZoom: boolean;
    hideDataTable?: boolean;
  };
  theme: string;
}

const Bar: React.FC<BarProps> = ({ data, theme }) => {
  const chartRef = useRef<EChartsReact>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    
    if (typeof value === 'number') {
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
        notation: Math.abs(value) > 1000000 ? 'compact' : 'standard'
      }).format(value);
    }
    
    return String(value);
  };

  const processData = () => {
    const keys = Object.keys(data.chartData[0] || {});
    const categoryKey = keys[0];
    const valueKeys = keys.slice(1);
    const groupByFields = data.chartRequest.params.form_data.groupby?.map(g => g.name) || [];
    const hasGroupBy = groupByFields.length > 0;
    const dimensions = groupByFields.length;

    const categories = data.chartData.map(item => String(item[categoryKey]));
    
    if (hasGroupBy) {
      const getDimensionValue = (item: any) => 
        groupByFields.map(field => ({
          field,
          value: item[field]
        }));

      const dimensionCombinations = Array.from(new Set(
        data.chartData.map(item => 
          groupByFields.map(field => item[field]).join(' - ')
        )
      ));

      const series = dimensionCombinations.flatMap(dimension =>
        valueKeys.map(key => ({
          name: `${dimension} - ${key}`,
          type: 'bar' as const,
          data: categories.map(category => {
            const matchingItem = data.chartData.find(item => 
              String(item[categoryKey]) === category && 
              groupByFields.map(field => item[field]).join(' - ') === dimension
            );

            return {
              value: matchingItem?.[key] || 0,
              itemData: matchingItem,
              dimensions: getDimensionValue(matchingItem || {}),
              metric: key,
              dimensionDisplay: dimension
            };
          })
        }))
      );

      return { categories, series, hasGroupBy, dimensions };
    } else {
      const series: BarSeriesOption[] = valueKeys.map(key => ({
        name: key,
        type: 'bar',
        data: data.chartData.map(item => ({
          value: Number(item[key]),
          itemData: item,
          metric: key
        }))
      }));

      return { categories, series, hasGroupBy, dimensions: 0 };
    }
  };

  const getSelectedTheme = (themeName: string) => {
    switch (themeName) {
      case 'Essos': return Essos;
      case 'Wonderland': return Wonderland;
      case 'Walden': return Walden;
      case 'Infographic': return Infographic;
      case 'Macarons': return Macarons;
      case 'Roma': return Roma;
      case 'CoolTheme': return CoolTheme;
      case 'Shine': return Shine;
      default: return Westeros;
    }
  };

  const { categories, series, hasGroupBy, dimensions } = processData();
  const selectedTheme = getSelectedTheme(theme);
  const groupByFields = data.chartRequest.params.form_data.groupby?.map(g => g.name) || [];

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      axisPointer: {
        type: 'shadow',
        snap: true,
        animation: true,
        shadowStyle: {
          color: 'rgba(150,150,150,0.1)'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ccc',
      borderWidth: 1,
      padding: [5, 10],
      textStyle: {
        color: '#333'
      },
      extraCssText: 'box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);',
      formatter: function(params: any) {
        if (!params.data) return '';

        const xAxisField = data.chartRequest.params.form_data.x_axis.name;
        const xAxisLabel = data.chartRequest.params.form_data.x_axis.label || xAxisField;
        
        let tooltipContent = `
          <div style="font-weight: bold; margin-bottom: 8px;">
            ${xAxisLabel}: ${params.name}
          </div>
        `;

        if (hasGroupBy) {
          if (dimensions === 1) {
            tooltipContent += `
              <div style="margin: 4px 0;">
                <div style="font-weight: bold; color: #666;">
                  ${groupByFields[0]}: ${params.data.dimensions[0].value}
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span style="color: ${params.color};">● ${params.data.metric}:</span>
                  <span style="margin-left: 12px;">${formatValue(params.data.value)}</span>
                </div>
              </div>
            `;
          } else if (dimensions === 2) {
            tooltipContent += `
              <div style="margin: 4px 0;">
                <div style="font-weight: bold; color: #666;">
                  ${groupByFields[0]}: ${params.data.dimensions[0].value}
                </div>
                <div style="font-weight: bold; color: #666;">
                  ${groupByFields[1]}: ${params.data.dimensions[1].value}
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span style="color: ${params.color};">● ${params.data.metric}:</span>
                  <span style="margin-left: 12px;">${formatValue(params.data.value)}</span>
                </div>
              </div>
            `;
          } else {
            tooltipContent += `<div style="margin: 4px 0;">`;
            params.data.dimensions.forEach((dim: any) => {
              tooltipContent += `
                <div style="font-weight: bold; color: #666;">
                  ${dim.field}: ${dim.value}
                </div>
              `;
            });
            tooltipContent += `
              <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                <span style="color: ${params.color};">● ${params.data.metric}:</span>
                <span style="margin-left: 12px;">${formatValue(params.data.value)}</span>
              </div>
            </div>
            `;
          }
        } else {
          tooltipContent += `
            <div style="display: flex; justify-content: space-between; margin: 4px 0;">
              <span style="color: ${params.color};">● ${params.seriesName}:</span>
              <span style="margin-left: 12px;">${formatValue(params.data.value)}</span>
            </div>
          `;
        }

        return tooltipContent;
      }
    },
    series: series.map(s => ({
      ...s,
      emphasis: {
        focus: 'self',
        blurScope: 'none'
      },
      tooltip: {
        show: true
      }
    })),
    // Rest of the configuration remains the same
    legend: {
      show: data.showLegend,
      type: data.legendType,
      ...(hasGroupBy ? {
        orient: data.legendOrientation === 'left' || data.legendOrientation === 'right' 
          ? 'vertical' 
          : 'horizontal',
        top: data.legendOrientation === 'top' ? '0' : 'auto',
        bottom: data.legendOrientation === 'bottom' ? '0' : 'auto',
        left: data.legendOrientation === 'left' ? '0' : 'auto',
        right: data.legendOrientation === 'right' ? '0' : 'auto',
        textStyle: {
          fontSize: 12
        }
      } : {
        top: data.legendOrientation === 'top' ? '0' : 'auto',
        bottom: data.legendOrientation === 'bottom' ? '0' : 'auto',
        left: data.legendOrientation === 'left' ? '0' : 'auto',
        right: data.legendOrientation === 'right' ? '0' : 'auto',
      })
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: data.showDataZoom ? '15%' : '3%',
      top: data.legendOrientation === 'top' ? '15%' : '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: {
        show: true,
        lineStyle: {
          color: '#333',
          width: 1
        }
      },
      axisTick: {
        show: true,
        alignWithLabel: true
      },
      axisLabel: {
        rotate: categories.length > 12 ? 45 : 0,
        show: true,
        hideOverlap: true
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: true,
        lineStyle: {
          color: '#333',
          width: 1
        }
      },
      axisTick: {
        show: true
      },
      axisLabel: {
        show: true,
        formatter: formatValue
      },
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          color: '#ddd'
        }
      }
    },
    dataZoom: data.showDataZoom ? [
      {
        show: true,
        start: 94,
        end: 100
      },
      {
        type: 'inside',
        start: 94,
        end: 100
      },
      {
        show: true,
        yAxisIndex: 0,
        filterMode: 'empty',
        width: 30,
        height: '80%',
        showDataShadow: false,
        left: '93%'
      }
    ] : []
  };

  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current.getEchartsInstance();
      chart.resize();
    }
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {data.hideDataTable ? (
        <div className="flex-grow">
          <EChartsReact
            ref={chartRef}
            option={option}
            theme={selectedTheme}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      ) : (
        <div className="flex-grow">
          <EChartsReact
            ref={chartRef}
            option={option}
            theme={selectedTheme}
            style={{ height: '400px', width: '100%' }}
            notMerge={true}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      )}

      {!data.hideDataTable && (
        <div className="flex-shrink-0 overflow-auto">
          <Tabs defaultValue="results">
            <TabsList className="mb-2">
              <TabsTrigger value="results">RESULTS</TabsTrigger>
            </TabsList>
            <TabsContent value="results" className="h-full overflow-auto">
              <BarDataTable data={data.chartData} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default Bar;