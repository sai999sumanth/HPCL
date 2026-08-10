import React, { useMemo } from "react";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type { SalesAreaTableRow } from "./lubesSalesPerformance.types";
import {
  BreakdownChartLegend,
  BreakdownCompareChart,
  BreakdownCompareTable,
  ghostIconButtonClass,
  LoadingBlock,
  PanelShell,
  withBreakdownChartPct,
} from "./lubesSalesPerformance.shared";
import { LUBES_UI } from "./lubesSalesPerformance.theme";

export type DrilldownBreadcrumb = {
  label: string;
  onClick?: () => void;
};

export type BreakdownDrilldownPanelProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  loading: boolean;
  refreshing: boolean;
  drillLoading?: boolean;
  displayCurrentFY: string;
  displayPreviousFY: string;
  chartData: SalesAreaTableRow[];
  tableTitle: string;
  tableFooterHint: string;
  breadcrumbs: DrilldownBreadcrumb[];
  canDrillDeeper: boolean;
  onDrillInto: (name: string) => void;
  onRefresh: () => void;
  leadingAction?: React.ReactNode;
  emptyMessage?: string;
};

const BreakdownDrilldownPanel: React.FC<BreakdownDrilldownPanelProps> = ({
  icon,
  title,
  subtitle,
  loading,
  refreshing,
  drillLoading = false,
  displayCurrentFY,
  displayPreviousFY,
  chartData,
  tableTitle,
  tableFooterHint,
  breadcrumbs,
  canDrillDeeper,
  onDrillInto,
  onRefresh,
  leadingAction,
  emptyMessage = "No data available.",
}) => {
  const tableRows = useMemo(() => withBreakdownChartPct(chartData), [chartData]);

  const refreshButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Refresh ${title}`}
      disabled={loading || refreshing || drillLoading}
      onClick={onRefresh}
      className={ghostIconButtonClass}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
    </Button>
  );

  const headerAction = leadingAction ? (
    <div className="flex items-center gap-1.5">
      {leadingAction}
      {refreshButton}
    </div>
  ) : (
    refreshButton
  );

  return (
    <PanelShell icon={icon} title={title} subtitle={subtitle} action={headerAction}>
      {loading ? (
        <LoadingBlock />
      ) : tableRows.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">{emptyMessage}</div>
      ) : (
        <div className="relative">
          {(refreshing || drillLoading) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
              <Loader2 className={LUBES_UI.loader} />
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px]">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                )}
                {crumb.onClick ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="max-w-[10rem] truncate font-medium text-slate-600 hover:text-slate-900 hover:underline"
                    title={crumb.label}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    className="max-w-[12rem] truncate font-semibold text-slate-900"
                    title={crumb.label}
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>

          <div
            className={`grid grid-cols-1 gap-2 lg:items-stretch ${LUBES_UI.breakdownChartTableGrid}`}
          >
            <div className="min-w-0">
              <BreakdownChartLegend
                displayCurrentFY={displayCurrentFY}
                displayPreviousFY={displayPreviousFY}
                className="mb-1"
              />
              <div className="h-[300px] w-full sm:h-[320px] md:h-[340px]">
                <BreakdownCompareChart
                  data={tableRows}
                  displayCurrentFY={displayCurrentFY}
                  displayPreviousFY={displayPreviousFY}
                  scrollable
                  onBarClick={
                    canDrillDeeper ? (row) => onDrillInto(row.name) : undefined
                  }
                />
              </div>
            </div>

            <BreakdownCompareTable
              key={tableTitle}
              title={tableTitle}
              nameColumnLabel="Name"
              rows={tableRows}
              footer={tableFooterHint}
              onRowClick={canDrillDeeper ? onDrillInto : undefined}
              maxHeightClass="max-h-[300px] sm:max-h-[320px] md:max-h-[340px]"
            />
          </div>
        </div>
      )}
    </PanelShell>
  );
};

export default BreakdownDrilldownPanel;
