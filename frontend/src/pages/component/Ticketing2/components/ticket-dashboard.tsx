import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTickets } from "../hooks/useTickets";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, Search, X } from "lucide-react";
import { useLocations } from "../hooks/useLocations";
import { useDebounce } from "../hooks/useDebounce";
import { Ticket } from "../types/ticket";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { Textarea } from "@/@/components/ui/textarea";
import { Label } from "@/@/components/ui/label";
import { apiClient } from "@/services/apiClient";
import { encryptPayload } from "@/configs/encryptFernet";
import { TicketStats } from "./ticket-stats";
import { TicketFilters } from "./ticket-filters";
import { KanbanBoard } from "./kanban-board";
import { TicketCard } from "./ticket-card";
import { CreateTicketDialog } from "./CreateTicketDialog";
import { useNavigate } from "react-router-dom";
import useAuthStore from "@/store/authStore";

/** Roles that can drag tickets from any column (e.g. to/from Resolved, Cancelled, RE OPEN). */
const FULL_DRAG_ROLES = ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"];

interface TicketDashboardProps {
  useOverlayMode?: boolean;
  onCreateTicketClick?: () => void;
}

export function TicketDashboard({ useOverlayMode = false, onCreateTicketClick }: TicketDashboardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canDragFromAnyColumn = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) =>
          FULL_DRAG_ROLES.includes(String(r).trim())
        )
      ),
    [user?.novex_role]
  );
  const canDeleteTickets = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) =>
          FULL_DRAG_ROLES.includes(String(r).trim())
        )
      ),
    [user?.novex_role]
  );
  const {
    tickets,
    loading,
    error,
    refetch,
    updateTicketState,
    deleteTicket,
    totalTicketCount,
    buCounts,
  } = useTickets();

  const {
    zones,
    plants,
    loading: locationsLoading,
    refetchLocations,
  } = useLocations();

  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
  const [buFilter, setBuFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [currentView, setCurrentView] = useState<"board" | "list" | "create">("board");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergingInProgress, setMergingInProgress] = useState(false);
  const [mergeForm, setMergeForm] = useState({
    summary: "",
    description: "",
    assignee: "",
    severity: "Medium",
  });

  // Overdue filter state for TO DO, IN PROGRESS, ON HOLD, RE OPEN, and ON COMPLETED columns
  const [showOverdueOnly, setShowOverdueOnly] = useState<{
    "TO DO": boolean;
    "IN PROGRESS": boolean;
    "ON HOLD": boolean;
    "RE OPEN": boolean;
    "ON COMPLETED": boolean;
  }>({
    "TO DO": false,
    "IN PROGRESS": false,
    "ON HOLD": false,
    "RE OPEN": false,
    "ON COMPLETED": false,
  });

  // Create ticket dialog state
  const [showCreateTicketDialog, setShowCreateTicketDialog] = useState(false);

  // Edit/View ticket dialog states
  const [showEditTicketDialog, setShowEditTicketDialog] = useState(false);
  const [showViewTicketDialog, setShowViewTicketDialog] = useState(false);
  const [selectedTicketForEdit, setSelectedTicketForEdit] = useState<Ticket | null>(null);
  const [selectedTicketForView, setSelectedTicketForView] = useState<Ticket | null>(null);
  // When creating a subtask from main ticket in modal, show create form in same modal with this parent id
  const [parentTicketIdForCreate, setParentTicketIdForCreate] = useState<string | null>(null);

  const isInitialMountRef = useRef(true);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const filteredTickets = useMemo(() => {
    let visibleTickets = tickets.filter(
      (ticket) => ticket.merge_status !== "Merged"
    );

    // When status filter is OnCompleted, filter by ticket_state (API may not support ticket_status=OnCompleted)
    if (statusFilter === "OnCompleted") {
      visibleTickets = visibleTickets.filter(
        (t) => t.ticket_state === "OnCompleted"
      );
    }

    // Date filter (by created_at date)
    if (dateFilter) {
      const selectedDay = dayjs(dateFilter);
      visibleTickets = visibleTickets.filter((t) => {
        const dateSource = t.created_at || t.start_date;
        if (!dateSource) return false;
        return dayjs(dateSource).isSame(selectedDay, "day");
      });
    }

    if (!debouncedSearchTerm) return visibleTickets;

    const searchLower = debouncedSearchTerm.toLowerCase().trim();

    return visibleTickets.filter(
      (ticket) =>
        ticket.ticket_id?.toLowerCase().includes(searchLower) ||
        (Array.isArray(ticket.sap_id)
          ? ticket.sap_id.some((id: string) =>
              id?.toLowerCase().includes(searchLower)
            )
          : (ticket.sap_id as string)?.toLowerCase().includes(searchLower)) ||
        ticket.summary?.toLowerCase().includes(searchLower) ||
        ticket.description?.toLowerCase().includes(searchLower) ||
        ticket.assignee?.toLowerCase().includes(searchLower)
    );
  }, [tickets, debouncedSearchTerm, statusFilter, dateFilter]);

  const ticketApiFilters = useMemo(
    () => ({
      ticket_severity: severityFilter !== "all" ? severityFilter : undefined,
      // OnCompleted is filtered client-side by ticket_state; API may not have ticket_status=OnCompleted
      ticket_status:
        statusFilter !== "all" && statusFilter !== "OnCompleted"
          ? statusFilter
          : undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      subcategory: subcategoryFilter !== "all" ? subcategoryFilter : undefined,
      zone: zoneFilter !== "all" ? zoneFilter : undefined,
      sap_id: plantFilter !== "all" ? plantFilter : undefined,
      bu: buFilter !== "all" ? buFilter : undefined,
      created_date: dateFilter || undefined,
    }),
    [
      severityFilter,
      statusFilter,
      categoryFilter,
      subcategoryFilter,
      zoneFilter,
      plantFilter,
      buFilter,
      dateFilter,
    ]
  );

  // Stats for dashboard cards (Business Units, Severity, Ticket Status)
  const dashboardStats = useMemo(() => {
    const totalBu = buCounts.RO + buCounts.TAS + buCounts.LPG;
    const criticalCount = filteredTickets.filter((t) => t.ticket_severity === "Critical").length;
    const highCount = filteredTickets.filter((t) => t.ticket_severity === "High").length;
    const mediumCount = filteredTickets.filter((t) => t.ticket_severity === "Medium").length;
    const lowCount = filteredTickets.filter((t) => t.ticket_severity === "Low").length;
    const totalSeverity = criticalCount + highCount + mediumCount + lowCount;
    const highSeverityPct = totalSeverity > 0
      ? (((criticalCount + highCount) / totalSeverity) * 100).toFixed(1)
      : "0.0";
    // Count open tickets: ToDo, InProgress, OnHold, ReOpen, and ON COMPLETED (show count in OPEN only)
    const openCount = filteredTickets.filter(
      (t) => t.ticket_state === "ToDo" ||
             t.ticket_state === "InProgress" ||
             t.ticket_state === "OnHold" ||
             t.ticket_state === "ReOpen" ||
             t.ticket_state === "OnCompleted"
    ).length;
    // Count closed tickets: Resolved and Cancelled only (ON COMPLETED counted in OPEN)
    const closedCount = filteredTickets.filter(
      (t) => t.ticket_status === "Closed" ||
             t.ticket_state === "Resolved" ||
             t.ticket_state === "Cancelled"
    ).length;
    const pendingCount = filteredTickets.filter((t) => t.ticket_status === "Pending").length;
    return {
      bu: {
        RO: buCounts.RO,
        TAS: buCounts.TAS,
        LPG: buCounts.LPG,
        total: totalBu,
        roPct: totalBu > 0 ? ((buCounts.RO / totalBu) * 100).toFixed(1) : "0.0",
        tasPct: totalBu > 0 ? ((buCounts.TAS / totalBu) * 100).toFixed(1) : "0.0",
        lpgPct: totalBu > 0 ? ((buCounts.LPG / totalBu) * 100).toFixed(1) : "0.0",
      },
      severity: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        total: totalSeverity,
        highSeverityPct,
        criticalPct: totalSeverity > 0 ? ((criticalCount / totalSeverity) * 100).toFixed(1) : "0.0",
        highPct: totalSeverity > 0 ? ((highCount / totalSeverity) * 100).toFixed(1) : "0.0",
        mediumPct: totalSeverity > 0 ? ((mediumCount / totalSeverity) * 100).toFixed(1) : "0.0",
        lowPct: totalSeverity > 0 ? ((lowCount / totalSeverity) * 100).toFixed(1) : "0.0",
      },
      status: { open: openCount, closed: closedCount, pending: pendingCount },
    };
  }, [buCounts, filteredTickets]);

  const handleMergeModeToggle = useCallback(() => {
    setMergeMode(!mergeMode);
    setSelectedTickets([]);
  }, [mergeMode]);

  const handleTicketSelection = useCallback(
    (ticketId: string) => {
      if (!mergeMode) return;
      setSelectedTickets((prev) => {
        if (prev.includes(ticketId)) {
          return prev.filter((id) => id !== ticketId);
        } else {
          return [...prev, ticketId];
        }
      });
    },

    [mergeMode]
  );

  const handleMergeTickets = useCallback(() => {
    if (selectedTickets.length < 2) {
      toast.error("Please select at least 2 tickets to merge");
      return;
    }
    setMergeForm({
      summary: "",
      description: "",
      assignee: "",
      severity: "Medium",
    });
    setMergeDialogOpen(true);
  }, [selectedTickets]);

  const confirmMergeTickets = useCallback(async () => {
    if (mergingInProgress) return;
    try {
      setMergingInProgress(true);
      const selectedTicketData = tickets.filter((t) =>
        selectedTickets.includes(t.id.toString())
      );
      if (selectedTicketData.length < 2) {
        toast.error("Please select at least 2 tickets to merge");
        return;
      }

      const primaryTicket = selectedTicketData[0];
      const ticketsToMerge = selectedTicketData.slice(1);
      const mergeComment = `${mergeForm.description}`;
      const mergePayload = {
        ticket_id: primaryTicket.id.toString(),
        merge_ticket_id: ticketsToMerge.map((t) => t.ticket_id),
        comment: mergeComment,
      };

      console.log("Sending merge request:", mergePayload);
      const response = await apiClient.post(
        "/api/ticketing/merge_ticket",
        mergePayload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Merge API response:", response.data);

      if (response.data.success || response.status === 200) {
        toast.success(
          `Successfully merged ${selectedTickets.length} tickets. Primary ticket: ${primaryTicket.ticket_id}`
        );
        setMergeDialogOpen(false);
        setMergeMode(false);
        setSelectedTickets([]);
        setMergeForm({
          summary: "",
          description: "",
          assignee: "",
          severity: "Medium",
        });

        await refetch(ticketApiFilters);
      } else {
        throw new Error(response.data?.message || "Failed to merge tickets");
      }
    } catch (error: any) {
      console.error("Failed to merge tickets:", error);
      let errorMessage = "Failed to merge tickets";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setMergingInProgress(false);
    }
  }, [
    selectedTickets,
    tickets,
    mergeForm,
    refetch,
    ticketApiFilters,
    mergingInProgress,
  ]);

  const downloadExcelTickets = useCallback(async () => {
    try {
      // Build server-side filter query (same style as useTickets)
      const conditions: string[] = [];
      if (ticketApiFilters.bu)
        conditions.push(`bu='${ticketApiFilters.bu}'`);
      if (ticketApiFilters.ticket_severity)
        conditions.push(`ticket_severity='${ticketApiFilters.ticket_severity}'`);
      if (ticketApiFilters.ticket_status)
        conditions.push(`ticket_status='${ticketApiFilters.ticket_status}'`);
      if (ticketApiFilters.category)
        conditions.push(
          `'${String(ticketApiFilters.category).replace(/'/g, "''")}' = ANY(category)`
        );
      if (ticketApiFilters.subcategory)
        conditions.push(
          `'${String(ticketApiFilters.subcategory).replace(/'/g, "''")}' = ANY(sub_category)`
        );
      if (ticketApiFilters.zone)
        conditions.push(
          `'${String(ticketApiFilters.zone).replace(/'/g, "''")}' = ANY(zone)`
        );
      if (ticketApiFilters.sap_id)
        conditions.push(
          `'${String(ticketApiFilters.sap_id).replace(/'/g, "''")}' = ANY(sap_id)`
        );
      if (ticketApiFilters.created_date)
        conditions.push(
          `created_at::date='${String(ticketApiFilters.created_date).replace(
            /'/g,
            "''"
          )}'`
        );

      const params: any = { skip: 0, limit: 10000 };
      if (conditions.length > 0) {
        params.q = conditions.join(" AND ");
      }

      const response = await apiClient.get("/api/ticketing", {
        headers: { "Content-Type": "application/json" },
        params,
      });

      const ticketData: Ticket[] = response.data.data || [];

      if (!ticketData.length) {
        toast.dismiss();
        toast.error("No ticket data available to download");
        return;
      }

      // Transform ticket data for Excel export
      const excelData = ticketData.map((ticket: Ticket) => ({
        'Ticket ID': ticket.ticket_id || '',
        'BU': ticket.bu || '',
        'Zone': ticket.zone || '',
        'SAP ID': Array.isArray(ticket.sap_id) ? ticket.sap_id.join(', ') : ticket.sap_id || '',
        'Location Name': Array.isArray(ticket.location_name) ? ticket.location_name.join(', ') : ticket.location_name || '',      
        'Summary': ticket.summary || '',
        'Description': ticket.description || '',
        'Ticket State': ticket.ticket_state || '',
        'Ticket Severity': ticket.ticket_severity || '',
        'Ticket Status': ticket.ticket_status || '',
        // 'Assignee': ticket.assignee || '',
        'Assignee Name': Array.isArray(ticket.assignee_name) ? ticket.assignee_name.filter(Boolean).join(', ') : ticket.assignee_name || '',
        'Assignee Email': Array.isArray(ticket.assignee_mail) ? ticket.assignee_mail.filter(Boolean).join(', ') : ticket.assignee_mail || '',
        'Category': Array.isArray(ticket.category) ? ticket.category.filter(Boolean).join(', ') : ticket.category || '',
        'Subcategory': Array.isArray(ticket.sub_category) ? ticket.sub_category.filter(Boolean).join(', ') : ticket.sub_category || '',
        // 'Region': ticket.region || '',
        'Alert Section': ticket.alert_section || '',
        'SOP ID': ticket.sop_id || '',
        'Start Date': ticket.start_date ? dayjs(ticket.start_date).format('MMM D, YYYY, hh:mm A') : '',
        'End Date': ticket.ticket_end_date ? dayjs(ticket.ticket_end_date).format('MMM D, YYYY, hh:mm A') : '',
        'Created At': ticket.created_at ? dayjs(ticket.created_at).format('MMM D, YYYY, hh:mm A') : '',
        'Updated At': ticket.updated_at ? dayjs(ticket.updated_at).format('MMM D, YYYY, hh:mm A') : '',
        'Comment': ticket.comment || '',
        'Linked Alert ID': Array.isArray(ticket.linked_alert_id)
          ? ticket.linked_alert_id.join(', ')
          : ticket.linked_alert_id || '',
        // 'File Attachment': ticket.file_attachment || '',
        // 'File Attachment Name': ticket.file_attachment_name || '',
        'Parent ID': ticket.parent_id || '',
        'Merge Status': ticket.merge_status || '',
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths based on content
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(
          key.length,
          ...excelData.map(row => String(row[key] || '').length)
        )
      }));
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

      // Generate filename with timestamp
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `Tickets_${timestamp}.xlsx`;

      // Download the file
      XLSX.writeFile(workbook, filename);

      toast.dismiss();
      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading tickets Excel:', error);
      toast.dismiss();
      toast.error('Failed to download tickets Excel file');
    }
  }, [ticketApiFilters]);

  // const handleOpenViewTicketPage = useCallback(
  //   (ticket: Ticket) => {
  //     if (!ticket.ticket_id) {
  //       toast.error("Invalid ticket ID");
  //       return;
  //     }
  //     navigate(`/ticket2/view/${ticket.ticket_id}`);
  //   },
  //   [navigate]
  // );
  
const handleOpenViewTicketPage = useCallback(
  async (ticket: Ticket) => {
    try {
      if (!ticket.id || !ticket.ticket_id) {
        toast.error("Invalid ticket ID");
        return;
      }

      if (useOverlayMode) {
        const encryptedTicketId = encryptPayload(ticket.id);
        const response = await apiClient.get(
          `/api/ticketing/${encryptedTicketId}`
        );
        setSelectedTicketForView(response.data);
        setShowViewTicketDialog(true);
      } else {
        const encryptedTicketId = encryptPayload(ticket.id);
        const response = await apiClient.get(
          `/api/ticketing/${encryptedTicketId}`
        );

        // pass full ticket data to the view page
        navigate(`/ticket2/view/${ticket.ticket_id}`, {
          state: { ticket: response.data },
        });
      }
    } catch (error: any) {
      console.error("Failed to fetch ticket:", error);
      toast.error(
        error?.response?.data?.message || "Failed to load ticket details"
      );
    }
  },
  [navigate, useOverlayMode]
);

  const handleViewMergedTicketDetails = useCallback(
    async (ticketId: string) => {
      // Merged ticket IDs should open the EDIT page (not the view page)
      try {
        // Try to fetch details to pass via navigation state (optional)
        const res = await apiClient.get(`/api/ticketing/${ticketId}`);
        navigate(`/settings/edit-ticketing2/${ticketId}`, {
          state: { ticket: res.data },
        });
      } catch {
        // Fall back to navigation without state; edit page will load it
        navigate(`/settings/edit-ticketing2/${ticketId}`);
      }
    },
    [navigate]
  );

  const handleOpenEditTicketPage = useCallback(
    async (ticket: Ticket) => {
      try {
        console.log("Opening edit ticket page for:", ticket);
        console.log("Fetching ticket details for ID:", ticket.id);
        console.log("Fetching ticket details for ticket_id:", ticket.ticket_id);
        const encryptedTicketId = encryptPayload(ticket.id);
        console.log("encryptedTicketId", encryptedTicketId);
        const response = await apiClient.get(
          `/api/ticketing/${encryptedTicketId}`
        );
        console.log("Fetched ticket data:", response.data);

        if (useOverlayMode) {
          setSelectedTicketForEdit(response.data);
          setCurrentView("create");
        } else {
          navigate(`/settings/edit-ticketing2/${ticket.ticket_id}`, {
            state: { ticket: response.data },
          });
        }
      } catch (error) {
        console.error("Failed to fetch ticket:", error);
        console.error("Error details:", error.response?.data);
        toast.error(
          error.response?.data?.message || "Failed to load ticket details"
        );
      }
    },
    [navigate, useOverlayMode]
  );

  const handleDeleteTicket = useCallback((ticketId: string) => {
    setTicketToDelete(ticketId);

    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteTicket = useCallback(async () => {
    if (!ticketToDelete) return;
    try {
      const result = await deleteTicket(ticketToDelete);
      if (result.success) {
        toast.success("Ticket deleted successfully");
      } else {
        toast.error(result.error || "Failed to delete ticket");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setDeleteDialogOpen(false);
      setTicketToDelete(null);
    }
  }, [ticketToDelete, deleteTicket]);

  const handleOpenCreateTicketPage = useCallback(() => {
    if (useOverlayMode) {
      setCurrentView("create");
    } else if (onCreateTicketClick) {
      onCreateTicketClick();
    } else {
      navigate("/settings/add-edit-ticketing2");
    }
  }, [useOverlayMode, onCreateTicketClick, navigate]);

  useEffect(() => {
    // Skip the initial mount since useTickets already fetches on mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    refetch(ticketApiFilters);
  }, [ticketApiFilters, refetch]);

  useEffect(() => {
    const dashboardBu = buFilter !== "all" ? buFilter : undefined;
    const dashboardZoneArray = zoneFilter !== "all" ? [zoneFilter] : [];
    refetchLocations(dashboardBu, dashboardZoneArray);
  }, [buFilter, zoneFilter, refetchLocations]);

  const handleZoneChange = useCallback((newZoneId: string) => {
    setZoneFilter(newZoneId);
    setPlantFilter("all");
  }, []);

  const handleRefresh = useCallback(() => {
    setSearchTerm("");
    setSeverityFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setZoneFilter("all");
    setPlantFilter("all");
    setBuFilter("all");
    setDateFilter("");
    setMergeMode(false);
    setSelectedTickets([]);
    refetch({}); 
  }, [refetch]);

  const handleTicketMove = useCallback(
    (ticketNumericId: number, _fromState: string, toStateKey: string) => {
      const stateMapping: Record<string, Ticket["ticket_state"]> = {
        "TO DO": "ToDo",
        "IN PROGRESS": "InProgress",
        CANCELLED: "Cancelled",
        RESOLVED: "Resolved",
        "ON HOLD": "OnHold",
        "RE OPEN": "ReOpen",
        "ON COMPLETED": "OnCompleted",
      };

      const newTicketStateApiValue = stateMapping[toStateKey];
      const openColumnKeys = ["TO DO", "IN PROGRESS", "ON HOLD", "RE OPEN"];
      const newTicketStatus: Ticket["ticket_status"] = openColumnKeys.includes(toStateKey) ? "Open" : "Closed";
      const movedTicket = tickets.find((t) => t.id === ticketNumericId);
      if (newTicketStateApiValue && movedTicket) {
        const linkedAlertIdValue = Array.isArray(movedTicket.linked_alert_id)
          ? movedTicket.linked_alert_id
          : movedTicket.linked_alert_id
          ? [movedTicket.linked_alert_id]
          : [];

        const zoneList: string[] = Array.isArray(movedTicket.zone)
          ? movedTicket.zone.filter(Boolean)
          : typeof movedTicket.zone === "string"
          ? movedTicket.zone
            ? [movedTicket.zone]
            : []
          : [];
        const truckNoList: string[] = Array.isArray((movedTicket as any).truck_no)
          ? (movedTicket as any).truck_no.filter(Boolean)
          : [];

        const alertTypeVal = (movedTicket as any).alert_type;
        const alertTypeList: string[] = Array.isArray(alertTypeVal)
          ? alertTypeVal.filter(Boolean).length > 0
            ? alertTypeVal.filter(Boolean)
            : [""]
          : alertTypeVal
          ? [String(alertTypeVal)]
          : [""];

        const categoryVal = (movedTicket as any).category;
        const categoryList: string[] = Array.isArray(categoryVal)
          ? categoryVal.filter(Boolean).length > 0
            ? categoryVal.filter(Boolean)
            : [""]
          : categoryVal
          ? [String(categoryVal)]
          : [""];

        const subCategoryVal = (movedTicket as any).sub_category;
        const subCategoryList: string[] = Array.isArray(subCategoryVal)
          ? subCategoryVal.filter(Boolean).length > 0
            ? subCategoryVal.filter(Boolean)
            : [""]
          : subCategoryVal
          ? [String(subCategoryVal)]
          : [""];

        const subtaskIdVal = (movedTicket as any).subtask_id;
        const subtaskIdList: string[] = Array.isArray(subtaskIdVal)
          ? subtaskIdVal.filter(Boolean).length > 0
            ? subtaskIdVal.filter(Boolean)
            : [""]
          : subtaskIdVal
          ? [String(subtaskIdVal)]
          : [""];

        const assigneeNameList = Array.isArray((movedTicket as any).assignee_name) && (movedTicket as any).assignee_name.length > 0
          ? (movedTicket as any).assignee_name
          : movedTicket.assignee ? [movedTicket.assignee] : [""];
        const assigneeMailList = Array.isArray((movedTicket as any).assignee_mail) && (movedTicket as any).assignee_mail.length > 0
          ? (movedTicket as any).assignee_mail
          : [""];

        updateTicketState({
          id: movedTicket.id,
          ticket_id: movedTicket.ticket_id,
          sap_id: movedTicket.sap_id,
          bu: movedTicket.bu,
          alert_section: movedTicket.alert_section,
          sop_id: movedTicket.sop_id ?? "SOP-1",
          location_name: movedTicket.location_name,
          assignee: "NovexSupport",
          assignee_name: assigneeNameList,
          assignee_mail: assigneeMailList,
          summary: movedTicket.summary,
          description: movedTicket.description,
          ticket_state: newTicketStateApiValue,
          ticket_status: newTicketStatus,
          ticket_severity: movedTicket.ticket_severity,
          comment: movedTicket.comment,
          update_id: String(movedTicket.id),
          file_attachment: movedTicket.file_attachment,
          file_attachment_name: movedTicket.file_attachment_name,
          file_attachment_id: movedTicket.file_attachment_id,
          linked_alert_id: linkedAlertIdValue,
          start_date: movedTicket.start_date || new Date().toISOString(),
          ticket_end_date: movedTicket.ticket_end_date ?? (movedTicket as any).end_date ?? "",
          auto_ticket_close: movedTicket.auto_ticket_close ?? "",
          zone: zoneList,
          truck_no: truckNoList.length > 0 ? truckNoList : [""],
          alert_type: alertTypeList,
          parent_id: (movedTicket as any).parent_id ?? "",
          subtask_id: subtaskIdList,
          category: categoryList,
          sub_category: subCategoryList,
          reason: (movedTicket as any).reason ?? "",
          remarks: (movedTicket as any).remarks ?? "",
        });
      } else {
        console.warn(
          `Unknown state key or ticket not found for drag and drop: ${toStateKey}, Ticket Numeric ID: ${ticketNumericId}`
        );
      }
    },

    [updateTicketState, tickets]
  );

  // Helper function to check if ticket is overdue
  const isTicketOverdue = (ticket: Ticket): boolean => {
    if (!ticket.ticket_end_date) return false;
    if (ticket.ticket_state !== "ToDo" && ticket.ticket_state !== "InProgress" && ticket.ticket_state !== "OnHold" && ticket.ticket_state !== "ReOpen" && ticket.ticket_state !== "OnCompleted") return false;
    
    try {
      const endDate = new Date(ticket.ticket_end_date);
      const today = new Date();
      // Reset time to compare only dates
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      return endDate < today;
    } catch {
      return false;
    }
  };

  const handleToggleOverdueFilter = useCallback((column: "TO DO" | "IN PROGRESS" | "ON HOLD" | "RE OPEN" | "ON COMPLETED") => {
    setShowOverdueOnly((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  }, []);

  const ticketsByState = useMemo(() => {
    const grouped: Record<string, Ticket[]> = {
      "TO DO": [],
      "IN PROGRESS": [],
      CANCELLED: [],
      RESOLVED: [],
      "ON HOLD": [],
      "RE OPEN": [],
      "ON COMPLETED": [],
    };

    filteredTickets.forEach((ticket) => {
      if (ticket.ticket_state === "ToDo") {
        // Apply overdue filter if active
        if (showOverdueOnly["TO DO"]) {
          if (isTicketOverdue(ticket)) {
            grouped["TO DO"].push(ticket);
          }
        } else {
          grouped["TO DO"].push(ticket);
        }
      } else if (ticket.ticket_state === "InProgress") {
        // Apply overdue filter if active
        if (showOverdueOnly["IN PROGRESS"]) {
          if (isTicketOverdue(ticket)) {
            grouped["IN PROGRESS"].push(ticket);
          }
        } else {
          grouped["IN PROGRESS"].push(ticket);
        }
      } else if (ticket.ticket_state === "Cancelled") {
        grouped["CANCELLED"].push(ticket);
      } else if (ticket.ticket_state === "Resolved") {
        grouped["RESOLVED"].push(ticket);
      } else if (ticket.ticket_state === "OnHold") {
        // Apply overdue filter if active
        if (showOverdueOnly["ON HOLD"]) {
          if (isTicketOverdue(ticket)) {
            grouped["ON HOLD"].push(ticket);
          }
        } else {
          grouped["ON HOLD"].push(ticket);
        }
      } else if (ticket.ticket_state === "ReOpen") {
        grouped["RE OPEN"].push(ticket);
      } else if (ticket.ticket_state === "OnCompleted") {
        grouped["ON COMPLETED"].push(ticket);
      }
    });

    return grouped;
  }, [filteredTickets, showOverdueOnly]);

  if (loading && tickets.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
        >
          <Loader2 className="h-5 w-5 animate-spin" />{" "}
          <span className="text-sm">Loading tickets...</span>
        </motion.div>
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-red-600"
        >
          <AlertCircle className="h-5 w-5" />{" "}
          <span className="text-sm">{error}</span>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gray-50 h-screen overflow-hidden flex flex-col"
    >
      {/* Show header with stats and filters only when not in create view */}
      {currentView !== "create" && (
        <div className="bg-white border-b border-gray-200">
          <div className="px-2 sm:px-4 min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 py-1.5 min-h-0 min-w-0">
              {/* Search input - first, narrow on small screens */}
              <div className="relative min-w-9 w-9 sm:w-20 md:w-28 lg:w-40 xl:w-48 2xl:w-56 flex-shrink-0 min-w-0">
                <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 flex-shrink-0" />
                <Input
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-6 h-7 w-full text-xs min-w-0 ${searchTerm ? 'pr-6' : ''}`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-4 w-4 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Filters row: right side of header (no scroll, compact on small screens) */}
              <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 min-w-0 ml-auto">
                {/* Total Tickets - hide on very small screens to keep space for filters/date/+ */}
                <div className="hidden sm:block flex-shrink-0">
                  <TicketStats
                    tickets={filteredTickets}
                    totalTicketCount={totalTicketCount}
                  />
                </div>

                {/* Business Units, Severity, and Ticket Status cards - hidden on small screens */}
                <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                  {/* Business Units card */}
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-lg px-2 py-1 border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="flex gap-2">
                      <div className="text-center leading-tight">
                        <p className="text-[10px] text-gray-600">RO</p>
                        <p className="text-xs font-semibold text-blue-600">
                          {dashboardStats.bu.roPct}%
                        </p>
                      </div>
                      <div className="text-center leading-tight">
                        <p className="text-[10px] text-gray-600">TAS</p>
                        <p className="text-xs font-semibold text-amber-600">
                          {dashboardStats.bu.tasPct}%
                        </p>
                      </div>
                      <div className="text-center leading-tight">
                        <p className="text-[10px] text-gray-600">LPG</p>
                        <p className="text-xs font-semibold text-green-600">
                          {dashboardStats.bu.lpgPct}%
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Severity card */}
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className="rounded-lg px-2 py-1 border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {/* Labels and percentages */}
                      <div className="flex gap-2">
                        <div className="text-center leading-tight">
                          <p className="text-[10px] text-red-600">Crit</p>
                          <p className="text-xs font-semibold text-red-600">
                            {dashboardStats.severity.criticalPct}%
                          </p>
                        </div>
                        <div className="text-center leading-tight">
                          <p className="text-[10px] text-amber-600">High</p>
                          <p className="text-xs font-semibold text-amber-600">
                            {dashboardStats.severity.highPct}%
                          </p>
                        </div>
                        <div className="text-center leading-tight">
                          <p className="text-[10px] text-green-600">Med</p>
                          <p className="text-xs font-semibold text-green-600">
                            {dashboardStats.severity.mediumPct}%
                          </p>
                        </div>
                        <div className="text-center leading-tight">
                          <p className="text-[10px] text-gray-600">Low</p>
                          <p className="text-xs font-semibold text-gray-600">
                            {dashboardStats.severity.lowPct}%
                          </p>
                        </div>
                      </div>
                      {/* Bar charts */}
                      <div className="flex items-end gap-0.5 h-6">
                        <div className="w-1.5 h-full bg-gray-100 rounded-sm overflow-hidden flex items-end">
                          <div
                            className="w-full bg-red-500 rounded-sm transition-all duration-300"
                            style={{
                              height: `${Math.max(
                                Number(dashboardStats.severity.criticalPct),
                                5
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="w-1.5 h-full bg-gray-100 rounded-sm overflow-hidden flex items-end">
                          <div
                            className="w-full bg-amber-500 rounded-sm transition-all duration-300"
                            style={{
                              height: `${Math.max(
                                Number(dashboardStats.severity.highPct),
                                5
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="w-1.5 h-full bg-gray-100 rounded-sm overflow-hidden flex items-end">
                          <div
                            className="w-full bg-green-500 rounded-sm transition-all duration-300"
                            style={{
                              height: `${Math.max(
                                Number(dashboardStats.severity.mediumPct),
                                5
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="w-1.5 h-full bg-gray-100 rounded-sm overflow-hidden flex items-end">
                          <div
                            className="w-full bg-gray-400 rounded-sm transition-all duration-300"
                            style={{
                              height: `${Math.max(
                                Number(dashboardStats.severity.lowPct),
                                5
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Ticket Status card */}
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="rounded-lg px-2 py-1 border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="flex gap-2">
                      <div className="text-center leading-tight">
                        <p className="text-[10px] text-blue-600">OPEN</p>
                        <p className="text-xs font-bold text-gray-900">
                          {dashboardStats.status.open}
                        </p>
                        <div className="h-0.5 w-4 bg-blue-500 rounded mx-auto" />
                      </div>
                      <div className="text-center leading-tight">
                        <p className="text-[10px] text-green-600">CLOSED</p>
                        <p className="text-xs font-bold text-gray-900">
                          {dashboardStats.status.closed}
                        </p>
                        <div className="h-0.5 w-4 bg-green-500 rounded mx-auto" />
                      </div>
                      <div className="text-center leading-tight">
                        <p className="text-[10px] text-amber-600">PENDING</p>
                        <p className="text-xs font-bold text-gray-900">
                          {dashboardStats.status.pending}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Filter buttons */}
                <TicketFilters
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  severityFilter={severityFilter}
                  onSeverityChange={setSeverityFilter}
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  categoryFilter={categoryFilter}
                  onCategoryChange={setCategoryFilter}
                  subcategoryFilter={subcategoryFilter}
                  onSubcategoryChange={setSubcategoryFilter}
                  zoneFilter={zoneFilter}
                  onZoneChange={handleZoneChange}
                  plantFilter={plantFilter}
                  onPlantChange={setPlantFilter}
                  buFilter={buFilter}
                  onBuChange={setBuFilter}
                  zones={zones}
                  plants={plants}
                  dateFilter={dateFilter}
                  onDateChange={setDateFilter}
                  onRefreshClick={handleRefresh}
                  onCreateClick={handleOpenCreateTicketPage}
                  loading={loading || locationsLoading}
                  mergeMode={mergeMode}
                  onMergeModeToggle={handleMergeModeToggle}
                  selectedTickets={selectedTickets}
                  onMergeTickets={handleMergeTickets}
                  onDownloadTickets={downloadExcelTickets}
                  hideSearch={true}
                  currentView={currentView as "board" | "list"}
                  onViewChange={(view) => setCurrentView(view)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pb-1 flex-1 overflow-hidden">
        {currentView === "board" && (
          <KanbanBoard
            ticketsByState={ticketsByState}
            onTicketMove={handleTicketMove}
            onViewTicketDetails={handleOpenViewTicketPage}
            onEditTicket={handleOpenEditTicketPage}
            onDeleteTicket={handleDeleteTicket}
            mergeMode={mergeMode}
            selectedTickets={selectedTickets}
            onTicketSelection={handleTicketSelection}
            onViewMergedTicketDetails={handleViewMergedTicketDetails}
            buCounts={buCounts}
            showOverdueOnly={showOverdueOnly}
            onToggleOverdueFilter={handleToggleOverdueFilter}
            canDragFromAnyColumn={canDragFromAnyColumn}
            canDeleteTickets={canDeleteTickets}
          />
        )}

        {currentView === "list" && (
          <div className="space-y-2">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket, index) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <TicketCard
                    ticket={ticket}
                    index={index}
                    showStateInListView={true}
                    onViewDetails={handleOpenViewTicketPage}
                    onEditTicket={handleOpenEditTicketPage}
                    onDeleteTicket={handleDeleteTicket}
                    mergeMode={mergeMode}
                    canDelete={canDeleteTickets}
                    isSelected={selectedTickets.includes(ticket.id.toString())}
                    onSelectionChange={() =>
                      handleTicketSelection(ticket.id.toString())
                    }
                    onViewMergedTicketDetails={handleViewMergedTicketDetails}
                  />
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                {debouncedSearchTerm
                  ? `No tickets found matching "${debouncedSearchTerm}"`
                  : "No tickets to display in list view."}
              </div>
            )}
          </div>
        )}

        {currentView === "create" && (
          <div>
            <CreateTicketDialog
              open={true}
              onOpenChange={async () => {
                // If creating a subtask, go back to the parent ticket instead of board
                if (parentTicketIdForCreate) {
                  try {
                    // Find parent ticket in the current tickets list
                    const parentTicket = tickets.find(t => t.ticket_id === parentTicketIdForCreate);
                    if (parentTicket) {
                      // Fetch full ticket data and reopen parent ticket
                      const encryptedTicketId = encryptPayload(parentTicket.id);
                      const response = await apiClient.get(`/api/ticketing/${encryptedTicketId}`);
                      setSelectedTicketForEdit(response.data);
                      setParentTicketIdForCreate(null);
                      // Stay in create view to show the parent ticket
                      return;
                    }
                  } catch (error) {
                    console.error("Failed to fetch parent ticket:", error);
                  }
                }
                // Default: go back to board
                setCurrentView("board");
                setSelectedTicketForEdit(null);
                setParentTicketIdForCreate(null);
              }}
              initialData={parentTicketIdForCreate ? null : selectedTicketForEdit}
              parentTicketId={parentTicketIdForCreate || undefined}
              onCreateSubtaskInPlace={useOverlayMode ? (parentId) => {
                setParentTicketIdForCreate(parentId);
                setSelectedTicketForEdit(null);
              } : undefined}
              onSubmitSuccess={() => {
                refetch(ticketApiFilters);
                setCurrentView("board");
                setParentTicketIdForCreate(null);
              }}
              ticketSection="tickets"
            />
          </div>
        )}
      </div>

      {/* Create Ticket Dialog Overlay - Only in overlay mode */}
      {useOverlayMode && showCreateTicketDialog && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowCreateTicketDialog(false)}
        >
          <div
            style={{
              width: '95%',
              maxWidth: '1200px',
              height: '90%',
              maxHeight: '800px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CreateTicketDialog
              open={true}
              onOpenChange={setShowCreateTicketDialog}
              onSubmitSuccess={() => {
                refetch(ticketApiFilters);
                setShowCreateTicketDialog(false);
              }}
              ticketSection="tickets"
            />
          </div>
        </div>
      )}

      {/* Edit Ticket Dialog Overlay - Only in overlay mode */}
      {useOverlayMode && showEditTicketDialog && selectedTicketForEdit && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowEditTicketDialog(false)}
        >
          <div
            style={{
              width: '95%',
              maxWidth: '1200px',
              height: '90%',
              maxHeight: '800px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CreateTicketDialog
              open={true}
              onOpenChange={setShowEditTicketDialog}
              initialData={selectedTicketForEdit}
              onSubmitSuccess={() => {
                refetch(ticketApiFilters);
                setShowEditTicketDialog(false);
              }}
              ticketSection="tickets"
            />
          </div>
        </div>
      )}

      {/* View Ticket Dialog Overlay - Only in overlay mode */}
      {useOverlayMode && showViewTicketDialog && selectedTicketForView && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowViewTicketDialog(false)}
        >
          <div
            style={{
              width: '95%',
              maxWidth: '1200px',
              height: '90%',
              maxHeight: '800px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* For view mode, we can use the same CreateTicketDialog but in a read-only state or create a separate view component */}
            <CreateTicketDialog
              open={true}
              onOpenChange={setShowViewTicketDialog}
              initialData={selectedTicketForView}
              onSubmitSuccess={() => {
                refetch(ticketApiFilters);
                setShowViewTicketDialog(false);
              }}
              ticketSection="tickets"
            />
          </div>
        </div>
      )}

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Merge Tickets</DialogTitle>

            <DialogDescription>
              Merging {selectedTickets.length} tickets. The first selected
              ticket will remain as the primary ticket, and others will be
              merged into it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                Primary Ticket (will remain):
              </h4>

              <p className="text-sm text-blue-700">
                {
                  tickets.find((t) => t.id.toString() === selectedTickets[0])
                    ?.ticket_id
                }{" "}
                -
                {
                  tickets.find((t) => t.id.toString() === selectedTickets[0])
                    ?.summary
                }
              </p>
            </div>

            <div className="bg-orange-50 p-3 rounded-lg">
              <h4 className="font-medium text-orange-900 mb-2">
                Tickets to be merged:
              </h4>

              <ul className="text-sm text-orange-700 space-y-1">
                {selectedTickets.slice(1).map((ticketId) => {
                  const ticket = tickets.find(
                    (t) => t.id.toString() === ticketId
                  );

                  return (
                    <li key={ticketId}>
                      • {ticket?.ticket_id} - {ticket?.summary}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <Label htmlFor="description">Merge Details & Comments</Label>

              <Textarea
                id="description"
                value={mergeForm.description}
                onChange={(e) =>
                  setMergeForm((prev) => ({
                    ...prev,

                    description: e.target.value,
                  }))
                }
                placeholder="Add details about why these tickets are being merged, combined context, or any additional notes..."
                rows={4}
              />
            </div>

          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMergeDialogOpen(false);
                setMergeMode(false);
                setSelectedTickets([]);
                navigate("/settings/tickets2");
              }}
              disabled={mergingInProgress}
            >
              Cancel
            </Button>

            <Button
              onClick={confirmMergeTickets}
              className="bg-green-600 hover:bg-green-700"
              disabled={mergingInProgress}
            >
              {mergingInProgress ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                "Merge Tickets"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>

            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              ticket.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeleteTicket}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
