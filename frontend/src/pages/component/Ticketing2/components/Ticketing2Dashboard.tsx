import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTickets } from "../hooks/useTickets";
import { Ticket } from "../types/ticket";
import { Ticketing2StageBoard } from "./Ticketing2StageBoard";
import { TicketStats } from "./ticket-stats";
import { getStateAndStatusFromStage, type Ticketing2StageId } from "./Ticketing2StageCard";
import { useNavigate } from "react-router-dom";
import { Search, RefreshCw, X, Plus, Filter, Download, Loader2 } from "lucide-react";
import { Input } from "@/@/components/ui/input";
import { Button } from "@/@/components/ui/button";
import { useDebounce } from "../hooks/useDebounce";
import { motion } from "framer-motion";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { useLocations } from "../hooks/useLocations";
import useAuthStore from "@/store/authStore";
import { apiClient } from "@/services/apiClient";

const BU_OPTIONS = [
  { value: "all", label: "All BU" },
  { value: "TAS", label: "TAS" },
  { value: "RO", label: "RO" },
  { value: "LPG", label: "LPG" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "all", label: "All Severity" },
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
] as const;

// ReOpen and OnCompleted are not shown in filter; they still appear as columns on the dashboard
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "Open", label: "Open" },
  { value: "Close", label: "Close" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "Transportation Discipline", label: "Transportation Discipline" },
  { value: "Inventory Management", label: "Inventory Management" },
  { value: "Safety Performance", label: "Safety Performance" },
  { value: "Asset Integrity", label: "Asset Integrity" },
  { value: "VTS Live Tracking", label: "VTS Live Tracking" },
] as const;

const SUBCATEGORY_OPTIONS = [
  { value: "all", label: "All Subcategories" },
  { value: "Route Correction", label: "Route Correction" },
  { value: "Combination of Alerts", label: "Combination of Alerts" },
  { value: "Governance – ITDG", label: "Governance – ITDG" },
  { value: "EM Locking Exceptions", label: "EM Locking Exceptions" },
  { value: "TT Shortages", label: "TT Shortages" },
  { value: "Auto Reco", label: "Auto Reco" },
  { value: "AIM Hold", label: "AIM Hold" },
  { value: "Abnormal Gain Loss", label: "Abnormal Gain Loss" },
  { value: "No VTS No Load", label: "No VTS No Load" },
  { value: "PM Orders", label: "PM Orders" },
  { value: "Fire Engine", label: "Fire Engine" },
  { value: "Fire Water Availability", label: "Fire Water Availability" },
  { value: "Foam Availability", label: "Foam Availability" },
  { value: "CCTV VA Analytics", label: "CCTV VA Analytics" },
  { value: "Route Deviation with Stoppage", label: "Route Deviation with Stoppage" },
  { value: "Route Deviation without Stoppage", label: "Route Deviation without Stoppage" },
  { value: "Stoppage without Route Deviation", label: "Stoppage without Route Deviation" },
  { value: "Night Driving", label: "Night Driving" },
  { value: "Difference in TAS vs Reconcile Dip - Monthend", label: "Difference in TAS vs Reconcile Dip - Monthend" },
  { value: "Power Disconnect Analysis", label: "Power Disconnect Analysis" },
  { value: "Multiple TT Stoppage at Same Spot", label: "Multiple TT Stoppage at Same Spot" },
] as const;

/** Roles that can move OCC review stages on the Ticketing2 board. */
const OCC_DRAG_ROLES = ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"];
/** Roles that are allowed to create tickets. */
const CREATE_TICKET_ROLES = ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"];
/** Roles that can move tickets into "Updated by Initiator" (e.g. from Returned by Occ). */
const INITIATOR_UPDATE_ROLES = ["Location In-Charge SOD", "Plant In-Charge SOD", "Zonal SOD Ticketing"];
/** Roles that can drag from Open to "Updated by Initiator". Location/Plant In-Charge SOD + Zonal SOD Ticketing. */
const INITIATOR_UPDATE_FROM_OPEN_ROLES = ["Location In-Charge SOD", "Plant In-Charge SOD", "Zonal SOD Ticketing"];
/** Roles that can drag from Escalated (L1) to "Updated by Initiator". Only Zonal SOD Ticketing. */
const INITIATOR_UPDATE_FROM_L1_ROLES = ["Zonal SOD Ticketing"];
/** Roles that can drag from Escalated (L2) to "Updated by Initiator". Only Zonal Head SOD Ticketing. */
const INITIATOR_UPDATE_FROM_L2_ROLES = ["Zonal Head SOD Ticketing"];
/** Roles where drag should be restricted based on escalation_level ("" can drag, L1/L2 cannot). */
const LOCATION_OR_PLANT_INCHARGE_SOD_ROLES = ["Location In-Charge SOD", "Plant In-Charge SOD"];
const LOCATION_INCHARGE_SOD_ROLES = ["Location In-Charge SOD", "Plant In-Charge SOD"];
const PAGE_SIZE = 10;

const roleMatches = (role: unknown, expectedRole: string): boolean => {
  const normalizedRole = String(role ?? "").trim();
  const normalizedExpectedRole = String(expectedRole ?? "").trim();
  if (!normalizedRole || !normalizedExpectedRole) return false;
  return normalizedRole === normalizedExpectedRole || normalizedRole.includes(normalizedExpectedRole);
};

interface Ticketing2DashboardProps {
  /**
   * Optional override for how "Create Ticket" behaves.
   * When provided (e.g. TopBar overlay), this is used instead of route navigation.
   */
  onCreateTicketClick?: () => void;
  /**
   * Optional override for how clicking a ticket behaves.
   * When provided (e.g. overlay modals), this is used instead of route navigation.
   */
  onTicketClick?: (ticket: Ticket) => void;
}

export function Ticketing2Dashboard({ onCreateTicketClick, onTicketClick }: Ticketing2DashboardProps = {}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    loading,
    error,
    updateTicketState,
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
  } = useTickets();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
  const [buFilter, setBuFilter] = useState("all");
  const { zones, plants } = useLocations();
  const [escalatedLevel, setEscalatedLevel] = useState<"L1" | "L2">("L1");
  const [openViewMode, setOpenViewMode] = useState<"zone" | "location">("location");
  const [openLocationSubView, setOpenLocationSubView] = useState<
    "locationInCharge" | "reassignPlantOfficer"
  >("locationInCharge");
  const [pageByKey, setPageByKey] = useState<Record<string, number>>({
    open_zone: 0,
    open_location_lic: 0,
    open_location_reassign: 0,
    escalated_l1: 0,
    escalated_l2: 0,
    updated: 0,
    returned: 0,
    reviewed: 0,
  });
  const [hasMoreByKey, setHasMoreByKey] = useState<Record<string, boolean>>({
    open_zone: true,
    open_location_lic: true,
    open_location_reassign: true,
    escalated_l1: true,
    escalated_l2: true,
    updated: true,
    returned: true,
    reviewed: true,
  });
  const [loadingMoreByKey, setLoadingMoreByKey] = useState<Record<string, boolean>>({});
  const [isRefreshingBoard, setIsRefreshingBoard] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isDownloadDatePopoverOpen, setIsDownloadDatePopoverOpen] = useState(false);
  const [downloadDateFrom, setDownloadDateFrom] = useState("");
  const [downloadDateTo, setDownloadDateTo] = useState("");
  const [showSlowRefreshLoader, setShowSlowRefreshLoader] = useState(false);
  const slowRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [boardVisibilityMeta, setBoardVisibilityMeta] = useState<{
    totalVisible: number;
    overdueAny: boolean;
  } | null>(null);

  const handleBoardVisibilityTotalsChange = useCallback(
    (payload: { totalVisible: number; overdueAny: boolean }) => {
      setBoardVisibilityMeta(payload);
    },
    []
  );

  const totalTicketCountFromTabs = useMemo(
    () =>
      openTicketsByZoneTotal +
      openTicketsByLocationTotal +
      reassignedToOfficerTicketsTotal +
      escalatedTicketsL1Total +
      escalatedTicketsL2Total +
      updatedByInitiatorTicketsTotal +
      returnedByOccTicketsTotal +
      reviewedByOccTicketsTotal,
    [
      openTicketsByZoneTotal,
      openTicketsByLocationTotal,
      reassignedToOfficerTicketsTotal,
      escalatedTicketsL1Total,
      escalatedTicketsL2Total,
      updatedByInitiatorTicketsTotal,
      returnedByOccTicketsTotal,
      reviewedByOccTicketsTotal,
    ]
  );
  const allTicketsFromTabs = useMemo(() => {
    const ticketMap = new Map<string, Ticket>();
    const lists: Ticket[][] = [
      openTicketsByZone,
      openTicketsByLocation,
      reassignedToOfficerTickets,
      escalatedTicketsL1,
      escalatedTicketsL2,
      updatedByInitiatorTickets,
      returnedByOccTickets,
      reviewedByOccTickets,
    ];
    lists.forEach((list) => {
      list.forEach((ticket) => {
        const key = String(ticket.id ?? ticket.ticket_id);
        ticketMap.set(key, ticket);
      });
    });
    return Array.from(ticketMap.values());
  }, [
    openTicketsByZone,
    openTicketsByLocation,
    reassignedToOfficerTickets,
    escalatedTicketsL1,
    escalatedTicketsL2,
    updatedByInitiatorTickets,
    returnedByOccTickets,
    reviewedByOccTickets,
  ]);
  const canMoveOccStages = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) => OCC_DRAG_ROLES.some((role) => roleMatches(r, role)))
      ),
    [user?.novex_role]
  );
  const canCreateTicket = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) => CREATE_TICKET_ROLES.some((role) => roleMatches(r, role)))
      ),
    [user?.novex_role]
  );
  const canMoveToUpdatedByInitiator = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) => INITIATOR_UPDATE_ROLES.some((role) => roleMatches(r, role)))
      ),
    [user?.novex_role]
  );
  const canMoveFromOpenToUpdatedByInitiator = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) =>
          INITIATOR_UPDATE_FROM_OPEN_ROLES.some((role) => roleMatches(r, role))
        )
      ),
    [user?.novex_role]
  );
  const canMoveFromL1ToUpdatedByInitiator = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) =>
          INITIATOR_UPDATE_FROM_L1_ROLES.some((role) => roleMatches(r, role))
        )
      ),
    [user?.novex_role]
  );
  const canMoveFromL2ToUpdatedByInitiator = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) =>
          INITIATOR_UPDATE_FROM_L2_ROLES.some((role) => roleMatches(r, role))
        )
      ),
    [user?.novex_role]
  );
  const restrictDragByEscalationForLocationOrPlantIncharge = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) =>
          LOCATION_OR_PLANT_INCHARGE_SOD_ROLES.some((role) => roleMatches(r, role))
        )
      ),
    [user?.novex_role]
  );
  /** Zonal SOD Ticketing: no board drags while Open is "By Location" (By Zone unchanged; other roles unchanged). */
  const disableZonalSodDragWhenOpenByLocation = useMemo(
    () =>
      openViewMode === "location" &&
      Boolean(
        user?.novex_role?.some((r) => roleMatches(r, "Zonal SOD Ticketing"))
      ),
    [user?.novex_role, openViewMode]
  );
  const ticketApiFilters = useMemo(
    () => ({
      ticket_severity: severityFilter !== "all" ? severityFilter : undefined,
      ticket_status: statusFilter !== "all" ? statusFilter : undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      subcategory: subcategoryFilter !== "all" ? subcategoryFilter : undefined,
      zone: zoneFilter !== "all" ? zoneFilter : undefined,
      sap_id: plantFilter !== "all" ? plantFilter : undefined,
      bu: buFilter !== "all" ? buFilter : undefined,
    }),
    [
      severityFilter,
      statusFilter,
      categoryFilter,
      subcategoryFilter,
      zoneFilter,
      plantFilter,
      buFilter,
    ]
  );

  const isLocationInchargeSodUser = useMemo(
    () =>
      Boolean(
        user?.novex_role?.some((r) =>
          LOCATION_INCHARGE_SOD_ROLES.some((role) => roleMatches(r, role))
        )
      ),
    [user?.novex_role]
  );

  const hasNonEmptyLocationName = (ticket: Ticket): boolean => {
    const loc = (ticket as any).location_name;
    if (Array.isArray(loc)) {
      return loc.some((v) => String(v ?? "").trim() !== "");
    }
    return String(loc ?? "").trim() !== "";
  };

  /** Resets pagination to page 0 and reloads every stage-col/tab API (same as initial load). */
  const refetchAllBoardTabsFirstPage = useCallback(
    async (shouldCommitResults?: () => boolean) => {
      const isSearching = Boolean(debouncedSearch.trim());
      const firstPageLimit = isSearching ? 0 : PAGE_SIZE;
      const filtersWithSearch = {
        ...ticketApiFilters,
        searchTerm: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      };
      setPageByKey({
        open_zone: 0,
        open_location_lic: 0,
        open_location_reassign: 0,
        escalated_l1: 0,
        escalated_l2: 0,
        updated: 0,
        returned: 0,
        reviewed: 0,
      });
      const [
        l1,
        l2,
        openZone,
        openLocation,
        reassign,
        updated,
        returned,
        reviewed,
      ] = await Promise.all([
        fetchEscalatedTickets("L1", { ...filtersWithSearch, skip: 0, limit: firstPageLimit }),
        fetchEscalatedTickets("L2", { ...filtersWithSearch, skip: 0, limit: firstPageLimit }),
        fetchOpenTabTickets("zone", { ...filtersWithSearch, skip: 0, limit: firstPageLimit }),
        fetchOpenTabTickets("location", { ...filtersWithSearch, skip: 0, limit: firstPageLimit }),
        fetchReassignedToOfficerTickets({ ...filtersWithSearch, skip: 0, limit: firstPageLimit }),
        fetchUpdatedByInitiatorTickets({ ...filtersWithSearch, skip: 0, limit: firstPageLimit }),
        fetchReturnedByOccTickets({ ...filtersWithSearch, skip: 0, limit: firstPageLimit }),
        fetchReviewedByOccTickets({ ...filtersWithSearch, skip: 0, limit: firstPageLimit }),
      ]);
      if (shouldCommitResults && !shouldCommitResults()) return;
      setHasMoreByKey({
        open_zone: !isSearching && (openZone?.fetchedCount ?? 0) >= PAGE_SIZE,
        open_location_lic: !isSearching && (openLocation?.fetchedCount ?? 0) >= PAGE_SIZE,
        open_location_reassign: !isSearching && (reassign?.fetchedCount ?? 0) >= PAGE_SIZE,
        escalated_l1: !isSearching && (l1?.fetchedCount ?? 0) >= PAGE_SIZE,
        escalated_l2: !isSearching && (l2?.fetchedCount ?? 0) >= PAGE_SIZE,
        updated: !isSearching && (updated?.fetchedCount ?? 0) >= PAGE_SIZE,
        returned: !isSearching && (returned?.fetchedCount ?? 0) >= PAGE_SIZE,
        reviewed: !isSearching && (reviewed?.fetchedCount ?? 0) >= PAGE_SIZE,
      });
    },
    [
      ticketApiFilters,
      debouncedSearch,
      fetchEscalatedTickets,
      fetchOpenTabTickets,
      fetchReassignedToOfficerTickets,
      fetchUpdatedByInitiatorTickets,
      fetchReturnedByOccTickets,
      fetchReviewedByOccTickets,
    ]
  );

  const runBoardRefreshWithDelayedLoader = useCallback(
    async (refreshFn: () => Promise<void>) => {
      setIsRefreshingBoard(true);
      setShowSlowRefreshLoader(false);
      if (slowRefreshTimerRef.current) {
        clearTimeout(slowRefreshTimerRef.current);
      }
      slowRefreshTimerRef.current = setTimeout(() => {
        setShowSlowRefreshLoader(true);
      }, 700);

      try {
        await refreshFn();
      } finally {
        if (slowRefreshTimerRef.current) {
          clearTimeout(slowRefreshTimerRef.current);
          slowRefreshTimerRef.current = null;
        }
        setShowSlowRefreshLoader(false);
        setIsRefreshingBoard(false);
      }
    },
    []
  );

  // Fetch escalated tickets and keep them in sync with filters + search
  useEffect(() => {
    let cancelled = false;
    void runBoardRefreshWithDelayedLoader(async () => {
      await refetchAllBoardTabsFirstPage(() => !cancelled);
    });
    return () => {
      cancelled = true;
      if (slowRefreshTimerRef.current) {
        clearTimeout(slowRefreshTimerRef.current);
        slowRefreshTimerRef.current = null;
      }
      setShowSlowRefreshLoader(false);
      setIsRefreshingBoard(false);
    };
  }, [refetchAllBoardTabsFirstPage, runBoardRefreshWithDelayedLoader]);

  const handleLoadMoreByStage = useCallback(
    async (stageId: Ticketing2StageId) => {
      const filtersWithSearch = {
        ...ticketApiFilters,
        searchTerm: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      };
      const loadMore = async (
        key: string,
        fetcher: (nextSkip: number) => Promise<{ fetchedCount: number } | void>
      ) => {
        if (!hasMoreByKey[key] || loadingMoreByKey[key]) return;
        const nextSkip = (pageByKey[key] ?? 0) + 1;
        setLoadingMoreByKey((prev) => ({ ...prev, [key]: true }));
        try {
          const res = await fetcher(nextSkip);
          const fetched =
            res && typeof res === "object" && "fetchedCount" in res
              ? Number((res as { fetchedCount: number }).fetchedCount ?? 0)
              : 0;
          setPageByKey((prev) => ({ ...prev, [key]: nextSkip }));
          if (fetched < PAGE_SIZE) {
            setHasMoreByKey((prev) => ({ ...prev, [key]: false }));
          }
        } finally {
          setLoadingMoreByKey((prev) => ({ ...prev, [key]: false }));
        }
      };

      if (stageId === "Escalated") {
        if (escalatedLevel === "L1") {
          await loadMore("escalated_l1", (nextSkip) =>
            fetchEscalatedTickets("L1", {
              ...filtersWithSearch,
              skip: nextSkip,
              limit: PAGE_SIZE,
              append: true,
            })
          );
        } else {
          await loadMore("escalated_l2", (nextSkip) =>
            fetchEscalatedTickets("L2", {
              ...filtersWithSearch,
              skip: nextSkip,
              limit: PAGE_SIZE,
              append: true,
            })
          );
        }
        return;
      }

      if (stageId === "Open") {
        if (openViewMode === "zone") {
          await loadMore("open_zone", (nextSkip) =>
            fetchOpenTabTickets("zone", {
              ...filtersWithSearch,
              skip: nextSkip,
              limit: PAGE_SIZE,
              append: true,
            })
          );
          return;
        }

        if (openLocationSubView === "locationInCharge") {
          await loadMore("open_location_lic", (nextSkip) =>
            fetchOpenTabTickets("location", {
              ...filtersWithSearch,
              skip: nextSkip,
              limit: PAGE_SIZE,
              append: true,
            })
          );
        } else {
          await loadMore("open_location_reassign", (nextSkip) =>
            fetchReassignedToOfficerTickets({
              ...filtersWithSearch,
              skip: nextSkip,
              limit: PAGE_SIZE,
              append: true,
            })
          );
        }
        return;
      }

      if (stageId === "Updated by Initiator") {
        await loadMore("updated", (nextSkip) =>
          fetchUpdatedByInitiatorTickets({
            ...filtersWithSearch,
            skip: nextSkip,
            limit: PAGE_SIZE,
            append: true,
          })
        );
        return;
      }

      if (stageId === "Returned by Occ") {
        await loadMore("returned", (nextSkip) =>
          fetchReturnedByOccTickets({
            ...filtersWithSearch,
            skip: nextSkip,
            limit: PAGE_SIZE,
            append: true,
          })
        );
        return;
      }

      if (stageId === "Reviewed by Occ") {
        await loadMore("reviewed", (nextSkip) =>
          fetchReviewedByOccTickets({
            ...filtersWithSearch,
            skip: nextSkip,
            limit: PAGE_SIZE,
            append: true,
          })
        );
      }
    },
    [
      ticketApiFilters,
      debouncedSearch,
      hasMoreByKey,
      loadingMoreByKey,
      pageByKey,
      escalatedLevel,
      openViewMode,
      openLocationSubView,
      fetchEscalatedTickets,
      fetchOpenTabTickets,
      fetchReassignedToOfficerTickets,
      fetchUpdatedByInitiatorTickets,
      fetchReturnedByOccTickets,
      fetchReviewedByOccTickets,
    ]
  );

  const filteredTickets = useMemo(() => {
    let result = allTicketsFromTabs;

    if (isLocationInchargeSodUser) {
      result = result.filter(hasNonEmptyLocationName);
    }

    if (buFilter !== "all") {
      result = result.filter((t) => String(t.bu) === buFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((t) => t.ticket_severity === severityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.ticket_status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const categoryVal = (t as any).category;
        const categories = Array.isArray(categoryVal)
          ? categoryVal
          : categoryVal
            ? [String(categoryVal)]
            : [];
        return categories.includes(categoryFilter);
      });
    }

    if (subcategoryFilter !== "all") {
      result = result.filter((t) => {
        const subVal = (t as any).sub_category;
        const subcategories = Array.isArray(subVal)
          ? subVal
          : subVal
            ? [String(subVal)]
            : [];
        return subcategories.includes(subcategoryFilter);
      });
    }

    if (zoneFilter !== "all") {
      result = result.filter((t) => {
        const z = (t as any).zone;
        const zoneArr = Array.isArray(z) ? z : z ? [z] : [];
        return zoneArr.some((val) => String(val) === String(zoneFilter));
      });
    }

    if (plantFilter !== "all") {
      result = result.filter((t) => {
        const sap = (t as any).sap_id;
        if (Array.isArray(sap)) {
          return sap.some((id: any) => String(id) === String(plantFilter));
        }
        return String(sap ?? "") === String(plantFilter);
      });
    }

    if (!debouncedSearch.trim()) return result;

    const q = debouncedSearch.toLowerCase();
    return result.filter(
      (t) =>
        String(t.ticket_id ?? "").toLowerCase().includes(q) ||
        (Array.isArray(t.location_name) && t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
        String(t.summary ?? "").toLowerCase().includes(q)
    );
  }, [
    allTicketsFromTabs,
    debouncedSearch,
    buFilter,
    severityFilter,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    zoneFilter,
    plantFilter,
    isLocationInchargeSodUser,
  ]);

  const filteredEscalatedTicketsL1 = useMemo(() => {
    let result = escalatedTicketsL1;

    if (isLocationInchargeSodUser) {
      result = result.filter(hasNonEmptyLocationName);
    }

    if (buFilter !== "all") {
      result = result.filter((t) => String(t.bu) === buFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((t) => t.ticket_severity === severityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.ticket_status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const categoryVal = (t as any).category;
        const categories = Array.isArray(categoryVal)
          ? categoryVal
          : categoryVal
            ? [String(categoryVal)]
            : [];
        return categories.includes(categoryFilter);
      });
    }

    if (subcategoryFilter !== "all") {
      result = result.filter((t) => {
        const subVal = (t as any).sub_category;
        const subcategories = Array.isArray(subVal)
          ? subVal
          : subVal
            ? [String(subVal)]
            : [];
        return subcategories.includes(subcategoryFilter);
      });
    }

    if (zoneFilter !== "all") {
      result = result.filter((t) => {
        const z = (t as any).zone;
        const zoneArr = Array.isArray(z) ? z : z ? [z] : [];
        return zoneArr.some((val) => String(val) === String(zoneFilter));
      });
    }

    if (plantFilter !== "all") {
      result = result.filter((t) => {
        const sap = (t as any).sap_id;
        if (Array.isArray(sap)) {
          return sap.some((id: any) => String(id) === String(plantFilter));
        }
        return String(sap ?? "") === String(plantFilter);
      });
    }

    if (!debouncedSearch.trim()) return result;

    const q = debouncedSearch.toLowerCase();
    return result.filter(
      (t) =>
        String(t.ticket_id ?? "").toLowerCase().includes(q) ||
        (Array.isArray(t.location_name) &&
          t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
        String(t.summary ?? "").toLowerCase().includes(q)
    );
  }, [
    escalatedTicketsL1,
    debouncedSearch,
    buFilter,
    severityFilter,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    zoneFilter,
    plantFilter,
    isLocationInchargeSodUser,
  ]);

  const filteredEscalatedTicketsL2 = useMemo(() => {
    let result = escalatedTicketsL2;

    if (isLocationInchargeSodUser) {
      result = result.filter(hasNonEmptyLocationName);
    }

    if (buFilter !== "all") {
      result = result.filter((t) => String(t.bu) === buFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((t) => t.ticket_severity === severityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.ticket_status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const categoryVal = (t as any).category;
        const categories = Array.isArray(categoryVal)
          ? categoryVal
          : categoryVal
            ? [String(categoryVal)]
            : [];
        return categories.includes(categoryFilter);
      });
    }

    if (subcategoryFilter !== "all") {
      result = result.filter((t) => {
        const subVal = (t as any).sub_category;
        const subcategories = Array.isArray(subVal)
          ? subVal
          : subVal
            ? [String(subVal)]
            : [];
        return subcategories.includes(subcategoryFilter);
      });
    }

    if (zoneFilter !== "all") {
      result = result.filter((t) => {
        const z = (t as any).zone;
        const zoneArr = Array.isArray(z) ? z : z ? [z] : [];
        return zoneArr.some((val) => String(val) === String(zoneFilter));
      });
    }

    if (plantFilter !== "all") {
      result = result.filter((t) => {
        const sap = (t as any).sap_id;
        if (Array.isArray(sap)) {
          return sap.some((id: any) => String(id) === String(plantFilter));
        }
        return String(sap ?? "") === String(plantFilter);
      });
    }

    if (!debouncedSearch.trim()) return result;

    const q = debouncedSearch.toLowerCase();
    return result.filter(
      (t) =>
        String(t.ticket_id ?? "").toLowerCase().includes(q) ||
        (Array.isArray(t.location_name) &&
          t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
        String(t.summary ?? "").toLowerCase().includes(q)
    );
  }, [
    escalatedTicketsL2,
    debouncedSearch,
    buFilter,
    severityFilter,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    zoneFilter,
    plantFilter,
    isLocationInchargeSodUser,
  ]);

  const filteredOpenTicketsByZone = useMemo(() => {
    let result = openTicketsByZone;

    if (buFilter !== "all") {
      result = result.filter((t) => String(t.bu) === buFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((t) => t.ticket_severity === severityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.ticket_status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const categoryVal = (t as any).category;
        const categories = Array.isArray(categoryVal)
          ? categoryVal
          : categoryVal
            ? [String(categoryVal)]
            : [];
        return categories.includes(categoryFilter);
      });
    }

    if (subcategoryFilter !== "all") {
      result = result.filter((t) => {
        const subVal = (t as any).sub_category;
        const subcategories = Array.isArray(subVal)
          ? subVal
          : subVal
            ? [String(subVal)]
            : [];
        return subcategories.includes(subcategoryFilter);
      });
    }

    if (zoneFilter !== "all") {
      result = result.filter((t) => {
        const z = (t as any).zone;
        const zoneArr = Array.isArray(z) ? z : z ? [z] : [];
        return zoneArr.some((val) => String(val) === String(zoneFilter));
      });
    }

    if (plantFilter !== "all") {
      result = result.filter((t) => {
        const sap = (t as any).sap_id;
        if (Array.isArray(sap)) {
          return sap.some((id: any) => String(id) === String(plantFilter));
        }
        return String(sap ?? "") === String(plantFilter);
      });
    }

    if (!debouncedSearch.trim()) return result;

    const q = debouncedSearch.toLowerCase();
    return result.filter(
      (t) =>
        String(t.ticket_id ?? "").toLowerCase().includes(q) ||
        (Array.isArray(t.location_name) &&
          t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
        String(t.summary ?? "").toLowerCase().includes(q)
    );
  }, [
    openTicketsByZone,
    debouncedSearch,
    buFilter,
    severityFilter,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    zoneFilter,
    plantFilter,
  ]);

  const filteredOpenTicketsByLocation = useMemo(() => {
    let result = openTicketsByLocation;

    if (isLocationInchargeSodUser) {
      result = result.filter(hasNonEmptyLocationName);
    }

    if (buFilter !== "all") {
      result = result.filter((t) => String(t.bu) === buFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((t) => t.ticket_severity === severityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.ticket_status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const categoryVal = (t as any).category;
        const categories = Array.isArray(categoryVal)
          ? categoryVal
          : categoryVal
            ? [String(categoryVal)]
            : [];
        return categories.includes(categoryFilter);
      });
    }

    if (subcategoryFilter !== "all") {
      result = result.filter((t) => {
        const subVal = (t as any).sub_category;
        const subcategories = Array.isArray(subVal)
          ? subVal
          : subVal
            ? [String(subVal)]
            : [];
        return subcategories.includes(subcategoryFilter);
      });
    }

    if (zoneFilter !== "all") {
      result = result.filter((t) => {
        const z = (t as any).zone;
        const zoneArr = Array.isArray(z) ? z : z ? [z] : [];
        return zoneArr.some((val) => String(val) === String(zoneFilter));
      });
    }

    if (plantFilter !== "all") {
      result = result.filter((t) => {
        const sap = (t as any).sap_id;
        if (Array.isArray(sap)) {
          return sap.some((id: any) => String(id) === String(plantFilter));
        }
        return String(sap ?? "") === String(plantFilter);
      });
    }

    if (!debouncedSearch.trim()) return result;

    const q = debouncedSearch.toLowerCase();
    return result.filter(
      (t) =>
        String(t.ticket_id ?? "").toLowerCase().includes(q) ||
        (Array.isArray(t.location_name) &&
          t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
        String(t.summary ?? "").toLowerCase().includes(q)
    );
  }, [
    openTicketsByLocation,
    debouncedSearch,
    buFilter,
    severityFilter,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    zoneFilter,
    plantFilter,
    isLocationInchargeSodUser,
  ]);

  const filteredOpenTicketsByLocationInCharge = useMemo(
    () => filteredOpenTicketsByLocation,
    [filteredOpenTicketsByLocation]
  );

  const filteredOpenTicketsByLocationReassign = useMemo(
    () => {
      let result = reassignedToOfficerTickets;

      // Keep parity with other tab-specific filtered lists.
      if (isLocationInchargeSodUser) {
        result = result.filter(hasNonEmptyLocationName);
      }

      // Even when server-side filtering is imperfect for this tab,
      // the global search box should always narrow the visible list.
      if (!debouncedSearch.trim()) return result;

      const q = debouncedSearch.toLowerCase();
      return result.filter(
        (t) =>
          String(t.ticket_id ?? "").toLowerCase().includes(q) ||
          (Array.isArray(t.location_name) &&
            t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
          String(t.summary ?? "").toLowerCase().includes(q)
      );
    },
    [reassignedToOfficerTickets, debouncedSearch, isLocationInchargeSodUser]
  );

  const filteredUpdatedByInitiatorTickets = useMemo(() => {
    let result = updatedByInitiatorTickets;

    if (isLocationInchargeSodUser) {
      result = result.filter(hasNonEmptyLocationName);
    }

    if (buFilter !== "all") {
      result = result.filter((t) => String(t.bu) === buFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((t) => t.ticket_severity === severityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.ticket_status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const categoryVal = (t as any).category;
        const categories = Array.isArray(categoryVal)
          ? categoryVal
          : categoryVal
            ? [String(categoryVal)]
            : [];
        return categories.includes(categoryFilter);
      });
    }

    if (subcategoryFilter !== "all") {
      result = result.filter((t) => {
        const subVal = (t as any).sub_category;
        const subcategories = Array.isArray(subVal)
          ? subVal
          : subVal
            ? [String(subVal)]
            : [];
        return subcategories.includes(subcategoryFilter);
      });
    }

    if (zoneFilter !== "all") {
      result = result.filter((t) => {
        const z = (t as any).zone;
        const zoneArr = Array.isArray(z) ? z : z ? [z] : [];
        return zoneArr.some((val) => String(val) === String(zoneFilter));
      });
    }

    if (plantFilter !== "all") {
      result = result.filter((t) => {
        const sap = (t as any).sap_id;
        if (Array.isArray(sap)) {
          return sap.some((id: any) => String(id) === String(plantFilter));
        }
        return String(sap ?? "") === String(plantFilter);
      });
    }

    if (!debouncedSearch.trim()) return result;

    const q = debouncedSearch.toLowerCase();
    return result.filter(
      (t) =>
        String(t.ticket_id ?? "").toLowerCase().includes(q) ||
        (Array.isArray(t.location_name) &&
          t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
        String(t.summary ?? "").toLowerCase().includes(q)
    );
  }, [
    updatedByInitiatorTickets,
    debouncedSearch,
    buFilter,
    severityFilter,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    zoneFilter,
    plantFilter,
    isLocationInchargeSodUser,
  ]);

  const filteredReturnedByOccTickets = useMemo(() => {
    let result = returnedByOccTickets;

    if (isLocationInchargeSodUser) {
      result = result.filter(hasNonEmptyLocationName);
    }

    if (buFilter !== "all") {
      result = result.filter((t) => String(t.bu) === buFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((t) => t.ticket_severity === severityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.ticket_status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const categoryVal = (t as any).category;
        const categories = Array.isArray(categoryVal)
          ? categoryVal
          : categoryVal
            ? [String(categoryVal)]
            : [];
        return categories.includes(categoryFilter);
      });
    }

    if (subcategoryFilter !== "all") {
      result = result.filter((t) => {
        const subVal = (t as any).sub_category;
        const subcategories = Array.isArray(subVal)
          ? subVal
          : subVal
            ? [String(subVal)]
            : [];
        return subcategories.includes(subcategoryFilter);
      });
    }

    if (zoneFilter !== "all") {
      result = result.filter((t) => {
        const z = (t as any).zone;
        const zoneArr = Array.isArray(z) ? z : z ? [z] : [];
        return zoneArr.some((val) => String(val) === String(zoneFilter));
      });
    }

    if (plantFilter !== "all") {
      result = result.filter((t) => {
        const sap = (t as any).sap_id;
        if (Array.isArray(sap)) {
          return sap.some((id: any) => String(id) === String(plantFilter));
        }
        return String(sap ?? "") === String(plantFilter);
      });
    }

    if (!debouncedSearch.trim()) return result;

    const q = debouncedSearch.toLowerCase();
    return result.filter(
      (t) =>
        String(t.ticket_id ?? "").toLowerCase().includes(q) ||
        (Array.isArray(t.location_name) &&
          t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
        String(t.summary ?? "").toLowerCase().includes(q)
    );
  }, [
    returnedByOccTickets,
    debouncedSearch,
    buFilter,
    severityFilter,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    zoneFilter,
    plantFilter,
    isLocationInchargeSodUser,
  ]);

  const filteredReviewedByOccTickets = useMemo(() => {
    let result = reviewedByOccTickets;

    if (isLocationInchargeSodUser) {
      result = result.filter(hasNonEmptyLocationName);
    }

    if (buFilter !== "all") {
      result = result.filter((t) => String(t.bu) === buFilter);
    }

    if (severityFilter !== "all") {
      result = result.filter((t) => t.ticket_severity === severityFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.ticket_status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const categoryVal = (t as any).category;
        const categories = Array.isArray(categoryVal)
          ? categoryVal
          : categoryVal
            ? [String(categoryVal)]
            : [];
        return categories.includes(categoryFilter);
      });
    }

    if (subcategoryFilter !== "all") {
      result = result.filter((t) => {
        const subVal = (t as any).sub_category;
        const subcategories = Array.isArray(subVal)
          ? subVal
          : subVal
            ? [String(subVal)]
            : [];
        return subcategories.includes(subcategoryFilter);
      });
    }

    if (zoneFilter !== "all") {
      result = result.filter((t) => {
        const z = (t as any).zone;
        const zoneArr = Array.isArray(z) ? z : z ? [z] : [];
        return zoneArr.some((val) => String(val) === String(zoneFilter));
      });
    }

    if (plantFilter !== "all") {
      result = result.filter((t) => {
        const sap = (t as any).sap_id;
        if (Array.isArray(sap)) {
          return sap.some((id: any) => String(id) === String(plantFilter));
        }
        return String(sap ?? "") === String(plantFilter);
      });
    }

    if (!debouncedSearch.trim()) return result;

    const q = debouncedSearch.toLowerCase();
    return result.filter(
      (t) =>
        String(t.ticket_id ?? "").toLowerCase().includes(q) ||
        (Array.isArray(t.location_name) &&
          t.location_name.some((l) => String(l).toLowerCase().includes(q))) ||
        String(t.summary ?? "").toLowerCase().includes(q)
    );
  }, [
    reviewedByOccTickets,
    debouncedSearch,
    buFilter,
    severityFilter,
    statusFilter,
    categoryFilter,
    subcategoryFilter,
    zoneFilter,
    plantFilter,
    isLocationInchargeSodUser,
  ]);

  const dashboardStats = useMemo(() => {
    const roCount = filteredTickets.filter((t) => t.bu === "RO" || t.bu === "BU").length;
    const tasCount = filteredTickets.filter((t) => t.bu === "TAS").length;
    const lpgCount = filteredTickets.filter((t) => t.bu === "LPG").length;
    const totalBu = roCount + tasCount + lpgCount;
    const criticalCount = filteredTickets.filter((t) => t.ticket_severity === "Critical").length;
    const highCount = filteredTickets.filter((t) => t.ticket_severity === "High").length;
    const mediumCount = filteredTickets.filter((t) => t.ticket_severity === "Medium").length;
    const lowCount = filteredTickets.filter((t) => t.ticket_severity === "Low").length;
    const totalSeverity = criticalCount + highCount + mediumCount + lowCount;
    const openCount = filteredTickets.filter(
      (t) =>
        t.ticket_state === "ToDo" ||
        t.ticket_state === "InProgress" ||
        t.ticket_state === "OnHold" ||
        t.ticket_state === "ReOpen" ||
        t.ticket_state === "OnCompleted"
    ).length;
    const closedCount = filteredTickets.filter(
      (t) =>
        t.ticket_status === "Closed" ||
        t.ticket_state === "Resolved" ||
        t.ticket_state === "Cancelled"
    ).length;
    const pendingCount = filteredTickets.filter((t) => t.ticket_status === "Pending").length;
    return {
      bu: {
        roPct: totalBu > 0 ? ((roCount / totalBu) * 100).toFixed(1) : "0.0",
        tasPct: totalBu > 0 ? ((tasCount / totalBu) * 100).toFixed(1) : "0.0",
        lpgPct: totalBu > 0 ? ((lpgCount / totalBu) * 100).toFixed(1) : "0.0",
      },
      severity: {
        criticalPct: totalSeverity > 0 ? ((criticalCount / totalSeverity) * 100).toFixed(1) : "0.0",
        highPct: totalSeverity > 0 ? ((highCount / totalSeverity) * 100).toFixed(1) : "0.0",
        mediumPct: totalSeverity > 0 ? ((mediumCount / totalSeverity) * 100).toFixed(1) : "0.0",
        lowPct: totalSeverity > 0 ? ((lowCount / totalSeverity) * 100).toFixed(1) : "0.0",
      },
      status: { open: openCount, closed: closedCount, pending: pendingCount },
    };
  }, [filteredTickets]);

  const formatIsoDateTime = (value: string | null | undefined): string => {
    if (!value) return "";
    const s = String(value);
    const main = s.split(".")[0]; // drop fractional seconds if present
    return main.replace("T", " ").slice(0, 19);
  };

  const downloadExcelTickets = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setIsDownloadingExcel(true);
    try {
      const filtersWithSearch = {
        ...ticketApiFilters,
        searchTerm: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
        created_date_from: dateFrom || undefined,
        created_date_to: dateTo || undefined,
      };

      const [l1, l2, openZone, openLocation, reassign, updated, returned, reviewed] =
        await Promise.all([
          fetchEscalatedTickets("L1", {
            ...filtersWithSearch,
            skip: 0,
            limit: 0,
            silent: true,
            includeDownloadFields: true,
          }),
          fetchEscalatedTickets("L2", {
            ...filtersWithSearch,
            skip: 0,
            limit: 0,
            silent: true,
            includeDownloadFields: true,
          }),
          fetchOpenTabTickets("zone", {
            ...filtersWithSearch,
            skip: 0,
            limit: 0,
            silent: true,
            includeDownloadFields: true,
          }),
          fetchOpenTabTickets("location", {
            ...filtersWithSearch,
            skip: 0,
            limit: 0,
            silent: true,
            includeDownloadFields: true,
          }),
          fetchReassignedToOfficerTickets({
            ...filtersWithSearch,
            skip: 0,
            limit: 0,
            silent: true,
            includeDownloadFields: true,
          }),
          fetchUpdatedByInitiatorTickets({
            ...filtersWithSearch,
            skip: 0,
            limit: 0,
            silent: true,
            includeDownloadFields: true,
          }),
          fetchReturnedByOccTickets({
            ...filtersWithSearch,
            skip: 0,
            limit: 0,
            silent: true,
            includeDownloadFields: true,
          }),
          fetchReviewedByOccTickets({
            ...filtersWithSearch,
            skip: 0,
            limit: 0,
            silent: true,
            includeDownloadFields: true,
          }),
        ]);

      const ticketMap = new Map<string, Ticket>();
      [
        ...(l1?.data ?? []),
        ...(l2?.data ?? []),
        ...(openZone?.data ?? []),
        ...(openLocation?.data ?? []),
        ...(reassign?.data ?? []),
        ...(updated?.data ?? []),
        ...(returned?.data ?? []),
        ...(reviewed?.data ?? []),
      ].forEach((ticket) => {
        const key = String(ticket.id ?? ticket.ticket_id);
        const existingTicket = ticketMap.get(key);
        if (!existingTicket) {
          ticketMap.set(key, ticket);
          return;
        }

        // Same ticket can appear across multiple list APIs; preserve non-empty text fields.
        ticketMap.set(key, {
          ...existingTicket,
          ...ticket,
          summary:
            ticket.summary ||
            (ticket as any).ticket_name ||
            existingTicket.summary ||
            (existingTicket as any).ticket_name ||
            "",
          description:
            ticket.description ||
            existingTicket.description ||
            (ticket as any).remarks ||
            (existingTicket as any).remarks ||
            "",
          comment:
            ticket.comment || existingTicket.comment || "",
        });
      });

      let ticketData: Ticket[] = Array.from(ticketMap.values());
      if (isLocationInchargeSodUser) {
        ticketData = ticketData.filter(hasNonEmptyLocationName);
      }

      if (!ticketData.length) {
        toast.dismiss();
        toast.error("No ticket data available to download");
        return;
      }

      const excelData = ticketData.map((ticket: Ticket) => {
        const isReviewedByOcc =
          ticket.ticket_state === "Reviewed By Occ" ||
          ticket.ticket_state === "Reviewed By OCC" ||
          (ticket.ticket_state as any) === "ReviewedByOcc";
        const hasCloseAndCreateDate = Boolean(ticket.updated_at && ticket.start_date);
        const ticketCloseDuration =
          isReviewedByOcc && hasCloseAndCreateDate
            ? (() => {
                const start = dayjs(ticket.start_date);
                const end = dayjs(ticket.updated_at);
                const totalHours = end.diff(start, "hour");
                const days = Math.floor(totalHours / 24);
                const hours = totalHours % 24;
                return `${days} days ${hours} hrs`;
              })()
            : "";

        const summaryValue =
          ticket.summary ||
          (ticket as any).ticket_name ||
          (ticket as any).title ||
          "";
        const rawDescription =
          ticket.description ||
          (ticket as any).remarks ||
          (ticket as any).comment ||
          "";
        const truckNumberCandidates: string[] =
          String(rawDescription).toUpperCase().match(/[A-Z0-9]+/g) ?? [];
        const extractedTruckNumbers = Array.from(
          new Set(
            truckNumberCandidates.filter(
              (value) =>
                value.length >= 9 &&
                /[A-Z]/.test(value) &&
                /[0-9]/.test(value) &&
                /^[A-Z0-9]+$/.test(value)
            )
          )
        );
        const descriptionValue = extractedTruckNumbers.length
          ? extractedTruckNumbers.join(", ")
          : "-";
        const ticketRaisedHistory = Array.isArray((ticket as any).ticket_history)
          ? (ticket as any).ticket_history.find(
              (entry: any) => String(entry?.action_type || "").trim() === "TicketRaised"
            )
          : null;
        const createdByValue = ticketRaisedHistory?.created_by || "-";
        const commentHistoryValue = Array.isArray((ticket as any).comment_history)
          ? [...(ticket as any).comment_history]
              .sort((a: any, b: any) => {
                const aTime = dayjs(a?.updated_time);
                const bTime = dayjs(b?.updated_time);
                if (!aTime.isValid() && !bTime.isValid()) return 0;
                if (!aTime.isValid()) return 1;
                if (!bTime.isValid()) return -1;
                return aTime.valueOf() - bTime.valueOf();
              })
              .map((entry: any) => {
                const updatedBy = String(entry?.updated_by || "").trim();
                const updatedTime = formatIsoDateTime(entry?.updated_time || "");
                const ticketMsg = String(entry?.ticket_msg || "").trim();
                const commentText = String(entry?.comments || "").trim();
                const parts = [
                  updatedTime ? `Date: ${updatedTime}` : "",
                  updatedBy ? `User: ${updatedBy}` : "",
                  ticketMsg ? `Status: ${ticketMsg}` : "",
                  `Comment: ${commentText || "-"}`,
                ].filter(Boolean);
                return parts.join(" | \n");
              })
              .filter(Boolean)
              .join("\n")
          : "-";
        const orderIdValue = Array.isArray(ticket.order_id)
          ? ticket.order_id.filter(Boolean).join(", ")
          : ticket.order_id || "";
        const truckNoValue = Array.isArray(ticket.truck_no)
          ? ticket.truck_no.filter(Boolean).join(", ")
          : ticket.truck_no || "";

        return {
          "Ticket ID": ticket.ticket_id || "",
          BU: ticket.bu || "",
          Zone: Array.isArray(ticket.zone)
            ? ticket.zone.filter(Boolean).join(", ")
            : ticket.zone || "",
          "SAP ID": Array.isArray(ticket.sap_id)
            ? ticket.sap_id.join(", ")
            : ticket.sap_id || "",
          "Location Name": Array.isArray(ticket.location_name)
            ? ticket.location_name.join(", ")
            : ticket.location_name || "",
          Summary: summaryValue,
          "TT Number": descriptionValue,
          "Ticket State": ticket.ticket_state || "",
          "Ticket Severity": ticket.ticket_severity || "",
          "Escalation Level": (ticket as any).escalation_level || "",
          "Ticket Status": ticket.ticket_status || "",
          "Created By": createdByValue,
          "Comment History": commentHistoryValue || "-",
          // "Employee id": Array.isArray(ticket.employee_id)
            // ? ticket.employee_id.join(", ")
            // : ticket.employee_id ?? "",
          "Assignee Name": Array.isArray(ticket.assignee_name)
            ? ticket.assignee_name.filter(Boolean).join(", ")
            : ticket.assignee_name || "",
          "Assignee Email": Array.isArray(ticket.assignee_mail)
            ? ticket.assignee_mail.filter(Boolean).join(", ")
            : ticket.assignee_mail || "",
          Category: Array.isArray(ticket.category)
            ? ticket.category.filter(Boolean).join(", ")
            : ticket.category || "",
          Subcategory: Array.isArray(ticket.sub_category)
            ? ticket.sub_category.filter(Boolean).join(", ")
            : ticket.sub_category || "",
          // "Alert Section": ticket.alert_section || "",
          // "SOP ID": (ticket as any).sop_id || "",
          "Ticket Created Date": formatIsoDateTime(ticket.start_date),
          "Ticket End Date": formatIsoDateTime(ticket.ticket_end_date),
          "Ticket Closed Date": isReviewedByOcc
            ? formatIsoDateTime(ticket.updated_at)
            : "",
          "Ticket Closer Duration ": ticketCloseDuration,
          // Comment: ticket.comment || "",
          "Truck No": truckNoValue,
          "Order No": orderIdValue,
          "Linked Alert ID": Array.isArray(ticket.linked_alert_id)
            ? ticket.linked_alert_id.join(", ")
            : ticket.linked_alert_id || "",
          // "Parent ID": (ticket as any).parent_id || "",
     
        };
      });

      const EXCEL_CELL_CHAR_LIMIT = 32767;
      const safeExcelData = excelData.map((row) => {
        const sanitizedRow: Record<string, any> = {};
        Object.entries(row).forEach(([key, value]) => {
          if (typeof value === "string" && value.length > EXCEL_CELL_CHAR_LIMIT) {
            sanitizedRow[key] = `${value.slice(0, EXCEL_CELL_CHAR_LIMIT - 3)}...`;
            return;
          }
          sanitizedRow[key] = value;
        });
        return sanitizedRow;
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(safeExcelData);

      const MAX_COL_WIDTH_BY_KEY: Record<string, number> = {
        Summary: 80,
        Description: 24,
        "Comment History": 120,
      };
      const colWidths = Object.keys(safeExcelData[0] || {}).map((key) => {
        const rawWidth = Math.max(
          key.length,
          ...safeExcelData.map((row) => String((row as any)[key] || "").length)
        );
        const maxWidth = MAX_COL_WIDTH_BY_KEY[key] ?? 30;
        return {
          wch: Math.min(rawWidth, maxWidth),
        };
      });
      (worksheet as any)["!cols"] = colWidths;
      // Keep long text readable without forcing very wide columns.
      const range = XLSX.utils.decode_range((worksheet as any)["!ref"] || "A1:A1");
      for (let r = range.s.r + 1; r <= range.e.r; r += 1) {
        ["Summary", "Description", "Comment History"].forEach((colName) => {
          const colIndex = Object.keys(safeExcelData[0] || {}).indexOf(colName);
          if (colIndex < 0) return;
          const cellAddress = XLSX.utils.encode_cell({ r, c: colIndex });
          const cell = (worksheet as any)[cellAddress];
          if (!cell) return;
          cell.s = {
            ...(cell.s || {}),
            alignment: { ...(cell.s?.alignment || {}), wrapText: true, vertical: "top" },
          };
        });
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");


      const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
      const filename = `Tickets_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);

      toast.dismiss();
      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error("Error downloading tickets Excel:", error);
      toast.dismiss();
      toast.error("Failed to download tickets Excel file");
    } finally {
      setIsDownloadingExcel(false);
    }
  }, [
    ticketApiFilters,
    debouncedSearch,
    fetchEscalatedTickets,
    fetchOpenTabTickets,
    fetchReassignedToOfficerTickets,
    fetchUpdatedByInitiatorTickets,
    fetchReturnedByOccTickets,
    fetchReviewedByOccTickets,
    isLocationInchargeSodUser,
    setIsDownloadingExcel,
  ]);

  const handleApplyDownloadDateFilter = useCallback(() => {
    if (downloadDateFrom && downloadDateTo && dayjs(downloadDateFrom).isAfter(dayjs(downloadDateTo))) {
      toast.error("From date cannot be after To date");
      return;
    }
    setIsDownloadDatePopoverOpen(false);
    void downloadExcelTickets(downloadDateFrom || undefined, downloadDateTo || undefined);
  }, [downloadDateFrom, downloadDateTo, downloadExcelTickets]);
  const todayInputDate = dayjs().format("YYYY-MM-DD");

  const handleTicketClick = (ticket: Ticket, sourceStage?: Ticketing2StageId) => {
    if (onTicketClick) {
      onTicketClick(ticket);
      return;
    }
    const id = ticket.ticket_id ?? ticket.id;
    const isTicketFromLicInbox =
      sourceStage === "Open" &&
      openViewMode === "location" &&
      openLocationSubView === "locationInCharge" &&
      filteredOpenTicketsByLocationInCharge.some(
        (t) =>
          String(t.id ?? t.ticket_id) === String(ticket.id ?? ticket.ticket_id)
      );
    const isTicketFromReassignToOfficer =
      sourceStage === "Open" &&
      openViewMode === "location" &&
      openLocationSubView === "reassignPlantOfficer" &&
      filteredOpenTicketsByLocationReassign.some(
        (t) =>
          String(t.id ?? t.ticket_id) === String(ticket.id ?? ticket.ticket_id)
      );

    const openedFromTab =
      sourceStage === "Open" &&
        openViewMode === "location" &&
        openLocationSubView === "locationInCharge"
        ? "licInbox"
        : sourceStage === "Open" &&
          openViewMode === "location" &&
          openLocationSubView === "reassignPlantOfficer"
          ? "reassignToOfficer"
          : "other";

    if (id) {
      navigate(`/settings/edit-ticketing2/${encodeURIComponent(String(id))}`, {
        state: {
          ticket,
          openedFromLicInbox: isTicketFromLicInbox,
          openedFromReassignToOfficer: isTicketFromReassignToOfficer,
          openedFromTab,
        },
      });
    }
  };

  const handleTicketMove = useCallback(
    async (ticketId: number | string, _fromStage: Ticketing2StageId, toStage: Ticketing2StageId) => {
      const matchId = (t: Ticket) =>
        String(t.id) === String(ticketId) || String(t.ticket_id) === String(ticketId);
      const movedTicket =
        allTicketsFromTabs.find(matchId) ??
        escalatedTicketsL1.find(matchId) ??
        escalatedTicketsL2.find(matchId);
      if (!movedTicket) return;
      const fromEscalated =
        escalatedTicketsL1.some(matchId) || escalatedTicketsL2.some(matchId);
      const { ticket_state: newState, ticket_status: newStatus } = getStateAndStatusFromStage(toStage);

      const linkedAlertIdValue = Array.isArray(movedTicket.linked_alert_id)
        ? movedTicket.linked_alert_id
        : movedTicket.linked_alert_id
          ? [movedTicket.linked_alert_id]
          : [];
      const zoneList: string[] = Array.isArray(movedTicket.zone)
        ? movedTicket.zone.filter(Boolean)
        : typeof movedTicket.zone === "string"
          ? movedTicket.zone
            ? [movedTicket.zone]
            : []
          : [];
      const categoryVal = (movedTicket as any).category;
      const categoryList: string[] = Array.isArray(categoryVal)
        ? categoryVal.filter(Boolean).length > 0
          ? categoryVal.filter(Boolean)
          : [""]
        : categoryVal
          ? [String(categoryVal)]
          : [""];
      const subCategoryVal = (movedTicket as any).sub_category;
      const subCategoryList: string[] = Array.isArray(subCategoryVal)
        ? subCategoryVal.filter(Boolean).length > 0
          ? subCategoryVal.filter(Boolean)
          : [""]
        : subCategoryVal
          ? [String(subCategoryVal)]
          : [""];
      const subtaskIdVal = (movedTicket as any).subtask_id;
      const subtaskIdList: string[] = Array.isArray(subtaskIdVal)
        ? subtaskIdVal.filter(Boolean).length > 0
          ? subtaskIdVal.filter(Boolean)
          : [""]
        : subtaskIdVal
          ? [String(subtaskIdVal)]
          : [""];
      const assigneeNameList =
        Array.isArray((movedTicket as any).assignee_name) && (movedTicket as any).assignee_name.length > 0
          ? (movedTicket as any).assignee_name
          : movedTicket.assignee
            ? [movedTicket.assignee]
            : [""];
      const assigneeMailList =
        Array.isArray((movedTicket as any).assignee_mail) && (movedTicket as any).assignee_mail.length > 0
          ? (movedTicket as any).assignee_mail
          : [""];
      const reAssingeeMailList: string[] = Array.isArray((movedTicket as any).re_assingee_mail)
        ? (movedTicket as any).re_assingee_mail.filter(Boolean)
        : (movedTicket as any).re_assingee_mail
          ? [String((movedTicket as any).re_assingee_mail)]
          : [];
      const reAssingeeEmployeeIdList: string[] = Array.isArray(
        (movedTicket as any).re_assingee_employee_id
      )
        ? (movedTicket as any).re_assingee_employee_id.filter(Boolean)
        : (movedTicket as any).re_assingee_employee_id
          ? [String((movedTicket as any).re_assingee_employee_id)]
          : [];
      const alertTypeVal = (movedTicket as any).alert_type;
      const alertTypeList: string[] = Array.isArray(alertTypeVal)
        ? alertTypeVal.filter(Boolean).length > 0
          ? alertTypeVal.filter(Boolean)
          : [""]
        : alertTypeVal
          ? [String(alertTypeVal)]
          : [""];
      const truckNoList: string[] = Array.isArray((movedTicket as any).truck_no)
        ? (movedTicket as any).truck_no.filter(Boolean)
        : [];

      const persisted = await updateTicketState({
        id: movedTicket.id,
        ticket_id: movedTicket.ticket_id,
        optimisticBaseTicket: movedTicket,
        ...(fromEscalated && { ticketFromEscalated: movedTicket }),
        sap_id: movedTicket.sap_id,
        bu: movedTicket.bu,
        alert_section: movedTicket.alert_section,
        sop_id: (movedTicket as any).sop_id ?? "SOP-1",
        location_name: movedTicket.location_name,
        assignee: "NovexSupport",
        assignee_name: assigneeNameList,
        assignee_mail: assigneeMailList,
        summary: movedTicket.summary,
        description: movedTicket.description,
        ticket_state: newState,
        ticket_status: newStatus,
        ticket_severity: movedTicket.ticket_severity,
        comment: movedTicket.comment,
        update_id: String(movedTicket.id),
        file_attachment: movedTicket.file_attachment,
        file_attachment_name: movedTicket.file_attachment_name,
        file_attachment_id: movedTicket.file_attachment_id,
        linked_alert_id: linkedAlertIdValue,
        start_date: movedTicket.start_date || new Date().toISOString(),
        ticket_end_date: movedTicket.ticket_end_date ?? (movedTicket as any).end_date ?? "",
        auto_ticket_close: (movedTicket as any).auto_ticket_close ?? "",
        zone: zoneList,
        truck_no: truckNoList.length > 0 ? truckNoList : [""],
        alert_type: alertTypeList,
        parent_id: (movedTicket as any).parent_id ?? "",
        subtask_id: subtaskIdList,
        category: categoryList,
        sub_category: subCategoryList,
        reason: (movedTicket as any).reason ?? "",
        remarks: (movedTicket as any).remarks ?? "",
        re_assingee_mail: reAssingeeMailList,
        re_assingee_employee_id: reAssingeeEmployeeIdList,
      });
      if (persisted) {
        await refetchAllBoardTabsFirstPage();
      }
    },
    [
      allTicketsFromTabs,
      escalatedTicketsL1,
      escalatedTicketsL2,
      updateTicketState,
      refetchAllBoardTabsFirstPage,
    ]
  );

  const handleRefresh = () => {
    setSearchTerm("");
    setSeverityFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setZoneFilter("all");
    setPlantFilter("all");
    setBuFilter("all");
    setEscalatedLevel("L1");
    setOpenViewMode("location");
    void runBoardRefreshWithDelayedLoader(async () => {
      await processEscalations();
      await Promise.all([
        fetchEscalatedTickets("L1", { skip: 0, limit: PAGE_SIZE }),
        fetchEscalatedTickets("L2", { skip: 0, limit: PAGE_SIZE }),
        fetchOpenTabTickets("zone", { skip: 0, limit: PAGE_SIZE }),
        fetchOpenTabTickets("location", { skip: 0, limit: PAGE_SIZE }),
        fetchReassignedToOfficerTickets({ skip: 0, limit: PAGE_SIZE }),
        fetchUpdatedByInitiatorTickets({ skip: 0, limit: PAGE_SIZE }),
        fetchReturnedByOccTickets({ skip: 0, limit: PAGE_SIZE }),
        fetchReviewedByOccTickets({ skip: 0, limit: PAGE_SIZE }),
      ]);
    });
  };

  const handleCreateTicket = () => {
    if (!canCreateTicket) {
      toast.error("You are not allowed to create tickets.");
      return;
    }

    if (onCreateTicketClick) {
      onCreateTicketClick();
    } else {
      navigate("/settings/add-edit-ticketing2");
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* Header – stats and filters (no scroll) */}
      <header className="flex-shrink-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="px-2 sm:px-4 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 min-h-0 min-w-0 flex-wrap">
            {/* Search */}
            <div className="relative min-w-[7rem] w-40 sm:w-48 md:w-56 flex-shrink-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-7 h-8 w-full text-xs ${searchTerm ? "pr-7" : ""}`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 ml-auto">
              {/* Total Tickets */}
              <div className="flex-shrink-0">
                <TicketStats
                  tickets={filteredTickets}
                  totalTicketCount={
                    debouncedSearch.trim()
                      ? filteredTickets.length
                      : boardVisibilityMeta?.overdueAny
                        ? boardVisibilityMeta.totalVisible
                        : totalTicketCountFromTabs
                  }
                />
              </div>

              {/* BU / Severity / Status summary cards – hidden on small screens */}
              <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg px-2 py-1 border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex gap-2">
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-slate-600">RO</p>
                      <p className="text-xs font-semibold text-blue-600">{dashboardStats.bu.roPct}%</p>
                    </div>
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-slate-600">TAS</p>
                      <p className="text-xs font-semibold text-amber-600">{dashboardStats.bu.tasPct}%</p>
                    </div>
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-slate-600">LPG</p>
                      <p className="text-xs font-semibold text-green-600">{dashboardStats.bu.lpgPct}%</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                  className="rounded-lg px-2 py-1 border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex gap-2">
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-red-600">Crit</p>
                      <p className="text-xs font-semibold">{dashboardStats.severity.criticalPct}%</p>
                    </div>
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-amber-600">High</p>
                      <p className="text-xs font-semibold">{dashboardStats.severity.highPct}%</p>
                    </div>
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-green-600">Med</p>
                      <p className="text-xs font-semibold">{dashboardStats.severity.mediumPct}%</p>
                    </div>
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-slate-600">Low</p>
                      <p className="text-xs font-semibold">{dashboardStats.severity.lowPct}%</p>
                    </div>
                  </div>
                </motion.div>

                {/* <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className="rounded-lg px-2 py-1 border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex gap-2">
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-blue-600">OPEN</p>
                      <p className="text-xs font-bold text-slate-900">{dashboardStats.status.open}</p>
                    </div>
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-green-600">CLOSED</p>
                      <p className="text-xs font-bold text-slate-900">{dashboardStats.status.closed}</p>
                    </div>
                    <div className="text-center leading-tight">
                      <p className="text-[10px] text-amber-600">PENDING</p>
                      <p className="text-xs font-bold text-slate-900">{dashboardStats.status.pending}</p>
                    </div>
                  </div>
                </motion.div> */}
              </div>

              {/* Filters dropdown (non-date) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 min-w-8 flex-shrink-0"
                    aria-label="Filters"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[10rem]">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {BU_OPTIONS.find((o) => o.value === buFilter)?.label ?? "All BU"}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={buFilter} onValueChange={setBuFilter}>
                        {BU_OPTIONS.map((opt) => (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {SEVERITY_OPTIONS.find((o) => o.value === severityFilter)?.label ?? "All Severity"}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={severityFilter} onValueChange={setSeverityFilter}>
                        {SEVERITY_OPTIONS.map((opt) => (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "All Status"}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                        {STATUS_OPTIONS.map((opt) => (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {CATEGORY_OPTIONS.find((o) => o.value === categoryFilter)?.label ?? "All Categories"}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      <DropdownMenuRadioGroup value={categoryFilter} onValueChange={setCategoryFilter}>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {SUBCATEGORY_OPTIONS.find((o) => o.value === subcategoryFilter)?.label ?? "All Subcategories"}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      <DropdownMenuRadioGroup value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
                        {SUBCATEGORY_OPTIONS.map((opt) => (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {zoneFilter === "all"
                        ? "All Zones"
                        : zones.find((z) => z.id === zoneFilter)?.name || "All Zones"}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      <DropdownMenuRadioGroup
                        value={zoneFilter}
                        onValueChange={(value) => {
                          setZoneFilter(value);
                          setPlantFilter("all");
                        }}
                      >
                        <DropdownMenuRadioItem value="all">All Zones</DropdownMenuRadioItem>
                        {zones.map((zone) => (
                          <DropdownMenuRadioItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {plantFilter === "all"
                        ? "All Plants"
                        : plants.find((p) => p.id === plantFilter)?.name || "All Plants"}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      <DropdownMenuRadioGroup value={plantFilter} onValueChange={setPlantFilter}>
                        <DropdownMenuRadioItem value="all">All Plants</DropdownMenuRadioItem>
                        {plants.map((plant) => (
                          <DropdownMenuRadioItem key={plant.id} value={plant.id}>
                            {plant.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Download */}
              <Popover
                open={isDownloadDatePopoverOpen}
                onOpenChange={setIsDownloadDatePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    disabled={isDownloadingExcel}
                    title={isDownloadingExcel ? "Downloading..." : "Download"}
                  >
                    {isDownloadingExcel ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Filter by date</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">From</label>
                        <Input
                          type="date"
                          value={downloadDateFrom}
                          onChange={(e) => setDownloadDateFrom(e.target.value)}
                          max={downloadDateTo || todayInputDate}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">To</label>
                        <Input
                          type="date"
                          value={downloadDateTo}
                          onChange={(e) => setDownloadDateTo(e.target.value)}
                          min={downloadDateFrom || undefined}
                          max={todayInputDate}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDownloadDateFrom("");
                          setDownloadDateTo("");
                          setIsDownloadDatePopoverOpen(false);
                        }}
                        disabled={isDownloadingExcel}
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApplyDownloadDateFilter}
                        disabled={isDownloadingExcel}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="h-8 flex-shrink-0"
                disabled={isRefreshingBoard}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1 ${isRefreshingBoard ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              {/* Create Ticket */}
              <Button
                size="sm"
                onClick={handleCreateTicket}
                className="h-8 flex-shrink-0"
                disabled={!canCreateTicket}
                title={
                  canCreateTicket
                    ? "Create Ticket"
                    : "You do not have permission to create tickets"
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Ticket
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Board – only this area scrolls (cards), not the full page */}
      <main className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col">
        <Ticketing2StageBoard
          tickets={filteredTickets}
          openTicketsByZone={filteredOpenTicketsByZone}
          openTicketsByLocationInCharge={filteredOpenTicketsByLocationInCharge}
          openTicketsByLocationReassign={filteredOpenTicketsByLocationReassign}
          openLocationSubView={openLocationSubView}
          onOpenLocationSubViewChange={setOpenLocationSubView}
          updatedByInitiatorTickets={filteredUpdatedByInitiatorTickets}
          returnedByOccTickets={filteredReturnedByOccTickets}
          reviewedByOccTickets={filteredReviewedByOccTickets}
          escalatedTicketsL1={filteredEscalatedTicketsL1}
          escalatedTicketsL2={filteredEscalatedTicketsL2}
          openTicketsByZoneTotal={openTicketsByZoneTotal}
          openTicketsByLocationTotal={openTicketsByLocationTotal}
          reassignedToOfficerTicketsTotal={reassignedToOfficerTicketsTotal}
          updatedByInitiatorTicketsTotal={updatedByInitiatorTicketsTotal}
          returnedByOccTicketsTotal={returnedByOccTicketsTotal}
          reviewedByOccTicketsTotal={reviewedByOccTicketsTotal}
          escalatedTicketsL1Total={escalatedTicketsL1Total}
          escalatedTicketsL2Total={escalatedTicketsL2Total}
          escalatedLevel={escalatedLevel}
          onEscalatedLevelChange={setEscalatedLevel}
          openViewMode={openViewMode}
          onOpenViewModeChange={setOpenViewMode}
          loading={loading}
          error={error || null}
          onTicketClick={handleTicketClick}
          onTicketMove={handleTicketMove}
          canMoveOccStages={canMoveOccStages}
          canMoveToUpdatedByInitiator={canMoveToUpdatedByInitiator}
          canMoveFromOpenToUpdatedByInitiator={canMoveFromOpenToUpdatedByInitiator}
          canMoveFromL1ToUpdatedByInitiator={canMoveFromL1ToUpdatedByInitiator}
          canMoveFromL2ToUpdatedByInitiator={canMoveFromL2ToUpdatedByInitiator}
          restrictDragByEscalationForLocationOrPlantIncharge={
            restrictDragByEscalationForLocationOrPlantIncharge
          }
          disableZonalSodDragWhenOpenByLocation={disableZonalSodDragWhenOpenByLocation}
          currentEmployeeId={user?.employee_id ? String(user.employee_id).trim() : ""}
          onLoadMoreByStage={handleLoadMoreByStage}
          isSearchActive={Boolean(debouncedSearch.trim())}
          onVisibilityTotalsChange={handleBoardVisibilityTotalsChange}
        />
      </main>
    </div>
  );
}
