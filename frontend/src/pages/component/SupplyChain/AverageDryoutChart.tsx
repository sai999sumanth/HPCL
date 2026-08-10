// import { useEffect, useRef } from 'react';
// import * as am5 from '@amcharts/amcharts5';
// import * as am5xy from '@amcharts/amcharts5/xy';
// import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
// import { AverageDryoutData } from './utils/dryout';

// const sampleData: AverageDryoutData[] = [
//   { category: "Location A", value: 25 },
//   { category: "Location B", value: 18 },
//   { category: "Location C", value: 30 },
//   { category: "Location D", value: 15 }
// ];

// export function AverageDryoutChart() {
//   const chartRef = useRef<am5.Root | null>(null);

//   useEffect(() => {
//     const root = am5.Root.new("averageDryoutChart");
//     root._logo?.dispose();
    
//     root.setThemes([am5themes_Animated.new(root)]);

//     const chart = root.container.children.push(
//       am5xy.XYChart.new(root, {
//         panX: false,
//         panY: false,
//         wheelX: "none",
//         wheelY: "none",
//         layout: root.verticalLayout,
//         paddingLeft: 0,
//         paddingRight: 0
//       })
//     );

//     const xAxis = chart.xAxes.push(
//       am5xy.CategoryAxis.new(root, {
//         categoryField: "category",
//         renderer: am5xy.AxisRendererX.new(root, {
//           minGridDistance: 30
//         }),
//         tooltip: am5.Tooltip.new(root, {})
//       })
//     );

//     xAxis.get("renderer").labels.template.setAll({
//       fontSize: 12,
//       paddingTop: 0
//     });

//     const yAxis = chart.yAxes.push(
//       am5xy.ValueAxis.new(root, {
//         renderer: am5xy.AxisRendererY.new(root, {})
//       })
//     );

//     yAxis.get("renderer").labels.template.setAll({
//       fontSize: 12,
//       paddingRight: 4
//     });

//     const series = chart.series.push(
//       am5xy.ColumnSeries.new(root, {
//         name: "Average Dryout",
//         xAxis: xAxis,
//         yAxis: yAxis,
//         valueYField: "value",
//         categoryXField: "category",
//         tooltip: am5.Tooltip.new(root, {
//           pointerOrientation: "horizontal",
//           labelText: "{categoryX}: [bold]{valueY}[/]"
//         })
//       })
//     );

//     series.columns.template.setAll({
//       tooltipY: 0,
//       strokeOpacity: 0,
//       cornerRadiusTL: 3,
//       cornerRadiusTR: 3,
//       width: am5.percent(90),
//       fill: am5.color("#0ea5e9")
//     });

//     series.set("tooltip", am5.Tooltip.new(root, {
//       pointerOrientation: "horizontal",
//       labelText: "{categoryX}: [bold]{valueY}[/]"
//     }));

//     xAxis.data.setAll(sampleData);
//     series.data.setAll(sampleData);

//     chartRef.current = root;

//     return () => {
//       root.dispose();
//     };
//   }, []);

//   return (
//     <div className="bg-white p-4 rounded-lg shadow-lg mt-4">
//       <h2 className="text-lg font-semibold mb-2">Average Dryout Analysis</h2>
//       <div id="averageDryoutChart" style={{ width: "100%", height: "350px" }}></div>
//     </div>
//   );
// }


// import React from 'react';
// import { 
//   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
//   BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Area
// } from 'recharts';

// // Sample data
// const indentData = [
//   { date: '2023-12-01', placed: 150, processed: 130, pending: 20 },
//   { date: '2023-12-02', placed: 160, processed: 140, pending: 20 },
//   { date: '2023-12-03', placed: 140, processed: 120, pending: 20 },
//   { date: '2023-12-04', placed: 170, processed: 150, pending: 20 },
//   { date: '2023-12-05', placed: 155, processed: 135, pending: 20 },
// ];

// const dryOutAgeingData = [
//   { age: '0-30 days', count: 45 },
//   { age: '31-60 days', count: 30 },
//   { age: '61-90 days', count: 15 },
//   { age: '90+ days', count: 10 },
// ];

// const r1r2r3Data = [
//   { date: '2023-12-01', r1: 150, r2: 130, r3: 120 },
//   { date: '2023-12-02', r1: 160, r2: 140, r3: 130 },
//   { date: '2023-12-03', r1: 140, r2: 120, r3: 110 },
//   { date: '2023-12-04', r1: 170, r2: 150, r3: 140 },
// ];

// const catADealerData = [
//   { dealer: 'Dealer A', dryOuts: 15, frequency: 25 },
//   { dealer: 'Dealer B', dryOuts: 12, frequency: 20 },
//   { dealer: 'Dealer C', dryOuts: 8, frequency: 15 },
//   { dealer: 'Dealer D', dryOuts: 5, frequency: 10 },
// ];

// const terminalComparisonData = [
//   { terminal: 'Terminal A', r3Count: 95, benchmark: 90 },
//   { terminal: 'Terminal B', r3Count: 88, benchmark: 90 },
//   { terminal: 'Terminal C', r3Count: 92, benchmark: 90 },
//   { terminal: 'Terminal D', r3Count: 85, benchmark: 90 },
// ];

// function DryOut() {
//   return (
//     <div className="min-h-screen bg-gray-100 p-2">
//       <h1 className="text-xl font-bold mb-6">Terminal Analytics Dashboard</h1>
      
//       <div className="grid grid-cols-3 gap-2">
//         {/* 1. Dry Out Ageing Pattern */}
//         <div className="bg-white p-2 rounded-lg shadow-lg">
//           <h2 className="text-sm font-semibold mb-4">1. Dry Out Ageing Pattern Analysis</h2>
//           <ResponsiveContainer width="100%" height={400}>
//             <BarChart data={dryOutAgeingData}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="age" />
//               <YAxis />
//               <Tooltip />
//               <Legend />
//               <Bar dataKey="count" name="Number of Dry Outs" fill="#8884d8">
//                 {dryOutAgeingData.map((entry, index) => (
//                   <Cell key={`cell-${index}`} fill={index === 3 ? '#ff4444' : '#8884d8'} />
//                 ))}
//               </Bar>
//             </BarChart>
//           </ResponsiveContainer>
//         </div>

//         {/* 2. Indent Analysis */}
//         <div className="bg-white p-2 rounded-lg shadow-lg">
//           <h2 className="text-sm font-semibold mb-4">2. Indent Analysis</h2>
//           <ResponsiveContainer width="100%" height={400}>
//             <ComposedChart data={indentData}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="date" />
//               <YAxis />
//               <Tooltip />
//               <Legend />
//               <Bar dataKey="placed" name="Indents Placed" fill="#2196F3" />
//               <Bar dataKey="processed" name="Indents Processed" fill="#4CAF50" />
//               <Line type="monotone" dataKey="pending" name="Pending (Carry Forward)" stroke="#FF5722" />
//             </ComposedChart>
//           </ResponsiveContainer>
         
//         </div>

//         {/* 3. CAT A Dealer Pattern */}
//         <div className="bg-white p-2 rounded-lg shadow-lg">
//           <h2 className="text-sm font-semibold mb-4">3. CAT A Dealers Dry Out Pattern</h2>
//           <ResponsiveContainer width="100%" height={400}>
//             <BarChart data={catADealerData}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="dealer" />
//               <YAxis />
//               <Tooltip />
//               <Legend />
//               <Bar dataKey="dryOuts" name="Dry Outs" fill="#FF5722" />
//               <Bar dataKey="frequency" name="Visit Frequency" fill="#2196F3" />
//             </BarChart>
//           </ResponsiveContainer>
         
//         </div>

//         {/* 4. Terminal Performance Comparison */}
//         <div className="bg-white p-2 rounded-lg shadow-lg">
//           <h2 className="text-sm font-semibold mb-4">4. Terminal Performance (OI Benchmarking)</h2>
//           <ResponsiveContainer width="100%" height={400}>
//             <ComposedChart data={terminalComparisonData}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="terminal" />
//               <YAxis />
//               <Tooltip />
//               <Legend />
//               <Bar dataKey="r3Count" name="R3 Count" fill="#4CAF50" />
//               <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#FF5722" strokeWidth={2} />
//             </ComposedChart>
//           </ResponsiveContainer>
          
//         </div>

//         {/* 5. R1-R2-R3 Analysis */}
//         <div className="bg-white p-2 rounded-lg shadow-lg">
//           <h2 className="text-sm font-semibold mb-4">5. R1-R2-R3 Serviceability Analysis</h2>
//           <ResponsiveContainer width="100%" height={400}>
//             <LineChart data={r1r2r3Data}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="date" />
//               <YAxis />
//               <Tooltip />
//               <Legend />
//               <Line type="monotone" dataKey="r1" name="R1 (Indents Placed)" stroke="#2196F3" strokeWidth={2} />
//               <Line type="monotone" dataKey="r2" name="R2 (Processing)" stroke="#4CAF50" strokeWidth={2} />
//               <Line type="monotone" dataKey="r3" name="R3 (Completed)" stroke="#FFC107" strokeWidth={2} />
//             </LineChart>
//           </ResponsiveContainer>
         
//         </div>
//       </div>
//     </div>
//   );
// }

// export default DryOut;


import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Area,
  RadialBar,
  RadialBarChart,
  AreaChart
} from 'recharts';

// Sample data
const indentData = [
  { date: '2023-12-01', placed: 150, processed: 130, pending: 20 },
  { date: '2023-12-02', placed: 160, processed: 140, pending: 20 },
  { date: '2023-12-03', placed: 140, processed: 120, pending: 20 },
  { date: '2023-12-04', placed: 170, processed: 150, pending: 20 },
  { date: '2023-12-05', placed: 155, processed: 135, pending: 20 },
];

const dryOutAgeingData = [
  { age: '0-30 days', count: 45 },
  { age: '31-60 days', count: 30 },
  { age: '61-90 days', count: 15 },
  { age: '90+ days', count: 10 },
];

const r1r2r3Data = [
  { date: '2023-12-01', r1: 150, r2: 130, r3: 120 },
  { date: '2023-12-02', r1: 160, r2: 140, r3: 130 },
  { date: '2023-12-03', r1: 140, r2: 120, r3: 110 },
  { date: '2023-12-04', r1: 170, r2: 150, r3: 140 },
];

const catADealerData = [
  { dealer: 'Dealer A', dryOuts: 15, frequency: 25 },
  { dealer: 'Dealer B', dryOuts: 12, frequency: 20 },
  { dealer: 'Dealer C', dryOuts: 8, frequency: 15 },
  { dealer: 'Dealer D', dryOuts: 5, frequency: 10 },
];

const terminalComparisonData = [
  { terminal: 'Terminal A', r3Count: 95, benchmark: 90 },
  { terminal: 'Terminal B', r3Count: 88, benchmark: 90 },
  { terminal: 'Terminal C', r3Count: 92, benchmark: 90 },
  { terminal: 'Terminal D', r3Count: 85, benchmark: 90 },
];

const plantProductivityData = [
  { date: '2023-12-01', r1_total: 100, r1_dryout: 20, r2_gantry: 70, r3_moving: 60 },
  { date: '2023-12-02', r1_total: 110, r1_dryout: 25, r2_gantry: 75, r3_moving: 65 },
  { date: '2023-12-03', r1_total: 90, r1_dryout: 15, r2_gantry: 65, r3_moving: 55 },
  { date: '2023-12-04', r1_total: 120, r1_dryout: 30, r2_gantry: 80, r3_moving: 70 },
];

const imsProductData = [
  { name: 'Dryout', value: 30 },
  { name: 'Intra Day Dry Out', value: 20 },
  { name: 'Potential Dry Out', value: 15 },
  { name: 'Delta', value: 35 },
];

const plantZoneData = [
  { month: 'Dec', total: 1200, wip: 300, pending: 200, r2: 400, r3: 300 },
  { month: '01/12', total: 1000, wip: 250, pending: 150, r2: 350, r3: 250 },
  { month: '11/12', total: 800, wip: 200, pending: 100, r2: 300, r3: 200 },
];

const indentStatusData = [
  { date: '2023-12-01', total: 500, dryOut: 50, catA: 200, catADryOut: 20 },
  { date: '2023-12-02', total: 550, dryOut: 55, catA: 220, catADryOut: 22 },
  { date: '2023-12-03', total: 480, dryOut: 48, catA: 190, catADryOut: 19 },
  { date: '2023-12-04', total: 520, dryOut: 52, catA: 210, catADryOut: 21 },
];

const roInactiveData = [
  { month: 'Oct', inactive: 5 },
  { month: 'Nov', inactive: 8 },
  { month: 'Dec', inactive: 3 },
];


function DryOut() {
  return (
    <div className="min-h-screen bg-gray-100 p-2">
      <h1 className="text-sm font-bold mb-2">Terminal Analytics Dashboard</h1>
      
      <div className="grid grid-cols-3 gap-2">
        {/* 1. Dry Out Ageing Pattern */}
        <div className="bg-white p-2 rounded-lg shadow-lg">
          <h2 className="text-sm font-semibold mb-4">1. Dry Out Ageing Pattern Analysis</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dryOutAgeingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }}  />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="count" name="Number of Dry Outs" fill="#8884d8">
                {dryOutAgeingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 3 ? '#ff4444' : '#8884d8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Indent Analysis */}
        <div className="bg-white p-2 rounded-lg shadow-lg">
          <h2 className="text-sm font-semibold mb-4">2. Indent Analysis</h2>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={indentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }}  />
              <YAxis tick={{ fontSize: 10 }}  />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="placed" name="Indents Placed" fill="#2196F3" />
              <Bar dataKey="processed" name="Indents Processed" fill="#4CAF50" />
              <Line type="monotone" dataKey="pending" name="Pending (Carry Forward)" stroke="#FF5722" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

       {/* 3. CAT A Dealer Dry Out Frequency Against Terminal */}
<div className="bg-white p-2 rounded-lg shadow-lg">
  <h2 className="text-sm font-semibold mb-4">3. CAT A Dealers Dry Out Frequency Against Terminal</h2>
  <ResponsiveContainer width="100%" height={250}>
    <BarChart data={catADealerData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="terminal" tick={{ fontSize: 10 }} />
      <YAxis tick={{ fontSize: 10 }} />
      <Tooltip contentStyle={{ fontSize: 12 }} />
       <Legend wrapperStyle={{ fontSize: 10 }} />
      <Bar dataKey="dryOuts" name="Dry Outs" fill="#FF5722" />
      <Bar dataKey="frequency" name="Visit Frequency" fill="#2196F3" />
    </BarChart>
  </ResponsiveContainer>
</div>
{/* 4. CAT A Dealer Dry Out Pattern Trend Analysis */}
<div className="bg-white p-2 rounded-lg shadow-lg">
  <h2 className="text-sm font-semibold mb-4">4. CAT A Dealers Dry Out Pattern Trend Analysis</h2>
  <ResponsiveContainer width="100%" height={250}>
    <LineChart data={catADealerData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="timePeriod" tick={{ fontSize: 10 }} />
      <YAxis tick={{ fontSize: 10 }}  />
      <Tooltip contentStyle={{ fontSize: 12 }} />
      <Legend wrapperStyle={{ fontSize: 10 }} />
      <Line type="monotone" dataKey="dryOuts" name="Dry Outs" stroke="#FF5722" />
    </LineChart>
  </ResponsiveContainer>
</div>


        {/* 5. Terminal Performance Comparison */}
        <div className="bg-white p-2 rounded-lg shadow-lg">
          <h2 className="text-sm font-semibold mb-4">5. Terminal Performance (OI Benchmarking)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={terminalComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="terminal" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="r3Count" name="R3 Count" fill="#4CAF50" />
              <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#FF5722" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
  {/* Plant-wise Distribution */}
  <div className="bg-white p-2 rounded-lg shadow-lg">
          <h2 className="text-sm font-semibold mb-2">6. Total Indents Distribution by Status</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={plantZoneData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="wip" name="WIP" stackId="a" fill="#8884d8" />
              <Bar dataKey="pending" name="Pending" stackId="a" fill="#82ca9d" />
              <Bar dataKey="r2" name="R2" stackId="a" fill="#ffc658" />
              <Bar dataKey="r3" name="R3" stackId="a" fill="#ff8042" />
            </BarChart>
          </ResponsiveContainer>
        </div>
  {/* Indent Processing Analysis */}
  <div className="bg-white p-2 rounded-lg shadow-lg">
          <h2 className="text-sm font-semibold mb-2">7. Indent Processing Analysis</h2>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={indentStatusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="total" name="Total Indents" fill="#8884d8" />
              <Line type="monotone" dataKey="dryOut" name="Dry Outs" stroke="#ff4444" />
              <Line type="monotone" dataKey="catA" name="CAT A" stroke="#82ca9d" />
              <Line type="monotone" dataKey="catADryOut" name="CAT A Dry Outs" stroke="#ffc658" />
            </ComposedChart>
          </ResponsiveContainer>
         
        </div>
 {/* RO Inactivity Trend */}
 <div className="bg-white p-2 rounded-lg shadow-lg">
          <h2 className="text-sm font-semibold mb-2">8. RO Inactivity Analysis (Last 3 Months)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={roInactiveData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="inactive" name="Inactive ROs" fill="#ff4444" stroke="#ff4444" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {/* R1-R2-R3 Analysis */}
        <div className="bg-white p-2 rounded-lg shadow-lg">
          <h2 className="text-sm font-semibold mb-2">9. R1-R2-R3 Serviceability Analysis</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={r1r2r3Data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }}/>
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="r1" name="R1 (Indents Placed)" stroke="#2196F3" strokeWidth={2} />
              <Line type="monotone" dataKey="r2" name="R2 (Processing)" stroke="#4CAF50" strokeWidth={2} />
              <Line type="monotone" dataKey="r3" name="R3 (Completed)" stroke="#FFC107" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Plant Productivity Analysis */}
        <div className="bg-white p-2 rounded-lg shadow-lg">
          <h2 className="text-sm font-semibold mb-2">10. Plant Productivity Analysis</h2>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={plantProductivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="r1_total" name="R1 Total Indents" fill="#8884d8" />
              <Bar dataKey="r1_dryout" name="R1 Dry Outs" fill="#ff4444" />
              <Line type="monotone" dataKey="r2_gantry" name="R2 Gantry" stroke="#82ca9d" />
              <Line type="monotone" dataKey="r3_moving" name="R3 Moving" stroke="#ffc658" />
            </ComposedChart>
          </ResponsiveContainer>
         
          </div>
        {/* IMS Product Analysis */}
        <div className="bg-white p-2 rounded-lg shadow-lg">
  <h2 className="text-xs font-semibold mb-2">11. IMS - Total Indents Per Plant by Product</h2>
  <ResponsiveContainer width="100%" height={250}>
    <PieChart>
      <Pie
        data={imsProductData}
        innerRadius={70}  // Reduced size
        outerRadius={100}  // Reduced size
        paddingAngle={5}
        dataKey="value"
        // label={({ name, value }) => `${name}: ${value}`}
        // labelStyle={{ fontSize: '8px' }}  // Reduced label font size
      >
        {imsProductData.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index]} />
        ))}
      </Pie>
      <Tooltip contentStyle={{ fontSize: '10px' }} />  {/* Reduced font size */}
      <Legend wrapperStyle={{ fontSize: '8px' }} />  {/* Reduced font size */}
    </PieChart>
  </ResponsiveContainer>
</div>

        
       
      </div>
    </div>
  );
}

export default DryOut;
