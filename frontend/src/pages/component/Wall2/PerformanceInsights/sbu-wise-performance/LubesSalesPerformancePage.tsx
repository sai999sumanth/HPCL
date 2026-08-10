import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Filter, TrendingUp, X } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { apiClient } from "@/services/apiClient";
import { getIndianFiscalYearMeta, getPreviousIndianFiscalYear } from "@/utils/fiscalYearUtils";
import { LUBES_FILTER_CHIPS, LUBES_PAGE } from "./lubesSalesPerformance.theme";
import type {
  LubesCompanyRow,
  LubesPeriodRow,
  LubesPremiumSegmentRow,
  LubesBldCategoryRow,
  LubesItemCategoryRow,
  LubesProductCategoryRow,
  LubesRegionalOfficerRow,
  LubesSalesAreaRow,
  LubesSegmentRow,
  LubesSegmentOfficerRow,
  PeriodFilter,
  PeriodViewMode,
} from "./lubesSalesPerformance.types";
import {
  FISCAL_MONTH_ORDER,
  HALF_YEAR_ORDER,
  QUARTER_ORDER,
  buildCompanyApiFilters,
  buildLubesConnectedFilterDistinctPayload,
  type LubesConnectedFilterDraft,
  buildCompanySummaries,
  buildCrossApiFilters,
  buildPeriodBreakdownApiFilters,
  buildLubesCompanyFilterPayload,
  buildLubesCompanyPayload,
  buildLubesPeriodPayload,
  buildLubesBldCategoryPayload,
  buildLubesItemCategoryPayload,
  buildLubesProductCategoryPayload,
  buildLubesRegionalOfficerPayload,
  buildLubesSalesAreaPayload,
  buildLubesPremiumSegmentPayload,
  buildLubesSegmentPayload,
  buildLubesSegmentTablePayload,
  buildPeriodCardItems,
  buildPeriodTrendChartData,
  buildPremiumSegmentCardItems,
  buildSegmentApiFilters,
  buildSegmentCardItems,
  buildSegmentPivotTable,
  filterRowsByPeriods,
  halfYearLabel,
  mapLubesCompanyRows,
  mapLubesPeriodRows,
  mapLubesPremiumSegmentRows,
  mapLubesBldCategoryRows,
  mapLubesItemCategoryRows,
  mapLubesProductCategoryRows,
  mapLubesRegionalOfficerRows,
  mapLubesSalesAreaRows,
  mapLubesSegmentRows,
  mapLubesSegmentOfficerRows,
  monthLabel,
  normalizeAggregationRows,
  parseDistinctColumnValues,
  periodFilterKey,
  periodFilterLabel,
  quarterLabel,
  sortByOrder,
  togglePeriodFilterDraft,
} from "./lubesSalesPerformance.utils";
import LubesFiltersPopover, { type LubesFiltersDraft } from "./LubesFiltersPopover";
import CompanyNetWeightPanel from "./CompanyNetWeightPanel";
import FiscalPeriodBreakdownPanel from "./FiscalPeriodBreakdownPanel";
import SegmentBreakdownPanel from "./SegmentBreakdownPanel";
import SegmentBreakdownTablePanel from "./SegmentBreakdownTablePanel";
import PremiumSegmentPanel from "./PremiumSegmentPanel";
import PremiumSegmentDrilldownPanel from "./PremiumSegmentDrilldownPanel";
import SalesAreaBreakdownPanel from "./SalesAreaBreakdownPanel";
import RegionalOfficerBreakdownPanel from "./RegionalOfficerBreakdownPanel";
import RegionalOfficerDrilldownPanel from "./RegionalOfficerDrilldownPanel";
import ProductCategoryBreakdownPanel from "./ProductCategoryBreakdownPanel";
import ProductCategoryDrilldownPanel from "./ProductCategoryDrilldownPanel";
import ItemCategoryBreakdownPanel from "./ItemCategoryBreakdownPanel";
import BldCategoryBreakdownPanel from "./BldCategoryBreakdownPanel";
import SegmentRegionStatusList from "./SegmentRegionStatusList";
import PerformanceAnalyticsTab from "./PerformanceAnalyticsTab";

const LubesSalesPerformancePage: React.FC = () => {
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [companyRows, setCompanyRows] = useState<LubesCompanyRow[]>([]);
  const [companyFilterRows, setCompanyFilterRows] = useState<LubesCompanyRow[]>([]);
  const [periodRowsByMode, setPeriodRowsByMode] = useState<
    Partial<Record<PeriodViewMode, LubesPeriodRow[]>>
  >({});
  const [segmentRows, setSegmentRows] = useState<LubesSegmentRow[]>([]);
  const [premiumSegmentRows, setPremiumSegmentRows] = useState<LubesPremiumSegmentRow[]>([]);
  const [segmentTableRows, setSegmentTableRows] = useState<LubesSegmentOfficerRow[]>([]);
  const [salesAreaRows, setSalesAreaRows] = useState<LubesSalesAreaRow[]>([]);
  const [regionalOfficerRows, setRegionalOfficerRows] = useState<LubesRegionalOfficerRow[]>([]);
  const [productCategoryRows, setProductCategoryRows] = useState<LubesProductCategoryRow[]>([]);
  const [itemCategoryRows, setItemCategoryRows] = useState<LubesItemCategoryRow[]>([]);
  const [bldCategoryRows, setBldCategoryRows] = useState<LubesBldCategoryRow[]>([]);
  const [popoverSalesAreaOptions, setPopoverSalesAreaOptions] = useState<string[]>([]);
  const [regionalOfficerOptions, setRegionalOfficerOptions] = useState<string[]>([]);
  const [segmentOptions, setSegmentOptions] = useState<string[]>([]);
  const [productCategoryOptions, setProductCategoryOptions] = useState<string[]>([]);
  const [connectedFiltersLoading, setConnectedFiltersLoading] = useState(true);
  const [appliedSalesAreas, setAppliedSalesAreas] = useState<string[]>([]);
  const [appliedRegionalOfficers, setAppliedRegionalOfficers] = useState<string[]>([]);
  const [appliedProductCategories, setAppliedProductCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingCompany, setRefreshingCompany] = useState(false);
  const [refreshingPeriod, setRefreshingPeriod] = useState(false);
  const [refreshingSegment, setRefreshingSegment] = useState(false);
  const [refreshingSegmentTable, setRefreshingSegmentTable] = useState(false);
  const [refreshingPremiumSegment, setRefreshingPremiumSegment] = useState(false);
  const [premiumSegmentDrillActive, setPremiumSegmentDrillActive] = useState(false);
  const [refreshingSalesArea, setRefreshingSalesArea] = useState(false);
  const [refreshingRegionalOfficer, setRefreshingRegionalOfficer] = useState(false);
  const [regionalOfficerDrillActive, setRegionalOfficerDrillActive] = useState(false);
  const [refreshingProductCategory, setRefreshingProductCategory] = useState(false);
  const [productCategoryDrillActive, setProductCategoryDrillActive] = useState(false);
  const [refreshingItemCategory, setRefreshingItemCategory] = useState(false);
  const [refreshingBldCategory, setRefreshingBldCategory] = useState(false);
  const [activeTab, setActiveTab] = useState<"lubes-bazaar" | "performance-analytics">("lubes-bazaar");

  // Per-panel YTD states — each widget toggles independently; header button sets all at once
  const [companyYtdActive, setCompanyYtdActive] = useState(true);
  const [segmentYtdActive, setSegmentYtdActive] = useState(true);
  const [segmentTableYtdActive, setSegmentTableYtdActive] = useState(true);
  const [premiumYtdActive, setPremiumYtdActive] = useState(true);
  const [roYtdActive, setRoYtdActive] = useState(true);
  const [productCategoryYtdActive, setProductCategoryYtdActive] = useState(true);
  const [bldYtdActive, setBldYtdActive] = useState(true);

  const allYtdActive =
    companyYtdActive && segmentYtdActive && segmentTableYtdActive &&
    premiumYtdActive && roYtdActive && productCategoryYtdActive && bldYtdActive;

  const toggleAllYtd = () => {
    const next = !allYtdActive;
    setCompanyYtdActive(next);
    setSegmentYtdActive(next);
    setSegmentTableYtdActive(next);
    setPremiumYtdActive(next);
    setRoYtdActive(next);
    setProductCategoryYtdActive(next);
    setBldYtdActive(next);
  };
  const [error, setError] = useState<string | null>(null);
  const [periodView, setPeriodView] = useState<PeriodViewMode>("month");
  const [appliedSegments, setAppliedSegments] = useState<string[]>([]);
  const [appliedPeriodFilters, setAppliedPeriodFilters] = useState<PeriodFilter[]>([]);

  const fiscalYearMeta = useMemo(() => getIndianFiscalYearMeta(), []);
  const { currentFY, previousFY } = fiscalYearMeta;

  const priorFY = useMemo(
    () => getPreviousIndianFiscalYear(previousFY),
    [previousFY]
  );

  const fiscalYearOptions = useMemo(
    () => [currentFY, previousFY, priorFY],
    [currentFY, previousFY, priorFY]
  );

  const [selectedFY, setSelectedFY] = useState(currentFY);

  useEffect(() => {
    setSelectedFY(currentFY);
  }, [currentFY]);

  const displayCurrentFY = selectedFY;
  const displayPreviousFY = useMemo(
    () => getPreviousIndianFiscalYear(selectedFY),
    [selectedFY]
  );

  const fiscalYears = useMemo(
    () => [displayCurrentFY, displayPreviousFY],
    [displayCurrentFY, displayPreviousFY]
  );

  const rowsForCompanies = useMemo(() => {
    const baseRows =
      appliedPeriodFilters.length > 0 ? companyFilterRows : companyRows;
    return filterRowsByPeriods(baseRows, appliedPeriodFilters);
  }, [companyRows, companyFilterRows, appliedPeriodFilters]);

  const companySummaries = useMemo(
    () => buildCompanySummaries(rowsForCompanies, displayPreviousFY, displayCurrentFY),
    [rowsForCompanies, displayPreviousFY, displayCurrentFY]
  );

  const periodRows = periodRowsByMode[periodView] ?? [];

  const periodCardItems = useMemo(
    () =>
      buildPeriodCardItems(
        periodRows,
        displayCurrentFY,
        displayPreviousFY,
        periodView
      ),
    [periodRows, displayCurrentFY, displayPreviousFY, periodView]
  );

  const periodChartData = useMemo(
    () =>
      buildPeriodTrendChartData(
        periodRows,
        periodView,
        displayCurrentFY,
        displayPreviousFY
      ),
    [periodRows, displayCurrentFY, displayPreviousFY, periodView]
  );

  const segmentCardItems = useMemo(
    () => buildSegmentCardItems(segmentRows, displayCurrentFY, displayPreviousFY),
    [segmentRows, displayCurrentFY, displayPreviousFY]
  );

  const premiumSegmentCardItems = useMemo(
    () =>
      buildPremiumSegmentCardItems(
        premiumSegmentRows,
        displayCurrentFY,
        displayPreviousFY
      ),
    [premiumSegmentRows, displayCurrentFY, displayPreviousFY]
  );

  const [selectedPremiumSegmentId, setSelectedPremiumSegmentId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (premiumSegmentCardItems.length === 0) {
      setSelectedPremiumSegmentId(undefined);
      return;
    }

    setSelectedPremiumSegmentId((prev) => {
      if (prev && premiumSegmentCardItems.some((item) => item.id === prev)) {
        return prev;
      }

      const preferred =
        premiumSegmentCardItems.find((item) => {
          const normalized = item.id.toLowerCase();
          return (
            normalized.includes("premium") ||
            normalized.includes("primium") ||
            normalized.includes("premiu")
          );
        }) ?? premiumSegmentCardItems[0];

      return preferred?.id;
    });
  }, [premiumSegmentCardItems]);

  const premiumSegmentItem = useMemo(
    () =>
      premiumSegmentCardItems.find((item) => item.id === selectedPremiumSegmentId) ??
      premiumSegmentCardItems[0],
    [premiumSegmentCardItems, selectedPremiumSegmentId]
  );

  const segmentPivotTable = useMemo(
    () => buildSegmentPivotTable(segmentTableRows, displayCurrentFY, displayPreviousFY),
    [segmentTableRows, displayCurrentFY, displayPreviousFY]
  );

  const periodOptionsByMode = useMemo(
    () => ({
      month: buildPeriodCardItems(
        periodRowsByMode.month ?? [],
        displayCurrentFY,
        displayPreviousFY,
        "month"
      ),
      quarter: buildPeriodCardItems(
        periodRowsByMode.quarter ?? [],
        displayCurrentFY,
        displayPreviousFY,
        "quarter"
      ),
      half: buildPeriodCardItems(
        periodRowsByMode.half ?? [],
        displayCurrentFY,
        displayPreviousFY,
        "half"
      ),
    }),
    [periodRowsByMode, displayCurrentFY, displayPreviousFY]
  );

  const hasActiveFilters =
    appliedSegments.length > 0 ||
    appliedPeriodFilters.length > 0 ||
    appliedSalesAreas.length > 0 ||
    appliedRegionalOfficers.length > 0 ||
    appliedProductCategories.length > 0;

  const appliedPeriodFiltersKey = useMemo(
    () => appliedPeriodFilters.map(periodFilterKey).sort().join("|"),
    [appliedPeriodFilters]
  );

  const appliedSegmentsKey = useMemo(
    () => [...appliedSegments].sort().join("|"),
    [appliedSegments]
  );

  const appliedSalesAreasKey = useMemo(
    () => [...appliedSalesAreas].sort().join("|"),
    [appliedSalesAreas]
  );

  const appliedRegionalOfficersKey = useMemo(
    () => [...appliedRegionalOfficers].sort().join("|"),
    [appliedRegionalOfficers]
  );

  const appliedProductCategoriesKey = useMemo(
    () => [...appliedProductCategories].sort().join("|"),
    [appliedProductCategories]
  );

  const lubesFiltersKey = useMemo(
    () =>
      [
        appliedSegmentsKey,
        appliedRegionalOfficersKey,
        appliedSalesAreasKey,
        appliedProductCategoriesKey,
        appliedPeriodFiltersKey,
      ].join("\u001f"),
    [
      appliedSegmentsKey,
      appliedRegionalOfficersKey,
      appliedSalesAreasKey,
      appliedProductCategoriesKey,
      appliedPeriodFiltersKey,
    ]
  );

  const companyYtdFilters = useMemo(
    () =>
      buildCompanyApiFilters(
        appliedSegments,
        appliedRegionalOfficers,
        appliedSalesAreas,
        appliedProductCategories,
        appliedPeriodFilters
      ),
    [
      lubesFiltersKey,
      appliedSegments,
      appliedRegionalOfficers,
      appliedSalesAreas,
      appliedProductCategories,
      appliedPeriodFilters,
    ]
  );

  const segmentYtdFilters = useMemo(
    () =>
      buildSegmentApiFilters(
        [],
        appliedSegments,
        appliedRegionalOfficers,
        appliedSalesAreas,
        appliedProductCategories,
        appliedPeriodFilters
      ),
    [
      lubesFiltersKey,
      appliedSegments,
      appliedRegionalOfficers,
      appliedSalesAreas,
      appliedProductCategories,
      appliedPeriodFilters,
    ]
  );

  const regionalOfficerYtdFilters = useMemo(() => {
    const { ORG_RO_NM: _ro, ...rest } = buildCrossApiFilters(
      [],
      appliedSegments,
      appliedRegionalOfficers,
      appliedSalesAreas,
      appliedProductCategories,
      appliedPeriodFilters
    );
    return rest;
  }, [
    lubesFiltersKey,
    appliedSegments,
    appliedRegionalOfficers,
    appliedSalesAreas,
    appliedProductCategories,
    appliedPeriodFilters,
  ]);

  const productCategoryYtdFilters = useMemo(() => {
    const { PRODUCT_CATEGORY: _pc, ...rest } = buildCrossApiFilters(
      [],
      appliedSegments,
      appliedRegionalOfficers,
      appliedSalesAreas,
      appliedProductCategories,
      appliedPeriodFilters
    );
    return rest;
  }, [
    lubesFiltersKey,
    appliedSegments,
    appliedRegionalOfficers,
    appliedSalesAreas,
    appliedProductCategories,
    appliedPeriodFilters,
  ]);

  const crossYtdFilters = useMemo(
    () =>
      buildCrossApiFilters(
        [],
        appliedSegments,
        appliedRegionalOfficers,
        appliedSalesAreas,
        appliedProductCategories,
        appliedPeriodFilters
      ),
    [
      lubesFiltersKey,
      appliedSegments,
      appliedRegionalOfficers,
      appliedSalesAreas,
      appliedProductCategories,
      appliedPeriodFilters,
    ]
  );

  const clearAllFilters = () => {
    setAppliedSegments([]);
    setAppliedPeriodFilters([]);
    setAppliedSalesAreas([]);
    setAppliedRegionalOfficers([]);
    setAppliedProductCategories([]);
  };

  const handlePeriodViewChange = (mode: PeriodViewMode) => {
    if (mode === periodView) return;
    setPeriodView(mode);
    setAppliedPeriodFilters([]);
  };

  const toggleAppliedSegment = (segment: string) => {
    setAppliedSegments((prev) =>
      prev.includes(segment)
        ? prev.filter((entry) => entry !== segment)
        : [...prev, segment]
    );
  };

  const toggleAppliedPeriodFilter = (filter: PeriodFilter) => {
    setAppliedPeriodFilters((prev) => togglePeriodFilterDraft(prev, filter));
  };

  const applyFilters = (draft: LubesFiltersDraft) => {
    setAppliedPeriodFilters([...draft.periodFilters]);
    setAppliedRegionalOfficers([...draft.regionalOfficers]);
    setAppliedSalesAreas([...draft.salesAreas]);
    setAppliedSegments([...draft.segments]);
    setAppliedProductCategories([...draft.productCategories]);
  };

  const hasInitialized = useRef(false);
  const initialLoadFyRef = useRef<string | null>(null);
  const connectedFiltersRequestIdRef = useRef(0);
  const appliedSegmentsRef = useRef(appliedSegments);
  const appliedSalesAreasRef = useRef(appliedSalesAreas);
  const appliedRegionalOfficersRef = useRef(appliedRegionalOfficers);
  const appliedProductCategoriesRef = useRef(appliedProductCategories);
  const appliedPeriodFiltersRef = useRef(appliedPeriodFilters);

  appliedSegmentsRef.current = appliedSegments;
  appliedSalesAreasRef.current = appliedSalesAreas;
  appliedRegionalOfficersRef.current = appliedRegionalOfficers;
  appliedProductCategoriesRef.current = appliedProductCategories;
  appliedPeriodFiltersRef.current = appliedPeriodFilters;

  const getCrossApiFilters = useCallback(() => {
    return buildCrossApiFilters(
      [],
      appliedSegmentsRef.current,
      appliedRegionalOfficersRef.current,
      appliedSalesAreasRef.current,
      appliedProductCategoriesRef.current,
      appliedPeriodFiltersRef.current
    );
  }, []);

  const getCompanyApiFilters = useCallback(() => {
    return buildCompanyApiFilters(
      appliedSegmentsRef.current,
      appliedRegionalOfficersRef.current,
      appliedSalesAreasRef.current,
      appliedProductCategoriesRef.current,
      appliedPeriodFiltersRef.current
    );
  }, []);

  const getSegmentApiFilters = useCallback(() => {
    return buildSegmentApiFilters(
      [],
      appliedSegmentsRef.current,
      appliedRegionalOfficersRef.current,
      appliedSalesAreasRef.current,
      appliedProductCategoriesRef.current,
      appliedPeriodFiltersRef.current
    );
  }, []);

  const getSalesAreaChartApiFilters = useCallback(() => {
    const { ORG_SA_NM: _salesAreas, ...filters } = getCrossApiFilters();
    return filters;
  }, [getCrossApiFilters]);

  const getRegionalOfficerChartApiFilters = useCallback(() => {
    const { ORG_RO_NM: _regionalOfficers, ...filters } = getCrossApiFilters();
    return filters;
  }, [getCrossApiFilters]);

  const getProductCategoryChartApiFilters = useCallback(() => {
    const { PRODUCT_CATEGORY: _productCategories, ...filters } = getCrossApiFilters();
    return filters;
  }, [getCrossApiFilters]);

  const getPeriodBreakdownApiFilters = useCallback(() => {
    return buildPeriodBreakdownApiFilters(
      [],
      appliedSegmentsRef.current,
      appliedRegionalOfficersRef.current,
      appliedSalesAreasRef.current,
      appliedProductCategoriesRef.current
    );
  }, []);

  const fetchCompanyData = useCallback(async () => {
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesCompanyPayload(fiscalYears, getCompanyApiFilters())
    );
    setCompanyRows(mapLubesCompanyRows(normalizeAggregationRows(response.data)));
  }, [fiscalYears, getCompanyApiFilters]);

  const fetchCompanyFilterRows = useCallback(async () => {
    const periodFilters = appliedPeriodFiltersRef.current;
    if (periodFilters.length === 0) {
      setCompanyFilterRows([]);
      return;
    }
    const filterRes = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesCompanyFilterPayload(fiscalYears, getCompanyApiFilters())
    );
    setCompanyFilterRows(
      mapLubesCompanyRows(normalizeAggregationRows(filterRes.data))
    );
  }, [fiscalYears, getCompanyApiFilters]);

  const fetchPeriodData = useCallback(async () => {
    const periodModes: PeriodViewMode[] = ["half", "quarter", "month"];
    const extraFilters = getPeriodBreakdownApiFilters();
    const periodResponses = await Promise.all(
      periodModes.map((mode) =>
        apiClient.post(
          "/api/tableanalytics/generate_data_aggregations",
          buildLubesPeriodPayload(fiscalYears, mode, extraFilters)
        )
      )
    );

    const nextPeriodRows: Partial<Record<PeriodViewMode, LubesPeriodRow[]>> = {};
    periodModes.forEach((mode, index) => {
      nextPeriodRows[mode] = mapLubesPeriodRows(
        normalizeAggregationRows(periodResponses[index].data)
      );
    });
    setPeriodRowsByMode(nextPeriodRows);
  }, [fiscalYears, getPeriodBreakdownApiFilters]);

  const fetchSegmentData = useCallback(async () => {
    const extraFilters = getSegmentApiFilters();
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesSegmentPayload(fiscalYears, extraFilters)
    );
    setSegmentRows(mapLubesSegmentRows(normalizeAggregationRows(response.data)));
  }, [fiscalYears, getSegmentApiFilters]);

  const fetchSegmentTableData = useCallback(async () => {
    const extraFilters = getSegmentApiFilters();
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesSegmentTablePayload(fiscalYears, extraFilters)
    );
    setSegmentTableRows(
      mapLubesSegmentOfficerRows(normalizeAggregationRows(response.data))
    );
  }, [fiscalYears, getSegmentApiFilters]);

  const fetchPremiumSegmentData = useCallback(async () => {
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesPremiumSegmentPayload(fiscalYears, getSegmentApiFilters())
    );
    setPremiumSegmentRows(
      mapLubesPremiumSegmentRows(normalizeAggregationRows(response.data))
    );
  }, [fiscalYears, getSegmentApiFilters]);

  const fetchSalesAreaData = useCallback(async () => {
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesSalesAreaPayload(fiscalYears, getSalesAreaChartApiFilters())
    );
    setSalesAreaRows(mapLubesSalesAreaRows(normalizeAggregationRows(response.data)));
  }, [fiscalYears, getSalesAreaChartApiFilters]);

  const fetchRegionalOfficerData = useCallback(async () => {
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesRegionalOfficerPayload(fiscalYears, getRegionalOfficerChartApiFilters())
    );
    setRegionalOfficerRows(
      mapLubesRegionalOfficerRows(normalizeAggregationRows(response.data))
    );
  }, [fiscalYears, getRegionalOfficerChartApiFilters]);

  const fetchProductCategoryData = useCallback(async () => {
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesProductCategoryPayload(fiscalYears, getProductCategoryChartApiFilters())
    );
    setProductCategoryRows(
      mapLubesProductCategoryRows(normalizeAggregationRows(response.data))
    );
  }, [fiscalYears, getProductCategoryChartApiFilters]);

  const fetchItemCategoryData = useCallback(async () => {
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesItemCategoryPayload(fiscalYears, getCrossApiFilters())
    );
    setItemCategoryRows(
      mapLubesItemCategoryRows(normalizeAggregationRows(response.data))
    );
  }, [fiscalYears, getCrossApiFilters]);

  const fetchBldCategoryData = useCallback(async () => {
    const response = await apiClient.post(
      "/api/tableanalytics/generate_data_aggregations",
      buildLubesBldCategoryPayload(fiscalYears, getCrossApiFilters())
    );
    setBldCategoryRows(
      mapLubesBldCategoryRows(normalizeAggregationRows(response.data))
    );
  }, [fiscalYears, getCrossApiFilters]);

  const fetchConnectedFilterOptions = useCallback(async (draft: LubesConnectedFilterDraft) => {
    const requestId = ++connectedFiltersRequestIdRef.current;
    setConnectedFiltersLoading(true);
    try {
      const response = await apiClient.post(
        "/api/charts/get_distinct_values",
        buildLubesConnectedFilterDistinctPayload(draft, selectedFY)
      );
      if (requestId !== connectedFiltersRequestIdRef.current) return;

      setSegmentOptions(parseDistinctColumnValues(response.data, "SEGMENT"));
      setProductCategoryOptions(
        parseDistinctColumnValues(response.data, "PRODUCT_CATEGORY")
      );
      setRegionalOfficerOptions(parseDistinctColumnValues(response.data, "ORG_RO_NM"));
      setPopoverSalesAreaOptions(parseDistinctColumnValues(response.data, "ORG_SA_NM"));
    } finally {
      if (requestId === connectedFiltersRequestIdRef.current) {
        setConnectedFiltersLoading(false);
      }
    }
  }, [selectedFY]);


  const handleRefreshCompany = useCallback(async () => {
    setRefreshingCompany(true);
    setError(null);
    try {
      await fetchCompanyData();
      await fetchCompanyFilterRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh company data");
    } finally {
      setRefreshingCompany(false);
    }
  }, [fetchCompanyData, fetchCompanyFilterRows]);

  const handleRefreshPeriod = useCallback(async () => {
    setRefreshingPeriod(true);
    setError(null);
    try {
      await fetchPeriodData();
      setAppliedPeriodFilters([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh period data");
    } finally {
      setRefreshingPeriod(false);
    }
  }, [fetchPeriodData]);

  const handleRefreshSegment = useCallback(async () => {
    setRefreshingSegment(true);
    setError(null);
    try {
      await fetchSegmentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh segment data");
    } finally {
      setRefreshingSegment(false);
    }
  }, [fetchSegmentData]);

  const handleRefreshSegmentTable = useCallback(async () => {
    setRefreshingSegmentTable(true);
    setError(null);
    try {
      await fetchSegmentTableData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh segment table data");
    } finally {
      setRefreshingSegmentTable(false);
    }
  }, [fetchSegmentTableData]);

  const handleRefreshPremiumSegment = useCallback(async () => {
    setRefreshingPremiumSegment(true);
    setError(null);
    try {
      await fetchPremiumSegmentData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh premium segment data"
      );
    } finally {
      setRefreshingPremiumSegment(false);
    }
  }, [fetchPremiumSegmentData]);

  const handleRefreshSalesArea = useCallback(async () => {
    setRefreshingSalesArea(true);
    setError(null);
    try {
      await fetchSalesAreaData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh sales area data");
    } finally {
      setRefreshingSalesArea(false);
    }
  }, [fetchSalesAreaData]);

  const handleRefreshRegionalOfficer = useCallback(async () => {
    setRefreshingRegionalOfficer(true);
    setError(null);
    try {
      await fetchRegionalOfficerData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh regional officer data"
      );
    } finally {
      setRefreshingRegionalOfficer(false);
    }
  }, [fetchRegionalOfficerData]);

  const handleRefreshProductCategory = useCallback(async () => {
    setRefreshingProductCategory(true);
    setError(null);
    try {
      await fetchProductCategoryData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh product category data"
      );
    } finally {
      setRefreshingProductCategory(false);
    }
  }, [fetchProductCategoryData]);

  const handleRefreshItemCategory = useCallback(async () => {
    setRefreshingItemCategory(true);
    setError(null);
    try {
      await fetchItemCategoryData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh item category data"
      );
    } finally {
      setRefreshingItemCategory(false);
    }
  }, [fetchItemCategoryData]);

  const handleRefreshBldCategory = useCallback(async () => {
    setRefreshingBldCategory(true);
    setError(null);
    try {
      await fetchBldCategoryData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh BLD category data"
      );
    } finally {
      setRefreshingBldCategory(false);
    }
  }, [fetchBldCategoryData]);

  useEffect(() => {
    if (hasInitialized.current && initialLoadFyRef.current === displayCurrentFY) {
      return;
    }
    initialLoadFyRef.current = displayCurrentFY;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          fetchCompanyData(),
          fetchPeriodData(),
          fetchSegmentData(),
          fetchSegmentTableData(),
          fetchPremiumSegmentData(),
          fetchSalesAreaData(),
          fetchRegionalOfficerData(),
          fetchProductCategoryData(),
          fetchItemCategoryData(),
          fetchBldCategoryData(),
          fetchCompanyFilterRows(),
        ]);
      } catch (err) {
        setCompanyRows([]);
        setCompanyFilterRows([]);
        setPeriodRowsByMode({});
        setSegmentRows([]);
        setPremiumSegmentRows([]);
        setSegmentTableRows([]);
        setSalesAreaRows([]);
        setRegionalOfficerRows([]);
        setProductCategoryRows([]);
        setItemCategoryRows([]);
        setBldCategoryRows([]);
        setPopoverSalesAreaOptions([]);
        setRegionalOfficerOptions([]);
        setSegmentOptions([]);
        setProductCategoryOptions([]);
        setError(err instanceof Error ? err.message : "Failed to load lubes data");
      } finally {
        hasInitialized.current = true;
        setLoading(false);
      }
    };
    void load();
  }, [
    displayCurrentFY,
    fetchCompanyData,
    fetchPeriodData,
    fetchSegmentData,
    fetchSegmentTableData,
    fetchPremiumSegmentData,
    fetchSalesAreaData,
    fetchRegionalOfficerData,
    fetchProductCategoryData,
    fetchItemCategoryData,
    fetchBldCategoryData,
    fetchCompanyFilterRows,
  ]);

  useEffect(() => {
    void fetchConnectedFilterOptions({
      companies: [],
      segments: [],
      productCategories: [],
      regionalOfficers: [],
      salesAreas: [],
      periodFilters: [],
    });
  }, [fetchConnectedFilterOptions]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    void fetchConnectedFilterOptions({
      companies: [],
      segments: appliedSegments,
      productCategories: appliedProductCategories,
      regionalOfficers: appliedRegionalOfficers,
      salesAreas: appliedSalesAreas,
      periodFilters: appliedPeriodFilters,
    });
  }, [
    appliedSegmentsKey,
    appliedRegionalOfficersKey,
    appliedSalesAreasKey,
    appliedProductCategoriesKey,
    appliedPeriodFiltersKey,
    selectedFY,
    fetchConnectedFilterOptions,
  ]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    const refresh = async () => {
      setRefreshingPeriod(true);
      try {
        await fetchPeriodData();
      } catch {
        // Keep existing period data on filter refetch failure
      } finally {
        setRefreshingPeriod(false);
      }
    };
    refresh();
  }, [
    appliedSegmentsKey,
    appliedRegionalOfficersKey,
    appliedSalesAreasKey,
    appliedProductCategoriesKey,
    fetchPeriodData,
  ]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    const refresh = async () => {
      setRefreshingCompany(true);
      try {
        await fetchCompanyData();
        await fetchCompanyFilterRows();
      } catch {
        // Keep existing company data on filter refetch failure
      } finally {
        setRefreshingCompany(false);
      }
    };
    refresh();
  }, [
    appliedSegmentsKey,
    appliedRegionalOfficersKey,
    appliedSalesAreasKey,
    appliedProductCategoriesKey,
    appliedPeriodFiltersKey,
    fetchCompanyData,
    fetchCompanyFilterRows,
  ]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    const refresh = async () => {
      setRefreshingSegment(true);
      try {
        await Promise.all([
          fetchSegmentData(),
          fetchSegmentTableData(),
          fetchPremiumSegmentData(),
        ]);
      } catch {
        // Keep existing segment data on filter refetch failure
      } finally {
        setRefreshingSegment(false);
      }
    };
    refresh();
  }, [
    appliedSegmentsKey,
    appliedRegionalOfficersKey,
    appliedSalesAreasKey,
    appliedProductCategoriesKey,
    appliedPeriodFiltersKey,
    fetchSegmentData,
    fetchSegmentTableData,
    fetchPremiumSegmentData,
  ]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    const refresh = async () => {
      setRefreshingSalesArea(true);
      try {
        await fetchSalesAreaData();
      } catch {
        // Keep existing sales area data on filter refetch failure
      } finally {
        setRefreshingSalesArea(false);
      }
    };
    refresh();
  }, [
    appliedSegmentsKey,
    appliedRegionalOfficersKey,
    appliedProductCategoriesKey,
    appliedPeriodFiltersKey,
    fetchSalesAreaData,
  ]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    const refresh = async () => {
      setRefreshingRegionalOfficer(true);
      try {
        await fetchRegionalOfficerData();
      } catch {
        // Keep existing regional officer data on filter refetch failure
      } finally {
        setRefreshingRegionalOfficer(false);
      }
    };
    refresh();
  }, [
    appliedSegmentsKey,
    appliedSalesAreasKey,
    appliedProductCategoriesKey,
    appliedPeriodFiltersKey,
    fetchRegionalOfficerData,
  ]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    const refresh = async () => {
      setRefreshingProductCategory(true);
      try {
        await fetchProductCategoryData();
      } catch {
        // Keep existing product category data on filter refetch failure
      } finally {
        setRefreshingProductCategory(false);
      }
    };
    refresh();
  }, [
    appliedSegmentsKey,
    appliedRegionalOfficersKey,
    appliedSalesAreasKey,
    appliedProductCategoriesKey,
    appliedPeriodFiltersKey,
    fetchProductCategoryData,
  ]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    const refresh = async () => {
      setRefreshingItemCategory(true);
      try {
        await fetchItemCategoryData();
      } catch {
        // Keep existing item category data on filter refetch failure
      } finally {
        setRefreshingItemCategory(false);
      }
    };
    refresh();
  }, [
    appliedSegmentsKey,
    appliedRegionalOfficersKey,
    appliedSalesAreasKey,
    appliedProductCategoriesKey,
    appliedPeriodFiltersKey,
    fetchItemCategoryData,
  ]);

  useEffect(() => {
    if (!hasInitialized.current) return;
    const refresh = async () => {
      setRefreshingBldCategory(true);
      try {
        await fetchBldCategoryData();
      } catch {
        // Keep existing BLD category data on filter refetch failure
      } finally {
        setRefreshingBldCategory(false);
      }
    };
    refresh();
  }, [
    appliedSegmentsKey,
    appliedRegionalOfficersKey,
    appliedSalesAreasKey,
    appliedProductCategoriesKey,
    appliedPeriodFiltersKey,
    fetchBldCategoryData,
  ]);

  return (
    <div className={LUBES_PAGE.bg}>
      {/* Tab bar — always visible at the very top */}
      <div className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white px-2">
        <div className="flex items-center gap-0">
          {(["lubes-bazaar", "performance-analytics"] as const).map((tab) => {
            const label = tab === "lubes-bazaar" ? "Lubes Bazaar" : "Performance Analytics";
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-2 text-xs font-semibold transition-colors
                  ${active
                    ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-800"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header — only shown for Lubes Bazaar tab */}
      {activeTab === "lubes-bazaar" && <div className={LUBES_PAGE.header}>
        <div className="w-full px-2 py-1.5">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${LUBES_PAGE.headerIcon}`}>
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className={LUBES_PAGE.title}>
                  Lubes Bazaar
                </h1>
                <p className={`${LUBES_PAGE.subtitle} sm:hidden`}>
                  {displayCurrentFY} vs {displayPreviousFY}
                </p>
                <p className={`hidden ${LUBES_PAGE.subtitle} sm:block`}>
                  Net weight (TMT) · Click cards to filter · {displayCurrentFY} vs {displayPreviousFY}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Select value={selectedFY} onValueChange={setSelectedFY}>
                <SelectTrigger className="h-8 w-[10rem] rounded-md border-slate-200 bg-white text-xs font-semibold shadow-sm">
                  <SelectValue placeholder="Fiscal year" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYearOptions.map((fy) => (
                    <SelectItem key={fy} value={fy} className="text-xs">
                      {fy === currentFY ? `Present FY (${fy})` : `FY ${fy}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Global YTD toggle — sets all panels at once; active when ALL panels are in YTD mode */}
              <button
                type="button"
                onClick={toggleAllYtd}
                className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold shadow-sm transition-colors
                  ${allYtdActive
                    ? "border-blue-500 bg-blue-600 text-white hover:bg-blue-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                YTD
              </button>

              <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Filters"
                    className={`h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium shadow-sm ${
                      hasActiveFilters
                        ? LUBES_PAGE.filterActive
                        : LUBES_PAGE.filterIdle
                    }`}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                    {hasActiveFilters && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-bold">
                        {appliedSegments.length +
                          appliedPeriodFilters.length +
                          appliedSalesAreas.length +
                          appliedRegionalOfficers.length +
                          appliedProductCategories.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                {filterPopoverOpen && (
                  <LubesFiltersPopover
                    open={filterPopoverOpen}
                    appliedPeriodFilters={appliedPeriodFilters}
                    appliedSegments={appliedSegments}
                    appliedProductCategories={appliedProductCategories}
                    appliedRegionalOfficers={appliedRegionalOfficers}
                    appliedSalesAreas={appliedSalesAreas}
                    periodView={periodView}
                    periodOptionsByMode={periodOptionsByMode}
                    segmentOptions={segmentOptions}
                    productCategoryOptions={productCategoryOptions}
                    regionalOfficerOptions={regionalOfficerOptions}
                    salesAreaOptions={popoverSalesAreaOptions}
                    connectedFiltersLoading={connectedFiltersLoading}
                    onConnectedFiltersDraftChange={fetchConnectedFilterOptions}
                    onApply={applyFilters}
                    onClose={() => setFilterPopoverOpen(false)}
                  />
                )}
              </Popover>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Active
              </span>
              {appliedPeriodFilters.map((filter) => (
                <span
                  key={periodFilterKey(filter)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${LUBES_FILTER_CHIPS.period}`}
                >
                  {periodFilterLabel(filter)}
                  <button
                    type="button"
                    aria-label="Clear period filter"
                    onClick={() =>
                      setAppliedPeriodFilters((prev) =>
                        prev.filter((entry) => periodFilterKey(entry) !== periodFilterKey(filter))
                      )
                    }
                    className="rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {appliedSegments.map((segment) => (
                <span
                  key={segment}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${LUBES_FILTER_CHIPS.segment}`}
                >
                  Segment: {segment}
                  <button
                    type="button"
                    aria-label={`Clear ${segment} filter`}
                    onClick={() =>
                      setAppliedSegments((prev) => prev.filter((entry) => entry !== segment))
                    }
                    className="rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {appliedProductCategories.map((productCategory) => (
                <span
                  key={productCategory}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${LUBES_FILTER_CHIPS.product}`}
                >
                  Product: {productCategory}
                  <button
                    type="button"
                    aria-label={`Clear ${productCategory} filter`}
                    onClick={() =>
                      setAppliedProductCategories((prev) =>
                        prev.filter((entry) => entry !== productCategory)
                      )
                    }
                    className="rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {appliedRegionalOfficers.map((regionalOfficer) => (
                <span
                  key={regionalOfficer}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${LUBES_FILTER_CHIPS.regionalOfficer}`}
                >
                  RO: {regionalOfficer}
                  <button
                    type="button"
                    aria-label={`Clear ${regionalOfficer} filter`}
                    onClick={() =>
                      setAppliedRegionalOfficers((prev) =>
                        prev.filter((entry) => entry !== regionalOfficer)
                      )
                    }
                    className="rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {appliedSalesAreas.map((salesArea) => (
                <span
                  key={salesArea}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${LUBES_FILTER_CHIPS.salesArea}`}
                >
                  Sales Area: {salesArea}
                  <button
                    type="button"
                    aria-label={`Clear ${salesArea} filter`}
                    onClick={() =>
                      setAppliedSalesAreas((prev) => prev.filter((entry) => entry !== salesArea))
                    }
                    className="rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className={LUBES_PAGE.clearAll}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>}

      {/* Main content */}
      {activeTab === "performance-analytics" ? (
        <PerformanceAnalyticsTab />
      ) : (
      <div className="w-full min-w-0 space-y-2 p-2">
        {error && (
          <div className={LUBES_PAGE.error}>
            {error}
          </div>
        )}

        <>
          <div
            className="grid w-full min-w-0 grid-cols-1 items-stretch gap-2 lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] xl:grid-cols-[minmax(200px,240px)_minmax(0,1fr)]"
          >
            <div className="min-h-0 h-full">
              <CompanyNetWeightPanel
                loading={loading}
                refreshing={refreshingCompany}
                summaries={companySummaries}
                displayCurrentFY={displayCurrentFY}
                ytdActive={companyYtdActive}
                ytdExtraFilters={companyYtdFilters}
                ytdExtraFiltersKey={lubesFiltersKey}
                onYtdChange={setCompanyYtdActive}
                onRefresh={handleRefreshCompany}
              />
            </div>

            <div className="min-h-0 h-full">
              <FiscalPeriodBreakdownPanel
                loading={loading}
                refreshing={refreshingPeriod}
                periodView={periodView}
                periodCardItems={periodCardItems}
                chartData={periodChartData}
                displayCurrentFY={displayCurrentFY}
                displayPreviousFY={displayPreviousFY}
                appliedPeriodFilters={appliedPeriodFilters}
                onPeriodViewChange={handlePeriodViewChange}
                onTogglePeriodFilter={toggleAppliedPeriodFilter}
                onRefresh={handleRefreshPeriod}
              />
            </div>
          </div>

          <div className="space-y-2">
            <SegmentBreakdownPanel
              loading={loading}
              refreshing={refreshingSegment}
              segmentCardItems={segmentCardItems}
              appliedSegments={appliedSegments}
              displayCurrentFY={displayCurrentFY}
              ytdActive={segmentYtdActive}
              ytdExtraFilters={segmentYtdFilters}
              ytdExtraFiltersKey={lubesFiltersKey}
              onYtdChange={setSegmentYtdActive}
              onToggleSegment={toggleAppliedSegment}
              onRefresh={handleRefreshSegment}
            />

            <PremiumSegmentPanel
              loading={loading}
              refreshing={refreshingPremiumSegment}
              premiumCardItems={premiumSegmentCardItems}
              selectedPremiumSegmentId={selectedPremiumSegmentId}
              drillActive={premiumSegmentDrillActive}
              displayCurrentFY={displayCurrentFY}
              ytdActive={premiumYtdActive}
              ytdExtraFilters={segmentYtdFilters}
              ytdExtraFiltersKey={lubesFiltersKey}
              onYtdChange={setPremiumYtdActive}
              onSelectPremiumSegment={(segmentId) => {
                setSelectedPremiumSegmentId(segmentId);
                setPremiumSegmentDrillActive(true);
              }}
              onRefresh={handleRefreshPremiumSegment}
              drilldown={
                premiumSegmentDrillActive && premiumSegmentItem ? (
                  <PremiumSegmentDrilldownPanel
                    loading={loading}
                    refreshing={refreshingPremiumSegment}
                    fiscalYears={fiscalYears}
                    displayCurrentFY={displayCurrentFY}
                    displayPreviousFY={displayPreviousFY}
                    premiumSegmentName={premiumSegmentItem.id}
                    ytdActive={premiumYtdActive}
                    getBaseFilters={getSegmentApiFilters}
                    filtersKey={lubesFiltersKey}
                    onExitDrilldown={() => setPremiumSegmentDrillActive(false)}
                    onRefresh={handleRefreshPremiumSegment}
                  />
                ) : null
              }
            />

            <SegmentBreakdownTablePanel
              loading={loading}
              refreshing={refreshingSegmentTable}
              pivotTable={segmentPivotTable}
              displayCurrentFY={displayCurrentFY}
              displayPreviousFY={displayPreviousFY}
              ytdActive={segmentTableYtdActive}
              ytdExtraFilters={segmentYtdFilters}
              ytdExtraFiltersKey={lubesFiltersKey}
              onYtdChange={setSegmentTableYtdActive}
              onRefresh={handleRefreshSegmentTable}
            />
            <SegmentRegionStatusList
              fiscalYear={selectedFY}
            />
          </div>

          {/* <SalesAreaBreakdownPanel
          loading={loading}
          refreshing={refreshingSalesArea}
          salesAreaRows={salesAreaRows}
          displayCurrentFY={displayCurrentFY}
          displayPreviousFY={displayPreviousFY}
          onRefresh={handleRefreshSalesArea}
        /> */}

        {regionalOfficerDrillActive ? (
          <RegionalOfficerDrilldownPanel
            loading={loading}
            refreshing={refreshingRegionalOfficer}
            fiscalYears={fiscalYears}
            displayCurrentFY={displayCurrentFY}
            displayPreviousFY={displayPreviousFY}
            regionalOfficerRows={regionalOfficerRows}
            ytdActive={roYtdActive}
            onYtdChange={setRoYtdActive}
            getBaseFilters={getRegionalOfficerChartApiFilters}
            filtersKey={lubesFiltersKey}
            onExitDrilldown={() => setRegionalOfficerDrillActive(false)}
            onRefresh={handleRefreshRegionalOfficer}
          />
        ) : (
          <RegionalOfficerBreakdownPanel
            loading={loading}
            refreshing={refreshingRegionalOfficer}
            regionalOfficerRows={regionalOfficerRows}
            displayCurrentFY={displayCurrentFY}
            displayPreviousFY={displayPreviousFY}
            ytdActive={roYtdActive}
            ytdExtraFilters={regionalOfficerYtdFilters}
            ytdExtraFiltersKey={lubesFiltersKey}
            onYtdChange={setRoYtdActive}
            onDrillDown={() => setRegionalOfficerDrillActive(true)}
            onRefresh={handleRefreshRegionalOfficer}
          />
        )}

        {productCategoryDrillActive ? (
          <ProductCategoryDrilldownPanel
            loading={loading}
            refreshing={refreshingProductCategory}
            fiscalYears={fiscalYears}
            displayCurrentFY={displayCurrentFY}
            displayPreviousFY={displayPreviousFY}
            productCategoryRows={productCategoryRows}
            ytdActive={productCategoryYtdActive}
            onYtdChange={setProductCategoryYtdActive}
            getBaseFilters={getProductCategoryChartApiFilters}
            filtersKey={lubesFiltersKey}
            onExitDrilldown={() => setProductCategoryDrillActive(false)}
            onRefresh={handleRefreshProductCategory}
          />
        ) : (
          <ProductCategoryBreakdownPanel
            loading={loading}
            refreshing={refreshingProductCategory}
            productCategoryRows={productCategoryRows}
            displayCurrentFY={displayCurrentFY}
            displayPreviousFY={displayPreviousFY}
            ytdActive={productCategoryYtdActive}
            ytdExtraFilters={productCategoryYtdFilters}
            ytdExtraFiltersKey={lubesFiltersKey}
            onYtdChange={setProductCategoryYtdActive}
            onDrillDown={() => setProductCategoryDrillActive(true)}
            onRefresh={handleRefreshProductCategory}
          />
        )}
{/* 
        <ItemCategoryBreakdownPanel
          loading={loading}
          refreshing={refreshingItemCategory}
          itemCategoryRows={itemCategoryRows}
          displayCurrentFY={displayCurrentFY}
          displayPreviousFY={displayPreviousFY}
          onRefresh={handleRefreshItemCategory}
        /> */}

        <BldCategoryBreakdownPanel
          loading={loading}
          refreshing={refreshingBldCategory}
          bldCategoryRows={bldCategoryRows}
          displayCurrentFY={displayCurrentFY}
          displayPreviousFY={displayPreviousFY}
          ytdActive={bldYtdActive}
          ytdExtraFilters={crossYtdFilters}
          ytdExtraFiltersKey={lubesFiltersKey}
          onYtdChange={setBldYtdActive}
          onRefresh={handleRefreshBldCategory}
        />
        </>
      </div>
      )}
    </div>
  );
};

export default LubesSalesPerformancePage;
