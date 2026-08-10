import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import axios from "axios";
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { RefreshCw, Loader, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { convertUTCDateToLocalDate } from '@/hooks/useRelativeTime';
import { Card } from '@/@/components/ui/card';
import { toast } from 'sonner';
import { apiClient } from "@/services/apiClient";
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from "@/hooks/useAgGridMirrorScrollbar";

interface HostUnauthorisedFlow {
  timestamp: string;
  bcu_number: string;
  bay_number: string;
  end_totalizer: number;
  sap_id: string;
  id: number;
  entity_id: string;
  start_totalizer: number;
  meter_number: number;
  net_totalizer: number;
  created_at: string;
  updated_at: string;
  location_name: string;
  zone: string;
}

interface HostUnauthorisedFlowResponse {
  data: HostUnauthorisedFlow[];
  total: number;
  count: number;
}

interface TableProps {
  zone?: string | null;
  plant?: string | null;
  dateFilter?: string;
  bcuQuery?: string;
  chartFilterDate?: string | null;
}

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
    <div className="flex flex-col items-center space-y-2">
      <Loader className="h-8 w-8 animate-spin text-primary" />
      <span className="text-xs text-gray-600">Loading data...</span>
    </div>
  </div>
);

export const HostUnauthorisedFlow: React.FC<TableProps> = ({
  zone,
  plant,
  dateFilter,
  bcuQuery,
  chartFilterDate
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [rowData, setRowData] = useState<HostUnauthorisedFlow[]>([]);
  const gridApiRef = useRef<any>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const { tableWrapRef, retryMirrorScrollbar } = useAgGridMirrorScrollbar([
    loading,
    rowData.length,
    zone,
    plant,
    dateFilter,
    bcuQuery,
    chartFilterDate,
    pageSize,
    currentPage,
  ]);
  const queryParamsRef = useRef<{ q: string; fields: string }>({ q: '', fields: '' });

  // Specify the exact fields to retrieve
  const fields = [
    "bay_number",
    "bcu_number",
    "meter_number",
    "start_totalizer",
    "end_totalizer",
    "created_at",
    "sap_id",
    "location_name",
    "zone",
    "net_totalizer"
  ];

  const buildQueryWithFilters = useCallback(() => {
    let completeQuery = 'net_totalizer!=0'; // Always include net_totalizer!=0 filter
  
    // Add zone filter if specified
    if (zone && zone !== 'all') {
      completeQuery += ` AND zone='${zone}'`;
    }
  
    // Add plant filter if specified
    if (plant && plant !== 'all') {
      completeQuery += ` AND sap_id='${plant}'`;
    }
  
    // Add date filter if specified
    if (dateFilter && dateFilter.trim() !== '') {
      completeQuery += ` AND ${dateFilter}`;
    }
  
    // Add chart point filter: single date, YYYY-MM, MMM-YYYY (e.g. Jan-2026, January-2026), or month name only
    // Use >= and < (exclusive end) to avoid timezone/last-day edge cases (e.g. Jan 31 UTC = Feb 1 local)
    if (chartFilterDate && chartFilterDate.trim() !== '') {
      const val = chartFilterDate.trim();
      const shortMonths: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
      const fullMonths: Record<string, number> = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

      let startDate: string | null = null;
      let endDateExclusive: string | null = null; // first day of next month for SQL <

      if (val.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        startDate = val;
        endDateExclusive = val; // same day: use = for single day below
      } else if (val.length === 7 && /^\d{4}-\d{2}$/.test(val)) {
        const [y, m] = val.split('-').map(Number);
        startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const nextMonth = m === 12 ? 1 : m + 1;
        const nextYear = m === 12 ? y + 1 : y;
        endDateExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      } else if (/^[A-Za-z]+-\d{4}$/.test(val)) {
        // MMM-YYYY or January-YYYY from chart – parse month (first 3 chars) and year from value
        const [monStr, yearStr] = val.split('-');
        const monNorm = (monStr.charAt(0).toUpperCase() + monStr.slice(1).toLowerCase()).slice(0, 3);
        const monthNum = shortMonths[monNorm] ?? fullMonths[monStr] ?? fullMonths[monStr.charAt(0).toUpperCase() + monStr.slice(1).toLowerCase()];
        const y = parseInt(yearStr, 10);
        if (monthNum !== undefined && !isNaN(y)) {
          startDate = `${y}-${String(monthNum).padStart(2, '0')}-01`;
          const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
          const nextYear = monthNum === 12 ? y + 1 : y;
          endDateExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        }
      } else {
        const valNorm = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        let monthNum = shortMonths[val] ?? shortMonths[valNorm] ?? fullMonths[val] ?? fullMonths[valNorm];
        if (monthNum === undefined && val.length >= 3) {
          monthNum = shortMonths[valNorm.slice(0, 3)];
        }
        if (monthNum !== undefined) {
          const currentYear = new Date().getFullYear();
          const y = monthNum <= 2 ? currentYear : currentYear - 1;
          startDate = `${y}-${String(monthNum).padStart(2, '0')}-01`;
          const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
          const nextYear = monthNum === 12 ? y + 1 : y;
          endDateExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        }
      }

      if (startDate && endDateExclusive) {
        if (startDate === endDateExclusive) {
          completeQuery += ` AND created_at::DATE = '${startDate}'`;
        } else {
          completeQuery += ` AND created_at::DATE >= '${startDate}' AND created_at::DATE < '${endDateExclusive}'`;
        }
      }
    }
  
    // Add BCU query if specified
    if (bcuQuery && bcuQuery.trim() !== '') {
      completeQuery += ` AND ${bcuQuery}`;
    }
  
    return {
      q: completeQuery,
      fields: JSON.stringify(fields)
    };
  }, [zone, plant, dateFilter, bcuQuery, chartFilterDate]);

  const fetchData = useCallback(async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const queryParams = buildQueryWithFilters();
      const params: any = {
        ...queryParams,
        skip: page,
        limit: size,
        sort: JSON.stringify({ "created_at": "desc" }),
      };

      if (searchText.trim()) {
        params.search_text = searchText;
      }

      const response = await apiClient.get<HostUnauthorisedFlowResponse>('/api/hostunauthorisedflow', { params });

      const processedData = response.data.data.map(item => {
        let created_at = item.created_at;
        try {
          if (created_at) {
            const d = new Date(created_at);
            if (!isNaN(d.getTime())) {
              created_at = convertUTCDateToLocalDate(d).toISOString();
            }
          }
        } catch {
          // keep original value on failure
        }
        return { ...item, created_at };
      });

      setRowData(processedData);
      setTotalRecords(response.data.total);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to fetch data');
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

  useEffect(() => {
    if (!loading) retryMirrorScrollbar();
  }, [loading, rowData, retryMirrorScrollbar]);

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

  // Value formatter for numerical values
  const formatNumber = (value: number | string) => {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    return value;
  };

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
},
    {
      headerName: "Location ID",
      field: "sap_id",
      minWidth: 125,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Location",
      field: "location_name",
      minWidth: 130,
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
      headerName: "BCU Number",
      field: "bcu_number",
      minWidth: 130,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Meter Number",
      field: "meter_number",
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
      headerName: "Start Totalizer",
      field: "start_totalizer",
      minWidth: 140,
      sortable: true,
      filter: true,
      resizable: true,
      valueFormatter: (params) => formatNumber(params.value),
    },
    {
      headerName: "End Totalizer",
      field: "end_totalizer",
      minWidth: 140,
      sortable: true,
      filter: true,
      resizable: true,
      valueFormatter: (params) => formatNumber(params.value),
    },
    {
      headerName: "Net Totalizer",
      field: "net_totalizer",
      minWidth: 140,
      sortable: true,
      filter: true,
      resizable: true,
      valueFormatter: (params) => formatNumber(params.value),
    },
  ];

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    if (gridApiRef.current) {
      gridApiRef.current.sizeColumnsToFit();
    }
    retryMirrorScrollbar();
  }, [retryMirrorScrollbar]);
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

    const response = await apiClient.get<HostUnauthorisedFlowResponse>('/api/hostunauthorisedflow', { params });
    
    const processedData = response.data.data.map(item => {
      let created_at = item.created_at;
      try {
        if (created_at) {
          const d = new Date(created_at);
          if (!isNaN(d.getTime())) {
            created_at = convertUTCDateToLocalDate(d).toISOString();
          }
        }
      } catch {
        // keep original value on failure
      }
      return { ...item, created_at };
    });

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

    worksheetData.push([`HOST UNAUTHORISED FLOW REPORT - ${formattedDateForTitle} at ${formattedTimeForTitle}`]);
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
    
    if (bcuQuery && bcuQuery.trim() !== '') {
      appliedFilters.push(`BCU Filter: ${bcuQuery}`);
    }
    
    if (chartFilterDate && chartFilterDate.trim() !== '') {
      appliedFilters.push(`Chart Filter: ${chartFilterDate}`);
    }
    
    if (searchText.trim()) {
      appliedFilters.push(`Search Text: ${searchText}`);
    }

    // Always show the net_totalizer!=0 filter since it's built-in
    appliedFilters.push('Net Totalizer: Not equal to 0');

    if (appliedFilters.length > 0) {
      appliedFilters.forEach(filter => {
        worksheetData.push([filter]);
      });
    } else {
      worksheetData.push(['Default filter: Net Totalizer not equal to 0']);
    }

    worksheetData.push([]); // Empty row for spacing
    worksheetData.push([]); // Another empty row for better separation

    // Add data headers
    const headers = [
      'Date Time Stamp',
      'Location ID',
      'Location',
      'Zone',
      'BCU Number',
      'Meter Number',
      'Bay Number',
      'Start Totalizer',
      'End Totalizer',
      'Net Totalizer'
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
      row.bcu_number || '',
      row.meter_number || '',
      row.bay_number || '',
      row.start_totalizer || '',
      row.end_totalizer || '',
      row.net_totalizer || ''
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
        case 'Location':
        case 'BCU Number':
        case 'Meter Number':
        case 'Bay Number':
          width = 16;
          break;
        case 'Start Totalizer':
        case 'End Totalizer':
        case 'Net Totalizer':
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Unauthorised Flow');

    // Generate filename with detailed timestamp
    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `Host_Unauthorised_Flow_Report_${fileTimestamp}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);

    toast.success(`Successfully exported ${allData.length} records to ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.error('Failed to export data to Excel. Please try again.');
  } finally {
    setIsDownloading(false);
  }
}, [fetchAllDataForExport, zone, plant, dateFilter, bcuQuery, chartFilterDate, searchText]);

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

      <div
        ref={tableWrapRef}
        className="ag-grid-mirror-h-scroll-wrap ag-theme-alpine w-full relative"
        style={{ height: "400px" }}
      >
        <style>{AG_GRID_MIRROR_SCROLL_CSS}</style>
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
            .text-blue-500 {
              color: #3b82f6 !important;
            }
            .text-gray-500 {
              color: #6b7280 !important;
            }
            .text-amber-500 {
              color: #f59e0b !important;
            }
          `}
        </style>

        {loading && <LoadingOverlay />}

        <AgGridReact
          key={`table-${zone ?? ''}-${plant ?? ''}-${dateFilter ?? ''}-${bcuQuery ?? ''}-${chartFilterDate ?? ''}`}
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
            '<span class="ag-overlay-no-rows-center">No Unauthorised Flows Found</span>'
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
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setCurrentPage(0)} disabled={currentPage === 0 || loading}>
            <ChevronsLeft className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0 || loading}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-gray-600 px-2">
            Page {totalRecords === 0 ? 0 : currentPage + 1} of {totalRecords === 0 ? 0 : totalPages}
          </span>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1 || loading}>
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1 || loading}>
            <ChevronsRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default HostUnauthorisedFlow;