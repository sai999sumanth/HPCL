import type {
  CompanySummary,
  CompareValues,
  LubesCompanyRow,
  LubesPeriodRow,
  LubesPremiumSegmentRow,
  LubesSalesAreaRow,
  LubesBldCategoryRow,
  LubesItemCategoryRow,
  LubesProductCategoryRow,
  LubesRegionalOfficerRow,
  LubesSegmentRow,
  LubesSegmentOfficerRow,
  SegmentTableRow,
  SegmentPivotCell,
  SegmentPivotRow,
  SegmentPivotTableData,
  PeriodCardItem,
  PeriodFilter,
  PeriodViewMode,
  SalesAreaChartRow,
} from "./lubesSalesPerformance.types";

export const FISCAL_MONTH_ORDER = [
  "APR", "MAY", "JUN", "JUL", "AUG", "SEP",
  "OCT", "NOV", "DEC", "JAN", "FEB", "MAR",
];
export const HALF_YEAR_ORDER = ["H1", "H2"];
export const QUARTER_ORDER = ["Q1", "Q2", "Q3", "Q4"];

export const AGGREGATIONS = ["['Total', 'sum', 'NET_WEIGHT_TMT']"];

export type LubesOperatorFilter = {
  operator: string;
  value: string;
};

export type LubesTableFilters = Record<string, string[] | LubesOperatorFilter>;

/** Scoped to Lubes Bazar (BAZ sales areas) on every page request. */
export const LUBES_BASE_PAGE_FILTERS: LubesTableFilters = {
  ORG_SA_NM: { operator: "like", value: "%BAZ%" },
};

export const withLubesBaseFilters = (
  extraFilters: Record<string, string[]> = {}
): LubesTableFilters => ({
  ...LUBES_BASE_PAGE_FILTERS,
  ...extraFilters,
});

export type LubesDistinctWhereCond = {
  key: string;
  cond: string;
  value: string;
};

export type LubesDistinctValuesPayload = {
  connection_id: number;
  schema: string;
  table: string;
  column: string[];
  where_cond: LubesDistinctWhereCond[];
};

export type LubesConnectedFilterDraft = {
  companies: string[];
  segments: string[];
  productCategories: string[];
  regionalOfficers: string[];
  salesAreas: string[];
  periodFilters: PeriodFilter[];
};

export const LUBES_CONNECTED_FILTER_COLUMNS = [
  "SEGMENT",
  "PRODUCT_CATEGORY",
  "ORG_RO_NM",
  "ORG_SA_NM",
] as const;

/** Always applied on Lubes Bazar connected filter distinct-values requests. */
export const LUBES_CONNECTED_FILTER_BASE_WHERE: LubesDistinctWhereCond[] = [
  { key: "ORG_SA_NM", cond: "like", value: "BAZ" },
];

const appendDistinctWhereFilter = (
  where_cond: LubesDistinctWhereCond[],
  key: string,
  values: string[]
) => {
  if (values.length === 0) return;
  if (values.length === 1) {
    where_cond.push({ key, cond: "=", value: values[0] });
    return;
  }
  where_cond.push({ key, cond: "in", value: values.join(",") });
};

export const buildLubesConnectedFilterDistinctPayload = (
  draft: LubesConnectedFilterDraft,
  fiscalYear = ""
): LubesDistinctValuesPayload => {
  const where_cond: LubesDistinctWhereCond[] = [...LUBES_CONNECTED_FILTER_BASE_WHERE];

  if (fiscalYear) {
    where_cond.push({ key: "FISCAL_YEAR", cond: "=", value: fiscalYear });
  }

  appendDistinctWhereFilter(where_cond, "CATEGORY", draft.companies);
  appendDistinctWhereFilter(where_cond, "SEGMENT", draft.segments);
  appendDistinctWhereFilter(where_cond, "PRODUCT_CATEGORY", draft.productCategories);
  appendDistinctWhereFilter(where_cond, "ORG_RO_NM", draft.regionalOfficers);
  appendDistinctWhereFilter(where_cond, "ORG_SA_NM", draft.salesAreas);

  const monthFilters = draft.periodFilters.filter((filter) => filter.mode === "month");
  const quarterFilters = draft.periodFilters.filter((filter) => filter.mode === "quarter");
  const halfFilters = draft.periodFilters.filter((filter) => filter.mode === "half");

  if (monthFilters.length === 1) {
    where_cond.push({
      key: "MONTH_NAME",
      cond: "=",
      value: toMonthApiValue(monthFilters[0].id),
    });
  }
  if (quarterFilters.length === 1) {
    where_cond.push({ key: "QUARTER", cond: "=", value: quarterFilters[0].id });
  }
  if (halfFilters.length === 1) {
    where_cond.push({ key: "HALF_YEAR", cond: "=", value: halfFilters[0].id });
  }

  return {
    connection_id: 1,
    schema: "public",
    table: "lubes_baazar_data",
    column: [...LUBES_CONNECTED_FILTER_COLUMNS],
    where_cond,
  };
};

const PERIOD_GROUP_BY: Record<PeriodViewMode, string[]> = {
  half: ["FISCAL_YEAR", "HALF_YEAR"],
  quarter: ["FISCAL_YEAR", "QUARTER"],
  month: ["FISCAL_YEAR", "MONTH_NAME"],
};

export const buildLubesCompanyPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['FISCAL_YEAR', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["CATEGORY", "FISCAL_YEAR"],
});

export const buildLubesCompanyFilterPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: [
    "['CATEGORY', 'asc']",
    "['FISCAL_YEAR', 'asc']",
  ],
  limit: 0,
  skip: 0,
  group_by: ["CATEGORY", "FISCAL_YEAR", "HALF_YEAR", "QUARTER", "MONTH_NAME"],
});

export const buildLubesPeriodPayload = (
  fiscalYears: string[],
  mode: PeriodViewMode,
  extraFilters: Record<string, string[]> = {}
) => {
  return {
    table: "lubes_baazar_data",
    filters: { FISCAL_YEAR: fiscalYears, CATEGORY: ["Bazaar"], ...withLubesBaseFilters(extraFilters) },
    date_column: null,
    date_from: null,
    date_to: null,
    aggregations: AGGREGATIONS,
    detail_fields: [],
    order_by: ["['FISCAL_YEAR', 'asc']"],
    limit: 0,
    skip: 0,
    group_by: PERIOD_GROUP_BY[mode],
  };
};

export const buildLubesSegmentPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, CATEGORY: ["Bazaar"], ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['SEGMENT', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "SEGMENT"],
});

export const buildLubesSegmentTablePayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, CATEGORY: ["Bazaar"], ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['SEGMENT', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "SEGMENT", "ORG_RO_NM"],
});

/** YTD payload for the Segment Wise Table (SEGMENT × ORG_RO_NM), scoped by date range. */
export const buildLubesSegmentTableYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: [fiscalYear], CATEGORY: ["Bazaar"], ...withLubesBaseFilters(extraFilters) },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['SEGMENT', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "SEGMENT", "ORG_RO_NM"],
});

export const buildLubesSegmentRegionStatusPayload = (fiscalYears: string[]) => ({
  table: "lubes_baazar_data",
  filters: {
    FISCAL_YEAR: fiscalYears,
    ...LUBES_BASE_PAGE_FILTERS,
  },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['STATUS', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "STATUS", "NAME1"],
});

export const buildLubesSegmentDistributorStatusPayload = (
  fiscalYear: string,
  status: "Active" | "Inactive" | "Recently_Added"
) => ({
  table: "lubes_baazar_data",
  filters: {
    FISCAL_YEAR: [fiscalYear],
    ...LUBES_BASE_PAGE_FILTERS,
    STATUS: status,
  },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['NAME1', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["NAME1", "ORG_SA_NM"],
});

export const buildLubesSegmentDistributorMonthlyPayload = (
  fiscalYear: string,
  status: "Active" | "Inactive" | "Recently_Added",
  monthName: string
) => ({
  table: "lubes_baazar_data",
  filters: {
    FISCAL_YEAR: [fiscalYear],
    ...LUBES_BASE_PAGE_FILTERS,
    STATUS: status,
    MONTH_NAME: [monthName],
  },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['NAME1', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["NAME1", "ORG_SA_NM", "MONTH_NAME"],
});

/** Build YTD (year-to-date) payload. dateFrom/dateTo in YYYYMMDD format. */
export const buildLubesYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: {
    FISCAL_YEAR: [fiscalYear],
    ...withLubesBaseFilters(extraFilters),
  },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['FISCAL_YEAR', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["CATEGORY", "FISCAL_YEAR"],
});

/** YTD payload scoped to Bazaar segments. dateFrom/dateTo in YYYYMMDD format. */
export const buildLubesSegmentYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: {
    FISCAL_YEAR: [fiscalYear],
    CATEGORY: ["Bazaar"],
    ...withLubesBaseFilters(extraFilters),
  },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['SEGMENT', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "SEGMENT"],
});

export const buildLubesDistributorLastDatePayload = (
  status: "Active" | "Inactive" | "Recently_Added"
) => ({
  table: "lubes_baazar_data",
  filters: {
    ...LUBES_BASE_PAGE_FILTERS,
    STATUS: status,
  },
  aggregations: [
    "['Total','sum','NET_WEIGHT_TMT']",
    "['LAST_DATE','max','PS_DT_ID']",
  ],
  group_by: ["NAME1"],
  order_by: ["['NAME1','asc']"],
});

export const buildLubesPremiumSegmentPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, CATEGORY: ["Bazaar"], ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['PREMIUM_SEGMENT', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "PREMIUM_SEGMENT"],
});

/** YTD payload scoped to Bazaar premium segments. dateFrom/dateTo in YYYYMMDD format. */
export const buildLubesPremiumSegmentYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: {
    FISCAL_YEAR: [fiscalYear],
    CATEGORY: ["Bazaar"],
    ...withLubesBaseFilters(extraFilters),
  },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['PREMIUM_SEGMENT', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "PREMIUM_SEGMENT"],
});

export const buildLubesSalesAreaPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['ORG_SA_NM', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "ORG_SA_NM"],
});

export const buildLubesRegionalOfficerPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['ORG_RO_NM', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "ORG_RO_NM"],
});

export const buildLubesRegionalOfficerYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: [fiscalYear], ...withLubesBaseFilters(extraFilters) },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['ORG_RO_NM', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "ORG_RO_NM"],
});

export const buildLubesSalesAreaYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: [fiscalYear], ...withLubesBaseFilters(extraFilters) },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['ORG_SA_NM', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "ORG_SA_NM"],
});

export const buildLubesBldCategoryYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: [fiscalYear], ...withLubesBaseFilters(extraFilters) },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['NAME1', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "NAME1"],
});

export const buildLubesProductCategoryPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['PRODUCT_CATEGORY', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "PRODUCT_CATEGORY"],
});

export const buildLubesProductCategoryYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: [fiscalYear], ...withLubesBaseFilters(extraFilters) },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['PRODUCT_CATEGORY', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "PRODUCT_CATEGORY"],
});

export const buildLubesItemCategoryPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['MATERIAL_NM', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "MATERIAL_NM"],
});

/** YTD payload for item category (MATERIAL_NM), scoped by date range + any extra filters (e.g. PREMIUM_SEGMENT). */
export const buildLubesItemCategoryYtdPayload = (
  fiscalYear: string,
  dateFrom: string,
  dateTo: string,
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: [fiscalYear], ...withLubesBaseFilters(extraFilters) },
  date_column: "PS_DT_ID",
  date_from: dateFrom,
  date_to: dateTo,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['MATERIAL_NM', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "MATERIAL_NM"],
});

export const buildLubesBldCategoryPayload = (
  fiscalYears: string[],
  extraFilters: Record<string, string[]> = {}
) => ({
  table: "lubes_baazar_data",
  filters: { FISCAL_YEAR: fiscalYears, ...withLubesBaseFilters(extraFilters) },
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGGREGATIONS,
  detail_fields: [],
  order_by: ["['NAME1', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "NAME1"],
});

export const buildPeriodApiFilters = (
  periodFilters: PeriodFilter[]
): Record<string, string[]> => {
  const filters: Record<string, string[]> = {};
  const months = periodFilters
    .filter((filter) => filter.mode === "month")
    .map((filter) => toMonthApiValue(filter.id));
  const quarters = periodFilters
    .filter((filter) => filter.mode === "quarter")
    .map((filter) => filter.id);
  const halves = periodFilters
    .filter((filter) => filter.mode === "half")
    .map((filter) => filter.id);

  if (months.length > 0) filters.MONTH_NAME = months;
  if (quarters.length > 0) filters.QUARTER = quarters;
  if (halves.length > 0) filters.HALF_YEAR = halves;

  return filters;
};

export const buildApiExtraFilters = (
  companies: string[],
  segments: string[],
  regionalOfficers: string[] = [],
  salesAreas: string[] = [],
  productCategories: string[] = [],
  periodFilters: PeriodFilter[] = []
): Record<string, string[]> => {
  const filters: Record<string, string[]> = {
    ...buildPeriodApiFilters(periodFilters),
  };
  if (companies.length > 0) filters.CATEGORY = companies;
  if (segments.length > 0) filters.SEGMENT = segments;
  if (regionalOfficers.length > 0) filters.ORG_RO_NM = regionalOfficers;
  if (salesAreas.length > 0) filters.ORG_SA_NM = salesAreas;
  if (productCategories.length > 0) filters.PRODUCT_CATEGORY = productCategories;
  return filters;
};

export const buildCompanyApiFilters = (
  segments: string[],
  regionalOfficers: string[],
  salesAreas: string[],
  productCategories: string[] = [],
  periodFilters: PeriodFilter[] = []
) =>
  buildApiExtraFilters(
    [],
    segments,
    regionalOfficers,
    salesAreas,
    productCategories,
    periodFilters
  );

export const buildSegmentApiFilters = (
  companies: string[],
  segments: string[],
  regionalOfficers: string[],
  salesAreas: string[],
  productCategories: string[] = [],
  periodFilters: PeriodFilter[] = []
) =>
  buildApiExtraFilters(
    companies,
    segments,
    regionalOfficers,
    salesAreas,
    productCategories,
    periodFilters
  );

export const buildCrossApiFilters = (
  companies: string[],
  segments: string[],
  regionalOfficers: string[],
  salesAreas: string[],
  productCategories: string[] = [],
  periodFilters: PeriodFilter[] = []
) =>
  buildApiExtraFilters(
    companies,
    segments,
    regionalOfficers,
    salesAreas,
    productCategories,
    periodFilters
  );

/** Cross-filters for Fiscal Period Breakdown — never scoped by selected period cards. */
export const buildPeriodBreakdownApiFilters = (
  companies: string[],
  segments: string[],
  regionalOfficers: string[],
  salesAreas: string[],
  productCategories: string[] = []
) =>
  buildCrossApiFilters(
    companies,
    segments,
    regionalOfficers,
    salesAreas,
    productCategories,
    []
  );

export const normalizeAggregationRows = (raw: unknown): Record<string, unknown>[] => {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (row): row is Record<string, unknown> =>
        row !== null && typeof row === "object" && !Array.isArray(row)
    );
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return normalizeAggregationRows(obj.data);
    if (obj.data !== undefined) return normalizeAggregationRows(obj.data);
  }
  return [];
};

export const parseDistinctColumnValues = (raw: unknown, column: string): string[] => {
  const root =
    raw != null && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
      ? (raw as { data?: unknown }).data
      : raw;
  if (root == null || typeof root !== "object") return [];

  const columnValues = (root as Record<string, unknown>)[column];
  if (!Array.isArray(columnValues)) return [];

  return [...new Set(
    columnValues
      .map((value) => String(value ?? "").trim())
      .filter((value) => value && value.toLowerCase() !== "null")
  )].sort((a, b) => a.localeCompare(b));
};

export const pickField = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

export const normalizeHalfYear = (value: string) => {
  const upper = value.toUpperCase().replace(/\s+/g, " ");
  if (upper.includes("1") || upper === "H1") return "H1";
  if (upper.includes("2") || upper === "H2") return "H2";
  return upper;
};

export const normalizeQuarter = (value: string) => {
  const upper = value.toUpperCase().replace(/\s+/g, "");
  const match = upper.match(/Q?([1-4])/);
  return match ? `Q${match[1]}` : upper;
};

export const normalizeMonth = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 3).toUpperCase();
};

/** Title-case month for API filter payloads, e.g. "MAY" → "May". */
export const toMonthApiValue = (value: string) => {
  const key = normalizeMonth(value);
  return key.charAt(0) + key.slice(1).toLowerCase();
};

export const halfYearLabel = (value: string) =>
  value === "H1" ? "H1 (Half Year 1)" : value === "H2" ? "H2 (Half Year 2)" : value;

export const quarterLabel = (value: string) => {
  const num = value.replace(/\D/g, "");
  return num ? `Q${num} (Quarter ${num})` : value;
};

export const monthLabel = (value: string) => {
  const key = normalizeMonth(value);
  return key.charAt(0) + key.slice(1).toLowerCase();
};

export const periodFilterLabel = (filter: PeriodFilter) => {
  if (filter.mode === "month") return monthLabel(filter.id);
  if (filter.mode === "quarter") return quarterLabel(filter.id);
  return halfYearLabel(filter.id);
};

export const sortByOrder = (values: string[], order: string[]) =>
  [...values].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

export const mapLubesCompanyRows = (rows: Record<string, unknown>[]): LubesCompanyRow[] =>
  rows
    .map((row) => {
      const company = pickField(row, [
        "category",
        "CATEGORY",
        "Category",
        "COMPANY",
        "company",
      ]);
      if (!company || company.toLowerCase() === "null") return null;

      return {
        COMPANY: company,
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        HALF_YEAR: normalizeHalfYear(
          pickField(row, ["HALF_YEAR", "half_year", "Half_Year", "HALFYEAR"])
        ),
        QUARTER: normalizeQuarter(
          pickField(row, ["QUARTER", "quarter", "Quarter"])
        ),
        MONTH_NAME: normalizeMonth(
          pickField(row, ["MONTH_NAME", "month_name", "MONTH", "month"])
        ),
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesCompanyRow => row !== null);

export const mapLubesPeriodRows = (rows: Record<string, unknown>[]): LubesPeriodRow[] =>
  rows
    .map((row) => ({
      FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
      HALF_YEAR: normalizeHalfYear(
        pickField(row, ["HALF_YEAR", "half_year", "Half_Year", "HALFYEAR"])
      ),
      QUARTER: normalizeQuarter(
        pickField(row, ["QUARTER", "quarter", "Quarter"])
      ),
      MONTH_NAME: normalizeMonth(
        pickField(row, ["MONTH_NAME", "month_name", "MONTH", "month"])
      ),
      Total: Number(row.Total ?? row.total ?? 0),
    }))
    .filter((row) => row.FISCAL_YEAR !== "");

export const mapLubesSegmentRows = (rows: Record<string, unknown>[]): LubesSegmentRow[] =>
  rows
    .map((row) => {
      const segment = pickField(row, ["SEGMENT", "segment", "Segment"]);
      if (!segment || segment.toLowerCase() === "null") return null;
      return {
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        SEGMENT: segment,
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesSegmentRow => row !== null);

const sumSegmentRows = (
  rows: LubesSegmentRow[],
  fiscalYear: string,
  segment?: string
) =>
  rows
    .filter((row) => {
      if (row.FISCAL_YEAR !== fiscalYear) return false;
      if (segment && row.SEGMENT !== segment) return false;
      return true;
    })
    .reduce((sum, row) => sum + row.Total, 0);

export const calcChangePct = (current: number, hist: number) => {
  if (hist === 0) return current !== 0 ? 100 : 0;
  return Number((((current - hist) / hist) * 100).toFixed(2));
};

const buildSegmentCompare = (
  rows: LubesSegmentRow[],
  currentFY: string,
  previousFY: string,
  segment: string
): CompareValues => {
  const current = sumSegmentRows(rows, currentFY, segment);
  const hist = sumSegmentRows(rows, previousFY, segment);
  return { current, hist, pct: calcChangePct(current, hist) };
};

export const buildSegmentCardItems = (
  rows: LubesSegmentRow[],
  currentFY: string,
  previousFY: string
): PeriodCardItem[] => {
  const segments = [...new Set(rows.map((row) => row.SEGMENT).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
  return segments.map((segment) => ({
    id: segment,
    label: segment,
    compare: buildSegmentCompare(rows, currentFY, previousFY, segment),
  }));
};

/** Build PeriodCardItem[] for YTD segment view from two raw API responses. */
export const buildSegmentYtdCardItems = (
  currentData: unknown,
  prevData: unknown
): PeriodCardItem[] => {
  const currentRows = mapLubesSegmentRows(normalizeAggregationRows(currentData));
  const prevRows = mapLubesSegmentRows(normalizeAggregationRows(prevData));

  const currentBySegment = new Map<string, number>();
  for (const r of currentRows) currentBySegment.set(r.SEGMENT, (currentBySegment.get(r.SEGMENT) ?? 0) + r.Total);

  const prevBySegment = new Map<string, number>();
  for (const r of prevRows) prevBySegment.set(r.SEGMENT, (prevBySegment.get(r.SEGMENT) ?? 0) + r.Total);

  const segments = [...new Set([...currentBySegment.keys(), ...prevBySegment.keys()])].sort();
  return segments.map((segment) => {
    const current = currentBySegment.get(segment) ?? 0;
    const hist = prevBySegment.get(segment) ?? 0;
    return { id: segment, label: segment, compare: { current, hist, pct: calcChangePct(current, hist) } };
  });
};

export const mapLubesPremiumSegmentRows = (
  rows: Record<string, unknown>[]
): LubesPremiumSegmentRow[] =>
  rows
    .map((row) => {
      const premiumSegment = pickField(row, [
        "PREMIUM_SEGMENT",
        "premium_segment",
        "PREMIUM_SEGMENT",
        "premium_segment",
      ]);
      if (!premiumSegment || premiumSegment.toLowerCase() === "null") return null;
      return {
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        PREMIUM_SEGMENT: premiumSegment,
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesPremiumSegmentRow => row !== null);

const sumPremiumSegmentRows = (
  rows: LubesPremiumSegmentRow[],
  fiscalYear: string,
  premiumSegment?: string
) =>
  rows
    .filter((row) => {
      if (row.FISCAL_YEAR !== fiscalYear) return false;
      if (premiumSegment && row.PREMIUM_SEGMENT !== premiumSegment) return false;
      return true;
    })
    .reduce((sum, row) => sum + row.Total, 0);

const buildPremiumSegmentCompare = (
  rows: LubesPremiumSegmentRow[],
  currentFY: string,
  previousFY: string,
  premiumSegment: string
): CompareValues => {
  const current = sumPremiumSegmentRows(rows, currentFY, premiumSegment);
  const hist = sumPremiumSegmentRows(rows, previousFY, premiumSegment);
  return { current, hist, pct: calcChangePct(current, hist) };
};

export const buildPremiumSegmentCardItems = (
  rows: LubesPremiumSegmentRow[],
  currentFY: string,
  previousFY: string
): PeriodCardItem[] => {
  const premiumSegments = [
    ...new Set(rows.map((row) => row.PREMIUM_SEGMENT).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  return premiumSegments.map((premiumSegment) => ({
    id: premiumSegment,
    label: premiumSegment,
    compare: buildPremiumSegmentCompare(
      rows,
      currentFY,
      previousFY,
      premiumSegment
    ),
  }));
};

/** Build PeriodCardItem[] for YTD premium segment view from two raw API responses. */
export const buildPremiumSegmentYtdCardItems = (
  currentData: unknown,
  prevData: unknown
): PeriodCardItem[] => {
  const currentRows = mapLubesPremiumSegmentRows(normalizeAggregationRows(currentData));
  const prevRows = mapLubesPremiumSegmentRows(normalizeAggregationRows(prevData));

  const currentMap = new Map<string, number>();
  for (const r of currentRows) currentMap.set(r.PREMIUM_SEGMENT, (currentMap.get(r.PREMIUM_SEGMENT) ?? 0) + r.Total);

  const prevMap = new Map<string, number>();
  for (const r of prevRows) prevMap.set(r.PREMIUM_SEGMENT, (prevMap.get(r.PREMIUM_SEGMENT) ?? 0) + r.Total);

  const segments = [...new Set([...currentMap.keys(), ...prevMap.keys()])].sort();
  return segments.map((seg) => {
    const current = currentMap.get(seg) ?? 0;
    const hist = prevMap.get(seg) ?? 0;
    return { id: seg, label: seg, compare: { current, hist, pct: calcChangePct(current, hist) } };
  });
};

export const mapLubesSegmentOfficerRows = (
  rows: Record<string, unknown>[]
): LubesSegmentOfficerRow[] =>
  rows
    .map((row) => {
      const segment = pickField(row, ["SEGMENT", "segment", "Segment"]);
      const regionalOfficer = pickField(row, [
        "ORG_RO_NM",
        "org_ro_nm",
        "ORGRO_NM",
        "regional_officer",
      ]);
      if (!segment || segment.toLowerCase() === "null") return null;
      if (!regionalOfficer || regionalOfficer.toLowerCase() === "null") return null;
      return {
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        SEGMENT: segment,
        ORG_RO_NM: regionalOfficer,
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesSegmentOfficerRow => row !== null);

export const buildSegmentTableRows = (
  rows: LubesSegmentOfficerRow[],
  currentFY: string,
  previousFY: string
): SegmentTableRow[] => {
  const byKey = new Map<
    string,
    { segment: string; regionalOfficer: string; current: number; hist: number }
  >();

  for (const row of rows) {
    const key = `${row.SEGMENT}|${row.ORG_RO_NM}`;
    const entry =
      byKey.get(key) ?? {
        segment: row.SEGMENT,
        regionalOfficer: row.ORG_RO_NM,
        current: 0,
        hist: 0,
      };
    if (row.FISCAL_YEAR === currentFY) entry.current += row.Total;
    if (row.FISCAL_YEAR === previousFY) entry.hist += row.Total;
    byKey.set(key, entry);
  }

  return Array.from(byKey.entries())
    .map(([key, entry]) => ({
      key,
      segment: entry.segment,
      regionalOfficer: entry.regionalOfficer,
      current: entry.current,
      hist: entry.hist,
      pct: calcChangePct(entry.current, entry.hist),
    }))
    .sort(
      (a, b) =>
        a.segment.localeCompare(b.segment) ||
        b.current - a.current ||
        a.regionalOfficer.localeCompare(b.regionalOfficer)
    );
};

export const formatShortFiscalYear = (fiscalYear: string) => {
  const parts = fiscalYear.split("-");
  if (parts.length === 2 && parts[0].length >= 2 && parts[1].length >= 2) {
    return `${parts[0].slice(-2)}-${parts[1].slice(-2)}`;
  }
  return fiscalYear;
};

export const formatLubesRegionLabel = (orgRoNm: string) => {
  const cleaned = orgRoNm
    .replace(/^LUBES\s*RO\s*/i, "")
    .replace(/^RO\s*/i, "")
    .trim();
  if (!cleaned) return orgRoNm;
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const emptyPivotCell = (): SegmentPivotCell => ({
  current: 0,
  hist: 0,
  pct: 0,
});

export const buildSegmentPivotTable = (
  rows: LubesSegmentOfficerRow[],
  currentFY: string,
  previousFY: string
): SegmentPivotTableData => {
  const segmentSet = new Set<string>();
  const regionMap = new Map<
    string,
    Map<string, { current: number; hist: number }>
  >();

  for (const row of rows) {
    segmentSet.add(row.SEGMENT);
    if (!regionMap.has(row.ORG_RO_NM)) {
      regionMap.set(row.ORG_RO_NM, new Map());
    }
    const segmentMap = regionMap.get(row.ORG_RO_NM)!;
    const cell = segmentMap.get(row.SEGMENT) ?? { current: 0, hist: 0 };
    if (row.FISCAL_YEAR === currentFY) cell.current += row.Total;
    if (row.FISCAL_YEAR === previousFY) cell.hist += row.Total;
    segmentMap.set(row.SEGMENT, cell);
  }

  const segments = [...segmentSet].sort((a, b) => a.localeCompare(b));
  const pivotRows: SegmentPivotRow[] = [...regionMap.entries()]
    .map(([regionRaw, segmentMap]) => {
      const bySegment: Record<string, SegmentPivotCell> = {};
      let totalCurrent = 0;
      let totalHist = 0;

      for (const segment of segments) {
        const values = segmentMap.get(segment) ?? { current: 0, hist: 0 };
        bySegment[segment] = {
          current: values.current,
          hist: values.hist,
          pct: calcChangePct(values.current, values.hist),
        };
        totalCurrent += values.current;
        totalHist += values.hist;
      }

      return {
        key: regionRaw,
        regionRaw,
        region: formatLubesRegionLabel(regionRaw),
        bySegment,
        total: {
          current: totalCurrent,
          hist: totalHist,
          pct: calcChangePct(totalCurrent, totalHist),
        },
      };
    })
    .sort((a, b) => a.region.localeCompare(b.region));

  const segmentTotals = Object.fromEntries(
    segments.map((segment) => [segment, emptyPivotCell()])
  ) as Record<string, SegmentPivotCell>;
  const grandTotal = emptyPivotCell();

  for (const row of pivotRows) {
    grandTotal.current += row.total.current;
    grandTotal.hist += row.total.hist;
    for (const segment of segments) {
      segmentTotals[segment].current += row.bySegment[segment].current;
      segmentTotals[segment].hist += row.bySegment[segment].hist;
    }
  }

  grandTotal.pct = calcChangePct(grandTotal.current, grandTotal.hist);
  for (const segment of segments) {
    segmentTotals[segment].pct = calcChangePct(
      segmentTotals[segment].current,
      segmentTotals[segment].hist
    );
  }

  return {
    segments,
    rows: pivotRows,
    segmentTotals,
    grandTotal,
  };
};

export const mapLubesSalesAreaRows = (rows: Record<string, unknown>[]): LubesSalesAreaRow[] =>
  rows
    .map((row) => {
      const salesArea = pickField(row, ["ORG_SA_NM", "org_sa_nm", "ORGSA_NM", "sales_area"]);
      if (!salesArea || salesArea.toLowerCase() === "null") return null;
      return {
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        ORG_SA_NM: salesArea,
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesSalesAreaRow => row !== null);

export const buildSalesAreaChartData = (
  rows: LubesSalesAreaRow[],
  currentFY: string,
  previousFY: string
): SalesAreaChartRow[] => {
  const byArea = new Map<string, { current: number; hist: number }>();

  for (const row of rows) {
    const entry = byArea.get(row.ORG_SA_NM) ?? { current: 0, hist: 0 };
    if (row.FISCAL_YEAR === currentFY) entry.current += row.Total;
    if (row.FISCAL_YEAR === previousFY) entry.hist += row.Total;
    byArea.set(row.ORG_SA_NM, entry);
  }

  return Array.from(byArea.entries())
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((a, b) => b.current - a.current);
};

export const mapLubesRegionalOfficerRows = (
  rows: Record<string, unknown>[]
): LubesRegionalOfficerRow[] =>
  rows
    .map((row) => {
      const regionalOfficer = pickField(row, [
        "ORG_RO_NM",
        "org_ro_nm",
        "ORGRO_NM",
        "regional_officer",
      ]);
      if (!regionalOfficer || regionalOfficer.toLowerCase() === "null") return null;
      return {
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        ORG_RO_NM: regionalOfficer,
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesRegionalOfficerRow => row !== null);

export const buildRegionalOfficerChartData = (
  rows: LubesRegionalOfficerRow[],
  currentFY: string,
  previousFY: string
): SalesAreaChartRow[] => {
  const byOfficer = new Map<string, { current: number; hist: number }>();

  for (const row of rows) {
    const entry = byOfficer.get(row.ORG_RO_NM) ?? { current: 0, hist: 0 };
    if (row.FISCAL_YEAR === currentFY) entry.current += row.Total;
    if (row.FISCAL_YEAR === previousFY) entry.hist += row.Total;
    byOfficer.set(row.ORG_RO_NM, entry);
  }

  return Array.from(byOfficer.entries())
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((a, b) => b.current - a.current);
};

export const mapLubesProductCategoryRows = (
  rows: Record<string, unknown>[]
): LubesProductCategoryRow[] =>
  rows
    .map((row) => {
      const productCategory = pickField(row, [
        "PRODUCT_CATEGORY",
        "product_category",
        "Product_Category",
      ]);
      if (!productCategory || productCategory.toLowerCase() === "null") return null;
      return {
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        PRODUCT_CATEGORY: productCategory,
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesProductCategoryRow => row !== null);

export const buildProductCategoryChartData = (
  rows: LubesProductCategoryRow[],
  currentFY: string,
  previousFY: string
): SalesAreaChartRow[] => {
  const byCategory = new Map<string, { current: number; hist: number }>();

  for (const row of rows) {
    const entry = byCategory.get(row.PRODUCT_CATEGORY) ?? { current: 0, hist: 0 };
    if (row.FISCAL_YEAR === currentFY) entry.current += row.Total;
    if (row.FISCAL_YEAR === previousFY) entry.hist += row.Total;
    byCategory.set(row.PRODUCT_CATEGORY, entry);
  }

  return Array.from(byCategory.entries())
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((a, b) => b.current - a.current);
};

export const mapLubesItemCategoryRows = (
  rows: Record<string, unknown>[]
): LubesItemCategoryRow[] =>
  rows
    .map((row) => {
      const materialName = pickField(row, [
        "MATERIAL_NM",
        "material_nm",
        "Material_Nm",
        "MATERIAL_NAME",
      ]);
      if (!materialName || materialName.toLowerCase() === "null") return null;
      return {
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        MATERIAL_NM: materialName,
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesItemCategoryRow => row !== null);

export const buildItemCategoryChartData = (
  rows: LubesItemCategoryRow[],
  currentFY: string,
  previousFY: string
): SalesAreaChartRow[] => {
  const byItem = new Map<string, { current: number; hist: number }>();

  for (const row of rows) {
    const entry = byItem.get(row.MATERIAL_NM) ?? { current: 0, hist: 0 };
    if (row.FISCAL_YEAR === currentFY) entry.current += row.Total;
    if (row.FISCAL_YEAR === previousFY) entry.hist += row.Total;
    byItem.set(row.MATERIAL_NM, entry);
  }

  return Array.from(byItem.entries())
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((a, b) => b.current - a.current);
};

export const mapLubesBldCategoryRows = (
  rows: Record<string, unknown>[]
): LubesBldCategoryRow[] =>
  rows
    .map((row) => {
      const name = pickField(row, ["NAME1", "name1", "Name1"]);
      if (!name || name.toLowerCase() === "null") return null;
      return {
        FISCAL_YEAR: pickField(row, ["FISCAL_YEAR", "fiscal_year", "FISCALYEAR"]),
        NAME1: name,
        Total: Number(row.Total ?? row.total ?? 0),
      };
    })
    .filter((row): row is LubesBldCategoryRow => row !== null);

export const buildBldCategoryChartData = (
  rows: LubesBldCategoryRow[],
  currentFY: string,
  previousFY: string
): SalesAreaChartRow[] => {
  const byBld = new Map<string, { current: number; hist: number }>();

  for (const row of rows) {
    const entry = byBld.get(row.NAME1) ?? { current: 0, hist: 0 };
    if (row.FISCAL_YEAR === currentFY) entry.current += row.Total;
    if (row.FISCAL_YEAR === previousFY) entry.hist += row.Total;
    byBld.set(row.NAME1, entry);
  }

  return Array.from(byBld.entries())
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((a, b) => b.current - a.current);
};

export const truncateChartLabel = (value: string, max = 14) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

export const splitChartLabelLines = (
  value: string,
  maxCharsPerLine = 14
): [string, string?] => {
  const trimmed = value.trim();
  if (!trimmed) return ["", undefined];
  if (trimmed.length <= maxCharsPerLine) return [trimmed, undefined];

  const mid = Math.floor(trimmed.length / 2);
  let splitIdx = trimmed.lastIndexOf(" ", mid + 4);
  if (splitIdx <= 0 || splitIdx >= trimmed.length - 1) {
    splitIdx = mid;
  }

  let line1 = trimmed.slice(0, splitIdx).trim();
  let line2 = trimmed.slice(splitIdx).trim();
  if (line1.length > maxCharsPerLine) {
    line1 = `${line1.slice(0, maxCharsPerLine)}…`;
  }
  if (line2.length > maxCharsPerLine) {
    line2 = `${line2.slice(0, maxCharsPerLine)}…`;
  }

  return [line1, line2 || undefined];
};

export const rowMatchesPeriodFilter = (row: LubesCompanyRow, filter: PeriodFilter) => {
  if (filter.mode === "month") return row.MONTH_NAME === filter.id;
  if (filter.mode === "quarter") return row.QUARTER === filter.id;
  return row.HALF_YEAR === filter.id;
};

export const filterRowsByPeriods = (rows: LubesCompanyRow[], filters: PeriodFilter[]) => {
  if (filters.length === 0) return rows;
  return rows.filter((row) => filters.some((filter) => rowMatchesPeriodFilter(row, filter)));
};

export const filterPeriodRowsByPeriodFilters = (
  rows: LubesPeriodRow[],
  filters: PeriodFilter[]
): LubesPeriodRow[] => {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.some((filter) => {
      if (filter.mode === "month") return row.MONTH_NAME === filter.id;
      if (filter.mode === "quarter") return row.QUARTER === filter.id;
      return row.HALF_YEAR === filter.id;
    })
  );
};

export const buildCompanySummaries = (
  rows: LubesCompanyRow[],
  previousFY: string,
  currentFY: string
): CompanySummary[] => {
  const byCompany = new Map<string, { previous: number; current: number }>();

  for (const row of rows) {
    const entry = byCompany.get(row.COMPANY) ?? { previous: 0, current: 0 };
    if (row.FISCAL_YEAR === previousFY) entry.previous += row.Total;
    if (row.FISCAL_YEAR === currentFY) entry.current += row.Total;
    byCompany.set(row.COMPANY, entry);
  }

  return Array.from(byCompany.entries())
    .map(([company, totals]) => ({
      company,
      previousFyTotal: totals.previous,
      currentFyTotal: totals.current,
      difference: totals.current - totals.previous,
    }))
    .sort((a, b) => a.company.localeCompare(b.company));
};

export type LubesCompanyCompareChartRow = {
  category: string;
  previous: number;
  current: number;
  pct: number;
};

export const buildCompanyCompareChartData = (
  rows: LubesCompanyRow[],
  previousFY: string,
  currentFY: string
): LubesCompanyCompareChartRow[] =>
  buildCompanySummaries(rows, previousFY, currentFY).map((summary) => ({
    category: summary.company,
    previous: summary.previousFyTotal,
    current: summary.currentFyTotal,
    pct: calcChangePct(summary.currentFyTotal, summary.previousFyTotal),
  }));

export type LubesPeriodTrendPoint = {
  category: string;
  current: number;
  previous: number;
};

const getPeriodBucketKey = (row: LubesPeriodRow, mode: PeriodViewMode): string => {
  if (mode === "half") return row.HALF_YEAR;
  if (mode === "quarter") return row.QUARTER;
  return row.MONTH_NAME;
};

export const buildPeriodTrendChartData = (
  rows: LubesPeriodRow[],
  mode: PeriodViewMode,
  currentFY: string,
  previousFY: string
): LubesPeriodTrendPoint[] => {
  const order =
    mode === "half"
      ? HALF_YEAR_ORDER
      : mode === "quarter"
        ? QUARTER_ORDER
        : FISCAL_MONTH_ORDER;

  const buckets = sortByOrder(
    [...new Set(rows.map((row) => getPeriodBucketKey(row, mode)).filter(Boolean))],
    order
  );

  return buckets.map((bucket) => ({
    category: bucket,
    current: rows
      .filter(
        (row) =>
          row.FISCAL_YEAR === currentFY && getPeriodBucketKey(row, mode) === bucket
      )
      .reduce((sum, row) => sum + row.Total, 0),
    previous: rows
      .filter(
        (row) =>
          row.FISCAL_YEAR === previousFY && getPeriodBucketKey(row, mode) === bucket
      )
      .reduce((sum, row) => sum + row.Total, 0),
  }));
};

const sumPeriodRows = (
  rows: LubesPeriodRow[],
  fiscalYear: string,
  filters: { halfYear?: string; quarter?: string; month?: string }
) =>
  rows
    .filter((row) => {
      if (row.FISCAL_YEAR !== fiscalYear) return false;
      if (filters.halfYear && row.HALF_YEAR !== filters.halfYear) return false;
      if (filters.quarter && row.QUARTER !== filters.quarter) return false;
      if (filters.month && row.MONTH_NAME !== filters.month) return false;
      return true;
    })
    .reduce((sum, row) => sum + row.Total, 0);

const buildCompare = (
  rows: LubesPeriodRow[],
  currentFY: string,
  previousFY: string,
  filters: { halfYear?: string; quarter?: string; month?: string }
): CompareValues => {
  const current = sumPeriodRows(rows, currentFY, filters);
  const hist = sumPeriodRows(rows, previousFY, filters);
  return { current, hist, pct: calcChangePct(current, hist) };
};

export const buildPeriodCardItems = (
  rows: LubesPeriodRow[],
  currentFY: string,
  previousFY: string,
  mode: PeriodViewMode
): PeriodCardItem[] => {
  if (mode === "month") {
    const months = sortByOrder(
      [...new Set(rows.map((row) => row.MONTH_NAME).filter(Boolean))],
      FISCAL_MONTH_ORDER
    );
    return months.map((month) => ({
      id: month,
      label: monthLabel(month),
      compare: buildCompare(rows, currentFY, previousFY, { month }),
    }));
  }

  if (mode === "quarter") {
    const quarters = sortByOrder(
      [...new Set(rows.map((row) => row.QUARTER).filter(Boolean))],
      QUARTER_ORDER
    );
    return quarters.map((quarter) => ({
      id: quarter,
      label: quarter,
      compare: buildCompare(rows, currentFY, previousFY, { quarter }),
    }));
  }

  const halfYears = sortByOrder(
    [...new Set(rows.map((row) => row.HALF_YEAR).filter(Boolean))],
    HALF_YEAR_ORDER
  );
  return halfYears.map((halfYear) => ({
    id: halfYear,
    label: halfYear,
    compare: buildCompare(rows, currentFY, previousFY, { halfYear }),
  }));
};

export const formatTmt = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "—";

export const formatTmtSmart = (value: number) => formatTmt(value);

export const formatFilterSummary = (values: string[]) => {
  if (values.length === 0) return "All";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return values.join(", ");
  return `${values[0]}, +${values.length - 1} more`;
};

export const formatPct = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
};

export const formatDifference = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  const formatted = formatTmtSmart(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
};

export const periodFilterKey = (filter: PeriodFilter) => `${filter.mode}:${filter.id}`;

export const isPeriodFilterChecked = (filters: PeriodFilter[], filter: PeriodFilter) =>
  filters.some(
    (entry) => entry.mode === filter.mode && entry.id === filter.id
  );

export const togglePeriodFilterDraft = (
  filters: PeriodFilter[],
  filter: PeriodFilter
): PeriodFilter[] => {
  if (isPeriodFilterChecked(filters, filter)) {
    return filters.filter(
      (entry) => !(entry.mode === filter.mode && entry.id === filter.id)
    );
  }
  return [...filters, filter];
};
