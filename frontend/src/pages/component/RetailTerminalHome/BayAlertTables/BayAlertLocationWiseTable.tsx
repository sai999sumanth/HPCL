import React, { useMemo } from 'react';
import { ChevronRight, ChevronDown, Info } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/@/components/ui/popover';
import {
  type LocationWiseItem,
  type LocationWiseCounts,
  getLocationWiseRowTotal,
  FIELD_LABELS,
} from './BayAlertTableTypes';

/** Keys included in Total count (same order as getLocationWiseRowTotal) */
const TOTAL_COUNT_FIELD_KEYS: (keyof LocationWiseCounts)[] = [
  'bay_alert_count',
  'bay_reassignment',
  'local_loading',
  'over_loading',
  'mfm_vs_bcu',
  'bcu_vs_invoice',
  'unauthorised_flow',
  'gantry_permissive_off',
];

/** Severity-based text colour only (no label). Critical uses red circle in render. */
function getSeverityTextClass(severity: string | undefined): string {
  const s = (severity ?? '').toLowerCase();
  if (s === 'critical') return '';
  if (s === 'high') return 'text-red-700';
  if (s === 'medium') return 'text-yellow-600';
  if (s === 'low') return 'text-emerald-700';
  return '';
}

function isCriticalSeverity(severity: string | undefined): boolean {
  return (severity ?? '').toLowerCase() === 'critical';
}

/** Severity order: critical > high > medium > low. Returns highest severity present in bay counts. */
function getMaxSeverityForBay(counts: LocationWiseCounts): 'critical' | 'high' | 'medium' | 'low' {
  const severities = [
    counts.bay_reassignment_severity,
    counts.bay_alert_count_severity,
    counts.local_loading_severity,
    counts.over_loading_severity,
    counts.mfm_vs_bcu_severity,
    counts.bcu_vs_invoice_severity,
  ]
    .map((s) => (s ?? '').toLowerCase())
    .filter(Boolean);
  if (severities.some((s) => s === 'critical')) return 'critical';
  if (severities.some((s) => s === 'high')) return 'high';
  if (severities.some((s) => s === 'medium')) return 'medium';
  if (severities.some((s) => s === 'low')) return 'low';
  return 'low';
}

/** Pill/badge style: colored text on matching light background (Critical=red, High=orange, Medium=amber, Low=green). */
function getSeverityLabelClass(severity: 'critical' | 'high' | 'medium' | 'low'): string {
  const base = 'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide';
  if (severity === 'critical') return `${base} bg-red-100 text-red-700`;
  if (severity === 'high') return `${base} bg-orange-100 text-orange-700`;
  if (severity === 'medium') return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-emerald-100 text-emerald-700`;
}

/** Renders count with severity: critical = red circle outline + red text, else severity text colour. Wrapped to prevent overflow. */
function renderCountWithSeverity(
  value: number,
  severity: string | undefined,
  size: 'md' | 'sm'
): React.ReactNode {
  if (isCriticalSeverity(severity)) {
    const circleClass =
      size === 'md'
        ? 'inline-flex h-5 w-8 max-w-full flex-shrink-0 items-center justify-center rounded-full border-2 border-red-600 box-border text-xs font-bold text-red-700'
        : 'inline-flex h-4 w-7 max-w-full flex-shrink-0 items-center justify-center rounded-full border-2 border-red-600 box-border text-[11px] font-bold text-red-700';
    return (
      <span className="flex justify-center overflow-hidden">
        <span className={circleClass}>{value.toLocaleString()}</span>
      </span>
    );
  }
  return value.toLocaleString();
}

export interface BayAlertLocationWiseTableProps {
  data: LocationWiseItem[];
  isLoading: boolean;
  error: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (locationId: string) => void;
  onNavigateToDateWise: (
    locationName: string,
    field: keyof LocationWiseCounts | null,
    bay: string | null
  ) => void;
}

function formatVol(val: number): string {
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BayAlertLocationWiseTable({
  data,
  isLoading,
  error,
  expandedIds,
  onToggleExpand,
  onNavigateToDateWise,
}: BayAlertLocationWiseTableProps) {
  const totals = useMemo(() => {
    return data.reduce<LocationWiseCounts>(
      (acc, loc) => ({
        bay_reassignment: acc.bay_reassignment + (loc.overall_counts.bay_reassignment ?? 0),
        local_loading: acc.local_loading + (loc.overall_counts.local_loading ?? 0),
        local_loading_qty: acc.local_loading_qty + (loc.overall_counts.local_loading_qty ?? 0),
        over_loading: acc.over_loading + (loc.overall_counts.over_loading ?? 0),
        over_loading_qty: acc.over_loading_qty + (loc.overall_counts.over_loading_qty ?? 0),
        bay_alert_count: acc.bay_alert_count + (loc.overall_counts.bay_alert_count ?? 0),
        gantry_permissive_off: acc.gantry_permissive_off + (loc.overall_counts.gantry_permissive_off ?? 0),
        mfm_vs_bcu: acc.mfm_vs_bcu + (loc.overall_counts.mfm_vs_bcu ?? 0),
        mfm_vs_bcu_difference: acc.mfm_vs_bcu_difference + (loc.overall_counts.mfm_vs_bcu_difference ?? 0),
        bcu_vs_invoice: acc.bcu_vs_invoice + (loc.overall_counts.bcu_vs_invoice ?? 0),
        bcu_vs_invoice_difference: acc.bcu_vs_invoice_difference + (loc.overall_counts.bcu_vs_invoice_difference ?? 0),
        unauthorised_flow: acc.unauthorised_flow + (loc.overall_counts.unauthorised_flow ?? 0),
        unauthorised_flow_net_totalizer: acc.unauthorised_flow_net_totalizer + (loc.overall_counts.unauthorised_flow_net_totalizer ?? 0),
        bcu_vs_mfm_mismatch: 0,
        bcu_vs_invoice_mismatch: 0,
        manual_dip_cross_check: acc.manual_dip_cross_check + (loc.overall_counts.manual_dip_cross_check ?? 0),
      }),
      {
        bay_reassignment: 0,
        local_loading: 0,
        local_loading_qty: 0,
        over_loading: 0,
        over_loading_qty: 0,
        bay_alert_count: 0,
        gantry_permissive_off: 0,
        mfm_vs_bcu: 0,
        mfm_vs_bcu_difference: 0,
        bcu_vs_invoice: 0,
        bcu_vs_invoice_difference: 0,
        unauthorised_flow: 0,
        unauthorised_flow_net_totalizer: 0,
        bcu_vs_mfm_mismatch: 0,
        bcu_vs_invoice_mismatch: 0,
        manual_dip_cross_check: 0,
      }
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading location data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center text-gray-500">
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <table className="min-w-full border-collapse text-xs">
<thead className="sticky top-0 z-[35] bg-slate-100 text-slate-700 border-b border-slate-200 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08)]">
          <tr>
            <th
              rowSpan={2}
              className="px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 sticky left-0 z-[40] bg-slate-100 min-w-[160px] align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
            >
              Location hierarchy
            </th>
            <th
              rowSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[72px] align-middle"
            >
              <div className="flex items-center justify-center gap-1">
                <span>Total count</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                      aria-label="What fields are included in Total count"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3 text-left" align="center">
                    <p className="font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-2 text-xs">
                      Total count is the sum of:
                    </p>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {TOTAL_COUNT_FIELD_KEYS.map((key) => (
                        <li key={key} className="flex items-center gap-2">
                          <span className="text-slate-400">•</span>
                          {FIELD_LABELS[key] ?? key}
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
            </th>
            <th
              rowSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[80px] align-middle"
            >
              Bay Alert Count
            </th>
            <th
              rowSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[90px] align-middle"
            >
              Bay reassignment count
            </th>
            <th
              colSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[130px]"
            >
              Local loading
            </th>
            <th
              colSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[130px]"
            >
              Overloading
            </th>
            <th
              colSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[130px]"
            >
              BCU vs MFM
            </th>
            <th
              colSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[140px]"
            >
              BCU vs invoice
            </th>
            <th
              colSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[130px]"
            >
              Unauthorised flow
            </th>
            <th
              rowSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[100px] align-middle"
            >
              Gantry permissive off count
            </th>
            <th
              rowSpan={2}
              className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide border-r border-slate-200 min-w-[100px] align-middle"
            >
              Manual dip cross check
            </th>
          </tr>
          <tr className="bg-slate-100 text-slate-600">
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[64px]">
              Count
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[80px]">
              Vol (KL)
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[64px]">
              Count
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[80px] whitespace-nowrap">
              Vol (KL)
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[64px]">
              Count
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[80px] whitespace-nowrap">
              Vol (KL)
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[64px]">
              Count
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[80px] whitespace-nowrap">
              Vol (KL)
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[64px]">
              Count
            </th>
            <th className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-tight border-r border-slate-200 min-w-[80px]">
              Net totalizer
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
        {data.map((loc) => {
          const isExpanded = expandedIds.has(loc.location_id);
          return (
          <React.Fragment key={loc.location_id}>
            <tr className={`group border-b border-slate-100 transition-colors ${isExpanded ? 'bg-blue-100' : ''}`}>
              <td className={`px-2 py-1 text-xs font-semibold text-slate-900 border-r border-slate-100 sticky left-0 z-[25] group-hover:bg-blue-100 align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors ${isExpanded ? 'bg-blue-100' : 'bg-white'}`}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleExpand(loc.location_id)}
                    className="p-1 hover:bg-slate-200 rounded flex-shrink-0 cursor-pointer transition-colors"
                  >
                    {expandedIds.has(loc.location_id) ? (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                  <span className="truncate">{loc.location_name}</span>
                </div>
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, null, null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, null, null);
                  }
                }}
                className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${isExpanded ? 'bg-blue-100' : 'bg-slate-50/80'} text-slate-800`}
              >
                {getLocationWiseRowTotal(loc.overall_counts).toLocaleString()}
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, 'bay_alert_count', null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, 'bay_alert_count', null);
                  }
                }}
                className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(loc.overall_counts.bay_alert_count_severity) || 'text-slate-800'}`}
              >
                {renderCountWithSeverity(loc.overall_counts.bay_alert_count, loc.overall_counts.bay_alert_count_severity, 'md')}
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, 'bay_reassignment', null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, 'bay_reassignment', null);
                  }
                }}
                className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:opacity-90 hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(loc.overall_counts.bay_reassignment_severity) || 'text-slate-700'}`}
              >
                {renderCountWithSeverity(loc.overall_counts.bay_reassignment, loc.overall_counts.bay_reassignment_severity, 'md')}
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, 'local_loading', null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, 'local_loading', null);
                  }
                }}
                className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(loc.overall_counts.local_loading_severity) || 'text-slate-800'}`}
              >
                {renderCountWithSeverity(loc.overall_counts.local_loading, loc.overall_counts.local_loading_severity, 'md')}
              </td>
              <td className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors ${getSeverityTextClass(loc.overall_counts.local_loading_severity) || (isCriticalSeverity(loc.overall_counts.local_loading_severity) ? 'text-red-700' : 'text-slate-700')}`}>
                {formatVol(loc.overall_counts.local_loading_qty)}
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, 'over_loading', null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, 'over_loading', null);
                  }
                }}
                className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(loc.overall_counts.over_loading_severity) || 'text-slate-800'}`}
              >
                {renderCountWithSeverity(loc.overall_counts.over_loading, loc.overall_counts.over_loading_severity, 'md')}
              </td>
              <td className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors ${getSeverityTextClass(loc.overall_counts.over_loading_severity) || (isCriticalSeverity(loc.overall_counts.over_loading_severity) ? 'text-red-700' : 'text-slate-700')}`}>
                {formatVol(loc.overall_counts.over_loading_qty)}
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, 'mfm_vs_bcu', null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, 'mfm_vs_bcu', null);
                  }
                }}
                className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(loc.overall_counts.mfm_vs_bcu_severity) || 'text-slate-800'}`}
              >
                {renderCountWithSeverity(loc.overall_counts.mfm_vs_bcu, loc.overall_counts.mfm_vs_bcu_severity, 'md')}
              </td>
              <td className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors ${getSeverityTextClass(loc.overall_counts.mfm_vs_bcu_severity) || (isCriticalSeverity(loc.overall_counts.mfm_vs_bcu_severity) ? 'text-red-700' : 'text-slate-700')}`}>
                {formatVol(loc.overall_counts.mfm_vs_bcu_difference)}
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, 'bcu_vs_invoice', null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, 'bcu_vs_invoice', null);
                  }
                }}
                className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(loc.overall_counts.bcu_vs_invoice_severity) || 'text-slate-800'}`}
              >
                {renderCountWithSeverity(loc.overall_counts.bcu_vs_invoice, loc.overall_counts.bcu_vs_invoice_severity, 'md')}
              </td>
              <td className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors ${getSeverityTextClass(loc.overall_counts.bcu_vs_invoice_severity) || (isCriticalSeverity(loc.overall_counts.bcu_vs_invoice_severity) ? 'text-red-700' : 'text-slate-700')}`}>
                {formatVol(loc.overall_counts.bcu_vs_invoice_difference)}
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, 'unauthorised_flow', null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, 'unauthorised_flow', null);
                  }
                }}
                className="px-2 py-1 text-center text-xs font-bold text-slate-800 border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors"
              >
                {loc.overall_counts.unauthorised_flow.toLocaleString()}
              </td>
              <td className="px-2 py-1 text-center text-xs font-bold text-slate-700 border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors">
                {formatVol(loc.overall_counts.unauthorised_flow_net_totalizer)}
              </td>
              <td className="px-2 py-1 text-center text-xs font-bold text-slate-800 border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors">
                {loc.overall_counts.gantry_permissive_off.toLocaleString()}
              </td>
              <td
                role="button"
                tabIndex={0}
                onClick={() => onNavigateToDateWise(loc.location_name, 'manual_dip_cross_check', null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToDateWise(loc.location_name, 'manual_dip_cross_check', null);
                  }
                }}
                className="px-2 py-1 text-center text-xs font-bold text-slate-800 border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors"
              >
                {(loc.overall_counts.manual_dip_cross_check ?? 0).toLocaleString()}
              </td>
            </tr>
            {isExpanded &&
              Object.entries(loc.bays).map(([bayKey, counts]) => {
                const baySeverity = getMaxSeverityForBay(counts);
                return (
                <tr key={bayKey} className="group border-b border-slate-100 bg-blue-50 transition-colors">
                  <td className="px-2 py-1 text-xs font-semibold text-slate-700 border-r border-slate-100 border-l-2 border-l-slate-300 sticky left-0 z-[25] bg-blue-50 group-hover:bg-blue-100 pl-6 align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors">
                    <span className="flex items-center justify-between gap-2 w-full min-w-0">
                      <span className="truncate shrink-0">{bayKey.replace(/^bay/, 'Bay ')}</span>
                      <span className={`${getSeverityLabelClass(baySeverity)} shrink-0`}>
                        {baySeverity}
                      </span>
                    </span>
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, null, bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, null, bayKey);
                      }
                    }}
                    className="px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle bg-blue-50 group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors text-slate-700"
                  >
                    {getLocationWiseRowTotal(counts).toLocaleString()}
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, 'bay_alert_count', bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, 'bay_alert_count', bayKey);
                      }
                    }}
                    className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(counts.bay_alert_count_severity) || 'text-slate-700'}`}
                  >
                    {renderCountWithSeverity(counts.bay_alert_count, counts.bay_alert_count_severity, 'sm')}
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, 'bay_reassignment', bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, 'bay_reassignment', bayKey);
                      }
                    }}
                    className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:opacity-90 hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(counts.bay_reassignment_severity) || 'text-slate-700'}`}
                  >
                    {renderCountWithSeverity(counts.bay_reassignment, counts.bay_reassignment_severity, 'sm')}
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, 'local_loading', bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, 'local_loading', bayKey);
                      }
                    }}
                    className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(counts.local_loading_severity) || 'text-slate-700'}`}
                  >
                    {renderCountWithSeverity(counts.local_loading, counts.local_loading_severity, 'sm')}
                  </td>
                  <td className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors ${getSeverityTextClass(counts.local_loading_severity) || (isCriticalSeverity(counts.local_loading_severity) ? 'text-red-700' : 'text-slate-600')}`}>
                    {formatVol(counts.local_loading_qty)}
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, 'over_loading', bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, 'over_loading', bayKey);
                      }
                    }}
                    className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(counts.over_loading_severity) || 'text-slate-700'}`}
                  >
                    {renderCountWithSeverity(counts.over_loading, counts.over_loading_severity, 'sm')}
                  </td>
                  <td className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors ${getSeverityTextClass(counts.over_loading_severity) || (isCriticalSeverity(counts.over_loading_severity) ? 'text-red-700' : 'text-slate-600')}`}>
                    {formatVol(counts.over_loading_qty)}
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, 'mfm_vs_bcu', bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, 'mfm_vs_bcu', bayKey);
                      }
                    }}
                    className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(counts.mfm_vs_bcu_severity) || 'text-slate-700'}`}
                  >
                    {renderCountWithSeverity(counts.mfm_vs_bcu, counts.mfm_vs_bcu_severity, 'sm')}
                  </td>
                  <td className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors ${getSeverityTextClass(counts.mfm_vs_bcu_severity) || (isCriticalSeverity(counts.mfm_vs_bcu_severity) ? 'text-red-700' : 'text-slate-600')}`}>
                    {formatVol(counts.mfm_vs_bcu_difference)}
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, 'bcu_vs_invoice', bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, 'bcu_vs_invoice', bayKey);
                      }
                    }}
                    className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors ${getSeverityTextClass(counts.bcu_vs_invoice_severity) || 'text-slate-700'}`}
                  >
                    {renderCountWithSeverity(counts.bcu_vs_invoice, counts.bcu_vs_invoice_severity, 'sm')}
                  </td>
                  <td className={`px-2 py-1 text-center text-xs font-bold overflow-hidden border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors ${getSeverityTextClass(counts.bcu_vs_invoice_severity) || (isCriticalSeverity(counts.bcu_vs_invoice_severity) ? 'text-red-700' : 'text-slate-600')}`}>
                    {formatVol(counts.bcu_vs_invoice_difference)}
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, 'unauthorised_flow', bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, 'unauthorised_flow', bayKey);
                      }
                    }}
                    className="px-2 py-1 text-center text-xs font-bold text-slate-700 border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors"
                  >
                    {counts.unauthorised_flow.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-center text-xs font-bold text-slate-600 border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors">
                    {formatVol(counts.unauthorised_flow_net_totalizer)}
                  </td>
                  <td className="px-2 py-1 text-center text-xs font-bold text-slate-700 border-r border-slate-100 align-middle group-hover:bg-blue-100 transition-colors">
                    {counts.gantry_permissive_off.toLocaleString()}
                  </td>
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToDateWise(loc.location_name, 'manual_dip_cross_check', bayKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigateToDateWise(loc.location_name, 'manual_dip_cross_check', bayKey);
                      }
                    }}
                    className="px-2 py-1 text-center text-xs font-bold text-slate-700 border-r border-slate-100 align-middle group-hover:bg-blue-100 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors"
                  >
                    {(counts.manual_dip_cross_check ?? 0).toLocaleString()}
                  </td>
                </tr>
              );})}
          </React.Fragment>
          );
        })}
      </tbody>
      <tfoot className="bg-slate-100 border-t-2 border-slate-200 text-slate-800">
        <tr>
          <td className="px-2 py-1 text-xs font-bold border-r border-slate-200 sticky left-0 z-[25] bg-slate-100 align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
            Total count
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {getLocationWiseRowTotal(totals).toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.bay_alert_count.toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.bay_reassignment.toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.local_loading.toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {formatVol(totals.local_loading_qty)}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.over_loading.toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {formatVol(totals.over_loading_qty)}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.mfm_vs_bcu.toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {formatVol(totals.mfm_vs_bcu_difference)}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.bcu_vs_invoice.toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {formatVol(totals.bcu_vs_invoice_difference)}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.unauthorised_flow.toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {formatVol(totals.unauthorised_flow_net_totalizer)}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.gantry_permissive_off.toLocaleString()}
          </td>
          <td className="px-2 py-1 text-center text-xs font-bold border-r border-slate-200 align-middle">
            {totals.manual_dip_cross_check.toLocaleString()}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
