import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '../../../@/components/ui/button';
import { Input } from '../../../@/components/ui/input';
import {
  RefreshCw,
  Loader,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);
import DataGrid from '../../../components/common/DataGrid';
import { toast } from 'sonner';
import { apiClient } from '@/services/apiClient';

interface HQOBlockedVehiclesTableProps {
  alertStatus?: string;
  timeFilter?: string | null;
  dateRangeFilter?: any | null;
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

export const HQOBlockedVehiclesTable: React.FC<HQOBlockedVehiclesTableProps> = ({
  alertStatus = "Open",
  timeFilter,
  dateRangeFilter
}) => {
  const [pageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [alertStatusFilter, setAlertStatusFilter] = useState<"Open" | "Close">("Open");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const gridApi = React.useRef<any>(null);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const [allData, setAllData] = useState<any[]>([]);
  const [rotating, setRotating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFirstDataRef = useRef<boolean>(false);
  const pendingChunksRef = useRef<any[]>([]);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get date range based on timeFilter or dateRangeFilter
  const getDateRange = useCallback((): { start_date: string; end_date: string } => {
    const now = new Date();

    if (dateRangeFilter && dateRangeFilter.value) {
      const [startDate, endDate] = dateRangeFilter.value.split(',');
      return {
        start_date: startDate.trim(),
        end_date: endDate.trim()
      };
    }

    // Default to today if no filter
    const today = formatDate(now);

    if (timeFilter) {
      switch (timeFilter) {
        case 't':
          return { start_date: today, end_date: today };
        case '1d': {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = formatDate(yesterday);
          return { start_date: yesterdayStr, end_date: yesterdayStr };
        }
        case '1w': {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return { start_date: formatDate(weekAgo), end_date: today };
        }
        case '15d': {
          const fifteenDaysAgo = new Date(now);
          fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
          return { start_date: formatDate(fifteenDaysAgo), end_date: today };
        }
        case '1m': {
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return { start_date: formatDate(monthAgo), end_date: today };
        }
        case '3m': {
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          return { start_date: formatDate(threeMonthsAgo), end_date: today };
        }
        default:
          return { start_date: today, end_date: today };
      }
    }

    return { start_date: today, end_date: today };
  }, [timeFilter, dateRangeFilter]);


  // Generate column definitions from data
  const generateColumnDefs = useCallback((sampleData: any[]) => {
    if (!sampleData || sampleData.length === 0) return [];

    const firstRow = sampleData[0];
    const columns = Object.keys(firstRow).map((key) => {
      // Format header name (convert snake_case to Title Case)
      const headerName = key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      if (key === 'created_at') {
        return {
          headerName,
          field: key,
          sortable: true,
          resizable: true,
          filter: false,
          minWidth: 180,
          flex: 1,
          cellRenderer: (params: any) => {
            if (!params.value) return '';
            const date = dayjs.utc(params.value).tz('Asia/Kolkata');
            // const relative = date.fromNow();
            const formatted = date.format("MMM D, YYYY, hh:mm A");
            return (
              <div className="flex flex-col">
                {/* <span className="text-sm text-gray-900">{relative}</span> */}
                <span className="text-xs">{formatted}</span>
              </div>
            );
          }
        };
      }

      return {
        headerName,
        field: key,
        sortable: true,
        resizable: true,
        filter: false,
        minWidth: 100,
        flex: 1,
      };
    });

    return columns;
  }, []);

  // Helper function to extract complete JSON objects from a string
  const extractCompleteJSON = (text: string): { parsed: any[], remaining: string } => {
    const results: any[] = [];
    let remaining = text;
    let startIndex = 0;

    while (startIndex < remaining.length) {
      // Skip whitespace
      while (startIndex < remaining.length && /\s/.test(remaining[startIndex])) {
        startIndex++;
      }
      if (startIndex >= remaining.length) break;

      // Find the start of a JSON object/array
      const char = remaining[startIndex];
      if (char !== '{' && char !== '[') {
        // Not a JSON start, skip this character
        startIndex++;
        continue;
      }

      // Find the matching closing brace/bracket
      let depth = 0;
      let inString = false;
      let escapeNext = false;
      let endIndex = startIndex;

      for (let i = startIndex; i < remaining.length; i++) {
        const c = remaining[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (c === '\\') {
          escapeNext = true;
          continue;
        }

        if (c === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (c === '{' || c === '[') {
            depth++;
          } else if (c === '}' || c === ']') {
            depth--;
            if (depth === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
      }

      // If we found a complete JSON object
      if (depth === 0 && endIndex > startIndex) {
        try {
          const jsonStr = remaining.substring(startIndex, endIndex).trim();
          if (jsonStr) {
            const parsed = JSON.parse(jsonStr);
            results.push(parsed);
          }
          remaining = remaining.substring(endIndex);
          startIndex = 0;
        } catch (parseError) {
          // If parsing fails, this might be incomplete JSON
          // Keep it in the buffer for the next chunk
          break;
        }
      } else {
        // Incomplete JSON, keep it in buffer
        break;
      }
    }

    return { parsed: results, remaining };
  };

  // Fetch all data using streaming
  const fetchAllData = useCallback(async () => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setIsStreaming(true);
    setAllData([]); // Clear previous data
    hasFirstDataRef.current = false; // Reset first data flag
    pendingChunksRef.current = []; // Clear pending chunks
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }

    try {
      const dateRange = getDateRange();

      const payload = {
        alert_status: alertStatusFilter,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date
      };

      // Use postStream for streaming support - the API returns streaming data
      const res = await apiClient.postStream('/api/alerts/hqo_blocked_vehicles', payload);
      console.log('Streaming response received for HQO Blocked Vehicles - processing streaming data');

      const reader = res.data.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            // Try to extract complete JSON from final buffer
            const { parsed } = extractCompleteJSON(buffer);
            for (const item of parsed) {
              let dataToAdd: any[] = [];

              if (Array.isArray(item)) {
                dataToAdd = item;
              } else if (item && typeof item === 'object') {
                // Check if item has a data property with array
                if (Array.isArray(item.data)) {
                  dataToAdd = item.data;
                } else if (Array.isArray(item.payload)) {
                  dataToAdd = item.payload;
                } else if (Array.isArray(item.result)) {
                  dataToAdd = item.result;
                } else if (Array.isArray(item.rows)) {
                  dataToAdd = item.rows;
                } else {
                  dataToAdd = [item];
                }
              }

              if (dataToAdd.length > 0) {
                if (!hasFirstDataRef.current) {
                  hasFirstDataRef.current = true;
                  // Generate columns from first row
                  const cols = generateColumnDefs(dataToAdd);
                  setColumnDefs(cols);
                  flushSync(() => {
                    setAllData(dataToAdd);
                    setIsLoading(false);
                  });
                } else {
                  // Add to pending chunks for batched update
                  pendingChunksRef.current.push(...dataToAdd);
                }
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Extract complete JSON objects from buffer
        const { parsed, remaining } = extractCompleteJSON(buffer);
        buffer = remaining; // Keep incomplete JSON in buffer

        // Process parsed JSON objects
        for (const item of parsed) {
          try {
            let dataToAdd: any[] = [];

            if (Array.isArray(item)) {
              dataToAdd = item;
            } else if (item && typeof item === 'object') {
              // Check if item has a data property with array
              if (Array.isArray(item.data)) {
                dataToAdd = item.data;
              } else if (Array.isArray(item.payload)) {
                dataToAdd = item.payload;
              } else if (Array.isArray(item.result)) {
                dataToAdd = item.result;
              } else if (Array.isArray(item.rows)) {
                dataToAdd = item.rows;
              } else {
                // Single object, add it
                dataToAdd = [item];
              }
            }

            if (dataToAdd.length > 0) {
              // First chunk - display immediately
              if (!hasFirstDataRef.current) {
                hasFirstDataRef.current = true;
                console.log("🚀 FIRST CHUNK - Displaying immediately:", dataToAdd.length, "rows");
                // Generate columns from first row
                const cols = generateColumnDefs(dataToAdd);
                setColumnDefs(cols);
                // Use flushSync to force immediate render for first chunk
                flushSync(() => {
                  setAllData(dataToAdd);
                  setIsLoading(false); // Stop loading spinner so table can render immediately
                });
                console.log("✅ FIRST CHUNK now visible in table");
              } else {
                // Subsequent chunks - batch updates to avoid disrupting table
                pendingChunksRef.current.push(...dataToAdd);

                // Clear existing timer
                if (updateTimerRef.current) {
                  clearTimeout(updateTimerRef.current);
                }

                // Batch update: wait a bit to accumulate chunks, then update
                updateTimerRef.current = setTimeout(() => {
                  if (pendingChunksRef.current.length > 0) {
                    const chunksToAdd = [...pendingChunksRef.current];
                    pendingChunksRef.current = []; // Clear pending

                    // Use React's automatic batching - update without flushSync to avoid blocking
                    setAllData((prevData) => {
                      const newData = [...prevData, ...chunksToAdd];
                      console.log(`📦 Added ${chunksToAdd.length} rows (total: ${newData.length})`);
                      return newData;
                    });
                  }
                  updateTimerRef.current = null;
                }, 100); // Batch updates every 100ms
              }
            }
          } catch (error) {
            console.error("Error processing parsed item:", error, item);
          }
        }
      }

      // Process any remaining pending chunks before finishing
      if (pendingChunksRef.current.length > 0) {
        const chunksToAdd = [...pendingChunksRef.current];
        pendingChunksRef.current = [];
        setAllData((prevData) => [...prevData, ...chunksToAdd]);
        console.log(`📦 Final batch: Added ${chunksToAdd.length} rows`);
      }

      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }

      setIsStreaming(false);
      setIsLoading(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsLoading(false);
        setIsStreaming(false);
        return;
      }
      console.error('Error fetching HQO blocked vehicles:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to fetch data');
      setAllData([]);
      setColumnDefs([]);
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [alertStatusFilter, getDateRange, generateColumnDefs]);

  // Filter and sort data based on search and sort
  const filteredAndSortedData = useMemo(() => {
    let data = [...allData];

    // Apply search filter if searchText is provided
    if (debouncedSearchText.trim()) {
      const searchLower = debouncedSearchText.toLowerCase();
      data = data.filter((row: any) => {
        return Object.values(row).some((val: any) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(searchLower);
        });
      });
    }

    return data;
  }, [allData, debouncedSearchText]);

  useEffect(() => {
    fetchAllData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [fetchAllData]);

  useEffect(() => {
    if (gridApi.current) {
      gridApi.current.setRowData(filteredAndSortedData);
    }
  }, [filteredAndSortedData]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const handleRefresh = useCallback(() => {
    setRotating(true);
    setSearchText('');
    fetchAllData();
    setTimeout(() => {
      setRotating(false);
    }, 1000);
  }, [fetchAllData]);

  const handleAlertStatusToggle = useCallback(() => {
    const nextStatus = alertStatusFilter === "Open" ? "Close" : "Open";
    setAlertStatusFilter(nextStatus);
  }, [alertStatusFilter]);

  const downloadExcel = useCallback(async () => {
    if (allData.length === 0) {
      toast.error('No data available to download');
      return;
    }

    setIsDownloading(true);
    try {
      // Prepare data for Excel export - use the filtered and sorted data
      const excelData = filteredAndSortedData.map((item: any) => {
        const row: any = {};
        // Use columnDefs to maintain column order and format headers
        columnDefs.forEach((col: any) => {
          const field = col.field;
          const headerName = col.headerName || field;
          let value = item[field];

          // Format created_at to IST
          if (field === 'created_at' && value) {
            try {
              value = dayjs.utc(value).tz('Asia/Kolkata').format('MMM D, YYYY, hh:mm A');
            } catch {
              // If date is invalid, keep original
            }
          }

          // Format the value appropriately
          if (value === null || value === undefined) {
            row[headerName] = '';
          } else if (Array.isArray(value)) {
            row[headerName] = value.join(', ');
          } else if (typeof value === 'object') {
            row[headerName] = JSON.stringify(value);
          } else {
            row[headerName] = String(value);
          }
        });
        return row;
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      if (excelData.length > 0) {
        const colWidths = Object.keys(excelData[0] || {}).map(key => ({
          wch: Math.max(
            key.length,
            ...excelData.map(row => String(row[key] || '').length)
          )
        }));
        worksheet['!cols'] = colWidths;
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'HQO Blocked Vehicles');

      // Generate filename with timestamp
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `TAS_${alertStatusFilter}_Alerts_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    } finally {
      setIsDownloading(false);
    }
  }, [allData, filteredAndSortedData, columnDefs, alertStatusFilter]);

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

        <div className="flex items-center space-x-2">
          <span
            className={
              alertStatusFilter === 'Open'
                ? 'text-red-600 font-medium text-sm'
                : 'text-green-600 font-medium text-sm'
            }
          >
            {alertStatusFilter}
          </span>
          <button
            onClick={handleAlertStatusToggle}
            type="button"
            role="switch"
            aria-checked={alertStatusFilter === "Open"}
            aria-label="Toggle alert status filter"
            className={`relative inline-flex h-5 w-12 items-center rounded-full transition-colors duration-300 ease-in-out ${alertStatusFilter === "Open" ? "bg-red-400" : "bg-green-400"
              } focus:outline-none focus:ring-1 focus:ring-gray-300`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${alertStatusFilter === "Open" ? "translate-x-1" : "translate-x-7"
                }`}
            />
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={downloadExcel}
          disabled={isDownloading || allData.length === 0}
        >
          <Download className={`mr-2 h-4 w-4 ${isDownloading ? "animate-spin" : ""}`} />
          {isDownloading ? 'Downloading...' : 'Download'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 transition-transform ${rotating ? "animate-spin" : ""
              }`}
          />
          Refresh
        </Button>
      </div>

      {/* Data Grid */}
      <div className="relative">
        {isLoading && allData.length === 0 && (
          <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
            <Loader className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {allData.length > 0 ? (
          <>
            <DataGrid
              columnDefs={columnDefs}
              rowData={filteredAndSortedData}
              onGridReady={onGridReady}
              pagination={true}
              paginationPageSize={pageSize}
              rowModelType="clientSide"
              loading={isLoading && allData.length === 0}
              defaultColDef={{
                sortable: true,
                resizable: true,
                filter: false,
              }}
            />
            <div className="mt-2 text-sm text-gray-600">
              {isStreaming ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Streaming data... ({allData.length} rows received)
                </span>
              ) : (
                <span>Total rows: {allData.length}</span>
              )}
            </div>
          </>
        ) : !isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-sm text-gray-600">No data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HQOBlockedVehiclesTable;

