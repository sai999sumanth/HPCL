import React, { useState, useEffect, useMemo ,useRef} from 'react';
import { apiClient } from "@/services/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Search, Download } from 'lucide-react';
import DataGrid from '@/components/common/DataGrid';
import { GridReadyEvent } from 'ag-grid-community';
import { toast } from "sonner";
import * as XLSX from 'xlsx';

interface SolarDashboardSummaryProps {
  zone?: string[] | string;
  timeFilter?: string | null | { key: string; cond: string; value: string };
  refreshKey?: number;
  bu?: string;
  plant?: string | null;
  selectedLocation?: string | null;
}

/** True if payload already contains a non-empty array anywhere (same idea as the table extractor). Preserves old behavior: never hide rows just because a `message` field exists. */
function solarPayloadHasNonEmptyRowArray(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (Array.isArray(payload) && payload.length > 0) return true;
  for (const key of ['data', 'summary', 'table']) {
    const v = payload[key];
    if (Array.isArray(v) && v.length > 0) return true;
  }
  return Object.keys(payload).some((k) => Array.isArray((payload as any)[k]) && ((payload as any)[k] as any[]).length > 0);
}

/** Narrow string match for backend "no solar DB credentials" responses (avoids false positives like "credentials for site X" in unrelated text). */
const SOLAR_CREDENTIAL_CONFIG_ERROR = /missing credentials/i;

/** Backend may return HTTP 200 with a message when solar DB credentials are not configured — treat as no table data only when there are no rows (status === 'error' unchanged). */
function responseIndicatesNoUsableTableData(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.status === 'error') return true;
  if (solarPayloadHasNonEmptyRowArray(payload)) return false;

  const textParts: string[] = [];
  for (const key of ['message', 'detail', 'error', 'msg']) {
    const v = payload[key];
    if (typeof v === 'string') textParts.push(v);
  }
  const combined = textParts.join(' ');
  if (SOLAR_CREDENTIAL_CONFIG_ERROR.test(combined)) return true;
  if (typeof payload.data === 'string' && SOLAR_CREDENTIAL_CONFIG_ERROR.test(payload.data)) return true;
  return false;
}

/** Single-row error payloads sometimes arrive as a pseudo row; strip only when it looks like a credential error, not a real plant row. */
function filterSpuriousSolarSummaryRows(rows: any[]): any[] {
  if (!rows?.length || rows.length !== 1) return rows;
  const row = rows[0];
  const sapId = row && typeof row === 'object' ? (row as any).sap_id : null;
  if (sapId != null && String(sapId).trim() !== '') return rows;
  const blob = typeof row === 'object' && row !== null ? JSON.stringify(row) : String(row);
  if (SOLAR_CREDENTIAL_CONFIG_ERROR.test(blob)) return [];
  return rows;
}

const StatusCellRenderer = (props: any) => {
  const v = String(props.value ?? '').toLowerCase();
  const isConnected = v === 'connected' || v === 'online';
  const isNotConnected = v === 'not connected';
  const bg = isConnected ? '#dcfce7' : isNotConnected ? '#fee2e2' : '#f3f4f6';
  const fg = isConnected ? '#166534' : isNotConnected ? '#991b1b' : '#374151';
  const text = props.value ?? 'N/A';

  // For connected / online, show blinking green dot similar to VTS Live
  if (isConnected) {
    return (
      <span
        style={{
          backgroundColor: bg,
          color: fg,
          borderRadius: '9999px',
          padding: '1px 6px',
          fontWeight: 600,
          fontSize: '11px',
          lineHeight: 1.2,
          display: 'inline-block',
        }}
      >
        <span className="inline-flex items-center gap-1">
          <span className="relative flex items-center justify-center w-3 h-3">
            {/* Outer pulsing ring */}
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-70 animate-ping" />
            {/* Inner solid dot */}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-600" />
          </span>
          <span>{text}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      style={{
        backgroundColor: bg,
        color: fg,
        borderRadius: '9999px',
        padding: '1px 6px',
        fontWeight: 600,
        fontSize: '11px',
        lineHeight: 1.2,
        display: 'inline-block',
      }}
    >
      {text}
    </span>
  );
};

const SolarDashboardSummaryTable: React.FC<SolarDashboardSummaryProps> = ({
  zone,
  timeFilter,
  refreshKey = 0,
  bu = 'SOD',
  plant = null,
  selectedLocation = null,
}) => {
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const handleGridReady = (_params: GridReadyEvent) => {};
const gridContainerRef = useRef<HTMLDivElement | null>(null);
const syncScrollbarRef = useRef<(() => void) | null>(null);

  // Function to get the correct date filter value
  const getDateFilterValue = (filter: string | null | { key: string; cond: string; value: string } | undefined): string => {
    // Handle date range objects (custom date ranges)
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      // This is a custom date range filter - return the value as is
      return filter.value;
    }

    // Handle string filters
    if (typeof filter === 'string') {
      const filterMap: { [key: string]: string } = {
        't': 't',           // Today
        'tdy': 't',         // Today (alternative)
        'TDY': 't',         // Today (uppercase)
        '1d': '1d',         // Yesterday
        'ydy': '1d',        // Yesterday (alternative)
        'YDY': '1d',        // Yesterday (uppercase)
        '1w': '1w',         // 1 Week
        '1W': '1w',         // 1 Week (uppercase)
        '15d': '15d',       // 15 Days
        '15D': '15d',       // 15 Days (uppercase)
        '1m': '1m',         // 1 Month
        '1M': '1m',         // 1 Month (uppercase)
        '3m': '3m',         // 3 Months
        '3M': '3m',         // 3 Months (uppercase)
        'custom': 'custom'  // Date Range
      };
      return filterMap[filter] || filterMap[filter.toLowerCase()] || filter; // Return mapped value or original filter
    }

    // Default to 1 month
    return '1m';
  };

  useEffect(() => {
    fetchSolarDashboardSummary();
  }, [zone, timeFilter, bu, plant, selectedLocation, refreshKey, searchTerm]);

  const fetchSolarDashboardSummary = async () => {
    try {
      setIsLoading(true);
      const filterValue = getDateFilterValue(timeFilter);

      // Build filters array
      const filters: any[] = [];

      // Add date filter
      if (filterValue) {
        filters.push({
          key: "timestamp_ist",
          cond: "date_filter",
          value: filterValue
        });
      }

      // Add zone filter
      if (zone) {
        const zoneValue = Array.isArray(zone) ? zone[0] : zone;
        if (zoneValue) {
          filters.push({
            key: "zone",
            cond: "=",
            value: zoneValue.toUpperCase()
          });
        }
      }

      // Add plant filter
      if (plant) {
        filters.push({
          key: "sap_id",
          cond: "=",
          value: plant
        });
      }

      // Add location filter
      if (selectedLocation) {
        filters.push({
          key: "location_name",
          cond: "=",
          value: selectedLocation
        });
      }

      // Convert TAS to SOD for solar panel cleaning APIs (same as other CEMS components)
      const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');

      // Build payload
      const payload = {
        bu: apiBU,
        action: "get_solar_summary",
        filters: [
          { key: "bu", cond: "=", value: apiBU },
          ...filters,
        ],
        drill_state: "",
        cross_filters: [],
        limit: 0,
        time_grain: "",
        category: "",
        search_field: searchTerm
      };

      const response = await apiClient.post('/api/solarpanelcleaning/get_solar_dashboard_summary', payload);

      // Sort so status = "connected" rows appear first (case-insensitive)
      const sortConnectedFirst = (rows: any[]) =>
        [...rows].sort((a, b) => {
          const aConnected = String(a?.status ?? '').toLowerCase() === 'connected' ? 0 : 1;
          const bConnected = String(b?.status ?? '').toLowerCase() === 'connected' ? 0 : 1;
          return aConnected - bConnected;
        });

      // Handle response - check for error status first
      if (response && response.data) {
        if (responseIndicatesNoUsableTableData(response.data)) {
          setTableData([]);
          return;
        }

        let nextRows: any[] = [];

        // If response has a data array directly
        if (Array.isArray(response.data)) {
          nextRows = response.data;
        }
        // If response has data.data structure
        else if (response.data.data && Array.isArray(response.data.data)) {
          nextRows = response.data.data;
        }
        // If response has a specific field for summary data
        else if (response.data.summary && Array.isArray(response.data.summary)) {
          nextRows = response.data.summary;
        }
        // If response has a table field
        else if (response.data.table && Array.isArray(response.data.table)) {
          nextRows = response.data.table;
        }
        else {
          // Try to find any array in the response
          const dataKeys = Object.keys(response.data);
          const arrayKey = dataKeys.find(key => Array.isArray(response.data[key]));
          if (arrayKey) {
            nextRows = response.data[arrayKey];
          }
        }

        nextRows = filterSpuriousSolarSummaryRows(nextRows);
        setTableData(nextRows.length ? sortConnectedFirst(nextRows) : []);
      } else {
        setTableData([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch solar dashboard summary:', err);
      setTableData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadsummarydashboarddata = async () => {
    try {
      setIsDownloading(true);
      const filterValue = getDateFilterValue(timeFilter);

      // Build filters array
      const filters: any[] = [];

      // Add date filter
      if (filterValue) {
        filters.push({
          key: "timestamp_ist",
          cond: "date_filter",
          value: filterValue
        });
      }

      // Add zone filter
      if (zone) {
        const zoneValue = Array.isArray(zone) ? zone[0] : zone;
        if (zoneValue) {
          filters.push({
            key: "zone",
            cond: "=",
            value: zoneValue.toUpperCase()
          });
        }
      }

      // Add plant filter
      if (plant) {
        filters.push({
          key: "sap_id",
          cond: "=",
          value: plant
        });
      }

      // Add location filter
      if (selectedLocation) {
        filters.push({
          key: "location",
          cond: "=",
          value: selectedLocation
        });
      }

      // Convert TAS to SOD for solar panel cleaning APIs (same as other CEMS components)
      const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');

      // Build payload
      const payload = {
        bu: apiBU,
        action: "get_solar_summary",
        filters: [
          { key: "bu", cond: "=", value: apiBU },
          ...filters,
        ],
        drill_state: "",
        cross_filters: [],
        limit: 0,
        time_grain: "",
        category: "",
        search_field: searchTerm,
        is_download: "True"
      };

      const response = await apiClient.post('/api/solarpanelcleaning/get_solar_dashboard_summary', payload);

      // Sort so status = "connected" rows appear first (case-insensitive)
      const sortConnectedFirst = (rows: any[]) =>
        [...rows].sort((a, b) => {
          const aConnected = String(a?.status ?? '').toLowerCase() === 'connected' ? 0 : 1;
          const bConnected = String(b?.status ?? '').toLowerCase() === 'connected' ? 0 : 1;
          return aConnected - bConnected;
        });

      let downloadRows: any[] = [];

      // Handle response - check for error status first
      if (response && response.data) {
        if (responseIndicatesNoUsableTableData(response.data)) {
          toast.error('No data available to download');
          return;
        }

        // If response has a data array directly
        if (Array.isArray(response.data)) {
          downloadRows = response.data;
        }
        // If response has data.data structure
        else if (response.data.data && Array.isArray(response.data.data)) {
          downloadRows = response.data.data;
        }
        // If response has a specific field for summary data
        else if (response.data.summary && Array.isArray(response.data.summary)) {
          downloadRows = response.data.summary;
        }
        // If response has a table field
        else if (response.data.table && Array.isArray(response.data.table)) {
          downloadRows = response.data.table;
        }
        else {
          // Try to find any array in the response
          const dataKeys = Object.keys(response.data);
          const arrayKey = dataKeys.find(key => Array.isArray(response.data[key]));
          if (arrayKey) {
            downloadRows = response.data[arrayKey];
          }
        }

        downloadRows = filterSpuriousSolarSummaryRows(downloadRows);
        downloadRows = downloadRows.length ? sortConnectedFirst(downloadRows) : [];
      }

      if (!downloadRows.length) {
        toast.error("No data available to download");
        return;
      }

      // Shape data for Excel using human-friendly column headers
      const formattedData = downloadRows.map((row) => {
        const formattedRow: Record<string, any> = {};
        fixedColumns.forEach((field) => {
          const header = columnHeaders[field] || field.replace(/_/g, " ");
          formattedRow[header] = row[field] ?? "-";
        });
        return formattedRow;
      });

      // Create and download Excel file (same pattern as AdminModuleDash)
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
      const filename = `solar_dashboard_summary_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast.success(`Downloaded ${downloadRows.length} records`);
    } catch (err: any) {
      console.error('Failed to download solar dashboard summary:', err);
      toast.error('No data available to download');
    } finally {
      setIsDownloading(false);
    }
  };

  const columnHeaders: { [key: string]: string } = {
    'bu': 'BU',
    'zone': 'Zone',
    'sap_id': 'SAP ID',
    'name': 'Location Name',
    'Plant_Capacity': 'Plant Capacity(KWH)',
    'estimated_energy': 'Estimated Energy(KWH)',
    'actual_energy': 'Actual Energy(KWH)',
    'efficiency': 'Efficiency(%)',
    'status': 'Status'
  };

  const fixedColumns = ['bu', 'zone', 'sap_id', 'name', 'Plant_Capacity', 'estimated_energy', 'actual_energy', 'efficiency', 'status'];

  // Numeric comparator for proper sort order (handles null/undefined and string numbers)
  const numericComparator = (valueA: unknown, valueB: unknown): number => {
    const numA = valueA == null || valueA === '' ? NaN : Number(valueA);
    const numB = valueB == null || valueB === '' ? NaN : Number(valueB);
    if (Number.isNaN(numA) && Number.isNaN(numB)) return 0;
    if (Number.isNaN(numA)) return 1;
    if (Number.isNaN(numB)) return -1;
    return numA - numB;
  };

  const sortableNumericFields = ['Plant_Capacity', 'estimated_energy', 'actual_energy', 'efficiency'];

  const narrowColumns = ['bu', 'zone', 'sap_id'];
  const columnDefs = useMemo(() => fixedColumns.map(field => ({
    headerName: columnHeaders[field] || field.replace(/_/g, ' '),
    field,
    minWidth: narrowColumns.includes(field) ? 70 : field === 'name' ? 140 : 100,
    sortable: true,
    ...(sortableNumericFields.includes(field) ? { comparator: numericComparator } : {}),
    ...(narrowColumns.includes(field) ? { flex: 0, maxWidth: 90 } : {}),
    ...(field === 'status' ? {
      cellRenderer: StatusCellRenderer,
      flex: 0,
      maxWidth: 120,
    } : {}),
  })), []);

  const defaultColDef = useMemo(() => ({
    flex: 0,
    resizable: true,
    sortable: true,
    filter: false,
    suppressMenu: true,
    cellStyle: { textAlign: 'center' },
  }), []);

useEffect(() => {
  const setupMirrorScrollbar = (wrapEl: HTMLDivElement | null): (() => void) => {
    if (!wrapEl) return () => {};
    const viewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null;
    if (!viewport) {
      const t = setTimeout(() => setupMirrorScrollbar(wrapEl), 100);
      return () => clearTimeout(t);
    }
    const mirrorHost = (wrapEl.querySelector(".ag-root-wrapper-body") as HTMLElement | null) ?? wrapEl;
    mirrorHost.style.position = "relative";
    wrapEl.querySelector(".tas-h-scroll-mirror")?.remove();
    const mirror = document.createElement("div");
    mirror.className = "tas-h-scroll-mirror";
    Object.assign(mirror.style, {
      position: "absolute", left: "8px", right: "8px", bottom: "0px",
      height: "8px", background: "#e2e8f0", borderRadius: "8px",
      zIndex: "5", cursor: "pointer", userSelect: "none", display: "block",
    });
    const thumb = document.createElement("div");
    Object.assign(thumb.style, {
      position: "absolute", top: "0.5px", bottom: "0.5px", left: "0px",
      minWidth: "40px", background: "#94a3b8", borderRadius: "8px",
    });
    thumb.addEventListener("mouseenter", () => { thumb.style.background = "#475569"; });
    thumb.addEventListener("mouseleave", () => { thumb.style.background = "#94a3b8"; });
    mirror.appendChild(thumb);
    mirrorHost.appendChild(mirror);
    const sync = () => {
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const trackWidth = mirror.clientWidth;
      const thumbWidth = Math.max(40, (viewport.clientWidth / (viewport.scrollWidth || 1)) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      thumb.style.width = `${thumbWidth}px`;
      thumb.style.left = `${(maxScroll > 0 ? (viewport.scrollLeft / maxScroll) : 0) * movable}px`;
    };
    syncScrollbarRef.current = sync;
    viewport.addEventListener("scroll", sync, { passive: true });
    const onTrackClick = (e: MouseEvent) => {
      if (e.target === thumb) return;
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScroll <= 0) return;
      const trackWidth = mirror.clientWidth;
      const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      const ratio = Math.max(0, Math.min(1, (e.clientX - mirror.getBoundingClientRect().left - thumbWidth / 2) / movable));
      viewport.scrollLeft = ratio * maxScroll;
    };
    const onThumbMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScroll <= 0) return;
      const trackWidth = mirror.clientWidth;
      const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
      const movable = Math.max(1, trackWidth - thumbWidth);
      const startX = e.clientX;
      const startScroll = viewport.scrollLeft;
      thumb.style.background = "#475569";
      const onMove = (ev: MouseEvent) => {
        viewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + ((ev.clientX - startX) / movable) * maxScroll));
      };
      const onUp = () => {
        thumb.style.background = "#94a3b8";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
    mirror.addEventListener("click", onTrackClick);
    thumb.addEventListener("mousedown", onThumbMouseDown);
    const ro = new ResizeObserver(sync);
    ro.observe(viewport);
    ro.observe(mirror);
    window.addEventListener("resize", sync);
    requestAnimationFrame(sync);
    return () => {
      viewport.removeEventListener("scroll", sync);
      mirror.removeEventListener("click", onTrackClick);
      thumb.removeEventListener("mousedown", onThumbMouseDown);
      ro.disconnect();
      window.removeEventListener("resize", sync);
      mirror.remove();
      syncScrollbarRef.current = null;
    };
  };
  const cleanup = setupMirrorScrollbar(gridContainerRef.current);
  return () => cleanup();
}, [tableData]);

useEffect(() => {
  if (syncScrollbarRef.current) {
    requestAnimationFrame(() => { syncScrollbarRef.current?.(); });
  }
}, [tableData, isLoading]);


  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-100 space-y-0">
      <CardHeader className="border-b border-gray-100 p-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Solar Dashboard Summary
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-7 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0 text-gray rounded-full hover:bg-gray-600 hover:text-white transition-colors flex items-center justify-center text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={downloadsummarydashboarddata}
              disabled={isDownloading}
              className="inline-flex items-center justify-center p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {/* Loading State - hide content so it doesn't show in background */}
        {isLoading && (
          <div className="flex items-center justify-center border border-gray-200 bg-white rounded min-h-[32rem]" style={{ minHeight: '32rem' }}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading solar dashboard...</p>
            </div>
          </div>
        )}

        {/* No data / Data not available */}
        {!isLoading && tableData.length === 0 && (
          <div className="flex items-center justify-center border border-gray-200 bg-white rounded min-h-[32rem]" style={{ minHeight: '32rem' }}>
            <p className="text-gray-500 text-sm font-medium">No data available</p>
          </div>
        )}


     <div ref={gridContainerRef}>
{!isLoading && tableData.length > 0 && (
  
 <div className="border border-gray-200 overflow-hidden bg-white w-full">
 
            <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell-text]:!font-semibold [&_.ag-header-cell-text]:!text-sm [&_.ag-header-cell-text]:!text-center [&_.ag-header-cell]:!py-1 [&_.ag-header-cell]:!min-h-0 [&_.ag-header-cell]:!text-center [&_.ag-header-cell]:!justify-center [&_.ag-cell]:!text-gray-800 [&_.ag-cell]:!text-xs [&_.ag-cell]:!font-normal [&_.ag-cell]:!py-1 [&_.ag-cell]:!text-center [&_.ag-row]:!min-h-0" style={{ minHeight: '32rem' }}>
              <DataGrid
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowData={tableData}
                loading={false}
                quickFilterText={searchTerm}
                height="32rem"
                headerHeight={40}
                gridOptions={{ rowHeight: 28 }}
                pagination={true}
                paginationPageSize={20}
                rowSelection="single"
                suppressRowClickSelection={true}
                onGridReady={handleGridReady}
              />
            </div>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SolarDashboardSummaryTable;