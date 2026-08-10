import React, { useMemo } from "react";
import { Card, CardContent } from "@/@/components/ui/card";
import { Activity, AlertCircle, Ban, Building2, Layers, Loader2, MapPin, MapPinned } from "lucide-react";
import { cn } from "@/@/lib/utils";
import {
  buildLocationStatusDistribution,
  buildVendorStatusDistribution,
  buildZoneStatusDistribution,
  computeEquipmentHealthKpis,
  type AvgClosingTimeSlice,
  equipmentRowLocationLabel,
  equipmentRowVendorLabel,
  equipmentRowZoneLabel,
  type EquipmentHealthKpiModel,
} from "./equipmentHealthKpiModel";
import {
  AVG_CLOSING_TIME_BAR_COLORS,
  EQUIPMENT_HEALTH_KPI_CARD_SHELL,
  VendorWiseRechartsBarChart,
  type VendorDistributionSlice,
} from "./EquipmentHealthKpiBar";
import { EquipmentHealthUnifiedDrillChart } from "./EquipmentHealthUnifiedDrillChart";

const KPI_SHELL = EQUIPMENT_HEALTH_KPI_CARD_SHELL;

type AvgClosingTimeCardProps = {
  title: string;
  icon: React.ReactNode;
  data: AvgClosingTimeSlice[];
  loading?: boolean;
};

function AvgClosingTimeCard({ title, icon, data, loading = false }: AvgClosingTimeCardProps) {
  const maxVal = useMemo(() => Math.max(0, ...data.map((d) => d.value)), [data]);

  return (
    <Card className={cn(KPI_SHELL, "flex flex-col overflow-hidden")}>
      <CardContent className="flex flex-col !p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500 sm:px-5">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span>Loading…</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col overflow-hidden">
            <div className="shrink-0 rounded-t-xl bg-slate-50/95 px-3 pb-1 pt-1.5 sm:px-4 sm:pt-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold leading-snug tracking-tight text-gray-900">{title}</h3>
                <div className="shrink-0 text-slate-500">{icon}</div>
              </div>
            </div>
            <hr className="w-full shrink-0 border-0 border-t border-gray-200/90" />
            <div className="flex flex-col items-center justify-center px-4 py-10 text-sm text-slate-500 sm:px-5">
              No data for current view
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col overflow-hidden">
            <div className="shrink-0 rounded-t-xl bg-slate-50/95 px-3 pb-1 pt-1.5 sm:px-4 sm:pt-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold leading-snug tracking-tight text-gray-900">{title}</h3>
                <div className="shrink-0 text-slate-500">{icon}</div>
              </div>
            </div>
            <hr className="w-full shrink-0 border-0 border-t border-gray-200/90" />
            <div className="max-h-[280px] min-w-0 space-y-3 overflow-y-auto px-3 py-2.5 sm:px-4 sm:py-3">
              {data.map((item, index) => {
                const color = AVG_CLOSING_TIME_BAR_COLORS[index % AVG_CLOSING_TIME_BAR_COLORS.length];
                const widthPct = maxVal > 0 ? Math.min(100, (item.value / maxVal) * 100) : 0;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color }}>
                        {item.value.toFixed(2)} hrs
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${widthPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * When `true`, render the single-chart Zone → Location → Vendor → Status drill
 * (`EquipmentHealthUnifiedDrillChart`). When `false`, render the classic three side‑by‑side charts.
 */
const USE_UNIFIED_ZONE_DRILL_CHART = false;

function buildVendorDistributionFromRows(rows: Record<string, unknown>[]): VendorDistributionSlice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = equipmentRowVendorLabel(row);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildLocationDistributionFromRows(rows: Record<string, unknown>[]): VendorDistributionSlice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = equipmentRowLocationLabel(row);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildZoneDistributionFromRows(rows: Record<string, unknown>[]): VendorDistributionSlice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = equipmentRowZoneLabel(row);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

type KpiTileProps = {
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ReactNode;
  accent: string;
};

function KpiTile({ title, value, hint, icon, accent }: KpiTileProps) {
  return (
    <Card className={cn(KPI_SHELL, "border-l-4", accent)}>
      <CardContent className="relative z-[1] flex flex-col gap-0 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums leading-tight tracking-tight text-slate-900">{value}</p>
            {hint ? <p className="mt-1 text-[10px] leading-tight text-slate-400">{hint}</p> : null}
          </div>
          <div className="shrink-0 text-slate-500">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export type EquipmentHealthKpiWidgetsProps = {
  rows: Record<string, unknown>[];
  apiTotal: number;
  avgClosingCards?: {
    zone: AvgClosingTimeSlice[];
    vendor: AvgClosingTimeSlice[];
    location: AvgClosingTimeSlice[];
  };
  loading?: boolean;
  className?: string;
  /** Vendor card drill — primary (vendor name) and secondary (status bucket, independent per card). */
  chartDrillVendor?: string | null;
  chartDrillVendorStatus?: string | null;
  onChartDrillVendor?: (vendorLabel: string | null) => void;
  onChartDrillVendorStatus?: (statusBucket: string) => void;
  /** Location card drill — independent of vendor / zone cards. */
  chartDrillLocation?: string | null;
  chartDrillLocationStatus?: string | null;
  onChartDrillLocation?: (locationLabel: string | null) => void;
  onChartDrillLocationStatus?: (statusBucket: string) => void;
  /** Zone card drill — independent of vendor / location cards. */
  chartDrillZone?: string | null;
  chartDrillZoneStatus?: string | null;
  onChartDrillZone?: (zoneLabel: string | null) => void;
  onChartDrillZoneStatus?: (statusBucket: string) => void;
};

export function EquipmentHealthKpiWidgets({
  rows,
  apiTotal,
  avgClosingCards,
  loading = false,
  className,
  chartDrillVendor = null,
  chartDrillVendorStatus = null,
  chartDrillLocation = null,
  chartDrillLocationStatus = null,
  chartDrillZone = null,
  chartDrillZoneStatus = null,
  onChartDrillVendor,
  onChartDrillVendorStatus,
  onChartDrillLocation,
  onChartDrillLocationStatus,
  onChartDrillZone,
  onChartDrillZoneStatus,
}: EquipmentHealthKpiWidgetsProps) {
  // DEBUG — remove after root cause confirmed
  React.useEffect(() => {
    console.log('[KpiWidgets] rows changed → count:', rows.length,
      '| vendorDrill:', chartDrillVendor,
      '| locationDrill:', chartDrillLocation,
      '| zoneDrill:', chartDrillZone);
  }, [rows, chartDrillVendor, chartDrillLocation, chartDrillZone]);

  const model: EquipmentHealthKpiModel = useMemo(
    () => computeEquipmentHealthKpis(rows, apiTotal),
    [rows, apiTotal]
  );

  const vendorChartData = useMemo(() => buildVendorDistributionFromRows(rows), [rows]);
  const locationChartData = useMemo(() => buildLocationDistributionFromRows(rows), [rows]);
  const zoneChartData = useMemo(() => buildZoneDistributionFromRows(rows), [rows]);
  const zoneAvgClosingData = avgClosingCards?.zone ?? [];
  const vendorAvgClosingData = avgClosingCards?.vendor ?? [];
  const locationAvgClosingData = avgClosingCards?.location ?? [];
  // ── Vendor card ──────────────────────────────────────────────────────────
  const statusChartData = useMemo(
    () => (chartDrillVendor ? buildVendorStatusDistribution(rows, chartDrillVendor) : []),
    [rows, chartDrillVendor]
  );
  const displayChartData = chartDrillVendor ? statusChartData : vendorChartData;
  const chartModeKey = chartDrillVendor ? `status:${chartDrillVendor}` : "vendors";

  const handleSliceClick = React.useCallback(
    (name: string) => {
      if (!chartDrillVendor) { onChartDrillVendor?.(name); return; }
      onChartDrillVendorStatus?.(name);
    },
    [chartDrillVendor, onChartDrillVendor, onChartDrillVendorStatus]
  );
  const handleBackFromDrill = React.useCallback(() => {
    onChartDrillVendor?.(null);
  }, [onChartDrillVendor]);

  // ── Location card ─────────────────────────────────────────────────────────
  const locationStatusChartData = useMemo(
    () => (chartDrillLocation ? buildLocationStatusDistribution(rows, chartDrillLocation) : []),
    [rows, chartDrillLocation]
  );
  const displayLocationChartData = chartDrillLocation ? locationStatusChartData : locationChartData;
  const locationChartModeKey = chartDrillLocation ? `status:${chartDrillLocation}` : "locations";

  const handleLocationSliceClick = React.useCallback(
    (name: string) => {
      if (!chartDrillLocation) { onChartDrillLocation?.(name); return; }
      onChartDrillLocationStatus?.(name);
    },
    [chartDrillLocation, onChartDrillLocation, onChartDrillLocationStatus]
  );
  const handleBackFromLocationDrill = React.useCallback(() => {
    onChartDrillLocation?.(null);
  }, [onChartDrillLocation]);

  // ── Zone card ─────────────────────────────────────────────────────────────
  const zoneStatusChartData = useMemo(
    () => (chartDrillZone ? buildZoneStatusDistribution(rows, chartDrillZone) : []),
    [rows, chartDrillZone]
  );
  const displayZoneChartData = chartDrillZone ? zoneStatusChartData : zoneChartData;
  const zoneChartModeKey = chartDrillZone ? `status:${chartDrillZone}` : "zones";

  const handleZoneSliceClick = React.useCallback(
    (name: string) => {
      if (!chartDrillZone) { onChartDrillZone?.(name); return; }
      onChartDrillZoneStatus?.(name);
    },
    [chartDrillZone, onChartDrillZone, onChartDrillZoneStatus]
  );
  const handleBackFromZoneDrill = React.useCallback(() => {
    onChartDrillZone?.(null);
  }, [onChartDrillZone]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title="Total SRs"
          value={loading ? "—" : model.apiTotal}
          hint="Total no of Service Requests raised"
          icon={loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Layers className="h-5 w-5 text-slate-600" />}
          accent="border-l-sky-400"
        />
        <KpiTile
          title="Open "
          value={loading ? "—" : model.openOnLoaded}
          hint="Open Service Requests"
          icon={<AlertCircle className="h-5 w-5 text-emerald-600" />}
          accent="border-l-emerald-400"
        />
        <KpiTile
          title="Reopened "
          value={loading ? "—" : model.rejectedOnLoaded}
          hint="Reopened Service Requests"
          icon={<Ban className="h-5 w-5 text-rose-600" />}
          accent="border-l-rose-400"
        />
        <KpiTile
          title="Resolved / closed "
          value={loading ? "—" : model.resolvedOnLoaded + model.closedOnLoaded}
          hint='Resolved / closed Service Requests'
          icon={<Activity className="h-5 w-5 text-violet-600" />}
          accent="border-l-violet-400"
        />
      </div>

      {USE_UNIFIED_ZONE_DRILL_CHART ? (
        <EquipmentHealthUnifiedDrillChart
          rows={rows}
          loading={loading}
          chartDrillVendor={chartDrillVendor}
          chartDrillStatus={chartDrillVendorStatus}
          chartDrillLocation={chartDrillLocation}
          chartDrillZone={chartDrillZone}
          onChartDrillVendor={onChartDrillVendor}
          onChartDrillStatus={onChartDrillVendorStatus}
          onChartDrillLocation={onChartDrillLocation}
          onChartDrillZone={onChartDrillZone}
        />
      ) : (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Card className={cn(KPI_SHELL, "flex flex-col overflow-hidden")}>
          <CardContent className="flex flex-col !p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500 sm:px-5">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                <span>Loading…</span>
              </div>
            ) : vendorChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-sm text-slate-500 sm:px-5">
                No data for current view
              </div>
            ) : chartDrillVendor && displayChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500 sm:px-5">
                <p>No status rows for this vendor.</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                  onClick={handleBackFromDrill}
                >
                  ← All vendors
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col overflow-hidden">
                <div className="shrink-0 rounded-t-xl bg-slate-50/95 px-3 pb-1 pt-1.5 sm:px-4 sm:pt-1.5">
                  {chartDrillVendor ? (
                    <>
                      <button
                        type="button"
                        className="mb-0.5 w-fit text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                        onClick={handleBackFromDrill}
                      >
                        ← All vendors
                      </button>
                      {/* <h3 className="text-sm font-bold leading-snug tracking-tight text-gray-900">Status mix</h3> */}
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-500">
                        Vendor: <span className="font-medium text-gray-700">{chartDrillVendor}</span>. Click a bar to
                        filter the table. 
                      </p>
                    </>
                  ) : (
                    <h3 className="text-sm font-bold leading-snug tracking-tight text-gray-900">
                      Vendor-wise: number of SRs raised
                    </h3>
                  )}
                </div>
                <hr className="w-full shrink-0 border-0 border-t border-gray-200/90" />
                <div className="min-w-0 px-3 pb-0 pt-1.5 sm:px-4 sm:pb-0 sm:pt-1.5">
                  <VendorWiseRechartsBarChart
                    data={displayChartData}
                    chartModeKey={chartModeKey}
                    activeCategory={chartDrillVendor ? chartDrillVendorStatus : null}
                    onBarClick={
                      onChartDrillVendor || onChartDrillVendorStatus ? handleSliceClick : undefined
                    }
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className={cn(KPI_SHELL, "flex flex-col overflow-hidden")}>
          <CardContent className="flex flex-col !p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500 sm:px-5">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                <span>Loading…</span>
              </div>
            ) : locationChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-sm text-slate-500 sm:px-5">
                No data for current view
              </div>
            ) : chartDrillLocation && displayLocationChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500 sm:px-5">
                <p>No status rows for this location.</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                  onClick={handleBackFromLocationDrill}
                >
                  ← All locations
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col overflow-hidden">
                <div className="shrink-0 rounded-t-xl bg-slate-50/95 px-3 pb-1 pt-1.5 sm:px-4 sm:pt-1.5">
                  {chartDrillLocation ? (
                    <>
                      <button
                        type="button"
                        className="mb-0.5 w-fit text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                        onClick={handleBackFromLocationDrill}
                      >
                        ← All locations
                      </button>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-500">
                        Location: <span className="font-medium text-gray-700">{chartDrillLocation}</span>. Click a
                        bar to filter the table.
                      </p>
                    </>
                  ) : (
                    <h3 className="text-sm font-bold leading-snug tracking-tight text-gray-900">
                      Location-wise: number of SRs raised
                    </h3>
                  )}
                </div>
                <hr className="w-full shrink-0 border-0 border-t border-gray-200/90" />
                <div className="min-w-0 px-3 pb-2 pt-1.5 sm:px-4 sm:pb-2 sm:pt-1.5">
                  <VendorWiseRechartsBarChart
                    data={displayLocationChartData}
                    chartModeKey={locationChartModeKey}
                    activeCategory={chartDrillLocation ? chartDrillLocationStatus : null}
                    onBarClick={
                      onChartDrillLocation || onChartDrillLocationStatus ? handleLocationSliceClick : undefined
                    }
                    scrollbarWhenAbove={4}
                    scrollbarVisibleCount={4}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className={cn(KPI_SHELL, "flex flex-col overflow-hidden")}>
          <CardContent className="flex flex-col !p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500 sm:px-5">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                <span>Loading…</span>
              </div>
            ) : zoneChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-sm text-slate-500 sm:px-5">
                No data for current view
              </div>
            ) : chartDrillZone && displayZoneChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500 sm:px-5">
                <p>No status rows for this zone.</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                  onClick={handleBackFromZoneDrill}
                >
                  ← All zones
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col overflow-hidden">
                <div className="shrink-0 rounded-t-xl bg-slate-50/95 px-3 pb-1 pt-1.5 sm:px-4 sm:pt-1.5">
                  {chartDrillZone ? (
                    <>
                      <button
                        type="button"
                        className="mb-0.5 w-fit text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                        onClick={handleBackFromZoneDrill}
                      >
                        ← All zones
                      </button>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-500">
                        Zone: <span className="font-medium text-gray-700">{chartDrillZone}</span>. Click a bar to
                        filter the table.
                      </p>
                    </>
                  ) : (
                    <h3 className="text-sm font-bold leading-snug tracking-tight text-gray-900">
                      Zone-wise: number of SRs raised
                    </h3>
                  )}
                </div>
                <hr className="w-full shrink-0 border-0 border-t border-gray-200/90" />
                <div className="min-w-0 px-3 pb-0 pt-1.5 sm:px-4 sm:pb-0 sm:pt-1.5">
                  <VendorWiseRechartsBarChart
                    data={displayZoneChartData}
                    chartModeKey={zoneChartModeKey}
                    activeCategory={chartDrillZone ? chartDrillZoneStatus : null}
                    onBarClick={onChartDrillZone || onChartDrillZoneStatus ? handleZoneSliceClick : undefined}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <AvgClosingTimeCard
          title="Zone-wise avg ticket closing time"
          icon={<MapPinned className="h-4 w-4" />}
          data={zoneAvgClosingData}
          loading={loading}
        />
        <AvgClosingTimeCard
          title="Vendor-wise avg ticket closing time"
          icon={<Building2 className="h-4 w-4" />}
          data={vendorAvgClosingData}
          loading={loading}
        />
        <AvgClosingTimeCard
          title="Location-wise avg ticket closing time"
          icon={<MapPin className="h-4 w-4" />}
          data={locationAvgClosingData}
          loading={loading}
        />
      </div>
    </div>
  );
}
