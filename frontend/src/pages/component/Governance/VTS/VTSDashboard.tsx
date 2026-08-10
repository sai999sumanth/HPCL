import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/@/components/ui/tabs";
import { RefreshCw, AlertTriangle, ShieldCheck, Wrench, XCircle, Loader2, Download } from 'lucide-react';
import ZonePlantSelections from '../../RetailOutletHome/ZonePlantSelections';
import EnhancedTimeFilter from '../filters/TimeFilterButtons';
import ViolationPieChart from './ViolationPieChart';
import ViolationTrendsChart from './ViolationTrendsChart';
import ViolationTabContent from './ViolationTabContent';
import ZoneViolationHeatMap from './ZoneViolationHeatMap';
import { apiClient } from '@/services/apiClient';
import { format, subDays } from 'date-fns';
import ReusableFilterBar from '../VTS Analytics/ReusableFilterBar';
import VTSVehicleAI from './VTSVehicleAI';
import useAuthStore from '@/store/authStore';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';


interface AlertMetrics {
  totalAlerts: number;
  blocked: number;
  autoUnblock: number;
  manualUnblock: number;
}



const VIOLATION_NAMES = [
  'Route Deviation', 'Power Disconnection', 'Device Tampering', 'Stoppage Violation',
  'Night Driving Violation', 'Continuous Driving Violation', 'Speed Violation'
];

const ZONES = [
  { id: 'CZ', name: 'Central Zone' }, { id: 'NZ', name: 'North Zone' }, { id: 'NWFZ', name: 'North West Zone' },
  { id: 'NCZ', name: 'North Central Zone' }, { id: 'NFZ', name: 'North Front Zone' }, { id: 'WZ', name: 'West Zone' },
  { id: 'SZ', name: 'South Zone' }, { id: 'EZ', name: 'East Zone' }
];

const PLANTS = [
  { id: 'PLANT001', name: 'Plant 1', zone: 'CZ' }, { id: 'PLANT002', name: 'Plant 2', zone: 'NZ' },
  { id: 'PLANT003', name: 'Plant 3', zone: 'NWFZ' }, { id: 'PLANT004', name: 'Plant 4', zone: 'NCZ' },
  { id: 'PLANT005', name: 'Plant 5', zone: 'NFZ' }, { id: 'PLANT006', name: 'Plant 6', zone: 'WZ' },
  { id: 'PLANT007', name: 'Plant 7', zone: 'SZ' }, { id: 'PLANT008', name: 'Plant 8', zone: 'EZ' },
  { id: 'PLANT009', name: 'Plant 9', zone: 'CZ' }, { id: 'PLANT010', name: 'Plant 10', zone: 'NZ' },
  { id: 'PLANT011', name: 'Plant 11', zone: 'CZ' }, { id: 'PLANT012', name: 'Plant 12', zone: 'NZ' },
  { id: 'PLANT013', name: 'Plant 13', zone: 'NWFZ' }, { id: 'PLANT014', name: 'Plant 14', zone: 'NCZ' },
  { id: 'PLANT015', name: 'Plant 15', zone: 'NFZ' }, { id: 'PLANT016', name: 'Plant 16', zone: 'WZ' },
  { id: 'PLANT017', name: 'Plant 17', zone: 'SZ' }, { id: 'PLANT018', name: 'Plant 18', zone: 'EZ' },
  { id: 'PLANT019', name: 'Plant 19', zone: 'CZ' }, { id: 'PLANT020', name: 'Plant 20', zone: 'NZ' },
];


const toCamelCase = (str: string) => str
  .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase())
  .replace(/\s+/g, '');

const VIOLATION_KEYS = VIOLATION_NAMES.map(toCamelCase);

const MATTE_COLORS = [
  "#c52429", "#e67e22", "#15a396", "#4aaf49", "#2a449b", "#9b2476", "#ef5785", "#8e44ad"
];

// Loading Component
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="w-full h-72 flex flex-col items-center justify-center text-gray-500">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
  </div>
);

// No Data Component
const NoDataDisplay: React.FC<{ message?: string }> = ({ message = 'No data available' }) => (
  <div className="w-full h-72 flex flex-col items-center justify-center text-gray-500">
    <p className="text-xs">{message}</p>
  </div>
);

const VTSDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const userBu = user?.bu;
  const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
  const isTasUser = Array.isArray(userBu) && userBu.includes('TAS');
  const hasUserBu = isLpgUser || isTasUser;

  // Top chart filters
  const [selectedBu, setSelectedBu] = useState<string>(isLpgUser ? 'LPG_PACKED' : isTasUser ? 'TAS' : 'TAS');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>('15D');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: Date, end: Date } | null>(null);
  const [chartAlertType, setChartAlertType] = useState<string>('all');
  const [chartTimeGrain, setChartTimeGrain] = useState<string>('daywise');
  const [violationAnalyticsDrill, setViolationAnalyticsDrill] = useState<'zone' | 'plant'>('zone');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Helper to build base filters with BU and tt_type
  const buildBaseFilters = (bu: string) => {
    const baseFilters: any[] = [];
    if (bu === 'TAS') {
      baseFilters.push({ key: 'bu', cond: 'equals', value: 'TAS' });
    } else if (bu === 'LPG_PACKED') {
      baseFilters.push({ key: 'bu', cond: 'equals', value: 'LPG' });
      baseFilters.push({ key: 'tt_type', cond: 'equals', value: 'packed' });
    } else if (bu === 'LPG_BULK') {
      baseFilters.push({ key: 'bu', cond: 'equals', value: 'LPG' });
      baseFilters.push({ key: 'tt_type', cond: 'equals', value: 'bulk' });
    } else {
      baseFilters.push({ key: 'bu', cond: 'equals', value: bu });
    }
    return baseFilters;
  };

  // ITDG Alerts Details & Analysis filters (separate from top filters)
  const [detailsSelectedBu, setDetailsSelectedBu] = useState<string>(isLpgUser ? 'LPG_PACKED' : isTasUser ? 'TAS' : 'TAS');
  const [detailsSelectedZone, setDetailsSelectedZone] = useState<string | null>(null);
  const [detailsSelectedPlant, setDetailsSelectedPlant] = useState<string | null>(null);
  const [detailsSelectedTimeFilter, setDetailsSelectedTimeFilter] = useState<string | null>('3m');
  const [detailsDateRangeFilter, setDetailsDateRangeFilter] = useState<{ start: Date, end: Date } | null>(null);
  const [detailsChartAlertType, setDetailsChartAlertType] = useState<string>('all');
  const [detailsChartTimeGrain, setDetailsChartTimeGrain] = useState<string>('daywise');
  const [activeViolationTab, setActiveViolationTab] = useState<string>(VIOLATION_KEYS[0]);

  const [alertMetrics, setAlertMetrics] = useState<AlertMetrics>({ totalAlerts: 0, blocked: 0, autoUnblock: 0, manualUnblock: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [instanceData, setInstanceData] = useState<any[]>([]);
  const [instanceDataLoading, setInstanceDataLoading] = useState(false);
  const [blockedInstanceData, setBlockedInstanceData] = useState<any[]>([]);
  const [autoUnblockInstanceData, setAutoUnblockInstanceData] = useState<any[]>([]);
  const [manualUnblockInstanceData, setManualUnblockInstanceData] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDownloadingHeatMap, setIsDownloadingHeatMap] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState<string | null>(null);

  // Set BU based on user's BU
  useEffect(() => {
    if (isLpgUser) {
      setSelectedBu('LPG_PACKED');
      setDetailsSelectedBu('LPG_PACKED');
    } else if (isTasUser) {
      setSelectedBu('TAS');
      setDetailsSelectedBu('TAS');
    }
  }, [isLpgUser, isTasUser]);

  useEffect(() => {
    const fetchAlertMetrics = async () => {
      setMetricsLoading(true);
      setIsRefreshing(true);
      try {
        const getDateRangeString = (filter: string | null, customRange: { start: Date, end: Date } | null): string => {
          // const now = new Date();
          // const formatDate = (date: Date): string => format(date, 'yyyy-MM-dd');
          const now = new Date();
          const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

          if (customRange && customRange.start && customRange.end) {
            return `${fmt(customRange.start)},${fmt(customRange.end)}`;
          }

          switch (filter) {
            // case 'TDY': return `${formatDate(now)},${formatDate(now)}`;
            // case 'YDY': const yesterday = subDays(now, 1); return `${formatDate(yesterday)},${formatDate(yesterday)}`;
            // case '1W': return `${formatDate(subDays(now, 7))},${formatDate(now)}`;
            // case '15D': return `${formatDate(subDays(now, 15))},${formatDate(now)}`;
            // case '1M': return `${formatDate(subDays(now, 30))},${formatDate(now)}`;
            // case '3M': return `${formatDate(subDays(now, 90))},${formatDate(now)}`;
            // // Legacy support for old values
            // case 't': return `${formatDate(now)},${formatDate(now)}`;
            // case '1d': const yesterdayLegacy = subDays(now, 1); return `${formatDate(yesterdayLegacy)},${formatDate(yesterdayLegacy)}`;
            // case '1w': return `${formatDate(subDays(now, 7))},${formatDate(now)}`;
            // case '15d': return `${formatDate(subDays(now, 15))},${formatDate(now)}`;
            // case '1m': return `${formatDate(subDays(now, 30))},${formatDate(now)}`;
            // case '3m': return `${formatDate(subDays(now, 90))},${formatDate(now)}`;
            // default: return `${formatDate(now)},${formatDate(now)}`;

            case 'TDY': return `${fmt(now)},${fmt(now)}`;
            case 'YDY': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
            case '1W': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
            case '15D': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
            case '1M': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
            case '3M': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }
            // Legacy support for old values
            case 't': return `${fmt(now)},${fmt(now)}`;
            case '1d': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
            case '1w': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
            case '15d': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
            case '1m': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
            case '3m': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }
            default: return `${fmt(now)},${fmt(now)}`;
          }
        };

        const baseFilters = buildBaseFilters(selectedBu);
        if (selectedZone && selectedZone !== 'all') {
          baseFilters.push({ key: 'zone', cond: 'equals', value: selectedZone });
        }
        if (selectedPlant && selectedPlant !== 'all') {
          baseFilters.push({ key: 'sap_id', cond: 'equals', value: selectedPlant });
        }

        const dateFilterString = getDateRangeString(selectedTimeFilter, dateRangeFilter);
        const crossFilters = [{ key: 'DATE', cond: 'equals', value: dateFilterString }];

        const drillStates = {
          totalAlerts: 'total_alerts',
          blocked: 'blocked_alerts',
          autoUnblock: 'auto_unblock',
          manualUnblock: 'manual_unblock'
        };

        const requests = Object.values(drillStates).map(drill_state =>
          apiClient.post('/api/charts/generate_vis_data', {
            filters: baseFilters,
            action: 'vts_card_chart',
            drill_state,
            cross_filters: crossFilters
          })
        );

        const responses = await Promise.all(requests);

        // Process each response to calculate totals from instance data
        const processInstanceData = (responseData: any[]) => {
          if (!responseData || !Array.isArray(responseData)) return { total: 0, instances: [] };
          const total = responseData.reduce((sum, item) => sum + (item.count || 0), 0);
          return { total, instances: responseData };
        };

        const totalAlertsData = processInstanceData(responses[0].data?.data);
        const blockedData = processInstanceData(responses[1].data?.data);
        const autoUnblockData = processInstanceData(responses[2].data?.data);
        const manualUnblockData = processInstanceData(responses[3].data?.data);

        const newMetrics: AlertMetrics = {
          totalAlerts: totalAlertsData.total,
          blocked: blockedData.total,
          autoUnblock: autoUnblockData.total,
          manualUnblock: manualUnblockData.total,
        };

        setAlertMetrics(newMetrics);
        setInstanceData(totalAlertsData.instances);
        setBlockedInstanceData(blockedData.instances);
        setAutoUnblockInstanceData(autoUnblockData.instances);
        setManualUnblockInstanceData(manualUnblockData.instances);

      } catch (error) {
        console.error("Error fetching alert metrics:", error);
        setAlertMetrics({ totalAlerts: 0, blocked: 0, autoUnblock: 0, manualUnblock: 0 });
        setInstanceData([]);
        setBlockedInstanceData([]);
        setAutoUnblockInstanceData([]);
        setManualUnblockInstanceData([]);
      } finally {
        setMetricsLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchAlertMetrics();
  }, [selectedBu, selectedZone, selectedPlant, selectedTimeFilter, dateRangeFilter, refreshTrigger]);

  // Download function for card data
  const handleCardDownload = async (drillState: string) => {
    setDownloadingCard(drillState);
    try {
      const getDateRangeString = (filter: string | null, customRange: { start: Date, end: Date } | null): string => {
        const now = new Date();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        if (customRange && customRange.start && customRange.end) {
          return `${fmt(customRange.start)},${fmt(customRange.end)}`;
        }

        switch (filter) {
          case 'TDY': return `${fmt(now)},${fmt(now)}`;
          case 'YDY': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
          case '1W': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
          case '15D': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
          case '1M': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
          case '3M': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }
          case 't': return `${fmt(now)},${fmt(now)}`;
          case '1d': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
          case '1w': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
          case '15d': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
          case '1m': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
          case '3m': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }
          default: return `${fmt(now)},${fmt(now)}`;
        }
      };

      const baseFilters = buildBaseFilters(selectedBu);
      if (selectedZone && selectedZone !== 'all') {
        baseFilters.push({ key: 'zone', cond: 'equals', value: selectedZone });
      }
      if (selectedPlant && selectedPlant !== 'all') {
        baseFilters.push({ key: 'sap_id', cond: 'equals', value: selectedPlant });
      }

      const dateFilterString = getDateRangeString(selectedTimeFilter, dateRangeFilter);
      const crossFilters = [{ key: 'DATE', cond: 'equals', value: dateFilterString }];

      const payload = {
        filters: baseFilters,
        action: 'vts_dashboard_card_download',
        drill_state: drillState,
        cross_filters: crossFilters,
        payload: {
          download: "true"
        }
      };

      const response = await apiClient.post('/api/charts/generate_vis_data', payload, {
        responseType: "blob"
      });

      // Create blob and download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `VTS_Dashboard_${drillState}_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`VTS Dashboard ${drillState.replace('_download', '').replace(/_/g, ' ')} data downloaded successfully`);
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(error?.response?.data?.message || 'Failed to download data');
    } finally {
      setDownloadingCard(null);
    }
  };


  const [violationBreakupData, setViolationBreakupData] = useState([

  ]);
  const [violationAnalyticsLoading, setViolationAnalyticsLoading] = useState(false);

  const [zoneViolationData, setZoneViolationData] = useState<{ [key: string]: { zone: string; alerts: number }[] }>({});

  useEffect(() => {
    const fetchViolationAnalytics = async () => {
      setIsRefreshing(true);
      setViolationAnalyticsLoading(true);
      try {
        const baseFilters = buildBaseFilters(selectedBu);
        if (selectedZone && selectedZone !== 'all') {
          baseFilters.push({ key: 'zone', cond: 'equals', value: selectedZone });
        }
        if (selectedPlant && selectedPlant !== 'all') {
          baseFilters.push({ key: 'sap_id', cond: 'equals', value: selectedPlant });
        }

        const alertTypePayload = chartAlertType === 'all' ? 'all_alerts' : chartAlertType;
        const drillState = violationAnalyticsDrill === 'zone' ? 'zone' : 'location';

        // Compute date range same as cards
        const now = new Date();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const computeDateRangeString = (): string => {
          if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
            return `${fmt(dateRangeFilter.start)},${fmt(dateRangeFilter.end)}`;
          }
          switch (selectedTimeFilter) {
            case 'TDY': return `${fmt(now)},${fmt(now)}`;
            case 'YDY': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
            case '1W': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
            case '15D': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
            case '1M': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
            case '3M': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }
            // Legacy support for old values
            case 't': return `${fmt(now)},${fmt(now)}`;
            case '1d': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
            case '1w': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
            case '15d': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
            case '1m': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
            case '3m': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }
            default: return `${fmt(now)},${fmt(now)}`;
          }
        };
        const dateFilterString = computeDateRangeString();

        const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: baseFilters,
          action: 'vts_alerts_violations',
          drill_state: drillState,
          cross_filters: [{ key: 'DATE', cond: 'equals', value: dateFilterString }],
          payload: {
            query_type: 'violation_analytics',
            alert_type: alertTypePayload
          }
        });

        const payload = response?.data;
        // If API returns percentages array, use it for pie chart
        if (payload?.percentages && Array.isArray(payload.percentages)) {
          // Optional: build counts by violation_type by summing across zones from payload.data
          const countsByType: Record<string, number> = {};
          if (payload?.data && Array.isArray(payload.data)) {
            try {
              for (const zoneObj of payload.data) {
                const zoneKey = Object.keys(zoneObj)[0];
                const arr = zoneObj[zoneKey];
                if (Array.isArray(arr)) {
                  for (const entry of arr) {
                    const vt = String(entry?.violation_type ?? '');
                    const c = Number(entry?.count ?? 0);
                    if (!countsByType[vt]) countsByType[vt] = 0;
                    countsByType[vt] += c;
                  }
                }
              }
            } catch { }
          }

          const violationTypeToLabel: Record<string, string> = {
            route_deviation_count: 'Route Deviation',
            stoppage_violations_count: 'Stoppage Violation',
            main_supply_removal_count: 'Power Disconnection',
            night_driving_count: 'Night Driving Violation',
            speed_violation_count: 'Speed Violation',
            continuous_driving_count: 'Continuous Driving Violation',
            device_tampering_count: 'Device Tampering'
          };

          const mapped = payload.percentages.map((p: any) => {
            const vt = String(p?.violation_type ?? '');
            const label = violationTypeToLabel[vt] || vt.replace(/_/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase());
            return {
              violation: label,
              count: Number(countsByType[vt] ?? 0),
              percentage: Number(p?.percentage ?? 0)
            };
          });
          setViolationBreakupData(mapped);
          // Build heat map data from payload.data using same labels
          try {
            if (payload?.data && Array.isArray(payload.data)) {
              const zonesSet = new Set<string>();
              const byViolation: Record<string, Record<string, number>> = {};
              for (const zoneObj of payload.data) {
                const zoneKey = Object.keys(zoneObj)[0];
                zonesSet.add(zoneKey);
                const arr = zoneObj[zoneKey];
                if (Array.isArray(arr)) {
                  for (const entry of arr) {
                    const vt = String(entry?.violation_type ?? '');
                    const label = violationTypeToLabel[vt] || vt.replace(/_/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase());
                    const c = Number(entry?.count ?? 0);
                    if (!byViolation[label]) byViolation[label] = {};
                    if (!byViolation[label][zoneKey]) byViolation[label][zoneKey] = 0;
                    byViolation[label][zoneKey] += c;
                  }
                }
              }
              const zones = Array.from(zonesSet).sort();
              const finalData: { [key: string]: { zone: string; alerts: number }[] } = {};
              Object.keys(byViolation).forEach(label => {
                finalData[label] = zones.map(zone => ({ zone, alerts: Number(byViolation[label][zone] ?? 0) }));
              });
              setZoneViolationData(finalData);
            }
          } catch { }
          return;
        }
        // Legacy fallbacks
        if (payload?.breakup && Array.isArray(payload.breakup)) {
          setViolationBreakupData(payload.breakup);
          return;
        }
        if (payload?.data && Array.isArray(payload.data)) {
          const items = payload.data;
          const total = items.reduce((sum: number, it: any) => sum + (Number(it.count) || 0), 0) || 1;
          const mapped = items.map((it: any) => ({
            violation: String(it.violation ?? it.name ?? it.type ?? 'Unknown'),
            count: Number(it.count) || 0,
            percentage: ((Number(it.count) || 0) / total) * 100
          }));
          setViolationBreakupData(mapped);
        }
      } catch (err) {
        console.error('Error fetching violation analytics:', err);
        setViolationBreakupData([]);
        setZoneViolationData({});
      }
      finally {
        setIsRefreshing(false);
        setViolationAnalyticsLoading(false);
      }
    };

    fetchViolationAnalytics();
  }, [selectedBu, selectedZone, selectedPlant, chartAlertType, violationAnalyticsDrill, refreshTrigger, selectedTimeFilter, dateRangeFilter]);

  const [violationTrendsData, setViolationTrendsData] = useState<{ daywise: any[]; monthwise: any[] }>({ daywise: [], monthwise: [] });
  const [violationTrendsLoading, setViolationTrendsLoading] = useState(false);

  useEffect(() => {
    const fetchViolationTrends = async () => {
      setIsRefreshing(true);
      setViolationTrendsLoading(true);
      try {
        const baseFilters = buildBaseFilters(selectedBu);
        if (selectedZone && selectedZone !== 'all') {
          baseFilters.push({ key: 'zone', cond: 'equals', value: selectedZone });
        }
        if (selectedPlant && selectedPlant !== 'all') {
          baseFilters.push({ key: 'sap_id', cond: 'equals', value: selectedPlant });
        }

        const drillState = chartTimeGrain === 'daywise' ? 'day_wise' : 'month_wise';
        const alertTypePayload = chartAlertType === 'all' ? 'all_alerts' : chartAlertType;

        // Compute date range same as cards
        const now = new Date();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const computeDateRangeString = (): string => {
          if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
            return `${fmt(dateRangeFilter.start)},${fmt(dateRangeFilter.end)}`;
          }
          switch (selectedTimeFilter) {
            case 'TDY': return `${fmt(now)},${fmt(now)}`;
            case 'YDY': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
            case '1W': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
            case '15D': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
            case '1M': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
            case '3M': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }
            // Legacy support for old values
            case 't': return `${fmt(now)},${fmt(now)}`;
            case '1d': { const y = new Date(now); y.setDate(y.getDate() - 1); return `${fmt(y)},${fmt(y)}`; }
            case '1w': { const s = new Date(now); s.setDate(s.getDate() - 7); return `${fmt(s)},${fmt(now)}`; }
            case '15d': { const s = new Date(now); s.setDate(s.getDate() - 15); return `${fmt(s)},${fmt(now)}`; }
            case '1m': { const s = new Date(now); s.setDate(s.getDate() - 30); return `${fmt(s)},${fmt(now)}`; }
            case '3m': { const s = new Date(now); s.setDate(s.getDate() - 90); return `${fmt(s)},${fmt(now)}`; }
            default: return `${fmt(now)},${fmt(now)}`;
          }
        };
        const dateFilterString = computeDateRangeString();

        const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: baseFilters,
          action: 'violation_trends_over_time',
          drill_state: drillState,
          cross_filters: [{ key: 'DATE', cond: 'equals', value: dateFilterString }],
          payload: {
            query_type: 'violation_trend_alerts',
            alert_type: alertTypePayload
          }
        });

        const payload = response?.data;
        const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];

        const violationTypeToLabel: Record<string, string> = {
          route_deviation_count: 'Route Deviation',
          stoppage_violations_count: 'Stoppage Violation',
          main_supply_removal_count: 'Power Disconnection',
          night_driving_count: 'Night Driving Violation',
          speed_violation_count: 'Speed Violation',
          continuous_driving_count: 'Continuous Driving Violation',
          device_tampering_count: 'Device Tampering'
        };
        const labelToKey: Record<string, string> = {};
        VIOLATION_KEYS.forEach((k, i) => { labelToKey[VIOLATION_NAMES[i]] = k; });

        const byTime: Record<string, any> = {};
        for (const row of rows) {
          const timeLabel = row.date || row.day || row.month || row.period || row.time || null;
          if (!timeLabel) continue;

          // Case C: API returns { date, records: [{ violation_type, count }, ...] }
          if (Array.isArray(row.records)) {
            const entry: any = { date: row.date, month: row.month };
            for (const rec of row.records) {
              const label = violationTypeToLabel[String(rec?.violation_type)] || String(rec?.violation_type || '');
              const key = labelToKey[label] || label;
              entry[key] = Number(rec?.count) || 0;
            }
            byTime[timeLabel] = entry;
            continue;
          }

          // Case A: row has violation_type + count
          if (row.violation_type && (row.count !== undefined)) {
            const label = violationTypeToLabel[String(row.violation_type)] || String(row.violation_type);
            const key = labelToKey[label] || label;
            if (!byTime[timeLabel]) byTime[timeLabel] = { date: row.date, month: row.month };
            byTime[timeLabel][key] = Number(row.count) || 0;
            continue;
          }

          // Case B: row has multiple *_count fields for same time
          const entry: any = { date: row.date, month: row.month };
          Object.keys(row).forEach(field => {
            if (field.endsWith('_count')) {
              const label = violationTypeToLabel[field] || field;
              const key = labelToKey[label] || label;
              entry[key] = Number(row[field]) || 0;
            }
          });
          if (Object.keys(entry).length > 2) {
            byTime[timeLabel] = entry;
          }
        }

        const arr = Object.entries(byTime).map(([t, obj]) => ({ ...(obj as any), date: (obj as any).date || (chartTimeGrain === 'daywise' ? t : undefined), month: (obj as any).month || (chartTimeGrain !== 'daywise' ? t : undefined) }));
        arr.sort((a: any, b: any) => {
          const aKey = chartTimeGrain === 'daywise' ? (a.date || '') : (a.month || '');
          const bKey = chartTimeGrain === 'daywise' ? (b.date || '') : (b.month || '');
          return new Date(aKey).getTime() - new Date(bKey).getTime();
        });

        if (chartTimeGrain === 'daywise') {
          setViolationTrendsData(prev => ({ ...prev, daywise: arr }));
        } else {
          setViolationTrendsData(prev => ({ ...prev, monthwise: arr }));
        }
      } catch (err) {
        console.error('Error fetching violation trends:', err);
        setViolationTrendsData({ daywise: [], monthwise: [] });
      }
      finally {
        setIsRefreshing(false);
        setViolationTrendsLoading(false);
      }
    };

    fetchViolationTrends();
  }, [selectedBu, selectedZone, selectedPlant, chartAlertType, chartTimeGrain, refreshTrigger, selectedTimeFilter, dateRangeFilter]);

  const violationTabs = VIOLATION_NAMES.map((name, index) => ({
    id: VIOLATION_KEYS[index],
    label: name,
    count: violationBreakupData[index]?.count || 0
  }));

  // Helper function to render instance data
  const renderInstanceData = (instanceData: any[], cardType: string) => {
    if (instanceData.length === 0) return null;

    const colorMap = {
      total: 'text-indigo-200',
      blocked: 'text-blue-200',
      auto: 'text-violet-200',
      manual: 'text-cyan-200'
    };

    // Helper function to format instance level
    const formatInstanceLevel = (instanceLevel: string) => {
      // Replace "Instance - 3" with "Instance >= 3"
      if (instanceLevel === 'Instance - 3' || instanceLevel.includes('Instance - 3')) {
        return instanceLevel.replace('Instance - 3', 'Instance >= 3');
      }
      // Replace other "Instance - X" patterns with "Instance >= X" if needed
      return instanceLevel.replace(' - ', ' ');
    };

    return (
      <div className={`mt-2 ${colorMap[cardType as keyof typeof colorMap]}`}>
        <div className="text-xs">
          {instanceData.map((item, index) => (
            <span key={item.instance_level || `instance-${index}`}>
              <span className="font-medium">
                {formatInstanceLevel(item.instance_level)}
              </span>
              <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded-full ">
                {item.count}
              </span>{' '}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const handlePlantChange = (plant: string | null, zone?: string) => {
    setSelectedPlant(plant);
    if (zone !== undefined) {
      setSelectedZone(zone);
    }
  };

  const handleTimeFilterChange = (filterValue: string | null | { key: string; cond: string; value: string }) => {
    if (typeof filterValue === 'string') {
      setSelectedTimeFilter(filterValue);
      setDateRangeFilter(null);
    } else if (filterValue && typeof filterValue === 'object' && filterValue.key === 'Date') {
      const [startStr, endStr] = filterValue.value.split(',');
      if (startStr && endStr) {
        const startDate = new Date(startStr + 'T00:00:00');
        const endDate = new Date(endStr + 'T23:59:59');

        setDateRangeFilter({ start: startDate, end: endDate });
        setSelectedTimeFilter(null);
      }
    } else {
      setSelectedTimeFilter('TDY');
      setDateRangeFilter(null);
    }
  };

  const handleRefresh = () => {
    // Reset all filters to their default state
    setSelectedBu('TAS');
    setSelectedZone(null);
    setSelectedPlant(null);
    setSelectedTimeFilter('1M');
    setDateRangeFilter(null);
    setRefreshKey(prev => prev + 1);
    // Trigger the refresh effect for data fetching and to reset child components
    setRefreshTrigger(count => count + 1);
  };

  // Separate handlers for ITDG Alerts Details & Analysis filters
  const handleDetailsPlantChange = (plant: string | null, zone?: string) => {
    setDetailsSelectedPlant(plant);
    if (zone !== undefined) {
      setDetailsSelectedZone(zone);
    }
  };

  const handleDetailsTimeFilterChange = (filterValue: string | null | { key: string; cond: string; value: string }) => {
    if (typeof filterValue === 'string') {
      setDetailsSelectedTimeFilter(filterValue);
      setDetailsDateRangeFilter(null);
    } else if (filterValue && typeof filterValue === 'object' && filterValue.key === 'Date') {
      const [startStr, endStr] = filterValue.value.split(',');
      if (startStr && endStr) {
        const startDate = new Date(startStr + 'T00:00:00');
        const endDate = new Date(endStr + 'T23:59:59');

        setDetailsDateRangeFilter({ start: startDate, end: endDate });
        setDetailsSelectedTimeFilter(null);
      }
    } else {
      setDetailsSelectedTimeFilter('TDY');
      setDetailsDateRangeFilter(null);
    }
  };

  const handleDetailsRefresh = () => {
    // Reset details filters to their default state
    setDetailsSelectedZone(null);
    setDetailsSelectedPlant(null);
    setDetailsSelectedTimeFilter('TDY');
    setDetailsDateRangeFilter(null);
  };

  const onTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
    // Check if filter is a date range object
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      // This is a custom date range filter
      const dateRange = filter.value.split(',');
      if (dateRange.length === 2) {
        setDateRangeFilter({
          start: new Date(dateRange[0]),
          end: new Date(dateRange[1])
        });
        setSelectedTimeFilter(null); // Clear time filter when custom date is selected
      }
    } else {
      // This is a standard time filter
      setSelectedTimeFilter(filter as string | null);
      setDateRangeFilter(null); // Clear date range when time filter is selected
    }
  };

  const handleDownloadHeatMap = () => {
    if (Object.keys(zoneViolationData).length === 0 && violationBreakupData.length === 0) {
      toast.error('No data available to download');
      return;
    }

    setIsDownloadingHeatMap(true);
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Sheet 1: ITDG Alert Heat Map
      if (Object.keys(zoneViolationData).length > 0) {
        // Collect all unique zones
        const allZones = new Set<string>();
        Object.values(zoneViolationData).forEach((zoneData) => {
          zoneData.forEach((item) => {
            allZones.add(item.zone);
          });
        });
        const sortedZones = Array.from(allZones).sort();

        // Get all violation types (keys)
        const violationTypes = Object.keys(zoneViolationData).sort();

        // Create pivot table structure
        const worksheetData: any[][] = [];

        // Add header row
        const headers = ['Zone', ...violationTypes];
        worksheetData.push(headers);

        // Add data rows - one row per zone
        sortedZones.forEach((zone) => {
          const row: any[] = [zone];
          violationTypes.forEach((violationType) => {
            const zoneData = zoneViolationData[violationType] || [];
            const zoneItem = zoneData.find((item) => item.zone === zone);
            row.push(zoneItem ? zoneItem.alerts : 0);
          });
          worksheetData.push(row);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Auto-size columns
        const colWidths = headers.map((header, colIndex) => {
          let maxWidth = header.length;
          worksheetData.forEach((row) => {
            const cellValue = row[colIndex];
            if (cellValue !== undefined && cellValue !== null) {
              const cellLength = String(cellValue).length;
              if (cellLength > maxWidth) {
                maxWidth = cellLength;
              }
            }
          });
          return { wch: Math.min(maxWidth + 2, 50) }; // Cap at 50 characters
        });
        worksheet['!cols'] = colWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'ITDG Alert Heat Map');
      }

      // Sheet 2: ITDG Alert Breakup
      if (violationBreakupData.length > 0) {
        const breakupWorksheetData: any[][] = [];

        // Add header row
        breakupWorksheetData.push(['Violation Type', 'Count', 'Percentage (%)']);

        // Add data rows
        violationBreakupData.forEach((item) => {
          breakupWorksheetData.push([
            item.violation || '',
            item.count || 0,
            item.percentage ? Number(item.percentage).toFixed(2) : '0.00'
          ]);
        });

        const breakupWorksheet = XLSX.utils.aoa_to_sheet(breakupWorksheetData);

        // Auto-size columns
        const maxViolationLength = Math.max(20, ...violationBreakupData.map(item => String(item.violation || '').length));
        const breakupColWidths = [
          { wch: maxViolationLength + 2 },
          { wch: 12 },
          { wch: 15 }
        ];
        breakupWorksheet['!cols'] = breakupColWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, breakupWorksheet, 'ITDG Alert Breakup');
      }

      // Generate filename with timestamp
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const alertTypeLabel = chartAlertType === 'all' ? 'All' : chartAlertType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      const drillLabel = violationAnalyticsDrill === 'zone' ? 'Zone' : 'Plant';
      const filename = `ITDG_Alert_Report_${drillLabel}_${alertTypeLabel}_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    } finally {
      setIsDownloadingHeatMap(false);
    }
  };
  return (
    <div className="space-y-1 bg-white p-1">
      <VTSVehicleAI />
      {/* <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">VTS Dashboard</h1>
            <p className="text-sm text-gray-600">
              Vehicle Tracking System - Governance
            </p>
          </div>
          <div className="flex flex-col lg:flex-row items-end lg:items-center gap-2">
            <Select value={selectedBu} onValueChange={setSelectedBu} disabled={hasUserBu}>
              <SelectTrigger className="w-auto h-7 text-xs">
                <SelectValue placeholder="Select BU" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TAS">SOD</SelectItem>
                <SelectItem value="LPG">LPG</SelectItem>
              </SelectContent>
            </Select>
            <ZonePlantSelections
              zone={selectedZone}
              sapid={selectedPlant}
              onZoneChange={setSelectedZone}
              onPlantChange={handlePlantChange}
              bu={selectedBu}
              onAlertTypeChange={setChartAlertType}
              hideAlertType={true}
            />

            <EnhancedTimeFilter
              selectedFilter={selectedTimeFilter}
              onFilterChange={handleTimeFilterChange}
              isLoading={metricsLoading}
              resetTrigger={refreshTrigger}
            />
            <Button
              onClick={handleRefresh}
              disabled={metricsLoading}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-7"
            >
              <RefreshCw className={`h-4 w-4 ${metricsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div> */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <h1 className="text-xl font-bold text-gray-900">VTS Dashboard</h1>
            <p className="text-sm text-gray-600">
              Vehicle Tracking System - Governance
            </p>
          </div>

          <ReusableFilterBar
            key={refreshKey}
            refreshKey={refreshKey}
            selectedBu={selectedBu}
            onBuChange={setSelectedBu}
            selectedZone={selectedZone}
            onZoneChange={setSelectedZone}
            selectedPlant={selectedPlant}
            onPlantChange={setSelectedPlant}
            timeFilter={selectedTimeFilter}
            onTimeFilterChange={onTimeFilterChange}
            disableBuSelect={hasUserBu}
            showLpgPackedAndBulk={true}
            onRefresh={handleRefresh}
            isLoading={isRefreshing}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 relative">
          <CardContent className="p-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCardDownload('total_alerts_download');
              }}
              disabled={downloadingCard === 'total_alerts_download'}
              title="Download excel"
              aria-label="Download excel"
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingCard === 'total_alerts_download' ? (
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              ) : (
                <Download className="w-3 h-3 text-white" />
              )}
            </button>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-slate-100 text-xs font-medium">Total ITDG Alerts</p>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {metricsLoading ? (
                    <span className="inline-block h-6 w-16 bg-white/30 rounded-md animate-pulse"></span>
                  ) : (
                    alertMetrics.totalAlerts.toLocaleString()
                  )}
                </p>
              </div>
            </div>
            {renderInstanceData(instanceData, 'total')}

          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 relative">
          <CardContent className="p-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCardDownload('blocked_alerts_download');
              }}
              disabled={downloadingCard === 'blocked_alerts_download'}
              title="Download excel"
              aria-label="Download excel"
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingCard === 'blocked_alerts_download' ? (
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              ) : (
                <Download className="w-3 h-3 text-white" />
              )}
            </button>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-blue-100 text-xs font-medium">Blocked</p>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {metricsLoading ? (
                    <span className="inline-block h-6 w-16 bg-white/30 rounded-md animate-pulse"></span>
                  ) : (
                    alertMetrics.blocked.toLocaleString()
                  )}
                </p>
              </div>
            </div>
            {renderInstanceData(blockedInstanceData, 'blocked')}

          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 relative">
          <CardContent className="p-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCardDownload('auto_unblock_download');
              }}
              disabled={downloadingCard === 'auto_unblock_download'}
              title="Download excel"
              aria-label="Download excel"
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingCard === 'auto_unblock_download' ? (
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              ) : (
                <Download className="w-3 h-3 text-white" />
              )}
            </button>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-violet-100 text-xs font-medium">Auto Unblock</p>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {metricsLoading ? (
                    <span className="inline-block h-6 w-16 bg-white/30 rounded-md animate-pulse"></span>
                  ) : (
                    alertMetrics.autoUnblock.toLocaleString()
                  )}
                </p>
              </div>
            </div>
            {renderInstanceData(autoUnblockInstanceData, 'auto')}

          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-600 to-cyan-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 relative">
          <CardContent className="p-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCardDownload('manual_unblock_download');
              }}
              disabled={downloadingCard === 'manual_unblock_download'}
              title="Download excel"
              aria-label="Download excel"
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingCard === 'manual_unblock_download' ? (
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              ) : (
                <Download className="w-3 h-3 text-white" />
              )}
            </button>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-cyan-100 text-xs font-medium">Manual Unblock</p>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {metricsLoading ? (
                    <span className="inline-block h-6 w-16 bg-white/30 rounded-md animate-pulse"></span>
                  ) : (
                    alertMetrics.manualUnblock.toLocaleString()
                  )}
                </p>
              </div>
            </div>
            {renderInstanceData(manualUnblockInstanceData, 'manual')}

          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#f3f3f3] rounded-lg shadow-sm border space-y-0">
        <CardHeader className="border-b p-2">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ITDG Alerts - Breakup & Distribution
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="inline-flex rounded-md overflow-hidden border">
                <button
                  type="button"
                  onClick={() => setViolationAnalyticsDrill('zone')}
                  className={`px-3 h-8 text-xs ${violationAnalyticsDrill === 'zone' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  Zone
                </button>
                <button
                  type="button"
                  onClick={() => setViolationAnalyticsDrill('plant')}
                  className={`px-3 h-8 text-xs border-l ${violationAnalyticsDrill === 'plant' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  Plant
                </button>
              </div>
              <Select value={chartAlertType} onValueChange={setChartAlertType}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Alert Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Alerts</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="auto_unblock">Auto Unblock</SelectItem>
                  <SelectItem value="manual_unblock">Manual Unblock</SelectItem>
                  <SelectItem value="acceptance_close">Accept & Block</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-1">
          <div className="flex flex-col lg:flex-row lg:items-stretch w-full gap-1">
            <div className="lg:w-[35%] lg:flex-shrink-0">
              <h3 className="text-xs font-bold text-center mb-1">ITDG Alert Breakup</h3>
              {violationAnalyticsLoading ? (
                <LoadingSpinner />
              ) : violationBreakupData.length > 0 ? (
                <ViolationPieChart data={violationBreakupData} />
              ) : (
                <NoDataDisplay message="No alert breakup data available" />
              )}
            </div>

            <div className="lg:w-[65%] lg:flex-grow">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-center flex-1">
                  {violationAnalyticsDrill} - ITDG Alert Heat Map
                </h3>
                <Button
                  onClick={handleDownloadHeatMap}
                  disabled={isDownloadingHeatMap || violationAnalyticsLoading || (Object.keys(zoneViolationData).length === 0 && violationBreakupData.length === 0)}
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                >
                  <Download className={`h-3 w-3 ${isDownloadingHeatMap ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {violationAnalyticsLoading ? (
                <LoadingSpinner />
              ) : Object.keys(zoneViolationData).length > 0 ? (
                <ZoneViolationHeatMap
                  data={zoneViolationData}
                  alertType={chartAlertType}
                  drillType={violationAnalyticsDrill}
                />
              ) : (
                <NoDataDisplay message="No heat map data available" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#f3f3f3] rounded-lg shadow-sm border space-y-0">
        <CardHeader className="border-b p-2"><div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2"><CardTitle className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">ITDG Alerts Trends Over Time</CardTitle><div className="flex flex-col sm:flex-row gap-2"><Select value={chartAlertType} onValueChange={setChartAlertType}><SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Alert Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Alerts</SelectItem><SelectItem value="blocked">Blocked</SelectItem><SelectItem value="auto_unblock">Auto Unblock</SelectItem><SelectItem value="manual_unblock">Manual Unblock</SelectItem><SelectItem value="acceptance_close">Accept & Block</SelectItem></SelectContent></Select><Select value={chartTimeGrain} onValueChange={setChartTimeGrain}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Time Grain" /></SelectTrigger><SelectContent><SelectItem value="daywise">Day wise</SelectItem><SelectItem value="monthwise">Month wise</SelectItem></SelectContent></Select></div></div></CardHeader>
        <CardContent className="p-1">
          {violationTrendsLoading ? (
            <LoadingSpinner />
          ) : violationTrendsData[chartTimeGrain].length > 0 ? (
            <ViolationTrendsChart data={violationTrendsData[chartTimeGrain]} timeGrain={chartTimeGrain} violationNames={VIOLATION_NAMES} violationKeys={VIOLATION_KEYS} colors={MATTE_COLORS} />
          ) : (
            <NoDataDisplay message="No trends data available" />
          )}
        </CardContent>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm border">
        {/* <CardHeader className="border-b p-2">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 w-full">
            {/* LEFT: Heading */}
        {/* <CardTitle className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-teal-600 bg-clip-text text-transparent">
              ITDG Alerts Details & Analysis
            </CardTitle> */}

        {/* RIGHT: Filters */}
        {/* <div className="flex flex-col lg:flex-row items-end lg:items-center gap-2">
              <Select value={detailsSelectedBu} onValueChange={setDetailsSelectedBu}>
                <SelectTrigger className="w-auto h-7 text-xs">
                  <SelectValue placeholder="Select BU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAS">SOD</SelectItem>
                  <SelectItem value="LPG">LPG</SelectItem>
                </SelectContent>
              </Select>

              <ZonePlantSelections
                zone={detailsSelectedZone}
                sapid={detailsSelectedPlant}
                onZoneChange={setDetailsSelectedZone}
                onPlantChange={handleDetailsPlantChange}
                bu={detailsSelectedBu}
                onAlertTypeChange={setDetailsChartAlertType}
                hideAlertType={true}
              />

              <EnhancedTimeFilter
                selectedFilter={detailsSelectedTimeFilter}
                onFilterChange={handleDetailsTimeFilterChange}
                isLoading={false}
                resetTrigger={0}
              />

              <Button
                onClick={handleDetailsRefresh}
                disabled={false}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white h-7"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader> */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 w-full mt-2 px-2">
          {/* LEFT: Heading */}
          <CardTitle className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-teal-600 bg-clip-text text-transparent">
            ITDG Alerts Details & Analysis
          </CardTitle>
        </div>
        <CardContent className="p-1">
          <Tabs
            value={activeViolationTab}
            onValueChange={setActiveViolationTab}
            className="w-full"
          >
            <div className="border-b">
              <TabsList className="h-auto py-1 w-full justify-start rounded-none bg-transparent px-2 gap-3">
                {violationTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex-1 flex items-center justify-center px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded-t-lg border-b-2 border-transparent data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
                  >
                    <div className="flex items-center gap-1">
                      <span>{tab.label}</span>
                      {/* <span className="bg-blue-100/60 text-current px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                        {tab.count}
          </span> */}
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* {violationTabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="m-0 p-2">
                <ViolationTabContent
                  violationType={tab.label}
                  totalAlerts={tab.count}
                  zones={ZONES}
                  plants={PLANTS}
                  selectedBu={detailsSelectedBu}
                  selectedZone={detailsSelectedZone || undefined}
                  selectedPlant={detailsSelectedPlant || undefined}
                  selectedTimeFilter={detailsSelectedTimeFilter}
                  dateRangeFilter={detailsDateRangeFilter}
                  chartTimeGrain={detailsChartTimeGrain as 'daywise' | 'monthwise'}
                />
              </TabsContent>
            ))} */}
            {violationTabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="m-0 p-2">
                <ViolationTabContent
                  violationType={tab.label}
                  totalAlerts={tab.count}
                  zones={ZONES}
                  plants={PLANTS}
                  selectedBu={selectedBu}
                  selectedZone={selectedZone || undefined}
                  selectedPlant={selectedPlant || undefined}
                  selectedTimeFilter={selectedTimeFilter}
                  dateRangeFilter={dateRangeFilter}
                  chartTimeGrain={chartTimeGrain as 'daywise' | 'monthwise'}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default VTSDashboard;