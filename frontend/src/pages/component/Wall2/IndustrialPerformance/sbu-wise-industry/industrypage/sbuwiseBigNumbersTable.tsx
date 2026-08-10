import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/@/components/ui/table";

interface TableRowData {
  sbu_name?: string;
  zone_name?: string;
  [key: string]: any;
}

interface SbuWiseBigNumbersTableProps {
  data: TableRowData[];
  type: string;
  companyOrder: string[];
}

const SbuWiseBigNumbersTable: React.FC<SbuWiseBigNumbersTableProps> = ({ data, type, companyOrder }) => {
  if (!data || data.length === 0) {
    return null;
  }

  const normalizedData = data.map(item => ({
    ...item,
    displayName: item.sbu_name || item.zone_name || ''
  }));

  const sbuOrder = ["RETAIL", "LPG", "I&C", "LUBES", "AVIATION", "NG"];

  let totalRow = normalizedData.find(item => item.displayName?.toLowerCase() === "total");
  let filteredData = normalizedData.filter(item => item.displayName?.toLowerCase() !== "total");

  const sortedData = [...filteredData].sort((a, b) => {
    const nameA = a.displayName?.toUpperCase() || '';
    const nameB = b.displayName?.toUpperCase() || '';
    const indexA = sbuOrder.indexOf(nameA);
    const indexB = sbuOrder.indexOf(nameB);
    
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    return nameA.localeCompare(nameB);
  });

  if (totalRow) {
    sortedData.unshift(totalRow);
  }

  const firstValidRow = sortedData.find(row => row[type]);
  if (!firstValidRow) {
    return null;
  }

  let headers = Object.keys(firstValidRow[type]);
  if (companyOrder?.length > 0) {
    headers.sort((a, b) => {
      const indexA = companyOrder.indexOf(a);
      const indexB = companyOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  const formatValue = (value: number | null | undefined, metricType: string) => {
    if (value === null || value === undefined || isNaN(Number(value))) return "-";
    
    const numValue = Number(value);

    if (metricType === "Growth") {
      return `${numValue.toFixed(1)}%`;
    }
    if (["Market Share", "Market % Gr", "Market Share History"].includes(metricType)) {
      return `${numValue.toFixed(2)}%`;
    }
    return numValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="flex flex-col items-start justify-center bg-gray-100/50 p-0">
      <Table className="bg-white shadow-lg rounded-lg">
        <TableHeader>
          <TableRow>
            <TableHead className="text-left font-bold text-gray-900">Name</TableHead>
            {headers.map((header) => (
              <TableHead key={header} className="text-left text-xs text-gray-900 font-semibold">{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((item) => (
            <TableRow 
              key={item.displayName}
              className={item.displayName?.toLowerCase() === "total" ? "bg-blue-50" : ""}
            >
              <TableCell 
                className={item.displayName?.toLowerCase() === "total" ? "font-bold text-sm text-left uppercase" : "font-semibold text-xs text-left"}
              >
                {item.displayName?.toLowerCase() === "total" ? "TOTAL" : item.displayName}
              </TableCell>
              {headers.map((key) => (
                <TableCell 
                  key={key} 
                  className={item.displayName?.toLowerCase() === "total" ? "text-left text-gray-800 text-sm font-bold" : "text-left text-gray-800 text-xs font-medium"}
                >
                  {formatValue(item[type]?.[key], type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default SbuWiseBigNumbersTable;
