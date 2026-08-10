// // import { DaywiseDryoutChart } from './DaywiseDryoutChart';
// // import { AverageDryoutChart } from './AverageDryoutChart';
// // import { RepeatedDryoutTable } from './RepeatedDryoutTable';
// // import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/@/components/ui/tabs';

// // export function DryoutDashboard() {
// //   return (
// //     <div className="min-h-screen bg-gray-100 p-2">
// //       <h1 className="text-xl font-bold mb-2">Analysis Dashboard</h1>
      
// //       <Tabs defaultValue="dryout" className="w-full">
// //         <TabsList className="mb-1">
// //           <TabsTrigger value="dryout">Dryout Analysis</TabsTrigger>
// //           <TabsTrigger value="carryforward">Carry Forward Analysis</TabsTrigger>
// //         </TabsList>
        
// //         <TabsContent value="dryout" className="space-y-2">
// //           <DaywiseDryoutChart />
// //           <AverageDryoutChart />
// //           <RepeatedDryoutTable />
// //         </TabsContent>
        
// //         <TabsContent value="carryforward">
// //           <div className="bg-white p-2 rounded-lg shadow-lg">
// //             <p className="text-gray-500">Carry Forward Analysis will be implemented soon.</p>
// //           </div>
// //         </TabsContent>
// //       </Tabs>
// //     </div>
// //   );
// // }
// // export default DryoutDashboard;


// // import React from 'react';
// // import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
// // import { 
// //   BarChart, 
// //   Bar, 
// //   XAxis, 
// //   YAxis, 
// //   CartesianGrid, 
// //   Tooltip, 
// //   Legend,
// //   ResponsiveContainer 
// // } from 'recharts';

// // // Sample data structure for daywise dryout analysis
// // const daywiseDryoutData = [
// //   {
// //     day: 'Monday',
// //     normalDryout: 65,
// //     catADryout: 45
// //   },
// //   {
// //     day: 'Tuesday',
// //     normalDryout: 75,
// //     catADryout: 55
// //   },
// //   {
// //     day: 'Wednesday',
// //     normalDryout: 85,
// //     catADryout: 65
// //   },
// //   {
// //     day: 'Thursday',
// //     normalDryout: 70,
// //     catADryout: 50
// //   },
// //   {
// //     day: 'Friday',
// //     normalDryout: 60,
// //     catADryout: 40
// //   }
// // ];

// // // Sample data for average dryout
// // const averageDryoutData = [
// //   { month: 'Jan', value: 30 },
// //   { month: 'Feb', value: 40 },
// //   { month: 'Mar', value: 35 },
// //   { month: 'Apr', value: 45 },
// //   { month: 'May', value: 25 },
// // ];

// // // Sample data for repeated dryouts
// // const repeatedDryoutData = [
// //   { id: 1, location: 'Location A', count: 5, lastOccurrence: '2024-01-05' },
// //   { id: 2, location: 'Location B', count: 3, lastOccurrence: '2024-01-04' },
// //   { id: 3, location: 'Location C', count: 7, lastOccurrence: '2024-01-03' },
// // ];

// // const DryoutDashboard = () => {
// //   return (
// //     <div className="w-full p-4 space-y-4">
// //       <div className="grid grid-cols-1 gap-4">
// //         {/* Daywise Dryout Analysis Chart */}
// //         <Card>
// //           <CardHeader>
// //             <CardTitle>Daywise Dryout Analysis</CardTitle>
// //           </CardHeader>
// //           <CardContent className="h-72">
// //             <ResponsiveContainer width="100%" height="100%">
// //               <BarChart data={daywiseDryoutData}>
// //                 <CartesianGrid strokeDasharray="3 3" />
// //                 <XAxis dataKey="day" />
// //                 <YAxis />
// //                 <Tooltip />
// //                 <Legend />
// //                 <Bar dataKey="normalDryout" name="Normal Dryout" fill="#8884d8" />
// //                 <Bar dataKey="catADryout" name="Cat A Dryout" fill="#82ca9d" />
// //               </BarChart>
// //             </ResponsiveContainer>
// //           </CardContent>
// //         </Card>

// //         {/* Average Dryout Chart */}
// //         <Card>
// //           <CardHeader>
// //             <CardTitle>Average Dryout</CardTitle>
// //           </CardHeader>
// //           <CardContent className="h-72">
// //             <ResponsiveContainer width="100%" height="100%">
// //               <BarChart data={averageDryoutData}>
// //                 <CartesianGrid strokeDasharray="3 3" />
// //                 <XAxis dataKey="month" />
// //                 <YAxis />
// //                 <Tooltip />
// //                 <Bar dataKey="value" fill="#82ca9d" />
// //               </BarChart>
// //             </ResponsiveContainer>
// //           </CardContent>
// //         </Card>

// //         {/* Repeated Dryouts Table */}
// //         <Card>
// //           <CardHeader>
// //             <CardTitle>Repeated Dryouts</CardTitle>
// //           </CardHeader>
// //           <CardContent>
// //             <div className="overflow-x-auto">
// //               <table className="w-full text-sm">
// //                 <thead>
// //                   <tr className="border-b">
// //                     <th className="text-left p-2">Location</th>
// //                     <th className="text-left p-2">Count</th>
// //                     <th className="text-left p-2">Last Occurrence</th>
// //                   </tr>
// //                 </thead>
// //                 <tbody>
// //                   {repeatedDryoutData.map((row) => (
// //                     <tr key={row.id} className="border-b">
// //                       <td className="p-2">{row.location}</td>
// //                       <td className="p-2">{row.count}</td>
// //                       <td className="p-2">{row.lastOccurrence}</td>
// //                     </tr>
// //                   ))}
// //                 </tbody>
// //               </table>
// //             </div>
// //           </CardContent>
// //         </Card>
// //       </div>
// //     </div>
// //   );
// // };

// // export default DryoutDashboard;

// // import React from 'react';
// // import { Card, CardHeader, CardContent } from '@/@/components/ui/card';
// // import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer } from 'recharts';

// // const DryoutDashboard = () => {
// //   // Sample data for dryout analysis
// //   const moistureData = Array(20).fill(0).map((_, i) => ({
// //     time: `${9 + Math.floor(i/4)}:${(i%4)*15}`,
// //     value: 20 + Math.random() * 10 // Moisture percentage
// //   }));

// //   const temperatureData = Array(12).fill(0).map((_, i) => ({
// //     hour: i * 2,
// //     temp: 150 + Math.random() * 30 // Temperature in degrees
// //   }));

// //   const efficiencyData = [
// //     { name: 'Batch A', efficiency: 95 },
// //     { name: 'Batch B', efficiency: 87 },
// //     { name: 'Batch C', efficiency: 92 },
// //     { name: 'Batch D', efficiency: 88 }
// //   ];

// //   const energyConsumption = Array(12).fill(0).map((_, i) => ({
// //     month: `${String(i+1).padStart(2, '0')}`,
// //     consumption: 1000 + Math.random() * 500,
// //     cost: 500 + Math.random() * 200
// //   }));

// //   return (
// //     <div className="w-full min-h-screen bg-gray-50 text-gray-800 p-4">
// //       <div className="text-center text-2xl mb-6 text-blue-800">
// //         Industrial Dryout Analysis System
// //       </div>
      
// //       <div className="grid grid-cols-12 gap-4">
// //         {/* Left Column */}
// //         <div className="col-span-4 space-y-4">
// //           {/* Moisture Content Analysis */}
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">Real-time Moisture Content</CardHeader>
// //             <CardContent>
// //               <ResponsiveContainer width="100%" height={150}>
// //                 <LineChart data={moistureData}>
// //                   <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} />
// //                   <XAxis dataKey="time" />
// //                   <YAxis label={{ value: 'Moisture %', angle: -90, position: 'insideLeft' }} />
// //                 </LineChart>
// //               </ResponsiveContainer>
// //             </CardContent>
// //           </Card>

// //           {/* Temperature Distribution */}
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">Temperature Distribution</CardHeader>
// //             <CardContent>
// //               <ResponsiveContainer width="100%" height={150}>
// //                 <LineChart data={temperatureData}>
// //                   <Line type="monotone" dataKey="temp" stroke="#dc2626" />
// //                   <XAxis dataKey="hour" label={{ value: 'Hours', position: 'bottom' }} />
// //                   <YAxis label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
// //                 </LineChart>
// //               </ResponsiveContainer>
// //             </CardContent>
// //           </Card>

// //           {/* Process Efficiency */}
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">Process Efficiency Analysis</CardHeader>
// //             <CardContent>
// //               <ResponsiveContainer width="100%" height={150}>
// //                 <BarChart data={efficiencyData}>
// //                   <Bar dataKey="efficiency" fill="#3b82f6" />
// //                   <XAxis dataKey="name" />
// //                   <YAxis label={{ value: 'Efficiency %', angle: -90, position: 'insideLeft' }} />
// //                 </BarChart>
// //               </ResponsiveContainer>
// //             </CardContent>
// //           </Card>

// //           {/* Energy Metrics */}
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">Energy Consumption Metrics</CardHeader>
// //             <CardContent>
// //               <ResponsiveContainer width="100%" height={150}>
// //                 <LineChart data={energyConsumption}>
// //                   <Line type="monotone" dataKey="consumption" stroke="#059669" />
// //                   <Line type="monotone" dataKey="cost" stroke="#9333ea" />
// //                   <XAxis dataKey="month" />
// //                   <YAxis />
// //                 </LineChart>
// //               </ResponsiveContainer>
// //             </CardContent>
// //           </Card>
// //         </div>

// //         {/* Center Column */}
// //         <div className="col-span-4">
// //           <Card className="bg-white h-full">
// //             <CardContent className="h-full">
// //               <div className="text-center mb-4 font-bold">Process Flow Visualization</div>
// //               <div className="h-full flex items-center justify-center text-gray-500">
// //                 Interactive Process Flow Diagram
// //               </div>
// //             </CardContent>
// //           </Card>
// //         </div>

// //         {/* Right Column */}
// //         <div className="col-span-4 space-y-4">
// //           {/* Production KPIs */}
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">Production KPIs</CardHeader>
// //             <CardContent className="grid grid-cols-2 gap-4">
// //               <div className="text-center p-4 bg-blue-50 rounded-lg">
// //                 <div className="text-2xl font-bold text-blue-600">94%</div>
// //                 <div className="text-sm text-gray-600">Drying Efficiency</div>
// //               </div>
// //               <div className="text-center p-4 bg-green-50 rounded-lg">
// //                 <div className="text-2xl font-bold text-green-600">98%</div>
// //                 <div className="text-sm text-gray-600">Quality Rate</div>
// //               </div>
// //             </CardContent>
// //           </Card>

// //           {/* Quality Metrics */}
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">Quality Metrics</CardHeader>
// //             <CardContent>
// //               <ResponsiveContainer width="100%" height={150}>
// //                 <PieChart>
// //                   <Pie
// //                                       data={[
// //                                           { name: 'Optimal', value: 75 },
// //                                           { name: 'Acceptable', value: 20 },
// //                                           { name: 'Below Standard', value: 5 }
// //                                       ]}
// //                                       innerRadius={50}
// //                                       outerRadius={70}
// //                                       fill="#8884d8" dataKey={''}                  >
// //                     <Cell fill="#3b82f6" />
// //                     <Cell fill="#22c55e" />
// //                     <Cell fill="#ef4444" />
// //                   </Pie>
// //                 </PieChart>
// //               </ResponsiveContainer>
// //             </CardContent>
// //           </Card>

// //           {/* Alerts and Warnings */}
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">System Alerts</CardHeader>
// //             <CardContent>
// //               <div className="space-y-2">
// //                 <div className="p-2 bg-green-50 rounded text-sm">✓ All systems operating normally</div>
// //                 <div className="p-2 bg-yellow-50 rounded text-sm">⚠ Moisture sensor calibration due</div>
// //                 <div className="p-2 bg-blue-50 rounded text-sm">ℹ Maintenance scheduled for next week</div>
// //               </div>
// //             </CardContent>
// //           </Card>

// //           {/* Carry Forward Analysis */}
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">Carry Forward Analysis</CardHeader>
// //             <CardContent>
// //               <ResponsiveContainer width="100%" height={150}>
// //                 <BarChart data={[
// //                   { name: 'Week 1', current: 85, previous: 80 },
// //                   { name: 'Week 2', current: 88, previous: 82 },
// //                   { name: 'Week 3', current: 92, previous: 85 },
// //                   { name: 'Week 4', current: 90, previous: 88 }
// //                 ]}>
// //                   <Bar dataKey="current" fill="#3b82f6" name="Current Period" />
// //                   <Bar dataKey="previous" fill="#93c5fd" name="Previous Period" />
// //                   <XAxis dataKey="name" />
// //                   <YAxis />
// //                 </BarChart>
// //               </ResponsiveContainer>
// //             </CardContent>
// //           </Card>
// //         </div>

// //         {/* Bottom Row */}
// //         <div className="col-span-12">
// //           <Card className="bg-white">
// //             <CardHeader className="text-sm font-bold">Historical Performance Analysis</CardHeader>
// //             <CardContent>
// //               <ResponsiveContainer width="100%" height={200}>
// //                 <BarChart data={Array(12).fill(0).map((_, i) => ({
// //                   month: `Month ${i + 1}`,
// //                   efficiency: 85 + Math.random() * 10,
// //                   moisture: 5 + Math.random() * 3,
// //                   energy: 90 + Math.random() * 5
// //                 }))}>
// //                   <Bar dataKey="efficiency" fill="#3b82f6" name="Process Efficiency" />
// //                   <Bar dataKey="moisture" fill="#22c55e" name="Moisture Content" />
// //                   <Bar dataKey="energy" fill="#eab308" name="Energy Efficiency" />
// //                   <XAxis dataKey="month" />
// //                   <YAxis />
// //                 </BarChart>
// //               </ResponsiveContainer>
// //             </CardContent>
// //           </Card>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // };

// // export default DryoutDashboard;


// import React from 'react';
// import { Card, CardHeader, CardContent } from '@/@/components/ui/card';
// import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts';

// const DryoutDashboard = () => {
//   // Sample location-wise dryout data
//   const locationDryoutData = [
//     { location: 'Mumbai', normalDryout: 45, catADryout: 15 },
//     { location: 'Delhi', normalDryout: 38, catADryout: 12 },
//     { location: 'Chennai', normalDryout: 42, catADryout: 18 },
//     { location: 'Kolkata', normalDryout: 35, catADryout: 10 },
//     { location: 'Bangalore', normalDryout: 40, catADryout: 14 }
//   ];

//   // Remaining sample data
//   const temperatureData = Array(12).fill(0).map((_, i) => ({
//     hour: i * 2,
//     temp: 150 + Math.random() * 30
//   }));

//   const efficiencyData = [
//     { name: 'Batch A', efficiency: 95 },
//     { name: 'Batch B', efficiency: 87 },
//     { name: 'Batch C', efficiency: 92 },
//     { name: 'Batch D', efficiency: 88 }
//   ];

//   const energyConsumption = Array(12).fill(0).map((_, i) => ({
//     month: `${String(i+1).padStart(2, '0')}`,
//     consumption: 1000 + Math.random() * 500,
//     cost: 500 + Math.random() * 200
//   }));

//   // Custom tooltip for the stacked bar chart
//   const CustomTooltip = ({ active, payload, label }) => {
//     if (active && payload && payload.length) {
//       return (
//         <div className="bg-white border border-gray-200 p-2 text-xs shadow-lg rounded">
//           <p className="font-semibold">{`Location: ${label}`}</p>
//           <p className="text-blue-600">{`Normal Dryout: ${payload[0].value}`}</p>
//           <p className="text-purple-600">{`Cat A Dryout: ${payload[1].value}`}</p>
//         </div>
//       );
//     }
//     return null;
//   };

//   return (
//     <div className="w-full min-h-screen bg-gray-100 p-3">
//       <div className="text-center text-xl font-semibold mb-4 text-blue-900">
//         Industrial Dryout Analysis System
//       </div>
      
//       <div className="grid grid-cols-12 gap-3">
//         {/* Left Column */}
//         <div className="col-span-4 space-y-3">
//           {/* Location-wise Dryout Analysis */}
//           <Card className="bg-white shadow-sm">
//             <CardHeader className="text-xs font-semibold py-2">Location-wise Dryout Analysis</CardHeader>
//             <CardContent className="p-2">
//               <ResponsiveContainer width="100%" height={150}>
//                 <BarChart data={locationDryoutData}>
//                   <CartesianGrid strokeDasharray="3 3" />
//                   <XAxis 
//                     dataKey="location" 
//                     fontSize={10}
//                     tick={{ fill: '#4B5563' }}
//                   />
//                   <YAxis 
//                     fontSize={10}
//                     tick={{ fill: '#4B5563' }}
//                   />
//                   <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
//                   <Legend 
//                     wrapperStyle={{ fontSize: '10px' }}
//                     iconSize={8}
//                   />
//                   <Bar 
//                     dataKey="normalDryout" 
//                     name="Normal Dryout" 
//                     stackId="a" 
//                     fill="#3B82F6"
//                     radius={[4, 4, 0, 0]}
//                   />
//                   <Bar 
//                     dataKey="catADryout" 
//                     name="Cat A Dryout" 
//                     stackId="a" 
//                     fill="#8B5CF6"
//                     radius={[4, 4, 0, 0]}
//                   />
//                 </BarChart>
//               </ResponsiveContainer>
//             </CardContent>
//           </Card>

//           {/* Temperature Distribution */}
//           <Card className="bg-white shadow-sm">
//             <CardHeader className="text-xs font-semibold py-2">Temperature Distribution</CardHeader>
//             <CardContent className="p-2">
//               <ResponsiveContainer width="100%" height={150}>
//                 <LineChart data={temperatureData}>
//                   <Line type="monotone" dataKey="temp" stroke="#dc2626" strokeWidth={1.5} />
//                   <XAxis dataKey="hour" fontSize={10} />
//                   <YAxis fontSize={10} />
//                 </LineChart>
//               </ResponsiveContainer>
//             </CardContent>
//           </Card>

//           {/* Process Efficiency */}
//           <Card className="bg-white shadow-sm">
//             <CardHeader className="text-xs font-semibold py-2">Process Efficiency</CardHeader>
//             <CardContent className="p-2">
//               <ResponsiveContainer width="100%" height={150}>
//                 <BarChart data={efficiencyData}>
//                   <Bar dataKey="efficiency" fill="#3b82f6" />
//                   <XAxis dataKey="name" fontSize={10} />
//                   <YAxis fontSize={10} />
//                 </BarChart>
//               </ResponsiveContainer>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Center Column */}
//         <div className="col-span-4">
//           <Card className="bg-white shadow-sm h-full">
//             <CardContent className="h-full p-3">
//               <div className="text-xs font-semibold mb-2">Process Flow Visualization</div>
//               <div className="h-full flex items-center justify-center text-gray-400 text-sm">
//                 Interactive Process Flow Diagram
//               </div>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Right Column */}
//         <div className="col-span-4 space-y-3">
//           {/* KPIs */}
//           <Card className="bg-white shadow-sm">
//             <CardHeader className="text-xs font-semibold py-2">Production KPIs</CardHeader>
//             <CardContent className="grid grid-cols-2 gap-2 p-2">
//               <div className="text-center p-2 bg-blue-50 rounded">
//                 <div className="text-lg font-bold text-blue-600">94%</div>
//                 <div className="text-xs text-gray-600">Efficiency</div>
//               </div>
//               <div className="text-center p-2 bg-green-50 rounded">
//                 <div className="text-lg font-bold text-green-600">98%</div>
//                 <div className="text-xs text-gray-600">Quality</div>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Quality Metrics */}
//           <Card className="bg-white shadow-sm">
//             <CardHeader className="text-xs font-semibold py-2">Quality Metrics</CardHeader>
//             <CardContent className="p-2">
//               <ResponsiveContainer width="100%" height={150}>
//                 <PieChart>
//                   <Pie
//                     data={[
//                       { name: 'Optimal', value: 75 },
//                       { name: 'Acceptable', value: 20 },
//                       { name: 'Below Standard', value: 5 }
//                     ]}
//                     innerRadius={40}
//                     outerRadius={60}
//                     fill="#8884d8"
//                     dataKey="value"
//                   >
//                     <Cell fill="#3b82f6" />
//                     <Cell fill="#22c55e" />
//                     <Cell fill="#ef4444" />
//                   </Pie>
//                 </PieChart>
//               </ResponsiveContainer>
//             </CardContent>
//           </Card>

//           {/* Alerts */}
//           <Card className="bg-white shadow-sm">
//             <CardHeader className="text-xs font-semibold py-2">System Alerts</CardHeader>
//             <CardContent className="space-y-1 p-2">
//               <div className="p-1.5 bg-green-50 rounded text-xs">✓ Systems normal</div>
//               <div className="p-1.5 bg-yellow-50 rounded text-xs">⚠ Sensor calibration due</div>
//               <div className="p-1.5 bg-blue-50 rounded text-xs">ℹ Maintenance scheduled</div>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Bottom Row */}
//         <div className="col-span-12">
//           <Card className="bg-white shadow-sm">
//             <CardHeader className="text-xs font-semibold py-2">Performance Analysis</CardHeader>
//             <CardContent className="p-2">
//               <ResponsiveContainer width="100%" height={180}>
//                 <BarChart data={Array(12).fill(0).map((_, i) => ({
//                   month: `M${i + 1}`,
//                   efficiency: 85 + Math.random() * 10,
//                   moisture: 5 + Math.random() * 3,
//                   energy: 90 + Math.random() * 5
//                 }))}>
//                   <Bar dataKey="efficiency" fill="#3b82f6" />
//                   <Bar dataKey="moisture" fill="#22c55e" />
//                   <Bar dataKey="energy" fill="#eab308" />
//                   <XAxis dataKey="month" fontSize={10} />
//                   <YAxis fontSize={10} />
//                 </BarChart>
//               </ResponsiveContainer>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default DryoutDashboard;


import React from 'react';
import CarryForwardAnalysis from './DaywiseDryoutChart';
import DryOut from './AverageDryoutChart';

const DryoutDashboard = () => {
  // Sample location-wise dryout data
  return (
    <div className="w-full min-h-screen bg-gray-100 p-2">
      <div className="text-center text-lg font-semibold text-blue-900">
         Dryout Analysis and Carry Forward Analysis
      </div>
              <CarryForwardAnalysis  />
              {/* <DryOut/> */}
    </div>
  );
};

export default DryoutDashboard;