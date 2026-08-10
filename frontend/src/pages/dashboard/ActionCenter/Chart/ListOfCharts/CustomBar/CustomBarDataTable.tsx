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

// const CustomBarDataTable: React.FC<DataTableProps> = ({ data }) => {
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
//                   className="font-bold text-black sticky top-0 bg-white z-10"
//                   style={{ top: 0 }}
//                 >
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

// export default CustomBarDataTable;



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

const CustomBarDataTable: React.FC<DataTableProps> = ({ data }) => {
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
                <TableHead key={header} className="text-white">
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

export default CustomBarDataTable;