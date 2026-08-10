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
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AlertHistoryDialogV2 from './AlertHistoryDialogV2';
import { apiClient } from '@/services/apiClient';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';


import { AG_GRID_MIRROR_SCROLL_CSS, useAgGridMirrorScrollbar } from '@/hooks/useAgGridMirrorScrollbar';

interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string) => void;
  hiddenColumns?: string[]; // Add this new prop
  fieldsFor?: string;
  onRefresh?: () => void;
  hideDocumentTable?: boolean;
  ttType?: string | null;
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

export const VTSAlertsTableClosedTab: React.FC<ROAlertsTableV2Props> = ({ query, onLocationChange, hiddenColumns = [], hideDocumentTable = false, ttType }) => {
  const isVTSWithTAS = typeof query === 'string' && query.includes("alert_section='VTS'") && query.includes("bu='TAS'");

  const [pageSize] = useState<number>(20);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'unique_id', 'sap_id', 'vehicle_number', 'location_name', 'severity', 'interlock_name','closed_at',
    'updated_at', 'created_at', 'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'load_type', 'actions', 'action_by', 'alert_history'
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
// const downloadExcel = useCallback(async () => {
//     setIsDownloading(true);
//     try {
//       // Fetch all data for export (you might need to adjust this based on your API)
//       const params: any = {
//         q: query,
//         skip: 0,
//         limit: 10000, // Large number to get all data
//         sort: JSON.stringify({ "created_at": "desc" })
//       };

//       if (debouncedSearchText.trim()) {
//         params.search_text = debouncedSearchText;
//       }

//       const response = await apiClient.get('/api/alerts', { params });
//       const data = response.data.data;

//       const excelData = data.map((item: any) => {
//         // Format alert history
//         const alertHistory = item.alert_history?.map((history: any) => ({
//           action_type: history.action_type || '',
//           action_msg: history.action_msg || '',
//           processed_time: history.processed_time || '',
//           duration: history.duration || ''
//         })) || [];

//         // Format dates
//         const formatDate = (dateStr: string) => {
//           if (!dateStr) return '';
//           try {
//             return dayjs(dateStr).format('MMM D, YYYY, hh:mm A');
//           } catch {
//             return dateStr;
//           }
//         };
  
// const getActionType = () => {
//   if (!item.alert_history || !Array.isArray(item.alert_history)) return "";

//   const hasExplicitUnBlocked = item.alert_history.some(
//     (h) => h.action_type === "UnBlocked"
//   );

//   if (hasExplicitUnBlocked) {
//     return "UnBlock";
//   }

//   const hasJustificationUnBlocked = item.alert_history.some(
//     (h) =>
//       h.action_type === "Justification" &&
//       h.rca_reason &&
//       h.category
//   );

//   if (hasJustificationUnBlocked) {
//     return "UnBlock";
//   }

//   const hasAcceptClose = item.alert_history.some(
//     (h) => h.action_type === "AcceptClose"
//   );

//   if (hasAcceptClose) {
//     return "Accept & Block";
//   }

//   return "";
// };

//         const getLastJustification = () => {
//           if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
          
//           return [...item.alert_history]
//             .reverse()
//             .find(h => h.action_type === "Justification");
//         };

        
//         const getLastApproved = () => {
//           if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
          
//           return [...item.alert_history]
//             .reverse()
//             .find(h => h.action_type === "Approved");
//         };

      
//         const getLastRejected = () => {
//           if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
          
//           return [...item.alert_history]
//             .reverse()
//             .find(h => h.action_type === "Rejected");
//         };

// const extractBeforeInitiated = (msg) => {
//   const keyword = "initiated";
//   if (!msg) return "";
//   if (msg.toLowerCase().includes(keyword)) {
//     return msg.split(new RegExp(keyword, "i"))[0].trim();
//   }
//   return msg.split(".")[0] + ".";
// };


// const getJustificationRemark = () => {
//   const lastJustification = getLastJustification();
//   return extractBeforeInitiated(lastJustification?.action_msg);
// };

// const getFinalRemark = () => {
//   const lastApproved = getLastApproved();
//   const lastRejected = getLastRejected();

//   if (lastApproved?.action_type === "Approved" && lastApproved.action_msg) {
//     return extractBeforeInitiated(lastApproved.action_msg);
//   }

//   if (lastRejected?.action_type === "Rejected" && lastRejected.action_msg) {
//     return extractBeforeInitiated(lastRejected.action_msg);
//   }

//   return "";
// };



//         const getCategory = () => {
//           const lastJustification = getLastJustification();
//           return lastJustification?.category || "";
//         };

//         const getRCAReason = () => {
//           const lastJustification = getLastJustification();
//           return lastJustification?.rca_reason || "";
//         };
//         const getBlockedDays = (item: any) => {
//           if (!item.created_at || !item.vehicle_unblocked_date) return '';
        
//           const createdAt = dayjs(item.created_at).startOf('day');
//           const unblockedAt = dayjs(item.vehicle_unblocked_date).startOf('day');
        
//           if (!createdAt.isValid() || !unblockedAt.isValid()) return '';
        
//           return unblockedAt.diff(createdAt, 'day'); // number of days blocked
//         };
        
// return {
//   'Alert ID': item.unique_id || '',
//   'Location ID': item.sap_id || '',
//   'Location Name': item.location_name || '',
//   'Region': item.region || '',
//   'Zone': item.zone || '',
//   'TT Number': item.vehicle_number || '',
//   'Alert Status': item.alert_status || '',
//   'Alert': item.interlock_name || '',
//   'Severity': item.severity || '',
//   'Instance ID':item.device_name||'',
//   'Assigned to': Array.isArray(item.assigned_user_roles) && item.assigned_user_roles.length === 0
//     ? '' : (item.assigned_user_roles || []).join(', '),
//   'Escalated to': Array.isArray(item.last_escalated_to) && item.last_escalated_to.length === 0
//     ? '' : (item.last_escalated_to || []).join(', '),
//   'Created At': formatDate(item.created_at),
//   'Vehicle Blocked End Date': formatDate(item.vehicle_blocked_end_date),
//   'Vehicle Unblocked Date': formatDate(item.vehicle_unblocked_date),
//    'No. of Days Blocked': getBlockedDays(item),
//    'Action Type': getActionType(),
//  'Category': getCategory(),
//   'RCA Reason': getRCAReason(),
//   'Justification Remark': getJustificationRemark(),
//   'Approver Remark': getFinalRemark()

// };
       
//       });
// const alertType =
// query?.toLowerCase().includes("lpg") || data.some((d: any) => d.interlock_name?.toLowerCase().includes("lpg"))
// ? "LPG"
// : "SOD";

//       // Create workbook and worksheet
//       const workbook = XLSX.utils.book_new();
//       const worksheet = XLSX.utils.json_to_sheet(excelData);

//       // Auto-size columns
//       const colWidths = Object.keys(excelData[0] || {}).map(key => ({
//         wch: Math.max(
//           key.length,
//           ...excelData.map(row => String(row[key] || '').length)
//         )
//       }));
//       worksheet['!cols'] = colWidths;

//       // Add worksheet to workbook
//      XLSX.utils.book_append_sheet(workbook, worksheet, `${alertType} Alerts`);


// const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
// const filename = `${alertType}_Alerts_${timestamp}.xlsx`;
     
//       XLSX.writeFile(workbook, filename);

//       toast.success(`Excel file downloaded: ${filename}`);
//     } catch (error) {
//       console.error('Error downloading Excel:', error);
//       toast.error('Failed to download Excel file');
//     } finally {
//       setIsDownloading(false);
//     }
//   }, [query, debouncedSearchText]);

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

  if (!item.alert_history || !Array.isArray(item.alert_history)) return "";

  const hasExplicitUnBlocked = item.alert_history.some(
    (h) => h.action_type === "UnBlocked"
  );

  if (hasExplicitUnBlocked) {
    return "UnBlock";
  }

  const hasJustificationUnBlocked = item.alert_history.some(
    (h) =>
      h.action_type === "Justification" &&
      h.rca_reason &&
      h.category
  );

  if (hasJustificationUnBlocked) {
    return "UnBlock";
  }


  const hasAcceptClose = item.alert_history.some(
    (h) => h.action_type === "AcceptClose"
  );

  if (hasAcceptClose) {
    return "Accept & Block";
  }

  return "";
};



  

        const getLastJustification = () => {
          if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
          
          return [...item.alert_history]
            .reverse()
            .find(h => h.action_type === "Justification");
        };

        
        const getLastApproved = () => {
          if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
          
          return [...item.alert_history]
            .reverse()
            .find(h => h.action_type === "Approved");
        };

      
        const getLastRejected = () => {
          if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
          
          return [...item.alert_history]
            .reverse()
            .find(h => h.action_type === "Rejected");
        };

const extractBeforeInitiated = (msg) => {
  const keyword = "initiated";
  if (!msg) return "";
  if (msg.toLowerCase().includes(keyword)) {
    return msg.split(new RegExp(keyword, "i"))[0].trim();
  }
  return msg.split(".")[0] + ".";
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

  if (lastApproved?.action_type === "Approved" && lastApproved.action_msg) {
    return extractBeforeInitiated(lastApproved.action_msg);
  }

  if (lastRejected?.action_type === "Rejected" && lastRejected.action_msg) {
    return extractBeforeInitiated(lastRejected.action_msg);
  }

  return "";
};



        const getCategory = () => {
          const lastJustification = getLastJustification();
          return lastJustification?.category || "";
        };

        const getRCAReason = () => {
          // Return violation_type from the item
          return item.violation_type || "";
        };
        const getBlockedDays = (item: any) => {
          if (!item.created_at || !item.vehicle_unblocked_date) return '';
        
          const createdAt = dayjs(item.created_at).startOf('day');
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

const excelRow: any = {
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
  'Instance ID':item.device_name||'',
  // 'Assigned to': Array.isArray(item.assigned_user_roles) && item.assigned_user_roles.length === 0
  //   ? '' : (item.assigned_user_roles || []).join(', '),
  // 'Escalated to': Array.isArray(item.last_escalated_to) && item.last_escalated_to.length === 0
  //   ? '' : (item.last_escalated_to || []).join(', '),
  'Created At': formatDateIST(item.created_at),
   'Creator ID': getCreatorId(item),  
 'Closed At': formatDateIST(item.closed_at || item.updated_at), 
    'Approver ID': getApproverId(item),
  'Vehicle Blocked End Date': formatDateIST(item.vehicle_blocked_end_date),
  'Vehicle Unblocked Date': formatDateIST(item.vehicle_unblocked_date),
   'No. of Days Blocked': getBlockedDays(item),
   // Calculate Action By based on mark_as_false and vehicle_unblocked_date
   'Action By': (() => {
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
   })(),
   'Action Type': getActionType(),
 'Category': getCategory(),
  'RCA Reason': getRCAReason(),
  'Justification Remark': getJustificationRemark(),
  'Approver Remark': getFinalRemark()
};

// Add Remarks only for LPG Packed
const isLPG = typeof query === 'string' && query.toLowerCase().includes('bu=\'lpg\'');
if (isLPG && ttType === 'packed') {
  excelRow['Remarks'] = 'Alert closed from Backend as per advise from LPG SBU HQO mail dtd Friday, July 3, 2026 1:11 PM';
}

return excelRow;
       
      });
const alertType =
query?.toLowerCase().includes("lpg") || data.some((d: any) => d.interlock_name?.toLowerCase().includes("lpg"))
? "LPG"
: "SOD";

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
     XLSX.utils.book_append_sheet(workbook, worksheet, `${alertType} Alerts`);


const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
const filename = `${alertType}_Alerts_${timestamp}.xlsx`;
     
      XLSX.writeFile(workbook, filename);

      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    } finally {
      setIsDownloading(false);
    }
  }, [query, debouncedSearchText, isVTSWithTAS, ttType]);

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);
  // Include mark_as_false and vehicle_unblocked_date fields for VTS closed alerts
  // action_by is calculated client-side based on these fields, not fetched from API
  const fields = useMemo(() => {
    const baseFields = [
    'unique_id', 'sap_id', 'vehicle_number', 'location_name', 'severity', 'interlock_name','closed_at',
    'created_at', 'updated_at', 'device_name', 'assigned_user_roles','load_type', 'last_escalated_to',
    'last_notified_to', 'equipment_name'
  ];
    
    // Add mark_as_false, vehicle_unblocked_date, and alert_history for VTS closed alerts
    return [...baseFields, 'mark_as_false', 'vehicle_unblocked_date', 'alert_history'];
  }, []);
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

  const handleLocationView = (sapId: string) => {
    navigate(`/location/${sapId}`);
  };
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
      hide: !selectedColumns.includes('last_escalated_to') || hiddenColumns.includes('assigned_user_roles')
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
    //   headerName: 'Notified to', 
    //   field: 'last_notified_to',
    //   sortable: true,
    //   filter: true,
    //   cellRenderer: (params: any) => {
    //     return Array.isArray(params.value) && params.value.length === 0 ? ',' : params.value;
    //   },
    //   hide: !selectedColumns.includes('last_notified_to')
    // },



    // Action By column for VTS closed alerts
    {
      headerName: 'Action By',
      field: 'action_by',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        const rowData = params.data;
        const markAsFalse = rowData?.mark_as_false;
        const vehicleUnblockedDate = rowData?.vehicle_unblocked_date;
        const interlockName = rowData?.interlock_name;

        // Check if interlock_name is "No vts No Load" (case insensitive)
        const isNoVtsNoLoad = interlockName && interlockName.toLowerCase() === 'no vts no load';
        
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
      hide: !selectedColumns.includes('action_by')
    },
    // Alert History column
    {
      headerName: 'Alert History',
      field: 'alert_history',
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const alertHistory = params.data?.alert_history;

        // Check if any action_type in alert_history is "UnBlocked"
        const hasUnBlockedAction = alertHistory && Array.isArray(alertHistory) &&
          alertHistory.some((history: any) => history.action_type === 'UnBlocked');

        if (hasUnBlockedAction) {
          return <span className="text-sm text-blue-600 font-medium">Auto Unblock</span>;
        }

        return '';
      },
      hide: !selectedColumns.includes('alert_history')
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
  ], [selectedColumns, handleViewHistory, hiddenColumns, handleLocationClick, isVTSWithTAS, ttType, query]);

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
            })} />          Refresh
        </Button>
      </div>

      <div ref={tableWrapRef} className="ag-grid-mirror-h-scroll-wrap relative [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        <style>{AG_GRID_MIRROR_SCROLL_CSS}</style>
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
    </div>
  );
};

export default VTSAlertsTableClosedTab;