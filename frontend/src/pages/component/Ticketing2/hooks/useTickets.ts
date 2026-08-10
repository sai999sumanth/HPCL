
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Ticket, ApiResponse, CreateOrFetchAlertTypesPayload, EditTicketPayload, } from "../types/ticket";
import { apiClient } from "@/services/apiClient";
import useAuthStore from "@/store/authStore";

interface TicketFilters {
  skip?: number;
  limit?: number;
  append?: boolean;
  silent?: boolean;
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
  created_date_from?: string;
  created_date_to?: string;
  /** Include heavy text/history fields only when explicitly needed (e.g. export). */
  includeDownloadFields?: boolean;
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
  re_assingee_mail?: string[];
  re_assingee_employee_id?: string[];
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
  /** When moving from Escalated, pass the full ticket so it can be added to main list if missing */
  ticketFromEscalated?: Ticket;
  /** Full row before the move — keeps tab-specific lists (Returned/Reviewed OCC, etc.) in sync immediately */
  optimisticBaseTicket?: Ticket;
}

/** Shown on Ticketing2 stage cards (Ticketing2StageCard). `id` is included so navigation + GET-by-id edit load can use the internal row id. */
const TICKETING_CARD_LIST_FIELDS: readonly string[] = [
  "id",
  "start_date",
  "updated_at",
  "linked_alert_id",
  "location_name",
  "zone",
  "ticket_severity",
  "ticket_section",
  "ticket_id",
  "interlock_name",
  "category",
  "ticket_state",
  "sub_category",
  "ticket_status",
  "escalation_level",
  "bu",
  "sap_id",
  "ticket_end_date",
  "assignee_name",
  "assignee_mail",
      "re_assingee_mail",
      "re_assingee_employee_id",
      "reassigne_due_date",
      "employee_id"
];

const TICKETING_DOWNLOAD_EXTRA_FIELDS: readonly string[] = [
  "summary",
  "description",
  "comment",
  "remarks",
  "order_id",
  "truck_no",
  "ticket_history",
  "comment_history",
];

const stripCommentImagesForUpdateApi = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.replace(/<img\b[^>]*>/gi, "").trim();
};

export function useTickets(options?: UseTicketsOptions) {
  const TICKETING_GET_FIELDS = useMemo(() => [...TICKETING_CARD_LIST_FIELDS], []);
  const getTicketingFields = useCallback(
    (includeDownloadFields?: boolean) =>
      includeDownloadFields
        ? [...TICKETING_GET_FIELDS, ...TICKETING_DOWNLOAD_EXTRA_FIELDS]
        : TICKETING_GET_FIELDS,
    [TICKETING_GET_FIELDS]
  );

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [totalTicketCount, setTotalTicketCount] = useState(0);
  const [buCounts, setBuCounts] = useState({ RO: 0, TAS: 0, LPG: 0 });
  const [escalatedTicketsL1, setEscalatedTicketsL1] = useState<Ticket[]>([]);
  const [escalatedTicketsL2, setEscalatedTicketsL2] = useState<Ticket[]>([]);
  const [escalatedLoading, setEscalatedLoading] = useState(false);
  const [escalatedError, setEscalatedError] = useState<string>("");
  const [openTicketsByZone, setOpenTicketsByZone] = useState<Ticket[]>([]);
  const [openTicketsByLocation, setOpenTicketsByLocation] = useState<Ticket[]>([]);
  const [reassignedToOfficerTickets, setReassignedToOfficerTickets] = useState<Ticket[]>([]);
  const [updatedByInitiatorTickets, setUpdatedByInitiatorTickets] = useState<Ticket[]>([]);
  const [returnedByOccTickets, setReturnedByOccTickets] = useState<Ticket[]>([]);
  const [reviewedByOccTickets, setReviewedByOccTickets] = useState<Ticket[]>([]);
  const [openTicketsByZoneTotal, setOpenTicketsByZoneTotal] = useState(0);
  const [openTicketsByLocationTotal, setOpenTicketsByLocationTotal] = useState(0);
  const [reassignedToOfficerTicketsTotal, setReassignedToOfficerTicketsTotal] = useState(0);
  const [updatedByInitiatorTicketsTotal, setUpdatedByInitiatorTicketsTotal] = useState(0);
  const [returnedByOccTicketsTotal, setReturnedByOccTicketsTotal] = useState(0);
  const [reviewedByOccTicketsTotal, setReviewedByOccTicketsTotal] = useState(0);
  const [escalatedTicketsL1Total, setEscalatedTicketsL1Total] = useState(0);
  const [escalatedTicketsL2Total, setEscalatedTicketsL2Total] = useState(0);
  const isMountedRef = useRef(true);
  const skipInitialFetch = options?.skipInitialFetch ?? false;
  const refetchAfterMutation = options?.refetchAfterMutation ?? true;
  const user = useAuthStore((s) => s.user);
  const mergeTicketsByKey = useCallback((existing: Ticket[], incoming: Ticket[]) => {
    const map = new Map<string, Ticket>();
    existing.forEach((ticket) => {
      const key = String(ticket.id ?? ticket.ticket_id);
      map.set(key, ticket);
    });
    incoming.forEach((ticket) => {
      const key = String(ticket.id ?? ticket.ticket_id);
      map.set(key, ticket);
    });
    return Array.from(map.values());
  }, []);
  const getApiTotalCount = useCallback((data: any) => {
    const rawTotal = data?.total_orders_count ?? data?.total ?? data?.count ?? data?.data?.length ?? 0;
    const totalNum = Number(rawTotal);
    return Number.isFinite(totalNum) && totalNum >= 0 ? totalNum : data?.data?.length ?? 0;
  }, []);
  const VIEW_ALL_TICKETS_ROLES = ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"];
  const ZONAL_SOD_TICKETING_ROLE = "Zonal SOD Ticketing";
  const ZONAL_HEAD_SOD_TICKETING_ROLE = "Zonal Head SOD Ticketing";

  const userScopeQuery = useMemo(() => {
    if (!user) return "";

    // HQO HSE LPG, HQO HSE SOD, HQO TICKETING see all tickets (no scope filter)
    const hasViewAllRole = user.novex_role?.some((r) =>
      VIEW_ALL_TICKETS_ROLES.includes(String(r).trim())
    );
    if (hasViewAllRole) return "";

    // Zonal SOD Ticketing: scope by zone + employee_role from session
    // Zonal Head SOD Ticketing: scope by zone + employee_role from session
    const isZonalSodTicketing = user.novex_role?.some(
      (r) => String(r).trim() === ZONAL_SOD_TICKETING_ROLE
    );
    const isZonalHeadSodTicketing = user.novex_role?.some(
      (r) => String(r).trim() === ZONAL_HEAD_SOD_TICKETING_ROLE
    );
    const zones = Array.isArray(user.zone)
      ? user.zone.map((v) => String(v)).filter(Boolean)
      : [];
    const employeeRole =
      user.novex_role
        ?.map((r) => String(r).trim())
        .find(
          (r) => r === ZONAL_SOD_TICKETING_ROLE || r === ZONAL_HEAD_SOD_TICKETING_ROLE
        ) || "";

    if (isZonalSodTicketing || isZonalHeadSodTicketing) {
      const conditions: string[] = [];

      if (zones.length > 0) {
        const zoneConditions = Array.from(new Set(zones)).map(
          (z) => `'${z.replace(/'/g, "''")}' = ANY(zone)`
        );
        conditions.push(
          zoneConditions.length === 1
            ? zoneConditions[0]
            : `(${zoneConditions.join(" OR ")})`
        );
      }

      // For zonal roles, include employee_role when available
      if ((isZonalSodTicketing || isZonalHeadSodTicketing) && employeeRole) {
        const safeEmployeeRole = employeeRole.replace(/'/g, "''");
        conditions.push(`'${safeEmployeeRole}' = ANY(employee_role)`);
      }

      if (conditions.length > 0) {
        return conditions.length === 1
          ? conditions[0]
          : `(${conditions.join(" AND ")})`;
      }
    }

    const sapIds = Array.isArray(user.sap_id)
      ? user.sap_id.map((v) => String(v)).filter(Boolean)
      : [];

    if (sapIds.length > 0) {
      const conditions = Array.from(new Set(sapIds)).map(
        (sap) => `'${sap.replace(/'/g, "''")}' = ANY(sap_id)`
      );
      return conditions.length === 1
        ? conditions[0]
        : `(${conditions.join(" OR ")})`;
    }

    if (zones.length > 0) {
      const conditions = Array.from(new Set(zones)).map(
        (z) => `'${z.replace(/'/g, "''")}' = ANY(zone)`
      );
      return conditions.length === 1
        ? conditions[0]
        : `(${conditions.join(" OR ")})`;
    }

    const email = user.email;
    if (email) {
      const safeEmail = String(email).replace(/'/g, "''");
      return `'${safeEmail}' = ANY(assignee_mail)`;
    }

    return "";
  }, [user]);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /** Call process_escalations and run_alert_closer (fire-and-forget). Used after create and on refetch. */
  const processEscalations = useCallback(async () => {
    try {
      await apiClient.post("/api/ticketing/process_escalations", {}, {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.warn("useTickets: process_escalations failed:", err);
    }
    try {
      await apiClient.post("/api/ticketing/run_alert_closer", {}, {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.warn("useTickets: run_alert_closer failed:", err);
    }
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
    if (filters.created_date_from)
      conditions.push(
        `created_at::date>='${String(filters.created_date_from).replace(/'/g, "''")}'`
      );
    if (filters.created_date_to)
      conditions.push(
        `created_at::date<='${String(filters.created_date_to).replace(/'/g, "''")}'`
      );

    return conditions.join(" AND ");
  };

  const refetch = useCallback(async (filters: TicketFilters = {}) => {
    if (!isMountedRef.current) return;
    setLoading(true);
    setError("");
    processEscalations(); // fire-and-forget: run on every refetch (load, refresh, filters)
    try {
      const { skip = 0, limit = 0, searchTerm, includeDownloadFields = false, ...otherFilters } = filters;
      const filterCondition = buildQueryStringForFilters(otherFilters);
      const combinedCondition = [filterCondition, userScopeQuery]
        .filter(Boolean)
        .join(" AND ");
      const params: any = { skip, limit, fields: JSON.stringify(getTicketingFields(includeDownloadFields)) };
      if (searchTerm) params.search_text = searchTerm;
      if (combinedCondition) params.q = combinedCondition;
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
        const rawTotal =
          data.total_orders_count ?? data.total ?? data.count ?? data.data?.length ?? 0;
        const totalNum = Number(rawTotal);
        setTotalTicketCount(
          Number.isFinite(totalNum) && totalNum >= 0 ? totalNum : data.data?.length ?? 0
        );
        
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
  }, [userScopeQuery, getTicketingFields]);

  /** Separate API for Open tab "By Zone" / "By Location" views. */
  const fetchOpenTabTickets = useCallback(
    async (viewMode: "zone" | "location", filters: TicketFilters = {}) => {
      if (!isMountedRef.current) return;
      try {
        const {
          skip = 0,
          limit = 0,
          append = false,
          silent = false,
          searchTerm,
          includeDownloadFields = false,
          ...otherFilters
        } = filters;

        // For Zone view, explicitly ensure sap_id is NOT included in the payload/filters
        const effectiveFilters: TicketFilters = { ...otherFilters };
        if (viewMode === "zone") {
          delete (effectiveFilters as any).sap_id;
        }

        const baseConditions: string[] = [];

        if (viewMode === "zone") {
      
          baseConditions.push(
            // "zone IS NOT NULL",
            // "array_length(zone, 1) > 0",
            // "(location_name IS NULL OR array_length(location_name, 1) = 0 OR coalesce(btrim(location_name[1]::text), '') = '')"
            "ticket_state = 'Open'",
            "location_name = '{}'"
          );
        } else {
          // By Location: tickets that have both zone and location_name
          // baseConditions.push(
          //   "zone IS NOT NULL",
          //   "array_length(zone, 1) > 0",
          //   "location_name IS NOT NULL",
          //   "array_length(location_name, 1) > 0"
          // );
          baseConditions.push(
            // "zone IS NOT NULL",
            // "array_length(zone, 1) > 0",
            // "location_name IS NOT NULL",
            // "array_length(location_name, 1) > 0",
            // "ticket_state != 'Reassigned'"
            "ticket_state = 'Open'",
             "location_name <> '{}'"
          );
        }

        const baseCondition = baseConditions.join(" AND ");
        const filterCondition = buildQueryStringForFilters(effectiveFilters);

        // Custom scope condition for open tab: for zonal users, only use zone check (no employee_role) for "By Location" view
        let scopeCondition = userScopeQuery;
        if (viewMode === "location") {
          const roles = user?.novex_role?.map((r: any) => String(r).trim()) ?? [];
          const isZonalSodTicketing = roles.includes(ZONAL_SOD_TICKETING_ROLE);
          const isZonalHeadSodTicketing = roles.includes(ZONAL_HEAD_SOD_TICKETING_ROLE);
          const isZonalRole = isZonalSodTicketing || isZonalHeadSodTicketing;
          const userZones = Array.isArray(user?.zone)
            ? (user!.zone as any[]).map((v) => String(v)).filter(Boolean)
            : [];

          if (isZonalRole && userZones.length > 0) {
            const zoneConditions = Array.from(new Set(userZones)).map(
              (z) => `'${z.replace(/'/g, "''")}' = ANY(zone)`
            );
            scopeCondition = zoneConditions.length === 1
              ? zoneConditions[0]
              : `(${zoneConditions.join(" OR ")})`;
          }
        }

        const combinedCondition = [baseCondition, filterCondition, scopeCondition]
          .filter(Boolean)
          .join(" AND ");

        const params: any = {
          skip,
          limit,
          fields: JSON.stringify(getTicketingFields(includeDownloadFields)),
        };
        if (searchTerm) params.search_text = searchTerm;
        if (combinedCondition) params.q = combinedCondition;

        console.log(`Fetching Open tab (${viewMode}) tickets with params:`, params);
        const response = await apiClient.get("/api/ticketing", {
          headers: { "Content-Type": "application/json" },
          params,
        });

        const data: ApiResponse = response.data;
        console.log(`Open tab (${viewMode}) data from api`, data);

        const list = data.data || [];
        if (isMountedRef.current && !silent) {
          if (viewMode === "zone") {
            setOpenTicketsByZone((prev) => (append ? mergeTicketsByKey(prev, list) : list));
          } else {
            setOpenTicketsByLocation((prev) => (append ? mergeTicketsByKey(prev, list) : list));
          }
        }
        const apiTotal = getApiTotalCount(data);
        const totalCount =
          !append && skip === 0 && list.length === 0 ? 0 : apiTotal;
        // Do not overwrite API totals on load-more: paginated responses often omit or zero totals.
        if (isMountedRef.current && !append && !silent) {
          if (viewMode === "zone") {
            setOpenTicketsByZoneTotal(totalCount);
          } else {
            setOpenTicketsByLocationTotal(totalCount);
          }
        }
        return { fetchedCount: list.length, totalCount, data: list };
      } catch (err) {
        console.error(`useTickets: Error fetching Open tab (${viewMode}) tickets:`, err);
        if (isMountedRef.current) {
          if (viewMode === "zone") {
            setOpenTicketsByZoneTotal(0);
          } else {
            setOpenTicketsByLocationTotal(0);
          }
        }
        return { fetchedCount: 0, totalCount: 0, data: [] as Ticket[] };
      }
    },
    [userScopeQuery, user, getTicketingFields, mergeTicketsByKey, getApiTotalCount]
  );

  const fetchEscalatedTickets = useCallback(
    async (escalationLevel: "L1" | "L2", filters: TicketFilters = {}) => {
      if (!isMountedRef.current) return;
      setEscalatedLoading(true);
      setEscalatedError("");
      try {
        const {
          skip = 0,
          limit = 0,
          append = false,
          silent = false,
          searchTerm,
          includeDownloadFields = false,
          ...otherFilters
        } = filters;
        const baseCondition = `escalation_level='${escalationLevel}' AND ticket_state='Escalated'`;
        const filterCondition = buildQueryStringForFilters(otherFilters);

        // Special scope rules for escalated tickets:
        // For BOTH Zonal SOD Ticketing and Zonal Head SOD Ticketing:
        // - L1 and L2 views should be scoped by zone + employee_role from session
        // For all other roles, fall back to generic userScopeQuery.
        let scopeCondition = userScopeQuery;

        const roles = user?.novex_role?.map((r: any) => String(r).trim()) ?? [];
        const isZonalSodTicketing = roles.includes(ZONAL_SOD_TICKETING_ROLE);
        const isZonalHeadSodTicketing = roles.includes(ZONAL_HEAD_SOD_TICKETING_ROLE);

        const isZonalRole = isZonalSodTicketing || isZonalHeadSodTicketing;
        const userZones = Array.isArray(user?.zone)
          ? (user!.zone as any[]).map((v) => String(v)).filter(Boolean)
          : [];
        const employeeRole =
          roles.find(
            (r) => r === ZONAL_SOD_TICKETING_ROLE || r === ZONAL_HEAD_SOD_TICKETING_ROLE
          ) || "";

        if (isZonalRole && userZones.length > 0 && employeeRole) {
          const zoneConditions = Array.from(new Set(userZones)).map(
            (z) => `'${z.replace(/'/g, "''")}' = ANY(zone)`
          );
          const zoneClause =
            zoneConditions.length === 1
              ? zoneConditions[0]
              : `(${zoneConditions.join(" OR ")})`;
          const safeEmployeeRole = employeeRole.replace(/'/g, "''");
          scopeCondition = `(${zoneClause} AND '${safeEmployeeRole}' = ANY(employee_role))`;
        }

        const combinedCondition = [baseCondition, filterCondition, scopeCondition]
          .filter(Boolean)
          .join(" AND ");

        const params: any = {
          skip,
          limit,
          fields: JSON.stringify(getTicketingFields(includeDownloadFields)),
        };
        if (searchTerm) params.search_text = searchTerm;
        if (combinedCondition) params.q = combinedCondition;

        console.log(`Fetching escalated ${escalationLevel} tickets with params:`, params);
        const response = await apiClient.get("/api/ticketing", {
          headers: { "Content-Type": "application/json" },
          params,
        });

        const data: ApiResponse = response.data;
        console.log(`Escalated ${escalationLevel} data from api`, data);

        const escalatedTickets = data.data || [];
        const totalCount = getApiTotalCount(data);
        if (isMountedRef.current && !silent) {
          if (escalationLevel === "L1") {
            setEscalatedTicketsL1((prev) =>
              append ? mergeTicketsByKey(prev, escalatedTickets) : escalatedTickets
            );
            if (!append) setEscalatedTicketsL1Total(totalCount);
          } else {
            setEscalatedTicketsL2((prev) =>
              append ? mergeTicketsByKey(prev, escalatedTickets) : escalatedTickets
            );
            if (!append) setEscalatedTicketsL2Total(totalCount);
          }
        }
        return { fetchedCount: escalatedTickets.length, totalCount, data: escalatedTickets };
      } catch (err) {
        if (isMountedRef.current) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to fetch escalated tickets";
          console.error(`useTickets: Error fetching escalated ${escalationLevel} tickets:`, err);
          setEscalatedError(errorMessage);
          if (escalationLevel === "L1") setEscalatedTicketsL1Total(0);
          if (escalationLevel === "L2") setEscalatedTicketsL2Total(0);
        }
        return { fetchedCount: 0, totalCount: 0, data: [] as Ticket[] };
      } finally {
        if (isMountedRef.current) setEscalatedLoading(false);
      }
    },
    [userScopeQuery, user, getTicketingFields, mergeTicketsByKey, getApiTotalCount]
  );

  /** Separate API for "Updated by Initiator" tab. */
  const fetchUpdatedByInitiatorTickets = useCallback(
    async (filters: TicketFilters = {}) => {
      if (!isMountedRef.current) return;
      try {
        const {
          skip = 0,
          limit = 0,
          append = false,
          silent = false,
          searchTerm,
          bu,
          includeDownloadFields = false,
          ...otherFilters
        } = filters;
        const filterCondition = buildQueryStringForFilters(otherFilters);
        const baseCondition = "ticket_state='Updated By Initiator'";
        const combinedCondition = [baseCondition, filterCondition, userScopeQuery]
          .filter(Boolean)
          .join(" AND ");

        const params: any = {
          skip,
          limit,
          fields: JSON.stringify(getTicketingFields(includeDownloadFields)),
        };
        if (bu) params.bu = bu;
        if (searchTerm) params.search_text = searchTerm;
        if (combinedCondition) params.q = combinedCondition;

        console.log(`Fetching Updated by Initiator tickets with params:`, params);
        const response = await apiClient.get("/api/ticketing", {
          headers: { "Content-Type": "application/json" },
          params,
        });

        const data: ApiResponse = response.data;
        console.log(`Updated by Initiator data from api`, data);

        const list = data.data || [];
        const totalCount = getApiTotalCount(data);
        if (isMountedRef.current && !silent) {
          setUpdatedByInitiatorTickets((prev) => (append ? mergeTicketsByKey(prev, list) : list));
          if (!append) setUpdatedByInitiatorTicketsTotal(totalCount);
        }
        return { fetchedCount: list.length, totalCount, data: list };
      } catch (err) {
        console.error(`useTickets: Error fetching Updated by Initiator tickets:`, err);
        if (isMountedRef.current) setUpdatedByInitiatorTicketsTotal(0);
        return { fetchedCount: 0, totalCount: 0, data: [] as Ticket[] };
      }
    },
    [userScopeQuery, getTicketingFields, mergeTicketsByKey, getApiTotalCount]
  );

  /** Separate API for "Reassign to officer" Open sub-tab. */
  const fetchReassignedToOfficerTickets = useCallback(
    async (filters: TicketFilters = {}) => {
      if (!isMountedRef.current) return;
      try {
        const {
          skip = 0,
          limit = 0,
          append = false,
          silent = false,
          searchTerm,
          bu,
          includeDownloadFields = false,
          ...otherFilters
        } = filters;
        const filterCondition = buildQueryStringForFilters(otherFilters);
        const baseCondition = "ticket_state='Reassigned'";
        
        // Custom scope condition for reassigned tab: for zonal users, only use zone check (no employee_role)
        let scopeCondition = userScopeQuery;
        const roles = user?.novex_role?.map((r: any) => String(r).trim()) ?? [];
        const isZonalSodTicketing = roles.includes(ZONAL_SOD_TICKETING_ROLE);
        const isZonalHeadSodTicketing = roles.includes(ZONAL_HEAD_SOD_TICKETING_ROLE);
        const isZonalRole = isZonalSodTicketing || isZonalHeadSodTicketing;
        const userZones = Array.isArray(user?.zone)
          ? (user!.zone as any[]).map((v) => String(v)).filter(Boolean)
          : [];

        if (isZonalRole && userZones.length > 0) {
          const zoneConditions = Array.from(new Set(userZones)).map(
            (z) => `'${z.replace(/'/g, "''")}' = ANY(zone)`
          );
          scopeCondition = zoneConditions.length === 1
            ? zoneConditions[0]
            : `(${zoneConditions.join(" OR ")})`;
        }

        const combinedCondition = [baseCondition, filterCondition, scopeCondition]
          .filter(Boolean)
          .join(" AND ");

        const params: any = {
          skip,
          limit,
          fields: JSON.stringify(getTicketingFields(includeDownloadFields)),
        };
        if (bu) params.bu = bu;
        if (searchTerm) params.search_text = searchTerm;
        if (combinedCondition) params.q = combinedCondition;

        console.log(`Fetching Reassigned to officer tickets with params:`, params);
        const response = await apiClient.get("/api/ticketing", {
          headers: { "Content-Type": "application/json" },
          params,
        });

        const data: ApiResponse = response.data;
        console.log(`Reassigned to officer data from api`, data);

        const list = data.data || [];
        const totalCount = getApiTotalCount(data);
        if (isMountedRef.current && !silent) {
          setReassignedToOfficerTickets((prev) => (append ? mergeTicketsByKey(prev, list) : list));
          if (!append) setReassignedToOfficerTicketsTotal(totalCount);
        }
        return { fetchedCount: list.length, totalCount, data: list };
      } catch (err) {
        console.error(`useTickets: Error fetching Reassigned to officer tickets:`, err);
        if (isMountedRef.current) setReassignedToOfficerTicketsTotal(0);
        return { fetchedCount: 0, totalCount: 0, data: [] as Ticket[] };
      }
    },
    [userScopeQuery, user, getTicketingFields, mergeTicketsByKey, getApiTotalCount]
  );

  /** Separate API for "Returned by OCC" tab. */
  const fetchReturnedByOccTickets = useCallback(
    async (filters: TicketFilters = {}) => {
      if (!isMountedRef.current) return;
      try {
        const {
          skip = 0,
          limit = 0,
          append = false,
          silent = false,
          searchTerm,
          bu,
          includeDownloadFields = false,
          ...otherFilters
        } = filters;
        const filterCondition = buildQueryStringForFilters(otherFilters);
        const baseCondition = "ticket_state='Returned By Occ'";
        const combinedCondition = [baseCondition, filterCondition, userScopeQuery]
          .filter(Boolean)
          .join(" AND ");

        const params: any = {
          skip,
          limit,
          fields: JSON.stringify(getTicketingFields(includeDownloadFields)),
        };
        if (bu) params.bu = bu;
        if (searchTerm) params.search_text = searchTerm;
        if (combinedCondition) params.q = combinedCondition;

        console.log(`Fetching Returned by OCC tickets with params:`, params);
        const response = await apiClient.get("/api/ticketing", {
          headers: { "Content-Type": "application/json" },
          params,
        });

        const data: ApiResponse = response.data;
        console.log(`Returned by OCC data from api`, data);

        const list = data.data || [];
        const totalCount = getApiTotalCount(data);
        if (isMountedRef.current && !silent) {
          setReturnedByOccTickets((prev) => (append ? mergeTicketsByKey(prev, list) : list));
          if (!append) setReturnedByOccTicketsTotal(totalCount);
        }
        return { fetchedCount: list.length, totalCount, data: list };
      } catch (err) {
        console.error(`useTickets: Error fetching Returned by OCC tickets:`, err);
        if (isMountedRef.current) setReturnedByOccTicketsTotal(0);
        return { fetchedCount: 0, totalCount: 0, data: [] as Ticket[] };
      }
    },
    [userScopeQuery, getTicketingFields, mergeTicketsByKey, getApiTotalCount]
  );

  /** Separate API for "Reviewed by OCC" tab. */
  const fetchReviewedByOccTickets = useCallback(
    async (filters: TicketFilters = {}) => {
      if (!isMountedRef.current) return;
      try {
        const {
          skip = 0,
          limit = 0,
          append = false,
          silent = false,
          searchTerm,
          bu,
          includeDownloadFields = false,
          ...otherFilters
        } = filters;
        const filterCondition = buildQueryStringForFilters(otherFilters);
        const baseCondition = "ticket_state='Reviewed By Occ'";
        const combinedCondition = [baseCondition, filterCondition, userScopeQuery]
          .filter(Boolean)
          .join(" AND ");

        const params: any = {
          skip,
          limit,
          fields: JSON.stringify(getTicketingFields(includeDownloadFields)),
        };
        if (bu) params.bu = bu;
        if (searchTerm) params.search_text = searchTerm;
        if (combinedCondition) params.q = combinedCondition;

        console.log(`Fetching Reviewed by OCC tickets with params:`, params);
        const response = await apiClient.get("/api/ticketing", {
          headers: { "Content-Type": "application/json" },
          params,
        });

        const data: ApiResponse = response.data;
        console.log(`Reviewed by OCC data from api`, data);

        const list = data.data || [];
        const totalCount = getApiTotalCount(data);
        if (isMountedRef.current && !silent) {
          setReviewedByOccTickets((prev) => (append ? mergeTicketsByKey(prev, list) : list));
          if (!append) setReviewedByOccTicketsTotal(totalCount);
        }
        return { fetchedCount: list.length, totalCount, data: list };
      } catch (err) {
        console.error(`useTickets: Error fetching Reviewed by OCC tickets:`, err);
        if (isMountedRef.current) setReviewedByOccTicketsTotal(0);
        return { fetchedCount: 0, totalCount: 0, data: [] as Ticket[] };
      }
    },
    [userScopeQuery, getTicketingFields, mergeTicketsByKey, getApiTotalCount]
  );

  useEffect(() => {
    if (!skipInitialFetch) {
      // refetch(); // Main list fetch disabled: dashboard uses tab-specific APIs.
      // Still run escalation processing on load (was previously inside refetch).
      void processEscalations();
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [skipInitialFetch, processEscalations]);

  const updateTicketState = useCallback(
    async (payload: UpdateTicketStatePayload): Promise<boolean> => {
      if (isMountedRef.current) {
        const matchId = (t: Ticket) =>
          String(t.id) === String(payload.id) || String(t.ticket_id) === String(payload.ticket_id);
        setTickets((prevTickets) => {
          const exists = prevTickets.some(matchId);
          if (exists) {
            return prevTickets.map((ticket) =>
              matchId(ticket)
                ? {
                    ...ticket,
                    ...(payload.ticket_state !== undefined && { ticket_state: payload.ticket_state }),
                    ...(payload.ticket_status !== undefined && { ticket_status: payload.ticket_status }),
                  }
                : ticket
            );
          }
          // Ticket was only in escalated; add to main list with updated state
          const fromEscalated = payload.ticketFromEscalated;
          if (fromEscalated && payload.ticket_state !== undefined) {
            return [
              ...prevTickets,
              {
                ...fromEscalated,
                ticket_state: payload.ticket_state,
                ticket_status: payload.ticket_status ?? fromEscalated.ticket_status,
              },
            ];
          }
          return prevTickets;
        });
        // When moving out of Escalated, remove from escalated lists immediately so UI updates
        if (payload.ticket_state !== undefined && payload.ticket_state !== "Escalated") {
          setEscalatedTicketsL1((prev) => prev.filter((t) => !matchId(t)));
          setEscalatedTicketsL2((prev) => prev.filter((t) => !matchId(t)));
        }
        // When moving out of Open, remove from Open "By Zone" / "By Location" lists immediately
        // so that the Open tab reflects the change without waiting for a refetch.
        if (payload.ticket_state !== undefined && payload.ticket_state !== "Open") {
          setOpenTicketsByZone((prev) => prev.filter((t) => !matchId(t)));
          setOpenTicketsByLocation((prev) => prev.filter((t) => !matchId(t)));
        }
        // Keep "Reassign to officer" list in sync optimistically.
        // Without this, a ticket moved from Reassigned -> Updated By Initiator
        // can temporarily appear in both tabs until a manual refresh.
        setReassignedToOfficerTickets((prev) => {
          const withoutCurrent = prev.filter((t) => !matchId(t));
          const nextState = String(payload.ticket_state ?? "").trim();
          if (nextState !== "Reassigned") {
            return withoutCurrent;
          }

          const previousTicket = prev.find(matchId);
          if (previousTicket) {
            return [
              ...withoutCurrent,
              {
                ...previousTicket,
                ...(payload.ticket_state !== undefined && { ticket_state: payload.ticket_state }),
                ...(payload.ticket_status !== undefined && { ticket_status: payload.ticket_status }),
              },
            ];
          }

          const fromEscalated = payload.ticketFromEscalated;
          if (fromEscalated) {
            return [
              ...withoutCurrent,
              {
                ...fromEscalated,
                ticket_state: payload.ticket_state,
                ticket_status: payload.ticket_status ?? fromEscalated.ticket_status,
              },
            ];
          }
          return withoutCurrent;
        });
        // Keep Updated by Initiator list in sync optimistically for board UX.
        setUpdatedByInitiatorTickets((prev) => {
          const withoutCurrent = prev.filter((t) => !matchId(t));
          if (payload.ticket_state === "Updated By Initiator") {
            const base =
              prev.find(matchId) ??
              payload.optimisticBaseTicket ??
              payload.ticketFromEscalated;
            if (base) {
              return [
                ...withoutCurrent,
                {
                  ...base,
                  ticket_state: payload.ticket_state,
                  ticket_status: payload.ticket_status ?? base.ticket_status,
                },
              ];
            }
          }
          return withoutCurrent;
        });
        setReturnedByOccTickets((prev) => {
          const withoutCurrent = prev.filter((t) => !matchId(t));
          if (payload.ticket_state === "Returned By Occ") {
            const base =
              prev.find(matchId) ??
              payload.optimisticBaseTicket ??
              payload.ticketFromEscalated;
            if (base) {
              return [
                ...withoutCurrent,
                {
                  ...base,
                  ticket_state: payload.ticket_state,
                  ticket_status: payload.ticket_status ?? base.ticket_status,
                },
              ];
            }
          }
          return withoutCurrent;
        });
        setReviewedByOccTickets((prev) => {
          const withoutCurrent = prev.filter((t) => !matchId(t));
          if (payload.ticket_state === "Reviewed By Occ") {
            const base =
              prev.find(matchId) ??
              payload.optimisticBaseTicket ??
              payload.ticketFromEscalated;
            if (base) {
              return [
                ...withoutCurrent,
                {
                  ...base,
                  ticket_state: payload.ticket_state,
                  ticket_status: payload.ticket_status ?? base.ticket_status,
                },
              ];
            }
          }
          return withoutCurrent;
        });
      }

      try {
        const url = "/api/ticketing/update_ticket";
        const {
          id,
          ticket_id,
          ticketFromEscalated: _ticketFromEscalated,
          optimisticBaseTicket: _optimisticBaseTicket,
          ...apiBody
        } = payload;
        const safeBody = {
          ...apiBody,
          comment: stripCommentImagesForUpdateApi(apiBody.comment),
          // file_attachment: Array.isArray(apiBody.file_attachment)
          //   ? apiBody.file_attachment
          //   : apiBody.file_attachment
          //     ? [apiBody.file_attachment]
          //     : [],
          // file_attachment_name:
          //   Array.isArray(apiBody.file_attachment_name) && apiBody.file_attachment_name.length > 0
          //     ? apiBody.file_attachment_name[0]
          //     : apiBody.file_attachment_name || "",
          // file_attachment_id:
          //   Array.isArray(apiBody.file_attachment_id) && apiBody.file_attachment_id.length > 0
          //     ? apiBody.file_attachment_id[0]
          //     : apiBody.file_attachment_id || "",
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
          re_assingee_mail:
            Array.isArray(apiBody.re_assingee_mail) && apiBody.re_assingee_mail.length > 0
              ? apiBody.re_assingee_mail
              : [],
          re_assingee_employee_id:
            Array.isArray(apiBody.re_assingee_employee_id) &&
            apiBody.re_assingee_employee_id.length > 0
              ? apiBody.re_assingee_employee_id
              : [],
        };

        console.log("useTickets: Sending update_ticket body:", safeBody);
        const response = await apiClient.post(url, safeBody, {
          headers: { "Content-Type": "application/json" },
        });

        console.log("Ticket state persisted:", response.data);
        void processEscalations();
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to persist ticket state update";
        console.error("useTickets: Error persisting ticket state update:", err);
        if (isMountedRef.current) {
          setError(errorMessage);
        }
        return false;
      }
    },
    [processEscalations]
  );

  const addTicket = useCallback(
    async (
      ticketData: CreateOrFetchAlertTypesPayload
    ): Promise<{
      success: boolean;
      ticketId?: string;
      error?: string;
      updateId?: string;
      /** One entry per ticket row returned by create_ticket (for multi-create + attach per tid). */
      createdTickets?: Array<{ ticketId: string; tid: string }>;
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

        const list = Array.isArray(response?.data?.tickets)
          ? response.data.tickets
          : [];
        const ticket = list[0];
        const ticketId = ticket?.ticket_id;
        const updateId = ticket?.tid;
        const createdTickets = list
          .map((t: any) => ({
            ticketId:
              t?.ticket_id != null && t?.ticket_id !== ""
                ? String(t.ticket_id)
                : "",
            tid: t?.tid != null && t?.tid !== "" ? String(t.tid) : "",
          }))
          .filter((row) => row.ticketId && row.tid);
        console.log("Ticket created successfully:", ticketId, updateId, {
          count: createdTickets.length,
        });

        // Do not block ticket creation UX on escalation processing.
        // Run in background so the caller can navigate immediately.
        void processEscalations();
        return {
          success: true,
          ticketId,
          updateId,
          createdTickets:
            createdTickets.length > 0 ? createdTickets : undefined,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error creating ticket";
        console.error("useTickets: Error creating ticket:", err);
        return { success: false, error: errorMessage };
      }
    },
    [processEscalations]
  );

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
          comment: stripCommentImagesForUpdateApi(ticketData.comment),
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
        void processEscalations();
        return { success: true, ticketId: ticketStringId };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error editing ticket";
        console.error("useTickets: Error editing ticket:", err);
        return { success: false, error: errorMessage };
      }
    },
    [processEscalations]
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
        void processEscalations();
        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error deleting ticket";
        console.error("useTickets: Error deleting ticket:", err);
        return { success: false, error: errorMessage };
      }
    },
    [processEscalations]
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
    escalatedTicketsL1,
    escalatedTicketsL2,
    escalatedLoading,
    escalatedError,
    fetchEscalatedTickets,
    openTicketsByZone,
    openTicketsByLocation,
    openTicketsByZoneTotal,
    openTicketsByLocationTotal,
    reassignedToOfficerTickets,
    reassignedToOfficerTicketsTotal,
    fetchOpenTabTickets,
    fetchReassignedToOfficerTickets,
    updatedByInitiatorTickets,
    updatedByInitiatorTicketsTotal,
    fetchUpdatedByInitiatorTickets,
    returnedByOccTickets,
    returnedByOccTicketsTotal,
    fetchReturnedByOccTickets,
    reviewedByOccTickets,
    reviewedByOccTicketsTotal,
    escalatedTicketsL1Total,
    escalatedTicketsL2Total,
    fetchReviewedByOccTickets,
    processEscalations,
  };
}