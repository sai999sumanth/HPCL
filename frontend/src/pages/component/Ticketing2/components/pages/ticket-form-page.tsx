
import { useParams, useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { Input } from "@/@/components/ui/input";
import { Button } from "@/@/components/ui/button";
import { Textarea } from "@/@/components/ui/textarea";
import {
  ReusableCombobox,
  ComboboxOption,
} from "../reusable-combobox";
import { ScrollArea } from "@/@/components/ui/scroll-area";
import { Loader2, ArrowLeft, Save, PlusCircle, Home, ArrowRight, X } from "lucide-react";
import { useTickets } from "../../hooks/useTickets";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/@/components/ui/card";
import {
  CreateOrFetchAlertTypesPayload,
  EditTicketPayload,
  Ticket,
} from "../types/ticket";

import { useEffect, useState } from "react";
import { TicketFormCore } from "../create-ticket-dialog";
import { apiClient } from "@/services/apiClient";
import { encryptPayload } from "@/configs/encryptFernet";

export function TicketFormPage() {
  const { ticketId: routeTicketId } = useParams<{ ticketId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const parentTicketId = searchParams.get("parent_id");
  const alertId = searchParams.get("alertId");

  const isEditMode = !!routeTicketId;

  // Ticket passed from dashboard navigation (preferred: avoids "get all" list API)
  const ticketFromState = (location.state as any)?.ticket as Ticket | undefined;

  const { addTicket, editTicket } = useTickets({
    // This page does not need the full tickets list; avoid GET /api/ticketing on mount
    skipInitialFetch: true,
    // During edit/create flow we shouldn't refetch the full list ("get all")
    refetchAfterMutation: false,
  });

  // Log parent_id when present (for subtask creation)
  useEffect(() => {
    if (parentTicketId) {
      console.log("Parent Ticket ID from URL:", parentTicketId);
    }
  }, [parentTicketId]);

  // When creating a subtask (parent_id in URL), always use empty form - clear any ticket data
  useEffect(() => {
    if (parentTicketId && parentTicketId.trim() !== "") {
      setTicketToEdit(null);
    }
  }, [parentTicketId]);

  const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(
    isEditMode ? (ticketFromState ?? null) : null
  );
  /** Bumps when a full ticket is loaded from GET-by-id so TicketFormCore remounts and picks up summary/description (not blocked by id-only dedupe). */
  const [editFormMountKey, setEditFormMountKey] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(
    isEditMode ? !ticketFromState : false
  );
  const [isSubmittingPage, setIsSubmittingPage] = useState(false);
  const [isLoadingAlertData, setIsLoadingAlertData] = useState(false);

  const [customTitle, setCustomTitle] = useState("");

  // Fetch alert data when alertId is present in query params
  useEffect(() => {
    const fetchAlertData = async () => {
      if (!alertId || isEditMode) return;

      setIsLoadingAlertData(true);
      try {
        const numericAlertId = typeof alertId === 'string' ? parseInt(alertId, 10) : alertId;
        if (isNaN(numericAlertId)) {
          console.error("Invalid alert ID:", alertId);
          setIsLoadingAlertData(false);
          return;
        }

        const encryptedAlertId = encryptPayload(numericAlertId);
        const response = await apiClient.get(`/api/alerts/${encryptedAlertId}`);

        if (response.data) {
          const alertData = response.data;
          
          // Create a partial Ticket object from alert data
          const initialTicketData: Partial<Ticket> = {
            bu: alertData.bu || "TAS",
            alert_section: alertData.alert_section || "TAS",
            sap_id: alertData.sap_id ? [alertData.sap_id] : [],
            location_name: alertData.location_name ? [alertData.location_name] : [],
            location_id: alertData.location_id || alertData.sap_id || "",
            zone: alertData.zone ? [alertData.zone] : [],
            region: alertData.region || "",
            // Pre-fill linked alerts - convert alert data to linked alert format
            // linked_alert_id should be an array of alert IDs
            linked_alert_id: alertData.id ? [String(alertData.id)] : [],
            // Summary and description should be empty for user to fill
            summary: "",
            description: "",
            // Set default values
            ticket_severity: alertData.severity === "Critical" ? "Critical" : 
                            alertData.severity === "High" ? "High" :
                            alertData.severity === "Medium" ? "Medium" : "Low",
            ticket_state: "Open",
            assignee: "NovexSupport",
            interlock_name: alertData.interlock_name || "",
            alert_id: alertData.unique_id || "",
            created_at: alertData.created_at || "",
          };

          setTicketToEdit(initialTicketData as Ticket);
        }
      } catch (error: any) {
        console.error("Error fetching alert data:", error);
        toast.error(error?.response?.data?.message || "Failed to fetch alert data");
      } finally {
        setIsLoadingAlertData(false);
      }
    };

    fetchAlertData();
  }, [alertId, isEditMode]);

  useEffect(() => {
    let isMounted = true;

    const fetchTicketForEdit = async () => {
      if (!routeTicketId) return;
      const hasStateTicket = !!ticketFromState;
      // If we already have state data, refresh in background without loader flicker.
      if (!hasStateTicket) setIsLoadingPage(true);
      try {
        const numericFromState =
          ticketFromState?.id != null && /^\d+$/.test(String(ticketFromState.id).trim())
            ? Number(ticketFromState.id)
            : null;
        const numericFromRoute =
          routeTicketId != null && /^\d+$/.test(String(routeTicketId).trim())
            ? Number(routeTicketId)
            : null;
        // Prefer internal id from navigation state (list row includes `id`) so URL can still be business ticket_id.
        const idForByIdFetch = numericFromState ?? numericFromRoute;

        if (idForByIdFetch != null) {
          const encryptedTicketId = encryptPayload(idForByIdFetch);
          const byIdRes = await apiClient.get(`/api/ticketing/${encryptedTicketId}`);
          const byIdTicket = byIdRes.data as Ticket | undefined;
          if (byIdTicket && isMounted) {
            setTicketToEdit(byIdTicket);
            setEditFormMountKey((k) => k + 1);
            return;
          }
        }

        // Fallback: business ticket_id in URL and no numeric id — list lookup (no `fields` so row includes summary/description for edit).
        const listRes = await apiClient.get(`/api/ticketing`, {
          params: {
            skip: 0,
            limit: 1,
            q: `ticket_id='${String(routeTicketId).replace(/'/g, "''")}'`,
          },
        });
        const found = listRes.data?.data?.[0] as Ticket | undefined;
        if (found && isMounted) {
          setTicketToEdit(found);
          setEditFormMountKey((k) => k + 1);
          return;
        }

        throw new Error("Ticket not found");
      } catch (error: any) {
        console.error("Failed to fetch ticket for edit:", error);
        toast.error(error?.response?.data?.message || "Failed to load ticket for editing");
        if (isMounted) setTicketToEdit(null);
      } finally {
        if (isMounted) setIsLoadingPage(false);
      }
    };

    if (isEditMode) {
      // Use navigation state for immediate paint, but still refresh from API.
      if (ticketFromState) {
        setTicketToEdit(ticketFromState);
      }
      fetchTicketForEdit();
    } else if (!alertId) {
      // Add mode without alertId
      setIsLoadingPage(false);
      setTicketToEdit(null);
    }

    return () => {
      isMounted = false;
    };
  }, [isEditMode, routeTicketId, ticketFromState, alertId]);

  const handleSubmitForm = async (
    payload: CreateOrFetchAlertTypesPayload | EditTicketPayload
  ) => {
    setIsSubmittingPage(true);
    let result:
      | {
          success: boolean;
          ticketId?: string;
          error?: string;
          updateId?: string;
        }
      | undefined;

    if (isEditMode && ticketToEdit) {
      if (editTicket) {
        console.log(
          "Full ticketToEdit object:",
          JSON.stringify(ticketToEdit, null, 2)
        ); // Full object

        // Use the id field from the ticket object as update_id
        const updateId = ticketToEdit.id;

        console.log("Found updateId (id):", updateId);

        if (!updateId) {
          console.error("No id found in ticket object!");
          toast.error("Cannot edit ticket: Missing ID");
          setIsSubmittingPage(false);
          return;
        }

        // Create the payload with the ticket id as update_id
        const editPayload = {
          ...(payload as EditTicketPayload),
          id: " ",
          update_id: String(updateId), // Convert id to string for API
          // preserve parent/subtask relationship on update
          parent_id:
            (payload as any)?.parent_id ?? (ticketToEdit as any)?.parent_id,
          subtask_id:
            (payload as any)?.subtask_id ??
            ((ticketToEdit as any)?.subtask_id ?? []),
        };

        result = await editTicket(ticketToEdit.ticket_id, editPayload);
        console.log("ticket-form-page result:", result);

        if (result.success && result.ticketId) {
          console.log("ticketId:", result.ticketId);
        } else {
          console.error("Error editing ticket:", result.error);
        }
      } else {
        // This case should ideally not happen if useTickets is correctly structured
        console.error("TicketFormPage: editTicket function is undefined.");
        result = {
          success: false,
          error: "Edit function not available. Please try again later.",
        };
      }
    } else {
      if (addTicket) {
        const createPayload = payload as CreateOrFetchAlertTypesPayload;
        // When opened from "+" on ticket details, ensure parent_id is set so the new ticket is created as a subtask
        if (parentTicketId && parentTicketId.trim() !== "") {
          createPayload.parent_id = String(parentTicketId).trim();
          createPayload.subtask_id = createPayload.subtask_id ?? [""];
        }
        console.log("Creating ticket with payload:", createPayload);
        console.log("Parent ID in payload:", createPayload.parent_id);
        result = await addTicket(createPayload);
        console.log("ticket-form-page result:", result);

        if (result.success && result.ticketId && result.updateId) {
          console.log("ticketId and tid", result.ticketId, result.updateId);
        } else {
          console.error("Error creating ticket:", result.error);
        }
        console.log("ticket-form-page", result);
      } else {
        // This case should ideally not happen
        console.error("TicketFormPage: addTicket function is undefined.");
        result = {
          success: false,
          error: "Add function not available. Please try again later.",
        };
      }
    }

    setIsSubmittingPage(false);
    if (result?.success) {
      toast.success(
        `Ticket ${isEditMode ? "updated" : "created"} successfully!`
      );
      navigate("/settings/tickets2");
    } else {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} ticket: ${
          result?.error || "Unknown error"
        }`
      );
    }
    return result;
  };

  const handleCancelForm = () => {
    // If creating a subticket, navigate back to the parent ticket details page
    if (parentTicketId && parentTicketId.trim() !== "") {
      navigate(`/settings/edit-ticketing2/${encodeURIComponent(parentTicketId)}`);
    } else if (alertId) {
      // If coming from SOD Terminal, VTS, or other alert screens, go back to the originating screen
      navigate(-1);
    } else {
      navigate("/settings/tickets2");
    }
  };

  // const pageTitle = isEditMode ? (
  //   <input
  //     type="text"
  //     value={
  //       customTitle ||
  //       ticketToEdit?.ticket_id ||
  //       (isLoadingPage ? "Loading..." : "N/A")
  //     }
  //     onChange={(e) => setCustomTitle(e.target.value)}
  //     className="w-full text-lg font-semibold bg-transparent focus:outline-none"
  //   />
  // ) : (
  //   <input
  //     type="text"
  //     placeholder="Add New Ticket"
  //     value={customTitle}
  //     onChange={(e) => setCustomTitle(e.target.value)}
  //     className="w-full focus:outline-none text-lg font-semibold bg-transparent"
  //   />
  // );
  
const pageTitle = isEditMode ? (
  <input
    type="text"
    value={
      customTitle ||
      ticketToEdit?.ticket_id ||
      (isLoadingPage ? "Loading..." : "N/A")
    }
    onChange={(e) => setCustomTitle(e.target.value)}
    className="w-full text-lg font-semibold bg-transparent focus:outline-none"
  />
) : (
  <div className="flex items-center gap-2 w-full">
    <input
      type="text"
      placeholder=""
      value={customTitle}
      onChange={(e) => setCustomTitle(e.target.value)}
      className="flex-1 focus:outline-none text-lg font-semibold bg-transparent"
    />
{/* 
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-1"
      onClick={() => navigate("/settings/tickets")}
    >
      <ArrowLeft className="h-4 w-4" />
      Home
    </Button> */}
  </div>
);

  if ((isLoadingPage && isEditMode) || (isLoadingAlertData && alertId)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-700">
          {isLoadingAlertData ? "Loading alert data..." : "Loading ticket data..."}
        </span>
      </div>
    );
  }

  if (isEditMode && !ticketToEdit && !isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <p className="text-red-600 mb-4">Ticket not found or failed to load.</p>
        <button
          onClick={() => navigate("/settings/tickets2")}
          className="flex items-center text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-0.5 sm:px-1 py-0.5 sm:py-1">
      <Card className="shadow-md w-full">
        <CardContent className="p-0">
          {(!isEditMode && !isLoadingPage) ||
          (isEditMode && ticketToEdit && !isLoadingPage) ? (
            <>
              <TicketFormCore
                key={
                  isEditMode && (ticketToEdit?.id != null || ticketToEdit?.ticket_id)
                    ? `edit-${String(ticketToEdit.id ?? ticketToEdit.ticket_id)}-${editFormMountKey}`
                    : parentTicketId
                      ? `subtask-${parentTicketId}`
                      : "add"
                }
                mode={isEditMode ? "edit" : "add"}
                initialData={parentTicketId ? null : (ticketToEdit as any)}
                parentTicketId={parentTicketId || undefined}
                onSubmit={handleSubmitForm}
                onCancel={handleCancelForm}
                ticketSection="tickets"
                isSubmittingOuter={isSubmittingPage}
                isLoadingPage={isLoadingPage && isEditMode}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
