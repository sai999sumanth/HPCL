import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { Button } from "@/@/components/ui/button";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { ZoneGroupedBarChart } from "@/components/widgets/zone-grouped-bar";
import { PLANT_MONTH_ZONE_BAR_CHART_PROPS } from "./plantMonthAnalysisUtils";
import type { PlantMonthZoneAggregatedRow } from "./plantMonthAnalysisUtils";
import { PlantMonthDrillLevelIndicator } from "./PlantMonthDrillLevelIndicator";

export type ZoneChartConfig = {
  chartData: Record<string, unknown>[];
  groups: string[];
} | null;

/** Shared chart chrome props (no productivity slot). State lives in the parent. */
export type PlantMonthChartPanelProps = {
  selectedSapId: string;
  zoneMonthlyAggregated: PlantMonthZoneAggregatedRow[];
  costViewMode: "monthly" | "quarterly";
  setCostViewMode: (v: "monthly" | "quarterly") => void;
  costScopeMode: "overall" | "zone";
  setCostScopeMode: (v: "overall" | "zone") => void;
  drilldownCost: { zone: string; monthCat: string } | null;
  setDrilldownCost: (v: { zone: string; monthCat: string } | null) => void;
  savingsViewMode: "monthly" | "quarterly";
  setSavingsViewMode: (v: "monthly" | "quarterly") => void;
  savingsScopeMode: "overall" | "zone";
  setSavingsScopeMode: (v: "overall" | "zone") => void;
  drilldownSavings: { zone: string; monthCat: string } | null;
  setDrilldownSavings: (v: { zone: string; monthCat: string } | null) => void;
  expandedChartId: string | null;
  setExpandedChartId: Dispatch<SetStateAction<string | null>>;
  isCardExpanded: boolean;
  showZoneGroupedCostCharts: boolean;
  zoneCostMtConfig: ZoneChartConfig;
  zoneCostCrConfig: ZoneChartConfig;
  showZoneGroupedSavingsCharts: boolean;
  zoneSavingsMtConfig: ZoneChartConfig;
  zoneSavingsCrConfig: ZoneChartConfig;
  costChartRef: RefObject<HTMLDivElement | null>;
  costMtChartRef: RefObject<HTMLDivElement | null>;
  savingsChartRef: RefObject<HTMLDivElement | null>;
  savingsMtChartRef: RefObject<HTMLDivElement | null>;
  /** KPI embed: maximize lives on outer card header — hide duplicate on first cost row. */
  hideCostChartRowMaximize?: boolean;
};

export type PlantMonthCostSavingsChartsProps = PlantMonthChartPanelProps & {
  /** Daily productivity block (between cost and savings). */
  productivitySlot: ReactNode;
};

/** Cost: toolbar + INR/MT + Cr charts (inline card). */
export function PlantMonthCostChartsSection(p: PlantMonthChartPanelProps) {
  const {
    selectedSapId,
    zoneMonthlyAggregated,
    costViewMode,
    setCostViewMode,
    costScopeMode,
    setCostScopeMode,
    drilldownCost,
    setDrilldownCost,
    expandedChartId,
    setExpandedChartId,
    isCardExpanded,
    showZoneGroupedCostCharts,
    zoneCostMtConfig,
    zoneCostCrConfig,
    costChartRef,
    costMtChartRef,
    hideCostChartRowMaximize = false,
  } = p;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <span className="text-xs font-semibold text-gray-700">Cost</span>
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setCostViewMode("quarterly")}
            className={`px-2 py-1 text-xs font-medium ${
              costViewMode === "quarterly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Quarterly
          </button>
          <button
            type="button"
            onClick={() => setCostViewMode("monthly")}
            className={`px-2 py-1 text-xs font-medium border-l border-gray-300 ${
              costViewMode === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Monthly
          </button>
        </div>
        {!selectedSapId && zoneMonthlyAggregated.length > 0 && costViewMode === "monthly" && (
          <>
            <span className="text-xs font-medium text-gray-600">Cost scope:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="plant-month-cost-scope"
                checked={costScopeMode === "overall"}
                onChange={() => {
                  setDrilldownCost(null);
                  setCostScopeMode("overall");
                }}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300"
              />
              <span className="text-xs font-medium text-gray-700">Overall</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="plant-month-cost-scope"
                checked={costScopeMode === "zone"}
                onChange={() => {
                  setDrilldownCost(null);
                  setCostScopeMode("zone");
                  setCostViewMode("monthly");
                }}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300"
              />
              <span className="text-xs font-medium text-gray-700">Zone</span>
            </label>
            {costScopeMode === "zone" && (
              <>
                <PlantMonthDrillLevelIndicator level={drilldownCost ? 1 : 0} />
                {drilldownCost && (
                  <>
                    <span className="text-xs text-gray-600">
                      Zone <span className="font-semibold text-gray-800">{drilldownCost.zone}</span>
                    </span>
                    <Button
                      type="button"
                      onClick={() => setDrilldownCost(null)}
                      className="text-white text-xs p-1 h-7 rounded-sm bg-blue-600 hover:bg-blue-700"
                      title="Back to cost zone chart"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-bold text-gray-800 shrink-0">Total Cost INR Per MT (Present Year)</span>
          {!isCardExpanded && !hideCostChartRowMaximize && (
            <Button
              type="button"
              className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 shrink-0"
              onClick={() => setExpandedChartId((id) => (id === "cost" ? null : "cost"))}
              title="Maximize"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        {expandedChartId === "cost" ? (
          <div className="w-full h-[280px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
            Chart expanded
          </div>
        ) : showZoneGroupedCostCharts && zoneCostMtConfig ? (
          <ZoneGroupedBarChart
            {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
            chartData={zoneCostMtConfig.chartData}
            groups={zoneCostMtConfig.groups}
            categoryField="monthCat"
            categoryLabelField="label"
            valueSuffix="INR/MT"
            barLabelZoneContext={drilldownCost?.zone}
            onBarClick={!drilldownCost ? (monthCat, zoneName) => setDrilldownCost({ zone: zoneName, monthCat }) : undefined}
            showLegend
            height={400}
          />
        ) : showZoneGroupedCostCharts && !zoneCostMtConfig ? (
          <div className="w-full h-[400px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
            No zone breakdown for this metric
          </div>
        ) : (
          <div ref={costMtChartRef} className="w-full h-[400px]" />
        )}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-bold text-gray-800 shrink-0">Total Cost in Cr (Present Year)</span>
        </div>
        {expandedChartId === "cost" ? (
          <div className="w-full h-[280px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
            Chart expanded
          </div>
        ) : showZoneGroupedCostCharts && zoneCostCrConfig ? (
          <ZoneGroupedBarChart
            {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
            chartData={zoneCostCrConfig.chartData}
            groups={zoneCostCrConfig.groups}
            categoryField="monthCat"
            categoryLabelField="label"
            valueSuffix="Cr"
            barLabelZoneContext={drilldownCost?.zone}
            onBarClick={!drilldownCost ? (monthCat, zoneName) => setDrilldownCost({ zone: zoneName, monthCat }) : undefined}
            showLegend
            height={400}
          />
        ) : showZoneGroupedCostCharts && !zoneCostCrConfig ? (
          <div className="w-full h-[400px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
            No zone breakdown for this metric
          </div>
        ) : (
          <div ref={costChartRef} className="w-full h-[400px]" />
        )}
      </div>
    </>
  );
}

/** Savings: toolbar + INR/MT + Cr charts (inline card). */
export function PlantMonthSavingsChartsSection(p: PlantMonthChartPanelProps) {
  const {
    selectedSapId,
    zoneMonthlyAggregated,
    savingsViewMode,
    setSavingsViewMode,
    savingsScopeMode,
    setSavingsScopeMode,
    drilldownSavings,
    setDrilldownSavings,
    expandedChartId,
    setExpandedChartId,
    isCardExpanded,
    showZoneGroupedSavingsCharts,
    zoneSavingsMtConfig,
    zoneSavingsCrConfig,
    savingsChartRef,
    savingsMtChartRef,
  } = p;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-1 mt-4">
        <span className="text-xs font-semibold text-gray-700">Savings</span>
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setSavingsViewMode("quarterly")}
            className={`px-2 py-1 text-xs font-medium ${
              savingsViewMode === "quarterly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Quarterly
          </button>
          <button
            type="button"
            onClick={() => setSavingsViewMode("monthly")}
            className={`px-2 py-1 text-xs font-medium border-l border-gray-300 ${
              savingsViewMode === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Monthly
          </button>
        </div>
        {!selectedSapId && zoneMonthlyAggregated.length > 0 && savingsViewMode === "monthly" && (
          <>
            <span className="text-xs font-medium text-gray-600">Savings scope:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="plant-month-savings-scope"
                checked={savingsScopeMode === "overall"}
                onChange={() => {
                  setDrilldownSavings(null);
                  setSavingsScopeMode("overall");
                }}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300"
              />
              <span className="text-xs font-medium text-gray-700">Overall</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="plant-month-savings-scope"
                checked={savingsScopeMode === "zone"}
                onChange={() => {
                  setDrilldownSavings(null);
                  setSavingsScopeMode("zone");
                  setSavingsViewMode("monthly");
                }}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300"
              />
              <span className="text-xs font-medium text-gray-700">Zone</span>
            </label>
            {savingsScopeMode === "zone" && (
              <>
                <PlantMonthDrillLevelIndicator level={drilldownSavings ? 1 : 0} />
                {drilldownSavings && (
                  <>
                    <span className="text-xs text-gray-600">
                      Zone <span className="font-semibold text-gray-800">{drilldownSavings.zone}</span>
                    </span>
                    <Button
                      type="button"
                      onClick={() => setDrilldownSavings(null)}
                      className="text-white text-xs p-1 h-7 rounded-sm bg-blue-600 hover:bg-blue-700"
                      title="Back to savings zone chart"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-bold text-gray-800 shrink-0">Savings INR Per MT (Present Year)</span>
          {!isCardExpanded && (
            <Button
              type="button"
              className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 shrink-0"
              onClick={() => setExpandedChartId((id) => (id === "savings" ? null : "savings"))}
              title="Maximize"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        {expandedChartId === "savings" ? (
          <div className="w-full h-[280px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
            Chart expanded
          </div>
        ) : showZoneGroupedSavingsCharts && zoneSavingsMtConfig ? (
          <ZoneGroupedBarChart
            {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
            chartData={zoneSavingsMtConfig.chartData}
            groups={zoneSavingsMtConfig.groups}
            categoryField="monthCat"
            categoryLabelField="label"
            valueSuffix="INR/MT"
            barLabelZoneContext={drilldownSavings?.zone}
            onBarClick={!drilldownSavings ? (monthCat, zoneName) => setDrilldownSavings({ zone: zoneName, monthCat }) : undefined}
            showLegend
            allowNegativeY
            height={400}
          />
        ) : showZoneGroupedSavingsCharts && !zoneSavingsMtConfig ? (
          <div className="w-full min-h-[400px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
            No zone breakdown for this metric
          </div>
        ) : (
          <div ref={savingsMtChartRef} className="w-full min-h-[400px]" />
        )}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-bold text-gray-800 shrink-0">Savings in Cr (Present Year)</span>
        </div>
        {expandedChartId === "savings" ? (
          <div className="w-full h-[280px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
            Chart expanded
          </div>
        ) : showZoneGroupedSavingsCharts && zoneSavingsCrConfig ? (
          <ZoneGroupedBarChart
            {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
            chartData={zoneSavingsCrConfig.chartData}
            groups={zoneSavingsCrConfig.groups}
            categoryField="monthCat"
            categoryLabelField="label"
            valueSuffix="Cr"
            barLabelZoneContext={drilldownSavings?.zone}
            onBarClick={!drilldownSavings ? (monthCat, zoneName) => setDrilldownSavings({ zone: zoneName, monthCat }) : undefined}
            showLegend
            allowNegativeY
            height={420}
          />
        ) : showZoneGroupedSavingsCharts && !zoneSavingsCrConfig ? (
          <div className="w-full min-h-[420px] flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 rounded">
            No zone breakdown for this metric
          </div>
        ) : (
          <div ref={savingsChartRef} className="w-full min-h-[420px]" />
        )}
      </div>
    </>
  );
}

/** Full-screen modal body: cost charts (reuses same refs as inline). */
export function PlantMonthCostExpandBody(p: PlantMonthChartPanelProps) {
  const {
    selectedSapId,
    zoneMonthlyAggregated,
    costViewMode,
    setCostViewMode,
    costScopeMode,
    setCostScopeMode,
    drilldownCost,
    setDrilldownCost,
    showZoneGroupedCostCharts,
    zoneCostMtConfig,
    zoneCostCrConfig,
    costChartRef,
    costMtChartRef,
  } = p;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setCostViewMode("quarterly")}
            className={`px-2 py-1 text-xs font-medium ${
              costViewMode === "quarterly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Quarterly
          </button>
          <button
            type="button"
            onClick={() => setCostViewMode("monthly")}
            className={`px-2 py-1 text-xs font-medium border-l border-gray-300 ${
              costViewMode === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Monthly
          </button>
        </div>
        {!selectedSapId && zoneMonthlyAggregated.length > 0 && costViewMode === "monthly" && (
          <>
            <span className="text-xs text-gray-600">Cost scope:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="cost-scope-expanded"
                checked={costScopeMode === "overall"}
                onChange={() => {
                  setDrilldownCost(null);
                  setCostScopeMode("overall");
                }}
                className="w-3 h-3 text-blue-600"
              />
              <span className="text-xs text-gray-700">Overall</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="cost-scope-expanded"
                checked={costScopeMode === "zone"}
                onChange={() => {
                  setDrilldownCost(null);
                  setCostScopeMode("zone");
                  setCostViewMode("monthly");
                }}
                className="w-3 h-3 text-blue-600"
              />
              <span className="text-xs text-gray-700">Zone</span>
            </label>
          </>
        )}
      </div>
      <div className="mb-1">
        <span className="text-sm font-bold text-gray-800">Total Cost INR Per MT (Present Year)</span>
      </div>
      {showZoneGroupedCostCharts && zoneCostMtConfig ? (
        <ZoneGroupedBarChart
          {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
          chartData={zoneCostMtConfig.chartData}
          groups={zoneCostMtConfig.groups}
          categoryField="monthCat"
          categoryLabelField="label"
          valueSuffix="INR/MT"
          barLabelZoneContext={drilldownCost?.zone}
          onBarClick={!drilldownCost ? (monthCat, zoneName) => setDrilldownCost({ zone: zoneName, monthCat }) : undefined}
          showLegend
          height={0}
          className="w-full flex-1 min-h-[380px]"
        />
      ) : showZoneGroupedCostCharts && !zoneCostMtConfig ? (
        <div className="w-full flex-1 min-h-[380px] flex items-center justify-center text-gray-400 text-xs border border-dashed rounded">
          No zone breakdown for this metric
        </div>
      ) : (
        <div ref={costMtChartRef} className="w-full flex-1 min-h-[380px]" />
      )}
      <div className="mb-1 mt-4">
        <span className="text-sm font-bold text-gray-800">Total Cost in Cr (Present Year)</span>
      </div>
      {showZoneGroupedCostCharts && zoneCostCrConfig ? (
        <ZoneGroupedBarChart
          {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
          chartData={zoneCostCrConfig.chartData}
          groups={zoneCostCrConfig.groups}
          categoryField="monthCat"
          categoryLabelField="label"
          valueSuffix="Cr"
          barLabelZoneContext={drilldownCost?.zone}
          onBarClick={!drilldownCost ? (monthCat, zoneName) => setDrilldownCost({ zone: zoneName, monthCat }) : undefined}
          showLegend
          height={0}
          className="w-full flex-1 min-h-[380px]"
        />
      ) : showZoneGroupedCostCharts && !zoneCostCrConfig ? (
        <div className="w-full flex-1 min-h-[380px] flex items-center justify-center text-gray-400 text-xs border border-dashed rounded">
          No zone breakdown for this metric
        </div>
      ) : (
        <div ref={costChartRef} className="w-full flex-1 min-h-[380px]" />
      )}
    </>
  );
}

/** Full-screen modal body: savings charts. */
export function PlantMonthSavingsExpandBody(p: PlantMonthChartPanelProps) {
  const {
    selectedSapId,
    zoneMonthlyAggregated,
    savingsViewMode,
    setSavingsViewMode,
    savingsScopeMode,
    setSavingsScopeMode,
    drilldownSavings,
    setDrilldownSavings,
    showZoneGroupedSavingsCharts,
    zoneSavingsMtConfig,
    zoneSavingsCrConfig,
    savingsChartRef,
    savingsMtChartRef,
  } = p;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setSavingsViewMode("quarterly")}
            className={`px-2 py-1 text-xs font-medium ${
              savingsViewMode === "quarterly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Quarterly
          </button>
          <button
            type="button"
            onClick={() => setSavingsViewMode("monthly")}
            className={`px-2 py-1 text-xs font-medium border-l border-gray-300 ${
              savingsViewMode === "monthly" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Monthly
          </button>
        </div>
        {!selectedSapId && zoneMonthlyAggregated.length > 0 && savingsViewMode === "monthly" && (
          <>
            <span className="text-xs text-gray-600">Savings scope:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="savings-scope-expanded"
                checked={savingsScopeMode === "overall"}
                onChange={() => {
                  setDrilldownSavings(null);
                  setSavingsScopeMode("overall");
                }}
                className="w-3 h-3 text-blue-600"
              />
              <span className="text-xs text-gray-700">Overall</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="savings-scope-expanded"
                checked={savingsScopeMode === "zone"}
                onChange={() => {
                  setDrilldownSavings(null);
                  setSavingsScopeMode("zone");
                  setSavingsViewMode("monthly");
                }}
                className="w-3 h-3 text-blue-600"
              />
              <span className="text-xs text-gray-700">Zone</span>
            </label>
          </>
        )}
      </div>
      <div className="mb-1">
        <span className="text-sm font-bold text-gray-800">Savings INR Per MT (Present Year)</span>
      </div>
      {showZoneGroupedSavingsCharts && zoneSavingsMtConfig ? (
        <ZoneGroupedBarChart
          {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
          chartData={zoneSavingsMtConfig.chartData}
          groups={zoneSavingsMtConfig.groups}
          categoryField="monthCat"
          categoryLabelField="label"
          valueSuffix="INR/MT"
          barLabelZoneContext={drilldownSavings?.zone}
          onBarClick={!drilldownSavings ? (monthCat, zoneName) => setDrilldownSavings({ zone: zoneName, monthCat }) : undefined}
          showLegend
          allowNegativeY
          height={0}
          className="w-full flex-1 min-h-[380px]"
        />
      ) : showZoneGroupedSavingsCharts && !zoneSavingsMtConfig ? (
        <div className="w-full flex-1 min-h-[380px] flex items-center justify-center text-gray-400 text-xs border border-dashed rounded">
          No zone breakdown for this metric
        </div>
      ) : (
        <div ref={savingsMtChartRef} className="w-full flex-1 min-h-[380px]" />
      )}
      <div className="mb-1 mt-4">
        <span className="text-sm font-bold text-gray-800">Savings in Cr (Present Year)</span>
      </div>
      {showZoneGroupedSavingsCharts && zoneSavingsCrConfig ? (
        <ZoneGroupedBarChart
          {...PLANT_MONTH_ZONE_BAR_CHART_PROPS}
          chartData={zoneSavingsCrConfig.chartData}
          groups={zoneSavingsCrConfig.groups}
          categoryField="monthCat"
          categoryLabelField="label"
          valueSuffix="Cr"
          barLabelZoneContext={drilldownSavings?.zone}
          onBarClick={!drilldownSavings ? (monthCat, zoneName) => setDrilldownSavings({ zone: zoneName, monthCat }) : undefined}
          showLegend
          allowNegativeY
          height={0}
          className="w-full flex-1 min-h-[380px]"
        />
      ) : showZoneGroupedSavingsCharts && !zoneSavingsCrConfig ? (
        <div className="w-full flex-1 min-h-[380px] flex items-center justify-center text-gray-400 text-xs border border-dashed rounded">
          No zone breakdown for this metric
        </div>
      ) : (
        <div ref={savingsChartRef} className="w-full flex-1 min-h-[380px]" />
      )}
    </>
  );
}

/** Composes cost block, productivity slot, and savings block in one grid column. */
export default function PlantMonthCostSavingsCharts(props: PlantMonthCostSavingsChartsProps) {
  const { productivitySlot } = props;
  return (
    <div className="grid grid-cols-1 gap-2 w-full min-w-0">
      <PlantMonthCostChartsSection {...props} />
      {productivitySlot}
      <PlantMonthSavingsChartsSection {...props} />
    </div>
  );
}
