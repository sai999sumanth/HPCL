import React, { useMemo } from "react";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type {
  LubesSalesAreaRow,
  SalesAreaTableRow,
} from "./lubesSalesPerformance.types";
import {
  BreakdownChartLegend,
  BreakdownCompareChart,
  BreakdownCompareTable,
  ghostIconButtonClass,
  LoadingBlock,
  PanelShell,
  useBreakdownRowSelection,
  withBreakdownChartPct,
} from "./lubesSalesPerformance.shared";
import { buildSalesAreaChartData } from "./lubesSalesPerformance.utils";
import { LUBES_UI } from "./lubesSalesPerformance.theme";

export type SalesAreaBreakdownPanelProps = {
  loading: boolean;
  refreshing: boolean;
  salesAreaRows: LubesSalesAreaRow[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  onRefresh: () => void;
};

const SalesAreaBreakdownPanel: React.FC<SalesAreaBreakdownPanelProps> = ({
  loading,
  refreshing,
  salesAreaRows,
  displayCurrentFY,
  displayPreviousFY,
  onRefresh,
}) => {
  const salesAreaChartData = useMemo(
    () => buildSalesAreaChartData(salesAreaRows, displayCurrentFY, displayPreviousFY),
    [salesAreaRows, displayCurrentFY, displayPreviousFY]
  );

  const salesAreaTableRows = useMemo<SalesAreaTableRow[]>(
    () => withBreakdownChartPct(salesAreaChartData),
    [salesAreaChartData]
  );

  const salesAreaNames = useMemo(
    () => salesAreaChartData.map((row) => row.name),
    [salesAreaChartData]
  );
  const [selectedSalesAreas, toggleSalesArea] = useBreakdownRowSelection(
    salesAreaNames,
    refreshing
  );

  const filteredChartData = useMemo(() => {
    if (selectedSalesAreas.length === 0) return withBreakdownChartPct(salesAreaChartData);
    const selected = new Set(selectedSalesAreas);
    return withBreakdownChartPct(
      salesAreaChartData.filter((row) => selected.has(row.name))
    );
  }, [salesAreaChartData, selectedSalesAreas]);

  const chartMinWidth = useMemo(
    () => Math.max(320, filteredChartData.length * 44),
    [filteredChartData.length]
  );

  const refreshButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Refresh sales area data"
      disabled={loading || refreshing}
      onClick={onRefresh}
      className={ghostIconButtonClass}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
    </Button>
  );

  return (
    <PanelShell
      icon={<MapPin className="h-4 w-4" />}
      title="Sales Area Breakdown"
      subtitle={`Curr (${displayCurrentFY}) vs Hist (${displayPreviousFY}) · TMT`}
      action={refreshButton}
    >
      {loading ? (
        <LoadingBlock />
      ) : salesAreaChartData.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          No sales area breakdown data available.
        </div>
      ) : (
        <div className="relative">
          {refreshing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
              <Loader2 className={LUBES_UI.loader} />
            </div>
          )}

          <div
            className={`grid grid-cols-1 gap-3 lg:items-start ${LUBES_UI.breakdownChartTableGrid}`}
          >
            <div className="min-w-0">
              {filteredChartData.length === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-center text-sm text-slate-500 sm:h-[260px] md:h-[280px]">
                  No data for the selected sales areas.
                </div>
              ) : (
                <>
                  <BreakdownChartLegend
                    displayCurrentFY={displayCurrentFY}
                    displayPreviousFY={displayPreviousFY}
                  />
                  <div className="overflow-x-auto">
                    <div
                      className="h-[220px] w-full sm:h-[260px] md:h-[280px]"
                      style={{
                        minWidth: filteredChartData.length > 8 ? chartMinWidth : undefined,
                      }}
                    >
                      <BreakdownCompareChart
                        data={filteredChartData}
                        displayCurrentFY={displayCurrentFY}
                        displayPreviousFY={displayPreviousFY}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <BreakdownCompareTable
              title="Sales Areas"
              nameColumnLabel="Area"
              rows={salesAreaTableRows}
              footer={`Curr ${displayCurrentFY} · Hist ${displayPreviousFY} · Click to filter chart`}
              selected={selectedSalesAreas}
              onRowClick={toggleSalesArea}
            />
          </div>
        </div>
      )}
    </PanelShell>
  );
};

export default SalesAreaBreakdownPanel;
