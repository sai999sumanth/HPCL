import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FY_OPTIONS, getActiveFiscalYear, getPrevFY } from "./pa/pa.utils";
import {
  fetchYtdTotals, fetchRegionRows, fetchSegmentRows,
  fetchMonthlyMaps, fetchProductRows, fetchTopDistributorRows, fetchDistributorRows, fetchParetoDistRows,
  fetchHeatPivot, fetchMatrixPivot, fetchRegionSaRows,
  fetchQuarterlyRows, fetchMomRows, fetchHalfYearTrend, fetchDistributorStatusCounts, EMPTY_PIVOT,
  type PaVolumeOrder,
} from "./pa/pa.fetchers";
import { EMPTY_PA_FILTERS } from "./pa/pa.filters";
import { PA_PARETO_VIEWPORT_SHELL_CLASS, SP } from "./pa/pa.shared";
import type { CompareMode } from "./pa/pa.shared";
import type { TwoFyRow, SimpleRow, DistRankRow, RegionSaRow, MomRow, HalfYearRow, PivotData, PAFilterState } from "./pa/pa.types";

import PAHeader from "./pa/PAHeader";
import PASectionTabs, { type PASectionTabId } from "./pa/PASectionTabs";
import PAFilterBar from "./pa/PAFilterBar";

import PAKpiCards from "./pa/PAKpiCards";
import PARegionPerformance from "./pa/PARegionPerformance";
import PAHierarchyDrilldown from "./pa/PAHierarchyDrilldown";
import PASegmentSplit from "./pa/PASegmentSplit";
import PAMonthlySalesTrend from "./pa/PAMonthlySalesTrend";
import PAHalfYearSalesTrend from "./pa/PAHalfYearSalesTrend";
import PAProductContribution from "./pa/PAProductContribution";
import PATopDistributorsGlance from "./pa/PATopDistributorsGlance";
import PASegmentRegionHeatmap from "./pa/PASegmentRegionHeatmap";
import PAProductSegmentMatrix from "./pa/PAProductSegmentMatrix";
import PATopBottomDistributors from "./pa/PATopBottomDistributors";
import PARegionSaRanking from "./pa/PARegionSaRanking";
import PAQuarterlySummary from "./pa/PAQuarterlySummary";
import PAMomGrowth from "./pa/PAMomGrowth";
import PADistributorPareto from "./pa/PADistributorPareto";

const twoCol: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.colGap, alignItems: "stretch",
};

const trendTopRow: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "minmax(11rem, 14rem) minmax(0, 1fr)", gap: SP.colGap, alignItems: "stretch",
};

const sectionStack: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: SP.sectionGap,
};

const PerformanceAnalyticsTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PASectionTabId>("overview");
  const [currentFY, setCurrentFY] = useState(FY_OPTIONS[0]);
  const [compareMode, setCompareMode] = useState<CompareMode>("fy");
  const [filters, setFilters] = useState<PAFilterState>(() => ({ ...EMPTY_PA_FILTERS }));
  const prevFY = useMemo(() => getPrevFY(currentFY), [currentFY]);
  const activeFiscalYear = useMemo(() => getActiveFiscalYear(), []);
  const momAvailable = currentFY === activeFiscalYear;
  const fetchOptions = useMemo(() => ({ compareMode }), [compareMode]);
  const activeTabRequestRef = useRef(0);

  const [tabLoading, setTabLoading] = useState(false);
  const [overviewKpiLoading, setOverviewKpiLoading] = useState(false);
  const [overviewRegionLoading, setOverviewRegionLoading] = useState(false);
  const [overviewSegmentLoading, setOverviewSegmentLoading] = useState(false);
  const [overviewMonthlyLoading, setOverviewMonthlyLoading] = useState(false);
  const [overviewProductLoading, setOverviewProductLoading] = useState(false);
  const [overviewDistLoading, setOverviewDistLoading] = useState(false);
  const [regionRefreshing, setRegionRefreshing] = useState(false);
  const [segmentRefreshing, setSegmentRefreshing] = useState(false);
  const [monthlyRefreshing, setMonthlyRefreshing] = useState(false);
  const [productRefreshing, setProductRefreshing] = useState(false);
  const [distRefreshing, setDistRefreshing] = useState(false);
  const [paretoRefreshing, setParetoRefreshing] = useState(false);
  const [heatRefreshing, setHeatRefreshing] = useState(false);
  const [matrixRefreshing, setMatrixRefreshing] = useState(false);
  const [regionSaRefreshing, setRegionSaRefreshing] = useState(false);
  const [quarterlyRefreshing, setQuarterlyRefreshing] = useState(false);
  const [momRefreshing, setMomRefreshing] = useState(false);
  const [halfYearRefreshing, setHalfYearRefreshing] = useState(false);

  const [ytdTotal, setYtdTotal] = useState<number | null>(null);
  const [ytdPrevTotal, setYtdPrevTotal] = useState<number | null>(null);
  const [regionRows, setRegionRows] = useState<TwoFyRow[]>([]);
  const [segmentRows, setSegmentRows] = useState<TwoFyRow[]>([]);
  const [monthlyCurrentMap, setMonthlyCurrentMap] = useState<Map<string, number>>(new Map());
  const [monthlyPrevMap, setMonthlyPrevMap] = useState<Map<string, number>>(new Map());
  const [productRows, setProductRows] = useState<TwoFyRow[]>([]);
  const [topDistRows, setTopDistRows] = useState<TwoFyRow[]>([]);
  const [rankTopRows, setRankTopRows] = useState<DistRankRow[]>([]);
  const [rankBottomRows, setRankBottomRows] = useState<DistRankRow[]>([]);
  const [paretoDistRows, setParetoDistRows] = useState<SimpleRow[]>([]);
  const [heatPivot, setHeatPivot] = useState<PivotData>(EMPTY_PIVOT);
  const [matrixPivot, setMatrixPivot] = useState<PivotData>(EMPTY_PIVOT);
  const [regionSaRows, setRegionSaRows] = useState<RegionSaRow[]>([]);
  const [quarterlyRows, setQuarterlyRows] = useState<TwoFyRow[]>([]);
  const [momRows, setMomRows] = useState<MomRow[]>([]);
  const [halfYearRows, setHalfYearRows] = useState<HalfYearRow[]>([]);
  const [activeDistributorCount, setActiveDistributorCount] = useState<number>(0);
  const [inactiveDistributorCount, setInactiveDistributorCount] = useState<number>(0);
  const [productVolumeOrder, setProductVolumeOrder] = useState<PaVolumeOrder>("desc");
  const [topDistVolumeOrder, setTopDistVolumeOrder] = useState<PaVolumeOrder>("desc");
  const productVolumeOrderRef = useRef(productVolumeOrder);
  const topDistVolumeOrderRef = useRef(topDistVolumeOrder);
  productVolumeOrderRef.current = productVolumeOrder;
  topDistVolumeOrderRef.current = topDistVolumeOrder;

  const loadOverviewWidgets = useCallback(async (isStale: () => boolean) => {
    const opts = fetchOptions;
    const cFY = currentFY;
    const pFY = prevFY;
    const f = filters;

    await Promise.all([
      (async () => {
        setOverviewKpiLoading(true);
        try {
          const [ytd, distStatus] = await Promise.all([
            fetchYtdTotals(cFY, pFY, f, opts),
            fetchDistributorStatusCounts(cFY, f, opts),
          ]);
          if (isStale()) return;
          setYtdTotal(ytd.ytdTotal);
          setYtdPrevTotal(ytd.ytdPrevTotal);
          setActiveDistributorCount(distStatus.active);
          setInactiveDistributorCount(distStatus.inactive);
        } finally {
          if (!isStale()) setOverviewKpiLoading(false);
        }
      })(),
      (async () => {
        setOverviewRegionLoading(true);
        try {
          const region = await fetchRegionRows(cFY, pFY, f, opts);
          if (isStale()) return;
          setRegionRows(region);
        } finally {
          if (!isStale()) setOverviewRegionLoading(false);
        }
      })(),
      (async () => {
        setOverviewSegmentLoading(true);
        try {
          const segment = await fetchSegmentRows(cFY, pFY, f, opts);
          if (isStale()) return;
          setSegmentRows(segment);
        } finally {
          if (!isStale()) setOverviewSegmentLoading(false);
        }
      })(),
      (async () => {
        setOverviewMonthlyLoading(true);
        try {
          const monthly = await fetchMonthlyMaps(cFY, pFY, f, opts);
          if (isStale()) return;
          setMonthlyCurrentMap(monthly.current);
          setMonthlyPrevMap(monthly.previous);
        } finally {
          if (!isStale()) setOverviewMonthlyLoading(false);
        }
      })(),
      (async () => {
        setOverviewProductLoading(true);
        try {
          const products = await fetchProductRows(cFY, pFY, f, { ...opts, volumeOrder: productVolumeOrderRef.current });
          if (isStale()) return;
          setProductRows(products);
        } finally {
          if (!isStale()) setOverviewProductLoading(false);
        }
      })(),
      (async () => {
        setOverviewDistLoading(true);
        try {
          const top = await fetchTopDistributorRows(cFY, pFY, f, { ...opts, volumeOrder: topDistVolumeOrderRef.current });
          if (isStale()) return;
          setTopDistRows(top);
        } finally {
          if (!isStale()) setOverviewDistLoading(false);
        }
      })(),
    ]);
  }, [currentFY, prevFY, filters, fetchOptions]);

  const loadTabData = useCallback(async (tab: PASectionTabId, isStale: () => boolean) => {
    const opts = fetchOptions;
    switch (tab) {
      case "overview":
        await loadOverviewWidgets(isStale);
        break;
      case "hierarchy": {
        const region = await fetchRegionRows(currentFY, prevFY, filters, opts);
        if (isStale()) return;
        setRegionRows(region);
        break;
      }
      case "heatmap": {
        const [heat, matrix] = await Promise.all([
          fetchHeatPivot(currentFY, filters, opts),
          fetchMatrixPivot(currentFY, filters, opts),
        ]);
        if (isStale()) return;
        setHeatPivot(heat);
        setMatrixPivot(matrix);
        break;
      }
      case "products": {
        const [products, segment, matrix] = await Promise.all([
          fetchProductRows(currentFY, prevFY, filters, { ...opts, volumeOrder: productVolumeOrderRef.current }),
          fetchSegmentRows(currentFY, prevFY, filters, opts),
          fetchMatrixPivot(currentFY, filters, opts),
        ]);
        if (isStale()) return;
        setProductRows(products);
        setSegmentRows(segment);
        setMatrixPivot(matrix);
        break;
      }
      case "rankings": {
        const [distributors, regionSa] = await Promise.all([
          fetchDistributorRows(currentFY, prevFY, filters, opts),
          fetchRegionSaRows(currentFY, filters, opts),
        ]);
        if (isStale()) return;
        setRankTopRows(distributors.top);
        setRankBottomRows(distributors.bottom);
        setRegionSaRows(regionSa);
        break;
      }
      case "trend": {
        const [monthly, mom, quarterly, halfYear] = await Promise.all([
          fetchMonthlyMaps(currentFY, prevFY, filters, opts),
          fetchMomRows(currentFY, prevFY, filters, opts),
          fetchQuarterlyRows(currentFY, prevFY, filters, opts),
          fetchHalfYearTrend(currentFY, prevFY, filters),
        ]);
        if (isStale()) return;
        setMonthlyCurrentMap(monthly.current);
        setMonthlyPrevMap(monthly.previous);
        setMomRows(mom);
        setQuarterlyRows(quarterly);
        setHalfYearRows(halfYear);
        break;
      }
      case "pareto": {
        const pareto = await fetchParetoDistRows(currentFY, filters, opts);
        if (isStale()) return;
        setParetoDistRows(pareto);
        break;
      }
    }
  }, [currentFY, prevFY, filters, fetchOptions, loadOverviewWidgets]);

  useEffect(() => {
    if (!momAvailable && compareMode === "mom") {
      setCompareMode("fy");
    }
  }, [momAvailable, compareMode]);

  useEffect(() => {
    const requestId = ++activeTabRequestRef.current;
    const isStale = () => requestId !== activeTabRequestRef.current;

    if (activeTab === "overview") {
      void loadOverviewWidgets(isStale);
      return;
    }

    setTabLoading(true);
    void loadTabData(activeTab, isStale).finally(() => {
      if (!isStale()) setTabLoading(false);
    });
  }, [activeTab, loadTabData, loadOverviewWidgets]);

  const refreshActiveTab = useCallback(async () => {
    const requestId = ++activeTabRequestRef.current;
    const isStale = () => requestId !== activeTabRequestRef.current;

    if (activeTab === "overview") {
      await loadOverviewWidgets(isStale);
      return;
    }

    setTabLoading(true);
    try {
      await loadTabData(activeTab, isStale);
    } finally {
      if (!isStale()) setTabLoading(false);
    }
  }, [activeTab, loadTabData, loadOverviewWidgets]);

  const refreshRegion = useCallback(async () => {
    setRegionRefreshing(true);
    try { setRegionRows(await fetchRegionRows(currentFY, prevFY, filters, fetchOptions)); }
    finally { setRegionRefreshing(false); }
  }, [currentFY, prevFY, filters, fetchOptions]);

  const refreshSegment = useCallback(async () => {
    setSegmentRefreshing(true);
    try { setSegmentRows(await fetchSegmentRows(currentFY, prevFY, filters, fetchOptions)); }
    finally { setSegmentRefreshing(false); }
  }, [currentFY, prevFY, filters, fetchOptions]);

  const refreshMonthly = useCallback(async () => {
    setMonthlyRefreshing(true);
    try {
      const { current, previous } = await fetchMonthlyMaps(currentFY, prevFY, filters, fetchOptions);
      setMonthlyCurrentMap(current);
      setMonthlyPrevMap(previous);
    } finally { setMonthlyRefreshing(false); }
  }, [currentFY, prevFY, filters, fetchOptions]);

  const refreshProducts = useCallback(async () => {
    setProductRefreshing(true);
    try {
      setProductRows(await fetchProductRows(currentFY, prevFY, filters, { ...fetchOptions, volumeOrder: productVolumeOrder }));
    } finally { setProductRefreshing(false); }
  }, [currentFY, prevFY, filters, fetchOptions, productVolumeOrder]);

  const changeProductVolumeOrder = useCallback(async (order: PaVolumeOrder) => {
    setProductVolumeOrder(order);
    setProductRefreshing(true);
    try {
      setProductRows(await fetchProductRows(currentFY, prevFY, filters, { ...fetchOptions, volumeOrder: order }));
    } finally { setProductRefreshing(false); }
  }, [currentFY, prevFY, filters, fetchOptions]);

  const refreshDistributors = useCallback(async () => {
    setDistRefreshing(true);
    try {
      if (activeTab === "rankings") {
        const { top, bottom } = await fetchDistributorRows(currentFY, prevFY, filters, fetchOptions);
        setRankTopRows(top);
        setRankBottomRows(bottom);
      } else {
        setTopDistRows(await fetchTopDistributorRows(currentFY, prevFY, filters, { ...fetchOptions, volumeOrder: topDistVolumeOrder }));
      }
    } finally { setDistRefreshing(false); }
  }, [activeTab, currentFY, prevFY, filters, fetchOptions, topDistVolumeOrder]);

  const changeTopDistVolumeOrder = useCallback(async (order: PaVolumeOrder) => {
    setTopDistVolumeOrder(order);
    setDistRefreshing(true);
    try {
      setTopDistRows(await fetchTopDistributorRows(currentFY, prevFY, filters, { ...fetchOptions, volumeOrder: order }));
    } finally { setDistRefreshing(false); }
  }, [currentFY, prevFY, filters, fetchOptions]);

  const refreshPareto = useCallback(async () => {
    setParetoRefreshing(true);
    try { setParetoDistRows(await fetchParetoDistRows(currentFY, filters, fetchOptions)); }
    finally { setParetoRefreshing(false); }
  }, [currentFY, filters, fetchOptions]);

  const refreshHeatmap = useCallback(async () => {
    setHeatRefreshing(true);
    try { setHeatPivot(await fetchHeatPivot(currentFY, filters, fetchOptions)); }
    finally { setHeatRefreshing(false); }
  }, [currentFY, filters, fetchOptions]);

  const refreshMatrix = useCallback(async () => {
    setMatrixRefreshing(true);
    try { setMatrixPivot(await fetchMatrixPivot(currentFY, filters, fetchOptions)); }
    finally { setMatrixRefreshing(false); }
  }, [currentFY, filters, fetchOptions]);

  const refreshRegionSa = useCallback(async () => {
    setRegionSaRefreshing(true);
    try { setRegionSaRows(await fetchRegionSaRows(currentFY, filters, fetchOptions)); }
    finally { setRegionSaRefreshing(false); }
  }, [currentFY, filters, fetchOptions]);

  const refreshQuarterly = useCallback(async () => {
    setQuarterlyRefreshing(true);
    try { setQuarterlyRows(await fetchQuarterlyRows(currentFY, prevFY, filters, fetchOptions)); }
    finally { setQuarterlyRefreshing(false); }
  }, [currentFY, prevFY, filters, fetchOptions]);

  const refreshMom = useCallback(async () => {
    setMomRefreshing(true);
    try { setMomRows(await fetchMomRows(currentFY, prevFY, filters, fetchOptions)); }
    finally { setMomRefreshing(false); }
  }, [currentFY, prevFY, filters, fetchOptions]);

  const refreshHalfYear = useCallback(async () => {
    setHalfYearRefreshing(true);
    try { setHalfYearRows(await fetchHalfYearTrend(currentFY, prevFY, filters)); }
    finally { setHalfYearRefreshing(false); }
  }, [currentFY, prevFY, filters]);

  const handleFYChange = useCallback((fy: string) => {
    setCurrentFY(fy);
    if (fy !== activeFiscalYear) {
      setCompareMode("fy");
    }
  }, [activeFiscalYear]);

  const handleTabChange = useCallback((tab: PASectionTabId) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setFilters((prev) => {
      const alreadyEmpty =
        !prev.region &&
        !prev.salesArea &&
        !prev.segment &&
        !prev.product &&
        prev.period === "fy";
      return alreadyEmpty ? prev : { ...EMPTY_PA_FILTERS };
    });
  }, [activeTab]);

  const kpiTotal = ytdTotal ?? regionRows.reduce((s, r) => s + r.currentTotal, 0);
  const isOverview = activeTab === "overview";
  const overviewBusy =
    overviewKpiLoading ||
    overviewRegionLoading ||
    overviewSegmentLoading ||
    overviewMonthlyLoading ||
    overviewProductLoading ||
    overviewDistLoading;
  const regionLoading = isOverview
    ? overviewRegionLoading || regionRefreshing
    : tabLoading || regionRefreshing;
  const segmentLoading = isOverview
    ? overviewSegmentLoading || segmentRefreshing
    : tabLoading || segmentRefreshing;
  const monthlyLoading = isOverview
    ? overviewMonthlyLoading || monthlyRefreshing
    : tabLoading || monthlyRefreshing;
  const productLoading = isOverview
    ? overviewProductLoading || productRefreshing
    : tabLoading || productRefreshing;
  const distLoading = isOverview
    ? overviewDistLoading || distRefreshing
    : tabLoading || distRefreshing;
  const paretoLoading = tabLoading || paretoRefreshing;
  const heatLoading = tabLoading || heatRefreshing;
  const matrixLoading = tabLoading || matrixRefreshing;
  const regionSaLoading = tabLoading || regionSaRefreshing;
  const quarterlyLoading = tabLoading || quarterlyRefreshing;
  const momLoading = tabLoading || momRefreshing;
  const halfYearLoading = tabLoading || halfYearRefreshing;
  const ytdLoading = isOverview ? overviewKpiLoading : tabLoading;
  const regionsKpiLoading = isOverview ? overviewRegionLoading : ytdLoading;
  const segmentKpiLoading = isOverview ? overviewSegmentLoading : ytdLoading;

  return (
    <div className="min-h-full bg-slate-50">

      <PAHeader
        currentFY={currentFY}
        prevFY={prevFY}
        compareMode={compareMode}
        onCompareModeChange={setCompareMode}
        onFYChange={handleFYChange}
        momAvailable={momAvailable}
      />

      <PASectionTabs activeTab={activeTab} onChange={handleTabChange} />

      <div style={{ padding: SP.page }}>
        <PAFilterBar
          currentFY={currentFY}
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={refreshActiveTab}
          refreshing={isOverview ? overviewBusy : tabLoading}
        />

        {activeTab === "overview" && (
          <div style={sectionStack}>
            <PAKpiCards
              ytdTotal={ytdTotal} ytdPrevTotal={ytdPrevTotal} ytdLoading={ytdLoading}
              regionsLoading={regionsKpiLoading} segmentLoading={segmentKpiLoading}
              currentFY={currentFY} prevFY={prevFY} compareMode={compareMode}
              topSegment={segmentRows[0]} kpiTotal={kpiTotal}
              totalRegions={regionRows.length}
              activeDistributors={activeDistributorCount}
              inactiveDistributors={inactiveDistributorCount}
            />
            <div style={twoCol}>
              <PARegionPerformance rows={regionRows} loading={regionLoading} currentFY={currentFY} prevFY={prevFY} filters={filters} compareMode={compareMode} onRefresh={refreshRegion} refreshing={regionRefreshing} />
              <PASegmentSplit rows={segmentRows} loading={segmentLoading} currentFY={currentFY} prevFY={prevFY} filters={filters} compareMode={compareMode} onRefresh={refreshSegment} refreshing={segmentRefreshing} />
            </div>
            <PAMonthlySalesTrend current={monthlyCurrentMap} previous={monthlyPrevMap} loading={monthlyLoading} currentFY={currentFY} prevFY={prevFY} onRefresh={refreshMonthly} refreshing={monthlyRefreshing} />
            <div style={twoCol}>
              <PAProductContribution rows={productRows} loading={productLoading} currentFY={currentFY} prevFY={prevFY} filters={filters} compareMode={compareMode} volumeOrder={productVolumeOrder} onVolumeOrderChange={changeProductVolumeOrder} onRefresh={refreshProducts} refreshing={productRefreshing} />
              <PATopDistributorsGlance rows={topDistRows} loading={distLoading} currentFY={currentFY} prevFY={prevFY} filters={filters} compareMode={compareMode} volumeOrder={topDistVolumeOrder} onVolumeOrderChange={changeTopDistVolumeOrder} onRefresh={refreshDistributors} refreshing={distRefreshing} />
            </div>
          </div>
        )}

        {activeTab === "hierarchy" && (
          <PAHierarchyDrilldown
            rows={regionRows}
            loading={regionLoading}
            currentFY={currentFY}
            prevFY={prevFY}
            filters={filters}
            compareMode={compareMode}
            onRefresh={refreshRegion}
            refreshing={regionRefreshing}
          />
        )}

        {activeTab === "heatmap" && (
          <div style={sectionStack}>
            <PASegmentRegionHeatmap pivot={heatPivot} loading={heatLoading} onRefresh={refreshHeatmap} refreshing={heatRefreshing} />
            <PAProductSegmentMatrix pivot={matrixPivot} loading={matrixLoading} onRefresh={refreshMatrix} refreshing={matrixRefreshing} />
          </div>
        )}

        {activeTab === "products" && (
          <div style={sectionStack}>
            <div style={twoCol}>
              <PAProductContribution rows={productRows} loading={productLoading} currentFY={currentFY} prevFY={prevFY} filters={filters} compareMode={compareMode} volumeOrder={productVolumeOrder} onVolumeOrderChange={changeProductVolumeOrder} onRefresh={refreshProducts} refreshing={productRefreshing} />
              <PASegmentSplit rows={segmentRows} loading={segmentLoading} currentFY={currentFY} prevFY={prevFY} filters={filters} compareMode={compareMode} onRefresh={refreshSegment} refreshing={segmentRefreshing} />
            </div>
            <PAProductSegmentMatrix pivot={matrixPivot} loading={matrixLoading} onRefresh={refreshMatrix} refreshing={matrixRefreshing} />
          </div>
        )}

        {activeTab === "rankings" && (
          <div style={sectionStack}>
            <PATopBottomDistributors
              topRows={rankTopRows}
              bottomRows={rankBottomRows}
              loading={distLoading}
              currentFY={currentFY}
              prevFY={prevFY}
              filters={filters}
              compareMode={compareMode}
              onRefresh={refreshDistributors}
              refreshing={distRefreshing}
            />
            <PARegionSaRanking rows={regionSaRows} loading={regionSaLoading} onRefresh={refreshRegionSa} refreshing={regionSaRefreshing} />
          </div>
        )}

        {activeTab === "trend" && (
          <div style={sectionStack}>
            <div style={trendTopRow}>
              <PAHalfYearSalesTrend
                rows={halfYearRows}
                loading={halfYearLoading}
                currentFY={currentFY}
                prevFY={prevFY}
                onRefresh={refreshHalfYear}
                refreshing={halfYearRefreshing}
              />
              <PAMonthlySalesTrend current={monthlyCurrentMap} previous={monthlyPrevMap} loading={monthlyLoading} currentFY={currentFY} prevFY={prevFY} showGrowth={false} onRefresh={refreshMonthly} refreshing={monthlyRefreshing} />
            </div>
            <div style={twoCol}>
              <PAMomGrowth rows={momRows} loading={momLoading} currentFY={currentFY} onRefresh={refreshMom} refreshing={momRefreshing} />
              <PAQuarterlySummary rows={quarterlyRows} loading={quarterlyLoading} currentFY={currentFY} prevFY={prevFY} onRefresh={refreshQuarterly} refreshing={quarterlyRefreshing} />
            </div>
          </div>
        )}

        {activeTab === "pareto" && (
          <div className={PA_PARETO_VIEWPORT_SHELL_CLASS}>
            <PADistributorPareto
              className="min-h-0 flex-1"
              rows={paretoDistRows}
              loading={paretoLoading}
              onRefresh={refreshPareto}
              refreshing={paretoRefreshing}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceAnalyticsTab;
