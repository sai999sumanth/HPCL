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
import dayjs from 'dayjs';
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { apiClient } from '@/services/apiClient';
import clsx from "clsx";
import * as XLSX from 'xlsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../@/components/ui/dropdown-menu';

import TicketDialogModal from '../Ticketing2/components/TicketDialogModal';

interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string, zone?: string) => void;
  hiddenColumns?: string[];
  alertSection?: string | null;
  fieldsFor?: string;
  onRefresh?: () => void;
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

export const SODAlertsTableV2: React.FC<ROAlertsTableV2Props> = ({
  query,
  onLocationChange,
  hiddenColumns = [],
  alertSection,
  fieldsFor,
  onRefresh,
    isOpenAlertsTab = false
}) => {
  console.log('SODAlertsTableV2 props:', { alertSection, fieldsFor, isOpenAlertsTab });
  const [pageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);

  const isVTSSection = alertSection === 'VTS' || alertSection === 'EMLock';
  const shouldShowNovexCreated = alertSection === 'EMLock' || alertSection === 'TAS' || alertSection === 'VA' || alertSection === 'LPG';
  const isVTSInstanceId = alertSection === 'VTS';

  const getDefaultColumns = () => {
    const baseColumns = [
      'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name',
      'created_at', 'device_type', 'device_name', 'assigned_user_roles', 'zone',
      'last_notified_to', 'actions'
    ];

    if (isVTSSection) {
      const locationIndex = baseColumns.indexOf('location_name');
      baseColumns.splice(locationIndex + 1, 0, 'vehicle_number');

      // Add escalated_to after assigned_user_roles for VTS but not in open alerts tab
      if (!isOpenAlertsTab) {
        const assignedIndex = baseColumns.indexOf('assigned_user_roles');
        baseColumns.splice(assignedIndex + 1, 0, 'last_escalated_to');
      }
    }

    // Add novex_created_at column for EMLock, TAS, and VA sections
    if (shouldShowNovexCreated) {
      const actionsIndex = baseColumns.indexOf('actions');
      baseColumns.splice(actionsIndex, 0, 'novex_created_at');
    }

    return baseColumns;
  };

  const [selectedColumns, setSelectedColumns] = useState<string[]>(getDefaultColumns());

  // Update selected columns when alertSection or isOpenAlertsTab changes
  useEffect(() => {
    setSelectedColumns(getDefaultColumns());
  }, [alertSection, isOpenAlertsTab]);

  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const gridApi = React.useRef<any>(null);
  const [selectedSapId, setSelectedSapId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [isTicketFormMinimized, setIsTicketFormMinimized] = useState(false);
  const [ticketInitialData, setTicketInitialData] = useState<any>(null);
  const [selectedAlerts, setSelectedAlerts] = useState<any[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const downloadExcel = useCallback(async () => {
    setIsDownloading(true);
    try {
      const params: any = {
        q: query,
        skip: 0,
        limit: 10000,
        sort: JSON.stringify({ "created_at": "desc" })
      };

      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }

      const response = await apiClient.get('/api/alerts', { params });
      const data = response.data.data;

      const excelData = data.map((item: any) => {
        const alertHistory = item.alert_history?.map((history: any) => ({
          action_type: history.action_type || '',
          action_msg: history.action_msg || '',
          processed_time: history.processed_time || '',
          duration: history.duration || ''
        })) || [];

        const formatDate = (dateStr: string) => {
          if (!dateStr) return '';
          try {
            return dayjs(dateStr).format('MMM D, YYYY, hh:mm A');
          } catch {
            return dateStr;
          }
        };

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

        // Find the action_type from alert_history
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

        // For VTS sections, keep existing fields
        if (isVTSInstanceId) {
          const baseData: any = {
            'Alert ID': item.unique_id || '',
            'Location ID': item.sap_id || '',
            'Location Name': item.location_name || '',
            'Vehicle Number': item.vehicle_number || '',
            'Region': item.region || '',
            'Zone': item.zone || '',
            'Alert Status': item.alert_status || '',
            'Alert': item.interlock_name || '',
            'Severity': item.severity || '',
            'Instance ID': item.device_name ? item.device_name.split('@')[0] : '',
            'Assigned to': Array.isArray(item.assigned_user_roles) && item.assigned_user_roles.length === 0
              ? '' : (item.assigned_user_roles || []).join(', '),
            'Escalated to': Array.isArray(item.last_escalated_to) && item.last_escalated_to.length === 0
              ? '' : (item.last_escalated_to || []).join(', '),
            'Created At': formatDate(item.external_timestamp),
            'Vehicle Blocked End Date': formatDate(item.vehicle_blocked_end_date),
            'Vehicle Unblocked Date': formatDate(item.vehicle_unblocked_date),
            'Action Type': getActionType()
          };
          return baseData;
        }

        // For non-VTS sections, use standard fields
        return {
          'Alert ID': item.unique_id || '',
          'Location ID': item.sap_id || '',
          'Location Name': item.location_name || '',
          'Region': item.region || '',
          'Zone': item.zone || '',
          'Alert': item.interlock_name || '',
          'Severity': item.severity || '',
          'Equipment Type': item.device_type || '',
          'Equipment ID': item.device_name ? item.device_name.split('@')[0] : '',
          'Assigned to': Array.isArray(item.assigned_user_roles) && item.assigned_user_roles.length === 0
            ? '' : (item.assigned_user_roles || []).join(', '),
          'Escalated to': Array.isArray(item.last_escalated_to) && item.last_escalated_to.length === 0
            ? '' : (item.last_escalated_to || []).join(', '),
          'Created At': formatDate(item.external_timestamp),
          'Novex Created At': formatNovexCreatedAt(item.created_at)
        };
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(
          key.length,
          ...excelData.map(row => String(row[key] || '').length)
        )
      }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerts');

      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `SOD_Alerts_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);

      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    } finally {
      setIsDownloading(false);
    }
  }, [query, debouncedSearchText, isVTSSection]);

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);

  const fields = [
    'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name',
    'created_at', 'device_type', 'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'zone', 'external_timestamp', 'vehicle_number', 'novex_created_at'
  ];

  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {
    setIsLoading(true);
    try {
      const currentPageNumber = Math.floor(startRow / pageSize);

      let params: any = {
        q: query,
        skip: currentPageNumber,
        limit: pageSize,
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
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [query, debouncedSearchText, pageSize]);
  const handleCreateTicket = useCallback((alertData?: any, selectedRows?: any[]) => {
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

    // Collect vehicle numbers from alerts for truck_no payload (SOD terminal home / LPG home)
    const vehicleNumbers = [...new Set(
      alertsToUse
        .map((alert: any) => alert.vehicle_number || alert.truck_no || alert.truck_number || alert.vehicle_no)
        .filter(Boolean)
    )] as string[];
    const truckNo = vehicleNumbers.length > 0 ? vehicleNumbers : [];

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
      alert_section: alertSection || '',
      ticket_section: alertSection || (fieldsFor === 'SOD' ? 'SOD' : ''),
      sap_id: isMultipleAlerts ? '' : (firstAlert.sap_id || ''),
      severity: isMultipleAlerts ? 'Medium' : (firstAlert.severity || 'Medium'),
      region: isMultipleAlerts ? '' : (firstAlert.region || ''),
      bu: isMultipleAlerts ? '' : (firstAlert.bu || ''),
      // Set up linked alerts for all selected alerts
      linked_alert_id: alertsToUse.map(alert => alert.id).filter(id => id),
      // Vehicle number from alert table -> send in payload as truck_no (SOD terminal home / LPG home)
      truck_no: truckNo,
      // Leave summary and description empty for user to fill
      summary: '',
      description: '',
    };

    console.log("Setting ticketInitialData:", initialTicketData);
    setTicketInitialData(initialTicketData);
    setIsCreateTicketDialogOpen(true);
    setIsTicketFormMinimized(false);
  }, [alertSection, selectedAlerts]);

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
      setCurrentPage(0);
    }
  }, [debouncedSearchText]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const [rotating, setRotating] = useState(false);

  const handleLocationClick = useCallback((sapId: string, zone?: string) => {
    setSelectedSapId(sapId);
    setSelectedZone(zone || null);
    localStorage.setItem('sapId', sapId);
    localStorage.setItem('zone', zone);
    if (onLocationChange) {
      onLocationChange(sapId, zone);
    } else {
      navigate(`/location/${sapId}`);
    }
  }, [onLocationChange, navigate]);

  const handleRefresh = useCallback(() => {
    setRotating(true);
    setSearchText('');
    // Exit multi-select mode on refresh
    setIsMultiSelectMode(false);
    setSelectedAlerts([]);

    if (onRefresh) {
      onRefresh();
    }

    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      gridApi.current.deselectAll();
      setCurrentPage(0);
    }
    setTimeout(() => {
      setRotating(false);
    }, 1000);
  }, [onLocationChange, onRefresh]);

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

  const columnDefs = useMemo(() => {
    const columns = [
      // Add checkbox column when in multi-select mode
      ...(isOpenAlertsTab && (alertSection === 'VTS' || alertSection === 'VA' || alertSection === 'TAS' || alertSection === 'EMLock' || (alertSection === 'LPG' && fieldsFor === "LPG")) && (fieldsFor === "SOD" || fieldsFor === "LPG") && isMultiSelectMode ? [{
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
        minWidth: 100,
        maxWidth: 300,
        cellRenderer: (params: any) => (
          <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => handleLocationClick(params.value, params.data.zone)}>
            {params.value}
          </span>
        ),
        hide: !selectedColumns.includes('sap_id') || hiddenColumns.includes('sap_id')
      },
    {
      headerName: 'Location Name',
      field: 'location_name',
      sortable: true,
      filter: true,
      minWidth: 200,
      maxWidth: 300,
      cellRenderer: (params: any) => (
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => handleLocationClick(params.data.sap_id, params.data.zone)}>
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('location_name') || hiddenColumns.includes('location_name')
    },
    {
      headerName: 'Vehicle Number',
      field: 'vehicle_number',
      sortable: true,
      filter: true,
      minWidth: 150,
      maxWidth: 300,
      // Hide if not VTS section OR if explicitly hidden
      hide: !isVTSSection || !selectedColumns.includes('vehicle_number') || hiddenColumns.includes('vehicle_number')
    },
    {
      headerName: 'Alert',
      field: 'interlock_name',
      sortable: true,
      filter: true,
      minWidth: 200,
      maxWidth: 300,
      hide: !selectedColumns.includes('interlock_name') || hiddenColumns.includes('interlock_name')
    },
    {
      headerName: 'Alert ID',
      field: 'unique_id',
      sortable: true,
      filter: true,
      minWidth: 200,
      maxWidth: 300,
      cellRenderer: (params: any) => (
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => handleViewHistory(params.data.id)}>
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('unique_id') || hiddenColumns.includes('unique_id')
    },
    {
      headerName: 'Created At',
      field: 'external_timestamp',
      sortable: true,
      filter: true,
      minWidth: 150,
      maxWidth: 300,
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
      hide: !selectedColumns.includes('created_at') || hiddenColumns.includes('created_at'),
    },
    {
      headerName: 'Severity',
      field: 'severity',
      sortable: true,
      filter: true,
      minWidth: 100,
      maxWidth: 300,
      cellRenderer: (params: any) => (
        <SeverityIndicator severity={params.value} />
      ),
      hide: !selectedColumns.includes('severity') || hiddenColumns.includes('severity')
    },
    {
      headerName: isVTSInstanceId ? 'Instance ID' : 'Equipment ID',
      field: 'device_name',
      sortable: false,
      filter: false,
      minWidth: 100,
      maxWidth: 300,
      hide: !selectedColumns.includes('device_name') || hiddenColumns.includes('device_name'),
      valueFormatter: (params) => params.value?.split('@')[0] || ''
    },
    {
      headerName: 'Equipment Type',
      field: 'device_type',
      sortable: true,
      filter: true,
      minWidth: 150,
      maxWidth: 300,
       hide: isVTSSection || !selectedColumns.includes('device_type')
      // hide: !selectedColumns.includes('device_type') || hiddenColumns.includes('device_type')
    },
    {
      headerName: 'Novex Created At',
      field: 'novex_created_at',
      sortable: true,
      filter: true,
      minWidth: 150,
      maxWidth: 300,
      cellRenderer: (params: any) => {
        if (!params.data?.created_at) return '';

        try {
          const utcDate = new Date(params.data.created_at);
          const localDate = convertUTCDateToLocalDate(utcDate);

          const formattedDateTime = localDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          const relativeTime = formatRelativeTime(params.data.created_at);

          return (
            <div className="flex flex-col">
              <span className="text-sm text-gray-900">{relativeTime}</span>
              <span className="text-xs text-gray-500">{formattedDateTime}</span>
            </div>
          );
        } catch (error) {
          return 'Invalid date';
        }
      },
      hide: !shouldShowNovexCreated || !selectedColumns.includes('novex_created_at') || hiddenColumns.includes('novex_created_at'),
    },
    
    {
      headerName: 'Assigned to',
      field: 'assigned_user_roles',
      sortable: true,
      filter: true,
      minWidth: 150,
      maxWidth: 300,
      cellRenderer: (params: any) => {
        return Array.isArray(params.value) && params.value.length === 0 ? '' : params.value;
      },
    
      hide: !isVTSSection || !selectedColumns.includes('assigned_user_roles') || hiddenColumns.includes('assigned_user_roles')
    },
    {
      headerName: 'Escalated to',
      field: 'last_escalated_to',
      sortable: true,
      filter: true,
      minWidth: 150,
      maxWidth: 300,
      cellRenderer: (params: any) => {
        return Array.isArray(params.value) && params.value.length === 0 ? '' : params.value;
      },
    
      hide: !isVTSSection || isOpenAlertsTab || !selectedColumns.includes('last_escalated_to') || hiddenColumns.includes('last_escalated_to')
    },
    {
      headerName: 'Actions',
      field: 'actions',
      sortable: false,
      filter: false,
      width: 100,
      minWidth: 100,
      maxWidth: 100,
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
      hide: !selectedColumns.includes('actions') || hiddenColumns.includes('actions')
    }
    ];
    return columns;
  }, [selectedColumns, handleViewHistory, hiddenColumns, handleLocationClick, isVTSSection, alertSection, fieldsFor, isMultiSelectMode]);

  const autoSizeStrategy = useMemo(() => {
    return {
      type: 'fitCellContents'
    };
  }, []);

  return (
    <div className="w-full">
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

        {isOpenAlertsTab && (alertSection === 'VTS' || alertSection === 'VA' || alertSection === 'TAS' || alertSection === 'EMLock' || (alertSection === 'LPG' && fieldsFor === "LPG")) && (fieldsFor === "SOD" || fieldsFor === "LPG") && (
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
            })}
          />
          Refresh
        </Button>
      </div>

      {isOpenAlertsTab && (alertSection === 'VTS' || alertSection === 'VA' || alertSection === 'TAS' || alertSection === 'EMLock' || (alertSection === 'LPG' && fieldsFor === "LPG")) && (fieldsFor === "SOD" || fieldsFor === "LPG") && isMultiSelectMode && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
          <strong>Multi-Select Mode:</strong> Select multiple alerts to create a ticket. {selectedAlerts.length} alert(s) selected.
        </div>
      )}

      <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        <DataGrid
          columnDefs={columnDefs
            .filter((col) => {
              if (fieldsFor === "SOD" || fieldsFor === "RO") {
                // Only hide assigned_user_roles for non-VTS sections, but keep interlock_name (Alert column)
                return !(col.field === "assigned_user_roles" && !isVTSSection);
              }
              return true;
            })}
          height="610px"
          pagination={true}
          paginationPageSize={pageSize}
          rowSelection={isOpenAlertsTab && (alertSection === 'VTS' || alertSection === 'VA' || alertSection === 'TAS' || alertSection === 'EMLock' || (alertSection === 'LPG' && fieldsFor === "LPG")) && (fieldsFor === "SOD" || fieldsFor === "LPG") && isMultiSelectMode ? "multiple" : "single"}
          onSelectionChanged={(params: any) => {
            console.log('onSelectionChanged triggered:', {
              alertSection,
              fieldsFor,
              isMultiSelectMode,
              condition: isOpenAlertsTab && (alertSection === 'VTS' || alertSection === 'VA' || alertSection === 'TAS' || alertSection === 'EMLock' || (alertSection === 'LPG' && fieldsFor === "LPG")) && (fieldsFor === "SOD" || fieldsFor === "LPG") && isMultiSelectMode
            });
            if (isOpenAlertsTab && (alertSection === 'VTS' || alertSection === 'VA' || alertSection === 'TAS' || alertSection === 'EMLock' || (alertSection === 'LPG' && fieldsFor === "LPG")) && (fieldsFor === "SOD" || fieldsFor === "LPG") && isMultiSelectMode) {
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
            resizable: true,
            sortable: true,
            filter: false,
            suppressMenu: true,
            autoSizeStrategy,
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
        }} onRequestDocumentUpload={undefined} />

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

export default SODAlertsTableV2;