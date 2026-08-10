import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import DataGrid from '@/components/common/DataGrid';
import { AgGridCheckboxFilter } from '@/components/common/agGridCheckboxFilter';
import { apiClient } from '@/services/apiClient';
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';

interface AuditTableProps {
  apiEndpoint: string;
  apiMethod?: 'GET' | 'POST';
  pageTitle: string;
  searchPlaceholder?: string;
  noRecordsMessage?: string;
  loadingMessage?: string;
  statusFieldDetector?: (headers: string[]) => string | null;
  statusBadgeRenderer?: (status: any) => React.ReactNode;
  statCards?: React.ReactNode;
  extraToolbarItems?: React.ReactNode;
  pageSize?: number;
  onDataLoaded?: (data: any[], total: number) => void;
  fields?: string[];
  fieldLabels?: Record<string, string>; // NEW
}

const formatHeader = (header: string): string => {
  return header
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : null), obj);
};

const extractDataArray = (responseData: any): any[] => {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData;
  const possibleKeys = ['data', 'records', 'items', 'result', 'audits', 'logs'];
  for (const key of possibleKeys) {
    if (responseData[key] && Array.isArray(responseData[key])) {
      return responseData[key];
    }
  }
  return [];
};

const extractTotalCount = (responseData: any): number => {
  if (typeof responseData?.total === 'number') return responseData.total;
  if (typeof responseData?.total_records === 'number') return responseData.total_records;
  if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
  if (typeof responseData?.count === 'number') return responseData.count;
  return null;
};



const defaultStatusFieldDetector = (headers: string[]): string | null => {
  return headers.find(h => h.toLowerCase() === 'login_status') || 
         headers.find(h => h.toLowerCase().includes('status')) || 
         headers.find(h => h.toLowerCase().includes('result')) || 
         null;
};

const AuditTable: React.FC<AuditTableProps> = ({
  apiEndpoint,
  apiMethod = 'POST',
  pageTitle,
  searchPlaceholder = 'Search logs...',
  noRecordsMessage = 'Your search did not match any records.',
  loadingMessage = 'Loading audit logs...',
  statusFieldDetector = defaultStatusFieldDetector,
  statusBadgeRenderer,
  statCards,
  extraToolbarItems,
  pageSize: initialPageSize = 20,
  onDataLoaded,
  fields,
  fieldLabels = {}, // NEW
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusField, setStatusField] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const abortControllerRef = useRef<AbortController | null>(null);
  const gridApiRef = useRef<any>(null);

  // Debounce search
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      setSearchQuery(searchTerm);
      if (gridApiRef.current) {
        gridApiRef.current.refreshInfiniteCache();
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);
  const fetchData = useCallback(async (skip: number, limit: number) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      let response;
      if (apiMethod === 'GET') {
        const params: any = {
          skip: skip.toString(),
          limit: limit.toString(),
        };
        if (searchQuery) params.search_string = searchQuery;
        if (fields && fields.length > 0) params.fields = JSON.stringify(fields);
        response = await apiClient.get(apiEndpoint, { params, signal: abortController.signal });
      } else {
        const payload: any = { 
          search_string: searchQuery, 
          skip: skip.toString(),
          limit: limit.toString() 
        };
        if (fields && fields.length > 0) payload.fields = JSON.stringify(fields);
        response = await apiClient.post(apiEndpoint, payload, { signal: abortController.signal });
      }

      if (abortController.signal.aborted) return { data: [], total: 0 };

      const rawDataArray = extractDataArray(response.data);
      const totalFromApi = extractTotalCount(response.data);

      if (rawDataArray.length > 0 && tableHeaders.length === 0) {
        const headers = fields && fields.length > 0 ? fields : Object.keys(rawDataArray[0]);
        setTableHeaders(headers);
        const detectedStatusField = statusFieldDetector(headers);
        setStatusField(detectedStatusField);
      }

      if (onDataLoaded) onDataLoaded(rawDataArray, totalFromApi);
      
      return {
        data: rawDataArray,
        total: totalFromApi
      };

    } catch (err: any) {
      if (err.name === 'AbortError') return { data: [], total: 0 };
      console.error('Failed to fetch data:', err);
      setError('Failed to fetch data. Please check your API endpoint and network connection.');
      return { data: [], total: 0 };
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [searchQuery, apiEndpoint, apiMethod, fields, statusFieldDetector, onDataLoaded]);


  const datasource = useMemo(() => ({
    getRows: async (params: any) => {
      // Small delay to allow multiple grid events (pagination + prop changes) 
      // to settle so we only make one API call with the final parameters.
      await new Promise(resolve => setTimeout(resolve, 50));

      const limit = params.endRow - params.startRow;
      const skip = Math.floor(params.startRow / limit);
      
      const result = await fetchData(skip, limit);
      
      if (result.data.length === 0 && params.startRow === 0) {
        params.successCallback([], 0);
        return;
      } 
  // else {
  //       params.successCallback(result.data, result.total);
  //     }

  const lastRow =
        result.total != null && result.total > 0
          ? result.total
          : result.data.length < limit
            ? params.startRow + result.data.length
            : -1;
 params.successCallback(result.data, lastRow);

    }
  }), [fetchData]);


  const onGridReady = (params: any) => {
    gridApiRef.current = params.api;
  };

  const handlePaginationChanged = useCallback((params: any) => {
    if (gridApiRef.current) {
      const newPageSize = gridApiRef.current.paginationGetPageSize();
      if (newPageSize !== pageSize) {
        // Update state to keep props in sync. This will trigger a re-render 
        // and update cacheBlockSize on the DataGrid.
        setPageSize(newPageSize);
      }
    }
  }, [pageSize]);

  const handleSearch = () => {
    if (gridApiRef.current) {
      gridApiRef.current.refreshInfiniteCache();
    }
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setSearchQuery('');
    if (gridApiRef.current) {
      gridApiRef.current.refreshInfiniteCache();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const buildAuditColumnDefs = useCallback((): ColDef[] => {
    const columns: ColDef[] = tableHeaders.map((header) => {
      const isStatus = header === statusField;
      const isDate = header.toLowerCase().includes('_at') || header.toLowerCase().includes('date') || header.toLowerCase().includes('time');
      
      const isRemarks = header.toLowerCase() === 'remarks';
      
      return {
        field: header,
        headerName: fieldLabels[header] ?? formatHeader(header),
        minWidth: isDate ? 160 : 120,
        flex: 1,
        sortable: true,
        filter: AgGridCheckboxFilter,
        tooltipField: isRemarks ? header : undefined,
        tooltipValueGetter: isRemarks ? (params: any) => {
          const value = getNestedValue(params.data, header);
          if (!value) return null;
          return String(value);
        } : undefined,
        
        cellStyle: {
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          borderRight: 'none',
        },
        headerClass: 'font-semibold text-white',
        cellClass: 'border-r-0',
        cellRenderer: (params: any) => {
          const value = getNestedValue(params.data, header);
          
          if (isStatus && statusBadgeRenderer) {
            return statusBadgeRenderer(value);
          }

          if (isStatus && !statusBadgeRenderer) {
            let badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';
            let icon = '•';
            let displayValue = String(value || 'N/A');

            const lowerVal = (value || '').toString().toLowerCase();
            if (lowerVal.includes('success') || lowerVal.includes('ok') || lowerVal.includes('completed') || lowerVal.includes('logged in')) {
              badgeClass = 'bg-emerald-50 text-emerald-800';
              icon = '✓';
            } else if (lowerVal.includes('failed') || lowerVal.includes('error') || lowerVal.includes('failure')) {
              badgeClass = 'bg-red-50 text-red-800';
              icon = '✕';
            } else if (lowerVal.includes('warn') || lowerVal.includes('pending') || lowerVal.includes('logged out')) {
              badgeClass = 'bg-yellow-50 text-yellow-800';
              icon = '⚠';
            }

            return (
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${badgeClass}`}>
                <span className="mr-1.5">{icon}</span>
                {displayValue}
              </span>
            );
          }

          // Special handling for date fields
          if (header.toLowerCase().includes('_at') || header.toLowerCase().includes('date') || header.toLowerCase().includes('time')) {
            if (!value) return <span className="text-gray-400">-</span>;

            try {
              // Convert UTC to local time (IST)
              const utcDate = new Date(value);
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

              // Get the relative time
              const relativeTime = formatRelativeTime(value);

              return (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-900">{relativeTime}</span>
                  <span className="text-xs text-gray-500">{formattedDateTime}</span>
                </div>
              );
            } catch (error) {
              console.error('Error formatting date:', error);
              return <span className="text-red-500">Invalid date</span>;
            }
          }

          if (Array.isArray(value)) {
            return (
              <span className="text-gray-700 font-medium">
                {value.join(', ')}
              </span>
            );
          }

          if (typeof value === 'object' && value !== null) {
            return (
              <span className="text-gray-700 font-medium">
                {JSON.stringify(value)}
              </span>
            );
          }

          if (value == null || value === '') {
            return <span className="text-gray-400">-</span>;
          }

          return (
            <span className="text-gray-800 font-medium">
              {String(value)}
            </span>
          );
        },
      };
    });

    // Make all columns read-only
    return columns.map(col => ({ ...col, editable: false }));
  }, [tableHeaders, statusField, statusBadgeRenderer, fieldLabels]);

  const gridTheme = useMemo(() => ({
    '--ag-header-height': '40px',
    '--ag-row-height': '36px',
    '--ag-header-foreground-color': '#ffffff',
    '--ag-header-background-color': '#1e40af',
    '--ag-header-cell-hover-background-color': '#1e3a8a',
    '--ag-header-cell-moving-background-color': '#2563eb',
    '--ag-font-size': '12px',
    '--ag-font-family': 'inherit',
    '--ag-row-hover-color': 'rgba(59, 130, 246, 0.08)',
    '--ag-selected-row-background-color': 'rgba(59, 130, 246, 0.15)',
    '--ag-odd-row-background-color': '#ffffff',
    '--ag-even-row-background-color': '#f8fafc',
    '--ag-border-color': '#e2e8f0',
    '--ag-row-border-color': '#e2e8f0',
    '--ag-header-column-resize-handle-color': 'rgba(255, 255, 255, 0.3)',
    '--ag-header-column-resize-handle-width': '1px',
    '--ag-icon-font-color-menu': 'white',
    '--ag-icon-font-color-filter': 'white',
    '--ag-icon-font-color-asc': 'white',
    '--ag-icon-font-color-desc': 'white',
    '--ag-cell-horizontal-border': 'solid 1px #e2e8f0',
    '--ag-cell-vertical-border': 'none',
    '--ag-range-selection-background-color': 'rgba(59, 130, 246, 0.1)',
    '--ag-range-selection-border-color': '#3b82f6',
    '--ag-header-cell-text-color': '#ffffff',
  }) as React.CSSProperties, []);

  const gridOptions = useMemo(() => ({
    enableCellTextSelection: true,
    suppressCopyRowsToClipboard: false,
    ensureDomOrder: true,
    suppressMenu: false,
    suppressMenuHide: true,
    suppressClickEdit: true,
  }), []);

  return (
    <main className="flex-1 bg-gray-50 p-2 sm:p-2 flex flex-col">
      <div className="mx-auto w-full flex flex-col flex-1">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-2 gap-4">

{/* Left Side */}
<div className="flex items-center gap-4">
  <h1 className="text-lg sm:text-xl font-bold whitespace-nowrap">
    {pageTitle}
  </h1>

</div>

{/* Right Side */}
<div className="flex items-center gap-2 w-full lg:w-auto">
{statCards}


  <div className="relative min-w-[300px]">
    
    <RefreshCw
      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      size={18}
    />

    <input
      type="text"
      placeholder={searchPlaceholder}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      onKeyPress={handleKeyPress}
      className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
      disabled={loading}
    />
  </div>

  {extraToolbarItems}


  <button
    onClick={handleRefresh}
    disabled={loading}
    title="Refresh"
    className="bg-white border border-gray-300 text-gray-700 p-2 rounded-md flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50"
  >
    <RefreshCw
      size={16}
      className={loading ? "animate-spin" : ""}
    />
  </button>
</div>
</div>
          <div style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <style>{`
              .ag-theme-alpine .ag-header-cell {
                color: #ffffff !important;
                font-weight: 600 !important;
                border-right: none !important;
              }
              .ag-theme-alpine .ag-header-cell:hover {
                color: #ffffff !important;
                background-color: #1e3a8a !important;
              }
              .ag-theme-alpine .ag-cell {
                border-right: none !important;
                border-bottom: 1px solid #e2e8f0 !important;
              }
              .ag-theme-alpine .ag-row {
                border-bottom: 1px solid #e2e8f0 !important;
              }
              .ag-theme-alpine .ag-row-even {
                border-bottom: 1px solid #e2e8f0 !important;
              }
              .ag-theme-alpine .ag-row-odd {
                border-bottom: 1px solid #e2e8f0 !important;
              }
              .ag-theme-alpine .ag-paging-button {
                min-width: 22px !important;
                height: 22px !important;
                padding: 2px 4px !important;
                font-size: 11px !important;
              }
              .ag-theme-alpine .ag-paging-panel {
                padding: 2px 6px !important;
                font-size: 11px !important;
              }
              .ag-theme-alpine .ag-paging-row-summary-panel {
                font-size: 11px !important;
              }
            `}</style>
          <DataGrid
  columnDefs={buildAuditColumnDefs()}
  gridOptions={gridOptions}
  pagination={true}
  paginationPageSize={pageSize}
  paginationPageSizeSelector={[10, 20, 50, 100]}
  style={gridTheme}
  cacheBlockSize={pageSize}
  rowModelType="infinite"
  datasource={datasource}
  onGridReady={onGridReady}
  onPaginationChanged={handlePaginationChanged}
  height="620px"
  loading={loading}
  quickFilterText={searchTerm}
  suppressNoRowsOverlayWhenLoading={true}
/>
          </div>
        {/* </div> */}
      </div>
    </main>
  );
};

export default AuditTable;
