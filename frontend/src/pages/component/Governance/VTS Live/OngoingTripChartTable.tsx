import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Loader2,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Home,
  Building,
  Truck,
  AlertTriangle,
  Car,
  Download,
  Search,
  X,
  Plus,
  Minimize2,
  MoreHorizontal,
  MoreVertical,
} from "lucide-react";
import { CreateTicketDialog } from "@/pages/component/Ticketing2/components/CreateTicketDialog";
import TicketDialogModal from "@/pages/component/Ticketing2/components/TicketDialogModal";
import { apiClient } from "@/services/apiClient";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Button } from "@/@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";

import { toast } from "sonner";
import useAuthStore from "@/store/authStore";
// UPDATED: Added status prop and onTotalRecords callback
interface OngoingTripChartTableProps {
  tripType: "RD" | "HS" | "TC" | "WR" | "EM";
  title: string;
  selectedBu: string;
  selectedZone?: string | null;
  selectedPlant?: string | null;
  crossFilters?: any[];
  baseFilters: any[];
  status?: "live" | "closed";
  onTotalRecords?: (info: { count: number | null; loading: boolean; error: string | null }) => void;
}

export const OngoingTripChartTable: React.FC<OngoingTripChartTableProps> = ({
  tripType,
  title,
  selectedBu,
  selectedZone,
  selectedPlant,
  crossFilters = [],
  baseFilters,
  status, // NEW: Destructure status prop
  onTotalRecords,
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<any[] | null>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [drillDownError, setDrillDownError] = useState<string | null>(null);
  const [drillDownFilters, setDrillDownFilters] = useState<
    { key: string; value: string }[]
  >([]);
  const [downloading, setDownloading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  // State for bottom table
  const [tableData, setTableData] = useState<any[] | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [bottomTableSearchValue, setBottomTableSearchValue] = useState("");
  const bottomTableGridRef = useRef<AgGridReact>(null);

  // State for create ticket dialog
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] =
    useState(false);
  const [isTicketFormMinimized, setIsTicketFormMinimized] = useState(false);
  const [ticketInitialData, setTicketInitialData] = useState<any>(null);

  // State for bulk ticket creation
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedTrucks, setSelectedTrucks] = useState<any[]>([]);

  const { user } = useAuthStore();
  const canCreateTicket = useMemo(
    () =>
      Array.isArray(user?.novex_role) &&
      user.novex_role.some((r) =>
        ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"].includes(String(r).trim())
      ),
    [user?.novex_role]
  );

  // UPDATED: Add status to dependency array
  useEffect(() => {
    fetchInitialData();
    fetchBottomTableData();
  }, [selectedBu, selectedZone, selectedPlant, crossFilters, status]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);

    setSearchResults(null);
    setDrillDownData(null);
    setDrillDownData(null);
    setDrillDownFilters([]);

    try {
      let payload;

      if (tripType === "EM") {
        const emlockFilters = [...baseFilters];
        if (selectedZone) {
          emlockFilters.push({
            key: "zone",
            cond: "equals",
            value: selectedZone,
          });
        }

        payload = {
          filters: emlockFilters,
          action: "get_emlock_open_data",
          drill_state: "",
          cross_filters: crossFilters,
          payload: {
            status: status || "",
          },
        };
      } else {
        // UPDATED: Add status to payload
        payload = {
          filters: baseFilters,
          action: "vts_ongoing_trips",
          drill_state: "vts_ongoing_trips",
          cross_filters: crossFilters,
          payload: {
            ongoing_trips_type: tripType,
            ...(status && { status }),
          },
        };
      }

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.data.data && Array.isArray(response.data.data)) {
        const transformed = response.data.data.map(
          (row: Record<string, unknown>) => {
            const { swipeoutl1_count, swipeoutl2_count, region, ...rest } = row;
            return {
              ...rest,
              ...(swipeoutl1_count !== undefined && {
                SWIPEOUTL1FALSECOUNT: swipeoutl1_count,
              }),
              ...(swipeoutl2_count !== undefined && {
                SWIPEOUTL2FALSECOUNT: swipeoutl2_count,
              }),
              // Rename "region" to "location_name" for chart display
              ...(region !== undefined && { location_name: region }),
              // Change location_type from TAS to SOD
              ...(rest.location_type === "TAS" && { location_type: "SOD" }),
            };
          }
        );
        setData(transformed);
        setSearchResults(transformed);
      } else {
        setData([]);
        setSearchResults([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Error fetching data.");
      setData([]);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBreadcrumbClick = async (index: number) => {
    const newFilters = drillDownFilters.slice(0, index);
    setDrillDownFilters(newFilters);

    if (newFilters.length === 0) {
      setDrillDownData(null);
      setDrillDownError(null);
      // Reset bottom table to initial data (no filters)
      fetchBottomTableData([]);
      return;
    }

    setDrillDownLoading(true);
    setDrillDownError(null);

    try {
      let payload;

      if (tripType === "EM") {
        const emlockFilters = [...baseFilters];
        if (selectedZone) {
          emlockFilters.push({
            key: "zone_nm",
            cond: "equals",
            value: selectedZone,
          });
        }
        newFilters.forEach((filter) => {
          if (filter.key === "zone") {
            emlockFilters.push({
              key: "zone",
              cond: "equals",
              value: filter.value,
            });
          } else if (
            filter.key === "location" ||
            filter.key === "location_name"
          ) {
            emlockFilters.push({
              key: filter.key,
              cond: "equals",
              value: filter.value,
            });
          }
        });

        let drillState = "";
        const zoneFilter = newFilters.find((f) => f.key === "zone");
        const locationFilter = newFilters.find(
          (f) => f.key === "location_name" || f.key === "location"
        );
        if (newFilters.length > 0) {
          const lastFilter = newFilters[newFilters.length - 1];
          if (lastFilter.key === "zone") {
            drillState = "location_name"; // Skip region, go directly to location_name
          } else if (
            lastFilter.key === "location" ||
            lastFilter.key === "location_name"
          ) {
            drillState = "trucknumber"; // After location, get truck numbers
          } else if (
            lastFilter.key === "trucknumber" ||
            lastFilter.key === "tt_number"
          ) {
            drillState = "details"; // After truck number, get details
          }
        }

        payload = {
          filters: emlockFilters,
          action: "get_emlock_open_data",
          drill_state: drillState,
          cross_filters: crossFilters,
          payload: {
            status: status || "",
            zone: zoneFilter?.value,
            location_name: locationFilter?.value,
            skip_region: "true",
          },
        };
      } else {
        // UPDATED: Add status to payload
        const payloadData: any = { ongoing_trips_type: tripType };
        newFilters.forEach((f) => {
          payloadData[f.key] = f.value;
        });
        if (status) {
          payloadData.status = status;
        }

        payload = {
          filters: baseFilters,
          action: "vts_ongoing_trips",
          drill_state: "vts_ongoing_trips",
          cross_filters: crossFilters,
          payload: payloadData,
        };
      }

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.data.data && Array.isArray(response.data.data)) {
        const transformed = response.data.data.map((row: any) => {
          const { region, ...rest } = row;
          return {
            ...rest,
            // Rename "region" to "location_name" to skip region level
            ...(region !== undefined && { location_name: region }),
            ...(row.location_type === "TAS" && { location_type: "SOD" }),
          };
        });
        setDrillDownData(transformed);
      } else {
        setDrillDownData([]);
      }
      // Re-fetch bottom table data with drill-down filters
      fetchBottomTableData(newFilters);
    } catch (err: any) {
      setDrillDownError(
        err.response?.data?.message || "Error fetching drill data"
      );
      setDrillDownData([]);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleDrillDown = async (row: any, key: string) => {
    const newFilters = [...drillDownFilters, { key, value: row[key] }];
    setDrillDownFilters(newFilters);
    setDrillDownLoading(true);
    setDrillDownError(null);

    try {
      let payload;

      if (tripType === "EM") {
        const emlockFilters = [...baseFilters];

        if (key === "zone") {
          emlockFilters.push({ key: "zone", cond: "equals", value: row[key] });
        } else if (key === "location" || key === "location_name") {
          const zoneFilter = drillDownFilters.find((f) => f.key === "zone");
          if (zoneFilter) {
            emlockFilters.push({
              key: "zone",
              cond: "equals",
              value: zoneFilter.value,
            });
          }
          emlockFilters.push({ key: key, cond: "equals", value: row[key] });
        }

        let drillState = "";
        const zoneFilter = drillDownFilters.find((f) => f.key === "zone");
        if (key === "zone") {
          drillState = "location_name"; // Skip region, go directly to location_name
        } else if (key === "location" || key === "location_name") {
          drillState = "trucknumber"; // After location, get truck numbers
        } else if (key === "trucknumber" || key === "tt_number") {
          drillState = "details"; // After truck number, get details
        }

        payload = {
          filters: emlockFilters,
          action: "get_emlock_open_data",
          drill_state: drillState,
          cross_filters: crossFilters,
          payload: {
            status: status || "",
            zone: key === "zone" ? row[key] : zoneFilter?.value,
            location_name:
              key === "location" || key === "location_name"
                ? row[key]
                : undefined,
            skip_region: "true",
          },
        };
      } else {
        // UPDATED: Add status to payload
        const payloadData: any = { ongoing_trips_type: tripType };
        newFilters.forEach((f) => {
          payloadData[f.key] = f.value;
        });
        if (status) {
          payloadData.status = status;
        }

        payload = {
          filters: baseFilters,
          action: "vts_ongoing_trips",
          drill_state: "vts_ongoing_trips",
          cross_filters: crossFilters,
          payload: payloadData,
        };
      }

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.data.data && Array.isArray(response.data.data)) {
        const transformed = response.data.data.map((row: any) => {
          const { region, ...rest } = row;
          return {
            ...rest,
            // Rename "region" to "location_name" to skip region level
            ...(region !== undefined && { location_name: region }),
            ...(row.location_type === "TAS" && { location_type: "SOD" }),
          };
        });
        setDrillDownData(transformed);
      } else {
        setDrillDownData([]);
      }
      // Re-fetch bottom table data with drill-down filters
      fetchBottomTableData(newFilters);
    } catch (err: any) {
      setDrillDownError(
        err.response?.data?.message || "Error fetching drill data"
      );
      setDrillDownData([]);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setSearching(true);
      setError(null);
      // setData(null);
      // setDrillDownData(null);

      let payload;

      if (tripType === "EM") {
        payload = {
          filters: [
            {
              key: "bu",
              cond: "equals",
              value: selectedBu || "TAS",
            },
          ],
          action: "get_emlock_open_data",
          drill_state: "",
          cross_filters: [
            {
              key: "DATE",
              cond: "equals",
              value: "2025-10-01,2025-10-31",
            },
          ],
          payload: {
            search: "true",
            status: status || "",
          },
        };
      } else {
        payload = {
          filters: [
            {
              key: "bu",
              cond: "equals",
              value: selectedBu || "TAS",
            },
          ],
          action: "vts_ongoing_trips",
          drill_state: "vts_ongoing_trips",
          cross_filters: [
            {
              key: "DATE",
              cond: "equals",
              value: "2025-10-01,2025-10-31",
            },
          ],
          payload: {
            ongoing_trips_type: tripType,
            search: "true",
          },
        };
      }

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.data?.data && Array.isArray(response.data.data)) {
        const transformed = response.data.data.map((row: any) => ({
          ...row,
          ...(row.location_type === "TAS" && { location_type: "SOD" }),
        }));
        setSearchResults(transformed);
      } else {
        setSearchResults([]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Search failed");
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      let payload;

      if (tripType === "EM") {
        const emlockFilters = [...baseFilters];
        if (selectedZone) {
          emlockFilters.push({
            key: "zone",
            cond: "equals",
            value: selectedZone,
          });
        }

        payload = {
          filters: emlockFilters,
          action: "get_emlock_open_data",
          drill_state: "",
          cross_filters: crossFilters,
          payload: {
            status: status || "live",
            download: "true",
          },
        };
      } else {
        payload = {
          filters: baseFilters,
          action: "vts_ongoing_trips",
          drill_state: "vts_ongoing_trips",
          cross_filters: crossFilters,
          payload: {
            ongoing_trips_type: tripType,
            download: "true",
            status: status || "live",
          },
        };
      }

      console.log("📦 Download payload:", JSON.stringify(payload, null, 2));

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `${tripType || "All"}_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${tripType} Excel downloaded successfully!`);
    } catch (error) {
      toast.error("Failed to download Excel file");
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    if (searchValue.trim() !== "") {
      handleSearch();
    } else {
      fetchInitialData();
    }
    fetchBottomTableData();
    // Exit multi-select mode on refresh
    setIsMultiSelectMode(false);
    setSelectedTrucks([]);
    if (bottomTableGridRef.current?.api) {
      bottomTableGridRef.current.api.deselectAll();
    }
  };

  // Helper function to filter sap_id values, keeping only actual IDs and filtering out location names
  const filterSapIds = (sapId: any): string => {
    if (!sapId) return '';

    // If it's an array, flatten and filter
    const sapIdArray = Array.isArray(sapId) ? sapId.flat() : [sapId];

    // Filter out location names and keep only actual IDs
    const filteredIds = sapIdArray.filter((id: any) => {
      if (!id || typeof id !== 'string') return false;
      // If it contains spaces or common location name patterns, likely a location name
      if (id.includes(' ') || id.includes('-') || id.toUpperCase().includes('TERMINAL') || id.toUpperCase().includes('OIL')) {
        return false;
      }
      // Keep numeric strings or short alphanumeric codes
      return /^\d+$/.test(id) || /^[A-Z0-9]{1,10}$/.test(id);
    });

    // Return the first valid ID, or empty string if none found
    return filteredIds.length > 0 ? filteredIds[0] : '';
  };

  const handleBulkCreateTicket = useCallback(() => {
    if (!canCreateTicket) {
      toast.error("You are not allowed to create tickets.");
      return;
    }
    if (selectedTrucks.length === 0) {
      toast.error("Please select at least one truck to create a ticket");
      return;
    }

    // Check if multiple trucks are selected
    const isMultipleTrucks = selectedTrucks.length > 1;

    // Use the first truck for basic ticket data, all trucks for linked trucks
    const firstTruck = selectedTrucks[0];

    // Collect unique zones and locations from all selected trucks
    const uniqueZones = [...new Set(selectedTrucks.map(truck => truck.zone || truck.zone_nm).filter(Boolean))];
    const uniqueLocations = [...new Set(selectedTrucks.map(truck => truck.location_name).filter(Boolean))];

    // Determine zone value: single zone if all same, array of zones if different, empty if none
    let zoneValue: string | string[] = '';
    if (uniqueZones.length === 1) {
      zoneValue = uniqueZones[0];
    } else if (uniqueZones.length > 1) {
      zoneValue = uniqueZones;
    }

    // Determine location values: single location if all same, array of locations if different, empty if none
    let locationValue: string | string[] = '';
    let locationIdValue: string | string[] = '';
    if (uniqueLocations.length === 1) {
      locationValue = uniqueLocations[0];
      locationIdValue = firstTruck.sap_id || '';
    } else if (uniqueLocations.length > 1) {
      locationValue = uniqueLocations;
      locationIdValue = [...new Set(selectedTrucks.map(truck => truck.sap_id).filter(Boolean))];
    }

    // Extract truck numbers from selected trucks when vehicle number is present
    const truckNumbers = selectedTrucks
      .map((truck: any) => truck.trucknumber || truck.truck_number || truck.truck_no || truck.vehicle_number || truck.vehicle_no || truck.tt_number)
      .filter(Boolean);

    // Transform truck data into ticket initial data
    const initialTicketData = {
      // Prefill zone/location: single value if same, array if different, empty if none
      zone: zoneValue,
      location_name: locationValue,
      location_id: locationIdValue,
      bu: isMultipleTrucks ? "" : firstTruck.bu || selectedBu || "",
      region: isMultipleTrucks ? "" : firstTruck.region || "",
      sap_id: isMultipleTrucks ? "" : filterSapIds(firstTruck.sap_id) || "",
      alert_section: 'VTS', // Set alert section to VTS for tickets created from VTS Live dashboard
      ticket_section: 'VTS Live', // Set ticket section to VTS Live for tickets created from VTS Live dashboard
      // Set up linked trucks for all selected trucks (pass full truck data for display)
      linked_rows: selectedTrucks,
      // Pass truck numbers when vehicle number is present
      truck_no: truckNumbers.length > 0 ? truckNumbers : [],
      // Leave summary and description empty for user to fill
      summary: "",
      description: "",
      // Hide linked alerts section when creating tickets from VTS Live dashboard
      hideLinkedAlerts: true,
    };

    console.log("Setting bulk ticket initial data:", initialTicketData);
    setTicketInitialData(initialTicketData);
    setIsCreateTicketDialogOpen(true);
    setIsTicketFormMinimized(false);
  }, [selectedTrucks, selectedBu, canCreateTicket]);

  const handleTicketDialogClose = useCallback(() => {
    setIsCreateTicketDialogOpen(false);
    setIsTicketFormMinimized(false);
    setTicketInitialData(null);
    // Exit multi-select mode and clear selections when dialog closes
    setIsMultiSelectMode(false);
    setSelectedTrucks([]);
    if (bottomTableGridRef.current?.api) {
      bottomTableGridRef.current.api.deselectAll();
    }
  }, []);

  const handleMinimize = useCallback(() => {
    setIsTicketFormMinimized(true);
  }, []);

  const handleRestore = useCallback(() => {
    setIsTicketFormMinimized(false);
  }, []);

  const fetchBottomTableData = async (
    filters: { key: string; value: string }[] = []
  ) => {
    console.log("fetchBottomTableData called with filters:", filters);
    setTableLoading(true);
    setTableError(null);
    onTotalRecords?.({ count: null, loading: true, error: null });

    try {
      let payload;

      if (tripType === "EM") {
        const emlockFilters = [...baseFilters];
        if (selectedZone) {
          emlockFilters.push({
            key: "zone",
            cond: "equals",
            value: selectedZone,
          });
        }
        // Add drill-down filters
        filters.forEach((f) => {
          emlockFilters.push({
            key: f.key,
            cond: "equals",
            value: f.value,
          });
        });

        const zoneFilter = filters.find((f) => f.key === "zone");
        const locationFilter = filters.find(
          (f) => f.key === "location_name" || f.key === "location"
        );
        const trucknumberFilter = filters.find(
          (f) => f.key === "trucknumber" || f.key === "tt_number"
        );

        // For table data, don't use drill_state - just pass filters and table: "true"
        payload = {
          filters: emlockFilters,
          action: "get_emlock_open_data",
          cross_filters: crossFilters,
          payload: {
            status: status || "live",
            table: "true",
            ...(zoneFilter && { zone: zoneFilter.value }),
            ...(locationFilter && { location_name: locationFilter.value }),
            ...(trucknumberFilter && { trucknumber: trucknumberFilter.value }),
          },
        };
      } else {
        // Match chart API format: drill-down values only in payload, not in filters
        const payloadData: any = {
          ongoing_trips_type: tripType,
          ...(status && { status }),
          table: "true",
        };
        // Add drill-down filters to payload (same as chart API)
        filters.forEach((f) => {
          payloadData[f.key] = f.value;
        });

        payload = {
          filters: baseFilters,
          action: "vts_ongoing_trips",
          drill_state: "vts_ongoing_trips",
          cross_filters: crossFilters,
          payload: payloadData,
        };
      }

      console.log(
        "Bottom table API payload:",
        JSON.stringify(payload, null, 2)
      );

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        payload,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      console.log(
        "Bottom table API response count:",
        response.data.data?.length
      );

      // Report total_records to parent via callback
      const totalRecords = response.data?.total_records;
      onTotalRecords?.({
        count: totalRecords !== undefined && totalRecords !== null ? Number(totalRecords) : 0,
        loading: false,
        error: null,
      });

      if (response.data.data && Array.isArray(response.data.data)) {
        const transformed = response.data.data.map((row: any) => {
          // Keep original location_name, don't overwrite with region
          return {
            ...row,
            ...(row.location_type === "TAS" && { location_type: "SOD" }),
          };
        });
        setTableData(transformed);
      } else {
        setTableData([]);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || "Error fetching table data.";
      setTableError(errMsg);
      onTotalRecords?.({ count: null, loading: false, error: errMsg });
      setTableData([]);
    } finally {
      setTableLoading(false);
    }
  };

  const displayData =
    drillDownData !== null
      ? drillDownData
      : searchResults !== null
      ? searchResults
      : data || [];

  const filteredData = displayData.filter((row) =>
    Object.values(row).some(
      (val) =>
        val && String(val).toLowerCase().includes(searchValue.toLowerCase())
    )
  );

  // Filter bottom table data based on drill-down filters (client-side filtering)
  const filteredTableData = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];
    if (drillDownFilters.length === 0) return tableData;

    return tableData.filter((row: any) => {
      return drillDownFilters.every((filter) => {
        // Get the row value for this filter key
        let rowValue =
          row[filter.key] ||
          row[filter.key.toLowerCase()] ||
          row[filter.key.toUpperCase()];

        // Check zone variants
        if (filter.key === "zone" && !rowValue) {
          rowValue = row["zone"] || row["zone_nm"] || row["ZONE"];
        }

        // Check location_name variants
        if (
          (filter.key === "location_name" || filter.key === "location") &&
          !rowValue
        ) {
          rowValue =
            row["location_name"] || row["location"] || row["LOCATION_NAME"];
        }

        // Check trucknumber variants
        if (
          (filter.key === "trucknumber" || filter.key === "tt_number") &&
          !rowValue
        ) {
          rowValue =
            row["trucknumber"] || row["tt_number"] || row["TRUCKNUMBER"];
        }

        // If column doesn't exist, skip this filter
        if (rowValue === undefined || rowValue === null) return true;

        return (
          String(rowValue).toLowerCase() === String(filter.value).toLowerCase()
        );
      });
    });
  }, [tableData, drillDownFilters]);

  // Check if both latitude and longitude columns exist
  const hasLatitude =
    filteredData.length > 0 &&
    filteredData[0].hasOwnProperty("vehicle_latitude");
  const hasLongitude =
    filteredData.length > 0 &&
    filteredData[0].hasOwnProperty("vehicle_longitude");
  const hasCoordinates = hasLatitude && hasLongitude;

  // Preferred column order for the small table beside the chart
  // For EM Lock view: location_name first, then swipeout counts, then other counts
  const preferredColumnOrder =
    tripType === "EM"
      ? [
          "location_name",
          "location",
          "swipeoutl1_count",
          "swipeoutl2_count",
          "SWIPEOUTL1FALSECOUNT",
          "SWIPEOUTL2FALSECOUNT",
          "distinct_invoice_count",
          "distinct_vehicle_count",
          "zone",
          "zone_nm",
        ]
      : [
          "event_end_datetime",
          "event_start_datetime",
          "sap_id",
          "zone",
          "zone_nm",
          "SWIPEOUTL1FALSECOUNT",
          "SWIPEOUTL2FALSECOUNT",
          "invoice_no",
          "tt_number",
          "destination_code",
          "transporter_name",
          "location_type",
        ];
  const orderColumnsByPreferred = (cols: string[]): string[] => {
    const ordered: string[] = [];
    const used = new Set<string>();
    for (const key of preferredColumnOrder) {
      if (cols.includes(key) && !used.has(key)) {
        ordered.push(key);
        used.add(key);
      }
    }
    for (const col of cols) {
      if (!used.has(col)) ordered.push(col);
    }
    return ordered;
  };

  // Get columns, excluding individual latitude and longitude if both exist
  let columns = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];
  if (hasCoordinates) {
    columns = columns.filter(
      (col) => col !== "vehicle_latitude" && col !== "vehicle_longitude"
    );
    columns.push("coordinates"); // Add combined coordinates column
  }
  // Remove "region" column - we skip region in drill-down
  columns = columns.filter((col) => col.toLowerCase() !== "region");
  columns = orderColumnsByPreferred(columns);

  // Determine which column should be first based on current drill-down level
  // At zone level: zone first, after zone click: location_name first, after location click: transporter_name first, etc.
  const getCurrentDrillColumn = (): string[] => {
    if (drillDownFilters.length === 0) {
      // Initial level - zone should be first
      return ["zone", "zone_nm"];
    }
    const lastFilter = drillDownFilters[drillDownFilters.length - 1];
    if (lastFilter.key === "zone" || lastFilter.key === "zone_nm") {
      // After zone click - location_name should be first
      return ["location_name", "location"];
    } else if (
      lastFilter.key === "location" ||
      lastFilter.key === "location_name"
    ) {
      // After location click - transporter_name should be first (for non-EM), trucknumber for EM
      return tripType === "EM"
        ? ["trucknumber", "tt_number", "truck_number"]
        : ["transporter_name"];
    } else if (lastFilter.key === "transporter_name") {
      // After transporter click - tt_number should be first
      return ["tt_number", "trucknumber", "truck_number"];
    }
    return [];
  };

  // Move the current drill column to the first position
  const drillColumns = getCurrentDrillColumn();
  for (const drillCol of drillColumns) {
    const drillColIndex = columns.findIndex((col) => col === drillCol);
    if (drillColIndex > 0) {
      const colToMove = columns.splice(drillColIndex, 1)[0];
      columns.unshift(colToMove);
      break; // Only move the first matching column
    }
  }

  const formatHeader = (key: string) => {
    if (key === "coordinates") {
      return "longitude/latitude";
    }
    if (key === "SWIPEOUTL1FALSECOUNT") {
      return "SWIPEOUT\nL1FALSE\nCOUNT";
    }
    if (key === "SWIPEOUTL2FALSECOUNT") {
      return "SWIPEOUT\nL2FALSE\nCOUNT";
    }
    return key.replace(/_/g, " ").toUpperCase();
  };

  const getBreadcrumbIcon = (filterKey: string) => {
    switch (filterKey) {
      case "zone":
      case "zone_nm":
        return <Home className="w-3 h-3" />;
      case "location_name":
      case "location":
        return <Building className="w-3 h-3" />;
      case "transporter_name":
        return <Truck className="w-3 h-3" />;
      case "tt_number":
        return <Car className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getBreadcrumbLabel = (filter: { key: string; value: string }) => {
    switch (filter.key) {
      case "zone":
      case "zone_nm":
        return `${filter.value} - Locations`; // Changed from Regions to Locations
      case "location_name":
      case "location":
        return `${filter.value} - Transporters`;
      case "transporter_name":
        return `${filter.value} - Vehicles`;
      case "tt_number":
        return `${filter.value} - Details`;
      default:
        return filter.value;
    }
  };

  // const chartData = useMemo(
  //     () => getChartDataFromUnfiltered(data || []),
  //     [data, drillDownFilters]
  // );
  const chartData = useMemo(
    () =>
      getChartDataFromUnfiltered(
        drillDownData !== null ? drillDownData : data || []
      ),
    [data, drillDownData, drillDownFilters]
  );

  function getChartDataFromUnfiltered(rawData: any[]) {
    if (!rawData || rawData.length === 0) return [];

    const currentDrillKey =
      drillDownFilters.length > 0
        ? drillDownFilters[drillDownFilters.length - 1].key
        : null;

    let nameColumn: string | null = null;

    if (tripType === "EM") {
      if (currentDrillKey === "transporter_name") nameColumn = "tt_number";
      else if (currentDrillKey === "location_name") nameColumn = "trucknumber";
      else if (currentDrillKey === "zone") nameColumn = "location_name";
      else nameColumn = "zone";
    } else {
      if (currentDrillKey === "transporter_name") nameColumn = "tt_number";
      else if (currentDrillKey === "location_name")
        nameColumn = "transporter_name";
      else if (currentDrillKey === "zone")
        nameColumn = "location_name"; // Skip region
      else nameColumn = "zone";
    }

    const columns = rawData.length > 0 ? Object.keys(rawData[0]) : [];

    if (!columns.includes(nameColumn)) {
      // Prioritize location_name over region - we skip region in drill-down
      nameColumn =
        columns.find(
          (col) =>
            col === "location_name" ||
            col.toLowerCase().includes("name") ||
            col === "zone" ||
            col === "zone_nm" ||
            col === "transporter_name" ||
            col === "trucknumber" ||
            col === "tt_number"
        ) || null;
    }

    const numericColumns = columns.filter((col) => {
      if (!nameColumn || col === nameColumn) return false;
      const val = rawData[0][col];
      return (
        typeof val === "number" ||
        (!isNaN(Number(val)) && val !== null && val !== "")
      );
    });

    if (!nameColumn || numericColumns.length === 0) return [];

    return rawData.map((row) => {
      const item: any = { name: row[nameColumn!] || "N/A" };
      numericColumns.forEach((col) => {
        item[col] = Number(row[col]) || 0;
      });
      return item;
    });
  }

  const AmChartsBarChart = ({
    data,
    chartId,
    hasDrillDown = false,
  }: {
    data: any[];
    chartId: string;
    hasDrillDown?: boolean;
  }) => {
    useLayoutEffect(() => {
      if (data.length === 0) return;

      const root = am5.Root.new(chartId);

      if (root._logo) {
        root._logo.dispose();
      }

      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: false,
          wheelX: "panX",
          wheelY: "none",
          layout: root.verticalLayout,
        })
      );

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
          extraMax: 0.1,
        })
      );

      yAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
      });

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "name",
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 30,
          }),
        })
      );

      xAxis.data.setAll(data);

      xAxis.get("renderer").labels.template.setAll({
        fontSize: 10,
        rotation: -40, // slight diagonal
        centerY: am5.p0, // anchor at top so it touches axis
        centerX: am5.p100, // align end to tick
        paddingTop: 5, // minimize gap to axis line
        oversizedBehavior: "wrap", // wrap long labels
        maxWidth: 100, // allow two-line wrap
      });

      if (data.length > 8) {
        xAxis.set("start", 0);
        xAxis.set("end", 8 / data.length);
      }

      const numericColumns = Object.keys(data[0]).filter(
        (key) => key !== "name"
      );

      // Color palette for bars - 4 distinct colors for EM chart columns
      const barColors = [
        "#6366f1", // Indigo
        "#06b6d4", // Cyan
        "#c36bfa", // Indigo - for DISTINCT INVOICE COUNT
        "#ec4899", // Pink - for DISTINCT VEHICLE COUNT
      ];

      numericColumns.forEach((field, index) => {
        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: field
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase()),
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: field,
            categoryXField: "name",
            clustered: true,
          })
        );

        // Set bar color from palette
        const colorIndex = index % barColors.length;
        series.columns.template.setAll({
          width: am5.percent(30),
          strokeWidth: 1,
          fill: am5.color(barColors[colorIndex]),
          stroke: am5.color(barColors[colorIndex]),
        });

        series.bullets.push(() => {
          return am5.Bullet.new(root, {
            locationY: 1,
            sprite: am5.Label.new(root, {
              text: `{${field}}`,
              centerY: am5.p100,
              centerX: am5.p50,
              populateText: true,
              fontSize: 10,
              fontWeight: "600",
            }),
          });
        });

        series.data.setAll(data);
      });

      if (numericColumns.length > 1) {
        const legend = chart.children.push(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
          })
        );

        legend.labels.template.setAll({
          fontSize: 10,
        });

        legend.data.setAll(chart.series.values);
      }

      if (data.length > 8) {
        const scrollbar = chart.set(
          "scrollbarX",
          am5.Scrollbar.new(root, {
            orientation: "horizontal",
            height: 8, // Small scrollbar height
          })
        );

        // Style the scrollbar background to look like a slider track
        scrollbar.get("background").setAll({
          fill: am5.color(0xe5e7eb), // Light gray track
          fillOpacity: 1,
          stroke: am5.color(0xd1d5db),
          strokeWidth: 1,
        });

        // Set scrollbar to show only 10% of the data initially when drill down has occurred
        if (hasDrillDown) {
          setTimeout(() => {
            scrollbar.set("start", 0);
            scrollbar.set("end", 0.1);
          }, 50);
        }
      }

      return () => {
        root.dispose();
      };
    }, [data, chartId, hasDrillDown]);

    return <div id={chartId} style={{ width: "100%", height: "410px" }}></div>;
  };

  const calculateTotals = () => {
    if (filteredData.length === 0) return {};

    const totals: { [key: string]: number } = {};
    const excludeColumns = [
      "zone",
      "zone_nm",
      "location_name",
      "transporter_name",
      "tt_number",
      "invoice_no",
      "created_at",
      "date",
      "time",
      "vehicle_number",
      "tl_number",
    ];

    if (tripType === "EM") {
      filteredData.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (!excludeColumns.includes(key)) {
            // Exclude has_swipeoutl1 and has_swipeoutl2 from totals
            const keyLower = key.toLowerCase();
            if (
              keyLower === "has_swipeoutl1" ||
              keyLower === "has_swipeoutl2"
            ) {
              // Skip these fields
              return;
            }
            if (
              key.toLowerCase() === "swipeoutl1" ||
              key.toLowerCase() === "swipeoutl2"
            ) {
              const val = Number(row[key]) || 0;
              totals[key] = (totals[key] || 0) + val;
            } else if (typeof row[key] === "number") {
              totals[key] = (totals[key] || 0) + row[key];
            }
          }
        });
      });
    } else {
      filteredData.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (!excludeColumns.includes(key) && typeof row[key] === "number") {
            totals[key] = (totals[key] || 0) + row[key];
          }
        });
      });
    }

    return totals;
  };

  const totals = calculateTotals();

  // Column definitions for bottom AG Grid table
  const bottomTableColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    if (!tableData || tableData.length === 0) return [];

    // Define columns to exclude based on trip type
    const excludedColumns: string[] = ["region"];
    if (tripType === "RD") {
      excludedColumns.push("event_start_datetime");
    } else if (tripType === "HS" || tripType === "TC" || tripType === "WR") {
      excludedColumns.push("event_end_datetime");
    } else if (tripType === "EM") {
      excludedColumns.push("has_swipeoutl1", "has_swipeoutl2");
    }

    // Check if both latitude and longitude columns exist
    const hasLatitude = tableData[0].hasOwnProperty("vehicle_latitude");
    const hasLongitude = tableData[0].hasOwnProperty("vehicle_longitude");
    const hasCoordinates = hasLatitude && hasLongitude;

    // Exclude individual latitude and longitude columns if both exist
    if (hasCoordinates) {
      excludedColumns.push("vehicle_latitude", "vehicle_longitude");
    }

    const columns: (ColDef | ColGroupDef)[] = [];

    // Add checkbox column when in multi-select mode
    if (isMultiSelectMode) {
      columns.push({
        headerName: "",
        field: "checkbox",
        width: 50,
        minWidth: 50,
        maxWidth: 50,
        checkboxSelection: true,
        pinned: "left",
        suppressMenu: true,
        sortable: false,
        filter: false,
        resizable: false,
        cellStyle: { textAlign: "center", fontSize: "12px" },
      } as ColDef);
    }

    // Add the rest of the columns (order: event_end_datetime, sap_id, zone, invoice, tt_number, destination_code, transporter_name, location_type, then rest)
    const preferredOrder = [
      "event_end_datetime",
      "event_start_datetime",
      "sap_id",
      "zone",
      "zone_nm",
      "SWIPEOUTL1FALSECOUNT",
      "SWIPEOUTL2FALSECOUNT",
      "SWIPEOUTL1",
      "SWIPEOUTL2",
      "invoice_no",
      "tt_number",
      "destination_code",
      "transporter_name",
      "location_type",
    ];
    const orderedKeys = (() => {
      const keys = Object.keys(tableData[0]).filter((key) => {
        const keyLower = key.toLowerCase();
        return !excludedColumns.some(
          (excluded) => excluded.toLowerCase() === keyLower
        );
      });
      const ordered: string[] = [];
      const used = new Set<string>();
      for (const key of preferredOrder) {
        if (keys.includes(key) && !used.has(key)) {
          ordered.push(key);
          used.add(key);
        }
      }
      for (const col of keys) {
        if (!used.has(col)) ordered.push(col);
      }
      return ordered;
    })();
    const buildColDef = (
      key: string,
      headerNameOverride?: string,
      headerClass?: string
    ): ColDef => {
      const isNumeric =
        typeof tableData[0][key] === "number" &&
        key !== "zone" &&
        key !== "zone_nm" &&
        key !== "region";
      const columnDef: ColDef = {
        field: key,
        headerName: headerNameOverride ?? formatHeader(key),
        sortable: true,
        resizable: true,
        filter: false,
        ...(headerClass && { headerClass }),
        valueFormatter: isNumeric
          ? (params) =>
              params.value != null ? Number(params.value).toLocaleString() : "0"
          : (params) => params.value || "-",
        cellStyle: isNumeric
          ? { textAlign: "right", fontSize: "12px" }
          : { textAlign: "left", fontSize: "12px" },
      };
      if (tripType === "EM") {
        columnDef.flex = 1;
        columnDef.minWidth = 100;
        if (key === "sap_id") columnDef.minWidth = 120;
        else if (key === "zone" || key === "zone_nm") columnDef.minWidth = 100;
        else if (key === "location" || key === "location_name")
          columnDef.minWidth = 150;
        else if (key === "region") columnDef.minWidth = 120;
        else if (
          key === "trucknumber" ||
          key === "truck_number" ||
          key === "truckNumber"
        )
          columnDef.minWidth = 140;
        else if (
          key === "SWIPEOUTL1FALSECOUNT" ||
          key === "SWIPEOUTL2FALSECOUNT" ||
          key.toLowerCase() === "swipeoutl1" ||
          key.toLowerCase() === "swipeoutl2"
        )
          columnDef.minWidth = 120;
      } else {
        if (key === "sap_id") {
          columnDef.width = 100;
          columnDef.minWidth = 80;
          columnDef.maxWidth = 150;
        }
        if (key === "zone" || key === "zone_nm") {
          columnDef.width = 80;
          columnDef.minWidth = 60;
          columnDef.maxWidth = 120;
        }
        if (key === "location" || key === "location_name") {
          columnDef.width = 180;
          columnDef.minWidth = 150;
          columnDef.maxWidth = 250;
        }
        if (key === "region") {
          columnDef.width = 140;
          columnDef.minWidth = 120;
          columnDef.maxWidth = 180;
        }
        if (
          key === "trucknumber" ||
          key === "truck_number" ||
          key === "truckNumber"
        ) {
          columnDef.width = 140;
          columnDef.minWidth = 120;
          columnDef.maxWidth = 170;
        }
        if (
          key === "SWIPEOUTL1FALSECOUNT" ||
          key === "SWIPEOUTL2FALSECOUNT" ||
          key.toLowerCase() === "swipeoutl1" ||
          key.toLowerCase() === "swipeoutl2"
        ) {
          columnDef.width = 140;
          columnDef.minWidth = 100;
          columnDef.maxWidth = 160;
        }
      }
      return columnDef;
    };
    const isSwipeoutL2 = (k: string) =>
      k === "SWIPEOUTL2FALSECOUNT" || k.toLowerCase() === "swipeoutl2";
    const isSwipeoutL1 = (k: string) =>
      k === "SWIPEOUTL1FALSECOUNT" || k.toLowerCase() === "swipeoutl1";
    const findL2Key = (l1Key: string): string | null => {
      if (
        l1Key === "SWIPEOUTL1FALSECOUNT" &&
        Object.prototype.hasOwnProperty.call(
          tableData[0],
          "SWIPEOUTL2FALSECOUNT"
        )
      )
        return "SWIPEOUTL2FALSECOUNT";
      const dataKeys = Object.keys(tableData[0]);
      const l2 = dataKeys.find((k) => isSwipeoutL2(k));
      return l2 ?? null;
    };
    for (const key of orderedKeys) {
      if (isSwipeoutL2(key)) continue;
      if (key === "SWIPEOUTL1FALSECOUNT") {
        const children: ColDef[] = [
          buildColDef("SWIPEOUTL1FALSECOUNT", "SWIPEOUT L1"),
        ];
        const l2Key = findL2Key(key);
        if (l2Key) {
          children.push(
            buildColDef(l2Key, "SWIPEOUT L2", "swipeout-l2-border-left")
          );
        }
        columns.push({
          headerName: "SWIPEOUT",
          headerClass: "swipeout-group-header-center",
          children,
        } as ColGroupDef);
        continue;
      }
      if (isSwipeoutL1(key)) {
        const children: ColDef[] = [buildColDef(key, "SWIPEOUT L1")];
        const l2Key = findL2Key(key);
        if (l2Key) {
          children.push(
            buildColDef(l2Key, "SWIPEOUT L2", "swipeout-l2-border-left")
          );
        }
        columns.push({
          headerName: "SWIPEOUT",
          headerClass: "swipeout-group-header-center",
          children,
        } as ColGroupDef);
        continue;
      }
      columns.push(buildColDef(key));
    }

    // Add combined coordinates column if both latitude and longitude exist
    if (hasCoordinates) {
      columns.push({
        field: "coordinates",
        headerName: "longitude/latitude",
        sortable: false,
        resizable: true,
        filter: false,
        cellRenderer: (params: any) => {
          const rowData = params.data;
          const lat = rowData?.vehicle_latitude;
          const lng = rowData?.vehicle_longitude;

          if (lat != null && lng != null && lat !== "" && lng !== "") {
            const latNum = Number(lat);
            const lngNum = Number(lng);

            if (!isNaN(latNum) && !isNaN(lngNum)) {
              const googleMapsUrl = `https://www.google.com/maps?q=${latNum},${lngNum}`;
              return (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(googleMapsUrl, "_blank");
                  }}
                >
                  {latNum.toFixed(6)}, {lngNum.toFixed(6)}
                </a>
              );
            }
          }

          return <span className="text-gray-400">-</span>;
        },
        valueGetter: (params: any) => {
          const rowData = params.data;
          const lat = rowData?.vehicle_latitude;
          const lng = rowData?.vehicle_longitude;

          if (lat != null && lng != null && lat !== "" && lng !== "") {
            const latNum = Number(lat);
            const lngNum = Number(lng);

            if (!isNaN(latNum) && !isNaN(lngNum)) {
              return `${latNum},${lngNum}`;
            }
          }

          return null;
        },
        cellStyle: { textAlign: "left", fontSize: "12px" },
      } as ColDef);
    }

    return columns;
  }, [tableData, tripType, isMultiSelectMode]);

  const bottomTableDefaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      enableCellTextSelection: true,
      suppressMovable: false,
      cellStyle: { fontSize: "12px" },
    }),
    []
  );

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b ">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 text-gray-700 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 text-gray-700 group-hover:text-green-600 transition-all duration-300" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download Excel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={handleRefresh}
                  >
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

      {/* Breadcrumb */}
      {!error && !drillDownError && displayData && displayData.length > 0 && (
        <div className="px-3 pt-2 pb-2 bg-white">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <button
                  onClick={() => handleBreadcrumbClick(0)}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                    drillDownFilters.length === 0
                      ? "bg-blue-600 text-white font-medium"
                      : "text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  <Home className="w-3 h-3" />
                  Home
                </button>

                {drillDownFilters.map((filter, index) => (
                  <React.Fragment key={index}>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                    <button
                      onClick={() => handleBreadcrumbClick(index + 1)}
                      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        index === drillDownFilters.length - 1
                          ? "bg-blue-600 text-white font-medium"
                          : "text-blue-600 hover:bg-blue-100"
                      }`}
                    >
                      {getBreadcrumbIcon(filter.key)}
                      {getBreadcrumbLabel(filter)}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="text-xs text-gray-600 flex-shrink-0">
                {drillDownFilters.length === 0 &&
                  "Click on any zone to view locations"}
                {drillDownFilters.length === 1 &&
                  (drillDownFilters[0].key === "zone" ||
                    drillDownFilters[0].key === "zone_nm") &&
                  "Click on any location to view transporters"}
                {drillDownFilters.length === 2 &&
                  drillDownFilters[1].key === "location_name" &&
                  "Click on any transporter to view TT numbers"}
                {drillDownFilters.length === 3 &&
                  drillDownFilters[2].key === "transporter_name" &&
                  "Showing TT number details"}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Body */}
      <div className="flex-1 overflow-auto">
        {/* Error */}
        {(error || drillDownError) && !loading && !drillDownLoading && (
          <div className="m-6">
            <div className="flex items-center p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-xl shadow-lg">
              <AlertCircle className="w-6 h-6 text-blue-600 mr-3" />
              <span className="text-blue-900 font-medium">
                {error || drillDownError}
              </span>
            </div>
          </div>
        )}

        {/* No Data Message */}
        {drillDownData === null &&
          drillDownFilters.length > 0 &&
          !loading &&
          !drillDownLoading &&
          !error &&
          !drillDownError && (
            <div className="m-6">
              <div className="flex items-center p-5 bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 rounded-xl shadow-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                <span className="text-yellow-900 font-medium">
                  No data available for the selected drill-down level.
                </span>
              </div>
            </div>
          )}

        {/* Grid View - Chart and Table side by side */}
        {!error && !drillDownError && (
          <div className="px-4 pb-4 mt-1 grid grid-cols-3 gap-4">
            {/* Chart Section */}
            {!drillDownFilters.some((f) => f.key === "tt_number") && (
              <div className="col-span-2 rounded-xl shadow-lg overflow-hidden border border-gray-200 bg-white p-2">
                {loading || drillDownLoading ? (
                  <div className="flex flex-col items-center justify-center h-96">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                    <span className="text-gray-700 font-semibold mt-4 text-sm">
                      Loading data...
                    </span>
                  </div>
                ) : chartData.length > 0 ? (
                  <>
                    <AmChartsBarChart
                      data={chartData}
                      chartId={`${tripType}-chart-${drillDownFilters.length}`}
                      hasDrillDown={drillDownFilters.length > 0}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                    <AlertTriangle className="w-10 h-10 mb-2" />
                    <span className="text-sm font-medium">
                      No data available for chart
                    </span>
                  </div>
                )}
              </div>
            )}

            <div
              className={`${
                drillDownFilters.some((f) => f.key === "tt_number")
                  ? "col-span-3"
                  : "col-span-1"
              } rounded-xl shadow-lg overflow-hidden border border-gray-200 bg-white`}
            >
              <div className="p-2 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className={`px-1 py-1 text-sm font-medium rounded-md transition-colors ${
                    searching
                      ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                      : "bg-blue-100 text-white hover:bg-blue-200"
                  }`}
                >
                  <Search className="w-5 h-5 text-blue-600" />
                  {/* {searching ? "Searching..." : "Search"} */}
                </button>
              </div>

              {/* Table */}
              <div className="max-h-[394px] overflow-y-auto overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gradient-to-r from-blue-100 to-indigo-100 sticky top-0 z-10">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className={`px-2 py-2 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 ${
                            col === "sap_id"
                              ? "w-[100px] min-w-[80px] max-w-[150px]"
                              : ""
                          } ${
                            col === "zone" || col === "zone_nm"
                              ? "w-[80px] min-w-[60px] max-w-[120px]"
                              : ""
                          } ${
                            col === "location" || col === "location_name"
                              ? "w-[120px] min-w-[100px] max-w-[180px]"
                              : ""
                          }`}
                          style={
                            col === "SWIPEOUTL1FALSECOUNT" ||
                            col === "SWIPEOUTL2FALSECOUNT"
                              ? { whiteSpace: "pre-line" }
                              : undefined
                          }
                        >
                          {formatHeader(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading || drillDownLoading ? (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="text-center py-8"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                            <span className="text-gray-700 font-medium mt-3 text-sm">
                              Loading data...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredData.length > 0 ? (
                      <>
                        {filteredData.map((row, rowIndex) => {
                          let drillableColumns: string[] = [];

                          // Check if tt_number is already in filters - if so, no drill-down allowed
                          const hasTtNumber = drillDownFilters.some(
                            (f) => f.key === "tt_number"
                          );

                          if (hasTtNumber) {
                            drillableColumns = []; // No drill-down when tt_number is present
                          } else if (tripType === "EM") {
                            if (drillDownFilters.length === 0) {
                              drillableColumns = ["zone"];
                            } else {
                              const lastFilter =
                                drillDownFilters[drillDownFilters.length - 1];

                              if (lastFilter.key === "zone") {
                                // Skip region, go directly to location
                                drillableColumns = [
                                  "location",
                                  "location_name",
                                ];
                              } else if (
                                lastFilter.key === "location" ||
                                lastFilter.key === "location_name"
                              ) {
                                drillableColumns = ["transporter_name"];
                              } else if (
                                lastFilter.key === "transporter_name"
                              ) {
                                // Stop drill-down at transporter_name level - don't allow drill-down to tt_number
                                drillableColumns = [];
                              }
                            }
                          } else {
                            // Check if tt_number is already in filters - if so, no drill-down allowed
                            const hasTtNumber = drillDownFilters.some(
                              (f) => f.key === "tt_number"
                            );

                            if (hasTtNumber) {
                              drillableColumns = []; // No drill-down when tt_number is present
                            } else if (drillDownFilters.length === 0) {
                              drillableColumns = ["zone"];
                            } else {
                              const lastFilter =
                                drillDownFilters[drillDownFilters.length - 1];

                              if (lastFilter.key === "zone") {
                                drillableColumns = ["location_name"];
                              } else if (lastFilter.key === "location_name") {
                                drillableColumns = ["transporter_name"];
                              } else if (
                                lastFilter.key === "transporter_name"
                              ) {
                                // Stop drill-down at transporter_name level - don't allow drill-down to tt_number
                                drillableColumns = [];
                              }
                            }
                          }

                          return (
                            <tr
                              key={rowIndex}
                              className="hover:bg-blue-50 transition-all"
                            >
                              {columns.map((col, colIndex) => {
                                // Handle combined coordinates column
                                if (col === "coordinates") {
                                  const lat = row.vehicle_latitude;
                                  const lng = row.vehicle_longitude;

                                  if (
                                    lat != null &&
                                    lng != null &&
                                    lat !== "" &&
                                    lng !== ""
                                  ) {
                                    const latNum = Number(lat);
                                    const lngNum = Number(lng);

                                    if (!isNaN(latNum) && !isNaN(lngNum)) {
                                      const googleMapsUrl = `https://www.google.com/maps?q=${latNum},${lngNum}`;
                                      return (
                                        <td
                                          key={colIndex}
                                          className="px-2 py-2 text-[12px] border-b border-gray-100"
                                        >
                                          <a
                                            href={googleMapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              window.open(
                                                googleMapsUrl,
                                                "_blank"
                                              );
                                            }}
                                          >
                                            {latNum.toFixed(6)},{" "}
                                            {lngNum.toFixed(6)}
                                          </a>
                                        </td>
                                      );
                                    }
                                  }

                                  return (
                                    <td
                                      key={colIndex}
                                      className="px-2 py-2 text-[12px] border-b border-gray-100 text-gray-400"
                                    >
                                      -
                                    </td>
                                  );
                                }

                                // Check if tt_number is already in the filters - disable drill-down if so
                                const hasTtNumber = drillDownFilters.some(
                                  (f) => f.key === "tt_number"
                                );

                                // Never allow drill-down on tt_number column itself
                                const isTtNumberColumn = col === "tt_number";

                                const isClickable =
                                  !isTtNumberColumn &&
                                  !hasTtNumber &&
                                  drillableColumns.includes(col) &&
                                  row[col];
                                const isNumeric =
                                  typeof row[col] === "number" &&
                                  col !== "zone" &&
                                  col !== "zone_nm" &&
                                  col !== "region";
                                const isViolation = isNumeric && row[col] > 0;

                                return (
                                  <td
                                    key={colIndex}
                                    className={`px-2 py-2 text-[12px] border-b border-gray-100 ${
                                      col === "sap_id"
                                        ? "w-[100px] min-w-[80px] max-w-[150px]"
                                        : ""
                                    } ${
                                      col === "zone" || col === "zone_nm"
                                        ? "w-[80px] min-w-[60px] max-w-[120px]"
                                        : ""
                                    } ${
                                      col === "location" ||
                                      col === "location_name"
                                        ? "w-[120px] min-w-[100px] max-w-[180px]"
                                        : ""
                                    } ${
                                      isClickable
                                        ? "text-blue-600 font-semibold hover:underline cursor-pointer"
                                        : isViolation
                                        ? "text-red-600 font-semibold"
                                        : "text-gray-900"
                                    }`}
                                    onClick={() =>
                                      isClickable && handleDrillDown(row, col)
                                    }
                                  >
                                    {isNumeric
                                      ? (row[col] || 0).toLocaleString()
                                      : row[col] || "-"}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        {/* Total Row */}
                        <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-semibold sticky bottom-0">
                          {columns.map((col, colIndex) => (
                            <td
                              key={colIndex}
                              className={`px-4 py-3 text-[12px] text-gray-900 border-t-2 border-blue-300 ${
                                col === "sap_id"
                                  ? "w-[100px] min-w-[80px] max-w-[150px]"
                                  : ""
                              } ${
                                col === "zone" || col === "zone_nm"
                                  ? "w-[80px] min-w-[60px] max-w-[120px]"
                                  : ""
                              } ${
                                col === "location" || col === "location_name"
                                  ? "w-[120px] min-w-[100px] max-w-[180px]"
                                  : ""
                              }`}
                            >
                              {colIndex === 0
                                ? "Total"
                                : col === "coordinates"
                                ? "-"
                                : totals[col] !== undefined
                                ? totals[col].toLocaleString()
                                : "-"}
                            </td>
                          ))}
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="text-center py-8 text-gray-500"
                        >
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Table - AG Grid */}
        {!error && (
          <div className="px-4 pb-2 mt-2">
            <div className="rounded-xl shadow-lg overflow-hidden border border-gray-200 bg-white">
              {/* Search Bar for Bottom Table */}
              {tableData &&
                tableData.length > 0 &&
                !tableLoading &&
                !tableError && (
                  <div className="p-2 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search table..."
                      value={bottomTableSearchValue}
                      onChange={(e) =>
                        setBottomTableSearchValue(e.target.value)
                      }
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {bottomTableSearchValue && (
                      <button
                        onClick={() => setBottomTableSearchValue("")}
                        className="px-2 py-1 text-sm font-medium rounded-md transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                        title="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {canCreateTicket && !isMultiSelectMode ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsMultiSelectMode(true);
                          setSelectedTrucks([]);
                          // Clear any existing selections
                          if (bottomTableGridRef.current?.api) {
                            bottomTableGridRef.current.api.deselectAll();
                          }
                        }}
                        className="ml-2"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Ticket
                      </Button>
                    ) : canCreateTicket ? (
                      <div className="flex items-center gap-2 ml-2">
                        <Button
                          variant={
                            selectedTrucks.length > 0 ? "default" : "outline"
                          }
                          size="sm"
                          onClick={handleBulkCreateTicket}
                          disabled={selectedTrucks.length === 0}
                          className={
                            selectedTrucks.length > 0
                              ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                              : ""
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create Ticket ({selectedTrucks.length})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsMultiSelectMode(false);
                            setSelectedTrucks([]);
                            if (bottomTableGridRef.current?.api) {
                              bottomTableGridRef.current.api.deselectAll();
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              <div style={{ height: "500px", width: "100%" }}>
                {tableLoading ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    <span className="text-gray-700 font-medium mt-3 text-sm">
                      Loading table data...
                    </span>
                  </div>
                ) : tableError ? (
                  <div className="m-6">
                    <div className="flex items-center p-5 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 rounded-xl shadow-lg">
                      <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                      <span className="text-red-900 font-medium">
                        {tableError}
                      </span>
                    </div>
                  </div>
                ) : filteredTableData &&
                  filteredTableData.length > 0 &&
                  bottomTableColumnDefs.length > 0 ? (
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
                      ref={bottomTableGridRef}
                      rowData={filteredTableData}
                      columnDefs={bottomTableColumnDefs}
                      defaultColDef={bottomTableDefaultColDef}
                      headerHeight={24}
                      groupHeaderHeight={24}
                      pagination={true}
                      paginationPageSize={50}
                      paginationPageSizeSelector={[10, 20, 50, 100]}
                      animateRows={false}
                      suppressRowClickSelection={true}
                      suppressCellFocus={true}
                      suppressScrollOnNewData={true}
                      enableRangeSelection={true}
                      enableCellTextSelection={true}
                      ensureDomOrder={true}
                      quickFilterText={bottomTableSearchValue}
                      rowBuffer={20}
                      debounceVerticalScrollbar={true}
                      suppressAggFuncInHeader={true}
                      suppressMenuHide={true}
                      rowSelection={isMultiSelectMode ? "multiple" : "single"}
                      onSelectionChanged={(params: any) => {
                        if (isMultiSelectMode) {
                          const selectedRows = params.api.getSelectedRows();
                          console.log(
                            "Setting selectedTrucks:",
                            selectedRows.length,
                            "rows"
                          );
                          setSelectedTrucks(selectedRows);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <AlertTriangle className="w-10 h-10 mb-2" />
                    <span className="text-sm font-medium">
                      No table data available
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Ticket Dialog */}
      <TicketDialogModal
        isOpen={isCreateTicketDialogOpen}
        isMinimized={isTicketFormMinimized}
        initialData={ticketInitialData}
        onClose={handleTicketDialogClose}
        onMinimize={handleMinimize}
        onRestore={handleRestore}
      />

      <style>{`
 @keyframes slideInRight {
 from {
 transform: translateX(100%);
 }
 to {
 transform: translateX(0);
 }
 }
 /* SWIPEOUT group header: center main header, vertical line between L1 and L2 */
 .ag-theme-alpine .swipeout-group-header-center {
   text-align: center;
   justify-content: center;
 }
 .ag-theme-alpine .swipeout-l2-border-left {
   border-left: 1px solid rgba(0, 0, 0, 0.2);
 }
 `}</style>
    </div>
  );
};

export default OngoingTripChartTable;


