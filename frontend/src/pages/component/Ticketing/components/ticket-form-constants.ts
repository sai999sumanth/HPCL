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

export const ticketStateOptions: ComboboxOption[] = [
  { value: "Open", label: "Open" },
  { value: "Escalated", label: "Escalated" },
  { value: "Updated", label: "Completed" },
  { value: "Reopen", label: "Reopen" },
  { value: "Resolved", label: "Resolved" },
];

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
