import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { AlertTriangle, CheckCircle, XCircle, Wrench, Truck, ArrowRightLeft, Loader2 } from 'lucide-react';
import ViolationPieChart from './ViolationPieChart';
import ViolationTrendsChart from './ViolationTrendsChart';
import AlertsPivotTable, { InstancePivotData } from './AlertsPivotTable';
import { apiClient } from '@/services/apiClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Button } from '@/@/components/ui/button';

interface Column {
    id: string;
    name: string;
}

interface ViolationTabContentProps {
  violationType: string;
  totalAlerts: number;
  zones: Column[];
  plants: Column[];
  selectedBu?: string;
  selectedZone?: string | null;
  selectedPlant?: string | null;
  selectedTimeFilter?: string | null;
  dateRangeFilter?: { start: Date, end: Date } | null;
  chartTimeGrain?: 'daywise' | 'monthwise';
}

const INSTANCES = ['Instance 1', 'Instance 2', 'Instance >= 3'];

// Loading Component
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="w-full h-72 flex flex-col items-center justify-center text-gray-500">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
    {/* <p className="text-xs">{message}</p> */}
  </div>
);

// No Data Component
const NoDataDisplay: React.FC<{ message?: string }> = ({ message = 'No data available' }) => (
  <div className="w-full h-72 flex flex-col items-center justify-center text-gray-500">
    {/* <AlertTriangle className="h-8 w-8 text-gray-400 mb-2" /> */}
    <p className="text-xs">{message}</p>
  </div>
);

interface AlertDetail {
  id: string;
  status: 'blocked' | 'auto_unblock' | 'manual_unblock';
  instance: 'Instance 1' | 'Instance 2' | 'Instance >= 3';
  zone: string;
  plant: string;
}

const ViolationTabContent: React.FC<ViolationTabContentProps> = ({ 
  violationType, 
  totalAlerts,
  zones,
  plants,
  selectedBu,
  selectedZone,
  selectedPlant,
  selectedTimeFilter,
  dateRangeFilter,
  chartTimeGrain
}) => {
  const [timeGrain, setTimeGrain] = useState<'daywise' | 'monthwise'>('daywise');
  const [selectionMode, setSelectionMode] = useState<'zone' | 'plant'>('zone');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [alertSummaryLoading, setAlertSummaryLoading] = useState(false);
  const [alertSummaryData, setAlertSummaryData] = useState<any>(null);
  const [alertSummaryColumns, setAlertSummaryColumns] = useState<Column[] | null>(null);
  const [alertSummaryPivot, setAlertSummaryPivot] = useState<InstancePivotData[] | null>(null);
  const idCounterRef = useRef(0);
  const blockedCount = Math.floor(totalAlerts * 0.45);
  const autoUnblockCount = Math.floor(totalAlerts * 0.3);
  const manualUnblockCount = totalAlerts - blockedCount - autoUnblockCount;

  const InstanceBreakupData = React.useMemo(() => {
    const ib = detailsData?.data?.instance_breakup || detailsData?.instance_breakup || null;
    if (ib) {
      const i1 = ib.instance_1 || { total_count: 0, percentage: 0 };
      const i2 = ib.instance_2 || { total_count: 0, percentage: 0 };
      const i3 = ib.instance_3 || { total_count: 0, percentage: 0 };
      return [
        { violation: 'Instance 1', count: Number(i1.total_count || 0), percentage: Number(i1.percentage || 0) },
        { violation: 'Instance 2', count: Number(i2.total_count || 0), percentage: Number(i2.percentage || 0) },
        { violation: 'Instance >= 3', count: Number(i3.total_count || 0), percentage: Number(i3.percentage || 0) }
      ];
    }
    // No API data -> no data for chart
    return [];
  }, [detailsData, totalAlerts]);

  const InstanceTrendsData = React.useMemo(() => {
    const period = detailsData?.data?.period_wise || detailsData?.period_wise || null;
    if (Array.isArray(period) && period.length > 0) {
      const toIsoDate = (d: string) => {
        const parts = String(d || '').split('-');
        if (parts.length === 3 && parts[0].length === 3) {
          const monMap: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
          const mm = monMap[parts[0] as keyof typeof monMap] || '01';
          const dd = parts[1].padStart(2, '0');
          const yyyy = parts[2];
          return `${yyyy}-${mm}-${dd}`;
        }
        const dt = new Date(d);
        if (!isNaN(dt.getTime())) {
          const yyyy = dt.getFullYear();
          const mm = String(dt.getMonth()+1).padStart(2, '0');
          const dd = String(dt.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
        return d;
      };

      if (timeGrain === 'monthwise') {
        const monthMap: Record<string, { Instance1: number; Instance2: number; Instance3: number }> = {};
        for (const p of period) {
          const iso = toIsoDate(String(p.date || ''));
          const dt = new Date(iso);
          const monthKey = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-01`;
          const counts = p?.value?.counts || {};
          if (!monthMap[monthKey]) monthMap[monthKey] = { Instance1: 0, Instance2: 0, Instance3: 0 };
          monthMap[monthKey].Instance1 += Number(counts.instance_1 || 0);
          monthMap[monthKey].Instance2 += Number(counts.instance_2 || 0);
          monthMap[monthKey].Instance3 += Number(counts.instance_3 || 0);
        }
        const arr = Object.entries(monthMap).map(([month, vals]) => ({ month, ...vals }));
        arr.sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
        return { daywise: [], monthwise: arr };
      }
      const arr = period.map((p: any) => ({
        date: toIsoDate(String(p.date || '')),
        Instance1: Number(p?.value?.counts?.instance_1 || 0),
        Instance2: Number(p?.value?.counts?.instance_2 || 0),
        Instance3: Number(p?.value?.counts?.instance_3 || 0)
      }));
      arr.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return { daywise: arr, monthwise: [] };
    }
    return { daywise: [], monthwise: [] };
  }, [detailsData, timeGrain]);
  
  const mockAlerts: AlertDetail[] = React.useMemo(() => {
    if (zones.length === 0 || plants.length === 0) return [];
    // Increment counter to ensure unique IDs across re-renders
    idCounterRef.current += 1;
    const baseId = `VTS-${Date.now()}-${idCounterRef.current}`;
    return Array.from({ length: totalAlerts }, (_, i) => ({
      id: `${baseId}-${i}`,
      status: i < blockedCount ? 'blocked' : (i < blockedCount + autoUnblockCount ? 'auto_unblock' : 'manual_unblock'),
      instance: INSTANCES[i % INSTANCES.length] as 'Instance 1' | 'Instance 2' | 'Instance >= 3',
      zone: zones[i % zones.length].id,
      plant: plants[i % plants.length].id,
    }))
  }, [totalAlerts, blockedCount, autoUnblockCount, zones, plants]);
  
  const pivotData = React.useMemo(() => {
    const initialCounts = () => ({ total: 0, blocked: 0, auto_unblock: 0, manual_unblock: 0 });
    const columns = selectionMode === 'zone' ? zones : plants;
    if (columns.length === 0) return [];
    
    const dataKey = selectionMode;

    const data: InstancePivotData[] = INSTANCES.map(instance => ({
        instance,
        groups: columns.reduce((acc, col) => ({ ...acc, [col.id]: initialCounts() }), {}),
        total: initialCounts()
    }));

    const dataMap = new Map(data.map(d => [d.instance, d]));

    for (const alert of mockAlerts) {
        const instanceData = dataMap.get(alert.instance);
        const groupKey = alert[dataKey];
        if (instanceData && instanceData.groups[groupKey]) {
            instanceData.groups[groupKey][alert.status]++;
            instanceData.groups[groupKey].total++;
            instanceData.total[alert.status]++;
            instanceData.total.total++;
        }
    }
    return Array.from(dataMap.values());
  }, [mockAlerts, selectionMode, zones, plants]);

  const handleToggleMode = () => {
    setSelectionMode(prev => prev === 'zone' ? 'plant' : 'zone');
  };


  // Map current tab to API key and compute top-card metrics from API when available (no dummy fallback)
  const { topTotalAlerts, topBlocked, topAutoUnblock, topManualUnblock } = React.useMemo(() => {
    const violationLabelToType: Record<string, string> = {
      'Route Deviation': 'route_deviation_count',
      'Power Disconnection': 'main_supply_removal_count',
      'Device Tampering': 'device_tamper_count',
      'Stoppage Violation': 'stoppage_violations_count',
      'Night Driving Violation': 'night_driving_count',
      'Continuous Driving Violation': 'continuous_driving_count',
      'Speed Violation': 'speed_violation_count'
    };
    const vtKey = violationLabelToType[violationType] || 'route_deviation_count';
    const rec = detailsData?.data?.[vtKey]?.[0];
    if (rec) {
      return {
        topTotalAlerts: Number(rec?.total_alerts ?? 0),
        topBlocked: Number(rec?.Blocked ?? 0),
        topAutoUnblock: Number(rec?.['Auto Unblock'] ?? rec?.AutoUnblock ?? 0),
        topManualUnblock: Number(rec?.['Manual Unblock'] ?? rec?.ManualUnblock ?? 0)
      };
    }
    // No API data -> signal no data
    return {
      topTotalAlerts: null as unknown as number,
      topBlocked: null as unknown as number,
      topAutoUnblock: null as unknown as number,
      topManualUnblock: null as unknown as number
    };
  }, [detailsData, violationType]);

  useEffect(() => {
    // Build and call violation_details API for the current tab
    const fetchViolationDetails = async () => {
      try {
        if (!selectedBu) return;
        setDetailsLoading(true);

        const violationLabelToType: Record<string, string> = {
          'Route Deviation': 'route_deviation_count',
          'Power Disconnection': 'main_supply_removal_count',
          'Device Tampering': 'device_tamper_count',
          'Stoppage Violation': 'stoppage_violations_count',
          'Night Driving Violation': 'night_driving_count',
          'Continuous Driving Violation': 'continuous_driving_count',
          'Speed Violation': 'speed_violation_count'
        };

        const baseFilters: Array<{ key: string; cond: string; value: string }> = [];
        if (selectedBu === 'TAS') {
          baseFilters.push({ key: 'bu', cond: 'equals', value: 'TAS' });
        } else if (selectedBu === 'LPG_PACKED') {
          baseFilters.push({ key: 'bu', cond: 'equals', value: 'LPG' });
          baseFilters.push({ key: 'tt_type', cond: 'equals', value: 'packed' });
        } else if (selectedBu === 'LPG_BULK') {
          baseFilters.push({ key: 'bu', cond: 'equals', value: 'LPG' });
          baseFilters.push({ key: 'tt_type', cond: 'equals', value: 'bulk' });
        } else if (selectedBu) {
          baseFilters.push({ key: 'bu', cond: 'equals', value: selectedBu });
        }
        if (selectedZone && selectedZone !== 'all') {
          baseFilters.push({ key: 'zone', cond: 'equals', value: selectedZone });
        }
        if (selectedPlant && selectedPlant !== 'all') {
          baseFilters.push({ key: 'sap_id', cond: 'equals', value: String(selectedPlant) });
        }

        // Build DATE cross filter same as cards
        const now = new Date();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const computeDateRangeString = (): string => {
          if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
            return `${fmt(dateRangeFilter.start)},${fmt(dateRangeFilter.end)}`;
          }
          switch (selectedTimeFilter) {
            // case 'TDY': return `${fmt(now)},${fmt(now)}`;
            // case 'YDY': { const y = new Date(now); y.setDate(y.getDate()-1); return `${fmt(y)},${fmt(y)}`; }
            // case '1W': { const s = new Date(now); s.setDate(s.getDate()-6); return `${fmt(s)},${fmt(now)}`; }
            // case '15D': { const s = new Date(now); s.setDate(s.getDate()-14); return `${fmt(s)},${fmt(now)}`; }
            // case '1M': { const s = new Date(now); s.setDate(s.getDate()-29); return `${fmt(s)},${fmt(now)}`; }
            // case '3M': { const s = new Date(now); s.setDate(s.getDate()-89); return `${fmt(s)},${fmt(now)}`; }
            // // Legacy support for old values
            // case 't': return `${fmt(now)},${fmt(now)}`;
            // case '1d': { const y = new Date(now); y.setDate(y.getDate()-1); return `${fmt(y)},${fmt(y)}`; }
            // case '1w': { const s = new Date(now); s.setDate(s.getDate()-6); return `${fmt(s)},${fmt(now)}`; }
            // case '15d': { const s = new Date(now); s.setDate(s.getDate()-14); return `${fmt(s)},${fmt(now)}`; }
            // case '1m': { const s = new Date(now); s.setDate(s.getDate()-29); return `${fmt(s)},${fmt(now)}`; }
            // case '3m': { const s = new Date(now); s.setDate(s.getDate()-89); return `${fmt(s)},${fmt(now)}`; }
            // default: return `${fmt(now)},${fmt(now)}`;
             case 'TDY': return `${fmt(now)},${fmt(now)}`;
            case 'YDY': { const y = new Date(now); y.setDate(y.getDate()-1); return `${fmt(y)},${fmt(y)}`; }
            case '1W': { const s = new Date(now); s.setDate(s.getDate()-7); return `${fmt(s)},${fmt(now)}`; }
            case '15D': { const s = new Date(now); s.setDate(s.getDate()-15); return `${fmt(s)},${fmt(now)}`; }
            case '1M': { const s = new Date(now); s.setDate(s.getDate()-30); return `${fmt(s)},${fmt(now)}`; }
            case '3M': { const s = new Date(now); s.setDate(s.getDate()-90); return `${fmt(s)},${fmt(now)}`; }
            // Legacy support for old values
            case 't': return `${fmt(now)},${fmt(now)}`;
            case '1d': { const y = new Date(now); y.setDate(y.getDate()-1); return `${fmt(y)},${fmt(y)}`; }
            case '1w': { const s = new Date(now); s.setDate(s.getDate()-7); return `${fmt(s)},${fmt(now)}`; }
            case '15d': { const s = new Date(now); s.setDate(s.getDate()-15); return `${fmt(s)},${fmt(now)}`; }
            case '1m': { const s = new Date(now); s.setDate(s.getDate()-30); return `${fmt(s)},${fmt(now)}`; }
            case '3m': { const s = new Date(now); s.setDate(s.getDate()-90); return `${fmt(s)},${fmt(now)}`; }
            default: return `${fmt(now)},${fmt(now)}`;
          }
        };
        const dateStr = computeDateRangeString();

        const drillState = timeGrain === 'monthwise' ? 'month_wise' : 'day_wise';

        await apiClient.post('/api/charts/generate_vis_data', {
          filters: baseFilters,
          action: 'violation_details',
          drill_state: drillState,
          cross_filters: [{ key: 'DATE', cond: 'equals', value: dateStr }],
          payload: {
            query_type: 'violation_details',
            violation_type: violationLabelToType[violationType] || 'route_deviation_count'
          }
        }).then(r => setDetailsData(r?.data)).catch(() => {});

      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error fetching violation details:', e);
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchViolationDetails();
  }, [violationType, selectedBu, selectedZone, selectedPlant, selectedTimeFilter, dateRangeFilter, timeGrain]);

  // Fetch Alerts Summary for the table with correct payload
  useEffect(() => {
    const fetchAlertSummary = async () => {
      try {
        if (!selectedBu) return;
        setAlertSummaryLoading(true);

        const violationLabelToType: Record<string, string> = {
          'Route Deviation': 'route_deviation_count',
          'Power Disconnection': 'main_supply_removal_count',
          'Device Tampering': 'device_tamper_count',
          'Stoppage Violation': 'stoppage_violations_count',
          'Night Driving Violation': 'night_driving_count',
          'Continuous Driving Violation': 'continuous_driving_count',
          'Speed Violation': 'speed_violation_count'
        };

        const baseFilters: Array<{ key: string; cond: string; value: string }> = [];
        if (selectedBu === 'TAS') {
          baseFilters.push({ key: 'bu', cond: 'equals', value: 'TAS' });
        } else if (selectedBu === 'LPG_PACKED') {
          baseFilters.push({ key: 'bu', cond: 'equals', value: 'LPG' });
          baseFilters.push({ key: 'tt_type', cond: 'equals', value: 'packed' });
        } else if (selectedBu === 'LPG_BULK') {
          baseFilters.push({ key: 'bu', cond: 'equals', value: 'LPG' });
          baseFilters.push({ key: 'tt_type', cond: 'equals', value: 'bulk' });
        } else if (selectedBu) {
          baseFilters.push({ key: 'bu', cond: 'equals', value: selectedBu });
        }
        if (selectedZone && selectedZone !== 'all') {
          baseFilters.push({ key: 'zone', cond: 'equals', value: selectedZone });
        }
        if (selectedPlant && selectedPlant !== 'all') {
          baseFilters.push({ key: 'sap_id', cond: 'equals', value: String(selectedPlant) });
        }

        // Build DATE cross filter same as cards
        const now = new Date();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const computeDateRangeString = (): string => {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
    return `${fmt(dateRangeFilter.start)},${fmt(dateRangeFilter.end)}`;
  }

  const now = new Date();
  const filter = String(selectedTimeFilter || '').trim().toLowerCase();

  const subtractDays = (days: number) => {
    const s = new Date(now);
    s.setDate(s.getDate() - days);
    return `${fmt(s)},${fmt(now)}`;
  };

  switch (filter) {
    // case 't':
    //   return `${fmt(now)},${fmt(now)}`;
    // case '1d':
    //   return subtractDays(1);
    // case '1w':
    //   return subtractDays(6);
    // case '15d':
    //   return subtractDays(14);
    // case '1m':
    //   return subtractDays(29);
    // case '3m':
    //   return subtractDays(89);
    // default:
    //   return `${fmt(now)},${fmt(now)}`;
     case 'TDY': return `${fmt(now)},${fmt(now)}`;
            case 'YDY': { const y = new Date(now); y.setDate(y.getDate()-1); return `${fmt(y)},${fmt(y)}`; }
            case '1W': { const s = new Date(now); s.setDate(s.getDate()-7); return `${fmt(s)},${fmt(now)}`; }
            case '15D': { const s = new Date(now); s.setDate(s.getDate()-15); return `${fmt(s)},${fmt(now)}`; }
            case '1M': { const s = new Date(now); s.setDate(s.getDate()-30); return `${fmt(s)},${fmt(now)}`; }
            case '3M': { const s = new Date(now); s.setDate(s.getDate()-90); return `${fmt(s)},${fmt(now)}`; }
            // Legacy support for old values
            case 't': return `${fmt(now)},${fmt(now)}`;
            case '1d': { const y = new Date(now); y.setDate(y.getDate()-1); return `${fmt(y)},${fmt(y)}`; }
            case '1w': { const s = new Date(now); s.setDate(s.getDate()-7); return `${fmt(s)},${fmt(now)}`; }
            case '15d': { const s = new Date(now); s.setDate(s.getDate()-15); return `${fmt(s)},${fmt(now)}`; }
            case '1m': { const s = new Date(now); s.setDate(s.getDate()-30); return `${fmt(s)},${fmt(now)}`; }
            case '3m': { const s = new Date(now); s.setDate(s.getDate()-90); return `${fmt(s)},${fmt(now)}`; }
            default: return `${fmt(now)},${fmt(now)}`;
  }
};
        const dateStr = computeDateRangeString();

        const drillState = selectionMode === 'zone' ? 'zone' : 'location';

        const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: baseFilters,
          action: 'alert_summary',
          drill_state: drillState,
          cross_filters: [{ key: 'DATE', cond: 'equals', value: dateStr }],
          payload: {
            query_type: 'alert_summary',
            violation_type: violationLabelToType[violationType] || 'route_deviation_count'
          }
        });
        const resp = response?.data;
        setAlertSummaryData(resp);
        // Transform to AlertsPivotTable shape if data present
        const dataObj = resp?.data;
        if (dataObj && typeof dataObj === 'object') {
          const groupNames: string[] = Object.keys(dataObj);
          const columns: Column[] = groupNames.map(name => ({ id: name, name }));
          // Initialize groups for three instances
          const makeCounts = () => ({ total: 0, blocked: 0, auto_unblock: 0, manual_unblock: 0 });
          const instances = ['Instance 1', 'Instance 2', 'Instance >= 3'];
          const groupsTemplate = Object.fromEntries(columns.map(c => [c.id, makeCounts()]));
          const pivotInit: InstancePivotData[] = instances.map(inst => ({ instance: inst as any, groups: JSON.parse(JSON.stringify(groupsTemplate)), total: makeCounts() }));
          const instKeyToName: Record<string, string> = {
            'Instance - 1': 'Instance 1',
            'Instance - 2': 'Instance 2',
            'Instance - 3': 'Instance >= 3'
          };
          for (const groupName of groupNames) {
            const arr = Array.isArray(dataObj[groupName]) ? dataObj[groupName] : [];
            for (const entry of arr) {
              const instKey = Object.keys(entry)[0];
              const instName = instKeyToName[instKey] || instKey;
              const countsArr = entry[instKey];
              const counts = Array.isArray(countsArr) && countsArr[0] ? countsArr[0] : {};
              const blocked = Number(counts['Blocked'] ?? 0);
              const autoUnblock = Number(counts['Auto Unblock'] ?? counts['AutoUnblock'] ?? 0);
              const manualUnblock = Number(counts['Manual Unblock'] ?? counts['ManualUnblock'] ?? 0);
              const total = Number(counts['Total'] ?? counts['total'] ?? 0);
              const row = pivotInit.find(p => p.instance === instName);
              if (row && row.groups[groupName]) {
                row.groups[groupName] = { total, blocked, auto_unblock: autoUnblock, manual_unblock: manualUnblock } as any;
                row.total.total += total;
                row.total.blocked += blocked;
                row.total.auto_unblock += autoUnblock;
                row.total.manual_unblock += manualUnblock;
              }
            }
          }
          setAlertSummaryColumns(columns);
          setAlertSummaryPivot(pivotInit);
        } else {
          setAlertSummaryColumns(null);
          setAlertSummaryPivot(null);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error fetching alert summary:', e);
        setAlertSummaryData(null);
        setAlertSummaryColumns(null);
        setAlertSummaryPivot(null);
      } finally {
        setAlertSummaryLoading(false);
      }
    };

    fetchAlertSummary();
  }, [violationType, selectedBu, selectedZone, selectedPlant, selectedTimeFilter, dateRangeFilter, selectionMode]);

  return ( 
    <div className= "space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="border-2 border-[#4a649f] bg-blue-50/50"><CardContent className="p-3"><div className="flex items-center gap-2"><div className="bg-blue-100 p-2 rounded-lg"><AlertTriangle className="h-5 w-5 text-blue-600" /></div><div><p className="text-xs text-gray-500">Total Alerts</p><p className="text-lg font-bold text-gray-800">{topTotalAlerts !== null && topTotalAlerts !== undefined ? Number(topTotalAlerts).toLocaleString() : '0'}</p></div></div></CardContent></Card>
        <Card className="border-2 border-[#d04c4c] bg-red-50/50"><CardContent className="p-3"><div className="flex items-center gap-2"><div className="bg-red-100 p-2 rounded-lg"><XCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-xs text-gray-500">Blocked</p><p className="text-lg font-bold text-gray-800">{topBlocked !== null && topBlocked !== undefined ? Number(topBlocked).toLocaleString() : '0'}</p></div></div></CardContent></Card>
        <Card className="border-2 border-[#16a34a] bg-green-50/50"><CardContent className="p-3"><div className="flex items-center gap-2"><div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-xs text-gray-500">Auto Unblock</p><p className="text-lg font-bold text-gray-800">{topAutoUnblock !== null && topAutoUnblock !== undefined ? Number(topAutoUnblock).toLocaleString() : '0'}</p></div></div></CardContent></Card>
        <Card className="border-2 border-[#d99b36] bg-orange-50/50"><CardContent className="p-3"><div className="flex items-center gap-2"><div className="bg-orange-100 p-2 rounded-lg"><Wrench className="h-5 w-5 text-orange-600" /></div><div><p className="text-xs text-gray-500">Manual Unblock</p><p className="text-lg font-bold text-gray-800">{topManualUnblock !== null && topManualUnblock !== undefined ? Number(topManualUnblock).toLocaleString() : '0'}</p></div></div></CardContent></Card>
      </div>

      <Card className='bg-[#f3f3f3]'>
        <CardHeader className='p-2 border-b'>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <CardTitle className='text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent'>
            ITDG Alerts Instance Wise Analysis
          </CardTitle>
            {/* <div className="flex flex-col sm:flex-row gap-2">
              <Select value={timeGrain} onValueChange={(v) => setTimeGrain(v as 'daywise' | 'monthwise')}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Time Grain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daywise">Day wise</SelectItem>
                  <SelectItem value="monthwise">Month wise</SelectItem>
                </SelectContent>
              </Select>
            </div> */}
          </div>
        </CardHeader>
        <CardContent className="p-1">
          <div className="flex flex-col lg:flex-row lg:items-stretch w-full gap-1">
            <div className="lg:w-[35%] lg:flex-shrink-0">
              <h4 className="text-xs font-bold text-center mb-1">Instance Breakup</h4>
              {detailsLoading ? (
                <LoadingSpinner message="Loading instance breakup..." />
              ) : InstanceBreakupData.length > 0 ? (
              <ViolationPieChart data={InstanceBreakupData} />
              ) : (
                <NoDataDisplay message="No instance breakup data available" />
              )}
            </div>
            <div className="lg:w-[65%] lg:flex-grow">
              <h4 className="text-xs font-bold text-center mb-1">Instance Trends</h4>
              {detailsLoading ? (
                <LoadingSpinner message="Loading instance trends..." />
              ) : InstanceTrendsData[timeGrain].length > 0 ? (
              <ViolationTrendsChart 
                data={InstanceTrendsData[timeGrain]} 
                timeGrain={timeGrain} 
                  violationNames={['Instance 1', 'Instance 2', 'Instance >= 3']}
                violationKeys={['Instance1', 'Instance2', 'Instance3']} 
                colors={['#EF4444', '#F59E0B', '#3B82F6']} 
              />
              ) : (
                <NoDataDisplay message="No instance trends data available" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm"><Truck className="h-4 w-4" />Alerts Summary for {violationType}</CardTitle>
            {/* <Button
                variant="outline"
                size="sm"
                onClick={handleToggleMode}
                className="h-8 text-xs"
            >
                <ArrowRightLeft className="h-3 w-3 mr-2" />
                View by {selectionMode === 'zone' ? 'Plant' : 'Zone'}
            </Button> */}
        </CardHeader>
        <CardContent className="p-2">
            {alertSummaryLoading ? (
              <LoadingSpinner message="Loading alerts summary..." />
            ) : (alertSummaryPivot && alertSummaryColumns) || (pivotData.length > 0 && (zones.length > 0 || plants.length > 0)) ? (
            <AlertsPivotTable 
                data={alertSummaryPivot ?? pivotData} 
                columns={alertSummaryColumns ?? (selectionMode === 'zone' ? zones : plants)}
            />
            ) : (
              <NoDataDisplay message="No alerts summary data available" />
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ViolationTabContent;