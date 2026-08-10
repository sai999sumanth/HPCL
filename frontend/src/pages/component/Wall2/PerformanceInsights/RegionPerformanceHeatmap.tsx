import React, { useEffect, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const RegionPerformanceHeapmap = ({ props, onRegionClick }) => {
  const rowData = props;

  // Function to calculate percentage
  const calculatePercentage = (actual, history) => {
    if (!history || history === 0) return null;
    const v = ((actual - history) / history) * 100;
    return Math.min(100, Math.max(-100, v));
  };

  const calculateTargetPercentage = (actual, target) => {
    if (!target || target === 0) return null;
    const v = ((actual - target) / target) * 100;
    return Math.min(100, Math.max(-100, v));
  };

  // Function to determine color based on percentage value
  const getCategoryColor = (value) => {
    if (value === null) return "#ffffff";
    const numValue = Number(value);
    if (numValue >= 20) return "#4caf50";
    if (numValue >= 10) return "#8bc34a";
    if (numValue >= 0) return "#ffeb3b";
    if (numValue >= -10) return "#ff9933";
    return "#ff4444";
  };

  // Function to determine text color based on background color
  const getTextColor = (backgroundColor) => {
    return backgroundColor === "#ffeb3b" || backgroundColor === "#ffffff" ? "#000000" : "#ffffff";
  };

  const calculateHistoryTotal = (data) => {
    const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    let total = 0;
    let validValues = 0;

    months.forEach(month => {
      const avsH = calculatePercentage(
        data[`${month}_actual`] || 0,
        data[`${month}_history`] || 0
      );
      if (avsH !== null) {
        total += avsH;
        validValues++;
      }
    });

    return validValues > 0 ? total / validValues : null;
  };

  const calculateTargetTotal = (data) => {
    const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    let total = 0;
    let validValues = 0;

    months.forEach(month => {
      const avsT = calculateTargetPercentage(
        data[`${month}_actual`] || 0,
        data[`${month}_target`] || 0
      );
      if (avsT !== null) {
        total += avsT;
        validValues++;
      }
    });

    return validValues > 0 ? total / validValues : null;
  };

  const columnDefs = [
    {
      headerName: "Region Name",
      field: "Region_Name",
      width: 140,
      minWidth: 140,
      maxWidth: 140,
      cellRenderer: (params) => (
        <span
          className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => {
            gridApiRef.current.deselectAll();
            params.node.setSelected(true);
            onRegionClick(params.data);
          }}
        >
          {params.value}
        </span>
      ),
    },
    {
      headerName: "Total A vs H",
      field: "TotalHistory",
      width: 120,
      minWidth: 120,
      maxWidth: 150,
      valueGetter: (params) => {
        return calculateHistoryTotal(params.data);
      },
      valueFormatter: (params) => {
        return params.value === null ? "" : `${params.value.toFixed(1)}%`;
      },
      cellStyle: (params) => {
        const backgroundColor = getCategoryColor(params.value);
        return {
          backgroundColor,
          color: getTextColor(backgroundColor),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1px"
        };
      }
    },
    {
      headerName: "Total A vs T",
      field: "TotalTarget",
      width: 120,
      minWidth: 120,
      maxWidth: 150,
      valueGetter: (params) => {
        return calculateTargetTotal(params.data);
      },
      valueFormatter: (params) => {
        return params.value === null ? "" : `${params.value.toFixed(1)}%`;
      },
      cellStyle: (params) => {
        const backgroundColor = getCategoryColor(params.value);
        return {
          backgroundColor,
          color: getTextColor(backgroundColor),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1px"
        };
      }
    },
    ...["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map(
      (month) => ({
        headerName: month,
        children: [
          {
            headerName: "A vs H",
            field: `${month}_Actual_vs_History`,
            width: 80,
            minWidth: 80,
            maxWidth: 80,
            valueGetter: (params) => {
              return calculatePercentage(
                params.data?.[`${month}_actual`] || 0,
                params.data?.[`${month}_history`] || 0
              );
            },
            valueFormatter: (params) => {
              return params.value === null ? "" : `${params.value.toFixed(1)}%`;
            },
            cellStyle: (params) => {
              const backgroundColor = getCategoryColor(params.value);
              return {
                backgroundColor,
                color: getTextColor(backgroundColor),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1px"
              };
            }
          },
          {
            headerName: "A vs T",
            field: `${month}_Actual_vs_Target`,
            width: 80,
            minWidth: 80,
            maxWidth: 80,
            valueGetter: (params) => {
              return calculateTargetPercentage(
                params.data?.[`${month}_actual`] || 0,
                params.data?.[`${month}_target`] || 0
              );
            },
            valueFormatter: (params) => {
              return params.value === null ? "" : `${params.value.toFixed(1)}%`;
            },
            cellStyle: (params) => {
              const backgroundColor = getCategoryColor(params.value);
              return {
                backgroundColor,
                color: getTextColor(backgroundColor),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1px"
              };
            }
          }
        ],
      })
    ),
  ];

  const gridApiRef = useRef(null);

  const onGridReady = (params) => {
    gridApiRef.current = params.api;
    if (rowData && rowData.length > 0) {
      selectFirstVisibleRow();
    }
  };

  const selectFirstVisibleRow = () => {
    if (gridApiRef.current) {
      const firstRow = gridApiRef.current.getDisplayedRowAtIndex(0);
      if (firstRow) {
        gridApiRef.current.deselectAll();
        firstRow.setSelected(true);
        onRegionClick(firstRow.data);
      }
    }
  };

  useEffect(() => {
    if (gridApiRef.current && rowData && rowData.length > 0) {
      selectFirstVisibleRow();
    }
  }, [rowData]);

  return (
    <div className="ag-theme-alpine" style={{ height: "540px", width: "100%" }}>
      <div className="mb-1 flex flex-wrap gap-1 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ backgroundColor: "#4caf50" }}></div>
          <span>Very High (≥20%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ backgroundColor: "#8bc34a" }}></div>
          <span>High (10-19.9%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ backgroundColor: "#ffeb3b" }}></div>
          <span>Medium (0-9.9%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ backgroundColor: "#ff9933" }}></div>
          <span>Low (0 to -9.9%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2" style={{ backgroundColor: "#ff4444" }}></div>
          <span>Very Low (below -10%)</span>
        </div>
      </div>
      <style>
        {`
          .ag-header-cell-label {
            font-size: 10px;
            font-weight: 600;
          }
          .ag-cell {
            font-size: 10px;
          }
          .ag-row {
            display: flex;
            align-items: center;
          }
          .ag-header-group-cell {
            font-size: 12px;
            font-weight: bold;
          }
        `}
      </style>
      <AgGridReact
        columnDefs={columnDefs}
        rowData={rowData}
        defaultColDef={{
          sortable: true,
          filter: false,
          resizable: true,
          autoHeight: true,
          wrapText: true,
        }}
        headerHeight={20}
        rowHeight={20}
        pagination={true}
        enableRangeSelection={true}
        animateRows={true}
        suppressAggFuncInHeader={true}
        onGridReady={onGridReady}
        onFirstDataRendered={(params) => {
          const firstRow = params.api.getDisplayedRowAtIndex(0);
          if (firstRow) {
            firstRow.setSelected(true);
            onRegionClick(firstRow.data);
          }
        }}
      />
    </div>
  );
};

export default RegionPerformanceHeapmap;