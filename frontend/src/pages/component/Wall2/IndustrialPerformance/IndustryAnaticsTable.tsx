import React, { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const getCurrentYears = () => {
  const currentYear = new Date().getFullYear();
  return [`${currentYear - 1}-${currentYear}`, `${currentYear}-${currentYear + 1}`];
};

const [year1, year2] = getCurrentYears();

interface IndustryPerformanceTableProps {
  data: any[];
  company?: string[];
}

const IndustryPerformanceTable: React.FC<IndustryPerformanceTableProps> = ({ data }) => {
  const rowData = data;

  console.log(rowData);

  const columnDefs: any = [
    { headerName: "SBU", field: "SBU", rowGroup: true, rowExpand: true, hide: true },
    { headerName: "PROD", field: "PROD", pinned: "left", width: 150 },
    {
      headerName: "HPCL",
      children: [
        { headerName: "Sales", children: [
            { headerName: year1, field: `HPCL_Sales_${year1}`, width: 100 },
            { headerName: year2, field: `HPCL_Sales_${year2}`, width: 100 }
          ]
        },
        { headerName: "% Gr", children: [
            { headerName: year1, field: `HPCL_Gr_${year1}`, width: 100 },
            { headerName: year2, field: `HPCL_Gr_${year2}`, width: 100 }
          ]
        },
        { headerName: "Mkt Sh %", children: [
            { headerName: year1, field: `HPCL_MktSh_${year1}`, width: 100 },
            { headerName: year2, field: `HPCL_MktSh_${year2}`, width: 100 }
          ]
        }
      ]
    },
    {
      headerName: "BPCL",
      children: [
        { headerName: "Sales", children: [
            { headerName: year1, field: `BPCL_Sales_${year1}`, width: 100 },
            { headerName: year2, field: `BPCL_Sales_${year2}`, width: 100 }
          ]
        },
        { headerName: "% Gr", children: [
            { headerName: year1, field: `BPCL_Gr_${year1}`, width: 100 },
            { headerName: year2, field: `BPCL_Gr_${year2}`, width: 100 }
          ]
        },
        { headerName: "Mkt Sh %", children: [
            { headerName: year1, field: `BPCL_MktSh_${year1}`, width: 100 },
            { headerName: year2, field: `BPCL_MktSh_${year2}`, width: 100 }
          ]
        }
      ]
    },
    {
      headerName: "IOC",
      children: [
        { headerName: "Sales", children: [
            { headerName: year1, field: `IOC_Sales_${year1}`, width: 100 },
            { headerName: year2, field: `IOC_Sales_${year2}`, width: 100 }
          ]
        },
        { headerName: "% Gr", children: [
            { headerName: year1, field: `IOC_Gr_${year1}`, width: 100 },
            { headerName: year2, field: `IOC_Gr_${year2}`, width: 100 }
          ]
        },
        { headerName: "Mkt Sh %", children: [
            { headerName: year1, field: `IOC_MktSh_${year1}`, width: 100 },
            { headerName: year2, field: `IOC_MktSh_${year2}`, width: 100 }
          ]
        }
      ]
    }
  ];

  return (
    <div className="ag-theme-alpine" style={{ height: 500, width: "100%" }}>
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={{ resizable: true, sortable: true, filter: true }}
        groupDisplayType="groupRows"
        animateRows={true}
        suppressAggFuncInHeader={true}
        rowDragManaged={true}
        rowGroupPanelShow="always"
        pivotPanelShow="always"
        groupDefaultExpanded={-1} // Expands all groups by default
      />
    </div>
  );
};

export default IndustryPerformanceTable;



// import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
// import { AgGridReact } from "ag-grid-react";
// import 'ag-grid-enterprise';
// import "ag-grid-community/styles/ag-grid.css";
// import "ag-grid-community/styles/ag-theme-alpine.css";
// import { Input } from "@/@/components/ui/input";

// interface IndustryPerformanceTableProps {
//   data?: any[];
//   companies?: string[];
// }

// // Extract unique years from data
// const extractYearsFromData = (data) => {
//   if (!data || data.length === 0 || !data[0]) return [];
//   const yearKeys = Object.keys(data[0]).filter(key => key.match(/\d{4}-\d{4}/));
//   return [...new Set(yearKeys.map(key => key.match(/\d{4}-\d{4}/)[0]))].sort();
// };

// // Sample data if none is provided
// const sampleData = [
//   {
//       "SBU": "AVIATION",
//       "PROD": "ATF",
//       "BPCL_Sales_2023-2024": 140176,
//       "BPCL_Gr_2023-2024": 100,
//       "BPCL_MktSh_2023-2024": 21.3,
//       "HPCL_Sales_2023-2024": 70641,
//       "HPCL_Gr_2023-2024": 100,
//       "HPCL_MktSh_2023-2024": 10.8,
//       "IOCL_Sales_2023-2024": 392530,
//       "IOCL_Gr_2023-2024": 100,
//       "IOCL_MktSh_2023-2024": 59.8,
//       "BPCL_Sales_2024-2025": 167862,
//       "BPCL_Gr_2024-2025": 19.8,
//       "BPCL_MktSh_2024-2025": 23.1,
//       "HPCL_Sales_2024-2025": 83413,
//       "HPCL_Gr_2024-2025": 18.1,
//       "HPCL_MktSh_2024-2025": 11.5,
//       "IOCL_Sales_2024-2025": 379539,
//       "IOCL_Gr_2024-2025": -3.3,
//       "IOCL_MktSh_2024-2025": 52.3
//   }
// ];

// // Default companies if none are provided
// const defaultCompanies = ["HPCL", "BPCL", "IOCL"];

// // Cell style function for growth and market share comparison
// const cellStyleFunction = (params) => {
//   if (!params?.value && params.value !== 0) return null;
  
//   // Get field information
//   if (params.colDef.field.includes("Gr") || params.colDef.field.includes("MktSh")) {
//     const fieldParts = params.colDef.field.split("_");
//     if (fieldParts.length < 3) return null;

//     const company = fieldParts[0];
//     const metric = fieldParts[1];
//     const year = fieldParts[2];
    
//     // Get all years
//     const years = extractYearsFromData([params.data]);
//     const currentYearIndex = years.indexOf(year);
    
//     // Only proceed if we have valid years for comparison
//     if (currentYearIndex === -1 || currentYearIndex >= years.length - 1) return null;
    
//     const nextYear = years[currentYearIndex + 1];
    
//     const currentValue = params.data[`${company}_${metric}_${year}`];
//     const nextValue = params.data[`${company}_${metric}_${nextYear}`];
    
//     // For growth values
//     if (metric === "Gr") {
//       if (params.value < 0) {
//         return { color: "red", fontWeight: "bold" };
//       } else if (params.value > 0) {
//         return { color: "green", fontWeight: "bold" };
//       }
//     }
    
//     // For market share comparison
//     if (metric === "MktSh" && currentValue !== undefined && nextValue !== undefined) {
//       if (currentValue > nextValue) {
//         return { color: "red", fontWeight: "bold" };
//       } else if (currentValue < nextValue) {
//         return { color: "green", fontWeight: "bold" };
//       }
//     }
    
//     // Default color for other non-negative values
//     return { color: "black" };
//   }
  
//   return null;
// };

// // Theme configuration based on the table in the image
// const gridTheme = {
//   '--ag-header-foreground-color': 'black',
//   '--ag-header-background-color': 'rgba(142, 210, 236, 1)',
//   '--ag-header-cell-hover-background-color': 'rgba(124, 192, 218, 1)',
//   '--ag-font-size': '13px',
//   '--ag-font-family': 'Arial, sans-serif',
//   '--ag-row-hover-color': 'rgba(9, 122, 209, 0.1)',
//   '--ag-selected-row-background-color': 'rgb(219, 237, 249)',
//   '--ag-odd-row-background-color': 'white',
//   '--ag-even-row-background-color': 'white',
//   '--ag-header-column-resize-handle-color': 'black',
//   '--ag-border-color': '#ccc',
//   '--ag-cell-horizontal-border': 'solid 1px var(--ag-border-color)',
//   '--ag-cell-vertical-border': 'solid 1px var(--ag-border-color)'
// } as React.CSSProperties;

// const IndustryPerformanceTable: React.FC<IndustryPerformanceTableProps> = ({ data, companies }) => {
//   const gridRef = useRef<any>(null);
//   const [rowData, setRowData] = useState(data);
//   const [years, setYears] = useState<string[]>([]);
//   const [searchText, setSearchText] = useState("");

//   useEffect(() => {
//     if (data && data.length > 0) {
//       setRowData(data);
//       setYears(extractYearsFromData(data));
//     }
//   }, [data]);

//   // Create a total row for each SBU
//   const calculateSbuTotals = useMemo(() => {
//     if (!rowData || rowData.length === 0) return [];
    
//     // Group by SBU
//     const sbuGroups = rowData.reduce((groups, item) => {
//       const sbu = item.SBU;
//       if (!groups[sbu]) groups[sbu] = [];
//       groups[sbu].push(item);
//       return groups;
//     }, {});
    
//     // Calculate totals for each SBU and each company
//     const totals = Object.keys(sbuGroups).map(sbu => {
//       const items = sbuGroups[sbu];
//       const totalRow = {
//         SBU: sbu,
//         PROD: `${sbu} TOTAL`
//       };
      
//       // Calculate for each company, metric and year
//       companies.forEach(company => {
//         years.forEach(year => {
//           // Sales totals
//           totalRow[`${company}_Sales_${year}`] = items.reduce(
//             (sum, item) => sum + (Number(item[`${company}_Sales_${year}`]) || 0), 0
//           );
          
//           // Calculate growth based on total sales
//           const prevTotalSales = items.reduce(
//             (sum, item) => sum + (Number(item[`${company}_Sales_${years[0]}`]) || 0), 0
//           );
//           const currentTotalSales = totalRow[`${company}_Sales_${year}`];
          
//           if (year !== years[0] && prevTotalSales > 0) {
//             totalRow[`${company}_Gr_${year}`] = ((currentTotalSales / prevTotalSales) - 1) * 100;
//           } else {
//             totalRow[`${company}_Gr_${year}`] = 0;
//           }
          
//           // Market share is the percentage of company sales vs all companies
//           const allCompaniesSales = companies.reduce(
//             (sum, comp) => sum + (totalRow[`${comp}_Sales_${year}`] || 0), 0
//           );
          
//           if (allCompaniesSales > 0) {
//             totalRow[`${company}_MktSh_${year}`] = (totalRow[`${company}_Sales_${year}`] / allCompaniesSales) * 100;
//           } else {
//             totalRow[`${company}_MktSh_${year}`] = 0;
//           }
//         });
//       });
      
//       return totalRow;
//     });
    
//     return totals;
//   }, [rowData, companies, years]);

//   // Column definitions
//   const columnDefs: any = useMemo(() => {
//     if (years.length === 0) return [];
    
//     // Sort years in reverse order (newest first)
//     const sortedYears = [...years].sort().reverse();
//     const latestYear = sortedYears[0];
//     const previousYear = sortedYears[1];
    
//     return [
//       { 
//         headerName: "SBU", 
//         field: "SBU", 
//         rowGroup: true, 
//         enableRowGroup: true, 
//         hide: true,
//         cellStyle: { fontWeight: "bold" }
//       },
//       { 
//         headerName: "Product / Category", 
//         field: "PROD", 
//         pinned: "left", 
//         enableRowGroup: true, 
//         width: 180,
//         cellStyle: params => {
//           return { 
//             fontWeight: params.data.PROD.includes("TOTAL") ? "bold" : "normal"
//           };
//         }
//       },
//       ...companies.map(company => ({
//         headerName: company,
//         children: [
//           {
//             headerName: "Sales (TMT)",
//             children: [
//               {
//                 headerName: latestYear.replace("-", "-"),
//                 field: `${company}_Sales_${latestYear}`,
//                 width: 110,
//                 valueFormatter: params => Number(params.value).toLocaleString('en-IN', {
//                   maximumFractionDigits: 1
//                 })
//               },
//               {
//                 headerName: previousYear.replace("-", "-"),
//                 field: `${company}_Sales_${previousYear}`,
//                 width: 110,
//                 valueFormatter: params => Number(params.value).toLocaleString('en-IN', {
//                   maximumFractionDigits: 1
//                 })
//               },
//               {
//                 headerName: "% Gr",
//                 field: `${company}_Gr_${latestYear}`,
//                 width: 85,
//                 cellStyle: params => {
//                   if (params.value < 0) {
//                     return { color: "red", fontWeight: "bold" };
//                   } else if (params.value > 0) {
//                     return { color: "green", fontWeight: "bold" };
//                   }
//                   return null;
//                 },
//                 valueFormatter: params => {
//                   if (params.value === 100) return "";
//                   return Number(params.value).toFixed(1);
//                 }
//               }
//             ]
//           },
//           {
//             headerName: "Mkt Sh. (%)",
//             children: [
//               {
//                 headerName: latestYear.replace("-", "-"),
//                 field: `${company}_MktSh_${latestYear}`,
//                 width: 85,
//                 valueFormatter: params => Number(params.value).toFixed(2)
//               },
//               {
//                 headerName: previousYear.replace("-", "-"),
//                 field: `${company}_MktSh_${previousYear}`,
//                 width: 85,
//                 valueFormatter: params => Number(params.value).toFixed(2)
//               },
//               {
//                 headerName: "G/L",
//                 width: 85,
//                 valueGetter: params => {
//                   const latestMktSh = params.data[`${company}_MktSh_${latestYear}`];
//                   const prevMktSh = params.data[`${company}_MktSh_${previousYear}`];
//                   return latestMktSh - prevMktSh;
//                 },
//                 cellStyle: params => {
//                   if (params.value < 0) {
//                     return { 
//                       color: "red", 
//                       fontWeight: "bold",
//                       backgroundColor: "rgba(255, 200, 200, 0.5)" 
//                     };
//                   } else if (params.value > 0) {
//                     return { color: "green", fontWeight: "bold" };
//                   }
//                   return { color: "black" };
//                 },
//                 valueFormatter: params => Number(params.value).toFixed(2)
//               }
//             ]
//           }
//         ]
//       })),
//       {
//         headerName: "OMC TOTAL",
//         children: [
//           {
//             headerName: "Sales (TMT)",
//             children: [
//               {
//                 headerName: latestYear.replace("-", "-"),
//                 width: 110,
//                 valueGetter: params => {
//                   return companies.reduce((total, company) => {
//                     return total + (params.data[`${company}_Sales_${latestYear}`] || 0);
//                   }, 0);
//                 },
//                 valueFormatter: params => Number(params.value).toLocaleString('en-IN', {
//                   maximumFractionDigits: 1
//                 })
//               },
//               {
//                 headerName: "% Gr",
//                 width: 85,
//                 valueGetter: params => {
//                   const currentTotal = companies.reduce((total, company) => {
//                     return total + (params.data[`${company}_Sales_${latestYear}`] || 0);
//                   }, 0);
                  
//                   const prevTotal = companies.reduce((total, company) => {
//                     return total + (params.data[`${company}_Sales_${previousYear}`] || 0);
//                   }, 0);
                  
//                   if (prevTotal === 0) return 0;
//                   return ((currentTotal / prevTotal) - 1) * 100;
//                 },
//                 cellStyle: params => {
//                   if (params.value < 0) {
//                     return { color: "red", fontWeight: "bold" };
//                   } else if (params.value > 0) {
//                     return { color: "green", fontWeight: "bold" };
//                   }
//                   return null;
//                 },
//                 valueFormatter: params => Number(params.value).toFixed(1)
//               }
//             ]
//           }
//         ]
//       }
//     ];
//   }, [companies, years]);

//   // Default column definition
//   const defaultColDef = useMemo(() => ({
//     resizable: true,
//     sortable: true,
//     filter: true,
//     wrapHeaderText: true,
//     autoHeaderHeight: true,
//   }), []);

//   // Grid ready handler
//   const onGridReady = useCallback((params) => {
//     gridRef.current = params.api;
//     params.api.sizeColumnsToFit();
//   }, []);

//   // Filter data based on search text
//   const filteredData = useMemo(() => {
//     if (!searchText) {
//       // Combine original data with calculated SBU totals
//       return [...rowData, ...calculateSbuTotals];
//     }
    
//     // Filter based on search text
//     const filtered = rowData.filter((row) =>
//       Object.values(row).some((value) =>
//         value?.toString().toLowerCase().includes(searchText.toLowerCase())
//       )
//     );
    
//     // Also filter the SBU totals that match
//     const matchedSbus = new Set(filtered.map(row => row.SBU));
//     const matchedTotals = calculateSbuTotals.filter(total => matchedSbus.has(total.SBU));
    
//     return [...filtered, ...matchedTotals];
//   }, [rowData, calculateSbuTotals, searchText]);

//   return (
//     <div>
//       <div className="flex justify-between items-center mb-4">
//         <h1 className='text-lg font-bold'>Industry Performance Analytics</h1>
//         <div className="flex gap-3">
//           <Input
//             placeholder="Search..."
//             value={searchText}
//             onChange={(e) => setSearchText(e.target.value)}
//             className="w-64 h-8"
//           />
//         </div>
//       </div>
//       <div className="ag-theme-alpine" style={{ ...gridTheme, height: 600, width: "100%" }}>
//         <AgGridReact
//           ref={gridRef}
//           rowData={filteredData}
//           columnDefs={columnDefs}
//           defaultColDef={defaultColDef}
//           animateRows={true}
//           groupDefaultExpanded={-1}
//           suppressAggFuncInHeader={true}
//           groupDisplayType="groupRows"
//           rowDragManaged={true}
//           sideBar={true}
//           onGridReady={onGridReady}
//         />
//       </div>
//     </div>
//   );
// };

// export default IndustryPerformanceTable;





// import React, { useState, useCallback, useEffect } from "react";
// import { AgGridReact } from "ag-grid-react";
// import "ag-grid-community/styles/ag-grid.css";
// import "ag-grid-community/styles/ag-theme-alpine.css";
// import { Input } from "@/@/components/ui/input";

// interface IndustryPerformanceTableProps {
//   data: any[];
//   company: string[];
// }

// const extractYearsFromData = (data) => {
//   const yearKeys = Object.keys(data[0]).filter(key => key.match(/\d{4}-\d{4}/));
//   const uniqueYears = [...new Set(yearKeys.map(key => key.match(/\d{4}-\d{4}/)[0]))];
//   return uniqueYears.sort();
// };

// const cellStyleFunction = (params) => {
//   if (params.colDef.field.includes("MktSh") || params.colDef.field.includes("Gr")) {
//     const fieldParts = params.colDef.field.split("_"); // Example: ["HPCL", "MktSh", "2023-2024"]
//     if (fieldParts.length < 3) return null;

//     const company = fieldParts[0]; // HPCL, BPCL, or IOC
//     const metric = fieldParts[1]; // Gr or MktSh
//     const years = extractYearsFromData([params.data]); // ["2023-2024", "2024-2025"]
    
//     if (years.length < 2) return null; // Ensure two years exist for comparison

//     const currentYear = years[0]; // 2023-2024
//     const nextYear = years[1]; // 2024-2025

//     // Ensure we're only styling the 2023-2024 column
//     if (!params.colDef.field.endsWith(currentYear)) return null;

//     const currentYearValue = params.data[`${company}_${metric}_${currentYear}`];
//     const nextYearValue = params.data[`${company}_${metric}_${nextYear}`];

//     if (currentYearValue > nextYearValue) {
//       return { color: "green", fontWeight: "bold" };
//     } else {
//       return { color: "red", fontWeight: "bold" };
//     }
//   }
//   return null;
// };

// const IndustryPerformanceTable: React.FC<IndustryPerformanceTableProps> = ({
//   data, company
// }) => {
//   const [rowData, setRowData] = useState([
//     {
//       SBU: "LPG",
//       PROD: "LPG-BULK",
//       "HPCL_Sales_2023-2024": 299.1,
//       "HPCL_Sales_2024-2025": 252.8,
//       "HPCL_Gr_2023-2024": 145.3,
//       "HPCL_Gr_2024-2025": 245.4,
//       "HPCL_MktSh_2023-2024": 60.2,
//       "HPCL_MktSh_2024-2025": 49.6,
//       "BPCL_Sales_2023-2024": 103.0,
//       "BPCL_Sales_2024-2025": 112.7,
//       "BPCL_Gr_2023-2024": 18.7,
//       "BPCL_Gr_2024-2025": 28.7,
//       "BPCL_MktSh_2023-2024": 20.7,
//       "BPCL_MktSh_2024-2025": 22.1,
//       "IOC_Sales_2023-2024": 95.0,
//       "IOC_Sales_2024-2025": 122.5,
//       "IOC_Gr_2023-2024": 28.9,
//       "IOC_Gr_2024-2025": 35.6,
//       "IOC_MktSh_2023-2024": 19.1,
//       "IOC_MktSh_2024-2025": 28.3,
//     },
//   ]);

//   const [years, setYears] = useState<string[]>([]);

//   useEffect(() => {
//     setYears(extractYearsFromData(rowData));
//   }, [rowData]);

//   const columnDefs: any = [
//     { headerName: "SBU", field: "SBU", rowGroup: true, hide: true },
//     { headerName: "PROD", field: "PROD", pinned: "left", width: 150 },
//     ...["HPCL", "BPCL", "IOC"].map(company => ({
//       headerName: company,
//       children: [
//         { headerName: "Sales", children: years.map(year => ({ headerName: year, field: `${company}_Sales_${year}`, width: 100 })) },
//         { headerName: "% Gr", children: years.map(year => ({ headerName: year, field: `${company}_Gr_${year}`, width: 100, cellStyle: cellStyleFunction })) },
//         { headerName: "Mkt Sh %", children: years.map(year => ({ headerName: year, field: `${company}_MktSh_${year}`, width: 100, cellStyle: cellStyleFunction })) }
//       ]
//     }))
//   ]

//   const [searchText, setSearchText] = useState("");

//   const onGridReady = useCallback((params) => {
//     params.api.setGridOption("rowDragManaged", true);
//     params.api.setGridOption("columnMoveable", true);
//   }, []);

//   return (
//     <div>
//       <Input 
//         placeholder="Search..." 
//         value={searchText} 
//         onChange={(e) => setSearchText(e.target.value)} 
//         className="mb-4 w-full max-w-sm" 
//       />
//       <div className="ag-theme-alpine" style={{ height: 500, width: "100%" }}>
//         <AgGridReact
//           rowData={rowData.filter(row =>
//             Object.values(row).some(value =>
//               value.toString().toLowerCase().includes(searchText.toLowerCase())
//             )
//           )}
//           columnDefs={columnDefs}
//           defaultColDef={{ resizable: true, sortable: true, filter: true, headerClass: "custom-header" }}
//           groupDisplayType="groupRows"
//           animateRows={true}
//           suppressAggFuncInHeader={true}
//           groupDefaultExpanded={-1} // Expands all groups by default
//           rowDragManaged={true}
//           enableRangeSelection={true}
//           onGridReady={onGridReady}
//         />
//       </div>
//       <style>{`
//         :global(.custom-header) {
//           background-color: darkblue !important;
//           color: white !important;
//         }
//       `}</style>
//     </div>
//   );
// };

// export default IndustryPerformanceTable;
