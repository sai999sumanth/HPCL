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
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from "@/hooks/useAgGridMirrorScrollbar";

interface HostMFMFactor {
  id: number;
  created_at: string;
  updated_at: string;
  entity_id: string;
  mfm_number: string;
  bcu_number: string;
  stock_code: string;
  current_k_factor: number;
  last_k_factor: string;
  last_k_factor_change_date: string;
  current_meter_factor: number;
  last_meter_factor: string;
  last_meter_factor_change_date: string;
  sap_id: string;
  location_name: string;
  zone: string;
}

interface HostMFMFactorResponse {
  data: HostMFMFactor[];
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

export const HostMFMKFactor: React.FC<TableProps> = ({
  zone,
  plant,
  dateFilter,
  bcuQuery,
  chartFilterDate
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [rowData, setRowData] = useState<HostMFMFactor[]>([]);
  const gridApiRef = useRef<any>(null);
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

  const getChartFilterDateRange = useCallback((val: string): { first: string; last: string } | null => {
    const v = val.trim();
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { first: v, last: v };
    if (/^\d{4}-\d{2}$/.test(v)) {
      const [y, m] = v.split('-').map(Number);
      const first = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { first, last };
    }
    const shortMonths: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const fullMonths: Record<string, number> = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
    const mmmYyyy = v.match(/^([A-Za-z]+)[-\s]+(\d{4})$/);
    if (mmmYyyy) {
      const monthStr = mmmYyyy[1].charAt(0).toUpperCase() + mmmYyyy[1].slice(1).toLowerCase();
      const monthNum = shortMonths[monthStr.slice(0, 3)] ?? fullMonths[monthStr];
      const y = parseInt(mmmYyyy[2], 10);
      if (monthNum !== undefined && !isNaN(y)) {
        const first = `${y}-${String(monthNum).padStart(2, '0')}-01`;
        const lastDay = new Date(y, monthNum, 0).getDate();
        const last = `${y}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { first, last };
      }
    }
    const valNorm = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    let monthNum = shortMonths[v] ?? shortMonths[valNorm] ?? fullMonths[v] ?? fullMonths[valNorm];
    if (monthNum === undefined && v.length >= 3) monthNum = shortMonths[valNorm.slice(0, 3)];
    if (monthNum === undefined) return null;
    const currentYear = new Date().getFullYear();
    const y = monthNum <= 2 ? currentYear : currentYear - 1;
    const first = `${y}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(y, monthNum, 0).getDate();
    const last = `${y}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { first, last };
  }, []);

  const buildQueryWithFilters = useCallback(() => {
    let completeQuery = '';
    
    const fields = [
      "mfm_number",
      "bcu_number",
      "stock_code",
      "last_k_factor",
      "last_meter_factor",
      "sap_id",
      "location_name",
      "zone",
      "created_at",
      "current_meter_factor",
      "current_k_factor"
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

    // Date filter: prefer dateFilter (from chart SQL); else use chartFilterDate from backend (year from value e.g. Mar-2026 → 2026)
    if (dateFilter && dateFilter.trim() !== '') {
      completeQuery += completeQuery 
        ? ` AND ${dateFilter}` 
        : dateFilter;
    } else if (chartFilterDate && chartFilterDate.trim() !== '') {
      const range = getChartFilterDateRange(chartFilterDate.trim());
      if (range) {
        const clause = range.first === range.last
          ? `created_at::DATE = '${range.first}'`
          : `created_at::DATE BETWEEN '${range.first}' AND '${range.last}'`;
        completeQuery += completeQuery ? ` AND ${clause}` : clause;
      }
    }

    if (bcuQuery && bcuQuery.trim() !== '') {
      completeQuery += completeQuery 
        ? ` AND ${bcuQuery}` 
        : bcuQuery;
    }
    
    // Always add last_k_factor IS NOT NULL condition
    completeQuery += completeQuery 
      ? ` AND last_meter_factor IS NOT NULL` 
      : `last_meter_factor IS NOT NULL`;
    
    return {
      q: completeQuery,
      fields: JSON.stringify(fields)
    };
  }, [zone, plant, dateFilter, bcuQuery, chartFilterDate, getChartFilterDateRange]);

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
  
      const response = await apiClient.get<HostMFMFactorResponse>('/api/hostmfmfactor', { params });
      
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

      const response = await apiClient.get<HostMFMFactorResponse>('/api/hostmfmfactor', { params });
      
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

      const workbook = XLSX.utils.book_new();
      const worksheetData = [];

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

      worksheetData.push([`HOST MFM FACTOR REPORT - ${formattedDateForTitle} at ${formattedTimeForTitle}`]);
      worksheetData.push([]); // Empty row for spacing
      worksheetData.push(['Total Records Exported:', allData.length]);
      worksheetData.push([]); // Empty row for spacing

      const headers = [
        'Date Time Stamp',
        'Location ID',
        'Location Name',
        'Zone',
        'MFM Number',
        'BCU Number',
        'Stock Code',
        'Current K Factor',
        'Last K Factor',
        'Current Meter Factor',
        'Last Meter Factor'
      ];
      worksheetData.push(headers);

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
        row.mfm_number || '',
        row.bcu_number || '',
        row.stock_code || '',
        row.current_k_factor || '',
        row.last_k_factor || '',
        row.current_meter_factor || '',
        row.last_meter_factor || ''
      ]);

      worksheetData.push(...dataRows);
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'MFM Factor');

      const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `Host_MFM_Factor_Report_${fileTimestamp}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast.success(`Successfully exported ${allData.length} records to ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export data to Excel. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [fetchAllDataForExport, searchText]);

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
      headerName: "MFM Number",
      field: "mfm_number",
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
      headerName: "Stock Code",
      field: "stock_code",
      minWidth: 130,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Current K Factor",
      field: "current_k_factor",
      minWidth: 140,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Last K Factor",
      field: "last_k_factor",
      minWidth: 140,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Current Meter Factor",
      field: "current_meter_factor",
      minWidth: 160,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Last Meter Factor",
      field: "last_meter_factor",
      minWidth: 150,
      sortable: true,
      filter: true,
      resizable: true,
    },
  ];

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    if (gridApiRef.current) {
      gridApiRef.current.sizeColumnsToFit();
    }
    retryMirrorScrollbar();
  }, [retryMirrorScrollbar]);

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
            '<span class="ag-overlay-no-rows-center">No Records Found</span>'
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

export default HostMFMKFactor;
