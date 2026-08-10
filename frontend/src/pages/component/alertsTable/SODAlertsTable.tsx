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
import { AlertHistoryDialog } from './AlertHistoryDialog';
import axios from 'axios';
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { useNavigate } from 'react-router-dom';
import { maxWidth } from '@mui/system';
import { toast } from 'sonner';
import { apiClient } from '@/services/apiClient';
import { useInFlightLoading } from '@/hooks/useInFlightLoading';
import dayjs from 'dayjs';
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";
import clsx from "clsx";
import * as XLSX from 'xlsx';
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from '@/hooks/useAgGridMirrorScrollbar';

interface ROAlertsTableProps {
  query?: string;
  onLocationChange?: (locationId: string) => void;
  alertSection?: string | null;
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

export const SODAlertsTable: React.FC<ROAlertsTableProps> = ({ query, onLocationChange, alertSection }) => {
  const [pageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name',
    'created_at', 'device_type', 'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'actions', 'zone', 'external_timestamp', 'vehicle_number', 'load_type', 'alert_section', 'equipment_name'
  ]);
  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();
  const { isLoading, begin: beginLoad, end: endLoad } = useInFlightLoading();
  const gridApi = React.useRef<any>(null);
  const { tableWrapRef, retryMirrorScrollbar } = useAgGridMirrorScrollbar([
    isLoading,
    query,
    alertSection,
    selectedColumns,
  ]);
const isVTSSection = alertSection === 'VTS';
  // Download function
  const downloadExcel = useCallback(async () => {
    setIsDownloading(true);
    try {
      // Fetch all data for export
      const params: any = {
        q: query,
        skip: 0,
        limit: 10000, // Large number to get all data
        fields: JSON.stringify(fields),
        sort: JSON.stringify({ "created_at": "desc" })
      };

      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }

      const response = await apiClient.get('/api/alerts', { params });
      const data = response.data.data;

      // Prepare data for Excel export
      const excelData = data.map((item: any) => {
        // Format alert history
        const alertHistory = item.alert_history?.map((history: any) => ({
          action_type: history.action_type || '',
          action_msg: history.action_msg || '',
          processed_time: history.processed_time || '',
          duration: history.duration || ''
        })) || [];

        // Format dates
        const formatDate = (dateStr: string) => {
          if (!dateStr) return '';
          try {
            return dayjs(dateStr).format('MMM D, YYYY, hh:mm A');
          } catch {
            return dateStr;
          }
        };
  // Format Novex Created At - same logic as ag-grid cell renderer
      const formatNovexCreatedAt = (dateStr: string) => {
        if (!dateStr) return '';
        try {
          const utcDate = new Date(dateStr);
          const localDate = convertUTCDateToLocalDate(utcDate);
          
          return localDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        } catch (error) {
          return 'Invalid date';
        }
      };

        // Base data structure
        const baseData: any = {
          'Alert ID': item.unique_id || '',
          'Location ID': item.sap_id || '',
          'Location Name': item.location_name || '',
          'Region': item.region || '',
          'Zone': item.zone || '',
          'Alert': isVTSSection ? (item.equipment_name || item.interlock_name || '') : (item.interlock_name || ''),
          'Severity': item.severity || '',
          'Equipment Type': item.device_type || '',
          // 'Equipment ID': item.device_name ? item.device_name.split('@')[0] : '',
              [isVTSSection ? 'Instance ID' : 'Equipment ID']: item.device_name ? item.device_name.split('@')[0] : '',
          'Assigned to': Array.isArray(item.assigned_user_roles) && item.assigned_user_roles.length === 0
            ? '' : (item.assigned_user_roles || []).join(', '),
          'Escalated to': Array.isArray(item.last_escalated_to) && item.last_escalated_to.length === 0
            ? '' : (item.last_escalated_to || []).join(', '),
          'Created At': formatDate(item.external_timestamp),
          'Novex Created At': formatNovexCreatedAt(item.created_at), // Updated to use UTC to local conversion
          // 'Alert History': JSON.stringify(alertHistory, null, 2)
        };

        // Add vehicle number and load type for VTS sections
        if (isVTSSection) {
          baseData['TT Number'] = item.vehicle_number || '';
          baseData['TT Type'] = item.load_type || '';
        }
          return baseData; // <-- MISSING
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(
          key.length,
          ...excelData.map(row => String(row[key] || '').length)
        )
      }));
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerts');

      // Generate filename with timestamp
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `SOD_Alerts_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);
      
      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    } finally {
      setIsDownloading(false);
    }
  }, [query, debouncedSearchText]);

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);

  const fields = [
    'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name',
    'created_at','external_timestamp', 'device_type', 'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'zone', 'vehicle_number', 'load_type', 'alert_section', 'equipment_name'
  ];

  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {
    beginLoad();
    try {
      // Calculate the current page based on startRow and pageSize
      const currentPageNumber = Math.floor(startRow / pageSize);

      const params: any = {
        q: query,
        skip: currentPageNumber, // Using sequential page numbers (0, 1, 2, 3...)
        limit: pageSize,
        fields: JSON.stringify(fields),
        sort: sortModel?.length
          ? JSON.stringify({ [sortModel[0].colId]: sortModel[0].sort })
          : JSON.stringify({ "created_at": "desc" })
      };

      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }

      const response = await apiClient.get('/api/alerts', { params });

      setCurrentPage(currentPageNumber);

      return {
        data: response.data.data,
        lastRow: response.data.total
      };
    } catch (err) {
      console.error('Error fetching alerts:', err);
      throw err;
    } finally {
      endLoad();
    }
  }, [query, debouncedSearchText, pageSize, beginLoad, endLoad]);

  const dataSource = useMemo(() => ({
    getRows: async (params: any) => {
      try {
        const result = await fetchData(params.startRow, params.endRow, params.sortModel);
        params.successCallback(result.data, result.lastRow);
      } catch (err) {
        params.failCallback();
      }
    }
  }), [fetchData]);

  useEffect(() => {
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page when search changes
    }
  }, [debouncedSearchText]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
    retryMirrorScrollbar();
  }, [retryMirrorScrollbar]);

  // First, add a state variable to track the selected sapId
  const [selectedSapId, setSelectedSapId] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  // Then, modify your handleLocationClick to update this state
  const handleLocationClick = useCallback((sapId: string) => {
    setSelectedSapId(sapId); // Track the selected sapId

    if (onLocationChange) {
      onLocationChange(sapId);
    } else {
      navigate(`/location/${sapId}`);
    }
  }, [onLocationChange, navigate]);

  // Finally, update handleRefresh to clear the selected sapId but NOT affect global location filter
  const handleRefresh = useCallback(() => {
    setRotating(true);
    // Clear the search text
    setSearchText('');

    // Clear the selected sapId (local to this component)
    setSelectedSapId(null);

    // NOTE: We don't call onLocationChange here because table refresh should only refresh the table,
    // not affect the global location filter that impacts other dashboard components

    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page on refresh
    }
    setTimeout(() => {
      setRotating(false);
    }, 1000);
  }, []);

  // Cell Renderer Components
  const SeverityIndicator = useCallback(({ severity }) => {
    const colorMap = {
      'Critical': 'text-red-600',
      'High': 'text-orange-600',
      'Medium': 'text-yellow-600',
      'Low': 'text-green-600'
    };

    return (
      <div className={`flex items-center mt-3 space-x-1 ${colorMap[severity] || 'text-gray-600'} text-xs`}>
        <Triangle className="h-3 w-3" />
        <span>{severity}</span>
      </div>
    );
  }, []);

  // Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: 'Location ID',
      field: 'sap_id',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => handleLocationClick(params.value)}
        >
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('sap_id')
    },
    {
      headerName: 'Location Name',
      field: 'location_name',
      sortable: true,
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
      headerName: 'Vehicle Number',
      field: 'vehicle_number',
      sortable: true,
      filter: true,
      minWidth: 150,
      maxWidth: 300,
      // Hide if not VTS section OR if explicitly hidden
      hide: !isVTSSection || !selectedColumns.includes('vehicle_number')
    },
    {
      headerName: 'TT Type',
      field: 'load_type',
      sortable: true,
      filter: true,
      minWidth: 120,
      maxWidth: 200,
      hide: alertSection !== 'VTS' || !selectedColumns.includes('load_type')
    },
    {
      headerName: 'Alert',
      field: 'interlock_name',
      sortable: true,
      filter: true,
      valueGetter: (params: any) => {
        // For VTS section, use equipment_name, otherwise use interlock_name
        if (alertSection === 'VTS') {
          return params.data?.equipment_name || params.data?.interlock_name || '';
        }
        return params.data?.interlock_name || '';
      },
      hide: !selectedColumns.includes('interlock_name')
    },
    {
      headerName: 'Alert ID',
      field: 'unique_id',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => handleViewHistory(params.data.id)}>
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('unique_id')
    },
    {
      headerName: 'Created At',
      field: 'external_timestamp',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        dayjs.extend(relativeTime);
        dayjs.extend(advancedFormat);
        const relative = dayjs(params.value).fromNow();
        const formatted = dayjs(params.value).format("MMM D, YYYY, hh:mm A");
        return (
          <div className="flex flex-col">
            <span className="text-sm text-gray-900">{relative}</span>
            <span className="text-xs text-gray-500">{formatted}</span>
          </div>
        )
      },
      hide: !selectedColumns.includes('external_timestamp'),
      minWidth: 150
    },
    {
      headerName: 'Severity',
      field: 'severity',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <SeverityIndicator severity={params.value} />
      ),
      hide: !selectedColumns.includes('severity')
    },
    {
     headerName:  isVTSSection ? 'Instance ID' : 'Equipment ID',
      field: 'device_name',
      sortable: false,
      filter: false,
      hide: !selectedColumns.includes('device_name'),
      valueFormatter: (params) => params.value?.split('@')[0] || ''
    },
    {
      headerName: 'Equipement Type',
      field: 'device_type',
      sortable: true,
      filter: true,
      hide: isVTSSection || !selectedColumns.includes('device_type')
    },
 
    // {
    //   headerName: 'Novex Created At',
    //   field: 'created_at',
    //   sortable: true,
    //   filter: true,

    //   cellRenderer: (params: any) => {
    //     if (!params.value) return '';

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
    //   hide: !selectedColumns.includes('created_at'),
    //   minWidth: 150, // Ensure enough width for both lines
    // },

    // Other column definitions remain the same
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
  ], [selectedColumns, handleViewHistory, alertSection, isVTSSection]);

  return (
    <div className="w-full">
      {/* Updated header with download button */}
      <div className="flex justify-between items-center mb-2 space-x-2">
        <div className="flex-grow">
          <Input
            placeholder="Search alerts..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-8"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={downloadExcel}
          disabled={isDownloading}
        >
          <Download className={clsx("mr-2 h-4 w-4", { "animate-spin": isDownloading })} />
          {isDownloading ? 'Downloading...' : 'Download'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw
            className={clsx("mr-2 h-4 w-4 transition-transform", {
              "animate-spin": rotating,
            })}
          />
          Refresh
        </Button>
      </div>

      <div ref={tableWrapRef} className="ag-grid-mirror-h-scroll-wrap relative [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        <style>{AG_GRID_MIRROR_SCROLL_CSS}</style>
        <DataGrid
          key={`alerts-${query ?? ''}`}
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
          loading={isLoading}
          defaultColDef={{
            flex: 1,
            minWidth: 100,
            maxWidth: 300,
            resizable: true,
            sortable: true,
            filter: false,
            suppressMenu: true
          }}
        />
      </div>

      <AlertHistoryDialog
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

export default SODAlertsTable;