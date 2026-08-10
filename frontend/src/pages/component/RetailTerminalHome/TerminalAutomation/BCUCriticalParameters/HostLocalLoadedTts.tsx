import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { RefreshCw, Loader, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { convertUTCDateToLocalDate } from '@/hooks/useRelativeTime';
import { Card } from '@/@/components/ui/card';
import { toast } from 'sonner';
import { apiClient } from "@/services/apiClient";
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from "@/hooks/useAgGridMirrorScrollbar";

interface HostLocalLoadedTt {
  id: number;
  created_at: string;
  updated_at: string;
  entity_id: string;
  // sr_number: number;
  bay_number: string;
  bcu_number: string;
  recipe_name: string;
  truck_number: string;
  card_number: string;
  start_totalizer: number;
  end_totalizer: number;
  loaded_qty: number;
  transaction_end_time: string;
  sap_id: string;
  location_name: string;
  zone: string;
  compartment_number: string;
}

interface HostLocalLoadedTtsResponse {
  data: HostLocalLoadedTt[];
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

export const HostLocalLoadedTts: React.FC<TableProps> = ({
  zone,
  plant,
  dateFilter,
  bcuQuery,
  chartFilterDate
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [rowData, setRowData] = useState<HostLocalLoadedTt[]>([]);
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

  // Specify the exact fields to retrieve
  const fields = [
    "bay_number",
    "bcu_number", 
    "recipe_name",
    "truck_number", 
    "start_totalizer", 
    "end_totalizer", 
    "loaded_qty",
    "created_at",
    "location_name", 
    "zone", 
    "sap_id", 
    "compartment_number",
    // "sr_number"
  ];

  // Parse chartFilterDate (from backend) to { first, last }; use year from value when present (e.g. Mar-2026, March 2026)
  const getChartFilterDateRange = useCallback((val: string): { first: string; last: string } | null => {
    const v = val.trim();
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return { first: v, last: v };
    }
    if (/^\d{4}-\d{2}$/.test(v)) {
      const [y, m] = v.split('-').map(Number);
      const first = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { first, last };
    }
    const shortMonths: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const fullMonths: Record<string, number> = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
    // MMM-YYYY or "March 2026" / "Mar 2026" – use year from backend
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
    if (monthNum === undefined && v.length >= 3) {
      monthNum = shortMonths[valNorm.slice(0, 3)];
    }
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

    // Add date filter: prefer dateFilter when set; else use chartFilterDate from backend (year from value e.g. Mar-2026 → 2026)
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
    
    const result = { q: completeQuery, fields: JSON.stringify(fields) };
    console.log('[HostLocalLoadedTts] buildQueryWithFilters', { chartFilterDate, dateFilter, zone, plant, query: result.q });
    return result;
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

      const response = await apiClient.get<HostLocalLoadedTtsResponse>('/api/hostlocalloadedtts', { params });
      console.log('[HostLocalLoadedTts] API response', { chartFilterDate, page, requestQuery: params.q, rowCount: response.data.data?.length, total: response.data.total });

      const getDatePartStr = (createdAt: string | undefined) => {
        if (createdAt == null || createdAt === '') return '';
        const s = String(createdAt).trim();
        const datePart = s.slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '';
      };

      let rawData = Array.isArray(response.data.data) ? response.data.data : [];
      if (chartFilterDate && chartFilterDate.trim() !== '') {
        const range = getChartFilterDateRange(chartFilterDate.trim());
        if (range) {
          const before = rawData.length;
          rawData = rawData.filter(item => {
            const dateStr = getDatePartStr(item.created_at);
            const inRange = dateStr >= range.first && dateStr <= range.last;
            if (!inRange) {
              console.log('[HostLocalLoadedTts] Filtered out (outside range)', { dateStr, range: `${range.first} to ${range.last}`, rawCreatedAt: item.created_at });
            }
            return inRange;
          });
          console.log('[HostLocalLoadedTts] Client-side date filter', { chartFilterDate, range, before, after: rawData.length });
        }
      }

      const processedData = rawData.map(item => {
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
  }, [buildQueryWithFilters, getChartFilterDateRange, chartFilterDate, searchText, currentPage, pageSize]);

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
  filter: false,
  suppressMenu: true,
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
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },
    {
      headerName: "Location",
      field: "location_name",
      minWidth: 105,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },
    {
      headerName: "Zone",
      field: "zone",
      minWidth: 95,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },
    //     {
    //   headerName: "sr_number",
    //   field: "sr_number",
    //   minWidth: 100,
    //   sortable: true,
    //   resizable: true,
    //   filter: false, 
    //   suppressMenu: true 
    // },
    {
      headerName: "Bay Number",
      field: "bay_number",
      minWidth: 130,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },
    {
      headerName: "BCU Number",
      field: "bcu_number",
      minWidth: 133,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },
    {
      headerName: "Recipe",
      field: "recipe_name",
      minWidth: 100,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },
    {
      headerName: "Truck Number",
      field: "truck_number",
      minWidth: 140,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },
    {
      headerName: "Start Totalizer",
      field: "start_totalizer",
      minWidth: 145,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true, 
      valueFormatter: (params) => formatNumber(params.value),
    },
    {
      headerName: "End Totalizer",
      field: "end_totalizer",
      minWidth: 145,
      sortable: true,
      resizable: true,
      valueFormatter: (params) => formatNumber(params.value),
      filter: false, 
      suppressMenu: true 
    },
    {
      headerName: "Loaded Qty",
      field: "loaded_qty",
      minWidth: 125,
      sortable: true,
      resizable: true,
      valueFormatter: (params) => formatNumber(params.value),
      // cellClass: (params) => {
      //   const value = params.value || 0;
      //   return value > 0 ? "text-green-500" : "text-gray-500";
      // },
      filter: false, 
      suppressMenu: true 
    },
    {
      headerName: "Compartment Number",
      field: "compartment_number",
      minWidth: 160,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
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

    const response = await apiClient.get<HostLocalLoadedTtsResponse>('/api/hostlocalloadedtts', { params });
    
    const getDatePartStr = (createdAt: string | undefined) => {
      if (createdAt == null || createdAt === '') return '';
      const s = String(createdAt).trim();
      const datePart = s.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '';
    };

    let rawData = response.data.data;
    if (chartFilterDate && chartFilterDate.trim() !== '') {
      const range = getChartFilterDateRange(chartFilterDate.trim());
      if (range) {
        rawData = rawData.filter(item => {
          const dateStr = getDatePartStr(item.created_at);
          return dateStr >= range.first && dateStr <= range.last;
        });
      }
    }

    const processedData = rawData.map(item => {
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
}, [buildQueryWithFilters, getChartFilterDateRange, chartFilterDate, searchText]);
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

    worksheetData.push([`HOST LOCAL LOADED TTS REPORT - ${formattedDateForTitle} at ${formattedTimeForTitle}`]);
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
    
    if (chartFilterDate && chartFilterDate.trim() !== '') {
      appliedFilters.push(`Chart Filter: ${chartFilterDate}`);
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
      'Location',
      'Zone',
      'Bay Number',
      'BCU Number',
      'Recipe',
      'Truck Number',
      'Start Totalizer',
      'End Totalizer',
      'Loaded Qty',
      'Compartment Number'
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
      row.bay_number || '',
      row.bcu_number || '',
      row.recipe_name || '',
      row.truck_number || '',
      row.start_totalizer || '',
      row.end_totalizer || '',
      row.loaded_qty || '',
      row.compartment_number || ''
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
        case 'Recipe':
        case 'Truck Number':
        case 'Compartment Number':
          width = 20;
          break;
        case 'Start Totalizer':
        case 'End Totalizer':
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Local Loaded TTS');

    // Generate filename with detailed timestamp
    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `Host_Local_Loaded_TTS_Report_${fileTimestamp}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);

    toast.success(`Successfully exported ${allData.length} records to ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.error('Failed to export data to Excel. Please try again.');
  } finally {
    setIsDownloading(false);
  }
}, [fetchAllDataForExport, zone, plant, dateFilter, chartFilterDate, searchText]);

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
          key={`host-loaded-${zone ?? ''}-${plant ?? ''}-${dateFilter ?? ''}-${bcuQuery ?? ''}-${chartFilterDate ?? ''}`}
          getRowId={(params) => {
            const d = params.data;
            if (d?.id != null) return String(d.id);
            return `${d?.created_at ?? ''}-${d?.bay_number ?? ''}-${d?.bcu_number ?? ''}-${d?.compartment_number ?? ''}-${d?.start_totalizer ?? ''}`;
          }}
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            flex: 1,
            cellStyle: { fontSize: "12px" },
            floatingFilter: false,

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
            '<span class="ag-overlay-no-rows-center">No Local Loaded TTS Found</span>'
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

export default HostLocalLoadedTts;
