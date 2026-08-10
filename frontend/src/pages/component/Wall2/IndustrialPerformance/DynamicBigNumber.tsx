import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/@/components/ui/table";

const BigNumbersTable = ({ data, type, companyOrder }) => {
  if (!data || !data.length || !data[0]?.[type]) {
    return <div>No data available</div>;
  }

  // Define the desired SBU order
  const sbuOrder = ["RETAIL", "LPG", "I&C", "LUBES", "AVIATION", "NG"];

  // Separate the "TOTAL" row from the rest of the data
  let totalRow = data.find(sbu => sbu.sbu_name.toLowerCase() === "total");
  let filteredData = data.filter(sbu => sbu.sbu_name.toLowerCase() !== "total");

  // Sort the filtered data based on the defined SBU order
  const sortedData = [...filteredData].sort((a, b) => {
    const indexA = sbuOrder.indexOf(a.sbu_name.toUpperCase());
    const indexB = sbuOrder.indexOf(b.sbu_name.toUpperCase());
    
    // If both are in the order array, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one is in the order array, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // If neither is in the order array, sort alphabetically
    return a.sbu_name.localeCompare(b.sbu_name);
  });

  // Add TOTAL row at the beginning
  if (totalRow) {
    sortedData.unshift(totalRow);
  }

  // Get headers and sort by companyOrder if provided
  let headers = Object.keys(sortedData[0][type]);
  if (companyOrder && companyOrder.length > 0) {
    headers.sort((a, b) => {
      const indexA = companyOrder.indexOf(a);
      const indexB = companyOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  const formatValue = (value, type) => {
    if (value === null || value === undefined) return "-";
    if (type === "Market share" || type === "Market % Gr") {
      return `${value.toFixed(2)}%`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="flex flex-col items-start justify-center bg-gray-100/50 p-0">
      <Table className="bg-white shadow-lg rounded-lg">
        <TableHeader>
          <TableRow>
            <TableHead className="text-left font-bold text-gray-900">SBU Name</TableHead>
            {headers.map((header) => (
              <TableHead key={header} className="text-left text-xs text-gray-900 font-semibold">{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((sbu) => (
            <TableRow 
              key={sbu.sbu_name}
              className={sbu.sbu_name.toLowerCase() === "total" ? "bg-blue-50" : ""}
            >
              <TableCell 
                className={sbu.sbu_name.toLowerCase() === "total" ? "font-bold text-sm text-left uppercase" : "font-semibold text-xs text-left"}
              >
                {sbu.sbu_name.toLowerCase() === "total" ? "TOTAL" : sbu.sbu_name}
              </TableCell>
              {headers.map((key) => (
                <TableCell 
                  key={key} 
                  className={sbu.sbu_name.toLowerCase() === "total" ? "text-left text-gray-800 text-sm font-bold" : "text-left text-gray-800 text-xs font-medium"}
                >
                  {formatValue(sbu[type][key], type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default BigNumbersTable;