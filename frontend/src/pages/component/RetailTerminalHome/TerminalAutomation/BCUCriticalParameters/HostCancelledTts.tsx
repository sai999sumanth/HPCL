import React, { useEffect, useState, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import axios from "axios";
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { RefreshCw, Loader, Download } from 'lucide-react';
import { convertUTCDateToLocalDate } from "@/hooks/useRelativeTime";
import { Card } from '@/@/components/ui/card';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { apiClient } from "@/services/apiClient";
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from "@/hooks/useAgGridMirrorScrollbar";

interface HostCancelledTt {
  id: number;
  created_at: string;
  updated_at: string;
  entity_id: string | null;
  load_number: number;
  truck_number: string;
  created_date: string;
  customer_name: string;
  product_name: string;
  required_qty: number;
  cancelled_by: string;
  cancelled_date: string;
  sap_id: string;
  location_name: string;
  zone: string;
  entry_time?: string;
  exit_time?: string;
  remarks?: string;
}

export type ProductWithQty = { product_name: string; required_qty: number };

/** Aggregated row: one per load_number, required_qty summed, count = number of rows merged, products_with_qty = all products and their required qty */
interface HostCancelledTtAggregated extends Omit<HostCancelledTt, 'required_qty'> {
  required_qty: number;
  count: number;
  products_with_qty: ProductWithQty[];
}

function aggregateByLoadNumber(data: HostCancelledTt[]): HostCancelledTtAggregated[] {
  const byLoad = new Map<number, HostCancelledTt[]>();
  data.forEach((row) => {
    const load = row.load_number;
    if (!byLoad.has(load)) byLoad.set(load, []);
    byLoad.get(load)!.push(row);
  });
  return Array.from(byLoad.entries()).map(([load_number, rows]) => {
    const first = rows[0]!;
    const required_qty = rows.reduce((sum, r) => sum + (Number(r.required_qty) || 0), 0);
    const productMap = new Map<string, number>();
    rows.forEach((r) => {
      const pname = (r.product_name || "").trim();
      if (pname) productMap.set(pname, (productMap.get(pname) || 0) + (Number(r.required_qty) || 0));
    });
    const products_with_qty: ProductWithQty[] = Array.from(productMap.entries()).map(([product_name, required_qty]) => ({ product_name, required_qty }));
    return {
      ...first,
      load_number,
      required_qty,
      count: rows.length,
      products_with_qty,
    };
  });
}

interface HostCancelledTtsResponse {
  data: HostCancelledTt[];
  total: number;
  count: number;
}

interface TableProps {
  zone?: string | null;
  plant?: string | null;
  dateFilter?: string;
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

export const HostCancelledTts: React.FC<TableProps> = ({
  zone,
  plant,
  dateFilter,
  chartFilterDate
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pageSize] = useState<number>(20);
  const [searchText, setSearchText] = useState<string>('');
  const [rowData, setRowData] = useState<HostCancelledTtAggregated[]>([]);
  const gridApiRef = useRef<any>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const { tableWrapRef, retryMirrorScrollbar } = useAgGridMirrorScrollbar([
    loading,
    rowData.length,
    zone,
    plant,
    dateFilter,
    chartFilterDate,
    pageSize,
  ]);

  // Parse chartFilterDate from backend (e.g. Mar-2026, March 2026, 2026-03) to { first, last }; use year from value
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
    
    const fields = [
      "load_number",
      "truck_number",
      "customer_name", 
      "product_name",
      "required_qty",
      "cancelled_by",
      "cancelled_date",
      "sap_id",
      "location_name",
      "zone",
      "created_at",
      "entry_time",
      "exit_time",
      "remarks"
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

    // Date filter: prefer dateFilter when set; else use chartFilterDate from backend (year from value e.g. Mar-2026 → 2026)
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
    
    return {
      q: completeQuery,
      fields: JSON.stringify(fields)
    };
  }, [zone, plant, dateFilter, chartFilterDate, getChartFilterDateRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryWithFilters();
      const params: any = {
        ...queryParams,
        skip: 0,
        limit: 0,
        sort: JSON.stringify({"created_at": "desc"}),
      };
      
      if (searchText.trim()) {
        params.search_text = searchText;
      }
  
      const response = await apiClient.get<HostCancelledTtsResponse>('/api/hostcancelledtts', { params });
      
      const processedData = response.data.data.map(item => ({
        ...item,
        created_at: convertUTCDateToLocalDate(new Date(item.created_at)).toISOString()
      }));

      const aggregated = aggregateByLoadNumber(processedData);
      setRowData(aggregated);
      setTotalRecords(response.data.total);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to fetch data');
      setError("Failed to fetch data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [buildQueryWithFilters, searchText]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loading) retryMirrorScrollbar();
  }, [loading, rowData, retryMirrorScrollbar]);

  const handleRefresh = useCallback(() => {
    fetchData();
    setSearchText('');
  }, [fetchData]);

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

      const response = await apiClient.get<HostCancelledTtsResponse>('/api/hostcancelledtts', { params });
      
      const processedData = response.data.data.map(item => ({
        ...item,
        created_at: convertUTCDateToLocalDate(new Date(item.created_at)).toISOString()
      }));

      return aggregateByLoadNumber(processedData);
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

    // Format date filter for display
    const formatDateFilter = (dateFilter) => {
      if (!dateFilter) return '';
      const match = dateFilter.match(/created_at::DATE BETWEEN '([^']+)' AND '([^']+)'/);
      if (match) {
        return `${match[1]} to ${match[2]}`;
      }
      return dateFilter;
    };

    // Add report title
    const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '-');
    worksheetData.push([`HOST CANCELLED TICKETS REPORT - ${currentDate}`]);
    worksheetData.push([]); // Spacer

    // Add records count
    worksheetData.push(['Total Records Exported:', allData.length]);
    worksheetData.push([]); // Spacer

    // Add applied filters with formatted date range
    const appliedFilters = [];
    
    if (zone && zone !== 'all') {
      appliedFilters.push(`Zone: ${zone}`);
    }
    
    if (plant && plant !== 'all') {
      appliedFilters.push(`Plant: ${plant}`);
    }
    
    if (dateFilter && dateFilter.trim() !== '') {
      appliedFilters.push(`Date Range: ${formatDateFilter(dateFilter)}`);
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

    worksheetData.push([], []); // Double spacer

    // Add column headers (allData is aggregated by load_number)
    const headers = [
      'Cancelled Date',
      'Location ID',
      'Location',
      'Zone',
      'Load Number',
      'Count',
      'Truck Number',
      'Customer',
      'Product & Fan Qty',
      'Total Fan Qty',
      'Cancelled By',
      'Remarks',
    ];
    worksheetData.push(headers);

    const formatProductsWithQty = (row: { products_with_qty?: ProductWithQty[] }) => {
      const list = row.products_with_qty;
      if (!list?.length) return "";
      return list.map((p) => `${p.product_name} : ${Number(p.required_qty).toFixed(2)}`).join("\n");
    };

    // Add data rows with formatted dates (aggregated: one row per load_number)
    const dataRows = allData.map((row: any) => [
      row.cancelled_date ? new Date(row.cancelled_date).toLocaleString('en-US', {
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
      row.load_number || '',
      row.count ?? '',
      row.truck_number || '',
      row.customer_name || '',
      formatProductsWithQty(row),
      row.required_qty != null ? Number(row.required_qty).toFixed(2) : '',
      row.cancelled_by || '',
      row.remarks ?? ''
    ]);

    worksheetData.push(...dataRows);
    
    // Create and style worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Cancelled Date
      { wch: 12 }, // Location ID
      { wch: 15 }, // Location
      { wch: 10 }, // Zone
      { wch: 12 }, // Load Number
      { wch: 8 },  // Count
      { wch: 15 }, // Truck Number
      { wch: 15 }, // Customer
      { wch: 28 }, // Product & Fan Qty
      { wch: 15 }, // Total Fan Qty
      { wch: 15 }, // Cancelled By
      { wch: 25 }  // Remarks
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cancelled Tickets');
    
    // Export file
    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `Host_Cancelled_Tickets_Report_${fileTimestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);

    toast.success(`Successfully exported ${allData.length} records to ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.error('Failed to export data to Excel. Please try again.');
  } finally {
    setIsDownloading(false);
  }
}, [fetchAllDataForExport, zone, plant, dateFilter, chartFilterDate, searchText]);


  const columnDefs: ColDef[] = [
    {
      headerName: "Cancelled Date",
      field: "cancelled_date",
      minWidth: 150,
      sortable: true,
      filter: true,
      resizable: true,
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        try {
          const date = new Date(params.value);
          return date.toLocaleString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        } catch (error) {
          console.error('Error formatting cancelled_date:', error);
          return 'Invalid date';
        }
      },
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
      minWidth: 105,
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
      headerName: "Load Number",
      field: "load_number",
      minWidth: 135,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Count",
      field: "count",
      minWidth: 80,
      sortable: true,
      filter: true,
      resizable: true,
    },
            {
      headerName: "entry_time",
      field: "entry_time",
      minWidth: 125,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },    {
      headerName: "exit_time",
      field: "exit_time",
      minWidth: 125,
      sortable: true,
      resizable: true,
      filter: false, 
      suppressMenu: true 
    },    {
      headerName: "remarks",
      field: "remarks",
      minWidth: 125,
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
      filter: true,
      resizable: true,
    },
    {
      headerName: "Customer",
      field: "customer_name",
      minWidth: 120,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Product & Fan Qty",
      field: "products_with_qty",
      minWidth: 210,
      maxWidth: 500,
      flex: 0,
      sortable: false,
      filter: true,
      resizable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { lineHeight: 1.25 },
      valueGetter: (params: any) => {
        const list = params.data?.products_with_qty as ProductWithQty[] | undefined;
        if (!list?.length) return "";
        return list.map((p) => `${p.product_name} : ${Number(p.required_qty).toFixed(2)}`).join("\n");
      },
      cellRenderer: (params: { data?: { products_with_qty?: ProductWithQty[] } }) => {
        const list = params.data?.products_with_qty;
        if (!list?.length) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, lineHeight: 1.25 }}>
            {list.map((p: ProductWithQty, i: number) => (
              <div key={i}>
                {p.product_name}
                {" :\u00A0"}
                {Number(p.required_qty).toFixed(2)}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      headerName: "Total Fan Qty",
      field: "required_qty",
      minWidth: 135,
      sortable: true,
      filter: true,
      resizable: true,
      valueFormatter: (params) => params.value?.toFixed(2) || '0.00',
    },
    {
      headerName: "Cancelled By",
      field: "cancelled_by",
      minWidth: 135,
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

  if (error) {
    return <div className="text-gray-500 p-4">No Data</div>;
  }

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
          
          pagination={true}
          paginationPageSize={pageSize}
          paginationPageSizeSelector={[20, 50, 100]}
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
            '<span class="ag-overlay-no-rows-center">No Cancelled Tickets Found</span>'
          }
          rowClassRules={{
            'ag-row-odd': (params) => params.rowIndex % 2 !== 0,
          }}
        />
      </div>
    </Card>
  );
};

export default HostCancelledTts;
