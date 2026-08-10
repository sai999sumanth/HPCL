import type { PAFilterState } from "./pa.types";
import type { PaDateRange } from "./pa.utils";
import { buildPaWidgetFilters, mergePaFilters, EMPTY_PA_FILTERS } from "./pa.filters";

const AGG = ["['Total', 'sum', 'NET_WEIGHT_TMT']"];

export const API_URL = "/api/tableanalytics/generate_data_aggregations";

const fyFilters = (fiscalYear: string, filters: PAFilterState = EMPTY_PA_FILTERS) =>
  mergePaFilters({ FISCAL_YEAR: fiscalYear }, buildPaWidgetFilters(filters));

export const withPaDateRange = <T extends Record<string, unknown>>(
  payload: T,
  dateRange?: PaDateRange | null,
): T =>
  dateRange
    ? {
        ...payload,
        date_column: "PS_DT_ID",
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
      }
    : payload;

export const regionPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['ORG_RO_NM', 'asc']"], limit: 0, skip: 0,
  group_by: ["ORG_RO_NM"],
}, dateRange);

export const regionMonthlyPayload = (
  fiscalYear: string,
  roName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { ORG_RO_NM: roName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MONTH_NAME', 'asc']"], limit: 0, skip: 0,
  group_by: ["MONTH_NAME"],
}, dateRange);

export const saMonthlyPayload = (
  fiscalYear: string,
  saName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { ORG_SA_NM: saName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MONTH_NAME', 'asc']"], limit: 0, skip: 0,
  group_by: ["MONTH_NAME"],
}, dateRange);

export const saPayload = (
  fiscalYear: string,
  roName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { ORG_RO_NM: roName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['ORG_RO_NM', 'asc']"], limit: 0, skip: 0,
  group_by: ["ORG_RO_NM", "ORG_SA_NM"],
}, dateRange);

export const distPayload = (
  fiscalYear: string,
  saName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { ORG_SA_NM: saName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['NAME1', 'asc']"], limit: 0, skip: 0,
  group_by: ["NAME1"],
}, dateRange);

export const segmentPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['SEGMENT', 'asc']"], limit: 0, skip: 0,
  group_by: ["SEGMENT"],
}, dateRange);

export const monthlyPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MONTH_NAME', 'asc']"], limit: 0, skip: 0,
  group_by: ["MONTH_NAME"],
}, dateRange);

export const totalSalesPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['FISCAL_YEAR', 'asc']"], limit: 0, skip: 0,
  group_by: ["CATEGORY", "FISCAL_YEAR"],
}, dateRange);

export const productPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
  limit = 10,
  order: "ASC" | "DESC" = "DESC",
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: [`['Total', '${order}']`], limit, skip: 0,
  group_by: ["MATERIAL_NM"],
}, dateRange);

export const topDistPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
  limit = 10,
  groupBy: string[] = ["NAME1"],
  order: "ASC" | "DESC" = "DESC",
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: [`['Total', '${order}']`], limit, skip: 0,
  group_by: groupBy,
}, dateRange);

export const bottomDistPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['Total', 'ASC']"], limit: 10, skip: 0,
  group_by: ["NAME1", "ORG_RO_NM"],
}, dateRange);

export const paretoDistPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['Total', 'DESC']"], limit: 0, skip: 0,
  group_by: ["NAME1"],
}, dateRange);

export const heatmapPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['Total', 'DESC']"], limit: 0, skip: 0,
  group_by: ["SEGMENT", "ORG_RO_NM"],
}, dateRange);

export const productSegmentPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['Total', 'DESC']"], limit: 0, skip: 0,
  group_by: ["SEGMENT", "MATERIAL_NM"],
}, dateRange);

export const regionSaPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['Total', 'DESC']"], limit: 0, skip: 0,
  group_by: ["ORG_RO_NM", "ORG_SA_NM"],
}, dateRange);

export const quarterlyPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['Total', 'DESC']"], limit: 0, skip: 0,
  group_by: ["QUARTER"],
}, dateRange);

/** Curr + prev FY half-year totals in one call (Sales trend tab). */
export const halfYearTrendPayload = (
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
) => ({
  table: "lubes_baazar_data",
  filters: mergePaFilters(
    { FISCAL_YEAR: [cFY, pFY], CATEGORY: ["Bazaar"] },
    buildPaWidgetFilters({ ...filters, period: "fy" }),
  ),
  date_column: null,
  date_from: null,
  date_to: null,
  aggregations: AGG,
  detail_fields: [],
  order_by: ["['FISCAL_YEAR', 'asc']"],
  limit: 0,
  skip: 0,
  group_by: ["FISCAL_YEAR", "HALF_YEAR"],
});

export const momPayload = (
  fiscalYear: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: fyFilters(fiscalYear, filters),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['Total', 'DESC']"], limit: 0, skip: 0,
  group_by: ["MONTH_NAME"],
}, dateRange);

export const segmentMonthlyPayload = (
  fiscalYear: string,
  segmentName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { SEGMENT: segmentName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MONTH_NAME', 'asc']"], limit: 0, skip: 0,
  group_by: ["MONTH_NAME"],
}, dateRange);

export const segmentCategoryMonthlyPayload = (
  fiscalYear: string,
  segmentName: string,
  productCategory: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(
    fyFilters(fiscalYear, filters),
    { SEGMENT: segmentName, PRODUCT_CATEGORY: productCategory },
  ),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MONTH_NAME', 'asc']"], limit: 0, skip: 0,
  group_by: ["MONTH_NAME"],
}, dateRange);

export const productMonthlyPayload = (
  fiscalYear: string,
  productName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { MATERIAL_NM: productName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MONTH_NAME', 'asc']"], limit: 0, skip: 0,
  group_by: ["MONTH_NAME"],
}, dateRange);

export const distributorMonthlyPayload = (
  fiscalYear: string,
  distributorName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { NAME1: distributorName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MONTH_NAME', 'asc']"], limit: 0, skip: 0,
  group_by: ["MONTH_NAME"],
}, dateRange);

export const segmentItemPayload = (
  fiscalYear: string,
  segmentName: string,
  productCategory: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(
    fyFilters(fiscalYear, filters),
    { SEGMENT: segmentName, PRODUCT_CATEGORY: productCategory },
  ),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MATERIAL_NM', 'asc']"], limit: 0, skip: 0,
  group_by: ["MATERIAL_NM"],
}, dateRange);

export const segmentProductCategoryPayload = (
  fiscalYear: string,
  segmentName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { SEGMENT: segmentName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['PRODUCT_CATEGORY', 'asc']"], limit: 0, skip: 0,
  group_by: ["PRODUCT_CATEGORY"],
}, dateRange);

export const productDetailPayload = (
  fiscalYear: string,
  productName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { MATERIAL_NM: productName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['MATERIAL_NM', 'asc']"], limit: 0, skip: 0,
  group_by: ["MATERIAL_NM"],
}, dateRange);

export const distributorDetailPayload = (
  fiscalYear: string,
  distributorName: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { NAME1: distributorName }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['NAME1', 'asc']"], limit: 0, skip: 0,
  group_by: ["NAME1"],
}, dateRange);

export const distributorStatusCountPayload = (
  fiscalYear: string,
  status: "Active" | "Inactive",
  filters: PAFilterState = EMPTY_PA_FILTERS,
  dateRange?: PaDateRange | null,
) => withPaDateRange({
  table: "lubes_baazar_data",
  filters: mergePaFilters(fyFilters(fiscalYear, filters), { STATUS: status }),
  date_column: null, date_from: null, date_to: null,
  aggregations: AGG, detail_fields: [],
  order_by: ["['NAME1', 'asc']"], limit: 0, skip: 0,
  group_by: ["NAME1"],
}, dateRange);

export type PaDistinctWhereCond = {
  key: string;
  cond: string;
  value: string;
};

export type PaFilterDraft = {
  region?:    string;
  salesArea?: string;
  segment?:   string;
  product?:   string;
};

/** Payload for /api/charts/get_distinct_values — PA filter dropdowns */
export const paFilterDistinctPayload = (
  fiscalYear: string,
  draft: PaFilterDraft = {},
) => {
  const where_cond: PaDistinctWhereCond[] = [
    { key: "ORG_SA_NM", cond: "like", value: "BAZ" },
    { key: "FISCAL_YEAR", cond: "=", value: fiscalYear },
  ];

  if (draft.region)    where_cond.push({ key: "ORG_RO_NM", cond: "=", value: draft.region });
  if (draft.salesArea) where_cond.push({ key: "ORG_SA_NM", cond: "=", value: draft.salesArea });
  if (draft.segment)   where_cond.push({ key: "SEGMENT", cond: "=", value: draft.segment });
  if (draft.product)   where_cond.push({ key: "PRODUCT_CATEGORY", cond: "=", value: draft.product });

  return {
    connection_id: 1,
    schema: "public",
    table: "lubes_baazar_data",
    column: ["SEGMENT", "PRODUCT_CATEGORY", "ORG_RO_NM", "ORG_SA_NM"],
    where_cond,
  };
};

export const PA_FILTER_DISTINCT_URL = "/api/charts/get_distinct_values";
