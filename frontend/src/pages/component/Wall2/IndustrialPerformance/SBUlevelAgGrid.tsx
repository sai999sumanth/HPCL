import React, { useEffect, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, ColGroupDef } from 'ag-grid-community';

interface SbuData {
  sbu_name: string;
  [key: string]: number | string;
}

const calculatePercentage = (actual: number, history: number): string => {
  if (!history || history === 0) return "";
  return (((actual - history) / history) * 100).toFixed(1);
};

const calculateHistoryTotal = (data: SbuData) => {
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  let total = 0;
  let validValues = 0;

  months.forEach(month => {
    const avsH = calculatePercentage(
      Number(data[`${month}_actual`]) || 0,
      Number(data[`${month}_history`]) || 0
    );
    if (avsH !== "") {
      total += parseFloat(avsH);
      validValues++;
    }
  });

  return validValues > 0 ? (total / validValues).toFixed(1) : null;
};

const generateMonthColumns = (months: string[]): ColGroupDef[] => {
  return months.map((month): ColGroupDef => ({
    headerName: month,
    children: [
      {
        headerName: "Act",
        field: `${month}_actual`,
        width: 80,
        minWidth: 80,
        maxWidth: 90,
        headerTooltip: "Actual",
        valueFormatter: (params) => (params.value?.toFixed(1) || '0.0')
      },
      {
        headerName: "Hist",
        field: `${month}_history`,
        width: 80,
        minWidth: 80,
        maxWidth: 90,
        headerTooltip: "History",
        valueFormatter: (params) => (params.value?.toFixed(1) || '0.0')
      },
      {
        headerName: "Act vs Hist(%)",
        width: 130,
        minWidth: 130,
        maxWidth: 140,
        valueGetter: (params) => {
          const actual = params.data?.[`${month}_actual`] || 0;
          const history = params.data?.[`${month}_history`] || 0;
          return calculatePercentage(actual, history);
        },
        cellClass: (params) => {
          const percentage = params.value;
          return percentage !== "" && parseFloat(percentage) >= 0 
            ? "text-green-500" 
            : "text-red-500";
        }
      }
    ]
  }));
};

export const SBUlevelAgGrid = ({ data }: { data: SbuData[] }) => {
  const gridApiRef = useRef<any>(null);
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const columnDefs: (ColDef | ColGroupDef)[] = [
    {
      headerName: "SBU",
      field: "sbu_name",
      width: 170,
      minWidth: 170,
      maxWidth: 170,
      pinned: 'left' as const,
      cellRenderer: (params: any) => (
        <div className="font-medium">{params.value}</div>
      )
    },
    {
      headerName: "Total Act vs Hist(%)",
      field: "totalHistory",
      width: 140,
      minWidth: 140,
      maxWidth: 160,
      pinned: 'left' as const,
      valueGetter: (params) => calculateHistoryTotal(params.data),
      valueFormatter: (params) => params.value === null ? "" : `${params.value}%`,
      cellClass: (params) => {
        const percentage = params.value;
        return percentage !== null && parseFloat(percentage) >= 0 
          ? "text-green-500" 
          : "text-red-500";
      }
    },
    ...generateMonthColumns(months)
  ];

  const onGridReady = (params: any) => {
    gridApiRef.current = params.api;
  };

  useEffect(() => {
    if (gridApiRef.current && data) {
      gridApiRef.current.sizeColumnsToFit();
    }
  }, [data]);
  
  // This effect adds a horizontal scrollbar at the top
  useEffect(() => {
    if (gridContainerRef.current) {
      const gridBodyElement = gridContainerRef.current.querySelector('.ag-body-horizontal-scroll');
      const scrollElement = gridBodyElement?.querySelector('.ag-body-horizontal-scroll-viewport');
      
      if (gridBodyElement && scrollElement) {
        // Clone the scroll element
        const clonedScrollElement = scrollElement.cloneNode(true) as HTMLElement;
        clonedScrollElement.classList.add('ag-body-horizontal-scroll-viewport-top');
        
        // Create a container for the top scrollbar
        const topScrollContainer = document.createElement('div');
        topScrollContainer.classList.add('ag-body-horizontal-scroll-top');
        topScrollContainer.style.overflow = 'hidden';
        topScrollContainer.style.height = '15px';
        topScrollContainer.style.marginBottom = '5px';
        topScrollContainer.appendChild(clonedScrollElement);
        
        // Insert the top scrollbar before the grid
        const gridRoot = gridContainerRef.current.querySelector('.ag-root');
        if (gridRoot && gridRoot.parentNode) {
          gridRoot.parentNode.insertBefore(topScrollContainer, gridRoot);
        }
        
        // Sync scrolling between top and bottom scrollbars
        clonedScrollElement.addEventListener('scroll', () => {
          (scrollElement as HTMLElement).scrollLeft = clonedScrollElement.scrollLeft;
        });
        
        (scrollElement as HTMLElement).addEventListener('scroll', () => {
          clonedScrollElement.scrollLeft = (scrollElement as HTMLElement).scrollLeft;
        });
      }
    }
  }, [data]);

  return (
    <div ref={gridContainerRef} className="ag-theme-alpine" style={{ height: "320px", width: "100%" }}>
      <style>
        {`
          .custom-header {
            font-size: 12px !important;
          }
          .sbu-totals {
            font-weight: bold;
            background-color: #f3f4f6;
          }
          .ag-body-horizontal-scroll {
            display: block !important;
          }
          .ag-body-horizontal-scroll-viewport {
            scrollbar-width: thin;
          }
          .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
            height: 8px;
          }
          .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
            background: #f1f1f1;
          }
          .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
            background: #888;
          }
          .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
          .ag-cell {
            padding-left: 5px;
            padding-right: 5px;
          }
        `}
      </style>
      
      <AgGridReact
        columnDefs={columnDefs}
        rowData={data}
        defaultColDef={{
          sortable: true,
          filter: false,
          resizable: true,
          flex: 1,
          minWidth: 90,
          maxWidth: 110,
          cellStyle: { fontSize: "12px" }, // Increased font size
          headerClass: "custom-header"
        }}
        headerHeight={25} // Increased header height
        rowHeight={25} // Increased row height
        pagination={true}
        enableRangeSelection={true}
        animateRows={true}
        suppressAggFuncInHeader={true}
        onGridReady={onGridReady}
      />
    </div>
  );
};