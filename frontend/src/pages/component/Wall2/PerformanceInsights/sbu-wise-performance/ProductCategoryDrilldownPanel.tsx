import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Layers, Loader2 } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import type {
  LubesProductCategoryRow,
  SalesAreaChartRow,
} from "./lubesSalesPerformance.types";
import BreakdownDrilldownPanel, { type DrilldownBreadcrumb } from "./BreakdownDrilldownPanel";
import { withBreakdownChartPct } from "./lubesSalesPerformance.shared";
import {
  buildItemCategoryChartData,
  buildLubesItemCategoryPayload,
  buildLubesItemCategoryYtdPayload,
  buildLubesProductCategoryYtdPayload,
  buildProductCategoryChartData,
  mapLubesItemCategoryRows,
  mapLubesProductCategoryRows,
  normalizeAggregationRows,
} from "./lubesSalesPerformance.utils";

type PcDrillLevel = "category" | "item";

type PcDrillState = {
  level: PcDrillLevel;
  productCategory?: string;
};

export type ProductCategoryDrilldownPanelProps = {
  loading: boolean;
  refreshing: boolean;
  fiscalYears: string[];
  displayCurrentFY: string;
  displayPreviousFY: string;
  productCategoryRows: LubesProductCategoryRow[];
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

const ProductCategoryDrilldownPanel: React.FC<ProductCategoryDrilldownPanelProps> = ({
  loading,
  refreshing,
  fiscalYears,
  displayCurrentFY,
  displayPreviousFY,
  productCategoryRows,
  ytdActive,
  onYtdChange,
  getBaseFilters,
  filtersKey,
  onExitDrilldown,
  onRefresh,
}) => {
  const [drillState, setDrillState] = useState<PcDrillState>({ level: "category" });
  const [drillChartData, setDrillChartData] = useState<SalesAreaChartRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const [ytdCategoryRows, setYtdCategoryRows] = useState<LubesProductCategoryRow[] | null>(null);
  const [ytdCategoryLoading, setYtdCategoryLoading] = useState(false);

  const prevFY = useMemo(() => {
    const startYear = parseInt(displayCurrentFY.split("-")[0], 10);
    return `${startYear - 1}-${startYear}`;
  }, [displayCurrentFY]);

  const activePreviousFY = ytdActive ? prevFY : displayPreviousFY;

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

  const fetchYtdCategoryRows = useCallback(async () => {
    setYtdCategoryLoading(true);
    try {
      const { currentDateFrom, currentDateTo, prevDateFrom, prevDateTo } = getYtdDates();
      const baseFilters = getBaseFilters();
      const [currentRes, prevRes] = await Promise.all([
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesProductCategoryYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, baseFilters)
        ),
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesProductCategoryYtdPayload(prevFY, prevDateFrom, prevDateTo, baseFilters)
        ),
      ]);
      setYtdCategoryRows([
        ...mapLubesProductCategoryRows(normalizeAggregationRows(currentRes.data)),
        ...mapLubesProductCategoryRows(normalizeAggregationRows(prevRes.data)),
      ]);
    } catch {
      setYtdCategoryRows([]);
    } finally {
      setYtdCategoryLoading(false);
    }
  }, [displayCurrentFY, prevFY, getYtdDates, getBaseFilters]);

  useEffect(() => { setYtdCategoryRows(null); }, [displayCurrentFY, filtersKey]);

  useEffect(() => {
    if (ytdActive && drillState.level === "category" && ytdCategoryRows === null && !ytdCategoryLoading) {
      void fetchYtdCategoryRows();
    }
  }, [ytdActive, drillState.level, ytdCategoryRows, ytdCategoryLoading, fetchYtdCategoryRows]);

  const topLevelRows = ytdActive ? (ytdCategoryRows ?? []) : productCategoryRows;

  const topLevelChartData = useMemo(
    () => buildProductCategoryChartData(topLevelRows, displayCurrentFY, activePreviousFY),
    [topLevelRows, displayCurrentFY, activePreviousFY]
  );

  const fetchDrillData = useCallback(
    async (state: PcDrillState) => {
      if (state.level === "category") {
        return buildProductCategoryChartData(topLevelRows, displayCurrentFY, activePreviousFY);
      }

      if (state.level === "item" && state.productCategory) {
        const baseFilters = getBaseFilters();
        const extraFilters = { ...baseFilters, PRODUCT_CATEGORY: [state.productCategory] };

        if (ytdActive) {
          const { currentDateFrom, currentDateTo, prevDateFrom, prevDateTo } = getYtdDates();
          const [currentRes, prevRes] = await Promise.all([
            apiClient.post(
              "/api/tableanalytics/generate_data_aggregations",
              buildLubesItemCategoryYtdPayload(displayCurrentFY, currentDateFrom, currentDateTo, extraFilters)
            ),
            apiClient.post(
              "/api/tableanalytics/generate_data_aggregations",
              buildLubesItemCategoryYtdPayload(prevFY, prevDateFrom, prevDateTo, extraFilters)
            ),
          ]);
          return buildItemCategoryChartData(
            [
              ...mapLubesItemCategoryRows(normalizeAggregationRows(currentRes.data)),
              ...mapLubesItemCategoryRows(normalizeAggregationRows(prevRes.data)),
            ],
            displayCurrentFY,
            activePreviousFY
          );
        }

        const response = await apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesItemCategoryPayload(fiscalYears, extraFilters)
        );
        return buildItemCategoryChartData(
          mapLubesItemCategoryRows(normalizeAggregationRows(response.data)),
          displayCurrentFY,
          displayPreviousFY
        );
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
    setDrillState({ level: "category" });
  }, [fiscalYears, productCategoryRows, filtersKey]);

  useEffect(() => {
    if (loading) return;
    if (ytdActive && drillState.level === "category" && ytdCategoryLoading) return;

    if (drillState.level === "category") {
      setDrillChartData(topLevelChartData);
      return;
    }

    let cancelled = false;
    setDrillLoading(true);
    fetchDrillData(drillState)
      .then((data) => { if (!cancelled) setDrillChartData(data); })
      .catch(() => { if (!cancelled) setDrillChartData([]); })
      .finally(() => { if (!cancelled) setDrillLoading(false); });

    return () => { cancelled = true; };
  }, [loading, drillState, topLevelChartData, fetchDrillData, ytdActive, ytdCategoryLoading]);

  const handleDrillInto = (name: string) => {
    if (drillState.level === "category") {
      setDrillState({ level: "item", productCategory: name });
    }
  };

  const chartDataWithPct = useMemo(() => withBreakdownChartPct(drillChartData), [drillChartData]);

  const breadcrumbs = useMemo((): DrilldownBreadcrumb[] => {
    const crumbs: DrilldownBreadcrumb[] = [
      {
        label: "Product Categories",
        onClick:
          drillState.level !== "category"
            ? () => setDrillState({ level: "category" })
            : undefined,
      },
    ];
    if (drillState.productCategory) {
      crumbs.push({ label: drillState.productCategory });
    }
    return crumbs;
  }, [drillState]);

  const levelMeta = useMemo(() => {
    if (drillState.level === "category") {
      return {
        tableTitle: "Product Categories",
        footer: "Click a row or bar to view items",
        empty: "No product category data available.",
      };
    }
    return {
      tableTitle: "Items",
      footer: "Item-level breakdown · Curr vs Hist",
      empty: "No items found for the selected product category.",
    };
  }, [drillState.level]);

  const isCategoryLoading = drillState.level === "category" && ytdActive && ytdCategoryLoading;

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

      <button
        type="button"
        disabled={ytdCategoryLoading}
        onClick={() => onYtdChange(!ytdActive)}
        className={`flex items-center gap-0.5 rounded border px-1.5 py-px text-[9px] font-semibold transition-colors disabled:opacity-50
          ${ytdActive
            ? "border-blue-400 bg-blue-100 text-blue-700"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
      >
        {ytdCategoryLoading ? <Loader2 className="h-2 w-2 animate-spin" /> : <span>YTD</span>}
      </button>
    </div>
  );

  return (
    <BreakdownDrilldownPanel
      icon={<Layers className="h-4 w-4" />}
      title="Product Category Drill-down"
      subtitle={
        ytdActive
          ? `YTD · ${displayCurrentFY} vs prev year · Category → Items`
          : `Product Category → Items · ${displayCurrentFY} vs ${displayPreviousFY}`
      }
      loading={loading || isCategoryLoading}
      refreshing={refreshing}
      drillLoading={drillLoading}
      displayCurrentFY={displayCurrentFY}
      displayPreviousFY={activePreviousFY}
      chartData={chartDataWithPct}
      tableTitle={levelMeta.tableTitle}
      tableFooterHint={levelMeta.footer}
      breadcrumbs={breadcrumbs}
      canDrillDeeper={drillState.level === "category"}
      onDrillInto={handleDrillInto}
      leadingAction={leadingAction}
      onRefresh={() => {
        setDrillState({ level: "category" });
        setYtdCategoryRows(null);
        onRefresh();
      }}
      emptyMessage={levelMeta.empty}
    />
  );
};

export default ProductCategoryDrilldownPanel;
