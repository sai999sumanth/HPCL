import React from "react";
import { Card } from "@/@/components/ui/card";
import { Calendar, Hash, Tag, Copy } from "lucide-react";
import { Ticket } from "../types/ticket";
import dayjs from "dayjs";
import { toast } from "sonner";

/** e.g. "TKT-TAS_1630_020326_000002" -> "TAS_1630" */
function getShortTicketId(ticketId: string | number | undefined): string {
  if (ticketId == null) return "—";
  const s = String(ticketId).trim();
  const withoutPrefix = s.startsWith("TKT-") ? s.slice(4) : s;
  const parts = withoutPrefix.split("_");
  if (parts.length >= 2) return `${parts[0]}_${parts[1]}`;
  return withoutPrefix || "—";
}

export const TICKETING2_STAGES = [
  "Open",
  "Escalated",
  "Updated by Initiator",
  "Returned by Occ",
  "Reviewed by Occ",
] as const;
export type Ticketing2StageId = (typeof TICKETING2_STAGES)[number];

/** Map API ticket_state to our 5 stages (Open, Escalated, UpdatedByInitiator, ReturnedByOcc, ReviewedByOcc) */
export function getTicketStage(ticket: Ticket): Ticketing2StageId {
  const state = ticket.ticket_state;
  const status = ticket.ticket_status;
  // New ticket states map directly to stages
  if (state === "Open") return "Open";
  if (state === "Escalated") return "Escalated";
  // Support both legacy enum keys and new spaced values
  if (
    state === "Updated By Initiator" ||
    (state as any) === "UpdatedByInitiator" ||
    state === "Updated" ||
    state === "Completed"
  ) {
    return "Updated by Initiator";
  }
  if (
    state === "Returned By Occ" ||
    state === "Returned By OCC" ||
    (state as any) === "ReturnedByOcc" ||
    state === "Reopen"
  ) {
    return "Returned by Occ";
  }
  if (
    state === "Reviewed By Occ" ||
    state === "Reviewed By OCC" ||
    (state as any) === "ReviewedByOcc" ||
    state === "Resolved"
  ) {
    return "Reviewed by Occ";
  }
  // Legacy mapping for old ticket_state values
  if (status === "Closed") return "Reviewed by Occ";
  if (state === "OnCompleted") return "Reviewed by Occ";
  if (state === "ReOpen") return "Returned by Occ";
  if (state === "OnHold") return "Returned by Occ";
  if (status === "Pending" || state === "InProgress") return "Escalated";
  return "Open";
}

/** Map our 5 stages back to API ticket_state and ticket_status (for drag-and-drop update) */
export function getStateAndStatusFromStage(
  stageId: Ticketing2StageId
): { ticket_state: Ticket["ticket_state"]; ticket_status: Ticket["ticket_status"] } {
  switch (stageId) {
    case "Open":
      return { ticket_state: "Open", ticket_status: "Open" };
    case "Escalated":
      return { ticket_state: "Escalated", ticket_status: "Pending" };
    case "Updated by Initiator":
      return { ticket_state: "Updated By Initiator", ticket_status: "Open" };
    case "Returned by Occ":
      return { ticket_state: "Returned By Occ", ticket_status: "Open" };
    case "Reviewed by Occ":
      return { ticket_state: "Reviewed By Occ", ticket_status: "Closed" };
    default:
      return { ticket_state: "Open", ticket_status: "Open" };
  }
}

/** Check if ticket is overdue (end date in the past). Used for overdue-only filter. */
export function isTicketOverdue(ticket: Ticket): boolean {
  const endDate = ticket.ticket_end_date;
  if (!endDate) return false;
  const end = dayjs(endDate).startOf("day");
  const today = dayjs().startOf("day");
  return end.isBefore(today);
}

function formatDueText(ticket: Ticket): { text: string; overdue: boolean } {
  const endDate = ticket.ticket_end_date;
  if (!endDate) return { text: "—", overdue: false };
  const end = dayjs(endDate);
  const today = dayjs().startOf("day");
  const diff = end.diff(today, "day");
  if (diff > 0) return { text: `Due in ${diff} days`, overdue: false };
  if (diff === 0) return { text: "Due today", overdue: false };
  return { text: `Overdue by ${Math.abs(diff)} days`, overdue: true };
}

function arr(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function joinNonEmpty(tickets: string[], sep = " · "): string {
  return tickets.filter(Boolean).join(sep) || "—";
}

const SEVERITY_TEXT_COLORS: Record<string, string> = {
  Low: "text-[#22C55E]",
  Medium: "text-[#F59E0B]",
  High: "text-[#F97316]",
  Critical: "text-[#DC2626]",
  Info: "text-[#3B82F6]",
};

function getSeverityTextColor(severity: Ticket["ticket_severity"] | string | undefined): string {
  if (!severity) return SEVERITY_TEXT_COLORS.Info;
  return SEVERITY_TEXT_COLORS[severity] ?? SEVERITY_TEXT_COLORS.Info;
}

interface Ticketing2StageCardProps {
  ticket: Ticket;
  onClick?: () => void;
  /** Controls visual style for draggable vs non-draggable cards. Defaults to true. */
  isDraggable?: boolean;
  /** True only when rendering inside the "Reviewed by OCC" board column. */
  isReviewedColumn?: boolean;
}

export function Ticketing2StageCard({
  ticket,
  onClick,
  isDraggable = true,
  isReviewedColumn = false,
}: Ticketing2StageCardProps) {
  const due = formatDueText(ticket);
  const dueTextDisplay = isReviewedColumn ? "Reviewed" : due.text;
  const dueLabelDisplay = isReviewedColumn ? "Review status" : "Due/overdue";
  const dueTextColorClass = isReviewedColumn
    ? "text-slate-800"
    : due.overdue
      ? "text-red-600 font-medium"
      : "text-slate-800";
  const dueDetailTextColorClass = isReviewedColumn
    ? "text-slate-900"
    : due.overdue
      ? "text-red-600 font-medium"
      : "text-slate-900";
  const locationNames = arr(ticket.location_name);
  const sapIdDisplay = joinNonEmpty(arr(ticket.sap_id)) || "—";
  const category = joinNonEmpty(arr(ticket.category));
  const subcategory = joinNonEmpty(arr(ticket.sub_category));
  const typeDisplay =
    category || subcategory ? `${category}${category && subcategory ? " / " : ""}${subcategory}` : "—";
  const zones = arr(ticket.zone);
  const statusDisplay = ticket.ticket_status || ticket.ticket_state || "—";
  const locationOrZone =
    locationNames.length > 0
      ? locationNames[0]
      : zones.length > 0
        ? `Escalated to ${zones.join(", ")}`
        : statusDisplay;

  const iconClass = "h-3 w-3 flex-shrink-0 text-slate-600";
  const textClass = "text-[11px]";
  const fullTicketId = String(ticket.ticket_id ?? "");

  const severityLabel = ticket.ticket_severity ?? "Info";
  const severityTextColor = getSeverityTextColor(ticket.ticket_severity);

  const baseCardClasses =
    "group/card relative rounded-md border p-2 shadow-sm text-left text-slate-900 min-w-0 overflow-visible w-full max-w-full transition-[transform,box-shadow] duration-200 ease-out hover:shadow-lg hover:z-20";
  const draggableClasses = "bg-white cursor-pointer hover:scale-105";
  const nonDraggableClasses = "bg-slate-100 cursor-not-allowed";

  return (
    <Card
        className={`${baseCardClasses} ${
          isDraggable ? draggableClasses : nonDraggableClasses
        }`}
        onClick={onClick}
      >
        {/* Default: compact view (stays in flow so card height doesn't change on hover) */}
        <div className="space-y-1 min-w-0 overflow-hidden group-hover/card:invisible">
          <div className="flex items-center gap-1.5 min-w-0">
            <Hash className={iconClass} />
            <span className={`${textClass} font-medium truncate min-w-0 flex-1`} title={sapIdDisplay}>
              {sapIdDisplay}
            </span>
            <div className="flex items-center gap-0.5 min-w-0 flex-shrink-0 group/ticket">
              <span className={`${textClass} font-semibold text-slate-900 truncate max-w-[72px] cursor-default`}>
                {getShortTicketId(ticket.ticket_id)}
              </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (fullTicketId) {
                  navigator.clipboard.writeText(fullTicketId).then(
                    () => toast.success("Ticket ID copied"),
                    () => toast.error("Failed to copy")
                  );
                }
              }}
              className="opacity-0 group-hover/ticket:opacity-100 p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-opacity focus:opacity-100 focus:outline-none"
              title="Copy ticket ID"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <Tag className={iconClass} />
          <span className={`${textClass} text-slate-900 truncate min-w-0`} title={typeDisplay}>
            {typeDisplay}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`flex items-center gap-1 ${textClass} ${dueTextColorClass}`}>
            <Calendar className={iconClass} />
            {dueTextDisplay}
          </span>
          <span className={`${textClass} text-slate-900 truncate min-w-0`} title={locationOrZone}>
            {statusDisplay}
            {locationOrZone && locationOrZone !== statusDisplay ? ` · ${locationOrZone}` : ""}
          </span>
        </div>
      </div>

      {/* Hover: labeled view overlays without moving cards below */}
      <div className="absolute top-0 left-0 right-0 z-10 hidden group-hover/card:block space-y-1.5 min-w-0 p-2 rounded-md border bg-white shadow-lg">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`${textClass} text-slate-900 shrink-0`}>SAP ID</span>
            <span className={`${textClass} font-medium text-slate-800 truncate min-w-0`} title={sapIdDisplay}>
              {sapIdDisplay}
            </span>
          </div>
          <div className="flex items-center gap-0.5 min-w-0 group/ticket">
            <span className={`${textClass} text-slate-900 shrink-0`}>Ticket ID</span>
            <span className={`${textClass} font-semibold text-slate-900 break-all cursor-default`}>
              {fullTicketId || "—"}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (fullTicketId) {
                  navigator.clipboard.writeText(fullTicketId).then(
                    () => toast.success("Ticket ID copied"),
                    () => toast.error("Failed to copy")
                  );
                }
              }}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 focus:outline-none flex-shrink-0"
              title="Copy ticket ID"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="min-w-0">
          <span className={`${textClass} text-slate-900 block`}>Category / Subcategory</span>
          <span className={`${textClass} text-slate-900 block break-words mt-0.5`} title={typeDisplay}>
            {typeDisplay}
          </span>
        </div>
        <div className="flex items-start gap-1.5 min-w-0 flex-wrap">
          <span className={`${textClass} text-slate-900 shrink-0`}>Severity</span>
          <span className={`${textClass} font-medium ${severityTextColor}`}>{severityLabel}</span>
        </div>
        <div className="flex items-start gap-1.5 min-w-0 flex-wrap">
          <span className={`${textClass} text-slate-900 shrink-0`}>{dueLabelDisplay}</span>
          <span className={`${textClass} ${dueDetailTextColorClass}`}>
            {dueTextDisplay}
          </span>
        </div>
        <div className="min-w-0">
          <span className={`${textClass} text-slate-900 block`}>Status</span>
          <span className={`${textClass} text-slate-900 block break-words mt-0.5`} title={locationOrZone}>
            {statusDisplay}
            {locationOrZone && locationOrZone !== statusDisplay ? ` · ${locationOrZone}` : ""}
          </span>
        </div>
      </div>
    </Card>
  );
}
