import React, { useState, useEffect } from "react";
import { Button } from "@/@/components/ui/button";
import { TicketFormCore } from "./create-ticket-dialog";
import { Ticket } from "../types/ticket";
import {
  CreateOrFetchAlertTypesPayload,
  EditTicketPayload,
} from "../types/ticket";
import { useTickets } from "../hooks/useTickets";
import { toast } from "sonner";
import { Minimize2, X, PlusCircle, Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { ReusableCombobox } from "./reusable-combobox";
import { ComboboxOption } from "./reusable-combobox";
import { apiClient } from "@/services/apiClient";
import { encryptPayload } from "@/configs/encryptFernet";
// Material Icons are loaded via CDN in the HTML

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Ticket | null;
  parentTicketId?: string;
  /** When provided (e.g. in top bar ticket modal), "+" opens create subtask on same page instead of navigating */
  onCreateSubtaskInPlace?: (parentTicketId: string) => void;
  isMinimized?: boolean;
  onMinimizeChange?: (minimized: boolean) => void;
  onSubmitSuccess?: () => void;
  ticketSection?: string;
  /** Hide the header when used in modal contexts */
  hideHeader?: boolean;
  /** Primary submit button label (e.g. "Create" when opened from top bar) */
  submitButtonLabel?: string;
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  initialData,
  parentTicketId,
  onCreateSubtaskInPlace,
  isMinimized: externalIsMinimized,
  onMinimizeChange,
  onSubmitSuccess,
  ticketSection,
  hideHeader = false,
  submitButtonLabel = "Submit Ticket",
}: CreateTicketDialogProps) {
  const [internalMinimized, setInternalMinimized] = useState(false);
  const [formKey, setFormKey] = useState(0); // Key to reset form
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskIdOptions, setTaskIdOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingTaskIds, setIsLoadingTaskIds] = useState(false);
  const [loadedTicketForEdit, setLoadedTicketForEdit] = useState<Ticket | null>(null);
  const [isLoadingTicketDetails, setIsLoadingTicketDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userBuPermissions, setUserBuPermissions] = useState<string[]>([]);
  /** Mirrors TicketFormCore's computed submit disabled state (required fields, loading, etc.) */
  const [isFormSubmitDisabled, setIsFormSubmitDisabled] = useState(false);
  const isMinimized = externalIsMinimized !== undefined ? externalIsMinimized : internalMinimized;

  const setIsMinimized = (value: boolean) => {
    if (onMinimizeChange) {
      onMinimizeChange(value);
    } else {
      setInternalMinimized(value);
    }
  };
  const { addTicket, editTicket, tickets: allTickets, refetch: refetchTickets } = useTickets({
    skipInitialFetch: true,
    refetchAfterMutation: false,
  });

  const isEditMode = !!initialData?.id || !!loadedTicketForEdit?.id;

  // Fetch user BU permissions on component mount
  useEffect(() => {
    const fetchUserPermissions = async () => {
      try {
        const response = await apiClient.get('/api/session/me');
        const userData = response.data;
        if (userData && userData.bu) {
          setUserBuPermissions(userData.bu);
        }
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
        // Default to empty array if fetch fails
        setUserBuPermissions([]);
      }
    };

    fetchUserPermissions();
  }, []);

  // Cleanup effect to ensure proper state reset when component unmounts
  React.useEffect(() => {
    return () => {
      // Reset any lingering states when component unmounts
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  useEffect(() => {
    const loadAllTaskIds = () => {
      if (isEditMode || !allTickets) return;

      setIsLoadingTaskIds(true);
      try {
        // Filter tickets based on user's BU permissions
        let filteredTickets = allTickets;

        if (userBuPermissions.length > 0) {
          // If user has specific BU permissions, only show tickets from those BUs
          filteredTickets = allTickets.filter((ticket: any) =>
            userBuPermissions.includes(ticket.bu)
          );
        }
       
        const options = filteredTickets.map((ticket: any) => ({
          label: ticket.ticket_id || ticket.id,
          value: ticket.ticket_id || ticket.id,
        }));

        setTaskIdOptions(options);
      } catch (error) {
        console.error("Error loading task IDs:", error);
        setTaskIdOptions([]);
      } finally {
        setIsLoadingTaskIds(false);
      }
    };

    loadAllTaskIds();
  }, [allTickets, isEditMode, userBuPermissions]);

  useEffect(() => {
    if (open && !isEditMode) {
      refetchTickets();
    }
  }, [open, isEditMode, refetchTickets]);

  useEffect(() => {
    const loadInitialTicketForEdit = async () => {
      if (!open || !isEditMode || !initialData) return;

      const initialTicketId = initialData?.id;
      const initialBusinessTicketId = initialData?.ticket_id;
      const initialTicketKey = String(initialTicketId ?? initialBusinessTicketId ?? "").trim();
      if (!initialTicketKey) return;

      const alreadyLoadedSameTicket = (() => {
        if (!loadedTicketForEdit) return false;
        const loadedId = String(loadedTicketForEdit.id ?? "").trim();
        const loadedBusinessId = String(loadedTicketForEdit.ticket_id ?? "").trim();
        return loadedId === initialTicketKey || loadedBusinessId === initialTicketKey;
      })();
      if (alreadyLoadedSameTicket) return;

      setIsLoadingTicketDetails(true);
      try {
        let fullTicketData: Ticket | null = null;
        const numericInitialId =
          initialTicketId != null && /^\d+$/.test(String(initialTicketId).trim())
            ? Number(initialTicketId)
            : null;

        if (numericInitialId != null) {
          const encryptedTicketId = encryptPayload(numericInitialId);
          const response = await apiClient.get(`/api/ticketing/${encryptedTicketId}`);
          if (response?.data) {
            fullTicketData = response.data;
          }
        }

        // Fallback for dashboard rows that only provide business ticket_id.
        if (!fullTicketData && initialBusinessTicketId) {
          const listResponse = await apiClient.get(`/api/ticketing`, {
            params: {
              skip: 0,
              limit: 1,
              q: `ticket_id='${String(initialBusinessTicketId).replace(/'/g, "''")}'`,
            },
          });
          const foundTicket = listResponse?.data?.data?.[0];
          if (foundTicket) {
            fullTicketData = foundTicket;
          }
        }

        if (fullTicketData) {
          setLoadedTicketForEdit(fullTicketData);
        }
      } catch (error) {
        console.error("Error loading initial ticket details:", error);
      } finally {
        setIsLoadingTicketDetails(false);
      }
    };

    loadInitialTicketForEdit();
  }, [open, isEditMode, initialData, loadedTicketForEdit?.id]);

  useEffect(() => {
    const loadTicketForEdit = async () => {
      if (selectedTaskId && allTickets.length > 0) {
        setIsLoadingTicketDetails(true);

        try {
    
          const selectedTicket = allTickets.find((ticket: any) =>
            ticket.ticket_id === selectedTaskId || ticket.id === selectedTaskId
          );

          if (selectedTicket && selectedTicket.id) {
          
            const encryptedTicketId = encryptPayload(selectedTicket.id);
            const response = await apiClient.get(
              `/api/ticketing/${encryptedTicketId}`
            );

            if (response.data) {
              const fullTicketData = response.data;
              console.log("Loaded ticket data:", fullTicketData);
              setLoadedTicketForEdit(fullTicketData);
              toast.success(`Loaded ticket ${selectedTaskId} for editing`);
            } else {
              console.error("API response structure:", response.data);
              toast.error("Failed to load ticket details");
            }
          } else {
            toast.error("Ticket not found");
          }
        } catch (error) {
          console.error("Error loading ticket details:", error);
          toast.error("Failed to load ticket details");
        } finally {
          setIsLoadingTicketDetails(false);
        }
      }
    };

    if (selectedTaskId) {
      loadTicketForEdit();
    }
  }, [selectedTaskId, allTickets]);

  const handleSubmit = async (
    payload: CreateOrFetchAlertTypesPayload | EditTicketPayload
  ) => {
    setIsSubmitting(true);
    try {
      let result:
        | {
            success: boolean;
            ticketId?: string;
            error?: string;
            updateId?: string;
          }
        | undefined;

      if (isEditMode) {
        if (editTicket) {
          // Determine which ticket data to use - initialData or loadedTicketForEdit
          const ticketToEdit = initialData || loadedTicketForEdit;
          const updateId = ticketToEdit?.id;

          if (!updateId) {
            toast.error("Cannot edit ticket: Missing ID");
            setIsSubmitting(false);
            return { success: false, error: "Missing ID" };
          }

          const editPayload = {
            ...(payload as EditTicketPayload),
            update_id: String(updateId),
            parent_id:
              (payload as any)?.parent_id ?? (ticketToEdit as any)?.parent_id,
            subtask_id:
              (payload as any)?.subtask_id ??
              ((ticketToEdit as any)?.subtask_id ?? []),
          };

          result = await editTicket(ticketToEdit.ticket_id, editPayload);

          if (result.success && result.ticketId) {
            toast.success("Ticket updated successfully!");
            setIsSubmitting(false);
            if (onSubmitSuccess) {
              onSubmitSuccess();
            } else {
              onOpenChange(false);
            }
            setIsMinimized(false);
            setFormKey(prev => prev + 1);
            setLoadedTicketForEdit(null);
            setSelectedTaskId("");
          } else {
            setIsSubmitting(false);
            toast.error(
              `Failed to update ticket: ${result?.error || "Unknown error"}`
            );
          }
        }
      } else {
        if (addTicket) {
       
          const payloadWithTaskId = {
            ...payload,
            selected_task_id: selectedTaskId || undefined,
          } as any;

          result = await addTicket(payloadWithTaskId);

          if (result.success && result.ticketId) {
            toast.success(loadedTicketForEdit ? "Ticket updated successfully!" : "Ticket created successfully!");
            setIsSubmitting(false);
            // Close dialog after successful creation or call success callback
            if (onSubmitSuccess) {
              onSubmitSuccess();
            } else {
              onOpenChange(false);
            }
            setIsMinimized(false);
            setFormKey(prev => prev + 1); // Reset form by changing key
            setSelectedTaskId(""); // Clear selected task ID
            setLoadedTicketForEdit(null); // Clear loaded ticket
          } else {
            setIsSubmitting(false);
            toast.error(
              `Failed to create ticket: ${result?.error || "Unknown error"}`
            );
          }
        }
      }

      return result || { success: false };
    } catch (error: any) {
      console.error("Dialog submission error:", error);
      setIsSubmitting(false);
      toast.error("An unexpected error occurred");
      return { success: false, error: error.message };
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setIsMinimized(false);
    setLoadedTicketForEdit(null); // Clear loaded ticket on cancel
    setSelectedTaskId(""); // Clear selected task ID
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // When dialog is closed, reset minimized state and clear loaded ticket
      setIsMinimized(false);
      setLoadedTicketForEdit(null);
      setSelectedTaskId("");
    }
    onOpenChange(newOpen);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col p-2 sm:p-3 md:p-4">
      <Card className="flex flex-col flex-grow">
        {/* Header - conditionally rendered */}
        {!hideHeader && (
          <CardHeader className="pb-2">
            <div className="w-full flex items-center justify-between">
              <CardTitle className="text-xl font-semibold tracking-tight">
                {loadedTicketForEdit && loadedTicketForEdit.ticket_id
                  ? `Edit Ticket: ${loadedTicketForEdit.ticket_id}`
                  : isEditMode && initialData?.ticket_id
                  ? `Edit Ticket: ${initialData.ticket_id}`
                  : isEditMode
                  ? "Edit Ticket"
                  : "Add New Ticket"}
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-1.5 bg-primary hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    // Find the form and submit it
                    const form = document.querySelector('form');
                    if (form) form.requestSubmit();
                  }}
                  disabled={isSubmitting || isFormSubmitDisabled}
                >
                  {isSubmitting ? (submitButtonLabel === "Create" ? "Creating..." : "Submitting...") : submitButtonLabel}
                </button>
              </div>
            </div>
          </CardHeader>
        )}

        {/* Main Content */}
        <CardContent className={`flex-grow ${hideHeader ? 'pt-2' : 'pt-0'}`}>
          <TicketFormCore
            key={`ticket-form-${formKey}-${loadedTicketForEdit?.id || initialData?.id || 'new'}`}
            mode={isEditMode ? "edit" : "add"}
            initialData={parentTicketId ? null : (loadedTicketForEdit || initialData || null)}
            parentTicketId={parentTicketId}
            onCreateSubtaskInPlace={onCreateSubtaskInPlace}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmittingOuter={isSubmitting}
            isLoadingPage={false}
            ticketSection={ticketSection}
            hideHeader={true}
            onSubmitDisabledChange={setIsFormSubmitDisabled}
          />
        </CardContent>
      </Card>
    </div>
  );
}

















// import React, { useState, useEffect } from "react";
// import { Button } from "@/@/components/ui/button";
// import { TicketFormCore } from "./create-ticket-dialog";
// import { Ticket } from "./types/ticket";
// import {
//   CreateOrFetchAlertTypesPayload,
//   EditTicketPayload,
// } from "./types/ticket";
// import { useTickets } from "../hooks/useTickets";
// import { toast } from "sonner";
// import { Minimize2, X, PlusCircle, Loader2, ArrowLeft } from "lucide-react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
// import { ReusableCombobox } from "./reusable-combobox";
// import { ComboboxOption } from "./reusable-combobox";
// import { apiClient } from "../../../../services/apiClient";
// import { encryptPayload } from "../../../../configs/encryptFernet";

// interface CreateTicketDialogProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   initialData?: Ticket | null;
//   parentTicketId?: string;
//   /** When provided (e.g. in top bar ticket modal), "+" opens create subtask on same page instead of navigating */
//   onCreateSubtaskInPlace?: (parentTicketId: string) => void;
//   isMinimized?: boolean;
//   onMinimizeChange?: (minimized: boolean) => void;
//   onSubmitSuccess?: () => void;
//   ticketSection?: string;
// }

// export function CreateTicketDialog({
//   open,
//   onOpenChange,
//   initialData,
//   parentTicketId,
//   onCreateSubtaskInPlace,
//   isMinimized: externalIsMinimized,
//   onMinimizeChange,
//   onSubmitSuccess,
//   ticketSection,
// }: CreateTicketDialogProps) {
//   const [internalMinimized, setInternalMinimized] = useState(false);
//   const [formKey, setFormKey] = useState(0); // Key to reset form
//   const [selectedTaskId, setSelectedTaskId] = useState("");
//   const [taskIdOptions, setTaskIdOptions] = useState<ComboboxOption[]>([]);
//   const [isLoadingTaskIds, setIsLoadingTaskIds] = useState(false);
//   const [loadedTicketForEdit, setLoadedTicketForEdit] = useState<Ticket | null>(null);
//   const [isLoadingTicketDetails, setIsLoadingTicketDetails] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [userBuPermissions, setUserBuPermissions] = useState<string[]>([]);
//   const isMinimized = externalIsMinimized !== undefined ? externalIsMinimized : internalMinimized;

//   const setIsMinimized = (value: boolean) => {
//     if (onMinimizeChange) {
//       onMinimizeChange(value);
//     } else {
//       setInternalMinimized(value);
//     }
//   };
//   const { addTicket, editTicket, tickets: allTickets, refetch: refetchTickets } = useTickets({
//     skipInitialFetch: true,
//     refetchAfterMutation: false,
//   });

//   const isEditMode = !!initialData?.id || !!loadedTicketForEdit?.id;

//   // Fetch user BU permissions on component mount
//   useEffect(() => {
//     const fetchUserPermissions = async () => {
//       try {
//         const response = await apiClient.get('/api/session/me');
//         const userData = response.data;
//         if (userData && userData.bu) {
//           setUserBuPermissions(userData.bu);
//         }
//       } catch (error) {
//         console.error('Failed to fetch user permissions:', error);
//         // Default to empty array if fetch fails
//         setUserBuPermissions([]);
//       }
//     };

//     fetchUserPermissions();
//   }, []);

//   // Cleanup effect to ensure proper state reset when component unmounts
//   React.useEffect(() => {
//     return () => {
//       // Reset any lingering states when component unmounts
//       if (document.activeElement && document.activeElement instanceof HTMLElement) {
//         document.activeElement.blur();
//       }
//     };
//   }, []);

//   useEffect(() => {
//     const loadAllTaskIds = () => {
//       if (isEditMode || !allTickets) return;

//       setIsLoadingTaskIds(true);
//       try {
//         // Filter tickets based on user's BU permissions
//         let filteredTickets = allTickets;

//         if (userBuPermissions.length > 0) {
//           // If user has specific BU permissions, only show tickets from those BUs
//           filteredTickets = allTickets.filter((ticket: any) =>
//             userBuPermissions.includes(ticket.bu)
//           );
//         }
       
//         const options = filteredTickets.map((ticket: any) => ({
//           label: ticket.ticket_id || ticket.id,
//           value: ticket.ticket_id || ticket.id,
//         }));

//         setTaskIdOptions(options);
//       } catch (error) {
//         console.error("Error loading task IDs:", error);
//         setTaskIdOptions([]);
//       } finally {
//         setIsLoadingTaskIds(false);
//       }
//     };

//     loadAllTaskIds();
//   }, [allTickets, isEditMode, userBuPermissions]);

//   useEffect(() => {
//     if (open && !isEditMode) {
//       refetchTickets();
//     }
//   }, [open, isEditMode, refetchTickets]);

//   useEffect(() => {
//     const loadTicketForEdit = async () => {
//       if (selectedTaskId && allTickets.length > 0) {
//         setIsLoadingTicketDetails(true);

//         try {
    
//           const selectedTicket = allTickets.find((ticket: any) =>
//             ticket.ticket_id === selectedTaskId || ticket.id === selectedTaskId
//           );

//           if (selectedTicket && selectedTicket.id) {
          
//             const encryptedTicketId = encryptPayload(selectedTicket.id);
//             const response = await apiClient.get(
//               `/api/ticketing/${encryptedTicketId}`
//             );

//             if (response.data) {
//               const fullTicketData = response.data;
//               console.log("Loaded ticket data:", fullTicketData);
//               setLoadedTicketForEdit(fullTicketData);
//               toast.success(`Loaded ticket ${selectedTaskId} for editing`);
//             } else {
//               console.error("API response structure:", response.data);
//               toast.error("Failed to load ticket details");
//             }
//           } else {
//             toast.error("Ticket not found");
//           }
//         } catch (error) {
//           console.error("Error loading ticket details:", error);
//           toast.error("Failed to load ticket details");
//         } finally {
//           setIsLoadingTicketDetails(false);
//         }
//       }
//     };

//     if (selectedTaskId) {
//       loadTicketForEdit();
//     }
//   }, [selectedTaskId, allTickets]);

//   const handleSubmit = async (
//     payload: CreateOrFetchAlertTypesPayload | EditTicketPayload
//   ) => {
//     setIsSubmitting(true);
//     try {
//       let result:
//         | {
//             success: boolean;
//             ticketId?: string;
//             error?: string;
//             updateId?: string;
//           }
//         | undefined;

//       if (isEditMode) {
//         if (editTicket) {
//           // Determine which ticket data to use - initialData or loadedTicketForEdit
//           const ticketToEdit = initialData || loadedTicketForEdit;
//           const updateId = ticketToEdit?.id;

//           if (!updateId) {
//             toast.error("Cannot edit ticket: Missing ID");
//             setIsSubmitting(false);
//             return { success: false, error: "Missing ID" };
//           }

//           const editPayload = {
//             ...(payload as EditTicketPayload),
//             update_id: String(updateId),
//             parent_id:
//               (payload as any)?.parent_id ?? (ticketToEdit as any)?.parent_id,
//             subtask_id:
//               (payload as any)?.subtask_id ??
//               ((ticketToEdit as any)?.subtask_id ?? []),
//           };

//           result = await editTicket(ticketToEdit.ticket_id, editPayload);

//           if (result.success && result.ticketId) {
//             toast.success("Ticket updated successfully!");
//             setIsSubmitting(false);
//             if (onSubmitSuccess) {
//               onSubmitSuccess();
//             } else {
//               onOpenChange(false);
//             }
//             setIsMinimized(false);
//             setFormKey(prev => prev + 1);
//             setLoadedTicketForEdit(null);
//             setSelectedTaskId("");
//           } else {
//             setIsSubmitting(false);
//             toast.error(
//               `Failed to update ticket: ${result?.error || "Unknown error"}`
//             );
//           }
//         }
//       } else {
//         if (addTicket) {
       
//           const payloadWithTaskId = {
//             ...payload,
//             selected_task_id: selectedTaskId || undefined,
//           } as any;

//           result = await addTicket(payloadWithTaskId);

//           if (result.success && result.ticketId) {
//             toast.success(loadedTicketForEdit ? "Ticket updated successfully!" : "Ticket created successfully!");
//             setIsSubmitting(false);
//             // Close dialog after successful creation or call success callback
//             if (onSubmitSuccess) {
//               onSubmitSuccess();
//             } else {
//               onOpenChange(false);
//             }
//             setIsMinimized(false);
//             setFormKey(prev => prev + 1); // Reset form by changing key
//             setSelectedTaskId(""); // Clear selected task ID
//             setLoadedTicketForEdit(null); // Clear loaded ticket
//           } else {
//             setIsSubmitting(false);
//             toast.error(
//               `Failed to create ticket: ${result?.error || "Unknown error"}`
//             );
//           }
//         }
//       }

//       return result || { success: false };
//     } catch (error: any) {
//       console.error("Dialog submission error:", error);
//       setIsSubmitting(false);
//       toast.error("An unexpected error occurred");
//       return { success: false, error: error.message };
//     }
//   };

//   const handleCancel = () => {
//     onOpenChange(false);
//     setIsMinimized(false);
//     setLoadedTicketForEdit(null); // Clear loaded ticket on cancel
//     setSelectedTaskId(""); // Clear selected task ID
//   };

//   const handleMinimize = () => {
//     setIsMinimized(true);
//   };

//   const handleMaximize = () => {
//     setIsMinimized(false);
//   };

//   const handleDialogOpenChange = (newOpen: boolean) => {
//     if (!newOpen) {
//       // When dialog is closed, reset minimized state and clear loaded ticket
//       setIsMinimized(false);
//       setLoadedTicketForEdit(null);
//       setSelectedTaskId("");
//     }
//     onOpenChange(newOpen);
//   };

//   if (!open) {
//     return null;
//   }

//   return (
//     <>    
//       {/* {isMinimized && (
//         <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-gray-200 shadow-lg">
//           <div className="flex items-center justify-center px-4 py-3">
//             <div className="flex items-center gap-2">
//               <PlusCircle className="h-4 w-4 text-green-600" />
//               <span className="text-sm font-medium text-gray-700">
//                 {isEditMode ? "Editing Ticket" : "Creating Ticket"}
//               </span>
//             </div>
//           </div>
//         </div>
//       )} */}

//       <div className="w-full h-full flex flex-col" >
//         <Card className="w-full flex-1 flex flex-col border border-gray-200 min-h-0">
//           <CardHeader className="border-b py-2 px-3 flex-shrink-0 bg-white">
//             <div className="flex items-center justify-between gap-2">
//             <CardTitle className="flex-1 text-lg font-semibold text-gray-800">
//               {loadedTicketForEdit ? `Edit Ticket: ${loadedTicketForEdit.ticket_id}` : isEditMode ? "Edit Ticket" : "Create New Ticket"}
//             </CardTitle>
//             <div className="flex items-center gap-2">

//                 {/* {!isEditMode && (
//                   <div className="flex items-center gap-2">
//                     <label className="text-sm font-medium text-gray-700">Task ID:</label>
//                     <ReusableCombobox
//                       options={taskIdOptions}
//                       value={selectedTaskId}
//                       onValueChange={setSelectedTaskId}
//                       placeholder={
//                         isLoadingTaskIds || isLoadingTicketDetails
//                           ? "Loading..."
//                           : "Select Task ID to edit"
//                       }
//                       buttonClassName="h-8 w-64"
//                       disabled={isLoadingTaskIds || isLoadingTicketDetails}
//                     />
//                     {isLoadingTicketDetails && (
//                       <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
//                     )}
//                   </div>
//                 )} */}
               
//               {/* <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={handleCancel}
//                 className="h-8 px-2 flex items-center gap-1"
//                 title="Close"
//               >
//                 <ArrowLeft className="h-4 w-4" />
//                 home
//               </Button> */}

//               {/* <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={handleMinimize}
//                 className="h-8 w-8 p-0"
//                 title="Minimize"
//               >
//                 <Minimize2 className="h-4 w-4" />
//               </Button>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={handleCancel}
//                 className="h-8 w-8 p-0"
//                 title="Close"
//               >
//                 <X className="h-4 w-4" />
//               </Button> */}

//             </div>
//             </div>
//           </CardHeader>
//           <CardContent className="p-0 flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
//             <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
//             <TicketFormCore
//               key={`ticket-form-${formKey}-${loadedTicketForEdit?.id || initialData?.id || 'new'}`}
//               mode={isEditMode ? "edit" : "add"}
//               initialData={loadedTicketForEdit || initialData || null}
//               parentTicketId={parentTicketId}
//               onCreateSubtaskInPlace={onCreateSubtaskInPlace}
//               onSubmit={handleSubmit}
//               onCancel={handleCancel}
//               isSubmittingOuter={isSubmitting}
//               isLoadingPage={false}
//               ticketSection={ticketSection}
//             />
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </>
//   );
// }