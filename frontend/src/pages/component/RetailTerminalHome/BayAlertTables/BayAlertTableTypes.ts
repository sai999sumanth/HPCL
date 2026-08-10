/**
 * Shared types and constants for Bay Alert Distribution tables (location-wise and date-wise).
 */

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LocationWiseCounts {
  bay_reassignment: number;
  bay_reassignment_severity?: SeverityLevel | string;
  local_loading: number;
  local_loading_severity?: SeverityLevel | string;
  local_loading_qty: number;
  over_loading: number;
  over_loading_severity?: SeverityLevel | string;
  over_loading_qty: number;
  bay_alert_count: number;
  bay_alert_count_severity?: SeverityLevel | string;
  unauthorised_flow: number;
  unauthorised_flow_net_totalizer: number;
  gantry_permissive_off: number;
  mfm_vs_bcu: number;
  mfm_vs_bcu_severity?: SeverityLevel | string;
  mfm_vs_bcu_difference: number;
  bcu_vs_invoice: number;
  bcu_vs_invoice_severity?: SeverityLevel | string;
  bcu_vs_invoice_difference: number;
  bcu_vs_mfm_mismatch: number;
  bcu_vs_invoice_mismatch: number;
  manual_dip_cross_check: number;
}

export interface LocationWiseItem {
  location_id: string;
  location_name: string;
  overall_counts: LocationWiseCounts;
  bays: Record<string, LocationWiseCounts>;
}

/** Columns for the redesigned Location Hierarchy table (two-tier headers) */
export const LOCATION_TABLE_COLUMNS = {
  location: 'LOCATION HIERARCHY',
  total: 'TOTAL COUNT',
  baySwap: 'Bay reassignment count',
  localLoading: 'LOCAL LOADING',
  overLoading: 'OVERLOADING',
  bcuVsMfm: 'BCU VS MFM',
  bcuVsInvoice: 'BCU VS INVOICE',
} as const;

/** Export columns for Excel (flat list of label + key pairs) */
export const LOCATION_EXPORT_COLUMNS: { key: keyof LocationWiseCounts; label: string }[] = [
  { key: 'bay_reassignment', label: 'Bay reassignment count' },
  { key: 'local_loading', label: 'Local Loading (Count)' },
  { key: 'local_loading_qty', label: 'Local Loading (Vol KL)' },
  { key: 'over_loading', label: 'Overloading (Count)' },
  { key: 'over_loading_qty', label: 'Overloading (Vol KL)' },
  { key: 'mfm_vs_bcu', label: 'BCU VS MFM (Count)' },
  { key: 'mfm_vs_bcu_difference', label: 'BCU VS MFM (Vol KL)' },
  { key: 'bcu_vs_invoice', label: 'BCU VS Invoice (Count)' },
  { key: 'bcu_vs_invoice_difference', label: 'BCU VS Invoice (Vol KL)' },
  { key: 'unauthorised_flow', label: 'Unauthorised Flow (Count)' },
  { key: 'unauthorised_flow_net_totalizer', label: 'Unauthorised Flow (Net Totalizer)' },
  { key: 'gantry_permissive_off', label: 'Gantry permissive off count' },
  { key: 'manual_dip_cross_check', label: 'Manual Dip Cross Check' },
];

/** Display labels for location table fields (for date-wise breadcrumb etc.) */
export const FIELD_LABELS: Partial<Record<keyof LocationWiseCounts, string>> = {
  bay_reassignment: 'Bay reassignment count',
  local_loading: 'Local Loading',
  local_loading_qty: 'Local Loading (Vol)',
  over_loading: 'Overloading',
  over_loading_qty: 'Overloading (Vol)',
  bay_alert_count: 'Bay Alert Count',
  mfm_vs_bcu: 'BCU VS MFM',
  mfm_vs_bcu_difference: 'BCU VS MFM (Vol)',
  bcu_vs_invoice: 'BCU VS Invoice',
  bcu_vs_invoice_difference: 'BCU VS Invoice (Vol)',
  unauthorised_flow: 'Unauthorised Flow',
  unauthorised_flow_net_totalizer: 'Unauthorised Flow (Net Totalizer)',
  gantry_permissive_off: 'Gantry permissive off count',
};

/** Total column = sum of: Alerts count, Bay reassignment, Local loading count, Overloading count, BCU vs MFM count, BCU vs invoice count, Unauthorised flow count, Gantry permissive off */
export function getLocationWiseRowTotal(counts: LocationWiseCounts): number {
  return (
    (counts.bay_alert_count ?? 0) +
    (counts.bay_reassignment ?? 0) +
    (counts.local_loading ?? 0) +
    (counts.over_loading ?? 0) +
    (counts.mfm_vs_bcu ?? 0) +
    (counts.bcu_vs_invoice ?? 0) +
    (counts.unauthorised_flow ?? 0) +
    (counts.gantry_permissive_off ?? 0)
  );
}

/** Map location-table field to date-wise category id */
export const FIELD_TO_CATEGORY_ID: Partial<Record<keyof LocationWiseCounts, string>> = {
  bay_reassignment: 'hostBayReAssignment',
  local_loading: 'localLoading',
  over_loading: 'overLoading',
  bay_alert_count: 'alertsCount',
  gantry_permissive_off: 'gantryPermissiveOffCount',
  mfm_vs_bcu: 'mfmVsBcu',
  bcu_vs_invoice: 'bcuVsInvoice',
  bcu_vs_mfm_mismatch: 'mfmVsBcu',
  bcu_vs_invoice_mismatch: 'bcuVsInvoice',
  unauthorised_flow: 'unauthorisedFlowNetTotalizer',
  manual_dip_cross_check: 'crossCheckedManuallyApSystem',
};

/** Bay / category shape for date-wise table */
export interface BayCategory {
  id: string;
  name: string;
  color: string;
  alertCount: number;
  progress?: number;
  apm?: boolean;
  gto?: boolean;
  expanded?: boolean;
}

export interface Bay {
  id: string;
  name: string;
  totalAlerts: number;
  progress?: number;
  apm?: boolean;
  gto?: boolean;
  categories: BayCategory[];
  expanded?: boolean;
}
