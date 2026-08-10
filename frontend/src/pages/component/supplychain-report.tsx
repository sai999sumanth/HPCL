import { Card, CardContent, CardHeader } from "@/@/components/ui/card";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import {
  ClientSideRowModelModule,
  ColDef,
  ModuleRegistry,
  CsvExportModule,
  SizeColumnsToContentStrategy,
  SizeColumnsToFitGridStrategy,
  SizeColumnsToFitProvidedWidthStrategy,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

ModuleRegistry.registerModules([ClientSideRowModelModule, CsvExportModule]);

import "ag-grid-community/styles/ag-theme-quartz.css";
import "ag-grid-community/styles/ag-grid.css";
import { Button } from "@/@/components/ui/button";
import { RiFileExcel2Fill } from "react-icons/ri";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import dayjs from "dayjs";
import { toast } from "sonner";
import ApiLoader from "@/services/apiLoader";
import { apiClient } from "@/services/apiClient";
import * as XLSX from "xlsx";
import clsx from "clsx";

// ---------------------------------------------------------------------------
// Helper function to extract complete JSON objects from a string
// ---------------------------------------------------------------------------
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

const SupplyChainReport = () => {
  const [selectedFilter, setSelectedFilter] = useState<string[]>(["DRY_OUT"]);
  const [currentPage, setCurrentPage] = useState<number>(1); // 1-indexed
  const [itemsPerPage, setItemsPerPage] = useState<number>(100); // Configurable, default 200
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [dryoutColumn, setDryoutColumn] = useState<ColDef[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [streamingData, setStreamingData] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);

  const gridStyle = useMemo(() => ({ height: "100%", width: "100%" }), []);
  const gridRef = useRef<AgGridReact<any>>(null);
  const currentDateTime = dayjs().format("DDMMYYYYHH:mm:ss");
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFirstDataRef = useRef<boolean>(false);
  const chunkQueueRef = useRef<any[]>([]);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentDataLengthRef = useRef<number>(0);
  const lastFetchParamsRef = useRef<string>("");
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const syncScrollbarRef = useRef<(() => void) | null>(null);

  const filterOptions: any = [
    { name: "Dryout", id: "DRY_OUT" },
    { name: "Intra Day Dryout", id: "INTRA_DAY_DRY_OUT" },
  ];

  // -------------------------------------------------------------------------
  // Streaming fetch function with newline batch splitting
  // -------------------------------------------------------------------------
  const fetchStreamingData = useCallback(async (filterValues: string[], page: number, pageSize: number) => {
    const fetchKey = JSON.stringify({ filterValues, page, pageSize });

    if (lastFetchParamsRef.current === fetchKey) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    lastFetchParamsRef.current = fetchKey;
    const currentFetchKey = fetchKey;

    setIsLoading(true);
    setIsStreaming(true);
    setStreamingError(null);
    setStreamingData([]);
    setDryoutColumn([]);
    hasFirstDataRef.current = false;
    currentDataLengthRef.current = 0;
    chunkQueueRef.current = [];
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }

    // Function to extract total_records from API response (checking multiple possible field names)
    const extractTotalRecords = (responseData: any) => {
      if (typeof responseData?.total_count === 'number') return responseData.total_count;
      if (typeof responseData?.total_records === 'number') return responseData.total_records;
      if (typeof responseData?.totalRecords === 'number') return responseData.totalRecords;
      if (typeof responseData?.total === 'number') return responseData.total;
      if (typeof responseData?.count === 'number') return responseData.count;
      if (typeof responseData?.payload?.total_count === 'number') return responseData.payload.total_count;
      if (typeof responseData?.payload?.total_records === 'number') return responseData.payload.total_records;
      if (typeof responseData?.payload?.totalRecords === 'number') return responseData.payload.totalRecords;
      if (typeof responseData?.payload?.total === 'number') return responseData.payload.total;
      // If no total found, use the length of current data as fallback (but this shouldn't happen)
      return 0;
    };

    // Function to add chunks to the queue and process them
    const addToChunkQueue = (data: any[], isCurrent: () => boolean) => {
      // console.log("addToChunkQueue called with data length:", data.length);
      if (!isCurrent() || data.length === 0) return;

      // Split data into chunks of 1000
      for (let i = 0; i < data.length; i += 1000) {
        const chunk = data.slice(i, i + 1000);
        chunkQueueRef.current.push(chunk);
        // console.log(`Queued chunk of ${chunk.length} records, queue length now: ${chunkQueueRef.current.length}`);
      }

      // Start interval if not already running
      if (!chunkIntervalRef.current) {
        // console.log("Starting chunk processing interval");
        chunkIntervalRef.current = setInterval(() => {
          // console.log("Interval tick, queue length:", chunkQueueRef.current.length);
          if (chunkQueueRef.current.length > 0 && isCurrent()) {
            const chunk = chunkQueueRef.current.shift();
            if (chunk && chunk.length > 0) {
              // console.log(`Processing chunk of ${chunk.length} records`);
              if (!hasFirstDataRef.current) {
                hasFirstDataRef.current = true;
                flushSync(() => {
                  setStreamingData(chunk);
                  if (chunk[0]) {
                    const columns: ColDef[] = Object.keys(chunk[0]).map((key) => ({
                      field: key,
                      sortable: true,
                      width: 180,
                      minWidth: 180,
                      maxWidth: 250,
                      suppressSizeToFit: true,
                    }));
                    setDryoutColumn(columns);
                  }
                  currentDataLengthRef.current = chunk.length;
                });
              } else {
                setStreamingData((prevData) => {
                  const newData = [...prevData, ...chunk];
                  currentDataLengthRef.current = newData.length;
                  return newData;
                });
              }
            }
          } else {
            // Clear interval if queue is empty or fetch is not current
            if (chunkIntervalRef.current) {
              // console.log("Clearing chunk processing interval");
              clearInterval(chunkIntervalRef.current);
              chunkIntervalRef.current = null;
            }
          }
        }, 100); // Process chunks every 100ms
      }
    };

    const isCurrentFetch = () => lastFetchParamsRef.current === currentFetchKey;

    try {
      const res = await apiClient.postStream(
        "/api/indentdryout/get_dryout_report",
        {
          dry_out_in_days: filterValues,
          page: page,
          page_size: pageSize,
          action: null
        }
      );

      // console.log("Starting to read from streaming response...");
      const reader = res.data.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (!isCurrentFetch()) {
          // console.log("Fetch cancelled - parameters changed");
          reader.cancel();
          if (chunkIntervalRef.current) {
            clearInterval(chunkIntervalRef.current);
            chunkIntervalRef.current = null;
          }
          break;
        }

        const { value, done } = await reader.read();
        // console.log("Got value from reader:", value, "done:", done);

        if (done) {
          // console.log("Stream done, buffer length:", buffer.length);
          // Process any remaining buffer
          if (buffer.trim()) {
            const { parsed } = extractCompleteJSON(buffer);
            // console.log("Parsed from remaining buffer:", parsed);
            for (const item of parsed) {
              // Try to extract total records from each parsed item
              if (isCurrentFetch()) {
                const totalFromApi = extractTotalRecords(item);
                if (totalFromApi > 0) {
                  setTotalRecords(totalFromApi);
                }
              }
              
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

              // console.log("Extracted data array from remaining buffer:", dataArray);
              if (dataArray.length > 0 && isCurrentFetch()) {
                addToChunkQueue(dataArray, isCurrentFetch);
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        // console.log("Current buffer length:", buffer.length);
        const { parsed, remaining } = extractCompleteJSON(buffer);
        // console.log("Extracted parsed items:", parsed);
        buffer = remaining;

        for (const item of parsed) {
          try {
            // Try to extract total records from each parsed item
            if (isCurrentFetch()) {
              const totalFromApi = extractTotalRecords(item);
              if (totalFromApi > 0) {
                setTotalRecords(totalFromApi);
              }
            }
            
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
              addToChunkQueue(dataArray, isCurrentFetch);
            }
          } catch (error) {
            // console.error("Error processing parsed item:", error, item);
          }
        }
      }

      if (isCurrentFetch()) {
        // Keep streaming true until all chunks are processed
        const checkChunksDone = setInterval(() => {
          if (chunkQueueRef.current.length === 0) {
            clearInterval(checkChunksDone);
            if (chunkIntervalRef.current) {
              clearInterval(chunkIntervalRef.current);
              chunkIntervalRef.current = null;
            }
            setIsStreaming(false);
          }
        }, 100);
      } else {
        // console.log("Fetch completed but parameters changed - discarding results");
        chunkQueueRef.current = [];
        if (chunkIntervalRef.current) {
          clearInterval(chunkIntervalRef.current);
          chunkIntervalRef.current = null;
        }
        setIsStreaming(false);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // console.log("Fetch aborted");
        setIsStreaming(false);
        return;
      }
      // console.error("Streaming error:", err);
      setStreamingError(err.message || "Failed to fetch data");
      toast.error("Failed to fetch report data");
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Keep ref in sync with state (exact from VTSInsightTable)
  useEffect(() => {
    currentDataLengthRef.current = streamingData.length;
  }, [streamingData]);

  // Reset data on filter change
  useEffect(() => {
    setStreamingData([]);
    setDryoutColumn([]);
    setCurrentPage(1); // Reset to 1-indexed first page
    setTotalRecords(0); // Reset total records count
    hasFirstDataRef.current = false;
    currentDataLengthRef.current = 0;
    chunkQueueRef.current = [];
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
  }, [selectedFilter]);

  // Fetch on mount/filter/page change
  useEffect(() => {
    if (selectedFilter.length === 0) return;
    fetchStreamingData(selectedFilter, currentPage, itemsPerPage);
  }, [selectedFilter, currentPage, itemsPerPage, fetchStreamingData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
      }
    };
  }, []);

  const defaultColDef: ColDef = {
    flex: 1,
    resizable: true,
    floatingFilter: false,
    suppressSizeToFit: true,
  };

  const autoSizeStrategy = useMemo<
    | SizeColumnsToFitGridStrategy
    | SizeColumnsToFitProvidedWidthStrategy
    | SizeColumnsToContentStrategy
  >(() => {
    return {
      type: "fitCellContents",
      defaultMinWidth: 200,
    };
  }, [streamingData]);

  const gridTheme = {
    "--ag-header-height": "40px",
    "--ag-header-foreground-color": "white",
    "--ag-header-background-color": "rgba(7, 82, 140, 0.98)",
    "--ag-header-cell-hover-background-color": "rgba(0, 58, 89, 0.66)",
    "--ag-header-cell-moving-background-color": "rgb(40, 100, 140)",
    "--ag-font-size": "14px",
    "--ag-font-family": "inherit",
    "--ag-row-hover-color": "rgba(9, 122, 209, 0.1)",
    "--ag-selected-row-background-color": "rgb(200, 214, 254)",
    "--ag-odd-row-background-color": "rgb(252, 252, 252)",
    "--ag-header-column-resize-handle-color": "white",
    "--ag-header-column-resize-handle-width": "4px",
    "--ag-icon-font-color-menu": "white",
    "--ag-icon-font-color-filter": "white",
    "--ag-icon-font-color-asc": "white",
    "--ag-icon-font-color-desc": "white",
  } as React.CSSProperties;

const excelExport = async () => {
  setIsDownloading(true);
  try {
    const payload = {
      dry_out_in_days: selectedFilter,
      action: "download"
    };

    const response = await apiClient.post("/api/indentdryout/get_dryout_report", payload);
    const result = response.data;

    if (result.status) {
      // Decode base64 back to binary
      const byteCharacters = atob(result.file_data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.mime_type });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Downloaded Successfully");
    } else {
      toast.error(result.message || "Failed to download Excel file");
    }
  } catch (error) {
    console.error("Error downloading Excel file:", error);
    toast.error("Failed to download Excel file");
  } finally {
    setIsDownloading(false);
  }
};


  const totalPages = Math.ceil(totalRecords / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage; // Convert to 0-indexed for display
  const endIndex = Math.min(startIndex + itemsPerPage, totalRecords);

  // Page change handler
  const handlePageChange = (page: number) => {
    // Ensure page is at least 1
    const validPage = Math.max(1, page);
    setCurrentPage(validPage);
  };

  // Items per page change handler
  const handleItemsPerPageChange = (num: number) => {
    setItemsPerPage(num);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

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
}, [streamingData]);

useEffect(() => {
  if (syncScrollbarRef.current) {
    requestAnimationFrame(() => { syncScrollbarRef.current?.(); });
  }
}, [streamingData, isLoading]);


  return (
    <Card className="p-0">
       {isLoading && <ApiLoader loading={isLoading} />} 
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <CustomMultiSelect
              options={filterOptions}
              value={selectedFilter}
              defaultValue={selectedFilter}
              placeholder="Select Dryout"
              variant="secondary"
              animation={0}
              maxCount={0}
              className="w-64"
              onValueChange={setSelectedFilter}
            />
            <Button
              variant="outline"
              size="lg"
              className=""
              onClick={excelExport}
              disabled={isDownloading}
            >
              <RiFileExcel2Fill
                className={clsx("w-5 h-5 text-green-700 mr-1", {
                  "animate-spin": isDownloading,
                })}
              />
              {isDownloading ? "Downloading..." : "Download Excel"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
      <div style={gridStyle} className="relative"> 
       
          <div
  ref={gridContainerRef}
  className="ag-theme-quartz"
  style={{ ...gridTheme, height: "575px", width: "100%" }}
>
            <AgGridReact
              ref={gridRef}
              rowData={streamingData}
              columnDefs={dryoutColumn}
              defaultColDef={defaultColDef}
              animateRows={true}
              pagination={false} // Disable built-in pagination since we're using custom
              suppressScrollOnNewData={true}
              suppressMovableColumns={false}
              enableRangeSelection={true}
              enableAdvancedFilter={false}
              autoSizeStrategy={autoSizeStrategy}
              rowSelection="multiple"
              suppressCellFocus={false}
              skipHeaderOnAutoSize={false}
            />
          </div>
        </div>
      </CardContent>
      {/* Pagination controls below table */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 border-t border-gray-300 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border-2 border-gray-300 rounded-lg bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors font-medium"
            >
              {[10, 20, 50, 100, 200].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
            <span className="text-sm font-medium text-gray-700">entries</span>
          </div>
          <div className="text-sm font-medium text-gray-700 bg-white px-2 py-1.5 rounded-lg border border-gray-200 shadow-sm">
            {totalRecords > 0 ? (
              <>
                Showing <span className="font-bold text-gray-900">{startIndex + 1}</span> to <span className="font-bold text-gray-900">{endIndex}</span> of <span className="font-bold text-gray-900">{totalRecords}</span> entries
              </>
            ) : (
              <>
                Showing <span className="font-bold text-gray-900">{streamingData.length}</span> entries
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading || isStreaming}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {totalRecords > 0 ? (
              Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 5 + i + 1;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${currentPage === pageNum
                      ? "bg-blue-500 text-white"
                      : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })
            ) : (
              // If we don't have totalRecords yet, just show current page and maybe next one
              <>
                <button
                  key={currentPage}
                  onClick={() => handlePageChange(currentPage)}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-blue-500 text-white"
                >
                  {currentPage}
                </button>
                {streamingData.length >= itemsPerPage && (
                  <button
                    key={currentPage + 1}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="px-3 py-1.5 text-sm font-medium rounded text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400"
                  >
                    {currentPage + 1}
                  </button>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={
              // If we know totalRecords, use that. Otherwise use if we got the full page size
              (totalRecords > 0 ? currentPage >= totalPages : streamingData.length < itemsPerPage) || 
              isLoading || 
              isStreaming
            }
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </Card>
  );
};

export default SupplyChainReport;
