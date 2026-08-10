import React, { useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {
  ClientSideRowModelModule,
  ColDef,
  ColGroupDef,
  ModuleRegistry,
  SizeColumnsToContentStrategy,
  SizeColumnsToFitGridStrategy,
  SizeColumnsToFitProvidedWidthStrategy,
} from "ag-grid-community";

interface RetailSalesPerformanceTableProps {
  props: any[];
  onZoneClick: (data: any) => void;
  selectedZoneName?: string;
}

const RetailSalesPerformanceTable: React.FC<RetailSalesPerformanceTableProps> = ({ props, onZoneClick, selectedZoneName }) => {
  // Filter out rows with invalid Zone_Name values
  const rowData = (props ?? []).filter((row) => {
    const name = row?.Zone_Name;
    return name && String(name).trim() !== "" && String(name).trim() !== "-" && String(name).trim() !== "0";
  });
  
  // Function to calculate percentage
  const calculatePercentage = (actual: number, history: number): string => {
    if (!history || history === 0) return ""; // Return empty string instead of NaN
    return (Math.min(100, Math.max(-100, ((actual - history) / history) * 100))).toFixed(1);
  };
  
  const calculateTargetPercentage = (actual: number, target: number): string => {
    if (!target || target === 0) return ""; // Return empty string instead of NaN
    return (Math.min(100, Math.max(-100, ((actual - target) / target) * 100))).toFixed(1);
  };

  const calculateHistoryTotal = (data: any): number | null => {
    const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    let total = 0;
    let validValues = 0;

    months.forEach(month => {
      const avsH = calculatePercentage(
        data[`${month}_actual`] || 0,
        data[`${month}_history`] || 0
      );
      if (avsH !== "") {
        total += parseFloat(avsH);
        validValues++;
      }
    });

    return validValues > 0 ? total / validValues : null;
  };

  const calculateTargetTotal = (data: any): number | null => {
    const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    let total = 0;
    let validValues = 0;

    months.forEach(month => {
      const avsT = calculateTargetPercentage(
        data[`${month}_actual`] || 0,
        data[`${month}_target`] || 0
      );
      if (avsT !== "") {
        total += parseFloat(avsT);
        validValues++;
      }
    });

    return validValues > 0 ? total / validValues : null;
  };
  
  const autoSizeStrategy = useMemo<
    | SizeColumnsToFitGridStrategy
    | SizeColumnsToFitProvidedWidthStrategy
    | SizeColumnsToContentStrategy
  >(() => {
    return {
      type: "fitCellContents",
    };
  }, []);

  const columnDefs: (ColDef | ColGroupDef)[] = [
    {
      headerName: "Zone name",
      field: "Zone_Name",
      width: 155,
      minWidth: 155,
      maxWidth: 255,
      pinned: 'left',
      cellRenderer: (params: any) => (
        <span
          className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => {
            if (gridApiRef.current) {
              gridApiRef.current.deselectAll();
              params.node.setSelected(true);
              onZoneClick(params.data);
            }
          }}
        >
          {params.value}
        </span>
      ),
    },
    {
      headerName: "Total",
      children: [
        {
          headerName: "Act",
          field: "Total_Actual",
          minWidth: 100,
          valueGetter: (params: any) => {
            const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
            return months.reduce((sum, m) => sum + (params.data[`${m}_actual`] || 0), 0);
          },
          valueFormatter: (params: any) => params.value ? Math.round(params.value).toString() : "",
        },
        {
          headerName: "Hist",
          field: "Total_History",
          minWidth: 100,
          valueGetter: (params: any) => {
            const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
            return months.reduce((sum, m) => sum + (params.data[`${m}_history`] || 0), 0);
          },
          valueFormatter: (params: any) => params.value ? Math.round(params.value).toString() : "",
        },
        {
          headerName: "Tgt",
          field: "Total_Target",
          minWidth: 100,
          valueGetter: (params: any) => {
            const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
            return months.reduce((sum, m) => sum + (params.data[`${m}_target`] || 0), 0);
          },
          valueFormatter: (params: any) => params.value ? Math.round(params.value).toString() : "",
        },
        {
          headerName: "Act vs Hist",
          field: "TotalHistory",
          minWidth: 120,
          valueGetter: (params: any) => calculateHistoryTotal(params.data),
          valueFormatter: (params: any) => params.value === null ? "" : `${params.value.toFixed(1)}%`,
          cellClass: (params: any) => {
            const percentage = calculateHistoryTotal(params.data);
            return percentage !== null && percentage >= 0 ? "text-green-500" : "text-red-500";
          },
        },
        {
          headerName: "Act vs Tgt",
          field: "TotalTarget",
          minWidth: 120,
          valueGetter: (params: any) => calculateTargetTotal(params.data),
          valueFormatter: (params: any) => params.value === null ? "" : `${params.value.toFixed(1)}%`,
          cellClass: (params: any) => {
            const percentage = calculateTargetTotal(params.data);
            return percentage !== null && percentage >= 0 ? "text-green-500" : "text-red-500";
          },
        },
      ]
    } as ColGroupDef,
    // Generate month-based columns dynamically
    ...["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map( 
      (month): ColGroupDef => ({ 
        headerName: month,
        children: [
          { 
            headerName: "Act", 
            field: `${month}_actual`, 
            editable: true, 
            headerTooltip: "Actual", 
            width: 70, 
            minWidth: 70, 
            maxWidth: 100,
            valueFormatter: (params: any) => {
              return params.value ? Math.round(params.value).toString() : "";
            }
          },
          { 
            headerName: "Hist", 
            field: `${month}_history`, 
            editable: true, 
            headerTooltip: "History", 
            width: 70, 
            minWidth: 70, 
            maxWidth: 100,
            valueFormatter: (params: any) => {
              return params.value ? Math.round(params.value).toString() : "";
            }
          },
          { 
            headerName: "Tgt", 
            field: `${month}_target`, 
            editable: true, 
            headerTooltip: "Target", 
            width: 70, 
            minWidth: 70, 
            maxWidth: 100,
            valueFormatter: (params: any) => {
              return params.value ? Math.round(params.value).toString() : "";
            }
          },
          {
            headerName: "Act vs Hist",
            field: `${month}_act_vs_hist`,
            width: 110,
            minWidth: 110,
            valueGetter: (params: any) => { 
              return calculatePercentage(
                params.data?.[`${month}_actual`] || 0,
                params.data?.[`${month}_history`] || 0
              );
            },
            valueFormatter: (params: any) => params.value === "" ? "" : `${params.value}%`,
            cellClass: (params: any) => {
              const percentage = calculatePercentage(
                params.data?.[`${month}_actual`] || 0,
                params.data?.[`${month}_history`] || 0
              );
              return percentage !== "" && parseFloat(percentage) >= 0 ? "text-green-500" : "text-red-500";
            },
          },
          {
            headerName: "Act vs Tgt",
            field: `${month}_act_vs_tgt`,
            width: 110,
            minWidth: 110,
            valueGetter: (params: any) => {
              return calculateTargetPercentage(
                params.data?.[`${month}_actual`] || 0,
                params.data?.[`${month}_target`] || 0
              );
            },
            valueFormatter: (params: any) => params.value === "" ? "" : `${params.value}%`,
            cellClass: (params: any) => {
              const percentage = calculateTargetPercentage(
                params.data?.[`${month}_actual`] || 0,
                params.data?.[`${month}_target`] || 0
              );
              return percentage !== "" && parseFloat(percentage) >= 0 ? "text-green-500" : "text-red-500";
            },
          },
        ],
      })
    ),
  ];

  // Reference to grid API to trigger column resizing after render
  const gridApiRef = useRef<any>(null);

  const onGridReady = (params: any) => {
    gridApiRef.current = params.api;
    if (rowData && rowData.length > 0) {
      selectPreferredRow();
    }
  };

  const selectPreferredRow = () => {
    if (!gridApiRef.current) return;
    gridApiRef.current.deselectAll();
    if (selectedZoneName) {
      let matched = false;
      gridApiRef.current.forEachNode((node: any) => {
        if (!matched && node.data?.Zone_Name === selectedZoneName) {
          node.setSelected(true);
          onZoneClick(node.data);
          matched = true;
        }
      });
      if (matched) return;
    }
    const firstRow = gridApiRef.current.getDisplayedRowAtIndex(0);
    if (firstRow) {
      firstRow.setSelected(true);
      onZoneClick(firstRow.data);
    }
  };

  // Handle data changes — re-select the previously selected zone (or first row on initial load)
  useEffect(() => {
    if (gridApiRef.current && rowData && rowData.length > 0) {
      selectPreferredRow();
    }
  }, [rowData]);
  const gridHeight = useMemo(() => {
    const headerHeight = 50;      // two-level header (group + child)
    const paginationHeight = 40;  // pagination footer
    const rowCount = rowData?.length || 0;
    const rowsHeight = rowCount * 35; // rowHeight={25}
  
    const totalHeight = headerHeight + paginationHeight + rowsHeight;
    return Math.min(totalHeight, 540); // cap at 540px
  }, [rowData]);
  return (
    <div className="ag-theme-alpine retailPerformanceTable" style={{ height: `${gridHeight}px`, width: "100%" }}>
      <style>
        {`
          .custom-header {
            font-size: 12px !important;
          }
          .retailPerformanceTable .ag-header.ag-pivot-off.ag-header-allow-overflow {
            font-size: 12px !important;
          }
          .retailPerformanceTable .ag-root-wrapper {
          height: 100% !important;
          }
          .retailPerformanceTable .ag-body-viewport  {
            overflow-y: auto !important;
          }
        `}
      </style>

      <AgGridReact
        domLayout="normal"
        columnDefs={columnDefs}
        rowData={rowData && rowData?.length > 0 ? rowData : []}
        defaultColDef={{
          sortable: true,
          filter: false,
          resizable: true,
          flex: 1,
          minWidth: 80,
          maxWidth: 120,
          cellStyle: { fontSize: "10px" },
          headerClass: "custom-header"
        }}
        headerHeight={25}
        rowHeight={25}
        pagination={true}
        enableRangeSelection={true}
        animateRows={true}
        suppressAggFuncInHeader={true}
        onGridReady={onGridReady}
        autoSizeStrategy={autoSizeStrategy}
        onFirstDataRendered={(params) => {
          selectPreferredRow();
        }}
      />
    </div>
  );
};

export default RetailSalesPerformanceTable;