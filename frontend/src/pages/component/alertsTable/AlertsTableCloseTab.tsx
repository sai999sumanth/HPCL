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
import { useInFlightLoading } from '@/hooks/useInFlightLoading';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string, zone?: string) => void;
  hiddenColumns?: string[]; // Add this new prop
  alertSection?: string | null;
  fieldsFor?: string;
  /** LPG Home closed alerts — show Assigned to for PQ, VA, VTS Bulk, VTS Packed */
  showAssignmentColumns?: boolean;
  onRefresh?: () => void;
  useCreatedAtForCreatedAtColumn?: boolean;
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

function getAlertSectionFromQuery(query?: string): string | null {
  if (!query || typeof query !== 'string') return null;
  const match = query.match(/alert_section\s*=\s*'([^']+)'/i);
  return match?.[1] ?? null;
}

function getBuFromQuery(query?: string): string | null {
  if (!query || typeof query !== 'string') return null;
  const match = query.match(/bu\s*=\s*'([^']+)'/i);
  return match?.[1]?.toUpperCase() ?? null;
}

const VA_HOME_CLOSED_BUS = new Set(['RO', 'TAS', 'LPG']);

function isVAClosedAlertsQuery(query?: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const normalizedQuery = query.trim();

  if (!/alert_status\s*=\s*'Close'/i.test(normalizedQuery)) {
    return false;
  }

  if (getAlertSectionFromQuery(query)?.toUpperCase() !== 'VA') {
    return false;
  }

  const bu = getBuFromQuery(query);

  // VA Home closed alerts — RO, SOD (TAS), and LPG cards
  if (/^alert_section\s*=\s*'VA'/i.test(normalizedQuery)) {
    if (bu && !VA_HOME_CLOSED_BUS.has(bu)) return false;
    return true;
  }

  // LPG Home VA plant tab closed alerts
  if (/^alert_status\s*=/i.test(normalizedQuery) && bu === 'LPG') {
    return true;
  }

  return false;
}

function isVAHomeOnlyClosedAlertsQuery(query?: string): boolean {
  if (!query || typeof query !== 'string') return false;
  return /^alert_section\s*=\s*'VA'/i.test(query.trim()) && isVAClosedAlertsQuery(query);
}

function getVAExcelActionBy(alertHistory: unknown): string {
  const history = normalizeAlertHistory(alertHistory);
  const reversed = [...history].reverse();
  const acceptClose = reversed.find((h) => h?.action_type === 'AcceptClose');
  if (acceptClose?.employee_id != null) return String(acceptClose.employee_id);
  const falseAlert = reversed.find((h) => h?.action_type === 'FalseAlert');
  if (falseAlert?.employee_id != null) return String(falseAlert.employee_id);
  const approved = reversed.find((h) => h?.action_type === 'Approved');
  return approved?.employee_id != null ? String(approved.employee_id) : '';
}

function getVAHomeExcelRemarks(alertHistory: unknown): string {
  const existing = getVAClosedAlertHistoryEntry(alertHistory)?.action_msg || '';
  if (existing) return existing;
  const history = normalizeAlertHistory(alertHistory);
  const approved = [...history].reverse().find((h) => h?.action_type === 'Approved');
  return approved?.action_msg ? stripHtml(approved.action_msg) : '';
}

function getClosedAlertsExcelFilename(query?: string): string {
  const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');

  if (!isVAClosedAlertsQuery(query)) {
    return `SOD_Alerts_${timestamp}.xlsx`;
  }

  const bu = getBuFromQuery(query);
  const buLabel =
    bu === 'LPG' ? 'LPG' :
    bu === 'TAS' ? 'SOD' :
    bu === 'RO' ? 'RO' :
    null;

  return buLabel
    ? `VA_${buLabel}_Closed_Alerts_${timestamp}.xlsx`
    : `VA_Closed_Alerts_${timestamp}.xlsx`;
}

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


export const AlertsTableClosedTab: React.FC<ROAlertsTableV2Props> = ({
  query,
  onLocationChange,
  hiddenColumns = [],
  alertSection,
  fieldsFor,
  showAssignmentColumns,
  useCreatedAtForCreatedAtColumn = false,
  ttType,
}) => {
  // Determine if VTS section is active
  const isVTSSection = alertSection === 'VTS';

  /** LPG Home → Closed Alerts tab only (PQ, VA, VTS Bulk, VTS Packed). */
  const showLpgHomeClosedAlertsAssignmentColumns =
    Boolean(showAssignmentColumns) &&
    fieldsFor === 'LPG' &&
    (alertSection === 'LPG' ||
      alertSection === 'VA' ||
      alertSection === 'VTS' ||
      alertSection === null);

  const [pageSize] = useState<number>(20);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name','closed_at',
    'updated_at', 'created_at', 'device_type', 'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'actions', 'zone', 'vehicle_number', 'action_by', 'mark_as_false', 'alert_section', 'equipment_name'
  ]);
  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null
  });
  const navigate = useNavigate();
  const { isLoading, begin: beginLoad, end: endLoad } = useInFlightLoading();
  const gridApi = React.useRef<any>(null);

const isVASection = isVAClosedAlertsQuery(query);

const downloadExcel = useCallback(async () => {
  setIsDownloading(true);

  try {
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
      params.fields = JSON.stringify([
        "sap_id", "location_name", "region", "interlock_name", "unique_id", "updated_at", "created_at", "severity","closed_at",
        "device_type", "device_name", "assigned_user_roles", "last_escalated_to", "last_notified_to", "zone", "vehicle_number", "equipment_name", "alert_section",
        "alert_history", "mark_as_false",
      ]);
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
  if (!item.created_at || !item.vehicle_unblocked_date) return '';

  const createdAt = dayjs(item.created_at).startOf('day');
  const unblockedAt = dayjs(item.vehicle_unblocked_date).startOf('day');

  if (!createdAt.isValid() || !unblockedAt.isValid()) return '';

  return Math.abs(unblockedAt.diff(createdAt, 'day'));
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
        'Closed At': formatDateIST(item.closed_at || item.updated_at),
       
      };

      // Add VA closed-alert fields for Excel download
      if (isVASection) {
        baseRow['Marked as False'] = formatMarkAsFalseValue(item.mark_as_false);

        if (isVAHomeOnlyClosedAlertsQuery(query)) {
          baseRow['Remarks'] = getVAHomeExcelRemarks(item.alert_history);
          baseRow['Action By'] = getVAExcelActionBy(item.alert_history);
        } else {
          const historyEntry = getVAClosedAlertHistoryEntry(item.alert_history);
          baseRow['Remarks'] = historyEntry?.action_msg || '';
        }
      }

    
if (isVTSSection) {
        const vtsRow: any = {
             'TT Number': item.vehicle_number || '',
              'Alert Status': item.alert_status || '',
               'Creator ID': getCreatorId(item),   
    'Approver ID': getApproverId(item),
                'Vehicle Blocked End Date': formatDateIST(item.vehicle_blocked_end_date),
  'Vehicle Unblocked Date': formatDateIST(item.vehicle_unblocked_date),
 'No. of Days Blocked': getBlockedDays(item),
         
          'Action Type': getActionType(),
          'Category': getCategory(),
          'RCA Reason': getRCAReason(),
          'Justification Remark': getJustificationRemark(),
          'Approver Remark': getFinalRemark(),
        };
        
        // Add Remarks only for VTS Packed
        if (ttType === 'packed') {
          vtsRow['Remarks'] = 'Alert closed from Backend as per advise from LPG SBU HQO mail dtd Friday, July 3, 2026 1:11 PM';
        }
        
        Object.assign(baseRow, vtsRow);
      }

      return baseRow;
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet['!cols'] = Object.keys(excelData[0] || {}).map(key => ({
      wch: Math.max(
        key.length,
        ...excelData.map(row => String(row[key] || '').length)
      ),
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerts');

    const filename = getClosedAlertsExcelFilename(query);
    XLSX.writeFile(workbook, filename);

    toast.success(`Excel file downloaded: ${filename}`);
  } catch (error) {
    console.error('Error downloading Excel:', error);
    toast.error('Failed to download Excel file');
  } finally {
    setIsDownloading(false);
  }
}, [query, debouncedSearchText, isVTSSection, isVASection, ttType]);


//   setIsDownloading(true);

//   try {
//     const params: any = {
//       q: query,
//       skip: 0,
//       limit: 10000,
//       sort: JSON.stringify({ created_at: 'desc' }),
//     };

//     if (debouncedSearchText.trim()) {
//       params.search_text = debouncedSearchText;
//     }

//     const response = await apiClient.get('/api/alerts', { params });
//     const data = response.data.data || [];

//     const excelData = data.map((item: any) => {
    
//       const formatDate = (dateStr?: string) => {
//         if (!dateStr) return '';
//         try {
//           return dayjs(dateStr).format('MMM D, YYYY, hh:mm A');
//         } catch {
//           return '';
//         }
//       };

//   const getActionType = () => {
//         if (!item.alert_history || !Array.isArray(item.alert_history)) return '';

//         const hasExplicitUnBlocked = item.alert_history.some(
//           (h) => h.action_type === 'UnBlocked'
//         );

//         if (hasExplicitUnBlocked) {
//           return 'UnBlock';
//         }

//         const hasJustificationUnBlocked = item.alert_history.some(
//           (h) =>
//             h.action_type === 'Justification' &&
//             h.rca_reason &&
//             h.category
//         );

//         if (hasJustificationUnBlocked) {
//           return 'UnBlock';
//         }

//         const hasAcceptClose = item.alert_history.some(
//           (h) => h.action_type === 'AcceptClose'
//         );

//         if (hasAcceptClose) {
//           return 'Accept & Block';
//         }

//         return '';
//       };

//       const getLastJustification = () => {
//         if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
//         return [...item.alert_history]
//           .reverse()
//           .find(h => h.action_type === 'Justification');
//       };

//       const getLastApproved = () => {
//         if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
//         return [...item.alert_history]
//           .reverse()
//           .find(h => h.action_type === 'Approved');
//       };

//       const getLastRejected = () => {
//         if (!item.alert_history || !Array.isArray(item.alert_history)) return null;
//         return [...item.alert_history]
//           .reverse()
//           .find(h => h.action_type === 'Rejected');
//       };

//       const extractBeforeInitiated = (msg?: string) => {
//         if (!msg) return '';
//         const keyword = 'initiated';
//         if (msg.toLowerCase().includes(keyword)) {
//           return msg.split(new RegExp(keyword, 'i'))[0].trim();
//         }
//         return msg.split('.')[0] + '.';
//       };

//       const getJustificationRemark = () => {
//         const lastJustification = getLastJustification();
//         return extractBeforeInitiated(lastJustification?.action_msg);
//       };

//       const getFinalRemark = () => {
//         const lastApproved = getLastApproved();
//         const lastRejected = getLastRejected();

//         if (lastApproved?.action_msg) {
//           return extractBeforeInitiated(lastApproved.action_msg);
//         }

//         if (lastRejected?.action_msg) {
//           return extractBeforeInitiated(lastRejected.action_msg);
//         }

//         return '';
//       };

//       const getCategory = () => {
//         const lastJustification = getLastJustification();
//         return lastJustification?.category || '';
//       };

//       const getRCAReason = () => {
//         const lastJustification = getLastJustification();
//         return lastJustification?.rca_reason || '';
//       };

// const getBlockedDays = (item: any) => {
//   if (!item.created_at || !item.vehicle_unblocked_date) return '';

//   const createdAt = dayjs(item.created_at).startOf('day');
//   const unblockedAt = dayjs(item.vehicle_unblocked_date).startOf('day');

//   if (!createdAt.isValid() || !unblockedAt.isValid()) return '';

//   return Math.abs(unblockedAt.diff(createdAt, 'day'));
// };
// const getCreatorId = (item: any) => {
//   if (!Array.isArray(item.alert_history)) return '';

//   const justification = [...item.alert_history]
//     .reverse()
//     .find((h) => h.action_type === 'Justification');

//   return justification?.employee_id || '';
// };

// const getApproverId = (item: any) => {
//   if (!Array.isArray(item.alert_history)) return '';

//   const approved = [...item.alert_history]
//     .reverse()
//     .find((h) => h.action_type === 'Approved');

//   return approved?.employee_id || '';
// };



//       const baseRow: any = {
//          'Alert ID': item.unique_id || '',
//         'Location ID': item.sap_id || '',
//         'Location Name': item.location_name || '',
//         'Region': item.region || '',
//         'Zone': item.zone || '',
      
//         'Alert': item.interlock_name || '',
//         'Severity': item.severity || '',
//        // 'Equipment Type': item.device_type || '',
//         [isVTSSection ? 'Instance ID' : 'Equipment ID']:
//           item.device_name?.split('@')[0] || '',
//         'Assigned to': Array.isArray(item.assigned_user_roles)
//           ? item.assigned_user_roles.join(', ')
//           : '',
//         'Escalated to': Array.isArray(item.last_escalated_to)
//           ? item.last_escalated_to.join(', ')
//           : '',
//         'Created At': formatDate(item.created_at),
       
//       };

    
//       if (isVTSSection) {
//         Object.assign(baseRow, {
//              'TT Number': item.vehicle_number || '',
//               'Alert Status': item.alert_status || '',
//                'Creator ID': getCreatorId(item),   
//     'Approver ID': getApproverId(item),
//                 'Vehicle Blocked End Date': formatDate(item.vehicle_blocked_end_date),
//   'Vehicle Unblocked Date': formatDate(item.vehicle_unblocked_date),
//  'No. of Days Blocked': getBlockedDays(item),
//           'Action Type': getActionType(),
//           'Category': getCategory(),
//           'RCA Reason': getRCAReason(),
//           'Justification Remark': getJustificationRemark(),
//           'Approver Remark': getFinalRemark(),
//         });
//       }

//       return baseRow;
//     });

//     const workbook = XLSX.utils.book_new();
//     const worksheet = XLSX.utils.json_to_sheet(excelData);

//     worksheet['!cols'] = Object.keys(excelData[0] || {}).map(key => ({
//       wch: Math.max(
//         key.length,
//         ...excelData.map(row => String(row[key] || '').length)
//       ),
//     }));

//     XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerts');

//     const filename = `SOD_Alerts_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
//     XLSX.writeFile(workbook, filename);

//     toast.success(`Excel file downloaded: ${filename}`);
//   } catch (error) {
//     console.error('Error downloading Excel:', error);
//     toast.error('Failed to download Excel file');
//   } finally {
//     setIsDownloading(false);
//   }
// }, [query, debouncedSearchText, isVTSSection]);

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);

  // Conditionally include mark_as_false and vehicle_unblocked_date fields for VTS section in closed alerts
  const fields = useMemo(() => {
    const baseFields = [
    "sap_id", "location_name", "region", "interlock_name", "unique_id", "updated_at", "created_at", "severity","closed_at",
    "device_type", "device_name", "assigned_user_roles", "last_escalated_to", "last_notified_to", "zone", "vehicle_number", "equipment_name","alert_section"
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
  }, [query, debouncedSearchText, pageSize, fields, beginLoad, endLoad]);

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
  }, []);

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

  // Update handleRefresh to clear both selections
  const handleRefresh = useCallback(() => {
    // Clear the search text
    setSearchText('');

    // Clear both selections
    setSelectedSapId(null);
    setSelectedZone(null);

    // If onLocationChange is provided, call it with empty values to indicate deselection
    if (onLocationChange) {
      onLocationChange('', '');
    }

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


          const utcDate = new Date(dateValue);
          const localDate = convertUTCDateToLocalDate(utcDate);

          const formattedDateTime = localDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          const relativeTime = formatRelativeTime(dateValue);

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
          let date;
          if (useCreatedAtForCreatedAtColumn) {
            // Convert created_at (UTC) to IST
            date = dayjs.utc(params.value).tz('Asia/Kolkata');
          } else {
            const utcDate = new Date(params.value);
            date = dayjs(convertUTCDateToLocalDate(utcDate));
          }

          const formattedDateTime = date.format('MMM D, YYYY, hh:mm A');
          const relativeTime = date.fromNow();

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
      minWidth: 150, 
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
      headerName: isVTSSection ? 'Instance ID' : 'Equipment ID',
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
      hide: showLpgHomeClosedAlertsAssignmentColumns
        ? !selectedColumns.includes('assigned_user_roles')
        : !selectedColumns.includes('assigned_user_roles') || hiddenColumns.includes('assigned_user_roles')
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
      hide: isVTSSection || !selectedColumns.includes('device_type')
    },
    


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
  ], [selectedColumns, handleViewHistory, hiddenColumns, isVTSSection, isVASection, alertSection, showLpgHomeClosedAlertsAssignmentColumns, ttType]);

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

export default AlertsTableClosedTab;