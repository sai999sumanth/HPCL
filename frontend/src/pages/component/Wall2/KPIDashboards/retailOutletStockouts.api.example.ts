/**
 * Retail outlet stockouts — `POST /api/dryoutmanagement/get_retail_outlet_stockouts`
 * - `retail_outlet_stockout_distribution` — three-way split (no / partial / full dryouts).
 * - `retail_outlet_stockouts` — two-way split (without / with dryouts).
 */

export const RETAIL_OUTLET_STOCKOUTS_API = "/api/dryoutmanagement/get_retail_outlet_stockouts";
export const RETAIL_OUTLET_STOCKOUT_DISTRIBUTION_ACTION = "retail_outlet_stockout_distribution";
export const RETAIL_OUTLET_STOCKOUTS_ACTION = "retail_outlet_stockouts";

/** Request body (filters + cross_filters from top bar, e.g. DATE range). */
export interface RetailOutletStockoutsRequestBody {
  filters: unknown[];
  cross_filters: Array<{ key: string; cond: string; value: string }>;
  action: string;
  drill_state: string;
}

export interface StockoutSummarySlice {
  count: number;
  /** Share of total ROs, 0–100 */
  pct: number;
}

export interface ZoneStockoutRow {
  zone_code: string;
  without_dryouts_pct: number;
  partial_dryouts_pct: number;
  full_dryouts_pct: number;
  without_dryouts_count: number;
  partial_dryouts_count: number;
  full_dryouts_count: number;
}

/** Successful API envelope — distribution (three slices + stacked zone bars). */
export interface RetailOutletStockoutsApiResponse {
  status: boolean;
  message: string;
  summary: {
    without_dryouts: StockoutSummarySlice;
    partial_dryouts: StockoutSummarySlice;
    full_dryouts: StockoutSummarySlice;
  };
  zones: ZoneStockoutRow[];
}

export interface ZoneStockoutBinaryRow {
  zone_code: string;
  without_dryouts_pct: number;
  with_dryouts_pct: number;
  without_dryouts_count: number;
  with_dryouts_count: number;
}

/** Successful API envelope — without vs with dryouts only (`action`: `retail_outlet_stockouts`). */
export interface RetailOutletStockoutsBinaryApiResponse {
  status: boolean;
  message: string;
  summary: {
    without_dryouts: StockoutSummarySlice;
    with_dryouts: StockoutSummarySlice;
  };
  zones: ZoneStockoutBinaryRow[];
}
