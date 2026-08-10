// import React from 'react';
// import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
// import { Card } from '@/@/components/ui/card';

// interface GrowthIndicator {
//   title: string;
//   value: number;
// }

// interface GrowthRingsProps {
//   growthDetails: GrowthIndicator[];
// }

// const GrowthRings: React.FC<GrowthRingsProps> = ({ growthDetails }) => {
//   // Modify data to ensure it works with Recharts
//   const processedData = growthDetails.map(item => ({
//     name: item.title,
//     value: Math.abs(item.value),
//     originalValue: item.value
//   }));

//   return (
//     <Card className="w-full p-2 mb-2">
//       <div className="flex justify-center items-center space-x-4">
//         {processedData.map((item, index) => (
//           <div key={index} className="flex flex-col items-center">
//             <ResponsiveContainer width={100} height={100}>
//               <PieChart>
//                 <Pie
//                   data={[
//                     { name: 'value', value: item.value },
//                     { name: 'remainder', value: Math.max(100 - item.value, 0) }
//                   ]}
//                   dataKey="value"
//                   innerRadius={35}
//                   outerRadius={45}
//                   startAngle={90}
//                   endAngle={-270}
//                   paddingAngle={10}
//                 >
//                   <Cell 
//                     key={`cell-${index}`} 
//                     fill={item.originalValue >= 0 ? '#4CAF50' : '#F44336'}
//                     fillOpacity={0.8}
//                   />
//                   <Cell 
//                     key={`cell-remainder-${index}`} 
//                     fill="#E0E0E0"
//                     fillOpacity={0.4}
//                   />
//                   <Label
//                     value={item.originalValue.toFixed(2)}
//                     position="center"
//                     fill={item.originalValue >= 0 ? '#4CAF50' : '#F44336'}
//                     fontSize={12}
//                     fontWeight={700}
//                     className='bg-green-300'
//                   />
//                 </Pie>
//               </PieChart>
//             </ResponsiveContainer>
//             <div className="text-sm font-extrabold text-gray-600 mt-1">
//               {item.name}
//             </div>
//           </div>
//         ))}
//       </div>
//     </Card>
//   );
// };

// // export default GrowthRings;
// "use client"
// import type React from "react"
// import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts"
// import { Card } from "@/@/components/ui/card"

// interface GrowthIndicator {
//   title: string
//   value: number
// }

// interface GrowthRingProps {
//   indicator: GrowthIndicator
// }

// // Single Growth Ring Component
// const GrowthRing: React.FC<GrowthRingProps> = ({ indicator }) => {
//   const isPositive = indicator.value >= 0
//   const color = isPositive ? "#4CAF50" : "#F44336" // Simple green for positive, red for negative
  
//   return (
//     <Card className="w-[250px] h-[100px] p-1 shadow-md rounded-xl">
//       <div className="flex flex-col items-left ml-4">
//         <ResponsiveContainer width={90} height={90}>
//           <PieChart>
//             <Pie
//               data={[
//                 { name: "value", value: Math.abs(indicator.value) },
//                 { name: "remainder", value: Math.max(100 - Math.abs(indicator.value), 0) },
//               ]}
//               dataKey="value"
//               innerRadius={40}
//               outerRadius={45} // Thinner ring (only 10px width)
//               startAngle={90}
//               endAngle={-270}
//               cornerRadius={10}
//             >
//               <Cell key="cell-value" fill={color} />
//               <Cell key="cell-remainder" fill="#E0E0E0" fillOpacity={0.2} />
//               <Label 
//                 value={indicator.value.toFixed(2)} 
//                 position="center" 
//                 fill={color} 
//                 fontSize={14} 
//                 fontWeight={700} 
//               />
//             </Pie>
//           </PieChart>
//         </ResponsiveContainer>
//         <div className="text-xs font-semibold text-gray-700 mt-2 text-center">
//           {indicator.title}
//         </div>
//       </div>
//     </Card>
//   )
// }

// interface GrowthRingsProps {
//   growthDetails: GrowthIndicator[]
// }

// // Container Component for all Growth Rings
// const GrowthRings: React.FC<GrowthRingsProps> = ({ growthDetails }) => {
//   return (
//     <div className="flex flex-wrap gap-4 mb-2 justify-center">
//       {growthDetails.map((indicator, index) => (
//         <GrowthRing key={index} indicator={indicator} />
//       ))}
//     </div>
//   )
// }

// // export default GrowthRings
// "use client"
// import type React from "react"
// import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts"
// import { Card } from "@/@/components/ui/card"

// interface GrowthIndicator {
//   title: string
//   value: number
// }

// interface GrowthRingProps {
//   indicator: GrowthIndicator
// }

// // Single Growth Ring Component
// const GrowthRing: React.FC<GrowthRingProps> = ({ indicator }) => {
//   const isPositive = indicator.value >= 0
//   const color = isPositive ? "#4CAF50" : "#F44336" // Green for positive, red for negative
 
//   return (
//     <Card className="w-[250px]  p-1 shadow-md rounded-xl flex items-center">
//       <ResponsiveContainer width={90} height={90} className="mr-4">
//         <PieChart>
//           <Pie
//             data={[
//               { name: "value", value: Math.abs(indicator.value) },
//               { name: "remainder", value: Math.max(100 - Math.abs(indicator.value), 0) },
//             ]}
//             dataKey="value"
//             innerRadius={40}
//             outerRadius={45} // Thinner ring (only 10px width)
//             startAngle={90}
//             endAngle={-270}
//             cornerRadius={10}
//           >
//             <Cell key="cell-value" fill={color} />
//             <Cell key="cell-remainder" fill="#E0E0E0" fillOpacity={0.2} />
//             <Label
//               value={`${Math.abs(indicator.value).toFixed(1)}%`}
//               position="center"
//               fill={color}
//               fontSize={14}
//               fontWeight={700}
//             />
//           </Pie>
//         </PieChart>
//       </ResponsiveContainer>
//       <div className="flex flex-col">
//         <div className="text-xs items-center font-semibold text-gray-800">
//           {indicator.title}
//         </div>
//       </div>
//     </Card>
//   )
// }

// interface GrowthRingsProps {
//   growthDetails: GrowthIndicator[]
// }

// // Container Component for all Growth Rings
// const GrowthRings: React.FC<GrowthRingsProps> = ({ growthDetails }) => {
//   return (
//     <div className="flex flex-wrap gap-2 mb-2">
//       {growthDetails.map((indicator, index) => (
//         <GrowthRing key={index} indicator={indicator} />
//       ))}
//     </div>
//   )
// }

// // export default GrowthRings
// "use client"
// import type React from "react"
// import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts"
// import { Card } from "@/@/components/ui/card"

// interface GrowthIndicator {
//   title: string
//   value: number
// }

// interface GrowthRingProps {
//   indicator: GrowthIndicator
// }

// // Single Growth Ring Component
// const GrowthRing: React.FC<GrowthRingProps> = ({ indicator }) => {
//   const isPositive = indicator.value >= 0
//   const color = isPositive ? "#4CAF50" : "#F44336" // Green for positive, red for negative
  
//   return (
//     <Card className="w-[180px] h-[120px] p-2 shadow-md rounded-xl flex flex-col items-center justify-center">
//       <div className="text-xs font-semibold text-gray-800 mb-1 text-center">
//         {indicator.title}
//       </div>
       
//       <ResponsiveContainer width={70} height={70}>
//         <PieChart>
//           <Pie
//             data={[
//               { name: "value", value: Math.abs(indicator.value) },
//               { name: "remainder", value: Math.max(100 - Math.abs(indicator.value), 0) },
//             ]}
//             dataKey="value"
//             innerRadius={25}
//             outerRadius={30} // Thinner ring (only 5px width)
//             startAngle={90}
//             endAngle={-270}
//             cornerRadius={5}
//           >
//             <Cell key="cell-value" fill={color} />
//             <Cell key="cell-remainder" fill="#E0E0E0" fillOpacity={0.2} />
//           </Pie>
//         </PieChart>
//       </ResponsiveContainer>
      
//       <div className="text-xs font-bold mt-1" style={{ color }}>
//         {Math.abs(indicator.value).toFixed(1)}%
//       </div>
//     </Card>
//   )
// }

// interface GrowthRingsProps {
//   growthDetails: GrowthIndicator[]
// }

// // Container Component for all Growth Rings
// const GrowthRings: React.FC<GrowthRingsProps> = ({ growthDetails }) => {
//   return (
//     <div className="flex flex-wrap gap-2 mb-2">
//       {growthDetails.map((indicator, index) => (
//         <GrowthRing key={index} indicator={indicator} />
//       ))}
//     </div>
//   )
// }

// export default GrowthRings

import type React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts"
import { Card } from "@/@/components/ui/card"

interface GrowthIndicator {
  title: string
  value: number
}

interface GrowthRingProps {
  indicator: GrowthIndicator
}

// Single Growth Ring Component
const GrowthRing: React.FC<GrowthRingProps> = ({ indicator }) => {
  const isPositive = indicator.value >= 0
  const color = isPositive ? "green" : "red" // Green for positive, red for negative
  
  return (
    // w-[120px] ml-1 h-[75px] 
    <Card className="px-2 py-1 shadow-lg rounded-xl flex items-center justify-start gap-2 bg-gradient-to-r from-yellow-50 to-orange-200/50"> 
      {/* Card Content with Circle and Info */}
      <div className="flex gap-2 items-center">
        {/* <PieChart width={50} height={50}>
          <Pie
            data={[
              { name: "value", value: Math.abs(indicator.value) },
              { name: "remainder", value: Math.max(100 - Math.abs(indicator.value), 0) },
            ]}
            dataKey="value"
            innerRadius={16}
            outerRadius={21} // Thinner ring
            startAngle={90}
            endAngle={-270}
            cornerRadius={6}
          >
            <Cell key="cell-value" fill={color} />
            <Cell key="cell-remainder" fill="#fff" fillOpacity={1} />
          </Pie>
        </PieChart> */}
        <div className="flex flex-col gap-1">
          <div className={`text-lg font-extrabold text-${color}-500`}>
            {indicator.value.toFixed(1)}%
          </div>
          <div className={`text-[10px] font-semibold text-center`}>
            {indicator.title}
          </div>
        </div>
      </div>
    </Card>
  )
}

interface GrowthRingsProps {
  growthDetails: GrowthIndicator[]
}

// Container Component for all Growth Rings
const GrowthRings: React.FC<GrowthRingsProps> = ({ growthDetails }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {growthDetails.map((indicator, index) => (
        <GrowthRing key={index} indicator={indicator} />

      ))}
    </div>
  )
}

export default GrowthRings