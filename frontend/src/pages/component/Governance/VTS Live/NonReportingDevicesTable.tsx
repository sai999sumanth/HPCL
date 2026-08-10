import React, { useState, useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { apiClient } from "@/services/apiClient";
import { Loader2, RefreshCw, Search, X, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
const formatHeader = (key: string): string => {
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

const isLatLonColumn = (key: string): boolean => {
  const k = key.toLowerCase();
  return (
    k === "latitude" ||
    k === "longitude" ||
    k === "lat" ||
    k === "lon" ||
    k === "lng" ||
    k.includes("latitude") ||
    k.includes("longitude") ||
    k === "vehicle_latitude" ||
    k === "vehicle_longitude"
  );
};

const getMapUrlFromRow = (row: any, cellValue?: any): string | null => {
  if (!row) return null;
  let lat = row.vehicle_latitude ?? row.latitude ?? row.lat ?? row.Latitude;
  let lng = row.vehicle_longitude ?? row.longitude ?? row.lon ?? row.lng ?? row.Longitude;
  if ((lat == null || lng == null || lat === "" || lng === "") && cellValue != null && cellValue !== "") {
    const str = String(cellValue).trim();
    const parts = str.split(/[\s,]+/).filter(Boolean);
    if (parts.length >= 2) {
      lat = parts[0];
      lng = parts[1];
    }
  }
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return null;
  return `https://www.google.com/maps?q=${latNum},${lngNum}`;
};

interface NonReportingDevicesTableProps {
  selectedBu: string;
  selectedZone?: string | null;
  selectedPlant?: string | null;
  crossFilters?: any[];
  baseFilters: any[];
  status?: "live" | "closed";
}

export const NonReportingDevicesTable: React.FC<NonReportingDevicesTableProps> = ({
  selectedBu,
  selectedZone,
  selectedPlant,
  crossFilters = [],
  baseFilters,
  status = "live",
}) => {
  const [tableData, setTableData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const gridRef = useRef<AgGridReact>(null);

  const fetchTableData = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        filters: baseFilters,
        action: "non_reporting_devices",
        cross_filters: crossFilters,
        payload: { status },
        drill_state: "",
      };
      const response = await apiClient.post("/api/charts/generate_vis_data", payload, {
        headers: { "Content-Type": "application/json" },
      });
      const data = response.data?.data;
      if (data && Array.isArray(data)) {
        setTableData(data);
      } else {
        setTableData([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Error fetching data.");
      setTableData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [selectedBu, selectedZone, selectedPlant, crossFilters, status]);

  const columnDefs = useMemo<ColDef[]>(() => {
    if (!tableData || tableData.length === 0) return [];
    const firstRow = tableData[0];
    const keys = Object.keys(firstRow);
    return keys.map((key) => {
      const isNumeric = typeof firstRow[key] === "number";
      const isLatLon = isLatLonColumn(key);
      const col: ColDef = {
        field: key,
        headerName: formatHeader(key),
        sortable: true,
        resizable: true,
        filter: false,
        flex: 1,
        minWidth: 100,
        valueFormatter: isNumeric
          ? (params) => (params.value != null ? Number(params.value).toLocaleString() : "")
          : (params) => (params.value != null && params.value !== "" ? String(params.value) : "-"),
        cellStyle: isNumeric ? { textAlign: "right", fontSize: "12px" } : { textAlign: "left", fontSize: "12px" },
      };
      if (isLatLon) {
        col.cellRenderer = (params: any) => {
          const value = params.value != null && params.value !== "" ? String(params.value) : "—";
          const url = getMapUrlFromRow(params.data, params.value);
          if (url) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(url, "_blank");
                }}
              >
                {value}
              </a>
            );
          }
          return <span>{value}</span>;
        };
      }
      return col;
    });
  }, [tableData]);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      enableCellTextSelection: true,
      suppressCellFocus: true,
      cellStyle: { fontSize: "12px" },
    }),
    []
  );

  const filteredTableData = useMemo(() => {
    if (!tableData || tableData.length === 0 || !searchValue.trim()) return tableData || [];
    const q = searchValue.toLowerCase().trim();
    return tableData.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [tableData, searchValue]);

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header - same as OngoingTripChartTable */}
      <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-800">TT with Non reporting devices</h4>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => fetchTableData()} disabled={loading}>
                    <RefreshCw className="w-4 h-4 text-gray-700 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-300" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Bottom Table only - same wrapper as OngoingTripChartTable */}
      <div className="px-4 pb-2 mt-2">
        <div className="rounded-xl shadow-lg overflow-hidden border border-gray-200 bg-white">
          {tableData && tableData.length > 0 && !loading && !error && (
            <div className="p-2 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search table..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchValue && (
                <button
                  onClick={() => setSearchValue("")}
                  className="px-2 py-1 text-sm font-medium rounded-md transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <div style={{ height: "500px", width: "100%" }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <span className="text-gray-700 font-medium mt-3 text-sm">Loading table data...</span>
              </div>
            ) : error ? (
              <div className="m-6">
                <div className="flex items-center p-5 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 rounded-xl shadow-lg">
                  <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                  <span className="text-red-900 font-medium">{error}</span>
                </div>
              </div>
            ) : filteredTableData && filteredTableData.length > 0 && columnDefs.length > 0 ? (
              <div
                className="ag-theme-alpine"
                style={{
                  height: "100%",
                  width: "100%",
                  userSelect: "text",
                  WebkitUserSelect: "text",
                }}
              >
                <AgGridReact
                  ref={gridRef}
                  rowData={filteredTableData}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  headerHeight={24}
                  pagination={true}
                  paginationPageSize={50}
                  paginationPageSizeSelector={[10, 20, 50, 100]}
                  animateRows={false}
                  suppressRowClickSelection={true}
                  suppressCellFocus={true}
                  enableCellTextSelection={true}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <AlertTriangle className="w-10 h-10 mb-2" />
                <span className="text-sm font-medium">No table data available</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NonReportingDevicesTable;
