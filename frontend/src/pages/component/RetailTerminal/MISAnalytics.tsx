import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Card, CardContent } from '@/@/components/ui/card';
import { Input } from '@/@/components/ui/input';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import {
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  CircleAlert,
  Info,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  RefreshCw,
  Download,
  X
} from 'lucide-react';
import { Button } from '@/@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/@/components/ui/tabs';
import { Tooltip } from '@mui/material';
import AlertTrendsChart from './AlertTrendsChart';
import DataGrid from '../../../components/common/DataGrid';
import { apiClient } from '@/services/apiClient';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const createdAtIstDate = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE";

const getTimeFilterDateCondition = (filter: string | null): string => {
  if (!filter) return '';
  const map: Record<string, string> = {
    // t: "created_at::DATE = CURRENT_DATE",
    // '1d': "created_at::DATE = CURRENT_DATE - INTERVAL '1 DAY'",
    // '1w': "created_at::DATE >= CURRENT_DATE - INTERVAL '7 DAY'",
    // '15d': "created_at::DATE >= CURRENT_DATE - INTERVAL '15 DAY'",
    // '1m': "created_at::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'",
    // '3m': "created_at::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'"
    't': `${createdAtIstDate} = CURRENT_DATE`,
    '1d': `${createdAtIstDate} = CURRENT_DATE - INTERVAL '1 DAY'`,
    '1w': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '7 DAY'`,
    '15d': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '15 DAY'`,
    '1m': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '1 MONTH'`,
    '3m': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '3 MONTH'`
  };
  return map[filter] ?? '';
};

const buildMISQuery = (opts: {
  bu?: string | null;
  timeFilter?: string | null;
  dateRangeFilter?: { key: string; value: string } | null;
  zone?: string | null;
  plant?: string | null;
}): string => {
  const { bu, timeFilter, dateRangeFilter, zone, plant } = opts;
  const raw = (bu ?? 'SOD').trim() || 'SOD';
  const buValue = raw === 'SOD' ? 'TAS' : raw;
  const conditions: string[] = [`alert_section='VA' AND bu='${buValue.replace(/'/g, "''")}'`];

  if (zone && String(zone).trim()) {
    conditions.push(`zone='${String(zone).trim().replace(/'/g, "''")}'`);
  }
  if (plant && String(plant).trim()) {
    conditions.push(`sap_id='${String(plant).trim().replace(/'/g, "''")}'`);
  }
  if (dateRangeFilter?.value) {
    const [startDate, endDate] = dateRangeFilter.value.split(',').map((s) => s.trim());
    if (startDate && endDate) {
      // conditions.push(`created_at::DATE BETWEEN '${startDate}' AND '${endDate}'`);
      conditions.push(`${createdAtIstDate} BETWEEN '${startDate}' AND '${endDate}'`);
      return conditions.join(' AND ');
    }
  }
  if (timeFilter && getTimeFilterDateCondition(timeFilter)) {
    conditions.push(getTimeFilterDateCondition(timeFilter));
    return conditions.join(' AND ');
  }
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 3);
  const y = fromDate.getFullYear();
  const m = String(fromDate.getMonth() + 1).padStart(2, '0');
  const d = String(fromDate.getDate()).padStart(2, '0');
  const fromStr = `${y}-${m}-${d}`;
  // conditions.push(`created_at::DATE >= '${fromStr}'`);
  conditions.push(`${createdAtIstDate} >= '${fromStr}'`);
  return conditions.join(' AND ');
};

/** Open alerts table — same filters as dashboard + mark_as_false true (SOD → bu TAS). */
function buildOpenAlertsTableQuery(opts: {
  bu?: string | null;
  timeFilter?: string | null;
  dateRangeFilter?: { key: string; value: string } | null;
  zone?: string | null;
  plant?: string | null;
}): string {
  return `${buildMISQuery(opts)} AND mark_as_false='true'`;
}

const OPEN_ALERTS_TABLE_FIELDS = [
  'location_name',
  'sap_id',
  'device_name',
  'device_msg',
  'alert_status',
  'alert_state',
  'interlock_name',
  'severity',
  'created_at',
] as const;

function formatAlertDateTime(value: unknown): string {
  if (value == null || value === '') return '—';
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function setupMarkedFalseTableScroll(wrap: HTMLElement): () => void {
  const viewport = wrap.querySelector(
    '.mis-marked-false-grid .ag-center-cols-viewport'
  ) as HTMLElement | null;
  const headerViewport = wrap.querySelector(
    '.mis-marked-false-grid .ag-header-viewport'
  ) as HTMLElement | null;
  const horizScrollSlot = wrap.querySelector(
    '.mis-marked-false-grid .ag-body-horizontal-scroll'
  ) as HTMLElement | null;
  if (!viewport || !horizScrollSlot) return () => {};

  horizScrollSlot
    .querySelectorAll('.ag-body-horizontal-scroll-viewport, .ag-body-horizontal-scroll-container')
    .forEach((el) => {
      (el as HTMLElement).style.display = 'none';
    });

  horizScrollSlot.classList.remove('ag-scrollbar-invisible');
  horizScrollSlot.classList.add('ag-scrollbar-active');

  let mirror = horizScrollSlot.querySelector(
    '.mis-marked-false-scroll-mirror'
  ) as HTMLDivElement | null;
  const mirrorCreated = !mirror;
  if (!mirror) {
    mirror = document.createElement('div');
    mirror.className = 'mis-marked-false-scroll-mirror';
    mirror.setAttribute('aria-hidden', 'true');
    horizScrollSlot.appendChild(mirror);
  }

  let thumb = mirror.querySelector('.mis-marked-false-scroll-mirror-thumb') as HTMLDivElement | null;
  if (!thumb) {
    thumb = document.createElement('div');
    thumb.className = 'mis-marked-false-scroll-mirror-thumb';
    mirror.appendChild(thumb);
  }

  const TRACK_PAD = 0;

  const sync = () => {
    if (!thumb || !mirror) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    mirror.style.display = maxScroll <= 0 ? 'none' : 'block';
    horizScrollSlot.style.display = maxScroll <= 0 ? 'none' : 'flex';
    const trackWidth = Math.max(0, mirror.clientWidth - TRACK_PAD * 2);
    const thumbWidth =
      maxScroll <= 0
        ? trackWidth
        : Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
    const movable = Math.max(1, trackWidth - thumbWidth);
    const left = maxScroll <= 0 ? 0 : (viewport.scrollLeft / maxScroll) * movable;
    thumb.style.width = `${thumbWidth}px`;
    thumb.style.left = `${left + TRACK_PAD}px`;
  };

  const onViewportScroll = () => {
    if (headerViewport) headerViewport.scrollLeft = viewport.scrollLeft;
    sync();
  };

  const onTrackClick = (e: MouseEvent) => {
    if (!thumb || e.target === thumb) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    if (maxScroll <= 0) return;
    const rect = mirror.getBoundingClientRect();
    const trackWidth = Math.max(0, mirror.clientWidth - TRACK_PAD * 2);
    const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
    const movable = Math.max(1, trackWidth - thumbWidth);
    const x = e.clientX - rect.left - TRACK_PAD;
    const ratio = Math.max(0, Math.min(1, (x - thumbWidth / 2) / movable));
    viewport.scrollLeft = ratio * maxScroll;
    if (headerViewport) headerViewport.scrollLeft = viewport.scrollLeft;
    sync();
  };

  const onThumbMouseDown = (e: MouseEvent) => {
    if (!thumb) return;
    e.preventDefault();
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    if (maxScroll <= 0) return;
    const trackWidth = Math.max(0, mirror.clientWidth - TRACK_PAD * 2);
    const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
    const movable = Math.max(1, trackWidth - thumbWidth);
    const startX = e.clientX;
    const startScroll = viewport.scrollLeft;

    const onMove = (ev: MouseEvent) => {
      viewport.scrollLeft = Math.min(
        maxScroll,
        Math.max(0, startScroll + ((ev.clientX - startX) / movable) * maxScroll)
      );
      if (headerViewport) headerViewport.scrollLeft = viewport.scrollLeft;
      sync();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  viewport.addEventListener('scroll', onViewportScroll, { passive: true });
  mirror.addEventListener('click', onTrackClick);
  thumb.addEventListener('mousedown', onThumbMouseDown);

  const ro = new ResizeObserver(sync);
  ro.observe(viewport);
  ro.observe(mirror);
  ro.observe(horizScrollSlot);
  const centerContainer = wrap.querySelector('.mis-marked-false-grid .ag-center-cols-container');
  if (centerContainer) ro.observe(centerContainer);
  window.addEventListener('resize', sync);
  requestAnimationFrame(sync);

  return () => {
    viewport.removeEventListener('scroll', onViewportScroll);
    mirror.removeEventListener('click', onTrackClick);
    thumb?.removeEventListener('mousedown', onThumbMouseDown);
    ro.disconnect();
    window.removeEventListener('resize', sync);
    if (mirrorCreated && mirror.parentElement) {
      mirror.parentElement.removeChild(mirror);
    }
  };
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'JAN', '02': 'FEB', '03': 'MAR', '04': 'APR', '05': 'MAY', '06': 'JUN',
  '07': 'JUL', '08': 'AUG', '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DEC'
};

const MONTH_SHORT: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
};

/** Get start/end dates for the selected filter so Alert Trends use the same range as the data */
const getTrendDateRange = (
  timeFilter: string | null,
  dateRangeFilter?: { key: string; value: string } | null
): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (dateRangeFilter?.value) {
    const [startStr, endStr] = dateRangeFilter.value.split(',').map((s) => s.trim());
    if (startStr && endStr) {
      return { start: new Date(startStr), end: new Date(endStr) };
    }
  }
  const map: Record<string, { start: Date; end: Date }> = {
    t: { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end },
    '1d': (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) };
    })(),
    '1w': (() => { const d = new Date(now); d.setDate(d.getDate() - 6); return { start: d, end }; })(),
    '15d': (() => { const d = new Date(now); d.setDate(d.getDate() - 14); return { start: d, end }; })(),
    '1m': (() => { const d = new Date(now); d.setMonth(d.getMonth() - 1); return { start: d, end }; })(),
    '3m': (() => { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { start: d, end }; })()
  };
  const range = map[timeFilter ?? ''] ?? (() => { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { start: d, end }; })();
  return range;
};

/** All month keys (YYYY-MM) between start and end inclusive */
const getMonthKeysInRange = (start: Date, end: Date): string[] => {
  const keys: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
};

/** All day keys (YYYY-MM-DD) between start and end inclusive */
const getDayKeysInRange = (start: Date, end: Date): string[] => {
  const keys: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= endDay) {
    keys.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
};

/** Period buckets for Alert Trends: one row per bucket, label shown on Y-axis */
const getTrendPeriodBuckets = (
  timeFilter: string | null,
  dateRangeFilter?: { key: string; value: string } | null
): Array<{ key: string; label: string }> => {
  const range = getTrendDateRange(timeFilter ?? null, dateRangeFilter);
  const start = range.start;
  const end = range.end;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

  if (dateRangeFilter?.value) {
    if (diffDays <= 1) return [{ key: 'today', label: 'Today' }];
    if (diffDays <= 31) {
      return getDayKeysInRange(start, end).map((dayKey) => {
        const [, m, d] = dayKey.split('-');
        return { key: dayKey, label: `${parseInt(d, 10)} ${MONTH_SHORT[m] || m}` };
      });
    }
    return getMonthKeysInRange(start, end).map((monthKey) => {
      const [, m] = monthKey.split('-');
      return { key: monthKey, label: MONTH_LABELS[m] || m };
    });
  }

  switch (timeFilter) {
    case 't':
      return [{ key: 'today', label: 'Today' }];
    case '1d':
      return [{ key: 'yesterday', label: 'Yesterday' }];
    case '1w': {
      const dayKeys = getDayKeysInRange(start, end);
      return dayKeys.map((dayKey) => {
        const [, m, d] = dayKey.split('-');
        return { key: dayKey, label: `${parseInt(d, 10)} ${MONTH_SHORT[m] || m}` };
      });
    }
    case '15d': {
      const dayKeys = getDayKeysInRange(start, end);
      return dayKeys.map((dayKey) => {
        const [, m, d] = dayKey.split('-');
        return { key: dayKey, label: `${parseInt(d, 10)} ${MONTH_SHORT[m] || m}` };
      });
    }
    case '1m': {
      const dayKeys = getDayKeysInRange(start, end);
      return dayKeys.map((dayKey) => {
        const [, m, d] = dayKey.split('-');
        return { key: dayKey, label: `${parseInt(d, 10)} ${MONTH_SHORT[m] || m}` };
      });
    }
    case '3m':
      return getMonthKeysInRange(start, end).map((monthKey) => {
        const [, m] = monthKey.split('-');
        return { key: monthKey, label: MONTH_LABELS[m] || m };
      });
    default: {
      const monthKeys = getMonthKeysInRange(start, end);
      return monthKeys.map((monthKey) => {
        const [, m] = monthKey.split('-');
        return { key: monthKey, label: MONTH_LABELS[m] || m };
      });
    }
  }
};

/** Colors for Top High-Alert Plants (one per bar) */
const PLANT_BAR_COLORS = ['#5A9690'];

/** Base color for plant bars */
const PLANT_BAR_BASE = '#B153D7';

/** Gradient fills for Top High-Alert Plants: one color per row, each as a gradient */
const PLANT_BAR_GRADIENTS: Array<{ background: string }> = [
  { background: `linear-gradient(90deg, #d4a5e8 0%, ${PLANT_BAR_BASE} 100%)` },
  { background: `linear-gradient(90deg, ${PLANT_BAR_BASE} 0%, #8b2fa8 100%)` },
  { background: `linear-gradient(90deg, #c77ee0 0%, ${PLANT_BAR_BASE} 50%, #7b2c9a 100%)` },
  { background: `linear-gradient(90deg, #e8c8f0 0%, ${PLANT_BAR_BASE} 100%)` },
  { background: `linear-gradient(90deg, ${PLANT_BAR_BASE} 0%, #5a1f6e 100%)` }
];

interface AlertRecord {
  id?: string;
  created_at?: string;
  closed_at?: string | null;
  interlock_name?: string;
  violation_type?: string;
  sop_code?: string;
  sop_description?: string;
  severity?: string;
  location_name?: string;
  zone?: string;
  sap_id?: string;
  last_escalated_to?: string[] | unknown[];
  alert_status?: string;
  alert_state?: string;
  bu?: string;
  unique_id?: string;
  device_id?: string;
  device_name?: string;
  device_msg?: string;
}

const getViolationLabel = (a: AlertRecord): string => {
  const code = (a.sop_code || '').trim();
  const desc = (a.sop_description || a.violation_type || a.interlock_name || '').trim();
  if (code && desc) return `${code}: ${desc}`;
  if (code) return code;
  if (desc) return desc;
  return (a.interlock_name || 'Other').trim() || 'Other';
};

function buildViolationFrequencyFromAlerts(
  data: AlertRecord[]
): Array<{ label: string; count: number; byPlant: Array<{ plantName: string; zone: string; count: number }> }> {
  const interlockCounts: Record<string, number> = {};
  const violationLabelByKey: Record<string, string> = {};
  const interlockPlantCounts: Record<string, Record<string, { zone: string; count: number }>> = {};
  data.forEach((a) => {
    const name = (a.interlock_name || 'Other').trim() || 'Other';
    interlockCounts[name] = (interlockCounts[name] || 0) + 1;
    if (!violationLabelByKey[name]) violationLabelByKey[name] = getViolationLabel(a);
    const plantKey = (a.location_name || a.sap_id || 'Unknown').trim() || 'Unknown';
    const zone = (a.zone || '—').trim() || '—';
    if (!interlockPlantCounts[name]) interlockPlantCounts[name] = {};
    if (!interlockPlantCounts[name][plantKey]) interlockPlantCounts[name][plantKey] = { zone, count: 0 };
    interlockPlantCounts[name][plantKey].count += 1;
  });
  return Object.entries(interlockCounts)
    .map(([key, count]) => {
      const byPlant = interlockPlantCounts[key]
        ? Object.entries(interlockPlantCounts[key])
            .map(([plantName, { zone, count: c }]) => ({ plantName, zone, count: c }))
            .sort((a, b) => b.count - a.count)
        : [];
      return { label: violationLabelByKey[key] || key, count, byPlant };
    })
    .sort((a, b) => b.count - a.count);
}

interface MISAnalyticsState {
  totalOpen: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  escalationRate: number;
  escalationTrend: string | null;
  vsLastMonth: number | null;
  monthlyTrends: Array<Record<string, string | number>>;
  topPlants: Array<{ rank: number; name: string; zone: string; count: number }>;
  violationFrequency: Array<{
    label: string;
    count: number;
    byPlant: Array<{ plantName: string; zone: string; count: number }>;
  }>;
  alerts: AlertRecord[];
  isLoading: boolean;
  error: string | null;
}

export interface MISAnalyticsProps {
  bu?: string | null;
  timeFilter?: string | null;
  dateRangeFilter?: { key: string; value: string } | null;
  zone?: string | null;
  plant?: string | null;
  refreshKey?: number;
}

const MISAnalytics: React.FC<MISAnalyticsProps> = ({
  bu = 'SOD',
  timeFilter = null,
  dateRangeFilter = null,
  zone = null,
  plant = null,
  refreshKey: externalRefreshKey = 0
}) => {
  const plantsChartRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MISAnalyticsState>({
    totalOpen: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    escalationRate: 0,
    escalationTrend: null,
    vsLastMonth: null,
    monthlyTrends: [],
    topPlants: [],
    violationFrequency: [],
    alerts: [],
    isLoading: true,
    error: null
  });
  const [violationTableSearch, setViolationTableSearch] = useState('');
  const [openAlertsSearch, setOpenAlertsSearch] = useState('');
  const [openAlerts, setOpenAlerts] = useState<AlertRecord[]>([]);
  const [openAlertsLoading, setOpenAlertsLoading] = useState(true);
  const markedFalseGridWrapRef = useRef<HTMLDivElement>(null);
  const markedFalseScrollCleanupRef = useRef<(() => void) | null>(null);
  type SeverityTab = 'all' | 'critical' | 'high' | 'medium' | 'low';
  const [severityTab, setSeverityTab] = useState<SeverityTab>('all');

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setState((s) => ({
          ...s,
          isLoading: true,
          error: null,
          monthlyTrends: [],
          topPlants: [],
          violationFrequency: [],
          alerts: []
        }));

        const query = buildMISQuery({ bu, timeFilter, dateRangeFilter, zone, plant });

        const fields = [
          'location_name',
          'alert_status',
          'alert_state',
          'bu',
          'unique_id',
          'interlock_name',
          'device_id',
          'zone',
          'severity',
      'created_at',
        //   'id',
        //   'closed_at',
        //   'sap_id',
        //   'last_escalated_to',
        //   'sop_code',
        //   'sop_description',
        //   'violation_type'
        ];

        const response = await apiClient.get('/api/alerts', {
          params: {
            q: query,
            fields: JSON.stringify(fields),
            skip: 0,
            limit: 2000,
            sort: JSON.stringify({ created_at: 'desc' })
          }
        });

        if (cancelled) return;

        const resData = response?.data;
        const data: AlertRecord[] = Array.isArray(resData?.data) ? resData.data : [];
        // Use count from API for Total Alerts card (current batch size)
        const count =
          typeof resData?.count === 'number'
            ? resData.count
            : data.length;
        const total = typeof resData?.total === 'number' ? resData.total : count;

        const criticalCount = data.filter(
          (a) => (a.severity || '').toLowerCase() === 'critical'
        ).length;
        const highCount = data.filter(
          (a) => (a.severity || '').toLowerCase() === 'high'
        ).length;
        const mediumCount = data.filter(
          (a) => (a.severity || '').toLowerCase() === 'medium'
        ).length;
        const lowCount = data.filter(
          (a) => (a.severity || '').toLowerCase() === 'low'
        ).length;

        const escalatedCount = data.filter(
          (a) =>
            Array.isArray(a.last_escalated_to) && (a.last_escalated_to as unknown[]).length > 0
        ).length;
        const escalationRate = total > 0 ? (escalatedCount / total) * 100 : 0;

        const interlockCounts: Record<string, number> = {};
        const violationLabelByKey: Record<string, string> = {};
        const monthInterlock: Record<string, Record<string, number>> = {};
        const plantCounts: Record<string, { zone: string; count: number }> = {};
        const interlockPlantCounts: Record<string, Record<string, { zone: string; count: number }>> = {};

        const trendRange = getTrendDateRange(timeFilter ?? null, dateRangeFilter);
        const trendStart = trendRange.start.getTime();
        const trendEnd = trendRange.end.getTime();
        const periodBuckets = getTrendPeriodBuckets(timeFilter ?? null, dateRangeFilter);

        const getBucketKey = (created: Date): string | null => {
          const t = created.getTime();
          if (t < trendStart || t > trendEnd) return null;
          if (periodBuckets.length === 1) return periodBuckets[0].key;
          const first = periodBuckets[0];
          if (first.key.length === 10) {
            return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
          }
          return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        };

        data.forEach((a) => {
          const name = (a.interlock_name || 'Other').trim() || 'Other';
          interlockCounts[name] = (interlockCounts[name] || 0) + 1;
          if (!violationLabelByKey[name]) violationLabelByKey[name] = getViolationLabel(a);

          const plantKey = (a.location_name || a.sap_id || 'Unknown').trim() || 'Unknown';
          const zone = (a.zone || '—').trim() || '—';
          if (!interlockPlantCounts[name]) interlockPlantCounts[name] = {};
          if (!interlockPlantCounts[name][plantKey]) interlockPlantCounts[name][plantKey] = { zone, count: 0 };
          interlockPlantCounts[name][plantKey].count += 1;

          const created = a.created_at ? new Date(a.created_at) : null;
          if (created) {
            const bucketKey = getBucketKey(created);
            if (bucketKey != null) {
              if (!monthInterlock[bucketKey]) monthInterlock[bucketKey] = {};
              monthInterlock[bucketKey][name] = (monthInterlock[bucketKey][name] || 0) + 1;
            }
          }

          if (!plantCounts[plantKey]) plantCounts[plantKey] = { zone, count: 0 };
          plantCounts[plantKey].count += 1;
        });

        const sortedInterlocks = Object.entries(interlockCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name);

        const monthlyTrends = periodBuckets.map(({ key, label }) => {
          const row: Record<string, string | number> = { month: label };
          sortedInterlocks.forEach((name) => {
            row[name] = monthInterlock[key]?.[name] ?? 0;
          });
          return row;
        });

        const topPlants = Object.entries(plantCounts)
          .map(([name, { zone, count }]) => ({ name, zone, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((p, i) => ({ rank: i + 1, ...p }));

        const violationFrequency = Object.entries(interlockCounts)
          .map(([key, count]) => {
            const byPlant = interlockPlantCounts[key]
              ? Object.entries(interlockPlantCounts[key])
                  .map(([plantName, { zone, count: c }]) => ({ plantName, zone, count: c }))
                  .sort((a, b) => b.count - a.count)
              : [];
            return { label: violationLabelByKey[key] || key, count, byPlant };
          })
          .sort((a, b) => b.count - a.count);

        setState({
          totalOpen: count,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          escalationRate,
          escalationTrend: null,
          vsLastMonth: null,
          monthlyTrends,
          topPlants,
          violationFrequency,
          alerts: data,
          isLoading: false,
          error: null
        });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: 'Failed to load MIS analytics'
          }));
        }
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [bu, timeFilter, dateRangeFilter, zone, plant, externalRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    const fetchOpenAlerts = async () => {
      setOpenAlertsLoading(true);
      try {
        const q = buildOpenAlertsTableQuery({ bu, timeFilter, dateRangeFilter, zone, plant });
        const response = await apiClient.get('/api/alerts', {
          params: {
            q,
            skip: 0,
            limit: 2000,
            fields: JSON.stringify([...OPEN_ALERTS_TABLE_FIELDS]),
            sort: JSON.stringify({ created_at: 'desc' }),
          },
        });
        if (cancelled) return;
        const resData = response?.data;
        const rows: AlertRecord[] = Array.isArray(resData?.data) ? resData.data : [];
        setOpenAlerts(rows);
      } catch {
        if (!cancelled) setOpenAlerts([]);
      } finally {
        if (!cancelled) setOpenAlertsLoading(false);
      }
    };

    void fetchOpenAlerts();
    return () => { cancelled = true; };
  }, [bu, timeFilter, dateRangeFilter, zone, plant, externalRefreshKey]);

  useEffect(() => {
    if (openAlertsLoading || openAlerts.length === 0) return;

    let disposed = false;

    const trySetup = (attempt = 0) => {
      if (disposed) return;
      const wrap = markedFalseGridWrapRef.current;
      const horizScrollSlot = wrap?.querySelector(
        '.mis-marked-false-grid .ag-body-horizontal-scroll'
      ) as HTMLElement | null;
      if (!wrap || !horizScrollSlot) {
        if (attempt < 30) window.setTimeout(() => trySetup(attempt + 1), 50);
        return;
      }
      markedFalseScrollCleanupRef.current?.();
      markedFalseScrollCleanupRef.current = setupMarkedFalseTableScroll(wrap);
    };

    trySetup();
    return () => {
      disposed = true;
      markedFalseScrollCleanupRef.current?.();
      markedFalseScrollCleanupRef.current = null;
    };
  }, [openAlertsLoading, openAlerts, openAlertsSearch]);

  useLayoutEffect(() => {
    if (state.isLoading || !plantsChartRef.current || !state.topPlants.length) return;
    const descending = [...state.topPlants].sort((a, b) => b.count - a.count);
    const data = [...descending].reverse().map((p, i) => ({ plant: p.name, count: p.count, colorIndex: i }));

    const root = am5.Root.new(plantsChartRef.current);
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        layout: root.verticalLayout,
        paddingTop: 8,
        paddingRight: 8,
        paddingBottom: 8,
        paddingLeft: 8
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {})
      })
    );
    xAxis.get('renderer').labels.template.setAll({ fontSize: 10 });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'plant',
        renderer: am5xy.AxisRendererY.new(root, { minGridDistance: 20 })
      })
    );
    yAxis.get('renderer').labels.template.setAll({ maxWidth: 120, fontSize: 10 });
    yAxis.data.setAll(data);

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueXField: 'count',
        categoryYField: 'plant',
        fill: am5.color(PLANT_BAR_COLORS[0]),
        stroke: am5.color(PLANT_BAR_COLORS[0]),
        tooltip: am5.Tooltip.new(root, { forceHidden: true })
      })
    );
    series.columns.template.adapters.add('fill', (_, target) => {
      const ctx = (target as unknown as { dataItem?: { dataContext?: { colorIndex?: number } } }).dataItem?.dataContext;
      const idx = ctx?.colorIndex ?? 0;
      return am5.color(PLANT_BAR_COLORS[idx % PLANT_BAR_COLORS.length]);
    });
    series.columns.template.adapters.add('stroke', (_, target) => {
      const ctx = (target as unknown as { dataItem?: { dataContext?: { colorIndex?: number } } }).dataItem?.dataContext;
      const idx = ctx?.colorIndex ?? 0;
      return am5.color(PLANT_BAR_COLORS[idx % PLANT_BAR_COLORS.length]);
    });
    series.bullets.push(() =>
      am5.Bullet.new(root, {
        locationX: 1,
        locationY: 0.5,
        sprite: am5.Label.new(root, {
          text: '{valueX}',
          populateText: true,
          centerX: am5.p0,
          centerY: am5.p50,
          paddingLeft: 8,
          fontSize: 11,
          fontWeight: '500',
          fill: am5.color(0x374151)
        })
      })
    );
    series.data.setAll(data);
    series.appear();

    chart.set('cursor', am5xy.XYCursor.new(root, {}));

    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [state.isLoading, state.topPlants]);

  const handleDownloadViolationExcel = async () => {
    try {
      const query = buildMISQuery({ bu, timeFilter, dateRangeFilter, zone, plant });
      const response = await apiClient.get('/api/alerts', {
        params: {
          q: query,
          skip: 0,
          limit: 2000,
          sort: JSON.stringify({ created_at: 'desc' })
        }
      });
      const resData = response?.data;
      const data: AlertRecord[] = Array.isArray(resData?.data) ? resData.data : [];
      if (data.length === 0) return;

      const severityFilter = severityTab === 'all' ? null : severityTab;
      const filteredAlerts = severityFilter
        ? data.filter(
            (a) => (a.severity || '').toLowerCase() === severityFilter
          )
        : data;

      const violationFrequency = buildViolationFrequencyFromAlerts(filteredAlerts);
      if (violationFrequency.length === 0) return;

      const violationTypes = violationFrequency.map((v) => v.label);
      const plantMap = new Map<string, string>();
      violationFrequency.forEach((v) => {
        v.byPlant?.forEach((p) => {
          if (!plantMap.has(p.plantName)) plantMap.set(p.plantName, p.zone);
        });
      });
      const plants = Array.from(plantMap.entries())
        .map(([name, zone]) => ({ name, zone }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const getCount = (plantName: string, violationLabel: string): number => {
        const v = violationFrequency.find((x) => x.label === violationLabel);
        const p = v?.byPlant?.find((x) => x.plantName === plantName);
        return p?.count ?? 0;
      };
      const rowData = plants.map((plant) => {
        const plantDisplay = plant.zone !== '—' ? `${plant.name} (${plant.zone})` : plant.name;
        const row: Record<string, string | number> = { plant: plantDisplay };
        violationTypes.forEach((vt, i) => {
          row[`vt_${i}`] = getCount(plant.name, vt);
        });
        return row;
      });

      const searchLower = violationTableSearch.trim().toLowerCase();
      const filteredRowData = searchLower
        ? rowData.filter((row) =>
            Object.values(row).some((val) =>
              String(val ?? '').toLowerCase().includes(searchLower)
            )
          )
        : rowData;

      const excelData = filteredRowData.map((row) => {
        const out: Record<string, string | number> = { 'Plant/Location Name': row.plant as string };
        violationTypes.forEach((vt, i) => {
          out[vt] = (row[`vt_${i}`] ?? 0) as number;
        });
        return out;
      });
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Violation Type Frequency');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      XLSX.writeFile(workbook, `Violation_Type_Frequency_${timestamp}.xlsx`);
    } catch {
      // silent fail or could set error state
    }
  };

  const handleDownloadMarkedAsFalseExcel = () => {
    try {
      const searchLower = openAlertsSearch.trim().toLowerCase();
      const filteredRows = searchLower
        ? openAlerts.filter((row) =>
            OPEN_ALERTS_TABLE_FIELDS.some((field) =>
              String(row[field as keyof AlertRecord] ?? '')
                .toLowerCase()
                .includes(searchLower)
            )
          )
        : openAlerts;

      if (filteredRows.length === 0) return;

      const excelData = filteredRows.map((row) => ({
        'Location Name': row.location_name ?? '',
        'SAP ID': row.sap_id ?? '',
        'Device Name': row.device_name ?? '',
        'Device Message': row.device_msg ?? '',
        'Alert Status': row.alert_status ?? '',
        'Alert State': row.alert_state ?? '',
        'Interlock Name': row.interlock_name ?? '',
        Severity: row.severity ?? '',
        'Created At': row.created_at ?? '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Marked as False');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      XLSX.writeFile(workbook, `Marked_as_False_Records_${timestamp}.xlsx`);
    } catch {
      // silent fail
    }
  };

  if (state.error) {
    return (
      <div className="text-center text-gray-500 py-8">
        {state.error}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-1">
      {/* KPI Cards - always show titles, loading icon inside when loading */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="relative bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-500 font-medium">Total Alerts</span>
              <div className="flex items-center gap-2">
                {state.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                ) : (
                  <>
                    <span className="text-xl font-bold text-gray-900">{state.totalOpen.toLocaleString()}</span>
                    {state.vsLastMonth != null && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${state.vsLastMonth >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {state.vsLastMonth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {state.vsLastMonth}%
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="relative bg-white border border-gray-200 border-l-4 border-l-red-500 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-500 font-medium">Critical Violations</span>
              <div className="flex items-center gap-2">
                {state.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-red-500" /> : <span className="text-xl font-bold text-red-600">{state.criticalCount}</span>}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-100">
              <AlertOctagon className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="relative bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-500 font-medium">High Violations</span>
              <div className="flex items-center gap-2">
                {state.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> : <span className="text-xl font-bold text-amber-600">{state.highCount}</span>}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="relative bg-white border border-gray-200 border-l-4 border-l-yellow-500 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-500 font-medium">Medium Violations</span>
              <div className="flex items-center gap-2">
                {state.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-yellow-500" /> : <span className="text-xl font-bold text-yellow-600">{state.mediumCount}</span>}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-yellow-100">
              <CircleAlert className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="relative bg-white border border-gray-200 border-l-4 border-l-slate-500 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-500 font-medium">Low Violations</span>
              <div className="flex items-center gap-2">
                {state.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : <span className="text-xl font-bold text-slate-600">{state.lowCount}</span>}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100">
              <Info className="w-5 h-5 text-slate-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts row - always show card titles, loading icon inside when loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Card className="rounded-lg shadow-sm border border-gray-200 bg-white">
          <CardContent className="p-2">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-800">Alert Trends</h3>
            </div>
            {state.isLoading ? (
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : state.monthlyTrends.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                No trend data
              </div>
            ) : (
              <AlertTrendsChart monthlyTrends={state.monthlyTrends} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-sm border border-gray-200">
          <CardContent className="p-2">
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800">Top 5  High-Alert Plants</h3>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
                <Info className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                <span>Total, Open and Close alert count</span>
              </div>
            </div>
            {state.isLoading ? (
              <div className="h-[280px] flex items-center justify-center bg-gray-50 rounded">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : state.topPlants.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                No plant data
              </div>
            ) : (
              <div ref={plantsChartRef} className="w-full" style={{ height: 280 }} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Violation type frequency table with severity tabs */}
      <Card className="rounded-lg shadow-sm border border-gray-200 mt-2">
        <CardContent className="p-2">
          <Tabs value={severityTab} onValueChange={(v) => setSeverityTab(v as SeverityTab)}>
            <TabsList className="flex w-full justify-start border-b border-gray-200 rounded-none bg-transparent p-0 h-auto gap-0 mb-2">
              <TabsTrigger
                value="all"
                className="relative rounded-none border-0 bg-transparent px-4 py-2 text-sm font-medium text-gray-600 shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:text-blue-500 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                All
                {severityTab === 'all' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="critical"
                className="relative rounded-none border-0 bg-transparent px-4 py-2 text-sm font-medium text-gray-600 shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:text-blue-500 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Critical
                {severityTab === 'critical' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="high"
                className="relative rounded-none border-0 bg-transparent px-4 py-2 text-sm font-medium text-gray-600 shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:text-blue-500 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                High
                {severityTab === 'high' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="medium"
                className="relative rounded-none border-0 bg-transparent px-4 py-2 text-sm font-medium text-gray-600 shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:text-blue-500 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Medium
                {severityTab === 'medium' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="low"
                className="relative rounded-none border-0 bg-transparent px-4 py-2 text-sm font-medium text-gray-600 shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:text-blue-500 data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Low
                {severityTab === 'low' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value={severityTab} className="mt-2">
              <div className="flex items-center gap-2 mb-2 w-full">
                <div className="relative w-full">
                  <Input
                    type="text"
                    placeholder="Search ..."
                    value={violationTableSearch}
                    onChange={(e) => setViolationTableSearch(e.target.value)}
                    className="w-full h-9 pr-9"
                    disabled={state.isLoading}
                  />
                  {violationTableSearch && (
                    <button
                      type="button"
                      onClick={() => setViolationTableSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Tooltip title="Download">
                  <span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={handleDownloadViolationExcel}
                      disabled={state.isLoading}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </span>
                </Tooltip>
              </div>
              {state.isLoading ? (
                <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (() => {
                const severityFilter = severityTab === 'all' ? null : severityTab;
                const sourceAlerts = severityFilter
                  ? state.alerts.filter(
                      (a) => (a.severity || '').toLowerCase() === severityFilter
                    )
                  : state.alerts;

                const violationFrequency = buildViolationFrequencyFromAlerts(sourceAlerts);

                if (violationFrequency.length === 0) {
                  return (
                    <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                      No violation data
                      {severityFilter ? ` for severity "${severityFilter}"` : ''}
                    </div>
                  );
                }

                const violationTypes = violationFrequency.map((v) => v.label);
                const plantMap = new Map<string, string>();
                violationFrequency.forEach((v) => {
                  v.byPlant?.forEach((p) => {
                    if (!plantMap.has(p.plantName)) plantMap.set(p.plantName, p.zone);
                  });
                });
                const plants = Array.from(plantMap.entries())
                  .map(([name, zone]) => ({ name, zone }))
                  .sort((a, b) => a.name.localeCompare(b.name));

                const getCount = (plantName: string, violationLabel: string): number => {
                  const v = violationFrequency.find((x) => x.label === violationLabel);
                  const p = v?.byPlant?.find((x) => x.plantName === plantName);
                  return p?.count ?? 0;
                };

                const columnDefs = [
                  {
                    field: 'plant',
                    headerName: 'Plant/Location Name',
                    headerTooltip: 'Plant/Location Name',
                    minWidth: 160,
                    flex: 1
                  },
                  ...violationTypes.map((vt, i) => ({
                    field: `vt_${i}`,
                    headerName: vt,
                    headerTooltip: vt,
                    minWidth: 80,
                    flex: 1,
                    sort: i === 0 ? ('desc' as const) : undefined,
                    valueFormatter: (params: { value?: number }) =>
                      (params.value ?? 0).toLocaleString(),
                    cellClass: 'mis-violation-cell-center'
                  }))
                ];

                const rowData = plants.map((plant) => {
                  const plantDisplay =
                    plant.zone !== '—' ? `${plant.name} (${plant.zone})` : plant.name;
                  const row: Record<string, string | number> = { plant: plantDisplay };
                  violationTypes.forEach((vt, i) => {
                    row[`vt_${i}`] = getCount(plant.name, vt);
                  });
                  return row;
                });

                const searchLower = violationTableSearch.trim().toLowerCase();
                const filteredRowData = searchLower
                  ? rowData.filter((row) =>
                      Object.values(row).some((val) =>
                        String(val ?? '').toLowerCase().includes(searchLower)
                      )
                    )
                  : rowData;

                return (
                  <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell]:!px-2 [&_.ag-header-cell]:!py-1 [&_.ag-cell]:!px-2 [&_.ag-cell]:!py-1 [&_.mis-violation-cell-center]:!text-center">
                    <DataGrid
                      key={severityTab}
                      columnDefs={columnDefs}
                      rowData={filteredRowData}
                      rowModelType="clientSide"
                      height="400px"
                      width="100%"
                      pagination={true}
                      paginationPageSize={20}
                      rowSelection={undefined}
                      defaultColDef={{
                        sortable: true,
                        resizable: true,
                        filter: false,
                        suppressMenu: true,
                        cellStyle: { padding: '2px 8px', textAlign: 'center' }
                      }}
                    />
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Marked as false records table */}
      <Card className="rounded-lg shadow-sm border border-gray-200 mt-2">
        <CardContent className="p-2">
          <h3 className="mb-2 font-semibold text-gray-800">Marked as False Records</h3>
          <div className="mb-2 flex w-full items-center gap-2">
            <div className="relative w-full">
              <Input
                type="text"
                placeholder="Search ..."
                value={openAlertsSearch}
                onChange={(e) => setOpenAlertsSearch(e.target.value)}
                className="h-9 w-full pr-9"
                disabled={openAlertsLoading}
              />
              {openAlertsSearch && (
                <button
                  type="button"
                  onClick={() => setOpenAlertsSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Tooltip title="Download">
              <span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleDownloadMarkedAsFalseExcel}
                  disabled={openAlertsLoading || openAlerts.length === 0}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </span>
            </Tooltip>
          </div>
          {openAlertsLoading ? (
            <div className="flex h-[400px] items-center justify-center rounded bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : openAlerts.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-500">
              No marked as false records
            </div>
          ) : (
            (() => {
              const searchLower = openAlertsSearch.trim().toLowerCase();
              const filteredRows = searchLower
                ? openAlerts.filter((row) =>
                    OPEN_ALERTS_TABLE_FIELDS.some((field) =>
                      String(row[field as keyof AlertRecord] ?? '')
                        .toLowerCase()
                        .includes(searchLower)
                    )
                  )
                : openAlerts;

              const columnDefs = [
                {
                  field: 'location_name',
                  headerName: 'Location Name',
                  headerTooltip: 'Location Name',
                  width: 160,
                  minWidth: 160,
                  flex: 0,
                  suppressSizeToFit: true,
                },
                {
                  field: 'sap_id',
                  headerName: 'SAP ID',
                  headerTooltip: 'SAP ID',
                  width: 110,
                  minWidth: 110,
                  flex: 0,
                  suppressSizeToFit: true,
                },
                {
                  field: 'device_name',
                  headerName: 'Device Name',
                  headerTooltip: 'Device Name',
                  width: 140,
                  minWidth: 140,
                  flex: 0,
                  suppressSizeToFit: true,
                },
                {
                  field: 'device_msg',
                  headerName: 'Device Message',
                  headerTooltip: 'Device Message',
                  width: 220,
                  minWidth: 220,
                  flex: 0,
                  suppressSizeToFit: true,
                },
                {
                  field: 'alert_status',
                  headerName: 'Alert Status',
                  headerTooltip: 'Alert Status',
                  width: 120,
                  minWidth: 120,
                  flex: 0,
                  suppressSizeToFit: true,
                },
                {
                  field: 'alert_state',
                  headerName: 'Alert State',
                  headerTooltip: 'Alert State',
                  width: 120,
                  minWidth: 120,
                  flex: 0,
                  suppressSizeToFit: true,
                },
                {
                  field: 'interlock_name',
                  headerName: 'Interlock Name',
                  headerTooltip: 'Interlock Name',
                  width: 160,
                  minWidth: 160,
                  flex: 0,
                  suppressSizeToFit: true,
                },
                {
                  field: 'severity',
                  headerName: 'Severity',
                  headerTooltip: 'Severity',
                  width: 100,
                  minWidth: 100,
                  flex: 0,
                  suppressSizeToFit: true,
                },
                // {
                //   field: 'created_at',
                //   headerName: 'Created At',
                //   headerTooltip: 'Created At',
                //   width: 240,
                //   minWidth: 240,
                //   flex: 0,
                //   suppressSizeToFit: true,
                // },
{
  field: 'created_at',
  headerName: 'Created At',
  headerTooltip: 'Created At',
  width: 240,
  minWidth: 240,
  flex: 0,
  suppressSizeToFit: true,
  sortable: true,
  filter: true,
  cellRenderer: (params: any) => {
    if (!params.value) return '';

    const date = dayjs.utc(params.value).tz('Asia/Kolkata');
    const formatted = date.format('MMM D, YYYY, hh:mm A');

    return (
      <span className="text-sm text-gray-900">
        {formatted}
      </span>
    );
  },
}
              ];

              return (
                <div
                  ref={markedFalseGridWrapRef}
                  className="mis-marked-false-visible-scroll overflow-hidden rounded border border-gray-200 [&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell]:!px-2 [&_.ag-header-cell]:!py-1 [&_.ag-cell]:!px-2 [&_.ag-cell]:!py-1"
                >
                  <style>{`
                    .mis-marked-false-grid.ag-theme-alpine .ag-body-horizontal-scroll,
                    .mis-marked-false-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible,
                    .mis-marked-false-grid.ag-theme-alpine .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                      opacity: 1 !important;
                      visibility: visible !important;
                      display: flex !important;
                      position: relative !important;
                      bottom: auto !important;
                      min-height: 10px !important;
                      height: 10px !important;
                      width: 100% !important;
                      transition: none !important;
                      flex-shrink: 0 !important;
                      align-items: stretch !important;
                      padding: 0 8px 2px !important;
                      box-sizing: border-box !important;
                      background: #fff !important;
                      border-top: 1px solid #e5e7eb !important;
                    }
                    .mis-marked-false-grid.ag-theme-alpine .ag-center-cols-viewport,
                    .mis-marked-false-grid.ag-theme-alpine .ag-header-viewport {
                      overflow-x: auto !important;
                      scrollbar-width: none !important;
                      -ms-overflow-style: none !important;
                    }
                    .mis-marked-false-grid.ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar,
                    .mis-marked-false-grid.ag-theme-alpine .ag-header-viewport::-webkit-scrollbar {
                      display: none !important;
                      height: 0 !important;
                    }
                    .mis-marked-false-grid.ag-theme-alpine .ag-center-cols-container {
                      min-width: max-content !important;
                    }
                    .mis-marked-false-grid.ag-theme-alpine .mis-marked-false-scroll-mirror {
                      position: relative;
                      flex: 1;
                      width: 100%;
                      height: 7px;
                      margin: 0;
                      padding: 0;
                      background: transparent;
                      cursor: pointer;
                      user-select: none;
                      box-sizing: border-box;
                    }
                    .mis-marked-false-grid.ag-theme-alpine .mis-marked-false-scroll-mirror::before {
                      content: '';
                      position: absolute;
                      left: 0;
                      right: 0;
                      top: 0;
                      bottom: 0;
                      background: #e2e8f0;
                      border-radius: 6px;
                    }
                    .mis-marked-false-grid.ag-theme-alpine .mis-marked-false-scroll-mirror-thumb {
                      position: absolute;
                      top: 0;
                      bottom: 0;
                      left: 0;
                      min-width: 40px;
                      background: #64748b;
                      border-radius: 4px;
                      cursor: grab;
                      z-index: 1;
                    }
                    .mis-marked-false-grid.ag-theme-alpine .mis-marked-false-scroll-mirror-thumb:active {
                      cursor: grabbing;
                    }
                  `}</style>
                  <DataGrid
                    className="mis-marked-false-grid"
                    columnDefs={columnDefs}
                    rowData={filteredRows}
                    rowModelType="clientSide"
                    height="400px"
                    width="100%"
                    pagination={true}
                    paginationPageSize={20}
                    rowSelection={undefined}
                    suppressSizeColumnsToFit={true}
                    onGridReady={(params) => {
                      const applyScroll = () => {
                        const wrap = markedFalseGridWrapRef.current;
                        if (!wrap) return;
                        markedFalseScrollCleanupRef.current?.();
                        markedFalseScrollCleanupRef.current = setupMarkedFalseTableScroll(wrap);
                      };
                      applyScroll();
                      params.api.addEventListener('firstDataRendered', applyScroll);
                      params.api.addEventListener('gridSizeChanged', applyScroll);
                    }}
                    gridOptions={{
                      alwaysShowHorizontalScroll: true,
                      autoSizeStrategy: undefined,
                    }}
                    defaultColDef={{
                      sortable: true,
                      resizable: true,
                      filter: false,
                      suppressMenu: true,
                      flex: 0,
                      suppressSizeToFit: true,
                      cellStyle: { padding: '2px 8px' },
                    }}
                  />
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MISAnalytics;
