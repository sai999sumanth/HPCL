import React, { useState } from "react";
import { Card } from "@/@/components/ui/card";
import { Badge } from "@/@/components/ui/badge";
import { Button } from "@/@/components/ui/button";
import {
  Eye,
  Edit3,
  Trash2,
  Calendar,
  Folder,
  Copy,
  GripVertical,
  CheckCircle2,
  Info,
  Merge,
  Flag,
} from "lucide-react";
import { Ticket } from "./types/ticket";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/@/components/ui/popover";
import { useNavigate } from "react-router-dom";

interface TicketCardProps {
  ticket: Ticket;
  index: number;
  isDragging?: boolean;
  showStateInListView?: boolean;
  onViewDetails: (ticket: Ticket) => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticketId: string) => void;
  mergeMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: () => void;
  onViewMergedTicketDetails?: (ticketId: string) => void;
  canDelete?: boolean;
}

const severityColors = {
  Low: "bg-green-100 text-green-700 border-green-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  High: "bg-orange-100 text-orange-700 border-orange-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

const ticketStateColors: Record<Ticket["ticket_state"], string> = {
  ToDo: "bg-gray-100 text-gray-700 border-gray-300",
  InProgress: "bg-blue-100 text-blue-700 border-blue-300",
  Resolved: "bg-green-100 text-green-700 border-green-300",
  OnHold: "bg-orange-100 text-orange-700 border-orange-300",
  Cancelled: "bg-red-100 text-red-700 border-red-300",
  ReOpen: "bg-purple-100 text-purple-700 border-purple-300",
  OnCompleted: "bg-teal-100 text-teal-700 border-teal-300",
  Open: "bg-blue-100 text-blue-700 border-blue-300",
  Escalated: "bg-amber-100 text-amber-700 border-amber-300",
  Updated: "bg-sky-100 text-sky-700 border-sky-300",
  Reopen: "bg-purple-100 text-purple-700 border-purple-300",
  "Updated By Initiator": "bg-sky-100 text-sky-700 border-sky-300",
  "Returned By Occ": "bg-orange-100 text-orange-700 border-orange-300",
  "Reviewed By Occ": "bg-teal-100 text-teal-700 border-teal-300",
  "Returned By OCC": "bg-orange-100 text-orange-700 border-orange-300",
  "Reviewed By OCC": "bg-teal-100 text-teal-700 border-teal-300",
};

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  index,
  isDragging = false,
  showStateInListView = false,
  onViewDetails,
  onEditTicket,
  onDeleteTicket,
  mergeMode = false,
  isSelected = false,
  onSelectionChange,
  onViewMergedTicketDetails,
  canDelete = true,
}) => {
  const navigate = useNavigate();
  const [showMergeHistory, setShowMergeHistory] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Jun 12";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
      });
    } catch {
      return "Jun 12";
    }
  };

  const copyToClipboard = (
    e: React.MouseEvent,
    text: string,
    fieldName: string
  ) => {
    e.stopPropagation();
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${fieldName} copied!`))
      .catch(() => toast.error(`Failed to copy ${fieldName}.`));
  };

  const handleCardClick = () => {
    if (mergeMode && onSelectionChange) {
      onSelectionChange();
    } else if (onEditTicket) {
      onEditTicket(ticket);
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  const handleMergedTicketClick = (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    if (onViewMergedTicketDetails) {
      onViewMergedTicketDetails(ticketId);
    } else {
      copyToClipboard(e, ticketId, "Merged Ticket ID");
    }
  };

  const handleOpenTicketById = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    try {
      if (!ticketId || !ticketId.trim()) {
        toast.error("Invalid ticket ID");
        return;
      }
      // If user clicked THIS card's ticket_id, reuse the same edit flow (fetch + state)
      if (ticketId === ticket.ticket_id) {
        onEditTicket(ticket);
        return;
      }

      // Otherwise (parent/subtask links), navigate to edit page and let it load by id
      navigate(`/settings/edit-ticketing/${ticketId}`);
    } catch (error: any) {
      console.error("Failed to open ticket:", error);
      toast.error(
        error?.response?.data?.message || "Failed to load ticket details"
      );
    }
  };

  const hasMergedTickets =
    ticket.merge_history && ticket.merge_history.length > 0;

  // Check if ticket is overdue
  const isOverdue = () => {
    if (!ticket.ticket_end_date) return false;
    if (ticket.ticket_state !== "ToDo" && ticket.ticket_state !== "InProgress" && ticket.ticket_state !== "OnHold") return false;
    
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

  const ticketIsOverdue = isOverdue();

  return (
    <Card
      className={`p-3 bg-white border transition-all duration-200 shadow-sm cursor-pointer overflow-visible relative ${
        isDragging ? "shadow-lg border-blue-300 bg-blue-50" : ""
      } ${
        mergeMode && isSelected
          ? "border-purple-400 bg-purple-50 shadow-md ring-2 ring-purple-200"
          : "border-gray-200 hover:border-gray-300"
      } ${
        !mergeMode && onViewDetails ? "hover:shadow-md hover:bg-gray-50" : ""
      } ${
        mergeMode && !isSelected ? "hover:shadow-md hover:bg-gray-50" : ""
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {!showStateInListView && !mergeMode && (
            <div className="cursor-grab" onClick={(e) => e.stopPropagation()}>
              <GripVertical className="h-3 w-3 text-gray-400" />
            </div>
          )}

          {mergeMode && (
            <div
              className={`flex-shrink-0 transition-colors duration-200 ${
                isSelected ? "text-purple-600" : "text-gray-400"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <CheckCircle2
                className={`h-4 w-4 ${
                  isSelected ? "fill-purple-600 text-white" : ""
                }`}
              />
            </div>
          )}

          <div className="w-5 h-5 bg-yellow-400 rounded flex items-center justify-center shrink-0">
            <Folder className="h-3 w-3 text-yellow-800" />
          </div>
          <span
            className="text-xs font-semibold text-gray-700 truncate"
            title={ticket.bu}
          >
            {ticket.bu}
          </span>
          <Badge
            className={`text-xs px-1 py-0 font-medium ${
              severityColors[ticket.ticket_severity] || severityColors.Low
            } shrink-0`}
          >
            {ticket.ticket_severity}
          </Badge>
          {ticketIsOverdue && (
            <span title="Ticket is overdue" className="shrink-0 text-red-600">
              <Flag className="h-4 w-4 text-red-600" fill="currentColor" />
            </span>
          )}
        </div>

        {!mergeMode && (
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Merged Icon - always visible when not in merge mode */}
            {hasMergedTickets && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="p-1 hover:bg-blue-50 rounded"
                    title="View Merge History"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Merge className="h-5 w-5 p-0 hover:bg-gray-100" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-900">
                      Merged Tickets
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {ticket.merge_history.map((merge, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-gray-50 rounded-md border"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex flex-col gap-1">
                              {[...new Set(merge.merge_ticket_id || [])]
                                .length > 0 ? (
                                [...new Set(merge.merge_ticket_id || [])].map(
                                  (ticketId, ticketIdx) => (
                                    <button
                                      key={ticketIdx}
                                      onClick={(e) =>
                                        handleMergedTicketClick(e, ticketId)
                                      }
                                      className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline text-left transition-colors duration-150 cursor-pointer"
                                      title={`Click to view details of ${ticketId}`}
                                    >
                                      {ticketId}
                                    </button>
                                  )
                                )
                              ) : (
                                <span className="text-xs font-medium text-blue-600">
                                  Merged Ticket #{idx + 1}
                                </span>
                              )}
                            </div>
                            {merge.processed_time && (
                              <span className="text-xs text-gray-500">
                                {formatDate(merge.processed_time)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 hover:bg-gray-100"
                onClick={(e) =>
                  handleActionClick(e, () =>
                    onDeleteTicket(ticket.id.toString())
                  )
                }
                title="Delete ticket"
              >
                <Trash2 className="h-3 w-3 text-gray-500 hover:text-red-600" />
              </Button>
            )}
          </div>
        )}
      </div>
      {(ticket.sap_id || (ticket.linked_alert_id && Array.isArray(ticket.linked_alert_id) && ticket.linked_alert_id.length > 0) || (ticket.linked_alert_id && typeof ticket.linked_alert_id === 'string' && ticket.linked_alert_id.trim())) && (
  <div className="mb-1 flex items-center gap-2 text-xs text-gray-700 flex-wrap">

    {/* SAP ID */}
    {ticket.sap_id && (
      <span className="flex items-center gap-1">
        <span className="font-medium text-gray-800">SAP ID:</span>
        <span className="truncate">
          {Array.isArray(ticket.sap_id) ? ticket.sap_id.join(', ') : ticket.sap_id}
        </span>
      </span>
    )}

    {ticket.sap_id && ((Array.isArray(ticket.linked_alert_id) && ticket.linked_alert_id.length > 0) || (typeof ticket.linked_alert_id === 'string' && ticket.linked_alert_id.trim())) && (
      <span className="text-gray-400">|</span>
    )}

{(() => {
  // Calculate linked alerts count properly
  let linkedAlertsCount = 0;
  
  if (Array.isArray(ticket.linked_alert_id)) {
    // If it's an array, filter out empty/null values and get length
    linkedAlertsCount = ticket.linked_alert_id.filter(id => id != null && id !== '' && id !== undefined).length;
  } else if (typeof ticket.linked_alert_id === 'string' && ticket.linked_alert_id.trim()) {
    // If it's a string, split by comma and filter out empty values
    linkedAlertsCount = ticket.linked_alert_id.split(',').filter(id => id.trim() !== '').length;
  }

  // Only show if count > 0
  if (linkedAlertsCount === 0) return null;
  
  return (
    <span className="flex items-center gap-1">
      <span className="font-medium text-gray-800">
        Linked Alerts - {linkedAlertsCount}
      </span>
    </span>
  );
})()}

  </div>
)}
      {/* Parent Ticket ID - Show only if subtask_id is empty/null, but parent_id exists */}
      {(() => {
        const hasSubtasks = ticket.subtask_id && 
          Array.isArray(ticket.subtask_id) && 
          ticket.subtask_id.some((id) => id && id.trim() !== "");
        
        const hasParent = ticket.parent_id && ticket.parent_id.trim() !== "";
        
        if (hasParent && !hasSubtasks) {
          return (
            <div className="mb-1 overflow-visible">
              <div className="flex items-start gap-1 text-xs text-gray-500 overflow-visible">
                <button
                  onClick={(e) =>
                    handleOpenTicketById(e, ticket.parent_id || "")
                  }
                  className="group font-medium text-xs text-gray-500 leading-tight hover:text-gray-700 hover:underline focus:outline-none flex items-start gap-1 w-full sm:truncate sm:items-center cursor-pointer"
                  title={`Click to open ticket ${ticket.parent_id}`}
                >
                  <span className="break-words break-all sm:truncate sm:whitespace-nowrap" style={{ 
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    lineHeight: '1.4',
                    maxWidth: '100%'
                  }}>
                    {ticket.parent_id}
                  </span>
                    <span
    role="button"
    tabIndex={0}
    onClick={(e) => {
      e.stopPropagation();
      copyToClipboard(e, ticket.parent_id, "Ticket ID");
    }}
    onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0 mt-0.5 sm:mt-0"
    title="Copy ticket ID"
  >
    <Copy className="h-2.5 w-2.5 text-gray-400 hover:text-blue-600" />
  </span>
                  {/* <Copy className="h-2.5 w-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 sm:mt-0" /> */}
                </button>
              </div>
              {/* Curved arrow connecting parent to child - Inverted L shape */}
              <div className="ml-0 mt-0.5 mb-0.5 flex-shrink-0 overflow-visible">
                <svg
                  width="35"
                  height="25"
                  viewBox="0 0 35 25"
                  className="text-gray-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Inverted L: horizontal right, then vertical down */}
                  <path
                    d="M 2 2 L 18 2 Q 23 2 23 7 L 23 20"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Arrowhead pointing down */}
                  <path
                    d="M 20 17 L 23 20 L 26 17"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="mb-1.5">
        <button
          onClick={(e) =>
            handleOpenTicketById(e, ticket.ticket_id || `TICK-${ticket.id}`)
          }
          className="group font-medium text-xs text-gray-900 leading-tight hover:text-gray-700 hover:underline focus:outline-none flex items-start gap-1 w-full sm:truncate sm:items-center cursor-pointer"
          title={`Click to open ticket ${ticket.ticket_id || `TICK-${ticket.id}`}`}
        >
          <span className="break-words break-all sm:truncate sm:whitespace-nowrap" style={{ 
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: '1.4',
            maxWidth: '100%'
          }}>
            {ticket.ticket_id || `TICK-${ticket.id}`}
          </span>
          {/* <Copy className="h-2.5 w-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 sm:mt-0" /> */}
        <span
    role="button"
    tabIndex={0}
    onClick={(e) =>
      copyToClipboard(
        e,
        ticket.ticket_id || `TICK-${ticket.id}`,
        "Ticket ID"
      )
    }
    onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
  >
    <Copy className="h-2.5 w-2.5 text-gray-400 hover:text-blue-600" />
  </span>
        </button>
      </div>

{ticket.subtask_id && Array.isArray(ticket.subtask_id) && ticket.subtask_id.length > 0 && (() => {
  const validSubtasks = ticket.subtask_id
    .filter((id) => id && id.trim() !== "")
    .map((id) => id.trim());

  if (validSubtasks.length === 0) return null;

  return (
    <div className="mb-1.5 overflow-visible">
      <div className="flex items-center gap-1 text-xs text-gray-500 overflow-visible">
        {/* L-shaped arrow for subtasks */}
        <div className="flex-shrink-0 overflow-visible">
          <svg
            width="35"
            height="25"
            viewBox="0 0 35 25"
            className="text-gray-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* L: vertical down, then horizontal right */}
            <path
              d="M 2 2 L 2 15 Q 2 20 7 20 L 30 20"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Arrowhead pointing right */}
            <path
              d="M 27 17 L 30 20 L 27 23"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="flex items-start gap-1 flex-wrap min-w-0">
          {validSubtasks.map((subtaskId, idx) => (
            <button
              key={idx}
              onClick={(e) =>
                handleOpenTicketById(e, subtaskId)
              }
              className="group font-medium text-xs text-gray-600 leading-tight hover:text-gray-800 hover:underline focus:outline-none flex items-start gap-1 w-full sm:w-auto sm:truncate sm:items-center cursor-pointer"
              title={`Click to open ticket ${subtaskId}`}
            >
              <span className="break-words break-all sm:truncate sm:whitespace-nowrap" style={{ 
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                lineHeight: '1.4',
                maxWidth: '100%'
              }}>
                {subtaskId}
              </span>
              {/* <Copy className="h-2.5 w-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 sm:mt-0" /> */}
         <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(e, subtaskId, "Ticket ID");
        }}
        onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0 mt-0.5 sm:mt-0"
        title="Copy ticket ID"
      >
        <Copy className="h-2.5 w-2.5 text-gray-400 hover:text-blue-600" />
      </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
})()}

      {showStateInListView && (
        <div className="mb-2">
          <Badge
            className={`text-xs px-1 py-0 font-medium ${
              ticketStateColors[ticket.ticket_state] || ticketStateColors.ToDo
            }`}
          >
            State: {ticket.ticket_state}
          </Badge>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {/* <Badge
          variant="outline"
          className="text-xs px-1 py-0 bg-white border-gray-300 text-gray-700 font-medium"
        >
          {ticket.ticket_status || "Open"}
        </Badge> */}
      <Badge
  variant="outline"
  className="text-xs px-1 py-0 bg-white border-gray-300 text-gray-700 font-medium"
>
  {(() => {
    const state = (ticket.ticket_state || "").toLowerCase().replace(/\s+/g, "");
    // Resolved/Cancelled show "Close"; ON COMPLETED shows "Open" on card (still counted in header CLOSED)
    const isClosed = ["resolved", "cancelled"].some((s) => state === s);
    const isOpen = ["todo", "inprogress", "onhold", "reopen", "oncompleted"].some((s) => state === s);
    return isClosed ? "Close" : isOpen ? "Open" : ticket.ticket_status || "Open";
  })()}
</Badge>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(ticket.created_at)}</span>
        </div>
      </div>

    </Card>
  );
};
