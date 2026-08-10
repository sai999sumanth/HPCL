


import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useTickets } from "../../hooks/useTickets";
import { Ticket, EditTicketPayload, CreateOrFetchAlertTypesPayload } from "../types/ticket";
import { TicketFormCore } from "../create-ticket-dialog";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Badge } from "@/@/components/ui/badge";
import { Input } from "@/@/components/ui/input";
import { Textarea } from "@/@/components/ui/textarea";
import {
    Loader2,
    AlertCircle,
    ArrowLeft,
    Info,
    CalendarDays,
    User,
    Users,
    FileText,
    MessageSquare,
    ShieldAlert,
    Briefcase,
    MapPin,
    Tag,
    Building2,
    Settings2,
    Link as LinkIcon,
    History,
    ChevronRight,
    Mail,
    AlertTriangle,
    ListChecks,
    X,
    Edit,
    Plus,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ScrollArea } from "@/@/components/ui/scroll-area";
import { toast } from "sonner";
import React from "react";
import { apiClient } from "@/services/apiClient";
import { encryptPayload } from "@/configs/encryptFernet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/@/components/ui/tabs";

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

const DetailItemPage: React.FC<{
    icon: React.ElementType;
    label: string;
    value?: string | React.ReactNode;
    fullWidth?: boolean;
    className?: string;
}> = ({ icon: Icon, label, value, fullWidth, className }) => {
    if (!value && typeof value !== "number" && value !== false) return null;
    return (
        <div
            className={`py-1 ${fullWidth ? "col-span-1 sm:col-span-2 md:col-span-3" : "col-span-1"
                } ${className}`}
        >
            <div className="flex items-center text-xs text-gray-500 mb-0.5">
                <Icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <span className="font-medium">{label}:</span>
            </div>
            {typeof value === "string" || typeof value === "number" ? (
                <p className="text-sm text-gray-800 break-words ml-[calc(0.375rem+14px)]">
                    {String(value)}
                </p>
            ) : (
                <div className="text-sm text-gray-800 ml-[calc(0.375rem+14px)]">
                    {value}
                </div>
            )}
        </div>
    );
};

const SectionPage: React.FC<{ title: string; children: React.ReactNode }> = ({
    title,
    children,
}) => (
    <Card className="mb-4 shadow-sm">
        <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
            {children}
        </CardContent>
    </Card>
);

// Inline Editable Field Component
const EditableField: React.FC<{
    value: string | number | null | undefined;
    onSave: (newValue: string) => Promise<void>;
    placeholder?: string;
    type?: "text" | "textarea";
    className?: string;
}> = ({ value, onSave, placeholder = "N/A", type = "text", className = "" }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value || ""));
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleDoubleClick = () => {
        setEditValue(String(value || ""));
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (editValue !== String(value || "")) {
            setIsSaving(true);
            try {
                await onSave(editValue);
            } catch (error) {
                console.error("Failed to save:", error);
            } finally {
                setIsSaving(false);
            }
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(String(value || ""));
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && type === "text") {
            e.preventDefault();
            handleSave();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1">
                {type === "textarea" ? (
                    <Textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={`text-xs h-16 ${className}`}
                        disabled={isSaving}
                    />
                ) : (
                    <Input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={`text-xs h-7 ${className}`}
                        disabled={isSaving}
                    />
                )}
                {isSaving && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
            </div>
        );
    }

    return (
        <span
            className={`text-gray-800 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded ${className}`}
            onDoubleClick={handleDoubleClick}
            title="Double-click to edit"
        >
            {value || placeholder}
        </span>
    );
};


const normalizeLinkedAlertIds = (
    linkedIds: string | string[] | undefined
): string[] => {
    if (!linkedIds) return [];
    if (typeof linkedIds === "string") {
        return linkedIds
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0);
    }
    return linkedIds;
};

export function TicketDetailsPage() {
    const { ticketId } = useParams<{ ticketId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { editTicket } = useTickets({
        skipInitialFetch: true,
        refetchAfterMutation: false,
    });

    // ticket passed from dashboard (may be undefined on hard refresh)
    const ticketFromState = (location.state as any)?.ticket as Ticket | undefined;

    const [ticket, setTicket] = useState<Ticket | null>(
        ticketFromState
            ? {
                ...ticketFromState,
                linked_alert_id: normalizeLinkedAlertIds(
                    ticketFromState.linked_alert_id
                ),
            }
            : null
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [alertHistory, setAlertHistory] = useState<any[]>([]);
    const [mergeHistory, setMergeHistory] = useState<any[]>([]);
    const [isLoadingAlertHistory, setIsLoadingAlertHistory] = useState(false);
    const [isLoadingMergeHistory, setIsLoadingMergeHistory] = useState(false);
    const [selectedAlertDetails, setSelectedAlertDetails] = useState<any>(null);
    const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
    const [alertIdToUniqueIdMap, setAlertIdToUniqueIdMap] = useState<Map<number, string>>(new Map());
    const [isLoadingUniqueIds, setIsLoadingUniqueIds] = useState(false);
    const [selectedMergeTicketDetails, setSelectedMergeTicketDetails] = useState<Ticket | null>(null);
    const [isLoadingMergeTicket, setIsLoadingMergeTicket] = useState(false);

    const handleFieldUpdate = async (field: keyof Ticket, newValue: string) => {
        if (!ticket) return;

        try {
            const updateId = ticket.id;
            if (!updateId) {
                toast.error("Cannot update ticket: Missing ID");
                return;
            }

            const editPayload = {
                ticket_id: ticket.ticket_id,
                update_id: String(updateId),
                [field]: newValue,
                bu: ticket.bu,
                alert_section: ticket.alert_section,
                sap_id: ticket.sap_id,
                location_name: ticket.location_name,
                zone: ticket.zone,
                region: ticket.region || "",
                assignee: ticket.assignee,
                summary: ticket.summary,
                description: ticket.description,
                ticket_state: ticket.ticket_state,
                ticket_severity: ticket.ticket_severity,
                comment: ticket.comment || "",
                start_date: ticket.start_date,
                // ensure parent/subtask relationship is preserved on update
                parent_id: ticket.parent_id,
                subtask_id: ticket.subtask_id ?? [],
                linked_alert_id: Array.isArray(ticket.linked_alert_id)
                    ? ticket.linked_alert_id
                    : ticket.linked_alert_id
                        ? [String(ticket.linked_alert_id)]
                        : [],
            } as EditTicketPayload;

            const result = await editTicket(ticket.ticket_id, editPayload);

            if (result.success) {
                toast.success("Field updated successfully!");
                // Update local state
                setTicket((prev) => (prev ? { ...prev, [field]: newValue } : null));
                // Refresh ticket data using encrypted ID
                try {
                    const encryptedTicketId = encryptPayload(ticket.id);
                    const res = await apiClient.get(`/api/ticketing/${encryptedTicketId}`);
                    const data: Ticket = res.data;
                    const normalized: Ticket = {
                        ...data,
                        linked_alert_id: normalizeLinkedAlertIds(data.linked_alert_id),
                    };
                    setTicket(normalized);
                } catch (refreshError: any) {
                    console.error("Failed to refresh ticket data after field update:", refreshError);
                    // Don't fail the whole operation if refresh fails - the update was successful
                }
            } else {
                toast.error(result.error || "Failed to update field");
            }
        } catch (err: any) {
            console.error("Failed to update field:", err);
            
            toast.error(err?.response?.data?.message || "Failed to update field");
        }
    };

    const handleSubmitForm = async (
        payload: CreateOrFetchAlertTypesPayload | EditTicketPayload
    ): Promise<{
        success: boolean;
        ticketId?: string;
        data?: any;
        error?: string;
    }> => {
        if (!ticket) {
            return {
                success: false,
                error: "Ticket not found",
            };
        }

        setIsSubmitting(true);
        try {
            const updateId = ticket.id;
            if (!updateId) {
                toast.error("Cannot edit ticket: Missing ID");
                setIsSubmitting(false);
                return {
                    success: false,
                    error: "Cannot edit ticket: Missing ID",
                };
            }

            // Ensure all required fields are included in the payload
            // The payload from TicketFormCore should already have all fields, but we ensure ticket_id and update_id are set
            const editPayload = {
                ...(payload as EditTicketPayload),
                ticket_id: ticket.ticket_id,
                update_id: String(updateId),
                // include parent/subtask ids when saving edits
                parent_id: (payload as any)?.parent_id ?? ticket.parent_id,
                subtask_id: (payload as any)?.subtask_id ?? (ticket.subtask_id ?? []),
            } as EditTicketPayload;

            console.log("Submitting ticket update with payload:", editPayload);
            console.log("Calling editTicket with ticket_id:", ticket.ticket_id);

            const result = await editTicket(ticket.ticket_id, editPayload);
            console.log("Update result:", result);

            if (!result) {
                console.error("editTicket returned undefined or null");
                toast.error("Failed to update ticket: No response from server");
                return {
                    success: false,
                    error: "No response from server",
                };
            }

            if (result.success) {
                toast.success("Ticket updated successfully!");
                setIsEditMode(false);
                // Refresh ticket data using encrypted ID
                try {
                    const encryptedTicketId = encryptPayload(ticket.id);
                    const res = await apiClient.get(`/api/ticketing/${encryptedTicketId}`);
                    const data: Ticket = res.data;
                    const normalized: Ticket = {
                        ...data,
                        linked_alert_id: normalizeLinkedAlertIds(data.linked_alert_id),
                    };
                    setTicket(normalized);
                } catch (refreshError: any) {
                    console.error("Failed to refresh ticket data:", refreshError);
                    // Don't fail the whole operation if refresh fails - the update was successful
                    // Just log the error and continue
                }
                return {
                    success: true,
                    ticketId: result.ticketId,
                    data: ticket,
                };
            } else {
                toast.error(result.error || "Failed to update ticket");
                return {
                    success: false,
                    error: result.error || "Failed to update ticket",
                };
            }
        } catch (err: any) {
            console.error("Failed to update ticket:", err);
            const errorMessage = err?.response?.data?.message || "Failed to update ticket";
            toast.error(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
    };
    const handleLinkedAlertClick = async (alertId: number) => {
        if (!alertId) return;

        setSelectedAlertId(alertId);
        setIsLoadingAlertHistory(true);

        try {
            const encryptedAlertId = encryptPayload(alertId);
            const response = await apiClient.get(`/api/alerts/${encryptedAlertId}`);

            if (response.data) {
                setSelectedAlertDetails(response.data);
                // Set alert history for the selected alert
                setAlertHistory(response.data.alert_history || []);
            } else {
                toast.error("No alert data received");
                setSelectedAlertDetails(null);
                setAlertHistory([]);
            }
        } catch (err: any) {
            console.error("Failed to fetch alert details:", err);
            toast.error(err?.response?.data?.message || "Failed to fetch alert details");
            setSelectedAlertDetails(null);
            setAlertHistory([]);
        } finally {
            setIsLoadingAlertHistory(false);
        }
    };

    const handleMergeTicketClick = async (mergeTicketId: string) => {
        if (!mergeTicketId) return;
        // Merged ticket IDs should open the EDIT page (not inline view)
        navigate(`/settings/edit-ticketing/${mergeTicketId}`);
    };
    // Removed useTickets – we only use ticket from navigation state
    // and the direct get-by-id API call in useEffect.

    useEffect(() => {
        // if we already have ticket from state, don't call API again
        if (ticket) return;

        if (!ticketId) {
            navigate("/settings/add-edit-ticketing");
            return;
        }

        const fetchTicket = async () => {
            try {
                setIsLoading(true);
                setError("");

            
                let res;
                try {
                    res = await apiClient.get(`/api/ticketing/${ticketId}`);
                } catch (err: any) {
              
                    const ticketsRes = await apiClient.get(`/api/ticketing`, {
                        params: { skip: 0, limit: 1000 }
                    });
                    const tickets = ticketsRes.data?.data || [];
                    const foundTicket = tickets.find((t: Ticket) => t.ticket_id === ticketId);
                    if (foundTicket) {
                        res = { data: foundTicket };
                    } else {
                        throw err;
                    }
                }
                const data: Ticket = res.data;

                const normalized: Ticket = {
                    ...data,
                    linked_alert_id: normalizeLinkedAlertIds(data.linked_alert_id),
                };
                setTicket(normalized);
            } catch (err: any) {
                console.error("Failed to fetch ticket by id:", err);
                const msg =
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to load ticket details";
                setError(msg);
                toast.error(msg);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTicket();
    }, [ticketId, navigate, ticket]);


    useEffect(() => {
        if (ticket?.linked_alert_id && ticket.linked_alert_id.length > 0) {
            const fetchUniqueIds = async () => {
                try {
                    setIsLoadingUniqueIds(true);
                    const alertIds = ticket.linked_alert_id.map((rawId: string) => {
                        return parseInt(rawId.replace(/["']/g, ''), 10);
                    }).filter((id: number) => !isNaN(id));

                    if (alertIds.length === 0) {
                        setAlertIdToUniqueIdMap(new Map());
                        setIsLoadingUniqueIds(false);
                        return;
                    }

                    // Encrypt each alert ID before sending to API
                    const encryptedIds = alertIds.map((id: number) => encryptPayload(id));
                    const encryptedIdsString = encryptedIds.join(',');

                    console.log('Original Alert IDs:', alertIds);
                    console.log('Encrypted IDs String:', encryptedIdsString);

                    // Call API to get unique IDs using GET with query parameters
                    // Pass encrypted id as comma-separated string
                    const response = await apiClient.get('/api/alerts', {
                        params: {
                            id: encryptedIdsString, // Pass as comma-separated: ?id=encrypted1,encrypted2&field=unique_id
                            field: 'unique_id'
                        }
                    });

                    console.log('API Request - IDs:', alertIds);
                    console.log('API Response for unique IDs:', response.data);

                    const map = new Map<number, string>();

                    // Check if response is an object with ID keys mapping to unique_ids
                    if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
                        // If response is like { "153": "LPG_2324_SOP017_00000001", "154": "..." }
                        const keys = Object.keys(response.data);
                        if (keys.length > 0 && keys.every(key => !isNaN(Number(key)))) {
                            // It's an object with numeric keys (IDs) mapping to unique_ids
                            keys.forEach(key => {
                                const alertId = Number(key);
                                const uniqueId = response.data[key];
                                if (alertId && uniqueId) {
                                    map.set(alertId, String(uniqueId));
                                }
                            });
                            console.log('Final map (object format):', Array.from(map.entries()));
                        }
                    }

                    // If map is still empty, try array format
                    if (map.size === 0) {
                        // Handle array or nested data structures
                        let alertData: any[] = [];

                        if (Array.isArray(response.data)) {
                            alertData = response.data;
                        } else if (response.data?.data && Array.isArray(response.data.data)) {
                            alertData = response.data.data;
                        } else if (response.data?.alerts && Array.isArray(response.data.alerts)) {
                            alertData = response.data.alerts;
                        } else if (response.data && typeof response.data === 'object') {
                            // If response is a single object, convert to array
                            alertData = [response.data];
                        }

                        alertData.forEach((item: any) => {
                            // The API should return objects with id and unique_id fields
                            // Try different possible field names for ID (the alert ID we sent)
                            const alertId = item.id || item.alert_id || item._id || item.ID || item.alertId;
                            // The unique_id field from the response
                            const uniqueId = item.unique_id || item.uniqueId || item.uniqueID || item['unique_id'];

                            console.log('Processing item:', { alertId, uniqueId, item });

                            if (alertId && uniqueId) {
                                map.set(Number(alertId), String(uniqueId));
                            }
                        });

                        console.log('Final map (array format):', Array.from(map.entries()));
                    }

                    setAlertIdToUniqueIdMap(map);
                } catch (err: any) {
                    console.error('Failed to fetch unique IDs:', err);
                    toast.error(err?.response?.data?.message || 'Failed to fetch unique IDs');
                    setAlertIdToUniqueIdMap(new Map());
                } finally {
                    setIsLoadingUniqueIds(false);
                }
            };

            fetchUniqueIds();
        } else {
            setAlertIdToUniqueIdMap(new Map());
        }
    }, [ticket?.linked_alert_id]);

    const formatDateSafe = (dateString: string | null | undefined) => {
        if (!dateString) return "N/A";
        try {
            return format(parseISO(dateString), "MMM dd, yyyy HH:mm");
        } catch (e) {
            return dateString;
        }
    };

    if (isLoading && !ticket) {
        return (
            <div className="container mx-auto px-4 py-8 flex items-center justify-center h-[calc(100vh-150px)]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-700">Loading ticket details...</span>
            </div>
        );
    }

    if (error && !ticket) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
                <p className="text-red-600">Error loading ticket details: {error}</p>
                <Button
                    variant="outline"
                    onClick={() => navigate("/settings/tickets")}
                    className="mt-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Button>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <AlertCircle className="h-10 w-10 text-orange-500 mx-auto mb-2" />
                <p className="text-orange-600">Ticket not found.</p>
                <Button
                    variant="outline"
                    onClick={() => navigate("/settings/tickets")}
                    className="mt-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Button>
            </div>
        );
    }
  
    if (isEditMode && ticket) {
        
        return (
            <div className="w-full px-4 py-4">
                <Card className="shadow-lg">
                    <CardHeader className="border-b bg-gray-50 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Info className="h-3 w-5 mr-2 text-blue-600" />
                                <CardTitle className="text-lg font-semibold text-gray-800">
                                    Edit Ticket: {ticket.ticket_id}
                                </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditMode(false)}
                                    className="h-8 text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate("/settings/tickets")}
                                    className="h-8 text-xs"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                                    Home
                                </Button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 ml-7 mt-1">{ticket.summary}</p>
                    </CardHeader>
                    <CardContent className="p-0">
                        <TicketFormCore
                            mode="edit"
                            initialData={ticket}
                            onSubmit={handleSubmitForm}
                            onCancel={handleCancelEdit}
                            isSubmittingOuter={isSubmitting}
                            isLoadingPage={isLoading}
                        />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="w-full px-4 py-4">
            <Card className="shadow-lg">
                <CardHeader className="border-b bg-gray-50 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <Info className="h-3 w-5 mr-2 text-blue-600" />
                            <CardTitle className="text-lg font-semibold text-gray-800">
                                Ticket Details: {ticket.ticket_id}
                            </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                to={`/settings/add-edit-ticketing?parent_id=${encodeURIComponent(String(ticket.ticket_id))}`}
                                state={{}}
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    className="h-8 text-xs"
                                    title="Create subtask ticket"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Create subtask
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditMode(true)}
                                className="h-8 text-xs"
                            >
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate("/settings/tickets")}
                                className="h-8 text-xs"
                            >
                                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                                Home
                            </Button>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 ml-7 mt-1">{ticket.summary}</p>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="max-h-[calc(100vh-230px)] overflow-y-auto">
                        <div className="p-4 space-y-4">
                            <SectionPage title="Core Information">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Tag className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        SAP ID:
                                    </span>
                                    <EditableField
                                        value={Array.isArray(ticket.sap_id) ? ticket.sap_id.join(', ') : ticket.sap_id}
                                        onSave={(newValue) => handleFieldUpdate("sap_id", newValue)}
                                        className="flex-1"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        Business Unit:
                                    </span>
                                    <EditableField
                                        value={ticket.bu}
                                        onSave={(newValue) => handleFieldUpdate("bu", newValue)}
                                        className="flex-1"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        Location:
                                    </span>
                                    <EditableField
                                        value={Array.isArray(ticket.location_name) ? ticket.location_name.join(', ') : ticket.location_name}
                                        onSave={(newValue) => handleFieldUpdate("location_name", newValue)}
                                        className="flex-1"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 text-sm ">
                                    <Tag className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        Ticket Name:
                                    </span>
                                    <EditableField
                                        value={ticket.ticket_name}
                                        onSave={(newValue) => handleFieldUpdate("ticket_name", newValue)}
                                        className="flex-1"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <ListChecks className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        Status:
                                    </span>
                                    <Badge
                                        className={`text-xs px-1.5 py-0.5 ${statusColors[ticket.ticket_status]
                                            }`}
                                    >
                                        {ticket.ticket_status}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <ShieldAlert className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        Severity:
                                    </span>
                                    <Badge
                                        className={`text-xs px-1.5 py-0.5 ${severityColors[ticket.ticket_severity]
                                            }`}
                                    >
                                        {ticket.ticket_severity}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <Briefcase className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        State:
                                    </span>
                                    <Badge
                                        className={`text-xs px-1.5 py-0.5 ${stateColors[ticket.ticket_state]
                                            }`}
                                    >
                                        {ticket.ticket_state}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <Briefcase className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        Category:
                                    </span>
                                    <EditableField
                                        value={Array.isArray(ticket.category) ? ticket.category.filter(Boolean).join(", ") : (ticket.category ?? "")}
                                        onSave={(newValue) => handleFieldUpdate("category", newValue)}
                                        className="flex-1"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                                    <span className="font-medium text-gray-600 min-w-fit">
                                        Alert Type:
                                    </span>
                                    <EditableField
                                        value={ticket.alert_type}
                                        onSave={(newValue) => handleFieldUpdate("alert_type", newValue)}
                                        className="flex-1"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Settings2 className="w-3.5 h-3.5 text-gray-500" />
                                    <span className="font-normal text-gray-600">
                                        Interlock Name:
                                    </span>
                                    <EditableField
                                        value={ticket.interlock_name}
                                        onSave={(newValue) => handleFieldUpdate("interlock_name", newValue)}
                                        className="flex-1"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 text-sm">
                                    <FileText className="w-3.5 h-3.5 mt-0.5 text-blue-500" />
                                    <span className="font-normal text-gray-600 min-w-fit">Description:</span>
                                    <div className="flex-1">
                                        <EditableField
                                            value={ticket.description}
                                            onSave={(newValue) => handleFieldUpdate("description", newValue)}
                                            type="textarea"
                                            placeholder="No description provided."
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 text-sm">
                                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-green-500" />
                                    <span className="font-normal text-gray-600 min-w-fit">Comment:</span>
                                    <div className="flex-1">
                                        <EditableField
                                            value={ticket.comment}
                                            onSave={(newValue) => handleFieldUpdate("comment", newValue)}
                                            type="textarea"
                                            placeholder="No comments."
                                        />
                                    </div>
                                </div>
                            </SectionPage>
                            {ticket.merge_history && ticket.merge_history.length > 0 && ticket.merge_history[0]?.merge_ticket_id && ticket.merge_history[0].merge_ticket_id.length > 0 && (
                                <SectionPage title="Merged Ticket">
                                    <div className="flex items-center gap-.5 text-sm mt-2">

                                 
                                        <LinkIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />

                                        <span className="font-medium text-gray-600 min-w-fit">Merge Ticket ID:</span>
                                        <span className="flex-1 flex flex-wrap gap-1 items-center">
                                            {ticket.merge_history?.[0]?.merge_ticket_id?.map((mergeTicketId: string, index: number) => (
                                                <span key={`merge-ticket-${mergeTicketId}-${index}`} className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleMergeTicketClick(mergeTicketId)}
                                                        className="text-blue-600 underline hover:text-blue-800 transition-colors cursor-pointer"
                                                        title={`Click to view ticket: ${mergeTicketId}`}
                                                    >
                                                        {mergeTicketId}
                                                    </button>
                                                    {index < (ticket.merge_history?.[0]?.merge_ticket_id?.length || 0) - 1 && (
                                                        <span>,</span>
                                                    )}
                                                </span>
                                            )) || "—"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-sm mt-2">

                                        {/* Icon */}
                                        <MessageSquare className="w-3.5 h-3.5 text-gray-500 shrink-0" />

                                        {/* Comment */}
                                        <span className="font-medium text-gray-600 min-w-fit">Comment:</span>
                                        {ticket.merge_history?.[0]?.comment || "—"}
                                    </div>
                                </SectionPage>
                            )}

                            <SectionPage title="Linked Alerts">
                                
                               

                                <div className="flex items-start gap-1.5 text-sm w-full col-span-full">
                                    <LinkIcon className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
                                    <span className="font-normal text-gray-600 min-w-fit"> Unique ID:</span>

                                    <span className="flex-1 flex flex-wrap gap-1 items-center">
                                        {isLoadingUniqueIds ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {ticket.linked_alert_id?.map((rawId, index) => {
                                                    const normalizedId = parseInt(rawId.replace(/["']/g, ''), 10);
                                                    const uniqueId = alertIdToUniqueIdMap.get(normalizedId) || normalizedId.toString();

                                                    return (
                                                        <span key={`linked-alert-${normalizedId}-${index}`} className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleLinkedAlertClick(normalizedId)}
                                                                className="text-blue-600 underline hover:text-blue-800 transition-colors cursor-pointer"
                                                                title={`Alert ID: ${normalizedId}`}
                                                            >
                                                                {uniqueId}
                                                            </button>

                                                            {/* Add comma except for the last element */}
                                                            {index < ticket.linked_alert_id.length - 1 && (
                                                                <span>,</span>
                                                            )}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </span>
                                </div>

        
                            </SectionPage>

                            <SectionPage title="Subtasks">
                                <div className="col-span-full flex flex-wrap items-center gap-2">
                                    {ticket.subtask_id && Array.isArray(ticket.subtask_id) && ticket.subtask_id.filter((id) => id && String(id).trim() !== "").length > 0 ? (
                                        <>
                                            {ticket.subtask_id.filter((id) => id && String(id).trim() !== "").map((subtaskId, index) => (
                                                <span key={`subtask-${subtaskId}-${index}`} className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/settings/edit-ticketing/${subtaskId}`)}
                                                        className="text-sm font-mono text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                                    >
                                                        {subtaskId}
                                                    </button>
                                                    {index < ticket.subtask_id!.filter((id) => id && String(id).trim() !== "").length - 1 && <span className="text-gray-400">,</span>}
                                                </span>
                                            ))}
                                        </>
                                    ) : (
                                        <span className="text-sm text-gray-500">No subtasks</span>
                                    )}
                                    <Link
                                        to={`/settings/add-edit-ticketing?parent_id=${encodeURIComponent(String(ticket.ticket_id))}`}
                                        state={{}}
                                    >
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
                                            title="Create subtask ticket"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </SectionPage>

                            {isLoadingMergeTicket ? (
                                <Card className="mb-4 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                                            <span className="text-gray-700">Loading merge ticket details...</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : selectedMergeTicketDetails && (
                                <Card className="mb-4 shadow-sm">
                                    <CardHeader className="py-2 px-3 border-b">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                                Merge Ticket Details: {selectedMergeTicketDetails.ticket_id}
                                            </CardTitle>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedMergeTicketDetails(null);
                                                }}
                                                className="h-6 w-6 p-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3">
                                        <SectionPage title="Core Information">
                                            <DetailItemPage
                                                icon={Tag}
                                                label="SAP ID"
                                                value={selectedMergeTicketDetails.sap_id || "N/A"}
                                            />

                                            <DetailItemPage
                                                icon={Building2}
                                                label="Business Unit"
                                                value={selectedMergeTicketDetails.bu || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={MapPin}
                                                label="Location"
                                                value={selectedMergeTicketDetails.location_name || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={Tag}
                                                label="Ticket Name"
                                                value={selectedMergeTicketDetails.ticket_name || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={ListChecks}
                                                label="Status"
                                                value={
                                                    <Badge
                                                        className={`text-xs px-1.5 py-0.5 ${statusColors[selectedMergeTicketDetails.ticket_status]
                                                            }`}
                                                    >
                                                        {selectedMergeTicketDetails.ticket_status}
                                                    </Badge>
                                                }
                                            />
                                            <DetailItemPage
                                                icon={ShieldAlert}
                                                label="Severity"
                                                value={
                                                    <Badge
                                                        className={`text-xs px-1.5 py-0.5 ${severityColors[selectedMergeTicketDetails.ticket_severity]
                                                            }`}
                                                    >
                                                        {selectedMergeTicketDetails.ticket_severity}
                                                    </Badge>
                                                }
                                            />
                                            <DetailItemPage
                                                icon={Briefcase}
                                                label="State"
                                                value={
                                                    <Badge
                                                        className={`text-xs px-1.5 py-0.5 ${stateColors[selectedMergeTicketDetails.ticket_state]
                                                            }`}
                                                    >
                                                        {selectedMergeTicketDetails.ticket_state}
                                                    </Badge>
                                                }
                                            />
                                            <DetailItemPage
                                                icon={Tag}
                                                label="Category"
                                                value={selectedMergeTicketDetails.category || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={AlertTriangle}
                                                label="Alert Type"
                                                value={selectedMergeTicketDetails.alert_type || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={Settings2}
                                                label="Interlock Name"
                                                value={selectedMergeTicketDetails.interlock_name || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={FileText}
                                                label="Description"
                                                value={selectedMergeTicketDetails.description || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={MessageSquare}
                                                label="Comment"
                                                value={selectedMergeTicketDetails.comment || "N/A"}
                                            />
                                        </SectionPage>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Alert Details Section - Display when alert is selected */}
                            {selectedAlertDetails && (
                                <Card className="mb-4 shadow-sm">
                                    <CardHeader className="py-2 px-3 border-b">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                                Alert Details
                                            </CardTitle>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedAlertDetails(null);
                                                    setSelectedAlertId(null);
                                                    setAlertHistory([]);
                                                }}
                                                className="h-6 w-6 p-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                                            <DetailItemPage
                                                icon={ShieldAlert}
                                                label="Interlock Name"
                                                value={selectedAlertDetails.interlock_name || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={AlertTriangle}
                                                label="Severity"
                                                value={
                                                    <Badge
                                                        className={`text-xs px-1.5 py-0.5 ${selectedAlertDetails.severity === "Low"
                                                                ? "bg-green-100 text-green-700"
                                                                : selectedAlertDetails.severity === "Medium"
                                                                    ? "bg-yellow-100 text-yellow-700"
                                                                    : selectedAlertDetails.severity === "High"
                                                                        ? "bg-orange-100 text-orange-700"
                                                                        : "bg-red-100 text-red-700"
                                                            }`}
                                                    >
                                                        {selectedAlertDetails.severity || "N/A"}
                                                    </Badge>
                                                }
                                            />
                                            <DetailItemPage
                                                icon={AlertCircle}
                                                label="Alert Status"
                                                value={
                                                    <Badge
                                                        className={`text-xs px-1.5 py-0.5 ${selectedAlertDetails.alert_status === "Open"
                                                                ? "bg-red-100 text-red-700"
                                                                : selectedAlertDetails.alert_status === "Closed"
                                                                    ? "bg-gray-100 text-gray-700"
                                                                    : "bg-yellow-100 text-yellow-700"
                                                            }`}
                                                    >
                                                        {selectedAlertDetails.alert_status || "N/A"}
                                                    </Badge>
                                                }
                                            />
                                            <DetailItemPage
                                                icon={Briefcase}
                                                label="Alert Section"
                                                value={selectedAlertDetails.alert_section || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={Tag}
                                                label="Location ID"
                                                value={selectedAlertDetails.location_id || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={FileText}
                                                label="Unique id"
                                                value={selectedAlertDetails.unique_id || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={MapPin}
                                                label="Zone"
                                                value={selectedAlertDetails.zone || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={Building2}
                                                label="Bu"
                                                value={selectedAlertDetails.bu || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={MapPin}
                                                label="Location Name"
                                                value={selectedAlertDetails.location_name || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={MapPin}
                                                label="City & State"
                                                value={
                                                    selectedAlertDetails.city && selectedAlertDetails.state
                                                        ? `${selectedAlertDetails.city}, ${selectedAlertDetails.state}`
                                                        : selectedAlertDetails.city || selectedAlertDetails.state || "N/A"
                                                }
                                            />
                                            <DetailItemPage
                                                icon={Building2}
                                                label="Region"
                                                value={selectedAlertDetails.region || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={User}
                                                label="Location in Charge"
                                                value={selectedAlertDetails.location_in_charge || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={Tag}
                                                label="Category"
                                                value={selectedAlertDetails.category || "N/A"}
                                            />
                                            <DetailItemPage
                                                icon={CalendarDays}
                                                label="Created"
                                                value={
                                                    selectedAlertDetails.created_at
                                                        ? formatDateSafe(selectedAlertDetails.created_at)
                                                        : "N/A"
                                                }
                                            />
                                            <DetailItemPage
                                                icon={CalendarDays}
                                                label="Updated"
                                                value={
                                                    selectedAlertDetails.updated_at
                                                        ? formatDateSafe(selectedAlertDetails.updated_at)
                                                        : "N/A"
                                                }
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="mb-4 shadow-sm">
                                <CardHeader className="py-2 px-3 border-b">
                                    <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                        History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3">
                                    <Tabs defaultValue="ticket-history" className="w-full">
                                        <TabsList className="grid w-full grid-cols-3 mb-4">
                                            <TabsTrigger value="ticket-history">Ticket History</TabsTrigger>
                                            <TabsTrigger value="alert-history">Alert History</TabsTrigger>
                                            <TabsTrigger value="merge-history">Merge History</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="ticket-history" className="mt-0">
                                            {ticket.ticket_history && ticket.ticket_history.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <div className="border rounded-lg overflow-hidden">
                                                        <table className="w-full border-collapse">
                                                            <thead className="bg-gray-50 sticky top-0">
                                                                <tr className="border-b">
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 w-1/6">
                                                                        Action Type
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 w-2/6">
                                                                        Message
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 w-1/6">
                                                                        Process Time
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 w-1/6">
                                                                        Duration
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                        </table>
                                                        <div className="max-h-96 overflow-y-auto">
                                                            <table className="w-full border-collapse">
                                                                <colgroup>
                                                                    <col className="w-1/6" />
                                                                    <col className="w-2/6" />
                                                                    <col className="w-1/6" />
                                                                    <col className="w-1/6" />
                                                                </colgroup>
                                                                <tbody>
                                                                    {ticket.ticket_history.map((entry, index) => {
                                                                        const historyEntry =
                                                                            typeof entry === "string"
                                                                                ? JSON.parse(entry)
                                                                                : entry;
                                                                        return (
                                                                            <tr
                                                                                key={index}
                                                                                className="border-b hover:bg-gray-50"
                                                                            >
                                                                                <td className="py-2 px-3 text-sm align-top">
                                                                                    <span
                                                                                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${historyEntry.action_type ===
                                                                                                "TicketRaised"
                                                                                                ? "bg-green-100 text-green-800"
                                                                                                : historyEntry.action_type ===
                                                                                                    "TicketInProgress"
                                                                                                    ? "bg-blue-100 text-blue-800"
                                                                                                    : historyEntry.action_type ===
                                                                                                        "TicketCancelled"
                                                                                                        ? "bg-red-100 text-red-800"
                                                                                                        : historyEntry.action_type ===
                                                                                                            "TicketResolved"
                                                                                                            ? "bg-purple-100 text-purple-800"
                                                                                                            : historyEntry.action_type ===
                                                                                                                "TicketAssigned"
                                                                                                                ? "bg-yellow-100 text-yellow-800"
                                                                                                                : historyEntry.action_type ===
                                                                                                                    "TicketOnHold"
                                                                                                                    ? "bg-orange-100 text-orange-800"
                                                                                                                    : historyEntry.action_type ===
                                                                                                                        "TicketReopened"
                                                                                                                        ? "bg-indigo-100 text-indigo-800"
                                                                                                                        : "bg-gray-100 text-gray-800"
                                                                                            }`}
                                                                                    >
                                                                                        {historyEntry.action_type || "N/A"}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="py-2 px-3 text-sm text-gray-700">
                                                                                    {historyEntry.action_msg ||
                                                                                        historyEntry.description ||
                                                                                        "N/A"}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap align-top">
                                                                                    {historyEntry.processed_time
                                                                                        ? formatDateSafe(
                                                                                            historyEntry.processed_time
                                                                                        )
                                                                                        : "N/A"}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap align-top">
                                                                                    {historyEntry.allocated_time
                                                                                        ? formatDateSafe(
                                                                                            historyEntry.allocated_time
                                                                                        )
                                                                                        : "N/A"}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                                    <p>No ticket history available.</p>
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="alert-history" className="mt-0">
                                            {!selectedAlertId ? (
                                                <div className="text-center py-8 text-gray-500">
                                                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                                    <p>Click on an Alert ID above to view its history.</p>
                                                </div>
                                            ) : isLoadingAlertHistory ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                                                    <span className="text-gray-700">Loading alert history...</span>
                                                </div>
                                            ) : alertHistory.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <div className="border rounded-lg overflow-hidden">
                                                        <table className="w-full border-collapse">
                                                            <thead className="bg-gray-50 sticky top-0">
                                                                <tr className="border-b">
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                                        Action Type
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                                        Message
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                                        Process Time
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                                        Duration
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {alertHistory.map((entry, index) => {
                                                                    const historyEntry =
                                                                        typeof entry === "string"
                                                                            ? JSON.parse(entry)
                                                                            : entry;
                                                                    return (
                                                                        <tr
                                                                            key={index}
                                                                            className="border-b hover:bg-gray-50"
                                                                        >
                                                                            <td className="py-2 px-3 text-sm align-top">
                                                                                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                                    {historyEntry.action_type || "N/A"}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 px-3 text-sm text-gray-700">
                                                                                {historyEntry.action_msg ||
                                                                                    historyEntry.description ||
                                                                                    "N/A"}
                                                                            </td>
                                                                            <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap align-top">
                                                                                {historyEntry.processed_time
                                                                                    ? formatDateSafe(
                                                                                        historyEntry.processed_time
                                                                                    )
                                                                                    : "N/A"}
                                                                            </td>
                                                                            <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap align-top">
                                                                                {historyEntry.allocated_time
                                                                                    ? formatDateSafe(
                                                                                        historyEntry.allocated_time
                                                                                    )
                                                                                    : "N/A"}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                                    <p>No alert history available.</p>
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="merge-history" className="mt-0">
                                            {isLoadingMergeHistory ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                                                    <span className="text-gray-700">Loading merge history...</span>
                                                </div>
                                            ) : mergeHistory.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <div className="border rounded-lg overflow-hidden">
                                                        <table className="w-full border-collapse">
                                                            <thead className="bg-gray-50 sticky top-0">
                                                                <tr className="border-b">
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                                        Action Type
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                                        Message
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                                        Process Time
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                                        Duration
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {mergeHistory.map((entry, index) => {
                                                                    const historyEntry =
                                                                        typeof entry === "string"
                                                                            ? JSON.parse(entry)
                                                                            : entry;
                                                                    return (
                                                                        <tr
                                                                            key={index}
                                                                            className="border-b hover:bg-gray-50"
                                                                        >
                                                                            <td className="py-2 px-3 text-sm align-top">
                                                                                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                                                    {historyEntry.action_type || "N/A"}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 px-3 text-sm text-gray-700">
                                                                                {historyEntry.action_msg ||
                                                                                    historyEntry.description ||
                                                                                    "N/A"}
                                                                            </td>
                                                                            <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap align-top">
                                                                                {historyEntry.processed_time
                                                                                    ? formatDateSafe(
                                                                                        historyEntry.processed_time
                                                                                    )
                                                                                    : "N/A"}
                                                                            </td>
                                                                            <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap align-top">
                                                                                {historyEntry.allocated_time
                                                                                    ? formatDateSafe(
                                                                                        historyEntry.allocated_time
                                                                                    )
                                                                                    : "N/A"}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    <LinkIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                                    <p>No merge history available.</p>
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                </CardContent>

                <CardFooter className="p-4 border-t bg-gray-50 flex justify-end">
                    <Button
                        variant="outline"
                        onClick={() => navigate("/settings/tickets")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Home
                    </Button>
                </CardFooter>
            </Card>

        </div>
    );
}
