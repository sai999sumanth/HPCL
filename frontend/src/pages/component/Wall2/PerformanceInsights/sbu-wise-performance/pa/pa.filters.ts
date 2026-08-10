import type { PAFilterState } from "./pa.types";

export type PaWidgetFilters = Record<
  string,
  string | string[] | { operator: string; value: string }
>;

export const EMPTY_PA_FILTERS: PAFilterState = {
  region:    "",
  salesArea: "",
  segment:   "",
  product:   "",
  period:    "fy",
};

/** Maps PA filter bar selections to lubes_baazar_data aggregation filters. */
export function buildPaWidgetFilters(filters: PAFilterState): PaWidgetFilters {
  const out: PaWidgetFilters = {};

  if (filters.salesArea) {
    out.ORG_SA_NM = filters.salesArea;
  } else {
    out.ORG_SA_NM = { operator: "like", value: "%BAZ%" };
  }

  if (filters.region)  out.ORG_RO_NM = filters.region;
  if (filters.segment) out.SEGMENT = filters.segment;
  if (filters.product) out.PRODUCT_CATEGORY = filters.product;

  switch (filters.period) {
    case "h1": out.HALF_YEAR = "H1"; break;
    case "h2": out.HALF_YEAR = "H2"; break;
    case "q1": out.QUARTER = "Q1"; break;
    case "q2": out.QUARTER = "Q2"; break;
    case "q3": out.QUARTER = "Q3"; break;
    case "q4": out.QUARTER = "Q4"; break;
    default: break;
  }

  return out;
}

export function mergePaFilters(
  ...parts: Record<string, unknown>[]
): Record<string, unknown> {
  return Object.assign({}, ...parts);
}

/** Draft shape for distinct-values API (single selections). */
export function paFilterStateToDraft(filters: PAFilterState) {
  return {
    ...(filters.region    ? { region:    filters.region }    : {}),
    ...(filters.salesArea ? { salesArea: filters.salesArea } : {}),
    ...(filters.segment   ? { segment:   filters.segment }   : {}),
    ...(filters.product   ? { product:   filters.product }   : {}),
  };
}
