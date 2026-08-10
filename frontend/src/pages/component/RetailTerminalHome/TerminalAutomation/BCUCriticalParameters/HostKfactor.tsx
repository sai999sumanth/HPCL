import React, { useEffect, useState, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { RefreshCw, Loader, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { convertUTCDateToLocalDate } from "@/hooks/useRelativeTime";
import { Card } from '@/@/components/ui/card';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { apiClient } from "@/services/apiClient";

interface HostKfactorChange {
  id: number;
  created_at: string;
  updated_at: string;
  entity_id: string;
  sr_number: number;
  bay_number: string;
  bcu_number: string;
  timestamp: string;
  bcu_parameter: string;
  initial_setting: string;
  final_setting: string;
  sap_id: string;
  location_name: string;
  zone: string;
}

interface HostKfactorResponse {
  data: HostKfactorChange[];
  total: number;
  count: number;
}

interface TableProps {
  zone?: string | null;
  plant?: string | null;
  dateFilter?: string;
  bcuQuery?: string;
}

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
    <div className="flex flex-col items-center space-y-2">
      <Loader className="h-8 w-8 animate-spin text-primary" />
      <span className="text-xs text-gray-600">Loading data...</span>
    </div>
  </div>
);

export const HostKfactor: React.FC<TableProps> = ({
  zone,
  plant,
  dateFilter,
  bcuQuery
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [rowData, setRowData] = useState<HostKfactorChange[]>([]);
  const gridApiRef = useRef<any>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const buildQueryWithFilters = useCallback(() => {
    let completeQuery = '';
    
    const fields = [
      "bay_number",
      "bcu_number",
      "bcu_parameter",
      "initial_setting",
      "final_setting",
      "created_at",
      "sap_id",
      "location_name", 
      "zone",
    ];

    if (zone && zone !== 'all') {
      completeQuery += completeQuery 
        ? ` AND zone='${zone}'` 
        : `zone='${zone}'`;
    }
    
    if (plant && plant !== 'all') {
      completeQuery += completeQuery 
        ? ` AND sap_id='${plant}'` 
        : `sap_id='${plant}'`;
    }

    if (dateFilter && dateFilter.trim() !== '') {
      completeQuery += completeQuery 
        ? ` AND ${dateFilter}` 
        : dateFilter;
    }

    if (bcuQuery && bcuQuery.trim() !== '') {
      completeQuery += completeQuery 
        ? ` AND ${bcuQuery}` 
        : bcuQuery;
    }
    
    return {
      q: completeQuery,
      fields: JSON.stringify(fields)
    };
  }, [zone, plant, dateFilter, bcuQuery]);

  const fetchData = useCallback(async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const queryParams = buildQueryWithFilters();
      const params: any = {
        ...queryParams,
        skip: page,
        limit: size,
        sort: JSON.stringify({"created_at": "desc"}),
      };
      
      if (searchText.trim()) {
        params.search_text = searchText;
      }
  
      const response = await apiClient.get<HostKfactorResponse>('/api/hostkfactorchanges', { params });
      
      const processedData = response.data.data.map(item => ({
        ...item,
        created_at: convertUTCDateToLocalDate(new Date(item.created_at)).toISOString()
      }));

      setRowData(processedData);
      setTotalRecords(response.data.total);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to fetch data');
      setError("Failed to fetch data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [buildQueryWithFilters, searchText, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(0);
  }, [buildQueryWithFilters, searchText]);

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [currentPage, pageSize, buildQueryWithFilters, searchText]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const handleRefresh = useCallback(() => {
    setCurrentPage(0);
    setSearchText('');
    fetchData(0, pageSize);
  }, [fetchData, pageSize]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0);
  };

  const fetchAllDataForExport = useCallback(async () => {
    try {
      const queryParams = buildQueryWithFilters();
      const params: any = {
        ...queryParams,
        skip: 0,
        limit: 10000, // Large limit to get all data
        sort: JSON.stringify({"created_at": "desc"}),
      };
      
      if (searchText.trim()) {
        params.search_text = searchText;
      }

      const response = await apiClient.get<HostKfactorResponse>('/api/hostkfactorchanges', { params });
      
      const processedData = response.data.data.map(item => ({
        ...item,
        created_at: convertUTCDateToLocalDate(new Date(item.created_at)).toISOString()
      }));

      return processedData;
    } catch (error) {
      console.error('Error fetching all data:', error);
      throw error;
    }
  }, [buildQueryWithFilters, searchText]);

const handleExcelExport = useCallback(async () => {
  setIsDownloading(true);
  try {
    const allData = await fetchAllDataForExport();

    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Add main heading with timestamp
    const currentDateTime = new Date();
    const formattedDateForTitle = currentDateTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const formattedTimeForTitle = currentDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    worksheetData.push([`HOST K-FACTOR CHANGE REPORT - ${formattedDateForTitle} at ${formattedTimeForTitle}`]);
    worksheetData.push([]); // Empty row for spacing

    // Add generation info
    worksheetData.push(['Total Records Exported:', allData.length]);
    worksheetData.push([]); // Empty row for spacing

    // Add applied filters section
    const appliedFilters = [];
    
    if (zone && zone !== 'all') {
      appliedFilters.push(`Zone: ${zone}`);
    }
    
    if (plant && plant !== 'all') {
      appliedFilters.push(`Plant: ${plant}`);
    }
    
    if (dateFilter && dateFilter.trim() !== '') {
      const match = dateFilter.match(/created_at::DATE BETWEEN '([^']+)' AND '([^']+)'/);
      if (match) {
        appliedFilters.push(`Date Range: ${match[1]} to ${match[2]}`);
      } else {
        appliedFilters.push(`Date Filter: ${dateFilter}`);
      }
    }
    
    if (searchText.trim()) {
      appliedFilters.push(`Search Text: ${searchText}`);
    }

    if (appliedFilters.length > 0) {
      appliedFilters.forEach(filter => {
        worksheetData.push([filter]);
      });
    } else {
      worksheetData.push(['No filters applied']);
    }

    worksheetData.push([]); // Empty row for spacing
    worksheetData.push([]); // Another empty row for better separation

    // Add data headers
    const headers = [
      'Date Time Stamp',
      'Location ID',
      'Location Name',
      'Zone',
      'SR Number',
      'Bay Number',
      'BCU Number',
      'Parameter',
      'Initial Setting',
      'Final Setting'
    ];
    worksheetData.push(headers);

    // Format and add data rows
    const dataRows = allData.map((row) => [
      row.created_at ? new Date(row.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : '',
      row.sap_id || '',
      row.location_name || '',
      row.zone || '',
      row.sr_number || '',
      row.bay_number || '',
      row.bcu_number || '',
      row.bcu_parameter || '',
      row.initial_setting || '',
      row.final_setting || ''
    ]);

    // Add all data rows to worksheet data
    worksheetData.push(...dataRows);

    // Create worksheet from the data
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    const columnWidths = headers.map((header) => {
      let width = Math.max(header.length, 12);
      
      switch (header) {
        case 'Date Time Stamp':
          width = 18;
          break;
        case 'Location Name':
        case 'Parameter':
          width = 20;
          break;
        case 'Initial Setting':
        case 'Final Setting':
          width = 16;
          break;
        default:
          width = 15;
      }
      
      return { wch: width };
    });
    
    worksheet['!cols'] = columnWidths;

    // Merge cells for the main heading
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }
    ];

    // Set row heights
    worksheet['!rows'] = [
      { hpt: 25 }, // Main heading row height
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'K-Factor Changes');

    // Generate filename with detailed timestamp
    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `Host_K_Factor_Change_Report_${fileTimestamp}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);

    toast.success(`Successfully exported ${allData.length} records to ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.error('Failed to export data to Excel. Please try again.');
  } finally {
    setIsDownloading(false);
  }
}, [fetchAllDataForExport, zone, plant, dateFilter, searchText]);

  const columnDefs: ColDef[] = [
{
  headerName: "Date Time Stamp",
  field: "created_at",
  width: 160,
  minWidth: 150,
  sortable: true,
  filter: true,
  resizable: true,
  cellRenderer: (params: any) => {
    if (!params.value) return '-';
    try {
      const localDate = new Date(params.value);
      const formattedDateTime = localDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return (
        <div className="flex flex-col">
          <span className="text-[0.69rem] text-gray-900">{formattedDateTime}</span>
        </div>
      );
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }
}
,
    {
      headerName: "Location ID",
      field: "sap_id",
      minWidth: 125,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Location Name",
      field: "location_name",
      minWidth: 150,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Zone",
      field: "zone",
      minWidth: 95,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "SR Number",
      field: "sr_number",
      minWidth: 130,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Bay Number",
      field: "bay_number",
      minWidth: 130,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "BCU Number",
      field: "bcu_number",
      minWidth: 130,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Parameter",
      field: "bcu_parameter",
      minWidth: 130,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Initial Setting",
      field: "initial_setting",
      minWidth: 140,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Final Setting",
      field: "final_setting",
      minWidth: 140,
      sortable: true,
      filter: true,
      resizable: true,
    },
  ];

  const onGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    if (gridApiRef.current) {
      gridApiRef.current.sizeColumnsToFit();
    }
  };

  return (
    <Card className="overflow-hidden relative">
      <div className="flex justify-between items-center p-2 border-b">
        <div className="flex-grow mr-2">
          <Input 
            placeholder="Search..." 
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-8"
          />
        </div>

        <div className="flex gap-2">
          <Button 
            className="text-white text-xs p-1 w-7 h-7 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
            variant="outline" 
            size="sm" 
            onClick={handleExcelExport}
            disabled={isDownloading}
            title={isDownloading ? "Downloading..." : "Download Excel"}
          >
            {isDownloading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
    <Download className="h-4 w-4" />
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="ag-theme-alpine w-full" style={{ height: "400px" }}>
        <style>
          {`
            .ag-theme-alpine {
              --ag-font-size: 12px;
            }
            .ag-header-cell-text {
              font-size: 12px;
              font-weight: 600;
            }
            .ag-header-cell {
              background-color: #f9fafb !important;
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
          `}
        </style>

        {loading && <LoadingOverlay />}

        <AgGridReact
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            flex: 1,
            cellStyle: { fontSize: "12px" },
          }}
          
          pagination={false}
          domLayout="normal"
          rowHeight={30}
          headerHeight={30}
          enableRangeSelection={true}
          animateRows={true}
          suppressAggFuncInHeader={true}

          onGridReady={onGridReady}
          suppressCellFocus={true}
          enableCellTextSelection={true}
          overlayLoadingTemplate={
            '<span class="ag-overlay-loading-center">Loading data...</span>'
          }
          overlayNoRowsTemplate={
            '<span class="ag-overlay-no-rows-center">No K-Factor Changes Found</span>'
          }
          rowClassRules={{
            'ag-row-odd': (params) => params.rowIndex % 2 !== 0,
          }}
        />
      </div>

      <div className="flex items-center justify-end px-3 py-2 border-t bg-gray-50 text-xs gap-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Page Size:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border rounded px-1 py-0.5 text-xs bg-white"
          >
            {[20, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <span className="text-gray-600">
          {totalRecords === 0 ? '0 to 0' : `${currentPage * pageSize + 1} to ${Math.min((currentPage + 1) * pageSize, totalRecords)}`} of {totalRecords}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0 || loading}
          >
            <ChevronsLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0 || loading}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-gray-600 px-2">
            Page {totalRecords === 0 ? 0 : currentPage + 1} of {totalRecords === 0 ? 0 : totalPages}
          </span>
          <Button
            variant="outline" size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1 || loading}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1 || loading}
          >
            <ChevronsRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default HostKfactor;
