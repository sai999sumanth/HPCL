import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { KanbanColumn } from "./kanban-column";
import { TicketCard } from "./ticket-card";
import { Ticket } from "../types/ticket";
import { motion } from "framer-motion";
import React, { useCallback, useMemo } from "react";

interface KanbanBoardProps {
  ticketsByState: Record<string, Ticket[]>;
  onTicketMove: (ticketId: number, fromState: string, toState: string) => void;
  onViewTicketDetails: (ticket: Ticket) => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  mergeMode?: boolean;
  selectedTickets?: string[];
  onTicketSelection?: (ticketId: string) => void;
  onViewMergedTicketDetails?: (ticketId: string) => void;
  buCounts?: { RO: number; TAS: number; LPG: number };
  showOverdueOnly?: { "TO DO": boolean; "IN PROGRESS": boolean; "ON HOLD": boolean; "RE OPEN": boolean; "ON COMPLETED": boolean };
  onToggleOverdueFilter?: (column: "TO DO" | "IN PROGRESS" | "ON HOLD" | "RE OPEN" | "ON COMPLETED") => void;
  /** If false, user can only drag between TO DO, IN PROGRESS, ON HOLD, and ON COMPLETED. Default true = full drag. */
  canDragFromAnyColumn?: boolean;
  /** If false, hide delete action from cards. */
  canDeleteTickets?: boolean;
}

const ALLOWED_DRAG_COLUMNS = ["TO DO", "IN PROGRESS", "ON HOLD", "ON COMPLETED"];

const KanbanBoardComponent: React.FC<KanbanBoardProps> = ({
  ticketsByState,
  onTicketMove,
  onViewTicketDetails,
  onEditTicket,
  onDeleteTicket,
  mergeMode = false,
  selectedTickets = [],
  onTicketSelection,
  onViewMergedTicketDetails,
  showOverdueOnly = { "TO DO": false, "IN PROGRESS": false, "ON HOLD": false, "RE OPEN": false, "ON COMPLETED": false },
  onToggleOverdueFilter,
  canDragFromAnyColumn = true,
  canDeleteTickets = true,
}) => {
  const handleDeleteTicketWrapper = useCallback(
    (ticket: Ticket) => {
      onDeleteTicket(ticket.id.toString());
    },
    [onDeleteTicket]
  );

  const handleDragEnd = (result: DropResult) => {
    if (mergeMode) return;

    const { destination, source, draggableId } = result;

    if (
      !destination ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)
    ) {
      return;
    }

    const fromState = source.droppableId;
    const toState = destination.droppableId;

    if (!canDragFromAnyColumn) {
      const allowed = ALLOWED_DRAG_COLUMNS;
      if (!allowed.includes(fromState) || !allowed.includes(toState)) {
        return;
      }
    }

    const ticketId = parseInt(draggableId);
    onTicketMove(ticketId, fromState, toState);
  };


  // Calculate BU counts, severity counts, and status counts from displayed tickets
  const statsData = useMemo(() => {
    const allDisplayedTickets = Object.values(ticketsByState).flat();
    
    // BU counts
    const roCount = allDisplayedTickets.filter(
      (t) => t.bu === "RO" || t.bu === "BU"
    ).length;
    const tasCount = allDisplayedTickets.filter((t) => t.bu === "TAS").length;
    const lpgCount = allDisplayedTickets.filter((t) => t.bu === "LPG").length;

    // Severity counts
    const criticalCount = allDisplayedTickets.filter((t) => t.ticket_severity === "Critical").length;
    const highCount = allDisplayedTickets.filter((t) => t.ticket_severity === "High").length;
    const mediumCount = allDisplayedTickets.filter((t) => t.ticket_severity === "Medium").length;
    const lowCount = allDisplayedTickets.filter((t) => t.ticket_severity === "Low").length;
    const totalSeverity = criticalCount + highCount + mediumCount + lowCount;

    // Status counts: ON COMPLETED in OPEN only
    const openCount = allDisplayedTickets.filter((t) =>
      t.ticket_state === "ToDo" || t.ticket_state === "InProgress" || t.ticket_state === "OnHold" || t.ticket_state === "ReOpen" || t.ticket_state === "OnCompleted"
    ).length;
    const closedCount = allDisplayedTickets.filter((t) =>
      t.ticket_state === "Resolved" || t.ticket_state === "Cancelled"
    ).length;
    const pendingCount = allDisplayedTickets.filter((t) => 
      t.ticket_status === "Pending"
    ).length;
    const totalStatus = openCount + closedCount + pendingCount;

    return {
      bu: { RO: roCount, TAS: tasCount, LPG: lpgCount },
      severity: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        total: totalSeverity,
        criticalPct: totalSeverity > 0 ? (criticalCount / totalSeverity * 100).toFixed(1) : "0.0",
        highPct: totalSeverity > 0 ? (highCount / totalSeverity * 100).toFixed(1) : "0.0",
        mediumPct: totalSeverity > 0 ? (mediumCount / totalSeverity * 100).toFixed(1) : "0.0",
        lowPct: totalSeverity > 0 ? (lowCount / totalSeverity * 100).toFixed(1) : "0.0",
      },
      status: {
        open: openCount,
        closed: closedCount,
        pending: pendingCount,
        total: totalStatus,
        openPct: totalStatus > 0 ? (openCount / totalStatus * 100).toFixed(1) : "0.0",
        closedPct: totalStatus > 0 ? (closedCount / totalStatus * 100).toFixed(1) : "0.0",
        pendingPct: totalStatus > 0 ? (pendingCount / totalStatus * 100).toFixed(1) : "0.0",
      },
    };
  }, [ticketsByState]);

  return (
    <div className="h-full flex flex-col">
      {/* Top stats - Business Units, Severity, and Status cards commented out; moved to dashboard header after Total Tickets */}
      {false && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
     
        {/* BU Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className=" rounded-xl p-2 border border-black bg-white"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center ">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
                <h3 className="text-sm font-semibold text-gray-800">Business Units</h3>
                <p className="text-md text-gray-500 font-bold">{statsData.bu.RO + statsData.bu.TAS + statsData.bu.LPG}</p>
            </div>
          </div>
            <div className="flex gap-4">
            <div className="text-center">
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">RO</p>
                  <div className="relative w-12 h-12 mb-1">
                    <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#dbeafe" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#2563eb" strokeWidth="4" fill="none"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - (statsData.bu.RO / (statsData.bu.RO + statsData.bu.TAS + statsData.bu.LPG) || 0))}`}
                        className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-700">{statsData.bu.RO}</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-blue-600">{((statsData.bu.RO / (statsData.bu.RO + statsData.bu.TAS + statsData.bu.LPG)) * 100 || 0).toFixed(1)}%</p>
                </div>
            </div>
            <div className="text-center">
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">TAS</p>
                  <div className="relative w-12 h-12 mb-1">
                    <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#fef3c7" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#ca8a04" strokeWidth="4" fill="none"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - (statsData.bu.TAS / (statsData.bu.RO + statsData.bu.TAS + statsData.bu.LPG) || 0))}`}
                        className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-yellow-700">{statsData.bu.TAS}</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-yellow-600">{((statsData.bu.TAS / (statsData.bu.RO + statsData.bu.TAS + statsData.bu.LPG)) * 100 || 0).toFixed(1)}%</p>
                </div>
            </div>
            <div className="text-center">
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">LPG</p>
                  <div className="relative w-12 h-12 mb-1">
                    <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#dcfce7" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#16a34a" strokeWidth="4" fill="none"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - (statsData.bu.LPG / (statsData.bu.RO + statsData.bu.TAS + statsData.bu.LPG) || 0))}`}
                        className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-green-700">{statsData.bu.LPG}</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-green-600">{((statsData.bu.LPG / (statsData.bu.RO + statsData.bu.TAS + statsData.bu.LPG)) * 100 || 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Severity Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className=" rounded-xl p-2 border border-black bg-white"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center ">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
                <h3 className="text-sm font-semibold text-gray-800">Severity Levels</h3>
                <p className="text-md text-gray-500 font-bold">{statsData.severity.total}</p>
            </div>
          </div>
            <div className="flex gap-2">
            <div className="text-center">
              <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">Crit</p>
                <div className="relative w-12 h-12 mb-1">
                  <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#fee2e2" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#dc2626" strokeWidth="4" fill="none"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - parseFloat(statsData.severity.criticalPct) / 100)}`}
                      className="transition-all duration-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-red-700">{statsData.severity.critical}</span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-red-600">{statsData.severity.criticalPct}%</p>
              </div>
            </div>
            <div className="text-center">
              <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">High</p>
                <div className="relative w-12 h-12 mb-1">
                  <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#fed7aa" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#ea580c" strokeWidth="4" fill="none"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - parseFloat(statsData.severity.highPct) / 100)}`}
                      className="transition-all duration-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-orange-700">{statsData.severity.high}</span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-orange-600">{statsData.severity.highPct}%</p>
              </div>
            </div>
            <div className="text-center">
              <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">Med</p>
                <div className="relative w-12 h-12 mb-1">
                  <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#fef3c7" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#ca8a04" strokeWidth="4" fill="none"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - parseFloat(statsData.severity.mediumPct) / 100)}`}
                      className="transition-all duration-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-yellow-700">{statsData.severity.medium}</span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-yellow-600">{statsData.severity.mediumPct}%</p>
              </div>
            </div>
            <div className="text-center">
              <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">Low</p>
                <div className="relative w-12 h-12 mb-1">
                  <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#dcfce7" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#16a34a" strokeWidth="4" fill="none"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - parseFloat(statsData.severity.lowPct) / 100)}`}
                      className="transition-all duration-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-green-700">{statsData.severity.low}</span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-green-600">{statsData.severity.lowPct}%</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Status Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className=" rounded-xl p-2 border border-black bg-white"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center ">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
                <h3 className="text-sm font-semibold text-gray-800">Status Overview</h3>
                <p className="text-md text-gray-500 font-bold">{statsData.status.total}</p>
            </div>
          </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">Open</p>
                  <div className="relative w-12 h-12 mb-1">
                    <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#dbeafe" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#2563eb" strokeWidth="4" fill="none"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - parseFloat(statsData.status.openPct) / 100)}`}
                        className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-700">{statsData.status.open}</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-blue-600">{statsData.status.openPct}%</p>
                </div>
              </div>
              <div className="text-center">
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">Closed</p>
                  <div className="relative w-12 h-12 mb-1">
                    <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#dcfce7" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#16a34a" strokeWidth="4" fill="none"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - parseFloat(statsData.status.closedPct) / 100)}`}
                        className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-green-700">{statsData.status.closed}</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-green-600">{statsData.status.closedPct}%</p>
                </div>
              </div>
              <div className="text-center">
                <div className="flex flex-col items-center">
                  <p className="text-xs font-medium text-gray-700 mb-1">Pending</p>
                  <div className="relative w-12 h-12 mb-1">
                    <svg className="transform -rotate-90 w-12 h-12">
                      <circle cx="24" cy="24" r="20" stroke="#fef3c7" strokeWidth="4" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="#ca8a04" strokeWidth="4" fill="none"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - parseFloat(statsData.status.pendingPct) / 100)}`}
                        className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-yellow-700">{statsData.status.pending}</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-yellow-600">{statsData.status.pendingPct}%</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      )}

      <div className="flex-1 overflow-hidden pt-3">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-3 h-full">
            {Object.entries(ticketsByState).map(([state, stateTickets]) => (
              <div key={state} className="flex flex-col h-full overflow-hidden">
                <KanbanColumn
                  title={state}
                  tickets={stateTickets}
                  count={stateTickets.length}
                  color=""
                  showOverdueFilter={state === "TO DO" || state === "IN PROGRESS" || state === "ON HOLD" || state === "RE OPEN"}
                  isOverdueFilterActive={showOverdueOnly[state as "TO DO" | "IN PROGRESS" | "ON HOLD" | "RE OPEN" | "ON COMPLETED"] || false}
                  onToggleOverdueFilter={() => onToggleOverdueFilter?.(state as "TO DO" | "IN PROGRESS" | "ON HOLD" | "RE OPEN" | "ON COMPLETED")}
                >
                  <Droppable
                    droppableId={state}
                    isDropDisabled={
                      mergeMode ||
                      (!canDragFromAnyColumn &&
                        !ALLOWED_DRAG_COLUMNS.includes(state))
                    }
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 p-2 rounded-lg transition-colors flex-1 overflow-y-auto ${
                          snapshot.isDraggingOver && !mergeMode
                            ? "bg-blue-50 border-2 border-blue-200 border-dashed"
                            : "bg-transparent"
                        }`}
                      >
                        
                        {stateTickets.map((ticket, index) => {
                          // Full-drag roles: can drag from any column. Others: TO DO, IN PROGRESS, ON HOLD, ON COMPLETED.
                          const isDragDisabled = canDragFromAnyColumn
                            ? mergeMode
                            : mergeMode || !ALLOWED_DRAG_COLUMNS.includes(state);
                        
                          return (
                          <Draggable
                            key={ticket.id}
                            draggableId={ticket.id.toString()}
                            index={index}
                            isDragDisabled={isDragDisabled}
                          >
                            {(providedDraggable, snapshotDraggable) => (
                              <div
                                ref={providedDraggable.innerRef}
                                {...providedDraggable.draggableProps}
                                {...(!mergeMode
                                  ? providedDraggable.dragHandleProps
                                  : {})}
                                style={{
                                  ...providedDraggable.draggableProps.style,
                                  transform: snapshotDraggable.isDragging
                                    ? `${
                                        providedDraggable.draggableProps.style
                                          ?.transform || ""
                                      } rotate(5deg)`
                                    : providedDraggable.draggableProps.style
                                        ?.transform,
                                }}
                              >
                                <motion.div
                                  initial={false}
                                  animate={{
                                    scale: snapshotDraggable.isDragging
                                      ? 1.05
                                      : 1,
                                    boxShadow: snapshotDraggable.isDragging
                                      ? "0 8px 25px rgba(0,0,0,0.15)"
                                      : "0 1px 3px rgba(0,0,0,0.1)",
                                  }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <TicketCard
                                    ticket={ticket}
                                    index={index}
                                    isDragging={snapshotDraggable.isDragging}
                                    onViewDetails={onViewTicketDetails}
                                    onEditTicket={onEditTicket}
                                    onDeleteTicket={() =>
                                      onDeleteTicket(ticket.id.toString())
                                    }
                                    mergeMode={mergeMode}
                                    isSelected={selectedTickets.includes(
                                      ticket.id.toString()
                                    )}
                                    canDelete={canDeleteTickets}
                                    onSelectionChange={() =>
                                      onTicketSelection?.(ticket.id.toString())
                                    }
                                    onViewMergedTicketDetails={
                                      onViewMergedTicketDetails
                                    }
                                  />
                                </motion.div>
                              </div>
                            )}
                          </Draggable>
                          );
                        })}
                        {provided.placeholder}

                        {stateTickets.length === 0 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-8 text-gray-400 flex items-center justify-center h-full"
                          >
                            <p className="text-xs">
                              {snapshot.isDraggingOver && !mergeMode
                                ? "Drop ticket here"
                                : mergeMode
                                ? "Select mode active"
                                : "No tickets"}
                            </p>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </KanbanColumn>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export const KanbanBoard = React.memo(KanbanBoardComponent);