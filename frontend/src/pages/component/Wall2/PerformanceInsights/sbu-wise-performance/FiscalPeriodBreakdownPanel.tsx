import React, { useState } from "react";
import { CalendarRange, Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type { PeriodCardItem, PeriodFilter, PeriodViewMode } from "./lubesSalesPerformance.types";
import type { LubesPeriodTrendPoint } from "./lubesSalesPerformance.utils";
import {
  ghostIconButtonClass,
  LoadingBlock,
  PanelShell,
  PERIOD_VIEW_OPTIONS,
  PeriodSummaryCard,
  periodCardsGridClass,
} from "./lubesSalesPerformance.shared";
import { LUBES_UI } from "./lubesSalesPerformance.theme";
import { isPeriodFilterChecked } from "./lubesSalesPerformance.utils";
import LubesPeriodTrendAmChart from "./LubesPeriodTrendAmChart";

export type FiscalPeriodBreakdownPanelProps = {
  loading: boolean;
  refreshing: boolean;
  periodView: PeriodViewMode;
  periodCardItems: PeriodCardItem[];
  chartData: LubesPeriodTrendPoint[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  appliedPeriodFilters: PeriodFilter[];
  onPeriodViewChange: (mode: PeriodViewMode) => void;
  onTogglePeriodFilter: (filter: PeriodFilter) => void;
  onRefresh: () => void;
};

const FiscalPeriodBreakdownPanel: React.FC<FiscalPeriodBreakdownPanelProps> = ({
  loading,
  refreshing,
  periodView,
  periodCardItems,
  chartData,
  displayCurrentFY,
  displayPreviousFY,
  appliedPeriodFilters,
  onPeriodViewChange,
  onTogglePeriodFilter,
  onRefresh,
}) => {
  const [showMonthlyChart, setShowMonthlyChart] = useState(false);

  const periodViewTabs = (
    <div className={LUBES_UI.tabGroup}>
      {PERIOD_VIEW_OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => {
            onPeriodViewChange(mode);
            setShowMonthlyChart(false);
          }}
          className={`rounded px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all ${
            periodView === mode ? LUBES_UI.tabActive : LUBES_UI.tabIdle
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const periodRefreshButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Refresh period data"
      disabled={loading || refreshing}
      onClick={onRefresh}
      className={ghostIconButtonClass}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
    </Button>
  );

  const monthlyChartToggleButton = periodView === "month" && (
    <Button
      type="button"
      variant={showMonthlyChart ? "default" : "ghost"}
      size="sm"
      onClick={() => setShowMonthlyChart(!showMonthlyChart)}
      className="h-7 gap-1 px-2 text-xs font-semibold"
    >
      <BarChart3 className="h-3 w-3" />
      {showMonthlyChart ? "Hide Chart" : "Show Chart"}
    </Button>
  );

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {monthlyChartToggleButton}
      {periodViewTabs}
      {periodRefreshButton}
    </div>
  );

  return (
    <PanelShell
      icon={<CalendarRange className="h-4 w-4" />}
      title="Fiscal Period Breakdown"
      action={headerActions}
      fillHeight
    >
      {loading ? (
        <LoadingBlock fill />
      ) : periodCardItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-4 text-center text-sm text-slate-500">
          No period breakdown data available.
        </div>
      ) : (
        <div className="relative flex min-h-0 w-full flex-1">
          {refreshing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
              <Loader2 className={LUBES_UI.loader} />
            </div>
          )}
          
          {(periodView === "half" || periodView === "quarter") ? (
            <div className="flex min-h-0 w-full flex-1 gap-4 p-2">
              {/* Cards on left */}
              <div className="min-h-0 overflow-y-auto pr-1" style={{ width: periodView === "quarter" ? "40%" : "33.333%" }}>
                <div className="flex flex-col gap-2">
                  {periodView === "quarter" ? (
                    <>
                      {/* First row: Q1, Q2 */}
                      <div className="grid grid-cols-2 gap-2">
                        {periodCardItems.slice(0, 2).map((item) => (
                          <PeriodSummaryCard
                            key={item.id}
                            item={item}
                            highlighted={isPeriodFilterChecked(appliedPeriodFilters, {
                              mode: periodView,
                              id: item.id,
                            })}
                            onClick={() =>
                              onTogglePeriodFilter({ mode: periodView, id: item.id })
                            }
                            increaseHeight
                          />
                        ))}
                      </div>
                      {/* Second row: Q3, Q4 */}
                      <div className="grid grid-cols-2 gap-2">
                        {periodCardItems.slice(2, 4).map((item) => (
                          <PeriodSummaryCard
                            key={item.id}
                            item={item}
                            highlighted={isPeriodFilterChecked(appliedPeriodFilters, {
                              mode: periodView,
                              id: item.id,
                            })}
                            onClick={() =>
                              onTogglePeriodFilter({ mode: periodView, id: item.id })
                            }
                            increaseHeight
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    // Half-year view: vertical cards
                    periodCardItems.map((item) => (
                      <PeriodSummaryCard
                        key={item.id}
                        item={item}
                        highlighted={isPeriodFilterChecked(appliedPeriodFilters, {
                          mode: periodView,
                          id: item.id,
                        })}
                        onClick={() =>
                          onTogglePeriodFilter({ mode: periodView, id: item.id })
                        }
                        increaseHeight
                      />
                    ))
                  )}
                </div>
              </div>
              
              {/* Line chart on right */}
              <div className="min-h-0 rounded-lg border border-slate-200 bg-white" style={{ flex: periodView === "quarter" ? "0 0 60%" : "1 1 0" }}>
                <LubesPeriodTrendAmChart
                  data={chartData}
                  previousFY={displayPreviousFY}
                  currentFY={displayCurrentFY}
                  periodView={periodView}
                  height={180}
                />
              </div>
            </div>
          ) : (periodView === "month" && showMonthlyChart) ? (
            // Monthly chart only view
            <div className="min-h-0 w-full flex-1 p-2">
              <div className="min-h-0 h-full w-full rounded-lg border border-slate-200 bg-white">
                <LubesPeriodTrendAmChart
                  data={chartData}
                  previousFY={displayPreviousFY}
                  currentFY={displayCurrentFY}
                  periodView={periodView}
                  height={180}
                />
              </div>
            </div>
          ) : (
            // Month view without chart
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className={`w-full ${periodCardsGridClass(periodView)}`}>
                  {periodCardItems.map((item) => (
                    <PeriodSummaryCard
                      key={item.id}
                      item={item}
                      highlighted={isPeriodFilterChecked(appliedPeriodFilters, {
                        mode: periodView,
                        id: item.id,
                      })}
                      onClick={() =>
                        onTogglePeriodFilter({ mode: periodView, id: item.id })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
};

export default FiscalPeriodBreakdownPanel;
