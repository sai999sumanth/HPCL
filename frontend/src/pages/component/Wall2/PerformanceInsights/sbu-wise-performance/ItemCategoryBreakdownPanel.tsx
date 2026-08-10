import React, { useMemo } from "react";
import { Loader2, RefreshCw, Tags } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type {
  LubesItemCategoryRow,
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
import { buildItemCategoryChartData } from "./lubesSalesPerformance.utils";
import { LUBES_UI } from "./lubesSalesPerformance.theme";

export type ItemCategoryBreakdownPanelProps = {
  loading: boolean;
  refreshing: boolean;
  itemCategoryRows: LubesItemCategoryRow[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  leadingAction?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  onRefresh: () => void;
};

const ItemCategoryBreakdownPanel: React.FC<ItemCategoryBreakdownPanelProps> = ({
  loading,
  refreshing,
  itemCategoryRows,
  displayCurrentFY,
  displayPreviousFY,
  title = "Item Category Breakdown",
  subtitle = `Curr (${displayCurrentFY}) vs Hist (${displayPreviousFY}) · TMT`,
  emptyMessage = "No item category breakdown data available.",
  leadingAction,
  icon,
  className,
  onRefresh,
}) => {
  const chartData = useMemo(
    () => buildItemCategoryChartData(itemCategoryRows, displayCurrentFY, displayPreviousFY),
    [itemCategoryRows, displayCurrentFY, displayPreviousFY]
  );

  const tableRows = useMemo<SalesAreaTableRow[]>(
    () => withBreakdownChartPct(chartData),
    [chartData]
  );

  const chartNames = useMemo(() => chartData.map((row) => row.name), [chartData]);
  const [selectedItems, toggleItem] = useBreakdownRowSelection(chartNames, refreshing);

  const filteredChartData = useMemo(() => {
    if (selectedItems.length === 0) return withBreakdownChartPct(chartData);
    const selected = new Set(selectedItems);
    return withBreakdownChartPct(chartData.filter((row) => selected.has(row.name)));
  }, [chartData, selectedItems]);

  const chartMinWidth = useMemo(
    () => Math.max(320, filteredChartData.length * 44),
    [filteredChartData.length]
  );

  const refreshButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Refresh item category data"
      disabled={loading || refreshing}
      onClick={onRefresh}
      className={ghostIconButtonClass}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
    </Button>
  );

  return (
    <PanelShell
      icon={icon ?? <Tags className="h-4 w-4" />}
      title={title}
      subtitle={subtitle}
      action={
        leadingAction ? (
          <div className="flex items-center gap-1">
            {leadingAction}
            {refreshButton}
          </div>
        ) : (
          refreshButton
        )
      }
      className={className}
    >
      {loading ? (
        <LoadingBlock />
      ) : chartData.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          {emptyMessage}
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
                  No data for the selected items.
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
              title="Items"
              nameColumnLabel="Item"
              rows={tableRows}
              footer={`Curr ${displayCurrentFY} · Hist ${displayPreviousFY} · Click to filter chart`}
              selected={selectedItems}
              onRowClick={toggleItem}
            />
          </div>
        </div>
      )}
    </PanelShell>
  );
};

export default ItemCategoryBreakdownPanel;
