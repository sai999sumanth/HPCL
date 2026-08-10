import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical, Search, ZoomIn, ZoomOut, RotateCcw, BarChart3, Table, Eye, EyeOff, X, Download, Hash, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Truck, AlertTriangle, ArrowLeftRight, FileText, ShieldAlert, Info, Calendar, LayoutGrid } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, parseISO, isSameDay, isAfter, startOfDay, subDays, subMonths, getDay, differenceInDays, addHours, addMinutes } from 'date-fns';
import { apiClient } from '@/services/apiClient';
import { Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/@/components/ui/popover';
import type { Bay, BayCategory, LocationWiseCounts, LocationWiseItem } from './BayAlertTables/BayAlertTableTypes';
import { LOCATION_EXPORT_COLUMNS, getLocationWiseRowTotal, FIELD_TO_CATEGORY_ID } from './BayAlertTables/BayAlertTableTypes';
import { BayAlertLocationWiseTable } from './BayAlertTables/BayAlertLocationWiseTable';
import { BayAlertDateWiseTable } from './BayAlertTables/BayAlertDateWiseTable';

interface AlertPoint {
  bayId: string;
  categoryId: string;
  date: string;
  count: number;
}

// New JSON structure interfaces
interface NewBayData {
  bay_number: string | number; // Can be string like "01" or number
  total_count: number;
  HostBayReAssignment?: number;
  HostBayReAssignment_details?: any[];
  LocalLoading?: number;
  LocalLoading_details?: any[];
  OverLoading?: number;
  OverLoading_details?: any[];
  [key: string]: any; // Allow other category fields
}

interface NewJsonStructure {
  date: string;
  bays: NewBayData[];
}

// New API response: { Counts: {...}, data: NewJsonStructure[] }
interface BayAlertApiResponse {
  Counts?: {
    TotalBCU?: number;
    TotalActiveBays?: number;
    HostBayReAssignment?: number;
    LocalLoading?: number;
    LocalLoading_qty?: number;
    OverLoading?: number;
    OverLoading_qty?: number;
    MFM_VS_BCU?: number;
    MFM_VS_BCU_difference?: number;
    BCU_VS_INVOICE?: number;
    BCU_VS_INVOICE_difference?: number;
    UnauthorisedFlow?: number;
    UnauthorisedFlow_qty?: number;
    UnauthorisedFlow_net_totalizer?: number;
    TotalUniqueTruckNumbersCount?: number;
    BcuVsMfmMismatch?: number;
    BcuVsInvoiceMismatch?: number;
  };
  data: NewJsonStructure[];
}

interface Location {
  sap_id: string;
  name: string;
}

interface LocationApiResponse {
  status: boolean;
  message: string;
  data: {
    bu_list: string[];
    zones: string[];
    regions: string[];
    sales_areas: string[];
    locations: Location[];
  };
}

// API response shape for "get bay counts"
interface GetBayCountsApiCounts {
  TotalBCU?: number;
  TotalActiveBays?: number;
  HostBayReAssignment?: number;
  HostBayReAssignment_severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  LocalLoading?: number;
  LocalLoading_severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  LocalLoading_qty?: number;
  OverLoading?: number;
  OverLoading_severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  OverLoading_qty?: number;
  MFM_VS_BCU?: number;
  MFM_VS_BCU_severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  MFM_VS_BCU_difference?: number;
  BCU_VS_INVOICE?: number;
  BCU_VS_INVOICE_severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  BCU_VS_INVOICE_difference?: number;
  TotalUniqueTruckNumbersCount?: number;
  UnauthorisedFlow?: number;
  UnauthorisedFlow_net_totalizer?: number;
  UnauthorisedFlow_qty?: number;
  Alerts_Count?: number;
  Alerts_Count_severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  Gantry_Permissive_off_Count?: number;
  BcuVsMfmMismatch?: number;
  BcuVsInvoiceMismatch?: number;
}

interface GetBayCountsLocation {
  location_name: string;
  counts: GetBayCountsApiCounts;
  bays: Array<{ bay_number: string; counts: GetBayCountsApiCounts }>;
}

interface GetBayCountsResponse {
  total_counts?: GetBayCountsApiCounts;
  locations?: GetBayCountsLocation[];
}

function mapApiCountsToLocationWiseCounts(c: GetBayCountsApiCounts | undefined): LocationWiseCounts {
  if (!c) {
    return {
      bay_reassignment: 0,
      bay_reassignment_severity: undefined,
      local_loading: 0,
      local_loading_severity: undefined,
      local_loading_qty: 0,
      over_loading: 0,
      over_loading_severity: undefined,
      over_loading_qty: 0,
      bay_alert_count: 0,
      bay_alert_count_severity: undefined,
      unauthorised_flow: 0,
      unauthorised_flow_net_totalizer: 0,
      gantry_permissive_off: 0,
      mfm_vs_bcu: 0,
      mfm_vs_bcu_severity: undefined,
      mfm_vs_bcu_difference: 0,
      bcu_vs_invoice: 0,
      bcu_vs_invoice_severity: undefined,
      bcu_vs_invoice_difference: 0,
      bcu_vs_mfm_mismatch: 0,
      bcu_vs_invoice_mismatch: 0,
      manual_dip_cross_check: 0,
    };
  }
  return {
    bay_reassignment: c.HostBayReAssignment ?? 0,
    bay_reassignment_severity: c.HostBayReAssignment_severity,
    local_loading: c.LocalLoading ?? 0,
    local_loading_severity: c.LocalLoading_severity,
    local_loading_qty: c.LocalLoading_qty ?? 0,
    over_loading: c.OverLoading ?? 0,
    over_loading_severity: c.OverLoading_severity,
    over_loading_qty: c.OverLoading_qty ?? 0,
    bay_alert_count: c.Alerts_Count ?? 0,
    bay_alert_count_severity: c.Alerts_Count_severity,
    unauthorised_flow: c.UnauthorisedFlow ?? 0,
    unauthorised_flow_net_totalizer: c.UnauthorisedFlow_net_totalizer ?? 0,
    gantry_permissive_off: c.Gantry_Permissive_off_Count ?? 0,
    mfm_vs_bcu: c.MFM_VS_BCU ?? 0,
    mfm_vs_bcu_severity: c.MFM_VS_BCU_severity,
    mfm_vs_bcu_difference: c.MFM_VS_BCU_difference ?? 0,
    bcu_vs_invoice: c.BCU_VS_INVOICE ?? 0,
    bcu_vs_invoice_severity: c.BCU_VS_INVOICE_severity,
    bcu_vs_invoice_difference: c.BCU_VS_INVOICE_difference ?? 0,
    bcu_vs_mfm_mismatch: 0,
    bcu_vs_invoice_mismatch: 0,
    manual_dip_cross_check: 0,
  };
}

function transformGetBayCountsToLocationWiseItems(locations: GetBayCountsLocation[]): LocationWiseItem[] {
  return locations.map((loc, index) => {
    const baysRecord: Record<string, LocationWiseCounts> = {};
    (loc.bays || []).forEach((b) => {
      const key = `bay${String(b.bay_number).padStart(2, '0')}`;
      baysRecord[key] = mapApiCountsToLocationWiseCounts(b.counts);
    });
    return {
      location_id: loc.location_name || `loc-${index}`,
      location_name: loc.location_name,
      overall_counts: mapApiCountsToLocationWiseCounts(loc.counts),
      bays: baysRecord,
    };
  });
}

// Category mapping from new structure to component structure (lighter colors for table readability)
const CATEGORY_MAPPING: { [key: string]: { id: string; name: string; color: string; type: string } } = {
  'HostBayReAssignment': { id: 'hostBayReAssignment', name: 'Bay Reassignment', color: '#a78bfa', type: 'REASSIGNMENT' },
  'LocalLoading': { id: 'localLoading', name: 'Local Loading', color: '#60a5fa', type: 'STANDARD' },
  'OverLoading': { id: 'overLoading', name: 'Over Loading', color: '#f87171', type: 'OVERLOADING' },
  'Gantry_Permissive_off_Count': { id: 'gantryPermissiveOffCount', name: 'Gantry Permissive off', color: '#22d3ee', type: 'OTHER' },
  'Alerts_Count': { id: 'alertsCount', name: 'Alert Count', color: '#fbbf24', type: 'OTHER' },
  'Bay_Alerts_Count': { id: 'alertsCount', name: 'Alert Count', color: '#fbbf24', type: 'OTHER' },
  'MFM_VS_BCU': { id: 'mfmVsBcu', name: 'BCU VS MFM Mismatch', color: '#34d399', type: 'OTHER' },
  'BCU_VS_INVOICE': { id: 'bcuVsInvoice', name: 'BCU VS Invoice Mismatch', color: '#fb923c', type: 'OTHER' },
  'Cross_checked_ManuallyAP_system': { id: 'crossCheckedManuallyApSystem', name: 'Manual Dip Cross Check', color: '#ec4899', type: 'OTHER' },
  'UnauthorisedFlow_net_totalizer': { id: 'unauthorisedFlowNetTotalizer', name: 'Unauthorised Flow_net_totalizer', color: '#8b5cf6', type: 'OTHER' },
  // API can return HostUnauthorisedFlow_count / HostUnauthorisedFlow_details (same category as Unauthorised Flow)
  'HostUnauthorisedFlow_count': { id: 'unauthorisedFlowNetTotalizer', name: 'Unauthorised Flow', color: '#8b5cf6', type: 'OTHER' },
  'HostUnauthorisedFlow': { id: 'unauthorisedFlowNetTotalizer', name: 'Unauthorised Flow', color: '#8b5cf6', type: 'OTHER' },
};

// Ordered category keys for total-count breakdown (clickable total)
const TOTAL_COUNT_BREAKDOWN_KEYS = [
  'HostBayReAssignment',
  'LocalLoading',
  'OverLoading',
  'Alerts_Count',
  'Bay_Alerts_Count',
  'Gantry_Permissive_off_Count',
  'MFM_VS_BCU',
  'BCU_VS_INVOICE',
  'UnauthorisedFlow_net_totalizer',
  'HostUnauthorisedFlow_count',
  'Cross_checked_ManuallyAP_system',
];

// Helper function to get or create category mapping
const getCategoryInfo = (key: string): { id: string; name: string; color: string } => {
  if (CATEGORY_MAPPING[key]) {
    return CATEGORY_MAPPING[key];
  }
  // Auto-generate category info for unknown categories
  const id = key.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase();
  const name = key.replace(/([A-Z])/g, ' $1').trim();
  // Use a default color based on hash of the key
  const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#22d3ee', '#a3e635'];
  const colorIndex = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return { id, name, color: colors[colorIndex] };
};

const EVENT_TIME_KEYS = ['created_at', 'Created_At', 'CreatedAt', 'CREATED_AT'];

/** Display label for detail table columns (e.g. created_at → Event Time) */
const getDetailColumnLabel = (key: string): string => {
  return EVENT_TIME_KEYS.includes(key) ? 'Event Time' : key;
};

/** Sort detail table columns so Event Time (created_at) is first */
const sortDetailKeysEventTimeFirst = (keys: string[]): string[] => {
  return [...keys].sort((a, b) => {
    const aFirst = EVENT_TIME_KEYS.includes(a);
    const bFirst = EVENT_TIME_KEYS.includes(b);
    if (aFirst && !bFirst) return -1;
    if (!aFirst && bFirst) return 1;
    return 0;
  });
};

const TASAnalytics: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Set default to 1 month ago to today
  const today = new Date();
  const oneMonthAgo = subMonths(today, 1);
  const [appliedStartDate, setAppliedStartDate] = useState<string>(format(oneMonthAgo, 'yyyy-MM-dd'));
  const [appliedEndDate, setAppliedEndDate] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [bays, setBays] = useState<Bay[]>([]);
  const [alertPoints, setAlertPoints] = useState<AlertPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const selectedDateRef = useRef<HTMLDivElement>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number>(0);
  const [isHoveringHeader, setIsHoveringHeader] = useState<boolean>(false);
  const [showChart, setShowChart] = useState(false);
  const [rawApiData, setRawApiData] = useState<NewJsonStructure[]>([]);
  const isScrollingRef = useRef(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCustomDateSelected, setIsCustomDateSelected] = useState(false);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string | null>('1m');
  const dateRangePickerRef = useRef<HTMLDivElement>(null);
  const [selectedRowData, setSelectedRowData] = useState<{ dateEntry: NewJsonStructure; bayData: NewBayData } | null>(null);
  const [showRowDetailsPopup, setShowRowDetailsPopup] = useState(false);
  const [showTotalCountBreakdown, setShowTotalCountBreakdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState<BayAlertApiResponse['Counts'] | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [tableSortBy, setTableSortBy] = useState<'name' | 'total' | null>(null);
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('asc');
  const [showColoredBalls, setShowColoredBalls] = useState(true);
  const [bayAlertTableIndex, setBayAlertTableIndex] = useState(0);
  const [locationNameFromFirstTable, setLocationNameFromFirstTable] = useState<string | null>(null);
  const [selectedFieldFromFirstTable, setSelectedFieldFromFirstTable] = useState<keyof LocationWiseCounts | null>(null);
  const [selectedBayFromFirstTable, setSelectedBayFromFirstTable] = useState<string | null>(null);
  const [expandedLocationIds, setExpandedLocationIds] = useState<Set<string>>(new Set());
  const [locationWiseData, setLocationWiseData] = useState<LocationWiseItem[]>([]);
  const [isLoadingLocationWise, setIsLoadingLocationWise] = useState(false);
  const [locationWiseError, setLocationWiseError] = useState<string | null>(null);
  const [locationWiseTotalCounts, setLocationWiseTotalCounts] = useState<BayAlertApiResponse['Counts'] | null>(null);
  const [locationTableSearchQuery, setLocationTableSearchQuery] = useState('');

  const filteredLocationWiseData = useMemo(() => {
    if (!locationTableSearchQuery.trim()) return locationWiseData;
    const q = locationTableSearchQuery.trim().toLowerCase();
    return locationWiseData
      .map((loc) => {
        const nameMatch = loc.location_name.toLowerCase().includes(q);
        const matchingBays = Object.entries(loc.bays).filter(([bayKey]) => {
          const bayLabel = bayKey.replace(/^bay/, 'Bay ');
          return nameMatch || bayLabel.toLowerCase().includes(q);
        });
        const bays = nameMatch ? loc.bays : Object.fromEntries(matchingBays);
        return { ...loc, bays };
      })
      .filter((loc) => loc.location_name.toLowerCase().includes(q) || Object.keys(loc.bays).length > 0);
  }, [locationWiseData, locationTableSearchQuery]);

  const aggregatedBcuFromLocationWise = useMemo(() => {
    if (!locationWiseData?.length) return { mfm: 0, invoice: 0 };
    return {
      mfm: locationWiseData.reduce((s, loc) => s + (loc.overall_counts.mfm_vs_bcu ?? 0), 0),
      invoice: locationWiseData.reduce((s, loc) => s + (loc.overall_counts.bcu_vs_invoice ?? 0), 0),
    };
  }, [locationWiseData]);

  const downloadLocationTableExcel = () => {
    const headers = ['Location / Bay', 'Total count', ...LOCATION_EXPORT_COLUMNS.map((c) => c.label)];
    const rows: (string | number)[][] = [headers];
    filteredLocationWiseData.forEach((loc) => {
      rows.push([
        loc.location_name,
        getLocationWiseRowTotal(loc.overall_counts),
        ...LOCATION_EXPORT_COLUMNS.map((col) => loc.overall_counts[col.key] ?? 0),
      ]);
      Object.entries(loc.bays).forEach(([bayKey, counts]) => {
        rows.push([
          `  ${bayKey.replace(/^bay/, 'Bay ')}`,
          getLocationWiseRowTotal(counts),
          ...LOCATION_EXPORT_COLUMNS.map((col) => counts[col.key] ?? 0),
        ]);
      });
    });
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = headers.map((h, i) => ({ wch: Math.min(Math.max(h.length, 10), 50) }));
    worksheet['!cols'] = colWidths;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Location Summary');
    const filename = `Location_Table_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const downloadDateWiseTableExcel = () => {
    const dateHeaders = weekRanges.flatMap((range) =>
      range.days.map((day) => format(day, 'MMM dd'))
    );
    const headers = ['Bay Name', 'Category', 'Total', ...dateHeaders];
    const rows: (string | number)[][] = [headers];
    sortedBays.forEach((bay) => {
      rows.push([
        bay.name,
        '',
        getBayTotalAlertCount(bay.id),
        ...weekRanges.flatMap((range) =>
          range.days.map((day) => getDayAlertCount(day, bay.id))
        ),
      ]);
      bay.categories.forEach((category) => {
        rows.push([
          '',
          category.name,
          getCategoryAlertCount(bay.id, category.id),
          ...weekRanges.flatMap((range) =>
            range.days.map((day) => getDayAlertCount(day, bay.id, category.id))
          ),
        ]);
      });
    });
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = headers.map((h, i) =>
      i === 0 ? { wch: 14 } : i === 1 ? { wch: 20 } : { wch: 8 }
    );
    worksheet['!cols'] = colWidths;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Date-wise Summary');
    const filename = `DateWise_Table_${locationNameFromFirstTable ?? 'All'}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const toggleLocationExpanded = (locationId: string) => {
    setExpandedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  };

  // Handle quick filter selection
  const handleQuickFilter = (filterType: '15d' | '1m' | '3m') => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    let startDateStr = '';

    switch (filterType) {
      case '15d':
        startDateStr = format(subDays(today, 15), 'yyyy-MM-dd');
        break;
      case '1m':
        startDateStr = format(subMonths(today, 1), 'yyyy-MM-dd');
        break;
      case '3m':
        startDateStr = format(subMonths(today, 3), 'yyyy-MM-dd');
        break;
    }

    setAppliedStartDate(startDateStr);
    setAppliedEndDate(todayStr);
    setSelectedQuickFilter(filterType);
    setIsCustomDateSelected(false);
    setShowDatePicker(false);
    setStartDate('');
    setEndDate('');
  };

  // Handle date submit
  const handleDateSubmit = () => {
    if (startDate && endDate) {
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setIsCustomDateSelected(true);
      setSelectedQuickFilter(null);
      setShowDatePicker(false);
    }
  };

  // Handle start date change
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    // Clear end date only if it's before the new start date
    if (endDate && newStart > endDate) {
      setEndDate('');
    }
  };

  // Close date range picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateRangePickerRef.current && !dateRangePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  // Load data from API for second table (date-wise) - only when second table is shown
  useEffect(() => {
    if (bayAlertTableIndex !== 1) return;

    const locationNameForApi = locationNameFromFirstTable ?? '';
    const selectedBay = selectedBayFromFirstTable ?? null;
    // Extract bay number for API filter, e.g. "bay12" -> "12"
    const bayFilterValue = selectedBay ? selectedBay.replace(/^bay/i, '') : null;
    console.log('Analytics useEffect triggered - locationNameForApi:', locationNameForApi, 'appliedStartDate:', appliedStartDate, 'appliedEndDate:', appliedEndDate, 'bayFilter:', bayFilterValue);

    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('Analytics API: Calling API with location:', locationNameForApi || '(empty - all locations)', bayFilterValue ? `bay=${bayFilterValue}` : '');

        const filters: { key: string; cond: string; value: string }[] = [
            {
              key: "start_date",
              cond: "=",
              value: appliedStartDate
            },
            {
              key: "end_date",
              cond: "=",
              value: appliedEndDate
            },
            {
              key: "location_name",
              cond: "=",
              value: locationNameForApi
            }
        ];
        if (bayFilterValue) {
          filters.push({ key: "bay", cond: "=", value: bayFilterValue });
        }
        const payload = {
          analytical_model: "Host Tables Combined Data",
          filters
        };
        
        console.log('Analytics API: Payload:', payload);
        console.log('Analytics API: Endpoint: /api/tasanalytics/tas_analytics');
        
        const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);
        console.log('Analytics API: Response received:', response);
        const rawData = response.data;

        // Clear counts by default; only set when Counts is present in response
        setCounts(null);

        // Store raw API data and Counts for table display and big number cards
        // New response: { Counts: {...}, data: [{ date, bays: [...] }, ...] }
        let dataArray: NewJsonStructure[] = [];
        if (rawData && typeof rawData === 'object' && 'data' in rawData && Array.isArray((rawData as BayAlertApiResponse).data)) {
          const apiResp = rawData as BayAlertApiResponse;
          dataArray = apiResp.data;
          if (apiResp.Counts) setCounts(apiResp.Counts);
        } else if (Array.isArray(rawData)) {
          dataArray = rawData as unknown as NewJsonStructure[];
        } else if (rawData && typeof rawData === 'object' && 'date' in rawData && 'bays' in rawData) {
          dataArray = [rawData as unknown as NewJsonStructure];
        }
        setRawApiData(dataArray);
        
        // Check if it's the new structure (array of date objects) or old structure
        if (rawData && 'bays' in rawData && 'alertPoints' in rawData) {
          // Old structure - keep for backward compatibility
          const oldData = rawData as { bays: Bay[]; alertPoints: AlertPoint[]; totalAlerts?: number };
          const baysData = (oldData.bays as Bay[]).map(bay => ({
            ...bay,
            expanded: false
          }));
          setBays(baysData);
          setAlertPoints(oldData.alertPoints as AlertPoint[]);
          setTotalAlerts(oldData.totalAlerts || 0);
          setIsLoading(false);
          return;
        }
        
        // Process new structure: Transform to component format
        const bayMap = new Map<string, Bay>();
        const alertPointsArray: AlertPoint[] = [];
        let totalAlertsCount = 0;
        
        // Process each date entry
        dataArray.forEach((dateEntry) => {
          const entryDate = dateEntry.date;
          
          dateEntry.bays.forEach((bayData) => {
            // Handle bay_number as string or number, ensure consistent formatting
            const bayNumStr = String(bayData.bay_number).padStart(2, '0'); // Ensure 2-digit format like "01"
            const bayId = `bay${bayNumStr}`;
            const bayName = `Bay ${bayNumStr}`;
            
            // Initialize bay if not exists
            if (!bayMap.has(bayId)) {
              bayMap.set(bayId, {
                id: bayId,
                name: bayName,
                totalAlerts: 0,
                apm: true, // Default values
                gto: true,
                categories: [],
                expanded: false
              });
            }
            
            const bay = bayMap.get(bayId)!;
            const categoryMap = new Map<string, BayCategory>();
            
            // Process each category field in the bay data
            Object.keys(bayData).forEach((key) => {
              // Skip non-category fields
              if (key === 'bay_number' || key === 'total_count' || key.endsWith('_details')) {
                return;
              }
              
              // Check if this is a category count field
              const categoryInfo = getCategoryInfo(key);
              if (typeof bayData[key] === 'number') {
                const count = bayData[key] as number;
                
                // Initialize category if not exists
                if (!categoryMap.has(categoryInfo.id)) {
                  categoryMap.set(categoryInfo.id, {
                    id: categoryInfo.id,
                    name: categoryInfo.name,
                    color: categoryInfo.color,
                    alertCount: 0,
                    apm: true,
                    gto: true
                  });
                }
                
                const category = categoryMap.get(categoryInfo.id)!;
                category.alertCount += count;
                
                // Create alert points for this date
                if (count > 0) {
                  alertPointsArray.push({
                    bayId: bayId,
                    categoryId: categoryInfo.id,
                    date: entryDate,
                    count: count
                  });
                  totalAlertsCount += count;
                }
              }
            });
            
            // Update bay categories
            categoryMap.forEach((category) => {
              const existingCategory = bay.categories.find(c => c.id === category.id);
              if (existingCategory) {
                existingCategory.alertCount += category.alertCount;
              } else {
                bay.categories.push(category);
              }
            });
          });
        });
        
        // Calculate bay totals from categories
        bayMap.forEach((bay) => {
          bay.totalAlerts = bay.categories.reduce((sum, cat) => sum + cat.alertCount, 0);
        });
        
        // Convert map to array and sort by bay number
        const baysArray = Array.from(bayMap.values()).sort((a, b) => {
          const aNum = parseInt(a.id.replace('bay', '')) || 0;
          const bNum = parseInt(b.id.replace('bay', '')) || 0;
          return aNum - bNum;
        });
        
        setBays(baysArray);
        setAlertPoints(alertPointsArray);
        setTotalAlerts(totalAlertsCount);
        
        console.log('Data loaded from new structure:', {
          bays: baysArray.length,
          alertPoints: alertPointsArray.length,
          totalAlerts: totalAlertsCount
        });
      } catch (error) {
        console.error('Failed to load analytics data:', error);
        // Fallback to empty data on error
        setBays([]);
        setAlertPoints([]);
        setTotalAlerts(0);
        setCounts(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [appliedStartDate, appliedEndDate, refreshTrigger, bayAlertTableIndex, locationNameFromFirstTable, selectedBayFromFirstTable]);

  // Load first table (location-wise) data from API - analytical_model "get bay counts"
  useEffect(() => {
    const loadLocationWiseData = async () => {
      try {
        setIsLoadingLocationWise(true);
        setLocationWiseError(null);
        const payload = {
          analytical_model: 'get bay counts',
          filters: [
            { key: 'start_date', cond: '=', value: appliedStartDate },
            { key: 'end_date', cond: '=', value: appliedEndDate },
            { key: 'location_name', cond: '=', value: '' },
          ],
        };
        const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);
        const raw = response?.data as GetBayCountsResponse | undefined;
        if (raw && typeof raw === 'object') {
          if (raw.total_counts && typeof raw.total_counts === 'object') {
            setLocationWiseTotalCounts(raw.total_counts as BayAlertApiResponse['Counts']);
          } else {
            setLocationWiseTotalCounts(null);
          }
          if (Array.isArray(raw.locations) && raw.locations.length > 0) {
            setLocationWiseData(transformGetBayCountsToLocationWiseItems(raw.locations));
          } else {
            setLocationWiseData([]);
          }
        } else {
          setLocationWiseTotalCounts(null);
          setLocationWiseData([]);
        }
      } catch (err: any) {
        setLocationWiseError(err?.message || 'Failed to load location-wise data');
        setLocationWiseData([]);
        setLocationWiseTotalCounts(null);
      } finally {
        setIsLoadingLocationWise(false);
      }
    };
    loadLocationWiseData();
  }, [appliedStartDate, appliedEndDate, refreshTrigger]);

  // Generate date range from API data only
  const getDateRange = () => {
    if (rawApiData.length === 0) {
      // Return empty range if no data
      return { start: new Date(), end: new Date(), allDays: [] as Date[] };
    }
    
    // Extract all unique dates from API response
    const dates = rawApiData.map(entry => parseISO(entry.date)).sort((a, b) => a.getTime() - b.getTime());
    
    if (dates.length === 0) {
      return { start: new Date(), end: new Date(), allDays: [] as Date[] };
    }
    
    const start = dates[0];
    const end = dates[dates.length - 1];
    
    // Use the actual dates from API, not a continuous range
    const allDays = dates;
    
    return { start, end, allDays };
  };

  const { start, end, allDays } = getDateRange();
  
  // Debug: Log date range and alert points
  useEffect(() => {
    if (alertPoints.length > 0) {
      console.log('Date range:', format(start, 'yyyy-MM-dd'), 'to', format(end, 'yyyy-MM-dd'));
      console.log('Total alert points:', alertPoints.length);
      console.log('Sample dates in alert points:', [...new Set(alertPoints.map(p => p.date))].slice(0, 10));
    }
  }, [alertPoints, start, end]);
  
  // Group days into weeks based on actual dates from API
  const weeks: { start: Date; end: Date; days: Date[] }[] = [];
  
  if (allDays.length > 0) {
    // Group dates by week
    const weekMap = new Map<string, Date[]>();
    
    allDays.forEach(day => {
      const weekStart = startOfWeek(day);
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(day);
    });
    
    // Convert to weeks array and sort by date
    weekMap.forEach((days, weekKey) => {
      const sortedDays = days.sort((a, b) => a.getTime() - b.getTime());
      const weekStart = startOfWeek(sortedDays[0]);
      const weekEnd = endOfWeek(sortedDays[0]);
      weeks.push({ start: weekStart, end: weekEnd, days: sortedDays });
    });
    
    // Sort weeks by start date
    weeks.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Synchronize scrolling between sidebar and chart
  useEffect(() => {
    if (!showChart) return; // Only sync when chart view is shown
    
    const sidebar = sidebarScrollRef.current;
    const chart = chartContainerRef.current;

    if (!sidebar || !chart) return;

    const handleSidebarScroll = (e: Event) => {
      if (isScrollingRef.current) return;
      const target = e.target as HTMLElement;
      isScrollingRef.current = true;
      chart.scrollTop = target.scrollTop;
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    };

    const handleChartScroll = (e: Event) => {
      if (isScrollingRef.current) return;
      const target = e.target as HTMLElement;
      isScrollingRef.current = true;
      sidebar.scrollTop = target.scrollTop;
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    };

    // Use passive listeners for better performance
    sidebar.addEventListener('scroll', handleSidebarScroll, { passive: true });
    chart.addEventListener('scroll', handleChartScroll, { passive: true });

    return () => {
      sidebar.removeEventListener('scroll', handleSidebarScroll);
      chart.removeEventListener('scroll', handleChartScroll);
    };
  }, [showChart, bays]);

  // Scroll to selected date when it changes, or scroll to today by default
  useEffect(() => {
    if (selectedDateRef.current && chartContainerRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const container = chartContainerRef.current;
        const element = selectedDateRef.current;
        
        if (container && element) {
          const containerRect = container.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          
          // Calculate horizontal scroll position
          const scrollLeft = container.scrollLeft;
          const elementLeft = elementRect.left - containerRect.left + scrollLeft;
          const elementWidth = elementRect.width;
          const containerWidth = containerRect.width;
          
          // Center the selected date in the viewport
          const targetScrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);
          
          container.scrollTo({
            left: targetScrollLeft,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [selectedDate, allDays]);

  // Alert points are loaded from JSON/API, no need to generate mock data

  const toggleBay = (bayId: string) => {
    setBays(bays.map(bay => 
      bay.id === bayId ? { ...bay, expanded: !bay.expanded } : bay
    ));
  };

  const getCategoryRowIndex = (bayId: string, categoryId: string): number => {
    let index = 0;
    for (const bay of bays) {
      if (bay.id === bayId) {
        if (bay.expanded) {
          for (const cat of bay.categories) {
            if (cat.id === categoryId) {
              return index;
            }
            index++;
          }
        } else {
          return index;
        }
      } else {
        if (bay.expanded) {
          index += bay.categories.length;
        } else {
          index += 1;
        }
      }
    }
    return index;
  };

  const getTotalRows = (): number => {
    return bays.reduce((total, bay) => {
      return total + (bay.expanded ? bay.categories.length : 1);
    }, 0);
  };

  const getAlertsForDate = (date: Date, bayId: string, categoryId: string): AlertPoint[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const matching = alertPoints.filter(
      point => point.bayId === bayId && 
               point.categoryId === categoryId && 
               point.date === dateStr
    );
    return matching;
  };

  const getTotalAlertCountForDate = (date: Date, bayId: string, categoryId: string): number => {
    const alerts = getAlertsForDate(date, bayId, categoryId);
    return alerts.reduce((sum, alert) => sum + (alert.count || 1), 0);
  };

  const getCategoryAlertCount = (bayId: string, categoryId: string): number => {
    return alertPoints
      .filter(point => point.bayId === bayId && point.categoryId === categoryId)
      .reduce((sum, point) => sum + (point.count || 1), 0);
  };

  const getBayTotalAlertCount = (bayId: string): number => {
    const bay = bays.find(b => b.id === bayId);
    if (!bay) return 0;
    // Calculate from sum of category counts (hierarchical structure)
    return bay.categories.reduce((sum, category) => {
      return sum + getCategoryAlertCount(bayId, category.id);
    }, 0);
  };

  // Helper function to find bay data from rawApiData for a specific date and bay
  const findBayDataForDate = (date: Date, bayId: string): { dateEntry: NewJsonStructure; bayData: NewBayData } | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const bayNumStr = bayId.replace(/^bay/i, ''); // Get bay number string (e.g., "01")
    
    // Find the date entry
    const dateEntry = rawApiData.find(entry => entry.date === dateStr);
    if (!dateEntry) return null;
    
    // Find the bay data - compare as strings to handle both string and number formats
    const bayData = dateEntry.bays.find(bay => String(bay.bay_number).padStart(2, '0') === bayNumStr);
    if (!bayData) return null;
    
    return { dateEntry, bayData };
  };

  // Aggregated bay data across all dates for Total column detail popup
  const getAggregatedBayDataForTotal = (bayId: string): { dateEntry: NewJsonStructure; bayData: NewBayData } | null => {
    const bayNumStr = bayId.replace(/^bay/i, '');
    const matchingEntries = rawApiData.map(entry => {
      const bayData = entry.bays.find(bay => String(bay.bay_number).padStart(2, '0') === bayNumStr);
      return { dateEntry: entry, bayData };
    }).filter((x): x is { dateEntry: NewJsonStructure; bayData: NewBayData } => x.bayData != null);
    if (matchingEntries.length === 0) return null;
    const first = matchingEntries[0];
    const aggregated: NewBayData = {
      bay_number: first.bayData.bay_number,
      total_count: 0,
    };
    const sumKeys = new Set<string>();
    matchingEntries.forEach(({ bayData }) => {
      aggregated.total_count += bayData.total_count ?? 0;
      Object.keys(bayData).forEach(key => {
        if (key !== 'bay_number' && !key.endsWith('_details')) sumKeys.add(key);
      });
    });
    sumKeys.forEach(key => {
      if (key === 'total_count') return;
      let sum = 0;
      matchingEntries.forEach(({ bayData }) => {
        const v = (bayData as any)[key];
        if (typeof v === 'number') sum += v;
      });
      (aggregated as any)[key] = sum;
    });
    // Merge _details arrays from all dates so popup shows "Over Loading Details", "Alert Count Details", etc.
    matchingEntries.forEach(({ dateEntry, bayData }) => {
      Object.keys(bayData).forEach(key => {
        if (!key.endsWith('_details')) return;
        const arr = (bayData as any)[key];
        if (!Array.isArray(arr)) return;
        if (!(aggregated as any)[key]) (aggregated as any)[key] = [];
        arr.forEach((row: any) => {
          (aggregated as any)[key].push({ ...(typeof row === 'object' && row !== null ? row : { value: row }), Date: dateEntry.date });
        });
      });
    });
    const dateEntryForTotal: NewJsonStructure = {
      date: rawApiData.length > 0 ? 'Total (all dates)' : first.dateEntry.date,
      bays: [aggregated],
    };
    return { dateEntry: dateEntryForTotal, bayData: aggregated };
  };

  const getCategoryColor = (bayId: string, categoryId: string): string => {
    const bay = bays.find(b => b.id === bayId);
    const category = bay?.categories.find(c => c.id === categoryId);
    return category?.color || '#60a5fa';
  };

  const isCurrentDay = (date: Date): boolean => {
    return isSameDay(date, new Date());
  };

  const isSelectedDate = (date: Date): boolean => {
    return isSameDay(date, selectedDate);
  };

  const isFutureDate = (date: Date): boolean => {
    const today = startOfDay(new Date());
    const checkDate = startOfDay(date);
    return isAfter(checkDate, today);
  };

  const isSelectedWeek = (week: { start: Date; end: Date }): boolean => {
    return selectedDate >= week.start && selectedDate <= week.end;
  };

  // Calculate trend data for a bay - one bar per day in same order as table columns (right side numbers)
  const getTrendData = (bayId: string): number[] => {
    if (allDays.length === 0) return [];
    return allDays.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return alertPoints
        .filter((p) => p.bayId === bayId && p.date === dateStr)
        .reduce((sum, p) => sum + (p.count || 1), 0);
    });
  };

  // Get max value for trend normalization
  const getMaxTrendValue = (trendData: number[]): number => {
    const max = Math.max(...trendData, 1);
    return max;
  };

  // Filter bays based on search query
  const filteredBays = bays.filter(bay =>
    bay.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorted bays for table (Bay Reassignment / main table)
  const sortedBays = useMemo(() => {
    if (!tableSortBy) return filteredBays;
    const dir = tableSortDir === 'asc' ? 1 : -1;
    return [...filteredBays].sort((a, b) => {
      if (tableSortBy === 'name') {
        return dir * (a.name.localeCompare(b.name, undefined, { numeric: true }));
      }
      const totalA = getBayTotalAlertCount(a.id);
      const totalB = getBayTotalAlertCount(b.id);
      return dir * (totalA - totalB);
    });
  }, [filteredBays, tableSortBy, tableSortDir, bays]);

  const handleTableSort = (column: 'name' | 'total') => {
    if (tableSortBy === column) {
      setTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortBy(column);
      setTableSortDir('asc');
    }
  };

  // Group days into date ranges for display - dynamic based on filter
  // 15d/1m: week-by-week | 3m: 15-day buckets | custom: week if span<=35d else 15-day
  const getDisplayRanges = (): { label: string; start: Date; end: Date; days: Date[] }[] => {
    if (allDays.length === 0) return [];
    
    const use15DayBuckets = (): boolean => {
      if (selectedQuickFilter === '3m') return true;
      if (isCustomDateSelected && appliedStartDate && appliedEndDate) {
        const span = differenceInDays(parseISO(appliedEndDate), parseISO(appliedStartDate));
        return span > 35;
      }
      return false;
    };

    if (use15DayBuckets()) {
      // 3m or long custom range: 15-day buckets
      const bucketSize = 15;
      const ranges: { label: string; start: Date; end: Date; days: Date[] }[] = [];
      for (let i = 0; i < allDays.length; i += bucketSize) {
        const chunk = allDays.slice(i, i + bucketSize);
        if (chunk.length > 0) {
          ranges.push({
            label: `${format(chunk[0], 'MMM dd')} - ${format(chunk[chunk.length - 1], 'MMM dd')}`,
            start: chunk[0],
            end: chunk[chunk.length - 1],
            days: chunk
          });
        }
      }
      return ranges;
    }

    // 15d/1m or short custom: strict 7-day blocks (not calendar weeks)
    const bucketSize = 7;
    const ranges: { label: string; start: Date; end: Date; days: Date[] }[] = [];
    for (let i = 0; i < allDays.length; i += bucketSize) {
      const chunk = allDays.slice(i, i + bucketSize);
      if (chunk.length > 0) {
        ranges.push({
          label: `${format(chunk[0], 'MMM dd')} - ${format(chunk[chunk.length - 1], 'MMM dd')}`,
          start: chunk[0],
          end: chunk[chunk.length - 1],
          days: chunk
        });
      }
    }
    return ranges;
  };

  const weekRanges = getDisplayRanges();

  // Get alert count for a specific day and bay/category
  const getDayAlertCount = (day: Date, bayId: string, categoryId?: string): number => {
    const dateStr = format(day, 'yyyy-MM-dd');
    if (categoryId) {
      return alertPoints
        .filter(p => p.bayId === bayId && p.categoryId === categoryId && p.date === dateStr)
        .reduce((sum, p) => sum + (p.count || 1), 0);
    } else {
      // Get all categories for bay
      const bay = bays.find(b => b.id === bayId);
      if (!bay) return 0;
      return bay.categories.reduce((sum, cat) => {
        return sum + alertPoints
          .filter(p => p.bayId === bayId && p.categoryId === cat.id && p.date === dateStr)
          .reduce((s, p) => s + (p.count || 1), 0);
      }, 0);
    }
  };

  // Get day of week letter (M, T, W, T, F, S, S)
  const getDayLetter = (date: Date): string => {
    const dayIndex = getDay(date); // 0 = Sunday, 1 = Monday, etc.
    const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return letters[dayIndex];
  };

  // Export report function
  const handleExportReport = () => {
    // Create CSV data
    const csvRows: string[] = [];
    
    // Header
    csvRows.push('Bay Name,Category,Total,' + weekRanges.flatMap(range => 
      range.days.map(day => format(day, 'MMM dd'))
    ).join(','));
    
    // Data rows
    filteredBays.forEach(bay => {
      // Bay row
      const bayRow = [
        bay.name,
        '',
        getBayTotalAlertCount(bay.id).toString(),
        ...weekRanges.flatMap(range => 
          range.days.map(day => getDayAlertCount(day, bay.id).toString())
        )
      ];
      csvRows.push(bayRow.join(','));
      
      // Category rows
      bay.categories.forEach(category => {
        const catRow = [
          '',
          category.name,
          getCategoryAlertCount(bay.id, category.id).toString(),
          ...weekRanges.flatMap(range => 
            range.days.map(day => getDayAlertCount(day, bay.id, category.id).toString())
          )
        ];
        csvRows.push(catRow.join(','));
      });
    });
    
    // Download CSV
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bay-alert-distribution-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export popup detailed information to CSV
  const handleExportPopupCSV = () => {
    if (!selectedRowData?.bayData) return;
    const detailKeys = Object.keys(selectedRowData.bayData).filter(key => key.endsWith('_details'));
    if (detailKeys.length === 0) return;
    const csvRows: string[] = [];
    const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    detailKeys.forEach((detailsKey) => {
      const details = (selectedRowData.bayData as any)[detailsKey];
      const categoryKey = detailsKey.replace('_details', '');
      const categoryInfo = getCategoryInfo(categoryKey);
      if (!Array.isArray(details) || details.length === 0) return;
      const allKeys = new Set<string>();
      details.forEach((detail: any) => {
        if (typeof detail === 'object' && detail !== null) {
          Object.keys(detail).forEach(key => allKeys.add(key));
        }
      });
      const keysArray = sortDetailKeysEventTimeFirst(Array.from(allKeys).filter((k) => k !== 'sap_id'));
      csvRows.push(['Category', ...keysArray.map(getDetailColumnLabel)].map(k => escape(k)).join(','));
      details.forEach((detail: any) => {
        const cells = [
          categoryInfo.name,
          ...keysArray.map((key) => {
            const val = detail[key];
            if (val === null || val === undefined) return '';
            if (key === 'Date' && typeof val === 'string') return format(parseISO(val), 'MMM dd, yyyy');
            const isCreatedAt = key === 'created_at' || key === 'Created_At' || key === 'CreatedAt';
            if (isCreatedAt && (typeof val === 'string' || typeof val === 'number')) {
              try {
                const utc = typeof val === 'number' ? new Date(val) : parseISO(val);
                const ist = addMinutes(addHours(utc, 5), 30);
                return format(ist, 'MMM dd, yyyy, hh:mm a');
              } catch { return String(val); }
            }
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val);
          }),
        ].map((c) => escape(c));
        csvRows.push(cells.join(','));
      });
      csvRows.push('');
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `detailed-information-${selectedRowData.dateEntry?.date ?? 'unknown'}-bay-${selectedRowData.bayData?.bay_number ?? 'unknown'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate peak date for intensity map
  const getPeakDate = (): Date | null => {
    if (allDays.length === 0) return null;
    
    const dayTotals = new Map<string, number>();
    allDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const total = alertPoints
        .filter(p => p.date === dateStr)
        .reduce((sum, p) => sum + (p.count || 1), 0);
      dayTotals.set(dateStr, total);
    });
    
    let maxTotal = 0;
    let peakDateStr = '';
    dayTotals.forEach((total, dateStr) => {
      if (total > maxTotal) {
        maxTotal = total;
        peakDateStr = dateStr;
      }
    });
    
    return peakDateStr ? parseISO(peakDateStr) : null;
  };

  const peakDate = getPeakDate();

    return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Card className="p-0">
        <CardContent className="p-0 space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900">Bay Alert Distribution</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Selector - TimeFilterButtons Style with Quick Filters */}
          <div className="flex items-center gap-1">
            {/* Quick Filter Buttons */}
            <button
              onClick={() => handleQuickFilter('15d')}
              className={`px-2 py-1 text-sm font-medium rounded-lg transition-all ${
                selectedQuickFilter === '15d'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 border border-gray-300'
              }`}
              title="Last 15 Days"
            >
              15D
            </button>
            <button
              onClick={() => handleQuickFilter('1m')}
              className={`px-2 py-1 text-sm font-medium rounded-lg transition-all ${
                selectedQuickFilter === '1m'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 border border-gray-300'
              }`}
              title="Last 1 Month"
            >
              1M
            </button>
            <button
              onClick={() => handleQuickFilter('3m')}
              className={`px-2 py-1 text-sm font-medium rounded-lg transition-all ${
                selectedQuickFilter === '3m'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 border border-gray-300'
              }`}
              title="Last 3 Months"
            >
              3M
            </button>
            {/* Custom Date Range Picker */}
            <div className="relative" ref={dateRangePickerRef}>
              <button
                onClick={() => {
                  setShowDatePicker(!showDatePicker);
                  setSelectedQuickFilter(null);
                }}
                className={`px-2 py-1 text-sm font-medium rounded-lg transition-all ${
                  isCustomDateSelected
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                    : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 border border-gray-300'
                }`}
                title="Select Date Range"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>

            {showDatePicker && (
              <div className="absolute top-12 right-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-96">
                <div className="flex justify-between mb-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">From</label>
          <input
            type="date"
                      value={startDate}
                      onChange={handleStartDateChange}
                      className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">To</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end space-x-2">
          <button
                    onClick={() => {
                      setShowDatePicker(false);
                      setIsCustomDateSelected(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
          </button>
                  <button
                    onClick={handleDateSubmit}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-md hover:from-blue-600 hover:to-purple-600"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
            </div>
            {/* Refresh Button */}
            <button
              onClick={() => setRefreshTrigger((p) => p + 1)}
              disabled={isLoading || isLoadingLocationWise}
              className="p-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(isLoading || isLoadingLocationWise) ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Alert summary cards - Bay Alert Distribution design */}
      <div className="border-b border-gray-200 bg-[#F8FAFC] px-2 py-2 space-y-2">
        {/* Top row: alert type cards */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            {
              title: 'LOCAL LOADING',
              subtitle: 'Across all Terminals',
              icon: Truck,
              iconBg: 'bg-indigo-100',
              titleColor: 'text-slate-700',
              firstKey: 'LocalLoading' as const,
              firstLabel: 'Count',
              secondKey: 'LocalLoading_qty' as const,
              secondLabel: 'Qty',
              secondKeepSpace: false,
            },
            {
              title: 'OVERLOADING',
              subtitle: 'Across all Terminals',
              icon: AlertTriangle,
              iconBg: 'bg-amber-100',
              titleColor: 'text-amber-600',
              firstKey: 'OverLoading' as const,
              firstLabel: 'Count',
              secondKey: 'OverLoading_qty' as const,
              secondLabel: 'Qty',
              secondKeepSpace: false,
            },
            {
              title: 'MFM VS BCU',
              subtitle: 'Across all Terminals',
              icon: ArrowLeftRight,
              iconBg: 'bg-slate-100',
              titleColor: 'text-slate-700',
              firstKey: 'MFM_VS_BCU' as const,
              firstLabel: 'Count',
              secondKey: 'MFM_VS_BCU_difference' as const,
              secondLabel: 'Difference',
              secondKeepSpace: false,
            },
            {
              title: 'BCU VS INVOICE',
              subtitle: 'Across all Terminals',
              icon: FileText,
              iconBg: 'bg-slate-100',
              titleColor: 'text-slate-700',
              firstKey: 'BCU_VS_INVOICE' as const,
              firstLabel: 'Count',
              secondKey: 'BCU_VS_INVOICE_difference' as const,
              secondLabel: 'Difference',
              secondKeepSpace: false,
            },
            {
              title: 'UNAUTHORISED FLOW',
              subtitle: 'Across all Terminals',
              icon: ShieldAlert,
              iconBg: 'bg-red-50',
              titleColor: 'text-slate-700',
              firstKey: 'UnauthorisedFlow' as const,
              firstLabel: 'Count',
              secondKey: 'UnauthorisedFlow_net_totalizer' as const,
              secondLabel: 'Net Totalizer',
              secondKeepSpace: false,
            },
          ].map(({ title, subtitle, icon: Icon, iconBg, titleColor, firstKey, firstLabel, secondKey, secondLabel, secondKeepSpace }) => {
          const displayCounts = locationWiseTotalCounts ?? counts;
            const firstValue =
              displayCounts?.[firstKey] != null ? Number(displayCounts[firstKey]) : null;
            const secondValue =
              displayCounts?.[secondKey] != null ? Number(displayCounts[secondKey]) : null;
            const formatVal = (v: number | null) => (v == null ? '-' : v.toLocaleString());
            const secondDisplay = secondKeepSpace ? '\u00A0' : formatVal(secondValue);
          return (
              <div
                key={title}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-[120px] min-w-0"
              >
                <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold uppercase tracking-wider ${titleColor} truncate`}>{title}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{subtitle}</div>
              </div>
                  <div className={`${iconBg} rounded-lg p-2 flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-slate-600" />
                </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-auto min-w-0">
                  <div className="min-w-0 overflow-hidden">
                    <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">{firstLabel}</div>
              {isLoadingLocationWise ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-500 mt-0.5" />
                    ) : (
                      <div className="text-xl font-bold text-slate-900 truncate">{formatVal(firstValue)}</div>
                    )}
                </div>
                  <div className="min-w-0 overflow-hidden">
                    <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">{secondLabel}</div>
                    {isLoadingLocationWise ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-500 mt-0.5" />
                    ) : (
                      <div className="text-xl font-bold text-slate-900 truncate">{secondDisplay}</div>
                    )}
                  </div>
                </div>
              </div>
          );
        })}
        </div> */}

        {/* Bottom row: Total Bays | Active card + Search + Download, Total Violated Trucks card */}
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2 flex items-center gap-4 min-w-[200px] h-14">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total bays</div>
              {isLoadingLocationWise ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 mt-0.5" />
              ) : (
                <div className="text-base font-bold text-slate-900 leading-tight">
                  {(locationWiseTotalCounts ?? counts)?.TotalBCU != null
                    ? Number((locationWiseTotalCounts ?? counts)!.TotalBCU).toLocaleString()
                    : '-'}
                </div>
              )}
            </div>
            <div className="h-6 w-px bg-gray-200" />
            <div>
              <div className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Active</div>
              {isLoadingLocationWise ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 mt-0.5" />
              ) : (
                <div className="text-base font-bold text-slate-900 leading-tight">
                  {(locationWiseTotalCounts ?? counts)?.TotalActiveBays != null
                    ? Number((locationWiseTotalCounts ?? counts)!.TotalActiveBays).toLocaleString()
                    : '-'}
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2 flex items-center min-w-[140px] h-14">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Violated Trucks</div>
              {isLoadingLocationWise ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 mt-0.5" />
              ) : (
                <div className="text-base font-bold text-slate-900 leading-tight">
                  {(locationWiseTotalCounts ?? counts)?.TotalUniqueTruckNumbersCount != null
                    ? Number((locationWiseTotalCounts ?? counts)!.TotalUniqueTruckNumbersCount).toLocaleString()
                    : '-'}
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-2 flex items-center gap-2 min-w-[200px] flex-1 h-14">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={bayAlertTableIndex === 1 ? 'Search bays...' : 'Search by location'}
                value={bayAlertTableIndex === 1 ? searchQuery : locationTableSearchQuery}
                onChange={(e) =>
                  bayAlertTableIndex === 1 ? setSearchQuery(e.target.value) : setLocationTableSearchQuery(e.target.value)
                }
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              />
            </div>
            <button
              type="button"
              onClick={bayAlertTableIndex === 0 ? downloadLocationTableExcel : downloadDateWiseTableExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Search and Legend Section - only for second table (date-wise view) */}
      {bayAlertTableIndex === 1 && (
        <div className="border-b border-gray-200 px-2 py-1.5">
          {(() => {
            const legendItems = Array.from(
              Object.values(CATEGORY_MAPPING).reduce((acc, cat) => {
                if (!acc.has(cat.id)) acc.set(cat.id, cat);
                return acc;
              }, new Map<string, { id: string; name: string; color: string }>()).values()
            );
            const renderLegendItem = (cat: { id: string; name: string; color: string }) => (
              <div key={cat.id} className="flex items-center gap-1 flex-shrink-0" title={cat.name}>
                <div className="w-2 h-2 rounded-full flex-shrink-0 self-center" style={{ backgroundColor: cat.color }} />
                <span className="text-[11px] text-gray-600 leading-tight whitespace-nowrap">{cat.name}</span>
              </div>
            );
            return (
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0 flex-1">
                  {legendItems.map((cat) => renderLegendItem(cat))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowColoredBalls((prev) => !prev)}
                  className={`p-1 rounded border transition-colors flex-shrink-0 ${
                        showColoredBalls
                          ? 'bg-blue-100 border-blue-300 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                      title={showColoredBalls ? 'Showing colored indicators. Click to show plain numbers.' : 'Showing plain numbers. Click to show colored indicators.'}
                    >
                  {showColoredBalls ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
            );
          })()}
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-180px)]">
        {showChart ? (
          <>
        {/* Table-style Sidebar */}
            <div className="w-80 flex-shrink-0 bg-white border-gray-200 border-r flex flex-col">
          {/* Table Header */}
          <div className="bg-gray-50 border-gray-200 border-b">
            <div className="grid grid-cols-[auto_1fr_auto] gap-2 px-2 py-2 items-center">
              <div className="w-4"></div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">BAY NAME / CATEGORY</h2>
              <span className="text-[11px] font-semibold text-gray-600 text-center"></span>
            </div>
          </div>

          {/* Table Content - Scrollable */}
          <div className="flex-1 overflow-y-auto" ref={sidebarScrollRef}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Loading...</p>
                </div>
              </div>
            ) : (
            <div>
              {bays.map((bay) => (
                <div key={bay.id}>
                  {/* Bay Row */}
                  <div
                    className={`h-12 grid grid-cols-[auto_1fr_auto] gap-2 items-center border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer px-3`}
                    style={{ minHeight: '48px', height: '48px' }}
                  >
                    <button
                      onClick={() => toggleBay(bay.id)}
                      className="w-4 h-4 flex items-center justify-center p-0"
                    >
                      {bay.expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </button>
                    
                    {/* Bay Name */}
                    <span className="text-xs font-medium text-gray-900 truncate">
                      {bay.name}
                    </span>
                    
                    {/* Count */}
                    <span className="text-sm font-medium text-gray-700 text-right">
                      {getBayTotalAlertCount(bay.id)}
                      </span>
                  </div>

                  {/* Category Rows - Only show when expanded */}
                  {bay.expanded && bay.categories.map((category) => (
                    <div
                      key={category.id}
                      className={`h-12 grid grid-cols-[auto_1fr_auto] gap-2 items-center border-b border-gray-200 hover:bg-gray-50 transition-colors px-3 pl-8`}
                      style={{ minHeight: '48px', height: '48px' }}
                    >
                      {/* Empty space for alignment */}
                      <div className="w-4"></div>
                      
                      {/* Category Name */}
                      <div className="flex items-center gap-2" title={category.name}>
                        <span className="text-xs text-gray-700 truncate">
                          {category.name}
                        </span>
                      </div>
                      
                      {/* Count */}
                      <span className="text-xs font-medium text-gray-700 text-right">
                        {getCategoryAlertCount(bay.id, category.id)}
                        </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div 
            className="flex-1 overflow-y-auto overflow-x-auto relative bg-white" 
            ref={chartContainerRef}
          >
            {/* Timeline Header - Sticky with horizontal scroll */}
            <div 
              className="sticky top-0 z-30 bg-white border-gray-200 border-b shadow-sm" 
              style={{ minWidth: 'max-content' }}
              onMouseMove={(e) => {
                if (!chartContainerRef.current) return;
                
                const container = chartContainerRef.current;
                const rect = container.getBoundingClientRect();
                const headerRect = e.currentTarget.getBoundingClientRect();
                
                // Calculate position relative to the container, accounting for scroll
                const x = e.clientX - rect.left + container.scrollLeft;
                
                // Store mouse Y position for tooltip (relative to header)
                setMouseY(e.clientY - headerRect.top);
                setIsHoveringHeader(true);
                
                // Find which date column the cursor is over
                // Each day is 40px wide, starting from the left
                const dayWidth = 40;
                let totalWidth = 0;
                let foundDate: Date | null = null;
                let columnCenterX = 0;
                
                for (const range of weekRanges) {
                  for (const day of range.days) {
                    if (x >= totalWidth && x < totalWidth + dayWidth) {
                      foundDate = day;
                      // Calculate the center of this date column
                      // totalWidth is the left edge in scroll coordinates
                      // Convert to viewport coordinates by subtracting scrollLeft
                      columnCenterX = (totalWidth + (dayWidth / 2)) - container.scrollLeft;
                      break;
                    }
                    totalWidth += dayWidth;
                  }
                  if (foundDate) break;
                }
                
                if (foundDate) {
                  setHoveredDate(foundDate);
                  // Position line at the center of the date column (relative to container viewport)
                  // Ensure it's within visible bounds
                  const visibleX = Math.max(0, Math.min(columnCenterX, rect.width));
                  setCursorPosition(visibleX);
                } else {
                  setHoveredDate(null);
                  setCursorPosition(null);
                }
              }}
              onMouseLeave={() => {
                setHoveredDate(null);
                setCursorPosition(null);
                setMouseY(0);
                setIsHoveringHeader(false);
              }}
            >
              {/* Tooltip - Only show when hovering over header */}
              {isHoveringHeader && cursorPosition !== null && hoveredDate && (
                <div
                  className="absolute text-xs px-3 py-1.5 rounded-md shadow-lg pointer-events-none font-medium"
                  style={{
                    left: `${cursorPosition}px`,
                    top: '50%',
                    transform: 'translateX(-50%) translateY(-50%)',
                    whiteSpace: 'nowrap',
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    border: '1px solid #d1d5db',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    zIndex: 9999
                  }}
                >
                  {format(hoveredDate, 'MMM dd, yyyy')}
                </div>
              )}
              {/* Week headers */}
              <div className="flex" style={{ minWidth: 'max-content' }}>
                {weekRanges.map((range, rangeIndex) => (
                  <div
                    key={rangeIndex}
                    className="text-center px-2 py-2 border-r"
                    style={{
                      minWidth: `${range.days.length * 40}px`,
                      backgroundColor: isSelectedWeek(range)
                        ? 'rgb(219 234 254)'
                        : 'rgb(249 250 251)',
                      color: isSelectedWeek(range)
                        ? 'rgb(29 78 216)'
                        : 'rgb(55 65 81)',
                      borderColor: 'rgb(229 231 235)'
                    }}
                  >
                    <div className="text-xs font-semibold">
                      {format(range.start, 'MMM dd, yyyy')}
                    </div>
                  </div>
                ))}
              </div>
              {/* Day labels */}
              <div className="flex border-t border-gray-200" style={{ minWidth: 'max-content' }}>
                {weekRanges.map((range, rangeIndex) => (
                  <div key={rangeIndex} className="flex border-r border-gray-200" style={{ minWidth: `${range.days.length * 40}px` }}>
                    {range.days.map((day, dayIndex) => {
                      const dayLetter = format(day, 'EEE').charAt(0);
                      const isToday = isCurrentDay(day);
                      const isSelected = isSelectedDate(day);
                      return (
                        <div
                          key={dayIndex}
                          className="text-center text-xs py-1 border-r"
                          style={{
                            width: '40px',
                            minWidth: '40px',
                            backgroundColor: isSelected
                              ? 'rgb(219 234 254)'
                              : isToday
                              ? 'rgb(239 246 255)'
                              : 'transparent',
                            color: isSelected
                              ? 'rgb(29 78 216)'
                              : isToday
                              ? 'rgb(37 99 235)'
                              : 'rgb(107 114 128)',
                            borderColor: 'rgb(229 231 235)',
                            fontWeight: (isSelected || isToday) ? 'bold' : 'normal'
                          }}
                        >
                          {dayLetter}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Cursor line - Full height, positioned at the center of the date column */}
            {cursorPosition !== null && hoveredDate && (
              <div
                className="absolute top-0 w-0.5 pointer-events-none z-20"
                style={{
                  left: `${cursorPosition}px`,
                  transform: 'translateX(-50%)',
                  height: '100%',
                  backgroundColor: 'rgba(96, 165, 250, 0.5)',
                  boxShadow: '0 0 4px rgba(96, 165, 250, 0.35)'
                }}
              />
            )}

            {/* Chart Rows - Aligned with Sidebar */}
            {isLoading ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Loading chart data...</p>
                </div>
              </div>
            ) : (
            <div style={{ minWidth: 'max-content' }}>
              {bays.flatMap((bay) => {
                // Always show the bay row first (aggregated counts)
                const bayRow = (
                  <div
                    key={bay.id}
                    className="h-12 flex items-center border-b border-gray-200"
                    style={{ minHeight: '48px', height: '48px' }}
                      >
                        {/* Timeline Row */}
                    <div className="flex-1 relative h-full flex items-center justify-start">
                      <div className="flex h-full w-full">
                            {weekRanges.map((range, rangeIndex) => (
                          <div key={rangeIndex} className="flex relative border-r border-gray-200" style={{ minWidth: `${range.days.length * 40}px` }}>
                                {range.days.map((day, dayIndex) => {
                              // Aggregate all categories for bay row
                              const allAlerts = bay.categories.flatMap(cat =>
                                getAlertsForDate(day, bay.id, cat.id)
                              );
                              const totalCount = allAlerts.reduce((sum, alert) => sum + (alert.count || 1), 0);
                                  const isToday = isCurrentDay(day);
                              const isSelected = isSelectedDate(day);
                              const uniqueCategories = Array.from(new Set(allAlerts.map(a => a.categoryId)));
                              // Attach ref to today's date by default, or selected date if different
                              const shouldAttachRef = isSelected || (isToday && !isSelectedDate(new Date()));
                                  return (
                                    <div
                                      key={dayIndex}
                                  ref={shouldAttachRef ? selectedDateRef : null}
                                  className="relative border-r h-full flex items-center justify-center"
                                  style={{
                                    width: '40px',
                                    minWidth: '40px',
                                    borderColor: 'rgb(229 231 235)'
                                  }}
                                >
                                  {totalCount > 0 && (
                                    <div className="flex items-center justify-center w-full h-full relative z-10">
                                      {(() => {
                                        // Use a distinct color for bay aggregated/total row (not Local Loading blue)
                                        const categoryColor = '#14b8a6';
                                        const categoryNames = uniqueCategories.map(catId => {
                                          const cat = bay.categories.find(c => c.id === catId);
                                          return cat?.name || 'Alert';
                                        }).join(', ');
                                        
                                        return (
                                          <div
                                            className="shadow-sm border-2 border-white flex items-center justify-center min-w-[20px] h-5 px-1.5 relative z-10 cursor-pointer hover:opacity-80 transition-opacity"
                                            style={{ 
                                              backgroundColor: categoryColor,
                                              transform: 'rotate(45deg)',
                                              width: '24px',
                                              height: '24px'
                                            }}
                                            title={`${bay.name} - ${categoryNames} - ${format(day, 'MMM dd, yyyy')}: ${totalCount} alert(s)`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              const bayData = findBayDataForDate(day, bay.id);
                                              if (bayData) {
                                                setSelectedRowData(bayData);
                                                setShowRowDetailsPopup(true);
                                              }
                                            }}
                                          >
                                            <span className="text-[10px] font-bold text-white leading-none" style={{ transform: 'rotate(-45deg)' }}>{totalCount}</span>
                                        </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                  {isSelected && (
                                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-blue-400 transform -translate-x-1/2 z-0" />
                                  )}
                                  {isToday && !isSelected && (
                                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-400 transform -translate-x-1/2 z-0" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );

                // If expanded, also show category rows
                if (bay.expanded) {
                  const categoryRows = bay.categories.map((category) => {
                  return (
                    <div
                        key={`${bay.id}-${category.id}`}
                        className="h-12 flex items-center border-b border-gray-200"
                        style={{ minHeight: '48px', height: '48px' }}
                    >
                      {/* Timeline Row */}
                        <div className="flex-1 relative h-full flex items-center justify-start">
                          <div className="flex h-full w-full">
                          {weekRanges.map((range, rangeIndex) => (
                              <div key={rangeIndex} className="flex relative border-r border-gray-200" style={{ minWidth: `${range.days.length * 40}px` }}>
                              {range.days.map((day, dayIndex) => {
                                  const alerts = getAlertsForDate(day, bay.id, category.id);
                                  const totalCount = getTotalAlertCountForDate(day, bay.id, category.id);
                                const isToday = isCurrentDay(day);
                                  const isSelected = isSelectedDate(day);
                                  // Attach ref to today's date by default, or selected date if different
                                  const shouldAttachRef = isSelected || (isToday && !isSelectedDate(new Date()));
                                return (
                                  <div
                                    key={dayIndex}
                                      ref={shouldAttachRef ? selectedDateRef : null}
                                      className="relative border-r h-full flex items-center justify-center"
                                      style={{
                                        width: '40px',
                                        minWidth: '40px',
                                        borderColor: 'rgb(229 231 235)'
                                      }}
                                    >
                                      {totalCount > 0 && (
                                        <div className="flex items-center justify-center w-full h-full relative z-10">
                                          <div
                                            className="shadow-sm border-2 border-white flex items-center justify-center min-w-[20px] h-5 px-1.5 relative z-10 cursor-pointer hover:opacity-80 transition-opacity"
                                            style={{ 
                                              backgroundColor: category.color,
                                              transform: 'rotate(45deg)',
                                              width: '24px',
                                              height: '24px'
                                            }}
                                            title={`${category.name} - ${format(day, 'MMM dd, yyyy')}: ${totalCount} alert(s)`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              const bayData = findBayDataForDate(day, bay.id);
                                              if (bayData) {
                                                setSelectedRowData(bayData);
                                                setShowRowDetailsPopup(true);
                                              }
                                            }}
                                          >
                                            <span className="text-[10px] font-bold text-white leading-none" style={{ transform: 'rotate(-45deg)' }}>{totalCount}</span>
                                        </div>
                                        </div>
                                      )}
                                      {isSelected && (
                                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-blue-400 transform -translate-x-1/2 z-0" />
                                      )}
                                      {isToday && !isSelected && (
                                      <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-400 transform -translate-x-1/2 z-0" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                  });
                  
                  // Return bay row + category rows as array (flatMap will flatten it)
                  return [bayRow, ...categoryRows];
                } else {
                  // Only show bay row when collapsed
                  return [bayRow];
                }
              })}
            </div>
            )}
          </div>
        </div>
          </>
        ) : (
          /* Table View - Bay Alert Distribution Model */
          <>
            <div className="flex-1 flex flex-col overflow-hidden bg-white min-h-0">
              <div className="flex flex-col p-0 overflow-hidden h-full">
                <div className="bg-white rounded-lg border border-gray-200 flex flex-col h-full overflow-hidden">
                  {/* Bar when on location table: Severity + i only when a row is expanded; hint always shown */}
                    {bayAlertTableIndex === 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-4 px-3 py-2 border-b border-gray-200 bg-slate-50/80 text-xs">
                        <div className="flex flex-wrap items-center gap-4">
                          {expandedLocationIds.size > 0 && (
                            <>
                          <span className="font-semibold text-slate-600">Severity:</span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
                            <span className="text-slate-600">Low</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" aria-hidden />
                            <span className="text-slate-600">Medium</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
                            <span className="text-slate-600">High</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-600 text-[10px] font-bold text-red-700">0</span>
                            <span className="text-slate-600">Critical</span>
                          </span>
                          <Popover>
                            <PopoverTrigger asChild>
                        <button
                          type="button"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                                aria-label="Severity rules"
                        >
                                <Info className="h-4 w-4" />
                        </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-3 text-left" align="start">
                              <div className="space-y-2.5 text-[11px]">
                                <p className="font-semibold text-slate-800 border-b border-slate-200 pb-1">How severity is decided</p>
                                <div>
                                  <p className="font-medium text-slate-700 mb-1 leading-tight">Host Bay Reassignment, Local Loading & Overloading</p>
                                  <div className="space-y-0.5">
                                    <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                                      <span className="text-slate-600">Count &gt; 20</span>
                                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-red-100 text-red-700 shrink-0">Critical</span>
                          </div>
                                    <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                                      <span className="text-slate-600">10 – 20</span>
                                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-orange-100 text-orange-700 shrink-0">High</span>
                          </div>
                                    <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                                      <span className="text-slate-600">1 – 9</span>
                                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-amber-100 text-amber-700 shrink-0">Medium</span>
                          </div>
                                    <div className="flex items-center justify-between gap-2 py-0.5">
                                      <span className="text-slate-600">0</span>
                                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-700 shrink-0">Low</span>
                        </div>
                      </div>
                    </div>
                                <div>
                                  <p className="font-medium text-slate-700 mb-1 leading-tight">Alerts Count</p>
                                  <div className="space-y-0.5">
                                    <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                                      <span className="text-slate-600">Count &gt; 120</span>
                                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-red-100 text-red-700 shrink-0">Critical</span>
                          </div>
                                    <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                                      <span className="text-slate-600">70 – 120</span>
                                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-orange-100 text-orange-700 shrink-0">High</span>
                        </div>
                                    <div className="flex items-center justify-between gap-2 py-0.5">
                                      <span className="text-slate-600">30 – 69</span>
                                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-amber-100 text-amber-700 shrink-0">Medium</span>
                          </div>
                        </div>
                          </div>
                                <p className="pt-2 mt-2 border-t border-slate-200 text-slate-600 italic leading-snug">
                                  This formula is applied for a one-month period and will change according to the selected date range.
                                </p>
                        </div>
                            </PopoverContent>
                          </Popover>
                            </>
                          )}
                                  </div>
                        <span className="text-slate-500 italic shrink-0">Click a count to view the detail table.</span>
                        </div>
                    )}
                  {/* Table Container - Full height with scroll, but shrinks if content is less */}
                  <div className="flex-1 overflow-auto min-h-0">
                    {bayAlertTableIndex === 0 && (
                      <BayAlertLocationWiseTable
                        data={filteredLocationWiseData}
                        isLoading={isLoadingLocationWise}
                        error={locationWiseError}
                        expandedIds={expandedLocationIds}
                        onToggleExpand={toggleLocationExpanded}
                        onNavigateToDateWise={(locationName, field, bay) => {
                          setLocationNameFromFirstTable(locationName);
                          setSelectedFieldFromFirstTable(field);
                          setSelectedBayFromFirstTable(bay);
                          setBayAlertTableIndex(1);
                        }}
                      />
                    )}
                    {bayAlertTableIndex === 1 && (
                      <BayAlertDateWiseTable
                        locationName={locationNameFromFirstTable}
                        selectedBay={selectedBayFromFirstTable}
                        selectedField={selectedFieldFromFirstTable}
                        onBack={() => {
                          setBayAlertTableIndex(0);
                                    setSelectedFieldFromFirstTable(null);
                                    setSelectedBayFromFirstTable(null);
                        }}
                        dateRangeLabel={appliedStartDate && appliedEndDate
                          ? `${format(parseISO(appliedStartDate), 'MMM dd, yyyy')} – ${format(parseISO(appliedEndDate), 'MMM dd, yyyy')}`
                          : undefined}
                        bays={sortedBays}
                        weekRanges={weekRanges}
                        allDays={allDays}
                        isLoading={isLoading}
                        tableSortBy={tableSortBy}
                        tableSortDir={tableSortDir}
                        onSort={handleTableSort}
                        getBayTotalAlertCount={getBayTotalAlertCount}
                        getCategoryAlertCount={getCategoryAlertCount}
                        getDayAlertCount={getDayAlertCount}
                        getTrendData={getTrendData}
                        getMaxTrendValue={getMaxTrendValue}
                        findBayDataForDate={findBayDataForDate}
                        getAggregatedBayDataForTotal={getAggregatedBayDataForTotal}
                        showColoredBalls={showColoredBalls}
                        onToggleBay={toggleBay}
                        onCellClick={(data) => {
                          setSelectedRowData(data as { dateEntry: NewJsonStructure; bayData: NewBayData });
                                                setShowRowDetailsPopup(true);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Data Interpretation Guide and Weekly Intensity Map - commented to match other screens layout */}
            {/* <div className="px-4 pb-4 pt-4 grid grid-cols-2 gap-6 flex-shrink-0 bg-white">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Interpretation Guide</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-gray-900 mb-1">Standard Alerts</div>
                      <div className="text-xs text-gray-600">
                        Regular system notifications that require standard processing time within the current shift.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-gray-900 mb-1">Reassignment Tasks</div>
                      <div className="text-xs text-gray-600">
                        High-priority logistical re-routing required to balance dock capacity.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-gray-900 mb-1">Critical Overloading</div>
                      <div className="text-xs text-gray-600">
                        Safety or capacity breach detected. Requires immediate supervisor intervention.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Weekly Intensity Map</h3>
                <div className="space-y-3">
                  <div className="relative h-4 bg-gradient-to-r from-green-200 via-yellow-200 to-red-500 rounded-full overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-[10px] font-medium text-gray-700">Low Volume → Peak Volume</div>
                    </div>
                  </div>
                  {peakDate && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                      <p className="text-xs text-yellow-800">
                        <span className="font-semibold">Expected peak on {format(peakDate, 'MMM dd')}</span> based on historical trends. Ensure adequate staffing.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div> */}
          </>
        )}
      </div>

      {/* Side Slide Popup for Row Details */}
      {showRowDetailsPopup && selectedRowData && (
        <>
          <style>{`
            .tas-details-sheet,
            .tas-details-sheet:hover {
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
            .tas-details-sheet::-webkit-scrollbar,
            .tas-details-sheet:hover::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
            }
            .tas-details-sheet .sheet-table-scroll,
            .tas-details-sheet .sheet-table-scroll:hover {
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
            .tas-details-sheet .sheet-table-scroll::-webkit-scrollbar,
            .tas-details-sheet .sheet-table-scroll:hover::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
            }
          `}</style>
          {/* Backdrop - full screen with blur, covers sidebar and content */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-opacity"
            onClick={() => { setShowRowDetailsPopup(false); setShowTotalCountBreakdown(false); }}
            aria-hidden="true"
          />
          {/* Slide Panel */}
          <div className="tas-details-sheet fixed right-0 top-0 h-full w-[1300px] max-w-[95vw] bg-white shadow-2xl z-[101] overflow-y-auto rounded-l-xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-3 py-2 z-[60] shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-slate-900 truncate">
                    Row Details
                    {locationNameFromFirstTable && (
                      <span className="text-slate-600 font-medium ml-1.5 text-sm">— {locationNameFromFirstTable}</span>
                    )}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="text-xs font-medium">
                        {selectedRowData.dateEntry.date.startsWith('Total')
                          ? (appliedStartDate && appliedEndDate
                              ? `${format(parseISO(appliedStartDate), 'MMM dd, yyyy')} - ${format(parseISO(appliedEndDate), 'MMM dd, yyyy')}`
                              : selectedRowData.dateEntry.date)
                          : format(parseISO(selectedRowData.dateEntry.date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                      <LayoutGrid className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="text-xs font-medium">
                        Bay {String(selectedRowData.bayData.bay_number).padStart(2, '0')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTotalCountBreakdown((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
                    >
                      <Hash className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="text-xs font-medium">Total Count: {selectedRowData.bayData.total_count || 0}</span>
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setShowRowDetailsPopup(false); setShowTotalCountBreakdown(false); }}
                  className="p-1.5 hover:bg-slate-100 rounded-md transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Total count breakdown (when total count is clicked) */}
            {showTotalCountBreakdown && selectedRowData && (
              <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-1.5">
                <h3 className="text-[10px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Total count breakdown</h3>
                <div className="text-[11px] text-slate-600 mb-1.5 space-y-0.5">
                  {selectedRowData.dateEntry.date.startsWith('Total') && appliedStartDate && appliedEndDate && (
                    <p>
                      <span className="font-medium text-gray-500">Date range:</span>{' '}
                      {format(parseISO(appliedStartDate), 'MMM dd, yyyy')} – {format(parseISO(appliedEndDate), 'MMM dd, yyyy')}
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-gray-500">Bay Number:</span> Bay {String(selectedRowData.bayData.bay_number).padStart(2, '0')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="min-w-full text-[11px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100 border-b border-slate-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        <th className="px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider bg-slate-100">Category</th>
                        <th className="px-2 py-1 text-center font-semibold text-slate-700 uppercase tracking-wider w-14 bg-slate-100">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {TOTAL_COUNT_BREAKDOWN_KEYS.map((key) => {
                        const categoryInfo = getCategoryInfo(key);
                        if (key === 'Bay_Alerts_Count') return null;
                        const value = key === 'Alerts_Count'
                          ? (selectedRowData.bayData['Alerts_Count'] ?? 0) + (selectedRowData.bayData['Bay_Alerts_Count'] ?? 0)
                          : (typeof selectedRowData.bayData[key] === 'number' ? selectedRowData.bayData[key] as number : 0);
                        return (
                          <tr key={key} className="hover:bg-slate-50/80">
                            <td className="px-2 py-1 text-slate-900">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryInfo.color }} />
                                {categoryInfo.name}
                              </div>
                            </td>
                            <td className="px-2 py-1 text-center font-medium text-slate-900">{value}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="p-2">
              {/* Category Breakdown - horizontal pills */}
              <div className="mb-2">
                <h3 className="text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Category Breakdown</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(selectedRowData.bayData)
                    .filter(key => key !== 'bay_number' && key !== 'total_count' && !key.endsWith('_details'))
                    .map((categoryKey) => {
                      const categoryInfo = getCategoryInfo(categoryKey);
                      const categoryValue = typeof selectedRowData.bayData[categoryKey] === 'number'
                        ? selectedRowData.bayData[categoryKey]
                        : 0;
                      const hasCount = categoryValue > 0;
                      const scrollToCategoryTable = () => {
                        const sectionId = `detail-section-${categoryKey}`;
                        const altSectionId = `detail-section-${categoryKey.replace(/_count$/, '')}`;
                        const el = document.getElementById(sectionId) ?? document.getElementById(altSectionId);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      };
                      return (
                        <button
                          key={categoryKey}
                          type="button"
                          onClick={scrollToCategoryTable}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] text-left transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 ${
                            hasCount ? 'border-opacity-80 hover:opacity-90' : 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                          }`}
                          style={hasCount ? {
                            backgroundColor: `${categoryInfo.color}18`,
                            borderColor: `${categoryInfo.color}99`,
                          } : undefined}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryInfo.color }} />
                          <span className={hasCount ? 'text-slate-900 font-medium' : ''}>{categoryInfo.name}</span>
                          <span className={hasCount ? 'text-slate-700 font-medium' : ''}>{categoryValue}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* All dates detail - when viewing Total (all dates) */}
              {selectedRowData.dateEntry.date.startsWith('Total') && rawApiData.length > 0 && (() => {
                const bayNumStr = String(selectedRowData.bayData.bay_number).padStart(2, '0');
                const categoryKeys = Object.keys(selectedRowData.bayData).filter(
                  k => k !== 'bay_number' && k !== 'total_count' && !k.endsWith('_details')
                );
                const dateRows = rawApiData.map(entry => {
                  const bayData = entry.bays.find(b => String(b.bay_number).padStart(2, '0') === bayNumStr);
                  if (!bayData) return null;
                  return { date: entry.date, bayData };
                }).filter((x): x is { date: string; bayData: NewBayData } => x != null);
                if (dateRows.length === 0) return null;
                return (
                  <div className="mb-2">
                    <h3 className="text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                      {appliedStartDate && appliedEndDate
                        ? `Detail by date (${format(parseISO(appliedStartDate), 'MMM dd, yyyy')} – ${format(parseISO(appliedEndDate), 'MMM dd, yyyy')})`
                        : 'All dates detail'}
                    </h3>
                    <div className="rounded-lg border border-slate-200 overflow-hidden overflow-x-auto overflow-y-auto bg-white max-h-64">
                      <table className="min-w-full text-[11px]">
                        <thead className="sticky top-0 z-20">
                          <tr className="bg-slate-100 border-b border-slate-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                            <th className="sticky left-0 z-30 px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap bg-slate-100 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">Date</th>
                            <th className="px-2 py-1 text-center font-semibold text-slate-700 uppercase tracking-wider w-12 bg-slate-100">Total</th>
                            {categoryKeys.map(key => {
                              const info = getCategoryInfo(key);
                              return (
                                <th key={key} className="px-2 py-1 text-center font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap bg-slate-100">
                                  {info.name}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dateRows.map(({ date, bayData }) => (
                            <tr key={date} className="group hover:bg-slate-50/80">
                              <td className="sticky left-0 z-[5] px-2 py-1 text-slate-900 whitespace-nowrap bg-white group-hover:bg-slate-50/80 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">{format(parseISO(date), 'MMM dd, yyyy')}</td>
                              <td className="px-2 py-1 text-center font-medium text-slate-900">{bayData.total_count ?? 0}</td>
                              {categoryKeys.map(key => (
                                <td key={key} className="px-2 py-1 text-center text-slate-700">
                                  {typeof (bayData as any)[key] === 'number' ? (bayData as any)[key] : '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Detailed Information Table */}
              {Object.keys(selectedRowData.bayData).filter(key => key.endsWith('_details')).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Detailed Information</h3>
                    <button
                      type="button"
                      onClick={handleExportPopupCSV}
                      className="text-[11px] px-2 py-1 border border-slate-200 rounded bg-white text-slate-700 hover:bg-slate-50"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="space-y-2">
                    {Object.keys(selectedRowData.bayData)
                      .filter(key => key.endsWith('_details'))
                      .map((detailsKey) => {
                        const details = (selectedRowData.bayData as any)[detailsKey];
                        const categoryKey = detailsKey.replace('_details', '');
                        const categoryInfo = getCategoryInfo(categoryKey);

                        if (!Array.isArray(details) || details.length === 0) {
                          return null;
                        }

                        const allKeys = new Set<string>();
                        details.forEach((detail: any) => {
                          if (typeof detail === 'object' && detail !== null) {
                            Object.keys(detail).forEach(key => allKeys.add(key));
                          }
                        });

                        if (allKeys.size === 0) {
                          return null;
                        }

                        const keysArray = sortDetailKeysEventTimeFirst(
                          Array.from(allKeys).filter(
                            (k) =>
                              k !== 'Date' &&
                              k !== 'date' &&
                              k !== 'location_name' &&
                              k !== 'bay_number' &&
                              k !== 'sap_id'
                          )
                        );
                        if (keysArray.length === 0) return null;

                        return (
                          <div
                            key={detailsKey}
                            id={`detail-section-${categoryKey}`}
                            className="rounded-lg border overflow-hidden border-opacity-80 scroll-mt-20"
                            style={{
                              backgroundColor: `${categoryInfo.color}18`,
                              borderColor: `${categoryInfo.color}99`,
                            }}
                          >
                            <div className="px-2 py-1.5 border-b border-slate-200 bg-white">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: categoryInfo.color }}
                                />
                                <span className="text-[11px] font-semibold text-slate-600">{categoryInfo.name} Details</span>
                              </div>
                            </div>
                            <div className="sheet-table-scroll overflow-x-auto overflow-y-auto bg-white max-h-64 relative mt-1">
                              <table className="min-w-full text-[11px]">
                                <thead className="sticky top-0 z-20">
                                  <tr
                                    style={{
                                      backgroundColor: `color-mix(in srgb, ${categoryInfo.color} 12%, white)`,
                                      borderBottom: `1px solid ${categoryInfo.color}99`,
                                      boxShadow: '0 2px 4px -1px rgba(0,0,0,0.08)',
                                    }}
                                  >
                                    {keysArray.map((key) => (
                                      <th
                                        key={key}
                                        className="px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap sticky top-0"
                                        style={{ backgroundColor: `color-mix(in srgb, ${categoryInfo.color} 12%, white)` }}
                                      >
                                        {getDetailColumnLabel(key)}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 relative z-0">
                                  {details.map((detail: any, index: number) => (
                                    <tr key={index} className="hover:bg-slate-50/80">
                                      {keysArray.map((key) => {
                                        const val = detail[key];
                                        const isCreatedAt = key === 'created_at' || key === 'Created_At' || key === 'CreatedAt';
                                        let display: React.ReactNode = '—';
                                        if (val !== null && val !== undefined) {
                                          if (isCreatedAt && (typeof val === 'string' || typeof val === 'number')) {
                                            try {
                                              const utc = typeof val === 'number' ? new Date(val) : parseISO(val);
                                              const ist = addMinutes(addHours(utc, 5), 30);
                                              display = format(ist, 'MMM dd, yyyy, hh:mm a');
                                            } catch {
                                              display = String(val);
                                            }
                                          } else if (typeof val === 'object') {
                                            display = JSON.stringify(val);
                                          } else {
                                            display = String(val);
                                          }
                                        }
                                        return (
                                          <td key={key} className="px-2 py-1 text-slate-900 whitespace-nowrap">
                                            {display}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TASAnalytics;
