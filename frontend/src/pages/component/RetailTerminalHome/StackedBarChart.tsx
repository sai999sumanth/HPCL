// // // import React, { useState, useEffect } from 'react';
// // // import {
// // //   BarChart,
// // //   Bar,
// // //   XAxis,
// // //   YAxis,
// // //   Tooltip,
// // //   ResponsiveContainer,
// // //   LabelList
// // // } from 'recharts';
// // // import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';

// // // interface AlertAgeingData {
// // //   alert_ageing: string;
// // //   alert_count: number;
// // // }

// // // interface StackedBarChartProps {
// // //   bu: string;
// // //   height?: number;
// // //   alert_section?: string;
// // //   timeFilter: string;
// // // }

// // // const StackedBarChart: React.FC<StackedBarChartProps> = ({ bu, height = 200, timeFilter }) => {
// // //   const [chartData, setChartData] = useState<AlertAgeingData[]>([]);
// // //   const [isLoading, setIsLoading] = useState(true);
// // //   const [error, setError] = useState<string | null>(null);

// // //   const colors = ['#38bdf9', '#8b5cf6', '#ec4899', '#f97316'];

// // //   const CustomTooltip = ({ active, payload, label }: any) => {
// // //     if (active && payload && payload.length) {
// // //       return (
// // //         <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
// // //           <p className="font-bold mb-2">{`Alert Ageing: ${label}`}</p>
// // //           <div className="flex items-center mb-1">
// // //             <div
// // //               className="w-[10px] h-[10px] mr-2 rounded-full"
// // //               style={{ backgroundColor: colors[0] }}
// // //             />
// // //             <span className="mr-2">Alert Count:</span>
// // //             <span className="font-semibold">{payload[0].value}</span>
// // //           </div>
// // //         </div>
// // //       );
// // //     }
// // //     return null;
// // //   };

// // //   const renderCustomBarLabel = (props: any) => {
// // //     const { x, y, width, value } = props;
// // //     return (
// // //       <text
// // //         x={x + width / 2}
// // //         y={y - 4}
// // //         fill="#000"
// // //         textAnchor="middle"
// // //         fontSize="10"
// // //       >
// // //         {value}
// // //       </text>
// // //     );
// // //   };

// // //   useEffect(() => {
// // //     const fetchData = async () => {
// // //       try {
// // //         setIsLoading(true);
// // //         const response = await fetchTerminalData('alert_ageing', bu, undefined, undefined, timeFilter);

// // //         const transformedData = response.data.map((item: AlertAgeingData) => ({
// // //           date: item.alert_ageing,
// // //           [bu]: item.alert_count
// // //         }));

// // //         setChartData(transformedData);
// // //         setIsLoading(false);
// // //       } catch (err) {
// // //         setError('Failed to fetch chart data');
// // //         setIsLoading(false);
// // //       }
// // //     };

// // //     fetchData();
// // //   }, [bu, timeFilter]);

// // //   // Always render the title container
// // //   const ChartContainer = ({ children }: { children: React.ReactNode }) => (
// // //     <div className="w-full">
// // //       <div className="text-sm font-bold mb-4 text-gray-800">Alert Ageing</div>
// // //       {children}
// // //     </div>
// // //   );

// // //   if (isLoading) {
// // //     return (
// // //       <ChartContainer>
// // //         <div className="h-[200px] flex items-center justify-center">
// // //           <div>Loading...</div>
// // //         </div>
// // //       </ChartContainer>
// // //     );
// // //   }

// // //   if (error) {
// // //     return (
// // //       <ChartContainer>
// // //         <div className="h-[200px] flex items-center justify-center">
// // //           <div>Error: {error}</div>
// // //         </div>
// // //       </ChartContainer>
// // //     );
// // //   }

// // //   if (chartData.length === 0) {
// // //     return (
// // //       <ChartContainer>
// // //         <div className="h-[200px] flex items-center justify-center text-gray-500 font-medium">
// // //           No Data Available
// // //         </div>
// // //       </ChartContainer>
// // //     );
// // //   }

// // //   return (
// // //     <ChartContainer>
// // //       <ResponsiveContainer width="100%" height={height}>
// // //         <BarChart
// // //           data={chartData}
// // //           margin={{
// // //             top: 20,
// // //             right: 30,
// // //             left: 20,
// // //             bottom: 5,
// // //           }}
// // //         >
// // //           <defs>
// // //             {colors.map((color, index) => (
// // //               <linearGradient
// // //                 key={`gradient-${index}`}
// // //                 id={`gradient-${index}`}
// // //                 x1="0"
// // //                 y1="0"
// // //                 x2="0"
// // //                 y2="1"
// // //               >
// // //                 <stop offset="0%" stopColor={color} stopOpacity={1} />
// // //                 <stop offset="100%" stopColor={color} stopOpacity={0.7} />
// // //               </linearGradient>
// // //             ))}
// // //           </defs>
// // //           <XAxis 
// // //             dataKey="date" 
// // //             label={{
// // //               value: 'Date',
// // //               position: 'insideBottom',
// // //               dy: 9,
// // //               style: { fontSize: '12px', textAnchor: 'middle' }
// // //             }}
// // //           />
// // //           <YAxis 
// // //             label={{ 
// // //               value: 'Alert Count', 
// // //               angle: -90, 
// // //               position: 'insideLeft' 
// // //             }} 
// // //           />
// // //           <Tooltip content={<CustomTooltip />} />
// // //           <Bar
// // //             dataKey={bu}
// // //             fill={`url(#gradient-0)`}
// // //             radius={[8, 8, 0, 0]}
// // //           >
// // //             <LabelList 
// // //               dataKey={bu}
// // //               position="top"
// // //               content={renderCustomBarLabel}
// // //             />
// // //           </Bar>
// // //         </BarChart>
// // //       </ResponsiveContainer>
// // //     </ChartContainer>
// // //   );
// // // };

// // // export default StackedBarChart;


// // // import React, { useState, useEffect } from 'react';
// // // import {
// // //   BarChart,
// // //   Bar,
// // //   XAxis,
// // //   YAxis,
// // //   Tooltip,
// // //   ResponsiveContainer,
// // //   Legend,
// // //   Brush
// // // } from 'recharts';
// // // import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';

// // // interface AlertData {
// // //   bu: string;
// // //   alert_section: string;
// // //   alert_ageing: string;
// // //   alert_count: number;
// // //   alert_ageing_order: number;
// // // }

// // // interface StackedBarChartProps {
// // //   bu: string;
// // //   alert_section?:string;
// // //   height?: number;
// // //   timeFilter: string;
// // // }

// // // const StackedBarChart: React.FC<StackedBarChartProps> = ({ bu, height = 200, timeFilter }) => {
// // //   const [chartData, setChartData] = useState<any[]>([]);
// // //   const [isLoading, setIsLoading] = useState(true);
// // //   const [error, setError] = useState<string | null>(null);

// // //   const colors = {
// // //     RO: '#38bdf9',
// // //     VA: '#8b5cf6'
// // //   };

// // //   const CustomTooltip = ({ active, payload, label }: any) => {
// // //     if (active && payload && payload.length) {
// // //       return (
// // //         <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
// // //           <p className="font-bold mb-2">{`Alert Ageing: ${label}`}</p>
// // //           {payload.map((entry: any, index: number) => (
// // //             <div key={index} className="flex items-center mb-1">
// // //               <div
// // //                 className="w-[10px] h-[10px] mr-2 rounded-full"
// // //                 style={{ backgroundColor: entry.color }}
// // //               />
// // //               <span className="mr-2">{`${entry.name}:`}</span>
// // //               <span className="font-semibold">{entry.value}</span>
// // //             </div>
// // //           ))}
// // //           <div className="flex items-center mt-2 pt-2 border-t">
// // //             <span className="mr-2">Total:</span>
// // //             <span className="font-semibold">
// // //               {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}
// // //             </span>
// // //           </div>
// // //         </div>
// // //       );
// // //     }
// // //     return null;
// // //   };

// // //   useEffect(() => {
// // //     const fetchData = async () => {
// // //       try {
// // //         setIsLoading(true);
// // //         const response = await fetchTerminalData('alert_ageing', bu, undefined, undefined, timeFilter);
        
// // //         // Transform the data for stacked bar chart
// // //         const transformedData = response.data.reduce((acc: any[], item: AlertData) => {
// // //           const existingItem = acc.find(x => x.alert_ageing === item.alert_ageing);
          
// // //           if (existingItem) {
// // //             existingItem[item.alert_section] = item.alert_count;
// // //           } else {
// // //             acc.push({
// // //               alert_ageing: item.alert_ageing,
// // //               [item.alert_section]: item.alert_count
// // //             });
// // //           }
          
// // //           return acc;
// // //         }, []);

// // //         setChartData(transformedData);
// // //         setIsLoading(false);
// // //       } catch (err) {
// // //         setError('Failed to fetch chart data');
// // //         setIsLoading(false);
// // //       }
// // //     };

// // //     fetchData();
// // //   }, [bu, timeFilter]);

// // //   const ChartContainer = ({ children }: { children: React.ReactNode }) => (
// // //     <div className="w-full">
// // //       <div className="text-sm font-bold mb-4 text-gray-800">Alert Ageing</div>
// // //       {children}
// // //     </div>
// // //   );

// // //   if (isLoading) {
// // //     return (
// // //       <ChartContainer>
// // //         <div className="h-[200px] flex items-center justify-center">
// // //           <div>Loading...</div>
// // //         </div>
// // //       </ChartContainer>
// // //     );
// // //   }

// // //   if (error) {
// // //     return (
// // //       <ChartContainer>
// // //         <div className="h-[200px] flex items-center justify-center">
// // //           <div>Error: {error}</div>
// // //         </div>
// // //       </ChartContainer>
// // //     );
// // //   }

// // //   if (chartData.length === 0) {
// // //     return (
// // //       <ChartContainer>
// // //         <div className="h-[200px] flex items-center justify-center text-gray-500 font-medium">
// // //           No Data Available
// // //         </div>
// // //       </ChartContainer>
// // //     );
// // //   }

// // //   return (
// // //     <ChartContainer>
// // //       <ResponsiveContainer width="100%" height={height}>
// // //       <BarChart
// // //   width={600}
// // //   height={300}
// // //   data={chartData}
// // //   margin={{
// // //     top: 20,
// // //     right: 30,
// // //     left: 20,
// // //     bottom: 20, // Ensure there is enough space at the bottom
// // //   }}
// // // >
// // //           <defs>
// // //             {Object.entries(colors).map(([key, color]) => (
// // //               <linearGradient
// // //                 key={`gradient-${key}`}
// // //                 id={`gradient-${key}`}
// // //                 x1="0"
// // //                 y1="0"
// // //                 x2="0"
// // //                 y2="1"
// // //               >
// // //                 <stop offset="0%" stopColor={color} stopOpacity={1} />
// // //                 <stop offset="100%" stopColor={color} stopOpacity={0.7} />
// // //               </linearGradient>
// // //             ))}
// // //           </defs>
// // //           <XAxis
// // //   dataKey="alert_ageing"
// // //   label={{
// // //     value: 'Alert Ageing',
// // //     position: 'insideBottom',
// // //     offset: -5, // Adjust the offset to move the label closer or further
// // //     style: { fontSize: '12px', textAnchor: 'middle' },
// // //   }}
// // // />

// // //           <YAxis 
// // //             label={{ 
// // //               value: 'Alert Count', 
// // //               angle: -90, 
// // //               position: 'insideLeft' 
// // //             }} 
// // //           />
// // //           <Tooltip content={<CustomTooltip />} />
// // //           <Legend wrapperStyle={{ marginBottom: -25 }} />


// // //           {Object.entries(colors).map(([key, color]) => (
// // //             <Bar
// // //               key={key}
// // //               dataKey={key}
// // //               stackId="a"
// // //               fill={`url(#gradient-${key})`}
// // //               radius={[4, 4, 0, 0]}
// // //               name={key}
// // //             />
            
// // //           ))}
// // //            <Brush
// // //             className="mt-[-5px]"
// // //             dataKey="date"
// // //             height={15}
// // //             stroke="#8884d8"
// // //             y={160}
// // //             startIndex={Math.max(0, chartData.length - 15)}
// // //           />
// // //         </BarChart>
// // //       </ResponsiveContainer>
// // //     </ChartContainer>
// // //   );
// // // };

// // // export default StackedBarChart;

// // import React, { useState, useEffect } from 'react';
// // import {
// //   BarChart,
// //   Bar,
// //   XAxis,
// //   YAxis,
// //   Tooltip,
// //   ResponsiveContainer,
// //   Legend,
// //   Brush,
// // } from 'recharts';
// // import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';

// // interface AlertData {
// //   bu: string;
// //   alert_section: string;
// //   alert_ageing: string;
// //   alert_count: number;
// //   alert_ageing_order: number;
// // }

// // interface StackedBarChartProps {
// //   bu: string;
// //   alert_section?: string;
// //   height?: number;
// //   timeFilter?: string;
// //   locationFilter?: {
// //     zone: string | null;
// //     plant: string | null;
// //   };
// // }
// // const StackedBarChart: React.FC<StackedBarChartProps> = ({ bu, height = 200, timeFilter,locationFilter }) => {
// //   const [chartData, setChartData] = useState<any[]>([]);
// //   const [colors, setColors] = useState<{ [key: string]: string }>({});
// //   const [isLoading, setIsLoading] = useState(true);
// //   const [error, setError] = useState<string | null>(null);

// /*************  ✨ Codeium Command ⭐  *************/
//   /**
//    * Generate an object mapping section names to colors
//    * @param {string[]} sections An array of section names
// /******  7845e12e-0051-4656-85f7-ba998586248c  *******/
// //   const generateColors = (sections: string[]) => {
// //     const colorPalette = [
// //       '#38bdf9',
// //       '#8b5cf6',
// //       '#facc15',
// //       '#ef4444',
// //       '#10b981',
// //       '#6366f1',
// //       '#f43f5e',
// //     ];
// //     return sections.reduce((acc, section, index) => {
// //       acc[section] = colorPalette[index % colorPalette.length];
// //       return acc;
// //     }, {} as { [key: string]: string });
// //   };

// //   const CustomTooltip = ({ active, payload, label }: any) => {
// //     if (active && payload && payload.length) {
// //       return (
// //         <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
// //           <p className="font-bold mb-2">{`Alert Ageing: ${label}`}</p>
// //           {payload.map((entry: any, index: number) => (
// //             <div key={index} className="flex items-center mb-1">
// //               <div
// //                 className="w-[10px] h-[10px] mr-2 rounded-full"
// //                 style={{ backgroundColor: entry.color }}
// //               />
// //               <span className="mr-2">{`${entry.name}:`}</span>
// //               <span className="font-semibold">{entry.value}</span>
// //             </div>
// //           ))}
// //           <div className="flex items-center mt-2 pt-2 border-t">
// //             <span className="mr-2">Total:</span>
// //             <span className="font-semibold">
// //               {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}
// //             </span>
// //           </div>
// //         </div>
// //       );
// //     }
// //     return null;
// //   };

// //   useEffect(() => {
// //     const fetchData = async () => {
// //       try {
// //         setIsLoading(true);
        
// //         // Create location filter object
// //         const locationFilterObj = {
// //           ...(locationFilter?.zone && { zone: locationFilter.zone }),
// //           ...(locationFilter?.plant && { plant: locationFilter.plant })
// //         };
  
// //         const response = await fetchTerminalData(
// //           'alert_ageing',
// //           bu,
// //           undefined,
// //           undefined,
// //           timeFilter,
// //           'equals',
// //           locationFilterObj
// //         );
  
// //         const uniqueSections = [...new Set(response.data.map((item: AlertData) => item.alert_section))] as string[];
// //         const colorMap = generateColors(uniqueSections);
  
// //         const transformedData = response.data.reduce((acc: any[], item: AlertData) => {
// //           const existingItem = acc.find((x) => x.alert_ageing === item.alert_ageing);
  
// //           if (existingItem) {
// //             existingItem[item.alert_section] = item.alert_count;
// //           } else {
// //             acc.push({
// //               alert_ageing: item.alert_ageing,
// //               [item.alert_section]: item.alert_count,
// //             });
// //           }
  
// //           return acc;
// //         }, []);
  
// //         setChartData(transformedData);
// //         setColors(colorMap);
// //         setIsLoading(false);
// //       } catch (err) {
// //         setError('Failed to fetch chart data');
// //         setIsLoading(false);
// //       }
// //     };
  
// //     fetchData();
// //   }, [bu, timeFilter, locationFilter]);
// //     const ChartContainer = ({ children }: { children: React.ReactNode }) => (
// //     <div className="w-full">
// //       <div className="text-sm font-bold mb-4 text-gray-800">Alert Ageing</div>
// //       {children}
// //     </div>
// //   );

// //   if (isLoading) {
// //     return (
// //       <ChartContainer>
// //         <div className="h-[200px] flex items-center justify-center">
// //           <div>Loading...</div>
// //         </div>
// //       </ChartContainer>
// //     );
// //   }

// //   if (error) {
// //     return (
// //       <ChartContainer>
// //         <div className="h-[200px] flex items-center justify-center">
// //           <div>Error: {error}</div>
// //         </div>
// //       </ChartContainer>
// //     );
// //   }

// //   if (chartData.length === 0) {
// //     return (
// //       <ChartContainer>
// //         <div className="h-[200px] flex items-center justify-center text-gray-500 font-medium">
// //           No Data Available
// //         </div>
// //       </ChartContainer>
// //     );
// //   }

// //   return (
// //     <ChartContainer>
// //       <ResponsiveContainer width="100%" height={height}>
// //         <BarChart
// //           width={600}
// //           height={300}
// //           data={chartData}
// //           margin={{
// //             top: 20,
// //             right: 30,
// //             left: 20,
// //             bottom: 20,
// //           }}
// //         >
// //           <XAxis
// //             dataKey="alert_ageing"
// //             label={{
// //               value: 'Alert Ageing',
// //               position: 'insideBottom',
// //               offset: -5,
// //               style: { fontSize: '12px', textAnchor: 'middle' },
// //             }}
// //           />
// //           <YAxis
// //             label={{
// //               value: 'Alert Count',
// //               angle: -90,
// //               position: 'insideLeft',
// //             }}
// //           />
// //           <Tooltip content={<CustomTooltip />} />
// //           <Legend wrapperStyle={{ marginBottom: -25 }} />
// //           {Object.entries(colors).map(([key, color], colorIndex) => (
// //   <Bar
// //     key={key}
// //     dataKey={key}
// //     stackId="a"
// //     fill={color}
// //     name={key}
// //     radius={
// //       chartData[chartData.length - 1] && colorIndex === Object.keys(colors).length - 1
// //         ? [4, 4, 0, 0] // Apply rounded corners to the last data entry
// //         : [0, 0, 0, 0] // No rounded corners for others
// //     }
// //   />
// // ))}

// //           <Brush
// //             className="mt-[-5px]"
// //             dataKey="alert_ageing"
// //             height={15}
// //             stroke="#8884d8"
// //             startIndex={Math.max(0, chartData.length - 15)}
// //             y={160}
// //           />
// //         </BarChart>
// //       </ResponsiveContainer>
// //     </ChartContainer>
// //   );
// // };

// // // export default StackedBarChart;
// // import React, { useState, useEffect } from 'react';
// // import {
// //   BarChart,
// //   Bar,
// //   XAxis,
// //   YAxis,
// //   Tooltip,
// //   ResponsiveContainer,
// //   Legend,
// //   Brush,
// // } from 'recharts';
// // import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';

// // interface AlertData {
// //   bu: string;
// //   alert_section: string;
// //   alert_ageing: string;
// //   alert_count: number;
// //   alert_ageing_order: number;
// // }

// // interface StackedBarChartProps {
// //   bu: string;
// //   alert_section?: string;
// //   height?: number;
// //   timeFilter?: string;
// //   alertStatus?: string; // Add this prop to accept alert status from parent
// //   locationFilter?: {
// //     zone: string | null;
// //     plant: string | null;
// //   };
// // }

// // const StackedBarChart: React.FC<StackedBarChartProps> = ({ 
// //   bu, 
// //   height = 200, 
// //   timeFilter,
// //   locationFilter,
// //   alertStatus  // Default to "Open" if not specified
// // }) => {
// //   const [chartData, setChartData] = useState<any[]>([]);
// //   const [colors, setColors] = useState<{ [key: string]: string }>({});
// //   const [isLoading, setIsLoading] = useState(true);
// //   const [error, setError] = useState<string | null>(null);

// //   const generateColors = (sections: string[]) => {
// //     const colorPalette = [
// //       '#38bdf9',
// //       '#8b5cf6',
// //       '#facc15',
// //       '#ef4444',
// //       '#10b981',
// //       '#6366f1',
// //       '#f43f5e',
// //     ];
// //     return sections.reduce((acc, section, index) => {
// //       acc[section] = colorPalette[index % colorPalette.length];
// //       return acc;
// //     }, {} as { [key: string]: string });
// //   };

// //   const CustomTooltip = ({ active, payload, label }: any) => {
// //     if (active && payload && payload.length) {
// //       return (
// //         <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
// //           <p className="font-bold mb-2">{`Alert Ageing: ${label}`}</p>
// //           {payload.map((entry: any, index: number) => (
// //             <div key={index} className="flex items-center mb-1">
// //               <div
// //                 className="w-[10px] h-[10px] mr-2 rounded-full"
// //                 style={{ backgroundColor: entry.color }}
// //               />
// //               <span className="mr-2">{`${entry.name}:`}</span>
// //               <span className="font-semibold">{entry.value}</span>
// //             </div>
// //           ))}
// //           <div className="flex items-center mt-2 pt-2 border-t">
// //             <span className="mr-2">Total:</span>
// //             <span className="font-semibold">
// //               {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}
// //             </span>
// //           </div>
// //         </div>
// //       );
// //     }
// //     return null;
// //   };

// //   useEffect(() => {
// //     const fetchData = async () => {
// //       try {
// //         setIsLoading(true);
        
// //         // Create location filter object
// //         const locationFilterObj = {
// //           ...(locationFilter?.zone && { zone: locationFilter.zone }),
// //           ...(locationFilter?.plant && { plant: locationFilter.plant })
// //         };
  
// //         const response = await fetchTerminalData(
// //           'alert_ageing',
// //           bu,
// //           undefined,
// //           alertStatus, // Pass the alert status to the API
// //           timeFilter,
// //           'equals',
// //           locationFilterObj
// //         );
  
// //         const uniqueSections = [...new Set(response.data.map((item: AlertData) => item.alert_section))] as string[];
// //         const colorMap = generateColors(uniqueSections);
  
// //         const transformedData = response.data.reduce((acc: any[], item: AlertData) => {
// //           const existingItem = acc.find((x) => x.alert_ageing === item.alert_ageing);
  
// //           if (existingItem) {
// //             existingItem[item.alert_section] = item.alert_count;
// //           } else {
// //             acc.push({
// //               alert_ageing: item.alert_ageing,
// //               [item.alert_section]: item.alert_count,
// //             });
// //           }
  
// //           return acc;
// //         }, []);
  
// //         setChartData(transformedData);
// //         setColors(colorMap);
// //         setIsLoading(false);
// //       } catch (err) {
// //         setError('Failed to fetch chart data');
// //         setIsLoading(false);
// //       }
// //     };
  
// //     fetchData();
// //   }, [bu, timeFilter, locationFilter, alertStatus]); // Added alertStatus to dependencies

// //   const ChartContainer = ({ children }: { children: React.ReactNode }) => (
// //     <div className="w-full">
// //       <div className="text-sm font-bold mb-4 text-gray-800">
// //         {alertStatus} Alert Ageing
// //       </div>
// //       {children}
// //     </div>
// //   );

// //   if (isLoading) {
// //     return (
// //       <ChartContainer>
// //         <div className="h-[200px] flex items-center justify-center">
// //           <div>Loading...</div>
// //         </div>
// //       </ChartContainer>
// //     );
// //   }

// //   if (error) {
// //     return (
// //       <ChartContainer>
// //         <div className="h-[200px] flex items-center justify-center">
// //           <div>Error: {error}</div>
// //         </div>
// //       </ChartContainer>
// //     );
// //   }

// //   if (chartData.length === 0) {
// //     return (
// //       <ChartContainer>
// //         <div className="h-[200px] flex items-center justify-center text-gray-500 font-medium">
// //           No Data Available
// //         </div>
// //       </ChartContainer>
// //     );
// //   }

// //   return (
// //     <ChartContainer>
// //       <ResponsiveContainer width="100%" height={height}>
// //         <BarChart
// //           width={600}
// //           height={300}
// //           data={chartData}
// //           margin={{
// //             top: 20,
// //             right: 30,
// //             left: 20,
// //             bottom: 20,
// //           }}
// //         >
// //           <XAxis
// //             dataKey="alert_ageing"
// //             label={{
// //               value: 'Alert Ageing',
// //               position: 'insideBottom',
// //               offset: -5,
// //               style: { fontSize: '12px', textAnchor: 'middle' },
// //             }}
// //           />
// //           <YAxis
// //             label={{
// //               value: 'Alert Count',
// //               angle: -90,
// //               position: 'insideLeft',
// //             }}
// //           />
// //           <Tooltip content={<CustomTooltip />} />
// //           <Legend wrapperStyle={{ marginBottom: -25 }} />
// //           {Object.entries(colors).map(([key, color], colorIndex) => (
// //             <Bar
// //               key={key}
// //               dataKey={key}
// //               stackId="a"
// //               fill={color}
// //               name={key}
// //               radius={
// //                 chartData[chartData.length - 1] && colorIndex === Object.keys(colors).length - 1
// //                   ? [4, 4, 0, 0] // Apply rounded corners to the last data entry
// //                   : [0, 0, 0, 0] // No rounded corners for others
// //               }
// //             />
// //           ))}

// //           <Brush
// //             className="mt-[-5px]"
// //             dataKey="alert_ageing"
// //             height={15}
// //             stroke="#8884d8"
// //             startIndex={Math.max(0, chartData.length - 15)}
// //             y={160}
// //           />
// //         </BarChart>
// //       </ResponsiveContainer>
// //     </ChartContainer>
// //   );
// // };

// // export default StackedBarChart;
// import React, { useState, useEffect } from 'react';
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   Tooltip,
//   ResponsiveContainer,
//   Legend,
//   Brush,
// } from 'recharts';
// import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';

// interface AlertData {
//   bu: string;
//   alert_section: string;
//   alert_ageing: string;
//   alert_count: number;
//   alert_ageing_order: number;
// }

// interface StackedBarChartProps {
//   bu: string;
//   alert_section?: string;
//   height?: number;
//   timeFilter?: string;
//   alertStatus?: string; // Add this prop to accept alert status from parent
//   locationFilter?: {
//     zone: string | null;
//     plant: string | null;
//   };
// }

// const StackedBarChart: React.FC<StackedBarChartProps> = ({ 
//   bu, 
//   height = 200, 
//   timeFilter,
//   locationFilter,
//   alertStatus = "Open"  // Default to "Open" if not specified
// }) => {
//   const [chartData, setChartData] = useState<any[]>([]);
//   const [colors, setColors] = useState<{ [key: string]: string }>({});
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const generateColors = (sections: string[]) => {
//     const colorPalette = [
//       '#38bdf9',
//       '#8b5cf6',
//       '#facc15',
//       '#ef4444',
//       '#10b981',
//       '#6366f1',
//       '#f43f5e',
//     ];
//     return sections.reduce((acc, section, index) => {
//       acc[section] = colorPalette[index % colorPalette.length];
//       return acc;
//     }, {} as { [key: string]: string });
//   };

//   const CustomTooltip = ({ active, payload, label }: any) => {
//     if (active && payload && payload.length) {
//       return (
//         <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
//           <p className="font-bold mb-2">{`Alert Ageing: ${label}`}</p>
//           {payload.map((entry: any, index: number) => (
//             <div key={index} className="flex items-center mb-1">
//               <div
//                 className="w-[10px] h-[10px] mr-2 rounded-full"
//                 style={{ backgroundColor: entry.color }}
//               />
//               <span className="mr-2">{`${entry.name}:`}</span>
//               <span className="font-semibold">{entry.value}</span>
//             </div>
//           ))}
//           <div className="flex items-center mt-2 pt-2 border-t">
//             <span className="mr-2">Total:</span>
//             <span className="font-semibold">
//               {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}
//             </span>
//           </div>
//         </div>
//       );
//     }
//     return null;
//   };

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setIsLoading(true);
        
//         // Create location filter object
//         const locationFilterObj = {
//           ...(locationFilter?.zone && { zone: locationFilter.zone }),
//           ...(locationFilter?.plant && { plant: locationFilter.plant })
//         };
  
//         console.log(`Fetching data with alert_status=${alertStatus}`);
        
//         const response = await fetchTerminalData(
//           'alert_ageing',
//           bu,
//           undefined,
//           alertStatus, // Pass the alert status to the API
//           timeFilter,
//           'equals',
//           locationFilterObj
//         );
  
//         const uniqueSections = [...new Set(response.data.map((item: AlertData) => item.alert_section))] as string[];
//         const colorMap = generateColors(uniqueSections);
  
//         const transformedData = response.data.reduce((acc: any[], item: AlertData) => {
//           const existingItem = acc.find((x) => x.alert_ageing === item.alert_ageing);
  
//           if (existingItem) {
//             existingItem[item.alert_section] = item.alert_count;
//           } else {
//             acc.push({
//               alert_ageing: item.alert_ageing,
//               [item.alert_section]: item.alert_count,
//             });
//           }
  
//           return acc;
//         }, []);
  
//         setChartData(transformedData);
//         setColors(colorMap);
//         setIsLoading(false);
//       } catch (err) {
//         console.error('Error fetching data:', err);
//         setError('Failed to fetch chart data');
//         setIsLoading(false);
//       }
//     };
  
//     fetchData();
//   }, [bu, timeFilter, locationFilter, alertStatus]); // Added alertStatus to dependencies

//   const ChartContainer = ({ children }: { children: React.ReactNode }) => (
//     <div className="w-full">
//       <div className="text-sm font-bold mb-4 text-gray-800">
//         {alertStatus} Alert Ageing
//       </div>
//       {children}
//     </div>
//   );

//   if (isLoading) {
//     return (
//       <ChartContainer>
//         <div className="h-[200px] flex items-center justify-center">
//           <div>Loading...</div>
//         </div>
//       </ChartContainer>
//     );
//   }

//   if (error) {
//     return (
//       <ChartContainer>
//         <div className="h-[200px] flex items-center justify-center">
//           <div>Error: {error}</div>
//         </div>
//       </ChartContainer>
//     );
//   }

//   if (chartData.length === 0) {
//     return (
//       <ChartContainer>
//         <div className="h-[200px] flex items-center justify-center text-gray-500 font-medium">
//           No Data Available for {alertStatus} Alerts
//         </div>
//       </ChartContainer>
//     );
//   }

//   return (
//     <ChartContainer>
//       <ResponsiveContainer width="100%" height={height}>
//         <BarChart
//           width={600}
//           height={300}
//           data={chartData}
//           margin={{
//             top: 20,
//             right: 30,
//             left: 20,
//             bottom: 20,
//           }}
//         >
//           <XAxis
//             dataKey="alert_ageing"
//             label={{
//               value: 'Alert Ageing',
//               position: 'insideBottom',
//               offset: -5,
//               style: { fontSize: '12px', textAnchor: 'middle' },
//             }}
//           />
//           <YAxis
//             label={{
//               value: 'Alert Count',
//               angle: -90,
//               position: 'insideLeft',
//             }}
//           />
//           <Tooltip content={<CustomTooltip />} />
//           <Legend wrapperStyle={{ marginBottom: -25 }} />
//           {Object.entries(colors).map(([key, color], colorIndex) => (
//             <Bar
//               key={key}
//               dataKey={key}
//               stackId="a"
//               fill={color}
//               name={key}
//               radius={
//                 chartData[chartData.length - 1] && colorIndex === Object.keys(colors).length - 1
//                   ? [4, 4, 0, 0] // Apply rounded corners to the last data entry
//                   : [0, 0, 0, 0] // No rounded corners for others
//               }
//             />
//           ))}

//           <Brush
//             className="mt-[-5px]"
//             dataKey="alert_ageing"
//             height={15}
//             stroke="#8884d8"
//             startIndex={Math.max(0, chartData.length - 15)}
//             y={160}
//           />
//         </BarChart>
//       </ResponsiveContainer>
//     </ChartContainer>
//   );
// };

// // export default StackedBarChart;
// import React, { useState, useEffect } from 'react';
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   Tooltip,
//   ResponsiveContainer,
//   Legend,
//   Brush,
// } from 'recharts';
// import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';

// interface AlertData {
//   bu: string;
//   alert_section: string;
//   alert_ageing: string;
//   alert_count: number;
//   alert_ageing_order: number;
// }

// interface StackedBarChartProps {
//   bu: string;
//   alert_section?: string;
//   height?: number;
//   timeFilter?: string;
//   alertStatus?: string; // Add this prop to accept alert status from parent
//   locationFilter?: {
//     zone: string | null;
//     plant: string | null;
//   };
// }

// const StackedBarChart: React.FC<StackedBarChartProps> = ({ 
//   bu, 
//   height = 200, 
//   timeFilter,
//   locationFilter,
//   alertStatus = "Open"  // Default to "Open" if not specified
// }) => {
//   const [chartData, setChartData] = useState<any[]>([]);
//   const [colors, setColors] = useState<{ [key: string]: string }>({});
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const generateColors = (sections: string[]) => {
//     const colorPalette = [
//       '#38bdf9',
//       '#8b5cf6',
//       '#facc15',
//       '#ef4444',
//       '#10b981',
//       '#6366f1',
//       '#f43f5e',
//     ];
//     return sections.reduce((acc, section, index) => {
//       acc[section] = colorPalette[index % colorPalette.length];
//       return acc;
//     }, {} as { [key: string]: string });
//   };

//   const CustomTooltip = ({ active, payload, label }: any) => {
//     if (active && payload && payload.length) {
//       return (
//         <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
//           <p className="font-bold mb-2">{`Alert Ageing: ${label}`}</p>
//           {payload.map((entry: any, index: number) => (
//             <div key={index} className="flex items-center mb-1">
//               <div
//                 className="w-[10px] h-[10px] mr-2 rounded-full"
//                 style={{ backgroundColor: entry.color }}
//               />
//               <span className="mr-2">{`${entry.name}:`}</span>
//               <span className="font-semibold">{entry.value}</span>
//             </div>
//           ))}
//           <div className="flex items-center mt-2 pt-2 border-t">
//             <span className="mr-2">Total:</span>
//             <span className="font-semibold">
//               {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}
//             </span>
//           </div>
//         </div>
//       );
//     }
//     return null;
//   };

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setIsLoading(true);
        
//         // Create location filter object
//         const locationFilterObj = {
//           ...(locationFilter?.zone && { zone: locationFilter.zone }),
//           ...(locationFilter?.plant && { plant: locationFilter.plant })
//         };
  
//         console.log(`Fetching data with alert_status=${alertStatus}`);
        
//         const response = await fetchTerminalData(
//           'alert_ageing',
//           bu,
//           undefined,
//           alertStatus, // Pass the alert status to the API
//           timeFilter,
//           'equals',
//           locationFilterObj
//         );
  
//         const uniqueSections = [...new Set(response.data.map((item: AlertData) => item.alert_section))] as string[];
//         const colorMap = generateColors(uniqueSections);
  
//         const transformedData = response.data.reduce((acc: any[], item: AlertData) => {
//           const existingItem = acc.find((x) => x.alert_ageing === item.alert_ageing);
  
//           if (existingItem) {
//             existingItem[item.alert_section] = item.alert_count;
//           } else {
//             acc.push({
//               alert_ageing: item.alert_ageing,
//               [item.alert_section]: item.alert_count,
//             });
//           }
  
//           return acc;
//         }, []);
  
//         setChartData(transformedData);
//         setColors(colorMap);
//         setIsLoading(false);
//       } catch (err) {
//         console.error('Error fetching data:', err);
//         setError('Failed to fetch chart data');
//         setIsLoading(false);
//       }
//     };
  
//     fetchData();
//   }, [bu, timeFilter, locationFilter, alertStatus]); // Added alertStatus to dependencies

//   const ChartContainer = ({ children }: { children: React.ReactNode }) => (
//     <div className="w-full">
//       <div className="text-sm font-bold mb-4 text-gray-800">
//         {alertStatus} Alert Ageing
//       </div>
//       {children}
//     </div>
//   );

//   if (isLoading) {
//     return (
//       <ChartContainer>
//         <div className="h-[200px] flex items-center justify-center">
//           <div>Loading...</div>
//         </div>
//       </ChartContainer>
//     );
//   }

//   if (error) {
//     return (
//       <ChartContainer>
//         <div className="h-[200px] flex items-center justify-center">
//           <div>Error: {error}</div>
//         </div>
//       </ChartContainer>
//     );
//   }

//   if (chartData.length === 0) {
//     return (
//       <ChartContainer>
//         <div className="h-[200px] flex items-center justify-center text-gray-500 font-medium">
//           No Data Available for {alertStatus} Alerts
//         </div>
//       </ChartContainer>
//     );
//   }

//   return (
//     <ChartContainer>
//       <ResponsiveContainer width="100%" height={height}>
//         <BarChart
//           width={600}
//           height={300}
//           data={chartData}
//           margin={{
//             top: 20,
//             right: 30,
//             left: 20,
//             bottom: 20,
//           }}
//         >
//           <XAxis
//             dataKey="alert_ageing"
//             label={{
//               value: 'Alert Ageing',
//               position: 'insideBottom',
//               offset: -5,
//               style: { fontSize: '12px', textAnchor: 'middle' },
//             }}
//           />
//           <YAxis
//             label={{
//               value: 'Alert Count',
//               angle: -90,
//               position: 'insideLeft',
//             }}
//           />
//           <Tooltip content={<CustomTooltip />} />
//           <Legend wrapperStyle={{ marginBottom: -25 }} />
//           {Object.entries(colors).map(([key, color], colorIndex) => (
//             <Bar
//               key={key}
//               dataKey={key}
//               stackId="a"
//               fill={color}
//               name={key}
//               radius={
//                 chartData[chartData.length - 1] && colorIndex === Object.keys(colors).length - 1
//                   ? [4, 4, 0, 0] // Apply rounded corners to the last data entry
//                   : [0, 0, 0, 0] // No rounded corners for others
//               }
//             />
//           ))}

//           <Brush
//             className="mt-[-5px]"
//             dataKey="alert_ageing"
//             height={15}
//             stroke="#8884d8"
//             startIndex={Math.max(0, chartData.length - 15)}
//             y={160}
//           />
//         </BarChart>
//       </ResponsiveContainer>
//     </ChartContainer>
//   );
// };

// export default StackedBarChart;
"use client"

import React, { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Brush } from "recharts"
import { fetchTerminalData } from "../RetailTerminalHome/ApiServiceFile"

interface AlertData {
  bu: string
  alert_section: string
  alert_ageing: string
  alert_count: number
  alert_ageing_order: number
}

interface StackedBarChartProps {
  bu: string
  alert_section?: string
  height?: number
  timeFilter?: string
  alertStatus?: string
  locationFilter?: {
    zone: string | null
    plant: string | null
  }
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({
  bu,
  height = 200,
  timeFilter,
  locationFilter,
  alertStatus = "Open",
  alert_section
}) => {
  const [chartData, setChartData] = useState<any[]>([])
  const [colors, setColors] = useState<{ [key: string]: string }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const generateColors = (sections: string[]) => {
    const colorPalette = ["#38bdf9", "#8b5cf6", "#facc15", "#ef4444", "#10b981", "#6366f1", "#f43f5e"]
    return sections.reduce(
      (acc, section, index) => {
        acc[section] = colorPalette[index % colorPalette.length]
        return acc
      },
      {} as { [key: string]: string },
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
          <p className="font-bold mb-2">{`Alert Ageing: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center mb-1">
              <div className="w-[10px] h-[10px] mr-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="mr-2">{`${entry.name}:`}</span>
              <span className="font-semibold">{entry.value}</span>
            </div>
          ))}
          <div className="flex items-center mt-2 pt-2 border-t">
            <span className="mr-2">Total:</span>
            <span className="font-semibold">{payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}</span>
          </div>
        </div>
      )
    }
    return null
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        // Create location filter object
        let locationFilterObj = {
          ...(locationFilter?.zone && { zone: locationFilter.zone }),
          ...(locationFilter?.plant && { plant: locationFilter.plant }),
        }
        let sap_id = localStorage.getItem('sapId');
        let zone = localStorage.getItem('zone');
        if(sap_id || zone) {
          locationFilterObj = {
            zone: zone,
            plant: sap_id
          }
        }
        const response = await fetchTerminalData(
          "alert_ageing",
          bu,
          alert_section, // Pass the alert_section to the API
          alertStatus,
          timeFilter,
          "equals",
          locationFilterObj,
        )

        const uniqueSections = [...new Set(response.data.map((item: AlertData) => item.alert_section))] as string[]
        const colorMap = generateColors(uniqueSections)

        const transformedData = response.data.reduce((acc: any[], item: AlertData) => {
          const existingItem = acc.find((x) => x.alert_ageing === item.alert_ageing)

          if (existingItem) {
            existingItem[item.alert_section] = item.alert_count
          } else {
            acc.push({
              alert_ageing: item.alert_ageing,
              [item.alert_section]: item.alert_count,
            })
          }

          return acc
        }, [])

        setChartData(transformedData)
        setColors(colorMap)
        setIsLoading(false)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to fetch chart data")
        setIsLoading(false)
      }
    }

    fetchData()
  }, [bu, timeFilter, locationFilter, alertStatus, alert_section]) // Added alert_section to dependencies

  const ChartContainer = ({ children }: { children: React.ReactNode }) => (
    <div className="w-full">
      <div className="text-sm font-bold mb-4 text-gray-800">
{alertStatus} {alert_section === "VTS" ? "ITDG Alert Ageing" : "Alert Ageing"} {alert_section ? `- ${alert_section}` : ""}
      </div>
      {children}
    </div>
  )

  if (isLoading) {
    return (
      <ChartContainer>
        {/* <div className="h-[200px] flex items-center justify-center"> */}
        <div className="h-[200px] flex items-center justify-center bg-white text-gray-800">
  <div className="flex flex-col items-center gap-4">
    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-blue-500/30"></div>
    {/* <span className="text-lg font-medium">Loading...</span> */}
  </div>
</div>  
      {/* </div> */}
      </ChartContainer>
    )
  }

  if (error) {
    return (
      <ChartContainer>
        <div className="h-[200px] flex items-center justify-center">
          <div>Error: {error}</div>
        </div>
      </ChartContainer>
    )
  }

  if (chartData.length === 0) {
    return (
      <ChartContainer>
        <div className="h-[200px] flex items-center justify-center text-gray-500 font-medium">
          No Data Available for {alertStatus} Alerts {alert_section ? `in ${alert_section}` : ''}
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          width={600}
          height={300}
          data={chartData}
          maxBarSize={80}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <XAxis
            dataKey="alert_ageing"
            label={{
              value: "Alert Ageing",
              position: "insideBottom",
              offset: -5,
              style: { fontSize: "12px", textAnchor: "middle" },
            }}
          />
          <YAxis
            label={{
              value: "Alert Count",
              angle: -90,
              position: "insideLeft",
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ marginBottom: -25 }} />
          {Object.entries(colors).map(([key, color], colorIndex) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="a"
              fill={color}
              name={key}
              radius={
                chartData[chartData.length - 1] && colorIndex === Object.keys(colors).length - 1
                  ? [4, 4, 0, 0] // Apply rounded corners to the last data entry
                  : [0, 0, 0, 0] // No rounded corners for others
              }
            />
          ))}

          <Brush
            className="mt-[-5px]"
            dataKey="alert_ageing"
            height={15}
            stroke="#8884d8"
            startIndex={Math.max(0, chartData.length - 15)}
            y={160}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

export default StackedBarChart