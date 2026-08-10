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

interface ROAlertsTableV2Props {
  query?: string;
  selectedInterlock?: string | null;
  zone?: string | null;
  plant?: string | null;
  onLocationChange?: (locationId: string) => void;
onAlertStatusChange?: (status: "All" | "Open" | "Close") => void;
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

export const BCUAlertsTable: React.FC<ROAlertsTableV2Props> = ({ query, selectedInterlock, onLocationChange, zone, plant, onAlertStatusChange }) => {
  const [pageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name',
    'created_at', 'device_type', 'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'actions', 'alert_status', 'zone'
  ]);
  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(0);
  const gridApi = React.useRef<any>(null);
  const isFirstRender = React.useRef(true);
  const prevFilters = React.useRef({ query, selectedInterlock, zone, plant, debouncedSearchText });
const [alertStatusFilter, setAlertStatusFilter] = useState<"All" | "Open" | "Close">("All");

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);

const buildQueryWithFilters = useCallback((baseQuery: string) => {
  let completeQuery = baseQuery || '';

  // Add alert status filter - only add if not "All"
  if (alertStatusFilter && alertStatusFilter !== "All") {
    completeQuery += completeQuery ? ` AND alert_status='${alertStatusFilter}'` : `alert_status='${alertStatusFilter}'`;
  }

  // Only add zone/plant filters if they're not already in the base query
  if (zone && zone !== 'all' && !completeQuery.includes(`zone='${zone}'`)) {
    completeQuery += completeQuery ? ` AND zone='${zone}'` : `zone='${zone}'`;
  }

  if (plant && plant !== 'all' && !completeQuery.includes(`sap_id='${plant}'`)) {
    completeQuery += completeQuery ? ` AND sap_id='${plant}'` : `sap_id='${plant}'`;
  }

  return completeQuery;
}, [zone, plant, alertStatusFilter]);

const handleAlertStatusToggle = () => {
  setAlertStatusFilter(prev => {
    let newStatus: "All" | "Open" | "Close";
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
};

  const fields = ["created_at", "sap_id", "location_name", "zone", "alert_status", "device_type", "interlock_name", "device_name", "updated_at"];

  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {
    setIsLoading(true);
    try {
      // Calculate the current page based on startRow and pageSize
      const currentPageNumber = Math.floor(startRow / pageSize);

      // Build the complete query with filters
      const completeQuery = buildQueryWithFilters(query || '');

      const params: any = {
        q: completeQuery,
        skip: currentPageNumber,
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
    
  }, [query, debouncedSearchText, pageSize, buildQueryWithFilters]);
    console.log(query)

  // Function to fetch all data for export
  const fetchAllDataForExport = useCallback(async () => {
    try {
      const completeQuery = buildQueryWithFilters(query || '');

      const params: any = {
        q: completeQuery,
        skip: 0,
        limit: 10000, // Large number to get all data
        fields: JSON.stringify(fields),
        sort: JSON.stringify({ "created_at": "desc" })
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
  }, [query, debouncedSearchText, buildQueryWithFilters, fields]);

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
    const formattedDateTime = currentDateTime.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
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

    worksheetData.push([`BCU ALERTS REPORT - ${formattedDateForTitle} at ${formattedTimeForTitle}`]);
    worksheetData.push([]); // Empty row for spacing

    // Add generation info
    // worksheetData.push(['Report Generated On:', formattedDateTime]);
    worksheetData.push(['Total Records Exported:', allData.length]);
    worksheetData.push([]); // Empty row for spacing

    // Function to extract and format date range from query
    const extractDateRangeFromQuery = (queryString) => {
      if (!queryString) return null;
      
      try {
        // Specific pattern for your date format: created_at::DATE BETWEEN '2025-03-01' AND '2025-06-24'
        const betweenPattern = /created_at::DATE\s+BETWEEN\s+['"]([\d-]+)[']\s+AND\s+['"]([\d-]+)['"]|DATE\(created_at\)\s+BETWEEN\s+['"]([\d-]+)[']\s+AND\s+['"]([\d-]+)['"]|created_at\s+BETWEEN\s+['"]([\d-]+)[']\s+AND\s+['"]([\d-]+)['"]/gi;
        
        const match = betweenPattern.exec(queryString);
        
        if (match) {
          // Extract the dates from the match groups
          const startDate = match[1] || match[3] || match[5];
          const endDate = match[2] || match[4] || match[6];
          
          if (startDate && endDate) {
            const formatDate = (dateStr) => {
              try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
              } catch (e) {
                return dateStr;
              }
            };

            return `Alert Date: ${formatDate(startDate)} to ${formatDate(endDate)}`;
          }
        }
        
        // If no BETWEEN pattern found, you can add other specific patterns you use
        // For example, if you also use >= and <= patterns:
        const rangePattern = /created_at::DATE\s*>=\s*['"]([\d-]+)['"].*?created_at::DATE\s*<=\s*['"]([\d-]+)['"]|created_at::DATE\s*<=\s*['"]([\d-]+)['"].*?created_at::DATE\s*>=\s*['"]([\d-]+)['"]/gi;
        const rangeMatch = rangePattern.exec(queryString);
        
        if (rangeMatch) {
          const startDate = rangeMatch[1] || rangeMatch[4];
          const endDate = rangeMatch[2] || rangeMatch[3];
          
          if (startDate && endDate) {
            const formatDate = (dateStr) => {
              try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
              } catch (e) {
                return dateStr;
              }
            };

            return `Alert Date: ${formatDate(startDate)} to ${formatDate(endDate)}`;
          }
        }
        
      } catch (error) {
        console.error('Error parsing date range from query:', error);
      }

      return null;
    };

    // Function to extract plant information from query
    const extractPlantFromQuery = (queryString) => {
      if (!queryString) return null;
      
      try {
        
        // More comprehensive patterns for plant filtering in SQL queries
        const patterns = [
          // Basic equality
          /plant\s*=\s*['"]([^'"]+)['"]/gi,
          /location_name\s*=\s*['"]([^'"]+)['"]/gi,
          /sap_id\s*=\s*['"]([^'"]+)['"]/gi,
          
          // LIKE patterns
          /plant\s*LIKE\s*['"]([^'"]+)['"]/gi,
          /location_name\s*LIKE\s*['"]([^'"]+)['"]/gi,
          /sap_id\s*LIKE\s*['"]([^'"]+)['"]/gi,
          
          // ILIKE patterns (case insensitive)
          /plant\s*ILIKE\s*['"]([^'"]+)['"]/gi,
          /location_name\s*ILIKE\s*['"]([^'"]+)['"]/gi,
          /sap_id\s*ILIKE\s*['"]([^'"]+)['"]/gi,
          
          // Without quotes (in case of numeric values or identifiers)
          /plant\s*=\s*([^'\s\)]+)/gi,
          /location_name\s*=\s*([^'\s\)]+)/gi,
          /sap_id\s*=\s*([^'\s\)]+)/gi,
          
          // IN clause with single value
          /plant\s*IN\s*\(\s*['"]([^'"]+)['"]\s*\)/gi,
          /location_name\s*IN\s*\(\s*['"]([^'"]+)['"]\s*\)/gi,
          /sap_id\s*IN\s*\(\s*['"]([^'"]+)['"]\s*\)/gi,
          
          // Contains/search patterns
          /plant.*['"]([^'"]*[A-Za-z0-9][^'"]*)['"]/gi,
          /location.*['"]([^'"]*[A-Za-z0-9][^'"]*)['"]/gi
        ];
        
        for (const pattern of patterns) {
          // Reset regex lastIndex to avoid issues with global flag
          pattern.lastIndex = 0;
          const match = pattern.exec(queryString);
          if (match && match[1]) {
            const value = match[1].trim();
            // console.log('Found plant match:', value, 'with pattern:', pattern); // Debug log
            return value;
          }
        }
        
        // Handle multiple values in IN clause
        const multiValuePatterns = [
          /(?:plant|location_name|sap_id)\s*IN\s*\(\s*(['"][^'"]+['"](?:\s*,\s*['"][^'"]+['"])*)\s*\)/gi,
          /(?:plant|location_name|sap_id)\s*IN\s*\(\s*([^'")\s]+(?:\s*,\s*[^'")\s]+)*)\s*\)/gi
        ];
        
        for (const pattern of multiValuePatterns) {
          pattern.lastIndex = 0;
          const multiMatch = pattern.exec(queryString);
          if (multiMatch && multiMatch[1]) {
            // console.log('Found multi-value plant match:', multiMatch[1]); // Debug log
            
            // Try to extract quoted values first
            const quotedValues = multiMatch[1].match(/['"]([^'"]+)['"]/g);
            if (quotedValues && quotedValues.length > 0) {
              const cleanValues = quotedValues.map(v => v.replace(/['"]/g, ''));
              return cleanValues.join(', ');
            }
            
            // If no quotes, split by comma
            const unquotedValues = multiMatch[1].split(',').map(v => v.trim()).filter(v => v);
            if (unquotedValues.length > 0) {
              return unquotedValues.join(', ');
            }
          }
        }
        
        // console.log('No plant found in query'); // Debug log
        
      } catch (error) {
        console.error('Error parsing plant from query:', error);
      }

      return null;
    };

    // Function to extract zone information from query
    const extractZoneFromQuery = (queryString) => {
      if (!queryString) return null;
      
      try {
        // console.log('Parsing zone from query:', queryString); // Debug log
        
        // More comprehensive patterns for zone filtering in SQL queries
        const patterns = [
          // Basic equality
          /zone\s*=\s*['"]([^'"]+)['"]/gi,
          /zone\s*LIKE\s*['"]([^'"]+)['"]/gi,
          /zone\s*ILIKE\s*['"]([^'"]+)['"]/gi,
          
          // Without quotes
          /zone\s*=\s*([^'\s\)]+)/gi,
          
          // IN clause with single value
          /zone\s*IN\s*\(\s*['"]([^'"]+)['"]\s*\)/gi,
          
          // General zone patterns
          /zone.*['"]([^'"]*[A-Za-z0-9][^'"]*)['"]/gi
        ];
        
        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          const match = pattern.exec(queryString);
          if (match && match[1]) {
            const value = match[1].trim();
            // console.log('Found zone match:', value, 'with pattern:', pattern); // Debug log
            return value;
          }
        }
        
        // Handle multiple values in IN clause
        const multiValuePatterns = [
          /zone\s*IN\s*\(\s*(['"][^'"]+['"](?:\s*,\s*['"][^'"]+['"])*)\s*\)/gi,
          /zone\s*IN\s*\(\s*([^'")\s]+(?:\s*,\s*[^'")\s]+)*)\s*\)/gi
        ];
        
        for (const pattern of multiValuePatterns) {
          pattern.lastIndex = 0;
          const multiMatch = pattern.exec(queryString);
          if (multiMatch && multiMatch[1]) {
            // console.log('Found multi-value zone match:', multiMatch[1]); // Debug log
            
            // Try to extract quoted values first
            const quotedValues = multiMatch[1].match(/['"]([^'"]+)['"]/g);
            if (quotedValues && quotedValues.length > 0) {
              const cleanValues = quotedValues.map(v => v.replace(/['"]/g, ''));
              return cleanValues.join(', ');
            }
            
            // If no quotes, split by comma
            const unquotedValues = multiMatch[1].split(',').map(v => v.trim()).filter(v => v);
            if (unquotedValues.length > 0) {
              return unquotedValues.join(', ');
            }
          }
        }
        
        // console.log('No zone found in query'); // Debug log
        
      } catch (error) {
        console.error('Error parsing zone from query:', error);
      }

      return null;
    };

    // Add applied filters section
    // worksheetData.push(['APPLIED FILTERS:']);
    
    // Build filter display
    const appliedFilters = [];
    
    // Extract and add date range from query
    const completeQuery = buildQueryWithFilters(query || '');
    const dateRangeInfo = extractDateRangeFromQuery(completeQuery);
    if (dateRangeInfo) {
      appliedFilters.push(dateRangeInfo);
    }
    
    // Extract plant and zone from query (prioritize query values over filter variables)
    const queryPlant = extractPlantFromQuery(completeQuery);
    const queryZone = extractZoneFromQuery(completeQuery);
    
    if (alertStatusFilter) {
      appliedFilters.push(`Alert Status: ${alertStatusFilter}`);
    }
    
    // Use query-extracted zone first, then fall back to zone variable
    if (queryZone) {
      appliedFilters.push(`Zone: ${queryZone}`);
    } else if (zone && zone !== 'all') {
      appliedFilters.push(`Zone: ${zone}`);
    }
    
    // Use query-extracted plant first, then fall back to plant variable
    if (queryPlant) {
      appliedFilters.push(`Plant: ${queryPlant}`);
    } else if (plant && plant !== 'all') {
      appliedFilters.push(`Plant: ${plant}`);
    }
    
    if (selectedInterlock) {
      appliedFilters.push(`Interlock: ${selectedInterlock}`);
    }
    
    if (debouncedSearchText.trim()) {
      appliedFilters.push(`Search Text: ${debouncedSearchText}`);
    }
    
    // Add custom query info if present and no specific filters were extracted
    // if (query && !dateRangeInfo && !queryPlant && !queryZone) {
    //   appliedFilters.push(`Custom Query: ${query}`);
    // }

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
      row.device_type || '',
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

    // Style the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Define styles for different sections
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell) {
          // Main heading style (row 0)
          if (row === 0) {
            cell.s = {
              font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "2563EB" } }, // Blue background
              alignment: { horizontal: "center", vertical: "center" }
            };
          }
          // Generation info styling - make timestamp info more prominent
          else if (row === 2 || row === 3 || row === 4 || row === 6) {
            cell.s = {
              font: { bold: true, size: 11 },
              fill: { fgColor: { rgb: "F3F4F6" } } // Light gray background
            };
          }
          // Filter section styling
          else if (row === worksheetData.findIndex(rowData => 
            Array.isArray(rowData) && rowData[0] === 'APPLIED FILTERS:'
          )) {
            cell.s = {
              font: { bold: true, size: 12 },
              fill: { fgColor: { rgb: "EFF6FF" } } // Light blue background
            };
          }
          // Individual filter rows styling (including date range, plant, and zone)
          else if (row > worksheetData.findIndex(rowData => 
            Array.isArray(rowData) && rowData[0] === 'APPLIED FILTERS:'
          ) && row < worksheetData.findIndex(rowData => 
            Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
          ) && worksheetData[row] && worksheetData[row][0] && worksheetData[row][0] !== '') {
            cell.s = {
              font: { size: 10 },
              fill: { fgColor: { rgb: "F9FAFB" } }, // Very light gray background
              alignment: { horizontal: "left", vertical: "center" }
            };
          }
          // Data headers styling
          else if (row === worksheetData.findIndex(rowData => 
            Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
          )) {
            cell.s = {
              font: { bold: true, size: 11, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "374151" } }, // Dark gray background
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
    const headerRowIndex = worksheetData.findIndex(rowData => 
      Array.isArray(rowData) && rowData[0] === 'Date Time Stamp'
    );
    
    if (headerRowIndex !== -1) {
      const columnWidths = headers.map((header, index) => {
        let width = Math.max(header.length, 12); // Minimum width
        
        // Adjust width based on content type
        switch (header) {
          case 'Date Time Stamp':
          case 'Alert Closed Time':
            width = 18;
            break;
          case 'Location':
          case 'Alarm Name':
            width = 25;
            break;
          case 'Equipment ID':
            width = 20;
            break;
          case 'Location ID':
            width = 12;
            break;
          default:
            width = 15;
        }
        
        return { wch: width };
      });
      
      worksheet['!cols'] = columnWidths;
    }

    // Merge cells for the main heading
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }
    ];

    // Set row heights
    worksheet['!rows'] = [
      { hpt: 25 }, // Main heading row height
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BCU Alerts');

    // Generate filename with detailed timestamp
    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds and replace colons/periods
    const filename = `BCU_Alerts_Report_${fileTimestamp}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);

    toast.success(`Successfully exported ${allData.length} alerts to ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    toast.error('Failed to export data to Excel. Please try again.');
  } finally {
    setIsDownloading(false);
  }
}, [fetchAllDataForExport, alertStatusFilter, zone, plant, selectedInterlock, debouncedSearchText, query, buildQueryWithFilters]);
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

  // Check if filters have changed
  const haveFiltersChanged = () => {
    const currentFilters = { query, selectedInterlock, zone, plant, debouncedSearchText };
    const prev = prevFilters.current;

    if (prev.query !== currentFilters.query ||
      prev.selectedInterlock !== currentFilters.selectedInterlock ||
      prev.zone !== currentFilters.zone ||
      prev.plant !== currentFilters.plant ||
      prev.debouncedSearchText !== currentFilters.debouncedSearchText) {
      prevFilters.current = currentFilters;
      return true;
    }
    return false;
  };

  // Handle filter changes
  useEffect(() => {
    // Skip first render to avoid duplicate initial data fetch
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (haveFiltersChanged() && gridApi.current) {
      console.log("Filters changed, refreshing data");
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0);
    }
  }, [query, selectedInterlock, zone, plant, debouncedSearchText]);

  // Manual refresh
  useEffect(() => {
    if (manualRefresh > 0 && gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0);
    }
  }, [manualRefresh]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const handleRefresh = useCallback(() => {
    setManualRefresh(prev => prev + 1);
    setSearchText('');
  }, []);

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
  headerName: 'Date Time Stamp',
  field: 'created_at',
  sortable: true,
  filter: true,
  minWidth: 150,
  hide: !selectedColumns.includes('created_at'),
  cellRenderer: (params: any) => {
    if (!params.value) return '-';
    try {
      const utcDate = new Date(params.value);

      // Local display
      const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);

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
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }
},
    {
      headerName: 'Location ID',
      field: 'sap_id',
      sortable: true,
      minWidth: 100,
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
      headerName: 'Location',
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
      headerName: 'Zone',
      field: 'zone',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('zone')
    },
    {
      headerName: 'Alert Status',
      field: 'alert_status',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('alert_status')
    },
    {
      headerName: 'System',
      field: 'device_type',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('device_type'),
    },
    {
      headerName: 'Alarm Name',
      field: 'interlock_name',
      minWidth: 155,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span className={`text-sm ${params.value === selectedInterlock ? 'text-blue-600 font-medium px-2 py-1 rounded' : ''}`}>
          {params.value}</span>
      ),
      hide: !selectedColumns.includes('interlock_name')
    },
    {
      headerName: 'Equipment ID',
      field: 'device_name',
      minWidth: 180,
      sortable: true,
      filter: true,
      valueFormatter: (params) => params.value?.split('@')[0] || '',
      hide: !selectedColumns.includes('device_name')
    },
    {
      headerName: 'Alert Closed Time',
      field: 'updated_at',
      sortable: true,
      filter: true,
  cellRenderer: (params: any) => {
    if (!params.value) return '-';
    try {
      const utcDate = new Date(params.value);

      // Local display
      const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);

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
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }
    },
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
  ], [selectedColumns, handleViewHistory, handleLocationClick, selectedInterlock]);

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

{/* <div className="flex items-center space-x-2">

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
    className={`relative inline-flex h-5 w-12 items-center rounded-full transition-colors duration-300 ease-in-out ${
      alertStatusFilter === "All"
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
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${
        alertStatusFilter === "All"
          ? "translate-x-1"
          : alertStatusFilter === "Open"
          ? "translate-x-4"
          : "translate-x-7"
      }`}
    />
  </button>
</div> */}


          <Button
  className="text-white text-xs p-1 w-7 h-7 rounded-sm bg-green-600 hover:bg-green-700 disabled:opacity-50"
            // disabled={true}
            variant="outline"
            size="sm"
            onClick={handleExcelExport}
          disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader className="mr-0 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-0 h-4 w-4" />
            )}
            {/* {isDownloading ? 'Exporting...' : 'Export Excel'} */}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>

      </div>

      {/* Active filters indicator */}
      {/* {(selectedInterlock || zone || plant) && (
        <div className="flex items-center gap-2 mb-2 py-1 px-2 bg-gray-50 rounded-md text-sm">
          <span className="font-medium">Active filters:</span>
          {selectedInterlock && (
            <Badge variant="outline" className="bg-blue-50">
              Alarm: {selectedInterlock}
            </Badge>
          )}
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
        </div>
      )} */}

      {/* Loading overlay */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <Loader className="h-8 w-8 text-blue-600 animate-spin" />
              <span className="mt-2 text-sm text-gray-600">Loading data...</span>
            </div>
          </div>
        )}

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
              suppressMenu: true
            }}
          />
        </div>
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

export default BCUAlertsTable;