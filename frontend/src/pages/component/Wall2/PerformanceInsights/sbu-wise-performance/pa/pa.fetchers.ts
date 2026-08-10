import { apiClient } from "@/services/apiClient";
import {
  regionPayload, segmentPayload, monthlyPayload, totalSalesPayload,
  productPayload, topDistPayload, bottomDistPayload, paretoDistPayload, heatmapPayload,
  productSegmentPayload, regionSaPayload, quarterlyPayload, halfYearTrendPayload, momPayload,
  distributorStatusCountPayload,
  paFilterDistinctPayload, PA_FILTER_DISTINCT_URL,
  type PaFilterDraft,
  API_URL,
} from "./pa.payloads";
import { EMPTY_PA_FILTERS } from "./pa.filters";
import type { CompareMode } from "./pa.shared";
import {
  normalizeRows, buildTwoFyFromSingleFyResponses, buildPivot,
  getPaDateRange,
  gf, nf, FISCAL_MONTH_ORDER, QUARTER_ORDER, normalizeMonthKey, monthYoyPct,
  getVisibleFiscalMonths,
} from "./pa.utils";
import { parseDistinctColumnValues } from "../lubesSalesPerformance.utils";
import type { TwoFyRow, SimpleRow, DistRankRow, RegionSaRow, MomRow, HalfYearRow, PivotData, PAFilterOptions, PAFilterState } from "./pa.types";
import { EMPTY_PIVOT } from "./pa.types";

const post = (payload: object) => apiClient.post(API_URL, payload);

export type PaVolumeOrder = "asc" | "desc";

export type PaFetchOptions = {
  compareMode?: CompareMode;
  volumeOrder?: PaVolumeOrder;
};

const dates = (fy: string, compareMode: CompareMode = "fy") =>
  getPaDateRange(fy, compareMode);

/** Fire two parallel API calls — one per fiscal year — and return normalized rows. */
export async function postTwoFy(
  payloadForFy: (fiscalYear: string) => object,
  cFY: string,
  pFY: string,
) {
  const [curR, prevR] = await Promise.all([
    post(payloadForFy(cFY)),
    post(payloadForFy(pFY)),
  ]);
  return {
    current: normalizeRows(curR.data),
    previous: normalizeRows(prevR.data),
  };
}

export async function fetchYtdTotals(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
) {
  const [curR, prevR] = await Promise.all([
    post(totalSalesPayload(cFY, filters, getPaDateRange(cFY, compareMode))),
    post(totalSalesPayload(pFY, filters, getPaDateRange(pFY, compareMode))),
  ]);
  const sum = (data: unknown) =>
    normalizeRows(data)
      .filter((row: any) => row?.CATEGORY != null && String(row.CATEGORY) !== "null" && String(row.CATEGORY) !== "")
      .reduce((s: number, row: any) => s + nf(row), 0);
  return { ytdTotal: sum(curR.data), ytdPrevTotal: sum(prevR.data) };
}

export async function fetchRegionRows(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<TwoFyRow[]> {
  const { current, previous } = await postTwoFy(
    (fy) => regionPayload(fy, filters, dates(fy, compareMode)),
    cFY,
    pFY,
  );
  return buildTwoFyFromSingleFyResponses(current, previous, "ORG_RO_NM");
}

export async function fetchSegmentRows(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<TwoFyRow[]> {
  const { current, previous } = await postTwoFy(
    (fy) => segmentPayload(fy, filters, dates(fy, compareMode)),
    cFY,
    pFY,
  );
  return buildTwoFyFromSingleFyResponses(current, previous, "SEGMENT");
}

export async function fetchMonthlyMaps(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
) {
  const { current: curRows, previous: prevRows } = await postTwoFy(
    (fy) => monthlyPayload(fy, filters, dates(fy, compareMode)),
    cFY,
    pFY,
  );
  const current = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const row of curRows) {
    const m = normalizeMonthKey(gf(row, "MONTH_NAME"));
    if (m) current.set(m, (current.get(m) ?? 0) + nf(row));
  }
  for (const row of prevRows) {
    const m = normalizeMonthKey(gf(row, "MONTH_NAME"));
    if (m) previous.set(m, (previous.get(m) ?? 0) + nf(row));
  }
  return { current, previous };
}

export async function fetchProductRows(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy", volumeOrder = "desc" }: PaFetchOptions = {},
): Promise<TwoFyRow[]> {
  const apiOrder = volumeOrder === "asc" ? "ASC" : "DESC";
  const [curR, prevR] = await Promise.all([
    post(productPayload(cFY, filters, dates(cFY, compareMode), 10, apiOrder)),
    post(productPayload(pFY, filters, dates(pFY, compareMode), 0, apiOrder)),
  ]);
  const prevMap = new Map<string, number>();
  for (const row of normalizeRows(prevR.data)) {
    const name = gf(row, "MATERIAL_NM");
    if (name) prevMap.set(name, nf(row));
  }
  return normalizeRows(curR.data)
    .map((row) => {
      const name = gf(row, "MATERIAL_NM");
      if (!name) return null;
      const currentTotal = nf(row);
      const prevTotal = prevMap.get(name) ?? 0;
      return {
        name,
        currentTotal,
        prevTotal,
        growthPct: monthYoyPct(currentTotal, prevTotal),
      };
    })
    .filter((row): row is TwoFyRow => row !== null)
    .slice(0, 10);
}

export async function fetchTopDistributorRows(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy", volumeOrder = "desc" }: PaFetchOptions = {},
): Promise<TwoFyRow[]> {
  const apiOrder = volumeOrder === "asc" ? "ASC" : "DESC";
  const dateRangeCur = dates(cFY, compareMode);
  const dateRangePrev = dates(pFY, compareMode);
  const [topR, prevR] = await Promise.all([
    post(topDistPayload(cFY, filters, dateRangeCur, 10, ["NAME1"], apiOrder)),
    post(topDistPayload(pFY, filters, dateRangePrev, 0, ["NAME1"], apiOrder)),
  ]);
  const prevMap = new Map<string, number>();
  for (const row of normalizeRows(prevR.data)) {
    const name = gf(row, "NAME1");
    if (name) prevMap.set(name, nf(row));
  }
  return normalizeRows(topR.data)
    .map((row) => {
      const name = gf(row, "NAME1");
      if (!name) return null;
      const currentTotal = nf(row);
      const prevTotal = prevMap.get(name) ?? 0;
      return {
        name,
        currentTotal,
        prevTotal,
        growthPct: monthYoyPct(currentTotal, prevTotal),
      };
    })
    .filter((row): row is TwoFyRow => row !== null)
    .slice(0, 10);
}

async function fetchDistributorAverage(
  cFY: string,
  filters: PAFilterState,
  compareMode: CompareMode = "fy",
): Promise<number> {
  const r = await post(topDistPayload(cFY, filters, dates(cFY, compareMode), 0));
  const totals = normalizeRows(r.data).map((row) => nf(row));
  if (!totals.length) return 0;
  return totals.reduce((sum, val) => sum + val, 0) / totals.length;
}

function mapDistRankRow(row: unknown, avg: number): DistRankRow | null {
  const name = gf(row, "NAME1");
  if (!name) return null;
  const total = nf(row);
  return {
    name,
    region: gf(row, "ORG_RO_NM") || "—",
    total,
    vsAvg: total - avg,
  };
}

export async function fetchDistributorRows(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<{ top: DistRankRow[]; bottom: DistRankRow[] }> {
  const dateRangeCur = dates(cFY, compareMode);
  const [topR, botR, avg] = await Promise.all([
    post(topDistPayload(cFY, filters, dateRangeCur, 10, ["NAME1", "ORG_RO_NM"])),
    post(bottomDistPayload(cFY, filters, dateRangeCur)),
    fetchDistributorAverage(cFY, filters, compareMode),
  ]);
  return {
    top: normalizeRows(topR.data)
      .map((row) => mapDistRankRow(row, avg))
      .filter((row): row is DistRankRow => row !== null),
    bottom: normalizeRows(botR.data)
      .map((row) => mapDistRankRow(row, avg))
      .filter((row): row is DistRankRow => row !== null),
  };
}

export async function fetchParetoDistRows(
  cFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<SimpleRow[]> {
  const r = await post(paretoDistPayload(cFY, filters, dates(cFY, compareMode)));
  return normalizeRows(r.data)
    .map((row) => ({ name: gf(row, "NAME1"), total: nf(row) }))
    .filter((row) => row.name)
    .sort((a, b) => b.total - a.total);
}

export async function fetchDistributorStatusCounts(
  cFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<{ active: number; inactive: number }> {
  const countDistinct = (data: unknown) => {
    const names = new Set<string>();
    for (const row of normalizeRows(data)) {
      const name = gf(row, "NAME1");
      if (name) names.add(name);
    }
    return names.size;
  };

  const dateRange = dates(cFY, compareMode);
  const [activeR, inactiveR] = await Promise.all([
    post(distributorStatusCountPayload(cFY, "Active", filters, dateRange)),
    post(distributorStatusCountPayload(cFY, "Inactive", filters, dateRange)),
  ]);

  return {
    active: countDistinct(activeR.data),
    inactive: countDistinct(inactiveR.data),
  };
}

export async function fetchPaFilterOptions(
  fiscalYear: string,
  draft: PaFilterDraft = {},
): Promise<PAFilterOptions> {
  const r = await apiClient.post(PA_FILTER_DISTINCT_URL, paFilterDistinctPayload(fiscalYear, draft));
  const data = r.data;
  return {
    regions:    parseDistinctColumnValues(data, "ORG_RO_NM"),
    salesAreas: parseDistinctColumnValues(data, "ORG_SA_NM"),
    segments:   parseDistinctColumnValues(data, "SEGMENT"),
    products:   parseDistinctColumnValues(data, "PRODUCT_CATEGORY"),
  };
}

export async function fetchHeatPivot(
  cFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<PivotData> {
  const r = await post(heatmapPayload(cFY, filters, dates(cFY, compareMode)));
  return buildPivot(normalizeRows(r.data), "SEGMENT", "ORG_RO_NM");
}

export async function fetchMatrixPivot(
  cFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<PivotData> {
  const r = await post(productSegmentPayload(cFY, filters, dates(cFY, compareMode)));
  return buildPivot(normalizeRows(r.data), "MATERIAL_NM", "SEGMENT");
}

export async function fetchRegionSaRows(
  cFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<RegionSaRow[]> {
  const r = await post(regionSaPayload(cFY, filters, dates(cFY, compareMode)));
  return normalizeRows(r.data)
    .map((row) => ({ ro: gf(row, "ORG_RO_NM"), sa: gf(row, "ORG_SA_NM"), total: nf(row) }))
    .filter((row) => row.ro && row.sa);
}

export async function fetchHalfYearTrend(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
): Promise<HalfYearRow[]> {
  const r = await post(halfYearTrendPayload(cFY, pFY, filters));
  return normalizeRows(r.data)
    .map((row) => {
      const fiscalYear = gf(row, "FISCAL_YEAR");
      const halfYear = gf(row, "HALF_YEAR");
      if (!fiscalYear || !halfYear) return null;
      return { fiscalYear, halfYear, total: nf(row) };
    })
    .filter((row): row is HalfYearRow => row !== null);
}

export async function fetchQuarterlyRows(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<TwoFyRow[]> {
  const { current, previous } = await postTwoFy(
    (fy) => quarterlyPayload(fy, filters, dates(fy, compareMode)),
    cFY,
    pFY,
  );
  const rows = buildTwoFyFromSingleFyResponses(current, previous, "QUARTER");
  return QUARTER_ORDER.map(
    (q) => rows.find((row) => row.name === q) ?? { name: q, currentTotal: 0, prevTotal: 0, growthPct: 0 },
  );
}

export async function fetchMomRows(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  { compareMode = "fy" }: PaFetchOptions = {},
): Promise<MomRow[]> {
  const { current: curRows, previous: prevRows } = await postTwoFy(
    (fy) => momPayload(fy, filters, dates(fy, compareMode)),
    cFY,
    pFY,
  );
  const currentMonthly = new Map<string, number>();
  const prevMonthly = new Map<string, number>();
  for (const row of curRows) {
    const m = normalizeMonthKey(gf(row, "MONTH_NAME"));
    if (m) currentMonthly.set(m, (currentMonthly.get(m) ?? 0) + nf(row));
  }
  for (const row of prevRows) {
    const m = normalizeMonthKey(gf(row, "MONTH_NAME"));
    if (m) prevMonthly.set(m, (prevMonthly.get(m) ?? 0) + nf(row));
  }
  return getVisibleFiscalMonths(cFY).map((m) => {
    const i = FISCAL_MONTH_ORDER.indexOf(m);
    const total = currentMonthly.get(m) ?? 0;
    const prevMonth =
      i > 0
        ? FISCAL_MONTH_ORDER[i - 1]
        : FISCAL_MONTH_ORDER[FISCAL_MONTH_ORDER.length - 1];
    const prevTotal =
      i > 0
        ? (currentMonthly.get(prevMonth) ?? 0)
        : (prevMonthly.get(prevMonth) ?? 0);
    return { month: m, total, growth: monthYoyPct(total, prevTotal) };
  });
}

export async function fetchAllPaData(
  cFY: string,
  pFY: string,
  filters: PAFilterState = EMPTY_PA_FILTERS,
  options: PaFetchOptions = {},
) {
  const [
    ytd, region, segment, monthly, products, distributors, paretoDist,
    heat, matrix, regionSa, quarterly, mom, distStatus,
  ] = await Promise.all([
    fetchYtdTotals(cFY, pFY, filters, options),
    fetchRegionRows(cFY, pFY, filters, options),
    fetchSegmentRows(cFY, pFY, filters, options),
    fetchMonthlyMaps(cFY, pFY, filters, options),
    fetchProductRows(cFY, pFY, filters, options),
    fetchDistributorRows(cFY, pFY, filters, options),
    fetchParetoDistRows(cFY, filters, options),
    fetchHeatPivot(cFY, filters, options),
    fetchMatrixPivot(cFY, filters, options),
    fetchRegionSaRows(cFY, filters, options),
    fetchQuarterlyRows(cFY, pFY, filters, options),
    fetchMomRows(cFY, pFY, filters, options),
    fetchDistributorStatusCounts(cFY, filters, options),
  ]);

  return {
    ...ytd,
    regionRows: region,
    segmentRows: segment,
    monthlyCurrentMap: monthly.current,
    monthlyPrevMap: monthly.previous,
    productRows: products,
    topDistRows: distributors.top,
    bottomDistRows: distributors.bottom,
    paretoDistRows: paretoDist,
    heatPivot: heat,
    matrixPivot: matrix,
    regionSaRows: regionSa,
    quarterlyRows: quarterly,
    momRows: mom,
    activeDistributorCount: distStatus.active,
    inactiveDistributorCount: distStatus.inactive,
  };
}

export { EMPTY_PIVOT };
