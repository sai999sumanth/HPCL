import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import type {
  LubesRegionalOfficerRow,
  SalesAreaChartRow,
} from "./lubesSalesPerformance.types";
import BreakdownDrilldownPanel, { type DrilldownBreadcrumb } from "./BreakdownDrilldownPanel";
import { withBreakdownChartPct } from "./lubesSalesPerformance.shared";
import {
  buildBldCategoryChartData,
  buildLubesBldCategoryPayload,
  buildLubesBldCategoryYtdPayload,
  buildLubesRegionalOfficerYtdPayload,
  buildLubesSalesAreaPayload,
  buildLubesSalesAreaYtdPayload,
  buildRegionalOfficerChartData,
  buildSalesAreaChartData,
  mapLubesBldCategoryRows,
  mapLubesRegionalOfficerRows,
  mapLubesSalesAreaRows,
  normalizeAggregationRows,
} from "./lubesSalesPerformance.utils";

type RoDrillLevel = "ro" | "sa" | "bld";

type RoDrillState = {
  level: RoDrillLevel;
  regionalOfficer?: string;
  salesArea?: string;
};

export type RegionalOfficerDrilldownPanelProps = {
  loading: boolean;
  refreshing: boolean;
  fiscalYears: string[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  regionalOfficerRows: LubesRegionalOfficerRow[];
  /** Shared YTD toggle — when true, all drill levels use date-ranged API calls */
  ytdActive: boolean;
  onYtdChange: (active: boolean) => void;
  getBaseFilters: () => Record<string, string[]>;
  filtersKey: string;
  onExitDrilldown: () => void;
  onRefresh: () => void;
};

const toYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const RegionalOfficerDrilldownPanel: React.FC<RegionalOfficerDrilldownPanelProps> = ({
  loading,
  refreshing,
  fiscalYears,
  displayCurrentFY,
  displayPreviousFY,
  regionalOfficerRows,
  ytdActive,
  onYtdChange,
  getBaseFilters,
  filtersKey,
  onExitDrilldown,
  onRefresh,
}) => {
  const [drillState, setDrillState] = useState<RoDrillState>({ level: "ro" });
  const [drillChartData, setDrillChartData] = useState<SalesAreaChartRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // YTD RO rows — fetched when ytdActive and at ro level
  const [ytdRoRows, setYtdRoRows] = useState<LubesRegionalOfficerRow[] | null>(null);
  const [ytdRoLoading, setYtdRoLoading] = useState(false);

  const prevFY = useMemo(() => {
    const startYear = parseInt(displayCurrentFY.split("-")[0], 10);
    return `${startYear - 1}-${startYear}`;
  }, [displayCurrentFY]);

  const activePreviousFY = ytdActive ? prevFY : displayPreviousFY;

  /** Build YTD date range strings */
  const getYtdDates = useCallback(() => {
    const today = new Date();
    const currentDateTo = toYMD(today);
    const prevYearToday = new Date(today);
    prevYearToday.setFullYear(today.getFullYear() - 1);
    const prevDateTo = toYMD(prevYearToday);
    const currentFYStartYear = parseInt(displayCurrentFY.split("-")[0], 10);
    return {
      currentDateFrom: `${currentFYStartYear}0401`,
      currentDateTo,
      prevDateFrom: `${currentFYStartYear - 1}0401`,
      prevDateTo,
    };
  }, [displayCurrentFY]);

  const fetchYtdRoRows = useCallback(async () => {
    setYtdRoLoading(true);
    try {
      const { currentDateFrom, currentDateTo, prevDateFrom, prevDateTo } = getYtdDates();
      const baseFilters = getBaseFilters();
      const [currentRes, prevRes] = await Promise.all([
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesRegionalOfficerYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, baseFilters)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesRegionalOfficerYtdPayload(prevFY, prevDateFrom, prevDateTo, baseFilters)
        ),
      ]);
      setYtdRoRows([
        ...mapLubesRegionalOfficerRows(normalizeAggregationRows(currentRes.data)),
        ...mapLubesRegionalOfficerRows(normalizeAggregationRows(prevRes.data)),
      ]);
    } catch {
      setYtdRoRows([]);
    } finally {
      setYtdRoLoading(false);
    }
  }, [displayCurrentFY, prevFY, getYtdDates, getBaseFilters]);

  useEffect(() => {
    setYtdRoRows(null);
  }, [displayCurrentFY, filtersKey]);

  // Auto-fetch YTD RO rows when needed
  useEffect(() => {
    if (ytdActive && drillState.level === "ro" && ytdRoRows === null && !ytdRoLoading) {
      void fetchYtdRoRows();
    }
  }, [ytdActive, drillState.level, ytdRoRows, ytdRoLoading, fetchYtdRoRows]);

  const topLevelRows = ytdActive ? (ytdRoRows ?? []) : regionalOfficerRows;

  const topLevelChartData = useMemo(
    () => buildRegionalOfficerChartData(topLevelRows, displayCurrentFY, activePreviousFY),
    [topLevelRows, displayCurrentFY, activePreviousFY]
  );

  const fetchDrillData = useCallback(
    async (state: RoDrillState) => {
      if (state.level === "ro") {
        return buildRegionalOfficerChartData(topLevelRows, displayCurrentFY, activePreviousFY);
      }

      const baseFilters = getBaseFilters();

      if (ytdActive) {
        const { currentDateFrom, currentDateTo, prevDateFrom, prevDateTo } = getYtdDates();

        if (state.level === "sa" && state.regionalOfficer) {
          const extraFilters = { ...baseFilters, ORG_RO_NM: [state.regionalOfficer] };
          const [currentRes, prevRes] = await Promise.all([
            apiClient.post(
              "/api/tableanalytics/generate_data_aggregations",
              buildLubesSalesAreaYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, extraFilters)
            ),
            apiClient.post(
              "/api/tableanalytics/generate_data_aggregations",
              buildLubesSalesAreaYtdPayload(prevFY, prevDateFrom, prevDateTo, extraFilters)
            ),
          ]);
          return buildSalesAreaChartData(
            [
              ...mapLubesSalesAreaRows(normalizeAggregationRows(currentRes.data)),
              ...mapLubesSalesAreaRows(normalizeAggregationRows(prevRes.data)),
            ],
            displayCurrentFY,
            activePreviousFY
          );
        }

        if (state.level === "bld" && state.regionalOfficer && state.salesArea) {
          const extraFilters = {
            ...baseFilters,
            ORG_RO_NM: [state.regionalOfficer],
            ORG_SA_NM: [state.salesArea],
          };
          const [currentRes, prevRes] = await Promise.all([
            apiClient.post(
              "/api/tableanalytics/generate_data_aggregations",
              buildLubesBldCategoryYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, extraFilters)
            ),
            apiClient.post(
              "/api/tableanalytics/generate_data_aggregations",
              buildLubesBldCategoryYtdPayload(prevFY, prevDateFrom, prevDateTo, extraFilters)
            ),
          ]);
          return buildBldCategoryChartData(
            [
              ...mapLubesBldCategoryRows(normalizeAggregationRows(currentRes.data)),
              ...mapLubesBldCategoryRows(normalizeAggregationRows(prevRes.data)),
            ],
            displayCurrentFY,
            activePreviousFY
          );
        }
      } else {
        if (state.level === "sa" && state.regionalOfficer) {
          const response = await apiClient.post(
            "/api/tableanalytics/generate_data_aggregations",
            buildLubesSalesAreaPayload(fiscalYears, {
              ...baseFilters,
              ORG_RO_NM: [state.regionalOfficer],
            })
          );
          return buildSalesAreaChartData(
            mapLubesSalesAreaRows(normalizeAggregationRows(response.data)),
            displayCurrentFY,
            displayPreviousFY
          );
        }

        if (state.level === "bld" && state.regionalOfficer && state.salesArea) {
          const response = await apiClient.post(
            "/api/tableanalytics/generate_data_aggregations",
            buildLubesBldCategoryPayload(fiscalYears, {
              ...baseFilters,
              ORG_RO_NM: [state.regionalOfficer],
              ORG_SA_NM: [state.salesArea],
            })
          );
          return buildBldCategoryChartData(
            mapLubesBldCategoryRows(normalizeAggregationRows(response.data)),
            displayCurrentFY,
            displayPreviousFY
          );
        }
      }

      return [];
    },
    [
      topLevelRows,
      displayCurrentFY,
      displayPreviousFY,
      activePreviousFY,
      prevFY,
      ytdActive,
      fiscalYears,
      getBaseFilters,
      getYtdDates,
    ]
  );

  useEffect(() => {
    setDrillState({ level: "ro" });
  }, [fiscalYears, regionalOfficerRows, filtersKey]);

  useEffect(() => {
    if (loading) return;
    if (ytdActive && drillState.level === "ro" && ytdRoLoading) return;

    if (drillState.level === "ro") {
      setDrillChartData(topLevelChartData);
      return;
    }

    let cancelled = false;
    setDrillLoading(true);
    fetchDrillData(drillState)
      .then((data) => {
        if (!cancelled) setDrillChartData(data);
      })
      .catch(() => {
        if (!cancelled) setDrillChartData([]);
      })
      .finally(() => {
        if (!cancelled) setDrillLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, drillState, topLevelChartData, fetchDrillData, ytdActive, ytdRoLoading]);

  const handleDrillInto = (name: string) => {
    if (drillState.level === "ro") {
      setDrillState({ level: "sa", regionalOfficer: name });
      return;
    }
    if (drillState.level === "sa") {
      setDrillState({
        level: "bld",
        regionalOfficer: drillState.regionalOfficer,
        salesArea: name,
      });
    }
  };

  const chartDataWithPct = useMemo(
    () => withBreakdownChartPct(drillChartData),
    [drillChartData]
  );

  const breadcrumbs = useMemo((): DrilldownBreadcrumb[] => {
    const crumbs: DrilldownBreadcrumb[] = [
      {
        label: "Regional Officers",
        onClick:
          drillState.level !== "ro"
            ? () => setDrillState({ level: "ro" })
            : undefined,
      },
    ];

    if (drillState.regionalOfficer) {
      crumbs.push({
        label: drillState.regionalOfficer,
        onClick:
          drillState.level === "bld"
            ? () =>
                setDrillState({
                  level: "sa",
                  regionalOfficer: drillState.regionalOfficer,
                })
            : undefined,
      });
    }

    if (drillState.salesArea) {
      crumbs.push({ label: drillState.salesArea });
    }

    return crumbs;
  }, [drillState]);

  const levelMeta = useMemo(() => {
    if (drillState.level === "ro") {
      return {
        tableTitle: "Regional Officers",
        footer: "Click a row or bar to view sales areas",
        empty: "No regional officer data available.",
      };
    }
    if (drillState.level === "sa") {
      return {
        tableTitle: "Sales Areas",
        footer: "Click a row or bar to view BLD categories",
        empty: "No sales area data for the selected regional officer.",
      };
    }
    return {
      tableTitle: "BLD Categories",
      footer: "Lowest drill level · Curr vs Hist",
      empty: "No BLD data for the selected sales area.",
    };
  }, [drillState.level]);

  const isRoLoading = drillState.level === "ro" && ytdActive && ytdRoLoading;

  const ytdButtonLoading = ytdRoLoading;

  const leadingAction = (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading || refreshing || drillLoading}
        onClick={onExitDrilldown}
        className="h-7 gap-1.5 rounded-md border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </Button>

      {/* YTD toggle — mirrors the breakdown panel */}
      <button
        type="button"
        disabled={ytdButtonLoading}
        onClick={() => onYtdChange(!ytdActive)}
        className={`flex items-center gap-0.5 rounded border px-1.5 py-px text-[9px] font-semibold transition-colors disabled:opacity-50
          ${ytdActive
            ? "border-blue-400 bg-blue-100 text-blue-700"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
      >
        {ytdButtonLoading
          ? <Loader2 className="h-2 w-2 animate-spin" />
          : <span>YTD</span>
        }
      </button>
    </div>
  );

  return (
    <BreakdownDrilldownPanel
      icon={<GitBranch className="h-4 w-4" />}
      title="Regional Officer Drill-down"
      subtitle={
        ytdActive
          ? `YTD · ${displayCurrentFY} vs prev year · RO → SA → BLD`
          : `Regional Officer → Sales Area → BLD · ${displayCurrentFY} vs ${displayPreviousFY}`
      }
      loading={loading || isRoLoading}
      refreshing={refreshing}
      drillLoading={drillLoading}
      displayCurrentFY={displayCurrentFY}
      displayPreviousFY={activePreviousFY}
      chartData={chartDataWithPct}
      tableTitle={levelMeta.tableTitle}
      tableFooterHint={levelMeta.footer}
      breadcrumbs={breadcrumbs}
      canDrillDeeper={drillState.level !== "bld"}
      onDrillInto={handleDrillInto}
      leadingAction={leadingAction}
      onRefresh={() => {
        setDrillState({ level: "ro" });
        setYtdRoRows(null);
        onRefresh();
      }}
      emptyMessage={levelMeta.empty}
    />
  );
};

export default RegionalOfficerDrilldownPanel;
