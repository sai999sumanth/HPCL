import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import axios from "axios";
import { convertUTCDateToLocalDate, formatRelativeTime } from "@/hooks/useRelativeTime";
import { apiClient } from "@/services/apiClient";

interface HostManualBayAssignment {
  id: number;
  created_at: string;
  updated_at: string;
  entity_id: string;
  sr_number: number;
  user_name: string;
  timestamp: string;
  text: string;
  sap_id: string;
}

interface HostManualBayAssignmentResponse {
  data: HostManualBayAssignment[];
  total: number;
  count: number;
}

export const HostManualBayAssignment: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const gridApiRef = useRef<any>(null);


  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {

    const currentPageNumber = Math.floor(startRow / pageSize);

    try {
      setLoading(true);
      const skip = currentPageNumber;
      const limit = 500;
      
      let url = `/api/hostmanualbayassigned?skip=${skip}&limit=${limit}`;
      
      // Add sorting if provided
      if (sortModel && sortModel.length > 0) { 
        const sort = `${sortModel[0].colId} ${sortModel[0].sort}`;
        url += `&sort=${sort}`;
      }
      
      const response = await apiClient.get<HostManualBayAssignmentResponse>(url);
      
      setTotalRecords(response.data.total);
      setError(null);
      
      return {
        success: true,
        rows: response.data.data,
        lastRow: response.data.total
      };
    } catch (err) {
      setError("Failed to fetch unauthorised flow data. Please try again later.");
      console.error("Error fetching host bay unauthorisedFlows:", err);
      return {
        success: false,
        rows: [],
        lastRow: 0
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Create datasource for infinite scrolling
  const dataSource = useMemo(() => {
    return {
      getRows: async (params: any) => {
        try {
          const result = await fetchData(params.startRow, params.endRow, params.sortModel);
          params.successCallback(result.rows, result.lastRow);
        } catch (err) {
          params.failCallback();
        }
      }
    };
  }, [fetchData]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateString;
    }
  };

  const columnDefs: ColDef[] = [
       {
          headerName: "Date Time Stamp",
          field: "created_at",
          width: 160,
          minWidth: 150,
          sortable: true,
          filter: false,
          resizable: true,
          cellRenderer: (params: any) => {
            if (!params.value) return '-';
            try {
              // Convert UTC to local time
              const utcDate = new Date(params.value);
              const localDate = convertUTCDateToLocalDate(utcDate);
              
              // Format the absolute time using the converted local date
              const formattedDateTime = localDate.toLocaleString('en-US', { 
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
              
              // Get the relative time (already handles UTC conversion internally)
              const relativeTime = formatRelativeTime(params.value);
              
              // Return both times in a stacked layout
              return (
                <div className="flex flex-col">
                  {/* <span className="text-[0.56rem] text-gray-900">{relativeTime}</span> */}
                  <span className="text-[0.69rem] text-gray-900">{formattedDateTime}</span>
                </div>
              );
            } catch (error) {
              console.error('Error formatting date:', error);
              return 'Invalid date';
            }
          }
        },
    {
      headerName: "Location ID",
      field: "sap_id",
      minWidth: 125,
      sortable: true,
      filter: false,
      resizable: true,
    },    {
      headerName: "Location",
      field: "loaction_name",
      minWidth: 105,
      sortable: true,
      filter: false,
      resizable: true,
    },
    {
      headerName: "Zone",
      field: "zone",
      minWidth: 95,
      sortable: true,
      filter: false,
      resizable: true,
    },
    {
      headerName: "SR Number",
      field: "sr_number",
      minWidth: 135,
      sortable: true,
      filter: false,
      resizable: true,
    },
    {
      headerName: "User Name",
      field: "user_name",
      minWidth: 135,
      sortable: true,
      filter: false,
      resizable: true,
    },
    {
      headerName: "Text",
      field: "text",
      minWidth: 100,
      sortable: true,
      filter: false,
      resizable: true,
    },
    {
      headerName: "Timestamp",
      field: "timestamp",
      minWidth: 150,
      sortable: true,
      filter: false,
      resizable: true,
      valueFormatter: (params) => formatDate(params.value)
    },
    {
      headerName: "Updated At",
      field: "updated_at",
      minWidth: 150,
      sortable: true,
      filter: false,
      resizable: true,
      valueFormatter: (params) => formatDate(params.value),
      hide: true, // Hidden by default
    },
  
    
  ];

  const onGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    if (gridApiRef.current) {
      gridApiRef.current.sizeColumnsToFit();
    }
  };

  const onPaginationChanged = () => {
    if (gridApiRef.current) {
      const currentPage = gridApiRef.current.paginationGetCurrentPage();
      const pageSize = gridApiRef.current.paginationGetPageSize();
      fetchData(currentPage * pageSize, pageSize);
    }
  };

  if (error) {
    return <div className="text-gray-500 p-4">No Data</div>;
  }

  return ( 
    <div className="w-full">
    {/* <h2 className="text-xl font-semibold mb-4">Manual Bay Assignments</h2>     */}
      <div className="ag-theme-alpine w-full" style={{ height: "300px" }}>
        <style>
          {`
            .custom-header {
              font-size: 12px !important;
              font-weight: bold;
            }
            .ag-row-odd {
              background-color: #f9fafb;
            }
            .text-red-500 {
              color: #ef4444 !important;
            }
            .text-green-500 {
              color: #10b981 !important;
            }
            .text-blue-500 {
              color: #3b82f6 !important;
            }
            .text-gray-500 {
              color: #6b7280 !important;
            }
            .text-amber-500 {
              color: #f59e0b !important;
            }
            .font-medium {
              font-weight: 500 !important;
            }
          `}
        </style>
        
        <AgGridReact
          columnDefs={columnDefs}
          defaultColDef={{ 
            sortable: true,
            filter: false,
            resizable: true,
            minWidth: 80,
            flex: 1,
            cellStyle: { fontSize: "12px" },
            headerClass: "custom-header"
          }}
          pagination={true}
          paginationPageSize={pageSize}
          domLayout="normal"
          rowHeight={30}
          headerHeight={40}
          enableRangeSelection={true}
          animateRows={true}
          suppressAggFuncInHeader={true}
          onGridReady={onGridReady}
          rowModelType="infinite"
          cacheBlockSize={pageSize}
          infiniteInitialRowCount={1}
          datasource={dataSource}
          suppressCellFocus={true}
          overlayLoadingTemplate={
            '<span class="ag-overlay-loading-center">Loading data...</span>'
          }
          overlayNoRowsTemplate={ 
            '<span class="ag-overlay-no-rows-center">No Manual Bay Assignments found</span>'
          }
          rowClassRules={{
            'ag-row-odd': (params) => params.rowIndex % 2 !== 0,
          }}
        />
      </div>
    </div>
  );
};

export default HostManualBayAssignment;