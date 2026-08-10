
import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Map as MapIcon, MapPin, ChevronUp, ChevronRight, Check, Sun, Satellite, Mountain, Globe, Layers, Search, X, AlertTriangle, Building2, Radio, Info } from 'lucide-react';
import { apiClient } from "@/services/apiClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";

const GOOGLE_MAPS_API_KEY = 'AIzaSyDfMVbeSC78K1l78ZCsccs0WENDG6brfVc';
const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&region=IN&libraries=geometry&loading=async`;

type MapViewStyle = 'light' | 'hybrid' | 'satellite' | 'terrain' | 'streets' | 'topo';
const MAP_VIEW_STYLES: {
  id: MapViewStyle;
  label: string;
  description: string;
  mapTypeId: 'roadmap' | 'satellite' | 'terrain' | 'hybrid';
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'light',     label: 'Light',     description: 'Clean minimal basemap',   mapTypeId: 'roadmap',   Icon: Sun },
  { id: 'hybrid',    label: 'Hybrid',    description: 'Satellite with labels',   mapTypeId: 'hybrid',    Icon: Layers },
  { id: 'satellite', label: 'Satellite', description: 'Satellite imagery',       mapTypeId: 'satellite', Icon: Satellite },
  { id: 'terrain',   label: 'Terrain',   description: 'Terrain and elevation',   mapTypeId: 'terrain',   Icon: Mountain },
  { id: 'streets',   label: 'Streets',   description: 'Street map',              mapTypeId: 'roadmap',   Icon: MapIcon },
  { id: 'topo',      label: 'Topo',      description: 'Topographic map',         mapTypeId: 'terrain',   Icon: Globe },
];

declare global {
  interface Window { google: any; }
}

const DEFAULT_CENTER = { lat: 20.0, lng: 79.0 };
const DEFAULT_ZOOM = 5;

/** Radius (meters) for expanded-cluster zone circle and event-coordinate filter. */
const CLUSTER_ZONE_RADIUS_M = 300;
/** Min zoom when expanding a cluster so the 300m zone circle and dots stay clearly visible. */
const CLUSTER_ZONE_MIN_ZOOM = 17;

/** Smooth (wavy) path through points — Catmull-Rom–style cubic segments. */
function buildSmoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Only these fields in the event detail dialog (merged row + cluster_events[0]). */
const CLUSTER_EVENT_DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: "cluster_id", label: "Cluster ID" },
  { key: "invoice_no", label: "Invoice number" },
  { key: "transporter_code", label: "Transporter code" },
  { key: "tt_number", label: "TT number" },
  { key: "trip_name", label: "Trip name" },
  { key: "risk_score", label: "Risk score" },
  { key: "event_datetime", label: "Event date & time" },
  { key: "start_location", label: "Start location" },
];

function formatDetailValue(key: string, v: unknown): string {
  if (v == null || v === "") return "—";
  if (key === "risk_score") {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n.toFixed(2);
  }
  return String(v);
}

function mergeClusterEventForDisplay(row: any, ev: any | undefined): Record<string, unknown> {
  const base = row && typeof row === "object" ? { ...row } : {};
  if (ev && typeof ev === "object") {
    Object.assign(base, ev);
  }
  if (base.event_datetime == null && base.event_date_time != null) {
    base.event_datetime = base.event_date_time;
  }
  if (base.trip_name == null && base.tripName != null) {
    base.trip_name = base.tripName;
  }
  return base;
}

function formatDangerScoreForSheet(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
}

function dangerScoreBarPct(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Risk score with % and 2 decimal places (cluster cards beside map). */
function formatRiskScorePercent(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(/%/g, "").trim());
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

/** Donut chart for severity share (stroke units: circumference ≈ 100). */
function MetricsDonut({
  pct,
  stroke,
  track = "#e5e7eb",
}: {
  pct: number;
  stroke: string;
  track?: string;
}) {
  const p = Math.min(100, Math.max(0, pct));
  const dash = `${p} ${100 - p}`;
  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.915" fill="none" stroke={track} strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.915"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold tabular-nums leading-none text-gray-700">{Math.round(p)}%</span>
      </div>
    </div>
  );
}

/** In-card loading placeholder — keeps card chrome; only value/chart areas pulse. */
function MetricValueSkeleton({ className = "" }: { className?: string }) {
  return <span className={`block rounded-md bg-gray-200/90 animate-pulse ${className}`} aria-hidden />;
}

/** Always-visible horizontal scroll track + hidden native bar (OS scrollbars often stay invisible). */
function TrendChartScrollArea({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ sl: 0, cw: 0, sw: 0 });

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setState({ sl: el.scrollLeft, cw: el.clientWidth, sw: el.scrollWidth });
  }, []);

  useLayoutEffect(() => {
    sync();
    const id = requestAnimationFrame(() => sync());
    return () => cancelAnimationFrame(id);
  }, [sync, children]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  const needsScroll = state.sw > state.cw + 0.5;
  const maxScroll = Math.max(0, state.sw - state.cw);
  const thumbWpct = !needsScroll || state.sw <= 0 ? 100 : Math.min(100, (state.cw / state.sw) * 100);
  const thumbLeftPct =
    needsScroll && maxScroll > 0 ? (state.sl / maxScroll) * (100 - thumbWpct) : 0;

  return (
    <div className="w-full min-w-0">
      <div
        ref={scrollRef}
        className="relative z-0 w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
      >
        {children}
      </div>
      <div
        className="relative z-20 mt-3.5 h-1 w-full shrink-0 rounded-full bg-gray-200 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
      >
        <div
          className="absolute left-0 top-0 z-20 h-1 rounded-full bg-gray-300 transition-[width,left] duration-75 ease-out"
          style={{
            width: `${thumbWpct}%`,
            left: `${thumbLeftPct}%`,
          }}
        />
      </div>
    </div>
  );
}

/** Min horizontal px between adjacent points when {@link SCROLL_MODE_MIN_POINTS} points — chart grows wider so parent can scroll. */
const SCROLL_MODE_MIN_POINTS = 15;
const SCROLL_POINT_GAP_PX = 26;

/** Compact wavy line chart — fills card width; if more than {@link SCROLL_MODE_MIN_POINTS} points, fixed px-per-point width + horizontal scroll. */
function AvgRiskWavyLineSparkline({
  data,
  onSelectDate,
}: {
  data: { day: string; avg_risk_score: number }[];
  /** When set, clicking a point calls this with `YYYY-MM-DD` so the parent can update global date (map, cards, APIs). */
  onSelectDate?: (isoDate: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ index: number; clientX: number; clientY: number } | null>(null);
  /** Viewport width of scroll parent (card), not the chart content width. */
  const [containerW, setContainerW] = useState(280);

  const chartH = 26;
  const padX = 2;
  const padY = 3;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const parent = el.parentElement;
      const w = parent?.clientWidth ?? el.getBoundingClientRect().width;
      if (w > 0) setContainerW(Math.floor(w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (el.parentElement) ro.observe(el.parentElement);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data.length]);

  if (!data.length) return null;
  const n = data.length;
  const scrollMode = n > SCROLL_MODE_MIN_POINTS;
  const intrinsicW =
    n <= 1 ? padX * 2 + 40 : padX * 2 + (n - 1) * SCROLL_POINT_GAP_PX;
  const chartW = scrollMode ? intrinsicW : Math.max(containerW, 40);

  const scores = data.map((d) => d.avg_risk_score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  const innerW = chartW - 2 * padX;
  const innerH = chartH - 2 * padY;
  const pts = data.map((d, i) => {
    const x = padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padY + (1 - (d.avg_risk_score - min) / span) * innerH;
    return { x, y };
  });
  const pathD = buildSmoothLinePath(pts);

  const updateTipFromEvent = (e: React.MouseEvent, index: number) => {
    setTip({
      index,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const showTipAbove =
    tip !== null &&
    typeof window !== "undefined" &&
    tip.clientY > window.innerHeight - 72;

  const tipPortal =
    tip !== null &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        role="tooltip"
        className="pointer-events-none fixed z-[300] w-max max-w-[min(14rem,calc(100vw-1rem))] rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-lg"
        style={{
          left: tip.clientX,
          top: tip.clientY,
          transform: showTipAbove ? "translate(-50%, calc(-100% - 8px))" : "translate(-50%, 10px)",
        }}
      >
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {data[tip.index].day}
        </p>
        <p className="mt-0.5 text-[11px] font-bold tabular-nums text-blue-800">
          Avg risk score: {data[tip.index].avg_risk_score.toFixed(2)}
        </p>
        {onSelectDate && (
          <p className="mt-1 border-t border-slate-100 pt-1 text-[9px] text-slate-500">Click point to use this date</p>
        )}
      </div>,
      document.body
    );

  return (
    <>
      {tipPortal}
      <div
        ref={wrapRef}
        className={`relative overflow-visible ${scrollMode ? "inline-block shrink-0" : "w-full min-w-0"}`}
        style={scrollMode ? { width: chartW, minWidth: chartW } : undefined}
      >
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        width={chartW}
        height={chartH}
        className="block h-[26px] shrink-0 text-blue-600"
        style={scrollMode ? { width: chartW, minWidth: chartW } : { width: "100%", maxWidth: "100%" }}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        {pts.map((p, i) => (
          <g key={`${data[i].day}-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill="transparent"
              className={onSelectDate ? "cursor-pointer" : "cursor-default"}
              onMouseEnter={(e) => updateTipFromEvent(e, i)}
              onMouseMove={(e) => updateTipFromEvent(e, i)}
              onMouseLeave={() => setTip(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (!onSelectDate) return;
                const raw = data[i]?.day;
                if (raw == null) return;
                const iso = String(raw).slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) onSelectDate(iso);
              }}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={1.5}
              fill="#2563eb"
              pointerEvents="none"
            />
          </g>
        ))}
      </svg>
      </div>
    </>
  );
}

export interface ClusterItem {
  id: string;
  name: string;
  city: string;
  state: string;
  dangerLevel: 'Critical' | 'High' | 'Moderate' | 'Medium' | 'Low';
  dangerScore: number;
  incidentCount: number;
  incidentType: string;
  lat: number;
  lng: number;
  /** From API: risk_band */
  riskBand?: string;
  /** From API: cluster_type */
  clusterType?: string;
  /** From API: plant_name */
  plantName?: string;
  /** From API: status */
  status?: string;
  /** From API: cluster_event_coordinates — "lat,lon" strings for event dots */
  clusterEventCoordinates?: string[];
  /** Optional: population (for detail sheet) */
  population?: number | string;
  /** Optional: last updated date (for detail sheet) */
  updated?: string;
}

const MOCK_CLUSTERS: ClusterItem[] = [
  { id: 'C008', name: 'Dharavi Core',        city: 'Mumbai',        state: 'Maharashtra',   dangerLevel: 'Critical', dangerScore: 91, incidentCount: 178, incidentType: 'Dense Urban', lat: 19.076, lng: 72.877 },
  { id: 'C036', name: 'Naroda Industrial',   city: 'Ahmedabad',     state: 'Gujarat',       dangerLevel: 'Critical', dangerScore: 89, incidentCount: 156, incidentType: 'Industrial',  lat: 23.022, lng: 72.571 },
  { id: 'C023', name: 'Old City Cluster',    city: 'Hyderabad',     state: 'Telangana',     dangerLevel: 'Critical', dangerScore: 88, incidentCount: 151, incidentType: 'Dense Urban', lat: 17.385, lng: 78.486 },
  { id: 'C012', name: 'Chennai Port',        city: 'Chennai',       state: 'Tamil Nadu',    dangerLevel: 'Critical', dangerScore: 83, incidentCount: 142, incidentType: 'Industrial',  lat: 13.082, lng: 80.270 },
  { id: 'C041', name: 'Bareilly Junction',   city: 'Bareilly',      state: 'Uttar Pradesh', dangerLevel: 'Critical', dangerScore: 87, incidentCount: 138, incidentType: 'Transit Hub', lat: 28.367, lng: 79.430 },
  { id: 'C019', name: 'Agra Heritage',       city: 'Agra',          state: 'Uttar Pradesh', dangerLevel: 'Critical', dangerScore: 81, incidentCount: 125, incidentType: 'Dense Urban', lat: 27.176, lng: 78.008 },
  { id: 'C005', name: 'Bengaluru Tech',      city: 'Bengaluru',     state: 'Karnataka',     dangerLevel: 'High',     dangerScore: 76, incidentCount: 118, incidentType: 'Industrial',  lat: 12.971, lng: 77.594 },
  { id: 'C031', name: 'Nashik Industrial',   city: 'Nashik',        state: 'Maharashtra',   dangerLevel: 'High',     dangerScore: 75, incidentCount: 112, incidentType: 'Industrial',  lat: 19.997, lng: 73.789 },
  { id: 'C027', name: 'Visakhapatnam Port',  city: 'Visakhapatnam', state: 'Andhra Pradesh',dangerLevel: 'High',     dangerScore: 74, incidentCount: 108, incidentType: 'Industrial',  lat: 17.739, lng: 83.301 },
  { id: 'C033', name: 'Kanpur Central',      city: 'Kanpur',        state: 'Uttar Pradesh', dangerLevel: 'High',     dangerScore: 73, incidentCount: 98,  incidentType: 'Transit Hub', lat: 26.449, lng: 80.331 },
  { id: 'C044', name: 'Amravati Zone',       city: 'Amravati',      state: 'Maharashtra',   dangerLevel: 'High',     dangerScore: 70, incidentCount: 85,  incidentType: 'Dense Urban', lat: 20.937, lng: 77.787 },
  { id: 'C015', name: 'Rajkot Cluster',      city: 'Rajkot',        state: 'Gujarat',       dangerLevel: 'High',     dangerScore: 67, incidentCount: 72,  incidentType: 'Industrial',  lat: 22.303, lng: 70.802 },
  { id: 'C009', name: 'Ludhiana North',      city: 'Ludhiana',      state: 'Punjab',        dangerLevel: 'Low',      dangerScore: 34, incidentCount: 22,  incidentType: 'Industrial',  lat: 30.901, lng: 75.857 },
  { id: 'C022', name: 'Kota Industrial',     city: 'Kota',          state: 'Rajasthan',     dangerLevel: 'High',     dangerScore: 77, incidentCount: 95,  incidentType: 'Industrial',  lat: 25.213, lng: 75.864 },
];

const DANGER_COLORS: Record<string, string> = {
  Critical: '#dc2626',
  High:     '#dc2626',
  Moderate: '#fb923c',
  Medium:   '#fb923c',
  Low:      '#22c55e',
};

export interface ClusterMapFilterMeta {
  plants: string[];
  clusterTypes: string[];
}

export interface ClusterMapViewProps {
  className?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  mapTypeId?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  clusters?: ClusterItem[];
  mapType?: string;
  onMapTypeChange?: (value: string) => void;
  radius500m?: boolean;
  onRadius500mChange?: (value: boolean) => void;
  selectedDate?: string;
  selectedBu?: string;
  /** Filter sidebar/map markers by plant name (matches `plantName` or `name`). */
  plantFilter?: string;
  /** Filter by `clusterType` from API. */
  clusterTypeFilter?: string;
  /** Called when cluster list changes so parent can populate filter dropdowns. */
  onFilterMeta?: (meta: ClusterMapFilterMeta) => void;
  /** When user clicks a point on the avg risk trend chart, parent should set global date (e.g. `setSelectedDate`). */
  onTrendDateSelect?: (isoDate: string) => void;
}

export interface ClusterMapViewRef {
  resetView: () => void;
}

const ClusterMapView = forwardRef<ClusterMapViewRef, ClusterMapViewProps>(({
  className = '',
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  mapTypeId = 'hybrid',
  clusters: propsClusters,
  mapType: controlledMapType,
  onMapTypeChange,
  radius500m: controlledRadius500m,
  onRadius500mChange,
  selectedDate,
  selectedBu,
  plantFilter = '',
  clusterTypeFilter = '',
  onFilterMeta,
  onTrendDateSelect,
}, ref) => {
  const mapContainerRef   = useRef<HTMLDivElement>(null);
  /** Map surface only — used to position the detail overlay via getBoundingClientRect (avoids covering app header). */
  const mapStackRef       = useRef<HTMLDivElement>(null);
  const mapInstanceRef    = useRef<any>(null);
  const markersRef        = useRef<any[]>([]);
  const eventMarkersRef   = useRef<any[]>([]);
  const clusterCircleRef  = useRef<any>(null);
  const infoWindowRef     = useRef<any>(null);
  const scriptLoadedRef   = useRef(false);

  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const expandedCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const [detailSheetCluster, setDetailSheetCluster] = useState<ClusterItem | null>(null);
  const [mapStackBox, setMapStackBox] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  /** Map event dot → API detail dialog */
  const [clusterEventDialogOpen, setClusterEventDialogOpen] = useState(false);
  const [clusterEventLoading, setClusterEventLoading] = useState(false);
  const [clusterEventError, setClusterEventError] = useState<string | null>(null);
  const [clusterEventRow, setClusterEventRow] = useState<any>(null);
  const [clusterEventItem, setClusterEventItem] = useState<any>(null);

  const [mapLoaded,   setMapLoaded]   = useState(false);
  const [scriptLoaded,setScriptLoaded]= useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const [internalMapType,    setInternalMapType]    = useState(mapTypeId);
  const [internalRadius500m, setInternalRadius500m] = useState(true);

  const mapType      = controlledMapType    ?? internalMapType;
  const setMapType   = onMapTypeChange      ?? setInternalMapType;
  const radius500m   = controlledRadius500m ?? internalRadius500m;
  const setRadius500m= onRadius500mChange   ?? setInternalRadius500m;

  const [search,         setSearch]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [sortBy,         setSortBy]         = useState('Danger');

  const [clusterMapViewStyle, setClusterMapViewStyle] = useState<MapViewStyle>('hybrid');
  const currentMapStyle = MAP_VIEW_STYLES.find(s => s.id === clusterMapViewStyle) ?? MAP_VIEW_STYLES[0];

  const handleMapViewStyleSelect = useCallback((style: MapViewStyle) => {
    setClusterMapViewStyle(style);
    const entry = MAP_VIEW_STYLES.find(s => s.id === style);
    if (entry) setMapType(entry.mapTypeId);
  }, [setMapType]);

  /** Slide-in panel: start off-screen right, then animate in (View Details). */
  const [clusterDetailSlideIn, setClusterDetailSlideIn] = useState(false);
  useEffect(() => {
    if (!detailSheetCluster) {
      setClusterDetailSlideIn(false);
      return;
    }
    setClusterDetailSlideIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setClusterDetailSlideIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [detailSheetCluster]);

  useEffect(() => {
    if (!detailSheetCluster) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailSheetCluster(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailSheetCluster]);

  const syncMapStackBox = useCallback(() => {
    const el = mapStackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    setMapStackBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    // Google Maps keeps the initial pixel size until `resize` — required after flex layout / route mount.
    const map = mapInstanceRef.current;
    if (map && window.google?.maps?.event) {
      window.google.maps.event.trigger(map, 'resize');
    }
  }, []);

  useLayoutEffect(() => {
    syncMapStackBox();
    const el = mapStackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncMapStackBox());
    ro.observe(el);
    window.addEventListener("resize", syncMapStackBox);
    window.addEventListener("scroll", syncMapStackBox, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncMapStackBox);
      window.removeEventListener("scroll", syncMapStackBox, true);
    };
  }, [syncMapStackBox]);

  useLayoutEffect(() => {
    if (!detailSheetCluster) {
      setClusterDetailSlideIn(false);
      return;
    }
    syncMapStackBox();
    setClusterDetailSlideIn(false);
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncMapStackBox();
        setClusterDetailSlideIn(true);
      });
    });
    return () => cancelAnimationFrame(t);
  }, [detailSheetCluster, syncMapStackBox]);

  /** After the map instance exists, re-sync container + trigger Maps `resize` once layout has settled (cluster page mount). */
  useEffect(() => {
    if (!mapLoaded) return;
    const run = () => syncMapStackBox();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    const t1 = window.setTimeout(run, 50);
    const t2 = window.setTimeout(run, 250);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [mapLoaded, syncMapStackBox]);

  const [apiClusters,  setApiClusters]  = useState<ClusterItem[]>([]);
  const [apiMetrics,   setApiMetrics]   = useState<any>(null);
  const [loadingData,  setLoadingData]  = useState(false);
  const [dataFetched,  setDataFetched]  = useState(false);
  /** Deduplicate in-flight `risk_score_cluster_map` requests (Strict Mode / rapid dep changes). */
  const clusterMapDataFetchGenRef = useRef(0);

  const locationTypeBu = selectedBu || "SOD";

  useEffect(() => {
    const gen = ++clusterMapDataFetchGenRef.current;

    const fetchClusterData = async () => {
      setLoadingData(true);
      try {
        const payload = {
          action: "risk_score_cluster_map",
          filters: [{ key: "location_type", cond: "equals", value: locationTypeBu }],
          payload: { version_date: selectedDate || new Date().toISOString().split("T")[0] }
        };
        const response = await apiClient.post("/api/charts/generate_vis_data", payload);
        if (gen !== clusterMapDataFetchGenRef.current) return;
        if (response.data) {
          const resData = response.data;
          const counts  = resData.counts || resData.metrics || resData;
          if (counts.total_clusters !== undefined || counts.total !== undefined ||
              counts.total_cluster_events !== undefined || counts.total_incidents !== undefined) {
            setApiMetrics({
              total:          counts.total_clusters ?? counts.total ?? 0,
              totalIncidents: counts.total_cluster_events ?? counts.total_incidents ?? counts.total_alerts ?? 0,
              byLevel: {
                Critical: counts.Critical ?? counts.critical ?? counts.byLevel?.Critical ?? 0,
                High:     counts.High     ?? counts.high     ?? counts.byLevel?.High     ?? 0,
                Medium:   counts.Medium   ?? counts.medium   ?? counts.Moderate ?? counts.moderate ?? counts.byLevel?.Medium ?? 0,
                Low:      counts.Low      ?? counts.low      ?? counts.byLevel?.Low      ?? 0,
              }
            });
          }
          const arr = resData.data || resData.clusters || (Array.isArray(resData) ? resData : []);
          if (Array.isArray(arr)) {
            const mapped = arr.map((item: any, i: number) => {
              // Use centroid_lat_lon from API ("lat,lon" string) for map position; fallback to lat/lng
              let lat = 0, lng = 0;
              if (item.centroid_lat_lon && typeof item.centroid_lat_lon === 'string') {
                const parts = item.centroid_lat_lon.split(',').map((s: string) => s.trim());
                if (parts.length >= 2) {
                  lat = Number(parts[0]) || 0;
                  lng = Number(parts[1]) || 0;
                }
              }
              if (lat === 0 && lng === 0) {
                lat = Number(item.lat) || 0;
                lng = Number(item.lng) || 0;
              }
              return {
                id:            item.cluster_id || item.id || `C${i}`,
                name:          item.cluster_name || item.name || item.plant_name || "Unknown",
                city:          item.city  || "",
                state:         item.state || "",
                dangerLevel:   item.danger_level || item.dangerLevel || item.risk_band || "Low",
                dangerScore:   Number(item.risk_score ?? item.dangerScore ?? 0),
                // Label on marker = cluster_events_count from API (e.g. 138 for SOD-RD-135)
                incidentCount: item.cluster_events_count !== undefined
                  ? Number(item.cluster_events_count)
                  : Number(item.incident_count ?? item.incidentCount ?? item.events_30d ?? 0),
                incidentType: item.incident_type || item.incidentType || "",
                lat: lat || 0,
                lng: lng || 0,
                riskBand:      item.risk_band != null ? String(item.risk_band) : undefined,
                clusterType:   item.cluster_type != null ? String(item.cluster_type) : undefined,
                plantName:     item.plant_name != null ? String(item.plant_name) : undefined,
                status:        item.status != null ? String(item.status) : undefined,
                population:    item.population != null ? item.population : undefined,
                updated:       item.updated ?? item.updated_at ?? item.last_updated ?? item.version_date,
                // Dots on expand: only from API cluster_event_coordinates (no dummy data)
                clusterEventCoordinates: (() => {
                  const raw = item.cluster_event_coordinates ?? item.cluster_event_coords ?? item.event_coordinates;
                  const toStr = (x: any): string | null => {
                    if (typeof x === 'string') return x;
                    if (Array.isArray(x) && x.length >= 2) return `${x[0]},${x[1]}`;
                    if (x && (x.lat != null || x.latitude != null) && (x.lng != null || x.lon != null || x.longitude != null)) return `${x.lat ?? x.latitude},${x.lng ?? x.lon ?? x.longitude}`;
                    return null;
                  };
                  if (Array.isArray(raw)) return raw.map(toStr).filter((s): s is string => Boolean(s));
                  if (typeof raw === 'string') try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(toStr).filter((s): s is string => Boolean(s)) : undefined; } catch { return undefined; }
                  return undefined;
                })(),
              };
            });
            setApiClusters(mapped);
          }
        }
      } catch (err: unknown) {
        if (gen !== clusterMapDataFetchGenRef.current) return;
        console.error("Failed to fetch cluster map data", err);
      } finally {
        if (gen === clusterMapDataFetchGenRef.current) {
          setLoadingData(false);
          setDataFetched(true);
        }
      }
    };
    void fetchClusterData();
  }, [selectedDate, selectedBu]);

  const clusters = propsClusters ?? (dataFetched ? apiClusters : []);

  useEffect(() => {
    if (!onFilterMeta) return;
    const plantSet = new Set<string>();
    const typeSet = new Set<string>();
    clusters.forEach((c) => {
      const p = (c.plantName || c.name || "").trim();
      if (p) plantSet.add(p);
      const t = (c.clusterType || "").trim();
      if (t) typeSet.add(t);
    });
    onFilterMeta({
      plants: [...plantSet].sort((a, b) => a.localeCompare(b)),
      clusterTypes: [...typeSet].sort((a, b) => a.localeCompare(b)),
    });
  }, [clusters, onFilterMeta]);

  const filteredClusters = useMemo(() => {
    let list = clusters.filter(c =>
      search === '' || [c.id, c.name, c.city, c.state].some(s =>
        String(s).toLowerCase().includes(search.toLowerCase())
      )
    );
    if (plantFilter.trim()) {
      const want = plantFilter.trim().toLowerCase();
      list = list.filter((c) => {
        const label = (c.plantName || c.name || "").trim().toLowerCase();
        return label === want;
      });
    }
    if (clusterTypeFilter.trim()) {
      const want = clusterTypeFilter.trim().toLowerCase();
      list = list.filter((c) => (c.clusterType || "").trim().toLowerCase() === want);
    }
    if (categoryFilter === 'High') list = list.filter(c => c.dangerLevel === 'Critical' || c.dangerLevel === 'High');
    else if (categoryFilter === 'Medium') list = list.filter(c => c.dangerLevel === 'Moderate' || c.dangerLevel === 'Medium');
    else if (categoryFilter === 'Low') list = list.filter(c => c.dangerLevel === 'Low');
    if (sortBy === 'Danger') list = [...list].sort((a, b) => b.dangerScore - a.dangerScore);
    return list;
  }, [clusters, search, categoryFilter, sortBy, plantFilter, clusterTypeFilter]);

  const metrics = useMemo(() => {
    if (apiMetrics) return apiMetrics;
    const list = filteredClusters;
    const total = list.length;
    const totalIncidents = list.reduce((s, c) => s + c.incidentCount, 0);
    const byLevel = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    list.forEach(c => {
      if      (c.dangerLevel === 'Critical') byLevel.Critical++;
      else if (c.dangerLevel === 'High')     byLevel.High++;
      else if (c.dangerLevel === 'Moderate') byLevel.Medium++;
      else if (c.dangerLevel === 'Low')      byLevel.Low++;
    });
    return { total, totalIncidents, byLevel };
  }, [apiMetrics, filteredClusters]);

  const [avgRiskTrendSeries, setAvgRiskTrendSeries] = useState<{ day: string; avg_risk_score: number }[]>([]);
  const [avgRiskTrendLoading, setAvgRiskTrendLoading] = useState(false);
  const avgTrendRunIdRef = useRef(0);

  useEffect(() => {
    const ac = new AbortController();
    const runId = ++avgTrendRunIdRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (runId !== avgTrendRunIdRef.current) return;
        setAvgRiskTrendLoading(true);
        try {
          const filters: { key: string; cond: string; value: string }[] = [];
          if (plantFilter.trim()) {
            filters.push({ key: "plant_name", cond: "equals", value: plantFilter.trim() });
          }
          if (clusterTypeFilter.trim()) {
            filters.push({ key: "cluster_type", cond: "equals", value: clusterTypeFilter.trim() });
          }
          /** Matches API shape: `filters` / `cross_filters` / `drill_state`; `payload` is only `cluster_id` when a cluster is selected. */
          const payload = {
            action: "cluster_wise_daily_trends",
            filters,
            cross_filters: [] as unknown[],
            drill_state: "",
            payload: expandedClusterId
              ? { cluster_id: expandedClusterId }
              : ({} as Record<string, unknown>),
          };
          const response = await apiClient.post("/api/charts/generate_vis_data", payload, { signal: ac.signal });
          if (runId !== avgTrendRunIdRef.current) return;
          const body = response.data as Record<string, unknown>;
          const raw =
            (Array.isArray(body?.data) ? body.data : null) ??
            (Array.isArray((body as any)?.rows) ? (body as any).rows : null) ??
            (Array.isArray(body) ? body : null);
          const arr = Array.isArray(raw) ? raw : [];
          const mapped = arr
            .map((row: Record<string, unknown>) => {
              const dayRaw = row.day ?? row.date ?? row.version_date ?? row.event_date;
              const day = dayRaw != null ? String(dayRaw).slice(0, 10) : "";
              const scoreRaw = row.avg_risk_score ?? row.avg_risk ?? row.risk_score ?? row.risk;
              const avg_risk_score = typeof scoreRaw === "number" ? scoreRaw : Number(scoreRaw);
              return { day, avg_risk_score };
            })
            .filter((r) => r.day && Number.isFinite(r.avg_risk_score));
          /** Newest day first (left of sparkline), then older days — matches “latest date first” in the series. */
          mapped.sort((a, b) => b.day.localeCompare(a.day));
          setAvgRiskTrendSeries(mapped);
        } catch (err: unknown) {
          if (ac.signal.aborted) return;
          console.error("cluster_wise_daily_trends failed", err);
          if (runId === avgTrendRunIdRef.current) setAvgRiskTrendSeries([]);
        } finally {
          if (runId === avgTrendRunIdRef.current) setAvgRiskTrendLoading(false);
        }
      })();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [expandedClusterId, plantFilter, clusterTypeFilter]);

  /** True while cluster map API and/or trend API are in flight — unified loading for sidebar, metrics, map. */
  const mapDataSyncLoading = loadingData || avgRiskTrendLoading;

  // ── Google Maps script loader ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google?.maps?.Map) { setScriptLoaded(true); return; }
    const existing = Array.from(document.querySelectorAll('script')).find(s =>
      (s as HTMLScriptElement).src?.includes('maps.googleapis.com/maps/api/js')
    );
    if (existing) {
      if (window.google?.maps?.Map) setScriptLoaded(true);
      else {
        existing.addEventListener('load',  () => setScriptLoaded(true));
        existing.addEventListener('error', () => setError('Failed to load Google Maps'));
      }
      return;
    }
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;
    const script = document.createElement('script');
    script.src = GOOGLE_MAPS_API_URL;
    script.async = true;
    script.defer = true;
    script.onload  = () => setScriptLoaded(true);
    script.onerror = () => { setError('Failed to load Google Maps API'); scriptLoadedRef.current = false; };
    document.head.appendChild(script);
    return () => { scriptLoadedRef.current = false; };
  }, []);

  // ── Map init ──
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current || !window.google?.maps?.Map) return;
    const initMap = () => {
      const node = mapContainerRef.current;
      if (
        !node ||
        mapInstanceRef.current ||
        !(node instanceof HTMLElement) ||
        !node.isConnected
      ) {
        return;
      }
      try {
        const map = new window.google.maps.Map(node, {
          center: { lat: center.lat, lng: center.lng },
          zoom,
          mapTypeId: mapType,
          mapTypeControl:    false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl:       true,
          scaleControl:      true,
          gestureHandling:   'greedy',
          minZoom: 3,
          maxZoom: 20,
          restriction: { latLngBounds: { north: 37, south: 6, west: 68, east: 98 }, strictBounds: false },
        });
        mapInstanceRef.current = map;
        setMapLoaded(true);
        setError(null);
        fetch('https://raw.githubusercontent.com/datameet/maps/master/Country/india-osm.geojson')
          .then(r => r.json())
          .then(data => {
            if (data.features) {
              map.data.addGeoJson(data);
              map.data.setStyle({ fillColor: 'transparent', strokeColor: '#000', strokeWeight: 1.5, strokeOpacity: 0.6 });
            }
          })
          .catch(err => console.error('Failed to load India boundary GeoJSON', err));
      } catch (err) {
        console.error('ClusterMapView: Error initializing map', err);
        setError('Failed to initialize map');
      }
    };
    const t = setTimeout(initMap, 100);
    return () => clearTimeout(t);
  }, [scriptLoaded, center.lat, center.lng, zoom, mapType]);

  // ── Markers ──
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google?.maps) return;
    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => m?.setMap?.(null));
    markersRef.current = [];
    if (!infoWindowRef.current) {
      infoWindowRef.current = new window.google.maps.InfoWindow({ pixelOffset: new window.google.maps.Size(0, -25) });
    }
    const infoWindow = infoWindowRef.current;

    filteredClusters.forEach(c => {
      if (c.lat == null || c.lng == null) return;
      const pos   = { lat: c.lat, lng: c.lng };
      const color = DANGER_COLORS[c.dangerLevel] || '#6b7280';
      const marker = new window.google.maps.Marker({
        map,
        position: pos,
        label: {
          text: String(c.incidentCount),
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '10px',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        icon: {
          path:         window.google.maps.SymbolPath.CIRCLE,
          scale:        10,
          fillColor:    color,
          fillOpacity:  1,
          strokeColor:  '#ffffff',
          strokeWeight: 1.5,
        },
      });
      marker.addListener('mouseover', () => {
        const riskBand = c.riskBand ?? c.dangerLevel ?? '—';
        const clusterType = c.clusterType ?? '—';
        const plantName = c.plantName ?? c.name ?? '—';
        const status = c.status ?? '—';
        const clusterId = c.id ?? '—';
        const riskNum = Number(String(c.dangerScore ?? "").replace(/%/g, "").trim());
        const riskScore = Number.isFinite(riskNum) ? riskNum.toFixed(2) : "—";
        const isValid = String(status).toUpperCase() === 'VALID';
        const statusHtml = isValid
          ? `<span style="color:#059669;font-weight:600;display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:14px;height:14px;background:#059669;color:#fff;border-radius:50%;text-align:center;line-height:14px;font-size:10px">✓</span>VALID</span>`
          : `<span style="color:#6b7280">${status || '—'}</span>`;
        infoWindow.setContent(`
          <style>.gm-ui-hover-effect{display:none!important}</style>
          <div style="padding:6px 10px;min-width:260px;font-family:sans-serif;font-size:11px;background:#fff">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;font-size:13px;padding-bottom:4px;border-bottom:1px solid #e5e7eb">
              <span style="font-weight:800;color:#0f172a;font-size:13px;letter-spacing:0.02em">${plantName}</span>
              <strong style="font-size:12px;color:${color}">${riskScore === "—" ? "—" : `${riskScore}%`}</strong>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;color:#1f2937">
              <div style="display:flex;flex-direction:column;gap:0"><span style="color:#6b7280;font-size:9px;text-transform:uppercase;letter-spacing:0.5px">Risk band</span><strong style="color:${color};font-size:11px">${riskBand}</strong></div>
              <div style="display:flex;flex-direction:column;gap:0"><span style="color:#6b7280;font-size:9px;text-transform:uppercase;letter-spacing:0.5px">Cluster type</span><span style="font-size:11px;color:#1f2937">${clusterType}</span></div>
              <div style="display:flex;flex-direction:column;gap:0"><span style="color:#6b7280;font-size:9px;text-transform:uppercase;letter-spacing:0.5px">Status</span>${statusHtml}</div>
              <div style="display:flex;flex-direction:column;gap:0"><span style="color:#6b7280;font-size:9px;text-transform:uppercase;letter-spacing:0.5px">Cluster ID</span><span style="font-size:11px;font-weight:500;color:#1f2937">${clusterId}</span></div>
            </div>
          </div>
        `);
        infoWindow.open(map, marker);
        setTimeout(() => {
          const iw = document.querySelector('.gm-style-iw-c') as HTMLElement | null;
          if (iw) { iw.style.border = `2px solid ${color}`; iw.style.borderRadius = '8px'; iw.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,.1)'; iw.style.padding = '4px'; }
          const btn = document.querySelector('.gm-ui-hover-effect') as HTMLElement | null;
          if (btn) btn.style.display = 'none';
        }, 10);
      });
      marker.addListener('mouseout', () => infoWindow.close());
      marker.addListener('click', () => {
        infoWindow.close();
        expandedCenterRef.current = { lat: c.lat, lng: c.lng };
        setExpandedClusterId(prev => prev === c.id ? null : c.id);
      });
      markersRef.current.push(marker);
    });
    // Default framing matches "Reset View" (center + zoom props / DEFAULT_*), not auto fitBounds to all markers.
  }, [mapLoaded, filteredClusters]);

  // ── Expanded cluster: zone circle + event dots, animate zoom ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;
    eventMarkersRef.current.forEach(m => m?.setMap?.(null));
    eventMarkersRef.current = [];
    if (clusterCircleRef.current) {
      clusterCircleRef.current.setMap(null);
      clusterCircleRef.current = null;
    }
    if (!expandedClusterId) return;
    const cluster = filteredClusters.find(c => c.id === expandedClusterId);
    if (!cluster) return;
    const center = expandedCenterRef.current && expandedCenterRef.current.lat != null && expandedCenterRef.current.lng != null
      ? expandedCenterRef.current
      : { lat: cluster.lat, lng: cluster.lng };
    expandedCenterRef.current = null;
    if (center.lat == null || center.lng == null) return;
    const color = DANGER_COLORS[cluster.dangerLevel] || '#6b7280';
    // Haversine distance in meters between two lat/lng points
    const distMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000; // Earth radius in meters
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLng = (b.lng - a.lng) * Math.PI / 180;
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };
    // Build dot positions only from API cluster_event_coordinates, and only within CLUSTER_ZONE_RADIUS_M of center.
    // Preserve original "lat,lon" string for risk_score_cluster_map event_lat_lon payload.
    const coords: { lat: number; lng: number; eventLatLonStr: string }[] = [];
    const coordList = cluster.clusterEventCoordinates;
    if (Array.isArray(coordList) && coordList.length > 0) {
      coordList.forEach((item: any) => {
        let lat: number | null = null;
        let lng: number | null = null;
        let eventLatLonStr: string | null = null;
        if (typeof item === "string") {
          eventLatLonStr = item.trim();
          const parts = item.split(",").map((x: string) => x.trim());
          if (parts.length >= 2) {
            lat = Number(parts[0]);
            lng = Number(parts[1]);
          }
        } else if (Array.isArray(item) && item.length >= 2) {
          lat = Number(item[0]);
          lng = Number(item[1]);
          eventLatLonStr = `${lat},${lng}`;
        } else if (item && (item.lat != null || item.latitude != null) && (item.lng != null || item.lon != null || item.longitude != null)) {
          lat = Number(item.lat ?? item.latitude);
          lng = Number(item.lng ?? item.lon ?? item.longitude);
          eventLatLonStr = `${lat},${lng}`;
        }
        if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && eventLatLonStr) {
          const p = { lat, lng };
          if (distMeters(center, p) <= CLUSTER_ZONE_RADIUS_M) {
            coords.push({ ...p, eventLatLonStr });
          }
        }
      });
    }
    if (radius500m) {
      const circle = new window.google.maps.Circle({
        map,
        center,
        radius: CLUSTER_ZONE_RADIUS_M,
        fillColor: color,
        fillOpacity: 0.2,
        strokeColor: color,
        strokeOpacity: 0.45,
        strokeWeight: 1.5,
        zIndex: 0,
      });
      clusterCircleRef.current = circle;
    }
    const versionDate =
      selectedDate || new Date().toISOString().split("T")[0];

    coords.forEach((p) => {
      const dot = new window.google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 3,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 0.5,
        },
        zIndex: 10,
      });
      dot.addListener("click", () => {
        setClusterEventDialogOpen(true);
        setClusterEventLoading(true);
        setClusterEventError(null);
        setClusterEventRow(null);
        setClusterEventItem(null);

        void (async () => {
          try {
            const payload = {
              action: "risk_score_cluster_map",
              payload: {
                cluster_id: cluster.id,
                event_lat_lon: p.eventLatLonStr,
                version_date: versionDate,
              },
            };
            const response = await apiClient.post(
              "/api/charts/generate_vis_data",
              payload
            );
            const body = response.data as {
              status?: boolean;
              message?: string;
              data?: any[];
            };
            if (!body?.status || !Array.isArray(body.data) || body.data.length === 0) {
              setClusterEventError(body?.message || "No data for this point");
              setClusterEventLoading(false);
              return;
            }
            const row = body.data[0];
            const ev = Array.isArray(row?.cluster_events)
              ? row.cluster_events[0]
              : undefined;
            setClusterEventRow(row);
            setClusterEventItem(ev ?? null);
            setClusterEventLoading(false);
          } catch (err) {
            console.error("Cluster event detail failed", err);
            setClusterEventError("Could not load event details.");
            setClusterEventLoading(false);
          }
        })();
      });
      eventMarkersRef.current.push(dot);
    });
    // Zoom to this cluster's zone immediately (no manual zoom needed)
    map.panTo(center);
    map.setZoom(CLUSTER_ZONE_MIN_ZOOM);
    // Optionally fit bounds to include all dots, but keep zoomed in (min CLUSTER_ZONE_MIN_ZOOM)
    const deg = 0.003;
    const zoomBounds = new window.google.maps.LatLngBounds(
      { lat: center.lat - deg, lng: center.lng - deg },
      { lat: center.lat + deg, lng: center.lng + deg }
    );
    coords.forEach((p) => {
      zoomBounds.extend({ lat: p.lat, lng: p.lng });
    });
    const padding = { top: 60, right: 60, bottom: 60, left: 60 };
    setTimeout(() => {
      map.fitBounds(zoomBounds, padding);
      if (map.getZoom() < CLUSTER_ZONE_MIN_ZOOM) map.setZoom(CLUSTER_ZONE_MIN_ZOOM);
    }, 100);

  }, [expandedClusterId, filteredClusters, selectedDate, radius500m]);

  // ── Map type sync ──
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps?.MapTypeId) mapInstanceRef.current.setMapTypeId(mapType);
  }, [mapType]);

  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.setCenter(center);
      map.setZoom(zoom);
    }
    // Back to default map + `cluster_wise_daily_trends` payload `{ }` (no cluster_id).
    expandedCenterRef.current = null;
    setExpandedClusterId(null);
    setDetailSheetCluster(null);
    infoWindowRef.current?.close?.();
    // Do not call `resize` here — avoids re-layout / “shrink” side effects; only recenters and restores zoom.
  };
  useImperativeHandle(ref, () => ({ resetView: handleResetView }), [center, zoom]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-red-600 ${className}`} role="alert">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYOUT:  [ SIDEBAR (full height) | RIGHT COLUMN (metrics bar + map) ]
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className={`flex h-full min-h-0 overflow-hidden bg-white ${className}`}
      aria-busy={mapDataSyncLoading}
    >

      {/* ═══════════════════════════════════════════════
          LEFT SIDEBAR — full height, no top offset
      ═══════════════════════════════════════════════ */}
      <div className="flex flex-col w-[300px] shrink-0 h-full border-r border-gray-200 bg-white shadow-xl z-10">

        {/* Search + All/Active toggle */}
        <div className="p-3 border-b border-gray-200 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clusters or cities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex border-b border-gray-200 gap-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('All Categories')}
              className={`flex-1 min-w-0 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                categoryFilter === 'All Categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              All Clusters
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('High')}
              className={`flex-1 min-w-0 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                categoryFilter === 'High'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              High
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Medium')}
              className={`flex-1 min-w-0 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                categoryFilter === 'Medium'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Medium
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Low')}
              className={`flex-1 min-w-0 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                categoryFilter === 'Low'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Low
            </button>
          </div>
        </div>

        {/* Scrollable cluster cards — compact height */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/50 p-2">
          <div className="space-y-2">
          {filteredClusters.map(c => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => setExpandedClusterId(prev => prev === c.id ? null : c.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedClusterId(prev => prev === c.id ? null : c.id); } }}
              className={`rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition-all group cursor-pointer ${
                expandedClusterId === c.id ? 'border-blue-400 ring-2 ring-blue-100' : 'hover:border-gray-300 hover:shadow'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className={`inline-flex items-center rounded px-1.5 py-px text-[8px] font-bold tracking-wider uppercase ${
                  c.dangerLevel === 'Critical' || c.dangerLevel === 'High' ? 'bg-red-50 text-red-700 ring-1 ring-red-100' :
                  c.dangerLevel === 'Moderate' || c.dangerLevel === 'Medium' ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-100' :
                                                 'bg-green-50 text-green-700 ring-1 ring-green-100'
                }`}>
                  {c.dangerLevel === 'Critical' || c.dangerLevel === 'High' ? 'HIGH' : c.dangerLevel === 'Moderate' || c.dangerLevel === 'Medium' ? 'MEDIUM' : 'LOW'}
                </span>
                <span className="max-w-[58%] shrink-0 text-right text-[9px] leading-tight text-gray-500">
                  {/* <span className="font-medium">Cluster ID</span>{' '} */}
                  <span className="font-semibold text-gray-700 break-words">
                    {c.id || '—'}
                  </span>
                </span>
              </div>

              <h3 className="font-bold text-gray-900 text-[13px] leading-tight group-hover:text-blue-700 transition-colors">
                {c.name}
              </h3>

              <div className="mt-1 flex items-start gap-1 text-[10px] text-gray-500 leading-tight">
                <MapPin className="w-3 h-3 shrink-0 mt-px text-gray-400" />
                <span className="min-w-0">{c.city}, {c.state}</span>
              </div>

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-gray-700">Risk Score</span>
                  <span className={`font-bold tabular-nums ${
                    c.dangerLevel === 'Critical' || c.dangerLevel === 'High' ? 'text-red-600' :
                    c.dangerLevel === 'Moderate' || c.dangerLevel === 'Medium' ? 'text-orange-500' : 'text-green-600'
                  }`}>{formatRiskScorePercent(c.dangerScore)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, dangerScoreBarPct(c.dangerScore))}%`, backgroundColor: DANGER_COLORS[c.dangerLevel] }}
                  />
                </div>
              </div>

              <div className="mt-2 border-t border-gray-100 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailSheetCluster(c);
                  }}
                  className="flex w-full items-center justify-between gap-1.5 rounded-md border border-gray-200 bg-gray-50/90 px-2 py-1.5 text-left text-[10px] font-bold text-blue-600 transition-colors hover:border-blue-200 hover:bg-blue-50/80 hover:text-blue-800"
                >
                  <span>View Details</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden />
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT COLUMN — metrics bar on top, map below
      ═══════════════════════════════════════════════ */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">

        {/* Metrics — trend card, then clusters|events; severity: screenshot-style donuts (full-width row on lg via flex) */}
        <div className="w-full min-w-0 flex-shrink-0 border-b border-gray-200 bg-gray-50/50 px-2 py-1.5 sm:px-1">
          <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 lg:flex lg:flex-nowrap lg:items-stretch lg:gap-1.5">
            <div className="group col-span-2 flex min-h-0 min-w-0 w-full flex-col rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-sm lg:col-span-auto lg:flex-[2.25] lg:basis-0">
              <div className="flex shrink-0 items-center gap-1.5">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex shrink-0 rounded-full text-gray-400 outline-none ring-offset-2 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label="About average risk score trend"
                      >
                        <Info className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={4}
                      className="max-w-[14rem] border-0 bg-blue-600 px-2 py-1.5 text-[10px] font-medium leading-snug text-white shadow-md"
                    >
                      60 days rolling window
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 leading-none">
                Risk Score Trend Analysis (Cluster-wise)
                </p>
                {avgRiskTrendLoading && !mapDataSyncLoading && (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-600" aria-hidden />
                )}
              </div>
              <div className="mt-1.5 min-h-[26px] min-w-0 w-full">
                {mapDataSyncLoading ? (
                  <div className="flex h-[26px] w-full min-w-0 items-end gap-0.5 overflow-hidden rounded-sm" aria-hidden>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-sm bg-gray-200/90 animate-pulse"
                        style={{ height: `${28 + ((i * 17) % 31)}%`, minHeight: "6px" }}
                      />
                    ))}
                  </div>
                ) : avgRiskTrendLoading ? (
                  <div className="flex h-[26px] items-center gap-1.5 text-[9px] text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-hidden />
                    Loading…
                  </div>
                ) : !avgRiskTrendSeries.length ? (
                  <p className="text-[9px] leading-snug text-gray-400">
                    {expandedClusterId ? "No trend data for this cluster." : "No trend data."}
                  </p>
                ) : (
                  <TrendChartScrollArea>
                    <AvgRiskWavyLineSparkline
                      data={avgRiskTrendSeries}
                      onSelectDate={onTrendDateSelect}
                    />
                  </TrendChartScrollArea>
                )}
              </div>
            </div>
            <div className="col-span-2 min-w-0 w-full rounded-lg border border-gray-200 bg-white px-2 pt-1.5 pb-1 shadow-sm lg:col-span-auto lg:min-w-0 lg:flex-[1.4] lg:basis-0">
              <div className="grid min-h-[3.5rem] min-w-0 grid-cols-2 gap-x-2 sm:min-h-[3.75rem]">
                <div className="flex min-h-0 min-w-0 flex-col justify-between border-r border-gray-200 pr-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 leading-none whitespace-nowrap">
                    Total clusters
                  </p>
                  <div className="min-w-0 pt-1">
                    {mapDataSyncLoading ? (
                      <MetricValueSkeleton className="h-7 w-12 sm:h-8 sm:w-14 max-w-full" />
                    ) : (
                      <span className="block text-base font-bold tabular-nums leading-none text-gray-900 sm:text-lg xl:text-xl">
                        {metrics.total}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-col justify-between pl-0.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 leading-none">Total events</p>
                  <div className="min-w-0 pt-1">
                    {mapDataSyncLoading ? (
                      <MetricValueSkeleton className="h-7 w-16 sm:h-8 sm:w-20 max-w-full" />
                    ) : (
                      <span className="block break-words text-base font-bold tabular-nums leading-tight text-gray-900 sm:text-lg xl:text-xl">
                        {metrics.totalIncidents?.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* High severity — screenshot-style */}
            <div className="flex min-w-0 w-full flex-col rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-sm lg:flex-1 lg:basis-0">
              <span className="inline-flex w-fit rounded px-1.5 py-px text-[8px] font-bold tracking-wider text-red-700 bg-red-50">
                HIGH
              </span>
              <div className="mt-1 flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  {mapDataSyncLoading ? (
                    <>
                      <MetricValueSkeleton className="h-7 w-9 sm:h-8 sm:w-10" />
                      <p className="mt-0.5 text-[9px] leading-tight text-gray-500">Critical & High</p>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold tabular-nums leading-none text-red-600 sm:text-xl">
                        {(metrics.byLevel?.Critical ?? 0) + (metrics.byLevel?.High ?? 0)}
                      </span>
                      <p className="mt-0.5 text-[9px] leading-tight text-gray-500">Critical & High</p>
                    </>
                  )}
                </div>
                {mapDataSyncLoading ? (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200/90 animate-pulse" aria-hidden />
                ) : (
                  <MetricsDonut
                    pct={
                      metrics.total > 0
                        ? ((metrics.byLevel?.Critical ?? 0) + (metrics.byLevel?.High ?? 0)) / metrics.total * 100
                        : 0
                    }
                    stroke={metrics.total > 0 && (metrics.byLevel?.Critical ?? 0) + (metrics.byLevel?.High ?? 0) > 0 ? "#dc2626" : "#9ca3af"}
                  />
                )}
              </div>
            </div>
            <div className="flex min-w-0 w-full flex-col rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-sm lg:flex-1 lg:basis-0">
              <span className="inline-flex w-fit rounded px-1.5 py-px text-[8px] font-bold tracking-wider text-orange-700 bg-orange-50">
                MEDIUM
              </span>
              <div className="mt-1 flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  {mapDataSyncLoading ? (
                    <>
                      <MetricValueSkeleton className="h-7 w-9 sm:h-8 sm:w-10" />
                      <p className="mt-0.5 text-[9px] leading-tight text-gray-500">Warning state</p>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold tabular-nums leading-none text-orange-500 sm:text-xl">
                        {metrics.byLevel?.Medium ?? 0}
                      </span>
                      <p className="mt-0.5 text-[9px] leading-tight text-gray-500">Warning state</p>
                    </>
                  )}
                </div>
                {mapDataSyncLoading ? (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200/90 animate-pulse" aria-hidden />
                ) : (
                  <MetricsDonut
                    pct={metrics.total > 0 ? ((metrics.byLevel?.Medium ?? 0) / metrics.total) * 100 : 0}
                    stroke="#ea580c"
                  />
                )}
              </div>
            </div>
            <div className="col-span-2 flex min-w-0 w-full flex-col rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-sm lg:col-span-auto lg:flex-1 lg:basis-0">
              <span className="inline-flex w-fit rounded px-1.5 py-px text-[8px] font-bold tracking-wider text-green-700 bg-green-50">
                LOW
              </span>
              <div className="mt-1 flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  {mapDataSyncLoading ? (
                    <>
                      <MetricValueSkeleton className="h-7 w-9 sm:h-8 sm:w-10" />
                      <p className="mt-0.5 text-[9px] leading-tight text-gray-500">Stable</p>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold tabular-nums leading-none text-green-600 sm:text-xl">
                        {metrics.byLevel?.Low ?? 0}
                      </span>
                      <p className="mt-0.5 text-[9px] leading-tight text-gray-500">Stable</p>
                    </>
                  )}
                </div>
                {mapDataSyncLoading ? (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200/90 animate-pulse" aria-hidden />
                ) : (
                  <MetricsDonut
                    pct={metrics.total > 0 ? ((metrics.byLevel?.Low ?? 0) / metrics.total) * 100 : 0}
                    stroke="#16a34a"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Hidden map controls — preserved, unchanged */}
          <div className="flex flex-col items-end gap-2 shrink-0 ml-4 hidden">
            <div className="flex items-center gap-2">
              <select
                value={locationTypeBu}
                onChange={() => {}}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SOD">SOD</option>
                <option value="LPG">LPG</option>
              </select>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <MapIcon className="w-4 h-4 text-gray-500" />
                    <span>{currentMapStyle.label}</span>
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 rounded-xl border border-gray-200 shadow-xl bg-white" align="end">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <MapIcon className="w-5 h-5 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Map View</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Choose how the map is displayed</p>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {MAP_VIEW_STYLES.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleMapViewStyleSelect(id)}
                        className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                          clusterMapViewStyle === id
                            ? 'border-blue-500 bg-blue-50/50 text-blue-600'
                            : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {clusterMapViewStyle === id && (
                          <span className="absolute top-1.5 right-1.5 text-blue-600">
                            <Check className="w-4 h-4" />
                          </span>
                        )}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                          id === 'light' ? 'bg-amber-50' : id === 'hybrid' ? 'bg-indigo-100' : id === 'satellite' ? 'bg-emerald-100' : 'bg-gray-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            id === 'light' ? 'text-amber-600' : id === 'hybrid' ? 'text-indigo-600' : id === 'satellite' ? 'text-emerald-700' : 'text-gray-600'
                          }`} />
                        </div>
                        <span className={`text-xs font-medium ${clusterMapViewStyle === id ? 'text-blue-600' : 'text-gray-700'}`}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="p-4 pt-0 flex items-start gap-2">
                    <MapIcon className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{currentMapStyle.label} Mode</p>
                      <p className="text-xs text-gray-500 mt-0.5">{currentMapStyle.description}</p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
                onClick={handleResetView}
              >
                Reset View
              </button>
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer py-1 font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={radius500m}
                  onChange={e => setRadius500m(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
                />
                300m Radius
              </label>
            </div>
          </div>

        {/* Map — ref drives fixed overlay rect (map only, not full viewport / not app header) */}
        <div
          ref={mapStackRef}
          className="relative h-full min-h-0 min-w-0 overflow-hidden"
        >
          {!mapLoaded && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100">
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Loading map...</span>
              </div>
            </div>
          )}
          <div
            ref={mapContainerRef}
            className="absolute inset-0 z-0 min-h-0 w-full"
            aria-label="Cluster Map View"
          />
          {/* Cluster/map API reload (e.g. selected date or BU change) — markers refresh */}
          {mapLoaded && loadingData && (
            <div className="pointer-events-none absolute inset-0 z-[25] flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
              <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-5 py-4 shadow-lg">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
                <span className="text-xs font-medium text-gray-700">Updating map…</span>
              </div>
            </div>
          )}

          <div className="absolute bottom-6 left-6 z-10 w-48 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Severity Legend</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-red-600 shrink-0" />
                <span className="text-xs font-medium text-gray-700">Critical / High</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
                <span className="text-xs font-medium text-gray-700">Medium </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs font-medium text-gray-700">Low</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {typeof document !== "undefined" &&
        detailSheetCluster &&
        mapStackBox &&
        mapStackBox.height > 0 &&
        createPortal(
          <div
            className="pointer-events-none"
            style={{
              position: "fixed",
              top: mapStackBox.top,
              left: mapStackBox.left,
              width: mapStackBox.width,
              height: mapStackBox.height,
              zIndex: 150,
            }}
          >
            <button
              type="button"
              className="absolute inset-0 z-30 cursor-pointer border-0 bg-black/20 p-0 pointer-events-auto"
              aria-label="Close cluster details"
              onClick={() => setDetailSheetCluster(null)}
            />
            <aside
              className={`pointer-events-auto absolute top-0 right-0 z-40 flex h-full w-full max-w-[min(320px,100%)] flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
                clusterDetailSlideIn ? "translate-x-0" : "translate-x-full"
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cluster-detail-sheet-title"
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                <div className="shrink-0 border-b border-red-100 bg-red-50/80 px-4 pt-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="mb-0.5 text-xs font-medium text-gray-500">{detailSheetCluster.id}</p>
                      <h2
                        id="cluster-detail-sheet-title"
                        className="text-lg font-bold leading-tight text-gray-900"
                      >
                        {detailSheetCluster.plantName || detailSheetCluster.name}
                      </h2>
                      <p className="mt-1 text-sm text-gray-600">
                        {[detailSheetCluster.city, detailSheetCluster.state].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailSheetCluster(null)}
                      className="shrink-0 rounded-full p-2 text-gray-600 transition-colors hover:bg-red-100/80 hover:text-gray-900"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-bold tabular-nums ${
                        detailSheetCluster.dangerLevel === "Critical" || detailSheetCluster.dangerLevel === "High"
                          ? "text-red-600"
                          : detailSheetCluster.dangerLevel === "Moderate" || detailSheetCluster.dangerLevel === "Medium"
                            ? "text-orange-600"
                            : "text-green-600"
                      }`}
                    >
                      {formatDangerScoreForSheet(detailSheetCluster.dangerScore)}
                    </span>
                    <span className="text-sm font-medium text-gray-700">Risk Score</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${
                        detailSheetCluster.dangerLevel === "Critical" || detailSheetCluster.dangerLevel === "High"
                          ? "bg-red-600"
                          : detailSheetCluster.dangerLevel === "Moderate" || detailSheetCluster.dangerLevel === "Medium"
                            ? "bg-orange-500"
                            : "bg-green-600"
                      }`}
                    >
                      {detailSheetCluster.riskBand || detailSheetCluster.dangerLevel}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full border border-red-100 bg-white/80">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${dangerScoreBarPct(detailSheetCluster.dangerScore)}%`,
                        backgroundColor: DANGER_COLORS[detailSheetCluster.dangerLevel] || "#dc2626",
                      }}
                    />
                  </div>
                </div>

                {/* Cluster details — same card pattern as Incidents / Type */}
                <div className="border-b border-gray-100 px-4 pt-2 pb-0">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Cluster details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="mb-1 flex items-center gap-2 text-gray-500">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-medium text-gray-500">plant_name</span>
                      </div>
                      <p className="text-sm font-bold leading-tight text-gray-900 break-words">
                        {detailSheetCluster.plantName || detailSheetCluster.name || "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="mb-1 flex items-center gap-2 text-gray-500">
                        <Layers className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-medium text-gray-500">risk_band</span>
                      </div>
                      <p className="text-sm font-bold leading-tight text-gray-900">
                        {detailSheetCluster.riskBand ?? detailSheetCluster.dangerLevel ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="mb-1 flex items-center gap-2 text-sky-500">
                        <Globe className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-medium text-gray-500">latitude</span>
                      </div>
                      <p className="text-sm font-bold font-mono tabular-nums leading-tight text-gray-900">
                        {detailSheetCluster.lat != null && Number.isFinite(Number(detailSheetCluster.lat))
                          ? Number(detailSheetCluster.lat).toFixed(6)
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="mb-1 flex items-center gap-2 text-sky-500">
                        <Globe className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-medium text-gray-500">longitude</span>
                      </div>
                      <p className="text-sm font-bold font-mono tabular-nums leading-tight text-gray-900">
                        {detailSheetCluster.lng != null && Number.isFinite(Number(detailSheetCluster.lng))
                          ? Number(detailSheetCluster.lng).toFixed(6)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 pt-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="mb-1 flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium text-gray-500">Events</span>
                    </div>
                    <p className="text-base font-bold text-gray-900">
                      {detailSheetCluster.incidentCount?.toLocaleString() ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="mb-1 flex items-center gap-2 text-gray-500">
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs font-medium text-gray-500">Type</span>
                    </div>
                    <p className="text-sm font-bold leading-tight text-gray-900">
                      {[detailSheetCluster.incidentType, detailSheetCluster.clusterType].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-5 pt-0">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-gray-500" />
                        <h3 className="font-bold text-gray-900">300m Zone Analysis</h3>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {(detailSheetCluster.clusterEventCoordinates?.length ?? 0)} clusters
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${dangerScoreBarPct(detailSheetCluster.dangerScore)}%`,
                            backgroundColor: DANGER_COLORS[detailSheetCluster.dangerLevel] || "#dc2626",
                          }}
                        />
                      </div>
                      <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-700">
                        {formatDangerScoreForSheet(detailSheetCluster.dangerScore)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Based on cluster + nearby risk scores</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>,
          document.body
        )}

      <Dialog
        open={clusterEventDialogOpen}
        onOpenChange={(open) => {
          setClusterEventDialogOpen(open);
          if (!open) {
            setClusterEventError(null);
            setClusterEventRow(null);
            setClusterEventItem(null);
            setClusterEventLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[min(85vh,560px)] overflow-y-auto p-0 gap-0 sm:max-w-md">
          <div className="px-6 pt-6 pb-2">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-900 pr-8">
                Event detail
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-sm">
                Selected cluster event
              </DialogDescription>
            </DialogHeader>
          </div>
          {clusterEventLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-slate-600">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Loading…</span>
            </div>
          ) : clusterEventError ? (
            <p className="text-sm text-red-600 px-6 py-6">{clusterEventError}</p>
          ) : (
            <div className="border-t border-slate-200 bg-slate-50/80 px-2 pb-4 pt-2">
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                {CLUSTER_EVENT_DETAIL_FIELDS.map(({ key, label }) => {
                  const merged = mergeClusterEventForDisplay(
                    clusterEventRow,
                    clusterEventItem
                  );
                  const raw =
                    key === "event_datetime" && merged[key] == null
                      ? merged.event_date_time
                      : merged[key];
                  const value = formatDetailValue(key, raw);
                  const isRisk = key === "risk_score";
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-baseline sm:gap-4 sm:py-3"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:w-[140px] shrink-0">
                        {label}
                      </span>
                      <span
                        className={`text-sm text-slate-900 break-words leading-snug ${
                          isRisk ? "font-semibold tabular-nums text-blue-900" : "font-medium"
                        }`}
                      >
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

ClusterMapView.displayName = 'ClusterMapView';

export default ClusterMapView;