export type PeriodViewMode = "month" | "quarter" | "half";

export type LubesCompanyRow = {
  COMPANY: string;
  FISCAL_YEAR: string;
  HALF_YEAR: string;
  QUARTER: string;
  MONTH_NAME: string;
  Total: number;
};

export type LubesPeriodRow = {
  FISCAL_YEAR: string;
  HALF_YEAR: string;
  QUARTER: string;
  MONTH_NAME: string;
  Total: number;
};

export type LubesSegmentRow = {
  FISCAL_YEAR: string;
  SEGMENT: string;
  Total: number;
};

export type LubesPremiumSegmentRow = {
  FISCAL_YEAR: string;
  PREMIUM_SEGMENT: string;
  Total: number;
};

export type LubesSegmentOfficerRow = {
  FISCAL_YEAR: string;
  SEGMENT: string;
  ORG_RO_NM: string;
  Total: number;
};

export type SegmentTableRow = {
  key: string;
  segment: string;
  regionalOfficer: string;
  current: number;
  hist: number;
  pct: number;
};

export type SegmentPivotCell = {
  current: number;
  hist: number;
  pct: number;
};

export type SegmentPivotRow = {
  key: string;
  region: string;
  regionRaw: string;
  bySegment: Record<string, SegmentPivotCell>;
  total: SegmentPivotCell;
};

export type SegmentPivotTableData = {
  segments: string[];
  rows: SegmentPivotRow[];
  segmentTotals: Record<string, SegmentPivotCell>;
  grandTotal: SegmentPivotCell;
};

export type LubesSalesAreaRow = {
  FISCAL_YEAR: string;
  ORG_SA_NM: string;
  Total: number;
};

export type LubesRegionalOfficerRow = {
  FISCAL_YEAR: string;
  ORG_RO_NM: string;
  Total: number;
};

export type LubesProductCategoryRow = {
  FISCAL_YEAR: string;
  PRODUCT_CATEGORY: string;
  Total: number;
};

export type LubesItemCategoryRow = {
  FISCAL_YEAR: string;
  MATERIAL_NM: string;
  Total: number;
};

export type LubesBldCategoryRow = {
  FISCAL_YEAR: string;
  NAME1: string;
  Total: number;
};

export type SalesAreaChartRow = {
  name: string;
  current: number;
  hist: number;
};

export type SalesAreaTableRow = SalesAreaChartRow & {
  pct: number;
};

export type CompanySummary = {
  company: string;
  previousFyTotal: number;
  currentFyTotal: number;
  difference: number;
};

export type CompareValues = {
  current: number;
  hist: number;
  pct: number;
};

export type PeriodCardItem = {
  id: string;
  label: string;
  compare: CompareValues;
};

export type PeriodFilter = {
  mode: PeriodViewMode;
  id: string;
};
