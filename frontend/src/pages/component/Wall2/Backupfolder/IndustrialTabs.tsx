// import React from 'react';
// import { Tabs, TabsList, TabsTrigger } from '@/@/components/ui/tabs';

// const businessTabs = [
//   'Performance',
//   'Retail',
//   'LPG',
//   'I&C',
//   'Lubes',
//   'Aviation',
//   'PETCHEM',
//   'NG'
// ];

// const ExcelStyleTabs = () => {
//   return (
//     <div className="w-full bg-gray-100 p-2">
//       <Tabs defaultValue={businessTabs[0]} className="w-full">
//         <TabsList className="flex h-10 items-center justify-start bg-transparent gap-1 p-0">
//           {businessTabs.map((tab) => (
//             <TabsTrigger
//               key={tab}
//               value={tab}
//               className="relative px-4 py-2 h-full data-[state=active]:bg-white data-[state=active]:border-t data-[state=active]:border-l data-[state=active]:border-r data-[state=active]:border-gray-200 data-[state=active]:text-blue-600 data-[state=active]:rounded-t data-[state=active]:shadow-none hover:bg-gray-200 hover:text-gray-900 data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-gray-200/80"
//             >
//               {tab}
//               {/* Active tab bottom border override */}
//               <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 hidden data-[state=active]:block" />
//             </TabsTrigger>
//           ))}
//         </TabsList>
//       </Tabs>
//     </div>
//   );
// };

// // export default ExcelStyleTabs;
// import React from 'react';
// import { Tabs, TabsList, TabsTrigger } from '@/@/components/ui/tabs';

// const businessTabs = [
//   'Performance',
//   'Retail',
//   'LPG',
//   'I&C',
//   'Lubes',
//   'Aviation',
//   'PETCHEM',
//   'NG'
// ];

// const ExcelStyleTabs = () => {
//   return (
//     <div className="w-full bg-gray-100 p-1">
//       <Tabs defaultValue={businessTabs[0]} className="w-full">
//         <TabsList className="flex h-6 items-center justify-start bg-transparent gap-0.5 p-0">
//           {businessTabs.map((tab) => (
//             <TabsTrigger
//               key={tab}
//               value={tab}
//               className="relative px-2 py-1.5 h-full text-xs 
//               data-[state=active]:bg-white data-[state=active]:border-t data-[state=active]:border-l data-[state=active]:border-r data-[state=active]:border-gray-200 data-[state=active]:text-blue-600 data-[state=active]:rounded-t data-[state=active]:shadow-none hover:bg-black hover:text-black data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-gray-200/80"
//             >
//               {tab}
//               {/* Active tab bottom border override */}
//               <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 hidden data-[state=active]:block" />
//             </TabsTrigger>
//           ))}
//         </TabsList>
//       </Tabs>
//     </div>
//   );
// };

// export default ExcelStyleTabs;
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/@/components/ui/tabs';

const businessTabs = [
  'Performance',
  'Retail',
  'LPG',
  'I&C',
  'Lubes',
  'Aviation',
  'PETCHEM',
  'NG'
];

const ExcelStyleTabs = () => {
  return (
    <div className="w-full bg-gray-100 p-1">
      <Tabs defaultValue={businessTabs[0]} className="w-full">
        <TabsList className="flex h-6 items-center justify-start bg-transparent gap-0.5 p-0">
          {businessTabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="relative px-2 py-1.5 h-full text-xs text-gray
              data-[state=active]:bg-white data-[state=active]:border-t data-[state=active]:border-l data-[state=active]:border-r 
              data-[state=active]:border-gray-200 data-[state=active]:text-black data-[state=active]:rounded-t 
              data-[state=active]:shadow-none hover:bg-gray-200 hover:text-black 
              data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-gray-200/80"
            >
              {tab}
              {/* Active tab bottom border override */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 hidden data-[state=active]:block" />
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};

export default ExcelStyleTabs;
