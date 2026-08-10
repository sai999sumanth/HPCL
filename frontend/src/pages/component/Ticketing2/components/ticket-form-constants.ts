import { ComboboxOption } from "./reusable-combobox";

export const dialogBusinessUnitOptions: ComboboxOption[] = [
  { value: "TAS", label: "SOD" },
  { value: "RO", label: "RO" },
  { value: "LPG", label: "LPG" },
];

export const alertSectionOptions: ComboboxOption[] = [
  { value: "VA", label: "VA" },
  { value: "VTS", label: "VTS" },
  { value: "TAS", label: "TAS" },
  { value: "LPG", label: "LPG" },
  { value: "RO", label: "RO" },
];

/** Alert section options per Business Unit: SOD (TAS) → TAS, VA, VTS; LPG → LPG, VA, VTS; RO → RO, VA */
export function getAlertSectionOptionsForBu(bu: string): ComboboxOption[] {
  const all: Record<string, ComboboxOption[]> = {
    TAS: [
      { value: "TAS", label: "TAS" },
      { value: "VA", label: "VA" },
      { value: "VTS", label: "VTS" },
    ],
    LPG: [
      { value: "LPG", label: "LPG" },
      { value: "VA", label: "VA" },
      { value: "VTS", label: "VTS" },
    ],
    RO: [
      { value: "RO", label: "RO" },
      { value: "VA", label: "VA" },
    ],
  };
  return all[bu] ?? alertSectionOptions;
}

export const assigneeOptions: ComboboxOption[] = [
  { value: "NovexSupport", label: "NovexSupport" },
  { value: "TechSupport", label: "TechSupport" },
];

/**
 * Ticket state values used when creating/updating tickets.
 * These must exactly match backend enum:
 * 'Open', 'Escalated', 'Updated By Initiator', 'Returned By Occ', 'Reviewed By Occ'
 *
 * NOTE:
 * - We intentionally do NOT expose "Escalated" in the create/edit dropdowns for now.
 *   Escalated tickets are managed by OCC and shown via the Escalated board, but
 *   users can't manually set this state from the form.
 */
export const ticketStateOptions: ComboboxOption[] = [
  { value: "Open", label: "Open" },
  { value: "Updated By Initiator", label: "Updated By Initiator" },
  { value: "Returned By Occ", label: "Returned By Occ" },
  { value: "Reviewed By Occ", label: "Reviewed By Occ" },
];

/** Roles (Location In-Charge SOD, Plant In-Charge SOD, Zonal SOD Ticketing) that get restricted Ticket State options when editing. */
export const INITIATOR_UPDATE_ROLES = [
  "Location In-Charge SOD",
  "Plant In-Charge SOD",
  "Zonal SOD Ticketing",
];

/** Zonal Head role – special Ticket State options when editing Escalated (L2) tickets. */
export const ZONAL_HEAD_TICKET_ROLE = "Zonal Head SOD Ticketing";

/** OCC roles (HQO HSE LPG, HQO HSE SOD, HQO TICKETING) — restricted Ticket State options when opening from certain tabs. */
export const OCC_TICKET_STATE_ROLES = ["HQO HSE LPG", "HQO HSE SOD", "HQO TICKETING"];

/**
 * Get Ticket State options for edit mode.
 *
 * Goal: mirror drag-and-drop permissions on the Ticketing2 board for each role,
 * while keeping the dropdown minimal (`current state` + only the states the user
 * is allowed to move into from that column).
 *
 * Behaviour by role:
 *
 * - OCC roles (HQO HSE LPG, HQO HSE SOD, HQO TICKETING):
 *   - Open / Escalated → only Open
 *   - Updated By Initiator → Returned By Occ, Reviewed By Occ
 *   - Returned By Occ     → Reviewed By Occ
 *   - Reviewed By Occ     → Reviewed By Occ
 *
 * - Location / Plant In-Charge SOD:
 *   - Open                → Open, Updated By Initiator
 *   - Returned By Occ     → Updated By Initiator
 *   - Updated By Initiator→ Updated By Initiator
 *   - Escalated (L1/L2)   → Escalated  (read-only – cannot change via dropdown)
 *   - Reviewed By Occ     → Reviewed By Occ
 *
 * - Zonal SOD Ticketing:
 *   - Escalated (L1)      → Updated By Initiator
 *   - Returned By Occ     → Updated By Initiator
 *   - All other tabs      → only the current ticket state (read-only)
 *
 * - Zonal Head SOD Ticketing:
 *   - Escalated (L2)      → Updated By Initiator
 *   - Returned By Occ     → Updated By Initiator
 *   - All other tabs      → only the current ticket state (read-only)
 *
 * - Any other role:
 *   - Full `ticketStateOptions` (no special restrictions).
 */
export function getTicketStateOptionsForEdit(
  userRoles: string[] | undefined,
  initialTicketState: string | undefined,
  initialTicketStatus?: string | undefined,
  initialEscalationLevel?: number | string | null,
  initialZone?: string | string[] | null,
  initialLocationName?: string | string[] | null
): ComboboxOption[] {
  const normalizedState = (initialTicketState || "").trim();
  const normalizedStatus = (initialTicketStatus || "").trim();
  const isUpdatedByInitiator =
    normalizedState === "Updated By Initiator" ||
    normalizedState === "UpdatedByInitiator" ||
    // Legacy / board-mapped values that still mean "Updated by Initiator" tab
    normalizedState === "Updated" ||
    normalizedState === "Completed";
  const isReturnedByOcc =
    normalizedState === "Returned By Occ" ||
    normalizedState === "ReturnedByOcc" ||
    normalizedState === "Returned By OCC" ||
    // Legacy values that the board already maps to "Returned by Occ"
    normalizedState === "ReOpen" ||
    normalizedState === "OnHold";
  const isReviewedByOcc =
    normalizedState === "Reviewed By Occ" ||
    normalizedState === "ReviewedByOcc" ||
    normalizedState === "Reviewed By OCC" ||
    // Legacy values that the board already maps to "Reviewed by Occ"
    normalizedStatus === "Closed" ||
    normalizedState === "OnCompleted";
  const isEscalated =
    normalizedState === "Escalated" ||
    normalizedStatus === "Pending" ||
    normalizedState === "InProgress";
  const isOpen =
    normalizedState === "Open" || normalizedStatus === "Open";

  // Infer whether this Open ticket came from the "Open – By Location" view:
  // useTickets builds that view only for tickets that have BOTH zone and location_name.
  const zoneValues = Array.isArray(initialZone)
    ? initialZone
    : initialZone
    ? [initialZone]
    : [];
  const locationValues = Array.isArray(initialLocationName)
    ? initialLocationName
    : initialLocationName
    ? [initialLocationName]
    : [];
  const hasZoneForOpenLocationView = zoneValues.some(
    (v) => String(v ?? "").trim() !== ""
  );
  const hasLocationForOpenLocationView = locationValues.some(
    (v) => String(v ?? "").trim() !== ""
  );
  const isOpenByLocationTicket =
    isOpen && hasZoneForOpenLocationView && hasLocationForOpenLocationView;

  let escalationLevelNumber: number =
    typeof initialEscalationLevel === "number"
      ? initialEscalationLevel
      : 0;

  if (typeof initialEscalationLevel === "string") {
    const trimmed = initialEscalationLevel.trim().toUpperCase();
    if (trimmed === "L1") {
      escalationLevelNumber = 1;
    } else if (trimmed === "L2") {
      escalationLevelNumber = 2;
    } else {
      const parsed = parseInt(trimmed, 10);
      escalationLevelNumber = Number.isNaN(parsed) ? 0 : parsed;
    }
  }
  const isEscalatedByLevel = escalationLevelNumber > 0;
  const isL1Escalated = isEscalated && escalationLevelNumber === 1;
  const isL2Escalated = isEscalated && escalationLevelNumber === 2;

  const hasRole = (roles: string[]): boolean =>
    !!userRoles?.some((r) => roles.includes(String(r).trim()));

  const isOccUser = hasRole(OCC_TICKET_STATE_ROLES);
  const isLocationOrPlantUser = hasRole([
    "Location In-Charge SOD",
    "Plant In-Charge SOD",
  ]);
  const isZonalSodUser = hasRole(["Zonal SOD Ticketing"]);
  const isZonalHeadUser = hasRole([ZONAL_HEAD_TICKET_ROLE]);
  const isInitiatorStyleUser =
    isLocationOrPlantUser || isZonalSodUser || isZonalHeadUser;
  const isInitiatorUpdateUser =
    hasRole(INITIATOR_UPDATE_ROLES) || isZonalHeadUser;

  // Special safeguard for OCC users:
  // If they open a ticket that the board treats as:
  // - "Updated by Initiator"  → show Returned By Occ / Reviewed By Occ
  // - "Returned by Occ"       → show Reviewed By Occ only
  // This applies even if they also have initiator-style roles.
  if (isOccUser) {
    if (isUpdatedByInitiator) {
      return [
        { value: "Returned By Occ", label: "Returned By Occ" },
        { value: "Reviewed By Occ", label: "Reviewed By Occ" },
      ];
    }
    if (isReturnedByOcc) {
      return [{ value: "Reviewed By Occ", label: "Reviewed By Occ" }];
    }
  }

  // OCC users – behaviour from original spec, with one refinement:
  // - Open tab        → only Open
  // - Escalated (L1/L2) → only Escalated
  // This block applies ONLY when user is not also an initiator-style user
  // (Location/Plant/Zonal/Zonal Head). If a user has both OCC and initiator
  // roles, we prioritize the initiator behaviour.
  if (isOccUser && !isInitiatorStyleUser) {
    const treatAsEscalated = isEscalated || isEscalatedByLevel;
    if (isOpen && !treatAsEscalated) {
      return [{ value: "Open", label: "Open" }];
    }
    if (treatAsEscalated) {
      return [{ value: "Escalated", label: "Escalated" }];
    }
    if (isReviewedByOcc) {
      return [{ value: "Reviewed By Occ", label: "Reviewed By Occ" }];
    }
    if (isReturnedByOcc) {
      // From Returned By Occ tab, OCC can only move to Reviewed By Occ
      return [{ value: "Reviewed By Occ", label: "Reviewed By Occ" }];
    }
    // Updated By Initiator handling for OCC is done in the safeguard above
  }

  // Location / Plant In-Charge SOD – can move:
  // - Open (By Location view) → Updated By Initiator
  // - Open (By Zone view)     → Open
  // - Returned By Occ         → Updated By Initiator (blank escalation only)
  //                            Returned By Occ (L1/L2, non-draggable on board)
  if (isLocationOrPlantUser) {
    if (isEscalated) {
      // Escalated tickets are view-only in the form for these roles.
      return [{ value: "Escalated", label: "Escalated" }];
    }
    if (isReturnedByOcc) {
      // Mirror board drag guard:
      // Location/Plant users cannot move Returned By Occ -> Updated By Initiator
      // when escalation_level is L1/L2, so keep Returned By Occ in dropdown.
      if (escalationLevelNumber === 1 || escalationLevelNumber === 2) {
        return [{ value: "Returned By Occ", label: "Returned By Occ" }];
      }
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isUpdatedByInitiator) {
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isReviewedByOcc) {
      return [{ value: "Reviewed By Occ", label: "Reviewed By Occ" }];
    }
    if (isOpen) {
      if (isOpenByLocationTicket) {
        // Open tab, By Location (LIC Inbox): allow Open and Updated By Initiator
        return [
          { value: "Open", label: "Open" },
          { value: "Updated By Initiator", label: "Updated By Initiator" },
        ];
      }
      // Open tab, By Zone: keep state as Open only
      return [{ value: "Open", label: "Open" }];
    }
    // Fallback: show current state if something unexpected comes through.
    return [{ value: normalizedState || "Open", label: normalizedState || "Open" }];
  }

  // Zonal SOD Ticketing – can move:
  // - Escalated (L1) → Updated By Initiator
  // - Returned By Occ→ Updated By Initiator
  // All other tabs: read-only (show current state only).
  if (isZonalSodUser) {
    // Reuse "Open – By Location" inference helpers for zone/location presence
    const zonalHasZone = hasZoneForOpenLocationView;
    const zonalHasLocation = hasLocationForOpenLocationView;
    const isZonalBlankEscalationWithZoneAndLocation =
      !isEscalatedByLevel &&
      escalationLevelNumber === 0 &&
      zonalHasZone &&
      zonalHasLocation;

    if (isL1Escalated) {
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isReturnedByOcc) {
      // From Returned By Occ tab, mirror board drag guard:
      // - L1 escalation  -> can move to Updated By Initiator
      // - Other cases    -> keep Returned By Occ (read-only)
      if (escalationLevelNumber !== 1 || isZonalBlankEscalationWithZoneAndLocation) {
        return [{ value: "Returned By Occ", label: "Returned By Occ" }];
      }
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isEscalated) {
      // Escalated but not L1 (e.g. L2) – read-only.
      return [{ value: "Escalated", label: "Escalated" }];
    }
    if (isUpdatedByInitiator) {
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isReviewedByOcc) {
      return [{ value: "Reviewed By Occ", label: "Reviewed By Occ" }];
    }
    if (isOpen) {
      // From Open tab, when editing as Zonal SOD Ticketing:
      // - For "Open – By Location" tickets (have both zone and location),
      //   keep ticket state as Open only.
      // - For "Open – By Zone" tickets, allow Updated By Initiator.
      if (isOpenByLocationTicket) {
        return [{ value: "Open", label: "Open" }];
      }
      return [
        { value: "Updated By Initiator", label: "Updated By Initiator" },
      ];
    }
  }

  // Zonal Head SOD Ticketing – can move:
  // - Escalated (L2) → Updated By Initiator
  // - Returned By Occ→ Updated By Initiator
  // All other tabs: read-only (show current state only).
  if (isZonalHeadUser) {
    if (isL2Escalated) {
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isReturnedByOcc) {
      // From Returned By Occ tab, mirror board drag guard:
      // - L2 escalation -> can move to Updated By Initiator
      // - Other cases   -> keep Returned By Occ (read-only)
      if (escalationLevelNumber !== 2) {
        return [{ value: "Returned By Occ", label: "Returned By Occ" }];
      }
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isEscalated) {
      // Escalated but not L2 (e.g. L1) – read-only.
      return [{ value: "Escalated", label: "Escalated" }];
    }
    if (isUpdatedByInitiator) {
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isReviewedByOcc) {
      return [{ value: "Reviewed By Occ", label: "Reviewed By Occ" }];
    }
    if (isOpen) {
      return [{ value: "Open", label: "Open" }];
    }
  }

  // Any other initiator-style role (future extension) – keep previous generic rules.
  if (isInitiatorUpdateUser) {
    if (isUpdatedByInitiator) {
      return [{ value: "Updated By Initiator", label: "Updated By Initiator" }];
    }
    if (isEscalated) {
      // For any other initiator-style role, Escalated is read-only
      return [{ value: "Escalated", label: "Escalated" }];
    }
    if (isReturnedByOcc) {
      // Read-only for Returned By Occ: show only current state
      return [{ value: "Returned By Occ", label: "Returned By Occ" }];
    }
    if (isReviewedByOcc) {
      // Reviewed By Occ is always read-only
      return [{ value: "Reviewed By Occ", label: "Reviewed By Occ" }];
    }
    return [
      { value: "Open", label: "Open" },
      { value: "Updated By Initiator", label: "Updated By Initiator" },
    ];
  }

  // Fallback: for non-special roles:
  // - Escalated tickets should display Escalated (read-only)
  // - Otherwise, show full ticketStateOptions (Open / Updated / Returned / Reviewed).
  if (isEscalated) {
    return [{ value: "Escalated", label: "Escalated" }];
  }
  return ticketStateOptions;
}

/** Get display label for ticket_state. Dashboard shows "OCC" (e.g. "Reviewed By OCC"). */
export function getTicketStateDisplayLabel(state: string): string {
  // Map legacy/internal keys returned by API or stored in DB to display labels
  if (state === "UpdatedByInitiator") return "Updated By Initiator";
  if (state === "ReturnedByOcc" || state === "Returned By OCC" || state === "Returned By Occ") return "Returned By OCC";
  if (state === "ReviewedByOcc" || state === "Reviewed By OCC" || state === "Reviewed By Occ") return "Reviewed By OCC";
  return state;
}

export const ticketSeverityOptions: ComboboxOption[] = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];

export const ticketCategoryOptions: ComboboxOption[] = [
  { value: "Transportation Discipline", label: "Transportation Discipline" },
  { value: "Inventory Management", label: "Inventory Management" },
  { value: "Safety Performance", label: "Safety Performance" },
  { value: "Asset Integrity", label: "Asset Integrity" },
  { value: "VTS Live Tracking", label: "VTS Live Tracking" },
];

/**
 * Maps ticket category to the role string used in get_ticket_mails API response.
 * Only users whose role contains this string are shown in the Assignee dropdown.
 */
export const categoryToRoleMap: Record<string, string> = {
  "Transportation Discipline": "Transportation & Bio-fuels",
  "VTS Live Tracking": "Transportation & Bio-fuels",
  "Inventory Management": "Operations & Automation",
  "Safety Performance": "HSE, M&I and Projects",
  "Asset Integrity": "HSE, M&I and Projects",
};

export function getRoleForCategory(category: string): string | null {
  return categoryToRoleMap[category] ?? null;
}

export const ticketSubcategoryOptions: ComboboxOption[] = [
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
];
