// import React from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "../../../../../../@/components/ui/data-table";

// interface DataTableProps {
//   data: Array<Record<string, any>>;
// }

// const DataTable: React.FC<DataTableProps> = ({ data }) => {
//   if (!data || data.length === 0) {
//     return <p>No data available.</p>;
//   }

//   const headers = Object.keys(data[0]);

//   return (
//     <div className="w-full overflow-auto">
//       <Table>
//         <TableHeader>
//           <TableRow>
//             {headers.map((header) => (
//               <TableHead key={header}>{header}</TableHead>
//             ))}
//           </TableRow>
//         </TableHeader>
//         <TableBody>
//           {data.map((row, index) => (
//             <TableRow key={index}>
//               {headers.map((header) => (
//                 <TableCell key={`${index}-${header}`}>{row[header]}</TableCell>
//               ))}
//             </TableRow>
//           ))}
//         </TableBody>
//       </Table>
//     </div>
//   );
// };

// // export default DataTable;
// import React from 'react';
// import {
//     Table,
//     TableBody,
//     TableCell,
//     TableHead,
//     TableHeader,
//     TableRow,
//   } from "../../../../../../@/components/ui/data-table";
  
//   interface DataTableProps {
//     data: Array<Record<string, any>>;
//   }
  
//   const PieDataTable: React.FC<DataTableProps> = ({ data }) => {
//     if (!data || data.length === 0) {
//       return <p>No data available.</p>;
//     }
  
//     const headers = Object.keys(data[0]);
  
//     return (
//       <div className="w-full">
//         <div className="overflow-hidden border rounded-lg">
//           <Table>
//             <TableHeader className="bg-white sticky top-0">
//               <TableRow>
//                 {headers.map((header) => (
//                   <TableHead key={header} className="font-bold text-black">
//                     {header}
//                   </TableHead>
//                 ))}
//               </TableRow>
//             </TableHeader>
//           </Table>
//         </div>
//         <div className="max-h-[300px] overflow-auto">
//           <Table>
//             <TableBody>
//               {data.map((row, index) => (
//                 <TableRow key={index}>
//                   {headers.map((header) => (
//                     <TableCell key={`${index}-${header}`}>{row[header]}</TableCell>
//                   ))}
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </div>
//       </div>
//     );
//   };
  
// //   export default PieDataTable;
// import React from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "../../../../../../@/components/ui/data-table";

// interface DataTableProps {
//   data: Array<Record<string, any>>;
// }

// const PieDataTable: React.FC<DataTableProps> = ({ data }) => {
//   if (!data || data.length === 0) {
//     return <p>No data available.</p>;
//   }

//   const headers = Object.keys(data[0]);

//   return (
//     <div className="w-full">
//       <div className="overflow-hidden border rounded-lg">
//         <Table>
//           <TableHeader className="bg-white sticky top-0 z-10">
//             <TableRow>
//               {headers.map((header) => (
//                 <TableHead key={header} className="font-bold text-black">
//                   {header}
//                 </TableHead>
//               ))}
//             </TableRow>
//           </TableHeader>
//         </Table>
//       </div>
//       <div className="max-h-[300px] overflow-auto">
//         <Table>
//           <TableBody>
//             {data.map((row, index) => (
//               <TableRow key={index}>
//                 {headers.map((header) => (
//                   <TableCell key={`${index}-${header}`}>{row[header]}</TableCell>
//                 ))}
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </div>
//     </div>
//   );
// };

// // export default PieDataTable;
// import React from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "../../../../../../@/components/ui/data-table";

// interface DataTableProps {
//   data: Array<Record<string, any>>;
// }

// const PieDataTable: React.FC<DataTableProps> = ({ data }) => {
//   if (!data || data.length === 0) {
//     return <p>No data available.</p>;
//   }

//   const headers = Object.keys(data[0]);

//   return (
//     <div className="w-full">
//       <div className="overflow-hidden border rounded-lg">
//         <Table>
//           <TableHeader className="bg-white">
//             <TableRow>
//               {headers.map((header) => (
//                 <TableHead 
//                   key={header} 
//                   className="font-bold text-black sticky top-0 bg-white z-10" // Make header sticky
//                   style={{ top: 0 }}
//                 >
//                   {header}
//                 </TableHead>
//               ))}
//             </TableRow>
//           </TableHeader>
//         </Table>
//       </div>
//       <div className="max-h-[300px] overflow-auto"> {/* Scrollable table body */}
//         <Table>
//           <TableBody>
//             {data.map((row, index) => (
//               <TableRow key={index}>
//                 {headers.map((header) => (
//                   <TableCell key={`${index}-${header}`}>
//                     {row[header]}
//                   </TableCell>
//                 ))}
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </div>
//     </div>
//   );
// };

// // export default PieDataTable;
// import React from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "../../../../../../@/components/ui/data-table";

// interface DataTableProps {
//   data: Array<Record<string, any>>;
// }

// const PieDataTable: React.FC<DataTableProps> = ({ data }) => {
//   if (!data || data.length === 0) {
//     return <p>No data available.</p>;
//   }

//   const headers = Object.keys(data[0]);

//   return (
//     <div className="w-full overflow-x-auto">
//       <Table>
//         <TableHeader>
//           <TableRow>
//             {headers.map((header) => (
//               <TableHead
//                 key={header}
//                 className="font-bold text-black bg-white py-2 px-4"
//               >
//                 {header}
//               </TableHead>
//             ))}
//           </TableRow>
//         </TableHeader>
//         <TableBody>
//           {data.map((row, index) => (
//             <TableRow key={index}>
//               {headers.map((header) => (
//                 <TableCell key={`${index}-${header}`} className="py-2 px-4">
//                   {row[header]}
//                 </TableCell>
//               ))}
//             </TableRow>
//           ))}
//         </TableBody>
//       </Table>
//     </div>
//   );
// };

// export default PieDataTable;

// import React from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "../../../../../../@/components/ui/data-table";

// interface DataTableProps {
//   data: Array<Record<string, any>>;
// }

// const PieDataTable: React.FC<DataTableProps> = ({ data }) => {
//   if (!data || data.length === 0) {
//     return <p>No data available.</p>;
//   }

//   const headers = Object.keys(data[0]);

//   return (
//     <div className="w-full h-[400px] overflow-hidden">
//       <div className="overflow-x-auto">
//         <Table>
//           <TableHeader className="sticky top-0 bg-white z-10">
//             <TableRow>
//               {headers.map((header) => (
//                 <TableHead
//                   key={header}
//                   className="font-bold text-black py-2 px-4"
//                 >
//                   {header}
//                 </TableHead>
//               ))}
//             </TableRow>
//           </TableHeader>
//         </Table>
//       </div>
//       <div className="overflow-y-auto h-[calc(100%-40px)]">
//         <Table>
//           <TableBody>
//             {data.map((row, index) => (
//               <TableRow key={index}>
//                 {headers.map((header) => (
//                   <TableCell key={`${index}-${header}`} className="py-2 px-4">
//                     {row[header]}
//                   </TableCell>
//                 ))}
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </div>
//     </div>
//   );
// };

// export default PieDataTable;

// import React from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "../../../../../../@/components/ui/data-table";

// interface DataTableProps {
//   data: Array<Record<string, any>>;
// }

// const PieDataTable: React.FC<DataTableProps> = ({ data }) => {
//   if (!data || data.length === 0) {
//     return <p>No data available.</p>;
//   }

//   const headers = Object.keys(data[0]);

//   return (
//     <div className="bg-white">
//       <Table>
//         <TableHeader>
//           <TableRow className="bg-[#0047AB] hover:bg-[#0047AB] hover:text-white">
//             {headers.map((header) => (
//               <TableHead key={header} className="text-white">
//                 {header}
//               </TableHead>
//             ))}
//           </TableRow>
//         </TableHeader>
//         <TableBody>
//           {data.map((row, index) => (
//             <TableRow key={index} className="h-10">
//               {headers.map((header) => (
//                 <TableCell key={`${index}-${header}`} className="py-1">
//                   {row[header]}
//                 </TableCell>
//               ))}
//             </TableRow>
//           ))}
//         </TableBody>
//       </Table>
//     </div>
//   );
// };

// export default PieDataTable;


// import React from 'react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "../../../../../../@/components/ui/data-table";

// interface DataTableProps {
//   data: Array<Record<string, any>>;
// }

// const PieDataTable: React.FC<DataTableProps> = ({ data }) => {
//   if (!data || data.length === 0) {
//     return <p>No data available.</p>;
//   }

//   const headers = Object.keys(data[0]);

//   return (
//     <div className="bg-white">
//       <div className="max-h-[250px] overflow-y-auto">
//         <Table>
//           <TableHeader>
//             <TableRow className="bg-[#0047AB] hover:bg-[#0047AB] hover:text-white sticky top-0">
//               {headers.map((header) => (
//                 <TableHead key={header} className="text-white">
//                   {header}
//                 </TableHead>
//               ))}
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {data.slice(0, 5).map((row, index) => (
//               <TableRow key={index} className="h-10">
//                 {headers.map((header) => (
//                   <TableCell key={`${index}-${header}`} className="py-1">
//                     {row[header]}
//                   </TableCell>
//                 ))}
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </div>
//       {data.length > 5 && (
//         <div className="max-h-[200px] overflow-y-auto">
//           <Table>
//             <TableBody>
//               {data.slice(5).map((row, index) => (
//                 <TableRow key={index + 5} className="h-10">
//                   {headers.map((header) => (
//                     <TableCell key={`${index + 5}-${header}`} className="py-1">
//                       {row[header]}
//                     </TableCell>
//                   ))}
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </div>
//       )}
//     </div>
//   );
// };

// export default PieDataTable;


import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../../@/components/ui/data-table-custom";

interface DataTableProps {
  data: Array<Record<string, any>>;
}

const PieDataTable: React.FC<DataTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No data available.</p>;
  }

  const headers = Object.keys(data[0]);

  return (
    <div className="bg-white">
      <div className="max-h-[250px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#0047AB] hover:bg-[#0047AB] hover:text-white sticky top-0 z-10 h-10">
              {headers.map((header) => (
                <TableHead key={header} className="text-white py-1">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index} className="h-10">
                {headers.map((header) => (
                  <TableCell key={`${index}-${header}`} className="py-1">
                    {row[header]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PieDataTable;