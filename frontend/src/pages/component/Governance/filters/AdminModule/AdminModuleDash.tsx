import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react";
import { Calendar, ChevronDown, RefreshCw, Ban, Loader2, Building2, Truck, MessageSquare, CalendarDays, CheckCircle2, AlertCircle, XCircle, Search, Upload, Download } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import useAuthStore from "@/store/authStore";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/@/components/ui/dialog";
import { Textarea } from "@/@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";
import ZonePlantSelections from "@/pages/component/RetailOutletHome/ZonePlantSelections";
import VTSVehicleAI from "../../VTS/VTSVehicleAI";
import EnhancedTimeFilter from '../TimeFilterButtons';
import * as XLSX from 'xlsx';

interface LocationFilter {
  zone: string | null;
  plant: string | null;
}

const AdminModuleDash = () => {
  const { user } = useAuthStore();

  // Helper function to convert TAS to SOD for display
  const convertBuForDisplay = (bu: string) => {
    return bu === "TAS" ? "SOD" : bu;
  };

  // Helper function to convert SOD to TAS for API calls
  const convertBuForApi = (bu: string) => {
    return bu === "SOD" ? "TAS" : bu;
  };
  const userBu = user?.bu;
  const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
  const isSodUser = Array.isArray(userBu) && userBu.includes('SOD');
  const hasUserBu = isLpgUser || isSodUser;

  const [selectedBu, setSelectedBu] = useState(isLpgUser ? 'LPG' : isSodUser ? 'SOD' : 'SOD');
  const [truckNumber, setTruckNumber] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [remarks, setRemark] = useState("");
  // const [isDaysDropdownOpen, setIsDaysDropdownOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockedTrucks, setBlockedTrucks] = useState<any[]>([]);
  const [unblockedTrucks, setUnblockedTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"blocked" | "unblocked" | "alerts">("blocked");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: null
  });
  const [alertsData, setAlertsData] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState("");
  const [unblockingAlertId, setUnblockingAlertId] = useState<string | null>(null);
  const systemRole = user?.system_role || [];
  const isAdmin = systemRole && systemRole.length > 0;
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isUnblockDialogOpen, setIsUnblockDialogOpen] = useState(false);
  const [unblockRemark, setUnblockRemark] = useState('');
  const [unblockDocument, setUnblockDocument] = useState<File | null>(null);
  const [unblockingTruckId, setUnblockingTruckId] = useState<number | null>(null);
  const [isUnblockAlertDialogOpen, setIsUnblockAlertDialogOpen] = useState(false);
  const [unblockAlertRemark, setUnblockAlertRemark] = useState('');
  const [unblockAlertDocument, setUnblockAlertDocument] = useState<File | null>(null);
  const [unblockingAlertUniqueId, setUnblockingAlertUniqueId] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<{
    blocked: string | null | { key: string; cond: string; value: string };
    unblocked: string | null | { key: string; cond: string; value: string };
    alerts: string | null | { key: string; cond: string; value: string };
  }>({
    blocked: null,
    unblocked: null,
    alerts: null
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [blockedTotal, setBlockedTotal] = useState(0);
  const [unblockedTotal, setUnblockedTotal] = useState(0);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const isInitialTabFilterMount = useRef(true);

  /** Native scrollbars are hidden by index.css + macOS overlay — use a custom horizontal track (always visible). */
  const tableScrollOuterRef = useRef<HTMLDivElement>(null);
  const tableScrollInnerRef = useRef<HTMLDivElement>(null);
  const hCustomTrackRef = useRef<HTMLDivElement>(null);
  const [hScrollMetrics, setHScrollMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    trackWidth: 0,
  });

  const updateHScrollMetrics = useCallback(() => {
    const inner = tableScrollInnerRef.current;
    const track = hCustomTrackRef.current;
    if (!inner) return;
    setHScrollMetrics({
      scrollLeft: inner.scrollLeft,
      scrollWidth: inner.scrollWidth,
      clientWidth: inner.clientWidth,
      trackWidth: track?.clientWidth ?? inner.clientWidth,
    });
  }, []);

  const handleHThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const inner = tableScrollInnerRef.current;
    const track = hCustomTrackRef.current;
    if (!inner || !track) return;
    const maxScroll = Math.max(0, inner.scrollWidth - inner.clientWidth);
    if (maxScroll <= 0) return;
    const trackW = track.clientWidth;
    const thumbW = Math.max(40, (inner.clientWidth / inner.scrollWidth) * trackW);
    const movable = Math.max(1, trackW - thumbW);
    const startX = e.clientX;
    const startScroll = inner.scrollLeft;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      inner.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleHTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.thumb === "true") return;
    const inner = tableScrollInnerRef.current;
    const track = hCustomTrackRef.current;
    if (!inner || !track) return;
    const maxScroll = Math.max(0, inner.scrollWidth - inner.clientWidth);
    if (maxScroll <= 0) return;
    const rect = track.getBoundingClientRect();
    const trackW = track.clientWidth;
    const thumbW = Math.max(40, (inner.clientWidth / inner.scrollWidth) * trackW);
    const movable = Math.max(1, trackW - thumbW);
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (x - thumbW / 2) / movable));
    inner.scrollLeft = ratio * maxScroll;
  };

  useEffect(() => {
    const inner = tableScrollInnerRef.current;
    const outer = tableScrollOuterRef.current;
    const track = hCustomTrackRef.current;
    if (!inner) return;
    const ro = new ResizeObserver(() => {
      updateHScrollMetrics();
    });
    ro.observe(inner);
    if (outer) ro.observe(outer);
    if (track) ro.observe(track);
    window.addEventListener("resize", updateHScrollMetrics);
    const raf = requestAnimationFrame(() => {
      updateHScrollMetrics();
      const t = hCustomTrackRef.current;
      if (t) ro.observe(t);
    });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", updateHScrollMetrics);
    };
  }, [updateHScrollMetrics, loading, alertsLoading, activeTab]);

  const handleTimeFilterChange = (newFilter: string | null | { key: string; cond: string; value: string }) => {
    setTimeFilter(prev => ({
      ...prev,
      [activeTab]: newFilter
    }));
  };

  const buildDateFilterQuery = (timeFilter: string | null | { key: string; cond: string; value: string }) => {
    if (!timeFilter) return "";

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (typeof timeFilter === 'string') {
      switch (timeFilter) {
        case 'TDY':
          return "created_at::DATE = CURRENT_DATE";
        case 'YDY':
          return `created_at::DATE = '${yesterday.toISOString().split('T')[0]}'`;
        case '1W':
          const oneWeekAgo = new Date(today);
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return `created_at::DATE >= '${oneWeekAgo.toISOString().split('T')[0]}'`;
        case '15D':
          const fifteenDaysAgo = new Date(today);
          fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
          return `created_at::DATE >= '${fifteenDaysAgo.toISOString().split('T')[0]}'`;
        case '1M':
          const oneMonthAgo = new Date(today);
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          return `created_at::DATE >= '${oneMonthAgo.toISOString().split('T')[0]}'`;
        case '3M':
          const threeMonthsAgo = new Date(today);
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          return `created_at::DATE >= '${threeMonthsAgo.toISOString().split('T')[0]}'`;
        default:
          return "";
      }
    } else if (typeof timeFilter === 'object' && timeFilter.key === 'Date') {
      // Handle custom date range: value is in format "startDate,endDate"
      const [startDate, endDate] = timeFilter.value.split(',');
      if (startDate && endDate) {
        return `created_at::DATE >= '${startDate}' AND created_at::DATE <= '${endDate}'`;
      }
    }

    return "";
  };

  const fetchBlockedTrucks = useCallback(async (startRow: number = 0, endRow: number = pageSize, sortModel?: any) => {
    setLoading(true);
    setError("");
    setIsRefreshing(true);
    try {
      const currentPageNumber = Math.floor(startRow / pageSize);
      const fields = [
        "bu",
        "zone",
        "location_name",
        "vehicle_number",
        "id",
        "vehicle_blocked_start_date",
        "vehicle_blocked_end_date",
        "violation_type",
        "alert_message",
        "block_status",
        "alert_history"
      ];
      // let query = "vehicle_unblocked_date is null and alert_section='VTS' and interlock_name = 'Itdg Admin Blocked'";
      // Build query dynamically like AlertTableV2.tsx
      let query = `vehicle_unblocked_date is null and alert_section='VTS' and interlock_name = 'Itdg Admin Blocked' AND bu='${convertBuForApi(selectedBu)}'`;

      // Add date filtering if timeFilter is provided for blocked tab
      const dateFilterQuery = buildDateFilterQuery(timeFilter.blocked);
      if (dateFilterQuery) {
        query += ` AND ${dateFilterQuery}`;
      }

      const params: any = {
        q: query,
        fields: JSON.stringify(fields),
        skip: currentPageNumber,
        limit: pageSize,
        sort: sortModel?.length
          ? JSON.stringify({ [sortModel[0].colId]: sortModel[0].sort })
          : JSON.stringify({ "created_at": "desc" })
      };

      // Add search text if available
      if (searchTerm.trim()) {
        params.search_text = searchTerm;
      }

      const response = await apiClient.get("/api/alerts", { params });

      setCurrentPage(currentPageNumber);

      const responseData = response.data || {};
      // Extract data directly from the response (no status field in this API)
      const blockedList = responseData.data || [];
      setBlockedTrucks(blockedList);
      setTotalRecords(responseData.total || 0);
      setBlockedTotal(responseData.total || 0);
    } catch (err) {
      console.error("Error fetching blocked trucks:", err);
      setError("Something went wrong while fetching data.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedBu, timeFilter.blocked, searchTerm, pageSize]);

  const fetchUnblockedTrucks = useCallback(async (startRow: number = 0, endRow: number = pageSize, sortModel?: any) => {
    setLoading(true);
    setError("");
    setIsRefreshing(true);
    try {
      const currentPageNumber = Math.floor(startRow / pageSize);

      // Fields for unblocked table: BU, Zone, Location, Truck No, Transaction No, Unblocked By, Blocked date, Auto Unblocked date, Days (computed), Violation Type, Remark, Uploaded Document
      const fields = [
        "bu",
        "zone",
        "location_name",
        "vehicle_number",
        "id",
        "vehicle_blocked_start_date",
        "vehicle_blocked_end_date",
        "violation_type",
        "alert_message",
        "alert_history",
        "file_uploaded_path"
      ];

      // Build query dynamically like AlertTableV2.tsx
      let query = `vehicle_unblocked_date is not null and alert_section='VTS' and interlock_name = 'Itdg Admin Blocked' AND bu='${convertBuForApi(selectedBu)}'`;

      // Add date filtering if timeFilter is provided for unblocked tab
      const dateFilterQuery = buildDateFilterQuery(timeFilter.unblocked);
      if (dateFilterQuery) {
        query += ` AND ${dateFilterQuery}`;
      }

      const params: any = {
        q: query,
        fields: JSON.stringify(fields),
        skip: currentPageNumber,
        limit: pageSize,
        sort: sortModel?.length
          ? JSON.stringify({ [sortModel[0].colId]: sortModel[0].sort })
          : JSON.stringify({ "created_at": "desc" })
      };

      // Add search text if available
      if (searchTerm.trim()) {
        params.search_text = searchTerm;
      }

      const response = await apiClient.get("/api/alerts", { params });

      setCurrentPage(currentPageNumber);

      const responseData = response.data || {};
      // Extract data directly from the response (no status field in this API)
      const unblockedList = responseData.data || [];
      setUnblockedTrucks(unblockedList);
      setTotalRecords(responseData.total || 0);
      setUnblockedTotal(responseData.total || 0);
    } catch (err) {
      console.error("Error fetching unblocked trucks:", err);
      setError("Something went wrong while fetching data.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedBu, timeFilter.unblocked, searchTerm, pageSize]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (activeTab === "blocked") {
      fetchBlockedTrucks(newPage * pageSize, (newPage + 1) * pageSize);
    } else if (activeTab === "unblocked") {
      fetchUnblockedTrucks(newPage * pageSize, (newPage + 1) * pageSize);
    } else if (activeTab === "alerts") {
      fetchAlertsData(newPage * pageSize, (newPage + 1) * pageSize);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(0); // Reset to first page when page size changes
    if (activeTab === "blocked") {
      fetchBlockedTrucks(0, newPageSize);
    } else if (activeTab === "unblocked") {
      fetchUnblockedTrucks(0, newPageSize);
    } else if (activeTab === "alerts") {
      fetchAlertsData(0, newPageSize);
    }
  };
  const fetchAlertsData = useCallback(async (startRow: number = 0, endRow: number = pageSize, sortModel?: any) => {
    setAlertsLoading(true);
    setAlertsError("");
    try {
      const currentPageNumber = Math.floor(startRow / pageSize);

      // Fields for Accept & Block (alerts) table: BU, Zone, Location, Vehicle No, Unique ID, Alert Section, Transporter Code, SAP ID, Blocked date, Auto Unblocked date, Status
      const fields = [
        "bu",
        "zone",
        "location_name",
        "vehicle_number",
        "unique_id",
        "alert_section",
        "transporter_code",
        "sap_id",
        "vehicle_blocked_start_date",
        "vehicle_blocked_end_date",
        "alert_status"
      ];

      let query = `alert_section = 'VTS'
            AND vehicle_unblocked_date IS NULL
            AND alert_status = 'Close'
            AND device_id IN ('Instance - 1', 'Instance - 2', 'Instance - 3')`;


      // Add date filtering if timeFilter is provided for alerts tab
      const dateFilterQuery = buildDateFilterQuery(timeFilter.alerts);
      if (dateFilterQuery) {
        query += ` AND ${dateFilterQuery}`;
      }

      const params: any = {
        q: query,
        fields: JSON.stringify(fields),
        skip: currentPageNumber,
        limit: pageSize,
        sort: sortModel?.length
          ? JSON.stringify({ [sortModel[0].colId]: sortModel[0].sort })
          : JSON.stringify({ "created_at": "desc" })
      };

      // Add search text if available
      if (searchTerm.trim()) {
        params.search_text = searchTerm;
      }

      const response = await apiClient.get("/api/alerts", { params });

      setCurrentPage(currentPageNumber);

      const responseData = response.data || {};
      // Extract data directly from the response (no status field in this API)
      const alertsList = responseData.data || [];
      setAlertsData(alertsList);
      setTotalRecords(responseData.total || 0);
      setAlertsTotal(responseData.total || 0);
    } catch (err) {
      console.error("Error fetching alerts data:", err);
      setAlertsError("Something went wrong while fetching alerts data.");
    } finally {
      setAlertsLoading(false);
    }
  }, [selectedBu, timeFilter.alerts, searchTerm, pageSize]);
  // const fetchAlertsData = async () => {
  //   setAlertsLoading(true);
  //   setAlertsError("");
  //   try {
  //     // Build query dynamically like AlertTableV2.tsx
  //     let query = "alert_section='VTS' and interlock_name = 'Itdg Admin Blocked'";

  //     // Add date filtering if timeFilter is provided
  //     if (timeFilter) {
  //       // Assuming timeFilter contains date range or specific date condition
  //       query += ` and ${timeFilter}`;
  //     }

  //     const payload: any = {
  //       tab: "alerts",
  //       cross_filters: [
  //         {
  //           key: "bu",
  //           cond: "equals",
  //           value: selectedBu,
  //           val: ""
  //         }
  //       ],
  //       q: query
  //     };

  //     // Add search text if available
  //     if (searchTerm.trim()) {
  //       payload.search_text = searchTerm;
  //     }

  //     const response = await apiClient.post("/api/alerts/get_vts_blocked_trucks", payload);

  //     const { status, data } = response.data || {};
  //     if (status === true || status === "success") {
  //       // Extract alert_blocked_list from the nested data structure
  //       const alertsList = data?.alert_blocked_list || [];
  //       setAlertsData(alertsList);
  //       setTotalRecords(data?.total || alertsList.length);
  //       setAlertsTotal(data?.total || alertsList.length);
  //     } else {
  //       setAlertsError("Failed to fetch alerts data.");
  //     }
  //   } catch (err) {
  //     console.error("Error fetching alerts data:", err);
  //     setAlertsError("Something went wrong while fetching alerts data.");
  //   } finally {
  //     setAlertsLoading(false);
  //   }
  // };

  const downloadData = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error("No data available to download");
      return;
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();

    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Center-align "Blocked Duration" column (requires cellStyles on write)
    const blockedDurationHeader = "Blocked Duration";
    if (data.length > 0 && worksheet["!ref"]) {
      const headers = Object.keys(data[0]);
      const colIdx = headers.indexOf(blockedDurationHeader);
      if (colIdx >= 0) {
        const range = XLSX.utils.decode_range(worksheet["!ref"]);
        for (let r = range.s.r; r <= range.e.r; r++) {
          const addr = XLSX.utils.encode_cell({ r, c: colIdx });
          const cell = worksheet[addr] as XLSX.CellObject | undefined;
          if (!cell) continue;
          worksheet[addr] = {
            ...cell,
            s: {
              alignment: { horizontal: "center", vertical: "center" },
            },
          };
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, filename, { cellStyles: true });
  };

  const handleDownload = async () => {
    // Define column mappings: property -> display name
    let columnMapping: { [key: string]: string } = {};

    if (activeTab === "blocked" || activeTab === "unblocked") {
      // For blocked/unblocked tabs: all columns except truck number, in table order
      columnMapping = {
        'bu': 'BU',
        'zone': 'Zone',
        'location_name': 'Location',
        'vehicle_number': ' Truck No',
        'blocked_by': activeTab === "unblocked" ? 'Unblocked By' : 'Blocked By',
        'vehicle_blocked_start_date': 'Blocked date',
        'vehicle_blocked_end_date': 'Unblocked date',
        'blocked_duration': 'Blocked Duration',
        'violation_type': 'Blocking Remarks',
      };
      // Manual unblocking remarks: unblocked export only
      if (activeTab === "unblocked") {
        columnMapping["manual_unblock"] = "Manual unblocking Remarks";
      }

      // Add Uploaded Document column for unblocked tab
      // if (activeTab === "unblocked") {
      //   columnMapping['file_uploaded_path'] = 'Uploaded Document';
      // }
    } else if (activeTab === "alerts") {
      // For alerts tab: columns in table order
      columnMapping = {
        'bu': 'BU',
        'zone': 'Zone',
        'location_name': 'Location',
        'vehicle_number': 'Vehicle No',
        'unique_id': 'Unique ID',
        'alert_section': 'Alert Section',
        'transporter_code': 'Transporter Code',
        'sap_id': 'SAP ID',
        'vehicle_blocked_start_date': 'Blocked date',
        'vehicle_blocked_end_date': 'Unblocked date',
        'blocked_duration': 'Blocked Duration',
        'alert_status': 'Status',
      };
    }

    // Helper function to format dates to 10 digits (YYYY-MM-DD)
    const formatDateForDownload = (dateStr: string) => {
      if (!dateStr) return "-";
      try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format (10 characters)
      } catch {
        return "-";
      }
    };

    // Filter data to include only specified columns with proper headers
    const filterDataForDownload = (data: any[]) => {
      return data.map(item => {
        const filteredItem: any = {};
        Object.entries(columnMapping).forEach(([propName, displayName]) => {
          if (propName === 'blocked_by') {
            // Match table: BlockInitiated vs UnBlockInitiated from alert_history
            const isBlocked = activeTab === "blocked";
            filteredItem[displayName] = isBlocked
              ? item.alert_history?.find((history: any) => history.action_type === "BlockInitiated")?.action_by || "-"
              : item.alert_history?.find((history: any) => history.action_type === "UnBlockInitiated")?.action_by || "-";
          } else if (propName === 'manual_unblock') {
            filteredItem[displayName] =
              item.alert_history?.find((history: any) => history.action_type === "OccUnblockingRemarks")?.action_msg || "-";
          } else if (propName === 'blocked_duration') {
            const start = item.vehicle_blocked_start_date;
            const end = item.vehicle_blocked_end_date;
            if (!start || !end) {
              filteredItem[displayName] = "-";
            } else {
              const startDate = new Date(start);
              const endDate = new Date(end);
              const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              filteredItem[displayName] = `${diffDays} days`;
            }
          } else if (propName === 'bu') {
            // Convert TAS to SOD for display
            filteredItem[displayName] = convertBuForDisplay(item[propName]) || "-";
          } else if (propName === 'vehicle_blocked_start_date' || propName === 'vehicle_blocked_end_date') {
            // Format date columns to 10 digits
            filteredItem[displayName] = formatDateForDownload(item[propName]);
          } else if (propName === 'alert_status') {
            // Capitalize alert status
            filteredItem[displayName] = item[propName] ? item[propName].charAt(0).toUpperCase() + item[propName].slice(1).toLowerCase() : "-";
          } else {
            filteredItem[displayName] = item[propName] || "-";
          }
        });
        return filteredItem;
      });
    };

    if (activeTab === "blocked") {
      try {
        // Fetch all blocked data using /api/alerts with same query as fetchBlockedTrucks
        const fields = [
          "bu",
          "zone",
          "location_name",
          "vehicle_number",
          "id",
          "vehicle_blocked_start_date",
          "vehicle_blocked_end_date",
          "violation_type",
          "alert_message",
          "block_status",
          "alert_history"
        ];

        // Build query dynamically like fetchBlockedTrucks
        let query = `vehicle_unblocked_date is null and alert_section='VTS' and interlock_name = 'Itdg Admin Blocked' AND bu='${convertBuForApi(selectedBu)}'`;

        // Add date filtering if timeFilter is provided for blocked tab
        const dateFilterQuery = buildDateFilterQuery(timeFilter.blocked);
        if (dateFilterQuery) {
          query += ` AND ${dateFilterQuery}`;
        }

        const params: any = {
          q: query,
          fields: JSON.stringify(fields),
          skip: 0,
          limit: 0,
          sort: JSON.stringify({ "created_at": "desc" })
        };

        // Add search text if available
        if (searchTerm.trim()) {
          params.search_text = searchTerm;
        }

        const response = await apiClient.get("/api/alerts", { params });
        const responseData = response.data || {};
        const blockedList = responseData.data || [];

        if (blockedList.length === 0) {
          toast.error("No data available to download");
          return;
        }

        const filteredData = filterDataForDownload(blockedList);
        downloadData(filteredData, `blocked_trucks_${new Date().toISOString().split('T')[0]}.xlsx`);
      } catch (err) {
        console.error("Error downloading blocked trucks:", err);
        toast.error("Failed to download data. Please try again.");
      }
    } else if (activeTab === "unblocked") {
      try {
        // Fetch all unblocked data using /api/alerts with same query as fetchUnblockedTrucks
        const fields = [
          "bu",
          "zone",
          "location_name",
          "vehicle_number",
          "id",
          "vehicle_blocked_start_date",
          "vehicle_blocked_end_date",
          "violation_type",
          "alert_message",
          "block_status",
          "alert_history"
        ];

        // Build query dynamically like fetchUnblockedTrucks
        let query = `vehicle_unblocked_date is not null and alert_section='VTS' and interlock_name = 'Itdg Admin Blocked' AND bu='${convertBuForApi(selectedBu)}'`;

        // Add date filtering if timeFilter is provided for unblocked tab
        const dateFilterQuery = buildDateFilterQuery(timeFilter.unblocked);
        if (dateFilterQuery) {
          query += ` AND ${dateFilterQuery}`;
        }

        const params: any = {
          q: query,
          fields: JSON.stringify(fields),
          skip: 0,
          limit: 0,
          sort: JSON.stringify({ "created_at": "desc" })
        };

        // Add search text if available
        if (searchTerm.trim()) {
          params.search_text = searchTerm;
        }

        const response = await apiClient.get("/api/alerts", { params });
        const responseData = response.data || {};
        const unblockedList = responseData.data || [];

        if (unblockedList.length === 0) {
          toast.error("No data available to download");
          return;
        }

        const filteredData = filterDataForDownload(unblockedList);
        downloadData(filteredData, `unblocked_trucks_${new Date().toISOString().split('T')[0]}.xlsx`);
      } catch (err) {
        console.error("Error downloading unblocked trucks:", err);
        toast.error("Failed to download data. Please try again.");
      }
    } else if (activeTab === "alerts") {
      try {
        // Fetch all alerts data using /api/alerts with same query as fetchAlertsData
        const fields = [
          "bu",
          "zone",
          "location_name",
          "vehicle_number",
          "unique_id",
          "alert_section",
          "transporter_code",
          "sap_id",
          "vehicle_blocked_start_date",
          "vehicle_blocked_end_date",
          "alert_status",
        ];

        // Build query dynamically like fetchAlertsData
        let query = `alert_section = 'VTS'
            AND vehicle_unblocked_date IS NULL
            AND alert_status = 'Close'
            AND device_id IN ('Instance - 1', 'Instance - 2', 'Instance - 3')`;

        // Add date filtering if timeFilter is provided for alerts tab
        const dateFilterQuery = buildDateFilterQuery(timeFilter.alerts);
        if (dateFilterQuery) {
          query += ` AND ${dateFilterQuery}`;
        }

        const params: any = {
          q: query,
          fields: JSON.stringify(fields),
          skip: 0,
          limit: 0,
          sort: JSON.stringify({ "created_at": "desc" })
        };

        // Add search text if available
        if (searchTerm.trim()) {
          params.search_text = searchTerm;
        }

        const response = await apiClient.get("/api/alerts", { params });
        const responseData = response.data || {};
        const alertsList = responseData.data || [];

        if (alertsList.length === 0) {
          toast.error("No data available to download");
          return;
        }

        const filteredData = filterDataForDownload(alertsList);
        downloadData(filteredData, `alerts_${new Date().toISOString().split('T')[0]}.xlsx`);
      } catch (err) {
        console.error("Error downloading alerts:", err);
        toast.error("Failed to download data. Please try again.");
      }
    }
  };

  // const handleDownload = () => {
  //   // Define column mappings: property -> display name
  //   let columnMapping: { [key: string]: string } = {};

  //   if (activeTab === "blocked" || activeTab === "unblocked") {
  //     // For blocked/unblocked tabs: all columns except truck number, in table order
  //     columnMapping = {
  //       'bu': 'BU',
  //       'zone': 'Zone',
  //       'location_name': 'Location',
  //       'vehicle_number': ' Truck No',
  //       'blocked_by': activeTab === "unblocked" ? 'Unblocked By' : 'Blocked By',
  //       'vehicle_blocked_start_date': 'Blocked date',
  //       'vehicle_blocked_end_date': 'Auto Unblocked date',
  //       'violation_type': 'Remark'
  //     };

  //     // Add Uploaded Document column for unblocked tab
  //     // if (activeTab === "unblocked") {
  //     //   columnMapping['file_uploaded_path'] = 'Uploaded Document';
  //     // }
  //   }

  //   // Helper function to format dates to 10 digits (YYYY-MM-DD)
  //   const formatDateForDownload = (dateStr: string) => {
  //     if (!dateStr) return "-";
  //     try {
  //       const date = new Date(dateStr);
  //       return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format (10 characters)
  //     } catch {
  //       return "-";
  //     }
  //   };

  //   // Filter data to include only specified columns with proper headers
  //   const filterDataForDownload = (data: any[]) => {
  //     return data.map(item => {
  //       const filteredItem: any = {};
  //       Object.entries(columnMapping).forEach(([propName, displayName]) => {
  //         if (propName === 'blocked_by') {
  //           // Special handling for Blocked By column
  //           const isBlocked = activeTab === "blocked";
  //           const actionType = isBlocked ? "Blocked" : "UnBlocked";
  //           filteredItem[displayName] = item.alert_history?.find((history: any) => history.action_type === actionType)?.action_by || "-";
  //         } else if (propName === 'vehicle_blocked_start_date' || propName === 'vehicle_blocked_end_date') {
  //           // Format date columns to 10 digits
  //           filteredItem[displayName] = formatDateForDownload(item[propName]);
  //         } else {
  //           filteredItem[displayName] = item[propName] || "-";
  //         }
  //       });
  //       return filteredItem;
  //     });
  //   };

  //   if (activeTab === "blocked") {
  //     const filteredData = filterDataForDownload(blockedTrucks);
  //     downloadData(filteredData, `blocked_trucks_${new Date().toISOString().split('T')[0]}.xlsx`);
  //   } else if (activeTab === "unblocked") {
  //     const filteredData = filterDataForDownload(unblockedTrucks);
  //     downloadData(filteredData, `unblocked_trucks_${new Date().toISOString().split('T')[0]}.xlsx`);
  //   }
  // };

  // Set BU based on user's BU
  useEffect(() => {
    if (userBu) {
      if (isLpgUser) {
        setSelectedBu('LPG');
      } else if (isSodUser) {
        setSelectedBu('SOD');
      }
    }
  }, [userBu, isLpgUser, isSodUser]);

  // Initial data load and refetch when BU changes (fetch all tabs)
  useEffect(() => {
    console.log("Loading data for BU:", selectedBu);
    setCurrentPage(0);
    setTotalRecords(0);
    fetchBlockedTrucks();
    fetchUnblockedTrucks();
    fetchAlertsData();
  }, [selectedBu]); // Only refetch when BU changes

  // Get current filter value for active tab using useMemo to track changes
  const currentTabFilter = useMemo(() => {
    return JSON.stringify(timeFilter[activeTab]);
  }, [timeFilter, activeTab]);

  // Refetch data when tab changes or when filter changes for the active tab (skip initial mount to avoid 4th duplicate API call)
  useEffect(() => {
    if (isInitialTabFilterMount.current) {
      isInitialTabFilterMount.current = false;
      return;
    }
    setCurrentPage(0);
    setTotalRecords(0);
    if (activeTab === "blocked") {
      fetchBlockedTrucks();
    } else if (activeTab === "unblocked") {
      fetchUnblockedTrucks();
    } else if (activeTab === "alerts") {
      fetchAlertsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentTabFilter]); // Refetch when tab changes or filter for active tab changes

  // Reset pagination when tab changes (no API calls since data is cached)
  useEffect(() => {
    setCurrentPage(0);
    setTotalRecords(0);
  }, [activeTab]);

  // Reset pagination when search term changes (no API calls since search is client-side)
  useEffect(() => {
    setCurrentPage(0);
    setTotalRecords(0);
  }, [searchTerm]);

  const handleBlock = async () => {
    if (selectedDate && truckNumber.trim() && selectedReason && remarks.trim()) {

      const today = new Date();
      const selectedDateObj = new Date(selectedDate);

      today.setHours(0, 0, 0, 0);
      selectedDateObj.setHours(0, 0, 0, 0);

      // Calculate days from today to selected date (inclusive)
      const diffTime = selectedDateObj.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // Ensure at least 1 day
      const daysToSend = diffDays > 0 ? diffDays : 1;

      const payload = {
        bu: convertBuForApi(selectedBu),
        truck_number: truckNumber.trim(),
        blocking_days: daysToSend,
        reason: selectedReason,
        remarks: remarks.trim(),
      };

      try {
        setIsBlocking(true);
        const response = await apiClient.post("/api/alerts/block_vts_truck", payload);
        const { status, message } = response.data || {};
        if (status === true || status === "success") {
          toast.success(message || "Truck blocked successfully");
          setTruckNumber("");
          setSelectedReason("");
          setSelectedDate("");
          setRemark("");
          fetchBlockedTrucks();
        } else {
          toast.error(message || "Failed to block truck");
        }
      } catch (err) {
        console.error("Block error:", err);
        toast.error("Something went wrong while blocking truck");
      } finally {
        setIsBlocking(false);
      }
    } else {
      toast.warning("Please enter truck number, select reason, remark, and select a date");
    }
  };

  const handleUnblock = (id: number) => {
    setUnblockingTruckId(id);
    setUnblockRemark('');
    setUnblockDocument(null);
    setIsUnblockDialogOpen(true);
  };

  const handleUnblockSubmit = async () => {
    if (!unblockingTruckId || !unblockRemark.trim()) {
      toast.warning("Please enter a remark before unblocking");
      return;
    }

    if (!unblockDocument) {
      toast.warning("upload document");
      return;
    }

    try {
      setUnblockingId(unblockingTruckId);

      console.log("=== UNBLOCK PROCESS STARTED ===");
      console.log("Truck ID:", unblockingTruckId);
      console.log("Remark:", unblockRemark.trim());
      console.log("Document:", unblockDocument);

      // Prepare FormData with all required fields
      const formData = new FormData();
      formData.append('unblock_id', String(unblockingTruckId));
      formData.append('remarks', unblockRemark.trim());

      // Add file if provided
      if (unblockDocument) {
        formData.append('upload_file', unblockDocument);
        console.log("✓ Document attached to request");
        console.log("  - File name:", unblockDocument.name);
        console.log("  - File size:", unblockDocument.size);
        console.log("  - File type:", unblockDocument.type);
      }

      console.log("Sending request to attach_vts_blocked_file API...");

      const response = await apiClient.post("/api/alerts/unblock_vts_truck", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log("API Response:", response.data);

      const { status, message } = response.data || {};
      if (status === true || status === "success") {
        console.log("✓ Truck unblocked successfully");

        const successMessage = unblockDocument
          ? "Truck unblocked and document uploaded successfully"
          : message || "Truck unblocked successfully";

        toast.success(successMessage);

        // Refresh data and switch to unblocked tab
        await fetchBlockedTrucks();
        setActiveTab("unblocked");

        // Reset dialog state after toast message
        setIsUnblockDialogOpen(false);
        setUnblockRemark('');
        setUnblockDocument(null);
        setUnblockingTruckId(null);
      } else {
        console.error("✗ Failed to unblock truck:", message);
        toast.error(message || "Failed to unblock truck");
      }
    } catch (err) {
      console.error("✗ Unblock error:", err);
      toast.error("Something went wrong while unblocking");
    } finally {
      setUnblockingId(null);
    }
  };

  const handleUnblockAlertDialog = (uniqueId: string) => {
    setUnblockingAlertUniqueId(uniqueId);
    setUnblockAlertRemark('');
    setUnblockAlertDocument(null);
    setIsUnblockAlertDialogOpen(true);
  };

  const handleUnblockAlert = async (uniqueId: string) => {
    try {
      setUnblockingAlertId(uniqueId);
      const response = await apiClient.post("/api/alerts/unblock_alert_truck", {
        unique_id: uniqueId,
      });

      const { status, message } = response.data || {};
      if (status === true || status === "success") {
        toast.success(message || "Alert unblocked successfully");
        await fetchAlertsData(currentPage * pageSize, (currentPage + 1) * pageSize);
      } else {
        toast.error(message || "Failed to unblock alert");
      }
    } catch (err) {
      console.error("Unblock alert error:", err);
      toast.error("Something went wrong while unblocking alert");
    } finally {
      setUnblockingAlertId(null);
    }
  };

  // const handleUnblockAlertSubmit = async () => {{
  //   console.log("Unblock alert submit");
  // }}
  const handleUnblockAlertSubmit = async () => {
    if (!unblockingAlertUniqueId || !unblockAlertRemark.trim()) {
      toast.warning("Please enter a remark before unblocking");
      return;
    }

    if (!unblockAlertDocument) {
      toast.warning("Please upload a document before unblocking");
      return;
    }

    try {
      setUnblockingAlertId(unblockingAlertUniqueId);

      console.log("=== UNBLOCK ALERT PROCESS STARTED ===");
      console.log("Alert Unique ID:", unblockingAlertUniqueId);
      console.log("Remark:", unblockAlertRemark.trim());
      console.log("Document:", unblockAlertDocument);

      // Prepare FormData with all required fields
      const formData = new FormData();
      formData.append('unique_id', unblockingAlertUniqueId);
      formData.append('remarks_unblocked', unblockAlertRemark.trim());

      // Add file if provided
      if (unblockAlertDocument) {
        formData.append('upload_file', unblockAlertDocument);
        console.log("✓ Document attached to request");
        console.log("  - File name:", unblockAlertDocument.name);
        console.log("  - File size:", unblockAlertDocument.size);
        console.log("  - File type:", unblockAlertDocument.type);
      }

      console.log("Sending request to unblock_alert_truck API...");

      const response = await apiClient.post("/api/alerts/unblock_alert_truck", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log("API Response:", response.data);

      const { status, message } = response.data || {};
      if (status === true || status === "success") {
        console.log("✓ Alert unblocked successfully");

        const successMessage = unblockAlertDocument
          ? "Alert unblocked and document uploaded successfully"
          : message || "Alert unblocked successfully";

        toast.success(successMessage);

        // Refresh alerts data
        await fetchAlertsData(currentPage * pageSize, (currentPage + 1) * pageSize);

        // Reset dialog state
        setIsUnblockAlertDialogOpen(false);
        setUnblockAlertRemark('');
        setUnblockAlertDocument(null);
        setUnblockingAlertUniqueId(null);
      } else {
        console.error("✗ Failed to unblock alert:", message);
        toast.error(message || "Failed to unblock alert");
      }
    } catch (err) {
      console.error("✗ Unblock alert error:", err);
      toast.error("Something went wrong while unblocking alert");
    } finally {
      setUnblockingAlertId(null);
    }
  }

  const handleDocumentDownload = async (truck: any) => {
    const filePath = truck.file_uploaded_path;

    if (!filePath || downloadingFileId) return;

    setDownloadingFileId(truck.id);

    try {
      const response = await apiClient.post(
        "/api/noticesvts/download_notice",
        { id: truck.id, file_path: filePath },
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);

      const link = document.createElement("a");
      link.href = blobUrl;
      const filename = filePath.split("/").pop() || "document";
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading VTS document:", error);
      toast.error("Failed to download document. Please try again.");
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Reset pagination on refresh
    setCurrentPage(0);
    setTotalRecords(0);
    fetchBlockedTrucks();
    fetchUnblockedTrucks();
    fetchAlertsData();
    setRemark("");
    setTruckNumber("");
    setSelectedReason("");
    setSelectedDate("");
    setSearchTerm("");
    // Reset time filters for all tabs
    setTimeFilter({
      blocked: null,
      unblocked: null,
      alerts: null
    });
    // Reset to user's BU or default to SOD
    setSelectedBu(isLpgUser ? 'LPG' : isSodUser ? 'SOD' : 'SOD');
  };

  const isBlockEnabled =
    truckNumber.trim() !== "" &&
    remarks.trim() !== "" &&
    selectedDate !== "";

  // Filter data based on search term
  const filterData = (data: any[]) => {
    if (!searchTerm.trim()) return data;

    const searchLower = searchTerm.toLowerCase();
    return data.filter(item => {
      const searchableFields = [
        item.truck_no || item.truck_number || item.vehicle_number,
        item.zone,
        item.location_name,
        item.transaction_number,
        item.id, // Transaction No column displays item.id
        item.blocked_by,
        item.remarks,
        item.unique_id,
        item.alert_section,
        item.transporter_code,
        item.sap_id,
        item.filepath
      ].filter(Boolean);

      return searchableFields.some(field =>
        field.toString().toLowerCase().includes(searchLower)
      );
    });
  };

  const blockedData = filterData(blockedTrucks);
  const unblockedData = filterData(unblockedTrucks);
  const filteredAlertsData = filterData(alertsData);

  useEffect(() => {
    updateHScrollMetrics();
  }, [
    updateHScrollMetrics,
    activeTab,
    blockedData.length,
    unblockedData.length,
    filteredAlertsData.length,
    searchTerm,
    pageSize,
    currentPage,
    loading,
    alertsLoading,
  ]);

  useLayoutEffect(() => {
    updateHScrollMetrics();
  }, [updateHScrollMetrics, activeTab, blockedData.length, unblockedData.length, filteredAlertsData.length]);

  // Update totalRecords when active tab changes or filtered data changes
  useEffect(() => {
    if (activeTab === "blocked") {
      // If searching, show filtered count; otherwise show server total
      setTotalRecords(searchTerm.trim() ? blockedData.length : blockedTotal);
    } else if (activeTab === "unblocked") {
      // If searching, show filtered count; otherwise show server total
      setTotalRecords(searchTerm.trim() ? unblockedData.length : unblockedTotal);
    } else if (activeTab === "alerts") {
      // If searching, show filtered count; otherwise show server total
      setTotalRecords(searchTerm.trim() ? filteredAlertsData.length : alertsTotal);
    }
  }, [activeTab, blockedData.length, unblockedData.length, filteredAlertsData.length, searchTerm, blockedTotal, unblockedTotal, alertsTotal]);

  return (
    <div className="admin-module-dashboard min-h-screen space-y-2 bg-gray-100 p-2">
      {/* Vertical: admin-module-table-scroll (see index.css). Horizontal: custom bar below — native bars are hidden globally. */}
      <style>{`
        .admin-module-table-h-inner {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .admin-module-table-h-inner::-webkit-scrollbar {
          height: 0 !important;
          display: none !important;
        }
      `}</style>
      <VTSVehicleAI />

      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Admin Module</h1>
          </div>

          {/* <ZonePlantSelections
            key={`zone-plant-${resetTrigger}`}
            bu="SOD"
            zone={locationFilter.zone}
            sapid={locationFilter.plant}
            onZoneChange={(zoneId) => handleLocationChange(null, zoneId)}
            onPlantChange={handlePlantChange}
          /> */}

          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white p-1 px-2 rounded-md flex items-center gap-2 h-7 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 w-full">
          {/* Form Fields in One Line */}
          <div className="flex flex-wrap items-end gap-3 w-full">
            {/* Business Unit */}
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <label className="text-xs font-medium text-gray-700">BU</label>
              <Select value={selectedBu} onValueChange={(value) => setSelectedBu(value)} disabled={hasUserBu}>
                <SelectTrigger className="w-[100px] h-9 border border-gray-300 rounded-lg px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all bg-white">
                  <SelectValue placeholder="Select BU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="SOD">SOD</SelectItem>
                    <SelectItem value="LPG">LPG</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Truck Number */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-gray-500" />
                Truck Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                  placeholder="Enter truck number"
                  className="w-full h-9 border border-gray-300 rounded-lg px-3 pl-9 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all bg-white"
                />
                <Truck className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Select Reason */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-gray-500" />
                Select Reason
              </label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger className="w-full h-9 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all bg-white">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Route Violation">Route Violation</SelectItem>
                    <SelectItem value="Overspeed">Overspeed</SelectItem>
                    <SelectItem value="Night Driving">Night Driving</SelectItem>
                    <SelectItem value="Power Disconnection">Power Disconnection</SelectItem>
                    <SelectItem value="Unauthorised Stoppage">Unauthorised Stoppage</SelectItem>
                    <SelectItem value="Device Tamper">Device Tamper</SelectItem>
                    <SelectItem value="EM Lock Open">EM Lock Open</SelectItem>
                    <SelectItem value="Shortage">Shortage</SelectItem>
                    <SelectItem value="Continuous Driving">Continuous Driving</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Remark */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
                Remark
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Enter remark"
                  className="w-full h-9 border border-gray-300 rounded-lg px-3 pl-9 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all bg-white"
                />
                <MessageSquare className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Block Till Date */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
                Block Till Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setSelectedDate(selected);
                    setIsCalendarOpen(false);
                  }}
                  className="w-full h-9 border border-gray-300 rounded-lg px-3 pl-9 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all bg-white"
                />
                <CalendarDays className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-end flex-shrink-0">
              <button
                type="button"
                onClick={handleBlock}
                disabled={!isBlockEnabled || isBlocking}
                className={`flex items-center gap-2 px-5 py-2 h-9 rounded-lg text-sm font-medium text-white shadow-md transition-all ${isBlockEnabled && !isBlocking
                  ? "bg-gradient-to-r from-red-500 to-red-500 hover:from-red-500 hover:to-red-600"
                  : "bg-red-200 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {isBlocking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Blocking...
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    Block Truck
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="min-w-0 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {(["blocked", "unblocked", "alerts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all duration-200 relative ${activeTab === tab
                ? tab === "blocked"
                  ? "bg-red-50 text-red-700 border-b-2 border-red-600"
                  : tab === "unblocked"
                    ? "bg-green-50 text-green-700 border-b-2 border-green-600"
                    : "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
            >
              {tab === "blocked" ? (
                <>
                  <Ban className="h-4 w-4" />
                  Blocked
                </>
              ) : tab === "unblocked" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Unblocked
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  Accept & Block alerts
                </>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === tab
                ? tab === "blocked"
                  ? "bg-red-100 text-red-700"
                  : tab === "unblocked"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                : "bg-gray-200 text-gray-600"
                }`}>
                {tab === "blocked" ? blockedTotal : tab === "unblocked" ? unblockedTotal : alertsTotal}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${activeTab === "alerts" ? "alerts" : "trucks"}...`}
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
                >
                  <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <EnhancedTimeFilter
              key={`time-filter-${refreshKey}-${activeTab}`}
              selectedFilter={timeFilter[activeTab]}
              onFilterChange={handleTimeFilterChange}
            />
            {(activeTab === "blocked" || activeTab === "unblocked" || activeTab === "alerts") && (
              <button
                onClick={handleDownload}
                // className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
              >

                <Download size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {(activeTab === "alerts" ? alertsLoading : loading) ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-gray-600 font-medium">Loading {activeTab === "alerts" ? "alerts" : "trucks"}...</p>
          </div>
        ) : (activeTab === "alerts" ? alertsError : error) ? (
          <div className="flex items-center justify-center p-12">
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-gray-700 font-medium">{activeTab === "alerts" ? alertsError : "No data available"}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col overflow-hidden">
            {/* Outer: vertical scroll only. Inner: horizontal (native bar hidden — use bottom mirror for always-visible horizontal track). */}
            <div
              ref={tableScrollOuterRef}
              className="admin-module-table-scroll min-h-0 min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden"
              style={{ maxHeight: "calc(100vh - 360px)" }}
            >
              <div
                ref={tableScrollInnerRef}
                onScroll={updateHScrollMetrics}
                className="admin-module-table-h-inner min-w-0 w-full overflow-x-auto"
              >
                <table className="min-w-max divide-y divide-gray-200">
                <thead className={`sticky top-0 z-30 ${activeTab === "blocked" ? "bg-red-50" :
                  activeTab === "unblocked" ? "bg-green-50" :
                    "bg-blue-50"
                  }`}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">BU</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      {activeTab === "alerts" ? "Vehicle No" : "Truck No"}
                    </th>
                    {activeTab === "alerts" ? (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Unique ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Alert Section</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Transporter Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">SAP ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Blocked date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Auto Unblocked date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                        {isAdmin && (
                          <th className={`px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider sticky right-0 z-30 ${activeTab === "alerts" ? "bg-blue-50" : ""
                            }`}>Action</th>
                        )}
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Transaction No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">{activeTab === "unblocked" ? "Unblocked By" : "Blocked By"}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Blocked date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Auto Unblocked date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Days</th>
                        {/* <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th> */}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Violation Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Remark</th>
                        {activeTab === "blocked" && (
                          <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky right-16 z-40 bg-red-50" style={{ minWidth: '170px' }}>Status</th>
                        )}
                        {activeTab === "unblocked" && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"> Uploaded Document </th>
                        )}
                        {isAdmin && activeTab === "blocked" && (
                          <th className={`px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider sticky right-0 z-50 ${activeTab === "blocked" ? "bg-red-50" : ""
                            }`}>Action</th>
                        )}
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeTab === "alerts" ? (
                    filteredAlertsData.length > 0 ? (
                      filteredAlertsData.map((alert, idx) => {
                        const formatDate = (dateStr: string) =>
                          dateStr ? dateStr.split("T")[0] : "-";

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-blue-50/50 transition-colors"
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              <span className={`px-2 py-1 rounded-md text-xs font-medium ${convertBuForDisplay(alert.bu) === "SOD" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                }`}>
                                {convertBuForDisplay(alert.bu) || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{alert.zone || "-"}</td>
                            <td className="px-4 py-3 text-xs text-gray-700">{alert.location_name || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-900">
                              {alert.vehicle_number || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{alert.unique_id || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{alert.alert_section || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{alert.transporter_code || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{alert.sap_id || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{formatDate(alert.vehicle_blocked_start_date)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{formatDate(alert.vehicle_blocked_end_date)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${alert.alert_status === "Open"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-700"
                                }`}>
                                {alert.alert_status || "-"}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 whitespace-nowrap text-center sticky right-0 z-10 bg-white">
                                <button
                                  onClick={() => handleUnblockAlertDialog(alert.unique_id)}
                                  disabled={unblockingAlertId === alert.unique_id}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${unblockingAlertId === alert.unique_id
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                    }`}
                                >
                                  {unblockingAlertId === alert.unique_id ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Unblocking...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3 w-3" />
                                      Unblock
                                    </>
                                  )}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 12 : 11} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="h-12 w-12 text-gray-300" />
                            <p className="text-gray-500 font-medium">No alerts data found</p>
                          </div>
                        </td>
                      </tr>
                    )
                  ) : (activeTab === "blocked" ? blockedData : unblockedData).length > 0 ? (
                    (activeTab === "blocked" ? blockedData : unblockedData).map((truck, idx) => {
                      const formatDate = (dateStr: string) =>
                        dateStr ? dateStr.split("T")[0] : "-";
                      const isBlocked = activeTab === "blocked";

                      return (
                        <tr
                          key={idx}
                          className={`${isBlocked ? "hover:bg-red-50/50" : "hover:bg-green-50/50"} transition-colors`}
                        >
                          <td className="px-2 py-3 whitespace-nowrap text-xs">
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${convertBuForDisplay(truck.bu) === "SOD" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                              }`}>
                              {convertBuForDisplay(truck.bu) || "-"}
                            </span>
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-700">{truck.zone || "-"}</td>
                          <td className="px-2 py-3 text-xs text-gray-700">{truck.location_name || "-"}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs font-medium text-gray-900">
                            {truck.vehicle_number || "-"}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-700">{truck.id || "-"}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-700">
                            {isBlocked
                              ? truck.alert_history?.find(history => history.action_type === "BlockInitiated")?.action_by || "-"
                              : truck.alert_history?.find(history => history.action_type === "UnBlockInitiated")?.action_by || "-"
                            }
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-700">{formatDate(truck.vehicle_blocked_start_date)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-700">{formatDate(truck.vehicle_blocked_end_date)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                              {(() => {
                                if (!truck.vehicle_blocked_start_date || !truck.vehicle_blocked_end_date) return "-";
                                const startDate = new Date(truck.vehicle_blocked_start_date);
                                const endDate = new Date(truck.vehicle_blocked_end_date);
                                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                return diffDays;
                              })()}
                            </span>
                          </td>
                          {/* <td className="px-2 py-3 whitespace-nowrap text-xs">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${
                            isBlocked
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {truck.alert_status || "-"}
                          </span>
                        </td> */}
                          <td className="px-2 py-3 text-xs text-gray-600 max-w-xs truncate" title={truck.violation_type || "-"}>
                            {truck.violation_type || "-"}
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-700 max-w-xs truncate" title={truck.alert_message || "-"}>
                            {truck.alert_message || "-"}
                          </td>
                          {activeTab === "blocked" && (
                            <td className="px-2 py-3 whitespace-nowrap text-xs sticky right-16 z-10 bg-white" style={{ minWidth: '140px' }}>
                              <span className={`px-2 py-1 rounded-md text-xs font-medium ${truck.block_status === "Blocked"
                                ? "bg-red-100 text-red-700"
                                : truck.block_status === "WaitingForBlockAck"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : truck.block_status === "WaitingForUnBlockAck"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}>
                                {truck.block_status || "Unknown"}
                              </span>
                            </td>
                          )}
                          {activeTab === "unblocked" && (
                            <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate">
                              {truck.file_uploaded_path ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleDocumentDownload(truck)}
                                        disabled={downloadingFileId === truck.id}
                                        className={`text-blue-600 hover:text-blue-800 underline ${downloadingFileId === truck.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                          }`}
                                      >
                                        {downloadingFileId === truck.id ? 'Downloading...' : (truck.file_uploaded_path.split('/').pop() || 'Download')}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-center">
                                        <p className="font-xs mb-1">Download Document</p>

                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                "-"
                              )}
                            </td>
                          )}
                          {isAdmin && activeTab === "blocked" && (
                            <td className={`px-2 py-3 whitespace-nowrap text-center sticky right-0 z-10 ${isBlocked ? "bg-white" : "bg-white"
                              }`}>
                              {truck.block_status === "Blocked" ? (
                                <button
                                  onClick={() => handleUnblock(truck.id)}
                                  disabled={unblockingId === truck.id}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${unblockingId === truck.id
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                    }`}
                                >
                                  {unblockingId === truck.id ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Unblocking...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3 w-3" />
                                      Unblock
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs font-medium">No Action</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={isAdmin && activeTab === "blocked" ? 13 : activeTab === "unblocked" ? 12 : 11}
                        className="px-2 py-12 text-center"
                      >
                        <div className="flex flex-col items-center gap-2">
                          {activeTab === "blocked" ? (
                            <Ban className="h-12 w-12 text-gray-300" />
                          ) : (
                            <CheckCircle2 className="h-12 w-12 text-gray-300" />
                          )}
                          <p className="text-gray-500 font-medium">No {activeTab} trucks found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {(() => {
              const { scrollLeft, scrollWidth, clientWidth, trackWidth } = hScrollMetrics;
              const tw = Math.max(trackWidth || 1, 1);
              const sw = Math.max(scrollWidth, 1);
              const maxScroll = Math.max(0, scrollWidth - clientWidth);
              const thumbW = maxScroll <= 0 ? tw : Math.max(40, (clientWidth / sw) * tw);
              const thumbLeft =
                maxScroll <= 0 ? 0 : (scrollLeft / maxScroll) * Math.max(1, tw - thumbW);
              return (
                <div
                  ref={hCustomTrackRef}
                  className="relative h-3.5 w-full shrink-0 cursor-pointer select-none rounded-sm border border-gray-300 bg-gray-200"
                  onClick={handleHTrackClick}
                  role="scrollbar"
                  aria-label="Scroll table horizontally"
                  aria-orientation="horizontal"
                  aria-valuemin={0}
                  aria-valuemax={maxScroll}
                  aria-valuenow={scrollLeft}
                >
                  <div
                    data-thumb="true"
                    className="pointer-events-auto absolute top-0.5 bottom-0.5 rounded bg-gray-500 shadow hover:bg-gray-600"
                    style={{
                      width: `${thumbW}px`,
                      left: `${thumbLeft}px`,
                      minWidth: 40,
                    }}
                    onMouseDown={handleHThumbMouseDown}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              );
            })()}

            {/* Pagination Controls */}
            <div className="!mt-0 shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 border-t border-gray-300 rounded-b-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="px-2 py-1 text-sm border-2 border-gray-300 rounded-lg bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors font-medium"
                  >
                    {[10, 20, 50, 100].map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-medium text-gray-700">entries</span>
                </div>
                <div className="text-sm font-medium text-gray-700 bg-white px-2 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                  Showing <span className="font-bold text-gray-900">{totalRecords > 0 ? currentPage * pageSize + 1 : 0}</span> to <span className="font-bold text-gray-900">{Math.min((currentPage + 1) * pageSize, totalRecords)}</span> of <span className="font-bold text-gray-900">{totalRecords}</span> entries
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(totalRecords / pageSize)) }, (_, i) => {
                    let pageNum;
                    const totalPages = Math.ceil(totalRecords / pageSize);
                    if (totalPages <= 5) {
                      pageNum = i;
                    } else if (currentPage <= 2) {
                      pageNum = i;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 5 + i;
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
                        {pageNum + 1}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalRecords / pageSize) - 1 || totalRecords === 0}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unblock Confirmation Dialog */}
      <Dialog open={isUnblockDialogOpen} onOpenChange={setIsUnblockDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Confirm Vehicle Unblock
            </DialogTitle>
            <DialogDescription>
              Please provide a remark and optionally upload a document before unblocking this vehicle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Remark Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                Remark <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={unblockRemark}
                onChange={(e) => setUnblockRemark(e.target.value)}
                placeholder="Enter reason for unblocking the vehicle..."
                className="min-h-[80px] resize-none"
                required
              />
            </div>

            {/* Document Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-gray-500" />
                Upload Document <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setUnblockDocument(e.target.files?.[0] || null)}
                  className="hidden"
                  id="document-upload"
                />
                <label
                  htmlFor="document-upload"
                  className="flex items-center justify-center w-full h-10 px-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">
                    {unblockDocument ? unblockDocument.name : "Choose file..."}
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsUnblockDialogOpen(false);
                setUnblockRemark('');
                setUnblockDocument(null);
                setUnblockingTruckId(null);
              }}
              disabled={unblockingId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnblockSubmit}
              disabled={unblockingId !== null || !unblockRemark.trim() || !unblockDocument}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {unblockingId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Unblocking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Unblock Vehicle
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Alert Confirmation Dialog */}
      <Dialog open={isUnblockAlertDialogOpen} onOpenChange={setIsUnblockAlertDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Confirm Alert Unblock
            </DialogTitle>
            <DialogDescription>
              Please provide a remark and optionally upload a document before unblocking this alert.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Remark Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                Remark <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={unblockAlertRemark}
                onChange={(e) => setUnblockAlertRemark(e.target.value)}
                placeholder="Enter reason for unblocking the alert..."
                className="min-h-[80px] resize-none"
                required
              />
            </div>

            {/* Document Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-gray-500" />
                Upload Document <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setUnblockAlertDocument(e.target.files?.[0] || null)}
                  className="hidden"
                  id="alert-document-upload"
                />
                <label
                  htmlFor="alert-document-upload"
                  className="flex items-center justify-center w-full h-10 px-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">
                    {unblockAlertDocument ? unblockAlertDocument.name : "Choose file..."}
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsUnblockAlertDialogOpen(false);
                setUnblockAlertRemark('');
                setUnblockAlertDocument(null);
                setUnblockingAlertUniqueId(null);
              }}
              disabled={unblockingAlertId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnblockAlertSubmit}
              disabled={unblockingAlertId !== null || !unblockAlertRemark.trim() || !unblockAlertDocument}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {unblockingAlertId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Unblocking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Unblock Alert
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default AdminModuleDash;