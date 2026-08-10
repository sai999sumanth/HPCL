import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/@/components/ui/drawer";
import { Button } from "@/@/components/ui/button";
import { Badge } from "@/@/components/ui/badge";
import { Ticket } from "./types/ticket";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  ChevronRight,
  FileText,
  History,
  Info,
  Link as LinkIcon,
  ListChecks,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Tag,
  User,
  Users,
  Settings2,
  Building2,
  X,
  Mail,
} from "lucide-react";
import { ScrollArea } from "@/@/components/ui/scroll-area";

interface TicketDetailsDrawerProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const severityColors: Record<Ticket["ticket_severity"], string> = {
  Low: "bg-green-100 text-green-700 border-green-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  High: "bg-orange-100 text-orange-700 border-orange-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

const statusColors: Record<Ticket["ticket_status"], string> = {
  Open: "bg-blue-100 text-blue-700 border-blue-200",
  Closed: "bg-gray-100 text-gray-700 border-gray-200",
  Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const stateColors: Record<Ticket["ticket_state"], string> = {
  ToDo: "bg-gray-100 text-gray-700 border-gray-200",
  InProgress: "bg-blue-100 text-blue-700 border-blue-200",
  Resolved: "bg-green-100 text-green-700 border-green-200",
  OnHold: "bg-orange-100 text-orange-700 border-orange-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  ReOpen: "bg-purple-100 text-purple-700 border-purple-200",
  OnCompleted: "bg-teal-100 text-teal-700 border-teal-200",
  Open: "bg-blue-100 text-blue-700 border-blue-200",
  Escalated: "bg-amber-100 text-amber-700 border-amber-200",
  Updated: "bg-sky-100 text-sky-700 border-sky-200",
  Reopen: "bg-purple-100 text-purple-700 border-purple-200",
  "Updated By Initiator": "bg-sky-100 text-sky-700 border-sky-200",
  "Returned By Occ": "bg-orange-100 text-orange-700 border-orange-200",
  "Reviewed By Occ": "bg-teal-100 text-teal-700 border-teal-200",
  "Returned By OCC": "bg-orange-100 text-orange-700 border-orange-200",
  "Reviewed By OCC": "bg-teal-100 text-teal-700 border-teal-200",
};

const DetailItem: React.FC<{
  icon: React.ElementType;
  label: string;
  value?: string | React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}> = ({ icon: Icon, label, value, fullWidth, className }) => {
  if (!value && typeof value !== "number" && value !== false) return null;
  return (
    <div
      className={`py-0.5 ${
        fullWidth ? "col-span-1 sm:col-span-2" : "col-span-1"
      } ${className}`}
    >
      <div className="flex items-center text-2xs text-gray-500 mb-0">
        <Icon className="h-2.5 w-2.5 mr-1 shrink-0" />
        <span>{label}</span>
      </div>
      {typeof value === "string" || typeof value === "number" ? (
        <p className="text-xs text-gray-800 break-words pl-[calc(0.25rem+10px)]">
          {String(value)}
        </p>
      ) : (
        <div className="text-xs text-gray-800 pl-[calc(0.25rem+10px)]">
          {value}
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="border rounded-md p-1.5 bg-gray-50/30">
    <h3 className="text-2xs font-semibold text-gray-500 mb-0.5 uppercase tracking-wider px-0.5">
      {title}
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-1.5">{children}</div>
  </div>
);

export function TicketDetailsDrawer({
  ticket,
  open,
  onOpenChange,
}: TicketDetailsDrawerProps) {
  if (!ticket) return null;

  const formatDateSafe = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      return format(parseISO(dateString), "MMM dd, yyyy HH:mm");
    } catch (e) {
      return dateString;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="w-full md:w-[700px] p-0 flex flex-col h-full">
        {" "}
        {/* Width control */}
        <DrawerHeader className="p-3 pb-2 border-b flex flex-row items-center justify-between space-y-0 sticky top-0 bg-background z-10">
          <div>
            <DrawerTitle className="text-base font-semibold text-gray-900 flex items-center">
              <Info className="h-4 w-4 mr-1.5 text-blue-600 shrink-0" />
              Ticket: {ticket.ticket_id}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-gray-600 mt-0.5 ml-[calc(0.375rem+16px)]">
              {ticket.summary}
            </DrawerDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 p-0"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>
        <ScrollArea className="flex-grow overflow-y-auto">
          <div className="p-3 space-y-1.5">
            <Section title="Core Information">
              <DetailItem
                icon={ListChecks}
                label="Status"
                value={
                  <Badge
                    className={`text-2xs px-1 py-0 ${
                      statusColors[ticket.ticket_status]
                    }`}
                  >
                    {ticket.ticket_status}
                  </Badge>
                }
              />
              <DetailItem
                icon={ShieldAlert}
                label="Severity"
                value={
                  <Badge
                    className={`text-2xs px-1 py-0 ${
                      severityColors[ticket.ticket_severity]
                    }`}
                  >
                    {ticket.ticket_severity}
                  </Badge>
                }
              />
              <DetailItem
                icon={Briefcase}
                label="State"
                value={
                  <Badge
                    className={`text-2xs px-1 py-0 ${
                      stateColors[ticket.ticket_state]
                    }`}
                  >
                    {ticket.ticket_state}
                  </Badge>
                }
              />
              <DetailItem
                icon={Building2}
                label="Business Unit (BU)"
                value={ticket.bu}
              />
              <DetailItem
                icon={MapPin}
                label="Location"
                value={Array.isArray(ticket.location_name) ? ticket.location_name.join(', ') : ticket.location_name}
              />
              <DetailItem icon={Tag} label="SAP ID" value={ticket.sap_id} />
              <DetailItem
                icon={Briefcase}
                label="Category"
                value={ticket.category || "N/A"}
              />
              <DetailItem
                icon={AlertTriangle}
                label="Alert Type"
                value={ticket.alert_type || "N/A"}
              />
              <DetailItem
                icon={Tag}
                label="Ticket Name"
                value={ticket.ticket_name || "N/A"}
              />
            </Section>

            <Section title="Timeline & People">
              <DetailItem
                icon={CalendarDays}
                label="Created At"
                value={formatDateSafe(ticket.created_at)}
              />
              <DetailItem
                icon={CalendarDays}
                label="Updated At"
                value={formatDateSafe(ticket.updated_at)}
              />
              <DetailItem
                icon={CalendarDays}
                label="Start Date"
                value={formatDateSafe(ticket.start_date)}
              />
              <DetailItem
                icon={CalendarDays}
                label="End Date"
                value={formatDateSafe(ticket.ticket_end_date)}
              />
              <DetailItem
                icon={User}
                label="Assignee"
                value={ticket.assignee || "N/A"}
              />
              <DetailItem
                icon={Users}
                label="Reporter"
                value={ticket.reporter || "N/A"}
              />
              <DetailItem
                icon={Mail}
                label="Reporter Email"
                value={ticket.reporter_email || "N/A"}
              />
            </Section>

            <Section title="Details">
              <DetailItem
                icon={FileText}
                label="Description"
                value={ticket.description || "No description provided."}
                fullWidth
              />
              <DetailItem
                icon={MessageSquare}
                label="Comment"
                value={ticket.comment || "No comments."}
                fullWidth
              />
            </Section>

            <Section title="Technical Information">
              <DetailItem
                icon={AlertTriangle}
                label="Alert ID (Primary)"
                value={ticket.alert_id}
              />
              <DetailItem
                icon={Settings2}
                label="Interlock Name"
                value={ticket.interlock_name || "N/A"}
              />
              <DetailItem
                icon={Briefcase}
                label="Alert Section"
                value={ticket.alert_section}
              />
              <DetailItem
                icon={MapPin}
                label="Region"
                value={ticket.region || "N/A"}
              />
              <DetailItem
                icon={Tag}
                label="Entity ID"
                value={ticket.entity_id || "N/A"}
              />
              <DetailItem
                icon={FileText}
                label="SOP ID"
                value={ticket.sop_id || "N/A"}
              />
              {/* <DetailItem 
                icon={LinkIcon} 
                label="Linked Alert IDs" 
                value={ticket.linked_alert_id && ticket.linked_alert_id.length > 0 ? ticket.linked_alert_id.join(', ') :ticket.linked_alert_id || 'None'} 
                fullWidth
              /> */}
              <DetailItem
                icon={LinkIcon}
                label="Linked Alert IDs"
                value={
                  ticket.linked_alert_id &&
                  Array.isArray(ticket.linked_alert_id) &&
                  ticket.linked_alert_id.length > 0
                    ? ticket.linked_alert_id.join(", ")
                    : ticket.linked_alert_id || "None"
                }
                fullWidth
              />
            </Section>

            <Section title="History">
              {ticket.ticket_history && ticket.ticket_history.length > 0 ? (
                <ul className="list-none space-y-0.5 pl-0 col-span-1 sm:col-span-2">
                  {ticket.ticket_history.slice(0, 3).map((entry, index) => (
                    <li
                      key={index}
                      className="text-2xs text-gray-700 flex items-start"
                    >
                      <ChevronRight className="h-2.5 w-2.5 mr-0.5 mt-px shrink-0 text-gray-400" />
                      <span>
                        {typeof entry === "string"
                          ? entry
                          : JSON.stringify(entry)}
                      </span>
                    </li>
                  ))}
                  {ticket.ticket_history.length > 3 && (
                    <li className="text-2xs text-gray-500 pl-3">...and more</li>
                  )}
                </ul>
              ) : (
                <DetailItem
                  icon={History}
                  label=""
                  value="No history available."
                  fullWidth
                />
              )}
            </Section>
          </div>
        </ScrollArea>
        <DrawerFooter className="p-3 border-t bg-gray-50 flex justify-end sticky bottom-0 z-10">
          <DrawerClose asChild>
            <Button variant="outline" size="sm" className="px-2.5 h-7 text-xs">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
