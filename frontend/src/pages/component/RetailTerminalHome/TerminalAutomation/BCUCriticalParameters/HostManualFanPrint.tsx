import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { convertUTCDateToLocalDate } from "@/hooks/useRelativeTime";
import { Card } from '@/@/components/ui/card';
import { Input } from '@/@/components/ui/input';
import { Button } from '@/@/components/ui/button';
import { RefreshCw, Loader, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { apiClient } from "@/services/apiClient";
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from "@/hooks/useAgGridMirrorScrollbar";

interface HostManualFanPrint {
  manual_fan_count: number;
  total_count: number;
  auto_fan_count: number;
  id: number;
  entity_id: string;
  created_at: string;
  updated_at: string;
  sap_id: string;
  location_name: string;
  zone: string;
}

interface HostManualFanPrintResponse {
  data: HostManualFanPrint[];
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

export const HostManualFanPrint: React.FC<TableProps> = ({
  zone,
  plant,
  dateFilter,
  chartFilterDate
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const [rowData, setRowData] = useState<HostManualFanPrint[]>([]);
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
    currentPage,
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
      "manual_fan_count",
      "auto_fan_count",
      "total_count",
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

      const response = await apiClient.get<HostManualFanPrintResponse>('/api/hostmanualfanprinted', { params });

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
      headerName: "Manual Fan Count",
      field: "manual_fan_count",
      minWidth: 140,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Total Count",
      field: "total_count",
      minWidth: 120,
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      headerName: "Auto Fan Count",
      field: "auto_fan_count",
      minWidth: 140,
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
  const fetchAllDataForExport = useCallback(async () => {
    try {
      const queryParams = buildQueryWithFilters();
      const params: any = {
        ...queryParams,
        skip: 0,
        limit: 10000, // Large limit to get all data
        sort: JSON.stringify({ "created_at": "desc" }),
      };

      if (searchText.trim()) {
        params.search_text = searchText;
      }

      const response = await apiClient.get<HostManualFanPrintResponse>('/api/hostmanualfanprinted', { params });

      // Convert created_at to local time
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

      // Create worksheet data with heading and filters
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

      worksheetData.push([`HOST MANUAL FAN PRINT REPORT - ${formattedDateForTitle} at ${formattedTimeForTitle}`]);
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
        appliedFilters.push(`Date Filter: Applied`);
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
        'Manual Fan Count',
        'Auto Fan Count',
        'Total Count'
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
        row.manual_fan_count || '',
        row.auto_fan_count || '',
        row.total_count || ''
      ]);

      // Add all data rows to worksheet data
      worksheetData.push(...dataRows);

      // Create worksheet from the data
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Style the worksheet
      const range = XLSX.utils.decode_range(worksheet['!ref']);

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];

          if (cell) {
            // Main heading style (row 0)
            if (row === 0) {
              cell.s = {
                font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "2563EB" } },
                alignment: { horizontal: "center", vertical: "center" }
              };
            }
            // Generation info styling
            else if (row === 2) {
              cell.s = {
                font: { bold: true, size: 11 },
                fill: { fgColor: { rgb: "F3F4F6" } }
              };
            }
            // Data headers styling
            else if (row === worksheetData.findIndex(rowData =>
              Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
            )) {
              cell.s = {
                font: { bold: true, size: 11, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "374151" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                }
              };
            }
            // Data rows styling
            else if (row > worksheetData.findIndex(rowData =>
              Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
            )) {
              cell.s = {
                border: {
                  top: { style: "thin", color: { rgb: "E5E7EB" } },
                  bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                  left: { style: "thin", color: { rgb: "E5E7EB" } },
                  right: { style: "thin", color: { rgb: "E5E7EB" } }
                },
                alignment: { vertical: "center" }
              };
            }
          }
        }
      }

      // Set column widths
      const columnWidths = headers.map((header) => {
        let width = Math.max(header.length, 12);

        switch (header) {
          case 'Date Time Stamp':
            width = 18;
            break;
          case 'Location Name':
            width = 20;
            break;
          case 'Manual Fan Count':
          case 'Auto Fan Count':
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Manual Fan Print');

      // Generate filename with detailed timestamp
      const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `Host_Manual_Fan_Print_Report_${fileTimestamp}.xlsx`;

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

export default HostManualFanPrint;