
import { useState, useEffect, useCallback, useRef } from "react";
import { Ticket, ApiResponse, CreateOrFetchAlertTypesPayload, EditTicketPayload, } from "../types/ticket";
import { apiClient } from "@/services/apiClient";

interface TicketFilters {
  skip?: number;
  limit?: number;
  searchTerm?: string;
  ticket_severity?: string;
  ticket_status?: string;
  category?: string;
  subcategory?: string;
  zone?: string;
  location_id?: string;
  location_name?: string;
  bu?: string;
  plant?: string;
  sap_id?: string;
  parent_id?: string;
  created_date?: string;
}

export interface UseTicketsOptions {
 
  skipInitialFetch?: boolean;
 
  refetchAfterMutation?: boolean;
}

export interface UpdateTicketStatePayload {
  id: number | string;
  ticket_id: string;
  update_id: string;
  bu?: string;
  alert_section?: string;
  ticket_section?: string;
  sop_id?: string;
  sap_id?: string[];
  location_name?: string[];
  zone?: string[];
  region?: string;
  alert_type?: string | string[];
  assignee?: string;
  assignee_name?: string[];
  assignee_mail?: string[];
  summary?: string;
  description?: string;
  ticket_state?: Ticket['ticket_state'];
  ticket_status?: Ticket['ticket_status'];
  ticket_severity?: Ticket['ticket_severity'];
  comment?: string;
  ticket_name?: string;
  alert_id?: string;
  linked_alert_id: any; // must be array
  file_attachment?: string | string[];
  file_attachment_name?: string;
  file_attachment_id?: string;
  start_date: string; // required by API
  ticket_end_date?: string;
  parent_id?: string;
  subtask_id?: string | string[];
  category?: string[];
  sub_category?: string[];
  truck_no?: string[];
  remarks?: string;
  reason?: string;
  auto_ticket_close?: string;
}

export function useTickets(options?: UseTicketsOptions) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [totalTicketCount, setTotalTicketCount] = useState(0);
  const [buCounts, setBuCounts] = useState({ RO: 0, TAS: 0, LPG: 0 });
  const isMountedRef = useRef(true);
  const skipInitialFetch = options?.skipInitialFetch ?? false;
  const refetchAfterMutation = options?.refetchAfterMutation ?? true;
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buildQueryStringForFilters = (
    filters: Omit<TicketFilters, "searchTerm" >
  ): string => {

    const conditions: string[] = [];
    if (filters.bu)
      conditions.push(`bu='${filters.bu}'`);
    if (filters.ticket_severity)
      conditions.push(`ticket_severity='${filters.ticket_severity}'`);
    if (filters.ticket_status)
      conditions.push(`ticket_status='${filters.ticket_status}'`);
    if (filters.category)
      conditions.push(`'${String(filters.category).replace(/'/g, "''")}' = ANY(category)`);
    if (filters.subcategory)
      conditions.push(`'${String(filters.subcategory).replace(/'/g, "''")}' = ANY(sub_category)`);
    if (filters.zone)
      conditions.push(`'${String(filters.zone).replace(/'/g, "''")}' = ANY(zone)`);
    if (filters.plant)
      conditions.push(`'${String(filters.plant).replace(/'/g, "''")}' = ANY(plant)`);
    if (filters.location_id)
      conditions.push(`'${String(filters.location_id).replace(/'/g, "''")}' = ANY(location_id)`);
    if (filters.location_name)
      conditions.push(`'${String(filters.location_name).replace(/'/g, "''")}' = ANY(location_name)`);
    if (filters.sap_id)
      conditions.push(`'${String(filters.sap_id).replace(/'/g, "''")}' = ANY(sap_id)`);
    if (filters.parent_id)
      conditions.push(`parent_id='${filters.parent_id}'`);
    if (filters.created_date)
      conditions.push(
        `created_at::date='${String(filters.created_date).replace(/'/g, "''")}'`
      );

    return conditions.join(" AND ");
  };

  const refetch = useCallback(async (filters: TicketFilters = {}) => {
    if (!isMountedRef.current) return;
    setLoading(true);
    setError("");
    try {
      
      const { skip = 0, limit = 1000, searchTerm, ...otherFilters } = filters;
      const qString = buildQueryStringForFilters(otherFilters);
      const params: any = { skip, limit };
      if (searchTerm) params.search_text = searchTerm;
      if (qString) params.q = qString;
      console.log("Refetching with params:", params);
      const response = await apiClient.get("/api/ticketing", {
        headers: { "Content-Type": "application/json" },
        params,
      });
      
      console.log("response1", response)

      const data: ApiResponse = response.data;
      console.log("data from api", data);
      if (isMountedRef.current) {
        setTickets(data.data || []);
        setTotalTicketCount(data.total || data.data?.length || 0);
        
        // Extract BU counts from API response
        if (data.bu_counts) {
          // If API provides bu_counts directly
          setBuCounts({
            RO: data.bu_counts.RO || data.bu_counts.BU || 0,
            TAS: data.bu_counts.TAS || 0,
            LPG: data.bu_counts.LPG || 0,
          });
        } else {
          // Fallback: Calculate from all tickets data if available
          const allTickets = data.data || [];
          setBuCounts({
            RO: allTickets.filter((t: any) => t.bu === "RO" || t.bu === "BU").length,
            TAS: allTickets.filter((t: any) => t.bu === "TAS").length,
            LPG: allTickets.filter((t: any) => t.bu === "LPG").length,
          });
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch tickets";
        console.error("useTickets: Error fetching tickets:", err);
        setError(errorMessage);
        setTickets([]);
        setTotalTicketCount(0); // Set total to 0 on error
        setBuCounts({ RO: 0, TAS: 0, LPG: 0 }); // Reset BU counts on error
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

 
  useEffect(() => {
    if (!skipInitialFetch) {
      refetch();
    } else {
    
      setLoading(false);
    }
  }, [skipInitialFetch, refetch]);

  const updateTicketState = useCallback(
    async (payload: UpdateTicketStatePayload) => {
      if (isMountedRef.current) {
        setTickets((prevTickets) =>
          prevTickets.map((ticket) =>
            ticket.id === payload.id
              ? {
                  ...ticket,
                  ...(payload.ticket_state !== undefined && { ticket_state: payload.ticket_state }),
                  ...(payload.ticket_status !== undefined && { ticket_status: payload.ticket_status }),
                }
              : ticket
          )
        );
      }

      try {
        const url = "/api/ticketing/update_ticket";
        const { id, ticket_id, ...apiBody } = payload;
        const safeBody = {
          ...apiBody,
          file_attachment: Array.isArray(apiBody.file_attachment)
            ? apiBody.file_attachment
            : apiBody.file_attachment
              ? [apiBody.file_attachment]
              : [],
          file_attachment_name:
            Array.isArray(apiBody.file_attachment_name) && apiBody.file_attachment_name.length > 0
              ? apiBody.file_attachment_name[0]
              : apiBody.file_attachment_name || "",
          file_attachment_id:
            Array.isArray(apiBody.file_attachment_id) && apiBody.file_attachment_id.length > 0
              ? apiBody.file_attachment_id[0]
              : apiBody.file_attachment_id || "",
          alert_type: Array.isArray(apiBody.alert_type)
            ? (apiBody.alert_type.length > 0 ? apiBody.alert_type : [""])
            : apiBody.alert_type
              ? [apiBody.alert_type]
              : [""],
          linked_alert_id: Array.isArray(apiBody.linked_alert_id)
            ? apiBody.linked_alert_id
            : apiBody.linked_alert_id
              ? [apiBody.linked_alert_id]
              : [],
          parent_id: apiBody.parent_id !== undefined && apiBody.parent_id !== null ? String(apiBody.parent_id) : "",
          subtask_id: apiBody.subtask_id !== undefined && apiBody.subtask_id !== null
            ? (Array.isArray(apiBody.subtask_id) ? apiBody.subtask_id : [String(apiBody.subtask_id)])
            : [""],
          category: Array.isArray(apiBody.category)
            ? apiBody.category
            : apiBody.category
              ? [apiBody.category]
              : [],
          sub_category: Array.isArray(apiBody.sub_category)
            ? apiBody.sub_category
            : apiBody.sub_category
              ? [apiBody.sub_category]
              : [],
          reason: apiBody.reason || "",
          // Backend expects these fields as lists; normalize to string[]
          sap_id: Array.isArray(apiBody.sap_id)
            ? apiBody.sap_id
            : apiBody.sap_id
              ? [apiBody.sap_id]
              : [],
          location_name: Array.isArray(apiBody.location_name)
            ? apiBody.location_name
            : apiBody.location_name
              ? [apiBody.location_name]
              : [],
          zone: Array.isArray(apiBody.zone)
            ? apiBody.zone
            : apiBody.zone
              ? [apiBody.zone]
              : [],
          truck_no: Array.isArray(apiBody.truck_no)
            ? apiBody.truck_no
            : apiBody.truck_no
              ? [apiBody.truck_no]
              : [],
          remarks: apiBody.remarks || "",
          ticket_end_date: apiBody.ticket_end_date || "",
          auto_ticket_close: apiBody.auto_ticket_close != null ? String(apiBody.auto_ticket_close) : "",
          assignee: apiBody.assignee ?? "NovexSupport",
          assignee_name: Array.isArray(apiBody.assignee_name) && apiBody.assignee_name.length > 0
            ? apiBody.assignee_name
            : apiBody.assignee ? [apiBody.assignee] : [""],
          assignee_mail: Array.isArray(apiBody.assignee_mail) && apiBody.assignee_mail.length > 0
            ? apiBody.assignee_mail
            : [""],
        };

        console.log("useTickets: Sending update_ticket body:", safeBody);
        const response = await apiClient.post(url, safeBody, {
          headers: { "Content-Type": "application/json" },
        });

        console.log("Ticket state persisted:", response.data);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to persist ticket state update";
        console.error("useTickets: Error persisting ticket state update:", err);
        if (isMountedRef.current) {
          setError(errorMessage);
        }
      }
    },
    []
  );

  const addTicket = useCallback(
    async (
      ticketData: CreateOrFetchAlertTypesPayload
    ): Promise<{
      success: boolean;
      ticketId?: string;
      error?: string;
      updateId?: string;
    }> => {
      if (!isMountedRef.current) {
        return { success: false, error: "Component not mounted" };
      }
      try {
        const response = await apiClient.post( "/api/ticketing/create_ticket",
          ticketData,
          { headers: { "Content-Type": "application/json" } }
        );
        console.log("response", response);

        const ticket = response?.data?.tickets?.[0];
        const ticketId = ticket?.ticket_id;
        const updateId = ticket?.tid;
        console.log("Ticket created successfully:", ticketId, updateId);

        if (isMountedRef.current && refetchAfterMutation) refetch();
        return { success: true, ticketId, updateId };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error creating ticket";
        console.error("useTickets: Error creating ticket:", err);
        return { success: false, error: errorMessage };
      }
    },
    [refetch, refetchAfterMutation]
  );

  // const addTicket = useCallback(
  //   async (
  //     ticketData: CreateOrFetchAlertTypesPayload
  //   ): Promise<{
  //     success: boolean;
  //     ticketId?: string;
  //     error?: string;
  //     updateId?: string;
  //     data?: any; 
  //   }> => {
  //     if (!isMountedRef.current) {
  //       return { success: false, error: "Component not mounted" };
  //     }
  //     try {
  //       console.log("Creating ticket with payload:", ticketData);
  //       const response = await apiClient.post(
  //         "/api/ticketing/create_ticket",
  //         ticketData,
  //         { headers: { "Content-Type": "application/json" } }
  //       );
  //       console.log("Full API response:", response);
  //       console.log("API response data:", response?.data);
  
  //       const ticket = response?.data?.tickets?.[0] || response?.data?.ticket || response?.data;
  //       const ticketId = ticket?.ticket_id || response?.data?.ticket_id;
  //       const updateId = ticket?.tid || ticket?.id || response?.data?.tid || response?.data?.id;
        
  //       console.log("Ticket created successfully:", ticketId, updateId);
  //       console.log("Ticket from API:", ticket);
  
  //       if (isMountedRef.current) refetch();
        
  //       // Construct full ticket object by merging original payload with API response
  //       // This ensures we return the complete ticket structure as expected
  //       const fullTicketData = {
  //         bu: ticketData.bu || ticket?.bu || "",
  //         alert_section: ticketData.alert_section || ticket?.alert_section || "",
  //         sop_id: ticketData.sop_id || ticket?.sop_id || "",
  //         sap_id: ticketData.sap_id || ticket?.sap_id || "",
  //         location_name: ticketData.location_name || ticket?.location_name || "",
  //         zone: ticketData.zone || ticket?.zone || "",
  //         region: ticketData.region || ticket?.region || "",
  //         alert_type: Array.isArray(ticketData.alert_type) 
  //           ? ticketData.alert_type 
  //           : Array.isArray(ticket?.alert_type)
  //           ? ticket.alert_type
  //           : ticketData.alert_type 
  //             ? [ticketData.alert_type] 
  //             : ticket?.alert_type
  //             ? [ticket.alert_type]
  //             : [],
  //         assignee: ticketData.assignee || ticket?.assignee || "NovexSupport",
  //         summary: ticketData.summary || ticket?.summary || "",
  //         description: ticketData.description || ticket?.description || "",
  //         ticket_state: ticketData.ticket_state || ticket?.ticket_state || "ToDo",
  //         ticket_severity: ticketData.ticket_severity || ticket?.ticket_severity || "Critical",
  //         comment: ticketData.comment || ticket?.comment || "",
  //         start_date: ticketData.start_date || ticket?.start_date || new Date().toISOString(),
  //         linked_alert_id: Array.isArray(ticketData.linked_alert_id)
  //           ? ticketData.linked_alert_id
  //           : Array.isArray(ticket?.linked_alert_id)
  //           ? ticket.linked_alert_id
  //           : ticketData.linked_alert_id
  //             ? [ticketData.linked_alert_id]
  //             : ticket?.linked_alert_id
  //             ? [ticket.linked_alert_id]
  //             : [],
  //         file_attachment: Array.isArray(ticketData.file_attachment)
  //           ? ticketData.file_attachment
  //           : Array.isArray(ticket?.file_attachment)
  //           ? ticket.file_attachment
  //           : ticketData.file_attachment
  //             ? [ticketData.file_attachment]
  //             : ticket?.file_attachment
  //             ? [ticket.file_attachment]
  //             : [],
  //         file_attachment_name: ticketData.file_attachment_name || ticket?.file_attachment_name || "",
  //         file_attachment_id: ticketData.file_attachment_id || ticket?.file_attachment_id || "",
  //         // Include any additional fields from API response (like ticket_id, tid, etc.)
  //         ...(ticket || {}),
  //       };
        
  //       console.log("Full ticket data to return:", fullTicketData);
        
  //       // Return the full ticket data
  //       return { 
  //         success: true, 
  //         ticketId, 
  //         updateId,
  //         data: fullTicketData // Include full ticket object with all fields
  //       };
  //     } catch (err) {
  //       const errorMessage =
  //         err instanceof Error ? err.message : "Unknown error creating ticket";
  //       console.error("useTickets: Error creating ticket:", err);
  //       return { success: false, error: errorMessage };
  //     }
  //   },
  //   [refetch]
  // );

  const editTicket = useCallback(
    async (ticketStringId: string, ticketData: EditTicketPayload) => {
      if (!isMountedRef.current)
        return { success: false, error: "Component not mounted" };
      try {
        let updateId = ticketData.update_id;
        let interlockNameFromApi: string | string[] | undefined;
        if (!updateId) {
          console.log(`Fetching id for ticket ${ticketStringId}...`);
          try {
            const ticketResponse = await apiClient.get(`/api/ticketing/${ticketStringId}`);
            updateId = ticketResponse.data.id || ticketResponse.data.update_id;
            interlockNameFromApi = ticketResponse.data.interlock_name;

            console.log(`Fetched id from API: ${updateId}`);
            console.log(`Fetched interlock_name from API:`, interlockNameFromApi);

            if (!updateId) {
              return { success: false, error: "Could not fetch id for ticket update" };
            }
          } catch (fetchErr) {

            console.error("Error fetching id:", fetchErr);
            return { success: false, error: "Failed to fetch ticket details for update" };
          }
        }

        const payload = {
          ...ticketData,
          update_id: updateId,
          alert_type: Array.isArray(ticketData.alert_type)
            ? (ticketData.alert_type.length > 0 ? ticketData.alert_type : [""])
            : ticketData.alert_type
              ? [ticketData.alert_type]
              : [""],
          linked_alert_id: Array.isArray(ticketData.linked_alert_id)
            ? ticketData.linked_alert_id
            : ticketData.linked_alert_id
              ? [ticketData.linked_alert_id]
              : [],
        };

        console.log(`useTickets: Editing ticket ${ticketStringId} with POST to /api/ticketing/update_ticket:`, payload);
        console.log("alert_type being sent:", payload.alert_type);

        const response = await apiClient.post("/api/ticketing/update_ticket",
          payload,
          { headers: { "Content-Type": "application/json" } }
        );

        console.log("Ticket edited successfully:", response.data);
        if (isMountedRef.current && refetchAfterMutation) refetch();
        return { success: true, ticketId: ticketStringId };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error editing ticket";
        console.error("useTickets: Error editing ticket:", err);
        return { success: false, error: errorMessage };
      }
    },
    [refetch, refetchAfterMutation]
  );

  const deleteTicket = useCallback(
    async (
      ticketStringId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!isMountedRef.current) {
        return { success: false, error: "Component not mounted" };
      }
      try {
        console.log(`useTickets: Deleting ticket ${ticketStringId}`);
        const token = localStorage.getItem("accessToken");
        const response = await apiClient.post(
          "/api/ticketing/delete_ticket",
          { delete_id: ticketStringId },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("Ticket deleted successfully:", response.data);
        if (isMountedRef.current) {
          if (refetchAfterMutation) refetch();
        }
        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error deleting ticket";
        console.error("useTickets: Error deleting ticket:", err);
        return { success: false, error: errorMessage };
      }
    },
    [refetch, refetchAfterMutation]
  );

  return {
    tickets,
    loading,
    error,
    refetch,
    updateTicketState,
    addTicket,
    editTicket,
    deleteTicket,
   
    totalTicketCount,
    buCounts,
  };

}