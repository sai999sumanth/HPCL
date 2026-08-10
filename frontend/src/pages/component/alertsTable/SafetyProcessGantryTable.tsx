import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '../../../@/components/ui/button';
import { Input } from '../../../@/components/ui/input';
import {
  RefreshCw,
  Filter,
  MoreVertical,
  Loader,
  Triangle,
  Download
} from 'lucide-react';
import DataGrid from '../../../components/common/DataGrid';
import { Badge } from "../../../@/components/ui/badge";
import axios from 'axios';
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { useNavigate } from 'react-router-dom';
import { maxWidth } from '@mui/system';
import { toast } from 'sonner';
import AlertHistoryDialogV2 from './AlertHistoryDialogV2';
import * as XLSX from 'xlsx';
import { apiClient } from '@/services/apiClient';

interface FilterValue {
  key: string
  cond: string
  value: string
}

interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string) => void;
  zone?: string | null;
  plant?: string | null;
  filters?: FilterValue[];
  dateFilter?: any;
  onAlertStatusChange?: (alertStatus: "Open" | "Close" | "All") => void;
  /** When true, exclude rows where interlock_name starts with "Proof Test" (e.g. VFT tab only) */
  excludeProofTestRows?: boolean;
}

interface HistoryDialogState {
  isOpen: boolean;
  alertId: string | number | null;
}

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Helper function to calculate duration between dates
const calculateDuration = (startDate: string, endDate: string): string => {
  try {
    if (!startDate || !endDate) return '-';

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';

    // If end date is before start date, return invalid
    if (end < start) return 'Invalid date range';

    const diff = end.getTime() - start.getTime();

    // Convert to appropriate time units
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  } catch (error) {
    console.error('Error calculating duration:', error);
    return '-';
  }
};


export const SafetyProcessGantryTable: React.FC<ROAlertsTableV2Props> = ({ query, onLocationChange, zone, plant, onAlertStatusChange, excludeProofTestRows = false }) => {
  const [pageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Add alert status filter state
  const [alertStatusFilter, setAlertStatusFilter] = useState<"Open" | "Close" | "All">("All");

  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'zone', 'location_name', 'sap_id', 'alert_category', 'device_name', 'device_id', 'alert_status',
    'interlock_name', 'start_date', 'closed_at', 'moc_status', 'moc_duration', 'end_date',
    'actual_duration', 'actions'
  ]);
  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null
  });
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const gridApi = React.useRef<any>(null);

  const handleAlertStatusToggle = useCallback(() => {
    setAlertStatusFilter(prev => {
      let newStatus: "Open" | "Close" | "All";

      if (prev === "All") {
        newStatus = "Open";
      } else if (prev === "Open") {
        newStatus = "Close";
      } else {
        newStatus = "All";
      }

      // Call the parent callback if provided
      if (onAlertStatusChange) {
        onAlertStatusChange(newStatus);
      }

      return newStatus;
    });
  }, [onAlertStatusChange]);

  useEffect(() => {
    if (onAlertStatusChange) {
      onAlertStatusChange(alertStatusFilter);
    }
  }, []);

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);

  // Function to build the complete query with filters
  const buildQueryWithFilters = useCallback((baseQuery: string) => {
    let completeQuery = baseQuery || '';

    if (alertStatusFilter !== "All") {
      const alertStatusQuery = `alert_status='${alertStatusFilter}'`;
      completeQuery = completeQuery ? `${completeQuery} AND ${alertStatusQuery}` : alertStatusQuery;
    }
    // Add zone filter if provided
    if (zone && zone !== 'all') {
      completeQuery += ` AND zone='${zone}'`;
    }

    // Add plant filter if provided
    if (plant && plant !== 'all') {
      completeQuery += ` AND sap_id='${plant}'`;
    }

    return completeQuery;
  }, [zone, plant, alertStatusFilter]);

  const fields = ["zone,location_name", "sap_id", "alert_category", "alert_status", "device_name", "device_id", "interlock_name", "created_at", "closed_at"];

  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {
    setIsLoading(true);
    try {
      // Calculate the current page based on startRow and pageSize
      const currentPageNumber = Math.floor(startRow / pageSize);

      // Build the complete query with filters (now includes alert status)
      const completeQuery = buildQueryWithFilters(query || '');

      const params: any = {
        q: completeQuery, // Use the enhanced query with filters including alert status
        skip: currentPageNumber,
        limit: pageSize,
        fields: JSON.stringify(fields),
        sort: sortModel?.length ? `${sortModel[0].colId} ${sortModel[0].sort}` : undefined,
      };

      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }

      const response = await apiClient.get('/api/alerts', { params });
      console.log("response ag grid", response);

      setCurrentPage(currentPageNumber);

      return {
        data: response.data.data,
        lastRow: response.data.total
      };
    } catch (err) {
      console.error('Error fetching alerts:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [query, debouncedSearchText, pageSize, zone, plant, buildQueryWithFilters]);

  // When excludeProofTestRows (e.g. VFT tab only), exclude rows where interlock_name starts with "Proof Test"
  const filterProofTestRows = (rows: any[]) =>
    excludeProofTestRows
      ? (rows || []).filter(
          (row) => !(row?.interlock_name || '').trim().toLowerCase().startsWith('proof test')
        )
      : rows || [];

  const dataSource = useMemo(() => ({
    getRows: async (params: any) => {
      try {
        const result = await fetchData(params.startRow, params.endRow, params.sortModel);
        const filteredData = filterProofTestRows(result.data);
        params.successCallback(filteredData, result.lastRow);
      } catch (err) {
        params.failCallback();
      }
    }
  }), [fetchData, excludeProofTestRows]);

  // Refresh grid when zone, plant, or alert status changes
  useEffect(() => {
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page when filters change
    }
  }, [zone, plant, query, alertStatusFilter]);

  useEffect(() => {
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page when search changes
    }
  }, [debouncedSearchText]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const handleRefresh = useCallback(() => {
    if (gridApi.current) {
      setLoading(true)
      gridApi.current.refreshInfiniteCache()
      setSearchText("")
      setCurrentPage(0)

      // Simulate async load complete after a delay
      setTimeout(() => {
        setLoading(false)
      }, 1000)
    }
  }, [])

  const handleLocationClick = useCallback((sapId: string) => {
    if (onLocationChange) {
      onLocationChange(sapId);
    } else {
      navigate(`/location/${sapId}`);
    }
  }, [onLocationChange, navigate]);

  // Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: 'Zone',
      field: 'zone',
      sortable: true,
      minWidth: 110,
      filter: true,
      hide: !selectedColumns.includes('zone')
    },
    {
      headerName: 'Plant',
      field: 'location_name',
      sortable: true,
      minWidth: 110,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => handleLocationClick(params.data.sap_id)}>
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('location_name')
    },
    {
      headerName: 'SAP ID',
      field: 'sap_id',
      sortable: true,
      minWidth: 130,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => handleLocationClick(params.value)}>
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('sap_id')
    },
    {
      headerName: 'System',
      field: 'alert_category',
      minWidth: 110,
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('alert_category')
    },
    {
      headerName: 'Equipment',
      field: 'device_name',
      minWidth: 150,
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('device_name'),
      valueFormatter: (params) => params.value?.split('@')[0] || ''
    },
    // {
    //   headerName: 'Device Name',
    //   field: 'device_name',
    //   minWidth: 150,
    //   sortable: true,
    //   filter: true,
    //   hide: !selectedColumns.includes('device_name')
    // },
    {
      headerName: 'Alert Status',
      field: 'alert_status',
      sortable: true,
      minWidth: 150,
      filter: true,
      hide: !selectedColumns.includes('alert_status')
    },
    {
      headerName: 'Alert Type',
      field: 'interlock_name',
      sortable: true,
      minWidth: 150,
      filter: true,
      hide: !selectedColumns.includes('interlock_name')
    },
    {
      headerName: 'Created At',
      field: 'created_at',
      sortable: true,
      minWidth: 240,
      filter: true,
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
              <span className="text-sm text-gray-900">{relativeTime}</span>
              <span className="text-xs text-gray-500">{formattedDateTime}</span>
            </div>
          );
        } catch (error) {
          console.error('Error formatting date:', error);
          return 'Invalid date';
        }
      },
      hide: !selectedColumns.includes('start_date'),
    },
    // {
    //   headerName: 'Closed At',
    //   field: 'closed_at',
    //   sortable: true,
    //   minWidth: 150,
    //   filter: true,
    //   // hide: !selectedColumns.includes('closed_at')
    // },
{
  headerName: 'Closed At',
  field: 'closed_at',
  sortable: true,
  minWidth: 240,
  filter: true,
  cellRenderer: (params: any) => {
    if (!params.value) return '-';

    try {
      // Convert UTC to local time (IST)
      const utcDate = new Date(params.value);
      const localDate = convertUTCDateToLocalDate(utcDate);

      // Format the absolute time
      const formattedDateTime = localDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      // Get relative time
      const relativeTime = formatRelativeTime(params.value);

      return (
        <div className="flex flex-col">
          <span className="text-sm text-gray-900">{relativeTime}</span>
          <span className="text-xs text-gray-500">{formattedDateTime}</span>
        </div>
      );
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  },
},

    // {
    //   headerName: 'MOC Status',
    //   field: 'moc_status',
    //   sortable: true,
    //   minWidth: 130,
    //   filter: true,
    //   cellRenderer: (params: any) => (
    //     <span>
    //       {params.value || '-'}
    //     </span>
    //   ),
    //   hide: !selectedColumns.includes('moc_status')
    // },
    // {
    //   headerName: 'MOC Duration as per approval',
    //   field: 'moc_duration',
    //   sortable: true,
    //   minWidth: 220,
    //   filter: true,
    //   cellRenderer: (params: any) => (
    //     <span>
    //       {params.value || '-'}
    //     </span>
    //   ),
    //   hide: !selectedColumns.includes('moc_duration')
    // },
    // {
    //   headerName: 'End Date for maintenance/Fault',
    //   field: 'updated_at',
    //   sortable: true,
    //   minWidth: 240,
    //   filter: true,
    //   cellRenderer: (params: any) => {
    //     if (!params.value) return '-';
    //     try {
    //       // Convert UTC to local time
    //       const utcDate = new Date(params.value);
    //       const localDate = convertUTCDateToLocalDate(utcDate);

    //       // Format the absolute time using the converted local date
    //       const formattedDateTime = localDate.toLocaleString('en-US', {
    //         year: 'numeric',
    //         month: 'short',
    //         day: 'numeric',
    //         hour: '2-digit',
    //         minute: '2-digit',
    //         hour12: true
    //       });

    //       // Get the relative time (already handles UTC conversion internally)
    //       const relativeTime = formatRelativeTime(params.value);

    //       // Return both times in a stacked layout
    //       return (
    //         <div className="flex flex-col">
    //           <span className="text-sm text-gray-900">{relativeTime}</span>
    //           <span className="text-xs text-gray-500">{formattedDateTime}</span>
    //         </div>
    //       );
    //     } catch (error) {
    //       console.error('Error formatting date:', error);
    //       return 'Invalid date';
    //     }
    //   },
    //   hide: !selectedColumns.includes('end_date'),
    // },
    // {
    //   headerName: 'Actual Duration under maintenance/Fault status',
    //   field: 'actual_duration',
    //   sortable: true,
    //   minWidth: 300,
    //   filter: true,
    //   cellRenderer: (params: any) => (
    //     <span>
    //       {calculateDuration(params.data.created_at, params.data.updated_at)}
    //     </span>
    //   ),
    //   hide: !selectedColumns.includes('actual_duration')
    // },
    {
      headerName: 'Actions',
      field: 'actions',
      sortable: false,
      filter: false,
      width: 100,
      pinned: 'right',
      cellRenderer: (params: any) => (
        <div className="text-right">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => handleViewHistory(params.data.id)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      ),
      hide: !selectedColumns.includes('actions')
    }
  ], [selectedColumns, handleViewHistory, handleLocationClick]);
  const fetchAllDataForExport = useCallback(async () => {
    try {
      const completeQuery = buildQueryWithFilters(query || '');

      const params: any = {
        q: completeQuery,
        skip: 0,
        limit: 10000, // Large number to get all data
        fields: JSON.stringify(fields),
      };

      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }

      const response = await apiClient.get('/api/alerts', { params });
      return response.data.data;
    } catch (err) {
      console.error('Error fetching all data for export:', err);
      throw err;
    }
  }, [query, debouncedSearchText, zone, plant, buildQueryWithFilters]);
  const handleDownloadExcel = useCallback(async () => {
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

      worksheetData.push([`Trends and Analytics - ${formattedDateForTitle} at ${formattedTimeForTitle}`]);
      worksheetData.push([]); // Empty row for spacing

      // Add generation info
      worksheetData.push(['Total Records Exported:', allData.length]);
      worksheetData.push([]); // Empty row for spacing

      // Build filter display
      const appliedFilters = [];

      if (alertStatusFilter) {
        appliedFilters.push(`Alert Status: ${alertStatusFilter}`);
      }

      if (zone && zone !== 'all') {
        appliedFilters.push(`Zone: ${zone}`);
      }

      if (plant && plant !== 'all') {
        appliedFilters.push(`Plant: ${plant}`);
      }

      if (debouncedSearchText.trim()) {
        appliedFilters.push(`Search Text: ${debouncedSearchText}`);
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
        'Alert Status',
        'System',
        'Alarm Name',
        'Equipment ID',
        'Alert Closed Time'
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
        row.alert_status || '',
        row.alert_category || '',
        row.interlock_name || '',
        row.device_name ? row.device_name.split('@')[0] : '',
        row.updated_at ? new Date(row.updated_at).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) : ''
      ]);

      // Add all data rows to worksheet data
      worksheetData.push(...dataRows);

      // Create worksheet from the data
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'BCU Alerts');

      // Generate filename with detailed timestamp
      const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `Trends_and_Analytics_${fileTimestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast.success(`Successfully exported ${allData.length} alerts to ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export data to Excel. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [fetchAllDataForExport, alertStatusFilter, zone, plant, debouncedSearchText, query, buildQueryWithFilters]);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2 space-x-2">
        <div className="flex-grow">
          <Input
            placeholder="Search maintenance records..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-8"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={
              alertStatusFilter === 'All'
                ? 'text-blue-600'
                : alertStatusFilter === 'Open'
                  ? 'text-red-600'
                  : 'text-green-600'
            }
          >
            {alertStatusFilter}
          </span>
          <button
            onClick={handleAlertStatusToggle}
            className={`relative inline-flex h-5 w-12 items-center rounded-full transition-colors duration-300 ease-in-out ${alertStatusFilter === "All"
                ? "bg-blue-400"
                : alertStatusFilter === "Open"
                  ? "bg-red-400"
                  : "bg-green-400"
              } focus:outline-none focus:ring-1 focus:ring-gray-300`}
            type="button"
            role="switch"
            aria-checked={alertStatusFilter !== "All"}
            aria-label="Toggle alert status filter"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${alertStatusFilter === "All"
                  ? "translate-x-1"
                  : alertStatusFilter === "Open"
                    ? "translate-x-4"
                    : "translate-x-7"
                }`}
            />
          </button>
        </div>
        <Button
          onClick={handleDownloadExcel}
          className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
          disabled={isDownloading}
          title={isDownloading ? "Downloading..." : "Download Excel"}
        >
          {isDownloading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Active filters indicator */}
      {/* <div className="flex items-center gap-2 mb-2 py-1 px-2 bg-gray-50 rounded-md text-sm">
        <span className="font-medium">Active filters:</span>
        <Badge variant="outline" className={`${alertStatusFilter === "Open" ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
          Status: {alertStatusFilter}
        </Badge>
        {zone && zone !== 'all' && (
          <Badge variant="outline" className="bg-blue-50">
            Zone: {zone}
          </Badge>
        )}
        {plant && plant !== 'all' && (
          <Badge variant="outline" className="bg-blue-50">
            Plant: {plant}
          </Badge>
        )}
      </div> */}

      <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        <DataGrid
          columnDefs={columnDefs}
          height="610px"
          pagination={true}
          paginationPageSize={pageSize}
          rowSelection="single"
          onGridReady={onGridReady}
          rowModelType="infinite"
          datasource={dataSource}
          cacheBlockSize={pageSize}
          infiniteInitialRowCount={1}
          defaultColDef={{
            flex: 1,
            minWidth: 100,
            maxWidth: 300,
            resizable: true,
            sortable: true,
            filter: false,
            suppressMenu: true,
          }}
        />
      </div>

      <AlertHistoryDialogV2
        isOpen={historyDialogState.isOpen}
        onClose={() => setHistoryDialogState({ isOpen: false, alertId: null })}
        alertId={historyDialogState.alertId}
        onSubmitSuccess={(message?: string) => {
          if (gridApi.current) {
            gridApi.current.refreshInfiniteCache();
          }
          if (message) {
            toast.success(message);
          }
          setHistoryDialogState({ isOpen: false, alertId: null });
        } } onRequestDocumentUpload={undefined}      />
    </div>
  );
};

export default SafetyProcessGantryTable;