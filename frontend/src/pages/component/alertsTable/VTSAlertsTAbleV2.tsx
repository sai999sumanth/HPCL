import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '../../../@/components/ui/button';
import { Input } from '../../../@/components/ui/input';
import {
  RefreshCw,
  Filter,
  MoreVertical,
  Loader,
  Triangle,
  Download,
  Plus,
  Minimize2
} from 'lucide-react';
import DataGrid from '../../../components/common/DataGrid';
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AlertHistoryDialogV2 from './AlertHistoryDialogV2';
import { apiClient } from '@/services/apiClient';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import dayjs from 'dayjs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../@/components/ui/dropdown-menu';
import TicketDialogModal from '../Ticketing2/components/TicketDialogModal';
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from '@/hooks/useAgGridMirrorScrollbar';
import useAuthStore from '@/store/authStore';

/** Roles that can create tickets from VTS alerts. */
const CREATE_TICKET_ROLES = ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"];

interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string) => void;
  hiddenColumns?: string[]; // Add this new prop
  fieldsFor?: string;
  onRefresh?: () => void;
  hideDocumentTable?: boolean;
  isOpenAlertsTab?: boolean;
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
let removeSapId = false;

export const VTSAlertsTableV2: React.FC<ROAlertsTableV2Props> = ({ query, onLocationChange, hiddenColumns = [], fieldsFor, onRefresh, hideDocumentTable = false, isOpenAlertsTab = false }) => {
  const [pageSize] = useState<number>(20);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedSapId, setSelectedSapId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  // let [removeSapId, setRemoveSapId] = useState<Boolean>(false);
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [isTicketFormMinimized, setIsTicketFormMinimized] = useState(false);
  const [ticketInitialData, setTicketInitialData] = useState<any>(null);
  const [selectedAlerts, setSelectedAlerts] = useState<any[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const { user } = useAuthStore();
  const canCreateTicket = useMemo(
    () =>
      Array.isArray(user?.novex_role) &&
      user.novex_role.some((r) => CREATE_TICKET_ROLES.includes(String(r).trim())),
    [user?.novex_role]
  );

  // Show TT Type column only when alert_section='VTS' AND bu='TAS' (VTS ITDG alert home)
  const isVTSWithTAS = typeof query === 'string' && query.includes("alert_section='VTS'") && query.includes("bu='TAS'");

  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'unique_id', 'sap_id', 'vehicle_number', 'location_name', 'severity', 'interlock_name',
    'created_at', 'device_name', 'assigned_user_roles', 'last_escalated_to',
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
    isOpenAlertsTab,
  ]);
  const handleDocumentUploadRequest = useCallback(() => {
    toast.info("Upload action requested for this alert. Please proceed via the action workflow.");
  }, []);

  // Download function
  const downloadExcel = useCallback(async () => {
    setIsDownloading(true);
    try {
      const params: any = {
        q: query,
        skip: 0,
        limit: 10000,
        sort: JSON.stringify({ "created_at": "desc" })
      };

      if (debouncedSearchText.trim()) params.search_text = debouncedSearchText;
      // Request load_type in response when VTS+TAS so Excel has TT Type
      if (isVTSWithTAS) {
        params.fields = JSON.stringify(fields);
      }

      const response = await apiClient.get('/api/alerts', { params });
      const data = response.data.data;

      const excelData = data.map(item => {
       const formatDate =(dateStr?: string) => {
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
               } catch {
                 return '';
               }
             };
        //  dateStr => {
        //   if (!dateStr) return '';
        //   try {
        //     return dayjs(dateStr).format('MMM D, YYYY, hh:mm A');
        //   } catch {
        //     return dateStr;
        //   }
        // };
        const getActionType = () => {
          if (!item.alert_history || !Array.isArray(item.alert_history)) {
            return '';
          }

          // Find only AcceptClose
          const relevantAction = item.alert_history
            .filter((history: any) => history.action_type === 'AcceptClose')
            .pop();

          if (!relevantAction) return '';

          return 'Accept & Block';
        };

        return {
          'Alert ID': item.unique_id || '',
          'Location ID': item.sap_id || '',
          'Location Name': item.location_name || '',
          'Region': item.region || '',
          'Zone': item.zone || '',
          'TT Number': item.vehicle_number || '',
          ...(isVTSWithTAS ? { 'TT Type': item.load_type || '' } : {}),
          'Alert Status': item.alert_status || '',
          'Alert': item.equipment_name || item.interlock_name || '',
          'Severity': item.severity || '',
          'Assigned to': Array.isArray(item.assigned_user_roles) && item.assigned_user_roles.length === 0
            ? '' : (item.assigned_user_roles || []).join(', '),
          'Escalated to': Array.isArray(item.last_escalated_to) && item.last_escalated_to.length === 0
            ? '' : (item.last_escalated_to || []).join(', '),
          'Created At': formatDate(item.created_at),
          // 'Vehicle Blocked End Date': formatDate(item.vehicle_blocked_end_date),
        
          'Vehicle Unblocked Date': formatDate(item.vehicle_unblocked_date),
          'Action Type': getActionType()
        };
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(key.length, ...excelData.map(row => String(row[key] || '').length))
      }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerts');

      // Extract bu (business unit) from query to determine file prefix
      let filePrefix = 'SOD_Alerts'; // Default

      // Check if query contains bu='LPG'
      if (typeof query === 'string' && query.includes("bu='LPG'")) {
        filePrefix = 'LPG_Alerts';
      }

      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `${filePrefix}_${timestamp}.xlsx`;

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

  const handleCreateTicket = useCallback((alertData?: any, selectedRows?: any[]) => {
    if (fieldsFor === "VTS" && !canCreateTicket) {
      toast.error("You are not allowed to create tickets.");
      return;
    }
    console.log('handleCreateTicket called:', { alertData, selectedRows, selectedAlerts: selectedAlerts.length });
    // If no alertData provided, use selected rows from parameter or state
    const alertsToUse = alertData ? [alertData] : (selectedRows || selectedAlerts);

    if (alertsToUse.length === 0) {
      toast.error('Please select at least one alert to create a ticket');
      return;
    }

    // Check if multiple alerts are selected
    const isMultipleAlerts = alertsToUse.length > 1;

    // Use the first alert for basic ticket data, all alerts for linked alerts
    const firstAlert = alertsToUse[0];


    // Transform alert data into ticket initial data
    const initialTicketData = {
      // For multiple alerts, don't pre-fill zone/location - let user choose
      // But for single alert (even in multi-select mode), always pre-fill all fields
      zone: isMultipleAlerts ? '' : (firstAlert.zone || ''),
      location_name: isMultipleAlerts ? '' : (firstAlert.location_name || ''),
      location_id: isMultipleAlerts ? '' : (firstAlert.sap_id || ''),
      alert_id: isMultipleAlerts ? '' : (firstAlert.unique_id || ''),
      interlock_name: isMultipleAlerts ? '' : (firstAlert.interlock_name || ''),
      alert_type: isMultipleAlerts
        ? [...new Set(alertsToUse.map(alert => alert.interlock_name || alert.alert_type).filter(Boolean))]
        : (firstAlert.interlock_name || firstAlert.alert_type || ''),
      alert_section: 'VTS',
      ticket_section: 'VTS',
      sap_id: isMultipleAlerts ? '' : (firstAlert.sap_id || ''),
      severity: isMultipleAlerts ? 'Medium' : (firstAlert.severity || 'Medium'),
      region: isMultipleAlerts ? '' : (firstAlert.region || ''),
      bu: isMultipleAlerts ? '' : (firstAlert.bu || ''),
      // Set up linked alerts for all selected alerts
      linked_alert_id: alertsToUse.map(alert => alert.id).filter(id => id),
      // Leave summary and description empty for user to fill
      summary: '',
      description: '',
    };

    console.log("Setting ticketInitialData:", initialTicketData);
    setTicketInitialData(initialTicketData);
    setIsCreateTicketDialogOpen(true);
    setIsTicketFormMinimized(false);
  }, [selectedAlerts, fieldsFor, canCreateTicket]);

  const handleMinimize = useCallback(() => {
    setIsTicketFormMinimized(true);
  }, []);

  const handleRestore = useCallback(() => {
    setIsTicketFormMinimized(false);
  }, []);

  const handleTicketDialogClose = useCallback(() => {
    setIsCreateTicketDialogOpen(false);
    setIsTicketFormMinimized(false);
    setTicketInitialData(null);
    // Exit multi-select mode and clear selections when dialog closes
    setIsMultiSelectMode(false);
    setSelectedAlerts([]);
    if (gridApi.current) {
      gridApi.current.deselectAll();
    }
  }, []);
  const fields = useMemo(() => [
    'unique_id', 'sap_id', 'vehicle_number', 'location_name', 'severity', 'interlock_name',
    'created_at', 'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'equipment_name','external_timestamp','vehicle_blocked_end_date','vehicle_unblocked_date',
    ...(isVTSWithTAS ? ['load_type'] : [])
  ], [isVTSWithTAS]);
  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {
    setIsLoading(true);
    const updatedQuery = query
      .replace(/AND\s+sap_id\s*=\s*'[^']*'\s*/i, '')  // removes "AND sap_id='...'"
      .replace(/sap_id\s*=\s*'[^']*'\s*AND\s*/i, '')  // handles case where it's at the start
      .replace(/sap_id\s*=\s*'[^']*'\s*/i, '');       // handles edge cases
    const finalQuery = updatedQuery.trim().replace(/\s+AND\s+$/, '');

    try {
      // Calculate the current page based on startRow and pageSize
      const currentPageNumber = Math.floor(startRow / pageSize);

      const params: any = {
        q: removeSapId ? finalQuery : query,
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
    if (onLocationChange) {
      onLocationChange('');
    }
    removeSapId = true;
    // setRemoveSapId(true);
    setTimeout(() => {
      setSearchText('');
    }, 500)

    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page on refresh
    }
  }, []);
  // const handleRefresh = useCallback(() => {
  //   setSearchText('');   
  //   // setSelectedSapId(null);
  //   // setSelectedZone(null);

  //   if (onLocationChange) {
  //     onLocationChange('');
  //   }

  //   if (gridApi.current) {
  //     gridApi.current.refreshInfiniteCache();
  //     setCurrentPage(0); // Reset to first page on refresh
  //   }
  // }, [onLocationChange]);

  // const handleLocationView = (sapId: string) => {
  //   navigate(`/location/${sapId}`);
  // };
  const handleLocationClick = useCallback((sapId: string) => {
    setSelectedSapId(sapId);
    // setSelectedZone(zone || null);
    localStorage.setItem('sapId', sapId);
    // setRemoveSapId(false);
    removeSapId = false;
    // localStorage.setItem('zone', zone);
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
    // Add checkbox column when in multi-select mode
    ...(isOpenAlertsTab && fieldsFor === "VTS" && isMultiSelectMode ? [{
      headerName: '',
      field: 'checkbox',
      width: 50,
      minWidth: 50,
      maxWidth: 50,
      checkboxSelection: true,
      pinned: 'left',
      suppressMenu: true,
      sortable: false,
      filter: false,
      resizable: false
    }] : []),
    {
      headerName: 'Location ID',
      field: 'sap_id',
      sortable: true,
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
      hide: !isVTSWithTAS || !selectedColumns.includes('load_type') || hiddenColumns.includes('load_type')
    },
    {
      headerName: 'ITDG Alert',
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
      headerName: 'ITDG Alert ID',
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
    {
      headerName: 'Assigned to',
      field: 'assigned_user_roles',
      sortable: true,
      cellRenderer: (params: any) => {
        return Array.isArray(params.value) && params.value.length === 0 ? '' : params.value;
      },
      filter: true,
      hide: !selectedColumns.includes('assigned_user_roles')
      // hide: !selectedColumns.includes('last_escalated_to') || hiddenColumns.includes('assigned_user_roles')
    },
    {
      headerName: 'Esclated to',
      field: 'last_escalated_to',
      sortable: true,
      cellRenderer: (params: any) => {
        return Array.isArray(params.value) && params.value.length === 0 ? '' : params.value;
      },
      filter: true,
      hide: !selectedColumns.includes('last_escalated_to') || hiddenColumns.includes('last_escalated_to')
    },
    {
      headerName: 'Equipement Type',
      field: 'device_type',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('device_type')
    },
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
  ], [selectedColumns, handleViewHistory, hiddenColumns, handleLocationClick, isMultiSelectMode, isOpenAlertsTab, fieldsFor, isVTSWithTAS]);

  return (
    <div className="w-full">
      {/* Existing JSX remains the same */}
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

        {isOpenAlertsTab && fieldsFor === "VTS" && canCreateTicket && (
          <div className="flex gap-2">
            {!isMultiSelectMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsMultiSelectMode(true);
                  setSelectedAlerts([]);
                  // Clear any existing selections
                  if (gridApi.current) {
                    gridApi.current.deselectAll();
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Ticket
              </Button>
            ) : (
              <>
                <Button
                  variant={selectedAlerts.length > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    // Use the selectedAlerts state instead of getting rows directly from grid API
                    // This ensures consistency with the displayed count
                    console.log('Button clicked with selectedAlerts:', selectedAlerts.length);

                    if (selectedAlerts.length === 0) {
                      console.log('No alerts selected, showing error');
                      toast.error('Please select at least one alert to create a ticket');
                      return;
                    }

                    handleCreateTicket(undefined, selectedAlerts);
                  }}
                  disabled={false}
                  className={selectedAlerts.length > 0 ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Ticket ({selectedAlerts.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setSelectedAlerts([]);
                    if (gridApi.current) {
                      gridApi.current.deselectAll();
                    }
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}

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
          rowSelection={isOpenAlertsTab && fieldsFor === "VTS" && isMultiSelectMode ? "multiple" : "single"}
          onSelectionChanged={(params: any) => {
            console.log('onSelectionChanged triggered:', {
              fieldsFor,
              isMultiSelectMode,
              condition: isOpenAlertsTab && fieldsFor === "VTS" && isMultiSelectMode
            });
            if (isOpenAlertsTab && fieldsFor === "VTS" && isMultiSelectMode) {
              const selectedRows = gridApi.current?.getSelectedRows() || [];
              console.log('Setting selectedAlerts:', selectedRows.length, 'rows');
              setSelectedAlerts(selectedRows);
            }
          }}
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

      <AlertHistoryDialogV2
        isOpen={historyDialogState.isOpen}
        onClose={() => setHistoryDialogState({ isOpen: false, alertId: null })}
        alertId={historyDialogState.alertId}
        onRequestDocumentUpload={handleDocumentUploadRequest}
        hideDocumentTable={hideDocumentTable}
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

      {/* Create Ticket Dialog */}
      <TicketDialogModal
        isOpen={isCreateTicketDialogOpen}
        isMinimized={isTicketFormMinimized}
        initialData={ticketInitialData}
        onClose={handleTicketDialogClose}
        onMinimize={handleMinimize}
        onRestore={handleRestore}
        onSubmitSuccess={undefined}
      />
    </div>
  );
};

export default VTSAlertsTableV2;