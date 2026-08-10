// import React, { useRef, useEffect, useState } from 'react';
// import EChartsReact from 'echarts-for-react';
// import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
// import GaugeDataTable from './GaugeDataTable';

// interface GaugeProps {
//   data: {
//     chartType: string;
//     chartData: Array<Record<string, any>>;
//     showLegend: boolean;
//     legendOrientation: 'top' | 'bottom' | 'left' | 'right';
//     legendType: 'plain' | 'scroll';
//     chartRequest: any;
//     min?: number;
//     max?: number;
//     hideDataTable?: boolean;
//   };
//   theme: string;
//   onChartClick?: (params: any) => void;
// }

// const Gauge: React.FC<GaugeProps> = ({ data, theme, onChartClick }) => {
//   const chartRef = useRef<EChartsReact>(null);
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
//   const [selectedValue, setSelectedValue] = useState<number | null>(null);

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

//   const processedData = data.chartData.map(item => {
//     const keys = Object.keys(item);
//     const name = keys.slice(0, -1).map(key => String(item[key])).join(', ');
//     const value = Number(item[keys[keys.length - 1]]);
//     return { name, value };
//   }).filter(item => !isNaN(item.value));

//   const getSelectedTheme = (themeName: string) => {
//     switch (themeName) {
//       case 'Essos': return Essos;
//       case 'Wonderland': return Wonderland;
//       case 'Walden': return Walden;
//       case 'Infographic': return Infographic;
//       case 'Macarons': return Macarons;
//       case 'Roma': return Roma;
//       case 'CoolTheme': return CoolTheme;
//       case 'Shine': return Shine;
//       default: return Westeros;
//     }
//   };

//   const selectedTheme = getSelectedTheme(theme);

//   // Calculate min and max values if not provided
//   const minValue = data.min ?? Math.min(...processedData.map(item => item.value));
//   const maxValue = data.max ?? Math.max(...processedData.map(item => item.value));

//   const option: echarts.EChartsOption = {
//     tooltip: {
//       formatter: '{a} <br/>{b} : {c}%'
//     },
//     series: processedData.map(item => ({
//       name: 'Gauge',
//       type: 'gauge',
//       min: minValue,
//       max: maxValue,
//       progress: {
//         show: true,
//         roundCap: true,
//         width: 18
//       },
//       axisLine: {
//         lineStyle: {
//           width: 18
//         }
//       },
//       axisTick: {
//         show: true
//       },
//       splitLine: {
//         length: 15,
//         lineStyle: {
//           width: 2,
//           color: '#999'
//         }
//       },
//       axisLabel: {
//         distance: 25,
//         color: '#999',
//         fontSize: 14
//       },
//       anchor: {
//         show: true,
//         showAbove: true,
//         size: 25,
//         itemStyle: {
//           borderWidth: 10
//         }
//       },
//       title: {
//         show: true,
//         fontSize: 14
//       },
//       detail: {
//         valueAnimation: true,
//         fontSize: 30,
//         offsetCenter: [0, '70%'],
//         formatter: '{value}',
//         color: 'inherit'
//       },
//       data: [{
//         value: item.value,
//         name: item.name
//       }]
//     })),
//     color: selectedTheme.color
//   };

//   return (
//     <div ref={containerRef} className="w-full h-full flex flex-col">
//       {data.hideDataTable ? (
//         <div className="flex-grow">
//           <EChartsReact
//             ref={chartRef}
//             option={option}
//             theme={selectedTheme}
//             style={{ height: '100%', width: '100%' }}
//             opts={{ renderer: 'svg' }}
//           />
//           {selectedValue !== null && (
//             <div className="mt-2 p-2 text-sm text-gray-600">
//               Selected value: {selectedValue}
//             </div>
//           )}
//         </div>
//       ) : (
//         <div className="flex-grow">
//           <EChartsReact
//             ref={chartRef}
//             option={option}
//             theme={selectedTheme}
//             style={{ height: '400px', width: '100%' }}
//             opts={{ renderer: 'svg' }}
//           />
//           {selectedValue !== null && (
//             <div className="mt-2 p-2 text-sm text-gray-600">
//               Selected value: {selectedValue}
//             </div>
//           )}
//         </div>
//       )}

//       {!data.hideDataTable && (
//         <div className="flex-shrink-0 overflow-auto">
//           <Tabs defaultValue="results">
//             <TabsList className="mb-2">
//               <TabsTrigger value="results">RESULTS</TabsTrigger>
//             </TabsList>
//             <TabsContent value="results" className="h-full overflow-auto">
//               <GaugeDataTable data={data.chartData} />
//             </TabsContent>
//           </Tabs>
//         </div>
//       )}
//     </div>
//   );
// };

// // export default Gauge;
// import React, { useRef, useEffect, useState } from 'react';
// import EChartsReact from 'echarts-for-react';
// import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
// import GaugeDataTable from './GaugeDataTable';  // Assume you will create a similar data table for gauges

// interface GaugeProps {
//   data: {
//     chartType: string;
//     chartData: Array<Record<string, any>>;
//     showLegend: boolean;
//     legendOrientation: 'top' | 'bottom' | 'left' | 'right';
//     legendType: 'plain' | 'scroll';
//     chartRequest: any;
//     showLabelLines: boolean;
//     hideDataTable?: boolean;
//     maxValue: number;  // Add a maxValue prop to control gauge max
//   };
//   theme: string;
// }

// const Gauge: React.FC<GaugeProps> = ({ data, theme }) => {
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

//   const processedData = data.chartData.map(item => {
//     const keys = Object.keys(item);
//     return {
//       name: keys.slice(0, -1).map(key => String(item[key])).join(', '),
//       value: Number(item[keys[keys.length - 1]])
//     };
//   }).filter(item => !isNaN(item.value));

//   const getSelectedTheme = (themeName: string) => {
//     switch (themeName) {
//       case 'Essos': return Essos;
//       case 'Wonderland': return Wonderland;
//       case 'Walden': return Walden;
//       case 'Infographic': return Infographic;
//       case 'Macarons': return Macarons;
//       case 'Roma': return Roma;
//       case 'CoolTheme': return CoolTheme;
//       case 'Shine': return Shine;
//       default: return Westeros;
//     }
//   };

//   const selectedTheme = getSelectedTheme(theme);

//   const option: echarts.EChartsOption = {
//     tooltip: {
//       formatter: '{a} <br/>{b}: {c}%',
//     },
//     series: [
//       {
//         name: 'Gauge Data',
//         type: 'gauge',
//         max: data.maxValue || 100,  // Set the maximum value for the gauge
//         detail: { formatter: '{value}%' },
//         data: processedData,
//         axisLine: {
//           lineStyle: {
//             color: [[0.2, '#91c7ae'], [0.8, '#63869e'], [1, '#c23531']],
//             width: 10
//           }
//         },
//         splitLine: {
//           length: 20,
//           lineStyle: {
//             color: 'auto'
//           }
//         },
//         pointer: {
//           length: '70%',
//           width: 5
//         }
//       }
//     ]
//   };

//   return (
//     <div ref={containerRef} className="w-full h-full flex flex-col">
//       {data.hideDataTable ? (
//         <div className="flex-grow">
//           <EChartsReact
//             ref={chartRef}
//             option={option}
//             theme={selectedTheme}
//             style={{ height: '100%', width: '100%' }}
//             opts={{ renderer: 'svg' }}
//           />
//         </div>
//       ) : (
//         <div className="flex-grow">
//           <EChartsReact
//             option={option}
//             theme={selectedTheme}
//             style={{ height: '400px', width: '100%' }}
//             opts={{ renderer: 'svg' }}
//           />
//         </div>
//       )}

//       {!data.hideDataTable && (
//         <div className="flex-shrink-0 overflow-auto">
//           <Tabs defaultValue="results">
//             <TabsList className="mb-2">
//               <TabsTrigger value="results">RESULTS</TabsTrigger>
//             </TabsList>
//             <TabsContent value="results" className="h-full overflow-auto">
//               <GaugeDataTable data={data.chartData} />
//             </TabsContent>
//           </Tabs>
//         </div>
//       )}
//     </div>
//   );
// };

// // export default Gauge;
// import React, { useRef, useEffect, useState } from 'react';
// import EChartsReact from 'echarts-for-react';
// import type { EChartsOption, SeriesOption } from 'echarts';
// import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
// import GaugeDataTable from './GaugeDataTable';

// // Define specific types for the gauge series
// interface GaugeSeriesOption {
//   name: string;
//   type: 'gauge';
//   max: number;
//   detail: {
//     formatter: string;
//   };
//   data: Array<{
//     name: string;
//     value: number;
//   }>;
//   axisLine: {
//     lineStyle: {
//       color: Array<[number, string]>;
//       width: number;
//     };
//   };
//   splitLine: {
//     length: number;
//     lineStyle: {
//       color: string;
//     };
//   };
//   pointer: {
//     length: string;
//     width: number;
//   };
// }

// interface GaugeProps {
//   data: {
//     chartType: string;
//     chartData: Array<Record<string, any>>;
//     showLegend: boolean;
//     legendOrientation: 'top' | 'bottom' | 'left' | 'right';
//     legendType: 'plain' | 'scroll';
//     chartRequest: any;
//     showLabelLines: boolean;
//     hideDataTable?: boolean;
//     maxValue: number;
//   };
//   theme: string;
// }

// const Gauge: React.FC<GaugeProps> = ({ data, theme }) => {
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

//   // Process the data to be used for the gauge needles
//   const processedData = data.chartData.map(item => {
//     const keys = Object.keys(item);
//     return {
//       name: keys.slice(0, -1).map(key => String(item[key])).join(', '),
//       value: Number(item[keys[keys.length - 1]])
//     };
//   }).filter(item => !isNaN(item.value));

//   // Select the theme colors based on the chosen theme
//   const getSelectedTheme = (themeName: string) => {
//     switch (themeName) {
//       case 'Essos': return Essos;
//       case 'Wonderland': return Wonderland;
//       case 'Walden': return Walden;
//       case 'Infographic': return Infographic;
//       case 'Macarons': return Macarons;
//       case 'Roma': return Roma;
//       case 'CoolTheme': return CoolTheme;
//       case 'Shine': return Shine;
//       default: return Westeros;
//     }
//   };

//   const selectedTheme = getSelectedTheme(theme);
//   const themeColors = selectedTheme.color;

//   // Map theme colors dynamically to the gauge axis line
//   const axisColors = themeColors.map((color: string, index: number) => {
//     const percentage = (index + 1) / themeColors.length;
//     return [percentage, color] as [number, string];
//   });

//   // Create a series for each data point (to render multiple needles)
//   const series: GaugeSeriesOption[] = processedData.map((dataPoint) => ({
//     name: dataPoint.name,
//     type: 'gauge',
//     max: data.maxValue || 100,
//     detail: { formatter: '{value}%' },
//     data: [dataPoint],
//     axisLine: {
//       lineStyle: {
//         color: axisColors,
//         width: 10
//       }
//     },
//     splitLine: {
//       length: 20,
//       lineStyle: {
//         color: 'auto'
//       }
//     },
//     pointer: {
//       length: '70%',
//       width: 5
//     }
//   }));

//   const option: EChartsOption = {
//     tooltip: {
//       formatter: '<br/>{b}: {c}%',
//     },
//     series: series as SeriesOption[]
//   };

//   return (
//     <div ref={containerRef} className="w-full h-full flex flex-col">
//       {data.hideDataTable ? (
//         <div className="flex-grow">
//           <EChartsReact
//             ref={chartRef}
//             option={option}
//             theme={selectedTheme}
//             style={{ height: '100%', width: '100%' }}
//             opts={{ renderer: 'svg' }}
//           />
//         </div>
//       ) : (
//         <div className="flex-grow">
//           <EChartsReact
//             option={option}
//             theme={selectedTheme}
//             style={{ height: '400px', width: '100%' }}
//             opts={{ renderer: 'svg' }}
//           />
//         </div>
//       )}

//       {!data.hideDataTable && (
//         <div className="flex-shrink-0 overflow-auto">
//           <Tabs defaultValue="results">
//             <TabsList className="mb-2">
//               <TabsTrigger value="results">RESULTS</TabsTrigger>
//             </TabsList>
//             <TabsContent value="results" className="h-full overflow-auto">
//               <GaugeDataTable data={data.chartData} />
//             </TabsContent>
//           </Tabs>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Gauge;


// import React, { useRef, useEffect, useState } from 'react';
// import EChartsReact from 'echarts-for-react';
// import type { EChartsOption, SeriesOption } from 'echarts';
// import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
// import GaugeDataTable from './GaugeDataTable';

// // Previous interfaces remain the same
// interface GaugeSeriesOption {
//   name: string;
//   type: 'gauge';
//   max: number;
//   detail: {
//     formatter: string;
//     offsetCenter: [string, string]; // Added for positioning
//     fontSize: number;              // Added for text size
//   };
//   title: {                        // Added title configuration
//     fontSize: number;
//     offsetCenter: [string, string];
//   };
//   data: Array<{
//     name: string;
//     value: number;
//   }>;
//   axisLine: {
//     lineStyle: {
//       color: Array<[number, string]>;
//       width: number;
//     };
//   };
//   splitLine: {
//     length: number;
//     lineStyle: {
//       color: string;
//     };
//   };
//   pointer: {
//     length: string;
//     width: number;
//   };
// }

// // Previous GaugeProps interface remains the same
// interface GaugeProps {
//   data: {
//     chartType: string;
//     chartData: Array<Record<string, any>>;
//     showLegend: boolean;
//     legendOrientation: 'top' | 'bottom' | 'left' | 'right';
//     legendType: 'plain' | 'scroll';
//     chartRequest: any;
//     showLabelLines: boolean;
//     hideDataTable?: boolean;
//     maxValue: number;
//   };
//   theme: string;
// }

// const Gauge: React.FC<GaugeProps> = ({ data, theme }) => {
//   // Previous useRef, useState, and useEffect hooks remain the same
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

//   // Previous data processing and theme selection logic remains the same
//   const processedData = data.chartData.map(item => {
//     const keys = Object.keys(item);
//     return {
//       name: keys.slice(0, -1).map(key => String(item[key])).join(', '),
//       value: Number(item[keys[keys.length - 1]])
//     };
//   }).filter(item => !isNaN(item.value));

//   const getSelectedTheme = (themeName: string) => {
//     switch (themeName) {
//       case 'Essos': return Essos;
//       case 'Wonderland': return Wonderland;
//       case 'Walden': return Walden;
//       case 'Infographic': return Infographic;
//       case 'Macarons': return Macarons;
//       case 'Roma': return Roma;
//       case 'CoolTheme': return CoolTheme;
//       case 'Shine': return Shine;
//       default: return Westeros;
//     }
//   };

//   const selectedTheme = getSelectedTheme(theme);
//   const themeColors = selectedTheme.color;

//   const axisColors = themeColors.map((color: string, index: number) => {
//     const percentage = (index + 1) / themeColors.length;
//     return [percentage, color] as [number, string];
//   });

//   // Updated series configuration with better text positioning
//   const series: GaugeSeriesOption[] = processedData.map((dataPoint) => ({
//     name: dataPoint.name,
//     type: 'gauge',
//     max: data.maxValue || 100,
//     detail: {
//         show:false,
//       formatter: '{value}%',
//       offsetCenter: ['0%', '20%'],  // Moved value display down
//       fontSize: 14                  // Smaller font size
//     },
//     title: {
//         show:false,
//       fontSize: 12,                 // Smaller title font
//       offsetCenter: ['0%', '35%']   // Moved title further down
//     },
//     data: [dataPoint],
//     axisLine: {
//       lineStyle: {
//         color: axisColors,
//         width: 10
//       }
//     },
//     splitLine: {
//       length: 20,
//       lineStyle: {
//         color: 'auto'
//       }
//     },
//     pointer: {
//       length: '70%',
//       width: 5
//     }
//   }));

//   const option: EChartsOption = {
//     tooltip: {
//       formatter: '{b}: {c}%',
//     },
//     series: series as SeriesOption[]
//   };

//   // Previous return statement remains the same
//   return (
//     <div ref={containerRef} className="w-full h-full flex flex-col">
//       {data.hideDataTable ? (
//         <div className="flex-grow">
//           <EChartsReact
//             ref={chartRef}
//             option={option}
//             theme={selectedTheme}
//             style={{ height: '100%', width: '100%' }}
//             opts={{ renderer: 'svg' }}
//           />
//         </div>
//       ) : (
//         <div className="flex-grow">
//           <EChartsReact
//             option={option}
//             theme={selectedTheme}
//             style={{ height: '400px', width: '100%' }}
//             opts={{ renderer: 'svg' }}
//           />
//         </div>
//       )}

//       {!data.hideDataTable && (
//         <div className="flex-shrink-0 overflow-auto">
//           <Tabs defaultValue="results">
//             <TabsList className="mb-2">
//               <TabsTrigger value="results">RESULTS</TabsTrigger>
//             </TabsList>
//             <TabsContent value="results" className="h-full overflow-auto">
//               <GaugeDataTable data={data.chartData} />
//             </TabsContent>
//           </Tabs>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Gauge;


import React from 'react';
import EChartsReact from 'echarts-for-react';
import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
import GaugeDataTable from './GaugeDataTable';

interface GaugeProps {
  data: {
    chartType?: string;
    chartData?: Array<Record<string, any>>;
    showLegend?: boolean;
    legendOrientation?: 'top' | 'bottom' | 'left' | 'right';
    legendType?: 'plain' | 'scroll';
    chartRequest?: any;
    showLabelLines?: boolean;
  };
  theme: string;
}

const Gauge: React.FC<GaugeProps> = ({ data, theme }) => {
  // const processedData = data.chartData.map(item => {
  //   const keys = Object.keys(item);
  //   return {
  //     name: String(item[keys[0]]),
  //     value: Number(item[keys[1]])
  //   };
  // }).filter(item => !isNaN(item.value));

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

  const selectedTheme = getSelectedTheme(theme);

  // Assuming the first item in processedData contains the gauge value
  // const gaugeValue = processedData[0]?.value || 0;

  // const option: echarts.EChartsOption = {
  //   legend: {
  //     show: data.showLegend,
  //     orient: data.legendOrientation === 'left' || data.legendOrientation === 'right' ? 'vertical' : 'horizontal',
  //     [data.legendOrientation]: 10,
  //     type: data.legendType,
  //   },
  //   series: [{
  //     type: 'gauge',
  //     progress: {
  //       show: true
  //     },
  //     startAngle: 180,
  //     endAngle: 0,
  //     min: 0,
  //     max: 100,
  //     splitNumber: 4,
  //     axisLine: {
  //       lineStyle: {
  //         width: 30,
  //         color: [
  //           [0.25, '#FF6B6B'],
  //           [0.5, '#FFDD67'],
  //           [0.75, '#4ECDC4'],
  //           [1, '#45B7D1']
  //         ]
  //       }
  //     },
  //     pointer: {
  //       itemStyle: {
  //         color: 'auto'
  //       }
  //     },
  //     axisTick: {
  //       distance: -30,
  //       length: 8,
  //       lineStyle: {
  //         color: '#fff',
  //         width: 2
  //       }
  //     },
  //     splitLine: {
  //       distance: -30,
  //       length: 30,
  //       lineStyle: {
  //         color: '#fff',
  //         width: 4
  //       }
  //     },
  //     axisLabel: {
  //       color: 'auto',
  //       distance: 40,
  //       fontSize: 14
  //     },
  //     detail: {
  //       valueAnimation: true,
  //       formatter: '{value}',
  //       color: 'auto'
  //     },
      
  //     data: data?.chartData
  //     // [{
  //     //   value: gaugeValue,
  //     //   name: 'Grade Rating'
  //     // }]
  //   }]
  // };

  const option = {
    tooltip: {
      // formatter: '{a} <br/>{b} : {c}%'
    },
    series: [
      {
        name: 'Operability Index',
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber:4,
        axisLine: {
          lineStyle: {
            width: 30,
            color: [
              [0.85, '#dbaf40'], // Silver
              [0.95, '#f98281'], // Gold
              [1, '#19f9f3'], // Platinam
              // [1, '#19f9f3']
            ]
          }
        },
            splitLine: {
        distance: -30,
        length: 30,
        lineStyle: {
          color: '#fff',
          width: 3
        }
      },
        pointer: {
          itemStyle: {
            color: 'auto'
          }
        },
        progress: {
          show: false
        },
        detail: {
          valueAnimation: false,
          formatter: '{value}'
        },
        data: [
          {
            value: 99,
            name: 'SCORE'
          }
        ]
      }
    ]
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-0">
        <div className=" text-gray-800 text-sm font-bold rounded-full px-3 py-1">
          {/* {data.chartData.length} rows */}
          Operability Index
        </div>
      </div>
      
      <div className="flex-grow">
        <EChartsReact option={option} theme={selectedTheme} style={{ height: '300px', width: '100%' }} />
      </div>

      
      
      {/* <div className="mt-4">
        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">RESULTS</TabsTrigger>
            <TabsTrigger value="samples">SAMPLES</TabsTrigger>
          </TabsList>
          <TabsContent value="results" className="h-64 overflow-auto">
            <GaugeDataTable data={data.chartData} />
          </TabsContent>
          <TabsContent value="samples">
          </TabsContent>
        </Tabs>
      </div> */}
    </div>
  );
};

export default Gauge;