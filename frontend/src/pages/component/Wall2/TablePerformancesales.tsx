
// import React, { useMemo } from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/@/components/ui/table";
// import { Badge } from "@/@/components/ui/badge";

// interface DynamicSalesTableProps {
//   data: any[];
//   activeStates: {
//     H: boolean;
//     A: boolean;
//     T: boolean;
//   };
//   drillLevel: number
// }

// const DynamicSalesTable: React.FC<DynamicSalesTableProps> = ({ data, activeStates, drillLevel }) => {
//   // Dynamically generate columns based on active states
//   const columns = useMemo(() => {
//     const firstColumnMap = {
//       0: 'Month',
//       1: 'Sbu',
//       2: 'Zone',
//       3: 'Region',
//       4: 'Sales Area',
//       5: 'Product',
//     };

//     const baseCols = [firstColumnMap[drillLevel] || 'Month'];
    
//     if (activeStates.A) baseCols.push('Actual (TMT)');
//     if (activeStates.H) baseCols.push('Historical (TMT)');
//     if (activeStates.T) baseCols.push('Target (TMT)');
    
//     if (activeStates.A && activeStates.H) baseCols.push('Actual vs History (%)');
//     if (activeStates.A && activeStates.T) baseCols.push('Actual vs Target (%)');
    
//     return baseCols;
//   }, [activeStates, drillLevel]);

//   // Calculate percentage difference
//   const calculatePercentageDiff = (actual: number, compare: number) => {
//     if (compare === 0) return 'N/A';
//     const diff = ((actual - compare) / compare) * 100;
//     return `${diff.toFixed(2)}%`;
//   };

//   return (
//     <Table className=" border-separate border-spacing-0 rounded-lg overflow-hidden shadow-md">
//       <TableHeader className="bg-gray-100">
//         <TableRow>
//           {columns.map((col) => (
//             <TableHead key={col} className="p-4 text-left font-bold text-gray-700 border-b border-gray-200 tracking-wider">
//               {col}
//             </TableHead>
//           ))}
//         </TableRow>
//       </TableHeader>
//       <TableBody>
//         {data.map((item, index) => (
//           <TableRow 
//             key={index} 
//             className={`hover:bg-gray-50 transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
//           >
//             {columns.map((col) => {
//               switch(col) {
//                 case 'Month':
//                 case 'Sbu':
//                 case 'Zone':
//                 case 'Region':
//                 case 'Sales Area':
//                 case 'Product':
//                   return <TableCell key={col} className="p-4 text-gray-900">{item.name} </TableCell>;
//                 case 'Actual (TMT)':
//                   return (
//                     <TableCell key={col} className="p-4">
//                       <Badge variant="secondary" className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full">
//                         {item.ACTUAL_TMT_SALES?.toLocaleString() || 'N/A'}
//                       </Badge>
//                     </TableCell>
//                   );
//                 case 'Historical (TMT)':
//                   return (
//                     <TableCell key={col} className="p-4">
//                       <Badge variant="secondary" className="bg-green-50 text-green-800 px-3 py-1 rounded-full">
//                         {item.ACTUAL_HISTORY_TMT_SALES?.toLocaleString() || 'N/A'}
//                       </Badge>
//                     </TableCell>
//                   );
//                 case 'Target (TMT)':
//                   return (
//                     <TableCell key={col} className="p-4">
//                       <Badge variant="secondary" className="bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full">
//                         {item.TARGET_TMT_SALES?.toLocaleString() || 'N/A'} 
//                       </Badge>
//                     </TableCell>
//                   );
//                 case 'Actual vs History (%)':
//                   return (
//                     <TableCell key={col} className="p-4">
//                       <Badge variant={
//                         calculatePercentageDiff(
//                           item.ACTUAL_TMT_SALES, 
//                           item.ACTUAL_HISTORY_TMT_SALES
//                         ).startsWith('-') ? 'destructive' : 'success'
//                       } className="px-3 py-1 rounded-full">
//                         {calculatePercentageDiff(
//                           item.ACTUAL_TMT_SALES, 
//                           item.ACTUAL_HISTORY_TMT_SALES
//                         )}
//                       </Badge>
//                     </TableCell>
//                   );
//                 case 'Actual vs Target (%)':
//                   return (
//                     <TableCell key={col} className="p-4">
//                       <Badge variant={
//                         calculatePercentageDiff(
//                           item.ACTUAL_TMT_SALES, 
//                           item.TARGET_TMT_SALES
//                         ).startsWith('-') ? 'destructive' : 'success'
//                       } className="px-3 py-1 rounded-full">
//                         {calculatePercentageDiff(
//                           item.ACTUAL_TMT_SALES, 
//                           item.TARGET_TMT_SALES
//                         )}
//                       </Badge>
//                     </TableCell>
//                   );
//                 default:
//                   return <TableCell key={col} className="p-4">-</TableCell>;
//               }
//             })}
//           </TableRow>
//         ))}
//       </TableBody>
//     </Table>
//   );
// };

// // export default DynamicSalesTable;
// import React, { useMemo } from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/@/components/ui/table";
// import { Badge } from "@/@/components/ui/badge";

// interface DynamicSalesTableProps {
//   data: any[];
//   activeStates: {
//     H: boolean;
//     A: boolean;
//     T: boolean;
//   };
//   drillLevel: number
// }

// const DynamicSalesTable: React.FC<DynamicSalesTableProps> = ({ data, activeStates, drillLevel }) => {
//   const columns = useMemo(() => {
//     const firstColumnMap = {
//       0: 'Month',
//       1: 'Sbu',
//       2: 'Zone',
//       3: 'Region',
//       4: 'Sales Area',
//       5: 'Product',
//     };

//     const baseCols = [firstColumnMap[drillLevel] || 'Month'];
    
//     if (activeStates.A) baseCols.push('Actual (TMT)');
//     if (activeStates.H) baseCols.push('Historical (TMT)');
//     if (activeStates.T) baseCols.push('Target (TMT)');
    
//     if (activeStates.A && activeStates.H) baseCols.push('Actual vs History (%)');
//     if (activeStates.A && activeStates.T) baseCols.push('Actual vs Target (%)');
    
//     return baseCols;
//   }, [activeStates, drillLevel]);

//   const calculatePercentageDiff = (actual: number, compare: number) => {
//     if (compare === 0) return 'N/A';
//     const diff = ((actual - compare) / compare) * 100;
//     return `${diff.toFixed(2)}%`;
//   };

//   return (
//     <Table className="border-collapse shadow-sm">
//       <TableHeader className="bg-gray-100">
//         <TableRow>
//           {columns.map((col) => (
//             <TableHead key={col} className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200">
//               {col}
//             </TableHead>
//           ))}
//         </TableRow>
//       </TableHeader>
//       <TableBody>
//         {data.map((item, index) => (
//           <TableRow 
//             key={index} 
//             className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
//           >
//             {columns.map((col) => {
//               switch(col) {
//                 case 'Month':
//                 case 'Sbu':
//                 case 'Zone':
//                 case 'Region':
//                 case 'Sales Area':
//                 case 'Product':
//                   return <TableCell key={col} className="px-3 py-2 text-gray-900">{item.name}</TableCell>;
//                 case 'Actual (TMT)':
//                   return (
//                     <TableCell key={col} className="px-3 py-2">
//                       <Badge variant="secondary" className="bg-blue-50 text-blue-800 px-2 py-0.5 text-sm">
//                         {item.ACTUAL_TMT_SALES?.toLocaleString() || 'N/A'}
//                       </Badge>
//                     </TableCell>
//                   );
//                 case 'Historical (TMT)':
//                   return (
//                     <TableCell key={col} className="px-3 py-2">
//                       <Badge variant="secondary" className="bg-green-50 text-green-800 px-2 py-0.5 text-sm">
//                         {item.ACTUAL_HISTORY_TMT_SALES?.toLocaleString() || 'N/A'}
//                       </Badge>
//                     </TableCell>
//                   );
//                 case 'Target (TMT)':
//                   return (
//                     <TableCell key={col} className="px-3 py-2">
//                       <Badge variant="secondary" className="bg-yellow-50 text-yellow-800 px-2 py-0.5 text-sm">
//                         {item.TARGET_TMT_SALES?.toLocaleString() || 'N/A'}
//                       </Badge>
//                     </TableCell>
//                   );
//                 case 'Actual vs History (%)':
//                   return (
//                     <TableCell key={col} className="px-3 py-2">
//                       <Badge variant={
//                         calculatePercentageDiff(
//                           item.ACTUAL_TMT_SALES, 
//                           item.ACTUAL_HISTORY_TMT_SALES
//                         ).startsWith('-') ? 'destructive' : 'success'
//                       } className="px-2 py-0.5 text-sm">
//                         {calculatePercentageDiff(
//                           item.ACTUAL_TMT_SALES, 
//                           item.ACTUAL_HISTORY_TMT_SALES
//                         )}
//                       </Badge>
//                     </TableCell>
//                   );
//                 case 'Actual vs Target (%)':
//                   return (
//                     <TableCell key={col} className="px-3 py-2">
//                       <Badge variant={
//                         calculatePercentageDiff(
//                           item.ACTUAL_TMT_SALES, 
//                           item.TARGET_TMT_SALES
//                         ).startsWith('-') ? 'destructive' : 'success'
//                       } className="px-2 py-0.5 text-sm">
//                         {calculatePercentageDiff(
//                           item.ACTUAL_TMT_SALES, 
//                           item.TARGET_TMT_SALES
//                         )}
//                       </Badge>
//                     </TableCell>
//                   );
//                 default:
//                   return <TableCell key={col} className="px-3 py-2">-</TableCell>;
//               }
//             })}
//           </TableRow>
//         ))}
//       </TableBody>
//     </Table>
//   );
// };

// // export default DynamicSalesTable;
// import React, { useMemo } from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/@/components/ui/table";
// import { Badge } from "@/@/components/ui/badge";
// import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

// interface DynamicSalesTableProps {
//   data: any[];
//   activeStates: {
//     H: boolean;
//     A: boolean;
//     T?: boolean;
//   };
//   drillLevel: number;
//   salesUnit?: string;
//   mode?: string;
// }

// const DynamicSalesTable: React.FC<DynamicSalesTableProps> = ({ data, activeStates, drillLevel,salesUnit="TMT", mode }) => {
//   const columns = useMemo(() => {
//     let firstColumnMap: any = {};
//     mode === "cumulative" ? 
//       firstColumnMap = {
//         0: 'Month',
//         1: 'Zone',
//         2: 'Region',
//         3: 'Sales Area',
//         4: 'Product',
//         5: 'Month'
//       } : firstColumnMap = {
//         0: 'Month',
//         1: 'Sbu',
//         2: 'Zone',
//         3: 'Region',
//         4: 'Sales Area',
//         5: 'Product',
//       }

//     const baseCols = [firstColumnMap[drillLevel] || 'Month'];
    
//     if (activeStates.A) baseCols.push(`Act (${salesUnit})`);
//     if (activeStates.H) baseCols.push(`Hist (${salesUnit})`);
//     if (activeStates.T) baseCols.push(`Tgt (${salesUnit})`);
    
//     if (activeStates.A && activeStates.H) baseCols.push('Act vs Hist (%)');
//     if (activeStates.A && activeStates.T) baseCols.push('Act vs Tgt (%)');
    
//     return baseCols;
//   }, [activeStates, drillLevel,salesUnit]);

//   const calculatePercentageDiff = (actual: number, compare: number) => {
//     if (compare === 0) return { value: 'N/A', isPositive: false };
//     const diff = ((actual - compare) / compare) * 100;
//     return { 
//       value: `${Math.abs(diff).toFixed(1)}%`,
//       isPositive: diff >= 0
//     };
//   };

//   return (
//     <div className=" shadow-sm h-[450px]">
//       <div className="h-full overflow-auto">
//         <Table className="border-collapse shadow-sm text-xs">
//           <TableHeader className="bg-gray-100">
//             <TableRow>
//               {columns.map((col) => (
//                 <TableHead
//                   key={col}
//                   className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 text-xs"
//                 >
//                   {col}
//                 </TableHead>
//               ))}
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {data.map((item, index) => (
//               <TableRow
//                 key={index}
//                 className={`h-[30px] hover:bg-gray-50 ${
//                   index % 2 === 0 ? "bg-white" : "bg-gray-50"
//                 }`}
//               >
//                 {columns.map((col) => {
//                   switch (col) {
//                     case "Month":
//                     case "Sbu":
//                     case "Zone":
//                     case "Region":
//                     case "Sales Area":
//                     case "Product":
//                       return (
//                         <TableCell
//                           key={col}
//                           className="px-3 py-2 text-gray-900 text-xs"
//                         >
//                           {item.name}
//                         </TableCell>
//                       );
//                     case `Act (${salesUnit})`:
//                       return (
//                         <TableCell key={col} className="px-3 py-2">
//                           <Badge
//                             variant="secondary"
//                             className="bg-blue-50 text-gray-900 px-2 py-0.5 text-xs"
//                           >
//                             {Math.round(item.ACTUAL_TMT_SALES)?.toLocaleString() || "N/A"}
//                           </Badge>
//                         </TableCell>
//                       );
//                     case `Hist (${salesUnit})`:
//                       return (
//                         <TableCell key={col} className="px-3 py-2">
//                           <Badge
//                             variant="secondary"
//                             className="bg-green-50 text-gray-900 px-2 py-0.5 text-xs"
//                           >
//                             {Math.round(item.ACTUAL_HISTORY_TMT_SALES)?.toLocaleString() ||
//                               "N/A"}
//                           </Badge>
//                         </TableCell>
//                       );
//                     case `Tgt (${salesUnit})`:
//                       return (
//                         <TableCell key={col} className="px-3 py-2">
//                           <Badge
//                             variant="secondary"
//                             className="bg-yellow-50 text-gray-900 px-2 py-0.5 text-xs"
//                           >
//                             {Math.round(item.TARGET_TMT_SALES)?.toLocaleString() || "N/A"}
//                           </Badge>
//                         </TableCell>
//                       );
//                     case "Act vs Hist (%)":
//                     case "Act vs Tgt (%)": {
//                       const comparison = calculatePercentageDiff(
//                         item.ACTUAL_TMT_SALES,
//                         col === "Act vs Hist (%)"
//                           ? item.ACTUAL_HISTORY_TMT_SALES
//                           : item.TARGET_TMT_SALES
//                       );
//                       return (
//                         <TableCell key={col} className="px-3 py-2">
//                           <div className="flex items-start gap-1 text-gray-900 text-xs">
//                             {comparison.value !== "N/A" &&
//                               (comparison.isPositive ? (
//                                 <ArrowUpIcon className="w-4 h-4 text-green-600" />
//                               ) : (
//                                 <ArrowDownIcon className="w-4 h-4 text-red-600" />
//                               ))}
//                             {comparison.value}
//                           </div>
//                         </TableCell>
//                       );
//                     }
//                     default:
//                       return (
//                         <TableCell key={col} className="px-3 py-2 text-xs">
//                           -
//                         </TableCell>
//                       );
//                   }
//                 })}
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </div>
//     </div>
//   );
// };

// export default DynamicSalesTable;


import React, { useMemo } from 'react';
import { Badge } from "@/@/components/ui/badge";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

interface DynamicSalesTableProps {
  data: any[];
  activeStates: {
    H: boolean;
    A: boolean;
    T?: boolean;
  };
  drillLevel: number;
  salesUnit?: string;
  mode?: string;
}

const DynamicSalesTable: React.FC<DynamicSalesTableProps> = ({ data, activeStates, drillLevel, salesUnit="TMT", mode }) => {
  const columns = useMemo(() => {
    let firstColumnMap: any = {};
    mode === "cumulative" ? 
      firstColumnMap = {
        0: 'Month',
        1: 'Zone',
        2: 'Region',
        3: 'Sales Area',
        4: 'Product',
        5: 'Month'
      } : firstColumnMap = {
        0: 'Month',
        1: 'Sbu',
        2: 'Zone',
        3: 'Region',
        4: 'Sales Area',
        5: 'Product',
      }

    const baseCols = [firstColumnMap[drillLevel] || 'Month'];
    
    if (activeStates.A) baseCols.push(`Act (${salesUnit})`);
    if (activeStates.H) baseCols.push(`Hist (${salesUnit})`);
    if (activeStates.T) baseCols.push(`Tgt (${salesUnit})`);
    
    if (activeStates.A && activeStates.H) baseCols.push('Act vs Hist (%)');
    if (activeStates.A && activeStates.T) baseCols.push('Act vs Tgt (%)');
    
    return baseCols;
  }, [activeStates, drillLevel, salesUnit]);

  const formatValue = (value) => {
    if (value === undefined || value === null) return "N/A";
    // For values less than 10, show with one decimal place
    if (Math.abs(value) < 10) {
      return value.toFixed(1).toLocaleString();
    }
    // For values 10 or higher, round them
    return Math.round(value).toLocaleString();
  };

  const calculatePercentageDiff = (actual: number, compare: number) => {
    if (compare === 0) return { value: 'N/A', isPositive: false };
    const diff = ((actual - compare) / compare) * 100;
    return { 
      value: `${Math.abs(diff).toFixed(1)}%`,
      isPositive: diff >= 0
    };
  };

  return (
    <div className="shadow-sm h-[450px] overflow-y-auto overflow-x-auto rounded-lg">
      <table className="border-separate border-spacing-0 text-xs w-full">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 text-xs sticky top-0 bg-gray-100 z-10 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={index}
              className={`h-[30px] hover:bg-gray-50 transition-colors ${
                index % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              {columns.map((col) => {
                switch (col) {
                  case "Month":
                  case "Sbu":
                  case "Zone":
                  case "Region":
                  case "Sales Area":
                  case "Product":
                    return (
                      <td key={col} className="px-3 py-2 text-gray-900 text-xs border-b border-gray-100">
                        {item.name}
                      </td>
                    );
                  case `Act (${salesUnit})`:
                    return (
                      <td key={col} className="px-3 py-2 border-b border-gray-100">
                        <Badge variant="secondary" className="bg-blue-50 text-gray-900 px-2 py-0.5 text-xs">
                          {formatValue(item.ACTUAL_TMT_SALES)}
                        </Badge>
                      </td>
                    );
                  case `Hist (${salesUnit})`:
                    return (
                      <td key={col} className="px-3 py-2 border-b border-gray-100">
                        <Badge variant="secondary" className="bg-green-50 text-gray-900 px-2 py-0.5 text-xs">
                          {formatValue(item.ACTUAL_HISTORY_TMT_SALES)}
                        </Badge>
                      </td>
                    );
                  case `Tgt (${salesUnit})`:
                    return (
                      <td key={col} className="px-3 py-2 border-b border-gray-100">
                        <Badge variant="secondary" className="bg-yellow-50 text-gray-900 px-2 py-0.5 text-xs">
                          {formatValue(item.TARGET_TMT_SALES)}
                        </Badge>
                      </td>
                    );
                  case "Act vs Hist (%)":
                  case "Act vs Tgt (%)": {
                    const comparison = calculatePercentageDiff(
                      item.ACTUAL_TMT_SALES,
                      col === "Act vs Hist (%)"
                        ? item.ACTUAL_HISTORY_TMT_SALES
                        : item.TARGET_TMT_SALES
                    );
                    return (
                      <td key={col} className="px-3 py-2 border-b border-gray-100">
                        <div className="flex items-start gap-1 text-gray-900 text-xs">
                          {comparison.value !== "N/A" &&
                            (comparison.isPositive ? (
                              <ArrowUpIcon className="w-4 h-4 text-green-600" />
                            ) : (
                              <ArrowDownIcon className="w-4 h-4 text-red-600" />
                            ))}
                          {comparison.value}
                        </div>
                      </td>
                    );
                  }
                  default:
                    return (
                      <td key={col} className="px-3 py-2 text-xs border-b border-gray-100">-</td>
                    );
                }
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DynamicSalesTable;