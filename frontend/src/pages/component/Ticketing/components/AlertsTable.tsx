import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Button } from "../../../../@/components/ui/button";
import { Input } from "../../../../@/components/ui/input";
import {
  RefreshCw,
  Filter,
  MoreVertical,
  Loader,
  Triangle,
  Download,
} from "lucide-react";
import DataGrid from "@/components/common/DataGrid";
import {
  convertUTCDateToLocalDate,
  formatRelativeTime,
} from "@/hooks/useRelativeTime";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AlertHistoryDialogV2 from "../../alertsTable/AlertHistoryDialogV2";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { apiClient } from "@/services/apiClient";
import clsx from "clsx";
import * as XLSX from "xlsx";

interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string, zone?: string) => void;
  hiddenColumns?: string[];
  alertSection?: string | null;
  fieldsFor?: string;
  onRefresh?: () => void;
  onSelectionChange?: (rows: any[]) => void;
  alertStatus?: "Open" | "Close";
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

/** Header with visible "Select all" checkbox for the alerts grid */
const SelectAllHeader = (props: any) => {
  const api = props.api;
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateState = useCallback(() => {
    if (!api) return;
    const selected = api.getSelectedRows();
    const rowCount = api.getDisplayedRowCount();
    if (rowCount === 0) {
      setChecked(false);
      setIndeterminate(false);
    } else if (selected.length === 0) {
      setChecked(false);
      setIndeterminate(false);
    } else if (selected.length >= rowCount) {
      setChecked(true);
      setIndeterminate(false);
    } else {
      setChecked(false);
      setIndeterminate(true);
    }
  }, [api]);

  useEffect(() => {
    if (!api) return;
    updateState();
    const listener = () => updateState();
    api.addEventListener("selectionChanged", listener);
    api.addEventListener("modelUpdated", listener);
    return () => {
      api.removeEventListener("selectionChanged", listener);
      api.removeEventListener("modelUpdated", listener);
    };
  }, [api, updateState]);

  useEffect(() => {
    const el = inputRef.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!api) return;
      if (e.target.checked) {
        // Infinite row model: select all currently loaded/displayed rows only
        api.forEachNode((node) => {
          if (node.data != null) node.setSelected(true);
        });
      } else {
        api.deselectAll();
      }
      updateState();
    },
    [api, updateState]
  );

  if (!api) return null;

  return (
    <div className="flex items-center justify-center w-full h-full ag-header-cell-label">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="h-4 w-4 rounded border-gray-400 cursor-pointer accent-blue-600"
        aria-label="Select all rows"
      />
    </div>
  );
};

export const AlertsTable: React.FC<ROAlertsTableV2Props> = ({
  query = "",
  onLocationChange,
  hiddenColumns = [],
  alertSection,
  fieldsFor,
  onRefresh,
  onSelectionChange,
  alertStatus,
}) => {
  // const gridApi = useRef<any>(null);

  const onGridReady = useCallback(
    (params: any) => {
      gridApi.current = params.api;
      params.api.sizeColumnsToFit();

      params.api.addEventListener("selectionChanged", () => {
        const selectedRows = params.api.getSelectedRows();
        if (onSelectionChange) {
          onSelectionChange(selectedRows);
        }
      });
    },
    [onSelectionChange]
  );
  const [pageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>("");
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "unique_id",
    "sap_id",
    "region",
    "location_name",
    "vehicle_number",
    "severity",
    "alert_status",
    "interlock_name",
    "created_at",
    "updated_at",
    "device_type",
    "device_name",
    "assigned_user_roles",
    "last_escalated_to",
    "zone",
    "last_notified_to",
    "actions",
  ]);
  const [historyDialogState, setHistoryDialogState] =
    useState<HistoryDialogState>({
      isOpen: false,
      alertId: null,
    });
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const gridApi = React.useRef<any>(null);
  const [selectedSapId, setSelectedSapId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const downloadExcel = useCallback(async () => {
    setIsDownloading(true);
    try {
      let params: any = {
        skip: 0,
        limit: 10000,
        sort: JSON.stringify({ created_at: "desc" }),
      };

      // Build final query string, including alert_status inside q
      let finalQuery = query?.trim() || "";

      if (alertStatus) {
        const statusCondition = `alert_status='${alertStatus}'`;
        finalQuery = finalQuery
          ? `${finalQuery} AND ${statusCondition}`
          : statusCondition;
      }

      if (finalQuery) {
        params.q = finalQuery;
      }

      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }

      console.log("Download Excel params:", params);

      const response = await apiClient.get("/api/alerts", { params });
      const data = response.data.data;

      // Prepare data for Excel export
      const excelData = data.map((item: any) => {
        // Format alert history
        const alertHistory =
          item.alert_history?.map((history: any) => ({
            action_type: history.action_type || "",
            action_msg: history.action_msg || "",
            processed_time: history.processed_time || "",
            duration: history.duration || "",
          })) || [];

        // Format dates - simple format for external_timestamp
        const formatDate = (dateStr: string) => {
          if (!dateStr) return "";
          try {
            return dayjs(dateStr).format("MMM D, YYYY, hh:mm A");
          } catch {
            return dateStr;
          }
        };

        // Format Novex Created At - same logic as ag-grid cell renderer
        const formatNovexCreatedAt = (dateStr: string) => {
          if (!dateStr) return "";
          try {
            const utcDate = new Date(dateStr);
            const localDate = convertUTCDateToLocalDate(utcDate);

            return localDate.toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
          } catch (error) {
            return "Invalid date";
          }
        };

        return {
          "Alert ID": item.unique_id || "",
          "Location ID": item.sap_id || "",
          "Location Name": item.location_name || "",
          "Vehicle Number": item.vehicle_number || "",
          Region: item.region || "",
          Zone: item.zone || "",
          Alert: item.interlock_name || "",
          Severity: item.severity || "",
          "Novex Created At": formatNovexCreatedAt(item.created_at),
          "Alert History": JSON.stringify(alertHistory, null, 2),
        };
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map((key) => ({
        wch: Math.max(
          key.length,
          ...excelData.map((row) => String(row[key] || "").length)
        ),
      }));
      worksheet["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Alerts");

      // Generate filename with timestamp
      const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
      const filename = `SOD_Alerts_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      toast.error("Failed to download Excel file");
    } finally {
      setIsDownloading(false);
    }
  }, [query, debouncedSearchText, alertStatus]);

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId,
    });
  }, []);

  const fetchData = useCallback(
    async (startRow: number, endRow: number, sortModel?: any) => {
      setIsLoading(true);
      try {
        const currentPageNumber = Math.floor(startRow / pageSize);

        let params: any = {
          skip: currentPageNumber,
          limit: pageSize,
          sort: sortModel?.length
            ? JSON.stringify({ [sortModel[0].colId]: sortModel[0].sort })
            : JSON.stringify({ created_at: "desc" }),
        };

        // Build final query string, including alert_status inside q
        let finalQuery = query?.trim() || "";

        if (alertStatus) {
          const statusCondition = `alert_status='${alertStatus}'`;
          finalQuery = finalQuery
            ? `${finalQuery} AND ${statusCondition}`
            : statusCondition;
        }

        if (finalQuery) {
          params.q = finalQuery;
        }

        if (debouncedSearchText.trim()) {
          params.search_text = debouncedSearchText;
        }

        console.log("Fetch data params:", params);

        const response = await apiClient.get("/api/alerts", { params });

        setCurrentPage(currentPageNumber);

        return {
          data: response.data.data,
          lastRow: response.data.total,
        };
      } catch (err) {
        console.error("Error fetching alerts:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [query, debouncedSearchText, pageSize, alertStatus]
  );

  const dataSource = useMemo(
    () => ({
      getRows: async (params: any) => {
        try {
          const result = await fetchData(
            params.startRow,
            params.endRow,
            params.sortModel
          );
          params.successCallback(result.data, result.lastRow);
        } catch (err) {
          params.failCallback();
        }
      },
    }),
    [fetchData]
  );

  // Don't refresh grid when query changes to preserve user selections
  // Users expect to accumulate selections across different alert types
  // useEffect(() => {
  //   if (gridApi.current) {
  //     console.log("Query changed, refreshing grid. New query:", query);
  //     gridApi.current.refreshInfiniteCache();
  //     setCurrentPage(0);
  //   }
  // }, [query]); // Added query as dependency

  useEffect(() => {
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0);
    }
  }, [debouncedSearchText, alertStatus]);

  // const onGridReady = useCallback((params: any) => {
  //   gridApi.current = params.api;
  //   params.api.sizeColumnsToFit();
  // }, []);

  const [rotating, setRotating] = useState(false);

  const handleLocationClick = useCallback(
    (sapId: string, zone?: string) => {
      setSelectedSapId(sapId);
      setSelectedZone(zone || null);
      localStorage.setItem("sapId", sapId);
      localStorage.setItem("zone", zone);
      if (onLocationChange) {
        onLocationChange(sapId, zone);
      } else {
        navigate(`/location/${sapId}`);
      }
    },
    [onLocationChange, navigate]
  );

  const handleRefresh = useCallback(() => {
    setRotating(true);
    setSearchText("");

    if (onRefresh) {
      onRefresh();
    }

    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0);
    }
    setTimeout(() => {
      setRotating(false);
    }, 1000);
  }, [onLocationChange, onRefresh]);

  // Cell Renderer Components
  const SeverityIndicator = useCallback(({ severity }) => {
    const colorMap = {
      Critical: "text-red-600",
      High: "text-orange-600",
      Medium: "text-yellow-600",
      Low: "text-green-600",
    };

    return (
      <div
        className={`flex items-center mt-3 space-x-1 ${
          colorMap[severity] || "text-gray-600"
        } text-xs`}
      >
        <Triangle className="h-3 w-3" />
        <span>{severity}</span>
      </div>
    );
  }, []);

  const columnDefs = useMemo(
    () => [
      {
        headerName: "",
        field: "checkbox",
        checkboxSelection: true,
        headerCheckboxSelection: false,
        headerComponent: SelectAllHeader,
        width: 50,
        minWidth: 50,
        maxWidth: 50,
        pinned: "left",
        lockPosition: true,
        suppressMenu: true,
        sortable: false,
        resizable: false,
        suppressSizeToFit: true,
      },
      {
        headerName: "Location ID",
        field: "sap_id",
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => (
          <span
            className="text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => handleLocationClick(params.value)}
          >
            {params.value}
          </span>
        ),
        hide: !selectedColumns.includes("sap_id"),
      },
      {
        headerName: "Location Name",
        field: "location_name",
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => (
          <span
            className="text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => handleLocationClick(params.data.sap_id)}
          >
            {params.value}
          </span>
        ),
        hide: !selectedColumns.includes("location_name"),
      },
      {
        headerName: "Vehicle Number",
        field: "vehicle_number",
        sortable: true,
        filter: true,
        hide: !selectedColumns.includes("vehicle_number"),
      },
      {
        headerName: "Alert",
        field: "interlock_name",
        sortable: true,
        filter: true,
        hide: !selectedColumns.includes("interlock_name"),
      },
      {
        headerName: "Alert ID",
        field: "unique_id",
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => (
          <span
            className="text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => handleViewHistory(params.data.id)}
          >
            {params.value}
          </span>
        ),
        hide: !selectedColumns.includes("unique_id"),
      },
      {
        headerName: "Severity",
        field: "severity",
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => (
          <SeverityIndicator severity={params.value} />
        ),
        hide: !selectedColumns.includes("severity"),
      },
      {
        headerName: "Alert Status",
        field: "alert_status",
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => {
          const status = (params.value || "").toString();
          const isClosed =
            status.toLowerCase() === "close" || status.toLowerCase() === "closed";
          const isOpen = status.toLowerCase() === "open";

          const baseClasses =
            "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] leading-tight font-medium";

          let statusClasses = "bg-gray-100 text-gray-700";
          if (isOpen) {
            statusClasses = "bg-emerald-100 text-emerald-700";
          } else if (isClosed) {
            statusClasses = "bg-red-100 text-red-700";
          }

          return (
            <span className={`${baseClasses} ${statusClasses}`}>
              {status || "-"}
            </span>
          );
        },
        hide: !selectedColumns.includes("alert_status"),
      },
      {
        headerName: " Created At",
        field: "created_at",
        sortable: true,
        filter: true,
        minWidth: 150,
        maxWidth: 300,
        cellRenderer: (params: any) => {
          if (!params.value) return "";

          try {
            const utcDate = new Date(params.value);
            const localDate = convertUTCDateToLocalDate(utcDate);

            const formattedDateTime = localDate.toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });

            const relativeTime = formatRelativeTime(params.value);

            return (
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">{relativeTime}</span>
                <span className="text-xs text-gray-500">
                  {formattedDateTime}
                </span>
              </div>
            );
          } catch (error) {
            return "Invalid date";
          }
        },
        hide: !selectedColumns.includes("created_at"),
      },
        {
        headerName: " Updated At",
        field: "updated_at",
        sortable: true,
        filter: true,
        minWidth: 150,
        maxWidth: 300,
        cellRenderer: (params: any) => {
          if (!params.value) return "";

          try {
            const utcDate = new Date(params.value);
            const localDate = convertUTCDateToLocalDate(utcDate);

            const formattedDateTime = localDate.toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });

            const relativeTime = formatRelativeTime(params.value);

            return (
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">{relativeTime}</span>
                <span className="text-xs text-gray-500">
                  {formattedDateTime}
                </span>
              </div>
            );
          } catch (error) {
            return "Invalid date";
          }
        },
        hide: !selectedColumns.includes("updated_at"),
      },
      {
        headerName: "Actions",
        field: "actions",
        sortable: false,
        filter: false,
        width: 100,
        minWidth: 100,
        maxWidth: 100,
        pinned: "right",
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
        hide:
          !selectedColumns.includes("actions") ||
          hiddenColumns.includes("actions"),
      },
    ],
    [selectedColumns, handleViewHistory, hiddenColumns, handleLocationClick]
  );

  const autoSizeStrategy = useMemo(() => {
    return {
      type: "fitCellContents",
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
          <Download
            className={clsx("mr-2 h-4 w-4", { "animate-spin": isDownloading })}
          />
          {isDownloading ? "Downloading..." : "Download"}
        </Button>

        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw
            className={clsx("mr-2 h-4 w-4 transition-transform", {
              "animate-spin": rotating,
            })}
          />
          Refresh
        </Button>
      </div>

      <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        {/* <DataGrid
          columnDefs={columnDefs
            .filter((col) => {
              if (fieldsFor === "SOD" || fieldsFor === "RO") {
                return col.field !== "assigned_user_roles" && col.field !== "last_escalated_to" && col.field !== "interlock_name";
              }
              return true;
            })}
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
            resizable: true,
            sortable: true,
            filter: false,
            suppressMenu: true,
            autoSizeStrategy,
          }}
        /> */}

        <DataGrid
          columnDefs={columnDefs.filter((col) => {
            if (fieldsFor === "SOD" || fieldsFor === "RO") {
              return (
                col.field !== "assigned_user_roles" &&
                col.field !== "last_escalated_to"
              );
            }
            return true;
          })}
          height="610px"
          pagination={true}
          paginationPageSize={pageSize}
          rowSelection="multiple"
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
        } } onRequestDocumentUpload={undefined}      />
    </div>
  );
};
