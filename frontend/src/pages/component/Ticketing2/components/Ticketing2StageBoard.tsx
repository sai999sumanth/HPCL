import React, { useMemo, useCallback, useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { Loader2, Flag } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { Ticket } from "../types/ticket";
import {
  TICKETING2_STAGES,
  getTicketStage,
  Ticketing2StageCard,
  isTicketOverdue,
  type Ticketing2StageId,
} from "./Ticketing2StageCard";

interface Ticketing2StageBoardProps {
  tickets: Ticket[];
  openTicketsByZone: Ticket[];
  updatedByInitiatorTickets: Ticket[];
  returnedByOccTickets: Ticket[];
  reviewedByOccTickets: Ticket[];
  escalatedTicketsL1: Ticket[];
  escalatedTicketsL2: Ticket[];
  escalatedLevel: "L1" | "L2";
  onEscalatedLevelChange: (level: "L1" | "L2") => void;
  /** View mode for Open column – "By Zone" or "By Location". */
  openViewMode: "zone" | "location";
  onOpenViewModeChange: (mode: "zone" | "location") => void;
  /** Sub-view when Open is "By Location". */
  openLocationSubView: "locationInCharge" | "reassignPlantOfficer";
  onOpenLocationSubViewChange: (sub: "locationInCharge" | "reassignPlantOfficer") => void;
  openTicketsByLocationInCharge: Ticket[];
  openTicketsByLocationReassign: Ticket[];
  openTicketsByZoneTotal?: number;
  openTicketsByLocationTotal?: number;
  reassignedToOfficerTicketsTotal?: number;
  escalatedTicketsL1Total?: number;
  escalatedTicketsL2Total?: number;
  updatedByInitiatorTicketsTotal?: number;
  returnedByOccTicketsTotal?: number;
  reviewedByOccTicketsTotal?: number;
  loading: boolean;
  error: string | null;
  onTicketClick?: (ticket: Ticket, sourceStage?: Ticketing2StageId) => void;
  onTicketMove?: (
    ticketId: number | string,
    fromStage: Ticketing2StageId,
    toStage: Ticketing2StageId
  ) => void | Promise<void>;
  /** If true, user can drag OCC review stages (Updated → Returned, Returned → Reviewed). */
  canMoveOccStages?: boolean;
  /** If true, user can move certain stages into "Updated by Initiator" (e.g. from Returned by Occ). */
  canMoveToUpdatedByInitiator?: boolean;
  /** If true, user can drag from Open to "Updated by Initiator". Location/Plant In-Charge SOD + Zonal SOD Ticketing. */
  canMoveFromOpenToUpdatedByInitiator?: boolean;
  /** If true, user can drag from Escalated (L1) to "Updated by Initiator". Only Zonal SOD Ticketing. */
  canMoveFromL1ToUpdatedByInitiator?: boolean;
  /** If true, user can drag from Escalated (L2) to "Updated by Initiator". Only Zonal Head SOD Ticketing. */
  canMoveFromL2ToUpdatedByInitiator?: boolean;
  /**
   * For Location In-Charge SOD / Plant In-Charge SOD:
   * - Open "By Zone" view: cards not draggable (use "By Location")
   * - Open "Reassign to officer": draggable only when session employee_id matches reassignee list
   * - Escalated column: tickets with escalation_level L1 or L2 must not be draggable
   */
  restrictDragByEscalationForLocationOrPlantIncharge?: boolean;
  /**
   * Zonal SOD Ticketing only: while Open view is "By Location", disable all card drags
   * (no moves to other stage columns). Does not alter card styling.
   */
  disableZonalSodDragWhenOpenByLocation?: boolean;
  /** employee_id from session API (logged-in user). */
  currentEmployeeId?: string;
  onLoadMoreByStage?: (stageId: Ticketing2StageId) => void;
  /**
   * When true, column and sub-tab counts reflect loaded/filtered lists (e.g. search)
   * instead of API totals so empty columns show 0 and matches show the real count.
   */
  isSearchActive?: boolean;
  /** Fired when visible card counts change (e.g. overdue flag) so the header total can stay in sync. */
  onVisibilityTotalsChange?: (payload: { totalVisible: number; overdueAny: boolean }) => void;
}

const STAGE_COLORS: Record<Ticketing2StageId, string> = {
  Open: "bg-slate-100 border-slate-200",
  Escalated: "bg-amber-50 border-amber-200",
  "Updated by Initiator": "bg-blue-50 border-blue-200",
  "Returned by Occ": "bg-violet-50 border-violet-200",
  "Reviewed by Occ": "bg-emerald-50 border-emerald-200",
};

const STAGE_HEADER_BG: Record<Ticketing2StageId, string> = {
  Open: "bg-slate-200/80 text-slate-800",
  Escalated: "bg-amber-200/80 text-amber-900",
  "Updated by Initiator": "bg-blue-200/80 text-blue-900",
  "Returned by Occ": "bg-violet-200/80 text-violet-900",
  "Reviewed by Occ": "bg-emerald-200/80 text-emerald-900",
};

/** Stages that show the overdue (flag) filter - work-in-progress columns only */
const STAGES_WITH_OVERDUE_FLAG: Ticketing2StageId[] = [
  "Open",
  "Escalated",
  "Updated by Initiator",
  "Returned by Occ",
];

/** Display labels for dashboard column headers - show OCC (uppercase) */
const STAGE_DISPLAY_LABELS: Record<Ticketing2StageId, string> = {
  Open: "Open",
  Escalated: "Escalated",
  "Updated by Initiator": "Updated by Initiator",
  "Returned by Occ": "Returned by OCC",
  "Reviewed by Occ": "Reviewed by OCC",
};

function normalizeEscalationLevel(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).trim().toUpperCase();
}

function isBlankEscalationTicket(ticket: Ticket): boolean {
  return !normalizeEscalationLevel((ticket as any).escalation_level);
}

/** Session employee_id equals an entry in ticket.employee_id (array or scalar from API). */
function sessionEmployeeMatchesTicketEmployeeIds(ticket: Ticket, sessionEmployeeId: string): boolean {
  const sid = String(sessionEmployeeId ?? "").trim();
  if (!sid) return false;
  const raw = (ticket as any).employee_id;
  const ids = Array.isArray(raw)
    ? raw.map((v: unknown) => String(v ?? "").trim()).filter(Boolean)
    : raw != null && raw !== ""
      ? [String(raw).trim()]
      : [];
  return ids.includes(sid);
}

/** Session employee_id equals an entry in ticket.re_assingee_employee_id (array/scalar, legacy spellings supported). */
function sessionEmployeeMatchesTicketReassigneeIds(ticket: Ticket, sessionEmployeeId: string): boolean {
  const sid = String(sessionEmployeeId ?? "").trim();
  if (!sid) return false;
  const raw =
    (ticket as any).re_assingee_employee_id ?? (ticket as any).re_assignee_employee_id;
  const ids = Array.isArray(raw)
    ? raw.map((v: unknown) => String(v ?? "").trim()).filter(Boolean)
    : raw != null && raw !== ""
      ? [String(raw).trim()]
      : [];
  return ids.includes(sid);
}

export function Ticketing2StageBoard({
  tickets,
  openTicketsByZone,
  updatedByInitiatorTickets,
  returnedByOccTickets,
  reviewedByOccTickets,
  openTicketsByLocationInCharge,
  openTicketsByLocationReassign,
  openTicketsByZoneTotal = 0,
  openTicketsByLocationTotal = 0,
  reassignedToOfficerTicketsTotal = 0,
  escalatedTicketsL1Total = 0,
  escalatedTicketsL2Total = 0,
  updatedByInitiatorTicketsTotal = 0,
  returnedByOccTicketsTotal = 0,
  reviewedByOccTicketsTotal = 0,
  openLocationSubView,
  onOpenLocationSubViewChange,
  escalatedTicketsL1,
  escalatedTicketsL2,
  escalatedLevel,
  onEscalatedLevelChange,
  openViewMode,
  onOpenViewModeChange,
  loading,
  error,
  onTicketClick,
  onTicketMove,
  canMoveOccStages = false,
  canMoveToUpdatedByInitiator = false,
  canMoveFromOpenToUpdatedByInitiator = false,
  canMoveFromL1ToUpdatedByInitiator = false,
  canMoveFromL2ToUpdatedByInitiator = false,
  restrictDragByEscalationForLocationOrPlantIncharge = false,
  disableZonalSodDragWhenOpenByLocation = false,
  currentEmployeeId = "",
  onLoadMoreByStage,
  isSearchActive = false,
  onVisibilityTotalsChange,
}: Ticketing2StageBoardProps) {
  const [showOverdueOnly, setShowOverdueOnly] = useState<Record<Ticketing2StageId, boolean>>({
    Open: false,
    Escalated: false,
    "Updated by Initiator": false,
    "Returned by Occ": false,
    "Reviewed by Occ": false,
  });

  // For escalated tickets, we use the separate API calls
  const escalatedTickets = escalatedLevel === "L1" ? escalatedTicketsL1 : escalatedTicketsL2;

  const handleToggleOverdueFilter = useCallback((stageId: Ticketing2StageId) => {
    setShowOverdueOnly((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  }, []);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (
        !destination ||
        (destination.droppableId === source.droppableId && destination.index === source.index)
      ) {
        return;
      }
      const toStage = destination.droppableId as Ticketing2StageId;
      const fromStage = source.droppableId as Ticketing2StageId;

      if (disableZonalSodDragWhenOpenByLocation && fromStage !== toStage) {
        const deferForReturnedToUpdated =
          fromStage === "Returned by Occ" && toStage === "Updated by Initiator";
        // Zonal SOD + By Location: still allow L1 escalated → Updated by Initiator (not from L2 tab).
        const deferEscalatedL1ToUpdated =
          fromStage === "Escalated" &&
          toStage === "Updated by Initiator" &&
          escalatedLevel === "L1";
        if (!deferForReturnedToUpdated && !deferEscalatedL1ToUpdated) {
          return;
        }
      }

      // OCC stage permissions:
      // - Only OCC HQO roles (canMoveOccStages) can move:
      //   • "Open" / "Escalated" / "Returned by Occ" → cannot enter OCC stages unless role allows
      //   • "Updated by Initiator" → "Returned by Occ" (HQO OCC only)
      //   • "Updated by Initiator" → "Reviewed by Occ" (HQO OCC only)
      //   • "Returned by Occ"      → "Reviewed by Occ" (HQO OCC only)
      if (toStage === "Returned by Occ") {
        if (!canMoveOccStages || fromStage !== "Updated by Initiator") {
          return;
        }
      }
      if (toStage === "Reviewed by Occ") {
        if (
          !canMoveOccStages ||
          (fromStage !== "Updated by Initiator" && fromStage !== "Returned by Occ")
        ) {
          return;
        }
      }

      // "Updated by Initiator" stage permissions:
      //   • "Open" → "Updated by Initiator": Location In-Charge SOD, Plant In-Charge SOD, Zonal SOD Ticketing
      //   • "Escalated" (L1) → "Updated by Initiator": Only Zonal SOD Ticketing
      //   • "Escalated" (L2) → "Updated by Initiator": Only Zonal Head SOD Ticketing
      //   • "Returned by Occ" → "Updated by Initiator":
      //       - escalation_level blank: Location/Plant In-Charge SOD, or session employee_id in ticket.re_assingee_employee_id[]
      //       - escalation_level L1:   Zonal SOD Ticketing
      //       - escalation_level L2:   Zonal Head SOD Ticketing
      if (toStage === "Updated by Initiator") {
        const fromOpen = fromStage === "Open";
        const fromL2 = fromStage === "Escalated" && escalatedLevel === "L2";
        const fromL1 = fromStage === "Escalated" && escalatedLevel === "L1";
        const fromReturnedByOcc = fromStage === "Returned by Occ";

        // Reassign to officer -> Updated by Initiator:
        // allow when session employee_id exists in ticket.re_assingee_employee_id[].
        let canMoveFromReassignToOfficerByEmployeeMatch = false;
        if (fromOpen && openViewMode === "location" && openLocationSubView === "reassignPlantOfficer") {
          const draggedTicket = openTicketsByLocationReassign.find(
            (t) => String(t.id ?? t.ticket_id) === String(draggableId)
          );
          if (!draggedTicket) {
            return;
          }
          const reassigneeIdsRaw = (draggedTicket as any).re_assingee_employee_id;
          const reassigneeIds = Array.isArray(reassigneeIdsRaw)
            ? reassigneeIdsRaw.map((v: unknown) => String(v ?? "").trim()).filter(Boolean)
            : reassigneeIdsRaw != null
              ? [String(reassigneeIdsRaw).trim()]
              : [];
          const sessionEmployeeId = String(currentEmployeeId ?? "").trim();
          canMoveFromReassignToOfficerByEmployeeMatch =
            !!sessionEmployeeId && reassigneeIds.includes(sessionEmployeeId);
        }

        // For Reassign-to-officer flow, employee_id match is mandatory.
        // Do not allow fallback via generic Open->Updated role permission.
        if (fromOpen && openViewMode === "location" && openLocationSubView === "reassignPlantOfficer") {
          if (!canMoveFromReassignToOfficerByEmployeeMatch) {
            return;
          }
        } else if (fromOpen && !canMoveFromOpenToUpdatedByInitiator) {
          // Keep existing Open->Updated role rule for non-reassign Open flows.
          return;
        }

        if (fromL2 && !canMoveFromL2ToUpdatedByInitiator) {
          return;
        }
        if (fromL1 && !canMoveFromL1ToUpdatedByInitiator) {
          return; // Zonal SOD Ticketing only
        }

        if (fromReturnedByOcc) {
          const allTickets: Ticket[] = [
            ...tickets,
            ...returnedByOccTickets,
            ...updatedByInitiatorTickets,
            ...reviewedByOccTickets,
            ...escalatedTicketsL1,
            ...escalatedTicketsL2,
          ];
          const draggedTicket = allTickets.find(
            (t) => String(t.id ?? t.ticket_id) === String(draggableId)
          );

          if (!draggedTicket) {
            return;
          }

          const escalationStr = normalizeEscalationLevel(
            (draggedTicket as any).escalation_level
          );

          let canMoveFromReturnedByOcc = false;
          if (!escalationStr) {
            canMoveFromReturnedByOcc =
              !!canMoveFromOpenToUpdatedByInitiator ||
              sessionEmployeeMatchesTicketReassigneeIds(draggedTicket, currentEmployeeId);
          } else if (escalationStr === "L1") {
            // L1 escalation → only Zonal SOD Ticketing
            canMoveFromReturnedByOcc = !!canMoveFromL1ToUpdatedByInitiator;
          } else if (escalationStr === "L2") {
            // L2 escalation → only Zonal Head SOD Ticketing
            canMoveFromReturnedByOcc = !!canMoveFromL2ToUpdatedByInitiator;
          } else {
            // Any other unexpected escalation_level is blocked
            canMoveFromReturnedByOcc = false;
          }

          if (!canMoveFromReturnedByOcc) {
            return;
          }
        }
      }

      // Restricted: Open column ("LIC inbox" / "Reassign to officer") is read-only as a drop target.
      // Allow only in-column reorder (Open -> Open), block all cross-stage moves into Open.
      if (toStage === "Open") {
        if (fromStage !== "Open") {
          return;
        }
      }

      // Prevent moving tickets from any other stage into Escalated.
      if (toStage === "Escalated" && fromStage !== "Escalated") {
        return;
      }

      const ticketId = draggableId.includes("-") ? draggableId : parseInt(draggableId, 10);
      onTicketMove?.(ticketId, fromStage, toStage);
    },
    [
      onTicketMove,
      canMoveOccStages,
      canMoveToUpdatedByInitiator,
      canMoveFromOpenToUpdatedByInitiator,
      canMoveFromL1ToUpdatedByInitiator,
      canMoveFromL2ToUpdatedByInitiator,
      escalatedLevel,
      tickets,
      escalatedTicketsL1,
      escalatedTicketsL2,
      openViewMode,
      openLocationSubView,
      openTicketsByLocationReassign,
      currentEmployeeId,
      disableZonalSodDragWhenOpenByLocation,
      returnedByOccTickets,
      updatedByInitiatorTickets,
      reviewedByOccTickets,
    ]
  );

  const ticketsByStage = useMemo(() => {
    const map: Record<Ticketing2StageId, Ticket[]> = {
      Open: [],
      Escalated: [],
      "Updated by Initiator": [],
      "Returned by Occ": [],
      "Reviewed by Occ": [],
    };
    tickets
      .filter((t) => t.merge_status !== "Merged")
      .forEach((t) => {
        const stage = getTicketStage(t);
        // For Escalated stage, use the separate escalated tickets instead of filtering from main tickets
        if (
          stage === "Escalated" ||
          stage === "Open" ||
          stage === "Updated by Initiator" ||
          stage === "Returned by Occ"
        ) {
          // Escalated and Open tickets are handled separately below
          return;
        }
        map[stage].push(t);
      });

    // Add escalated tickets based on current level
    // Important: only include tickets whose current state maps to the Escalated stage.
    // This prevents tickets that have been moved (e.g. to "Updated by Initiator")
    // from still appearing in the Escalated L1/L2 tabs after refetch.
    map.Escalated = escalatedTickets
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Escalated");

    // Add Open tickets based on current "By Zone" / "By Location" view,
    // and only include tickets whose current state maps to the Open stage.
    const openLocationSource =
      openLocationSubView === "reassignPlantOfficer"
        ? openTicketsByLocationReassign
        : openTicketsByLocationInCharge;
    const openSource = openViewMode === "zone" ? openTicketsByZone : openLocationSource;
    map.Open = openSource
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Open");

    // Add Updated by Initiator tickets from dedicated API for that tab.
    map["Updated by Initiator"] = updatedByInitiatorTickets
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Updated by Initiator");

    // Add Returned by OCC tickets from dedicated API for that tab.
    map["Returned by Occ"] = returnedByOccTickets
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Returned by Occ");

    // Add Reviewed by OCC tickets from dedicated API for that tab.
    map["Reviewed by Occ"] = reviewedByOccTickets
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Reviewed by Occ");

    return map;
  }, [
    tickets,
    escalatedTickets,
    escalatedLevel,
    openTicketsByZone,
    openTicketsByLocationInCharge,
    openTicketsByLocationReassign,
    updatedByInitiatorTickets,
    returnedByOccTickets,
    reviewedByOccTickets,
    openViewMode,
    openLocationSubView,
  ]);

  const visibleTicketsByStage = useMemo(() => {
    const result: Record<Ticketing2StageId, Ticket[]> = {} as Record<Ticketing2StageId, Ticket[]>;
    (TICKETING2_STAGES as readonly Ticketing2StageId[]).forEach((stageId) => {
      const stageTickets = ticketsByStage[stageId];
      const filteredByOverdue = showOverdueOnly[stageId]
        ? stageTickets.filter(isTicketOverdue)
        : stageTickets;
      result[stageId] = filteredByOverdue;
    });
    return result;
  }, [ticketsByStage, showOverdueOnly]);

  const openCountZone = useMemo(() => {
    const base = openTicketsByZone
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Open");
    const filtered = showOverdueOnly.Open ? base.filter(isTicketOverdue) : base;
    if (isSearchActive || showOverdueOnly.Open) return filtered.length;
    return openTicketsByZoneTotal;
  }, [openTicketsByZone, showOverdueOnly.Open, isSearchActive, openTicketsByZoneTotal]);

  const openCountLocationInCharge = useMemo(() => {
    const base = openTicketsByLocationInCharge
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Open");
    const filtered = showOverdueOnly.Open ? base.filter(isTicketOverdue) : base;
    if (isSearchActive || showOverdueOnly.Open) return filtered.length;
    return openTicketsByLocationTotal;
  }, [
    openTicketsByLocationInCharge,
    showOverdueOnly.Open,
    isSearchActive,
    openTicketsByLocationTotal,
  ]);

  const openCountLocationReassign = useMemo(() => {
    const base = openTicketsByLocationReassign
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Open");
    const filtered = showOverdueOnly.Open ? base.filter(isTicketOverdue) : base;
    if (isSearchActive || showOverdueOnly.Open) return filtered.length;
    return reassignedToOfficerTicketsTotal;
  }, [
    openTicketsByLocationReassign,
    showOverdueOnly.Open,
    isSearchActive,
    reassignedToOfficerTicketsTotal,
  ]);

  const openCountLocation = openCountLocationInCharge + openCountLocationReassign;
  const openTotalCount = openCountZone + openCountLocation;

  const escalatedCountL1 = useMemo(() => {
    const base = escalatedTicketsL1
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Escalated");
    const filtered = showOverdueOnly.Escalated ? base.filter(isTicketOverdue) : base;
    if (isSearchActive || showOverdueOnly.Escalated) return filtered.length;
    return escalatedTicketsL1Total;
  }, [escalatedTicketsL1, showOverdueOnly.Escalated, isSearchActive, escalatedTicketsL1Total]);

  const escalatedCountL2 = useMemo(() => {
    const base = escalatedTicketsL2
      .filter((t) => t.merge_status !== "Merged")
      .filter((t) => getTicketStage(t) === "Escalated");
    const filtered = showOverdueOnly.Escalated ? base.filter(isTicketOverdue) : base;
    if (isSearchActive || showOverdueOnly.Escalated) return filtered.length;
    return escalatedTicketsL2Total;
  }, [escalatedTicketsL2, showOverdueOnly.Escalated, isSearchActive, escalatedTicketsL2Total]);

  useEffect(() => {
    if (!onVisibilityTotalsChange) return;
    const totalVisible = TICKETING2_STAGES.reduce(
      (sum, sid) => sum + visibleTicketsByStage[sid].length,
      0
    );
    const overdueAny = STAGES_WITH_OVERDUE_FLAG.some((id) => showOverdueOnly[id]);
    onVisibilityTotalsChange({ totalVisible, overdueAny });
  }, [visibleTicketsByStage, showOverdueOnly, onVisibilityTotalsChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 flex-1 min-h-0 overflow-hidden h-full"
        style={{ gridTemplateRows: "1fr" }}
      >
        {TICKETING2_STAGES.map((stageId) => {
          const stageTickets = ticketsByStage[stageId];
          const visibleTickets = visibleTicketsByStage[stageId];
          const showOverdueFilter = STAGES_WITH_OVERDUE_FLAG.includes(stageId);
          const isOverdueFilterActive = showOverdueOnly[stageId];
          return (
            <div
              key={stageId}
              className={`min-w-0 w-full h-full rounded-lg border ${STAGE_COLORS[stageId]} flex flex-col overflow-hidden min-h-0`}
            >
              <div
                className={`flex-shrink-0 px-3 py-2 font-semibold text-sm ${STAGE_HEADER_BG[stageId]} border-b border-slate-200/50 flex flex-col gap-1.5`}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span
                    className="truncate min-w-0"
                    title={STAGE_DISPLAY_LABELS[stageId]}
                  >
                    {STAGE_DISPLAY_LABELS[stageId]}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {showOverdueFilter && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 w-6 p-0 ${isOverdueFilterActive ? "bg-red-100 hover:bg-red-200" : "hover:bg-slate-200"
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleOverdueFilter(stageId);
                        }}
                        title={isOverdueFilterActive ? "Show all tickets" : "Show overdue tickets only"}
                      >
                        <Flag className="h-3.5 w-3.5 text-red-600" fill="currentColor" />
                      </Button>
                    )}
                    <span className="text-xs font-normal opacity-90">
                      (
                      {isOverdueFilterActive
                        ? visibleTickets.length
                        : isSearchActive
                          ? stageTickets.length
                          : stageId === "Open"
                            ? openTotalCount
                            : stageId === "Escalated"
                              ? escalatedCountL1 + escalatedCountL2
                              : stageId === "Updated by Initiator"
                                ? updatedByInitiatorTicketsTotal
                                : stageId === "Returned by Occ"
                                  ? returnedByOccTicketsTotal
                                  : stageId === "Reviewed by Occ"
                                    ? reviewedByOccTicketsTotal
                                    : visibleTickets.length}
                      )
                    </span>
                  </div>
                </div>
                {stageId === "Open" && (
                  <div className="flex items-center gap-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-900 w-full">
                    {(["location", "zone"] as const).map((mode) => {
                      const isActive = openViewMode === mode;
                      const modeLabel =
                        mode === "zone"
                          ? `By Zone (${openCountZone})`
                          : `By Location (${openCountLocation})`;
                      return (
                        <button
                          key={mode}
                          type="button"
                          title={modeLabel}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenViewModeChange(mode);
                          }}
                          className={`flex-1 min-w-0 px-3 py-0.5 rounded-full transition-colors ${isActive
                              ? "bg-slate-700 text-white shadow-sm"
                              : "bg-transparent text-slate-800/80 hover:bg-slate-300"
                            }`}
                        >
                          {modeLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
                {stageId === "Open" && openViewMode === "location" && (
                  <div className="flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-800 w-full border border-slate-200/80">
                    {(
                      [
                        [
                          "locationInCharge",
                          `LIC inbox (${openCountLocationInCharge})`,
                          `Location In charge (${openCountLocationInCharge})`,
                        ] as const,
                        [
                          "reassignPlantOfficer",
                          `Reassign to officer (${openCountLocationReassign})`,
                          `Reassign to plant officer (${openCountLocationReassign})`,
                        ] as const,
                      ] as const
                    ).map(([subKey, tabLabel, hoverTitle]) => {
                      const isActive = openLocationSubView === subKey;
                      const subTabFlex =
                        subKey === "locationInCharge"
                          ? "min-w-0 flex-[0.4_1_0%]"
                          : "min-w-0 flex-[0.6_1_0%]";
                      return (
                        <button
                          key={subKey}
                          type="button"
                          title={hoverTitle}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLocationSubViewChange(subKey);
                          }}
                          className={`${subTabFlex} px-2 py-0.5 rounded-full transition-colors ${isActive
                              ? "bg-slate-600 text-white shadow-sm"
                              : "bg-transparent text-slate-800/80 hover:bg-slate-200"
                            }`}
                        >
                          <span className="block truncate text-center leading-tight">{tabLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {stageId === "Escalated" && (
                  <div className="flex items-center gap-1 rounded-full bg-amber-100/80 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 w-full">
                    {(["L1", "L2"] as const).map((level) => {
                      const isActive = escalatedLevel === level;
                      const levelLabel = `${level} (${level === "L1" ? escalatedCountL1 : escalatedCountL2})`;
                      return (
                        <button
                          key={level}
                          type="button"
                          title={levelLabel}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEscalatedLevelChange(level);
                          }}
                          className={`flex-1 min-w-0 px-3 py-0.5 rounded-full transition-colors ${isActive
                              ? "bg-amber-500 text-white shadow-sm"
                              : "bg-transparent text-amber-900/80 hover:bg-amber-200"
                            }`}
                        >
                          {levelLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <Droppable droppableId={stageId}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-blue-50/50" : ""
                      }`}
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      const nearBottom =
                        target.scrollTop + target.clientHeight >= target.scrollHeight - 48;
                      if (nearBottom) {
                        onLoadMoreByStage?.(stageId);
                      }
                    }}
                  >
                    {visibleTickets.map((ticket, index) => {
                      const escalationStr = normalizeEscalationLevel(
                        (ticket as any).escalation_level
                      );
                      const isEscalatedTicketForRestrictedRole =
                        restrictDragByEscalationForLocationOrPlantIncharge &&
                        (escalationStr === "L1" || escalationStr === "L2");

                      // For Location / Plant In-Charge SOD roles:
                      // - In Open tab, when viewing "By Zone", cards must not be draggable.
                      //   Drag is only allowed from the "By Location" view.
                      const isOpenZoneNonDraggableForRestrictedRole =
                        restrictDragByEscalationForLocationOrPlantIncharge &&
                        stageId === "Open" &&
                        openViewMode === "zone";

                      const isOpenLocationReassignNonDraggableForLocationOrPlant =
                        restrictDragByEscalationForLocationOrPlantIncharge &&
                        stageId === "Open" &&
                        openViewMode === "location" &&
                        openLocationSubView === "reassignPlantOfficer" &&
                        (() => {
                          const reassigneeIdsRaw = (ticket as any).re_assingee_employee_id;
                          const reassigneeIds = Array.isArray(reassigneeIdsRaw)
                            ? reassigneeIdsRaw.map((v: unknown) => String(v ?? "").trim()).filter(Boolean)
                            : reassigneeIdsRaw != null
                              ? [String(reassigneeIdsRaw).trim()]
                              : [];
                          const sessionEmployeeId = String(currentEmployeeId ?? "").trim();
                          const isReassignMatch =
                            !!sessionEmployeeId && reassigneeIds.includes(sessionEmployeeId);
                          return !isReassignMatch;
                        })();

                      const allowZonalSodDragReturnedByOccBlankEscEmployeeMatch =
                        stageId === "Returned by Occ" &&
                        isBlankEscalationTicket(ticket) &&
                        sessionEmployeeMatchesTicketReassigneeIds(ticket, currentEmployeeId);

                      // Zonal SOD Ticketing: allow drag start for Returned by OCC tickets with L1 escalation.
                      // Drop guard in handleDragEnd still enforces target-stage permissions.
                      const allowZonalSodDragReturnedByOccL1Escalation =
                        stageId === "Returned by Occ" && escalationStr === "L1";

                      const allowZonalSodEscalatedL1Drag =
                        stageId === "Escalated" && escalatedLevel === "L1";

                      const isDragDisabled =
                        stageId === "Reviewed by Occ" ||
                        isEscalatedTicketForRestrictedRole ||
                        isOpenZoneNonDraggableForRestrictedRole ||
                        isOpenLocationReassignNonDraggableForLocationOrPlant ||
                        (disableZonalSodDragWhenOpenByLocation &&
                          !allowZonalSodDragReturnedByOccBlankEscEmployeeMatch &&
                          !allowZonalSodDragReturnedByOccL1Escalation &&
                          !allowZonalSodEscalatedL1Drag);
                      // Keep card colors unchanged even when drag is blocked by role/stage rules.
                      const isVisuallyDraggable = true;

                      return (
                        <Draggable
                          key={String(ticket.id ?? ticket.ticket_id)}
                          draggableId={String(ticket.id ?? ticket.ticket_id)}
                          index={index}
                          isDragDisabled={isDragDisabled}
                        >
                          {(providedDraggable, snapshotDraggable) => (
                            <div
                              ref={providedDraggable.innerRef}
                              {...providedDraggable.draggableProps}
                              {...providedDraggable.dragHandleProps}
                              className={`min-w-0 overflow-visible ${snapshotDraggable.isDragging ? "opacity-90 shadow-lg" : ""
                                }`}
                            >
                              <Ticketing2StageCard
                                ticket={ticket}
                                isDraggable={isVisuallyDraggable}
                                isReviewedColumn={stageId === "Reviewed by Occ"}
                                onClick={() => onTicketClick?.(ticket, stageId)}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
