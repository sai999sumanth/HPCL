import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { flushSync } from "react-dom";
import {
  ChevronUp,
  ChevronDown,
  Search,
  X,
  Eye,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import { format, subDays } from "date-fns";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import * as XLSX from "xlsx";
// Using ag-grid-community (not enterprise)
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent, SizeColumnsToContentStrategy } from "ag-grid-community";
import { AgGridCheckboxFilter } from "@/components/common/agGridCheckboxFilter";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface VtsData {
  invoice_number: number;
  slNo: number;
  dealer: string;
  ttNumber: string;
  zone: string;
  location: string;
  transporterName: string;
  created_at: string;
  destination_code?: string;
  destination_name?: string;
  route_deviation_count_orig: number;
  stoppage_violations_count: number;
  device_tamper_count: number;
  main_supply_removal_count: number;
  night_driving_count: number;
  speed_violation_count: number;
  continuous_driving_count: number;
  qty_shortage?: number;
}

interface FilterState {
  [key: string]: string[];
}

interface VTSInsightTableProps {
  data: VtsData[];
  loading: boolean;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  selectedViolations: string[];
  setSelectedViolations: React.Dispatch<React.SetStateAction<string[]>>;
  mode: "violation" | "alert";
  setMode: (mode: "violation" | "alert") => void;
  onViewRow: (row: VtsData) => void;
  violationTypes: { [key: string]: string };
  violationTypeTooltips: { [key: string]: string };
  columnConfig: any;
  selectedBu: string;
  selectedZone?: string | null;
  selectedPlant?: string | null;
  selectedTimeFilter?: string | null;
  dateRangeFilter?: { start: Date; end: Date } | null;
  alertType: string;
  hideModeToggle?: boolean; // Add prop to hide mode toggle
  totalCount?: number; // Total count from API
  currentPage?: number; // Current page (0-indexed)
  pageSize?: number; // Page size
  onPageChange?: (page: number) => void; // Page change handler
  onPageSizeChange?: (size: number) => void; // Page size change handler
}

const VTSInsightTable: React.FC<VTSInsightTableProps> = ({
  data,
  loading,
  filters,
  setFilters,
  selectedViolations,
  setSelectedViolations,
  mode,
  setMode,
  onViewRow,
  violationTypes,
  violationTypeTooltips,
  columnConfig,
  selectedBu,
  selectedZone,
  selectedPlant,
  selectedTimeFilter,
  dateRangeFilter,
  alertType,
  hideModeToggle = false, // Default to false
  totalCount = 0, // Total count from API
  currentPage = 0, // Current page (0-indexed from parent)
  pageSize = 20, // Page size from parent
  onPageChange, // Page change handler from parent
  onPageSizeChange, // Page size change handler from parent
}) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof VtsData;
    direction: "asc" | "desc";
  } | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownSearchTerms, setDropdownSearchTerms] = useState<{
    [key: string]: string;
  }>({});
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [sortedData, setSortedData] = useState<VtsData[]>(data);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamingData, setStreamingData] = useState<VtsData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const gridRef = useRef<AgGridReact>(null);
  const hasFirstDataRef = useRef<boolean>(false);
  const pendingChunksRef = useRef<VtsData[]>([]);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentDataLengthRef = useRef<number>(0);
  // Track if data has been loaded to prevent unnecessary API calls
  const dataLoadedRef = useRef<boolean>(false);
  const lastFetchParamsRef = useRef<string>("");
  const isFetchingRef = useRef<boolean>(false);
  // Internal search state - not sent to parent
  const [searchTerm, setSearchTerm] = useState<string>("");
  // View mode state: 'all' | 'transportDiscipline' | 'safety'
  const [viewMode, setViewMode] = useState<
    "all" | "transportDiscipline" | "safety"
  >("all");

  // Convert 0-indexed page to 1-indexed for display
  const displayPage = currentPage + 1;

  // Helper function to extract complete JSON objects from a string (same as VTSStreamingTable)
  const extractCompleteJSON = (
    text: string
  ): { parsed: any[]; remaining: string } => {
    const results: any[] = [];
    let remaining = text;
    let startIndex = 0;

    while (startIndex < remaining.length) {
      // Skip whitespace
      while (
        startIndex < remaining.length &&
        /\s/.test(remaining[startIndex])
      ) {
        startIndex++;
      }
      if (startIndex >= remaining.length) break;

      // Find the start of a JSON object/array
      const char = remaining[startIndex];
      if (char !== "{" && char !== "[") {
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

        if (c === "\\") {
          escapeNext = true;
          continue;
        }

        if (c === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (c === "{" || c === "[") {
            depth++;
          } else if (c === "}" || c === "]") {
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
          break;
        }
      } else {
        break;
      }
    }

    return { parsed: results, remaining };
  };

  // Transform raw data item to VtsData format
  const transformDataItem = (
    item: any,
    index: number,
    currentLength: number
  ): VtsData => {
    return {
      slNo: currentLength + index + 1,
      dealer: item.location_name || item.dealer || "N/A",
      ttNumber: item.tl_number || item.vehicle_number || item.ttNumber || "N/A",
      zone: item.zone || "N/A",
      location: item.location_name || item.location || "N/A",
      transporterName: item.transporter_name || item.transporterName || "N/A",
      created_at: item.created_at || item.date || "N/A",
      destination_code: item.destination_code || item.destinationCode || "",
      destination_name: item.destination_name || item.destinationName || "",
      route_deviation_count_orig: item.route_deviation_count_orig || 0,
      stoppage_violations_count: item.stoppage_violations_count || 0,
      device_tamper_count: item.device_tamper_count || 0,
      main_supply_removal_count: item.main_supply_removal_count || 0,
      night_driving_count: item.night_driving_count || 0,
      speed_violation_count: item.speed_violation_count || 0,
      continuous_driving_count: item.continuous_driving_count || 0,
      qty_shortage: item.qty_shortage ?? 0,
      invoice_number: item.invoice_number || 0,
    };
  };

  // Streaming fetch function (same pattern as VTSStreamingTable)
  const fetchStreamingData = useCallback(async () => {
    // Create a unique key for current fetch parameters (including mode to trigger API call on toggle)
    const fetchKey = JSON.stringify({
      selectedBu,
      selectedZone,
      selectedPlant,
      selectedTimeFilter,
      mode,
      alertType: mode === "alert" ? alertType : undefined,
      dateRangeFilter: dateRangeFilter
        ? {
            start: dateRangeFilter.start.toISOString(),
            end: dateRangeFilter.end.toISOString(),
          }
        : null,
    });

    // If data is already loaded with the same parameters, don't fetch again
    if (dataLoadedRef.current && lastFetchParamsRef.current === fetchKey) {
      return;
    }

    // If already fetching with DIFFERENT parameters, cancel the ongoing request
    if (isFetchingRef.current) {
      if (lastFetchParamsRef.current !== fetchKey) {
        // Abort the ongoing request for old parameters
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        isFetchingRef.current = false;
        dataLoadedRef.current = false;
      } else {
        // Same parameters, don't start another request
        return;
      }
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Update the last fetch params BEFORE starting the fetch
    lastFetchParamsRef.current = fetchKey;

    // Store the current fetchKey to check later if it's still valid
    const currentFetchKey = fetchKey;

    // Mark as fetching
    isFetchingRef.current = true;

    setIsStreaming(true);
    setStreamingError(null);
    setStreamingData([]);
    hasFirstDataRef.current = false;
    pendingChunksRef.current = [];
    currentDataLengthRef.current = 0;
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }

    // Helper function to check if this fetch is still the current one
    const isCurrentFetch = () => lastFetchParamsRef.current === currentFetchKey;

    try {
      // Build filters
      const filters = [{ key: "bu", cond: "equals", value: selectedBu }];
      if (selectedZone && selectedZone !== "all") {
        filters.push({ key: "zone", cond: "equals", value: selectedZone });
      }
      if (selectedPlant && selectedPlant !== "all") {
        filters.push({
          key: "sap_id",
          cond: "equals",
          value: String(selectedPlant),
        });
      }

      // Generate date filter string
      const getDateRangeString = (
        filter: string | null,
        customRange: { start: Date; end: Date } | null
      ): string => {
        const now = new Date();
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}-${String(d.getDate()).padStart(2, "0")}`;

        if (customRange && customRange.start && customRange.end) {
          return `${fmt(customRange.start)},${fmt(customRange.end)}`;
        }

        switch (filter) {
          case "TDY":
            return `${fmt(now)},${fmt(now)}`;
          case "YDY": {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            return `${fmt(y)},${fmt(y)}`;
          }
          case "1W": {
            const s = new Date(now);
            s.setDate(s.getDate() - 7);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "15D": {
            const s = new Date(now);
            s.setDate(s.getDate() - 15);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "1M": {
            const s = new Date(now);
            s.setDate(s.getDate() - 30);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "3M": {
            const s = new Date(now);
            s.setDate(s.getDate() - 90);
            return `${fmt(s)},${fmt(now)}`;
          }
          default:
            return `${fmt(now)},${fmt(now)}`;
        }
      };

      const dateFilterString = getDateRangeString(
        selectedTimeFilter,
        dateRangeFilter
      );
      const crossFilters = [
        { key: "DATE", cond: "equals", value: dateFilterString },
      ];

      // Prepare payload - always empty object for both violation and alert modes
      const payload: any = {};

      // Set drill_state based on mode
      const drillState =
        mode === "violation" ? "vts_insite_history" : "vts_insite";

      // Set action based on mode
      const action = mode === "alert" ? "vts_insite" : "vts_insite_violation";

      const requestPayload = {
        filters,
        action,
        drill_state: drillState,
        cross_filters: crossFilters,
        payload,
      };

      // Use postStream for streaming support (same as VTSStreamingTable)
      const res = await apiClient.postStream(
        "/api/charts/generate_vis_data",
        requestPayload
      );

      const reader = res.data.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        // Check if this fetch is still current before processing
        if (!isCurrentFetch()) {
          console.log("Fetch cancelled - parameters changed");
          reader.cancel();
          break;
        }

        const { value, done } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const { parsed } = extractCompleteJSON(buffer);
            for (const item of parsed) {
              let dataArray: any[] = [];

              if (Array.isArray(item)) {
                dataArray = item;
              } else if (item && typeof item === "object") {
                if (Array.isArray(item.data)) {
                  dataArray = item.data;
                } else if (Array.isArray(item.payload)) {
                  dataArray = item.payload;
                } else if (Array.isArray(item.result)) {
                  dataArray = item.result;
                } else if (Array.isArray(item.rows)) {
                  dataArray = item.rows;
                } else {
                  dataArray = [item];
                }
              }

              if (dataArray.length > 0 && isCurrentFetch()) {
                const transformedItems = dataArray.map(
                  (rawItem: any, idx: number) =>
                    transformDataItem(
                      rawItem,
                      idx,
                      currentDataLengthRef.current
                    )
                );

                if (!hasFirstDataRef.current) {
                  hasFirstDataRef.current = true;
                  flushSync(() => {
                    setStreamingData(transformedItems);
                    currentDataLengthRef.current = transformedItems.length;
                  });
                } else {
                  pendingChunksRef.current.push(...transformedItems);
                }
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Extract complete JSON objects from buffer
        const { parsed, remaining } = extractCompleteJSON(buffer);
        buffer = remaining;

        // Process parsed JSON objects
        for (const item of parsed) {
          try {
            let dataArray: any[] = [];

            if (Array.isArray(item)) {
              dataArray = item;
            } else if (item && typeof item === "object") {
              if (Array.isArray(item.data)) {
                dataArray = item.data;
              } else if (Array.isArray(item.payload)) {
                dataArray = item.payload;
              } else if (Array.isArray(item.result)) {
                dataArray = item.result;
              } else if (Array.isArray(item.rows)) {
                dataArray = item.rows;
              } else {
                dataArray = [item];
              }
            }

            if (dataArray.length > 0 && isCurrentFetch()) {
              // First chunk - display immediately
              if (!hasFirstDataRef.current) {
                hasFirstDataRef.current = true;
                const transformedItems = dataArray.map(
                  (rawItem: any, idx: number) =>
                    transformDataItem(rawItem, idx, 0)
                );
                flushSync(() => {
                  setStreamingData(transformedItems);
                  currentDataLengthRef.current = transformedItems.length;
                });
              } else {
                // Subsequent chunks - batch updates
                const transformedItems = dataArray.map(
                  (rawItem: any, idx: number) =>
                    transformDataItem(
                      rawItem,
                      idx,
                      currentDataLengthRef.current
                    )
                );
                pendingChunksRef.current.push(...transformedItems);

                // Clear existing timer
                if (updateTimerRef.current) {
                  clearTimeout(updateTimerRef.current);
                }

                // Batch update: wait a bit to accumulate chunks, then update
                updateTimerRef.current = setTimeout(() => {
                  // Check if still current fetch before updating
                  if (pendingChunksRef.current.length > 0 && isCurrentFetch()) {
                    const chunksToAdd = [...pendingChunksRef.current];
                    pendingChunksRef.current = [];

                    setStreamingData((prevData) => {
                      const newData = [...prevData, ...chunksToAdd];
                      currentDataLengthRef.current = newData.length;
                      return newData;
                    });
                  }
                  updateTimerRef.current = null;
                }, 100);
              }
            }
          } catch (error) {
            console.error("Error processing parsed item:", error, item);
          }
        }
      }

      // Only process remaining data if this is still the current fetch
      if (isCurrentFetch()) {
        // Process any remaining pending chunks before finishing
        if (pendingChunksRef.current.length > 0) {
          const chunksToAdd = [...pendingChunksRef.current];
          pendingChunksRef.current = [];
          setStreamingData((prevData) => {
            const newData = [...prevData, ...chunksToAdd];
            currentDataLengthRef.current = newData.length;
            return newData;
          });
        }

        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
          updateTimerRef.current = null;
        }

        // Mark data as loaded and store fetch parameters
        dataLoadedRef.current = true;
        setIsStreaming(false);
        isFetchingRef.current = false;
      } else {
        console.log(
          "Fetch completed but parameters changed - discarding results"
        );
        pendingChunksRef.current = [];
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
          updateTimerRef.current = null;
        }
        isFetchingRef.current = false;
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Fetch aborted");
        setIsStreaming(false);
        isFetchingRef.current = false;
        return;
      }
      console.error("Streaming error:", err);
      setStreamingError(err.message || "Failed to fetch data");
      setIsStreaming(false);
      isFetchingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedBu,
    selectedZone,
    selectedPlant,
    selectedTimeFilter,
    dateRangeFilter,
    mode,
    alertType,
  ]);

  // Keep ref in sync with state
  useEffect(() => {
    currentDataLengthRef.current = streamingData.length;
  }, [streamingData]);

  // Monitor streamingData changes for debugging
  useEffect(() => {
    if (streamingData.length > 0) {
    }
  }, [streamingData, isStreaming]);

  // Reset data loaded flag and clear data when filters change to allow new fetch
  useEffect(() => {
    dataLoadedRef.current = false;
    // Immediately clear streaming data to prevent showing stale data
    setStreamingData([]);
    pendingChunksRef.current = [];
    hasFirstDataRef.current = false;
    currentDataLengthRef.current = 0;
    // Clear any pending batch update timer
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
  }, [
    selectedBu,
    selectedZone,
    selectedPlant,
    selectedTimeFilter,
    dateRangeFilter,
    mode,
    alertType,
  ]);

  // Fetch data when filters or mode change (mode change triggers new API call)
  useEffect(() => {
    fetchStreamingData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedBu,
    selectedZone,
    selectedPlant,
    selectedTimeFilter,
    dateRangeFilter,
    mode,
    alertType,
    fetchStreamingData,
  ]);

  // Handle window resize - allow table to scroll horizontally if content is wider
  // Don't force columns to fit, let them maintain their widths and scroll if needed
  useEffect(() => {
    const handleResize = () => {
      // Optional: You can uncomment this if you want columns to auto-fit on resize
      // if (gridRef.current?.api) {
      //     gridRef.current.api.sizeColumnsToFit();
      // }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Use the filtered table data directly instead of calling API
      if (!filteredData || filteredData.length === 0) {
        toast.error("No data available to download.");
        return;
      }

      // Prepare data for Excel export - map to column headers
      const excelData = filteredData.map((row) => {
        const excelRow: any = {
          No: row.slNo,
          Zone: row.zone,
          Location: row.location,
          Transporter: row.transporterName,
          "Invoice Date": row.created_at,
          "Destination Code": row.destination_code || "",
          "Destination Name": row.destination_name || "",
          "TT No": row.ttNumber,
          RD: row.route_deviation_count_orig || 0,
          UNS: row.stoppage_violations_count || 0,
          DT: row.device_tamper_count || 0,
          PD: row.main_supply_removal_count || 0,
          ND: row.night_driving_count || 0,
          OS: row.speed_violation_count || 0,
          CD: row.continuous_driving_count || 0,
        };

        // Add invoice number and qty shortage for violation mode
        if (mode === "violation") {
          excelRow["Invoice number"] = row.invoice_number || 0;
          excelRow["Qty Short"] =
            row.qty_shortage !== undefined && row.qty_shortage !== null
              ? row.qty_shortage.toFixed(1)
              : "0.0";
        }

        return excelRow;
      });

      // Generate filename
      const formattedDate = new Date().toISOString().split("T")[0];
      const VIOLATION_TYPE_SHORT: Record<string, string> = {
        route_deviation_count_orig: "RD",
        stoppage_violations_count: "SV",
        main_supply_removal_count: "PDC",
        night_driving_count: "ND",
        speed_violation_count: "SP",
        continuous_driving_count: "CD",
        device_tampering_count: "DT",
        device_tamper_count: "DT",
      };
      let selectedViolationType: string = "all";

      if (Array.isArray(selectedViolations) && selectedViolations.length > 0) {
        selectedViolationType = selectedViolations
          .map((v) => VIOLATION_TYPE_SHORT[v] || v)
          .join("_");
      } else if (typeof selectedViolations === "string" && selectedViolations) {
        selectedViolationType =
          VIOLATION_TYPE_SHORT[selectedViolations] || selectedViolations;
      }

      const safeViolationType = selectedViolationType
        .replace(/\s+/g, "_")
        .toLowerCase();
      const fileName =
        mode === "alert"
          ? `alerts_${safeViolationType}_${formattedDate}.xlsx`
          : `violations_${safeViolationType}_${formattedDate}.xlsx`;

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

      // Download the file
      XLSX.writeFile(workbook, fileName);
      toast.success("Excel downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download data. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Use streamingData instead of data prop
  useEffect(() => {
    let newData = [...streamingData];
    if (sortConfig) {
      newData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key])
          return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key])
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    setSortedData(newData);
  }, [streamingData, sortConfig]);

  // Apply client-side filters to data (for display only, server handles pagination)
  const getFilteredData = () => {
    let filtered = sortedData.filter((row) =>
      Object.values(row).some((value) =>
        value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    // Apply column filters
    Object.entries(filters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter((row) =>
          values.includes(row[column as keyof VtsData].toString())
        );
      }
    });

    // Apply violation type filters (client-side only)
    // Filter rows where ALL selected violations have count > 0 (AND logic)
    if (selectedViolations && selectedViolations.length > 0) {
      filtered = filtered.filter((row) => {
        // Check if row has ALL of the selected violations with count > 0
        return selectedViolations.every((violationKey) => {
          // The violationKey is the field name (e.g., 'route_deviation_count_orig')
          const fieldName = violationKey as keyof VtsData;

          // Get the count value for this violation type
          const count = row[fieldName];

          // For numeric fields, check if count > 0
          if (typeof count === "number") {
            return count > 0;
          }

          // For qty_shortage, it might be optional, so check if it exists and > 0
          if (fieldName === "qty_shortage") {
            return count !== undefined && count !== null && Number(count) > 0;
          }

          return false;
        });
      });
    }

    return filtered;
  };

  const filteredData = getFilteredData();

  // Server-side pagination: use totalCount from API or streamingData length
  const totalItems = totalCount > 0 ? totalCount : streamingData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Use filtered data for display (client-side filtering on current page)
  const paginatedData = filteredData;

  const getViolationColor = (violations: number) => {
    if (violations <= 2) return "text-green-700 bg-green-100";
    if (violations <= 5) return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };

  // Helper for multi-line text cell renderer - declared BEFORE useMemo
  const MultiLineCellRenderer = useCallback((params: any) => {
    const value = params.value || "N/A";
    return React.createElement(
      "div",
      {
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: "1.2",
          padding: "2px 0",
          fontSize: "12px",
        },
        title: value,
      },
      value
    );
  }, []);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: AgGridCheckboxFilter,
      resizable: true,
      enableCellTextSelection: true,
      suppressMovable: false,
      floatingFilter: false,
    }),
    []
  );

  // Helper to process columns and add autoHeight where needed - declared BEFORE useMemo
  const processColumns = useCallback((columns: ColDef[]): ColDef[] => {
    return columns.map(col => {
      // Check if this column uses multi-line rendering
      const isMultiLine = 
        col.field === "location" || 
        col.field === "destination_name";
      
      if (isMultiLine) {
        return {
          ...col,
          autoHeight: true,
          cellRenderer: MultiLineCellRenderer,
        };
      }
      return col;
    });
  }, [MultiLineCellRenderer]);

  // AG Grid column definitions
  const columnDefs = useMemo<ColDef[]>(() => {
    // Get available fields from the first row of data (for dynamic column detection)
    const availableFields =
      streamingData.length > 0 ? Object.keys(streamingData[0]) : [];

    // Helper function to check if a field exists in the data
    const hasField = (field: string) => {
      return (
        availableFields.includes(field) ||
        streamingData.some(
          (row) =>
            row.hasOwnProperty(field) &&
            row[field as keyof VtsData] !== undefined &&
            row[field as keyof VtsData] !== null
        )
      );
    };

    // Define columns to hide based on view mode (applies to both violation and alert modes)
    const hiddenColumns: string[] = [];
    if (viewMode === "transportDiscipline") {
      // Hide ND, OS, CD for Transport Discipline
      hiddenColumns.push(
        "night_driving_count",
        "speed_violation_count",
        "continuous_driving_count"
      );
    } else if (viewMode === "safety") {
      // Hide RD, UNS, DT, PD for Safety
      hiddenColumns.push(
        "route_deviation_count_orig",
        "stoppage_violations_count",
        "device_tamper_count",
        "main_supply_removal_count"
      );
    }

    // For ITDG Alert mode, only show specific columns from API response
    const baseColumns: ColDef[] =
      mode === "alert"
        ? [
            {
              field: "slNo",
              headerName: "Sl. No.",
              flex: 0.8,
              minWidth: 80,
              sortable: true,
              filter: false,
              resizable: true,
            },
            {
              field: "zone",
              headerName: "Zone",
              flex: 1,
              minWidth: 80,
              sortable: true,
              resizable: true,
              cellRenderer: (params: any) => {
                return React.createElement(
                  "span",
                  {
                    className:
                      "inline-flex px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded",
                  },
                  params.value
                );
              },
            },
            {
              field: "location",
              headerName: "Location",
              flex: 2,
              minWidth: 150,
              sortable: true,
              resizable: true,
            },
            {
              field: "ttNumber",
              headerName: "Vehicle Number",
              flex: 1.2,
              minWidth: 120,
              sortable: true,
              resizable: true,
            },
            {
              field: "transporterName",
              headerName: "Transporter",
              flex: 1.5,
              minWidth: 150,
              sortable: true,
              resizable: true,
              cellStyle: { fontSize: "12px" },
            },
          ]
        : [
            {
              field: "slNo",
              headerName: "No",
              width: 60,
              sortable: true,
              filter: false,
              resizable: true,
            },
            {
              field: "zone",
              headerName: "Zone",
              width: 70,
              sortable: true,
              // filter: true,
              resizable: true,
              cellRenderer: (params: any) => {
                return React.createElement(
                  "span",
                  {
                    className:
                      "inline-flex px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded",
                  },
                  params.value
                );
              },
            },
            {
              field: "location",
              headerName: "Location",
              flex: 1.5,
              minWidth: 100,
              sortable: true,
              resizable: true,
            },
            {
              field: "transporterName",
              headerName: "Transporter",
              width: 140,
              sortable: true,
              // filter: true,
              resizable: true,
              cellStyle: { fontSize: "12px" },
            },
            {
              field: "created_at",
              headerName: "Invoice Date",
              width: 120,
              sortable: true,
              // filter: true,
              resizable: true,
            },
            {
              field: "destination_code",
              headerName: "Destination Code",
              width: 130,
              sortable: true,
              // filter: true,
              resizable: true,
              cellStyle: { fontSize: "12px" },
              hide: !hasField("destination_code"),
            },
            {
              field: "destination_name",
              headerName: "Destination Name",
              flex: 2,
              minWidth: 150,
              sortable: true,
              resizable: true,
              hide: !hasField("destination_name"),
            },
          ];

    if (mode === "violation") {
      baseColumns.push({
        field: "invoice_number",
        headerName: "Invoice number",
        width: 200,
        minWidth: 150,
        sortable: true,
        // filter: true,
        resizable: true,
        cellRenderer: (params: any) => {
          const value = params.value;
          const displayValue =
            value !== null && value !== undefined ? String(value) : "0";
          const className =
            value && value > 0
              ? "inline-flex items-center justify-center px-1.5 h-6 text-xs font-medium rounded text-orange-700 bg-orange-100 whitespace-nowrap"
              : "inline-flex items-center justify-center px-1.5 h-6 text-xs font-medium rounded text-gray-700 bg-gray-100 whitespace-nowrap";
          return React.createElement(
            "span",
            {
              className,
              title: displayValue, // Add tooltip with full value
              style: { overflow: "visible", textOverflow: "clip" },
            },
            displayValue
          );
        },
        cellStyle: {
          overflow: "visible",
          textOverflow: "clip",
          whiteSpace: "nowrap",
        },
      });
    }

    // Only add TT No for violation mode (already added for alert mode above)
    if (mode === "violation") {
      baseColumns.push({
        field: "ttNumber",
        headerName: "TT No",
        width: 120,
        sortable: true,
        // filter: true,
        resizable: true,
      });
    }

    // Add violation count columns
    baseColumns.push(
      {
        field: "route_deviation_count_orig",
        headerName: "RD",
        ...(mode === "alert" ? { flex: 1, minWidth: 80 } : { width: 70 }),
        sortable: true,
        // filter: true,
        resizable: true,
        hide:
          hiddenColumns.includes("route_deviation_count_orig") ||
          (mode === "violation" && !hasField("route_deviation_count_orig")),
        cellRenderer: (params: any) => {
          const value = params.value || 0;
          const colorClass = getViolationColor(value);
          return React.createElement(
            "span",
            {
              className: `inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colorClass}`,
            },
            value
          );
        },
      },
      {
        field: "stoppage_violations_count",
        headerName: "UNS",
        ...(mode === "alert" ? { flex: 1, minWidth: 80 } : { width: 70 }),
        sortable: true,
        // filter: true,
        resizable: true,
        hide:
          hiddenColumns.includes("stoppage_violations_count") ||
          (mode === "violation" && !hasField("stoppage_violations_count")),
        cellRenderer: (params: any) => {
          const value = params.value || 0;
          const colorClass = getViolationColor(value);
          return React.createElement(
            "span",
            {
              className: `inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colorClass}`,
            },
            value
          );
        },
      },
      {
        field: "device_tamper_count",
        headerName: "DT",
        ...(mode === "alert" ? { flex: 1, minWidth: 80 } : { width: 70 }),
        sortable: true,
        // filter: true,
        resizable: true,
        hide:
          hiddenColumns.includes("device_tamper_count") ||
          (mode === "violation" && !hasField("device_tamper_count")),
        cellRenderer: (params: any) => {
          const value = params.value || 0;
          const colorClass = getViolationColor(value);
          return React.createElement(
            "span",
            {
              className: `inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colorClass}`,
            },
            value
          );
        },
      },
      {
        field: "main_supply_removal_count",
        headerName: "PD",
        ...(mode === "alert" ? { flex: 1, minWidth: 80 } : { width: 70 }),
        sortable: true,
        // filter: true,
        resizable: true,
        hide:
          hiddenColumns.includes("main_supply_removal_count") ||
          (mode === "violation" && !hasField("main_supply_removal_count")),
        cellRenderer: (params: any) => {
          const value = params.value || 0;
          const colorClass = getViolationColor(value);
          return React.createElement(
            "span",
            {
              className: `inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colorClass}`,
            },
            value
          );
        },
      },
      {
        field: "night_driving_count",
        headerName: "ND",
        ...(mode === "alert" ? { flex: 1, minWidth: 80 } : { width: 70 }),
        sortable: true,
        // filter: true,
        resizable: true,
        hide:
          hiddenColumns.includes("night_driving_count") ||
          (mode === "violation" && !hasField("night_driving_count")),
        cellRenderer: (params: any) => {
          const value = params.value || 0;
          const colorClass = getViolationColor(value);
          return React.createElement(
            "span",
            {
              className: `inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colorClass}`,
            },
            value
          );
        },
      },
      {
        field: "speed_violation_count",
        headerName: "OS",
        ...(mode === "alert" ? { flex: 1, minWidth: 80 } : { width: 70 }),
        sortable: true,
        // filter: true,
        resizable: true,
        hide:
          hiddenColumns.includes("speed_violation_count") ||
          (mode === "violation" && !hasField("speed_violation_count")),
        cellRenderer: (params: any) => {
          const value = params.value || 0;
          const colorClass = getViolationColor(value);
          return React.createElement(
            "span",
            {
              className: `inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colorClass}`,
            },
            value
          );
        },
      },
      {
        field: "continuous_driving_count",
        headerName: "CD",
        ...(mode === "alert" ? { flex: 1, minWidth: 80 } : { width: 70 }),
        sortable: true,
        // filter: true,
        resizable: true,
        hide:
          hiddenColumns.includes("continuous_driving_count") ||
          (mode === "violation" && !hasField("continuous_driving_count")),
        cellRenderer: (params: any) => {
          const value = params.value || 0;
          const colorClass = getViolationColor(value);
          return React.createElement(
            "span",
            {
              className: `inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colorClass}`,
            },
            value
          );
        },
      }
    );

    if (mode === "violation") {
      baseColumns.push({
        field: "qty_shortage",
        headerName: "Qty Short",
        width: 100,
        sortable: true,
        // filter: true,
        resizable: true,
        cellRenderer: (params: any) => {
          const value = params.value;
          const className =
            value && value > 0
              ? "inline-flex items-center justify-center min-w-[32px] px-1.5 h-6 text-xs font-medium rounded text-orange-700 bg-orange-100"
              : "inline-flex items-center justify-center min-w-[32px] px-1.5 h-6 text-xs font-medium rounded text-gray-700 bg-gray-100";
          return React.createElement(
            "span",
            { className },
            value?.toFixed(1) ?? "0.0"
          );
        },
      });
    }

    return processColumns(baseColumns);
  }, [mode, getViolationColor, viewMode, streamingData, processColumns]);

  const autoSizeStrategy = useMemo<SizeColumnsToContentStrategy>(
    () => ({
      type: "fitCellContents",
    }),
    []
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openDropdown &&
        dropdownRefs.current[openDropdown] &&
        !dropdownRefs.current[openDropdown]?.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdown]);

  const handleSort = (key: keyof VtsData) => {
    const violationCountColumns = [
      "route_deviation_count_orig",
      "stoppage_violations_count",
      "device_tamper_count",
      "main_supply_removal_count",
      "night_driving_count",
      "speed_violation_count",
      "continuous_driving_count",
    ];

    let direction: "asc" | "desc" = "asc";
    if (violationCountColumns.includes(key as string)) {
      direction = "desc";
    }

    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    }

    setSortConfig({ key, direction });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Preserve column state before refresh
      const columnState = gridRef.current?.api?.getColumnState();

      await fetchStreamingData();

      // Restore column widths after refresh
      if (columnState && gridRef.current?.api) {
        setTimeout(() => {
          gridRef.current?.api?.applyColumnState({
            state: columnState,
            applyOrder: false,
          });
        }, 100);
      }

      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViolationToggle = (violationKey: string) => {
    setSelectedViolations((prev) =>
      prev.includes(violationKey)
        ? prev.filter((v) => v !== violationKey)
        : [...prev, violationKey]
    );
  };

  const clearViolationFilters = () => {
    setSelectedViolations([]);
  };

  const handlePageChange = (page: number) => {
    // Convert 1-indexed page to 0-indexed for parent
    if (onPageChange) {
      onPageChange(page - 1);
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newItemsPerPage);
    }
    // Reset to first page when page size changes
    if (onPageChange) {
      onPageChange(0);
    }
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).reduce(
      (count, filterArray) => count + filterArray.length,
      0
    );
  };

  const getUniqueValues = (column: keyof VtsData) => {
    const values = sortedData.map((row) => row[column]);
    return [...new Set(values)].sort();
  };

  const handleFilterChange = (
    column: string,
    value: string,
    checked: boolean
  ) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (!newFilters[column]) {
        newFilters[column] = [];
      }

      if (checked) {
        newFilters[column] = [...newFilters[column], value];
      } else {
        newFilters[column] = newFilters[column].filter((v) => v !== value);
      }

      if (newFilters[column].length === 0) {
        delete newFilters[column];
      }

      return newFilters;
    });
  };

  const handleDropdownSearchChange = (column: string, value: string) => {
    setDropdownSearchTerms((prev) => ({
      ...prev,
      [column]: value,
    }));
  };

  const getFilteredUniqueValues = (column: keyof VtsData) => {
    const values = sortedData.map((row) => row[column]);
    const uniqueValues = [...new Set(values)].sort();
    const searchTerm = dropdownSearchTerms[column] || "";

    if (!searchTerm) return uniqueValues;

    return uniqueValues.filter((value) =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const SortButton = ({
    column,
    children,
  }: {
    column: keyof VtsData;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:text-blue-600 transition-colors text-xs"
    >
      {children}
      {sortConfig?.key === column ? (
        sortConfig.direction === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ChevronDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  );

  const FilterDropdown = ({ column }: { column: keyof VtsData }) => {
    const filteredValues = getFilteredUniqueValues(column);
    const isOpen = openDropdown === column;
    const activeFilters = filters[column] || [];
    const columnInfo = columnConfig[column];
    const IconComponent = columnInfo?.icon || Search;
    const columnLabel = columnInfo?.label || column.toString();
    const searchTerm = dropdownSearchTerms[column] || "";

    return (
      <div
        className="relative"
        ref={(el) => (dropdownRefs.current[column] = el)}
      >
        <button
          onClick={() => setOpenDropdown(isOpen ? null : column)}
          className={`p-1 rounded hover:bg-gray-100 transition-colors ${
            activeFilters.length > 0
              ? "text-blue-600 bg-blue-50"
              : "text-gray-400"
          }`}
          title={`Filter ${columnLabel}`}
        >
          <IconComponent className="w-3 h-3" />
          {activeFilters.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-3 h-3 flex items-center justify-center text-[10px]">
              {activeFilters.length}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48 max-h-64 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">
                  Filter {columnLabel}
                </span>
                {activeFilters.length > 0 && (
                  <button
                    onClick={() =>
                      setFilters((prev) => {
                        const newFilters = { ...prev };
                        delete newFilters[column];
                        return newFilters;
                      })
                    }
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                <input
                  type="text"
                  placeholder={`Search ${columnLabel.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) =>
                    handleDropdownSearchChange(column, e.target.value)
                  }
                  className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-1 max-h-48 overflow-y-auto">
              {filteredValues.length > 0 ? (
                filteredValues.map((value) => (
                  <label
                    key={value.toString()}
                    className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={activeFilters.includes(value.toString())}
                      onChange={(e) =>
                        handleFilterChange(
                          column,
                          value.toString(),
                          e.target.checked
                        )
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700 truncate">
                      {value.toString()}
                    </span>
                  </label>
                ))
              ) : (
                <div className="p-2 text-xs text-gray-500 text-center">
                  No results found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden w-full">
      {/* Table Header with Search */}
      <div className="bg-gray-50 border-b border-gray-200 p-0">
        <div className="flex justify-between items-center">
          {/* LEFT SIDE: Search + Filters */}
          <div className="flex items-center gap-3 p-3 w-1/2">
            <div className="relative flex-1 ">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search dealers, locations, or TT numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mode Toggle Button */}
            {!hideModeToggle && (
              <div className="flex items-center gap-2">
                <div className="relative flex bg-blue-50 rounded-full p-0.5 w-fit">
                  {["violation", "alert"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setMode(item as "violation" | "alert")}
                      className={`relative z-10 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        mode === item
                          ? "text-white"
                          : "text-blue-600 hover:text-blue-800"
                      }`}
                    >
                      {mode === item && (
                        <motion.div
                          layoutId="toggle-pill"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                          className="absolute inset-0 rounded-full bg-blue-500"
                        />
                      )}
                      <span className="relative">
                        {item === "violation" ? "Violation" : "ITDG Alert"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* View Mode Toggle Button */}
            {/* <div className="flex items-center gap-2">
                            <div className="relative flex bg-green-50 rounded-full p-0.5 w-fit">
                                {[
                                    { value: 'all', label: 'All' },
                                    { value: 'transportDiscipline', label: 'Transport Discipline' },
                                    { value: 'safety', label: 'Safety' }
                                ].map((item) => (
                                    <button
                                        key={item.value}
                                        onClick={() => setViewMode(item.value as 'all' | 'transportDiscipline' | 'safety')}
                                        className={`relative z-10 px-3 py-1 text-xs font-medium rounded-full transition-colors ${viewMode === item.value
                                            ? "text-white"
                                            : "text-green-600 hover:text-green-800"
                                            }`}
                                    >
                                        {viewMode === item.value && (
                                            <motion.div
                                                layoutId="view-toggle-pill"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                className="absolute inset-0 rounded-full bg-green-500"
                                            />
                                        )}
                                        <span className="relative">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div> */}

            {getActiveFilterCount() > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {getActiveFilterCount()} filter
                  {getActiveFilterCount() !== 1 ? "s" : ""} active
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* RIGHT SIDE: Violations */}
          <div className=" justify-end px-3 py-0.5 w-1/2">
            {/* View Mode Toggle Button */}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isStreaming}
                className="p-1.5 hover:bg-white/30 rounded transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Refresh"
                title="Refresh data"
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 text-gray-700 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-gray-700 group-hover:text-blue-600 transition-all duration-300" />
                )}
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="p-1.5 hover:bg-white/30 rounded transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Download"
                title="Download excel"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 text-gray-700 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-gray-700 group-hover:text-green-600 transition-all duration-300" />
                )}
              </button>
              <div className="relative flex bg-green-100 rounded-full p-0.2 w-fit">
                {[
                  { value: "all", label: "All" },
                  {
                    value: "transportDiscipline",
                    label: "Transport Discipline",
                  },
                  { value: "safety", label: "Safety" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() =>
                      setViewMode(
                        item.value as "all" | "transportDiscipline" | "safety"
                      )
                    }
                    className={`relative z-10 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      viewMode === item.value
                        ? "text-white"
                        : "text-green-600 hover:text-green-800"
                    }`}
                  >
                    {viewMode === item.value && (
                      <motion.div
                        layoutId="view-toggle-pill"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                        className="absolute inset-0 rounded-full bg-green-500"
                      />
                    )}
                    <span className="relative">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end p-0.5">
              {selectedViolations.length > 0 && (
                <button
                  onClick={clearViolationFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 underline ml-2"
                >
                  Clear
                </button>
              )}
              {Object.entries(violationTypes)
                .filter(([key]) => {
                  // Filter violation types based on view mode
                  if (viewMode === "transportDiscipline") {
                    // Hide ND, OS, CD for Transport Discipline
                    return ![
                      "night_driving_count",
                      "speed_violation_count",
                      "continuous_driving_count",
                    ].includes(key);
                  } else if (viewMode === "safety") {
                    // Hide RD, UNS, DT, PD for Safety
                    return ![
                      "route_deviation_count_orig",
                      "stoppage_violations_count",
                      "device_tamper_count",
                      "main_supply_removal_count",
                    ].includes(key);
                  }
                  // Show all for 'all' mode
                  return true;
                })
                .map(([key, label]) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <label className="inline-flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedViolations.includes(key)}
                          onChange={() => handleViolationToggle(key)}
                          className="h-3 w-3"
                        />
                        <span>{label}</span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{violationTypeTooltips[label]}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* AG Grid Table - Just like VTSStreamingTable */}
      {(loading || isStreaming) && streamingData.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">Loading data...</p>
          </div>
        </div>
      ) : streamingError ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-red-500 text-base mb-2">Error loading data</div>
          <div className="text-gray-400 text-sm">{streamingError}</div>
        </div>
      ) : streamingData.length > 0 ? (
        filteredData.length > 0 ? (
          <div
            className="w-full overflow-x-auto"
            style={{ maxWidth: "100%", width: "100%" }}
          >
            <div
              className="ag-theme-alpine w-full"
              style={{
                height: "500px",
                width: "100%",
                minWidth: "100%",
                userSelect: "text",
                WebkitUserSelect: "text",
              }}
            >
              <AgGridReact
                ref={gridRef}
                rowData={filteredData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                pagination={true}
                paginationPageSize={50}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                animateRows={false}
                rowSelection="multiple"
                suppressRowClickSelection={true}
                suppressCellFocus={true}
                suppressScrollOnNewData={true}
                enableRangeSelection={true}
                enableCellTextSelection={true}
                ensureDomOrder={true}
                quickFilterText={searchTerm}
                rowBuffer={20}
                debounceVerticalScrollbar={true}
                suppressAggFuncInHeader={true}
                suppressMenuHide={true}
                onGridReady={(params: GridReadyEvent) => {
                  // For alert mode, always size columns to fit to fill full width
                  if (mode === "alert") {
                    params.api.sizeColumnsToFit();
                  } else if (!hasFirstDataRef.current) {
                    // For violation mode, only size columns to fit on initial load
                    params.api.sizeColumnsToFit();
                  }
                }}
                onFirstDataRendered={(params) => {
                  // For alert mode, always size columns to fit to fill full width
                  if (mode === "alert") {
                    params.api.sizeColumnsToFit();
                  } else if (!hasFirstDataRef.current) {
                    // For violation mode, only size columns to fit on first data render
                    params.api.sizeColumnsToFit();
                  }
                }}
                onRowDataUpdated={(params) => {
                  // For alert mode, always size columns to fit to fill full width
                  if (mode === "alert") {
                    params.api.sizeColumnsToFit();
                  } else if (isStreaming && streamingData.length === 0) {
                    // For violation mode, only size during initial streaming if no data exists yet
                    params.api.sizeColumnsToFit();
                  }
                }}
              />
            </div>
            {/* <div className="mt-4 text-sm text-gray-600">
                        {isStreaming ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Streaming data... ({streamingData.length} rows received)
                            </span>
                        ) : (
                            <span>Total rows: {streamingData.length}</span>
                )}
            </div> */}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-gray-500 text-base mb-2">
                No data matches the selected filters
              </div>
              <div className="text-gray-400 text-sm">
                {getActiveFilterCount() > 0 ||
                searchTerm ||
                selectedViolations.length > 0
                  ? "Try adjusting your search or filters"
                  : "No records available"}
              </div>
            </div>
          </div>
        )
      ) : !loading && !isStreaming ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-gray-500 text-base mb-2">No data found</div>
            <div className="text-gray-400 text-sm">
              {getActiveFilterCount() > 0 || searchTerm
                ? "Try adjusting your search or filters"
                : "No records available"}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">Loading data...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VTSInsightTable;
