
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
import utc from 'dayjs/plugin/utc';
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
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
import useAuthStore from '@/store/authStore';
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from '@/hooks/useAgGridMirrorScrollbar';

/** Roles that can create tickets from SOD Terminal Home / LPG Plant (do not change other contexts). */
const CREATE_TICKET_ROLES = ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"];

interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string, zone?: string) => void;
  hiddenColumns?: string[];
  alertSection?: string | null;
  fieldsFor?: string;
  onRefresh?: () => void;
  isOpenAlertsTab?: boolean;
  /** LPG Home Open Alerts tab — show Assigned to / Escalated to for PQ, VA, VTS Bulk, VTS Packed */
  showAssignmentColumns?: boolean;
  /** For RO and VA home, use created_at instead of external_timestamp for Created At column */
  useCreatedAtForCreatedAtColumn?: boolean;
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
  isOpenAlertsTab = false,
  showAssignmentColumns = false,
  useCreatedAtForCreatedAtColumn = false,
}) => {
  const [pageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [gridRefreshKey, setGridRefreshKey] = useState(0);
  const prevQueryRef = React.useRef<string | undefined>(query);

  const isVTSSection = alertSection === 'VTS' || alertSection === 'EMLock';
  const shouldShowNovexCreated = alertSection === 'EMLock' || alertSection === 'TAS' || alertSection === 'VA' || alertSection === 'LPG';
  const isVTSInstanceId = alertSection === 'VTS';
  /**
   * SOD Home → Open Alerts tab only (TAS, VA, VTS, EMLOCK).
   * Unchanged — separate from LPG Home logic below.
   */
  const showAssignedEscalatedInSodOpenAlerts =
    isOpenAlertsTab &&
    fieldsFor === 'SOD' &&
    (alertSection === 'TAS' ||
      alertSection === 'VA' ||
      alertSection === 'VTS' ||
      alertSection === 'EMLock');

  /**
   * LPG Home → Open Alerts tab ONLY.
   * Sections: PQ (alert_section LPG), VA, VTS Bulk, VTS Packed (alert_section VTS).
   * `showAssignmentColumns` is passed only from LPGHome.tsx Open Alerts tab — nowhere else.
   */
  const showLpgHomeOpenAlertsAssignmentColumns =
    Boolean(showAssignmentColumns) &&
    isOpenAlertsTab &&
    fieldsFor === 'LPG' &&
    (alertSection === 'LPG' ||
      alertSection === 'VA' ||
      alertSection === 'VTS' ||
      alertSection === null);

  const showAssignedEscalatedInOpenAlerts =
    showAssignedEscalatedInSodOpenAlerts || showLpgHomeOpenAlertsAssignmentColumns;

  const getDefaultColumns = () => {
    const baseColumns = [
      'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name',
      'created_at', 'device_type', 'device_name', 'assigned_user_roles', 'zone',
      'last_notified_to', 'actions'
    ];

    if (isVTSSection) {
      const locationIndex = baseColumns.indexOf('location_name');
      baseColumns.splice(locationIndex + 1, 0, 'vehicle_number');
      // TT Type column only for VTS in SOD (not LPG)
      if (alertSection === 'VTS' && fieldsFor === 'SOD') {
        baseColumns.splice(locationIndex + 2, 0, 'load_type');
      }

    }

    // Add novex_created_at column for EMLock, TAS, and VA sections
    if (shouldShowNovexCreated) {
      const actionsIndex = baseColumns.indexOf('actions');
      baseColumns.splice(actionsIndex, 0, 'novex_created_at');
    }

    const shouldIncludeEscalatedColumn =
      (isVTSSection && !isOpenAlertsTab) || showAssignedEscalatedInOpenAlerts;
    if (shouldIncludeEscalatedColumn) {
      const assignedIndex = baseColumns.indexOf('assigned_user_roles');
      if (!baseColumns.includes('last_escalated_to')) {
        baseColumns.splice(assignedIndex + 1, 0, 'last_escalated_to');
      }
    }

    return baseColumns;
  };

  const [selectedColumns, setSelectedColumns] = useState<string[]>(getDefaultColumns());

  // Update selected columns when alertSection, isOpenAlertsTab, fieldsFor, or query (date filter) changes so conditions don't stick
  useEffect(() => {
    setSelectedColumns(getDefaultColumns());
  }, [alertSection, isOpenAlertsTab, fieldsFor, showAssignmentColumns, query]);

  // When date filter (query) changes: force full grid reset so previous condition never applies
  useEffect(() => {
    if (prevQueryRef.current !== query) {
      console.log('[SODAlertsTableV2] date filter / query changed, resetting grid', {
        prevQuery: prevQueryRef.current?.slice?.(0, 80),
        newQuery: query?.slice?.(0, 80),
      });
      prevQueryRef.current = query;
      setSelectedColumns(getDefaultColumns());
      setGridRefreshKey((k) => k + 1);
    }
  }, [query]);

  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const gridApi = React.useRef<any>(null);
  const { tableWrapRef, retryMirrorScrollbar } = useAgGridMirrorScrollbar([
    isLoading,
    query,
    gridRefreshKey,
    alertSection,
    selectedColumns,
    isOpenAlertsTab,
  ]);
  const [selectedSapId, setSelectedSapId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
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

        const formatDate = (dateStr: string, useIst: boolean = false) => {
          if (!dateStr) return '';
          try {
            if (useIst) {
              return dayjs.utc(dateStr).tz('Asia/Kolkata').format('MMM D, YYYY, hh:mm A');
            }
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

        // For VTS sections, keep existing fields (TT Type only for SOD, not LPG)
        if (isVTSInstanceId) {
          const baseData: any = {
            'Alert ID': item.unique_id || '',
            'Location ID': item.sap_id || '',
            'Location Name': item.location_name || '',
            'TT Number': item.vehicle_number || '',
            ...(fieldsFor === 'SOD' ? { 'TT Type': item.load_type || '' } : {}),
            'Region': item.region || '',
            'Zone': item.zone || '',
            'Alert Status': item.alert_status || '',
            'Alert': item.equipment_name || item.interlock_name || '',
            'Severity': item.severity || '',
            // 'Instance ID': item.device_name ? item.device_name.split('@')[0] : '',
            'Assigned to': Array.isArray(item.assigned_user_roles) && item.assigned_user_roles.length === 0
              ? '' : (item.assigned_user_roles || []).join(', '),
            'Escalated to': Array.isArray(item.last_escalated_to) && item.last_escalated_to.length === 0
              ? '' : (item.last_escalated_to || []).join(', '),
            'Created At': formatDate(useCreatedAtForCreatedAtColumn ? item.created_at : item.external_timestamp, useCreatedAtForCreatedAtColumn),
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
          'Created At': formatDate(useCreatedAtForCreatedAtColumn ? item.created_at : item.external_timestamp, useCreatedAtForCreatedAtColumn),
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
  }, [query, debouncedSearchText, isVTSSection, alertSection]);

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
    if ((fieldsFor === "SOD" || fieldsFor === "LPG") && !canCreateTicket) {
      toast.error("You are not allowed to create tickets.");
      return;
    }
    // If no alertData provided, use selected rows from parameter or state
    const alertsToUse = alertData ? [alertData] : (selectedRows || selectedAlerts);
    console.log('alertsToUse:', alertsToUse);

    if (alertsToUse.length === 0) {
      toast.error('Please select at least one alert to create a ticket');
      return;
    }

    // Check if multiple alerts are selected
    const isMultipleAlerts = alertsToUse.length > 1;

    // Use the first alert for basic ticket data, all alerts for linked alerts
    const firstAlert = alertsToUse[0];

    // Collect unique zones and locations from all selected alerts
    const uniqueZones = [...new Set(alertsToUse.map(alert => alert.zone).filter(Boolean))];
    const uniqueLocations = [...new Set(alertsToUse.map(alert => alert.location_name).filter(Boolean))];

    // Determine zone value: single zone if all same, array of zones if different, empty if none
    let zoneValue: string | string[] = '';
    if (uniqueZones.length === 1) {
      zoneValue = uniqueZones[0];
    } else if (uniqueZones.length > 1) {
      zoneValue = uniqueZones;
    }

    // Determine location values: single location if all same, array of locations if different, empty if none
    // Normalize location_id to string(s) so create-ticket dialog can match plant.id and autofill location dropdown
    let locationValue: string | string[] = '';
    let locationIdValue: string | string[] = '';
    if (uniqueLocations.length === 1) {
      locationValue = uniqueLocations[0];
      locationIdValue = firstAlert.sap_id != null ? String(firstAlert.sap_id) : '';
    } else if (uniqueLocations.length > 1) {
      locationValue = uniqueLocations;
      locationIdValue = [...new Set(alertsToUse.map(alert => alert.sap_id != null ? String(alert.sap_id) : '').filter(Boolean))];
    }

    // Collect vehicle numbers from alerts for truck_no payload (SOD terminal home / LPG home)
    const vehicleNumbers = [...new Set(
      alertsToUse
        .map((alert: any) => alert.vehicle_number || alert.truck_no || alert.truck_number || alert.vehicle_no)
        .filter(Boolean)
    )] as string[];
    const truckNo = vehicleNumbers.length > 0 ? vehicleNumbers : [];

    // Transform alert data into ticket initial data
    const initialTicketData = {
      // Prefill zone/location: single value if same, array if different, empty if none
      zone: zoneValue,
      location_name: locationValue,
      location_id: locationIdValue,
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
      bu: fieldsFor === 'LPG' ? 'LPG' : (isMultipleAlerts ? '' : (firstAlert.bu || '')),
      // Set up linked alerts for all selected alerts
      linked_alert_id: alertsToUse.map(alert => {
        console.log('Mapping alert:', alert, 'id:', alert.id, 'unique_id:', alert.unique_id);
        return alert.id || alert.unique_id;
      }).filter(id => id),
      // Vehicle number from alert table -> send in payload as truck_no (SOD terminal home / LPG home)
      truck_no: truckNo,
      // Leave summary and description empty for user to fill
      summary: '',
      description: '',
    };

    console.log("Setting ticketInitialData:", initialTicketData);
    setTicketInitialData(initialTicketData);
    console.log("Opening ticket dialog");
    setIsCreateTicketDialogOpen(true);
    setIsTicketFormMinimized(false);
  }, [alertSection, selectedAlerts, fieldsFor, canCreateTicket]);

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

  useEffect(() => {
    if (gridApi.current && dataSource) {
      gridApi.current.setGridOption?.('datasource', dataSource);
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0);
    }
  }, [query, dataSource]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
    retryMirrorScrollbar();
  }, [retryMirrorScrollbar]);

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
      ...(isOpenAlertsTab && (fieldsFor === "SOD" || fieldsFor === "LPG") && isMultiSelectMode ? [{
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
      headerName: 'TT Type',
      field: 'load_type',
      sortable: true,
      filter: true,
      minWidth: 120,
      maxWidth: 200,
      hide: alertSection !== 'VTS' || fieldsFor !== 'SOD' || !selectedColumns.includes('load_type') || hiddenColumns.includes('load_type')
    },
    {
      headerName: 'Alert',
      field: 'interlock_name',
      sortable: true,
      filter: true,
      minWidth: 200,
      maxWidth: 300,
      valueGetter: (params: any) => {
        // For VTS section, use equipment_name, otherwise use interlock_name
        if (alertSection === 'VTS') {
          return params.data?.equipment_name || params.data?.interlock_name || '';
        }
        return params.data?.interlock_name || '';
      },
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
      field: useCreatedAtForCreatedAtColumn ? 'created_at' : 'external_timestamp',
      sortable: true,
      filter: true,
      minWidth: 150,
      maxWidth: 300,
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        dayjs.extend(relativeTime);
        dayjs.extend(advancedFormat);
        
        let date;
        if (useCreatedAtForCreatedAtColumn) {
          // Convert created_at (UTC) to IST
          date = dayjs.utc(params.value).tz('Asia/Kolkata');
        } else {
          date = dayjs(params.value);
        }
        
        const relative = date.fromNow();
        const formatted = date.format("MMM D, YYYY, hh:mm A");
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
        field: 'created_at',
        sortable: true,
        filter: true,
        minWidth: 150,
        maxWidth: 300,
        cellRenderer: (params: any) => {
          if (!params.value) return '';

          try {
            // Treat the input as UTC and convert it to local time
            const localDate = dayjs.utc(params.value).local();

            const relative = localDate.fromNow();
            const formatted = localDate.format("MMM D, YYYY, hh:mm A");

            return (
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">{relative}</span>
                <span className="text-xs text-gray-500">{formatted}</span>
              </div>
            );
          } catch (error) {
            return 'Invalid date';
          }
        },
        hide:!shouldShowNovexCreated || !selectedColumns.includes('novex_created_at') || hiddenColumns.includes('novex_created_at'),
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
    
      hide: showLpgHomeOpenAlertsAssignmentColumns
        ? false
        : showAssignedEscalatedInSodOpenAlerts
          ? !selectedColumns.includes('assigned_user_roles') || hiddenColumns.includes('assigned_user_roles')
          : !isVTSSection ||
            !selectedColumns.includes('assigned_user_roles') ||
            hiddenColumns.includes('assigned_user_roles')
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
    
      hide: showLpgHomeOpenAlertsAssignmentColumns
        ? false
        : showAssignedEscalatedInSodOpenAlerts
          ? !selectedColumns.includes('last_escalated_to') || hiddenColumns.includes('last_escalated_to')
          : !isVTSSection ||
            isOpenAlertsTab ||
            !selectedColumns.includes('last_escalated_to') ||
            hiddenColumns.includes('last_escalated_to')
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
  }, [selectedColumns, handleViewHistory, hiddenColumns, handleLocationClick, isVTSSection, alertSection, fieldsFor, isMultiSelectMode, isVTSInstanceId, isOpenAlertsTab, showAssignedEscalatedInSodOpenAlerts, showLpgHomeOpenAlertsAssignmentColumns]);

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

        {isOpenAlertsTab && (fieldsFor === "SOD" || fieldsFor === "LPG") && canCreateTicket && (
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

      <div
        ref={tableWrapRef}
        className="ag-grid-mirror-h-scroll-wrap relative [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700"
      >
        <style>{AG_GRID_MIRROR_SCROLL_CSS}</style>
        <DataGrid
          key={`alerts-${query ?? ''}-${gridRefreshKey}-${alertSection ?? 'all'}-${showAssignmentColumns}-${isOpenAlertsTab}`}
          loading={isLoading}
          columnDefs={columnDefs
            .filter((col) => {
              // LPG Home Open Alerts (PQ / VA / VTS Bulk / VTS Packed): always keep assignment columns
              if (showLpgHomeOpenAlertsAssignmentColumns) {
                return true;
              }
              // SOD Home Open Alerts: keep assignment columns for TAS / VA / VTS / EMLOCK
              if (showAssignedEscalatedInSodOpenAlerts) {
                return true;
              }
              // All other dashboards/tabs: original VTS-only column filter for SOD/RO
              if (fieldsFor === "SOD" || fieldsFor === "RO") {
                if (col.field === "assigned_user_roles" || col.field === "last_escalated_to") {
                  return isVTSSection && !(col.field === "last_escalated_to" && isOpenAlertsTab);
                }
              }
              return true;
            })}
          height="610px"
          pagination={true}
          paginationPageSize={pageSize}
          rowSelection={isOpenAlertsTab && (fieldsFor === "SOD" || fieldsFor === "LPG") && isMultiSelectMode ? "multiple" : "single"}
          onSelectionChanged={(params: any) => {
            if (isOpenAlertsTab && (fieldsFor === "SOD" || fieldsFor === "LPG") && isMultiSelectMode) {
              const selectedRows = gridApi.current?.getSelectedRows() || [];
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
        onSubmitSuccess={(message?: string) => {
          if (gridApi.current) {
            gridApi.current.refreshInfiniteCache();
          }
          if (message) {
            toast.success(message);
          }
          handleTicketDialogClose();
        }}
      />
    </div>
  );
};

export default SODAlertsTableV2;



