import React, { useMemo } from "react";
import { Card, CardContent } from "@/@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/@/lib/utils";
import {
  buildLocationDistributionForZone,
  buildVendorDistributionForZoneLocation,
  buildVendorStatusDistribution,
  equipmentRowLocationLabel,
  equipmentRowVendorLabel,
  equipmentRowZoneLabel,
} from "./equipmentHealthKpiModel";
import {
  CHART_PLOT_HEIGHT_PX,
  EQUIPMENT_HEALTH_KPI_CARD_SHELL,
  VendorWiseRechartsBarChart,
} from "./EquipmentHealthKpiBar";

function buildZoneDistributionFromRows(rows: Record<string, unknown>[]): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = equipmentRowZoneLabel(row);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

type EquipmentHealthUnifiedDrillChartProps = {
  rows: Record<string, unknown>[];
  loading?: boolean;
  className?: string;
  chartDrillVendor?: string | null;
  chartDrillStatus?: string | null;
  chartDrillLocation?: string | null;
  chartDrillZone?: string | null;
  onChartDrillVendor?: (vendorLabel: string | null) => void;
  onChartDrillStatus?: (statusBucket: string) => void;
  onChartDrillLocation?: (locationLabel: string | null) => void;
  onChartDrillZone?: (zoneLabel: string | null) => void;
};

type UnifiedDrillLevel = "zone" | "location" | "vendor" | "status";

/**
 * Single-chart drill: **Zone → Location → Vendor → Status** (cumulative trail, scoped counts).
 * Parent (`EquipmentHealthCheck`) owns drill state; this component only reads/writes via callbacks.
 */
export function EquipmentHealthUnifiedDrillChart({
  rows,
  loading = false,
  className,
  chartDrillVendor = null,
  chartDrillStatus = null,
  chartDrillLocation = null,
  chartDrillZone = null,
  onChartDrillVendor,
  onChartDrillStatus,
  onChartDrillLocation,
  onChartDrillZone,
}: EquipmentHealthUnifiedDrillChartProps) {
  const zoneChartData = useMemo(() => buildZoneDistributionFromRows(rows), [rows]);

  const unifiedDrillLevel: UnifiedDrillLevel = useMemo(() => {
    const hasVendor = chartDrillVendor != null && String(chartDrillVendor).trim() !== "";
    if (hasVendor) return "status";
    const hasZone = chartDrillZone != null && String(chartDrillZone).trim() !== "";
    const hasLoc = chartDrillLocation != null && String(chartDrillLocation).trim() !== "";
    if (hasZone && hasLoc) return "vendor";
    if (hasZone) return "location";
    return "zone";
  }, [chartDrillVendor, chartDrillLocation, chartDrillZone]);

  const rowsScopedForUnifiedStatus = useMemo(() => {
    if (!(chartDrillVendor != null && String(chartDrillVendor).trim() !== "")) return rows;
    return rows.filter((r) => {
      if (chartDrillZone != null && String(chartDrillZone).trim() !== "") {
        if (equipmentRowZoneLabel(r) !== chartDrillZone) return false;
      }
      if (chartDrillLocation != null && String(chartDrillLocation).trim() !== "") {
        if (equipmentRowLocationLabel(r) !== chartDrillLocation) return false;
      }
      return equipmentRowVendorLabel(r) === chartDrillVendor;
    });
  }, [rows, chartDrillZone, chartDrillLocation, chartDrillVendor]);

  const unifiedChartData = useMemo(() => {
    switch (unifiedDrillLevel) {
      case "zone":
        return zoneChartData;
      case "location": {
        const z = String(chartDrillZone ?? "").trim();
        return z ? buildLocationDistributionForZone(rows, z) : [];
      }
      case "vendor": {
        const z = String(chartDrillZone ?? "").trim();
        const loc = String(chartDrillLocation ?? "").trim();
        return z && loc ? buildVendorDistributionForZoneLocation(rows, z, loc) : [];
      }
      case "status": {
        const v = String(chartDrillVendor ?? "").trim();
        if (!v) return [];
        return buildVendorStatusDistribution(rowsScopedForUnifiedStatus, v);
      }
      default:
        return zoneChartData;
    }
  }, [unifiedDrillLevel, rows, zoneChartData, chartDrillZone, chartDrillLocation, chartDrillVendor, rowsScopedForUnifiedStatus]);

  const unifiedChartModeKey = useMemo(() => {
    if (unifiedDrillLevel === "status") return `status:${chartDrillVendor ?? ""}`;
    if (unifiedDrillLevel === "location") return "locations";
    return "vendors";
  }, [unifiedDrillLevel, chartDrillVendor]);

  const clearDrillStatusToggle = React.useCallback(() => {
    if (chartDrillStatus != null && chartDrillStatus !== "" && onChartDrillStatus) {
      onChartDrillStatus(chartDrillStatus);
    }
  }, [chartDrillStatus, onChartDrillStatus]);

  const handleUnifiedBarClick = React.useCallback(
    (name: string) => {
      if (unifiedDrillLevel === "zone") {
        onChartDrillVendor?.(null);
        onChartDrillLocation?.(null);
        onChartDrillZone?.(name);
        return;
      }
      if (unifiedDrillLevel === "location") {
        onChartDrillVendor?.(null);
        onChartDrillLocation?.(name);
        return;
      }
      if (unifiedDrillLevel === "vendor") {
        onChartDrillVendor?.(name);
        return;
      }
      onChartDrillStatus?.(name);
    },
    [unifiedDrillLevel, onChartDrillVendor, onChartDrillLocation, onChartDrillZone, onChartDrillStatus]
  );

  const handleUnifiedBack = React.useCallback(() => {
    if (unifiedDrillLevel === "status") {
      onChartDrillVendor?.(null);
      return;
    }
    if (unifiedDrillLevel === "vendor") {
      onChartDrillLocation?.(null);
      clearDrillStatusToggle();
      return;
    }
    if (unifiedDrillLevel === "location") {
      onChartDrillZone?.(null);
      clearDrillStatusToggle();
    }
  }, [unifiedDrillLevel, onChartDrillVendor, onChartDrillLocation, onChartDrillZone, clearDrillStatusToggle]);

  const unifiedChartHasClick = Boolean(
    onChartDrillZone || onChartDrillLocation || onChartDrillVendor || onChartDrillStatus
  );

  const unifiedDrillTrail = useMemo(() => {
    const z = chartDrillZone != null ? String(chartDrillZone).trim() : "";
    const loc = chartDrillLocation != null ? String(chartDrillLocation).trim() : "";
    const v = chartDrillVendor != null ? String(chartDrillVendor).trim() : "";
    if (unifiedDrillLevel === "status" && v) {
      const parts = [z, loc, v].filter((s) => s.length > 0);
      return parts.length ? `${parts.join(" → ")} →` : `${v} →`;
    }
    if (unifiedDrillLevel === "vendor" && z && loc) return `${z} → ${loc} →`;
    if (unifiedDrillLevel === "location" && z) return `${z} →`;
    return "";
  }, [unifiedDrillLevel, chartDrillZone, chartDrillLocation, chartDrillVendor]);

  const unifiedDrillHint =
    unifiedDrillLevel === "location"
      ? "Location: choose a bar. Then Vendor → Status."
      : unifiedDrillLevel === "vendor"
        ? "Vendor: choose a bar. Then Status."
        : unifiedDrillLevel === "status"
          ? "Status: click a bar to filter the table; click the same bar again to clear."
          : "";

  return (
    <div className={cn("grid grid-cols-1 gap-2", className)}>
      <Card className={cn(EQUIPMENT_HEALTH_KPI_CARD_SHELL, "flex flex-col overflow-hidden")}>
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
          ) : unifiedDrillLevel !== "zone" && unifiedChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500 sm:px-5">
              <p>No rows for this drill step.</p>
              <button
                type="button"
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                onClick={handleUnifiedBack}
              >
                ← Back
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 flex-col overflow-hidden">
              <div className="shrink-0 rounded-t-xl bg-slate-50/95 px-3 pb-1 pt-1.5 sm:px-4 sm:pt-1.5">
                {unifiedDrillLevel !== "zone" ? (
                  <>
                    <button
                      type="button"
                      className="mb-0.5 w-fit text-left text-xs font-semibold text-blue-700 hover:text-blue-900"
                      onClick={handleUnifiedBack}
                    >
                      ← Back
                    </button>
                    <p className="mt-0.5 break-words text-xs font-semibold leading-snug tracking-tight text-slate-900">
                      {unifiedDrillTrail}
                    </p>
                    {unifiedDrillHint ? (
                      <p className="mt-1 text-[11px] leading-snug text-slate-500">{unifiedDrillHint}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-bold leading-snug tracking-tight text-gray-900">
                      Zone → Location → Vendor → Status
                    </h3>
                    <p className="mt-0.5 text-xs leading-snug text-gray-500">
                      Start with zones; drill down in order. Table filters follow your selection.
                    </p>
                  </>
                )}
              </div>
              <hr className="w-full shrink-0 border-0 border-t border-gray-200/90" />
              <div className="min-w-0 px-3 pb-0 pt-1.5 sm:px-4 sm:pb-0 sm:pt-1.5">
                <VendorWiseRechartsBarChart
                  data={unifiedChartData}
                  chartModeKey={unifiedChartModeKey}
                  activeCategory={unifiedDrillLevel === "status" ? chartDrillStatus : null}
                  onBarClick={unifiedChartHasClick ? handleUnifiedBarClick : undefined}
                  plotHeightPx={CHART_PLOT_HEIGHT_PX}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
