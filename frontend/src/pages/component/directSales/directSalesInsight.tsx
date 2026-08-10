import React, { useState, useRef, useEffect } from "react";
import {
  Hash,
  Building,
  FileText,
  MapPin,
  Globe,
  Navigation,
  Truck,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  Home,
  Calendar,
} from "lucide-react";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { apiClient } from "@/services/apiClient";
// import EnhancedTimeFilter from "../filters/TimeFilterButtons";
// import ZonePlantSelections from "../../RetailOutletHome/ZonePlantSelections";
// import VTSInsightTable from "./VTSInsightTable";
// import VTSDrillDownTable from "./VTSDrillDownTable";
import { format, subDays } from "date-fns";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
// import ReusableFilterBar from "../VTS Analytics/ReusableFilterBar";
import { toast } from "sonner";
import ReusableFilterBar from "../Governance/VTS Analytics/ReusableFilterBar";
import VTSInsightTable from "../Governance/VTS Insight/VTSInsightTable";

interface VtsData {
  slNo: number;
  dealer: string;
  ttNumber: string;
  zone: string;
  location: string;
  transporterName: string;
  created_at: string;
  route_deviation_count_orig: number;
  stoppage_violations_count: number;
  device_tamper_count: number;
  main_supply_removal_count: number;
  night_driving_count: number;
  speed_violation_count: number;
  continuous_driving_count: number;
  qty_shortage?: number;
  date?: string;
  invoiceNumber?: string;
  invoice_number: number;
}

interface FilterState {
  [key: string]: string[];
}

const DirectSalesInsight: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [drillDownLevel, setDrillDownLevel] = useState<
    "zone" | "plant" | "transporter" | "tt" | "date"
  >("zone");
  const [selectedDrillZone, setSelectedDrillZone] = useState<string | null>(
    null
  );
  const [selectedDrillPlant, setSelectedDrillPlant] = useState<string | null>(
    null
  );
  const [selectedDrillTransporter, setSelectedDrillTransporter] = useState<
    string | null
  >(null);
  const [selectedDrillTT, setSelectedDrillTT] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<any[]>([]);
  const [drillDownLoading, setDrillDownLoading] = useState<boolean>(false);

  const [data, setData] = useState<VtsData[]>([]);
  const [alertType, setAlertType] = useState<string>("all_alerts");
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>(
    "1M"
  );
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [selectedViolations, setSelectedViolations] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedBu, setSelectedBu] = useState<string>("I&C");
  const [selectedRow, setSelectedRow] = useState<VtsData | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewDetailsData, setViewDetailsData] = useState<any[]>([]);
  const [viewDetailsLoading, setViewDetailsLoading] = useState(false);
  const [mode, setMode] = useState<"violation" | "alert">("violation");
  const [drillState, setDrillState] = useState<"zone" | "location">("zone");
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartPercentages, setChartPercentages] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [hasFetchedChartData, setHasFetchedChartData] = useState(false);
  const [selectedBarItem, setSelectedBarItem] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(true);
  // AmCharts refs
  const barChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);
  const barChartRoot = useRef<am5.Root | null>(null);
  const pieChartRoot = useRef<am5.Root | null>(null);

  const getViolationTypes = () => {
    const baseTypes = {
      route_deviation_count_orig: "RD",
      stoppage_violations_count: "UNS",
      device_tamper_count: "DT",
      main_supply_removal_count: "PD",
      night_driving_count: "ND",
      speed_violation_count: "OS",
      continuous_driving_count: "CD",
    };

    if (mode === "violation") {
      return {
        ...baseTypes,
        qty_shortage: "Shortage",
      };
    }

    return baseTypes;
  };

  const violationTypes = getViolationTypes();

  // Violation type tooltip mapping
  const violationTypeTooltips = {
    RD: "Route Deviation",
    UNS: "Unauthorised Stoppage",
    DT: "Device Tampering",
    PD: "Power Disconnection",
    ND: "Night Driving",
    OS: "Over Speed",
    CD: "Continuous Driving",
    Shortage: "Quantity Shortage",
  };

  // Column configurations with icons
  const columnConfig = {
    slNo: { icon: Hash, label: "Sl No" },
    dealer: { icon: Building, label: "Dealer" },
    invoiceNumber: { icon: FileText, label: "Invoice Number" },
    ttNumber: { icon: FileText, label: "TT Number" },
    zone: { icon: Globe, label: "Zone" },
    location: { icon: Navigation, label: "Location" },
    transporterName: { icon: Truck, label: "Transporter" },
    created_at: { icon: Calendar, label: "Invoice Date" },
    route_deviation_count_orig: { icon: AlertTriangle, label: "Route Deviation" },
    stoppage_violations_count: {
      icon: AlertTriangle,
      label: "Stoppage Violation",
    },
    device_tamper_count: { icon: AlertTriangle, label: "Device Tampering" },
    main_supply_removal_count: {
      icon: AlertTriangle,
      label: "Power Disconnection",
    },
    night_driving_count: {
      icon: AlertTriangle,
      label: "Night Driving Violation",
    },
    speed_violation_count: { icon: AlertTriangle, label: "Over Speed" },
    continuous_driving_count: {
      icon: AlertTriangle,
      label: "Continuous Driving Violation",
    },
    qty_shortage: { icon: AlertTriangle, label: "Qty Shortage" },
  };

  const fetchVtsData = async (
    alertTypeValue: string,
    timeFilter?: string | null,
    customRange?: { start: Date; end: Date } | null,
    violationTypes?: string[],
    currentMode?: "violation" | "alert"
  ) => {
    setLoading(true);
    setIsRefreshing(true);
    try {
      const filters = [{ key: "bu", cond: "equals", value: selectedBu }];

      // Add zone filter if selected
      if (selectedZone && selectedZone !== "all") {
        filters.push({ key: "zone", cond: "equals", value: selectedZone });
      }

      // Add plant filter if selected
      if (selectedPlant && selectedPlant !== "all") {
        filters.push({
          key: "sap_id",
          cond: "equals",
          value: String(selectedPlant),
        });
      }

      // Generate date filter string with new filter values
      const getDateRangeString = (
        filter: string | null,
        customRange: { start: Date; end: Date } | null
      ): string => {
        const now = new Date();
        // const formatDate = (date: Date): string => format(date, 'yyyy-MM-dd');
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}-${String(d.getDate()).padStart(2, "0")}`;

        if (customRange && customRange.start && customRange.end) {
          return `${fmt(customRange.start)},${fmt(customRange.end)}`;
        }

        let result: string;
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
          // Legacy support for old values
          case "t":
            return `${fmt(now)},${fmt(now)}`;
          case "1d": {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            return `${fmt(y)},${fmt(y)}`;
          }
          case "1w": {
            const s = new Date(now);
            s.setDate(s.getDate() - 7);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "15d": {
            const s = new Date(now);
            s.setDate(s.getDate() - 15);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "1m": {
            const s = new Date(now);
            s.setDate(s.getDate() - 30);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "3m": {
            const s = new Date(now);
            s.setDate(s.getDate() - 90);
            return `${fmt(s)},${fmt(now)}`;
          }
          default:
            return `${fmt(now)},${fmt(now)}`;
        }
      };

      const dateFilterString = getDateRangeString(timeFilter, customRange);
      const crossFilters = [
        { key: "DATE", cond: "equals", value: dateFilterString },
      ];

      // Prepare payload based on mode
      const payload: any = {};
      const drillState =
        currentMode === "violation" ? "vts_insite_history" : "vts_insite";

      if (currentMode === "alert") {
        payload.alert_type = alertTypeValue;
      }

      // Include violation_type for both modes if violation types are selected
      if (violationTypes && violationTypes.length > 0) {
        payload.violation_type = violationTypes;
      }

      // Add pagination and search for violation mode (table API)
      if (currentMode === "violation") {
        payload.skip = currentPage * pageSize;
        payload.limit = pageSize;
        if (searchTerm && searchTerm.trim()) {
          payload.search = searchTerm.trim();
        }
      }

      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters,
        action: currentMode === "alert" ? "vts_insite" : "vts_insite_violation",
        drill_state: drillState,
        cross_filters: crossFilters,
        payload,
      });

      if (response.data?.status && response.data?.data) {
        // Extract total_count from API response
        const apiTotalCount = response.data.total_count || response.data.total || 0;
        setTotalCount(apiTotalCount);
        
        // Transform API response to VtsData format
        const transformedData = response.data.data.map(
          (item: any, index: number) => {
            return {
              slNo: (currentPage * pageSize) + index + 1,
              dealer: item.location_name || "N/A",
              ttNumber: item.tl_number || item.vehicle_number || "N/A", // Support both tl_number and vehicle_number from API
              zone: item.zone || "N/A",
              location: item.location_name || "N/A",
              transporterName: item.transporter_name || "N/A",
              created_at: item.created_at || item.date || "N/A", // Map created_at from API response
              route_deviation_count_orig: item.route_deviation_count_orig || item.route_deviation_count || 0,
              stoppage_violations_count: item.stoppage_violations_count || 0,
              device_tamper_count: item.device_tamper_count || 0,
              main_supply_removal_count: item.main_supply_removal_count || 0,
              night_driving_count: item.night_driving_count || 0,
              speed_violation_count: item.speed_violation_count || 0,
              continuous_driving_count: item.continuous_driving_count || 0,
              qty_shortage: item.qty_shortage ?? 0,
              invoice_number: item.invoice_number || 0,
            };
          }
        );
        setData(transformedData);
      } else {
        // Clear data when no response or no data
        setData([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error("Error fetching VTS data:", error);
      // Clear data on error
      setData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  useEffect(() => {
    fetchVtsData(
      alertType,
      selectedTimeFilter,
      dateRangeFilter,
      selectedViolations,
      mode
    );
  }, [
    alertType,
    selectedTimeFilter,
    dateRangeFilter,
    selectedViolations,
    mode,
    selectedZone,
    selectedPlant,
    selectedBu,
    currentPage,
    pageSize,
    searchTerm,
  ]);

  // useEffect(() => {
  //   fetchChartData(selectedTimeFilter, dateRangeFilter);
  //   // Fetch initial zone data for drill-down table with current filters
  //   fetchDrillDownData("zone");
  // }, [
  //   selectedTimeFilter,
  //   dateRangeFilter,
  //   drillState,
  //   selectedZone,
  //   selectedPlant,
  //   selectedBu,
  // ]);
  // useEffect(() => {
  //   fetchChartData(selectedTimeFilter, dateRangeFilter);
  // }, [
  //   selectedTimeFilter,
  //   dateRangeFilter,
  //   drillState,
  //   selectedZone,
  //   selectedPlant,
  //   selectedBu,
  // ]);

  // useEffect(() => {
  //   // Fetch initial zone data for drill-down table with current filters
  //   fetchDrillDownData("zone");
  // }, [
  //   selectedTimeFilter,
  //   dateRangeFilter,
  //   selectedZone,
  //   selectedPlant,
  //   selectedBu,
  // ]);
  useEffect(() => {
    fetchChartData(selectedTimeFilter, dateRangeFilter);
    // fetchDrillDownData("zone");
  }, [
    selectedTimeFilter,
    dateRangeFilter,
    drillState,
    selectedZone,
    selectedPlant,
    selectedBu,
  ]);
  // Update charts when data changes
  // useEffect(() => {
  //   if (!chartLoading) {
  //     const barData = getZoneViolationData();
  //     const pieData = getViolationTypeData();

  //     if (barData.length > 0) {
  //       createBarChart(barData);
  //     }
  //     if (pieData.length > 0) {
  //       createPieChart(pieData);
  //     }
  //   }
  // }, [chartData, chartPercentages, chartLoading, selectedBarItem]);
  // Update charts when data changes

  useEffect(() => {
    if (!chartLoading && hasFetchedChartData) {
      const barData = getZoneViolationData();
      const pieData = getViolationTypeData();

      if (barData.length > 0) {
        createBarChart(barData);
      } else {
        const filterText = selectedPlant && selectedPlant !== "all"
          ? `plant ${selectedPlant}`
          : selectedZone && selectedZone !== "all"
            ? `zone ${selectedZone}`
            : "the selected filters";

        toast.warning(`No violation data found for ${filterText}. Try adjusting your filters.`);
      }

      if (pieData.length > 0) {
        createPieChart(pieData);
      }
    }
  }, [chartData, chartPercentages, chartLoading, hasFetchedChartData, selectedBarItem]);

  const handleTimeFilterChange = (
    filter: string | null | { key: string; cond: string; value: string }
  ) => {
    if (typeof filter === "string") {
      setSelectedTimeFilter(filter);
      setDateRangeFilter(null);
    } else if (filter && typeof filter === "object" && "value" in filter) {
      // Handle custom date range
      const [startDate, endDate] = (filter as any).value.split(",");
      setDateRangeFilter({
        start: new Date(startDate),
        end: new Date(endDate),
      });
      setSelectedTimeFilter(null);
    } else {
      setSelectedTimeFilter(null);
      setDateRangeFilter(null);
    }
  };

  const handlePlantChange = (plant: string | null, zone?: string) => {
    setSelectedPlant(plant);
    if (zone !== undefined) {
      setSelectedZone(zone);
    }
  };

  const fetchViewDetails = async (
    vehicleNumber: string,
    viewType: "violation" | "itdg_alerts" = "violation" // default = violations
  ) => {
    setViewDetailsLoading(true);
    setIsRefreshing(true);

    try {
      // Base filters (used in both cases)
      const filters = [
        { key: "bu", cond: "equals", value: selectedBu || "I&C" },
      ];

      // Add optional filters if available (for violations)
      if (viewType === "violation") {
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
      }

      // Date helper
      const getDateRangeString = (
        filter?: string | null,
        customRange?: { start: Date; end: Date } | null
      ): string => {
        const now = new Date();
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}-${String(d.getDate()).padStart(2, "0")}`;

        if (customRange?.start && customRange?.end) {
          return `${fmt(customRange.start)},${fmt(customRange.end)}`;
        }

        const shift = (days: number) => {
          const d = new Date(now);
          d.setDate(d.getDate() - days);
          return fmt(d);
        };

        switch (filter) {
          case "TDY":
            return `${fmt(now)},${fmt(now)}`;
          case "YDY":
            return `${shift(1)},${shift(1)}`;
          case "1W":
            return `${shift(7)},${fmt(now)}`;
          case "15D":
            return `${shift(15)},${fmt(now)}`;
          case "1M":
            return `${shift(30)},${fmt(now)}`;
          case "3M":
            return `${shift(90)},${fmt(now)}`;
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

      const itdgPayload = {
        filters: [{ key: "bu", cond: "equals", value: selectedBu || "I&C" }],
        action: "vts_insite",
        drill_state: "vts_insite",
        cross_filters: [
          {
            key: "DATE",
            cond: "equals",
            value: dateFilterString || "2025-09-30,2025-10-30",
          },
        ],
        payload: {
          alert_type: "all_alerts",
          view: vehicleNumber,
        },
      };

      // === Violations payload ===
      const violationPayload = {
        filters,
        action: "vts_insite_violation",
        drill_state: "vts_insite_history",
        cross_filters: crossFilters,
        payload: {
          violation_type: [],
          view: vehicleNumber,
        },
      };

      // Choose payload based on type
      const requestBody =
        viewType === "itdg_alerts" ? itdgPayload : violationPayload;

      const response = await apiClient.post(
        "/api/charts/generate_vis_data",
        requestBody
      );

      if (response.data?.status && response.data?.data) {
        setViewDetailsData(response.data.data);
      } else {
        setViewDetailsData([]);
      }
    } catch (error) {
      console.error(`Error fetching ${viewType} details:`, error);
      setViewDetailsData([]);
    } finally {
      setViewDetailsLoading(false);
      setIsRefreshing(false);
    }
  };


  const handleViewRow = (row: VtsData) => {
    setSelectedRow(row);
    setIsViewDialogOpen(true);
    const viewType = mode === "alert" ? "itdg_alerts" : "violation";
    fetchViewDetails(row.ttNumber, viewType);
  };

  const resetFilters = () => {
    setAlertType("all_alerts");
    setSelectedTimeFilter("1M");
    setSelectedZone(null);
    setSelectedPlant(null);
  };
  const handleRefresh = () => {
    setSelectedBu("I&C");
    setSelectedZone(null);
    setSelectedPlant(null);
    setSelectedTimeFilter("1M");
    setDateRangeFilter(null);
    setRefreshKey((prev) => prev + 1); // Add this line
  };
  // Drill-down functions for TT Details table
  // const getAggregatedDataByLevel = (): any[] => {
  //   // Use API drill-down data if available
  //   if (drillDownData && drillDownData.length > 0) {
  //     return drillDownData.map((item: any, index: number) => ({
  //       ...item,
  //       slNo: index + 1,
  //     }));
  //   }

  //   // Return empty array if no API data is available
  //   return [];
  // };

  // const handleDrillDown = (row: any) => {
  //   if (drillDownLevel === "zone") {
  //     setSelectedDrillZone(row.zone || row.zone_name);
  //     setDrillDownLevel("plant");
  //     // Fetch location data for selected zone - use "zone" as qlick_view with zone name as click_value
  //     fetchDrillDownData("zone", row.zone || row.zone_name);
  //   } else if (drillDownLevel === "plant") {
  //     setSelectedDrillPlant(row.location_name || row.location);
  //     setDrillDownLevel("transporter");
  //     // Fetch transporter data for selected location - use "location_name" as qlick_view with location as click_value
  //     fetchDrillDownData("location_name", row.location_name || row.location);
  //   } else if (drillDownLevel === "transporter") {
  //     setSelectedDrillTransporter(row.transporter_name || row.transporterName);
  //     setDrillDownLevel("tt");
  //     // Fetch TT data for selected transporter - use "transporter_name" as qlick_view with transporter as click_value
  //     // Pass location_name for invoice details
  //     const locationName =
  //       row.location_name || row.location || selectedDrillPlant;
  //     fetchDrillDownData(
  //       "transporter_name",
  //       row.transporter_name || row.transporterName,
  //       locationName
  //     );
  //   } else if (drillDownLevel === "tt") {
  //     setSelectedDrillTT(row.tl_number || row.ttNumber);
  //     setDrillDownLevel("date");
  //     // Fetch date/invoice data for selected TT - use "tl_number" as qlick_view with TT number as click_value
  //     const ttNumber = row.tl_number || row.ttNumber;
  //     fetchDrillDownData("tl_number", ttNumber);
  //   }
  // };

  // const handleBreadcrumbClick = (
  //   level: "zone" | "plant" | "transporter" | "tt" | "date"
  // ) => {
  //   if (level === "zone") {
  //     setDrillDownLevel("zone");
  //     setSelectedDrillZone(null);
  //     setSelectedDrillPlant(null);
  //     setSelectedDrillTransporter(null);
  //     setSelectedDrillTT(null);
  //     // Fetch initial zone data
  //     fetchDrillDownData("zone");
  //   } else if (level === "plant") {
  //     setDrillDownLevel("plant");
  //     setSelectedDrillPlant(null);
  //     setSelectedDrillTransporter(null);
  //     setSelectedDrillTT(null);
  //     // Fetch plant data for selected zone - use "zone" as qlick_view with zone name as click_value
  //     if (selectedDrillZone) {
  //       fetchDrillDownData("zone", selectedDrillZone);
  //     }
  //   } else if (level === "transporter") {
  //     setDrillDownLevel("transporter");
  //     setSelectedDrillTransporter(null);
  //     setSelectedDrillTT(null);
  //     // Fetch transporter data for selected plant - use "location_name" as qlick_view with location as click_value
  //     if (selectedDrillPlant) {
  //       fetchDrillDownData("location_name", selectedDrillPlant);
  //     }
  //   } else if (level === "tt") {
  //     setDrillDownLevel("tt");
  //     setSelectedDrillTT(null);
  //     // Fetch TT data for selected transporter - use "transporter_name" as qlick_view with transporter as click_value
  //     if (selectedDrillTransporter) {
  //       // Pass location_name for invoice details
  //       const locationName = selectedDrillPlant;
  //       fetchDrillDownData(
  //         "transporter_name",
  //         selectedDrillTransporter,
  //         locationName
  //       );
  //     }
  //   }
  // };
  // Fetch chart data from API
  const fetchChartData = async (
    timeFilter?: string | null,
    customRange?: { start: Date; end: Date } | null
  ) => {
    setChartLoading(true);
    setIsRefreshing(true);
    try {
      const filters = [{ key: "bu", cond: "equals", value: selectedBu }];

      // Add zone filter if selected
      if (selectedZone && selectedZone !== "all") {
        filters.push({ key: "zone", cond: "equals", value: selectedZone });
      }

      // Add plant filter if selected
      if (selectedPlant && selectedPlant !== "all") {
        filters.push({
          key: "sap_id",
          cond: "equals",
          value: String(selectedPlant),
        });
      }

      // Generate date filter string with new filter values
      const getDateRangeString = (
        filter: string | null,
        customRange: { start: Date; end: Date } | null
      ): string => {
        const now = new Date();
        // const formatDate = (date: Date): string => format(date, 'yyyy-MM-dd');
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
          // Legacy support for old values
          case "t":
            return `${fmt(now)},${fmt(now)}`;
          case "1d": {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            return `${fmt(y)},${fmt(y)}`;
          }
          case "1w": {
            const s = new Date(now);
            s.setDate(s.getDate() - 7);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "15d": {
            const s = new Date(now);
            s.setDate(s.getDate() - 15);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "1m": {
            const s = new Date(now);
            s.setDate(s.getDate() - 30);
            return `${fmt(s)},${fmt(now)}`;
          }
          case "3m": {
            const s = new Date(now);
            s.setDate(s.getDate() - 90);
            return `${fmt(s)},${fmt(now)}`;
          }
          default:
            return `${fmt(now)},${fmt(now)}`;
        }
      };

      const dateFilterString = getDateRangeString(timeFilter, customRange);
      const crossFilters = [
        { key: "DATE", cond: "equals", value: dateFilterString },
      ];

      // Determine group_by intelligently based on filters and drill state
      let groupBy: string;
      if (selectedPlant && selectedPlant !== "all") {
        // If specific plant is selected, don't group - show aggregated data for that plant
        // We'll handle this by not sending group_by, or by using a field that shows the plant itself
        groupBy = "location_name";
      } else if (selectedZone && selectedZone !== "all") {
        // If only zone is selected, group by location_name to show plants in that zone
        groupBy = "location_name";
      } else {
        // No filters, use drill state
        groupBy = drillState === "zone" ? "zone" : "location_name";
      }

      const payload = {
        group_by: groupBy,
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters,
        action: "vts_insite_violation",
        drill_state: "vts_insite_history",
        cross_filters: crossFilters,
        payload,
      });

      if (response.data?.status && response.data?.data) {
        // Debug: Log the response to see what we're getting
        console.log("Chart API Response:", {
          filters,
          groupBy,
          data: response.data.data,
          percentages: response.data.percentages,
        });

        setChartData(response.data.data);
        setChartPercentages(response.data.percentages || []);
      } else {
        console.log("No chart data returned:", response.data);
        setChartData([]);
        setChartPercentages([]);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
      setChartData([]);
    } finally {
      setChartLoading(false);
      setHasFetchedChartData(true);
    }
  };
  // API function to fetch drill-down data
  // const fetchDrillDownData = async (
  //   level: string,
  //   clickValue?: string,
  //   locationName?: string
  // ) => {
  //   try {
  //     setDrillDownLoading(true);

  //     // Build filters array
  //     const filters = [{ key: "bu", cond: "equals", value: selectedBu || "I&C" }];

  //     // Add zone filter if selected
  //     if (selectedZone && selectedZone !== "all") {
  //       filters.push({ key: "zone", cond: "equals", value: selectedZone });
  //     }

  //     // Add plant filter if selected
  //     if (selectedPlant && selectedPlant !== "all") {
  //       filters.push({
  //         key: "sap_id",
  //         cond: "equals",
  //         value: String(selectedPlant),
  //       });
  //     }

  //     // Generate date filter string with new filter values (same as main table)
  //     const getDateRangeString = (
  //       filter?: string | null,
  //       customRange?: { start: Date; end: Date } | null
  //     ): string => {
  //       const now = new Date();
  //       // const formatDate = (date: Date): string => format(date, 'yyyy-MM-dd');
  //       const fmt = (d: Date) =>
  //         `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
  //           2,
  //           "0"
  //         )}-${String(d.getDate()).padStart(2, "0")}`;

  //       if (customRange && customRange.start && customRange.end) {
  //         return `${fmt(customRange.start)},${fmt(customRange.end)}`;
  //       }

  //       switch (filter) {

  //         case "TDY":
  //           return `${fmt(now)},${fmt(now)}`;
  //         case "YDY": {
  //           const y = new Date(now);
  //           y.setDate(y.getDate() - 1);
  //           return `${fmt(y)},${fmt(y)}`;
  //         }
  //         case "1W": {
  //           const s = new Date(now);
  //           s.setDate(s.getDate() - 7);
  //           return `${fmt(s)},${fmt(now)}`;
  //         }
  //         case "15D": {
  //           const s = new Date(now);
  //           s.setDate(s.getDate() - 15);
  //           return `${fmt(s)},${fmt(now)}`;
  //         }
  //         case "1M": {
  //           const s = new Date(now);
  //           s.setDate(s.getDate() - 30);
  //           return `${fmt(s)},${fmt(now)}`;
  //         }
  //         case "3M": {
  //           const s = new Date(now);
  //           s.setDate(s.getDate() - 90);
  //           return `${fmt(s)},${fmt(now)}`;
  //         }
  //         // Legacy support for old values
  //         case "t":
  //           return `${fmt(now)},${fmt(now)}`;
  //         case "1d": {
  //           const y = new Date(now);
  //           y.setDate(y.getDate() - 1);
  //           return `${fmt(y)},${fmt(y)}`;
  //         }
  //         case "1w": {
  //           const s = new Date(now);
  //           s.setDate(s.getDate() - 7);
  //           return `${fmt(s)},${fmt(now)}`;
  //         }
  //         case "15d": {
  //           const s = new Date(now);
  //           s.setDate(s.getDate() - 15);
  //           return `${fmt(s)},${fmt(now)}`;
  //         }
  //         case "1m": {
  //           const s = new Date(now);
  //           s.setDate(s.getDate() - 30);
  //           return `${fmt(s)},${fmt(now)}`;
  //         }
  //         case "3m": {
  //           const s = new Date(now);
  //           s.setDate(s.getDate() - 90);
  //           return `${fmt(s)},${fmt(now)}`;
  //         }
  //         default:
  //           return `${fmt(now)},${fmt(now)}`;
  //       }
  //     };

  //     const dateFilterString = getDateRangeString(
  //       selectedTimeFilter,
  //       dateRangeFilter
  //     );
  //     const crossFilters = [
  //       { key: "DATE", cond: "equals", value: dateFilterString },
  //     ];

  //     let payload: any = {
  //       qlick_view: level,
  //     };

  //     // Add click_value for deeper drill-down levels
  //     if (clickValue) {
  //       payload.click_value = clickValue;
  //     }

  //     // Add location_name for transporter level drill-down
  //     if (level === "transporter_name" && locationName) {
  //       payload.location_name = locationName;
  //     }

  //     const response = await apiClient.post("/api/charts/generate_vis_data", {
  //       filters,
  //       action: "vts_insite_violation",
  //       drill_state: "vts_insite_history",
  //       cross_filters: crossFilters,
  //       payload,
  //     });

  //     if (response.data && response.data.status && response.data.data) {
  //       setDrillDownData(response.data.data);
  //     } else {
  //       setDrillDownData([]);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching drill-down data:", error);
  //     setDrillDownData([]);
  //   } finally {
  //     setDrillDownLoading(false);
  //     setIsRefreshing(false);
  //   }
  // };

  // Chart data processing functions
  const getZoneViolationData = () => {
    // Use API chart data if available
    if (chartData && chartData.length > 0) {
      // Check if data is in new format (flat structure with zone/location_name and total_count)
      if (
        chartData[0] &&
        typeof chartData[0] === "object" &&
        ("zone" in chartData[0] || "location_name" in chartData[0]) &&
        "total_count" in chartData[0]
      ) {
        return chartData
          .map((item: any) => ({
            zone: item.zone || item.location_name,
            count: item.total_count || 0,
          }))
          .sort((a, b) => b.count - a.count);
      }

      // Old format handling (nested structure)
      return chartData
        .map((locationData: any) => {
          const locationName = Object.keys(locationData)[0];
          const violations = locationData[locationName];

          // Check if violations is an array
          if (Array.isArray(violations)) {
            const totalCount = violations.reduce(
              (sum: number, violation: any) => {
                return sum + (violation.count || 0);
              },
              0
            );

            return {
              zone: locationName,
              count: totalCount,
            };
          }

          return {
            zone: locationName,
            count: 0,
          };
        })
        .sort((a, b) => b.count - a.count);
    }

    // No data available
    return [];
  };

  const getViolationTypeData = () => {
    const violationTypeMapping: { [key: string]: string } = {
      route_deviation_count_orig: "Route Deviation",
      stoppage_violations_count: "Unauthorised Stoppage",
      device_tamper_count: "Device Tampering",
      main_supply_removal_count: "Power Disconnection",
      night_driving_count: "Night Driving",
      speed_violation_count: "Over Speed",
      continuous_driving_count: "Continuous Driving",
    };

    // Check if chartData is in new format (has zone/location_name and violation count fields)
    if (
      chartData &&
      chartData.length > 0 &&
      chartData[0] &&
      typeof chartData[0] === "object" &&
      ("zone" in chartData[0] || "location_name" in chartData[0]) &&
      "route_deviation_count_orig" in chartData[0]
    ) {
      // If a bar is selected, show data for that specific zone/plant
      if (selectedBarItem) {
        const selectedItem = chartData.find(
          (item: any) => (item.zone || item.location_name) === selectedBarItem
        );

        if (selectedItem) {
          const violations = [
            {
              type: "route_deviation_count_orig",
              count: selectedItem.route_deviation_count_orig || 0,
            },
            {
              type: "stoppage_violations_count",
              count: selectedItem.stoppage_violations_count || 0,
            },
            {
              type: "device_tamper_count",
              count: selectedItem.device_tamper_count || 0,
            },
            {
              type: "main_supply_removal_count",
              count: selectedItem.main_supply_removal_count || 0,
            },
            {
              type: "night_driving_count",
              count: selectedItem.night_driving_count || 0,
            },
            {
              type: "speed_violation_count",
              count: selectedItem.speed_violation_count || 0,
            },
            {
              type: "continuous_driving_count",
              count: selectedItem.continuous_driving_count || 0,
            },
          ];

          const total = violations.reduce((sum, v) => sum + v.count, 0);

          return violations
            .map((v) => ({
              name: violationTypeMapping[v.type] || v.type,
              value: total > 0 ? (v.count / total) * 100 : 0,
              count: v.count,
            }))
            .filter((item) => item.count > 0)
            .sort((a, b) => b.value - a.value);
        }
      }

      // Aggregate all violations across zones
      const totals = chartData.reduce(
        (acc: any, item: any) => {
          acc.route_deviation_count_orig += item.route_deviation_count_orig || 0;
          acc.stoppage_violations_count += item.stoppage_violations_count || 0;
          acc.device_tamper_count += item.device_tamper_count || 0;
          acc.main_supply_removal_count += item.main_supply_removal_count || 0;
          acc.night_driving_count += item.night_driving_count || 0;
          acc.speed_violation_count += item.speed_violation_count || 0;
          acc.continuous_driving_count += item.continuous_driving_count || 0;
          return acc;
        },
        {
          route_deviation_count_orig: 0,
          stoppage_violations_count: 0,
          device_tamper_count: 0,
          main_supply_removal_count: 0,
          night_driving_count: 0,
          speed_violation_count: 0,
          continuous_driving_count: 0,
        }
      );

      const violations = [
        { type: "route_deviation_count_orig", count: totals.route_deviation_count_orig },
        {
          type: "stoppage_violations_count",
          count: totals.stoppage_violations_count,
        },
        { type: "device_tamper_count", count: totals.device_tamper_count },
        {
          type: "main_supply_removal_count",
          count: totals.main_supply_removal_count,
        },
        { type: "night_driving_count", count: totals.night_driving_count },
        { type: "speed_violation_count", count: totals.speed_violation_count },
        {
          type: "continuous_driving_count",
          count: totals.continuous_driving_count,
        },
      ];

      const grandTotal = violations.reduce((sum, v) => sum + v.count, 0);

      return violations
        .map((v) => ({
          name: violationTypeMapping[v.type] || v.type,
          value: grandTotal > 0 ? (v.count / grandTotal) * 100 : 0,
          count: v.count,
        }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.value - a.value);
    }

    // Old format handling with chartPercentages
    if (chartPercentages && chartPercentages.length > 0) {
      // If a bar is selected, filter the data for that specific zone/plant
      if (selectedBarItem) {
        const selectedItemData = chartData.find((item) => {
          const key = Object.keys(item)[0];
          return key === selectedBarItem;
        });

        if (selectedItemData) {
          const key = Object.keys(selectedItemData)[0];
          const violations = selectedItemData[key];
          const total = violations.reduce(
            (sum: number, v: any) => sum + v.count,
            0
          );

          return violations
            .map((violation: any) => ({
              name:
                violationTypeMapping[violation.violation_type] ||
                violation.violation_type,
              value: total > 0 ? (violation.count / total) * 100 : 0,
              count: violation.count || 0,
            }))
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value);
        }
      }

      return chartPercentages
        .map((item: any) => ({
          name:
            violationTypeMapping[item.violation_type] || item.violation_type,
          value: item.percentage || 0,
          count: item.count || 0,
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);
    }

    // No data available
    return [];
  };

  const COLORS = [
    "#8B5CF6",
    "#A855F7",
    "#C084FC",
    "#DDD6FE",
    "#E9D5FF",
    "#F3E8FF",
    "#FAF5FF",
  ];

  // AmCharts functions
  const createBarChart = (data: any[]) => {
    if (!barChartRef.current) return;

    // Dispose previous chart
    if (barChartRoot.current) {
      barChartRoot.current.dispose();
    }

    // Create root element
    const root = am5.Root.new(barChartRef.current);
    barChartRoot.current = root;

    // Hide AmCharts logo
    root._logo?.dispose();

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        layout: root.verticalLayout,
      })
    );

    // Create axes
    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "zone",
        renderer: am5xy.AxisRendererY.new(root, {
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          minGridDistance: 30,
        }),
      })
    );

    // Decrease label text size for Y axis
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 8,
      fontWeight: "300",
    });

    // Set default zoom to show only 4 bars
    // yAxis.set("maxZoomCount", 4);

    // Add clean, minimalist scrollbar matching the image design
    const scrollbar = chart.set(
      "scrollbarY",
      am5.Scrollbar.new(root, {
        orientation: "vertical",
        width: 10,
      })
    );

    // Customize scrollbar background - very light grey/off-white
    scrollbar.get("background").setAll({
      fill: am5.color("#fafafa"),
      fillOpacity: 1,
      stroke: am5.color("#e5e5e5"),
      strokeWidth: 0.5,
    });

    // Customize scrollbar thumb - light blue with rounded ends
    scrollbar.thumb.setAll({
      fill: am5.color("#7dd3fc"),
      fillOpacity: 1,
      stroke: am5.color("#0ea5e9"),
      strokeWidth: 0.3,
    });

    // Remove grips completely for minimalist design
    scrollbar.startGrip.setAll({
      scale: 0,
    });

    scrollbar.endGrip.setAll({
      scale: 0,
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {}),
      })
    );

    // Decrease label text size for X axis
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 8,
      fontWeight: "300",
    });

    // Create series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Violations",
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "count",
        categoryYField: "zone",
        fill: am5.color("#8B5CF6"),
      })
    );

    // Add click functionality and labels to bars
    series.columns.template.setAll({
      cursorOverStyle: "pointer",
      tooltipText: "{categoryY}: {valueX} violations",
    });

    // Add labels on the right side of bars using bullets
    series.bullets.push((root, series, dataItem) => {
      const value = dataItem.get("valueX");
      return am5.Bullet.new(root, {
        locationX: 1,
        locationY: 0.5,
        sprite: am5.Label.new(root, {
          text: value ? value.toString() : "",
          fontSize: 10,
          fontWeight: "500",
          fill: am5.color("#374151"),
          centerX: am5.p50,
          centerY: am5.p50,
          paddingLeft: 8, // Add padding inside label
          paddingRight: 8,
          dx: 20, // Move label 10px away from bar edge
        }),
      });
    });

    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem;
      if (dataItem) {
        const dataContext = dataItem.dataContext as any;
        const category = dataContext?.zone as string;
        setSelectedBarItem(category);
      }
    });

    // Set initial zoom to show only 4 bars
    series.appear(1000, 100);
    chart.appear(1000, 100);

    // Zoom to show only 4 bars initially
    setTimeout(() => {
      if (data.length > 7) {
        yAxis.zoomToIndexes(data.length - 7, data.length - 1);
      }
    }, 100);

    // Add data
    yAxis.data.setAll(data);
    series.data.setAll(data);

    // Add cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {}));

    // Add small legend
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.p50,
        x: am5.p50,
      })
    );

    // Configure legend items
    legend.labels.template.setAll({
      fontSize: 9,
      fontWeight: "400",
    });

    legend.markers.template.setAll({
      width: 8,
      height: 8,
    });

    legend.data.setAll(chart.series.values);
  };

  const createPieChart = (data: any[]) => {
    if (!pieChartRef.current) return;

    // Dispose previous chart
    if (pieChartRoot.current) {
      pieChartRoot.current.dispose();
    }

    // Create root element
    const root = am5.Root.new(pieChartRef.current);
    pieChartRoot.current = root;

    // Hide AmCharts logo
    root._logo?.dispose();

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        radius: am5.percent(80),
      })
    );

    // Create series
    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        alignLabels: true,
        calculateAggregates: true,
        valueField: "value",
        categoryField: "name",
        innerRadius: am5.percent(20),
      })
    );

    // Configure slices with adaptive radius
    series.slices.template.setAll({
      tooltipText: "{category}: {value} violations",
      stroke: am5.color(0xffffff),
      strokeWidth: 3,
      cornerRadius: 4,
    });

    // Add adapter to show actual count and total in tooltip
    series.slices.template.adapters.add("tooltipText", (text, target) => {
      const dataItem = target.dataItem;
      if (dataItem) {
        const dataContext = dataItem.dataContext as any;
        const category = dataContext?.name;
        const count = dataContext?.count || 0;

        // Show count with zone name if filtered
        if (selectedBarItem) {
          return `${category}: ${count} violations (${selectedBarItem})`;
        }

        // Show total count across all zones
        return `${category}: ${count} violations`;
      }
      return text;
    });

    // Adaptive radius based on value
    series.slices.template.adapters.add("radius", function (radius, target) {
      const dataItem = target.dataItem;
      const high = series.getPrivate("valueHigh");

      if (dataItem) {
        const dataContext = dataItem?.dataContext as any;
        const value = dataContext?.value || 0;
        const minRadius = 0.6;
        const radiusFactor =
          minRadius + (1 - minRadius) * (value / (high || 1));
        return radius * radiusFactor;
      }
      return radius;
    });

    // Configure labels
    series.labels.template.setAll({
      textType: "regular",
      centerX: 0,
      centerY: 0,
      fontSize: 8,
      fontWeight: "700",
      fill: am5.color("#374151"),
      text: "{category}\n{valuePercentTotal.formatNumber('#.##')}%",
      oversizedBehavior: "wrap",
      maxWidth: 100,
      textAlign: "center",
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 0,
      paddingRight: 0,
    });

    // Configure ticks
    series.ticks.template.setAll({
      strokeOpacity: 0.8,
      stroke: am5.color("#666666"),
      strokeWidth: 1,
      visible: true,
      length: 15,
    });

    series.labelsContainer.set("paddingTop", 20);

    // Set colors using COLORS array
    series.slices.template.adapters.add("fill", (fill, target) => {
      const dataItem =
        target.dataItem as am5.DataItem<am5percent.IPieSeriesDataItem>;
      if (dataItem) {
        const index = series.dataItems.indexOf(dataItem);
        return am5.color(COLORS[index % COLORS.length]);
      }
      return fill;
    });

    // Add data
    series.data.setAll(data);

    // Animate appearance
    series.appear(1000, 100);
    chart.appear(1000, 100);
  };

  // Cleanup charts on unmount
  useEffect(() => {
    return () => {
      if (barChartRoot.current) {
        barChartRoot.current.dispose();
      }
      if (pieChartRoot.current) {
        pieChartRoot.current.dispose();
      }
    };
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 p-1">
        <div className="max-w-full mx-auto">
          {/* Header */}

          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              VTS Insights Dashboard
            </h1>

            <div className="flex gap-2">
              {mode === "alert" && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 font-medium">
                    Alert Type:
                  </label>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all_alerts">All Alerts</option>
                    <option value="blocked">Blocked</option>
                    <option value="auto_unblock">Auto Unblock</option>
                    <option value="manual_unblock">Manual Unblock</option>
                  </select>
                </div>
              )}

              <ReusableFilterBar
                key={refreshKey}
                refreshKey={refreshKey}
                selectedBu={selectedBu}
                onBuChange={setSelectedBu}
                selectedZone={selectedZone}
                onZoneChange={setSelectedZone}
                selectedPlant={selectedPlant}
                onPlantChange={setSelectedPlant}
                timeFilter={selectedTimeFilter}
                onTimeFilterChange={handleTimeFilterChange}
                onRefresh={handleRefresh}
                isLoading={isRefreshing}
                hideBuSelect={true}
                sendEmptyBu={true}
              />
            </div>
          </div>

          {/* Charts Section */}
          {/* <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-4">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Violation Analytics by{" "}
                    {drillState === "zone" ? "Zone" : "Plant"}
                  </h2>
                  {selectedBarItem && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        Filtered by:{" "}
                        <span className="font-medium text-blue-600">
                          {selectedBarItem}
                        </span>
                      </span>
                      <button
                        onClick={() => setSelectedBarItem(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Clear filter
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">View by:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setDrillState("zone")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${drillState === "zone"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                      Zone
                    </button>
                    <button
                      onClick={() => setDrillState("location")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${drillState === "location"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                      Plant
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">

                  <div className="h-80 relative">
                    <div ref={barChartRef} className="w-full h-full"></div>

                    {chartLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center text-gray-500">
                          <svg
                            className="animate-spin h-6 w-6 mb-2 text-blue-500"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            ></path>
                          </svg>
                          <span>Loading chart data...</span>
                        </div>
                      </div>
                    )}

                    {!chartLoading && getZoneViolationData().length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center bg-white/70 backdrop-blur-sm z-10">
                        <div>
                          <div className="text-lg mb-2">📊</div>
                          <div>No data available</div>
                          <div className="text-sm mt-1">Try adjusting your filters</div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    Violation Distribution
                    {selectedBarItem
                      ? ` - ${selectedBarItem}`
                      : selectedPlant && selectedPlant !== "all"
                        ? ` - ${selectedPlant}`
                        : selectedZone && selectedZone !== "all"
                          ? ` - ${selectedZone}`
                          : " - All India"}
                  </h3>
                  <div className="h-64 relative">
                    <div ref={pieChartRef} className="w-full h-full"></div>

                    {chartLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center text-gray-500">
                          <svg
                            className="animate-spin h-6 w-6 mb-2 text-blue-500"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            ></path>
                          </svg>
                          <span>Loading chart data...</span>
                        </div>
                      </div>
                    )}

                    {!chartLoading && getViolationTypeData().length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center bg-white/70 backdrop-blur-sm z-10">
                        <div>
                          <div className="text-lg mb-2">📊</div>
                          <div>No data available</div>
                          <div className="text-sm mt-1">Try adjusting your filters</div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div> */}

          <VTSInsightTable
            data={data}
            loading={loading}
            // searchTerm={searchTerm}
            // setSearchTerm={setSearchTerm}
            filters={filters}
            setFilters={setFilters}
            selectedViolations={selectedViolations}
            setSelectedViolations={setSelectedViolations}
            mode={mode}
            setMode={setMode}
            onViewRow={handleViewRow}
            violationTypes={violationTypes}
            violationTypeTooltips={violationTypeTooltips}
            columnConfig={columnConfig}
            selectedBu={selectedBu}
            selectedZone={selectedZone}
            selectedPlant={selectedPlant}
            selectedTimeFilter={selectedTimeFilter}
            dateRangeFilter={dateRangeFilter}
            alertType={alertType}
            hideModeToggle={true}
            totalCount={totalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>

            <DialogTitle className="text-lg font-semibold text-gray-900">
              {mode === "alert"
                ? "ITDG Alert Details"
                : "VTS Violation Details"}{" "}
              - {selectedRow?.ttNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-6">
              {/* Vehicle Details */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600">Zone</span>
                    <span className="text-sm font-medium">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {viewDetailsData.length > 0
                          ? viewDetailsData[0].zone
                          : "N/A"}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600">Location</span>
                    <span className="text-sm font-medium">
                      {viewDetailsData.length > 0
                        ? viewDetailsData[0].location_name
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600">Transporter</span>
                    <span className="text-sm font-medium">
                      {viewDetailsData.length > 0
                        ? viewDetailsData[0].transporter_name
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* API Response Table */}
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  {/* <h3 className="text-sm font-medium text-gray-700">Detailed Violation Data</h3> */}
                  <h3 className="text-sm font-medium text-gray-700">
                    {mode === "alert"
                      ? "Detailed ITDG Alert Data"
                      : "Detailed Violation Data"}
                  </h3>
                </div>
                <div className="overflow-x-auto p-4">
                  {viewDetailsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600">
                          Loading details...
                        </span>
                      </div>
                    </div>
                  ) : viewDetailsData.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">
                            Date
                          </th>

                          <th className="text-center py-3 px-4 font-semibold text-gray-700 " title="Route Deviation">
                            RD
                          </th>

                          <th className="text-center py-3 px-4 font-semibold text-gray-700 " title="Unauthorised Stoppage">
                            UNS
                          </th>

                          <th className="text-center py-3 px-4 font-semibold text-gray-700 " title="Device Tampering">
                            DT
                          </th>

                          <th className="text-center py-3 px-4 font-semibold text-gray-700 " title="Power Disconnection">
                            PD
                          </th>

                          <th className="text-center py-3 px-4 font-semibold text-gray-700 " title="Night Driving">
                            ND
                          </th>


                          <th className="text-center py-3 px-4 font-semibold text-gray-700 " title="Over Speed">
                            OS
                          </th>

                          <th className="text-center py-3 px-4 font-semibold text-gray-700 " title="Continuous Driving">
                            CD
                          </th>

                          {mode === "violation" && (
                            <th className="text-center py-3 px-4 font-semibold text-gray-700" title="Shortage quantity">
                              SQ
                            </th>
                          )}

                          {/* <th className="text-center py-3 px-4 font-semibold text-gray-700 bg-blue-50">
                            Total
                          </th> */}
                        </tr>
                      </thead>
                      <tbody>
                        {viewDetailsData.map((item: any, index: number) => {
                          const rowTotal =
                            (item.route_deviation_count || 0) +
                            (item.stoppage_violations_count || 0) +
                            (item.device_tamper_count || 0) +
                            (item.main_supply_removal_count || 0) +
                            (item.night_driving_count || 0) +
                            (item.speed_violation_count || 0) +
                            (item.continuous_driving_count || 0) +
                            (item.qty_shortage_detail || 0)

                          return (
                            <tr
                              key={index}
                              className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
                            >
                              <td className="py-3 px-4 font-medium text-gray-900">
                                <div className="flex flex-col">

                                  <td className="py-3 px-4 font-medium text-gray-900">
                                    <span className="font-semibold">
                                      {/* {mode === "violation"
                                        ? item.violation_date || "N/A"
                                        : item.created_at?.slice(0, 10) ||
                                          "N/A"} */}
                                      {mode === "violation" ? (
                                        <div>
                                          <div>{item.violation_date || "N/A"}</div>
                                          <div className="text-sm text-gray-500">
                                            {item.invoice_number || "N/A"}
                                          </div>
                                        </div>
                                      ) : (
                                        item.created_at?.slice(0, 10) || "N/A"
                                      )}
                                    </span>
                                  </td>
                                </div>
                              </td>
                              <td
                                className={`text-center py-3 px-4 ${(item.route_deviation_count || 0) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-500"
                                  }`}
                              >
                                {item.route_deviation_count || 0}
                              </td>
                              <td
                                className={`text-center py-3 px-4 ${(item.stoppage_violations_count || 0) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-500"
                                  }`}
                              >
                                {item.stoppage_violations_count || 0}
                              </td>
                              <td
                                className={`text-center py-3 px-4 ${(item.device_tamper_count || 0) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-500"
                                  }`}
                              >
                                {item.device_tamper_count || 0}
                              </td>
                              <td
                                className={`text-center py-3 px-4 ${(item.main_supply_removal_count || 0) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-500"
                                  }`}
                              >
                                {item.main_supply_removal_count || 0}
                              </td>
                              <td
                                className={`text-center py-3 px-4 ${(item.night_driving_count || 0) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-500"
                                  }`}
                              >
                                {item.night_driving_count || 0}
                              </td>
                              <td
                                className={`text-center py-3 px-4 ${(item.speed_violation_count || 0) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-500"
                                  }`}
                              >
                                {item.speed_violation_count || 0}
                              </td>
                              <td
                                className={`text-center py-3 px-4 ${(item.continuous_driving_count || 0) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-500"
                                  }`}
                              >
                                {item.continuous_driving_count || 0}
                              </td>
                              {mode === "violation" && (
                                <td
                                  className={`text-center py-3 px-4 ${mode === "violation" && (item.qty_shortage_detail || 0) > 0
                                      ? "text-red-600 font-semibold"
                                      : "text-gray-500"
                                    }`}
                                >
                                  {item.qty_shortage_detail || 0}
                                </td>)}
                              {/* <td
                                className={`text-center py-3 px-4 ${
                                  (item.qty_shortage_detail|| 0) > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-500"
                                }`}
                              >
                                {item.qty_shortage_detail|| 0}
                              </td> */}

                              {/* <td
                                className={`text-center py-3 px-4 font-bold bg-blue-50 ${
                                  rowTotal > 0
                                    ? "text-blue-600"
                                    : "text-gray-500"
                                }`}
                              >
                                                                {rowTotal}
                              </td> */}
                            </tr>
                          );
                        })}

                        {/* Total Row at Bottom */}
                        {/* {(() => {
                          const columnTotals = viewDetailsData.reduce(
                            (acc: any, item: any) => {
                                                        return {
                                                            rd: acc.rd + (item.route_deviation_count || 0),
                                uns:
                                  acc.uns +
                                  (item.stoppage_violations_count || 0),
                                                            dt: acc.dt + (item.device_tamper_count || 0),
                                pd:
                                  acc.pd +
                                  (item.main_supply_removal_count || 0),
                                                            nd: acc.nd + (item.night_driving_count || 0),
                                                            os: acc.os + (item.speed_violation_count || 0),
                                cd:
                                  acc.cd + (item.continuous_driving_count || 0),
                                  sq:acc.sq+(item.qty_shortage_detail|| 0)
                              };
                            
                            },
                            { rd: 0, uns: 0, dt: 0, pd: 0, nd: 0, os: 0, cd: 0 }
                          );

                          const grandTotal =
                            columnTotals.rd +
                            columnTotals.uns +
                            columnTotals.dt +
                            columnTotals.pd +
                            columnTotals.nd +
                            columnTotals.os +
                            columnTotals.cd;
                                                   
                                                    return (
                                                        <tr className="bg-gray-100 border-t-2 border-gray-300">
                                                            <td className="py-3 px-4 font-bold text-gray-900">
                                                                Total
                                                            </td>
                                                            <td className="text-center py-3 px-4 font-bold text-gray-900">
                                                                {columnTotals.rd}
                                                            </td>
                                                            <td className="text-center py-3 px-4 font-bold text-gray-900">
                                                                {columnTotals.uns}
                                                            </td>
                                                            <td className="text-center py-3 px-4 font-bold text-gray-900">
                                                                {columnTotals.dt}
                                                            </td>
                                                            <td className="text-center py-3 px-4 font-bold text-gray-900">
                                                                {columnTotals.pd}
                                                            </td>
                                                            <td className="text-center py-3 px-4 font-bold text-gray-900">
                                                                {columnTotals.nd}
                                                            </td>
                                                            <td className="text-center py-3 px-4 font-bold text-gray-900">
                                                                {columnTotals.os}
                                                            </td>
                                                            <td className="text-center py-3 px-4 font-bold text-gray-900">
                                                                {columnTotals.cd}
                                                            </td>
                                                            <td className="text-center py-3 px-4 font-bold text-blue-600 bg-blue-100">
                                                                {grandTotal}
                                                            </td>
                                                        </tr>
                                                    );
                        })()} */}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="text-gray-400 mb-2">
                          <AlertTriangle className="h-8 w-8 mx-auto" />
                        </div>
                        <p className="text-sm text-gray-600">
                          No detailed violation data found
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default DirectSalesInsight;