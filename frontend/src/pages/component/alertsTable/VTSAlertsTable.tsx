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
import { AlertHistoryDialog } from './AlertHistoryDialog';
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '@/services/apiClient';
import * as XLSX from 'xlsx';
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from '@/hooks/useAgGridMirrorScrollbar';
import clsx from 'clsx';
import dayjs from 'dayjs';

interface ROAlertsTableProps { 
  query?: string;
  onLocationChange?: (locationId: string) => void;
    fieldsFor?: string;
  onRefresh?: () => void;
  hideDocumentTable?: boolean;
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

export const VTSAlertsTable: React.FC<ROAlertsTableProps> = ({ query, onLocationChange, hideDocumentTable = false }) => { 
  const [pageSize] = useState<number>(20);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const isVTSWithTAS = typeof query === 'string' && query.includes("alert_section='VTS'") && query.includes("bu='TAS'");

  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'unique_id', 'sap_id', 'vehicle_number', 'location_name', 'severity', 'interlock_name', 
    'created_at',  'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'load_type', 'actions'
  ]);
  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null
  });
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const gridApi = React.useRef<any>(null);
  const { tableWrapRef, retryMirrorScrollbar } = useAgGridMirrorScrollbar([
    isLoading,
    query,
    selectedColumns,
  ]);
  const handleDocumentUploadRequest = useCallback(() => {
    toast.info("Upload action requested for this alert. Please proceed via the action workflow.");
  }, []);

  // Download function
  const downloadExcel = useCallback(async () => {
    setIsDownloading(true);
    try {
      // Fetch all data for export (you might need to adjust this based on your API)
      const params: any = {
        q: query,
        skip: 0,
        limit: 10000, // Large number to get all data
        sort: JSON.stringify({ "created_at": "desc" })
      };

      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }
      // Request load_type in response when VTS+TAS so Excel has TT Type
      if (isVTSWithTAS) {
        params.fields = JSON.stringify(fields);
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

        return {
          'Alert ID': item.unique_id || '',
          'Location ID': item.sap_id || '',
          'Location Name': item.location_name || '',
          'Region': item.region || '',
          'Zone': item.zone || '',
          'TT Number':item.vehicle_number||'',
          ...(isVTSWithTAS ? { 'TT Type': item.load_type || '' } : {}),
          'Alert Status':item.alert_status||'',
          'Alert': item.equipment_name || item.interlock_name || '',
          'Severity': item.severity || '',
          // 'Equipment Type': item.device_type || '',
          // 'Equipment ID': item.device_name ? item.device_name.split('@')[0] : '',
          'Assigned to': Array.isArray(item.assigned_user_roles) && item.assigned_user_roles.length === 0 
            ? '' : (item.assigned_user_roles || []).join(', '),
          'Escalated to': Array.isArray(item.last_escalated_to) && item.last_escalated_to.length === 0 
            ? '' : (item.last_escalated_to || []).join(', '),
          'Created At': formatDate(item.external_timestamp),
          // 'Novex Created At': formatDate(item.created_at),
          // 'Alert History': JSON.stringify(alertHistory, null, 2)
        };
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
  }, [query, debouncedSearchText, isVTSWithTAS]);
  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);
  const fields = useMemo(() => [
    'unique_id', 'sap_id', 'vehicle_number', 'location_name', 'severity', 'interlock_name', 
    'created_at',  'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'equipment_name',
    ...(isVTSWithTAS ? ['load_type'] : [])
  ], [isVTSWithTAS]);

  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {
    setIsLoading(true);
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
        : JSON.stringify({"created_at": "desc"})      };
      
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
      setIsLoading(false);
    }
  }, [query, debouncedSearchText, pageSize, fields]);

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
  const handleRefresh = useCallback(() => {
    setSearchText('');   
    // setSelectedSapId(null);
    // setSelectedZone(null);
    
    if (onLocationChange) {
      onLocationChange('');
    }
    
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page on refresh
    }
  }, []);

  // const handleLocationView = (sapId: string) => {
  //   navigate(`/location/${sapId}`);
  // };
  const handleLocationClick = useCallback((sapId: string) => {
    if (onLocationChange) {
      onLocationChange(sapId);
    } else {
      navigate(`/location/${sapId}`);
    }
  }, [onLocationChange, navigate]);

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
      hide: !selectedColumns.includes('vehicle_number')
    },
    {
      headerName: 'TT Type',
      field: 'load_type',
      sortable: true,
      filter: true,
      minWidth: 120,
      maxWidth: 200,
      hide: !isVTSWithTAS || !selectedColumns.includes('load_type')
    },
    { 
      headerName: 'Violation Name', 
      field: 'interlock_name',
      sortable: true,
      filter: true,
      valueGetter: (params: any) => {
        // For VTS section, use equipment_name, otherwise use interlock_name
        return params.data?.equipment_name || params.data?.interlock_name || '';
      },
      hide: !selectedColumns.includes('interlock_name')
    },
    { 
      headerName: 'Violation ID', 
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
      field: 'created_at',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        
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
      hide: !selectedColumns.includes('created_at'),
      minWidth: 150, // Ensure enough width for both lines
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
      headerName: 'Instance ID', 
      field: 'device_name',
      sortable: false,
      filter: false,
      hide: !selectedColumns.includes('device_name'),
      valueFormatter: (params) => params.value?.split('@')[0] || ''
    },
    // { 
    //   headerName: 'Equipement Type',
    //   field: 'device_type',
    //   sortable: true,
    //   filter: true,
    //   hide: !selectedColumns.includes('device_type')
    // },
    // { 
    //   headerName: 'Status', 
    //   field: 'alert_status',
    //   sortable: true,
    //   filter: true,
    //   cellRenderer: (params: any) => ( 
    //     <Badge 
    //       variant="outline" 
    //       className={
    //         params.value === 'Active' ? 'bg-green-50 text-green-700 border-green-200' :
    //         params.value === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
    //         'bg-gray-50 text-gray-700 border-gray-200'
    //       }
    //     >
    //       {params.value}
    //     </Badge>
    //   ),
    //   hide: !selectedColumns.includes('alert_status')
    // },
    // { 
    //   headerName: 'State', 
    //   field: 'indent_status',
    //   sortable: true,
    //   filter: true,
    //   hide: !selectedColumns.includes('indent_status')
    // },
   
    // { 
    //   headerName: 'Person In Charge', 
    //   field: 'assigned_to_role',
    //   sortable: true,
    //   filter: true,
    //   hide: !selectedColumns.includes('assigned_to_role')
    // },
    // { 
    //   headerName: 'Esclated to', 
    //   field: 'last_escalated_to',
    //   sortable: true,
    //   cellRenderer: (params: any) => {
    //     return Array.isArray(params.value) && params.value.length === 0 ? ',' : params.value;
    //   },
    //   filter: true,
    //   hide: !selectedColumns.includes('last_escalated_to')
    // },
    // { 
    //   headerName: 'Notified to', 
    //   field: 'last_notified_to',
    //   sortable: true,
    //   filter: true,
    //   cellRenderer: (params: any) => {
    //     return Array.isArray(params.value) && params.value.length === 0 ? ',' : params.value;
    //   },
    //   hide: !selectedColumns.includes('last_notified_to')
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
  ], [selectedColumns, handleViewHistory, handleLocationClick, isVTSWithTAS]);

  return (
    <div className="w-full">
      {/* Existing JSX remains the same */}
      <div className="flex justify-between items-center mb-2 space-x-2">
        <div className="flex-grow">
          <Input 
            placeholder="Search Violations..." 
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
                    })} />          Refresh
        </Button>
      </div>

      <div ref={tableWrapRef} className="ag-grid-mirror-h-scroll-wrap relative [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        <style>{AG_GRID_MIRROR_SCROLL_CSS}</style>
        <DataGrid
          loading={isLoading}
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
            suppressMenu: true           
          }}
        />
      </div>

      <AlertHistoryDialog
        isOpen={historyDialogState.isOpen}
        onClose={() => setHistoryDialogState({ isOpen: false, alertId: null })}
        alertId={historyDialogState.alertId}
        hideDocumentTable={hideDocumentTable}
        onRequestDocumentUpload={handleDocumentUploadRequest}
        onSubmitSuccess={(message?: string) => {
          if (gridApi.current) {
            gridApi.current.refreshInfiniteCache();
          }
          if (message) {
            toast.success(message);
          }
          setHistoryDialogState({ isOpen: false, alertId: null });
        }}
      />
    </div>
  );
};

export default VTSAlertsTable;