

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

const GaugeDataTable: React.FC<DataTableProps> = ({ data }) => {
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

export default GaugeDataTable;