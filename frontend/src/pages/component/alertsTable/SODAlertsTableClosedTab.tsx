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
import { apiClient } from '@/services/apiClient';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from '@/hooks/useAgGridMirrorScrollbar';

interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string, zone?: string) => void;
  hiddenColumns?: string[]; // Add this new prop
  alertSection?: string | null;
  fieldsFor?: string;
  onRefresh?: () => void;
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

function formatMarkAsFalseValue(value: unknown): string {
  if (value === true || value === 'true') return 'True';
  if (value === false || value === 'false') return 'False';
  return '';
}

function normalizeAlertHistory(alertHistory: unknown): any[] {
  if (Array.isArray(alertHistory)) return alertHistory;
  if (typeof alertHistory === 'string' && alertHistory.trim()) {
    try {
      const parsed = JSON.parse(alertHistory);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function stripHtml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getVAClosedAlertHistoryEntry(
  alertHistory: unknown
): { action_type: string; action_msg: string } | null {
  const history = normalizeAlertHistory(alertHistory);
  if (!history.length) return null;

  const reversedHistory = [...history].reverse();
  const priorityTypes = ['FalseAlert', 'Justification', 'AcceptClose', 'Rejected'];

  for (const type of priorityTypes) {
    const entry = reversedHistory.find((h) => h?.action_type === type);
    if (entry) {
      return {
        action_type: entry.action_type || type,
        action_msg: stripHtml(entry.action_msg),
      };
    }
  }

  const resolvedEntry = reversedHistory.find(
    (h) => h?.action_type === 'Resolved' || h?.action_type === 'resolved'
  );
  if (resolvedEntry) {
    return {
      action_type: resolvedEntry.action_type || 'Resolved',
      action_msg: stripHtml(resolvedEntry.action_msg),
    };
  }

  return null;
}

export const SODAlertsTableClosedTab: React.FC<ROAlertsTableV2Props> = ({ query, onLocationChange, hiddenColumns = [], alertSection, fieldsFor, useCreatedAtForCreatedAtColumn = false }) => {
  const [pageSize] = useState<number>(20);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name','closed_at',
    'updated_at', 'created_at', 'device_type', 'device_name', 'assigned_user_roles',
    'last_notified_to', 'actions', 'zone', 'vehicle_number', 'load_type', 'action_by', 'action_type', 'mark_as_false', 'alert_section'
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
    alertSection,
    selectedColumns,
  ]);

const isVTSSection = alertSection === 'VTS';
const isVASection = alertSection === 'VA';
const isTASSection = alertSection === 'TAS';
const isEMLOCKSection = alertSection?.toUpperCase() === 'EMLOCK';
 
const downloadExcel = useCallback(async () => {
  setIsDownloading(true);

  try {
    // Build fields array for download
    const downloadFields = [
      "sap_id", "location_name", "region", "interlock_name", "unique_id", "closed_at", "updated_at", "created_at", "severity",
      "device_type", "device_name", "assigned_user_roles", "last_notified_to", "zone", "vehicle_number", "load_type", "alert_section"
    ];
    
    if (isVTSSection) {
      downloadFields.push("mark_as_false", "vehicle_unblocked_date");
    }
    
    if (isVASection) {
      downloadFields.push("alert_history", "mark_as_false");
    }

    const params: any = {
      q: query,
      skip: 0,
      limit: 10000,
      sort: JSON.stringify({ created_at: 'desc' }),
    };

    if (debouncedSearchText.trim()) {
      params.search_text = debouncedSearchText;
    }

    if (isVASection) {
      params.fields = JSON.stringify(downloadFields);
    }

    const response = await apiClient.get('/api/alerts', { params });
    const data = response.data.data || [];

    const excelData = data.map((item: any) => {
    

      const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
          return dayjs(dateStr).format('MMM D, YYYY, hh:mm A');
        } catch {
          return '';
        }
      };
  const formatDateIST = (dateStr?: string) => {
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
     
      const getActionType = () => {
        // First check for UnBlockInitiated action_type or block_status === "UnBlock"
        if (item.alert_history && Array.isArray(item.alert_history)) {
          const hasUnBlockInitiated = item.alert_history.some(
            (h) => h.action_type === 'UnBlockInitiated'
          );
          
          if (hasUnBlockInitiated) {
            return 'Unblock';
          }
        }
        
        // Check block_status from item
        if (item.block_status === 'UnBlock') {
          return 'Unblock';
        }

        if (!item.alert_history || !Array.isArray(item.alert_history)) return '';

        const hasExplicitUnBlocked = item.alert_history.some(
          (h) => h.action_type === 'UnBlocked'
        );

        if (hasExplicitUnBlocked) {
          return 'UnBlock';
        }

        const hasJustificationUnBlocked = item.alert_history.some(
          (h) =>
            h.action_type === 'Justification' &&
            h.rca_reason &&
            h.category
        );

        if (hasJustificationUnBlocked) {
          return 'UnBlock';
        }

        const hasAcceptClose = item.alert_history.some(
          (h) => h.action_type === 'AcceptClose'
        );

        if (hasAcceptClose) {
          return 'Accept & Block';
        }

        return '';
      };

      const getLastJustification = () => {
        if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
        return [...item.alert_history]
          .reverse()
          .find(h => h.action_type === 'Justification');
      };

      const getLastApproved = () => {
        if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
        return [...item.alert_history]
          .reverse()
          .find(h => h.action_type === 'Approved');
      };

      const getLastRejected = () => {
        if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
        return [...item.alert_history]
          .reverse()
          .find(h => h.action_type === 'Rejected');
      };

      const extractBeforeInitiated = (msg?: string) => {
        if (!msg) return '';
        const keyword = 'initiated';
        if (msg.toLowerCase().includes(keyword)) {
          return msg.split(new RegExp(keyword, 'i'))[0].trim();
        }
        return msg.split('.')[0] + '.';
      };

      const getJustificationRemark = () => {
        // Look for OccBlockingRemarks action_type in alert_history
        if (!item.alert_history || !Array.isArray(item.alert_history)) return '';
        
        const occBlockingRemarks = [...item.alert_history]
          .reverse()
          .find((h) => h.action_type === 'OccBlockingRemarks');
        
        if (occBlockingRemarks?.action_msg) {
          return occBlockingRemarks.action_msg;
        }
        
        // Fall back to existing logic if OccBlockingRemarks not found
        const lastJustification = getLastJustification();
        return extractBeforeInitiated(lastJustification?.action_msg);
      };

      const getFinalRemark = () => {
        // Look for OccUnblockingRemarks action_type in alert_history
        if (!item.alert_history || !Array.isArray(item.alert_history)) return '';
        
        const occUnblockingRemarks = [...item.alert_history]
          .reverse()
          .find((h) => h.action_type === 'OccUnblockingRemarks');
        
        if (occUnblockingRemarks?.action_msg) {
          return occUnblockingRemarks.action_msg;
        }
        
        // Fall back to existing logic if OccUnblockingRemarks not found
        const lastApproved = getLastApproved();
        const lastRejected = getLastRejected();

        if (lastApproved?.action_msg) {
          return extractBeforeInitiated(lastApproved.action_msg);
        }

        if (lastRejected?.action_msg) {
          return extractBeforeInitiated(lastRejected.action_msg);
        }

        return '';
      };

      const getCategory = () => {
        const lastJustification = getLastJustification();
        return lastJustification?.category || '';
      };

      const getRCAReason = () => {
        // Return violation_type from the item
        return item.violation_type || '';
      };


const getBlockedDays = (item: any) => {
  if (!item.external_timestamp || !item.vehicle_unblocked_date) return '';

  const createdAt = dayjs(item.external_timestamp).startOf('day');
  const unblockedAt = dayjs(item.vehicle_unblocked_date).startOf('day');

  if (!createdAt.isValid() || !unblockedAt.isValid()) return '';

  return unblockedAt.diff(createdAt, 'day'); // number of days blocked
};
const getCreatorId = (item: any) => {
  if (!Array.isArray(item.alert_history)) return '';

  // First check for BlockInitiated action_type and use its action_by
  const blockInitiated = [...item.alert_history]
    .reverse()
    .find((h) => h.action_type === 'BlockInitiated');

  if (blockInitiated?.action_by) {
    return blockInitiated.action_by;
  }

  // Fall back to existing logic (Justification)
  const justification = [...item.alert_history]
    .reverse()
    .find((h) => h.action_type === 'Justification');

  return justification?.employee_id || '';
};

const getApproverId = (item: any) => {
  if (!Array.isArray(item.alert_history)) return '';

  // First check for UnBlockInitiated action_type and use its action_by
  const unBlockInitiated = [...item.alert_history]
    .reverse()
    .find((h) => h.action_type === 'UnBlockInitiated');

  if (unBlockInitiated?.action_by) {
    return unBlockInitiated.action_by;
  }

  // Fall back to existing logic (Approved)
  const approved = [...item.alert_history]
    .reverse()
    .find((h) => h.action_type === 'Approved');

  return approved?.employee_id || '';
};
      const baseRow: any = {
        'Alert ID': item.unique_id || '',
        'Location ID': item.sap_id || '',
        'Location Name': item.location_name || '',
        'Region': item.region || '',
        'Zone': item.zone || '',
      
        'Alert': isVTSSection ? (item.equipment_name || item.interlock_name || '') : (item.interlock_name || ''),
        'Severity': item.severity || '',
       // 'Equipment Type': item.device_type || '',
        [isVTSSection ? 'Instance ID' : 'Equipment ID']:
          item.device_name?.split('@')[0] || '',
        // 'Assigned to': Array.isArray(item.assigned_user_roles)
        //   ? item.assigned_user_roles.join(', ')
        //   : '',
        // 'Escalated to': Array.isArray(item.last_escalated_to)
        //   ? item.last_escalated_to.join(', ')
        //   : '',
        'Created At': formatDateIST(item.created_at),
      };

      // Add 'Closed' field for VA, TAS, and EMLOCK sections
      if (isVASection || isTASSection || isEMLOCKSection) {
        baseRow['Closed'] = formatDateIST(item.closed_at || item.updated_at);
      }

      if (isVASection) {
        const historyEntry = getVAClosedAlertHistoryEntry(item.alert_history);
        baseRow['Marked as False'] = formatMarkAsFalseValue(item.mark_as_false);
        baseRow['Remarks'] = historyEntry?.action_msg || '';
      }

      if (isVTSSection) {
        // Calculate Action By based on mark_as_false and vehicle_unblocked_date
        const getActionBy = () => {
          const markAsFalse = item?.mark_as_false;
          const vehicleUnblockedDate = item?.vehicle_unblocked_date;
          
          // If vehicle_unblocked_date IS NULL, show "Accept & Block"
          if (!vehicleUnblockedDate) {
            return 'Accept & Block';
          }
          
          // If vehicle_unblocked_date IS NOT NULL
          if (vehicleUnblockedDate) {
            // If mark_as_false = 'false', show "Auto Unblock"
            if (markAsFalse === 'false' || markAsFalse === false) {
              return 'Auto Unblock';
            }
            // If mark_as_false = 'true', show "Manual Unblock"
            if (markAsFalse === 'true' || markAsFalse === true) {
              return 'Manual Unblock';
            }
          }
          
          return '';
        };

        Object.assign(baseRow, {
          'Closed At': formatDateIST(item.closed_at || item.updated_at),
            'TT Number': item.vehicle_number || '',
              ...(fieldsFor !== 'LPG' ? { 'TT Type': item.load_type || '' } : {}),
              'Alert Status': item.alert_status || '',
              'Creator ID': getCreatorId(item),   
              'Approver ID': getApproverId(item),
                'Vehicle Blocked End Date': formatDateIST(item.vehicle_blocked_end_date),
  'Vehicle Unblocked Date': formatDateIST(item.vehicle_unblocked_date),
 
 'No. of Days Blocked': getBlockedDays(item),
          'Action By': getActionBy(),
          'Action Type': getActionType(),
          'Category': getCategory(),
          'RCA Reason': getRCAReason(),
          'Justification Remark': getJustificationRemark(),
          'Approver Remark': getFinalRemark(),
        });
      }

      return baseRow;
    });

   
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet['!cols'] = Object.keys(excelData[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...excelData.map((row) => String(row[key] || '').length)
      ),
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerts');

    const filename = `SOD_Alerts_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    XLSX.writeFile(workbook, filename);

    toast.success(`Excel downloaded: ${filename}`);
  } catch (error) {
    console.error('Excel download failed', error);
    toast.error('Failed to download Excel');
  } finally {
    setIsDownloading(false);
  }
}, [query, debouncedSearchText, isVTSSection, isVASection, isTASSection, isEMLOCKSection]);


  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);
  // Conditionally include mark_as_false and vehicle_unblocked_date fields for VTS section in closed alerts
  // Conditionally include alert_history fields for VA section in closed alerts
  const fields = useMemo(() => {
    const baseFields = [
      "sap_id", "location_name", "region", "interlock_name", "unique_id", "updated_at", "created_at", "severity","closed_at",
      "device_type", "device_name", "assigned_user_roles", "last_notified_to", "zone", "vehicle_number", "load_type", "alert_section", "equipment_name"
    ];
    
    // Add mark_as_false and vehicle_unblocked_date for VTS section in closed alerts
    // action_by is calculated client-side based on these fields, not fetched from API
    if (isVTSSection) {
      return [...baseFields, "mark_as_false", "vehicle_unblocked_date"];
    }
    
    // Add alert_history and mark_as_false for VA section in closed alerts
    if (isVASection) {
      return [...baseFields, "alert_history", "mark_as_false"];
    }
    
    return baseFields;
  }, [isVTSSection, isVASection]);
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

  // When date filter (query) changes: reset grid so old conditions don't apply
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

  const [selectedSapId, setSelectedSapId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  // Then, modify your handleLocationClick to include the zone
  const handleLocationClick = useCallback((sapId: string, zone?: string) => {
    setSelectedSapId(sapId); // Track the selected sapId
    setSelectedZone(zone || null); // Track the zone if provided

    if (onLocationChange) {
      // Pass both SAP ID and zone to the parent component
      onLocationChange(sapId, zone);
    } else {
      navigate(`/location/${sapId}`);
    }
  }, [onLocationChange, navigate]);

  // Update handleRefresh to clear both selections but NOT affect global location filter
  const handleRefresh = useCallback(() => {
    // Clear the search text
    setSearchText('');

    // Clear both selections (local to this component)
    setSelectedSapId(null);
    setSelectedZone(null);

    // NOTE: We don't call onLocationChange here because table refresh should only refresh the table,
    // not affect the global location filter that impacts other dashboard components

    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page on refresh
    }
  }, []);

  const handleLocationView = (sapId: string) => {
    navigate(`/location/${sapId}`);
  };
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
      hide: alertSection !== 'VTS' || fieldsFor === 'LPG' || !selectedColumns.includes('load_type') || hiddenColumns.includes('load_type')
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
      headerName: 'Closed',
      field: 'closed_at',
      sortable: true,
      filter: true,
      valueGetter: (params: any) => {
        return params.data?.closed_at || params.data?.updated_at;
      },
      cellRenderer: (params: any) => {
        const dateValue = params.data?.closed_at || params.data?.updated_at;
        if (!dateValue) return '';

        try {
          // Convert UTC to local time
          const utcDate = new Date(dateValue);
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
          const relativeTime = formatRelativeTime(dateValue);

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
      hide: !selectedColumns.includes('closed_at'),
      minWidth: 150, // Ensure enough width for both lines
    },
    {
      headerName: 'Created At',
      field: 'created_at',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        if (!params.value) return '';

        try {

          const utcDate = new Date(params.value);
          const localDate = convertUTCDateToLocalDate(utcDate);

          const formattedDateTime = localDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          const relativeTime = formatRelativeTime(params.value);

          return (
            <div className="flex flex-col">
              <span className="text-sm text-gray-900">{relativeTime}</span>
              <span className="text-xs text-gray-500">{formattedDateTime}</span>
            </div>
          );
        } catch {
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
      headerName:  isVTSSection ? 'Instance ID' : 'Equipment ID',
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
      hide: hiddenColumns.includes('assigned_user_roles')
    },
    {
      headerName: 'Equipement Type',
      field: 'device_type',
      sortable: true,
      filter: true,
      hide: isVTSSection || !selectedColumns.includes('device_type')
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



    // Action By column - only for VTS closed alerts
    {
      headerName: 'Action By',
      field: 'action_by',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        if (!isVTSSection) return params.value || '';
        
        const rowData = params.data;
        const markAsFalse = rowData?.mark_as_false;
        const vehicleUnblockedDate = rowData?.vehicle_unblocked_date;
        
        // If vehicle_unblocked_date IS NULL, show "Accept & Block"
        if (!vehicleUnblockedDate) {
          return <span className="text-sm text-gray-900">Accept & Block</span>;
        }
        
        // If vehicle_unblocked_date IS NOT NULL
        if (vehicleUnblockedDate) {
          // If mark_as_false = 'false', show "Auto Unblock"
          if (markAsFalse === 'false' || markAsFalse === false) {
            return <span className="text-sm text-gray-900">Auto Unblock</span>;
          }
          // If mark_as_false = 'true', show "Manual Unblock"
          if (markAsFalse === 'true' || markAsFalse === true) {
            return <span className="text-sm text-gray-900">Manual Unblock</span>;
          }
        }
        
        // Fallback to original value if conditions don't match
        return params.value || '';
      },
      hide: !isVTSSection || !selectedColumns.includes('action_by')
    },
    // Action Type column - only for VA closed alerts
    {
      headerName: 'Action Type',
      field: 'action_type',
      sortable: true,
      filter: true,
      minWidth: 200,
      maxWidth: 400,
      cellRenderer: (params: any) => {
        if (!isVASection) return '';
        
        const rowData = params.data;
        const alertHistory = rowData?.alert_history;
        
        if (!alertHistory || !Array.isArray(alertHistory)) {
          return '';
        }
        
        // Check for the specified action types in order of priority
        const actionTypes = ['FalseAlert', 'Justification', 'AcceptClose', 'Rejected'];
        
        for (const actionType of actionTypes) {
          const hasActionType = alertHistory.some((entry: any) => entry.action_type === actionType);
          if (hasActionType) {
            return <span className="text-sm text-gray-900">{actionType}</span>;
          }
        }
        
        // If none of the above found, check for "Resolved"
        const resolvedEntry = alertHistory.find((entry: any) => 
          entry.action_type === 'Resolved' || entry.action_type === 'resolved'
        );
        
        if (resolvedEntry) {
          const actionMsg = resolvedEntry.action_msg || '';
          return (
            <div className="flex flex-col">
              <span className="text-sm text-gray-900">closed from va portal</span>
              {actionMsg && (
                <span className="text-xs text-gray-500 ">{actionMsg}</span>
              )}
            </div>
          );
        }
        
        return '';
      },
      hide: !isVASection || !selectedColumns.includes('action_type')
    },
    {
      headerName: 'False Alerts',
      field: 'mark_as_false',
      sortable: true,
      filter: true,
      minWidth: 140,
      maxWidth: 200,
      cellRenderer: (params: any) => {
        if (!isVASection) return '';

        const formatted = formatMarkAsFalseValue(params.data?.mark_as_false);
        if (!formatted) return '';

        return <span className="text-sm text-gray-900">{formatted}</span>;
      },
      hide: !isVASection || !selectedColumns.includes('mark_as_false')
    },
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
  ], [selectedColumns, handleViewHistory, hiddenColumns, isVTSSection, isVASection, alertSection, fieldsFor]);

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

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw
            className={clsx("mr-2 h-4 w-4 transition-transform", {
              "animate-spin": rotating,
            })} />
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
        onSubmitSuccess={(message?: string) => {
          if (gridApi.current) {
            gridApi.current.refreshInfiniteCache();
          }
          if (message) {
            toast.success(message);
          }
          setHistoryDialogState({ isOpen: false, alertId: null });
        }} onRequestDocumentUpload={undefined} />
    </div>
  );
};

export default SODAlertsTableClosedTab;